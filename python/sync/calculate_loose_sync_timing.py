import subprocess
from typing import Dict, List

from structs.DubSegment import DubSegment


def calculate_loose_sync_timing(segments: List[DubSegment], audio_settings: Dict) -> List[Dict]:
    """Calculate timing with loose synchronization - SIMPLIFIED VERSION from test"""
    
    print("🎯 Calculating loose sync timing (based on working test)...")
    
    timed_segments = []
    current_time = 0.0
    min_gap = 0.15  # Minimum gap between segments (150ms)
    
    for i, segment in enumerate(segments):
        if not segment.audio_file or not os.path.exists(segment.audio_file):
            print(f"⚠️ Skipping segment {i}: no audio file")
            continue
        
        # Get audio duration
        try:
            result = subprocess.run([
                "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", segment.audio_file
            ], capture_output=True, text=True, check=True)
            audio_duration = float(result.stdout.strip())
        except:
            audio_duration = segment.end - segment.start
        
        # Decide if we should sync to original timing
        should_sync = False
        sync_reason = ""
        
        # Always sync first segment
        if i == 0:
            should_sync = True
            sync_reason = "first_segment"
        
        # Sync on speaker changes
        elif i > 0:
            prev_speaker = segments[i-1].speaker
            curr_speaker = segment.speaker
            if prev_speaker != curr_speaker:
                should_sync = True
                sync_reason = "speaker_change"
        
        # Calculate timing
        natural_start = current_time + min_gap
        original_start = segment.start
        
        if should_sync:
            # Try to sync to original, but not if it would cause overlap
            if original_start >= current_time + 0.05:  # Small 50ms buffer
                final_start = original_start
                synced = True
                print(f"   🎯 Segment {i}: SYNC to original ({sync_reason}) at {final_start:.2f}s")
            else:
                final_start = natural_start
                synced = False
                print(f"   ⏭️  Segment {i}: SYNC attempted ({sync_reason}) but unsafe, using flow at {final_start:.2f}s")
        else:
            # Natural flow timing
            final_start = natural_start
            synced = False
            drift = final_start - original_start
            print(f"   ➡️  Segment {i}: Natural flow at {final_start:.2f}s (drift: {drift:+.2f}s)")
        
        # Add to timed segments
        timed_segments.append({
            'segment': segment,
            'start_time': final_start,
            'duration': audio_duration,
            'crossfade': False,  # Keep it simple for now
            'index': i,
            'synced': synced,
            'sync_reason': sync_reason if synced else None,
            'original_start': original_start,
            'drift': final_start - original_start
        })
        
        # Update current time for next segment
        current_time = final_start + audio_duration
    
    # Print simple summary
    total_segments = len(timed_segments)
    synced_segments = sum(1 for ts in timed_segments if ts['synced'])
    print(f"\n📊 Timing Summary:")
    print(f"   Total segments: {total_segments}")
    print(f"   Synced segments: {synced_segments} ({synced_segments/total_segments*100:.1f}%)")
    
    return timed_segments
