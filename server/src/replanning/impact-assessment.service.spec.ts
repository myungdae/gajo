import { ImpactAssessmentService } from './impact-assessment.service';

describe('ImpactAssessmentService', () => {
  const traversal: any = { literalProps: (uri: string) => ({ isIndoor: uri === 'facility:outdoor' ? 'false' : 'true' }), objectProps: () => ({}) };
  const service = new ImpactAssessmentService(traversal);
  const itinerary = { steps: [
    { itemId: 'done', status: 'COMPLETED', facilityUri: 'facility:outdoor' },
    { itemId: 'walk', status: 'PLANNED', facilityUri: 'facility:outdoor', programLabel: '야외 산책' },
  ] };
  it('marks only a future outdoor item HIGH for heavy rain', () => {
    const result = service.assess({ eventType: 'HEAVY_RAIN', observedAt: '', severity: 'HIGH', evidence: [] }, itinerary, {});
    expect(result.level).toBe('HIGH'); expect(result.affectedItems.map((item) => item.itemId)).toEqual(['walk']);
  });
  it('marks an unavailable facility CRITICAL only when a future item uses it', () => {
    const result = service.assess({ eventType: 'FACILITY_UNAVAILABLE', entityUri: 'facility:outdoor', observedAt: '', severity: 'CRITICAL', evidence: [] }, itinerary, {});
    expect(result.level).toBe('CRITICAL'); expect(result.affectedItems).toHaveLength(1);
  });
  it('marks a future outdoor item HIGH for normalized live RAIN while indoor-only plans remain unaffected', () => {
    const rain: any = { eventType: 'WEATHER_CHANGED', observedAt: '', severity: 'MEDIUM', evidence: [], currentValue: 'RAIN' };
    expect(service.assess(rain, itinerary, {}).level).toBe('HIGH');
    expect(service.assess({ ...rain, affectedItineraryItemIds: undefined }, { steps: [{ itemId: 'inside', status: 'PLANNED', facilityUri: 'facility:inside' }] }, {}).level).toBe('NONE');
  });
  it('marks a future outdoor item HIGH for an official heavy-rain safety alert', () => {
    const event: any = {
      eventType: 'OFFICIAL_SAFETY_ALERT',
      observedAt: '',
      severity: 'HIGH',
      evidence: ['기상청 공식 특보'],
      currentValue: {
        alertType: 'HEAVY_RAIN',
        title: '합천군 호우주의보',
        source: 'KMA',
      },
    };

    const result = service.assess(event, itinerary, {});

    expect(result.level).toBe('HIGH');
    expect(result.affectedItems.map((item) => item.itemId)).toEqual(['walk']);
    expect(result.reasons[0]).toContain('합천군 호우주의보');
  });

  it('keeps indoor-only plans unaffected by an official heavy-rain safety alert', () => {
    const event: any = {
      eventType: 'OFFICIAL_SAFETY_ALERT',
      observedAt: '',
      severity: 'HIGH',
      evidence: ['기상청 공식 특보'],
      currentValue: {
        alertType: 'HEAVY_RAIN',
        title: '합천군 호우주의보',
        source: 'KMA',
      },
    };

    const indoorOnly = {
      steps: [
        {
          itemId: 'inside',
          status: 'PLANNED',
          facilityUri: 'facility:inside',
          programLabel: '실내 전시',
        },
      ],
    };

    const result = service.assess(event, indoorOnly, {});

    expect(result.level).toBe('NONE');
    expect(result.affectedItems).toHaveLength(0);
  });
});
