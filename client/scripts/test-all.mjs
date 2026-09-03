import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = readdirSync('src', {recursive:true})
  .filter(path=>/\.test\.(ts|mjs)$/.test(path)).sort().map(path=>`src/${path}`);
if (!tests.length) throw new Error('No client tests discovered');
const result = spawnSync(process.execPath,['--experimental-strip-types','--test',...tests],{stdio:'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
