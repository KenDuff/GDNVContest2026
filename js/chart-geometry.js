// Eurovision poster — chart geometry (chord / arc / radial bundle / matrix
// / scatter) for the seven interactive "alternate view" charts.
//
// Pure builder functions: given a shared `ctx` bag (region/country lookups
// + the DC's existing tooltip/selection callbacks), each returns the exact
// chart-object shape the template already reads (arcs/ribbons, nodes/arcs,
// leaves/curves, cells/bands, dots).
//
// The matrix/arc-diagram/scatter builders use d3's scale primitives
// (scaleLinear/scaleBand/scalePoint/scaleSqrt) via window.d3 — vendored
// locally as d3-lite.js (see that file) rather than fetched from a CDN, so
// the poster has no external network dependency and never shows a
// blocked-request error for viewers on locked-down networks/browsers. The
// chord and radial-bundle geometry (angle partitioning around a circle) is
// straightforward trigonometry via the shared P2() helper and doesn't need
// a scale library at all.
//
// Loaded as a plain <script src="./chart-geometry.js"> tag from <helmet>
// (NOT an ES module — dynamic import() of a relative module is blocked by
// some browsers/environments when a file is opened directly, e.g. file://
// or a downloaded standalone copy). It attaches itself to
// window.ChartGeometry.

function buildChordChart(ctx) {
  const { E, L, REG_ORDER, RLAB, selNode, mkClick, regionHov, chartHov, ttPos, P2, self } = ctx;
  const RD = L.regionDir || {};
  const pairs = [];
  for (let i = 0; i < REG_ORDER.length; i++) for (let j = i + 1; j < REG_ORDER.length; j++) {
    const A = REG_ORDER[i], B = REG_ORDER[j], ab = RD[A + '>' + B], ba = RD[B + '>' + A];
    const v = (ab ? ab.avg : 0) + (ba ? ba.avg : 0);
    if (v > 0) pairs.push({ A, B, v, enc: (ab ? ab.enc : 0) + (ba ? ba.enc : 0), pairsN: (ab ? ab.pairs : 0) + (ba ? ba.pairs : 0) });
  }
  pairs.sort((x, y) => y.v - x.v);
  const maxV = pairs.length ? pairs[0].v : 1;
  const R = 150;

  // Arcs are sized by each bloc's total incident weight (a simple angle
  // partition around the circle — the same idea as d3.chord()'s group
  // layout, done directly with trig via the poster's shared P2() helper).
  const w = {}; REG_ORDER.forEach(r => w[r] = 0);
  pairs.forEach(p => { w[p.A] += p.v; w[p.B] += p.v; });
  const regs = REG_ORDER.filter(r => w[r] > 0);
  const totW = regs.reduce((s, r) => s + w[r], 0) || 1;
  const gap = 0.05, avail = Math.PI * 2 - gap * regs.length;
  let ang = -Math.PI / 2 + gap / 2;
  const seg = {}, arcs = [];
  regs.forEach(r => {
    const span = w[r] / totW * avail, a0 = ang, a1 = ang + span; ang = a1 + gap;
    const mid = (a0 + a1) / 2; seg[r] = { a0, a1, span, mid };
    const [x0, y0] = P2(a0, R), [x1, y1] = P2(a1, R), [xo0, yo0] = P2(a0, R + 13), [xo1, yo1] = P2(a1, R + 13);
    const large = (a1 - a0) > Math.PI ? 1 : 0, [lx, ly] = P2(mid, R + 27);
    arcs.push({
      id: r, color: E.regionColor[r] || '#ccc',
      d: 'M ' + x0.toFixed(2) + ',' + y0.toFixed(2) + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' L ' + xo1.toFixed(2) + ',' + yo1.toFixed(2) + ' A ' + (R + 13) + ' ' + (R + 13) + ' 0 ' + large + ' 0 ' + xo0.toFixed(2) + ',' + yo0.toFixed(2) + ' Z',
      label: RLAB[r] || r, lx: lx.toFixed(1), ly: ly.toFixed(1),
      anchor: (Math.cos(mid) < -0.25 ? 'end' : (Math.cos(mid) > 0.25 ? 'start' : 'middle')),
      selStroke: (selNode === r ? '#f6efda' : 'none'), click: mkClick(r),
      enter: () => self.setState({ hov: regionHov(r, P2(mid, R)[0], P2(mid, R)[1], E.regionColor[r] || '#ccc') })
    });
  });

  const byReg = {}; regs.forEach(r => byReg[r] = []);
  pairs.forEach(p => { if (byReg[p.A]) byReg[p.A].push(p); if (byReg[p.B]) byReg[p.B].push(p); });
  const subOf = {};
  regs.forEach(r => {
    byReg[r].sort((x, y) => y.v - x.v);
    let c = seg[r].a0;
    byReg[r].forEach(p => { const sw = p.v / w[r] * seg[r].span, s0 = c, s1 = c + sw; c = s1; subOf[r + '|' + p.A + '>' + p.B] = { a0: s0, a1: s1 }; });
  });

  const ribbons = pairs.map(p => {
    const s = subOf[p.A + '|' + p.A + '>' + p.B], t = subOf[p.B + '|' + p.A + '>' + p.B];
    const [sx0, sy0] = P2(s.a0, R), [sx1, sy1] = P2(s.a1, R), [tx0, ty0] = P2(t.a0, R), [tx1, ty1] = P2(t.a1, R);
    const col = w[p.A] >= w[p.B] ? (E.regionColor[p.A] || '#ccc') : (E.regionColor[p.B] || '#ccc');
    const op = Math.max(0.24, Math.min(0.8, p.v / maxV * 0.8));
    const [mx, my] = P2((s.a0 + s.a1) / 2, R * 0.42);
    const touches = !selNode || p.A === selNode || p.B === selNode;
    return {
      d: 'M ' + sx0.toFixed(2) + ',' + sy0.toFixed(2) + ' A ' + R + ' ' + R + ' 0 0 1 ' + sx1.toFixed(2) + ',' + sy1.toFixed(2) + ' Q 256,256 ' + tx1.toFixed(2) + ',' + ty1.toFixed(2) + ' A ' + R + ' ' + R + ' 0 0 0 ' + tx0.toFixed(2) + ',' + ty0.toFixed(2) + ' Q 256,256 ' + sx0.toFixed(2) + ',' + sy0.toFixed(2) + ' Z',
      color: col, op: touches ? op : Math.min(op, 0.06), pe: (selNode && !touches) ? 'none' : 'auto',
      enter: chartHov(Object.assign({
        kind: 'edge', accent: col, title: (RLAB[p.A] || p.A) + '   \u21c4   ' + (RLAB[p.B] || p.B), sub: 'Bloc-to-bloc \u00b7 all-time',
        rows: [{ k: 'Avg pts / meeting', v: p.v.toFixed(2) }, { k: 'Country pairs', v: p.pairsN }, { k: 'Total encounters', v: p.enc }],
        lists: [], strongest: null, countries: null, flag: null, flagA: null, flagB: null
      }, ttPos(mx, my)))
    };
  });

  return { type: 'chord', arcs, ribbons, shown: ribbons.length, total: pairs.length };
}

function buildArcChart(ctx) {
  const { d3, E, L, REG_ORDER, regByName, byCode, flagUrl, accent, density, selNode, mkClick, chartHov, ttPos, nodeHov, self } = ctx;
  const order = [];
  REG_ORDER.forEach(r => {
    const rn = regByName[r]; if (!rn) return;
    rn.countries.map(c => byCode[c]).filter(Boolean)
      .sort((a, b) => (b.avgRecv || 0) - (a.avgRecv || 0))
      .forEach(nd => order.push(nd));
  });
  const idx = {}; order.forEach((nd, i) => idx[nd.c] = i);
  const baseY = 352;
  const xScale = d3.scalePoint().domain(order.map(nd => nd.c)).range([58, 512 - 58]);

  const nodes = order.map(nd => {
    const xx = xScale(nd.c);
    const isSel = selNode === nd.c;
    return {
      x: xx.toFixed(2), fx: (xx - 5.5).toFixed(2), fy: (baseY + 7).toFixed(1),
      hx: (xx - 7).toFixed(2), hy: (baseY - 4).toFixed(1),
      code: nd.c, color: E.regionColor[nd.region] || '#ccc', flag: flagUrl(nd.c), name: (E.names[nd.c] || nd.c),
      sel: isSel, ringOp: isSel ? 1 : 0, click: mkClick(nd.c),
      enter: () => self.setState({ hov: nodeHov(nd.c, xx, baseY - 2, E.regionColor[nd.region] || '#ccc') })
    };
  });

  const M = L.mutual || {};
  const mp = Object.keys(M).map(k => M[k]).filter(o => idx[o.a] != null && idx[o.b] != null && o.a !== o.b);
  mp.sort((x, y) => y.score - x.score);
  const keep = Math.max(4, Math.round(density * Math.min(mp.length, 260)));
  const shown = mp.slice(0, keep);
  const maxS = shown.length ? shown[0].score : 1;
  const opScale = d3.scaleLinear().domain([0, maxS]).range([0.16, 0.92]).clamp(true);
  const wScale = d3.scaleLinear().domain([0, maxS]).range([0.7, 3.3]).clamp(true);

  const arcs = shown.map(o => {
    const i = idx[o.a], j = idx[o.b];
    const x1 = Math.min(xScale(o.a), xScale(o.b)), x2 = Math.max(xScale(o.a), xScale(o.b));
    const rx = (x2 - x1) / 2, ry = Math.min(rx, 150 + rx * 0.15), apexY = baseY - ry;
    const rA = order[i].region, rB = order[j].region;
    const col = rA === rB ? (E.regionColor[rA] || accent) : '#f2f2f2';
    const op = opScale(o.score);
    const wdt = wScale(o.score).toFixed(2);
    const mx = (x1 + x2) / 2, my = apexY;
    const on = o.a === selNode || o.b === selNode;
    const touches = !selNode || on;
    return {
      d: 'M ' + x1.toFixed(2) + ',' + baseY + ' A ' + rx.toFixed(2) + ' ' + ry.toFixed(2) + ' 0 0 1 ' + x2.toFixed(2) + ',' + baseY,
      color: (selNode && on) ? '#f6efda' : col,
      op: selNode ? (on ? 1 : 0.05) : op,
      w: (selNode && on) ? (parseFloat(wdt) + 1.6).toFixed(2) : wdt,
      pe: (selNode && !touches) ? 'none' : 'auto',
      enter: chartHov(Object.assign({
        kind: 'edge', accent: col,
        title: (E.names[o.a] || o.a) + '   \u21c4   ' + (E.names[o.b] || o.b),
        sub: 'Mutual bond \u00b7 all-time',
        rows: [
          { k: 'Mutual score', v: o.score.toFixed(2) },
          { k: (E.names[o.a] || o.a) + ' \u2192 ' + (E.names[o.b] || o.b), v: o.ab.toFixed(2) },
          { k: (E.names[o.b] || o.b) + ' \u2192 ' + (E.names[o.a] || o.a), v: o.ba.toFixed(2) }
        ],
        lists: [], strongest: null, countries: null, flag: null, flagA: flagUrl(o.a), flagB: flagUrl(o.b)
      }, ttPos(mx, my)))
    };
  });

  return { type: 'arc', nodes, arcs, baseY, shown: shown.length, total: mp.length };
}

function buildBundleChart(ctx) {
  const { E, L, REG_ORDER, regByName, byCode, flagUrl, accent, selNode, mkClick, chartHov, ttPos, nodeHov, P2, self } = ctx;
  // Radial layout: countries placed evenly around the circle grouped by
  // bloc (matches d3.cluster()'s leaf spacing without needing the full
  // hierarchy machinery); edges curve toward their bloc's centroid so
  // same-bloc ties bow inward together — a simple, dependency-free stand-in
  // for hierarchical edge bundling.
  const order = [];
  REG_ORDER.forEach(r => {
    const rn = regByName[r]; if (!rn) return;
    rn.countries.map(c => byCode[c]).filter(Boolean).forEach(nd => order.push(nd));
  });
  const Nn = order.length, R = 170;
  const pos = {};
  const leaves = order.map((nd, i) => {
    const a = -Math.PI / 2 + (i / Nn) * Math.PI * 2;
    const [x, y] = P2(a, R); pos[nd.c] = { x, y, a, region: nd.region };
    const [lx, ly] = P2(a, R + 13);
    return {
      code: nd.c, dx: x.toFixed(2), dy: y.toFixed(2), color: E.regionColor[nd.region] || '#ccc',
      flag: flagUrl(nd.c), fx: (lx - 6).toFixed(2), fy: (ly - 4).toFixed(2),
      ringOp: selNode === nd.c ? 1 : 0, click: mkClick(nd.c),
      enter: () => self.setState({ hov: nodeHov(nd.c, x, y, E.regionColor[nd.region] || '#ccc') })
    };
  });

  const cen = {};
  REG_ORDER.forEach(r => {
    const rn = regByName[r]; if (!rn) return;
    const cs = rn.countries.filter(c => pos[c]); if (!cs.length) return;
    let sx = 0, sy = 0; cs.forEach(c => { sx += Math.cos(pos[c].a); sy += Math.sin(pos[c].a); });
    cen[r] = P2(Math.atan2(sy, sx), R * 0.40);
  });

  const M = L.mutual || {};
  let mp = Object.keys(M).map(k => M[k]).filter(o => pos[o.a] && pos[o.b]);
  mp.sort((x, y) => y.score - x.score); mp = mp.slice(0, 150);
  const maxS = mp.length ? mp[0].score : 1;

  const curves = mp.map(o => {
    const A = pos[o.a], B = pos[o.b], cA = cen[A.region] || [256, 256], cB = cen[B.region] || [256, 256];
    const baseCol = A.region === B.region ? (E.regionColor[A.region] || accent) : 'rgba(242,242,242,0.9)';
    const on = o.a === selNode || o.b === selNode;
    const touches = !selNode || on;
    const baseOp = Math.max(0.13, Math.min(0.72, o.score / maxS));
    const op = selNode ? (on ? 1 : 0.05) : baseOp;
    const w = (selNode && on) ? (parseFloat((0.5 + 1.9 * (o.score / maxS)).toFixed(2)) + 1.4).toFixed(2) : (0.5 + 1.9 * (o.score / maxS)).toFixed(2);
    const col = (selNode && on) ? '#f6efda' : baseCol;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    return {
      d: 'M ' + A.x.toFixed(2) + ',' + A.y.toFixed(2) + ' C ' + cA[0].toFixed(1) + ',' + cA[1].toFixed(1) + ' ' + cB[0].toFixed(1) + ',' + cB[1].toFixed(1) + ' ' + B.x.toFixed(2) + ',' + B.y.toFixed(2),
      color: col, op, w, pe: (selNode && !touches) ? 'none' : 'auto',
      enter: chartHov(Object.assign({
        kind: 'edge', accent: (A.region === B.region ? col : '#cfc8ba'),
        title: (E.names[o.a] || o.a) + '   \u21c4   ' + (E.names[o.b] || o.b),
        sub: (A.region === B.region ? 'Within-bloc bond' : 'Cross-bloc bond'),
        rows: [{ k: 'Mutual score', v: o.score.toFixed(2) }],
        lists: [], strongest: null, countries: null, flag: null, flagA: flagUrl(o.a), flagB: flagUrl(o.b)
      }, ttPos(mx, my)))
    };
  });

  return { type: 'bundle', leaves, curves, R };
}

function buildMatrixChart(ctx) {
  const { d3, E, L, REG_ORDER, regByName, byCode, flagUrl, accent, density, selRow, selCol, openKey, chartHov, ttPos, self } = ctx;
  const src = openKey === 'crimson' ? (L.juryDir || {}) : openKey === 'teal' ? (L.publicDir || {}) : (L.totalDir || {});
  const chanLbl = openKey === 'crimson' ? 'jury' : openKey === 'teal' ? 'televote' : 'all-time';
  const order = [], regRange = [];
  REG_ORDER.forEach(r => {
    const rn = regByName[r]; if (!rn) return;
    const start = order.length;
    rn.countries.map(c => byCode[c]).filter(Boolean).forEach(nd => order.push(nd));
    if (order.length > start) regRange.push({ r, start, end: order.length });
  });
  const codes = order.map(nd => nd.c);
  const gx = 86, gy = 86, gw = 340, gEnd = gx + gw;
  const band = d3.scaleBand().domain(codes).range([0, gw]).padding(0);
  const cell = band.bandwidth();
  const idx = {}; order.forEach((nd, i) => idx[nd.c] = i);
  const regOfIdx = order.map(nd => nd.region);
  const anySel = !!(selRow || selCol);

  let maxV = 0; const raw = [];
  Object.keys(src).forEach(k => {
    const p = k.split('>'); const A = p[0], B = p[1];
    if (idx[A] == null || idx[B] == null || A === B) return;
    const v = src[k].avg || 0; if (v <= 0) return;
    if (v > maxV) maxV = v;
    raw.push({ A, B, v, enc: src[k].enc || 0 });
  });
  raw.sort((a, b) => b.v - a.v);
  const keepN = Math.max(14, Math.round((0.14 + 0.86 * density) * raw.length));
  const opScale = d3.scaleLinear().domain([0, maxV]).range([0.14, 1]).clamp(true);

  const cells = raw.slice(0, keepN).map(c => {
    const i = idx[c.A], j = idx[c.B];
    const gReg = regOfIdx[i], rReg = regOfIdx[j];
    const active = (selRow ? gReg === selRow : true) && (selCol ? rReg === selCol : true);
    const op = (anySel ? (active ? 1 : 0.06) : 1) * opScale(c.v);
    const mx = gx + band(c.B) + cell / 2, my = gy + band(c.A) + cell / 2;
    const baseFill = gReg === rReg ? (E.regionColor[gReg] || accent) : '#f2f2f2';
    return {
      x: (gx + band(c.B)).toFixed(2), y: (gy + band(c.A)).toFixed(2), s: (cell - 0.35).toFixed(2), op: op.toFixed(3),
      fill: (anySel && active) ? '#f6efda' : baseFill,
      pe: (anySel && !active) ? 'none' : 'auto',
      enter: chartHov(Object.assign({
        kind: 'edge', accent, title: (E.names[c.A] || c.A) + '  \u2192  ' + (E.names[c.B] || c.B), sub: 'Avg points given \u00b7 ' + chanLbl,
        rows: [{ k: 'Avg points', v: c.v.toFixed(2) }, { k: 'Meetings', v: c.enc }],
        lists: [], strongest: null, countries: null, flag: null, flagA: flagUrl(c.A), flagB: flagUrl(c.B)
      }, ttPos(mx, my)))
    };
  });

  const mkCol = (r) => (ev) => { ev.stopPropagation(); self.setState(s => ({ selCol: s.selCol === r ? null : r })); };
  const mkRow = (r) => (ev) => { ev.stopPropagation(); self.setState(s => ({ selRow: s.selRow === r ? null : r })); };
  const bands = [];
  regRange.forEach(rr => {
    const col = E.regionColor[rr.r] || '#ccc';
    const wSpan = (rr.end - rr.start) * cell;
    bands.push({ x: (gx + rr.start * cell).toFixed(2), y: (gy - 11).toFixed(2), w: wSpan.toFixed(2), h: '7', color: col, region: rr.r, selStroke: (selCol === rr.r ? '#f6efda' : 'none'), click: mkCol(rr.r) });
    bands.push({ x: (gx - 11).toFixed(2), y: (gy + rr.start * cell).toFixed(2), w: '7', h: wSpan.toFixed(2), color: col, region: rr.r, selStroke: (selRow === rr.r ? '#f6efda' : 'none'), click: mkRow(rr.r) });
  });
  const seps = [];
  regRange.forEach(rr => {
    if (rr.start === 0) return;
    const p = (gx + rr.start * cell).toFixed(2);
    seps.push({ x1: p, y1: gy.toFixed(2), x2: p, y2: gEnd.toFixed(2) });
    seps.push({ x1: gx.toFixed(2), y1: p, x2: gEnd.toFixed(2), y2: p });
  });
  const selLabel = anySel ? ('GIVES: ' + (selRow || 'any') + '   \u00b7   RECEIVES: ' + (selCol || 'any')) : 'CLICK A COLOUR BAND ON EACH AXIS TO ISOLATE';

  return { type: 'matrix', cells, bands, seps, gx: gx.toFixed(2), gy: gy.toFixed(2), gw: gw.toFixed(2), gEnd: gEnd.toFixed(2), shown: cells.length, total: raw.length, chan: chanLbl.toUpperCase(), selLabel, anySel };
}

function buildScatterChart(ctx) {
  const { d3, E, L, flagUrl, selNode, density, chartHov, ttPos } = ctx;
  const D = L.div || {};
  let pts = Object.keys(D).map(k => D[k]).filter(p => p && (p.jury > 0 || p.pub > 0));
  const maxAx = Math.max(1, d3.max(pts, p => Math.max(p.jury, p.pub)) || 1);
  const maxDiv = Math.max(1, d3.max(pts, p => p.div || 0) || 1);
  const g0 = 92, g1 = 420;
  const sx = d3.scaleLinear().domain([0, maxAx]).range([g0, g1]).clamp(true);
  const sy = d3.scaleLinear().domain([0, maxAx]).range([g1, g0]).clamp(true);
  const rScale = d3.scaleSqrt().domain([0, maxDiv]).range([1.8, 5.2]).clamp(true);

  pts.sort((a, b) => (b.div || 0) - (a.div || 0));
  const keepN = Math.max(10, Math.round((0.14 + 0.86 * density) * pts.length));
  const shownPts = pts.slice(0, keepN);

  const dots = shownPts.map(p => {
    const juryFav = p.dir === 'JuryFavours';
    const col = juryFav ? '#c8324c' : '#20a892';
    const touches = !selNode || p.a === selNode || p.b === selNode;
    const cx = sx(p.jury), cy = sy(p.pub), r = rScale(p.div || 0).toFixed(2);
    return {
      cx: cx.toFixed(2), cy: cy.toFixed(2), r, color: col, op: (touches ? 0.82 : 0.07).toFixed(2),
      pe: (selNode && !touches) ? 'none' : 'auto',
      enter: chartHov(Object.assign({
        kind: 'edge', accent: col, title: (E.names[p.a] || p.a) + '   &   ' + (E.names[p.b] || p.b), sub: (juryFav ? 'Jury favours' : 'Public favours'),
        rows: [{ k: 'Jury avg', v: (p.jury || 0).toFixed(1) }, { k: 'Public avg', v: (p.pub || 0).toFixed(1) }, { k: 'Divergence', v: (p.div || 0).toFixed(1) }],
        lists: [], strongest: null, countries: null, flag: null, flagA: flagUrl(p.a), flagB: flagUrl(p.b)
      }, ttPos(cx, cy)))
    };
  });

  return { type: 'scatter', dots, g0: g0.toFixed(1), g1: g1.toFixed(1), dX2: sx(maxAx).toFixed(1), dY2: sy(maxAx).toFixed(1), shown: shownPts.length, total: pts.length };
}

window.ChartGeometry = {
  buildChordChart: buildChordChart,
  buildArcChart: buildArcChart,
  buildBundleChart: buildBundleChart,
  buildMatrixChart: buildMatrixChart,
  buildScatterChart: buildScatterChart
};
