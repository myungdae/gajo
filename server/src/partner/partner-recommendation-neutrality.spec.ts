import {
  DecisionPipelineService,
  type DecisionCandidate,
} from '../recommendation/decision-pipeline.service';
const candidate = (programUri: string, extra: any = {}): DecisionCandidate => ({
  programUri,
  programLabel: programUri,
  matchedOn: ['fit'],
  matchedLabels: ['적합성'],
  mitigatesRisk: [],
  mitigationLabels: [],
  requiredMobility: [],
  affectedByEnvironment: [],
  durationMinutes: 60,
  requiresReservation: false,
  ...extra,
});
describe('partner commercial neutrality', () => {
  it('benefit size and participation metadata cannot change recommendation scores or order', () => {
    const pipeline = new DecisionPipelineService(),
      context = { environmentConditions: [], expandedConditions: [] },
      plain = pipeline.run([candidate('a'), candidate('b')], context),
      commercial = pipeline.run(
        [
          candidate('a', {
            partnerId: 'p1',
            benefit: { type: 'PERCENT_DISCOUNT', value: 90 },
            participationFee: 999999,
          }),
          candidate('b'),
        ],
        context,
      );
    expect(commercial.ranked.map((x) => [x.programUri, x.score])).toEqual(
      plain.ranked.map((x) => [x.programUri, x.score]),
    );
    expect(commercial.sequenced.map((x) => x.programUri)).toEqual(
      plain.sequenced.map((x) => x.programUri),
    );
  });
});
