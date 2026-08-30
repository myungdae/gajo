import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');
const now = new Date(),
  day = 24 * 60 * 60 * 1000,
  rawCutoff = new Date(now.getTime() - 90 * day),
  redemptionCutoff = new Date(now.getTime() - 365 * day);

try {
  await mongoose.connect(uri, { autoIndex: false });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection unavailable');
  const names = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (x) => x.name,
    ),
  );
  const collection = (name) => (names.has(name) ? db.collection(name) : null);
  const specs = [
    ['PilotEvent', collection('pilotevents'), 'sessionId', 'expiresAt'],
    [
      'PartnerActivity',
      collection('partneractivities'),
      'anonymousTripId',
      'expiresAt',
    ],
    [
      'BenefitRedemption',
      collection('benefitredemptions'),
      'anonymousTripId',
      'retentionExpiresAt',
    ],
    [
      'TourismNetworkAggregate',
      collection('tourismnetworkaggregates'),
      null,
      'expiresAt',
    ],
  ];
  const result = {
    generatedAt: now.toISOString(),
    mode: 'READ_ONLY_DRY_RUN',
    collections: {},
    monthlyConvertible: [],
  };
  for (const [label, rows, identity, ttlField] of specs) {
    if (!rows) {
      result.collections[label] = { present: false };
      continue;
    }
    const total = await rows.countDocuments(),
      olderThan90Days = await rows.countDocuments({
        createdAt: { $lt: rawCutoff },
      }),
      withLinkIdentity = identity
        ? await rows.countDocuments({ [identity]: { $type: 'string' } })
        : 0,
      ttlWouldDeleteNow = await rows.countDocuments({
        [ttlField]: { $lte: now },
      });
    result.collections[label] = {
      present: true,
      total,
      olderThan90Days,
      withLinkIdentity,
      deletePlanned:
        label === 'BenefitRedemption'
          ? await rows.countDocuments({ createdAt: { $lt: redemptionCutoff } })
          : label === 'TourismNetworkAggregate'
            ? ttlWouldDeleteNow
            : olderThan90Days,
      unlinkPlanned:
        label === 'BenefitRedemption'
          ? await rows.countDocuments({
              createdAt: { $lt: rawCutoff },
              $or: [
                { anonymousTripId: { $type: 'string' } },
                { idempotencyKey: { $type: 'string' } },
              ],
            })
          : 0,
      ttlWouldDeleteNow,
    };
  }
  const seoulNow = new Date(now.getTime() + 9 * 60 * 60 * 1000),
    monthStart = new Date(
      Date.UTC(seoulNow.getUTCFullYear(), seoulNow.getUTCMonth(), 1) -
        9 * 60 * 60 * 1000,
    );
  for (const name of ['pilotevents', 'partneractivities']) {
    const rows = collection(name);
    if (!rows) continue;
    const months = await rows
      .aggregate([
        { $match: { createdAt: { $type: 'date', $lt: monthStart } } },
        {
          $group: {
            _id: {
              $dateToString: {
                date: '$createdAt',
                format: '%Y-%m',
                timezone: 'Asia/Seoul',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    result.monthlyConvertible.push({
      collection: name,
      months: months.map((x) => ({ month: x._id, count: x.count })),
    });
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch {
  process.stderr.write('Regional network retention dry-run failed.\n');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
