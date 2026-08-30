import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PilotEvent, PilotEventDocument } from '../schemas/pilot-event.schema';
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

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ANONYMOUS_FLOW_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PUBLIC_EDGES = 200;
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
    @InjectModel(PartnerActivity.name)
    private activities: Model<PartnerActivityDocument>,
    @InjectModel(Partner.name) private partners: Model<PartnerDocument>,
    @InjectModel(TourismNetworkAggregate.name)
    private aggregates: Model<TourismNetworkAggregateDocument>,
  ) {}

  async generate(
    regionId: string,
    kind: TourismNetworkAggregateKind,
    periodKey?: string,
    now = new Date(),
    minimumCellSize = 5,
  ) {
    const window =
      kind === 'ROLLING_30D'
        ? rolling30dWindow(now)
        : monthlyWindow(periodKey || seoulMonthKey(addDays(now, -31)));
    const range = {
      regionId,
      createdAt: { $gte: window.start, $lt: window.end },
    };
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
    const released = releaseNetwork(
      events as RawRow[],
      activities as RawRow[],
      partners,
      minimumCellSize,
    );
    validateReleasedNetwork(released, minimumCellSize);
    const revision = createHash('sha256')
        .update(
          JSON.stringify({
            regionId,
            periodKey: window.periodKey,
            eventCount: events.length,
            activityCount: activities.length,
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

  async latestPublicRolling(regionId: string) {
    const [snapshot, partners] = await Promise.all([
      this.latestRolling(regionId),
      this.partners
        .find({
          regionId,
          status: 'OPERATING',
          qrStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
        .select({ partnerId: 1, _id: 0 })
        .lean(),
    ]);
    if (!snapshot) return null;
    return {
      ...snapshot,
      released: publicNetwork(
        snapshot.released as unknown as ReleasedNetwork,
        new Set(partners.map((partner) => partner.partnerId)),
      ),
    };
  }
}

export { seoulDateKey, seoulMonthKey };
