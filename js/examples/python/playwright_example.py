import requests
import os

base_url = 'http://localhost:3000'
target_url = 'https://example.com'

# Create output directory if it doesn't exist
os.makedirs('output', exist_ok=True)

print('Fetching HTML using Playwright engine...')
html_response = requests.get(f'{base_url}/html', params={'url': target_url, 'engine': 'playwright'})
with open('output/playwright_html.html', 'w') as f:
    f.write(html_response.text)
print('HTML saved to output/playwright_html.html')

print('Fetching screenshot using Playwright engine...')
image_response = requests.get(f'{base_url}/image', params={'url': target_url, 'engine': 'playwright'})
with open('output/playwright_screenshot.png', 'wb') as f:
    f.write(image_response.content)
print('Screenshot saved to output/playwright_screenshot.png')

print('Done! Both requests used Playwright engine.')
