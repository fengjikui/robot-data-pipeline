"""Real wheel installation smoke test, used unchanged on all three CI systems."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import venv

ROOT = Path(__file__).resolve().parents[1]
SMOKE = r'''
import json, threading, time
from importlib.resources import files
from pathlib import Path
from urllib.request import Request, urlopen
from robot_pipeline.workbench.http import create_server

assert files('robot_pipeline.workbench').joinpath('static/index.html').is_file()
server = create_server(Path.cwd() / '数据 workspace & spaces', 0)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
base = 'http://127.0.0.1:' + str(server.server_port)
try:
    def get(path):
        with urlopen(base + path, timeout=10) as response:
            return response.read()
    state = json.loads(get('/api/state'))
    assert not state['assets'] and not state['jobs'], 'fresh workspace must be empty'
    assert b'app.js' in get('/')
    assert len(get('/app.js')) > 500
    assert len(get('/styles.css')) > 500
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
    for artifact in result['artifacts']:
        assert get(artifact['url']), artifact
    print('Installed wheel: empty UI + synthetic import + real worker QC/export + artifacts PASS')
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
