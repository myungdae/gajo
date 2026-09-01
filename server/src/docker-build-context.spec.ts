import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('server Docker build context', () => {
  it('excludes all private maintenance artifacts from the server context', () => {
    const serverRoot = resolve(__dirname, '..');
    const rules = readFileSync(resolve(serverRoot, '.dockerignore'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    expect(rules).toContain('.maintenance-private/');
    expect(rules).not.toContain('!.maintenance-private/');
  });

  it('keeps the fixed maintenance script paths unchanged', () => {
    const serverRoot = resolve(__dirname, '..');
    const packageJson = JSON.parse(
      readFileSync(resolve(serverRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['receipt32:capture']).toBe(
      'node scripts/receipt32-capture.mjs',
    );
    expect(packageJson.scripts['receipt32:core-align']).toBe(
      'node scripts/receipt32-core-align.mjs',
    );
    expect(packageJson.scripts['receipt32:restore']).toBe(
      'node scripts/receipt32-restore.mjs',
    );
  });
});
