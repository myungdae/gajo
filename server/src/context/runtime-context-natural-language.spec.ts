import { RuntimeContextService } from './runtime-context.service';

describe('RuntimeContextService natural-language hydration', () => {
  it('persists parsed operational fields for the demo sentence', async () => {
    let created: any;
    const model = { create: jest.fn(async (value: any) => { created = value; return { toObject: () => value }; }) } as any;
    const traversal = {
      expandConditions: jest.fn(() => ({ expanded: ['http://example/gajo#shortWalkingDistance'], risks: [], evidence: [] })),
      evaluateRules: jest.fn(() => []), individualsOfIncludingSubclasses: jest.fn(() => ['operation']),
    } as any;
    const service = new RuntimeContextService(model, traversal, {} as any);
    const result = await service.createContext({ rawMessage: '78세 어머니와 가조에 왔습니다. 어머니는 무릎이 조금 불편합니다. 자동차로 이동하고 오후 5시까지 머물 예정입니다. 지금 상황에 맞게 편안한 일정을 추천해 주세요.' });

    expect(created).toMatchObject({
      companions: [{ age: 78, relationship: 'mother', healthConditions: ['kneePain'] }],
      transportMode: 'CAR', stayUntil: '17:00', walkingLevel: 'LOW',
    });
    expect(created.healthConditions.some((value: string) => value.endsWith('#kneePain'))).toBe(true);
    expect(created.wellnessGoals.some((value: string) => value.endsWith('#restAndRecovery'))).toBe(true);
    expect(created.companionConstraints).toEqual(expect.arrayContaining(['elderlyCompanion', 'shortWalkingDistance']));
    expect(result.context.transportMode).toBe('CAR');
  });

  it('applies a mentioned follow-up patch without resetting preserved context', async () => {
    let created:any; const model={create:jest.fn(async(value:any)=>{created=value;return{toObject:()=>value}})} as any;
    const traversal={expandConditions:()=>({expanded:[],risks:[],evidence:[]}),evaluateRules:()=>[],individualsOfIncludingSubclasses:()=>['operation']} as any;
    const service=new RuntimeContextService(model,traversal,{} as any);
    await service.createContext({rawMessage:'차를 두고 이제 걸어갈게요',isFollowup:true,transportMode:'CAR',stayUntil:'17:00',companions:[{age:78,relationship:'mother',healthConditions:[]}]});
    expect(created).toMatchObject({transportMode:'WALK',stayUntil:'17:00',companions:[{age:78,relationship:'mother'}]});
  });

  it('keeps structured selection authoritative over conflicting initial free text',async()=>{
    let created:any;const model={create:jest.fn(async(value:any)=>{created=value;return{toObject:()=>value}})} as any;
    const traversal={expandConditions:()=>({expanded:[],risks:[],evidence:[]}),evaluateRules:()=>[],individualsOfIncludingSubclasses:()=>['operation']} as any;
    const gateway={extract:jest.fn().mockResolvedValue({decision:'CALL_LLM',invocationReason:'FREE_TEXT_INITIAL',result:{status:'SUCCESS',provider:'mock',latencyMs:1,extraction:{transportMode:{value:'WALK',confidence:.9,sourceText:'걸어가도',source:'LLM'}}}})} as any;
    await new RuntimeContextService(model,traversal,{} as any,gateway).createContext({inputMode:'FREE_TEXT',rawMessage:'걸어가도 될 것 같아요',transportMode:'CAR',contextSessionId:'s'});
    expect(created.transportMode).toBe('CAR');
  });

  it('merges the exact structured then free-language flow additively',async()=>{
    const created:any[]=[];const model={create:jest.fn(async(value:any)=>{created.push(value);return{toObject:()=>value}})} as any;
    const traversal={expandConditions:(seeds:string[])=>({expanded:seeds.some(value=>value.endsWith('#fatigue'))?['http://example/gajo#shortWalkingDistance']:[],risks:[],evidence:[]}),evaluateRules:()=>[],individualsOfIncludingSubclasses:()=>['operation']} as any;
    const service=new RuntimeContextService(model,traversal,{} as any);
    await service.createContext({inputMode:'STRUCTURED',companions:[{relationship:'parent',healthConditions:[]}],transportMode:'CAR',walkingLevel:'LOW',stayUntil:'17:00',companionConstraints:['shortWalkingDistance'],wellnessGoals:['restAndRecovery'],activityPreferences:['HOT_SPRING','REST_AND_RECOVERY']});
    const first=created[0];
    await service.createContext({inputMode:'FREE_TEXT',isFollowup:true,rawMessage:'엄마가 조금만 움직여도 금방 피곤해하시고 온천은 꼭 하고 싶어요.',companions:first.companions,transportMode:first.transportMode,walkingLevel:first.walkingLevel,stayUntil:first.stayUntil,companionConstraints:first.companionConstraints,wellnessGoals:first.wellnessGoals,activityPreferences:first.activityPreferences});
    const final=created[1];
    expect(final).toMatchObject({companions:[{relationship:'parent'}],transportMode:'CAR',walkingLevel:'LOW',stayUntil:'17:00'});
    expect(final.healthConditions.some((value:string)=>value.endsWith('#fatigue'))).toBe(true);
    expect(final.activityPreferences).toEqual(expect.arrayContaining(['HOT_SPRING','REST_AND_RECOVERY']));
    expect(final.wellnessGoals.some((value:string)=>value.endsWith('#restAndRecovery'))).toBe(true);
  });

  it('aligns explicit LOW walking constraint into ontology-aware expanded conditions',async()=>{
    let created:any;const model={create:jest.fn(async(value:any)=>{created=value;return{toObject:()=>value}})} as any;
    const traversal={expandConditions:()=>({expanded:[],risks:[],evidence:[]}),evaluateRules:()=>[],individualsOfIncludingSubclasses:()=>['operation']} as any;
    await new RuntimeContextService(model,traversal,{} as any).createContext({walkingLevel:'LOW',companionConstraints:['elderlyCompanion','shortWalkingDistance']});
    expect(created.expandedConditions).toContain('https://gajo-wellness.kr/ontology#shortWalkingDistance');
    expect(created.expandedConditions.some((value:string)=>value.endsWith('#elderlyCompanion'))).toBe(false);
  });

  it('passes a structured quick-start preset into RuntimeContext without invoking the extractor',async()=>{
    let created:any;const model={create:jest.fn(async(value:any)=>{created=value;return{toObject:()=>value}})} as any;
    const traversal={expandConditions:()=>({expanded:[],risks:[],evidence:[]}),evaluateRules:()=>[],individualsOfIncludingSubclasses:()=>['operation']} as any;
    const gateway={extract:jest.fn().mockResolvedValue({decision:'SKIP_LLM',invocationReason:'NOT_REQUIRED',result:{status:'DISABLED',provider:'none',latencyMs:0,errorCode:'NOT_REQUIRED'}})} as any;
    await new RuntimeContextService(model,traversal,{} as any,gateway).createContext({inputMode:'STRUCTURED',companions:[{relationship:'parent',healthConditions:[]}],walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],wellnessGoals:['restAndRecovery'],activityPreferences:['REST_AND_RECOVERY']});
    expect(gateway.extract).toHaveBeenCalledWith({text:undefined,sessionId:undefined,followup:undefined});
    expect(created).toMatchObject({walkingLevel:'LOW',companionConstraints:['shortWalkingDistance'],activityPreferences:['REST_AND_RECOVERY'],companions:[{relationship:'parent'}]});
    expect(created.wellnessGoals[0]).toMatch(/#restAndRecovery$/);
    expect(created.raw.extractionDebug).toMatchObject({gatewayDecision:'SKIP_LLM',extractorInvocationReason:'NOT_REQUIRED'});
  });
});
