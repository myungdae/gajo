import { LocationHydrationService } from './location-hydration.service';
describe('LocationHydrationService',()=>{const service=new LocationHydrationService();
  it('preserves health, mobility and operational context',()=>expect(service.hydrate({healthConditions:['kneePain'],walkingLevel:'LOW',stayUntil:'17:00',weather:'RAIN'},{status:'AVAILABLE',latitude:35,longitude:128,accuracy:20,observedAt:'now'})).toMatchObject({healthConditions:['kneePain'],walkingLevel:'LOW',stayUntil:'17:00',weather:'RAIN',latitude:35,locationAccuracy:20,locationConfidence:'HIGH',locationOperational:true}));
  it('retains unusable accuracy diagnostically but blocks operational use',()=>expect(service.hydrate({}, {status:'AVAILABLE',latitude:35,longitude:128,accuracy:50000})).toMatchObject({locationAccuracy:50000,locationConfidence:'UNUSABLE',locationOperational:false}));
  it('degrades safely after denied permission',()=>expect(service.hydrate({healthConditions:['kneePain']},{status:'DENIED'})).toEqual({healthConditions:['kneePain'],locationStatus:'DENIED',locationConfidence:'UNUSABLE',locationOperational:false}));
  it('does not add fake coordinates to demo or unknown contexts',()=>expect(service.hydrate({demoMode:true},{status:'UNKNOWN'})).toEqual({demoMode:true,locationStatus:'UNKNOWN',locationConfidence:'UNUSABLE',locationOperational:false}));
});
