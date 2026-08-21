import {
  fieldDemoReadiness,
  minimalFieldDemoTasks,
} from './field-demo-readiness';

describe('shared field-demo readiness', () => {
  const source = { sourceType: 'OFFICIAL', sourceUrl: 'https://example.test' };
  it('separates semantic, discovery, call, navigation, trip and action readiness', () => {
    const result = fieldDemoReadiness([
      {
        role: 'SCENIC',
        semanticReady: true,
        record: {
          entityUri: 'urn:ready',
          canonicalLabelKo: 'Ready',
          entityType: 'ATTRACTION',
          category: 'TOURISM_NATURE',
          source,
          telephone: '1',
          latitude: 36,
          longitude: 127,
          actions: { call: { phone: '1' }, navigate: { latitude: 36, longitude: 127 } },
        },
      },
      {
        role: 'FOOD',
        semanticReady: false,
        record: {
          entityUri: 'urn:blocked',
          canonicalLabelKo: 'Blocked',
          entityType: 'RESTAURANT',
          category: 'FOOD',
          source,
          actions: {},
        },
      },
    ]);
    expect(result.matrix[0].states.ACTION_READY.ready).toBe(true);
    expect(result.matrix[1]).toMatchObject({
      priority: 'DEMO_CRITICAL',
      blockers: [
        'EXKO/RDM 의미 정렬 확인 필요',
        '전화 확인 필요',
        '좌표 승인 필요',
      ],
    });
    const tasks = minimalFieldDemoTasks('x', result.matrix);
    expect(tasks.map((x) => x.taskId)).toEqual([
      'field-demo:x:COORDINATE_APPROVAL',
      'field-demo:x:PHONE_VERIFICATION',
      'field-demo:x:SEMANTIC_ALIGNMENT',
    ]);
    expect(tasks.every((x) => x.priority === 'DEMO_CRITICAL')).toBe(true);
  });
});
