import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARED_VISITOR_COPY } from './visitorCopy.ts';
import { GAJO_CONFIG } from './regionConfig.ts';

test('shared result copy is region-neutral', () => {
  assert.equal(SHARED_VISITOR_COPY.understoodHeading, '이렇게 이해했어요');
  assert.equal(SHARED_VISITOR_COPY.recommendationHeading, '추천 일정');
  assert.equal(Object.values(SHARED_VISITOR_COPY).some(value => value.includes('가조이')), false);
});

test('Gajo regional home branding remains configured', () => {
  assert.equal(GAJO_CONFIG.regionName, '가조');
  assert.equal(GAJO_CONFIG.heroTitle, '가조에 오신 것을 환영합니다');
  assert.equal(GAJO_CONFIG.serviceName, '가조 여행 동행');
});
