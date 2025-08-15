import os

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded environment variables from .env file")
except ImportError:
    print("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")
except Exception as e:
    print(f"⚠️ Could not load .env file: {e}")


kokoro_available_voices = {
    "es": ["ef_dora", "em_alex", "em_santa"]  # Available Spanish voices
}

config = {
    # Text-to-Speech
    "target_language": "es",  # Default target language for translation
    "kokoro_endpoint": "http://localhost:8880",  # Kokoro API endpoint
    "kokoro_speed": 1.1,  # Default speed for Kokoro synthesis
    "yt_dlp_path": "yt-dlp",  # Path to yt-dlp executable
    "transcript_output_dir": os.path.join(os.getcwd(), "data", "transcripts"), # Directory to save transcripts
    "audio_output_dir": os.path.join(os.getcwd(), "output", "kokoro_audio"),
    "force_whisperx": True,  # Force WhisperX transcription mode
    "rules_file": "text-rules.json",  # Path to rules file from GUI
    "kokoro_default_voice": kokoro_available_voices["es"][1],  # Default voice for Kokoro synthesis
    "overwrite_segments_json": False,

    # Diarization
    "enable_diarization": True,  # Set to False to disable completely
    "hf_token": "your_huggingface_token_here",
    "diarization_device": "cpu",  # or "cuda" if you have GPU
    "min_speakers": None,  # Set to number if you know exact speaker count
    "max_speakers": None,  # Set to limit max speakers detected

    # Translation
    "llm_judge_enabled": True,  # Enable LLM judge for translation quality
    "qwen_endpoint": "http://127.0.0.1:1234",  # Qwen API endpoint
    "judge_model": "qwen/qwen3-14b",           # Model for LLM judge

    # Audio Output
    "output_volume": 2,           # Volume multiplier (1.0 = original, 2.0 = 2x louder)
    "normalize_audio": False,        # Enable professional audio normalization
    "audio_quality": "128k",        # Audio bitrate (128k, 192k, 256k, 320k)
    "audio_sample_rate": 22050,     # Sample rate (22050, 44100, 48000)
    "prevent_clipping": True,       # Enable limiter to prevent distortion
    "background_volume": 0.7,  # Background audio volume (0.0 to 1.0)
    "vocal_volume": 1,       # Dubbed vocals volume (0.0 to 2.0+)

    # Audio Effects
    "audio_effects_preset": "voice",  # "voice", "podcast", "cinematic", "clean", or "off"

    # Add to config dictionary:
    "claude_api_key": "your_anthropic_key_here", 
    "translation_batch_size": 8,  # Process 8 segments at once
    "translation_context_size": 3,  # Include 3 previous segments for context
}


# Override config directories with environment variables if provided
# File Directories
if os.getenv("KOKORO_VIDEO_OUTPUT_DIR"):
    config["video_output_dir"] = os.getenv("KOKORO_VIDEO_OUTPUT_DIR")
if os.getenv("KOKORO_AUDIO_OUTPUT_DIR"):
    config["audio_output_dir"] = os.getenv("KOKORO_AUDIO_OUTPUT_DIR")
if os.getenv("KOKORO_TRANSCRIPT_OUTPUT_DIR"):
    config["transcript_output_dir"] = os.getenv("KOKORO_TRANSCRIPT_OUTPUT_DIR")
    
# API Key
if os.getenv("ANTHROPIC_API_KEY"):
    config["claude_api_key"] = os.getenv("ANTHROPIC_API_KEY")
if os.getenv("HF_TOKEN"):
    config["hf_token"] = os.getenv("HF_TOKEN")