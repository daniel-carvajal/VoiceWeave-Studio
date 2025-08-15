import os
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import json
from structs.DubSegment import DubSegment

def check_video_exists(video_id: str, output_dir: str = None) -> Optional[str]:
    """Check if video file already exists and return its path"""
    project_root = os.getcwd()
    if output_dir is None:
        output_dir = os.path.join(project_root, "data", "audio_clips")
    
    # Common video extensions that yt-dlp might download
    extensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'm4v']
    
    for ext in extensions:
        video_path = os.path.join(output_dir, f"{video_id}.{ext}")
        if os.path.exists(video_path):
            print(f"✅ Video already exists: {video_path}")
            return video_path
    
    return None

def check_transcript_exists(video_id: str, output_dir: str) -> Optional[List[Dict]]:
    """Check if transcript file already exists and load it"""
    os.makedirs(output_dir, exist_ok=True)
    
    # Check for WhisperX JSON output first
    whisperx_path = os.path.join(output_dir, f"{video_id}.json")
    if os.path.exists(whisperx_path):
        print(f"✅ WhisperX transcript already exists: {whisperx_path}")
        try:
            with open(whisperx_path, "r", encoding="utf-8") as f:
                result = json.load(f)
                return result.get("segments", [])
        except Exception as e:
            print(f"⚠️ Error loading existing WhisperX transcript: {e}")
    
    # Check for YouTube transcript files
    youtube_files = [
        f"{video_id}_human.json",
        f"{video_id}_generated.json"
    ]
    
    for filename in youtube_files:
        transcript_path = os.path.join(output_dir, filename)
        if os.path.exists(transcript_path):
            print(f"✅ YouTube transcript already exists: {transcript_path}")
            try:
                with open(transcript_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Error loading existing YouTube transcript: {e}")
    
    return None

def check_audio_synthesis_exists(video_id: str, segments: List[DubSegment], audio_dir: str, overwrite_segments: bool = False) -> Tuple[bool, List[str]]:
    """Check if audio synthesis already exists and return status + audio paths"""
    segment_data_path = Path(audio_dir) / f"{video_id}_segments.json"
    
    # Check if segments JSON file exists
    if not segment_data_path.exists():
        print("📄 No existing segments file found")
        return False, []
    
    try:
        # Load existing segments data
        with open(segment_data_path, "r", encoding="utf-8") as f:
            existing_segments_data = json.load(f)
        
        print(f"📄 Found existing segments file with {len(existing_segments_data)} segments")
        
        # Check if segment count matches
        if len(existing_segments_data) != len(segments):
            print(f"⚠️ Segment count mismatch: existing={len(existing_segments_data)}, current={len(segments)}")
            if not overwrite_segments:
                print("🔒 Using existing segments (overwrite disabled, preserving manual edits)")
                # Use the existing segments count as the authoritative source
                segments.clear()
                segments.extend([DubSegment(**seg_data) for seg_data in existing_segments_data])
            else:
                return False, []
        
        # Check if all audio files exist
        audio_paths = []
        missing_files = []
        
        for idx, existing_seg in enumerate(existing_segments_data):
            audio_file = existing_seg.get('audio_file')
            if audio_file and os.path.exists(audio_file):
                audio_paths.append(audio_file)
            else:
                # Try the standard naming pattern as fallback
                mp3_filename = f"chunk_{idx:03d}.mp3"
                mp3_path = os.path.join(audio_dir, mp3_filename)
                if os.path.exists(mp3_path):
                    audio_paths.append(mp3_path)
                else:
                    missing_files.append(f"chunk_{idx:03d}.mp3")
        
        if missing_files:
            print(f"⚠️ Missing audio files: {missing_files}")
            return False, []
        
        # Update current segments with existing audio file paths
        for idx, segment in enumerate(segments):
            if idx < len(audio_paths):
                segment.audio_file = audio_paths[idx] 
        
        print(f"✅ All {len(audio_paths)} audio files found - reusing existing synthesis")
        return True, audio_paths
        
    except Exception as e:
        print(f"⚠️ Error checking existing segments: {e}")
        return False, []
