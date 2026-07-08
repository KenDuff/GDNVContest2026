global.window = global;
const fs = require('fs');
const path = require('path');
const ROOT = __dirname; // run this script from inside the poster/ folder
require(path.join(ROOT, 'js/euro-data.js')); // sets window.EURO
const E = window.EURO;

// NOTE: uploads/Vinyls/*.svg (the art actually shown on screen) has had its
// baked-in tie-lines stripped out, since they couldn't respond to the
// density slider -- the interactive overlay draws the (now density-filtered)
// ties instead. This script parses the ORIGINAL, unstripped art in
// source_svgs/*.svg to get real edge coordinates/colors, so it needs those
// source files, not the display copies. If you regenerate/redraw disc art
// with new ties, drop the new full (unstripped) version in source_svgs/,
// re-run this script, and it'll refresh js/disc-geometry.js. You'd then
// also want to re-strip the edges out of the display copy in uploads/Vinyls/
// (the same regex this script matches edges with) if you want the visible
// dots/labels/background to reflect the new source too.

const parseSvg = (text) => {
  let m;
  const gmap = {};
  const gre = /<linearGradient id="([a-zA-Z0-9]+)"[^>]*>\s*<stop offset="0%" stop-color="([^"]+)"/g;
  while ((m = gre.exec(text))) gmap[m[1]] = m[2];
  const labels = [];
  const labRe = /<text x="([\d.\-]+)" y="([\d.\-]+)"[^>]*>([A-Za-z &]{2,20})<\/text>/g;
  while ((m = labRe.exec(text))) labels.push({ raw:m[3], x:+m[1], y:+m[2] });
  const eRe = /<path d="M ([\d.\-]+),([\d.\-]+) Q ([\d.\-]+),([\d.\-]+) ([\d.\-]+),([\d.\-]+)" fill="none" stroke="([^"]+)"/g;
  const edges = [], seen = {}, pts = [];
  while ((m = eRe.exec(text))) {
    const k = m[1]+','+m[2]+'>'+m[5]+','+m[6];
    if (seen[k]) continue; seen[k] = 1;
    let col = m[7]; if (col.indexOf('url(') === 0) { col = gmap[col.slice(5,-1)] || '#9a8f86'; }
    edges.push({ d:'M '+m[1]+','+m[2]+' Q '+m[3]+','+m[4]+' '+m[5]+','+m[6], x1:+m[1], y1:+m[2], x2:+m[5], y2:+m[6], col });
    pts.push([+m[1],+m[2]], [+m[5],+m[6]]);
  }
  const clusters = [];
  pts.forEach(p => { const x=p[0], y=p[1]; let f=null; for (const c of clusters){ if (Math.hypot(c.x-x,c.y-y)<3.5){f=c;break;} } if (f){ f.x=(f.x*f.n+x)/(f.n+1); f.y=(f.y*f.n+y)/(f.n+1); f.n++; } else clusters.push({x,y,n:1}); });
  const used = {};
  const centre = {};
  const isoLabels = [];
  labels.forEach(l => {
    const isR = !!E.regionColor[l.raw]; const c2 = E.iso3to2[l.raw] || null;
    if (!isR && !c2) return;
    const id = isR ? l.raw : c2;
    let bi=-1, bd=1e9; clusters.forEach((c,i)=>{ const d=Math.hypot(c.x-l.x,c.y-l.y); if(d<bd){bd=d;bi=i;} });
    if (bi>=0 && bd<13){ used[bi]=1; centre[id]={x:clusters[bi].x, y:clusters[bi].y}; }
    else { isoLabels.push({id,l}); centre[id]={x:l.x, y:l.y-(isR?9.2:5.5)}; }
  });
  isoLabels.forEach(o => {
    const l=o.l; let bi=-1, bd=1e9; clusters.forEach((c,i)=>{ if(used[i])return; const d=Math.hypot(c.x-l.x,c.y-l.y); if(d<bd){bd=d;bi=i;} });
    if (bi>=0 && bd<42){ used[bi]=1; centre[o.id]={x:clusters[bi].x, y:clusters[bi].y}; }
  });
  if (centre['AU']) centre['AU'] = { x:337.3, y:432.9 };
  const ids = Object.keys(centre);
  const nearId = (x,y)=>{ let b=null,bd=1e9; for(const id of ids){ const c=centre[id]; const d=Math.hypot(c.x-x,c.y-y); if(d<bd){bd=d;b=id;} } return (b&&bd<16)?b:null; };
  edges.forEach(e=>{ e.a=nearId(e.x1,e.y1); e.b=nearId(e.x2,e.y2); });
  return { centre, edges: edges.filter(e=>e.a&&e.b&&e.a!==e.b) };
};

const keys = ['silver','gold','orange','blue','crimson','indigo','teal'];
const out = {};
for (const key of keys) {
  const svgText = fs.readFileSync(path.join(ROOT, 'source_svgs', `${key}.svg`), 'utf-8');
  const result = parseSvg(svgText);
  out[key] = result;
  console.log(key, '-> nodes:', Object.keys(result.centre).length, 'edges:', result.edges.length);
}

const jsOut = 'window.DISC_GEOMETRY = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(ROOT, 'js/disc-geometry.js'), jsOut);
console.log('Wrote js/disc-geometry.js,', jsOut.length, 'bytes');
