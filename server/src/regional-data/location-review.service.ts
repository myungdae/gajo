import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RegionalDataRecord } from './regional-data.schema';
import { RegionalDataService } from './regional-data.service';
import { RegionConfigService } from '../region/region-config.service';
import {
  approvedLocationUsable,
  canRestoreLocation,
  currentLocation,
  LocationActor,
  locationHash,
  locationProposal,
  locationReason,
  locationScope,
  locationSnapshot,
  locationWarnings,
  stableLocationHash,
  validLocation,
} from './location-review.policy';

@Injectable()
export class LocationReviewService {
  constructor(
    @InjectModel(RegionalDataRecord.name)
    private model: Model<RegionalDataRecord>,
    private regional: RegionalDataService,
    private regions: RegionConfigService,
  ) {}
  private async row(regionId: string, id: string) {
    const rows = await this.model.collection
      .find({ regionId, id })
      .limit(2)
      .toArray();
    if (rows.length !== 1)
      throw new NotFoundException(
        '위치정보를 검토할 장소 한 건을 찾지 못했습니다.',
      );
    return rows[0] as any;
  }
  private async peers(regionId: string) {
    return this.model.collection.find({ regionId }).toArray();
  }
  private warningPeers(rows: any[], publicRows: any[]) {
    const result = rows.map((r) => ({
      ...r,
      approvedLocation: locationSnapshot(
        r,
        publicRows.find((p) => p.entityUri === r.canonicalEntityId),
      ),
    }));
    for (const place of publicRows)
      if (!rows.some((r) => r.canonicalEntityId === place.entityUri)) {
        const row = {
          id: place.entityUri,
          canonicalEntityId: place.entityUri,
          displayName: place.canonicalLabelKo,
        };
        result.push({ ...row, approvedLocation: locationSnapshot(row, place) });
      }
    return result;
  }
  private async view(
    row: any,
    actor: LocationActor,
    context?: { publicRows: any[]; peers: any[] },
  ) {
    const publicRows =
      context?.publicRows ||
      (await this.regional.effectiveDataset(row.regionId))?.records ||
      [];
    const place = publicRows.find((p) => p.entityUri === row.canonicalEntityId);
    const visible = Boolean(place?.actions?.navigate);
    const snapshot = locationSnapshot(row, place);
    return {
      id: row.id,
      canonicalEntityId: row.canonicalEntityId,
      regionId: row.regionId,
      displayName: row.displayName,
      publicDisplayName: place?.canonicalLabelKo || null,
      address: row.address,
      phone: row.phone,
      current: currentLocation({ approvedLocation: snapshot }),
      mapVisible: visible,
      needsLocationReview: !approvedLocationUsable({
        approvedLocation: snapshot,
      }),
      mapHiddenReason: visible
        ? null
        : !place
          ? '대표명 또는 공개 상태 검토가 필요합니다.'
          : !approvedLocationUsable(row)
            ? '주소와 전화번호는 등록되어 있지만 위치가 확인되지 않아 지도와 가까운 곳 찾기에는 나오지 않습니다.'
            : '공개 안전 검토 또는 장소 공개 상태를 확인해 주세요.',
      coordinateEvidence: snapshot,
      proposal: row.locationReview || null,
      canRestore: canRestoreLocation(row),
      restoreBlocked: Boolean(row.locationRollback) && !canRestoreLocation(row),
      canWrite: actor.canWrite,
      lastModifiedBy: row.auditTrail?.at(-1)?.actorId || null,
      lastModifiedAt: row.updatedAt || null,
      precondition: {
        expectedVersion: row.__v,
        expectedHash: locationHash(row),
      },
      region: {
        bounds: this.regions.get(row.regionId).bounds,
        center: this.regions.get(row.regionId).center,
      },
      warnings: row.locationReview
        ? locationWarnings(
            { ...row, approvedLocation: snapshot },
            row.locationReview,
            this.regions.get(row.regionId),
            this.warningPeers(
              context?.peers || (await this.peers(row.regionId)),
              publicRows,
            ),
          )
        : null,
    };
  }
  async list(actor: LocationActor, regionId: string, missingOnly = false) {
    locationScope(actor, regionId);
    this.regions.get(regionId);
    const rows = await this.peers(regionId);
    const publicRows = [
      ...((await this.regional.effectiveDataset(regionId))?.records || []),
    ];
    const filtered = missingOnly
      ? rows.filter(
          (r) =>
            !approvedLocationUsable({
              approvedLocation: locationSnapshot(
                r,
                publicRows.find((p) => p.entityUri === r.canonicalEntityId),
              ),
            }),
        )
      : rows;
    return {
      records: await Promise.all(
        filtered.map((r) => this.view(r, actor, { publicRows, peers: rows })),
      ),
    };
  }
  async detail(actor: LocationActor, regionId: string, id: string) {
    locationScope(actor, regionId);
    return this.view(await this.row(regionId, id), actor);
  }
  async preview(actor: LocationActor, regionId: string, id: string, raw: any) {
    locationScope(actor, regionId, true);
    const row = await this.row(regionId, id),
      proposal = locationProposal(raw, actor.actorId, new Date().toISOString());
    const detail = await this.view(row, actor);
    const publicRows =
      (await this.regional.effectiveDataset(regionId))?.records || [];
    return {
      proposal,
      current: detail.current,
      warnings: locationWarnings(
        {
          ...row,
          approvedLocation: locationSnapshot(
            row,
            publicRows.find((p) => p.entityUri === row.canonicalEntityId),
          ),
        },
        proposal,
        this.regions.get(regionId),
        this.warningPeers(await this.peers(regionId), publicRows),
      ),
    };
  }
  async candidates(
    actor: LocationActor,
    regionId: string,
    id: string,
    address: unknown,
  ) {
    locationScope(actor, regionId, true);
    await this.row(regionId, id);
    if (
      typeof address !== 'string' ||
      address.trim().length < 3 ||
      address.length > 300
    )
      throw new BadRequestException('검색할 주소를 입력해 주세요.');
    if (!process.env.KAKAO_REST_API_KEY)
      return { status: 'UNAVAILABLE', candidates: [] };
    try {
      const url = new URL(
        'https://dapi.kakao.com/v2/local/search/address.json',
      );
      url.searchParams.set('query', address.trim());
      url.searchParams.set('size', '10');
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      if (!response.ok) return { status: 'UNAVAILABLE', candidates: [] };
      const body = await response.json();
      if (!Array.isArray(body.documents))
        return { status: 'UNAVAILABLE', candidates: [] };
      const candidates = body.documents
        .slice(0, 10)
        .map((d: any) => ({
          latitude: d.y?.trim() ? Number(d.y) : NaN,
          longitude: d.x?.trim() ? Number(d.x) : NaN,
          normalizedAddress: d.road_address?.address_name || d.address_name,
          sourceType: 'OFFICIAL_MAP_LISTING',
          sourceReference: `https://map.kakao.com/?q=${encodeURIComponent(d.address_name || address)}`,
          confidence: ['ROAD_ADDR', 'REGION_ADDR'].includes(d.address_type)
            ? 'ADDRESS_MATCH'
            : 'LOW',
          verificationStatus: 'UNVERIFIED',
        }))
        .filter(
          (c: any) =>
            validLocation(c) && typeof c.normalizedAddress === 'string',
        );
      return {
        status:
          candidates.length > 1
            ? 'MULTIPLE'
            : candidates.length
              ? candidates[0].confidence === 'LOW'
                ? 'LOW_CONFIDENCE'
                : 'FOUND'
              : 'EMPTY',
        candidates,
      };
    } catch {
      return { status: 'UNAVAILABLE', candidates: [] };
    }
  }
  async action(
    actor: LocationActor,
    regionId: string,
    id: string,
    action: string,
    body: any,
  ) {
    locationScope(actor, regionId, true);
    if (
      !['PROPOSE', 'APPROVE', 'REJECT', 'RESTORE'].includes(action) ||
      !body ||
      Object.keys(body).some(
        (k) =>
          !['precondition', 'proposal', 'reason', 'reviewConfirmed'].includes(
            k,
          ),
      )
    )
      throw new BadRequestException('지원하지 않는 위치 검토 요청입니다.');
    const p = body.precondition;
    if (
      !p ||
      !/^[a-f0-9-]{36}$/i.test(p.requestId || '') ||
      !/^[a-f0-9]{64}$/.test(p.expectedHash || '') ||
      !Number.isInteger(p.expectedVersion)
    )
      throw new BadRequestException('장소를 새로 불러와 검토해 주세요.');
    const fingerprint = stableLocationHash({
      action,
      body,
      actorId: actor.actorId,
      regionId,
      id,
    });
    const replay = (row: any) => {
      const receipt = row.auditTrail?.find(
        (e) => e.locationRequestId === p.requestId,
      );
      if (!receipt) return false;
      if (receipt.fingerprint !== fingerprint)
        throw new ConflictException('다른 요청에 사용된 요청 번호입니다.');
      return true;
    };
    const row = await this.row(regionId, id);
    if (replay(row)) return this.view(row, actor);
    if (row.__v !== p.expectedVersion || locationHash(row) !== p.expectedHash)
      throw new ConflictException(
        '다른 변경이 있습니다. 새로 불러온 내용을 검토해 주세요.',
      );
    const at = new Date().toISOString(),
      fields: any = {},
      unset: any = {};
    let reason: string, before: any;
    if (action === 'PROPOSE') {
      fields.locationReview = locationProposal(
        body.proposal,
        actor.actorId,
        at,
      );
      reason = fields.locationReview.reason;
      if (row.locationReview?.verificationStatus === 'PROPOSED')
        throw new ConflictException(
          '기존 위치 제안을 먼저 승인 또는 반려해 주세요.',
        );
      // Freeze the existing public location on first enrollment. Legacy edits of
      // flat coordinate fields cannot publish a pending managed proposal.
      if (row.approvedLocation === undefined) {
        const publicRows =
          (await this.regional.effectiveDataset(regionId))?.records || [];
        fields.approvedLocation = locationSnapshot(
          row,
          publicRows.find((p) => p.entityUri === row.canonicalEntityId),
        );
      }
    } else {
      reason = locationReason(body.reason);
      if (action === 'RESTORE') {
        const rollback = row.locationRollback;
        if (!canRestoreLocation(row))
          throw new ConflictException(
            '승인 이후 변경되어 자동 복원할 수 없습니다. 새 위치 검토를 요청해 주세요.',
          );
        for (const key of ['latitude', 'longitude', 'approvedLocation']) {
          if (Object.hasOwn(rollback.before, key))
            fields[key] = rollback.before[key];
          else unset[key] = '';
        }
        fields.locationReview = {
          ...row.locationReview,
          verificationStatus: 'RESTORED',
          reviewedBy: actor.actorId,
          reviewedAt: at,
        };
        unset.locationRollback = '';
      } else {
        if (row.locationReview?.verificationStatus !== 'PROPOSED')
          throw new ConflictException('검토 중인 위치 제안이 없습니다.');
        fields.locationReview = {
          ...row.locationReview,
          verificationStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: actor.actorId,
          reviewedAt: at,
        };
        if (action === 'APPROVE') {
          const publicRows =
            (await this.regional.effectiveDataset(regionId))?.records || [];
          const warnings = locationWarnings(
            row,
            row.locationReview,
            this.regions.get(regionId),
            this.warningPeers(await this.peers(regionId), publicRows),
          );
          if (warnings.approvalBlocked)
            throw new BadRequestException(
              '지역 경계를 확인할 수 없거나 지역 밖 좌표입니다. 일반 승인할 수 없습니다.',
            );
          if (body.reviewConfirmed !== true)
            throw new BadRequestException(
              '지도·출처·이동 거리·중복 경고를 확인해 주세요.',
            );
          before = Object.fromEntries(
            ['latitude', 'longitude', 'approvedLocation']
              .filter((k) => Object.hasOwn(row, k))
              .map((k) => [k, row[k]]),
          );
          fields.approvedLocation = fields.locationReview;
          fields.latitude = row.locationReview.latitude;
          fields.longitude = row.locationReview.longitude;
        }
      }
    }
    fields.updatedAt = new Date(at);
    const resulting = { ...row, ...fields };
    for (const key of Object.keys(unset)) delete resulting[key];
    const event = {
      action: `LOCATION_${action}`,
      actorId: actor.actorId,
      regionId,
      at,
      reason,
      locationRequestId: p.requestId,
      fingerprint,
      canonicalEntityId: row.canonicalEntityId,
      before:
        currentLocation(
          action === 'PROPOSE'
            ? {
                approvedLocation:
                  fields.approvedLocation || row.approvedLocation,
              }
            : row,
        ) || null,
      after: currentLocation(resulting) || null,
      reviewedLocation: fields.locationReview,
    };
    if (action === 'APPROVE') {
      const expected = {
        ...row,
        ...fields,
        __v: row.__v + 1,
        auditTrail: [...(row.auditTrail || []), event],
      };
      delete expected.locationRollback;
      fields.locationRollback = {
        before,
        approvedVersion: row.__v + 1,
        postHash: stableLocationHash(expected),
      };
    }
    const updated = await this.model.collection.findOneAndUpdate(
      {
        _id: row._id,
        regionId,
        id,
        __v: p.expectedVersion,
        $expr: { $eq: ['$$ROOT', { $literal: row }] },
      },
      {
        $set: fields,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $inc: { __v: 1 },
        $push: { auditTrail: event },
      } as any,
      { returnDocument: 'after', includeResultMetadata: false, upsert: false },
    );
    if (!updated) {
      const latest = await this.row(regionId, id);
      if (replay(latest)) return this.view(latest, actor);
      throw new ConflictException(
        '동시에 변경되어 반영하지 않았습니다. 다시 검토해 주세요.',
      );
    }
    return this.view(updated, actor);
  }
}
