import os
import uuid
import socket

# Define base directories for the application context
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# Global server configuration and status dictionary
# Stores runtime settings, authentication details, and state flags
SERVER_CONFIG = {
    "folder_path": os.getcwd(),          # The root directory for file serving
    "password": "admin",                 # Default password for client access
    "is_running": True,                  # Master switch for the server
    "is_paused": False,                  # Temporarily pauses downloads
    "require_approval": False,           # Toggles admin approval requirement for downloads
    "session_token": str(uuid.uuid4()),  # Unique token to validate active sessions
    "config_id": str(uuid.uuid4())       # ID to track configuration version changes
}

# In-Memory storage for tracking download requests and their statuses
DOWNLOAD_REQUESTS = {}

def get_free_port():
    """
    Identifies a free ephemeral port on the local machine.

    Creates a temporary socket, binds it to port 0 (system assigns free port),
    retrieves the port number, and closes the socket.

    Returns:
        int: An available port number.
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    return port

# dynamic port assignment for the admin panel
ADMIN_PORT = get_free_port()