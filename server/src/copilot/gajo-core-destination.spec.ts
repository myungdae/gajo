import { INITIAL_CORE_DESTINATIONS } from './core-destination.config';
import { GAJO_MASTER_DATA } from '../regions/regional-candidate.registry';

describe('Gajo representative Core review preparation', () => {
  it('prepares Changpowon and Suseungdae for generic Core review without ranking semantics', () => {
    expect(INITIAL_CORE_DESTINATIONS.gajo).toEqual([
      expect.objectContaining({ displayName: '거창창포원', expectedCategory: 'TOURISM_NATURE', aliases: expect.arrayContaining(['창포원', '거창 창포원']) }),
      expect.objectContaining({ displayName: '수승대', expectedCategory: 'TOURISM_NATURE', aliases: expect.arrayContaining(['수승대관광지']) }),
    ]);
  });

  it.each(['거창창포원', '수승대'])('%s remains an unverified action-free review record', (label) => {
    const record = GAJO_MASTER_DATA.find((item) => item.canonicalLabelKo === label);
    expect(record).toMatchObject({ runtimeDataStatus: 'UNKNOWN', category: 'TOURISM_NATURE', entityType: 'ATTRACTION', actions: {} });
    expect(record?.latitude).toBeUndefined();
    expect(record?.longitude).toBeUndefined();
    expect(record?.telephone).toBeUndefined();
  });
});
