# Digital Divination Device — MVP Scope (LOCKED)

**Version:** v0  
**Status:** HARD LOCK  
**Purpose:** Prevent scope drift during initial implementation

This document defines the minimum viable product.  
Anything not listed here is explicitly out of scope.

---

## 1. Product Definition

**Digital Divination Device** is an offline-first ritual art machine.

It produces symbolic artifacts through constrained binary choices.

It is:
- Not a game
- Not an editor
- Not a personality test
- Not a narrative simulator

The system controls pacing, judgment, and outcome.

The user submits.  
The machine decides.

---

## 2. Core Experience

### Session Structure
- Single-user
- Solo session
- One continuous ritual
- Cannot be restarted mid-session

### Duration
- ~5 minutes minimum
- Pacing enforced by the system
- No skipping, no fast-forward

---

## 3. Input System

### Choice Rounds
- **5 total rounds**
- **2 choices per round**
- Choices are:
  - Binary
  - Mutually exclusive
  - Presented visually (images only)

### Input Rules
- One choice per round
- No undo
- No back navigation
- No explanation of meaning
- No text-based choices

Each round produces **1 binary value (0 or 1)**.

---

## 4. Internal Logic

### Encoding
- Total output is a **5-bit binary sequence**
- Example: `10110`

### Properties
- Deterministic
- No randomness at runtime
- No learning
- No personalization language

Same inputs always produce the same outputs.

---

## 5. Outputs (Artifacts)

Each session produces **exactly three artifacts**.

### 1. Photo Strip (Judgment)
- Pre-rendered image
- Selected deterministically from binary result
- Presented first
- No explanation

### 2. Sticker Sheet (Debris)
- Collection of pre-authored stickers
- Stickers are filtered or selected based on binary result
- Stickers feel incidental, leftover, or revealing
- No rarity mechanics (MVP)

### 3. Talisman (Verdict)
- Omikuji-style artifact
- Single visual outcome
- Presented last
- Treated as final judgment

---

## 6. Presentation Rules

### Tone
- Playfully cruel
- Amused
- Detached
- Ritualistic

### Language Constraints
- No “you are…”
- No trait explanations
- No interpretation guidance
- No scores
- No percentages

The system never explains itself.

---

## 7. UI / Interaction Constraints

- No freeform input
- No sliders
- No text entry
- No settings
- No accessibility modes (MVP)
- No save/load
- No retries

The user either completes the ritual or exits entirely.

---

## 8. Platform & Technical Constraints

- Offline-first
- Runs locally (e.g. `index.html`)
- No cloud services
- No accounts
- No multiplayer
- No analytics
- No procedural AI image generation

All visuals are asset-based.

---

## 9. State Control

- State-machine driven
- Linear progression only
- No branching UI paths
- Fail-safes prevent accidental closure during ritual (where possible)

---

## 10. Explicit Non-Goals (Out of Scope)

The MVP will NOT include:
- Customization
- User profiles
- Explanations or lore dumps
- Theme selection
- Difficulty modes
- Social sharing
- Printing support
- Sound settings
- Localization
- Accessibility compliance
- Expanded symbolism systems

---

## 11. Success Criteria (MVP)

The MVP is considered complete when:
- A user can complete one full ritual start-to-end
- All 5 choices are recorded deterministically
- All 3 artifacts are produced and displayed
- The experience cannot be meaningfully rushed
- No crashes or soft-locks occur

Nothing else is required.

---

## 12. Change Policy

Once implementation begins:
- This document is immutable
- Changes require a new version (v1+)
- MVP is completed **before** iteration

End of scope.