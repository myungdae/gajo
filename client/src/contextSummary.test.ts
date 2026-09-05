import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextSummary } from './utils/contextSummary.ts';

test('Korean understanding card never exposes companion relationship codes',()=>{
  const rows=buildContextSummary({companions:[{relationship:'partner'},{relationship:'friend'}]});
  assert.equal(rows.find(row=>row.key==='companion')?.value,'연인, 친구');
  assert.doesNotMatch(JSON.stringify(rows),/partner|friend/);
});
