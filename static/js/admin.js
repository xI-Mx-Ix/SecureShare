/**
 * Secure Share Admin Logic
 * Handles real-time config updates, UI rendering, and request management.
 */

let toastTimeout;

/**
 * Shows a toast notification.
 */
function showNotification(message) {
    const toast = document.getElementById('notificationToast');
    const msgEl = document.getElementById('toastMessage');
    msgEl.innerText = message;

    toast.classList.remove('translate-y-20', 'opacity-0');
    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

/**
 * Fetches current server configuration and updates the UI toggles.
 */
function fetchState() {
    fetch('/admin/api/status')
        .then(response => response.json())
        .then(data => {
            const config = data.config;

            // Sync Checkboxes
            document.getElementById('toggleRunning').checked = config.is_running;
            document.getElementById('togglePause').checked = config.is_paused;
            document.getElementById('toggleApproval').checked = config.require_approval;

            // Sync New Preview Toggles
            document.getElementById('togglePreviews').checked = config.enable_previews;
            document.getElementById('togglePreviewBypass').checked = config.preview_bypasses_approval;

            // Sync Header Status
            const indicator = document.getElementById('status-indicator');
            if (config.is_running) {
                indicator.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                indicator.innerHTML = '<i class="fas fa-circle text-[8px] mr-2"></i>Active';
            } else {
                indicator.className = "px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30";
                indicator.innerHTML = '<i class="fas fa-circle text-[8px] mr-2"></i>Offline';
            }
        });
}

/**
 * Sends a configuration update to the server.
 */
function toggleState(key) {
    let checkboxId;
    // Map config keys to HTML IDs
    if (key === 'is_running') checkboxId = 'toggleRunning';
    else if (key === 'is_paused') checkboxId = 'togglePause';
    else if (key === 'require_approval') checkboxId = 'toggleApproval';
    else if (key === 'enable_previews') checkboxId = 'togglePreviews';
    else if (key === 'preview_bypasses_approval') checkboxId = 'togglePreviewBypass';

    const value = document.getElementById(checkboxId).checked;

    fetch('/admin/api/status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({[key]: value})
    })
        .then(() => fetchState()) // Re-fetch to ensure sync
        .catch(() => showNotification("Connection Error"));
}

/**
 * Opens Server-Side Folder Picker.
 */
function openFilePicker() {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.classList.add('opacity-50');

    fetch('/admin/api/browse')
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.classList.remove('opacity-50');
            if (data.path) {
                document.getElementById('folderPath').value = data.path;
                showNotification("Path selected. Click save.");
            }
        });
}

/**
 * Updates text-based config (Path, Password).
 */
function updateConfig(type) {
    const inputId = type === 'folder' ? 'folderPath' : 'clientPass';
    const configKey = type === 'folder' ? 'folder_path' : 'password';

    fetch('/admin/api/status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({[configKey]: document.getElementById(inputId).value})
    }).then(() => showNotification("Configuration Saved."));
}

/**
 * Logout Modal Logic
 */
function showLogoutConfirm() {
    const modal = document.getElementById('logoutConfirmModal');
    const content = document.getElementById('logoutConfirmContent');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95'); content.classList.add('scale-100');
}
function closeLogoutConfirm() {
    const modal = document.getElementById('logoutConfirmModal');
    const content = document.getElementById('logoutConfirmContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95'); content.classList.remove('scale-100');
}
function performLogoutAll() {
    fetch('/admin/api/logout_all', { method: 'POST' }).then(r => r.json()).then(d => {
        closeLogoutConfirm();
        showNotification("All clients logged out.");
    });
}

/**
 * Request Table Logic
 */
function fetchRequests() {
    fetch('/admin/api/requests')
        .then(response => response.json())
        .then(data => {
            const ids = Object.keys(data);
            document.getElementById('pendingCount').innerText = ids.length;
            const tb = document.getElementById('requestsTable');

            if (!ids.length) {
                tb.innerHTML = '<tr class="text-center py-4"><td colspan="4" class="py-6 italic text-slate-500">No pending requests</td></tr>';
                return;
            }

            tb.innerHTML = ids.map(id => {
                const req = data[id];
                const date = new Date(req.timestamp * 1000).toLocaleTimeString();
                return `
                <tr class="bg-slate-900/20 hover:bg-slate-800/50 transition border-b border-slate-800/50 last:border-0">
                    <td class="px-4 py-3 font-mono text-xs text-slate-400">${date}</td>
                    <td class="px-4 py-3 font-mono text-xs text-cyan-400">ID: ${id.substring(0, 8)}</td>
                    <td class="px-4 py-3 text-white font-medium">${req.file}</td>
                    <td class="px-4 py-3 text-right">
                        <div class="flex justify-end gap-2">
                            <button onclick="decide('${id}', 'approved')" class="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-600/30 rounded text-xs transition font-bold">Approve</button>
                            <button onclick="decide('${id}', 'rejected')" class="px-3 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/30 rounded text-xs transition font-bold">Reject</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        });
}

function decide(reqId, decision) {
    fetch('/admin/api/decision', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({req_id: reqId, decision: decision})
    }).then(() => {
        fetchRequests();
        showNotification(`Request ${decision}.`);
    });
}

// Start Loops
setInterval(fetchState, 1500);
setInterval(fetchRequests, 1500);
fetchState();
fetchRequests();