"""SQLite records: portable paths belong to this workspace, not the launching CWD."""
from __future__ import annotations
from datetime import datetime, timezone
import json
from contextlib import contextmanager
from pathlib import Path
import sqlite3
import threading
from uuid import uuid4


def now(): return datetime.now(timezone.utc).isoformat(timespec='milliseconds')
def identity(): return uuid4().hex

class Store:
    def __init__(self, workspace: Path):
        self.workspace=workspace.resolve();self.workspace.mkdir(parents=True,exist_ok=True)
        self.path=self.workspace/'catalog.sqlite3';self.lock=threading.RLock()
        with self.connection() as c:
            c.execute('CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(kind,id))')
            if not c.execute("SELECT 1 FROM records WHERE kind='project'").fetchone():
                self._put(c,'project',{'id':'current','task':'搬箱实验','target':'Unitree_G1_Dex3','policy':'act'})
            for (raw,) in c.execute("SELECT value FROM records WHERE kind='job'").fetchall():
                job=json.loads(raw)
                if job['status'] in {'running','queued','cancelling'}:
                    job.update(status='interrupted',finished_at=now(),error='上次服务中断；原始数据保留，请重新运行阶段')
                    self._put(c,'job',job)
    @contextmanager
    def connection(self):
        c=sqlite3.connect(self.path,timeout=10)
        try:
            with c: yield c
        finally: c.close()
    def _put(self,c,kind,value):
        c.execute('INSERT OR REPLACE INTO records(kind,id,value) VALUES (?,?,?)',(kind,value['id'],json.dumps(value,ensure_ascii=False,allow_nan=False)))
    def put(self,kind,value):
        with self.lock,self.connection() as c:self._put(c,kind,value)
        return value
    def get(self,kind,ident):
        if not isinstance(ident,str) or not ident or len(ident)>64:raise ValueError('无效记录标识')
        with self.lock,self.connection() as c:row=c.execute('SELECT value FROM records WHERE kind=? AND id=?',(kind,ident)).fetchone()
        if not row:raise ValueError(f'未找到 {kind}：{ident}')
        return json.loads(row[0])
    def all(self,kind):
        with self.lock,self.connection() as c:rows=c.execute('SELECT value FROM records WHERE kind=? ORDER BY rowid DESC',(kind,)).fetchall()
        return [json.loads(x[0]) for x in rows]
