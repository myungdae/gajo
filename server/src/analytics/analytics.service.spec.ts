import { AnalyticsService } from './analytics.service';
describe('AnalyticsService', () => {
  it('never stores raw free language text and always stores region', async () => {
    const create = jest.fn();
    const service = new AnalyticsService({ create } as any);
    await service.record({
      eventType: 'FREE_LANGUAGE_REQUEST',
      sessionId: 's1',
      regionId: 'okcheon',
      metadata: { rawMessage: '비밀 문장', text: '원문', mode: 'NOW' },
    });
    expect(create).toHaveBeenCalledWith({
      eventType: 'FREE_LANGUAGE_REQUEST',
      sessionId: 's1',
      regionId: 'okcheon',
      metadata: { mode: 'NOW', regionId: 'okcheon' },
    });
  });
  it('rejects unknown events', async () => {
    const create = jest.fn();
    const service = new AnalyticsService({ create } as any);
    expect(
      await service.record({ eventType: 'RAW_TEXT', sessionId: 's1' }),
    ).toEqual({ accepted: false });
    expect(create).not.toHaveBeenCalled();
  });
  it('accepts canonical interest coverage events without raw text', async () => {
    const create = jest.fn();
    const service = new AnalyticsService({ create } as any);
    await service.record({eventType:'INTEREST_UNCOVERED',sessionId:'s2',regionId:'hapcheon',metadata:{interestId:'GOLF',rawMessage:'골프장 찾아줘'}});
    expect(create).toHaveBeenCalledWith({eventType:'INTEREST_UNCOVERED',sessionId:'s2',regionId:'hapcheon',metadata:{interestId:'GOLF',regionId:'hapcheon'}});
  });
});
