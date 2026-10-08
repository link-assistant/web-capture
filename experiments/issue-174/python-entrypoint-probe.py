"""Run npm's actual Python example command in an isolated locked project."""
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import tempfile
import threading
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[2]
fixture = runpy.run_path(str(ROOT / 'tests/python/test_examples.py'))
server = ThreadingHTTPServer(('127.0.0.1', 0), fixture['Handler'])
thread = threading.Thread(target=server.serve_forever)
thread.start()
try:
    with tempfile.TemporaryDirectory(prefix='web-capture-python-entrypoint-') as directory:
        project = Path(directory)
        for filename in ['pyproject.toml', 'uv.lock', '.python-version']:
            shutil.copyfile(ROOT / filename, project / filename)
        (project / '.venv').symlink_to(ROOT / '.venv', target_is_directory=True)
        shutil.copytree(ROOT / 'js/examples/python', project / 'js/examples/python')
        manifest = json.loads((ROOT / 'js/package.json').read_text())
        (project / 'js/package.json').write_text(json.dumps({
            'private': True,
            'scripts': {'examples:python': manifest['scripts']['examples:python']},
        }))
        subprocess.run(['npm', 'run', 'examples:python'], cwd=project / 'js', check=True,
                       env={**os.environ, 'WEB_CAPTURE_URL': f'http://127.0.0.1:{server.server_port}'})
        examples = project / 'js/examples/python'
        assert 'café' in (examples / 'downloaded.html').read_text()
        assert 'café' in (examples / 'downloaded.md').read_text()
        assert (examples / 'downloaded.png').read_bytes() == fixture['PNG']
        print('The npm entrypoint uses the locked Python project and downloads all outputs.')
finally:
    server.shutdown()
    thread.join()
    server.server_close()
