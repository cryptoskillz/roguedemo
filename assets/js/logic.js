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
const mctx = mapCanvas.getContext('2d');
const debugSelect = document.getElementById('debug-select');
const debugForm = document.getElementById('debug-form');
const debugPanel = document.getElementById('debug-panel');

// Global audio variable
const introMusic = new Audio('assets/music/tron.mp3');
introMusic.loop = true;
introMusic.volume = 0.4;
// --- MUSIC TOGGLE LOGIC ---
// --- MUSIC TOGGLE LOGIC ---
let lastMusicToggle = 0;

// --- DEBUG LOGGING ---
let debugLogs = [];
const MAX_DEBUG_LOGS = 10;

function log(...args) {
    if (typeof DEBUG_WINDOW_ENABLED !== 'undefined' && DEBUG_WINDOW_ENABLED) {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        debugLogs.push(msg);
        if (debugLogs.length > MAX_DEBUG_LOGS) {
            debugLogs.shift();
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

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SFX = {
    // A quick high-to-low "pew"
    shoot: (vol = 0.05) => {
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
    let html = `<h1>rogue demo</h1>
        <div id="player-select-ui" style="margin: 20px; padding: 10px; border: 2px solid #555;">
            <h2 style="color: ${p.locked ? 'gray' : '#0ff'}">${p.name} ${p.locked ? '(LOCKED)' : ''}</h2>
            <p>${p.Description || "No description"}</p>
            <p style="font-size: 0.8em; color: #aaa;">Speed: ${p.speed} | HP: ${p.hp}</p>
            <div style="margin-top: 10px; font-size: 1.2em;">
                <span>&lt;</span> 
                <span style="margin: 0 20px;">${selectedPlayerIndex + 1} / ${availablePlayers.length}</span> 
                <span>&gt;</span>
            </div>
        </div>
        <p>press 0 to toggle music<br>${p.locked ? '<span style="color:red; font-size:1.5em; font-weight:bold;">LOCKED</span>' : 'press any key to start'}</p>`;

    welcomeEl.innerHTML = html;
}

async function updateUI() {
    if (player.hp < 1) {
        hpEl.innerText = 0;
    }
    else {
        hpEl.innerText = Math.floor(player.hp);
    }
    keysEl.innerText = player.inventory.keys;
    //check if bomb type is golden and if so set the count colour to gold 
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
            ammoEl.innerText = player.ammoMode === 'recharge' ? "RECHARGING..." : "RELOADING...";
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
    const type = debugSelect.value;
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
    fullMapCoords.forEach(coord => {
        let template;
        if (coord === "0,0") {
            template = roomTemplates["start"];
        } else if (coord === bossCoord) {
            template = roomTemplates["boss"];
        } else {
            const keys = Object.keys(roomTemplates).filter(k => k !== "start" && k !== "boss");
            if (keys.length > 0) {
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                template = roomTemplates[randomKey];
            } else {
                template = roomTemplates["start"];
            }
        }

        // Check if template exists
        if (!template) {
            console.error(`Missing template for coord: ${coord}. Start: ${!!roomTemplates["start"]}, Boss: ${!!roomTemplates["boss"]}, BossCoord: ${bossCoord}`);
            template = roomTemplates["start"]; // Emergency fallback
            if (!template) return; // Critical failure logic handled by try/catch bubbling
        }

        // Deep copy template
        const roomInstance = JSON.parse(JSON.stringify(template));
        levelMap[coord] = {
            roomData: roomInstance,
            cleared: coord === "0,0" // Start room is pre-cleared
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
                if (!data.doors[d.name]) data.doors[d.name] = { active: 1, locked: 0 };
                data.doors[d.name].active = 1;
                // Keep locked status if template specifically had it, otherwise 0
                if (data.doors[d.name].locked === undefined) data.doors[d.name].locked = 0;

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
const DEBUG_START_BOSS = false; // TOGGLE THIS FOR DEBUGGING
const DEBUG_PLAYER = true;
const CHEATS_ENABLED = false;
const DEBUG_WINDOW_ENABLED = true;

let musicMuted = false;
let lastMKeyTime = 0;



// configurations
async function initGame(isRestart = false) {
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

    if (debugPanel) debugPanel.style.display = DEBUG_WINDOW_ENABLED ? 'flex' : 'none';

    // MOVED: Music start logic is now handled AFTER game.json is loaded to respect "music": false setting.

    gameState = isRestart ? STATES.PLAY : STATES.START;

    gameState = isRestart ? STATES.PLAY : STATES.START;
    overlayEl.style.display = 'none';
    welcomeEl.style.display = isRestart ? 'none' : 'flex';
    if (uiEl) uiEl.style.display = isRestart ? 'block' : 'none';
    bullets = [];
    bombs = [];
    if (typeof portal !== 'undefined') portal.active = false;

    // ... [Previous debug and player reset logic remains the same] ...
    if (DEBUG_WINDOW_ENABLED) {
        roomEl.style.display = 'block';
    } else {
        roomEl.style.display = 'none';
    }

    player.hp = 3;
    player.speed = 4;
    player.inventory.keys = 0;
    player.x = 300;
    player.y = 200;
    player.roomX = 0;
    player.roomY = 0;
    bulletsInRoom = 0;
    hitsInRoom = 0;
    perfectStreak = 0;
    perfectEl.style.display = 'none';
    roomStartTime = Date.now();
    ghostSpawned = false; // Reset Ghost
    visitedRooms = {};
    levelMap = {};

    try {
        // 1. Load basic configs
        const [manData, gData, mData, itemMan] = await Promise.all([
            fetch('/json/players/manifest.json?t=' + Date.now()).then(res => res.json()),
            fetch('/json/game.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 })),
            fetch('json/rooms/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] })),
            fetch('json/items/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ items: [] }))
        ]);

        gameData = gData;
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

            // Filter starters
            // User: "starter: false" means it spawns in the room. "starter: true" means player already has it.
            const starters = allItems.filter(i => i && i.starter === false);
            log(`Found ${allItems.length} total items. Spawning ${starters.length} floor items.`);

            // Spawn them in a row
            starters.forEach((item, idx) => {
                groundItems.push({
                    x: 250 + (idx * 80),
                    y: 350,
                    data: item,
                    roomX: 0,
                    roomY: 0,
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

        // Load player specific assets
        const [gunData, bombData] = await Promise.all([
            fetch(`/json/weapons/guns/${player.gunType}.json?t=` + Date.now()).then(res => res.json()),
            fetch(`/json/weapons/bombs/${player.bombType}.json?t=` + Date.now()).then(res => res.json())
        ]);
        gun = gunData;
        bomb = bombData;

        if (gameData.music) {
            // --- 1. INSTANT AUDIO SETUP ---
            // Ensure global audio is ready
            introMusic.loop = true;
            introMusic.volume = 0.4;

            // This attempts to play immediately.
            // If the browser blocks it, the 'keydown' listener below will catch it.
            introMusic.play().catch(() => {
                log("Autoplay blocked: Waiting for first user interaction to start music.");
            });

            // Fallback: Start music on the very first key press or click if autoplay failed
            const startAudio = () => {
                if (introMusic.paused && !musicMuted) introMusic.play();
                window.removeEventListener('keydown', startAudio);
                window.removeEventListener('mousedown', startAudio);
            };
            window.addEventListener('keydown', startAudio);
            window.addEventListener('mousedown', startAudio);
        }

        // Init Menu UI
        updateWelcomeScreen();
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

        // 3. Pre-load ALL room templates
        roomTemplates = {};
        const templatePromises = [];
        templatePromises.push(fetch('/json/rooms/start/room.json?t=' + Date.now()).then(res => res.json()).then(data => roomTemplates["start"] = data));
        templatePromises.push(fetch('/json/rooms/boss1/room.json?t=' + Date.now()).then(res => res.json()).then(data => roomTemplates["boss"] = data));

        roomManifest.rooms.forEach(id => {
            templatePromises.push(fetch(`/json/rooms/${id}/room.json?t=` + Date.now()).then(res => res.json()).then(data => roomTemplates[id] = data));
        });

        await Promise.all(templatePromises);

        // 4. Pre-load ALL enemy templates
        enemyTemplates = {};
        const enemyManifest = await fetch('json/enemies/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ enemies: [] }));
        const ePromises = enemyManifest.enemies.map(id =>
            fetch(`json/enemies/${id}.json?t=` + Date.now())
                .then(res => res.json())
                .then(data => enemyTemplates[id] = data)
        );
        await Promise.all(ePromises);

        // 5. Generate Level
        if (DEBUG_START_BOSS) {
            bossCoord = "0,0";
            goldenPath = ["0,0"];
            bossIntroEndTime = Date.now() + 2000;
            levelMap["0,0"] = { roomData: JSON.parse(JSON.stringify(roomTemplates["boss"])), cleared: false };
        } else {
            generateLevel(gameData.NoRooms || 11);
        }

        const startEntry = levelMap["0,0"];
        roomData = startEntry.roomData;
        visitedRooms["0,0"] = startEntry;

        canvas.width = roomData.width || 800;
        canvas.height = roomData.height || 600;

        if (gameState === STATES.PLAY) spawnEnemies();

        if (!gameLoopStarted) {
            gameLoopStarted = true;
            draw();
        }

    } catch (err) {
        console.warn("Could not load configurations", err);
        if (!gameLoopStarted) {
            gameLoopStarted = true;
            draw();
        }
    } finally {
        isInitializing = false;
    }
}
// Initial Start
initGame();

// --- Input Handling ---
window.addEventListener('keydown', e => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (gameState === STATES.START) {
        // Allow Menu Navigation keys to pass through to handleGlobalInputs
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyM') {
            log("Keydown Menu Key:", e.code);
            keys[e.code] = true;
            return;
        }

        // Check Lock
        const p = availablePlayers[selectedPlayerIndex];

        if (p && p.locked) {
            log("Player Locked - Cannot Start");
            return;
        }

        // Apply Selected Player Stats
        if (p) {
            // Apply stats but keep runtime properties like x/y if needed (though start resets them)
            // Actually initGame reset player.x/y already.
            const defaults = { x: 300, y: 200, roomX: 0, roomY: 0 };
            player = { ...defaults, ...JSON.parse(JSON.stringify(p)) };
            if (!player.inventory) player.inventory = { keys: 0, bombs: 0 };
        }

        // Async Load Assets then Start
        (async () => {
            try {
                const [gData, bData] = await Promise.all([
                    fetch(`/json/weapons/guns/${player.gunType}.json?t=` + Date.now()).then(res => res.json()),
                    fetch(`/json/weapons/bombs/${player.bombType}.json?t=` + Date.now()).then(res => res.json())
                ]);
                gun = gData;
                bomb = bData;

                // Initialize Ammo for new gun
                if (gun.Bullet?.ammo?.active) {
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
                uiEl.style.display = 'block';

                // If starting primarily in Boss Room (Debug Mode), reset intro timer
                if (roomData.isBoss) {
                    bossIntroEndTime = Date.now() + 2000;
                }

                spawnEnemies();
                renderDebugForm();
                updateUI();
            } catch (err) {
                console.error("Error starting game assets:", err);
            }
        })();
        return;
    }
    keys[e.code] = true;
    if (gameState === STATES.GAMEOVER) {
        if (e.code === 'Enter' || e.code === 'KeyR') {
            restartGame();
        }
        if (e.code === 'KeyM') {
            goToWelcome();
        }
    }
    // Pause menu key controls
    if (gameState === STATES.GAMEMENU) {
        if (e.code === 'KeyP' || e.code === 'KeyC') {
            goContinue();  // P or C = Continue
        }
        if (e.code === 'KeyR') {
            restartGame(); // R = Restart
        }
        if (e.code === 'KeyM') {
            goToWelcome(); // M = Main Menu
        }
    }
});
window.addEventListener('keyup', e => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    keys[e.code] = false;
});

// Debug Listeners
if (debugSelect) debugSelect.addEventListener('change', renderDebugForm);
// Force initial render of the form
setTimeout(renderDebugForm, 100);

function spawnEnemies() {
    enemies = [];
    //add the invul timer to the freeze until so they invulnerable for the time in player json
    const freezeUntil = Date.now() + (gameData.enterRoomFreezeTime || player.invulTimer || 1000);

    // Only apply invulnerability if NOT in start room
    if (player.roomX !== 0 || player.roomY !== 0) {
        player.invulnUntil = freezeUntil;
    }

    // CHECK HAUNTED STATUS
    // If room is haunted, skip normal enemies and spawn Ghost immediately
    const currentCoord = `${player.roomX},${player.roomY}`;
    if (levelMap[currentCoord] && levelMap[currentCoord].haunted) {
        log("The room is Haunted! The Ghost returns...");

        // Ensure ghostSpawned is true so we don't spawn another one later via timer
        ghostSpawned = true;

        const template = enemyTemplates["ghost"] || { hp: 2000, speed: 1.2, size: 50, type: "ghost" };
        const inst = JSON.parse(JSON.stringify(template));

        // Standard random placement or center
        inst.x = Math.random() * (canvas.width - 60) + 30;
        inst.y = Math.random() * (canvas.height - 60) + 30;
        inst.frozen = false; // Active immediately
        inst.invulnerable = false;

        enemies.push(inst);
        SFX.ghost();
        return; // Skip normal spawns
    }

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
                    inst.x = Math.random() * (canvas.width - 60) + 30;
                    inst.y = Math.random() * (canvas.height - 60) + 30;
                    inst.frozen = true;
                    inst.freezeEnd = freezeUntil;
                    inst.invulnerable = true;

                    if (bossKilled) {
                        inst.hp = (inst.hp || 1) * 2;
                        inst.speed = (inst.speed || 1) * 2;
                        inst.damage = (inst.damage || 1) * 2;
                    }

                    enemies.push(inst);
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
}

function changeRoom(dx, dy) {
    // Save cleared status of current room before leaving
    const currentCoord = `${player.roomX},${player.roomY}`;
    if (levelMap[currentCoord]) {
        levelMap[currentCoord].cleared = (enemies.length === 0);
    }

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
            const baseChance = roomData.keyBonus !== undefined ? roomData.keyBonus : 1.0;
            const finalChance = baseChance + (player.luck || 0);
            log(`Bonus Roll - Base: ${baseChance}, Luck: ${player.luck}, Final: ${finalChance}`);
            if (Math.random() < finalChance) {
                levelMap[nextCoord].bonusAwarded = true; // Mark bonus as awarded
                perfectEl.innerText = "ROOM BONUS!";
                perfectEl.style.display = 'block';
                perfectEl.style.animation = 'none';
                perfectEl.offsetHeight; /* trigger reflow */
                perfectEl.style.animation = null;
                setTimeout(() => perfectEl.style.display = 'none', 2000);
            }
        }

        // If you enter a room through a door, it must be open (unlocked)
        if (roomData.doors) {
            const entryDoor = dx === 1 ? "left" : (dx === -1 ? "right" : (dy === 1 ? "top" : "bottom"));
            if (roomData.doors[entryDoor]) {
                roomData.doors[entryDoor].locked = 0;
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

    // Default to 1 (Down) if no movement yet
    const lastX = (player.lastMoveX === undefined && player.lastMoveY === undefined) ? 0 : (player.lastMoveX || 0);
    const lastY = (player.lastMoveX === undefined && player.lastMoveY === undefined) ? 1 : (player.lastMoveY || 0);

    const dropX = player.x - (lastX * backDist);
    const dropY = player.y - (lastY * backDist);

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
    if (dropX < BOUNDARY || dropX > canvas.width - BOUNDARY || dropY < BOUNDARY || dropY > canvas.height - BOUNDARY) {
        canDrop = false;
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
            vx: 0, vy: 0,

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
        player.lastBomb = Date.now();
        return true;
    }
    return false;
}

function fireBullet(direction, speed, vx, vy, angle) {
    // 1. Safety check / No Bullets Mode
    if (gun.Bullet?.NoBullets) {
        // "if no bullets and you press fire you should get a broken gun sound"
        // Rate limit the click sound slightly so it's not a buzz
        const now = Date.now();
        if (now - (player.lastClick || 0) > 200) {
            SFX.click(); // Assuming SFX.click exists, otherwise I'll need to add it or use a fallback
            player.lastClick = now;
        }
        return;
    }

    // Ammo Check
    if (gun.Bullet?.ammo?.active) {
        if (player.reloading) return; // Cannot fire while reloading
        if (player.ammo <= 0) {
            if (player.ammoMode === 'finite') return;
            if (player.ammoMode === 'reload' && player.reserveAmmo <= 0) return;

            reloadWeapon();
            return;
        }
        player.ammo--;
        // Check if empty AFTER firing
        if (player.ammo <= 0) {
            if (player.reserveAmmo > 0 || player.ammoMode === 'recharge') {
                reloadWeapon();
            }
        }
    }

    // Helper to create the base bullet object
    const createBullet = (velX, velY) => {
        // Determine the shape ONCE at creation
        let bulletShape = gun.Bullet?.geometry?.shape || "circle";

        // If shape is 'random', pick one from the shapes array immediately
        if (bulletShape === 'random' && gun.Bullet?.geometry?.shapes?.length > 0) {
            const possibleShapes = gun.Bullet.geometry.shapes;
            bulletShape = possibleShapes[Math.floor(Math.random() * possibleShapes.length)];
        }

        // Calculate Spawn Offset (Barrel Tip)
        const barrelLength = player.size + 10;
        const angle = Math.atan2(velY, velX);
        const startX = player.x + Math.cos(angle) * barrelLength;
        const startY = player.y + Math.sin(angle) * barrelLength;

        return {
            x: startX,
            y: startY,
            vx: velX,
            vy: velY,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homing,
            canDamagePlayer: gun.Bullet?.canDamagePlayer || false,
            hasLeftPlayer: false, // Start as false, set to true once it exits player radius
            shape: bulletShape, // This is now a fixed shape (triangle, square, etc.)
            animated: gun.Bullet?.geometry?.animated || false,
            filled: gun.Bullet?.geometry?.filled !== undefined ? gun.Bullet.geometry.filled : true,
            colour: gun.Bullet?.colour || "yellow",
            spinAngle: 0,
            hitEnemies: []
        };
    };

    // 2. Spawning Logic (using else-if to prevent duplicate logic execution)
    if (direction === 0) {
        bullets.push(createBullet(vx, vy));
        if (gun.Bullet?.reverseFire) bullets.push(createBullet(-vx, -vy));

        // MultiDirectional Logic
        if (gun.Bullet?.multiDirectional?.active) {
            const md = gun.Bullet.multiDirectional;
            if (md.fireNorth) bullets.push(createBullet(0, -speed));
            if (md.fireEast) bullets.push(createBullet(speed, 0));
            if (md.fireSouth) bullets.push(createBullet(0, speed));
            if (md.fireWest) bullets.push(createBullet(-speed, 0));
            if (md.fire360) {
                for (let i = 0; i < 360; i += 10) {
                    const rad = i * Math.PI / 180;
                    bullets.push(createBullet(Math.cos(rad) * speed, Math.sin(rad) * speed));
                }
            }
        }
    }
    else if (direction === 360) {
        for (let i = 0; i < 360; i += 10) {
            const rad = i * Math.PI / 180;
            bullets.push(createBullet(Math.cos(rad) * speed, Math.sin(rad) * speed));
        }
    }
    else if (direction === 1) { // North
        bullets.push(createBullet(0, -speed));
        if (gun.Bullet?.reverseFire) bullets.push(createBullet(0, speed));
    }
    else if (direction === 2) { // East
        bullets.push(createBullet(speed, 0));
        if (gun.Bullet?.reverseFire) bullets.push(createBullet(-speed, 0));
    }
    else if (direction === 3) { // South
        bullets.push(createBullet(0, speed));
        if (gun.Bullet?.reverseFire) bullets.push(createBullet(0, -speed));
    }
    else if (direction === 4) { // West
        bullets.push(createBullet(-speed, 0));
        if (gun.Bullet?.reverseFire) bullets.push(createBullet(speed, 0));
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

    //const now = Date.now(); // Check for item pickups

    //const now = Date.now();
    // const aliveEnemies = enemies.filter(en => !en.isDead);
    // const roomLocked = aliveEnemies.length > 0;
    const roomLocked = isRoomLocked();
    const aliveEnemies = enemies.filter(en => !en.isDead); // Keep for homing logic
    const doors = roomData.doors || {};

    // 1. Inputs & Music
    updateRestart();
    // updateMusicToggle(); // Moved up
    updateRemoteDetonation(); // Remote Bombs - Check BEFORE Use consumes space
    updateBombInteraction(); // Kick/Interact with Bombs
    if (keys["Space"]) updateUse();
    if (keys["KeyP"]) {
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
    const aliveEnemies = enemies.filter(en => !en.isDead);
    const roomLocked = isRoomLocked();
    const doors = roomData.doors || {};
    await updateUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawShake()
    drawDoors()
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

            p.life -= 0.05; // Decay
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    drawMinimap();
    drawTutorial();
    drawBossIntro();
    drawPortal();
    drawDebugLogs();
    requestAnimationFrame(() => { update(); draw(); });
}

function drawPortal() {
    // Only draw if active AND in the boss room
    const currentCoord = `${player.roomX},${player.roomY}`;
    if (!portal.active || currentCoord !== bossCoord) return;
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

    // Allow transition if room is unlocked OR if the specific door is forced open (red door blown)
    if (player.x < t && doors.left?.active) {
        if (!doors.left.locked && (!roomLocked || doors.left.forcedOpen)) changeRoom(-1, 0);
        else log("Left Door Blocked: Locked or Room Locked");
    }
    else if (player.x > canvas.width - t && doors.right?.active) {
        if (!doors.right.locked && (!roomLocked || doors.right.forcedOpen)) changeRoom(1, 0);
        else log("Right Door Blocked: Locked or Room Locked");
    }
    else if (player.y < t && doors.top?.active) {
        if (!doors.top.locked && (!roomLocked || doors.top.forcedOpen)) changeRoom(0, -1);
        else log("Top Door Blocked: Locked or Room Locked");
    }
    else if (player.y > canvas.height - t && doors.bottom?.active) {
        if (!doors.bottom.locked && (!roomLocked || doors.bottom.forcedOpen)) changeRoom(0, 1);
        else log("Bottom Door Blocked: Locked or Room Locked");
    }
}

function isRoomLocked() {
    const aliveEnemies = enemies.filter(en => !en.isDead);
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
        const currentCoord = `${player.roomX}, ${player.roomY}`;
        if (visitedRooms[currentCoord]) visitedRooms[currentCoord].cleared = true;
    }
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
    if (!gun.Bullet?.NoBullets) {
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
            // Find closest enemy
            let closest = aliveEnemies[0];
            let minDist = Infinity;
            aliveEnemies.forEach(en => {
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
    const shootingKeys = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];
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
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // Handle Audio Context
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

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

        // ROOM FREEZE OVERRIDE
        if (isRoomFrozen) {
            en.frozen = true;
            en.invulnerable = true;
            // Visuals: Maybe draw them blue or static? handled in drawEnemies by frozen flag
        }

        // 2. Frozen/Movement Logic
        if (!en.frozen) {
            let ang = Math.atan2(player.y - en.y, player.x - en.x);
            let nextX = en.x + Math.cos(ang) * en.speed;
            let nextY = en.y + Math.sin(ang) * en.speed;

            // Simple check against solid bombs
            // Collision Check Helper
            const isBlocked = (tx, ty) => {
                let blocked = false;
                for (const b of bombs) {
                    if (b.solid && !b.exploding) {
                        if (Math.hypot(tx - b.x, ty - b.y) < en.size + (b.baseR || 15)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            if (!isBlocked(nextX, nextY)) {
                en.x = nextX;
                en.y = nextY;
            } else {
                // Try sliding X
                if (!isBlocked(nextX, en.y)) {
                    en.x = nextX;
                }
                // Try sliding Y
                else if (!isBlocked(en.x, nextY)) {
                    en.y = nextY;
                }
            }
        } else if (!isRoomFrozen && now > en.freezeEnd) { // Only wake up if room is NOT frozen by game event
            en.frozen = false;
            en.invulnerable = false; // Clear invulnerability when they wake up
        }

        // 3. Player Collision
        const distToPlayer = Math.hypot(player.x - en.x, player.y - en.y);
        if (distToPlayer < en.size + player.size) {
            playerHit(en, true, true, true);
        }

        // 4. BULLET COLLISION (Fixed)
        bullets.forEach((b, bi) => {
            if (en.invulnerable) return; // Skip collision if invulnerable

            const dist = Math.hypot(b.x - en.x, b.y - en.y);
            // Check if bullet overlaps enemy radius
            if (dist < en.size + (b.size || 5)) {

                // PIERCING: If piercing is on, don't hit the same enemy twice
                if (gun.Bullet?.pierce && b.hitEnemies?.includes(ei)) return;

                // CRIT & DAMAGE
                let finalDamage = b.damage || 1;
                // Ghost Immunity to Crits
                if (en.type !== 'ghost' && Math.random() < (gun.Bullet?.critChance || 0)) {
                    finalDamage *= (gun.Bullet?.critDamage || 2);
                }
                en.hp -= finalDamage;
                en.hitTimer = 10; // Trigger white flash in draw()
                SFX.explode(0.08);

                // FREEZE MECHANIC
                // Ghost Immunity to Freeze
                if (en.type !== 'ghost' && Math.random() < (gun.Bullet?.freezeChance || 0)) {
                    en.frozen = true;
                    en.freezeEnd = now + (gun.Bullet?.freezeDuration || 1000);
                }

                // SHARD EXPLOSION ON HIT
                if (gun.Bullet?.Explode?.active && !b.isShard) {
                    spawnShards(b);
                }

                // PIERCING VS REMOVAL
                if (gun.Bullet?.pierce) {
                    if (!b.hitEnemies) b.hitEnemies = [];
                    b.hitEnemies.push(ei);
                } else {
                    bullets.splice(bi, 1);
                }

                // CHECK ENEMY DEATH
                if (en.hp <= 0) {
                    en.isDead = true;
                    en.deathTimer = 30;
                    log(`Enemy died: ${en.type}`); // DEBUG LOG

                    // Check if Boss
                    if (en.type === 'boss') {
                        log("BOSS DEFEATED! The Curse Strengthens... Resetting Rooms!");
                        SFX.explode(0.5); // Big Boom

                        // BOSS KILLED LOGIC
                        bossKilled = true;

                        // Reset all visited rooms (except current boss room) to force respawns
                        // Reset all visited rooms (except current boss room) to force respawns
                        Object.keys(visitedRooms).forEach(key => {
                            if (key !== `${player.roomX},${player.roomY}`) {
                                // 1. Do NOT delete visitedRooms. This keeps the minimap visible (Fog of War cleared).
                                // delete visitedRooms[key]; 

                                // 2. Mark as uncleared so enemies respawn
                                if (levelMap[key]) {
                                    levelMap[key].cleared = false;

                                    // 3. FORCE DOORS OPEN so the player isn't locked in
                                    if (levelMap[key].roomData && levelMap[key].roomData.doors) {
                                        Object.values(levelMap[key].roomData.doors).forEach(d => {
                                            d.forcedOpen = true;
                                        });
                                    }
                                }
                            }
                        });
                    }

                    // Optional: Visual cue?
                    // maybe shake screen or flash red
                }
            }
        });
    });

    // SPAWN PORTAL IF BOSS IS DEAD AND NO ENEMIES LEFT
    // Only spawn portal in the BOSS ROOM
    const currentCoord = `${player.roomX},${player.roomY}`;
    if (bossKilled && currentCoord === bossCoord && enemies.length === 0 && !portal.active) {
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
    if (currentCoord !== bossCoord) return;

    const dist = Math.hypot(player.x - portal.x, player.y - portal.y);
    if (dist < 30) {
        // WIN GAME
        gameState = STATES.WIN;
        updateUI();
        gameOver();
    }
}

function updateGhost() {
    // Check if Ghost should spawn
    const now = Date.now();
    // Use config from gameData, default if missing
    const ghostConfig = gameData.ghost || { spawn: true, roomGhostTimer: 10000 };

    // Only spawn if:
    // 1. Config enabled
    // 2. Not already spawned in this room
    // 3. Time exceeded
    if (ghostConfig.spawn && !ghostSpawned && (now - roomStartTime > ghostConfig.roomGhostTimer)) {
        if (player.roomX === 0 && player.roomY === 0) return; // No ghost in start room

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
    // 0. GLOBAL IMMUNITY CHECK (Room Freeze / I-Frames)
    // Applies to BOTH Shield and HP
    const now = Date.now();
    const until = player.invulnUntil || 0;

    if (now < until) {
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

        ctx.beginPath();
        ctx.arc(en.x, en.y + bounceY, en.size + sizeMod, 0, Math.PI * 2);
        ctx.fill();
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
        if (now < until) {
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
    const isSolid = (player.solid !== undefined) ? player.solid : true;

    // DEBUG: Verify Solidity
    // log(`Hit Physics: PlayerSolid=${player.solid}, IsSolid=${isSolid}, Apply=${applyKnockback}`);

    if (applyKnockback && isSolid) {
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
                    if (Math.hypot(b.x - en.x, b.y - en.y) < b.maxR) {
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
    if (keys['KeyB'] && player.inventory?.bombs > 0) {
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
    for (let [key, [dx, dy, dir]] of Object.entries(moveKeys)) {
        if (keys[key]) {
            player.lastMoveX = dx; player.lastMoveY = dy;
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

    overlayEl.querySelector('#continueBtn').style.display = 'none';
}

function gameWon() {
    gameState = STATES.GAMEOVER;
    overlayEl.style.display = 'flex';
    statsEl.innerText = "Rooms cleared: " + (Math.abs(player.roomX) + Math.abs(player.roomY));
    document.querySelector('#overlay h1').innerText = "VICTORY!";
    document.querySelector('#overlay h1').style.color = "#f1c40f"; // Gold for victory
}

function gameMenu() {
    gameState = STATES.GAMEMENU;
    overlay.style.display = 'flex';
    overlayTitle.innerText = "Pause";
    overlayEl.querySelector('#continueBtn').style.display = '';
}

function restartGame() {
    initGame(true);
}

function goToWelcome() {
    initGame(false);
}

function goContinue() {
    overlay.style.display = 'none';
    gameState = STATES.PLAY
}

function drawTutorial() {
    // --- Start Room Tutorial Text ---
    if (player.roomX === 0 && player.roomY === 0 && (DEBUG_START_BOSS === false)) {
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

        // Action Keys (Bottom Row)
        let mx = canvas.width / 6;
        let my = canvas.height - 80;

        const actions = [
            { label: "ITEM", key: "⎵" },
            { label: "PAUSE", key: "P" },
            { label: "BOMB", key: "B" }
        ];

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
    if (typeof DEBUG_WINDOW_ENABLED !== 'undefined' && DEBUG_WINDOW_ENABLED && debugLogs.length > 0) {
        ctx.save();
        ctx.font = "12px 'Courier New'";
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(10, canvas.height - 15 - (debugLogs.length * 15), 400, (debugLogs.length * 15) + 5);

        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#00FF00"; // Hacker green

        debugLogs.forEach((msg, i) => {
            ctx.fillText(msg, 15, canvas.height - 10 - ((debugLogs.length - 1 - i) * 15));
        });

        ctx.restore();
    }
}

function drawBossIntro() {
    const now = Date.now();
    if (now < bossIntroEndTime) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Find boss name
        let bossName = "BOSS";
        let bossDesc = "Prepare yourself!";

        // Try to find from templates or current enemies
        if (enemyTemplates["boss"]) {
            bossName = enemyTemplates["boss"].name || bossName;
            bossDesc = enemyTemplates["boss"].description || bossDesc;
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
        ctx.shadowBlur = 15;
        ctx.shadowColor = item.data.rarity === 'legendary' ? 'gold' :
            (item.data.rarity === 'uncommon' ? '#3498db' : 'white');

        // Draw Icon (Circle for now, maybe use rarity color)
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Draw Text
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

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

        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < 40) {
            if (keys['Space']) {
                keys['Space'] = false; // Consume input
                pickupItem(item, i);
            }
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
                groundItems.push({
                    x: player.x, y: player.y,
                    roomX: player.roomX, roomY: player.roomY,
                    floatOffset: Math.random() * 100,
                    data: {
                        name: "gun_" + oldName,
                        type: "gun",
                        location: `weapons/guns/${oldName}.json`,
                        rarity: "common",
                        starter: false
                    }
                });
            }

            gun = config;

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
        }
        else if (type === 'bomb') {
            // Drop Helper
            const oldName = player.bombType;
            if (oldName) {
                groundItems.push({
                    x: player.x, y: player.y,
                    roomX: player.roomX, roomY: player.roomY,
                    floatOffset: Math.random() * 100,
                    data: {
                        name: "bomb_" + oldName,
                        type: "bomb",
                        location: `weapons/bombs/${oldName}.json`,
                        rarity: "common",
                        starter: false
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
        }
        else if (type === 'modifier') {
            // APPLY MODIFIER
            const target = config.modify; // "gun" or "bomb"

            if (target === 'gun') {
                // Store for future guns
                activeModifiers.push(config);
                applyModifierToGun(gun, config);
            }
            log(`Applied Modifier: ${config.name || "Unknown"}`);
        }

        // Remove from floor 
        // (Optional: Drop CURRENT item? For now, just destroy old)
        groundItems.splice(index, 1);
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
        // Type conversion
        if (val === "true") val = true;
        else if (val === "false") val = false;
        else if (!isNaN(val)) val = parseFloat(val);

        // Check Gun Root
        if (gunObj[key] !== undefined) {
            gunObj[key] = val;
        }
        // Check Bullet (Most likely)
        else if (gunObj.Bullet && gunObj.Bullet[key] !== undefined) {
            gunObj.Bullet[key] = val;
        }
        // Handle special deep keys if flat (e.g. homing)
        else if (key === 'homing') {
            // Ensure homing exists or force it
            if (!gunObj.Bullet) gunObj.Bullet = {};
            gunObj.Bullet.homing = val;
        }
    }
}
