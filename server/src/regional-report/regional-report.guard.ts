import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

export type RegionalReportAccess = { regionId: string };
const REGIONS = new Set([
  'gajo',
  'okcheon',
  'muan',
  'gyeryong',
  'hapcheon',
  'daejeon-junggu',
]);
const parse = () => {
  const raw = process.env.REGIONAL_REPORT_CREDENTIALS_JSON;
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value) || value.length === 0) return [];
    const valid = value.every(
      (x) =>
        x &&
        Object.keys(x).length === 2 &&
        typeof x.regionId === 'string' &&
        REGIONS.has(x.regionId) &&
        typeof x.token === 'string' &&
        x.token.trim() === x.token &&
        x.token.length >= 32,
    );
    if (!valid) return [];
    const tokens = value.map((x) => x.token),
      regions = value.map((x) => x.regionId);
    if (
      new Set(tokens).size !== tokens.length ||
      new Set(regions).size !== regions.length
    )
      return [];
    return value;
  } catch {
    return [];
  }
};
const digest = (value: string) => createHash('sha256').update(value).digest();
@Injectable()
export class RegionalReportGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest(),
      supplied = request.headers['x-regional-report-token'];
    if (typeof supplied !== 'string')
      throw new ForbiddenException('Regional report access denied');
    const match = parse().find((item) =>
      timingSafeEqual(digest(item.token), digest(supplied)),
    );
    if (!match) throw new ForbiddenException('Regional report access denied');
    const requested = request.query?.regionId;
    if (requested !== undefined && requested !== match.regionId)
      throw new ForbiddenException('Regional report access denied');
    request.regionalReportAccess = {
      regionId: match.regionId,
    } satisfies RegionalReportAccess;
    return true;
  }
}
