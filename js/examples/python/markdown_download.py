if __package__:
    from .capture_client import download_text
else:
    from capture_client import download_text

download_text('markdown', 'downloaded.md')
