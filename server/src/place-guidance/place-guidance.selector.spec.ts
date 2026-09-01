import {selectPlaceGuidance} from './place-guidance.selector';
import type {OperationalTip} from './place-guidance.types';

const source={sourceType:'OFFICIAL_LOCAL_GOV',sourceName:'공식 관광안내',sourceUrl:'https://example.go.kr/place',verifiedAt:'2026-08-01'};
const tips:OperationalTip[]=[
 {id:'general',trigger:{},priority:10,message:'야외 관람 구간이 많습니다.',actionSuggestion:'모자와 물을 준비하세요.',provenance:source},
 {id:'rain',trigger:{weather:['RAIN']},priority:80,message:'현재 비가 내려 노면이 미끄러울 수 있어요.',actionSuggestion:'우산과 미끄럼 방지 신발을 준비하세요.',provenance:source,realtimeRequired:true,maxAgeMinutes:60},
 {id:'wind',trigger:{windSpeedAtLeast:9},priority:90,message:'현재 바람이 강합니다.',actionSuggestion:'능선 접근에 주의하세요.',provenance:source,realtimeRequired:true,maxAgeMinutes:30},
];
const record={entityUri:'urn:region-a:place',description:'검증된 장소 기본 설명입니다.',operationalTips:tips};
const live={weather:'RAIN',windSpeed:10,weatherObservation:{source:'OPEN_METEO',observedAt:'2026-09-01T00:00:00.000Z'}};
describe('place guidance selector contract',()=>{
 it('falls back safely without context',()=>expect(selectPlaceGuidance(record,{},new Date('2026-09-01T00:10:00Z'))).toMatchObject({shortDescription:record.description,tipId:'general',realtime:false}));
 it('uses fresh sourced live context and deterministic priority',()=>{const a=selectPlaceGuidance(record,live,new Date('2026-09-01T00:10:00Z')),b=selectPlaceGuidance(record,live,new Date('2026-09-01T00:10:00Z'));expect(a).toEqual(b);expect(a).toMatchObject({tipId:'wind',realtime:true,observedAt:'2026-09-01T00:00:00.000Z'})});
 it.each([{...live,weatherObservation:{source:'UNAVAILABLE',observedAt:'2026-09-01T00:00:00Z'}},{...live,weatherObservation:{source:'OPEN_METEO',status:'STALE',stale:true,observedAt:'2026-09-01T00:09:00Z'}},{...live,weatherObservation:{source:'OPEN_METEO',observedAt:'2026-08-31T20:00:00Z'}},{weather:'RAIN'}])('never states live weather from stale or unsourced input',context=>expect(selectPlaceGuidance(record,context,new Date('2026-09-01T00:10:00Z')).tipId).toBe('general'));
 it('does not leak tips across canonical entities',()=>expect(selectPlaceGuidance({entityUri:'urn:region-b:place',description:'B 설명',operationalTips:[]},live,new Date('2026-09-01T00:10:00Z'))).toEqual({shortDescription:'B 설명',situationalMessage:undefined,actionSuggestion:undefined,tipId:undefined,realtime:false,observedAt:undefined,evidenceLabel:undefined}));
});
