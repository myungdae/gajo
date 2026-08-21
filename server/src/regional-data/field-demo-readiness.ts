export type DemoReadinessState =
  | 'SEMANTIC_READY'
  | 'DISCOVERY_READY'
  | 'CALL_READY'
  | 'NAVIGATION_READY'
  | 'TRIP_READY'
  | 'ACTION_READY';

const labels: Record<DemoReadinessState, string> = {
  SEMANTIC_READY: '의미 연결',
  DISCOVERY_READY: '탐색',
  CALL_READY: '전화',
  NAVIGATION_READY: '길찾기',
  TRIP_READY: '내 여행',
  ACTION_READY: '현장 행동',
};

export function fieldDemoReadiness(
  selected: readonly { role: string; record: any; semanticReady: boolean }[],
) {
  const matrix = selected.map(({ role, record, semanticReady }) => {
    const isConcept =
        record.entityType === 'AREA' || record.category === 'PLACE_CONCEPT',
      discoveryReady = Boolean(record.source),
      callReady = Boolean(record.actions?.call && record.telephone),
      navigationReady = Boolean(
        record.actions?.navigate &&
          Number.isFinite(record.latitude) &&
          Number.isFinite(record.longitude),
      ),
      tripReady = !isConcept && discoveryReady,
      actionReady = callReady || navigationReady,
      values: Record<DemoReadinessState, boolean> = {
        SEMANTIC_READY: semanticReady,
        DISCOVERY_READY: discoveryReady,
        CALL_READY: callReady,
        NAVIGATION_READY: navigationReady,
        TRIP_READY: tripReady,
        ACTION_READY: actionReady,
      },
      blockers = [
        ...(!semanticReady ? ['EXKO/RDM 의미 정렬 확인 필요'] : []),
        ...(!discoveryReady ? ['공개 근거 확인 필요'] : []),
        ...(!isConcept && !callReady ? ['전화 확인 필요'] : []),
        ...(!isConcept && !navigationReady ? ['좌표 승인 필요'] : []),
      ];
    return {
      canonicalEntityId: record.entityUri,
      displayName: record.canonicalLabelKo,
      role,
      priority: 'DEMO_CRITICAL' as const,
      states: Object.fromEntries(
        Object.entries(values).map(([state, ready]) => [
          state,
          { ready, label: labels[state as DemoReadinessState] },
        ]),
      ),
      blockers,
      actionsAvailable: [
        ...(callReady ? ['CALL'] : []),
        ...(navigationReady ? ['NAVIGATE'] : []),
        ...(tripReady ? ['SAVE_TO_TRIP'] : []),
      ],
      actionsAfterApproval: [
        ...(!callReady && !isConcept ? ['CALL'] : []),
        ...(!navigationReady && !isConcept ? ['NAVIGATE'] : []),
      ],
    };
  });
  const roles = [...new Set(matrix.map((x) => x.role))];
  const summary = roles.map((role) => {
    const rows = matrix.filter((x) => x.role === role);
    return {
      role,
      total: rows.length,
      actionReady: rows.filter((x) => x.states.ACTION_READY.ready).length,
    };
  });
  return { matrix, summary };
}

export function minimalFieldDemoTasks(regionId: string, matrix: any[]) {
  const groups = [
    ['COORDINATE_APPROVAL', '좌표 승인 필요', 'NAVIGATE'],
    ['PHONE_VERIFICATION', '전화 확인 필요', 'CALL'],
    ['SEMANTIC_ALIGNMENT', '의미 정렬 확인 필요', 'SEMANTIC'],
  ] as const;
  return groups
    .map(([type, label, action]) => {
      const entities = matrix.filter((row) =>
        type === 'COORDINATE_APPROVAL'
          ? !row.states.NAVIGATION_READY.ready && row.states.TRIP_READY.ready
          : type === 'PHONE_VERIFICATION'
            ? !row.states.CALL_READY.ready && row.states.TRIP_READY.ready
            : !row.states.SEMANTIC_READY.ready,
      );
      return {
        taskId: `field-demo:${regionId}:${type}`,
        regionId,
        type,
        priority: 'DEMO_CRITICAL',
        status: 'NEEDS_VERIFICATION',
        label,
        unlocks: action,
        entities: entities.map((x) => ({
          canonicalEntityId: x.canonicalEntityId,
          displayName: x.displayName,
        })),
      };
    })
    .filter((task) => task.entities.length);
}
