"""
Simplified Translation Service using Claude API
"""

import json
import requests
from typing import List, Dict, Optional
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

class TranslationService:
    """Simplified translation service using Claude API"""
    
    def __init__(self, config: Dict = None):
        self.config = config or self._get_default_config()
        self.claude_api_key = self.config.get("claude_api_key") or self._get_claude_api_key()
        self.target_language = self.config.get("target_language", "es")
        self.batch_size = self.config.get("translation_batch_size", 8)  # Process 8 segments at once
        self.context_size = self.config.get("translation_context_size", 3)  # Include 3 previous segments
        
        if not self.claude_api_key:
            raise ValueError("Claude API key not found. Set ANTHROPIC_API_KEY environment variable or add to config.")
    
    def _get_default_config(self) -> Dict:
        return {
            "target_language": "es",
            "translation_batch_size": 8,
            "translation_context_size": 3
        }
    
    def _get_claude_api_key(self) -> Optional[str]:
        """Get Claude API key from environment or config"""
        import os
        return os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    
    def _get_language_name(self, lang_code: str) -> str:
        """Convert language code to full name"""
        lang_map = {
            "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
            "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
            "ar": "Arabic", "hi": "Hindi", "ru": "Russian", "nl": "Dutch"
        }
        return lang_map.get(lang_code, "Spanish")
    
    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds as MM:SS"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
    
    def _translate_batch_with_claude(self, segments_batch: List[DubSegment], context_segments: List[DubSegment] = None) -> List[str]:
        """Translate a batch of segments using Claude API"""
        target_lang_name = self._get_language_name(self.target_language)
        
        # Build the prompt with context and timing awareness
        prompt = f"""You are translating English dialogue to natural, colloquial {target_lang_name}. 

IMPORTANT GUIDELINES:
1. Maintain natural {target_lang_name} speaking patterns and colloquialisms
2. Keep translations roughly aligned with timing - don't drastically change sentence length
3. Preserve the speaker's tone and intent
4. Use conversational {target_lang_name}, not formal/literal translation
5. Keep continuity with previous context"""

        # Add previous context if available
        if context_segments:
            prompt += f"\n\nPREVIOUS CONTEXT:"
            for i, seg in enumerate(context_segments):
                if seg.translated_text:
                    prompt += f"\n[{self._format_timestamp(seg.start)}] English: \"{seg.original_text}\""
                    prompt += f"\n[{self._format_timestamp(seg.start)}] {target_lang_name}: \"{seg.translated_text}\""

        # Add current segments to translate
        prompt += f"\n\nTRANSLATE THESE SEGMENTS:"
        for i, seg in enumerate(segments_batch):
            prompt += f"\n{i+1}. [{self._format_timestamp(seg.start)}-{self._format_timestamp(seg.end)}] \"{seg.original_text}\""

        prompt += f"""\n\nRespond with ONLY the {target_lang_name} translations, one per line, numbered:
1. [translation 1]
2. [translation 2]
etc."""

        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.claude_api_key,
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 2000,
                    "temperature": 0.3,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result["content"][0]["text"].strip()
                
                # Parse numbered responses
                translations = []
                lines = content.split('\n')
                for line in lines:
                    line = line.strip()
                    if line and any(line.startswith(f"{i}.") for i in range(1, 20)):
                        # Extract translation after the number
                        translation = line.split('.', 1)[1].strip()
                        # Remove quotes if present
                        if translation.startswith('"') and translation.endswith('"'):
                            translation = translation[1:-1]
                        translations.append(translation)
                
                # Ensure we have the right number of translations
                if len(translations) == len(segments_batch):
                    return translations
                else:
                    print(f"⚠️ Expected {len(segments_batch)} translations, got {len(translations)}")
                    # Fallback: pad or truncate
                    while len(translations) < len(segments_batch):
                        translations.append("[TRANSLATION ERROR]")
                    return translations[:len(segments_batch)]
            
            else:
                print(f"❌ Claude API error {response.status_code}: {response.text}")
                return ["[API ERROR]"] * len(segments_batch)
                
        except Exception as e:
            print(f"❌ Translation error: {e}")
            return ["[NETWORK ERROR]"] * len(segments_batch)
    
    def translate_segments(self, segments: List[DubSegment]) -> List[DubSegment]:
        """Translate all segments using Claude API in batches"""
        if not segments:
            return segments
            
        print(f"🌐 Translating {len(segments)} segments to {self._get_language_name(self.target_language)} using Claude API...")
        
        translated_count = 0
        
        # Process in batches
        for i in range(0, len(segments), self.batch_size):
            batch_end = min(i + self.batch_size, len(segments))
            current_batch = segments[i:batch_end]
            
            # Get context from previous segments
            context_start = max(0, i - self.context_size)
            context_segments = segments[context_start:i] if i > 0 else None
            
            print(f"   Processing batch {i//self.batch_size + 1}: segments {i+1}-{batch_end}")
            
            # Translate the batch
            translations = self._translate_batch_with_claude(current_batch, context_segments)
            
            # Apply translations to segments
            for j, translation in enumerate(translations):
                if i + j < len(segments):
                    segments[i + j].translated_text = translation
                    translated_count += 1
        
        print(f"✅ Translation completed: {translated_count}/{len(segments)} segments translated")
        return segments
    
    def translate_single_text(self, text: str, target_lang: str = None) -> str:
        """Translate a single text (fallback method for compatibility)"""
        if not target_lang:
            target_lang = self.target_language
            
        # Create a temporary segment for single text translation
        temp_segment = DubSegment(
            start=0, end=1, original_text=text, translated_text="", target_duration=1
        )
        
        translations = self._translate_batch_with_claude([temp_segment])
        return translations[0] if translations else text

# Quick test function
def test_translation():
    """Test the simplified translation service"""
    import os
    
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("❌ Set ANTHROPIC_API_KEY environment variable to test")
        return
    
    config = {
        "target_language": "es",
        "translation_batch_size": 3
    }
    
    translator = TranslationService(config=config)
    
    # Create test segments
    test_segments = [
        DubSegment(0, 2, "Hello, how are you today?", "", 2),
        DubSegment(2, 4, "I'm doing great, thanks for asking.", "", 2),
        DubSegment(4, 6, "What are your plans for the weekend?", "", 2)
    ]
    
    # Translate
    result_segments = translator.translate_segments(test_segments)
    
    # Print results
    for seg in result_segments:
        print(f"'{seg.original_text}' -> '{seg.translated_text}'")

if __name__ == "__main__":
    test_translation()