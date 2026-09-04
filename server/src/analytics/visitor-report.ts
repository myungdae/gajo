import { BadRequestException } from '@nestjs/common';
import { TRAFFIC_CLASSES } from './visitor-contract';
export const MIN_SESSIONS = 5;
export function visitorPeriod(q: Record<string, unknown>, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const day = (s: string) => new Date(s + 'T00:00:00+09:00');
  const date = (s: unknown) =>
    typeof s === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(s) &&
    Number.isFinite(day(s).getTime()) &&
    new Date(day(s).getTime() + 32400000).toISOString().slice(0, 10) === s;
  const period = String(q.period || '7d');
  let start: Date, end: Date;
  if (period === 'custom') {
    if (!date(q.from) || !date(q.to))
      throw new BadRequestException('Valid from/to dates required');
    start = day(q.from as string);
    end = new Date(day(q.to as string).getTime() + 86400000);
  } else {
    if (!['today', 'yesterday', '7d', '30d'].includes(period))
      throw new BadRequestException('Invalid period');
    end = new Date(
      day(today).getTime() + (period === 'yesterday' ? 0 : 86400000),
    );
    start = new Date(
      end.getTime() -
        (period === '7d' ? 7 : period === '30d' ? 30 : 1) * 86400000,
    );
  }
  if (
    end <= start ||
    end.getTime() - start.getTime() > 90 * 86400000 ||
    start > now
  )
    throw new BadRequestException(
      'Period must be 1–90 days and not start in the future',
    );
  return { key: period, start, endExclusive: end, timeZone: 'Asia/Seoul' };
}
type Row = Record<string, any>;
const sessions = (rows: Row[]) =>
  new Set(rows.map((r) => r.visitSessionId)).size;
const cell = (value: number, rows: Row[]) => ({
  value: sessions(rows) >= MIN_SESSIONS ? value : null,
  status: sessions(rows) >= MIN_SESSIONS ? 'AVAILABLE' : 'SUPPRESSED',
});
const partition = (groups: Array<{ label: string; rows: Row[] }>) => {
  // Hide the entire partition if one nonempty cell is small: no complementary subtraction.
  const hidden = groups.some(
    (g) => g.rows.length && sessions(g.rows) < MIN_SESSIONS,
  );
  return groups.map((g) => ({
    label: g.label,
    events: hidden ? null : g.rows.length,
    visitSessions: hidden ? null : sessions(g.rows),
    status: hidden ? 'SUPPRESSED' : 'AVAILABLE',
  }));
};
export function buildVisitorReport(
  all: Row[],
  period: ReturnType<typeof visitorPeriod>,
  includeInternal: boolean,
  now = new Date(),
  collectionStartedAt: Date | null = null,
  legacyPresent = false,
) {
  const rows = all.filter(
    (r) =>
      includeInternal ||
      !['INTERNAL_TEST', 'AUTOMATED_CHECK'].includes(r.trafficClass),
  );
  const group = (field: string) =>
    partition(
      [...new Set(rows.map((r) => String(r[field] || 'unknown')))]
        .sort()
        .map((label) => ({
          label,
          rows: rows.filter((r) => String(r[field] || 'unknown') === label),
        })),
    );
  const visitLanguages = new Map<string, Set<string>>();
  rows.forEach((r) => {
    const set = visitLanguages.get(r.visitSessionId) || new Set<string>();
    set.add(r.uiLocale);
    visitLanguages.set(r.visitSessionId, set);
  });
  const languageRows = rows.map((r) => {
    const langs = visitLanguages.get(r.visitSessionId)!;
    return {
      ...r,
      language:
        langs.has('ko') && langs.has('en')
          ? 'mixed'
          : langs.has('unknown')
            ? 'unknown'
            : langs.has('en')
              ? 'en'
              : 'ko',
    };
  });
  const funnelGroups = [
    new Set<string>(),
    new Set<string>(),
    new Set<string>(),
    new Set<string>(),
  ];
  const byVisit = new Map<string, Row[]>();
  rows.forEach((r) =>
    byVisit.set(r.visitSessionId, [
      ...(byVisit.get(r.visitSessionId) || []),
      r,
    ]),
  );
  for (const [visit, events] of byVisit) {
    const searches = new Set<string>(),
      results = new Map<string, string>(),
      details = new Set<string>();
    for (const r of events.sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() ||
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
    )) {
      if (r.eventType === 'NEARBY_SEARCH_SUBMITTED') {
        searches.add(r.searchId);
        funnelGroups[0].add(visit);
      }
      if (
        r.eventType === 'SEARCH_RESULTS_SHOWN' &&
        r.resultCount > 0 &&
        searches.has(r.searchId)
      ) {
        results.set(r.resultSetId, r.searchId);
        funnelGroups[1].add(visit);
      }
      if (
        r.eventType === 'PLACE_DETAIL_OPENED' &&
        results.get(r.resultSetId) === r.searchId &&
        r.searchId
      ) {
        details.add(r.searchId + '|' + r.resultSetId + '|' + r.placeKey);
        funnelGroups[2].add(visit);
      }
      if (
        [
          'PHONE_CLICKED',
          'DIRECTIONS_CLICKED',
          'ITINERARY_SAVE_SUCCEEDED',
        ].includes(r.eventType) &&
        details.has(r.searchId + '|' + r.resultSetId + '|' + r.placeKey)
      )
        funnelGroups[3].add(visit);
    }
  }
  const funnelHidden =
    funnelGroups.some((g) => g.size > 0 && g.size < MIN_SESSIONS) ||
    sessions(rows) < MIN_SESSIONS;
  const dates = [
    ...new Set(
      rows.map((r) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(r.receivedAt)),
      ),
    ),
  ];
  const result = {
    schemaVersion: 2,
    period,
    generatedAt: now.toISOString(),
    collectionStartedAt,
    includeInternal,
    definitions: {
      visitSession: '30분 비활동 후 새 방문 세션. 실제 사람 수가 아닙니다.',
      anonymousTrip: '복원 가능한 익명 여행 ID. 방문 세션과 다릅니다.',
      dateBasis: 'receivedAt / Asia/Seoul',
      funnel:
        '같은 방문 세션·검색·결과·장소의 발생 순서. 행동은 전화·길찾기·저장 중 하나.',
      exclusions: includeInternal
        ? '내부 검증·자동 점검 포함'
        : 'INTERNAL_TEST, AUTOMATED_CHECK 제외',
      legacy: 'legacy/unknown: v2 통계와 합산하거나 소급 분류하지 않음',
    },
    privacy: {
      minimumDistinctVisitSessions: MIN_SESSIONS,
      complementarySuppression: true,
      individualPathsReturned: false,
    },
    legacy: {
      present: legacyPresent,
      label: 'legacy/unknown · 신규 통계에서 제외',
    },
    onsite: { supported: false, label: '강한 현장 확인 미지원' },
    totals: {
      events: cell(rows.length, rows),
      visitSessions: cell(sessions(rows), rows),
      anonymousTrips: cell(
        new Set(rows.map((r) => r.anonymousTripId)).size,
        rows,
      ),
    },
    exclusionCounts: partition(
      ['INTERNAL_TEST', 'AUTOMATED_CHECK'].map((label) => ({
        label,
        rows: all.filter((r) => r.trafficClass === label),
      })),
    ),
    classification: partition(
      TRAFFIC_CLASSES.map((label) => ({
        label,
        rows: rows.filter((r) => r.trafficClass === label),
      })),
    ),
    languages: partition(
      ['ko', 'en', 'mixed', 'unknown'].map((label) => ({
        label,
        rows: languageRows.filter((r) => r.language === label),
      })),
    ),
    screens: group('screen'),
    events: group('eventType'),
    places: partition(
      [...new Set(rows.filter((r) => r.placeKey).map((r) => r.placeKey))]
        .sort()
        .flatMap((place) =>
          [
            'PHONE_CLICKED',
            'DIRECTIONS_CLICKED',
            'ITINERARY_SAVE_SUCCEEDED',
          ].map((type) => ({
            label: place + ' · ' + type,
            rows: rows.filter(
              (r) => r.placeKey === place && r.eventType === type,
            ),
          })),
        ),
    ),
    days: partition(
      dates
        .sort()
        .map((label) => ({
          label,
          rows: rows.filter(
            (r) =>
              new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              }).format(new Date(r.receivedAt)) === label,
          ),
        })),
    ),
    funnel: ['검색', '결과 노출', '상세', '행동'].map((label, i) => ({
      label,
      visitSessions: funnelHidden ? null : funnelGroups[i].size,
      status: funnelHidden ? 'SUPPRESSED' : 'AVAILABLE',
    })),
  };
  // Inclusion toggles cannot reveal a small excluded cohort by subtraction.
  const protectedInclusion =
    includeInternal &&
    ['INTERNAL_TEST', 'AUTOMATED_CHECK'].some((type) => {
      const cohort = all.filter((r) => r.trafficClass === type);
      return cohort.length > 0 && sessions(cohort) < MIN_SESSIONS;
    });
  if (protectedInclusion) {
    for (const key of ['events', 'visitSessions', 'anonymousTrips'] as const)
      result.totals[key] = { value: null as any, status: 'SUPPRESSED' };
    for (const table of [
      result.classification,
      result.languages,
      result.screens,
      result.events,
      result.places,
      result.days,
      result.exclusionCounts,
    ])
      for (const row of table) {
        row.events = null as any;
        row.visitSessions = null as any;
        row.status = 'SUPPRESSED';
      }
    for (const row of result.funnel) {
      row.visitSessions = null;
      row.status = 'SUPPRESSED';
    }
  }
  return result;
}
