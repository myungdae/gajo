import test from 'node:test';
import assert from 'node:assert/strict';
import { tourismRepresentativeTitle, tourismResultSections } from './nearbyTourismPresentation.ts';

const place = (name: string, trust: any, distanceMeters: number) => ({
  id: name, name, category: 'TOURIST_ATTRACTION', categoryLabel: '관광지',
  providerCategoryName: '여행 > 관광명소', address: '경상남도 합천군', lat: 35.5,
  lng: 128, placeUrl: '', indoorRelevance: 'UNKNOWN', operatingState: 'UNKNOWN',
  operatingMessage: '확인 필요', contextualReasons: [], transient: trust !== 'REGIONAL_VERIFIED',
  relevanceScore: 0, tourismTrustLevel: trust, distanceMeters,
} as any);

test('verified regional tourism stays distinct from a closer provider landform', () => {
  const sections = tourismResultSections('TOURIST_ATTRACTION', [
    place('검증 대표 관광지', 'REGIONAL_VERIFIED', 8000),
    place('일반 지형물', 'PROVIDER_CATEGORY', 275),
  ])!;
  assert.deepEqual(sections.representative.map((row) => row.name), ['검증 대표 관광지']);
  assert.deepEqual(sections.nearby.map((row) => row.name), ['일반 지형물']);
});

test('an officially verified lake is retained in the representative section', () => {
  const sections = tourismResultSections('TOURIST_ATTRACTION', [place('공식 관광 호수', 'REGIONAL_VERIFIED', 5000)])!;
  assert.equal(sections.representative.length, 1);
});

test('non-tourism presentation remains unchanged', () => {
  assert.equal(tourismResultSections('FOOD', [place('식당', undefined, 100)]), undefined);
});

test('representative title uses only the canonical region display name and fails closed', () => {
  assert.equal(tourismRepresentativeTitle('합천'), '합천에서 먼저 가볼 만한 곳');
  assert.equal(tourismRepresentativeTitle('옥천'), '옥천에서 먼저 가볼 만한 곳');
  assert.equal(tourismRepresentativeTitle('가조'), '가조에서 먼저 가볼 만한 곳');
  assert.equal(tourismRepresentativeTitle(), '지역에서 먼저 가볼 만한 곳');
});
