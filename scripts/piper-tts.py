# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["piper-tts>=1.3", "lameenc>=1.7"]
# ///
"""Offline narration synthesis with Piper (free, neural voices). Called by generate-narration.ts --engine=piper.

Reads a JSON job list on stdin: [{"text": str, "model": "en_US-ryan-high", "out": "public/audio/....mp3"}].
Voice models are downloaded once from huggingface.co/rhasspy/piper-voices into .cache/piper/.
Prints one line per finished job ("ok <out>" or "fail <out> <reason>").
"""
import json
import sys
import urllib.request
from pathlib import Path

import lameenc
from piper import PiperVoice

CACHE = Path(".cache/piper")
BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


def model_path(name: str) -> Path:
    lang, speaker, quality = name.split("-", 2)
    target = CACHE / f"{name}.onnx"
    for suffix in (".onnx", ".onnx.json"):
        f = CACHE / f"{name}{suffix}"
        if not f.exists():
            CACHE.mkdir(parents=True, exist_ok=True)
            url = f"{BASE}/{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}{suffix}"
            print(f"downloading {url}", file=sys.stderr, flush=True)
            urllib.request.urlretrieve(url, f)
    return target


def to_mp3(pcm: bytes, rate: int) -> bytes:
    enc = lameenc.Encoder()
    enc.set_bit_rate(48)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()


def main() -> None:
    jobs = json.load(sys.stdin)
    voices: dict[str, PiperVoice] = {}
    for job in jobs:
        out = Path(job["out"])
        try:
            if job["model"] not in voices:
                voices[job["model"]] = PiperVoice.load(str(model_path(job["model"])))
            voice = voices[job["model"]]
            pcm, rate = b"", voice.config.sample_rate
            for chunk in voice.synthesize(job["text"]):
                pcm += chunk.audio_int16_bytes
                rate = chunk.sample_rate
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(to_mp3(pcm, rate))
            print(f"ok {out}", flush=True)
        except Exception as e:  # noqa: BLE001 - report and continue with the next line
            print(f"fail {out} {type(e).__name__}: {e}".replace("\n", " "), flush=True)


if __name__ == "__main__":
    main()
