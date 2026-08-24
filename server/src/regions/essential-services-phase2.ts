import type { RegionalCandidateRecord } from './regional-candidate.registry';

export type RefreshCadence = 'STATIC' | 'PERIODIC' | 'LIVE';
export interface OfficialSourceAdapter {
  id: string; organization: string; sourceUrl: string;
  officialStatus: 'MUNICIPAL_OFFICIAL' | 'PUBLIC_DATA' | 'OPINET' | 'OFFICIAL_EV_DATA';
  accessMethod: 'EMBEDDED_JSON' | 'OPEN_API' | 'DOCUMENT' | 'WEB_PAGE';
  refreshCadence: RefreshCadence;
  credentialStatus: 'DATA_AVAILABLE' | 'API_READY' | 'CREDENTIAL_REQUIRED';
  machineReadable: boolean; fields: readonly string[]; limitations: string;
}

export const PHASE2_SOURCE_ADAPTERS: readonly OfficialSourceAdapter[] = [
  { id:'okcheon-smart-map', organization:'옥천군', sourceUrl:'https://safe.oc.go.kr/smartMap/selectSmartMapWebView.do', officialStatus:'MUNICIPAL_OFFICIAL', accessMethod:'EMBEDDED_JSON', refreshCadence:'PERIODIC', credentialStatus:'DATA_AVAILABLE', machineReadable:true, fields:['locNo','ctgryNm','title','address','local','latitude','longitude','telephone','homepage','detail'], limitations:'페이지에 갱신일·라이선스·운영시간·접근성·실시간 상태가 표시되지 않습니다.' },
  { id:'opinet-api', organization:'한국석유공사 OPINET', sourceUrl:'https://www.opinet.co.kr/user/custapi/custApiInfo.do', officialStatus:'OPINET', accessMethod:'OPEN_API', refreshCadence:'PERIODIC', credentialStatus:'CREDENTIAL_REQUIRED', machineReadable:true, fields:['station identity','address','brand','fuel prices (API dependent)'], limitations:'API 키가 없어 현재 가격·영업 상태를 수집하거나 약속하지 않습니다.' },
  { id:'environment-ev-api', organization:'환경부/한국환경공단 공공데이터', sourceUrl:'https://www.data.go.kr/data/15076352/openapi.do', officialStatus:'OFFICIAL_EV_DATA', accessMethod:'OPEN_API', refreshCadence:'PERIODIC', credentialStatus:'CREDENTIAL_REQUIRED', machineReadable:true, fields:['station identity','address','coordinates','operator','charger type','capacity','status'], limitations:'서비스 키가 없어 정적 시설정보와 실시간 충전기 상태를 수집하지 않습니다.' },
] as const;

export type SmartMapRow = { locNo:number; ctgryNm:string; title:string; address:string; local:string; lat:string; lng:string; tel?:string; homepage?:string };
const SOURCE_URL = PHASE2_SOURCE_ADAPTERS[0].sourceUrl, observedAt = '2026-08-24';
const TYPE: Record<string, 'PARKING'|'PUBLIC_TOILET'|'GAS_STATION'|'EV_CHARGER'> = { '공영주차장':'PARKING', '공중화장실':'PUBLIC_TOILET', '주유소':'GAS_STATION', '전기차충전소':'EV_CHARGER' };

export function parseOkcheonSmartMapRows(rows: readonly SmartMapRow[]): RegionalCandidateRecord[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const entityType = TYPE[row.ctgryNm], latitude = Number(row.lat), longitude = Number(row.lng), key = `${row.locNo}:${entityType}`;
    if (!entityType || seen.has(key) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    seen.add(key);
    return [{ entityUri:`https://okcheon.example/ontology#smartMap-${row.locNo}`, canonicalLabelKo:row.title.trim(), alternateLabels:[], entityType, category:entityType, tags:[entityType,'ESSENTIAL_SERVICE',row.local], runtimeDataStatus:'PARTIAL', address:`충청북도 옥천군 ${row.address.trim()}`, latitude, longitude, telephone:row.tel?.trim()||undefined, description:`옥천군 생활지도에 ${row.ctgryNm}로 등재된 시설입니다. 운영시간과 현재 이용 가능 여부는 확인이 필요합니다.`, actions:{detail:{url:SOURCE_URL}}, source:{sourceType:'MUNICIPAL_OFFICIAL',sourceName:'옥천군 행복드림 생활지도서비스',sourceUrl:SOURCE_URL,observedAt,locNo:row.locNo,evidenceStatus:'EVIDENCE_READY'}, coordinateSource:{sourceType:'MUNICIPAL_OFFICIAL',sourceName:'옥천군 행복드림 생활지도서비스',sourceUrl:SOURCE_URL,observedAt}, lastVerifiedAt:observedAt }];
  });
}

const ROWS: readonly SmartMapRow[] = [
  {locNo:14773,ctgryNm:'공중화장실',title:'장계관광지 카페프란스 앞 공중화장실',address:'안내면 장계1길 57-2',local:'안내면',lat:'36.3765224',lng:'127.6376843'},
  {locNo:14774,ctgryNm:'공중화장실',title:'장계관광지 향토전시관 옆 공중화장실',address:'안내면 장계1길 57-2',local:'안내면',lat:'36.37729579748736',lng:'127.63565382209543'},
  {locNo:14776,ctgryNm:'공중화장실',title:'육영수생가 대형주차장 공중화장실',address:'옥천읍 하계리 2-5',local:'옥천읍',lat:'36.3158124',lng:'127.5845998'},
  {locNo:14777,ctgryNm:'공중화장실',title:'정지용문학관 앞 공중화장실',address:'옥천읍 향수길 56',local:'옥천읍',lat:'36.3150178',lng:'127.581575'},
  {locNo:14783,ctgryNm:'공중화장실',title:'장령산자연휴양림 야영장화장실',address:'군서면 장령산로 519',local:'군서면',lat:'36.24520607972952',lng:'127.55522569374673'},
  {locNo:13781,ctgryNm:'공영주차장',title:'금구 공영주차타워',address:'옥천읍 금구리 23-1',local:'옥천읍',lat:'36.3016180955136',lng:'127.570186773703'},
  {locNo:13784,ctgryNm:'공영주차장',title:'옥천 공설시장 주차타워',address:'옥천읍 삼양로7길 9-7',local:'옥천읍',lat:'36.303383632441644',lng:'127.56824657406888'},
  {locNo:13786,ctgryNm:'공영주차장',title:'보건소 앞 공영주차장',address:'옥천읍 삼양리 161-108',local:'옥천읍',lat:'36.3041175869804',lng:'127.57024482724071'},
  {locNo:13790,ctgryNm:'공영주차장',title:'시외버스터미널 공영주차장',address:'옥천읍 삼양리 43-1 일원',local:'옥천읍',lat:'36.307617826500035',lng:'127.5637679530945'},
  {locNo:13791,ctgryNm:'공영주차장',title:'청산공영주차장',address:'청산면 교평리 260-4',local:'청산면',lat:'36.344266377197464',lng:'127.79547921394693'},
  {locNo:14640,ctgryNm:'주유소',title:'옥천사랑주유소',address:'옥천읍 삼금로 8',local:'옥천읍',lat:'36.2993911',lng:'127.5667165'},
  {locNo:14641,ctgryNm:'주유소',title:'중도석유(주) 고속주유소',address:'옥천읍 중앙로 111',local:'옥천읍',lat:'36.3065861',lng:'127.5725338'},
  {locNo:14669,ctgryNm:'주유소',title:'안남주유소',address:'안남면 안남로 498',local:'안남면',lat:'36.3568497',lng:'127.6759043'},
  {locNo:14630,ctgryNm:'전기차충전소',title:'안남면 전기차충전소',address:'안남면 연주길 46 안남면행정복지센터',local:'안남면',lat:'36.3563096',lng:'127.6728313'},
  {locNo:14635,ctgryNm:'전기차충전소',title:'옥천읍 전기차충전소',address:'옥천읍 동부로 15',local:'옥천읍',lat:'36.3071437',lng:'127.5747355'},
  {locNo:14636,ctgryNm:'전기차충전소',title:'옥천군청 전기차충전소',address:'옥천읍 중앙로 99',local:'옥천읍',lat:'36.3064919',lng:'127.5713985'},
];
export const OKCHEON_PHASE2_ESSENTIAL_SERVICES = parseOkcheonSmartMapRows(ROWS);
