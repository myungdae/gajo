import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExkoSemanticAdapter } from './exko-semantic.service';
const enabled = new ExkoSemanticAdapter({
    get: (_key: string, fallback: string) => 'true' || fallback,
  } as any),
  disabled = new ExkoSemanticAdapter({
    get: (_key: string, fallback: string) => fallback,
  } as any);
const exko = 'http://sight.eventpool.kr/resource/';
describe('ExkoSemanticAdapter Hapcheon pilot', () => {
  it('keeps the copied RDF byte-identical to the recorded checksum', () => {
    const bytes = readFileSync(
      join(process.cwd(), 'semantic/exko/sight-copy.rdf'),
    );
    expect(createHash('sha256').update(bytes).digest('hex').toUpperCase()).toBe(
      '9FC6DB71857448B4047F18B4E1D6A2500C0226C0AC8CD426C96021541372FFF9',
    );
  });
  it('exposes the generated inventory and bounded subgraph', () => {
    expect(enabled.inventory().counts).toMatchObject({
      classes: 71,
      objectProperties: 154,
      datatypeProperties: 16,
      entities: 1564,
    });
    expect(enabled.getHapcheonSubgraph('hapcheon').size).toEqual({
      entities: 30,
      edges: 98,
    });
  });
  it('preserves Smile Pension to Lowful as entity relations and inverse traversal', () => {
    const relations = enabled.getRelatedEntities(
      exko + '합천호_스마일펜션',
      'hapcheon',
    );
    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicate: exko + '숙박_여행인프라',
          relatedUri: exko + '카페_로우풀',
        }),
      ]),
    );
    expect(
      enabled.getRelatedEntities(exko + '카페_로우풀', 'hapcheon'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relatedUri: exko + '합천호_스마일펜션' }),
      ]),
    );
    expect(enabled.getInverseRelations(exko + '테마여행_관광명소')).toContain(
      exko + '관광명소_테마여행',
    );
  });
  it('aligns only reviewed mappings and leaves possible duplicates non-operational', () => {
    const result = enabled.semanticCandidates(
      'hapcheon',
      'https://hapcheon.example/ontology#hapcheonLakeSmilePension',
    );
    expect(result).toMatchObject({
      resolved: true,
      alignmentStatus: 'HIGH_CONFIDENCE',
    });
    expect(result.regionalEntityIds).toContain('urn:regional:hapcheon:lowful');
    expect(enabled.getAlignment(exko + '카페Lowful')[0].status).toBe(
      'POSSIBLE',
    );
  });
  it.each(['gajo', 'okcheon', 'muan', 'gyeryong', 'daejeon-junggu'])(
    'is disabled in %s',
    (region) => {
      expect(enabled.getHapcheonSubgraph(region).size.entities).toBe(0);
      expect(
        enabled.semanticCandidates(region, 'anything').regionalEntityIds,
      ).toEqual([]);
    },
  );
  it('rolls back completely when the feature flag is off', () =>
    expect(disabled.getHapcheonSubgraph('hapcheon').size.entities).toBe(0));
});
