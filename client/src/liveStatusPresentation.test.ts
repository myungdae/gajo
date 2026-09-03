import test from 'node:test';
import assert from 'node:assert/strict';
import { liveRegionName, liveStatusHeading, weatherStatusLabel } from './liveStatusPresentation.ts';
import { REGION_CONFIGS, getRegionalHomeEnglish } from './regionConfig.ts';
import { managedVisitorText } from './managedVisitorCopy.ts';

test('live headings use reviewed RegionConfig names and preserve Korean on language changes', () => {
  for (const region of Object.values(REGION_CONFIGS)) {
    assert.equal(liveRegionName(region.id, region.regionName, 'en'), getRegionalHomeEnglish(region).regionName);
    assert.equal(liveStatusHeading(region.id, region.regionName, 'ko'), `지금 ${region.regionName}`);
  }
  assert.equal(liveStatusHeading('hapcheon', '합천', 'en'), 'Now in Hapcheon');
  assert.equal(liveStatusHeading('hapcheon', '합천', 'ko'), '지금 합천');
  assert.equal(liveStatusHeading('unknown', '외부 지역', 'en'), 'Now in this area');
});

test('all supported weather codes and Korean labels have fixed English presentation', () => {
  const cases = [
    ['CLEAR', '맑음', 'Clear'], ['CLOUDY', '흐림', 'Cloudy'],
    ['PARTLY_CLOUDY', '구름 많음', 'Mostly cloudy'],
    ['RAIN', '비', 'Rain'], ['LIGHT_RAIN', '약한 비', 'Light rain'],
    ['HEAVY_RAIN', '강한 비', 'Heavy rain'], ['SHOWER', '소나기', 'Showers'],
    ['SNOW', '눈', 'Snow'], ['FOG', '안개', 'Fog'],
    ['STRONG_WIND', '강풍', 'Strong winds'], ['THUNDERSTORM', '뇌우', 'Thunderstorm'],
    ['UNKNOWN', '날씨 정보 없음', 'Weather unavailable'],
  ];
  for (const [code, ko, en] of cases) {
    assert.equal(weatherStatusLabel(code, 'en'), en);
    assert.equal(weatherStatusLabel(ko, 'en'), en);
    assert.equal(weatherStatusLabel(code, 'ko'), ko);
  }
  for (const value of [undefined, null, '', '외부의 새로운 날씨', '<b>Cloudy</b>', 'constructor', {}]) {
    assert.equal(weatherStatusLabel(value, 'en'), 'Weather unavailable');
    assert.equal(weatherStatusLabel(value, 'ko'), '날씨 정보 없음');
  }
});

test('combined time and temperature do not depend on whole-text dictionary matching', () => {
  const line = ['14:30', '23°C', weatherStatusLabel('CLOUDY', 'en')].join(' · ');
  assert.equal(managedVisitorText(line, 'en'), '14:30 · 23°C · Cloudy');
  assert.equal(['14:30', '23°C', weatherStatusLabel('CLOUDY', 'ko')].join(' · '), '14:30 · 23°C · 흐림');
});
