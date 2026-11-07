/*
 * Reads a PNG file's tEXt metadata chunks: real, standard PNG structure, parsed by hand here
 * so the room needs no external library. This is a simplified stand-in for full JPEG EXIF
 * (GPS tags, camera model and so on), which uses the same idea but a more complex binary layout.
 *
 * PNG layout: an 8-byte signature, then a sequence of chunks, each
 *   4 bytes length | 4 bytes type (ASCII) | <length> bytes data | 4 bytes CRC
 * A tEXt chunk's data is "key\0value" in Latin-1.
 */
(function (root) {
  'use strict';

  var SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  function isPng(bytes) {
    if (bytes.length < 8) return false;
    for (var i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) return false;
    return true;
  }

  function latin1(bytes, start, end) {
    var s = '';
    for (var i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  // Returns { chunks: [{type, length}], text: [{key, value}] } or throws on malformed input.
  function read(bytes) {
    if (!isPng(bytes)) throw new Error('Not a PNG file (missing the PNG signature).');
    var pos = 8, chunks = [], text = [];
    while (pos + 8 <= bytes.length) {
      var length = (bytes[pos] << 24 | bytes[pos+1] << 16 | bytes[pos+2] << 8 | bytes[pos+3]) >>> 0;
      var type = latin1(bytes, pos + 4, pos + 8);
      var dataStart = pos + 8, dataEnd = dataStart + length;
      if (dataEnd + 4 > bytes.length) throw new Error('Truncated PNG chunk (' + type + ').');
      chunks.push({ type: type, length: length });
      if (type === 'tEXt') {
        var raw = latin1(bytes, dataStart, dataEnd);
        var nul = raw.indexOf('\u0000');
        if (nul >= 0) text.push({ key: raw.slice(0, nul), value: raw.slice(nul + 1) });
      }
      pos = dataEnd + 4; // skip the 4-byte CRC
      if (type === 'IEND') break;
    }
    return { chunks: chunks, text: text };
  }

  var api = { read: read, isPng: isPng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PngMetadataEngine = api;
})(typeof window !== 'undefined' ? window : this);
