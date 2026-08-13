import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContextSummary } from '../src/utils/contextSummary.ts';

test('renders persisted health and expanded walking evidence', () => {
  const rows = buildContextSummary({ healthConditions: ['http://example.test/gajo#kneePain'], expandedConditions: ['http://example.test/gajo#shortWalkingDistance'] });
  assert.equal(rows.find(row => row.key === 'walking')?.value, '무릎 불편 · 짧은 보행 고려');
});

test('renders explicit structured companion, transport and stay facts', () => {
  const rows = buildContextSummary({ transportMode: 'CAR', stayUntil: '17:00', raw: { input: { companions: [{ age: 78, relationship: 'mother', healthConditions: [] }] } } });
  assert.equal(rows.find(row => row.key === 'companion')?.value, '78세 어머니');
  assert.equal(rows.find(row => row.key === 'transport')?.value, '자동차');
  assert.equal(rows.find(row => row.key === 'stay')?.value, '오후 5시까지');
});

test('does not invent structured facts from raw natural-language text', () => {
  assert.deepEqual(buildContextSummary({ rawMessage: '78세 어머니와 자동차로 오후 5시까지 머물 예정입니다.' }), []);
});

test('hides unknown internal enum values', () => {
  assert.deepEqual(buildContextSummary({ transportMode: 'SOME_INTERNAL_VALUE', wellnessGoals: ['unknownGoal'] }), []);
});

test('renders all structured facts from a hydrated demo context', () => {
  const rows = buildContextSummary({
    companions: [{ age: 78, relationship: 'mother', healthConditions: ['kneePain'] }],
    healthConditions: ['http://example.test/gajo#kneePain'],
    expandedConditions: ['http://example.test/gajo#shortWalkingDistance'],
    transportMode: 'CAR', stayUntil: '17:00', walkingLevel: 'LOW',
    wellnessGoals: ['http://example.test/gajo#restAndRecovery'],
  });
  expectRows(rows);
});

function expectRows(rows: ReturnType<typeof buildContextSummary>) {
  assert.equal(rows.find(row => row.key === 'companion')?.value, '78세 어머니');
  assert.equal(rows.find(row => row.key === 'walking')?.value, '무릎 불편 · 짧은 보행 고려');
  assert.equal(rows.find(row => row.key === 'transport')?.value, '자동차');
  assert.equal(rows.find(row => row.key === 'stay')?.value, '오후 5시까지');
  assert.equal(rows.find(row => row.key === 'style')?.value, '편안한 휴식');
}
