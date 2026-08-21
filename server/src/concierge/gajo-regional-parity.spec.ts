import { PlaceDiscoveryService } from './place-discovery.service';
import { routeNaturalLanguageIntent } from './intent-routing';
import { GAJO_MASTER_DATA, REGIONAL_CANDIDATE_DATASETS } from '../regions/regional-candidate.registry';

const regional={effectiveDataset:jest.fn(async(regionId:string)=>REGIONAL_CANDIDATE_DATASETS[regionId])};
const anchor=(record:any,sourceTurnId:string)=>({entityId:record.entityUri,regionId:'gajo',label:record.canonicalLabelKo,entityType:record.entityType,category:record.category,latitude:record.latitude,longitude:record.longitude,source:'RDM' as const,sourceTurnId,role:'RESULT' as const});
const byLabel=(label:string)=>GAJO_MASTER_DATA.find(x=>x.canonicalLabelKo===label)!;

describe('Gajo shared regional concierge parity',()=>{
  const service=new PlaceDiscoveryService(regional as any);

  it('registers Gajo in the shared RDM-first dataset without Hapcheon entities',()=>{
    expect(REGIONAL_CANDIDATE_DATASETS.gajo.records).toHaveLength(4);
    expect(REGIONAL_CANDIDATE_DATASETS.gajo.records.every(x=>x.entityUri.startsWith('https://gajo-wellness.kr/ontology#'))).toBe(true);
    expect(REGIONAL_CANDIDATE_DATASETS.gajo.records.some(x=>/hapcheon|합천/i.test(`${x.entityUri} ${x.canonicalLabelKo}`))).toBe(false);
  });

  it('runs the real Gajo multi-turn discovery flow without Journey Composer',async()=>{
    const hotSpring=byLabel('백두산천지온천');
    const t1Text='백두산천지온천 근처 카페 있어?';
    expect(routeNaturalLanguageIntent({rawMessage:t1Text,inputMode:'FREE_TEXT'})).toMatchObject({intentRoute:'PLACE_DISCOVERY',category:'CAFE'});
    const t1:any=await service.discover('gajo','CAFE',t1Text,{turnId:'g1'});
    expect(t1).toMatchObject({anchorEntityId:hotSpring.entityUri,entities:[{programLabel:'다온 카페',operationalEvidence:{source:'RDM'}}]});

    const cafe=byLabel('다온 카페'),t2Text='그 주변 볼 만한 곳?';
    expect(routeNaturalLanguageIntent({rawMessage:t2Text,inputMode:'FREE_TEXT',isFollowup:true})).toMatchObject({intentRoute:'PLACE_DISCOVERY',category:'TOURISM_NATURE'});
    const t2:any=await service.discover('gajo','TOURISM_NATURE',t2Text,{turnId:'g2',conversationalAnchor:anchor(cafe,'g1')});
    expect(t2).toMatchObject({anchorEntityId:cafe.entityUri,referenceResolution:{mode:'CONVERSATIONAL_REFERENCE',sourceTurnId:'g1'},entities:[{programLabel:'거창 항노화힐링랜드'}]});

    const attraction=byLabel('거창 항노화힐링랜드'),t3Text='그 근처 밥집은?';
    expect(routeNaturalLanguageIntent({rawMessage:t3Text,inputMode:'FREE_TEXT',isFollowup:true})).toMatchObject({intentRoute:'PLACE_DISCOVERY',category:'FOOD'});
    const t3:any=await service.discover('gajo','FOOD',t3Text,{turnId:'g3',conversationalAnchor:anchor(attraction,'g2')});
    expect(t3).toMatchObject({anchorEntityId:attraction.entityUri,entities:[{programLabel:'미가추어탕'}]});

    const food=byLabel('미가추어탕'),distanceRoute=routeNaturalLanguageIntent({rawMessage:'거긴 멀어?',inputMode:'FREE_TEXT',isFollowup:true,discoveryCategoryHint:'FOOD'});
    expect(distanceRoute.intentRoute).toBe('DISTANCE_INFO');
    const distance=await service.distanceInfo('gajo',{discoveryContext:{regionId:'gajo',anchor:{entityId:attraction.entityUri,label:attraction.canonicalLabelKo},currentResult:{entityId:food.entityUri,label:food.canonicalLabelKo},shownEntityIds:[food.entityUri],sourceTurnId:'g3'}});
    expect(distance).toMatchObject({status:'NEEDS_CLARIFICATION'});

    const alternative:any=await service.discover('gajo','FOOD','다른 데는?',{turnId:'g5',discoveryAlternative:true,discoveryContext:{regionId:'gajo',anchor:{entityId:attraction.entityUri,label:attraction.canonicalLabelKo},currentResult:{entityId:food.entityUri,label:food.canonicalLabelKo},shownEntityIds:[food.entityUri],sourceTurnId:'g3'}});
    expect(alternative.anchorEntityId).toBe(attraction.entityUri);
    expect(alternative.entities).toEqual([]);
  });

  it('calculates Gajo runtime distance when both canonical coordinates are verified',async()=>{
    const from=byLabel('백두산천지온천'),to=byLabel('거창 항노화힐링랜드');
    const result:any=await service.distanceInfo('gajo',{discoveryContext:{regionId:'gajo',anchor:{entityId:from.entityUri,label:from.canonicalLabelKo},currentResult:{entityId:to.entityUri,label:to.canonicalLabelKo},shownEntityIds:[to.entityUri],sourceTurnId:'distance'}});
    expect(result).toMatchObject({status:'RESOLVED',regionId:'gajo',fromEntityId:from.entityUri,toEntityId:to.entityUri,calculation:'RUNTIME_HAVERSINE'});
    expect(result.distanceMeters).toBeGreaterThan(0);
  });

  it.each([
    ['근처 편의점 있어?','CONVENIENCE_STORE'],['장 볼 데 있어?','ESSENTIAL_SHOPPING'],['물하고 과자 살 데 있어?','ESSENTIAL_SHOPPING'],['마트는?','MART_SUPERMARKET'],
  ])('uses the shared shopping taxonomy for %s', (rawMessage,category)=>expect(routeNaturalLanguageIntent({rawMessage,inputMode:'FREE_TEXT',isFollowup:rawMessage==='마트는?'})).toMatchObject({intentRoute:'PLACE_DISCOVERY',category}));
});
