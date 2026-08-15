# The specification layer

**Geometry is generated from what is in here. Not the other way round.**

This is the difference between modelling reality from appearance and modelling
the measurements, mechanisms and constraints that *produce* the appearance. An
agent given a board's real dimensions, grain direction, grasp points and
fastener zones can build a board, place it, cut it, and check that a nail went
through it. An agent given a picture of a board can only make something
board-shaped.

## Fill this in before building the thing it describes

The first deliverable of this project is this directory, researched and written,
reviewed before any significant geometry exists. Expect a shape roughly like:

    knowledge/
      crate/      dimensions, bom, materials, joints, fasteners,
                  process, tolerances, connection-points,
                  interaction-points, collision-spec, sources
      lumber/     stock sizes, species properties, kerf allowances
      saw/        envelope, blade, kerf, feed, controls, guarding
      robot/      links, joints, joint-limits, reach-envelope,
                  end-effector, controls, collision-spec
      vehicle/    dimensions, bed bounds, wheelbase, controls
      conveyor/   speed, width, roller pitch, transfer points

Reorganise if a better structure emerges. The principle is what matters, not
this exact tree.

## Units

Millimetres are authoritative. One central conversion to Three.js world units,
used everywhere. No scale multipliers scattered through the code.

## Every significant asset should know

dimensions · position · orientation · local coordinate frame · centre of mass
where useful · connection points · interaction points · collision representation
· parent and children

## Three geometries, not one

- **Render** — what a person sees.
- **Collision** — boxes, capsules, cylinders, convex hulls. Simple and reliable.
  Not the visual mesh unless there is a reason.
- **Interaction** — the precise regions that mean something: handles, switches,
  grab points, sockets, insertion points, seats, work surfaces, tool interfaces.

## Sources

Research before modelling. Prefer, in order: government publications,
manufacturer technical drawings and manuals, engineering documentation,
university and research material, open-source hardware, permissively licensed
CAD, CC0 assets.

Record what each source informed, and its licence, in `SOURCES.md` at the repo
root. If a real machine cannot legally be redistributed, use its published
engineering principles to build an original equivalent — do not copy proprietary
geometry.
