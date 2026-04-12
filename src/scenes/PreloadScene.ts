import Phaser from 'phaser';
import { W, H } from '../constants';

export class PreloadScene extends Phaser.Scene {
  constructor() { super({ key: 'PreloadScene' }); }

  preload(): void {
    this.load.image('player-body',      'assets/sprites/player_body.png');
    this.load.image('player-hair',      'assets/sprites/player_hair.png');
    this.load.image('player-skirt',     'assets/sprites/player_skirt.png');
    this.load.image('player-ribbon',    'assets/sprites/player_ribbon.png');
    // Enemy sprites: body + animated element per type
    this.load.image('enemy-fairy-body',    'assets/sprites/enemy_fairy_body.png');
    this.load.image('enemy-fairy-wings',   'assets/sprites/enemy_fairy_wings.png');
    this.load.image('enemy-soul-body',     'assets/sprites/enemy_soul_body.png');
    this.load.image('enemy-soul-wisps',    'assets/sprites/enemy_soul_wisps.png');
    this.load.image('enemy-wisp-body',     'assets/sprites/enemy_wisp_body.png');
    this.load.image('enemy-wisp-tail',     'assets/sprites/enemy_wisp_tail.png');
    this.load.image('enemy-phantom-body',  'assets/sprites/enemy_phantom_body.png');
    this.load.image('enemy-phantom-cape',  'assets/sprites/enemy_phantom_cape.png');
    this.load.image('enemy-knight-body',   'assets/sprites/enemy_knight_body.png');
    this.load.image('enemy-knight-cape',   'assets/sprites/enemy_knight_cape.png');
    this.load.image('enemy-bat-body',      'assets/sprites/enemy_bat_body.png');
    this.load.image('enemy-bat-wings',     'assets/sprites/enemy_bat_wings.png');
    // Boss/miniboss: independently generated layers (manual offsets in Container)
    this.load.image('boss-body',           'assets/sprites/boss_body_v3.png');
    this.load.image('boss-wings',          'assets/sprites/boss_wings_v3.png');
    this.load.image('miniboss-body',       'assets/sprites/miniboss_body_v3.png');
    this.load.image('miniboss-hair',       'assets/sprites/miniboss_hair_v3.png');
    this.load.image('miniboss-gohei',      'assets/sprites/miniboss_gohei_v2.png');
    // pickup-power and pickup-bomb are generated procedurally; no file load needed
    this.load.image('bg-sky',           'assets/backgrounds/bg-sky.png');
    // Dialogue portraits
    this.load.image('portrait-player',  'assets/portraits/player_portrait.png');
    this.load.image('portrait-boss',    'assets/portraits/boss_portrait.png');

    // ── Stage 2 assets ──────────────────────────────────────────────────────
    // Stage 2 background
    this.load.image('bg-sky-s2',        'assets/backgrounds/bg-sky-s2.png');
    // Stage 2 drone enemy (co-aligned pair)
    this.load.image('enemy-drone-body',  'assets/sprites/enemy_drone_body.png');
    this.load.image('enemy-drone-rotor', 'assets/sprites/enemy_drone_rotor.png');
    // Stage 2 miniboss (3 layers)
    this.load.image('miniboss2-body',    'assets/sprites/miniboss2_body.png');
    this.load.image('miniboss2-shield',  'assets/sprites/miniboss2_shield.png');
    this.load.image('miniboss2-lance',   'assets/sprites/miniboss2_lance.png');
    // Stage 2 boss (2 layers)
    this.load.image('boss2-body',        'assets/sprites/boss2_body.png');
    this.load.image('boss2-gears',       'assets/sprites/boss2_gears.png');
    // Stage 2 portraits
    this.load.image('portrait-miniboss2', 'assets/portraits/miniboss2_portrait.png');
    this.load.image('portrait-boss2',     'assets/portraits/boss2_portrait.png');

    // ── Stage 3 assets ──────────────────────────────────────────────────────
    this.load.image('bg-sky-s3',          'assets/backgrounds/bg-sky-s3.png');
    this.load.image('enemy-gunner-body',  'assets/sprites/enemy_gunner_body.png');
    this.load.image('enemy-gunner-wings', 'assets/sprites/enemy_gunner_wings.png');
    this.load.image('enemy-bloom-body',   'assets/sprites/enemy_bloom_body.png');
    this.load.image('enemy-bloom-petals', 'assets/sprites/enemy_bloom_petals.png');
    this.load.image('enemy-prism-body',   'assets/sprites/enemy_prism_body.png');
    this.load.image('enemy-prism-crystal','assets/sprites/enemy_prism_crystal.png');
    this.load.image('miniboss3-body',     'assets/sprites/miniboss3_body.png');
    this.load.image('miniboss3-thorns',   'assets/sprites/miniboss3_thorns.png');
    this.load.image('boss3-body',         'assets/sprites/boss3_body.png');
    this.load.image('boss3-wings',        'assets/sprites/boss3_wings.png');
    this.load.image('portrait-miniboss3', 'assets/portraits/miniboss3_portrait.png');
    this.load.image('portrait-boss3',     'assets/portraits/boss3_portrait.png');

    // ── Stage 4 assets ──────────────────────────────────────────────────────
    this.load.image('bg-sky-s4',          'assets/backgrounds/bg-sky-s4.png');
    this.load.image('enemy-seraph-body',  'assets/sprites/enemy_seraph_body.png');
    this.load.image('enemy-seraph-wings', 'assets/sprites/enemy_seraph_wings.png');
    this.load.image('enemy-shade-body',   'assets/sprites/enemy_shade_body.png');
    this.load.image('enemy-shade-aura',   'assets/sprites/enemy_shade_aura.png');
    this.load.image('enemy-comet-body',   'assets/sprites/enemy_comet_body.png');
    this.load.image('enemy-comet-tail',   'assets/sprites/enemy_comet_tail.png');
    this.load.image('miniboss4-body',     'assets/sprites/miniboss4_body.png');
    this.load.image('miniboss4-orbs',     'assets/sprites/miniboss4_orbs.png');
    this.load.image('boss4-body',         'assets/sprites/boss4_body.png');
    this.load.image('boss4-wings',        'assets/sprites/boss4_wings.png');
    this.load.image('portrait-miniboss4', 'assets/portraits/miniboss4_portrait.png');
    this.load.image('portrait-boss4',     'assets/portraits/boss4_portrait.png');

    // ── Harbinger (apparition interlude character) ────────────────────────
    // These may not exist yet — procedural fallbacks are generated in create()
    this.load.on('loaderror', (file: { key: string }) => {
      if (file.key.startsWith('harbinger')) {
        // Silently ignore — procedural fallbacks will be used
      }
    });
    this.load.image('harbinger-body',     'assets/sprites/harbinger_body.png');
    this.load.image('harbinger-cloak',    'assets/sprites/harbinger_cloak.png');
    this.load.image('portrait-harbinger', 'assets/portraits/harbinger_portrait.png');

    // ── Background music ────────────────────────────────────────────────────
    this.load.audio('bgm-title',  'assets/music/title-bgm.wav');
    this.load.audio('bgm-stage1', 'assets/music/stage1-bgm.wav');
    this.load.audio('bgm-stage2', 'assets/music/stage2-bgm.wav');
    this.load.audio('bgm-stage3', 'assets/music/stage3-bgm.wav');
    this.load.audio('bgm-stage4', 'assets/music/stage4-bgm.wav');
    this.load.audio('bgm-boss',   'assets/music/boss-bgm.wav');

    // Loading bar
    const bw = 800; const bh = 32;
    const bx = W / 2 - bw / 2; const by = H / 2 + 60;
    this.add.rectangle(W / 2, by + bh / 2, bw + 8, bh + 8, 0x223344);
    const bar = this.add.rectangle(bx, by + bh / 2, 0, bh, 0x44eeff).setOrigin(0, 0.5);
    this.add.text(W / 2, H / 2 - 40, 'AETHER RIFT', {
      fontFamily: '"Courier New", monospace', fontSize: '64px', color: '#e8f4ff',
      stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => bar.setSize(bw * v, bh));
  }

  create(): void {
    // Process character sprites — shared-crop chromaKey for co-aligned layers
    // Player: 4-piece rig
    this.processCoAlignedParts(['player-hair', 'player-body', 'player-skirt']);
    this.chromaKey('player-ribbon');  // standalone generation
    // Enemies: 2-piece rigs (body + animated element from same reference)
    this.processCoAlignedParts(['enemy-fairy-body',   'enemy-fairy-wings']);
    this.processCoAlignedParts(['enemy-soul-body',    'enemy-soul-wisps']);
    this.processCoAlignedParts(['enemy-wisp-body',    'enemy-wisp-tail']);
    this.processCoAlignedParts(['enemy-phantom-body', 'enemy-phantom-cape']);
    this.processCoAlignedParts(['enemy-knight-body',  'enemy-knight-cape']);
    this.processCoAlignedParts(['enemy-bat-body',     'enemy-bat-wings']);
    // Boss/miniboss: independently generated layers (chromaKey each separately)
    this.chromaKey('boss-body');
    this.chromaKey('boss-wings');
    this.chromaKey('miniboss-body');
    this.chromaKey('miniboss-hair');
    this.chromaKey('miniboss-gohei');
    // Portraits: background-remove for clean VN presentation
    this.processSprite('portrait-player', { skipPass2: true });
    this.processSprite('portrait-boss',   { skipPass2: true });
    // Pickups: skip Gemini images, use clean procedural versions generated below

    // ── Stage 2 assets ──────────────────────────────────────────────────────
    // Drone enemy pair
    this.processCoAlignedParts(['enemy-drone-body', 'enemy-drone-rotor']);
    // Miniboss2 layers — co-aligned so layers share the same crop frame
    this.processCoAlignedParts(['miniboss2-body', 'miniboss2-shield', 'miniboss2-lance']);
    // Boss2 layers — co-aligned so body + gears stay aligned
    this.processCoAlignedParts(['boss2-body', 'boss2-gears']);
    // Stage 2 portraits
    this.processSprite('portrait-miniboss2', { skipPass2: true });
    this.processSprite('portrait-boss2',     { skipPass2: true });

    // ── Stage 3 assets ──
    this.processCoAlignedParts(['enemy-gunner-body', 'enemy-gunner-wings']);
    this.processCoAlignedParts(['enemy-bloom-body', 'enemy-bloom-petals']);
    this.processCoAlignedParts(['enemy-prism-body', 'enemy-prism-crystal']);
    // Miniboss3 layers — co-aligned
    this.processCoAlignedParts(['miniboss3-body', 'miniboss3-thorns']);
    // Boss3 layers — co-aligned
    this.processCoAlignedParts(['boss3-body', 'boss3-wings']);
    this.processSprite('portrait-miniboss3', { skipPass2: true });
    this.processSprite('portrait-boss3', { skipPass2: true });

    // ── Stage 4 assets ──
    this.processCoAlignedParts(['enemy-seraph-body', 'enemy-seraph-wings']);
    this.processCoAlignedParts(['enemy-shade-body', 'enemy-shade-aura']);
    this.processCoAlignedParts(['enemy-comet-body', 'enemy-comet-tail']);
    this.processCoAlignedParts(['miniboss4-body', 'miniboss4-orbs']);
    this.processCoAlignedParts(['boss4-body', 'boss4-wings']);
    this.processSprite('portrait-miniboss4', { skipPass2: true });
    this.processSprite('portrait-boss4', { skipPass2: true });

    // ── Harbinger (apparition character) ──
    {
      const hasBody  = this.textures.exists('harbinger-body');
      const hasCloak = this.textures.exists('harbinger-cloak');
      if (hasBody && hasCloak) {
        this.processCoAlignedParts(['harbinger-body', 'harbinger-cloak']);
      } else {
        // Process body if it loaded, generate procedural cloak
        if (hasBody) this.chromaKey('harbinger-body');
        else this.textures.addCanvas('harbinger-body', this.buildHarbingerBody());
        if (!hasCloak) this.textures.addCanvas('harbinger-cloak', this.buildHarbingerCloak());
      }
      if (this.textures.exists('portrait-harbinger')) {
        this.processSprite('portrait-harbinger', { skipPass2: true });
      }
    }

    // Resize bg-sky to a power-of-two canvas for scrolling
    this.resizeBgSky('bg-sky');
    // Stage 2 background
    this.resizeBgSky('bg-sky-s2');
    // Stage 3 background
    this.resizeBgSky('bg-sky-s3');
    // Stage 4 background
    this.resizeBgSky('bg-sky-s4');

    // Procedural textures
    this.generateTextures();

    // Soul texture (cyan orb)
    this.textures.addCanvas('enemy-soul', this.buildSoulCanvas());
    // Wisp texture (golden spirit orb — smaller, warmer tone than soul)
    this.textures.addCanvas('enemy-wisp', this.buildWispCanvas());

    this.scene.start('TitleScene');
  }

  // ─── Sprite background removal (two-pass: edge flood-fill + neutral cascade) ──

  private processSprite(key: string, opts: { skipPass2?: boolean; tolerance?: number } = {}): void {
    if (!this.textures.exists(key)) return;

    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const SZ  = 1024;

    // Square-crop from center
    const sw = src.naturalWidth  || src.width;
    const sh = src.naturalHeight || src.height;
    const sq = Math.min(sw, sh);
    const sx = Math.floor((sw - sq) / 2);
    const sy = Math.floor((sh - sq) / 2);

    const proc = document.createElement('canvas');
    proc.width  = SZ;
    proc.height = SZ;
    const pCtx  = proc.getContext('2d', { alpha: true })!;
    pCtx.drawImage(src, sx, sy, sq, sq, 0, 0, SZ, SZ);

    const id   = pCtx.getImageData(0, 0, SZ, SZ);
    const data = id.data;
    const removed = new Uint8Array(SZ * SZ);

    // Helper: 4-directional neighbours (returns valid indices only)
    const nbrs = (idx: number): number[] => {
      const px = idx % SZ; const py = Math.floor(idx / SZ);
      return [
        px > 0      ? idx - 1    : -1,
        px < SZ - 1 ? idx + 1    : -1,
        py > 0      ? idx - SZ   : -1,
        py < SZ - 1 ? idx + SZ   : -1,
      ].filter(n => n >= 0);
    };

    // Pre-mark already-transparent pixels (handles sprites with transparent PNGs)
    for (let i = 0; i < SZ * SZ; i++) {
      if (data[i * 4 + 3] < 16) removed[i] = 1;
    }

    // ── Determine reference background colour from corner samples ────────────
    const corners = [0, SZ - 1, (SZ - 1) * SZ, SZ * SZ - 1];
    let refR = 0, refG = 0, refB = 0, refCount = 0;
    for (const ci of corners) {
      if (data[ci * 4 + 3] > 16) {
        refR += data[ci * 4]; refG += data[ci * 4 + 1]; refB += data[ci * 4 + 2]; refCount++;
      }
    }
    if (refCount > 0) { refR /= refCount; refG /= refCount; refB /= refCount; }
    else { refR = refG = refB = 255; } // fallback: assume white

    const tol = opts.tolerance ?? 20;

    // ── Pass 1: Flood-fill from ALL edge pixels (GLOBAL colour tolerance) ───
    // Each candidate pixel is compared to the reference bg colour, NOT to its
    // immediate neighbour.  This prevents gradient-cascade through anti-aliased
    // edges that share intermediate values with the background.
    const q1: number[] = [];
    const mark = (i: number) => { if (!removed[i]) { removed[i] = 1; q1.push(i); } };
    for (let x = 0; x < SZ; x++) { mark(x); mark((SZ - 1) * SZ + x); }
    for (let y = 1; y < SZ - 1; y++) { mark(y * SZ); mark(y * SZ + SZ - 1); }
    let q1i = 0;
    while (q1i < q1.length) {
      const idx = q1[q1i++];
      for (const ni of nbrs(idx)) {
        if (removed[ni]) continue;
        const npi = ni * 4;
        const dr = data[npi] - refR, dg = data[npi + 1] - refG, db = data[npi + 2] - refB;
        if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) { mark(ni); }
      }
    }

    // ── Pass 2: Cascade through neutral-bg pixels adjacent to removed area ──
    if (opts.skipPass2) {
      // Apply transparency from Pass 1 only, then return
      for (let i = 0; i < SZ * SZ; i++) {
        if (removed[i]) data[i * 4 + 3] = 0;
      }
      pCtx.putImageData(id, 0, 0);
      const OUT = 1024;
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      const outCtx = out.getContext('2d', { alpha: true })!;
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(proc, 0, 0, OUT, OUT);
      this.textures.remove(key);
      this.textures.addCanvas(key, out);
      return;
    }
    // Auto-detect background type from corner samples
    const tlPi = 0, trPi = (SZ - 1) * 4;
    const blPi = (SZ - 1) * SZ * 4, brPi = (SZ * SZ - 1) * 4;
    const avgLum = ([tlPi, trPi, blPi, brPi].reduce((s, pi) => s + (data[pi] + data[pi+1] + data[pi+2]) / 3, 0)) / 4;
    const bgIsLight = avgLum > 130;

    const isNeutralBg = (pi: number) => {
      const r = data[pi], g = data[pi + 1], b = data[pi + 2];
      const lum = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      // Perfectly or near-perfectly neutral pixels (sat < 12) are almost certainly
      // background — catches both solid gray/white and baked-in checkerboard patterns.
      // lum > 80 guard keeps dark outlines intact. Checkerboard squares are always
      // lum ≥ 140 so they are still caught; medium-dark outlines (lum 55–79) are protected.
      if (sat < 12 && lum > 80) return true;
      // Luminance-based fallback for clearly light or clearly dark solid backgrounds
      return bgIsLight ? (lum > 155 && sat < 22) : (lum < 80 && sat < 22);
    };

    const q2: number[] = [];
    for (let i = 0; i < SZ * SZ; i++) {
      if (!removed[i]) continue;
      for (const ni of nbrs(i)) {
        if (!removed[ni] && isNeutralBg(ni * 4)) { removed[ni] = 1; q2.push(ni); }
      }
    }
    let q2i = 0;
    while (q2i < q2.length) {
      const idx = q2[q2i++];
      for (const ni of nbrs(idx)) {
        if (!removed[ni] && isNeutralBg(ni * 4)) { removed[ni] = 1; q2.push(ni); }
      }
    }

    // Apply transparency
    for (let i = 0; i < SZ * SZ; i++) {
      if (removed[i]) data[i * 4 + 3] = 0;
    }
    pCtx.putImageData(id, 0, 0);

    // Scale to 1024 for final texture
    const OUT2   = 1024;
    const out    = document.createElement('canvas');
    out.width    = out.height = OUT2;
    const outCtx = out.getContext('2d', { alpha: true })!;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(proc, 0, 0, OUT2, OUT2);

    this.textures.remove(key);
    this.textures.addCanvas(key, out);
  }

  // ─── Shared-crop chroma-key for co-aligned layers ─────────────────────────
  // All parts derived from the same reference image → identical pixel positions.
  // We chroma-key each, compute the UNION bounding box, and crop them all to
  // the same region so they stack perfectly at (0,0) in a Container.

  private processCoAlignedParts(coAligned: string[]): void {
    const SZ  = 2048;   // work at 2048 for maximum chroma-key fidelity
    const OUT = 2048;   // output resolution — crisp at any display scale
    const PADDING = 24;

    // Step 1: Chroma-key each part into a temporary canvas
    const canvases = new Map<string, HTMLCanvasElement>();

    for (const key of coAligned) {
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const sw = src.naturalWidth  || src.width;
      const sh = src.naturalHeight || src.height;
      const fitScale = Math.min(SZ / sw, SZ / sh);
      const dw = Math.round(sw * fitScale);
      const dh = Math.round(sh * fitScale);
      const dx = Math.floor((SZ - dw) / 2);
      const dy = Math.floor((SZ - dh) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SZ;
      const ctx = canvas.getContext('2d', { alpha: true })!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh);

      const id   = ctx.getImageData(0, 0, SZ, SZ);
      const data = id.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const greenDom = g - Math.max(r, b);
        if (greenDom > 80 && g > 150) {
          data[i + 3] = 0;
        } else if (greenDom > 40 && g > 120) {
          const t = (greenDom - 40) / 40;
          data[i + 3] = Math.round(255 * (1 - t));
          data[i + 1] = Math.max(0, Math.round(g - greenDom * 0.5));
        }
      }
      ctx.putImageData(id, 0, 0);
      canvases.set(key, canvas);
    }

    // Step 2: Union bounding box across ALL co-aligned parts
    let uMinX = SZ, uMinY = SZ, uMaxX = 0, uMaxY = 0;

    for (const [, canvas] of canvases) {
      const ctx  = canvas.getContext('2d')!;
      const id   = ctx.getImageData(0, 0, SZ, SZ);
      const data = id.data;
      for (let py = 0; py < SZ; py++) {
        for (let px = 0; px < SZ; px++) {
          if (data[(py * SZ + px) * 4 + 3] > 2) {
            if (px < uMinX) uMinX = px;
            if (px > uMaxX) uMaxX = px;
            if (py < uMinY) uMinY = py;
            if (py > uMaxY) uMaxY = py;
          }
        }
      }
    }

    uMinX = Math.max(0, uMinX - PADDING);
    uMinY = Math.max(0, uMinY - PADDING);
    uMaxX = Math.min(SZ - 1, uMaxX + PADDING);
    uMaxY = Math.min(SZ - 1, uMaxY + PADDING);

    const cropW  = uMaxX - uMinX + 1;
    const cropH  = uMaxY - uMinY + 1;
    const cropSq = Math.max(cropW, cropH);
    const cropCX = uMinX + cropW / 2;
    const cropCY = uMinY + cropH / 2;
    const cropSX = Math.max(0, Math.floor(cropCX - cropSq / 2));
    const cropSY = Math.max(0, Math.floor(cropCY - cropSq / 2));

    // Step 3: Apply shared crop to each part → all end up on OUT×OUT with same frame
    for (const [key, canvas] of canvases) {
      const out = document.createElement('canvas');
      out.width = out.height = OUT;
      const outCtx = out.getContext('2d', { alpha: true })!;
      outCtx.imageSmoothingEnabled  = true;
      outCtx.imageSmoothingQuality  = 'high';
      outCtx.drawImage(canvas, cropSX, cropSY, cropSq, cropSq, 0, 0, OUT, OUT);

      this.textures.remove(key);
      this.textures.addCanvas(key, out);
    }
  }

  // ─── Green-screen chroma-key removal (simpler, no flood-fill) ──────────────

  private chromaKey(key: string, padding = 16): void {
    if (!this.textures.exists(key)) return;

    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const SZ  = 2048;   // work at 2048 for crisp chroma-key

    // Aspect-ratio-preserving fit — preserves ALL source content
    const sw = src.naturalWidth  || src.width;
    const sh = src.naturalHeight || src.height;
    const fitScale = Math.min(SZ / sw, SZ / sh);
    const dw = Math.round(sw * fitScale);
    const dh = Math.round(sh * fitScale);
    const dx = Math.floor((SZ - dw) / 2);
    const dy = Math.floor((SZ - dh) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SZ;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh);

    const id   = ctx.getImageData(0, 0, SZ, SZ);
    const data = id.data;

    // Conservative chroma-key: only remove pixels where green strongly
    // dominates red and blue. This avoids eating into character art
    // that has green reflections from the green-screen background.
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // Green must be the dominant channel by a wide margin
      const greenDom = g - Math.max(r, b);

      if (greenDom > 80 && g > 150) {
        // Clearly green background — fully transparent
        data[i + 3] = 0;
      } else if (greenDom > 40 && g > 120) {
        // Anti-aliased edge zone — soften alpha based on how green it is
        const t = (greenDom - 40) / 40;  // 0→1
        data[i + 3] = Math.round(255 * (1 - t));
        // De-spill: reduce green cast
        data[i + 1] = Math.max(0, Math.round(g - greenDom * 0.5));
      }
    }

    ctx.putImageData(id, 0, 0);

    // ── Tight-crop: find bounding box of visible pixels, then re-center ────
    // This ensures the character fills the canvas tightly so downscaling
    // doesn't blur it across a sea of empty transparent space.
    const cropId = ctx.getImageData(0, 0, SZ, SZ);
    const cd = cropId.data;
    let minX = SZ, minY = SZ, maxX = 0, maxY = 0;
    for (let py = 0; py < SZ; py++) {
      for (let px = 0; px < SZ; px++) {
        if (cd[(py * SZ + px) * 4 + 3] > 2) {  // low threshold preserves faint wisps
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
    }

    // Generous padding to preserve wispy edges (hair tips, ribbon tails)
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(SZ - 1, maxX + padding);
    maxY = Math.min(SZ - 1, maxY + padding);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const cropSq = Math.max(cropW, cropH);  // keep square

    // Centre the crop region within the square
    const cropCX = minX + cropW / 2;
    const cropCY = minY + cropH / 2;
    const cropSX = Math.max(0, Math.floor(cropCX - cropSq / 2));
    const cropSY = Math.max(0, Math.floor(cropCY - cropSq / 2));

    // Draw cropped character into a fresh 2048×2048 canvas, filling it tightly
    const OUT = 2048;
    const out = document.createElement('canvas');
    out.width = out.height = OUT;
    const outCtx = out.getContext('2d', { alpha: true })!;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(canvas, cropSX, cropSY, cropSq, cropSq, 0, 0, OUT, OUT);

    this.textures.remove(key);
    this.textures.addCanvas(key, out);
  }

  // ─── Background resize ────────────────────────────────────────────────────

  private resizeBgSky(key: string): void {
    if (!this.textures.exists(key)) {
      if (key === 'bg-sky') this.buildBgFallback();
      return;
    }

    const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
    // Make a 2048×1024 power-of-two version (good for TileSprite in WebGL)
    const canvas  = document.createElement('canvas');
    canvas.width  = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(src, 0, 0, 2048, 1024);
    this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  private buildBgFallback(): void {
    const canvas  = document.createElement('canvas');
    canvas.width  = 2048;
    canvas.height = 1024;
    const ctx     = canvas.getContext('2d')!;
    const grad    = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0,   '#060118');
    grad.addColorStop(0.4, '#1a0830');
    grad.addColorStop(0.7, '#2a0a28');
    grad.addColorStop(1,   '#3a1020');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 1024);
    // Horizon glow
    const hor = ctx.createLinearGradient(0, 760, 0, 1024);
    hor.addColorStop(0, 'rgba(80,20,60,0)');
    hor.addColorStop(1, 'rgba(140,40,80,0.6)');
    ctx.fillStyle = hor;
    ctx.fillRect(0, 760, 2048, 264);
    this.textures.addCanvas('bg-sky', canvas);
  }

  // ─── Procedural textures ──────────────────────────────────────────────────

  private generateTextures(): void {
    const g = this.add.graphics();

    // ── Enemy bullet — round small (32×32) ──────────────────────────────────
    // Neutral white/gray layers — designed to be tinted to any color via setTint()
    g.clear();
    g.fillStyle(0xffffff, 0.15); g.fillCircle(16, 16, 15);   // soft outer glow
    g.fillStyle(0xffffff, 0.25); g.fillCircle(16, 16, 13);   // glow ring buildup
    g.lineStyle(2, 0xffffff, 0.5); g.strokeCircle(16, 16, 13); // crisp outer ring
    g.fillStyle(0xcccccc, 1);    g.fillCircle(16, 16, 10);   // main body
    g.fillStyle(0xdddddd, 1);    g.fillCircle(16, 16, 7);    // inner lighter band
    g.fillStyle(0xeeeeee, 1);    g.fillCircle(16, 16, 4);    // bright inner
    g.fillStyle(0xffffff, 1);    g.fillCircle(16, 16, 2);    // hot center
    g.generateTexture('bul-round-sm', 32, 32);

    // ── Enemy bullet — round medium (44×44) ─────────────────────────────────
    // Neutral white/gray layers — designed to be tinted to any color via setTint()
    g.clear();
    g.fillStyle(0xffffff, 0.1);  g.fillCircle(22, 22, 21);   // faint outer halo
    g.fillStyle(0xffffff, 0.18); g.fillCircle(22, 22, 19);   // halo buildup
    g.fillStyle(0xffffff, 0.28); g.fillCircle(22, 22, 17);   // halo inner
    g.lineStyle(2, 0xffffff, 0.6); g.strokeCircle(22, 22, 18); // halo ring edge
    g.fillStyle(0xcccccc, 1);    g.fillCircle(22, 22, 14);   // main body
    g.fillStyle(0xdddddd, 1);    g.fillCircle(22, 22, 11);   // mid ring
    g.fillStyle(0xeeeeee, 1);    g.fillCircle(22, 22, 8);    // lighter ring
    g.fillStyle(0xf8f8f8, 1);    g.fillCircle(22, 22, 5);    // inner bright
    g.fillStyle(0xffffff, 1);    g.fillCircle(22, 22, 2.5);  // hot center
    g.generateTexture('bul-round-md', 44, 44);

    // ── Enemy bullet — round large (56×56) ──────────────────────────────────
    // Neutral white/gray layers — designed to be tinted to any color via setTint()
    g.clear();
    g.fillStyle(0xffffff, 0.08); g.fillCircle(28, 28, 27);   // outermost glow
    g.fillStyle(0xffffff, 0.14); g.fillCircle(28, 28, 25);   // glow layer 2
    g.fillStyle(0xffffff, 0.22); g.fillCircle(28, 28, 23);   // glow layer 3
    g.lineStyle(2, 0xffffff, 0.5); g.strokeCircle(28, 28, 24); // outer ring accent
    g.fillStyle(0xaaaaaa, 1);    g.fillCircle(28, 28, 21);   // dark outer body
    g.fillStyle(0xbbbbbb, 1);    g.fillCircle(28, 28, 18);   // mid-dark ring
    g.lineStyle(1, 0xdddddd, 0.4); g.strokeCircle(28, 28, 16); // subtle inner ring line
    g.fillStyle(0xcccccc, 1);    g.fillCircle(28, 28, 15);   // main body
    g.fillStyle(0xdddddd, 1);    g.fillCircle(28, 28, 12);   // lighter mid ring
    g.fillStyle(0xeeeeee, 1);    g.fillCircle(28, 28, 9);    // inner ring 1
    g.fillStyle(0xf4f4f4, 1);    g.fillCircle(28, 28, 6);    // inner ring 2
    g.fillStyle(0xfafafa, 1);    g.fillCircle(28, 28, 3.5);  // bright core
    g.fillStyle(0xffffff, 1);    g.fillCircle(28, 28, 1.5);  // hot center
    g.generateTexture('bul-round-lg', 56, 56);

    // ── Player bullet — energy bolt (112×28) ────────────────────────────────
    // Bright white leading edge tapering to colored tail with gradient layers
    g.clear();
    // Outermost faint glow — full width, warm yellow
    g.fillStyle(0xffff44, 0.12); g.fillEllipse(56, 14, 110, 26);
    // Wide soft halo — slightly narrower
    g.fillStyle(0xffff66, 0.2);  g.fillEllipse(58, 14, 100, 22);
    // Colored tail body — offset toward back, golden
    g.fillStyle(0xffcc44, 0.7);  g.fillEllipse(48, 14, 88, 16);
    // Brighter mid-body — shifts forward
    g.fillStyle(0xffdd66, 1);    g.fillEllipse(54, 14, 74, 13);
    // Warm-to-white transition layer
    g.fillStyle(0xffee88, 1);    g.fillEllipse(60, 14, 60, 10);
    // Near-white leading section
    g.fillStyle(0xffffcc, 1);    g.fillEllipse(68, 14, 44, 8);
    // Hot white leading edge — sharp point
    g.fillStyle(0xffffff, 1);    g.fillEllipse(78, 14, 28, 5);
    // Bright tip dot
    g.fillStyle(0xffffff, 1);    g.fillCircle(92, 14, 3);
    g.generateTexture('bul-player', 112, 28);

    // ── Player bullet — focused laser lance (40×80) ─────────────────────────
    // Hot white core with layered cyan glow
    g.clear();
    // Wide faint aura
    g.fillStyle(0x44ddff, 0.1);  g.fillEllipse(20, 40, 38, 78);
    // Soft outer glow
    g.fillStyle(0x66eeff, 0.18); g.fillEllipse(20, 40, 32, 74);
    // Outer cyan body
    g.fillStyle(0x44ccff, 0.4);  g.fillEllipse(20, 40, 26, 68);
    // Mid cyan layer
    g.fillStyle(0x88ddff, 0.7);  g.fillEllipse(20, 40, 20, 60);
    // Bright inner cyan
    g.fillStyle(0xaaeeff, 1);    g.fillEllipse(20, 40, 14, 50);
    // Near-white transition
    g.fillStyle(0xddf8ff, 1);    g.fillEllipse(20, 40, 9, 40);
    // Hot white core
    g.fillStyle(0xffffff, 1);    g.fillEllipse(20, 40, 5, 30);
    // Intense tip at top
    g.fillStyle(0xffffff, 1);    g.fillEllipse(20, 12, 3, 10);
    g.generateTexture('bul-focus', 40, 80);

    // Pickup: power crystal (bright cyan diamond)
    // Remove any file-loaded texture so generateTexture can create a fresh one
    if (this.textures.exists('pickup-power')) this.textures.remove('pickup-power');
    g.clear();
    g.lineStyle(2, 0xffffff, 0.6);
    g.fillStyle(0x22eeff, 0.9);
    g.fillTriangle(24, 0, 44, 24, 24, 48);
    g.fillTriangle(24, 0, 4, 24, 24, 48);
    g.fillStyle(0xaaffff, 1);
    g.fillTriangle(24, 6, 40, 24, 24, 42);
    g.fillTriangle(24, 6, 8, 24, 24, 42);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(24, 10, 36, 24, 24, 10);
    g.generateTexture('pickup-power', 48, 48);

    // Pickup: bomb star (gold 5-point star)
    // Helper: build Phaser.Geom.Point[] from flat [x0,y0,x1,y1,...] array
    const flatToPoints = (flat: number[]): Phaser.Geom.Point[] => {
      const out: Phaser.Geom.Point[] = [];
      for (let i = 0; i < flat.length; i += 2) out.push(new Phaser.Geom.Point(flat[i], flat[i + 1]));
      return out;
    };
    // Build flat coordinate array for a star polygon (n outer/inner alternating vertices)
    const buildStar = (cx: number, cy: number, r1: number, r2: number, n: number): number[] => {
      const flat: number[] = [];
      for (let p = 0; p < n * 2; p++) {
        const a = (p / n) * Math.PI - Math.PI / 2;
        const r = p % 2 === 0 ? r1 : r2;
        flat.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      return flat;
    };
    if (this.textures.exists('pickup-bomb')) this.textures.remove('pickup-bomb');
    g.clear();
    g.fillStyle(0xffcc00, 1);
    g.fillPoints(flatToPoints(buildStar(24, 24, 22, 10, 5)), true);
    g.fillStyle(0xffffaa, 1);
    g.fillPoints(flatToPoints(buildStar(24, 24, 14, 6, 5)), true);
    g.generateTexture('pickup-bomb', 48, 48);

    // Fallback
    g.clear();
    g.fillStyle(0x44ffee, 1); g.fillCircle(24, 24, 20);
    g.fillStyle(0xffffff, 1); g.fillCircle(24, 24, 10);
    g.generateTexture('pickup-fallback', 48, 48);

    // ── Particle (16×16) — soft glow with fading edges ──────────────────────
    g.clear();
    g.fillStyle(0xffffff, 0.06); g.fillCircle(8, 8, 8);    // outermost faint haze
    g.fillStyle(0xffffff, 0.12); g.fillCircle(8, 8, 7);    // soft outer
    g.fillStyle(0xffffff, 0.22); g.fillCircle(8, 8, 6);    // mid-outer
    g.fillStyle(0xffffff, 0.35); g.fillCircle(8, 8, 5);    // mid
    g.fillStyle(0xffffff, 0.55); g.fillCircle(8, 8, 4);    // mid-inner
    g.fillStyle(0xffffff, 0.75); g.fillCircle(8, 8, 3);    // inner
    g.fillStyle(0xffffff, 0.9);  g.fillCircle(8, 8, 2);    // bright core
    g.fillStyle(0xffffff, 1);    g.fillCircle(8, 8, 1);    // hot center
    g.generateTexture('particle', 16, 16);

    // ── Bomb ring (256×256) — double ring with intense glow ─────────────────
    g.clear();
    // Soft wide outer glow
    g.lineStyle(16, 0xaaddff, 0.12); g.strokeCircle(128, 128, 122);
    g.lineStyle(12, 0xaaddff, 0.2);  g.strokeCircle(128, 128, 120);
    // Main outer ring — bright white
    g.lineStyle(6, 0xffffff, 1);     g.strokeCircle(128, 128, 116);
    // Outer ring accent
    g.lineStyle(2, 0xccddff, 0.6);  g.strokeCircle(128, 128, 112);
    // Inner ring — secondary glow
    g.lineStyle(10, 0x88bbff, 0.15); g.strokeCircle(128, 128, 92);
    g.lineStyle(4, 0xaaddff, 0.7);  g.strokeCircle(128, 128, 90);
    g.lineStyle(2, 0xffffff, 0.5);  g.strokeCircle(128, 128, 88);
    // Innermost accent ring
    g.lineStyle(2, 0xccddff, 0.3);  g.strokeCircle(128, 128, 70);
    g.generateTexture('bomb-ring', 256, 256);

    // ── Graze ring (32×32) — sparkle/starburst ──────────────────────────────
    g.clear();
    const cx = 16; const cy = 16;
    // Draw starburst spikes — 8 pointed star
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const len = (i % 2 === 0) ? 14 : 9;  // alternating long/short spikes
      const thick = (i % 2 === 0) ? 1.5 : 1;
      g.lineStyle(thick, 0xffffff, (i % 2 === 0) ? 0.9 : 0.5);
      g.lineBetween(cx + cos * 2, cy + sin * 2, cx + cos * len, cy + sin * len);
    }
    // Bright center glow
    g.fillStyle(0xffffff, 0.3); g.fillCircle(cx, cy, 5);
    g.fillStyle(0xffffff, 0.6); g.fillCircle(cx, cy, 3);
    g.fillStyle(0xffffff, 1);   g.fillCircle(cx, cy, 1.5);
    // Faint outer ring to tie it together
    g.lineStyle(1, 0xffffff, 0.2); g.strokeCircle(cx, cy, 12);
    g.generateTexture('graze-ring', 32, 32);

    g.destroy();
  }

  private buildWispCanvas(): HTMLCanvasElement {
    // 128×128 golden spirit orb with warm amber/gold glow (distinct from cyan soul)
    const SZ = 128; const C = SZ / 2; const R = C - 6;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SZ;
    const ctx = canvas.getContext('2d')!;
    // Outer warm glow
    const glow = ctx.createRadialGradient(C, C, R * 0.4, C, C, R);
    glow.addColorStop(0,   'rgba(255, 200, 40, 0.35)');
    glow.addColorStop(0.6, 'rgba(255, 140, 0,  0.18)');
    glow.addColorStop(1,   'rgba(255, 80,  0,  0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fill();
    // Core orb — white-hot center fading to gold
    const core = ctx.createRadialGradient(C, C, 0, C, C, R * 0.45);
    core.addColorStop(0,    '#ffffff');
    core.addColorStop(0.2,  '#fff5cc');
    core.addColorStop(0.55, '#ffaa00');
    core.addColorStop(1,    'rgba(255, 80, 0, 0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(C, C, R * 0.45, 0, Math.PI * 2); ctx.fill();
    // Bright inner ring highlight
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(C, C, R * 0.3, 0, Math.PI * 2); ctx.stroke();
    return canvas;
  }

  private buildSoulCanvas(): HTMLCanvasElement {
    // 256×256 so the radial gradient has plenty of room; Enemy scale is 0.75 → ~192 px
    const SZ = 256; const C = SZ / 2; const R = C - 8;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SZ;
    const ctx = canvas.getContext('2d')!;
    // Outer glow ring
    const glow = ctx.createRadialGradient(C, C, R * 0.55, C, C, R);
    glow.addColorStop(0, 'rgba(0,220,255,0.22)');
    glow.addColorStop(1, 'rgba(0,160,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fill();
    // Core orb
    const core = ctx.createRadialGradient(C, C, 0, C, C, R * 0.55);
    core.addColorStop(0,   '#ffffff');
    core.addColorStop(0.25, '#ccf8ff');
    core.addColorStop(0.6,  '#00c8ff');
    core.addColorStop(1,   'rgba(0,140,220,0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(C, C, R * 0.55, 0, Math.PI * 2); ctx.fill();
    return canvas;
  }

  // ─── Procedural Harbinger body (fallback if generated sprites unavailable) ──
  private buildHarbingerBody(): HTMLCanvasElement {
    const SZ = 512;
    const cv = document.createElement('canvas');
    cv.width = SZ; cv.height = SZ;
    const ctx = cv.getContext('2d')!;
    const C = SZ / 2;

    // Body silhouette — elegant robed figure
    ctx.fillStyle = '#1a0833';
    ctx.beginPath();
    // Head
    ctx.ellipse(C, C - 120, 40, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.beginPath();
    ctx.moveTo(C - 35, C - 80);
    ctx.lineTo(C + 35, C - 80);
    ctx.lineTo(C + 55, C + 40);
    ctx.lineTo(C - 55, C + 40);
    ctx.closePath();
    ctx.fill();

    // Flowing skirt/robe
    ctx.beginPath();
    ctx.moveTo(C - 55, C + 40);
    ctx.quadraticCurveTo(C - 85, C + 160, C - 60, C + 210);
    ctx.lineTo(C + 60, C + 210);
    ctx.quadraticCurveTo(C + 85, C + 160, C + 55, C + 40);
    ctx.closePath();
    ctx.fill();

    // Accent glow on edges
    const glow = ctx.createRadialGradient(C, C, 30, C, C, 180);
    glow.addColorStop(0, 'rgba(200,100,255,0.15)');
    glow.addColorStop(0.6, 'rgba(140,40,200,0.08)');
    glow.addColorStop(1, 'rgba(80,0,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SZ, SZ);

    // Crown/tiara highlight
    ctx.fillStyle = '#cc44ff';
    ctx.beginPath();
    ctx.moveTo(C - 15, C - 165);
    ctx.lineTo(C, C - 185);
    ctx.lineTo(C + 15, C - 165);
    ctx.closePath();
    ctx.fill();

    // Eye highlights
    ctx.fillStyle = '#ff88ff';
    ctx.fillRect(C - 18, C - 130, 6, 4);
    ctx.fillRect(C + 12, C - 130, 6, 4);

    // Luminous edge accents
    ctx.strokeStyle = 'rgba(200,100,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C - 35, C - 80);
    ctx.lineTo(C - 55, C + 40);
    ctx.lineTo(C - 60, C + 210);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(C + 35, C - 80);
    ctx.lineTo(C + 55, C + 40);
    ctx.lineTo(C + 60, C + 210);
    ctx.stroke();

    return cv;
  }

  // ─── Procedural Harbinger cloak/energy (fallback) ──
  private buildHarbingerCloak(): HTMLCanvasElement {
    const SZ = 512;
    const cv = document.createElement('canvas');
    cv.width = SZ; cv.height = SZ;
    const ctx = cv.getContext('2d')!;
    const C = SZ / 2;

    // Ethereal wing silhouettes
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#6622aa';

    // Left wing
    ctx.beginPath();
    ctx.moveTo(C - 30, C - 60);
    ctx.quadraticCurveTo(C - 180, C - 150, C - 160, C - 40);
    ctx.quadraticCurveTo(C - 140, C + 60, C - 30, C + 20);
    ctx.closePath();
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(C + 30, C - 60);
    ctx.quadraticCurveTo(C + 180, C - 150, C + 160, C - 40);
    ctx.quadraticCurveTo(C + 140, C + 60, C + 30, C + 20);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1.0;

    // Energy glow edges on wings
    ctx.strokeStyle = 'rgba(200,100,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(C - 30, C - 60);
    ctx.quadraticCurveTo(C - 180, C - 150, C - 160, C - 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(C + 30, C - 60);
    ctx.quadraticCurveTo(C + 180, C - 150, C + 160, C - 40);
    ctx.stroke();

    // Flowing energy tendrils below
    ctx.strokeStyle = 'rgba(140,60,200,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const sx = C + (i - 2) * 30;
      ctx.beginPath();
      ctx.moveTo(sx, C + 40);
      ctx.bezierCurveTo(sx - 20, C + 100, sx + 20, C + 160, sx, C + 220);
      ctx.stroke();
    }

    // Central energy glow
    const core = ctx.createRadialGradient(C, C - 20, 10, C, C - 20, 120);
    core.addColorStop(0, 'rgba(200,100,255,0.2)');
    core.addColorStop(0.5, 'rgba(140,40,200,0.08)');
    core.addColorStop(1, 'rgba(80,0,120,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, SZ, SZ);

    return cv;
  }
}
