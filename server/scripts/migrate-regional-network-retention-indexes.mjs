import mongoose from 'mongoose';

if (
  !process.argv.includes('--apply') ||
  process.env.REGIONAL_NETWORK_INDEX_MIGRATION_APPROVED !== 'true'
)
  throw new Error('Explicit --apply and approval environment are required');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const indexes = [
  [
    'pilotevents',
    { expiresAt: 1 },
    'expiresAt_1',
    { expiresAt: { $type: 'date' } },
  ],
  [
    'partneractivities',
    { expiresAt: 1 },
    'expiresAt_1',
    { expiresAt: { $type: 'date' } },
  ],
  [
    'benefitredemptions',
    { retentionExpiresAt: 1 },
    'retentionExpiresAt_1',
    { retentionExpiresAt: { $type: 'date' } },
  ],
  [
    'tourismnetworkaggregates',
    { expiresAt: 1 },
    'expiresAt_1',
    { expiresAt: { $type: 'date' } },
  ],
];

try {
  await mongoose.connect(uri, { autoIndex: false });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB unavailable');
  for (const [collection, key, name, partialFilterExpression] of indexes)
    await db.collection(collection).createIndex(key, {
      name,
      expireAfterSeconds: 0,
      partialFilterExpression,
    });
  const redemption = db.collection('benefitredemptions');
  for (const name of ['benefitId_1_anonymousTripId_1', 'idempotencyKey_1']) {
    const existing = (await redemption.indexes()).find(
      (index) => index.name === name,
    );
    if (existing) await redemption.dropIndex(name);
  }
  await redemption.createIndex(
    { benefitId: 1, anonymousTripId: 1 },
    {
      name: 'benefitId_1_anonymousTripId_1',
      unique: true,
      partialFilterExpression: { anonymousTripId: { $type: 'string' } },
    },
  );
  await redemption.createIndex(
    { idempotencyKey: 1 },
    {
      name: 'idempotencyKey_1',
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    },
  );
  process.stdout.write('Regional network retention indexes applied.\n');
} catch {
  process.stderr.write('Regional network retention index migration failed.\n');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
