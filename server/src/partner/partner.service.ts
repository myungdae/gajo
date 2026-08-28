import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import * as QRCode from 'qrcode';
import {
  BenefitRedemption,
  BenefitRedemptionDocument,
  BenefitDailyCounter,
  BenefitDailyCounterDocument,
  Partner,
  PartnerActivity,
  PartnerActivityDocument,
  PartnerBenefit,
  PartnerBenefitDocument,
  PartnerDocument,
  PARTNER_APPLICATION_FINGERPRINT_INDEX,
} from './partner.schema';
import { partnerApplicationFingerprint } from './public-write-security';
const REGION = /^[a-z0-9-]{2,40}$/,
  SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  UUID = /^[0-9a-f-]{36}$/i;
const publicPartner = (p: any) => ({
  partnerId: p.partnerId,
  canonicalEntityId: p.canonicalEntityId,
  regionId: p.regionId,
  partnerSlug: p.partnerSlug,
  displayName: p.displayName,
  category: p.category,
  address: p.address,
  phone: p.phone,
  operatingHours: p.operatingHours,
  description: p.description,
  representativeImageUrl: p.representativeImageUrl,
  status: p.status,
  qrStatus: p.qrStatus,
  verificationStatus: p.verificationStatus,
});
export const isPublicPartner = (p: any) =>
  p?.status === 'OPERATING' &&
  p?.qrStatus === 'ACTIVE' &&
  p?.verificationStatus === 'VERIFIED';
export function seoulDateKey(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function isBenefitActiveAt(b: any, now: Date) {
  if (
    b.publicationStatus !== 'PUBLIC' ||
    b.approvalStatus !== 'APPROVED' ||
    b.soldOut
  )
    return false;
  if (
    (b.startsAt && new Date(b.startsAt) > now) ||
    (b.endsAt && new Date(b.endsAt) < now)
  )
    return false;
  const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now),
    map = Object.fromEntries(parts.map((x) => [x.type, x.value])),
    day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      map.weekday,
    ),
    time = `${map.hour}:${map.minute}`;
  return (
    (!b.daysOfWeek?.length || b.daysOfWeek.includes(day)) &&
    (!b.dailyStartTime || time >= b.dailyStartTime) &&
    (!b.dailyEndTime || time <= b.dailyEndTime)
  );
}
const PARTNER_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['UNDER_REVIEW', 'ENDED'],
  APPLICATION_RECEIVED: ['UNDER_REVIEW', 'CHANGES_REQUESTED', 'ENDED'],
  UNDER_REVIEW: ['CHANGES_REQUESTED', 'APPROVED', 'ENDED'],
  CHANGES_REQUESTED: ['UNDER_REVIEW', 'ENDED'],
  APPROVED: ['AI_REGISTERED', 'PAUSED', 'REVERIFY_REQUIRED', 'ENDED'],
  AI_REGISTERED: ['QR_ISSUED', 'PAUSED', 'REVERIFY_REQUIRED', 'ENDED'],
  QR_ISSUED: ['OPERATING', 'PAUSED', 'REVERIFY_REQUIRED', 'ENDED'],
  OPERATING: ['PAUSED', 'REVERIFY_REQUIRED', 'ENDED'],
  PAUSED: ['UNDER_REVIEW', 'OPERATING', 'ENDED'],
  REVERIFY_REQUIRED: ['UNDER_REVIEW', 'PAUSED', 'ENDED'],
  ENDED: [],
};
@Injectable()
export class PartnerService implements OnModuleInit {
  constructor(
    @InjectModel(Partner.name) private partners: Model<PartnerDocument>,
    @InjectModel(PartnerBenefit.name)
    private benefits: Model<PartnerBenefitDocument>,
    @InjectModel(PartnerActivity.name)
    private activities: Model<PartnerActivityDocument>,
    @InjectModel(BenefitRedemption.name)
    private redemptions: Model<BenefitRedemptionDocument>,
    @InjectModel(BenefitDailyCounter.name)
    private dailyCounters: Model<BenefitDailyCounterDocument>,
  ) {}
  async onModuleInit() {
    await this.partners.updateOne(
      {
        regionId: 'hapcheon',
        canonicalEntityId:
          'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
      },
      {
        $setOnInsert: {
          partnerId: 'partner-hapcheon-smile',
          canonicalEntityId:
            'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
          regionId: 'hapcheon',
          partnerSlug: 'smile',
          displayName: '합천호 스마일펜션',
          category: 'ACCOMMODATION',
          status: 'DRAFT',
          qrStatus: 'INACTIVE',
          verificationStatus: 'VERIFIED',
          source: {
            sourceType: 'REGIONAL_DATA_MANAGER',
            sourceName: '합천 검증 Operational Entity',
          },
        },
      },
      { upsert: true },
    );
  }
  private hash(v: string) {
    return createHash('sha256').update(v).digest('hex');
  }
  private validIdentity(trip: string, region: string) {
    if (!UUID.test(trip) || !REGION.test(region))
      throw new BadRequestException('invalid anonymous trip identity');
  }
  private async operating(slug: string) {
    const p: any = await this.partners
      .findOne({
        partnerSlug: slug,
        status: 'OPERATING',
        qrStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      })
      .lean();
    if (!isPublicPartner(p))
      throw new NotFoundException('운영 중인 승인 파트너를 찾을 수 없습니다.');
    return p;
  }
  private async owned(slug: string, key: string) {
    const p: any = await this.partners.findOne({ partnerSlug: slug });
    const supplied = Buffer.from(this.hash(key || ''), 'hex'),
      expected = Buffer.from(p?.managementKeyHash || '', 'hex');
    if (
      !p ||
      !key ||
      p.managementKeyRevokedAt ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new ForbiddenException('파트너 관리 권한이 필요합니다.');
    return p;
  }
  async apply(input: any) {
    if (input?.website || input?.companyWebsite)
      throw new BadRequestException('신청 내용을 확인해 주세요.');
    if (
      !REGION.test(input?.regionId || '') ||
      !input?.displayName ||
      !input?.category ||
      !input?.address ||
      !input?.phone ||
      input?.consent !== true
    )
      throw new BadRequestException('필수 항목과 참여 동의를 확인해 주세요.');
    const limits: Record<string, number> = {
      displayName: 120,
      category: 80,
      address: 300,
      phone: 40,
      description: 2000,
      proposedBenefit: 1000,
      representativeImageUrl: 500,
    };
    for (const [field, limit] of Object.entries(limits))
      if (
        input[field] !== undefined &&
        (typeof input[field] !== 'string' || input[field].trim().length > limit)
      )
        throw new BadRequestException(`invalid ${field}`);
    if (
      input.operatingHours !== undefined &&
      JSON.stringify(input.operatingHours).length > 1000
    )
      throw new BadRequestException('invalid operatingHours');
    if (input.representativeImageUrl) {
      try {
        const url = new URL(input.representativeImageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        throw new BadRequestException('invalid representativeImageUrl');
      }
    }
    const fingerprint = partnerApplicationFingerprint(input);
    const slug = `${input.regionId}-${randomUUID().slice(0, 8)}`.toLowerCase();
    if (!SLUG.test(slug)) throw new BadRequestException('invalid partnerSlug');
    const key = randomBytes(24).toString('base64url'),
      partnerId = `partner-${randomUUID()}`,
      canonicalEntityId = `urn:partner-candidate:${input.regionId}:${randomUUID()}`;
    const issuedAt = new Date();
    let row: any;
    try {
      row = await this.partners.create({
        partnerId,
        canonicalEntityId,
        regionId: input.regionId,
        partnerSlug: slug,
        displayName: input.displayName,
        category: input.category,
        address: input.address,
        phone: input.phone,
        operatingHours: input.operatingHours,
        description: input.description,
        representativeImageUrl: input.representativeImageUrl,
        reviewOnly: { proposedBenefit: input.proposedBenefit },
        status: 'APPLICATION_RECEIVED',
        qrStatus: 'INACTIVE',
        verificationStatus: 'UNVERIFIED',
        source: {
          sourceType: 'PARTNER_SELF_APPLICATION',
          sourceName: '업주 셀프 신청',
        },
        managementKeyHash: this.hash(key),
        managementKeyVersion: 1,
        managementKeyIssuedAt: issuedAt,
        managementKeyAudit: [
          this.keyAudit(1, 'ISSUED', 'SELF_APPLICATION', issuedAt),
        ],
        applicationFingerprint: fingerprint,
      });
    } catch (error: any) {
      if (
        error?.code === 11000 &&
        (error?.keyPattern?.applicationFingerprint === 1 ||
          error?.index === PARTNER_APPLICATION_FINGERPRINT_INDEX)
      )
        throw new ConflictException('이미 접수된 신청과 동일한 정보입니다.');
      throw error;
    }
    return {
      partnerId: row.partnerId,
      status: row.status,
      managementKey: key,
      managementKeyNotice:
        '이 키는 다시 표시되지 않습니다. 안전하게 보관해 주세요.',
    };
  }
  async publicEntry(slug: string) {
    const p = await this.operating(slug);
    return publicPartner(p);
  }
  async recordEntry(slug: string, input: any) {
    const p = await this.operating(slug);
    this.validIdentity(input?.anonymousTripId, input?.regionId);
    if (input.regionId !== p.regionId)
      throw new BadRequestException('region mismatch');
    await this.event(
      'PARTNER_QR_ENTRY',
      p,
      input.anonymousTripId,
      {},
      `entry:${p.partnerId}:${input.anonymousTripId}`,
    );
    return publicPartner(p);
  }
  async visit(slug: string, input: any) {
    const p = await this.operating(slug);
    this.validIdentity(input?.anonymousTripId, input?.regionId);
    if (input.regionId !== p.regionId)
      throw new BadRequestException('region mismatch');
    const existing = await this.activities.findOne({
      eventType: 'QR_VISIT_CONFIRMED',
      partnerId: p.partnerId,
      anonymousTripId: input.anonymousTripId,
    });
    if (!existing)
      await this.event(
        'QR_VISIT_CONFIRMED',
        p,
        input.anonymousTripId,
        { verificationMethod: 'QR_SCAN' },
        `visit:${p.partnerId}:${input.anonymousTripId}`,
      );
    return {
      partner: publicPartner(p),
      visitStatus: 'QR_CONFIRMED',
      notice:
        '현장 QR 스캔으로 방문을 확인했습니다. GPS로 검증된 방문을 의미하지 않습니다.',
      benefits: await this.activeBenefits(p.partnerId, p.regionId),
    };
  }
  async activeBenefits(partnerId: string, regionId: string) {
    const now = new Date(),
      rows: any[] = await this.benefits
        .find({
          partnerId,
          regionId,
          publicationStatus: 'PUBLIC',
          approvalStatus: 'APPROVED',
          soldOut: false,
        })
        .lean();
    return rows
      .filter((x) => isBenefitActiveAt(x, now))
      .map(({ _id, __v, ...x }) => x);
  }
  private inSeoulWindow(b: any, now: Date) {
    return isBenefitActiveAt(
      {
        ...b,
        publicationStatus: b.publicationStatus || 'PUBLIC',
        approvalStatus: b.approvalStatus || 'APPROVED',
      },
      now,
    );
  }
  async requestRedemption(benefitId: string, input: any) {
    this.validIdentity(input?.anonymousTripId, input?.regionId);
    if (!UUID.test(input?.idempotencyKey || ''))
      throw new BadRequestException('valid idempotencyKey is required');
    const prior: any = await this.redemptions
      .findOne({ idempotencyKey: input.idempotencyKey })
      .lean();
    if (prior) {
      if (
        prior.benefitId !== benefitId ||
        prior.anonymousTripId !== input.anonymousTripId ||
        prior.regionId !== input.regionId
      )
        throw new BadRequestException('idempotency key ownership mismatch');
      return {
        redemptionId: prior.redemptionId,
        status: prior.status,
        partnerConfirmationRequired: prior.status === 'REQUESTED',
        expiresAt: prior.expiresAt,
      };
    }
    const b: any = await this.benefits
      .findOne({
        benefitId,
        regionId: input.regionId,
        publicationStatus: 'PUBLIC',
        approvalStatus: 'APPROVED',
        soldOut: false,
      })
      .lean();
    if (!b || !this.inSeoulWindow(b, new Date()))
      throw new NotFoundException('현재 사용할 수 있는 승인 혜택이 아닙니다.');
    await this.expireStaleRedemptions(benefitId);
    const visit = await this.activities.exists({
      eventType: 'QR_VISIT_CONFIRMED',
      partnerId: b.partnerId,
      anonymousTripId: input.anonymousTripId,
    });
    if (!visit)
      throw new BadRequestException('먼저 업소 현장 QR 방문확인을 해 주세요.');
    if ((b.perTripLimit || 1) !== 1)
      throw new BadRequestException('Phase 1 supports one use per TripSession');
    const now = new Date(),
      seoulDay = seoulDateKey(now);
    let totalReserved = false,
      dailyReserved = false;
    try {
      if (b.totalLimit) {
        const total = await this.benefits.findOneAndUpdate(
          {
            benefitId,
            $expr: {
              $lt: [{ $ifNull: ['$reservedCount', 0] }, '$totalLimit'],
            },
          },
          { $inc: { reservedCount: 1 } },
          { new: true },
        );
        if (!total) throw new BadRequestException('혜택이 소진되었습니다.');
        totalReserved = true;
      }
      if (b.dailyLimit) {
        const counterId = `${benefitId}:${seoulDay}`;
        try {
          const counter = await this.dailyCounters.findOneAndUpdate(
            { counterId, count: { $lt: b.dailyLimit } },
            {
              $setOnInsert: { counterId, benefitId, seoulDate: seoulDay },
              $inc: { count: 1 },
            },
            { new: true, upsert: true },
          );
          if (!counter)
            throw new BadRequestException('오늘 제공 수량이 소진되었습니다.');
          dailyReserved = true;
        } catch (error: any) {
          if (error?.code === 11000)
            throw new BadRequestException('오늘 제공 수량이 소진되었습니다.');
          throw error;
        }
      }
      const redemptionId = `redeem-${randomUUID()}`,
        expiresAt = new Date(now.getTime() + 15 * 60 * 1000),
        row = await this.redemptions.create({
          redemptionId,
          benefitId,
          partnerId: b.partnerId,
          regionId: b.regionId,
          anonymousTripId: input.anonymousTripId,
          idempotencyKey: input.idempotencyKey,
          status: 'REQUESTED',
          requestedAt: now,
          expiresAt,
        });
      await this.event(
        'BENEFIT_USE_REQUESTED',
        { partnerId: b.partnerId, regionId: b.regionId },
        input.anonymousTripId,
        { benefitId, redemptionId },
        `redemption-request:${redemptionId}`,
      );
      return {
        redemptionId,
        status: row.status,
        partnerConfirmationRequired: true,
        expiresAt,
      };
    } catch (error: any) {
      if (dailyReserved)
        await this.dailyCounters.updateOne(
          { counterId: `${benefitId}:${seoulDay}`, count: { $gt: 0 } },
          { $inc: { count: -1 } },
        );
      if (totalReserved)
        await this.benefits.updateOne(
          { benefitId, reservedCount: { $gt: 0 } },
          { $inc: { reservedCount: -1 } },
        );
      if (error?.code === 11000) {
        const duplicate: any = await this.redemptions
          .findOne({ benefitId, anonymousTripId: input.anonymousTripId })
          .lean();
        if (duplicate)
          throw new BadRequestException(
            '이 TripSession에서는 이미 혜택을 요청했습니다.',
          );
      }
      throw error;
    }
  }
  async confirm(
    slug: string,
    redemptionId: string,
    key: string,
    decision: string,
  ) {
    const p = await this.owned(slug, key);
    if (!['CONFIRM', 'DECLINE'].includes(decision))
      throw new BadRequestException('unsupported redemption decision');
    const now = new Date();
    const status = decision === 'CONFIRM' ? 'CONFIRMED' : 'DECLINED';
    const row: any = await this.redemptions.findOneAndUpdate(
      {
        redemptionId,
        partnerId: p.partnerId,
        status: 'REQUESTED',
        expiresAt: { $gt: now },
      },
      {
        $set: {
          status,
          decidedAt: now,
          ...(status === 'CONFIRMED' ? { confirmedAt: now } : {}),
        },
      },
      { new: true },
    );
    if (!row) {
      const stale: any = await this.redemptions.findOneAndUpdate(
        {
          redemptionId,
          partnerId: p.partnerId,
          status: 'REQUESTED',
          expiresAt: { $lte: now },
        },
        { $set: { status: 'EXPIRED', decidedAt: now } },
        { new: false },
      );
      if (!stale) throw new NotFoundException();
      await this.releaseReservation(stale.benefitId, stale.requestedAt);
      await this.event(
        'BENEFIT_USE_EXPIRED',
        { partnerId: stale.partnerId, regionId: stale.regionId },
        stale.anonymousTripId,
        { benefitId: stale.benefitId, redemptionId },
        `redemption-decision:${redemptionId}`,
      );
      throw new BadRequestException('사용 요청이 만료되었습니다.');
    }
    if (row.status === 'DECLINED')
      await this.releaseReservation(row.benefitId, row.requestedAt);
    await this.event(
      row.status === 'CONFIRMED'
        ? 'BENEFIT_USE_CONFIRMED'
        : 'BENEFIT_USE_DECLINED',
      p,
      row.anonymousTripId,
      { benefitId: row.benefitId, redemptionId },
      `redemption-decision:${redemptionId}`,
    );
    return { redemptionId, status: row.status };
  }
  async createBenefit(slug: string, key: string, input: any) {
    const p = await this.owned(slug, key);
    if (!input?.title || !input?.benefitType)
      throw new BadRequestException('title and benefitType are required');
    const benefitTypes = [
      'FIXED_DISCOUNT',
      'PERCENT_DISCOUNT',
      'DRINK',
      'DESSERT',
      'SIZE_UP',
      'EXPERIENCE_DISCOUNT',
      'GIFT',
      'LATE_CHECKOUT',
      'PRIORITY_RESERVATION',
      'CUSTOM',
      'NONE',
    ];
    if (
      typeof input.title !== 'string' ||
      input.title.length > 120 ||
      !benefitTypes.includes(input.benefitType)
    )
      throw new BadRequestException('invalid benefit');
    for (const limit of ['totalLimit', 'dailyLimit'])
      if (
        input[limit] !== undefined &&
        (!Number.isInteger(input[limit]) || input[limit] < 1)
      )
        throw new BadRequestException(`invalid ${limit}`);
    if (input.perTripLimit !== undefined && input.perTripLimit !== 1)
      throw new BadRequestException('Phase 1 supports one use per TripSession');
    const row: any = await this.benefits.create({
      ...input,
      benefitId: `benefit-${randomUUID()}`,
      partnerId: p.partnerId,
      regionId: p.regionId,
      publicationStatus: 'DRAFT',
      approvalStatus: 'PENDING',
      partnerConfirmationRequired: true,
      perTripLimit: 1,
    });
    return row.toObject();
  }
  async adminList(regionId: string) {
    return {
      partners: await this.partners.find(regionId ? { regionId } : {}).lean(),
      benefits: await this.benefits.find(regionId ? { regionId } : {}).lean(),
    };
  }
  async adminPartner(partnerId: string, status: Partner['status']) {
    const current: any = await this.partners.findOne({ partnerId }).lean();
    if (!current) throw new NotFoundException();
    if (!PARTNER_TRANSITIONS[current.status]?.includes(status))
      throw new BadRequestException(
        `invalid partner transition: ${current.status} -> ${status}`,
      );
    const update: any = { status };
    if (status === 'APPROVED')
      Object.assign(update, {
        approvedAt: new Date().toISOString(),
        verificationStatus: 'VERIFIED',
      });
    if (status === 'QR_ISSUED')
      Object.assign(update, {
        qrIssuedAt: new Date().toISOString(),
        qrStatus: 'ISSUED',
      });
    if (status === 'OPERATING') update.qrStatus = 'ACTIVE';
    if (['PAUSED', 'ENDED', 'REVERIFY_REQUIRED'].includes(status))
      update.qrStatus = 'PAUSED';
    const row = await this.partners
      .findOneAndUpdate(
        { partnerId, status: current.status },
        { $set: update },
        { new: true },
      )
      .lean();
    if (!row) throw new NotFoundException();
    return row;
  }
  async adminBenefit(
    benefitId: string,
    approvalStatus: string,
    publicationStatus?: string,
  ) {
    if (!['APPROVED', 'REJECTED', 'REVERIFY_REQUIRED'].includes(approvalStatus))
      throw new BadRequestException();
    if (
      publicationStatus &&
      !['DRAFT', 'PUBLIC', 'PAUSED', 'ENDED'].includes(publicationStatus)
    )
      throw new BadRequestException('unsupported publicationStatus');
    return this.benefits
      .findOneAndUpdate(
        { benefitId },
        {
          $set: {
            approvalStatus,
            ...(publicationStatus ? { publicationStatus } : {}),
          },
        },
        { new: true },
      )
      .lean();
  }
  async adminIssueManagementKey(partnerId: string) {
    const current: any = await this.partners.findOne({ partnerId }).lean();
    if (!current) throw new NotFoundException();
    const key = randomBytes(24).toString('base64url'),
      issuedAt = new Date(),
      version = (current.managementKeyVersion || 0) + 1,
      action = current.managementKeyHash ? 'ROTATED' : 'ISSUED',
      versionFilter =
        current.managementKeyVersion === undefined
          ? { managementKeyVersion: { $exists: false } }
          : { managementKeyVersion: current.managementKeyVersion },
      keyFilter = current.managementKeyHash
        ? { managementKeyHash: current.managementKeyHash }
        : { managementKeyHash: { $exists: false } };
    const partner = await this.partners
      .findOneAndUpdate(
        { partnerId, ...versionFilter, ...keyFilter },
        {
          $set: {
            managementKeyHash: this.hash(key),
            managementKeyVersion: version,
            managementKeyIssuedAt: issuedAt,
          },
          $unset: { managementKeyRevokedAt: 1 },
          $push: {
            managementKeyAudit: this.keyAudit(
              version,
              action,
              'ADMIN',
              issuedAt,
            ),
          },
        },
        { new: true },
      )
      .lean();
    if (!partner) throw new NotFoundException();
    return {
      partnerId,
      managementKey: key,
      managementKeyNotice:
        '이 키는 다시 표시되지 않습니다. 확인된 운영 주체에게 안전한 별도 채널로 전달하세요.',
    };
  }
  async adminRevokeManagementKey(partnerId: string) {
    const current: any = await this.partners.findOne({ partnerId }).lean();
    if (!current?.managementKeyHash) throw new NotFoundException();
    const revokedAt = new Date(),
      keyVersion = current.managementKeyVersion || 0,
      versionFilter =
        current.managementKeyVersion === undefined
          ? { managementKeyVersion: { $exists: false } }
          : { managementKeyVersion: current.managementKeyVersion };
    const partner: any = await this.partners
      .findOneAndUpdate(
        {
          partnerId,
          managementKeyHash: current.managementKeyHash,
          ...versionFilter,
        },
        {
          $unset: { managementKeyHash: 1 },
          $set: { managementKeyRevokedAt: revokedAt },
          $push: {
            managementKeyAudit: this.keyAudit(
              keyVersion,
              'REVOKED',
              'ADMIN',
              revokedAt,
            ),
          },
        },
        { new: true },
      )
      .lean();
    if (!partner) throw new NotFoundException();
    return {
      partnerId: partner.partnerId,
      managementKeyVersion: partner.managementKeyVersion || 0,
      revokedAt,
    };
  }

  private keyAudit(
    keyVersion: number,
    action: 'ISSUED' | 'ROTATED' | 'REVOKED',
    actor: 'ADMIN' | 'SELF_APPLICATION',
    occurredAt: Date,
  ) {
    return {
      eventId: `partner-key-audit-${randomUUID()}`,
      keyVersion,
      action,
      actor,
      occurredAt,
    };
  }
  async metrics(slug: string, key: string) {
    const p = await this.owned(slug, key),
      rows: any[] = await this.activities
        .find({ partnerId: p.partnerId })
        .lean(),
      count = (t: string) => rows.filter((x) => x.eventType === t).length;
    return {
      partnerId: p.partnerId,
      regionId: p.regionId,
      qrEntries: count('PARTNER_QR_ENTRY'),
      recommendations: count('PARTNER_RECOMMENDATION_SHOWN'),
      qrVisits: count('QR_VISIT_CONFIRMED'),
      benefitRequests: count('BENEFIT_USE_REQUESTED'),
      benefitUses: count('BENEFIT_USE_CONFIRMED'),
    };
  }
  async qrAsset(
    slug: string,
    key: string,
    input: { kind?: string; format?: string; test?: boolean },
  ) {
    const partner = await this.owned(slug, key),
      kind = input.kind === 'visit' ? 'visit' : 'go',
      format = input.format === 'png' ? 'png' : 'svg',
      test = input.test === true;
    const configured = process.env.PUBLIC_BASE_URL;
    if (!test) {
      if (!isPublicPartner(partner))
        throw new ForbiddenException(
          '운영 승인된 파트너만 인쇄용 QR을 생성할 수 있습니다.',
        );
      if (!configured)
        throw new ForbiddenException(
          'PUBLIC_BASE_URL is required for print QR',
        );
      const host = new URL(configured).hostname.toLowerCase();
      if (host !== 'exkovia.com' && !host.endsWith('.exkovia.com'))
        throw new ForbiddenException(
          '인쇄용 QR은 exkovia.com 확보 후 생성할 수 있습니다.',
        );
    }
    const base = (configured || 'http://localhost:8090').replace(/\/$/, '');
    const target = `${base}/${kind}/${encodeURIComponent(partner.partnerSlug)}`;
    const data =
      format === 'png'
        ? await QRCode.toBuffer(target, {
            type: 'png',
            errorCorrectionLevel: 'M',
            margin: 4,
            width: 640,
          })
        : await QRCode.toString(target, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 4,
            width: 640,
          });
    return {
      data,
      contentType: format === 'png' ? 'image/png' : 'image/svg+xml',
      filename: `${partner.partnerSlug}-${kind}-${test ? 'test' : 'print'}.${format}`,
      target,
      test,
    };
  }
  async recommendationShown(
    partnerId: string,
    regionId: string,
    anonymousTripId: string,
  ) {
    this.validIdentity(anonymousTripId, regionId);
    const p: any = await this.partners
      .findOne({
        partnerId,
        regionId,
        status: 'OPERATING',
        qrStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      })
      .lean();
    if (!p) return { accepted: false };
    await this.event(
      'PARTNER_RECOMMENDATION_SHOWN',
      p,
      anonymousTripId,
      {},
      `recommendation:${p.partnerId}:${anonymousTripId}`,
    );
    return { accepted: true };
  }
  async recommendationsShownForEntities(
    regionId: string,
    anonymousTripId: string,
    entityIds: string[],
  ) {
    this.validIdentity(anonymousTripId, regionId);
    const safeIds = [
      ...new Set((entityIds || []).filter((x) => typeof x === 'string')),
    ].slice(0, 20);
    const partners: any[] = await this.partners
      .find({
        regionId,
        canonicalEntityId: { $in: safeIds },
        status: 'OPERATING',
        qrStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      })
      .lean();
    await Promise.all(
      partners.map((partner) =>
        this.event(
          'PARTNER_RECOMMENDATION_SHOWN',
          partner,
          anonymousTripId,
          { canonicalEntityId: partner.canonicalEntityId },
          `recommendation:${partner.partnerId}:${anonymousTripId}`,
        ),
      ),
    );
    return { accepted: true, count: partners.length };
  }
  private event(
    eventType: string,
    p: any,
    anonymousTripId: string,
    metadata: any = {},
    dedupeKey?: string,
  ) {
    return this.activities
      .create({
        activityId: `activity-${randomUUID()}`,
        eventType,
        partnerId: p.partnerId,
        regionId: p.regionId,
        anonymousTripId,
        metadata,
        dedupeKey,
      })
      .catch((error: any) => {
        if (error?.code === 11000) return undefined;
        throw error;
      });
  }
  private async releaseReservation(benefitId: string, requestedAt: Date) {
    await this.benefits.updateOne(
      { benefitId, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
    );
    await this.dailyCounters.updateOne(
      {
        counterId: `${benefitId}:${seoulDateKey(new Date(requestedAt))}`,
        count: { $gt: 0 },
      },
      { $inc: { count: -1 } },
    );
  }
  private async expireStaleRedemptions(benefitId: string) {
    for (let index = 0; index < 100; index += 1) {
      const stale: any = await this.redemptions.findOneAndUpdate(
        { benefitId, status: 'REQUESTED', expiresAt: { $lte: new Date() } },
        { $set: { status: 'EXPIRED', decidedAt: new Date() } },
        { new: false },
      );
      if (!stale) break;
      await this.releaseReservation(stale.benefitId, stale.requestedAt);
      await this.event(
        'BENEFIT_USE_EXPIRED',
        { partnerId: stale.partnerId, regionId: stale.regionId },
        stale.anonymousTripId,
        { benefitId: stale.benefitId, redemptionId: stale.redemptionId },
        `redemption-decision:${stale.redemptionId}`,
      );
    }
  }
}
