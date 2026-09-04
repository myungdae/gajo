import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
// Short-lived search evidence, intentionally invalid after process restart. Never contains GPS.
const searchSecret = randomBytes(32);
function sign(payload: object, secret: string | Buffer) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return (
    body + '.' + createHmac('sha256', secret).update(body).digest('base64url')
  );
}
function read(token: unknown, secret: string | Buffer): any {
  if (typeof token !== 'string' || token.length > 2000) return null;
  try {
    const [body, signature, extra] = token.split('.');
    if (extra) return null;
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}
export function issuePlaceProof(
  regionId: string,
  placeKey: string,
  now = Date.now(),
) {
  return sign(
    {
      purpose: 'analytics-place',
      regionId,
      placeKey,
      expiresAt: now + 86400000,
    },
    searchSecret,
  );
}
export function verifyPlaceProof(
  token: unknown,
  regionId: string,
  placeKey: string,
  now = Date.now(),
) {
  const p = read(token, searchSecret);
  return Boolean(
    p &&
    p.purpose === 'analytics-place' &&
    p.regionId === regionId &&
    p.placeKey === placeKey &&
    p.expiresAt > now,
  );
}
export function issueTestMarker(
  secret: string,
  regionId: string,
  visitSessionId: string,
  kind: 'INTERNAL_TEST' | 'AUTOMATED_CHECK',
  now = Date.now(),
) {
  return sign(
    {
      purpose: 'analytics-test',
      regionId,
      visitSessionId,
      kind,
      expiresAt: now + 3600000,
    },
    secret,
  );
}
export function verifyTestMarker(
  token: unknown,
  secret: string | undefined,
  regionId: string,
  visitSessionId: string,
  now = Date.now(),
) {
  if (!secret) return null;
  const p = read(token, secret);
  return p?.purpose === 'analytics-test' &&
    p.regionId === regionId &&
    p.visitSessionId === visitSessionId &&
    p.expiresAt > now &&
    ['INTERNAL_TEST', 'AUTOMATED_CHECK'].includes(p.kind)
    ? (p.kind as 'INTERNAL_TEST' | 'AUTOMATED_CHECK')
    : null;
}
