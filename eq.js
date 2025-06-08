// eq.js - Equalizer logic

class AudioEqualizer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.source = null; // The audio source (e.g., MediaElementSourceNode)
        this.analyser = this.audioContext.createAnalyser(); // For visualization if needed
        this.gainNode = this.audioContext.createGain(); // Master gain

        // Define 10 bands for the equalizer (frequencies are typical for a 10-band EQ)
        this.bands = [
            { f: 60, type: 'lowshelf', gain: 0, q: 1 },
            { f: 170, type: 'peaking', gain: 0, q: 1 },
            { f: 310, type: 'peaking', gain: 0, q: 1 },
            { f: 600, type: 'peaking', gain: 0, q: 1 },
            { f: 1000, type: 'peaking', gain: 0, q: 1 },
            { f: 3000, type: 'peaking', gain: 0, q: 1 },
            { f: 6000, type: 'peaking', gain: 0, q: 1 },
            { f: 12000, type: 'peaking', gain: 0, q: 1 },
            { f: 14000, type: 'peaking', gain: 0, q: 1 },
            { f: 16000, type: 'highshelf', gain: 0, q: 1 }
        ];

        this.filters = [];
        this.createFilters();

        // Load and apply the last used preset from local storage
        const lastPreset = localStorage.getItem('equalizerPreset');
        if (lastPreset) {
            this.applyPreset(lastPreset);
        }
    }

    createFilters() {
        this.bands.forEach(band => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = band.type;
            filter.frequency.value = band.f;
            filter.gain.value = band.gain; // Initial gain
            filter.Q.value = band.q; // Q factor, can be adjusted
            this.filters.push(filter);
        });
    }

    // Call this method to set the audio source for the equalizer
    setSource(sourceNode) {
        if (this.source) {
            // Disconnect previous source if any
            this.source.disconnect();
        }
        this.source = sourceNode;
        this.connectNodes(); // Reconnect with the new source
    }

    connectNodes() {
        // Connect filters in series
        if (this.filters.length > 0) {
            this.source.connect(this.filters[0]);
            for (let i = 0; i < this.filters.length - 1; i++) {
                this.filters[i].connect(this.filters[i + 1]);
            }
            this.filters[this.filters.length - 1].connect(this.gainNode);
        } else {
            this.source.connect(this.gainNode);
        }
        this.gainNode.connect(this.analyser);
    }

    setGain(bandIndex, value) {
        if (this.filters[bandIndex]) {
            this.filters[bandIndex].gain.value = value;
            this.bands[bandIndex].gain = value; // Update internal state
        }
    }

    setQ(bandIndex, value) {
        if (this.filters[bandIndex] && (this.filters[bandIndex].type === 'peaking' || this.filters[bandIndex].type === 'bandpass' || this.filters[bandIndex].type === 'notch')) {
            this.filters[bandIndex].Q.value = value;
            this.bands[bandIndex].q = value; // Update internal state
        } else {
            console.warn('Q factor is not applicable or cannot be set for filter type:', this.filters[bandIndex].type);
        }
    }

    setMasterGain(value) {
        this.gainNode.gain.value = value;
    }

    // Presets
    applyPreset(presetName) {
        // this.setMasterGain(0.75); // Safe cap before applying preset
        localStorage.setItem('equalizerPreset', presetName); // Save the preset to local storage
        switch (presetName) {
            case 'flat':
                this.bands.forEach((band, index) => {
                    this.setGain(index, 0);
                    // Reset Q to default if applicable, or define a default Q for flat
                    if (this.bands[index].type === 'peaking' || this.bands[index].type === 'bandpass' || this.bands[index].type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'rock':
                // ROCK preset: based on user's new specifications
                this.setGain(0, 3);  // 60Hz: +3dB (Adjusted for distortion)
                this.setGain(1, 2);  // 170Hz: +2dB (Adjusted for distortion)
                this.setGain(2, 1);  // 310Hz: +1dB (Adjusted for distortion)
                this.setGain(3, 1);  // 600Hz: +1dB
                this.setGain(4, -1); // 1kHz: -1dB
                this.setGain(5, 1);  // 3kHz: +1dB
                this.setGain(6, 4);  // 6kHz: +4dB
                this.setGain(7, 6);  // 12kHz: +6dB
                this.setGain(8, 7);  // 14kHz: +7dB
                this.setGain(9, 7);  // 16kHz: +7dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'jazz':
                // JAZZ preset: based on user's new specifications
                this.setGain(0, 2);  // 60Hz: +2dB (Adjusted for distortion)
                this.setGain(1, 1);  // 170Hz: +1dB (Adjusted for distortion)
                this.setGain(2, 1);  // 310Hz: +1dB
                this.setGain(3, 2);  // 600Hz: +2dB
                this.setGain(4, -2); // 1kHz: -2dB
                this.setGain(5, -2); // 3kHz: -2dB
                this.setGain(6, 0);  // 6kHz: 0dB
                this.setGain(7, 2);  // 12kHz: +2dB
                this.setGain(8, 4);  // 14kHz: +4dB
                this.setGain(9, 5);  // 16kHz: +5dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'pop':
                // POP preset: based on user's new specifications
                this.setGain(0, 2);  // 60Hz: +2dB
                this.setGain(1, 2);  // 170Hz: +2dB (Adjusted for distortion)
                this.setGain(2, 3);  // 310Hz: +3dB (Adjusted for distortion)
                this.setGain(3, 4);  // 600Hz: +4dB
                this.setGain(4, 0);  // 1kHz: 0dB
                this.setGain(5, -2); // 3kHz: -2dB
                this.setGain(6, -1); // 6kHz: -1dB
                this.setGain(7, 2);  // 12kHz: +2dB
                this.setGain(8, 4);  // 14kHz: +4dB
                this.setGain(9, 6);  // 16kHz: +6dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'classical':
                // CLASSICAL preset: based on user's new specifications
                this.setGain(0, 3);  // 60Hz: +3dB (Adjusted for distortion)
                this.setGain(1, 2);  // 170Hz: +2dB (Adjusted for distortion)
                this.setGain(2, 1);  // 310Hz: +1dB (Adjusted for distortion)
                this.setGain(3, 2);  // 600Hz: +2dB
                this.setGain(4, -2); // 1kHz: -2dB
                this.setGain(5, -2); // 3kHz: -2dB
                this.setGain(6, 0);  // 6kHz: 0dB
                this.setGain(7, 3);  // 12kHz: +3dB
                this.setGain(8, 4);  // 14kHz: +4dB
                this.setGain(9, 5);  // 16kHz: +5dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'electronic':
                // ELECTRONIC preset: based on user's new specifications
                this.setGain(0, 4);  // 60Hz: +4dB (Adjusted for distortion)
                this.setGain(1, 3);  // 170Hz: +3dB (Adjusted for distortion)
                this.setGain(2, 1);  // 310Hz: +1dB
                this.setGain(3, 0);  // 600Hz: 0dB
                this.setGain(4, -2); // 1kHz: -2dB
                this.setGain(5, 2);  // 3kHz: +2dB
                this.setGain(6, 1);  // 6kHz: +1dB
                this.setGain(7, 2);  // 12kHz: +2dB
                this.setGain(8, 6);  // 14kHz: +6dB
                this.setGain(9, 8);  // 16kHz: +8dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'hip-hop':
                // HIP-HOP preset: based on user's new specifications
                this.setGain(0, 5);  // 60Hz: +5dB (Adjusted for distortion)
                this.setGain(1, 4);  // 170Hz: +4dB (Adjusted for distortion)
                this.setGain(2, 2);  // 310Hz: +2dB
                this.setGain(3, 3);  // 600Hz: +3dB
                this.setGain(4, -2); // 1kHz: -2dB
                this.setGain(5, -1); // 3kHz: -1dB
                this.setGain(6, 2);  // 6kHz: +2dB
                this.setGain(7, 3);  // 12kHz: +3dB
                this.setGain(8, 6);  // 14kHz: +6dB
                this.setGain(9, 8);  // 16kHz: +8dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'vocal-boost':
                // VOCAL preset: based on user's new specifications
                this.setGain(0, 2);  // 60Hz: +2dB
                this.setGain(1, 1);  // 170Hz: +1dB
                this.setGain(2, -2); // 310Hz: -2dB
                this.setGain(3, -1); // 600Hz: -1dB
                this.setGain(4, 2);  // 1kHz: +2dB
                this.setGain(5, 4);  // 3kHz: +4dB
                this.setGain(6, 6);  // 6kHz: +6dB
                this.setGain(7, 5);  // 12kHz: +5dB
                this.setGain(8, 3);  // 14kHz: +3dB
                this.setGain(9, 1);  // 16kHz: +1dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'bass-boost':
                // BASS BOOST preset: based on user's new specifications
                this.setGain(0, 5);  // 60Hz: +5dB (Adjusted for distortion)
                this.setGain(1, 4);  // 170Hz: +4dB (Adjusted for distortion)
                this.setGain(2, 2);  // 310Hz: +2dB (Adjusted for distortion)
                this.setGain(3, 2);  // 600Hz: +2dB
                this.setGain(4, 0);  // 1kHz: 0dB
                this.setGain(5, 0);  // 3kHz: 0dB
                this.setGain(6, 0);  // 6kHz: 0dB
                this.setGain(7, 0);  // 12kHz: 0dB
                this.setGain(8, 0);  // 14kHz: 0dB
                this.setGain(9, 0);  // 16kHz: 0dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'treble-boost':
                // TREBLE BOOST preset: based on user's new specifications
                this.setGain(0, 0);  // 60Hz: 0dB
                this.setGain(1, 0);  // 170Hz: 0dB
                this.setGain(2, 0);  // 310Hz: 0dB
                this.setGain(3, 0);  // 600Hz: 0dB
                this.setGain(4, 0);  // 1kHz: 0dB
                this.setGain(5, 2);  // 3kHz: +2dB
                this.setGain(6, 4);  // 6kHz: +4dB
                this.setGain(7, 6);  // 12kHz: +6dB
                this.setGain(8, 8);  // 14kHz: +8dB
                this.setGain(9, 10); // 16kHz: +10dB
                this.bands.forEach((band, index) => {
                    if (band.type === 'peaking' || band.type === 'bandpass' || band.type === 'notch') {
                        this.setQ(index, 1);
                    }
                });
                break;
            case 'loudness':
                // Existing Loudness preset (no changes requested)
                this.setGain(0, 4);   // 60Hz (Adjusted for distortion)
                this.setGain(1, 2);   // 170Hz (Adjusted for distortion)
                this.setGain(2, 1);   // 310Hz (Adjusted for distortion)
                this.setGain(3, 0);   // 600Hz
                this.setGain(4, 0);   // 1kHz
                this.setGain(5, 0);   // 3kHz
                this.setGain(6, 2);   // 6kHz
                this.setGain(7, 4);   // 12kHz
                this.setGain(8, 6);   // 14kHz
                this.setGain(9, 8);   // 16kHz
                this.setQ(0, 0.8); // Broader bass boost
                this.setQ(9, 0.8); // Broader treble boost
                break;
            default:
                console.warn('Unknown equalizer preset:', presetName);
                break;
        }
    }
} 