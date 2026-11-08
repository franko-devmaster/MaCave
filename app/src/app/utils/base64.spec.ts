import { arrayBufferToBase64, base64ToArrayBuffer } from './base64';

describe('base64', () => {
  it('arrayBufferToBase64 should encode bytes', () => {
    expect(arrayBufferToBase64(new TextEncoder().encode('ABC').buffer as ArrayBuffer)).toBe('QUJD');
  });

  it('round trip should preserve a buffer larger than one chunk', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);

    const decoded = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(bytes.buffer)));

    expect(decoded).toEqual(bytes);
  });
});
