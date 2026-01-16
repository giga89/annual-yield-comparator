import requests
import re
import json
import os

def fetch_and_calculate_returns():
    url = "https://bullaware.com/etoro/AndreaRavalli"
    print(f"Fetching data from {url}...")
    
    try:
        response = requests.get(url, timeout=15)
        content = response.text
        
        # Regex to find all monthly returns: \"YYYY-M\": RETURN
        # Matches \"2023-1\": 5.4 or "2023-1": 5.4
        pattern = r'\\?["\'](\d{4})-(\d{1,2})\\?["\']:\s*([+-]?\d+\.?\d*)'
        matches = re.findall(pattern, content)
        
        if not matches:
            print("No data found! Regex didn't match.")
            return

        # Organize by year using a dict to prevent duplicates (page might contain same data multiple times)
        years_data = {}
        for year_str, month_str, val_str in matches:
            year = int(year_str)
            month = int(month_str)
            val = float(val_str)
            
            # Simple validation
            if month < 1 or month > 12:
                continue
                
            if year not in years_data:
                years_data[year] = {}
            
            # This overwrites if duplicate found (likely same value)
            years_data[year][month] = val

        # Calculate Annual Yields
        results = {}
        print("\nCalculated Annual Returns:")
        print("-" * 30)
        
        for year in sorted(years_data.keys()):
            # Sort by month
            months = sorted(years_data[year].items(), key=lambda x: x[0])

            
            # Compound returns: (1 + r1/100) * (1 + r2/100) ... - 1
            compounded = 1.0
            for _, ret in months:
                compounded *= (1 + ret / 100.0)
            
            annual_yield = (compounded - 1.0) * 100
            # precision to 2 decimals
            annual_yield = round(annual_yield, 2)
            
            results[year] = annual_yield
            print(f"{year}: {annual_yield}% (based on {len(months)} months)")

        # Create JS file content
        js_content = f"const fetchedUserReturns = {json.dumps(results, indent=4)};"
        
        with open("user_data.js", "w") as f:
            f.write(js_content)
            
        print("-" * 30)
        print("\nSuccessfully saved to user_data.js")
        print("Refresh index.html to see the data!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_and_calculate_returns()
