import yfinance as yf
import json
import datetime
import pandas as pd

# Configuration
TICKERS = {
    "SPX500": "^GSPC",
    "NSDQ100": "^NDX",
    "SWDA_L": "URTH", 
    "EUSTX50": "^STOXX50E",
    "CHINA50": "FXI"
}

COLORS = {
    "SPX500": "#38bdf8",
    "NSDQ100": "#a855f7",
    "SWDA_L": "#f472b6",
    "EUSTX50": "#fbbf24",
    "CHINA50": "#ef4444"
}

def fetch_history_from_2000():
    print("Fetching historical data from 2000 to present...")
    
    final_data = {}
    current_year = datetime.datetime.now().year
    
    for key, ticker_symbol in TICKERS.items():
        print(f"  Processing {key} ({ticker_symbol})...")
        try:
            ticker = yf.Ticker(ticker_symbol)
            # Fetch daily data from 2000-01-01
            # We fetch a bit earlier to allow 'previous close' calculation if needed, 
            # but usually start of year open is fine for a rough annual calc, 
            # or better: Year End Close vs Prev Year End Close.
            # Let's fetch from 1999-12-25 to ensure we have the close of 1999 for 2000 calc if strictly needed.
            # But simpler: For 2000, use (Close_2000 - Open_2000) / Open_2000.
            # For 2001+, use (Close_2001 - Close_2000) / Close_2000.
            # Actually, standard YTD/Annual on simple charts often just does (Last / First - 1) for that period.
            
            hist = ticker.history(start="2000-01-01", interval="1d")
            
            if hist.empty:
                print(f"    Warning: No data found for {ticker_symbol}")
                continue
            
            # Resample to Annual O-H-L-C (taking last Close of year)
            # We want percentage change per year.
            # One way: Resample to 'Y', take last Close. pct_change()
            
            annual_closes = hist['Close'].resample('YE').last()
            
            # But this calculates return based on prev year close.
            # So 2000 return would need 1999 close.
            # If we don't have 1999 close, the first entry in pct_change will be NaN.
            # To fix this for Year 2000, we can calculate it manually: (Close_2000 / Open_Jan2000) - 1.
            
            annual_returns = annual_closes.pct_change() * 100
            
            # Fix first year (2000)
            y2000_close = annual_closes.iloc[0]
            # Find open of 2000
            y2000_open = hist['Open'].iloc[0]
            y2000_return = ((y2000_close - y2000_open) / y2000_open) * 100
            
            # Convert series to map { year: val }
            returns_map = {}
            for date, val in annual_returns.items():
                year = date.year
                if year == 2000:
                    returns_map[year] = round(y2000_return, 2)
                else:
                    returns_map[year] = round(val, 2)

            # Special Check for Current Year (YTD) logic
            # If we are in the middle of a year, resample 'Y' might give the current close, 
            # and pct_change compares it to last year close. This is effectively YTD.
            # Just ensure the last point is included properly.
            # The 'YE' (Year End) usually defaults to Dec 31. Pandas might label 2026 data as Dec 31 2026 even today.
            
            final_data[key] = {
                "name": key,
                "color": COLORS.get(key, "#cccccc"),
                "returns": returns_map
            }
            
        except Exception as e:
            print(f"    Error fetching {key}: {e}")
            # Fallback? Maybe keep partial?
            
    return final_data

def save_to_js(data):
    js_content = f"const indicesData = {json.dumps(data, indent=4)};"
    with open("indices_data.js", "w") as f:
        f.write(js_content)
    print("\nSuccessfully updated 'indices_data.js'")

if __name__ == "__main__":
    data = fetch_history_from_2000()
    save_to_js(data)
