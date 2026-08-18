import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextSummary } from './contextSummary.ts';

test('explicit multiple Okcheon interests take visitor-facing priority over derived goals', () => {
  const rows = buildContextSummary({
    companions: [{ relationship: 'parent', healthConditions: [] }], walkingLevel: 'LOW', transportMode: 'CAR',
    activityPreferences: ['NATURE', 'DAECHEONG_LAKE', 'TRADITIONAL_CULTURE'], wellnessGoals: ['stressRelief', 'restAndRecovery'],
  });
  assert.deepEqual(rows.map(({ label, value }) => ({ label, value })), [
    { label: '동반', value: '부모님' }, { label: '보행', value: '짧은 보행 고려' }, { label: '이동', value: '자동차' },
    { label: '관심', value: '자연·산책 · 대청호 · 전통문화체험' },
  ]);
  assert.equal(rows.some(row => /스트레스 완화|편안한 휴식/.test(row.value)), false);
});

test('unknown companion is omitted while derived goals remain a fallback', () => {
  const rows = buildContextSummary({ wellnessGoals: ['stressRelief'] });
  assert.equal(rows.some(row => row.key === 'companion'), false);
  assert.deepEqual(rows.at(-1), { key: 'style', icon: '🌿', label: '여행 방식', value: '스트레스 완화' });
});

test('Muan explicit PLAN interests remain visible instead of derived semantics',()=>{const rows=buildContextSummary({companions:[{relationship:'parent',healthConditions:[]}],walkingLevel:'LOW',transportMode:'CAR',activityPreferences:['LOTUS_ECOLOGY','NATURE','FOOD','REST_AND_RECOVERY'],wellnessGoals:['stressRelief','seniorFriendlyTrip']});assert.equal(rows.find(row=>row.key==='style')?.value,'연꽃·생태 · 자연·산책 · 맛집 · 편안한 휴식');assert.equal(rows.some(row=>row.value.includes('스트레스 완화')),false)});
test('Gyeryong explicit PLAN interests remain visible in visitor order',()=>{const rows=buildContextSummary({companions:[{relationship:'parent',healthConditions:[]}],walkingLevel:'LOW',transportMode:'CAR',activityPreferences:['MILITARY_CULTURE_HISTORY','FESTIVAL_EVENT','FOOD','REST_AND_RECOVERY'],wellnessGoals:['stressRelief']});assert.equal(rows.find(row=>row.key==='style')?.value,'군문화·역사 · 축제·행사 · 맛집 · 편안한 휴식');assert.equal(rows.some(row=>row.value.includes('스트레스 완화')),false)});
test('Hapcheon explicit lake and accommodation interests remain visible in visitor order',()=>{const rows=buildContextSummary({companions:[{relationship:'family',healthConditions:[]}],walkingLevel:'LOW',transportMode:'CAR',activityPreferences:['HAPCHEON_LAKE','NATURE','FOOD','ACCOMMODATION','REST_AND_RECOVERY'],wellnessGoals:['stressRelief']});assert.equal(rows.find(row=>row.key==='style')?.value,'합천호·호수 · 자연·산책 · 맛집 · 숙박 · 편안한 휴식');assert.equal(rows.some(row=>row.value.includes('스트레스 완화')),false)});
