import { ConciergeService } from './concierge.service';
import { ExkoSemanticAdapter } from '../exko-semantic/exko-semantic.service';
import { OKCHEON_MASTER_DATA } from '../regions/okcheon/master-data';

const adapter = new ExkoSemanticAdapter({
  get: () => 'true',
} as any);
function service(discovery: any = {}) {
  return new ConciergeService(
    {
      createContext: jest.fn(async () => ({
        context: { contextNo: 'ok-semantic', regionId: 'okcheon' },
        evidence: [],
        firedRules: [],
      })),
    } as any,
    { run: jest.fn() } as any,
    { label: jest.fn() } as any,
    {
      get: jest.fn(() => ({ serviceAreaMessage: 'outside' })),
      detectOutOfRegion: jest.fn(),
    } as any,
    discovery as any,
    adapter,
    {
      effectiveDataset: jest.fn(async () => ({
        regionId: 'okcheon',
        records: OKCHEON_MASTER_DATA,
      })),
    } as any,
  );
}

describe('Okcheon semantic Local Concierge', () => {
  it('answers the exact cultural lunch question through EXKO then RDM actions', async () => {
    const result: any = await service().chat({
      regionId: 'okcheon',
      inputMode: 'FREE_TEXT',
      rawMessage:
        '정지용 시인과 관련된 곳을 둘러보고 옥천다운 점심도 먹고 싶어요.',
    });
    expect(result.intentRoute).toBe('SEMANTIC_JOURNEY');
    expect(
      result.recommendation.itinerary.steps.map((x: any) => x.programLabel),
    ).toEqual(['정지용 생가', '정지용문학관', '대박집']);
    expect(result.visitorMessage).toContain('옥천의 지역음식');
    expect(result.recommendation.itinerary.steps[0].actions).not.toHaveProperty(
      'navigate',
    );
    expect(result.recommendation.itinerary.steps[2].actions).toMatchObject({
      call: { phone: '043-731-4727' },
    });
  });
  it('preserves semantic context through cafe/distance discovery and constrained replans', async () => {
    const discovery = {
        resolveReference: jest.fn(),
        discover: jest.fn(async () => ({ entities: [] })),
        distanceInfo: jest.fn(async () => ({ available: false })),
      },
      concierge = service(discovery),
      first: any = await concierge.chat({
        regionId: 'okcheon',
        inputMode: 'FREE_TEXT',
        rawMessage:
          '정지용 시인과 관련된 곳을 둘러보고 옥천다운 점심도 먹고 싶어요.',
      }),
      cafe: any = await concierge.chat({
        regionId: 'okcheon',
        inputMode: 'FREE_TEXT',
        rawMessage: '그 근처 카페는?',
        semanticContext: first.semanticContext,
      } as any),
      withoutFood: any = await concierge.chat({
        regionId: 'okcheon',
        inputMode: 'FREE_TEXT',
        rawMessage: '음식은 빼줘.',
        semanticContext: first.semanticContext,
      } as any),
      twoHours: any = await concierge.chat({
        regionId: 'okcheon',
        inputMode: 'FREE_TEXT',
        rawMessage: '시간이 두 시간밖에 없어.',
        semanticContext: first.semanticContext,
      } as any);
    expect(cafe.semanticContext).toEqual(first.semanticContext);
    expect(discovery.discover).toHaveBeenCalledWith(
      'okcheon',
      'CAFE',
      '그 근처 카페는?',
      expect.objectContaining({ semanticContext: first.semanticContext }),
    );
    expect(
      withoutFood.recommendation.itinerary.steps.some(
        (x: any) => x.category === 'FOOD',
      ),
    ).toBe(false);
    expect(twoHours.semanticResult.rooDecisions.join(' ')).toContain('120');
    expect(twoHours.recommendation.itinerary.steps.length).toBeLessThanOrEqual(
      3,
    );
  });
});
