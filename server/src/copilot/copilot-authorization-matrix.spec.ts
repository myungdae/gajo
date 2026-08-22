import { ForbiddenException } from '@nestjs/common';
import { assertCopilotAccess, CopilotPrincipal } from './copilot-auth';

describe('Copilot manager authorization matrix', () => {
  const principal = (role: CopilotPrincipal['role'], regions: string[] = []): CopilotPrincipal => ({
    sub: `${role}:${regions.join(',')}`,
    username: role,
    role,
    regions,
  });
  it('allows platform admin in every explicit region but not an absent region', () => {
    const admin = principal('PLATFORM_ADMIN');
    for (const region of ['hapcheon', 'gajo', 'okcheon'])
      expect(() => assertCopilotAccess(admin, region, true)).not.toThrow();
    expect(() => assertCopilotAccess(admin, '', false)).toThrow();
  });
  it.each(['hapcheon', 'gajo', 'okcheon'])('%s manager reads and writes only its assignment', (region) => {
    const manager = principal('REGIONAL_MANAGER', [region]);
    expect(() => assertCopilotAccess(manager, region)).not.toThrow();
    expect(() => assertCopilotAccess(manager, region, true)).not.toThrow();
    for (const foreign of ['hapcheon', 'gajo', 'okcheon'].filter((x) => x !== region)) {
      expect(() => assertCopilotAccess(manager, foreign)).toThrow(ForbiddenException);
      expect(() => assertCopilotAccess(manager, foreign, true)).toThrow(ForbiddenException);
    }
  });
});
