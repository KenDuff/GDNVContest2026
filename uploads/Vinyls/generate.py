#!/usr/bin/env python3
"""
Builds the data backing the density slider for the five records that have
one (orange, blue, crimson, teal, indigo -- silver/gold don't show the
slider). Two outputs:

  1. uploads/Vinyls/backgrounds/{key}.svg -- decoration-only disc art (no
     baked-in tie lines) for each of those five records.
  2. js/disc-geometry.js -- for each record, every real candidate tie from
     the CSVs in this folder, ranked strongest/most-relevant first, each
     with its rendering already computed (curve, colour, width, opacity).
     The live app just slices this list to however many ties the density
     slider currently calls for and draws them -- genuinely continuous,
     not a handful of preset "declutter levels".

Every tie that exists in the record's own original artwork is reused
byte-for-byte (same curve/colour/width/opacity as the artist's own file);
only ties beyond what the original art already drew get a generated style,
fitted from that same original art (see fit notes in style_for_rank/
blue_color below).

Fully self-contained and safe to re-run any time -- always reads fresh from
source_svgs/ and the CSVs here, never from its own prior output.

Run from anywhere:  python3 generate.py
"""
import csv, re, json, math, os, colorsys

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(HERE, 'CSVs')
SRC_SVG_DIR = os.path.join(HERE, '..', '..', 'source_svgs')
BG_DIR = os.path.join(HERE, 'backgrounds')
GEOM_JS = os.path.join(HERE, '..', '..', 'js', 'disc-geometry.js')

RECORDS = ['orange', 'blue', 'crimson', 'teal', 'indigo']
EDGE_GROUP_ID = {
    'orange': 'sn-edges', 'blue': 'fn-edges', 'crimson': 'jury-edges',
    'teal': 'pub-edges', 'indigo': 'jap-edges',
}

# ---------------------------------------------------------------- CSV data --
def load_csv(name):
    with open(os.path.join(CSV_DIR, name)) as f:
        return list(csv.DictReader(f))

def pair_key(a, b):
    return tuple(sorted([a, b]))

def build_total():
    d = {}
    for r in load_csv('edges_total_all_years.csv'):
        k = pair_key(r['Source'], r['Target'])
        d[k] = max(d.get(k, 0), float(r['AvgPointsPerEncounter']))
    return d

def build_mutual():
    return {pair_key(r['Source'], r['Target']): float(r['MutualScore'])
            for r in load_csv('edges_mutual_blocs.csv')}

def build_jury_public():
    jury, public = {}, {}
    for r in load_csv('edges_jury_vs_public.csv'):
        k = pair_key(r['Source'], r['Target'])
        v = float(r['AvgPointsPerEncounter'])
        tgt = jury if r['VoteType'] == 'jury' else public
        tgt[k] = max(tgt.get(k, 0), v)
    return jury, public

def build_div():
    score, direction = {}, {}
    for r in load_csv('edges_jury_public_divergence.csv'):
        k = pair_key(r['Source'], r['Target'])
        v = float(r['Divergence'])
        if k not in score or v > score[k]:
            score[k] = v
            direction[k] = r['DivergenceDirection']
    return score, direction

TOTAL = build_total()
MUTUAL = build_mutual()
JURY, PUBLIC = build_jury_public()
DIVSCORE, DIVDIR = build_div()

def _load_iso3to2():
    euro_data_path = os.path.join(HERE, '..', '..', 'js', 'euro-data.js')
    with open(euro_data_path) as f:
        text = f.read()
    m = re.search(r'"iso3to2":(\{[^}]*\})', text)
    return json.loads(m.group(1))

ISO3TO2 = _load_iso3to2()
with open(os.path.join(CSV_DIR, 'nodes_all.csv')) as f:
    COUNTRIES2 = set(row['Id'] for row in csv.DictReader(f))

# ------------------------------------------------- source SVG -> geometry --
def parse_source_svg(key):
    """Node centres + every original edge (with real a/b country codes)."""
    with open(os.path.join(SRC_SVG_DIR, f'{key}.svg')) as f:
        text = f.read()

    labRe = re.compile(r'<text x="([\d.\-]+)" y="([\d.\-]+)"[^>]*>([A-Za-z &]{2,20})</text>')
    labels = [{'raw': m.group(3), 'x': float(m.group(1)), 'y': float(m.group(2))} for m in labRe.finditer(text)]

    eRe = re.compile(r'<path d="M ([\d.\-]+),([\d.\-]+) Q ([\d.\-]+),([\d.\-]+) ([\d.\-]+),([\d.\-]+)" fill="none" stroke="([^"]+)" stroke-width="([\d.]+)" stroke-opacity="([\d.]+)" stroke-linecap="round"( filter="url\(#edge-glow\)")?></path>')
    raw_edges = []
    for m in eRe.finditer(text):
        x1,y1,cx,cy,x2,y2 = map(float, m.groups()[:6])
        raw_edges.append((x1,y1,x2,y2,m.group(7),float(m.group(8)),float(m.group(9)), m.group(10) is not None, m.group(0)))

    clusters = []
    for x1,y1,x2,y2,*_ in raw_edges:
        for x,y in [(x1,y1),(x2,y2)]:
            f = None
            for c in clusters:
                if math.hypot(c['x']-x, c['y']-y) < 3.5:
                    f = c; break
            if f:
                f['x'] = (f['x']*f['n']+x)/(f['n']+1); f['y'] = (f['y']*f['n']+y)/(f['n']+1); f['n'] += 1
            else:
                clusters.append({'x':x,'y':y,'n':1})

    used, centre, unresolved = set(), {}, []
    for l in labels:
        raw = l['raw'].strip()
        code = ISO3TO2.get(raw, raw if raw in COUNTRIES2 else None)
        if not code or code not in COUNTRIES2:
            continue
        bi, bd = -1, 1e9
        for i, c in enumerate(clusters):
            d = math.hypot(c['x']-l['x'], c['y']-l['y'])
            if d < bd: bd, bi = d, i
        if bi >= 0 and bd < 13:
            used.add(bi); centre[code] = {'x': clusters[bi]['x'], 'y': clusters[bi]['y']}
        else:
            unresolved.append((code, l))
            centre[code] = {'x': l['x'], 'y': l['y']-5.5}
    for code, l in unresolved:
        bi, bd = -1, 1e9
        for i, c in enumerate(clusters):
            if i in used: continue
            d = math.hypot(c['x']-l['x'], c['y']-l['y'])
            if d < bd: bd, bi = d, i
        if bi >= 0 and bd < 42:
            used.add(bi); centre[code] = {'x': clusters[bi]['x'], 'y': clusters[bi]['y']}

    def near_id(x, y):
        best, bd = None, 1e9
        for cid, c in centre.items():
            d = math.hypot(c['x']-x, c['y']-y)
            if d < bd: bd, best = d, cid
        return best if bd < 16 else None

    existing = {}
    for x1,y1,x2,y2,col,width,opacity,has_glow,tag in raw_edges:
        a, b = near_id(x1,y1), near_id(x2,y2)
        if a and b and a != b:
            existing.setdefault(pair_key(a,b), []).append(tag)

    return centre, existing

# ------------------------------------------------------------ curve/style --
def make_curve(x1, y1, x2, y2, ratio=-0.15):
    mx, my = (x1+x2)/2, (y1+y2)/2
    dx, dy = x2-x1, y2-y1
    length = math.hypot(dx, dy)
    if length < 0.01:
        return mx, my
    px, py = -dy/length, dx/length
    return mx + ratio*length*px, my + ratio*length*py

def style_for_rank(rank_frac, glow_frac=0.23):
    """Fitted from blue.svg's own top-ranked (glow) vs rest (plain) ties."""
    if rank_frac <= glow_frac:
        t = rank_frac / glow_frac
        width_glow = 3.36 - (3.36-1.9)*t
        opacity_glow = 0.736 - (0.736-0.636)*t
        return {'glow': True, 'widthGlow': round(width_glow,3), 'opacityGlow': round(opacity_glow,3),
                'width': round(width_glow*0.357,3), 'opacity': round(min(0.99, opacity_glow*1.3),3)}
    return {'glow': False, 'width': 0.5, 'opacity': 0.65}

def blue_color(score, smin, smax):
    t = 0 if smax==smin else (score-smin)/(smax-smin)
    r,g,b = colorsys.hls_to_rgb((40-36.5*t)/360, 0.51-0.04*t, 0.80)
    return '#%02x%02x%02x' % (round(r*255), round(g*255), round(b*255))

RECORD_CONFIG = {
    'blue':    {'source': MUTUAL, 'ascending': False, 'color_fn': blue_color},
    'crimson': {'source': JURY,   'ascending': False, 'color_fn': lambda s,a,b: '#15DDDD'},
    'teal':    {'source': PUBLIC, 'ascending': False, 'color_fn': lambda s,a,b: '#FF2A33'},
    'orange':  {'source': TOTAL,  'ascending': True,  'color_fn': lambda s,a,b: '#cccccc'},
    'indigo':  {'source': DIVSCORE, 'ascending': False, 'color_fn': None},  # direction-based, special-cased below
}

def get_candidates(key, centre):
    cfg = RECORD_CONFIG[key]
    countries = set(centre.keys())
    out = [(a,b,score) for (a,b),score in cfg['source'].items() if a in countries and b in countries]
    out.sort(key=lambda x: x[2], reverse=not cfg['ascending'])
    return out

_tag_re = re.compile(r'stroke="([^"]+)" stroke-width="([\d.]+)" stroke-opacity="([\d.]+)"')

def build_ranked_geometry(key):
    centre, existing = parse_source_svg(key)
    candidates = get_candidates(key, centre)
    n = len(candidates)
    scores = [c[2] for c in candidates]
    smin, smax = (min(scores), max(scores)) if scores else (0, 1)

    edges = []
    for i, (a, b, score) in enumerate(candidates):
        x1, y1 = centre[a]['x'], centre[a]['y']
        x2, y2 = centre[b]['x'], centre[b]['y']
        pk = pair_key(a, b)
        cx, cy = make_curve(x1, y1, x2, y2)
        d = f'M {x1:.2f},{y1:.2f} Q {cx:.2f},{cy:.2f} {x2:.2f},{y2:.2f}'
        if pk in existing:
            # exact original styling -- prefer the crisp (non-glow) layer's
            # width/opacity as the "resting" appearance; colour always exact.
            tags = existing[pk]
            crisp = next((t for t in tags if 'filter="url(#edge-glow)"' not in t), tags[0])
            m = _tag_re.search(crisp)
            color, width, opacity = m.group(1), float(m.group(2)), float(m.group(3))
        else:
            if key == 'indigo':
                direction = DIVDIR.get(pk, 'Aligned')
                color = '#15DDDD' if direction == 'JuryFavours' else '#FF2A33'
            else:
                color = RECORD_CONFIG[key]['color_fn'](score, smin, smax)
            rank_frac = i / max(1, n-1)
            style = style_for_rank(rank_frac)
            width, opacity = style['width'], style['opacity']
        edges.append({
            'd': d, 'x1': round(x1,2), 'y1': round(y1,2), 'x2': round(x2,2), 'y2': round(y2,2),
            'col': color, 'width': width, 'opacity': opacity, 'a': a, 'b': b,
        })

    default_count = len(existing)
    return centre, edges, default_count

def write_background_svg(key):
    with open(os.path.join(SRC_SVG_DIR, f'{key}.svg')) as f:
        text = f.read()
    group_id = EDGE_GROUP_ID[key]
    start_g = text.find(f'<g id="{group_id}"')
    assert start_g != -1, f"edges group id={group_id!r} not found in {key}.svg"
    inner_start = text.find('>', start_g) + 1
    close_g = text.find('</g>', start_g)
    assert close_g != -1, f"no closing </g> found for {key}.svg edges group"
    new_text = text[:inner_start] + text[close_g:]
    os.makedirs(BG_DIR, exist_ok=True)
    out_path = os.path.join(BG_DIR, f'{key}.svg')
    with open(out_path, 'w') as f:
        f.write(new_text)
    return out_path

# ------------------------------------------------------------------- main --
def main():
    geom = {}
    edge_line_re = re.compile(r'<path d="(M [\d.\-]+,[\d.\-]+ Q [\d.\-]+,[\d.\-]+ [\d.\-]+,[\d.\-]+)" fill="none" stroke="([^"]+)"')
    for key in ['silver', 'gold']:
        # unchanged: no slider for these two, so no ranking/regeneration --
        # same plain {d,x1,y1,x2,y2,col,a,b} shape the app has always used.
        centre, existing = parse_source_svg(key)
        edges = []
        for (a, b), tags in existing.items():
            m = edge_line_re.search(tags[0])
            if not m: continue
            d, col = m.group(1), m.group(2)
            coords = re.findall(r'[\d.\-]+', d)
            x1,y1 = float(coords[0]), float(coords[1])
            x2,y2 = float(coords[4]), float(coords[5])
            edges.append({'d': d, 'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'col': col, 'a': a, 'b': b})
        geom[key] = {'centre': centre, 'edges': edges}

    for key in RECORDS:
        centre, edges, default_count = build_ranked_geometry(key)
        geom[key] = {'centre': centre, 'edges': edges, 'defaultCount': default_count, 'totalCount': len(edges)}
        write_background_svg(key)
        print(f"{key}: total candidates={len(edges)}  defaultCount(v8-equivalent)={default_count}")

    with open(GEOM_JS, 'w') as f:
        f.write('window.DISC_GEOMETRY = ' + json.dumps(geom) + ';\n')
    print('\nWrote', GEOM_JS)

if __name__ == '__main__':
    main()
