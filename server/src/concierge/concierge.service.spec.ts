import { ConciergeService, detectOutOfServiceDestination, isGuideExplanationQuestion } from './concierge.service';
import{GAJO_REGION_CONFIG}from'../region/region-config.service';
import { GuideService } from '../guide/guide.service';

describe('ConciergeService service-area handling', () => {
  it('answers approved Guide explanations without constructing or mutating travel context',async()=>{const context={createContext:jest.fn()},guide={approvedExplanation:jest.fn(()=>({status:'ANSWERED',intent:'REGIONAL_MANAGER',answer:'승인된 설명'}))},service=new ConciergeService(context as any,{}as any,{}as any,undefined,undefined,undefined,undefined,guide as any),answer:any=await service.chat({regionId:'okcheon',inputMode:'FREE_TEXT',rawMessage:'Regional Manager는 무슨 일을 하나요?'});expect(answer).toMatchObject({intentRoute:'GUIDE_EXPLANATION',recommendation:null,journeyContinuation:{preserveJourney:true}});expect(context.createContext).not.toHaveBeenCalled();expect(isGuideExplanationQuestion('지도에서 수승대 찾아줘')).toBe(false)});
  it.each(['T맵이랑 뭐가 달라?', 'TMAP에서도 현재 위치 주변의 관광지, 식당, 카페, 주유소 등을 다 찾을 수 있는데 Regional Concierge와 뭐가 그렇게 다른가요?', '그냥 ChatGPT로 일정 짜면 안 돼?', '관광 안내 말고 지역 안전에도 활용할 수 있나요?'])('answers active-trip objection %s as read-only Guide knowledge',async(rawMessage)=>{const context={createContext:jest.fn()},guideService=new GuideService(),service=new ConciergeService(context as any,{run:jest.fn()}as any,{label:jest.fn()}as any,undefined,undefined,undefined,undefined,guideService),answer:any=await service.chat({regionId:'okcheon',inputMode:'FREE_TEXT',rawMessage,mustVisitPlaces:[{entityId:'must-keep',requested:true}],explicitJourney:{multiDestination:true,requestedDestinations:[{entityId:'must-keep'}],sourceTurnId:'turn-7'}}as any);expect(answer).toMatchObject({intentRoute:'GUIDE_EXPLANATION',guideExplanation:{status:'ANSWERED',readOnly:true},recommendation:null,journeyContinuation:{preserveJourney:true}});expect(answer.intentRoute).not.toBe('PLACE_DISCOVERY');expect(context.createContext).not.toHaveBeenCalled();expect(answer.visitorMessage).toMatch(/여행을 계속할까요/)});
  it('recognizes the explicit Haeinsa destination without treating generic requests as external', () => {
    expect(detectOutOfServiceDestination('합천 해인사에 놀러 가고 싶어요.')).toEqual({ destination: '해인사', region: '합천' });
    expect(detectOutOfServiceDestination('엄마와 온천에 가고 싶어요.')).toBeUndefined();
    expect(detectOutOfServiceDestination('가조에서 해인사 이야기를 들었어요.')).toBeUndefined();
  });

  it('returns a normal visitor response and never runs Gajo recommendation for Haeinsa', async () => {
    const contextService = { createContext: jest.fn().mockResolvedValue({ context: { contextNo: 'RC-1', operationUri: 'gajo:operation', raw: { extractionDebug: { gatewayDecision: 'FALLBACK', status: 'PROVIDER_ERROR', errorCode: 'HTTP_429' } } }, evidence: [], firedRules: [] }) };
    const orchestrator = { run: jest.fn() };
    const service = new ConciergeService(contextService as any, orchestrator as any, { label: jest.fn() } as any);

    const result = await service.chat({ regionId:'gajo', inputMode: 'FREE_TEXT', rawMessage: '합천 해인사에 놀러 가고 싶어요.' });

    expect(result).toMatchObject({
      recommendation: null,
      domainResult: { status: 'OUT_OF_SERVICE_AREA', destination: '해인사', region: '합천' },
      visitorMessage: '현재는 가조 지역을 중심으로 안내하고 있어요. 가조에서 즐길 수 있는 장소를 찾아드릴까요?',
    });
    expect(orchestrator.run).not.toHaveBeenCalled();
  });
  it('returns direct discovery and does not enter the journey orchestrator',async()=>{const contextService={createContext:jest.fn().mockResolvedValue({context:{contextNo:'RC-D',operationUri:'gajo:operation',activityPreferences:['CAFE']},evidence:[],firedRules:[]})},orchestrator={run:jest.fn()},discovery={discover:jest.fn().mockResolvedValue({regionId:'hapcheon',category:'CAFE',entities:[{entityId:'lowful'}]})};const service=new ConciergeService(contextService as any,orchestrator as any,{label:jest.fn()}as any,{get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()}as any,discovery as any);const result:any=await service.chat({regionId:'hapcheon',inputMode:'FREE_TEXT',rawMessage:'합천호 주변 전망 좋은 카페 알려줘'});expect(result).toMatchObject({intentRoute:'PLACE_DISCOVERY',recommendation:null,discovery:{category:'CAFE'}});expect(discovery.discover).toHaveBeenCalled();expect(orchestrator.run).not.toHaveBeenCalled()});
  it('invokes Journey Composer with the ambiguous Gajo concept and never category discovery',async()=>{const requested=[{entityId:'https://gajo-wellness.kr/semantic#gajoHotSpringArea',label:'가조온천',requestedLabel:'가조온천',resolved:false,requested:true,source:'SEMANTIC',entityType:'PLACE_CONCEPT'},{entityId:'https://gajo-wellness.kr/ontology#suseungdae',label:'수승대',requestedLabel:'수승대',resolved:false,requested:true,source:'SEMANTIC'}],contextService={createContext:jest.fn(async(input:any)=>({context:{contextNo:'RC-M',operationUri:'gajo:operation',regionId:'gajo',mustVisitPlaces:input.mustVisitPlaces},evidence:[],firedRules:[]}))},orchestrator={run:jest.fn(async(_id:string,_op:string,context:any)=>({tasks:[],executionLog:[],recommendation:{itinerary:{steps:context.mustVisitPlaces.map((x:any)=>({entityId:x.entityId,programLabel:x.label,requestedLabel:x.requestedLabel,actions:{}}))}}}))},discovery={resolveRequestedDestinations:jest.fn(async()=>requested),resolveReference:jest.fn(),discover:jest.fn()};const service=new ConciergeService(contextService as any,orchestrator as any,{label:jest.fn()}as any,{get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()}as any,discovery as any);const result:any=await service.chat({regionId:'gajo',inputMode:'FREE_TEXT',rawMessage:'가조온천하고 수승대 가고 싶어요.'});expect(result).toMatchObject({intentRoute:'JOURNEY_PLAN',requestedDestinations:requested,visitorMessage:expect.stringContaining('가조온천과 수승대'),recommendation:{itinerary:{steps:[{programLabel:'가조온천',requestedLabel:'가조온천',actions:{}},{programLabel:'수승대',actions:{}}]}}});expect(contextService.createContext).toHaveBeenCalledWith(expect.objectContaining({mustVisitPlaces:requested}));expect(orchestrator.run).toHaveBeenCalled();expect(discovery.discover).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toMatch(/온천먹거리|다온 카페|항노화힐링랜드/)});

  it('keeps the exact structured journey for 어디부터 갈까 follow-up even without context reconstruction',async()=>{const requested=[{entityId:'https://gajo-wellness.kr/semantic#gajoHotSpringArea',label:'가조온천',requestedLabel:'가조온천',resolved:false,requested:true,source:'SEMANTIC'},{entityId:'https://gajo-wellness.kr/ontology#suseungdae',label:'수승대',requestedLabel:'수승대',resolved:false,requested:true,source:'SEMANTIC'}],contextService={createContext:jest.fn(async(input:any)=>({context:{contextNo:'RC-F',operationUri:'gajo:operation',regionId:'gajo',mustVisitPlaces:input.mustVisitPlaces},evidence:[],firedRules:[]}))},orchestrator={run:jest.fn(async(_id:string,_op:string,context:any)=>({tasks:[],executionLog:[],recommendation:{itinerary:{steps:context.mustVisitPlaces.map((x:any)=>({programLabel:x.label,requestedLabel:x.requestedLabel,actions:{}}))}}}))},discovery={resolveReference:jest.fn(),discover:jest.fn()};const service=new ConciergeService(contextService as any,orchestrator as any,{label:jest.fn()}as any,{get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()}as any,discovery as any);const result:any=await service.chat({regionId:'gajo',inputMode:'FREE_TEXT',rawMessage:'어디부터 갈까?',isFollowup:true,explicitJourney:{requestedDestinations:requested as any,multiDestination:true,sourceTurnId:'turn-1'}});expect(contextService.createContext).toHaveBeenCalledWith(expect.objectContaining({mustVisitPlaces:requested}));expect(result).toMatchObject({intentRoute:'REPLAN',requestedDestinations:requested,recommendation:{itinerary:{steps:[{programLabel:'가조온천'},{programLabel:'수승대'}]}}});expect(result.visitorMessage).toContain('거리순 계산은 어렵습니다');expect(JSON.stringify(result)).not.toMatch(/다온 카페|항노화힐링랜드|백두산천지온천|관광과 체험을 둘러본 뒤/)});
  it('routes a registered exact place through the common canonical resolver',async()=>{const contextService={createContext:jest.fn(async()=>({context:{contextNo:'RC-EXACT',operationUri:'gajo:operation'},evidence:[],firedRules:[]}))},orchestrator={run:jest.fn()},discovery={resolveExactPlaceIntent:jest.fn(async()=>({category:'TOURISM_NATURE',entityId:'urn:fixture:canonical-place',label:'등록 장소'})),resolveReference:jest.fn(),discover:jest.fn(async()=>({regionId:'gajo',category:'TOURISM_NATURE',entities:[{entityId:'urn:fixture:canonical-place'}]}))},service=new ConciergeService(contextService as any,orchestrator as any,{label:jest.fn()}as any,{get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()}as any,discovery as any),result:any=await service.chat({regionId:'gajo',inputMode:'FREE_TEXT',rawMessage:'등록 장소 찾아줘'});expect(result).toMatchObject({intentRoute:'PLACE_DISCOVERY',discovery:{entities:[{entityId:'urn:fixture:canonical-place'}]}});expect(discovery.resolveExactPlaceIntent).toHaveBeenCalledWith('gajo','등록 장소 찾아줘');expect(discovery.discover).toHaveBeenCalledWith('gajo','TOURISM_NATURE','등록 장소 찾아줘',expect.anything());expect(orchestrator.run).not.toHaveBeenCalled()});

  it('uses OpenAI semantic subject before canonical grounding',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-SEM',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };
    const orchestrator={run:jest.fn()};
    const discovery={
      resolveExactPlaceIntent:jest.fn(async(_region:string,text:string)=>
        text==='황매산'
          ? {category:'TOURISM_NATURE',entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',label:'황매산 군립공원'}
          : undefined
      ),
      resolveReference:jest.fn(),
      discover:jest.fn(async()=>({
        regionId:'hapcheon',
        category:'TOURISM_NATURE',
        entities:[{
          entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',
          programLabel:'황매산 군립공원'
        }]
      }))
    };
    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'NAVIGATION',
          subjectText:'황매산',
          referenceType:'EXPLICIT_ENTITY',
          relationToPrevious:'REPLACE',
          requestedAction:'NAVIGATE',
          categoryHint:'TOURISM',
          confidence:.99
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,
      undefined,
      undefined,
      undefined,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'황매산 어떻게 가죠',
      conversationalAnchor:{
        entityId:'https://hapcheon.example/ontology#haeinsa',
        regionId:'hapcheon',
        label:'해인사'
      }
    } as any);

    expect(semanticInterpreter.interpret)
      .toHaveBeenCalledWith('황매산 어떻게 가죠','해인사','hapcheon',undefined);

    expect(discovery.resolveExactPlaceIntent)
      .toHaveBeenCalledWith('hapcheon','황매산');

    expect(result).toMatchObject({
      intentRoute:'PLACE_DISCOVERY',
      discovery:{
        entities:[{
          entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark'
        }]
      }
    });

    expect(orchestrator.run).not.toHaveBeenCalled();
  });

  it('falls back to deterministic routing when OpenAI semantic interpretation times out',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-FALLBACK',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };

    const orchestrator={run:jest.fn()};

    const discovery={
      resolveExactPlaceIntent:jest.fn(async(_region:string,text:string)=>
        text==='등록 장소 찾아줘'
          ? {category:'TOURISM_NATURE',entityId:'urn:fallback:place',label:'등록 장소'}
          : undefined
      ),
      resolveReference:jest.fn(),
      discover:jest.fn(async()=>({
        regionId:'hapcheon',
        category:'TOURISM_NATURE',
        entities:[{entityId:'urn:fallback:place',programLabel:'등록 장소'}]
      }))
    };

    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'TIMEOUT',
        provider:'openai',
        latencyMs:8000,
        errorCode:'AbortError'
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,
      undefined,
      undefined,
      undefined,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'등록 장소 찾아줘'
    });

    expect(discovery.resolveExactPlaceIntent)
      .toHaveBeenCalledWith('hapcheon','등록 장소 찾아줘');

    expect(result).toMatchObject({
      intentRoute:'PLACE_DISCOVERY',
      discovery:{entities:[{entityId:'urn:fallback:place'}]}
    });
  });

  it('keeps the grounded previous subject for a semantic continuation',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-CONT',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };
    const orchestrator={
      run:jest.fn(async()=>({
        tasks:[],
        executionLog:[],
        recommendation:null
      }))
    };
    const discovery={
      resolveExactPlaceIntent:jest.fn(async()=>undefined),
      resolveReference:jest.fn(),
      discover:jest.fn(async()=>({
        regionId:'hapcheon',
        category:'TOURISM_NATURE',
        entities:[]
      }))
    };
    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'NAVIGATION',
          subjectText:'거기',
          referenceType:'PREVIOUS_SUBJECT',
          relationToPrevious:'CONTINUE',
          requestedAction:'차로 올라갈 수 있는지 확인',
          categoryHint:null,
          confidence:.98
        }
      }))
    };

    const anchor={
      entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',
      regionId:'hapcheon',
      label:'황매산 군립공원'
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,undefined,undefined,undefined,
      semanticInterpreter as any
    );

    await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'거기 차로 올라갈 수 있어?',
      conversationalAnchor:anchor
    } as any);

    expect(semanticInterpreter.interpret)
      .toHaveBeenCalledWith('거기 차로 올라갈 수 있어?','황매산 군립공원','hapcheon',undefined);

    expect(discovery.resolveExactPlaceIntent)
      .toHaveBeenCalledWith('hapcheon','황매산 군립공원');
  });

  it('replaces the previous grounded subject with a new explicit semantic subject',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-REPLACE',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };
    const orchestrator={run:jest.fn()};
    const discovery={
      resolveExactPlaceIntent:jest.fn(async(_region:string,text:string)=>
        text==='황매산'
          ? {category:'TOURISM_NATURE',entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',label:'황매산 군립공원'}
          : undefined
      ),
      resolveReference:jest.fn(),
      discover:jest.fn(async()=>({
        regionId:'hapcheon',
        category:'TOURISM_NATURE',
        entities:[{entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark'}]
      }))
    };
    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'REPLAN',
          subjectText:'황매산',
          referenceType:'EXPLICIT_ENTITY',
          relationToPrevious:'REPLACE',
          requestedAction:'방문 대상 변경',
          categoryHint:null,
          confidence:.98
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,undefined,undefined,undefined,
      semanticInterpreter as any
    );

    await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'해인사 말고 황매산 쪽이 낫겠어',
      conversationalAnchor:{
        entityId:'https://hapcheon.example/ontology#haeinsa',
        regionId:'hapcheon',
        label:'해인사'
      }
    } as any);

    expect(discovery.resolveExactPlaceIntent)
      .toHaveBeenCalledWith('hapcheon','황매산');
  });

  it('uses the grounded previous subject for semantic food discovery',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-SEM-FOOD',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };
    const orchestrator={run:jest.fn()};

    const anchor={
      entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',
      regionId:'hapcheon',
      label:'황매산 군립공원',
      entityType:'ATTRACTION',
      category:'TOURISM_NATURE',
      sourceTurnId:'turn-hwangmaesan',
      role:'RESULT'
    };

    const discovery={
      resolveExactPlaceIntent:jest.fn(async()=>undefined),
      resolveReference:jest.fn(async()=>undefined),
      discover:jest.fn(async()=>({
        regionId:'hapcheon',
        category:'FOOD',
        anchorEntityId:anchor.entityId,
        entities:[{
          entityId:'urn:fixture:restaurant',
          programLabel:'검증 식당',
          category:'FOOD'
        }]
      }))
    };

    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'PLACE_DISCOVERY',
          subjectText:'거기',
          referenceType:'PREVIOUS_SUBJECT',
          relationToPrevious:'CONTINUE',
          requestedAction:'식사할 만한 곳 찾기',
          categoryHint:'음식점',
          confidence:.98
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,undefined,undefined,undefined,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'거기서 밥 먹을 만한 데 있어?',
      conversationalAnchor:anchor
    } as any);

    expect(discovery.discover).toHaveBeenCalledWith(
      'hapcheon',
      'FOOD',
      '거기서 밥 먹을 만한 데 있어?',
      expect.objectContaining({
        conversationalAnchor:anchor
      })
    );

    expect(result).toMatchObject({
      intentRoute:'PLACE_DISCOVERY',
      discovery:{
        category:'FOOD',
        anchorEntityId:anchor.entityId
      }
    });

    expect(orchestrator.run).not.toHaveBeenCalled();
  });

  it('requires current location for an unanchored semantic immediate food need',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-IMMEDIATE-FOOD',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };

    const orchestrator={run:jest.fn()};

    const discovery={
      resolveExactPlaceIntent:jest.fn(async()=>undefined),
      resolveReference:jest.fn(async()=>undefined),
      discover:jest.fn()
    };

    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'IMMEDIATE_NEED',
          subjectText:null,
          referenceType:'NONE',
          relationToPrevious:'NONE',
          requestedAction:'지금 식사할 곳 찾기',
          categoryHint:'음식점',
          confidence:.99
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,undefined,undefined,undefined,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'배고파요'
    } as any);

    expect(result).toMatchObject({
      intentRoute:'PLACE_DISCOVERY',
      nearbyLocationRequired:true,
      nearbyCategory:'FOOD'
    });

    expect(discovery.discover).not.toHaveBeenCalled();
    expect(orchestrator.run).not.toHaveBeenCalled();
  });

  it('uses actual current coordinates for an unanchored semantic immediate food need',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-IMMEDIATE-FOOD-GPS',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };

    const orchestrator={run:jest.fn()};

    const discovery={
      resolveExactPlaceIntent:jest.fn(async()=>undefined),
      resolveReference:jest.fn(async()=>undefined),
      discover:jest.fn()
    };

    const nearby={
      search:jest.fn(async()=>[
        {
          id:'food-1',
          provider:'KAKAO',
          providerPlaceId:'food-1',
          name:'현재위치 식당',
          category:'FOOD',
          lat:35.566,
          lng:128.165,
          distanceMeters:320
        }
      ])
    };

    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'IMMEDIATE_NEED',
          subjectText:null,
          referenceType:'NONE',
          relationToPrevious:'NONE',
          requestedAction:'지금 식사할 곳 찾기',
          categoryHint:'음식점',
          confidence:.99
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,
      undefined,
      undefined,
      nearby as any,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'배고파요',
      locationStatus:'AVAILABLE',
      latitude:35.565,
      longitude:128.164,
      locationAccuracy:25
    } as any);

    expect(nearby.search).toHaveBeenCalledWith(
      'FOOD',
      35.565,
      128.164,
      1000,
      expect.objectContaining({useDistance:true}),
      expect.anything()
    );

    expect(result).toMatchObject({
      intentRoute:'PLACE_DISCOVERY',
      nearbyDiscoveryIntent:true,
      nearbyCategory:'FOOD',
      discovery:{
        category:'FOOD',
        relation:'NEARBY',
        entities:[
          expect.objectContaining({
            programLabel:'현재위치 식당',
            distanceMeters:320
          })
        ]
      }
    });

    expect(discovery.discover).not.toHaveBeenCalled();
    expect(orchestrator.run).not.toHaveBeenCalled();
  });
  it('keeps grounded previous subject for semantic entity information and never discovers alternatives',async()=>{
    const anchor={
      entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',
      regionId:'hapcheon',
      label:'황매산 군립공원',
      entityType:'ATTRACTION',
      category:'TOURISM_NATURE',
      sourceTurnId:'turn-hwangmaesan',
      role:'RESULT'
    };

    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-INFO',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };

    const orchestrator={run:jest.fn()};

    const discovery={
      resolveExactPlaceIntent:jest.fn(async(_region:string,text:string)=>
        text==='황매산 군립공원'
          ? {
              category:'TOURISM_NATURE',
              entityId:anchor.entityId,
              label:'황매산 군립공원'
            }
          : undefined
      ),
      resolveReference:jest.fn(async()=>undefined),
      discover:jest.fn()
    };

    const regionalData={
      publicPlaceByCanonical:jest.fn(async(entityId:string)=>
        entityId===anchor.entityId
          ? {
              place:{
                entityUri:anchor.entityId,
                canonicalLabelKo:'황매산 군립공원',
                description:'철쭉과 억새 경관으로 알려진 합천의 군립공원입니다.',
                address:'경상남도 합천군 가회면 황매산공원길 331',
                telephone:'055-930-4769'
              }
            }
          : undefined
      )
    };

    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'INFORMATION',
          subjectText:'거기',
          referenceType:'PREVIOUS_SUBJECT',
          relationToPrevious:'CONTINUE',
          requestedAction:'차로 올라갈 수 있는지 확인',
          categoryHint:null,
          confidence:.99
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,
      regionalData as any,
      undefined,
      undefined,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'거기 차로 올라갈 수 있어?',
      conversationalAnchor:anchor
    } as any);

    expect(semanticInterpreter.interpret)
      .toHaveBeenCalledWith('거기 차로 올라갈 수 있어?','황매산 군립공원','hapcheon',undefined);

    expect(discovery.resolveExactPlaceIntent)
      .toHaveBeenCalledWith('hapcheon','황매산 군립공원');

    expect(regionalData.publicPlaceByCanonical)
      .toHaveBeenCalledWith(anchor.entityId);

    expect(result).toMatchObject({
      intentRoute:'ENTITY_INFORMATION',
      recommendation:null,
      entityInformation:{
        kind:'VEHICLE_ACCESS',
        status:'NOT_VERIFIED'
      },
      conversationalReference:anchor
    });

    expect(result.visitorMessage).toContain('황매산 군립공원');
    expect(result.visitorMessage).toContain('확인된 정보가 없습니다');
    expect(discovery.discover).not.toHaveBeenCalled();
    expect(orchestrator.run).not.toHaveBeenCalled();
  });

  it('keeps FOOD as the target category when an explicit tourism anchor is grounded',async()=>{
    const contextService={
      createContext:jest.fn(async()=>({
        context:{contextNo:'RC-ANCHOR-FOOD',operationUri:'hapcheon:operation'},
        evidence:[],
        firedRules:[]
      }))
    };

    const orchestrator={run:jest.fn()};

    const discovery={
      resolveExactPlaceIntent:jest.fn(async(_region:string,text:string)=>
        text==='황매산'
          ? {
              category:'TOURISM_NATURE',
              entityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',
              label:'황매산 군립공원'
            }
          : undefined
      ),
      resolveReference:jest.fn(async()=>undefined),
      discover:jest.fn(async(_region:string,category:string)=>({
        regionId:'hapcheon',
        category,
        anchorEntityId:'https://hapcheon.example/ontology#hwangmaesanCountyPark',
        anchorLabel:'황매산 군립공원',
        entities:[]
      }))
    };

    const semanticInterpreter={
      interpret:jest.fn(async()=>({
        status:'SUCCESS',
        provider:'openai',
        latencyMs:1,
        interpretation:{
          intent:'PLACE_DISCOVERY',
          subjectText:'황매산',
          referenceType:'EXPLICIT_ENTITY',
          relationToPrevious:'REPLACE',
          requestedAction:'근처 밥 먹을 만한 곳 찾기',
          categoryHint:'음식점',
          confidence:.99
        }
      }))
    };

    const service=new ConciergeService(
      contextService as any,
      orchestrator as any,
      {label:jest.fn()} as any,
      {get:jest.fn(()=>GAJO_REGION_CONFIG),detectOutOfRegion:jest.fn()} as any,
      discovery as any,
      undefined,undefined,undefined,undefined,
      semanticInterpreter as any
    );

    const result:any=await service.chat({
      regionId:'hapcheon',
      inputMode:'FREE_TEXT',
      rawMessage:'황매산 근처 밥 먹을 만한 데 있어?'
    } as any);

    expect(discovery.resolveExactPlaceIntent)
      .toHaveBeenCalledWith('hapcheon','황매산');

    expect(discovery.discover).toHaveBeenCalledWith(
      'hapcheon',
      'FOOD',
      '황매산 근처 밥 먹을 만한 데 있어?',
      expect.anything()
    );

    expect(result).toMatchObject({
      intentRoute:'PLACE_DISCOVERY',
      discovery:{category:'FOOD'}
    });

    expect(orchestrator.run).not.toHaveBeenCalled();
  });
});

describe('deterministic semantic fast-path',()=>{
  const service=new ConciergeService({} as any,{} as any,{} as any);

  it('skips only simple generic discovery and preserves semantic context',()=>{
    const fast=(rawMessage:string,conversationalAnchor?:any)=>
      (service as any).canUseDeterministicFastPath({
        regionId:'hapcheon',
        inputMode:'FREE_TEXT',
        rawMessage,
        conversationalAnchor
      });

    expect(fast('근처 식당 찾아줘')).toBe(true);
    expect(fast('카페 추천해줘')).toBe(true);
    expect(fast('거기서 밥 먹을 데 있어?',{
      entityId:'test',
      regionId:'hapcheon',
      label:'황매산 군립공원'
    })).toBe(false);
    expect(fast('해인사 말고 황매산',{
      entityId:'test',
      regionId:'hapcheon',
      label:'해인사'
    })).toBe(false);
  });
});