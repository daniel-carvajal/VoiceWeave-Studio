#!/usr/bin/env python3
"""
Project-based dubbing pipeline for Kokoro Studio
Handles step-by-step execution with project persistence
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    
    def step_download(self) -> Dict[str, Any]:
        """Step 1: Download/Import Media"""
        logger.info("🎬 Starting download step...")
        
        source_type = self.project_config.get("sourceType")
        
        try:
            if source_type == "youtube":
                source_url = self.project_config.get("sourceUrl")
                
                if not source_url:
                    raise ValueError("No YouTube URL found in project config")
                
                # For now, simulate success
                # In real implementation, use yt-dlp or similar
                video_filename = f"{self.get_video_id()}.mp4"
                video_path = self.input_dir / video_filename
                
                # Update file reference in project config
                self.project_config["fileReferences"]["videoFile"] = {
                    "path": f"input/{video_filename}",
                    "isLinked": False,
                    "size": 0,  # Would be actual size
                    "lastModified": self.get_current_timestamp()
                }
                
                result = {
                    "success": True,
                    "videoPath": str(video_path),
                    "videoId": self.get_video_id(),
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
            
            # Simulate transcription process
            # In real implementation, you'd use WhisperX or other transcription service
            
            # Create dummy segments for demonstration
            segments = [
                {
                    "start": 0.5,
                    "end": 3.2,
                    "original_text": "Hello, this is a test transcription.",
                    "translated_text": "",
                    "target_duration": 2.7
                },
                {
                    "start": 3.2,
                    "end": 6.8,
                    "original_text": "This is segment number two.",
                    "translated_text": "",
                    "target_duration": 3.6
                }
            ]
            
            # Save segments to project
            segments_path = self.transcripts_dir / f"{video_id}_segments.json"
            with open(segments_path, 'w', encoding='utf-8') as f:
                json.dump(segments, f, indent=2, ensure_ascii=False)
            
            # Update project config
            self.project_config["fileReferences"]["segmentsFile"] = f"transcripts/{video_id}_segments.json"
            
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
                segments = json.load(f)
            
            # Simulate translation
            translations = {
                "Hello, this is a test transcription.": "Hola, esta es una transcripción de prueba.",
                "This is segment number two.": "Este es el segmento número dos."
            }
            
            for segment in segments:
                if segment["original_text"] in translations:
                    segment["translated_text"] = translations[segment["original_text"]]
                else:
                    # Fallback - just add "[ES]" prefix for demo
                    segment["translated_text"] = f"[ES] {segment['original_text']}"
            
            # Save updated segments
            with open(segments_path, 'w', encoding='utf-8') as f:
                json.dump(segments, f, indent=2, ensure_ascii=False)
            
            result = {
                "success": True,
                "segmentsCount": len(segments),
                "translatedCount": sum(1 for seg in segments if seg.get("translated_text")),
                "message": f"✅ Translated {len(segments)} segments to {target_lang.upper()}"
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
                segments = json.load(f)
            
            # Simulate audio generation
            audio_files_generated = 0
            for i, segment in enumerate(segments):
                if segment.get("translated_text"):
                    audio_filename = f"chunk_{i:03d}.mp3"
                    segment["audio_file"] = f"audio/{audio_filename}"
                    
                    # In real implementation, generate actual audio file here
                    audio_path = self.audio_dir / audio_filename
                    audio_path.touch()  # Create empty file for demo
                    
                    audio_files_generated += 1
            
            # Save updated segments
            with open(segments_path, 'w', encoding='utf-8') as f:
                json.dump(segments, f, indent=2, ensure_ascii=False)
            
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
                segments = json.load(f)
            
            # Create final audio and video files
            final_audio_path = self.audio_dir / f"{video_id}_dubbed.mp3"
            final_video_path = self.output_dir / f"{video_id}_final.mp4"
            
            # Simulate file creation
            final_audio_path.touch()
            final_video_path.touch()
            
            # Update project config
            self.project_config["fileReferences"]["finalAudio"] = f"audio/{final_audio_path.name}"
            self.project_config["fileReferences"]["finalVideo"] = f"output/{final_video_path.name}"
            
            result = {
                "success": True,
                "finalVideoPath": str(final_video_path),
                "finalAudioPath": str(final_audio_path),
                "videoDuration": 10.0,  # Simulated duration
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

def main():
    parser = argparse.ArgumentParser(description="Kokoro Studio Project Pipeline")
    parser.add_argument("project_dir", help="Project directory path")
    parser.add_argument("step", choices=["download", "transcribe", "translate", "synthesize", "combine"], 
                       help="Pipeline step to execute")
    
    args = parser.parse_args()
    
    try:
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