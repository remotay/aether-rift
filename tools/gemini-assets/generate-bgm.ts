#!/usr/bin/env npx tsx
/**
 * Standalone script to generate BGM tracks for Aether Rift using Lyria 3 Pro.
 * Run: npx tsx tools/gemini-assets/generate-bgm.ts
 */

import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: join(__dirname, '.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set. Add it to tools/gemini-assets/.env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const MUSIC_MODEL = 'lyria-3-pro-preview';

interface TrackDef {
  name: string;
  outPath: string;
  prompt: string;
}

const tracks: TrackDef[] = [
  {
    name: 'Stage 1 — Threshold of Eternity',
    outPath: 'C:/modern-danmaku-shooter/public/assets/music/stage1-bgm.wav',
    prompt: `Touhou-inspired bullet-hell shooter BGM. Instrumental only, no vocals.
Genre: Japanese doujin game music, fast-paced orchestral/electronic hybrid.
Tempo: 155 BPM. Key: D minor.
Mood: Energetic, mystical, urgent — a shrine maiden battling through a spirit-filled twilight sky.

[Intro] 0:00-0:12
Ethereal piano arpeggios in D minor with soft string pads and wind chimes.
A single flute melody hints at the main theme. Light reverb, building anticipation.

[Verse] 0:12-0:40
Driving electronic kick drum and snare enter. Fast staccato violin ostinato.
Synth bass provides the low end. Piano continues arpeggios underneath.
A trumpet carries the melody — heroic but with a melancholic edge.
Tambourine and hi-hat keep the energy high.

[Chorus] 0:40-1:10
Full orchestral explosion. Brass section with trumpet and horn in unison melody.
Fast violin runs, cello countermelody. Taiko-style drum accents on downbeats.
Cymbal crashes at phrase endings. Soaring, triumphant, intense.
Layered synth pads add width and shimmer.

[Bridge] 1:10-1:30
Drop to piano and strings only. Mysterious, contemplative.
Harp glissandos. Celesta bell-like tones. Key shifts to F major briefly.
Building tension with rising string tremolo.

[Chorus 2] 1:30-2:00
Return of full instrumentation at higher intensity.
Additional piccolo doubling the trumpet melody an octave up.
Faster hi-hat patterns. More aggressive bass synth.
Timpani rolls leading into final phrase.

[Outro] 2:00-2:20
Gradual fade. Piano arpeggios return. Strings sustain a D minor chord.
Wind chimes and reverb tail. Clean ending that can loop back to Intro.`,
  },
  {
    name: 'Stage 2 — Clockwork Abyss',
    outPath: 'C:/modern-danmaku-shooter/public/assets/music/stage2-bgm.wav',
    prompt: `Touhou-inspired bullet-hell shooter BGM. Instrumental only, no vocals.
Genre: Japanese doujin game music, dark industrial/electronic with orchestral elements.
Tempo: 168 BPM. Key: E minor.
Mood: Intense, mechanical, relentless — battling through a dimension of gears, lasers, and clockwork automata.

[Intro] 0:00-0:10
Metallic clockwork ticking sound. Deep bass drone in E minor.
Distorted synth growl builds. Industrial percussion enters — mechanical, precise.

[Verse] 0:10-0:40
Aggressive drum and bass pattern. Heavy kick on quarter notes, syncopated snare.
Dark sawtooth synth bass riff, chromatic and menacing.
Electric guitar power chords on the offbeat. Eerie theremin-like lead melody.
Glitchy digital artifacts and mechanical gear sounds accent the rhythm.
Tension and forward momentum — the factory is alive and hostile.

[Chorus] 0:40-1:10
Full intensity. Distorted electric guitar takes the melody — fast, technical, shredding.
Orchestra stabs: brass hits on downbeats with timpani.
Rapid-fire snare rolls. Cymbal crashes. Bass drops.
Synth arpeggiator running 16th notes underneath.
Dark choir pad sustains power chords for weight.
Unrelenting, aggressive, overwhelming force.

[Bridge] 1:10-1:30
Breakdown section. Half-time drums. Deep sub-bass pulses.
Piano plays a haunting chromatic descending figure.
Clock ticking returns. Reversed cymbal swells.
A single violin plays a sorrowful counter-theme.
Building tension — gears grinding, pressure rising.

[Chorus 2] 1:30-2:00
Everything returns at maximum intensity.
Double-time hi-hats. Guitar and synth in unison shredding the melody.
Brass fanfare overlaid. Timpani and taiko pounding.
Additional distorted synth layers. Industrial hammering percussion.
Key modulates up to F# minor for the final push.

[Outro] 2:00-2:20
Clockwork deconstruction — instruments drop out one by one.
Gear sounds slow down. Deep bass drone sustains.
Final metallic clang and reverb decay. Loops cleanly back to Intro.`,
  },
  {
    name: 'Boss Battle',
    outPath: 'C:/modern-danmaku-shooter/public/assets/music/boss-bgm.wav',
    prompt: `Touhou-inspired bullet-hell shooter boss battle BGM. Instrumental only, no vocals.
Genre: Japanese doujin game music, high-energy orchestral/rock/electronic fusion.
Tempo: 175 BPM. Key: C minor.
Mood: Epic showdown, adrenaline-pumping, dramatic — facing a powerful divine being in a spectacular battle.

[Intro] 0:00-0:08
Dramatic orchestral hit. Timpani roll into cymbal crash.
Distorted power chord stab. Brief silence. Then explosion of energy.

[Verse] 0:08-0:35
Blazing fast drums — double kick, tight snare, driving hi-hat.
Heavy distorted electric guitar chugging eighth notes.
Synth bass doubling the guitar for massive low end.
Trumpet plays an aggressive, angular melody — confrontational and bold.
String section plays fast staccato counterpoint underneath.
Occasional piano flourishes accent phrase endings.

[Chorus] 0:35-1:05
Maximum power. Full orchestra, full band, full synth stack.
Guitar solo shreds over the top — virtuosic, fast, emotional.
Brass section blasts the main theme in fortissimo.
Choir-like synth pads add ethereal weight.
Taiko and orchestral percussion drive relentlessly.
Cymbal crashes every 4 bars. Timpani accents.
This is the climactic battle moment — everything at stake.

[Bridge] 1:05-1:25
Sudden drop to harpsichord and strings — baroque-influenced passage.
Minor key arpeggios create an eerie calm before the storm.
Deep breathing space. Snare roll builds slowly.
Piano joins with cascading runs. Tension coils tighter and tighter.

[Chorus 2] 1:25-1:55
Explosive return. Even more intense than Chorus 1.
Key modulates up to D minor. Higher, more desperate energy.
Guitar and violin in unison melody — screaming intensity.
Full percussion battery: kick, snare, toms, taiko, timpani, cymbals.
Synth arpeggiator running underneath at blistering speed.
Brass countermelody weaves through the texture.

[Outro] 1:55-2:10
Gradual breakdown. Instruments thin to guitar and piano.
Final sustained orchestral chord. Cymbal wash.
Clean loop point back to Intro for continuous boss fight.`,
  },
  {
    name: 'Title Screen',
    outPath: 'C:/modern-danmaku-shooter/public/assets/music/title-bgm.wav',
    prompt: `Touhou-inspired bullet-hell shooter title screen BGM. Instrumental only, no vocals.
Genre: Japanese doujin game music, atmospheric orchestral/electronic.
Tempo: 100 BPM. Key: A minor.
Mood: Mysterious, elegant, inviting — a gateway to an ethereal adventure. Contemplative but with underlying energy.

[Intro] 0:00-0:15
Soft wind ambience. Gentle piano in A minor, sparse and reflective.
Celesta plays crystalline bell tones. Light string pad sustains.
Harp arpeggios float gently.

[Verse] 0:15-0:50
Light electronic beat enters — subtle, not aggressive.
Flute carries a beautiful, melancholic melody — the game's main theme.
Acoustic guitar fingerpicking underneath. Soft bass notes.
Strings swell gradually. Warmth and beauty.
Occasional wind chime accents. Everything breathes and flows.

[Chorus] 0:50-1:20
Gentle orchestral bloom. Strings carry the melody now — violin and cello.
Piano continues arpeggios. Soft brass warmth (French horn).
The beat gains slightly more presence but remains elegant.
Cymbal swells. Glockenspiel sparkles.
Hopeful, yearning, beautiful.

[Bridge/Loop] 1:20-1:50
Returns to piano and ambient texture. Prepares for seamless loop.
Harp and celesta. Fade to gentle sustain.
Clean loop back to Verse.`,
  },
];

async function generateTrack(track: TrackDef): Promise<void> {
  console.log(`\n🎵 Generating: ${track.name}...`);
  console.log(`   Output: ${track.outPath}`);
  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: MUSIC_MODEL,
      contents: track.prompt,
      config: {
        responseModalities: [Modality.AUDIO, Modality.TEXT],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        mkdirSync(dirname(track.outPath), { recursive: true });
        writeFileSync(track.outPath, buffer);
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(1);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`   ✅ Done! ${sizeMB} MB, ${elapsed}s`);
        return;
      }
    }
    console.error(`   ❌ No audio data in response for ${track.name}`);
  } catch (err) {
    console.error(`   ❌ Error generating ${track.name}:`, err instanceof Error ? err.message : err);
  }
}

// Generate all tracks sequentially to avoid rate limits
console.log('═══════════════════════════════════════════════════════');
console.log(' AETHER RIFT — BGM Generation via Lyria 3 Pro Preview');
console.log('═══════════════════════════════════════════════════════');
console.log(`Generating ${tracks.length} tracks...`);

for (const track of tracks) {
  await generateTrack(track);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(' All tracks complete!');
console.log('═══════════════════════════════════════════════════════\n');
