"""
translation_service.py - Enhanced Translation Service with Multiple Models + LLM Judge
"""

import json
import requests
from typing import List, Dict, Optional
from dataclasses import dataclass
import re

# Import the DubSegment class - you might need to adjust this import
# Option 1: If DubSegment stays in main file, import it
# from your_main_file import DubSegment

# Option 2: Define DubSegment here if you want it separate too
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
    """Enhanced translation service with multiple models + LLM judge"""
    
    def __init__(self, service_type: str = "local", config: Dict = None):
        self.service_type = service_type
        self.config = config or self._get_default_config()
        self._load_local_translators()
        self.llm_judge_enabled = self.config.get("llm_judge_enabled", True)
        self.qwen_endpoint = self.config.get("qwen_endpoint", "http://127.0.0.1:1234")
        self.judge_model = self.config.get("judge_model", "qwen/qwen3-14b")
    
    def _get_default_config(self) -> Dict:
        """Default configuration if none provided"""
        return {
            "target_language": "es",
            "llm_judge_enabled": True,
            "qwen_endpoint": "http://127.0.0.1:1234",
            "judge_model": "qwen/qwen3-14b"
        }
    
    def _load_local_translators(self):
        """Load multiple translation models for comparison"""
        self.available_models = {}
        self.translation_available = False
        
        # Try to load M2M100 (multiple sizes)
        try:
            from transformers import M2M100ForConditionalGeneration, M2M100Tokenizer
            
            # Try 418M first (faster)
            try:
                model_name = "facebook/m2m100_418M"
                print(f"🔄 Loading M2M100-418M...")
                tokenizer = M2M100Tokenizer.from_pretrained(model_name)
                model = M2M100ForConditionalGeneration.from_pretrained(model_name)
                self.available_models["m2m100_418m"] = {
                    "tokenizer": tokenizer,
                    "model": model,
                    "type": "m2m100"
                }
                print("✅ M2M100-418M loaded")
            except Exception as e:
                print(f"⚠️ M2M100-418M failed: {e}")
            
            # Try 1.2B (better quality)
            try:
                model_name = "facebook/m2m100_1.2B"
                print(f"🔄 Loading M2M100-1.2B...")
                tokenizer = M2M100Tokenizer.from_pretrained(model_name)
                model = M2M100ForConditionalGeneration.from_pretrained(model_name)
                self.available_models["m2m100_1.2b"] = {
                    "tokenizer": tokenizer,
                    "model": model,
                    "type": "m2m100"
                }
                print("✅ M2M100-1.2B loaded")
            except Exception as e:
                print(f"⚠️ M2M100-1.2B failed: {e}")
                
        except ImportError:
            print("⚠️ M2M100 not available")
        
        # Try to load MarianMT
        try:
            from transformers import MarianMTModel, MarianTokenizer
            model_name = "Helsinki-NLP/opus-mt-en-es"
            print(f"🔄 Loading MarianMT...")
            tokenizer = MarianTokenizer.from_pretrained(model_name)
            model = MarianMTModel.from_pretrained(model_name)
            self.available_models["marian"] = {
                "tokenizer": tokenizer,
                "model": model,
                "type": "marian"
            }
            print("✅ MarianMT loaded")
        except Exception as e:
            print(f"⚠️ MarianMT failed: {e}")
        
        if self.available_models:
            self.translation_available = True
            print(f"🎯 Available translation models: {list(self.available_models.keys())}")
        else:
            print("❌ No translation models available")
            self.translation_available = False
    
    def _translate_with_model(self, text: str, model_info: dict, target_lang: str) -> str:
        """Translate text with a specific model"""
        try:
            tokenizer = model_info["tokenizer"]
            model = model_info["model"]
            model_type = model_info["type"]
            
            if model_type == "m2m100":
                tokenizer.src_lang = "en"
                inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
                
                lang_mapping = {
                    "es": "es", "fr": "fr", "de": "de", "it": "it", "pt": "pt",
                    "zh": "zh", "ja": "ja", "ko": "ko", "ar": "ar", "hi": "hi", "ru": "ru"
                }
                m2m_target_lang = lang_mapping.get(target_lang, "es")
                
                outputs = model.generate(
                    **inputs,
                    forced_bos_token_id=tokenizer.lang_code_to_id[m2m_target_lang],
                    max_length=512,
                    num_beams=4,
                    early_stopping=True
                )
                return tokenizer.decode(outputs[0], skip_special_tokens=True)
                
            elif model_type == "marian":
                inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
                outputs = model.generate(**inputs, max_length=512, num_beams=4, early_stopping=True)
                return tokenizer.decode(outputs[0], skip_special_tokens=True)
                
        except Exception as e:
            print(f"❌ Translation error with {model_type}: {e}")
            return text
    
    def _get_llm_translation(self, text: str, target_lang: str) -> Optional[str]:
        """Get translation directly from LLM (Qwen) using OpenAI-compatible API"""
        try:
            lang_names = {
                "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
                "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
                "ar": "Arabic", "hi": "Hindi", "ru": "Russian"
            }
            target_lang_name = lang_names.get(target_lang, "Spanish")
            
            prompt = f"""Translate this English text to {target_lang_name}. Provide ONLY the translation, no explanations:

"{text}"

Translation:"""

            response = requests.post(
                f"{self.qwen_endpoint}/v1/chat/completions",
                json={
                    "model": self.judge_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"{prompt} /nothink"
                        }
                    ],
                    "max_tokens": 500,
                    "temperature": 0.1
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                translation = result["choices"][0]["message"]["content"].strip()
                # Clean up common formatting issues
                translation = translation.replace('"', '').strip()
                if translation and translation != text:
                    return translation
            else:
                print(f"Error calling Qwen for translation: {response.status_code}")
                print(f"Response: {response.text}")
            
        except Exception as e:
            print(f"⚠️ LLM translation failed: {e}")
        
        return None
    
    def _judge_translations(self, original_text: str, translations: Dict[str, str], target_lang: str) -> str:
        """Use LLM to judge which translation is best"""
        try:
            lang_names = {
                "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
                "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
                "ar": "Arabic", "hi": "Hindi", "ru": "Russian"
            }
            target_lang_name = lang_names.get(target_lang, "Spanish")
            
            # Format translations for comparison
            options_text = ""
            for i, (model_name, translation) in enumerate(translations.items(), 1):
                options_text += f"{i}. {translation}\n"
            
            prompt = f"""You are a professional translator. Compare these {target_lang_name} translations of the English text:

Original: "{original_text}"

Translation options:
{options_text}

Analyze each translation for:
- Accuracy of meaning
- Natural fluency in {target_lang_name}
- Appropriate tone/register
- Cultural appropriateness

Reply with ONLY the number (1, 2, 3, etc.) of the best translation. No explanation needed."""

            response = requests.post(
                f"{self.qwen_endpoint}/v1/chat/completions",
                json={
                    "model": self.judge_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"{prompt} /nothink"
                        }
                    ],
                    "max_tokens": 500,
                    "temperature": 0.1
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                response_content = result["choices"][0]["message"]["content"]

                # Clean <think> tags (same as your working code)
                cleaned_result = re.sub(r"<think>.*?</think>", "", response_content, flags=re.DOTALL)
                choice = cleaned_result.strip()
                
                # Parse the choice
                try:
                    choice_num = int(choice.split()[0])  # Get first number
                    if 1 <= choice_num <= len(translations):
                        chosen_model = list(translations.keys())[choice_num - 1]
                        chosen_translation = translations[chosen_model]
                        print(f"🎯 Judge selected: {chosen_model} -> '{chosen_translation}'")
                        return chosen_translation
                except:
                    pass
            else:
                print(f"Error calling Qwen for judging: {response.status_code}")
                print(f"Response: {response.text}")
            
        except Exception as e:
            print(f"⚠️ LLM judging failed: {e}")
        
        # Fallback: return first available translation
        return list(translations.values())[0] if translations else original_text

    def _get_llm_translation_with_full_context(self, text: str, target_lang: str, context_before_en: List[str] = None, context_before_translated: List[str] = None, context_after_en: List[str] = None) -> Optional[str]:
        """Get translation directly from LLM (Qwen) with full input/output contextual awareness"""
        try:
            lang_names = {
                "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
                "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
                "ar": "Arabic", "hi": "Hindi", "ru": "Russian"
            }
            target_lang_name = lang_names.get(target_lang, "Spanish")
            
            # Build comprehensive context-aware prompt
            context_prompt = f"You are translating English dialogue to {target_lang_name}. Maintain consistency in style, tone, and terminology with the existing translations."
            
            # Add previous context with both English and translated versions
            if context_before_en and context_before_translated:
                context_prompt += f"\n\nPREVIOUS DIALOGUE CONTEXT:"
                for i, (eng, trans) in enumerate(zip(context_before_en, context_before_translated)):
                    if trans != "[NOT YET TRANSLATED]":
                        context_prompt += f"\nEnglish: \"{eng}\"\n{target_lang_name}: \"{trans}\""
                    else:
                        context_prompt += f"\nEnglish: \"{eng}\"\n{target_lang_name}: [PENDING]"
                
            context_prompt += f"\n\nCURRENT TEXT TO TRANSLATE:\nEnglish: \"{text}\""
            
            # Add following context (English only, as not yet translated)
            if context_after_en:
                context_prompt += f"\n\nUPCOMING DIALOGUE:\n" + "\n".join([f"English: \"{txt}\"" for txt in context_after_en[:2]])
            
            context_prompt += f"\n\nTranslate the current text to {target_lang_name}, ensuring it flows naturally with the previous translations and maintains consistent terminology, tone, and style. Provide ONLY the translation:"

            response = requests.post(
                f"{self.qwen_endpoint}/v1/chat/completions",
                json={
                    "model": self.judge_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"{context_prompt} /nothink"
                        }
                    ],
                    "max_tokens": 500,
                    "temperature": 0.1
                },
                timeout=60
            )

            if response.status_code == 200:
                result = response.json()
                response_content = result["choices"][0]["message"]["content"]
                
                # Clean <think> tags (same as your working code)
                cleaned_result = re.sub(r"<think>.*?</think>", "", response_content, flags=re.DOTALL)
                translation = cleaned_result.strip()
                
                # Clean up common formatting issues
                translation = translation.replace('"', '').strip()
                if translation and translation != text:
                    return translation
            else:
                print(f"Error calling Qwen for full context translation: {response.status_code}")
                print(f"Response: {response.text}")
            
        except Exception as e:
            print(f"⚠️ LLM full context translation failed: {e}")
        
        return None

    def _judge_translations_with_full_context(self, original_text: str, translations: Dict[str, str], target_lang: str, context_before_en: List[str] = None, context_before_translated: List[str] = None, context_after_en: List[str] = None) -> str:
        """Use LLM to judge which translation is best with full input/output contextual awareness"""
        try:
            lang_names = {
                "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
                "pt": "Portuguese", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
                "ar": "Arabic", "hi": "Hindi", "ru": "Russian"
            }
            target_lang_name = lang_names.get(target_lang, "Spanish")
            
            # Build comprehensive context prompt
            prompt = f"You are evaluating {target_lang_name} translations for consistency and quality. Consider both the English context AND the existing {target_lang_name} translations to ensure perfect continuity."
            
            # Add previous dialogue context with translations
            if context_before_en and context_before_translated:
                prompt += f"\n\nPREVIOUS DIALOGUE CONTEXT:"
                for i, (eng, trans) in enumerate(zip(context_before_en, context_before_translated)):
                    if trans != "[NOT YET TRANSLATED]":
                        prompt += f"\nEnglish: \"{eng}\"\n{target_lang_name}: \"{trans}\""
                    else:
                        prompt += f"\nEnglish: \"{eng}\"\n{target_lang_name}: [PENDING]"
            
            prompt += f"\n\nCURRENT TEXT TO EVALUATE:\nEnglish: \"{original_text}\""
            
            # Add upcoming context
            if context_after_en:
                prompt += f"\n\nUPCOMING DIALOGUE:\n" + "\n".join([f"English: \"{txt}\"" for txt in context_after_en[:2]])
            
            # Format translation options
            prompt += f"\n\n{target_lang_name.upper()} TRANSLATION CANDIDATES:"
            for i, (model_name, translation) in enumerate(translations.items(), 1):
                prompt += f"\n{i}. \"{translation}\" [from: {model_name}]"
            
            prompt += f"""

Evaluate each translation considering:
- **Terminology consistency** with previous translations
- **Style/tone continuity** with established {target_lang_name} voice
- **Natural flow** from previous dialogue
- **Accuracy** of meaning and intent
- **Fluency** in {target_lang_name}
- **Contextual appropriateness** for the conversation

Choose the translation that best maintains consistency with the existing {target_lang_name} dialogue while being accurate and natural.

Reply with ONLY the number (1, 2, 3, etc.) of the best translation."""

            response = requests.post(
                f"{self.qwen_endpoint}/v1/chat/completions",
                json={
                    "model": self.judge_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"{prompt} /nothink"
                        }
                    ],
                    "max_tokens": 500,
                    "temperature": 0.1
                },
                timeout=60
            )
                        
            if response.status_code == 200:
                result = response.json()
                response_content = result["choices"][0]["message"]["content"]
                
                # Clean <think> tags (same as your working code)
                cleaned_result = re.sub(r"<think>.*?</think>", "", response_content, flags=re.DOTALL)
                choice = cleaned_result.strip()
                
                # Parse the choice with multiple fallback methods
                try:
                    choice_num = int(choice.split()[0])  # Get first number
                    if 1 <= choice_num <= len(translations):
                        chosen_model = list(translations.keys())[choice_num - 1]
                        chosen_translation = translations[chosen_model]
                        print(f"🎯 Full-context judge selected: {chosen_model} -> '{chosen_translation}'")
                        return chosen_translation
                except:
                    # Try regex parsing
                    numbers = re.findall(r'\b(\d+)\b', choice)
                    if numbers:
                        choice_num = int(numbers[0])
                        if 1 <= choice_num <= len(translations):
                            chosen_model = list(translations.keys())[choice_num - 1]
                            chosen_translation = translations[chosen_model]
                            print(f"🎯 Full-context judge selected (regex): {chosen_model} -> '{chosen_translation}'")
                            return chosen_translation
                
                # If no number found, log the response for debugging
                print(f"⚠️ Could not parse judge response: '{choice}'")
                
            else:
                print(f"Error calling Qwen for full context judging: {response.status_code}")
                print(f"Response: {response.text}")
            
        except Exception as e:
            print(f"⚠️ LLM full context judging failed: {e}")
        
        # Fallback: prefer qwen_direct if available, otherwise first translation
        if "qwen_direct" in translations:
            print("🔄 Fallback: Using qwen_direct translation")
            return translations["qwen_direct"]
        return list(translations.values())[0] if translations else original_text
    
    def translate_single_text(self, text: str, target_lang: str) -> str:
        """Translate a single text using multiple models + LLM judge"""
        if not self.translation_available and not self.llm_judge_enabled:
            return text
        
        translations = {}
        
        # Get LLM translation first (if enabled)
        if self.llm_judge_enabled:
            llm_translation = self._get_llm_translation(text, target_lang)
            if llm_translation:
                translations["qwen_direct"] = llm_translation
        
        # Get translations from available models
        for model_name, model_info in self.available_models.items():
            translation = self._translate_with_model(text, model_info, target_lang)
            if translation and translation != text:
                translations[model_name] = translation
        
        if not translations:
            print(f"⚠️ No translations available for: {text}")
            return text
        
        # If only one translation, use it
        if len(translations) == 1:
            return list(translations.values())[0]
        
        # If multiple translations available, use LLM judge
        if self.llm_judge_enabled and len(translations) > 1:
            print(f"🔍 Comparing {len(translations)} translations for: '{text[:50]}...'")
            return self._judge_translations(text, translations, target_lang)
        else:
            # Fallback: prefer certain models in order
            preference_order = ["qwen_direct", "m2m100_1.2b", "m2m100_418m", "marian"]
            for preferred in preference_order:
                if preferred in translations:
                    return translations[preferred]
            return list(translations.values())[0]
    
    def translate_batch(self, texts: List[str], target_lang: str, context: str = "") -> List[str]:
        """Translate a batch of texts"""
        results = []
        for i, text in enumerate(texts):
            if i % 5 == 0:
                print(f"   Progress: {i+1}/{len(texts)}")
            result = self.translate_single_text(text, target_lang)
            results.append(result)
        return results
    
    def translate_segments(self, segments: List[DubSegment]) -> List[DubSegment]:
        print(f"🌐 Translating {len(segments)} segments with enhanced multi-model approach...")
        
        for i, segment in enumerate(segments):
            if i % 5 == 0:
                print(f"   Progress: {i+1}/{len(segments)}")
            
            # Get context for better translation judgment
            context_before_en, context_before_translated, context_after_en = self._get_segment_context(segments, i)
            
            segment.translated_text = self.translate_single_text_with_context(
                segment.original_text, 
                self.config.get('target_language', 'es'),
                context_before_en,
                context_before_translated,
                context_after_en
            )
        
        print("✅ Enhanced translation completed")
        return segments
    
    def _get_segment_context(self, segments: List[DubSegment], current_index: int, context_window: int = 2) -> tuple:
        """Get context before and after the current segment, including already translated text"""
        context_before_en = []
        context_before_translated = []
        context_after_en = []
        
        # Get segments before (up to context_window)
        start_idx = max(0, current_index - context_window)
        for i in range(start_idx, current_index):
            context_before_en.append(segments[i].original_text)
            # Include already translated text if available
            if segments[i].translated_text:
                context_before_translated.append(segments[i].translated_text)
            else:
                context_before_translated.append("[NOT YET TRANSLATED]")
        
        # Get segments after (up to context_window)
        end_idx = min(len(segments), current_index + context_window + 1)
        for i in range(current_index + 1, end_idx):
            context_after_en.append(segments[i].original_text)
        
        return context_before_en, context_before_translated, context_after_en
    
    def translate_single_text_with_context(self, text: str, target_lang: str, context_before_en: List[str] = None, context_before_translated: List[str] = None, context_after_en: List[str] = None) -> str:
        """Translate text with both input and output contextual awareness"""
        if not self.translation_available and not self.llm_judge_enabled:
            return text
        
        translations = {}
        
        # Get LLM translation first (if enabled) - with full context
        if self.llm_judge_enabled:
            llm_translation = self._get_llm_translation_with_full_context(
                text, target_lang, context_before_en, context_before_translated, context_after_en
            )
            if llm_translation:
                translations["qwen_direct"] = llm_translation
        
        # Get translations from available models (without context for now, as they don't support it well)
        for model_name, model_info in self.available_models.items():
            translation = self._translate_with_model(text, model_info, target_lang)
            if translation and translation != text:
                translations[model_name] = translation
        
        if not translations:
            print(f"⚠️ No translations available for: {text}")
            return text
        
        # If only one translation, use it
        if len(translations) == 1:
            return list(translations.values())[0]
        
        # If multiple translations available, use full context-aware LLM judge
        if self.llm_judge_enabled and len(translations) > 1:
            print(f"🔍 Comparing {len(translations)} translations with full context for: '{text[:50]}...'")
            return self._judge_translations_with_full_context(
                text, translations, target_lang, context_before_en, context_before_translated, context_after_en
            )
        else:
            # Fallback: prefer certain models in order
            preference_order = ["qwen_direct", "m2m100_1.2b", "m2m100_418m", "marian"]
            for preferred in preference_order:
                if preferred in translations:
                    return translations[preferred]
            return list(translations.values())[0]

# Quick test function
def test_translation():
    """Test the translation service"""
    config = {
        "target_language": "es",
        "llm_judge_enabled": True,
        "qwen_endpoint": "http://127.0.0.1:1234",
        "judge_model": "qwen/qwen3-14b"
    }
    
    translator = TranslationService(config=config)
    
    test_texts = [
        "Another autonomous AI, huh?",
        "The system is processing your request.",
        "Welcome to our advanced AI platform."
    ]
    
    for text in test_texts:
        result = translator.translate_single_text(text, "es")
        print(f"'{text}' -> '{result}'")

if __name__ == "__main__":
    # Run test if executed directly
    test_translation()