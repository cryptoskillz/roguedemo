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
const mapCanvas = document.getElementById('minimapCanvas');
const mctx = mapCanvas.getContext('2d');
const debugSelect = document.getElementById('debug-select');
const debugForm = document.getElementById('debug-form');
const debugPanel = document.getElementById('debug-panel');

// Global audio variable
const introMusic = new Audio('assets/music/tron.mp3');
introMusic.loop = true;
introMusic.volume = 0.4;

// --- Game State ---
let player = {
    x: 300, y: 200, speed: 4, hp: 3, roomX: 0, roomY: 0,
    inventory: { keys: 0 },
    size: 20
};
let bullets = [];
let particles = [];
let enemies = [];
let bombs = [];
let keys = {};

let bomb = {}
let gun = {}
let bombsInRoom = 0;
let screenShake = { power: 0, endAt: 0 };


let bulletsInRoom = 0;
let hitsInRoom = 0;
let perfectStreak = 0;
let gameData = { perfectGoal: 3 };

const STATES = { START: 0, PLAY: 1, GAMEOVER: 2, GAMEMENU: 3 };
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
let roomTemplates = {};
let levelMap = {}; // Pre-generated level structure
let bossCoord = "";
let enemyTemplates = {};
let bossIntroEndTime = 0;
let gameLoopStarted = false;
let keyUsedForRoom = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SFX = {
    // A quick high-to-low "pew"
    shoot: (vol = 0.05) => {
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
    }
};


async function updateUI() {
    if (player.hp < 0) {
        hpEl.innerText = 0
    }
    else {
        hpEl.innerText = player.hp;
    }
    keysEl.innerText = player.inventory.keys;
    //check if bomb type is golden and if so set the count colour to gold 
    if (player.bombType === "golden") {
        bombsEl.style.color = "gold";
    } else {
        bombsEl.style.color = "white";
    }
    bombsEl.innerText = player.inventory.bombs;
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
    bossCoord = path[path.length - 1];

    // 2. Add Side Rooms
    let fullMapCoords = [...path];
    path.forEach(coord => {
        if (coord === bossCoord || coord === "0,0") return;
        if (Math.random() > 0.5) { // 50% chance to try adding a side room from a golden path room
            const [rx, ry] = coord.split(',').map(Number);
            let d = dirs[Math.floor(Math.random() * dirs.length)];
            let sideCoord = `${rx + d.dx},${ry + d.dy}`;
            if (!fullMapCoords.includes(sideCoord)) {
                fullMapCoords.push(sideCoord);
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

    console.log("Level Generated upfront with", Object.keys(levelMap).length, "rooms.");
    console.log("Golden Path:", goldenPath);
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
    if (debugPanel) debugPanel.style.display = DEBUG_WINDOW_ENABLED ? 'flex' : 'none';
    // Attempt to start music immediately
    introMusic.play().catch(() => console.log("Waiting for interaction to play music..."));

    // One-time listener to start music on first click/key if blocked by browser
    const startAudio = () => {
        if (!musicMuted) introMusic.play();
        window.removeEventListener('keydown', startAudio);
        window.removeEventListener('mousedown', startAudio);
    };
    window.addEventListener('keydown', startAudio);
    window.addEventListener('mousedown', startAudio);

    gameState = isRestart ? STATES.PLAY : STATES.START;
    overlayEl.style.display = 'none';
    welcomeEl.style.display = isRestart ? 'none' : 'flex';
    if (uiEl) uiEl.style.display = isRestart ? 'block' : 'none';
    bullets = [];
    bombs = [];

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
    visitedRooms = {};
    levelMap = {};

    try {
        // 1. Load basic configs
        const [pData, gData, mData] = await Promise.all([
            fetch('/json/player.json?t=' + Date.now()).then(res => res.json()),
            fetch('/json/game.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 })),
            fetch('json/rooms/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] }))
        ]);

        gameData = gData;
        roomManifest = mData;
        if (gameData.music) {

            // --- 1. INSTANT AUDIO SETUP ---
            if (!window.introMusic) {
                window.introMusic = new Audio('/assets/music/tron.mp3');
                window.introMusic.loop = true;
                window.introMusic.volume = 0.4;
            }

            // This attempts to play immediately. 
            // If the browser blocks it, the 'keydown' listener below will catch it.
            window.introMusic.play().catch(() => {
                console.log("Autoplay blocked: Waiting for first user interaction to start music.");
            });

            // Fallback: Start music on the very first key press or click if autoplay failed
            const startAudio = () => {
                if (window.introMusic.paused) window.introMusic.play();
                window.removeEventListener('keydown', startAudio);
                window.removeEventListener('mousedown', startAudio);
            };
            window.addEventListener('keydown', startAudio);
            window.addEventListener('mousedown', startAudio);

        }

        if (pData.inventory === undefined) pData.inventory = { keys: 0 };
        Object.assign(player, pData);

        // 2. load the bomb and gun data
        const [bData, gunData] = await Promise.all([
            fetch(`/json/weapons/bombs/${player.bombType}.json?t=` + Date.now()).then(res => res.json()),
            fetch(`/json/weapons/guns/${player.gunType}.json?t=` + Date.now()).then(res => res.json()),
        ]);
        bomb = bData;
        gun = gunData;

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
    }
}
// Initial Start
initGame();

// --- Input Handling ---
window.addEventListener('keydown', e => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (gameState === STATES.START) {
        gameState = STATES.PLAY;
        welcomeEl.style.display = 'none';
        uiEl.style.display = 'block';

        // If starting primarily in Boss Room (Debug Mode), reset intro timer
        if (roomData.isBoss) {
            bossIntroEndTime = Date.now() + 2000;
        }

        spawnEnemies();
        return;
    }
    keys[e.code] = true;
    if (gameState === STATES.GAMEOVER && e.code === 'Enter') {
        restartGame();
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
    const freezeUntil = Date.now() + player.invulTimer;

    // Only apply invulnerability if NOT in start room
    if (player.roomX !== 0 || player.roomY !== 0) {
        player.invulnUntil = freezeUntil;
    }

    // Skip if explicitly set to 0 enemies
    if (roomData.enemyCount === 0) return;

    // Use roomData.enemies if defined (array of {type, count}), otherwise fallback
    if (roomData.enemies && Array.isArray(roomData.enemies)) {
        roomData.enemies.forEach(group => {
            const template = enemyTemplates[group.type];
            if (template) {
                for (let i = 0; i < group.count; i++) {
                    const inst = JSON.parse(JSON.stringify(template));
                    inst.x = Math.random() * (canvas.width - 60) + 30;
                    inst.y = Math.random() * (canvas.height - 60) + 30;
                    inst.freezeUntil = freezeUntil;
                    enemies.push(inst);
                }
            }
        });
    } else {
        // Fallback: Random Grunts
        let count = 3 + Math.floor(Math.random() * 3);
        if (gameData.difficulty) count += gameData.difficulty;
        const template = enemyTemplates["grunt"] || { hp: 2, speed: 1, size: 25 };

        for (let i = 0; i < count; i++) {
            const inst = JSON.parse(JSON.stringify(template));
            inst.x = Math.random() * (canvas.width - 60) + 30;
            inst.y = Math.random() * (canvas.height - 60) + 30;
            inst.freezeUntil = freezeUntil;
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

    if (dx === 1) {
        player.x = BOUNDARY + 10;
        player.y = door.y !== undefined ? door.y : (data.height || 600) / 2;
    }
    if (dx === -1) {
        player.x = (data.width || 800) - BOUNDARY - 10;
        player.y = door.y !== undefined ? door.y : (data.height || 600) / 2;
    }
    if (dy === 1) {
        player.y = BOUNDARY + 10;
        player.x = door.x !== undefined ? door.x : (data.width || 800) / 2;
    }
    if (dy === -1) {
        player.y = (data.height || 600) - BOUNDARY - 10;
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

    bullets = []; // Clear bullets on room entry
    bombs = []; // Clear bombs on room entry
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

        // Remove freeze period for start room (0,0)
        let freezeDelay = (player.roomX === 0 && player.roomY === 0) ? 0 : 1000;
        if (roomData.isBoss) freezeDelay = 2000;

        roomStartTime = Date.now() + freezeDelay; // Start timer after freeze
        keyUsedForRoom = keyWasUsedForThisRoom; // Apply key usage penalty to next room

        // Immediate Room Bonus if key used
        // Immediate Room Bonus if key used (First visit only)
        if (keyUsedForRoom && !levelMap[nextCoord].bonusAwarded) {
            const baseChance = roomData.keyBonus !== undefined ? roomData.keyBonus : 1.0;
            const finalChance = baseChance + (player.luck || 0);
            console.log(`Bonus Roll - Base: ${baseChance}, Luck: ${player.luck}, Final: ${finalChance}`);
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
    //check the bomb interval and see if enough time has passed before we can drop another

    const baseR = bomb.size || 20;         // visible bomb radius
    const maxR = bomb.radius || 120;      // explosion max radius
    const timer = bomb.timer || 1000;

    // direction behind player (use your lastMoveX/lastMoveY logic)
    const dirX = player.lastMoveX ?? 0;
    const dirY = player.lastMoveY ?? 1;
    const gap = 6;
    const backDist = player.size + baseR + gap;

    const bombDelay = (bomb?.fireRate !== undefined ? bomb?.fireRate : 0.3) * 1000;
    if (Date.now() - (player.lastBomb || 0) > bombDelay) {
        bombsInRoom++; // for perfecr calcs later
        bombs.push({
            x: player.x - dirX * backDist,
            y: player.y - dirY * backDist,

            baseR,
            maxR,

            colour: bomb.colour || "white",
            damage: bomb.damage || 1,
            canDamagePlayer: !!bomb.canDamagePlayer,


            explodeAt: Date.now() + timer,
            exploding: false,
            explosionStartAt: 0,
            explosionDuration: bomb.explosionDuration || 300,
            explosionColour: bomb.explosionColour || bomb.colour || "white",
            didDamage: false,
            id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
            triggeredBy: null, // optional debug
        });
        player.lastBomb = Date.now();

    }
}

function fireBullet(direction, speed, vx, vy, angle) {
    // 1. Safety check
    if (gun.Bullet?.NoBullets) {
        return;
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

        return {
            x: player.x,
            y: player.y,
            vx: velX,
            vy: velY,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homing,
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
    }
    else if (direction === 360) {
        for (let i = 0; i < 360; i += 10) {
            const rad = i * Math.PI / 180;
            bullets.push(createBullet(Math.cos(rad) * speed, Math.sin(rad) * speed));
        }
    }
    else if (direction === 1) { // North
        bullets.push(createBullet(0, -speed));
    }
    else if (direction === 2) { // East
        bullets.push(createBullet(speed, 0));
    }
    else if (direction === 3) { // South
        bullets.push(createBullet(0, speed));
    }
    else if (direction === 4) { // West
        bullets.push(createBullet(-speed, 0));
    }

    bulletsInRoom++;
}

// --- Generic "Use" action (SPACE) ---
// Call this once per frame near the top of update(), BEFORE the WASD blocks.
function tryUse() {
    if (!keys["Space"]) return;

    // consume input so it fires once
    keys["Space"] = false;

    if (gameState !== STATES.PLAY) return;

    // Start the Tron music if it hasn't started yet
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!Music.isPlaying) {
        Music.start();
    }

    const roomLocked = enemies.length > 0;
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
            console.log(`${target.dir} door unlocked via USE (Space)`);
        } else {
            console.log("Door is locked - no keys");
        }
        return;
    }

    // (optional) if you ever add "open but interact" doors, handle here
    console.log(`${target.dir} door used (already unlocked)`);
}

function update() {
    if (gameState !== STATES.PLAY) return;

    // --- 0. AUDIO CONTEXT & MUSIC TOGGLE ---
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Toggle Music with 'M' (with a 300ms debounce to prevent flickering)
    if (keys['KeyM'] && Date.now() - (lastMKeyTime || 0) > 300) {
        musicMuted = !musicMuted;
        if (musicMuted) introMusic.pause();
        else introMusic.play();
        lastMKeyTime = Date.now();
        console.log(musicMuted ? "Music: OFF" : "Music: ON");
    }

    const currentCoord = `${player.roomX}, ${player.roomY}`;
    const roomLocked = enemies.length > 0;
    const doors = roomData.doors || {};

    // --- 1. ROOM CLEARING LOGIC ---
    if (!roomLocked && !roomData.cleared) {
        roomData.cleared = true;
        if (visitedRooms[currentCoord]) visitedRooms[currentCoord].cleared = true;
    }

    // --- 2. INPUT HANDLERS ---
    if (keys['Escape']) gameMenu(); // Open menu with Escape
    tryUse();

    if (keys['KeyB'] && player.inventory?.bombs > 0) {
        player.inventory.bombs--;
        keys['KeyB'] = false;
        dropBomb();
        SFX.explode(0.2); // Play bomb chiptune
        updateUI();
    }

    // --- 3. MOVEMENT (WASD) ---
    const moveKeys = { "KeyW": [0, -1, 'top'], "KeyS": [0, 1, 'bottom'], "KeyA": [-1, 0, 'left'], "KeyD": [1, 0, 'right'] };
    for (let [key, [dx, dy, dir]] of Object.entries(moveKeys)) {
        if (keys[key]) {
            player.lastMoveX = dx; player.lastMoveY = dy;
            const door = doors[dir] || { active: 0, locked: 0 };
            const doorRef = (dir === 'top' || dir === 'bottom') ? (door.x ?? canvas.width / 2) : (door.y ?? canvas.height / 2);
            const playerPos = (dir === 'top' || dir === 'bottom') ? player.x : player.y;
            const inDoorRange = playerPos > doorRef - DOOR_SIZE && playerPos < doorRef + DOOR_SIZE;
            const canPass = door.active && !door.locked && !roomLocked;

            if (dx !== 0) {
                const limit = dx < 0 ? BOUNDARY : canvas.width - BOUNDARY;
                if ((dx < 0 ? player.x > limit : player.x < limit) || (inDoorRange && canPass)) player.x += dx * player.speed;
            } else {
                const limit = dy < 0 ? BOUNDARY : canvas.height - BOUNDARY;
                if ((dy < 0 ? player.y > limit : player.y < limit) || (inDoorRange && canPass)) player.y += dy * player.speed;
            }
        }
    }

    // --- 4. SHOOTING LOGIC (With SFX + JSON Recoil) ---
    const shootingKeys = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];
    if (shootingKeys) {
        const fireDelay = (gun.Bullet?.fireRate ?? 0.3) * 1000;
        if (Date.now() - (player.lastShot || 0) > fireDelay) {

            SFX.shoot(0.05); // Play shoot chiptune

            let centerAngle = 0;
            if (keys['ArrowUp']) centerAngle = -Math.PI / 2;
            else if (keys['ArrowDown']) centerAngle = Math.PI / 2;
            else if (keys['ArrowLeft']) centerAngle = Math.PI;
            else if (keys['ArrowRight']) centerAngle = 0;

            // Homing Target Selection
            if (gun.Bullet?.homing && enemies.length > 0) {
                let nearest = enemies.reduce((a, b) =>
                    Math.hypot(player.x - a.x, player.y - a.y) < Math.hypot(player.x - b.x, player.y - b.y) ? a : b
                );
                centerAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
            }

            const count = gun.Bullet?.number || 1;
            const spread = gun.Bullet?.spreadRate || 0.2;
            const recoilVal = gun.Bullet?.recoil || 0;

            // Apply Recoil (Push player back)
            player.x -= Math.cos(centerAngle) * (recoilVal * count);
            player.y -= Math.sin(centerAngle) * (recoilVal * count);

            // Boundary Safety (Keep player in room after recoil)
            player.x = Math.max(BOUNDARY, Math.min(canvas.width - BOUNDARY, player.x));
            player.y = Math.max(BOUNDARY, Math.min(canvas.height - BOUNDARY, player.y));

            // Fire Bullet Loop
            for (let i = 0; i < count; i++) {
                let finalAngle = centerAngle + (count > 1 ? (i - (count - 1) / 2) * spread : 0);
                const speed = gun.Bullet?.speed || 7;
                const vx = Math.cos(finalAngle) * speed;
                const vy = Math.sin(finalAngle) * speed;
                fireBullet(0, speed, vx, vy, finalAngle);
            }
            player.lastShot = Date.now();
        }
    }

    // --- 5. BULLETS, PARTICLES, & ENEMIES ---

    // A. Update Existing Particles (Fade Out)
    if (typeof particles !== 'undefined') {
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].life -= 0.05;
            if (particles[i].life <= 0) particles.splice(i, 1);
        }
    }

    // B. Update Bullets & Spawn Trail Particles
    bullets.forEach((b, i) => {
        const pSettings = gun.Bullet?.particles;
        if (pSettings?.active && Math.random() < (pSettings.frequency || 0.5)) {
            particles.push({
                x: b.x,
                y: b.y,
                color: b.colour || 'yellow',
                life: pSettings.life || 0.5,
                size: (b.size || 5) * (pSettings.sizeMult || 0.5)
            });
        }

        b.x += b.vx; b.y += b.vy;
        b.life--;
        if (b.life <= 0) bullets.splice(i, 1);
    });

    // C. Enemy AI & Collision
    enemies.forEach((en, ei) => {
        let angle = Math.atan2(player.y - en.y, player.x - en.x);
        en.x += Math.cos(angle) * en.speed;
        en.y += Math.sin(angle) * en.speed;

        bullets.forEach((b, bi) => {
            if (Math.hypot(b.x - en.x, b.y - en.y) < en.size) {
                SFX.explode(0.08); // Play hit sound
                en.hp -= (b.damage || 1);
                bullets.splice(bi, 1);
                if (en.hp <= 0) enemies.splice(ei, 1);
            }
        });

        // Player Collision
        if (Math.hypot(player.x - en.x, player.y - en.y) < player.size + en.size) {
            if (!player.isInvulnerable) SFX.playerHit(0.3); // Play hurt sound
            playerHit(en, true, true, true);
        }
    });

    // --- 6. TRANSITIONS & GAME OVER ---
    if (!roomLocked) {
        if (player.x < 10 && doors.left?.active) changeRoom(-1, 0);
        if (player.x > canvas.width - 10 && doors.right?.active) changeRoom(1, 0);
        if (player.y < 10 && doors.top?.active) changeRoom(0, -1);
        if (player.y > canvas.height - 10 && doors.bottom?.active) changeRoom(0, 1);
    }

    if (player.hp <= 0) {
        introMusic.pause(); // Kill music on death
        gameOver();
    }
}


function playerHit(en, invuln = false, knockback = false, shakescreen = false) {
    //check if player should be made invulerable
    if (invuln) {
        const isInvuln = player.invuln || Date.now() < player.invulnUntil;
        // Very basic "iframes" logic
        if (!isInvuln) {
            //deduct enemies damage type
            player.hp -= en.damage || 1;
            hpEl.innerText = player.hp;
            player.invuln = true;
            setTimeout(() => player.invuln = false, 1000);
        }

    }
    if (knockback) {

        //add the enemy knockback modifier to the player
        const dx = player.x - en.x;
        const dy = player.y - en.y;
        const len = Math.hypot(dx, dy) || 1;

        const nx = dx / len;
        const ny = dy / len;

        // Push player to just outside the enemy radius
        const padding = 6;
        const targetDist = en.size + player.size + padding;
        const needed = targetDist - len;

        if (needed > 0) {
            player.x += nx * needed;
            player.y += ny * needed;
        }

        // Clamp to room bounds
        player.x = Math.max(
            BOUNDARY + player.size,
            Math.min(canvas.width - BOUNDARY - player.size, player.x)
        );
        player.y = Math.max(
            BOUNDARY + player.size,
            Math.min(canvas.height - BOUNDARY - player.size, player.y)
        );

    }

    if (shakescreen) {
        // basic screen shake not dependant bombs max radius
        const explosionStrength = 120 / 40; // scale with explosion size
        const shakePower = (en.shake || 8) * explosionStrength;

        screenShake.power = Math.max(screenShake.power, shakePower);
        screenShake.endAt = Date.now() + (en.shakeDuration || 200);
    }
}

function gameOver() {
    gameState = STATES.GAMEOVER;
    overlayEl.style.display = 'flex';
    statsEl.innerText = "Rooms cleared: " + (Math.abs(player.roomX) + Math.abs(player.roomY));
    document.querySelector('#overlay h1').innerText = "Game Over";
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
    gameState = STATES.gameMenu;
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
        console.log("in")

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
            { label: "MENU", key: "M" },
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

async function draw() {
    await updateUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. --- SHAKE ---
    let isShaking = false;
    if (screenShake.power > 0 && Date.now() < screenShake.endAt) {
        ctx.save();
        const p = (screenShake.endAt - Date.now()) / 180;
        const s = screenShake.power * Math.max(0, p);
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        isShaking = true;
    }

    // 2. --- DOORS ---
    const roomLocked = enemies.length > 0;
    const doors = roomData.doors || {};
    Object.entries(doors).forEach(([dir, door]) => {
        if (!door.active) return;
        ctx.fillStyle = roomLocked ? "#c0392b" : (door.locked ? "#f1c40f" : "#222");
        const dx = door.x ?? canvas.width / 2, dy = door.y ?? canvas.height / 2;
        if (dir === 'top') ctx.fillRect(dx - DOOR_SIZE / 2, 0, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'bottom') ctx.fillRect(dx - DOOR_SIZE / 2, canvas.height - DOOR_THICKNESS, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'left') ctx.fillRect(0, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
        if (dir === 'right') ctx.fillRect(canvas.width - DOOR_THICKNESS, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
    });

    // 3. --- PORTAL ---
    if (roomData.isBoss && roomData.cleared) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Date.now() / 200);
        ctx.fillStyle = "#9b59b6"; ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.2;
        ctx.fillRect(-20, -20, 40, 40);
        ctx.rotate(-Date.now() / 100); ctx.strokeStyle = "#8e44ad"; ctx.lineWidth = 3;
        ctx.strokeRect(-25, -25, 50, 50);
        ctx.restore();
        ctx.globalAlpha = 1.0; // Reset alpha
        if (Math.hypot(player.x - canvas.width / 2, player.y - canvas.height / 2) < 40) gameWon();
    }

    // 4. --- PLAYER ---
    const isInv = player.invuln || Date.now() < (player.invulnUntil || 0);
    ctx.fillStyle = isInv ? 'rgba(255,255,255,0.7)' : '#5dade2';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fill();

    // 4.5 --- PARTICLE TRAILS ---
    // Drawing trails before bullets so they appear underneath
    if (typeof particles !== 'undefined') {
        particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0; // Reset alpha
    }

    // 5. --- GEOMETRY BULLETS ---
    bullets.forEach(b => {
        ctx.fillStyle = b.colour || 'yellow'; ctx.strokeStyle = b.colour || 'yellow';
        const s = b.size || 5;
        ctx.save(); ctx.translate(b.x, b.y);
        if (b.animated) ctx.rotate(b.spinAngle = (b.spinAngle || 0) + 0.15);
        ctx.beginPath();
        if (b.shape === 'triangle') { ctx.moveTo(0, -s); ctx.lineTo(s, s); ctx.lineTo(-s, s); ctx.closePath(); }
        else if (b.shape === 'square') ctx.rect(-s, -s, s * 2, s * 2);
        else if (b.shape === 'rectangle') ctx.rect(-s * 1.5, -s, s * 3, s * 2);
        else ctx.arc(0, 0, s, 0, Math.PI * 2);
        b.filled ? ctx.fill() : ctx.stroke();
        ctx.restore();
    });

    // 6. --- BOMBS ---
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i]; const now = Date.now();
        if (!b.exploding && now >= b.explodeAt) { b.exploding = true; b.explosionStartAt = now; }
        if (b.exploding) {
            const p = Math.min(1, (now - b.explosionStartAt) / b.explosionDuration), r = b.baseR + (b.maxR - b.baseR) * p;
            // --- Inside Section 6: BOMBS ---
            if (b.canDamagePlayer && !b.didPlayerDamage && !isInv && Math.hypot(player.x - b.x, player.y - b.y) < r + player.size) {
                player.hp -= b.damage;
                b.didPlayerDamage = true;
                player.invulnUntil = now + 1000;
                screenShake.power = 10;
                screenShake.endAt = now + 200;

                // --- RESTORE KNOCKBACK ---
                const angle = Math.atan2(player.y - b.y, player.x - b.x);
                const pushForce = 40; // Strength of the blast push
                player.x += Math.cos(angle) * pushForce;
                player.y += Math.sin(angle) * pushForce;

                // Boundary Check: Ensure the bomb doesn't push you outside the walls
                player.x = Math.max(BOUNDARY, Math.min(canvas.width - BOUNDARY, player.x));
                player.y = Math.max(BOUNDARY, Math.min(canvas.height - BOUNDARY, player.y));
            }
            if (!b.didDamage) {
                b.didDamage = true;
                enemies.forEach((en, ei) => { if (Math.hypot(en.x - b.x, en.y - b.y) < b.maxR + en.size) { en.hp -= b.damage; if (en.hp <= 0) enemies.splice(ei, 1); } });
            }
            ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = b.explosionColour;
            ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            if (p >= 1) bombs.splice(i, 1);
        } else { ctx.fillStyle = b.colour; ctx.beginPath(); ctx.arc(b.x, b.y, b.baseR, 0, Math.PI * 2); ctx.fill(); }
    }

    // 7. --- BOSS/ENEMIES ---
    if (roomData.isBoss && !roomData.cleared && Date.now() < (bossIntroEndTime || 0)) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 50px 'Courier New'"; ctx.textAlign = "center";
        const bossName = (enemyTemplates["boss"]?.name || "BOSS").toUpperCase();
        ctx.fillText(bossName, canvas.width / 2, canvas.height / 2);
    } else {
        enemies.forEach(en => {
            ctx.fillStyle = Date.now() < en.freezeUntil ? "#3498db" : (en.color || "#e74c3c");
            ctx.beginPath(); ctx.arc(en.x, en.y, en.size, 0, Math.PI * 2); ctx.fill();
        });
    }

    // 8. --- UI ---
    if (isShaking) ctx.restore();
    drawMinimap(); drawTutorial();
    requestAnimationFrame(() => { update(); draw(); });
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

    // Inside draw()
    if (typeof particles !== 'undefined') {
        particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }


    mctx.restore();
}
function gameWon() {
    gameState = STATES.GAMEOVER;
    overlayEl.style.display = 'flex';
    statsEl.innerText = "VICTORY! You cleared the dungeon!";
    document.querySelector('#overlay h1').innerText = "You Won!";
}