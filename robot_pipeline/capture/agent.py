"""Host-side capture agent, reachable via pipes or SSH, not a public network API."""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from .profile import load_profile, LOOPBACK_DDS
from .protocol import serve
from .processes import Process, RemoteProcess, Node
from .runtime import atomic_json
from robot_pipeline.workbench.paths import file_hash, is_link, safe_relative

def probe(service):
    address=service['probe']
    try:
        with socket.create_connection((address['host'],address['port']),timeout=.4):return True
    except OSError:return False

class Agent:
    def __init__(self,profile_directory):
        self.profile=load_profile(profile_directory)
        self.lock=threading.RLock();self.state='idle';self.error=None;self.process=None
        self.services=[];self.session=None;self.directory=None;self.control=None;self.closed=False
        self.thread=None;self.archive_threads={};self.archives={}
        self.profile_summary={k:self.profile.get(k) for k in ('mode','backend','label','arm','ee','network_interface','image_server_ip','output_root')}

    def dispatch(self,action,payload):
        if action=='preflight':
            if payload.get('mode') and payload['mode']!=self.profile['mode']:raise ValueError('界面模式与执行机配置不一致')
            return {'profile':self.profile_summary,'free_bytes':shutil.disk_usage(self.profile['output_root']).free,
                    'checks':[{'name':'采集配置与版本','passed':True},{'name':'服务配置','passed':True}],
                    'hardware_verified':False,'note':'预检未初始化机器人控制器；XR输入与实际设备状态须另行核对'}
        if action=='status':return self.status()
        if action=='completed_page':
            offset=payload.get('offset',0)
            if not isinstance(offset,int) or offset<0:raise ValueError('完成事件分页无效')
            values=self.completed(limit=None)
            return {'episodes':values[offset:offset+100],'more':offset+100<len(values)}
        if action=='episode':
            item=next((e for e in self.completed(limit=None) if e['id']==payload.get('episode_id')),None)
            if not item:raise ValueError('未找到已完成回合')
            return item
        if action=='start_services':
            with self.lock:
                if self.state not in ('idle','stopped','failed'):return self.status()
                if not payload.get('operator_ready'):raise ValueError('启动包含控制初始化，请先完成界面所列现场准备')
                if self.process:raise ValueError('上一次会话尚未清理，请结束服务后重试')
                task=payload.get('task','')
                if not isinstance(task,str) or not task.strip() or len(task)>500:raise ValueError('需要有效采集任务')
                self.session=uuid.uuid4().hex
                self.directory=Path(self.profile['output_root'])/('capture-'+self.session)
                self.directory.mkdir()
                metadata={'session_id':self.session,'mode':self.profile['mode'],'synthetic':self.profile['backend']=='synthetic',
                          'task':task,'description':payload.get('description',''),'target':payload.get('target',''),
                          'created_at':time.time(),'profile':self.profile_summary}
                atomic_json(self.directory/'session.json',metadata)
                self.state='starting';self.error=None
                self.thread=threading.Thread(target=self._start,daemon=True);self.thread.start()
                return {'accepted':True,'session_id':self.session}
        if action in ('follow','record_start','record_stop'):
            return self._control(action)
        if action=='stop_services':
            with self.lock:
                status=self.status()
                if status['state'] in ('recording','saving') or status.get('pending'):
                    raise ValueError('请先停止录制并等待保存；状态未知时先核对采集端')
                if self.thread and self.thread.is_alive():raise ValueError('服务正在启动或退出，请等待状态明确')
                self.state='stopping'
                self.thread=threading.Thread(target=self._stop,daemon=True);self.thread.start()
            return {'accepted':True}
        if action=='cleanup':
            if not payload.get('operator_ready'):raise ValueError('需现场确认后才能清理本次失败进程')
            if self.status()['state'] not in ('failed','error','unknown'):raise ValueError('清理仅用于失败或状态未知的会话')
            self._cleanup();self.state='stopped';self.error='本次进程已清理；控制释放仍需现场核对'
            return {'accepted':True,'control_release_verified':False}
        if action=='archive':return self.archive(payload['episode_id'],bool(payload.get('retry')))
        if action=='read_archive':
            item=self.archives.get(payload['episode_id'])
            if not item or item['state']!='ready':raise ValueError('回合归档尚未完成')
            offset=payload.get('offset');size=payload.get('size',512*1024)
            if not isinstance(offset,int) or offset<0 or not isinstance(size,int) or not 1<=size<=512*1024:raise ValueError('传输区间无效')
            with Path(item['path']).open('rb') as handle:handle.seek(offset);data=handle.read(size)
            return {'offset':offset,'data':base64.b64encode(data).decode('ascii'),'eof':offset+len(data)>=item['bytes']}
        raise ValueError('采集操作不支持')

    def _start(self):
        try:
            for spec in self.profile['services']:
                if self.closed:raise ValueError('采集执行器正在关闭')
                entry={'id':spec['id'],'name':spec.get('label',spec['id']),'owned':False,'state':'starting'}
                self.services.append((entry,None))
                process=None
                if spec['manage']=='launch':
                    if probe(spec):raise ValueError(entry['name']+' 端口已占用；请明确改为复用或结束冲突实例')
                    config=dict(spec)
                    if self.profile['mode']=='simulation':
                        config['env']={**config.get('env',{}),'CYCLONEDDS_URI':LOOPBACK_DDS}
                    if spec.get('transport','local')=='ssh':process=RemoteProcess(config)
                    else:process=Process(spec['argv'],spec.get('cwd'),config.get('env'),self.directory/(spec['id']+'.log'))
                    entry['owned']=True
                    self.services[-1]=(entry,process)
                deadline=time.monotonic()+min(600,max(1,float(spec.get('startup_timeout',120))))
                while not probe(spec):
                    if self.closed:raise ValueError('启动已终止')
                    if process and not process.status()['running']:raise ValueError(entry['name']+' 已退出，请查看服务日志')
                    if time.monotonic()>deadline:raise ValueError(entry['name']+' 就绪探测超时')
                    time.sleep(.25)
                entry['state']='reachable'
            if self.closed:raise ValueError('执行器正在关闭，未继续启动遥操作')
            env={'PYTHONPATH':str(Path(__file__).resolve().parents[2])+(os.pathsep+os.environ['PYTHONPATH'] if os.environ.get('PYTHONPATH') else '')}
            if self.profile['mode']=='simulation':env['CYCLONEDDS_URI']=LOOPBACK_DDS
            self.process=Process([self.profile.get('python',sys.executable),'-u','-m','robot_pipeline.capture.launcher',
                '--profile-directory',self.profile['profile_directory'],'--session-directory',str(self.directory)],
                env=env,log=self.directory/'teleop.log')
            deadline=time.monotonic()+min(600,max(5,float(self.profile.get('startup_timeout',180))))
            while time.monotonic()<deadline and not self.closed:
                if not self.process.status()['running']:raise ValueError('遥操作进程在就绪前退出，请查看日志')
                if (self.directory/'bridge.json').exists():
                    self.control=json.loads((self.directory/'bridge.json').read_text())
                    current=self._control()
                    if current['state']=='ready':self.state='ready';return
                time.sleep(.25)
            raise ValueError('遥操作服务就绪超时；请查看相机、XR及SDK环境')
        except Exception as exc:
            self.error=str(exc);self.state='failed'
            # Retain ownership and logs. A failed initialization is not proof of released control.

    def _control(self,action=None):
        if not self.control:raise ValueError('采集桥尚未连接')
        data=json.dumps({'action':action}).encode() if action else None
        request=urllib.request.Request('http://127.0.0.1:'+str(self.control['port'])+'/control',data=data,
            headers={'Content-Type':'application/json','X-Capture-Token':self.control['token']})
        try:
            with urllib.request.urlopen(request,timeout=3) as response:return json.load(response)
        except urllib.error.HTTPError as exc:
            raise ValueError(json.loads(exc.read().decode('utf-8')).get('error','采集桥操作失败')) from None

    def status(self):
        with self.lock:
            result={'state':self.state,'profile':self.profile_summary,'session_id':self.session,'error':self.error,
                    'completed':[],'services':[],'hardware_verified':False,'synthetic':self.profile['backend']=='synthetic'}
            for entry,process in self.services:
                value=dict(entry)
                if process:
                    try:value.update(process.status())
                    except Exception as exc:value.update(state='unknown',log=str(exc))
                result['services'].append(value)
            if self.process:
                result['services'].append({'id':'teleop','name':'遥操作与记录器','owned':True,**self.process.status()})
                if self.control:
                    try:
                        current=self._control();result.update(current)
                        if self.state in ('starting','stopping','failed'):result['state']=self.state
                    except Exception as exc:
                        result.update(state='unknown' if self.process.p.poll() is None else 'failed',error=str(exc))
                if self.process.p.poll() is not None and self.state not in ('stopped','failed'):
                    result.update(state='failed',error='遥操作进程已退出，请核对日志和未完成回合')
            if self.state not in ('starting','stopping','stopped','idle','failed'):
                broken=[s['name'] for s in result['services'] if s['id']!='teleop' and (s.get('state')=='unknown' or s.get('owned') and s.get('running') is False)]
                if broken:result.update(state='unknown',error='依赖服务状态异常：'+'、'.join(broken)+'；先停止录制并检查服务')
            # Completed marker files survive a normal recorder exit and reconnect.
            result['completed']=self.completed()
            return result

    def completed(self,limit=200):
        items=[]
        for directory in Path(self.profile['output_root']).glob('capture-*'):
            if directory.is_symlink() or not directory.is_dir():continue
            for p in directory.glob('complete-*.json'):
                try:
                    value=json.loads(p.read_text(encoding='utf-8'))
                    if value.get('writer_complete') and value['metadata']['mode']==self.profile['mode']:
                        items.append(value)
                except (OSError,ValueError,KeyError):continue
        values=sorted(items,key=lambda i:i['saved_at'])
        return values[-limit:] if limit else values

    def archive(self,ident,retry=False):
        with self.lock:
            if retry and self.archives.get(ident,{}).get('state')=='failed':self.archives.pop(ident)
            if ident not in self.archives:
                episode=next((e for e in self.completed(limit=None) if e['id']==ident),None)
                if not episode:raise ValueError('未找到记录器确认保存的回合')
                self.archives[ident]={'state':'building'}
                thread=threading.Thread(target=self._archive,args=(episode,),daemon=True)
                self.archive_threads[ident]=thread;thread.start()
            value=self.archives[ident]
            return {k:v for k,v in value.items() if k!='path'}

    def _archive(self,episode):
        ident=episode['id']
        try:
            root=Path(episode['path']);output=Path(self.profile['output_root'])
            if not root.resolve().is_relative_to(output.resolve()) or root.is_symlink():raise ValueError('回合路径越出采集目录')
            manifest_path=output/('capture-'+episode['metadata']['session_id'])/safe_relative(episode['file_manifest'])
            if file_hash(manifest_path)!=episode['file_manifest_sha256']:raise ValueError('记录器完成清单发生变化')
            snapshot=json.loads(manifest_path.read_text(encoding='utf-8'))
            expected={f['path']:f for f in snapshot['files']}
            target=root.parent.parent/(ident+'.zip');temporary=target.with_suffix('.partial')
            files=[];total=0;seen=set();priority_at=0
            with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_STORED,allowZip64=True) as archive:
                for current,dirs,names in os.walk(root,followlinks=False):
                    for name in dirs+names:
                        path=Path(current)/name
                        if is_link(path):raise ValueError('采集目录包含链接')
                    for name in sorted(names):
                        if time.monotonic()-priority_at>.4:
                            while self.control and not self.closed:
                                try:recording=self._control().get('state') in ('recording','saving')
                                except OSError:recording=False
                                if not recording:break
                                time.sleep(.25)
                            priority_at=time.monotonic()
                        if self.closed:raise ValueError('执行器关闭，回合原件保留')
                        path=Path(current)/name;relative=safe_relative(path.relative_to(root).as_posix())
                        folded=relative.casefold()
                        if folded in seen:raise ValueError('回合路径不兼容 Windows 大小写规则')
                        seen.add(folded);total+=path.stat().st_size
                        if len(files)>=100000 or total>4*1024**3:raise ValueError('回合超过 4 GiB / 100000 文件的采集接收上限')
                        info=expected.get(relative)
                        digest=file_hash(path)
                        if not info or path.stat().st_size!=info['bytes'] or digest!=info['sha256']:
                            raise ValueError('记录器保存完成后的原始文件发生变化：'+relative)
                        archive.write(path,relative)
                        if file_hash(path)!=digest:raise ValueError('完成事件后的原始文件发生变化')
                        files.append({'path':relative,'bytes':path.stat().st_size,'sha256':digest})
                if {f['path'] for f in files}!=set(expected):raise ValueError('保存后的回合文件清单发生变化')
                archive.writestr('capture-manifest.json',json.dumps({'format':'robot_pipeline.capture.transfer.v1','episode':episode,'files':files},ensure_ascii=False))
            os.replace(temporary,target)
            self.archives[ident]={'state':'ready','path':str(target),'bytes':target.stat().st_size,'sha256':file_hash(target),'file_count':len(files)}
        except Exception as exc:self.archives[ident]={'state':'failed','error':str(exc)}

    def _stop(self):
        try:
            if self.process and self.process.p.poll() is None:
                if self.control:self._control('shutdown')
                try:self.process.p.wait(timeout=20)
                except Exception:raise ValueError('上游正常退出未完成，控制释放状态未知；需现场核对')
            self._cleanup();self.state='stopped';self.error=None
        except Exception as exc:self.state='unknown';self.error=str(exc)

    def _cleanup(self):
        if self.process:self.process.close();self.process=None
        for entry,process in reversed(self.services):
            if process:process.close()
        self.services=[];self.control=None

    def close(self):
        self.closed=True
        if self.thread and self.thread.is_alive():self.thread.join(timeout=25)
        if self.control and self.process and self.process.p.poll() is None:
            try:
                current=self._control()
                if current['state']=='recording':self._control('record_stop')
                deadline=time.monotonic()+10
                while time.monotonic()<deadline:
                    current=self._control()
                    if current['state'] not in ('recording','saving','starting'):break
                    time.sleep(.1)
                self._control('shutdown');self.process.p.wait(timeout=10)
            except Exception:pass
        self._cleanup()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--profile-directory');parser.add_argument('--node',action='store_true')
    args=parser.parse_args()
    serve(Node() if args.node else Agent(args.profile_directory))
if __name__=='__main__':main()
