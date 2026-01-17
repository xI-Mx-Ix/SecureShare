import threading
import time
import webbrowser
from config import ADMIN_PORT
from client_routes import client_app
from admin_routes import admin_app

def open_browser():
    """
    Waits for the server to initialize, then opens the Admin Panel
    in the system's default web browser.
    """
    time.sleep(1.5)
    admin_url = f"http://127.0.0.1:{ADMIN_PORT}/admin"
    print(f"\n[INFO] Admin Panel: {admin_url}")
    print(f"[INFO] Client Server running on port 5000\n")
    webbrowser.open(admin_url)

def run_client():
    """Runs the Client Flask application on port 5000 (accessible externally)."""
    client_app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

def run_admin():
    """Runs the Admin Flask application on the randomly assigned local port."""
    admin_app.run(host='127.0.0.1', port=ADMIN_PORT, debug=False, use_reloader=False)

if __name__ == "__main__":
    # Start the browser launcher in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start the client server in a background thread so it runs concurrently
    client_thread = threading.Thread(target=run_client, daemon=True)
    client_thread.start()

    # Run the admin server on the main thread
    run_admin()