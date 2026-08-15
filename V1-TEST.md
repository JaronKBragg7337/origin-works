# The V1 completion test

V1 is done when every box below is true, **verified against the state and
assembly graph rather than by watching it happen.** A cinematic that looks
correct is not a pass. If the graph cannot prove it, it did not happen.

Each item is a yes or no on purpose. Where a number is needed, the specification
in `/knowledge` supplies it, and the answer is a measurement, not an opinion.

Report the whole list at the end with an honest verified / could-not-verify /
skipped split. "Could not verify" is a respectable answer. Claiming a pass you
did not measure is not.

---

## A. Material exists and is conserved

1. Raw lumber exists as stock with real dimensions from `/knowledge`.
2. Stock has an id before anything is done to it.
3. A cut produces the pieces the recipe asked for.
4. Every produced piece has its own id.
5. Kerf is removed from the material, not ignored.
6. Offcut and waste are **real objects**, not deletions.
7. Input length equals the sum of outputs plus kerf plus offcut, within the
   tolerance `/knowledge` states.
8. A piece cut in half yields two pieces whose combined mass or volume equals
   the original's, less kerf.
9. Nothing is created that had no source.

## B. Identity and lineage

10. Every board, fastener, panel and crate carries a permanent id.
11. Ids are never reused, including across repeated production cycles.
12. Every piece records what it was cut from.
13. Both pieces from one cut trace back to the same parent stock.
14. Joining an assembly does not erase a component's identity.
15. Selecting a finished crate returns its full component tree.
16. Selecting any component returns its path back to raw stock.
17. Each object carries a history of the operations performed on it, in order,
    with the stage that performed each.
18. Lineage survives a reload if any persistence exists.

## C. Cutting

19. The saw is positioned against the measured cut line before cutting.
20. The blade actually crosses the cut plane.
21. The blade rotates while cutting.
22. Cut faces appear where the cut was, not where the mesh was convenient.
23. Resulting dimensions match the recipe within tolerance.
24. Stock is supported or fixtured during the cut, not floating.

## D. Robots

25. The robot is an articulated chain: base, joints, links, wrist, tool flange,
    end effector.
26. Each joint rotates about its own declared axis.
27. No joint exceeds its declared limits during any motion.
28. The end effector physically reaches the part; nothing teleports into a
    gripper.
29. The gripper closes onto the part's actual width, not to a fixed pose.
30. The gripped part moves with the gripper and does not drift or interpenetrate
    it.
31. The robot does not pass through fixtures, machines, or its own body.
32. A part outside the reach envelope is refused rather than stretched to.

## E. Transport

33. Loaded pieces sit within the vehicle's declared bed bounds.
34. Nothing floats above the bed or sinks into it.
35. The load stays with the vehicle for the whole journey.
36. The vehicle follows the road rather than crossing terrain or buildings.
37. All wheels contact the ground for the whole journey.
38. The vehicle fits through every opening it drives through.
39. Unloaded pieces are the same objects, with the same ids, that were loaded.

## F. Fasteners

40. A fastener is a real component with diameter, length, head and axis — not a
    texture or a decal.
41. Its axis is perpendicular to the joint face, or at the angle the joint
    specifies.
42. It penetrates **both** parts it is supposed to connect.
43. Insertion depth meets the specification.
44. It does not protrude through the far face unless the design says it should.
45. Both connected parts list the fastener, and the fastener lists both parts.
46. The number of fasteners in a joint matches the bill of materials.
47. Penetration by a fastener is an **allowed, scoped** contact case — see
    section H — and not a globally disabled collision.

## G. Assembly

48. Panels are built from the boards and cleats the bill of materials names, and
    only those.
49. Boards that the design says touch are touching, within tolerance.
50. Assembled panel dimensions match the specification within tolerance.
51. A panel remains a container of addressable parts, not a merged mesh.
52. The crate is assembled from its panels, base and lid in a valid order —
    nothing is fastened to something not yet present.
53. Finished crate dimensions match the specification within tolerance.
54. The completed crate can be handled as one object while every component stays
    addressable.

## H. Physical coherence

55. No object floats unsupported.
56. No two solid objects interpenetrate outside a declared operation.
57. Where interpenetration is intended — a nail entering wood, a blade cutting
    stock, a drill bit, an insertion fit — it is scoped to the participating
    objects, the tool, the region and the duration, via collision groups or
    operation state, **never** by switching collision off globally.
58. The resulting penetration is still validated: the nail is in the wood, to
    the right depth, on the right axis.
59. When the operation ends, normal collision resumes for those objects.
60. Contact tests use the tolerances in `/knowledge`, not exact equality.
61. Forklift tines fit pallet openings; parts fit fixtures; the geometry agrees.

## I. Process and state

62. Production runs from recipes and state machines, not one long timeline.
63. Every object is in a legal state for where it is.
64. No object is in two places, or in two assemblies, at once.
65. A robot or machine acts only on a part actually presented to it.
66. Stages hand off explicitly; nothing advances because a timer said so.
67. An interrupted cycle can resume or fail cleanly, without orphaning parts.
68. The same seed and the same inputs produce the same result.
69. No model is in the loop at runtime.

## J. It repeats

70. A second crate is produced with no intervention.
71. The second crate's components have entirely fresh ids.
72. Ten consecutive cycles complete without stalling.
73. Object count returns to a steady state between cycles — nothing leaks.
74. Material accounting still balances after ten cycles.

## K. It can be inspected

75. Any object can be selected and shows id, type, dimensions, position,
    rotation, state, stage, parent, children, connections, fasteners, collision
    bounds, interaction points, history and origin.
76. Every claim in sections A to J is checkable from that inspector, without
    reading the console.
77. Debug overlays — bounding volumes, axes, connection points, joint axes,
    reach envelopes, paths, contact tests — can be switched on and off.
78. A validation report lists any floating, interpenetrating or orphaned object,
    and reads clean at the end of a cycle.

## L. It runs where it will be seen

79. It loads and runs on a phone.
80. It loads and runs on a desktop.
81. Frame rate is measured and reported at a phone viewport, with a full cycle
    running — a number, not an impression.
82. Any fidelity reduction for mobile is a measured decision, with the number
    that justified it.

---

## What a pass looks like

Not "the factory looks convincing." This:

> That board was actually cut. The offcut is still on the floor. That robot
> reached for it, closed on its real width, and carried it. Those nails go
> through both boards to the depth the drawing says. This crate is the pieces I
> watched travel. And the graph says so, without me taking anyone's word for it.
