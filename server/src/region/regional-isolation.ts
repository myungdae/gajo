import { BadRequestException, ForbiddenException } from '@nestjs/common';

export function requireRegionId(regionId: unknown, operation: string): string {
  if (typeof regionId !== 'string' || !regionId.trim())
    throw new BadRequestException(`regionId is required for ${operation}`);
  return regionId.trim();
}

export function regionalIdentity(
  regionId: unknown,
  resourceId: unknown,
  resourceType: string,
) {
  const region = requireRegionId(regionId, resourceType);
  if (typeof resourceId !== 'string' || !resourceId.trim())
    throw new BadRequestException(`${resourceType} id is required`);
  return `${region}:${resourceType}:${resourceId.trim()}`;
}

export function assertRegionMatch(
  authoritativeRegionId: unknown,
  suppliedRegionId: unknown,
  resourceType: string,
) {
  const authoritative = requireRegionId(authoritativeRegionId, resourceType),
    supplied = requireRegionId(suppliedRegionId, resourceType);
  if (authoritative !== supplied)
    throw new ForbiddenException(`Cross-region ${resourceType} access denied`);
  return authoritative;
}

