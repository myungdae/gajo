import test from "node:test";
import assert from "node:assert/strict";
import { MANAGED_VISITOR_COPY, managedVisitorKeyCount, managedVisitorText } from "./managedVisitorCopy.ts";
import { VISITOR_COPY, assertCompleteVisitorDictionary, localePath, normalizeLocale } from "./visitorI18n.ts";
import { resolveVisitorLocale } from './visitorLocaleContract.ts';
import { localizedRegionalPath } from './visitorRouting.ts';
import { visitorLocaleRequest } from './api/visitorLocaleRequest.ts';
import { companionSharePayload } from './shareConfig.ts';
import { REGION_CONFIGS } from './regionConfig.ts';
import { archiveAndStartNewTrip, setTripLanguage } from './tripSession.ts';

test("all managed visitor keys contain reviewed ko and en copy", () => {
  assert.equal(assertCompleteVisitorDictionary(VISITOR_COPY), 11);
  assert.ok(managedVisitorKeyCount >= 130);
  for (const [key, pair] of Object.entries(MANAGED_VISITOR_COPY)) {
    assert.ok(pair.ko.trim(), `${key}.ko`);
    assert.ok(pair.en.trim(), `${key}.en`);
  }
});

test("English continuity covers the complete visitor route", () => {
  const routes = [
    "/hapcheon?start=ai", "/hapcheon/nearby-discovery", "/hapcheon/nearby-discovery?category=FOOD",
    "/hapcheon/map?entityUri=place%3A1", "/hapcheon/itinerary", "/hapcheon/concierge?mode=now",
    "/hapcheon/meteor-crater", "/hapcheon", "/hapcheon/nearby-discovery?from=trip", "/hapcheon?start=ai#home",
  ];
  for (const route of routes) assert.equal(new URL(localePath(route, "en"), "https://example.test").searchParams.get("lang"), "en");
  assert.equal(normalizeLocale("fr"), "ko");
  assert.equal(normalizeLocale(undefined), "ko");
});

test("required Nearby and dynamic presentation copy is reviewed", () => {
  assert.equal(managedVisitorText("내 주변 찾기", "en"), "Nearby");
  assert.equal(managedVisitorText("현재 위치로 찾기", "en"), "Use My Current Location");
  assert.equal(managedVisitorText("현재 합천 주변을 찾고 있어요", "en"), "Exploring places near 합천");
  assert.equal(managedVisitorText("현재 위치에서 직선거리 약 1.2km", "en"), "About 1.2km away in a straight line");
});

test("proper nouns and source-provided Korean remain unchanged", () => {
  assert.equal(managedVisitorText("합천운석충돌구", "en"), "합천운석충돌구");
  assert.equal(managedVisitorText("경상남도 합천군 초계면", "en"), "경상남도 합천군 초계면");
});

test('all six regions preserve language in links, fragments and shared entries', () => {
  for (const id of ['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu'] as const) {
    for (const route of ['/nearby-discovery','/map?entityUri=urn%3Aplace#detail','/itinerary','/concierge?mode=now','?start=ai']) {
      const url = new URL(localizedRegionalPath(route, id, true, 'en'), 'https://example.test');
      assert.ok(url.pathname.startsWith(`/${id}`));
      assert.equal(url.searchParams.get('lang'),'en');
    }
    const share = new URL(companionSharePayload(REGION_CONFIGS[id], 'REGIONAL_ENTRY', 'en').url);
    assert.equal(share.searchParams.get('lang'), 'en');
    assert.equal(share.searchParams.get('start'), 'ai');
  }
  assert.equal(localePath('/map?lang=en&entityUri=a#detail','ko'), '/map?entityUri=a#detail');
});

test('explicit URL locale wins over storage and invalid locale defaults to ko', () => {
  assert.equal(resolveVisitorLocale('?lang=en','ko'),'en');
  assert.equal(resolveVisitorLocale('?lang=ko','en'),'ko');
  assert.equal(resolveVisitorLocale('?lang=invalid','en'),'ko');
  assert.equal(resolveVisitorLocale('','en'),'en');
});

test('API locale travels independently of Korean user input and keeps region data intact', () => {
  for (const locale of ['ko','en'] as const) {
    const request = visitorLocaleRequest({params:{regionId:'hapcheon'},data:{rawMessage:'합천 카페',regionId:'hapcheon',latitude:35.5}},locale);
    assert.deepEqual(request.data,{rawMessage:'합천 카페',regionId:'hapcheon',latitude:35.5,locale});
    assert.deepEqual(request.params,{regionId:'hapcheon',locale});
  }
});

test('visitor locale does not modify administrator or partner management requests', () => {
  for (const url of ['/admin/regional-data','/admin/regional-spotlights','/partners/applications','/analytics/summary']) {
    const data={regionId:'hapcheon',reviewedEnglishName:'Reviewed Place'},request={url,data};
    assert.equal(visitorLocaleRequest(request,'en').data,data);
    assert.equal('params' in request,false);
  }
  for(const url of ['/nearby/discovery','/concierge/chat','/runtime-replanning/observe','/recommendations/itinerary','/trips/anonymous/sync']) {
    assert.deepEqual(visitorLocaleRequest({url,params:{regionId:'hapcheon'}},'en').params,{regionId:'hapcheon',locale:'en'});
  }
});

test('starting a new trip retains regional language without crossing region boundaries', () => {
  const values = new Map<string,string>();
  const storage = {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
  setTripLanguage('hapcheon','en',storage);
  setTripLanguage('okcheon','ko',storage);
  assert.equal(archiveAndStartNewTrip('hapcheon',storage).language,'en');
  assert.equal(archiveAndStartNewTrip('okcheon',storage).language,'ko');
});
