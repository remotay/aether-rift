import { config as loadEnv } from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env relative to this file so it works regardless of cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadEnv({ path: join(__dirname, '../.env') });
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenAI, Modality } from '@google/genai';

const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const MUSIC_MODEL = 'lyria-3-pro-preview';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  process.stderr.write('GEMINI_API_KEY is not set in environment.\n');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ── helpers ──────────────────────────────────────────────────────────────────

function ensureDir(filePath: string): void {
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

async function generateImage(prompt: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('No image returned by Gemini API');
}

async function generateImageWithReference(
  prompt: string,
  inputPath: string,
): Promise<Buffer> {
  const imageData = readFileSync(resolve(inputPath));
  const base64 = imageData.toString('base64');
  const mimeType = inputPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('No image returned by Gemini API');
}

async function generateMusic(prompt: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: MUSIC_MODEL,
    contents: prompt,
    config: {
      responseModalities: [Modality.AUDIO, Modality.TEXT],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith('audio/') && part.inlineData.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('No audio returned by Gemini Lyria API');
}

// ── MCP server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'gemini-assets', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'generate_styleframe',
      description:
        'Generate a high-quality styleframe image for scene/mood reference using Gemini image generation.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed image generation prompt describing the styleframe.',
          },
          outPath: {
            type: 'string',
            description: 'Output file path relative to project root (e.g. assets/styleframes/title.png).',
          },
        },
        required: ['prompt', 'outPath'],
      },
    },
    {
      name: 'generate_sprite',
      description:
        'Generate a sprite image (player, enemy, boss, pickup, etc.) using Gemini image generation.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed image generation prompt describing the sprite.',
          },
          outPath: {
            type: 'string',
            description: 'Output file path relative to project root (e.g. assets/sprites/player.png).',
          },
        },
        required: ['prompt', 'outPath'],
      },
    },
    {
      name: 'revise_image',
      description:
        'Revise or edit an existing image with an instruction prompt using Gemini image editing.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Instruction describing what changes to make to the image.',
          },
          inputPath: {
            type: 'string',
            description: 'Path to the existing image to revise (relative to project root).',
          },
          outPath: {
            type: 'string',
            description: 'Output file path for the revised image (relative to project root).',
          },
        },
        required: ['prompt', 'inputPath', 'outPath'],
      },
    },
    {
      name: 'generate_music',
      description:
        'Generate a music track using Google Lyria 3 Pro. Produces a full-length instrumental or vocal track from a text description. ' +
        'Supports genre, tempo/BPM, key, instrumentation, mood, and structural tags like [Intro], [Verse], [Chorus], [Bridge], [Outro]. ' +
        'Can also use timestamp ranges like [0:00-0:15] to control when instruments enter. Output is WAV (48kHz stereo).',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description:
              'Detailed music generation prompt. Include genre, tempo, mood, instruments, and structure. ' +
              'Example: "Intense Touhou-inspired bullet-hell BGM. 160 BPM, D minor. [Intro] Piano arpeggios with light strings. ' +
              '[Verse] Driving drums, synth bass, fast violin melody. [Chorus] Full orchestral hit with trumpet fanfare."',
          },
          outPath: {
            type: 'string',
            description:
              'Output file path relative to project root (e.g. C:/modern-danmaku-shooter/public/assets/music/stage1-bgm.wav).',
          },
        },
        required: ['prompt', 'outPath'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'generate_styleframe') {
      const { prompt, outPath } = args as { prompt: string; outPath: string };
      const imageBuffer = await generateImage(
        `Styleframe for a modern anime-inspired bullet-hell shooter game. ${prompt}`,
      );
      ensureDir(outPath);
      writeFileSync(resolve(outPath), imageBuffer);
      return {
        content: [{ type: 'text', text: `Styleframe written to ${outPath}` }],
      };
    }

    if (name === 'generate_sprite') {
      const { prompt, outPath } = args as { prompt: string; outPath: string };
      const imageBuffer = await generateImage(
        `Sprite sheet for a modern anime-inspired bullet-hell shooter game. Transparent background. ${prompt}`,
      );
      ensureDir(outPath);
      writeFileSync(resolve(outPath), imageBuffer);
      return {
        content: [{ type: 'text', text: `Sprite written to ${outPath}` }],
      };
    }

    if (name === 'revise_image') {
      const { prompt, inputPath, outPath } = args as {
        prompt: string;
        inputPath: string;
        outPath: string;
      };
      const imageBuffer = await generateImageWithReference(prompt, inputPath);
      ensureDir(outPath);
      writeFileSync(resolve(outPath), imageBuffer);
      return {
        content: [{ type: 'text', text: `Revised image written to ${outPath}` }],
      };
    }

    if (name === 'generate_music') {
      const { prompt, outPath } = args as { prompt: string; outPath: string };
      const audioBuffer = await generateMusic(prompt);
      ensureDir(outPath);
      writeFileSync(resolve(outPath), audioBuffer);
      const sizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(1);
      return {
        content: [{ type: 'text', text: `Music track written to ${outPath} (${sizeMB} MB)` }],
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('Gemini Assets MCP server running on stdio\n');
