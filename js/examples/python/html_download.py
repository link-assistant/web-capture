import sys
import requests
import os

url = sys.argv[1] if len(sys.argv) > 1 else 'https://example.com'
endpoint = f'http://localhost:3000/html?url={url}'

response = requests.get(endpoint)
response.raise_for_status()

output_path = os.path.join(os.path.dirname(__file__), 'downloaded.html')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(response.text)

print(f'HTML saved to {output_path}') 