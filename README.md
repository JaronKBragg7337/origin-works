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

**The world runs.** One map, a road, three factories, and a cycle that cuts
real lumber, builds real panels and assembles a crate — with the assembly graph
able to prove it.

- **Live:** https://jaronkbragg7337.github.io/origin-works/
- **Measurements:** https://jaronkbragg7337.github.io/origin-works/spec/

```bash
node tools/validate-knowledge.mjs   # 109 checks on the specification
node tools/run-cycle.mjs            # runs a full cycle headless, checks the graph
```

`/knowledge` holds the measurements the geometry is generated from, in
millimetres, through one central conversion in
[`knowledge/units.js`](knowledge/units.js). Every source and its licence is in
[`SOURCES.md`](SOURCES.md). `/src` generates every object from those numbers —
there is no modelled geometry anywhere in the repository.

### What one cycle produces, measured

| | |
|---|---|
| Stock in | 15 sticks, 39 014.4 mm |
| Cuts | 48, each a scoped operation with the blade proven across the stock |
| Pieces / kerf / offcut | 48 / 48 / 15 objects, all with permanent ids |
| Material balance | **0.000 mm error** |
| Nails driven | 112, penetration 44.50 mm, axis error 0.000° |
| Crate | 148 addressable leaf parts under one id |
| Graph nodes | 278, ids never reused |
| Determinism | identical step count and id distribution across runs |

### Known defects

Reported rather than hidden, because a validation report that reads clean by
omission is worse than one that fails.

- 66 interpenetrations and 2 floating objects remain at the end of a cycle. The
  panel internal layout is approximate, so once panels are stood up as walls
  some boards overlap by one board thickness (19 mm).
- The truck and forklift are built and drivable but the cycle does not yet use
  them; stages hand off by manifest without the road journey between them.
- Ten consecutive cycles (V1-TEST J72) have not been run.

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
