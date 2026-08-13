import { RuntimeChangeDetectorService } from './runtime-change-detector.service';

describe('RuntimeChangeDetectorService', () => {
  const service = new RuntimeChangeDetectorService();
  it('emits HEAVY_RAIN when precipitation crosses the configured threshold', () => {
    expect(service.detect({ precipitation: 2 }, { precipitation: 20, observedAt: '2026-08-09T13:00:00Z' })[0]).toMatchObject({ eventType: 'HEAVY_RAIN', severity: 'HIGH', previousValue: 2, currentValue: 20 });
  });
  it('does not emit an event for an insignificant precipitation change', () => {
    expect(service.detect({ precipitation: 2 }, { precipitation: 3 })).toEqual([]);
  });
  it('detects facility and reservation availability changes', () => {
    const events = service.detect({ runtimeStates: [{ entityUri: 'facility:a', operatingState: 'OPEN', reservationState: 'AVAILABLE' }] }, { runtimeStates: [{ entityUri: 'facility:a', operatingState: 'CLOSED', reservationState: 'FULL' }] });
    expect(events.map((event) => event.eventType)).toEqual(['FACILITY_UNAVAILABLE', 'RESERVATION_UNAVAILABLE']);
  });
  it('emits HEAVY_RAIN from a meaningful normalized live weather transition', () => {
    expect(service.detect({ weatherState: 'CLOUDY', precipitation: 0 }, { weatherState: 'HEAVY_RAIN', precipitation: 10 })[0].eventType).toBe('HEAVY_RAIN');
  });
  it('ignores small GPS jitter including reported accuracy', () => {
    expect(service.detect({locationStatus:'AVAILABLE',latitude:35.7,longitude:128,locationAccuracy:30},{locationStatus:'AVAILABLE',latitude:35.7005,longitude:128,locationAccuracy:30})).toEqual([]);
  });
  it('emits a location event after a material movement', () => {
    expect(service.detect({locationStatus:'AVAILABLE',latitude:35.7,longitude:128,locationAccuracy:10},{locationStatus:'AVAILABLE',latitude:35.71,longitude:128,locationAccuracy:10})[0]).toMatchObject({eventType:'LOCATION_CHANGED'});
  });
  it('does not trigger location replanning from unusable GPS jitter',()=>{
    expect(service.detect({locationStatus:'AVAILABLE',latitude:35.7,longitude:128,locationAccuracy:50000},{locationStatus:'AVAILABLE',latitude:36.5,longitude:129,locationAccuracy:50000})).toEqual([]);
  });
});
