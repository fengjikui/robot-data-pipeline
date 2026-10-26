"""Regress Windows redirected-console failures without relying on its locale."""
from pathlib import Path
import subprocess
import sys
import unittest


class WorkbenchConsoleTests(unittest.TestCase):
    def invoke_with_legacy_redirected_streams(self, argv):
        root = Path(__file__).resolve().parents[1]
        code = (
            "import sys; "
            f"sys.path.insert(0, {str(root)!r}); "
            "sys.stdout.reconfigure(encoding='cp1252', errors='strict'); "
            "sys.stderr.reconfigure(encoding='cp1252', errors='strict'); "
            "from robot_pipeline.workbench.__main__ import main; "
            f"sys.exit(main({argv!r}))"
        )
        # -I must remain: environment flags alone did not fix the Windows CI bug.
        return subprocess.run([sys.executable, '-I', '-c', code], capture_output=True, timeout=10)

    def test_chinese_help_works_with_cp1252_redirected_stdout(self):
        result = self.invoke_with_legacy_redirected_streams(['--help'])
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8', errors='replace'))
        self.assertIn('具身智能数据管线工作台', result.stdout.decode('utf-8'))
        self.assertNotIn(b'UnicodeEncodeError', result.stderr)

    def test_chinese_error_works_with_cp1252_redirected_stderr(self):
        result = self.invoke_with_legacy_redirected_streams(['--port', '-1'])
        self.assertEqual(result.returncode, 2)
        self.assertIn('port 必须在', result.stderr.decode('utf-8'))
        self.assertNotIn(b'UnicodeEncodeError', result.stderr)


if __name__ == '__main__':
    unittest.main()
