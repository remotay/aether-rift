# BALANCE NOTES -- AETHER RIFT Stage 1

Designer-facing reference for the balance config (`src/balance.ts`).
All tunable numbers live in the exported `BALANCE` object -- no magic
numbers in game logic.

---

## Enemy Roles

| Type    | Role            | HP  | TTK @Pwr2 | Speed | Pattern    | Design intent                                 |
| ------- | --------------- | --- | --------- | ----- | ---------- | --------------------------------------------- |
| fairy   | Fodder          | 18  | ~0.3s     | 320   | aimed/fan  | Plentiful, teaches dodging. Melts fast.        |
| bat     | Sweeper         | 9   | ~0.2s     | 400   | aimed      | Flies across screen, never stops. One-shot.    |
| wisp    | Evasive caster  | 14  | ~0.2s     | 380   | ring8      | Figure-8 movement, hard to pin down.           |
| soul    | Tanky caster    | 38  | ~0.6s     | 240   | ring8/12   | Slow but durable. Sustained fire to kill.      |
| phantom | Elite caster    | 53  | ~0.9s     | 180   | ring12     | Ghostly flicker, dense rings. Threatening.     |
| knight  | Heavy elite     | 68  | ~1.1s     | 260   | aimed5     | Toughest regular. Requires focused DPS.        |

**TTK formula:** `HP / (damage_per_hit * hits_per_second)` where
damage = `2 + powerLevel * 2` and fire rate = 10 hits/s (shootInterval 0.1s).
At power level 2 (power 24-55): damage = 6, DPS = 60.

---

## Player Power Curve

| Power Level | Power Range | Damage/hit | DPS  | Shot Pattern    |
| ----------- | ----------- | ---------- | ---- | --------------- |
| 1           | 0 - 23      | 4          | 40   | 1 forward       |
| 2           | 24 - 55     | 6          | 60   | 2 spread        |
| 3           | 56 - 99     | 8          | 80   | 3 spread        |
| 4           | 100 - 128   | 10         | 100  | 5 wide spread   |

Power per gem: 2. Drop rate: 35%.
Reaching power level 4 requires ~50 gem pickups -- typically mid-stage
with consistent play.

---

## Stage 1 Pacing

The stage has 18 waves over ~94 seconds, then a miniboss, interlude,
dialogue, and boss fight.

### Wave Structure (4-Act Design)

The stage is structured as four distinct acts, each with a clear purpose.
Breathing room (7-8s gaps) is placed at act boundaries so the player can
feel the tempo shift. Within acts, heavier and lighter waves alternate to
prevent fatigue.

```
ACT 1: TUTORIAL (waves 1-3, t=2-14s)
  Fairies + bats only. Bullet speed: 240 (slow).
  Teach: aimed shots, spread shots, sweeping enemies.
  Purpose: give the player space to learn core movement.

  [7s breather — act boundary]

ACT 2: INTRODUCTION (waves 4-7, t=22-40s)
  One new enemy type per wave, escorted by fairies.
  Bullet speed: 310 (mid).
  Wave 4: wisps (ring patterns)
  Wave 5: souls (tanky + rings)
  Wave 6: knights (heavy + aimed5)
  Wave 7: phantoms (dense ring12)
  Purpose: build vocabulary — player sees each enemy solo
  before facing combinations.

  [8s breather — act boundary]

ACT 3: COMBINATION (waves 8-12, t=48-68s)
  Mix 2-3 types per wave. Bullet speed: 360 (late).
  Alternates LIGHTER and HEAVY pressure:
  Wave 8:  fairy wall (lighter — many weak targets)
  Wave 9:  knight + phantom (HEAVY)
  Wave 10: bats + fairies (lighter — fast but sparse)
  Wave 11: wisps + fairies (HEAVY — dense rings)
  Wave 12: souls + bats + fairy (HEAVY — overlapping patterns)
  Purpose: test reading combined patterns. Lighter waves
  between heavy ones prevent burnout.

  [6s breather — act boundary]

ACT 4: CRESCENDO (waves 13-18, t=74-94s)
  Rapid escalation. All types. Tighter 4s gaps.
  Wave 13: bat swarm (chaotic energy shift)
  Wave 14: soul fortress (dense sustained)
  Wave 15: fairy diamond (LIGHTER breather — regroup)
  Wave 16: elite vanguard (knights + wisps)
  Wave 17: phantom crescendo (peak difficulty)
  Wave 18: grand finale (all 6 types at once)
  Purpose: push the player to their limit, then the
  miniboss arrives as the payoff.
```

### Bullet Speed Scaling

Enemy bullet speed scales by wave bracket via `getWaveBulletSpeed()`:
- Waves 1-3: 240 px/s (slow, learnable)
- Waves 4-8: 310 px/s (moderate)
- Waves 9+:  360 px/s (challenging)

Boss bullets use their own per-phase speeds (320/380/440).

### Design Reasoning: Alternating Pressure

Heavy waves (knight+phantom, wisp+fairy, soul fortresses) are separated
by lighter waves (fairy walls, bat swarms, diamond formations). This
creates a pulse of tension-and-release:

- Player survives a heavy wave, feels accomplished
- Lighter wave lets them breathe and collect power gems
- Next heavy wave raises the stakes again

This prevents the "wall of noise" effect where constant pressure makes
the player go numb to it. The highs feel higher because lows exist.

---

## Miniboss: Shrine Guardian

- **HP:** 2400 (~30-40s fight at power level 2-3)
- **Bullet speed:** 263 (base 310 * 0.85 multiplier)
- **2 Phases:** transitions at 45% HP with shockwave VFX

### Phase 1 (HP 100% - 45%)
4-pattern cycle. Learnable. Teaches sustained dodging.

| # | Attack              | Bullets | Timer |
|---|---------------------|---------|-------|
| 1 | Aimed 3-shot fan    | 3       | 0.9s  |
| 2 | 8-shot ring         | 8       | 1.4s  |
| 3 | Wide 5-shot fan     | 5       | 1.1s  |
| 4 | 12-ring + aimed     | 13      | 1.3s  |

### Phase 2 (HP 45% - 0%)
6-pattern cycle. 18% faster bullets. Denser patterns, adds spirals.

| # | Attack              | Bullets | Timer |
|---|---------------------|---------|-------|
| 1 | Fast 5-shot aimed   | 5       | 0.7s  |
| 2 | Double 10-ring      | 20      | 1.2s  |
| 3 | Twin spiral stream  | 32      | 1.5s  |
| 4 | 12-ring + 3 aimed   | 15      | 1.0s  |
| 5 | Rapid 3-burst fan   | 15      | 1.3s  |
| 6 | Dense 16-ring       | 16      | 1.1s  |

**Design reasoning:** The miniboss was previously a simple 4-attack
cycle that felt flat. Adding phase 2 with faster bullets, spiral
patterns, and denser rings creates a "second wind" moment where the
player must adapt mid-fight. The transition shockwave + scale pulse
makes the shift unmistakable.

---

## Boss: Aetheria, Butterfly Deity

- **Total HP:** 7800 (~70-85s total fight at power 3-4)
- **3 phases** with escalating speed, density, and pressure

### Design Philosophy

Each phase has a distinct *feel*:
- **Phase 1:** Tutorial — slow, readable, generous pauses. The player
  learns each attack pattern. Designed to build confidence.
- **Phase 2:** Mix — medium speed, tighter gaps. Combines ring and
  aimed patterns. Designed to test skills learned in P1.
- **Phase 3:** Intense — fast, dense, overlapping. Minimal pauses.
  Designed to push the player to their limit for the climax.

The HP split is roughly even across phases (35% / 35% / 30%) so each
phase lasts long enough to feel distinct. Phase transitions have a 3s
grace period with shockwave VFX and all bullets cleared.

### Phase 1: "Teach" (HP 100% - 65%)

2730 HP to deplete. ~27-34s at power 3-4.

| Attack           | Speed | Description                          |
| ---------------- | ----- | ------------------------------------ |
| Radial Bloom     | 288   | 14-bullet ring. Find the gap.        |
| Aimed Fan        | 272   | 3x 5-shot volleys. Dodge sideways.   |
| Slow Sweep       | 208   | 20-bullet arc sweep. Move with it.   |
| Petal Scatter    | 256   | Two offset 12-rings. Tight gaps.     |
| "Gentle Cascade" | 256   | Spell card: fans + rings alternating |

Telegraph: 0.85s. Pause: 1.8s. Generous breathing room.
Idle between cycles: 0.7s.

### Phase 2: "Mix" (HP 65% - 30%)

2730 HP to deplete. ~27-34s at power 3-4.

| Attack             | Speed | Description                          |
| ------------------ | ----- | ------------------------------------ |
| Double Ring        | 380   | Two 20-rings offset. Dense.          |
| Rapid Fan          | 361   | 5x 7-shot aimed fans. Fast.         |
| Curtain            | 361   | Horizontal bullet wall. Move up/down |
| Spiral Stream      | 380   | Twin spirals. Read the rotation.     |
| "Butterfly Waltz"  | 342   | Spell card: spirals + aimed pairs    |

Telegraph: 0.5s. Pause: 1.0s. Tighter rhythm.
Idle between cycles: 0.25s.

### Phase 3: "Intense" (HP 30% - 0%)

2340 HP to deplete. ~23-29s at power 3-4.

| Attack                | Speed | Description                          |
| --------------------- | ----- | ------------------------------------ |
| Death Blossom         | 440+  | 28-ring + 8-aimed fan overlay        |
| Cascade               | 462   | 6x aimed 9-fans + rings             |
| Void Storm            | 506   | Aimed streams + twin spirals         |
| Converging Walls      | 396   | Top/bottom curtains converging       |
| "Aether Annihilation" | 484   | Spell card: dense rings + aims + spirals |

Telegraph: 0.30s. Pause: 0.50s. Relentless pressure.
Idle between cycles: 0.10s.

### Phase Transitions

- Grace period: 3.0 seconds of no attacks
- Visual: scale pulse + shockwave effect
- All bullets cleared on transition
- Message: "PHASE II" / "FINAL PHASE"

### Design Reasoning: Why This HP

The boss was reduced from 20000 to 5600 across multiple passes, but at
5600 the phases felt indistinct — the player could power through P1 and
P2 without really learning the patterns. At 7800:

- P1 lasts ~30s: enough time for the player to see each attack 1-2 times
  and understand the dodge pattern
- P2 lasts ~30s: enough for the speed increase to register as a real
  difficulty shift, not a brief spike
- P3 lasts ~26s: intense but finite — the player can see the HP bar
  draining and feel the ending approaching

The key insight: boss HP controls *how many attack cycles the player must
survive*. Too few cycles and phases blur together. The phase speeds and
pauses create the *feel*, but HP creates the *duration* for that feel to
register.

---

## Bomb Balance

Bombs are a panic button, not a DPS tool.

| Target   | Damage | Effect                              |
| -------- | ------ | ----------------------------------- |
| Enemy    | 200    | Kills fairies/bats/wisps, hurts rest |
| Miniboss | 80     | ~3.3% of HP. Minor chip.            |
| Boss     | 60     | ~0.8% of HP. Negligible damage.     |

Bomb also clears all enemy bullets on screen.

---

## Score System

| Source      | Points |
| ----------- | ------ |
| Fairy       | 100    |
| Bat         | 80     |
| Wisp        | 150    |
| Soul        | 200    |
| Phantom     | 250    |
| Knight      | 300    |
| Miniboss    | 3000   |
| Boss        | 20000  |
| Graze       | 15     |
| Pickup      | 50     |

---

## How to Tune

### "Enemies die too fast"
Increase HP values in `BALANCE.enemies.<type>.hp`. TTK scales linearly.

### "Enemies die too slow"
Decrease HP, or increase `BALANCE.player.damage.perLevel`.

### "Bullets are too fast/slow"
Adjust `BALANCE.bulletSpeed.early/mid/late` for regular enemies,
or `BALANCE.boss.phase1speed/phase2speed/phase3speed` for the boss.

### "Boss fight is too long"
Reduce `BALANCE.boss.totalHp`. Keep phase thresholds the same (65%/30%).

### "Boss fight is too short"
Increase `BALANCE.boss.totalHp`. Each 1000 HP adds ~10-13s of fight time.

### "Boss phases don't feel distinct"
Widen the gap between phase speeds (e.g., P1: 300, P3: 460).
Increase `phaseTransitionPause` for longer grace periods.
Increase HP so each phase lasts longer.

### "Miniboss is too simple"
Adjust `miniboss.phase2at` threshold. Add patterns to phase 2 array
in Boss.ts. Increase `phase2speedMult` for more urgency.

### "Power progression is too fast"
Increase `BALANCE.player.powerThresholds` values, or reduce
`BALANCE.player.powerPerGem`.

### "Power progression is too slow"
Increase `BALANCE.player.powerPerGem` or `BALANCE.pickups.powerDropRate`.

### "Stage pacing feels flat"
Add more breathing room at act boundaries in `buildTimeline()`.
Insert lighter waves between heavy ones. Vary wave timing gaps.

### "Game is too easy"
- Increase enemy bullet speeds
- Reduce boss telegraph durations
- Reduce boss pause durations
- Increase enemy HP so they stay on screen longer

### "Game is too hard"
- Decrease enemy bullet speeds
- Increase boss telegraph durations
- Increase boss pause durations
- Give more starting lives (`BALANCE.player.startLives`)
- Increase iframes duration (`BALANCE.player.iframes`)
