/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  monthlyWindow,
  publicNetwork,
  releaseNetwork,
  rolling30dWindow,
  TourismNetworkAggregationService,
} from './tourism-network-aggregation.service';

const partner = (id: string, category = 'RESTAURANT') => ({
  partnerId: id,
  canonicalEntityId: `entity:${id}`,
  displayName: `장소 ${id}`,
  category,
});
const query = (rows: any[]) => ({ lean: jest.fn().mockResolvedValue(rows) });
const flow = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const requiredIndexes = () => [
  { name: '_id_', key: { _id: 1 } },
  { name: 'aggregateKey_1', key: { aggregateKey: 1 }, unique: true },
  {
    name: 'regionId_1_kind_1_periodKey_1',
    key: { regionId: 1, kind: 1, periodKey: 1 },
    unique: true,
  },
  { name: 'expiresAt_1', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
];

describe('tourism network aggregation', () => {
  beforeEach(() => {
    process.env.REGIONAL_NETWORK_MAINTENANCE_APPROVED = 'true';
  });

  afterEach(() => {
    delete process.env.REGIONAL_NETWORK_MAINTENANCE_APPROVED;
  });
  it('uses the last completed Seoul day for a fixed rolling 30-day window', () => {
    expect(rolling30dWindow(new Date('2026-08-30T05:00:00Z'))).toEqual({
      periodKey: '2026-07-31/2026-08-30',
      start: new Date('2026-07-30T15:00:00.000Z'),
      end: new Date('2026-08-29T15:00:00.000Z'),
    });
    expect(monthlyWindow('2026-07')).toEqual({
      periodKey: '2026-07',
      start: new Date('2026-06-30T15:00:00.000Z'),
      end: new Date('2026-07-31T15:00:00.000Z'),
    });
  });

  it('requires five distinct anonymous flows and counts repeated emitters once per cell', () => {
    const partners = [
        partner('a', 'ACCOMMODATION'),
        partner('b'),
        partner('c', 'CAFE'),
      ],
      activities: any[] = [],
      events: any[] = [];
    for (let index = 0; index < 5; index += 1) {
      const identity = flow(index);
      activities.push({
        eventType: 'PARTNER_QR_ENTRY',
        anonymousTripId: identity,
        partnerId: 'a',
        createdAt: '2026-08-01T00:00:00Z',
      });
      events.push({
        eventType: 'ENTITY_DETAIL_OPENED',
        sessionId: identity,
        metadata: { entityId: 'entity:b' },
        createdAt: '2026-08-01T00:01:00Z',
      });
      events.push({
        eventType: 'ENTITY_DETAIL_OPENED',
        sessionId: identity,
        metadata: { entityId: 'entity:b' },
        createdAt: '2026-08-01T00:02:00Z',
      });
    }
    for (let index = 0; index < 4; index += 1) {
      const identity = flow(index + 10);
      activities.push({
        eventType: 'PARTNER_QR_ENTRY',
        anonymousTripId: identity,
        partnerId: 'a',
        createdAt: '2026-08-01T00:00:00Z',
      });
      events.push({
        eventType: 'NAVIGATION_HANDOFF',
        sessionId: identity,
        metadata: { entityId: 'entity:c' },
        createdAt: '2026-08-01T00:01:00Z',
      });
    }
    const result = releaseNetwork(events, activities, partners, 5);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      sourcePartnerId: 'a',
      targetPartnerId: 'b',
      stage: 'INTEREST',
      total: 5,
      unit: '연결 이벤트 횟수',
    });
    expect(result.nodes.map((x) => x.partnerId)).toEqual(['a', 'b']);
    expect(result.nodes.every((x) => /^node-[0-9a-f]{20}$/.test(x.id))).toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /session-|rare-|anonymousTripId|sessionId|createdAt|entity:c/,
    );
  });

  it('never joins missing, malformed, oversized, or unequal flow identifiers', () => {
    const activities = [
        {
          eventType: 'PARTNER_QR_ENTRY',
          anonymousTripId: flow(1),
          partnerId: 'a',
          createdAt: '2026-08-01T00:00:00Z',
        },
      ],
      events = ['missing', 'not-a-uuid', 'x'.repeat(200), flow(2)].map(
        (sessionId) => ({
          eventType: 'ENTITY_DETAIL_OPENED',
          sessionId: sessionId === 'missing' ? undefined : sessionId,
          metadata: { entityId: 'entity:b' },
          createdAt: '2026-08-01T00:01:00Z',
        }),
      );
    expect(
      releaseNetwork(events, activities, [partner('a'), partner('b')], 1),
    ).toMatchObject({ status: 'PREPARING', edges: [], nodes: [] });
  });

  it('removes internal partner identifiers and currently ineligible nodes at serialization', () => {
    const released = releaseNetwork(
      Array.from({ length: 5 }, (_, index) => ({
        eventType: 'ENTITY_DETAIL_OPENED',
        sessionId: flow(index),
        metadata: { entityId: 'entity:b' },
        createdAt: '2026-08-01T00:01:00Z',
      })),
      Array.from({ length: 5 }, (_, index) => ({
        eventType: 'PARTNER_QR_ENTRY',
        anonymousTripId: flow(index),
        partnerId: 'a',
        createdAt: '2026-08-01T00:00:00Z',
      })),
      [partner('a'), partner('b')],
      5,
    );
    const visible = publicNetwork(released, new Set(['a', 'b']));
    expect(visible.status).toBe('AVAILABLE');
    expect(JSON.stringify(visible)).not.toMatch(
      /partnerId|entityId|canonical|sourceRevision|session|trip|redemption/,
    );
    expect(publicNetwork(released, new Set(['a']))).toMatchObject({
      status: 'PREPARING',
      nodes: [],
      edges: [],
      stageTotals: [],
      categoryConnections: [],
    });
  });

  it('uses deterministic upsert keys so reruns and late events replace one snapshot', async () => {
    const events = { find: jest.fn().mockReturnValue(query([])) },
      activities = { find: jest.fn().mockReturnValue(query([])) },
      partners = { find: jest.fn().mockReturnValue(query([])) },
      lean = jest.fn().mockResolvedValue({}),
      aggregates = {
        collection: {
          listIndexes: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue(requiredIndexes()),
          }),
        },
        findOneAndUpdate: jest.fn().mockReturnValue({ lean }),
      },
      service = new TourismNetworkAggregationService(
        events as any,
        activities as any,
        partners as any,
        aggregates as any,
      ),
      now = new Date('2026-08-30T05:00:00Z');
    await service.generate('hapcheon', 'ROLLING_30D', undefined, now, 5);
    await service.generate('hapcheon', 'ROLLING_30D', undefined, now, 5);
    const calls = aggregates.findOneAndUpdate.mock.calls as unknown as Array<
      [Record<string, string>, unknown, Record<string, unknown>]
    >;
    expect(aggregates.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(calls[0][0]).toMatchObject({
      aggregateKey: 'hapcheon:ROLLING_30D:2026-07-31/2026-08-30',
    });
    expect(Array.isArray(calls[0][0].$or)).toBe(true);
    expect(calls[1][0]).toEqual(calls[0][0]);
    expect(calls[0][2]).toMatchObject({
      new: true,
    });
    expect(calls[0][2]).not.toHaveProperty('upsert');
  });

  it('fails closed before reads or writes without explicit snapshot approval', async () => {
    delete process.env.REGIONAL_NETWORK_MAINTENANCE_APPROVED;
    const events = { find: jest.fn() },
      activities = { find: jest.fn() },
      partners = { find: jest.fn() },
      aggregates = {
        collection: { listIndexes: jest.fn() },
        findOneAndUpdate: jest.fn(),
        create: jest.fn(),
      },
      service = new TourismNetworkAggregationService(
        events as any,
        activities as any,
        partners as any,
        aggregates as any,
      );
    await expect(service.generate('hapcheon', 'ROLLING_30D')).rejects.toThrow(
      'Explicit snapshot maintenance approval is required',
    );
    expect(aggregates.collection.listIndexes).not.toHaveBeenCalled();
    expect(events.find).not.toHaveBeenCalled();
    expect(aggregates.findOneAndUpdate).not.toHaveBeenCalled();
    expect(aggregates.create).not.toHaveBeenCalled();
  });

  it('fails closed without creating a collection when snapshot indexes are absent', async () => {
    const events = { find: jest.fn() },
      activities = { find: jest.fn() },
      partners = { find: jest.fn() },
      aggregates = {
        collection: {
          listIndexes: jest.fn().mockReturnValue({
            toArray: jest.fn().mockRejectedValue({ code: 26 }),
          }),
        },
        findOneAndUpdate: jest.fn(),
        create: jest.fn(),
      },
      service = new TourismNetworkAggregationService(
        events as any,
        activities as any,
        partners as any,
        aggregates as any,
      );
    await expect(service.generate('hapcheon', 'ROLLING_30D')).rejects.toThrow(
      'Regional network snapshot indexes are not ready',
    );
    expect(events.find).not.toHaveBeenCalled();
    expect(activities.find).not.toHaveBeenCalled();
    expect(partners.find).not.toHaveBeenCalled();
    expect(aggregates.findOneAndUpdate).not.toHaveBeenCalled();
    expect(aggregates.create).not.toHaveBeenCalled();
  });
});
