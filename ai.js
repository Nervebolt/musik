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
            const searchableText = `${song.title || ''} ${song.artist || ''} ${song.album || ''} ${song.genre || ''}`.toLowerCase();
            moodScoresPerSong[song.id] = {};

            for (const mood of this.moods) {
                let score = 0;
                mood.keywords.forEach(keyword => {
                    if (searchableText.includes(keyword)) {
                        score++;
                    }
                });

                // Apply negative keywords penalty
                if (mood.negativeKeywords) {
                    mood.negativeKeywords.forEach(negKeyword => {
                        if (searchableText.includes(negKeyword)) {
                            score -= 2; // Penalize more heavily for negative keywords
                        }
                    });
                }

                moodScoresPerSong[song.id][mood.name] = Math.max(0, score); // Ensure score doesn't go below 0
            }

            let bestMood = null;
            let highestScore = -1;

            // Find the mood with the highest net score
            for (const mood of this.moods) {
                const currentScore = moodScoresPerSong[song.id][mood.name];
                if (currentScore > highestScore) {
                    highestScore = currentScore;
                    bestMood = mood.name;
                } else if (currentScore === highestScore && bestMood === null) {
                    // If multiple moods have the same highest score, pick the first one encountered
                    bestMood = mood.name;
                }
            }

            // Assign the song to its best mood. Fallback to a random mood if no clear mood identified.
            if (bestMood && highestScore > 0) {
                if (!songsByMood[bestMood]) {
                    songsByMood[bestMood] = [];
                }
                songsByMood[bestMood].push(song);
            } else {
                // If no positive score or multiple moods with same highest score (including 0), assign to a random mood.
                // This ensures songs with no strong indicators are still categorized.
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