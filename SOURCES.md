# Sources

Every number in `/knowledge` is either taken from a source listed here, or marked
`origin: "original"` in the spec file and justified in place. Nothing is
eyeballed silently.

Each entry records **what it informed** and **its licence**. Where a real machine
cannot legally be redistributed, its published engineering principles were used
to build an original equivalent — no proprietary geometry was copied.

---

## S1 — Wood Crate Design Manual (USDA Agriculture Handbook No. 252)

- **Publisher:** U.S. Department of Agriculture, Forest Service, Forest Products
  Laboratory, 1964.
- **URL:** https://www.fpl.fs.usda.gov/documnts/usda/ah252.pdf
- **Licence:** Work of the U.S. federal government — **public domain** in the
  United States (17 U.S.C. § 105).
- **Retrieved:** 2026-08-15. Local extraction: 134 pages, text layer present.

**Informed:**

- `knowledge/fastener/nailing-rules.js` — the numbered general nailing rules,
  pp. 17–19. Specifically rules 4 (clinch allowances ¼ / ⅜ / ½ in by nail size,
  clinch when combined thickness ≤ 3 in), 5 (no clinch above 3 in; 10d and
  smaller penetrate 2 to 2½ × the thickness of the piece holding the nail head;
  12d and larger penetrate at least 1½ in), 7 (edge distance ≥ ½ the piece
  thickness, end distance ≥ the piece thickness), 8 (two or more rows, or
  stagger within a row), 10 (plywood to struts: ≤ 3 in on centre, rows staggered
  ≥ ¾ in apart), 11 (rows by contact width — one row ≤ 2 in, two rows > 2 in and
  < 6 in, three rows ≥ 6 in), 15 (at least two nails through each sheathing
  board into each member it crosses), 16 (butt joints centred on a frame member,
  two staggered rows of clinched nails).
- `knowledge/crate/crate-ow-c1.js` — the cleated-panel construction pattern:
  sheathing over a frame of cleats and struts, panels fabricated first and
  assembled after, sides lapping ends at the corner so that at least one set of
  nails is always in lateral resistance (p. 44, fig. 32).
- `knowledge/material/lumber.js` — the S1S/S2S/S1E/S2E dressing vocabulary and
  the rule that crate members are nominally 1 in or 2 in thick.
- `knowledge/process/` — the fabricate-then-assemble stage split.

**Note on dressed sizes:** AH-252 is from 1964 and its glossary gives a nominal
2×4 as 1⅝ × 3⅝ in. That predates the current standard. Dressed dimensions in
`knowledge/material/lumber.js` come from **S3** instead, and the divergence is
recorded there.

**Verification:** the ¼ / ⅜ / ½ inch clinch fractions were confirmed by reading
p. 21 of the PDF as an image, because the text layer renders vulgar fractions as
mojibake. See `knowledge/fastener/nailing-rules.js` header.

---

## S2 — Wood Handbook: Wood as an Engineering Material, Chapter 8 (Fastenings)

- **Publisher:** U.S. Department of Agriculture, Forest Service, Forest Products
  Laboratory. General Technical Report FPL-GTR-190, 2010. Chapter 8 by
  Douglas R. Rammer.
- **URL:** https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_08.pdf
- **Licence:** Work of the U.S. federal government — **public domain** in the
  United States.
- **Retrieved:** 2026-08-15.

**Informed:**

- `knowledge/fastener/nails.js` — Table 8–1 (bright common wire nails) and
  Table 8–2 (smooth box nails), complete, in millimetres as published. These
  tables give length and shank diameter directly in mm; no conversion was
  performed by us.
- `knowledge/fastener/nails.js` — lead-hole rule: a lead hole of approximately
  **90 %** of the nail shank diameter.
- `knowledge/fastener/nailing-rules.js` — corroborates AH-252 on clinching, and
  supplies the statement that clinching is generally confined to boxes, crates
  and other container applications.

---

## S3 — Voluntary Product Standard PS 20, American Softwood Lumber Standard

- **Publisher:** U.S. Department of Commerce / National Institute of Standards
  and Technology, administered by the American Lumber Standard Committee.
- **URL:** https://www.nist.gov/document/doc-ps-20-20-american-softwood-lumber-standard-revision-1-oct-2021
- **Licence:** Work of the U.S. federal government — **public domain** in the
  United States. The dimensions themselves are facts, not expression.

**Informed:**

- `knowledge/material/lumber.js` — minimum dressed dry sizes for nominal
  softwood lumber: nominal 1 in → 19.0 mm (¾ in) thick; nominal 2 in → 38.1 mm
  (1½ in) thick; nominal 4 in → 88.9 mm (3½ in) wide; nominal 6 in → 139.7 mm
  (5½ in) wide.

---

## S4 — Universal Robots ROS 2 description package

- **Publisher:** Universal Robots A/S, `UniversalRobots/Universal_Robots_ROS2_Description`.
- **URL:** https://github.com/UniversalRobots/Universal_Robots_ROS2_Description
- **Licence:** **BSD-3-Clause** for the description package. (The repository
  notes that some *mesh* assets carry Universal Robots' own graphical
  documentation terms — **no meshes were used**. Only the numeric kinematic and
  limit parameters were read.)
- **Files read:** `config/ur5e/default_kinematics.yaml`,
  `config/ur5e/joint_limits.yaml`, `config/ur5e/physical_parameters.yaml`,
  `LICENSE`.
- **Retrieved:** 2026-08-15.

**Informed:**

- `knowledge/robot/arm-6r.js` — the link offsets of a 6R industrial arm:
  shoulder z 162.5 mm, upper-arm length 425.0 mm, forearm length 392.2 mm,
  wrist-1 z 133.3 mm, wrist-2 y 99.7 mm, wrist-3 y 99.6 mm; joint position
  limits (±360° on joints 1, 2, 4, 5, 6 and ±180° on the elbow, the elbow being
  limited by the physical construction of the arm); velocity limit 180 °/s on
  every joint; effort limits 150 N·m on the three proximal joints and 28 N·m on
  the three wrist joints; link masses 3.761 / 8.058 / 2.846 / 1.370 / 1.300 /
  0.365 kg.
- Its own upstream sources, recorded in `joint_limits.yaml`, are the UR5e user
  manual and Universal Robots' published max-joint-torque article.

**What was *not* taken:** no geometry, no meshes, no appearance. The arm in
`knowledge/robot/arm-6r.js` is an original design that shares these published
kinematic parameters, and is named `OW-A6` rather than after any product.

---

## S5 — Reinforcement of wood pallets with metal connector plates

- **Authors:** John W. Clarke, Thomas E. McLain, Marshall S. White,
  Philip A. Araman. Published in *Forest Products Journal*; distributed by the
  USDA Forest Service research archive.
- **URL:** https://research.fs.usda.gov/download/treesearch/49.pdf
- **Licence:** U.S. Forest Service research distribution. The **dimensions used
  are facts** about a commodity pallet, not protected expression; no text or
  figure was reproduced.
- **Retrieved:** 2026-08-15.

**Informed:**

- `knowledge/pallet/stringer-pallet.js` — a 48 × 40 in stringer-class, flush,
  non-reversible pallet with partial four-way entry: three stringers 1½ in wide
  × 3½ in high × 48 in long; two notches per stringer located 6 in from each
  end, 1½ in deep, 9 in long, with ½ in fillet radii; seven top and five bottom
  deckboards, all ⅝ in thick.

The 1219 × 1016 mm (48 × 40 in) plan dimension is one of the principal flat
pallet plan dimensions recognised in ISO 6780. ISO 6780 itself is a paid
standard and **was not consulted**; only the dimension, which is a fact, is used.

---

## S6 — Industrial circular saw blade catalogue data

- **Publisher:** Freud (blade LU2B16, 350 mm × 84 T carbide-tipped, for ripping
  and crosscutting), as listed by retailers.
- **URL:** https://www.amazon.com/350mm-Tooth-Carbide-Tipped-Blade/dp/B00AHVUNTU
- **Licence:** Catalogue dimensions are **facts**, not protected expression. No
  drawing, image or descriptive text was copied.

**Informed:**

- `knowledge/saw/crosscut-saw.js` — blade diameter 350.0 mm, **kerf 3.5 mm**,
  plate thickness 2.5 mm, 84 teeth.

Everything else about the saw — envelope, table height, feed rate, clamp
positions, guarding, control positions — is marked `origin: "original"` in that
file and justified there.

---

## S7 — Conveyor roller planning data

- **Publisher:** Interroll Group (Series 1100 gravity rollers; conveyor roller
  planning basics), and Monk Conveyors roller conveyor technical manual.
- **URLs:**
  - https://www.interroll.com/products/unit-handling/rollers-and-wheels/series-1100-gravity/
  - https://www.monk-conveyors.com/wp-content/uploads/2020/04/roller-conveyors-technical-spec.pdf
- **Licence:** Catalogue and planning **figures are facts**. No text, drawing or
  image was copied.

**Informed:**

- `knowledge/conveyor/roller-conveyor.js` — roller pitch 75.0 mm; conveying
  speed 0.30 m/s as a documented maximum for this class of light-to-medium
  duty conveyor.

---

## S8 — Two-finger parallel gripper class data

- **Publisher:** Robotiq (2F-85 adaptive gripper), manufacturer published
  specification.
- **URL:** https://assets.robotiq.com/website-assets/support_documents/document/online/2F-85_2F-140_TM_InstructionManual_HTML5_20190503.zip/2F-85_2F-140_TM_InstructionManual_HTML5/Content/1.%20General_Presentation.htm
- **Licence:** Published performance **figures are facts**. No geometry, drawing
  or text was copied.

**Informed:**

- `knowledge/robot/gripper-2f.js` — stroke 85.0 mm, grip force programmable
  20–235 N, closing speed up to 150 mm/s, payload 5.0 kg, repeatability
  0.05 mm, mass 1.3 kg.

The gripper geometry in that file is an original parallel-jaw design named
`OW-G2` built to those performance figures.

---

## Sources deliberately **not** used

| Source | Why not |
|---|---|
| ISO 6780 (pallet plan dimensions) | Paid standard. Only the 48 × 40 in plan dimension is used, and that is a published fact available from **S5**. |
| ISO 2328 (fork arm mounting dimensions) | Paid standard, not consulted. Fork tine cross-section in `knowledge/vehicle/forklift.js` is `origin: "original"`, sized to fit the **S5** pallet openings with a stated clearance. |
| ASTM F1667 (nail specification) | Paid standard. Nail dimensions come from **S2**, which publishes them in the public domain. |
| ASTM D6039 / D6251 (crate standards) | Paid standards. Crate construction principles come from **S1**. |
| Manufacturer CAD / STEP files | Redistribution not permitted. All geometry in this repository is original. |

---

## How to check this file

`tools/validate-knowledge.mjs` fails if any spec object carries a `source` key
naming an id that does not appear in this file, or omits `source` entirely.
Sourcing is enforced, not promised.
