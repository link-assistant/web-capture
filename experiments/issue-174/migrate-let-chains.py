"""Apply Clippy's exact Rust 2024 suggestions from run 37741228883.

This is a one-time migration experiment against the recorded source positions.
"""

from pathlib import Path

locations = {
    'gdocs.rs': [776, 783, 919, 1087, 1307, 2245, 2468, 2469],
    'github.rs': [450], 'html.rs': [197], 'latex.rs': [66, 100],
    'markdown.rs': [352], 'metadata.rs': [123, 202, 205, 221, 295],
    'shared_dialog.rs': [330, 453, 454, 794], 'verify.rs': [349],
}

for filename, starts in locations.items():
    path = Path('rust/src') / filename
    lines = path.read_text().splitlines()
    for start in sorted(starts, reverse=True):
        outer = start - 1
        indentation = len(lines[outer]) - len(lines[outer].lstrip())
        assert 'if ' in lines[outer], (filename, start)
        header_end = outer
        while not lines[header_end].rstrip().endswith('{'):
            header_end += 1
        inner = header_end + 1
        assert lines[inner].lstrip().startswith('if '), (filename, start)
        end = inner + 1
        while lines[end] != ' ' * indentation + '}':
            end += 1
        assert lines[end - 1].strip() == '}', (filename, start)
        lines[header_end] = lines[header_end].rstrip()[:-1].rstrip()
        lines[inner] = ' ' * (indentation + 4) + '&& ' + lines[inner].lstrip()[3:]
        del lines[end]
    path.write_text('\n'.join(lines) + '\n')
