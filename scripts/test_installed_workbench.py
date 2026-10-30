"""Real wheel installation smoke test, used unchanged on all three CI systems."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import venv

ROOT = Path(__file__).resolve().parents[1]
SMOKE = r'''
import io, json, shutil, threading, time, zipfile
from importlib.resources import files
from pathlib import Path
from urllib.request import Request, urlopen
from robot_pipeline.workbench.http import create_server

assert files('robot_pipeline.workbench').joinpath('static/index.html').is_file()
class SmokePicker:
    def choose(self, initial_path=None):
        return {'cancelled': False, 'path': str(Path.cwd() / 'picker 外部数据 spaces'), 'backend': 'injected smoke contract'}
    def close(self): pass
server = create_server(Path.cwd() / '数据 workspace & spaces', 0, directory_picker=SmokePicker())
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
base = 'http://127.0.0.1:' + str(server.server_port)
try:
    def get(path, mime=None):
        with urlopen(base + path, timeout=10) as response:
            if mime:
                assert response.headers.get_content_type() == mime, response.headers
            return response.read()
    state = json.loads(get('/api/state'))
    assert not state['assets'] and not state['jobs'], 'fresh workspace must be empty'
    assert b'app.js' in get('/', 'text/html')
    assert len(get('/app.js', 'text/javascript')) > 500
    assert len(get('/styles.css', 'text/css')) > 500
    assert len(get('/path-picker.js', 'text/javascript')) > 500
    assert len(get('/workbench.js', 'text/javascript')) > 500
    assert len(get('/workbench.css', 'text/css')) > 500
    assert len(get('/preparation.js', 'text/javascript')) > 500
    assert len(get('/preparation.css', 'text/css')) > 500
    def post(path, payload):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        request = Request(base + path, data=data, headers={
            'Content-Type': 'application/json',
            'X-Workbench-Token': state['csrf_token'],
        })
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    asset = post('/api/demo', {})
    assert asset['synthetic'] is True
    source = Path.cwd() / 'picker 外部数据 spaces'
    shutil.copytree(server.workbench.workspace / asset['path'], source)
    choice = post('/api/paths/pick', {'initial_path': str(source)})
    assert choice['cancelled'] is False and choice['path'] == str(source), choice
    asset = post('/api/assets/import', {'path': choice['path'], 'name': 'Picked fixture', 'source_kind': 'self_capture', '_synthetic': True, 'embodiment': 'SYNTHETIC_28D', 'task': 'SYNTHETIC picker smoke test', 'source_reference': 'generated installation fixture'})
    post('/api/project', {'asset_id': asset['id']})
    post('/api/capture/config', {'host': 'smoke-host', 'receive_directory': str(source)})
    job = post('/api/jobs', {'asset_id': asset['id'], 'stage': 'check_export'})
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        detail = json.loads(get('/api/jobs/' + job['id']))
        if detail['job']['status'] not in ('queued', 'running', 'cancelling'):
            break
        time.sleep(.05)
    assert detail['job']['status'] == 'succeeded', detail
    result = detail['result']
    assert result['training_ready'] is False
    assert result['contract']['is_lerobot_dataset'] is False
    assert result['contract']['provenance']['source_reference'] == 'generated installation fixture'
    assert detail['input']['project']['asset_id'] == asset['id']
    assert json.loads(get('/api/state'))['capture']['host'] == 'smoke-host'
    for artifact in result['artifacts']:
        assert get(artifact['url']), artifact
    # A genuinely distinct second source tests the installed episode and preparation APIs.
    source_b = Path.cwd() / '仿真 synthetic source'
    shutil.copytree(source, source_b)
    raw = json.loads((source_b / 'data.json').read_text(encoding='utf-8'))
    for row in raw['data']:
        for block in ('states', 'actions'):
            for part in row[block].values():
                part['qpos'] = [value + .2 for value in part['qpos']]
    (source_b / 'data.json').write_text(json.dumps(raw), encoding='utf-8')
    other = post('/api/assets/import', {'path': str(source_b), 'name': 'Synthetic simulation fixture', 'source_kind': 'simulation', '_synthetic': True, 'embodiment': 'SYNTHETIC_28D', 'task': asset['task']})
    episodes = json.loads(get('/api/episodes'))['episodes']
    first = next(e for e in episodes if e['asset_id'] == asset['id'])
    second = next(e for e in episodes if e['asset_id'] == other['id'])
    frame = json.loads(get('/api/episodes/' + first['id'] + '/frames/1'))
    assert frame['index'] == 1 and len(frame['state']) == len(frame['action']) == 28
    assert get(frame['images'][0]['url'])
    post('/api/episodes/' + first['id'] + '/annotation', {'result': 'success', 'note': 'SYNTHETIC installation test'})
    draft = post('/api/datasets/draft', {
        'name': '安装验证训练选择',
        'items': [{'episode_id': first['id'], 'start_frame': 1, 'end_frame': 6}, {'episode_id': second['id'], 'start_frame': 2, 'end_frame': 9}],
        'split': {'train': 100, 'validation': 0, 'test': 0, 'seed': 42},
        'sampling': {'mode': 'weighted', 'weights': {'self_capture': .5, 'simulation': .5}},
    })
    frozen = post('/api/datasets/' + draft['id'] + '/confirm', {'revision': draft['revision']})
    assert frozen['status'] == 'confirmed'
    prepared = post('/api/datasets/' + draft['id'] + '/build', {})
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        prepared_detail = json.loads(get('/api/jobs/' + prepared['id']))
        if prepared_detail['job']['status'] not in ('queued', 'running', 'cancelling'):
            break
        time.sleep(.05)
    assert prepared_detail['job']['status'] == 'succeeded', prepared_detail
    prepared_result = prepared_detail['result']
    assert prepared_result['reader_check']['valid'] is True
    assert prepared_result['contract']['is_lerobot_dataset'] is False
    package = next(a for a in prepared_result['artifacts'] if a['name'].endswith('.zip'))
    with zipfile.ZipFile(io.BytesIO(get(package['url']))) as portable:
        assert portable.testzip() is None
        assert any(name.endswith('records.jsonl') for name in portable.namelist())
        assert any(name.endswith('.png') for name in portable.namelist())
    print('Installed wheel: empty UI + synthetic import + worker QC/export + episode preview + confirmed portable preparation PASS')
finally:
    server.shutdown()
    thread.join(timeout=5)
    server.server_close()
'''


def run(args, **kwargs):
    completed = subprocess.run(args, check=True, encoding='utf-8', errors='replace', **kwargs)
    return completed


def main():
    wheels = list((ROOT / 'dist').glob('robot_data_pipeline-*.whl'))
    if len(wheels) != 1:
        raise SystemExit('Build exactly one wheel in dist before this test')
    with tempfile.TemporaryDirectory(prefix='robot wheel 中文 ') as folder:
        root = Path(folder)
        environment = root / 'clean venv'
        venv.EnvBuilder(with_pip=True).create(environment)
        python = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        env = os.environ.copy()
        env.pop('PYTHONPATH', None)
        env.update(PYTHONUTF8='1', PYTHONIOENCODING='utf-8')
        run([str(python), '-m', 'pip', 'install', '--no-index', '--no-deps', str(wheels[0])], cwd=root, env=env)
        run([str(python), '-I', '-m', 'robot_pipeline.workbench', '--help'], cwd=root, env=env)
        run([str(python), '-I', '-c', SMOKE], cwd=root, env=env)


if __name__ == '__main__':
    main()
