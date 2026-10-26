"""Real native filesystem tests for the shared cross-platform directory picker."""
import http.client
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

from robot_pipeline.workbench.file_browser import list_directory, directory_roots, windows_drive_paths
from robot_pipeline.workbench.http import create_server


class DirectoryBrowserTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='picker 中文 spaces ')
        self.root = Path(self.temp.name).resolve()
        for name in ['数据 A & (copy)', '数据 B', 'empty']:
            (self.root / name).mkdir()
        (self.root / 'not-a-directory.json').write_text('{}', encoding='utf-8')

    def tearDown(self):
        self.temp.cleanup()

    def test_unicode_spaces_real_children_and_read_only(self):
        before = sorted(p.name for p in self.root.iterdir())
        page = list_directory({'path': str(self.root)})
        self.assertEqual(page['path'], str(self.root))
        self.assertEqual({p['name'] for p in page['entries']}, {'数据 A & (copy)', '数据 B', 'empty'})
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), before)
        self.assertTrue(page['read_only'])
        self.assertEqual(page['scope'], 'service_machine')
        for entry in page['entries']:
            self.assertTrue(Path(entry['path']).is_absolute())
            self.assertTrue(Path(entry['path']).is_dir())

    def test_child_navigation_empty_directory_and_parent(self):
        page = list_directory({'path': str(self.root), 'query': '数据 A'})
        child = list_directory({'path': page['entries'][0]['path']})
        self.assertEqual(child['entries'], [])
        self.assertEqual(child['parent'], str(self.root))
        self.assertEqual(list_directory({'path': child['parent']})['total'], 3)

    def test_pagination_and_filter(self):
        for index in range(104):
            (self.root / f'batch-{index:03d}').mkdir()
        first = list_directory({'path': str(self.root), 'query': 'BATCH-'})
        self.assertEqual(len(first['entries']), 100)
        self.assertTrue(first['has_more'])
        second = list_directory({'path': str(self.root), 'query': 'batch-', 'offset': first['next_offset']})
        self.assertEqual(len(second['entries']), 4)
        self.assertFalse(second['has_more'])
        self.assertFalse({p['path'] for p in first['entries']} & {p['path'] for p in second['entries']})

    def test_default_home_and_roots(self):
        with patch('robot_pipeline.workbench.file_browser.Path.home', return_value=self.root):
            page = list_directory({})
        self.assertEqual(page['path'], str(self.root))
        self.assertTrue(any(root['path'] == str(self.root) for root in page['roots']))

    def test_real_native_root_parent_stops(self):
        anchor = Path(self.root.anchor)
        page = list_directory({'path': str(anchor)})
        self.assertIsNone(page['parent'])

    def test_missing_file_and_foreign_path_errors_are_readable(self):
        for path, message in [(self.root / 'absent', '目录不存在'),
                              (self.root / 'not-a-directory.json', '不是文件夹')]:
            with self.subTest(path=path):
                with self.assertRaisesRegex(ValueError, message):
                    list_directory({'path': str(path)})
        if os.name != 'nt':
            with self.assertRaisesRegex(ValueError, 'Windows 路径'):
                list_directory({'path': 'C:\\Data\\机器人'})

    def test_permission_error_and_invalid_options(self):
        with patch('robot_pipeline.workbench.file_browser.os.scandir', side_effect=PermissionError):
            with self.assertRaisesRegex(ValueError, '没有权限'):
                list_directory({'path': str(self.root)})
        for values in [{'offset': True}, {'offset': -1}, {'query': []}, {'path': 42}, {'path': '\x00'}]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                list_directory(values)

    def test_symbolic_link_is_not_selectable(self):
        link = self.root / 'linked'
        try:
            link.symlink_to(self.root / 'empty', target_is_directory=True)
        except (OSError, NotImplementedError) as exc:
            self.skipTest('Cannot create symbolic link: ' + str(exc))
        entry = next(x for x in list_directory({'path': str(self.root)})['entries'] if x['name'] == 'linked')
        self.assertFalse(entry['selectable'])
        with self.assertRaisesRegex(ValueError, '符号链接'):
            list_directory({'path': str(link)})

    def test_windows_drive_mask_and_actual_roots(self):
        self.assertEqual(windows_drive_paths((1 << 2) | (1 << 3)), ['C:\\', 'D:\\'])
        self.assertEqual(windows_drive_paths(0), [])
        roots = directory_roots()
        if os.name == 'nt':
            self.assertTrue(any(root['path'].casefold() == self.root.anchor.casefold() for root in roots))
        else:
            self.assertTrue(any(root['path'] == '/' for root in roots))


class DirectoryPickerAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / '外部数据 中文 (copy)&'
        self.source.mkdir()
        (self.source / 'metadata.json').write_text('{"note":"测试"}', encoding='utf-8')
        self.server = create_server(self.root / 'workspace')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.token = self.request('GET', '/api/state')[1]['csrf_token']

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.temp.cleanup()

    def request(self, method, path, payload=None, token=True, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=10)
        send_headers = {'Content-Type': 'application/json'}
        if token and hasattr(self, 'token'):
            send_headers['X-Workbench-Token'] = self.token
        send_headers.update(headers or {})
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
        connection.request(method, path, body=body, headers=send_headers)
        response = connection.getresponse()
        status = response.status
        data = json.loads(response.read().decode('utf-8'))
        connection.close()
        return status, data

    def test_selected_directory_flows_into_existing_import(self):
        status, page = self.request('POST', '/api/paths/list', {'path': str(self.root), 'query': '外部数据'})
        self.assertEqual(status, 200, page)
        self.assertEqual(self.request('GET', '/api/state')[1]['assets'], [])
        self.assertEqual(len(page['entries']), 1)
        status, asset = self.request('POST', '/api/assets/import', {'path': page['entries'][0]['path'], 'name': '选择的目录'})
        self.assertEqual(status, 200, asset)
        self.assertEqual(asset['file_count'], 1)
        self.assertEqual(asset['name'], '选择的目录')

    def test_directory_listing_requires_token_and_same_origin(self):
        payload = {'path': str(self.root)}
        self.assertEqual(self.request('POST', '/api/paths/list', payload, token=False)[0], 403)
        for headers in [{'Origin': 'https://evil.example'}, {'Sec-Fetch-Site': 'cross-site'}, {'Host': 'evil.example'}]:
            with self.subTest(headers=headers):
                self.assertEqual(self.request('POST', '/api/paths/list', payload, headers=headers)[0], 403)
        self.assertEqual(self.request('GET', '/api/paths/list')[0], 404)


if __name__ == '__main__':
    unittest.main()
