from typing import Dict, List


def apply_text_rules(text: str, language: str, rules: List[Dict]) -> str:
    """Apply text replacement rules to improve pronunciation"""
    if not rules:
        return text
    
    modified_text = text
    applied_rules = []
    
    # Sort rules by priority (high -> medium -> low)
    priority_order = {"high": 0, "medium": 1, "low": 2}
    sorted_rules = sorted(rules, key=lambda r: priority_order.get(r.get("priority", "medium"), 1))
    
    for rule in sorted_rules:
        # Check if rule applies to this language
        rule_lang = rule.get("language", "all")
        if rule_lang != "all" and rule_lang != language:
            continue
            
        original = rule.get("original", "")
        replacement = rule.get("replacement", "")
        case_sensitive = rule.get("caseSensitive", False)
        
        if not original or not replacement:
            continue
        
        # Apply replacement
        if case_sensitive:
            if original in modified_text:
                modified_text = modified_text.replace(original, replacement)
                applied_rules.append(rule.get("original"))
        else:
            # Case-insensitive replacement
            import re
            pattern = re.compile(re.escape(original), re.IGNORECASE)
            if pattern.search(modified_text):
                modified_text = pattern.sub(replacement, modified_text)
                applied_rules.append(rule.get("original"))
    
    if applied_rules:
        print(f"📝 Applied text rules: {', '.join(applied_rules)}")
    
    return modified_text
