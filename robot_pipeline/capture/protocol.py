"""Bounded, correlated JSON RPC over local pipes or authenticated OpenSSH."""
from __future__ import annotations
import json
import os
from pathlib import Path
import queue
import re
import shlex
import subprocess
import threading
import uuid

MAX_LINE = 2 * 1024 * 1024

def ssh_command(alias, python, args):
    if not isinstance(alias, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,120}', alias):
        raise ValueError('SSH 必须使用已配置的主机别名，不填密码、选项或 shell')
    if not isinstance(python, str) or not python or any(c in python for c in '\r\n\x00'):
        raise ValueError('执行机 Python 路径无效')
    return ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', alias,
            shlex.join([python, '-u', *args])]

class Peer:
    def __init__(self, argv, *, cwd=None, env=None, log_path=None):
        self.log = Path(log_path).open('ab') if log_path else subprocess.DEVNULL
        self.process = subprocess.Popen(argv, cwd=cwd, env=env, stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=self.log, shell=False)
        self.pending = {}; self.lock = threading.Lock(); self.write_lock = threading.Lock()
        self.dead = False
        self.thread = threading.Thread(target=self._read, daemon=True); self.thread.start()

    def _read(self):
        try:
            while True:
                line = self.process.stdout.readline(MAX_LINE + 1)
                if not line: break
                if len(line) > MAX_LINE: raise ValueError('采集协议消息超出上限')
                message = json.loads(line.decode('utf-8'))
                with self.lock: waiter = self.pending.pop(message.get('id'), None)
                if waiter: waiter.put(message)
        except Exception:
            pass
        finally:
            self.dead = True
            with self.lock:
                for waiter in self.pending.values(): waiter.put({'error': '采集连接已断开，状态需重新核对'})
                self.pending.clear()

    def call(self, action, payload=None, timeout=10, request_id=None):
        ident = request_id or uuid.uuid4().hex
        if self.dead: raise ConnectionError('采集执行器未连接')
        waiter = queue.Queue(maxsize=1)
        with self.lock: self.pending[ident] = waiter
        try:
            raw = (json.dumps({'id':ident, 'action':action, 'payload':payload or {}}, ensure_ascii=False,
                              allow_nan=False) + '\n').encode('utf-8')
            if len(raw) > MAX_LINE: raise ValueError('请求超出上限')
            with self.write_lock:
                self.process.stdin.write(raw); self.process.stdin.flush()
            try: result = waiter.get(timeout=timeout)
            except queue.Empty: raise TimeoutError('采集端响应超时；先刷新核对实际状态，不要重复切换录制') from None
            if result.get('error'): raise ValueError(result['error'])
            return result.get('result')
        finally:
            with self.lock: self.pending.pop(ident, None)

    def close(self):
        try: self.process.stdin.close()
        except OSError: pass
        try: self.process.wait(timeout=60)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            try: self.process.wait(timeout=3)
            except subprocess.TimeoutExpired: self.process.kill(); self.process.wait(timeout=3)
        for handle in (self.process.stdout,):
            try: handle.close()
            except OSError: pass
        if self.log != subprocess.DEVNULL: self.log.close()

def serve(handler):
    import sys
    output = sys.stdout.buffer
    cache = {}
    try:
        while True:
            line = sys.stdin.buffer.readline(MAX_LINE + 1)
            if not line: break
            message = {}; result = {}
            try:
                if len(line) > MAX_LINE: raise ValueError('协议请求超出上限')
                message = json.loads(line.decode('utf-8'))
                ident = message.get('id')
                if not isinstance(ident, str) or not re.fullmatch(r'[a-f0-9]{32}', ident):
                    raise ValueError('请求 ID 无效')
                signature = json.dumps([message.get('action'), message.get('payload')], sort_keys=True)
                if ident in cache:
                    old_signature, result = cache[ident]
                    if old_signature != signature: raise ValueError('重复请求 ID 的内容不同')
                else:
                    result = {'id':ident, 'result':handler.dispatch(message['action'], message.get('payload', {}))}
                    cache[ident] = (signature, result)
                    if len(cache) > 128: cache.pop(next(iter(cache)))
            except Exception as exc: result = {'id':message.get('id'), 'error':str(exc)}
            raw = (json.dumps(result, ensure_ascii=False, allow_nan=False)+'\n').encode('utf-8')
            if len(raw) > MAX_LINE:
                raw = (json.dumps({'id':message.get('id'),'error':'响应超出上限'})+'\n').encode()
            output.write(raw); output.flush()
    finally: handler.close()
