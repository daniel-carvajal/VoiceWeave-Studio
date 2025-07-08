import os, sys, re, subprocess, tempfile
from urllib.parse import urlparse, parse_qs
from typing import List, Dict
from dataclasses import asdict
from pathlib import Path
import json
import shutil

from rules.apply_segment_rules import apply_segment_rules
from rules.apply_text_rules import apply_text_rules
from util.translation_service import TranslationService 
from util.download_video import download_video
from util.fetch_transcript import fetch_transcript
from util.transcribe_with_whisperx import transcribe_with_whisperx
from util.normalize.normalize_whisperx_segments import normalize_whisperx_segments
from util.text_chunks_to_audio import text_chunks_to_audio
from util.merge_audio_with_video import merge_audio_with_video
from util.concatenate_audio import concatenate_audio
from util.audio_effects import apply_audio_effects

from checks.check_files_exist import check_audio_synthesis_exists
from checks.load_existing_segments_if_available import load_existing_segments_if_available

from structs.DubSegment import DubSegment

from config import config

from rules.load_dubbing_rules import load_dubbing_rules

from sync.create_enhanced_audio_track_with_loose_sync import create_enhanced_audio_track_with_loose_sync

try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded environment variables from .env file")
except ImportError:
    print("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")
except Exception as e:
    print(f"⚠️ Could not load .env file: {e}")

# Override config directories with environment variables if provided
if os.getenv("KOKORO_VIDEO_OUTPUT_DIR"):
    config["video_output_dir"] = os.getenv("KOKORO_VIDEO_OUTPUT_DIR")
if os.getenv("KOKORO_AUDIO_OUTPUT_DIR"):
    config["audio_output_dir"] = os.getenv("KOKORO_AUDIO_OUTPUT_DIR")
if os.getenv("KOKORO_TRANSCRIPT_OUTPUT_DIR"):
    config["transcript_output_dir"] = os.getenv("KOKORO_TRANSCRIPT_OUTPUT_DIR")

print(f"📁 Video output: {config['video_output_dir']}")
print(f"📁 Audio output: {config['audio_output_dir']}")
print(f"📁 Transcript output: {config['transcript_output_dir']}")

# Update config with environment variables if they exist
env_hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
if env_hf_token:
    config["hf_token"] = env_hf_token
    print("🔑 HF token loaded from environment")

# Enable diarization if HF token is available
if config.get("hf_token") and config["hf_token"] != "your_huggingface_token_here":
    config["enable_diarization"] = True
    print("🎭 Diarization automatically enabled (HF token found)")

def separate_stems(audio_path: str, background_output_path: str):
    """Separate vocals from background using demucs"""
    print("🎵 Separating vocals from background audio...")
    
    # Create temp directory for demucs output
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Run demucs with two-stems=vocals
        subprocess.run([
            "demucs", "--two-stems=vocals", "-o", temp_dir, audio_path
        ], check=True)
        
        # Find the background audio (no_vocals)
        audio_filename = os.path.splitext(os.path.basename(audio_path))[0]
        background_source = os.path.join(temp_dir, "htdemucs", audio_filename, "no_vocals.wav")
        
        if os.path.exists(background_source):
            # Copy to our output location
            shutil.copy2(background_source, background_output_path)
            print(f"✅ Background audio extracted: {background_output_path}")
            return True
        else:
            print("❌ Demucs separation failed - background file not found")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Demucs separation failed: {e}")
        return False
    finally:
        # Clean up temp directory
        shutil.rmtree(temp_dir, ignore_errors=True)

def create_enhanced_audio_track(segments: List[DubSegment], output_path: str, total_duration: float, audio_settings: Dict, background_audio_path: str = None):
    """Create audio track with enhanced transitions, rules applied, and background audio"""
    import tempfile
    
    print("🎯 Creating enhanced audio track with custom rules...")
    
    # Create a silent base track
    silent_track = os.path.join(tempfile.gettempdir(), "silent_base.wav")
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=duration={total_duration}:sample_rate=22050:channel_layout=mono",
        silent_track
    ], check=True, capture_output=True)
    
    # Calculate timing with enhanced logic
    timed_segments = []
    current_end_time = 0.0
    
    for i, segment in enumerate(segments):
        if not segment.audio_file or not os.path.exists(segment.audio_file):
            continue
            
        original_start = segment.start
        original_end = segment.end
        
        # Get actual duration of the synthesized audio
        try:
            result = subprocess.run([
                "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                "-of", "csv=p=0", segment.audio_file
            ], capture_output=True, text=True, check=True)
            audio_duration = float(result.stdout.strip())
        except:
            audio_duration = original_end - original_start
        
        # Enhanced timing logic with rules
        natural_start_time = current_end_time + segment.buffer_before
        
        # Apply audio settings
        if audio_settings.get("preventOverlaps", True):
            min_gap = audio_settings.get("minGap", 100) / 1000.0
            start_time = max(natural_start_time, current_end_time + min_gap)
        else:
            start_time = natural_start_time
        
        # Check for crossfade requirements
        should_crossfade = (
            audio_settings.get("globalCrossfade", False) or 
            segment.priority >= 2  # High priority segments get crossfade
        )
        
        if should_crossfade:
            crossfade_duration = audio_settings.get("crossfadeDuration", 150) / 1000.0
            start_time = max(0, start_time - crossfade_duration / 2)
        
        # Timing sync logic (every 3rd segment)
        should_sync_to_original = (
            original_start > current_end_time and 
            (original_start - current_end_time) < 2.0 and
            i % 3 == 0
        )
        
        if should_sync_to_original and not should_crossfade:
            start_time = original_start + 0.1
            print(f"   📍 Segment {i}: Syncing to original timing at {start_time:.2f}s")
        else:
            print(f"   ➡️  Segment {i}: Enhanced flow at {start_time:.2f}s")
        
        timed_segments.append({
            'segment': segment,
            'start_time': start_time,
            'duration': audio_duration,
            'crossfade': should_crossfade,
            'index': i
        })
        
        current_end_time = start_time + audio_duration + segment.buffer_after
    
    if not timed_segments:
        print("⚠️ No audio segments to process")
        return False
    
    # Build enhanced FFmpeg command with background audio support
    if background_audio_path and os.path.exists(background_audio_path):
        cmd = ["ffmpeg", "-y", "-i", background_audio_path, "-i", silent_track]
        background_input_index = 0
        audio_input_offset = 2  # Vocals start at input 2
        print(f"🎵 Including background audio: {background_audio_path}")
    else:
        cmd = ["ffmpeg", "-y", "-i", silent_track]
        background_input_index = None
        audio_input_offset = 1  # Vocals start at input 1
        print("🎵 No background audio - dubbed vocals only")
    
    # Add all audio files as inputs
    for ts in timed_segments:
        cmd.extend(["-i", ts['segment'].audio_file])
        
    # Build filter - delay all inputs then mix them
    filter_parts = []

    # Add all delayed inputs
    for i, ts in enumerate(timed_segments):
        input_index = i + audio_input_offset
        delay_ms = int(ts['start_time'] * 1000)
        print(f"🔍 DEBUG: Segment {i} delay = {delay_ms}ms ({ts['start_time']:.2f}s)")
        filter_parts.append(f"[{input_index}:a]adelay={delay_ms}|{delay_ms}[delayed{i}]")

    # Mix all delayed inputs together
    delayed_inputs = [f"[delayed{i}]" for i in range(len(timed_segments))]
    
    if background_input_index is not None:
        # Mix background with dubbed vocals (background at 30% volume, vocals at 100%)
        background_weight = audio_settings.get("backgroundVolume", 0.3)
        vocal_weights = " ".join(["1.0"] * len(timed_segments))
        mix_filter = f"[{background_input_index}:a]" + "".join(delayed_inputs) + f"amix=inputs={len(timed_segments)+1}:duration=longest:weights={background_weight} {vocal_weights}[final]"
    else:
        mix_filter = "".join(delayed_inputs) + f"amix=inputs={len(timed_segments)}:duration=longest[final]"
    
    filter_parts.append(mix_filter)

    filter_complex = ";".join(filter_parts)
    final_output = "[final]"
    
    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", final_output,
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        output_path
    ])
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"✅ Enhanced audio track created: {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Enhanced audio creation failed, falling back to simple method: {e}")
        return False
    
def update_config_for_loose_sync():
    """Add IMPROVED loose sync settings to your config"""
    config["looseSyncSettings"] = {
        "sync_on_speaker_change": True,     # Sync when speaker changes
        "sync_tolerance_window": 1.5,       # 150% window around original timing (increased)
        "min_gap_seconds": 0.05,            # Smaller minimum gap (reduced from 0.1)
        "max_drift_seconds": 2.0,           # Max drift before forced sync (reduced from 3.0)
        "sync_every_n_segments": 3,         # Force sync every N segments (reduced from 4)
        "force_sync_threshold": 1.5,        # Force sync if drift > 1.5s (new)
        "early_segment_boost": True,        # Be more aggressive with early segments (new)
        "backgroundVolume": 0.3,            # Background audio volume (30%)
    }
    return config

def print_timing_summary(timed_segments: List[Dict]):
    """Print a summary of the timing decisions"""
    total_segments = len(timed_segments)
    synced_segments = sum(1 for ts in timed_segments if ts['synced'])
    
    print(f"\n📊 Timing Summary:")
    print(f"   Total segments: {total_segments}")
    print(f"   Synced segments: {synced_segments} ({synced_segments/total_segments*100:.1f}%)")
    
    # Group by sync reasons
    sync_reasons = {}
    for ts in timed_segments:
        if ts['synced'] and ts['sync_reason']:
            reason = ts['sync_reason']
            sync_reasons[reason] = sync_reasons.get(reason, 0) + 1
    
    if sync_reasons:
        print("   Sync triggers:")
        for reason, count in sync_reasons.items():
            print(f"     - {reason}: {count} times")
    
    # Show largest drifts
    max_positive_drift = max((ts['drift'] for ts in timed_segments), default=0)
    max_negative_drift = min((ts['drift'] for ts in timed_segments), default=0)
    
    print(f"   Max drift: +{max_positive_drift:.2f}s / {max_negative_drift:.2f}s")
    print(f"   ✅ No overlaps guaranteed, loose sync maintained\n")

def extract_video_id(url_or_id: str) -> str:
    # If it's already a YouTube ID (11 chars, alphanumeric, typical format)
    if re.match(r"^[\w-]{11}$", url_or_id):
        return url_or_id

    # Try parsing the URL
    parsed = urlparse(url_or_id)
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        query = parse_qs(parsed.query)
        return query.get("v", [None])[0]
    elif parsed.hostname == "youtu.be":
        return parsed.path.lstrip("/")
    else:
        return None  # Invalid format

def main(youtube_url_or_id: str, target_lang: str = "es"):
    video_id = extract_video_id(youtube_url_or_id)
    if not video_id:
        print("❌ Could not extract a valid YouTube video ID.")
        sys.exit(1)

    print(f"🎥 Extracted video ID: {video_id}")

    # Download video only if it doesn't exist
    video_path = download_video(youtube_url_or_id, video_id)

    # Prepare audio output directory
    audio_dir = config["audio_output_dir"]
    os.makedirs(audio_dir, exist_ok=True)

    if video_path and os.path.exists(video_path):
        # Debug original duration
        try:
            result = subprocess.run([
                "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                "-of", "csv=p=0", video_path
            ], capture_output=True, text=True, check=True)
            original_duration = float(result.stdout.strip())
            print(f"🔍 DEBUG: ORIGINAL video duration: {original_duration:.2f}s ({original_duration/60:.1f} min)")
        except Exception as e:
            print(f"🔍 DEBUG: Could not get original video duration: {e}")

        # Extract audio from video for stem separation
        original_audio_path = os.path.join(audio_dir, f"{video_id}_original_audio.wav")
        print("🎵 Extracting audio from video...")
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le", 
            "-ar", "44100", "-ac", "2", original_audio_path
        ], check=True)
        
        # Run demucs stem separation
        background_audio_path = os.path.join(audio_dir, f"{video_id}_background.wav")
        stem_success = separate_stems(original_audio_path, background_audio_path)
        
        if not stem_success:
            print("⚠️ Stem separation failed, proceeding without background audio")
            background_audio_path = None

        # 🔥 SIMPLE VERSION: Copy to input folder only
        original_filename = os.path.basename(video_path)
        input_video_dir = "./input"
        os.makedirs(input_video_dir, exist_ok=True)
        input_video_path = os.path.join(input_video_dir, f"{video_id}_original{os.path.splitext(original_filename)[1]}")

        print(f"📁 Copying original video to input folder...")
        shutil.copy2(video_path, input_video_path)

        if os.path.exists(input_video_path):
            file_size = os.path.getsize(input_video_path)
            print(f"✅ Original video saved: {input_video_path} ({file_size / (1024*1024):.1f} MB)")
        else:
            print(f"❌ Failed to copy original video")
    else:
        background_audio_path = None

    print(f"🔍 DEBUG: video_path returned: {video_path}")
    print(f"🔍 DEBUG: config['video_output_dir']: {config['video_output_dir']}")
    print(f"🔍 DEBUG: Current working directory: {os.getcwd()}")

    if not video_path:
        print("❌ Could not download or find video file.")
        sys.exit(1)

    force_whisperx = config.get("force_whisperx", True)

    if not force_whisperx:
        transcript = fetch_transcript(video_id, output_dir=config["transcript_output_dir"], mode="human")
        if not transcript:
            print("⚠️ No transcript data. Attempting to transcribe with WhisperX.")
            return
    else:
        print("⚙️ Force WhisperX mode enabled — checking for existing transcription first.")
        transcript = transcribe_with_whisperx(video_id, output_dir=config["transcript_output_dir"], mode="whisperx")

    if not transcript:
        print("❌ Could not obtain transcript data.")
        return

    segments = normalize_whisperx_segments(transcript)

    # Load dubbing rules from GUI
    dubbing_rules = load_dubbing_rules()
    
    # Apply segment rules for timing and transitions
    segments = apply_segment_rules(segments, dubbing_rules.get("segmentRules", []))

    # Check if we can reuse existing segments and audio synthesis
    segments = load_existing_segments_if_available(video_id, segments, audio_dir)
    synthesis_exists, existing_audio_paths = check_audio_synthesis_exists(video_id, segments, audio_dir)
    print(f"🔍 DEBUG: synthesis_exists = {synthesis_exists}")
    print(f"🔍 DEBUG: existing_audio_paths = {existing_audio_paths}")
    print(f"🔍 DEBUG: segments file path = {Path(audio_dir) / f'{video_id}_segments.json'}")
    print(f"🔍 DEBUG: segments file exists = {os.path.exists(Path(audio_dir) / f'{video_id}_segments.json')}")

    if synthesis_exists:
        print("🎯 Reusing existing audio synthesis")
        audio_paths = existing_audio_paths
        
        # Save updated segment metadata (in case of any changes)
        segment_data_path = Path(audio_dir) / f"{video_id}_segments.json"
        with open(segment_data_path, "w", encoding="utf-8") as f:
            json.dump([asdict(seg) for seg in segments], f, indent=2, ensure_ascii=False)
        print(f"📝 Updated segment metadata saved to {segment_data_path}")
    else:
        # Need to translate and/or synthesize
        print("🔄 Processing segments (translation and/or synthesis needed)")
        
        # Check if we need translation (if translated_text is empty)
        needs_translation = any(not seg.translated_text for seg in segments)
        if needs_translation:
            # Pass the config to the translation service
            translator = TranslationService(config=config)
            segments = translator.translate_segments(segments)
        else:
            print("✅ Using existing translations")

        # Apply text replacement rules to translations
        text_rules = dubbing_rules.get("textRules", [])
        if text_rules:
            print("📝 Applying text replacement rules...")
            for segment in segments:
                if segment.translated_text:
                    segment.translated_text = apply_text_rules(
                        segment.translated_text, 
                        config["target_language"], 
                        text_rules
                    )

        # Save segment metadata before synthesis
        segment_data_path = Path(audio_dir) / f"{video_id}_segments.json"
        with open(segment_data_path, "w", encoding="utf-8") as f:
            json.dump([asdict(seg) for seg in segments], f, indent=2, ensure_ascii=False)
        print(f"📝 Segment metadata saved to {segment_data_path}")

        print("🧠 Synthesizing transcript chunks via Kokoro...")

        audio_paths = []
        text_chunks_to_audio(segments, audio_dir, audio_paths)

        # Save updated segment metadata AFTER synthesis
        segment_data_path = Path(audio_dir) / f"{video_id}_segments.json"
        with open(segment_data_path, "w", encoding="utf-8") as f:
            json.dump([asdict(seg) for seg in segments], f, indent=2, ensure_ascii=False)
        print(f"📝 Updated segment metadata saved to {segment_data_path}")

    final_audio_path = os.path.join(audio_dir, f"{video_id}_dubbed.mp3")

    # Add loose sync settings to config
    config.update(update_config_for_loose_sync())

    # Enhanced audio creation with loose sync and background audio
    audio_settings = dubbing_rules.get("audioSettings", {})
    if video_path and segments:
        try:
            # Get total video duration
            result = subprocess.run([
                "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                "-of", "csv=p=0", video_path
            ], capture_output=True, text=True, check=True)
            total_duration = float(result.stdout.strip())
            
            # Use enhanced audio creation with loose sync and background audio
            if create_enhanced_audio_track_with_loose_sync(segments, final_audio_path, total_duration, audio_settings, background_audio_path):
                print(f"🎬 Enhanced audio with loose sync and background saved to {final_audio_path}")

                # Apply audio effects
                preset = config.get("audio_effects_preset", "voice")
                if preset != "off":
                    effects_audio_path = os.path.join(audio_dir, f"{video_id}_dubbed_effects.mp3")
                    if apply_audio_effects(final_audio_path, effects_audio_path, preset):
                        final_audio_path = effects_audio_path
            else:
                # Fallback to simple concatenation
                concatenate_audio(audio_paths, final_audio_path)
                print(f"🎬 Final audio saved to {final_audio_path}")
        except Exception as e:
            print(f"⚠️ Enhanced audio creation failed: {e}")
            concatenate_audio(audio_paths, final_audio_path)
            print(f"🎬 Final audio saved to {final_audio_path}")
    else:
        # Use simple concatenation
        concatenate_audio(audio_paths, final_audio_path)
        print(f"🎬 Final audio saved to {final_audio_path}")

    # Use the actual downloaded video path
    dubbed_video_path = os.path.join(audio_dir, f"{video_id}_dubbed_video.mp4")
    merge_audio_with_video(video_path, final_audio_path, dubbed_video_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python dubbing_pipeline.py <YouTube_URL_or_ID> [target_lang_code]")
        sys.exit(1)

    url = sys.argv[1]
    target_lang = sys.argv[2] if len(sys.argv) > 2 else "es"
    main(url, target_lang)