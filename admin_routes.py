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
    return redirect('/admin')

@admin_app.route('/admin')
def admin_dashboard():
    """Renders the admin dashboard with the current config."""
    return render_template('server/index.html', config=SERVER_CONFIG)

@admin_app.route('/admin/api/status', methods=['GET', 'POST'])
def admin_api_status():
    """
    API endpoint to read or update server configuration.
    Handles toggling of all boolean flags including new preview settings.
    """
    if request.method == 'POST':
        data = request.json

        # Valid configuration keys that can be updated via this endpoint
        allowed_keys = [
            'password', 'is_running', 'is_paused', 'require_approval',
            'enable_previews', 'preview_bypasses_approval'
        ]

        # Update config only for allowed keys present in the request
        for key in allowed_keys:
            if key in data: SERVER_CONFIG[key] = data[key]

        # Handle folder path update (requires validation)
        if 'folder_path' in data and os.path.exists(data['folder_path']):
            SERVER_CONFIG['folder_path'] = data['folder_path']
            # Changing the folder invalidates current client views
            SERVER_CONFIG['config_id'] = str(uuid.uuid4())

        return jsonify({"status": "updated"})

    return jsonify({
        "config": SERVER_CONFIG,
        "pending_count": len([r for r in DOWNLOAD_REQUESTS.values() if r['status'] == 'pending'])
    })

@admin_app.route('/admin/api/browse')
def admin_api_browse():
    """Opens a server-side directory picker."""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    path = filedialog.askdirectory(initialdir=SERVER_CONFIG['folder_path'])
    root.destroy()
    return jsonify({"path": path if path else None})

@admin_app.route('/admin/api/logout_all', methods=['POST'])
def admin_api_logout_all():
    """Invalidates the session token, forcing all clients to re-login."""
    SERVER_CONFIG['session_token'] = str(uuid.uuid4())
    return jsonify({"success": True})

@admin_app.route('/admin/api/requests')
def admin_api_requests():
    """Returns the list of pending file requests."""
    pending = {k: v for k, v in DOWNLOAD_REQUESTS.items() if v['status'] == 'pending'}
    return jsonify(pending)

@admin_app.route('/admin/api/decision', methods=['POST'])
def admin_api_decision():
    """Processes an admin's decision (Approve/Reject) for a file request."""
    data = request.json
    req_id, decision = data.get('req_id'), data.get('decision')
    if req_id in DOWNLOAD_REQUESTS:
        DOWNLOAD_REQUESTS[req_id]['status'] = decision
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404