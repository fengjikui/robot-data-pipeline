"""Single-user asset catalog and guarded, serial stage execution."""
from __future__ import annotations
import base64
import hashlib
import os
from pathlib import Path
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
import unicodedata
from . import __version__
from .data import inspect_directory
from .paths import file_hash, native_input, safe_relative, within, read_json, write_json, is_link
from .store import Store,identity,now
from .locking import WorkspaceLock
from .preparation import Preparation, fingerprint
from .capture import CaptureManager

POLICIES=('act','diffusion','openpi','openvla','ppo')
SOURCE_KINDS=('self_capture','open','purchased','simulation')
MAX_BYTES=128*1024*1024
MAX_FILES=10000

def text(value,field,max_length=300):
    if not isinstance(value,str) or len(value)>max_length:raise ValueError(f'{field} 必须为不超过 {max_length} 字符的文本')
    return value.strip()

class Workbench:
    def __init__(self,workspace):
        self.workspace=Path(workspace).resolve()
        self.workspace_lock=WorkspaceLock(self.workspace)
        try:self.store=Store(self.workspace)
        except BaseException:self.workspace_lock.close();raise
        self.csrf_token=secrets.token_urlsafe(32)
        self.preparation=Preparation(self.workspace,self.store)
        self.lock=threading.RLock();self.event=threading.Event();self.closed=False
        self.process=None;self.active_id=None;self.cancelled=set()
        self.capture_manager=CaptureManager(self)
        self.thread=threading.Thread(target=self._loop,name='pipeline-job-manager',daemon=True);self.thread.start()
    def state(self):
        return {'version':__version__,'project':self.store.get('project','current'),'capture':self.capture_config(),'capture_session':self.capture_manager.snapshot(),'assets':self.store.all('asset'),'datasets':self.preparation.summaries(),'jobs':self.store.all('job'),'capabilities':[
            {'id':'import','name':'来源登记与快照','available':True,'reason':'本机目录、来源与标签，128 MiB / 10000 文件以内'},
            {'id':'check','name':'结构质检','available':True,'reason':'Unitree 原始 JSON 28 维上肢记录；不证明同步或任务成功'},
            {'id':'export','name':'JSONL 导出','available':True,'reason':'项目自有契约；不是官方 LeRobot，尚不能直接训练策略'},
            {'id':'prepare','name':'回合选择与便携数据包','available':True,'reason':'片段、分组划分、来源采样与项目读取验收；不是官方训练器验收'},
            {'id':'capture','name':'遥操作采集','available':True,'reason':'本地/SSH执行器、真机/仿真配置、录制保存事件与自动入库；实际设备状态和验收以连接结果为准'},
            {'id':'convert','name':'官方转换','available':False,'reason':'固定版本参数已研究，上游依赖环境和数据契约待接入验收'},
            {'id':'train','name':'模型训练','available':False,'reason':'训练后端、依赖环境和目标策略读取器待接入'},
            {'id':'evaluate','name':'仿真评估','available':False,'reason':'任务场景、控制器和评价后端待接入'},
            {'id':'deploy','name':'真机部署','available':False,'reason':'部署包、控制权与真机安全验收待接入'}], 'csrf_token':self.csrf_token}
    def project(self,payload):
        project=self.store.get('project','current')
        for k in ('task','target','policy'):
            if k in payload:project[k]=text(payload[k],k)
        if project['policy'] not in POLICIES:raise ValueError('不支持此策略选项')
        if 'asset_id' in payload:
            asset_id=text(payload['asset_id'],'asset_id',32)
            if asset_id:self.store.get('asset',asset_id)
            project['asset_id']=asset_id
        return self.store.put('project',project)
    def capture_config(self,payload=None):
        fields={'robot_model':120,'hand':120,'host':200,'pc2':200,'camera':300,'receive_directory':2000}
        values=self.store.all('capture')
        config=values[0] if values else {'id':'current',**{key:'' for key in fields}}
        if payload is None:return config
        if set(payload)-set(fields):raise ValueError('采集配置包含未知字段')
        updated=dict(config)
        for key,value in payload.items():updated[key]=text(value,key,fields[key])
        if updated['receive_directory']:
            try:directory=native_input(updated['receive_directory'])
            except (FileNotFoundError,NotADirectoryError):raise ValueError('本机接收目录不存在，请通过系统选择器选择目录') from None
            if not directory.is_dir():raise ValueError('本机接收目录不存在，请通过系统选择器选择目录')
            updated['receive_directory']=str(directory.resolve())
        updated['updated_at']=now()
        return self.store.put('capture',updated)
    def import_asset(self,payload):
        source=native_input(payload.get('path',''))
        if not source.is_dir():raise ValueError('导入目标不是目录')
        if source==self.workspace or self.workspace.is_relative_to(source) or source.is_relative_to(self.workspace):raise ValueError('不能导入工作区或其父/子目录')
        kind=payload.get('source_kind','open')
        if kind not in SOURCE_KINDS:raise ValueError('未知来源类型')
        tags=payload.get('tags',[])
        if not isinstance(tags,list) or len(tags)>20:raise ValueError('标签应为最多 20 项的列表')
        tags=list(dict.fromkeys(text(x,'tag',40) for x in tags if x))
        aid=identity();base=self.workspace/'assets'/aid;raw=base/'raw'
        entries=[];total=0;seen=set()
        # Preflight before copying: reject links, foreign separators, case collisions and long paths.
        for current,dirs,files in os.walk(source,followlinks=False):
            for name in dirs+files:
                p=Path(current)/name
                if is_link(p):raise ValueError('导入不接受符号链接或目录联接')
                rel=p.relative_to(source).as_posix();safe_relative(rel)
                folded=unicodedata.normalize('NFC',rel).casefold()
                if folded in seen:raise ValueError('目录包含 Windows 上会冲突的大小写路径')
                seen.add(folded)
                if len(rel)>180:raise ValueError('相对路径超过 180 字符，请缩短数据目录层级')
                if p.is_file():
                    size=p.stat().st_size
                    if p.suffix.lower()=='.json' and size>20*1024*1024:raise ValueError('单个 JSON 超过首版 20 MiB 上限')
                    total+=size;entries.append((p,rel,size))
                    if total>MAX_BYTES or len(entries)>MAX_FILES:raise ValueError('超过首版导入上限：128 MiB / 10000 文件')
                elif not p.is_dir():raise ValueError('不支持设备文件或特殊文件')
        if not entries:raise ValueError('目录为空')
        raw.mkdir(parents=True)
        manifest=[]
        try:
            for p,rel,size in entries:
                if is_link(p) or not p.is_file():raise ValueError('导入期间源目录发生变化')
                dest=within(raw,rel)
                if os.name=='nt' and len(str(dest))>245:raise ValueError('Windows 完整路径过长，请将工作区移到更短的位置（例如 C:\\robot-data）')
                dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
                if dest.stat().st_size!=size:raise ValueError('导入期间源文件大小发生变化')
                manifest.append({'path':rel,'bytes':size,'sha256':file_hash(dest)})
            write_json(base/'manifest.json',{'format':'robot_pipeline.asset_snapshot.v1','files':manifest,'bytes':total})
            info=inspect_directory(raw)
            asset={'id':aid,'name':text(payload.get('name') or source.name,'name',120),'source_kind':kind,'source_reference':text(payload.get('source_reference',''),'source_reference',1000),'task':text(payload.get('task',''),'task'),'tags':tags,'license':text(payload.get('license','unknown'),'license'),'embodiment':text(payload.get('embodiment','unknown'),'embodiment'),'path':f'assets/{aid}/raw','manifest_path':f'assets/{aid}/manifest.json','manifest_sha256':file_hash(base/'manifest.json'),'created_at':now(),'bytes':total,'file_count':len(entries),'quality':None,'training_ready':False,'synthetic':bool(payload.get('_synthetic',False) or info.get('synthetic_declared',False)),**info}
            return self.store.put('asset',asset)
        except BaseException:
            shutil.rmtree(base,ignore_errors=True);raise
    def demo(self):
        # Explicitly generated only on user action; no robot or preloaded metrics.
        import tempfile
        with tempfile.TemporaryDirectory(prefix='pipeline-demo-') as td:
            root=Path(td)/'synthetic_episode';root.mkdir()
            png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP6sAAAAASUVORK5CYII=')
            (root/'image.png').write_bytes(png);rows=[]
            for i in range(12):
                state={x:{'qpos':[round(i*.001,4)]*7} for x in ('left_arm','right_arm','left_ee','right_ee')}
                action={x:{'qpos':[round(i*.001+.01,4)]*7} for x in state}
                rows.append({'idx':i,'timestamp':round(i/30,8),'colors':{'color_0':'image.png'},'states':state,'actions':action})
            write_json(root/'data.json',{'info':{'synthetic':True,'image':{'fps':30}},'text':{'goal':'SYNTHETIC 工作台流程测试，不是真机示范'},'data':rows})
            return self.import_asset({'path':str(root),'name':'合成流程样例（非真机）','source_kind':'simulation','task':'SYNTHETIC 工作台流程测试','tags':['合成','仅测试'],'license':'CC0-1.0 (generated fixture)','embodiment':'SYNTHETIC_28D','_synthetic':True})
    def adopt_capture(self,raw,files,receipt,episode):
        """Adopt a verified, workspace-owned staging directory without copying it twice."""
        ident=hashlib.sha256(('capture:'+receipt['id']).encode()).hexdigest()[:32]
        with self.lock:
            existing=next((a for a in self.store.all('asset') if a['id']==ident),None)
            if existing:
                if existing.get('capture_receipt_id')!=receipt['id']:raise ValueError('采集资产 ID 冲突')
                shutil.rmtree(raw,ignore_errors=True);return existing
            raw=Path(raw).resolve()
            expected=self.workspace/'capture'/'incoming'/receipt['id']/'raw'
            if raw!=expected or not raw.is_dir() or is_link(raw):raise ValueError('采集暂存目录不受工作台管理')
            metadata=episode['metadata'];base=self.workspace/'assets'/ident
            base.mkdir(parents=True,exist_ok=True)
            destination=base/'raw'
            if destination.exists():
                # A crash after the move but before catalog registration can be resumed.
                for item in files:
                    if file_hash(within(destination,item['path'],exists=True))!=item['sha256']:
                        raise ValueError('上次未完成登记的采集快照不匹配')
                shutil.rmtree(raw)
            else:raw.replace(destination)
            write_json(base/'manifest.json',{'format':'robot_pipeline.asset_snapshot.v1','files':files,'bytes':sum(f['bytes'] for f in files)})
            info=inspect_directory(destination)
            synthetic=bool(metadata.get('synthetic') or info.get('synthetic_declared'))
            kind='self_capture' if receipt['mode']=='real' else 'simulation'
            name=('合成采集样例' if synthetic else '真机采集' if kind=='self_capture' else '仿真采集')+' · '+receipt['id'][:8]
            asset={'id':ident,'name':name,'source_kind':kind,'source_reference':'capture:'+receipt['session_id']+':'+episode['id'],
                'task':metadata['task'],'tags':['采集自动入库']+(['合成','仅流程验证'] if synthetic else []),
                'license':'CC0-1.0 (generated synthetic sample)' if synthetic else 'unknown',
                'embodiment':'SYNTHETIC_28D' if synthetic else 'Unitree_G1_Dex3',
                'path':f'assets/{ident}/raw','manifest_path':f'assets/{ident}/manifest.json',
                'manifest_sha256':file_hash(base/'manifest.json'),'created_at':now(),'bytes':sum(f['bytes'] for f in files),
                'file_count':len(files),'quality':None,'training_ready':False,'synthetic':synthetic,
                'capture_receipt_id':receipt['id'],'capture_session_id':receipt['session_id'],**info}
            return self.store.put('asset',asset)

    def enqueue_capture_check(self,asset,receipt_id):
        ident=hashlib.sha256(('capture-check:'+receipt_id).encode()).hexdigest()[:32]
        with self.lock:
            old=next((j for j in self.store.all('job') if j['id']==ident),None)
            if old:return old
            directory=self.workspace/'jobs'/ident;directory.mkdir(parents=True,exist_ok=True)
            write_json(directory/'input.json',{'asset':asset,'stage':'check','project':self.store.get('project','current')})
            job={'id':ident,'asset_id':asset['id'],'stage':'check','status':'queued','created_at':now(),
                 'error':None,'result':None,'capture_receipt_id':receipt_id}
            self.store.put('job',job);self.event.set();return job
    def submit(self,payload):
        stage=payload.get('stage')
        if stage not in {'check','export','check_export'}:raise ValueError('当前仅接入质检和 JSONL 导出阶段')
        asset=self.store.get('asset',payload.get('asset_id',''))
        if stage=='export' and not (asset.get('quality') or {}).get('valid'):raise ValueError('请先通过该数据快照的结构质检')
        with self.lock:
            if self.closed:raise ValueError('工作台正在关闭')
            if any(j['status'] in {'queued','running','cancelling'} for j in self.store.all('job')):raise ValueError('首版仅允许一个阶段作业，请等待完成或取消')
            ident=identity();directory=self.workspace/'jobs'/ident;directory.mkdir(parents=True)
            write_json(directory/'input.json',{'asset':asset,'stage':stage,'project':self.store.get('project','current')})
            job={'id':ident,'asset_id':asset['id'],'stage':stage,'status':'queued','created_at':now(),'error':None,'result':None}
            self.store.put('job',job);self.event.set();return job
    def detail(self,ident):
        job=self.store.get('job',ident);p=within(self.workspace,f'jobs/{ident}/run.log')
        log=p.read_text(encoding='utf-8',errors='replace')[-100000:] if p.exists() else ''
        snapshot=within(self.workspace,f'jobs/{ident}/input.json')
        return {'job':job,'log':log,'result':job.get('result'),'input':read_json(snapshot) if snapshot.exists() else None}
    def build_dataset(self,ident):
        dataset=self.preparation.dataset(ident)
        if dataset['status']!='confirmed' or fingerprint(dataset.get('manifest'))!=dataset.get('manifest_sha256'):
            raise ValueError('请先确认当前训练数据版本，再构建数据包')
        with self.lock:
            if self.closed:raise ValueError('工作台正在关闭')
            for job in self.store.all('job'):
                if job.get('dataset_id')==ident and job['status'] in {'queued','running','cancelling'}:
                    return job
            jid=identity();directory=self.workspace/'jobs'/jid;directory.mkdir(parents=True)
            write_json(directory/'input.json',{'dataset':dataset,'stage':'prepare','project':self.store.get('project','current')})
            job={'id':jid,'dataset_id':ident,'dataset_name':dataset['name'],'stage':'prepare','status':'queued','created_at':now(),'error':None,'result':None}
            self.store.put('job',job);self.event.set();return job
    def cancel(self,ident):
        with self.lock:
            job=self.store.get('job',ident)
            if job['status'] not in {'queued','running','cancelling'}:return job
            self.cancelled.add(ident)
            if job['status']=='queued':job.update(status='cancelled',finished_at=now())
            else:job['status']='cancelling'
            self.store.put('job',job)
            if self.active_id==ident and self.process is not None:self._stop_process(self.process)
            return job
    def _stop_process(self,process):
        if process.poll() is not None:return
        # Worker has no child processes. Stop only this workbench's direct child.
        try:process.terminate()
        except ProcessLookupError:pass
        try:process.wait(timeout=3)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=3)
    def _loop(self):
        while not self.closed:
            self.event.wait(.25);self.event.clear()
            with self.lock:
                if self.closed:break
                if self.capture_manager.priority:continue
                queued=[j for j in self.store.all('job') if j['status']=='queued']
                if not queued:continue
                job=queued[-1];ident=job['id'];self.active_id=ident
                job.update(status='running',started_at=now());self.store.put('job',job)
            self._run_job(job)
    def _run_job(self,job):
        ident=job['id'];directory=self.workspace/'jobs'/ident
        handle=None;process=None;code=None;failure=None
        try:
            env=os.environ.copy()
            for k in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','VECLIB_MAXIMUM_THREADS','MKL_NUM_THREADS'):env[k]='1'
            env.update(PYTHONIOENCODING='utf-8',PYTHONUTF8='1')
            package_root=str(Path(__file__).resolve().parents[2])
            env['PYTHONPATH']=package_root+(os.pathsep+env['PYTHONPATH'] if env.get('PYTHONPATH') else '')
            with self.lock:
                if self.closed or ident in self.cancelled:raise ValueError('作业已取消')
                handle=(directory/'run.log').open('wb')
                process=subprocess.Popen([sys.executable,'-m','robot_pipeline.workbench.worker','--workspace',str(self.workspace),'--job-id',ident],cwd=directory,env=env,stdin=subprocess.DEVNULL,stdout=handle,stderr=subprocess.STDOUT,shell=False)
                self.process=process
            try:code=process.wait(timeout=300)
            except subprocess.TimeoutExpired:
                self._stop_process(process);failure='阶段超过 300 秒上限，已停止本次子进程'
        except Exception as exc:
            failure='阶段执行失败：'+str(exc)
            if process is not None:self._stop_process(process)
        finally:
            if handle is not None:handle.close()
        with self.lock:
            job=self.store.get('job',ident)
            if ident in self.cancelled or self.closed:
                job.update(status='cancelled',finished_at=now(),error='用户取消；未将部分产物标记为成功')
            else:
                result=None
                if failure is None:
                    try:
                        result_path=directory/'result.json'
                        if result_path.exists():
                            result=read_json(result_path)
                            if not isinstance(result,dict) or not isinstance(result.get('artifacts'),list):raise ValueError('结果不是有效的阶段报告')
                            result['artifacts']=[{'name':safe_relative(x),'url':f'/api/artifacts/{ident}/{x}'} for x in result['artifacts']]
                            for artifact in result['artifacts']:within(directory,artifact['name'],exists=True)
                            quality=result.get('quality')
                            if quality is not None:
                                if not isinstance(quality,dict) or not isinstance(quality.get('valid'),bool):raise ValueError('质检报告字段无效')
                                asset=self.store.get('asset',job['asset_id']);asset['quality']=quality;self.store.put('asset',asset)
                        elif code==0:raise ValueError('子进程结束但未生成阶段报告')
                    except Exception as exc:failure='无法读取阶段结果：'+str(exc);result=None
                job.update(status='succeeded' if code==0 and failure is None else 'failed',finished_at=now(),result=result,error=failure or (None if code==0 else '阶段未通过，请查看检查结果和日志'))
            self.store.put('job',job);self.process=None;self.active_id=None;self.cancelled.discard(ident)
    def close(self):
        with self.lock:
            self.closed=True;self.event.set()
            if self.process is not None:self._stop_process(self.process)
            for job in self.store.all('job'):
                if job['status']=='queued':job.update(status='cancelled',finished_at=now(),error='工作台关闭');self.store.put('job',job)
        self.thread.join(timeout=5)
        self.capture_manager.close()
        self.workspace_lock.close()
