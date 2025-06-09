import os
import subprocess
import tempfile
from typing import List

def concatenate_audio(audio_paths: List[str], out_path: str):
    list_file_path = os.path.join(tempfile.gettempdir(), "audio_concat_list.txt")
    with open(list_file_path, "w") as f:
        for path in audio_paths:
            f.write(f"file '{os.path.abspath(path)}'\n")

    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file_path,
        "-c", "copy", out_path
    ], check=True)
    print(f"🎧 Concatenated audio saved to {out_path}")
