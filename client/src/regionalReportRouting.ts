import { findRegionConfig, type RegionId } from "./regionConfig.ts";

export const regionalReportRegion = (value?: string | null) =>
  findRegionConfig(value);

export const canonicalRegionalReportPath = (regionId: RegionId) =>
  `/${regionId}/regional-report`;

export const reportScopeMatchesRoute = (
  routeRegionId: string | undefined,
  responseRegionId: string | undefined,
) =>
  Boolean(
    responseRegionId &&
      regionalReportRegion(responseRegionId) &&
      (!routeRegionId || routeRegionId === responseRegionId),
  );
