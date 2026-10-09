"""One-off rewrite used for issue #177: port the template's checkout hardening.

- every actions/checkout gets `persist-credentials: false`, except jobs listed
  in PUSHING_JOBS, which push with the checkout token and keep it explicitly;
- each workflow gets read-only default permissions and silences git's
  "Using 'master' as the name for the initial branch" hint.

Usage: python3 experiments/issue-177/harden-workflows.py .github/workflows/*.yml
"""

import re
import sys

PUSHING_JOBS = {'release', 'instant-release'}
GIT_ENV = """  # Silences git's default-branch hint when actions/checkout runs `git init`.
  GIT_CONFIG_COUNT: '1'
  GIT_CONFIG_KEY_0: init.defaultBranch
  GIT_CONFIG_VALUE_0: main
"""
PUSH_COMMENT = (
    '          # This job pushes version commits with the checkout token.\n'
)


def harden(text):
    lines = text.splitlines(keepends=True)
    out = []
    job = None
    i = 0
    while i < len(lines):
        line = lines[i]
        match = re.match(r'^  ([a-z0-9-]+):\s*$', line)
        if match and out and any(l.startswith('jobs:') for l in out):
            job = match.group(1)
        checkout = re.match(r'^(\s*)- uses: actions/checkout@', line)
        if not checkout:
            out.append(line)
            i += 1
            continue
        indent = checkout.group(1) + '  '
        persist = job in PUSHING_JOBS
        out.append(line)
        i += 1
        if i < len(lines) and lines[i] == f'{indent}with:\n':
            out.append(lines[i])
            i += 1
            # Drop the redundant default token so the remaining options read alike.
            while i < len(lines) and lines[i].startswith(indent + '  '):
                if 'token: ${{ secrets.GITHUB_TOKEN }}' not in lines[i]:
                    out.append(lines[i])
                i += 1
        else:
            out.append(f'{indent}with:\n')
        if persist:
            out.append(PUSH_COMMENT.replace('          ', indent + '  '))
            out.append(f'{indent}  persist-credentials: true\n')
        else:
            out.append(f'{indent}  persist-credentials: false\n')
    text = ''.join(out)

    header = 'permissions:\n  contents: read\n\n'
    if re.search(r'^env:\n', text, re.M):
        text = re.sub(r'^env:\n', 'env:\n' + GIT_ENV, text, count=1, flags=re.M)
        anchor = re.search(r'^env:\n', text, re.M).start()
        text = text[:anchor] + header + text[anchor:]
    else:
        anchor = re.search(r'^(defaults|jobs):\n', text, re.M).start()
        text = text[:anchor] + header + 'env:\n' + GIT_ENV + '\n' + text[anchor:]
    return text


for path in sys.argv[1:]:
    with open(path) as handle:
        source = handle.read()
    with open(path, 'w') as handle:
        handle.write(harden(source))
