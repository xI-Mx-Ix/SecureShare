import os
import uuid
import tkinter as tk
from tkinter import filedialog
from flask import Flask, render_template, request, redirect, jsonify, session
from config import SERVER_CONFIG, DOWNLOAD_REQUESTS, TEMPLATE_DIR, STATIC_DIR

# Initialize Flask app for the Admin Interface
admin_app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
admin_app.secret_key = os.urandom(24)

@admin_app.route('/')
def admin_root():
    """Redirects the root URL to the admin dashboard."""
    return redirect('/admin')

@admin_app.route('/admin')
def admin_dashboard():
    """Renders the main administration dashboard with current configuration."""
    return render_template('server/index.html', config=SERVER_CONFIG)

@admin_app.route('/admin/api/status', methods=['GET', 'POST'])
def admin_api_status():
    """
    API endpoint to get or update server status.

    POST: Updates configuration keys (password, running state, pause state, approval mode).
          If a folder path is provided and valid, updates the root directory and config ID.
    GET:  Returns current configuration and count of pending requests.
    """
    if request.method == 'POST':
        data = request.json
        for key in ['password', 'is_running', 'is_paused', 'require_approval']:
            if key in data: SERVER_CONFIG[key] = data[key]
        if 'folder_path' in data and os.path.exists(data['folder_path']):
            SERVER_CONFIG['folder_path'] = data['folder_path']
            SERVER_CONFIG['config_id'] = str(uuid.uuid4())
        return jsonify({"status": "updated"})

    return jsonify({
        "config": SERVER_CONFIG,
        "pending_count": len([r for r in DOWNLOAD_REQUESTS.values() if r['status'] == 'pending'])
    })

@admin_app.route('/admin/api/browse')
def admin_api_browse():
    """
    Opens a native OS folder selection dialog on the server machine using Tkinter.

    Uses a hidden root window to display the dialog on top.
    Returns the selected path to the frontend.
    """
    root = tk.Tk()
    root.withdraw() # Hide the main window
    root.attributes('-topmost', True)
    path = filedialog.askdirectory(initialdir=SERVER_CONFIG['folder_path'])
    root.destroy()
    return jsonify({"path": path if path else None})

@admin_app.route('/admin/api/logout_all', methods=['POST'])
def admin_api_logout_all():
    """
    Invalidates all client sessions by regenerating the server session token.
    Clients with the old token will be forced to log in again.
    """
    SERVER_CONFIG['session_token'] = str(uuid.uuid4())
    return jsonify({"success": True})

@admin_app.route('/admin/api/requests')
def admin_api_requests():
    """Returns a list of all pending download requests requiring approval."""
    pending = {k: v for k, v in DOWNLOAD_REQUESTS.items() if v['status'] == 'pending'}
    return jsonify(pending)

@admin_app.route('/admin/api/decision', methods=['POST'])
def admin_api_decision():
    """
    Processes an admin's decision (approve/deny) for a specific request.
    Updates the status of the request in memory.
    """
    data = request.json
    req_id, decision = data.get('req_id'), data.get('decision')
    if req_id in DOWNLOAD_REQUESTS:
        DOWNLOAD_REQUESTS[req_id]['status'] = decision
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404