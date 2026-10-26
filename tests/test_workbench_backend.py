"""Dependency-free acceptance tests for the local workbench and immutable snapshots."""
import copy
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest import mock
from robot_pipeline.workbench.service import Workbench
from robot_pipeline.workbench.paths import within,read_json,write_json,safe_relative
from robot_pipeline.workbench.data import check

class BackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='数据 workbench ')
        self.workspace=Path(self.tmp.name)/'库 workspace'
        self.app=Workbench(self.workspace)
    def tearDown(self):
        self.app.close();self.tmp.cleanup()
    def wait(self,job):
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            value=self.app.detail(job['id'])
            if value['job']['status'] not in {'queued','running','cancelling'}:return value
            time.sleep(.02)
        self.fail('managed subprocess did not finish')
    def test_empty_start_and_explicit_synthetic_fixture(self):
        self.assertEqual(self.app.state()['assets'],[])
        asset=self.app.demo();self.assertTrue(asset['synthetic']);self.assertEqual(asset['frames'],12)
        self.assertFalse(asset['training_ready'])
    def test_chain_preserves_state_action_and_declares_contract(self):
        asset=self.app.demo();result=self.wait(self.app.submit({'asset_id':asset['id'],'stage':'check_export'}))
        self.assertEqual(result['job']['status'],'succeeded')
        quality=result['result']['quality'];self.assertTrue(quality['valid']);self.assertFalse(quality['training_ready'])
        root=self.workspace/'jobs'/result['job']['id']/'export'
        contract=read_json(root/'contract.json');self.assertFalse(contract['is_lerobot_dataset'])
        self.assertTrue(contract['provenance']['synthetic']);self.assertEqual(contract['provenance']['source_kind'],'simulation')
        self.assertEqual(contract['provenance']['embodiment'],'SYNTHETIC_28D');self.assertFalse(contract['action_semantics_verified'])
        row=json.loads((root/'records.jsonl').read_text(encoding='utf-8').splitlines()[0])
        self.assertEqual(row['observation.state'][0],0);self.assertEqual(row['action'][0],.01)
        self.assertEqual(row['images']['color_0'],'image.png');self.assertTrue(row['synthetic'])
    def test_malformed_worker_report_marks_failure_and_manager_survives(self):
        asset=self.app.demo()
        class FakeProcess:
            def wait(self,timeout=None):return 0
            def poll(self):return 0
        def malformed(*args,**kwargs):
            (Path(kwargs['cwd'])/'result.json').write_text('{bad json',encoding='utf-8')
            return FakeProcess()
        with mock.patch('robot_pipeline.workbench.service.subprocess.Popen',side_effect=malformed):
            result=self.wait(self.app.submit({'asset_id':asset['id'],'stage':'check'}))
        self.assertEqual(result['job']['status'],'failed');self.assertIn('无法读取阶段结果',result['job']['error'])
        self.assertTrue(self.app.thread.is_alive())
        next_result=self.wait(self.app.submit({'asset_id':asset['id'],'stage':'check'}))
        self.assertEqual(next_result['job']['status'],'succeeded')
    def test_no_export_without_quality(self):
        asset=self.app.demo()
        with self.assertRaises(ValueError):self.app.submit({'asset_id':asset['id'],'stage':'export'})
    def test_raw_snapshot_tampering_stops_stage(self):
        asset=self.app.demo();path=within(self.workspace,asset['path']+'/data.json')
        obj=read_json(path);obj['data'][0]['idx']=7;write_json(path,obj)
        result=self.wait(self.app.submit({'asset_id':asset['id'],'stage':'check_export'}))
        self.assertEqual(result['job']['status'],'failed');self.assertIn('原始快照发生变化',result['log'])
        self.assertFalse((self.workspace/'jobs'/result['job']['id']/'export').exists())
    def test_validation_rejects_nonfinite_escape_and_bad_dimensions(self):
        asset=self.app.demo();root=within(self.workspace,asset['path']);path=root/'data.json';original=read_json(path)
        for mutate in ('nonfinite','path','dimension','parts'):
            obj=copy.deepcopy(original)
            if mutate=='nonfinite':obj['data'][0]['states']['left_arm']['qpos'][0]=float('nan')
            if mutate=='path':obj['data'][0]['colors']['color_0']='../image.png'
            if mutate=='dimension':obj['data'][0]['actions']['right_ee']['qpos']=[0]
            if mutate=='parts':
                for field in ('states','actions'):
                    for side in ('left','right'):obj['data'][1][field][side+'_hand']=obj['data'][1][field].pop(side+'_ee')
            path.write_text(json.dumps(obj),encoding='utf-8')
            with self.subTest(mutate=mutate):self.assertFalse(check(root,asset)['valid'])
    def test_partial_timestamps_warn(self):
        asset=self.app.demo();root=within(self.workspace,asset['path']);path=root/'data.json';obj=read_json(path);obj['data'][3].pop('timestamp');write_json(path,obj)
        quality=check(root,asset);self.assertTrue(quality['valid']);self.assertTrue(any('时间戳' in x for x in quality['warnings']))
    def test_lock_blocks_second_server_and_releases(self):
        with self.assertRaises(ValueError):Workbench(self.workspace)
        self.app.close();second=Workbench(self.workspace);second.close()
    def test_restart_persists_assets_and_interrupts_old_jobs(self):
        asset=self.app.demo();self.app.store.put('job',{'id':'a'*32,'asset_id':asset['id'],'stage':'check','status':'running','created_at':'test','result':None,'error':None})
        self.app.close();self.app=Workbench(self.workspace)
        self.assertEqual(self.app.state()['assets'][0]['id'],asset['id']);self.assertEqual(self.app.state()['jobs'][0]['status'],'interrupted')
    def test_rejects_commands_and_invalid_policy(self):
        with self.assertRaises(ValueError):self.app.submit({'asset_id':'anything','stage':'shell'})
        with self.assertRaises(ValueError):self.app.project({'policy':'invented'})
    def test_windows_reserved_name_guard_and_posix_source_rejection(self):
        with self.assertRaises(ValueError):safe_relative('CON.txt')
        # Windows treats CON as a device; never open it just to build a fixture.
        # On POSIX we can additionally prove the importer rejects such a source.
        if os.name=='nt':return
        source=Path(self.tmp.name)/'source';source.mkdir();(source/'CON.txt').write_text('x',encoding='utf-8')
        with self.assertRaises(ValueError):self.app.import_asset({'path':str(source),'name':'test'})
    def test_unknown_directory_can_catalog_but_not_export(self):
        source=Path(self.tmp.name)/'unknown';source.mkdir();(source/'meta.json').write_text('{}',encoding='utf-8')
        asset=self.app.import_asset({'path':str(source),'name':'元数据','license':'unknown','embodiment':'unknown'})
        self.assertEqual(asset['format'],'unknown')
        result=self.wait(self.app.submit({'asset_id':asset['id'],'stage':'check_export'}));self.assertEqual(result['job']['status'],'failed')
        self.assertFalse(result['result']['quality']['valid'])
    def test_import_external_snapshot_does_not_modify_source(self):
        source=Path(self.tmp.name)/'external';source.mkdir();p=source/'meta.json';p.write_text('{"中文":"值"}',encoding='utf-8');before=p.read_bytes()
        asset=self.app.import_asset({'path':str(source),'name':'中文 source','tags':['搬运','搬运']})
        self.assertEqual(p.read_bytes(),before);self.assertEqual(asset['tags'],['搬运']);self.assertFalse(Path(asset['path']).is_absolute())

if __name__=='__main__':unittest.main()
