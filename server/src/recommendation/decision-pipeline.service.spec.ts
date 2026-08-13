import { DecisionPipelineService, DecisionCandidate } from './decision-pipeline.service';

const base = (overrides: Partial<DecisionCandidate> = {}): DecisionCandidate => ({
  programUri: 'gajo:program', programLabel: '기본 프로그램', facilityUri: 'gajo:facility',
  matchedOn: ['gajo:goal'], matchedLabels: ['휴식과 회복'], mitigatesRisk: [], mitigationLabels: [],
  requiredMobility: [], affectedByEnvironment: [], durationMinutes: 60, requiresReservation: false,
  ...overrides,
});

describe('DecisionPipelineService', () => {
  const service = new DecisionPipelineService();
  const context = { currentTime: '10:00', stayUntil: '18:00', environmentConditions: [], expandedConditions: [] };

  it('removes a closed facility during Feasibility', () => {
    const result = service.run([base({ runtime: { entityUri: 'gajo:facility', operatingState: 'CLOSED' } })], context);
    expect(result.feasible).toHaveLength(0);
    expect(result.rejected[0].reasons).toContain('시설이 현재 폐장 상태임');
  });

  it('prioritizes low walking burden for knee pain evidence', () => {
    const result = service.run([
      base({ programUri: 'gajo:long', programLabel: '긴 코스' }),
      base({ programUri: 'gajo:short', programLabel: '짧은 코스', isAccessible: true, requiredMobility: ['gajo:shortWalkingDistance'] }),
    ], { ...context, expandedConditions: ['gajo:shortWalkingDistance'] });
    expect(result.ranked[0].programUri).toBe('gajo:short');
  });

  it('prioritizes indoor activity in rainy weather', () => {
    const result = service.run([
      base({ programUri: 'gajo:outdoor', isIndoor: false }),
      base({ programUri: 'gajo:indoor', isIndoor: true }),
    ], { ...context, environmentConditions: ['gajo:rainyWeather'] });
    expect(result.ranked[0].programUri).toBe('gajo:indoor');
  });

  it('rejects an activity that cannot finish before stayUntil', () => {
    const result = service.run([base({ durationMinutes: 90 })], { ...context, currentTime: '17:00' });
    expect(result.feasible).toHaveLength(0);
    expect(result.rejected[0].reasons[0]).toContain('체류 종료 시간');
  });

  it('sequences feasible options by closing urgency', () => {
    const result = service.run([
      base({ programUri: 'gajo:later', runtime: { entityUri: 'gajo:a', closingTime: '18:00' } }),
      base({ programUri: 'gajo:earlier', runtime: { entityUri: 'gajo:b', closingTime: '14:00' } }),
    ], context);
    expect(result.sequenced.map((item) => item.programUri)).toEqual(['gajo:earlier', 'gajo:later']);
  });

  it('generates a Korean explanation from actual evidence', () => {
    const result = service.run([base({ programLabel: '온천 코스', matchedLabels: ['무릎 통증'] })], context);
    expect(result.reasonSummary).toContain('무릎 통증');
    expect(result.reasonSummary).toContain('온천 코스');
  });
  it('gives a nearby candidate only a modest suitability benefit', () => {
    const result=service.run([base({programUri:'far',matchedOn:['a','b'],distanceStatus:'AVAILABLE',distanceMeters:3000}),base({programUri:'near',distanceStatus:'AVAILABLE',distanceMeters:300})],context);
    expect(result.ranked[0].programUri).toBe('far');
  });
  it('penalizes a long walk when mobility is limited', () => {
    const result=service.run([base({programUri:'long',distanceStatus:'AVAILABLE',distanceMeters:3500}),base({programUri:'near',distanceStatus:'AVAILABLE',distanceMeters:400})],{...context,transportMode:'WALK',expandedConditions:['gajo:shortWalkingDistance']});
    expect(result.ranked[0].programUri).toBe('near');
  });
  it('includes estimated travel in stayUntil feasibility', () => {
    const result=service.run([base({durationMinutes:30,estimatedTravelMinutes:40})],{...context,currentTime:'17:00',stayUntil:'18:00'});
    expect(result.rejected[0].reasonCodes).toContain('TIME_WINDOW');
  });
  it('uses distance for sequence when operational constraints are equal', () => {
    const result=service.run([base({programUri:'far',coordinates:{latitude:35.72,longitude:128}}),base({programUri:'near',coordinates:{latitude:35.701,longitude:128}})],{...context,latitude:35.7,longitude:128});
    expect(result.sequenced[0].programUri).toBe('near');
  });
  it('sequences the two real verified places from visitor GPS', () => {
    const result=service.run([
      base({programUri:'healing-land',coordinates:{latitude:35.73662049,longitude:128.0408983}}),
      base({programUri:'baekdusan-hot-spring',coordinates:{latitude:35.698758,longitude:128.023103}}),
    ],{...context,latitude:35.7,longitude:128,transportMode:'CAR'});
    expect(result.sequenced.map(item=>item.programUri)).toEqual(['baekdusan-hot-spring','healing-land']);
  });
});
