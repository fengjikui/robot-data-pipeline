"""Focused domain tests for immutable selections and portable project readers."""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from robot_pipeline.workbench.preparation import PreparationConflict, build_prepared, read_prepared_records, sample_prepared
from robot_pipeline.workbench.service import Workbench

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP6sAAAAASUVORK5CYII=')


class PreparationDomainTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='preparation 中文 ')
        self.root = Path(self.temp.name)
        self.app = Workbench(self.root / 'workspace')

    def tearDown(self):
        self.app.close(); self.temp.cleanup()

    def source(self, name, *, offset=0, timestamp=True, invalid_last=False, kind='simulation', body=False):
        root = self.root / name; root.mkdir()
        (root / 'image.png').write_bytes(PNG)
        rows = []
        for index in range(6):
            states = {part: {'qpos': [offset + index / 100] * 7}
                      for part in ('left_arm', 'right_arm', 'left_ee', 'right_ee')}
            actions = {part: {'qpos': [offset + index / 100 + .1] * 7} for part in states}
            row = {'idx': index, 'states': states, 'actions': actions, 'colors': {'color_0': 'image.png'}}
            if body:
                row['states']['body']={'qpos':[0,0,0]};row['actions']['body']={'qpos':[.1,0,0]}
            if timestamp: row['timestamp'] = index / 30
            rows.append(row)
        if invalid_last: rows[-1]['states']['left_arm']['qpos'] = [None]
        (root / 'data.json').write_text(json.dumps({'info': {'synthetic': True, 'image': {'fps': 30}},
            'text': {'goal': '箱子测试 ' + name}, 'data': rows}), encoding='utf-8')
        return self.app.import_asset({'path': str(root), 'name': name, 'source_kind': kind,
            'embodiment': 'SYNTHETIC_28D', 'task': 'synthetic box', 'license': 'CC0 test'})

    def draft(self, items, **kwargs):
        return self.app.preparation.draft({'name': '训练输入', 'items': items,
            'split': {'train': 100, 'validation': 0, 'test': 0, 'seed': 42},
            'sampling': {'mode': 'natural'}, **kwargs})

    def confirm(self, draft):
        return self.app.preparation.confirm(draft['id'], {'revision': draft['revision']})

    def test_success_annotation_is_independent_of_structure_and_raw(self):
        asset = self.source('source')
        episode = self.app.preparation.episodes()[0]
        raw = (self.app.workspace / asset['path'] / 'data.json').read_bytes()
        self.assertTrue(asset['synthetic'])
        annotation = self.app.preparation.annotate(episode['id'], {'result': 'failure', 'note': '箱子掉落', 'revision': 0})
        self.assertEqual(annotation['revision'], 1)
        fresh = self.app.preparation.episode(episode['id'])
        self.assertTrue(fresh['quality']['valid'])
        self.assertEqual(fresh['annotation']['result'], 'failure')
        self.assertEqual((self.app.workspace / asset['path'] / 'data.json').read_bytes(), raw)
        with self.assertRaises(PreparationConflict):
            self.app.preparation.annotate(episode['id'], {'result': 'success', 'revision': 0})

    def test_mark_changed_after_preview_requires_resave_before_confirm(self):
        self.source('source'); episode = self.app.preparation.episodes()[0]
        draft = self.draft([{'episode_id': episode['id']}])
        self.app.preparation.annotate(episode['id'], {'result': 'success'})
        with self.assertRaises(PreparationConflict): self.confirm(draft)
        draft = self.draft(draft['items'], id=draft['id'], revision=draft['revision'])
        confirmed = self.confirm(draft)
        self.assertEqual(confirmed['manifest']['items'][0]['annotation']['result'], 'success')

    def test_valid_fragment_can_salvage_a_problem_elsewhere_in_episode(self):
        self.source('source', invalid_last=True)
        episode = self.app.preparation.episodes()[0]
        self.assertFalse(episode['quality']['valid'])
        draft = self.draft([{'episode_id': episode['id'], 'start_frame': 1, 'end_frame': 4, 'task': '抓取片段'}])
        self.assertFalse(draft['problems'])
        frozen = self.confirm(draft)
        result = build_prepared(self.app.workspace, frozen, self.root / 'prepared')
        self.assertEqual(result['frames'], 3)
        samples = list(read_prepared_records(self.root / 'prepared'))
        self.assertEqual([x['record']['source_frame_index'] for x in samples], [1, 2, 3])
        self.assertAlmostEqual(samples[0]['action'][0], .11)
        self.assertEqual(samples[0]['record']['task'], '抓取片段')

    def test_overlapping_and_invalid_ranges_do_not_silently_duplicate_data(self):
        self.source('source'); eid = self.app.preparation.episodes()[0]['id']
        with self.assertRaises(ValueError): self.draft([{'episode_id': eid, 'start_frame': 0, 'end_frame': 4}, {'episode_id': eid, 'start_frame': 3, 'end_frame': 5}])
        for value in (True, -1, 1.5):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.draft([{'episode_id': eid, 'start_frame': value, 'end_frame': 4}])

    def test_source_metadata_changes_after_confirmation_block_build(self):
        asset = self.source('source'); eid = self.app.preparation.episodes()[0]['id']
        frozen = self.confirm(self.draft([{'episode_id': eid}]))
        updated = dict(asset, embodiment='different hand')
        self.app.store.put('asset', updated)
        with self.assertRaisesRegex(ValueError, '元数据'):
            build_prepared(self.app.workspace, frozen, self.root / 'prepared')

    def test_one_parent_clips_remain_one_group_and_train_only_is_explicit(self):
        self.source('source'); eid = self.app.preparation.episodes()[0]['id']
        items = [{'episode_id': eid, 'start_frame': 0, 'end_frame': 3}, {'episode_id': eid, 'start_frame': 3, 'end_frame': 6}]
        draft = self.app.preparation.draft({'name': '分组', 'items': items})
        self.assertEqual(draft['summary']['group_count'], 1)
        self.assertTrue(draft['problems'])
        with self.assertRaises(ValueError): self.confirm(draft)
        all_train = self.draft(items)
        self.assertFalse(all_train['problems'])
        self.assertEqual(all_train['splits']['train']['clip_count'], 2)

    def test_body_fields_are_explicitly_declared_outside_project_contract(self):
        self.source('source', body=True);episode=self.app.preparation.episodes()[0]
        self.assertTrue(any('body' in text for text in episode['quality']['warnings']))
        frozen=self.confirm(self.draft([{'episode_id':episode['id']}]))
        result=build_prepared(self.app.workspace,frozen,self.root/'prepared')
        self.assertIn('body',result['contract']['omitted_raw_parts'])
        self.assertEqual(result['contract']['state_dim'],28)
        self.assertFalse(result['contract']['training_ready'])

    def test_standalone_reader_checks_package_and_weighted_sampling(self):
        self.source('real', kind='self_capture'); self.source('sim', offset=.3)
        items = [{'episode_id': e['id']} for e in self.app.preparation.episodes()]
        frozen = self.confirm(self.draft(items, sampling={'mode': 'weighted', 'weights': {'self_capture': 1, 'simulation': 0}}))
        output = self.root / 'portable'
        build_prepared(self.app.workspace, frozen, output)
        picked = sample_prepared(output, 40)
        self.assertEqual({x['source_kind'] for x in picked}, {'self_capture'})
        result = subprocess.run([sys.executable, '-I', str(output / 'reader.py'), str(output), '--draws', '8'],
                                cwd=self.root, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['valid'])
        with (output / 'records.jsonl').open('a') as handle: handle.write('{}\n')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            list(read_prepared_records(output))


if __name__ == '__main__': unittest.main()
