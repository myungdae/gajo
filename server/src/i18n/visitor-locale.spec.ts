import { localizeVisitorPayload, normalizeVisitorLocale } from './visitor-locale';
import { visitorPlaceName, validVisitorContent } from './place-content';
import { ConciergeController } from '../concierge/concierge.controller';
import { NearbyController } from '../nearby/nearby.controller';
import { ReplanningController } from '../replanning/replanning.controller';
import { RecommendationController } from '../recommendation/recommendation.controller';

describe('visitor locale contract', () => {
  it('accepts only ko and en and safely defaults to ko', () => {
    expect(normalizeVisitorLocale('en')).toBe('en');
    expect(normalizeVisitorLocale('ko')).toBe('ko');
    expect(normalizeVisitorLocale('fr')).toBe('ko');
    expect(normalizeVisitorLocale(undefined)).toBe('ko');
  });

  it('localizes presentation templates without changing facts or proper nouns', () => {
    const result = localizeVisitorPayload({
      visitorMessage: '현재 위치를 기준으로 실제 주변 장소를 가까운 순서로 확인했습니다. 영업 여부는 방문 전에 확인해 주세요.',
      name: '합천운석충돌구',
      address: '경상남도 합천군 초계면',
      distanceMeters: 1200,
      operatingState: 'UNKNOWN',
    }, 'en');
    expect(result.visitorMessage).toMatch(/^These places/);
    expect(result).toMatchObject({ name: '합천운석충돌구', address: '경상남도 합천군 초계면', distanceMeters: 1200, operatingState: 'UNKNOWN' });
  });

  it('keeps Korean output as the backward-compatible default', () => {
    const message = '여행을 계속할까요?';
    expect(localizeVisitorPayload({ message }, normalizeVisitorLocale(undefined))).toEqual({ message });
  });

  it('keeps Korean input separate from English UI presentation at the controller boundary', async () => {
    const chat = jest.fn().mockResolvedValue({visitorMessage:'여행을 계속할까요?',rawMessage:'합천 카페'});
    const result = await new ConciergeController({chat} as any).chat({locale:'en',rawMessage:'합천 카페'});
    expect(chat).toHaveBeenCalledWith({locale:'en',rawMessage:'합천 카페'});
    expect(result.visitorMessage).toBe('Would you like to continue your trip?');
    expect(result.rawMessage).toBe('합천 카페');
  });

  it('localizes Nearby payloads while preserving ordering, distance and regional ownership', async () => {
    const rows = [120,450].map((distanceMeters,index)=>({id:`p${index}`,name:'합천 상호',distanceMeters,regionId:'hapcheon',operatingMessage:'현재 운영 여부 확인 필요'}));
    const searchProgressively = jest.fn().mockResolvedValue({results:rows,radius:1000,initialRadius:1000,coverageStatus:'COMPLETE'});
    const controller = new NearbyController({searchProgressively} as any);
    const response = await controller.discovery({locale:'en',category:'FOOD',latitude:35.5,longitude:128.1,regionId:'hapcheon'});
    expect(response.results.map(row=>row.distanceMeters)).toEqual([120,450]);
    expect(response.results[0]).toMatchObject({id:'p0',name:'합천 상호',regionId:'hapcheon',operatingMessage:'Check current opening hours before visiting.'});
    const legacy = await controller.discovery({locale:'invalid' as any,category:'FOOD',latitude:35.5,longitude:128.1,regionId:'hapcheon'});
    expect(legacy.results[0].operatingMessage).toBe('현재 운영 여부 확인 필요');
  });

  it('uses official English names before reviewed names and never invents a romanization', () => {
    expect(visitorPlaceName('한글 상호',{officialEnglishName:'Official Name',reviewedEnglishName:'Reviewed Name'})).toBe('Official Name');
    expect(visitorPlaceName('한글 상호',{reviewedEnglishName:'Reviewed Name'})).toBe('Reviewed Name');
    expect(visitorPlaceName('한글 상호')).toBe('한글 상호');
    expect(validVisitorContent({en:{signatureMenu:'Noodles',parking:'On-site parking'}})).toBe(true);
    expect(validVisitorContent({en:{signatureMenu:42}})).toBe(false);
    expect(validVisitorContent({fr:{description:'text'}})).toBe(false);
    expect(validVisitorContent({ko:{signatureMenu:'국수'},en:{signatureMenu:'Noodles'}})).toBe(true);
  });

  it('renders existing replan proposals in English without mutating history or persisted copy', () => {
    const proposal = {explanation:'현재 상황이 변경되었습니다.',triggerEvent:{eventType:'FACILITY_UNAVAILABLE'},removedItems:[{programLabel:'원래 장소',entityId:'same-id'}],proposedNewItems:[{programLabel:'대안 장소'}],preservedHistory:[{status:'COMPLETED',label:'방문 장소'}]};
    const result = localizeVisitorPayload(proposal,'en');
    expect(result.explanation).toBe('A planned facility is currently unavailable. Affected stops: 원래 장소. Suggested alternatives: 대안 장소. Would you like to update your itinerary?');
    expect(result.preservedHistory).toEqual(proposal.preservedHistory);
    expect(result.removedItems[0].entityId).toBe('same-id');
    expect(proposal.explanation).toBe('현재 상황이 변경되었습니다.');
    expect(localizeVisitorPayload(proposal,'ko')).toBe(proposal);
  });

  it('renders generated recommendation and distance reasons with reviewed templates', () => {
    const ko = '현재 위치에서 약 120m로 가까움, 짧은 보행 거리 근거를 고려해 한글 상호을(를) 우선 추천합니다.';
    expect(localizeVisitorPayload(ko,'en')).toBe('We recommend 한글 상호 first. Reasons: Nearby: about 120m from your current location, Short walking distance.');
    expect(localizeVisitorPayload('현재 위치 기준 120m','en')).toBe('120 m from your current location');
    const value = {entityId:'same',programLabel:'한국어 상호',visitorContent:{officialEnglishName:'Official Place',en:{description:'Reviewed description'}}};
    expect(localizeVisitorPayload(value,'en')).toMatchObject({entityId:'same',programLabel:'Official Place',description:'Reviewed description'});
    expect(localizeVisitorPayload(value,'ko')).toBe(value);
  });

  it('honors locale for saved recommendations and runtime replan responses', async () => {
    const response = {message:'여행을 계속할까요?',regionId:'hapcheon'};
    const service = {getRecommendation:jest.fn().mockResolvedValue(response),getItinerary:jest.fn().mockResolvedValue(response)};
    const controller = new RecommendationController(service as any,{} as any);
    expect(await controller.get('rec-1','en')).toEqual({message:'Would you like to continue your trip?',regionId:'hapcheon'});
    expect(await controller.getItinerary('trip-1','invalid')).toEqual(response);
    const replanning = {observeRuntime:jest.fn().mockResolvedValue(response),approve:jest.fn().mockResolvedValue(response),reject:jest.fn().mockResolvedValue(response)};
    const replan = new ReplanningController(replanning as any);
    const previousContext={regionId:'hapcheon'},currentContext={regionId:'hapcheon'},itinerary={regionId:'hapcheon',steps:[]};
    expect((await replan.observe({previousContext,currentContext,itinerary,locale:'en'})).message).toBe('Would you like to continue your trip?');
    expect(replanning.observeRuntime).toHaveBeenCalledWith(previousContext,currentContext,itinerary);
    expect((await replan.approve('proposal-1','en')).message).toBe('Would you like to continue your trip?');
    expect(await replan.reject('proposal-1','invalid')).toEqual(response);
  });
});
