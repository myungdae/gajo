import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, createHmac, randomBytes } from 'crypto';
import * as ipaddr from 'ipaddr.js';
import type { Request, Response } from 'express';

export type PublicWritePolicy =
  | 'PARTNER_APPLICATION'
  | 'QR_ENTRY'
  | 'QR_VISIT'
  | 'BENEFIT_REDEMPTION'
  | 'RECOMMENDATION_TELEMETRY'
  | 'OWNER_MANAGEMENT';

const POLICY_METADATA = 'partner-public-write-policy';
export const PublicWriteLimit = (policy: PublicWritePolicy) =>
  SetMetadata(POLICY_METADATA, policy);

export const PUBLIC_WRITE_LIMITS: Record<
  PublicWritePolicy,
  { limit: number; windowMs: number }
> = {
  PARTNER_APPLICATION: { limit: 5, windowMs: 60 * 60 * 1000 },
  QR_ENTRY: { limit: 60, windowMs: 60 * 1000 },
  QR_VISIT: { limit: 20, windowMs: 10 * 60 * 1000 },
  BENEFIT_REDEMPTION: { limit: 10, windowMs: 10 * 60 * 1000 },
  RECOMMENDATION_TELEMETRY: { limit: 120, windowMs: 60 * 1000 },
  OWNER_MANAGEMENT: { limit: 30, windowMs: 10 * 60 * 1000 },
};
export const GLOBAL_PUBLIC_WRITE_LIMIT = {
  limit: 2_000,
  windowMs: 60 * 1000,
};

export interface PublicWriteRateLimitStore {
  /** A distributed adapter must increment and set/retain TTL atomically. */
  consume(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}
export const PUBLIC_WRITE_RATE_LIMIT_STORE = Symbol(
  'PUBLIC_WRITE_RATE_LIMIT_STORE',
);
export const PUBLIC_WRITE_RATE_LIMIT_CAPACITY = Symbol(
  'PUBLIC_WRITE_RATE_LIMIT_CAPACITY',
);

@Injectable()
export class InMemoryPublicWriteRateLimitStore implements PublicWriteRateLimitStore {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  private readonly capacity: number;

  constructor(
    @Optional()
    @Inject(PUBLIC_WRITE_RATE_LIMIT_CAPACITY)
    capacity?: number,
  ) {
    this.capacity = capacity || 10_000;
  }

  consume(key: string, limit: number, windowMs: number, now: number) {
    let window = this.windows.get(key);
    if (window?.resetAt && window.resetAt <= now) {
      this.windows.delete(key);
      window = undefined;
    }
    if (!window) {
      this.removeExpired(now);
      if (this.windows.size >= this.capacity)
        return Promise.resolve({
          allowed: false,
          retryAfterSeconds: this.capacityRetryAfter(now),
        });
      window = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, window);
    }
    if (window.count >= limit)
      return Promise.resolve({
        allowed: false,
        retryAfterSeconds: retryAfter(window.resetAt, now),
      });
    window.count += 1;
    return Promise.resolve({ allowed: true, retryAfterSeconds: 0 });
  }

  private removeExpired(now: number) {
    for (const [entryKey, value] of this.windows)
      if (value.resetAt <= now) this.windows.delete(entryKey);
  }

  private capacityRetryAfter(now: number) {
    let earliest = Number.POSITIVE_INFINITY;
    for (const value of this.windows.values())
      earliest = Math.min(earliest, value.resetAt);
    return Number.isFinite(earliest) ? retryAfter(earliest, now) : 1;
  }
}

const retryAfter = (resetAt: number, now: number) =>
  Math.max(1, Math.ceil((resetAt - now) / 1000));

type RequestIdentityInput = Pick<Request, 'socket' | 'ip' | 'headers'>;

@Injectable()
export class PublicClientIdentityService {
  private readonly salt: string;
  private readonly trustedProxies: TrustedProxyRule[];

  constructor() {
    const configured = process.env.RATE_LIMIT_HASH_SECRET,
      requiresSecret =
        process.env.NODE_ENV === 'production' ||
        process.env.RATE_LIMIT_STORE_MODE === 'shared';
    if (configured && Buffer.byteLength(configured, 'utf8') < 32)
      throw new Error('RATE_LIMIT_HASH_SECRET must be at least 32 bytes');
    if (requiresSecret && !configured)
      throw new Error(
        'RATE_LIMIT_HASH_SECRET is required in production or shared mode',
      );
    this.salt = configured || randomBytes(32).toString('base64url');
    this.trustedProxies = this.parseTrustedProxies(
      process.env.TRUSTED_PROXY_ADDRESSES || '',
    );
  }

  identify(request: RequestIdentityInput, contextParts: string[] = []) {
    return this.digest(
      [this.resolveClientNetwork(request), ...contextParts].join('|'),
    );
  }

  identifyContext(contextParts: string[]) {
    return this.digest(contextParts.join('|'));
  }

  resolveClientNetwork(request: RequestIdentityInput) {
    const peer = parseAddress(
      request.socket?.remoteAddress || request.ip || '',
    );
    if (!peer) return 'invalid-peer';
    if (!this.isTrustedProxy(peer.address)) return peer.network;
    const forwardedHeader = request.headers['x-forwarded-for'],
      raw = Array.isArray(forwardedHeader)
        ? forwardedHeader.join(',')
        : forwardedHeader || '';
    if (!raw.trim()) return 'invalid-forwarded-chain';
    const forwarded = raw.split(',').map((value) => parseAddress(value));
    if (forwarded.some((value) => !value)) return 'invalid-forwarded-chain';
    for (let index = forwarded.length - 1; index >= 0; index -= 1) {
      const hop = forwarded[index]!;
      if (!this.isTrustedProxy(hop.address)) return hop.network;
    }
    return 'trusted-proxy-only';
  }

  private digest(value: string) {
    return createHmac('sha256', this.salt).update(value).digest('hex');
  }

  private parseTrustedProxies(value: string) {
    const result: TrustedProxyRule[] = [];
    for (const entry of value.split(',').map((item) => item.trim())) {
      if (!entry) continue;
      try {
        if (entry.includes('%')) throw new Error('zone identifier');
        const [parsedAddress, parsedPrefixLength] = entry.includes('/')
          ? ipaddr.parseCIDR(entry)
          : exactProxyRule(entry);
        const { address, prefixLength } = normalizeProxyRule(
          parsedAddress,
          parsedPrefixLength,
        );
        if (prefixLength === 0) throw new Error('global range');
        result.push({ address, prefixLength });
      } catch {
        throw new Error(
          'TRUSTED_PROXY_ADDRESSES contains an invalid or unsafe IP/CIDR',
        );
      }
    }
    return result;
  }

  private isTrustedProxy(address: ipaddr.Address) {
    return this.trustedProxies.some((rule) => {
      if (isIPv4(address) && isIPv4(rule.address))
        return address.match(rule.address, rule.prefixLength);
      if (isIPv6(address) && isIPv6(rule.address))
        return address.match(rule.address, rule.prefixLength);
      return false;
    });
  }
}

type TrustedProxyRule = {
  address: ipaddr.Address;
  prefixLength: number;
};

const isIPv4 = (address: ipaddr.Address): address is ipaddr.IPv4 =>
  address.kind() === 'ipv4';
const isIPv6 = (address: ipaddr.Address): address is ipaddr.IPv6 =>
  address.kind() === 'ipv6';

function exactProxyRule(value: string): [ipaddr.Address, number] {
  if (!ipaddr.isValid(value)) throw new Error('invalid address');
  const address = ipaddr.parse(value);
  return [address, address.kind() === 'ipv4' ? 32 : 128];
}

function normalizeProxyRule(address: ipaddr.Address, prefixLength: number) {
  if (
    address.kind() === 'ipv6' &&
    (address as ipaddr.IPv6).isIPv4MappedAddress()
  ) {
    if (prefixLength < 96) throw new Error('unsafe mapped IPv4 range');
    return {
      address: (address as ipaddr.IPv6).toIPv4Address(),
      prefixLength: prefixLength - 96,
    };
  }
  return { address, prefixLength };
}

function normalizeMappedAddress(address: ipaddr.Address): ipaddr.Address {
  return address.kind() === 'ipv6' &&
    (address as ipaddr.IPv6).isIPv4MappedAddress()
    ? (address as ipaddr.IPv6).toIPv4Address()
    : address;
}

function parseAddress(value: string) {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.includes('%') || !ipaddr.isValid(candidate))
    return undefined;
  const parsed = normalizeMappedAddress(ipaddr.parse(candidate));
  if (parsed.kind() === 'ipv4') {
    const host = parsed.toString();
    return { address: parsed, host, network: `ipv4:${host}` };
  }
  const ipv6 = parsed as ipaddr.IPv6,
    host = ipv6.toNormalizedString(),
    prefix = ipv6.parts
      .slice(0, 4)
      .map((part) => part.toString(16).padStart(4, '0'))
      .join(':');
  return { address: parsed, host, network: `ipv6:${prefix}::/64` };
}

export function partnerApplicationFingerprint(input: unknown) {
  const value = (input || {}) as Record<string, unknown>,
    normalized = (field: unknown) =>
      (typeof field === 'string' ? field : '')
        .trim()
        .toLowerCase()
        .normalize('NFKC')
        .replace(/\s+/g, ' ');
  return createHash('sha256')
    .update(
      [value.regionId, value.displayName, value.address, value.phone]
        .map(normalized)
        .join('|'),
    )
    .digest('hex');
}

@Injectable()
export class PublicWriteRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identity: PublicClientIdentityService,
    @Inject(PUBLIC_WRITE_RATE_LIMIT_STORE)
    private readonly store: PublicWriteRateLimitStore,
  ) {}

  async canActivate(context: ExecutionContext) {
    const policy = this.reflector.getAllAndOverride<PublicWritePolicy>(
      POLICY_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!policy) return true;
    const http = context.switchToHttp(),
      request = http.getRequest<Request>(),
      response = http.getResponse<Response>(),
      identities = rateLimitIdentities(policy, request, this.identity),
      now = Date.now(),
      globalResult = await this.store.consume(
        'global:public-write',
        GLOBAL_PUBLIC_WRITE_LIMIT.limit,
        GLOBAL_PUBLIC_WRITE_LIMIT.windowMs,
        now,
      );
    if (!globalResult.allowed)
      return rejectRateLimit(response, globalResult.retryAfterSeconds);
    const config = PUBLIC_WRITE_LIMITS[policy];
    for (const identity of identities) {
      const result = await this.store.consume(
        `${policy}:${identity.scope}:${identity.digest}`,
        config.limit,
        config.windowMs,
        now,
      );
      if (!result.allowed)
        return rejectRateLimit(response, result.retryAfterSeconds);
    }
    return true;
  }
}

function rateLimitIdentities(
  policy: PublicWritePolicy,
  request: Request,
  identity: PublicClientIdentityService,
) {
  const body = (request.body || {}) as Record<string, unknown>;
  const identities = [{ scope: 'client', digest: identity.identify(request) }];
  if (policy === 'PARTNER_APPLICATION')
    identities.push({
      scope: 'application',
      digest: identity.identifyContext([partnerApplicationFingerprint(body)]),
    });
  else if (policy === 'QR_VISIT' || policy === 'BENEFIT_REDEMPTION')
    identities.push({
      scope: 'trip',
      digest: identity.identifyContext([
        stringField(body.regionId),
        stringField(body.anonymousTripId),
      ]),
    });
  else if (policy === 'OWNER_MANAGEMENT')
    identities.push({
      scope: 'partner',
      digest: identity.identifyContext([
        String(request.params?.slug || ''),
        String(request.params?.id || ''),
      ]),
    });
  return identities;
}

const stringField = (value: unknown) =>
  typeof value === 'string' ? value : '';

function rejectRateLimit(response: Response, retryAfterSeconds: number): never {
  response.setHeader('Retry-After', String(retryAfterSeconds));
  throw new HttpException(
    {
      statusCode: 429,
      error: 'Too Many Requests',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    },
    429,
  );
}
