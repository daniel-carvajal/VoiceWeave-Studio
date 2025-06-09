"""
Simple Audio Effects using Pedalboard
"""

import os
from typing import Optional

def apply_audio_effects(input_path: str, output_path: str, preset: str = "voice") -> bool:
    """Apply audio effects to the final mixed audio"""
    
    try:
        from pedalboard import Pedalboard, Chorus, Reverb, Compressor, Limiter, HighpassFilter, Gain
        from pedalboard.io import AudioFile
    except ImportError:
        print("⚠️ Pedalboard not installed. Install with: pip install pedalboard")
        # Copy original file if effects can't be applied
        import shutil
        shutil.copy2(input_path, output_path)
        return True
    
    if not os.path.exists(input_path):
        print(f"❌ Input audio file not found: {input_path}")
        return False
    
    # Define pedalboard presets
    presets = {
        "voice": Pedalboard([
            HighpassFilter(cutoff_frequency_hz=80),
            Compressor(threshold_db=-24, ratio=8.0, attack_ms=5, release_ms=70),
            Gain(gain_db=5.8),
            Reverb(room_size=0.2, dry_level=0.9, wet_level=0.1),
        ]),
        
        # "podcast": Pedalboard([
        #     Compressor(threshold_db=-20.0, ratio=4.0),
        #     Reverb(room_size=0.15, wet_level=0.08, dry_level=0.92),
        #     Limiter(threshold_db=-1.0)
        # ]),
        
        # "cinematic": Pedalboard([
        #     Chorus(rate_hz=0.8, depth=0.25, mix=0.35),
        #     Reverb(room_size=0.5, wet_level=0.25, dry_level=0.75),
        #     Compressor(threshold_db=-16.0, ratio=2.5),
        #     Limiter(threshold_db=-0.5)
        # ]),
        
        # "clean": Pedalboard([
        #     Compressor(threshold_db=-22.0, ratio=2.0),
        #     Limiter(threshold_db=-1.0)
        # ]),

        "debug": Pedalboard([
            Reverb(room_size=0.25, wet_level=1, dry_level=0),
        ]),
        
        "off": None  # No effects
    }
    
    board = presets.get(preset, presets["voice"])
    
    if board is None:
        print("🔇 Audio effects disabled - copying original file")
        import shutil
        shutil.copy2(input_path, output_path)
        return True
    
    print(f"🎛️ Applying '{preset}' effects to audio...")
    
    try:
        # Apply effects using the example code pattern
        with AudioFile(input_path) as f:
            with AudioFile(output_path, 'w', f.samplerate, f.num_channels) as o:
                # Read one second of audio at a time, until the file is empty:
                while f.tell() < f.frames:
                    chunk = f.read(f.samplerate)
                    
                    # Run the audio through our pedalboard:
                    effected = board(chunk, f.samplerate, reset=False)
                    
                    # Write the output to our output file:
                    o.write(effected)
        
        print(f"✅ Effects applied: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error applying effects: {e}")
        # Fallback: copy original file
        import shutil
        shutil.copy2(input_path, output_path)
        return True