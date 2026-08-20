import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  ) {}
  private validate(id: string, regionId: string) {
    if (!ID.test(id) || !REGION.test(regionId))
      throw new BadRequestException('invalid anonymous trip identity');
  }
  async get(id: string, regionId: string) {
    this.validate(id, regionId);
    const row = await this.model
      .findOne({ anonymousTripId: id, regionId })
      .lean();
    if (!row) throw new NotFoundException();
    return {
      anonymousTripId: id,
      regionId,
      state: row.state,
      expiresAt: row.expiresAt,
    };
  }
  async sync(input: any) {
    this.validate(input?.anonymousTripId, input?.regionId);
    if (
      input.state?.regionId !== input.regionId ||
      input.state?.anonymousTripId !== input.anonymousTripId
    )
      throw new BadRequestException('trip state ownership mismatch');
    const expiresAt = new Date(Date.now() + TTL_MS),
      state = safe(input.state);
    await this.model.updateOne(
      { anonymousTripId: input.anonymousTripId, regionId: input.regionId },
      { $set: { state, expiresAt } },
      { upsert: true },
    );
    return {
      anonymousTripId: input.anonymousTripId,
      regionId: input.regionId,
      state,
      expiresAt,
    };
  }
}
