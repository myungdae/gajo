import { OKCHEON_MASTER_DATA } from '../regions/okcheon/master-data';
import {
  operationalReadinessSummary,
  operationalVerificationMatrix,
  operationalVerificationTasks,
} from './operational-readiness';

describe('shared operational verification matrix', () => {
  const matrix = operationalVerificationMatrix(OKCHEON_MASTER_DATA);
  it('reports every Okcheon entity and preserves the manager boundary', () => {
    expect(matrix).toHaveLength(33);
    expect(
      matrix.every(
        (x) =>
          x.currentRdmStatus === 'PARTIAL' &&
          x.lifecycleStatus === 'BASELINE_ACTIVE',
      ),
    ).toBe(true);
    expect(matrix.find((x) => x.displayName === '옥천구읍')).toMatchObject({
      classification: 'DISCOVERY_READY',
      navigationEligible: false,
      callEligible: false,
      tripEligible: false,
    });
  });
  it('derives action readiness only from evidenced actions', () =>
    expect(operationalReadinessSummary(matrix)).toEqual({
      total: 33,
      actionReady: 1,
      discoveryReady: 30,
      navigationReady: 1,
      callReady: 14,
      tripEligible: 32,
      coordinateCoverage: 1,
      sourceReportedHours: 1,
      notApplicableHours: 6,
      parkingCoverage: 0,
      accessibilityCoverage: 0,
    }));
  it('creates five deduplicated region-scoped review batches instead of per-field task spam', () => {
    const tasks = operationalVerificationTasks('okcheon', matrix);
    expect(tasks.map((x) => x.type)).toEqual([
      'MISSING_COORDINATES',
      'PHONE_VERIFICATION',
      'HOURS_VERIFICATION',
      'PARKING_VERIFICATION',
      'ACCESSIBILITY_VERIFICATION',
    ]);
    expect(new Set(tasks.map((x) => x.taskId)).size).toBe(5);
    expect(
      tasks.every(
        (x) =>
          x.regionId === 'okcheon' &&
          x.entities.length > 0 &&
          x.recommendedManagerAction,
      ),
    ).toBe(true);
  });
  it('does not describe outdoor attractions as synthetic 24-hour businesses', () => {
    const outdoor = matrix.find((x) => x.displayName === '둔주봉 한반도지형')!;
    expect(outdoor.hours).toBeUndefined();
    expect(outdoor.hoursStatus).toBe('NOT_APPLICABLE');
  });
});
