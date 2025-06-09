from structs.DubSegment import DubSegment
from typing import List, Dict, Tuple, Optional

def normalize_whisperx_segments(raw_segments: List[Dict]) -> List[DubSegment]:
    """Normalize segments from WhisperX, now with speaker information extracted from words"""
    normalized = []
    for seg in raw_segments:
        # Extract speaker from segment level first
        segment_speaker = seg.get("speaker", "SPEAKER_UNKNOWN")
        
        # If no segment-level speaker, try to get from words
        if segment_speaker == "SPEAKER_UNKNOWN":
            words = seg.get("words", [])
            if words:
                # Get the most common speaker from words in this segment
                word_speakers = [word.get("speaker") for word in words if word.get("speaker")]
                if word_speakers:
                    # Use the most frequent speaker in this segment
                    from collections import Counter
                    speaker_counts = Counter(word_speakers)
                    segment_speaker = speaker_counts.most_common(1)[0][0]
                    print(f"🎭 Extracted speaker {segment_speaker} from word-level data for: '{seg.get('text', '')[:50]}...'")
        
        normalized.append(DubSegment(
            start=seg.get("start", 0.0),
            end=seg.get("end", seg.get("start", 0.0) + 1.0),
            original_text=seg.get("text", ""),
            translated_text="",
            target_duration=seg.get("end", seg.get("start", 0.0) + 1.0) - seg.get("start", 0.0),
            words=seg.get("words", []),
            speaker=segment_speaker  # Now properly extracted from words if needed
        ))
    return normalized
