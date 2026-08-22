import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  assertRegionMatch,
  regionalIdentity,
  requireRegionId,
} from './regional-isolation';

describe('Regional Isolation Contract', () => {
  it('fails closed instead of selecting an implicit region', () => {
    expect(() => requireRegionId(undefined, 'RDM read')).toThrow(
      BadRequestException,
    );
    expect(() => requireRegionId('', 'TripSession write')).toThrow(
      BadRequestException,
    );
  });
  it('uses composite regional identity and rejects cross-region access', () => {
    expect(regionalIdentity('okcheon', 'same-name', 'entity')).toBe(
      'okcheon:entity:same-name',
    );
    expect(regionalIdentity('gajo', 'same-name', 'entity')).not.toBe(
      regionalIdentity('okcheon', 'same-name', 'entity'),
    );
    expect(() => assertRegionMatch('okcheon', 'gajo', 'candidate')).toThrow(
      ForbiddenException,
    );
  });
});
