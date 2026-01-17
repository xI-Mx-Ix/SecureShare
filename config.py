import os
import uuid
import socket

# Define base directories for the application context
# Ensures the app runs correctly regardless of where the script is executed
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# Global server configuration and status dictionary
# Stores runtime settings, authentication details, and state flags
SERVER_CONFIG = {
    "folder_path": os.getcwd(),          # The root directory for file serving
    "password": "admin",                 # Default password for client access
    "is_running": True,                  # Master switch: if False, clients get an offline page
    "is_paused": False,                  # Temporarily pauses downloads/previews (blurs client screen)
    "require_approval": False,           # If True, downloads generate a request instead of direct access
    "enable_previews": True,             # Master switch: If False, preview buttons are hidden
    "preview_bypasses_approval": False,  # If False, previews are disabled when 'require_approval' is True
    "session_token": str(uuid.uuid4()),  # Unique token to validate active sessions (security)
    "config_id": str(uuid.uuid4())       # ID to track configuration version (forces client refresh on change)
}

# In-Memory storage for tracking download requests and their statuses
# Key: UUID, Value: Dict with file info and status ('pending', 'approved', 'rejected')
DOWNLOAD_REQUESTS = {}

def get_free_port():
    """
    Identifies a free ephemeral port on the local machine.
    This ensures the Admin Panel doesn't conflict with other running services.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    return port

# Dynamic port assignment for the admin panel
ADMIN_PORT = get_free_port()