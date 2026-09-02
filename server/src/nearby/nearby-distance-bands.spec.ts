import {
  distanceBandsForRadius,
  selectDistanceBandResults,
} from './nearby.service';

const fixture = (id: string, distanceMeters: number) => ({
  id,
  provider: 'KAKAO',
  providerPlaceId: id,
  distanceMeters,
});
const distances = [
  1000, 8000, 12000, 18000, 22000, 28000, 32000, 38000, 42000, 49000, 51000,
];
const fixtures = distances.map((distance) =>
  fixture(`provider-${distance}`, distance),
);

describe('explicit nearby distance-band selection', () => {
  it.each([
    [20000, [1000, 8000, 12000, 18000]],
    [30000, [1000, 8000, 12000, 18000, 22000, 28000]],
    [40000, [1000, 8000, 12000, 18000, 22000, 28000, 32000, 38000]],
    [
      50000,
      [1000, 8000, 12000, 18000, 22000, 28000, 32000, 38000, 42000, 49000],
    ],
  ] as const)(
    '%ikm includes every populated active band and excludes farther fixtures',
    (radius, expected) => {
      const selection = selectDistanceBandResults(fixtures, radius);
      expect(selection.results.map((row) => row.distanceMeters)).toEqual(
        expected,
      );
      expect(selection.bands).toHaveLength(radius / 10000);
    },
  );

  it('keeps outer samples visible when more than 30 near places exist', () => {
    const denseNear = Array.from({ length: 40 }, (_, index) =>
      fixture(`near-${index}`, 100 + index),
    );
    const selection = selectDistanceBandResults(
      [...denseNear, ...fixtures],
      50000,
    );
    expect(selection.results).toHaveLength(30);
    for (const id of [
      '10000-20000',
      '20000-30000',
      '30000-40000',
      '40000-50000',
    ])
      expect(selection.results.some((row) => row.distanceBandId === id)).toBe(
        true,
      );
  });

  it('sorts within each band and deterministically reallocates empty quota', () => {
    const input = [
      fixture('far-b', 49000),
      fixture('near-b', 8000),
      fixture('far-a', 42000),
      fixture('near-a', 1000),
    ];
    const first = selectDistanceBandResults(input, 50000),
      second = selectDistanceBandResults([...input].reverse(), 50000);
    expect(first.results.map((row) => row.providerPlaceId)).toEqual([
      'near-a',
      'near-b',
      'far-a',
      'far-b',
    ]);
    expect(second.results.map((row) => row.providerPlaceId)).toEqual(
      first.results.map((row) => row.providerPlaceId),
    );
    expect(
      first.bands
        .filter((band) => band.resultCount === 0)
        .map((band) => band.id),
    ).toEqual(['10000-20000', '20000-30000', '30000-40000']);
  });

  it('deduplicates provider identity before quota allocation', () => {
    const selection = selectDistanceBandResults(
      [fixture('same', 1000), fixture('same', 12000), fixture('other', 18000)],
      20000,
    );
    expect(selection.results.map((row) => row.providerPlaceId)).toEqual([
      'same',
      'other',
    ]);
  });

  it('defines common region-neutral labels for every selectable expanded radius', () => {
    expect(distanceBandsForRadius(50000).map((band) => band.label)).toEqual([
      '가까운 곳',
      '10~20km 떨어진 곳',
      '20~30km 떨어진 곳',
      '30~40km 떨어진 곳',
      '40~50km 떨어진 곳',
    ]);
  });
});
