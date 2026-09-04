import { VisitorAnalyticsEvent } from '../analytics/visitor-event.schema';
import {
  BadRequestException,
  Injectable,
  Optional,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { PilotEvent, PilotEventDocument } from '../schemas/pilot-event.schema';
import { AnonymousTrip, AnonymousTripDocument } from './anonymous-trip.schema';
const TTL_MS = 90 * 24 * 60 * 60 * 1000,
  ID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  REGION = /^[a-z0-9-]{2,40}$/;
function safe(value: any): any {
  if (Array.isArray(value)) return value.map(safe);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            'rawMessage',
            'freeText',
            'text',
            'message',
            'email',
            'phone',
            'name',
            'deletionToken',
          ].includes(key),
      )
      .map(([key, item]) => [key, safe(item)]),
  );
}
@Injectable()
export class AnonymousTripService {
  constructor(
    @InjectModel(AnonymousTrip.name)
    private readonly model: Model<AnonymousTripDocument>,
    @InjectModel(PilotEvent.name) private readonly events: Model<PilotEventDocument>,
    @Optional() @InjectModel(VisitorAnalyticsEvent.name) private readonly visitorEvents?:Model<VisitorAnalyticsEvent>,
  ) {}
  private hash(token:string){if(!ID.test(token||''))throw new ForbiddenException('trip ownership required');return createHash('sha256').update(token).digest('hex')}
  private validate(id: string, regionId: string) {
    if (!ID.test(id) || !REGION.test(regionId))
      throw new BadRequestException('invalid anonymous trip identity');
  }
  async get(id: string, regionId: string, ownerToken: string) {
    this.validate(id, regionId);
    const ownerTokenHash=this.hash(ownerToken);
    const row = await this.model
      .findOne({ anonymousTripId: id, regionId, ownerTokenHash })
      .lean();
    if (!row) throw new NotFoundException();
    return {
      anonymousTripId: id,
      regionId,
      state: row.state,
      expiresAt: row.expiresAt,
    };
  }
  async sync(input: any, ownerToken = input?.deletionToken) {
    this.validate(input?.anonymousTripId, input?.regionId);
    if (
      input.state?.regionId !== input.regionId ||
      input.state?.anonymousTripId !== input.anonymousTripId
    )
      throw new BadRequestException('trip state ownership mismatch');
    const ownerTokenHash=this.hash(ownerToken), expiresAt = new Date(Date.now() + TTL_MS),
      state = safe(input.state);
    await this.model.updateOne(
      { anonymousTripId: input.anonymousTripId, regionId: input.regionId, ownerTokenHash },
      { $set: { state, expiresAt, ownerTokenHash } },
      { upsert: true },
    );
    return {
      anonymousTripId: input.anonymousTripId,
      regionId: input.regionId,
      state,
      expiresAt,
    };
  }
  async delete(id:string,regionId:string,ownerToken:string){this.validate(id,regionId);const ownerTokenHash=this.hash(ownerToken);const result=await this.model.deleteOne({anonymousTripId:id,regionId,ownerTokenHash});if(result.deletedCount){await this.events.deleteMany({sessionId:id,regionId});await this.visitorEvents?.deleteMany({anonymousTripId:id,regionId});}return{deleted:Boolean(result.deletedCount)}}
}
