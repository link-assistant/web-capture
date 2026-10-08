"""Shared request policy for the capture-service examples."""
import os
from pathlib import Path
import sys
import requests


def capture(kind, url=None, **options):
    if url is None:
        url = sys.argv[1] if len(sys.argv) > 1 else 'https://example.com'
    endpoint = os.environ.get('WEB_CAPTURE_URL', 'http://localhost:3000').rstrip('/')
    response = requests.get(f'{endpoint}/{kind}', params={'url': url, **options}, timeout=30)
    response.raise_for_status()
    return response


def download_text(kind, filename):
    output = Path(__file__).with_name(filename)
    output.write_text(capture(kind).text, encoding='utf-8')
    print(f'{kind.title()} saved to {output}')
