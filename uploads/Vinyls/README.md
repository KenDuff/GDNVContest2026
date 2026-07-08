# Disc art + density slider

Five records (orange, blue, crimson, teal, indigo -- the ones with a
working density slider; silver/gold don't show one) work like this:

- `backgrounds/{key}.svg` -- decoration only (rings, labels, node markers),
  no tie-lines baked in. Always the image shown.
- `js/disc-geometry.js` -- every real candidate tie for that record from
  the CSVs here, ranked strongest/most-relevant first, each with its
  rendering already computed (curve, colour, width, opacity). The app
  slices this list live to however many ties the slider currently calls
  for and draws them as an SVG overlay on top of the background -- so the
  slider is genuinely continuous, not a handful of preset images.

Data sources per record:
- **orange** (Strangers): `edges_total_all_years.csv`, weakest ties first
- **blue** (Friends): `edges_mutual_blocs.csv`, strongest mutual score first
- **crimson** (Jury's Ear): `edges_jury_vs_public.csv` (jury rows)
- **teal** (Public's Heart): `edges_jury_vs_public.csv` (public rows)
- **indigo** (Divergence): `edges_jury_public_divergence.csv`, coloured by
  which side (jury/public) favoured the pair more

Every tie already present in the record's original artwork is reused
byte-for-byte (same curve/colour/width/opacity the artist's file had).
Only ties beyond what the original art drew get a generated style, fitted
from that same original art.

silver/gold are untouched -- single file each, real ties still baked in,
no slider. generate.py reads their geometry straight from
uploads/Vinyls/{silver,gold}.svg (the same files index.html serves) rather
than keeping a separate copy, since they're never regenerated.

To regenerate everything (e.g. after editing a CSV, or tweaking the
source SVGs in ../../source_svgs/): `python3 generate.py`. Safe to re-run
any time -- always reads fresh from source_svgs/ and the CSVs, never from
its own prior output.
