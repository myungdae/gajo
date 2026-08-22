import { snapshotRegions, unchangedRegions } from './cross-region-snapshot';

describe('CROSS_REGION_NON_INTERFERENCE snapshot harness', () => {
  const state: Record<string, any> = {
    hapcheon: { rdm: ['H'], core: ['HC'], queue: [], semantic: ['HS'] },
    gajo: { rdm: ['G'], core: ['GC'], queue: [], semantic: ['GS'] },
    okcheon: { rdm: ['O'], core: ['OC'], queue: [], semantic: ['OS'] },
  };
  const resources = {
    rdm: (r: string) => state[r].rdm,
    core: (r: string) => state[r].core,
    queue: (r: string) => state[r].queue,
    semantic: (r: string) => state[r].semantic,
  };
  it.each([
    ['okcheon', ['hapcheon', 'gajo']],
    ['hapcheon', ['okcheon', 'gajo']],
    ['gajo', ['okcheon', 'hapcheon']],
  ] as const)('keeps reverse-direction snapshots unchanged for %s mutation', (changed, protectedRegions) => {
    const before = snapshotRegions(Object.keys(state), resources);
    state[changed].queue.push(`change-${changed}`);
    const after = snapshotRegions(Object.keys(state), resources);
    expect(() => unchangedRegions(before, after, protectedRegions)).not.toThrow();
    state[changed].queue.pop();
  });
});

