/**
 * Secure Share Client Logic
 * Handles View Toggling, Status Polling, Lightbox Previews, and Dynamic UI Updates.
 */

let isGridView = true;
let pausedState = false;
let currentConfigId = null;
let currentReqId = null;
let pollInterval = null;

/**
 * Loads the user's view preference (Grid vs List) from LocalStorage.
 */
function loadViewPreference() {
    const savedMode = localStorage.getItem('viewMode');
    if (savedMode === 'list') {
        toggleView(true);
    }
}

/**
 * Toggles between Grid and List view layouts.
 * Manipulates classes on the file container and individual file cards.
 */
function toggleView(forceList = false) {
    if (forceList) isGridView = false;
    else isGridView = !isGridView;
    localStorage.setItem('viewMode', isGridView ? 'grid' : 'list');

    const container = document.getElementById('fileContainer');
    const icon = document.getElementById('viewIcon');
    const cards = document.querySelectorAll('.file-card');

    if (isGridView) {
        // GRID VIEW STYLES
        container.classList.remove('flex', 'flex-col', 'gap-3');
        container.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-4');
        icon.className = "fas fa-list-ul";

        cards.forEach(el => {
            el.classList.remove('flex-row', 'items-center', 'h-20', 'px-5', 'py-0', 'w-full');
            el.classList.add('flex-col', 'justify-between', 'min-h-[180px]', 'p-4');

            // Show bg icon
            el.querySelector('.bg-icon')?.classList.remove('hidden');

            // Adjust inner wrapper to column
            const inner = el.querySelector('.inner-wrapper');
            if(inner) { inner.classList.remove('flex-row', 'items-center'); inner.classList.add('flex-col'); }

            // Adjust Icon
            const iconWrapper = el.querySelector('.icon-wrapper');
            if(iconWrapper) { iconWrapper.classList.remove('w-10','h-10','mb-0'); iconWrapper.classList.add('w-12','h-12','mb-3'); }

            // Adjust Text
            const textContent = el.querySelector('.text-content');
            if(textContent) {
                textContent.classList.remove('ml-4','flex-1','flex','flex-col','justify-center');
                textContent.querySelector('h3')?.classList.remove('truncate');
                textContent.querySelector('h3')?.classList.add('line-clamp-2','break-all');
            }

            // Adjust Buttons
            const btnWrapper = el.querySelector('.action-btn-wrapper');
            if(btnWrapper) {
                btnWrapper.classList.remove('w-auto','ml-auto','pt-0','mt-0');
                btnWrapper.classList.add('w-full','pt-4','mt-auto');
            }
        });
    } else {
        // LIST VIEW STYLES
        container.classList.remove('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-4');
        container.classList.add('flex', 'flex-col', 'gap-3');
        icon.className = "fas fa-th-large";

        cards.forEach(el => {
            el.classList.remove('flex-col', 'justify-between', 'min-h-[180px]', 'p-4');
            el.classList.add('flex-row', 'items-center', 'h-20', 'px-5', 'py-0', 'w-full');

            // Hide bg icon
            el.querySelector('.bg-icon')?.classList.add('hidden');

            // Adjust inner wrapper to row
            const inner = el.querySelector('.inner-wrapper');
            if(inner) { inner.classList.remove('flex-col'); inner.classList.add('flex-row', 'items-center'); }

            // Adjust Icon
            const iconWrapper = el.querySelector('.icon-wrapper');
            if(iconWrapper) { iconWrapper.classList.remove('w-12','h-12','mb-3'); iconWrapper.classList.add('w-10','h-10','mb-0'); }

            // Adjust Text
            const textContent = el.querySelector('.text-content');
            if(textContent) {
                textContent.classList.add('ml-4','flex-1','flex','flex-col','justify-center');
                textContent.querySelector('h3')?.classList.remove('line-clamp-2','break-all');
                textContent.querySelector('h3')?.classList.add('truncate');
            }

            // Adjust Buttons
            const btnWrapper = el.querySelector('.action-btn-wrapper');
            if(btnWrapper) {
                btnWrapper.classList.remove('w-full','pt-4','mt-auto');
                btnWrapper.classList.add('w-auto','ml-auto','pt-0','mt-0');
            }
        });
    }
}

/**
 * Polls server status to update UI elements (Pause, Buttons, Logout).
 * Runs every 1 second.
 */
function checkStatus() {
    fetch('/api/client/status')
        .then(response => response.json())
        .then(data => {
            // 1. Handle Critical States
            if (data.force_logout) { window.location.href = '/login?reason=logout'; return; }
            if (!data.running) { window.location.href = '/logout'; return; }

            // 2. Handle Folder/Config Changes (Refresh page)
            if (currentConfigId === null) currentConfigId = data.config_id;
            else if (currentConfigId !== data.config_id) { window.location.href = '/files'; return; }

            // 3. Handle Pause Overlay (Blur)
            const overlay = document.getElementById('pauseOverlay');
            const mainContent = document.getElementById('main-content');
            if (data.paused && !pausedState) {
                pausedState = true;
                overlay.classList.remove('opacity-0', 'pointer-events-none');
                mainContent.classList.add('blur-sm');
                closePreview(); // Security: close open file immediately
            } else if (!data.paused && pausedState) {
                pausedState = false;
                overlay.classList.add('opacity-0', 'pointer-events-none');
                mainContent.classList.remove('blur-sm');
            }

            // 4. Update Preview Buttons Logic (The requirement implementation)
            const containers = document.querySelectorAll('.preview-btn-container');

            containers.forEach(container => {
                const btn = container.querySelector('.preview-btn');
                const tooltip = container.querySelector('.tooltip-content');

                if (!data.enable_previews) {
                    // Global Off: Hide button completely
                    container.classList.add('hidden');
                } else {
                    // Global On: Show button container
                    container.classList.remove('hidden');

                    // Logic: Is it grayed out?
                    // Gray out if: Approval Required AND Bypass is False
                    const isLocked = data.require_approval && !data.preview_bypasses_approval;

                    if (isLocked) {
                        // Apply Grayed Out / Disabled Style
                        btn.disabled = true;
                        btn.classList.add('opacity-40', 'cursor-not-allowed', 'bg-slate-900', 'border-slate-800');
                        btn.classList.remove('hover:bg-slate-700', 'hover:text-white', 'bg-slate-800');

                        // Enable Hover Tooltip
                        container.classList.add('group'); // Activates CSS hover logic if utilizing pure CSS, but we use tooltip element
                        if(tooltip) {
                            // Show tooltip on hover via CSS group-hover logic (requires 'group' on container)
                            container.classList.add('group');
                            tooltip.classList.add('group-hover:opacity-100');
                        }
                    } else {
                        // Active Style
                        btn.disabled = false;
                        btn.classList.remove('opacity-40', 'cursor-not-allowed', 'bg-slate-900', 'border-slate-800');
                        btn.classList.add('hover:bg-slate-700', 'hover:text-white', 'bg-slate-800');

                        // Disable Tooltip
                        container.classList.remove('group');
                        if(tooltip) tooltip.classList.remove('group-hover:opacity-100');
                    }
                }
            });
        })
        .catch(err => console.warn("Polling error:", err)); // Suppress errors if server momentarily unreachable
}

/**
 * Opens the Lightbox Preview Modal.
 */
function openPreview(filename, path, category) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewTitle');
    const loader = document.getElementById('previewLoader');
    const errorBox = document.getElementById('previewError');
    const errorMsg = document.getElementById('previewErrorMsg');

    // 1. Reset UI State
    document.getElementById('previewImage').classList.add('hidden');
    document.getElementById('previewVideo').classList.add('hidden');
    document.getElementById('previewAudio').classList.add('hidden');
    document.getElementById('previewTextContainer').classList.add('hidden');
    errorBox.classList.add('hidden');

    // Stop previous media
    const vid = document.getElementById('previewVideo');
    const aud = document.getElementById('previewAudio');
    vid.pause(); aud.pause();
    vid.src = ""; aud.src = "";

    // 2. Show Modal & Loader
    title.innerText = filename;
    modal.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    modal.classList.add('scale-100');
    loader.classList.remove('hidden');

    const encodedPath = encodeURIComponent(path);
    const url = `/preview_content?filepath=${encodedPath}`;

    // 3. Load Content based on Category
    if (category === 'image') {
        const img = document.getElementById('previewImage');
        img.src = url;
        img.onload = () => { loader.classList.add('hidden'); img.classList.remove('hidden'); };
        img.onerror = () => handlePreviewError("Failed to load image.");
    }
    else if (category === 'video') {
        vid.src = url;
        vid.onloadeddata = () => { loader.classList.add('hidden'); vid.classList.remove('hidden'); };
        vid.onerror = () => handlePreviewError("Video format unsupported or load failed.");
    }
    else if (category === 'audio') {
        aud.src = url;
        aud.onloadeddata = () => { loader.classList.add('hidden'); aud.classList.remove('hidden'); };
        aud.onerror = () => handlePreviewError("Audio load failed.");
    }
    else if (category === 'text') {
        fetch(url)
            .then(res => {
                if (!res.ok) return res.text().then(t => { throw new Error(t) });
                return res.text();
            })
            .then(text => {
                loader.classList.add('hidden');
                document.getElementById('previewTextContainer').classList.remove('hidden');
                document.getElementById('previewText').innerText = text;
            })
            .catch(err => handlePreviewError(err.message));
    }
}

function handlePreviewError(msg) {
    document.getElementById('previewLoader').classList.add('hidden');
    document.getElementById('previewError').classList.remove('hidden');
    document.getElementById('previewErrorMsg').innerText = msg;
}

function closePreview() {
    const modal = document.getElementById('previewModal');
    modal.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    modal.classList.remove('scale-100');

    // Stop playback immediately
    document.getElementById('previewVideo').pause();
    document.getElementById('previewAudio').pause();
}

/**
 * Initiates Download Logic (with Approval handling).
 */
function initiateDownload(filename, path) {
    const modal = document.getElementById('approvalModal');
    const content = document.getElementById('approvalContent');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95'); content.classList.add('scale-100');

    document.getElementById('statusWaiting').classList.remove('hidden');
    document.getElementById('statusRejected').classList.add('hidden');
    document.getElementById('statusApproved').classList.add('hidden');
    document.getElementById('reqIdDisplay').innerText = "...";

    currentReqId = null;

    fetch('/api/client/request_download', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({filename: filename, path: path})
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'approved') {
                closeModal();
                window.location.href = data.direct_link;
            } else if (data.status === 'pending') {
                currentReqId = data.req_id;
                document.getElementById('reqIdDisplay').innerText = data.req_id.substring(0, 8);
                pollRequest(data.req_id);
            }
        })
        .catch(err => { closeModal(); alert("Request failed. Server may be offline."); });
}

function pollRequest(reqId) {
    pollInterval = setInterval(() => {
        fetch('/api/client/check_request/' + reqId)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'approved') {
                    clearInterval(pollInterval);
                    document.getElementById('statusWaiting').classList.add('hidden');
                    document.getElementById('statusApproved').classList.remove('hidden');
                    setTimeout(() => { window.location.href = data.link; closeModal(); }, 1500);
                } else if (data.status === 'rejected') {
                    clearInterval(pollInterval);
                    document.getElementById('statusWaiting').classList.add('hidden');
                    document.getElementById('statusRejected').classList.remove('hidden');
                }
            });
    }, 1000);
}

function cancelDownload() {
    closeModal();
}

function closeModal() {
    const modal = document.getElementById('approvalModal');
    const content = document.getElementById('approvalContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95'); content.classList.remove('scale-100');
    if (pollInterval) clearInterval(pollInterval);
    currentReqId = null;
}

// Initialization
loadViewPreference();
setInterval(checkStatus, 1000);