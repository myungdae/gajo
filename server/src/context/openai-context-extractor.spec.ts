import { OpenAIContextExtractor } from './openai-context-extractor';

const config=(values:Record<string,unknown>)=>({get:(key:string)=>values[key]}) as any;
describe('OpenAIContextExtractor',()=>{
  afterEach(()=>jest.restoreAllMocks());
  it('falls back when the key is missing',async()=>expect((await new OpenAIContextExtractor(config({OPENAI_CONTEXT_MODEL:'model'})).extract('안녕')).status).toBe('DISABLED'));
  it('accepts schema-valid mocked output',async()=>{jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({output_text:JSON.stringify({transportMode:{value:'CAR',confidence:.98,sourceText:'차로'},needsClarification:false})})} as any);expect((await new OpenAIContextExtractor(config({OPENAI_API_KEY:'test',OPENAI_CONTEXT_MODEL:'model'})).extract('차로 왔어요')).extraction?.transportMode?.value).toBe('CAR')});
  it('rejects invalid model output',async()=>{jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({output_text:JSON.stringify({transportMode:{value:'FLY',confidence:.9,sourceText:'날아서'}})})} as any);expect((await new OpenAIContextExtractor(config({OPENAI_API_KEY:'test',OPENAI_CONTEXT_MODEL:'model'})).extract('')).status).toBe('INVALID')});
  it('handles provider failure',async()=>{jest.spyOn(global,'fetch').mockRejectedValue(new Error('offline'));expect((await new OpenAIContextExtractor(config({OPENAI_API_KEY:'test',OPENAI_CONTEXT_MODEL:'model'})).extract('')).status).toBe('PROVIDER_ERROR')});
  it('handles timeout',async()=>{const error:any=new Error('aborted');error.name='AbortError';jest.spyOn(global,'fetch').mockRejectedValue(error);expect((await new OpenAIContextExtractor(config({OPENAI_API_KEY:'test',OPENAI_CONTEXT_MODEL:'model'})).extract('')).status).toBe('TIMEOUT')});
});
