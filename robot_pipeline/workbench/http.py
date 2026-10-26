"""Loopback HTTP UI with explicit write token and no executable API."""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import re
from urllib.parse import unquote,urlsplit
from .paths import within
from .service import Workbench
from .native_picker import NativeDirectoryPicker, NativePickerBusy, NativePickerUnavailable
from . import __version__

class Server(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,workspace,port=8765,directory_picker=None):
        self.directory_picker=directory_picker or NativeDirectoryPicker()
        self.workbench=Workbench(workspace)
        self.app=self.workbench
        try:super().__init__(('127.0.0.1',port),Handler)
        except BaseException:self.workbench.close();self.directory_picker.close();raise
    def server_close(self):
        self.directory_picker.close();self.workbench.close();super().server_close()

class Handler(BaseHTTPRequestHandler):
    server_version='RobotPipeline/0.1'
    def log_message(self,format,*args): pass
    def _allowed(self,write=False):
        hosts={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        host=self.headers.get('Host','')
        if host not in hosts:raise PermissionError('仅接受本机工作台 Host')
        origin=self.headers.get('Origin')
        if origin and origin not in {f'http://{x}' for x in hosts}:raise PermissionError('拒绝跨站请求')
        # Opening the public static entry from a link is a normal navigation.
        # User data and operation tokens remain unavailable to cross-site requests.
        route=unquote(urlsplit(self.path).path)
        if self.headers.get('Sec-Fetch-Site')=='cross-site' and (write or route.startswith('/api/')):
            raise PermissionError('拒绝跨站请求')
        if write:
            import secrets
            token=self.headers.get('X-Workbench-Token','')
            if not secrets.compare_digest(token,self.server.workbench.csrf_token):raise PermissionError('缺少有效的工作台操作令牌')
    def _send(self,code,payload,content_type='application/json; charset=utf-8',filename=None):
        data=json.dumps(payload,ensure_ascii=False,allow_nan=False).encode('utf-8') if content_type.startswith('application/json') else payload
        self.send_response(code);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        if filename:self.send_header('Content-Disposition','attachment; filename="'+filename+'"')
        self.end_headers();self.wfile.write(data)
    def _error(self,exc):
        code=403 if isinstance(exc,PermissionError) else 409 if isinstance(exc,NativePickerBusy) else 503 if isinstance(exc,NativePickerUnavailable) else 400
        self._send(code,{'error':str(exc)})
    def do_GET(self):
        try:
            self._allowed();app=self.server.workbench
            path=unquote(urlsplit(self.path).path)
            if path=='/api/health':return self._send(200,{'status':'ok','version':__version__})
            if path=='/api/state':return self._send(200,app.state())
            if re.fullmatch('/api/jobs/[a-f0-9]{32}',path):return self._send(200,app.detail(path.rsplit('/',1)[-1]))
            if path.startswith('/api/artifacts/'):
                parts=path.split('/',4)
                if len(parts)!=5 or not re.fullmatch('[a-f0-9]{32}',parts[3]):raise ValueError('无效产物路径')
                job=app.store.get('job',parts[3])
                allowed={x['url'] for x in (job.get('result') or {}).get('artifacts',[])}
                if job['status'] not in {'succeeded','failed'} or path not in allowed:raise ValueError('该产物不可用')
                p=within(app.workspace,f'jobs/{parts[3]}/{parts[4]}',exists=True)
                return self._send(200,p.read_bytes(),'application/octet-stream',p.name)
            if path.startswith('/api/'):return self._send(404,{'error':'接口不存在'})
            static=Path(__file__).with_name('static')
            relative='index.html' if path=='/' else path.removeprefix('/')
            p=within(static,relative,exists=True)
            # Windows registry file associations must not change executable UI types.
            mime={'.html':'text/html','.css':'text/css','.js':'text/javascript'}.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
            return self._send(200,p.read_bytes(),mime+('; charset=utf-8' if mime.startswith(('text/','application/javascript')) else ''))
        except (ValueError,OSError,TypeError,PermissionError) as exc:self._error(exc)
    def do_POST(self):
        try:
            self._allowed(write=True);app=self.server.workbench
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ValueError('需要 application/json')
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=1024*1024:raise ValueError('请求体大小不合法')
            payload=json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(payload,dict):raise ValueError('请求体必须是 JSON 对象')
            path=urlsplit(self.path).path
            if path=='/api/paths/pick':result=self.server.directory_picker.choose(payload.get('initial_path'))
            elif path=='/api/project':result=app.project(payload)
            elif path=='/api/assets/import':result=app.import_asset(payload)
            elif path=='/api/demo':result=app.demo()
            elif path=='/api/jobs':result=app.submit(payload)
            elif re.fullmatch('/api/jobs/[a-f0-9]{32}/cancel',path):result=app.cancel(path.split('/')[3])
            else:return self._send(404,{'error':'接口不存在'})
            return self._send(200,result)
        except (ValueError,OSError,TypeError,KeyError,PermissionError) as exc:self._error(exc)

def create_server(workspace,port=0,*,directory_picker=None):return Server(workspace,port,directory_picker)
