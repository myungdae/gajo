import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ActionChannelService } from './action-channel.service';
import { VisitorAnalyticsService } from '../analytics/visitor-analytics.service';
import { validateVisitorEvent } from '../analytics/visitor-contract';
export function bookingEventId(actionId: string, type: string) {
  const h = createHash('sha256').update(`booking:${actionId}:${type}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
@Injectable()
export class ChannelOutboundService {
  constructor(private channels: ActionChannelService, private analytics: VisitorAnalyticsService) {}
  async dispatch(regionId: string, placeKey: string, channelId: string, body: any, marker?: string, clickOnly = false) {
    if (!body || Object.keys(body).some(k => !['revision','event'].includes(k)) || !Number.isInteger(body.revision)) throw new BadRequestException('Invalid dispatch request');
    const channel = await this.channels.approved(regionId, placeKey, channelId, body.revision);
    if (channel.kind === 'DIRECT_BOOKING' && body.event) {
      // Analytics is optional. Neither invalid telemetry nor a database failure blocks a verified action.
      try {
        const supplied = body.event;
        if (supplied.regionId !== regionId || supplied.placeKey !== channel.placeKey || supplied.channelId !== channelId || supplied.eventType !== 'BOOKING_CLICKED') throw new BadRequestException();
        const click = validateVisitorEvent({ ...supplied, eventId: bookingEventId(supplied.actionId, 'BOOKING_CLICKED') });
        void this.analytics.record(click, marker, new Date(), true).catch(() => undefined);
        const outbound = { ...click, eventId: bookingEventId(click.actionId!, 'BOOKING_OUTBOUND_DISPATCHED'), eventType: 'BOOKING_OUTBOUND_DISPATCHED' };
        if (!clickOnly) void this.analytics.record(outbound, marker, new Date(), true).catch(() => undefined);
      } catch { /* Preserve action availability without saving invalid analytics. */ }
    }
    return clickOnly ? { accepted: true } : { href: channel.kind === 'PHONE' ? `tel:${channel.target.replace(/[^+0-9]/g, '')}` : channel.target, channelId, revision: channel.revision };
  }
}
