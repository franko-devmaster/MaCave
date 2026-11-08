import { fitWithin } from './photo.service';

describe('fitWithin', () => {
  it.each([
    [4032, 3024, { width: 1280, height: 960 }],
    [3024, 4032, { width: 960, height: 1280 }],
    [800, 600, { width: 800, height: 600 }],
    [1280, 1280, { width: 1280, height: 1280 }],
  ])('fitWithin(%s, %s) should give %o', (width, height, expected) => {
    expect(fitWithin(width, height, 1280)).toEqual(expected);
  });
});
