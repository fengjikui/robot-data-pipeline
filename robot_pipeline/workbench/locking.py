"""A workspace has one owning server; OS releases the lock after a crash."""
from pathlib import Path
import os

class WorkspaceLock:
    def __init__(self,workspace: Path):
        workspace.mkdir(parents=True,exist_ok=True)
        self.file=(workspace/'workbench.lock').open('a+b')
        self.file.seek(0,2)
        if self.file.tell()==0:self.file.write(b'0');self.file.flush()
        self.file.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.file.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.file.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.file.close();raise ValueError('此工作目录已有工作台运行，请复用该窗口或选择其他目录')
    def close(self):
        if self.file.closed:return
        self.file.seek(0)
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(self.file.fileno(),msvcrt.LK_UNLCK,1)
        else:
            import fcntl
            fcntl.flock(self.file.fileno(),fcntl.LOCK_UN)
        self.file.close()
