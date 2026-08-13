import { RuntimeReplanningService } from './runtime-replanning.service';
import { RuntimeChangeDetectorService } from './runtime-change-detector.service';
import { ImpactAssessmentService } from './impact-assessment.service';
import { DecisionPipelineService } from '../recommendation/decision-pipeline.service';

function query(value: any) { return { lean: async () => value, then: (resolve: any) => Promise.resolve(value).then(resolve) }; }

function harness() {
  const savedProposals: any[] = [];
  const traversal: any = {
    literalProps: (uri: string) => uri === 'facility:walk' ? { isIndoor: 'false' } : uri === 'program:indoor' ? { isIndoor: 'true', durationMinutes: '60' } : { isIndoor: 'true', isAccessible: 'true' },
    objectProps: (uri: string) => uri === 'program:indoor' ? { heldAtFacility: ['facility:indoor'], requiresMobilityCondition: ['shortWalkingDistance'] } : {},
    findSuitablePrograms: () => [{ programUri: 'program:indoor', matchedOn: ['kneePain'] }],
    label: (uri: string) => ({ 'program:indoor': '실내 저보행 프로그램', kneePain: '무릎 통증', 'facility:indoor': '실내 라운지' }[uri] || uri),
  };
  const itineraryDoc: any = { itineraryNo: 'IT-1', steps: [], save: jest.fn(async () => itineraryDoc), toObject: () => ({ itineraryNo: 'IT-1', steps: itineraryDoc.steps }) };
  const itineraryModel: any = { findOne: jest.fn(() => query(itineraryDoc)) };
  const proposalModel: any = {
    create: jest.fn(async (value) => { const doc = { ...value, toObject: () => ({ ...doc }), save: jest.fn(async () => doc) }; savedProposals.push(doc); return doc; }),
    findOne: jest.fn((filter) => query(filter.status === 'REJECTED' ? savedProposals.find((p) => p.suppressionKey === filter.suppressionKey && p.status === 'REJECTED') : savedProposals.find((p) => p.proposalNo === filter.proposalNo))),
  };
  const service = new RuntimeReplanningService(itineraryModel, proposalModel, new RuntimeChangeDetectorService(), new ImpactAssessmentService(traversal), new DecisionPipelineService(), traversal, {} as any);
  return { service, savedProposals, itineraryDoc, itineraryModel, traversal };
}

const contexts = () => ({
  previous: { contextNo: 'RC-1', precipitation: 2, currentTime: '12:50', healthConditions: ['kneePain'], expandedConditions: ['shortWalkingDistance'] },
  current: { contextNo: 'RC-2', precipitation: 20, currentTime: '13:00', stayUntil: '17:00', healthConditions: ['kneePain'], expandedConditions: ['shortWalkingDistance'], environmentConditions: ['heavyRain'] },
});
const itinerary = () => ({ itineraryNo: 'IT-1', steps: [
  { itemId: 'hot', order: 1, status: 'COMPLETED', programUri: 'program:hot', programLabel: '온천', facilityUri: 'facility:indoor' },
  { itemId: 'meal', order: 2, status: 'COMPLETED', programUri: 'program:meal', programLabel: '점심', facilityUri: 'facility:indoor' },
  { itemId: 'walk', order: 3, status: 'PLANNED', programUri: 'program:walk', programLabel: '야외 산책', facilityUri: 'facility:walk' },
] });

describe('RuntimeReplanningService', () => {
  it('discovers and selects an indoor candidate that was not in the original itinerary', async () => {
    const { service } = harness(); const { previous, current } = contexts();
    const result = await service.observeRuntime(previous, current, itinerary());
    expect(itinerary().steps.some((step) => step.programUri === 'program:indoor')).toBe(false);
    expect(result.proposedRevision.proposedNewItems.map((step: any) => step.programUri)).toContain('program:indoor');
  });
  it('exposes an explicit NO_DURATION reason for a rejected indoor candidate', async () => {
    const { service, traversal } = harness(); const { previous, current } = contexts();
    traversal.findSuitablePrograms = () => [{ programUri: 'program:no-duration', matchedOn: ['kneePain'] }];
    traversal.objectProps = () => ({ heldAtFacility: ['facility:indoor'] });
    traversal.literalProps = (uri: string) => uri === 'program:no-duration' ? { isIndoor: 'true' } : uri === 'facility:walk' ? { isIndoor: 'false' } : { isIndoor: 'true' };
    const result = await service.observeRuntime(previous, current, itinerary());
    expect(result.proposedRevision.candidateDiagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ candidateUri: 'program:no-duration', reasonCodes: ['NO_DURATION'] })]));
  });
  it('preserves completed history in a partial re-plan', async () => {
    const { service } = harness(); const { previous, current } = contexts();
    const result = await service.observeRuntime(previous, current, itinerary());
    expect(result.proposedRevision.preservedHistory.map((s: any) => s.itemId)).toEqual(['hot', 'meal']);
    expect(result.proposedRevision.proposedFutureSteps.some((s: any) => s.itemId === 'hot')).toBe(false);
  });
  it('does not mutate the itinerary before approval', async () => {
    const { service, itineraryModel } = harness(); const plan = itinerary(); const snapshot = JSON.stringify(plan); const { previous, current } = contexts();
    await service.observeRuntime(previous, current, plan);
    expect(JSON.stringify(plan)).toBe(snapshot); expect(itineraryModel.findOne).not.toHaveBeenCalled();
  });
  it('approval applies only the proposed future after immutable history', async () => {
    const { service, itineraryDoc } = harness(); const { previous, current } = contexts();
    const observed = await service.observeRuntime(previous, current, itinerary());
    itineraryDoc.steps = itinerary().steps.slice(0, 2).map((step: any) => ({ ...step, toObject: () => ({ ...step }) })).concat(itinerary().steps[2]);
    const applied = await service.approve(observed.proposedRevision.proposalNo);
    expect(applied.itinerary.steps.slice(0, 2).map((s: any) => s.itemId)).toEqual(['hot', 'meal']);
    expect(applied.itinerary.steps.some((s: any) => s.programUri === 'program:indoor')).toBe(true);
  });
  it('rejection preserves the active plan', async () => {
    const { service, itineraryDoc } = harness(); const { previous, current } = contexts(); const original = itinerary(); itineraryDoc.steps = original.steps;
    const observed = await service.observeRuntime(previous, current, original); await service.reject(observed.proposedRevision.proposalNo);
    expect(itineraryDoc.save).not.toHaveBeenCalled(); expect(itineraryDoc.steps).toEqual(original.steps);
  });
  it('suppresses the same rejected condition', async () => {
    const { service } = harness(); const { previous, current } = contexts();
    const first = await service.observeRuntime(previous, current, itinerary()); await service.reject(first.proposedRevision.proposalNo);
    const duplicate = await service.observeRuntime(previous, current, itinerary());
    expect(duplicate.suppressed).toBe(true); expect(duplicate.proposedRevision).toBeNull();
  });
  it('allows a materially worsened condition to notify again', async () => {
    const { service } = harness(); const { previous, current } = contexts();
    const first = await service.observeRuntime(previous, current, itinerary()); await service.reject(first.proposedRevision.proposalNo);
    const changed = await service.observeRuntime(previous, { ...current, precipitation: 40 }, itinerary());
    expect(changed.replanningRecommended).toBe(true); expect(changed.proposedRevision).not.toBeNull();
  });
  it('Korean explanation includes the trigger, visitor reason, affected item, and alternative', async () => {
    const { service } = harness(); const { previous, current } = contexts();
    const result = await service.observeRuntime(previous, current, itinerary()); const explanation = result.proposedRevision.explanation;
    expect(explanation).toContain('강한 비'); expect(explanation).toContain('무릎'); expect(explanation).toContain('야외 산책'); expect(explanation).toContain('실내 저보행 프로그램');
  });
});
