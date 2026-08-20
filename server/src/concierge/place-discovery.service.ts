import { Injectable, Optional } from '@nestjs/common';
import { RegionalDataService } from '../regional-data/regional-data.service';
import type { DiscoveryCategory } from './intent-routing';
import { recordAccommodationType, requestedAccommodationType } from './accommodation-taxonomy';

const CATEGORY_MATCH: Record<DiscoveryCategory, (record: any) => boolean> = {
  CAFE: (record) => record.entityType === 'CAFE' || record.category === 'CAFE',
  FOOD: (record) => record.entityType === 'RESTAURANT' || record.category === 'FOOD',
  LODGING: (record) => record.entityType === 'ACCOMMODATION' || /LODGING|ACCOMMODATION/.test(record.category),
  ACTIVITY: (record) => /EXPERIENCE|ACTIVITY/.test(`${record.entityType} ${record.category}`),
  TOURISM_NATURE: (record) => /ATTRACTION|TOURISM/.test(`${record.entityType} ${record.category}`),
  CONVENIENCE: (record) => /CONVENIENCE/.test(`${record.entityType} ${record.category}`),
};

@Injectable()
export class PlaceDiscoveryService {
  constructor(@Optional() private readonly regionalData?: RegionalDataService) {}

  async discover(regionId: string, category: DiscoveryCategory, message: string, context: any) {
    const dataset = await this.regionalData?.effectiveDataset(regionId);
    if (!dataset) return { regionId, category, entities: [] };

    const requested = new Set<string>(context.activityPreferences || []);
    if (/합천호|호수|전망|풍경/.test(message)) requested.add('HAPCHEON_LAKE');
    if (/쉬|휴식|편안|부모님/.test(message)) requested.add('REST');
    requested.add(category);

    const anchor = this.resolveExplicitAnchor(dataset.records, message);
    // A place named in the current utterance owns the origin. If it has no
    // verified point, stale session/runtime coordinates must not replace it.
    const origin = anchor ? this.coordinates(anchor) : this.contextOrigin(context);
    const accommodationType = category === 'LODGING' ? requestedAccommodationType(message) : undefined;
    const ranked = dataset.records
      .filter(CATEGORY_MATCH[category])
      .filter((record) => !accommodationType || recordAccommodationType(record) === accommodationType)
      .map((record) => {
        const matched = (record.tags || []).filter((tag: string) => requested.has(tag));
        const distanceMeters = this.distance(origin, this.coordinates(record));
        const score = 100 + matched.length * 20
          + (Number.isFinite(record.latitude) && Number.isFinite(record.longitude) ? 1 : 0)
          + (distanceMeters === undefined ? 0 : Math.max(0, 30 - distanceMeters / 1000));
        return { record, matched, distanceMeters, score };
      })
      .sort((a, b) => b.score - a.score
        || (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
        || a.record.entityUri.localeCompare(b.record.entityUri));

    return {
      regionId,
      category,
      anchorEntityId: anchor?.entityUri,
      anchorLabel: anchor?.canonicalLabelKo,
      entities: ranked.map(({ record, matched, distanceMeters, score }, index) => ({
        entityId: record.entityUri,
        regionId,
        order: index + 1,
        programUri: record.entityUri,
        programLabel: record.canonicalLabelKo,
        facilityUri: record.entityUri,
        facilityLabel: record.canonicalLabelKo,
        entityType: record.entityType,
        category: record.category,
        accommodationType: recordAccommodationType(record),
        areaLabel: record.areaLabel,
        description: record.description,
        address: record.address,
        telephone: record.telephone,
        website: record.website,
        reservationUrl: record.reservationUrl,
        latitude: record.latitude,
        longitude: record.longitude,
        actions: record.actions,
        source: record.source,
        lastVerifiedAt: record.lastVerifiedAt,
        distanceMeters,
        reasons: [
          ...matched.map((tag: string) => tag === 'HAPCHEON_LAKE'
            ? '합천호 관련 맥락'
            : tag === 'REST' ? '휴식 맥락' : tag === category ? '요청한 장소 유형' : tag),
          ...(distanceMeters !== undefined
            ? [`${anchor?.canonicalLabelKo || '현재 위치'} 기준 ${distanceMeters}m`]
            : []),
        ],
        score,
      })),
    };
  }

  private resolveExplicitAnchor(records: readonly any[], message: string) {
    const normalizedMessage = this.normalize(message);
    const matches = records.flatMap((record) => [record.canonicalLabelKo, ...(record.alternateLabels || [])]
      .map((label: string) => ({ record, label: this.normalize(label) }))
      .filter(({ label }) => label.length > 0 && normalizedMessage.includes(label)));
    return matches.sort((a, b) => b.label.length - a.label.length)[0]?.record;
  }

  private normalize(value: string) {
    return value.replace(/\s/g, '').toLocaleLowerCase('ko-KR');
  }

  private contextOrigin(context: any) {
    return Number.isFinite(context.latitude) && Number.isFinite(context.longitude)
      ? { latitude: context.latitude, longitude: context.longitude }
      : undefined;
  }

  private coordinates(record: any) {
    return Number.isFinite(record?.latitude) && Number.isFinite(record?.longitude)
      ? { latitude: record.latitude, longitude: record.longitude }
      : undefined;
  }

  private distance(a?: { latitude: number; longitude: number }, b?: { latitude: number; longitude: number }) {
    if (!a || !b) return undefined;
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLng = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return Math.round(6371000 * 2 * Math.asin(Math.sqrt(h)));
  }
}
