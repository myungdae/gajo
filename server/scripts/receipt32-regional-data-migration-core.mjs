import { randomUUID } from 'node:crypto';

export const COLLECTION = 'regionaldatarecords';
export const REGION_ID = 'hapcheon';
export const GARDEN_CANONICAL =
  'https://hapcheon.example/ontology#hapcheonGardenThemePark';

export const TARGETS = [
  {
    canonicalEntityId:
      'https://hapcheon.example/ontology#hapcheonVideoThemePark',
    candidateUrns: ['urn:regional:hapcheon:hapcheon-video-theme-park'],
    displayName: '합천 영상테마파크',
    aliases: ['합천영상테마파크', '영상테마파크'],
    officialUrls: ['https://data.visitkorea.or.kr/resource/2469441'],
    entityType: 'ATTRACTION',
    category: 'TOURISM_CULTURE',
    tags: ['TOURISM_NATURE', 'FAMILY_TRIP', 'ACTIVITY'],
    address: '경상남도 합천군 용주면 합천호수로 757',
    phone: '055-930-8633',
    latitude: 35.5484940723,
    longitude: 128.0730785888,
    shortDescription:
      '시대물 영화와 드라마 촬영 세트를 둘러보는 합천의 영상문화 관광지입니다.',
    source: {
      sourceType: 'KTO',
      sourceName: '한국관광공사 관광정보',
      sourceUrl: 'https://data.visitkorea.or.kr/resource/2469441',
      verifiedAt: '2026-08-19',
    },
    lastVerifiedAt: '2026-08-19',
    verificationStatus: 'VERIFIED',
  },
  {
    canonicalEntityId:
      'https://hapcheon.example/ontology#hwangmaesanSilverGrassFestival',
    candidateUrns: ['urn:regional:hapcheon:hwangmaesan-silver-grass-festival'],
    displayName: '황매산 억새축제',
    aliases: ['황매산억새축제'],
    officialUrls: [
      'https://www.hc.go.kr/_res/portal/data/pdf/h09773/2026_18.pdf',
    ],
    entityType: 'EVENT',
    category: 'FESTIVAL_EXHIBITION',
    tags: ['FESTIVAL_EXHIBITION', 'SEASONAL', 'AUTUMN'],
    season: 'AUTUMN',
    eventAvailability: 'UNKNOWN',
    accessNotice:
      '가을 축제이며 세부 개최일·시간·요금은 공식 일정 확인이 필요합니다.',
    address: '경상남도 합천군 가회면 황매산공원길 331',
    latitude: 35.4822804994,
    longitude: 127.9831021731,
    shortDescription:
      '황매산군립공원 일원에서 열리는 가을 억새축제입니다. 세부 일정은 공식 안내를 확인해야 합니다.',
    source: {
      sourceType: 'OFFICIAL_LOCAL_GOV',
      sourceName: '합천군 황매산 축제계획',
      sourceUrl: 'https://www.hc.go.kr/_res/portal/data/pdf/h09773/2026_18.pdf',
      verifiedAt: '2026-08-19',
    },
    lastVerifiedAt: '2026-08-19',
    verificationStatus: 'VERIFIED',
  },
];

const normalize = (value) =>
  typeof value === 'string'
    ? value
        .normalize('NFKC')
        .toLocaleLowerCase('ko-KR')
        .replace(/[^0-9a-z가-힣]/g, '')
    : '';

const values = (row, key) =>
  [row?.[key], row?.proposedFacts?.[key]].filter(Boolean);

const rowNames = (row) =>
  [
    ...values(row, 'displayName'),
    ...(row.aliases || []),
    ...(row.proposedFacts?.aliases || []),
  ].map(normalize);

const rowUrls = (row) =>
  [
    row.source?.sourceUrl,
    row.proposedFacts?.sourceUrl,
    row.websiteUrl,
    row.proposedFacts?.websiteUrl,
    row.proposedFacts?.publicInformationUrl,
  ].filter(Boolean);

export function compareRow(row, target) {
  const names = new Set(rowNames(row));
  const targetNames = [target.displayName, ...target.aliases].map(normalize);
  const urls = new Set(rowUrls(row));
  const canonical = row.canonicalEntityId === target.canonicalEntityId;
  const candidateUrn = target.candidateUrns.includes(row.canonicalEntityId);
  const exactName = names.has(normalize(target.displayName));
  const alias = targetNames.some((name) => names.has(name));
  const officialUrl = target.officialUrls.some((url) => urls.has(url));
  const address = values(row, 'address').some(
    (value) => normalize(value) === normalize(target.address),
  );
  const signals = {
    canonical,
    candidateUrn,
    exactName,
    alias,
    officialUrl,
    address,
  };
  const equivalent =
    canonical || candidateUrn || officialUrl || exactName || (alias && address);
  return { signals, equivalent };
}

const snapshot = (row) =>
  row && {
    _id: row._id,
    id: row.id,
    canonicalEntityId: row.canonicalEntityId,
    displayName: row.displayName,
    aliases: row.aliases || [],
    officialUrls: rowUrls(row),
    address: row.address,
    proposedFacts: row.proposedFacts,
  };

export function planMigration(rows) {
  const protectedGarden = rows.filter(
    (row) => row.canonicalEntityId === GARDEN_CANONICAL,
  );
  const plans = TARGETS.map((target) => {
    const comparisons = rows
      .map((row) => ({ row, ...compareRow(row, target) }))
      .filter((item) => item.equivalent);
    const protectedMatches = comparisons
      .filter((item) => item.row.canonicalEntityId === GARDEN_CANONICAL)
      .map((item) => ({ document: snapshot(item.row), signals: item.signals }));
    const candidates = comparisons.filter(
      (item) => item.row.canonicalEntityId !== GARDEN_CANONICAL,
    );
    if (candidates.length > 1)
      return {
        target,
        action: 'CONFLICT',
        reason: 'MULTIPLE_EQUIVALENT_DOCUMENTS',
        candidates: candidates.map((item) => ({
          document: snapshot(item.row),
          signals: item.signals,
        })),
        protectedMatches,
      };
    if (!candidates.length)
      return {
        target,
        action: 'CREATE',
        before: null,
        after: target.canonicalEntityId,
        protectedMatches,
      };
    const candidate = candidates[0];
    return {
      target,
      action:
        candidate.row.canonicalEntityId === target.canonicalEntityId
          ? 'ALREADY_ALIGNED'
          : 'ALIGN_CANONICAL',
      before: snapshot(candidate.row),
      after: {
        ...snapshot(candidate.row),
        canonicalEntityId: target.canonicalEntityId,
      },
      signals: candidate.signals,
      protectedMatches,
    };
  });
  const conflicts = plans.filter((plan) => plan.action === 'CONFLICT');
  return {
    mode: 'READ_ONLY_DRY_RUN',
    regionId: REGION_ID,
    collection: COLLECTION,
    protectedGarden: protectedGarden.map(snapshot),
    plans,
    safeToApply: conflicts.length === 0 && protectedGarden.length === 1,
    conflicts: conflicts.length,
  };
}

export function newDocument(target, now = new Date()) {
  return {
    id: `seed-${REGION_ID}-${target.canonicalEntityId.split('#').pop()}`,
    canonicalEntityId: target.canonicalEntityId,
    regionId: REGION_ID,
    displayName: target.displayName,
    aliases: target.aliases,
    entityType: target.entityType,
    category: target.category,
    tags: target.tags,
    address: target.address,
    latitude: target.latitude,
    longitude: target.longitude,
    phone: target.phone,
    shortDescription: target.shortDescription,
    season: target.season,
    eventAvailability: target.eventAvailability,
    accessNotice: target.accessNotice,
    source: target.source,
    lastVerifiedAt: target.lastVerifiedAt,
    verificationStatus: target.verificationStatus,
    lifecycleStatus: 'ACTIVE',
    auditTrail: [
      {
        action: 'RECEIPT32_CANONICAL_MIGRATION_CREATED',
        at: now.toISOString(),
        source: target.source,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export async function applyMigration(collection, plan) {
  if (!plan.safeToApply) throw new Error('Migration plan is not safe to apply');
  for (const item of plan.plans) {
    if (item.action === 'ALREADY_ALIGNED') continue;
    if (item.action === 'CREATE') {
      await collection.updateOne(
        {
          regionId: REGION_ID,
          canonicalEntityId: item.target.canonicalEntityId,
        },
        { $setOnInsert: newDocument(item.target) },
        { upsert: true },
      );
      continue;
    }
    if (item.action === 'ALIGN_CANONICAL') {
      const collision = await collection.countDocuments({
        regionId: REGION_ID,
        canonicalEntityId: item.target.canonicalEntityId,
      });
      if (collision) throw new Error('Canonical target appeared after dry-run');
      const result = await collection.updateOne(
        {
          _id: item.before._id,
          regionId: REGION_ID,
          canonicalEntityId: item.before.canonicalEntityId,
        },
        {
          $set: {
            canonicalEntityId: item.target.canonicalEntityId,
            updatedAt: new Date(),
          },
          $push: {
            auditTrail: {
              action: 'RECEIPT32_CANONICAL_IDENTITY_ALIGNED',
              at: new Date().toISOString(),
              source: item.target.source,
              changes: {
                before: item.before.canonicalEntityId,
                after: item.target.canonicalEntityId,
                migrationId: randomUUID(),
              },
            },
          },
        },
      );
      if (result.matchedCount !== 1)
        throw new Error('Canonical source changed after dry-run');
    }
  }
}

export async function postCheck(collection) {
  const identities = [
    GARDEN_CANONICAL,
    ...TARGETS.map((x) => x.canonicalEntityId),
  ];
  const counts = Object.fromEntries(
    await Promise.all(
      identities.map(async (canonicalEntityId) => [
        canonicalEntityId,
        await collection.countDocuments({
          regionId: REGION_ID,
          canonicalEntityId,
        }),
      ]),
    ),
  );
  return { counts, valid: Object.values(counts).every((count) => count === 1) };
}
