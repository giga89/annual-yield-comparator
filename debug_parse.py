import requests
import re
import json

def debug_fetch():
    username = "AndreaRavalli"
    url = f"https://api.allorigins.win/raw?url=https://bullaware.com/etoro/{username}"
    print(f"Fetching {url}...")
    
    try:
        resp = requests.get(url)
        text = resp.text
        
        # Regex from script.js
        # const regex = /\\?"monthlyReturns\\?":\s*(\{[^}]+})/;
        # In Python:
        pattern = r'\\?"monthlyReturns\\?":\s*(\{[^}]+\})'
        
        match = re.search(pattern, text)
        
        if match:
            json_string = match.group(1)
            print(f"Match found! Length: {len(json_string)}")
            print(f"Snippet: {json_string[:50]} ... {json_string[-50:]}")
            
            # Cleaning logic
            if '\\"' in json_string:
                print("Detected escaped quotes, cleaning...")
                json_string = json_string.replace('\\"', '"')
            
            print(f"Cleaned snippet: {json_string[:50]}")
            
            try:
                data = json.loads(json_string)
                print("JSON Parse: SUCCESS")
                print(f"Keys: {list(data.keys())[:5]}")
            except json.JSONDecodeError as e:
                print(f"JSON Parse: FAILED - {e}")
                print(f"Failing string: {json_string}")
        else:
            print("Regex NO MATCH")
            print("Context around 'monthlyReturns':")
            idx = text.find("monthlyReturns")
            if idx != -1:
                print(text[idx:idx+100])
            else:
                print("String 'monthlyReturns' not found in text.")

    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    debug_fetch()
