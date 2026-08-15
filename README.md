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

Setting up. Nothing built yet.

The first milestone is one map, three factories, and a complete production cycle
that runs start to finish and repeats — verified against the assembly graph
rather than by watching it look right.

## Reading order

1. **[AGENTS.md](AGENTS.md)** — the invariants. Short. These are the things that
   must not be simplified away.
2. **[VISION.md](VISION.md)** — where this eventually goes: backward to the
   tree, forward to the shop shelf, and eventually across pages that behave like
   separate worlds. Read it before choosing architecture; build none of it yet.
3. **[knowledge/README.md](knowledge/README.md)** — the specification layer that
   the geometry is generated from, and the first thing to be filled in.

## Built for phones as much as desktops

Not as a later optimisation pass. Mobile is a primary target from the first
commit.
