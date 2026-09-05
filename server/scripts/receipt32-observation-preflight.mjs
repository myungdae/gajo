import { createRequire } from 'node:module';
const args = process.argv.slice(2);
if (args.length !== 1 || args[0] !== '--read-only') {
  console.log('Read-only observation/index preflight. Build server first, then use MONGODB_URI with read-only credentials and --read-only. No apply mode.');
  process.exitCode = args.length ? 2 : 0;
} else {
  let client;
  try {
    const require = createRequire(import.meta.url);
    const { mongo } = require('mongoose');
    const { observationPreflight } = require('../dist/regional-data/candidate-observation.js');
    if (!process.env.MONGODB_URI) throw new Error('MISSING_URI');
    client = await new mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 }).connect();
    const result = await observationPreflight(client.db().collection('regionaldatarecords'));
    console.log(JSON.stringify(result, null, 2));
    if (result.indexConflicts.length || result.invalidCount) process.exitCode = 2;
  } catch {
    console.error('Read-only preflight failed. Check the local build, read permissions, and database configuration.');
    process.exitCode = 1;
  } finally { await client?.close(); }
}
