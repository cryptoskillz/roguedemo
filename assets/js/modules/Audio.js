import { Globals } from './Globals.js';
import { log } from './Utils.js';

// Global audio variable (exported for direct access if needed, but managing via helper is better)
export let introMusic = new Audio('assets/music/tron.mp3');
introMusic.loop = true;
introMusic.volume = 0.4;

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
    yelp: (vol = 0.2) => playTone(600, 'triangle', 0.1, vol)
};
