from checks.check_files_exist import check_video_exists

import os, sys, subprocess

def download_video(youtube_url: str, video_id: str, output_dir: str = None):
    """Download video only if it doesn't already exist"""
    project_root = os.getcwd()
    if output_dir is None:
        output_dir = os.path.join(project_root, "data", "audio_clips")

    # Check if video already exists
    existing_video = check_video_exists(video_id, output_dir)
    if existing_video:
        print(f"📹 Skipping download - video already exists: {existing_video}")
        return existing_video

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "%(id)s.%(ext)s")

    command = [
        "yt-dlp",
        "-o", output_path,
        youtube_url
    ]

    try:
        print(f"📥 Downloading audio from {youtube_url}...")
        subprocess.run(command, check=True)
        print("✅ Download complete.")
        
        # Return the path to the downloaded file
        downloaded_file = check_video_exists(video_id, output_dir)
        return downloaded_file
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error downloading: {e}")
        sys.exit(1)
