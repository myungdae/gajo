import jsQR from 'jsqr';import{PNG}from'pngjs';import{RegionShareController}from'./region-share.controller';
describe('English regional QR entry', () => {
  it('preserves English and bypasses the Korean-only first poster for all six regions', async () => {
    for (const id of ['gajo','okcheon','muan','gyeryong','hapcheon','daejeon-junggu']) {
      let image: Buffer | undefined;
      const response = {setHeader:jest.fn(),send:(data:Buffer)=>{image=data;}} as any;
      await new RegionShareController({get:()=>({id})} as any).qr(id,response,'en');
      const png = PNG.sync.read(image!);
      expect(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data).toBe(`https://exkovia.com/${id}?entry=regional-qr:${id}&start=ai&lang=en`);
    }
  });
});
describe('regional entry share QR',()=>{it('encodes only the official regional entry URL at scan-safe resolution',async()=>{let body:Buffer|undefined;const response={setHeader:jest.fn(),send:jest.fn((value:Buffer)=>body=value)}as any;await new RegionShareController({get:jest.fn(()=>({id:'hapcheon'}))}as any).qr('hapcheon',response);const png=PNG.sync.read(body!);expect([png.width,png.height]).toEqual([640,640]);expect(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data).toBe('https://exkovia.com/hapcheon?entry=regional-qr:hapcheon');expect(response.setHeader).toHaveBeenCalledWith('Content-Type','image/png')})});
