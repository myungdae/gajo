import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

@Injectable()
export class RegionalReportRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { start: number; count: number }
  >();

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
        headers: Record<string, string | string[] | undefined>;
      }>(),
      token = request.headers['x-regional-report-token'],
      key = createHash('sha256')
        .update(typeof token === 'string' ? token : '')
        .digest('hex'),
      now = Date.now(),
      existing = this.buckets.get(key),
      bucket =
        !existing || now - existing.start >= WINDOW_MS
          ? { start: now, count: 0 }
          : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (bucket.count > MAX_REQUESTS)
      throw new HttpException(
        'Regional report rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return true;
  }
}
