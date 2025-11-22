/**
 * Timeout reference for the notification toast.
 */
let toastTimeout;

/**
 * Displays a floating notification toast.
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
 * Fetches server status/config.
 */
function fetchState() {
    fetch('/admin/api/status')
        .then(response => response.json())
        .then(data => {
            const config = data.config;
            document.getElementById('toggleRunning').checked = config.is_running;
            document.getElementById('togglePause').checked = config.is_paused;
            document.getElementById('toggleApproval').checked = config.require_approval;

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
 * Toggles config states.
 */
function toggleState(key) {
    let checkboxId;
    if (key === 'is_running') checkboxId = 'toggleRunning';
    else if (key === 'is_paused') checkboxId = 'togglePause';
    else checkboxId = 'toggleApproval';

    const value = document.getElementById(checkboxId).checked;

    fetch('/admin/api/status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({[key]: value})
    }).then(() => {
        fetchState();
    });
}

/**
 * Native File Picker.
 */
function openFilePicker() {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    fetch('/admin/api/browse')
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');

            if (data.path) {
                document.getElementById('folderPath').value = data.path;
                showNotification("Folder selected. Click Save to apply.");
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
}

/**
 * Saves text config.
 */
function updateConfig(type) {
    const inputId = type === 'folder' ? 'folderPath' : 'clientPass';
    const configKey = type === 'folder' ? 'folder_path' : 'password';
    const value = document.getElementById(inputId).value;

    fetch('/admin/api/status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({[configKey]: value})
    }).then(() => {
        const msg = type === 'folder' ? 'Shared folder path updated.' : 'Access password updated.';
        showNotification(msg);
    });
}

// --- Logout Modal Logic ---

function showLogoutConfirm() {
    const modal = document.getElementById('logoutConfirmModal');
    const content = document.getElementById('logoutConfirmContent');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

function closeLogoutConfirm() {
    const modal = document.getElementById('logoutConfirmModal');
    const content = document.getElementById('logoutConfirmContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95');
    content.classList.remove('scale-100');
}

function performLogoutAll() {
    fetch('/admin/api/logout_all', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                closeLogoutConfirm();
                showNotification("All clients have been logged out.");
            }
        });
}

// --- Table Logic ---

/**
 * Fetches requests and updates table using Request ID (req_id) for consistency.
 */
function fetchRequests() {
    fetch('/admin/api/requests')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('requestsTable');
            const reqIds = Object.keys(data);

            document.getElementById('pendingCount').innerText = reqIds.length;

            if (reqIds.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center italic text-slate-600">No pending requests</td></tr>';
                return;
            }

            tbody.innerHTML = reqIds.map(id => {
                const req = data[id];
                const timeStr = new Date(req.timestamp * 1000).toLocaleTimeString();
                // Use the Request ID (first 8 chars) for display to match client view
                const displayId = id.substring(0, 8);

                return `
                    <tr class="bg-slate-900/20 hover:bg-slate-800/50 transition">
                        <td class="px-4 py-3 font-mono text-xs">${timeStr}</td>
                        <td class="px-4 py-3 font-mono text-xs text-cyan-400">ID: ${displayId}</td>
                        <td class="px-4 py-3 text-white font-medium">${req.file}</td>
                        <td class="px-4 py-3 flex gap-2">
                            <button onclick="decide('${id}', 'approved')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition">Approve</button>
                            <button onclick="decide('${id}', 'rejected')" class="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs transition">Reject</button>
                        </td>
                    </tr>
                `;
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

setInterval(fetchState, 2000);
setInterval(fetchRequests, 2000);
fetchState();
fetchRequests();