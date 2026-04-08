# BALANCE NOTES -- AETHER RIFT Stage 1

Designer-facing reference for the balance config (`src/balance.ts`).
All tunable numbers live in the exported `BALANCE` object -- no magic
numbers in game logic.

---

## Enemy Roles

| Type    | Role            | HP  | TTK @Pwr2 | Speed | Pattern    | Design intent                                 |
| ------- | --------------- | --- | --------- | ----- | ---------- | --------------------------------------------- |
| fairy   | Fodder          | 24  | ~0.4s     | 320   | aimed/fan  | Plentiful, teaches dodging. Melts fast.        |
| bat     | Sweeper         | 12  | ~0.2s     | 400   | aimed      | Flies across screen, never stops. One-shot.    |
| wisp    | Evasive caster  | 18  | ~0.3s     | 380   | ring8      | Figure-8 movement, hard to pin down.           |
| soul    | Tanky caster    | 50  | ~0.8s     | 240   | ring8/12   | Slow but durable. Sustained fire to kill.      |
| phantom | Elite caster    | 70  | ~1.2s     | 180   | ring12     | Ghostly flicker, dense rings. Threatening.     |
| knight  | Heavy elite     | 90  | ~1.5s     | 260   | aimed5     | Toughest regular. Requires focused DPS.        |

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

Power per gem: 1 (was 2). Drop rate: 35%.
Reaching power level 4 requires ~100 gem pickups -- typically mid-to-late
stage with consistent play.

---

## Stage 1 Pacing

The stage has 18 waves over ~86 seconds, then a miniboss, interlude,
dialogue, and boss fight.

### Wave Structure

```
Waves  1-3  (t=2-14s)   TUTORIAL        Fairies + bats only
                                         Bullet speed: 240 (early)
                                         Teach: aimed shots, spread shots,
                                         sweeping enemies

Waves  4-8  (t=20-41s)  INTRODUCTION    One new type per wave
                                         Bullet speed: 310 (mid)
                                         Introduce: wisps, souls, knights
                                         + mixed fairy combos

Waves  9-12 (t=46-61s)  COMBINATION     Mix 2-3 types per wave
                                         Bullet speed: 360 (late)
                                         Knights + phantoms, mixed assaults

Waves 13-15 (t=66-74s)  ESCALATION      Heavy + dense combos
                                         Bat swarms, soul fortresses

Waves 16-18 (t=78-86s)  CRESCENDO       All 6 types, peak difficulty
                                         Pre-miniboss tension build
```

### Bullet Speed Scaling

Enemy bullet speed scales by wave bracket via `getWaveBulletSpeed()`:
- Waves 1-3: 240 px/s (slow, learnable)
- Waves 4-8: 310 px/s (moderate)
- Waves 9+:  360 px/s (challenging)

Boss bullets use their own per-phase speeds (340/380/420).

---

## Miniboss: Shrine Guardian

- **HP:** 5500 (~30s fight at power level 3)
- **Bullet speed:** 263 (base 310 * 0.85 multiplier)
- **Attacks:** 4-pattern cycle
  1. Aimed 3-shot fan
  2. 8-shot ring
  3. 5-shot wide aimed fan
  4. 12-shot ring + aimed shot combo
- **Design:** First real test of sustained dodging while focusing fire.
  Not overly difficult -- more of a skill check before the boss.

---

## Boss: Aetheria, Butterfly Deity

- **Total HP:** 20000 (~85s total fight)
- **3 phases** with escalating speed and density

### Phase 1: "Teach" (HP 100% - 60%)

8000 HP to deplete. ~35s at power 3.

| Attack           | Speed | Description                          |
| ---------------- | ----- | ------------------------------------ |
| Radial Bloom     | 306   | 14-bullet ring. Find the gap.        |
| Aimed Fan        | 289   | 3x 5-shot volleys. Dodge sideways.   |
| Slow Sweep       | 221   | 20-bullet arc sweep. Move with it.   |
| Petal Scatter    | 272   | Two offset 12-rings. Tight gaps.     |
| "Gentle Cascade" | 272   | Spell card: fans + rings alternating |

Telegraph: 0.8s. Pause: 1.6s. Generous breathing room.

### Phase 2: "Mix" (HP 60% - 28%)

6400 HP to deplete. ~28s at power 3.

| Attack             | Speed | Description                          |
| ------------------ | ----- | ------------------------------------ |
| Double Ring        | 380   | Two 20-rings offset. Dense.          |
| Rapid Fan          | 361   | 5x 7-shot aimed fans. Fast.         |
| Curtain            | 361   | Horizontal bullet wall. Move up/down |
| Spiral Stream      | 380   | Twin spirals. Read the rotation.     |
| "Butterfly Waltz"  | 342   | Spell card: spirals + aimed pairs    |

Telegraph: 0.5s. Pause: 1.2s. Tighter rhythm.

### Phase 3: "Intense" (HP 28% - 0%)

5600 HP to deplete. ~24s at power 3.

| Attack                | Speed | Description                          |
| --------------------- | ----- | ------------------------------------ |
| Death Blossom         | 420+  | 28-ring + 8-aimed fan overlay        |
| Cascade               | 441   | 6x aimed 9-fans + rings             |
| Void Storm            | 483   | Aimed streams + twin spirals         |
| Converging Walls      | 378   | Top/bottom curtains converging       |
| "Aether Annihilation" | 462   | Spell card: dense rings + aims + spirals |

Telegraph: 0.35s. Pause: 0.7s. Relentless pressure.

### Phase Transitions

- Grace period: 2.5 seconds of no attacks
- Visual: scale pulse + shockwave effect
- All bullets cleared on transition
- Message: "PHASE II" / "FINAL PHASE"

---

## Bomb Balance

Bombs are a panic button, not a DPS tool.

| Target   | Damage | Effect                              |
| -------- | ------ | ----------------------------------- |
| Enemy    | 200    | Kills fairies/bats/wisps, hurts rest |
| Miniboss | 80     | ~1.5% of HP. Minor chip.            |
| Boss     | 60     | ~0.3% of HP. Negligible damage.     |

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
Reduce `BALANCE.boss.totalHp`. Keep phase thresholds the same (60%/28%).

### "Boss fight is too short"
Increase `BALANCE.boss.totalHp`.

### "Power progression is too fast"
Increase `BALANCE.player.powerThresholds` values, or reduce
`BALANCE.player.powerPerGem` (already 1 -- can't go lower without
changing to a fractional system).

### "Power progression is too slow"
Increase `BALANCE.player.powerPerGem` or `BALANCE.pickups.powerDropRate`.

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
