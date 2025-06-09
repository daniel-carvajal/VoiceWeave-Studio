import os
from util.synthesize_kokoro_snippet import synthesize_kokoro_snippet

from speakers import speaker_voices

def text_chunks_to_audio(segments, audio_dir, audio_paths):
    from config import config

    print("🧠 Synthesizing transcript chunks via Kokoro...")
    # audio_paths = []

    for idx, segment in enumerate(segments):
        print(f"🔍 DEBUG: Processing segment {idx}: '{segment.original_text[:30]}...'")
        text = segment.translated_text or segment.original_text
        mp3_filename = f"chunk_{idx:03d}.mp3"
        mp3_path = os.path.join(audio_dir, mp3_filename)

        # Check if this specific audio file already exists
        if os.path.exists(mp3_path):
            print(f"✅ Reusing existing audio: {mp3_filename}")
            audio_paths.append(mp3_path)
            segment.audio_file = mp3_path  # Use the actual path
        else:
            # Use adjusted speed if specified by rules
            synthesis_speed = segment.adjusted_speed * config["kokoro_speed"]
            result_path = synthesize_kokoro_snippet(
                text, 
                out_path=mp3_path, 
                voice = speaker_voices.get(segment.speaker, config["kokoro_voice"]),
                speed=synthesis_speed, 
                endpoint=config["kokoro_endpoint"]
            )
            if result_path:
                audio_paths.append(result_path)
                segment.audio_file = result_path  # Use the actual returned path
            else:
                print(f"⚠️ Failed to synthesize segment {idx}")
                segment.audio_file = None

        print(f"🔍 DEBUG: Set segment {idx} audio_file to: {segment.audio_file}")

    print(f"✅ Audio synthesis complete: {len(audio_paths)} chunks ready")