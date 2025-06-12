class AIPlaylistGenerator {
    constructor(musicPlayer) {
        this.player = musicPlayer;
        this.moods = [
            { name: "⚡️ Energize", keywords: ["upbeat", "energetic", "dance", "party", "hype", "fast", "beats", "power", "workout", "gym", "run", "rave", "club", "remix", "motivation", "confidence", "boost", "edm", "pop rock", "trap"], negativeKeywords: ["sad", "calm", "slow", "acoustic", "sleep", "meditation", "chill", "relax", "mellow"] },
            { name: "🌊 Chill", keywords: ["chill", "relax", "calm", "peaceful", "lofi", "mellow", "study", "sleep", "ambient", "indie", "unwind", "lounge", "dream", "lullaby", "soft", "rain", "meditation", "peace"], negativeKeywords: ["hype", "energetic", "workout", "party", "dance", "fast", "rock", "loud", "aggressive", "dramatic"] },
            { name: "💔 Heartbreak", keywords: ["sad", "heartbreak", "melancholy", "broken", "emotional", "crying", "dread", "acoustic", "piano", "soul", "somber", "reflective", "down", "lonely", "brooding", "pain", "grief"], negativeKeywords: ["happy", "joy", "upbeat", "energetic", "party", "dance", "hype", "celebration"] },
            { name: "🌞 Vibes", keywords: ["happy", "joy", "cheerful", "sunny", "carefree", "road trip", "brunch", "indie pop", "retro funk", "tropical house", "optimistic", "bright", "positive", "fun"], negativeKeywords: ["sad", "melancholy", "broken", "dramatic", "dark", "aggressive", "somber"] },
            { name: "🎭 Cinematic", keywords: ["epic", "intense", "dramatic", "cinematic", "goosebumps", "emotional journey", "soundtrack", "orchestral", "instrumental rock", "score", "grand", "sweeping", "theme", "film"], negativeKeywords: ["lofi", "chill", "calm", "soft", "mellow", "background", "simple", "acoustic"] },
            { name: "🧠 Focus", keywords: ["study", "focus", "work", "concentration", "deep work", "background", "minimal electronic", "classical", "instrumental", "ambient", "no lyrics", "brain", "productivity"], negativeKeywords: ["party", "dance", "energetic", "loud", "distracting", "vocal", "hype", "rock"] },
            { name: "💃 Party", keywords: ["party", "dance", "celebration", "high energy", "club", "house party", "solo dance", "latin pop", "electro", "bollywood", "bangers", "beats", "remix", "move", "groove"], negativeKeywords: ["sad", "calm", "mellow", "sleep", "meditation", "quiet", "acoustic", "somber", "reflective"] },
            { name: "😈 Dark", keywords: ["dark", "aggressive", "rage", "revenge", "intensity", "serious", "gym", "drill", "hard rock", "dark techno", "heavy", "fierce", "anger", "power"], negativeKeywords: ["happy", "joy", "chill", "relax", "calm", "peaceful", "romantic", "soft", "bright"] },
            { name: "🪷 Spiritual", keywords: ["spiritual", "meditative", "peace", "yoga", "zen", "calm", "inner peace", "nature sounds", "indian classical", "ambient", "soulful", "enlightenment", "tranquil", "healing"], negativeKeywords: ["energetic", "party", "dance", "loud", "aggressive", "workout", "hype", "rock"] },
            { name: "🕺 Retro", keywords: ["retro", "nostalgic", "old school", "flashback", "90s", "80s", "classic", "vintage", "synthwave", "bollywood", "hits", "throwback", "funk", "disco"], negativeKeywords: ["modern", "new", "future", "contemporary", "hip hop", "trap", "drill"] }
        ];
    }

    async generateMoodPlaylists() {
        if (!this.player.playlist || this.player.playlist.length < 10) {
            this.player.openNotificationModal("You need at least 10 songs in your library to generate AI playlists.", "Not Enough Songs");
            return;
        }

        this.player.showLoaderModal("Generating AI Playlists...", this.moods.length);

        const songsByMood = this.categorizeSongsByMood();
        let playlistsCreatedCount = 0;

        for (const mood of this.moods) {
            const songsForMood = songsByMood[mood.name] || [];
            if (songsForMood.length >= 3) { // Only create a playlist if there are at least 3 songs for that mood
                const playlistName = `AI: ${mood.name}`;
                
                // Check if playlist already exists
                const existingPlaylist = this.player.customPlaylists.find(
                    cp => cp.name.toLowerCase() === playlistName.toLowerCase()
                );

                if (existingPlaylist) {
                    this.player.updateLoaderModal(`Skipping existing playlist: ${playlistName}`, playlistsCreatedCount, this.moods.length);
                    continue;
                }

                try {
                    const newPlaylist = await this.player.actuallyCreateCustomPlaylist(playlistName);
                    if (newPlaylist) {
                        for (const song of songsForMood) {
                            await this.player.addTrackToCustomPlaylist(song.id, newPlaylist.id);
                        }
                        playlistsCreatedCount++;
                    }
                    this.player.updateLoaderModal(`Generated: ${playlistName}`, playlistsCreatedCount, this.moods.length);
                } catch (error) {
                    console.error(`Error creating AI playlist for ${mood.name}:`, error);
                    // Error notification handled by actuallyCreateCustomPlaylist/addTrackToCustomPlaylist
                }
            }
        }
        
        this.player.hideLoaderModal();
        if (playlistsCreatedCount > 0) {
            this.player.openNotificationModal(`${playlistsCreatedCount} AI playlist(s) generated based on your music!`, "AI Playlists Ready");
            this.player.renderPlaylist(); // Re-render to show new playlists
        } else {
            this.player.openNotificationModal("No new AI playlists could be generated with enough songs. Try adding more music!", "AI Playlists");
        }
    }

    categorizeSongsByMood() {
        const songsByMood = {};
        const moodScoresPerSong = {};

        this.player.playlist.forEach(song => {
            const songTitle = (song.title || '').toLowerCase();
            const songArtist = (song.artist || '').toLowerCase();
            const songAlbum = (song.album || '').toLowerCase();
            const songGenre = (song.genre || '').toLowerCase();

            moodScoresPerSong[song.id] = {};

            for (const mood of this.moods) {
                let score = 0;
                let negativeKeywordPresent = false; // Flag to check if any negative keyword is hit

                mood.keywords.forEach(keyword => {
                    if (songTitle.includes(keyword)) score += 3;
                    if (songArtist.includes(keyword)) score += 2;
                    if (songAlbum.includes(keyword)) score += 1;
                    if (songGenre.includes(keyword)) score += 4; // Genre is often a strong indicator
                });

                if (mood.negativeKeywords) {
                    for (const negKeyword of mood.negativeKeywords) {
                        if (songTitle.includes(negKeyword) || songArtist.includes(negKeyword) ||
                            songAlbum.includes(negKeyword) || songGenre.includes(negKeyword)) {
                            negativeKeywordPresent = true;
                            break; // Found a negative keyword, no need to check further for this mood
                        }
                    }
                }

                // If any negative keyword is present for this mood, this mood is a very poor fit.
                // Assign a very low negative score to strongly deter classification into this mood.
                if (negativeKeywordPresent) {
                    moodScoresPerSong[song.id][mood.name] = -999;
                } else {
                    moodScoresPerSong[song.id][mood.name] = score;
                }
            }

            let bestMood = null;
            let highestScore = -Infinity; // Initialize with negative infinity to correctly find the highest score
            let potentialMoods = []; // To collect all moods that have the highest score

            // Find the mood(s) with the highest score
            for (const mood of this.moods) {
                const currentScore = moodScoresPerSong[song.id][mood.name];
                if (currentScore > highestScore) {
                    highestScore = currentScore;
                    potentialMoods = [mood.name]; // Start a new list of potential moods
                } else if (currentScore === highestScore) {
                    potentialMoods.push(mood.name); // Add to existing list of potential moods
                }
            }

            // Assign the song to its best mood.
            // Only assign if the highest score is positive and there's a clear best mood or a reasonable tie.
            if (highestScore > 0 && potentialMoods.length > 0) {
                // If multiple moods have the same highest positive score, pick one randomly from them
                const selectedMood = potentialMoods[Math.floor(Math.random() * potentialMoods.length)];
                if (!songsByMood[selectedMood]) {
                    songsByMood[selectedMood] = [];
                }
                songsByMood[selectedMood].push(song);
            } else {
                // If no strong mood identified (highest score is 0 or negative),
                // assign to a random mood to ensure all songs are processed for playlist generation purposes.
                const randomMood = this.moods[Math.floor(Math.random() * this.moods.length)];
                if (!songsByMood[randomMood.name]) {
                    songsByMood[randomMood.name] = [];
                }
                songsByMood[randomMood.name].push(song);
            }
        });

        return songsByMood;
    }
} 