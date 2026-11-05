"""Accept contiguous complete sentences, never a clipped negation or condition."""
import re

BOUNDARIES = "。！？!?；;\n"


def is_complete_quote(content: str, quote: str) -> bool:
    quote = quote.strip()
    if len(quote) < 2:
        return False
    for match in re.finditer(re.escape(quote), content):
        before = content[:match.start()].rstrip(" \t\r")
        after = content[match.end():].strip()
        start_ok = not before or before[-1] in BOUNDARIES
        end_ok = not after or quote[-1] in BOUNDARIES
        if start_ok and end_ok:
            return True
    return False
