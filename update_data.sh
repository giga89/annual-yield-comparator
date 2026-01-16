#!/bin/bash
# Activate venv and run the fetch script
source venv/bin/activate
python fetch_data.py
echo "Data updated! Refresh your browser."
