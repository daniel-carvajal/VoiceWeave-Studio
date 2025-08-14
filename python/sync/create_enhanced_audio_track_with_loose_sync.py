import os
import subprocess
from typing import Dict, List
from structs.DubSegment import DubSegment


def create_enhanced_audio_track_with_loose_sync(segments: List[DubSegment], output_path: str, total_duration: float, audio_settings: Dict, background_audio_path=None):
    """Create audio track with loose synchronization and consistent volume"""
    print("🎯 Creating enhanced audio track with loose synchronization and FIXED volume...")
    
    # Import config here to get latest settings
    from config import config
    
    cmd = ["ffmpeg", "-y"]
    
    # Calculate loose sync timing (same as working test)
    timed_segments = []
    current_time = 0.0
    min_gap = 0.15  # Minimum gap between segments (150ms)
    
    # Filter out segments without audio files first
    valid_segments = []
    for i, segment in enumerate(segments):
        if segment.audio_file and os.path.exists(segment.audio_file):
            valid_segments.append((i, segment))
        else:
            print(f"⚠️ Skipping segment {i}: no audio file")
    
    if not valid_segments:
        print("⚠️ No valid audio segments to process")
        return False
    
    # Add inputs for valid segments
    for idx, (original_i, seg) in enumerate(valid_segments):
        cmd.extend(["-i", seg.audio_file])
    
    # Add background audio input (will be the last input)
    background_input_index = len(valid_segments)
    if background_audio_path and os.path.exists(background_audio_path):
        cmd.extend(["-i", background_audio_path])
        print(f"🎵 Adding background audio: {background_audio_path}")
        has_background = True
    else:
        print("⚠️ Background audio not found or not specified")
        has_background = False
    
    # Process timing for valid segments
    for idx, (original_i, seg) in enumerate(valid_segments):
        # Get audio duration
        try:
            result = subprocess.run([
                "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", seg.audio_file
            ], capture_output=True, text=True, check=True)
            audio_duration = float(result.stdout.strip())
        except:
            audio_duration = seg.end - seg.start
        
        # Decide if we should sync to original timing
        should_sync = False
        sync_reason = ""
        
        # Always sync first segment
        if idx == 0:
            should_sync = True
            sync_reason = "first_segment"
        
        # Sync on speaker changes
        elif idx > 0:
            prev_speaker = valid_segments[idx-1][1].speaker
            curr_speaker = seg.speaker
            if prev_speaker != curr_speaker:
                should_sync = True
                sync_reason = "speaker_change"
        
        # Calculate timing
        natural_start = current_time + min_gap
        original_start = seg.start
        
        if should_sync:
            # Try to sync to original, but not if it would cause overlap
            if original_start >= current_time + 0.05:  # Small 50ms buffer
                final_start = original_start
                synced = True
                print(f"   🎯 Segment {original_i}: SYNC to original ({sync_reason}) at {final_start:.2f}s")
            else:
                final_start = natural_start
                synced = False
                print(f"   ⏭️  Segment {original_i}: SYNC attempted ({sync_reason}) but unsafe, using flow at {final_start:.2f}s")
        else:
            # Natural flow timing
            final_start = natural_start
            synced = False
            drift = final_start - original_start
            print(f"   ➡️  Segment {original_i}: Natural flow at {final_start:.2f}s (drift: {drift:+.2f}s)")
        
        # Add to timed segments
        timed_segments.append({
            'segment': seg,
            'start_time': final_start,
            'duration': audio_duration,
            'index': idx,  # Use the new index for FFmpeg inputs
            'original_index': original_i,
            'synced': synced,
            'sync_reason': sync_reason if synced else None,
            'original_start': original_start,
            'drift': final_start - original_start
        })
        
        # Update current time for next segment
        current_time = final_start + audio_duration
    
    # Print simple summary (like working test)
    total_segments = len(timed_segments)
    synced_segments = sum(1 for ts in timed_segments if ts['synced'])
    print(f"\n📊 Timing Summary:")
    print(f"   Total segments: {total_segments}")
    print(f"   Synced segments: {synced_segments} ({synced_segments/total_segments*100:.1f}%)")
    
    # ===== FIXED FFMPEG LOGIC WITH CONSISTENT VOLUME AND BACKGROUND AUDIO =====
    
    filter_parts = []
    
    # Get volume setting from config
    # target_volume = config.get("output_volume", 1.8)
    target_volume = config.get("vocal_volume", 1)  # Dubbed vocals volume
    background_volume = config.get("background_volume", 0.8)  # Lower volume for background
    audio_quality = config.get("audio_quality", "128k")
    
    # Process speech segments
    for i, ts in enumerate(timed_segments):
        # Create delay filter with pre-normalization to prevent volume ramping
        delay_ms = int(ts['start_time'] * 1000)
        # Pre-normalize each segment to consistent level (0.7 = safe level)
        filter_parts.append(f"[{i}:a]volume=0.6,adelay={delay_ms}|{delay_ms}[delayed{i}]")
        print(f"   Segment {ts['original_index']}: scheduled at {ts['start_time']:.2f}s")
    
    # Mix all speech inputs with fixed weights to prevent dynamic volume adjustment
    delayed_inputs = [f"[delayed{i}]" for i in range(len(timed_segments))]
    num_inputs = len(delayed_inputs)
    
    # Use equal weights and disable normalization to prevent volume ramping
    weights = " ".join(["1"] * num_inputs)
    mix_filter = "".join(delayed_inputs) + f"amix=inputs={num_inputs}:weights={weights}:normalize=0[speech_mixed]"
    filter_parts.append(mix_filter)
    
    # Apply final volume boost to speech (simple, no dynamic processing)
    filter_parts.append(f"[speech_mixed]volume={target_volume}[speech_out]")
    
    if has_background:
        # Process background audio - just set volume, it should play full length in parallel
        filter_parts.append(f"[{background_input_index}:a]volume={background_volume}[background_out]")
        
        # Mix speech and background together
        # filter_parts.append("[speech_out][background_out]amix=inputs=2:weights=1 1:normalize=0[final_out]")
        filter_parts.append("[speech_out][background_out]amix=inputs=2:weights=1 1:normalize=0[final_out]")
        
        print(f"🔊 Volume: Speech {target_volume}x + Background {background_volume}x (NO dynamic processing)")
        final_map = "[final_out]"
    else:
        print(f"🔊 Volume: Speech only {target_volume}x (NO dynamic processing)")
        final_map = "[speech_out]"
    
    filter_complex = ";".join(filter_parts)
    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", final_map,
        "-c:a", "libmp3lame",
        "-b:a", audio_quality,
        output_path
    ])
    
    print(f"🔍 DEBUG: Filter: {filter_complex}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"✅ Enhanced audio track with CONSISTENT volume created: {output_path} ({file_size} bytes)")
            if file_size < 1000:
                print("⚠️ WARNING: Output file is very small - may be silent")
                return False
            return True
        else:
            print(f"❌ Output file not created")
            return False
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Enhanced audio creation failed: {e}")
        if e.stderr:
            print(f"   stderr: {e.stderr}")
        return False