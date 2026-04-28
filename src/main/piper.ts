import { ipcMain, app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const PIPER_DIR = path.join(process.cwd(), 'tts', 'piper');
const PIPER_EXE = path.join(PIPER_DIR, 'piper', 'piper.exe');
const VOICES_DIR = path.join(PIPER_DIR, 'voices');

export interface PiperOptions {
  text: string;
  voice: string;
  language: string;
  speed?: number;
  volume?: number;
}

export async function generateSpeech(options: PiperOptions): Promise<Buffer> {
  const { text, voice, language, speed = 1.0 } = options;

  const modelPath = path.join(VOICES_DIR, language, `${voice}.onnx`);
  const outputPath = path.join(app.getPath('temp'), `nexus_speech_${Date.now()}.wav`);

  if (!fs.existsSync(PIPER_EXE)) {
    throw new Error(`Piper executable not found at ${PIPER_EXE}`);
  }

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Voice model not found at ${modelPath}`);
  }

  return new Promise((resolve, reject) => {
    const piper = spawn(PIPER_EXE, [
      '--model', modelPath,
      '--output_file', outputPath,
      '--length_scale', (1 / speed).toString()
    ]);

    piper.stdin.write(text);
    piper.stdin.end();

    piper.on('close', (code) => {
      if (code === 0) {
        try {
          const buffer = fs.readFileSync(outputPath);
          fs.unlinkSync(outputPath);
          resolve(buffer);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`Piper exited with code ${code}`));
      }
    });

    piper.on('error', (err) => {
      reject(err);
    });
  });
}

ipcMain.handle('generate-speech', async (event, options: PiperOptions) => {
  try {
    const buffer = await generateSpeech(options);
    return buffer;
  } catch (error: any) {
    console.error('Piper TTS Error:', error);
    return null;
  }
});

ipcMain.handle('get-piper-voices', async () => {
  try {
    const languages = fs.readdirSync(VOICES_DIR);
    const voices: Record<string, string[]> = {};
    for (const lang of languages) {
      const langPath = path.join(VOICES_DIR, lang);
      if (fs.statSync(langPath).isDirectory()) {
        const files = fs.readdirSync(langPath);
        voices[lang] = files
          .filter(f => f.endsWith('.onnx'))
          .map(f => f.replace('.onnx', ''));
      }
    }
    return voices;
  } catch (e) {
    return {};
  }
});
