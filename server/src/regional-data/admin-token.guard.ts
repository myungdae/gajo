import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { withAdditionalRegions } from '../region/additional-regions';
import { REGION_CONFIGS } from '../region/region-config.service';
import type { CopilotPrincipal } from '../copilot/copilot-auth';

export type AdminPrincipal = {
  actorId: string;
  allowedRegionIds: string[];
  authentication: 'ADMIN_TOKEN' | 'COPILOT_JWT';
};

const configuredActor = (token: string) => {
  const value = process.env.ADMIN_ACTOR_ID;
  if (value) {
    if (!/^[A-Za-z0-9:_-]{3,64}$/.test(value))
      throw new ForbiddenException(
        'ADMIN_ACTOR_ID must be an opaque operational identifier',
      );
    return value;
  }
  return `ADMIN_TOKEN:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
};

const sameSecret = (supplied: string, configured: string) => {
  const left = Buffer.from(supplied);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
};

const registeredRegions = () =>
  new Set(Object.keys(withAdditionalRegions(REGION_CONFIGS)));

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const legacy = String(request.headers['x-admin-token'] || '');
    const configured = process.env.ADMIN_WRITE_TOKEN || '';

    if (legacy && configured && sameSecret(legacy, configured)) {
      request.adminPrincipal = {
        actorId: configuredActor(configured),
        allowedRegionIds: (process.env.ADMIN_REGION_IDS || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        authentication: 'ADMIN_TOKEN',
      } satisfies AdminPrincipal;
      return true;
    }

    const authorization = String(request.headers.authorization || '');
    const bearer = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : legacy && legacy !== configured
        ? legacy
        : '';
    if (!bearer) throw new UnauthorizedException('Administrator login required');

    const secret = process.env.COPILOT_JWT_SECRET;
    if (!secret)
      throw new ForbiddenException('COPILOT_JWT_SECRET is not configured');

    let principal: CopilotPrincipal;
    try {
      principal = jwt.verify(bearer, secret, {
        algorithms: ['HS256'],
      }) as CopilotPrincipal;
    } catch {
      throw new UnauthorizedException('Invalid administrator session');
    }
    if (
      !principal ||
      typeof principal.sub !== 'string' ||
      !['PLATFORM_ADMIN', 'REGIONAL_MANAGER'].includes(principal.role)
    )
      throw new ForbiddenException('Management role required');

    const configuredRegions = registeredRegions();
    const allowedRegionIds =
      principal.role === 'PLATFORM_ADMIN'
        ? [...configuredRegions]
        : [...new Set(principal.regions || [])].filter((region) =>
            configuredRegions.has(region),
          );

    request.adminPrincipal = {
      actorId: `COPILOT:${principal.sub}`,
      allowedRegionIds,
      authentication: 'COPILOT_JWT',
    } satisfies AdminPrincipal;
    return true;
  }
}
