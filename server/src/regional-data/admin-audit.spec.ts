import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard';
import { RegionalDataController } from './regional-data.controller';

const contextFor=(request:any)=>({switchToHttp:()=>({getRequest:()=>request})}) as ExecutionContext;

describe('common administrator audit principal',()=>{
  afterEach(()=>{delete process.env.ADMIN_WRITE_TOKEN;delete process.env.ADMIN_ACTOR_ID});

  it('attaches an opaque configured actor without retaining the token',()=>{
    process.env.ADMIN_WRITE_TOKEN='secret-token-value';
    process.env.ADMIN_ACTOR_ID='OPS_CONSOLE_01';
    const request={headers:{'x-admin-token':'secret-token-value'}} as any;
    expect(new AdminTokenGuard().canActivate(contextFor(request))).toBe(true);
    expect(request.adminPrincipal).toEqual({actorId:'OPS_CONSOLE_01',allowedRegionIds:[]});
    expect(JSON.stringify(request.adminPrincipal)).not.toContain('secret-token-value');
  });

  it('uses a stable non-secret token fingerprint when no actor is configured',()=>{
    process.env.ADMIN_WRITE_TOKEN='secret-token-value';
    const first={headers:{'x-admin-token':'secret-token-value'}} as any,second={headers:{'x-admin-token':'secret-token-value'}} as any;
    const guard=new AdminTokenGuard();guard.canActivate(contextFor(first));guard.canActivate(contextFor(second));
    expect(first.adminPrincipal.actorId).toMatch(/^ADMIN_TOKEN:[0-9a-f]{16}$/);
    expect(second.adminPrincipal).toEqual(first.adminPrincipal);
    expect(first.adminPrincipal.actorId).not.toContain('secret-token-value');
  });

  it('rejects identifiers that could contain an email or personal data',()=>{
    process.env.ADMIN_WRITE_TOKEN='secret-token-value';
    process.env.ADMIN_ACTOR_ID='operator@example.com';
    const request={headers:{'x-admin-token':'secret-token-value'}};
    expect(()=>new AdminTokenGuard().canActivate(contextFor(request))).toThrow(ForbiddenException);
  });

  it('passes the authenticated actor through the common action controller',async()=>{
    const action=jest.fn().mockResolvedValue({ok:true}),controller=new RegionalDataController({action} as any);
    await controller.action('record-1','IGNORE_CHANGE',{}, {adminPrincipal:{actorId:'OPS_CONSOLE_01'}});
    expect(action).toHaveBeenCalledWith('record-1','IGNORE_CHANGE',undefined,{actorId:'OPS_CONSOLE_01'});
  });
});
