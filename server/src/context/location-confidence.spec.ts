import { isOperationalLocation, locationConfidence } from './location-confidence';

describe('Location confidence gate',()=>{
  it('classifies centralized accuracy thresholds',()=>{
    expect(locationConfidence(100)).toBe('HIGH');
    expect(locationConfidence(500)).toBe('MEDIUM');
    expect(locationConfidence(1500)).toBe('LOW');
    expect(locationConfidence(1501)).toBe('UNUSABLE');
  });
  it('rejects a 50,000m GPS observation',()=>expect(isOperationalLocation({locationStatus:'AVAILABLE',latitude:35.7,longitude:128,locationAccuracy:50000})).toBe(false));
  it('accepts good GPS for normal operational calculations',()=>expect(isOperationalLocation({locationStatus:'AVAILABLE',latitude:35.7,longitude:128,locationAccuracy:25})).toBe(true));
});
