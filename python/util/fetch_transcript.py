import json
import os
from pathlib import Path
import subprocess
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter

from checks.check_files_exist import check_transcript_exists

def fetch_transcript(video_id: str, output_dir: str, mode: str = "prompt"):
    """Fetch transcript, checking for existing files first"""
    print(f"Fetching transcript for video ID: {video_id} in mode: {mode}")
    
    # Check if transcript already exists
    existing_transcript = check_transcript_exists(video_id, output_dir)
    if existing_transcript:
        print("📄 Using existing transcript file")
        return existing_transcript
    
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        try:
            transcript = transcript_list.find_manually_created_transcript(['en'])
            print("✅ Found human-created transcript.")
        except Exception:
            print("⚠️ No human transcript found. Trying auto-generated...")
            transcript = transcript_list.find_generated_transcript(['en'])
            print("✅ Found auto-generated transcript.")
        data = transcript.fetch()
        if not data or len(data) == 0:
            raise ValueError("Empty transcript returned by fetch()")
        os.makedirs(output_dir, exist_ok=True)
        suffix = "human" if not transcript.is_generated else "generated"
        out_path = os.path.join(output_dir, f"{video_id}_{suffix}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json_str = JSONFormatter().format_transcript(data, indent=2)
            f.write(json_str)
        print(f"✅ Transcript saved to {out_path}")
        return data
    except Exception as e:
        print(f"❌ Error fetching transcript: {e}")
        print("⏳ Attempting WhisperX transcription using subprocess...")

        # Dynamically find the original downloaded audio
        audio_dir = os.path.join(os.getcwd(), "data", "audio_clips")
        possible_files = list(Path(audio_dir).glob(f"{video_id}.*"))

        if not possible_files:
            print(f"❌ No audio file found for {video_id} in {audio_dir}")
            return None

        audio_file = str(possible_files[0])
        print(f"📥 Using audio file for WhisperX: {audio_file}")
        output_dir = config["transcript_output_dir"]
        os.makedirs(output_dir, exist_ok=True)

        command = [
            "whisperx",
            audio_file,
            "--output_format", "json",
            "--output_dir", output_dir,
            "--compute_type", "float32",
            "--device", "cpu",
            "--model", "large",
            "--language", "en"
        ]

        try:
            subprocess.run(command, check=True)
            print(f"✅ WhisperX transcription complete. Output saved to {output_dir}")
            json_path = os.path.join(output_dir, f"{Path(audio_file).stem}.json")
            with open(json_path, "r", encoding="utf-8") as f:
                result = json.load(f)
            return result.get("segments", [])
        except subprocess.CalledProcessError as err:
            print(f"❌ WhisperX failed: {err}")
            return None
