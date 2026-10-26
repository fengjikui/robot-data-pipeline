"""Native dialog contracts, process ownership, and native component probes."""
import base64
import http.client
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

from robot_pipeline.workbench.native_picker import (
    MAC_SCRIPT, WINDOWS_SCRIPT, NativeDirectoryPicker, NativePickerBusy,
    NativePickerUnavailable, DialogCommand, dialog_command, initial_directory,
)
from robot_pipeline.workbench.http import create_server


class FinishedDialog:
    def __init__(self, output='', code=0):
        self.stdout = io.StringIO()
        self.stderr = io.StringIO()
        self.output = output
        self.returncode = code
        self.terminated = False

    def communicate(self, timeout=None): return self.output, ''
    def poll(self): return self.returncode
    def wait(self, timeout=None): return self.returncode
    def terminate(self): self.terminated = True; self.returncode = -15
    def kill(self): self.terminated = True; self.returncode = -9


class NativeDialogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='native picker 中文 ')
        self.root = Path(self.temp.name).resolve()
        self.directory = self.root / '数据 folder & (copy)'
        self.directory.mkdir()

    def tearDown(self): self.temp.cleanup()

    def test_windows_script_encoding_and_untrusted_path_is_data(self):
        env = {'PATH': 'unchanged'}
        spec = dialog_command(self.directory, platform='win32', environment=env, which=lambda name: 'powershell.exe')
        self.assertIn('-STA', spec.argv)
        self.assertNotIn('-ExecutionPolicy', spec.argv)
        self.assertEqual(base64.b64decode(spec.argv[-1]).decode('utf-16-le'), WINDOWS_SCRIPT)
        self.assertNotIn(str(self.directory), WINDOWS_SCRIPT)
        self.assertEqual(spec.env['ROBOT_PIPELINE_PICKER_INITIAL'], str(self.directory))
        self.assertEqual(env, {'PATH': 'unchanged'})

    def test_mac_path_is_argv_not_interpolated_script(self):
        spec = dialog_command(self.directory, platform='darwin', which=lambda name: '/usr/bin/osascript')
        self.assertEqual(spec.argv[-1], str(self.directory))
        self.assertIn(MAC_SCRIPT, spec.argv)
        self.assertNotIn(str(self.directory), MAC_SCRIPT)

    def test_linux_desktop_selection_and_headless_failure(self):
        available = lambda name: '/usr/bin/' + name
        spec = dialog_command(self.directory, platform='linux', environment={'DISPLAY': ':1'}, which=available)
        self.assertIn('--directory', spec.argv)
        self.assertEqual(spec.cancel_codes, (1,))
        kde = dialog_command(self.directory, platform='linux', environment={'WAYLAND_DISPLAY': 'wayland-0', 'XDG_CURRENT_DESKTOP': 'KDE'}, which=available)
        self.assertEqual(kde.argv[0], '/usr/bin/kdialog')
        with self.assertRaisesRegex(NativePickerUnavailable, '没有图形桌面'):
            dialog_command(self.directory, platform='linux', environment={}, which=available)
        with self.assertRaisesRegex(NativePickerUnavailable, 'Zenity'):
            dialog_command(self.directory, platform='linux', environment={'DISPLAY': ':1'}, which=lambda name: None)

    def test_initial_directory_parent_and_file(self):
        self.assertEqual(initial_directory(str(self.directory / 'missing' / 'deeper')), self.directory)
        file = self.directory / 'data.json'; file.write_text('{}', encoding='utf-8')
        self.assertEqual(initial_directory(str(file)), self.directory)
        with self.assertRaises(ValueError): initial_directory('relative')
        with self.assertRaises(ValueError): initial_directory(3)

    def fake_spec(self, cancel_codes=()):
        return DialogCommand(['native-helper'], os.environ.copy(), 'contract-test', cancel_codes)

    def test_confirmed_unicode_path_and_shell_false(self):
        calls = []
        def launch(argv, **kwargs):
            calls.append((argv, kwargs)); return FinishedDialog(str(self.directory) + '\n')
        picker = NativeDirectoryPicker(popen=launch)
        with patch('robot_pipeline.workbench.native_picker.dialog_command', return_value=self.fake_spec()):
            result = picker.choose(str(self.root))
        self.assertEqual(result['path'], str(self.directory)); self.assertFalse(result['cancelled'])
        self.assertIs(calls[0][1]['shell'], False)
        self.assertEqual(calls[0][1]['encoding'], 'utf-8')
        picker.close()

    def test_cancel_and_error_do_not_invent_paths(self):
        for output, code, cancelled in [('', 0, True), ('', 1, True), ('', 2, False)]:
            with self.subTest(code=code):
                picker = NativeDirectoryPicker(popen=lambda *a, **kw: FinishedDialog(output, code))
                with patch('robot_pipeline.workbench.native_picker.dialog_command', return_value=self.fake_spec((1,))):
                    if cancelled:
                        result = picker.choose(); self.assertTrue(result['cancelled']); self.assertIsNone(result['path'])
                    else:
                        with self.assertRaises(NativePickerUnavailable): picker.choose()
                picker.close()

    def test_invalid_return_and_closed_picker(self):
        picker = NativeDirectoryPicker(popen=lambda *a, **kw: FinishedDialog('relative-data'))
        with patch('robot_pipeline.workbench.native_picker.dialog_command', return_value=self.fake_spec()):
            with self.assertRaises(ValueError): picker.choose()
            picker.close()
            with self.assertRaisesRegex(NativePickerUnavailable, '关闭'): picker.choose()

    def test_timeout_stops_only_owned_process_and_releases_lock(self):
        class HangingDialog(FinishedDialog):
            def __init__(self): super().__init__(); self.returncode = None
            def communicate(self, timeout=None): raise subprocess.TimeoutExpired('owned-native-helper', timeout)
        process = HangingDialog(); picker = NativeDirectoryPicker(popen=lambda *a, **kw: process, timeout=.01)
        with patch('robot_pipeline.workbench.native_picker.dialog_command', return_value=self.fake_spec()):
            with self.assertRaisesRegex(NativePickerUnavailable, '超时'): picker.choose()
        self.assertTrue(process.terminated)
        self.assertTrue(picker._single.acquire(blocking=False)); picker._single.release(); picker.close()

    def test_concurrent_selection_is_rejected(self):
        picker = NativeDirectoryPicker(); picker._single.acquire()
        try:
            with self.assertRaises(NativePickerBusy): picker.choose()
        finally: picker._single.release(); picker.close()

    def test_native_component_probe_without_opening_a_window(self):
        if sys.platform == 'win32':
            code = "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; [Console]::Out.Write($d.GetType().FullName); $d.Dispose()"
            encoded = base64.b64encode(code.encode('utf-16-le')).decode('ascii')
            result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(b'FolderBrowserDialog', result.stdout)
        elif sys.platform == 'darwin':
            result = subprocess.run(['osacompile', '-e', MAC_SCRIPT, '-o', str(self.root / 'picker.scpt')], capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            with patch.dict(os.environ, {'DISPLAY': '', 'WAYLAND_DISPLAY': ''}):
                with self.assertRaises(NativePickerUnavailable): dialog_command(self.root)


class NativePickerAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name).resolve()
        self.source = self.root / '外部数据 (copy)'; self.source.mkdir()
        (self.source / 'meta.json').write_text('{}', encoding='utf-8')
        source = self.source
        class Picker:
            called = 0
            def choose(self, initial_path=None):
                self.called += 1
                return {'cancelled': False, 'path': str(source), 'backend': 'injected contract'}
            def close(self): pass
        self.picker = Picker()
        self.server = create_server(self.root / 'workspace', directory_picker=self.picker)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        self.token = self.request('GET', '/api/state')[1]['csrf_token']

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=3); self.temp.cleanup()

    def request(self, method, path, body=None, *, token=True, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=10)
        h = {'Content-Type': 'application/json'}
        if token and hasattr(self, 'token'): h['X-Workbench-Token'] = self.token
        h.update(headers or {})
        data = json.dumps(body).encode('utf-8') if body is not None else None
        connection.request(method, path, body=data, headers=h)
        response = connection.getresponse(); status = response.status; value = json.loads(response.read()); connection.close()
        return status, value

    def test_native_result_can_be_imported_without_auto_import(self):
        status, result = self.request('POST', '/api/paths/pick', {'initial_path': str(self.source)})
        self.assertEqual(status, 200, result)
        self.assertEqual(self.request('GET', '/api/state')[1]['assets'], [])
        status, asset = self.request('POST', '/api/assets/import', {'path': result['path'], 'name': '原生选择的目录'})
        self.assertEqual(status, 200, asset); self.assertEqual(asset['file_count'], 1)

    def test_native_dialog_cannot_be_triggered_cross_site_or_without_token(self):
        for headers, token in [({}, False), ({'Origin': 'https://evil.example'}, True), ({'Sec-Fetch-Site': 'cross-site'}, True)]:
            self.assertEqual(self.request('POST', '/api/paths/pick', {}, headers=headers, token=token)[0], 403)
        self.assertEqual(self.picker.called, 0)
        self.assertEqual(self.request('GET', '/api/paths/pick')[0], 404)
        self.assertEqual(self.request('POST', '/api/paths/list', {})[0], 404)


if __name__ == '__main__': unittest.main()
