# Where this goes

**Build none of this yet.** It is here so architectural decisions are made
knowing what they will have to carry, not so the first milestone tries to reach
it. The crate is the proof. Everything below is what the proof is *for*.

If a design choice would make one of these stages impossible later, choose
differently now. If it would only make one of them *harder*, that is fine —
ship the crate.

## Stage 2 — Backward, to the tree

    forest → tree → logging → log transport → sawmill → lumber → crate

A person should be able to follow one board backward to the tree it came from.
The lineage architecture has to support extending behind lumber later, which is
why `origin` is a link rather than a string.

## Stage 3 — Forward, to the customer

    finished crate → warehouse → transport → store → customer

The store is not scenery. Products are persistent objects, shelves hold real
inventory, registers work, and the crate has an actual position in stock.

## Stage 4 — Harder things than crates

Electronics is the target that proves the architecture generalises: PCB, solder
paste, feeders, vision alignment, pick, rotate, place, reflow, inspection. A
finished board should contain individually addressable components at real
coordinates, not a texture implying them.

Open references worth studying when the time comes: OpenPnP, LumenPnP, KiCad
hardware projects, FreeCAD mechanical designs.

## Stage 5 — Pages become worlds

One site holds many addressable environments:

    /world/forest   /world/sawmill   /world/crate-factory
    /world/warehouse   /world/store

An object reaches a tunnel or transfer boundary. Its state is serialised. The
first world records the departure and removes it locally. The destination
receives the manifest and reconstructs the same object, with its identity,
components, modifications and history intact.

To a person: a truck drives into a dark tunnel in one world and comes out of a
tunnel in another. Underneath it is a manifest crossing a boundary.

**This is the reason identity and determinism have to be right in V1.** It is
the part that cannot be retrofitted.

## Stage 6 — Destination decides transformation

    object → junction → factory A | B | C | D

Where a thing travels determines what it becomes. Factories are physical
manifestations of deterministic functions, and different products traverse
different manufacturing graphs. Still no runtime AI.

## Stage 7 — Beyond physical goods

Only after manufacturing has proven it. The underlying primitive is:

    identity + state + transport + transformation + lineage

A thing is created. It moves. A deterministic process changes it. It moves
again. Its history survives. Its destination can depend on what it became.

Physical manufacturing is the clearest possible proof of that primitive. Do not
abstract toward it early and lose the working simulation.

## The question the whole thing exists to answer

Point at a finished object and ask where it came from, and get a real answer —
assembled at factory three, panels from factory two, boards cut from lumber
0081, eventually log 0017, eventually tree 0004. Then ask where it went, and
follow it to a shelf.

The reaction being aimed for is not "that factory looks realistic." It is:
*"that board was actually cut, that robot actually grabbed it, those nails
actually connect those boards, and this crate really is the pieces I watched
travel."*
