/**
 * Secure Share Client Logic
 * Handles View Toggling, Status Polling, Lightbox Previews, and Dynamic UI Updates.
 */

let isGridView = true;
let pausedState = false;
let currentConfigId = null;
let currentReqId = null;
let pollInterval = null;

// Audio Player Global Reference for jsmediatags
const jsmediatags = window.jsmediatags;

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
 * Dynamically updates Tailwind classes for cards and containers.
 */
function toggleView(forceList = false) {
    if (forceList) isGridView = false;
    else isGridView = !isGridView;
    localStorage.setItem('viewMode', isGridView ? 'grid' : 'list');

    const container = document.getElementById('fileContainer');
    const icon = document.getElementById('viewIcon');
    const cards = document.querySelectorAll('.file-card');

    if (isGridView) {
        // Apply Grid Layout
        container.classList.remove('flex', 'flex-col', 'gap-3');
        container.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-4');
        icon.className = "fas fa-list-ul";

        cards.forEach(el => {
            el.classList.remove('flex-row', 'items-center', 'h-20', 'px-5', 'py-0', 'w-full');
            el.classList.add('flex-col', 'justify-between', 'min-h-[180px]', 'p-4');
            el.querySelector('.bg-icon')?.classList.remove('hidden');
            const inner = el.querySelector('.inner-wrapper');
            if(inner) { inner.classList.remove('flex-row', 'items-center'); inner.classList.add('flex-col'); }
            const iconWrapper = el.querySelector('.icon-wrapper');
            if(iconWrapper) { iconWrapper.classList.remove('w-10','h-10','mb-0'); iconWrapper.classList.add('w-12','h-12','mb-3'); }
            const textContent = el.querySelector('.text-content');
            if(textContent) {
                textContent.classList.remove('ml-4','flex-1','flex','flex-col','justify-center');
                textContent.querySelector('h3')?.classList.remove('truncate');
                textContent.querySelector('h3')?.classList.add('line-clamp-2','break-all');
            }
            const btnWrapper = el.querySelector('.action-btn-wrapper');
            if(btnWrapper) {
                btnWrapper.classList.remove('w-auto','ml-auto','pt-0','mt-0');
                btnWrapper.classList.add('w-full','pt-4','mt-auto');
            }
        });
    } else {
        // Apply List Layout
        container.classList.remove('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-4');
        container.classList.add('flex', 'flex-col', 'gap-3');
        icon.className = "fas fa-th-large";

        cards.forEach(el => {
            el.classList.remove('flex-col', 'justify-between', 'min-h-[180px]', 'p-4');
            el.classList.add('flex-row', 'items-center', 'h-20', 'px-5', 'py-0', 'w-full');
            el.querySelector('.bg-icon')?.classList.add('hidden');
            const inner = el.querySelector('.inner-wrapper');
            if(inner) { inner.classList.remove('flex-col'); inner.classList.add('flex-row', 'items-center'); }
            const iconWrapper = el.querySelector('.icon-wrapper');
            if(iconWrapper) { iconWrapper.classList.remove('w-12','h-12','mb-3'); iconWrapper.classList.add('w-10','h-10','mb-0'); }
            const textContent = el.querySelector('.text-content');
            if(textContent) {
                textContent.classList.add('ml-4','flex-1','flex','flex-col','justify-center');
                textContent.querySelector('h3')?.classList.remove('line-clamp-2','break-all');
                textContent.querySelector('h3')?.classList.add('truncate');
            }
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
            // Check critical states
            if (data.force_logout) { window.location.href = '/login?reason=logout'; return; }
            if (!data.running) { window.location.href = '/logout'; return; }

            // Handle config changes
            if (currentConfigId === null) currentConfigId = data.config_id;
            else if (currentConfigId !== data.config_id) { window.location.href = '/files'; return; }

            // Handle Security Pause (Blur overlay)
            const overlay = document.getElementById('pauseOverlay');
            const mainContent = document.getElementById('main-content');
            if (data.paused && !pausedState) {
                pausedState = true;
                overlay.classList.remove('opacity-0', 'pointer-events-none');
                mainContent.classList.add('blur-sm');
                closePreview(); 
            } else if (!data.paused && pausedState) {
                pausedState = false;
                overlay.classList.add('opacity-0', 'pointer-events-none');
                mainContent.classList.remove('blur-sm');
            }

            // Update Preview Button Status
            const containers = document.querySelectorAll('.preview-btn-container');
            containers.forEach(container => {
                const btn = container.querySelector('.preview-btn');
                const tooltip = container.querySelector('.tooltip-content');
                if (!data.enable_previews) {
                    container.classList.add('hidden');
                } else {
                    container.classList.remove('hidden');
                    const isLocked = data.require_approval && !data.preview_bypasses_approval;
                    if (isLocked) {
                        btn.disabled = true;
                        btn.classList.add('opacity-40', 'cursor-not-allowed', 'bg-slate-900', 'border-slate-800');
                        btn.classList.remove('hover:bg-slate-700', 'hover:text-white', 'bg-slate-800');
                        container.classList.add('group');
                        if(tooltip) tooltip.classList.add('group-hover:opacity-100');
                    } else {
                        btn.disabled = false;
                        btn.classList.remove('opacity-40', 'cursor-not-allowed', 'bg-slate-900', 'border-slate-800');
                        btn.classList.add('hover:bg-slate-700', 'hover:text-white', 'bg-slate-800');
                        container.classList.remove('group');
                        if(tooltip) tooltip.classList.remove('group-hover:opacity-100');
                    }
                }
            });
        })
        .catch(err => console.warn("Polling error:", err));
}

/**
 * Utility: Formats seconds into MM:SS
 */
function formatAudioTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
}

/**
 * Robust Audio Player Setup
 * @param {string} url - The URL to the audio file
 * @param {string} filename - Filename to show immediately
 */
function setupCustomAudio(url, filename) {
    const audio = document.getElementById('previewAudio');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const progress = document.getElementById('audioProgress');
    const curTimeTxt = document.getElementById('currentTime');
    const durTimeTxt = document.getElementById('durationTime');

    // 1. UI Reset & Set Filename IMMEDIATELY (Fixed Variable Name)
    document.getElementById('audioCover').classList.add('hidden');
    document.getElementById('audioDefaultIcon').classList.remove('hidden');
    
    // Korrektur: Wir nutzen 'filename', da 'fallbackTitle' nicht definiert war
    document.getElementById('playerTitle').innerText = filename || "Audio File";
    document.getElementById('playerArtist').innerText = "Unknown Artist";
    document.getElementById('playerAlbum').innerText = "";
    
    playIcon.className = "fas fa-play ml-1";
    progress.value = 0;
    curTimeTxt.innerText = "00:00";

    // 2. Prepare Audio Source
    audio.pause();
    audio.src = url;
    audio.load(); 

    // Metadata Event
    audio.onloadedmetadata = () => {
        console.log("Audio ready. Duration:", audio.duration);
        durTimeTxt.innerText = formatAudioTime(audio.duration);
    };

    // 3. Play/Pause Logic (Robust handling)
    playBtn.onclick = (e) => {
        e.preventDefault();
        console.log("Play button clicked. Paused state:", audio.paused);

        if (audio.paused) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    playIcon.className = "fas fa-pause";
                }).catch(error => {
                    console.error("Playback blocked or failed:", error);
                });
            }
        } else {
            audio.pause();
            playIcon.className = "fas fa-play ml-1";
        }
    };

    // 4. Update Progress Bar
    audio.ontimeupdate = () => {
        if (!isNaN(audio.duration) && audio.duration > 0) {
            const pct = (audio.currentTime / audio.duration) * 100;
            progress.value = pct;
            curTimeTxt.innerText = formatAudioTime(audio.currentTime);
        }
    };

    // 5. Scrubbing (Timeline clicking)
    progress.oninput = () => {
        if (!isNaN(audio.duration)) {
            audio.currentTime = (progress.value / 100) * audio.duration;
        }
    };

    // 6. Metadata (jsmediatags) logic
    if (window.jsmediatags) {
        window.jsmediatags.read(url, {
            onSuccess: function(tag) {
                const t = tag.tags;
                if(t.title) document.getElementById('playerTitle').innerText = t.title;
                if(t.artist) document.getElementById('playerArtist').innerText = t.artist;
                if(t.album) document.getElementById('playerAlbum').innerText = t.album;

                if (t.picture) {
                    const { data, format } = t.picture;
                    let base64String = "";
                    for (let i = 0; i < data.length; i++) {
                        base64String += String.fromCharCode(data[i]);
                    }
                    document.getElementById('audioCover').src = `data:${format};base64,${window.btoa(base64String)}`;
                    document.getElementById('audioCover').classList.remove('hidden');
                    document.getElementById('audioDefaultIcon').classList.add('hidden');
                }
            },
            onError: (err) => console.log("Tag read error:", err)
        });
    }
}

/**
 * Opens the Lightbox Preview Modal based on file category.
 */
function openPreview(filename, path, category) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewTitle');
    const loader = document.getElementById('previewLoader');
    const errorBox = document.getElementById('previewError');

    // 1. Reset UI visibility for all containers
    document.getElementById('previewImage').classList.add('hidden');
    document.getElementById('previewVideo').classList.add('hidden');
    document.getElementById('customAudioContainer').classList.add('hidden');
    document.getElementById('previewTextContainer').classList.add('hidden');
    errorBox.classList.add('hidden');

    const vid = document.getElementById('previewVideo');
    const aud = document.getElementById('previewAudio');
    vid.pause(); aud.pause();
    vid.src = ""; aud.src = "";

    // 2. Prepare Modal
    title.innerText = filename;
    modal.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    modal.classList.add('scale-100');
    loader.classList.remove('hidden');

    const encodedPath = encodeURIComponent(path);
    const url = `/preview_content?filepath=${encodedPath}`;

    // 3. Load content based on type
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
        loader.classList.add('hidden');
        document.getElementById('customAudioContainer').classList.remove('hidden');
        setupCustomAudio(url, filename);
    }
    else if (category === 'text') {
        fetch(url)
            .then(res => res.text())
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

    // Security: Stop all media immediately
    document.getElementById('previewVideo').pause();
    document.getElementById('previewAudio').pause();
    
    // Reset audio control icons
    const playIcon = document.getElementById('playIcon');
    if(playIcon) playIcon.className = "fas fa-play ml-1";
}

/**
 * Initiates Download Logic (Requests Admin approval if needed).
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
    .catch(() => { closeModal(); alert("Request failed. Server unreachable."); });
}

/**
 * Periodically checks the status of a download approval request.
 */
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

function cancelDownload() { closeModal(); }

function closeModal() {
    const modal = document.getElementById('approvalModal');
    const content = document.getElementById('approvalContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.add('scale-95'); content.classList.remove('scale-100');
    if (pollInterval) clearInterval(pollInterval);
}

// Global Application Initialization
loadViewPreference();
setInterval(checkStatus, 1000);