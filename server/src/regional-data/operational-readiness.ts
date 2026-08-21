export type OperationalClassification =
  | 'ACTION_READY'
  | 'DISCOVERY_READY'
  | 'NEEDS_COORDINATES'
  | 'NEEDS_OPERATIONAL_VERIFICATION'
  | 'INSUFFICIENT_EVIDENCE';
export type HoursEvidenceStatus =
  | 'VERIFIED_HOURS'
  | 'SOURCE_REPORTED_HOURS'
  | 'UNKNOWN_HOURS'
  | 'NOT_APPLICABLE';

export function operationalVerificationMatrix(
  records: readonly any[],
  rdmRows: readonly any[] = [],
) {
  return records.map((record) => {
    const row = rdmRows.find((x) => x.canonicalEntityId === record.entityUri),
      hasCoordinates =
        Number.isFinite(record.latitude) && Number.isFinite(record.longitude),
      navigationEligible = Boolean(hasCoordinates && record.actions?.navigate),
      callEligible = Boolean(record.telephone && record.actions?.call),
      placeConcept =
        record.entityType === 'AREA' || record.category === 'PLACE_CONCEPT',
      hoursStatus: HoursEvidenceStatus =
        row?.fieldEvidence?.hours?.status === 'APPROVED'
          ? 'VERIFIED_HOURS'
          : Array.isArray(record.operatingHours) && record.operatingHours.length
            ? 'SOURCE_REPORTED_HOURS'
            : record.entityType === 'ATTRACTION' &&
                record.category === 'TOURISM_NATURE'
              ? 'NOT_APPLICABLE'
              : 'UNKNOWN_HOURS',
      tripEligible = !placeConcept && Boolean(record.source),
      missingFields = [
        ...(!record.address ? ['address'] : []),
        ...(!hasCoordinates && !placeConcept ? ['coordinates'] : []),
        ...(!record.telephone && !placeConcept ? ['phone'] : []),
        ...(hoursStatus === 'UNKNOWN_HOURS' ? ['hours'] : []),
        ...(!record.website && !placeConcept ? ['website'] : []),
        ...(!record.parking && !placeConcept ? ['parking'] : []),
        ...(!record.accessibility && !placeConcept ? ['accessibility'] : []),
      ],
      classification: OperationalClassification = placeConcept
        ? 'DISCOVERY_READY'
        : navigationEligible
          ? 'ACTION_READY'
          : record.address
            ? 'NEEDS_COORDINATES'
            : record.source
              ? 'NEEDS_OPERATIONAL_VERIFICATION'
              : 'INSUFFICIENT_EVIDENCE';
    return {
      canonicalEntityId: record.entityUri,
      displayName: record.canonicalLabelKo,
      category: record.category,
      entityType: record.entityType,
      isOfficialScenic: /옥천\s*[0-9]?경/.test(record.description || ''),
      currentRdmStatus: row?.verificationStatus || record.runtimeDataStatus,
      lifecycleStatus: row?.lifecycleStatus || 'BASELINE_ACTIVE',
      officialSource: record.source,
      address: record.address,
      coordinates: hasCoordinates
        ? { latitude: record.latitude, longitude: record.longitude }
        : undefined,
      phone: record.telephone,
      hours: record.operatingHours,
      hoursStatus,
      website: record.website,
      parking: record.parking,
      accessibility: record.accessibility,
      navigationEligible,
      callEligible,
      tripEligible,
      missingFields,
      verificationEvidence: {
        source: record.source,
        coordinateEvidence: navigationEligible ? record.source : undefined,
        fields: row?.fieldEvidence || {},
      },
      classification,
      recommendedManagerAction: placeConcept
        ? 'Keep non-operational; review relationships only'
        : !hasCoordinates
          ? 'Review geocoding candidates and approve one exact navigation point'
          : hoursStatus === 'UNKNOWN_HOURS'
            ? 'Verify current operating hours or mark not applicable'
            : 'Review remaining parking/accessibility and action facts',
    };
  });
}

export function operationalVerificationTasks(
  regionId: string,
  matrix: ReturnType<typeof operationalVerificationMatrix>,
) {
  const concrete = matrix.filter(
      (x) => x.entityType !== 'AREA' && x.category !== 'PLACE_CONCEPT',
    ),
    groups = [
      {
        type: 'MISSING_COORDINATES',
        entities: concrete.filter((x) => !x.coordinates),
        why: 'Distance, nearby ordering and navigation require an approved exact point.',
        action:
          'Compare official-address geocoding evidence and approve or reject the exact point.',
      },
      {
        type: 'PHONE_VERIFICATION',
        entities: concrete.filter((x) => x.phone),
        why: 'A call action reaches a real person and needs a current entity-appropriate number.',
        action:
          'Confirm the number belongs to this entity and approve call eligibility.',
      },
      {
        type: 'HOURS_VERIFICATION',
        entities: concrete.filter(
          (x) =>
            x.hoursStatus === 'UNKNOWN_HOURS' ||
            x.hoursStatus === 'SOURCE_REPORTED_HOURS',
        ),
        why: 'Open/closed and replanning claims require current hours evidence.',
        action:
          'Confirm current hours/closures or explicitly retain UNKNOWN/NOT_APPLICABLE.',
      },
      {
        type: 'PARKING_VERIFICATION',
        entities: concrete.filter((x) => !x.parking),
        why: 'Parking evidence matters for family and mobility-aware planning.',
        action:
          'Review an authoritative parking source; do not infer from imagery.',
      },
      {
        type: 'ACCESSIBILITY_VERIFICATION',
        entities: concrete.filter((x) => !x.accessibility),
        why: 'Mobility recommendations must not claim unsupported accessibility.',
        action:
          'Review an authoritative accessibility source or retain UNKNOWN.',
      },
    ];
  return groups
    .filter((x) => x.entities.length)
    .map((group) => ({
      taskId: `operational:${regionId}:${group.type}`,
      regionId,
      type: group.type,
      priority: group.type === 'MISSING_COORDINATES' ? 0 : 1,
      status: 'NEEDS_VERIFICATION',
      entities: group.entities.map((x) => ({
        canonicalEntityId: x.canonicalEntityId,
        displayName: x.displayName,
        missingFields: x.missingFields,
        evidence: x.verificationEvidence,
      })),
      reason: group.why,
      recommendedManagerAction: group.action,
    }));
}

export function operationalReadinessSummary(
  matrix: ReturnType<typeof operationalVerificationMatrix>,
) {
  const count = (fn: (x: (typeof matrix)[number]) => boolean) =>
    matrix.filter(fn).length;
  return {
    total: matrix.length,
    actionReady: count((x) => x.classification === 'ACTION_READY'),
    discoveryReady: count((x) =>
      ['DISCOVERY_READY', 'ACTION_READY', 'NEEDS_COORDINATES'].includes(
        x.classification,
      ),
    ),
    navigationReady: count((x) => x.navigationEligible),
    callReady: count((x) => x.callEligible),
    tripEligible: count((x) => x.tripEligible),
    coordinateCoverage: count((x) => Boolean(x.coordinates)),
    sourceReportedHours: count(
      (x) => x.hoursStatus === 'SOURCE_REPORTED_HOURS',
    ),
    notApplicableHours: count((x) => x.hoursStatus === 'NOT_APPLICABLE'),
    parkingCoverage: count((x) => Boolean(x.parking)),
    accessibilityCoverage: count((x) => Boolean(x.accessibility)),
  };
}
