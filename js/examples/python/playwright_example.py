import sys
from capture_client import capture
import os

target_url = sys.argv[1] if len(sys.argv) > 1 else 'https://example.com'

# Create output directory if it doesn't exist
os.makedirs('output', exist_ok=True)

print('Fetching HTML using Playwright engine...')
html_response = capture('html', target_url, engine='playwright')
with open('output/playwright_html.html', 'w', encoding='utf-8') as f:
    f.write(html_response.text)
print('HTML saved to output/playwright_html.html')

print('Fetching screenshot using Playwright engine...')
image_response = capture('image', target_url, engine='playwright')
with open('output/playwright_screenshot.png', 'wb') as f:
    f.write(image_response.content)
print('Screenshot saved to output/playwright_screenshot.png')

print('Done! Both requests used Playwright engine.')
