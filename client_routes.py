import os
import uuid
import time
import mimetypes
from flask import Flask, render_template, request, redirect, url_for, session, send_from_directory, flash, jsonify
from config import SERVER_CONFIG, DOWNLOAD_REQUESTS, TEMPLATE_DIR, STATIC_DIR
from utils import login_required, format_file_size

# Initialize Flask app for the Client Interface
client_app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
client_app.secret_key = os.urandom(24)

# Maximum size for text files to be previewed (1MB) to prevent browser freezes
MAX_TEXT_PREVIEW_SIZE = 1024 * 1024

@client_app.route('/')
def index():
    """Redirects root to the login page."""
    return redirect(url_for('client_login'))

@client_app.route('/login', methods=['GET', 'POST'])
def client_login():
    """
    Handles client authentication.
    GET: Displays login form.
    POST: Validates password.
    """
    if request.args.get('reason') == 'logout':
        flash('You have been logged out by the administrator.')

    if not SERVER_CONFIG["is_running"]:
        return render_template('client/login.html', error="Server is currently offline.")

    if request.method == 'POST':
        if request.form.get('password') == SERVER_CONFIG["password"]:
            session['logged_in'] = True
            session['token'] = SERVER_CONFIG['session_token']
            return redirect(url_for('client_files'))
        else:
            flash('Invalid Password')

    return render_template('client/login.html')

@client_app.route('/logout')
def client_logout():
    """Clears the session and redirects to login."""
    session.clear()
    return redirect(url_for('client_login'))

@client_app.route('/files')
@login_required
def client_files():
    """
    Lists files and directories for the requested path.
    Also determines the 'category' of files for UI icons.
    """
    root = SERVER_CONFIG["folder_path"]
    req_path = request.args.get('path', '')
    abs_path = os.path.join(root, req_path)

    try:
        # Security check: Ensure the resolved path is inside the root folder (Path Traversal Protection)
        if os.path.commonpath([root, abs_path]) != os.path.normpath(root):
            return "Invalid Path", 403
    except Exception:
        return "Invalid Path", 403

    if not os.path.exists(abs_path):
        return redirect(url_for('client_files'))

    files_list, folders_list = [], []
    try:
        for item in os.listdir(abs_path):
            full = os.path.join(abs_path, item)
            rel = os.path.join(req_path, item).replace("\\", "/")
            if os.path.isdir(full):
                folders_list.append({'name': item, 'path': rel})
            else:
                # Detect file type for preview logic and icons
                mime_type, _ = mimetypes.guess_type(full)
                category = 'unknown'
                if mime_type:
                    if mime_type.startswith('image'): category = 'image'
                    elif mime_type.startswith('video'): category = 'video'
                    elif mime_type.startswith('audio'): category = 'audio'
                    elif mime_type.startswith('text') or item.endswith(('.py', '.js', '.html', '.css', '.json', '.md', '.log', '.txt')): category = 'text'

                # Fallback for code files without mime types
                if category == 'unknown' and item.endswith(('.py', '.js', '.html', '.css', '.json', '.md', '.log', '.txt', '.c', '.cpp', '.h')):
                    category = 'text'

                files_list.append({
                    'name': item,
                    'size': format_file_size(os.path.getsize(full)),
                    'path': rel,
                    'category': category
                })
    except Exception as e:
        return f"Error accessing directory: {e}", 500

    return render_template('client/files.html',
                           files=files_list,
                           folders=folders_list,
                           current_path=req_path,
                           parent=os.path.dirname(req_path) if req_path else None)

@client_app.route('/api/client/status')
def client_status():
    """
    Returns the current server configuration state to the client.
    Used for polling to update UI (pause overlay, preview buttons, logout).
    """
    token_valid = session.get('token') == SERVER_CONFIG['session_token']
    force_logout = session.get('logged_in') and not token_valid

    return jsonify({
        "paused": SERVER_CONFIG["is_paused"],
        "running": SERVER_CONFIG["is_running"],
        "force_logout": force_logout,
        "config_id": SERVER_CONFIG["config_id"],

        # Send preview-specific config so JS can toggle button states
        "enable_previews": SERVER_CONFIG["enable_previews"],
        "require_approval": SERVER_CONFIG["require_approval"],
        "preview_bypasses_approval": SERVER_CONFIG["preview_bypasses_approval"]
    })

@client_app.route('/preview_content')
@login_required
def preview_content():
    """
    Serves the file content for inline viewing (Lightbox).
    Enforces strict logic regarding the 'Approval' vs 'Preview' settings.
    """
    # 1. Global Server Pause Check
    if SERVER_CONFIG["is_paused"]:
        return "Server Paused", 403

    # 2. Global Preview Switch Check
    if not SERVER_CONFIG["enable_previews"]:
        return "Previews are currently disabled by the administrator.", 403

    # 3. Approval Logic Check
    # If Approval is required for downloads, AND we haven't allowed preview bypass, block it.
    if SERVER_CONFIG["require_approval"] and not SERVER_CONFIG["preview_bypasses_approval"]:
        return "Preview restricted: Admin approval is required for files.", 403

    filepath = request.args.get('filepath')
    if not filepath:
        return "No path provided", 400

    full_path = os.path.join(SERVER_CONFIG["folder_path"], filepath)

    # 4. Path Traversal Security Check
    try:
        if os.path.commonpath([SERVER_CONFIG["folder_path"], full_path]) != os.path.normpath(SERVER_CONFIG["folder_path"]):
            return "Invalid Path", 403
    except:
        return "Invalid Path", 403

    if not os.path.exists(full_path):
        return "File not found", 404

    # 5. Text File Size Limit Check
    mime_type, _ = mimetypes.guess_type(full_path)
    is_text = (mime_type and mime_type.startswith('text')) or full_path.endswith(('.py', '.js', '.json', '.md', '.txt', '.log'))

    if is_text:
        if os.path.getsize(full_path) > MAX_TEXT_PREVIEW_SIZE:
            return "File is too large to preview inline.", 413

    # Serve the file content inline (not as attachment)
    return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path), as_attachment=False)

@client_app.route('/api/client/request_download', methods=['POST'])
@login_required
def request_download():
    """
    Initiates a file download.
    If 'require_approval' is True, creates a pending request.
    Otherwise, returns a direct link.
    """
    data = request.json
    filename, rel_path = data.get('filename'), data.get('path', data.get('filename'))
    full_path = os.path.join(SERVER_CONFIG["folder_path"], rel_path)

    if not os.path.exists(full_path):
        return jsonify({"error": "File not found"}), 404

    file_rel_path = rel_path.replace("\\", "/")

    if not SERVER_CONFIG["require_approval"]:
        return jsonify({
            "status": "approved",
            "direct_link": url_for('download_content', filepath=file_rel_path)
        })

    # Create a new request ID
    req_id = str(uuid.uuid4())
    DOWNLOAD_REQUESTS[req_id] = {
        'file': filename, 'filepath': file_rel_path, 'status': 'pending', 'timestamp': time.time()
    }
    return jsonify({"status": "pending", "req_id": req_id})

@client_app.route('/api/client/check_request/<req_id>')
@login_required
def check_request(req_id):
    """Polls the status of a specific download request."""
    if req_id not in DOWNLOAD_REQUESTS:
        return jsonify({"status": "error"})
    req = DOWNLOAD_REQUESTS[req_id]
    res = {"status": req['status']}
    if req['status'] == 'approved':
        res['link'] = url_for('download_content', filepath=req['filepath'], token=req_id)
    return jsonify(res)

@client_app.route('/download_final')
@login_required
def download_content():
    """
    Serves the actual file for download (attachment).
    Validates tokens if approval was required.
    """
    filepath, token = request.args.get('filepath'), request.args.get('token')

    if SERVER_CONFIG["is_paused"]: return "Server Paused", 403

    if SERVER_CONFIG["require_approval"]:
        if not token or token not in DOWNLOAD_REQUESTS or DOWNLOAD_REQUESTS[token]['status'] != 'approved':
            return "Access Denied", 403
        # Clean up request after successful link generation
        if token in DOWNLOAD_REQUESTS:
            del DOWNLOAD_REQUESTS[token]

    full_path = os.path.join(SERVER_CONFIG["folder_path"], filepath)
    return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path), as_attachment=True)