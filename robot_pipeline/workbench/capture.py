"""Workbench capture orchestration, auto-ingest and persistent per-episode receipts."""
from __future__ import annotations
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import queue
import shutil
import sys
import threading
import time
import uuid
import zipfile
from robot_pipeline.capture.protocol import Peer, ssh_command
from robot_pipeline.capture.profile import synthetic_profile
from .paths import file_hash, safe_relative, is_link, write_json
from .store import identity, now

ACTIVE={'starting','ready','following','recording','saving','stopping','unknown'}

class CaptureManager:
    def __init__(self,app):
        self.app=app;self.store=app.store;self.workspace=app.workspace
        self.lock=threading.RLock();self.peer=None;self.mode='real';self.closed=False
        self.runtime={'state':'disconnected','completed':[],'services':[]};self.last_error=None
        self.commands=queue.Queue();self.busy=None;self.pending_ingest=queue.Queue();self.scheduled=set()
        for operation in self.store.all('capture_operation'):
            if operation['status'] in ('queued','running'):
                operation.update(status='unknown',error='工作台重启；请连接执行器核对实际状态');self.store.put('capture_operation',operation)
        for receipt in self.store.all('capture_episode'):
            if receipt['status'] in ('packaging','transferring','registering','registered'):
                receipt.update(status='failed',error='上次接收中断；源回合保留，连接执行器后可重试接收');self.store.put('capture_episode',receipt)
        self.thread=threading.Thread(target=self._loop,name='capture-control',daemon=True)
        self.ingest_thread=threading.Thread(target=self._ingest_loop,name='capture-ingest',daemon=True)
        self.thread.start();self.ingest_thread.start()

    @property
    def priority(self):
        return self.runtime.get('state') in ('recording','saving','starting','stopping','unknown') or self.busy in ('record_start','record_stop','start_services','prepare')

    def snapshot(self):
        with self.lock:
            episodes=[]
            jobs={j['id']:j for j in self.store.all('job')}
            for item in self.store.all('capture_episode')[:50]:
                value=dict(item);job=jobs.get(item.get('quality_job_id'))
                if job:value.update(quality_status=job['status'],quality_valid=(job.get('result') or {}).get('quality',{}).get('valid'))
                if item.get('asset_id'):
                    eid=hashlib.sha256((item['asset_id']+'/data.json').encode()).hexdigest()[:32]
                    value.update(data_episode_id=eid,annotation=self.app.preparation._annotation(eid))
                episodes.append(value)
            runtime={k:v for k,v in self.runtime.items() if k!='completed'}
            return {'mode':self.mode,'connected':bool(self.peer and not self.peer.dead and self.runtime.get('profile')),'runtime':runtime,
                    'connections':{v['id']:v for v in self.store.all('capture_connection')},
                    'trial_previous_available':{v['id']:True for v in self.store.all('capture_connection_backup')},
                    'episodes':episodes,'busy':self.busy,'last_error':self.last_error,
                    'connection_log':self._connection_log(),
                    'operations':self.store.all('capture_operation')[:8]}

    def _connection_log(self):
        path=self.workspace/'capture'/'agent.log'
        if not path.exists():return ''
        with path.open('rb') as handle:
            handle.seek(0,2);handle.seek(max(0,handle.tell()-8000))
            return handle.read().decode('utf-8',errors='replace')

    def save(self,payload):
        if self.busy:raise ValueError('采集操作正在处理，请等待后修改连接')
        mode=payload.get('mode')
        if mode not in ('real','simulation'):raise ValueError('请选择真机或仿真')
        if self.peer and (self.runtime.get('state') in ACTIVE or any(s.get('running') for s in self.runtime.get('services',[]))):
            raise ValueError('会话进行中，先结束采集服务再修改连接配置')
        allowed={'mode','transport','ssh_alias','agent_python','profile_directory'}
        if set(payload)-allowed:raise ValueError('采集连接包含未知字段')
        for k,v in payload.items():
            if not isinstance(v,str) or len(v)>2000 or any(c in v for c in '\0\r\n'):raise ValueError('采集连接字段无效：'+k)
        if payload.get('transport') not in ('local','ssh'):raise ValueError('执行位置不支持')
        if not payload.get('agent_python') or not payload.get('profile_directory'):raise ValueError('需要执行机 Python 和配置目录')
        if payload['transport']=='ssh':
            ssh_command(payload.get('ssh_alias'),payload['agent_python'],[])
            if not PurePosixPath(payload['profile_directory']).is_absolute():raise ValueError('SSH 采集配置使用 Linux 执行机绝对路径')
        elif not Path(payload['profile_directory']).is_absolute():raise ValueError('本地配置目录需为绝对路径')
        value=dict(payload)
        if value['transport']=='local' and Path(value['agent_python']).is_dir():
            directory=Path(value['agent_python'])
            executable=directory/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
            if not executable.is_file():raise ValueError('所选环境目录没有 Python 解释器，请选择正确环境或填写解释器完整路径')
            value['agent_python']=str(executable)
        if self.peer and self.mode==mode:
            peer=self.peer;self.peer=None;self.runtime={'state':'disconnected','completed':[],'services':[]};peer.close()
        return self.store.put('capture_connection',{'id':mode,**value,'updated_at':now()})

    def trial(self,mode):
        if mode not in ('real','simulation'):raise ValueError('模式无效')
        if self.peer and self.runtime.get('state') in ACTIVE:raise ValueError('先结束当前会话，再切换到合成试运行')
        root=self.workspace/'capture'/'trial-profiles'/mode
        synthetic_profile(root,mode)
        old=next((c for c in self.store.all('capture_connection') if c['id']==mode),None)
        if old and old.get('profile_directory')!=str(root):self.store.put('capture_connection_backup',old)
        value=self.save({'mode':mode,'transport':'local','ssh_alias':'','agent_python':sys.executable,'profile_directory':str(root)})
        value['synthetic_trial']=True;self.store.put('capture_connection',value);return value

    def restore(self,mode):
        old=self.store.get('capture_connection_backup',mode)
        return self.save({k:old[k] for k in ('mode','transport','ssh_alias','agent_python','profile_directory')})

    def submit(self,payload):
        action=payload.get('action');mode=payload.get('mode')
        if action not in ('connect','prepare','start_services','follow','record_start','record_stop','stop_services','cleanup','retry_ingest','retry_quality'):
            raise ValueError('采集操作不支持')
        if mode not in ('real','simulation'):raise ValueError('请选择真机或仿真')
        ident=payload.get('request_id') or identity()
        if not isinstance(ident,str) or len(ident)!=32 or any(c not in '0123456789abcdef' for c in ident):raise ValueError('操作 ID 无效')
        signature=json.dumps([action,mode,bool(payload.get('operator_ready')),payload.get('episode_id')],sort_keys=True)
        with self.lock:
            old=next((o for o in self.store.all('capture_operation') if o['id']==ident),None)
            if old:
                if old['signature']!=signature:raise ValueError('重复操作 ID 内容不同')
                return old
            if self.busy:raise ValueError('上一项采集操作正在处理，请等待真实状态')
            self.busy=action
            value={'id':ident,'action':action,'mode':mode,'signature':signature,'status':'queued','created_at':now()}
            self.store.put('capture_operation',value);self.commands.put((value,payload))
            return value

    def _connect(self,mode):
        if self.peer:
            state=self.runtime.get('state')
            if not self.peer.dead and self.mode==mode:return self.peer.call('preflight',{'mode':mode})
            if not self.peer.dead and state in ACTIVE:raise ValueError('请先结束另一模式的采集会话')
            self.peer.close();self.peer=None
        config=self.store.get('capture_connection',mode)
        args=['-m','robot_pipeline.capture.agent','--profile-directory',config['profile_directory']]
        argv=ssh_command(config['ssh_alias'],config['agent_python'],args) if config['transport']=='ssh' else [config['agent_python'],'-u',*args]
        env=os.environ.copy();root=str(Path(__file__).resolve().parents[2])
        env['PYTHONPATH']=root+(os.pathsep+env['PYTHONPATH'] if env.get('PYTHONPATH') else '')
        log=self.workspace/'capture'/'agent.log';log.parent.mkdir(exist_ok=True)
        self.runtime={'state':'connecting','services':[],'completed':[]}
        self.peer=Peer(argv,env=env,log_path=log)
        try:result=self.peer.call('preflight',{'mode':mode},timeout=12)
        except BaseException:
            self.peer.close();self.peer=None;raise
        self.mode=mode;self.runtime=self.peer.call('status')
        offset=0
        while True:
            page=self.peer.call('completed_page',{'offset':offset})
            self._discover(page['episodes'])
            if not page['more']:break
            offset+=len(page['episodes'])
        return result

    def _loop(self):
        while not self.closed:
            try:value,payload=self.commands.get(timeout=.4)
            except queue.Empty:value=payload=None
            if value:
                value.update(status='running');self.store.put('capture_operation',value)
                try:
                    action=value['action'];mode=value['mode']
                    if action=='connect':result=self._connect(mode)
                    elif action=='prepare':
                        self._connect(mode)
                        project=self.store.get('project','current')
                        result=self.peer.call('start_services',{'operator_ready':bool(payload.get('operator_ready')),
                            'task':project['task'],'target':project['target'],'description':'由工作台准备采集'},request_id=value['id'])
                    elif action=='retry_ingest':
                        receipt=self.store.get('capture_episode',payload['episode_id'])
                        if receipt['mode']!=mode or not self.peer or self.peer.dead or self.mode!=mode:
                            raise ValueError('请先连接这个回合对应的真机或仿真配置，再重试接收')
                        if receipt.get('status')!='failed':raise ValueError('只有失败的回合接收需要重试')
                        episode=self.peer.call('episode',{'episode_id':receipt['episode_id']})
                        self.peer.call('archive',{'episode_id':receipt['episode_id'],'retry':True})
                        receipt.update(status='waiting',error=None);self.store.put('capture_episode',receipt)
                        self.scheduled.add(receipt['id']);self.pending_ingest.put((receipt['id'],episode));result={'accepted':True}
                    elif action=='retry_quality':
                        receipt=self.store.get('capture_episode',payload['episode_id'])
                        if not receipt.get('asset_id'):raise ValueError('回合尚未入库')
                        old=self.store.get('job',receipt['quality_job_id'])
                        if old['status'] not in ('failed','cancelled','interrupted'):raise ValueError('此质检不需要重试')
                        job=self.app.submit({'asset_id':receipt['asset_id'],'stage':'check'})
                        job['capture_receipt_id']=receipt['id'];self.store.put('job',job)
                        receipt['quality_job_id']=job['id'];self.store.put('capture_episode',receipt);result={'accepted':True}
                    else:
                        if not self.peer or self.peer.dead or self.mode!=mode:raise ValueError('请先连接此模式的采集执行器')
                        options={'operator_ready':bool(payload.get('operator_ready'))}
                        if action=='start_services':
                            project=self.store.get('project','current')
                            options.update(task=project['task'],target=project['target'],description='由数据管线工作台启动的采集会话')
                        result=self.peer.call(action,options,timeout=8,request_id=value['id'])
                    value.update(status='accepted',result=result,error=None);self.last_error=None
                except Exception as exc:
                    value.update(status='unknown' if isinstance(exc,(TimeoutError,ConnectionError)) else 'failed',error=str(exc))
                    self.last_error=str(exc)
                finally:self.store.put('capture_operation',value);self.busy=None
            peer=self.peer
            if peer:
                try:
                    runtime=peer.call('status',timeout=5)
                    if self.peer is peer:
                        self.runtime=runtime;self._discover(runtime.get('completed',[]));self._reconcile_operations(runtime)
                except Exception as exc:
                    if self.peer is peer:self.runtime={**self.runtime,'state':'unknown','error':str(exc)}
            if value:self.commands.task_done()

    def _reconcile_operations(self,runtime):
        state=runtime.get('state')
        for operation in self.store.all('capture_operation')[:8]:
            if operation['status']!='unknown' or operation['mode']!=self.mode:continue
            action=operation['action']
            observed=(action=='record_start' and state=='recording') or (action=='record_stop' and state in ('saving','following')) or (action=='follow' and state in ('following','recording'))
            if observed:
                operation.update(status='observed',result={'actual_state':state,'reconciled':True},error=None)
                self.store.put('capture_operation',operation);self.last_error=None

    def _discover(self,completed):
        for episode in completed:
            metadata=episode['metadata'];ident=hashlib.sha256((metadata['session_id']+':'+episode['id']).encode()).hexdigest()[:32]
            existing=next((r for r in self.store.all('capture_episode') if r['id']==ident),None)
            if not existing:
                existing={'id':ident,'episode_id':episode['id'],'session_id':metadata['session_id'],'mode':metadata['mode'],
                    'synthetic':bool(metadata.get('synthetic')),'task':metadata['task'],'frames':episode['frames'],
                    'status':'waiting','created_at':now(),'error':None,'asset_id':None,'quality_job_id':None}
                self.store.put('capture_episode',existing)
            if existing['status']=='waiting' and ident not in self.scheduled:
                self.scheduled.add(ident);self.pending_ingest.put((ident,episode))

    def _wait_priority(self):
        while self.priority and not self.closed:time.sleep(.15)
        if self.closed:raise ValueError('工作台正在关闭；已完成的源回合保留，可重连后继续接收')

    def _ingest_loop(self):
        while not self.closed:
            try:ident,episode=self.pending_ingest.get(timeout=.3)
            except queue.Empty:continue
            receipt=self.store.get('capture_episode',ident)
            try:
                self._wait_priority()
                if not self.peer or self.peer.dead:raise ValueError('采集连接已断开，请重连后重试接收')
                peer=self.peer
                receipt.update(status='packaging');self.store.put('capture_episode',receipt)
                deadline=time.monotonic()+900
                while True:
                    self._wait_priority();archive=peer.call('archive',{'episode_id':episode['id']})
                    if archive['state']=='ready':break
                    if archive['state']=='failed':raise ValueError(archive.get('error','采集端打包失败'))
                    if time.monotonic()>deadline:raise ValueError('回合归档超时')
                    time.sleep(.25)
                size=archive['bytes']
                if not isinstance(size,int) or not 0<size<=4*1024**3+32*1024**2:raise ValueError('接收包大小超过上限')
                if shutil.disk_usage(self.workspace).free<size*2+64*1024**2:raise ValueError('工作区空间不足以接收和展开此回合')
                directory=self.workspace/'capture'/'incoming'/ident;directory.mkdir(parents=True,exist_ok=True)
                target=directory/'episode.zip'
                receipt.update(status='transferring',bytes_total=size,bytes_received=0);self.store.put('capture_episode',receipt)
                with target.open('wb') as handle:
                    offset=0
                    while offset<size:
                        self._wait_priority();part=peer.call('read_archive',{'episode_id':episode['id'],'offset':offset})
                        data=base64.b64decode(part['data'],validate=True)
                        if part['offset']!=offset or not data or offset+len(data)>size:raise ValueError('采集传输区间不匹配')
                        handle.write(data);offset+=len(data)
                        receipt['bytes_received']=offset;self.store.put('capture_episode',receipt)
                if file_hash(target)!=archive['sha256']:raise ValueError('回合传输校验失败')
                self._wait_priority();receipt['status']='registering';self.store.put('capture_episode',receipt)
                raw=directory/'raw'
                if raw.exists():shutil.rmtree(raw)
                raw.mkdir()
                with zipfile.ZipFile(target) as package:
                    members=package.infolist();names=[m.filename for m in members]
                    if len(names)!=len(set(n.casefold() for n in names)):raise ValueError('接收包有重复或大小写冲突路径')
                    entry=package.getinfo('capture-manifest.json')
                    if entry.file_size>32*1024**2:raise ValueError('回合清单过大')
                    manifest=json.loads(package.read(entry).decode('utf-8'))
                    if manifest.get('format')!='robot_pipeline.capture.transfer.v1' or manifest['episode']['id']!=episode['id']:
                        raise ValueError('回合清单来源不匹配')
                    expected={safe_relative(f['path']):f for f in manifest['files']}
                    if set(names)!=set(expected)|{'capture-manifest.json'}:raise ValueError('回合文件清单不匹配')
                    total=0
                    for name,info in expected.items():
                        self._wait_priority();member=package.getinfo(name)
                        total+=member.file_size
                        if member.compress_type!=zipfile.ZIP_STORED or member.is_dir() or member.file_size!=info['bytes'] or total>4*1024**3:
                            raise ValueError('接收包文件大小或类型无效')
                        if name.endswith('.json') and member.file_size>20*1024**2:raise ValueError('单个回合 JSON 超过 20 MiB')
                        destination=raw/name
                        if os.name=='nt' and len(str(destination))>245:raise ValueError('Windows 工作区路径过长，请使用更短目录')
                        destination.parent.mkdir(parents=True,exist_ok=True)
                        with package.open(member) as source,destination.open('wb') as output:
                            shutil.copyfileobj(source,output,512*1024)
                        if file_hash(destination)!=info['sha256']:raise ValueError('回合文件校验失败：'+name)
                asset=self.app.adopt_capture(raw,manifest['files'],receipt,episode)
                receipt.update(status='registered',asset_id=asset['id']);self.store.put('capture_episode',receipt)
                job=self.app.enqueue_capture_check(asset,ident)
                receipt.update(status='queued',quality_job_id=job['id'],error=None);self.store.put('capture_episode',receipt)
                target.unlink(missing_ok=True)
            except Exception as exc:
                receipt.update(status='failed',error=str(exc));self.store.put('capture_episode',receipt)
            finally:self.scheduled.discard(ident);self.pending_ingest.task_done()

    def close(self):
        self.closed=True
        self.thread.join(timeout=15);self.ingest_thread.join(timeout=15)
        if self.peer:
            try:self.peer.call('stop_services',timeout=3)
            except Exception:pass
            self.peer.close();self.peer=None
