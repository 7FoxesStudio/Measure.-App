'use strict';
// Monitor-size helpers for the on-screen ruler (pure functions, no Electron dependencies).
//
// A monitor reports its physical image size in its EDID block. Two places hold it:
//   * the first "detailed timing descriptor" (offset 54): size in millimetres
//   * header bytes 21/22: size in whole centimetres (coarser, used as a fallback)

function hexToBytes(hex) {
  const out = [];
  for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

function parseEdid(bytes) {
  if (!bytes || bytes.length < 128) return null;
  const header = [0, 255, 255, 255, 255, 255, 255, 0];
  for (let i = 0; i < 8; i++) if (bytes[i] !== header[i]) return null;

  const sizes = [];
  let nativeW = 0, nativeH = 0;

  const o = 54; // first detailed timing descriptor
  const pixelClock = bytes[o] | (bytes[o + 1] << 8);
  if (pixelClock !== 0) {
    nativeW = bytes[o + 2] | ((bytes[o + 4] & 0xF0) << 4);
    nativeH = bytes[o + 5] | ((bytes[o + 7] & 0xF0) << 4);
    const dtdW = bytes[o + 12] | ((bytes[o + 14] & 0xF0) << 4);
    const dtdH = bytes[o + 13] | ((bytes[o + 14] & 0x0F) << 8);
    if (dtdW > 0 && dtdH > 0) sizes.push({ w: dtdW, h: dtdH, src: 'dtd' });
  }

  // bytes 21/22 are centimetres; if either is 0 they encode an aspect ratio instead, so skip
  const cmW = bytes[21], cmH = bytes[22];
  if (cmW > 0 && cmH > 0) sizes.push({ w: cmW * 10, h: cmH * 10, src: 'cm' });

  if (!sizes.length) return null;
  return { sizes, nativeW, nativeH };
}

// Windows virtual video output technologies that mean "built-in laptop panel"
const INTERNAL_VOT = [2147483648, -2147483648, 6, 11, 13];

function parseMonitorRecord(rec) {
  if (!rec || typeof rec.edid !== 'string') return null;
  const parsed = parseEdid(hexToBytes(rec.edid));
  if (!parsed) return null;
  const vot = Number(rec.vot);
  return {
    inst: rec.inst || '',
    internal: INTERNAL_VOT.indexOf(vot) !== -1,
    sizes: parsed.sizes,
    nativeW: parsed.nativeW,
    nativeH: parsed.nativeH
  };
}

// display: { sizePx: {w, h}  (real device pixels), internal: bool }
// monitors: result of parseMonitorRecord for each active monitor
// returns { widthMm } on success, or { reason } explaining why not
function matchDisplay(display, monitors) {
  if (!monitors || !monitors.length) return { reason: 'no-monitor-info' };
  const pw = display.sizePx.w, ph = display.sizePx.h;
  if (!pw || !ph) return { reason: 'no-match' };
  const portrait = ph > pw;
  const targetAspect = pw / ph;

  let cands = [];
  for (const m of monitors) {
    for (const s of m.sizes) {
      let w = s.w, h = s.h;
      if (portrait && w > h) { const t = w; w = h; h = t; }
      const aspectErr = Math.abs(w / h - targetAspect) / targetAspect;
      const ppi = pw / (w / 25.4);
      // implied screen diagonal: a real monitor/laptop is roughly 9"-120". This also rejects the
      // placeholder sizes (e.g. 160x90 mm) that some TVs, projectors and docks report.
      const diagIn = (w * Math.hypot(pw, ph) / pw) / 25.4;
      if (aspectErr <= 0.05 && ppi >= 50 && ppi <= 450 && diagIn >= 9 && diagIn <= 120) {
        cands.push({ m, w, h });
        break;
      }
    }
  }
  if (!cands.length) return { reason: 'no-match' };

  const sameKind = cands.filter(c => c.m.internal === !!display.internal);
  if (sameKind.length) cands = sameKind;

  const nativeMatch = cands.filter(c =>
    (c.m.nativeW === pw && c.m.nativeH === ph) || (c.m.nativeW === ph && c.m.nativeH === pw));
  if (nativeMatch.length) cands = nativeMatch;

  const widths = cands.map(c => c.w);
  if (Math.max.apply(null, widths) / Math.min.apply(null, widths) > 1.03) return { reason: 'ambiguous' };
  const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
  return { widthMm: Math.round(avg * 10) / 10 };
}

module.exports = { hexToBytes, parseEdid, parseMonitorRecord, matchDisplay };
