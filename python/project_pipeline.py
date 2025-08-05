#!/usr/bin/env python3
"""
Project-based dubbing pipeline for Kokoro Studio
Handles step-by-step execution with project persistence
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse, parse_qs
from dataclasses import asdict
import logging
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import the original pipeline components
try:
    from util.download_video import download_video
    from util.fetch_transcript import fetch_transcript
    from util.transcribe_with_whisperx import transcribe_with_whisperx
    from util.normalize.normalize_whisperx_segments import normalize_whisperx_segments
    from util.translation_service import TranslationService
    from util.text_chunks_to_audio import text_chunks_to_audio
    from util.merge_audio_with_video import merge_audio_with_video
    from util.concatenate_audio import concatenate_audio
    from util.audio_effects import apply_audio_effects
    from rules.apply_segment_rules import apply_segment_rules
    from rules.apply_text_rules import apply_text_rules
    from rules.load_dubbing_rules import load_dubbing_rules
    from checks.check_files_exist import check_audio_synthesis_exists
    from checks.load_existing_segments_if_available import load_existing_segments_if_available
    from sync.create_enhanced_audio_track_with_loose_sync import create_enhanced_audio_track_with_loose_sync
    from structs.DubSegment import DubSegment
    from config import config
except ImportError as e:
    logger.warning(f"Could not import original pipeline components: {e}")
    logger.info("Running in standalone mode - some features may be limited")

def extract_video_id(url_or_id: str) -> str:
    """Extract YouTube video ID from URL or return ID if already provided"""
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

class ProjectPipeline:
    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.project_config_path = self.project_dir / "project.json"
        self.project_config = self.load_project_config()
        
        # Setup output directories
        self.input_dir = self.project_dir / "input"
        self.transcripts_dir = self.project_dir / "transcripts"
        self.audio_dir = self.project_dir / "audio"
        self.output_dir = self.project_dir / "output"
        
        # Ensure directories exist
        for dir_path in [self.input_dir, self.transcripts_dir, self.audio_dir, self.output_dir]:
            dir_path.mkdir(exist_ok=True)
            
        # Load environment variables
        self.load_environment()
    
    def load_environment(self):
        """Load environment variables and update config"""
        try:
            from dotenv import load_dotenv
            load_dotenv()
            logger.info("✅ Loaded environment variables from .env file")
        except ImportError:
            logger.warning("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")
        except Exception as e:
            logger.warning(f"⚠️ Could not load .env file: {e}")

        # Update config with environment variables if they exist
        env_hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
        if env_hf_token and 'config' in globals():
            config["hf_token"] = env_hf_token
            logger.info("🔑 HF token loaded from environment")
            
            # Enable diarization if HF token is available
            if config.get("hf_token") and config["hf_token"] != "your_huggingface_token_here":
                config["enable_diarization"] = True
                logger.info("🎭 Diarization automatically enabled (HF token found)")
    
    def load_project_config(self) -> Dict[str, Any]:
        """Load project configuration from project.json"""
        if not self.project_config_path.exists():
            raise FileNotFoundError(f"Project config not found: {self.project_config_path}")
        
        with open(self.project_config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def save_project_config(self):
        """Save updated project configuration"""
        with open(self.project_config_path, 'w', encoding='utf-8') as f:
            json.dump(self.project_config, f, indent=2, ensure_ascii=False)
    
    def update_step_completion(self, step: str, completed: bool = True):
        """Update completion status for a pipeline step"""
        if "completedSteps" not in self.project_config:
            self.project_config["completedSteps"] = {}
        
        self.project_config["completedSteps"][step] = completed
        self.project_config["lastModified"] = self.get_current_timestamp()
        self.save_project_config()
        
        logger.info(f"✅ Step '{step}' marked as {'completed' if completed else 'incomplete'}")

    def get_current_timestamp(self) -> str:
        """Get current timestamp in ISO 8601 format"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    def get_video_id(self) -> str:
        """Get video ID from project config"""
        return self.project_config.get("videoId", "unknown")
    
    def get_target_language(self) -> str:
        """Get target language from project config"""
        return self.project_config.get("targetLanguage", "es")
    
    def get_source_url(self) -> str:
        """Get source URL from project config"""
        return self.project_config.get("sourceUrl", "")
    
    def step_download(self) -> Dict[str, Any]:
        """Step 1: Download/Import Media"""
        logger.info("🎬 Starting download step...")
        
        source_type = self.project_config.get("sourceType")
        
        try:
            if source_type == "youtube":
                source_url = self.get_source_url()
                video_id = extract_video_id(source_url)
                
                if not source_url or not video_id:
                    raise ValueError("No valid YouTube URL found in project config")
                
                logger.info(f"🎥 Extracted video ID: {video_id}")
                
                # Use the actual download_video function
                if 'download_video' in globals():
                    # Update config to use project directories
                    original_video_dir = config.get("video_output_dir", "videos")
                    config["video_output_dir"] = str(self.input_dir)
                    
                    video_path = download_video(source_url, video_id)
                    
                    # Restore original config
                    config["video_output_dir"] = original_video_dir
                    
                    if not video_path:
                        raise Exception("Could not download video file")
                    
                    # Update file reference in project config
                    video_filename = os.path.basename(video_path)
                    self.project_config["fileReferences"]["videoFile"] = {
                        "path": f"input/{video_filename}",
                        "isLinked": False,
                        "size": os.path.getsize(video_path) if os.path.exists(video_path) else 0,
                        "lastModified": self.get_current_timestamp()
                    }
                    
                    result = {
                        "success": True,
                        "videoPath": video_path,
                        "videoId": video_id,
                        "message": f"✅ Downloaded video: {video_filename}"
                    }
                else:
                    # Fallback: use yt-dlp directly
                    video_filename = f"{video_id}.mp4"
                    video_path = self.input_dir / video_filename
                    
                    cmd = [
                        "yt-dlp",
                        "-f", "best[ext=mp4]",
                        "-o", str(video_path),
                        source_url
                    ]
                    
                    subprocess.run(cmd, check=True, capture_output=True)
                    
                    if not video_path.exists():
                        raise Exception("Video download failed")
                    
                    self.project_config["fileReferences"]["videoFile"] = {
                        "path": f"input/{video_filename}",
                        "isLinked": False,
                        "size": video_path.stat().st_size,
                        "lastModified": self.get_current_timestamp()
                    }
                    
                    result = {
                        "success": True,
                        "videoPath": str(video_path),
                        "videoId": video_id,
                        "message": f"✅ Downloaded video: {video_filename}"
                    }
                
            elif source_type in ["video", "audio"]:
                # File should already be linked or copied
                file_ref = self.project_config["fileReferences"].get(
                    "videoFile" if source_type == "video" else "audioFile"
                )
                
                if not file_ref:
                    raise ValueError("No file reference found in project config")
                
                if file_ref["isLinked"]:
                    # File is still linked, verify it exists
                    source_path = file_ref["path"]
                    if not os.path.exists(source_path):
                        raise FileNotFoundError(f"Linked file not found: {source_path}")
                    
                    result = {
                        "success": True,
                        "videoPath": source_path,
                        "videoId": self.get_video_id(),
                        "message": f"✅ Using linked file: {os.path.basename(source_path)}"
                    }
                else:
                    # File is copied to project
                    file_path = self.project_dir / file_ref["path"]
                    if not file_path.exists():
                        raise FileNotFoundError(f"Project file not found: {file_path}")
                    
                    result = {
                        "success": True,
                        "videoPath": str(file_path),
                        "videoId": self.get_video_id(),
                        "message": f"✅ Using project file: {file_path.name}"
                    }
            else:
                raise ValueError(f"Unknown source type: {source_type}")
            
            self.update_step_completion("download", True)
            return result
            
        except Exception as e:
            logger.error(f"❌ Download step failed: {e}")
            self.update_step_completion("download", False)
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Download failed: {e}"
            }
    
    def step_transcribe(self) -> Dict[str, Any]:
        """Step 2: Generate Transcript"""
        logger.info("🎤 Starting transcription step...")
        
        try:
            video_id = self.get_video_id()
            source_url = self.get_source_url()
            
            # Update config to use project directories
            original_transcript_dir = config.get("transcript_output_dir", "transcripts")
            config["transcript_output_dir"] = str(self.transcripts_dir)
            
            force_whisperx = config.get("force_whisperx", True)
            transcript = None
            
            if not force_whisperx and 'fetch_transcript' in globals():
                # Try to fetch existing transcript first
                transcript = fetch_transcript(video_id, output_dir=str(self.transcripts_dir), mode="human")
                if transcript:
                    logger.info("✅ Found existing human transcript")
            
            if not transcript and 'transcribe_with_whisperx' in globals():
                logger.info("⚙️ Transcribing with WhisperX...")
                transcript = transcribe_with_whisperx(video_id, output_dir=str(self.transcripts_dir), mode="whisperx")
            
            if not transcript:
                raise Exception("Could not obtain transcript data")
            
            # Normalize segments
            if 'normalize_whisperx_segments' in globals():
                segments = normalize_whisperx_segments(transcript)
            else:
                # Fallback: assume transcript is already in the right format
                segments = transcript
            
            # Save segments to project
            segments_path = self.transcripts_dir / f"{video_id}_segments.json"
            
            # Convert segments to dict format if they're DubSegment objects
            if segments and hasattr(segments[0], '__dict__'):
                segment_data = [asdict(seg) if hasattr(asdict, '__call__') and hasattr(seg, '__dict__') 
                              else seg.__dict__ for seg in segments]
            else:
                segment_data = segments
            
            with open(segments_path, 'w', encoding='utf-8') as f:
                json.dump(segment_data, f, indent=2, ensure_ascii=False)
            
            # Update project config
            self.project_config["fileReferences"]["finalAudio"] = f"audio/{final_audio_path.name}"
            self.project_config["fileReferences"]["finalVideo"] = f"output/{final_video_path.name}"
            
            result = {
                "success": True,
                "finalVideoPath": str(final_video_path),
                "finalAudioPath": str(final_audio_path),
                "videoDuration": total_duration,
                "message": f"✅ Final video created: {final_video_path.name}"
            }
            
            self.update_step_completion("combine", True)
            return result
            
        except Exception as e:
            logger.error(f"❌ Final assembly step failed: {e}")
            self.update_step_completion("combine", False)
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Final assembly failed: {e}"
            }

def setup_project_config():
    """Setup project-specific config overrides"""
    if 'config' not in globals():
        return
        
    # These will be overridden by the project pipeline as needed
    project_config_defaults = {
        "force_whisperx": True,
        "audio_effects_preset": "voice",
        "target_language": "es"
    }
    
    for key, value in project_config_defaults.items():
        if key not in config:
            config[key] = value

def main():
    parser = argparse.ArgumentParser(description="Kokoro Studio Project Pipeline")
    parser.add_argument("project_dir", help="Project directory path")
    parser.add_argument("step", choices=["download", "transcribe", "translate", "synthesize", "combine"], 
                       help="Pipeline step to execute")
    
    args = parser.parse_args()
    
    try:
        # Setup config defaults
        setup_project_config()
        
        pipeline = ProjectPipeline(args.project_dir)
        
        # Execute the requested step
        if args.step == "download":
            result = pipeline.step_download()
        elif args.step == "transcribe":
            result = pipeline.step_transcribe()
        elif args.step == "translate":
            result = pipeline.step_translate()
        elif args.step == "synthesize":
            result = pipeline.step_synthesize()
        elif args.step == "combine":
            result = pipeline.step_combine()
        
        # Output result as JSON for Go to parse
        print(json.dumps(result, indent=2))
        
        # Exit with appropriate code
        sys.exit(0 if result["success"] else 1)
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "message": f"❌ Pipeline failed: {e}"
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()fileReferences"]["segmentsFile"] = f"transcripts/{video_id}_segments.json"
            
            # Restore original config
            config["transcript_output_dir"] = original_transcript_dir
            
            result = {
                "success": True,
                "segmentsCount": len(segments),
                "segmentsPath": str(segments_path),
                "message": f"✅ Generated {len(segments)} transcript segments"
            }
            
            self.update_step_completion("transcribe", True)
            return result
            
        except Exception as e:
            logger.error(f"❌ Transcription step failed: {e}")
            self.update_step_completion("transcribe", False)
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Transcription failed: {e}"
            }
    
    def step_translate(self) -> Dict[str, Any]:
        """Step 3: Translate Text"""
        logger.info("🌐 Starting translation step...")
        
        try:
            video_id = self.get_video_id()
            target_lang = self.get_target_language()
            
            # Load segments
            segments_path = self.transcripts_dir / f"{video_id}_segments.json"
            if not segments_path.exists():
                raise FileNotFoundError("Segments file not found. Run transcription first.")
            
            with open(segments_path, 'r', encoding='utf-8') as f:
                segment_data = json.load(f)
            
            # Convert back to DubSegment objects if the class is available
            if 'DubSegment' in globals():
                segments = []
                for data in segment_data:
                    if isinstance(data, dict):
                        # Create DubSegment from dict
                        segment = DubSegment(
                            start=data.get('start', 0),
                            end=data.get('end', 0),
                            original_text=data.get('original_text', ''),
                            translated_text=data.get('translated_text', ''),
                            target_duration=data.get('target_duration', 0)
                        )
                        # Copy any additional attributes
                        for key, value in data.items():
                            if hasattr(segment, key):
                                setattr(segment, key, value)
                        segments.append(segment)
                    else:
                        segments.append(data)
            else:
                segments = segment_data
            
            # Check if we need translation
            needs_translation = True
            if isinstance(segments[0], dict):
                needs_translation = any(not seg.get('translated_text', '') for seg in segments)
            else:
                needs_translation = any(not getattr(seg, 'translated_text', '') for seg in segments)
            
            if needs_translation and 'TranslationService' in globals():
                # Use the actual translation service
                translator = TranslationService(config=config if 'config' in globals() else {})
                segments = translator.translate_segments(segments)
                logger.info(f"✅ Translated segments using TranslationService")
            elif needs_translation:
                # Fallback translation (placeholder)
                logger.warning("TranslationService not available, using placeholder translation")
                for i, segment in enumerate(segments):
                    if isinstance(segment, dict):
                        if not segment.get('translated_text', ''):
                            segment['translated_text'] = f"[{target_lang.upper()}] {segment.get('original_text', '')}"
                    else:
                        if not getattr(segment, 'translated_text', ''):
                            segment.translated_text = f"[{target_lang.upper()}] {getattr(segment, 'original_text', '')}"
            
            # Apply text replacement rules if available
            if 'load_dubbing_rules' in globals() and 'apply_text_rules' in globals():
                dubbing_rules = load_dubbing_rules()
                text_rules = dubbing_rules.get("textRules", [])
                if text_rules:
                    logger.info("📝 Applying text replacement rules...")
                    for segment in segments:
                        if isinstance(segment, dict):
                            if segment.get('translated_text'):
                                segment['translated_text'] = apply_text_rules(
                                    segment['translated_text'], 
                                    target_lang, 
                                    text_rules
                                )
                        else:
                            if getattr(segment, 'translated_text', ''):
                                segment.translated_text = apply_text_rules(
                                    segment.translated_text, 
                                    target_lang, 
                                    text_rules
                                )
            
            # Save updated segments
            if hasattr(segments[0], '__dict__'):
                segment_data = [asdict(seg) if hasattr(asdict, '__call__') else seg.__dict__ for seg in segments]
            else:
                segment_data = segments
                
            with open(segments_path, 'w', encoding='utf-8') as f:
                json.dump(segment_data, f, indent=2, ensure_ascii=False)
            
            translated_count = 0
            for seg in segment_data:
                if isinstance(seg, dict) and seg.get('translated_text'):
                    translated_count += 1
                elif hasattr(seg, 'translated_text') and getattr(seg, 'translated_text'):
                    translated_count += 1
            
            result = {
                "success": True,
                "segmentsCount": len(segments),
                "translatedCount": translated_count,
                "message": f"✅ Translated {translated_count} segments to {target_lang.upper()}"
            }
            
            self.update_step_completion("translate", True)
            return result
            
        except Exception as e:
            logger.error(f"❌ Translation step failed: {e}")
            self.update_step_completion("translate", False)
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Translation failed: {e}"
            }
    
    def step_synthesize(self) -> Dict[str, Any]:
        """Step 4: Generate Voice Synthesis"""
        logger.info("🧠 Starting voice synthesis step...")
        
        try:
            video_id = self.get_video_id()
            
            # Load segments
            segments_path = self.transcripts_dir / f"{video_id}_segments.json"
            with open(segments_path, 'r', encoding='utf-8') as f:
                segment_data = json.load(f)
            
            # Convert back to DubSegment objects if available
            if 'DubSegment' in globals():
                segments = []
                for data in segment_data:
                    if isinstance(data, dict):
                        segment = DubSegment(
                            start=data.get('start', 0),
                            end=data.get('end', 0),
                            original_text=data.get('original_text', ''),
                            translated_text=data.get('translated_text', ''),
                            target_duration=data.get('target_duration', 0)
                        )
                        for key, value in data.items():
                            if hasattr(segment, key):
                                setattr(segment, key, value)
                        segments.append(segment)
                    else:
                        segments.append(data)
            else:
                segments = segment_data
            
            # Apply segment rules if available
            if 'load_dubbing_rules' in globals() and 'apply_segment_rules' in globals():
                dubbing_rules = load_dubbing_rules()
                segments = apply_segment_rules(segments, dubbing_rules.get("segmentRules", []))
            
            # Check if synthesis already exists
            synthesis_exists = False
            existing_audio_paths = []
            
            if 'check_audio_synthesis_exists' in globals():
                synthesis_exists, existing_audio_paths = check_audio_synthesis_exists(
                    video_id, segments, str(self.audio_dir)
                )
            
            audio_files_generated = 0
            
            if synthesis_exists:
                logger.info("🎯 Reusing existing audio synthesis")
                audio_files_generated = len(existing_audio_paths)
            else:
                # Generate new audio synthesis
                if 'text_chunks_to_audio' in globals():
                    logger.info("🧠 Synthesizing transcript chunks via Kokoro...")
                    
                    # Update config to use project directories
                    original_audio_dir = config.get("audio_output_dir", "audio")
                    config["audio_output_dir"] = str(self.audio_dir)
                    
                    audio_paths = []
                    text_chunks_to_audio(segments, str(self.audio_dir), audio_paths)
                    audio_files_generated = len(audio_paths)
                    
                    # Restore original config
                    config["audio_output_dir"] = original_audio_dir
                else:
                    # Fallback: create placeholder audio files
                    logger.warning("text_chunks_to_audio not available, creating placeholder files")
                    for i, segment in enumerate(segments):
                        if isinstance(segment, dict) and segment.get('translated_text'):
                            audio_filename = f"chunk_{i:03d}.mp3"
                            segment['audio_file'] = f"audio/{audio_filename}"
                            
                            audio_path = self.audio_dir / audio_filename
                            audio_path.touch()  # Create empty file for demo
                            audio_files_generated += 1
                        elif hasattr(segment, 'translated_text') and getattr(segment, 'translated_text'):
                            audio_filename = f"chunk_{i:03d}.mp3"
                            segment.audio_file = f"audio/{audio_filename}"
                            
                            audio_path = self.audio_dir / audio_filename
                            audio_path.touch()
                            audio_files_generated += 1
            
            # Save updated segments
            if hasattr(segments[0], '__dict__'):
                segment_data = [asdict(seg) if hasattr(asdict, '__call__') else seg.__dict__ for seg in segments]
            else:
                segment_data = segments
                
            with open(segments_path, 'w', encoding='utf-8') as f:
                json.dump(segment_data, f, indent=2, ensure_ascii=False)
            
            result = {
                "success": True,
                "segmentsCount": len(segments),
                "audioFilesGenerated": audio_files_generated,
                "message": f"✅ Generated {audio_files_generated} audio files"
            }
            
            self.update_step_completion("synthesize", True)
            return result
            
        except Exception as e:
            logger.error(f"❌ Voice synthesis step failed: {e}")
            self.update_step_completion("synthesize", False)
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Voice synthesis failed: {e}"
            }
    
    def step_combine(self) -> Dict[str, Any]:
        """Step 5: Final Assembly"""
        logger.info("🎬 Starting final assembly step...")
        
        try:
            video_id = self.get_video_id()
            
            # Load segments
            segments_path = self.transcripts_dir / f"{video_id}_segments.json"
            with open(segments_path, 'r', encoding='utf-8') as f:
                segment_data = json.load(f)
            
            # Convert back to DubSegment objects if available
            if 'DubSegment' in globals():
                segments = []
                for data in segment_data:
                    if isinstance(data, dict):
                        segment = DubSegment(
                            start=data.get('start', 0),
                            end=data.get('end', 0),
                            original_text=data.get('original_text', ''),
                            translated_text=data.get('translated_text', ''),
                            target_duration=data.get('target_duration', 0)
                        )
                        for key, value in data.items():
                            if hasattr(segment, key):
                                setattr(segment, key, value)
                        segments.append(segment)
                    else:
                        segments.append(data)
            else:
                segments = segment_data
            
            # Get video file path
            video_file_ref = self.project_config["fileReferences"].get("videoFile")
            if not video_file_ref:
                raise ValueError("No video file reference found")
            
            if video_file_ref["isLinked"]:
                video_path = video_file_ref["path"]
            else:
                video_path = str(self.project_dir / video_file_ref["path"])
            
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video file not found: {video_path}")
            
            # Create final audio
            final_audio_path = self.audio_dir / f"{video_id}_dubbed.mp3"
            
            # Get video duration
            try:
                result = subprocess.run([
                    "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                    "-of", "csv=p=0", video_path
                ], capture_output=True, text=True, check=True)
                total_duration = float(result.stdout.strip())
            except:
                total_duration = 300.0  # Fallback duration
            
            # Load dubbing rules for audio settings
            audio_settings = {}
            if 'load_dubbing_rules' in globals():
                dubbing_rules = load_dubbing_rules()
                audio_settings = dubbing_rules.get("audioSettings", {})
            
            # Create enhanced audio track
            audio_created = False
            if 'create_enhanced_audio_track_with_loose_sync' in globals():
                # Update config for loose sync
                if 'config' in globals():
                    config["looseSyncSettings"] = {
                        "sync_on_speaker_change": True,
                        "sync_tolerance_window": 1.5,
                        "min_gap_seconds": 0.05,
                        "max_drift_seconds": 2.0,
                        "sync_every_n_segments": 3,
                        "force_sync_threshold": 1.5,
                        "early_segment_boost": True,
                    }
                
                audio_created = create_enhanced_audio_track_with_loose_sync(
                    segments, str(final_audio_path), total_duration, audio_settings
                )
                
                if audio_created:
                    logger.info(f"🎬 Enhanced audio with loose sync saved to {final_audio_path}")
            
            if not audio_created and 'concatenate_audio' in globals():
                # Fallback to simple concatenation
                audio_paths = []
                for segment in segments:
                    if isinstance(segment, dict) and segment.get('audio_file'):
                        audio_file_path = self.audio_dir / os.path.basename(segment['audio_file'])
                        if audio_file_path.exists():
                            audio_paths.append(str(audio_file_path))
                    elif hasattr(segment, 'audio_file') and getattr(segment, 'audio_file'):
                        audio_file_path = self.audio_dir / os.path.basename(segment.audio_file)
                        if audio_file_path.exists():
                            audio_paths.append(str(audio_file_path))
                
                concatenate_audio(audio_paths, str(final_audio_path))
                logger.info(f"🎬 Final audio saved to {final_audio_path}")
            
            # Apply audio effects if configured
            if 'apply_audio_effects' in globals() and 'config' in globals():
                preset = config.get("audio_effects_preset", "voice")
                if preset != "off":
                    effects_audio_path = self.audio_dir / f"{video_id}_dubbed_effects.mp3"
                    if apply_audio_effects(str(final_audio_path), str(effects_audio_path), preset):
                        final_audio_path = effects_audio_path
                        logger.info(f"🎵 Audio effects applied: {preset}")
            
            # Create final video
            final_video_path = self.output_dir / f"{video_id}_final.mp4"
            
            if 'merge_audio_with_video' in globals():
                merge_audio_with_video(video_path, str(final_audio_path), str(final_video_path))
                logger.info(f"🎬 Final video created: {final_video_path}")
            else:
                # Fallback: use ffmpeg directly
                cmd = [
                    "ffmpeg", "-y",
                    "-i", video_path,
                    "-i", str(final_audio_path),
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    str(final_video_path)
                ]
                subprocess.run(cmd, check=True, capture_output=True)
                logger.info(f"🎬 Final video created: {final_video_path}")
            
            # Update project config
            self.project_config["fileReferences"]["finalAudio"] = f"audio/{final_audio_path.name}"
            self.project_config["fileReferences"]["finalVideo"] = f"output/{final_video_path.name}"
            
            result = {
                "success": True,
                "finalVideoPath": str(final_video_path),
                "finalAudioPath": str(final_audio_path),
                "videoDuration": total_duration,
                "message": f"✅ Final video created: {final_video_path.name}"
            }
            
            self.update_step_completion("combine", True)
            return result
            
        except Exception as e:
            logger.error(f"❌ Final assembly step failed: {e}")
            self.update_step_completion("combine", False)
            return {
                "success": False,
                "error": str(e),
                "message": f"❌ Final assembly failed: {e}"
            }

def setup_project_config():
    """Setup project-specific config overrides"""
    if 'config' not in globals():
        return
        
    # These will be overridden by the project pipeline as needed
    project_config_defaults = {
        "force_whisperx": True,
        "audio_effects_preset": "voice",
        "target_language": "es"
    }
    
    for key, value in project_config_defaults.items():
        if key not in config:
            config[key] = value

def main():
    parser = argparse.ArgumentParser(description="Kokoro Studio Project Pipeline")
    parser.add_argument("project_dir", help="Project directory path")
    parser.add_argument("step", choices=["download", "transcribe", "translate", "synthesize", "combine"], 
                       help="Pipeline step to execute")
    
    args = parser.parse_args()
    
    try:
        # Setup config defaults
        setup_project_config()
        
        pipeline = ProjectPipeline(args.project_dir)
        
        # Execute the requested step
        if args.step == "download":
            result = pipeline.step_download()
        elif args.step == "transcribe":
            result = pipeline.step_transcribe()
        elif args.step == "translate":
            result = pipeline.step_translate()
        elif args.step == "synthesize":
            result = pipeline.step_synthesize()
        elif args.step == "combine":
            result = pipeline.step_combine()
        
        # Output result as JSON for Go to parse
        print(json.dumps(result, indent=2))
        
        # Exit with appropriate code
        sys.exit(0 if result["success"] else 1)
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "message": f"❌ Pipeline failed: {e}"
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()