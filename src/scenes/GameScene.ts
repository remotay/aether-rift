import Phaser from 'phaser';
import {
  W, H, DEPTH, FONT,
  PBULLET_SPEED, HITBOX_R, GRAZE_R,
  SC_GRAZE, SC_PICKUP,
  MAX_POWER, START_BOMBS,
} from '../constants';
import { BALANCE, getWaveBulletSpeed, getPowerLevel } from '../balance';
import { Player }           from '../systems/Player';
import { BulletPool }       from '../systems/BulletPool';
import { EnemyManager }     from '../systems/Enemy';
import type { EnemyDef }    from '../systems/Enemy';
import { Boss, Miniboss }   from '../systems/Boss';
import { Boss2, Miniboss2 } from '../systems/Boss2';
import { Boss3, Miniboss3 } from '../systems/Boss3';
import { Boss4, Miniboss4 } from '../systems/Boss4';
import type { LaserFireFn }  from '../systems/Laser';
import { LaserPool }         from '../systems/Laser';
import { HUD }              from '../ui/HUD';
import { BossBar }          from '../ui/BossBar';
import { sfx }              from '../audio/SoundSynth';
import { bgm }              from '../audio/BGMManager';

type GamePhase = 'intro' | 'waves' | 'miniboss' | 'interlude' | 'dialogue' | 'boss_warning' | 'boss' | 'clear' | 'over';

interface Pickup {
  sprite: Phaser.GameObjects.Image;
  type:   'power' | 'bomb';
  vx:     number;
  vy:     number;
}

export class GameScene extends Phaser.Scene {
  // Core systems
  private player!:     Player;
  private pBullets!:   BulletPool;
  private eBullets!:   BulletPool;
  private enemyMgr!:   EnemyManager;
  private boss:        Boss | Boss2 | Boss3 | Boss4 | null = null;
  private miniboss:    Miniboss | Miniboss2 | Miniboss3 | Miniboss4 | null = null;
  private hud!:        HUD;
  private bossBar!:    BossBar;
  private laserPool!:  LaserPool;

  // Background
  private starLayers: { gfx: Phaser.GameObjects.Graphics; speed: number; stars: { x: number; y: number; sz: number; a: number }[] }[] = [];
  private bgMountains!: Phaser.GameObjects.TileSprite;
  private bgBuildings!: Phaser.GameObjects.TileSprite;
  private bgNear!:      Phaser.GameObjects.TileSprite;

  // Game state
  private phase:      GamePhase = 'intro';
  private score       = 0;
  private hiScore     = 0;
  private graze       = 0;
  private stageTimer  = 0;
  private phaseTimer  = 0;
  private pickups:    Pickup[] = [];
  // Wave timeline: array of [triggerTime, fn]
  private waveEvents: Array<[number, () => void]> = [];
  private nextWave = 0;
  // Current wave number (1-indexed) — used for bullet speed scaling
  private currentWaveNum = 0;

  // Stage identifier (1 = Stage I, 2 = Stage II, etc.)
  private stageId = 1;

  // P key for pause
  private pKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'GameScene' }); }

  init(data?: { stage?: number }): void {
    this.stageId = data?.stage ?? 1;
  }

  create(): void {
    this.score      = 0;
    this.graze      = 0;
    this.stageTimer = 0;
    this.nextWave   = 0;
    this.currentWaveNum = 0;
    this.waveEvents = [];
    this.phase      = 'intro';
    this.pickups        = [];
    this.boss           = null;
    this.miniboss       = null;
    this.dialogueGroup  = [];
    this.dialogueLineIndex = 0;

    // Persist hi-score across scene restarts
    this.hiScore = Number(this.game.registry.get('hiScore') ?? 0);

    this.buildBackground();

    // Enemy bullet pool — fires enemy bullets; must exist before player (player bullets fire fn references eBullets indirectly)
    this.eBullets = new BulletPool(this, 'bul-round-sm', 600, DEPTH.EBULLET);

    // Enemy manager
    this.enemyMgr = new EnemyManager(this, (ex, ey, angle, pattern) => {
      this.fireEnemyPattern(ex, ey, angle, pattern);
    });

    // Laser pool — used by Stage 2 enemies, miniboss, and boss
    this.laserPool = new LaserPool(this);
    this.enemyMgr.laserFn = (x, y, angle, w, telDur, actDur, tint, opts?) => {
      this.laserPool.fireLaser(x, y, angle, w, telDur, actDur, tint, opts);
    };

    // Player bullet pool
    this.pBullets = new BulletPool(this, 'bul-player', 256, DEPTH.PBULLET);

    // Player
    this.player = new Player(
      this, 240, H / 2,
      (x, y, power, focused) => this.firePlayer(x, y, power, focused),
      () => this.doBomb(),
    );

    // Apply carried state from previous stage (e.g. Stage 1 → Stage 2 continuation)
    if (this.stageId >= 2) {
      const carryScore = this.registry.get('carryScore') as number | undefined;
      const carryLives = this.registry.get('carryLives') as number | undefined;
      const carryBombs = this.registry.get('carryBombs') as number | undefined;
      const carryPower = this.registry.get('carryPower') as number | undefined;
      if (carryScore !== undefined) this.score        = carryScore;
      if (carryLives !== undefined) this.player.lives = carryLives;
      if (carryBombs !== undefined) this.player.bombs = carryBombs;
      if (carryPower !== undefined) this.player.power = carryPower;
    }

    // HUD / BossBar
    this.hud     = new HUD(this);
    this.bossBar = new BossBar(this);

    // (burst FX use per-call one-shot emitters — see burst())

    // Keyboard
    const kb    = this.input.keyboard!;
    this.pKey   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // Build wave timeline
    this.buildTimeline();

    // ── BGM ──────────────────────────────────────────────────────────────
    bgm.bind(this);
    bgm.play(this.stageId === 4 ? 'stage4' : this.stageId === 3 ? 'stage3' : this.stageId === 2 ? 'stage2' : 'stage1', 1200);

    // Fade-in intro
    this.cameras.main.fadeIn(500, 0, 0, 0);
    const stageLabels: Record<number, string> = {
      1: 'STAGE I: THRESHOLD OF ETERNITY',
      2: 'STAGE II: CLOCKWORK ABYSS',
      3: 'STAGE III: SHATTERED EDEN',
      4: 'STAGE IV: CELESTIAL RIFT',
    };
    const stageLabel = stageLabels[this.stageId] ?? `STAGE  ${this.stageId}`;
    this.time.delayedCall(600, () => {
      this.phase = 'waves';
      this.hud.showMessage(stageLabel, 1800, 0xe8f4ff, 60);
    });
  }

  // ─── UPDATE LOOP ──────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // Pause
    if (Phaser.Input.Keyboard.JustDown(this.pKey) || Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (this.phase !== 'over' && this.phase !== 'clear') {
        this.scene.pause('GameScene');
        this.scene.launch('PauseScene');
        return;
      }
    }

    if (this.phase === 'over' || this.phase === 'clear') return;
    if (this.phase === 'intro') return;

    // Scroll parallax stars
    this.scrollStars(dt);

    // Stage timer & waves
    if (this.phase === 'waves') {
      this.stageTimer += dt;
      this.tickWaves();
      if (this.enemyMgr.count() === 0 && this.nextWave >= this.waveEvents.length) {
        this.enterMiniboss();
      }
    }

    // Phase timers
    if (this.phase === 'interlude') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.enterDialogue();
    }
    if (this.phase === 'boss_warning') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.enterBoss();
    }

    // Update subsystems
    this.player.update(dt);
    this.pBullets.update(dt, -160, W + 160, -160, H + 160);
    this.eBullets.update(dt, -160, W + 160, -160, H + 160);
    if (this.focusPool)    this.focusPool.update(dt, -160, W + 160, -160, H + 160);
    if (this.bossEBullets) this.bossEBullets.update(dt, -160, W + 160, -160, H + 160);
    this.laserPool.update(dt);
    this.enemyMgr.update(dt, this.player.x, this.player.y);

    if (this.miniboss?.alive) this.miniboss.update(dt, this.player.x, this.player.y);
    if (this.boss?.alive)     this.boss.update(dt, this.player.x, this.player.y);

    // Collisions
    this.checkCollisions();

    // Pickups
    this.updatePickups(dt);

    // HUD
    this.hud.update({
      score:    this.score,
      hiScore:  this.hiScore,
      lives:    this.player.lives,
      bombs:    this.player.bombs,
      power:    this.player.power,
      graze:    this.graze,
      maxPower: MAX_POWER,
    });

    // Boss bar
    if (this.miniboss?.alive) {
      this.bossBar.update(this.miniboss.getHpFraction());
    }
    if (this.boss?.alive) {
      this.bossBar.update(this.boss.getHpFraction(), this.boss.phase);
    }
  }

  // ─── BACKGROUND ───────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Solid base — prevents any checkerboard gaps
    const baseTint = this.stageId === 4 ? 0x080422 : this.stageId === 3 ? 0x0a0418 : this.stageId === 2 ? 0x020a0e : 0x06010e;
    this.add.rectangle(W / 2, H / 2, W, H, baseTint).setDepth(DEPTH.BG_FAR - 1);

    // Static atmospheric sky backdrop
    const skyKey = this.stageId === 4 ? 'bg-sky-s4' : this.stageId === 3 ? 'bg-sky-s3' : this.stageId === 2 ? 'bg-sky-s2' : 'bg-sky';
    if (this.textures.exists(skyKey)) {
      this.add.image(W / 2, H / 2, skyKey)
        .setDisplaySize(W, H)
        .setDepth(DEPTH.BG_FAR);
    }

    // ── Procedural parallax silhouette layers ─────────────────────────────────
    // Each canvas tiles seamlessly (sine-based = integer-freq → no seam).
    // Texture keys prefixed _ so they don't clash with asset keys.
    (['_bg_mt', '_bg_bd', '_bg_nr'] as const).forEach(k => {
      if (this.textures.exists(k)) this.textures.remove(k);
    });

    if (this.stageId === 4) {
      this.buildStage4Parallax();
    } else if (this.stageId === 3) {
      this.buildStage3Parallax();
    } else if (this.stageId === 2) {
      this.buildStage2Parallax();
    } else {
      const mtC = this.buildMountainLayer();
      this.textures.addCanvas('_bg_mt', mtC);
      this.bgMountains = this.add
        .tileSprite(0, H, W, mtC.height, '_bg_mt')
        .setOrigin(0, 1)
        .setDepth(DEPTH.BG_MID - 1);

      const bdC = this.buildBuildingLayer();
      this.textures.addCanvas('_bg_bd', bdC);
      this.bgBuildings = this.add
        .tileSprite(0, H, W, bdC.height, '_bg_bd')
        .setOrigin(0, 1)
        .setDepth(DEPTH.BG_MID);

      const nrC = this.buildNearLayer();
      this.textures.addCanvas('_bg_nr', nrC);
      this.bgNear = this.add
        .tileSprite(0, H, W, nrC.height, '_bg_nr')
        .setOrigin(0, 1)
        .setDepth(DEPTH.BG_NEAR - 1);
    }

    // Parallax star layers — scrolled procedurally each frame
    const rng = new Phaser.Math.RandomDataGenerator(['stars-game']);
    const layerDefs = [
      { count: 55, speed: 16, depth: DEPTH.BG_MID,      alpha: [0.18, 0.44] as [number,number] },
      { count: 35, speed: 44, depth: DEPTH.BG_NEAR,     alpha: [0.35, 0.70] as [number,number] },
      { count: 18, speed: 90, depth: DEPTH.BG_NEAR + 1, alpha: [0.60, 1.00] as [number,number] },
    ];
    this.starLayers = layerDefs.map(def => ({
      gfx:   this.add.graphics().setDepth(def.depth),
      speed: def.speed,
      stars: Array.from({ length: def.count }, () => ({
        x:  rng.frac() * W,
        y:  rng.frac() * H,
        sz: rng.frac() < 0.6 ? 1 : 2,
        a:  def.alpha[0] + rng.frac() * (def.alpha[1] - def.alpha[0]),
      })),
    }));
    this.drawStars();

    // ── Vignette overlay — dark gradient around screen edges ──
    const vig = this.add.graphics().setDepth(DEPTH.BG_NEAR + 2);
    const vigAlpha = 0.3;
    const edgeW = 420; // width of the gradient band at left/right
    const edgeH = 280; // height of the gradient band at top/bottom

    // Left edge
    for (let i = 0; i < edgeW; i += 4) {
      const a = vigAlpha * (1 - i / edgeW);
      vig.fillStyle(0x000000, a);
      vig.fillRect(i, 0, 4, H);
    }
    // Right edge
    for (let i = 0; i < edgeW; i += 4) {
      const a = vigAlpha * (1 - i / edgeW);
      vig.fillStyle(0x000000, a);
      vig.fillRect(W - i - 4, 0, 4, H);
    }
    // Top edge
    for (let i = 0; i < edgeH; i += 4) {
      const a = vigAlpha * (1 - i / edgeH);
      vig.fillStyle(0x000000, a);
      vig.fillRect(0, i, W, 4);
    }
    // Bottom edge
    for (let i = 0; i < edgeH; i += 4) {
      const a = vigAlpha * (1 - i / edgeH);
      vig.fillStyle(0x000000, a);
      vig.fillRect(0, H - i - 4, W, 4);
    }
    // Corner darkening — extra fill at corners for a smooth vignette feel
    const cornerR = 340;
    for (let cx = 0; cx <= 1; cx++) {
      for (let cy = 0; cy <= 1; cy++) {
        const ox = cx * W;
        const oy = cy * H;
        for (let r = cornerR; r > 0; r -= 6) {
          const a = vigAlpha * 0.5 * (1 - r / cornerR);
          vig.fillStyle(0x000000, a);
          vig.fillCircle(ox, oy, r);
        }
      }
    }
  }

  private drawStars(): void {
    for (const layer of this.starLayers) {
      layer.gfx.clear();
      for (const s of layer.stars) {
        layer.gfx.fillStyle(0xffffff, s.a);
        layer.gfx.fillRect(s.x, s.y, s.sz, s.sz);
      }
    }
  }

  private scrollStars(dt: number): void {
    // Parallax silhouette layers — each scrolls at a distinct speed so
    // the player feels like they're flying through a layered landscape.
    // TileSprite.tilePositionX increments wrap the tile seamlessly.
    this.bgMountains.tilePositionX += 18  * dt;   // distant ridgeline
    this.bgBuildings.tilePositionX += 52  * dt;   // mid-ground pagodas
    this.bgNear.tilePositionX      += 115 * dt;   // near-ground torii

    for (const layer of this.starLayers) {
      for (const s of layer.stars) {
        s.x -= layer.speed * dt;
        if (s.x < -2) s.x += W + 4;
      }
    }
    this.drawStars();
  }

  // ─── WAVE TIMELINE ────────────────────────────────────────────────────────

  private buildTimeline(): void {
    if (this.stageId === 4) {
      this.buildStage4Timeline();
      return;
    }
    if (this.stageId === 3) {
      this.buildStage3Timeline();
      return;
    }
    if (this.stageId === 2) {
      this.buildStage2Timeline();
      return;
    }

    const wave = (t: number, waveNum: number, fn: () => void) => {
      this.waveEvents.push([t, () => {
        this.currentWaveNum = waveNum;
        fn();
      }]);
    };

    // ══════════════════════════════════════════════════════════════════════
    //  18 waves over ~90 seconds, then miniboss triggers on all-clear
    //
    //  ACT 1: TUTORIAL (waves 1-3)     — fairies + bats, slow bullets
    //  ACT 2: INTRODUCTION (waves 4-7) — one new enemy type per wave
    //  ACT 3: COMBINATION (waves 8-12) — mix types, alternate pressure
    //  ACT 4: CRESCENDO (waves 13-18)  — rapid escalation, all types
    //
    //  Breathing room at act boundaries (7-8s gaps)
    //  Lighter "relief" waves between heavy ones in Acts 3-4
    // ══════════════════════════════════════════════════════════════════════

    // ── ACT 1: TUTORIAL ─────────────────────────────────────────────────
    // Teach movement, shooting, and basic dodge patterns. Slow bullets.

    // Wave 1 (t=2s): "Welcome" — 3 fairies, aimed singles, slow bullets.
    // Teach: enemies come from right, shoot at you.
    wave(2, 1, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80,  260, 1360, 300, 'aimed',  1.8, 0),
      this.fairyDef(W + 80,  540, 1400, 540, 'aimed',  1.8, 0.3),
      this.fairyDef(W + 80,  820, 1360, 780, 'aimed',  1.8, 0.6),
    ]));

    // Wave 2 (t=8s): "First pattern" — 4 fairies in a line, aimed3.
    // Teach: dodge spread shots by moving vertically.
    wave(8, 2, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80,  180, 1480, 220, 'aimed3', 2.0, 0),
      this.fairyDef(W + 80,  420, 1500, 420, 'aimed3', 2.0, 0.25),
      this.fairyDef(W + 80,  660, 1480, 660, 'aimed3', 2.0, 0.5),
      this.fairyDef(W + 80,  900, 1500, 880, 'aimed3', 2.0, 0.75),
    ]));

    // Wave 3 (t=14s): "Diagonal" — 3 bats sweep diagonal.
    // Teach: some enemies don't stop; they fly across.
    wave(14, 3, () => this.enemyMgr.spawnWave([
      this.batDef(W + 80,   80, -200,  900, 'aimed',      1.2, 0),
      this.batDef(W + 80,  250, -200,  700, 'aimed',      1.2, 0.35),
      this.batDef(W + 80,  450, -200,  400, 'aimed_back', 1.4, 0.7),
    ]));

    // ── ACT 2: INTRODUCTION ─────────────────────────────────────────────
    // One new enemy type per wave, escorted by fairies. Mid-speed bullets.

    // Wave 4 (t=22s): "Ring introduction" — 2 fairies + 1 wisp with ring8.
    // Teach: circular patterns have gaps between bullets.
    wave(22, 4, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80, 300, 1420, 300, 'spread5', 2.2, 0),
      this.fairyDef(W + 80, 760, 1440, 760, 'spread5', 2.2, 0.2),
      this.wispDef(W + 80,  540, 1540, 540, 'ring8',   2.8, 0.5),
    ]));

    // Wave 5 (t=28s): "First souls" — 2 sturdy soul casters + ring8.
    // Teach: some enemies take sustained fire to kill.
    wave(28, 5, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,  250, 1460, 280, 'ring8',  2.8, 0),
      this.soulDef(W + 80,  830, 1460, 800, 'ring8',  2.8, 0.4),
    ]));

    // Wave 6 (t=34s): "First knights" — 2 heavy armoured elites.
    // Teach: tanky enemies require sustained focus.
    wave(34, 6, () => this.enemyMgr.spawnWave([
      this.knightDef(W + 80, 340, 1480, 340, 'aimed5', 2.8, 0),
      this.knightDef(W + 80, 740, 1480, 740, 'aimed5', 2.8, 0.5),
    ]));

    // Wave 7 (t=40s): "First phantoms" — ghostly dense ring casters.
    // Teach: dense rings with tight gaps.
    wave(40, 7, () => this.enemyMgr.spawnWave([
      this.phantomDef(W + 80, 300, 1500, 320, 'ring12', 3.4, 0),
      this.phantomDef(W + 80, 780, 1500, 760, 'ring12', 3.4, 0.6),
    ]));

    // ── ACT 3: COMBINATION ──────────────────────────────────────────────
    // Mix 2-3 types per wave. Alternate heavy and lighter pressure.

    // Wave 8 (t=48s): "Fairy wall" — 5 fairies cascading, aimed3.
    // LIGHTER — many weak enemies, manageable pressure.
    wave(48, 8, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80, 160, 1380, 160, 'aimed3', 1.8, 0),
      this.fairyDef(W + 80, 340, 1420, 340, 'aimed3', 1.8, 0.15),
      this.fairyDef(W + 80, 520, 1380, 520, 'aimed3', 1.8, 0.3),
      this.fairyDef(W + 80, 700, 1420, 700, 'aimed3', 1.8, 0.45),
      this.fairyDef(W + 80, 880, 1380, 880, 'aimed3', 1.8, 0.6),
    ]));

    // Wave 9 (t=53s): "Knight + phantom" — heavy + ghostly pressure.
    // HEAVY — tanky + dense. Tests sustained dodging.
    wave(53, 9, () => this.enemyMgr.spawnWave([
      this.knightDef(W + 80,  240, 1500, 240, 'aimed5', 2.6, 0),
      this.knightDef(W + 80,  840, 1500, 840, 'aimed5', 2.6, 0.45),
      this.phantomDef(W + 80, 540, 1550, 540, 'ring12', 3.2, 0.9),
    ]));

    // Wave 10 (t=58s): "Bats + fairies" — speed vs accuracy.
    // LIGHTER — fast targets but low density.
    wave(58, 10, () => this.enemyMgr.spawnWave([
      this.batDef(W + 80,  150, -200,  450, 'aimed',      1.0, 0),
      this.batDef(W + 80,  400, -200,  250, 'aimed',      1.0, 0.25),
      this.batDef(W + 80,  700, -200,  700, 'aimed_back', 1.2, 0.5),
      this.fairyDef(W + 80, 540, 1400, 540, 'aimed3',     1.8, 0.7),
    ]));

    // Wave 11 (t=63s): "Wisps + spread fairies" — evasive + stationary.
    // HEAVY — ring casters + spread fairies, dense bullet field.
    wave(63, 11, () => this.enemyMgr.spawnWave([
      this.wispDef(W + 80,  200, 1520, 220, 'ring8',   2.6, 0),
      this.wispDef(W + 80,  540, 1560, 540, 'ring8',   2.6, 0.25),
      this.wispDef(W + 80,  880, 1520, 860, 'ring8',   2.6, 0.5),
      this.fairyDef(W + 80, 400, 1400, 400, 'spread5', 2.0, 0.7),
      this.fairyDef(W + 80, 680, 1400, 680, 'spread5', 2.0, 0.85),
    ]));

    // Wave 12 (t=68s): "Mixed assault" — souls + bats + fairy.
    // HEAVY — overlapping patterns, reading multiple types.
    wave(68, 12, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,  300, 1480, 300, 'ring8',  2.6, 0),
      this.soulDef(W + 80,  780, 1480, 780, 'ring8',  2.6, 0.35),
      this.batDef(W + 80,    80, -200, 500, 'aimed',  0.9, 0.7),
      this.batDef(W + 80,   980, -200, 600, 'aimed',  0.9, 1.0),
      this.fairyDef(W + 80, 540, 1380, 540, 'aimed3', 1.8, 1.3),
    ]));

    // ── ACT 4: CRESCENDO ────────────────────────────────────────────────
    // Rapid escalation. Tighter gaps. Pre-miniboss tension build.

    // Wave 13 (t=74s): "Bat swarm" — 5 crossing sweepers.
    // Fast chaotic energy — shifts tempo before heavy closer.
    wave(74, 13, () => this.enemyMgr.spawnWave([
      this.batDef(W + 80,  100, -200,  850, 'aimed',      0.8, 0),
      this.batDef(W + 80,  280, -200,  650, 'aimed',      0.8, 0.15),
      this.batDef(W + 80,  500, -200,  500, 'aimed',      0.8, 0.3),
      this.batDef(W + 80,  720, -200,  350, 'aimed_back', 1.0, 0.45),
      this.batDef(W + 80,  900, -200,  150, 'aimed_back', 1.0, 0.6),
    ]));

    // Wave 14 (t=78s): "Soul fortress" — 3 souls with rings + escort fairies.
    // Dense bullet field, sustained pressure.
    wave(78, 14, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,  200, 1500, 240, 'ring8',  2.4, 0),
      this.soulDef(W + 80,  540, 1540, 540, 'ring12', 2.4, 0.3),
      this.soulDef(W + 80,  880, 1500, 840, 'ring8',  2.4, 0.6),
      this.fairyDef(W + 80, 380, 1420, 380, 'aimed3', 1.6, 0.9),
      this.fairyDef(W + 80, 700, 1420, 700, 'aimed3', 1.6, 1.1),
    ]));

    // Wave 15 (t=82s): "Diamond approach" — 4 fairies in spread formation.
    // LIGHTER breather — easy wave lets player regroup before final push.
    wave(82, 15, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80, 200, 1500, 260, 'aimed',  1.8, 0),
      this.fairyDef(W + 80, 540, 1550, 400, 'aimed',  1.8, 0.2),
      this.fairyDef(W + 80, 540, 1550, 680, 'aimed',  1.8, 0.4),
      this.fairyDef(W + 80, 880, 1500, 820, 'aimed',  1.8, 0.6),
    ]));

    // Wave 16 (t=86s): "Elite vanguard" — knights + wisps.
    // Hard sustained damage + evasive targets.
    wave(86, 16, () => this.enemyMgr.spawnWave([
      this.knightDef(W + 80, 300, 1480, 300, 'aimed5', 2.4, 0),
      this.knightDef(W + 80, 780, 1480, 780, 'aimed5', 2.4, 0.3),
      this.wispDef(W + 80,   440, 1520, 440, 'ring8',  2.2, 0.6),
      this.wispDef(W + 80,   640, 1520, 640, 'ring8',  2.2, 0.8),
    ]));

    // Wave 17 (t=90s): "Phantom crescendo" — 2 phantoms + ring fairies.
    // Peak regular-wave difficulty.
    wave(90, 17, () => this.enemyMgr.spawnWave([
      this.phantomDef(W + 80, 280, 1500, 300, 'ring12', 3.0, 0),
      this.phantomDef(W + 80, 800, 1500, 780, 'ring12', 3.0, 0.5),
      this.fairyDef(W + 80,  540, 1420, 540, 'aimed3', 1.6, 1.0),
      this.fairyDef(W + 80,  200, 1400, 200, 'spread5', 1.8, 1.2),
      this.fairyDef(W + 80,  880, 1400, 880, 'spread5', 1.8, 1.4),
    ]));

    // Wave 18 (t=94s): "Grand crescendo" — all 6 types, staggered.
    // Final wave before miniboss. Everything at once.
    wave(94, 18, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,   180, 1520, 200, 'ring8',   2.4, 0),
      this.knightDef(W + 80, 540, 1540, 540, 'aimed5',  2.4, 0.25),
      this.soulDef(W + 80,   900, 1520, 880, 'ring8',   2.4, 0.5),
      this.wispDef(W + 80,   360, 1480, 360, 'ring8',   2.2, 0.75),
      this.wispDef(W + 80,   720, 1480, 720, 'ring8',   2.2, 1.0),
      this.fairyDef(W + 80,  260, 1420, 260, 'aimed3',  1.6, 1.25),
      this.fairyDef(W + 80,  820, 1420, 820, 'aimed3',  1.6, 1.5),
    ]));

    // ══════════════════════════════════════════════════════════════════════
    //  After all waves + enemies cleared → miniboss triggers automatically.
    //  After miniboss → interlude waves are added dynamically in enterMiniboss.
    // ══════════════════════════════════════════════════════════════════════
  }

  // ─── ENEMY DEFINITION HELPERS ────────────────────────────────────────────

  private fairyDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.enemies.fairy;
    return { type: 'fairy', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private soulDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.enemies.soul;
    return { type: 'soul', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private wispDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.enemies.wisp;
    return { type: 'wisp', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private phantomDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.enemies.phantom;
    return { type: 'phantom', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score,
             alpha: 0.75, delay };
  }

  private knightDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.enemies.knight;
    return { type: 'knight', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private batDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.enemies.bat;
    return { type: 'bat', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score,
             behavior: 'sweep', delay };
  }

  private droneDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.stage2.enemies.drone;
    return { type: 'drone', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score,
             behavior: 'strafe', delay };
  }

  private gunnerDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.stage3.enemies.gunner;
    return { type: 'gunner', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private bloomDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.stage3.enemies.bloom;
    return { type: 'bloom', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private prismDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const c = BALANCE.stage3.enemies.prism;
    return { type: 'prism', x, y, targetX: tx, targetY: ty, hp: c.hp, speed: c.speed, hoverDur: c.hoverDur, pattern, shootInt, score: c.score, delay };
  }

  private seraphDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const s = BALANCE.stage4.enemies.seraph;
    return { type: 'seraph', x, y, targetX: tx, targetY: ty, hp: s.hp, speed: s.speed, hoverDur: s.hoverDur, pattern, shootInt, score: s.score, delay };
  }

  private shadeDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const s = BALANCE.stage4.enemies.shade;
    return { type: 'shade', x, y, targetX: tx, targetY: ty, hp: s.hp, speed: s.speed, hoverDur: s.hoverDur, pattern, shootInt, score: s.score, delay };
  }

  private cometDef(x: number, y: number, tx: number, ty: number, pattern: EnemyDef['pattern'], shootInt: number, delay = 0): EnemyDef {
    const s = BALANCE.stage4.enemies.comet;
    return { type: 'comet', x, y, targetX: tx, targetY: ty, hp: s.hp, speed: s.speed, hoverDur: s.hoverDur, pattern, shootInt, score: s.score, delay };
  }

  // ─── STAGE 2 WAVE TIMELINE ────────────────────────────────────────────────

  private buildStage2Timeline(): void {
    const wave = (t: number, waveNum: number, fn: () => void) => {
      this.waveEvents.push([t, () => {
        this.currentWaveNum = waveNum;
        fn();
      }]);
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  20 waves over ~104 seconds — denser aimed-shot pressure + laser patterns
    //
    //  ACT 1: TUTORIAL (waves 1-3)      — drones + fairies, teach new movement
    //  ACT 2: INTRODUCTION (waves 4-7)  — first lasers, mixed types
    //  ACT 3: COMBINATION (waves 8-13)  — heavy/light alternation, laser combos
    //  ACT 4: CRESCENDO (waves 14-20)   — peak intensity, all types
    // ══════════════════════════════════════════════════════════════════════════

    // ── ACT 1: TUTORIAL ─────────────────────────────────────────────────
    // Wave 1 (t=2s): 3 drones (aimed), teach new enemy
    wave(2, 1, () => this.enemyMgr.spawnWave([
      this.droneDef(W + 80,  260, 1380, 280, 'aimed', 1.6, 0),
      this.droneDef(W + 80,  540, 1400, 540, 'aimed', 1.6, 0.3),
      this.droneDef(W + 80,  820, 1380, 800, 'aimed', 1.6, 0.6),
    ]));

    // Wave 2 (t=8s): 4 fairies (aimed3), familiar but faster
    wave(8, 2, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80,  200, 1460, 200, 'aimed3', 1.8, 0),
      this.fairyDef(W + 80,  420, 1480, 420, 'aimed3', 1.8, 0.2),
      this.fairyDef(W + 80,  640, 1460, 640, 'aimed3', 1.8, 0.4),
      this.fairyDef(W + 80,  860, 1480, 860, 'aimed3', 1.8, 0.6),
    ]));

    // Wave 3 (t=14s): 3 bats + 2 drones, mixed movement
    wave(14, 3, () => this.enemyMgr.spawnWave([
      this.batDef(W + 80,    100, -200,  800, 'aimed',  1.0, 0),
      this.batDef(W + 80,    400, -200,  600, 'aimed',  1.0, 0.3),
      this.batDef(W + 80,    700, -200,  300, 'aimed_back', 1.2, 0.6),
      this.droneDef(W + 80,  300, 1400, 300, 'aimed',  1.6, 0.9),
      this.droneDef(W + 80,  760, 1400, 760, 'aimed',  1.6, 1.1),
    ]));

    // ── ACT 2: INTRODUCTION ─────────────────────────────────────────────
    // Wave 4 (t=22s): 2 drones + 1 knight with laser_aimed — FIRST LASER
    wave(22, 4, () => this.enemyMgr.spawnWave([
      this.droneDef(W + 80,   300, 1400, 300, 'aimed', 1.4, 0),
      this.droneDef(W + 80,   780, 1400, 780, 'aimed', 1.4, 0.25),
      this.knightDef(W + 80,  540, 1500, 540, 'laser_aimed', 3.0, 0.6),
    ]));

    // Wave 5 (t=30s): 3 wisps (ring8) + 2 drones
    wave(30, 5, () => this.enemyMgr.spawnWave([
      this.wispDef(W + 80,   220, 1500, 240, 'ring8', 2.6, 0),
      this.wispDef(W + 80,   540, 1520, 540, 'ring8', 2.6, 0.3),
      this.wispDef(W + 80,   860, 1500, 840, 'ring8', 2.6, 0.6),
      this.droneDef(W + 80,  380, 1380, 380, 'aimed', 1.4, 0.8),
      this.droneDef(W + 80,  700, 1380, 700, 'aimed', 1.4, 1.0),
    ]));

    // Wave 6 (t=36s): 2 phantoms (ring12) + 1 drone with laser_sweep
    wave(36, 6, () => this.enemyMgr.spawnWave([
      this.phantomDef(W + 80, 300, 1500, 320, 'ring12', 3.2, 0),
      this.phantomDef(W + 80, 780, 1500, 760, 'ring12', 3.2, 0.5),
      this.droneDef(W + 80,   540, 1460, 540, 'laser_sweep', 3.0, 1.0),
    ]));

    // Wave 7 (t=42s): 2 souls + 2 fairies (aimed5)
    wave(42, 7, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,   260, 1480, 280, 'ring8', 2.6, 0),
      this.soulDef(W + 80,   820, 1480, 800, 'ring8', 2.6, 0.4),
      this.fairyDef(W + 80,  440, 1400, 440, 'aimed5', 2.0, 0.7),
      this.fairyDef(W + 80,  640, 1400, 640, 'aimed5', 2.0, 0.9),
    ]));

    // ── ACT 3: COMBINATION ──────────────────────────────────────────────
    // Wave 8 (t=50s): 5 drones in formation (aimed), "drone wall"
    wave(50, 8, () => this.enemyMgr.spawnWave([
      this.droneDef(W + 80,  160, 1360, 160, 'aimed', 1.4, 0),
      this.droneDef(W + 80,  340, 1380, 340, 'aimed', 1.4, 0.12),
      this.droneDef(W + 80,  520, 1360, 520, 'aimed', 1.4, 0.24),
      this.droneDef(W + 80,  700, 1380, 700, 'aimed', 1.4, 0.36),
      this.droneDef(W + 80,  880, 1360, 880, 'aimed', 1.4, 0.48),
    ]));

    // Wave 9 (t=55s): 2 knights + phantom + laser drone (HEAVY)
    wave(55, 9, () => this.enemyMgr.spawnWave([
      this.knightDef(W + 80,  280, 1500, 280, 'aimed5', 2.4, 0),
      this.knightDef(W + 80,  800, 1500, 800, 'aimed5', 2.4, 0.4),
      this.phantomDef(W + 80, 540, 1540, 540, 'ring12', 3.0, 0.7),
      this.droneDef(W + 80,   440, 1420, 440, 'laser_aimed', 2.8, 1.0),
    ]));

    // Wave 10 (t=60s): 4 bats + 2 fairies (LIGHTER)
    wave(60, 10, () => this.enemyMgr.spawnWave([
      this.batDef(W + 80,   120, -200,  800, 'aimed', 0.9, 0),
      this.batDef(W + 80,   380, -200,  600, 'aimed', 0.9, 0.2),
      this.batDef(W + 80,   640, -200,  400, 'aimed_back', 1.1, 0.4),
      this.batDef(W + 80,   900, -200,  200, 'aimed_back', 1.1, 0.6),
      this.fairyDef(W + 80, 540, 1380, 540, 'aimed3', 1.8, 0.8),
      this.fairyDef(W + 80, 300, 1380, 300, 'aimed3', 1.8, 1.0),
    ]));

    // Wave 11 (t=65s): 3 wisps + 2 drones + laser knight (HEAVY)
    wave(65, 11, () => this.enemyMgr.spawnWave([
      this.wispDef(W + 80,   200, 1500, 220, 'ring8', 2.4, 0),
      this.wispDef(W + 80,   540, 1520, 540, 'ring8', 2.4, 0.3),
      this.wispDef(W + 80,   880, 1500, 860, 'ring8', 2.4, 0.6),
      this.droneDef(W + 80,  380, 1400, 380, 'aimed', 1.4, 0.8),
      this.droneDef(W + 80,  700, 1400, 700, 'aimed', 1.4, 1.0),
      this.knightDef(W + 80, 540, 1500, 540, 'laser_aimed', 3.0, 1.2),
    ]));

    // Wave 12 (t=70s): 2 souls + 3 bats + fairy (overlapping)
    wave(70, 12, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,   280, 1480, 300, 'ring8', 2.4, 0),
      this.soulDef(W + 80,   800, 1480, 780, 'ring8', 2.4, 0.35),
      this.batDef(W + 80,     80, -200, 500, 'aimed', 0.9, 0.6),
      this.batDef(W + 80,    500, -200, 300, 'aimed', 0.9, 0.8),
      this.batDef(W + 80,    920, -200, 700, 'aimed_back', 1.0, 1.0),
      this.fairyDef(W + 80,  540, 1380, 540, 'aimed3', 1.6, 1.2),
    ]));

    // Wave 13 (t=75s): 2 drones(laser_cross) + phantom (dense ring + crossed lasers)
    wave(75, 13, () => this.enemyMgr.spawnWave([
      this.droneDef(W + 80,   340, 1440, 340, 'laser_cross', 3.2, 0),
      this.droneDef(W + 80,   740, 1440, 740, 'laser_cross', 3.2, 0.5),
      this.phantomDef(W + 80, 540, 1520, 540, 'ring12', 2.8, 0.9),
    ]));

    // ── ACT 4: CRESCENDO ────────────────────────────────────────────────
    // Wave 14 (t=80s): 5 bats crossing (tempo shift)
    wave(80, 14, () => this.enemyMgr.spawnWave([
      this.batDef(W + 80,   80, -200,  900, 'aimed',      0.8, 0),
      this.batDef(W + 80,  260, -200,  700, 'aimed',      0.8, 0.12),
      this.batDef(W + 80,  440, -200,  540, 'aimed',      0.8, 0.24),
      this.batDef(W + 80,  700, -200,  300, 'aimed_back', 0.9, 0.36),
      this.batDef(W + 80,  900, -200,  100, 'aimed_back', 0.9, 0.48),
    ]));

    // Wave 15 (t=84s): 3 souls + 3 fairies (peak density)
    wave(84, 15, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,   200, 1500, 220, 'ring8', 2.2, 0),
      this.soulDef(W + 80,   540, 1520, 540, 'ring12', 2.2, 0.3),
      this.soulDef(W + 80,   880, 1500, 860, 'ring8', 2.2, 0.6),
      this.fairyDef(W + 80,  360, 1400, 360, 'aimed3', 1.6, 0.8),
      this.fairyDef(W + 80,  540, 1400, 540, 'aimed3', 1.6, 1.0),
      this.fairyDef(W + 80,  720, 1400, 720, 'aimed3', 1.6, 1.2),
    ]));

    // Wave 16 (t=88s): 4 fairies (LIGHTER breather)
    wave(88, 16, () => this.enemyMgr.spawnWave([
      this.fairyDef(W + 80,  200, 1460, 260, 'aimed', 1.8, 0),
      this.fairyDef(W + 80,  460, 1480, 460, 'aimed', 1.8, 0.2),
      this.fairyDef(W + 80,  620, 1480, 620, 'aimed', 1.8, 0.4),
      this.fairyDef(W + 80,  880, 1460, 820, 'aimed', 1.8, 0.6),
    ]));

    // Wave 17 (t=92s): 2 knights + 2 wisps + laser drone
    wave(92, 17, () => this.enemyMgr.spawnWave([
      this.knightDef(W + 80, 300, 1480, 300, 'aimed5', 2.4, 0),
      this.knightDef(W + 80, 780, 1480, 780, 'aimed5', 2.4, 0.3),
      this.wispDef(W + 80,   440, 1520, 440, 'ring8', 2.2, 0.6),
      this.wispDef(W + 80,   640, 1520, 640, 'ring8', 2.2, 0.8),
      this.droneDef(W + 80,  540, 1440, 540, 'laser_aimed', 2.6, 1.0),
    ]));

    // Wave 18 (t=96s): 2 phantoms + 2 drones + 2 fairies
    wave(96, 18, () => this.enemyMgr.spawnWave([
      this.phantomDef(W + 80, 280, 1500, 300, 'ring12', 2.8, 0),
      this.phantomDef(W + 80, 800, 1500, 780, 'ring12', 2.8, 0.5),
      this.droneDef(W + 80,   440, 1420, 440, 'aimed', 1.4, 0.8),
      this.droneDef(W + 80,   640, 1420, 640, 'aimed', 1.4, 1.0),
      this.fairyDef(W + 80,   200, 1380, 200, 'aimed3', 1.6, 1.2),
      this.fairyDef(W + 80,   880, 1380, 880, 'aimed3', 1.6, 1.4),
    ]));

    // Wave 19 (t=100s): 3 drones with laser_fan (triple laser challenge)
    wave(100, 19, () => this.enemyMgr.spawnWave([
      this.droneDef(W + 80,  260, 1460, 260, 'laser_fan', 3.0, 0),
      this.droneDef(W + 80,  540, 1480, 540, 'laser_fan', 3.0, 0.4),
      this.droneDef(W + 80,  820, 1460, 820, 'laser_fan', 3.0, 0.8),
    ]));

    // Wave 20 (t=104s): Grand all-types wave (7+ enemies)
    wave(104, 20, () => this.enemyMgr.spawnWave([
      this.soulDef(W + 80,    180, 1520, 200, 'ring8',  2.4, 0),
      this.knightDef(W + 80,  540, 1540, 540, 'aimed5', 2.4, 0.25),
      this.soulDef(W + 80,    900, 1520, 880, 'ring8',  2.4, 0.5),
      this.wispDef(W + 80,    360, 1480, 360, 'ring8',  2.2, 0.75),
      this.wispDef(W + 80,    720, 1480, 720, 'ring8',  2.2, 1.0),
      this.droneDef(W + 80,   440, 1420, 440, 'laser_aimed', 2.6, 1.2),
      this.fairyDef(W + 80,   260, 1400, 260, 'aimed3', 1.6, 1.4),
      this.fairyDef(W + 80,   820, 1400, 820, 'aimed3', 1.6, 1.6),
    ]));
  }

  // ─── STAGE 3 WAVE TIMELINE ────────────────────────────────────────────────

  private buildStage3Timeline(): void {
    const wave = (t: number, waveNum: number, fn: () => void) => {
      this.waveEvents.push([t, () => {
        this.currentWaveNum = waveNum;
        fn();
      }]);
    };

    // ======================================================================
    //  20 waves over ~110 seconds — crystal garden, escalating patterns
    //
    //  ACT 1: TUTORIAL (waves 1-4)      — introduce gunner, bloom, prism
    //  ACT 2: INTRODUCTION (waves 5-9)  — mix types, split + spiral patterns
    //  ACT 3: COMBINATION (waves 10-15) — dense mixed waves, laser patterns
    //  ACT 4: CRESCENDO (waves 16-20)   — pre-miniboss pressure, all combined
    // ======================================================================

    // ── ACT 1: TUTORIAL ─────────────────────────────────────────────────
    // Wave 1 (t=2s): 3 gunners, aimed singles
    wave(2, 1, () => this.enemyMgr.spawnWave([
      this.gunnerDef(W + 80,  260, 1380, 280, 'aimed', 1.6, 0),
      this.gunnerDef(W + 80,  540, 1400, 540, 'aimed', 1.6, 0.3),
      this.gunnerDef(W + 80,  820, 1380, 800, 'aimed', 1.6, 0.6),
    ]));

    // Wave 2 (t=8s): 3 blooms, aimed3
    wave(8, 2, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,  200, 1460, 220, 'aimed3', 2.2, 0),
      this.bloomDef(W + 80,  540, 1480, 540, 'aimed3', 2.2, 0.3),
      this.bloomDef(W + 80,  880, 1460, 860, 'aimed3', 2.2, 0.6),
    ]));

    // Wave 3 (t=14s): 3 prisms, ring8
    wave(14, 3, () => this.enemyMgr.spawnWave([
      this.prismDef(W + 80,  300, 1500, 300, 'ring8', 2.6, 0),
      this.prismDef(W + 80,  540, 1520, 540, 'ring8', 2.6, 0.35),
      this.prismDef(W + 80,  780, 1500, 780, 'ring8', 2.6, 0.7),
    ]));

    // Wave 4 (t=20s): 4 gunners, burst3 pattern
    wave(20, 4, () => this.enemyMgr.spawnWave([
      this.gunnerDef(W + 80,  180, 1400, 200, 'burst3', 1.8, 0),
      this.gunnerDef(W + 80,  420, 1420, 420, 'burst3', 1.8, 0.2),
      this.gunnerDef(W + 80,  660, 1400, 660, 'burst3', 1.8, 0.4),
      this.gunnerDef(W + 80,  900, 1420, 900, 'burst3', 1.8, 0.6),
    ]));

    // ── ACT 2: INTRODUCTION ─────────────────────────────────────────────
    // Wave 5 (t=28s): 2 blooms (split) + 2 gunners
    wave(28, 5, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   300, 1460, 300, 'split', 2.4, 0),
      this.bloomDef(W + 80,   780, 1460, 780, 'split', 2.4, 0.4),
      this.gunnerDef(W + 80,  500, 1380, 500, 'aimed', 1.4, 0.7),
      this.gunnerDef(W + 80,  600, 1380, 600, 'aimed', 1.4, 0.9),
    ]));

    // Wave 6 (t=34s): 3 prisms (spiral3) + 1 bloom
    wave(34, 6, () => this.enemyMgr.spawnWave([
      this.prismDef(W + 80,   220, 1500, 240, 'spiral3', 2.2, 0),
      this.prismDef(W + 80,   540, 1520, 540, 'spiral3', 2.2, 0.3),
      this.prismDef(W + 80,   860, 1500, 840, 'spiral3', 2.2, 0.6),
      this.bloomDef(W + 80,   540, 1460, 540, 'aimed3',  2.4, 0.9),
    ]));

    // Wave 7 (t=40s): 4 gunners (aimed3) + 2 prisms
    wave(40, 7, () => this.enemyMgr.spawnWave([
      this.gunnerDef(W + 80,  200, 1400, 200, 'aimed3', 1.6, 0),
      this.gunnerDef(W + 80,  400, 1420, 400, 'aimed3', 1.6, 0.15),
      this.gunnerDef(W + 80,  680, 1400, 680, 'aimed3', 1.6, 0.3),
      this.gunnerDef(W + 80,  880, 1420, 880, 'aimed3', 1.6, 0.45),
      this.prismDef(W + 80,   340, 1500, 340, 'ring8',  2.4, 0.7),
      this.prismDef(W + 80,   740, 1500, 740, 'ring8',  2.4, 0.9),
    ]));

    // Wave 8 (t=46s): 2 blooms (split) + 3 gunners (burst3)
    wave(46, 8, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   260, 1480, 280, 'split', 2.6, 0),
      this.bloomDef(W + 80,   820, 1480, 800, 'split', 2.6, 0.4),
      this.gunnerDef(W + 80,  440, 1380, 440, 'burst3', 1.6, 0.6),
      this.gunnerDef(W + 80,  540, 1380, 540, 'burst3', 1.6, 0.8),
      this.gunnerDef(W + 80,  640, 1380, 640, 'burst3', 1.6, 1.0),
    ]));

    // Wave 9 (t=52s): 2 prisms (laser_aimed) + 2 blooms
    wave(52, 9, () => this.enemyMgr.spawnWave([
      this.prismDef(W + 80,   340, 1500, 340, 'laser_aimed', 3.0, 0),
      this.prismDef(W + 80,   740, 1500, 740, 'laser_aimed', 3.0, 0.5),
      this.bloomDef(W + 80,   440, 1440, 440, 'aimed3', 2.0, 0.8),
      this.bloomDef(W + 80,   640, 1440, 640, 'aimed3', 2.0, 1.0),
    ]));

    // ── ACT 3: COMBINATION ──────────────────────────────────────────────
    // Wave 10 (t=58s): 5 gunners in formation (aimed)
    wave(58, 10, () => this.enemyMgr.spawnWave([
      this.gunnerDef(W + 80,  160, 1360, 160, 'aimed', 1.4, 0),
      this.gunnerDef(W + 80,  340, 1380, 340, 'aimed', 1.4, 0.12),
      this.gunnerDef(W + 80,  520, 1360, 520, 'aimed', 1.4, 0.24),
      this.gunnerDef(W + 80,  700, 1380, 700, 'aimed', 1.4, 0.36),
      this.gunnerDef(W + 80,  880, 1360, 880, 'aimed', 1.4, 0.48),
    ]));

    // Wave 11 (t=63s): 2 blooms + prism + laser gunner (HEAVY)
    wave(63, 11, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   280, 1500, 280, 'split', 2.4, 0),
      this.bloomDef(W + 80,   800, 1500, 800, 'split', 2.4, 0.4),
      this.prismDef(W + 80,   540, 1540, 540, 'ring8', 2.6, 0.7),
      this.gunnerDef(W + 80,  440, 1420, 440, 'laser_aimed', 2.8, 1.0),
    ]));

    // Wave 12 (t=68s): 3 prisms (spiral3) + 3 gunners (LIGHTER)
    wave(68, 12, () => this.enemyMgr.spawnWave([
      this.prismDef(W + 80,   200, 1500, 220, 'spiral3', 2.2, 0),
      this.prismDef(W + 80,   540, 1520, 540, 'spiral3', 2.2, 0.25),
      this.prismDef(W + 80,   880, 1500, 860, 'spiral3', 2.2, 0.5),
      this.gunnerDef(W + 80,  360, 1380, 360, 'aimed3', 1.6, 0.7),
      this.gunnerDef(W + 80,  540, 1380, 540, 'aimed3', 1.6, 0.85),
      this.gunnerDef(W + 80,  720, 1380, 720, 'aimed3', 1.6, 1.0),
    ]));

    // Wave 13 (t=73s): 2 blooms(ring8) + 2 prisms(laser_cross) — dense
    wave(73, 13, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   300, 1480, 300, 'ring8', 2.4, 0),
      this.bloomDef(W + 80,   780, 1480, 780, 'ring8', 2.4, 0.35),
      this.prismDef(W + 80,   440, 1460, 440, 'laser_cross', 3.2, 0.7),
      this.prismDef(W + 80,   640, 1460, 640, 'laser_cross', 3.2, 1.0),
    ]));

    // Wave 14 (t=78s): 3 gunners + 2 blooms + 1 prism (overlapping)
    wave(78, 14, () => this.enemyMgr.spawnWave([
      this.gunnerDef(W + 80,  180, 1400, 200, 'burst3', 1.4, 0),
      this.gunnerDef(W + 80,  540, 1420, 540, 'burst3', 1.4, 0.25),
      this.gunnerDef(W + 80,  900, 1400, 880, 'burst3', 1.4, 0.5),
      this.bloomDef(W + 80,   360, 1480, 360, 'split', 2.4, 0.7),
      this.bloomDef(W + 80,   720, 1480, 720, 'split', 2.4, 0.9),
      this.prismDef(W + 80,   540, 1520, 540, 'ring8', 2.6, 1.1),
    ]));

    // Wave 15 (t=83s): 4 gunners (LIGHTER breather)
    wave(83, 15, () => this.enemyMgr.spawnWave([
      this.gunnerDef(W + 80,  200, 1460, 260, 'aimed', 1.8, 0),
      this.gunnerDef(W + 80,  460, 1480, 460, 'aimed', 1.8, 0.2),
      this.gunnerDef(W + 80,  620, 1480, 620, 'aimed', 1.8, 0.4),
      this.gunnerDef(W + 80,  880, 1460, 820, 'aimed', 1.8, 0.6),
    ]));

    // ── ACT 4: CRESCENDO ────────────────────────────────────────────────
    // Wave 16 (t=88s): 2 blooms + 2 prisms + laser gunner
    wave(88, 16, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   300, 1480, 300, 'split', 2.2, 0),
      this.bloomDef(W + 80,   780, 1480, 780, 'split', 2.2, 0.3),
      this.prismDef(W + 80,   440, 1520, 440, 'spiral3', 2.0, 0.6),
      this.prismDef(W + 80,   640, 1520, 640, 'spiral3', 2.0, 0.8),
      this.gunnerDef(W + 80,  540, 1440, 540, 'laser_aimed', 2.6, 1.0),
    ]));

    // Wave 17 (t=93s): 3 blooms(ring8) + 3 gunners(burst3)
    wave(93, 17, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   200, 1500, 220, 'ring8', 2.2, 0),
      this.bloomDef(W + 80,   540, 1520, 540, 'ring8', 2.2, 0.3),
      this.bloomDef(W + 80,   880, 1500, 860, 'ring8', 2.2, 0.6),
      this.gunnerDef(W + 80,  360, 1400, 360, 'burst3', 1.4, 0.8),
      this.gunnerDef(W + 80,  540, 1400, 540, 'burst3', 1.4, 1.0),
      this.gunnerDef(W + 80,  720, 1400, 720, 'burst3', 1.4, 1.2),
    ]));

    // Wave 18 (t=98s): 2 prisms(laser_fan) + 2 blooms + 2 gunners
    wave(98, 18, () => this.enemyMgr.spawnWave([
      this.prismDef(W + 80,   300, 1500, 300, 'laser_fan', 3.0, 0),
      this.prismDef(W + 80,   780, 1500, 780, 'laser_fan', 3.0, 0.5),
      this.bloomDef(W + 80,   440, 1440, 440, 'aimed3', 2.0, 0.8),
      this.bloomDef(W + 80,   640, 1440, 640, 'aimed3', 2.0, 1.0),
      this.gunnerDef(W + 80,  200, 1380, 200, 'aimed', 1.4, 1.2),
      this.gunnerDef(W + 80,  880, 1380, 880, 'aimed', 1.4, 1.4),
    ]));

    // Wave 19 (t=103s): 3 prisms(laser_cross) — triple laser challenge
    wave(103, 19, () => this.enemyMgr.spawnWave([
      this.prismDef(W + 80,   260, 1460, 260, 'laser_cross', 3.0, 0),
      this.prismDef(W + 80,   540, 1480, 540, 'laser_cross', 3.0, 0.4),
      this.prismDef(W + 80,   820, 1460, 820, 'laser_cross', 3.0, 0.8),
    ]));

    // Wave 20 (t=108s): Grand all-types wave (8+ enemies)
    wave(108, 20, () => this.enemyMgr.spawnWave([
      this.bloomDef(W + 80,   180, 1520, 200, 'split', 2.4, 0),
      this.prismDef(W + 80,   360, 1540, 360, 'spiral3', 2.2, 0.25),
      this.gunnerDef(W + 80,  540, 1400, 540, 'burst3', 1.4, 0.5),
      this.bloomDef(W + 80,   720, 1520, 720, 'ring8', 2.2, 0.75),
      this.prismDef(W + 80,   900, 1480, 880, 'spiral3', 2.2, 1.0),
      this.gunnerDef(W + 80,  260, 1400, 260, 'aimed3', 1.6, 1.25),
      this.gunnerDef(W + 80,  820, 1400, 820, 'aimed3', 1.6, 1.5),
      this.bloomDef(W + 80,   540, 1460, 540, 'split', 2.4, 1.7),
    ]));
  }

  // ─── STAGE 4 WAVE TIMELINE ────────────────────────────────────────────────

  private buildStage4Timeline(): void {
    const wave = (t: number, waveNum: number, fn: () => void) => {
      this.waveEvents.push([t, () => {
        this.currentWaveNum = waveNum;
        fn();
      }]);
    };

    // ======================================================================
    //  20 waves over ~115 seconds — celestial rift, cosmic enemies
    //
    //  ACT 1: TUTORIAL (waves 1-4)      — introduce shade, comet
    //  ACT 2: INTRODUCTION (waves 5-8)  — introduce seraph (tank), mixed
    //  ACT 3: COMBINATION (waves 9-14)  — dense mixed waves, laser patterns
    //  ACT 4: CRESCENDO (waves 15-20)   — pre-miniboss pressure, all combined
    // ======================================================================

    // ── ACT 1: TUTORIAL ─────────────────────────────────────────────────
    // Wave 1 (t=2s): 3 shades (helix) — introduce the type
    wave(2, 1, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  260, 1380, 280, 'helix', 2.2, 0),
      this.shadeDef(W + 80,  540, 1400, 540, 'helix', 2.2, 0.3),
      this.shadeDef(W + 80,  820, 1380, 800, 'helix', 2.2, 0.6),
    ]));

    // Wave 2 (t=8s): 3 comets (scatter) — introduce fast scatter enemies
    wave(8, 2, () => this.enemyMgr.spawnWave([
      this.cometDef(W + 80,  200, 1460, 220, 'scatter', 2.0, 0),
      this.cometDef(W + 80,  540, 1480, 540, 'scatter', 2.0, 0.3),
      this.cometDef(W + 80,  880, 1460, 860, 'scatter', 2.0, 0.6),
    ]));

    // Wave 3 (t=12s): 2 shades + 2 comets mixed
    wave(12, 3, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  300, 1400, 300, 'helix', 2.2, 0),
      this.shadeDef(W + 80,  780, 1400, 780, 'helix', 2.2, 0.3),
      this.cometDef(W + 80,  450, 1460, 450, 'scatter', 2.0, 0.5),
      this.cometDef(W + 80,  630, 1460, 630, 'scatter', 2.0, 0.7),
    ]));

    // Wave 4 (t=18s): 4 comets (aimed) + 1 shade (helix) — ramp up
    wave(18, 4, () => this.enemyMgr.spawnWave([
      this.cometDef(W + 80,  180, 1400, 200, 'aimed', 1.8, 0),
      this.cometDef(W + 80,  400, 1420, 400, 'aimed', 1.8, 0.2),
      this.cometDef(W + 80,  660, 1400, 660, 'aimed', 1.8, 0.4),
      this.cometDef(W + 80,  880, 1420, 880, 'aimed', 1.8, 0.6),
      this.shadeDef(W + 80,  540, 1500, 540, 'helix', 2.4, 0.8),
    ]));

    // ── ACT 2: INTRODUCTION ─────────────────────────────────────────────
    // Wave 5 (t=25s): 1 seraph (spray16) + 2 comets — introduce the tanky enemy
    wave(25, 5, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 540, 1500, 540, 'spray16', 3.0, 0),
      this.cometDef(W + 80,  300, 1400, 300, 'scatter', 2.0, 0.5),
      this.cometDef(W + 80,  780, 1400, 780, 'scatter', 2.0, 0.7),
    ]));

    // Wave 6 (t=32s): 2 shades (helix) + 1 seraph (spray16)
    wave(32, 6, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  280, 1420, 280, 'helix', 2.2, 0),
      this.shadeDef(W + 80,  800, 1420, 800, 'helix', 2.2, 0.3),
      this.seraphDef(W + 80, 540, 1520, 540, 'spray16', 3.0, 0.6),
    ]));

    // Wave 7 (t=38s): 3 comets (scatter) + 2 shades (aimed)
    wave(38, 7, () => this.enemyMgr.spawnWave([
      this.cometDef(W + 80,  200, 1400, 220, 'scatter', 2.0, 0),
      this.cometDef(W + 80,  540, 1420, 540, 'scatter', 2.0, 0.25),
      this.cometDef(W + 80,  880, 1400, 860, 'scatter', 2.0, 0.5),
      this.shadeDef(W + 80,  380, 1480, 380, 'aimed', 2.0, 0.7),
      this.shadeDef(W + 80,  700, 1480, 700, 'aimed', 2.0, 0.9),
    ]));

    // Wave 8 (t=44s): 2 seraphs (spray16) — double tank pressure
    wave(44, 8, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 340, 1500, 340, 'spray16', 2.8, 0),
      this.seraphDef(W + 80, 740, 1500, 740, 'spray16', 2.8, 0.5),
    ]));

    // ── ACT 3: COMBINATION ──────────────────────────────────────────────
    // Wave 9 (t=52s): 2 shades (laser_aimed) + 2 comets (scatter) — introduce laser enemies
    wave(52, 9, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  300, 1480, 300, 'laser_aimed', 3.0, 0),
      this.shadeDef(W + 80,  780, 1480, 780, 'laser_aimed', 3.0, 0.4),
      this.cometDef(W + 80,  450, 1400, 450, 'scatter', 2.0, 0.7),
      this.cometDef(W + 80,  630, 1400, 630, 'scatter', 2.0, 0.9),
    ]));

    // Wave 10 (t=58s): 1 seraph (spray16) + 2 comets (burst3) + 1 shade (helix)
    wave(58, 10, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 540, 1520, 540, 'spray16', 2.8, 0),
      this.cometDef(W + 80,  300, 1400, 300, 'burst3', 2.0, 0.3),
      this.cometDef(W + 80,  780, 1400, 780, 'burst3', 2.0, 0.5),
      this.shadeDef(W + 80,  440, 1460, 440, 'helix', 2.2, 0.8),
    ]));

    // Wave 11 (t=64s): 3 shades (helix) + 1 seraph (laser_aimed)
    wave(64, 11, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  200, 1420, 220, 'helix', 2.2, 0),
      this.shadeDef(W + 80,  540, 1440, 540, 'helix', 2.2, 0.25),
      this.shadeDef(W + 80,  880, 1420, 860, 'helix', 2.2, 0.5),
      this.seraphDef(W + 80, 540, 1520, 540, 'laser_aimed', 3.2, 0.8),
    ]));

    // Wave 12 (t=70s): 2 seraphs (spray16) + 2 comets (scatter)
    wave(70, 12, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 340, 1500, 340, 'spray16', 2.8, 0),
      this.seraphDef(W + 80, 740, 1500, 740, 'spray16', 2.8, 0.4),
      this.cometDef(W + 80,  440, 1400, 440, 'scatter', 2.0, 0.7),
      this.cometDef(W + 80,  640, 1400, 640, 'scatter', 2.0, 0.9),
    ]));

    // Wave 13 (t=76s): 2 shades (laser_cross) + 2 comets (scatter) + 1 seraph (spray16)
    wave(76, 13, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  340, 1460, 340, 'laser_cross', 3.2, 0),
      this.shadeDef(W + 80,  740, 1460, 740, 'laser_cross', 3.2, 0.4),
      this.cometDef(W + 80,  200, 1380, 200, 'scatter', 2.0, 0.7),
      this.cometDef(W + 80,  880, 1380, 880, 'scatter', 2.0, 0.9),
      this.seraphDef(W + 80, 540, 1520, 540, 'spray16', 3.0, 1.1),
    ]));

    // Wave 14 (t=82s): 3 comets (aimed) + 2 shades (helix) + 1 seraph (laser_aimed)
    wave(82, 14, () => this.enemyMgr.spawnWave([
      this.cometDef(W + 80,  180, 1400, 200, 'aimed', 1.8, 0),
      this.cometDef(W + 80,  540, 1420, 540, 'aimed', 1.8, 0.25),
      this.cometDef(W + 80,  900, 1400, 880, 'aimed', 1.8, 0.5),
      this.shadeDef(W + 80,  360, 1480, 360, 'helix', 2.2, 0.7),
      this.shadeDef(W + 80,  720, 1480, 720, 'helix', 2.2, 0.9),
      this.seraphDef(W + 80, 540, 1520, 540, 'laser_aimed', 3.2, 1.1),
    ]));

    // ── ACT 4: CRESCENDO ────────────────────────────────────────────────
    // Wave 15 (t=88s): 2 seraphs (spray16) + 3 comets (scatter)
    wave(88, 15, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 300, 1500, 300, 'spray16', 2.6, 0),
      this.seraphDef(W + 80, 780, 1500, 780, 'spray16', 2.6, 0.4),
      this.cometDef(W + 80,  200, 1380, 200, 'scatter', 1.8, 0.7),
      this.cometDef(W + 80,  540, 1400, 540, 'scatter', 1.8, 0.9),
      this.cometDef(W + 80,  880, 1380, 880, 'scatter', 1.8, 1.1),
    ]));

    // Wave 16 (t=93s): 3 shades (laser_aimed) + 2 comets (burst3)
    wave(93, 16, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  220, 1480, 240, 'laser_aimed', 2.8, 0),
      this.shadeDef(W + 80,  540, 1500, 540, 'laser_aimed', 2.8, 0.3),
      this.shadeDef(W + 80,  860, 1480, 840, 'laser_aimed', 2.8, 0.6),
      this.cometDef(W + 80,  380, 1400, 380, 'burst3', 2.0, 0.8),
      this.cometDef(W + 80,  700, 1400, 700, 'burst3', 2.0, 1.0),
    ]));

    // Wave 17 (t=98s): 2 seraphs (laser_fan) + 2 shades (helix)
    wave(98, 17, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 340, 1500, 340, 'laser_fan', 3.2, 0),
      this.seraphDef(W + 80, 740, 1500, 740, 'laser_fan', 3.2, 0.5),
      this.shadeDef(W + 80,  440, 1440, 440, 'helix', 2.0, 0.8),
      this.shadeDef(W + 80,  640, 1440, 640, 'helix', 2.0, 1.0),
    ]));

    // Wave 18 (t=103s): 2 shades (laser_cross) + 2 comets (scatter) + 2 seraphs (spray16)
    wave(103, 18, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  280, 1460, 280, 'laser_cross', 3.0, 0),
      this.shadeDef(W + 80,  800, 1460, 800, 'laser_cross', 3.0, 0.35),
      this.cometDef(W + 80,  440, 1380, 440, 'scatter', 1.8, 0.6),
      this.cometDef(W + 80,  640, 1380, 640, 'scatter', 1.8, 0.8),
      this.seraphDef(W + 80, 340, 1520, 340, 'spray16', 2.6, 1.0),
      this.seraphDef(W + 80, 740, 1520, 740, 'spray16', 2.6, 1.2),
    ]));

    // Wave 19 (t=108s): 3 seraphs (spray16) — triple tank challenge
    wave(108, 19, () => this.enemyMgr.spawnWave([
      this.seraphDef(W + 80, 260, 1500, 280, 'spray16', 2.6, 0),
      this.seraphDef(W + 80, 540, 1520, 540, 'spray16', 2.6, 0.4),
      this.seraphDef(W + 80, 820, 1500, 800, 'spray16', 2.6, 0.8),
    ]));

    // Wave 20 (t=113s): 2 shades (laser_aimed) + 3 comets (scatter) — final wave
    wave(113, 20, () => this.enemyMgr.spawnWave([
      this.shadeDef(W + 80,  300, 1480, 300, 'laser_aimed', 2.8, 0),
      this.shadeDef(W + 80,  780, 1480, 780, 'laser_aimed', 2.8, 0.4),
      this.cometDef(W + 80,  200, 1400, 200, 'scatter', 1.8, 0.7),
      this.cometDef(W + 80,  540, 1420, 540, 'scatter', 1.8, 0.9),
      this.cometDef(W + 80,  880, 1400, 880, 'scatter', 1.8, 1.1),
    ]));
  }

  private tickWaves(): void {
    while (this.nextWave < this.waveEvents.length && this.stageTimer >= this.waveEvents[this.nextWave][0]) {
      this.waveEvents[this.nextWave][1]();
      this.nextWave++;
    }
  }

  // ─── PHASE TRANSITIONS ────────────────────────────────────────────────────

  private enterMiniboss(): void {
    this.phase = 'miniboss';
    const minibossLabel = this.stageId === 4 ? '\u26A0  HERALD  \u26A0'
      : this.stageId === 3 ? '\u26A0  SENTINEL  \u26A0'
      : this.stageId === 2 ? '\u26A0  WARDEN  \u26A0' : '\u26A0  ELITE  \u26A0';
    this.hud.showMessage(minibossLabel, 2000, 0x55ddff, 56);
    sfx.bossWarning();

    const fireFn = (x: number, y: number, vx: number, vy: number, sc = 1, tint = 0x55ddff) => {
      this.eBullets.fire(x, y, vx, vy, sc, sc, tint);
    };

    if (this.stageId === 4) {
      const laserFireFn: LaserFireFn = (ox, oy, angle, w, telDur, actDur, tint, opts?) => {
        this.laserPool.fireLaser(ox, oy, angle, w, telDur, actDur, tint, opts);
      };
      this.miniboss = new Miniboss4(this, fireFn, laserFireFn);
      this.bossBar.show('VOID HERALD');
    } else if (this.stageId === 3) {
      const laserFireFn: LaserFireFn = (ox, oy, angle, w, telDur, actDur, tint, opts?) => {
        this.laserPool.fireLaser(ox, oy, angle, w, telDur, actDur, tint, opts);
      };
      this.miniboss = new Miniboss3(this, fireFn, laserFireFn);
      this.bossBar.show('THORN SENTINEL');
    } else if (this.stageId === 2) {
      const laserFireFn: LaserFireFn = (ox, oy, angle, w, telDur, actDur, tint, opts?) => {
        this.laserPool.fireLaser(ox, oy, angle, w, telDur, actDur, tint, opts);
      };
      this.miniboss = new Miniboss2(this, fireFn, laserFireFn);
      this.bossBar.show('WARDEN AUTOMATON');
    } else {
      this.miniboss = new Miniboss(this, fireFn);
      this.bossBar.show('SHRINE GUARDIAN');
    }

    const minibossScore = this.stageId === 4 ? BALANCE.stage4.miniboss.score
      : this.stageId === 3 ? BALANCE.stage3.miniboss.score
      : this.stageId === 2 ? BALANCE.stage2.miniboss.score : BALANCE.miniboss.score;
    this.miniboss.onDie = () => {
      this.bossBar.hide();
      sfx.explosion();
      this.burst(this.miniboss!.x, this.miniboss!.y, 24, 0x44ffee);
      this.spawnPickups(this.miniboss!.x, this.miniboss!.y, BALANCE.pickups.minibossDrops, 'power');
      this.addScore(minibossScore);
      const defeatMsg = this.stageId === 4 ? 'HERALD DEFEATED'
        : this.stageId === 3 ? 'SENTINEL DEFEATED'
        : this.stageId === 2 ? 'WARDEN DEFEATED' : 'ELITE DEFEATED';
      this.hud.showMessage(defeatMsg, 2000, 0x44ffee, 48);
      this.laserPool.releaseAll();

      // Interlude before boss
      this.phase      = 'interlude';
      this.phaseTimer = 5;
      this.eBullets.releaseAll();

      // More enemy waves during interlude
      this.time.delayedCall(1500, () => {
        if (this.phase !== 'interlude') return;
        if (this.stageId === 4) {
          this.enemyMgr.spawnWave([
            this.shadeDef(W + 80, 320, 1380, 320, 'aimed', 1.6),
            this.shadeDef(W + 80, 760, 1380, 760, 'aimed', 1.6),
          ]);
        } else if (this.stageId === 3) {
          this.enemyMgr.spawnWave([
            this.gunnerDef(W + 80, 320, 1380, 320, 'aimed', 1.6),
            this.gunnerDef(W + 80, 760, 1380, 760, 'aimed', 1.6),
          ]);
        } else if (this.stageId === 2) {
          this.enemyMgr.spawnWave([
            this.droneDef(W + 80, 320, 1380, 320, 'aimed', 1.6),
            this.droneDef(W + 80, 760, 1380, 760, 'aimed', 1.6),
          ]);
        } else {
          this.enemyMgr.spawnWave([
            this.fairyDef(W + 80, 320, 1360, 320, 'aimed',  1.8),
            this.fairyDef(W + 80, 760, 1360, 760, 'aimed',  1.8),
          ]);
        }
      });
    };
  }

  // ─── PRE-BOSS DIALOGUE ────────────────────────────────────────────────────

  private dialogueGroup: Phaser.GameObjects.GameObject[] = [];
  private dialogueLineIndex = 0;
  private dialogueZKey!: Phaser.Input.Keyboard.Key;

  private static readonly DIALOGUE_LINES_S1: Array<{
    speaker: 'player' | 'boss';
    name: string;
    text: string;
  }> = [
    { speaker: 'player', name: 'Kira',     text: 'I can feel it — a vast power resonating\nfrom the rift ahead. Who goes there?' },
    { speaker: 'boss',   name: 'Aetheria', text: 'So a wanderer dares approach my sanctuary.\nYou are either very brave, or very foolish.' },
    { speaker: 'player', name: 'Kira',     text: "The Aether Rift is tearing this world apart.\nI'm sealing it — whether you allow it or not." },
    { speaker: 'boss',   name: 'Aetheria', text: 'Ha! You would defy a deity? Then you will\nlearn what it means to oppose a butterfly god.' },
    { speaker: 'player', name: 'Kira',     text: "Butterfly or not — I\'ve come too far to stop.\nCome at me, Aetheria. Let\'s settle this!" },
    { speaker: 'boss',   name: 'Aetheria', text: 'Your courage is admirable, little spark.\nBut courage alone cannot survive my storm!' },
  ];

  private static readonly DIALOGUE_LINES_S2: Array<{
    speaker: 'player' | 'boss';
    name: string;
    text: string;
  }> = [
    { speaker: 'player', name: 'Kira',     text: 'The rift grows deeper. This machinery...\nit\'s alive.' },
    { speaker: 'boss',   name: 'Vortex',   text: 'You dare descend into my domain, little spark?' },
    { speaker: 'player', name: 'Kira',     text: 'I\'ll shut down every gear in this abyss\nif I have to.' },
    { speaker: 'boss',   name: 'Vortex',   text: 'Then be consumed by the engine of eternity!' },
  ];

  private static readonly DIALOGUE_LINES_S3: Array<{
    speaker: 'player' | 'boss';
    name: string;
    text: string;
  }> = [
    { speaker: 'player', name: 'Kira',     text: 'A garden of crystal... frozen in eternal bloom.\nWhat happened here?' },
    { speaker: 'boss',   name: 'Rosalia',  text: 'Eden was perfect. Then the rift shattered\neverything I had cultivated.' },
    { speaker: 'player', name: 'Kira',     text: 'I can feel the corruption spreading.\nLet me seal the rift and restore this place.' },
    { speaker: 'boss',   name: 'Rosalia',  text: 'Restore? You would prune my thorns?\nThis garden blooms only for those who\ncan survive its beauty.' },
    { speaker: 'player', name: 'Kira',     text: 'Then show me the thorns, Rosalia.\nI will not wilt!' },
    { speaker: 'boss',   name: 'Rosalia',  text: 'Very well, little blossom. Let Eden\njudge whether you are worthy!' },
  ];

  private static readonly DIALOGUE_LINES_S4: Array<{
    speaker: 'player' | 'boss';
    name: string;
    text: string;
  }> = [
    { speaker: 'player', name: 'Kira',    text: 'The rift... it\'s opening wider.' },
    { speaker: 'boss',   name: '???',     text: 'You dare approach the Celestial Rift?' },
    { speaker: 'player', name: 'Kira',    text: 'I\'ll seal this rift — no matter what!' },
    { speaker: 'boss',   name: 'Solaris', text: 'I am SOLARIS! The eternal flame that\nburns between worlds!' },
    { speaker: 'player', name: 'Kira',    text: 'Your light won\'t blind me!' },
    { speaker: 'boss',   name: 'Solaris', text: 'Then BURN with the stars!' },
  ];

  private getDialogueLines() {
    return this.stageId === 4 ? GameScene.DIALOGUE_LINES_S4
      : this.stageId === 3 ? GameScene.DIALOGUE_LINES_S3
      : this.stageId === 2 ? GameScene.DIALOGUE_LINES_S2
      : GameScene.DIALOGUE_LINES_S1;
  }

  private enterDialogue(): void {
    this.phase             = 'dialogue';
    this.dialogueLineIndex = 0;
    this.dialogueGroup     = [];
    this.player.frozen     = true;   // suppress all player input during dialogue
    this.enemyMgr.clearAll();
    this.eBullets.releaseAll();
    this.laserPool.releaseAll();

    // Dim the background with a semi-transparent panel
    const dimRect = this.add.rectangle(W / 2, H / 2, W, H, 0x000011, 0.55)
      .setDepth(DEPTH.OVERLAY - 2);
    this.dialogueGroup.push(dimRect);

    // Dialogue box background — wide bar at bottom third of screen
    const BOX_Y    = H - 240;
    const BOX_H    = 230;
    const BOX_W    = W - 160;
    const boxBg    = this.add.rectangle(W / 2, BOX_Y, BOX_W, BOX_H, 0x060618, 0.92)
      .setDepth(DEPTH.OVERLAY - 1);
    const boxBorder = this.add.rectangle(W / 2, BOX_Y, BOX_W, BOX_H, 0x0000ff, 0)
      .setDepth(DEPTH.OVERLAY - 1)
      .setStrokeStyle(2, 0x66aaff, 0.7);
    this.dialogueGroup.push(boxBg, boxBorder);

    // Inner accent line at top of box
    const accentLine = this.add.rectangle(W / 2, BOX_Y - BOX_H / 2 + 4, BOX_W - 4, 2, 0x66aaff, 0.6)
      .setDepth(DEPTH.OVERLAY);
    this.dialogueGroup.push(accentLine);

    // LEFT portrait frame (player) — shown when player speaks
    const PORT_SIZE  = 200;
    const PORT_L_X   = 120;
    const PORT_Y     = BOX_Y - BOX_H / 2 - PORT_SIZE / 2 + 20;

    const playerFrameBg = this.add.rectangle(PORT_L_X, PORT_Y, PORT_SIZE + 4, PORT_SIZE + 4, 0x0a0a22)
      .setDepth(DEPTH.OVERLAY - 1);
    const playerFrameBorder = this.add.rectangle(PORT_L_X, PORT_Y, PORT_SIZE + 4, PORT_SIZE + 4, 0, 0)
      .setDepth(DEPTH.OVERLAY - 1)
      .setStrokeStyle(2, 0x44ccff, 1);
    const playerPortrait = this.add.image(PORT_L_X, PORT_Y, 'portrait-player')
      .setDisplaySize(PORT_SIZE, PORT_SIZE)
      .setDepth(DEPTH.OVERLAY);
    this.dialogueGroup.push(playerFrameBg, playerFrameBorder, playerPortrait);

    // RIGHT portrait frame (boss)
    const PORT_R_X = W - 120;
    const bossFrameBg = this.add.rectangle(PORT_R_X, PORT_Y, PORT_SIZE + 4, PORT_SIZE + 4, 0x0a0a22)
      .setDepth(DEPTH.OVERLAY - 1);
    const bossFrameBorder = this.add.rectangle(PORT_R_X, PORT_Y, PORT_SIZE + 4, PORT_SIZE + 4, 0, 0)
      .setDepth(DEPTH.OVERLAY - 1)
      .setStrokeStyle(2, 0xff66cc, 1);
    const bossPortraitKey = this.stageId === 4 ? 'portrait-boss4' : this.stageId === 3 ? 'portrait-boss3' : this.stageId === 2 ? 'portrait-boss2' : 'portrait-boss';
    const bossPortrait = this.add.image(PORT_R_X, PORT_Y, bossPortraitKey)
      .setDisplaySize(PORT_SIZE, PORT_SIZE)
      .setDepth(DEPTH.OVERLAY);
    this.dialogueGroup.push(bossFrameBg, bossFrameBorder, bossPortrait);

    // Speaker name label
    const nameLabel = this.add.text(W / 2, BOX_Y - BOX_H / 2 + 28, '', {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#aaddff',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(DEPTH.OVERLAY);
    this.dialogueGroup.push(nameLabel);

    // Main dialogue text — left-aligned inside box
    const TEXT_X = 240;
    const TEXT_Y = BOX_Y - BOX_H / 2 + 60;
    const dialogueText = this.add.text(TEXT_X, TEXT_Y, '', {
      fontFamily: FONT,
      fontSize:   '30px',
      color:      '#eeeeff',
      stroke:     '#000',
      strokeThickness: 3,
      wordWrap:   { width: BOX_W - TEXT_X - 60 },
      lineSpacing: 10,
    }).setOrigin(0, 0).setDepth(DEPTH.OVERLAY);
    this.dialogueGroup.push(dialogueText);

    // Z-to-advance hint (pulsing)
    const hint = this.add.text(W / 2, BOX_Y + BOX_H / 2 - 28, 'Press Z to continue', {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#8899bb',
    }).setOrigin(0.5, 1).setDepth(DEPTH.OVERLAY);
    this.dialogueGroup.push(hint);
    this.tweens.add({
      targets: hint, alpha: { from: 1, to: 0.3 },
      duration: 700, yoyo: true, repeat: -1,
    });

    // Portrait dim helpers — dim the non-speaking side
    const playerDim = this.add.rectangle(PORT_L_X, PORT_Y, PORT_SIZE + 4, PORT_SIZE + 4, 0x000000, 0.5)
      .setDepth(DEPTH.OVERLAY + 1);
    const bossDim = this.add.rectangle(PORT_R_X, PORT_Y, PORT_SIZE + 4, PORT_SIZE + 4, 0x000000, 0.5)
      .setDepth(DEPTH.OVERLAY + 1);
    this.dialogueGroup.push(playerDim, bossDim);

    // Show first line
    const dialogueLines = this.getDialogueLines();
    const showLine = (idx: number) => {
      if (idx >= dialogueLines.length) {
        this.endDialogue();
        return;
      }
      const line = dialogueLines[idx];
      const isPlayer = line.speaker === 'player';

      // Update name label colour by speaker
      nameLabel.setText(line.name);
      nameLabel.setColor(isPlayer ? '#44ccff' : '#ff88cc');

      // Update text with a quick type-in tween (alpha fade)
      dialogueText.setText(line.text).setAlpha(0);
      this.tweens.add({ targets: dialogueText, alpha: 1, duration: 180 });

      // Frame glow pulse for active speaker
      const activeFrame  = isPlayer ? playerFrameBorder : bossFrameBorder;
      const inactiveFrame = isPlayer ? bossFrameBorder : playerFrameBorder;
      activeFrame.setStrokeStyle(3, isPlayer ? 0x44ccff : 0xff66cc, 1);
      inactiveFrame.setStrokeStyle(2, isPlayer ? 0xff66cc : 0x44ccff, 0.4);

      // Dim inactive portrait
      playerDim.setAlpha(isPlayer ? 0 : 0.5);
      bossDim.setAlpha(isPlayer ? 0.5 : 0);

      // Bounce the active portrait
      const activePortrait = isPlayer ? playerPortrait : bossPortrait;
      this.tweens.add({
        targets: activePortrait,
        y: { from: PORT_Y - 8, to: PORT_Y },
        duration: 200,
        ease: 'Back.easeOut',
      });
    };

    // Z key to advance
    this.dialogueZKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.dialogueZKey.on('down', () => {
      if (this.phase !== 'dialogue') return;
      this.dialogueLineIndex++;
      showLine(this.dialogueLineIndex);
    });

    // Fade in and show first line
    this.dialogueGroup.forEach(g => { if ('setAlpha' in g) (g as Phaser.GameObjects.GameObject & { setAlpha: (a: number) => void }).setAlpha(0); });
    this.tweens.add({
      targets: this.dialogueGroup.filter(g => 'setAlpha' in g),
      alpha: 1,
      duration: 500,
      onComplete: () => showLine(0),
    });
  }

  private endDialogue(): void {
    // Fade everything out, then go to boss warning
    this.tweens.add({
      targets: this.dialogueGroup.filter(g => 'setAlpha' in g),
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.dialogueGroup.forEach(g => { if ('destroy' in g) (g as Phaser.GameObjects.GameObject & { destroy: () => void }).destroy(); });
        this.dialogueGroup = [];
        this.player.frozen = false;
        if (this.dialogueZKey) this.dialogueZKey.removeAllListeners();
        this.enterBossWarning();
      },
    });
  }

  private enterBossWarning(): void {
    this.phase      = 'boss_warning';
    this.phaseTimer = 2.8;
    this.enemyMgr.clearAll();
    this.eBullets.releaseAll();
    this.laserPool.releaseAll();

    // Switch to boss BGM with dramatic crossfade
    bgm.play('boss', 1000);
    sfx.bossWarning();

    // Subtle screen shake throughout warning
    this.cameras.main.shake(2400, 0.003);

    // Red tinted overlay that pulses
    const redOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0.12)
      .setDepth(DEPTH.OVERLAY - 1);
    this.tweens.add({
      targets: redOverlay,
      alpha: { from: 0.12, to: 0.04 },
      duration: 350,
      yoyo: true,
      repeat: 7,
      onComplete: () => redOverlay.destroy(),
    });

    // Warning flash banner — larger and more impactful
    const warningText = this.stageId === 4 ? '\u26A1 ETERNAL FLAME \u26A1'
      : this.stageId === 3 ? '\u26A1 SHATTERED BLOOM \u26A1'
      : this.stageId === 2 ? '\u26A1 RIFT ENGINE \u26A1' : '!! BOSS APPROACHING !!';
    const banner = this.add.text(W / 2, H / 2, warningText, {
      fontFamily: FONT,
      fontSize: '72px',
      color: '#ff2244',
      stroke: '#000',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(DEPTH.OVERLAY);

    this.tweens.add({
      targets: banner,
      alpha: { from: 1, to: 0.1 },
      scaleX: { from: 1.05, to: 1 },
      scaleY: { from: 1.05, to: 1 },
      duration: 280, yoyo: true, repeat: 9,
      onComplete: () => banner.destroy(),
    });
  }

  private bossEBullets!: BulletPool;   // medium-sized pool for boss attacks

  private enterBoss(): void {
    this.phase = 'boss';

    // Boss gets its own medium-bullet pool so they read as more threatening
    if (!this.bossEBullets) {
      this.bossEBullets = new BulletPool(this, 'bul-round-md', 400, DEPTH.EBULLET);
    }

    const fireFn = (x: number, y: number, vx: number, vy: number, sc = 1, tint = 0xff88cc) => {
      this.bossEBullets.fire(x, y, vx, vy, sc, sc, tint);
    };

    if (this.stageId === 4) {
      const laserFireFn: LaserFireFn = (ox, oy, angle, w, telDur, actDur, tint, opts?) => {
        this.laserPool.fireLaser(ox, oy, angle, w, telDur, actDur, tint, opts);
      };
      this.boss = new Boss4(this, fireFn, laserFireFn);
      this.bossBar.show('SOLARIS,  THE ETERNAL FLAME');
    } else if (this.stageId === 3) {
      const laserFireFn: LaserFireFn = (ox, oy, angle, w, telDur, actDur, tint, opts?) => {
        this.laserPool.fireLaser(ox, oy, angle, w, telDur, actDur, tint, opts);
      };
      this.boss = new Boss3(this, fireFn, laserFireFn);
      this.bossBar.show('ROSALIA,  THE SHATTERED BLOOM');
    } else if (this.stageId === 2) {
      const laserFireFn: LaserFireFn = (ox, oy, angle, w, telDur, actDur, tint, opts?) => {
        this.laserPool.fireLaser(ox, oy, angle, w, telDur, actDur, tint, opts);
      };
      this.boss = new Boss2(this, fireFn, laserFireFn);
      this.bossBar.show('VORTEX,  THE RIFT ENGINE');
    } else {
      this.boss = new Boss(this, fireFn);
      this.bossBar.show('AETHERIA,  BUTTERFLY DEITY');
    }

    const phaseColor = this.stageId === 4 ? 0xffcc00 : this.stageId === 3 ? 0xff66cc : this.stageId === 2 ? 0x00ccaa : 0xff88cc;

    this.boss.onPhaseChange = (phase: number) => {
      sfx.phaseChange();
      this.eBullets.releaseAll();
      this.bossEBullets?.releaseAll();
      this.laserPool.releaseAll();
      this.cameras.main.shake(300, 0.012);
      const msgs: Record<number, string> = { 2: 'PHASE II', 3: 'FINAL PHASE' };
      this.hud.showMessage(msgs[phase] ?? '', 1800, phaseColor, 60);
    };

    const bossScore = this.stageId === 4 ? BALANCE.stage4.boss.score
      : this.stageId === 3 ? BALANCE.stage3.boss.score
      : this.stageId === 2 ? BALANCE.stage2.boss.score : BALANCE.boss.score;
    this.boss.onDie = () => {
      this.bossBar.hide();
      this.eBullets.releaseAll();
      this.bossEBullets?.releaseAll();
      this.laserPool.releaseAll();
      this.cameras.main.shake(500, 0.018);
      sfx.explosion();
      this.burst(this.boss!.x, this.boss!.y, 40, phaseColor);
      this.addScore(bossScore);

      this.time.delayedCall(1800, () => {
        this.phase = 'clear';
        bgm.stop(600);
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.time.delayedCall(650, () => {
          this.game.registry.set('hiScore', this.hiScore);
          // Save player state for potential stage continuation
          this.registry.set('currentStage', this.stageId);
          this.registry.set('carryScore', this.score);
          this.registry.set('carryLives', this.player.lives);
          this.registry.set('carryBombs', this.player.bombs);
          this.registry.set('carryPower', this.player.power);
          this.scene.start('ClearScene', { score: this.score, hiScore: this.hiScore });
        });
      });
    };
  }

  // ─── PLAYER FIRE ──────────────────────────────────────────────────────────

  private firePlayer(x: number, y: number, power: number, focused: boolean): void {
    const lvl = getPowerLevel(power);
    const spd = PBULLET_SPEED;

    if (focused) {
      // Focused: narrow vertical bolts
      const cols = lvl < 3 ? 1 : 2;
      for (let c = -(cols - 1); c <= cols - 1; c += 2) {
        this.fireFocusBullet(x + c * 16, y);
      }
      this.fireFocusBullet(x, y);
      sfx.focusShoot();
      return;
    }

    sfx.shoot();
    if (lvl === 1) {
      this.pBullets.fire(x + 20, y, spd, 0);
      this.spawnBulletTrail(x + 20, y);
    } else if (lvl === 2) {
      this.pBullets.fire(x + 20, y - 16, spd, -18);
      this.pBullets.fire(x + 20, y + 16, spd,  18);
      this.spawnBulletTrail(x + 20, y - 16);
      this.spawnBulletTrail(x + 20, y + 16);
    } else if (lvl === 3) {
      this.pBullets.fire(x + 20, y,      spd,  0);
      this.pBullets.fire(x + 20, y - 24, spd, -28);
      this.pBullets.fire(x + 20, y + 24, spd,  28);
      this.spawnBulletTrail(x + 20, y);
      this.spawnBulletTrail(x + 20, y - 24);
      this.spawnBulletTrail(x + 20, y + 24);
    } else {
      this.pBullets.fire(x + 20, y,      spd,  0);
      this.pBullets.fire(x + 20, y - 20, spd, -20);
      this.pBullets.fire(x + 20, y + 20, spd,  20);
      this.pBullets.fire(x + 20, y - 44, spd, -42);
      this.pBullets.fire(x + 20, y + 44, spd,  42);
      this.spawnBulletTrail(x + 20, y);
      this.spawnBulletTrail(x + 20, y - 20);
      this.spawnBulletTrail(x + 20, y + 20);
      this.spawnBulletTrail(x + 20, y - 44);
      this.spawnBulletTrail(x + 20, y + 44);
    }
  }

  private spawnBulletTrail(bx: number, by: number): void {
    // Muzzle flash — bright elongated burst at gun tip
    const flash = this.add.ellipse(bx + 8, by, 32, 9, 0xffffff, 1)
      .setDepth(DEPTH.PBULLET + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2.8,
      scaleY: 0.35,
      x: bx + 36,
      duration: 60,
      ease: 'Power2.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Cyan glow afterimage behind bullet
    const trail = this.add.graphics().setDepth(DEPTH.PBULLET - 1);
    trail.fillStyle(0x88ddff, 0.7);
    trail.fillRoundedRect(bx - 18, by - 4, 36, 8, 4);
    trail.fillStyle(0xffffff, 0.4);
    trail.fillRoundedRect(bx - 8, by - 2, 18, 4, 2);
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 2.2,
      duration: 100,
      ease: 'Power2',
      onComplete: () => trail.destroy(),
    });
  }

  /** Small directional spark burst when player bullet hits an enemy. */
  private spawnHitSparks(x: number, y: number): void {
    // Main directional burst — bright gold/white forward cone
    const em = this.add.particles(x, y, 'particle', {
      speed:    { min: 90, max: 380 },
      scale:    { start: 0.9, end: 0 },
      lifespan: { min: 90, max: 220 },
      tint:     [0xffffff, 0xffff88, 0xffdd44, 0xff8822],
      angle:    { min: 140, max: 220 },
      quantity: 10,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(DEPTH.FX + 1);
    em.explode(10);

    // Small hot-white flash dot at impact point
    const dot = this.add.graphics()
      .setDepth(DEPTH.FX + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(x, y, 5);
    this.tweens.add({
      targets: dot, alpha: 0, scaleX: 2.8, scaleY: 2.8,
      duration: 90, ease: 'Power2',
      onComplete: () => dot.destroy(),
    });

    this.time.delayedCall(280, () => { if (em.active) em.destroy(); });
  }

  private focusPool!: BulletPool;

  private fireFocusBullet(x: number, y: number): void {
    if (!this.focusPool) {
      this.focusPool = new BulletPool(this, 'bul-focus', 64, DEPTH.PBULLET);
    }
    this.focusPool.fire(x, y, PBULLET_SPEED * 0.85, 0, 1, 1, 0xaaffff);
  }

  // ─── BOMB ─────────────────────────────────────────────────────────────────

  private doBomb(): void {
    sfx.bomb();
    this.eBullets.releaseAll();
    this.laserPool.releaseAll();

    // Flash
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.6)
      .setDepth(DEPTH.OVERLAY - 5);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 600, ease: 'Power2',
      onComplete: () => flash.destroy(),
    });

    // Ring expansion
    const ring = this.add.image(this.player.x, this.player.y, 'bomb-ring')
      .setScale(0).setDepth(DEPTH.FX).setAlpha(0.9);
    this.tweens.add({
      targets: ring, scaleX: 16, scaleY: 16, alpha: 0,
      duration: 900, ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    // Damage enemies in radius — balance-based, not instant kill
    for (const e of this.enemyMgr.getActive()) {
      e.hit(BALANCE.player.bomb.enemyDamage, (enemy) => {
        this.addScore(enemy.score, enemy.x, enemy.y);
        this.burst(enemy.x, enemy.y, 8, 0xffaa44);
        this.laserPool.releaseByOwner(enemy.laserOwnerId);
        if (Math.random() < BALANCE.pickups.powerDropRate) this.spawnPickups(enemy.x, enemy.y, 1, 'power');
      });
    }
    if (this.boss?.alive) {
      this.boss.hit(BALANCE.player.bomb.bossDamage);
    }
    if (this.miniboss?.alive) {
      this.miniboss.hit(BALANCE.player.bomb.minibossDamage);
    }
  }

  // ─── ENEMY BULLET FIRE ────────────────────────────────────────────────────

  private fireEnemyPattern(ex: number, ey: number, baseAngle: number, pattern: string): void {
    const spd = getWaveBulletSpeed(this.currentWaveNum, this.stageId);
    switch (pattern) {
      case 'aimed':
        this.eBullets.fire(ex, ey, Math.cos(baseAngle) * spd, Math.sin(baseAngle) * spd);
        break;
      case 'aimed3': {
        const spread = 0.28;
        for (let i = -1; i <= 1; i++) {
          const a = baseAngle + i * spread;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd, Math.sin(a) * spd);
        }
        break;
      }
      case 'spread5': {
        const spread5 = Math.PI / 3;
        for (let i = 0; i < 5; i++) {
          const a = baseAngle - spread5 / 2 + (spread5 / 4) * i;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.9, Math.sin(a) * spd * 0.9);
        }
        break;
      }
      case 'ring8':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.85, Math.sin(a) * spd * 0.85, 1, 1, 0xddaaff);
        }
        break;
      case 'aimed5': {
        // 5-shot wide fan centred on player
        const fanSpread = 0.55;
        for (let i = -2; i <= 2; i++) {
          const a = baseAngle + i * (fanSpread / 4);
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.88, Math.sin(a) * spd * 0.88, 1, 1, 0xff6644);
        }
        break;
      }
      case 'ring12':
        // 12-shot dense ring — used by phantoms
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.75, Math.sin(a) * spd * 0.75, 1, 1, 0xaa66ff);
        }
        break;
      case 'laser2':
        // 2 large slow bullets — heavy projectiles
        this.eBullets.fire(ex, ey, Math.cos(baseAngle) * spd * 0.48, Math.sin(baseAngle) * spd * 0.48, 2.2, 2.2, 0xff2266);
        this.eBullets.fire(ex, ey, Math.cos(baseAngle + 0.22) * spd * 0.48, Math.sin(baseAngle + 0.22) * spd * 0.48, 2.2, 2.2, 0xff2266);
        break;
      case 'aimed_back': {
        // 3 shots aimed AWAY from player (escape shots)
        const backAngle = baseAngle + Math.PI;
        const bSpread = 0.3;
        for (let i = -1; i <= 1; i++) {
          const a = backAngle + i * bSpread;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.8, Math.sin(a) * spd * 0.8, 1, 1, 0x88eeff);
        }
        break;
      }
      case 'burst_wide':
        // 6-shot 180° front arc
        for (let i = 0; i < 6; i++) {
          const a = baseAngle - Math.PI / 2 + (Math.PI / 5) * i;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.82, Math.sin(a) * spd * 0.82, 1, 1, 0xffcc22);
        }
        break;
      case 'burst3': {
        // 3-round rapid burst aimed at player (80ms intervals)
        let burst3Count = 0;
        const burst3Shoot = () => {
          if (burst3Count >= 3) return;
          this.eBullets.fire(ex, ey, Math.cos(baseAngle) * spd * 1.05, Math.sin(baseAngle) * spd * 1.05, 1, 1, 0xff66cc);
          burst3Count++;
          if (burst3Count < 3) this.time.delayedCall(80, burst3Shoot);
        };
        burst3Shoot();
        break;
      }
      case 'split': {
        // Fire one slow large bullet, then after 400ms fire 5 bullets in a ring from predicted position
        const slowSpd = spd * 0.45;
        const svx = Math.cos(baseAngle) * slowSpd;
        const svy = Math.sin(baseAngle) * slowSpd;
        this.eBullets.fire(ex, ey, svx, svy, 1.8, 1.8, 0x88ccff);
        this.time.delayedCall(400, () => {
          const px = ex + svx * 0.4;
          const py2 = ey + svy * 0.4;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            this.eBullets.fire(px, py2, Math.cos(a) * spd * 0.7, Math.sin(a) * spd * 0.7, 1, 1, 0x88ccff);
          }
        });
        break;
      }
      case 'spiral3': {
        // 3 bullets in a rotating pattern
        const spiralBase = this.stageTimer * 3;
        for (let i = 0; i < 3; i++) {
          const a = spiralBase + (i / 3) * Math.PI * 2;
          this.eBullets.fire(ex, ey, Math.cos(a) * spd * 0.8, Math.sin(a) * spd * 0.8, 1, 1, 0xff66cc);
        }
        break;
      }
      case 'spray16': {
        // Massive 16-bullet fan spray (~200°) — mini-boss level attack
        const spread = Math.PI * 1.1;
        const spd16 = getWaveBulletSpeed(this.currentWaveNum, this.stageId) * (this.stageId >= 4 ? 1.0 : 0.9);
        for (let i = 0; i < 16; i++) {
          const a = baseAngle - spread / 2 + (i / 15) * spread;
          const sv = spd16 * (0.85 + Math.random() * 0.3);
          this.eBullets.fire(ex, ey, Math.cos(a) * sv, Math.sin(a) * sv, 1, 1, 0xffcc00);
        }
        break;
      }
      case 'helix': {
        // Double helix — two streams with oscillating aim offset
        const spdHelix = getWaveBulletSpeed(this.currentWaveNum, this.stageId) * 0.9;
        const t = this.stageTimer;
        for (let i = 0; i < 2; i++) {
          const rotOff = Math.sin(t * 4 + i * Math.PI) * 0.5;
          const a = baseAngle + rotOff;
          this.eBullets.fire(ex, ey, Math.cos(a) * spdHelix, Math.sin(a) * spdHelix, 0.9, 0.9, 0x8844ff);
        }
        break;
      }
      case 'scatter': {
        // Tight random cluster burst — 6 bullets with random spread and speed variance
        const spdScatter = getWaveBulletSpeed(this.currentWaveNum, this.stageId);
        for (let i = 0; i < 6; i++) {
          const aOff = (Math.random() - 0.5) * 0.7;
          const sv = spdScatter * (0.7 + Math.random() * 0.5);
          const a = baseAngle + aOff;
          this.eBullets.fire(ex, ey, Math.cos(a) * sv, Math.sin(a) * sv, 0.8, 0.8, 0x00ddff);
        }
        break;
      }
    }
    sfx.enemyShoot();
  }

  // ─── COLLISIONS ───────────────────────────────────────────────────────────

  private checkCollisions(): void {
    const px = this.player.x;
    const py = this.player.y;
    const hr2 = HITBOX_R * HITBOX_R;
    const gr2 = GRAZE_R  * GRAZE_R;

    // ── Enemy bullets → player ──────────────────────────────────────────────
    const checkBulletPool = (pool: BulletPool) => {
      if (!this.player.dead && !this.player.bombActive) {
        pool.forEach((i, s) => {
          const dx = s.x - px;
          const dy = s.y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < hr2) {
            if (!this.player.invincible) {
              pool.release(i);
              this.onPlayerHit();
            }
            return;
          }
          if (d2 < gr2 && !pool.isGrazed(i)) {
            pool.setGrazed(i);
            this.graze++;
            this.addScore(SC_GRAZE);
            sfx.graze();
            this.showGrazeFlash(px, py);
          }
        });
      }
    };
    checkBulletPool(this.eBullets);
    if (this.bossEBullets) checkBulletPool(this.bossEBullets);

    // ── Laser beams → player ────────────────────────────────────────────────
    if (!this.player.dead && !this.player.invincible && !this.player.bombActive) {
      if (this.laserPool.checkPlayerHit(px, py, BALANCE.player.hitboxR)) {
        this.onPlayerHit();
      }
    }

    // ── Enemy bodies → player (contact damage) ─────────────────────────────
    if (!this.player.dead && !this.player.invincible && !this.player.bombActive) {
      const enemies = this.enemyMgr.getActive();
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = Math.abs(px - e.x);
        const dy = Math.abs(py - e.y);
        if (dx < e.hW + HITBOX_R && dy < e.hH + HITBOX_R) {
          this.onPlayerHit();
          break;
        }
      }
      // Miniboss body collision
      if (this.miniboss?.alive && !this.player.invincible) {
        const dx = Math.abs(px - this.miniboss.x);
        const dy = Math.abs(py - this.miniboss.y);
        if (dx < this.miniboss.hW + HITBOX_R && dy < this.miniboss.hH + HITBOX_R) {
          this.onPlayerHit();
        }
      }
      // Boss body collision
      if (this.boss?.alive && !this.player.invincible) {
        const dx = Math.abs(px - this.boss.x);
        const dy = Math.abs(py - this.boss.y);
        if (dx < this.boss.hW + HITBOX_R && dy < this.boss.hH + HITBOX_R) {
          this.onPlayerHit();
        }
      }
    }

    // ── Player bullets → enemies ────────────────────────────────────────────
    const enemies = this.enemyMgr.getActive();
    this.pBullets.forEach((i, s) => {
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = Math.abs(s.x - e.x);
        const dy = Math.abs(s.y - e.y);
        if (dx < e.hW && dy < e.hH) {
          this.pBullets.release(i);
          this.spawnHitSparks(s.x, s.y);
          e.hit(this.player.getDamage(), (dead) => {
            this.addScore(dead.score, dead.x, dead.y);
            sfx.explosion();
            this.burst(dead.x, dead.y, 10, 0xffaa44);
            this.laserPool.releaseByOwner(dead.laserOwnerId);
            if (Math.random() < BALANCE.pickups.powerDropRate) this.spawnPickups(dead.x, dead.y, 1, 'power');
            this.cameras.main.shake(90, 0.005);
          });
          hit = true;
          break;
        }
      }
      if (hit) return;

      if (this.miniboss?.alive) {
        const dx = Math.abs(s.x - this.miniboss.x);
        const dy = Math.abs(s.y - this.miniboss.y);
        if (dx < this.miniboss.hW && dy < this.miniboss.hH) {
          this.pBullets.release(i);
          this.spawnHitSparks(s.x, s.y);
          this.miniboss.hit(this.player.getDamage());
          sfx.hit();
          return;
        }
      }
      if (this.boss?.alive) {
        const dx = Math.abs(s.x - this.boss.x);
        const dy = Math.abs(s.y - this.boss.y);
        if (dx < this.boss.hW && dy < this.boss.hH) {
          this.pBullets.release(i);
          this.spawnHitSparks(s.x, s.y);
          this.boss.hit(this.player.getDamage());
          sfx.hit();
          return;
        }
      }
    });

    // Also check focus pool collisions
    if (this.focusPool) {
      this.focusPool.forEach((i, s) => {
        if (this.boss?.alive) {
          const dx = Math.abs(s.x - this.boss.x);
          const dy = Math.abs(s.y - this.boss.y);
          if (dx < this.boss.hW && dy < this.boss.hH) {
            this.focusPool.release(i);
            this.boss.hit(this.player.getDamage());
            sfx.hit();
          }
        }
        if (this.miniboss?.alive) {
          const dx = Math.abs(s.x - this.miniboss.x);
          const dy = Math.abs(s.y - this.miniboss.y);
          if (dx < this.miniboss.hW && dy < this.miniboss.hH) {
            this.focusPool.release(i);
            this.miniboss.hit(this.player.getDamage());
            sfx.hit();
          }
        }
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = Math.abs(s.x - e.x);
          const dy = Math.abs(s.y - e.y);
          if (dx < e.hW && dy < e.hH) {
            this.focusPool.release(i);
            e.hit(this.player.getDamage(), (dead) => {
              this.addScore(dead.score, dead.x, dead.y);
              sfx.explosion();
              this.burst(dead.x, dead.y, 8, 0xffaa44);
              this.laserPool.releaseByOwner(dead.laserOwnerId);
              if (Math.random() < BALANCE.pickups.powerDropRate) this.spawnPickups(dead.x, dead.y, 1, 'power');
              this.cameras.main.shake(80, 0.004);
            });
            break;
          }
        }
      });
    }

    // ── Pickups ──────────────────────────────────────────────────────────────
    const autoCollect = py < H * 0.18; // top of screen = auto-collect all
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p  = this.pickups[i];
      const dx = p.sprite.x - px;
      const dy = p.sprite.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < 44 * 44 || autoCollect) {
        this.collectPickup(i);
      }
    }
  }

  // ─── PLAYER HIT ───────────────────────────────────────────────────────────

  private onPlayerHit(): void {
    if (this.player.invincible || this.player.dead) return;

    sfx.playerDeath();
    this.cameras.main.shake(250, 0.01);
    this.burst(this.player.x, this.player.y, 20, 0xff6644);

    const dead = this.player.hit();
    if (dead) {
      this.player.setVisible(false);
      this.time.delayedCall(1200, () => this.gameOver());
    } else {
      // Stay visible — iframes blink handles the visual feedback.
      // Clear enemy bullets to give breathing room.
      this.eBullets.releaseAll();
      if (this.bossEBullets) this.bossEBullets.releaseAll();
      this.laserPool.releaseAll();
    }
  }

  private gameOver(): void {
    this.phase = 'over';
    bgm.stop(500);
    this.game.registry.set('hiScore', this.hiScore);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(550, () => {
      this.scene.start('GameOverScene', { score: this.score, hiScore: this.hiScore });
    });
  }

  // ─── PICKUPS ──────────────────────────────────────────────────────────────

  private spawnPickups(x: number, y: number, count: number, type: 'power' | 'bomb'): void {
    const tex = type === 'power' ? 'pickup-power' : 'pickup-bomb';
    for (let i = 0; i < count; i++) {
      const sprite = this.add.image(
        x + (Math.random() - 0.5) * 60,
        y + (Math.random() - 0.5) * 60,
        this.textures.exists(tex) ? tex : 'pickup-fallback',
      ).setDepth(DEPTH.PICKUP).setScale(0).setAlpha(0);

      // Bounce-in spawn animation, then gentle scale-breathe to attract the eye
      this.tweens.add({
        targets: sprite,
        scaleX: 0.72, scaleY: 0.72,
        alpha:  1,
        duration: 220,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: sprite,
            scaleX: 0.86, scaleY: 0.86,
            duration: 480 + Math.random() * 160,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 250,
          });
        },
      });

      this.pickups.push({
        sprite,
        type,
        vx: -56 - Math.random() * 40,
        vy: (Math.random() - 0.5) * 80,
      });
    }
  }

  private updatePickups(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    for (const p of this.pickups) {
      // Mild attraction toward player
      const dx = px - p.sprite.x;
      const dy = py - p.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 280) {
        const pull = 160 / dist;
        p.vx += (dx / dist) * pull * dt * 60;
        p.vy += (dy / dist) * pull * dt * 60;
      }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;

      // Clamp vy
      p.vy = Phaser.Math.Clamp(p.vy, -360, 360);
    }

    // Remove off-screen pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const s = this.pickups[i].sprite;
      if (s.x < -80 || s.x > W + 80 || s.y < -80 || s.y > H + 80) {
        this.tweens.killTweensOf(s);
        s.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  private collectPickup(idx: number): void {
    const p = this.pickups[idx];
    sfx.pickup();

    // Collect flash — quick scale-up + fade
    const flash = this.add.image(p.sprite.x, p.sprite.y, p.sprite.texture.key)
      .setDepth(DEPTH.FX).setScale(0.72).setAlpha(0.9);
    this.tweens.add({
      targets: flash,
      scaleX: 1.8, scaleY: 1.8,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });

    if (p.type === 'power') {
      if (this.player.power >= MAX_POWER) {
        this.addScore(SC_PICKUP);
      } else {
        this.player.addPower(BALANCE.player.powerPerGem);
      }
    } else {
      this.player.bombs = Math.min(this.player.bombs + 1, START_BOMBS + 1);
      this.hud.showMessage('BOMB GET!', 800, 0xcc88ff, 40);
    }
    this.tweens.killTweensOf(p.sprite);
    p.sprite.destroy();
    this.pickups.splice(idx, 1);
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private addScore(n: number, x?: number, y?: number): void {
    this.score += n;
    if (this.score > this.hiScore) this.hiScore = this.score;
    if (x !== undefined && y !== undefined) {
      this.showScorePopup(x, y, n);
    }
  }

  private showScorePopup(x: number, y: number, value: number, color: string = '#ffee88'): void {
    const txt = this.add.text(x, y, `+${value}`, {
      fontFamily: FONT,
      fontSize: '28px',
      color,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH.FX).setAlpha(1);

    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 600,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  private burst(x: number, y: number, count: number, tint: number): void {
    // Bright circle flash at explosion center — ADD blend for glow
    const flashGfx = this.add.graphics()
      .setDepth(DEPTH.FX + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    flashGfx.fillStyle(0xffffff, 0.9);
    flashGfx.fillCircle(x, y, 22);
    this.tweens.add({
      targets: flashGfx,
      alpha: 0,
      scaleX: 4.5,
      scaleY: 4.5,
      duration: 180,
      ease: 'Power2',
      onComplete: () => flashGfx.destroy(),
    });

    const em = this.add.particles(x, y, 'particle', {
      speed:    { min: 80, max: 440 },
      scale:    { start: 1.2, end: 0 },
      lifespan: { min: 280, max: 700 },
      alpha:    { start: 1, end: 0 },
      tint,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(DEPTH.FX);
    em.explode(count);
    this.time.delayedCall(800, () => { if (em.active) em.destroy(); });
  }

  private showGrazeFlash(x: number, y: number): void {
    const ring = this.add.image(x, y, 'graze-ring').setDepth(DEPTH.FX).setAlpha(0.9);
    this.tweens.add({
      targets: ring, alpha: 0, scaleX: 4, scaleY: 4,
      duration: 180, ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
  }

  // ─── PROCEDURAL BACKGROUND LAYERS ─────────────────────────────────────────
  // Each canvas is 2048 px wide and uses integer-frequency sine waves so the
  // tile repeats with zero visible seam regardless of tilePositionX offset.

  private buildMountainLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 440;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;

    const rng = new Phaser.Math.RandomDataGenerator(['mt-v1']);
    // Integer frequencies → perfectly seamless tile at any x offset
    const waves: [number, number, number][] = [
      [3,  TH * 0.36, rng.frac() * Math.PI * 2],
      [5,  TH * 0.18, rng.frac() * Math.PI * 2],
      [9,  TH * 0.09, rng.frac() * Math.PI * 2],
      [14, TH * 0.04, rng.frac() * Math.PI * 2],
    ];

    const profile: number[] = [];
    for (let x = 0; x < TW; x++) {
      let elev = 0;
      for (const [freq, amp, ph] of waves) {
        elev += Math.max(0, Math.sin(x / TW * Math.PI * 2 * freq + ph)) * amp;
      }
      profile.push(TH - Phaser.Math.Clamp(elev, 0, TH * 0.88));
    }

    const grad = ctx.createLinearGradient(0, 0, 0, TH);
    grad.addColorStop(0,    'rgba(14,4,28,0)');
    grad.addColorStop(0.20, 'rgba(14,4,28,0.80)');
    grad.addColorStop(1,    '#0b0420');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x < TW; x++) ctx.lineTo(x, profile[x]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();
    return cv;
  }

  private buildBuildingLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 280;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;

    const rng = new Phaser.Math.RandomDataGenerator(['bd-v1']);
    const profile = new Float32Array(TW).fill(TH);

    let bx = 0;
    while (bx < TW) {
      const bw = rng.between(44, 112);
      const bh = rng.between(48, 185);
      const by = TH - bh;
      // Main building body
      for (let i = bx; i < Math.min(bx + bw, TW); i++) profile[i] = by;
      // Pagoda spike atop wider buildings
      if (rng.frac() < 0.42 && bw > 58) {
        const mid = bx + bw / 2;
        const sh  = rng.between(28, 72);
        for (let i = bx; i < Math.min(bx + bw, TW); i++) {
          const t = Math.abs(i - mid) / (bw * 0.5);
          profile[i] = Math.min(profile[i], by - sh * Math.max(0, 1 - t * 1.7));
        }
      }
      bx += bw + rng.between(8, 55);
    }
    // Clear 20 px at each edge so the seam is pure ground-level
    for (let i = 0; i < 20; i++) profile[i] = TH;
    for (let i = TW - 20; i < TW; i++) profile[i] = TH;

    ctx.fillStyle = '#07021a';
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let i = 0; i < TW; i++) ctx.lineTo(i, profile[i]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();
    return cv;
  }

  private buildNearLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 210;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#040110';

    // Flat ground strip
    ctx.fillRect(0, TH - 44, TW, 44);

    const rng = new Phaser.Math.RandomDataGenerator(['nr-v1']);
    let tx = rng.between(55, 200);
    while (tx < TW - 90) {
      const gh   = rng.between(95, 165);   // gate height
      const gw   = gh * (rng.between(80, 115) / 100);
      this.drawToriiSilhouette(ctx, tx, TH - 44, gw, gh);
      tx += rng.between(240, 520);
    }
    return cv;
  }

  private drawToriiSilhouette(
    ctx: CanvasRenderingContext2D,
    cx: number, ground: number,
    gw: number, gh: number,
  ): void {
    const pw = Math.max(5, gw * 0.07);
    ctx.fillStyle = '#040110';
    // Left post
    ctx.fillRect(cx - gw / 2,         ground - gh, pw, gh);
    // Right post
    ctx.fillRect(cx + gw / 2 - pw,    ground - gh, pw, gh);
    // Kasagi (top crossbeam, overhangs)
    const kh = Math.max(7, gh * 0.10);
    ctx.fillRect(cx - gw / 2 - pw,    ground - gh,       gw + pw * 2, kh);
    // Shimaki (second crossbeam below)
    ctx.fillRect(cx - gw / 2,         ground - gh + kh * 1.8, gw, kh * 0.55);
  }

  // ─── STAGE 2 PARALLAX ──────────────────────────────────────────────────────
  // Industrial/clockwork theme: teal & orange palette, gears, pipes, crystals.

  private buildStage2Parallax(): void {
    // Far layer — crystal spires & gear silhouettes
    const farC = this.buildS2FarLayer();
    this.textures.addCanvas('_bg_mt', farC);
    this.bgMountains = this.add
      .tileSprite(0, H, W, farC.height, '_bg_mt')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_MID - 1);

    // Mid layer — industrial ruins with pipes
    const midC = this.buildS2MidLayer();
    this.textures.addCanvas('_bg_bd', midC);
    this.bgBuildings = this.add
      .tileSprite(0, H, W, midC.height, '_bg_bd')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_MID);

    // Near layer — rotating cog shapes and conduit lines
    const nearC = this.buildS2NearLayer();
    this.textures.addCanvas('_bg_nr', nearC);
    this.bgNear = this.add
      .tileSprite(0, H, W, nearC.height, '_bg_nr')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_NEAR - 1);
  }

  /** Far layer: crystal spires rising from a jagged ridgeline, gear outlines. */
  private buildS2FarLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 440;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s2-far']);

    // Ridgeline profile using sine waves
    const waves: [number, number, number][] = [
      [2,  TH * 0.30, rng.frac() * Math.PI * 2],
      [6,  TH * 0.16, rng.frac() * Math.PI * 2],
      [11, TH * 0.07, rng.frac() * Math.PI * 2],
    ];
    const profile: number[] = [];
    for (let x = 0; x < TW; x++) {
      let elev = 0;
      for (const [freq, amp, ph] of waves) {
        elev += Math.max(0, Math.sin(x / TW * Math.PI * 2 * freq + ph)) * amp;
      }
      profile.push(TH - Phaser.Math.Clamp(elev, 0, TH * 0.85));
    }

    // Fill with dark teal gradient
    const grad = ctx.createLinearGradient(0, 0, 0, TH);
    grad.addColorStop(0,    'rgba(0,20,18,0)');
    grad.addColorStop(0.25, 'rgba(0,20,18,0.75)');
    grad.addColorStop(1,    '#021210');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x < TW; x++) ctx.lineTo(x, profile[x]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    // Crystal spires
    let sx = rng.between(100, 300);
    while (sx < TW - 80) {
      const sh = rng.between(60, 180);
      const sw = rng.between(12, 30);
      const baseY = profile[Math.min(sx, TW - 1)];
      ctx.fillStyle = 'rgba(0,80,70,0.5)';
      ctx.beginPath();
      ctx.moveTo(sx - sw / 2, baseY);
      ctx.lineTo(sx, baseY - sh);
      ctx.lineTo(sx + sw / 2, baseY);
      ctx.closePath();
      ctx.fill();
      // Inner highlight
      ctx.fillStyle = 'rgba(0,200,170,0.15)';
      ctx.beginPath();
      ctx.moveTo(sx - sw / 4, baseY);
      ctx.lineTo(sx, baseY - sh * 0.7);
      ctx.lineTo(sx + sw / 6, baseY);
      ctx.closePath();
      ctx.fill();
      sx += rng.between(200, 500);
    }

    // Gear silhouettes (simple circles with cutouts)
    let gx = rng.between(150, 400);
    while (gx < TW - 60) {
      const gr = rng.between(20, 55);
      const gy = profile[Math.min(gx, TW - 1)] - rng.between(10, 40);
      ctx.strokeStyle = 'rgba(0,100,80,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.stroke();
      // Inner circle
      ctx.beginPath();
      ctx.arc(gx, gy, gr * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      // Teeth stubs
      const teeth = rng.between(6, 10);
      for (let t = 0; t < teeth; t++) {
        const a = (t / teeth) * Math.PI * 2;
        const tx2 = gx + Math.cos(a) * (gr + 6);
        const ty = gy + Math.sin(a) * (gr + 6);
        ctx.fillStyle = 'rgba(0,100,80,0.3)';
        ctx.fillRect(tx2 - 3, ty - 3, 6, 6);
      }
      gx += rng.between(300, 600);
    }

    return cv;
  }

  /** Mid layer: industrial ruins with pipes and conduits. */
  private buildS2MidLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 280;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s2-mid']);

    const profile = new Float32Array(TW).fill(TH);

    // Industrial structures — blocky ruins
    let bx = 0;
    while (bx < TW) {
      const bw = rng.between(50, 130);
      const bh = rng.between(40, 170);
      const by = TH - bh;
      for (let i = bx; i < Math.min(bx + bw, TW); i++) profile[i] = by;

      // Pipe stack on top
      if (rng.frac() < 0.5 && bw > 60) {
        const pipes = rng.between(2, 5);
        for (let p = 0; p < pipes; p++) {
          const py = by - 8 - p * 12;
          const pw = bw * rng.realInRange(0.5, 0.9);
          const px = bx + (bw - pw) / 2;
          for (let i = Math.floor(px); i < Math.min(Math.floor(px + pw), TW); i++) {
            profile[i] = Math.min(profile[i], py);
          }
        }
      }
      // Tall chimney / smokestack
      if (rng.frac() < 0.35) {
        const cw = rng.between(10, 22);
        const ch = rng.between(30, 80);
        const cx = bx + bw / 2;
        for (let i = Math.floor(cx - cw / 2); i < Math.min(Math.floor(cx + cw / 2), TW); i++) {
          if (i >= 0) profile[i] = Math.min(profile[i], by - ch);
        }
      }
      bx += bw + rng.between(12, 60);
    }

    // Clear edges for seamless tile
    for (let i = 0; i < 20; i++) profile[i] = TH;
    for (let i = TW - 20; i < TW; i++) profile[i] = TH;

    // Fill with dark industrial colour
    ctx.fillStyle = '#040d0b';
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let i = 0; i < TW; i++) ctx.lineTo(i, profile[i]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    // Horizontal pipe lines across some ruins
    for (let p = 0; p < 6; p++) {
      const py = rng.between(60, TH - 30);
      const pLen = rng.between(200, 600);
      const pStart = rng.between(0, TW - pLen);
      ctx.strokeStyle = 'rgba(0,80,60,0.3)';
      ctx.lineWidth = rng.between(2, 5);
      ctx.beginPath();
      ctx.moveTo(pStart, py);
      ctx.lineTo(pStart + pLen, py);
      ctx.stroke();
    }

    return cv;
  }

  /** Near layer: cog shapes and conduit patterns. */
  private buildS2NearLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 210;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s2-near']);

    // Ground strip
    ctx.fillStyle = '#020a08';
    ctx.fillRect(0, TH - 44, TW, 44);

    // Cog shapes along the ground
    let cx = rng.between(80, 250);
    while (cx < TW - 80) {
      const cogR = rng.between(24, 70);
      const cy = TH - 44 - cogR + rng.between(-10, 10);
      const teeth = rng.between(8, 16);
      const toothH = cogR * 0.25;

      // Outer gear
      ctx.strokeStyle = 'rgba(0,60,50,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cogR, 0, Math.PI * 2);
      ctx.stroke();
      // Inner hub
      ctx.beginPath();
      ctx.arc(cx, cy, cogR * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      // Teeth
      ctx.fillStyle = 'rgba(0,60,50,0.3)';
      for (let t = 0; t < teeth; t++) {
        const a = (t / teeth) * Math.PI * 2;
        const tw = Math.PI / teeth * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, cogR + toothH, a - tw, a + tw);
        ctx.arc(cx, cy, cogR, a + tw, a - tw, true);
        ctx.fill();
      }

      cx += rng.between(180, 450);
    }

    // Conduit lines running along the ground
    for (let c = 0; c < 4; c++) {
      const ly = TH - 44 + rng.between(4, 36);
      ctx.strokeStyle = 'rgba(255,100,0,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(TW, ly);
      ctx.stroke();
    }

    // Vertical conduit risers
    let vx = rng.between(100, 300);
    while (vx < TW - 50) {
      const vh = rng.between(40, 120);
      ctx.strokeStyle = 'rgba(0,80,60,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, TH - 44);
      ctx.lineTo(vx, TH - 44 - vh);
      ctx.stroke();
      // Small node at top
      ctx.fillStyle = 'rgba(0,200,170,0.15)';
      ctx.fillRect(vx - 4, TH - 44 - vh - 4, 8, 8);
      vx += rng.between(300, 600);
    }

    return cv;
  }

  // ─── STAGE 3 PARALLAX: Shattered Eden ─────────────────────────────────────

  private buildStage3Parallax(): void {
    // Far layer — crystal spires and frozen rose silhouettes
    const farC = this.buildS3FarLayer();
    this.textures.addCanvas('_bg_mt', farC);
    this.bgMountains = this.add
      .tileSprite(0, H, W, farC.height, '_bg_mt')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_MID - 1);

    // Mid layer — frozen garden ruins with thorny vines
    const midC = this.buildS3MidLayer();
    this.textures.addCanvas('_bg_bd', midC);
    this.bgBuildings = this.add
      .tileSprite(0, H, W, midC.height, '_bg_bd')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_MID);

    // Near layer — floating crystal shards
    const nearC = this.buildS3NearLayer();
    this.textures.addCanvas('_bg_nr', nearC);
    this.bgNear = this.add
      .tileSprite(0, H, W, nearC.height, '_bg_nr')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_NEAR - 1);
  }

  /** Far layer: crystal spires rising from a ridgeline, frozen rose silhouettes. */
  private buildS3FarLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 440;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s3-far']);

    // Ridgeline profile
    const waves: [number, number, number][] = [
      [2,  TH * 0.28, rng.frac() * Math.PI * 2],
      [5,  TH * 0.18, rng.frac() * Math.PI * 2],
      [9,  TH * 0.08, rng.frac() * Math.PI * 2],
    ];
    const profile: number[] = [];
    for (let x = 0; x < TW; x++) {
      let elev = 0;
      for (const [freq, amp, ph] of waves) {
        elev += Math.max(0, Math.sin(x / TW * Math.PI * 2 * freq + ph)) * amp;
      }
      profile.push(TH - Phaser.Math.Clamp(elev, 0, TH * 0.85));
    }

    // Fill with deep violet gradient
    const grad = ctx.createLinearGradient(0, 0, 0, TH);
    grad.addColorStop(0,    'rgba(20,8,30,0)');
    grad.addColorStop(0.25, 'rgba(20,8,30,0.75)');
    grad.addColorStop(1,    '#0a0418');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x < TW; x++) ctx.lineTo(x, profile[x]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    // Crystal spires
    let sx = rng.between(100, 300);
    while (sx < TW - 80) {
      const sh = rng.between(70, 200);
      const sw = rng.between(14, 32);
      const baseY = profile[Math.min(sx, TW - 1)];
      ctx.fillStyle = 'rgba(60,20,80,0.5)';
      ctx.beginPath();
      ctx.moveTo(sx - sw / 2, baseY);
      ctx.lineTo(sx, baseY - sh);
      ctx.lineTo(sx + sw / 2, baseY);
      ctx.closePath();
      ctx.fill();
      // Inner highlight — icy blue
      ctx.fillStyle = 'rgba(136,204,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(sx - sw / 4, baseY);
      ctx.lineTo(sx, baseY - sh * 0.7);
      ctx.lineTo(sx + sw / 6, baseY);
      ctx.closePath();
      ctx.fill();
      sx += rng.between(200, 500);
    }

    // Frozen rose silhouettes
    let rx = rng.between(150, 400);
    while (rx < TW - 60) {
      const rr = rng.between(15, 40);
      const ry = profile[Math.min(rx, TW - 1)] - rng.between(10, 40);
      // Rose circle
      ctx.strokeStyle = 'rgba(255,102,204,0.20)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.stroke();
      // Inner petals
      const petals = rng.between(5, 8);
      for (let p = 0; p < petals; p++) {
        const a = (p / petals) * Math.PI * 2;
        ctx.strokeStyle = 'rgba(255,102,204,0.12)';
        ctx.beginPath();
        ctx.ellipse(rx + Math.cos(a) * rr * 0.4, ry + Math.sin(a) * rr * 0.4, rr * 0.35, rr * 0.2, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      rx += rng.between(300, 600);
    }

    return cv;
  }

  /** Mid layer: frozen garden ruins with thorny vine structures. */
  private buildS3MidLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 280;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s3-mid']);

    const profile = new Float32Array(TW).fill(TH);

    // Garden structures — arched trellises, pillars
    let bx = 0;
    while (bx < TW) {
      const bw = rng.between(50, 120);
      const bh = rng.between(50, 180);
      const by = TH - bh;
      for (let i = bx; i < Math.min(bx + bw, TW); i++) profile[i] = by;

      // Arch on top
      if (rng.frac() < 0.4 && bw > 70) {
        ctx.strokeStyle = 'rgba(80,30,100,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx + bw / 2, by, bw / 2, Math.PI, 0);
        ctx.stroke();
      }

      // Thorny vine growing up
      if (rng.frac() < 0.5) {
        const vx = bx + rng.between(5, bw - 5);
        const vh = rng.between(30, 80);
        ctx.strokeStyle = 'rgba(60,20,40,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(vx, by);
        ctx.bezierCurveTo(vx - 10, by - vh * 0.5, vx + 15, by - vh * 0.7, vx, by - vh);
        ctx.stroke();
        // Thorns
        for (let t = 0; t < 3; t++) {
          const ty = by - vh * (0.3 + t * 0.25);
          ctx.strokeStyle = 'rgba(60,20,40,0.3)';
          ctx.beginPath();
          ctx.moveTo(vx, ty);
          ctx.lineTo(vx + (t % 2 === 0 ? 8 : -8), ty - 6);
          ctx.stroke();
        }
      }

      bx += bw + rng.between(30, 100);
    }

    // Fill structures
    const sGrad = ctx.createLinearGradient(0, 0, 0, TH);
    sGrad.addColorStop(0, 'rgba(30,10,40,0)');
    sGrad.addColorStop(0.4, 'rgba(30,10,40,0.7)');
    sGrad.addColorStop(1, '#0a0418');
    ctx.fillStyle = sGrad;
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x < TW; x++) ctx.lineTo(x, profile[x]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    return cv;
  }

  /** Near layer: floating crystal shards and ground crystals. */
  private buildS3NearLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 210;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s3-near']);

    // Ground strip
    ctx.fillStyle = '#0a0418';
    ctx.fillRect(0, TH - 44, TW, 44);

    // Crystal shards along the ground
    let cx = rng.between(80, 250);
    while (cx < TW - 80) {
      const ch = rng.between(30, 90);
      const cw = rng.between(8, 22);
      const by = TH - 44;

      // Crystal shard (diamond shape)
      ctx.fillStyle = 'rgba(60,20,80,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, by - ch);
      ctx.lineTo(cx + cw / 2, by);
      ctx.lineTo(cx - cw / 2, by);
      ctx.closePath();
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = 'rgba(136,204,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(cx, by - ch * 0.8);
      ctx.lineTo(cx + cw / 4, by);
      ctx.lineTo(cx - cw / 4, by);
      ctx.closePath();
      ctx.fill();

      cx += rng.between(180, 450);
    }

    // Floating small crystal fragments
    let fx = rng.between(100, 300);
    while (fx < TW - 50) {
      const fy = rng.between(30, TH - 80);
      const fs = rng.between(4, 12);

      ctx.fillStyle = 'rgba(200,150,255,0.12)';
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rng.frac() * Math.PI);
      ctx.fillRect(-fs / 2, -fs / 2, fs, fs);
      ctx.restore();

      fx += rng.between(200, 500);
    }

    // Faint vine lines along the ground
    for (let c = 0; c < 3; c++) {
      const ly = TH - 44 + rng.between(4, 36);
      ctx.strokeStyle = 'rgba(255,102,204,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(TW, ly);
      ctx.stroke();
    }

    return cv;
  }

  // ─── STAGE 4 PARALLAX: Celestial Rift ──────────────────────────────────────

  private buildStage4Parallax(): void {
    // Far layer — cosmic nebula clouds with scattered stars
    const farC = this.buildS4FarLayer();
    this.textures.addCanvas('_bg_mt', farC);
    this.bgMountains = this.add
      .tileSprite(0, H, W, farC.height, '_bg_mt')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_MID - 1);

    // Mid layer — floating reality shards (angular crystal fragments)
    const midC = this.buildS4MidLayer();
    this.textures.addCanvas('_bg_bd', midC);
    this.bgBuildings = this.add
      .tileSprite(0, H, W, midC.height, '_bg_bd')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_MID);

    // Near layer — energy streams and bright star particles
    const nearC = this.buildS4NearLayer();
    this.textures.addCanvas('_bg_nr', nearC);
    this.bgNear = this.add
      .tileSprite(0, H, W, nearC.height, '_bg_nr')
      .setOrigin(0, 1)
      .setDepth(DEPTH.BG_NEAR - 1);
  }

  /** Far layer: cosmic nebula clouds — soft purple/indigo gradients with scattered star dots. */
  private buildS4FarLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 440;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s4-far']);

    // Nebula ridgeline profile
    const waves: [number, number, number][] = [
      [2,  TH * 0.32, rng.frac() * Math.PI * 2],
      [4,  TH * 0.20, rng.frac() * Math.PI * 2],
      [8,  TH * 0.10, rng.frac() * Math.PI * 2],
    ];
    const profile: number[] = [];
    for (let x = 0; x < TW; x++) {
      let elev = 0;
      for (const [freq, amp, ph] of waves) {
        elev += Math.max(0, Math.sin(x / TW * Math.PI * 2 * freq + ph)) * amp;
      }
      profile.push(TH - Phaser.Math.Clamp(elev, 0, TH * 0.85));
    }

    // Fill with deep cosmic indigo gradient
    const grad = ctx.createLinearGradient(0, 0, 0, TH);
    grad.addColorStop(0,    'rgba(12,4,40,0)');
    grad.addColorStop(0.20, 'rgba(16,6,50,0.70)');
    grad.addColorStop(1,    '#080422');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x < TW; x++) ctx.lineTo(x, profile[x]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    // Nebula cloud patches — soft elliptical glows
    for (let i = 0; i < 6; i++) {
      const cx = rng.between(100, TW - 100);
      const cy = profile[Math.min(cx, TW - 1)] + rng.between(-40, 60);
      const rw = rng.between(80, 200);
      const rh = rng.between(40, 100);
      const nebGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
      nebGrad.addColorStop(0, 'rgba(60,20,120,0.15)');
      nebGrad.addColorStop(0.5, 'rgba(40,10,80,0.08)');
      nebGrad.addColorStop(1, 'rgba(20,4,40,0)');
      ctx.fillStyle = nebGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scattered star dots
    for (let i = 0; i < 50; i++) {
      const sx = rng.between(0, TW);
      const sy = rng.between(0, TH);
      const ss = rng.between(1, 3);
      ctx.fillStyle = `rgba(200,180,255,${rng.realInRange(0.08, 0.25)})`;
      ctx.fillRect(sx, sy, ss, ss);
    }

    return cv;
  }

  /** Mid layer: floating reality shards — angular crystal fragments in dark silhouette with faint cyan edges. */
  private buildS4MidLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 280;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s4-mid']);

    const profile = new Float32Array(TW).fill(TH);

    // Angular crystal fragment structures
    let bx = 0;
    while (bx < TW) {
      const bw = rng.between(40, 100);
      const bh = rng.between(50, 160);
      const by = TH - bh;
      for (let i = bx; i < Math.min(bx + bw, TW); i++) profile[i] = by;

      // Angular spike on top — reality shard
      if (rng.frac() < 0.55 && bw > 50) {
        const mid = bx + bw / 2;
        const sh = rng.between(30, 90);
        for (let i = bx; i < Math.min(bx + bw, TW); i++) {
          const t = Math.abs(i - mid) / (bw * 0.4);
          profile[i] = Math.min(profile[i], by - sh * Math.max(0, 1 - t * 1.5));
        }
      }

      bx += bw + rng.between(30, 100);
    }

    // Clear edges for seamless tile
    for (let i = 0; i < 20; i++) profile[i] = TH;
    for (let i = TW - 20; i < TW; i++) profile[i] = TH;

    // Fill with dark cosmic colour
    const sGrad = ctx.createLinearGradient(0, 0, 0, TH);
    sGrad.addColorStop(0, 'rgba(10,4,30,0)');
    sGrad.addColorStop(0.4, 'rgba(10,4,30,0.7)');
    sGrad.addColorStop(1, '#080422');
    ctx.fillStyle = sGrad;
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x < TW; x++) ctx.lineTo(x, profile[x]);
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    // Faint cyan edge highlights on shard tops
    ctx.strokeStyle = 'rgba(0,200,220,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < TW; x++) {
      if (profile[x] < profile[x - 1] - 1) {
        ctx.moveTo(x, profile[x]);
        ctx.lineTo(x + 1, profile[x]);
      }
    }
    ctx.stroke();

    // Floating crystal fragment outlines
    let fx = rng.between(150, 400);
    while (fx < TW - 80) {
      const fy = rng.between(30, TH - 100);
      const fs = rng.between(8, 24);
      const angle = rng.frac() * Math.PI;

      ctx.strokeStyle = 'rgba(0,180,200,0.15)';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(angle);
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -fs);
      ctx.lineTo(fs * 0.6, 0);
      ctx.lineTo(0, fs);
      ctx.lineTo(-fs * 0.6, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      fx += rng.between(250, 550);
    }

    return cv;
  }

  /** Near layer: energy streams — thin vertical glowing lines in cyan/gold + scattered bright star particles. */
  private buildS4NearLayer(): HTMLCanvasElement {
    const TW = 2048, TH = 210;
    const cv = document.createElement('canvas');
    cv.width = TW; cv.height = TH;
    const ctx = cv.getContext('2d')!;
    const rng = new Phaser.Math.RandomDataGenerator(['s4-near']);

    // Ground strip
    ctx.fillStyle = '#080422';
    ctx.fillRect(0, TH - 44, TW, 44);

    // Thin vertical energy stream lines
    let lx = rng.between(60, 200);
    while (lx < TW - 40) {
      const lh = rng.between(60, 160);
      const ly = TH - 44 - lh;
      const isCyan = rng.frac() < 0.6;
      const color = isCyan ? 'rgba(0,200,220,0.12)' : 'rgba(255,200,0,0.10)';

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, TH - 44);
      ctx.lineTo(lx, ly);
      ctx.stroke();

      // Small bright node at top
      ctx.fillStyle = isCyan ? 'rgba(0,220,240,0.20)' : 'rgba(255,220,50,0.18)';
      ctx.fillRect(lx - 2, ly - 2, 4, 4);

      lx += rng.between(140, 380);
    }

    // Scattered bright star particles
    for (let i = 0; i < 30; i++) {
      const sx = rng.between(0, TW);
      const sy = rng.between(10, TH - 50);
      const ss = rng.between(1, 3);
      const isBright = rng.frac() < 0.3;
      ctx.fillStyle = isBright
        ? `rgba(255,255,200,${rng.realInRange(0.15, 0.35)})`
        : `rgba(150,200,255,${rng.realInRange(0.08, 0.20)})`;
      ctx.fillRect(sx, sy, ss, ss);
    }

    // Faint horizontal energy wisps along the ground
    for (let c = 0; c < 4; c++) {
      const wy = TH - 44 + rng.between(4, 36);
      ctx.strokeStyle = 'rgba(0,180,200,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.lineTo(TW, wy);
      ctx.stroke();
    }

    return cv;
  }
}
