// ... IndexedDB Helper Functions (can be outside the class or static members of a utility class)
let dbPromise = null;

function openMusicDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('MusicPlayerDB', 4); // Version 4 for customPlaylistsStore

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            let store;
            if (!db.objectStoreNames.contains('playlistStore')) {
                store = db.createObjectStore('playlistStore', { keyPath: 'id', autoIncrement: true });
            } else {
                store = request.transaction.objectStore('playlistStore');
                // Ensure properties exist if upgrading from older version where they might be missing
                // This is more for robustness if old data exists without these fields.
                // For new tracks, saveTrackToDB handles defaults.
            }

            if (!db.objectStoreNames.contains('customPlaylistsStore')) {
                const customPlaylistStore = db.createObjectStore('customPlaylistsStore', { keyPath: 'id', autoIncrement: true });
                customPlaylistStore.createIndex('name', 'name', { unique: false }); // Index by name for potential future use
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.error);
        };
    });
    return dbPromise;
}

async function saveTrackToDB(trackData) {
    try {
        const db = await openMusicDB();
        const transaction = db.transaction('playlistStore', 'readwrite');
        const store = transaction.objectStore('playlistStore');
        // Ensure liked property exists, default to false
        const dataToSave = { ...trackData, liked: trackData.liked || false, playCount: trackData.playCount || 0 };
        return new Promise((resolve, reject) => {
            const request = store.add(dataToSave); 
            request.onsuccess = () => resolve(request.result); 
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error saving track to DB:", error);
        return Promise.reject(error);
    }
}

async function getPlaylistFromDB() {
    try {
        const db = await openMusicDB();
        const transaction = db.transaction('playlistStore', 'readonly');
        const store = transaction.objectStore('playlistStore');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result); // Returns array of all objects
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error getting playlist from DB:", error);
        return Promise.reject(error);
    }
}

async function clearPlaylistFromDB() {
    try {
        const db = await openMusicDB();
        const transaction = db.transaction('playlistStore', 'readwrite');
        const store = transaction.objectStore('playlistStore');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error clearing playlist from DB:", error);
        return Promise.reject(error);
    }
}

async function updateTrackInDB(trackId, updatedProperties) {
    try {
        const db = await openMusicDB();
        const transaction = db.transaction('playlistStore', 'readwrite');
        const store = transaction.objectStore('playlistStore');
        return new Promise((resolve, reject) => {
            const getRequest = store.get(trackId);
            getRequest.onsuccess = () => {
                const track = getRequest.result;
                if (track) {
                    const updatedTrack = { ...track, ...updatedProperties };
                    const putRequest = store.put(updatedTrack);
                    putRequest.onsuccess = () => resolve(putRequest.result);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Track not found in DB for update'));
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error("Error updating track in DB:", error);
        return Promise.reject(error);
    }
}

// New DB Helper: Delete Custom Playlist
async function deleteCustomPlaylistFromDB(playlistId) {
    try {
        const db = await openMusicDB();
        const transaction = db.transaction('customPlaylistsStore', 'readwrite');
        const store = transaction.objectStore('customPlaylistsStore');
        return new Promise((resolve, reject) => {
            const request = store.delete(playlistId);
            request.onsuccess = () => {
                console.log("Custom playlist deleted from DB:", playlistId);
                resolve();
            };
            request.onerror = (error) => {
                console.error("Error deleting custom playlist from DB store:", error);
                reject(request.error);
            }
        });
    } catch (error) {
        console.error("Error opening DB for custom playlist deletion:", error);
        return Promise.reject(error);
    }
}

// New DB Helper: Delete Track from playlistStore
async function deleteTrackFromDB(trackId) {
    try {
        const db = await openMusicDB();
        const transaction = db.transaction('playlistStore', 'readwrite');
        const store = transaction.objectStore('playlistStore');
        return new Promise((resolve, reject) => {
            const request = store.delete(trackId); // Assuming trackId is the keyPath
            request.onsuccess = () => {
                console.log("Track deleted from DB:", trackId);
                resolve();
            };
            request.onerror = (error) => {
                console.error("Error deleting track from DB store:", error);
                reject(request.error);
            }
        });
    } catch (error) {
        console.error("Error opening DB for track deletion:", error);
        return Promise.reject(error);
    }
}

// Add this function before the MusicPlayer class
function getDominantColors(imgElement) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        ctx.drawImage(imgElement, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const colorCounts = {};
        const colorStep = 32; // Reduce color precision for better grouping

        // Sample every 4th pixel for performance
        for (let i = 0; i < imageData.length; i += 16) {
            const r = Math.floor(imageData[i] / colorStep) * colorStep;
            const g = Math.floor(imageData[i + 1] / colorStep) * colorStep;
            const b = Math.floor(imageData[i + 2] / colorStep) * colorStep;
            const rgb = `${r},${g},${b}`;
            colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;
        }

        // Convert to array and sort by frequency
        const sortedColors = Object.entries(colorCounts)
            .map(([color, count]) => ({ color: color.split(',').map(Number), count }))
            .sort((a, b) => b.count - a.count);

        // Get top 2 colors that are different enough
        const dominantColors = [sortedColors[0]];
        for (const color of sortedColors.slice(1)) {
            if (dominantColors.length === 2) break;
            
            // Check if color is different enough from the first color
            const [r1, g1, b1] = dominantColors[0].color;
            const [r2, g2, b2] = color.color;
            const colorDiff = Math.sqrt(
                Math.pow(r1 - r2, 2) +
                Math.pow(g1 - g2, 2) +
                Math.pow(b1 - b2, 2)
            );
            
            if (colorDiff > 100) { // Minimum difference threshold
                dominantColors.push(color);
            }
        }

        resolve(dominantColors.map(c => c.color));
    });
}

class MusicPlayer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.gainNode = null;
        this.audioSource = null;
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentTrack = 0;
        this.volume = 0.7;
        this.isLooping = false;
        this.restartedTrack = false;
        this.isShuffling = false;
        this.playHistory = [];
        this.mediaSessionActionsSetup = false; // For Media Session API
        this.playbackRestored = false; // Flag to indicate if state was restored
        this.collapsibleGroupStates = {};
        this.activeContextName = null; // Name of the current playback context (e.g., 'Liked Songs', 'FolderName')
        this.activeContextTracks = []; // Array of track objects for the current context
        this.lastPlayedTrackIdInContext = null; // To help find current position in context
        this.scrollIntervalId = null;
        this.isScrubbing = false; // For progress bar scrubbing
        this.wasPlayingBeforeScrub = false; // Store play state before scrubbing
        this.scrollZoneSize = 50; // pixels
        this.scrollSpeed = 15;    // pixels per interval tick
        this.customPlaylists = []; // To store loaded custom playlists {id, name, trackIds: []}
        this.isVolumeSliderVisible = false; // For new vertical volume slider
        this.playQueue = []; // For swipe-to-queue

        // DOM
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.loopBtn = document.getElementById('loop-btn');
        this.progressContainer = document.getElementById('progress-container'); // Ensure this is properly assigned
        this.progressBar = document.getElementById('progress-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.durationEl = document.getElementById('duration');
        this.volumeBtn = document.getElementById('volume-btn');
        this.volumeBarContainer = document.getElementById('volume-bar-container');
        this.volumeBar = document.getElementById('volume-bar');
        this.songTitleEl = document.getElementById('song-title');
        this.artistNameEl = document.getElementById('artist-name');
        this.albumArtEl = document.getElementById('album-art');
        this.playlistContainer = document.getElementById('sidebar'); // Was already sidebar, keeping
        this.playlistEl = document.getElementById('playlist');
        this.playlistSearchEl = document.getElementById('playlist-search');
        this.togglePlaylistHeightBtn = document.getElementById('toggle-playlist-height-btn');
        this.playerLikeBtn = document.getElementById('player-like-btn');
        this.playerBarAddToPlaylistBtn = document.getElementById('player-bar-add-to-playlist-btn');

        // New volume control wrapper
        this.volumeControlWrapper = document.querySelector('.volume-control-wrapper'); // Reference for click-outside logic

        // New buttons and inputs for file/folder loading
        this.addFilesBtn = document.getElementById('add-files-btn');
        this.addFolderBtn = document.getElementById('add-folder-btn');
        this.filesPickerInput = document.getElementById('filesPicker');
        this.trueFolderPickerInput = document.getElementById('trueFolderPicker');
        this.createPlaylistBtn = document.getElementById('create-playlist-btn'); // Re-ensure it is here

        // Modal DOM elements
        this.addToPlaylistModal = document.getElementById('add-to-playlist-modal');
        this.modalSongTitleEl = document.getElementById('modal-song-title');
        this.modalPlaylistListEl = document.getElementById('modal-playlist-list');
        this.modalCreateNewPlaylistBtn = document.getElementById('modal-create-new-playlist-btn');
        this.modalCancelBtn = document.getElementById('modal-cancel-btn');
        
        this.trackIdForModal = null; // To store trackId when modal is open

        // "Create Playlist" Modal DOM elements
        this.createPlaylistModal = document.getElementById('create-new-playlist-modal');
        this.newPlaylistNameInputEl = document.getElementById('new-playlist-name-input');
        this.createPlaylistConfirmBtn = document.getElementById('create-playlist-confirm-btn');
        this.createPlaylistCancelBtn = document.getElementById('create-playlist-cancel-btn');

        // Confirmation Modal DOM elements
        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmationModalTitleEl = document.getElementById('confirmation-modal-title');
        this.confirmationModalMessageEl = document.getElementById('confirmation-modal-message');
        this.confirmationModalConfirmBtn = document.getElementById('confirmation-modal-confirm-btn');
        this.confirmationModalCancelBtn = document.getElementById('confirmation-modal-cancel-btn');
        this.onConfirmCallback = null; // To store the action for the confirmation modal

        // Notification Modal DOM elements
        this.notificationModal = document.getElementById('notification-modal');
        this.notificationModalTitleEl = document.getElementById('notification-modal-title');
        this.notificationModalMessageEl = document.getElementById('notification-modal-message');
        this.notificationModalOkBtn = document.getElementById('notification-modal-ok-btn');

        // Loader Modal DOM elements
        this.loaderModal = document.getElementById('loader-modal');
        this.loaderModalTitleEl = document.getElementById('loader-modal-title');
        this.loaderModalMessageEl = document.getElementById('loader-modal-message');
        this.loaderProgressBarEl = document.getElementById('loader-progress-bar');
        this.loaderProgressTextEl = document.getElementById('loader-progress-text');

        this.draggedItemIndex = null; 
        this.touchDragState = {
            longPressTimer: null,
            initialX: 0,
            initialY: 0,
            isDragActive: false,
            draggedItem: null,
            draggedItemIndex: -1,
            potentialDragItem: null, // Store the item that might be dragged
            currentTarget: null, 
            scrollThreshold: 10, // Pixels to move before cancelling long press
            longPressDuration: 400, // ms
            isSwipeActive: false, // For swipe detection
            swipeStartX: 0,
            swipeStartY: 0,
            swipeMinDistance: 60, // Minimum horizontal distance for a swipe
            swipeMaxVerticalDistance: 30 // Maximum vertical distance to still be a swipe
        }; 

        this.defaultCover = 'default.png'; 

        // Add expanded player elements
        this.expandedPlayer = document.getElementById('expanded-player');
        this.expandedAlbumArt = document.getElementById('expanded-album-art');
        this.expandedSongTitle = document.getElementById('expanded-song-title');
        this.expandedArtistName = document.getElementById('expanded-artist-name');
        this.expandedPlayPauseBtn = document.getElementById('expanded-play-pause-btn');
        this.expandedPrevBtn = document.getElementById('expanded-prev-btn');
        this.expandedNextBtn = document.getElementById('expanded-next-btn');
        this.expandedShuffleBtn = document.getElementById('expanded-shuffle-btn');
        this.expandedLoopBtn = document.getElementById('expanded-loop-btn');
        this.expandedProgressBar = document.getElementById('expanded-progress-bar');
        this.expandedCurrentTime = document.getElementById('expanded-current-time');
        this.expandedDuration = document.getElementById('expanded-duration');
        this.closeExpandedPlayerBtn = document.getElementById('close-expanded-player');

        // Start
        this.init();
    }

    async init() { 
        this.initAudioContext();
        this.setupEventListeners();
        this.collapsibleGroupStates = JSON.parse(localStorage.getItem('collapsibleGroupStates')) || {}; // Load folder collapse states
        
        try {
            await openMusicDB(); 
            await this.loadCustomPlaylistsFromDB(); // Load custom playlists

            const storedPlaylist = await getPlaylistFromDB(); // Load main tracks
            if (storedPlaylist && storedPlaylist.length > 0) {
                console.log("Loading playlist from IndexedDB");
                this.playlist = storedPlaylist.map(track => ({
                    ...track, // Includes id, liked, playCount from DB
                    file: URL.createObjectURL(track.fileBlob), 
                    cover: track.coverBlob ? URL.createObjectURL(track.coverBlob) : this.defaultCover
                }));
                this.renderPlaylist(); // Render first, then attempt to restore state

                const savedStateString = localStorage.getItem('musicPlayerState');
                if (savedStateString) {
                    const savedState = JSON.parse(savedStateString);
                    if (savedState && typeof savedState.currentTrack === 'number' && 
                        savedState.currentTrack >= 0 && savedState.currentTrack < this.playlist.length) {
                        
                        console.log("Restoring playback state:", savedState);
                        this.currentTrack = savedState.currentTrack;
                        
                        this.volume = savedState.volume !== undefined ? savedState.volume : 0.7;
                        // Apply initial volume using the new setVolume method
                        this.setVolume(this.volume); 
                        // if (this.gainNode) this.gainNode.gain.value = this.volume; // Handled by setVolume
                        // this.volumeBar.style.width = `${this.volume * 100}%`; // Handled by setVolume (will set height)
                        // this.updateVolumeIcon(); // Handled by setVolume
                        
                        this.isLooping = savedState.isLooping || false;
                        this.audio.loop = this.isLooping;
                        this.loopBtn.classList.toggle('active', this.isLooping);
                        
                        this.isShuffling = savedState.isShuffling || false;
                        this.shuffleBtn.classList.toggle('active', this.isShuffling);
                        
                        this.isPlaying = savedState.isPlaying || false; // Restore isPlaying state
                        
                        this.loadTrack(this.currentTrack, savedState.currentTime);
                        this.playbackRestored = true;
                    } else if (this.playlist.length > 0) {
                        this.loadTrack(0); // Load first if saved state is invalid
                    }
                } else if (this.playlist.length > 0) {
                    this.loadTrack(0); // Default: load first track if no saved state
                }
            } else {
                console.log("No playlist in IndexedDB or DB empty.");
        this.playlist = [];
                this.renderPlaylist(); 
            }
        } catch (error) {
            console.error("Failed to initialize playlist from IndexedDB:", error);
            this.playlist = [];
            this.renderPlaylist(); 
        }
        if (!this.playbackRestored && this.playlist.length > 0 && this.currentTrack < this.playlist.length) {
                // If not restored and playlist exists, ensure first track UI is shown (or currentTrack if somehow set)
                // This addresses cases where DB is empty, then user loads folder, then refreshes.
                // If loadTrack wasn't called above due to empty DB then no restored state.
                if (!this.audio.src && this.playlist[this.currentTrack]) { // only if no track is loaded yet
                this.loadTrack(this.currentTrack);
                }
        }

        // Expand playlist by default on mobile
        if (window.matchMedia("(max-width: 768px)").matches) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('sidebar-mobile-expanded') && this.togglePlaylistHeightBtn) {
                this.toggleMobilePlaylistHeight();
            }
        }
    }

    initAudioContext() {
        this.audioContext = new (window.AudioContext||window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.gainNode = this.audioContext.createGain();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);
        this.analyser.connect(this.gainNode);
    }

    setupEventListeners() {

        if(this.addFilesBtn) { // New listener for Add File(s)
            this.addFilesBtn.addEventListener('click', () => {
                if(this.filesPickerInput) this.filesPickerInput.click();
            });
        }
        if(this.filesPickerInput) { // New listener for filesPicker change
            this.filesPickerInput.addEventListener('change', e => {
            this.loadFolder(e.target.files);
        });
        }

        if(this.addFolderBtn) { // New listener for Add Folder
            this.addFolderBtn.addEventListener('click', () => {
                if(this.trueFolderPickerInput) this.trueFolderPickerInput.click();
            });
        }
        if(this.trueFolderPickerInput) { // New listener for trueFolderPicker change
            this.trueFolderPickerInput.addEventListener('change', e => {
                this.loadFolder(e.target.files);
            });
        }

        // this.createPlaylistBtn.addEventListener('click', () => this.openCreatePlaylistModal()); // Already exists and correctly set above
        if (this.createPlaylistBtn) { // Ensure listener for create playlist is set
                this.createPlaylistBtn.addEventListener('click', () => this.openCreatePlaylistModal());
        }

        // playback controls
        this.playPauseBtn.addEventListener('click', ()=>this.togglePlay());
        this.prevBtn.addEventListener('click', ()=>this.prevTrack());
        this.nextBtn.addEventListener('click', ()=>this.nextTrack());
        const progressContainer = document.getElementById('progress-container'); // Get ref for new listeners
        if (progressContainer) {
            progressContainer.addEventListener('mousedown', e => {
                e.preventDefault(); 
                if (!this.audio.duration) return; 

                this.isScrubbing = true;
                this.wasPlayingBeforeScrub = this.isPlaying;

                if (this.isPlaying) {
                    this.audio.pause(); 
                }
                this.handleScrub(e, progressContainer); 

                const documentMouseMove = (moveEvent) => {
                    if (this.isScrubbing) {
                        this.handleScrub(moveEvent, progressContainer);
                    }
                };

                const documentMouseUp = () => {
                    if (this.isScrubbing) {
                        this.isScrubbing = false;
                        document.removeEventListener('mousemove', documentMouseMove);
                        document.removeEventListener('mouseup', documentMouseUp);

                        if (this.wasPlayingBeforeScrub) {
                            this.play(); 
                        } else {
                            this.savePlaybackState();
                            this.updateMediaSession(); 
                        }
                        this.updateProgress(); 
                    }
                };

                document.addEventListener('mousemove', documentMouseMove);
                document.addEventListener('mouseup', documentMouseUp);
            });

            // Touch event listeners for scrubbing
            progressContainer.addEventListener('touchstart', e => {
                // e.preventDefault(); // Allow scroll on playlist, but prevent default for progress bar if needed.
                // Consider if preventDefault is strictly needed here or if it interferes with other touch actions.
                // For scrubbing, it's good to prevent vertical scroll if the touch starts on the bar.
                if (e.target === progressContainer || progressContainer.contains(e.target)) {
                        e.preventDefault(); // Only prevent default if touch starts on the progress bar or its direct children
                }
                if (!this.audio.duration) return;

                this.isScrubbing = true;
                this.wasPlayingBeforeScrub = this.isPlaying;

                if (this.isPlaying) {
                    this.audio.pause();
                }
                this.handleScrub(e.touches[0], progressContainer); // Use first touch point

                const documentTouchMove = (moveEvent) => {
                    if (this.isScrubbing) {
                        this.handleScrub(moveEvent.touches[0], progressContainer);
                    }
                };

                const documentTouchEnd = () => {
                    if (this.isScrubbing) {
                        this.isScrubbing = false;
                        document.removeEventListener('touchmove', documentTouchMove);
                        document.removeEventListener('touchend', documentTouchEnd);

                        if (this.wasPlayingBeforeScrub) {
                            this.play();
                        } else {
                            this.savePlaybackState();
                            this.updateMediaSession();
                        }
                        this.updateProgress();
                    }
                };

                document.addEventListener('touchmove', documentTouchMove, { passive: false }); // passive:false if preventDefault is used in handler
                document.addEventListener('touchend', documentTouchEnd);
            }, { passive: false }); // passive:false for the touchstart on progress bar to allow preventDefault
        }

        // New Vertical Volume Slider Interaction
        if (this.volumeBarContainer) {
            this.volumeBarContainer.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                // if (!this.volumeBarContainer.classList.contains('active')) return; // Already visible if mousedown

                const rect = this.volumeBarContainer.getBoundingClientRect();
                // Inner .volume-bar is who we are really adjusting height on, but clicks are on container
                // The container has padding, so clicks are relative to container.
                const barClickableHeight = rect.height - 20; // Subtract top/bottom padding (10px each)
                const barOffsetTop = 10; // Top padding

                const setVolumeFromVerticalEvent = (moveEvent) => {
                    let clickY = moveEvent.clientY - rect.top - barOffsetTop;
                    let newVolume = 1 - (clickY / barClickableHeight); // Inverted: top is high volume (1), bottom is low (0)
                    
                    newVolume = Math.max(0, Math.min(1, newVolume));
                    this.setVolume(newVolume);
                };

                setVolumeFromVerticalEvent(e); // Set volume on initial click

                const onMouseMove = (moveEvent) => {
                    setVolumeFromVerticalEvent(moveEvent);
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        // New Volume Button Click Listener (Toggle Slider)
        if (this.volumeBtn) {
            this.volumeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.toggleVolumeSlider();
            });
        }

        this.loopBtn.addEventListener('click', ()=> { this.toggleLoop(); this.savePlaybackState(); });
        this.shuffleBtn.addEventListener('click', ()=> { this.toggleShuffle(); this.savePlaybackState(); });
        this.playerLikeBtn.addEventListener('click', () => this.handlePlayerLike()); // Listener for player like btn
        this.audio.addEventListener('timeupdate', ()=> { this.updateProgress(); this.savePlaybackState(); }); // Save state on time update
        this.audio.addEventListener('ended', ()=>this.handleTrackEnd());

        window.addEventListener('beforeunload', () => this.savePlaybackState()); // Save state before leaving page

        this.playlistEl.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.playlistEl.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.playlistEl.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.playlistEl.addEventListener('drop', (e) => this.handleDrop(e));
        this.playlistEl.addEventListener('dragend', (e) => this.handleDragEnd(e));

        // this.playlistSearchEl.addEventListener('input', () => this.filterPlaylist());
        
        // if (this.togglePlaylistHeightBtn) {
        //     this.togglePlaylistHeightBtn.addEventListener('click', () => this.toggleMobilePlaylistHeight());
        // }

        // Touch events for mobile drag-drop
        this.playlistEl.addEventListener('touchstart', (e) => this.handleTouchStart(e), {passive: false});
        this.playlistEl.addEventListener('touchmove', (e) => this.handleTouchMove(e), {passive: false});
        this.playlistEl.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        // this.touchDragState is initialized in constructor

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Modal event listeners
        if (this.modalCancelBtn) {
            this.modalCancelBtn.addEventListener('click', () => this.closeAddToPlaylistModal());
        }
        if (this.modalCreateNewPlaylistBtn) {
            this.modalCreateNewPlaylistBtn.addEventListener('click', async () => {
                // No longer directly creates, but opens the new dedicated modal
                this.closeAddToPlaylistModal(); // Close the current "Add to" modal first
                this.openCreatePlaylistModal(); 
                // After create modal finishes, the populateModalPlaylistList will be called if add to playlist modal is reopened.
            });
        }

        // "Create Playlist" Modal event listeners
        if (this.createPlaylistConfirmBtn) {
            this.createPlaylistConfirmBtn.addEventListener('click', async () => {
                const playlistName = this.newPlaylistNameInputEl.value.trim();
                if (playlistName) {
                    try {
                        await this.actuallyCreateCustomPlaylist(playlistName); // New function for actual creation
                        this.closeCreatePlaylistModal();
                        // If the add to playlist modal was the initiator, its list might need refreshing.
                        // This is handled by it re-populating when opened.
                    } catch (error) {
                        // Error already handled in actuallyCreateCustomPlaylist with an alert
                        // console.error("Error during playlist creation flow from modal:", error);
                    }
                } else {
                    alert("Playlist name cannot be empty.");
                }
            });
        }
        if (this.createPlaylistCancelBtn) {
            this.createPlaylistCancelBtn.addEventListener('click', () => this.closeCreatePlaylistModal());
        }

        // Confirmation Modal event listeners
        if (this.confirmationModalCancelBtn) {
            this.confirmationModalCancelBtn.addEventListener('click', () => this.closeConfirmationModal());
        }
        if (this.confirmationModalConfirmBtn) {
            this.confirmationModalConfirmBtn.addEventListener('click', () => {
                if (typeof this.onConfirmCallback === 'function') {
                    this.onConfirmCallback();
                }
                this.closeConfirmationModal();
            });
        }

        if (this.playerBarAddToPlaylistBtn) {
            this.playerBarAddToPlaylistBtn.addEventListener('click', () => {
                if (this.playlist && this.playlist[this.currentTrack] && this.playlist[this.currentTrack].id !== undefined) {
                    this.openAddToPlaylistModal(this.playlist[this.currentTrack].id);
                } else {
                    alert("Please play a song first to add it to a playlist.");
                }
            });
        }

        // Notification Modal event listener
        if (this.notificationModalOkBtn) {
            this.notificationModalOkBtn.addEventListener('click', () => this.closeNotificationModal());
        }

        // Global click listener to close open action dropdowns
        document.addEventListener('click', (e) => {
            const openDropdowns = document.querySelectorAll('.actions-dropdown.visible');
            openDropdowns.forEach(dropdown => {
                // Check if the click was outside the dropdown and its button
                const parentContainer = dropdown.closest('.playlist-item-actions-container');
                if (parentContainer && !parentContainer.contains(e.target)) {
                    dropdown.classList.remove('visible');
                }
            });
        });

        // Add expanded player event listeners
        if (this.albumArtEl) {
            this.albumArtEl.parentElement.addEventListener('click', () => {
                this.expandedPlayer.classList.add('active');
                this.updateExpandedPlayerState();
            });
        }

        if (this.closeExpandedPlayerBtn) {
            this.closeExpandedPlayerBtn.addEventListener('click', () => {
                this.expandedPlayer.classList.remove('active');
            });
        }

        // Expanded player controls
        if (this.expandedPlayPauseBtn) {
            this.expandedPlayPauseBtn.addEventListener('click', () => this.togglePlay());
        }
        if (this.expandedPrevBtn) {
            this.expandedPrevBtn.addEventListener('click', () => this.prevTrack());
        }
        if (this.expandedNextBtn) {
            this.expandedNextBtn.addEventListener('click', () => this.nextTrack());
        }
        if (this.expandedShuffleBtn) {
            this.expandedShuffleBtn.addEventListener('click', () => {
                this.toggleShuffle();
                this.savePlaybackState();
            });
        }
        if (this.expandedLoopBtn) {
            this.expandedLoopBtn.addEventListener('click', () => {
                this.toggleLoop();
                this.savePlaybackState();
            });
        }

        // Add progress bar click handler for expanded view
        if (this.expandedPlayer) {
            const expandedProgressContainer = this.expandedPlayer.querySelector('.progress-bar-container');
            if (expandedProgressContainer) {
                expandedProgressContainer.addEventListener('click', (e) => this.handleScrub(e, expandedProgressContainer));
            }
        }

        // Add expanded progress bar drag functionality
        if (this.expandedPlayer) {
            const expandedProgressContainer = this.expandedPlayer.querySelector('.progress-bar-container');
            if (expandedProgressContainer) {
                let isDragging = false;

                const updateExpandedProgress = (e) => {
                    const rect = expandedProgressContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const width = rect.width;
                    const percentage = Math.max(0, Math.min(1, x / width));
                    
                    if (this.audio.duration) {
                        this.audio.currentTime = this.audio.duration * percentage;
                        this.updateExpandedPlayerState();
                    }
                };

                expandedProgressContainer.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    updateExpandedProgress(e);
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        updateExpandedProgress(e);
                    }
                });

                document.addEventListener('mouseup', () => {
                    isDragging = false;
                });
            }
        }

        // Global Search
        const searchInput = document.getElementById('global-search');
        const clearSearchBtn = document.getElementById('clear-search');
        const searchResults = document.getElementById('search-results');

        // Handle input changes (including backspace)
        searchInput.addEventListener('input', () => {
            const query = searchInput.value;
            this.performSearch(query);
        });

        // Clear search
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.performSearch(''); // This will properly hide the results
            clearSearchBtn.style.display = 'none';
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchResults.style.display = 'none';
            }
        });

        // Prevent search results from closing when clicking inside
        searchResults.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Expanded player additional controls
        const expandedLikeBtn = document.getElementById('expanded-like-btn');
        const expandedAddToPlaylistBtn = document.getElementById('expanded-add-to-playlist-btn');
        const expandedVolumeBtn = document.getElementById('expanded-volume-btn');
        const expandedVolumeBarContainer = document.getElementById('expanded-volume-bar-container');
        const expandedVolumeBar = document.getElementById('expanded-volume-bar');
        const expandedThemeToggleBtn = document.getElementById('expanded-theme-toggle-btn');

        expandedLikeBtn?.addEventListener('click', () => this.handlePlayerLike());
        expandedAddToPlaylistBtn?.addEventListener('click', () => {
            if (this.playlist[this.currentTrack]) {
                this.openAddToPlaylistModal(this.playlist[this.currentTrack].id);
            }
        });

        expandedVolumeBtn?.addEventListener('click', () => {
            expandedVolumeBarContainer.classList.toggle('active');
        });

        expandedVolumeBar?.addEventListener('click', (e) => {
            const rect = expandedVolumeBar.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const volumePercentage = 1 - (clickY / rect.height);
            this.setVolume(Math.max(0, Math.min(1, volumePercentage)));
        });

        expandedThemeToggleBtn?.addEventListener('click', () => {
            document.getElementById('theme-toggle-btn').click();
        });

        // Close volume bar when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.volume-control-wrapper')) {
                expandedVolumeBarContainer?.classList.remove('active');
            }
        });

        // Sidebar toggle functionality
        const logo = document.querySelector('.logo');
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        const appContainer = document.getElementById('app-container');

        logo.addEventListener('click', () => {
            appContainer.classList.add('sidebar-hidden');
            // Store the state
            localStorage.setItem('sidebarHidden', 'true');
        });

        sidebarToggle.addEventListener('click', () => {
            appContainer.classList.remove('sidebar-hidden');
            // Store the state
            localStorage.setItem('sidebarHidden', 'false');
        });

        // On page load, only hide sidebar on mobile devices
        const isMobile = window.matchMedia('(max-width: 480px)').matches;
        if (isMobile) {
            appContainer.classList.add('sidebar-hidden');
        } else {
            appContainer.classList.remove('sidebar-hidden');
            localStorage.setItem('sidebarHidden', 'false');
        }
    }

    handleKeyPress(e) {
        // Don't trigger shortcuts if user is typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        let preventDefault = true; // Assume we prevent default unless specified

        switch (e.code) {
            case 'Space':
                this.togglePlay();
                break;
            case 'ArrowRight':
                this.nextTrack();
                break;
            case 'ArrowLeft':
                this.prevTrack();
                break;
            case 'ArrowUp':
                this.volume = Math.min(1, this.volume + 0.05);
                this.updateVolumeControls();
                break;
            case 'ArrowDown':
                this.volume = Math.max(0, this.volume - 0.05);
                this.updateVolumeControls();
                break;
            case 'KeyM': // M for Mute
                this.toggleMute();
                break;
            case 'KeyL': // L for Loop
                this.toggleLoop();
                this.savePlaybackState(); // Loop state change needs saving
                break;
            case 'KeyS': // S for Shuffle
                this.toggleShuffle();
                this.savePlaybackState(); // Shuffle state change needs saving
                break;
            default:
                preventDefault = false; // Don't prevent default for unhandled keys
                break;
        }

        if (preventDefault) {
            e.preventDefault();
        }
    }
    
    updateVolumeControls() { // Helper to update UI and gainNode for volume
        // This method is now largely superseded by setVolume.
        // It can call setVolume to ensure all updates happen.
        this.setVolume(this.volume);
        // if (this.gainNode) this.gainNode.gain.value = this.volume;
        // this.volumeBar.style.width = `${this.volume * 100}%`; // Old horizontal
        // this.updateVolumeIcon();
        // this.savePlaybackState(); 
    }

    toggleMute() {
        if (this.volume > 0) {
            this.lastVolume = this.volume; // Store current volume before muting
            this.volume = 0;
        } else {
            this.volume = this.lastVolume || 0.7; // Restore to last volume or default
        }
        this.updateVolumeControls();
    }

    handleDragStart(e) {
        const item = e.target.closest('.playlist-item');
        if (!item || item.classList.contains('hidden-by-search')) return; // Don't drag hidden items
        this.draggedItemIndex = parseInt(item.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.draggedItemIndex); // Necessary for Firefox
        item.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault(); 
        const item = e.target.closest('.playlist-item');
        const playlistRect = this.playlistEl.getBoundingClientRect();
        const mouseY = e.clientY;

        // Auto-scroll logic for mouse drag
        if (mouseY < playlistRect.top + this.scrollZoneSize) {
            this.startAutoScroll('up');
        } else if (mouseY > playlistRect.bottom - this.scrollZoneSize) {
            this.startAutoScroll('down');
        } else {
            this.stopAutoScroll();
        }

        if (!item || item.classList.contains('hidden-by-search') || parseInt(item.dataset.index, 10) === this.draggedItemIndex) {
                this.clearDragOverTargets();
            return;
        }
        e.dataTransfer.dropEffect = 'move';
        this.clearDragOverTargets(); // Clear from other items
        item.classList.add('drag-over-target');
    }

    handleDragLeave(e) {
        const item = e.target.closest('.playlist-item');
        if (item) {
            item.classList.remove('drag-over-target');
        }
        // Stop scrolling if mouse leaves the playlist container itself
        if (!this.playlistEl.contains(e.relatedTarget)) {
            this.stopAutoScroll();
        }
    }
    
    clearDragOverTargets(){
        this.playlistEl.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
    }

    handleDrop(e) {
        e.preventDefault();
        this.stopAutoScroll(); // Stop scrolling on drop
        this.clearDragOverTargets();
        const targetItem = e.target.closest('.playlist-item');
        if (!targetItem || targetItem.classList.contains('hidden-by-search') || this.draggedItemIndex === null) return;

        const droppedOnItemIndex = parseInt(targetItem.dataset.index, 10);

        if (this.draggedItemIndex === droppedOnItemIndex) return; // Dropped on itself

        // Store the current playing track object's ID before reordering
        const currentPlayingTrackId = (this.playlist && this.currentTrack >= 0 && this.currentTrack < this.playlist.length && this.playlist[this.currentTrack]) ? this.playlist[this.currentTrack].id : null;

        const itemToMove = this.playlist.splice(this.draggedItemIndex, 1)[0];
        this.playlist.splice(droppedOnItemIndex, 0, itemToMove);

        // Update currentTrack to point to the same song (by ID)
        if (currentPlayingTrackId !== null) {
            const newIndexOfPlayingTrack = this.playlist.findIndex(track => track.id === currentPlayingTrackId);
            if (newIndexOfPlayingTrack !== -1) {
                this.currentTrack = newIndexOfPlayingTrack;
            } else {
                // Fallback: if current track was somehow removed or ID changed
                if (this.playlist.length > 0) this.currentTrack = 0; else this.currentTrack = -1;
            }
        } else if (this.playlist.length > 0) {
            // No track was playing or currentTrack was invalid, reset to first track
            this.currentTrack = 0;
        } else {
            this.currentTrack = -1; // Playlist is empty
        }
        
        this.draggedItemIndex = null; 
        this.renderPlaylist(); // Re-render with new order and correct indices
        this.savePlaybackState(); // Ensure playback state is saved with the updated currentTrack
        this.updateActiveContextTracksAfterReorder(); // Update context after reorder
    }
    
    // Apply animations when changing tracks
    applyTrackChangeAnimations(direction) {
        // Remove any existing animation classes
        this.songTitleEl.classList.remove('animate-title', 'animate-prev-title');
        this.artistNameEl.classList.remove('animate-artist', 'animate-prev-artist');
        this.albumArtEl.classList.remove('animate-cover');
        
        // For expanded player elements
        if (this.expandedSongTitle) {
            this.expandedSongTitle.classList.remove('animate-title', 'animate-prev-title');
        }
        if (this.expandedArtistName) {
            this.expandedArtistName.classList.remove('animate-artist', 'animate-prev-artist');
        }
        if (this.expandedAlbumArt) {
            this.expandedAlbumArt.classList.remove('animate-cover');
        }
        
        // Apply background fade effect to expanded player
        if (this.expandedPlayer) {
            this.expandedPlayer.classList.remove('track-change');
            void this.expandedPlayer.offsetWidth; // Force reflow
            this.expandedPlayer.classList.add('track-change');
        }
        
        // Force a reflow to restart animations
        void this.songTitleEl.offsetWidth;
        void this.artistNameEl.offsetWidth;
        void this.albumArtEl.offsetWidth;
        
        if (this.expandedSongTitle) void this.expandedSongTitle.offsetWidth;
        if (this.expandedArtistName) void this.expandedArtistName.offsetWidth;
        if (this.expandedAlbumArt) void this.expandedAlbumArt.offsetWidth;
        
        // Apply appropriate animation classes based on direction
        if (direction === 'next') {
            this.songTitleEl.classList.add('animate-title');
            this.artistNameEl.classList.add('animate-artist');
            if (this.expandedSongTitle) this.expandedSongTitle.classList.add('animate-title');
            if (this.expandedArtistName) this.expandedArtistName.classList.add('animate-artist');
        } else {
            this.songTitleEl.classList.add('animate-prev-title');
            this.artistNameEl.classList.add('animate-prev-artist');
            if (this.expandedSongTitle) this.expandedSongTitle.classList.add('animate-prev-title');
            if (this.expandedArtistName) this.expandedArtistName.classList.add('animate-prev-artist');
        }
        
        // Album art animation is the same for both directions
        this.albumArtEl.classList.add('animate-cover');
        if (this.expandedAlbumArt) this.expandedAlbumArt.classList.add('animate-cover');
    }

    async updateActiveContextTracksAfterReorder() {
        // If no active context or not a special playlist that needs DB updating, just exit
        if (!this.activeContextName) return;

        // Handle updating "Liked Songs" playlist order in IndexedDB
        if (this.activeContextName === 'Liked Songs') {  // Changed from 'liked-songs'
            const likedTracks = this.playlist.filter(track => track.liked === true);
            
            try {
                const db = await openMusicDB();
                const transaction = db.transaction('playlistStore', 'readwrite');
                const store = transaction.objectStore('playlistStore');
                
                // Update each liked track in DB to reflect new order
                // Since we can't directly store the order in the track itself,
                // we'll update the timestamp of the 'likedAt' property to force a refresh
                const likedUpdatePromises = likedTracks.map((track, index) => {
                    return new Promise((resolve, reject) => {
                        const getRequest = store.get(track.id);
                        getRequest.onsuccess = () => {
                            const trackData = getRequest.result;
                            if (trackData) {
                                // Update the track with its current position in the playlist
                                trackData.likedOrderIndex = index;
                                trackData.likedAt = trackData.likedAt || Date.now(); // Keep existing timestamp if present
                                
                                const updateRequest = store.put(trackData);
                                updateRequest.onsuccess = () => resolve();
                                updateRequest.onerror = () => reject(updateRequest.error);
                            } else {
                                resolve(); // Track not found, nothing to update
                            }
                        };
                        getRequest.onerror = () => reject(getRequest.error);
                    });
                });
                
                await Promise.all(likedUpdatePromises);
                console.log('Liked songs order updated in IndexedDB');
            } catch (error) {
                console.error('Error updating liked songs order in IndexedDB:', error);
            }
            
            return;
        }
        
        // Handle updating "Most Played" playlist order in IndexedDB
        if (this.activeContextName === 'Most Played') {  // Changed from 'most-played'
            // No need to update order for Most Played, as it's dynamically sorted by playCount
            return;
        }
        
        // Handle updating custom playlist order in IndexedDB
        if (this.activeContextName.startsWith('__CUSTOM_')) {
            const customPlaylistId = parseInt(this.activeContextName.replace('__CUSTOM_', '').replace('__', ''));
            const playlistIndex = this.customPlaylists.findIndex(cp => cp.id === customPlaylistId);
            
            if (playlistIndex === -1) {
                console.error('Custom playlist not found for updating order:', this.activeContextName);
                return;
            }
            
            const customPlaylist = this.customPlaylists[playlistIndex];
            
            // Update the trackIds array to match the current order in this.activeContextTracks
            const newTrackOrder = this.activeContextTracks.map(track => track.id);
            
            if (JSON.stringify(customPlaylist.trackIds) !== JSON.stringify(newTrackOrder)) {
                // Order has changed, update it in memory and DB
                customPlaylist.trackIds = newTrackOrder;
                
                try {
                    const db = await openMusicDB();
                    const transaction = db.transaction('customPlaylistsStore', 'readwrite');
                    const store = transaction.objectStore('customPlaylistsStore');
                    
                    const request = store.put(customPlaylist);
                    request.onsuccess = () => {
                        console.log(`Custom playlist "${customPlaylist.name}" order updated in IndexedDB`);
                    };
                    request.onerror = (e) => {
                        console.error('Error updating custom playlist order in IndexedDB:', e.target.error);
                    };
                } catch (error) {
                    console.error('DB operation failed when updating custom playlist order:', error);
                }
            }
        }
    }

    handleDragEnd(e) {
        this.stopAutoScroll(); // Stop scrolling when drag ends
        const item = e.target.closest('.playlist-item');
        if(item) item.classList.remove('dragging');
        this.clearDragOverTargets();
        this.draggedItemIndex = null;
    }

    truncateText(text, maxLength = null) { 
        let effectiveMaxLength = 44; // Default for desktop

        // Check if it's a mobile view (consistent with CSS @media (max-width: 768px))
        if (window.matchMedia("(max-width: 768px)").matches) {
            effectiveMaxLength = 30;
        }

        // If a specific maxLength was passed as an argument, it overrides the dynamic default
        if (maxLength !== null) {
            effectiveMaxLength = maxLength;
        }

        if (typeof text !== 'string' || !text) return ''; 
        if (text.length <= effectiveMaxLength) {
            return text;
        }
        // Ensure effectiveMaxLength is at least 3 to accommodate "..."
        if (effectiveMaxLength < 3) return text.substring(0, effectiveMaxLength);
        return text.substring(0, effectiveMaxLength - 3) + "...";
    }

    async loadFolder(fileList) { 
        const newTracksToProcess = [];
        const individualTracksFolderName = "Individual Tracks"; // Used for non-ZIP single file uploads

        if (!fileList || fileList.length === 0) {
            // this.openNotificationModal("No files selected.", "Info"); // User might click cancel
            return;
        }

        this.showLoaderModal("Preparing files...", fileList.length);
        let filesProcessedForLoader = 0;

        for (const file of Array.from(fileList)) {
            if (file.type === 'application/zip' || (file.name && file.name.toLowerCase().endsWith('.zip'))) {
                console.log(`Processing ZIP file: ${file.name}`);
                // this.openNotificationModal(`Processing ZIP file: ${file.name}... please wait.`, "Processing");
                this.updateLoaderModal(`Processing ZIP: ${file.name}`, filesProcessedForLoader, fileList.length, true);
                try {
                    const jszip = new JSZip();
                    const zip = await jszip.loadAsync(file);
                    const zipFileName = file.name.replace(/\.zip$/i, ''); // Get ZIP name without .zip extension for base path
                    const audioFilesInZip = Object.keys(zip.files).filter(relativePath => 
                        !zip.files[relativePath].dir && relativePath.match(/\.(mp3|wav|ogg|aac|flac|m4a)$/i)
                    );
                    let processedInZipCount = 0;

                    for (const relativePathInZip of audioFilesInZip) {
                        const zipEntry = zip.files[relativePathInZip];
                        // if (!zipEntry.dir) { // Process only files, not directories - already filtered above
                            const fileNameInZip = zipEntry.name.split('/').pop();
                            // Basic audio file type check by extension (can be expanded)
                            // if (fileNameInZip.match(/\.(mp3|wav|ogg|aac|flac|m4a)$/i)) { // Already filtered
                                const fileBlob = await zipEntry.async('blob');
                                // Construct a File-like object for consistent processing
                                const extractedFile = new File([fileBlob], fileNameInZip, { type: fileBlob.type });
                                // Use the ZIP's internal path as webkitRelativePath
                                // Prepend ZIP file name to relative path to group tracks from the same ZIP
                                const webkitRelativePath = `${zipFileName}/${zipEntry.name}`;
                                newTracksToProcess.push({ file: extractedFile, webkitRelativePath });
                                processedInZipCount++;
                                // Update loader incrementally for files within ZIP
                                // This requires knowing total files in ZIP beforehand for accurate sub-progress
                                // For simplicity, we'll update the main loader progress after the ZIP is done.
                            // }
                        // }
                    }
                } catch (error) {
                    console.error(`Error processing ZIP file ${file.name}:`, error);
                    this.openNotificationModal(`Error processing ZIP file ${file.name}. It might be corrupted or an unsupported format.`, "ZIP Error");
                }
            } else if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                // Direct audio/video file
                newTracksToProcess.push({ file: file, webkitRelativePath: `${individualTracksFolderName}/${file.name}` });
            } else {
                console.warn("Skipping unsupported file type:", file.name, file.type);
            }
            filesProcessedForLoader++;
            this.updateLoaderModal( filesProcessedForLoader === fileList.length ? "Finalizing..." : `Processing input ${filesProcessedForLoader}/${fileList.length}...`, filesProcessedForLoader, fileList.length);
        }

        if (newTracksToProcess.length === 0 && Array.from(fileList).some(f => f.type === 'application/zip')) {
            // If only ZIPs were selected and no audio files were found inside them
            this.hideLoaderModal();
            this.openNotificationModal("No supported audio files found within the selected ZIP archive(s).", "Info");
            return;
        } else if (newTracksToProcess.length === 0) {
            console.warn("No audio or video files found in the selection, or no supported files in ZIP.");
            this.hideLoaderModal();
            if(Array.from(fileList).length > 0) { 
                this.openNotificationModal("No supported audio files found in your selection.", "Info");
            }
            return;
        }
        
        this.updateLoaderModal("Extracting metadata and saving tracks...", 0, newTracksToProcess.length, true); // Reset progress for the next stage
        let tracksProcessedForLoader = 0;

        const newlyAddedPlaylistData = []; 
        let newTracksSavedToDBCount = 0;

        for (const trackInfo of newTracksToProcess) {
            const currentFile = trackInfo.file;
            let currentWebkitRelativePath = trackInfo.webkitRelativePath;
            let effectiveFileName = currentFile.name;

            // Duplicate Check (based on originalFileName and webkitRelativePath)
            const isDuplicate = this.playlist.some(existingTrack => 
                existingTrack.originalFileName === effectiveFileName &&
                (existingTrack.webkitRelativePath || '') === currentWebkitRelativePath
            );

            if (isDuplicate) {
                continue; 
            }

            let titleFromFile = effectiveFileName.replace(/\.[^/.]+$/, "");
            let artistFromFile = ""; 
            let coverBlob = null; 
            let albumFromFile = "";

            // Support metadata extraction for all audio formats
            // Check if it's an audio file by extension or MIME type
            const isAudioFile = (
                currentFile.type.startsWith('audio/') || 
                /\.(mp3|m4a|wav|flac|alac|aiff|aif|aifc|ogg|oga|opus)$/i.test(currentFile.name)
            );
            
            if (isAudioFile) { 
                try {
                    const tags = await new Promise((resolve, reject) => {
                        jsmediatags.read(currentFile, {
                            onSuccess: resolve,
                            onError: reject
                        });
                    });
                    titleFromFile = tags.tags.title || titleFromFile;
                    artistFromFile = tags.tags.artist || artistFromFile;
                    albumFromFile = tags.tags.album || albumFromFile;
                    if (tags.tags.picture) {
                        const { data, format } = tags.tags.picture;
                        coverBlob = new Blob([new Uint8Array(data)], { type: format });
                    }
                } catch (error) {
                    console.log("Could not read tags for file:", effectiveFileName, "- Using filename as title");
                    // Don't treat this as an error - many lossless files might not have embedded tags
                    // or might use formats not supported by jsmediatags
                }
            }
            
            // Create a new File object from the blob for DB storage if it was from a ZIP
            // This ensures the DB stores a fresh File/Blob, not one tied to JSZip's internal state.
            const fileForDB = new File([await currentFile.arrayBuffer()], currentFile.name, { type: currentFile.type });

            let trackForDB = {
                title: titleFromFile,
                artist: artistFromFile,
                album: albumFromFile,
                originalFileName: effectiveFileName, 
                webkitRelativePath: currentWebkitRelativePath, 
                fileBlob: fileForDB, // Store the fresh File object
                coverBlob: coverBlob,
                liked: false, 
                playCount: 0 
            };

            try {
                const savedId = await saveTrackToDB(trackForDB);
                trackForDB.id = savedId; 
                newTracksSavedToDBCount++;
            } catch (error) {
                console.error("Failed to save track to DB:", effectiveFileName, error);
                continue; 
            }
            
            newlyAddedPlaylistData.push({
                ...trackForDB, 
                file: URL.createObjectURL(fileForDB), // Create object URL from the File object intended for DB
                cover: coverBlob ? URL.createObjectURL(coverBlob) : this.defaultCover
            });
            tracksProcessedForLoader++;
            this.updateLoaderModal(`Processing track ${tracksProcessedForLoader}/${newTracksToProcess.length}...`, tracksProcessedForLoader, newTracksToProcess.length);
        }

        this.hideLoaderModal(); // Hide loader after processing all tracks

        if (newTracksSavedToDBCount > 0) {
            this.playlist.push(...newlyAddedPlaylistData);
        this.renderPlaylist();

            if (!this.isPlaying && newlyAddedPlaylistData.length > 0) {
                const firstNewTrackGlobalIndex = this.playlist.findIndex(pTrack => pTrack.id === newlyAddedPlaylistData[0].id);
                if (firstNewTrackGlobalIndex !== -1) {
                    this.loadTrack(firstNewTrackGlobalIndex); 
                }
            }
            this.openNotificationModal(`${newTracksSavedToDBCount} new track(s) added successfully.`, "Success");
        } else if (newTracksToProcess.length > 0 && newTracksSavedToDBCount === 0) {
                this.openNotificationModal("No new tracks were added. They might be duplicates, or there were errors saving them.", "Info");
        }

        if (this.playlist.length === 0) {
            this.songTitleEl.textContent = 'No songs loaded';
            this.artistNameEl.textContent = 'Please load a folder';
            this.albumArtEl.src = this.defaultCover;
            this.currentTimeEl.textContent = '0:00';
            this.durationEl.textContent = '0:00';
            this.progressBar.style.width = '0%';
            this.renderPlaylist(); 
        }
    }

    loadTrack(idx, restoreTime = null) {
        if(!this.playlist || !this.playlist.length || idx < 0 || idx >= this.playlist.length) {
                console.warn("LoadTrack: Invalid index or empty playlist.", idx, this.playlist.length);
            return;
        }

        // Clear previous active states from all views
        const activeCards = document.querySelectorAll('#cards-view .music-card.active');
        activeCards.forEach(card => card.classList.remove('active'));
        const activeListTracks = document.querySelectorAll('#cards-view .list-view-track.active');
        activeListTracks.forEach(track => track.classList.remove('active'));

        // Determine animation direction based on track navigation
        const direction = idx > this.currentTrack ? 'next' : 'prev';
        this.currentTrack = idx;
        const t = this.playlist[idx];
        
        // Apply animations to player elements
        this.applyTrackChangeAnimations(direction);
        
        // Update player content
        this.songTitleEl.textContent = this.truncateText(t.title); 
        this.artistNameEl.textContent = this.truncateText(t.artist || "Unknown Artist"); 
        this.albumArtEl.src = t.cover || this.defaultCover; 
        this.audio.src = t.file; 
        this.audio.load();
        this.audio.loop = this.isLooping;
        this.restartedTrack = false; 
        this.progressBar.style.width='0%';
        this.currentTimeEl.textContent='0:00';
        
        // this.updatePlaylistItemPlayingState(false); // Remove from old track first - OBSOLETE
        // this.updateActivePlaylistItem(); // Explicitly update active item - OBSOLETE

        // Set new active states
        const newCardEl = document.querySelector(`#cards-view .music-card[data-track-id="${t.id}"]`);
        if (newCardEl) {
            newCardEl.classList.add('active');
        }
        const listViewEl = document.querySelector('#cards-view .list-view');
        if (listViewEl && listViewEl.style.display !== 'none') { // Check if list view is visible
            const newListTrackEl = listViewEl.querySelector(`.list-view-track[data-track-id="${t.id}"]`);
            if (newListTrackEl) {
                newListTrackEl.classList.add('active');
            }
        }

        this.updateMediaSession();
        this.updatePlayerLikeButton(); // Update like button for current track

        const startPlaybackIfNeeded = () => {
            if (this.isPlaying) { 
                this.play(); // this.play() will also update media session state and is-playing class
            } else {
                // this.updatePlaylistItemPlayingState(false); // Ensure is-playing is not on new track if paused - OBSOLETE
                if (navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
            }
        };

        if (restoreTime !== null && restoreTime > 0) {
            const onLoadedMetadata = () => {
                if (this.audio.seekable.length > 0) { // Check if audio is seekable
                        this.audio.currentTime = Math.min(restoreTime, this.audio.duration);
                } else {
                    console.warn("Audio not seekable yet for restoring time.")
                }
                this.updateProgress(); // Update UI with restored time
                startPlaybackIfNeeded();
            };
            this.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
                // Fallback if loadedmetadata doesn't fire or seeking fails early
            this.audio.addEventListener('canplay', () => {
                if (this.audio.currentTime < restoreTime && this.audio.seekable.length > 0) {
                        this.audio.currentTime = Math.min(restoreTime, this.audio.duration);
                        this.updateProgress();
                }
                startPlaybackIfNeeded(); // Call here too ensure play state is correct
            }, { once: true });
        } else {
            startPlaybackIfNeeded();
        }

        // Before calling play() or setting playback state in startPlaybackIfNeeded:
        if (t && t.id) { // Ensure track and id exist
            this.incrementPlayCount(t.id);
        }

        if (t && t.id) {
            this.lastPlayedTrackIdInContext = t.id; // Ensure context tracking is updated
        }
    }

    play() {
        this.isPlaying=true; 
        this.playPauseBtn.innerHTML='<i class="fas fa-pause"></i>';
        if(this.audioContext.state==='suspended') this.audioContext.resume();
        if(!this.audioSource && this.audio.src){ 
            try {
            this.audioSource = this.audioContext.createMediaElementSource(this.audio);
            this.audioSource.connect(this.analyser);
            } catch(e) {
                console.error("Error creating media element source:", e);
                if (this.audio.readyState === 0 && this.playlist[this.currentTrack]) { 
                    console.warn("Audio source not ready, attempting to reload track data.");
                    this.audio.src = this.playlist[this.currentTrack].file;
                    this.audio.load();
                    this.audio.addEventListener('canplay', () => this.play(), {once: true});
                    return; 
                }
            }
        }
        this.audio.play().catch(error => {
            console.error("Error playing audio:", error);
            this.isPlaying = false; 
            this.playPauseBtn.innerHTML='<i class="fas fa-play"></i>';
        });
        if (navigator.mediaSession) navigator.mediaSession.playbackState = "playing";
        // this.updatePlaylistItemPlayingState(true); // Add is-playing class - OBSOLETE
        this.savePlaybackState();
        if (this.expandedPlayPauseBtn) {
            this.expandedPlayPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        }
    }
    pause(){
        this.isPlaying=false; 
        this.playPauseBtn.innerHTML='<i class="fas fa-play"></i>'; 
        this.audio.pause(); 
        this.restartedTrack = false; 
        if (!this.isScrubbing && navigator.mediaSession) navigator.mediaSession.playbackState = "paused";
        // this.updatePlaylistItemPlayingState(false); // Remove is-playing class - OBSOLETE
        this.savePlaybackState();
        if (this.expandedPlayPauseBtn) {
            this.expandedPlayPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }
    togglePlay(){ 
        this.isPlaying?this.pause():this.play(); 
        // Save state handled by play/pause methods
    }
    prevTrack(){
        this.restartedTrack = false;
        if (this.audio.currentTime > 3 && !this.restartedTrack) {
            this.audio.currentTime = 0;
            this.restartedTrack = true;
            return; // Return after restarting, don't change track yet
        }

        let nextGlobalIndex = -1;

        if (this.activeContextTracks.length > 0) {
            const currentTrackInContextIndex = this.activeContextTracks.findIndex(t => t.id === this.lastPlayedTrackIdInContext);
            if (currentTrackInContextIndex !== -1) {
                let prevContextIndex = currentTrackInContextIndex - 1;
                if (prevContextIndex < 0) {
                    prevContextIndex = this.activeContextTracks.length - 1; // Loop to end of context
                }
                const prevTrackInContext = this.activeContextTracks[prevContextIndex];
                if (prevTrackInContext) {
                    nextGlobalIndex = this.playlist.findIndex(t => t.id === prevTrackInContext.id);
                    this.lastPlayedTrackIdInContext = prevTrackInContext.id; // Update for next prev/next call
                }
            } else {
                    // Current track not in context, or context invalid - fallback to global previous
                nextGlobalIndex = this.currentTrack - 1;
                if (nextGlobalIndex < 0 && this.playlist.length > 0) nextGlobalIndex = this.playlist.length - 1;
                if (this.playlist[nextGlobalIndex]) this.lastPlayedTrackIdInContext = this.playlist[nextGlobalIndex].id;
            }
        } else { // Fallback to global playlist previous
            nextGlobalIndex = this.currentTrack - 1;
            if (nextGlobalIndex < 0 && this.playlist.length > 0) nextGlobalIndex = this.playlist.length - 1;
            if (this.playlist[nextGlobalIndex]) this.lastPlayedTrackIdInContext = this.playlist[nextGlobalIndex].id; // Also update for consistency
        }

        if (nextGlobalIndex !== -1 && nextGlobalIndex < this.playlist.length) {
            this.loadTrack(nextGlobalIndex);
        } else if (this.playlist.length > 0) {
                this.loadTrack(0); // Fallback to first track of global list
        }
    }
    nextTrack(){
        if (this.playNextFromQueue()) {
            return; // A track from the queue was played, so we stop here.
        }

        this.restartedTrack = false;
        let nextGlobalIndex = -1;
        let nextTrackIdToMarkInContext = null; // Store the ID of the track selected by context logic

        if (this.isShuffling) {
            const sourcePlaylistForShuffle = (this.activeContextTracks && this.activeContextTracks.length > 0) 
                                            ? this.activeContextTracks 
                                            : this.playlist;
            
            const currentTrackIdInContext = (this.activeContextTracks && this.activeContextTracks.length > 0) 
                                            ? this.lastPlayedTrackIdInContext 
                                            : (this.playlist[this.currentTrack] ? this.playlist[this.currentTrack].id : null);

            if (sourcePlaylistForShuffle.length === 0) { // Should not happen if playlist has tracks, but good check
                this.loadTrack(0); // Fallback to first global if somehow shuffle source is empty
                if(this.playlist[0]) this.lastPlayedTrackIdInContext = this.playlist[0].id;
                return;
            }
            if (sourcePlaylistForShuffle.length <= 1) {
                // If context (or global) has 0 or 1 song, just play that one (or first if global and 0)
                const trackToPlay = sourcePlaylistForShuffle.length === 1 ? sourcePlaylistForShuffle[0] : (this.playlist.length > 0 ? this.playlist[0] : null);
                if (trackToPlay) {
                    nextGlobalIndex = this.playlist.findIndex(t => t.id === trackToPlay.id);
                    nextTrackIdToMarkInContext = trackToPlay.id;
                } else {
                    // No tracks available at all
                    return;
                }
            } else {
                let randomIndex;
                let nextTrackToPlay;
                do {
                    randomIndex = Math.floor(Math.random() * sourcePlaylistForShuffle.length);
                    nextTrackToPlay = sourcePlaylistForShuffle[randomIndex];
                } while (sourcePlaylistForShuffle.length > 1 && nextTrackToPlay.id === currentTrackIdInContext); // Avoid immediate repeat in current context
                
                if (nextTrackToPlay) {
                    nextGlobalIndex = this.playlist.findIndex(t => t.id === nextTrackToPlay.id);
                    nextTrackIdToMarkInContext = nextTrackToPlay.id;
                }
            }
        } else { // Not shuffling
            if (this.activeContextTracks && this.activeContextTracks.length > 0) {
                const currentTrackInContextIndex = this.activeContextTracks.findIndex(t => t.id === this.lastPlayedTrackIdInContext);
                if (currentTrackInContextIndex !== -1) {
                    let nextContextIndex = currentTrackInContextIndex + 1;
                    if (nextContextIndex >= this.activeContextTracks.length) {
                        nextContextIndex = 0; // Loop to start of context
                    }
                    const nextTrackInContext = this.activeContextTracks[nextContextIndex];
                    if (nextTrackInContext) {
                        nextGlobalIndex = this.playlist.findIndex(t => t.id === nextTrackInContext.id);
                        nextTrackIdToMarkInContext = nextTrackInContext.id;
                    }
                } else {
                    // Current track not in context, or context got cleared. Fallback to first track of current context if available
                    if(this.activeContextTracks.length > 0){
                        const firstTrackInContext = this.activeContextTracks[0];
                        nextGlobalIndex = this.playlist.findIndex(t => t.id === firstTrackInContext.id);
                        nextTrackIdToMarkInContext = firstTrackInContext.id;
                    } else {
                        // Context exists but is empty, or some other inconsistent state - fallback to global next
                        nextGlobalIndex = (this.currentTrack + 1) % this.playlist.length;
                        if(this.playlist[nextGlobalIndex]) nextTrackIdToMarkInContext = this.playlist[nextGlobalIndex].id;
                    }
                }
            } else { // Fallback to global playlist next (no active context)
                nextGlobalIndex = (this.currentTrack + 1) % this.playlist.length;
                    if(this.playlist[nextGlobalIndex]) nextTrackIdToMarkInContext = this.playlist[nextGlobalIndex].id;
            }
        }

        if (nextGlobalIndex !== -1 && nextGlobalIndex < this.playlist.length) {
            this.loadTrack(nextGlobalIndex);
            if (nextTrackIdToMarkInContext) this.lastPlayedTrackIdInContext = nextTrackIdToMarkInContext; 
        } else if (this.playlist.length > 0) {
            this.loadTrack(0); 
            if(this.playlist[0]) this.lastPlayedTrackIdInContext = this.playlist[0].id;
        }
    }
    updateProgress(){
        const d=this.audio.duration, c=this.audio.currentTime;
        if(d){
            this.progressBar.style.width=`${(c/d)*100}%`;
            this.durationEl.textContent=this.formatTime(d);
        }
        this.currentTimeEl.textContent=this.formatTime(c);
        if (!this.isScrubbing && c < 3 && this.restartedTrack) {
            this.restartedTrack = false;
        }

        // Update expanded player progress
        this.updateExpandedPlayerState();
    }
    formatTime(s){ const m=Math.floor(s/60), sec=Math.floor(s%60); return `${m}:${sec<10?'0':''}${sec}`; }
    updateVolumeIcon(){
        let iconClass = 'fas fa-volume-high';
        if (this.volume === 0) iconClass = 'fas fa-volume-xmark';
        else if (this.volume < 0.01) iconClass = 'fas fa-volume-off'; // More distinct for near mute
        else if (this.volume < 0.5) iconClass = 'fas fa-volume-low';
        this.volumeBtn.innerHTML = `<i class="${iconClass}"></i>`;
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        this.audio.loop = this.isLooping;
        this.loopBtn.classList.toggle('active', this.isLooping);
        if (this.expandedLoopBtn) {
            this.expandedLoopBtn.classList.toggle('active', this.isLooping);
        }
    }

    toggleShuffle() {
        this.isShuffling = !this.isShuffling;
        this.shuffleBtn.classList.toggle('active', this.isShuffling);
        if (this.isShuffling) {
            // Optional: Clear play history when shuffle is turned on
            this.playHistory = [this.currentTrack]; 
        }
        if (this.expandedShuffleBtn) {
            this.expandedShuffleBtn.classList.toggle('active', this.isShuffling);
        }
    }

    handleTrackEnd() {
        if (this.isLooping) {
            // If looping, the current track will restart automatically or play() if it was paused.
            // If audio.loop is true, browser handles it. If we manually implement loop, call play().
            if (this.audio.loop) { 
                // If browser handles loop, ensure isPlaying state is true if it was playing
                if(this.isPlaying) this.play();
            } else {
                this.audio.currentTime = 0;
                if(this.isPlaying) this.play();
            }
        } else {
            if (!this.playNextFromQueue()) { // Try playing from queue first
                this.nextTrack(); // If queue is empty, play next in normal sequence
            }
        }
    }

    renderPlaylist() {
        const cardsView = document.getElementById('cards-view');
        cardsView.innerHTML = '';

        // Check for empty state
        if (!this.playlist || this.playlist.length === 0) {
            cardsView.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Load some music or create a playlist!</div>';
            return;
        }

        // Create special playlists section
        const specialPlaylists = document.createElement('div');
        specialPlaylists.className = 'special-playlists';

        // Liked Songs Card
        const likedSongs = this.playlist.filter(track => track.liked);
        if (likedSongs.length > 0) {
            const likedCard = this.createSpecialPlaylistCard(
                'Liked Songs',
                likedSongs.length + ' songs',
                likedSongs[0].cover || this.defaultCover,
                'Liked Songs',  // Changed from 'liked-songs' to match display name
                '<i class="fas fa-heart"></i>',
                likedSongs
            );
            specialPlaylists.appendChild(likedCard);
        }

        // Most Played Card
        const mostPlayed = this.playlist
            .filter(track => track.playCount && track.playCount > 0)
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, 10);
        if (mostPlayed.length > 0) {
            const mostPlayedCard = this.createSpecialPlaylistCard(
                'Most Played',
                mostPlayed.length + ' songs',
                mostPlayed[0].cover || this.defaultCover,
                'Most Played',  // Changed from 'most-played' to match display name
                '<i class="fas fa-medal"></i>',
                mostPlayed
            );
            specialPlaylists.appendChild(mostPlayedCard);
        }

        // Custom Playlists Cards
        if (this.customPlaylists && this.customPlaylists.length > 0) {
            this.customPlaylists.forEach(cpList => {
                const playlistTracks = cpList.trackIds
                    .map(id => this.playlist.find(t => t.id === id))
                    .filter(Boolean);
                if (playlistTracks.length > 0) {
                    const customCard = this.createSpecialPlaylistCard(
                        cpList.name,
                        playlistTracks.length + ' songs',
                        playlistTracks[0].cover || this.defaultCover,
                        'custom-' + cpList.id,
                        '<i class="fas fa-list"></i>',
                        playlistTracks,
                        cpList
                    );
                    specialPlaylists.appendChild(customCard);
                }
            });
        }

        cardsView.appendChild(specialPlaylists);

        // Add divider
        const divider = document.createElement('div');
        divider.style.height = '1px';
        divider.style.background = 'var(--border-light)';
        divider.style.margin = '0 20px';
        cardsView.appendChild(divider);

        // Regular music cards (grouped by folders)
        this.renderRegularMusicCards(cardsView);
    }

    createSpecialPlaylistCard(title, subtitle, coverUrl, id, icon, tracks, customPlaylist = null) {
        const card = document.createElement('div');
        card.className = 'special-playlist-card';
        card.dataset.playlistId = id;

        card.innerHTML = `
            <img src="${coverUrl}" class="special-playlist-cover" alt="${title}" />
            <div class="special-playlist-info">
                <div class="special-playlist-title">${icon} ${title}</div>
                <div class="special-playlist-count">${subtitle}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            this.showPlaylistListView(title, tracks, coverUrl, id, customPlaylist);
        });

        return card;
    }

    showPlaylistListView(title, tracks, coverUrl, playlistId, customPlaylist) {
        const cardsView = document.getElementById('cards-view');
        const listView = document.createElement('div');
        listView.className = 'list-view';

        const headerHtml = `
            <div class="list-view-header">
                <img src="${coverUrl}" class="list-view-cover" alt="${title}" />
                <div class="list-view-info">
                    <div class="list-view-title">${title}</div>
                    <div class="list-view-subtitle">${tracks.length} songs</div>
                    <div class="list-view-actions">
                        <button class="list-view-action-btn play-all-btn">
                            <i class="fas fa-play"></i> Play All
                        </button>
                        <button class="list-view-action-btn shuffle-btn">
                            <i class="fas fa-random"></i> Shuffle
                        </button>
                        ${customPlaylist ? '<button class="list-view-action-btn delete-playlist-btn"><i class="fas fa-trash"></i> Delete Playlist</button>' : ''}
                        <button class="list-view-action-btn back-btn">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                    </div>
                </div>
            </div>
            <div class="list-view-tracks"></div>
        `;

        listView.innerHTML = headerHtml;

        // Add tracks
        const tracksContainer = listView.querySelector('.list-view-tracks');
        tracks.forEach((track, index) => {
            const trackElement = this.createListViewTrack(track, index, playlistId, tracks, customPlaylist);
            tracksContainer.appendChild(trackElement);
        });

        // Event listeners
        listView.querySelector('.play-all-btn').addEventListener('click', () => {
            if (tracks.length > 0) {
                this.setPlaybackContext(playlistId, tracks, tracks[0].id);
                const firstTrackIndex = this.playlist.findIndex(t => t.id === tracks[0].id);
                if (firstTrackIndex !== -1) {
                    this.loadTrack(firstTrackIndex);
                    this.play();
                }
            }
        });

        listView.querySelector('.shuffle-btn').addEventListener('click', () => {
            if (tracks.length > 0) {
                this.shuffleEnabled = true;
                this.shuffleBtn.classList.add('active');
                const randomIndex = Math.floor(Math.random() * tracks.length);
                this.setPlaybackContext(playlistId, tracks, tracks[randomIndex].id);
                const trackIndex = this.playlist.findIndex(t => t.id === tracks[randomIndex].id);
                if (trackIndex !== -1) {
                    this.loadTrack(trackIndex);
                    this.play();
                }
            }
        });

        if (customPlaylist) {
            listView.querySelector('.delete-playlist-btn').addEventListener('click', () => {
                this.confirmAndDeleteCustomPlaylist(customPlaylist.id, customPlaylist.name);
            });
        }

        listView.querySelector('.back-btn').addEventListener('click', () => {
            this.renderPlaylist();
        });

        cardsView.innerHTML = '';
        cardsView.appendChild(listView);
    }

    createListViewTrack(track, index, contextPlaylistId, contextTracksArray, customPlaylistContext = null) {
        const trackElement = document.createElement('div');
        trackElement.className = 'list-view-track';
        trackElement.dataset.trackId = track.id;
        trackElement.dataset.index = index;
        trackElement.draggable = true;

    // --- MOBILE TOUCH DRAG-AND-DROP SUPPORT ---
    let touchDragData = null;
    let touchDragOverElement = null;
    let touchScrollLock = false;

    // Helper to get track element from touch
    function elementFromTouch(touch) {
        return document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.list-view-track');
    }

    // Touch start: begin drag
    trackElement.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        touchDragData = {
            startIndex: Number(trackElement.dataset.index),
            startY: e.touches[0].clientY,
            dragging: false,
            longPressTimeout: setTimeout(() => {
                trackElement.classList.add('dragging');
                touchDragData.dragging = true;
                touchScrollLock = true;
            }, 180) // Short delay to distinguish from tap/scroll
        };
    }, { passive: true });

    // Touch move: update drag visuals
    trackElement.addEventListener('touchmove', function(e) {
        if (!touchDragData) return;
        if (!touchDragData.dragging) {
            // If user scrolls vertically, cancel drag
            if (Math.abs(e.touches[0].clientY - touchDragData.startY) > 14) {
                clearTimeout(touchDragData.longPressTimeout);
                touchDragData = null;
                return;
            }
            return;
        }
        e.preventDefault();
        const overEl = elementFromTouch(e.touches[0]);
        if (overEl && overEl !== trackElement) {
            if (touchDragOverElement && touchDragOverElement !== overEl) {
                touchDragOverElement.classList.remove('drag-over', 'drag-over-bottom');
            }
            touchDragOverElement = overEl;
            const overRect = overEl.getBoundingClientRect();
            if (e.touches[0].clientY < overRect.top + overRect.height / 2) {
                overEl.classList.add('drag-over');
                overEl.classList.remove('drag-over-bottom');
            } else {
                overEl.classList.remove('drag-over');
                overEl.classList.add('drag-over-bottom');
            }
        }
    }, { passive: false });

    // Touch end: perform reorder
    trackElement.addEventListener('touchend', async function(e) {
        if (!touchDragData) return;
        clearTimeout(touchDragData.longPressTimeout);
        if (!touchDragData.dragging) {
            touchDragData = null;
            return;
        }
        trackElement.classList.remove('dragging');
        if (touchDragOverElement) {
            touchDragOverElement.classList.remove('drag-over', 'drag-over-bottom');
        }
        const overEl = touchDragOverElement;
        const draggedIdx = touchDragData.startIndex;
        let dropIdx = null;
        if (overEl) {
            dropIdx = Number(overEl.dataset.index);
        }
        touchDragData = null;
        touchDragOverElement = null;
        touchScrollLock = false;
        if (dropIdx === null || draggedIdx === dropIdx) return;
        // Store currently playing track ID before reordering
        const currentlyPlayingTrackId = this.playlist[this.currentTrack]?.id;
        if (customPlaylistContext) {
            // Custom playlist reorder logic
            const trackIds = [...customPlaylistContext.trackIds];
            const movedId = trackIds[draggedIdx];
            trackIds.splice(draggedIdx, 1);
            trackIds.splice(dropIdx, 0, movedId);
            customPlaylistContext.trackIds = trackIds;
            try {
                const db = await openMusicDB();
                const tx = db.transaction('customPlaylistsStore', 'readwrite');
                const store = tx.objectStore('customPlaylistsStore');
                await store.put(customPlaylistContext);
                await tx.complete;
                // Refresh the view
                const playlistTracks = trackIds
                    .map(id => this.playlist.find(t => t.id === id))
                    .filter(Boolean);
                if (Array.isArray(contextTracksArray)) {
                    contextTracksArray.splice(0, contextTracksArray.length, ...playlistTracks);
                }
                if (currentlyPlayingTrackId) {
                    const newIndex = playlistTracks.findIndex(t => t.id === currentlyPlayingTrackId);
                    if (newIndex !== -1) {
                        this.currentTrack = newIndex;
                    }
                }
                // Get the correct cover image source for custom playlist
                let coverImage = customPlaylistContext.coverUrl;
                if (!coverImage && playlistTracks[0]?.cover) {
                    coverImage = playlistTracks[0].cover;
                } else if (!coverImage) {
                    coverImage = this.albumArtEl?.src;
                }
                this.showPlaylistListView(
                    customPlaylistContext.name,
                    playlistTracks,
                    coverImage,
                    customPlaylistContext.id,
                    customPlaylistContext
                );
            } catch (err) {
                console.error('Failed to update custom playlist order:', err);
            }
        } else {
            // Main playlist reorder logic
            const tracksArr = contextTracksArray || this.playlist;
            const movedTrack = tracksArr[draggedIdx];
            tracksArr.splice(draggedIdx, 1);
            tracksArr.splice(dropIdx, 0, movedTrack);
            if (currentlyPlayingTrackId) {
                const newIndex = tracksArr.findIndex(t => t.id === currentlyPlayingTrackId);
                if (newIndex !== -1) {
                    this.currentTrack = newIndex;
                }
            }
            // Get the correct cover image source
            let coverImage = this.albumArtEl?.src;
            if (customPlaylistContext?.coverUrl) {
                coverImage = customPlaylistContext.coverUrl;
            } else if (tracksArr[0]?.cover) {
                coverImage = tracksArr[0].cover;
            }

            this.showPlaylistListView(
                'Playlist',
                tracksArr,
                coverImage,
                contextPlaylistId,
                customPlaylistContext
            );
        }
    }.bind(this), { passive: false });

    // Prevent scroll while dragging
    trackElement.addEventListener('touchmove', function(e) {
        if (touchScrollLock) e.preventDefault();
    }, { passive: false });

    // --- END MOBILE TOUCH DRAG-AND-DROP ---

        if (this.playlist[this.currentTrack]?.id === track.id) {
            trackElement.classList.add('active');
        }

        const duration = track.duration ? this.formatTime(track.duration) : '--:--';
        const heartIconClass = track.liked ? 'fas fa-heart' : 'far fa-heart';

        trackElement.innerHTML = `
            <div class="list-view-track-number">${index + 1}</div>
            <div class="list-view-track-info">
                <div class="list-view-track-title">${track.title}</div>
                <div class="list-view-track-artist">${track.artist || 'Unknown Artist'}</div>
            </div>
            <div class="list-view-track-duration">${duration}</div>
            <div class="list-view-track-actions">
                <button class="card-action-btn like-btn-direct ${track.liked ? 'liked' : ''}" title="${track.liked ? 'Unlike' : 'Like'}">
                    <i class="${heartIconClass}"></i>
                </button>
                <button class="card-action-btn add-to-queue-btn-direct" title="Play Next">
                    <i class="fas fa-layer-group"></i>
                </button>
                <button class="card-action-btn add-to-playlist-btn-direct" title="Add to Playlist">
                    <i class="fas fa-plus-square"></i>
                </button>
            </div>
        `;

        // Add drag and drop event listeners
        trackElement.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            trackElement.classList.add('dragging');
            e.dataTransfer.setData('text/plain', index.toString());
            e.dataTransfer.effectAllowed = 'move';
        });

        trackElement.addEventListener('dragend', () => {
            trackElement.classList.remove('dragging');
            document.querySelectorAll('.list-view-track').forEach(track => {
                track.classList.remove('drag-over');
            });
        });

        trackElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingElement = document.querySelector('.dragging');
            if (draggingElement && draggingElement !== trackElement) {
                const draggingRect = draggingElement.getBoundingClientRect();
                const targetRect = trackElement.getBoundingClientRect();
                
                // Add drag-over class based on mouse position relative to target center
                if (e.clientY < targetRect.top + targetRect.height / 2) {
                    trackElement.classList.add('drag-over');
                    trackElement.classList.remove('drag-over-bottom');
                } else {
                    trackElement.classList.remove('drag-over');
                    trackElement.classList.add('drag-over-bottom');
                }
            }
        });

        trackElement.addEventListener('dragleave', () => {
            trackElement.classList.remove('drag-over', 'drag-over-bottom');
        });

        trackElement.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const dropIdx = parseInt(trackElement.dataset.index);
            
            if (isNaN(draggedIdx) || isNaN(dropIdx) || draggedIdx === dropIdx) {
                return;
            }

            // Store currently playing track ID before reordering
            const currentlyPlayingTrackId = this.playlist[this.currentTrack]?.id;

            if (customPlaylistContext) {
                // Handle custom playlist reordering
                const trackIds = [...customPlaylistContext.trackIds];
                const movedId = trackIds[draggedIdx];
                trackIds.splice(draggedIdx, 1);
                trackIds.splice(dropIdx, 0, movedId);
                
                customPlaylistContext.trackIds = trackIds;
                
                // Update database and view
                try {
                    const db = await openMusicDB();
                    const tx = db.transaction('customPlaylistsStore', 'readwrite');
                    const store = tx.objectStore('customPlaylistsStore');
                    await store.put(customPlaylistContext);
                    await tx.complete;

                    // Refresh the view
                    const playlistTracks = trackIds
                        .map(id => this.playlist.find(t => t.id === id))
                        .filter(Boolean);

                    // Update context tracks array
                    if (Array.isArray(contextTracksArray)) {
                        contextTracksArray.splice(0, contextTracksArray.length, ...playlistTracks);
                    }

                    // Update current track index
                    if (currentlyPlayingTrackId) {
                        const newIndex = playlistTracks.findIndex(t => t.id === currentlyPlayingTrackId);
                        if (newIndex !== -1) {
                            this.currentTrack = this.playlist.findIndex(t => t.id === currentlyPlayingTrackId);
                            this.lastPlayedTrackIdInContext = currentlyPlayingTrackId;
                        }
                    }

                    this.showPlaylistListView(
                        customPlaylistContext.name,
                        playlistTracks,
                        playlistTracks[0]?.cover || this.defaultCover,
                        `__CUSTOM_${customPlaylistContext.id}__`,
                        customPlaylistContext
                    );
                } catch (error) {
                    console.error('Failed to update playlist order:', error);
                    this.openNotificationModal('Failed to update playlist order', 'Error');
                }
            } else if (contextTracksArray && Array.isArray(contextTracksArray)) {
                // Handle context array reordering
                const tracks = [...contextTracksArray];
                const movedTrack = tracks[draggedIdx];
                tracks.splice(draggedIdx, 1);
                tracks.splice(dropIdx, 0, movedTrack);
                
                // Update context array
                contextTracksArray.splice(0, contextTracksArray.length, ...tracks);
                
                // Update current track index
                if (currentlyPlayingTrackId) {
                    const newIndex = tracks.findIndex(t => t.id === currentlyPlayingTrackId);
                    if (newIndex !== -1) {
                        this.currentTrack = this.playlist.findIndex(t => t.id === currentlyPlayingTrackId);
                        this.lastPlayedTrackIdInContext = currentlyPlayingTrackId;
                    }
                }

                // Update view
                this.showPlaylistListView(
                    contextPlaylistId,
                    tracks,
                    tracks[0]?.cover || this.defaultCover,
                    contextPlaylistId
                );
            }
        });

        // Add existing click event listeners
        trackElement.querySelector('.like-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLikeStatus(track.id);
        });

        trackElement.querySelector('.add-to-queue-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.addToQueue(track.id);
        });

        trackElement.querySelector('.add-to-playlist-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAddToPlaylistModal(track.id);
        });

        trackElement.addEventListener('click', () => {
            const trackIndex = this.playlist.findIndex(t => t.id === track.id);
            if (trackIndex !== -1) {
                this.setPlaybackContext(contextPlaylistId, contextTracksArray, track.id);
                this.loadTrack(trackIndex);
                this.play();
            }
        });

        return trackElement;
    }

    renderRegularMusicCards(cardsView) {
        // Group tracks by folder
        const groupedPlaylist = {};
        this.playlist.forEach(track => {
            const pathParts = track.webkitRelativePath.split('/');
            let groupName = 'Tracks'; 
            if (pathParts.length > 1) {
                groupName = pathParts.slice(0, -1).join(' / '); 
            }
            if (!groupedPlaylist[groupName]) {
                groupedPlaylist[groupName] = [];
            }
            groupedPlaylist[groupName].push(track);
        });

        // Render each group
        for (const groupName in groupedPlaylist) {
            const groupSection = document.createElement('div');
            groupSection.className = 'cards-group';

            // Create group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'cards-group-header';
            
            const isCollapsed = this.collapsibleGroupStates[groupName];
            
            groupHeader.innerHTML = `
                <div class="group-title">
                    <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} group-collapse-icon"></i>
                    ${groupName}
                </div>
                <div class="group-actions">
                    <button class="group-action-btn delete-folder-group-btn" title="Delete folder group">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;

            groupHeader.querySelector('.group-title').addEventListener('click', () => {
                this.toggleGroupCollapse(groupName, groupSection);
            });

            groupHeader.querySelector('.delete-folder-group-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirmAndDeleteFolderGroup(groupName);
            });

            groupSection.appendChild(groupHeader);

            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'cards-container';
            if (isCollapsed) cardsContainer.style.display = 'none';

            groupedPlaylist[groupName].forEach((track, localIndex) => {
                const card = this.createPlaylistItem(track, localIndex, groupName, groupedPlaylist[groupName]);
                cardsContainer.appendChild(card);
            });

            groupSection.appendChild(cardsContainer);
            cardsView.appendChild(groupSection);
        }

        // this.updateActivePlaylistItem(); // OBSOLETE: Active item set during card creation or by loadTrack
    }

    createPlaylistItem(track, localIndex, contextName, contextTracksArr) {
        const card = document.createElement('div');
        const globalTrackIndex = this.playlist.findIndex(pTrack => pTrack.id === track.id);

        card.className = 'music-card';
        if (globalTrackIndex === this.currentTrack) {
            card.classList.add('active');
        }
        card.dataset.index = globalTrackIndex;
        card.dataset.trackId = track.id;
        card.draggable = true;

        const displayTitle = this.truncateText(track.title);
        const displayArtist = this.truncateText(track.artist || 'Unknown Artist');
        const heartIconClass = track.liked ? 'fas fa-heart' : 'far fa-heart';

        card.innerHTML = `
            <img src="${track.cover || this.defaultCover}" class="card-cover" alt="Album Art" />
            <div class="card-actions">
                <button class="card-action-btn like-btn-direct ${track.liked ? 'liked' : ''}" title="${track.liked ? 'Unlike' : 'Like'}">
                    <i class="${heartIconClass}"></i>
                </button>
                <button class="card-action-btn add-to-queue-btn-direct" title="Play Next">
                    <i class="fas fa-layer-group"></i>
                </button>
                <button class="card-action-btn add-to-playlist-btn-direct" title="Add to Playlist">
                    <i class="fas fa-plus-square"></i>
                </button>
                <button class="card-action-btn remove-track-btn-direct" title="Delete from Library">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="card-info">
                <div class="card-title">${displayTitle}</div>
                <div class="card-artist">${displayArtist}</div>
            </div>
        `;

        // Add event listeners
        card.querySelector('.like-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLikeStatus(track.id);
        });

        card.querySelector('.add-to-queue-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.addToQueue(track.id);
        });

        card.querySelector('.add-to-playlist-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openAddToPlaylistModal(track.id);
        });

        card.querySelector('.remove-track-btn-direct').addEventListener('click', (e) => {
            e.stopPropagation();
            this.confirmAndDeleteTrack(track.id, track.title);
        });

        card.addEventListener('click', () => {
            this.setPlaybackContext(contextName, contextTracksArr, track.id);
            if (globalTrackIndex !== -1) {
                this.loadTrack(globalTrackIndex);
                this.play();
            }
        });

        return card;
    }

    toggleGroupCollapse(groupName, groupSection) {
        this.collapsibleGroupStates[groupName] = !this.collapsibleGroupStates[groupName];
        localStorage.setItem('collapsibleGroupStates', JSON.stringify(this.collapsibleGroupStates));
        
        const cardsContainer = groupSection.querySelector('.cards-container');
        const icon = groupSection.querySelector('.group-collapse-icon');
        
        if (this.collapsibleGroupStates[groupName]) {
            cardsContainer.style.display = 'none';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
        } else {
            cardsContainer.style.display = 'grid';
            icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
        }
    }
    
    setPlaybackContext(contextName, contextTracks, currentTrackId = null) {
        // Disable shuffle when changing contexts
        if (this.activeContextName !== contextName) {
            this.isShuffling = false;
            this.shuffleBtn.classList.remove('active');
        }
        
        this.activeContextName = contextName;
        this.activeContextTracks = contextTracks;
        this.lastPlayedTrackIdInContext = currentTrackId;
    }

    async toggleLikeStatus(trackId) {
        const trackIndex = this.playlist.findIndex(t => t.id === trackId);
        if (trackIndex === -1) return;

        const track = this.playlist[trackIndex];
        track.liked = !track.liked;

        try {
            await updateTrackInDB(track.id, { liked: track.liked });
            console.log('Track liked status updated in DB:', track.id, track.liked);
            
            // Trigger animation if the song is now liked
            if (track.liked) {
                const playlistItemEl = this.playlistEl.querySelector(`.playlist-item[data-track-id="${track.id}"] .like-btn-direct`);
                if (playlistItemEl) {
                    playlistItemEl.classList.add('heart-animating');
                    setTimeout(() => playlistItemEl.classList.remove('heart-animating'), 500); // Duration of animation
                }
                // Also animate player bar like button if it's the current track
                if (this.playlist[this.currentTrack] && this.playlist[this.currentTrack].id === track.id) {
                    this.playerLikeBtn.classList.add('heart-animating');
                    setTimeout(() => this.playerLikeBtn.classList.remove('heart-animating'), 500);
                }
            }

            this.renderPlaylist(); 
            this.updatePlayerLikeButton(); 
        } catch (error) {
            console.error('Failed to update liked status in DB:', error);
            track.liked = !track.liked; // Revert optimistic update
            this.renderPlaylist(); 
            this.updatePlayerLikeButton(); 
            this.openNotificationModal("Failed to update like status.", "Error");
        }
    }

    handlePlayerLike() {
        if (this.playlist && this.playlist[this.currentTrack] && this.playlist[this.currentTrack].id !== undefined) {
            this.toggleLikeStatus(this.playlist[this.currentTrack].id);
            // Animation is handled within toggleLikeStatus if it becomes liked
        } else {
            this.openNotificationModal("Cannot like/unlike: No current track or track ID missing.", "Info");
        }
    }

    updatePlayerLikeButton() {
        if (!this.playlist || !this.playerLikeBtn) return;
        const currentTrackObject = this.playlist[this.currentTrack];
        if (currentTrackObject) {
            this.playerLikeBtn.innerHTML = currentTrackObject.liked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            this.playerLikeBtn.classList.toggle('active', currentTrackObject.liked);
        } else {
            this.playerLikeBtn.innerHTML = '<i class="far fa-heart"></i>'; // Default to not liked if no track
            this.playerLikeBtn.classList.remove('active');
        }
    }

    // updateActivePlaylistItem() { // Helper function to update active classes after render or track change - OBSOLETE
    //     this.playlistEl.querySelectorAll('.playlist-item').forEach(el => {
    //         const itemTrackId = parseInt(el.dataset.trackId, 10);
    //         const currentTrackObject = this.playlist[this.currentTrack];
    //         if (currentTrackObject && itemTrackId === currentTrackObject.id) {
    //             el.classList.add('active');
    //         } else {
    //             el.classList.remove('active');
    //         }
    //     });
    // }

    async incrementPlayCount(trackId) {
        const trackIndex = this.playlist.findIndex(t => t.id === trackId);
        if (trackIndex === -1) return;

        const track = this.playlist[trackIndex];
        track.playCount = (track.playCount || 0) + 1;

        try {
            await updateTrackInDB(track.id, { playCount: track.playCount });
            // console.log('Track play count updated in DB:', track.id, track.playCount);
        } catch (error) {
            console.error('Failed to update play count in DB:', error);
            // Optionally revert optimistic update, though play count is less critical than 'liked' for immediate UI feedback
            // track.playCount = (track.playCount || 1) - 1; 
        }
    }

    getAudioData(){
        const bufLen=this.analyser.frequencyBinCount;
        const arr=new Uint8Array(bufLen);
        this.analyser.getByteFrequencyData(arr);
        return arr;
    }

    // Touch event handlers for playlist drag-drop
    handleTouchStart(e) {
        const item = e.target.closest('.playlist-item');
        // if (!item || item.classList.contains('hidden-by-search')) return;
        if (!item) return; // Removed hidden-by-search check as search is removed

        this.clearLongPressTimer();
        // Reset relevant parts of touchDragState for a new interaction
        this.touchDragState = {
            ...this.touchDragState, // Keep config like thresholds
            isDragActive: false,
            draggedItem: null,
            draggedItemIndex: -1,
            potentialDragItem: item,
            currentTarget: null,
            isSwipeActive: false, // Reset swipe state
            swipeItem: item // The item being considered for swipe
        };

        const touch = e.touches[0];
        this.touchDragState.initialX = touch.clientX;
        this.touchDragState.initialY = touch.clientY;
        this.touchDragState.swipeStartX = touch.clientX; // Store swipe start specific X
        this.touchDragState.swipeStartY = touch.clientY; // Store swipe start specific Y

        // Long press for drag-and-drop still initiated here
        this.touchDragState.longPressTimer = setTimeout(() => {
            if (this.touchDragState.potentialDragItem && !this.touchDragState.isSwipeActive) { // Only activate drag if not already swiping
                this.touchDragState.isDragActive = true;
                this.touchDragState.draggedItem = this.touchDragState.potentialDragItem;
                this.touchDragState.draggedItemIndex = parseInt(this.touchDragState.draggedItem.dataset.index, 10);
                this.touchDragState.draggedItem.classList.add('dragging');
                if (navigator.vibrate) navigator.vibrate(50); 
            }
            this.touchDragState.longPressTimer = null; 
        }, this.touchDragState.longPressDuration);
    }

    clearLongPressTimer() {
        if (this.touchDragState.longPressTimer) {
            clearTimeout(this.touchDragState.longPressTimer);
            this.touchDragState.longPressTimer = null;
        }
    }

    handleTouchMove(e) {
        if (!this.touchDragState.potentialDragItem && !this.touchDragState.isDragActive && !this.touchDragState.swipeItem) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchDragState.initialX;
        const deltaY = touch.clientY - this.touchDragState.initialY;

        // If long press timer is active, check for scroll to cancel it (for drag)
        if (this.touchDragState.longPressTimer) { 
            if (Math.abs(deltaX) > this.touchDragState.scrollThreshold || Math.abs(deltaY) > this.touchDragState.scrollThreshold) {
                this.clearLongPressTimer();
                this.touchDragState.potentialDragItem = null; 
            }
        }

        if (this.touchDragState.isDragActive && this.touchDragState.draggedItem) {
            e.preventDefault(); 
            this.clearDragOverTargets();
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            const dropTarget = targetElement ? targetElement.closest('.playlist-item') : null;
            if (dropTarget && dropTarget !== this.touchDragState.draggedItem && !dropTarget.classList.contains('hidden-by-search')) {
                dropTarget.classList.add('drag-over-target');
                this.touchDragState.currentTarget = dropTarget;
            } else {
                this.touchDragState.currentTarget = null;
            }
        }
        // Drag auto-scroll logic can be added here if desired, similar to mouse drag
        else if (this.touchDragState.swipeItem && !this.touchDragState.isDragActive) {
            // Potential Swipe Logic (not yet drag-active)
            const swipeCurrentX = touch.clientX;
            const swipeCurrentY = touch.clientY;
            const swipeDeltaX = swipeCurrentX - this.touchDragState.swipeStartX;
            const swipeDeltaY = Math.abs(swipeCurrentY - this.touchDragState.swipeStartY);

            if (swipeDeltaX > 20 && swipeDeltaY < this.touchDragState.swipeMaxVerticalDistance && !this.touchDragState.isDragActive) { // Moved right significantly, and not too much vertically
                if (!this.touchDragState.isSwipeActive) {
                    this.touchDragState.isSwipeActive = true; // Mark as swipe in progress
                    this.clearLongPressTimer(); // Prevent drag from starting if it was a swipe
                    this.touchDragState.potentialDragItem = null; // Not a drag candidate anymore
                    if(this.touchDragState.swipeItem) this.touchDragState.swipeItem.classList.add('swiping', 'swipe-right-reveal');
                    e.preventDefault(); // Prevent scrolling page during swipe gesture
                }
            }

            if (this.touchDragState.isSwipeActive && this.touchDragState.swipeItem) {
                    e.preventDefault(); // Continue preventing scroll if swipe is active
                // Update visual feedback for swipe (translate item)
                const boundedSwipeDeltaX = Math.min(Math.max(0, swipeDeltaX), this.touchDragState.swipeMinDistance + 20); // Limit visual swipe distance
                this.touchDragState.swipeItem.style.transform = `translateX(${boundedSwipeDeltaX}px)`;
                if (swipeDeltaX < 10 && boundedSwipeDeltaX < 10) { // If swiped back to near start, reset swipe state
                    this.touchDragState.isSwipeActive = false;
                    if(this.touchDragState.swipeItem) {
                        this.touchDragState.swipeItem.classList.remove('swiping', 'swipe-right-reveal');
                        this.touchDragState.swipeItem.style.transform = 'translateX(0px)';
                    }
                }
            }
        }
    }

    handleTouchEnd(e) {
        this.clearLongPressTimer();
        this.stopAutoScroll(); // Stop scrolling on touch end

        const swipedItem = this.touchDragState.swipeItem;
        const wasSwiping = this.touchDragState.isSwipeActive;

        // Reset item style if it was being swiped or dragged
        if (swipedItem) {
            swipedItem.classList.remove('swiping', 'swipe-right-reveal');
            swipedItem.style.transform = 'translateX(0px)';
        }
        if (this.touchDragState.draggedItem) {
            this.touchDragState.draggedItem.classList.remove('dragging');
        }
        this.clearDragOverTargets();

        if (wasSwiping && swipedItem) {
            const touch = e.changedTouches[0]; // Use changedTouches for end event
            const swipeEndX = touch.clientX;
            const swipeDeltaX = swipeEndX - this.touchDragState.swipeStartX;
            // const swipeDeltaY = Math.abs(touch.clientY - this.touchDragState.swipeStartY); // Already checked in move

            if (swipeDeltaX >= this.touchDragState.swipeMinDistance) {
                const trackIdToQueue = parseInt(swipedItem.dataset.trackId, 10);
                if (!isNaN(trackIdToQueue)) {
                    this.addToQueue(trackIdToQueue);
                    // Add a small animation/feedback for queue add
                    swipedItem.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                    // Option 1: Animate away (then it will be re-rendered if playlist changes)
                    // swipedItem.style.transform = 'translateX(100%)'; 
                    // swipedItem.style.opacity = '0';
                    // setTimeout(() => {
                    //     swipedItem.style.transform = 'translateX(0px)';
                    //     swipedItem.style.opacity = '1';
                    //     //Potentially call renderPlaylist if you want the item to visually disappear immediately
                    //     //and not rely on notification + next render. For now, notification is primary feedback.
                    // }, 300);
                    
                    // Option 2: Quick visual confirmation (item stays, notification handles info)
                    // No specific animation here beyond resetting transform, notification is the feedback.
                }
            } else {
                // Swipe was not far enough, reset visual state if not already done
                if(swipedItem) {
                        swipedItem.style.transform = 'translateX(0px)';
                        swipedItem.classList.remove('swiping', 'swipe-right-reveal');
                }
            }
        } else if (this.touchDragState.isDragActive && this.touchDragState.draggedItem) {
            // Existing drag-and-drop logic
            if (this.touchDragState.currentTarget) {
                const droppedOnItemIndex = parseInt(this.touchDragState.currentTarget.dataset.index, 10);
                const draggedItemIndex = this.touchDragState.draggedItemIndex;
                if (draggedItemIndex !== null && draggedItemIndex !== -1 && draggedItemIndex !== droppedOnItemIndex) {
                    const currentPlayingTrackId = (this.playlist && this.currentTrack >= 0 && this.currentTrack < this.playlist.length && this.playlist[this.currentTrack]) ? this.playlist[this.currentTrack].id : null;
                    const itemToMove = this.playlist.splice(draggedItemIndex, 1)[0];
                    this.playlist.splice(droppedOnItemIndex, 0, itemToMove);
                    if (currentPlayingTrackId !== null) {
                        const newIndexOfPlayingTrack = this.playlist.findIndex(track => track.id === currentPlayingTrackId);
                        if (newIndexOfPlayingTrack !== -1) {
                            this.currentTrack = newIndexOfPlayingTrack;
                        } else {
                            if (this.playlist.length > 0) this.currentTrack = 0; else this.currentTrack = -1;
                        }
                    } else if (this.playlist.length > 0) {
                        this.currentTrack = 0;
                    } else {
                        this.currentTrack = -1;
                    }
                    this.renderPlaylist();
                    this.savePlaybackState();
                    this.updateActiveContextTracksAfterReorder();
                }
            }
        }
        
        // Reset touch state thoroughly
        this.touchDragState = { 
            ...this.touchDragState, // Keep config
            longPressTimer: null, initialX: 0, initialY: 0, isDragActive: false, 
            draggedItem: null, draggedItemIndex: -1, currentTarget: null, potentialDragItem: null,
            scrollThreshold: this.touchDragState.scrollThreshold, 
            longPressDuration: this.touchDragState.longPressDuration // Corrected typo here
        };
    }

    // toggleMobilePlaylistHeight() {
    //     const sidebar = document.getElementById('sidebar');
    //     const icon = this.togglePlaylistHeightBtn.querySelector('i');
    //     sidebar.classList.toggle('sidebar-mobile-expanded');

    //     if (sidebar.classList.contains('sidebar-mobile-expanded')) {
    //         this.togglePlaylistHeightBtn.innerHTML = 'Less <i class="fas fa-chevron-up"></i>';
    //     } else {
    //         this.togglePlaylistHeightBtn.innerHTML = 'More <i class="fas fa-chevron-down"></i>';
    //     }
    // }

    savePlaybackState() {
        if (!this.playlist || this.playlist.length === 0 || this.currentTrack < 0 || this.currentTrack >= this.playlist.length) {
            // If playlist is empty or currentTrack is invalid, remove old state
            // localStorage.removeItem('musicPlayerState'); // Optional: clear if invalid
            return; 
        }
        const state = {
            currentTrack: this.currentTrack,
            currentTime: this.audio.currentTime,
            volume: this.volume,
            isLooping: this.isLooping,
            isShuffling: this.isShuffling,
            isPlaying: this.isPlaying
        };
        localStorage.setItem('musicPlayerState', JSON.stringify(state));
        // console.log("Playback state saved:", state); // For debugging
    }

    updateMediaSession() {
        if (!('mediaSession' in navigator) || !this.playlist || this.playlist.length === 0) {
            return;
        }

        const track = this.playlist[this.currentTrack];
        if (!track) return;

        const artworkSrc = this.albumArtEl.src || this.defaultCover; 

        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title || 'Unknown Title',
            artist: track.artist || 'Unknown Artist',
            album: track.album || 'Unknown Album', 
            artwork: [
                { src: artworkSrc, sizes: '96x96', type: 'image/png' }, // Primary size
                { src: artworkSrc, sizes: '128x128', type: 'image/png' },
                { src: artworkSrc, sizes: '192x192', type: 'image/png' },
                { src: artworkSrc, sizes: '256x256', type: 'image/png' },
                { src: artworkSrc, sizes: '384x384', type: 'image/png' },
                { src: artworkSrc, sizes: '512x512', type: 'image/png' },
            ]
        });

        if (!this.mediaSessionActionsSetup) { 
            navigator.mediaSession.setActionHandler('play', () => this.play());
            navigator.mediaSession.setActionHandler('pause', () => this.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
            navigator.mediaSession.setActionHandler('seekbackward', (details) => { 
                if(this.audio.duration) this.audio.currentTime = Math.max(0, this.audio.currentTime - (details.seekOffset || 10)); 
                this.updateProgress(); 
                this.savePlaybackState();
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => { 
                if(this.audio.duration) this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + (details.seekOffset || 10)); 
                this.updateProgress();
                this.savePlaybackState();
            });
            this.mediaSessionActionsSetup = true;
        }
        // navigator.mediaSession.playbackState = this.isPlaying ? "playing" : "paused";
        if(!this.isScrubbing) { // Don't update state if scrubbing, it's handled by play/pause on scrub end
                navigator.mediaSession.playbackState = this.isPlaying ? "playing" : "paused";
        }
    }

    startAutoScroll(direction) {
        if (this.scrollIntervalId) return; // Already scrolling

        this.scrollIntervalId = setInterval(() => {
            if (direction === 'up') {
                this.playlistEl.scrollTop -= this.scrollSpeed;
            } else if (direction === 'down') {
                this.playlistEl.scrollTop += this.scrollSpeed;
            }
        }, 50); // Scroll every 50ms
    }

    stopAutoScroll() {
        if (this.scrollIntervalId) {
            clearInterval(this.scrollIntervalId);
            this.scrollIntervalId = null;
        }
    }

    async promptAndCreateCustomPlaylist() {
        // This function is now simplified to just open the modal.
        // The actual creation logic is handled by the modal's confirm button.
        this.openCreatePlaylistModal();
        // The promise resolution/rejection will be handled by `actuallyCreateCustomPlaylist` if needed elsewhere,
        // but for now, the direct interaction flow is simpler.
        return Promise.resolve(); // Or handle as needed if a promise is expected by caller.
    }

    openCreatePlaylistModal() {
        if(this.newPlaylistNameInputEl) this.newPlaylistNameInputEl.value = ''; // Clear input field
        // if(this.createPlaylistModal) this.createPlaylistModal.style.display = 'flex';
        if (this.createPlaylistModal) {
            this.createPlaylistModal.style.display = 'flex';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.createPlaylistModal.classList.add('modal-visible');
                });
            });
        }
    }

    closeCreatePlaylistModal() {
        // if(this.createPlaylistModal) this.createPlaylistModal.style.display = 'none';
        if (this.createPlaylistModal) {
            this.createPlaylistModal.classList.remove('modal-visible');
            setTimeout(() => {
                this.createPlaylistModal.style.display = 'none';
            }, 300);
        }
    }

    openConfirmationModal(message, onConfirmCallback, title = "Confirmation") {
        if (this.confirmationModal && this.confirmationModalMessageEl && this.confirmationModalTitleEl) {
            this.confirmationModalTitleEl.textContent = title;
            this.confirmationModalMessageEl.textContent = message;
            this.onConfirmCallback = onConfirmCallback;
            // this.confirmationModal.style.display = 'flex';
            this.confirmationModal.style.display = 'flex';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.confirmationModal.classList.add('modal-visible');
                });
            });
        } else {
            console.error("Confirmation modal elements not found. Falling back to native confirm.");
            if (confirm(message)) { 
                if (typeof onConfirmCallback === 'function') onConfirmCallback();
            }
        }
    }

    closeConfirmationModal() {
        // if (this.confirmationModal) this.confirmationModal.style.display = 'none';
        if (this.confirmationModal) {
            this.confirmationModal.classList.remove('modal-visible');
            setTimeout(() => {
                this.confirmationModal.style.display = 'none';
                this.onConfirmCallback = null; // Clear callback after modal is hidden
            }, 300);
        }
    }

    openNotificationModal(message, title = "Notification") {
        if (this.notificationModal && this.notificationModalMessageEl && this.notificationModalTitleEl) {
            this.notificationModalTitleEl.textContent = title;
            this.notificationModalMessageEl.textContent = message;
            // this.notificationModal.style.display = 'flex';
            this.notificationModal.style.display = 'flex';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.notificationModal.classList.add('modal-visible');
                });
            });
        } else {
            console.error("Notification modal elements not found. Falling back to native alert.");
            alert(message); 
        }
    }

    closeNotificationModal() {
        // if (this.notificationModal) this.notificationModal.style.display = 'none';
        if (this.notificationModal) {
            this.notificationModal.classList.remove('modal-visible');
            setTimeout(() => {
                this.notificationModal.style.display = 'none';
            }, 300);
        }
    }

    async actuallyCreateCustomPlaylist(playlistName) {
        // This function contains the core logic moved from promptAndCreateCustomPlaylist
        if (!playlistName || playlistName.trim() === "") {
            // alert("Playlist name cannot be empty.");
            this.openNotificationModal("Playlist name cannot be empty.", "Input Error");
            return Promise.reject("Empty playlist name");
        }

        const trimmedPlaylistName = playlistName.trim();

        const existingPlaylist = this.customPlaylists.find(
            cp => cp.name.toLowerCase() === trimmedPlaylistName.toLowerCase()
        );

        if (existingPlaylist) {
            // alert(`A playlist named "${trimmedPlaylistName}" already exists. Please choose a different name.`);
            this.openNotificationModal(`A playlist named "${trimmedPlaylistName}" already exists. Please choose a different name.`, "Creation Failed");
            return Promise.reject("Duplicate playlist name");
        }

        try {
            const newPlaylist = {
                name: trimmedPlaylistName, // Use the trimmed name
                trackIds: []
            };
            const db = await openMusicDB();
            const transaction = db.transaction('customPlaylistsStore', 'readwrite');
            const store = transaction.objectStore('customPlaylistsStore');
            const request = store.add(newPlaylist);

            return new Promise((resolve, reject) => {
                request.onsuccess = async () => {
                    newPlaylist.id = request.result;
                    this.customPlaylists.push(newPlaylist);
                    this.collapsibleGroupStates[`__CUSTOM_${newPlaylist.id}__`] = false;
                    this.renderPlaylist();
                    // alert(`Playlist "${newPlaylist.name}" created!`);
                    this.openNotificationModal(`Playlist "${newPlaylist.name}" created!`, "Success");
                    resolve(newPlaylist); 
                };
                request.onerror = (e) => {
                    console.error("Error adding new custom playlist to DB:", e.target.error);
                    // alert("Failed to create playlist. Name might already exist or another error occurred.");
                    this.openNotificationModal("Failed to create playlist. Name might already exist or another error occurred.", "Error");
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error("Error creating custom playlist:", error);
            // alert("An error occurred while creating the playlist.");
            this.openNotificationModal("An error occurred while creating the playlist.", "Error");
            return Promise.reject(error);
        }
    }

    async loadCustomPlaylistsFromDB() {
        try {
            const db = await openMusicDB();
            const transaction = db.transaction('customPlaylistsStore', 'readonly');
            const store = transaction.objectStore('customPlaylistsStore');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.customPlaylists = request.result || [];
                    console.log("Custom playlists loaded from DB:", this.customPlaylists);
                    resolve();
                };
                request.onerror = (e) => {
                    console.error("Error fetching custom playlists from DB:", e.target.error);
                    this.customPlaylists = []; // Ensure it's an array on error
                    reject(e.target.error);
                };
            });
        } catch (error) {
            console.error("Failed to load custom playlists:", error);
            this.customPlaylists = [];
            return Promise.reject(error);
        }
    }

    openAddToPlaylistModal(trackId) {
        this.trackIdForModal = trackId;
        const trackToAdd = this.playlist.find(t => t.id === trackId);

        if (!trackToAdd) {
            console.error("Track not found for modal:", trackId);
            // alert("Error: Could not find the song details.");
            this.openNotificationModal("Error: Could not find the song details.", "Error");
            return;
        }

        this.modalSongTitleEl.textContent = this.truncateText(trackToAdd.title, 30);
        this.populateModalPlaylistList();
        // this.addToPlaylistModal.style.display = 'flex';
        if (this.addToPlaylistModal) {
            this.addToPlaylistModal.style.display = 'flex';
            requestAnimationFrame(() => { // Ensures display is set before class for transition
                requestAnimationFrame(() => { // Double RAF for more robustness
                    this.addToPlaylistModal.classList.add('modal-visible');
                });
            });
        }
    }

    closeAddToPlaylistModal() {
        // this.addToPlaylistModal.style.display = 'none';
        if (this.addToPlaylistModal) {
            this.addToPlaylistModal.classList.remove('modal-visible');
            setTimeout(() => {
                this.addToPlaylistModal.style.display = 'none';
                this.trackIdForModal = null; // Reset here after modal is fully gone
                if(this.modalPlaylistListEl) this.modalPlaylistListEl.innerHTML = ''; 
            }, 300); // Match CSS transition time
        }
    }

    populateModalPlaylistList() {
        this.modalPlaylistListEl.innerHTML = ''; // Clear existing items

        if (!this.customPlaylists || this.customPlaylists.length === 0) {
            const noPlaylistsMsg = document.createElement('div');
            noPlaylistsMsg.textContent = 'No custom playlists. Create one below!';
            noPlaylistsMsg.style.padding = '10px';
            noPlaylistsMsg.style.textAlign = 'center';
            noPlaylistsMsg.style.color = 'var(--text-muted)';
            this.modalPlaylistListEl.appendChild(noPlaylistsMsg);
            return;
        }

        this.customPlaylists.forEach(cpList => {
            const listItem = document.createElement('div');
            listItem.className = 'modal-playlist-item';
            listItem.dataset.customPlaylistId = cpList.id;

            const trackIsAlreadyInPlaylist = cpList.trackIds && cpList.trackIds.includes(this.trackIdForModal);

            if (trackIsAlreadyInPlaylist) {
                listItem.innerHTML = `<i class="fas fa-minus-circle" style="color: var(--accent-color);"></i> ${this.truncateText(cpList.name, 35)} (Remove)`;
                listItem.title = `Remove song from "${cpList.name}"`;
                listItem.addEventListener('click', async () => {
                    if (this.trackIdForModal !== null) {
                        await this.removeTrackFromCustomPlaylist(this.trackIdForModal, cpList.id);
                        this.closeAddToPlaylistModal();
                    } else {
                        console.error("No trackId stored for removing from playlist.");
                    }
                });
            } else {
                listItem.innerHTML = `<i class="fas fa-plus-circle"></i> ${this.truncateText(cpList.name, 35)} (Add)`;
                listItem.title = `Add song to "${cpList.name}"`;
                listItem.addEventListener('click', async () => {
                    if (this.trackIdForModal !== null) {
                        await this.addTrackToCustomPlaylist(this.trackIdForModal, cpList.id);
                        this.closeAddToPlaylistModal();
                    } else {
                        console.error("No trackId stored for adding to playlist.");
                    }
                });
            }
            this.modalPlaylistListEl.appendChild(listItem);
        });
    }

    async addTrackToCustomPlaylist(trackId, customPlaylistId) {
        const playlistIndex = this.customPlaylists.findIndex(cp => cp.id === customPlaylistId);
        if (playlistIndex === -1) {
            console.error("Custom playlist not found in memory for ID:", customPlaylistId);
            // alert("Error: Custom playlist not found.");
            this.openNotificationModal("Error: Custom playlist not found.", "Error");
            return;
        }

        const customPlaylist = this.customPlaylists[playlistIndex];
        if (!customPlaylist.trackIds) {
            customPlaylist.trackIds = []; // Initialize if somehow missing
        }

        if (customPlaylist.trackIds.includes(trackId)) {
            // alert("This song is already in that playlist.");
            this.openNotificationModal("This song is already in that playlist.", "Info");
            return;
        }

        customPlaylist.trackIds.push(trackId);

        try {
            const db = await openMusicDB();
            const transaction = db.transaction('customPlaylistsStore', 'readwrite');
            const store = transaction.objectStore('customPlaylistsStore');
            const request = store.put(customPlaylist); // .put will update if key (id) exists

            request.onsuccess = () => {
                console.log(`Track ${trackId} added to custom playlist ${customPlaylist.name} (ID: ${customPlaylist.id}) in DB.`);
                const trackObj = this.playlist.find(t => t.id === trackId);
                // alert(`'${this.truncateText(trackObj?.title || 'Song', 30)}' added to "${customPlaylist.name}".`);
                this.openNotificationModal(`'${this.truncateText(trackObj?.title || 'Song', 30)}' added to "${customPlaylist.name}".`, "Success");
                this.renderPlaylist(); // Re-render to update track counts etc.
                // No need to close modal here, calling function will do it.
            };
            request.onerror = (e) => {
                console.error("Error updating custom playlist in DB:", e.target.error);
                // Revert optimistic update if needed (though here we modify a copy from findIndex)
                customPlaylist.trackIds.pop(); // Remove the added trackId on error
                // alert("Failed to add song to playlist.");
                this.openNotificationModal("Failed to add song to playlist.", "Error");
            };
        } catch (error) {
            console.error("DB operation failed for addTrackToCustomPlaylist:", error);
            customPlaylist.trackIds.pop(); 
            // alert("An error occurred while adding song to playlist.");
            this.openNotificationModal("An error occurred while adding song to playlist.", "Error");
        }
    }

    confirmAndDeleteCustomPlaylist(playlistId, playlistName) {
        // if (confirm(`Are you sure you want to delete the playlist "${playlistName}"? This action cannot be undone.`)) {
        //     this.actuallyDeleteCustomPlaylist(playlistId, playlistName); 
        // }
        const message = `Are you sure you want to delete the playlist "${playlistName}"? This action cannot be undone.`;
        this.openConfirmationModal(message, () => this.actuallyDeleteCustomPlaylist(playlistId, playlistName), "Delete Playlist");
    }

    async actuallyDeleteCustomPlaylist(playlistId, playlistName) {
        try {
            await deleteCustomPlaylistFromDB(playlistId);
            this.customPlaylists = this.customPlaylists.filter(cp => cp.id !== playlistId);
            delete this.collapsibleGroupStates[`__CUSTOM_${playlistId}__`];
            localStorage.setItem('collapsibleGroupStates', JSON.stringify(this.collapsibleGroupStates));

            if (this.activeContextName === `__CUSTOM_${playlistId}__`) {
                this.activeContextName = null;
                this.activeContextTracks = [];
                this.lastPlayedTrackIdInContext = null;
            }

            this.renderPlaylist();
            // alert(`Playlist "${playlistName}" deleted successfully.`);
            this.openNotificationModal(`Playlist "${playlistName}" deleted successfully.`, "Success");
        } catch (error) {
            console.error("Failed to delete custom playlist:", playlistId, error);
            // alert(`Error deleting playlist "${playlistName}". Please try again.`);
            this.openNotificationModal(`Error deleting playlist "${playlistName}". Please try again.`, "Error");
        }
    }

    async removeTrackFromCustomPlaylist(trackId, customPlaylistId) {
        const playlistIndex = this.customPlaylists.findIndex(cp => cp.id === customPlaylistId);
        if (playlistIndex === -1) {
            console.error("Custom playlist not found in memory for ID:", customPlaylistId);
            // alert("Error: Custom playlist not found.");
            this.openNotificationModal("Error: Custom playlist not found.", "Error");
            return;
        }

        const customPlaylist = this.customPlaylists[playlistIndex];
        if (!customPlaylist.trackIds || !customPlaylist.trackIds.includes(trackId)) {
            // alert("This song is not in that playlist.");
            this.openNotificationModal("This song is not in that playlist.", "Info");
            return;
        }

        customPlaylist.trackIds = customPlaylist.trackIds.filter(id => id !== trackId);

        try {
            const db = await openMusicDB();
            const transaction = db.transaction('customPlaylistsStore', 'readwrite');
            const store = transaction.objectStore('customPlaylistsStore');
            const request = store.put(customPlaylist); // .put will update

            request.onsuccess = () => {
                console.log(`Track ${trackId} removed from custom playlist ${customPlaylist.name} (ID: ${customPlaylist.id}) in DB.`);
                const trackObj = this.playlist.find(t => t.id === trackId);
                // alert(`'${this.truncateText(trackObj?.title || 'Song', 30)}' removed from "${customPlaylist.name}".`);
                this.openNotificationModal(`'${this.truncateText(trackObj?.title || 'Song', 30)}' removed from "${customPlaylist.name}".`, "Success");
                this.renderPlaylist(); // Re-render to update track counts in main playlist view
            };
            request.onerror = (e) => {
                console.error("Error updating custom playlist in DB (remove track):", e.target.error);
                // Revert optimistic update
                customPlaylist.trackIds.push(trackId); // Add it back if DB operation failed
                // alert("Failed to remove song from playlist.");
                this.openNotificationModal("Failed to remove song from playlist.", "Error");
            };
        } catch (error) {
            console.error("DB operation failed for removeTrackFromCustomPlaylist:", error);
            customPlaylist.trackIds.push(trackId); 
            // alert("An error occurred while removing song from playlist.");
            this.openNotificationModal("An error occurred while removing song from playlist.", "Error");
        }
    }

    handleScrub(event, progressContainerElement) { // progressContainerElement is the div#progress-container
        if (!this.audio.duration) return;

        // Get the actual visual bar element that user interacts with (it has margins)
        const progressBarVisualElement = progressContainerElement.querySelector('.progress-bar-container');
        if (!progressBarVisualElement) {
            console.error("Critical: '.progress-bar-container' element not found within the provided progress container element. Scrubbing will fail.");
            return;
        }

        const rect = progressBarVisualElement.getBoundingClientRect(); // Use rect of the visual .progress-bar-container
        const clickX = event.clientX - rect.left; // clickX relative to this visual bar
        const width = rect.width; // width of this visual bar
        
        let newTime = this.audio.currentTime; // Default to current time if calculation is not possible

        if (width > 0) {
            newTime = (clickX / width) * this.audio.duration;
        } else {
            // If width is 0 (e.g., display:none), try to set to beginning or end based on click relative to element start
            if (clickX <= 0) {
                newTime = 0;
            } else {
                newTime = this.audio.duration;
            }
        }
        
        // Clamp newTime to be within the valid range [0, duration]
        newTime = Math.max(0, Math.min(newTime, this.audio.duration));

        this.audio.currentTime = newTime;
        this.updateProgress(); // Update UI immediately based on the new currentTime
        // State saving and media session updates are handled at the end of the scrub interaction (mouseup)
    }

    // --- Individual Track Deletion Functions ---
    confirmAndDeleteTrack(trackId, trackTitle) {
        const message = `Are you sure you want to permanently delete the track "${this.truncateText(trackTitle, 50)}" from your library? This will remove it from all playlists and cannot be undone.`;
        this.openConfirmationModal(message, () => this.actuallyDeleteTrack(trackId, trackTitle), "Delete Track");
    }

    async actuallyDeleteTrack(trackId, trackTitle) {
        try {
            // 1. Delete from IndexedDB (playlistStore)
            await deleteTrackFromDB(trackId);

            // 2. Remove from in-memory main playlist
            const trackIndexInPlaylist = this.playlist.findIndex(t => t.id === trackId);
            if (trackIndexInPlaylist === -1) {
                // Should not happen if UI is in sync, but good to guard
                console.warn("Track to delete not found in in-memory playlist:", trackId);
                // Proceed to clean up custom playlists anyway
            } else {
                this.playlist.splice(trackIndexInPlaylist, 1);
            }

            // 3. Remove from all custom playlists (in memory and update their DB entries)
            let customPlaylistUpdatePromises = [];
            this.customPlaylists.forEach(cp => {
                if (cp.trackIds && cp.trackIds.includes(trackId)) {
                    cp.trackIds = cp.trackIds.filter(id => id !== trackId);
                    // Update this custom playlist in DB
                    const db = openMusicDB(); // dbPromise is already available
                    customPlaylistUpdatePromises.push(
                        db.then(d => {
                            const tx = d.transaction('customPlaylistsStore', 'readwrite');
                            const store = tx.objectStore('customPlaylistsStore');
                            store.put(cp);
                            return tx.complete;
                        })
                    );
                }
            });
            await Promise.all(customPlaylistUpdatePromises);

            // 4. Handle current playback if the deleted track was playing
            let playbackAffected = false;
            if (this.playlist[this.currentTrack]?.id === trackId || trackIndexInPlaylist === this.currentTrack) {
                playbackAffected = true;
                this.audio.pause();
                this.audio.src = ''; // Clear src
                this.isPlaying = false;
                this.songTitleEl.textContent = "Track Deleted";
                this.artistNameEl.textContent = "Please select a new song";
                this.albumArtEl.src = this.defaultCover;
                this.currentTimeEl.textContent = "0:00";
                this.durationEl.textContent = "0:00";
                this.progressBar.style.width = "0%";
                this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                if (navigator.mediaSession) navigator.mediaSession.playbackState = "none";
                // If there are other tracks, maybe load next or first? For now, just stop.
                // currentTrack index might need adjustment if trackIndexInPlaylist < this.currentTrack
            }
            
            // Adjust currentTrack index if a track before it was deleted
            if (trackIndexInPlaylist !== -1 && trackIndexInPlaylist < this.currentTrack) {
                this.currentTrack--;
            }
                // If currentTrack becomes invalid after deletion (e.g. last song deleted, or index shifted beyond new length)
            if (this.currentTrack >= this.playlist.length && this.playlist.length > 0) {
                this.currentTrack = 0; // Go to first track
                    if (!playbackAffected) this.loadTrack(this.currentTrack); // Load if not already handled by playbackAffected logic
            } else if (this.playlist.length === 0) {
                this.currentTrack = 0; // Reset
                // UI already cleared if playbackAffected, otherwise it might show old track
                    if (!playbackAffected) { // Clear UI if it was not the playing track but now playlist is empty
                    this.songTitleEl.textContent = "No songs in library";
                    this.artistNameEl.textContent = "Load some music!";
                    this.albumArtEl.src = this.defaultCover;
                    this.currentTimeEl.textContent = "0:00";
                    this.durationEl.textContent = "0:00";
                    this.progressBar.style.width = "0%";
                }
            }

            // 5. Update active context if necessary
            if (this.activeContextTracks.some(t => t.id === trackId)) {
                this.activeContextTracks = this.activeContextTracks.filter(t => t.id !== trackId);
                // Potentially re-evaluate lastPlayedTrackIdInContext if it was the deleted one
                if (this.lastPlayedTrackIdInContext === trackId) {
                    this.lastPlayedTrackIdInContext = null; // Or set to previous/next in context
                }
            }

            this.savePlaybackState(); // Save potentially changed currentTrack index
            this.renderPlaylist();    // Re-render UI
            this.openNotificationModal(`Track "${this.truncateText(trackTitle, 50)}" deleted.`, "Success");

        } catch (error) {
            console.error("Failed to delete track:", trackId, error);
            this.openNotificationModal(`Error deleting track "${this.truncateText(trackTitle, 50)}". Please try again.`, "Error");
            // Potentially re-fetch playlist from DB to ensure consistency if local state is messed up
        }
    }

    // --- End Individual Track Deletion ---

    // --- Folder Group Deletion Functions ---
    confirmAndDeleteFolderGroup(groupName) {
        const message = `Are you sure you want to permanently delete the folder group "${this.truncateText(groupName, 50)}" and all its tracks? This will remove them from your library and all playlists, and cannot be undone.`;
        this.openConfirmationModal(message, () => this.actuallyDeleteFolderGroup(groupName), "Delete Folder Group");
    }

    async actuallyDeleteFolderGroup(groupName) {
        try {
            // 1. Identify tracks in the group
            const tracksInGroup = this.playlist.filter(track => {
                const pathParts = (track.webkitRelativePath || '').split('/');
                // Determine group name for this track using the same logic as in renderPlaylist
                let trackGroupName = 'Tracks'; 
                if (pathParts.length > 1 && pathParts[0] !== '') { // Ensure pathParts[0] is not empty (e.g. from leading '/')
                    trackGroupName = pathParts.slice(0, -1).join(' / ');
                } else if (pathParts.length === 1 && pathParts[0] !== '') {
                    // This case might mean it's a file at root, which renderPlaylist might put under 'Tracks'
                    // For consistency, if webkitRelativePath is just "file.mp3", it should be in 'Tracks' group.
                    // The definition of groupName in renderPlaylist is: pathParts.length > 1 ? slice : 'Tracks'
                    // So if pathParts.length is 1 (e.g. "file.mp3"), trackGroupName remains 'Tracks'.
                    // This seems correct.
                }
                return trackGroupName === groupName;
            });

            if (tracksInGroup.length === 0) {
                this.openNotificationModal(`Folder group "${this.truncateText(groupName, 50)}" is already empty or not found.`, "Info");
                return;
            }
            const trackIdsToDelete = tracksInGroup.map(t => t.id);

            // Store info about the track that was current *before* deletion
            const originalCurrentTrackIndex = this.currentTrack;
            const originalCurrentTrackObject = this.playlist[originalCurrentTrackIndex];
            let currentTrackWasDeleted = false;
            let deletedTracksCountBeforeCurrent = 0;

            if (originalCurrentTrackObject && trackIdsToDelete.includes(originalCurrentTrackObject.id)) {
                currentTrackWasDeleted = true;
            } else if (originalCurrentTrackObject) {
                for (let i = 0; i < originalCurrentTrackIndex; i++) {
                    if (this.playlist[i] && trackIdsToDelete.includes(this.playlist[i].id)) {
                        deletedTracksCountBeforeCurrent++;
                    }
                }
            }

            // 2. Delete from IndexedDB (playlistStore)
            const deleteDBPromises = trackIdsToDelete.map(id => deleteTrackFromDB(id));
            await Promise.all(deleteDBPromises);

            // 3. Remove from all custom playlists (in memory and update their DB entries)
            let customPlaylistUpdatePromises = [];
            this.customPlaylists.forEach(cp => {
                const initialLength = cp.trackIds ? cp.trackIds.length : 0;
                if (cp.trackIds) {
                    cp.trackIds = cp.trackIds.filter(id => !trackIdsToDelete.includes(id));
                }
                if (cp.trackIds && cp.trackIds.length < initialLength) { 
                    const dbPromise = openMusicDB(); // Re-get promise as it might be a new context
                    customPlaylistUpdatePromises.push(
                        dbPromise.then(db => {
                            const tx = db.transaction('customPlaylistsStore', 'readwrite');
                            const store = tx.objectStore('customPlaylistsStore');
                            store.put(cp);
                            return new Promise((resolve, reject) => {
                                tx.oncomplete = resolve;
                                tx.onerror = reject;
                            });
                        })
                    );
                }
            });
            await Promise.all(customPlaylistUpdatePromises);

            // 4. Remove from in-memory main playlist (this.playlist)
            this.playlist = this.playlist.filter(track => !trackIdsToDelete.includes(track.id));

            // 5. Adjust currentTrack and playback state
            if (currentTrackWasDeleted) {
                this.audio.pause();
                this.audio.src = '';
                this.isPlaying = false;
                this.songTitleEl.textContent = "Track Deleted";
                this.artistNameEl.textContent = "Select a new song";
                this.albumArtEl.src = this.defaultCover;
                this.currentTimeEl.textContent = "0:00";
                this.durationEl.textContent = "0:00";
                this.progressBar.style.width = "0%";
                this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                if (navigator.mediaSession) navigator.mediaSession.playbackState = "none";

                if (this.playlist.length > 0) {
                    this.currentTrack = Math.min(originalCurrentTrackIndex, this.playlist.length - 1);
                    if(this.currentTrack < 0) this.currentTrack = 0;
                    this.loadTrack(this.currentTrack);
                } else {
                    this.currentTrack = 0; 
                }
            } else {
                this.currentTrack = originalCurrentTrackIndex - deletedTracksCountBeforeCurrent;
                if (this.currentTrack < 0 && this.playlist.length > 0) this.currentTrack = 0;
                else if (this.currentTrack >= this.playlist.length) {
                    this.currentTrack = this.playlist.length > 0 ? this.playlist.length - 1 : 0;
                }
            }
            
            if (this.playlist.length === 0) { // If playlist became empty
                this.currentTrack = 0;
                if (!currentTrackWasDeleted) { // If current wasn't deleted but list is now empty
                    this.audio.pause(); this.audio.src = ''; this.isPlaying = false;
                    this.songTitleEl.textContent = "No songs in library";
                    this.artistNameEl.textContent = "Load some music!";
                    this.albumArtEl.src = this.defaultCover;
                    this.currentTimeEl.textContent = "0:00";
                    this.durationEl.textContent = "0:00";
                    this.progressBar.style.width = "0%";
                    this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                    if (navigator.mediaSession) navigator.mediaSession.playbackState = "none";
                }
            }

            // 6. Update collapsible state for the deleted group
            delete this.collapsibleGroupStates[groupName];
            localStorage.setItem('collapsibleGroupStates', JSON.stringify(this.collapsibleGroupStates));

            // 7. Update active context if it was the deleted group
            if (this.activeContextName === groupName) {
                this.activeContextName = null;
                this.activeContextTracks = [];
                this.lastPlayedTrackIdInContext = null;
            }

            // 8. Save overall playback state, re-render, and notify
            this.savePlaybackState();
            this.renderPlaylist();
            // this.updateActivePlaylistItem(); // renderPlaylist calls this now
            this.openNotificationModal(`Folder group "${this.truncateText(groupName, 50)}" and its ${trackIdsToDelete.length} track(s) deleted.`, "Success");

        } catch (error) {
            console.error(`Failed to delete folder group "${groupName}":`, error);
            this.openNotificationModal(`Error deleting folder group "${this.truncateText(groupName, 50)}". Please try again.`, "Error");
            // Consider re-fetching playlist from DB to ensure consistency if an error occurs mid-process
            await this.init(); // Re-init to restore a consistent state from DB
        }
    }
    // --- End Folder Group Deletion --- 

    // --- New Volume Control Methods ---
    toggleVolumeSlider() {
        this.isVolumeSliderVisible = !this.isVolumeSliderVisible;
        if (this.volumeBarContainer) {
                this.volumeBarContainer.classList.toggle('active', this.isVolumeSliderVisible);
        }

        if (this.isVolumeSliderVisible) {
            const closeHandler = (event) => {
                if (this.volumeControlWrapper && !this.volumeControlWrapper.contains(event.target) && this.isVolumeSliderVisible) {
                    this.isVolumeSliderVisible = false;
                    if (this.volumeBarContainer) {
                        this.volumeBarContainer.classList.remove('active');
                    }
                    document.removeEventListener('click', closeHandler, true);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler, true), 0);
        }
    }

    setVolume(newVolume) {
        this.volume = Math.max(0, Math.min(1, newVolume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        if (this.volumeBar) { // For the vertical slider
            this.volumeBar.style.height = `${this.volume * 100}%`;
        }
        this.updateVolumeIcon();
        this.savePlaybackState();
    }
    // --- End New Volume Control Methods ---

    // --- Loader Modal Methods ---
    showLoaderModal(message = "Processing...", totalItems = 0) {
        if (this.loaderModal) {
            if (this.loaderModalTitleEl) this.loaderModalTitleEl.textContent = "Processing Files"; // Generic title
            if (this.loaderModalMessageEl) this.loaderModalMessageEl.textContent = message;
            if (this.loaderProgressBarEl) this.loaderProgressBarEl.style.width = '0%';
            if (this.loaderProgressTextEl) this.loaderProgressTextEl.textContent = `0 / ${totalItems}`;
            
            this.loaderModal.style.display = 'flex';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.loaderModal.classList.add('modal-visible');
                });
            });
        }
    }

    updateLoaderModal(message, processedItems, totalItems, isIndeterminate = false) {
        if (this.loaderModal && this.loaderModal.classList.contains('modal-visible')) {
            if (this.loaderModalMessageEl) this.loaderModalMessageEl.textContent = message;
            if (this.loaderProgressBarEl) {
                if (isIndeterminate) {
                    this.loaderProgressBarEl.style.width = '100%'; // Or some other indeterminate animation/style
                    // Optionally, you could add a class for a specific indeterminate animation
                } else {
                    const percentage = totalItems > 0 ? (processedItems / totalItems) * 100 : 0;
                    this.loaderProgressBarEl.style.width = `${percentage}%`;
                }
            }
            if (this.loaderProgressTextEl) {
                if (isIndeterminate) {
                        this.loaderProgressTextEl.textContent = "Processing...";
                } else {
                    this.loaderProgressTextEl.textContent = `${processedItems} / ${totalItems}`;
                }
            }
        }
    }

    hideLoaderModal() {
        if (this.loaderModal) {
            this.loaderModal.classList.remove('modal-visible');
            setTimeout(() => {
                this.loaderModal.style.display = 'none';
                // Reset progress bar for next time
                if (this.loaderProgressBarEl) this.loaderProgressBarEl.style.width = '0%';
                if (this.loaderProgressTextEl) this.loaderProgressTextEl.textContent = "0 / 0";
            }, 300); // Match CSS transition time
        }
    }
    // --- End Loader Modal Methods ---

    // updatePlaylistItemPlayingState(isPlaying) { // OBSOLETE
    //     this.playlistEl.querySelectorAll('.playlist-item.is-playing').forEach(item => {
    //         item.classList.remove('is-playing');
    //     });

    //     if (isPlaying && this.playlist && this.playlist[this.currentTrack]) {
    //         const currentTrackId = this.playlist[this.currentTrack].id;
    //         const currentItemEl = this.playlistEl.querySelector(`.playlist-item[data-track-id="${currentTrackId}"]`);
    //         if (currentItemEl) {
    //             currentItemEl.classList.add('is-playing');
    //         }
    //     }
    // }

    async updateActiveContextTracksAfterReorder() {
        if (!this.activeContextName || !this.playlist || this.playlist.length === 0) {
            this.activeContextTracks = []; // Clear if no context or playlist is empty
            return;
        }

        let newContextTracks = [];
        const currentGlobalPlaylist = this.playlist; // The reordered global list

        if (this.activeContextName === "Liked Songs") {
            newContextTracks = currentGlobalPlaylist.filter(track => track.liked);
        } else if (this.activeContextName === "Most Played") {
            newContextTracks = currentGlobalPlaylist.filter(track => track.playCount && track.playCount > 0)
                                                .sort((a, b) => b.playCount - a.playCount)
                                                .slice(0, 10);
        } else if (this.activeContextName.startsWith("__CUSTOM_")) {
            const customPlaylistId = parseInt(this.activeContextName.replace("__CUSTOM_", "").replace("__", ""), 10);
            const customPlaylist = this.customPlaylists.find(cp => cp.id === customPlaylistId);
            if (customPlaylist && customPlaylist.trackIds) {
                newContextTracks = customPlaylist.trackIds.map(tid => currentGlobalPlaylist.find(t => t.id === tid)).filter(Boolean);
            }
        } else { // Assumed to be a folder/directory group name or "Tracks" for root files
            const groupNameContext = this.activeContextName;
            newContextTracks = currentGlobalPlaylist.filter(track => {
                const pathParts = (track.webkitRelativePath || '').split('/');
                let trackGroupName = 'Tracks'; // Default for files at root or without deep paths
                if (pathParts.length > 1 && pathParts[0] !== '') { // pathParts[0] !== '' guards against paths like "/Folder/Song.mp3"
                    trackGroupName = pathParts.slice(0, -1).join(' / ');
                } else if (pathParts.length === 1 && track.webkitRelativePath && track.webkitRelativePath.includes('/')) {
                    // Catch cases like "Folder/Song.mp3" where split by '/' gives ["Folder","Song.mp3"] but it's actually one folder deep
                    // This case should be covered by pathParts.length > 1.
                    // The simple "Song.mp3" would have pathParts.length = 1, pathParts[0] = "Song.mp3", groupName = 'Tracks'
                }
                return trackGroupName === groupNameContext;
            });
        }

        this.activeContextTracks = newContextTracks;
        // console.log(`Active context '${this.activeContextName}' tracks updated. New count: ${this.activeContextTracks.length}`, this.activeContextTracks.map(t => t.title));
    }

    addToQueue(trackId) {
        const track = this.playlist.find(t => t.id === trackId);
        if (track) {
            // Avoid adding duplicates consecutively to the queue
            if (this.playQueue.length === 0 || this.playQueue[this.playQueue.length -1].id !== trackId) {
                this.playQueue.push(track);
                console.log(`Added to queue: ${track.title}`, this.playQueue.map(t=>t.title));
                // Optionally, show a notification
                this.openNotificationModal(`'${this.truncateText(track.title, 25)}' added to Play Next queue.`, "Queued");
            } else if (this.playQueue[this.playQueue.length -1].id === trackId) {
                    this.openNotificationModal(`'${this.truncateText(track.title, 25)}' is already next in queue.`, "Info");
            }
        } else {
            console.warn("Track ID not found in playlist to add to queue:", trackId);
        }
    }

    playNextFromQueue() {
        if (this.playQueue.length > 0) {
            // Store current context before playing from queue
            const previousContext = {
                name: this.activeContextName,
                tracks: [...this.activeContextTracks],
                lastPlayedId: this.lastPlayedTrackIdInContext
            };

            const nextTrackInQueue = this.playQueue.shift(); // Get and remove the first track
            const globalIndex = this.playlist.findIndex(t => t.id === nextTrackInQueue.id);
            if (globalIndex !== -1) {
                console.log(`Playing from queue: ${nextTrackInQueue.title}`);
                this.loadTrack(globalIndex);
                this.play(); // Ensure it plays

                // After the queued track finishes, restore the previous context
                const handleQueuedTrackEnd = () => {
                    this.audio.removeEventListener('ended', handleQueuedTrackEnd);
                    if (previousContext.name && previousContext.tracks.length > 0) {
                        this.setPlaybackContext(previousContext.name, previousContext.tracks, previousContext.lastPlayedId);
                    }
                };
                this.audio.addEventListener('ended', handleQueuedTrackEnd);
                return true; // Indicate a track was played from queue
            }
        }
        return false; // Queue was empty or track not found
    }

    updateExpandedPlayerState() {
        if (!this.expandedPlayer || !this.expandedPlayer.classList.contains('active')) return;

        // Update album art and background
        if (this.expandedAlbumArt) {
            this.expandedAlbumArt.src = this.albumArtEl.src;
            
            // Update background gradient based on album art colors
            if (this.albumArtEl.complete) {
                getDominantColors(this.albumArtEl).then(colors => {
                    const [color1, color2] = colors;
                    const gradient = `linear-gradient(45deg, 
                        rgba(${color1[0]}, ${color1[1]}, ${color1[2]}, 0.95), 
                        rgba(${color2[0]}, ${color2[1]}, ${color2[2]}, 0.95))`;
                    this.expandedPlayer.style.background = gradient;
                });
            }
        }
        
        // Update song info
        if (this.expandedSongTitle) {
            this.expandedSongTitle.textContent = this.songTitleEl.textContent;
        }
        if (this.expandedArtistName) {
            this.expandedArtistName.textContent = this.artistNameEl.textContent;
        }
        
        // Update play/pause button
        if (this.expandedPlayPauseBtn) {
            this.expandedPlayPauseBtn.innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        }
        
        // Update shuffle and loop buttons with active state
        if (this.expandedShuffleBtn) {
            this.expandedShuffleBtn.classList.toggle('active', this.isShuffling);
        }
        if (this.expandedLoopBtn) {
            this.expandedLoopBtn.classList.toggle('active', this.isLooping);
        }
        
        // Update progress and time in MM:SS format
        if (this.audio && this.expandedProgressBar && this.expandedCurrentTime && this.expandedDuration) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            this.expandedProgressBar.style.width = `${progress}%`;
            
            // Format time as MM:SS
            const formatMMSS = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            };
            
            this.expandedCurrentTime.textContent = formatMMSS(this.audio.currentTime);
            this.expandedDuration.textContent = formatMMSS(this.audio.duration);
        }

        // Update additional control states
        const expandedLikeBtn = document.getElementById('expanded-like-btn');
        const expandedVolumeBar = document.getElementById('expanded-volume-bar');
        const expandedShuffleBtn = document.getElementById('expanded-shuffle-btn');
        const expandedLoopBtn = document.getElementById('expanded-loop-btn');
        const currentTrack = this.playlist[this.currentTrack];
        
        if (currentTrack && currentTrack.liked) {
            expandedLikeBtn.classList.add('liked');
            expandedLikeBtn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            expandedLikeBtn.classList.remove('liked');
            expandedLikeBtn.innerHTML = '<i class="far fa-heart"></i>';
        }

        // Update volume bar
        if (expandedVolumeBar) {
            expandedVolumeBar.style.height = `${this.volume * 100}%`;
        }

        // Update shuffle and loop states
        if (this.isShuffling) {
            expandedShuffleBtn.classList.add('active');
        } else {
            expandedShuffleBtn.classList.remove('active');
        }

        if (this.isLooping) {
            expandedLoopBtn.classList.add('active');
        } else {
            expandedLoopBtn.classList.remove('active');
        }
    }

    clearSearch() {
        // Get search input and results elements
        const searchInput = document.getElementById('global-search');
        const searchResults = document.getElementById('search-results');
        const clearSearchBtn = document.getElementById('clear-search');
        
        // Clear the search input
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Hide the search results
        if (searchResults) {
            searchResults.style.display = 'none';
        }
        
        // Hide the clear button
        if (clearSearchBtn) {
            clearSearchBtn.style.display = 'none';
        }
    }
    
    performSearch(query) {
        const searchResults = document.getElementById('search-results');
        const songsResults = document.getElementById('songs-results');
        const playlistsResults = document.getElementById('playlists-results');
        const clearSearchBtn = document.getElementById('clear-search');

        // Show/hide clear button based on query
        clearSearchBtn.style.display = query ? 'block' : 'none';

        // If query is empty, hide results and return
        if (!query.trim()) {
            searchResults.style.display = 'none';
            return;
        }

        // Show search results container
        searchResults.style.display = 'block';

        // Clear previous results
        songsResults.innerHTML = '';
        playlistsResults.innerHTML = '';

        // Convert query to lowercase for case-insensitive search
        const queryLower = query.toLowerCase();

        // Search through songs
        const matchingSongs = this.playlist.filter(track => 
            track.title.toLowerCase().includes(queryLower) ||
            track.artist.toLowerCase().includes(queryLower)
        );

        // Search through playlists
        const matchingPlaylists = Object.values(this.customPlaylists || {}).filter(playlist =>
            playlist.name.toLowerCase().includes(queryLower)
        );

        // Handle no results case
        if (matchingSongs.length === 0 && matchingPlaylists.length === 0) {
            songsResults.innerHTML = `
                <div class="no-results">
                    No results found for "${query}"
                </div>
            `;
            playlistsResults.innerHTML = ''; // Ensure playlists section is empty
            return;
        }

        // Display matching songs
        if (matchingSongs.length > 0) {
            songsResults.innerHTML = `<h3>Songs</h3>`;
            matchingSongs.forEach(track => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.innerHTML = `
                    <img src="${track.cover || 'default.png'}" class="search-result-cover" alt="Cover">
                    <div class="search-result-info">
                        <div class="search-result-title">${track.title}</div>
                        <div class="search-result-subtitle">${track.artist}</div>
                    </div>
                    <div class="search-result-options">
                        <button class="search-result-option-btn add-to-queue-btn" title="Add to Queue">
                            <i class="fas fa-list"></i>
                        </button>
                        <button class="search-result-option-btn like-btn" title="${track.liked ? 'Unlike' : 'Like'}">
                            <i class="${track.liked ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        <button class="search-result-option-btn add-to-playlist-btn" title="Add to Playlist">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <span class="search-result-type">Song</span>
                `;
                
                // Main click event for playing the song
                resultItem.addEventListener('click', (e) => {
                    // Don't trigger if clicking on one of the option buttons
                    if (e.target.closest('.search-result-option-btn')) {
                        return;
                    }
                    
                    const trackIndex = this.playlist.findIndex(t => t.id === track.id);
                    if (trackIndex !== -1) {
                        // Clear the search when clicking on a song
                        this.clearSearch();
                        this.loadTrack(trackIndex);
                        this.play();
                    }
                });
                
                // Add to Queue button
                const queueBtn = resultItem.querySelector('.add-to-queue-btn');
                queueBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.addToQueue(track.id);
                    this.openNotificationModal('Added to Queue', `"${track.title}" has been added to the queue`);
                });
                
                // Like button
                const likeBtn = resultItem.querySelector('.like-btn');
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Get current state before toggling
                    const willBeLiked = !track.liked;
                    
                    // Remove any existing animation classes to reset animation
                    const heartIcon = likeBtn.querySelector('i');
                    heartIcon.style.animation = 'none';
                    
                    // Trigger reflow to restart animation
                    void heartIcon.offsetWidth;
                    
                    // Toggle like status in the database
                    this.toggleLikeStatus(track.id);
                    
                    // Update the icon with animation
                    likeBtn.innerHTML = `<i class="${willBeLiked ? 'fas' : 'far'} fa-heart"></i>`;
                    likeBtn.title = willBeLiked ? 'Unlike' : 'Like';
                    
                    // Update the track object's liked property for future reference
                    track.liked = willBeLiked;
                });
                
                // Add to Playlist button
                const addToPlaylistBtn = resultItem.querySelector('.add-to-playlist-btn');
                addToPlaylistBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openAddToPlaylistModal(track.id);
                });
                songsResults.appendChild(resultItem);
            });
        }

        // Display matching playlists
        if (matchingPlaylists.length > 0) {
            playlistsResults.innerHTML = `<h3>Playlists</h3>`;
            matchingPlaylists.forEach(playlist => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                const playlistTracks = playlist.trackIds
                    .map(id => this.playlist.find(t => t.id === id))
                    .filter(Boolean);
                const coverUrl = playlistTracks[0]?.cover || 'default.png';
                
                resultItem.innerHTML = `
                    <img src="${coverUrl}" class="search-result-cover" alt="Playlist Cover">
                    <div class="search-result-info">
                        <div class="search-result-title">${playlist.name}</div>
                        <div class="search-result-subtitle">${playlistTracks.length} songs</div>
                    </div>
                    <span class="search-result-type">Playlist</span>
                `;
                resultItem.addEventListener('click', () => {
                    // Clear the search when clicking on a playlist
                    this.clearSearch();
                    this.showPlaylistListView(
                        playlist.name,
                        playlistTracks,
                        coverUrl,
                        `__CUSTOM_${playlist.id}__`,
                        playlist
                    );
                });
                playlistsResults.appendChild(resultItem);
            });
        }
    }
}

class Visualizer {
    constructor(mp) {
        this.musicPlayer = mp;
        this.container = document.getElementById('visualizer-container');
        this.particleCount = 1800; // Slightly more particles
        this.centralElement = null;
        this.lastBassHitTime = 0;
        this.bassHitThreshold = 180; // Adjusted threshold for bass hits (0-255 scale)
        this.bassPeakDecay = 0.95;
        this.currentBassPeak = 0;
        this.cameraShakeIntensity = 0;
        this.lastVocalEnergy = 0;
        this.vocalPresenceThreshold = 0.3; // Normalized energy threshold for vocal presence

        this.init();
    }
    init(){
        this.setupScene();
        this.createCentralElement(); // Create a central element
        this.createParticles();
        this.animate();
        window.addEventListener('resize', ()=>this.onWindowResize());
    }
    setupScene(){
        this.scene = new THREE.Scene();
        const w=this.container.clientWidth, h=this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);
        this.camera.position.z=40; // Pushed camera back a bit
        this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
        this.renderer.setSize(w,h);
        this.renderer.setClearColor(0x000000,0);
        this.container.appendChild(this.renderer.domElement);
    }

    createCentralElement() {
        // Simple pulsing sphere as a central element
        const geometry = new THREE.IcosahedronGeometry(2, 1); // Radius 2, detail 1
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x330033, 
            specular: 0xaaaaaa, // Brighter specular for more pop
            shininess: 50,
            flatShading: true,
            transparent: true,
            opacity: 0.6 // Slightly more transparent
        });
        this.centralElement = new THREE.Mesh(geometry, material);
        this.scene.add(this.centralElement);

        // Add a point light to make the central element and particles look better
        const pointLight = new THREE.PointLight(0xffffff, 0.7, 200);
        pointLight.position.set(0, 0, 20);
        this.scene.add(pointLight);
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Softer ambient light
        this.scene.add(ambientLight);
    }

    createParticles(){
        const geo=new THREE.BufferGeometry();
        const pos=new Float32Array(this.particleCount*3),
                col=new Float32Array(this.particleCount*3),
                sz=new Float32Array(this.particleCount),
                vel=new Float32Array(this.particleCount*3),
                particleType=new Float32Array(this.particleCount); // 0 for normal, 1 for vocal-reactive

        for(let i=0;i<this.particleCount;i++){
            // Initialize particles at the center, they will burst outwards
            pos[i*3]=0;
            pos[i*3+1]=0;
            pos[i*3+2]=0;

            // Random initial velocities for bursting effect
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos((Math.random() * 2) - 1);
            const speed = Math.random() * 0.5 + 0.2; // Random speed
            vel[i*3] = speed * Math.sin(phi) * Math.cos(theta);
            vel[i*3+1] = speed * Math.sin(phi) * Math.sin(theta);
            vel[i*3+2] = speed * Math.cos(phi);

            col[i*3]=1; col[i*3+1]=1; col[i*3+2]=1; 
            sz[i]=Math.random()*0.25+0.05; // Slightly smaller base for more dynamic range
            particleType[i] = Math.random() < 0.2 ? 1 : 0; // ~20% particles are vocal-reactive type
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
        geo.setAttribute('color', new THREE.BufferAttribute(col,3));
        geo.setAttribute('size', new THREE.BufferAttribute(sz,1));
        geo.setAttribute('velocity', new THREE.BufferAttribute(vel,3));
        geo.setAttribute('particleType', new THREE.BufferAttribute(particleType, 1));

        const mat=new THREE.PointsMaterial({ 
            size:0.5, // Base size in material, can be scaled by attribute
            vertexColors:true, 
            transparent:true, 
            opacity:0.8, 
            sizeAttenuation:true,
            // blending: THREE.AdditiveBlending // For a brighter, glowy look
        });
        this.particleSystem=new THREE.Points(geo, mat);
        this.scene.add(this.particleSystem);
    }

    updateParticles(){
        if(!this.musicPlayer.isPlaying || !this.musicPlayer.analyser) return;

        const audioData = this.musicPlayer.getAudioData();
        const positions = this.particleSystem.geometry.attributes.position.array;
        const sizes = this.particleSystem.geometry.attributes.size.array;
        const colors = this.particleSystem.geometry.attributes.color.array;
        const velocities = this.particleSystem.geometry.attributes.velocity.array;
        
        const dataArray = audioData ? audioData : new Uint8Array(this.musicPlayer.analyser.frequencyBinCount).fill(0);

        // Detailed audio analysis
        let bassSum = 0, midSum = 0, highSum = 0, vocalSum = 0;
        const bassBins = Math.floor(dataArray.length * 0.1); // ~0-10% for bass (e.g. up to ~100-150Hz)
        const vocalStartBin = Math.floor(dataArray.length * 0.05); // Approx 50-100Hz (avoiding lowest rumble)
        const vocalEndBin = Math.floor(dataArray.length * 0.35);   // Approx up to ~1.5-2kHz for main vocal body
        const midStartBin = bassBins;
        const midEndBin = Math.floor(dataArray.length * 0.5);

        for(let j = 0; j < dataArray.length; j++) {
            const val = dataArray[j];
            if (j < bassBins) bassSum += val;
            if (j >= vocalStartBin && j < vocalEndBin) vocalSum += val;
            if (j >= midStartBin && j < midEndBin) midSum += val;
            else if (j >= midEndBin) highSum += val;
        }

        const avgBassRaw = (bassSum / (bassBins || 1));
        const avgVocalEnergy = (vocalSum / ((vocalEndBin - vocalStartBin) || 1)) / 255;
        const avgMid = (midSum / ((midEndBin - midStartBin) || 1)) / 255;
        const avgHigh = (highSum / ((dataArray.length - midEndBin) || 1)) / 255;
        const overallIntensity = dataArray.reduce((a,b) => a+b, 0) / dataArray.length / 255;

        // Bass Hit Detection & Effect
        this.currentBassPeak = Math.max(avgBassRaw, this.currentBassPeak * this.bassPeakDecay);
        let isBassHit = false;
        if (this.currentBassPeak > this.bassHitThreshold && (this.musicPlayer.audio.currentTime * 1000 - this.lastBassHitTime > 100)) { // Debounce 100ms
            isBassHit = true;
            this.lastBassHitTime = this.musicPlayer.audio.currentTime * 1000;
            this.cameraShakeIntensity = 0.8; // Trigger camera shake
        }

        // Vocal Presence (Smoothed)
        const vocalPresence = avgVocalEnergy > this.vocalPresenceThreshold;
        this.lastVocalEnergy = avgVocalEnergy; // For potential future transient detection in vocal range

        // Update central element
        if (this.centralElement) {
            let scale = 1 + (this.currentBassPeak / 255) * 2.5; // More reactive to peak
            if(isBassHit) scale *= 1.3; // Extra punch on hit
            this.centralElement.scale.set(scale, scale, scale);
            this.centralElement.rotation.x += 0.005 + avgMid * 0.02;
            this.centralElement.rotation.y += 0.003 + avgMid * 0.02;
            this.centralElement.material.emissiveIntensity = (this.currentBassPeak / 255) * 3 + (isBassHit ? 1.5 : 0.5);
            if(isBassHit) {
                // Quick color flash for central element
                this.centralElement.material.color.setHex(0xffaa00);
                setTimeout(() => { if(this.centralElement) this.centralElement.material.color.setHex(0xffffff); }, 100);
            }
        }

        for(let i=0;i<this.particleCount;i++){
            const i3 = i * 3;
            const pType = this.particleSystem.geometry.attributes.particleType.array[i];

            // Update positions based on velocity
            let speedMultiplier = 1 + (this.currentBassPeak / 255) * (pType === 1 && vocalPresence ? 1.5 : 3); // Vocal particles less affected by bass speedup
            if (isBassHit) speedMultiplier *= (pType === 1 ? 1.2 : 2.5); // Stronger burst for non-vocal on bass hit

            positions[i3] += velocities[i3] * speedMultiplier;
            positions[i3+1] += velocities[i3+1] * speedMultiplier;
            positions[i3+2] += velocities[i3+2] * speedMultiplier;

            // Particle lifetime / reset logic
            const distSq = positions[i3]*positions[i3] + positions[i3+1]*positions[i3+1] + positions[i3+2]*positions[i3+2];
            let resetDistance = (60 + (this.currentBassPeak / 255) * 100);
            if (pType === 1 && vocalPresence) resetDistance *= 0.7; // Vocal particles stay closer

            if(distSq > resetDistance * resetDistance ) { 
                positions[i3]=0;
                positions[i3+1]=0;
                positions[i3+2]=0;
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos((Math.random() * 2) - 1);
                let speed = (Math.random() * 0.2 + 0.1) * (1 + (isBassHit ? (pType === 1 ? 0.5: 2) : 0)); 
                if (pType === 1 && vocalPresence) speed *= 0.6; // Vocal particles slower initial burst

                velocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
                velocities[i3+1] = speed * Math.sin(phi) * Math.sin(theta);
                velocities[i3+2] = speed * Math.cos(phi);
            }

            const freqIndex = Math.floor((i / this.particleCount) * dataArray.length);
            const val = dataArray[freqIndex] / 255;

            sizes[i]=Math.max(0.03, val * 0.6 + (this.currentBassPeak/255) * (pType === 1 ? 0.2 : 0.6) + (isBassHit ? 0.3:0) );
            if (pType === 1 && vocalPresence) sizes[i] *= 1.8; // Vocal particles larger when vocals present

            let hue, saturation, lightness;
            if (pType === 1 && vocalPresence) { // Vocal-reactive particles styling
                hue = ( (this.musicPlayer.audio.currentTime * 5 + avgVocalEnergy * 360) % 360 ) / 360; // Shift hue with vocal energy
                saturation = 0.9 + Math.min(0.1, avgVocalEnergy * 0.5);
                lightness = 0.6 + Math.min(0.4, avgVocalEnergy * 0.8); // Brighter for vocals
            } else { // Default particles
                hue = ( (this.musicPlayer.audio.currentTime * 10 + freqIndex / dataArray.length * 90 + (this.currentBassPeak/255) * 180) % 360 ) / 360;
                saturation = 0.7 + val * 0.3; 
                lightness = 0.4 + val * 0.3 + avgHigh * 0.15 + (isBassHit ? 0.2 : 0);
            }

            const rgb=this.hslToRgb(hue, saturation, Math.min(1, lightness));
            colors[i3]=rgb[0]; colors[i3+1]=rgb[1]; colors[i3+2]=rgb[2];
        }

        ['position','size','color'].forEach(att=>
            this.particleSystem.geometry.attributes[att].needsUpdate=true
        );
        
        // Camera Shake Logic
        if (this.cameraShakeIntensity > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.cameraShakeIntensity * 2;
            this.camera.position.y += (Math.random() - 0.5) * this.cameraShakeIntensity * 1;
            this.cameraShakeIntensity -= 0.08; // Dampen shake
        } else {
            this.cameraShakeIntensity = 0; // Ensure it's reset
                // Gradual return to center X if not shaking
            this.camera.position.x += (0 - this.camera.position.x) * 0.1;
            this.camera.position.y += (0 - this.camera.position.y) * 0.1;
        }

        // Camera zoom based on overall intensity, less aggressive than before
        if (this.musicPlayer.isPlaying && dataArray.length > 0) {
                this.camera.position.z = 40 - overallIntensity * 10 - (this.currentBassPeak/255)*5; 
                this.camera.lookAt(this.scene.position); 
        }
    }
    hslToRgb(h,s,l){
        let r,g,b;
        if(s===0) r=g=b=l;
        else{
            const hue2rgb=(p,q,t)=>{
                if(t<0) t+=1; if(t>1) t-=1;
                if(t<1/6) return p+(q-p)*6*t;
                if(t<1/2) return q;
                if(t<2/3) return p+(q-p)*(2/3-t)*6;
                return p;
            };
            const q=l<0.5?l*(1+s):l+s-l*s;
            const p=2*l-q;
            r=hue2rgb(p,q,h+1/3);
            g=hue2rgb(p,q,h);
            b=hue2rgb(p,q,h-1/3);
        }
        return [r,g,b];
    }
    animate(){ requestAnimationFrame(()=>this.animate()); this.updateParticles(); this.renderer.render(this.scene,this.camera); }
    onWindowResize(){
        const w=this.container.clientWidth, h=this.container.clientHeight;
        this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
        this.renderer.setSize(w,h);
    }
}

window.addEventListener('load', ()=>{
    const player = new MusicPlayer();
    new Visualizer(player);
    
    // Sidebar popup functionality
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    // isMobile variable removed as sidebar behavior is now global
    
    // Function to toggle sidebar
    function toggleSidebar() {
        const isOpening = !sidebar.classList.contains('active');
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = isOpening ? 'hidden' : '';
        
        if (isOpening) {
            // Add click handlers to all navigation items in sidebar
            // to close it when an item is clicked.
            addSidebarItemClickHandlers();
        }
    }
    
    // Add click event to sidebar toggle button
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Close sidebar when clicking on overlay
    sidebarOverlay.addEventListener('click', () => {
        if (sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Function to add click handlers to all sidebar navigation items
    function addSidebarItemClickHandlers() {
        // Get all clickable elements in the sidebar
        const sidebarItems = sidebar.querySelectorAll('a, .sidebar-item, .playlist-item, button:not(.sidebar-toggle)');
        
        // Add click handler to each item
        sidebarItems.forEach(item => {
            // Use one-time event listener to avoid duplicates
            item.addEventListener('click', closeSidebarOnClick, { once: true });
        });
    }
    
    // Function to close sidebar when a navigation item is clicked
    function closeSidebarOnClick() {
        if (sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // Removed mobile detection and resize listener as sidebar behavior is now global.

    const themeToggleButton = document.getElementById('theme-toggle-btn');
    
    let currentTheme = 3; // Default to Dark Theme (index 1)
    const themes = [
        { // 0: Light Theme (Apple Music Inspired)
            '--bg-color': '#1c1c1e',
            '--primary-elements': '#2c2c2e',
            '--secondary-elements': '#3a3a3c',
            '--text-color': '#ffffff',
            '--text-muted': '#8e8e93',
            '--accent-color': '#FA233B',       /* Apple Music Red */
            '--hover-accent': '#b01a2b',       /* Darker red for hover */
            '--button-text': '#ffffff',
            '--border-main': '#38383a',
            '--border-light': '#48484a',       /* Slightly lighter border for dark mode */
            '--border-radius-main': '8px',
            '--border-radius-small': '6px',
            '--player-bar-bg': 'rgba(36, 36, 38, 0.85)',
            '--sidebar-bg': '#232325',
            '--selected-item-bg': 'rgba(250, 35, 59, 0.2)',  /* Apple Music red with transparency */
            '--selected-item-text': '#FA233B',
            '--shadow-color': 'rgba(0, 0, 0, 0.3)'
        },
        { // 1: Dark Theme (Apple Music Dark Mode Inspired) - DEFAULT
            '--bg-color': '#1c1c1e',
            '--primary-elements': '#2c2c2e',
            '--secondary-elements': '#3a3a3c',
            '--text-color': '#ffffff',
            '--text-muted': '#8e8e93',
            '--accent-color': '#1DB954',       /* Spotify Green */
            '--hover-accent': '#14833b',       /* Darker Spotify green for hover */
            '--button-text': '#ffffff',
            '--border-main': '#38383a',
            '--border-light': '#48484a',       /* Slightly lighter border for dark mode */
            '--border-radius-main': '8px',
            '--border-radius-small': '6px',
            '--player-bar-bg': 'rgba(36, 36, 38, 0.85)',
            '--sidebar-bg': '#232325',
            '--selected-item-bg': 'rgba(29, 185, 84, 0.2)',  /* Spotify green with transparency */
            '--selected-item-text': '#1DB954',
            '--shadow-color': 'rgba(0, 0, 0, 0.3)'

        },
        { // 2: Original Synthwave (Kept for variety)
            '--bg-color': '#0d0221',
            '--primary-elements': '#240046',
            '--secondary-elements': '#3c096c',
            '--text-color': '#f0f0f0',
            '--text-muted': '#a0a0a0',
            '--accent-color': '#ff00e0',
            '--hover-accent': '#c000a0',
            '--button-text': '#e0e0e0',
            '--border-main': '#58187A',
            '--border-light': '#4A0F6A',
            '--border-radius-main': '8px',
            '--border-radius-small': '6px',
            '--player-bar-bg': 'rgba(20, 2, 35, 0.85)',
            '--sidebar-bg': '#1A022F',
            '--selected-item-bg': 'rgba(255, 0, 224, 0.15)',
            '--selected-item-text': '#ff00e0',
            '--shadow-color': 'rgba(0, 0, 0, 0.4)'
        },
        { // 3: Party Theme!
            '--bg-color': '#000000', /* Pure black background */
            '--primary-elements': '#222222', /* Dark elements */
            '--secondary-elements': '#333333', /* Slightly lighter dark */
            '--text-color': '#ffffff', /* Bright white text */
            '--text-muted': '#bbbbbb', /* Bright muted text */
            '--accent-color': '#00f2ea', /* Neon Cyan/Teal */
            '--hover-accent': '#00c1b8', /* Darker Neon Cyan/Teal */
            '--button-text': '#ffffff',
            '--border-main': '#444444', /* Dark borders */
            '--border-light': '#555555',
            '--border-radius-main': '10px', /* More rounded for fun */
            '--border-radius-small': '7px',
            '--player-bar-bg': 'rgba(10, 10, 10, 0.9)', /* Almost opaque dark bar */
            '--sidebar-bg': '#181818', /* Dark sidebar */
            '--selected-item-bg': 'rgba(0, 242, 234, 0.25)', /* Neon selection */
            '--selected-item-text': '#00f2ea',
            '--shadow-color': 'rgba(0, 242, 234, 0.3)' /* Neon shadow */
        }
    ];

    function applyTheme(theme) {
        for (const [key, value] of Object.entries(theme)) {
            document.documentElement.style.setProperty(key, value);
        }
    }

    if (themeToggleButton) {
        applyTheme(themes[currentTheme]); // Apply initial theme (now always dark by default)
        themeToggleButton.addEventListener('click', () => {
            currentTheme = (currentTheme + 1) % themes.length;
            applyTheme(themes[currentTheme]);
            // REMOVED: localStorage.setItem('musicPlayerTheme', currentTheme);
        });
    } else {
        console.warn("Theme toggle button not found in the player bar.");
    }

    // Party mode functionality
    const partyBtn = document.getElementById('party-btn');
    const visualizerContainer = document.getElementById('visualizer-container');
    
    partyBtn.addEventListener('click', () => {
        document.body.classList.toggle('party-mode');
        if (document.body.classList.contains('party-mode')) {
            partyBtn.innerHTML = '<i class="fas fa-times"></i>Exit Party Mode';
            visualizerContainer.style.display = 'block';
            // Force a resize event to make sure the visualizer adjusts to the new size
            window.dispatchEvent(new Event('resize'));
        } else {
            partyBtn.innerHTML = '<i class="fas fa-music"></i>Party Mode';
            visualizerContainer.style.display = 'none';
        }
    });

    // Expanded Player functionality
    const expandedPlayer = document.getElementById('expanded-player');
    const expandedAlbumArt = document.getElementById('expanded-album-art');
    const expandedSongTitle = document.getElementById('expanded-song-title');
    const expandedArtistName = document.getElementById('expanded-artist-name');
    const expandedPlayPauseBtn = document.getElementById('expanded-play-pause-btn');
    const expandedPrevBtn = document.getElementById('expanded-prev-btn');
    const expandedNextBtn = document.getElementById('expanded-next-btn');
    const expandedShuffleBtn = document.getElementById('expanded-shuffle-btn');
    const expandedLoopBtn = document.getElementById('expanded-loop-btn');
    const expandedProgressBar = document.getElementById('expanded-progress-bar');
    const expandedCurrentTime = document.getElementById('expanded-current-time');
    const expandedDuration = document.getElementById('expanded-duration');
    const closeExpandedPlayerBtn = document.getElementById('close-expanded-player');

    // Add click handler to album art to show expanded player
    document.querySelector('.album-cover').addEventListener('click', () => {
        expandedPlayer.classList.add('active');
        updateExpandedPlayerState();
    });

    // Close expanded player
    closeExpandedPlayerBtn.addEventListener('click', () => {
        expandedPlayer.classList.remove('active');
        
        // Add animation to player bar when exiting expanded view
        const playerBar = document.getElementById('player-bar');
        playerBar.classList.add('animate-in');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            playerBar.classList.remove('animate-in');
        }, 500);
    });

    // Update expanded player state
    function updateExpandedPlayerState() {
        // Update album art
        expandedAlbumArt.src = document.getElementById('album-art').src;
        
        // Update song info
        expandedSongTitle.textContent = document.getElementById('song-title').textContent;
        expandedArtistName.textContent = document.getElementById('artist-name').textContent;
        
        // Update play/pause button
        // Check if musicPlayer exists and has an audio element before accessing properties
        const isPlaying = window.musicPlayer && window.musicPlayer.audio && !window.musicPlayer.audio.paused;
        expandedPlayPauseBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        
        // Update shuffle and loop buttons
        expandedShuffleBtn.classList.toggle('active', document.getElementById('shuffle-btn').classList.contains('active'));
        expandedLoopBtn.classList.toggle('active', document.getElementById('loop-btn').classList.contains('active'));
        
        // Custom time formatter: HH:MM:SS if >= 1 hour, else MM:SS
        function formatTimeSmart(seconds) {
            if (isNaN(seconds) || seconds < 0) return '0:00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) {
                return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            } else {
                return `${m}:${String(s).padStart(2, '0')}`;
            }
        }
        // Update progress
        if (audioPlayer) {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            expandedProgressBar.style.width = `${progress}%`;
            expandedCurrentTime.textContent = formatTimeSmart(audioPlayer.currentTime);
            expandedDuration.textContent = formatTimeSmart(audioPlayer.duration);
        }
    }

    // Add event listeners for expanded player controls
    expandedPlayPauseBtn.addEventListener('click', togglePlay);
    expandedPrevBtn.addEventListener('click', playPrevious);
    expandedNextBtn.addEventListener('click', playNext);
    expandedShuffleBtn.addEventListener('click', toggleShuffle);
    expandedLoopBtn.addEventListener('click', toggleLoop);

    // Update expanded player progress bar when audio time updates
    audioPlayer.addEventListener('timeupdate', () => {
        if (expandedPlayer.classList.contains('active')) {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            expandedProgressBar.style.width = `${progress}%`;
            expandedCurrentTime.textContent = formatTime(audioPlayer.currentTime);
        }
    });

    // Handle progress bar clicks in expanded view
    document.querySelector('.expanded-player .progress-bar-container').addEventListener('click', (e) => {
        if (!audioPlayer.src) return;
        
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = x / width;
        
        audioPlayer.currentTime = audioPlayer.duration * percentage;
    });

    // Update expanded player when song changes
    function onSongChange() {
        if (expandedPlayer.classList.contains('active')) {
            updateExpandedPlayerState();
        }
    }
});