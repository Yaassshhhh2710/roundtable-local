import json
import sys

import torch
import whisper


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"text": "", "error": "No input audio file provided."}))
        raise SystemExit(1)

    audio_path = sys.argv[1]
    device = "mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    model = whisper.load_model("base", device=device)
    result = model.transcribe(audio_path, fp16=(device != "cpu"), verbose=False)
    text = (result.get("text") or "").strip()
    print(json.dumps({"text": text}))


if __name__ == "__main__":
    main()
