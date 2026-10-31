"""Instrumented recorder lifecycle and loopback-only control endpoint on the Host."""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import threading
import time
import uuid
from robot_pipeline.workbench.paths import within, file_hash, is_link, safe_relative

def atomic_json(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.tmp-'+uuid.uuid4().hex)
    with temporary.open('w',encoding='utf-8') as handle:
        json.dump(value,handle,ensure_ascii=False,allow_nan=False);handle.flush();os.fsync(handle.fileno())
    os.replace(temporary,path)

class Control:
    def __init__(self, directory, metadata):
        self.directory=Path(directory);self.directory.mkdir(parents=True,exist_ok=True)
        self.metadata=metadata;self.lock=threading.RLock();self.on_press=None;self.get_state=None
        self.pending=None;self.active=None;self.error=None;self.exiting=False
        self.token=secrets.token_urlsafe(32)
        self.server=ThreadingHTTPServer(('127.0.0.1',0), self.handler())
        self.server.daemon_threads=True
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        atomic_json(self.directory/'bridge.json',{'port':self.server.server_port,'token':self.token})

    def handler(self):
        control=self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):self.respond(False)
            def do_POST(self):self.respond(True)
            def respond(self,write):
                result={};code=200
                try:
                    if not hmac.compare_digest(self.headers.get('X-Capture-Token',''),control.token):
                        raise PermissionError('采集桥认证失败')
                    if self.path!='/control':raise ValueError('接口不存在')
                    if write:
                        length=int(self.headers.get('Content-Length','0'))
                        if not 0<length<=16384:raise ValueError('请求大小无效')
                        payload=json.loads(self.rfile.read(length).decode('utf-8'))
                        result=control.action(payload['action'])
                    else:result=control.status()
                except Exception as exc:code=400;result={'error':str(exc)}
                raw=json.dumps(result,ensure_ascii=False).encode('utf-8')
                self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8')
                self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)))
                self.end_headers();self.wfile.write(raw)
        return Handler

    def bind(self,on_press,get_state):
        with self.lock:self.on_press=on_press;self.get_state=get_state

    def status(self):
        with self.lock:
            raw=dict(self.get_state() or {}) if self.get_state else {}
            ready=bool(raw.get('READY'));following=bool(raw.get('START'));recording=bool(raw.get('RECORD_RUNNING'))
            if self.pending:
                intent=self.pending['intent']
                achieved=(intent=='follow' and following) or (intent=='record_start' and recording) or (intent=='record_stop' and not recording)
                if achieved:self.pending=None
            unverified=bool(self.pending and time.time()-self.pending['sent_at']>10)
            if self.error:state='error'
            elif unverified:state='unknown'
            elif self.exiting or raw.get('STOP'):state='stopping'
            elif self.pending:state={'follow':'starting','record_start':'starting','record_stop':'saving'}[self.pending['intent']]
            elif recording:state='recording'
            elif self.active and self.active.get('saving'):state='saving'
            elif following and ready:state='following'
            elif ready:state='ready'
            else:state='starting'
            complete=[]
            for p in sorted(self.directory.glob('complete-*.json')):
                complete.append(json.loads(p.read_text(encoding='utf-8')))
            return {'state':state,'upstream':raw,'pending':self.pending,'active_episode':self.active,
                    'completed':complete,'error':self.error or ('操作尚未得到上游状态确认；未重复发送切换命令，请核对采集端' if unverified else None),'synthetic':bool(self.metadata.get('synthetic')),
                    'xr_freshness':'unverified','metadata':self.metadata}

    def action(self,action):
        with self.lock:
            status=self.status();raw=status['upstream']
            if action not in ('follow','record_start','record_stop','shutdown'):raise ValueError('采集操作不支持')
            if not self.on_press:raise ValueError('上游控制接口尚未就绪')
            if self.pending:
                if self.pending['intent']==action:return {'accepted':True,'pending':True}
                raise ValueError('上一项操作尚未核实，请先刷新状态')
            if action=='shutdown':
                if raw.get('RECORD_RUNNING') or self.active and self.active.get('saving'):
                    raise ValueError('请先停止录制并等待回合保存完成')
                if not self.exiting:self.exiting=True;self.on_press('q')
                return {'accepted':True}
            if action=='follow':
                if raw.get('START'):return {'accepted':True,'already':True}
                if not raw.get('READY'):raise ValueError('上游尚未准备好')
                key='r'
            elif action=='record_start':
                if raw.get('RECORD_RUNNING'):return {'accepted':True,'already':True}
                if not raw.get('START') or not raw.get('READY') or self.active and self.active.get('saving'):
                    raise ValueError('请先启用随动，且等待上一回合保存完成')
                key='s'
            else:
                if not raw.get('RECORD_RUNNING'):return {'accepted':True,'already':True}
                key='s'
            self.pending={'intent':action,'sent_at':time.time()}
            try:self.on_press(key)
            except BaseException:self.pending=None;raise
            return {'accepted':True,'pending':True}

    def created(self,episode_directory):
        with self.lock:
            ident=uuid.uuid4().hex
            self.error=None
            self.active={'id':ident,'path':str(Path(episode_directory).resolve()),'saving':False,'frames':0,'started_at':time.time()}

    def saving(self):
        with self.lock:
            if self.active:self.active['saving']=True

    def saved(self,episode_directory,errors=None):
        with self.lock:
            current=dict(self.active or {})
            if self.active:self.active['saving']=True
        try:
            if errors:raise ValueError('记录器写入失败：'+'；'.join(errors[:5]))
            root=Path(episode_directory).resolve()
            if (root/'data.json').stat().st_size>20*1024**2:raise ValueError('单回合 JSON 超过 20 MiB，请缩短回合；原始文件保留')
            raw=json.loads((root/'data.json').read_text(encoding='utf-8'))
            rows=raw.get('data')
            if not isinstance(rows,list) or not rows:raise ValueError('回合没有记录帧，未生成保存完成事件')
            for row in rows:
                if not row.get('colors'):raise ValueError('回合存在没有图像的记录帧')
                for relative in row['colors'].values():
                    image=within(root,relative,exists=True)
                    if image.stat().st_size==0:raise ValueError('回合图像为空：'+relative)
            files=[];total=0
            for directory,dirs,names in os.walk(root,followlinks=False):
                for name in dirs+names:
                    if is_link(Path(directory)/name):raise ValueError('回合包含链接')
                for name in sorted(names):
                    path=Path(directory)/name;size=path.stat().st_size;total+=size
                    if total>4*1024**3 or len(files)>=100000:raise ValueError('回合超过采集接收上限')
                    files.append({'path':safe_relative(path.relative_to(root).as_posix()),'bytes':size,'sha256':file_hash(path)})
            current.update(path=str(root),frames=len(rows),saved_at=time.time(),saving=False,
                           writer_complete=True,metadata=self.metadata)
            if not current.get('id'):raise ValueError('保存事件缺少本次回合创建记录')
            manifest=self.directory/('snapshot-'+current['id']+'.json')
            atomic_json(manifest,{'files':files})
            current.update(file_manifest=manifest.name,file_manifest_sha256=file_hash(manifest))
            atomic_json(self.directory/('complete-'+current['id']+'.json'),current)
            with self.lock:
                self.active=None
        except Exception as exc:
            with self.lock:
                self.error=str(exc)
                if self.active:self.active['saving']=False;self.active['save_error']=self.error
            atomic_json(self.directory/'last-error.json',{'error':self.error,'active':self.active})

    def close(self):
        self.server.shutdown();self.server.server_close();self.thread.join(timeout=2)

def instrument_writer(base,control):
    class Writer(base):
        def __init__(self,*args,**kwargs):
            super().__init__(*args,**kwargs)
            self._capture_epoch=None
            self.info['capture_timestamp_semantics']='host_enqueue_monotonic_elapsed_seconds; not sensor synchronization'
            original_put=self.item_data_queue.put
            def stamped_put(item,*a,**kw):
                if isinstance(item,dict):item.setdefault('timestamp',time.monotonic()-(self._capture_epoch or 0))
                return original_put(item,*a,**kw)
            self.item_data_queue.put=stamped_put
        def create_episode(self):
            success=super().create_episode()
            if success:self._capture_errors=[];self._capture_epoch=time.monotonic();control.created(self.episode_dir)
            return success
        def _process_item_data(self,item):
            try:
                result=super()._process_item_data(item)
                for relative in (item.get('colors') or {}).values():
                    if not isinstance(relative,str) or not within(Path(self.episode_dir),relative,exists=True).stat().st_size:
                        raise ValueError('图像写入失败')
                return result
            except Exception as exc:
                self._capture_errors.append(str(exc));raise
        def save_episode(self):
            control.saving();return super().save_episode()
        def _save_episode(self):
            try:result=super()._save_episode()
            except Exception as exc:
                control.saved(self.episode_dir,[str(exc)]);raise
            control.saved(self.episode_dir,getattr(self,'_capture_errors',[]))
            return result
    return Writer
