import { HAPCHEON_MASTER_DATA } from '../regions/hapcheon/master-data';
import { PlaceDiscoveryService } from './place-discovery.service';

const canonicalId =
  'https://hapcheon.example/ontology#hapcheonVideoThemePark';
const dataset = {
  effectiveDataset: jest.fn(async () => ({
    regionId: 'hapcheon',
    records: HAPCHEON_MASTER_DATA,
  })),
};

describe('receipt 32 user-visible exact attraction search', () => {
  const service = new PlaceDiscoveryService(dataset as any);

  it.each([
    '합천 영상테마파크 찾아줘',
    '합천영상테마파크 찾아줘',
    '영상테마파크 찾아줘',
  ])('returns the canonical public place first for %s', async (message) => {
    await expect(service.resolveExactPlaceIntent('hapcheon', message)).resolves.toMatchObject({
      category: 'TOURISM_NATURE',
      entityId: canonicalId,
    });

    const result: any = await service.discover(
      'hapcheon',
      'TOURISM_NATURE',
      message,
      { latitude: 35.5444275199, longitude: 128.0537942855 },
    );

    expect(result).toMatchObject({
      relation: 'REGIONAL',
      referenceResolution: { mode: 'EXPLICIT_ENTITY_TARGET' },
    });
    expect(result.entities[0]).toMatchObject({
      entityId: canonicalId,
      programLabel: '합천 영상테마파크',
      operationalEvidence: { verificationStatus: 'VERIFIED' },
    });
    expect(result.entities[0].reasons).toContain('요청한 장소명과 정확히 일치');
    expect(result.entities[0].programLabel).not.toBe('씨파크');
    expect(result.entities[0].programLabel).not.toBe('합천 정원테마파크');
  });

  it('keeps an explicit nearby request as distance-based anchor discovery', async () => {
    const result: any = await service.discover(
      'hapcheon',
      'TOURISM_NATURE',
      '합천 영상테마파크 주변 관광지 찾아줘',
      { preferCloser: true },
    );

    expect(result).toMatchObject({
      anchorEntityId: canonicalId,
      anchorLabel: '합천 영상테마파크',
      relation: 'NEARBY',
      referenceResolution: { mode: 'EXPLICIT_ENTITY' },
    });
    expect(result.entities.map((entity: any) => entity.entityId)).not.toContain(
      canonicalId,
    );
  });
});
