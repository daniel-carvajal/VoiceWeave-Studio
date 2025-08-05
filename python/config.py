import os

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
    "kokoro_voice": kokoro_available_voices["es"][1],  # Default voice for Kokoro synthesis

    # Diarization
    "enable_diarization": True,  # Set to False to disable completely
    "hf_token": "your_huggingface_token_here",  # Your HF token
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
    "claude_api_key": None,  # Will be read from ANTHROPIC_API_KEY env var
    "translation_batch_size": 8,  # Process 8 segments at once
    "translation_context_size": 3,  # Include 3 previous segments for context
}