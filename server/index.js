import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({
  dest: path.join(process.cwd(), 'tmp'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed (${code}): ${stderr || stdout || command}`));
      }
    });

    child.on('error', reject);
  });

const runWhisper = async (audioPath) => {
  const result = await runCommand('python3', ['server/transcribe_whisper.py', audioPath]);
  const payload = JSON.parse(result.stdout.trim() || '{}');
  return payload;
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  console.log('[SERVER] /api/transcribe request received');

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided.' });
  }

  const inputPath = req.file.path;
  const inputName = req.file.originalname || 'capture.webm';
  const inputExt = path.extname(inputName) || '.webm';
  const wavPath = path.join(path.dirname(inputPath), `${path.basename(inputPath, inputExt)}.wav`);

  try {
    console.log('[SERVER] converting uploaded audio to wav');
    await runCommand(ffmpegPath, ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath]);

    console.log('[WHISPER] starting local transcription');
    const whisperResult = await runWhisper(wavPath);

    const text = String(whisperResult.text || '').trim();
    console.log('[WHISPER] result:', text);

    if (!text) {
      return res.status(200).json({ text: '' });
    }

    return res.json({ text });
  } catch (error) {
    console.error('[SERVER] transcription failed:', error);
    return res.status(500).json({ error: 'Local transcription failed.', detail: String(error) });
  } finally {
    try {
      await fs.unlink(inputPath);
    } catch {}

    try {
      await fs.unlink(wavPath);
    } catch {}
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'roundtable-whisper' });
});

app.listen(port, () => {
  console.log(`[SERVER] transcription server listening on http://localhost:${port}`);
});
