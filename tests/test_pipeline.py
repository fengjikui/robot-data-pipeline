import copy,json,tempfile,unittest
from pathlib import Path
import numpy as np
from PIL import Image
from robot_pipeline.core import validate_raw,export_raw,conversion_plan,load_numeric
from robot_pipeline.learning import train,predict
from robot_pipeline.render import name_to_mjcf
ROOT=Path(__file__).resolve().parents[1]
class RawTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.path=self.root/'data.json'
        x=json.loads((ROOT/'examples/raw/schema_fixture/episode_0000/data.json').read_text());self.obj=x
        for row in x['data']:
            for rel in row['colors'].values():
                p=self.root/rel;p.parent.mkdir(exist_ok=True);Image.new('RGB',(640,480)).save(p)
        self.save()
    def tearDown(self):self.tmp.cleanup()
    def save(self):self.path.write_text(json.dumps(self.obj))
    def test_valid_but_sync_unverified(self):
        q=validate_raw(self.path);self.assertTrue(q['valid']);self.assertTrue(any('synchronization' in w for w in q['warnings']))
    def test_missing_camera(self):
        del self.obj['data'][1]['colors']['color_1'];self.save();self.assertFalse(validate_raw(self.path)['valid'])
    def test_nonfinite_joint(self):
        self.obj['data'][0]['states']['left_arm']['qpos'][0]=float('nan');self.save();self.assertFalse(validate_raw(self.path)['valid'])
    def test_path_escape(self):
        self.obj['data'][0]['colors']['color_0']='../outside.jpg';self.save();self.assertFalse(validate_raw(self.path)['valid'])
    def test_corrupt_image(self):
        (self.root/self.obj['data'][0]['colors']['color_0']).write_bytes(b'not a jpeg');self.assertFalse(validate_raw(self.path)['valid'])
    def test_bad_indices(self):
        self.obj['data'][0]['idx']=9;self.save();self.assertFalse(validate_raw(self.path)['valid'])
    def test_export_preserves_action(self):
        out=self.root/'out.npz';export_raw(self.path,out);x=np.load(out);self.assertEqual(x['state'].shape,(6,28));self.assertAlmostEqual(float(x['action'][0,0]),.01,places=6)
        self.assertFalse(json.loads(out.with_suffix('.contract.json').read_text())['is_lerobot_dataset'])
        with self.assertRaises(FileExistsError):export_raw(self.path,out)
    def test_plan_has_no_execution(self):
        p=conversion_plan(self.root,'report/test');self.assertFalse(p['executed']);self.assertIn('--dataset-config.image-writer-processes',p['command_argv'])
    def test_mapping(self):
        self.assertEqual(name_to_mjcf('kLeftHandThumb0'),'left_hand_thumb_0_joint');self.assertEqual(name_to_mjcf('kRightWristYaw'),'right_wrist_yaw_joint')
class LearningTests(unittest.TestCase):
    def test_episode_splits_and_training_reload(self):
        import pyarrow as pa,pyarrow.parquet as pq
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'input.parquet';rng=np.random.default_rng(1);s=rng.normal(0,.1,(240,28));a=s+.02
            pq.write_table(pa.table({'observation.state':s.tolist(),'action':a.tolist(),'episode_index':np.repeat(np.arange(8),30),'frame_index':np.tile(np.arange(30),8),'timestamp':np.tile(np.arange(30)/30,8)}),path)
            report=train(path,Path(td)/'train',8);metrics=report['metrics'];sets=[set(metrics[k]['episodes']) for k in ['train','validation','test']]
            self.assertFalse(sets[0]&sets[1]);self.assertFalse(sets[0]&sets[2]);self.assertLess(metrics['test']['bc_rmse_rad'],.001)
            got=predict(Path(td)/'train/policy.npz',s[:1]);self.assertTrue(np.isfinite(got).all())
if __name__=='__main__':unittest.main()
