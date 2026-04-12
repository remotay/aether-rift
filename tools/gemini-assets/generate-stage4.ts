#!/usr/bin/env npx tsx
/**
 * Generate all visual and audio assets for Stage 4: Celestial Rift.
 * Run: cd tools/gemini-assets && npx tsx generate-stage4.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GoogleGenAI, Modality } from '@google/genai';

const API_KEY = 'AIzaSyDt8H7415wUzSjhlmGynnSs68ZaTZmNAOM';
const ai = new GoogleGenAI({ apiKey: API_KEY });

const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const MUSIC_MODEL = 'lyria-3-pro-preview';

const ASSETS_ROOT = 'C:/modern-danmaku-shooter/public/assets';

// ─── Image asset definitions ─────────────────────────────────────────────────

interface ImageAsset {
  name: string;
  outPath: string;
  prompt: string;
}

const imageAssets: ImageAsset[] = [
  // Background
  {
    name: 'Stage 4 Background — Celestial Rift',
    outPath: `${ASSETS_ROOT}/backgrounds/bg-sky-s4.png`,
    prompt: `A wide panoramic background for a side-scrolling 2D game. Deep cosmic void with swirling nebulae in indigo, purple, and cyan. Distant stars and galaxies, floating reality shards and fragments catching light. Ethereal cosmic atmosphere, mysterious and vast. Color palette: deep indigo, cosmic cyan, stellar gold, void purple. Seamless horizontal tileable. NO text, NO characters, NO UI elements. High resolution, painterly anime style.`,
  },

  // Enemy: Seraph
  {
    name: 'Enemy Seraph — Body',
    outPath: `${ASSETS_ROOT}/sprites/enemy_seraph_body.png`,
    prompt: `Touhou-style chibi anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Large angelic fairy girl with golden-blonde hair in flowing waves. Wearing an ornate white and gold celestial dress with sun motifs. Confident, serene expression. Slightly bigger than typical fairy enemies. Clean linework, vibrant colors.`,
  },
  {
    name: 'Enemy Seraph — Wings',
    outPath: `${ASSETS_ROOT}/sprites/enemy_seraph_wings.png`,
    prompt: `Large radiant angel-style wings on a bright green screen background (#00FF00). Golden and white wings glowing with warm celestial light. Multiple layered feather wings. Wings should be positioned as if attached to a chibi fairy character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the wings. Clean linework.`,
  },

  // Enemy: Shade
  {
    name: 'Enemy Shade — Body',
    outPath: `${ASSETS_ROOT}/sprites/enemy_shade_body.png`,
    prompt: `Touhou-style chibi anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Small ethereal shadow fairy with deep purple and indigo hair. Wearing a dark flowing spectral dress with void patterns. Mysterious, half-hidden expression. Semi-translucent look. Clean linework, cool dark colors.`,
  },
  {
    name: 'Enemy Shade — Aura',
    outPath: `${ASSETS_ROOT}/sprites/enemy_shade_aura.png`,
    prompt: `Dark ethereal wisps and shadow energy on a bright green screen background (#00FF00). Purple and indigo spectral flames swirling around. Positioned as if surrounding a small chibi fairy character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the shadow aura wisps. Clean linework, glowing edges.`,
  },

  // Enemy: Comet
  {
    name: 'Enemy Comet — Body',
    outPath: `${ASSETS_ROOT}/sprites/enemy_comet_body.png`,
    prompt: `Touhou-style chibi anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Small fast-looking fairy with bright cyan and teal hair in a ponytail. Wearing a streamlined white and cyan flight suit dress. Energetic, excited expression. Small and agile-looking. Clean linework, vibrant cyan colors.`,
  },
  {
    name: 'Enemy Comet — Tail',
    outPath: `${ASSETS_ROOT}/sprites/enemy_comet_tail.png`,
    prompt: `Bright cyan energy trail and comet tail on a bright green screen background (#00FF00). Streaming particles and light ribbons trailing behind. Positioned as if trailing behind a small chibi fairy character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the energy trail. Clean linework, glowing edges.`,
  },

  // Miniboss
  {
    name: 'Miniboss 4 — Body (Void Herald)',
    outPath: `${ASSETS_ROOT}/sprites/miniboss4_body.png`,
    prompt: `Touhou-style anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Medium-sized cosmic fairy herald with silver and indigo hair, flowing elegantly. Wearing dark stellar armor with golden constellation patterns. Commanding expression, holds a cosmic scepter or staff. More detailed than regular enemies, taller proportions. Clean linework, vibrant colors.`,
  },
  {
    name: 'Miniboss 4 — Orbs',
    outPath: `${ASSETS_ROOT}/sprites/miniboss4_orbs.png`,
    prompt: `Floating cosmic orbs and spheres on a bright green screen background (#00FF00). Multiple glowing orbs in gold and cyan orbiting around. Positioned as if surrounding a medium-sized character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the orbiting cosmic orbs. Clean linework, glowing edges.`,
  },

  // Boss
  {
    name: 'Boss 4 — Body (Solaris, the Eternal Flame)',
    outPath: `${ASSETS_ROOT}/sprites/boss4_body.png`,
    prompt: `Touhou-style anime celestial entity. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Large majestic cosmic phoenix-woman with flowing flame-like golden and white hair. Ornate celestial dress with sun and star motifs in gold, white, and deep blue. Crown of miniature stars. Regal, awe-inspiring expression. Highly detailed, ornate costume. Clean linework, vibrant colors.`,
  },
  {
    name: 'Boss 4 — Wings',
    outPath: `${ASSETS_ROOT}/sprites/boss4_wings.png`,
    prompt: `Massive phoenix-like wings made of cosmic flame on a bright green screen background (#00FF00). Gold, white, and cyan celestial fire, with starlight sparkles. Wings positioned as if attached to a large character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the cosmic flame wings. Highly detailed, beautiful and awe-inspiring. Clean linework, glowing edges.`,
  },

  // Portraits
  {
    name: 'Miniboss 4 Portrait — Void Herald',
    outPath: `${ASSETS_ROOT}/portraits/miniboss4_portrait.png`,
    prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body only, detailed face. A cosmic fairy herald with silver and indigo hair. Dark stellar armor with golden constellation patterns. Commanding expression. Dramatic side lighting. Facing slightly left. High detail on the face and eyes. Anime art style, clean linework.`,
  },
  {
    name: 'Boss 4 Portrait — Solaris',
    outPath: `${ASSETS_ROOT}/portraits/boss4_portrait.png`,
    prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body only, detailed face. A majestic cosmic phoenix-woman with flowing flame-like golden hair. Crown of miniature stars. Regal, awe-inspiring expression. Dramatic celestial lighting. Facing slightly left. High detail on the face and eyes. Anime art style, clean linework.`,
  },
];

// ─── Music definition ────────────────────────────────────────────────────────

const musicAsset = {
  name: 'Stage 4 BGM — Celestial Rift',
  outPath: `${ASSETS_ROOT}/music/stage4-bgm.wav`,
  prompt: `Touhou-inspired bullet-hell shooter BGM. Instrumental only, no vocals.
Genre: Japanese doujin game music, dramatic orchestral with intense electronic.
Tempo: 172 BPM. Key: D minor.
Mood: Epic, cosmic, climactic — facing the ultimate celestial being.

[Intro] 0:00-0:10
Deep cosmic synth pad, distant bells, rising tension. Dark ambient space atmosphere building slowly.

[Verse] 0:10-0:35
Aggressive violin melody over electronic drumbeat. Piano runs underneath. Urgent and driven rhythm. Fast and intense.

[Chorus] 0:35-1:05
Full orchestral blast. Brass fanfare. Fast string runs. Heavy electronic bass. Cymbal crashes. Epic and overwhelming intensity.

[Bridge] 1:05-1:25
Drop to solo piano and ethereal choir pad. Haunting countermelody. Building with tremolo strings. Tension rising.

[Chorus 2] 1:25-1:55
Return with maximum intensity. Layered brass and strings. Synth leads doubling melody. Key modulates up. Ultimate climax.

[Outro] 1:55-2:10
Gradual cosmic fade. Clean loop point back to Intro.`,
};

// ─── Generation helpers ──────────────────────────────────────────────────────

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(asset: ImageAsset, index: number, total: number): Promise<boolean> {
  console.log(`\n[${index + 1}/${total}] Generating image: ${asset.name}`);
  console.log(`  -> ${asset.outPath}`);

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`  Retrying (attempt ${attempt + 1}/2)...`);
      await delay(5000);
    }

    const start = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: asset.prompt,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          mkdirSync(dirname(asset.outPath), { recursive: true });
          writeFileSync(asset.outPath, buffer);
          const sizeKB = (buffer.length / 1024).toFixed(0);
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`  OK  ${sizeKB} KB, ${elapsed}s`);
          return true;
        }
      }

      // Check for text responses (errors, refusals, etc.)
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) console.log(`  API text: ${part.text.slice(0, 200)}`);
      }
      console.error(`  WARN: No image data in response`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg.slice(0, 300)}`);
    }
  }

  console.error(`  FAILED after 2 attempts: ${asset.name}`);
  return false;
}

async function generateMusic(): Promise<boolean> {
  console.log(`\n[MUSIC] Generating: ${musicAsset.name}`);
  console.log(`  -> ${musicAsset.outPath}`);

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`  Retrying (attempt ${attempt + 1}/2)...`);
      await delay(10000);
    }

    const start = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: MUSIC_MODEL,
        contents: musicAsset.prompt,
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          mkdirSync(dirname(musicAsset.outPath), { recursive: true });
          writeFileSync(musicAsset.outPath, buffer);
          const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`  OK  ${sizeMB} MB, ${elapsed}s`);
          return true;
        }
      }

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) console.log(`  API text: ${part.text.slice(0, 200)}`);
      }
      console.error(`  WARN: No audio data in response`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${msg.slice(0, 300)}`);
    }
  }

  console.error(`  FAILED after 2 attempts: ${musicAsset.name}`);
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const totalAssets = imageAssets.length + 1; // +1 for music
  console.log('================================================================');
  console.log(' AETHER RIFT — Stage 4: Celestial Rift — Asset Generation');
  console.log('================================================================');
  console.log(`Total assets to generate: ${totalAssets} (${imageAssets.length} images + 1 music track)`);
  console.log(`Image model: ${IMAGE_MODEL}`);
  console.log(`Music model: ${MUSIC_MODEL}`);
  console.log('');

  const mainStart = Date.now();
  let successes = 0;
  let failures = 0;

  // Generate images sequentially to avoid rate limits
  for (let i = 0; i < imageAssets.length; i++) {
    const ok = await generateImage(imageAssets[i], i, imageAssets.length);
    if (ok) successes++;
    else failures++;

    // 3-second delay between requests to be gentle on rate limits
    if (i < imageAssets.length - 1) {
      await delay(3000);
    }
  }

  // Generate music last
  await delay(3000);
  const musicOk = await generateMusic();
  if (musicOk) successes++;
  else failures++;

  const totalElapsed = ((Date.now() - mainStart) / 1000).toFixed(0);
  console.log('\n================================================================');
  console.log(` Generation complete! ${successes}/${totalAssets} succeeded, ${failures} failed`);
  console.log(` Total time: ${totalElapsed}s`);
  console.log('================================================================\n');

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
