# Origin Works

A Three.js world where manufactured things are actually manufactured.

A wooden shipping crate is not spawned as a finished mesh. Lumber arrives as
stock. It is measured and cut, and the cut is accounted for down to the kerf.
The resulting boards are separate physical objects with their own identities. A
robot reaches out and picks one up. A truck carries it down a road. It becomes
part of a panel, the panel becomes part of a crate, and the crate can still tell
you which board is which and where each one came from.

The point is not that the factory looks realistic. It is that pointing at the
finished crate and asking **"where did this come from?"** returns a real answer.

## Status

**Specification layer written and verified. No geometry yet — that is the next
gate, deliberately.**

Live spec review: **https://jaronkbragg7337.github.io/origin-works/spec/**

`/knowledge` holds the measurements the geometry will be generated from, in
millimetres, through one central conversion in
[`knowledge/units.js`](knowledge/units.js). Every source and its licence is in
[`SOURCES.md`](SOURCES.md).

```bash
node tools/validate-knowledge.mjs
```

107 checks pass. It recomputes every derived dimension, re-derives every
fastener from the nailing rules in the USDA crate manual, balances the material
against the kerf, and checks the fits the completion test asks about. It found
two real problems and both were fixed in the spec rather than in the test.

Crate OW-C1: 838.2 × 800.0 × 577.8 mm, 48 wooden parts, 252 nails, 50.3 kg,
86.48 % material yield from 15 sticks of stock.

The first milestone is one map, three factories, and a complete production cycle
that runs start to finish and repeats — verified against the assembly graph
rather than by watching it look right.

## Reading order

1. **[AGENTS.md](AGENTS.md)** — the invariants. Short. These are the things that
   must not be simplified away.
2. **[V1-TEST.md](V1-TEST.md)** — the definition of done: 82 checkable items,
   each a yes or no, verified against the assembly graph rather than by watching
   it look right.
3. **[VISION.md](VISION.md)** — where this eventually goes: backward to the
   tree, forward to the shop shelf, and eventually across pages that behave like
   separate worlds. Read it before choosing architecture; build none of it yet.
4. **[knowledge/README.md](knowledge/README.md)** — the specification layer that
   the geometry is generated from, and the first thing to be filled in.

## Built for phones as much as desktops

Not as a later optimisation pass. Mobile is a primary target from the first
commit.
