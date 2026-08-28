import {
  PARTNER_APPLICATION_FINGERPRINT_INDEX,
  PartnerSchema,
} from './partner.schema';

describe('partner application fingerprint index', () => {
  it('is a named partial unique index for string fingerprints only', () => {
    const definition = PartnerSchema.indexes().find(
      ([, options]) => options.name === PARTNER_APPLICATION_FINGERPRINT_INDEX,
    );
    expect(definition).toEqual([
      { applicationFingerprint: 1 },
      expect.objectContaining({
        name: 'uniq_partner_application_fingerprint_string',
        unique: true,
        partialFilterExpression: {
          applicationFingerprint: { $type: 'string' },
        },
      }),
    ]);
  });
});
