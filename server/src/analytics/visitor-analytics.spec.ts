import { randomUUID } from 'node:crypto';
import { validateVisitorEvent, VISITOR_REGIONS } from './visitor-contract';
import {
  issuePlaceProof,
  verifyPlaceProof,
  issueTestMarker,
  verifyTestMarker,
} from './visitor-evidence';
import {
  VisitorAnalyticsService,
  authorizeAnalyticsRegion,
} from './visitor-analytics.service';
import { VisitorAnalyticsEventSchema } from './visitor-event.schema';
import { buildVisitorReport, visitorPeriod } from './visitor-report';
const now = new Date('2026-09-04T03:00:00.000Z');
const event = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  eventId: randomUUID(),
  eventType: 'REGION_HOME_VIEWED',
  regionId: 'hapcheon',
  anonymousTripId: randomUUID(),
  visitSessionId: randomUUID(),
  pageViewId: randomUUID(),
  screen: 'HOME',
  uiLocale: 'ko',
  occurredAt: now.toISOString(),
  ...extra,
});
function harness() {
  const rows: any[] = [];
  const model = {
    create: jest.fn(async (v: any) => {
      if (rows.some((r) => r._id === v._id)) throw { code: 11000 };
      rows.push(v);
    }),
    findById: (id: string) => ({
      lean: async () => rows.find((r) => r._id === id),
    }),
  };
  const state = { updateOne: jest.fn(async () => {}) };
  const service = new VisitorAnalyticsService(
    model as any,
    {} as any,
    { exists: async (q: any) => q.partnerSlug === 'approved' } as any,
    {
      effectiveDataset: async (region: string) => ({
        records: region === 'hapcheon' ? [{ entityUri: 'place:hapcheon' }] : [],
      }),
    } as any,
    state as any,
    {
      findById: () => ({ lean: async () => null }),
      updateOne: jest.fn(),
    } as any,
  );
  return { rows, model, service, state };
}
describe('visitor analytics contract', () => {
  it.each(VISITOR_REGIONS)('accepts the required contract for %s', (regionId) =>
    expect(validateVisitorEvent(event({ regionId }), now).regionId).toBe(
      regionId,
    ),
  );
  it.each([
    'rawMessage',
    'latitude',
    'longitude',
    'userAgent',
    'ip',
    'referrer',
    'query',
    'voice',
    'fingerprint',
    'trafficClass',
  ])('rejects prohibited or self-asserted %s', (key) =>
    expect(() =>
      validateVisitorEvent(event({ [key]: 'private' }), now),
    ).toThrow(),
  );
  it('rejects missing fields, invalid IDs, invalid dates and unbounded result counts', () => {
    for (const delta of [
      { visitSessionId: '' },
      { uiLocale: 'fr' },
      { occurredAt: '2026-09-04' },
      { eventId: 'x' },
      { schemaVersion: 1 },
      { resultCount: -1 },
      { screen: 'ADMIN' },
    ])
      expect(() => validateVisitorEvent(event(delta), now)).toThrow();
  });
  it('requires action and search correlation fields', () => {
    for (const eventType of [
      'NEARBY_SEARCH_SUBMITTED',
      'SEARCH_RESULTS_SHOWN',
      'PHONE_CLICKED',
      'DIRECTIONS_CLICKED',
      'ITINERARY_SAVE_SUCCEEDED',
    ])
      expect(() => validateVisitorEvent(event({ eventType }), now)).toThrow();
  });
  it('keeps runtime journey stages distinct and requires action correlation for choices', () => {
    for (const eventType of [
      'RUNTIME_JOURNEY_REQUESTED',
      'RUNTIME_JOURNEY_PRESENTED',
    ]) expect(validateVisitorEvent(event({ eventType }), now).eventType).toBe(eventType);
    for (const eventType of [
      'RUNTIME_JOURNEY_STARTED',
      'RUNTIME_JOURNEY_ADJUSTMENT_OPENED',
      'RUNTIME_JOURNEY_REPLAN_REQUESTED',
    ]) {
      expect(() => validateVisitorEvent(event({ eventType }), now)).toThrow();
      expect(validateVisitorEvent(event({ eventType, actionId: randomUUID() }), now).eventType).toBe(eventType);
    }
  });
  it('deduplicates concurrent delivery through the fixed _id and rejects changed payload reuse', async () => {
    const h = harness(),
      v = event();
    await Promise.all([
      h.service.record(v, undefined, now),
      h.service.record(v, undefined, now),
    ]);
    expect(h.rows).toHaveLength(1);
    await expect(
      h.service.record({ ...v, uiLocale: 'en' }, undefined, now),
    ).rejects.toThrow('payload mismatch');
  });
  it('stores only safe fields, uses receive time and sets 90-day retention', async () => {
    const h = harness();
    await h.service.record(event(), undefined, now);
    expect(h.rows[0]).toMatchObject({
      receivedAt: now,
      expiresAt: new Date(now.getTime() + 90 * 86400000),
      trafficClass: 'GENERAL_VISIT',
    });
    expect(h.rows[0].placeProof).toBeUndefined();
    expect(h.state.updateOne).toHaveBeenCalled();
  });
  it('validates canonical place/region and signed search evidence without storing proof', async () => {
    const h = harness();
    await h.service.record(
      event({ eventType: 'PLACE_DETAIL_OPENED', placeKey: 'place:hapcheon' }),
      undefined,
      now,
    );
    await expect(
      h.service.record(
        event({
          regionId: 'muan',
          eventType: 'PLACE_DETAIL_OPENED',
          placeKey: 'place:hapcheon',
        }),
        undefined,
        now,
      ),
    ).rejects.toThrow();
    const placeKey = 'provider:kakao:123',
      placeProof = issuePlaceProof('hapcheon', placeKey, now.getTime());
    await h.service.record(
      event({ eventType: 'PLACE_DETAIL_OPENED', placeKey, placeProof }),
      undefined,
      now,
    );
    expect(h.rows.at(-1).placeProof).toBeUndefined();
  });
  it('attributes registered QR links but never treats them as onsite', async () => {
    const h = harness();
    for (const entryId of [
      'regional-qr:hapcheon',
      'partner:approved',
      'partner:unknown',
      'regional-qr:muan',
    ])
      await h.service.record(event({ entryId }), undefined, now);
    expect(h.rows.map((r) => r.trafficClass)).toEqual([
      'ATTRIBUTED_ENTRY',
      'ATTRIBUTED_ENTRY',
      'UNKNOWN',
      'UNKNOWN',
    ]);
  });
  it('declares unique and query indexes with automatic creation disabled', () => {
    expect(VisitorAnalyticsEventSchema.options.autoIndex).toBe(false);
    expect(VisitorAnalyticsEventSchema.options.autoCreate).toBe(false);
    expect(VisitorAnalyticsEventSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ eventId: 1 }, expect.objectContaining({ unique: true })],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });
});
describe('evidence and region permissions', () => {
  it('requires explicit region scope including for marker issuance', () => {
    expect(() =>
      authorizeAnalyticsRegion(
        { actorId: 'a', allowedRegionIds: [] },
        'hapcheon',
      ),
    ).toThrow();
    expect(() =>
      authorizeAnalyticsRegion(
        { actorId: 'a', allowedRegionIds: ['gajo'] },
        'hapcheon',
      ),
    ).toThrow();
    expect(
      authorizeAnalyticsRegion(
        { actorId: 'a', allowedRegionIds: ['hapcheon'] },
        'hapcheon',
      ),
    ).toBe('hapcheon');
  });
  it('binds server markers to region, visit, kind, signature and expiry', () => {
    const id = randomUUID(),
      token = issueTestMarker('secret', 'hapcheon', id, 'INTERNAL_TEST', 0);
    expect(verifyTestMarker(token, 'secret', 'hapcheon', id, 1)).toBe(
      'INTERNAL_TEST',
    );
    for (const args of [
      [token + 'x', 'secret', 'hapcheon', id, 1],
      [token, 'secret', 'muan', id, 1],
      [token, 'secret', 'hapcheon', randomUUID(), 1],
      [token, 'secret', 'hapcheon', id, 3600000],
    ] as const)
      expect(
        verifyTestMarker(args[0], args[1], args[2], args[3], args[4]),
      ).toBeNull();
  });
  it('does not infer bots from metadata or accept public test flags', () => {
    expect(() => validateVisitorEvent(event({ test: true }), now)).toThrow();
    expect(
      verifyTestMarker(undefined, 'secret', 'hapcheon', randomUUID()),
    ).toBeNull();
  });
  it('rejects expired or forged markers rather than polluting the public population', async () => {
    await expect(
      harness().service.record(event(), 'fake', now),
    ).rejects.toThrow('marker');
  });
  it('a server-bound test visit cannot become general traffic by omitting its marker', async () => {
    const service = new VisitorAnalyticsService(
      { create: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        findById: () => ({ lean: async () => ({ kind: 'INTERNAL_TEST' }) }),
      } as any,
    );
    await expect(service.record(event(), undefined, now)).rejects.toThrow(
      'valid marker',
    );
  });
  it('denies report access before querying another region', async () => {
    const model = { find: jest.fn() },
      service = new VisitorAnalyticsService(
        model as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    await expect(
      service.report(
        { actorId: 'a', allowedRegionIds: ['gajo'] },
        { regionId: 'hapcheon' },
        now,
      ),
    ).rejects.toThrow();
    expect(model.find).not.toHaveBeenCalled();
  });
  it('place evidence expires and cannot cross a region or place', () => {
    const token = issuePlaceProof('hapcheon', 'place', 0);
    expect(verifyPlaceProof(token, 'hapcheon', 'place', 1)).toBe(true);
    expect(verifyPlaceProof(token, 'muan', 'place', 1)).toBe(false);
    expect(verifyPlaceProof(token, 'hapcheon', 'other', 1)).toBe(false);
    expect(verifyPlaceProof(token, 'hapcheon', 'place', 86400000)).toBe(false);
  });
});
describe('Seoul periods and privacy-preserving funnel', () => {
  it.each([
    ['today', '2026-09-03T15:00:00.000Z', '2026-09-04T15:00:00.000Z'],
    ['yesterday', '2026-09-02T15:00:00.000Z', '2026-09-03T15:00:00.000Z'],
    ['7d', '2026-08-28T15:00:00.000Z', '2026-09-04T15:00:00.000Z'],
    ['30d', '2026-08-05T15:00:00.000Z', '2026-09-04T15:00:00.000Z'],
  ])('%s uses Korean calendar boundaries', (period, start, end) => {
    const p = visitorPeriod({ period }, now);
    expect(p.start.toISOString()).toBe(start);
    expect(p.endExclusive.toISOString()).toBe(end);
  });
  it('validates custom dates including rollover and maximum range', () => {
    expect(
      visitorPeriod(
        { period: 'custom', from: '2026-08-31', to: '2026-09-01' },
        now,
      ).start.toISOString(),
    ).toBe('2026-08-30T15:00:00.000Z');
    for (const q of [
      { from: '2026-02-30', to: '2026-03-01' },
      { from: '2026-09-04', to: '2026-09-03' },
      { from: '2025-01-01', to: '2026-09-04' },
    ])
      expect(() => visitorPeriod({ period: 'custom', ...q }, now)).toThrow();
  });
  const chain = (visit: string, trip = visit) =>
    [
      'NEARBY_SEARCH_SUBMITTED',
      'SEARCH_RESULTS_SHOWN',
      'PLACE_DETAIL_OPENED',
      'PHONE_CLICKED',
    ].map((eventType, i) => ({
      ...event({ eventType }),
      visitSessionId: visit,
      anonymousTripId: trip,
      searchId: 'search:' + visit,
      resultSetId: 'result:' + visit,
      placeKey: i >= 2 ? 'place' : undefined,
      resultCount: 2,
      trafficClass: 'GENERAL_VISIT',
      receivedAt: new Date(now.getTime() + i),
      occurredAt: new Date(now.getTime() + i),
    }));
  const report = (rows: any[], include = false) =>
    buildVisitorReport(rows, visitorPeriod({}, now), include, now);
  it('separates events, visits and anonymous trips, counts a period distinct only once', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      chain(String(i), 'one-trip'),
    ).flat();
    const r = report(rows);
    expect(r.totals.events.value).toBe(20);
    expect(r.totals.visitSessions.value).toBe(5);
    expect(r.totals.anonymousTrips.value).toBe(1);
    expect(r.funnel.map((x) => x.visitSessions)).toEqual([5, 5, 5, 5]);
  });
  it('requires order, same search/result/place and same visit for conversion', () => {
    const rows = Array.from({ length: 5 }, (_, i) => chain(String(i))).flat();
    rows
      .filter((r) => r.eventType === 'PHONE_CLICKED')
      .forEach((r) => (r.resultSetId = 'other'));
    expect(report(rows).funnel.at(-1)?.visitSessions).toBe(0);
    rows
      .filter((r) => r.eventType === 'PLACE_DETAIL_OPENED')
      .forEach((r) => (r.occurredAt = new Date(now.getTime() - 1)));
    expect(report(rows).funnel[2].visitSessions).toBe(0);
  });
  it('excludes internal and automated events by default and includes only on request', () => {
    const base = Array.from({ length: 5 }, (_, i) => chain(String(i))).flat(),
      internal = chain('test').map((r) => ({
        ...r,
        trafficClass: 'INTERNAL_TEST',
      })),
      auto = chain('auto').map((r) => ({
        ...r,
        trafficClass: 'AUTOMATED_CHECK',
      }));
    expect(
      report([...base, ...internal, ...auto]).totals.visitSessions.value,
    ).toBe(5);
    expect(
      report([...base, ...internal, ...auto], true).totals.visitSessions.value,
    ).toBeNull();
  });
  it('protects repeated events from one session and complementary cells', () => {
    const one = Array.from({ length: 10 }, () => chain('one')).flat();
    expect(report(one).totals.events.value).toBeNull();
    const rows = Array.from({ length: 6 }, (_, i) => chain(String(i))).flat();
    rows
      .filter((r) => r.visitSessionId === '0')
      .forEach((r) => (r.trafficClass = 'ATTRIBUTED_ENTRY'));
    const r = report(rows);
    expect(
      r.classification.every(
        (c) => c.events === null && c.visitSessions === null,
      ),
    ).toBe(true);
    expect(r.totals.visitSessions.value).toBe(6);
    expect(JSON.stringify(r)).not.toContain('search:0');
  });
  it('reports mixed locale at visit level without looking at question language', () => {
    const rows = Array.from({ length: 5 }, (_, i) => chain(String(i))).flat();
    rows
      .filter((r) => r.eventType === 'PHONE_CLICKED')
      .forEach((r) => (r.uiLocale = 'en'));
    expect(
      report(rows).languages.find((l) => l.label === 'mixed')?.visitSessions,
    ).toBe(5);
  });
  it('allows inclusion when both public and internal cohorts meet the privacy threshold', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      chain(String(i)).map((r) => ({
        ...r,
        trafficClass: i < 5 ? 'GENERAL_VISIT' : 'INTERNAL_TEST',
      })),
    ).flat();
    expect(report(rows).totals.visitSessions.value).toBe(5);
    expect(report(rows, true).totals.visitSessions.value).toBe(10);
  });
});
