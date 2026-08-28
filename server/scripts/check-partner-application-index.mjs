import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required for this read-only check.');
  process.exit(1);
}

const indexName = 'uniq_partner_application_fingerprint_string';
await mongoose.connect(uri, { autoIndex: false });
try {
  const collection = mongoose.connection.collection('partners');
  const [nullCount, duplicates, indexes] = await Promise.all([
    collection.countDocuments({ applicationFingerprint: { $type: 10 } }),
    collection
      .aggregate([
        { $match: { applicationFingerprint: { $type: 'string' } } },
        { $group: { _id: '$applicationFingerprint', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'groups' },
      ])
      .toArray(),
    collection
      .listIndexes()
      .toArray()
      .catch((error) => {
        if (error?.codeName === 'NamespaceNotFound') return [];
        throw error;
      }),
  ]);
  const index = indexes.find((candidate) => candidate.name === indexName),
    duplicateGroups = duplicates[0]?.groups || 0,
    ready = Boolean(
      index?.unique === true &&
      index?.partialFilterExpression?.applicationFingerprint?.$type ===
        'string',
    );
  console.log(
    JSON.stringify(
      {
        check: 'partner-application-fingerprint-index',
        readOnly: true,
        explicitNullDocuments: nullCount,
        duplicateStringFingerprintGroups: duplicateGroups,
        expectedIndexPresent: ready,
        expectedIndexName: indexName,
      },
      null,
      2,
    ),
  );
  // Explicit nulls are safe because the partial index only includes strings.
  if (duplicateGroups > 0 || !ready) process.exitCode = 2;
} finally {
  await mongoose.disconnect();
}
