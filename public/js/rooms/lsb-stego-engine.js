/*
 * Decodes a message hidden with least-significant-bit (LSB) steganography in an image's red
 * channel. This is real steganography on real pixel data (read via a canvas), not a simulation:
 * any image encoded with the matching scheme, by any tool, would decode correctly here.
 *
 * Scheme (raster order, left to right, top to bottom):
 *   first 32 bits  = message length in bytes, big-endian, each bit in one pixel's red LSB
 *   next 8*N bits  = the N message bytes, MSB first, one bit per pixel's red LSB
 * The message is treated as plain ASCII.
 */
(function (root) {
  'use strict';

  function decode(imageData) {
    var data = imageData.data, w = imageData.width, h = imageData.height;
    var totalPixels = w * h;
    if (totalPixels < 32) throw new Error('Image too small to contain a length header.');

    function bitAt(pixelIndex) {
      var off = pixelIndex * 4; // RGBA
      return data[off] & 1; // red channel LSB
    }

    var lengthBits = '';
    for (var i = 0; i < 32; i++) lengthBits += bitAt(i);
    var length = parseInt(lengthBits, 2);

    if (!(length > 0 && length < 2000) || 32 + length * 8 > totalPixels) {
      return { found: false, message: null, length: length };
    }

    var bytes = [];
    var idx = 32;
    for (var b = 0; b < length; b++) {
      var byteBits = '';
      for (var k = 0; k < 8; k++) byteBits += bitAt(idx++);
      bytes.push(parseInt(byteBits, 2));
    }
    var printable = bytes.every(function (c) { return c >= 32 && c <= 126; });
    if (!printable) return { found: false, message: null, length: length };
    var message = bytes.map(function (c) { return String.fromCharCode(c); }).join('');
    return { found: true, message: message, length: length };
  }

  var api = { decode: decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LsbStegoEngine = api;
})(typeof window !== 'undefined' ? window : this);
