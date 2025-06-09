from typing import List, Dict
from dataclasses import dataclass

@dataclass
class DubSegment:
    start: float
    end: float
    original_text: str
    translated_text: str
    target_duration: float
    words: List[Dict] = None
    audio_file: str = None
    adjusted_speed: float = 1.0
    actual_start: float = None
    actual_end: float = None
    buffer_before: float = 0.2
    buffer_after: float = 0.3
    priority: int = 1
    speaker: str = "SPEAKER_UNKNOWN"