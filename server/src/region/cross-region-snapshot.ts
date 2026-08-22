export type RegionalSnapshot = Record<string, string>;

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

export function snapshotRegions(
  regions: readonly string[],
  resources: Record<string, (regionId: string) => unknown>,
): RegionalSnapshot {
  return Object.fromEntries(
    regions.flatMap((regionId) =>
      Object.entries(resources).map(([resourceType, read]) => [
        `${regionId}:${resourceType}`,
        stable(read(regionId)),
      ]),
    ),
  );
}

export function unchangedRegions(
  before: RegionalSnapshot,
  after: RegionalSnapshot,
  regions: readonly string[],
) {
  for (const regionId of regions)
    for (const [key, value] of Object.entries(before))
      if (key.startsWith(`${regionId}:`) && after[key] !== value)
        throw new Error(`Cross-region mutation detected: ${key}`);
}

