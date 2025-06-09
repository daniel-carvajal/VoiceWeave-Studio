import json
import os
from typing import Dict

def load_dubbing_rules() -> Dict:
    from config import config

    """Load dubbing rules from JSON file created by the GUI"""
    rules_path = config.get("rules_file", "dubbing-rules.json")
    
    # Default rules structure
    default_rules = {
        "textRules": [],
        "segmentRules": [],
        "audioSettings": {
            "globalCrossfade": False,
            "crossfadeDuration": 150,
            "autoDetectPauses": False,
            "pauseThreshold": 300,
            "preventOverlaps": True,
            "minGap": 100,
            "autoAdjustLength": False,
            "maxStretch": 120
        }
    }
    
    if not os.path.exists(rules_path):
        print(f"📄 No rules file found at {rules_path}, using defaults")
        return default_rules
    
    try:
        with open(rules_path, 'r', encoding='utf-8') as f:
            rules = json.load(f)
            print(f"✅ Loaded dubbing rules from {rules_path}")
            return rules
    except Exception as e:
        print(f"⚠️ Error loading rules file: {e}")
        return default_rules
