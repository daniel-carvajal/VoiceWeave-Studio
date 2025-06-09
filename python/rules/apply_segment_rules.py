from typing import Dict, List
from structs.DubSegment import DubSegment

def segment_matches_rule(segment: DubSegment, rule: Dict) -> bool:
    """Check if a segment matches the detection criteria of a rule"""
    method = rule.get("detectionMethod", "")
    value = rule.get("detectionValue", "")
    text = segment.original_text
    
    if method == "text-contains":
        return value.lower() in text.lower()
    elif method == "text-starts":
        return text.lower().startswith(value.lower())
    elif method == "text-ends":
        return text.lower().endswith(value.lower())
    elif method == "duration-less":
        try:
            threshold = float(value)
            return segment.target_duration < threshold
        except:
            return False
    elif method == "duration-more":
        try:
            threshold = float(value)
            return segment.target_duration > threshold
        except:
            return False
    elif method == "word-count":
        try:
            threshold = int(value)
            word_count = len(text.split())
            return word_count <= threshold
        except:
            return False
    
    return False

def apply_segment_action(segment: DubSegment, rule: Dict) -> DubSegment:
    """Apply the action specified by a rule to a segment"""
    action = rule.get("actionType", "")
    value = rule.get("actionValue", "")
    
    if action == "extend-pause":
        # Add extra pause after this segment
        try:
            extra_ms = float(value.replace("ms", ""))
            segment.buffer_after += extra_ms / 1000.0
        except:
            pass
    elif action == "reduce-pause":
        # Reduce pause after this segment
        try:
            reduce_ms = float(value.replace("ms", ""))
            segment.buffer_after = max(0, segment.buffer_after - reduce_ms / 1000.0)
        except:
            pass
    elif action == "adjust-speed":
        # Adjust synthesis speed for this segment
        try:
            speed_factor = float(value.replace("x", ""))
            segment.adjusted_speed = speed_factor
        except:
            pass
    elif action == "crossfade":
        # Mark segment for crossfade treatment
        segment.priority = 2  # Higher priority for crossfade processing
    
    return segment

def apply_segment_rules(segments: List[DubSegment], rules: List[Dict]) -> List[DubSegment]:
    """Apply segment-specific rules for audio transitions and timing"""
    if not rules:
        return segments
    
    for segment in segments:
        for rule in rules:
            if segment_matches_rule(segment, rule):
                segment = apply_segment_action(segment, rule)
                print(f"⚙️ Applied rule '{rule.get('name')}' to segment: {segment.original_text[:50]}...")
    
    return segments
