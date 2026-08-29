import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PilotEvent, PilotEventDocument } from '../schemas/pilot-event.schema';
import {
  Partner,
  PartnerActivity,
  PartnerActivityDocument,
  PartnerDocument,
} from '../partner/partner.schema';

export type ReportPeriod = 'today' | '7d' | '30d';
const PERIOD_DAYS: Record<ReportPeriod, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
};
const REGION_NAMES: Record<string, string> = {
  gajo: '가조',
  okcheon: '옥천',
  muan: '무안',
  gyeryong: '계룡',
  hapcheon: '합천',
  'daejeon-junggu': '대전 중구',
};
const safeCell = (total: number, min: number) =>
  total < min
    ? { status: 'SUPPRESSED' as const, label: `${min}건 미만` }
    : { status: 'AVAILABLE' as const, total };
const minimumCellSize = () => {
  const raw = process.env.REGIONAL_REPORT_MIN_CELL_SIZE;
  if (raw === undefined || raw === '') return 5;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 2 || value > 100) return 5;
  return value;
};
const seoulWindow = (period: ReportPeriod, now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now),
    get = (t: string) => parts.find((p) => p.type === t)!.value;
  const end = new Date(
    `${get('year')}-${get('month')}-${get('day')}T15:00:00.000Z`,
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - PERIOD_DAYS[period]);
  return { start, end };
};
@Injectable()
export class RegionalReportService {
  constructor(
    @InjectModel(PilotEvent.name) private events: Model<PilotEventDocument>,
    @InjectModel(PartnerActivity.name)
    private activities: Model<PartnerActivityDocument>,
    @InjectModel(Partner.name) private partners: Model<PartnerDocument>,
  ) {}
  async report(
    regionId: string,
    periodValue: string | undefined,
    now = new Date(),
  ) {
    const period = (periodValue || '7d') as ReportPeriod;
    if (!PERIOD_DAYS[period])
      throw new BadRequestException('period must be today, 7d, or 30d');
    const { start, end } = seoulWindow(period, now),
      range = { regionId, createdAt: { $gte: start, $lt: end } };
    const [events, activities, partners] = await Promise.all([
      this.events.find(range).lean(),
      this.activities.find(range).lean(),
      this.partners
        .find({
          regionId,
          status: 'OPERATING',
          qrStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .lean(),
    ]);
    const count = (type: string) =>
      events.filter((x) => x.eventType === type).length;
    const movement = {
      map: count('MAP_OPENED'),
      navigation: count('NAVIGATION_HANDOFF') + count('JOURNEY_START_ACTION'),
      phone: count('PHONE_HANDOFF'),
      booking: count('BOOKING_HANDOFF'),
      website: count('WEBSITE_HANDOFF'),
    };
    const movementTotal = Object.values(movement).reduce((a, b) => a + b, 0),
      detail = count('PLACE_DETAIL_OPENED') + count('ENTITY_DETAIL_OPENED'),
      interest = count('RECOMMENDATION_SHOWN') + detail,
      min = minimumCellSize();
    const grouped = (type: string, key: string) =>
      Object.entries(
        events
          .filter((x) => x.eventType === type)
          .reduce((a: Record<string, number>, x: any) => {
            const label = String(x.metadata?.[key] || 'direct');
            a[label] = (a[label] || 0) + 1;
            return a;
          }, {}),
      ).map(([label, total]) => ({ label, value: safeCell(total, min) }));
    const categoryAliases: Record<string, string> = {
      TOURIST_ATTRACTION: '관광·체험',
      TOURISM_NATURE: '관광·체험',
      ACTIVITY: '관광·체험',
      EXPERIENCE: '관광·체험',
      LODGING: '숙소',
      ACCOMMODATION: '숙소',
      FOOD: '음식점',
      RESTAURANT: '음식점',
      CAFE: '카페',
      CONVENIENCE: '생활편의',
      LOCAL_CONVENIENCE: '생활편의',
    };
    const categoryTotals: Record<string, number> = {
      '관광·체험': 0,
      숙소: 0,
      음식점: 0,
      카페: 0,
      생활편의: 0,
    };
    events
      .filter((x) =>
        ['PLACE_DETAIL_OPENED', 'ENTITY_DETAIL_OPENED'].includes(x.eventType),
      )
      .forEach((x: any) => {
        const label = categoryAliases[String(x.metadata?.category || '')];
        if (label) categoryTotals[label]++;
      });
    const partnerById = new Map(partners.map((p: any) => [p.partnerId, p])),
      partnerTotals = new Map<string, Record<string, number>>();
    const eligibleActivities = activities.filter((x: any) =>
      partnerById.has(x.partnerId),
    );
    eligibleActivities.forEach((x: any) => {
      if (!partnerById.has(x.partnerId)) return;
      const row = partnerTotals.get(x.partnerId) || {};
      row[x.eventType] = (row[x.eventType] || 0) + 1;
      partnerTotals.set(x.partnerId, row);
    });
    return {
      schemaVersion: 1,
      region: { id: regionId, name: REGION_NAMES[regionId] || regionId },
      period: {
        key: period,
        timeZone: 'Asia/Seoul',
        start: start.toISOString(),
        endExclusive: end.toISOString(),
      },
      generatedAt: now.toISOString(),
      privacy: {
        minimumCellSize: min,
        detailSuppression: true,
        notice:
          '개인의 위치와 이동경로는 표시하지 않으며 익명·집계된 이용 흐름만 제공합니다.',
      },
      summary: {
        anonymousSessions: new Set(events.map((x: any) => x.sessionId)).size,
        aiGuideStarts:
          count('SESSION_STARTED') +
          count('SESSION_RESUMED') +
          count('PLAN_SESSION_STARTED') +
          count('NOW_SESSION_STARTED'),
        recommendationImpressions: count('RECOMMENDATION_SHOWN'),
        movementIntent: movementTotal,
        searchFailures: count('SEARCH_FALLBACK_USED') + count('RETRY_ERROR'),
      },
      funnel: [
        {
          stage: '관심',
          status: 'AVAILABLE',
          total: interest,
          unit: '이벤트 횟수',
        },
        {
          stage: '이동 의도',
          status: 'AVAILABLE',
          total: movementTotal,
          unit: '연결 횟수',
        },
        {
          stage: '현장 QR 확인',
          status: partners.length ? 'AVAILABLE' : 'PREPARING',
          ...(partners.length
            ? {
                total: eligibleActivities.filter(
                  (x: any) => x.eventType === 'QR_VISIT_CONFIRMED',
                ).length,
                unit: '확인 건수',
              }
            : { label: '측정 준비 중', supported: false }),
        },
        {
          stage: '실제 이용',
          status: partners.length ? 'AVAILABLE' : 'PREPARING',
          ...(partners.length
            ? {
                total: eligibleActivities.filter(
                  (x: any) => x.eventType === 'BENEFIT_USE_CONFIRMED',
                ).length,
                unit: '검증 건수',
                supported: true,
              }
            : { label: '측정 준비 중', supported: false }),
        },
      ],
      categories: Object.entries(categoryTotals).map(([label, total]) => ({
        label,
        total,
        unit: '상세조회 횟수',
      })),
      features: {
        quickIntent: count('QUICK_INTENT_SELECTED'),
        freeLanguage: count('FREE_LANGUAGE_REQUEST'),
        intentRouted: count('INTENT_ROUTED'),
        recommendation: count('RECOMMENDATION_SHOWN'),
        ...movement,
      },
      entrySources: grouped('ENTRY_SOURCE', 'source'),
      errors: {
        fallback: count('SEARCH_FALLBACK_USED'),
        retry: count('RETRY_ERROR'),
      },
      partners: [...partnerTotals].map(([id, row]) => {
        const p: any = partnerById.get(id);
        return {
          entityId: p.canonicalEntityId,
          name: p.displayName,
          impressions: safeCell(row.PARTNER_RECOMMENDATION_SHOWN || 0, min),
          detail: { status: 'PREPARING', label: '측정 준비 중' },
          movement: { status: 'PREPARING', label: '측정 준비 중' },
          qr: safeCell(row.QR_VISIT_CONFIRMED || 0, min),
          verifiedUses: safeCell(row.BENEFIT_USE_CONFIRMED || 0, min),
        };
      }),
    };
  }
}
export { minimumCellSize, seoulWindow, safeCell };
