import { diagnoseHeatShelterCoverage } from './public-safety-coverage';
const anchor=(regionId:string,name='수승대',latitude=35.7,longitude=127.9)=>({regionId,entityUri:`${regionId}:anchor`,canonicalLabelKo:name,entityType:'ATTRACTION',category:'TOURISM_NATURE',latitude,longitude});
const shelter=(regionId:string,longitude=127.905,sourceType='MUNICIPAL_OFFICIAL')=>({regionId,entityUri:`${regionId}:shelter`,canonicalLabelKo:'공식 무더위쉼터',entityType:'HEAT_SHELTER',category:'HEAT_SHELTER',runtimeDataStatus:'PARTIAL',latitude:35.7,longitude,source:{sourceType},coordinateSource:{sourceType}});
const core=[{displayName:'수승대',canonicalEntityId:'gajo:anchor'}];
describe('read-only heat-shelter coverage diagnosis',()=>{
 it('returns sufficient or a review-only gap candidate from official points and configured thresholds',()=>{expect(diagnoseHeatShelterCoverage('gajo',[anchor('gajo'),shelter('gajo')],core,2000)).toMatchObject({status:'COVERAGE_SUFFICIENT',officialShelterCount:1,readOnly:true});const gap=diagnoseHeatShelterCoverage('gajo',[anchor('gajo'),shelter('gajo',128.1)],core,2000);expect(gap).toMatchObject({status:'COVERAGE_GAP_CANDIDATE',policyBoundary:expect.stringMatching(/검토 신호.*설치 결론이 아닙니다/)})});
 it('fails closed without official shelter evidence or anchor coordinates',()=>{expect(diagnoseHeatShelterCoverage('gajo',[anchor('gajo'),shelter('gajo',127.905,'SEARCH_EVIDENCE')],core)).toMatchObject({status:'DATA_INSUFFICIENT',officialShelterCount:0});expect(diagnoseHeatShelterCoverage('gajo',[],core)).toMatchObject({status:'DATA_INSUFFICIENT'})});
 it('keeps records and anchors region isolated',()=>expect(diagnoseHeatShelterCoverage('gajo',[anchor('gajo'),shelter('hapcheon')],core)).toMatchObject({regionId:'gajo',status:'DATA_INSUFFICIENT',officialShelterCount:0}));
});
