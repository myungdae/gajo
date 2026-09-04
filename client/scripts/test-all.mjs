import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = ['src', 'tests'].flatMap(directory => readdirSync(directory, {recursive:true})
  .filter(path=>/\.test\.(ts|mjs)$/.test(path)).map(path=>`${directory}/${path}`)).sort();
if (!tests.length) throw new Error('No client tests discovered');
const result = spawnSync(process.execPath,['--experimental-strip-types','--test',...tests],{stdio:'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
