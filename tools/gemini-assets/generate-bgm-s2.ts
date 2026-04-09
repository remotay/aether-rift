#!/usr/bin/env npx tsx
/**
 * Retry Stage 2 BGM generation with adjusted prompt.
 */

import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: join(__dirname, '.env') });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const outPath = 'C:/modern-danmaku-shooter/public/assets/music/stage2-bgm.wav';

const prompt = `Instrumental video game background music for an action arcade game stage.
Genre: Electronic orchestral hybrid, Japanese game music inspired.
Tempo: 165 BPM. Key: E minor.
Mood: Intense, mechanical, driving — navigating through a clockwork dimension.

[Intro] 0:00-0:10
Rhythmic percussion with metallic textures. Deep bass synth drone in E minor.
Electronic elements build tension.

[Verse] 0:10-0:40
Fast driving drum pattern with heavy kick and syncopated snare.
Dark synth bass riff, chromatic and energetic.
Electric guitar power chords on offbeats. Eerie lead synth melody.
Digital textures and rhythmic accents. High energy and forward momentum.

[Chorus] 0:40-1:10
Full intensity. Electric guitar takes the melody, fast and technical.
Orchestra brass hits on downbeats with timpani.
Rapid snare fills. Cymbal crashes. Powerful bass drops.
Synth arpeggiator running 16th notes underneath.
Orchestral pad sustains for weight and drama.
Unrelenting energy and power.

[Bridge] 1:10-1:30
Half-time drums. Deep sub-bass pulses.
Piano plays a haunting chromatic descending figure.
Reversed cymbal swells build anticipation.
A single violin plays a lyrical counter-theme.
Rising tension throughout.

[Chorus 2] 1:30-2:00
Maximum intensity return. Double-time hi-hats.
Guitar and synth in unison with the melody.
Brass fanfare overlaid. Timpani pounding.
Additional synth layers for density.
Key modulates up for the climactic push.

[Outro] 2:00-2:15
Instruments drop out gradually. Deep bass sustains.
Final reverb decay. Loops cleanly back to Intro.`;

console.log('🎵 Generating Stage 2 BGM (retry)...');
const start = Date.now();

const response = await ai.models.generateContent({
  model: 'lyria-3-pro-preview',
  contents: prompt,
  config: {
    responseModalities: [Modality.AUDIO, Modality.TEXT],
  },
});

for (const part of response.candidates?.[0]?.content?.parts ?? []) {
  if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
    const buffer = Buffer.from(part.inlineData.data, 'base64');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, buffer);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ Done! ${sizeMB} MB, ${elapsed}s → ${outPath}`);
    process.exit(0);
  }
}

// If we get text back, print it for debugging
for (const part of response.candidates?.[0]?.content?.parts ?? []) {
  if (part.text) console.log('API text response:', part.text);
}
console.error('❌ No audio data in response');
process.exit(1);
