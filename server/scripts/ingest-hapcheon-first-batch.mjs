import { readFile } from 'node:fs/promises';

const token = process.env.ADMIN_WRITE_TOKEN;
const baseUrl = process.env.GAJO_API_BASE_URL || 'http://127.0.0.1:3000';
if (!token) throw new Error('ADMIN_WRITE_TOKEN is required');

const batchUrl = new URL('../operations/hapcheon-first-batch.candidates.json', import.meta.url);
const candidates = JSON.parse(await readFile(batchUrl, 'utf8'));
const results = [];
for (const candidate of candidates) {
  const response = await fetch(`${baseUrl}/api/admin/regional-data/candidates`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token,
    },
    body: JSON.stringify(candidate),
  });
  if (!response.ok) throw new Error(`${candidate.proposedFacts.displayName}: HTTP ${response.status}`);
  const record = await response.json();
  results.push({
    displayName: candidate.proposedFacts.displayName,
    canonicalEntityId: record.canonicalEntityId,
    lifecycleStatus: record.lifecycleStatus,
    verificationStatus: record.verificationStatus,
    ingestionOutcome: record.ingestionOutcome,
  });
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
