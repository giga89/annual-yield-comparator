
import re

with open("debug_borisaka_caps.html", "r") as f:
    content = f.read()

# Pattern matching script.js logic
regex = r'\\?"monthlyReturns\\?":\s*(\{[^}]+})'
match = re.search(regex, content)

if match:
    print(f"MATCH FOUND: {match.group(0)[:100]}...")
    print(f"GROUP 1: {match.group(1)[:100]}...")
else:
    print("NO MATCH FOUND")
    # Show context around monthlyReturns
    idx = content.find("monthlyReturns")
    if idx != -1:
        print(f"Context: {content[idx-50:idx+200]}")
