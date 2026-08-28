import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  isBenefitActiveAt,
  isPublicPartner,
  PartnerService,
  seoulDateKey,
} from './partner.service';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

const trip = '11111111-1111-4111-8111-111111111111',
  key = 'owner-secret';
const operating = {
  partnerId: 'p1',
  partnerSlug: 'one',
  canonicalEntityId: 'entity:1',
  regionId: 'hapcheon',
  status: 'OPERATING',
  qrStatus: 'ACTIVE',
  verificationStatus: 'VERIFIED',
  managementKeyHash:
    '03f99ad2bb8f470ab4a6b65dd51dca8f63c4a36d52a66b22d706c14dbfec5983',
};
const query = (value: any) => ({ lean: jest.fn().mockResolvedValue(value) });
function models() {
  const partners: any = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
    create: jest.fn(),
  };
  const benefits: any = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    create: jest.fn(),
  };
  const activities: any = {
    findOne: jest.fn(),
    exists: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const redemptions: any = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  };
  const daily: any = { findOneAndUpdate: jest.fn(), updateOne: jest.fn() };
  return {
    partners,
    benefits,
    activities,
    redemptions,
    daily,
    service: new PartnerService(
      partners,
      benefits,
      activities,
      redemptions,
      daily,
    ),
  };
}
describe('partner publication and lifecycle', () => {
  it('keeps draft paused ended and reverify partners private', () => {
    for (const status of ['DRAFT', 'PAUSED', 'ENDED', 'REVERIFY_REQUIRED'])
      expect(isPublicPartner({ ...operating, status })).toBe(false);
    expect(isPublicPartner(operating)).toBe(true);
  });
  it('public API returns only the explicit public projection', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(
      query({
        ...operating,
        reviewOnly: { memo: 'private' },
        managementKeyHash: 'secret',
      }),
    );
    const result: any = await m.service.publicEntry('one');
    expect(result.displayName).toBeUndefined();
    expect(result.reviewOnly).toBeUndefined();
    expect(result.managementKeyHash).toBeUndefined();
  });
  it('rejects unknown and draft slugs without revealing draft data', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(null));
    await expect(m.service.publicEntry('draft')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('rejects lifecycle jumps and allows only the next reviewed state', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(
      query({ partnerId: 'p1', status: 'DRAFT' }),
    );
    await expect(
      m.service.adminPartner('p1', 'OPERATING'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(m.partners.findOneAndUpdate).not.toHaveBeenCalled();
    m.partners.findOneAndUpdate.mockReturnValue(
      query({ partnerId: 'p1', status: 'UNDER_REVIEW' }),
    );
    await expect(
      m.service.adminPartner('p1', 'UNDER_REVIEW'),
    ).resolves.toMatchObject({ status: 'UNDER_REVIEW' });
  });
  it('does not read another region when resolving a slug', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(null));
    await expect(
      m.service.recordEntry('one', {
        anonymousTripId: trip,
        regionId: 'okcheon',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(m.activities.create).not.toHaveBeenCalled();
  });
  it('self application cannot claim a canonical entity or reserved slug', async () => {
    const m = models();
    m.partners.create.mockImplementation(async (x: any) => x);
    const result: any = await m.service.apply({
      regionId: 'hapcheon',
      displayName: '신청업체',
      category: 'CAFE',
      address: '합천군',
      phone: '055-000-0000',
      consent: true,
      partnerSlug: 'smile',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
    });
    const created = m.partners.create.mock.calls[0][0];
    expect(result.status).toBe('APPLICATION_RECEIVED');
    expect(created.partnerSlug).not.toBe('smile');
    expect(created.canonicalEntityId).toMatch(
      /^urn:partner-candidate:hapcheon:/,
    );
    expect(result.managementKey).toBeTruthy();
  });
});
describe('QR visit evidence and idempotency', () => {
  it('rejects region mismatch before recording a visit', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(operating));
    await expect(
      m.service.visit('one', { anonymousTripId: trip, regionId: 'okcheon' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(m.activities.create).not.toHaveBeenCalled();
  });
  it('records QR_SCAN once and never describes GPS verification', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(operating));
    m.activities.findOne.mockResolvedValue(null);
    m.activities.create.mockResolvedValue({});
    m.benefits.find.mockReturnValue(query([]));
    const result: any = await m.service.visit('one', {
      anonymousTripId: trip,
      regionId: 'hapcheon',
    });
    expect(m.activities.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'QR_VISIT_CONFIRMED',
        metadata: { verificationMethod: 'QR_SCAN' },
      }),
    );
    expect(result.notice).toContain('GPS로 검증된 방문을 의미하지 않습니다');
    expect(result.benefits).toEqual([]);
  });
  it('does not create a second visit event for the same trip', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(operating));
    m.activities.findOne.mockResolvedValue({ activityId: 'existing' });
    m.benefits.find.mockReturnValue(query([]));
    await m.service.visit('one', {
      anonymousTripId: trip,
      regionId: 'hapcheon',
    });
    expect(m.activities.create).not.toHaveBeenCalled();
  });
  it('deduplicates repeated entry analytics with a stable event key', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(operating));
    m.activities.create.mockRejectedValue(
      Object.assign(new Error('duplicate'), { code: 11000 }),
    );
    await expect(
      m.service.recordEntry('one', {
        anonymousTripId: trip,
        regionId: 'hapcheon',
      }),
    ).resolves.toMatchObject({ partnerId: 'p1' });
    expect(m.activities.create).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: `entry:p1:${trip}` }),
    );
  });
  it('does not copy trip details or location into entry analytics', async () => {
    const m = models();
    m.partners.findOne.mockReturnValue(query(operating));
    m.activities.create.mockResolvedValue({});
    await m.service.recordEntry('one', {
      anonymousTripId: trip,
      regionId: 'hapcheon',
      latitude: 35.5,
      companions: [{ age: 7 }],
      state: { secret: 'trip' },
    });
    expect(m.activities.create).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousTripId: trip, metadata: {} }),
    );
    expect(JSON.stringify(m.activities.create.mock.calls[0][0])).not.toContain(
      'companions',
    );
    expect(JSON.stringify(m.activities.create.mock.calls[0][0])).not.toContain(
      'latitude',
    );
  });
});
describe('benefit policy and redemption trust', () => {
  it('uses Asia/Seoul boundaries and hides pending sold-out future and expired benefits', () => {
    const now = new Date('2026-08-28T03:30:00Z'),
      base = {
        publicationStatus: 'PUBLIC',
        approvalStatus: 'APPROVED',
        soldOut: false,
        daysOfWeek: [5],
        dailyStartTime: '12:00',
        dailyEndTime: '13:00',
      };
    expect(seoulDateKey(now)).toBe('2026-08-28');
    expect(isBenefitActiveAt(base, now)).toBe(true);
    for (const patch of [
      { approvalStatus: 'PENDING' },
      { soldOut: true },
      { startsAt: '2026-08-29T00:00:00Z' },
      { endsAt: '2026-08-27T00:00:00Z' },
      { daysOfWeek: [4] },
      { dailyStartTime: '13:01' },
    ])
      expect(isBenefitActiveAt({ ...base, ...patch }, now)).toBe(false);
  });
  it('uses exact partner and region filters with no benefit fallback', async () => {
    const m = models();
    m.benefits.find.mockReturnValue(query([]));
    await expect(m.service.activeBenefits('p1', 'hapcheon')).resolves.toEqual(
      [],
    );
    expect(m.benefits.find).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: 'p1',
        regionId: 'hapcheon',
        publicationStatus: 'PUBLIC',
        approvalStatus: 'APPROVED',
      }),
    );
  });
  it('requires QR visit and a valid idempotency key', async () => {
    const m = models();
    m.redemptions.findOne.mockReturnValue(query(null));
    m.benefits.findOne.mockReturnValue(
      query({
        benefitId: 'b1',
        partnerId: 'p1',
        regionId: 'hapcheon',
        publicationStatus: 'PUBLIC',
        approvalStatus: 'APPROVED',
        soldOut: false,
        perTripLimit: 1,
      }),
    );
    m.activities.exists.mockResolvedValue(false);
    await expect(
      m.service.requestRedemption('b1', {
        anonymousTripId: trip,
        regionId: 'hapcheon',
        idempotencyKey: 'bad',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      m.service.requestRedemption('b1', {
        anonymousTripId: trip,
        regionId: 'hapcheon',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow('먼저 업소 현장 QR 방문확인을');
  });
  it('returns the same redemption for an idempotent retry without incrementing counters', async () => {
    const m = models();
    m.redemptions.findOne.mockReturnValue(
      query({
        redemptionId: 'redeem-x',
        benefitId: 'b1',
        anonymousTripId: trip,
        regionId: 'hapcheon',
        status: 'REQUESTED',
        expiresAt: new Date(),
      }),
    );
    await expect(
      m.service.requestRedemption('b1', {
        anonymousTripId: trip,
        regionId: 'hapcheon',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }),
    ).resolves.toMatchObject({ redemptionId: 'redeem-x' });
    expect(m.benefits.findOneAndUpdate).not.toHaveBeenCalled();
    expect(m.daily.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('reserves total and Seoul-day limits atomically before creation', async () => {
    const m = models();
    m.redemptions.findOne.mockReturnValue(query(null));
    m.benefits.findOne.mockReturnValue(
      query({
        benefitId: 'b1',
        partnerId: 'p1',
        regionId: 'hapcheon',
        publicationStatus: 'PUBLIC',
        approvalStatus: 'APPROVED',
        soldOut: false,
        perTripLimit: 1,
        totalLimit: 1,
        dailyLimit: 1,
      }),
    );
    m.activities.exists.mockResolvedValue(true);
    m.benefits.findOneAndUpdate.mockResolvedValue({ reservedCount: 1 });
    m.daily.findOneAndUpdate.mockResolvedValue({ count: 1 });
    m.redemptions.create.mockResolvedValue({ status: 'REQUESTED' });
    m.activities.create.mockResolvedValue({});
    const result: any = await m.service.requestRedemption('b1', {
      anonymousTripId: trip,
      regionId: 'hapcheon',
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.status).toBe('REQUESTED');
    expect(m.benefits.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ benefitId: 'b1', $expr: expect.anything() }),
      { $inc: { reservedCount: 1 } },
      { new: true },
    );
    expect(m.daily.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        counterId: expect.stringMatching(/^b1:2026-/),
        count: { $lt: 1 },
      }),
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });
  it('never lets a tourist create CONFIRMED even if a benefit disables confirmation', async () => {
    const m = models();
    m.redemptions.findOne.mockReturnValue(query(null));
    m.benefits.findOne.mockReturnValue(
      query({
        benefitId: 'b1',
        partnerId: 'p1',
        regionId: 'hapcheon',
        publicationStatus: 'PUBLIC',
        approvalStatus: 'APPROVED',
        soldOut: false,
        perTripLimit: 1,
        partnerConfirmationRequired: false,
      }),
    );
    m.activities.exists.mockResolvedValue(true);
    m.redemptions.create.mockImplementation(async (x: any) => x);
    m.activities.create.mockResolvedValue({});
    const result: any = await m.service.requestRedemption('b1', {
      anonymousTripId: trip,
      regionId: 'hapcheon',
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.status).toBe('REQUESTED');
    expect(m.redemptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REQUESTED' }),
    );
  });
  it('requires owner key and rejects invalid decisions and completed reuse', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue(operating);
    await expect(
      m.service.confirm('one', 'redeem-x', 'wrong', 'CONFIRM'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      m.service.confirm('one', 'redeem-x', key, 'OTHER'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      m.service.confirm('one', 'redeem-x', key, 'CONFIRM'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('claims an owner decision with one atomic REQUESTED transition', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue(operating);
    m.redemptions.findOneAndUpdate.mockResolvedValue({
      redemptionId: 'r1',
      benefitId: 'b1',
      partnerId: 'p1',
      regionId: 'hapcheon',
      anonymousTripId: trip,
      status: 'CONFIRMED',
      requestedAt: new Date(),
    });
    m.activities.create.mockResolvedValue({});
    await expect(
      m.service.confirm('one', 'r1', key, 'CONFIRM'),
    ).resolves.toEqual({ redemptionId: 'r1', status: 'CONFIRMED' });
    expect(m.redemptions.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        redemptionId: 'r1',
        status: 'REQUESTED',
        expiresAt: { $gt: expect.any(Date) },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
      { new: true },
    );
  });
  it('expires stale owner confirmation and releases reserved counters', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue(operating);
    const row: any = {
      redemptionId: 'r1',
      benefitId: 'b1',
      partnerId: 'p1',
      regionId: 'hapcheon',
      anonymousTripId: trip,
      status: 'REQUESTED',
      requestedAt: new Date('2026-08-28T00:00:00Z'),
      expiresAt: new Date('2026-08-28T00:01:00Z'),
    };
    m.redemptions.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row);
    m.benefits.updateOne.mockResolvedValue({});
    m.daily.updateOne.mockResolvedValue({});
    m.activities.create.mockResolvedValue({});
    jest.useFakeTimers().setSystemTime(new Date('2026-08-28T00:02:00Z'));
    await expect(
      m.service.confirm('one', 'r1', key, 'CONFIRM'),
    ).rejects.toThrow('만료');
    expect(m.redemptions.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'REQUESTED', expiresAt: { $lte: expect.any(Date) } }),
      { $set: { status: 'EXPIRED', decidedAt: expect.any(Date) } },
      { new: false },
    );
    expect(m.benefits.updateOne).toHaveBeenCalledWith(
      { benefitId: 'b1', reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
    );
    jest.useRealTimers();
  });
  it('metrics expose counts only and are scoped to the authenticated owner', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue(operating);
    m.activities.find.mockReturnValue(
      query([
        { eventType: 'QR_VISIT_CONFIRMED', anonymousTripId: trip },
        { eventType: 'BENEFIT_USE_CONFIRMED', anonymousTripId: trip },
      ]),
    );
    const result: any = await m.service.metrics('one', key);
    expect(result).toEqual({
      partnerId: 'p1',
      regionId: 'hapcheon',
      qrEntries: 0,
      recommendations: 0,
      qrVisits: 1,
      benefitRequests: 0,
      benefitUses: 1,
    });
    expect(JSON.stringify(result)).not.toContain(trip);
  });
});
describe('domain-independent QR assets', () => {
  it('generates scanner-compatible SVG test QR from runtime base URL without writing a hostname', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue(operating);
    process.env.PUBLIC_BASE_URL = 'https://preview.example.test';
    const asset = await m.service.qrAsset('one', key, {
      kind: 'visit',
      format: 'svg',
      test: true,
    });
    expect(asset.target).toBe('https://preview.example.test/visit/one');
    expect(asset.contentType).toBe('image/svg+xml');
    expect(String(asset.data)).toContain('<svg');
    expect(String(asset.data)).toContain('<path');
    expect(m.partners.updateOne).not.toHaveBeenCalled();
    delete process.env.PUBLIC_BASE_URL;
  });
  it('round-trips the generated PNG through an independent QR decoder', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue(operating);
    process.env.PUBLIC_BASE_URL = 'https://preview.example.test';
    const asset = await m.service.qrAsset('one', key, {
        kind: 'go',
        format: 'png',
        test: true,
      }),
      png = PNG.sync.read(asset.data as Buffer),
      decoded = jsQR(
        new Uint8ClampedArray(png.data),
        png.width,
        png.height,
      );
    expect(decoded?.data).toBe('https://preview.example.test/go/one');
    delete process.env.PUBLIC_BASE_URL;
  },15000);
  it('blocks print QR until operating approval and an exkovia.com base URL', async () => {
    const m = models();
    m.partners.findOne.mockResolvedValue({ ...operating, status: 'DRAFT' });
    process.env.PUBLIC_BASE_URL = 'https://gajo.example';
    await expect(
      m.service.qrAsset('one', key, { kind: 'go', format: 'png', test: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    m.partners.findOne.mockResolvedValue(operating);
    await expect(
      m.service.qrAsset('one', key, { kind: 'go', format: 'png', test: false }),
    ).rejects.toThrow('exkovia.com');
    delete process.env.PUBLIC_BASE_URL;
  });
});
