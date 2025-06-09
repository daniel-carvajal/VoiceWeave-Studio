import json
from pathlib import Path
from typing import List

from structs.DubSegment import DubSegment

def load_existing_segments_if_available(video_id: str, segments: List[DubSegment], audio_dir: str) -> List[DubSegment]:
    """Load translation data from existing segments file if available"""
    segment_data_path = Path(audio_dir) / f"{video_id}_segments.json"
    
    if not segment_data_path.exists():
        return segments
    
    try:
        with open(segment_data_path, "r", encoding="utf-8") as f:
            existing_segments_data = json.load(f)
        
        # If counts match, reuse translations
        if len(existing_segments_data) == len(segments):
            print("📄 Reusing existing translations from segments file")
            for idx, (current_seg, existing_data) in enumerate(zip(segments, existing_segments_data)):
                # Keep the translated text if it exists
                if existing_data.get('translated_text'):
                    current_seg.translated_text = existing_data['translated_text']
                # Keep audio file path if it exists
                if existing_data.get('audio_file'):
                    current_seg.audio_file = existing_data['audio_file']
            return segments
        else:
            print("⚠️ Segment count changed - will retranslate")
            return segments
            
    except Exception as e:
        print(f"⚠️ Error loading existing segments: {e}")
        return segments
