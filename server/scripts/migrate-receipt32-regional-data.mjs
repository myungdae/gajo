import mongoose from 'mongoose';
import {
  COLLECTION,
  REGION_ID,
  applyMigration,
  planMigration,
  postCheck,
} from './receipt32-regional-data-migration-core.mjs';

const apply = process.argv.includes('--apply');
const checkOnly = process.argv.includes('--post-check');
if (apply && process.env.RECEIPT32_MIGRATION_APPROVED !== 'true')
  throw new Error(
    'Apply requires --apply and RECEIPT32_MIGRATION_APPROVED=true',
  );
if (apply && checkOnly)
  throw new Error('Choose either --apply or --post-check');
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

try {
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB unavailable');
  const collection = db.collection(COLLECTION);
  if (checkOnly) {
    const result = await postCheck(collection);
    process.stdout.write(
      `${JSON.stringify({ mode: 'READ_ONLY_POST_CHECK', ...result }, null, 2)}\n`,
    );
    if (!result.valid) process.exitCode = 1;
  } else {
    const rows = await collection.find({ regionId: REGION_ID }).toArray();
    const plan = planMigration(rows);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    if (!plan.safeToApply) {
      process.stderr.write(
        'Conflicts or protected garden invariant failure.\n',
      );
      process.exitCode = 1;
    } else if (apply) {
      await applyMigration(collection, plan);
      const result = await postCheck(collection);
      process.stdout.write(
        `${JSON.stringify({ mode: 'APPLIED', ...result }, null, 2)}\n`,
      );
      if (!result.valid) process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(`Receipt 32 migration failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
