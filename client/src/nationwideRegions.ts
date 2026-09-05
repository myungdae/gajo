import { verifiedExkoSubregionResource } from './exkoRegionalResources.ts';

export type RegionServiceStatus = 'AI_LIVE' | 'FIELD_TEST' | 'EXKO_ONLY' | 'COMING_SOON' | 'UNAVAILABLE';

export type NationwideRegion = {
  id: string;
  name: string;
  shortName?: string;
  aliases?: readonly string[];
  parentId?: string;
  displayName?: string;
  type: 'METROPOLITAN' | 'CITY' | 'COUNTY' | 'DISTRICT';
  status: RegionServiceStatus;
  aiUrl?: string;
  aiRegionId?: string;
  exkoRegionId?: 'hapcheon' | 'geochang' | 'okcheon';
  exkoResourceLabel?: string;
  exkoResourceHref?: string;
  exkoResourceRelation?: 'CURRENT' | 'HISTORICAL_STABLE';
};

type ProvinceDefinition = Omit<NationwideRegion, 'status'> & { children: readonly string[] };

const unavailable = (parent: ProvinceDefinition, name: string): NationwideRegion => {
  const exko=verifiedExkoSubregionResource(parent.id,name);
  return ({
  id: `${parent.id}-${name.replace(/[·\s]/g, '').toLowerCase()}`,
  parentId:parent.id,
  name,
  displayName:`${name} · ${parent.id==='gwangju-jeonnam' ? parent.shortName : parent.name}`,
  type: name.endsWith('군') ? 'COUNTY' : name.endsWith('구') ? 'DISTRICT' : 'CITY',
  status: exko?'EXKO_ONLY':'UNAVAILABLE',
  exkoResourceLabel:exko?.label,
  exkoResourceHref:exko?.href,
  exkoResourceRelation:exko?.relation,
});};

const provinces: readonly ProvinceDefinition[] = [
  { id:'seoul', name:'서울특별시', shortName:'서울', type:'METROPOLITAN', children:['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'] },
  { id:'busan', name:'부산광역시', shortName:'부산', type:'METROPOLITAN', children:['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'] },
  { id:'daegu', name:'대구광역시', shortName:'대구', type:'METROPOLITAN', children:['중구','동구','서구','남구','북구','수성구','달서구','달성군','군위군'] },
  { id:'incheon', name:'인천광역시', shortName:'인천', type:'METROPOLITAN', children:['제물포구','영종구','미추홀구','연수구','남동구','부평구','계양구','서해구','검단구','강화군','옹진군'] },
  { id:'daejeon', name:'대전광역시', shortName:'대전', type:'METROPOLITAN', children:['동구','중구','서구','유성구','대덕구'] },
  { id:'ulsan', name:'울산광역시', shortName:'울산', type:'METROPOLITAN', children:['중구','남구','동구','북구','울주군'] },
  { id:'sejong', name:'세종특별자치시', shortName:'세종', type:'METROPOLITAN', children:[] },
  { id:'gyeonggi', name:'경기도', shortName:'경기', type:'METROPOLITAN', children:['수원시','성남시','의정부시','안양시','부천시','광명시','평택시','동두천시','안산시','고양시','과천시','구리시','남양주시','오산시','시흥시','군포시','의왕시','하남시','용인시','파주시','이천시','안성시','김포시','화성시','광주시','양주시','포천시','여주시','연천군','가평군','양평군'] },
  { id:'gangwon', name:'강원특별자치도', shortName:'강원', type:'METROPOLITAN', children:['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군','평창군','정선군','철원군','화천군','양구군','인제군','고성군','양양군'] },
  { id:'chungbuk', name:'충청북도', shortName:'충북', type:'METROPOLITAN', children:['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'] },
  { id:'chungnam', name:'충청남도', shortName:'충남', type:'METROPOLITAN', children:['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군'] },
  { id:'jeonbuk', name:'전북특별자치도', shortName:'전북', type:'METROPOLITAN', children:['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'] },
  { id:'gwangju-jeonnam', name:'전남광주통합특별시', shortName:'광주특별시', aliases:['광주광역시','전라남도','전남','광주'], type:'METROPOLITAN', children:['동구','서구','남구','북구','광산구','목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군','화순군','장흥군','강진군','해남군','영암군','무안군','함평군','영광군','장성군','완도군','진도군','신안군'] },
  { id:'gyeongbuk', name:'경상북도', shortName:'경북', type:'METROPOLITAN', children:['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시','의성군','청송군','영양군','영덕군','청도군','고령군','성주군','칠곡군','예천군','봉화군','울진군','울릉군'] },
  { id:'gyeongnam', name:'경상남도', shortName:'경남', type:'METROPOLITAN', children:['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군','창녕군','고성군','남해군','하동군','산청군','함양군','거창군','합천군'] },
  { id:'jeju', name:'제주특별자치도', shortName:'제주', type:'METROPOLITAN', children:['제주시','서귀포시'] },
] as const;

const serviceOverrides: Readonly<Record<string, Partial<NationwideRegion>>> = {
  'gyeongnam-합천군': { id:'hapcheon', status:'AI_LIVE', aiUrl:'/hapcheon', aiRegionId:'hapcheon', exkoRegionId:'hapcheon' },
  'gyeongnam-거창군': { id:'geochang', status:'FIELD_TEST', aiUrl:'/gajo', aiRegionId:'gajo', exkoRegionId:'geochang', aliases:['가조'] },
  'chungbuk-옥천군': { id:'okcheon', status:'FIELD_TEST', aiUrl:'/okcheon', aiRegionId:'okcheon', exkoRegionId:'okcheon' },
  'chungnam-계룡시': { id:'gyeryong', status:'FIELD_TEST', aiUrl:'/gyeryong', aiRegionId:'gyeryong' },
};

export const NATIONWIDE_REGIONS: readonly NationwideRegion[] = provinces.flatMap((province) => [
  { ...province, children: undefined, status:'UNAVAILABLE' } as NationwideRegion,
  ...province.children.map((name) => {
    const base = unavailable(province, name);
    return { ...base, ...serviceOverrides[`${province.id}-${name}`] };
  }),
]);

export const TOP_LEVEL_REGIONS = NATIONWIDE_REGIONS.filter((region) => !region.parentId);
export const CHILD_REGIONS = NATIONWIDE_REGIONS.filter((region) => region.parentId);

export function regionsForParent(parentId: string): readonly NationwideRegion[] {
  return CHILD_REGIONS.filter((region) => region.parentId === parentId);
}

export function findNationwideRegion(regionId: string | undefined): NationwideRegion | undefined {
  return regionId ? NATIONWIDE_REGIONS.find((region) => region.id === regionId) : undefined;
}

export function searchNationwideRegions(query: string): readonly NationwideRegion[] {
  const normalized = query.trim().toLocaleLowerCase('ko-KR');
  if (!normalized) return [];
  return NATIONWIDE_REGIONS.filter((region) => [region.name, region.shortName, ...(region.aliases ?? [])]
    .filter(Boolean).some((value) => value!.toLocaleLowerCase('ko-KR').includes(normalized)));
}

export const REGION_STATUS_LABELS: Readonly<Record<RegionServiceStatus, string>> = {
  AI_LIVE:'운영 중', FIELD_TEST:'현장 시험 중', EXKO_ONLY:'지역지식 제공', COMING_SOON:'준비 중', UNAVAILABLE:'아직 제공되지 않음',
};
