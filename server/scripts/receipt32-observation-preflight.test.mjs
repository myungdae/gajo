import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const script = new URL('./receipt32-observation-preflight.mjs', import.meta.url);
import { fileURLToPath } from 'node:url';
test('observation preflight with no arguments only prints usage', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(script)], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No apply mode/);
});
test('observation preflight refuses apply before connecting', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(script), '--apply'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /No apply mode/);
});
