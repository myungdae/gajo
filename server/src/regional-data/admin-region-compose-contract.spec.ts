import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('admin region runtime contract',()=>{
  const root=resolve(process.cwd(),'..');
  const compose=readFileSync(resolve(root,'docker-compose.yml'),'utf8').replace(/\r\n/g,'\n');
  const example=readFileSync(resolve(root,'.env.example'),'utf8');

  it('passes ADMIN_REGION_IDS through the API service without a permissive default',()=>{
    const api=compose.match(/\n  api:\n([\s\S]*?)\n  client:/)?.[1]||'';
    expect(api).toContain('ADMIN_REGION_IDS=${ADMIN_REGION_IDS:-}');
    expect(api).not.toMatch(/ADMIN_REGION_IDS=.*(?:\*|all)/i);
  });

  it('documents an empty fail-closed value and no operational region scope',()=>{
    expect(example).toMatch(/^ADMIN_REGION_IDS=$/m);
    expect(example).toContain('Empty is fail-closed');
    expect(example).not.toMatch(/^ADMIN_REGION_IDS=.+/m);
  });

  it('uses only synthetic comma-separated values in this contract test',()=>{
    const synthetic='region-alpha,region-beta';
    expect(synthetic.split(',')).toEqual(['region-alpha','region-beta']);
    expect(compose).not.toContain(synthetic);
    expect(example).not.toContain(synthetic);
  });
});
