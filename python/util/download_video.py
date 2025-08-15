from checks.check_files_exist import check_video_exists
import os, sys, subprocess

def download_video(youtube_url: str, video_id: str, output_dir: str = None):
    """Download video and extract audio if it doesn't already exist"""
    project_root = os.getcwd()
    if output_dir is None:
        # Check for environment variable first
        output_dir = os.getenv("KOKORO_VIDEO_OUTPUT_DIR")
        if output_dir is None:
            output_dir = os.path.join(project_root, "data", "audio_clips")
    
    # Check if video already exists
    existing_video = check_video_exists(video_id, output_dir)
    if existing_video:
        print(f"📹 Skipping download - video already exists: {existing_video}")
        return existing_video
    
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "%(id)s.%(ext)s")
    
    # 🔥 CHANGE: Download video (not audio)
    command = [
        "yt-dlp",
        "-f", "best[ext=mp4]/best[ext=webm]/best",  # Prefer video formats
        "-o", output_path,
        youtube_url
    ]
    
    try:
        print(f"📥 Downloading VIDEO from {youtube_url}...")  # Changed message
        subprocess.run(command, check=True)
        print("✅ Video download complete.")
        
        # Return the path to the downloaded video file
        downloaded_video = check_video_exists(video_id, output_dir)

        print("video downloaded to ", output_dir)
        
        if video_id:
            extract_audio_from_original_video(video_id, downloaded_video)
        return downloaded_video
            
    except subprocess.CalledProcessError as e:
        print(f"❌ Error downloading: {e}")
        sys.exit(1)



def extract_audio_from_original_video(video_id, downloaded_video):
    # 🔥 Extract audio to the AUDIO directory, not videos directory
    audio_output_dir = os.getenv("KOKORO_AUDIO_OUTPUT_DIR", "./output/audio")
    os.makedirs(audio_output_dir, exist_ok=True)
    audio_path = os.path.join(audio_output_dir, f"{video_id}.wav")
    
    print(f"🎵 Extracting audio from downloaded video...")
    # Creates {video_id}.wav (for WhisperX)
    # WhisperX audio: 16kHz, mono (for transcription)
    try:
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", downloaded_video,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            audio_path  # <-- This should go to audio folder, not videos folder
        ]
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
        print(f"✅ Audio extracted to: {audio_path}")

        return audio_path
    except subprocess.CalledProcessError as e:
        print(f"⚠️ Audio extraction failed: {e}")