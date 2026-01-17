import math
from functools import wraps
from flask import session, redirect, url_for
from config import SERVER_CONFIG

def format_file_size(size_bytes):
    """
    Converts a file size in bytes to a human-readable string representation
    (e.g., '1.5 MB', '2.0 GB').

    Args:
        size_bytes (int): The size of the file in bytes.

    Returns:
        str: Formatted size string with unit.
    """
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB")
    # Calculate the logarithm to determine the unit index
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

def login_required(f):
    """
    Decorator for Flask routes to enforce authentication.

    Checks if:
    1. The server is strictly 'running'.
    2. The session contains the 'logged_in' flag.
    3. The session token matches the current server session token (handles forced logout).

    If any check fails, clears session and redirects to login.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not SERVER_CONFIG['is_running'] or not session.get('logged_in') or session.get('token') != SERVER_CONFIG['session_token']:
            session.clear()
            return redirect(url_for('client_login'))
        return f(*args, **kwargs)
    return decorated_function