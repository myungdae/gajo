import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import {
  VisitorAnalyticsEvent,
  VisitorAnalyticsState,
  VisitorAnalyticsMarker,
} from './visitor-event.schema';
import { PilotEvent } from '../schemas/pilot-event.schema';
import { Partner } from '../partner/partner.schema';
import { RegionalDataService } from '../regional-data/regional-data.service';
import { AdminPrincipal } from '../regional-data/admin-token.guard';
import {
  UUID,
  VISITOR_REGIONS,
  validateVisitorEvent,
  TrafficClass,
} from './visitor-contract';
import {
  verifyPlaceProof,
  verifyTestMarker,
  issueTestMarker,
} from './visitor-evidence';
import { visitorPeriod, buildVisitorReport } from './visitor-report';

export function authorizeAnalyticsRegion(
  principal: AdminPrincipal,
  regionId: unknown,
): string {
  if (typeof regionId !== 'string' || !VISITOR_REGIONS.includes(regionId))
    throw new BadRequestException('Region required');
  // Empty scope never grants analytics access to every region.
  if (!principal?.allowedRegionIds?.includes(regionId))
    throw new ForbiddenException('Region access denied');
  return regionId;
}
@Injectable()
export class VisitorAnalyticsService {
  constructor(
    @InjectModel(VisitorAnalyticsEvent.name)
    private events: Model<VisitorAnalyticsEvent>,
    @InjectModel(PilotEvent.name) private legacy: Model<PilotEvent>,
    @InjectModel(Partner.name) private partners: Model<Partner>,
    private regional: RegionalDataService,
    @InjectModel(VisitorAnalyticsState.name)
    private state: Model<VisitorAnalyticsState>,
    @InjectModel(VisitorAnalyticsMarker.name)
    private markers: Model<VisitorAnalyticsMarker>,
  ) {}
  async record(input: unknown, marker: unknown, now = new Date(), trustedBooking = false) {
    const v = validateVisitorEvent(input, now);
    if (v.eventType.startsWith('BOOKING_') && !trustedBooking) throw new BadRequestException('Booking events require approved channel dispatch');
    if (v.placeKey) {
      const proof = verifyPlaceProof(
        v.placeProof,
        v.regionId,
        v.placeKey,
        now.getTime(),
      );
      if (!proof) {
        const data = await this.regional.effectiveDataset(v.regionId);
        if (
          !data?.records.some((r: any) =>
            [r.entityUri, r.canonicalId, r.canonicalEntityId].includes(
              v.placeKey,
            ),
          )
        )
          throw new BadRequestException(
            'Place is not verified for this experience region',
          );
      }
    }
    let trafficClass: TrafficClass = 'UNKNOWN',
      evidenceType = 'NO_EVIDENCE';
    const test = verifyTestMarker(
      marker,
      process.env.ADMIN_WRITE_TOKEN,
      v.regionId,
      v.visitSessionId,
      now.getTime(),
    );
    const binding = await this.markers
      .findById(v.regionId + ':' + v.visitSessionId)
      .lean();
    if (binding && (!test || binding.kind !== test))
      throw new BadRequestException('Test visit requires its valid marker');
    if (marker && !test)
      throw new BadRequestException(
        'Invalid or expired test marker; renew before collecting',
      );
    else if (test) {
      trafficClass = test;
      evidenceType = 'SERVER_ISSUED_MARKER';
    } else if (v.entryId === `regional-qr:${v.regionId}`) {
      trafficClass = 'ATTRIBUTED_ENTRY';
      evidenceType = 'REGIONAL_QR_LINK';
    } else if (v.entryId?.startsWith('partner:')) {
      if (
        await this.partners.exists({
          partnerSlug: v.entryId.slice(8),
          regionId: v.regionId,
          status: 'OPERATING',
          qrStatus: 'ACTIVE',
          verificationStatus: 'VERIFIED',
        })
      ) {
        trafficClass = 'ATTRIBUTED_ENTRY';
        evidenceType = 'REGISTERED_PARTNER_LINK';
      }
    } else if (!v.entryId) {
      trafficClass = 'GENERAL_VISIT';
      evidenceType = 'UNATTRIBUTED_PUBLIC_ENTRY';
    }
    const { placeProof, ...safe } = v;
    const hash = createHash('sha256')
      .update(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(safe).sort(([a], [b]) => a.localeCompare(b)),
          ),
        ),
      )
      .digest('hex');
    try {
      await this.events.create({
        ...safe,
        _id: v.eventId,
        payloadHash: hash,
        trafficClass,
        evidenceType,
        occurredAt: new Date(v.occurredAt),
        receivedAt: now,
        expiresAt: new Date(now.getTime() + 90 * 86400000),
      });
      await this.state.updateOne(
        { _id: v.regionId },
        { $min: { firstReceivedAt: now } },
        { upsert: true },
      );
      return { accepted: true, duplicate: false };
    } catch (e) {
      if ((e as any)?.code !== 11000) throw e;
      const prior = await this.events.findById(v.eventId).lean();
      if (prior?.payloadHash !== hash)
        throw new BadRequestException('eventId payload mismatch');
      await this.state.updateOne(
        { _id: v.regionId },
        { $min: { firstReceivedAt: prior!.receivedAt } },
        { upsert: true },
      );
      return { accepted: true, duplicate: true };
    }
  }
  async marker(principal: AdminPrincipal, input: any) {
    const regionId = authorizeAnalyticsRegion(principal, input?.regionId);
    if (
      !UUID.test(input?.visitSessionId) ||
      !['INTERNAL_TEST', 'AUTOMATED_CHECK'].includes(input?.kind)
    )
      throw new BadRequestException('Invalid marker request');
    const secret = process.env.ADMIN_WRITE_TOKEN;
    if (!secret) throw new ForbiddenException();
    const markerId = regionId + ':' + input.visitSessionId;
    const existing = await this.markers.findById(markerId).lean();
    if (existing && existing.kind !== input.kind)
      throw new BadRequestException('Visit marker kind cannot change');
    await this.markers.updateOne(
      { _id: markerId },
      {
        $setOnInsert: { kind: input.kind },
        $set: {
          expiresAt: new Date(Date.now() + 3600000),
          retainUntil: new Date(Date.now() + 90 * 86400000),
        },
      },
      { upsert: true },
    );
    return {
      token: issueTestMarker(
        secret,
        regionId,
        input.visitSessionId,
        input.kind,
      ),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      regionId,
      visitSessionId: input.visitSessionId,
    };
  }
  async report(
    principal: AdminPrincipal,
    q: Record<string, unknown>,
    now = new Date(),
  ) {
    const regionId = authorizeAnalyticsRegion(principal, q.regionId),
      period = visitorPeriod(q, now);
    if (
      q.includeInternal !== undefined &&
      !['true', 'false'].includes(String(q.includeInternal))
    )
      throw new BadRequestException('Invalid inclusion flag');
    const [rows, first, legacy] = await Promise.all([
      this.events
        .find({
          regionId,
          receivedAt: { $gte: period.start, $lt: period.endExclusive },
        })
        .sort({ receivedAt: 1 })
        .limit(100001)
        .lean(),
      this.state.findById(regionId).lean(),
      this.legacy.exists({ regionId }),
    ]);
    if (rows.length > 100000)
      throw new ServiceUnavailableException(
        'Too many events; select a shorter period',
      );
    return {
      regionId,
      ...buildVisitorReport(
        rows,
        period,
        q.includeInternal === 'true',
        now,
        first?.firstReceivedAt || null,
        Boolean(legacy),
      ),
    };
  }
}
