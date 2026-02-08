import { Globals } from './Globals.js';
import { log } from './Utils.js';

// Global audio variable (exported for direct access if needed, but managing via helper is better)
export let introMusic = new Audio('assets/music/tron.mp3');
introMusic.loop = true;
introMusic.volume = 0; // Start silent for fade-in

// FADE HELPERS
export function fadeIn(audio, duration = 2000, targetVol = 0.4) {
    if (!audio) return;
    audio.volume = 0;
    audio.play().catch(e => console.warn("Audio auto-play blocked", e));

    const step = 50; // ms
    const increment = targetVol / (duration / step);

    // Clear any existing fade interval
    if (audio.fadeInterval) clearInterval(audio.fadeInterval);

    audio.fadeInterval = setInterval(() => {
        if (audio.volume < targetVol) {
            audio.volume = Math.min(targetVol, audio.volume + increment);
        } else {
            audio.volume = targetVol;
            clearInterval(audio.fadeInterval);
            audio.fadeInterval = null;
        }
    }, step);
}

export function fadeOut(audio, duration = 1000) {
    if (!audio) return;

    const step = 50; // ms
    const decrement = audio.volume / (duration / step);

    if (audio.fadeInterval) clearInterval(audio.fadeInterval);

    audio.fadeInterval = setInterval(() => {
        if (audio.volume > 0) {
            audio.volume = Math.max(0, audio.volume - decrement);
        } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(audio.fadeInterval);
            audio.fadeInterval = null;
        }
    }, step);
}

export function unlockAudio() {
    const audioCtx = Globals.audioCtx;
    if (audioCtx && audioCtx.state === 'suspended') {
        const resume = () => {
            audioCtx.resume().then(() => {
                document.removeEventListener('click', resume);
                document.removeEventListener('keydown', resume);
                document.removeEventListener('touchstart', resume);
                log("Audio Context Resumed");
            }).catch(e => console.error(e));
        };
        document.addEventListener('click', resume);
        document.addEventListener('keydown', resume);
        document.addEventListener('touchstart', resume);
    }
}

// SFX Helpers
function playTone(freq, type, duration, vol = 0.1) {
    if (!Globals.audioCtx || Globals.sfxMuted) return;
    const osc = Globals.audioCtx.createOscillator();
    const gain = Globals.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, Globals.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, Globals.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(Globals.audioCtx.destination);
    osc.start();
    osc.stop(Globals.audioCtx.currentTime + duration);
}

export const SFX = {
    shoot: (vol = 0.2) => playTone(400, 'square', 0.1, vol),
    explode: (vol = 0.1) => playTone(100, 'sawtooth', 0.3, vol),
    playerHit: (vol = 0.2) => playTone(150, 'sawtooth', 0.2, vol),
    click: (vol = 0.1) => playTone(800, 'sine', 0.05, vol),
    doorLocked: (vol = 0.1) => playTone(150, 'sawtooth', 0.2, vol),
    doorUnlocked: (vol = 0.1) => playTone(800, 'triangle', 0.1, vol),
    ghost: (vol = 0.3) => {
        if (!Globals.audioCtx || Globals.sfxMuted) return;
        const osc = Globals.audioCtx.createOscillator();
        const gain = Globals.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, Globals.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, Globals.audioCtx.currentTime + 1.0);
        gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, Globals.audioCtx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(Globals.audioCtx.destination);
        osc.start();
        osc.stop(Globals.audioCtx.currentTime + 1.0);
    },
    ghostSpeak: (vol = 0.3) => {
        if (!Globals.audioCtx || Globals.sfxMuted) return;
        const osc = Globals.audioCtx.createOscillator();
        const gain = Globals.audioCtx.createGain();
        osc.type = 'triangle'; // Clearer "voice"

        // Randomized pitch for "talking" variation
        const baseFreq = 300 + Math.random() * 200;

        osc.frequency.setValueAtTime(baseFreq, Globals.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, Globals.audioCtx.currentTime + 0.4); // Drop pitch

        gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, Globals.audioCtx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(Globals.audioCtx.destination);
        osc.start();
        osc.stop(Globals.audioCtx.currentTime + 0.4);
    },
    scream: (vol = 0.2) => {
        if (!Globals.audioCtx || Globals.sfxMuted) return;
        const osc = Globals.audioCtx.createOscillator();
        const gain = Globals.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, Globals.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, Globals.audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, Globals.audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(Globals.audioCtx.destination);
        osc.start();
        osc.stop(Globals.audioCtx.currentTime + 0.5);
    },
    yelp: (vol = 0.2) => playTone(600, 'triangle', 0.1, vol),
    pickup: (vol = 0.2) => playTone(1200, 'sine', 0.1, vol),
    coin: (vol = 0.2) => playTone(1500, 'square', 0.1, vol),
    //make this a cannot so / fail sound
    cantPickup: (vol = 0.2) => {
        if (!Globals.audioCtx || Globals.sfxMuted) return;
        const osc = Globals.audioCtx.createOscillator();
        const gain = Globals.audioCtx.createGain();
        osc.type = 'sawtooth'; // Buzzer-like
        osc.frequency.setValueAtTime(150, Globals.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, Globals.audioCtx.currentTime + 0.2); // Pitch Drop
        gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, Globals.audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(Globals.audioCtx.destination);
        osc.start();
        osc.stop(Globals.audioCtx.currentTime + 0.3);
    },
    restart: (vol = 0.2) => {
        // Sci-Fi "Teleport" Sound (Warp Up)
        if (!Globals.audioCtx || Globals.sfxMuted) return;
        const osc = Globals.audioCtx.createOscillator();
        const gain = Globals.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, Globals.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, Globals.audioCtx.currentTime + 0.5); // Warp!
        gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, Globals.audioCtx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(Globals.audioCtx.destination);
        osc.start();
        osc.stop(Globals.audioCtx.currentTime + 0.5);
    },
    cantDoIt: (vol = 0.2) => {
        if (!Globals.audioCtx || Globals.sfxMuted) return;
        const osc = Globals.audioCtx.createOscillator();
        const gain = Globals.audioCtx.createGain();
        osc.type = 'square'; // Harsh "computer" error
        osc.frequency.setValueAtTime(150, Globals.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, Globals.audioCtx.currentTime + 0.3); // Pitch Drop failure
        gain.gain.setValueAtTime(vol, Globals.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, Globals.audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(Globals.audioCtx.destination);
        osc.start();
        osc.stop(Globals.audioCtx.currentTime + 0.3);
    }
};
