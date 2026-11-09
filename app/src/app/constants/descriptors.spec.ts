import { descriptorKey } from './descriptors';

describe('descriptors', () => {
  it('descriptorKey should translate known descriptors and leave free text alone', () => {
    expect(descriptorKey('fruite')).toBe('descriptors.fruite');
    expect(descriptorKey('bouchonne')).toBe('descriptors.bouchonne');
    expect(descriptorKey('notes de cassis')).toBeNull();
  });
});
