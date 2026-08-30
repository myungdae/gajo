import { PilotEventSchema } from '../schemas/pilot-event.schema';
import {
  BenefitRedemptionSchema,
  PartnerActivitySchema,
} from '../partner/partner.schema';
import { TourismNetworkAggregateSchema } from './tourism-network-aggregate.schema';
import { rawLinkExpiresAt, redemptionExpiresAt } from './retention-policy';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('regional network retention', () => {
  it('sets raw linkage to 90 days and redemption retention to one year', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(rawLinkExpiresAt(now)).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(redemptionExpiresAt(now)).toEqual(new Date('2027-01-01T00:00:00Z'));
  });
  it('disables implicit application indexes and keeps migration explicitly gated', () => {
    const appModule = readFileSync(
        join(process.cwd(), 'src/app.module.ts'),
        'utf8',
      ),
      migration = readFileSync(
        join(
          process.cwd(),
          'scripts/migrate-regional-network-retention-indexes.mjs',
        ),
        'utf8',
      ),
      check = readFileSync(
        join(
          process.cwd(),
          'scripts/check-regional-network-retention-indexes.mjs',
        ),
        'utf8',
      ),
      maintenance = readFileSync(
        join(
          process.cwd(),
          'src/regional-report/regional-network-maintenance.ts',
        ),
        'utf8',
      ),
      maintenanceModule = readFileSync(
        join(
          process.cwd(),
          'src/regional-report/regional-network-maintenance.module.ts',
        ),
        'utf8',
      );
    expect(appModule).toMatch(/autoIndex:\s*false/);
    expect(migration).toMatch(/--apply/);
    expect(migration).toMatch(/REGIONAL_NETWORK_INDEX_MIGRATION_APPROVED/);
    expect(check).toMatch(/READ_ONLY/);
    expect(check).not.toMatch(/createIndex|dropIndex|insert|update|delete/);
    expect(maintenance).toMatch(/REGIONAL_NETWORK_MAINTENANCE_APPROVED/);
    expect(maintenanceModule).toMatch(/autoIndex:\s*false/);
    expect(maintenanceModule).not.toMatch(/AppModule|SeedModule/);
  });
  it('declares TTL only on explicit expiry fields so legacy rows without them are untouched', () => {
    expect(PilotEventSchema.indexes()).toContainEqual([
      { expiresAt: 1 },
      expect.objectContaining({
        expireAfterSeconds: 0,
        partialFilterExpression: { expiresAt: { $type: 'date' } },
      }),
    ]);
    expect(PartnerActivitySchema.indexes()).toContainEqual([
      { expiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 }),
    ]);
    expect(BenefitRedemptionSchema.indexes()).toContainEqual([
      { retentionExpiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 }),
    ]);
    expect(TourismNetworkAggregateSchema.indexes()).toContainEqual([
      { expiresAt: 1 },
      expect.objectContaining({ expireAfterSeconds: 0 }),
    ]);
  });
});
