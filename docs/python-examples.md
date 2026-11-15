# web-capture-python-examples

Python HTTP client examples for [web-capture](https://github.com/link-assistant/web-capture).
Python 3.14 or later is required. The first public version is **0.1.0**;
`0.0.0` was a development placeholder.

The package connects to a running JavaScript or Rust web-capture HTTP service.
Start that service separately using the [repository quick start](https://github.com/link-assistant/web-capture#quick-start).

After the first release is published:

```bash
python -m pip install web-capture-python-examples
python -m web_capture_python_examples.html_download https://example.com
python -m web_capture_python_examples.markdown_download https://example.com
python -m web_capture_python_examples.image_download https://example.com
python -m web_capture_python_examples.playwright_example https://example.com
```

Set `WEB_CAPTURE_URL` to override `http://localhost:3000`. Downloads are saved
in the current directory (`downloaded.html`, `downloaded.md`, `downloaded.png`,
or `output/` for the Playwright example), so the installed package need not be writable.
The Playwright example selects the server's browser engine; it needs no local browser.
The source scripts in `js/examples/python/` remain directly runnable.

The shared client is also importable:

```python
from web_capture_python_examples import capture

response = capture('markdown', 'https://example.com')
print(response.text)
```

Requests have a 30-second timeout and propagate HTTP and connection errors.
See [the release instructions](https://github.com/link-assistant/web-capture/blob/main/docs/releases/python-trusted-publishing.md)
for pending-publisher configuration and publication status.
