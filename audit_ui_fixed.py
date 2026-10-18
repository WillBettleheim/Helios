import sys
import time
import subprocess
import requests
import re

def start_streamlit(port=8503):
    # Start streamlit app in background on specified port
    proc = subprocess.Popen(['streamlit', 'run', 'app.py', '--server.port', str(port)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(3)  # give it time to start
    return proc

def stop_streamlit(proc):
    proc.terminate()
    proc.wait()

def check_page(port=8503):
    try:
        response = requests.get(f'http://localhost:{port}', timeout=5)
        if response.status_code != 200:
            print(f"ERROR: Streamlit app returned status {response.status_code}")
            return False
        html = response.text
        # Check for key elements
        checks = [
            ('HELIOS title', re.search(r'HELIOS', html, re.I)),
            ('Astronaut selector', re.search(r'Select Astronaut', html)),
            ('Health Risk Index', re.search(r'Health Risk Index', html, re.I)),
            ('Chart type selector', re.search(r'Chart Type', html)),
            ('Latest Measurements', re.search(r'Latest Measurements', html)),
            ('ML Intelligence', re.search(r'ML Intelligence', html)),
            ('Alert Center', re.search(r'Alert Center', html)),
            ('Mission Health Status', re.search(r'Mission Health Status', html)),
        ]
        all_ok = True
        for name, match in checks:
            if match:
                print(f"  [OK] {name}")
            else:
                print(f"  [FAIL] {name}")
                all_ok = False
        return all_ok
    except Exception as e:
        print(f"ERROR fetching page: {e}")
        return False

def main():
    print("Starting Streamlit app for UI audit on port 8503...")
    proc = start_streamlit(8503)
    try:
        ok = check_page(8503)
        if ok:
            print("\nUI audit: All expected elements found.")
        else:
            print("\nUI audit: Some elements missing or errors.")
    finally:
        stop_streamlit(proc)

if __name__ == '__main__':
    main()