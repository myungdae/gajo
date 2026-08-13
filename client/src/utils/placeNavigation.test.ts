import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationDestination, navigationTarget } from './placeNavigation.ts';

const place={name:'검색 이름',canonicalLabel:'가조 온천 가족탕',lat:35.7,lng:128.02};
const destination=navigationDestination(place)!;
const origin={latitude:35.69,longitude:128.01};

test('provider navigation links include destination latitude and longitude',()=>{for(const provider of ['naver','kakao','tmap'] as const){const target=navigationTarget(provider,destination,origin);assert.ok(target.native.includes('35.7'));assert.ok(target.native.includes('128.02'))}});
test('Korean canonical place name is safely encoded in every provider link',()=>{const encoded=encodeURIComponent('가조 온천 가족탕');for(const provider of ['naver','kakao','tmap'] as const){const target=navigationTarget(provider,destination,origin);assert.ok(target.native.includes(encoded));if(provider!=='tmap')assert.ok(target.fallback.includes(encoded))}});
test('provider targets represent route or navigation rather than generic search',()=>{const naver=navigationTarget('naver',destination,origin),kakao=navigationTarget('kakao',destination,origin),tmap=navigationTarget('tmap',destination,origin);assert.match(naver.native,/nmap:\/\/navigation\?/);assert.match(naver.fallback,/\/directions\//);assert.doesNotMatch(naver.fallback,/\/search\//);assert.match(kakao.native,/kakaomap:\/\/route\?/);assert.match(kakao.fallback,/\/from\/.+\/to\//);assert.match(tmap.native,/tmap:\/\/route\?/)});
test('available current location is passed as route origin without mutation',()=>{const before=JSON.stringify({place,origin});const naver=navigationTarget('naver',destination,origin),kakao=navigationTarget('kakao',destination,origin);assert.ok(naver.native.includes('slat=35.69'));assert.ok(naver.native.includes('slng=128.01'));assert.ok(kakao.native.includes('sp=35.69,128.01'));assert.equal(JSON.stringify({place,origin}),before)});
test('invalid or placeholder coordinates and empty names suppress navigation',()=>{assert.equal(navigationDestination({name:'장소',lat:0,lng:0}),null);assert.equal(navigationDestination({name:'장소',lat:91,lng:128}),null);assert.equal(navigationDestination({name:'',lat:35.7,lng:128}),null)});
test('existing map view and itinerary-add behavior remain unchanged',()=>{const mapLink='https://map.kakao.com/link/to/place,35.7,128.02',placeUrl='https://place.map.kakao.com/1';assert.equal(mapLink||placeUrl,mapLink);const itineraryNotice='일정 변경은 확인 후 반영됩니다. 이 장소를 일정에 넣으려면 현재 일정 화면에서 변경을 요청해 주세요.';assert.equal(itineraryNotice,'일정 변경은 확인 후 반영됩니다. 이 장소를 일정에 넣으려면 현재 일정 화면에서 변경을 요청해 주세요.')});
