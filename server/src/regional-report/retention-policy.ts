export const RAW_LINK_RETENTION_DAYS = 90;
export const REDEMPTION_RETENTION_DAYS = 365;
export const MONTHLY_AGGREGATE_RETENTION_YEARS = 3;
export const ROLLING_SNAPSHOT_RETENTION_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

export const rawLinkExpiresAt = (createdAt = new Date()) =>
  addDays(createdAt, RAW_LINK_RETENTION_DAYS);

export const redemptionLinkExpiresAt = rawLinkExpiresAt;

export const redemptionExpiresAt = (createdAt = new Date()) =>
  addDays(createdAt, REDEMPTION_RETENTION_DAYS);
