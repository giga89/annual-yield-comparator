
import re

with open("proxy_test3.html", "r") as f:
    content = f.read()

# Try to find monthlyReturns
# Pattern to match: "monthlyReturns":{...} or \"monthlyReturns\":{...}
# The value is a JS object/JSON
pattern = r'\\?"monthlyReturns\\?":\s*({[^}]+})'

matches = re.findall(pattern, content)
print(f"Found {len(matches)} matches")

for i, m in enumerate(matches):
    print(f"Match {i}: {m[:100]}...")
    try:
        # Try to parse as is
        import json
        print("  Direct JSON parse: Success")
    except:
        print("  Direct JSON parse: Failed")
        
    # Try to unescape
    unescaped = m.replace('\\"', '"')
    print(f"  Unescaped: {unescaped[:100]}...")
    try:
        import json
        json.loads(unescaped)
        print("  Unescaped JSON parse: Success")
    except Exception as e:
        print(f"  Unescaped JSON parse: Failed ({e})")
