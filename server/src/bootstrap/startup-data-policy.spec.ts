import {
  automaticBootstrapSeedEnabled,
  explicitBootstrapSeedApproved,
  requireExplicitBootstrapSeed,
} from './startup-data-policy';

describe('startup data policy', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('keeps missing, production and unknown NODE_ENV read-only', () => {
    for (const nodeEnv of [undefined, 'production', 'staging', 'typo']) {
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
      delete process.env.BOOTSTRAP_SEED_ENTRYPOINT;
      delete process.env.BOOTSTRAP_SEED_APPROVED;
      expect(automaticBootstrapSeedEnabled()).toBe(false);
    }
  });

  it('allows development and test bootstrap fixtures', () => {
    process.env.NODE_ENV = 'test';
    expect(automaticBootstrapSeedEnabled()).toBe(true);
  });

  it('fails closed unless the seed CLI has both approval controls', () => {
    process.env.NODE_ENV = 'production';
    process.env.BOOTSTRAP_SEED_APPROVED = 'true';
    expect(() => requireExplicitBootstrapSeed(['node', 'seed'])).toThrow(
      'requires --apply',
    );
    delete process.env.BOOTSTRAP_SEED_APPROVED;
    expect(() =>
      requireExplicitBootstrapSeed(['node', 'seed', '--apply']),
    ).toThrow('requires --apply');
    process.env.BOOTSTRAP_SEED_APPROVED = 'true';
    requireExplicitBootstrapSeed(['node', 'seed', '--apply']);
    expect(explicitBootstrapSeedApproved()).toBe(true);
    expect(automaticBootstrapSeedEnabled()).toBe(true);
  });
});
