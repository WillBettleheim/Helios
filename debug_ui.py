import requests
import sys

try:
    response = requests.get('http://localhost:8503', timeout=5)
    print(f"Status: {response.status_code}")
    html = response.text
    # Print first 2000 chars
    print(html[:2000])
except Exception as e:
    print(f"Error: {e}")