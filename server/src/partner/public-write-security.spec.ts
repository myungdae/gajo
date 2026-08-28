import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import request from 'supertest';
import { PartnerController } from './partner.controller';
import { PartnerService } from './partner.service';
import {
  InMemoryPublicWriteRateLimitStore,
  PUBLIC_WRITE_LIMITS,
  PUBLIC_WRITE_RATE_LIMIT_STORE,
  PublicClientIdentityService,
  PublicWriteRateLimitGuard,
} from './public-write-security';

const trip = '11111111-1111-4111-8111-111111111111';

describe('pilot deployment repository guardrails', () => {
  const compose = readFileSync(
    resolve(process.cwd(), '../docker-compose.yml'),
    'utf8',
  );

  it('makes the production HMAC secret a required Compose interpolation', () => {
    expect(compose).toContain(
      'RATE_LIMIT_HASH_SECRET=${RATE_LIMIT_HASH_SECRET:?required}',
    );
    expect(compose).toContain(
      'RATE_LIMIT_STORE_MODE=${RATE_LIMIT_STORE_MODE:-memory}',
    );
    expect(compose).toContain(
      'TRUSTED_PROXY_ADDRESSES=${TRUSTED_PROXY_ADDRESSES:-}',
    );
  });

  it('publishes only client Nginx on host loopback', () => {
    expect(compose).toContain('127.0.0.1:8090:80');
    expect(compose).not.toMatch(/- ["']?(?:0\.0\.0\.0:)?3000:/);
    expect(compose).not.toMatch(/- ["']?(?:0\.0\.0\.0:)?27017:/);
  });
});

describe('partner public write HTTP protection', () => {
  let app: INestApplication;
  const service: any = {
    apply: jest.fn().mockResolvedValue({ status: 'APPLICATION_RECEIVED' }),
    publicEntry: jest.fn(),
    recordEntry: jest.fn().mockResolvedValue({ accepted: true }),
    visit: jest.fn().mockResolvedValue({ visitStatus: 'QR_CONFIRMED' }),
    requestRedemption: jest.fn().mockResolvedValue({ status: 'REQUESTED' }),
    createBenefit: jest.fn().mockResolvedValue({ benefitId: 'b1' }),
    confirm: jest.fn().mockResolvedValue({ status: 'CONFIRMED' }),
    metrics: jest.fn().mockResolvedValue({ qrVisits: 0 }),
    qrAsset: jest.fn(),
    recommendationShown: jest.fn().mockResolvedValue({ accepted: true }),
    recommendationsShownForEntities: jest.fn(),
  };
  beforeAll(async () => {
    process.env.RATE_LIMIT_HASH_SECRET =
      'test-rate-limit-secret-32-bytes-minimum';
    const module = await Test.createTestingModule({
      controllers: [PartnerController],
      providers: [
        Reflector,
        { provide: PartnerService, useValue: service },
        PublicClientIdentityService,
        PublicWriteRateLimitGuard,
        InMemoryPublicWriteRateLimitStore,
        {
          provide: PUBLIC_WRITE_RATE_LIMIT_STORE,
          useExisting: InMemoryPublicWriteRateLimitStore,
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.RATE_LIMIT_HASH_SECRET;
  });

  const expectLimited = async (
    policy: keyof typeof PUBLIC_WRITE_LIMITS,
    send: () => request.Test,
  ) => {
    const limit = PUBLIC_WRITE_LIMITS[policy].limit;
    for (let index = 0; index < limit; index += 1) await send().expect(201);
    const response = await send().expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.body).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    });
  };

  it('returns actual 429 for every public write policy', async () => {
    await expectLimited('PARTNER_APPLICATION', () =>
      request(app.getHttpServer()).post('/api/partners/applications').send({
        regionId: 'hapcheon',
        displayName: '업체 A',
        category: 'CAFE',
        address: '주소 A',
        phone: '055-000-0001',
        consent: true,
      }),
    );
    await expectLimited('QR_ENTRY', () =>
      request(app.getHttpServer())
        .post('/api/partners/public/one/entries')
        .send({ regionId: 'hapcheon', anonymousTripId: trip }),
    );
    await expectLimited('QR_VISIT', () =>
      request(app.getHttpServer())
        .post('/api/partners/public/one/visits')
        .send({ regionId: 'okcheon', anonymousTripId: trip }),
    );
    await expectLimited('BENEFIT_REDEMPTION', () =>
      request(app.getHttpServer())
        .post('/api/partners/benefits/b1/redemptions')
        .send({ regionId: 'muan', anonymousTripId: trip }),
    );
    await expectLimited('RECOMMENDATION_TELEMETRY', () =>
      request(app.getHttpServer())
        .post('/api/partners/recommendations')
        .send({ regionId: 'gyeryong', anonymousTripId: trip, partnerId: 'p1' }),
    );
  });

  it('rate limits owner endpoints without using the management key as identity', async () => {
    await expectLimited('OWNER_MANAGEMENT', () =>
      request(app.getHttpServer())
        .post('/api/partners/one/benefits')
        .set('x-partner-key', 'plaintext-owner-key')
        .send({ title: '혜택', benefitType: 'DRINK' }),
    );
    await request(app.getHttpServer())
      .patch('/api/partners/one/redemptions/r1')
      .set('x-partner-key', 'different-plaintext-key')
      .send({ decision: 'CONFIRM' })
      .expect(429);
    await request(app.getHttpServer())
      .get('/api/partners/one/metrics')
      .set('x-partner-key', 'different-plaintext-key')
      .expect(429);
    await request(app.getHttpServer())
      .get('/api/partners/one/qr?kind=go&format=svg')
      .set('x-partner-key', 'different-plaintext-key')
      .expect(429);
  });
});

describe('in-memory rate limit store boundaries', () => {
  it('keeps 10,000 active identities and rejects the 10,001st fail-closed', async () => {
    const store = new InMemoryPublicWriteRateLimitStore(10_000),
      now = 1_000;
    for (let index = 0; index < 10_000; index += 1)
      expect(
        (await store.consume(`identity-${index}`, 1, 60_000, now)).allowed,
      ).toBe(true);
    const overflow = await store.consume('identity-10000', 1, 60_000, now);
    expect(overflow).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(await store.consume('identity-0', 1, 60_000, now)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it('reports exact Retry-After and resets immediately after the window', async () => {
    const store = new InMemoryPublicWriteRateLimitStore(10);
    expect((await store.consume('one', 1, 10_000, 1_000)).allowed).toBe(true);
    expect(await store.consume('one', 1, 10_000, 10_999)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(await store.consume('one', 1, 10_000, 11_000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('atomically grants only the configured number under concurrent consume', async () => {
    const store = new InMemoryPublicWriteRateLimitStore(10),
      results = await Promise.all(
        Array.from({ length: 50 }, () => store.consume('same', 3, 60_000, 0)),
      );
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(47);
  });
});

describe('rate limit guard composition', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.RATE_LIMIT_HASH_SECRET =
      'test-rate-limit-secret-32-bytes-minimum';
  });
  afterEach(() => {
    delete process.env.RATE_LIMIT_HASH_SECRET;
  });
  const context = (response: any) =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'controller',
      switchToHttp: () => ({
        getRequest: () => ({
          socket: { remoteAddress: '192.0.2.44' },
          headers: { 'x-partner-key': 'plaintext-owner-key' },
          params: { slug: 'one' },
          body: {},
        }),
        getResponse: () => response,
      }),
    }) as any;

  it('consumes the global ceiling before the endpoint policy', async () => {
    const keys: string[] = [],
      store = {
        consume: jest.fn(async (key: string) => {
          keys.push(key);
          return { allowed: true, retryAfterSeconds: 0 };
        }),
      },
      reflector = {
        getAllAndOverride: () => 'OWNER_MANAGEMENT',
      } as any,
      guard = new PublicWriteRateLimitGuard(
        reflector,
        new PublicClientIdentityService(),
        store,
      );
    await expect(
      guard.canActivate(context({ setHeader: jest.fn() })),
    ).resolves.toBe(true);
    expect(keys[0]).toBe('global:public-write');
    expect(keys[1]).toMatch(/^OWNER_MANAGEMENT:client:[0-9a-f]{64}$/);
    expect(keys[2]).toMatch(/^OWNER_MANAGEMENT:partner:[0-9a-f]{64}$/);
    expect(keys.join('|')).not.toContain('192.0.2.44');
    expect(keys.join('|')).not.toContain('plaintext-owner-key');
    expect(keys.join('|')).not.toContain(process.env.RATE_LIMIT_HASH_SECRET);
  });

  it('consumes independent client and application/trip quotas', async () => {
    const keys: string[] = [],
      store = {
        consume: jest.fn(async (key: string) => {
          keys.push(key);
          return { allowed: true, retryAfterSeconds: 0 };
        }),
      },
      applicationGuard = new PublicWriteRateLimitGuard(
        { getAllAndOverride: () => 'PARTNER_APPLICATION' } as any,
        new PublicClientIdentityService(),
        store,
      ),
      visitGuard = new PublicWriteRateLimitGuard(
        { getAllAndOverride: () => 'QR_VISIT' } as any,
        new PublicClientIdentityService(),
        store,
      );
    const requestContext = (body: Record<string, unknown>) =>
      ({
        getHandler: () => 'handler',
        getClass: () => 'controller',
        switchToHttp: () => ({
          getRequest: () => ({
            socket: { remoteAddress: '192.0.2.44' },
            headers: {},
            params: {},
            body,
          }),
          getResponse: () => ({ setHeader: jest.fn() }),
        }),
      }) as any;
    await applicationGuard.canActivate(
      requestContext({
        regionId: 'hapcheon',
        displayName: 'A',
        address: 'one',
        phone: '1',
      }),
    );
    await visitGuard.canActivate(
      requestContext({ regionId: 'hapcheon', anonymousTripId: trip }),
    );
    expect(keys.filter((key) => key === 'global:public-write')).toHaveLength(2);
    expect(keys).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^PARTNER_APPLICATION:client:[0-9a-f]{64}$/),
        expect.stringMatching(/^PARTNER_APPLICATION:application:[0-9a-f]{64}$/),
        expect.stringMatching(/^QR_VISIT:client:[0-9a-f]{64}$/),
        expect.stringMatching(/^QR_VISIT:trip:[0-9a-f]{64}$/),
      ]),
    );
  });

  it('returns the exact global Retry-After without consuming endpoint quota', async () => {
    const response = { setHeader: jest.fn() },
      store = {
        consume: jest.fn(async () => ({
          allowed: false,
          retryAfterSeconds: 17,
        })),
      },
      guard = new PublicWriteRateLimitGuard(
        { getAllAndOverride: () => 'QR_ENTRY' } as any,
        new PublicClientIdentityService(),
        store,
      );
    await expect(guard.canActivate(context(response))).rejects.toMatchObject({
      status: 429,
    });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '17');
    expect(store.consume).toHaveBeenCalledTimes(1);
  });
});

describe('client identity and secret policy', () => {
  const secret = 'test-rate-limit-secret-32-bytes-minimum';
  beforeEach(() => {
    process.env.RATE_LIMIT_HASH_SECRET = secret;
    delete process.env.TRUSTED_PROXY_ADDRESSES;
    process.env.NODE_ENV = 'test';
  });
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.RATE_LIMIT_HASH_SECRET;
    delete process.env.TRUSTED_PROXY_ADDRESSES;
  });
  const input = (remoteAddress: string, forwarded?: string) => ({
    socket: { remoteAddress },
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
  });

  it('canonicalizes IPv4, mapped IPv6, native IPv6, and IPv6 /64 identities', () => {
    const identity = new PublicClientIdentityService();
    expect(identity.resolveClientNetwork(input('192.0.2.7'))).toBe(
      'ipv4:192.0.2.7',
    );
    expect(identity.resolveClientNetwork(input('::ffff:192.0.2.7'))).toBe(
      'ipv4:192.0.2.7',
    );
    expect(identity.resolveClientNetwork(input('2001:db8::1'))).toBe(
      'ipv6:2001:0db8:0000:0000::/64',
    );
    expect(
      identity.resolveClientNetwork(input('2001:0db8:0:0:ffff::abcd')),
    ).toBe('ipv6:2001:0db8:0000:0000::/64');
    expect(identity.resolveClientNetwork(input('fe80::1%eth0'))).toBe(
      'invalid-peer',
    );
  });

  it('selects the exact client across single and multiple trusted proxies', () => {
    process.env.TRUSTED_PROXY_ADDRESSES = '10.0.0.2,10.0.0.3';
    const identity = new PublicClientIdentityService();
    expect(
      identity.resolveClientNetwork(input('10.0.0.2', '198.51.100.9')),
    ).toBe('ipv4:198.51.100.9');
    expect(
      identity.resolveClientNetwork(
        input('10.0.0.2', '198.51.100.9, 10.0.0.3'),
      ),
    ).toBe('ipv4:198.51.100.9');
  });

  it('trusts changing proxy addresses only inside explicit IPv4 and IPv6 CIDRs', () => {
    process.env.TRUSTED_PROXY_ADDRESSES = '172.28.0.0/16,fd12:3456:789a::/64';
    const identity = new PublicClientIdentityService();
    expect(
      identity.resolveClientNetwork(
        input('172.28.0.17', '198.51.100.9, 172.28.0.1'),
      ),
    ).toBe('ipv4:198.51.100.9');
    expect(
      identity.resolveClientNetwork(
        input('172.28.99.231', '198.51.100.10, 172.28.0.1'),
      ),
    ).toBe('ipv4:198.51.100.10');
    expect(
      identity.resolveClientNetwork(
        input('fd12:3456:789a::20', '2001:db8:abcd:1::7'),
      ),
    ).toBe('ipv6:2001:0db8:abcd:0001::/64');
  });

  it('normalizes an IPv4-mapped IPv6 CIDR to its IPv4 prefix', () => {
    process.env.TRUSTED_PROXY_ADDRESSES = '::ffff:172.28.0.0/112';
    const identity = new PublicClientIdentityService();
    expect(
      identity.resolveClientNetwork(input('172.28.7.9', '198.51.100.9')),
    ).toBe('ipv4:198.51.100.9');
    expect(
      identity.resolveClientNetwork(input('172.29.7.9', '198.51.100.9')),
    ).toBe('ipv4:172.29.7.9');
    process.env.TRUSTED_PROXY_ADDRESSES = '::ffff:0:0/96';
    expect(() => new PublicClientIdentityService()).toThrow(
      'invalid or unsafe IP/CIDR',
    );
  });

  it('rejects malformed, zone-qualified, and globally open trusted ranges', () => {
    for (const unsafe of [
      'not-a-cidr',
      '172.28.0.0/99',
      'fe80::1%eth0',
      '0.0.0.0/0',
      '::/0',
    ]) {
      process.env.TRUSTED_PROXY_ADDRESSES = unsafe;
      expect(() => new PublicClientIdentityService()).toThrow(
        'invalid or unsafe IP/CIDR',
      );
    }
  });

  it('trusts no proxy by default and ignores forged XFF from an untrusted peer', () => {
    delete process.env.TRUSTED_PROXY_ADDRESSES;
    const identity = new PublicClientIdentityService();
    expect(
      identity.resolveClientNetwork(input('172.28.0.17', '198.51.100.9')),
    ).toBe('ipv4:172.28.0.17');
  });

  it('stops at the first untrusted hop and ignores spoofed XFF from peers', () => {
    process.env.TRUSTED_PROXY_ADDRESSES = '10.0.0.2';
    const identity = new PublicClientIdentityService();
    expect(
      identity.resolveClientNetwork(
        input('10.0.0.2', '198.51.100.9, 10.0.0.3'),
      ),
    ).toBe('ipv4:10.0.0.3');
    expect(
      identity.resolveClientNetwork(input('203.0.113.7', '198.51.100.9')),
    ).toBe('ipv4:203.0.113.7');
  });

  it('uses one fail-closed identity for missing or malformed trusted XFF', () => {
    process.env.TRUSTED_PROXY_ADDRESSES = '10.0.0.2';
    const identity = new PublicClientIdentityService();
    expect(identity.resolveClientNetwork(input('10.0.0.2'))).toBe(
      'invalid-forwarded-chain',
    );
    expect(identity.resolveClientNetwork(input('10.0.0.2', 'not-an-ip'))).toBe(
      'invalid-forwarded-chain',
    );
    expect(
      identity.resolveClientNetwork(input('10.0.0.2', 'fe80::1%eth0')),
    ).toBe('invalid-forwarded-chain');
  });

  it('requires a strong production/shared secret and exposes neither secret nor raw IP', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_HASH_SECRET;
    expect(() => new PublicClientIdentityService()).toThrow(
      'RATE_LIMIT_HASH_SECRET is required',
    );
    process.env.RATE_LIMIT_HASH_SECRET = 'short';
    expect(() => new PublicClientIdentityService()).toThrow(
      'at least 32 bytes',
    );
    process.env.RATE_LIMIT_HASH_SECRET = secret;
    const identity = new PublicClientIdentityService(),
      digest = identity.identify(input('192.0.2.99'), ['hapcheon', trip]),
      captured: string[] = [],
      store = {
        consume: jest.fn(async (key: string) => {
          captured.push(key);
          return { allowed: true, retryAfterSeconds: 0 };
        }),
      };
    await store.consume(`QR_VISIT:${digest}`);
    expect(captured.join('|')).not.toContain('192.0.2.99');
    expect(captured.join('|')).not.toContain(secret);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
