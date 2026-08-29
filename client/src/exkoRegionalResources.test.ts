import test from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED_EXKO_SUBREGION_RESOURCES, verifiedExkoSubregionResource } from './exkoRegionalResources.ts';

test('duplicate EXKO resources preserve sitemap labels instead of invented prefixed names',()=>{
  const expected:Record<string,string>={
    'busan:남구':'남구(부산광역시)',
    'daejeon:중구':'중구(대전광역시)',
    'seoul:강서구':'강서구',
    'busan:강서구':'강서구(부산광역시)',
    'gangwon:고성군':'고성군(강원)',
    'gyeongnam:고성군':'고성군(경남)',
  };
  for(const [key,label] of Object.entries(expected)) assert.equal(VERIFIED_EXKO_SUBREGION_RESOURCES[key]?.label,label);
  for(const value of Object.values(VERIFIED_EXKO_SUBREGION_RESOURCES)) {
    assert.doesNotMatch(value.label,/^(?:대전|부산|광주|서울|강원|경남)(?:중구|남구|서구|동구|북구|강서구|고성군)$/);
    assert.equal(new URL(value.href).search,'');
    assert.equal(decodeURIComponent(new URL(value.href).pathname.replace('/resource/','')),value.label);
  }
});

test('Gwangju resources retain their stable former metropolitan parent explicitly',()=>{
  for(const name of ['동구','서구','남구','북구']){
    const mapping=verifiedExkoSubregionResource('gwangju-jeonnam',name)!;
    assert.equal(mapping.label,`${name}(광주광역시)`);
    assert.equal(mapping.relation,'HISTORICAL_STABLE');
  }
  assert.equal(verifiedExkoSubregionResource('gwangju-jeonnam','중구'),undefined);
});

test('2026 Incheon replacements are not linked to obsolete EXKO district resources',()=>{
  for(const name of ['제물포구','영종구','서해구','검단구']) assert.equal(verifiedExkoSubregionResource('incheon',name),undefined);
  for(const name of ['중구','동구','서구']) assert.equal(verifiedExkoSubregionResource('incheon',name),undefined);
});

test('mapping lookup is an exact allowlist and never composes user input',()=>{
  for(const [parent,name] of [['busan','남구/evil'],['busan','남구?x=1'],['BUSAN','남구'],['unknown','남구']]) assert.equal(verifiedExkoSubregionResource(parent,name),undefined);
});
