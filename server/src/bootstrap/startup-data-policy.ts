export const explicitBootstrapSeedApproved = () =>
  process.env.BOOTSTRAP_SEED_ENTRYPOINT === 'cli' &&
  process.env.BOOTSTRAP_SEED_APPROVED === 'true';

export const automaticBootstrapSeedEnabled = () =>
  ['development', 'test'].includes(process.env.NODE_ENV || '') ||
  explicitBootstrapSeedApproved();

export function requireExplicitBootstrapSeed(argv = process.argv) {
  if (
    !argv.includes('--apply') ||
    process.env.BOOTSTRAP_SEED_APPROVED !== 'true'
  )
    throw new Error(
      'Bootstrap seed requires --apply and BOOTSTRAP_SEED_APPROVED=true',
    );
  process.env.BOOTSTRAP_SEED_ENTRYPOINT = 'cli';
}
