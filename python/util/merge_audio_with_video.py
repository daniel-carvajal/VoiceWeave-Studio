import subprocess
import sys

def merge_audio_with_video(video_path: str, audio_path: str, output_path: str):
    """
    Replaces the audio track of the video with the new dubbed audio.
    """
    try:
        subprocess.run([
            "ffmpeg",
            "-y",
            "-i", video_path,
            "-i", audio_path,
            "-c:v", "copy",         # copy the video stream
            "-map", "0:v:0",        # take the video from input 0
            "-map", "1:a:0",        # take the audio from input 1
            "-shortest",            # cut to shortest of audio/video
            output_path
        ], check=True)
        print(f"🎞️ Final dubbed video saved to {output_path}")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to merge audio with video: {e}")
        sys.exit(1)
