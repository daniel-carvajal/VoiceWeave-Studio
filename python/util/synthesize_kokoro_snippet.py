import requests
from typing import Optional

def synthesize_kokoro_snippet(text: str, out_path: str, voice: str = "ef_dora", speed: float = 1.0, endpoint: str = "http://localhost:8880") -> Optional[str]:
    try:
        payload = {
            "model": "kokoro",
            "voice": voice,
            "input": text,
            "response_format": "mp3",
            "speed": speed
        }

        print(f"🎤 Synthesizing: '{text[:50]}...'")

        response = requests.post(
            f"{endpoint}/v1/audio/speech",
            headers={
                "Content-Type": "application/json",
                "Accept": "audio/mpeg"
            },
            json=payload,
            timeout=30
        )

        if response.status_code != 200 or not response.content:
            print(f"❌ Kokoro error {response.status_code}: {response.text}")
            return None

        with open(out_path, "wb") as f:
            f.write(response.content)

        print(f"✅ Saved audio: {out_path}")
        return out_path

    except Exception as e:
        print(f"❌ Kokoro API error: {e}")
        return None
