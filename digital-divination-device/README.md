Project Overview (Current)

Digital Divination Device (DDD) is an offline-first, deterministic ritual art machine implemented as a static web application. It guides a single participant through a deliberately paced, machine-controlled ritual that culminates in the production of symbolic artifacts.

DDD is explicitly not a game, editor, personality test, or narrative simulator. It is a constrained ritual apparatus: the machine governs timing, progression, and judgment. User agency is limited to binary inputs that are interpreted by fixed, deterministic rules into pre-authored outcomes.

The system is state-machine driven, strictly linear, and operates entirely client-side with no server dependencies. All outputs are asset-based and pre-rendered; the system does not explain its logic, adapt to users, or permit reinterpretation during runtime.

Foundational MVP Status (v0)

The original MVP (v0) is complete and validated. It successfully established the core ritual machinery, including:

A fully linear, enforced state-machine flow

Five binary choice rounds with deterministic outcome mapping

Camera-based portrait and pose capture

Generation of three ritual artifacts:

Photo strip

Sticker sheet

Talisman

Unskippable pacing and deliberate temporal control

Offline-first, single-session execution

v0 proved the system works end-to-end as a ritual machine.

Current MVP Phase (v1)

The project is now in MVP v1, which builds directly on the completed v0 foundation.

v1 does not introduce new systems, logic, or interaction models. Its purpose is to finalize and clarify ritual output delivery by refining pacing, transitions, and artifact composition so the machine’s judgment reads as intentional rather than provisional.

Current focus areas include:

Output pacing and dwell time refinement

Visual stability and aspect-correct artifact composition

Deterministic integration of camera-captured images into final outputs

Smoother, more legible transitions between ritual phases

Elimination of rushed, distorted, or placeholder-feeling presentation

The underlying architecture, constraints, and state discipline established in v0 remain binding and unchanged.

Design Ethos

DDD treats constraint as a feature. The ritual is not optimized for convenience, speed, or user comprehension. Instead, it prioritizes:

Machine authority over user control

Determinism over variability

Pacing over responsiveness

Judgment over explanation

The experience ends in finality. The machine does not ask follow-up questions, justify its conclusions, or allow retries.

Technical Characteristics

Platform: Static web application

Architecture: ES6 modules, no build step

Execution: Offline-first, client-only

Flow Control: Linear state machine with enforced transitions

Data: Deterministic rules + pre-authored assets

Session Model: Single-session ritual, no resume or replay