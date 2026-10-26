"""Portable API/path integration tests; no experiments, SDK, GPU or network downloads."""
from __future__ import annotations

import base64
import http.client
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from robot_pipeline.workbench.http import create_server
from robot_pipeline.workbench.paths import native_input, safe_relative, within
from robot_pipeline.workbench.service import Workbench


def write_episode(root: Path, *, image_ref="image.png", invalid=False):
    root.mkdir(parents=True, exist_ok=True)
    state = {part: {"qpos": [0.0] * 7} for part in ("left_arm", "right_arm", "left_ee", "right_ee")}
    action = {part: {"qpos": [0.1] * 7} for part in state}
    row = {"idx": 0, "timestamp": 0.0, "states": state, "actions": action, "colors": {"color_0": image_ref}}
    if invalid:
        row["states"]["left_arm"]["qpos"] = [0.0]
    value = {"text": {"goal": "中文任务：把箱子放到桌面"}, "info": {"image": {"fps": 30}}, "data": [row]}
    (root / "data.json").write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    (root / "image.png").write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP6sAAAAASUVORK5CYII="))


class PortablePathTests(unittest.TestCase):
    def test_managed_paths_reject_cross_platform_escape_and_reserved_names(self):
        for value in ("../x", "x/../y", "..\\x", "x\\..\\y", "/etc/passwd", "C:/data/x", "C:x", "C:\\data\\x", "//server/share/x", "\\\\server\\share\\x", "\\\\?\\C:\\x", "CON", "nul.txt", "x/COM1.txt", "x/LPT9", "foo.", "foo ", "x//y", "x/./y", "a:b", "a\x00b", "x\ny", "a" * 181):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    safe_relative(value)

    def test_managed_paths_preserve_chinese_spaces_and_symbols(self):
        self.assertEqual(safe_relative("assets/中文 空格 (副本)&/图像.png"), "assets/中文 空格 (副本)&/图像.png")

    def test_symlink_escape_is_rejected_when_supported(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            outside = base / "outside"
            outside.mkdir()
            root = base / "owned"
            root.mkdir()
            try:
                (root / "link").symlink_to(outside, target_is_directory=True)
            except (OSError, NotImplementedError) as exc:
                self.skipTest("当前系统不允许创建符号链接：" + str(exc))
            with self.assertRaises(ValueError):
                within(root, "link/private.json")

    def test_foreign_windows_source_is_not_interpreted_as_posix_local(self):
        if os.name == "nt":
            self.skipTest("此用例检查 POSIX 对外来 Windows 语法的拒绝；Windows 本机路径另测")
        for value in ("C:\\data\\source", "C:/data/source", "\\\\server\\share", "C:source"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    native_input(value)


class WorkbenchPlatformAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="pipeline-platform-")
        self.root = Path(self.temp.name)
        self.workspace = self.root / "中文 工作区 (copy)&"
        self.server = create_server(self.workspace, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host = f"127.0.0.1:{self.server.server_port}"
        self.token = self.request("GET", "/api/state")[1]["csrf_token"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.temp.cleanup()

    def request(self, method, path, payload=None, *, headers=None, token=True):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        send_headers = {"Host": self.host}
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            send_headers["Content-Type"] = "application/json; charset=utf-8"
        if method == "POST" and token:
            send_headers["X-Workbench-Token"] = self.token
        if headers:
            send_headers.update(headers)
        conn.request(method, path, body=body, headers=send_headers)
        response = conn.getresponse()
        status = response.status
        data = response.read()
        content_type = response.getheader("Content-Type", "")
        conn.close()
        if content_type.startswith("application/json"):
            return status, json.loads(data.decode("utf-8"))
        return status, data

    def run_job(self, asset_id, stage):
        status, job = self.request("POST", "/api/jobs", {"asset_id": asset_id, "stage": stage})
        self.assertEqual(status, 200, job)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            status, detail = self.request("GET", "/api/jobs/" + job["id"])
            self.assertEqual(status, 200, detail)
            if detail["job"]["status"] not in {"queued", "running", "cancelling"}:
                return detail
            time.sleep(0.04)
        self.fail("worker 未在 20 秒内结束")

    def import_source(self, root, **fields):
        value = {"path": str(root), "name": "中文样例 (test)&", "source_kind": "self_capture", "task": "搬箱", "tags": ["中文", "有空格 标签"], "license": "unknown", "embodiment": "unknown", **fields}
        status, result = self.request("POST", "/api/assets/import", value)
        self.assertEqual(status, 200, result)
        return result

    def test_empty_start_project_roundtrip_and_utf8(self):
        status, state = self.request("GET", "/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(state["assets"], [])
        self.assertEqual(state["jobs"], [])
        status, project = self.request("POST", "/api/project", {"task": "中文搬箱 (A → B)", "target": "G1 待核实配置", "policy": "diffusion"})
        self.assertEqual(status, 200, project)
        self.assertEqual(self.request("GET", "/api/state")[1]["project"]["task"], "中文搬箱 (A → B)")
        self.assertEqual(self.request("GET", "/api/state")[1]["project"]["policy"], "diffusion")

    def test_csrf_origin_and_dns_rebinding_guards(self):
        self.assertEqual(self.request("POST", "/api/demo", {}, token=False)[0], 403)
        self.assertEqual(self.request("POST", "/api/demo", {}, headers={"X-Workbench-Token": "bad"})[0], 403)
        for method in ("GET", "POST"):
            target = "/api/state" if method == "GET" else "/api/demo"
            value = None if method == "GET" else {}
            with self.subTest(method=method, guard="Origin"):
                self.assertEqual(self.request(method, target, value, headers={"Origin": "https://evil.example"})[0], 403)
            with self.subTest(method=method, guard="Host"):
                self.assertEqual(self.request(method, target, value, headers={"Host": "evil.example"})[0], 403)
            with self.subTest(method=method, guard="FetchSite"):
                self.assertEqual(self.request(method, target, value, headers={"Sec-Fetch-Site": "cross-site"})[0], 403)

    def test_static_path_escape_cannot_expose_catalog_or_source(self):
        for path in ("/../catalog.sqlite3", "/%2e%2e/catalog.sqlite3", "/..%5ccatalog.sqlite3", "/C:%5cWindows%5cwin.ini", "/%2fetc/passwd"):
            with self.subTest(path=path):
                status, _ = self.request("GET", path)
                self.assertEqual(status, 400)

    def test_import_and_export_with_unicode_paths_own_contract_only(self):
        source = self.root / "来源 with spaces & (一)"
        write_episode(source)
        original = (source / "data.json").read_bytes()
        asset = self.import_source(source)
        self.assertFalse(Path(asset["path"]).is_absolute())
        self.assertNotIn("\\", asset["path"])
        self.assertEqual(asset["tags"], ["中文", "有空格 标签"])
        detail = self.run_job(asset["id"], "check_export")
        self.assertEqual(detail["job"]["status"], "succeeded", detail)
        self.assertFalse(detail["result"]["training_ready"])
        self.assertFalse(detail["result"]["contract"]["is_lerobot_dataset"])
        self.assertEqual((source / "data.json").read_bytes(), original)
        self.assertTrue(any("授权" in x for x in detail["result"]["quality"]["warnings"]))
        artifacts = {x["name"]: x["url"] for x in detail["result"]["artifacts"]}
        status, data = self.request("GET", artifacts["export/records.jsonl"])
        self.assertEqual(status, 200)
        record = json.loads(data.decode("utf-8").strip())
        self.assertEqual(record["task"], "中文任务：把箱子放到桌面")
        self.assertEqual(record["observation.state"][0], 0.0)
        self.assertEqual(record["action"][0], 0.1)
        self.assertEqual(len(record["action"]), 28)

    def test_invalid_data_stops_chain_without_export(self):
        source = self.root / "invalid data"
        write_episode(source, invalid=True)
        asset = self.import_source(source)
        detail = self.run_job(asset["id"], "check_export")
        self.assertEqual(detail["job"]["status"], "failed", detail)
        self.assertFalse(detail["result"]["quality"]["valid"])
        self.assertFalse((self.workspace / "jobs" / detail["job"]["id"] / "export").exists())
        self.assertEqual(self.request("POST", "/api/jobs", {"asset_id": asset["id"], "stage": "export"})[0], 400)

    def test_windows_style_image_escape_fails_on_every_platform(self):
        source = self.root / "unsafe image"
        write_episode(source, image_ref="..\\private.jpg")
        asset = self.import_source(source)
        detail = self.run_job(asset["id"], "check_export")
        self.assertEqual(detail["job"]["status"], "failed", detail)
        self.assertTrue(any("路径" in x for x in detail["result"]["quality"]["errors"]))

    def test_post_qc_mutation_is_not_silently_exported(self):
        source = self.root / "mutable"
        write_episode(source)
        asset = self.import_source(source)
        self.assertEqual(self.run_job(asset["id"], "check")["job"]["status"], "succeeded")
        image = self.workspace / asset["path"] / "image.png"
        image.write_bytes(b"changed after QC")
        detail = self.run_job(asset["id"], "export")
        self.assertEqual(detail["job"]["status"], "failed", detail)
        self.assertFalse((self.workspace / "jobs" / detail["job"]["id"] / "export").exists())

    def test_unmanifested_extra_episode_cannot_enter_same_snapshot_export(self):
        source = self.root / "extra episode source"
        write_episode(source)
        asset = self.import_source(source)
        added = self.workspace / asset["path"] / "unmanifested_episode"
        write_episode(added)
        detail = self.run_job(asset["id"], "check_export")
        self.assertEqual(detail["job"]["status"], "failed", detail)
        self.assertFalse((self.workspace / "jobs" / detail["job"]["id"] / "export").exists())

    def test_unimplemented_or_arbitrary_execution_stage_rejected(self):
        status, asset = self.request("POST", "/api/demo", {})
        self.assertEqual(status, 200, asset)
        for stage in ("train", "deploy", "python", "sh", "check; echo bad"):
            with self.subTest(stage=stage):
                self.assertEqual(self.request("POST", "/api/jobs", {"asset_id": asset["id"], "stage": stage})[0], 400)

    def test_source_symlink_is_rejected_without_registered_asset(self):
        source = self.root / "source with link"
        write_episode(source)
        outside = self.root / "outside.txt"
        outside.write_text("not part of asset", encoding="utf-8")
        try:
            (source / "external.txt").symlink_to(outside)
        except (OSError, NotImplementedError) as exc:
            self.skipTest("当前系统不允许创建符号链接：" + str(exc))
        status, _ = self.request("POST", "/api/assets/import", {"path": str(source)})
        self.assertEqual(status, 400)
        self.assertEqual(self.request("GET", "/api/state")[1]["assets"], [])

    def test_case_colliding_source_is_rejected_where_filesystem_supports_it(self):
        source = self.root / "case collision"
        source.mkdir()
        (source / "A.txt").write_text("first", encoding="utf-8")
        (source / "a.txt").write_text("second", encoding="utf-8")
        if len(list(source.iterdir())) != 2:
            self.skipTest("当前文件系统不能创建仅大小写不同的两个文件")
        status, _ = self.request("POST", "/api/assets/import", {"path": str(source)})
        self.assertEqual(status, 400)
        self.assertEqual(self.request("GET", "/api/state")[1]["assets"], [])

    def test_working_directory_is_not_used_for_worker_import(self):
        status, asset = self.request("POST", "/api/demo", {})
        self.assertEqual(status, 200, asset)
        previous = Path.cwd()
        elsewhere = self.root / "empty working directory"
        elsewhere.mkdir()
        try:
            os.chdir(elsewhere)
            detail = self.run_job(asset["id"], "check_export")
        finally:
            os.chdir(previous)
        self.assertEqual(detail["job"]["status"], "succeeded", detail)


class WorkbenchPortableLifecycleTests(unittest.TestCase):
    def test_running_worker_cancel_stops_only_owned_child(self):
        with tempfile.TemporaryDirectory() as td:
            app = Workbench(Path(td) / "cancel worker 中文")
            actual_popen = subprocess.Popen
            child = None
            bystander = actual_popen([sys.executable, "-c", "import time; time.sleep(30)"], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                asset = app.demo()
                # A real slow child isolates cancellation behavior from fixture processing speed.
                def slow_owned_worker(argv, **kwargs):
                    nonlocal child
                    child = actual_popen([sys.executable, "-c", "import time; time.sleep(30)"], **kwargs)
                    return child
                with patch("robot_pipeline.workbench.service.subprocess.Popen", side_effect=slow_owned_worker):
                    job = app.submit({"asset_id": asset["id"], "stage": "check_export"})
                    deadline = time.monotonic() + 5
                    while time.monotonic() < deadline:
                        with app.lock:
                            ready = app.process is not None
                        if ready:
                            break
                        time.sleep(0.02)
                    self.assertIsNotNone(child, "测试 worker 未启动")
                    app.cancel(job["id"])
                    deadline = time.monotonic() + 5
                    while time.monotonic() < deadline:
                        detail = app.detail(job["id"])
                        if detail["job"]["status"] == "cancelled":
                            break
                        time.sleep(0.02)
                    self.assertEqual(detail["job"]["status"], "cancelled", detail)
                    self.assertIsNotNone(child.poll())
                    self.assertIsNone(bystander.poll(), "取消作业不应按名字终止其他 Python 进程")
                    self.assertFalse((app.workspace / "jobs" / job["id"] / "export").exists())
            finally:
                app.close()
                if bystander.poll() is None:
                    bystander.terminate()
                    bystander.wait(timeout=5)

    def test_restart_marks_previous_inflight_job_interrupted(self):
        with tempfile.TemporaryDirectory() as td:
            workspace = Path(td) / "restart"
            app = Workbench(workspace)
            try:
                app.store.put("job", {"id": "a" * 32, "asset_id": "missing", "stage": "check_export", "status": "running", "result": None})
            finally:
                app.close()
            app = Workbench(workspace)
            try:
                job = app.state()["jobs"][0]
                self.assertEqual(job["status"], "interrupted")
                self.assertIsNone(job["result"])
                self.assertIn("中断", job["error"])
            finally:
                app.close()

    def test_queued_cancel_cannot_run_or_export(self):
        with tempfile.TemporaryDirectory() as td:
            workspace = Path(td) / "workspace"
            app = Workbench(workspace)
            try:
                asset = app.demo()
                with app.lock:
                    job = app.submit({"asset_id": asset["id"], "stage": "check_export"})
                    cancelled = app.cancel(job["id"])
                    self.assertEqual(cancelled["status"], "cancelled")
                time.sleep(0.1)
                self.assertEqual(app.detail(job["id"])["job"]["status"], "cancelled")
                self.assertFalse((workspace / "jobs" / job["id"] / "export").exists())
            finally:
                app.close()

    def test_moved_workspace_reopens_with_relative_asset_paths(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            app = Workbench(root / "original")
            try:
                asset = app.demo()
            finally:
                app.close()
            moved = root / "移动 后的工作区 (copy)"
            shutil.move(str(root / "original"), moved)
            app = Workbench(moved)
            try:
                stored = app.state()["assets"][0]
                self.assertEqual(stored["id"], asset["id"])
                self.assertTrue((moved / stored["path"] / "data.json").is_file())
                job = app.submit({"asset_id": stored["id"], "stage": "check_export"})
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    detail = app.detail(job["id"])
                    if detail["job"]["status"] not in {"running", "queued"}:
                        break
                    time.sleep(0.04)
                self.assertEqual(detail["job"]["status"], "succeeded", detail)
            finally:
                app.close()


if __name__ == "__main__":
    unittest.main()
