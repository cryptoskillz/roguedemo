// window.onload = function () {
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hpEl = document.getElementById('hp');
const keysEl = document.getElementById('keys');
const roomEl = document.getElementById('room');
const overlayEl = document.getElementById('overlay');
const welcomeEl = document.getElementById('welcome');
const uiEl = document.getElementById('ui');
const statsEl = document.getElementById('stats');
const perfectEl = document.getElementById('perfect');
const roomNameEl = document.getElementById('roomName');
const bombsEl = document.getElementById('bombs');
const ammoEl = document.getElementById('ammo');
const mapCanvas = document.getElementById('minimapCanvas');
const mctx = mapCanvas ? mapCanvas.getContext('2d') : null;
const debugSelect = document.getElementById('debug-select');
const debugForm = document.getElementById('debug-form');
const debugPanel = document.getElementById('debug-panel');
const debugLogEl = document.getElementById('debug-log');

// Global audio variable
const introMusic = new Audio('assets/music/tron.mp3');
introMusic.loop = true;
introMusic.volume = 0.4;
// --- MUSIC TOGGLE LOGIC ---
// --- MUSIC TOGGLE LOGIC ---
let lastMusicToggle = 0;

// --- DEBUG LOGGING ---
let debugLogs = [];
const MAX_DEBUG_LOGS = 1000;

// --- FLOATING TEXT SYSTEM ---
let floatingTexts = [];

function spawnFloatingText(x, y, text, color = "white") {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 1.0, // 100% opacity start
        vy: -1.0 // Float up speed
    });
}


let pauseStartTime = 0;

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.life -= 0.015; // Slow fade
        if (ft.life <= 0) {
            floatingTexts.splice(i, 1);
        }
    }
}

function drawFloatingTexts() {
    floatingTexts.forEach(ft => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";

        // Shadow for readability
        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);

        ctx.restore();
    });
}

function log(...args) {
    // Console log always (or maybe conditional too?)
    // console.log(...args); // Optional: keep console clean if preferred, but usually good to keep.

    if (typeof DEBUG_LOG_ENABLED !== 'undefined' && DEBUG_LOG_ENABLED) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');

        // Push to internal array for history/other uses
        debugLogs.push(msg);
        if (debugLogs.length > MAX_DEBUG_LOGS) {
            debugLogs.shift();
        }

        // Update DOM
        if (typeof debugLogEl !== 'undefined' && debugLogEl) {
            const line = document.createElement('div');
            line.innerText = msg;
            debugLogEl.appendChild(line);
            // Auto scroll to bottom
            debugLogEl.scrollTop = debugLogEl.scrollHeight;

            // Maintain max lines in DOM too
            while (debugLogEl.childElementCount > MAX_DEBUG_LOGS) {
                debugLogEl.removeChild(debugLogEl.firstChild);
            }
        }
    }
}

// --- Game State ---
let player = {
    x: 300, y: 200, speed: 4, hp: 3, roomX: 0, roomY: 0,
    inventory: { keys: 0 },
    size: 20
};
let availablePlayers = [];
let selectedPlayerIndex = 0;
let bullets = [];
let particles = [];
let enemies = [];
let bombs = [];
let keys = {};
let groundItems = []; // Items sitting on the floor
let loreData = null;
let speechData = null;

// --- HELPER: SPEECH TRIGGER ---
function triggerSpeech(enemy, type, forceText = null, bypassCooldown = false) {
    if ((!speechData && !forceText) || enemy.isDead) return;

    const now = Date.now();
    // Cooldown Check (5 seconds), ignored if forced text or bypass flag is set
    if (!forceText && !bypassCooldown && enemy.lastSpeechTime && now - enemy.lastSpeechTime < 5000) {
        return;
    }

    // Probability Checks (unless forced)
    if (!forceText && !bypassCooldown) {
        if (type === 'idle' && Math.random() > 0.001) return; // Low chance for idle
        if (type === 'hit' && Math.random() > 0.3) return; // 30% chance on hit
    }

    let text = forceText;

    if (!text && speechData) {
        let pool = [];

        // SPECIAL ENEMY OVERRIDE (Ghost, etc.)
        // If special, ONLY use type-specific lines. Ignore general/events like "Ouch"
        if (enemy.special) {
            // 1. Check for Specific Event Type for this Special Enemy (e.g. 'ghost_doors_close')
            // This fixes the issue where they just say generic ghost lines for specific events
            // We construct a key like type + "_" + eventType? Or just look for the raw type passed?
            // The caller passed 'ghost_doors_close' as the type?
            // Wait, previous call was triggerSpeech(ghost, 'ghost_doors_close'). 
            // So 'type' IS 'ghost_doors_close'.

            if (speechData.types && speechData.types[type]) {
                pool = speechData.types[type];
            }
            // 2. Fallback to General Special Logic (e.g. idle ghost noises)
            else if (speechData.types && speechData.types[enemy.type]) {
                pool = speechData.types[enemy.type];
            }
            // If no specific lines, they stay silent.
        }
        // STANDARD LOGIC
        else {
            // Select Pool based on Priority
            // 1. Scripted/Events (handled by caller passing type='event'?)

            // 2. Mood
            if (type === 'angry' && speechData.moods && speechData.moods.angry) {
                pool = speechData.moods.angry;
            }
            // 3. Event Type
            else if (speechData.events && speechData.events[type]) {
                pool = speechData.events[type];
            }
            // 4. Enemy Type Specific
            else if (enemy.type && speechData.types && speechData.types[enemy.type]) {
                // Mix type specific with general? Or override?
                // Let's use type specific if available, otherwise general
                // Actually, maybe 50/50?
                if (Math.random() < 0.5) pool = speechData.types[enemy.type];
            }

            // 5. General Fallback
            if (!pool || pool.length === 0) {
                pool = speechData.general || ["..."];
            }
        }

        // Pick Random
        if (pool && pool.length > 0) {
            text = pool[Math.floor(Math.random() * pool.length)];
        }
    }

    if (text) {
        enemy.speech = {
            text: text,
            timer: 120, // 2 Seconds (Assuming 60fps)
            maxTimer: 120,
            color: type === 'angry' ? '#e74c3c' : 'white'
        };
        enemy.lastSpeechTime = now;
    }
}

// --- SHARD CURRENCY HELPERS ---
function addRedShards(amount) {
    if (!player) return;
    if (!gameData.redShards) return;

    player.redShards = (player.redShards || 0) + amount;
    localStorage.setItem('currency_red', player.redShards);
    spawnFloatingText(player.x, player.y - 40, `+${amount} RED SHARDS`, "#e74c3c");
    log(`Red Shards Added: ${amount}. Total: ${player.redShards}`);
}

function addGreenShards(amount) {
    if (!player) return;
    if (!gameData.greenShards) return;

    player.inventory.greenShards = (player.inventory.greenShards || 0) + amount;
    spawnFloatingText(player.x, player.y - 40, `+${amount} GREEN SHARDS`, "#2ecc71");
    log(`Green Shards Added: ${amount}. Total: ${player.inventory.greenShards}`);
}

function spawnShard(x, y, type, amount) {
    if (!gameData.redShards && type === 'red') return;
    if (!gameData.greenShards && type === 'green') return;

    // Push towards center slightly if near edges? 
    // Nah, just simple physics.

    // SPAWN OFFSET: Don't spawn exactly on top of player/source
    const angle = Math.random() * Math.PI * 2;
    const offset = 30 + Math.random() * 20; // 30-50px away
    const spawnX = x + Math.cos(angle) * offset;
    const spawnY = y + Math.sin(angle) * offset;

    groundItems.push({
        x: spawnX, y: spawnY,
        roomX: player.roomX, roomY: player.roomY,
        vx: (Math.random() - 0.5) * 10, // Stronger Pop
        vy: (Math.random() - 0.5) * 10,
        friction: 0.92, // Slide a bit more
        solid: true,
        moveable: true,
        size: 10,
        floatOffset: Math.random() * 100,
        pickupCooldown: 60, // 1 Second Cooldown
        data: {
            type: 'shard',
            shardType: type, // 'red' or 'green'
            amount: amount,
            name: type === 'red' ? "Red Shard" : "Green Shard",
            rarity: 'common' // for glow color fallback
        }
    });
}

// --- HELPER: LORE GENERATION ---
function generateLore(enemy) {
    if (!loreData) return null;

    // Skip Bosses - they have their own names defined in JSON
    if (enemy.type === 'boss' || enemy.isBoss) return null;

    // 1. Name Parts
    const prefix = loreData.prefixes[Math.floor(Math.random() * loreData.prefixes.length)];
    const firstName = loreData.firstNames[Math.floor(Math.random() * loreData.firstNames.length)];

    // 2. Surname by Shape
    const shape = enemy.shape ? enemy.shape.toLowerCase() : 'default';
    const surnames = loreData.surnames[shape] || loreData.surnames['default'];
    // Fallback if shape key exists but list empty
    const surnameList = (surnames && surnames.length > 0) ? surnames : loreData.surnames['default'];
    const surname = surnameList[Math.floor(Math.random() * surnameList.length)];

    // 3. Nickname by Stats
    let nickname = "";
    // Build pool based on stats
    let pool = [];
    if (enemy.speed > 3) pool.push('speed');
    if (enemy.hp > 5) pool.push('hp');
    if (enemy.damage > 2) pool.push('damage');
    if (enemy.size > 30) pool.push('size');
    if (enemy.size < 20) pool.push('tiny');
    if (enemy.alwaysAngry) pool.push('angry');

    // Fallback pool
    if (pool.length === 0) pool = ['speed', 'hp'];

    const cat = pool[Math.floor(Math.random() * pool.length)];
    const nicks = loreData.nicknames[cat] || [];
    if (nicks.length > 0) {
        nickname = nicks[Math.floor(Math.random() * nicks.length)];
    }

    // 4. Randomize Display Format
    // Options: 
    // - Nickname (if exists)
    // - First Name
    // - Full Name (First Surname)
    // - Formal (Prefix Surname)
    // - Formal Full (Prefix First Surname)
    // - Nick Mid (First "Nick" Surname) - if exists

    let options = [
        { type: 'first', val: firstName },
        { type: 'full', val: `${firstName} ${surname}` },
        { type: 'formal_sur', val: `${prefix} ${surname}` },
        { type: 'formal_full', val: `${prefix} ${firstName} ${surname}` }
    ];

    if (nickname) {
        options.push({ type: 'nick', val: nickname }); // Just "The Tank"
        options.push({ type: 'nick_mid', val: `${firstName} "${nickname}" ${surname}` });
    }

    // Select Random
    const selected = options[Math.floor(Math.random() * options.length)];
    const displayName = selected.val;

    return {
        fullName: `${prefix} ${firstName} ${surname}`,
        nickname: nickname,
        displayName: displayName, // Use this for rendering
        title: `${nickname} ${firstName}`
    };
}


let bomb = {}
let gun = {}
let activeModifiers = []; // Store active modifier configs
let bombsInRoom = 0;
let screenShake = { power: 0, endAt: 0 };


let bulletsInRoom = 0;
let hitsInRoom = 0;
let perfectStreak = 0;
let gameData = { perfectGoal: 3 };

const STATES = { START: 0, PLAY: 1, GAMEOVER: 2, GAMEMENU: 3, WIN: 4 };
let gameState = STATES.START;

let visitedRooms = {}; // Track state of each coordinate

let roomData = {
    name: "Loading...",
    width: 800,
    height: 600,
    doors: {
        top: { locked: 0, active: 0 },
        bottom: { locked: 0, active: 0 },
        left: { locked: 0, active: 0 },
        right: { locked: 0, active: 0 }
    }
};
let roomManifest = { rooms: [] };
let roomStartTime = Date.now();
let goldenPath = [];
let goldenPathIndex = 0; // Tracks progress along the path
let goldenPathFailed = false; // Tracks if player deviated
let roomTemplates = {};
let levelMap = {}; // Pre-generated level structure
let bossCoord = "";
let enemyTemplates = {};
let bossIntroEndTime = 0;
let bossKilled = false; // Track if boss is dead for difficulty spike
let gameLoopStarted = false;
let keyUsedForRoom = false;

let portal = { active: false, x: 0, y: 0 };
let isInitializing = false;
let ghostSpawned = false;
let roomFreezeUntil = 0; // Timestamp for room freeze expiration
let ghostEntry = null;
let wasRoomLocked = false; // Track previous lock state for events

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- ROBUST AUDIO UNLOCKER ---
const unlockAudio = () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("AudioContext Resumed Successfully!");
            // Optional: Remove listeners if we only needed one interaction
            // window.removeEventListener('click', unlockAudio);
            // window.removeEventListener('keydown', unlockAudio);
        }).catch(e => console.error("Audio Resume Failed:", e));
    }
};
// Attach to all major interactions to ensure we catch one
window.addEventListener('click', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);

// Force unlock on init too
unlockAudio();

const SFX = {
    // A quick high-to-low "pew"
    shoot: (vol = 0.2) => {
        // Debug Audio State
        if (audioCtx.state === 'suspended') {
            console.warn("SFX Attempted but AudioContext is SUSPENDED. Click to unlock.");
        }
        if (gameData.soundEffects === false) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square'; // Classic NES sound
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    },

    // A low-frequency crunch for hits/explosions
    explode: (vol = 0.1) => {
        if (gameData.soundEffects === false) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    },

    playerHit: (vol = 0.2) => {
        if (gameData.soundEffects === false) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        // Starts at 200Hz and drops to 50Hz for a "oof" feeling
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);

        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);

        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    },

    // Dry fire click
    click: (vol = 0.1) => {
        if (gameData.soundEffects === false) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);

        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    },

    // Spooky wail for Ghost
    ghost: (vol = 0.3) => {
        if (gameData.soundEffects === false) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        // Eerie wail: 150Hz sliding up to 400Hz
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 1.5);

        // Fade in/out
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.2);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);

        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 1.5);
    },

    // Angry Scream
    scream: (vol = 0.2) => {
        if (gameData.soundEffects === false) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        // Screech: 800Hz to 200Hz rapid drop
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.3);

        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    },

    // Citical Hit Yelp
    yelp: (vol = 0.2) => {
        if (gameData.soundEffects === false) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        // Short, sharp yelp: 600Hz to 400Hz quickly
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.4);

        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
};


// 2. Global Input Handler
function handleGlobalInputs() {
    // Restart
    if (keys['KeyR']) {
        if (gameState === STATES.GAMEOVER || gameState === STATES.WIN || gameState === STATES.GAMEMENU) {
            restartGame();
            return true;
        }
    }
    // Main Menu
    if (keys['KeyM']) {
        if (gameState === STATES.GAMEOVER || gameState === STATES.WIN || gameState === STATES.GAMEMENU) {
            goToWelcome();
            return true;
        }
    }

    // Player Selection (Only in Menu)
    const now = Date.now();
    if (gameState === STATES.START || gameState === STATES.GAMEMENU) {
        if (keys['ArrowRight']) {
            if (now - lastInputTime > 200) {
                selectedPlayerIndex = (selectedPlayerIndex + 1) % availablePlayers.length;
                updateWelcomeScreen();
                lastInputTime = now;
            }
        }
        if (keys['ArrowLeft']) {
            if (now - lastInputTime > 200) {
                selectedPlayerIndex = (selectedPlayerIndex - 1 + availablePlayers.length) % availablePlayers.length;
                updateWelcomeScreen();
                lastInputTime = now;
            }
        }
    }

    return false;
}

let lastInputTime = 0;

function updateWelcomeScreen() {
    const p = availablePlayers[selectedPlayerIndex];
    if (!p) return;

    // Update Welcome UI dynamically
    // Conditional Character Select
    let charSelectHtml = '';
    if (gameData.showCharacterSelect !== false) {
        charSelectHtml = `<div id="player-select-ui" style="margin: 20px; padding: 10px; border: 2px solid #555;">
            <h2 style="color: ${p.locked ? 'gray' : '#0ff'}">${p.name} ${p.locked ? '(LOCKED)' : ''}</h2>
            <p>${p.Description || "No description"}</p>
            <p style="font-size: 0.8em; color: #aaa;">Speed: ${p.speed} | HP: ${p.hp}</p>
            <div style="margin-top: 10px; font-size: 1.2em;">
                <span>&lt;</span> 
                <span style="margin: 0 20px;">${selectedPlayerIndex + 1} / ${availablePlayers.length}</span> 
                <span>&gt;</span>
            </div>
        </div>`;
    }

    // Check for Saved Data (Unlocks or Progress)
    const hasSave = localStorage.getItem('game_unlocks') || localStorage.getItem('game_unlocked_ids');
    const startText = hasSave
        ? 'press any key to continue<br><span style="font-size:0.6em; color:#ff6b6b;">press N for new game (clears data)</span>'
        : 'press any key to start';

    let html = `<h1>Geometry Dash</h1>
        ${charSelectHtml}
        <p>${gameData.music ? 'press 0 to toggle music<br>' : ''}${p.locked ? '<span style="color:red; font-size:1.5em; font-weight:bold;">LOCKED</span>' : startText}</p>`;

    welcomeEl.innerHTML = html;

    // Only show if enabled
    if (gameData.showWelcome !== false) {
        welcomeEl.style.display = 'flex';
    }
}

async function updateUI() {
    if (player.hp < 1) {
        hpEl.innerText = 0;
    }
    else {
        hpEl.innerText = Math.floor(player.hp);
    }
    hpEl.innerText += ` / ${player.maxHp}`;
    hpEl.innerText += ` / ${player.maxHp}`;

    // SHARD UI
    if (gameData.redShards) {
        // Create element if missing or assume existing structure? 
        // User didn't ask for new DOM elements, but "inventory should update".
        // I will assume I need to hijack an existing element or just append? 
        // Actually, existing UI has keysEl, bombsEl, ammoEl.
        // I should probably add them to the stats panel or create new elements if I could.
        // For now, let's append to keysEl or just assume there are elements?
        // Wait, I can't assume elements exist. I should probably inject them into the stats panel if they don't exist.
        // But `updateUI` runs every frame. Creating elements here is bad.
        // I'll check if elements exist, if not, I might need to create them in init or just append text to an existing container.
        // Let's look at `index.html`? No, I am restricted to logic.js/inventory.
        // I will append to the top stats panel text or similar.
        // Keys element is id='keys'.
        // Let's try to find if there are other slots.
        // I will just add text to the existing keys element for now as a quick hack? No, that's ugly.
        // I'll assume I can render them. 
        // Actually, looking at the code, keysEl is simple. 
        // Let's stick to adding them to the keys display for now: "Keys: 0 | R: 10 | G: 5"
        let shardText = "";
        if (gameData.redShards) shardText += ` R:${player.redShards}`;
        if (gameData.greenShards) shardText += ` G:${player.inventory.greenShards}`;

        // Find or create shard container? 
        // Let's just append to keys for visibility as requested "inventory should update".
        // keysEl.innerText = `${player.inventory.keys} ${shardText}`;
    }

    // BETTER APPROACH: Check for `shards-display` element. If not, create it once? 
    // But I can't easily modify HTML. 
    // I can modify innerText of keysEl to include shards.
    let keysText = `${player.inventory.keys}`;
    if (gameData.redShards) keysText += ` | ♦${player.redShards}`;
    if (gameData.greenShards) keysText += ` | ◊${player.inventory.greenShards}`;
    keysEl.innerText = keysText;

    // check if bomb type is golden and if so set the count colour to gold 
    if (player.bombType === "golden") {
        bombsEl.style.color = "gold";
    } else {
        bombsEl.style.color = "white";
    }
    bombsEl.innerText = player.inventory.bombs;

    // Ammo Display
    //console.log(gun);
    if (gun.Bullet?.ammo?.active) {
        if (player.reloading) {
            ammoEl.innerText = player.ammoMode === 'recharge' ? player.ammo : "RELOADING...";
            ammoEl.style.color = "red";
        } else {
            if ((player.ammo <= 0 && player.ammoMode === 'finite') ||
                (player.ammo <= 0 && player.ammoMode === 'reload' && player.reserveAmmo <= 0)) {
                ammoEl.innerText = "OUT OF AMMO";
                ammoEl.style.color = "red";
            } else {
                ammoEl.innerText = player.ammo;
                if (player.ammoMode === 'reload') {
                    ammoEl.innerText += ` / ${player.reserveAmmo}`;
                }
                ammoEl.style.color = player.ammo <= player.maxMag * 0.2 ? "red" : "white";
            }
        }
    } else {
        ammoEl.innerText = "--";
        ammoEl.style.color = "gray";
    }



    //update cords only if debug mode is enabled otherwise hide this
    if (DEBUG_WINDOW_ENABLED) {
        roomEl.innerText = `Coords: ${player.roomX},${player.roomY}`;
    }
    roomNameEl.innerText = roomData.name || "Unknown Room";
    updateDebugEditor();
}

function updateDebugEditor() {
    if (!debugForm || !debugSelect) return;

    // Only rebuild if it's the first time or we changed source/room
    // For now, let's keep it simple and rebuild only when source changes or on manual calls
    // To prevent rebuilding every frame, we check if we actually need a full refresh.
    // However, for this demo, let's just make a dedicated "refresh" trigger.
}

function renderDebugForm() {
    if (!debugForm || !debugSelect) return;
    debugForm.innerHTML = '';

    // Add Audio Test Button
    const btn = document.createElement('button');
    btn.innerText = "TEST AUDIO";
    btn.onclick = () => {
        console.log("TEST AUDIO CLICKED");
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
            console.log("Audio Resumed via Test Button");
        }
        // Force a raw sound test bypassing all game logic
        const o = audioCtx.createOscillator();
        o.frequency.value = 440;
        o.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 0.5);

        // Also try game SFX
        SFX.shoot();
        SFX.yelp();
    };
    btn.style.marginBottom = "10px";
    btn.style.width = "100%";
    debugForm.appendChild(btn);

    const type = debugSelect.value;

    // SPAWN LOGIC REFACTOR
    if (type === 'spawn') {
        if (!window.allItemTemplates) {
            debugForm.innerText = "No items loaded.";
            return;
        }

        const container = document.createElement('div');
        container.style.padding = "10px";

        // Filter / Search
        const searchInput = document.createElement('input');
        searchInput.placeholder = "Search items...";
        searchInput.style.width = "100%";
        searchInput.style.marginBottom = "10px";
        searchInput.style.background = "#333";
        searchInput.style.color = "#fff";
        searchInput.style.border = "1px solid #555";

        const select = document.createElement('select');
        select.style.width = "100%";
        select.style.marginBottom = "10px";
        select.style.background = "#333";
        select.style.color = "#fff";
        select.style.border = "1px solid #555";
        select.size = 10; // Show multiple lines

        function populate(filter = "") {
            select.innerHTML = "";
            window.allItemTemplates.forEach((item, idx) => {
                if (!item) return;
                const name = item.name || item.id || "Unknown";
                if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;

                const opt = document.createElement('option');
                opt.value = idx;
                const rarity = item.rarity ? `[${item.rarity.toUpperCase()}] ` : "";
                opt.innerText = `${rarity}${name} (${item.type})`;
                select.appendChild(opt);
            });
        }
        populate();

        searchInput.addEventListener('input', (e) => populate(e.target.value));

        const spawnBtn = document.createElement('button');
        spawnBtn.innerText = "SPAWN";
        spawnBtn.style.width = "100%";
        spawnBtn.style.padding = "10px";
        spawnBtn.style.background = "#27ae60";
        spawnBtn.style.color = "white";
        spawnBtn.style.border = "none";
        spawnBtn.style.cursor = "pointer";
        spawnBtn.style.fontWeight = "bold";

        spawnBtn.onclick = () => {
            spawnBtn.blur(); // Remove focus so Space doesn't trigger again
            const idx = select.value;
            if (idx === "") return;
            const itemTemplate = window.allItemTemplates[idx];

            // Spawn logic
            groundItems.push({
                x: player.x + (Math.random() * 60 - 30),
                y: player.y + (Math.random() * 60 - 30),
                data: JSON.parse(JSON.stringify(itemTemplate)), // Deep copy
                roomX: player.roomX,
                roomY: player.roomY,
                vx: 0, vy: 0,
                solid: true, moveable: true, friction: 0.9, size: 15,
                floatOffset: Math.random() * 100
            });
            log("Spawned:", itemTemplate.name);
        };

        container.appendChild(searchInput);
        container.appendChild(select);
        container.appendChild(spawnBtn);
        debugForm.appendChild(container);
        return;
    } else if (type === 'spawnRoom') {
        if (!roomTemplates) {
            debugForm.innerText = "No room templates loaded.";
            return;
        }

        const container = document.createElement('div');
        container.style.padding = "10px";

        const select = document.createElement('select');
        select.style.width = "100%";
        select.style.marginBottom = "10px";
        select.style.background = "#333";
        select.style.color = "#fff";
        select.style.border = "1px solid #555";
        select.size = 10;

        // Populate room list
        Object.keys(roomTemplates).sort().forEach(key => {
            const tmpl = roomTemplates[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = `[${key}] ${tmpl.name || "Unnamed"}`;
            select.appendChild(opt);
        });

        const loadBtn = document.createElement('button');
        loadBtn.innerText = "LOAD ROOM";
        loadBtn.style.width = "100%";
        loadBtn.style.padding = "10px";
        loadBtn.style.background = "#e74c3c";
        loadBtn.style.color = "white";
        loadBtn.style.border = "none";
        loadBtn.style.cursor = "pointer";
        loadBtn.style.fontWeight = "bold";

        loadBtn.onclick = () => {
            loadBtn.blur(); // Remove focus
            const key = select.value;
            if (!key) return;
            const template = roomTemplates[key];

            // 1. Deep Copy
            const newRoomData = JSON.parse(JSON.stringify(template));

            // 2. Preserve Doors from current map state (so we don't get trapped)
            const currentEntry = levelMap[`${player.roomX},${player.roomY}`];
            if (currentEntry && currentEntry.roomData.doors) {
                newRoomData.doors = JSON.parse(JSON.stringify(currentEntry.roomData.doors));
                // Resnap doors to center of new room width/height
                ['top', 'bottom', 'left', 'right'].forEach(dir => {
                    if (newRoomData.doors[dir]) {
                        delete newRoomData.doors[dir].x;
                        delete newRoomData.doors[dir].y;
                    }
                });
            }

            // 3. Update Level Map & Active Data
            if (currentEntry) {
                currentEntry.roomData = newRoomData;
                currentEntry.cleared = false; // Reset cleared status
            }
            roomData = newRoomData;

            // 4. Reset State
            bullets = [];
            bombs = [];
            enemies = [];
            particles = [];
            groundItems = []; // Clear floor items? Yes, usually.

            // 5. Update Canvas & Time
            canvas.width = roomData.width || 800;
            canvas.height = roomData.height || 600;
            roomStartTime = Date.now();
            roomNameEl.innerText = roomData.name || "Unknown Room";

            // 6. Spawn Enemies
            spawnEnemies();

            log(`Loaded Room Template: ${key}`);
            updateUI();
        };

        container.appendChild(select);
        container.appendChild(loadBtn);
        debugForm.appendChild(container);
        return;
    } else if (type === 'spawnEnemy') {
        if (!enemyTemplates) {
            debugForm.innerText = "No enemy templates loaded.";
            return;
        }

        const container = document.createElement('div');
        container.style.padding = "10px";

        const searchInput = document.createElement('input');
        searchInput.placeholder = "Search enemies...";
        searchInput.style.width = "100%";
        searchInput.style.marginBottom = "10px";
        searchInput.style.background = "#333";
        searchInput.style.color = "#fff";
        searchInput.style.border = "1px solid #555";

        const select = document.createElement('select');
        select.style.width = "100%";
        select.style.marginBottom = "10px";
        select.style.background = "#333";
        select.style.color = "#fff";
        select.style.border = "1px solid #555";
        select.size = 10;

        function populate(filter = "") {
            select.innerHTML = "";
            Object.keys(enemyTemplates).sort().forEach(key => {
                const tmpl = enemyTemplates[key];
                const name = tmpl.name || key || "Unknown";
                if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;

                const opt = document.createElement('option');
                opt.value = key;
                opt.innerText = `[${key}] ${name} (HP: ${tmpl.hp})`;
                select.appendChild(opt);
            });
        }
        populate();

        searchInput.addEventListener('input', (e) => populate(e.target.value));

        const spawnBtn = document.createElement('button');
        spawnBtn.innerText = "SPAWN ENEMY";
        spawnBtn.style.width = "100%";
        spawnBtn.style.padding = "10px";
        spawnBtn.style.background = "#e74c3c"; // Red for danger
        spawnBtn.style.color = "white";
        spawnBtn.style.border = "none";
        spawnBtn.style.cursor = "pointer";
        spawnBtn.style.fontWeight = "bold";

        spawnBtn.onclick = () => {
            spawnBtn.blur(); // Remove focus
            const key = select.value;
            if (!key) return;
            const template = enemyTemplates[key];

            // 1. Logic similar to spawnEnemies loop
            const inst = JSON.parse(JSON.stringify(template));
            // Find safe spot away from player
            let safeX, safeY, dist;
            let attempts = 0;
            do {
                safeX = 50 + Math.random() * (canvas.width - 100);
                safeY = 50 + Math.random() * (canvas.height - 100);
                dist = Math.hypot(safeX - player.x, safeY - player.y);
                attempts++;
            } while (dist < 200 && attempts < 20);

            inst.x = safeX;
            inst.y = safeY;

            // Bounds check (redundant given above, but safe)
            inst.x = Math.max(50, Math.min(canvas.width - 50, inst.x));
            inst.y = Math.max(50, Math.min(canvas.height - 50, inst.y));

            inst.currentHp = inst.hp;
            inst.isDead = false;
            inst.roomX = player.roomX;
            inst.roomY = player.roomY;

            enemies.push(inst);
            log(`Spawned Enemy: ${inst.name || key}`);
        };

        container.appendChild(searchInput);
        container.appendChild(select);
        container.appendChild(spawnBtn);
        debugForm.appendChild(container);
        return;
    }

    const target = type === 'player' ? player : roomData;

    function createFields(parent, obj, path) {
        for (const key in obj) {
            // Ignore internal props or noisy ones
            if (key === 'lastShot' || key === 'invulnUntil') continue;

            const value = obj[key];
            const currentPath = path ? `${path}.${key}` : key;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const group = document.createElement('div');
                group.className = 'debug-nested';
                const header = document.createElement('div');
                header.style.color = '#5dade2';
                header.style.fontSize = '13px';
                header.style.fontWeight = 'bold';
                header.style.marginBottom = '8px';
                header.style.marginLeft = '-10px';
                header.style.paddingBottom = '4px';
                header.style.borderBottom = '1px solid rgba(93, 173, 226, 0.3)';
                header.innerText = key;
                group.appendChild(header);
                createFields(group, value, currentPath);
                parent.appendChild(group);
            } else {
                const field = document.createElement('div');
                field.className = 'debug-field';

                const label = document.createElement('label');
                label.innerText = key;
                field.appendChild(label);

                const input = document.createElement('input');
                if (typeof value === 'boolean') {
                    input.type = 'checkbox';
                    input.checked = value;
                } else if (typeof value === 'number') {
                    input.type = 'number';
                    input.value = value;
                    input.step = 'any';
                } else {
                    input.type = 'text';
                    input.value = value;
                }

                input.addEventListener('input', (e) => {
                    let newVal = input.type === 'checkbox' ? input.checked : input.value;
                    if (input.type === 'number') newVal = parseFloat(newVal);

                    // Update state
                    let o = type === 'player' ? player : roomData;
                    const parts = currentPath.split('.');
                    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
                    o[parts[parts.length - 1]] = newVal;

                    // Sync UI if needed
                    if (key === 'hp' || key === 'luck') updateUI();
                });

                field.appendChild(input);
                parent.appendChild(field);
            }
        }
    }

    createFields(debugForm, target, '');
}

// --- Level Generation Logic ---
// --- Level Generation Logic ---
function generateLevel(length) {
    let path = ["0,0"];
    let cx = 0, cy = 0;
    const dirs = [
        { dx: 0, dy: -1, name: "top", opposite: "bottom" },
        { dx: 0, dy: 1, name: "bottom", opposite: "top" },
        { dx: -1, dy: 0, name: "left", opposite: "right" },
        { dx: 1, dy: 0, name: "right", opposite: "left" }
    ];

    // 1. Generate Golden Path
    for (let i = 0; i < length; i++) {
        let possible = dirs.filter(d => !path.includes(`${cx + d.dx},${cy + d.dy}`));
        if (possible.length === 0) break;
        let move = possible[Math.floor(Math.random() * possible.length)];
        cx += move.dx;
        cy += move.dy;
        path.push(`${cx},${cy}`);
    }
    goldenPath = path;
    goldenPathIndex = 0;
    goldenPathFailed = false;
    bossCoord = path[path.length - 1];

    // 2. Add Branches (Dead Ends)
    let fullMapCoords = [...path];
    path.forEach(coord => {
        if (coord === bossCoord || coord === "0,0") return;

        // 50% chance to start a branch from this node
        if (Math.random() > 0.5) {
            const branchLength = Math.floor(Math.random() * 3) + 1; // 1 to 3 rooms deep
            let bx = parseInt(coord.split(',')[0]);
            let by = parseInt(coord.split(',')[1]);

            for (let b = 0; b < branchLength; b++) {
                // Find valid moves from current branch tip
                let possible = dirs.filter(d => !fullMapCoords.includes(`${bx + d.dx},${by + d.dy}`));
                if (possible.length === 0) break; // Stuck, stop branching

                let move = possible[Math.floor(Math.random() * possible.length)];
                bx += move.dx;
                by += move.dy;
                fullMapCoords.push(`${bx},${by}`);
            }
        }
    });

    // 3. Initialize levelMap with room data
    levelMap = {};

    // Helper to find specific types
    const findStartTemplate = () => {
        // 0. Explicit loaded start room (tagged with _type = 'start')
        const explicitStart = Object.keys(roomTemplates).find(k => roomTemplates[k]._type === 'start');
        if (explicitStart) return roomTemplates[explicitStart];

        // 1. Try explicit "start" (legacy or named)
        if (roomTemplates["start"]) return roomTemplates["start"];
        if (roomTemplates["rooms/start/room.json"]) return roomTemplates["rooms/start/room.json"];
        if (roomTemplates["rooms/start.json"]) return roomTemplates["rooms/start.json"];

        // 2. Try to find any room with "start" in name/ID
        const startKey = Object.keys(roomTemplates).find(k => k.toLowerCase().includes('start'));
        if (startKey) return roomTemplates[startKey];

        // 3. Fallback: Take the first "normal" room available
        // We filter out "boss" tagged ones to be safe, though loose matching is fine for V1
        const keys = Object.keys(roomTemplates).filter(k =>
            !roomTemplates[k]._type || roomTemplates[k]._type !== 'boss'
        );
        if (keys.length > 0) return roomTemplates[keys[0]];

        return null; // Fatal
    };

    const findBossTemplate = () => {
        // 1. Try explicit "boss" (legacy)
        if (roomTemplates["boss"]) return roomTemplates["boss"];

        // 2. Try any room tagged as boss (from bossrooms list)
        const bossKey = Object.keys(roomTemplates).find(k => roomTemplates[k]._type === 'boss');
        if (bossKey) {
            log("Found Boss Template:", bossKey);
            return roomTemplates[bossKey];
        }

        // 3. Fallback
        console.warn("No Boss Template found. Using last available.");
        const keys = Object.keys(roomTemplates);
        return roomTemplates[keys[keys.length - 1]];
    };

    const startTmpl = findStartTemplate();
    const bossTmpl = findBossTemplate();

    fullMapCoords.forEach(coord => {
        let template;
        if (coord === "0,0") {
            template = startTmpl;
        } else if (coord === bossCoord) {
            template = bossTmpl;
        } else {
            // Random Normal Room
            // Filter keys to exclude start/boss specifics if possible, or just pick random normal
            const keys = Object.keys(roomTemplates).filter(k =>
                roomTemplates[k] !== startTmpl && roomTemplates[k] !== bossTmpl &&
                (!roomTemplates[k]._type || roomTemplates[k]._type !== 'boss')
            );

            if (keys.length > 0) {
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                template = roomTemplates[randomKey];
            } else {
                template = startTmpl; // Last resort
            }
        }

        // Check if template exists
        if (!template) {
            console.error(`Missing template for coord: ${coord}.`);
            template = startTmpl || { width: 800, height: 600, name: "Empty Error Room", doors: {} };
        }

        // Deep copy template
        const roomInstance = JSON.parse(JSON.stringify(template));
        levelMap[coord] = {
            roomData: roomInstance,
            // Start room is pre-cleared ONLY if it's NOT a boss room
            cleared: (coord === "0,0") && !roomInstance.isBoss
        };
    });

    // 4. Pre-stitch doors between all adjacent rooms
    for (let coord in levelMap) {
        const [rx, ry] = coord.split(',').map(Number);
        const data = levelMap[coord].roomData;
        if (!data.doors) data.doors = {};

        dirs.forEach(d => {
            const neighborCoord = `${rx + d.dx},${ry + d.dy}`;
            if (levelMap[neighborCoord]) {
                // If neighbor exists, ensure door is active and unlocked
                // If neighbor exists, ensure door is active and unlocked (unless template forbids it)
                if (!data.doors[d.name]) {
                    data.doors[d.name] = { active: 1, locked: 0 };
                } else {
                    // Respect template: Only force active if undefined
                    if (data.doors[d.name].active === undefined) data.doors[d.name].active = 1;
                }

                // Keep locked status if template specifically had it, otherwise 0
                if (data.doors[d.name].locked === undefined) data.doors[d.name].locked = 0;

                // FORCE UNLOCK if on Golden Path to ensuring Boss is reachable
                if (goldenPath && goldenPath.includes(coord) && goldenPath.includes(neighborCoord)) {
                    data.doors[d.name].locked = 0;
                }

                // Sync door coordinates if missing
                if (d.name === "top" || d.name === "bottom") {
                    if (data.doors[d.name].x === undefined) data.doors[d.name].x = (data.width || 800) / 2;
                } else {
                    if (data.doors[d.name].y === undefined) data.doors[d.name].y = (data.height || 600) / 2;
                }
            } else {
                // If no neighbor, ensure door is inactive (unless it's a boss room entry which we handle)
                if (data.doors[d.name]) data.doors[d.name].active = 0;
            }
        });

    }

    log("Level Generated upfront with", Object.keys(levelMap).length, "rooms.");
    log("Golden Path:", goldenPath);
}

const BOUNDARY = 20;
const DOOR_SIZE = 50;
const DOOR_THICKNESS = 15;
// Load configurations (Async)
let DEBUG_START_BOSS = false;
let DEBUG_TEST_ROOM = false;
let DEBUG_PLAYER = true;
let GODMODE_ENABLED = false;
let DEBUG_WINDOW_ENABLED = false;
let DEBUG_LOG_ENABLED = false;
let DEBUG_SPAWN_ALL_ITEMS = false;
let DEBUG_SPAWN_GUNS = false;
let DEBUG_SPAWN_BOMBS = false;
let DEBUG_SPAWN_INVENTORY = false;
let DEBUG_SPAWN_MODS_PLAYER = false;
let DEBUG_SPAWN_MODS_BULLET = true;

let musicMuted = false;
let lastMKeyTime = 0;



// configurations
async function initGame(isRestart = false, nextLevel = null, keepStats = false) {
    // 0. Force Audio Resume (Must be first, to catch user interaction)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    if (isInitializing) return;
    isInitializing = true;

    // KILL ZOMBIE AUDIO (Fix for duplicate music glitch)
    // If a legacy window.introMusic exists and is playing, stop it.
    if (window.introMusic && typeof window.introMusic.pause === 'function') {
        window.introMusic.pause();
        window.introMusic = null;
    }
    // Also pause the global one just in case we are restarting
    if (introMusic && !introMusic.paused) {
        // Don't pause here if we want seamless loop, but given the bugs, let's ensure clean state
        // introMusic.pause(); 
    }

    // Debug panel setup moved after config load

    // MOVED: Music start logic is now handled AFTER game.json is loaded to respect "music": false setting.

    gameState = STATES.START; // Always reset to START first, let startGame() transition to PLAY
    overlayEl.style.display = 'none';
    welcomeEl.style.display = 'none'; // Default hidden, show only    // Initial UI State
    if (uiEl) {
        // uiEl.style.display = (gameData && gameData.showUI !== false) ? 'flex' : 'none'; // OLD
        uiEl.style.display = 'flex'; // Always keep flex container for layout
        const statsPanel = document.getElementById('stats-panel');
        if (statsPanel) statsPanel.style.display = (gameData && gameData.showUI !== false) ? 'block' : 'none';

        const mapCanvas = document.getElementById('minimapCanvas');
        if (mapCanvas) mapCanvas.style.display = (gameData && gameData.showMinimap !== false) ? 'block' : 'none';
    }
    bullets = [];
    bombs = [];
    particles = [];
    enemies = [];
    if (typeof portal !== 'undefined') portal.active = false;

    // ... [Previous debug and player reset logic remains the same] ...
    // Room debug display setup moved after config load

    // Room debug display setup moved after config load

    // Preserved Stats for Next Level
    let savedPlayerStats = null;
    log(`initGame called. isRestart=${isRestart}, keepStats=${keepStats}, player.bombType=${player ? player.bombType : 'null'}`);

    if (keepStats && player) {
        // Deep Clone to preserve ALL properties (items, modifiers, etc.)
        savedPlayerStats = JSON.parse(JSON.stringify(player));

        // Remove volatile runtime state
        delete savedPlayerStats.x;
        delete savedPlayerStats.y;
        delete savedPlayerStats.vx;
        delete savedPlayerStats.vy;
        delete savedPlayerStats.roomX;
        delete savedPlayerStats.roomY;
        delete savedPlayerStats.invulnUntil;
        delete savedPlayerStats.frozen;

        log("Saved Complete Player State");
    }

    if (!savedPlayerStats) {
        player.hp = 3;
        player.speed = 4;
        player.inventory.keys = 0;
        player.inventory.bombs = 0; // Ensure bombs reset too if not kept
        perfectStreak = 0; // Reset streak ONLY on fresh start
    }
    // Always reset pos
    player.x = 300;
    player.y = 200;
    player.roomX = 0;
    player.roomY = 0;
    bulletsInRoom = 0;
    player.roomY = 0;
    bulletsInRoom = 0;
    hitsInRoom = 0;

    // SHARD CURRENCY INIT
    // Red Shards (Permanent)
    const storedRed = localStorage.getItem('currency_red');
    player.redShards = storedRed ? parseInt(storedRed) : 0;

    // Green Shards (Run-based)
    player.inventory.greenShards = 0; // Always reset on run start

    // perfectStreak = 0; // REMOVED: Managed above
    perfectEl.style.display = 'none';
    roomStartTime = Date.now();
    ghostSpawned = false; // Reset Ghost
    ghostEntry = null;    // Reset Ghost Entry State
    roomFreezeUntil = 0;  // Reset Freeze Timer
    bossKilled = false;   // Reset Boss Kill State
    visitedRooms = {};
    levelMap = {};

    try {
        // 1. Load Game Config First
        let gData = await fetch('/json/game.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 }));

        // 1b. Load Lore & Speech Data
        try {
            const [lData, sData] = await Promise.all([
                fetch('/json/enemies/lore/names.json?t=' + Date.now()).then(r => r.json()).catch(() => null),
                fetch('/json/enemies/lore/speech.json?t=' + Date.now()).then(r => r.json()).catch(() => null)
            ]);
            loreData = lData;
            speechData = sData;
            log("Loaded Lore & Speech Data");
        } catch (e) {
            console.warn("Failed to load lore/speech data", e);
            loreData = null;
        }

        // APPLY SAVED UNLOCK OVERRIDES (Moved here to affect startLevel)
        try {
            const saved = localStorage.getItem('game_unlocks');
            if (saved) {
                const overrides = JSON.parse(saved);
                const targetKeys = ['json/game.json', 'game.json', '/json/game.json'];
                targetKeys.forEach(k => {
                    if (overrides[k]) {
                        log("Applying Unlock Overrides for:", k, overrides[k]);
                        gData = deepMerge(gData, overrides[k]);
                    }
                });
            }
        } catch (e) {
            console.error("Failed to apply saved unlocks", e);
        }

        // 2. Apply Permanent Unlocks to Default Loadout (Fix for Fresh Load/Refresh)
        if (!gData.gunType && gData.unlocked_peashooter) {
            gData.gunType = 'peashooter';
            log("Applying Unlocked Peashooter to Loadout");
        }
        if (!gData.bombType && gData.unlocked_bomb_normal) {
            gData.bombType = 'normal';
            log("Applying Unlocked Normal Bomb to Loadout");
        }

        // 3. Load Level Specific Data
        // Use nextLevel if provided, else config startLevel
        const levelFile = nextLevel || gData.startLevel;
        if (levelFile) {
            try {
                log("Loading Level:", levelFile);
                const url = levelFile.startsWith('json/') ? levelFile : `json/${levelFile}`;
                const levelRes = await fetch(`${url}?t=${Date.now()}`);
                if (levelRes.ok) {
                    const levelData = await levelRes.json();

                    // AUTO-DETECT: If this file is a Room (has isBoss), ensure it's set as the bossRoom 
                    // so it gets loaded into templates correctly.
                    if (levelData.isBoss && !levelData.bossRoom) {
                        log("Level file identified as Boss Room. Setting bossRoom to self:", levelFile);
                        levelData.bossRoom = levelFile;
                        // Also force NoRooms to 1? Or let generation handle it?
                        // Usually boss levels are 1 room.
                        if (levelData.NoRooms === undefined) levelData.NoRooms = 1;
                    }

                    // Merge level data into game data (Level overrides Game)
                    gData = { ...gData, ...levelData };
                } else {
                    console.error("Failed to load level file:", gData.startLevel);
                }
            } catch (err) {
                console.error("Error parsing level file:", err);
            }
        }

        // 3. Load Manifests in Parallel
        const [manData, mData, itemMan] = await Promise.all([
            fetch('/json/players/manifest.json?t=' + Date.now()).then(res => res.json()),
            fetch('json/rooms/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] })),
            fetch('json/items/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ items: [] }))
        ]);



        gameData = gData;

        // --- SYNC DEBUG FLAGS FROM CONFIG ---
        if (gameData.debug) {
            DEBUG_START_BOSS = gameData.debug.startBoss ?? false;
            DEBUG_PLAYER = gameData.debug.player ?? true;
            GODMODE_ENABLED = gameData.debug.godMode ?? false;
            DEBUG_WINDOW_ENABLED = (gameData.showDebugWindow !== undefined) ? gameData.showDebugWindow : (gameData.debug.windowEnabled ?? false);
            DEBUG_LOG_ENABLED = (gameData.showDebugLog !== undefined) ? gameData.showDebugLog : (gameData.debug.log ?? false);

            if (gameData.debug.spawn) {
                DEBUG_SPAWN_ALL_ITEMS = gameData.debug.spawn.allItems ?? false;
                DEBUG_SPAWN_GUNS = gameData.debug.spawn.guns ?? false;
                DEBUG_SPAWN_BOMBS = gameData.debug.spawn.bombs ?? false;
                DEBUG_SPAWN_INVENTORY = gameData.debug.spawn.inventory ?? false;
                DEBUG_SPAWN_MODS_PLAYER = gameData.debug.spawn.modsPlayer ?? false;
                DEBUG_SPAWN_MODS_BULLET = gameData.debug.spawn.modsBullet ?? true;
            }
        }

        // Support root-level overrides (regardless of debug object existence)
        if (gameData.showDebugWindow !== undefined) DEBUG_WINDOW_ENABLED = gameData.showDebugWindow;
        if (gameData.showDebugLog !== undefined) DEBUG_LOG_ENABLED = gameData.showDebugLog;

        // Apply Debug UI state
        if (debugPanel) debugPanel.style.display = DEBUG_WINDOW_ENABLED ? 'flex' : 'none';
        if (roomEl) roomEl.style.display = DEBUG_WINDOW_ENABLED ? 'block' : 'none';
        if (debugLogEl) debugLogEl.style.display = DEBUG_LOG_ENABLED ? 'block' : 'none';

        roomManifest = mData;

        // LOAD STARTING ITEMS
        groundItems = [];
        if (itemMan && itemMan.items) {
            log("Loading Items Manifest:", itemMan.items.length);
            const itemPromises = itemMan.items.map(i =>
                fetch(`json/items/${i}.json?t=` + Date.now()).then(r => r.json()).catch(e => {
                    console.error("Failed to load item:", i, e);
                    return null;
                })
            );
            const allItems = await Promise.all(itemPromises);
            window.allItemTemplates = allItems; // Expose for room drops

            // ENHANCE: Fetch color from target config
            await Promise.all(allItems.map(async (item) => {
                if (!item || !item.location) return;
                try {
                    const res = await fetch(`json/${item.location}?t=` + Date.now());
                    const config = await res.json();

                    // Check Top Level (Bombs/Modifiers) OR Bullet Level (Guns)
                    const color = config.colour || config.color ||
                        (config.Bullet && (config.Bullet.colour || config.Bullet.color));

                    if (color) {
                        item.colour = color;
                    }
                } catch (e) {
                    // console.warn("Could not load config for color:", item.name);
                }
            }));

            // Filter starters
            // Legacy: Previously spawned all 'starter:false' items.
            // NOW: Only spawn if DEBUG flag is set.
            // Filter starters
            // Legacy: Previously spawned all 'starter:false' items.
            // NOW: Spawn based on granular DEBUG flags.
            const starters = allItems.filter(i => {
                if (!i) return false;

                // 1. Explicitly enabled by ALL flag
                if (DEBUG_SPAWN_ALL_ITEMS) return true;

                // 2. Category Checks
                const isGun = i.type === 'gun';
                const isBomb = i.type === 'bomb';
                const isMod = i.type === 'modifier';
                const loc = (i.location || "").toLowerCase();

                // Inventory (Keys/Bombs/Consumables) - often identified by path or lack of "modifier" type?
                // Actually user defines them as type="modifier" usually. 
                // Let's look for "inventory" in path.
                const isInventory = isMod && loc.includes('inventory');

                // Player Mods (Stats, Shields)
                const isPlayerMod = isMod && loc.includes('modifiers/player') && !isInventory;

                // Bullet Mods (Homing, FireRate, etc)
                const isBulletMod = isMod && loc.includes('modifiers/bullets');

                if (DEBUG_SPAWN_GUNS && isGun) return true;
                if (DEBUG_SPAWN_BOMBS && isBomb) return true;
                if (DEBUG_SPAWN_INVENTORY && isInventory) return true;
                if (DEBUG_SPAWN_MODS_PLAYER && isPlayerMod) return true;
                if (DEBUG_SPAWN_MODS_BULLET && isBulletMod) return true;

                return false;
            });
            log(`Found ${allItems.length} total items. Spawning ${starters.length} floor items.`);

            // Spawn them in a row
            // Spawn them in a grid within safe margins
            const marginX = canvas.width * 0.2;
            const marginY = canvas.height * 0.2;
            const safeW = canvas.width - (marginX * 2);
            const itemSpacing = 80;
            const cols = Math.floor(safeW / itemSpacing);

            starters.forEach((item, idx) => {
                const c = idx % cols;
                const r = Math.floor(idx / cols);

                groundItems.push({
                    x: marginX + (c * itemSpacing) + (itemSpacing / 2),
                    y: marginY + (r * itemSpacing) + (itemSpacing / 2),
                    data: item,
                    roomX: 0,
                    roomY: 0,
                    // Add physics properties immediately
                    vx: 0, vy: 0,
                    solid: true, moveable: true, friction: 0.9, size: 15,
                    floatOffset: Math.random() * 100
                });
            });
            log(`Spawned ${starters.length} starter items.`);
        } else {
            log("No item manifest found!");
        }

        // Load all players
        availablePlayers = [];
        if (manData && manData.players) {
            const playerPromises = manData.players.map(p =>
                fetch(`/json/players/${p.file}?t=` + Date.now())
                    .then(res => res.json())
                    .then(data => ({ ...data, file: p.file })) // Keep file ref if needed
            );
            availablePlayers = await Promise.all(playerPromises);
        }

        // Default to first player
        if (availablePlayers.length > 0) {
            player = JSON.parse(JSON.stringify(availablePlayers[0]));
        } else {
            console.error("No players found!");
            player = { hp: 3, speed: 4, inventory: { keys: 0 }, gunType: 'geometry', bombType: 'normal' }; // Fallback
        }

        // Restore Stats if kept
        if (savedPlayerStats) {
            log("Restoring Full Player State");
            // Merge saved state OVER the default template
            // This ensures we keep new defaults if valid, but restore all our progress
            Object.assign(player, savedPlayerStats);

            // Explicitly ensure criticals if missing (shouldn't happen with full clone)
            if (savedPlayerStats.perfectStreak !== undefined) {
                perfectStreak = savedPlayerStats.perfectStreak;
            }
        }

        // Apply Game Config Overrides
        // FIXED: Only override if we are NOT preserving stats (Fresh Start / Restart),
        // or if the stat was missing.
        if (gameData.gunType && !savedPlayerStats) {
            log("Applying gameData override for gunType:", gameData.gunType);
            player.gunType = gameData.gunType;
        }
        if (gameData.bombType && !savedPlayerStats) {
            log("Applying gameData override for bombType:", gameData.bombType);
            player.bombType = gameData.bombType;
        }

        // Load player specific assets
        let fetchedGun = null;
        let fetchedBomb = null;

        try {
            if (player.gunType) {
                const gunUrl = `/json/weapons/guns/player/${player.gunType}.json?t=` + Date.now();
                const gRes = await fetch(gunUrl);
                if (gRes.ok) fetchedGun = await gRes.json();
                else console.error("Gun fetch failed:", gRes.status, gRes.statusText);
            } else {
                log("No player.gunType defined, skipping initial fetch.");
            }
        } catch (e) { console.error("Gun fetch error:", e); }

        if (!fetchedGun) {
            log("Attempting fallback to 'peashooter'...");
            try {
                const res = await fetch(`/json/weapons/guns/player/peashooter.json?t=` + Date.now());
                if (res.ok) {
                    fetchedGun = await res.json();
                    player.gunType = 'peashooter'; // Update player state
                }
            } catch (e) { }
        }

        const bombUrl = player.bombType ? `/json/weapons/bombs/${player.bombType}.json?t=` + Date.now() : null;
        if (bombUrl) {
            try {
                const bRes = await fetch(bombUrl);
                if (bRes.ok) fetchedBomb = await bRes.json();
            } catch (e) { }
        }

        if (!fetchedGun) {
            console.error("CRITICAL: Could not load ANY gun. Player will be unarmed.");
            gun = { Bullet: { NoBullets: true } };
            spawnFloatingText(canvas.width / 2, canvas.height / 2, "ERROR: GUN LOAD FAILED", "red");
        } else {
            gun = fetchedGun;
            log("Loaded Gun Data:", gun.name);
        }
        bomb = fetchedBomb || {};

        if (gameData.music) {
            // --- 1. INSTANT AUDIO SETUP ---
            // Ensure global audio is ready
            introMusic.loop = true;
            introMusic.volume = 0.4;

            // This attempts to play immediately.
            // If the browser blocks it, the 'keydown' listener below will catch it.
            if (!musicMuted) {
                introMusic.play().catch(() => {
                    log("Autoplay blocked: Waiting for first user interaction to start music.");
                });
            }

            // Fallback: Start music on the very first key press or click if autoplay failed
            const startAudio = () => {
                if (introMusic.paused && !musicMuted) introMusic.play();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                window.removeEventListener('keydown', startAudio);
                window.removeEventListener('mousedown', startAudio);
            };
            window.addEventListener('keydown', startAudio);
            window.addEventListener('mousedown', startAudio);
        }

        // Init Menu UI
        if (!isRestart) updateWelcomeScreen();
        // Initialize Ammo
        if (gun.Bullet?.ammo?.active) {
            player.ammoMode = gun.Bullet?.ammo?.type || 'finite'; // 'finite', 'reload', 'recharge'
            player.maxMag = gun.Bullet?.ammo?.amount || 100; // Clip size
            // Handle resetTimer being 0 or undefined, treat as 0 if finite, but if reload/recharge usually non-zero.
            // But if user sets resetTimer to 0, it instant reloads?
            player.reloadTime = gun.Bullet?.ammo?.resetTimer !== undefined ? gun.Bullet?.ammo?.resetTimer : (gun.Bullet?.ammo?.reload || 1000);

            // Initial State
            player.ammo = player.maxMag;
            player.reloading = false;

            // Reserve Logic
            if (player.ammoMode === 'reload') {
                // Magazine Mode: maxAmount is total reserve
                player.reserveAmmo = (gun.Bullet?.ammo?.maxAmount || 0) - player.maxMag;
                if (player.reserveAmmo < 0) player.reserveAmmo = 0;
            } else if (player.ammoMode === 'recharge') {
                // Recharge Mode: Infinite reserve
                player.reserveAmmo = Infinity;
            } else {
                // Finite Mode: No reserve
                player.reserveAmmo = 0;
            }
        }



        // 4. Load Room Templates (Dynamic from Level Data)
        roomTemplates = {};
        const roomProtos = [];

        // Helper to load a room file
        const loadRoomFile = (path, type) => {
            if (!path || path.trim() === "") return Promise.resolve();
            // Handle relative paths from JSON (e.g. "rooms/start.json")
            // Ensure we don't double stack "json/" if valid path provided
            const url = path.startsWith('http') || path.startsWith('/') || path.startsWith('json/') ? path : `json/${path}`;
            return fetch(url + '?t=' + Date.now())
                .then(res => {
                    if (!res.ok) throw new Error("404");
                    return res.json();
                })
                .then(data => {
                    // ID Generation: Handle "room.json" collision
                    const parts = path.split('/');
                    let id = parts[parts.length - 1].replace('.json', '');
                    if (id === 'room' && parts.length > 1) {
                        id = parts[parts.length - 2]; // Use folder name (e.g. "boss4", "start")
                    }

                    data.templateId = id;
                    // Tag it
                    if (type) data._type = type;

                    // Store
                    roomTemplates[id] = data;
                    // Also store by full path just in case
                    roomTemplates[path] = data;
                    log(`Loaded Room: ${id} (${type || 'normal'})`);
                })
                .catch(err => console.error(`Failed to load room: ${path}`, err));
        };

        // A. Standard Rooms
        let available = gameData.avalibleroons || gameData.availablerooms || [];
        available = available.filter(p => p && p.trim() !== "");
        // If empty, fallback to manifest?
        // ONE CHECK: Only fallback if we DON'T have a startRoom/bossRoom config
        // meaning we are truly in a "default game" state, not a specific level file state.
        if (available.length === 0 && !gameData.startRoom && !gameData.bossRoom) {
            // FALLBACK: Load from old manifest
            try {
                const m = await fetch('json/rooms/manifest.json?t=' + Date.now()).then(res => res.json());
                if (m.rooms) {
                    m.rooms.forEach(r => roomProtos.push(loadRoomFile(`rooms/${r}/room.json`, 'normal')));
                    // Also try to load start/boss legacy
                    roomProtos.push(loadRoomFile('rooms/start/room.json', 'start'));
                    roomProtos.push(loadRoomFile('rooms/boss1/room.json', 'boss'));
                }
            } catch (e) { console.warn("No legacy manifest found"); }
        } else {
            available.forEach(path => roomProtos.push(loadRoomFile(path, 'normal')));
        }

        // C. Explicit Start Room
        if (gameData.startRoom) {
            roomProtos.push(loadRoomFile(gameData.startRoom, 'start'));
        }

        // B. Boss Rooms
        let bosses = gameData.bossrooms || [];
        // Support singular 'bossRoom' fallback
        if (gameData.bossRoom && gameData.bossRoom.trim() !== "") {
            bosses.push(gameData.bossRoom);
        }
        bosses = bosses.filter(p => p && p.trim() !== "");
        bosses.forEach(path => roomProtos.push(loadRoomFile(path, 'boss')));



        await Promise.all(roomProtos);

        // 4. Pre-load ALL enemy templates
        enemyTemplates = {};
        const enemyManifest = await fetch('json/enemies/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ enemies: [] }));
        const ePromises = enemyManifest.enemies.map(id =>
            fetch(`json/enemies/${id}.json?t=` + Date.now())
                .then(res => res.json())
                .then(data => {
                    // Use the last part of the path as the key (e.g. "special/firstboss" -> "firstboss")
                    const key = id.split('/').pop();
                    enemyTemplates[key] = data;
                })
        );
        await Promise.all(ePromises);

        // 5. Generate Level
        const urlParams = new URLSearchParams(window.location.search);
        const isDebugRoom = urlParams.get('debugRoom') === 'true';
        DEBUG_TEST_ROOM = isDebugRoom;

        if (DEBUG_START_BOSS) {
            bossCoord = "0,0";
            goldenPath = ["0,0"];
            bossIntroEndTime = Date.now() + 2000;
            levelMap["0,0"] = { roomData: JSON.parse(JSON.stringify(roomTemplates["boss"])), cleared: false };
        }
        else if (isDebugRoom) {
            // --- EDITOR TEST ROOM BYPASS ---
            try {
                const debugJson = localStorage.getItem('debugRoomData');
                if (debugJson) {
                    const debugData = JSON.parse(debugJson);

                    bossCoord = "0,0";
                    goldenPath = ["0,0"];
                    levelMap["0,0"] = { roomData: debugData, cleared: false }; // Directly inject into map

                    // Force Skip Welcome
                    gameData.showWelcome = false;
                    gData.showWelcome = false;
                } else {
                    console.error("No debugRoomData found in localStorage");
                    generateLevel(gameData.NoRooms !== undefined ? gameData.NoRooms : 11);
                }
            } catch (e) {
                console.error("Failed to load test room", e);
                generateLevel(gameData.NoRooms !== undefined ? gameData.NoRooms : 11);
            }
        }
        else {
            generateLevel(gameData.NoRooms !== undefined ? gameData.NoRooms : 11);
        }

        const startEntry = levelMap["0,0"];
        roomData = startEntry.roomData;
        visitedRooms["0,0"] = startEntry;

        canvas.width = roomData.width || 800;
        canvas.height = roomData.height || 600;

        // if (gameState === STATES.PLAY) { spawnEnemies(); ... } 
        // Logic removed: startGame() handles spawning now.

        if (!gameLoopStarted) {
            gameLoopStarted = true;
            draw();
        }

        // AUTO START IF CONFIGURED (After everything is ready)
    } finally {
        isInitializing = false;
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        // AUTO START IF CONFIGURED (After everything is ready)
        // Moved here to ensure isInitializing is false before starting
        if (gameData.showWelcome === false || isRestart) {
            // Pass savedPlayerStats existence as keepState flag
            startGame((savedPlayerStats && Object.keys(savedPlayerStats).length > 0) ? true : false);
        }
    }
}
// Initial Start
initGame();

// --- Input Handling ---
window.addEventListener('keydown', e => {
    // Debug Toggle
    if (e.code === 'Backquote') {
        DEBUG_WINDOW_ENABLED = !DEBUG_WINDOW_ENABLED;
        DEBUG_LOG_ENABLED = !DEBUG_LOG_ENABLED; // Toggle log too? User implied "Debug Window broken", usually they go together.

        if (debugPanel) debugPanel.style.display = DEBUG_WINDOW_ENABLED ? 'flex' : 'none';
        if (debugLogEl) debugLogEl.style.display = DEBUG_LOG_ENABLED ? 'block' : 'none';

        // Re-render check
        if (DEBUG_WINDOW_ENABLED) renderDebugForm();
        log("Debug Toggled:", DEBUG_WINDOW_ENABLED);
        return;
    }

    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (gameState === STATES.START) {
        // Modal Input Block
        const modal = document.getElementById('newGameModal');
        if (modal && modal.style.display !== 'none') {
            if (e.code === 'Escape' || e.code === 'KeyN' || e.code === 'Enter') { // Allow Escape, N, or Enter to close
                cancelNewGame();
            }
            if (e.code === 'KeyD') {
                confirmNewGame();
            }
            return; // Block all other inputs
        }
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyM') {
            log("Keydown Menu Key:", e.code);
            keys[e.code] = true;
            return;
        }

        // Music Toggle (0) - Toggle Intro Music without starting game
        if (e.code === 'Digit0' || e.code === 'Numpad0') {
            if (introMusic.paused) {
                introMusic.play();
                musicMuted = false;
                log("Intro Music Playing");
            } else {
                introMusic.pause();
                musicMuted = true;
                log("Intro Music Paused");
            }
            return;
        }

        // Check for New Game (N)
        const hasSave = localStorage.getItem('game_unlocks') || localStorage.getItem('game_unlocked_ids');
        if (e.code === 'KeyN' && hasSave) {
            const modal = document.getElementById('newGameModal');
            if (modal) {
                modal.style.display = 'flex';
            }
            return;
        }

        startGame();
        return;
    }
    keys[e.code] = true;
    if (gameState === STATES.GAMEOVER) {
        if (e.code === 'KeyR') {
            restartGame();
        }
        // Death: Enter = Main Menu, M/C = Continue(Revive) logic preserved if they want it, 
        // but User specifically asked for "Main Menu (Enter)"
        if (e.code === 'Enter') {
            goToWelcome();
        }
        // Keep M/C as "Revive" hack? Or remove it? 
        // User didn't say remove it, just "change main menu to enter".
        // I will keep M/C for "Continue" (Revive) as hidden feature if button is hidden, 
        // OR just leave them. But Enter is now explicit Main Menu.
        // Actually, if Enter was Restart before, now it's Menu.
        if (e.code === 'KeyM' || e.code === 'KeyC') {
            goContinue();
        }
    }
    if (gameState === STATES.WIN) {
        // Victory: Enter = Main Menu, R = Restart
        if (e.code === 'Enter') {
            goToWelcome();
        }
        if (e.code === 'KeyC' || e.code === 'KeyM') {
            // Optional: Keep C/M as Continue if they really want to roam? 
            // User said "only ever be enter and go back to main menu"
            // So maybe disable Continue here? Or map it to something else?
            // I'll leave C/M as Continue for now but Enter is definitely Main Menu.
            goContinue();
        }
        if (e.code === 'KeyR') {
            restartGame();
        }
    }
    // Pause menu key controls
    if (gameState === STATES.GAMEMENU) {
        if (e.code === 'KeyP' || e.code === 'KeyC' || e.code === 'Enter') {
            goContinue();  // P, C, or Enter = Continue
        }
        if (e.code === 'KeyR') {
            restartGame(); // R = Restart
        }
        if (e.code === 'KeyM') {
            // Keep M for Menu here? Or also Continue? 
            // Stick to standard for Pause, but user hates M for Menu in GameOver. 
            // Let's make M = Continue here too for consistency if they want.
            // But usually Pause -> Menu is valid. I'll leave Pause M as Menu for now unless requested.
            goToWelcome();
        }
    }
});
window.addEventListener('keyup', e => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    keys[e.code] = false;
});

// Clear keys on window blur to prevent sticky inputs
window.addEventListener('blur', () => {
    keys = {};
});

// --- HELPER: START GAME LOGIC ---
let isGameStarting = false;
function startGame(keepState = false) {
    // Force Audio Resume on User Interaction
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Guard against starting while Initializing or Unlocking or already starting
    if (gameState === STATES.PLAY || isGameStarting || isInitializing || isUnlocking) return;
    isGameStarting = true;

    // Check Lock
    const p = availablePlayers[selectedPlayerIndex];

    if (p && p.locked) {
        log("Player Locked - Cannot Start");
        isGameStarting = false;
        return;
    }

    // Show Loading Screen immediately to block input/visuals
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    welcomeEl.style.display = 'none';

    // Apply Selected Player Stats
    // IF keepState is true, we assume player object is already correctly set (loaded or preserved)
    if (!keepState && p) {
        // Apply stats but keep runtime properties like x/y if needed (though start resets them)
        // Actually initGame reset player.x/y already.
        const defaults = { x: 300, y: 200, roomX: 0, roomY: 0 };
        player = { ...defaults, ...JSON.parse(JSON.stringify(p)) };
        if (!player.maxHp) player.maxHp = player.hp || 3;
        if (!player.inventory) player.inventory = { keys: 0, bombs: 0 };

        // RE-APPLY GameOverrides (Fixed: startGame was wiping initGame overrides)
        if (gameData.gunType) player.gunType = gameData.gunType;
        if (gameData.bombType) player.bombType = gameData.bombType;
    }

    // Async Load Assets then Start
    (async () => {
        try {
            const [gData, bData] = await Promise.all([
                (player.gunType ? fetch(`/json/weapons/guns/player/${player.gunType}.json?t=` + Date.now()).then(res => res.json()) : Promise.resolve({ Bullet: { NoBullets: true } })),
                (player.bombType ? fetch(`/json/weapons/bombs/${player.bombType}.json?t=` + Date.now()).then(res => res.json()) : Promise.resolve({}))
            ]);
            gun = gData;
            bomb = bData;

            if (loadingEl) loadingEl.style.display = 'none'; // Hide loading when done


            // Initialize Ammo for new gun (Only if NOT keeping state or if we swapped guns?)
            // If keeping state, ammo should be preserved.
            if (!keepState && gun.Bullet?.ammo?.active) {
                player.ammoMode = gun.Bullet?.ammo?.type || 'finite';
                player.maxMag = gun.Bullet?.ammo?.amount || 100;
                player.reloadTime = gun.Bullet?.ammo?.resetTimer !== undefined ? gun.Bullet?.ammo?.resetTimer : (gun.Bullet?.ammo?.reload || 1000);
                player.ammo = player.maxMag;
                player.reloading = false;
                player.reserveAmmo = (player.ammoMode === 'reload') ? ((gun.Bullet?.ammo?.maxAmount || 0) - player.maxMag) : (player.ammoMode === 'recharge' ? Infinity : 0);
                if (player.reserveAmmo < 0) player.reserveAmmo = 0;
            }

            // Start Game
            gameState = STATES.PLAY;
            welcomeEl.style.display = 'none';
            if (uiEl) {
                // Manage UI Components Independently
                uiEl.style.display = 'flex'; // Enable container

                const statsPanel = document.getElementById('stats-panel');
                if (statsPanel) statsPanel.style.display = (gameData.showUI !== false) ? 'block' : 'none';
            }     // Show Level Title
            if (gameData.name) {
                showLevelTitle(gameData.name);
            }

            // Minimap Visibility
            if (mapCanvas) mapCanvas.style.display = (gameData.showMinimap !== false) ? 'block' : 'none';

            // If starting primarily in Boss Room (Debug Mode), reset intro timer
            if (roomData.isBoss) {
                bossIntroEndTime = Date.now() + 2000;
            }

            spawnEnemies();

            // Check for Start Room Bonus (First Start)
            if (gameData.bonuses && gameData.bonuses.startroom) {
                const dropped = spawnRoomRewards(gameData.bonuses.startroom);
                if (dropped) {
                    perfectEl.innerText = "START BONUS!";
                    triggerPerfectText();
                }
            }

            renderDebugForm();
            updateUI();
        } catch (err) {
            console.error("Error starting game assets:", err);
            // Re-show welcome if failed so user can try again
            welcomeEl.style.display = 'flex';
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        } finally {
            isGameStarting = false;
        }
    })();
}

// Debug Listeners
function populateDebugSelect() {
    if (!debugSelect) return;
    debugSelect.innerHTML = '';
    const opts = [
        { val: 'player', text: 'Player' },
        { val: 'room', text: 'Room Data' },
        { val: 'spawn', text: 'Spawn Items' },
        { val: 'spawnEnemy', text: 'Spawn Enemies' },
        { val: 'spawnRoom', text: 'Load Room' }
    ];
    opts.forEach(o => {
        const el = document.createElement('option');
        el.value = o.val;
        el.innerText = o.text;
        debugSelect.appendChild(el);
    });
    // Default select based on last used or first
    // debugSelect.value = 'player';
}
populateDebugSelect();

if (debugSelect) debugSelect.addEventListener('change', renderDebugForm);
// Force initial render of the form
setTimeout(renderDebugForm, 100);

function applyEnemyConfig(inst, group) {
    const config = gameData.enemyConfig || {
        variants: ['speedy', 'small', 'large', 'massive', 'gunner', 'turret', 'medium'],
        shapes: ['circle', 'square', 'triangle', 'hexagon', 'diamond', 'star'],
        colors: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'],
        variantStats: {},
        modeStats: {}
    };

    // 1. Randomise Variant
    if (group.randomise || group.randomiseVariant) {
        group.variant = config.variants[Math.floor(Math.random() * config.variants.length)];
    }

    // 1b. Randomise Shape
    if (group.randomiseShape) {
        inst.shape = config.shapes[Math.floor(Math.random() * config.shapes.length)];
    }

    // 1c. Randomise Colour
    if (group.randomiseColour) {
        inst.color = config.colors[Math.floor(Math.random() * config.colors.length)];
    }

    // 2. Apply Variant Stats
    const stats = config.variantStats[group.variant];
    if (stats) {
        if (stats.size) inst.size = (inst.size || 25) * stats.size;
        if (stats.speed) inst.speed = (inst.speed || 1) * stats.speed;
        if (stats.hp) inst.hp = Math.max(1, (inst.hp || 10) * stats.hp);
        if (stats.damage) inst.damage = (inst.damage || 1) * stats.damage;
        if (stats.gun) inst.gun = stats.gun;

        // Special case for turret moveType
        if (group.variant === 'turret' && stats.moveType === 'static') {
            if (!group.moveType) group.moveType = {};
            if (!group.moveType.type) group.moveType.type = 'static';
        }
    }

    // 3. Apply Shape (Only if NOT randomised)
    if (group.shape && !group.randomiseShape) {
        inst.shape = group.shape;
    }

    // Capture Base Stats (After Variant, Before Mode)
    if (!inst.baseStats) {
        inst.baseStats = {
            speed: inst.speed,
            hp: inst.hp,
            damage: inst.damage,
            color: inst.color,
            size: inst.size
        };
    }

    // 4. Apply Mode (Angry)
    // ALWAYS ANGRY OVERRIDE
    if (group.alwaysAngry || inst.alwaysAngry) {
        group.mode = 'angry';
        inst.alwaysAngry = true;
    }

    inst.mode = group.mode || 'normal'; // Store mode for rendering
    if (group.mode === 'angry') {
        const angryStats = config.modeStats.angry;
        if (angryStats) {
            if (angryStats.hp) inst.hp = (inst.hp || 10) * angryStats.hp;
            if (angryStats.damage) inst.damage = (inst.damage || 1) * angryStats.damage;

            // Special handling for speedy variant speed in angry mode
            if (group.variant === 'speedy' && angryStats.speedySpeed) {
                inst.speed = (inst.speed || 1) * angryStats.speedySpeed;
            } else if (angryStats.speed) {
                inst.speed = (inst.speed || 1) * angryStats.speed;
            }

            if (angryStats.color) inst.color = angryStats.color;

            // Angry Timer
            if (inst.alwaysAngry) {
                inst.angryUntil = Infinity;
            } else {
                const duration = inst.angryTime || angryStats.angryTime;
                if (duration) {
                    inst.angryUntil = Date.now() + duration;
                }
            }
        }
    }

    // 5. Apply Modifiers (Overrides)
    if (group.modifiers) {
        Object.assign(inst, group.modifiers);
    }
}

function spawnEnemies() {
    enemies = [];
    //add the invul timer to the freeze until so they invulnerable for the time in player json
    const freezeUntil = Date.now() + (gameData.enterRoomFreezeTime || player.invulTimer || 1000);

    // Only apply invulnerability if NOT in start room
    if (player.roomX !== 0 || player.roomY !== 0) {
        player.invulnUntil = freezeUntil;
    }

    // CHECK SAVED STATE (Persistence)
    const currentCoord = `${player.roomX},${player.roomY}`;
    // If we have specific saved enemies, restore them (PRECISE STATE)
    if (levelMap[currentCoord] && levelMap[currentCoord].savedEnemies) {
        log("Restoring saved enemies for this room...");
        levelMap[currentCoord].savedEnemies.forEach(saved => {
            const typeKey = saved.templateId || saved.type;
            const template = enemyTemplates[typeKey] || { hp: 1, speed: 1, size: 25 }; // fallback
            const inst = JSON.parse(JSON.stringify(template));

            // Re-attach templateId for next save
            inst.templateId = typeKey;

            // Overwrite with saved state
            inst.x = saved.x;
            inst.y = saved.y;
            inst.hp = saved.hp;
            inst.maxHp = saved.maxHp || inst.hp; // Restore Max HP
            if (saved.moveType) inst.moveType = saved.moveType;
            if (saved.solid !== undefined) inst.solid = saved.solid;
            if (saved.indestructible !== undefined) inst.indestructible = saved.indestructible;

            // Standard init
            inst.frozen = true;
            inst.freezeEnd = freezeUntil;
            // Restore invulnerability based on type/indestructible logic
            inst.invulnerable = inst.indestructible || false;

            enemies.push(inst);
        });

        // Handle Ghost if Haunted (still spawn it separately if consistent with design?)
        // The original code handled Haunted via map property. 
        // We should probably fall through to allow ghost spawn if desired, BUT
        // the original code returns early if room is cleared. 
        // Here we have enemies, so we should allow Ghost check below?
        // Let's stick to restoring only explicitly saved ones for now. 
        // If the room was haunted, the ghost might be handled separately or saved?
        // Original logic: "If room is haunted... return". 
        // Let's keep the Ghost Check that is BELOW this block in my insertion point?
        // Wait, I am inserting this at the top.
        // Let's actually ensure we do the Haunted check separately as it was.
    }

    // START STANDARD SPAWN (Skip if we restored)
    if (enemies.length > 0 && !(levelMap[currentCoord] && levelMap[currentCoord].haunted)) return;

    // CHECK HAUNTED STATUS
    // If room is haunted, skip normal enemies and spawn Ghost immediately
    // const currentCoord = `${player.roomX},${player.roomY}`; // Already defined above
    if (levelMap[currentCoord] && levelMap[currentCoord].haunted) {
        log("The room is Haunted! The Ghost returns...");

        // Ensure ghostSpawned is true so we don't spawn another one later via timer
        ghostSpawned = true;

        const template = enemyTemplates["ghost"] || { hp: 2000, speed: 1.2, size: 50, type: "ghost" };
        const inst = JSON.parse(JSON.stringify(template));
        inst.maxHp = inst.hp; // Ensure Max HP for health bar
        // Inst config
        if (loreData) {
            // inst.lore = generateLore(inst);
            inst.lore = {
                displayName: "Player Snr",
                fullName: "Player Snr",
                nickname: "The Departed",
                title: "Player Snr"
            };
        }


        // Standard random placement or center
        inst.x = Math.random() * (canvas.width - 60) + 30;
        inst.y = Math.random() * (canvas.height - 60) + 30;
        inst.frozen = false; // Active immediately
        inst.invulnerable = false;

        enemies.push(inst);
        SFX.ghost();
        // return; // Don't skip normal spawns - user wants enemies + ghost
    }

    // FIX: If room is cleared, do NOT spawn normal enemies (but Ghost still spawns if haunted)
    if (roomData.cleared) return;

    // Skip if explicitly set to 0 enemies
    if (roomData.enemyCount === 0) return;

    // Use roomData.enemies if defined (array of {type, count}), otherwise fallback
    if (roomData.enemies && Array.isArray(roomData.enemies)) {
        log(`Spawning enemies for room: ${roomData.name}`, roomData.enemies);
        roomData.enemies.forEach(group => {
            const template = enemyTemplates[group.type];
            log(`Looking for enemy type: ${group.type}, found: ${!!template}`);
            if (template) {
                for (let i = 0; i < group.count; i++) {
                    const inst = JSON.parse(JSON.stringify(template));
                    inst.templateId = group.type; // Store ID for persistence lookup

                    // NEW: Apply Variants, Modes, and Modifiers
                    applyEnemyConfig(inst, group);

                    // ASSIGN LORE
                    if (loreData) {
                        inst.lore = generateLore(inst);
                    }

                    // MERGE moveType from Room Config (Override)
                    if (group.moveType) {
                        inst.moveType = { ...(inst.moveType || {}), ...group.moveType };
                    }

                    // Allow top-level spawn overrides (x, y) from room.json
                    if (group.x !== undefined) {
                        inst.moveType = inst.moveType || {};
                        inst.moveType.x = group.x;
                    }
                    if (group.y !== undefined) {
                        inst.moveType = inst.moveType || {};
                        inst.moveType.y = group.y;
                    }

                    // Indestructible Check
                    if (inst.hp === 0) {
                        inst.indestructible = true;
                        inst.hp = 9999; // Set high HP just in case, though we rely on the flag
                    }

                    // Determine Spawn Position
                    // User Rule: Use specified X/Y "unless its 0,0 then it will be ignored"
                    // We check inst.moveType because we just merged it. 
                    // Or specifically check the group override? User phrasing implies generic behavior.

                    // Helper to check valid coord
                    const mt = inst.moveType;
                    let useFixed = false;
                    let fixedX = 0;
                    let fixedY = 0;

                    if (mt && typeof mt === 'object') {
                        if (mt.x !== undefined && mt.y !== undefined) {
                            // Rule 1: Ignore 0,0 (treat as unset/random)
                            // Rule 2: user requested "if movetype has x,y start it there" regardless of type
                            if (mt.x !== 0 || mt.y !== 0) {
                                useFixed = true;
                                fixedX = mt.x;
                                fixedY = mt.y;
                            }
                        }
                    }

                    if (useFixed) {
                        inst.x = fixedX;
                        inst.y = fixedY;
                    } else {
                        inst.x = Math.random() * (canvas.width - 60) + 30;
                        inst.y = Math.random() * (canvas.height - 60) + 30;
                    }
                    inst.frozen = true;
                    inst.freezeEnd = freezeUntil;
                    inst.invulnerable = true;

                    if (bossKilled) {
                        inst.hp = (inst.hp || 1) * 2;
                        inst.speed = (inst.speed || 1) * 2;
                        inst.damage = (inst.damage || 1) * 2;
                    }

                    enemies.push(inst);
                    log(`Spawned ${inst.type} (ID: ${group.type}). Stealth: ${inst.stealth}, Indestructible: ${inst.indestructible}`);
                }
            } else {
                console.warn(`Enemy template not found for: ${group.type}`);
            }
        });
    } else {
        // Fallback: Random Grunts
        // FILTER: Don't spawn special enemies (Boss, Ghost) as randoms
        const validKeys = Object.keys(enemyTemplates).filter(k => !enemyTemplates[k].special);
        const randomType = validKeys.length > 0 ? validKeys[Math.floor(Math.random() * validKeys.length)] : "grunt";

        let count = 3 + Math.floor(Math.random() * 3);
        if (gameData.difficulty) count += gameData.difficulty;

        const template = enemyTemplates[randomType] || { hp: 2, speed: 1, size: 25 };


        for (let i = 0; i < count; i++) {
            const inst = JSON.parse(JSON.stringify(template));
            inst.templateId = randomType; // Store ID for persistence lookup
            inst.x = Math.random() * (canvas.width - 60) + 30;
            inst.y = Math.random() * (canvas.height - 60) + 30;
            inst.frozen = true;
            inst.freezeEnd = freezeUntil;
            inst.invulnerable = true;

            // DIFFICULTY SPIKE: If Boss is Dead, 2x Stats
            if (bossKilled) {
                inst.hp = (inst.hp || 1) * 2;
                inst.speed = (inst.speed || 1) * 2;
                inst.damage = (inst.damage || 1) * 2;
                // Optional: visual indicator?
                inst.color = "red"; // Make them look angry? or just keep same.
            }

            enemies.push(inst);
        }
    }

    // --- LATE BINDING: LORE & SPEECH & ANGRY MODE ---
    enemies.forEach(en => {
        // 0. Ensure MaxHP (for health bars)
        if (!en.maxHp) en.maxHp = en.hp;

        // 1. Generate Lore if missing
        if (!en.lore && loreData) {
            en.lore = generateLore(en);
        }

        // 2. Global Angry Mode (Boss Killed)
        if (bossKilled) {
            en.mode = 'angry';
            en.alwaysAngry = true;
            en.angryUntil = Infinity;

            // Apply Angry Stats immediately
            const angryStats = (gameData.enemyConfig && gameData.enemyConfig.modeStats && gameData.enemyConfig.modeStats.angry) ? gameData.enemyConfig.modeStats.angry : null;

            if (angryStats) {
                if (angryStats.damage) en.damage = (en.baseStats?.damage || en.damage || 1) * angryStats.damage;
                if (angryStats.speed) en.speed = (en.baseStats?.speed || en.speed || 1) * angryStats.speed;
                if (angryStats.color) en.color = angryStats.color;
            }
        }
    });

}

// --- Room Transition Helpers ---

// Position player on opposite side of door (exactly on the boundary and centered on the DOOR)
function spawnPlayer(dx, dy, data) {
    let requiredDoor = null;
    if (dx === 1) requiredDoor = "left";
    if (dx === -1) requiredDoor = "right";
    if (dy === 1) requiredDoor = "top";
    if (dy === -1) requiredDoor = "bottom";

    const door = (data.doors && data.doors[requiredDoor]) || { x: (data.width || 800) / 2, y: (data.height || 600) / 2 };

    // Use a safe offset > the door trigger threshold (t=50)
    const SAFE_OFFSET = 70; // Must be > 50

    if (dx === 1) {
        player.x = BOUNDARY + SAFE_OFFSET;
        player.y = door.y !== undefined ? door.y : (data.height || 600) / 2;
    }
    if (dx === -1) {
        player.x = (data.width || 800) - BOUNDARY - SAFE_OFFSET;
        player.y = door.y !== undefined ? door.y : (data.height || 600) / 2;
    }
    if (dy === 1) {
        player.y = BOUNDARY + SAFE_OFFSET;
        player.x = door.x !== undefined ? door.x : (data.width || 800) / 2;
    }
    if (dy === -1) {
        player.y = (data.height || 600) - BOUNDARY - SAFE_OFFSET;
        player.x = door.x !== undefined ? door.x : (data.width || 800) / 2;
    }
    // --- LATE BINDING: LORE & SPEECH & ANGRY MODE ---
    enemies.forEach(en => {
        // 1. Generate Lore if missing
        if (!en.lore && loreData) {
            en.lore = generateLore(en);
        }

        // 2. Global Angry Mode (Boss Killed)
        if (bossKilled) {
            // Ghosts do NOT get angry
            if (en.type === 'ghost') return;

            en.mode = 'angry';
            en.alwaysAngry = true;
            en.angryUntil = Infinity;

            // Apply Angry Stats immediately
            const angryStats = gameData.enemyConfig?.modeStats?.angry;
            if (angryStats) {
                if (angryStats.damage) en.damage = (en.baseStats?.damage || en.damage || 1) * angryStats.damage;
                if (angryStats.speed) en.speed = (en.baseStats?.speed || en.speed || 1) * angryStats.speed;
                if (angryStats.color) en.color = angryStats.color;
            }
        }
    });
}

function changeRoom(dx, dy) {
    // Save cleared status of current room before leaving
    const currentCoord = `${player.roomX},${player.roomY}`;
    if (levelMap[currentCoord]) {
        // FILTER: Save only valid, living enemies (skip ghosts, dead, friendly)
        const survivors = enemies.filter(en => !en.isDead && en.type !== 'ghost' && en.ownerType !== 'player');

        // If enemies remain, save their state
        if (survivors.length > 0) {
            levelMap[currentCoord].savedEnemies = survivors.map(en => ({
                templateId: en.templateId, // Save the Lookup Key
                type: en.type,
                x: en.x,
                y: en.y,
                hp: en.hp,
                maxHp: en.maxHp, // If applicable
                moveType: en.moveType,
                solid: en.solid,
                indestructible: en.indestructible,
                // Add other necessary props if dynamic (e.g. specialized gun config? usually static)
            }));
            levelMap[currentCoord].cleared = false;
        } else {
            // No survivors? Room is cleared.
            levelMap[currentCoord].savedEnemies = null;
            levelMap[currentCoord].cleared = true;
        }

        // SAVE BOMBS
        // Only save unexploded bombs. We save absolute 'explodeAt' so time passes while away.
        const activeBombs = bombs.filter(b => !b.exploded && b.explodeAt > Date.now());
        if (activeBombs.length > 0) {
            levelMap[currentCoord].savedBombs = activeBombs.map(b => ({
                x: b.x, y: b.y,
                explodeAt: b.explodeAt, // Save Absolute Time
                maxTimer: b.maxTimer,
                damage: b.damage, radius: b.radius,
                color: b.color,
                ownerType: b.ownerType,
                vx: b.vx || 0, vy: b.vy || 0,
                // Visual Properties
                type: b.type,
                timerShow: b.timerShow,
                image: b.image, // If it has an image
                canInteract: b.canInteract,
                openLockedDoors: b.openLockedDoors,
                openRedDoors: b.openRedDoors,
                openSecretRooms: b.openSecretRooms,
                baseR: b.baseR, maxR: b.maxR,
                explosionDuration: b.explosionDuration
            }));
            log(`Saved ${activeBombs.length} bombs in ${currentCoord}`);
        } else {
            levelMap[currentCoord].savedBombs = null;
        }
    }

    // Reset Room Specific Flags
    player.tookDamageInRoom = false;

    // Check if door was locked or recently unlocked by a key
    let doorUsed = null;
    if (dx === 1) doorUsed = "right";
    if (dx === -1) doorUsed = "left";
    if (dy === 1) doorUsed = "bottom";
    if (dy === -1) doorUsed = "top";

    let keyWasUsedForThisRoom = false;
    if (doorUsed && roomData.doors && roomData.doors[doorUsed]) {
        if (roomData.doors[doorUsed].unlockedByKey) {
            keyWasUsedForThisRoom = true;
        }
    }

    player.roomX += dx;
    player.roomY += dy;
    const nextCoord = `${player.roomX},${player.roomY}`;
    roomEl.innerText = nextCoord;

    // --- GOLDEN PATH LOGIC ---
    if (nextCoord === "0,0") {
        // Reset if back at start
        goldenPathIndex = 0;
        goldenPathFailed = false;
        log("Returned to Start. Golden Path Reset.");
    } else if (!goldenPathFailed) {
        // Check if this is the next step in the path
        // path[0] is "0,0". path[1] is the first real step.
        // We want to be at path[goldenPathIndex + 1]
        const expectedCoord = goldenPath[goldenPathIndex + 1];

        if (nextCoord === expectedCoord) {
            goldenPathIndex++;
            log("Golden Path Progress:", goldenPathIndex);
        } else if (goldenPath.includes(nextCoord) && goldenPath.indexOf(nextCoord) <= goldenPathIndex) {
            // Just backtracking along the known path, do nothing
        } else {
            // Deviated!
            goldenPathFailed = true;
            log("Golden Path FAILED. Return to start to reset.");
        }
    }

    bullets = []; // Clear bullets on room entry
    bombs = []; // Clear bombs on room entry

    // RESTORE BOMBS
    if (levelMap[nextCoord] && levelMap[nextCoord].savedBombs) {
        const now = Date.now();
        levelMap[nextCoord].savedBombs.forEach(sb => {
            // "Keep Ticking" Logic:
            // If the bomb exploded while we were away (now > explodeAt), do NOT restore it.
            // (Or restore it as exploding? Usually better to just assume it's gone)
            if (now > sb.explodeAt) {
                // SIMULATED EXPLOSION
                // The bomb exploded while we were away. Check if it should have hit any doors.
                // We need to access the doors of the room we are ABOUT to enter.
                // Fortunately, we can access levelMap[nextCoord].roomData
                const targetRoom = levelMap[nextCoord].roomData;
                if (targetRoom && targetRoom.doors) {
                    // Check Logic similar to drawBombs collision
                    Object.entries(targetRoom.doors).forEach(([dir, door]) => {
                        let dX = door.x ?? (targetRoom.width || 800) / 2;
                        let dY = door.y ?? (targetRoom.height || 600) / 2;
                        if (dir === 'top') dY = 0; if (dir === 'bottom') dY = (targetRoom.height || 600);
                        if (dir === 'left') dX = 0; if (dir === 'right') dX = (targetRoom.width || 800);

                        // Max Radius (approximate if stored, else default)
                        const maxR = sb.maxR || 100;
                        if (Math.hypot(sb.x - dX, sb.y - dY) < maxR + 30) {
                            if (sb.openLockedDoors && door.locked) {
                                door.locked = 0;
                                log(`Simulated Explosion: Unlocked ${dir} door`);
                            }
                            if (sb.openRedDoors) {
                                door.forcedOpen = true;
                                log(`Simulated Explosion: Blew open ${dir} red door`);
                            }
                            if (sb.openSecretRooms && door.hidden) {
                                door.hidden = false;
                                door.active = true;
                                log(`Simulated Explosion: Revealed ${dir} secret door`);
                            }
                        }
                    });
                }
                return;
            }

            bombs.push({
                x: sb.x, y: sb.y,
                explodeAt: sb.explodeAt, // Restore absolute
                maxTimer: sb.maxTimer,
                damage: sb.damage, radius: sb.radius,
                color: sb.color,
                ownerType: sb.ownerType,
                vx: sb.vx, vy: sb.vy,
                exploded: false,
                // Restore Visuals & Props
                type: sb.type,
                timerShow: sb.timerShow,
                image: sb.image,
                canInteract: sb.canInteract,
                openLockedDoors: sb.openLockedDoors,
                openRedDoors: sb.openRedDoors,
                openSecretRooms: sb.openSecretRooms,
                baseR: sb.baseR || 15, maxR: sb.maxR || 100,
                explosionDuration: sb.explosionDuration || 300
            });
        });
        log(`Restored ${bombs.length} bombs in ${nextCoord}`);
    }

    // Check if Ghost should follow
    const ghostConfig = gameData.ghost || { spawn: true, roomGhostTimer: 10000, roomFollow: false };
    const activeGhost = enemies.find(e => e.type === 'ghost' && !e.isDead);
    const shouldFollow = ghostSpawned && ghostConfig.roomFollow && activeGhost;

    // Calculate Travel Time relative to the door we are exiting
    let travelTime = 0;
    if (shouldFollow) {
        // Determine exit door coordinates (where player is going)
        let doorX = player.x, doorY = player.y;
        if (dx === 1) { doorX = canvas.width; doorY = canvas.height / 2; } // Right
        else if (dx === -1) { doorX = 0; doorY = canvas.height / 2; } // Left
        else if (dy === 1) { doorX = canvas.width / 2; doorY = canvas.height; } // Bottom
        else if (dy === -1) { doorX = canvas.width / 2; doorY = 0; } // Top

        const dist = Math.hypot(activeGhost.x - doorX, activeGhost.y - doorY);
        // Speed ~1.2px/frame @ 60fps ~ 0.072px/ms -> ms = dist / 0.072 = dist * 13.8
        travelTime = dist * 14;
        log(`Ghost chasing! Distance: ${Math.round(dist)}, Travel Delay: ${Math.round(travelTime)}ms`);
    }

    ghostSpawned = false; // Reset Ghost flag (will respawn via timer hack if following)
    bulletsInRoom = 0;
    hitsInRoom = 0;
    perfectEl.style.display = 'none';

    // Transition to the pre-generated room
    const nextEntry = levelMap[nextCoord];
    if (nextEntry) {
        roomData = nextEntry.roomData;
        visitedRooms[nextCoord] = nextEntry; // Add to visited for minimap

        roomNameEl.innerText = roomData.name || "Unknown Room";
        canvas.width = roomData.width || 800;
        canvas.height = roomData.height || 600;

        spawnPlayer(dx, dy, roomData);

        // REMOVE OLD FREEZE LOGIC
        // let freezeDelay = (player.roomX === 0 && player.roomY === 0) ? 0 : 1000;
        // if (roomData.isBoss) freezeDelay = 2000;

        // NEW ROOM FREEZE MECHANIC
        // "freezeTimer" config (default 2000ms), applies to Player Invuln AND Enemy Freeze
        const freezeDuration = (gameData.room && gameData.room.freezeTimer) ? gameData.room.freezeTimer : 2000;

        // Skip freeze only for very first start room if desired (optional, maybe keep it consistent)
        // const actualDuration = (player.roomX === 0 && player.roomY === 0) ? 0 : freezeDuration;
        const actualDuration = freezeDuration; // Use config consistently

        const now = Date.now();
        roomFreezeUntil = now + actualDuration;
        player.invulnUntil = roomFreezeUntil;
        roomStartTime = roomFreezeUntil; // Ghost timer starts AFTER freeze ends

        log(`Room Freeze Active: ${actualDuration}ms (Enemies Frozen, Player Invulnerable)`);

        // GHOST FOLLOW LOGIC
        // If ghost was chasing and follow is on, fast-forward the timer so he appears immediately
        if (shouldFollow && !(player.roomX === 0 && player.roomY === 0) && !roomData.isBoss) {
            log("The Ghost follows you...");
            // Trigger time = desired spawn time
            // roomStartTime = Now - (ConfigTime - TravelTime)
            // Example: Config=10s, Travel=2s. We want spawn in 2s.
            // Timer checks: (Now - Start) > 10s.
            // (Now - Start) should start at 8s.
            // Start = Now - 8s = Now - (10s - 2s).
            // We add 100ms buffer to ensure it triggers after the frame update
            // Actually, if we want it to spawn AFTER travel time, we set the accumulator to (Target - Travel).

            const timeAlreadyElapsed = ghostConfig.roomGhostTimer - travelTime;
            // Clamp so we don't wait forever if travel is huge (max delay 3x timer?) or negative?
            // If travelTime > ghostTimer, timeAlreadyElapsed is negative, so we wait longer than usual. Correct.

            roomStartTime = Date.now() - timeAlreadyElapsed;

            // Set Ghost Entry Point (The door we just came through)
            // Player is currently AT the door (spawnPlayer just ran)
            ghostEntry = {
                x: player.x,
                y: player.y,
                vx: dx * 2, // Move in the same direction player entered
                vy: dy * 2
            };
        } else {
            ghostEntry = null;
        }

        keyUsedForRoom = keyWasUsedForThisRoom; // Apply key usage penalty to next room

        // Immediate Room Bonus if key used
        // Immediate Room Bonus if key used (First visit only)
        if (keyUsedForRoom && !levelMap[nextCoord].bonusAwarded) {
            // Use game.json bonuses.key config
            if (gameData.bonuses && gameData.bonuses.key) {
                const dropped = spawnRoomRewards(gameData.bonuses.key); // Try to spawn rewards

                if (dropped) {
                    levelMap[nextCoord].bonusAwarded = true; // Mark bonus as awarded
                    perfectEl.innerText = "KEY BONUS!"; // Renamed from Room Bonus
                    perfectEl.style.display = 'block';
                    perfectEl.style.animation = 'none';
                    perfectEl.offsetHeight; /* trigger reflow */
                    perfectEl.style.animation = null;
                    setTimeout(() => perfectEl.style.display = 'none', 2000);
                }
            }
        }

        // If you enter a room through a door, it must be open (unlocked)
        if (roomData.doors) {
            const entryDoor = dx === 1 ? "left" : (dx === -1 ? "right" : (dy === 1 ? "top" : "bottom"));
            if (roomData.doors[entryDoor]) {
                roomData.doors[entryDoor].locked = 0;
                // Force active so the door exists (fixes Boss Room issue where defaults are 0)
                roomData.doors[entryDoor].active = 1;
                roomData.doors[entryDoor].hidden = false;
            }
        }
        if (roomData.isBoss && !nextEntry.cleared) {
            bossIntroEndTime = Date.now() + 2000;
        }

        // --- GOLDEN PATH BONUS ---
        if (roomData.isBoss && !goldenPathFailed && !nextEntry.goldenBonusAwarded) {
            nextEntry.goldenBonusAwarded = true;
            log("GOLDEN PATH BONUS AWARDED!");

            perfectEl.innerText = "GOLDEN PATH BONUS!";
            perfectEl.style.color = "gold";
            perfectEl.style.display = 'block';
            perfectEl.style.animation = 'none';
            perfectEl.offsetHeight; /* trigger reflow */
            perfectEl.style.animation = null;

            // Reward
            player.inventory.bombs += 10;
            player.inventory.keys += 3;
            player.hp = Math.min(player.hp + 2, 10); // Heal

            setTimeout(() => {
                perfectEl.style.display = 'none';
                perfectEl.style.color = '#e74c3c'; // Reset
            }, 4000);
        }



        if (!nextEntry.cleared) {
            spawnEnemies();
        } else {
            enemies = [];
        }
        updateUI();
        renderDebugForm(); // Refresh form for new room
    } else {
        console.error("Critical: Room not found in levelMap at", nextCoord);
        // Fallback: stay in current room but reset coords
        player.roomX -= dx;
        player.roomY -= dy;
    }
}

async function dropBomb() {
    // Parse Timer Config
    let timerDuration = 1000;
    let timerShow = false;
    if (typeof bomb.timer === 'object') {
        timerDuration = bomb.timer.time || 1000;
        timerShow = !!bomb.timer.show;
        if (bomb.timer.active === false) timerDuration = Infinity;
    } else {
        timerDuration = bomb.timer || 1000;
    }

    const baseR = bomb.size || 20;
    const maxR = bomb.explosion?.radius || bomb.radius || 120;
    const gap = 6;
    const backDist = player.size + baseR + gap;

    const isMoving = (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']);
    const isShooting = (keys['ArrowUp'] || keys['ArrowLeft'] || keys['ArrowDown'] || keys['ArrowRight']);

    // Determine Drop Direction (Facing)
    let dirX = 0;
    let dirY = 0;

    if (isMoving) {
        // Use Movement Direction
        if (keys['KeyW']) dirY = -1;
        if (keys['KeyS']) dirY = 1;
        if (keys['KeyA']) dirX = -1;
        if (keys['KeyD']) dirX = 1;
        // Normalize diagonals not strictly needed for grid offset here but keeps it clean? 
        // Logic just adds components. 
    } else if (isShooting) {
        // Use Shooting Direction
        if (keys['ArrowUp']) dirY = -1;
        if (keys['ArrowDown']) dirY = 1;
        if (keys['ArrowLeft']) dirX = -1;
        if (keys['ArrowRight']) dirX = 1;
    } else {
        // Fallback to Last Moved
        dirX = (player.lastMoveX === undefined && player.lastMoveY === undefined) ? 0 : (player.lastMoveX || 0);
        dirY = (player.lastMoveX === undefined && player.lastMoveY === undefined) ? 1 : (player.lastMoveY || 0);
    }

    let dropX, dropY, dropVx = 0, dropVy = 0;

    if (isMoving) {
        // MOVING: Drop Behind
        dropX = player.x - (dirX * backDist);
        dropY = player.y - (dirY * backDist);

        dropVx = dirX * 2;
        dropVy = dirY * 2;
    } else {
        // STATIONARY: Drop IN FRONT (Pushable)
        dropX = player.x + (dirX * backDist);
        dropY = player.y + (dirY * backDist);
        log(`Stationary Drop. Facing: ${dirX},${dirY}. Player: ${player.x.toFixed(0)},${player.y.toFixed(0)}. Drop: ${dropX.toFixed(0)},${dropY.toFixed(0)}`);
    }

    // Check if drop position overlaps with an existing bomb
    let canDrop = true;
    for (const b of bombs) {
        const dist = Math.hypot(dropX - b.x, dropY - b.y);
        if (dist < (b.baseR || 15) * 2) {
            canDrop = false;
            break;
        }
    }
    // Also check walls
    // Fix: If wall blocked, Clamp bomb to wall and Push Player back
    if (dropX < BOUNDARY || dropX > canvas.width - BOUNDARY || dropY < BOUNDARY || dropY > canvas.height - BOUNDARY) {
        // Only engage push logic if not moving (Stationary drop)
        if (!isMoving) {
            // Clamp Bomb and Determine Push Direction
            let pushAngle = 0;
            let clamped = false;

            if (dropX < BOUNDARY) {
                dropX = BOUNDARY + baseR;
                pushAngle = 0; // Push Right
                clamped = true;
            } else if (dropX > canvas.width - BOUNDARY) {
                dropX = canvas.width - BOUNDARY - baseR;
                pushAngle = Math.PI; // Push Left
                clamped = true;
            }

            if (dropY < BOUNDARY) {
                dropY = BOUNDARY + baseR;
                pushAngle = Math.PI / 2; // Push Down
                clamped = true;
            } else if (dropY > canvas.height - BOUNDARY) {
                dropY = canvas.height - BOUNDARY - baseR;
                pushAngle = -Math.PI / 2; // Push Up
                clamped = true;
            }

            // Push Player (Force away from wall)
            if (clamped) {
                const pushDist = backDist + 5;
                player.x = dropX + Math.cos(pushAngle) * pushDist;
                player.y = dropY + Math.sin(pushAngle) * pushDist;

                player.x = Math.max(BOUNDARY + player.size, Math.min(canvas.width - BOUNDARY - player.size, player.x));
                player.y = Math.max(BOUNDARY + player.size, Math.min(canvas.height - BOUNDARY - player.size, player.y));

                canDrop = true;
                log(`Wall Clamp. Pushed player to ${player.x.toFixed(0)},${player.y.toFixed(0)}`);
            } else {
                canDrop = false;
            }
        } else {
            // Moving and hit wall -> Block drop
            canDrop = false;
        }
    }

    if (!canDrop) return false;

    // Check Delay
    const bombDelay = (bomb?.fireRate !== undefined ? bomb?.fireRate : 0.3) * 1000;
    if (Date.now() - (player.lastBomb || 0) > bombDelay) {

        // Log for debug
        log(`Dropping Bomb. Show: ${timerShow}, Duration: ${timerDuration}, Active: ${bomb.timer?.active}`);

        bombsInRoom++;
        bombs.push({
            x: dropX,
            y: dropY,

            baseR,
            maxR,

            colour: bomb.colour || "white",
            damage: bomb.damage || 1,
            canDamagePlayer: !!(bomb.explosion?.canDamagePlayer ?? bomb.canDamagePlayer),
            remoteDenoate: bomb.remoteDenoate,
            canInteract: bomb.canInteract,
            timerShow: timerShow,

            // Physical Properties
            solid: bomb.solid,
            moveable: bomb.moveable,
            physics: bomb.physics,
            vx: dropVx, vy: dropVy, // Use calculated velocity

            // Doors
            openLockedDoors: bomb.doors?.openLockedDoors ?? bomb.openLockedDoors,
            openRedDoors: bomb.doors?.openRedDoors ?? bomb.openRedDoors,
            openSecretRooms: bomb.doors?.openSecretRooms ?? bomb.openSecretRooms,

            canShoot: bomb.canShoot,

            explodeAt: Date.now() + timerDuration,
            exploding: false,
            explosionStartAt: 0,
            explosionDuration: bomb.explosion?.explosionDuration || bomb.explosionDuration || 300,
            explosionColour: bomb.explosion?.explosionColour || bomb.explosionColour || bomb.colour || "white",
            didDamage: false,
            id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
            triggeredBy: null,
        });

        // --- NUDGE LOGIC ---
        // If we spawned inside an enemy, push it out!
        const lastBomb = bombs[bombs.length - 1];
        enemies.forEach(en => {
            if (en.isDead) return;
            const dx = lastBomb.x - en.x;
            const dy = lastBomb.y - en.y;
            const dist = Math.hypot(dx, dy);
            // Check overlap
            if (dist < (lastBomb.baseR || 15) + en.size) {
                // Push Away
                const pushForce = 5.0; // Strong nudge
                if (dist > 0) {
                    lastBomb.vx += (dx / dist) * pushForce;
                    lastBomb.vy += (dy / dist) * pushForce;
                } else {
                    // Perfectly centered? Randomize
                    lastBomb.vx += (Math.random() - 0.5) * pushForce;
                    lastBomb.vy += (Math.random() - 0.5) * pushForce;
                }
                log("Bomb nuked away from enemy overlap!");
            }
        });

        SFX.click(0.1);
        player.lastBomb = Date.now();
        return true;
    }
    return false;
}



// Global Helper for spawning bullets (Player OR Enemy)
function spawnBullet(x, y, vx, vy, weaponSource, ownerType = "player", owner = null) {
    const bulletConfig = weaponSource.Bullet || {};

    // Determine shape
    let bulletShape = bulletConfig.geometry?.shape || "circle";
    if (bulletShape === 'random' && bulletConfig.geometry?.shapes?.length > 0) {
        const possibleShapes = bulletConfig.geometry.shapes;
        bulletShape = possibleShapes[Math.floor(Math.random() * possibleShapes.length)];
    }

    const b = {
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        life: bulletConfig.range || 60,
        damage: bulletConfig.damage || 1,
        size: (bulletConfig.size || 5),
        curve: bulletConfig.curve || 0,
        homing: bulletConfig.homing,
        canDamagePlayer: bulletConfig.canDamagePlayer || false,
        hasLeftPlayer: false,
        shape: bulletShape,
        animated: bulletConfig.geometry?.animated || false,
        filled: bulletConfig.geometry?.filled !== undefined ? bulletConfig.geometry.filled : true,
        colour: bulletConfig.colour || "yellow",
        spinAngle: 0,
        hitEnemies: [],
        ownerType: ownerType // 'player' or 'enemy'
    };

    if (ownerType === 'enemy') {
        b.hasLeftPlayer = true; // No safety buffer needed for player
        // Optional: Safety buffer for the enemy who shot it?
    }

    bullets.push(b);
    return b;
}

function fireBullet(direction, speed, vx, vy, angle) {
    // 1. Safety check / No Bullets Mode
    if (gun.Bullet?.NoBullets) {
        const now = Date.now();
        if (now - (player.lastClick || 0) > 200) {
            SFX.click();
            player.lastClick = now;
        }
        return;
    }

    // Ammo Check
    if (gun.Bullet?.ammo?.active) {
        if (player.reloading) return;
        if (player.ammo <= 0) {
            if (player.ammoMode === 'finite') return;
            if (player.ammoMode === 'reload' && player.reserveAmmo <= 0) return;
            reloadWeapon();
            return;
        }
        player.ammo--;
        if (player.ammo <= 0) {
            if (player.reserveAmmo > 0 || player.ammoMode === 'recharge') {
                reloadWeapon();
            }
        }
    }

    // Helper to spawn bullet with correct offset
    const spawn = (bvx, bvy) => {
        const barrelLength = player.size + 10;
        const bAngle = Math.atan2(bvy, bvx);
        const startX = player.x + Math.cos(bAngle) * barrelLength;
        const startY = player.y + Math.sin(bAngle) * barrelLength;
        spawnBullet(startX, startY, bvx, bvy, gun, "player");
    };

    // 2. Spawning
    if (direction === 0) {
        spawn(vx, vy);
        if (gun.Bullet?.reverseFire) spawn(-vx, -vy);

        // MultiDirectional Logic
        if (gun.Bullet?.multiDirectional?.active) {
            const md = gun.Bullet.multiDirectional;
            if (md.fireNorth) spawn(0, -speed);
            if (md.fireEast) spawn(speed, 0);
            if (md.fireSouth) spawn(0, speed);
            if (md.fireWest) spawn(-speed, 0);
            if (md.fire360) {
                for (let i = 0; i < 360; i += 10) {
                    const rad = i * Math.PI / 180;
                    spawn(Math.cos(rad) * speed, Math.sin(rad) * speed);
                }
            }
        }
    }
    else if (direction === 360) {
        for (let i = 0; i < 360; i += 10) {
            const rad = i * Math.PI / 180;
            spawn(Math.cos(rad) * speed, Math.sin(rad) * speed);
        }
    }
    else if (direction === 1) { // North
        spawn(0, -speed);
        if (gun.Bullet?.reverseFire) spawn(0, speed);
    }
    else if (direction === 2) { // East
        spawn(speed, 0);
        if (gun.Bullet?.reverseFire) spawn(-speed, 0);
    }
    else if (direction === 3) { // South
        spawn(0, speed);
        if (gun.Bullet?.reverseFire) spawn(0, -speed);
    }
    else if (direction === 4) { // West
        spawn(-speed, 0);
        if (gun.Bullet?.reverseFire) spawn(speed, 0);
    }

    bulletsInRoom++;
    bulletsInRoom++;

    // --- RECOIL ---
    const recoil = gun.Bullet?.recoil || 0;
    if (recoil > 0) {
        if (direction === 0) {
            // Mouse aiming - approximate recoil? Or just skip? 
            // For now, let's skip mouse recoil or calculate reverse vector
            const len = Math.hypot(vx, vy);
            if (len > 0) {
                player.x -= (vx / len) * recoil;
                player.y -= (vy / len) * recoil;
            }
        } else if (direction === 1) { // North
            player.y += recoil;
        } else if (direction === 2) { // East
            player.x -= recoil;
        } else if (direction === 3) { // South
            player.y -= recoil;
        } else if (direction === 4) { // West
            player.x += recoil;
        }

        // Wall collision check for player after recoil
        if (player.x < 50) player.x = 50;
        if (player.x > canvas.width - 50) player.x = canvas.width - 50;
        if (player.y < 50) player.y = 50;
        if (player.y > canvas.height - 50) player.y = canvas.height - 50;
    }
}

function reloadWeapon() {
    if (player.reloading) return;
    if (player.ammoMode === 'finite') return; // No reload for finite mode

    player.reloading = true;
    player.reloadStart = Date.now();
    player.reloadDuration = player.reloadTime || 1000;

    log("Reloading...");
    // Optional: Add sound here
    // SFX.reload(); 
}

// update loop
function update() {
    // 0. STOP updates if loading/initializing OR unlocking to prevent movement during transition
    if (isInitializing || isUnlocking) return;

    // 0. Global Inputs (Restart/Menu from non-play states)
    if (handleGlobalInputs()) return;

    // Music Toggle (Global) - Allow toggling in Start, Play, etc.
    updateMusicToggle();

    // 1. If already dead, stop all logic
    if (gameState === STATES.GAMEOVER || gameState === STATES.WIN) return;

    // 2. TRIGGER GAME OVER
    if (player.hp <= 0) {

        player.hp = 0; // Prevent negative health
        updateUI();    // Final UI refresh
        gameOver();    // Trigger your overlay function
        return;        // Exit loop
    }
    if (gameState !== STATES.PLAY) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    updateItems(); // Check for item pickups
    updateFloatingTexts(); // Animate floating texts

    //const now = Date.now(); // Check for item pickups

    // const roomLocked = aliveEnemies.length > 0;
    const roomLocked = isRoomLocked();

    // DETAIL: Trigger Ghost Speech on Door Close (Transition Unlocked -> Locked)
    if (roomLocked && !wasRoomLocked) {
        // Find active Ghost
        const ghost = enemies.find(en => en.type === 'ghost' && !en.isDead);
        if (ghost) {
            triggerSpeech(ghost, 'ghost_doors_close', null, true);
        }
    }
    // DETAIL: Green Shards on Room Clear (Locked -> Unlocked)
    else if (!roomLocked && wasRoomLocked) {
        // Award Green Shards
        // Amount = Hardness + Random(0-Hardness)
        const base = gameData.hardness || 1;
        const reward = Math.ceil(base + Math.random() * base);
        // addGreenShards(reward); // OLD INTANT ADD
        spawnShard(player.x, player.y, 'green', reward); // Drop at player feet? Or center? Player feet is rewarding.
    }
    wasRoomLocked = roomLocked;

    const aliveEnemies = enemies.filter(en => !en.isDead); // Keep for homing logic
    const doors = roomData.doors || {};

    // 1. Inputs & Music
    updateRestart();
    // updateMusicToggle(); // Moved up
    updateRemoteDetonation(); // Remote Bombs - Check BEFORE Use consumes space
    updateBombInteraction(); // Kick/Interact with Bombs
    if (keys["Space"]) updateUse();
    if (keys["KeyP"] && gameData.pause !== false) {
        keys["KeyP"] = false; // Prevent repeated triggers
        gameMenu();
        return;
    }

    // 2. World Logic
    // FORCE ROOM FREEZE IMMUNITY
    // Ensure player immunity matches room freeze (prevents resets)
    if (Date.now() < roomFreezeUntil) {
        player.invulnUntil = Math.max(player.invulnUntil || 0, roomFreezeUntil);
    }

    updateRoomLock();
    updateBombDropping();
    checkRemoteExplosions(); // Check for off-screen booms
    updateBombsPhysics(); // Bomb Physics (Push/Slide)
    updateMovementAndDoors(doors, roomLocked);

    // 3. Combat Logic
    updateShooting();
    // updateRemoteDetonation(); // moved up
    updateReload(); // Add reload state check
    updateBulletsAndShards(aliveEnemies); // Pass enemies for homing check
    updateEnemies(); // Enemy movement + player collision handled inside

    // 4. Transitions
    updateRoomTransitions(doors, roomLocked);

    // Shield Regen
    updateShield();

    updatePortal();
    updateGhost(); // Check for ghost spawn
}

function updateReload() {
    if (player.reloading) {
        const now = Date.now();
        if (now - player.reloadStart >= player.reloadDuration) {
            // Reload Complete
            if (player.ammoMode === 'recharge') {
                player.ammo = player.maxMag;
            } else {
                const needed = player.maxMag - player.ammo;
                const take = Math.min(needed, player.reserveAmmo);
                player.ammo += take;
                if (player.ammoMode === 'reload') player.reserveAmmo -= take;
            }

            player.reloading = false;
            log("Reloaded!");
        }
    }
}

//draw loop
async function draw() {
    if (isInitializing) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(() => { draw(); });
        return;
    }
    const aliveEnemies = enemies.filter(en => !en.isDead);
    const roomLocked = isRoomLocked();
    const doors = roomData.doors || {};
    await updateUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawShake()
    drawDoors()
    drawBossSwitch() // Draw switch underneath entities
    drawPlayer()
    drawBulletsAndShards()
    drawBombs(doors)
    drawItems() // Draw ground items
    drawEnemies()
    if (screenShake.power > 0) ctx.restore();

    // --- PARTICLES ---
    if (typeof particles !== 'undefined') {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color || "white";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (p.vx) p.x += p.vx;
            if (p.vy) p.y += p.vy;

            p.life -= 0.05; // Decay
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    drawMinimap();
    drawTutorial();
    drawBossIntro();
    drawPortal();
    drawFloatingTexts(); // Draw notification texts on top
    drawDebugLogs();
    requestAnimationFrame(() => { update(); draw(); });
}

function drawPortal() {
    // Only draw if active AND in the boss room
    if (!portal.active || !roomData.isBoss) return;
    const time = Date.now() / 500;

    ctx.save();
    ctx.translate(portal.x, portal.y);

    // Outer glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#8e44ad";

    // Portal shape
    ctx.fillStyle = "#8e44ad";
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // Swirl effect
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 + Math.sin(time) * 5, 40 + Math.cos(time) * 5, time, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function drawBossSwitch() {
    if (!roomData.isBoss) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = 40; // Smaller to be hidden by portal

    ctx.save();
    ctx.fillStyle = "#9b59b6"; // Purple
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);

    // Optional: Add a border or inner detail to look like a switch plate
    ctx.strokeStyle = "#8e44ad";
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

    ctx.restore();
}

function updateMusicToggle() {
    // If music is disabled in config, do not allow toggling
    if (!gameData.music) return;

    if (keys['Digit0']) {
        const now = Date.now();
        // 300ms cooldown so it doesn't toggle every frame
        if (now - lastMusicToggle > 300) {
            if (introMusic.paused) {
                introMusic.play();
                musicMuted = false;
                log("Music Playing");
            } else {
                introMusic.pause();
                musicMuted = true;
                log("Music Paused");
            }
            lastMusicToggle = now;
        }
    }
}

function updateRoomTransitions(doors, roomLocked) {

    // --- 8. ROOM TRANSITIONS ---
    // --- 8. ROOM TRANSITIONS ---
    // Increased threshold to account for larger player sizes (Triangle=20)
    const t = 50;

    // Debug Door Triggers
    if (player.x < t + 10 && doors.left?.active) {
        // log(`Left Door Check: X=${Math.round(player.x)} < ${t}? Locked=${doors.left.locked}, RoomLocked=${roomLocked}`);
    }

    // Constraint for center alignment
    // Only allow transition if player is roughly in front of the door
    const doorW = 50; // Half-width tolerance (Total 100px)

    // Allow transition if room is unlocked OR if the specific door is forced open (red door blown)
    if (player.x < t && doors.left?.active) {
        if (Math.abs(player.y - canvas.height / 2) < doorW) {
            if (!doors.left.locked && (!roomLocked || doors.left.forcedOpen)) changeRoom(-1, 0);
            else log("Left Door Blocked: Locked or Room Locked");
        }
    }
    else if (player.x > canvas.width - t && doors.right?.active) {
        if (Math.abs(player.y - canvas.height / 2) < doorW) {
            if (!doors.right.locked && (!roomLocked || doors.right.forcedOpen)) changeRoom(1, 0);
            else log("Right Door Blocked: Locked or Room Locked");
        }
    }
    else if (player.y < t && doors.top?.active) {
        if (Math.abs(player.x - canvas.width / 2) < doorW) {
            if (!doors.top.locked && (!roomLocked || doors.top.forcedOpen)) changeRoom(0, -1);
            else log("Top Door Blocked: Locked or Room Locked");
        }
    }
    else if (player.y > canvas.height - t && doors.bottom?.active) {
        if (Math.abs(player.x - canvas.width / 2) < doorW) {
            if (!doors.bottom.locked && (!roomLocked || doors.bottom.forcedOpen)) changeRoom(0, 1);
            else log("Bottom Door Blocked: Locked or Room Locked");
        }
    }
}

function isRoomLocked() {
    // Alive enemies that are NOT indestructible
    const aliveEnemies = enemies.filter(en => !en.isDead && !en.indestructible);
    let isLocked = false;
    const nonGhostEnemies = aliveEnemies.filter(en => en.type !== 'ghost');

    if (nonGhostEnemies.length > 0) {
        // Normal enemies always lock
        isLocked = true;
    } else if (aliveEnemies.length > 0) {
        // Only ghosts remain
        const ghostConfig = gameData.ghost || { spawn: true, roomGhostTimer: 10000 };
        const now = Date.now();
        const elapsed = now - roomStartTime;
        const limit = ghostConfig.roomGhostTimer * 2;

        // Debug once per second (approx) to avoid spam
        if (Math.random() < 0.01) {
            // log(`Ghost Lock Check: Elapsed ${Math.round(elapsed)} vs Limit ${limit}`);
        }

        // Lock if time > 2x ghost timer
        if (elapsed > limit) {
            isLocked = true;
            if (Math.random() < 0.05) {
                log(`LOCKED! Elapsed: ${Math.round(elapsed)} > Limit: ${limit}`);
                log(`Diagnostics: Now=${now}, Start=${roomStartTime}, ConfigTimer=${ghostConfig.roomGhostTimer}`);
            }
        }
    }
    return isLocked;
}

function updateRoomLock() {
    // --- 2. ROOM & LOCK STATUS ---
    const roomLocked = isRoomLocked();
    const doors = roomData.doors || {};

    if (!roomLocked && !roomData.cleared) {
        roomData.cleared = true;
        const currentCoord = `${player.roomX},${player.roomY}`; // Fixed space typo
        if (visitedRooms[currentCoord]) visitedRooms[currentCoord].cleared = true;

        // Trigger Room Rewards
        if (roomData.item) {
            spawnRoomRewards(roomData.item);
        }

        // --- SPEEDY BONUS ---
        // Check if room cleared quickly (e.g. within 5 seconds)
        // Hardcoded to 5s if speedyGoal not in logic (using local var here)
        const timeTakenMs = Date.now() - roomStartTime;
        // Default to 5000 if undefined, but explicit 0 means 0 (no bonus)
        const speedyLimitMs = (roomData.speedGoal !== undefined) ? roomData.speedGoal : 5000;

        if (speedyLimitMs > 0 && timeTakenMs <= speedyLimitMs) {
            if (gameData.bonuses && gameData.bonuses.speedy) {
                const dropped = spawnRoomRewards(gameData.bonuses.speedy);
                if (dropped) {
                    perfectEl.innerText = "SPEEDY BONUS!";
                    triggerPerfectText();
                }
            }
        }

        // --- PERFECT BONUS (STREAK) ---
        // Check if no damage taken in this room AND room had enemies
        const hasCombat = roomData.enemies && roomData.enemies.some(e => (e.count || 0) > 0);

        if (!player.tookDamageInRoom && hasCombat) {
            perfectStreak++;
            const goal = gameData.perfectGoal || 3;

            if (perfectStreak >= goal) {
                // Check drop config
                if (gameData.bonuses && gameData.bonuses.perfect) {
                    const dropped = spawnRoomRewards(gameData.bonuses.perfect);
                    if (dropped) {
                        perfectEl.innerText = "PERFECT BONUS!";
                        triggerPerfectText();
                        // Reset or Reduce? "only kick in if this is met" likely means reset to start new streak
                        perfectStreak = 0;
                    }
                }
            }
        } else {
            perfectStreak = 0; // Reset streak if hit
        }
    }
}

// Helper to show/hide the big text
function triggerPerfectText() {
    perfectEl.style.display = 'block';
    perfectEl.style.animation = 'none';
    perfectEl.offsetHeight;
    perfectEl.style.animation = null;
    setTimeout(() => perfectEl.style.display = 'none', 2000);
}


function spawnRoomRewards(dropConfig, label = null) {
    if (!window.allItemTemplates) return false;
    // Debug MaxDrop
    if (dropConfig.maxDrop !== undefined) {
        log(`spawnRoomRewards: maxDrop=${dropConfig.maxDrop} for`, dropConfig);
    }

    let anyDropped = false;
    const pendingDrops = [];

    // 1. Collect all POTENTIAL drops based on chances
    Object.keys(dropConfig).forEach(rarity => {
        // Skip special keys like "maxDrop"
        if (rarity === "maxDrop") return;

        const conf = dropConfig[rarity];
        if (!conf) return;

        // Roll for drop
        if (Math.random() < (conf.dropChance || 0)) {
            // Find items of this rarity
            const candidates = window.allItemTemplates.filter(i => (i.rarity || 'common').toLowerCase() === rarity.toLowerCase() && i.starter === false && i.special !== true);

            if (candidates.length > 0) {
                const count = conf.count || 1;
                for (let i = 0; i < count; i++) {
                    const item = candidates[Math.floor(Math.random() * candidates.length)];
                    pendingDrops.push({ item: item, rarity: rarity }); // Store for later
                }
            }
        }
    });

    // 2. Apply maxDrop limit
    if (dropConfig.maxDrop !== undefined && pendingDrops.length > dropConfig.maxDrop) {
        // Shuffle pendingDrops to randomly select which ones pass
        for (let i = pendingDrops.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pendingDrops[i], pendingDrops[j]] = [pendingDrops[j], pendingDrops[i]];
        }
        // Trim to maxDrop
        pendingDrops.length = dropConfig.maxDrop;
    }

    if (dropConfig.maxDrop !== undefined) {
        log(`spawnRoomRewards: Final pending count: ${pendingDrops.length}`);
    }

    // 2.5 Handle "Special" Drops (Array of Paths)
    if (dropConfig.special && Array.isArray(dropConfig.special)) {
        dropConfig.special.forEach(path => {
            (async () => {
                try {
                    // Normalize path: Ensure no double slashed, but handle simple relative paths
                    const url = path;
                    const res = await fetch(`${url}?t=${Date.now()}`);
                    if (res.ok) {
                        const itemData = await res.json();
                        // Spawn Logic
                        let dropX = (canvas.width / 2) + (Math.random() - 0.5) * 50;
                        let dropY = (canvas.height / 2) + (Math.random() - 0.5) * 50;

                        // Avoid Portal (if active & same room)
                        // Note: Portal usually spawns at center or specific spot.
                        if (portal.active && roomData.isBoss) {
                            const dist = Math.hypot(dropX - portal.x, dropY - portal.y);
                            if (dist < 80) {
                                // Push away
                                const angle = Math.atan2(dropY - portal.y, dropX - portal.x);
                                dropX = portal.x + Math.cos(angle) * 100;
                                dropY = portal.y + Math.sin(angle) * 100;
                            }
                        }

                        groundItems.push({
                            x: dropX,
                            y: dropY,
                            data: itemData,
                            roomX: player.roomX, roomY: player.roomY,
                            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
                            friction: 0.9, solid: true, moveable: true, size: 15, floatOffset: Math.random() * 100
                        });
                        log("Spawned Special Item:", itemData.name);
                        spawnFloatingText(canvas.width / 2, canvas.height / 2 - 60, "SPECIAL DROP!", "#e74c3c");
                    } else {
                        console.error("Failed to fetch special item:", url);
                    }
                } catch (e) { console.error("Error spawning special item:", e); }
            })();
            anyDropped = true;
        });
    }

    // 3. Spawn the final list
    pendingDrops.forEach(drop => {
        const item = drop.item;

        // CHECK DUPLICATE (Red Shard Conversion)
        // If an item with this name already exists in the room, convert to Red Shards
        const isDuplicate = groundItems.some(g =>
            g.roomX === player.roomX && g.roomY === player.roomY &&
            g.data && g.data.name === item.name
        );

        if (isDuplicate) {
            const shardReward = 5; // Small amount
            spawnFloatingText(player.x, player.y - 60, "DUPLICATE ITEM", "#e74c3c");
            // addRedShards(shardReward); // OLD
            // Spawn at the location the item WOULD have dropped
            // We don't have exact drop coords yet in the loop for the pending drops, 
            // but we calcuated them inside the loop? 
            // Wait, the loop calculates dropX/dropY AFTER this check?
            // No, the check is inside the loop? 
            // Ah, I added the check at the start of the loop item block.
            // I need to decide where to spawn it.
            // I'll spawn it near the player for now, or calculate a safe spot.
            // Let's spawn near player to be safe.
            spawnShard(player.x, player.y - 20, 'red', shardReward);
            return; // Skip spawn
        }

        log(`Room Clear Reward: Dropping ${drop.rarity} item: ${item.name}`);

        // Drop Logic (Clamp to Safe Zone & Prevent Overlap)
        const marginX = canvas.width * 0.2;
        const marginY = canvas.height * 0.2;
        const safeW = canvas.width - (marginX * 2);
        const safeH = canvas.height - (marginY * 2);

        let dropX, dropY;
        let valid = false;
        const minDist = 40; // Avoid overlapping items

        for (let attempt = 0; attempt < 10; attempt++) {
            dropX = marginX + Math.random() * safeW;
            dropY = marginY + Math.random() * safeH;

            // Check collision with existing items in this room
            const overlap = groundItems.some(i => {
                if (i.roomX !== player.roomX || i.roomY !== player.roomY) return false;
                return Math.hypot(i.x - dropX, i.y - dropY) < minDist;
            });

            // Check collision with Portal (if active)
            let portalOverlap = false;
            if (portal.active && roomData.isBoss) {
                const pDist = Math.hypot(dropX - portal.x, dropY - portal.y);
                if (pDist < 80) portalOverlap = true;
            }

            if (!overlap && !portalOverlap) {
                valid = true;
                break;
            }
        }

        groundItems.push({
            x: dropX, y: dropY,
            data: item,
            roomX: player.roomX, roomY: player.roomY,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            friction: 0.9,
            solid: true, moveable: true, size: 15,
            floatOffset: Math.random() * 100
        });

        anyDropped = true;

        // If a label was passed (e.g. "KEY BONUS"), show it!
        if (label) {
            spawnFloatingText(dropX, dropY - 20, label, "#FFD700"); // Gold text
        }
    });

    return anyDropped;
}

function drawShake() {
    const now = Date.now();
    // 1. --- SHAKE ---
    if (screenShake.power > 0 && now < screenShake.endAt) {
        ctx.save();
        const s = screenShake.power * ((screenShake.endAt - now) / 180);
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
}

function drawDoors() {
    const roomLocked = isRoomLocked();
    const doors = roomData.doors || {};
    Object.entries(doors).forEach(([dir, door]) => {
        if (!door.active || door.hidden) return;

        let color = "#222"; // default open
        if (roomLocked && !door.forcedOpen) color = "#c0392b"; // red if locked by enemies (and not forced)
        else if (door.locked) color = "#f1c40f"; // yellow if locked by key

        ctx.fillStyle = color;
        const dx = door.x ?? canvas.width / 2, dy = door.y ?? canvas.height / 2;
        if (dir === 'top') ctx.fillRect(dx - DOOR_SIZE / 2, 0, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'bottom') ctx.fillRect(dx - DOOR_SIZE / 2, canvas.height - DOOR_THICKNESS, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'left') ctx.fillRect(0, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
        if (dir === 'right') ctx.fillRect(canvas.width - DOOR_THICKNESS, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
    });
}

function drawPlayer() {
    const now = Date.now();
    // 4. --- PLAYER ---

    // Gun Rendering (Barrels)
    if (gun && gun.Bullet && !gun.Bullet.NoBullets) {
        // Helper to draw a single barrel at a given angle
        const drawBarrel = (angle, color = "#555") => {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.fillRect(0, -4, player.size + 10, 8); // Extend 10px beyond center
            ctx.restore();
        };

        // 1. Main Barrel (Based on movement)
        let aimAngle = 0;
        if (player.lastMoveX || player.lastMoveY) {
            aimAngle = Math.atan2(player.lastMoveY, player.lastMoveX);
        }
        drawBarrel(aimAngle);

        // 2. Reverse Fire
        if (gun.Bullet?.reverseFire) {
            drawBarrel(aimAngle + Math.PI);
        }

        // 3. Multi-Directional
        if (gun.Bullet?.multiDirectional?.active) {
            const md = gun.Bullet.multiDirectional;
            if (md.fireNorth) drawBarrel(-Math.PI / 2);
            if (md.fireEast) drawBarrel(0);
            if (md.fireSouth) drawBarrel(Math.PI / 2);
            if (md.fireWest) drawBarrel(Math.PI);

            // 360 Mode
            if (md.fire360) {
                for (let i = 0; i < 8; i++) {
                    drawBarrel(i * (Math.PI / 4));
                }
            }
        }
    }

    const isInv = player.invuln || now < (player.invulnUntil || 0);
    ctx.fillStyle = isInv ? (player.invulColour || 'rgba(255,255,255,0.7)') : (player.colour || '#5dade2');

    ctx.beginPath();
    if (player.shape === 'square') {
        // Draw Square centered
        ctx.fillRect(player.x - player.size, player.y - player.size, player.size * 2, player.size * 2);
    } else if (player.shape === 'triangle') {
        // Draw Triangle centered
        ctx.moveTo(player.x, player.y - player.size);
        ctx.lineTo(player.x + player.size, player.y + player.size);
        ctx.lineTo(player.x - player.size, player.y + player.size);
        ctx.closePath();
        ctx.fill();
    } else {
        // Default Circle
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- SHIELD RENDERING ---
    if (player.shield?.active && player.shield.hp > 0) {
        ctx.save();
        ctx.beginPath();
        // Outer ring
        ctx.arc(player.x, player.y, player.size + 8, 0, Math.PI * 2);
        ctx.strokeStyle = player.shield.colour || "blue";
        ctx.lineWidth = 3;

        // Opacity based on HP health
        ctx.globalAlpha = 0.4 + (0.6 * (player.shield.hp / player.shield.maxHp));
        ctx.stroke();

        // Inner fill (faint)
        ctx.fillStyle = player.shield.colour || "blue";
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.restore();
    }

    // --- SHIELD BAR (Above Reload/Cooldown) ---
    // Hide bar if shield is broken (hp <= 0)
    if (player.shield?.active && player.shield.hp > 0) {
        const barW = 40;
        const barH = 5;
        const barX = player.x - barW / 2;
        const barY = player.y - player.size - 30; // Above the reload/cooldown bar

        // Background
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barW, barH);

        // Progress (HP)
        const shieldPct = Math.max(0, Math.min(player.shield.hp / player.shield.maxHp, 1));
        ctx.fillStyle = player.shield.colour || "blue"; // Use shield color
        ctx.fillRect(barX, barY, barW * shieldPct, barH);

        // Border
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
    }

    // --- RELOAD / COOLDOWN BAR ---
    // If reloading, show reload bar (Blue/Cyan)
    if (player.reloading) {
        const reloadPct = Math.min((now - player.reloadStart) / player.reloadDuration, 1);
        const barW = 40;
        const barH = 5;
        const barX = player.x - barW / 2;
        const barY = player.y - player.size - 25; // Slightly higher or same position

        // Background
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barW, barH);

        // Progress
        ctx.fillStyle = "#00ffff"; // Cyan for reload
        ctx.fillRect(barX, barY, barW * reloadPct, barH);

        // Border
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Text label (Optional, maybe too small)
        // ctx.fillStyle = "white";
        // ctx.font = "10px Arial";
        // ctx.fillText("RELOAD", barX, barY - 2);

    } else {
        // --- COOLDOWN BAR ---
        const fireDelay = (gun.Bullet?.fireRate || 0.3) * 1000;
        const timeSinceShot = now - (player.lastShot || 0);
        const pct = Math.min(timeSinceShot / fireDelay, 1);

        if (pct < 1 && gun.Bullet?.fireRate > 4) { // Only draw if reloading AND long cooldown
            const barW = 40;
            const barH = 5;
            const barX = player.x - barW / 2;
            const barY = player.y - player.size - 15;

            // Background
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(barX, barY, barW, barH);

            // Progress
            ctx.fillStyle = "orange";
            ctx.fillRect(barX, barY, barW * pct, barH);

            // Border
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
        }
    }
}

function drawBulletsAndShards() {
    // 5. --- BULLETS & ENEMIES ---
    bullets.forEach(b => {
        ctx.save(); ctx.translate(b.x, b.y);

        // Rotation: Velocity + Spin
        let rot = Math.atan2(b.vy, b.vx);
        if (b.animated) rot += b.spinAngle || 0;
        ctx.rotate(rot);

        ctx.fillStyle = b.colour || 'yellow';
        ctx.strokeStyle = b.colour || 'yellow';
        ctx.lineWidth = 2;

        const s = b.size || 5;
        ctx.beginPath();
        if (b.shape === 'triangle') { ctx.moveTo(s, 0); ctx.lineTo(-s, s); ctx.lineTo(-s, -s); ctx.closePath(); }
        else if (b.shape === 'square') ctx.rect(-s, -s, s * 2, s * 2);
        else ctx.arc(0, 0, s, 0, Math.PI * 2);

        if (b.filled) ctx.fill();
        else ctx.stroke();

        ctx.restore();
    });
}

function spawnShards(b) {
    const ex = gun.Bullet.Explode;
    for (let j = 0; j < ex.shards; j++) {
        const angle = (Math.PI * 2 / ex.shards) * j;
        bullets.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            life: ex.shardRange,
            damage: ex.damage,
            size: ex.size,
            isShard: true,
            colour: b.colour,
            canDamagePlayer: b.canDamagePlayer || false,
            hasLeftPlayer: true, // Shards hurt immediately (no safety buffer)
            shape: 'circle' // Shards are usually simple circles
        });
    }
}

function updateBulletsAndShards(aliveEnemies) {
    bullets.forEach((b, i) => {
        // --- PLAYER COLLISION (Friendly Fire) ---
        const distToPlayer = Math.hypot(player.x - b.x, b.y - player.y);
        const collisionThreshold = player.size + b.size;

        if (!b.hasLeftPlayer) {
            // Check if it has exited the player for the first time
            if (distToPlayer > collisionThreshold) {
                b.hasLeftPlayer = true;
            }
        } else {
            // Only check collision if it has safely left the player once
            if (distToPlayer < collisionThreshold) {
                // Hit Player
                if (b.canDamagePlayer) {
                    if (!player.invuln && Date.now() > (player.invulnUntil || 0)) {
                        takeDamage(b.damage || 1);
                        // Remove bullet
                        bullets.splice(i, 1);
                        return;
                    }
                } else {
                    // Harmless collision - destroy bullet
                    bullets.splice(i, 1);
                    return;
                }
            }
        }

        // --- HOMING LOGIC ---
        if (b.homing && aliveEnemies && aliveEnemies.length > 0) {
            // Filter valid targets (excluding stealth)
            const targets = aliveEnemies.filter(en => !en.stealth);

            if (targets.length > 0) {
                // Find closest enemy
                let closest = targets[0];
                let minDist = Infinity;
                targets.forEach(en => {
                    const d = Math.hypot(b.x - en.x, b.y - en.y);
                    if (d < minDist) { minDist = d; closest = en; }
                });

                // Rotate velocity towards target
                const targetAngle = Math.atan2(closest.y - b.y, closest.x - b.x);
                const currentAngle = Math.atan2(b.vy, b.vx);

                // Subtle curve (0.1 strength)
                b.vx += Math.cos(targetAngle) * 0.5;
                b.vy += Math.sin(targetAngle) * 0.5;

                // Normalize to gun speed so bullets don't accelerate to infinity
                const speed = gun.Bullet.speed || 5;
                const currMag = Math.hypot(b.vx, b.vy);
                b.vx = (b.vx / currMag) * speed;
                b.vy = (b.vy / currMag) * speed;
            } else {
                // No valid targets? Behave like normal bullet (or curve if set)
                // Fallthrough to curve check below if we want strict behavior, 
                // but usually homing bullets just go straight if no target.
            }

        } else if (b.curve) {
            // --- GENERIC CURVE ---
            const currentAngle = Math.atan2(b.vy, b.vx);
            const newAngle = currentAngle + b.curve;
            const speed = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(newAngle) * speed;
            b.vy = Math.sin(newAngle) * speed;
        }

        b.x += b.vx;
        b.y += b.vy;

        if (b.animated) {
            if (b.spinAngle === undefined) b.spinAngle = 0;
            b.spinAngle += 0.2;
        }

        // --- PARTICLES ---
        if (gun.Bullet?.particles?.active && Math.random() < (gun.Bullet.particles.frequency || 0.5)) {
            particles.push({
                x: b.x,
                y: b.y,
                life: 1.0,
                maxLife: gun.Bullet.particles.life || 0.5,
                size: (b.size || 5) * (gun.Bullet.particles.sizeMult || 0.5),
                color: b.colour || "yellow"
            });
        }

        // --- WALL COLLISION ---
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            if (gun.Bullet?.wallBounce) {
                if (b.x < 0 || b.x > canvas.width) b.vx *= -1;
                if (b.y < 0 || b.y > canvas.height) b.vy *= -1;
            } else {
                // Check for wallExplode OR general explode on impact if not a shard
                if (gun.Bullet?.Explode?.active && !b.isShard) {
                    if (gun.Bullet.Explode.wallExplode) spawnShards(b);
                }
                bullets.splice(i, 1);
                return; // Use return to skip further processing for this bullet
            }
        }

        // --- Bomb Collision (Shootable Bombs) ---
        let hitBomb = false;
        for (let j = 0; j < bombs.length; j++) {
            const bomb = bombs[j]; // Renamed 'b' to 'bomb' to avoid conflict with 'bullet'
            // Collision check for ANY bomb (solid or shootable)
            const distToBomb = Math.hypot(bomb.x - b.x, bomb.y - b.y);
            const collisionRadius = (bomb.baseR || 15) + b.size;

            if (distToBomb < collisionRadius && !bomb.exploding) {
                if (bomb.canShoot) {
                    // Detonate
                    bomb.exploding = true;
                    bomb.explosionStartAt = Date.now();
                    SFX.explode(0.3);
                    bullets.splice(i, 1);
                    hitBomb = true;
                    break;
                } else if (bomb.solid) {
                    // Solid but not shootable = block bullet (destroy bullet)
                    // Optional: Spawn particles/sparks?
                    bullets.splice(i, 1);
                    hitBomb = true;
                    break;
                }
            }
        }
        if (hitBomb) return; // Use return to skip further processing for this bullet

        // --- Enemy Collision ---
        b.life--;
        if (b.life <= 0) bullets.splice(i, 1);
    });
}

function updateShooting() {
    // --- 5. SHOOTING ---
    const shootingKeys = !gun.Bullet?.NoBullets && (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']);
    if (shootingKeys) {

        // STATIONARY AIMING LOGIC
        // If not moving (no WASD), aim in the direction of the arrow key
        const isMoving = keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'];
        if (!isMoving) {
            if (keys['ArrowUp']) { player.lastMoveX = 0; player.lastMoveY = -1; }
            else if (keys['ArrowDown']) { player.lastMoveX = 0; player.lastMoveY = 1; }
            else if (keys['ArrowLeft']) { player.lastMoveX = -1; player.lastMoveY = 0; }
            else if (keys['ArrowRight']) { player.lastMoveX = 1; player.lastMoveY = 0; }
        }

        const fireDelay = (gun.Bullet?.fireRate ?? 0.3) * 1000;
        if (Date.now() - (player.lastShot || 0) > fireDelay) {
            // Check if we can play audio (have ammo and not reloading)
            const hasAmmo = !gun.Bullet?.ammo?.active || (!player.reloading && player.ammo > 0);
            if (hasAmmo && !gun.Bullet?.NoBullets) SFX.shoot(0.05);

            let centerAngle = 0;
            if (gun.frontLocked) centerAngle = Math.atan2(player.lastMoveY || 0, player.lastMoveX || 1);
            else {
                if (keys['ArrowUp']) centerAngle = -Math.PI / 2; else if (keys['ArrowDown']) centerAngle = Math.PI / 2;
                else if (keys['ArrowLeft']) centerAngle = Math.PI; else if (keys['ArrowRight']) centerAngle = 0;
            }
            const count = gun.Bullet?.number || 1;
            for (let i = 0; i < count; i++) {
                let fanAngle = centerAngle + (count > 1 ? (i - (count - 1) / 2) * (gun.Bullet?.spreadRate || 0.2) : 0);
                const speed = gun.Bullet?.speed || 7;
                fireBullet(0, speed, Math.cos(fanAngle) * speed, Math.sin(fanAngle) * speed, fanAngle);
            }
            player.lastShot = Date.now();
        }
    }
}

function updateRemoteDetonation() {
    let detonated = false;

    for (let i = 0; i < bombs.length; i++) {
        const b = bombs[i];
        if (!b.exploding && b.remoteDenoate?.active) {
            const keyName = b.remoteDenoate.key || "space";

            let isPressed = false;
            if (keyName.toLowerCase() === "space" && keys["Space"]) isPressed = true;
            else if (keys[keyName]) isPressed = true;

            if (isPressed) {
                b.exploding = true;
                b.explosionStartAt = Date.now();
                detonated = true;

                // Respect detonateAll setting (default to true/undefined behavior acts as true)
                // If false, only detonate one per press
                if (b.remoteDenoate.detonateAll === false) {
                    break;
                }
            }
        }
    }

    if (detonated) {
        SFX.explode(0.3);
        if (keys["Space"]) keys["Space"] = false;
    }
}

function updateBombInteraction() {
    if (!keys["Space"]) return;

    let kicked = false;
    // Find closest kickable bomb
    let closestB = null;
    let minD = Infinity;

    bombs.forEach(b => {
        if (b.canInteract?.active && b.canInteract.type === 'kick') {
            const d = Math.hypot(b.x - player.x, b.y - player.y);
            const kickRange = b.canInteract.distance || 60; // Default range

            if (d < kickRange && d < minD) {
                minD = d;
                closestB = b;
            }
        }
    });

    if (closestB) {
        // Calculate kick angle (from player to bomb)
        const angle = Math.atan2(closestB.y - player.y, closestB.x - player.x);
        const force = player.physics?.strength || 15; // Kick strength based on player stats

        // Apply velocity (physics must be enabled on bomb)
        closestB.vx = Math.cos(angle) * force;
        closestB.vy = Math.sin(angle) * force;

        log("Bomb Kicked!");
        kicked = true;
    }

    if (kicked) keys["Space"] = false; // Consume input
}



function updateUse() {
    if (!keys["Space"]) return;



    // consume input so it fires once
    keys["Space"] = false;

    if (gameState !== STATES.PLAY) return;

    // Start the Tron music if it hasn't started yet
    // (Handled by startAudio listener now)

    const roomLocked = isRoomLocked();
    const doors = roomData.doors || {};
    if (roomLocked) return; // keep your existing rule: can't unlock while enemies alive

    // Helper: are we close enough to a door?
    const inRangeTop = (door) => {
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        return player.y <= BOUNDARY + 5 && player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
    };
    const inRangeBottom = (door) => {
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        return player.y >= canvas.height - BOUNDARY - 5 && player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
    };
    const inRangeLeft = (door) => {
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        return player.x <= BOUNDARY + 5 && player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
    };
    const inRangeRight = (door) => {
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        return player.x >= canvas.width - BOUNDARY - 5 && player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
    };

    // Prefer the door the player is "facing" (lastMoveX/lastMoveY), fall back to any nearby door.
    const candidates = [];
    if (doors.top?.active) candidates.push({ dir: "top", door: doors.top, inRange: inRangeTop });
    if (doors.bottom?.active) candidates.push({ dir: "bottom", door: doors.bottom, inRange: inRangeBottom });
    if (doors.left?.active) candidates.push({ dir: "left", door: doors.left, inRange: inRangeLeft });
    if (doors.right?.active) candidates.push({ dir: "right", door: doors.right, inRange: inRangeRight });

    const facingDir =
        player.lastMoveY === -1 ? "top" :
            player.lastMoveY === 1 ? "bottom" :
                player.lastMoveX === -1 ? "left" :
                    player.lastMoveX === 1 ? "right" : null;

    let target = null;

    // 1) facing door if in range
    if (facingDir) {
        const c = candidates.find(x => x.dir === facingDir);
        if (c && c.inRange(c.door)) target = c;
    }

    // 2) otherwise first door in range
    if (!target) {
        target = candidates.find(c => c.inRange(c.door)) || null;
    }

    if (!target) return; // nothing to use right now

    // --- "Use" behavior for doors (for now) ---
    const d = target.door;

    // unlock if locked and player has keys
    if (d.locked) {
        if (player.inventory?.keys > 0) {
            player.inventory.keys--;
            keysEl.innerText = player.inventory.keys;
            d.locked = 0;
            d.unlockedByKey = true;
            log(`${target.dir} door unlocked via USE (Space)`);
        } else {
            log("Door is locked - no keys");
        }
        return;
    }

    // (optional) if you ever add "open but interact" doors, handle here
    log(`${target.dir} door used (already unlocked)`);
}

function checkRemoteExplosions() {
    const now = Date.now();
    // Scan all visited rooms for saved bombs
    Object.keys(levelMap).forEach(key => {
        // Skip current room (handled by normal update)
        if (key === `${player.roomX},${player.roomY}`) return;

        const roomData = levelMap[key];
        if (roomData && roomData.savedBombs) {
            roomData.savedBombs.forEach(b => {
                // Check if exploded remotely and hasn't triggered shake yet
                if (b.explodeAt && now > b.explodeAt && !b.remoteShakeTriggered) {

                    // Trigger Shake
                    screenShake.power = 5;
                    screenShake.endAt = now + 300; // Short shake

                    // Mark as triggered so it doesn't loop forever
                    b.remoteShakeTriggered = true;

                    log(`Remote Explosion detected in room ${key}!`);
                }
            });
        }
    });
}

function updateRestart() {
    // --- 1. RESTART & UI CHECKS ---
    // Moved to handleGlobalInputs to cover all states
    if (typeof DEBUG_WINDOW_ENABLED !== 'undefined' && DEBUG_WINDOW_ENABLED && keys['KeyR']) restartGame();

    // Check for Space Bar interaction (Key Unlock)
    // Check for Space Bar interaction (Key Unlock) -- REMOVED (Handled in main loop)

}


function updateBombsPhysics() {
    bombs.forEach(b => {
        if (b.exploding) return; // Don't move exploding bombs

        // Apply Velocity
        if (Math.abs(b.vx) > 0.1 || Math.abs(b.vy) > 0.1) {
            b.x += b.vx;
            b.y += b.vy;

            // Friction
            const friction = b.physics?.friction ?? 0.9;
            b.vx *= friction;
            b.vy *= friction;

            // Stop if too slow
            if (Math.abs(b.vx) < 0.1) b.vx = 0;
            if (Math.abs(b.vy) < 0.1) b.vy = 0;

            // Wall Collisions (Bounce/Stop)
            const r = b.baseR || 15;
            const res = -(b.physics?.restitution ?? 0.5);
            if (b.x < BOUNDARY + r) { b.x = BOUNDARY + r; b.vx *= res; }
            if (b.x > canvas.width - BOUNDARY - r) { b.x = canvas.width - BOUNDARY - r; b.vx *= res; }
            if (b.y < BOUNDARY + r) { b.y = BOUNDARY + r; b.vy *= res; }
            if (b.y > canvas.height - BOUNDARY - r) { b.y = canvas.height - BOUNDARY - r; b.vy *= res; }

            // Bomb vs Enemy Collision (Explode OR Bounce)
            if (b.canInteract?.explodeOnImpact || Math.abs(b.vx) > 0.5 || Math.abs(b.vy) > 0.5) {
                for (const en of enemies) {
                    if (en.isDead) continue;
                    const dist = Math.hypot(b.x - en.x, b.y - en.y);
                    if (dist < r + en.size) {
                        if (b.canInteract?.explodeOnImpact) {
                            // Boom
                            bullets = [];
                            bombs = [];
                            particles = [];
                            roomStartTime = Date.now();
                            ghostSpawned = false; // Reset Ghost Timer

                            // Check if visited before
                            const coord = `${player.roomX},${player.roomY}`;
                            b.exploding = true;
                            b.explosionStartAt = Date.now();
                            b.vx = 0; b.vy = 0;
                            break;
                        } else {
                            // Bounce
                            const dx = b.x - en.x;
                            const dy = b.y - en.y;
                            const len = Math.hypot(dx, dy);
                            // Avoid divide by zero
                            if (len > 0) {
                                const nx = dx / len;
                                const ny = dy / len;

                                // Reflect velocity: v' = v - 2 * (v . n) * n
                                const dot = b.vx * nx + b.vy * ny;
                                b.vx -= 2 * dot * nx;
                                b.vy -= 2 * dot * ny;

                                // Push out to avoid sticking
                                b.x += nx * 5;
                                b.y += ny * 5;

                                // Friction/Dampening
                                b.vx *= 0.8;
                                b.vy *= 0.8;
                            }
                        }
                    }
                }
            }

        }

    });
}

function updateEnemies() {
    const now = Date.now();
    const isRoomFrozen = now < roomFreezeUntil;

    enemies.forEach((en, ei) => {
        // 1. Skip if dead
        if (en.isDead) {
            en.deathTimer--;
            if (en.deathTimer <= 0) enemies.splice(ei, 1);
            return;
        }

        // GHOST SPEECH - Idle Chatter
        if (en.type === 'ghost') triggerSpeech(en, 'idle');

        // ROOM FREEZE OVERRIDE
        if (isRoomFrozen) {
            en.frozen = true;
            en.invulnerable = true;
        } else {
            const isEffectFrozen = en.freezeEnd && now < en.freezeEnd;
            if (!isEffectFrozen) {
                en.frozen = false;
                en.invulnerable = false;
            }
        }

        // Angry Timer Revert
        if (en.mode === 'angry' && !en.alwaysAngry && en.angryUntil && now > en.angryUntil) {
            en.mode = 'normal';
            if (en.baseStats) {
                // Revert Stats
                en.speed = en.baseStats.speed;
                en.damage = en.baseStats.damage;
                // HP Handling: Maintain current HP percentage or just cap? 
                // If we drop max HP (implied by baseStats.hp being lower), we should probably ensure current hp isn't > base.
                // But en.hp is used as current HP. 
                // Simple approach: If current HP > base HP, cap it.
                if (en.hp > en.baseStats.hp) en.hp = en.baseStats.hp;

                en.color = en.baseStats.color;

                // Reset size if we changed it? (Angry doesn't usually change size but safe to have)
                en.size = en.baseStats.size;
            }
        }

        // 2. Frozen/Movement Logic
        if (!en.frozen) {
            // --- STATIC MOVEMENT CHECK ---
            let isStatic = false;
            if (en.moveType) {
                if (en.moveType === 'static') isStatic = true;
                if (typeof en.moveType === 'object' && en.moveType.type === 'static') isStatic = true;
                // 'track' type (or undefined) falls through to default movement below
            }

            if (!isStatic) {
                // --- STEERING BEHAVIORS ---
                // Determine Move Strategy
                let isRunAway = false;
                if (en.moveType === 'runAway') isRunAway = true;
                if (typeof en.moveType === 'object' && en.moveType.type === 'runAway') isRunAway = true;

                // 1. Seek (or Flee) Player
                let dx = player.x - en.x;
                let dy = player.y - en.y;
                const distToPlayer = Math.hypot(dx, dy);
                let dirX = 0, dirY = 0;

                if (distToPlayer > 0.1) {
                    // If runAway, we invert the direction to push AWAY from player
                    const factor = isRunAway ? -1.0 : 1.0;
                    dirX = (dx / distToPlayer) * factor;
                    dirY = (dy / distToPlayer) * factor;
                }

                // 2. Avoid Bombs
                const AVOID_WEIGHT = 4.0;
                // Heavy enemies (Bosses, Large Variants) don't fear bombs, they kick them.
                const isHeavy = (en.type === 'boss' || (en.size && en.size >= 35));

                if (!isHeavy) {
                    for (const b of bombs) {
                        if (b.solid && !b.exploding) {
                            const bdx = en.x - b.x; const bdy = en.y - b.y;
                            const bDist = Math.hypot(bdx, bdy);
                            const safeDist = en.size + (b.baseR || 15) + 50;
                            if (bDist < safeDist) {
                                const push = (safeDist - bDist) / safeDist;
                                if (bDist > 0) { dirX += (bdx / bDist) * push * AVOID_WEIGHT; dirY += (bdy / bDist) * push * AVOID_WEIGHT; }
                            }
                        }
                    }
                } else {
                    // Heavy Enemy Bomb Kicking Logic
                    for (const b of bombs) {
                        if (b.solid && !b.exploding) {
                            const dist = Math.hypot(en.x - b.x, en.y - b.y);
                            // Check simpler collision radius
                            if (dist < en.size + (b.baseR || 15)) {
                                // Kick!
                                const angle = Math.atan2(b.y - en.y, b.x - en.x);
                                const force = 8.0; // Strong kick
                                b.vx = Math.cos(angle) * force;
                                b.vy = Math.sin(angle) * force;
                                b.moveable = true; // Ensure it slides
                            }
                        }
                    }
                }

                // 2.2 Avoid Solid Enemies (e.g. Turrets)
                for (const other of enemies) {
                    if (other !== en && !other.isDead && other.solid) {
                        const odx = en.x - other.x; const ody = en.y - other.y;
                        const oDist = Math.hypot(odx, ody);
                        const safeDist = en.size + other.size + 40; // Detection range
                        if (oDist < safeDist) {
                            const push = (safeDist - oDist) / safeDist;
                            if (oDist > 0) {
                                dirX += (odx / oDist) * push * AVOID_WEIGHT;
                                dirY += (ody / oDist) * push * AVOID_WEIGHT;
                            }
                        }
                    }
                }

                // 2.5 Avoid Walls (Stay in Room)
                const WALL_DETECT_DIST = 30;
                const WALL_PUSH_WEIGHT = 1.5; // Reduced so they can corner the player

                if (en.x < BOUNDARY + WALL_DETECT_DIST) dirX += WALL_PUSH_WEIGHT * ((BOUNDARY + WALL_DETECT_DIST - en.x) / WALL_DETECT_DIST);
                if (en.x > canvas.width - BOUNDARY - WALL_DETECT_DIST) dirX -= WALL_PUSH_WEIGHT * ((en.x - (canvas.width - BOUNDARY - WALL_DETECT_DIST)) / WALL_DETECT_DIST);
                if (en.y < BOUNDARY + WALL_DETECT_DIST) dirY += WALL_PUSH_WEIGHT * ((BOUNDARY + WALL_DETECT_DIST - en.y) / WALL_DETECT_DIST);
                if (en.y > canvas.height - BOUNDARY - WALL_DETECT_DIST) dirY -= WALL_PUSH_WEIGHT * ((en.y - (canvas.height - BOUNDARY - WALL_DETECT_DIST)) / WALL_DETECT_DIST);

                // 3. Separation
                const SEP_WEIGHT = 6.0; // Increased for stronger push
                enemies.forEach((other, oi) => {
                    if (ei === oi || other.isDead) return;
                    const odx = en.x - other.x; const ody = en.y - other.y;
                    const odist = Math.hypot(odx, ody);
                    const checkDist = (en.size + other.size); // Full size check
                    if (odist < checkDist) {
                        const overlap = checkDist - odist;
                        if (odist === 0) {
                            // Random spread if exact overlap
                            const rx = (Math.random() - 0.5) * 2;
                            const ry = (Math.random() - 0.5) * 2;
                            dirX += rx * 10; dirY += ry * 10;
                            en.x += rx; en.y += ry; // Hard nudge
                        } else {
                            const push = (checkDist - odist) / checkDist;
                            // Cubic push for steering velocity
                            const strongPush = push * push * push;
                            dirX += (odx / odist) * strongPush * SEP_WEIGHT * 5;
                            dirY += (ody / odist) * strongPush * SEP_WEIGHT * 5;

                            // HARD MOVEMENT RESOLVE (Fix stuck enemies)
                            const resolveFactor = 0.1;
                            en.x += (odx / odist) * overlap * resolveFactor;
                            en.y += (ody / odist) * overlap * resolveFactor;
                        }
                    }
                });

                // 4. Move
                const finalMag = Math.hypot(dirX, dirY);
                if (finalMag > 0) {
                    const vx = (dirX / finalMag) * en.speed;
                    const vy = (dirY / finalMag) * en.speed;

                    // Collision Check
                    const isBlocked = (tx, ty) => {
                        // Check Bombs
                        for (const b of bombs) {
                            if (b.solid && !b.exploding && Math.hypot(tx - b.x, ty - b.y) < en.size + (b.baseR || 15)) return true;
                        }
                        // Check Solid Enemies (e.g. Turrets)
                        for (const other of enemies) {
                            if (other === en || other.isDead || !other.solid) continue;
                            const dist = Math.hypot(tx - other.x, ty - other.y);
                            if (dist < en.size + other.size) return true;
                        }
                        return false;
                    };
                    const nextX = en.x + vx; const nextY = en.y + vy;

                    // Helper to clamp
                    const clampX = (v) => Math.max(BOUNDARY + en.size / 2, Math.min(canvas.width - BOUNDARY - en.size / 2, v));
                    const clampY = (v) => Math.max(BOUNDARY + en.size / 2, Math.min(canvas.height - BOUNDARY - en.size / 2, v));

                    if (!isBlocked(nextX, nextY)) {
                        en.x = clampX(nextX);
                        en.y = clampY(nextY);
                    }
                    else if (!isBlocked(nextX, en.y)) { en.x = clampX(nextX); }
                    else if (!isBlocked(en.x, nextY)) { en.y = clampY(nextY); }
                }
            } // End !isStatic

            // --- GUN LOGIC ---
            if (en.gun && typeof en.gun === 'string' && !en.gunConfig) {
                if (!en.gunLoading) {
                    en.gunLoading = true;
                    fetch(en.gun).then(r => r.json()).then(d => { en.gunConfig = d; en.gunLoading = false; }).catch(e => { en.gunConfig = { error: true }; });
                }
            }
            if (en.gunConfig && !en.gunConfig.error && player.hp > 0) {
                const dist = Math.hypot(player.x - en.x, player.y - en.y);
                if (dist < 500) {
                    let fireRate = (en.gunConfig.Bullet?.fireRate || 1) * 1000;

                    // Apply Angry Fire Rate Modifier
                    if (en.mode === 'angry') {
                        const config = gameData.enemyConfig || {};
                        const angryStats = config.modeStats?.angry;
                        if (angryStats && angryStats.fireRate) {
                            fireRate *= angryStats.fireRate;
                        }
                    }

                    if (!en.lastShot || now - en.lastShot > fireRate) {
                        const angle = Math.atan2(player.y - en.y, player.x - en.x);
                        const speed = en.gunConfig.Bullet?.speed || 4;
                        const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
                        const sx = en.x + Math.cos(angle) * (en.size + 5); const sy = en.y + Math.sin(angle) * (en.size + 5);
                        spawnBullet(sx, sy, vx, vy, en.gunConfig, "enemy", en);
                        en.lastShot = now;
                    }
                }
            }
        } // End !en.frozen

        // 3. Player Collision (Thorns)
        const distToPlayer = Math.hypot(player.x - en.x, player.y - en.y);
        if (distToPlayer < en.size + player.size) {
            const baseDmg = gun.Bullet?.damage || 1;
            const thornsDmg = baseDmg / 2;
            if (thornsDmg > 0 && !en.frozen && !en.invulnerable && !en.indestructible) {
                en.hp -= thornsDmg;
                en.hitTimer = 5;
                if (en.hp <= 0 && !en.isDead) { // Kill check handled by shared block below? No, separate logs usually.
                    // But shared block is safer. Let's rely on falling through.
                }
            }
            playerHit(en, true, true, true);
        }

        // 4. BULLET COLLISION
        bullets.forEach((b, bi) => {
            // Skip checks only if invulnerable AND NOT explicitly solid
            // (Standard enemies are valid targets, but if invulnerable we usually skip unless solid)
            // Default "solid" to false if undefined? No, standard behavior for invuln is pass-through.
            // If user sets "solid": true, we process collision even if invuln.
            if (en.invulnerable && !en.solid) return;

            if (b.ownerType === 'enemy') return;
            const dist = Math.hypot(b.x - en.x, b.y - en.y);
            if (dist < en.size + (b.size || 5)) {
                if (gun.Bullet?.pierce && b.hitEnemies?.includes(ei)) return;

                let finalDamage = b.damage || 1;
                const isCrit = Math.random() < (gun.Bullet?.critChance || 0);
                if (en.type !== 'ghost' && isCrit) {
                    finalDamage *= (gun.Bullet?.critDamage || 2);
                    en.lastHitCritical = true;
                    log(`CRIT! Chance: ${gun.Bullet?.critChance}, Damage: ${finalDamage}`);
                    SFX.yelp();

                    // Critical Hit Particles (Red + 50% Larger)
                    for (let i = 0; i < 8; i++) {
                        particles.push({
                            x: b.x,
                            y: b.y,
                            vx: (Math.random() - 0.5) * 5, // Explosion velocity
                            vy: (Math.random() - 0.5) * 5,
                            life: 1.0,
                            maxLife: 0.6,
                            size: (b.size || 5) * 0.75, // 50% larger than normal 0.5 mult
                            color: "red"
                        });
                    }
                } else {
                    en.lastHitCritical = false;
                }

                if (!en.indestructible && !en.invulnerable && Date.now() >= bossIntroEndTime) { // Only damage if not invuln/indestructible AND intro finished
                    en.hp -= finalDamage;
                    en.hitTimer = 10;

                    // Speech: Hit
                    triggerSpeech(en, 'hit');

                    // Angry After Hit Logic
                    if (en.angryAfterHit && Math.random() < en.angryAfterHit) {
                        const config = gameData.enemyConfig || {};
                        const angryStats = config.modeStats?.angry;
                        if (angryStats) {
                            // Ensure base stats are captured if they weren't already (e.g. if spawned without applyEnemyConfig or weird state)
                            if (!en.baseStats) {
                                en.baseStats = {
                                    speed: en.speed,
                                    hp: en.hp,
                                    damage: en.damage,
                                    color: en.color,
                                    size: en.size
                                };
                            }

                            // If already angry, just extend timer
                            if (en.mode === 'angry') {
                                if (!en.alwaysAngry && !bossKilled) {
                                    const duration = en.angryTime || angryStats.angryTime;
                                    if (duration) {
                                        en.angryUntil = Date.now() + duration;
                                    }
                                } else if (bossKilled) {
                                    en.alwaysAngry = true;
                                    en.angryUntil = Infinity;
                                }
                            } else {
                                // Become Angry
                                en.mode = 'angry';

                                // Apply Angry Stats (similar to applyEnemyConfig)
                                if (angryStats.damage) en.damage = (en.baseStats.damage || 1) * angryStats.damage;

                                // Special handling for speedy variant speed in angry mode
                                // We need to check variant. Assuming en.variant is set.
                                if (en.variant === 'speedy' && angryStats.speedySpeed) {
                                    en.speed = (en.baseStats.speed || 1) * angryStats.speedySpeed;
                                } else if (angryStats.speed) {
                                    // Use base speed * angry multiplier
                                    en.speed = (en.baseStats.speed || 1) * angryStats.speed;
                                }

                                if (angryStats.color) en.color = angryStats.color;

                                // Timer
                                if (en.alwaysAngry) {
                                    en.angryUntil = Infinity;
                                } else {
                                    const duration = en.angryTime || angryStats.angryTime;
                                    if (duration) {
                                        en.angryUntil = Date.now() + duration;
                                    }
                                }

                                log(`${en.type} became ANGRY!`);
                                SFX.scream();
                                spawnFloatingText(en.x, en.y - 30, "RAAAGH!", "red");

                                // Speech: Angry
                                triggerSpeech(en, 'angry');
                            }
                        }
                    }
                }

                // Explode/Remove bullet if it hit something solid or took damage
                // If it took damage, it's a hit.
                // If it didn't take damage (indestructible/invuln) BUT is solid, it's a hit.
                SFX.explode(0.08);

                if (en.type !== 'ghost' && Math.random() < (gun.Bullet?.freezeChance || 0)) {
                    en.frozen = true;
                    en.freezeEnd = now + (gun.Bullet?.freezeDuration || 1000);
                }

                if (gun.Bullet?.Explode?.active && !b.isShard) spawnShards(b);

                if (gun.Bullet?.pierce) {
                    if (!b.hitEnemies) b.hitEnemies = [];
                    b.hitEnemies.push(ei);
                    b.damage *= 0.5;
                    if (b.damage <= 0.1) bullets.splice(bi, 1);
                } else {
                    bullets.splice(bi, 1);
                }
            }
        });

        // 5. DEATH CHECK
        if (en.hp <= 0 && !en.isDead && !en.indestructible) {
            en.isDead = true;
            en.deathTimer = 30;
            log(`Enemy died: ${en.type}`);

            if (en.type === 'boss') {
                log("BOSS DEFEATED! The Curse Strengthens... Resetting Rooms!");
                SFX.explode(0.5);

                // RED SHARD REWARD
                const base = gameData.hardness || 1;
                const reward = Math.ceil((base * 5) + Math.random() * base * 2); // Big reward for boss
                // addRedShards(reward); // OLD
                spawnShard(en.x, en.y, 'red', reward);

                bossKilled = true;

                // Clear Rooms
                Object.keys(visitedRooms).forEach(key => {
                    if (key !== `${player.roomX},${player.roomY}`) {
                        if (levelMap[key]) {
                            levelMap[key].cleared = false;
                            if (levelMap[key].roomData?.doors) {
                                Object.values(levelMap[key].roomData.doors).forEach(d => d.forcedOpen = true);
                            }
                        }
                    }
                });
            } else if (en.type === 'ghost') {
                log("Ghost Defeated!");
                if (gameData.bonuses && gameData.bonuses.ghost) {
                    spawnRoomRewards(gameData.bonuses.ghost, "GHOST BONUS");
                    perfectEl.innerText = "GHOST BONUS!";
                    triggerPerfectText();

                    const specialPath = gameData.bonuses.ghost.special?.item;
                    if (specialPath) {
                        (async () => {
                            try {
                                const url = "json" + (specialPath.startsWith('/') ? specialPath : '/' + specialPath);
                                const res = await fetch(`${url}?t=${Date.now()}`);
                                if (res.ok) {
                                    const itemData = await res.json();
                                    groundItems.push({
                                        x: en.x, y: en.y,
                                        data: itemData,
                                        roomX: player.roomX, roomY: player.roomY,
                                        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
                                        friction: 0.9, solid: true, moveable: true, size: 15, floatOffset: Math.random() * 100
                                    });
                                    log("Spawned Special Ghost Item:", itemData.name);
                                    spawnFloatingText(en.x, en.y - 40, "SPECIAL DROP!", "#e74c3c");
                                }
                            } catch (e) { console.error(e); }
                        })();
                    }
                }
            }
        }
    });

    // SPAWN PORTAL IF BOSS IS DEAD AND NO ENEMIES LEFT
    // Only spawn portal in the BOSS ROOM
    const currentCoord = `${player.roomX},${player.roomY}`;
    // Check for active threats (ignore indestructible/static like turrets)
    const activeThreats = enemies.filter(en => !en.isDead && !en.indestructible);

    if (roomData.isBoss && activeThreats.length === 0 && !portal.active) {
        portal.active = true;
        portal.x = canvas.width / 2;
        portal.y = canvas.height / 2;
        log("Room Clear! Spawning Portal.");
    }
}

function updatePortal() {
    if (!portal.active) return;
    const currentCoord = `${player.roomX},${player.roomY}`;
    // Only interact if in Boss Room (should match draw logic)
    if (!roomData.isBoss) return;

    const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
    if (dist < 30) {
        // WIN GAME
        if (roomData.unlocks && roomData.unlocks.length > 0) {
            handleUnlocks(roomData.unlocks);
        } else {
            handleLevelComplete();
        }
    }
}

function handleLevelComplete() {
    // 1. Next Level?
    if (roomData.nextLevel && roomData.nextLevel.trim() !== "") {
        log("Proceeding to Next Level:", roomData.nextLevel);

        // Save State to LocalStorage (Robust Persistence)
        localStorage.setItem('rogue_transition', 'true');
        // Ensure we save a clean copy without circular refs or huge data if any
        // But player object is simple enough.
        localStorage.setItem('rogue_player_state', JSON.stringify(player));

        // Load next level, Keep Stats
        initGame(true, roomData.nextLevel, true);
        return;
    }

    // 2. End Game / Victory?
    if (roomData.endGame) {
        gameState = STATES.WIN;
        updateUI();
        gameOver();
        return;
    }

    // Default fallback: Just win/end if we hit the portal but no instructions (Legacy behavior)
    gameState = STATES.WIN;
    updateUI();
    gameOver();
}

function updateGhost() {
    if (gameState !== STATES.PLAY) return;

    // Check if Ghost should spawn
    const now = Date.now();
    // Use config from gameData, default if missing
    const ghostConfig = gameData.ghost || { spawn: true, roomGhostTimer: 10000 };

    // DELAY: If enemies are still alive (locking the room), hold the timer at zero.
    // This allows the player to fight without the ghost timer ticking down.
    // Check purely for combat enemies to avoid circular dependency with isRoomLocked()
    // EXCEPTION: If ghostEntry is set (ghost is following), we IGNORE this check and spawn immediately.
    const aliveEnemies = enemies.filter(en => !en.isDead);
    const combatMock = aliveEnemies.filter(en => en.type !== 'ghost');

    if (!ghostEntry && combatMock.length > 0) {
        roomStartTime = now;
        return;
    }

    // Only spawn if:
    // 1. Config enabled
    // 2. Not already spawned in this room
    // 3. Time exceeded
    if (ghostConfig.spawn && !ghostSpawned && (now - roomStartTime > ghostConfig.roomGhostTimer)) {
        if (player.roomX === 0 && player.roomY === 0) return; // Stop ghost in start room (Fixes welcome screen spawn)

        log("THE GHOST APPEARS!");
        ghostSpawned = true;

        // Mark room as Haunted (Persistent)
        const currentCoord = `${player.roomX},${player.roomY}`;
        if (levelMap[currentCoord]) {
            levelMap[currentCoord].haunted = true;
        }

        // Spawn Ghost
        const template = enemyTemplates["ghost"] || {
            hp: 2000, speed: 1.2, damage: 1000, size: 50, color: "rgba(231, 76, 60, 0.8)", type: "ghost"
        };

        const inst = JSON.parse(JSON.stringify(template));
        inst.maxHp = inst.hp; // Ensure Max HP for health bar

        // Assign Name
        inst.lore = {
            displayName: "Player Snr",
            fullName: "Player Snr",
            nickname: "The Departed",
            title: "Player Snr"
        };

        // Spawn Location
        if (ghostEntry) {
            // Spawn at the door the player entered
            inst.x = ghostEntry.x;
            inst.y = ghostEntry.y;
            // Give it some momentum into the room
            inst.vx = ghostEntry.vx || 0;
            inst.vy = ghostEntry.vy || 0;
            ghostEntry = null; // Consume
        } else {
            // Default: Spawn away from player
            // Simple: Opposite corner or random edge
            if (Math.random() > 0.5) {
                inst.x = player.x > canvas.width / 2 ? 50 : canvas.width - 50;
                inst.y = Math.random() * canvas.height;
            } else {
                inst.x = Math.random() * canvas.width;
                inst.y = player.y > canvas.height / 2 ? 50 : canvas.height - 50;
            }
        }

        inst.frozen = false; // active immediately
        inst.invulnerable = false; // Ghost is killable? Or maybe super tanky (high HP in json)

        // Ghost specific: pass through walls? (Needs logic update in updateEnemies if so)
        // For now, standard movement

        enemies.push(inst);
        SFX.ghost(); // Spooky sound!
    }
}

// --- DAMAGE & SHIELD LOGIC ---
function takeDamage(amount) {
    // 0. CHECK GODMODE
    if (typeof GODMODE_ENABLED !== 'undefined' && GODMODE_ENABLED) {
        log("BLOCKED DAMAGE! (God Mode Enabled)");
        return;
    }

    // 0. GLOBAL IMMUNITY CHECK (Room Freeze / I-Frames)
    // Applies to BOTH Shield and HP
    const now = Date.now();
    const until = player.invulnUntil || 0;

    if (player.invuln || now < until) {
        log(`BLOCKED DAMAGE! (Shield/HP Safe). Rem Invul: ${until - now}ms`);
        return;
    }

    // 1. Check Shield
    if (player.shield?.active && player.shield.hp > 0) {
        player.shield.hp -= amount;
        SFX.click(0.5); // Shield hit sound (reuse click or new sound)

        // Overflow damage?
        if (player.shield.hp < 0) {
            // Optional: Surplus damage hits player?
            // For now, let's say shield break absorbs the full blow but breaks
            player.shield.hp = 0;
            SFX.explode(0.2); // Shield break sound
        }

        // Reset Regen Timer
        player.shield.lastHit = Date.now();
        return; // Damage absorbed
    }

    // 2. Health Damage
    player.hp -= amount;
    player.tookDamageInRoom = true;
    SFX.playerHit();

    // Trigger I-Frames
    // Use config timer, default 1000
    const iFrameDuration = player.invulHitTimer || 1000;
    player.invulnUntil = Date.now() + iFrameDuration;

    updateUI();
}

function updateShield() {
    if (!player.shield?.active) return;

    // Debug only occasionally
    if (Math.random() < 0.005) {
        // log(`Shield Debug: Active=${player.shield.active}, HP=${player.shield.hp}/${player.shield.maxHp}, RegenActive=${player.shield.regenActive}, TimeSinceHit=${Math.round(now - (player.shield.lastHit || 0))}`);
    }

    if (!player.shield.regenActive) return;

    const now = Date.now();
    const regenDelay = player.shield.regenTimer || 1000;
    const lastHit = player.shield.lastHit || 0;
    const timeSinceHit = now - lastHit;

    // Only regen if we haven't been hit recently AND HP is not full
    if (timeSinceHit > 2000) {
        if (player.shield.hp < player.shield.maxHp) {
            // Regen tick
            if (!player.shield.lastRegen || now - player.shield.lastRegen > regenDelay) {
                player.shield.hp = Math.min(player.shield.hp + (player.shield.regen || 1), player.shield.maxHp);
                player.shield.lastRegen = now;
                // log(`Shield Regen Tick: +${player.shield.regen || 1} -> ${player.shield.hp}`);
            }
        }
    } else {
        // if (Math.random() < 0.01) log(`Shield Regen Paused: Hit ${Math.round(timeSinceHit)}ms ago`);
    }
}

function drawEnemies() {

    enemies.forEach(en => {
        ctx.save();

        // GHOST EFFECTS
        let bounceY = 0;
        let sizeMod = 0;

        if (en.type === 'ghost') {
            // Ectoplasmic Wobble
            const time = Date.now() / 200;
            bounceY = Math.sin(time) * 5; // Float up and down
            sizeMod = Math.cos(time) * 2; // Pulse size slightly

            // Translucency (Base 0.6, fade if dying)
            const baseAlpha = 0.6;
            ctx.globalAlpha = en.isDead ? (en.deathTimer / 30) * baseAlpha : baseAlpha;

            // Ghostly Glow/Shadow
            ctx.shadowBlur = 20;
            ctx.shadowColor = en.color || "red";
        } else {
            // Standard Death Fade
            if (en.isDead) ctx.globalAlpha = en.deathTimer / 30;
        }

        // Visual Feedback: White for hit, Blue for frozen, Red for normal
        // Improved: Use invulColour if frozen/invulnerable
        if (en.hitTimer > 0) {
            ctx.fillStyle = en.invulColour || "white";
            en.hitTimer--; // Countdown the hit flash
        } else if (en.frozen || en.invulnerable) {
            ctx.fillStyle = en.invulColour || "#85c1e9"; // Use invulColour (white) if set, else fallback
        } else {
            ctx.fillStyle = en.color || "#e74c3c";
        }



        // DRAWING SHAPE
        const shape = en.shape || "circle";

        ctx.beginPath();

        if (shape === "square") {
            // Draw Square (centered)
            const s = (en.size + sizeMod) * 2; // Diameter to side length roughly? Or just size as half-width?
            // Existing logic uses size as radius. So square side should be roughly 2*radius?
            // Let's use size as "radius equivalent" so side = size * 2
            const side = (en.size + sizeMod); // actually let's stick to the visual expectation. radius 50 = 100 wide.
            // If I use rect from x-size, y-size to w=size*2, h=size*2
            ctx.rect(en.x - side, en.y + bounceY - side, side * 2, side * 2);
        } else if (shape === "triangle") {
            const r = en.size + sizeMod;
            const yOffset = en.y + bounceY;
            // Upward pointing triangle
            ctx.moveTo(en.x, yOffset - r);
            ctx.lineTo(en.x + r, yOffset + r);
            ctx.lineTo(en.x - r, yOffset + r);
            ctx.closePath();
        } else if (shape === "star") {
            const spikes = 5;
            const outerRadius = en.size + sizeMod;
            const innerRadius = outerRadius / 2;
            let rot = Math.PI / 2 * 3;
            let x = en.x;
            let y = en.y + bounceY;
            let step = Math.PI / spikes;

            ctx.moveTo(0, 0 - outerRadius); // Start at top
            for (let i = 0; i < spikes; i++) {
                x = en.x + Math.cos(rot) * outerRadius;
                y = en.y + bounceY + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = en.x + Math.cos(rot) * innerRadius;
                y = en.y + bounceY + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(en.x, en.y + bounceY - outerRadius);
            ctx.closePath();
        } else if (shape === "hexagon" || shape === "pentagon") {
            const sides = shape === "hexagon" ? 6 : 5;
            const r = en.size + sizeMod;
            const angleStep = (Math.PI * 2) / sides;
            // Rotate hexagon 30 deg (PI/6) to have flat top? Or 0 for pointy top.
            // Let's do -PI/2 to start at top center like circle/triangle expectations roughly
            const startAngle = -Math.PI / 2;

            ctx.moveTo(en.x + r * Math.cos(startAngle), (en.y + bounceY) + r * Math.sin(startAngle));
            for (let i = 1; i <= sides; i++) {
                const angle = startAngle + i * angleStep;
                ctx.lineTo(en.x + r * Math.cos(angle), (en.y + bounceY) + r * Math.sin(angle));
            }
            ctx.closePath();
        } else if (shape === "diamond") {
            const r = en.size + sizeMod;
            // Rhombus / Rotated Square
            ctx.moveTo(en.x, (en.y + bounceY) - r); // Top
            ctx.lineTo(en.x + r, (en.y + bounceY)); // Right
            ctx.lineTo(en.x, (en.y + bounceY) + r); // Bottom
            ctx.lineTo(en.x - r, (en.y + bounceY)); // Left
            ctx.closePath();
        } else {
            // Default: "circle"
            ctx.arc(en.x, en.y + bounceY, en.size + sizeMod, 0, Math.PI * 2);
        }

        ctx.fill();

        // Draw Name (After Fill to avoid color bleed)
        if (gameData.ShowEnemyNames !== false && en.lore && en.lore.displayName && !en.isDead) {
            ctx.save(); // Isolate text styles
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.font = "10px monospace";
            ctx.fillText(en.lore.displayName, en.x, en.y - en.size - 5);
            ctx.restore();
            ctx.restore();
        }

        // DRAW HEALTH BAR
        if (gameData.ShowEnemyHealth !== false && !en.isDead && en.maxHp > 0 && en.hp < en.maxHp) {
            const barWidth = 30;
            const barHeight = 4;
            const yOffset = en.size + 10; // Below enemy
            const pct = Math.max(0, en.hp / en.maxHp);

            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(en.x - barWidth / 2, en.y + yOffset, barWidth, barHeight);

            ctx.fillStyle = pct > 0.5 ? "#2ecc71" : (pct > 0.25 ? "#f1c40f" : "#e74c3c");
            ctx.fillRect(en.x - barWidth / 2, en.y + yOffset, barWidth * pct, barHeight);
            ctx.restore();
        }

        // DRAW SPEECH BUBBLE
        if (en.speech && en.speech.timer > 0) {
            ctx.save();
            ctx.font = "bold 12px sans-serif";
            const text = en.speech.text;
            const textMetrics = ctx.measureText(text);
            const w = textMetrics.width + 10;
            const h = 20;
            const bX = en.x;
            const bY = en.y - en.size - 25 - (bounceY || 0); // Above name

            // Bubble Background
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.strokeStyle = en.speech.color || "white";
            ctx.lineWidth = 1;

            // Rounded Rect
            ctx.beginPath();
            ctx.roundRect(bX - w / 2, bY - h, w, h, 5);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.fillStyle = en.speech.color || "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, bX, bY - h / 2);

            en.speech.timer--;
            ctx.restore();
        }

        // DRAW EYES
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.max(10, en.size * 0.8)}px sans-serif`;

        // Ensure eye color contrasts with body
        // Simple check: if body is white/very light, use black eyes? 
        // For now, default white, but if body is white (invuln), use black?
        if (en.hitTimer > 0 || en.frozen || en.invulnerable) {
            ctx.fillStyle = "black";
        }

        let eyes = "- -";

        if (en.frozen || (en.invulnerable && en.freezeEnd && Date.now() < en.freezeEnd)) {
            eyes = "* *";
        } else if (en.hitTimer > 0) {
            if (en.lastHitCritical) {
                eyes = "* !"; // Manga Style
            } else {
                eyes = "x x";
            }
        } else if (en.mode === 'angry') {
            eyes = "> <";
        }

        // Calculate Eye Offset to look at player
        const aimDx = player.x - en.x;
        const aimDy = player.y - en.y;
        const aimDist = Math.hypot(aimDx, aimDy);
        const lookOffset = en.size * 0.3; // How far eyes move
        let eyeX = en.x;
        let eyeY = en.y + bounceY;

        if (aimDist > 0) {
            eyeX += (aimDx / aimDist) * lookOffset;
            eyeY += (aimDy / aimDist) * lookOffset;
        }

        ctx.fillText(eyes, eyeX, eyeY);

        ctx.restore();
    });
}
// function playerHit(en, invuln = false, knockback = false, shakescreen = false) {
// Refactored for Solidity vs Invulnerability Separation
// Refactored for Solidity vs Invulnerability Separation
function playerHit(en, checkInvuln = true, applyKnockback = false, shakescreen = false) {

    // 1. DAMAGE CHECK (Invulnerability)
    // If checkInvuln is true (default), we verify I-frames
    // 1. DAMAGE CHECK (Invulnerability)
    let applyDamage = true;
    if (checkInvuln) {
        const now = Date.now();
        const until = player.invulnUntil || 0;
        if (player.invuln || (now < until && !en.ignoreInvuln)) {
            applyDamage = false;
            // log("Invuln Active - Damage Blocked");
        }
    }

    // Apply Damage if applicable
    if (applyDamage) {
        takeDamage(en.damage || 1);
    }

    // 2. PHYSICS CHECK (Solidity)
    // Only apply knockback if explicitly requested (usually on collision)
    // AND if the player is solid OR the enemy is forceful enough to push nonsolid?
    // User requested: "invuln makes you not solid" -> "change invuln to solid"
    // Interpretation: If player.solid is FALSE, they do not get knocked back by enemies (pass through).

    // Default solid to true if undefined
    // Default solid to true if undefined
    const playerIsSolid = (player.solid !== undefined) ? player.solid : true;
    const enemyIsSolid = (en.solid !== undefined) ? en.solid : true;

    // DEBUG: Verify Solidity
    // log(`Hit Physics: PlayerSolid=${player.solid}, IsSolid=${playerIsSolid}, EnemySolid=${enemyIsSolid}, Apply=${applyKnockback}`);

    if (applyKnockback && playerIsSolid && enemyIsSolid) {
        let dx = player.x - en.x;
        let dy = player.y - en.y;

        // If dx/dy are zero (perfect overlap), pick a random direction
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
        }

        const len = Math.hypot(dx, dy);
        const nx = dx / len;
        const ny = dy / len;
        const padding = 6;
        const targetDist = en.size + player.size + padding;
        const needed = targetDist - len;

        if (needed > 0) {
            // Push player away
            player.x += nx * needed;
            player.y += ny * needed;
        }

        // Clamp to bounds
        player.x = Math.max(BOUNDARY + player.size, Math.min(canvas.width - BOUNDARY - player.size, player.x));
        player.y = Math.max(BOUNDARY + player.size, Math.min(canvas.height - BOUNDARY - player.size, player.y));
    }

    if (shakescreen) {
        const shakePower = (en.shake || 8) * (120 / 40);
        screenShake.power = Math.max(screenShake.power, shakePower);
        screenShake.endAt = Date.now() + (en.shakeDuration || 200);
    }
}



function drawBombs(doors) {
    const now = Date.now();

    // 3. --- BOMBS (Explosion & Door Logic) ---
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        if (!b.exploding && now >= b.explodeAt) {
            b.exploding = true;
            b.explosionStartAt = now;
            SFX.explode(0.3);

            // Local Explosion Shake (Stronger than remote)
            screenShake.power = 20;
            screenShake.endAt = now + 500;
        }

        if (b.exploding) {
            const p = Math.min(1, (now - b.explosionStartAt) / b.explosionDuration);
            const r = b.baseR + (b.maxR - b.baseR) * p;

            if (!b.didDoorCheck) {
                b.didDoorCheck = true;
                Object.entries(doors).forEach(([dir, door]) => {
                    let dX = door.x ?? canvas.width / 2, dY = door.y ?? canvas.height / 2;
                    if (dir === 'top') dY = 0; if (dir === 'bottom') dY = canvas.height;
                    if (dir === 'left') dX = 0; if (dir === 'right') dX = canvas.width;

                    // If bomb blast hits the door
                    if (Math.hypot(b.x - dX, b.y - dY) < b.maxR + 30) {
                        if (b.openLockedDoors && door.locked) door.locked = 0; // Unlock standard locks
                        if (b.openRedDoors) {
                            // Force open even if enemies are present
                            door.forcedOpen = true;
                        }
                        if (b.openSecretRooms && door.hidden) { door.hidden = false; door.active = true; }
                    }
                });
            }

            if (!b.didDamage) {
                b.didDamage = true;
                enemies.forEach(en => {
                    const distEn = Math.hypot(b.x - en.x, b.y - en.y);
                    if (distEn < b.maxR) {
                        // FIX: check invulnerability AND Boss Intro
                        if (Date.now() < bossIntroEndTime) return;

                        // --- OCCLUSION CHECK: Is there a solid enemy in the way? ---
                        let blocked = false;
                        for (const blocker of enemies) {
                            if (blocker === en) continue; // Don't block self
                            if (blocker.isDead) continue; // Dead don't block
                            if (!blocker.solid) continue; // Only solid blocks

                            // Optimization: Blocker must be closer than the target
                            const distBlocker = Math.hypot(b.x - blocker.x, b.y - blocker.y);
                            if (distBlocker >= distEn) continue;

                            // Collision Check: Line Segment (Bomb -> Target) vs Circle (Blocker)
                            // Project Blocker onto Line Segment
                            const dx = en.x - b.x;
                            const dy = en.y - b.y;
                            const lenSq = dx * dx + dy * dy;
                            if (lenSq === 0) continue; // Overlap?

                            // t = projection factor
                            // Vector Bomb->Blocker (bx, by)
                            const bx = blocker.x - b.x;
                            const by = blocker.y - b.y;

                            // Dot Product
                            let t = (bx * dx + by * dy) / lenSq;
                            t = Math.max(0, Math.min(1, t)); // Clamp to segment

                            // Closest Point on segment
                            const closestX = b.x + t * dx;
                            const closestY = b.y + t * dy;

                            // Distance from Blocker Center to Closest Point
                            const distToLine = Math.hypot(blocker.x - closestX, blocker.y - closestY);

                            if (distToLine < (blocker.size || 25)) {
                                blocked = true;
                                log(`Blast Blocked! Target: ${en.type} saved by ${blocker.type}`);
                                break;
                            }
                        }

                        if (blocked) return;

                        en.hp -= b.damage;
                        en.hitTimer = 10; // Visual flash
                        // Death Logic
                        if (en.hp <= 0 && !en.isDead) {
                            en.isDead = true;
                            en.deathTimer = 30; // Matches bullet logic
                            log(`Enemy killed by bomb! Type: ${en.type}`);
                            if (en.type === 'boss') SFX.explode(0.5);
                        }
                    }
                });

                // CHAIN REACTIONS
                bombs.forEach(otherBomb => {
                    if (otherBomb !== b && !otherBomb.exploding) {
                        const dist = Math.hypot(b.x - otherBomb.x, b.y - otherBomb.y);
                        // Trigger if within explosion radius (plus a small buffer for ease)
                        if (dist < b.maxR) {
                            otherBomb.exploding = true;
                            otherBomb.explosionStartAt = Date.now() + 100; // slight delay for visual ripple
                        }
                    }
                });

                if (b.canDamagePlayer) {
                    const distToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
                    if (distToPlayer < b.maxR) {
                        // Pass a mock enemy object to playerHit
                        log(`Bomb hitting player! Bomb Size: ${b.maxR}, Player Size: ${player.size}`);
                        playerHit({ x: b.x, y: b.y, size: b.maxR, damage: 1, shake: 5, shakeDuration: 300 }, true, true, true);
                    } else {
                        log(`Player safe. Dist: ${Math.round(distToPlayer)}, Radius: ${b.maxR}`);
                    }
                } else {
                    log(`Bomb canDamagePlayer is false or undefined: ${b.canDamagePlayer}`);
                }
            }

            ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = b.explosionColour;
            ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();

            // MASKING: Erase explosion behind solid enemies so they appear to block it
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1.0;
            enemies.forEach(en => {
                if (en.solid && !en.isDead) { // Only solid living enemies block view
                    ctx.beginPath();
                    const s = en.size || 25;
                    const shape = en.shape || 'circle';

                    if (shape === 'square') {
                        ctx.rect(en.x - s, en.y - s, s * 2, s * 2);
                    } else if (shape === 'triangle') {
                        // Match drawEnemies triangle roughly
                        ctx.moveTo(en.x, en.y - s);
                        ctx.lineTo(en.x + s, en.y + s);
                        ctx.lineTo(en.x - s, en.y + s);
                        ctx.closePath();
                    } else {
                        // Default Circle
                        ctx.arc(en.x, en.y, s, 0, Math.PI * 2);
                    }
                    ctx.fillStyle = 'black';
                    ctx.fill();
                }
            });
            ctx.restore();
            if (p >= 1) bombs.splice(i, 1);
        } else {
            // Unexploded bomb glow
            ctx.fillStyle = b.colour; ctx.shadowBlur = 10; ctx.shadowColor = b.colour;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.baseR, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

            // Draw Timer Countdown
            if (b.timerShow && b.explodeAt !== Infinity) {
                const remaining = Math.max(0, Math.ceil((b.explodeAt - now) / 1000));
                ctx.fillStyle = "black";
                ctx.font = "bold 14px Arial"; // Slightly larger
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(remaining, b.x, b.y + 1); // +1 for visual centering
            }
        }
    }
}

// --- 3. BOMB DROPPING ---
function updateBombDropping() {
    if (keys['KeyB'] && player.inventory?.bombs > 0 && player.bombType) {
        // dropBomb handles delay checks, overlap checks, and valid position checks
        dropBomb().then(dropped => {
            if (dropped) {
                player.inventory.bombs--;
            }
        });
    }
}




function updateMovementAndDoors(doors, roomLocked) {
    // --- 4. MOVEMENT & DOOR COLLISION ---
    const moveKeys = { "KeyW": [0, -1, 'top'], "KeyS": [0, 1, 'bottom'], "KeyA": [-1, 0, 'left'], "KeyD": [1, 0, 'right'] };

    // TRACK INPUT VECTOR for Diagonals
    let inputDx = 0;
    let inputDy = 0;
    if (keys['KeyW']) inputDy -= 1;
    if (keys['KeyS']) inputDy += 1;
    if (keys['KeyA']) inputDx -= 1;
    if (keys['KeyD']) inputDx += 1;

    // Update last move only if there is input
    if (inputDx !== 0 || inputDy !== 0) {
        player.lastMoveX = inputDx;
        player.lastMoveY = inputDy;
    }

    for (let [key, [dx, dy, dir]] of Object.entries(moveKeys)) {
        if (keys[key]) {
            // player.lastMoveX = dx; player.lastMoveY = dy; // REMOVED: Managed by vector above
            const door = doors[dir] || { active: 0, locked: 0, hidden: 0 };

            // Reference center for alignment
            let doorRef = (dir === 'top' || dir === 'bottom') ? (door.x ?? canvas.width / 2) : (door.y ?? canvas.height / 2);
            let playerPos = (dir === 'top' || dir === 'bottom') ? player.x : player.y;

            const inDoorRange = playerPos > doorRef - (DOOR_SIZE / 2) && playerPos < doorRef + (DOOR_SIZE / 2);
            // canPass checks if bomb or key removed the 'locked' status
            // If door.forcedOpen is true, we ignore roomLocked
            const canPass = door.active && !door.locked && !door.hidden && (!roomLocked || door.forcedOpen);

            if (dx !== 0) {
                const limit = dx < 0 ? BOUNDARY : canvas.width - BOUNDARY;
                const nextX = player.x + dx * player.speed;
                let collided = false;
                let hitMoveable = false;

                // Bomb Collision (Horizontal)
                bombs.forEach(b => {
                    if (b.solid && !b.exploding) {
                        const dist = Math.hypot(nextX - b.x, player.y - b.y);
                        if (dist < player.size + (b.baseR || 15)) {
                            collided = true;
                            // Check if moveable
                            if (b.moveable) {
                                // Add impulse instead of setting position
                                const mass = b.physics?.mass ?? 1.5;
                                b.vx += dx * mass;
                                hitMoveable = true;
                            }
                        }
                    }
                });

                if (!collided && ((dx < 0 ? player.x > limit : player.x < limit) || (inDoorRange && canPass))) {
                    player.x = nextX;
                } else if (collided && !hitMoveable) {
                    player.x -= dx * 5; // Knockback only if not pushing
                    player.x = Math.max(BOUNDARY + player.size, Math.min(canvas.width - BOUNDARY - player.size, player.x));
                }
            } else {
                const limit = dy < 0 ? BOUNDARY : canvas.height - BOUNDARY;
                const nextY = player.y + dy * player.speed;
                let collided = false;
                let hitMoveable = false;

                // Bomb Collision (Vertical)
                bombs.forEach(b => {
                    if (b.solid && !b.exploding) {
                        const dist = Math.hypot(player.x - b.x, nextY - b.y);
                        if (dist < player.size + (b.baseR || 15)) {
                            collided = true;
                            // Check if moveable
                            if (b.moveable) {
                                // Add impulse
                                const mass = b.physics?.mass ?? 1.5;
                                b.vy += dy * mass;
                                hitMoveable = true;
                            }
                        }
                    }
                });

                if (!collided && ((dy < 0 ? player.y > limit : player.y < limit) || (inDoorRange && canPass))) {
                    player.y = nextY;
                } else if (collided && !hitMoveable) {
                    player.y -= dy * 5; // Knockback only if not pushing
                    player.y = Math.max(BOUNDARY + player.size, Math.min(canvas.height - BOUNDARY - player.size, player.y));
                }
            }
        }
    }

}

function gameOver() {
    // Determine state if not already set (default to GAMEOVER if just called independently)
    if (gameState !== STATES.WIN) gameState = STATES.GAMEOVER;

    overlayEl.style.display = 'flex';
    // Fix: Count unique visited rooms instead of displacement
    const roomsCount = Object.keys(visitedRooms).length || 1;
    statsEl.innerText = "Rooms Visited: " + roomsCount;

    const h1 = document.querySelector('#overlay h1');
    if (gameState === STATES.WIN) {
        h1.innerText = "VICTORY!";
        h1.style.color = "#f1c40f"; // Gold
    } else {
        h1.innerText = "Game Over";
        h1.style.color = "red";
    }

    // Show/Hide Layout based on Win/Loss
    const continueBtn = overlayEl.querySelector('#continueBtn');
    const menuBtn = overlayEl.querySelector('#menuBtn');
    const restartBtn = overlayEl.querySelector('#restartBtn');

    if (gameState === STATES.WIN) {
        // Victory: Show Continue (Enter)
        continueBtn.style.display = 'block';
        continueBtn.innerText = "(Enter) Continue";
        menuBtn.style.display = 'none'; // Hide Menu button on Victory? Or Keep it mapped to M?
        // Let's keep Menu visible but maybe mapped to M?
        // User asked for "Main Menu (Enter)" for DEATH popup. 
        // For Victory, they asked for "Enter to Continue".

        restartBtn.style.display = 'none';
    } else {
        // Death (Game Over)
        // Request: "Main Menu (Enter)"
        continueBtn.style.display = 'none'; // Hide continue on death (unless we want the revive hack visible)
        // If I hide continue, M/C keys still work.

        menuBtn.style.display = 'block';
        menuBtn.innerText = "Main Menu (Enter)";

        restartBtn.style.display = 'block';
    }
}

function gameWon() {
    gameState = STATES.WIN;
    overlayEl.style.display = 'flex';
    statsEl.innerText = "Rooms cleared: " + (Math.abs(player.roomX) + Math.abs(player.roomY));

    // Explicitly call gameOver logic to update UI text/buttons sharing logic
    gameOver();
}

function gameMenu() {
    gameState = STATES.GAMEMENU;
    pauseStartTime = Date.now(); // Record Pause Start
    overlay.style.display = 'flex';
    overlayTitle.innerText = "Pause";

    // Configure Buttons for Pause
    overlayEl.querySelector('#continueBtn').style.display = '';
    overlayEl.querySelector('#continueBtn').innerText = "(Enter) Continue";

    overlayEl.querySelector('#restartBtn').style.display = '';

    // Show Main Menu Button
    const menuBtn = overlayEl.querySelector('#menuBtn');
    menuBtn.style.display = '';
    menuBtn.innerText = "(M)ain Menu";
}

function restartGame() {
    initGame(true);
}

function goToWelcome() {
    initGame(false);
}

function goContinue() {
    overlay.style.display = 'none';

    // Adjust Timer for Pause Duration
    if (pauseStartTime > 0) {
        const pausedDuration = Date.now() - pauseStartTime;
        roomStartTime += pausedDuration; // Shift room start time forward
        pauseStartTime = 0;
        log("Resumed. Paused for: " + (pausedDuration / 1000).toFixed(1) + "s. Ghost Timer Adjusted.");
    }

    // If Continuing from Death (Game Over), Revive Player
    if (player.hp <= 0) {
        player.hp = 3; // Basic Revive
        updateUI();
    }

    // If Continuing from Victory, disable portal to prevent re-trigger
    if (gameState === STATES.WIN) {
        if (typeof portal !== 'undefined') portal.active = false;
    }

    gameState = STATES.PLAY;
}

// --- NEW GAME MODAL HANDLING ---
function confirmNewGame() {
    localStorage.removeItem('game_unlocks');
    localStorage.removeItem('game_unlocked_ids');
    log("Save data cleared. Starting fresh.");

    document.getElementById('newGameModal').style.display = 'none';
    restartGame();
}

function cancelNewGame() {
    document.getElementById('newGameModal').style.display = 'none';
}

function drawTutorial() {
    // --- Start Room Tutorial Text ---
    // --- Start Room Tutorial Text ---
    // Show in start room (0,0) if it is NOT a boss room
    if (player.roomX === 0 && player.roomY === 0 && !roomData.isBoss && !DEBUG_START_BOSS && !DEBUG_TEST_ROOM) {
        ctx.save();

        // Internal helper for keycaps
        const drawKey = (text, x, y) => {
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x - 20, y - 20, 40, 40, 5);
            ctx.fill();
            ctx.stroke();

            ctx.font = "bold 20px 'Courier New'";
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, x, y);
        };

        const ly = canvas.height / 2;

        // MOVE (WASD)
        const lx = 200;
        ctx.font = "16px 'Courier New'";
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.textAlign = "center";
        ctx.fillText("MOVE", lx, ly - 90);
        drawKey("W", lx, ly - 45);
        drawKey("A", lx - 45, ly);
        drawKey("S", lx, ly);
        drawKey("D", lx + 45, ly);

        // SHOOT (Arrows)
        if (player.gunType) {
            const rx = canvas.width - 200;
            ctx.fillText("SHOOT", rx, ly - 90);
            ctx.beginPath();
            ctx.arc(rx, ly - 75, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#e74c3c";
            ctx.fill();

            drawKey("↑", rx, ly - 45);
            drawKey("←", rx - 45, ly);
            drawKey("→", rx + 45, ly);
            drawKey("↓", rx, ly + 45);
        }

        // Action Keys (Bottom Row)
        let mx = canvas.width / 6;
        let my = canvas.height - 80;

        const actions = [];
        if (gameData.itemPickup) actions.push({ label: "ITEM", key: "⎵" });
        if (gameData.pause !== false) actions.push({ label: "PAUSE", key: "P" });
        if (gameData.music) actions.push({ label: "MUSIC", key: "0" });

        if (player.bombType) {
            actions.push({ label: "BOMB", key: "B" });
        }

        if (typeof DEBUG_WINDOW_ENABLED !== 'undefined' && DEBUG_WINDOW_ENABLED) {
            actions.push({ label: "RESTART", key: "R" });
        }

        actions.forEach(action => {
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.fillText(action.label, mx, my - 45);
            drawKey(action.key, mx, my);
            mx += 100;
        });

        ctx.restore();
    }
}

function drawMinimap() {
    if (!mctx) return; // Safety check
    if (gameData && gameData.showMinimap === false) return;

    const mapSize = 100;
    const roomSize = 12;
    const padding = 2;

    // Clear Minimap
    mctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    mctx.fillRect(0, 0, mapSize, mapSize);
    mctx.strokeStyle = "#888";
    mctx.lineWidth = 1;
    mctx.strokeRect(0, 0, mapSize, mapSize);

    // Draw Explored Rooms
    mctx.save();
    // Center map on player's room
    mctx.translate(mapSize / 2, mapSize / 2);

    for (let coord in visitedRooms) {
        const parts = coord.split(',');
        const rx = parseInt(parts[0]);
        const ry = parseInt(parts[1]);
        const isCurrent = rx === player.roomX && ry === player.roomY;
        const isCleared = visitedRooms[coord].cleared;

        // Relative position (inverted Y for intuitive map)
        const dx = (rx - player.roomX) * (roomSize + padding);
        const dy = (ry - player.roomY) * (roomSize + padding);

        // Only draw if within minimap bounds
        if (Math.abs(dx) < mapSize / 2 - 5 && Math.abs(dy) < mapSize / 2 - 5) {
            let color = isCleared ? "#27ae60" : "#e74c3c"; // Green (safe) vs Red (uncleared)

            // Special Colors
            if (rx === 0 && ry === 0) color = "#f1c40f"; // Yellow for Start
            if (visitedRooms[coord].roomData.isBoss) color = "#c0392b"; // Dark Red for Boss

            // --- GOLDEN PATH VISUALS ---
            if (!goldenPathFailed && goldenPath.includes(coord)) {
                // If this room is part of the path we have successfully traversed so far
                // We show it as Gold to indicate "Methodical Progress"
                // goldenPathIndex is the index of the *current* room we are in (or highest reached)
                // Actually, goldenPathIndex is incremented when we enter a new correct room
                // So if we are at index 2, rooms at index 0, 1, 2 of goldenPath should be gold
                const pathIdx = goldenPath.indexOf(coord);
                if (pathIdx <= goldenPathIndex && pathIdx !== -1) {
                    color = "#ffd700"; // Gold
                }
            }

            mctx.fillStyle = isCurrent ? "#fff" : color;
            mctx.fillRect(dx - roomSize / 2, dy - roomSize / 2, roomSize, roomSize);

            // Simple exit indicators
            const dData = visitedRooms[coord].roomData.doors;
            if (dData) {
                mctx.fillStyle = "#000";
                if (dData.top && dData.top.active) mctx.fillRect(dx - 1, dy - roomSize / 2, 2, 2);
                if (dData.bottom && dData.bottom.active) mctx.fillRect(dx - 1, dy + roomSize / 2 - 2, 2, 2);
                if (dData.left && dData.left.active) mctx.fillRect(dx - roomSize / 2, dy - 1, 2, 2);
                if (dData.right && dData.right.active) mctx.fillRect(dx + roomSize / 2 - 2, dy - 1, 2, 2);
            }
        }
    }



    mctx.restore();
}

function drawDebugLogs() {
    // Deprecated: Logs are now drawn to DOM via log() function
    // Kept empty to satisfy loop calls if any
}

function drawBossIntro() {
    const now = Date.now();
    if (now < bossIntroEndTime) {
        // User Request: If bossRoom is explicitly empty, skip intro
        if (!gameData.bossRoom) return;

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Find boss name
        let bossName = "";
        let bossDesc = "";

        // 1. Priority: Room Name (if specific)
        if (roomData && roomData.name && !roomData.name.includes("Boss Room")) {
            bossName = roomData.name;
            bossDesc = roomData.description || bossDesc;
        }
        // 2. Priority: Actual Spawned Boss
        else {
            const activeBoss = enemies.find(e => e.type === 'boss' || e.isBoss || e.special);
            if (activeBoss) {
                bossName = activeBoss.name || bossName;
                bossDesc = activeBoss.description || bossDesc;
            }
        }

        // IF NO BOSS NAME FOUND, SKIP THE INTRO
        if (!bossName) {
            ctx.restore();
            // Optional: cancel the timer immediately so it doesn't keep checking?
            // bossIntroEndTime = 0; 
            // But 'now < bossIntroEndTime' controls the loop, so returning here just draws nothing for this frame.
            // Better to just return.
            return;
        }

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Title
        ctx.font = "bold 60px 'Courier New'";
        ctx.fillStyle = "#c0392b";
        ctx.shadowColor = "#e74c3c";
        ctx.shadowBlur = 20;
        ctx.fillText(bossName, canvas.width / 2, canvas.height / 2 - 40);

        // Subtitle
        ctx.font = "italic 24px 'Courier New'";
        ctx.fillStyle = "#ecf0f1";
        ctx.shadowBlur = 0;
        ctx.fillText(bossDesc, canvas.width / 2, canvas.height / 2 + 30);

        ctx.restore();
    }
}


// Expose to window for testing
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'player', { get: () => player });
    Object.defineProperty(window, 'bombs', { get: () => bombs });
    Object.defineProperty(window, 'enemies', { get: () => enemies });
    Object.defineProperty(window, 'levelMap', { get: () => levelMap });
    Object.defineProperty(window, 'goldenPath', { get: () => goldenPath });
    Object.defineProperty(window, 'visitedRooms', { get: () => visitedRooms });
    Object.defineProperty(window, 'debugLogs', { get: () => debugLogs });
}
// --- ITEM LOGIC ---

function drawItems() {
    const currentCoord = `${player.roomX},${player.roomY}`;

    groundItems.forEach(item => {
        // Only draw if in the same room
        if (`${item.roomX},${item.roomY}` !== currentCoord) return;

        ctx.save();
        ctx.translate(item.x, item.y + (Math.sin((Date.now() / 200) + (item.floatOffset || 0)) * 5)); // Float effect

        // Draw Glow
        const rarityColor = item.data.rarity === 'legendary' ? 'gold' :
            (item.data.rarity === 'uncommon' ? '#3498db' : 'white');

        ctx.shadowBlur = 15;
        ctx.shadowColor = item.data.colour || item.data.color || rarityColor;

        // Draw Icon (Circle for now, maybe use rarity color)
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();

        if (item.data.type === 'gun') {
            // Square
            ctx.rect(-10, -10, 20, 20);
        } else if (item.data.type === 'modifier') {
            // Triangle
            ctx.moveTo(0, -15);
            ctx.lineTo(15, 10);
            ctx.lineTo(-15, 10);
            ctx.closePath();
        } else if (item.data.type === 'shard') {
            // Shard Visuals
            if (item.data.shardType === 'red') {
                ctx.fillStyle = "#e74c3c";
                ctx.shadowColor = "#e74c3c";
                // Diamond
                ctx.rotate(Math.PI / 4);
                ctx.rect(-7, -7, 14, 14);
                ctx.rotate(-Math.PI / 4); // Restore
            } else {
                ctx.fillStyle = "#2ecc71";
                ctx.shadowColor = "#2ecc71";
                // Small Square / Gem
                ctx.rect(-6, -6, 12, 12);
            }
        } else {
            // Bomb / Default (Circle)
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
        }
        ctx.fill();

        // Draw Text
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

        // SKIP TEXT FOR SHARDS (too cluttery?) or just show amount?
        if (item.data.type === 'shard') {
            // Optional: Show amount
            // ctx.fillText(item.data.amount, 0, -15);
            ctx.restore(); // Exit early for shards (no name/space prompt)
            return;
        }

        // Clean name (remove 'gun_' prefix for display)
        let name = item.data.name || "Item";
        if (name.startsWith("gun_")) name = name.replace("gun_", "");
        if (name.startsWith("bomb_")) name = name.replace("bomb_", "");

        ctx.fillText(name.toUpperCase(), 0, -25);

        // Interact Prompt
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < 40) {
            ctx.fillStyle = "#f1c40f"; // Gold
            ctx.font = "bold 12px monospace";
            ctx.fillText("SPACE", 0, 30);
        }

        ctx.restore();
    });
}

function updateItems() {
    const currentCoord = `${player.roomX},${player.roomY}`;

    // Check for pickup
    // Iterate reverse to safe splice
    for (let i = groundItems.length - 1; i >= 0; i--) {
        const item = groundItems[i];
        if (`${item.roomX},${item.roomY}` !== currentCoord) continue;

        // --- PHYSICS ---
        // Lazy Init
        if (item.vx === undefined) {
            item.vx = 0; item.vy = 0;
            item.friction = 0.9;
            item.solid = true;
            item.moveable = true;
            item.size = item.size || 15;
        }

        // Apply Velocity
        if (Math.abs(item.vx) > 0.01) item.x += item.vx;
        if (Math.abs(item.vy) > 0.01) item.y += item.vy;

        // Friction
        item.vx *= (item.friction || 0.9);
        item.vy *= (item.friction || 0.9);

        // Wall Collision (Simple Bounds)
        const margin = item.size || 15;
        if (item.x < margin) { item.x = margin; item.vx *= -0.5; }
        if (item.x > canvas.width - margin) { item.x = canvas.width - margin; item.vx *= -0.5; }
        if (item.y < margin) { item.y = margin; item.vy *= -0.5; }
        if (item.y > canvas.height - margin) { item.y = canvas.height - margin; item.vy *= -0.5; }

        // Door Repulsion: Push items away from doors so they don't block exit / become unpickable
        const DOOR_ZONE = 80;
        const PUSH_STRENGTH = 0.5;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        // Top Door Zone
        if (item.y < DOOR_ZONE && Math.abs(item.x - cx) < DOOR_ZONE) {
            item.vy += PUSH_STRENGTH;
        }
        // Bottom Door Zone
        if (item.y > canvas.height - DOOR_ZONE && Math.abs(item.x - cx) < DOOR_ZONE) {
            item.vy -= PUSH_STRENGTH;
        }
        // Left Door Zone
        if (item.x < DOOR_ZONE && Math.abs(item.y - cy) < DOOR_ZONE) {
            item.vx += PUSH_STRENGTH;
        }
        // Right Door Zone
        if (item.x > canvas.width - DOOR_ZONE && Math.abs(item.y - cy) < DOOR_ZONE) {
            item.vx -= PUSH_STRENGTH;
        }

        // Portal Repulsion
        if (typeof portal !== 'undefined' && portal.active) {
            const pdx = item.x - portal.x;
            const pdy = item.y - portal.y;
            const pdist = Math.hypot(pdx, pdy);
            const PORTAL_ZONE = 60; // Slightly larger than portal visual

            if (pdist < PORTAL_ZONE) {
                // Push away from center
                const angle = Math.atan2(pdy, pdx);
                const force = 1.0;
                item.vx += Math.cos(angle) * force;
                item.vy += Math.sin(angle) * force;
            }
        }

        // Player Collision (Push)
        if (item.solid && item.moveable) {
            const dx = item.x - player.x;
            const dy = item.y - player.y;
            const dist = Math.hypot(dx, dy);
            const minDist = (player.size || 20) + (item.size || 15); // Touching

            if (dist < minDist) {
                // Push away
                const angle = Math.atan2(dy, dx);
                const pushForce = 2; // How hard player pushes
                item.vx += Math.cos(angle) * pushForce;
                item.vy += Math.sin(angle) * pushForce;

                // Prevent overlap (Slide)
                const overlap = minDist - dist;
                item.x += Math.cos(angle) * overlap;
                item.y += Math.sin(angle) * overlap;
            }
        }

        // Pickup Logic
        // Pickup Logic
        // Decrement Cooldown
        if (item.pickupCooldown > 0) {
            item.pickupCooldown--;
        }

        // Lazy Init Heat
        if (item.collisionHeat === undefined) item.collisionHeat = 0;

        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        const PICKUP_THRESHOLD = 50;
        const HEAT_MAX = 100;

        if (dist < PICKUP_THRESHOLD) {
            // Player is touching/close
            if (!item.pickupCooldown || item.pickupCooldown <= 0) {
                // Increase Heat (Sustained contact or rapid bumps)
                item.collisionHeat += 5;
                if (item.collisionHeat > HEAT_MAX) item.collisionHeat = HEAT_MAX;
            }

            // ALLOW MANUAL OVERRIDE (Space) OR HEAT TRIGGER
            // EXCEPTION: Shards are auto-pickup
            if (item.data.type === 'shard') {
                // Check Cooldown
                if (item.pickupCooldown && item.pickupCooldown > 0) continue;

                // Auto Pickup Logic
                if (item.data.shardType === 'red') {
                    addRedShards(item.data.amount);
                } else {
                    addGreenShards(item.data.amount);
                }
                // Remove sound/effect? addRedShards has floating text/log.
                // Maybe add a small sound here?
                SFX.click(0.4);

                // Remove item
                groundItems.splice(i, 1);
                continue;
            }

            if (keys['Space'] || item.collisionHeat >= HEAT_MAX) {
                keys['Space'] = false; // Consume input
                pickupItem(item, i);
            }
        } else {
            // Decay Heat when away
            item.collisionHeat -= 2;
            if (item.collisionHeat < 0) item.collisionHeat = 0;
        }
    }
}

async function pickupItem(item, index) {
    const type = item.data.type; // gun or bomb
    const location = item.data.location; // e.g. weapons/guns/peashooter.json

    log(`Picking up ${item.data.name}...`);

    try {
        const res = await fetch(`json/${location}?t=${Date.now()}`);
        const config = await res.json();

        if (type === 'gun') {
            // Drop Helper
            const oldName = player.gunType;
            if (oldName) {
                // CLAMP DROP POSITION (20% margin)
                const marginX = canvas.width * 0.2;
                const marginY = canvas.height * 0.2;
                let dropX = player.x;
                let dropY = player.y;

                if (dropX < marginX) dropX = marginX;
                if (dropX > canvas.width - marginX) dropX = canvas.width - marginX;
                if (dropY < marginY) dropY = marginY;
                if (dropY > canvas.height - marginY) dropY = canvas.height - marginY;

                groundItems.push({
                    x: dropX, y: dropY,
                    roomX: player.roomX, roomY: player.roomY,
                    vx: (Math.random() - 0.5) * 5, // Random pop
                    vy: (Math.random() - 0.5) * 5,
                    friction: 0.9,
                    solid: true,
                    moveable: true,
                    size: 15,
                    floatOffset: Math.random() * 100,
                    data: {
                        name: "gun_" + oldName,
                        type: "gun",
                        location: `weapons/guns/player/${oldName}.json`,
                        rarity: "common",
                        starter: false,
                        colour: (gun.Bullet && (gun.Bullet.colour || gun.Bullet.color)) || gun.colour || gun.color
                    }
                });
            }

            gun = config;

            // REFRESH AMMO STATS
            if (gun.Bullet?.ammo?.active) {
                player.ammoMode = gun.Bullet?.ammo?.type || 'finite';
                player.maxMag = gun.Bullet?.ammo?.amount || 100;
                player.reloadTime = gun.Bullet?.ammo?.resetTimer !== undefined ? gun.Bullet?.ammo?.resetTimer : (gun.Bullet?.ammo?.reload || 1000);

                // Reset ammo to full on pickup? Yes, usually finding a gun gives you full ammo for it.
                player.ammo = player.maxMag;
                player.reloading = false;
            } else {
                // Infinite ammo fallback if config missing/inactive
                player.ammoMode = 'infinite';
                player.ammo = 999;
            }

            // RE-APPLY ACTIVE MODIFIERS
            if (activeModifiers.length > 0) {
                log(`Re-applying ${activeModifiers.length} modifiers...`);
                activeModifiers.forEach(modConfig => {
                    applyModifierToGun(gun, modConfig);
                });
            }

            if (location.includes("/")) {
                const parts = location.split('/');
                const filename = parts[parts.length - 1].replace(".json", "");
                player.gunType = filename;
            }
            log(`Equipped Gun: ${config.name}`);
            spawnFloatingText(player.x, player.y - 30, config.name.toUpperCase(), config.colour || "gold");

            // PERSIST UNLOCKS ONLY (Peashooter)
            try {
                const saved = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
                // Normalize key to match initGame loader
                const key = 'json/game.json';
                if (!saved[key]) saved[key] = {};

                // Robust Check: If the file loaded was peashooter.json, unlock it.
                if (location.endsWith('peashooter.json')) {
                    saved[key].unlocked_peashooter = true;
                    log("Unlocked Peashooter permanently (Location verified)");
                    localStorage.setItem('game_unlocks', JSON.stringify(saved));
                }
            } catch (e) { console.error("Failed to save unlock:", e); }
        }
        else if (type === 'bomb') {
            // Drop Helper
            const oldName = player.bombType;
            if (oldName) {
                // CLAMP DROP POSITION (20% margin)
                const marginX = canvas.width * 0.2;
                const marginY = canvas.height * 0.2;
                let dropX = player.x;
                let dropY = player.y;

                if (dropX < marginX) dropX = marginX;
                if (dropX > canvas.width - marginX) dropX = canvas.width - marginX;
                if (dropY < marginY) dropY = marginY;
                if (dropY > canvas.height - marginY) dropY = canvas.height - marginY;

                groundItems.push({
                    x: dropX, y: dropY,
                    roomX: player.roomX, roomY: player.roomY,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    friction: 0.9,
                    solid: true,
                    moveable: true,
                    size: 15,
                    floatOffset: Math.random() * 100,
                    data: {
                        name: "bomb_" + oldName,
                        type: "bomb",
                        location: `weapons/bombs/${oldName}.json`,
                        rarity: "common",
                        starter: false,
                        colour: bomb.colour || bomb.color
                    }
                });
            }

            bomb = config;
            if (location.includes("/")) {
                const parts = location.split('/');
                const filename = parts[parts.length - 1].replace(".json", "");
                player.bombType = filename;
            }
            log(`Equipped Bomb: ${config.name}`);
            spawnFloatingText(player.x, player.y - 30, config.name.toUpperCase(), config.colour || "orange");

            // PERSIST UNLOCKS ONLY (Normal Bomb)
            try {
                const saved = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
                const key = 'json/game.json';
                if (!saved[key]) saved[key] = {};

                // Robust Check: If the file loaded was normal.json, unlock it.
                if (location.endsWith('normal.json')) {
                    saved[key].unlocked_bomb_normal = true;
                    log("Unlocked Normal Bomb permanently (Location verified)");
                    localStorage.setItem('game_unlocks', JSON.stringify(saved));
                }
            } catch (e) { console.error("Failed to save unlock:", e); }
        }
        else if (type === 'modifier') {
            // APPLY MODIFIER
            const target = config.modify;
            const mods = config.modifiers;
            let appliedStatMod = false;

            // 1. Handle Inventory / Consumables (Global, Instant)
            if (mods.bombs !== undefined) {
                const val = parseFloat(mods.bombs);
                if (!isNaN(val)) {
                    player.inventory.bombs = (player.inventory.bombs || 0) + val;
                    log(`Ammo: ${val > 0 ? '+' : ''}${val} Bomb(s)`);
                }
            }
            if (mods.keys !== undefined) {
                const val = parseFloat(mods.keys);
                if (!isNaN(val)) {
                    player.inventory.keys = (player.inventory.keys || 0) + val;
                    log(`Keys: ${val > 0 ? '+' : ''}${val}`);
                }
            }
            if (mods.hp !== undefined) {
                const val = parseFloat(mods.hp);
                const maxHp = player.maxHp || 3;
                if (!isNaN(val)) {
                    // Prevent pickup if healing and already full
                    if (val > 0 && player.hp >= maxHp) {
                        log("Health Full!");
                        return; // Cancel pickup (item stays on ground)
                    }
                    player.hp = Math.min(player.hp + val, maxHp);
                    log(`HP: ${val > 0 ? '+' : ''}${val} (Max: ${maxHp})`);
                }
            }
            if (mods.maxHp !== undefined) {
                const val = parseFloat(mods.maxHp);
                if (!isNaN(val)) {
                    player.maxHp = (player.maxHp || 3) + val;
                    // Optional: Heal by the amount increased? Or just add empty container?
                    // Typically 'Heart Container' heals you fully or adds empty container.
                    // Let's heal the amount added so you feel the effect immediately.
                    player.hp += val;
                    log(`Max HP Increased! +${val}`);
                }
            }
            // SHIELD MODIFIERS
            if (mods["shield.active"] !== undefined) {
                if (!player.shield) player.shield = { active: false, hp: 0, maxHp: 5 };
                player.shield.active = !!mods["shield.active"];
                if (player.shield.active && player.shield.hp <= 0) player.shield.hp = player.shield.maxHp; // Restore HP on activation
                log("Shield Activated!");
            }
            if (mods["shield.regenActive"] !== undefined) {
                if (!player.shield) player.shield = { active: false, hp: 0, maxHp: 5 };
                player.shield.regenActive = !!mods["shield.regenActive"];
                log("Shield Regen Enabled!");
            }

            // 2. Handle Persistent Stat Modifiers (Gun/Bomb Configs)
            // Filter out inventory keys from stat application if needed, 
            // but for now, assuming modifiers are either consumable OR stat mods.
            // If verify keys commonly used for stats... 

            if (target === 'gun') {
                // Check if there are actual gun stats (excluding inventory keys)
                const hasGunStats = Object.keys(mods).some(k => !['bombs', 'keys', 'hp', 'maxHp'].includes(k));

                if (hasGunStats) {
                    activeModifiers.push(config);
                    applyModifierToGun(gun, config);
                    appliedStatMod = true;
                }
            }

            log(`Applied Modifier: ${config.name || "Unknown"}`);
            spawnFloatingText(player.x, player.y - 30, (config.name || "BONUS").toUpperCase(), config.colour || "#3498db");
        }

        // Remove from floor 
        // (Optional: Drop CURRENT item? For now, just destroy old)
        // Check if item should be consumed (Default: true)
        if (item.data.consumed !== false) {
            groundItems.splice(index, 1);
        }
        SFX.click(0.5); // Pickup sound

    } catch (e) {
        console.error("Failed to load weapon config", e);
        log("Error equipping item");
    }
}

function applyModifierToGun(gunObj, modConfig) {
    const mods = modConfig.modifiers;
    for (const key in mods) {
        let val = mods[key];
        let isRelative = false;

        // Check for relative modifiers (String starting with + or -)
        if (typeof val === 'string') {
            if (val.startsWith('+') || val.startsWith('-')) {
                isRelative = true;
            }
        }

        // Type conversion
        if (val === "true") val = true;
        else if (val === "false") val = false;
        else if (!isNaN(val)) val = parseFloat(val);

        // Helper to apply
        const applyTo = (obj, prop, value, relative) => {
            // Handle Dot Notation (e.g. "multiDirectional.active")
            if (prop.includes('.')) {
                const parts = prop.split('.');
                let current = obj;
                // Traverse to parent
                for (let i = 0; i < parts.length - 1; i++) {
                    if (current[parts[i]] === undefined) return false; // Path doesn't exist
                    current = current[parts[i]];
                }
                const leaf = parts[parts.length - 1];

                // Now apply to leaf
                if (current[leaf] !== undefined) {
                    if (relative && typeof current[leaf] === 'number' && typeof value === 'number') {
                        let old = current[leaf];
                        current[leaf] += value;
                        if (current[leaf] < 0 && leaf !== 'startX' && leaf !== 'startY') current[leaf] = 0.05;
                        log(`Adjusted ${prop}: ${old} -> ${current[leaf]}`);
                    } else {
                        current[leaf] = value;
                        log(`Set ${prop}: ${value}`);
                    }
                    return true;
                }
                return false;
            }

            // Standard Flat Prop
            if (obj[prop] !== undefined) {
                // log(`Applying ${prop} to ${JSON.stringify(obj)}. Rel: ${relative}, Val: ${value}, Old: ${obj[prop]}`);
                if (relative && typeof obj[prop] === 'number' && typeof value === 'number') {
                    let old = obj[prop];
                    obj[prop] += value;
                    // Prevent negative stats where inappropriate (heuristic)
                    if (obj[prop] < 0 && prop !== 'startX' && prop !== 'startY') obj[prop] = 0.05; // Cap fireRate at 0.05 (20/sec)
                    log(`Adjusted ${prop}: ${old} -> ${obj[prop]}`);
                } else {
                    obj[prop] = value;
                    log(`Set ${prop}: ${value}`);
                }
                return true;
            }
            return false;
        };

        // Check Gun Root
        if (applyTo(gunObj, key, val, isRelative)) continue;

        // Check Bullet
        if (gunObj.Bullet) {
            applyTo(gunObj.Bullet, key, val, isRelative);
        }

        // Handle special deep keys if flat (e.g. homing)
        if (key === 'homing') {
            // Ensure homing exists or force it
            if (!gunObj.Bullet) gunObj.Bullet = {};
            gunObj.Bullet.homing = val;
        }
    }
}
// --- UNLOCK SYSTEM ---
let unlockQueue = [];
let isUnlocking = false;

async function handleUnlocks(unlockKeys) {
    if (isUnlocking) return;
    isUnlocking = true;
    unlockQueue = [...unlockKeys]; // Copy

    // Create Unlock UI if not exists
    let unlockEl = document.getElementById('unlock-overlay');
    if (!unlockEl) {
        unlockEl = document.createElement('div');
        unlockEl.id = 'unlock-overlay';
        unlockEl.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: none; flex-direction: column;
            align-items: center; justify-content: center; z-index: 2000; color: white;
            font-family: monospace; text-align: center;
        `;
        document.body.appendChild(unlockEl);
    }

    // Process first unlock
    await showNextUnlock();
}

async function showNextUnlock() {
    const unlockEl = document.getElementById('unlock-overlay');
    if (unlockQueue.length === 0) {
        // All Done -> Proceed to Victory
        unlockEl.style.display = 'none';
        isUnlocking = false;

        // Final Win State
        handleLevelComplete();
        return;
    }

    const key = unlockQueue.shift();
    // Try to fetch unlock data
    try {
        // Handle "victory" specially or just ignore if file missing (user deleted it)
        // If file is missing, fetch throws or returns 404
        const res = await fetch(`json/rewards/unlocks/${key}.json?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();

            // Save Persistent Override (if applicable)
            if (data.json && data.attr && data.value !== undefined) {
                saveUnlockOverride(data.json, data.attr, data.value);
            }

            // CHECK HISTORY: Skip if already unlocked
            const history = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
            if (history.includes(key)) {
                log(`Skipping already unlocked: ${key}`);
                showNextUnlock();
                return;
            }

            // Add to history now (or after OK? better now to prevent loop if crash)
            history.push(key);
            localStorage.setItem('game_unlocked_ids', JSON.stringify(history));

            // Render
            unlockEl.innerHTML = `
                <h1 style="color: gold; text-shadow: 0 0 10px gold;">UNLOCKED!</h1>
                <h2 style="font-size: 2em; margin: 20px;">${data.name || key}</h2>
                <p style="font-size: 1.2em; color: #aaa;">${data.description || "You have unlocked a new feature!"}</p>
                <div style="margin-top: 40px; padding: 10px 20px; border: 2px solid white; cursor: pointer; display: inline-block;" id="unlock-ok-btn">
                    CONTINUE (Enter)
                </div>
            `;
            unlockEl.style.display = 'flex';

            // SFX??
            if (window.SFX && SFX.coin) SFX.coin(); // Reuse coin sound for now

            // Handler for click/key
            const proceed = () => {
                window.removeEventListener('keydown', keyHandler);
                document.getElementById('unlock-ok-btn').removeEventListener('click', proceed);
                showNextUnlock(); // Recursion for next item
            };

            const keyHandler = (e) => {
                if (e.code === 'Enter' || e.code === 'Space') {
                    proceed();
                }
            };

            document.getElementById('unlock-ok-btn').addEventListener('click', proceed);
            window.addEventListener('keydown', keyHandler);

        } else {
            console.warn(`Unlock file not found for: ${key}`);
            showNextUnlock(); // Skip if not found
        }
    } catch (e) {
        console.warn(`Failed to load unlock: ${key}`, e);
        showNextUnlock(); // Skip on error
    }
}

function saveUnlockOverride(file, attr, value) {
    try {
        const store = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
        if (!store[file]) store[file] = {};

        // Handle dot notation for nested attributes (e.g., "ghost.spawn")
        const parts = attr.split('.');
        let current = store[file];

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;

        localStorage.setItem('game_unlocks', JSON.stringify(store));
        log(`Saved Unlock Override: ${file} -> ${attr} = ${value}`);
    } catch (e) {
        console.error("Failed to save unlock persistence", e);
    }
}

// Utility for Deep Merging (Prevents overwriting sibling properties)
function deepMerge(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = sourceValue; // Arrays: Replace (simplest for config)
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

function showLevelTitle(title) {
    let titleEl = document.getElementById('level-title-overlay');
    if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.id = 'level-title-overlay';
        titleEl.style.cssText = `
            position: fixed; top: 30%; left: 50%; transform: translate(-50%, -50%);
            color: white; font-family: 'Courier New', monospace; text-align: center;
            pointer-events: none; z-index: 3000; text-transform: uppercase;
            text-shadow: 0 0 10px black; opacity: 0; transition: opacity 1s;
        `;
        document.body.appendChild(titleEl);
    }

    titleEl.innerHTML = `<h1 style="font-size: 4em; margin: 0; color: #f1c40f;">${title}</h1>`;
    titleEl.style.display = 'block';

    // Animation Sequence
    requestAnimationFrame(() => {
        titleEl.style.opacity = '1';
        setTimeout(() => {
            titleEl.style.opacity = '0';
            setTimeout(() => {
                titleEl.style.display = 'none';
            }, 1000);
        }, 3000); // Show for 3 seconds
    });
}