"""Capture software acceptance. Synthetic processes are never hardware evidence."""
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from queue import Queue
from unittest.mock import patch
import importlib.util
import logging
import sys
import types
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from robot_pipeline.capture.runtime import Control, instrument_writer
from robot_pipeline.capture.synthetic import png
from robot_pipeline.capture.profile import load_profile, synthetic_profile
from robot_pipeline.capture.agent import Agent
from robot_pipeline.capture.protocol import ssh_command, Peer
from robot_pipeline.workbench.http import create_server

def wait_until(fn,timeout=20):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        result=fn()
        if result:return result
        time.sleep(.05)
    raise AssertionError('Timed out waiting for observed capture result')

def raw_episode(root,missing=False):
    root.mkdir(parents=True,exist_ok=True)
    (root/'image.png').write_bytes(png(1))
    parts={p:{'qpos':[.1]*7} for p in ('left_arm','right_arm','left_ee','right_ee')}
    value={'info':{'synthetic':True},'data':[{'idx':0,'colors':{'color_0':'missing.png' if missing else 'image.png'},'states':parts,'actions':parts}]}
    (root/'data.json').write_text(json.dumps(value),encoding='utf-8')

class RecorderBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='capture 边界 ');self.root=Path(self.temp.name)
        self.metadata={'synthetic':True,'session_id':'a'*32,'mode':'simulation','task':'合成边界测试'}
        self.control=Control(self.root/'control',self.metadata)
        self.state={'START':True,'STOP':False,'READY':True,'RECORD_RUNNING':False}
        self.keys=[];self.control.bind(self.keys.append,lambda:dict(self.state))
    def tearDown(self):self.control.close();self.temp.cleanup()

    def test_duplicate_intents_never_flip_recording_twice(self):
        self.control.action('record_start');self.control.action('record_start')
        self.assertEqual(self.keys,['s'])
        with self.assertRaises(ValueError):self.control.action('record_stop')
        self.state.update(RECORD_RUNNING=True,READY=False);self.control.status()
        self.control.action('record_start');self.assertEqual(self.keys,['s'])
        self.control.action('record_stop');self.control.action('record_stop')
        self.assertEqual(self.keys,['s','s'])
        self.state['RECORD_RUNNING']=False;self.control.status()
        self.control.action('record_stop');self.assertEqual(self.keys,['s','s'])

    def test_pending_timeout_stays_unknown_until_real_state_arrives(self):
        self.control.action('record_start');self.control.pending['sent_at']-=11
        self.assertEqual(self.control.status()['state'],'unknown')
        self.control.action('record_start');self.assertEqual(self.keys,['s'])
        self.state.update(RECORD_RUNNING=True,READY=False)
        self.assertEqual(self.control.status()['state'],'recording')
        self.assertIsNone(self.control.status()['error'])

    def test_save_hashing_does_not_block_status_or_allow_next_record(self):
        from robot_pipeline.capture.runtime import file_hash as actual_hash
        episode=self.root/'slow-save';raw_episode(episode);self.control.created(episode)
        entered=threading.Event();release=threading.Event()
        def slow_hash(path):entered.set();release.wait(timeout=3);return actual_hash(path)
        with patch('robot_pipeline.capture.runtime.file_hash',side_effect=slow_hash):
            worker=threading.Thread(target=self.control.saved,args=(episode,));worker.start()
            try:
                self.assertTrue(entered.wait(timeout=2))
                values=[];reader=threading.Thread(target=lambda:values.append(self.control.status()));reader.start();reader.join(timeout=.5)
                self.assertFalse(reader.is_alive(),'status must remain responsive during file hashing')
                self.assertEqual(values[0]['state'],'saving')
                with self.assertRaises(ValueError):self.control.action('record_start')
            finally:release.set();worker.join(timeout=5)
        self.assertEqual(len(self.control.status()['completed']),1)

    def test_no_completion_before_closed_json_and_media(self):
        episode=self.root/'episode';raw_episode(episode,missing=True)
        self.control.created(episode);self.control.saving()
        self.assertEqual(self.control.status()['completed'],[])
        self.control.saved(episode)
        self.assertEqual(self.control.status()['completed'],[])
        self.assertIn('文件不存在',self.control.status()['error'])
        raw_episode(episode);self.control.created(episode);self.control.saved(episode)
        self.assertEqual(len(self.control.status()['completed']),1)
        done=self.control.status()['completed'][0]
        self.assertTrue(done['writer_complete']);self.assertTrue(done['file_manifest_sha256'])

    def test_writer_hook_emits_after_underlying_save_and_reports_write_failure(self):
        control=self.control;root=self.root
        class Base:
            def __init__(self):self.info={};self.item_data_queue=Queue()
            def create_episode(self):self.episode_dir=str(root/'wrapped');raw_episode(Path(self.episode_dir));return True
            def save_episode(self):pass
            def _process_item_data(self,item):raise OSError('write failed')
            def _save_episode(self):self.base_saved=True
        writer=instrument_writer(Base,control)()
        writer.create_episode();writer.save_episode()
        self.assertEqual(control.status()['completed'],[])
        writer._save_episode();self.assertTrue(writer.base_saved)
        self.assertEqual(len(control.status()['completed']),1)
        writer.create_episode()
        with self.assertRaises(OSError):writer._process_item_data({'colors':{}})
        writer._save_episode();self.assertIn('write failed',control.status()['error'])
        self.assertEqual(len(control.status()['completed']),1)

    def test_control_endpoint_rejects_missing_token(self):
        with self.assertRaises(HTTPError) as context:
            urlopen('http://127.0.0.1:'+str(self.control.server.server_port)+'/control')
        self.assertEqual(context.exception.code,400)
        context.exception.read();context.exception.close()

    def test_archive_rejects_mutated_saved_source(self):
        profile=synthetic_profile(self.root/'profile','simulation')
        agent=Agent(profile)
        try:
            output=Path(agent.profile['output_root']);session=output/('capture-'+self.metadata['session_id'])
            secondary=Control(session,self.metadata)
            try:
                episode=session/'raw'/'episode';raw_episode(episode)
                secondary.created(episode);secondary.saved(episode)
                event=secondary.status()['completed'][0]
                (episode/'image.png').write_bytes(png(2))
                agent._archive(event)
                self.assertEqual(agent.archives[event['id']]['state'],'failed')
                self.assertIn('原始文件发生变化',agent.archives[event['id']]['error'])
                (episode/'image.png').write_bytes(png(1))
                agent.archive(event['id'],retry=True)
                wait_until(lambda:agent.archives[event['id']]['state']=='ready')
            finally:secondary.close()
        finally:agent.close()

    def test_ssh_uses_alias_and_quotes_remote_paths(self):
        argv=ssh_command('gpu-host','/opt/中文 env/bin/python',['-m','robot_pipeline.capture.agent','--profile-directory','/data/a b;echo x'])
        self.assertIn('BatchMode=yes',argv)
        self.assertIn("'/data/a b;echo x'",argv[-1])
        for alias in ('-oProxyCommand=bad','gpu;pwd','user@host','host name'):
            with self.assertRaises(ValueError):ssh_command(alias,'python3',[])

    def test_pinned_official_writer_queue_completion_and_timestamp_hook(self):
        source=Path(__file__).resolve().parents[1]/'evidence/capture_bridge_2026-10-31/writer-source.py'
        package=types.ModuleType('capture_writer_test');package.__path__=[]
        cv=types.ModuleType('cv2')
        def imwrite(name,image):Path(name).write_bytes(png(1));return True
        cv.imwrite=imwrite
        np=types.ModuleType('numpy');np.int16=int
        logger=types.ModuleType('logging_mp');logger.getLogger=logging.getLogger
        visual=types.ModuleType('capture_writer_test.rerun_visualizer');visual.RerunLogger=object
        replacements={'capture_writer_test':package,'cv2':cv,'numpy':np,'logging_mp':logger,'capture_writer_test.rerun_visualizer':visual}
        with patch.dict(sys.modules,replacements):
            spec=importlib.util.spec_from_file_location('capture_writer_test.episode_writer',source)
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            writer=instrument_writer(module.EpisodeWriter,self.control)(str(self.root/'official-raw'),rerun_log=False)
            try:
                self.assertTrue(writer.create_episode())
                parts={p:{'qpos':[.1]*7} for p in ('left_arm','right_arm','left_ee','right_ee')}
                writer.add_item(colors={'color_0':object()},states=parts,actions=parts)
                writer.item_data_queue.join()
                self.assertEqual(self.control.status()['completed'],[])
                writer.save_episode()
                done=wait_until(lambda:self.control.status()['completed'])
                raw=json.loads((Path(done[0]['path'])/'data.json').read_text())
                self.assertTrue(raw['info']['capture_timestamp_semantics'].startswith('host_enqueue'))
                self.assertIn('timestamp',raw['data'][0]);self.assertEqual(len(raw['data']),1)
            finally:writer.close()

    def test_pipe_node_launch_and_stop_owned_process(self):
        peer=Peer([sys.executable,'-u','-m','robot_pipeline.capture.agent','--node'])
        try:
            ident='d'*32
            payload={'argv':[sys.executable,'-u','-c','import time; print("node software test",flush=True); time.sleep(60)']}
            first=peer.call('launch',payload,request_id=ident)
            again=peer.call('launch',payload,request_id=ident)
            self.assertEqual(first['pid'],again['pid'])
            self.assertTrue(peer.call('status')['running'])
            self.assertFalse(peer.call('stop')['running'])
            self.assertFalse(peer.call('status')['running'])
        finally:peer.close()

class CaptureAPITests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='capture 用户路径 ')
        self.server=create_server(Path(self.temp.name)/'数据 workspace',0)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.base='http://127.0.0.1:'+str(self.server.server_port)
        self.token=self.get('/api/state')['csrf_token']
    def tearDown(self):
        self.server.shutdown();self.thread.join(timeout=3);self.server.server_close();self.temp.cleanup()
    def get(self,path):
        with urlopen(self.base+path,timeout=10) as response:return json.load(response)
    def post(self,path,payload,token=True):
        req=Request(self.base+path,data=json.dumps(payload,ensure_ascii=False).encode('utf-8'),headers={'Content-Type':'application/json',**({'X-Workbench-Token':self.token} if token else {})})
        try:
            with urlopen(req,timeout=15) as response:return json.load(response)
        except HTTPError as exc:
            exc.read();exc.close();raise
    def state(self):return self.get('/api/capture/state')
    def action(self,mode,action,**extra):
        op=self.post('/api/capture/action',{'mode':mode,'action':action,**extra})
        result=wait_until(lambda:next((o for o in self.state()['operations'] if o['id']==op['id'] and o['status'] not in ('queued','running')),None))
        self.assertEqual(result['status'],'accepted',result)
        return result
    def setup_mode(self,mode):
        self.post('/api/capture/trial',{'mode':mode});self.action(mode,'connect')
        self.action(mode,'start_services',operator_ready=True)
        wait_until(lambda:self.state()['runtime']['state']=='ready')
        self.action(mode,'follow');wait_until(lambda:self.state()['runtime']['state']=='following')
    def record(self,mode):
        self.action(mode,'record_start');wait_until(lambda:self.state()['runtime']['state']=='recording')
        time.sleep(.15);self.action(mode,'record_stop')
        wait_until(lambda:self.state()['runtime']['state']=='following')

    def test_both_modes_capture_auto_ingest_and_real_worker_quality(self):
        for mode in ('real','simulation'):
            with self.subTest(mode=mode):
                self.setup_mode(mode)
                self.record(mode)
                receipt=wait_until(lambda:next((e for e in self.state()['episodes'] if e['mode']==mode and e.get('quality_job_id')),None))
                complete=wait_until(lambda:next((e for e in self.state()['episodes'] if e['id']==receipt['id'] and e.get('quality_status') in ('succeeded','failed')),None))
                self.assertEqual(complete['quality_status'],'succeeded',complete)
                asset=next(a for a in self.get('/api/state')['assets'] if a['id']==receipt['asset_id'])
                self.assertEqual(asset['source_kind'],'self_capture' if mode=='real' else 'simulation')
                self.assertTrue(asset['synthetic']);self.assertFalse(asset['training_ready'])
                self.assertIn('合成采集样例',asset['name']);self.assertGreater(receipt['frames'],0)
                frames=self.get('/api/episodes')['episodes'];episode=next(e for e in frames if e['asset_id']==asset['id'])
                frame=self.get('/api/episodes/'+episode['id']+'/frames/0')
                self.assertEqual(len(frame['state']),28);self.assertEqual(len(frame['action']),28)
                self.assertIsNotNone(frame['timestamp'])
                self.action(mode,'stop_services');wait_until(lambda:self.state()['runtime']['state']=='stopped')
        self.assertEqual(len(self.get('/api/state')['assets']),2)
        self.assertEqual(len(self.get('/api/state')['jobs']),2)

    def test_multiple_episodes_repeated_commands_and_no_manual_import(self):
        mode='simulation';self.setup_mode(mode)
        self.action(mode,'record_start');wait_until(lambda:self.state()['runtime']['state']=='recording')
        self.action(mode,'record_start')
        self.assertEqual(self.state()['runtime']['state'],'recording')
        self.action(mode,'record_stop');wait_until(lambda:self.state()['runtime']['state']=='following')
        self.action(mode,'record_stop')
        self.record(mode)
        wait_until(lambda:len([e for e in self.state()['episodes'] if e.get('quality_job_id')])==2)
        time.sleep(.5)
        self.assertEqual(len(self.get('/api/state')['assets']),2)
        self.assertEqual(len(self.get('/api/state')['jobs']),2)

    def test_no_token_and_illegal_transition_rejected(self):
        with self.assertRaises(HTTPError) as context:self.post('/api/capture/trial',{'mode':'real'},token=False)
        self.assertEqual(context.exception.code,403)
        self.post('/api/capture/trial',{'mode':'simulation'});self.action('simulation','connect')
        op=self.post('/api/capture/action',{'mode':'simulation','action':'record_start'})
        result=wait_until(lambda:next((o for o in self.state()['operations'] if o['id']==op['id'] and o['status']=='failed'),None))
        self.assertIn('尚未连接',result['error'])
        with self.assertRaises(HTTPError):self.post('/api/capture/action',{'mode':'simulation','action':'shell','argv':['bad']})

    def test_mode_and_config_changes_blocked_during_session(self):
        self.setup_mode('real')
        with self.assertRaises(HTTPError):self.post('/api/capture/trial',{'mode':'simulation'})
        self.action('real','record_start');wait_until(lambda:self.state()['runtime']['state']=='recording')
        op=self.post('/api/capture/action',{'mode':'real','action':'stop_services'})
        result=wait_until(lambda:next((o for o in self.state()['operations'] if o['id']==op['id'] and o['status']=='failed'),None))
        self.assertIn('停止录制',result['error'])
        self.assertEqual(self.state()['runtime']['state'],'recording')

    def test_prepare_combines_connection_and_start_and_outcome_is_visible(self):
        self.post('/api/capture/trial',{'mode':'simulation'})
        self.action('simulation','prepare',operator_ready=True)
        wait_until(lambda:self.state()['runtime']['state']=='ready')
        self.action('simulation','follow');wait_until(lambda:self.state()['runtime']['state']=='following')
        self.record('simulation')
        receipt=wait_until(lambda:next((e for e in self.state()['episodes'] if e.get('data_episode_id')),None))
        self.post('/api/episodes/'+receipt['data_episode_id']+'/annotation',{'result':'success','revision':0})
        self.assertEqual(self.state()['episodes'][0]['annotation']['result'],'success')

    def test_lost_record_ack_reconciles_without_repeating_toggle(self):
        self.setup_mode('simulation');manager=self.server.workbench.capture_manager
        original=manager.peer.call
        def lost(action,*args,**kwargs):
            result=original(action,*args,**kwargs)
            if action=='record_start':raise TimeoutError('injected lost acknowledgement')
            return result
        manager.peer.call=lost
        op=self.post('/api/capture/action',{'mode':'simulation','action':'record_start'})
        observed=wait_until(lambda:next((o for o in self.state()['operations'] if o['id']==op['id'] and o['status']=='observed'),None))
        self.assertEqual(observed['result']['actual_state'],'recording')
        self.assertEqual(self.state()['runtime']['state'],'recording')
        self.assertIsNone(self.state()['last_error'])
        manager.peer.call=original;self.action('simulation','record_stop')

    def test_interrupted_transfer_is_actionable_after_restart(self):
        app=self.server.workbench
        app.store.put('capture_episode',{'id':'b'*32,'episode_id':'c'*32,'session_id':'a'*32,'status':'transferring','mode':'simulation','created_at':'2026-10-31','error':None})
        # Recovery logic is exercised in a second isolated workspace to avoid opening the same lock twice.
        from robot_pipeline.workbench.service import Workbench
        target=Path(self.temp.name)/'restart workspace'
        other=Workbench(target)
        other.store.put('capture_episode',{'id':'b'*32,'status':'registering','mode':'simulation','created_at':'2026-10-31'})
        other.close()
        resumed=Workbench(target)
        try:
            item=resumed.store.get('capture_episode','b'*32)
            self.assertEqual(item['status'],'failed');self.assertIn('重试',item['error'])
        finally:resumed.close()

if __name__=='__main__':unittest.main()
