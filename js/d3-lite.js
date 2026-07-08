// d3-lite.js — a tiny, dependency-free, 100% local stand-in for the handful
// of d3 primitives this poster's chart geometry actually uses
// (scaleLinear / scaleBand / scalePoint / scaleSqrt / max / extent).
//
// Why not the real d3 library? It was previously loaded from a CDN
// (cdn.jsdelivr.net), which some browsers/networks (privacy-hardened
// browsers, corporate filters, ad/tracker blockers) refuse to fetch — that
// produced visible "[bundle] error" noise for those viewers. Vendoring this
// small subset locally means the poster has zero external network
// dependencies and behaves identically for every viewer, online or off.
// It implements the same chained-accessor API (`.domain()`, `.range()`,
// `.clamp()`, `.bandwidth()`, …) so calling code is unchanged.
(function () {
  function scaleLinear() {
    let domain = [0, 1], range = [0, 1], clampFlag = false;
    function scale(x) {
      const [d0, d1] = domain, [r0, r1] = range;
      const span = d1 - d0;
      let t = span ? (x - d0) / span : 0;
      if (clampFlag) t = Math.max(0, Math.min(1, t));
      return r0 + t * (r1 - r0);
    }
    scale.domain = function (v) { if (!arguments.length) return domain.slice(); domain = v; return scale; };
    scale.range = function (v) { if (!arguments.length) return range.slice(); range = v; return scale; };
    scale.clamp = function (v) { clampFlag = !!v; return scale; };
    return scale;
  }

  function scaleSqrt() {
    let domain = [0, 1], range = [0, 1], clampFlag = false;
    function scale(x) {
      const [d0, d1] = domain, [r0, r1] = range;
      const s0 = Math.sqrt(Math.max(0, d0)), s1 = Math.sqrt(Math.max(0, d1));
      const span = s1 - s0;
      let t = span ? (Math.sqrt(Math.max(0, x)) - s0) / span : 0;
      if (clampFlag) t = Math.max(0, Math.min(1, t));
      return r0 + t * (r1 - r0);
    }
    scale.domain = function (v) { if (!arguments.length) return domain.slice(); domain = v; return scale; };
    scale.range = function (v) { if (!arguments.length) return range.slice(); range = v; return scale; };
    scale.clamp = function (v) { clampFlag = !!v; return scale; };
    return scale;
  }

  function scaleBand() {
    let domain = [], range = [0, 1];
    function scale(key) {
      const i = domain.indexOf(key);
      if (i < 0) return undefined;
      const step = (range[1] - range[0]) / (domain.length || 1);
      return range[0] + step * i;
    }
    scale.domain = function (v) { if (!arguments.length) return domain.slice(); domain = v.slice(); return scale; };
    scale.range = function (v) { if (!arguments.length) return range.slice(); range = v; return scale; };
    scale.padding = function () { return scale; }; // only padding(0) is ever used — no-op accessor for API parity
    scale.bandwidth = function () { return (range[1] - range[0]) / (domain.length || 1); };
    return scale;
  }

  function scalePoint() {
    let domain = [], range = [0, 1];
    function scale(key) {
      const i = domain.indexOf(key);
      if (i < 0) return undefined;
      const n = domain.length;
      if (n <= 1) return (range[0] + range[1]) / 2;
      return range[0] + (range[1] - range[0]) * (i / (n - 1));
    }
    scale.domain = function (v) { if (!arguments.length) return domain.slice(); domain = v.slice(); return scale; };
    scale.range = function (v) { if (!arguments.length) return range.slice(); range = v; return scale; };
    return scale;
  }

  function max(arr, fn) {
    let m, has = false;
    for (const d of arr) { const v = fn ? fn(d) : d; if (v != null && (!has || v > m)) { m = v; has = true; } }
    return has ? m : undefined;
  }

  function extent(arr, fn) {
    let lo, hi, has = false;
    for (const d of arr) {
      const v = fn ? fn(d) : d;
      if (v == null) continue;
      if (!has) { lo = hi = v; has = true; } else { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    return has ? [lo, hi] : [undefined, undefined];
  }

  window.d3 = { scaleLinear, scaleSqrt, scaleBand, scalePoint, max, extent };
})();
