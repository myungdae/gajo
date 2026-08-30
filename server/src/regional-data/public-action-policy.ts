export interface DirectBookingEvidence {
  kind: 'DIRECT_BOOKING';
  verificationStatus: 'VERIFIED';
  verifiedUrl: string;
  sourceUrl: string;
  verifiedAt: string;
}

export function safeExternalHttpsUrl(value?: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function verifiedDirectBookingAction(
  reservationUrl?: unknown,
  evidence?: DirectBookingEvidence,
  websiteUrl?: unknown,
) {
  const reservation = safeExternalHttpsUrl(reservationUrl),
    verified = safeExternalHttpsUrl(evidence?.verifiedUrl),
    source = safeExternalHttpsUrl(evidence?.sourceUrl),
    website = safeExternalHttpsUrl(websiteUrl);
  return reservation &&
    verified === reservation &&
    source &&
    evidence?.kind === 'DIRECT_BOOKING' &&
    evidence.verificationStatus === 'VERIFIED' &&
    Boolean(evidence.verifiedAt) &&
    reservation !== website
    ? { url: reservation, evidenceMode: 'VERIFIED_DIRECT' as const }
    : undefined;
}
