# ROUNDTABLE — Local App

A local recreation of the ROUNDTABLE multispeaker meeting UI with real microphone capture and a local Whisper transcription backend.

## Requirements

- Node.js 18+
- Python 3.10+
- macOS or Linux with microphone access enabled

## Install

```bash
npm install
python3 -m pip install openai-whisper
```

## Run the app

Start both the local transcription server and the Vite frontend together:

```bash
npm run dev:all
```

Or run them separately in two terminals:

```bash
npm run server
npm run dev
```

Open the localhost URL printed by Vite.

## Transcription pipeline

- Browser microphone: `getUserMedia()`
- Audio capture: `MediaRecorder`
- Local conversion: Node server converts chunks to WAV using `ffmpeg-static`
- Local speech-to-text: Python + OpenAI Whisper
- UI transcript: ROUNDTABLE transcript panel appends only recognized spoken text

## Notes

- Demo mode is still available for a sample walkthrough.
- Live mode uses the real computer microphone and never displays text that was not actually transcribed from audio.
- Speaker count is adjustable from 3 to 5.
- Speaker names default to Speaker 1, Speaker 2, etc., and can be changed before starting.
- Session data is in-memory for this local prototype.
