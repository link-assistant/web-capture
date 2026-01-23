import sys
import requests
import os

url = sys.argv[1] if len(sys.argv) > 1 else 'https://example.com'
endpoint = f'http://localhost:3000/image?url={url}'

response = requests.get(endpoint)
print('Status:', response.status_code)
print('Content-Type:', response.headers.get('content-type'))

# PNG signature: first 8 bytes
png_signature = b'\x89PNG\r\n\x1a\n'
if response.content[:8] == png_signature:
    output_path = os.path.join(os.path.dirname(__file__), 'downloaded.png')
    with open(output_path, 'wb') as f:
        f.write(response.content)
    print(f'Image saved to {output_path} (valid PNG)')
else:
    print('Response is not a valid PNG! First bytes:', response.content[:16]) 