import os

kokoro_available_voices = {
    "es": ["ef_dora", "em_alex", "em_santa"]  # Available Spanish voices
}

config = {
    "target_language": "es",  # Default target language for translation
    "kokoro_endpoint": "http://localhost:8880",  # Kokoro API endpoint
    "kokoro_speed": 1.1,  # Default speed for Kokoro synthesis
    "yt_dlp_path": "yt-dlp",  # Path to yt-dlp executable
    "transcript_output_dir": os.path.join(os.getcwd(), "data", "transcripts"), # Directory to save transcripts
    "audio_output_dir": os.path.join(os.getcwd(), "output", "kokoro_audio"),
    "force_whisperx": True,  # Force WhisperX transcription mode
    "rules_file": "text-rules.json",  # Path to rules file from GUI
    "kokoro_voice": kokoro_available_voices["es"][1],  # Default voice for Kokoro synthesis

    # Diarization settings
    "enable_diarization": True,  # Set to False to disable completely
    "hf_token": "your_huggingface_token_here",  # Your HF token
    "diarization_device": "cpu",  # or "cuda" if you have GPU
    "min_speakers": None,  # Set to number if you know exact speaker count
    "max_speakers": None,  # Set to limit max speakers detected

    # Translation settings
    "llm_judge_enabled": True,  # Enable LLM judge for translation quality
    "qwen_endpoint": "http://127.0.0.1:1234",  # Qwen API endpoint
    "judge_model": "qwen/qwen3-14b",           # Model for LLM judge

    # Audio Output Settings
    "output_volume": 2,           # Volume multiplier (1.0 = original, 2.0 = 2x louder)
    "normalize_audio": False,        # Enable professional audio normalization
    "audio_quality": "128k",        # Audio bitrate (128k, 192k, 256k, 320k)
    "audio_sample_rate": 22050,     # Sample rate (22050, 44100, 48000)
    "prevent_clipping": True,       # Enable limiter to prevent distortion

    # Audio Effects Settings
    "audio_effects_preset": "voice",  # "voice", "podcast", "cinematic", "clean", or "off"
}