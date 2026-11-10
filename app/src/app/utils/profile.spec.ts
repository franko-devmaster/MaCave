import { ProfileOverride, TasteProfile } from '../models/tasting';
import { tastingInput } from '../testing/fixtures';
import { applyOverrides, axisOf, profileSignature } from './profile';

const PROFILE: TasteProfile = {
  id: 'current',
  summary: 'Des rouges de montagne.',
  axes: { fruit: 8, freshness: 6, spice: 7, power: 5, oak: 3 },
  favoriteGrapes: ['Cornalin', 'Merlot'],
  avoidPatterns: ['Chardonnay boisé', 'Rouges confiturés'],
  basedOnTastings: 6,
  generatedAt: '2026-11-01T00:00:00Z',
  sourceSignature: 'x',
};

function override(field: ProfileOverride['field'], userValue: string, date = '2026-11-02T00:00:00Z', id: string = crypto.randomUUID()): ProfileOverride {
  return { id, field, userValue, reason: '', date };
}

describe('profile utils', () => {
  it('applyOverrides should replace axes with the latest correction', () => {
    const profile = applyOverrides(PROFILE, [
      override('axis:freshness', '9', '2026-11-03T00:00:00Z'),
      override('axis:freshness', '4', '2026-11-02T00:00:00Z'),
    ]);

    expect(profile.axes.freshness).toBe(9);
    expect(profile.axes.fruit).toBe(8);
  });

  it('applyOverrides should ignore invalid axis values', () => {
    expect(applyOverrides(PROFILE, [override('axis:oak', '12')]).axes.oak).toBe(3);
  });

  it('applyOverrides should remove grapes and patterns regardless of case', () => {
    const profile = applyOverrides(PROFILE, [override('remove-grape', 'merlot'), override('remove-avoid', ' Rouges confiturés ')]);

    expect(profile.favoriteGrapes).toEqual(['Cornalin']);
    expect(profile.avoidPatterns).toEqual(['Chardonnay boisé']);
  });

  it('applyOverrides should leave a note without visible effect', () => {
    expect(applyOverrides(PROFILE, [override('note', "J'aime les rouges légers en été")])).toEqual(PROFILE);
  });

  it('axisOf should recognise only known axes', () => {
    expect(axisOf('axis:spice')).toBe('spice');
    expect(axisOf('note')).toBeNull();
  });

  it('profileSignature should change when a tasting or a correction changes, not with order', () => {
    const a = { ...tastingInput('w1'), id: 'a', date: '1' };
    const b = { ...tastingInput('w2'), id: 'b', date: '2' };
    const fix = override('note', 'x', '1', 'o1');

    const base = profileSignature([a, b], [fix]);

    expect(profileSignature([b, a], [fix])).toBe(base);
    expect(profileSignature([a, { ...b, score: 1 }], [fix])).not.toBe(base);
    expect(profileSignature([a, b], [])).not.toBe(base);
    expect(base.startsWith('2-')).toBe(true);
  });
});
