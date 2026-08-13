import { EntityLocationService } from './entity-location.service';

describe('EntityLocationService', () => {
  const traversal: any = {
    literalProps: jest.fn((uri: string) => uri === 'facility' ? { latitude: '35.7', longitude: '128.0' } : {}),
    objectProps: jest.fn((uri: string) => uri === 'program' ? { heldAtFacility: ['facility'] } : {}),
  };
  const service = new EntityLocationService(traversal);
  it('calculates deterministic Haversine distance', () => expect(service.distance({latitude:35.7,longitude:128},{latitude:35.709,longitude:128}).distanceMeters).toBeGreaterThan(990));
  it('returns UNKNOWN when coordinates are missing', () => expect(service.distance(undefined, {latitude:1,longitude:1})).toEqual({distanceStatus:'UNKNOWN'}));
  it('lets a program inherit its facility coordinates', () => expect(service.coordinatesForProgram('program')).toMatchObject({latitude:35.7,longitude:128,sourceUri:'facility'}));
  it('uses explicit transport assumptions', () => { expect(service.estimateTravelMinutes(4000,'WALK')).toBe(60); expect(service.estimateTravelMinutes(5000,'UNKNOWN')).toBeUndefined(); });
  it('does not use raw ontology coordinates when the master-data gate rejects them',()=>{
    const guarded=new EntityLocationService(traversal,{verifiedCoordinates:jest.fn(()=>undefined)} as any);
    expect(guarded.coordinatesForFacility('facility')).toBeUndefined();
  });
  it('uses verified Baekdusan coordinates for GPS distance and car travel', () => {
    const master:any={verifiedCoordinates:jest.fn(()=>({latitude:35.698758,longitude:128.023103,sourceUri:'hot-spring'}))};
    const located=new EntityLocationService(traversal,master);
    const result=located.distance({latitude:35.7,longitude:128},{...located.coordinatesForFacility('hot-spring')!});
    expect(result).toMatchObject({distanceStatus:'AVAILABLE'});
    expect(result.distanceMeters).toBeGreaterThan(2000);
    expect(result.distanceMeters).toBeLessThan(2200);
    expect(located.estimateTravelMinutes(result.distanceMeters,'CAR')).toBe(10);
  });
});
