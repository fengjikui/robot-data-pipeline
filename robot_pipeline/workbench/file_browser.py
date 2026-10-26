"""Read-only directory selection for the machine hosting the local workbench."""
from __future__ import annotations

import os
from pathlib import Path
import sys
import unicodedata

from .paths import is_link, native_input

PAGE_SIZE = 100
MAX_SCAN = 20000


def windows_drive_paths(mask: int) -> list[str]:
    """Decode Win32 GetLogicalDrives without guessing which drive is installed."""
    return [f'{chr(65 + bit)}:\\' for bit in range(26) if mask & (1 << bit)]


def _windows_drives() -> list[str]:
    import ctypes
    from ctypes import wintypes

    function = ctypes.windll.kernel32.GetLogicalDrives
    function.argtypes = []
    function.restype = wintypes.DWORD
    mask = function()
    return windows_drive_paths(mask)


def directory_roots() -> list[dict]:
    home = Path.home()
    candidates = [('主目录', home), ('下载', home / 'Downloads'), ('文档', home / 'Documents')]
    roots = []
    seen = set()
    for label, path in candidates:
        try:
            if not path.is_dir():
                continue
            value = str(path.resolve())
        except OSError:
            continue
        if value not in seen:
            roots.append({'label': label, 'path': value})
            seen.add(value)
    if os.name == 'nt':
        roots.extend({'label': f'磁盘 {drive}', 'path': drive} for drive in _windows_drives())
    else:
        roots.append({'label': '根目录 /', 'path': '/'})
        mounts = [Path('/Volumes')] if sys.platform == 'darwin' else [Path('/mnt'), Path('/media')]
        for path in mounts:
            if path.is_dir():
                roots.append({'label': '卷与挂载目录 ' + str(path), 'path': str(path)})
    return roots


def _fold(value: str) -> str:
    return unicodedata.normalize('NFC', value).casefold()


def list_directory(payload: dict) -> dict:
    """List one level only. No uploads, recursive scans, or filesystem mutations."""
    raw_path = payload.get('path')
    if raw_path is None or raw_path == '':
        raw_path = str(Path.home().resolve())
    if not isinstance(raw_path, str) or len(raw_path) > 4096 or '\x00' in raw_path:
        raise ValueError('目录路径无效，请重新选择')
    query = payload.get('query', '')
    offset = payload.get('offset', 0)
    if not isinstance(query, str) or len(query) > 120:
        raise ValueError('目录名称筛选不能超过120字符')
    if type(offset) is not int or not 0 <= offset <= MAX_SCAN:
        raise ValueError('目录分页参数无效')
    try:
        current = native_input(raw_path)
        if not current.is_dir():
            raise ValueError('所选路径不是文件夹，请选择数据所在目录')
        entries = []
        truncated = False
        with os.scandir(current) as iterator:
            for index, entry in enumerate(iterator):
                if index >= MAX_SCAN:
                    truncated = True
                    break
                if query and _fold(query) not in _fold(entry.name):
                    continue
                path = Path(entry.path)
                try:
                    linked = is_link(path)
                    if not linked and not entry.is_dir(follow_symlinks=False):
                        continue
                    # Links and junctions cannot be imported, so do not enter them.
                    entries.append({'name': entry.name, 'path': str(path),
                                    'selectable': not linked,
                                    'reason': '链接或重解析点暂不支持' if linked else ''})
                except OSError:
                    # A single vanished or unreadable item must not break navigation.
                    continue
    except FileNotFoundError as exc:
        raise ValueError('目录不存在，请检查路径或选择其他目录') from exc
    except PermissionError as exc:
        raise ValueError('没有权限浏览此目录，请选择当前用户可读取的目录') from exc
    except OSError as exc:
        raise ValueError('无法读取此目录，请检查磁盘是否可用及路径是否过长') from exc
    entries.sort(key=lambda item: (_fold(item['name']), item['name']))
    page = entries[offset:offset + PAGE_SIZE]
    parent = current.parent
    return {'path': str(current), 'parent': str(parent) if parent != current else None,
            'roots': directory_roots(), 'entries': page, 'total': len(entries),
            'offset': offset, 'next_offset': offset + len(page),
            'has_more': offset + len(page) < len(entries), 'scan_truncated': truncated,
            'scope': 'service_machine', 'read_only': True}
