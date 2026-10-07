import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test.each(['js', 'rust'])(
  '%s Docker build fails when every browser package installation attempt fails',
  (implementation) => {
    const dockerfile = readFileSync(
      new globalThis.URL(
        `../../../${implementation}/Dockerfile`,
        import.meta.url
      ),
      'utf8'
    );
    const loop = dockerfile.match(/for i in 1 2 3; do[\s\S]*?done/)[0];
    // Execute only the finite retry loop; stub installation and waiting.
    const result = spawnSync(
      'bash',
      [
        '-c',
        `
      apt-get() { printf '%s\\n' "$1"; [ "$1" = update ]; }
      sleep() { return 0; }
      ${loop}
    `,
      ],
      { encoding: 'utf8' }
    );
    expect(result.stdout.match(/^install$/gm)).toHaveLength(3);
    expect(result.status).toBe(1);
  }
);
