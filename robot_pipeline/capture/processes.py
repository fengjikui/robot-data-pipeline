"""Owned process groups; remote groups are managed by a pipe-bound SSH node."""
from __future__ import annotations
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
from .protocol import Peer, ssh_command

class Process:
    def __init__(self, argv, cwd=None, env=None, log=None):
        if log:self.log_path=Path(log)
        else:
            fd,name=tempfile.mkstemp(prefix='capture-log-');os.close(fd);self.log_path=Path(name)
        self.log_path.parent.mkdir(parents=True,exist_ok=True)
        self.log=self.log_path.open('ab')
        settings={'start_new_session':True} if os.name!='nt' else {'creationflags':subprocess.CREATE_NEW_PROCESS_GROUP}
        merged=os.environ.copy();merged.update(env or {})
        for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS'):merged[key]='1'
        merged.update(PYTHONUTF8='1',PYTHONIOENCODING='utf-8')
        try:self.p=subprocess.Popen(argv,cwd=cwd,env=merged,stdin=subprocess.DEVNULL,stdout=self.log,stderr=subprocess.STDOUT,shell=False,**settings)
        except BaseException:self.log.close();raise

    def status(self):
        with self.log_path.open('rb') as handle:
            handle.seek(0,2);size=handle.tell();handle.seek(max(0,size-12000))
            tail=handle.read().decode('utf-8',errors='replace')
        return {'pid':self.p.pid,'running':self.p.poll() is None,'exit_code':self.p.poll(),'log':tail}

    def close(self):
        if self.p.poll() is None:
            if os.name=='nt':self.p.terminate()
            else:
                try:os.killpg(self.p.pid,signal.SIGTERM)
                except ProcessLookupError:pass
            try:self.p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                if os.name=='nt':self.p.kill()
                else:
                    try:os.killpg(self.p.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                self.p.wait(timeout=5)
        self.log.close()

class RemoteProcess:
    def __init__(self, spec):
        self.peer=Peer(ssh_command(spec['ssh_alias'],spec.get('agent_python','python3'),['-m','robot_pipeline.capture.agent','--node']))
        try:self.peer.call('launch',{'argv':spec['argv'],'cwd':spec.get('cwd'),'env':spec.get('env',{})})
        except BaseException:self.peer.close();raise
    def status(self):return self.peer.call('status',timeout=1.5)
    def close(self):
        try:self.peer.call('stop',timeout=15)
        finally:self.peer.close()

class Node:
    def __init__(self):self.process=None
    def dispatch(self,action,payload):
        if action=='launch':
            if self.process:raise ValueError('该节点已经持有一个进程')
            argv=payload.get('argv')
            if not isinstance(argv,list) or not argv or any(not isinstance(x,str) for x in argv):raise ValueError('参数数组无效')
            self.process=Process(argv,payload.get('cwd'),payload.get('env'))
            return self.process.status()
        if action=='status':return self.process.status() if self.process else {'running':False}
        if action=='stop':self.close();return {'running':False}
        raise ValueError('节点操作不支持')
    def close(self):
        if self.process:self.process.close();self.process=None
