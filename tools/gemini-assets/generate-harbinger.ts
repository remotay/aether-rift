#!/usr/bin/env npx tsx
/**
 * Generate sprite assets for the Harbinger — the TRUE final boss
 * who appears as recurring interludes throughout every stage.
 * Run: cd tools/gemini-assets && npx tsx generate-harbinger.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GoogleGenAI, Modality } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
if (!API_KEY) {
  console.error('ERROR: No API key found. Set GEMINI_API_KEY or GOOGLE_API_KEY env var.');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

const ASSETS_ROOT = 'C:/modern-danmaku-shooter/public/assets';

// ─── Image asset definitions ─────────────────────────────────────────────────

interface ImageAsset {
  name: string;
  outPath: string;
  prompt: string;
}

const imageAssets: ImageAsset[] = [
  // Harbinger — Main body sprite
  {
    name: 'Harbinger — Body',
    outPath: `${ASSETS_ROOT}/sprites/harbinger_body.png`,
    prompt: `Touhou-style anime character, powerful ethereal dark empress / cosmic deity. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Do NOT show multiple poses or views. Character faces LEFT.

Tall, elegant and imposing figure. Long flowing silver-white hair with faintly glowing tips in magenta and violet. Pale luminous skin. Piercing eyes with an otherworldly glow.

Wearing an ornate flowing dark dress/robe in deep violet and indigo, with intricate luminous accents in bright magenta and white energy patterns along the hems and seams. The dress has layered flowing panels that suggest immense power held in check.

A dark ornate tiara or crown with a single glowing gemstone. Slender elegant hands, one slightly raised as if commanding unseen forces. Confident, imperious expression — serene yet threatening.

Distinctive strong silhouette that reads clearly even at small scale. Highly detailed costume, clean linework, vibrant colors. Premium anime art quality. 1024x1024 image.`,
  },

  // Harbinger — Cloak / energy layer (animated separately)
  {
    name: 'Harbinger — Cloak & Energy',
    outPath: `${ASSETS_ROOT}/sprites/harbinger_cloak.png`,
    prompt: `Ethereal flowing energy cloak and cosmic wing manifestation on a bright green screen background (#00FF00). Semi-transparent dark violet and indigo flowing robes with luminous magenta and white energy tendrils streaming outward. Large ethereal wings made of swirling cosmic energy — deep purple core with bright magenta and white edges, semi-transparent and ghostly.

Long flowing hair strands with glowing tips drifting as if in cosmic wind. Energy ribbons and dark matter wisps trailing behind and around.

Positioned as if attached to a tall elegant character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the cloak, energy wings, hair flow, and cosmic tendrils.

Clean linework, glowing edges, premium anime VFX quality. 1024x1024 image.`,
  },

  // Harbinger — Portrait for dialogue / UI
  {
    name: 'Harbinger — Portrait',
    outPath: `${ASSETS_ROOT}/portraits/harbinger_portrait.png`,
    prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body and face close-up, highly detailed.

A powerful ethereal dark empress / cosmic deity. Long flowing silver-white hair with faintly glowing tips in magenta and violet. Pale luminous skin. Piercing otherworldly glowing eyes — one eye partially hidden by hair for mystery.

Wearing an ornate dark violet and indigo dress/robe with luminous magenta and white energy accents at the collar and shoulders. A dark ornate tiara or crown with a single glowing gemstone on the forehead.

Expression: serene yet imperious, with a faint knowing smile that suggests cosmic-scale power. Dramatic side lighting in violet and magenta tones. Facing slightly left.

High detail on the face and eyes. Premium anime art style, clean linework. 768x768 image.`,
  },
];

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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('================================================================');
  console.log(' AETHER RIFT — Harbinger (True Final Boss) — Asset Generation');
  console.log('================================================================');
  console.log(`Total assets to generate: ${imageAssets.length} images`);
  console.log(`Image model: ${IMAGE_MODEL}`);
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

  const totalElapsed = ((Date.now() - mainStart) / 1000).toFixed(0);
  console.log('\n================================================================');
  console.log(` Generation complete! ${successes}/${imageAssets.length} succeeded, ${failures} failed`);
  console.log(` Total time: ${totalElapsed}s`);
  console.log('================================================================\n');

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
