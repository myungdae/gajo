import { OntologyGraphService } from '../ontology/ontology-graph.service';
import { GraphTraversalService } from '../context/graph-traversal.service';
import { RuntimeReplanningService } from './runtime-replanning.service';

describe('Phase 2.5 ontology alternative discovery', () => {
  it('hydrates shortIndoorSeniorCourse as an indoor, low-walking candidate outside an itinerary', () => {
    const graph = new OntologyGraphService(); graph.onModuleInit();
    const traversal = new GraphTraversalService(graph);
    const service = new RuntimeReplanningService({} as any, {} as any, {} as any, {} as any, {} as any, traversal, {} as any);
    const candidates = (service as any).buildCandidates({
      healthConditions: ['https://gajo-wellness.kr/ontology#kneePain'],
      expandedConditions: ['https://gajo-wellness.kr/ontology#shortWalkingDistance'], risks: [],
    });
    const candidate = candidates.find((item: any) => item.programUri.endsWith('#shortIndoorSeniorCourse'));
    expect(candidate).toMatchObject({ isIndoor: true, durationMinutes: 180 });
    expect(candidate.requiredMobility.some((uri: string) => uri.endsWith('#shortWalkingDistance'))).toBe(true);
  });
});
