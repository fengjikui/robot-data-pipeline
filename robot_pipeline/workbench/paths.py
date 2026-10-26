"""Portable on-disk contracts. Never interpret a foreign absolute path as local."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import sys
import stat

def is_link(path: Path) -> bool:
    attributes=getattr(path.lstat(),'st_file_attributes',0)
    return path.is_symlink() or bool(attributes & getattr(stat,'FILE_ATTRIBUTE_REPARSE_POINT',1024))

WINDOWS_RESERVED = {'CON','PRN','AUX','NUL','CONIN$','CONOUT$',*(f'COM{i}' for i in range(1,10)),*(f'LPT{i}' for i in range(1,10))}

def safe_relative(value: str) -> str:
    if not isinstance(value,str) or not value or '\\' in value or '\x00' in value:
        raise ValueError('路径必须是非空的相对 POSIX 路径，不能含反斜杠')
    p=PurePosixPath(value)
    if p.is_absolute() or PureWindowsPath(value).drive:
        raise ValueError('不允许绝对路径或盘符')
    parts=value.split('/')
    for part in parts:
        if part in {'','.','..'} or any(c in part for c in '<>:"|?*') or any(ord(c)<32 for c in part):
            raise ValueError('路径包含不安全的目录或字符')
        if part.endswith((' ','.')) or part.split('.')[0].upper().translate(str.maketrans('¹²³','123')) in WINDOWS_RESERVED:
            raise ValueError('路径不兼容 Windows')
        if len(part)>180: raise ValueError('单级路径过长')
    return '/'.join(parts)

def within(root: Path, relative: str, *, exists=False) -> Path:
    relative=safe_relative(relative)
    root=root.resolve()
    p=root
    for part in relative.split('/'):
        p=p/part
        if p.is_symlink() or (p.exists() and is_link(p)): raise ValueError('不允许符号链接或重解析点')
    if not p.resolve().is_relative_to(root): raise ValueError('路径越出工作目录')
    if exists and not p.is_file(): raise ValueError('文件不存在：'+relative)
    return p

def native_input(value: str) -> Path:
    if not isinstance(value,str) or not value.strip(): raise ValueError('请输入当前电脑上的数据目录')
    if value.startswith(('~','${','%')): raise ValueError('请使用实际路径，不使用 ~ 或环境变量占位符')
    w=PureWindowsPath(value)
    if os.name!='nt' and (w.drive or '\\' in value): raise ValueError('这是 Windows 路径，请在对应 Windows 电脑上导入')
    p=Path(value)
    if not p.is_absolute(): raise ValueError('导入目录需要当前电脑的绝对路径')
    # Resolve only after rejecting symlink components.
    for part in [p,*p.parents]:
        if is_link(part) and not (sys.platform=='darwin' and str(part) in {'/var','/tmp','/etc'}): raise ValueError('导入目录不允许符号链接')
    return p.resolve()

def file_hash(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
