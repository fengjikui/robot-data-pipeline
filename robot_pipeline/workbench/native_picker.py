"""System folder dialogs in owned child processes, never on the HTTP thread."""
from __future__ import annotations

import base64
from dataclasses import dataclass
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading

from .paths import native_input

MAC_SCRIPT = '''on run argv
    try
        set startFolder to (POSIX file (item 1 of argv)) as alias
        set chosenFolder to choose folder with prompt "选择数据目录" default location startFolder
        return POSIX path of chosenFolder
    on error errorMessage number errorNumber
        if errorNumber is -128 then return ""
        error errorMessage number errorNumber
    end try
end run'''

WINDOWS_SCRIPT = '''$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
try {
    $dialog.Description = '选择数据目录'
    $dialog.ShowNewFolderButton = $false
    $dialog.SelectedPath = $env:ROBOT_PIPELINE_PICKER_INITIAL
    if ($dialog.PSObject.Properties['UseDescriptionForTitle']) { $dialog.UseDescriptionForTitle = $true }
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::Out.Write($dialog.SelectedPath)
    }
} finally { $dialog.Dispose() }
'''


class NativePickerUnavailable(ValueError):
    pass


class NativePickerBusy(ValueError):
    pass


@dataclass(frozen=True)
class DialogCommand:
    argv: list[str]
    env: dict[str, str]
    backend: str
    cancel_codes: tuple[int, ...] = ()


def initial_directory(value: str | None) -> Path:
    if value is None or value == '':
        return Path.home().resolve()
    if not isinstance(value, str) or len(value) > 4096 or '\x00' in value:
        raise ValueError('初始目录路径无效')
    candidate = Path(value)
    if not candidate.is_absolute():
        raise ValueError('请使用当前电脑的绝对目录路径')
    for path in (candidate, *candidate.parents):
        if path.is_dir():
            return native_input(str(path))
        if path.is_file():
            return native_input(str(path.parent))
    return Path.home().resolve()


def dialog_command(initial: Path, *, platform=None, environment=None, which=None) -> DialogCommand:
    platform = sys.platform if platform is None else platform
    env = dict(os.environ if environment is None else environment)
    which = shutil.which if which is None else which
    if platform == 'darwin':
        program = which('osascript')
        if not program:
            raise NativePickerUnavailable('系统目录选择器不可用，请手动粘贴路径')
        return DialogCommand([program, '-e', MAC_SCRIPT, str(initial)], env, 'macOS system dialog')
    if platform == 'win32':
        program = which('powershell.exe')
        if not program:
            raise NativePickerUnavailable('未找到 Windows PowerShell，暂时请手动粘贴路径')
        env['ROBOT_PIPELINE_PICKER_INITIAL'] = str(initial)
        encoded = base64.b64encode(WINDOWS_SCRIPT.encode('utf-16-le')).decode('ascii')
        return DialogCommand([program, '-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], env, 'Windows FolderBrowserDialog')
    if platform.startswith('linux'):
        if not env.get('DISPLAY') and not env.get('WAYLAND_DISPLAY'):
            raise NativePickerUnavailable('当前 Linux 没有图形桌面，无法显示系统选择器；请手动粘贴目录路径')
        programs = ['kdialog', 'zenity'] if 'KDE' in env.get('XDG_CURRENT_DESKTOP', '').upper() else ['zenity', 'kdialog']
        for name in programs:
            program = which(name)
            if not program:
                continue
            if name == 'zenity':
                return DialogCommand([program, '--file-selection', '--directory', '--title=选择数据目录', '--filename=' + str(initial) + os.sep], env, 'Linux Zenity', (1,))
            return DialogCommand([program, '--getexistingdirectory', str(initial), '--title', '选择数据目录'], env, 'Linux KDialog', (1,))
        raise NativePickerUnavailable('当前桌面未提供 Zenity 或 KDialog 系统选择器；请安装桌面对应组件，或手动粘贴路径')
    raise NativePickerUnavailable('当前系统没有接入原生目录选择器，请手动粘贴路径')


class NativeDirectoryPicker:
    def __init__(self, *, popen=None, timeout=300):
        self._popen = popen or subprocess.Popen
        self._timeout = timeout
        self._single = threading.Lock()
        self._guard = threading.Lock()
        self._process = None
        self._closed = False

    @staticmethod
    def _stop(process):
        if process.poll() is not None:
            return
        try:
            process.terminate()
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)

    def choose(self, initial_path=None):
        if not self._single.acquire(blocking=False):
            raise NativePickerBusy('已有目录选择窗口，请先完成选择或取消')
        process = None
        try:
            command = dialog_command(initial_directory(initial_path))
            options = dict(stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           encoding='utf-8', errors='replace', shell=False, env=command.env)
            if os.name == 'nt':
                options['creationflags'] = subprocess.CREATE_NO_WINDOW
            with self._guard:
                if self._closed:
                    raise NativePickerUnavailable('工作台正在关闭，无法打开选择器')
                process = self._popen(command.argv, **options)
                self._process = process
            try:
                stdout, stderr = process.communicate(timeout=self._timeout)
            except subprocess.TimeoutExpired as exc:
                self._stop(process)
                raise NativePickerUnavailable('系统选择窗口等待超时，已关闭本次窗口；可重新选择或粘贴路径') from exc
            if process.returncode in command.cancel_codes:
                return {'cancelled': True, 'path': None, 'backend': command.backend}
            if process.returncode != 0:
                raise NativePickerUnavailable('系统选择器未能完成选择，请手动粘贴路径或检查桌面环境')
            chosen = stdout.rstrip('\r\n')
            if not chosen:
                return {'cancelled': True, 'path': None, 'backend': command.backend}
            path = native_input(chosen)
            if not path.is_dir():
                raise ValueError('系统返回的路径不是可用文件夹')
            return {'cancelled': False, 'path': str(path), 'backend': command.backend}
        except OSError as exc:
            raise NativePickerUnavailable('无法启动系统目录选择器，请手动粘贴路径') from exc
        finally:
            if process is not None:
                for stream in (process.stdout, process.stderr):
                    if stream is not None:
                        stream.close()
            with self._guard:
                self._process = None
            self._single.release()

    def close(self):
        with self._guard:
            self._closed = True
            if self._process is not None:
                self._stop(self._process)
