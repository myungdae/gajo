import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHILD_REGIONS, findNationwideRegion, NATIONWIDE_REGIONS, regionsForParent, searchNationwideRegions, TOP_LEVEL_REGIONS } from './nationwideRegions.ts';
import { appSurface, shouldRegisterVisitorPwa } from './regionRouting.ts';

const explorer = readFileSync(new URL('./components/NationwideRegionExplorer.tsx', import.meta.url), 'utf8');
const portal = readFileSync(new URL('./pages/PlatformPortalPage.tsx', import.meta.url), 'utf8');

test('2026-07 nationwide hierarchy includes every current top-level region and 229 subordinate explorer units', () => {
  assert.equal(TOP_LEVEL_REGIONS.length, 16);
  assert.equal(CHILD_REGIONS.length, 229);
  assert.equal(NATIONWIDE_REGIONS.length, 245);
  assert.equal(regionsForParent('seoul').length, 25);
  assert.equal(regionsForParent('incheon').length, 11);
  for (const name of ['제물포구','영종구','서해구','검단구']) assert.ok(regionsForParent('incheon').some((region) => region.name === name));
});

test('Gwangju-Jeonnam transition keeps current official name and predecessor search aliases', () => {
  const merged = findNationwideRegion('gwangju-jeonnam')!;
  assert.equal(merged.name, '전남광주통합특별시');
  assert.equal(merged.shortName, '광주특별시');
  assert.deepEqual(merged.aliases, ['광주광역시','전라남도','전남','광주']);
  assert.equal(regionsForParent(merged.id).length, 27);
  assert.equal(searchNationwideRegions('전라남도')[0]?.id, merged.id);
  assert.equal(searchNationwideRegions('광주광역시')[0]?.id, merged.id);
});

test('only verified existing AI and EXKO destinations are actionable', () => {
  assert.deepEqual(
    ['hapcheon','geochang','okcheon','gyeryong'].map((id) => {
      const region = findNationwideRegion(id)!;
      return [region.id, region.status, region.aiUrl, region.aiRegionId, region.exkoRegionId];
    }),
    [
      ['hapcheon','AI_LIVE','/hapcheon','hapcheon','hapcheon'],
      ['geochang','FIELD_TEST','/gajo','gajo','geochang'],
      ['okcheon','FIELD_TEST','/okcheon','okcheon','okcheon'],
      ['gyeryong','FIELD_TEST','/gyeryong','gyeryong',undefined],
    ],
  );
  assert.equal(findNationwideRegion('geochang')?.aliases?.includes('가조'), true);
  assert.ok(CHILD_REGIONS.filter((region) => region.status === 'UNAVAILABLE').every((region) => !region.aiUrl && !region.exkoRegionId));
});

test('search supports top-level and child names without manufacturing routes', () => {
  assert.ok(searchNationwideRegions('합천').some((region) => region.id === 'hapcheon'));
  assert.ok(searchNationwideRegions('가조').some((region) => region.id === 'geochang'));
  assert.ok(searchNationwideRegions('계룡').some((region) => region.id === 'gyeryong'));
  assert.ok(searchNationwideRegions('강남구').some((region) => region.name === '강남구'));
  assert.deepEqual(searchNationwideRegions('없는지역'), []);
});

test('duplicate display names use EXKOVIA hierarchy while verified EXKO identity stays separate',()=>{
  const busanNamgu=CHILD_REGIONS.find((region)=>region.parentId==='busan'&&region.name==='남구')!;
  assert.equal(busanNamgu.displayName,'남구 · 부산광역시');
  assert.equal(busanNamgu.exkoResourceLabel,'남구(부산광역시)');
  assert.equal(busanNamgu.status,'EXKO_ONLY');
  const gwangjuNamgu=CHILD_REGIONS.find((region)=>region.parentId==='gwangju-jeonnam'&&region.name==='남구')!;
  assert.equal(gwangjuNamgu.displayName,'남구 · 광주특별시');
  assert.equal(gwangjuNamgu.exkoResourceLabel,'남구(광주광역시)');
  assert.equal(gwangjuNamgu.exkoResourceRelation,'HISTORICAL_STABLE');
});

test('nationwide explorer exposes accessible selection, search, status and safe unavailable cards', () => {
  for (const token of ['type="search"','aria-pressed','aria-live="polite"','아직 AI 여행안내가 제공되지 않습니다','region-explorer-primary','ExkoRegionKnowledgeLink']) assert.match(explorer, new RegExp(token));
  assert.match(explorer, /<a className="region-explorer-primary" href=\{region\.aiUrl\}>/);
  assert.match(portal, /<NationwideRegionExplorer \/>/);
  assert.match(portal, /to: '\/gyeryong'/);
});

test('region directory deep links remain platform web routes without regional PWA', () => {
  for (const path of ['/regions','/regions/seoul','/regions/gwangju-jeonnam','/regions/geochang']) {
    assert.equal(appSurface(path, '', 'exkovia.com'), 'PLATFORM');
    assert.equal(shouldRegisterVisitorPwa(path, '', 'exkovia.com'), false);
  }
  assert.equal(appSurface('/regions/seoul/extra', '', 'exkovia.com'), 'UNSUPPORTED');
  assert.equal(appSurface('/regions/seoul', '', 'unknown.example'), 'UNSUPPORTED');
});
