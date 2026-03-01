# Bop Bubble — Design Document
**Round 20 | bop-bubble | Mode: Design**

---

## Identity

**Game name:** bop-bubble  
**Display name:** Bop Bubble  
**Tagline:** *Drift. Don't touch. Never pop.*

---

### Protagonist

**Name:** Sphera  
**Species:** Soap bubble — a single, specific bubble, not a generic one  
**Personality:** Serene and fatalistic. Sphera doesn't panic. She drifts with the confidence of something that knows it was never meant to last long — she just wants to make it count this time.

**Backstory:** Sphera was blown by accident at 7:14 AM when the bathroom window cracked open and the morning draft crossed the forgotten Mr. Bubble wand perched on the soap dish. She has one shot at reaching the skylight vent, four meters above — a distance that might as well be the moon. Every surface in this bathroom has ended her before. This time, she reads the air.

---

### World

A single master bathroom at dawn, seen from bubble-scale: 1 centimeter = a step, 1 meter = a mountain. Underfloor tiles are warming up. The shower just ran and left a ceiling of steam. Chrome faucets and radiator pipes are geography. A hair dryer left on the counter ticks as it cools. The skylight vent at the ceiling glows with cold morning light — Sphera's goal and her exit.

**World feel (2 sentences):** Every surface is a death — the warm tile, the wet chrome, the cold mirror, the soap dish edge — each one instant and absolute. The bathroom is both womb and obstacle course: warm enough to keep Sphera buoyant, busy enough to make each drift a negotiation between steam and gravity and hope.

**Emotional experience:** Meditative dread. The serenity of floating vs. the constant awareness that one millimeter of drift ends everything. A slow-burning flow state that only clicks when you stop fighting the air and start reading it.

---

### Reference Games — DNA Notes

| Game | DNA |
|---|---|
| **Inside** | Environmental dread, sense of scale, surfaces as antagonists; everything in the world wants to end you without being hostile — it's just physics |
| **Thumper** | Riding a physical force rather than fighting it; the input is not "go there" but "adjust to this" — the game teaches you to flow with inevitability |
| **Gran Turismo** | Reading invisible systems (traction circles, temperature gradients); the expert doesn't fight the car, they manage the physics envelope |
| **R-Type** | Tight spatial precision, surfaces as absolute death, memorisation of patterns after each death — runs are learning loops |
| **Tony Hawk** | Flow state and style bonus; the score rewards efficiency and near-misses, not brute-forcing |

---

## Visual Spec

**Background:** `#5E8FA3`  
→ Deep steam teal. R:94 G:143 B:163 — all channels above 30 ✓. Reads as a warm foggy bathroom atmosphere, mid-tone and rich.

**Primary (bubble film):** `#E8F0F4`  
→ Barely-there soap-white with a cool cast — the bubble's dominant body color.

**Secondary (warm bathroom):** `#C97B4B`  
→ Warm copper-amber — radiator pipes, brass taps, chrome edge highlights, goal-ring.

**Accent A (iridescent cyan):** `#7BC8D4`  
→ The highlight arc across the bubble's top hemisphere. Also used for thermal puff visualization.

**Accent B (iridescent warm):** `#F4A261`  
→ The opposite-side iridescent arc, lower hemisphere. Creates the soap-rainbow effect.

**Danger (cold zone / steam jet):** `#A8D5E2` tinted with `opacity:0.4`  
→ Ice-blue overlay for cold downdraft zones. Distinct from warm thermal puffs.

**Thermal puff color:** `#F9E4C8` at `opacity:0.35`  
→ Warm peach-cream, barely visible rising column. Fades from bottom to top.

---

**Bloom:** YES  
→ Strength: **0.65** | Threshold: **0.72**  
Soap bubbles have a natural luminous halo. The bubble's iridescent film blooms against the steam-teal background. Thermal puffs bloom faintly as they rise. The goal vent blooms gold `#F0C070` at full intensity.

**Camera angle:** Fixed 2D side-scroll, screen is a vertical viewport (portrait recommended: 640×960). Camera follows Sphera with a 0.15 lag coefficient (soft follow — the bubble drifts ahead of the camera, reinforcing its physical weight). Slight barrel distortion (k1: 0.03) makes the edges of the screen feel like bathroom glass. No rotation.

**Player silhouette in 5 words:** Round, translucent, iridescent, rim-lit sphere.

---

## Sound Spec

### Music Identity

**Genre/vibe:** Ambient Glass — warm, aqueous, slow. Not lo-fi. Not classical. The sound of warm steam condensing on a cold mirror: beautiful because it's about to disappear.

**Character:** Fragile, luminous, meditative. The music never swells aggressively — it builds tension through *addition* of layers, not volume.

**THE HOOK:** A 3-note ascending glass harmonica figure — C4 → E4 → G4, each note held 1.5 beats — resolving to a sustained C5 that fades into 4-second reverb tail. This motif repeats every 8 bars, sometimes inverted (G4→E4→C4) when Sphera is in danger. It sounds exactly like a bubble rising: high, delicate, going somewhere. You will hear it in your head after you close the browser.

---

### Arrangement

**BPM:** 72  
**Bar length:** 8 beats  
**Loop length:** 32 bars (≈ 213 seconds before full repeat, with generative variation preventing exact repetition)

| # | Instrument | Tone.js Synth Type | Role | Entry | Exit |
|---|---|---|---|---|---|
| 1 | Glass Harmonica Lead | `AMSynth` — high harmonicity (8), attack 0.4s, release 3.0s, deep reverberationDecayTime 6s | Carries the hook motif (C4→E4→G4→C5); plays every 8 bars | Fades in at bar 1, volume 0→-12dB over 4 beats | Fades out last 4 beats of loop |
| 2 | Breath Bass | `FMSynth` — modulation index 1.5, very low carrier (55Hz=A1), slow envelope (attack 1.2s) | Heartbeat pulse at quarter notes; anchors without grounding. You feel it more than hear it | Enters at bar 3, always present once entered | Cuts on pop/death instantly (breath holds) |
| 3 | Steam Pad | `PolySynth` (4-voice) with long attack 2s, sustain 1.0, release 4s; reverb wet 0.8 | Sustained chord clusters (Cmaj7, Am7, Em7 rotating); the ambient thermal wash | Enters bar 1, never exits during play | Cross-fades to danger chord on near-miss |
| 4 | Water Drop Pluck | `PluckSynth` — resonance 0.96, dampening 0.35 | Random pitches from C pentatonic minor (C4,Eb4,F4,G4,Bb4) triggered every 1–4 seconds stochastically | Sparse from bar 5 | Increases frequency as goal approaches |
| 5 | High Shimmer Bell | `MetalSynth` — frequency 1800Hz, envelope 0.001/0.1/0, octaves 1.5 | Extremely quiet (volume -28dB) sustained shimmer; rings once per thermal puff placed | Triggered on each thermal puff | 2s natural decay |
| 6 | Cold Drone | `Synth` — square wave, pitch C2, heavy low-pass filter (cutoff 120Hz), tremolo 0.3Hz | Only plays in cold zones; creates sub-bass unease below the warm pad | Cross-fades in when bubble enters cold zone (0.5s transition) | Cross-fades out when bubble exits cold zone |

---

### Dynamic Music State Table

| State | Trigger | Change |
|---|---|---|
| **Drift** | Default; bubble moving freely, no obstacles within 200px | All instruments at base volume. Hook plays normally. Drop plucks sparse (avg 3s apart). |
| **Approach** | Any surface within 120px of bubble | Steam pad shifts to Am7 (darker). Breath bass increases pulse rate (half-notes → quarter-notes). Hook plays inverted (descending). Drop plucks stop. |
| **Danger** | Any surface within 40px OR inside steam jet radius | Steam pad switches to dissonant cluster (C+F#, tritone). Glass harmonica stutter-repeats the G4 without resolving. Cold drone enters at -18dB regardless of zone. High shimmer bell rings every 0.5s. |
| **Thermal Active** | Player has an active thermal puff placed | High shimmer bell rings on placement. Steam pad chord brightens (add9 voicing). Slight tempo feel increase (kick-drum-free pulse in Breath Bass doubles). |
| **Goal Proximity** | Bubble within 100px of goal | Water drop plucks rapid (avg 0.4s apart, all C5). Glass harmonica plays hook in full — including the C5 resolution, which normally only plays at win. Steam pad brightens to Cmaj7add9. Everything crescendos +3dB. |
| **Win** | Bubble reaches goal | Full 4-bar resolution: hook plays twice, all instruments swell then fade to single sustained C5 glass harmonica. 8-second tail. |
| **Pop/Death** | Bubble touches surface | All music cuts instantly (0ms fade). 0.3s silence. Then: single reversed water drop pluck (C4, pitch-shifted down 4 semitones). Nothing else. Silence is the punishment. |

---

### Start Screen Music

Steam pad alone at `-18dB`, chord Cmaj7, playing before the title loads. The hook motif (C4→E4→G4) plays once, softly, then silence for 4 beats, then again — suggesting a bubble that keeps trying. BPM 72, but the hook timing feels unhurried. No bass, no percussion. Just the glass harmonica motif breathing against the steam pad. When the player taps START, the breath bass enters and all other instruments cross-fade in over 3 seconds as the level begins.

---

### Sound Effects — 8+ Effects with Tone.js Implementation

| # | Sound | Tone.js Implementation | Why It Fits |
|---|---|---|---|
| 1 | **Bubble Pop (death)** | `AMSynth` — quick pitch bend C5→C2 over 0.08s, amplitude envelope 0→1→0 in 0.1s, no reverb, then `FeedbackDelay` with one 0.05s echo at -20dB | A soap bubble pop is a tiny implosion. The pitch drop is the film collapsing. The single echo is the sound bouncing off tile. |
| 2 | **Thermal Puff Place** | `Synth` (sine wave, C5, attack 0.02s, release 0.6s) at -20dB + `Reverb` wet 0.7. A tiny "hfff" exhale quality. | Placing a thermal is a tiny breath. Sine + reverb gives warmth without assertiveness — the air doesn't announce itself. |
| 3 | **Thermal Intensify (hold >0.5s)** | Pitch glide from C5 to E5 over 0.4s (same AMSynth as puff), volume increases from -20dB to -14dB | The thermal is strengthening. The pitch rise communicates growing upward force — matches bubble buoyancy intuition. |
| 4 | **Thermal Dissipate** | `Synth` (sine E5→C4 over 0.8s, volume -14dB → -40dB, ease-out curve) | The thermal is cooling and falling back. Descending pitch matches the physics of the column collapsing. |
| 5 | **Near Miss (surface within 25px)** | `MetalSynth` — frequency 440Hz, envelope 0.001/0.03/0/0.05, volume -18dB. Single metallic tick. | Chrome and tile are metallic surfaces. A near-miss sounds like the bubble brushed the vibration field of the chrome without touching it. |
| 6 | **Steam Jet (vent oscillating)** | `NoiseSynth` (white noise, bandpass filter 800Hz Q:4), envelope 0/1/0 over the jet's visible arc, volume -16dB | Steam is broadband noise. Bandpass narrows it to a hiss rather than a roar — it's bathroom-scale, not industrial. |
| 7 | **Hair Dryer Burst** | `NoiseSynth` (pink noise, lowpass 600Hz) + `AMSynth` (drone E2, AM frequency 20Hz for motor wobble), sharp attack 0.01s, volume -10dB, duration 0.3s exactly | The hair dryer is the most aggressive element. Pink noise + motor drone = unmistakably mechanical hot air. 20Hz AM creates the electric motor flutter. |
| 8 | **Cold Zone Entry** | `Synth` (triangle wave, A2, attack 1.0s, sustain -1, release 2.0s) + `AutoFilter` (LFO 0.2Hz, depth 0.4) | Cold air is slow and groaning. Triangle wave + slow filter sweep sounds like a cold draft through a window frame — nothing sharp, everything reluctant. |
| 9 | **Goal Reached / Sphera Exits** | `PolySynth` — C5+E5+G5+C6 chord, attack 0.3s, release 8.0s, heavy reverb wet 0.95. Swells and fades into silence. | Sphera escaping through the skylight vent is an ascension, not an explosion. The sustained choir-like chord fades as she disappears from the world. No fanfare. Just resolution. |
| 10 | **Bubble Ambient Hum (always on, very quiet)** | `Oscillator` (sine, 180Hz, volume -36dB, constant) + `Tremolo` (4Hz, depth 0.1) | A soap bubble's film vibrates at its resonant frequency. This imperceptible hum grounds the player in the bubble's physical reality at all times. |

---

## Mechanic Spec

### Core Loop (one sentence)

Read the bathroom's shifting ambient air currents, place brief warm thermal puffs in Sphera's PATH — not on her — to pull her buoyantly around obstacles, and reach the goal vent before the air architecture shifts against you.

---

### Primary Input: THERMAL PUFF

This is the character-derived mechanic. A soap bubble cannot push through air — she drifts WITH currents. The player cannot touch or steer Sphera directly. Instead, the player sculpts the invisible air around her.

**Pointerdown (tap):**  
Creates a warm thermal column at the exact tap location. The column is 40px wide, 200px tall, rises upward at 60px/s from the tap point. Visually: a faint warm peach `#F9E4C8` shimmer that ascends and fades. Any bubble within 150px horizontal radius of the thermal BASE experiences:
- Upward acceleration: +20px/s² (additive to ambient buoyancy)
- Lateral drift toward thermal center: +15px/s (proportional to horizontal distance — closer = stronger pull)

The bubble is NOT attracted to the cursor or to the top of the thermal column. It is attracted to the warm rising air mass at the base, exactly as a real soap bubble would follow a warm updraft. This means the player must place the thermal AHEAD of where the bubble will be in ~0.5 seconds — predictive aiming, not reactive steering.

**Hold (sustained press):**  
- At 0.3s: Thermal intensifies. Multiplier 1.4×.
- At 0.5s: Multiplier 1.8×. Thermal column visible glow doubles in opacity.
- At 1.0s: Multiplier 2.5×. Maximum useful pull.
- At 2.0s: STEAM JET THRESHOLD. The thermal becomes a dangerous jet (column width expands to 80px, center velocity 200px/s upward). Any bubble within 30px of the jet column center: INSTANT POP. The jet is visible — it turns from peach to a bright near-white `#FAFAFA` — giving the player ~0.3s warning before the jet fully activates.

**Pointerup:**  
Thermal dissipates over 0.8s (ease-out). Warm air column collapses downward. Bubble retains any momentum gained — momentum is NOT removed when thermal disappears.

**Pointermove (while held):**  
The thermal does NOT follow the pointer. It remains at its origin point. To create a new thermal at a different location, the player must release and re-tap. This prevents "drag steering" from becoming the solution.

**Simultaneous thermals:**  
- Levels 1–4: Maximum 2 active thermals at once. Third tap cancels the oldest.
- Level 5: Maximum 1 active thermal at once.

---

### Ambient Currents (always active)

The bathroom has 3–7 permanent air streams per level — the level's invisible skeleton. These are visualized as faint steam wisps (bezier curves, 1.5px stroke, opacity 0.15–0.25, moving at stream speed). They cannot be deactivated.

Stream types:
- **Horizontal drift:** Constant horizontal velocity, full screen width. Can blow bubble into walls.
- **Updraft column:** Vertical rising current, 80px wide. Safe to be inside, but carries you upward fast.
- **Spiral vortex:** A 120px-diameter circular current around a fixed point (e.g., near the shower drain edge). Rotates at 0.5 rad/s. If bubble enters, it orbits. Player must use thermals to escape.
- **Vent pulse:** A periodic bidirectional stream from a wall vent — pushes outward for 1.5s, pulls inward for 1.5s, period 3s.

---

### Key Timing Values

| Parameter | Value |
|---|---|
| Bubble maximum speed | 120 px/s |
| Bubble drag coefficient | 0.92× per frame (60fps) |
| Bubble passive buoyancy | +8 px/s² upward constant acceleration |
| Thermal puff duration (default tap) | 1.5s |
| Thermal puff duration (held 2.0s) | Becomes jet; use caution |
| Thermal radius of influence | 150px from tap center |
| Thermal rise speed | 60 px/s |
| Thermal lateral pull (at edge of range) | 15 px/s (proportional, max at center) |
| Thermal cooldown between puffs (Level 4+) | 0.8s |
| Near-miss visual/audio trigger | 25px from any surface edge |
| Pop detection threshold | Bubble center within 1px of any surface |
| Steam jet danger onset | 2.0s hold |
| Steam jet lethal radius | 30px from column center |
| Steam jet warning window | 0.3s (visual shift to near-white before lethal) |
| Hair dryer burst duration (Level 5) | 0.3s |
| Hair dryer burst period (Level 5) | Every 4.0s |
| Hair dryer burst force | 200 px/s in jet direction |
| Cold zone buoyancy flip | Passive buoyancy becomes -8 px/s² (falls instead of rises) |
| Goal trigger radius | 30px — bubble center within 30px of goal point |

---

### Win / Lose Conditions

**Win:** Sphera's center enters within 30px of the goal point (skylight vent, specific gap, etc.). She glows gold `#F0C070`, emits the win chord, and rises off the top of the screen over 2 seconds. Level complete.

**Lose:** Sphera's center comes within 1px of ANY surface — tile edge, chrome pipe, shower wall, soap dish, oscillating vent body, steam jet center, hair dryer jet. INSTANT POP. No health points. No lives. No grace period. One contact = restart from level beginning. The only consequence is time lost and score reset.

---

### Score

**Base:** 10,000 points per level (decreases by 1 point per second elapsed)

**Near-miss bonus:** +50 points for each frame the bubble spends within 15–25px of a surface without popping. Accumulates in a multiplier display ("×2 Thrill", "×3 Thrill") — the display shows near-miss chain count.

**Style bonus (thermal efficiency):** Each thermal puff placed costs 100 points. Unused puff budget at level end: returned as bonus (max 2000 points per level if zero thermals used — not achievable past Level 2 but sets aspiration).

**No lives, no retry penalty beyond lost time.** The score is a reflection of style, not survival — Sphera's journey is the point.

---

## Level Design — 5 Levels

---

### Level 1 — "The Ledge"

**What's new:** Nothing. This is the tutorial — ambient currents, thermal puffs, don't touch things.

**Setting:** The soap dish to the faucet. Bottom quarter of the bathroom. The world is small and horizontal — the goal is a mere 220px away (right side of screen). The screen is relatively clear.

**Exact parameters:**
- Ambient streams: 3
  - Stream A: Horizontal, left→right, speed 20 px/s, full width, y-position 35% from top
  - Stream B: Horizontal, right→left, speed 22 px/s, full width, y-position 65% from top
  - Stream C: Slight updraft column, 80px wide, centered at x=60%, speed 15 px/s upward
- Obstacles: 1 fixed — soap dish ledge (rectangle, 120×12px) at bottom-left. Chrome faucet column (rectangle, 16×200px) at right-center.
- Moving obstacles: 0
- Thermal max simultaneous: 2
- Thermal cooldown: None
- Cold zones: 0

**Duration/goal:** 30–60s. Goal: the open faucet lip at top-right of screen, glowing amber `#C97B4B`.

**Designer note:** The two opposing horizontal streams mean the player immediately feels the bubble being pulled. The updraft column is a free assist if the player stumbles into it. The soap dish is the only danger below; the faucet column channels the approach. This level teaches: place the thermal ahead, not on the bubble.

---

### Level 2 — "Steam City"

**What's new:** An oscillating steam vent. The vent body itself is lethal (touching it pops the bubble). The steam jet it emits is lethal. But the warm air surrounding the vent is exploitable — the player can use the vent's own thermal to navigate.

**Setting:** The shower stall. Vertical emphasis — the goal is UP, not across. Steam fills the air visibly more than Level 1. The showerhead is a fixed obstacle at top-right.

**Exact parameters:**
- Ambient streams: 4
  - Stream A: Strong updraft column, 100px wide, at x=25%, speed 35 px/s
  - Stream B: Horizontal drift left→right at y=25%, speed 28 px/s
  - Stream C: Horizontal drift right→left at y=55%, speed 24 px/s
  - Stream D: Weak updraft at x=75%, speed 18 px/s
- Obstacles: 2 fixed (shower wall left, shower wall right), showerhead fixture (T-shape, 80×40px) at top-right
- Moving obstacles: 1 oscillating steam vent — rectangular nozzle (20×30px) at bottom-center, oscillates LEFT↔RIGHT at ±120px amplitude, period 3.0s (sinusoidal). Emits a 30px-wide steam jet upward, constant. The jet and the vent body are both lethal.
- Thermal max simultaneous: 2
- Thermal cooldown: None
- Cold zones: 0

**Duration/goal:** 45–75s. Goal: the gap above the shower curtain rod at top-center (30px gap between rod end and wall).

---

### Level 3 — "The Mirror"

**What's new:** Cold zones. A rectangular region (100×200px) adjacent to the cold bathroom window creates a cold downdraft. Inside, the bubble's passive buoyancy flips: instead of +8 px/s² upward, it becomes -8 px/s² downward. Visual: a blue tint overlay `#A8D5E2` at 0.4 opacity with a faint frost-crackle border (SVG path, static). The player must cross through or around the cold zone.

**Setting:** The mirror above the sink. Larger vertical traversal — 600px from start to goal. The mirror surface is the right wall (lethal). Cold window is left side, lower third.

**Exact parameters:**
- Ambient streams: 5
  - Stream A: Updraft at x=50%, speed 40 px/s, 90px wide
  - Stream B: Horizontal left→right at y=20%, speed 30 px/s
  - Stream C: Horizontal right→left at y=40%, speed 32 px/s
  - Stream D: Spiral vortex, center at (35%, 55%), radius 120px, rotation 0.4 rad/s clockwise
  - Stream E: Updraft at x=80%, speed 22 px/s, 60px wide (near the towel rail)
- Obstacles: Mirror surface (right wall, lethal), sink basin edge (arc, lethal), towel rail (horizontal rod, 8px × 160px, at right side mid-height)
- Moving obstacles: 2 oscillating steam vents (same spec as Level 2 but period 2.5s; one at bottom-left, one at mid-right)
- Cold zones: 1 (bottom-left, 100×200px, adjacent to window edge). Inside: buoyancy = -8 px/s² downward.
- Thermal max simultaneous: 2
- Thermal cooldown: None

**Duration/goal:** 60–90s. Goal: the medicine cabinet gap at top-center (gap is 40px — slightly wider to compensate for increased complexity).

---

### Level 4 — "Chrome Maze"

**What's new:** Two rotating chrome pipes + thermal cooldown. Chrome pipes are the most demanding obstacle type: 8px-wide, 120px-long rectangles that pivot around their center point at 0.3 rad/s. They sweep continuously. The player must time Sphera's passage through the arc of the sweeping pipe tip. Also: thermals now have a 0.8-second cooldown between placements — you must RATION your interventions.

**Setting:** The plumbing side of the bathroom — copper pipes, shutoff valves, pipe elbows. Palette shift for this level: secondary color warms noticeably, more `#C97B4B` copper-tone in the environment. The space is more cluttered.

**Exact parameters:**
- Ambient streams: 6
  - Stream A: Updraft x=30%, 80px wide, speed 45 px/s
  - Stream B: Updraft x=70%, 60px wide, speed 38 px/s
  - Stream C: Horizontal left→right y=15%, speed 30 px/s
  - Stream D: Horizontal right→left y=45%, speed 35 px/s
  - Stream E: Spiral vortex center at (55%, 35%), radius 100px, 0.5 rad/s counter-clockwise
  - Stream F: Vent pulse at right wall, x=90%, y=60%, period 3s (±50px/s bidirectional)
- Obstacles: 3 fixed copper pipe segments + 2 pipe elbows (all 10px stroke, rounded caps)
- Moving obstacles: 2 rotating chrome pipes — each 8px × 120px, pivot at geometric center, rotation speed 0.3 rad/s. Pipe A pivots at (30%, 55%), Pipe B pivots at (65%, 35%). Both rotate continuously.
- Cold zones: 2 — one at bottom-left (80×120px), one at top-right (100×100px)
- Thermal max simultaneous: 2
- Thermal cooldown: **0.8s between placements**

**Duration/goal:** 90–120s. Goal: the pipe junction gap at top-right (a 35px gap between two converging pipes).

---

### Level 5 — "The Ascent"

**What's new:** The hair dryer burst. Full bathroom traversal. A hair dryer resting on the counter at mid-left emits a powerful horizontal hot-air burst every 4.0 seconds exactly. Burst duration: 0.3s. Burst force: 200 px/s in the jet direction (horizontal, toward right wall). The jet is 50px wide, extends 300px from the dryer nozzle. Being inside the jet during the 0.3s burst = instant pop. HOWEVER: the 0.5s before and after the burst, residual warm air creates a narrow horizontal thermal — exploitable, but the timing window is tight. Also: thermal max drops to 1.

**Setting:** The full bathroom, bottom to top. Start: floor level near the bath mat (bottom-center). Goal: the skylight vent at ceiling top-center, glowing gold. The entire bathroom geography is visible as a long vertical scroll — 1800px of play space compressed into the scrolling camera. Background gradually warms from the cool steam-teal `#5E8FA3` at floor level to a warmer `#7A9E6A` sage at ceiling level (the green of outdoor morning light glimpsed through the vent).

**Exact parameters:**
- Ambient streams: 7
  - Stream A: Updraft x=20%, 100px wide, speed 55 px/s
  - Stream B: Updraft x=80%, 80px wide, speed 42 px/s
  - Stream C: Horizontal left→right y=10%, speed 38 px/s
  - Stream D: Horizontal right→left y=30%, speed 45 px/s
  - Stream E: Spiral vortex center at (50%, 50%), radius 140px, 0.45 rad/s clockwise
  - Stream F: Vent pulse at left wall y=65%, period 3s, ±60px/s
  - Stream G: Strong updraft x=50%, 120px wide, speed 70 px/s (the main chimney — the player's lifeline if they find it)
- Moving obstacles: 3 rotating chrome pipes (0.3 rad/s), 3 oscillating steam vents (period 2.5s, 2.0s, 3.5s — staggered to prevent rhythmic solutions), hair dryer burst (period 4.0s, burst 0.3s, jet 50px × 300px, force 200px/s, pre-burst warm residual window ±0.5s)
- Cold zones: 2 (80×150px each, positioned at mid-level to bisect the path)
- Thermal max simultaneous: **1**
- Thermal cooldown: None (compensates for max 1 limit)

**Duration/goal:** 120–180s. Goal: skylight vent at top-center (30px gap), glowing gold `#F0C070`. Sphera exits through the vent and the level ends with her ascent animation.

---

## The Moment

The first time you survive a hair dryer burst by placing the single allowed thermal exactly 80px to Sphera's left — and watch her drift sideways 0.4 seconds before the scalding jet roars through the exact space she just vacated — you stop thinking about surviving and start thinking about the geometry of invisible air.

---

## Emotional Arc

**First 30 seconds:** "Oh, this is soothing." The drift is serene. The glass harmonica sighs. The steam teal background wraps around you like a warm towel. Sphera floats with such natural grace that you forget, momentarily, that touching anything ends her.

**After 2 minutes:** "I'm reading the room." You've died a few times. Each death was your fault — you placed the thermal on Sphera instead of ahead of her, or held too long and created a jet, or forgot about the cold zone's gravity flip. But now you're beginning to see the invisible infrastructure — the updraft corridors, the cold pockets, the pipe arcs — as architecture. You're navigating a building you're starting to know.

**Near win:** Flow state. Pure. You stop seeing obstacles and start seeing only the spaces between them. The music swells into its fullest state — all six instruments, water drops rapid like rain. One thermal, placed 0.6 seconds early, arcs Sphera around the final chrome pipe and into the central updraft, and she rises toward the gold glow of the skylight vent without you doing anything else. The air carries her the last 60px. Your hands are still.

---

## This Game's Identity in One Line

**This is the game where you sculpt invisible air to carry something too fragile to touch.**

---

## Start Screen

### Idle Animation (exact values)

**Background:** `#5E8FA3` (same steam teal as gameplay — the world is always on)

**Steam wisps (3 total):**
- Wisp A: Bezier curve, 2px stroke, color `#E8F0F4`, opacity 0.28, x-position 18% of screen width, rises from bottom edge, speed 22 px/s upward. Curve sways: control points oscillate ±15px horizontally at 0.12 Hz. Loops when top exits screen.
- Wisp B: Same spec, x-position 52%, speed 26 px/s, sway ±20px at 0.09 Hz, opacity 0.20.
- Wisp C: Same spec, x-position 76%, speed 19 px/s, sway ±12px at 0.15 Hz, opacity 0.24.

**Idle bubbles (3 total — distinct sizes, distinct paths):**
- **Bubble A** — 48px diameter. Starts at (25%, 70%). Drifts RIGHT at 12 px/s constant horizontal, oscillates vertically: amplitude 8px, period 4.0s (cosine). Color: `#E8F0F4` fill at opacity 0.7, iridescent ring stroke gradient `#7BC8D4`→`#F4A261`, stroke width 2px. Resets to (25%, 70%) when it exits screen right.
- **Bubble B** — 32px diameter. Starts at (70%, 40%). Drifts LEFT at 8 px/s constant horizontal, oscillates vertically: amplitude 6px, period 3.2s (cosine). Color: `#F0EAE0` fill at opacity 0.65, ring stroke `#F4A261`→`#7BC8D4`, stroke width 1.5px. Resets to (70%, 40%) when exits screen left.
- **Bubble C (Sphera)** — 64px diameter. Starts at screen center (50%, 52%). Drifts UPWARD at 6 px/s. Oscillates LEFT-RIGHT: amplitude 14px, period 5.5s (sine). Glows: `drop-shadow(0 0 8px #7BC8D4)` bloom effect. Fill `#E8F4F8` opacity 0.75, iridescent ring full rainbow gradient (8-stop: `#7BC8D4`, `#F4A261`, `#E8A0B0`, `#A0E8C0`, back to `#7BC8D4`), stroke width 2.5px. When Bubble C exits screen top, it resets to (50%, 85%) and a small "pop + re-form" animation plays (circle shrinks to 0 over 0.2s, then expands back to 64px over 0.4s at the new position). This represents Sphera trying again — a tiny story on the idle screen.

**Tap prompt:** Text "tap anywhere" centered at 78% screen height, font-family same as title, font-size 18px, color `#E8F0F4`, opacity pulses between 0.4 and 0.9 at 1.2 Hz.

---

### SVG Overlay

**Option A — Glow Title (required):**

Title text: "BOP BUBBLE"  
Font-family: Nunito or equivalent rounded sans-serif (fallback: Arial Rounded)  
Font-size: 72px  
Font-weight: 800  
Fill: `#E8F0F4`  
Letter-spacing: 0.08em  
Position: centered horizontally, y = 22% from top

SVG filter stack (applied to the text element):
1. `feGaussianBlur` stdDeviation="1.5" — inner glow, opacity 1.0 (tight luminous edge)
2. `feGaussianBlur` stdDeviation="6" — mid glow, result composited at opacity 0.6, color `#7BC8D4` (cyan tint via `feFlood` + `feComposite`)
3. `feGaussianBlur` stdDeviation="18" — outer haze, opacity 0.25, color `#7BC8D4`

Breathing animation: The entire title `<g>` element scales between `scale(1.0)` and `scale(1.025)` on a 3.0s sine cycle, transform-origin at title center. This reads as the title itself gently pulsing like a breathing bubble — almost imperceptible at first glance, undeniable once seen.

**Option B — Silhouette (fits — use it):**

A large faint soap bubble SVG placed behind the title text:
- `<circle>` cx=50% cy=30% r=110px
- stroke: `#FFFFFF`, stroke-opacity: 0.12, fill: none, stroke-width: 2px
- Iridescent arc: `<path>` following the top 70° arc of the circle, stroke: `url(#iridGrad)`, stroke-width: 3px, fill: none
  - `iridGrad` is a linearGradient from `#F4A261` (warm orange) → `#7BC8D4` (cyan) → `#E8A0B0` (soft rose), spanning the arc path
- This circle sits behind the title glowtext — it frames the title inside a ghost bubble. The glow from Option A bleeds into and through the silhouette circle, creating the impression that the title is a bubble catching light.

---

## Summary Reference Card

| Parameter | Value |
|---|---|
| Background | `#5E8FA3` |
| Bubble fill | `#E8F0F4` |
| Thermal puff color | `#F9E4C8` |
| Goal glow | `#F0C070` |
| Cold zone tint | `#A8D5E2` |
| BPM | 72 |
| Thermal radius | 150px |
| Max bubble speed | 120 px/s |
| Passive buoyancy | +8 px/s² upward |
| Pop threshold | 1px from surface |
| Near-miss trigger | 25px from surface |
| Levels | 5 |
| Identity line | *This is the game where you sculpt invisible air to carry something too fragile to touch.* |
