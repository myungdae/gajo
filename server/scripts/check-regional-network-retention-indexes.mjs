import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const expected = [
  ['pilotevents', 'expiresAt_1'],
  ['partneractivities', 'expiresAt_1'],
  ['benefitredemptions', 'retentionExpiresAt_1'],
  ['tourismnetworkaggregates', 'expiresAt_1'],
];
const regions = [
  'gajo',
  'okcheon',
  'muan',
  'gyeryong',
  'hapcheon',
  'daejeon-junggu',
];

try {
  await mongoose.connect(uri, { autoIndex: false });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB unavailable');
  const collections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (row) => row.name,
    ),
  );
  const result = [];
  for (const [collection, indexName] of expected) {
    const indexes = collections.has(collection)
      ? await db.collection(collection).indexes()
      : [];
    const index = indexes.find((item) => item.name === indexName);
    const field = indexName.replace(/_1$/, '');
    result.push({
      collection,
      field,
      present: Boolean(index),
      expireAfterSeconds: index?.expireAfterSeconds ?? null,
      valid: index?.expireAfterSeconds === 0 && index?.key?.[field] === 1,
    });
  }
  const seoul = new Date(Date.now() + 9 * 60 * 60 * 1000);
  seoul.setUTCDate(0);
  const previousMonth = seoul.toISOString().slice(0, 7),
    aggregates = collections.has('tourismnetworkaggregates')
      ? await db.collection('tourismnetworkaggregates').distinct('regionId', {
          kind: 'MONTHLY',
          periodKey: previousMonth,
          status: 'COMPLETE',
        })
      : [],
    missingMonthlyRegions = regions.filter(
      (region) => !aggregates.includes(region),
    );
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'READ_ONLY',
        indexes: result,
        monthlyCoverage: {
          previousMonth,
          missingRegions: missingMonthlyRegions,
        },
      },
      null,
      2,
    )}\n`,
  );
  if (result.some((item) => !item.valid) || missingMonthlyRegions.length > 0)
    process.exitCode = 2;
} catch {
  process.stderr.write('Regional network retention index check failed.\n');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
