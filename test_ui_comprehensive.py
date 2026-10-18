import subprocess
import time
import requests
import sys
import re

def start_streamlit(port=8506):
    """Start streamlit app in the background."""
    proc = subprocess.Popen(
        [sys.executable, '-m', 'streamlit', 'run', 'app.py', '--server.port', str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    # Wait for the app to start
    time.sleep(3)
    return proc

def stop_streamlit(proc):
    """Stop the streamlit process."""
    proc.terminate()
    proc.wait()

def check_ui_elements(port=8506):
    """Fetch the main page and check for essential UI elements."""
    try:
        response = requests.get(f'http://localhost:{port}', timeout=10)
        if response.status_code != 200:
            print(f"ERROR: Streamlit app returned status {response.status_code}")
            return False, []
        html = response.text
        # Convert to lowercase for case-insensitive matching where appropriate
        html_lower = html.lower()
        # List of checks: (description, pattern, required)
        checks = [
            ("Page title contains HELIOS", r'helios', True),
            ("Astronaut selector present", r'select astronaut', True),
            ("Chart type selector present", r'chart type', True),
            ("Health Risk Index section present", r'health risk index', True),
            ("Latest Measurements section present", r'latest measurements', True),
            ("ML Intelligence section present", r'ml intelligence', True),
            ("Alert Center section present", r'alert center', True),
            ("Mission Health Status section present", r'mission health status', True),
            ("Longitudinal Trend option in chart selector", r'longitudinal trend', True),
            # Check that there are no obvious error traces
            ("No traceback in HTML", r'traceback', False),
            ("No exception in HTML", r'exception', False),
        ]
        results = []
        all_passed = True
        for desc, pattern, required in checks:
            # For the negative checks, we want the pattern NOT to be found
            if not required:
                found = re.search(pattern, html_lower, re.IGNORECASE) is not None
                passed = not found
                results.append((desc, passed))
                if not passed:
                    all_passed = False
                    print(f"  [FAIL] {desc} (found unwanted pattern)")
                else:
                    print(f"  [OK] {desc}")
            else:
                found = re.search(pattern, html_lower, re.IGNORECASE) is not None
                passed = found
                results.append((desc, passed))
                if not passed:
                    all_passed = False
                    print(f"  [FAIL] {desc}")
                else:
                    print(f"  [OK] {desc}")
        return all_passed, results
    except Exception as e:
        print(f"ERROR fetching page: {e}")
        return False, []

def main():
    print("=== Comprehensive UI Audit ===")
    port = 8506
    proc = None
    try:
        print(f"Starting Streamlit app on port {port}...")
        proc = start_streamlit(port)
        # Give it a bit more time to start
        time.sleep(5)
        print("Checking UI elements...")
        passed, details = check_ui_elements(port)
        if passed:
            print("\nRESULT: All UI elements are present and no obvious errors detected.")
        else:
            print("\nRESULT: Some UI elements are missing or errors detected.")
            print("Details:")
            for desc, ok in details:
                status = "OK" if ok else "FAIL"
                print(f"  [{status}] {desc}")
    finally:
        if proc:
            print("\nStopping Streamlit app...")
            stop_streamlit(proc)

if __name__ == '__main__':
    main()