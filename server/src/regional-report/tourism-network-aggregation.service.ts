import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PilotEvent, PilotEventDocument } from '../schemas/pilot-event.schema';
import { VisitorAnalyticsEvent } from '../analytics/visitor-event.schema';
import {
  RegionalDataRecord,
  RegionalDataRecordDocument,
} from '../regional-data/regional-data.schema';
import {
  Partner,
  PartnerActivity,
  PartnerActivityDocument,
  PartnerDocument,
} from '../partner/partner.schema';
import {
  MONTHLY_AGGREGATE_RETENTION_YEARS,
  ROLLING_SNAPSHOT_RETENTION_DAYS,
  addDays,
} from './retention-policy';
import {
  TourismNetworkAggregate,
  TourismNetworkAggregateDocument,
  TourismNetworkAggregateKind,
} from './tourism-network-aggregate.schema';

type Stage =
  | 'INTEREST'
  | 'MOVEMENT_INTENT'
  | 'QR_VISIT_CONFIRMED'
  | 'BENEFIT_USE_CONFIRMED';
type RawRow = {
  _id?: unknown;
  eventType: string;
  regionId: string;
  createdAt?: Date | string;
  sessionId?: string;
  anonymousTripId?: string;
  partnerId?: string;
  metadata?: Record<string, unknown>;
};
type NetworkPartner = {
  partnerId: string;
  canonicalEntityId: string;
  displayName: string;
  category?: string;
};
type ReleasedNode = {
  id: string;
  partnerId: string;
  name: string;
  category: string;
};
type ReleasedEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  sourcePartnerId: string;
  targetPartnerId: string;
  stage: string;
  total: number;
  unit: string;
};
type ReleasedNetwork = {
  status: string;
  notice?: string;
  nodes: ReleasedNode[];
  edges: ReleasedEdge[];
  stageTotals: Array<{ stage: string; total: number; unit: string }>;
  categoryConnections: Array<{
    sourceCategory: string;
    targetCategory: string;
    stage: string;
    total: number;
    unit: string;
  }>;
};

type PublicChangeKind =
  | 'NEWLY_RELEASED'
  | 'STRENGTHENED'
  | 'WEAKENED'
  | 'NO_LONGER_PUBLIC';

type PublicNetworkChange = {
  kind: PublicChangeKind;
  sourceNodeId: string;
  targetNodeId: string;
  sourceName: string;
  targetName: string;
  stage: string;
  previousTotal?: number;
  currentTotal?: number;
  delta?: number;
};

type ComparableReleasedNetwork = {
  status: string;
  notice?: string;
  nodes: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  edges: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    stage: string;
    total: number;
    unit: string;
  }>;
  stageTotals: Array<{
    stage: string;
    total: number;
    unit: string;
  }>;
  categoryConnections: Array<{
    sourceCategory: string;
    targetCategory: string;
    stage: string;
    total: number;
    unit: string;
  }>;
};
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ANONYMOUS_FLOW_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PUBLIC_EDGES = 200;
const REQUIRED_SNAPSHOT_INDEXES = [
  { name: 'aggregateKey_1', key: { aggregateKey: 1 }, unique: true },
  {
    name: 'regionId_1_kind_1_periodKey_1',
    key: { regionId: 1, kind: 1, periodKey: 1 },
    unique: true,
  },
  { name: 'expiresAt_1', key: { expiresAt: 1 }, expireAfterSeconds: 0 },
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  ACCOMMODATION: '숙박',
  LODGING: '숙박',
  TOURIST_ATTRACTION: '관광',
  TOURISM_NATURE: '관광',
  RESTAURANT: '음식점',
  FOOD: '음식점',
  CAFE: '카페',
  EXPERIENCE: '체험',
  ACTIVITY: '체험',
};
const categoryLabel = (category?: string) =>
  (category && CATEGORY_LABELS[category]) || '기타 승인 장소';
const opaqueNodeId = (partnerId: string) =>
  `node-${createHash('sha256').update(`regional-report:${partnerId}`).digest('hex').slice(0, 20)}`;
const validFlowId = (value?: string): value is string =>
  typeof value === 'string' && ANONYMOUS_FLOW_ID.test(value);
const PILOT_STAGES: Record<string, Stage> = {
  ENTITY_DETAIL_OPENED: 'INTEREST',
  PLACE_DETAIL_OPENED: 'INTEREST',
  ITINERARY_SAVE_SUCCEEDED: 'MOVEMENT_INTENT',
  NAVIGATION_HANDOFF: 'MOVEMENT_INTENT',
  JOURNEY_START_ACTION: 'MOVEMENT_INTENT',
  MAP_OPENED: 'MOVEMENT_INTENT',
  PHONE_HANDOFF: 'MOVEMENT_INTENT',
  BOOKING_HANDOFF: 'MOVEMENT_INTENT',
  WEBSITE_HANDOFF: 'MOVEMENT_INTENT',
};
const PARTNER_STAGES: Record<string, Stage> = {
  PARTNER_RECOMMENDATION_SHOWN: 'INTEREST',
  QR_VISIT_CONFIRMED: 'QR_VISIT_CONFIRMED',
  BENEFIT_USE_CONFIRMED: 'BENEFIT_USE_CONFIRMED',
};

const seoulDateKey = (date: Date) =>
  new Date(date.getTime() + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
const seoulMonthKey = (date: Date) => seoulDateKey(date).slice(0, 7);
const seoulMidnightUtc = (dateKey: string) =>
  new Date(`${dateKey}T00:00:00.000+09:00`);

export function rolling30dWindow(now = new Date()) {
  const end = seoulMidnightUtc(seoulDateKey(now));
  return {
    periodKey: `${seoulDateKey(new Date(end.getTime() - 30 * DAY_MS))}/${seoulDateKey(end)}`,
    start: new Date(end.getTime() - 30 * DAY_MS),
    end,
  };
}

export function monthlyWindow(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error('invalid month key');
  const start = seoulMidnightUtc(`${monthKey}-01`),
    seoul = new Date(start.getTime() + SEOUL_OFFSET_MS);
  seoul.setUTCMonth(seoul.getUTCMonth() + 1);
  return {
    periodKey: monthKey,
    start,
    end: new Date(seoul.getTime() - SEOUL_OFFSET_MS),
  };
}

const releasedEdgeKey = (edge: {
  sourceNodeId: string;
  targetNodeId: string;
  stage: string;
}) => `${edge.sourceNodeId}|${edge.targetNodeId}|${edge.stage}`;

const stageTotal = (released: ComparableReleasedNetwork, stage: string) =>
  released.stageTotals.find((item) => item.stage === stage)?.total || 0;

export function compareReleasedNetworks(
  previous: ComparableReleasedNetwork,
  current: ComparableReleasedNetwork,
) {
  const previousEdges = new Map(
    previous.edges.map((edge) => [releasedEdgeKey(edge), edge]),
  );
  const currentEdges = new Map(
    current.edges.map((edge) => [releasedEdgeKey(edge), edge]),
  );

  const nodeNames = new Map<string, string>();

  for (const node of previous.nodes) nodeNames.set(node.id, node.name);
  for (const node of current.nodes) nodeNames.set(node.id, node.name);

  const changes: PublicNetworkChange[] = [];

  for (const [key, currentEdge] of currentEdges) {
    const previousEdge = previousEdges.get(key);

    if (!previousEdge) {
      changes.push({
        kind: 'NEWLY_RELEASED',
        sourceNodeId: currentEdge.sourceNodeId,
        targetNodeId: currentEdge.targetNodeId,
        sourceName: nodeNames.get(currentEdge.sourceNodeId) || '지역자원',
        targetName: nodeNames.get(currentEdge.targetNodeId) || '지역자원',
        stage: currentEdge.stage,
        currentTotal: currentEdge.total,
        delta: currentEdge.total,
      });
      continue;
    }

    const delta = currentEdge.total - previousEdge.total;

    if (delta > 0) {
      changes.push({
        kind: 'STRENGTHENED',
        sourceNodeId: currentEdge.sourceNodeId,
        targetNodeId: currentEdge.targetNodeId,
        sourceName: nodeNames.get(currentEdge.sourceNodeId) || '지역자원',
        targetName: nodeNames.get(currentEdge.targetNodeId) || '지역자원',
        stage: currentEdge.stage,
        previousTotal: previousEdge.total,
        currentTotal: currentEdge.total,
        delta,
      });
    } else if (delta < 0) {
      changes.push({
        kind: 'WEAKENED',
        sourceNodeId: currentEdge.sourceNodeId,
        targetNodeId: currentEdge.targetNodeId,
        sourceName: nodeNames.get(currentEdge.sourceNodeId) || '지역자원',
        targetName: nodeNames.get(currentEdge.targetNodeId) || '지역자원',
        stage: currentEdge.stage,
        previousTotal: previousEdge.total,
        currentTotal: currentEdge.total,
        delta,
      });
    }
  }

  for (const [key, previousEdge] of previousEdges) {
    if (currentEdges.has(key)) continue;

    changes.push({
      kind: 'NO_LONGER_PUBLIC',
      sourceNodeId: previousEdge.sourceNodeId,
      targetNodeId: previousEdge.targetNodeId,
      sourceName: nodeNames.get(previousEdge.sourceNodeId) || '지역자원',
      targetName: nodeNames.get(previousEdge.targetNodeId) || '지역자원',
      stage: previousEdge.stage,
      previousTotal: previousEdge.total,
      delta: -previousEdge.total,
    });
  }

  const newlyReleased = changes.filter(
    (change) => change.kind === 'NEWLY_RELEASED',
  );
  const strengthened = changes.filter(
    (change) => change.kind === 'STRENGTHENED',
  );
  const weakened = changes.filter(
    (change) => change.kind === 'WEAKENED',
  );
  const noLongerPublic = changes.filter(
    (change) => change.kind === 'NO_LONGER_PUBLIC',
  );

  const previousInterest = stageTotal(previous, 'INTEREST');
  const currentInterest = stageTotal(current, 'INTEREST');
  const previousMovement = stageTotal(previous, 'MOVEMENT_INTENT');
  const currentMovement = stageTotal(current, 'MOVEMENT_INTENT');

  const newlyReleasedInterestContribution = newlyReleased
    .filter((change) => change.stage === 'INTEREST')
    .reduce((sum, change) => sum + (change.currentTotal || 0), 0);

  const interestDelta = currentInterest - previousInterest;

  return {
    summary: {
      previousConnections: previous.edges.length,
      currentConnections: current.edges.length,
      newlyReleased: newlyReleased.length,
      strengthened: strengthened.length,
      weakened: weakened.length,
      noLongerPublic: noLongerPublic.length,
      previousInterest,
      currentInterest,
      interestDelta,
      previousMovement,
      currentMovement,
      movementDelta: currentMovement - previousMovement,
      newlyReleasedInterestContribution,
    },
    changes: {
      newlyReleased,
      strengthened,
      weakened,
      noLongerPublic,
    },
    interpretation: {
      interestIncreaseMostlyFromNewlyReleased:
        interestDelta > 0 &&
        newlyReleasedInterestContribution > 0 &&
        newlyReleasedInterestContribution >= interestDelta * 0.5,
      caution:
        '공개 수치의 변화는 개인정보 보호 최소 공개기준을 새로 충족하거나 더 이상 충족하지 않는 연결의 영향을 받을 수 있습니다. 따라서 공개 집계 증감을 같은 기간의 신규 행동 발생량으로 직접 해석해서는 안 됩니다.',
    },
  };
}
export function releaseNetwork(
  events: RawRow[],
  activities: RawRow[],
  partners: NetworkPartner[],
  minimumCellSize: number,
) {
  const partnerById = new Map(partners.map((p) => [p.partnerId, p])),
    partnerByEntity = new Map(partners.map((p) => [p.canonicalEntityId, p])),
    entries = activities
      .filter(
        (x) =>
          x.eventType === 'PARTNER_QR_ENTRY' &&
          typeof x.partnerId === 'string' &&
          partnerById.has(x.partnerId),
      )
      .sort(
        (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0),
      ),
    entriesBySession = new Map<string, RawRow[]>();
  for (const entry of entries) {
    const id = entry.anonymousTripId;
    if (validFlowId(id))
      entriesBySession.set(id, [...(entriesBySession.get(id) || []), entry]);
  }
  const observations = [
    ...events.map((x) => ({
      ...x,
      identity: x.sessionId,
      stage: PILOT_STAGES[x.eventType],
    })),
    ...activities.map((x) => ({
      ...x,
      identity: x.anonymousTripId,
      stage: PARTNER_STAGES[x.eventType],
    })),
  ].filter((x) => validFlowId(x.identity) && x.stage);
  const edgeKeys = new Set<string>();

  // QR-independent place-to-place flow.
  // Only qualified place actions with a verified network entity participate.
  const placeRowsByFlow = new Map<string, typeof observations>();

  for (const row of observations) {
    const entityId = row.metadata?.entityId;
    if (
      !validFlowId(row.identity) ||
      typeof entityId !== 'string' ||
      !partnerByEntity.has(entityId)
    )
      continue;

    placeRowsByFlow.set(row.identity, [
      ...(placeRowsByFlow.get(row.identity) || []),
      row,
    ]);
  }

  for (const [identity, rows] of placeRowsByFlow) {
    const ordered = [...rows].sort(
      (a, b) =>
        +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0),
    );

    let previous: NetworkPartner | undefined;

    for (const row of ordered) {
      const entityId = row.metadata?.entityId;
      const current =
        typeof entityId === 'string'
          ? partnerByEntity.get(entityId)
          : undefined;

      if (!current) continue;

      if (previous && previous.partnerId !== current.partnerId) {
        edgeKeys.add(
          `${identity}|${previous.partnerId}|${current.partnerId}|${row.stage}`,
        );
      }

      previous = current;
    }
  }
  for (const row of observations) {
    const at = +new Date(row.createdAt || 0),
      source = (entriesBySession.get(row.identity!) || [])
        .filter((x) => +new Date(x.createdAt || 0) <= at)
        .at(-1),
      entityId = row.metadata?.entityId,
      target = row.partnerId
        ? partnerById.get(row.partnerId)
        : partnerByEntity.get(typeof entityId === 'string' ? entityId : '');
    if (!source || !target || source.partnerId === target.partnerId) continue;
    edgeKeys.add(
      `${row.identity}|${source.partnerId}|${target.partnerId}|${row.stage}`,
    );
  }
  const totals = new Map<string, number>();
  for (const key of edgeKeys) {
    const [, source, target, stage] = key.split('|'),
      cell = `${source}|${target}|${stage}`;
    totals.set(cell, (totals.get(cell) || 0) + 1);
  }
  const releasedEdges = [...totals]
    .filter(([, total]) => total >= minimumCellSize)
    .map(([key, total]) => {
      const [sourceNodeId, targetNodeId, stage] = key.split('|');
      return {
        sourceNodeId: opaqueNodeId(sourceNodeId),
        targetNodeId: opaqueNodeId(targetNodeId),
        sourcePartnerId: sourceNodeId,
        targetPartnerId: targetNodeId,
        stage,
        total,
        unit: '연결 이벤트 횟수',
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_PUBLIC_EDGES);
  const releasedIds = new Set(
    releasedEdges.flatMap((x) => [x.sourcePartnerId, x.targetPartnerId]),
  );
  const nodes = partners
    .filter((p) => releasedIds.has(p.partnerId))
    .map((p) => ({
      id: opaqueNodeId(p.partnerId),
      partnerId: p.partnerId,
      name: p.displayName,
      category: categoryLabel(p.category),
    }));
  const stageTotals = Object.entries(
    releasedEdges.reduce<Record<string, number>>((acc, edge) => {
      acc[edge.stage] = (acc[edge.stage] || 0) + edge.total;
      return acc;
    }, {}),
  ).map(([stage, total]) => ({
    stage,
    total,
    unit: '공개 가능한 연결 이벤트 횟수',
  }));
  const categoryConnections = Object.entries(
    releasedEdges.reduce<Record<string, number>>((acc, edge) => {
      const source = partnerById.get(edge.sourcePartnerId),
        target = partnerById.get(edge.targetPartnerId),
        key = `${categoryLabel(source?.category)}|${categoryLabel(target?.category)}|${edge.stage}`;
      acc[key] = (acc[key] || 0) + edge.total;
      return acc;
    }, {}),
  ).map(([key, total]) => {
    const [sourceCategory, targetCategory, stage] = key.split('|');
    return {
      sourceCategory,
      targetCategory,
      stage,
      total,
      unit: '연결 이벤트 횟수',
    };
  });
  return {
    status: releasedEdges.length ? 'AVAILABLE' : 'PREPARING',
    notice: releasedEdges.length ? undefined : '연결 데이터 준비 중',
    nodes,
    edges: releasedEdges,
    stageTotals,
    categoryConnections,
  };
}

export function publicNetwork(
  released: ReleasedNetwork,
  eligiblePartnerIds: Set<string>,
) {
  const eligibleNodes = released.nodes.filter((node) =>
      eligiblePartnerIds.has(node.partnerId),
    ),
    eligibleNodeIds = new Set(eligibleNodes.map((node) => node.id)),
    edges = released.edges.filter(
      (edge) =>
        eligibleNodeIds.has(edge.sourceNodeId) &&
        eligibleNodeIds.has(edge.targetNodeId),
    ),
    releasedNodeIds = new Set(
      edges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]),
    ),
    nodes = eligibleNodes.filter((node) => releasedNodeIds.has(node.id)),
    nodeById = new Map(nodes.map((node) => [node.id, node])),
    stageTotals = Object.entries(
      edges.reduce<Record<string, number>>((totals, edge) => {
        totals[edge.stage] = (totals[edge.stage] || 0) + edge.total;
        return totals;
      }, {}),
    ).map(([stage, total]) => ({
      stage,
      total,
      unit: '공개 가능한 연결 이벤트 횟수',
    }));
  return {
    status: edges.length ? 'AVAILABLE' : 'PREPARING',
    notice: edges.length ? undefined : '연결 데이터 준비 중',
    nodes: nodes.map((node) => ({
      id: node.id,
      name: node.name,
      category: node.category,
    })),
    edges: edges.map((edge) => ({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      stage: edge.stage,
      total: edge.total,
      unit: edge.unit,
    })),
    stageTotals,
    categoryConnections: Object.entries(
      edges.reduce<Record<string, number>>((totals, edge) => {
        const source = nodeById.get(edge.sourceNodeId),
          target = nodeById.get(edge.targetNodeId);
        if (!source || !target) return totals;
        const key = `${source.category}|${target.category}|${edge.stage}`;
        totals[key] = (totals[key] || 0) + edge.total;
        return totals;
      }, {}),
    ).map(([key, total]) => {
      const [sourceCategory, targetCategory, stage] = key.split('|');
      return {
        sourceCategory,
        targetCategory,
        stage,
        total,
        unit: '연결 이벤트 횟수',
      };
    }),
  };
}

function validateReleasedNetwork(
  released: ReleasedNetwork,
  minimumCellSize: number,
) {
  const nodeIds = new Set(released.nodes.map((node) => node.id));
  if (
    released.edges.length > MAX_PUBLIC_EDGES ||
    released.edges.some(
      (edge) =>
        edge.total < minimumCellSize ||
        !nodeIds.has(edge.sourceNodeId) ||
        !nodeIds.has(edge.targetNodeId),
    )
  )
    throw new Error('invalid released tourism network');
}

@Injectable()
export class TourismNetworkAggregationService {
  constructor(
    @InjectModel(PilotEvent.name) private events: Model<PilotEventDocument>,
    @InjectModel(VisitorAnalyticsEvent.name)
    private visitorEvents: Model<VisitorAnalyticsEvent>,
    @InjectModel(RegionalDataRecord.name)
    private regionalEntities: Model<RegionalDataRecordDocument>,
    @InjectModel(PartnerActivity.name)
    private activities: Model<PartnerActivityDocument>,
    @InjectModel(Partner.name) private partners: Model<PartnerDocument>,
    @InjectModel(TourismNetworkAggregate.name)
    private aggregates: Model<TourismNetworkAggregateDocument>,
  ) {}

  private async assertSnapshotWriteReady() {
    if (process.env.REGIONAL_NETWORK_MAINTENANCE_APPROVED !== 'true')
      throw new Error('Explicit snapshot maintenance approval is required');
    let indexes: Array<{
      name?: string;
      key?: Record<string, number>;
      unique?: boolean;
      expireAfterSeconds?: number;
    }>;
    try {
      const listed: unknown = await this.aggregates.collection
        .listIndexes()
        .toArray();
      indexes = listed as typeof indexes;
    } catch {
      throw new Error('Regional network snapshot indexes are not ready');
    }
    const ready = REQUIRED_SNAPSHOT_INDEXES.every((required) =>
      indexes.some(
        (index) =>
          index.name === required.name &&
          JSON.stringify(index.key) === JSON.stringify(required.key) &&
          (!('unique' in required) || index.unique === required.unique) &&
          (!('expireAfterSeconds' in required) ||
            index.expireAfterSeconds === required.expireAfterSeconds),
      ),
    );
    if (!ready)
      throw new Error('Regional network snapshot indexes are not ready');
  }

  async generate(
    regionId: string,
    kind: TourismNetworkAggregateKind,
    periodKey?: string,
    now = new Date(),
    minimumCellSize = 5,
  ) {
    await this.assertSnapshotWriteReady();
    const window =
      kind === 'ROLLING_30D'
        ? rolling30dWindow(now)
        : monthlyWindow(periodKey || seoulMonthKey(addDays(now, -31)));
    const range = {
      regionId,
      createdAt: { $gte: window.start, $lt: window.end },
    };
    const [events, visitorEvents, activities, partners, regionalEntities] = await Promise.all([
      this.events.find(range).lean(),
      this.visitorEvents
        .find({
          regionId,
          occurredAt: { $gte: window.start, $lt: window.end },
        })
        .lean(),
      this.activities.find(range).lean(),
      this.partners
        .find({
          regionId,
          status: 'OPERATING',
          qrStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .lean(),
      this.regionalEntities
        .find({
          regionId,
          lifecycleStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .lean(),
    ]);
    const adaptedVisitorEvents: RawRow[] = visitorEvents.map((row:any)=>({
      eventType:
        row.eventType === 'DIRECTIONS_CLICKED'
          ? 'NAVIGATION_HANDOFF'
          : row.eventType === 'PHONE_CLICKED'
            ? 'PHONE_HANDOFF'
            : row.eventType === 'BOOKING_CLICKED' ||
                row.eventType === 'BOOKING_OUTBOUND_DISPATCHED'
              ? 'BOOKING_HANDOFF'
              : row.eventType === 'RUNTIME_JOURNEY_STARTED'
                ? 'JOURNEY_START_ACTION'
                : row.eventType,
      regionId: row.regionId,
      createdAt: row.occurredAt,
      sessionId: row.anonymousTripId,
      anonymousTripId: row.anonymousTripId,
      metadata: row.placeKey ? { entityId: row.placeKey } : undefined,
    }));

    // Regional Entity is the primary network node.
    // Partner membership strengthens attribution such as QR entry.
    const networkEntityMap = new Map<string, NetworkPartner>();

    for (const entity of regionalEntities) {
      networkEntityMap.set(entity.canonicalEntityId, {
        partnerId: entity.canonicalEntityId,
        canonicalEntityId: entity.canonicalEntityId,
        displayName: entity.displayName,
        category: entity.category,
      });
    }

    for (const partner of partners) {
      if (!networkEntityMap.has(partner.canonicalEntityId)) {
        networkEntityMap.set(partner.canonicalEntityId, {
          partnerId: partner.canonicalEntityId,
          canonicalEntityId: partner.canonicalEntityId,
          displayName: partner.displayName,
          category: partner.category,
        });
      }
    }

    const networkEntities = [...networkEntityMap.values()];

    const partnerCanonicalById = new Map(
      partners.map((partner) => [
        partner.partnerId,
        partner.canonicalEntityId,
      ]),
    );

    const adaptedActivities: RawRow[] = (activities as RawRow[]).map(
      (row) => {
        const canonical =
          typeof row.partnerId === 'string'
            ? partnerCanonicalById.get(row.partnerId)
            : undefined;

        return canonical ? { ...row, partnerId: canonical } : row;
      },
    );
    const released = releaseNetwork(
      [...(events as RawRow[]), ...adaptedVisitorEvents],
      adaptedActivities,
      networkEntities,
      minimumCellSize,
    );
    validateReleasedNetwork(released, minimumCellSize);
    const revision = createHash('sha256')
        .update(
          JSON.stringify({
            regionId,
            periodKey: window.periodKey,
            eventCount: events.length,
            visitorEventCount: visitorEvents.length,
            activityCount: activities.length,
            regionalEntityCount: regionalEntities.length,
          }),
        )
        .digest('hex'),
      aggregateKey = `${regionId}:${kind}:${window.periodKey}`,
      expiresAt =
        kind === 'MONTHLY'
          ? new Date(
              Date.UTC(
                window.end.getUTCFullYear() + MONTHLY_AGGREGATE_RETENTION_YEARS,
                window.end.getUTCMonth(),
                window.end.getUTCDate(),
              ),
            )
          : addDays(window.end, ROLLING_SNAPSHOT_RETENTION_DAYS);
    const payload = {
        aggregateKey,
        regionId,
        kind,
        periodKey: window.periodKey,
        windowStart: window.start,
        windowEndExclusive: window.end,
        snapshotAt: now,
        minimumCellSize,
        status: 'COMPLETE' as const,
        sourceRevision: revision,
        released,
        expiresAt,
      },
      replaceIfNotNewer = () =>
        this.aggregates
          .findOneAndUpdate(
            {
              aggregateKey,
              $or: [
                { snapshotAt: { $lte: now } },
                { snapshotAt: { $exists: false } },
              ],
            },
            { $set: payload },
            { new: true },
          )
          .lean();
    const replaced = await replaceIfNotNewer();
    if (replaced) return replaced;
    try {
      return await this.aggregates.create(payload);
    } catch (error: unknown) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 11000
      )
        throw error;
      return (
        (await replaceIfNotNewer()) ||
        this.aggregates.findOne({ aggregateKey, status: 'COMPLETE' }).lean()
      );
    }
  }

  latestRolling(regionId: string) {
    return this.aggregates
      .findOne({ regionId, kind: 'ROLLING_30D', status: 'COMPLETE' })
      .sort({ windowEndExclusive: -1 })
      .lean();
  }

  async latestPublicChange(regionId: string) {
    const [snapshots, partners, regionalEntities] = await Promise.all([
      this.aggregates
        .find({
          regionId,
          kind: 'ROLLING_30D',
          status: 'COMPLETE',
        })
        .sort({ windowEndExclusive: -1 })
        .limit(2)
        .lean(),
      this.partners
        .find({
          regionId,
          status: 'OPERATING',
          qrStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .select({ canonicalEntityId: 1, _id: 0 })
        .lean(),
      this.regionalEntities
        .find({
          regionId,
          lifecycleStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .select({ canonicalEntityId: 1, _id: 0 })
        .lean(),
    ]);

    if (snapshots.length < 2) {
      return {
        status: 'INSUFFICIENT_HISTORY',
        notice: '변화를 판단하려면 완료된 비교 snapshot이 2개 이상 필요합니다.',
      };
    }

    const eligibleIds = new Set([
      ...regionalEntities.map((entity) => entity.canonicalEntityId),
      ...partners.map((partner) => partner.canonicalEntityId),
    ]);

    const currentSnapshot = snapshots[0];
    const previousSnapshot = snapshots[1];

    const current = publicNetwork(
      currentSnapshot.released as unknown as ReleasedNetwork,
      eligibleIds,
    );

    const previous = publicNetwork(
      previousSnapshot.released as unknown as ReleasedNetwork,
      eligibleIds,
    );

    return {
      status: 'AVAILABLE',
      comparison: {
        currentPeriodKey: currentSnapshot.periodKey,
        previousPeriodKey: previousSnapshot.periodKey,
        currentSnapshotAt: currentSnapshot.snapshotAt,
        previousSnapshotAt: previousSnapshot.snapshotAt,
      },
      ...compareReleasedNetworks(previous, current),
    };
  }
  async latestPublicRolling(regionId: string) {
    const [snapshot, partners, regionalEntities] = await Promise.all([
      this.latestRolling(regionId),
      this.partners
        .find({
          regionId,
          status: 'OPERATING',
          qrStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .select({ canonicalEntityId: 1, _id: 0 })
        .lean(),
      this.regionalEntities
        .find({
          regionId,
          lifecycleStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .select({ canonicalEntityId: 1, _id: 0 })
        .lean(),
    ]);

    if (!snapshot) return null;
    return {
      ...snapshot,
      released: publicNetwork(
        snapshot.released as unknown as ReleasedNetwork,
        new Set([
          ...regionalEntities.map((entity) => entity.canonicalEntityId),
          ...partners.map((partner) => partner.canonicalEntityId),
        ]),
      ),
    };
  }
}

export { seoulDateKey, seoulMonthKey };
