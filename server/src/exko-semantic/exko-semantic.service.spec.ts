import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExkoSemanticAdapter } from './exko-semantic.service';
import { OKCHEON_MASTER_DATA } from '../regions/okcheon/master-data';
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
    expect(enabled.getAlignment(exko + '카페Lowful','hapcheon')[0].status).toBe(
      'POSSIBLE',
    );
  });
  it.each(['gajo', 'muan', 'gyeryong', 'daejeon-junggu'])(
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

describe('EXKO Okcheon cultural subgraph', () => {
  it('has bounded, fully sourced coverage and six exact RDM alignments', () => {
    const graph = enabled.getRegionalSubgraph('okcheon');
    expect(graph.size).toEqual({ entities: 13, edges: 20 });
    expect(graph.entities.every((x: any) => x.regionId === 'okcheon')).toBe(
      true,
    );
    expect(
      graph.edges.every((x: any) => x.reason && x.provenance?.sourceUrl),
    ).toBe(true);
    const diagnostics = enabled.semanticDiagnostics(
      'okcheon',
      OKCHEON_MASTER_DATA,
    );
    expect(diagnostics.alignedRdmEntities).toHaveLength(6);
    expect(diagnostics.semanticNodesWithoutRdm).toHaveLength(7);
    expect(diagnostics.brokenAlignments).toEqual([]);
    expect(diagnostics.unsupportedRelationships).toEqual([]);
    expect(diagnostics.provenanceCoverage).toBe(1);
  });
  it('traverses person to canonical cultural places with explicit reasons', () => {
    const result: any = enabled.semanticJourney(
      'okcheon',
      '정지용 시인과 관련된 곳을 둘러보고 옥천다운 점심도 먹고 싶어요.',
      OKCHEON_MASTER_DATA,
    );
    expect(result.concepts.map((x: any) => x.label)).toEqual(
      expect.arrayContaining(['정지용', '옥천구읍', '생선국수', '도리뱅뱅이']),
    );
    expect(result.itinerary.map((x: any) => x.programLabel)).toEqual([
      '정지용 생가',
      '정지용문학관',
      '대박집',
    ]);
    expect(result.itinerary.every((x: any) => x.semanticReasons.length)).toBe(
      true,
    );
    expect(result.visitorExplanation).toContain('정지용 시인의 흔적');
    expect(result.itinerary[0].actions).toEqual({
      detail: expect.any(Object),
    });
  });
  it('keeps the old-town concept non-operational and culture-only', () => {
    const result: any = enabled.semanticJourney(
      'okcheon',
      '옥천구읍에서 문화적인 곳만 둘러보고 싶어요.',
      OKCHEON_MASTER_DATA,
    );
    expect(result.concepts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '옥천구읍', type: 'PLACE_CONCEPT' }),
      ]),
    );
    expect(result.itinerary.map((x: any) => x.programLabel)).toEqual([
      '정지용 생가',
      '정지용문학관',
      '육영수 생가',
      '옥천전통문화체험관',
    ]);
    expect(result.itinerary.map((x: any) => x.programLabel)).not.toContain(
      '옥천구읍',
    );
    expect(result.itinerary.some((x: any) => x.category === 'FOOD')).toBe(
      false,
    );
  });
  it('distinguishes food concepts from the one officially linked restaurant', () => {
    const result: any = enabled.semanticJourney(
      'okcheon',
      '옥천다운 음식은 뭐가 있고 어디서 먹을 수 있어?',
      OKCHEON_MASTER_DATA,
    );
    expect(
      result.concepts
        .filter((x: any) => x.type === 'FOOD_CONCEPT')
        .map((x: any) => x.label),
    ).toEqual(['생선국수', '도리뱅뱅이', '정지용밥상']);
    expect(result.itinerary.map((x: any) => x.programLabel)).toEqual([
      '대박집',
    ]);
    expect(result.itinerary[0].semanticReasons.join(' ')).toMatch(
      /생선국수|도리뱅뱅/,
    );
  });
  it('lets RDM reject semantic candidates and Roo narrow but never expand them', () => {
    const withoutMuseum = OKCHEON_MASTER_DATA.filter(
        (x) => !x.entityUri.endsWith('jeongJiyongLiteratureMuseum'),
      ),
      safe: any = enabled.semanticJourney(
        'okcheon',
        '정지용 시인과 관련된 곳',
        withoutMuseum,
      );
    expect(safe.itinerary.map((x: any) => x.programLabel)).not.toContain(
      '정지용문학관',
    );
    expect(safe.rdmRejected).toContain(
      'https://okcheon.example/ontology#jeongJiyongLiteratureMuseum',
    );
    const rain: any = enabled.semanticJourney(
      'okcheon',
      '옥천구읍 문화 장소',
      OKCHEON_MASTER_DATA,
      { weather: '비', elderly: true, remainingMinutes: 120 },
    );
    expect(rain.itinerary.map((x: any) => x.programLabel)).toEqual([
      '정지용문학관',
      '옥천전통문화체험관',
    ]);
    expect(rain.rooDecisions.join(' ')).toMatch(/INDOOR|접근성|120/);
  });
  it('keeps Okcheon and Hapcheon traversal byte-isolated', () => {
    const hapcheonBefore = JSON.stringify(
      enabled.getRegionalSubgraph('hapcheon'),
    );
    const okcheon = enabled.getSemanticNeighborhood(
      exko + '정지용',
      'okcheon',
      2,
    );
    expect(JSON.stringify(okcheon)).not.toContain('합천');
    expect(JSON.stringify(okcheon)).not.toContain('스마일펜션');
    expect(JSON.stringify(enabled.getRegionalSubgraph('hapcheon'))).toBe(
      hapcheonBefore,
    );
    expect(
      enabled.semanticJourney('hapcheon', '정지용', OKCHEON_MASTER_DATA)
        .itinerary,
    ).toEqual([]);
  });
});
