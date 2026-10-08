"""Exercise every requests example against a local capture-service fixture."""
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nKsAAAAASUVORK5CYII=")


class Handler(BaseHTTPRequestHandler):
    paths = []

    def do_GET(self):
        self.paths.append(self.path)
        if self.path.startswith("/image"):
            body, mime = PNG, "image/png"
        elif self.path.startswith("/markdown"):
            body, mime = "# café\n".encode(), "text/markdown; charset=utf-8"
        else:
            body, mime = "<h1>café</h1>".encode(), "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


class ExamplesTest(unittest.TestCase):
    def test_all_examples_download_correct_bytes_and_encoded_queries(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                env = {**os.environ, "WEB_CAPTURE_URL": f"http://127.0.0.1:{server.server_port}"}
                (Path(directory) / 'capture_client.py').write_text((ROOT / 'js/examples/python/capture_client.py').read_text())
                for script in sorted((ROOT / "js/examples/python").glob("*.py")):
                    if script.name == 'capture_client.py':
                        continue
                    with self.subTest(script=script.name):
                        # Copy only the examples so outputs stay outside the source tree.
                        target = Path(directory) / script.name
                        target.write_text(script.read_text())
                        result = subprocess.run([sys.executable, str(target), "https://example.test/?q=café&x=1"],
                                                cwd=directory, env=env, capture_output=True, check=True)
                        self.assertIn(b"saved", result.stdout.lower())
                self.assertEqual((Path(directory) / "downloaded.png").read_bytes(), PNG)
                self.assertIn("café", (Path(directory) / "downloaded.html").read_text())
                self.assertIn("café", (Path(directory) / "downloaded.md").read_text())
                self.assertEqual((Path(directory) / "output/playwright_screenshot.png").read_bytes(), PNG)
                self.assertTrue(all("url=https%3A%2F%2Fexample.test%2F%3Fq%3Dcaf%C3%A9%26x%3D1" in path
                                    for path in Handler.paths))
                self.assertTrue(any("engine=playwright" in path for path in Handler.paths))
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_request_failure_is_reported(self):
        import runpy
        import requests
        sys.path.insert(0, str(ROOT / 'js/examples/python'))
        self.addCleanup(sys.path.pop, 0)
        with patch("requests.get", side_effect=requests.ConnectionError("service unavailable")), \
             patch.object(sys, "argv", ["html_download.py"]):
            with self.assertRaises(requests.ConnectionError):
                runpy.run_path(str(ROOT / "js/examples/python/html_download.py"))


if __name__ == "__main__":
    unittest.main()
