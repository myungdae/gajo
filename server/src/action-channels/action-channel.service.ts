import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { ActionChannel } from './action-channel.schema';
import { channelInput, channelVisible } from './channel-policy';
import { RegionalDataService } from '../regional-data/regional-data.service';
import { AdminPrincipal } from '../regional-data/admin-token.guard';
import { authorizeAnalyticsRegion } from '../analytics/visitor-analytics.service';
const fingerprint = (row: any) => createHash('sha256').update(JSON.stringify([row.regionId,row.placeKey,row.kind,row.target,row.sourceUrl,row.labelKo,row.labelEn])).digest('hex');
@Injectable()
export class ActionChannelService {
  constructor(@InjectModel(ActionChannel.name) private channels: Model<ActionChannel>, private regional: RegionalDataService) {}
  async place(regionId: string, key: string) {
    const dataset = await this.regional.effectiveDataset(regionId);
    const record = dataset?.records.find((r: any) => [r.entityUri, r.canonicalId, r.canonicalEntityId].includes(key));
    if (!record) throw new NotFoundException('Registered regional place required');
    return record.entityUri;
  }
  async list(principal: AdminPrincipal, regionId: string, key: string) {
    authorizeAnalyticsRegion(principal, regionId);
    const placeKey = await this.place(regionId, key);
    return this.channels.find({ regionId, placeKey }).lean();
  }
  async create(principal: AdminPrincipal, regionId: string, key: string, input: any) {
    authorizeAnalyticsRegion(principal, regionId);
    const placeKey = await this.place(regionId, key), fields = channelInput(input), channelId = randomUUID();
    return this.channels.create({ ...fields, _id: channelId, channelId, regionId, placeKey, verificationStatus: 'DRAFT', published: false, revision: 1,
      audit: [{ action: 'CREATE', actorId: principal.actorId, at: new Date(), revision: 1, fields }] });
  }
  async change(principal: AdminPrincipal, regionId: string, key: string, id: string, action: string, body: any) {
    authorizeAnalyticsRegion(principal, regionId);
    const placeKey = await this.place(regionId, key);
    const current = await this.channels.findOne({ _id: id, regionId, placeKey }).lean();
    if (!current) throw new NotFoundException();
    if (body?.revision !== current.revision) throw new ConflictException('Reload channel before changing');
    let fields: any = {};
    if (action === 'EDIT') fields = { ...channelInput(body.fields), verificationStatus: 'REVIEW_REQUIRED', published: false, reviewedAt: null, reviewedBy: null };
    else if (action === 'VERIFY') {
      channelInput(Object.fromEntries(['kind','labelKo','labelEn','target','sourceUrl','reviewDueAt'].map(k => [k, current[k]])));
      if (body.confirmed !== true) throw new BadRequestException('Explicit evidence review required');
      fields = { verificationStatus: 'VERIFIED', reviewedAt: new Date(), reviewedBy: principal.actorId, reviewedFingerprint: fingerprint(current), published: false };
    } else if (action === 'PUBLISH') {
      if (current.verificationStatus !== 'VERIFIED' || new Date(current.reviewDueAt) <= new Date()) throw new BadRequestException('Current verification required');
      fields = { published: true };
    } else if (action === 'SUSPEND') fields = { verificationStatus: 'SUSPENDED', published: false };
    else throw new BadRequestException('Unknown channel action');
    const updated = await this.channels.findOneAndUpdate({ _id: id, regionId, placeKey, revision: current.revision }, {
      $set: fields, $inc: { revision: 1 }, $push: { audit: { action, actorId: principal.actorId, at: new Date(), revision: current.revision + 1, fields } },
    }, { new: true }).lean();
    if (!updated) throw new ConflictException('Concurrent channel change');
    return updated;
  }
  async publicList(regionId: string, key: string) {
    const placeKey = await this.place(regionId, key);
    const rows = await this.channels.find({ regionId, placeKey, verificationStatus: 'VERIFIED', published: true, reviewDueAt: { $gt: new Date() } }).lean();
    return rows.filter(r => channelVisible(r) && r.reviewedFingerprint === fingerprint(r)).map(r => ({ channelId: r.channelId, regionId, placeKey, kind: r.kind, labelKo: r.labelKo, labelEn: r.labelEn, revision: r.revision }));
  }
  async approved(regionId: string, key: string, id: string, revision: number) {
    const placeKey = await this.place(regionId, key);
    const row = await this.channels.findOne({ _id: id, regionId, placeKey, revision }).lean();
    if (!row || !channelVisible(row) || row.reviewedFingerprint !== fingerprint(row)) throw new NotFoundException('Channel unavailable');
    // Validate stored target again; caller never supplies a redirect destination.
    channelInput(Object.fromEntries(['kind','labelKo','labelEn','target','sourceUrl','reviewDueAt'].map(k => [k, row[k]])));
    return row;
  }
}
