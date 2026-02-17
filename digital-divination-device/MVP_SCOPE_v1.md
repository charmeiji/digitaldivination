MVP_SCOPE_v1 — Expanded Ritual Output

Project: Digital Divination Device
Status: ACTIVE MVP
Supersedes: MVP_SCOPE.md (v0)
Relationship: v0 is complete and foundational. v1 refines outputs and ritual delivery only.

1. Purpose

MVP v1 formalizes the final ritual output experience of Digital Divination Device.

The original MVP (v0) successfully established:

A complete linear ritual loop

Deterministic choice → outcome logic

Camera-based capture

Artifact generation

Enforced pacing and state discipline

v1 does not expand the system.
It tightens, clarifies, and finalizes how judgment is delivered.

This scope exists to eliminate provisional behavior, rushed outputs, and visual ambiguity—without altering the underlying machine.

2. Core Principle

The ritual already works.
v1 makes the ritual legible.

All changes must preserve:

Determinism

Linear progression

Machine authority

Asset-based outcomes

Offline-first operation

3. In-Scope (v1)
3.1 Output Pacing Refinement

Output states (photo strip, sticker sheet, talisman) must:

Provide sufficient dwell time for visual absorption

Use gradual, intentional transitions

Avoid rapid or abrupt progression

Timing adjustments are permitted only to improve legibility and ritual weight

No output may be skippable

3.2 Artifact Composition Finalization

Photo Strip

Correct image scaling and aspect ratio

No visual squashing or distortion

Background color standardized (white unless explicitly overridden)

Deterministic layout rules only

Sticker Sheet

Sticker placement follows fixed composition rules

User portrait may be embedded as a sticker if already captured

No randomness, shuffling, or physics-based layout

Talisman

Presentation pacing refined

Visual framing treated as final judgment, not UI output

3.3 Camera Capture Integration

Portrait and pose captures are treated as ritual acts, not utilities

Required guarantees:

Clear framing

Stable countdown timing

Consistent capture delay

Reliable insertion into final artifacts

The following are explicitly supported:

Single portrait capture

Three-pose sequence (hear no evil / see no evil / speak no evil)

Deterministic use of captured images in the photo strip

3.4 Transition Smoothing

Transitions between:

Pre-ritual → camera

Camera → rounds

Confirm states → ritual start

Output states

must be gradual, intentional, and paced

Hard cuts are allowed only when symbolically justified (e.g., white flash)

3.5 Visual Cleanup (Non-Expansive)

Permitted:

Background color corrections

Spacing and margin fixes

Alignment corrections

Placeholder neutralization

Not permitted:

New visual systems

Theming support

Customization controls

4. Explicit Non-Goals (v1)

The following are out of scope and must not be introduced:

New rounds or altered round count

Non-binary choices

Branching logic or alternate endings

Explanatory or interpretive text

User profiles, saving, or replay

Sharing, printing, or social features

Audio systems (music, SFX)

Accessibility or localization passes

Procedural or AI-generated imagery

New state machine concepts

If it was not already structurally present in v0, it does not belong in v1.

5. Architectural Constraints (Still Binding)

v1 inherits all v0 constraints, including but not limited to:

Linear state machine with enforced transitions

Exactly five binary rounds

Deterministic computation (no runtime randomness)

Asset-based outcomes (32 bitstrings)

Offline-first, client-only execution

No undo, no back navigation

No skipping enforced waits

Violating these constraints invalidates v1.

6. Success Criteria (v1)

MVP v1 is complete when:

All outputs feel intentional, paced, and final

Camera captures are consistently embedded into artifacts

Artifact layouts are visually stable and deterministic

No output appears rushed, distorted, or provisional

The ritual ends with a clear sense of judgment and closure

No new systems were required to achieve the above

7. Scope Discipline Rule

If a proposed change:

Adds a new system

Introduces variability

Requires explanation

Increases user control

It is out of scope for MVP v1.

End of MVP_SCOPE_v1