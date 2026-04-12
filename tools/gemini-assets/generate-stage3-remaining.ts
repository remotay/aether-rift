#!/usr/bin/env npx tsx
/**
 * Generate REMAINING Stage 3 assets (miniboss3, boss3, portraits, BGM).
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { GoogleGenAI, Modality } from '@google/genai';

const API_KEY = 'AIzaSyDt8H7415wUzSjhlmGynnSs68ZaTZmNAOM';
const ai = new GoogleGenAI({ apiKey: API_KEY });
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const MUSIC_MODEL = 'lyria-3-pro-preview';
const ASSETS_ROOT = 'C:/modern-danmaku-shooter/public/assets';

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function genImage(name: string, outPath: string, prompt: string): Promise<boolean> {
  if (existsSync(outPath)) { console.log(`  SKIP (exists): ${name}`); return true; }
  console.log(`\n  Generating: ${name}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) { console.log(`  Retry ${attempt+1}...`); await delay(5000); }
    try {
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL, contents: prompt,
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          mkdirSync(dirname(outPath), { recursive: true });
          writeFileSync(outPath, buffer);
          console.log(`  OK ${(buffer.length/1024).toFixed(0)} KB`);
          return true;
        }
      }
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) console.log(`  Text: ${part.text.slice(0,200)}`);
      }
    } catch (err) { console.error(`  ERR: ${(err as Error).message?.slice(0,200)}`); }
  }
  console.error(`  FAILED: ${name}`);
  return false;
}

async function genMusic(outPath: string, prompt: string): Promise<boolean> {
  if (existsSync(outPath)) { console.log(`  SKIP (exists): music`); return true; }
  console.log(`\n  Generating music...`);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) { console.log(`  Retry ${attempt+1}...`); await delay(10000); }
    try {
      const response = await ai.models.generateContent({
        model: MUSIC_MODEL, contents: prompt,
        config: { responseModalities: [Modality.AUDIO, Modality.TEXT] },
      });
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          mkdirSync(dirname(outPath), { recursive: true });
          writeFileSync(outPath, buffer);
          console.log(`  OK ${(buffer.length/(1024*1024)).toFixed(1)} MB`);
          return true;
        }
      }
    } catch (err) { console.error(`  ERR: ${(err as Error).message?.slice(0,200)}`); }
  }
  return false;
}

async function main() {
  console.log('=== Stage 3 Remaining Assets ===');
  let ok = 0, fail = 0;

  const images = [
    { name: 'Miniboss3 Body', path: `${ASSETS_ROOT}/sprites/miniboss3_body.png`,
      prompt: `Touhou-style anime fairy knight character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Character faces LEFT. Medium-sized fairy knight with silver-white hair in a long braid. Crystal thorned armor over a white dress. Stern determined expression. Carries a crystal lance. More detailed than a regular enemy, taller proportions. Elegant and dangerous. Clean linework, vibrant colors.` },
    { name: 'Miniboss3 Thorns', path: `${ASSETS_ROOT}/sprites/miniboss3_thorns.png`,
      prompt: `Crystal thorn vines growing outward on a bright green screen background (#00FF00). Pale green glowing energy running through thorny crystal vines. Positioned as if growing from the back and shoulders of a medium-sized character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the crystal thorn vines. Clean linework, glowing accents.` },
    { name: 'Boss3 Body', path: `${ASSETS_ROOT}/sprites/boss3_body.png`,
      prompt: `Touhou-style anime fairy queen character. ONE single character only, centered on canvas. Bright green screen background (#00FF00). Do NOT create a sprite sheet. Character faces LEFT. Large beautiful fairy queen with flowing rose-pink and white hair. Elegant corrupted garden dress with crystal rose motifs. Crown of frozen roses on her head. Regal but menacing expression. Highly detailed, ornate costume design. Touhou-style anime character. Clean linework, vibrant colors.` },
    { name: 'Boss3 Wings', path: `${ASSETS_ROOT}/sprites/boss3_wings.png`,
      prompt: `Massive fairy wings made of crystallized rose petals and thorny vines on a bright green screen background (#00FF00). Shimmering pink, violet, and white colors. Wings positioned as if attached to a large fairy queen character facing LEFT. Same scale and position as the character body layer. Do NOT show the character body. Only the crystallized rose petal wings. Highly detailed, beautiful and ominous. Clean linework, glowing edges.` },
    { name: 'Miniboss3 Portrait', path: `${ASSETS_ROOT}/portraits/miniboss3_portrait.png`,
      prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body only, detailed face. A fairy knight with silver-white hair in a long braid. Crystal thorned armor over a white dress. Stern expression. Dramatic lighting from the side. Facing slightly left. High detail on the face and eyes. Anime art style, clean linework.` },
    { name: 'Boss3 Portrait', path: `${ASSETS_ROOT}/portraits/boss3_portrait.png`,
      prompt: `Anime portrait bust illustration on a bright green screen background (#00FF00). Upper body only, detailed face. A beautiful fairy queen with flowing rose-pink and white hair. Crown of frozen roses. Elegant corrupted garden dress with crystal rose motifs. Regal but menacing expression. Dramatic lighting from the side. Facing slightly left. High detail on the face and eyes. Anime art style, clean linework.` },
  ];

  for (const img of images) {
    const result = await genImage(img.name, img.path, img.prompt);
    if (result) ok++; else fail++;
    await delay(2000);
  }

  await delay(3000);
  const musicOk = await genMusic(`${ASSETS_ROOT}/music/stage3-bgm.wav`,
    `Touhou-inspired bullet-hell shooter BGM. Instrumental only, no vocals. Genre: Japanese doujin game music, elegant orchestral with electronic elements. Tempo: 162 BPM. Key: F# minor. Mood: Beautiful, haunting, bittersweet — exploring a corrupted garden paradise. Music box melody intro with crystalline celesta. Then waltz-like strings enter with violin melody. Build to full orchestral chorus with trumpet countermelody. Bridge with solo harp and violin. Return to chorus with added intensity and modulation. Fade to music box outro. About 2 minutes, loopable.`
  );
  if (musicOk) ok++; else fail++;

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}
main();
