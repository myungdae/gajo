import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GARDEN_CANONICAL,
  TARGETS,
  newDocument,
  planMigration,
  postCheck,
} from './receipt32-regional-data-migration-core.mjs';

const row = (canonicalEntityId, displayName, extra = {}) => ({
  _id: extra._id || canonicalEntityId,
  id: `row-${displayName}`,
  regionId: 'hapcheon',
  canonicalEntityId,
  displayName,
  aliases: [],
  source: { sourceUrl: 'https://example.invalid' },
  ...extra,
});

const garden = () =>
  row(GARDEN_CANONICAL, '합천 정원테마파크', {
    aliases: ['합천영상테마파크'],
    address: '경상남도 합천군 용주면 합천호수로 777',
  });

test('default plan preserves garden and plans two creates when no equivalents exist', () => {
  const plan = planMigration([garden()]);
  assert.equal(plan.safeToApply, true);
  assert.deepEqual(
    plan.plans.map((item) => item.action),
    ['CREATE', 'CREATE'],
  );
  assert.equal(plan.protectedGarden.length, 1);
});

test('aligns one candidate URN and reports before and after', () => {
  const plan = planMigration([
    garden(),
    row('urn:regional:hapcheon:hapcheon-video-theme-park', '합천 영상테마파크'),
  ]);
  assert.equal(plan.plans[0].action, 'ALIGN_CANONICAL');
  assert.equal(
    plan.plans[0].before.canonicalEntityId,
    'urn:regional:hapcheon:hapcheon-video-theme-park',
  );
  assert.equal(
    plan.plans[0].after.canonicalEntityId,
    TARGETS[0].canonicalEntityId,
  );
});

test('fails closed when multiple equivalent documents exist', () => {
  const target = TARGETS[0];
  const plan = planMigration([
    garden(),
    row(target.canonicalEntityId, target.displayName),
    row('urn:regional:hapcheon:hapcheon-video-theme-park', target.displayName),
  ]);
  assert.equal(plan.safeToApply, false);
  assert.equal(plan.plans[0].action, 'CONFLICT');
});

test('festival creation keeps unknown schedule and creates no date time or fee', () => {
  const document = newDocument(TARGETS[1], new Date('2026-09-01T00:00:00Z'));
  assert.equal(document.eventAvailability, 'UNKNOWN');
  assert.match(document.accessNotice, /공식 일정 확인/);
  for (const field of ['date', 'startDate', 'endDate', 'time', 'fee'])
    assert.equal(document[field], undefined);
});

test('post-check requires exactly one of all three canonical documents', async () => {
  const counts = new Map([
    [GARDEN_CANONICAL, 1],
    [TARGETS[0].canonicalEntityId, 1],
    [TARGETS[1].canonicalEntityId, 1],
  ]);
  const collection = {
    countDocuments: async ({ canonicalEntityId }) =>
      counts.get(canonicalEntityId) || 0,
  };
  assert.equal((await postCheck(collection)).valid, true);
  counts.set(TARGETS[1].canonicalEntityId, 2);
  assert.equal((await postCheck(collection)).valid, false);
});
