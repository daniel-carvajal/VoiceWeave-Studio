import re
import sys
from urllib.parse import parse_qs, urlparse

def extract_video_id(url_or_id: str) -> str:
    # If it's already a YouTube ID (11 chars, alphanumeric, typical format)
    if re.match(r"^[\w-]{11}$", url_or_id):
        return url_or_id

    # Try parsing the URL
    parsed = urlparse(url_or_id)
    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        query = parse_qs(parsed.query)
        return query.get("v", [None])[0]
    elif parsed.hostname == "youtu.be":
        return parsed.path.lstrip("/")
    else:
        return None  # Invalid format
    
def main(youtube_url_or_id: str, target_lang: str = "es"):
    video_id = extract_video_id(youtube_url_or_id)
    if not video_id:
        print("❌ Could not extract a valid YouTube video ID.")
        sys.exit(1)

    print(f"🎥 Extracted video ID: {video_id}")
    print(f"🌐 Target language: {target_lang}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python dubbing_pipeline.py <YouTube_URL_or_ID> [target_lang_code]")
        sys.exit(1)

    url = sys.argv[1]
    target_lang = sys.argv[2] if len(sys.argv) > 2 else "es"
    main(url, target_lang)