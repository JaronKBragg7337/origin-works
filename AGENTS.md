# Invariants

Short on purpose. These are the things that, if simplified away, mean the
project stopped being itself. Everything else is open — better architecture,
better maths, better geometry are all welcome and expected.

1. **Nothing magically becomes finished.** Every object is assembled from parts
   that existed before it. No spawning a completed mesh and calling it
   manufactured.

2. **Identity is permanent.** Every board, fastener, panel and crate has an id
   it keeps forever, including after it joins a larger assembly. A finished
   crate can be asked what it is made of and where each piece came from.

3. **The hierarchy survives.** Do not flatten an assembly into one mesh. A panel
   contains its boards and its nails, addressably, after it is built.

4. **Measurements come first.** Geometry is generated from specifications in
   `/knowledge`, in millimetres, through one central conversion. The world is
   not eyeballed and then measured afterwards.

5. **Contact is real.** Nothing floats, interpenetrates, or acts on a workpiece
   it is not touching. Grippers close on parts. Nails intersect both boards.
   Wheels touch the ground. Validate with tolerances, not exact equality.

6. **If it looks functional, it works.** No painted-on buttons, levers, doors or
   controls. Where something is modelled as operable, it operates.

7. **Deterministic, no runtime AI.** Factories run from recipes and state
   machines. The same input produces the same output, every time, with no model
   in the loop.

8. **Phone and desktop, from the first commit.** Not a later optimisation pass.
   Mobile is a primary target, not a degraded one.

9. **One map until the full cycle works.** Multi-page transport is designed for
   but not built until a single crate completes the whole run repeatedly.

10. **A cinematic is not a pass.** The state and assembly graph must confirm
    what happened. If the graph cannot prove it, it did not happen.

    This is about the state being real, not about animation being banned.
    Keyframes, tweens, animation mixers and instancing are all fine and
    expected. What is not fine is a timeline being the *only* thing that
    happened — a crate fading in on cue while nothing underneath knows a board
    was ever cut.

## Reading order

- `V1-TEST.md` — the definition of done. 82 items, each a yes or no.
- `VISION.md` — where this eventually goes. Read it before choosing
  architecture. **Build none of it yet.**
- `knowledge/README.md` — the specification layer and what belongs in it.
