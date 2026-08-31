import { ForbiddenException } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { HAPCHEON_MASTER_DATA } from '../regions/hapcheon/master-data';
import { isDiscoveryEligible } from '../concierge/discovery-eligibility';

const manager = {
  sub: 'manager-h',
  username: 'hapcheon-manager',
  role: 'REGIONAL_MANAGER' as const,
  regions: ['hapcheon'],
};
function doc(value: any) {
  return Object.assign(value, {
    toObject() {
      const { save, toObject, ...plain } = this;
      return structuredClone(plain);
    },
    async save() {
      return this;
    },
  });
}
function model(initial: any[] = []) {
  const rows = initial.map((x) => doc(structuredClone(x)));
  const matches = (row: any, q: any) =>
    Object.entries(q).every(([key, value]: any) =>
      value?.$nin ? !value.$nin.includes(row[key]) : row[key] === value,
    );
  return {
    rows,
    findOne: (q: any) => Promise.resolve(rows.find((x) => matches(x, q))),
    find: (q: any) => ({
      lean: async () =>
        rows.filter((x) => matches(x, q)).map((x) => x.toObject()),
    }),
    create: async (x: any) => {
      const row = doc(structuredClone(x));
      rows.push(row);
      return row;
    },
    updateOne: jest.fn(async (q: any, update: any, options: any) => {
      if (!rows.some((x) => matches(x, q)) && options?.upsert)
        rows.push(doc(structuredClone(update.$setOnInsert)));
      return {};
    }),
  };
}
function fixtures() {
  return [
    {
      id: 'core-mountain',
      regionId: 'hapcheon',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hwangmaesanCountyPark',
      displayName: '황매산',
      expectedCategory: 'TOURISM_NATURE',
      aliases: [],
      active: true,
      auditTrail: [],
    },
    {
      id: 'core-studio',
      regionId: 'hapcheon',
      canonicalEntityId:
        'https://hapcheon.example/ontology#hapcheonVideoThemePark',
      displayName: '합천 영상테마파크',
      expectedCategory: 'TOURISM_NATURE',
      aliases: ['합천 영상테마파크'],
      active: true,
      auditTrail: [],
    },
    {
      id: 'core-falls',
      regionId: 'hapcheon',
      displayName: '황계폭포',
      expectedCategory: 'TOURISM_NATURE',
      aliases: [],
      active: true,
      auditTrail: [],
    },
    {
      id: 'core-geum',
      regionId: 'hapcheon',
      displayName: '금성산',
      expectedCategory: 'TOURISM_NATURE',
      aliases: [],
      active: true,
      auditTrail: [],
    },
  ];
}
function regional(records: any[]) {
  const rows = records.map((x) => ({
    id: `rd-${x.canonicalId}`,
    regionId: 'hapcheon',
    canonicalEntityId: x.entityUri,
    displayName: x.canonicalLabelKo,
    aliases: x.alternateLabels,
    entityType: x.entityType,
    category: x.category,
    latitude: x.latitude,
    longitude: x.longitude,
    verificationStatus: 'VERIFIED',
    lifecycleStatus: 'ACTIVE',
    source: x.source,
    auditTrail: [],
  }));
  return {
    rows,
    list: jest.fn(async ({ regionId }: any) =>
      rows.filter((x) => x.regionId === regionId),
    ),
    effectiveDataset: jest.fn(async (regionId: string) => ({
      regionId,
      records,
    })),
    approveCoreCoverageFix: jest.fn(
      async (_regionId: string, id: string, facts: any, audit: any) => {
        const row = rows.find((x) => x.canonicalEntityId === id);
        Object.assign(row, facts);
        row.auditTrail.push({
          action: 'CORE_COVERAGE_FIX_APPROVED',
          actorId: audit.actorId,
        });
        const entity = records.find((x) => x.entityUri === id);
        if (facts.category) entity.category = facts.category;
        if (facts.aliases) entity.alternateLabels = facts.aliases;
        return row;
      },
    ),
  };
}

describe('Regional Copilot Phase 1.1 core destination coverage', () => {
  it('audits the four real Hapcheon destinations from operational data without inventing entities', async () => {
    const candidates = model(),
      cores = model(fixtures()),
      rdm = regional(HAPCHEON_MASTER_DATA as any),
      service = new CopilotService(candidates as any, rdm as any, cores as any);
    const health = await service.coreHealth(manager, 'hapcheon');
    expect(health).toMatchObject({
      total: 4,
      healthy: 2,
      warning: 0,
      critical: 2,
    });
    expect(
      health.items.find((x: any) => x.core.displayName === '황매산'),
    ).toMatchObject({
      health: 'HEALTHY',
      evidence: {
        verificationStatus: 'VERIFIED',
        lifecycleStatus: 'ACTIVE',
        coordinatesAvailable: true,
        discoveryEligible: true,
      },
    });
    expect(
      health.items.find((x: any) => x.core.displayName === '합천 영상테마파크'),
    ).toMatchObject({
      health: 'HEALTHY',
      evidence: {
        canonicalMatch: { label: '합천 영상테마파크' },
        aliasResolved: true,
      },
    });
    for (const name of ['황계폭포', '금성산'])
      expect(
        health.items.find((x: any) => x.core.displayName === name),
      ).toMatchObject({ health: 'CRITICAL', evidence: { searchOnly: false } });
  });
  it('adds one deduplicated urgent task for every unhealthy core destination', async () => {
    const service = new CopilotService(
      model() as any,
      regional(HAPCHEON_MASTER_DATA as any) as any,
      model(fixtures()) as any,
    );
    const tasks = await service.queue(manager, 'hapcheon');
    expect(
      tasks
        .filter((x: any) => x.type === 'CORE_DESTINATION_COVERAGE_GAP')
        .map((x: any) => x.taskId),
    ).toEqual(['core:core-falls', 'core:core-geum']);
    expect(new Set(tasks.map((x: any) => x.taskId)).size).toBe(tasks.length);
  });
  it('requires manager confirmation, applies only the proposed category fix, and records both audits', async () => {
    const record: any = {
      ...HAPCHEON_MASTER_DATA.find((x) =>
        x.entityUri.endsWith('#hwangmaesanCountyPark'),
      ),
      category: 'OTHER',
      entityType: 'OTHER',
    };
    const rdm = regional([record]),
      cores = model([fixtures()[0]]),
      service = new CopilotService(model() as any, rdm as any, cores as any);
    expect((await service.coreDetail(manager, 'core-mountain'))?.health).toBe(
      'WARNING',
    );
    await expect(
      service.approveCoreFix(manager, 'core-mountain', 'CATEGORY', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rdm.approveCoreCoverageFix).not.toHaveBeenCalled();
    const fixed: any = await service.approveCoreFix(
      manager,
      'core-mountain',
      'CATEGORY',
      true,
    );
    expect(rdm.approveCoreCoverageFix).toHaveBeenCalledWith(
      'hapcheon',
      record.entityUri,
      { category: 'TOURISM_NATURE' },
      { actorId: 'manager-h' },
    );
    expect(fixed.health).toBe('HEALTHY');
    expect(cores.rows[0].auditTrail.at(-1).action).toBe(
      'CORE_COVERAGE_FIX_APPROVED',
    );
  });
  it('enforces assigned-region access for reads and writes', async () => {
    const service = new CopilotService(
      model() as any,
      regional([]) as any,
      model(fixtures()) as any,
    );
    await expect(service.coreHealth(manager, 'okcheon')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.removeCore(
        { ...manager, role: 'VIEWER' as const },
        'core-falls',
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('designates and removes metadata only after explicit approval with an audit trail', async () => {
    const cores = model(),
      service = new CopilotService(
        model() as any,
        regional([]) as any,
        cores as any,
      ),
      input = {
        regionId: 'hapcheon',
        displayName: '테스트 명소',
        expectedCategory: 'TOURISM_NATURE',
      };
    await expect(
      service.designateCore(manager, input, false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.designateCore(manager, input, true);
    expect(cores.rows[0].auditTrail[0]).toMatchObject({
      action: 'CORE_DESTINATION_DESIGNATED',
      actorId: 'manager-h',
    });
    await service.removeCore(manager, cores.rows[0].id, true);
    expect(cores.rows[0]).toMatchObject({ active: false });
    expect(cores.rows[0].auditTrail.at(-1).action).toBe(
      'CORE_DESTINATION_REMOVED',
    );
  });
  it('diagnoses unverified, inactive, wrong-type, missing-name, search-only, and duplicate evidence', async () => {
    const base: any = {
        ...HAPCHEON_MASTER_DATA.find((x) =>
          x.entityUri.endsWith('#hwangmaesanCountyPark'),
        ),
      },
      rdm = regional([base]),
      cores = model([{ ...fixtures()[0], displayName: '방문자 이름' }]),
      candidates = model([
        {
          id: 'search-1',
          regionId: 'hapcheon',
          displayName: '검색 전용 명소',
          status: 'DISCOVERED',
        },
      ]),
      service = new CopilotService(candidates as any, rdm as any, cores as any);
    rdm.rows[0].verificationStatus = 'UNVERIFIED';
    rdm.rows[0].lifecycleStatus = 'NEEDS_VERIFICATION';
    base.entityType = 'OTHER';
    base.category = 'OTHER';
    const broken: any = await service.coreDetail(manager, 'core-mountain');
    expect(broken.health).toBe('WARNING');
    expect(broken.reasons.join(' ')).toMatch(
      /검증 상태|운영 상태|카테고리|대표 이름/,
    );
    cores.rows.push(
      doc({
        id: 'search-only',
        regionId: 'hapcheon',
        displayName: '검색 전용 명소',
        expectedCategory: 'TOURISM_NATURE',
        aliases: [],
        active: true,
        auditTrail: [],
      }),
    );
    const searchOnly: any = await service.coreDetail(manager, 'search-only');
    expect(searchOnly).toMatchObject({
      health: 'CRITICAL',
      evidence: { searchOnly: true },
      recommendedAction: '후보 검토',
    });
    const duplicate = {
      ...base,
      entityUri: 'urn:duplicate',
      canonicalLabelKo: '방문자 이름',
      alternateLabels: [],
      runtimeDataStatus: 'VERIFIED',
      entityType: 'ATTRACTION',
      category: 'TOURISM_NATURE',
    };
    base.canonicalLabelKo = '방문자 이름';
    base.alternateLabels = [];
    base.runtimeDataStatus = 'VERIFIED';
    base.entityType = 'ATTRACTION';
    base.category = 'TOURISM_NATURE';
    rdm.effectiveDataset.mockResolvedValue({
      regionId: 'hapcheon',
      records: [base, duplicate],
    });
    rdm.rows[0].verificationStatus = 'VERIFIED';
    rdm.rows[0].lifecycleStatus = 'ACTIVE';
    expect(
      (await service.coreDetail(manager, 'core-mountain'))?.evidence
        .duplicateCount,
    ).toBe(1);
  });
  it('never lets Core metadata bypass contextual type eligibility or force ranking', () => {
    const coreNatural = {
      entityType: 'ATTRACTION',
      category: 'TOURISM_NATURE',
    };
    expect(isDiscoveryEligible(coreNatural, 'TOURISM_NATURE')).toBe(true);
    expect(isDiscoveryEligible(coreNatural, 'ACTIVITY')).toBe(false);
    expect(isDiscoveryEligible(coreNatural, 'CAFE')).toBe(false);
  });
});
