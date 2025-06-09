from typing import Optional
from checks.check_files_exist import check_transcript_exists

import os, subprocess
from typing import List, Dict, Optional
from pathlib import Path
import json

def transcribe_with_whisperx(video_id: str, output_dir: str, mode: str = "whisperx") -> Optional[List[Dict]]:
    from config import config

    """Transcribe with WhisperX with proper diarization support"""
    print("⏳ Attempting WhisperX transcription using subprocess...")

    # Check if transcript already exists
    existing_transcript = check_transcript_exists(video_id, output_dir)
    if existing_transcript:
        print("📄 Using existing WhisperX transcription")
        return existing_transcript

    audio_dir = os.path.join(os.getcwd(), "data", "audio_clips")
    possible_files = list(Path(audio_dir).glob(f"{video_id}.*"))

    if not possible_files:
        print(f"❌ No audio file found for {video_id} in {audio_dir}")
        return None

    audio_file = str(possible_files[0])
    print(f"📥 Using audio file for WhisperX: {audio_file}")
    output_dir = config["transcript_output_dir"]
    os.makedirs(output_dir, exist_ok=True)

    # Get HF token from config or environment
    hf_token = config.get("hf_token")
    if hf_token == "your_huggingface_token_here" or not hf_token:
        # Try to get from environment variables
        hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
        if hf_token:
            print("🔑 Using HF token from environment variable")
            # Update config for future use
            config["hf_token"] = hf_token
        else:
            print("⚠️ No HF token found in config or environment variables")

    # Build WhisperX command
    command = [
        "whisperx",
        audio_file,
        "--output_format", "json",
        "--output_dir", output_dir,
        "--compute_type", "float32",
        "--device", config.get("diarization_device", "cpu"),
        "--model", "large",
        "--language", "en"
    ]

    # Add diarization if enabled and token available
    enable_diarization = config.get("enable_diarization", False)
    if enable_diarization:
        if hf_token and hf_token != "your_huggingface_token_here":
            command.extend(["--diarize", "--hf_token", hf_token])
            print("🎭 Diarization enabled with HF token")
            
            # Add min/max speakers if specified in config
            if config.get("min_speakers"):
                command.extend(["--min_speakers", str(config["min_speakers"])])
            if config.get("max_speakers"):
                command.extend(["--max_speakers", str(config["max_speakers"])])
        else:
            print("⚠️ Diarization enabled in config but no HF token provided - running without diarization")
            print("   Get a token from: https://huggingface.co/settings/tokens")
            print("   Set it in config['hf_token'] or environment variable HF_TOKEN")
    else:
        print("📝 Diarization disabled in config - running transcription only")

    print(f"🎤 Running WhisperX transcription on: {Path(audio_file).name}")
    # Don't print full command to avoid exposing token in logs

    try:
        subprocess.run(command, check=True)
        print(f"✅ WhisperX transcription complete. Output saved to {output_dir}")
        json_path = os.path.join(output_dir, f"{Path(audio_file).stem}.json")
        with open(json_path, "r", encoding="utf-8") as f:
            result = json.load(f)
        
        segments = result.get("segments", [])
        
        # Log diarization results if enabled
        if enable_diarization and hf_token:
            speakers_found = set()
            for segment in segments:
                speaker = segment.get("speaker")
                if speaker:
                    speakers_found.add(speaker)
            
            if speakers_found:
                print(f"🎭 Speakers detected: {', '.join(sorted(speakers_found))}")
            else:
                print("⚠️ Diarization was enabled but no speakers were detected")
        
        return segments
    except subprocess.CalledProcessError as err:
        print(f"❌ WhisperX failed: {err}")
        return None
