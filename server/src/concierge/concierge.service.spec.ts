import { ConciergeService, detectOutOfServiceDestination } from './concierge.service';

describe('ConciergeService service-area handling', () => {
  it('recognizes the explicit Haeinsa destination without treating generic requests as external', () => {
    expect(detectOutOfServiceDestination('합천 해인사에 놀러 가고 싶어요.')).toEqual({ destination: '해인사', region: '합천' });
    expect(detectOutOfServiceDestination('엄마와 온천에 가고 싶어요.')).toBeUndefined();
    expect(detectOutOfServiceDestination('가조에서 해인사 이야기를 들었어요.')).toBeUndefined();
  });

  it('returns a normal visitor response and never runs Gajo recommendation for Haeinsa', async () => {
    const contextService = { createContext: jest.fn().mockResolvedValue({ context: { contextNo: 'RC-1', operationUri: 'gajo:operation', raw: { extractionDebug: { gatewayDecision: 'FALLBACK', status: 'PROVIDER_ERROR', errorCode: 'HTTP_429' } } }, evidence: [], firedRules: [] }) };
    const orchestrator = { run: jest.fn() };
    const service = new ConciergeService(contextService as any, orchestrator as any, { label: jest.fn() } as any);

    const result = await service.chat({ inputMode: 'FREE_TEXT', rawMessage: '합천 해인사에 놀러 가고 싶어요.' });

    expect(result).toMatchObject({
      recommendation: null,
      domainResult: { status: 'OUT_OF_SERVICE_AREA', destination: '해인사', region: '합천' },
      visitorMessage: '현재는 가조 지역을 중심으로 안내하고 있어요. 가조에서 즐길 수 있는 장소를 찾아드릴까요?',
    });
    expect(orchestrator.run).not.toHaveBeenCalled();
  });
});
