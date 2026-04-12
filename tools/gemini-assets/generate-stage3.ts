#!/usr/bin/env npx tsx
/**
 * Generate all visual and audio assets for Stage 3: Shattered Eden.
 * Run: cd tools/gemini-assets && npx tsx generate-stage3.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GoogleGenAI, Modality } from '@google/genai';

const API_KEY = 'AIzaSyDt8H7415wUzSjhlmGynnSs68ZaTZmNAOM';
const ai = new GoogleGenAI({ apiKey: API_KEY });

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
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
    name: 'Stage 3 Background — Shattered Eden',
    outPath: `${ASSETS_ROOT}/backgrounds/bg-sky-s3.png`,
    prompt: `A wide panoramic background for a side-scrolling 2D game. Ethereal corrupted garden dimension. Deep violet twilight sky with shimmering aurora borealis in green, pink, and blue. Crystal spires and frozen rose bushes silhouetted in the foreground. Floating crystal shards catching light. Beautiful but eerie atmosphere. Seamless horizontal tileable. NO text, NO characters, NO UI elements. High resolution, painterly anime style.`,
  },

  // Enemy: Gunner
  {
    name: 'Enemy Gunner — Body',
    outPath: `${ASSETS_ROOT}/sprites/enemy_gunner_body.png`,
    prompt: `Touhou-style chibi anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Small fairy girl with icy blue hair, wearing a white and crystal dress. Holding a small crystal wand staff. Determined expression. Cute chibi proportions, large head, small body. Clean linework, vibrant colors.`,
  },
  {
    name: 'Enemy Gunner — Wings',
    outPath: `${ASSETS_ROOT}/sprites/enemy_gunner_wings.png`,
    prompt: `Touhou-style chibi anime fairy wings on a bright green screen background (#00FF00). ONE set of crystalline butterfly wings, semi-transparent, icy blue with white sparkle edges. Wings should be positioned as if attached to a small chibi fairy character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the wings. Clean linework.`,
  },

  // Enemy: Bloom
  {
    name: 'Enemy Bloom — Body',
    outPath: `${ASSETS_ROOT}/sprites/enemy_bloom_body.png`,
    prompt: `Touhou-style chibi anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Small fairy girl with pink and rose colored hair in twin tails. Wearing a petal-like dress in pink and white. Gentle expression. Cute chibi proportions, large head, small body. Clean linework, vibrant colors.`,
  },
  {
    name: 'Enemy Bloom — Petals',
    outPath: `${ASSETS_ROOT}/sprites/enemy_bloom_petals.png`,
    prompt: `Large flower petal wings on a bright green screen background (#00FF00). Soft pink and white rose petals arranged like fairy wings. Wings should be positioned as if attached to a small chibi fairy character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the petal wings. Clean linework, vibrant colors.`,
  },

  // Enemy: Prism
  {
    name: 'Enemy Prism — Body',
    outPath: `${ASSETS_ROOT}/sprites/enemy_prism_body.png`,
    prompt: `Touhou-style chibi anime fairy character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Small fairy girl with violet and purple hair. Wearing a geometric crystal-faceted dress in purple and white. Mischievous expression. Cute chibi proportions, large head, small body. Clean linework, vibrant colors.`,
  },
  {
    name: 'Enemy Prism — Crystal',
    outPath: `${ASSETS_ROOT}/sprites/enemy_prism_crystal.png`,
    prompt: `Geometric crystal formations floating in space on a bright green screen background (#00FF00). Diamond and prism shapes in violet and white, arranged as if orbiting a small chibi fairy character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the crystal formations. Clean linework, vibrant glowing edges.`,
  },

  // Miniboss
  {
    name: 'Miniboss 3 — Body (Thorn Sentinel)',
    outPath: `${ASSETS_ROOT}/sprites/miniboss3_body.png`,
    prompt: `Touhou-style anime fairy knight character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Medium-sized fairy knight with silver-white hair in a long braid. Crystal thorned armor over a white dress. Stern determined expression. Carries a crystal lance. More detailed than a regular enemy, taller proportions. Elegant and dangerous. Clean linework, vibrant colors.`,
  },
  {
    name: 'Miniboss 3 — Thorns',
    outPath: `${ASSETS_ROOT}/sprites/miniboss3_thorns.png`,
    prompt: `Crystal thorn vines growing outward on a bright green screen background (#00FF00). Pale green glowing energy running through thorny crystal vines. Positioned as if growing from the back and shoulders of a medium-sized character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the crystal thorn vines. Clean linework, glowing accents.`,
  },

  // Boss
  {
    name: 'Boss 3 — Body (Rosalia, Garden Queen)',
    outPath: `${ASSETS_ROOT}/sprites/boss3_body.png`,
    prompt: `Touhou-style anime fairy queen character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT. Large beautiful fairy queen with flowing rose-pink and white hair. Elegant corrupted garden dress with crystal rose motifs. Crown of frozen roses on her head. Regal but menacing expression. Highly detailed, ornate costume design. Touhou-style anime character. Clean linework, vibrant colors.`,
  },
  {
    name: 'Boss 3 — Wings',
    outPath: `${ASSETS_ROOT}/sprites/boss3_wings.png`,
    prompt: `Massive fairy wings made of crystallized rose petals and thorny vines on a bright green screen background (#00FF00). Shimmering pink, violet, and white colors. Wings positioned as if attached to a large fairy queen character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the crystallized rose petal wings. Highly detailed, beautiful and ominous. Clean linework, glowing edges.`,
  },

  // Portraits
  {
    name: 'Miniboss 3 Portrait — Thorn Sentinel',
    outPath: `${ASSETS_ROOT}/portraits/miniboss3_portrait.png`,
    prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body only, detailed face. A fairy knight with silver-white hair in a long braid. Crystal thorned armor over a white dress. Stern expression. Dramatic lighting from the side. Facing slightly left. High detail on the face and eyes. Anime art style, clean linework.`,
  },
  {
    name: 'Boss 3 Portrait — Rosalia',
    outPath: `${ASSETS_ROOT}/portraits/boss3_portrait.png`,
    prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body only, detailed face. A beautiful fairy queen with flowing rose-pink and white hair. Crown of frozen roses. Elegant corrupted garden dress with crystal rose motifs. Regal but menacing expression. Dramatic lighting from the side. Facing slightly left. High detail on the face and eyes. Anime art style, clean linework.`,
  },
];

// ─── Music definition ────────────────────────────────────────────────────────

const musicAsset = {
  name: 'Stage 3 BGM — Shattered Eden',
  outPath: `${ASSETS_ROOT}/music/stage3-bgm.wav`,
  prompt: `Touhou-inspired bullet-hell shooter BGM. Instrumental only, no vocals.
Genre: Japanese doujin game music, elegant orchestral with electronic elements.
Tempo: 162 BPM. Key: F# minor.
Mood: Beautiful, haunting, bittersweet — exploring a corrupted garden paradise.

[Intro] 0:00-0:12
Music box melody in F# minor, crystalline and delicate. Soft reverb. Light harp arpeggios. Single flute playing a melancholic motif.

[Verse] 0:12-0:40
Waltz-like rhythm enters (3/4 feel over 4/4 pulse). Violin carries the main melody, sweet but with a dark undertone. Piano arpeggios underneath. Soft electronic bass. Tambourine and light percussion. Celesta sparkles accent phrase endings.

[Chorus] 0:40-1:10
Full orchestral bloom. Strings in lush harmony. Trumpet plays a soaring countermelody. Fast violin runs and cello pizzicato. Electronic drums add drive underneath the orchestral texture. Cymbal swells. Beautiful and intense simultaneously.

[Bridge] 1:10-1:30
Drop to harp and music box. Haunting solo violin over sustained string pad. Key shifts briefly to A major. Crystal bell tones. Building tension with rising tremolo strings.

[Chorus 2] 1:30-2:00
Full return with added intensity. Piccolo doubling the violin melody. More aggressive electronic drums. Synth pads add shimmer. Key modulates up. Orchestral climax.

[Outro] 2:00-2:15
Gradual fade to music box and harp. Clean loop point back to Intro.`,
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
  console.log(' AETHER RIFT — Stage 3: Shattered Eden — Asset Generation');
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

    // Small delay between requests to be gentle on rate limits
    if (i < imageAssets.length - 1) {
      await delay(2000);
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
