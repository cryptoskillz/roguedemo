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

// --- Game State ---
let player = {
    x: 300, y: 200, speed: 4, hp: 3, roomX: 0, roomY: 0,
    inventory: { keys: 0 },
    size: 20
};
let bullets = [];
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

// configurations
// configurations
async function initGame(isRestart = false) {
    if (debugPanel) debugPanel.style.display = DEBUG_WINDOW_ENABLED ? 'flex' : 'none';
    gameState = isRestart ? STATES.PLAY : STATES.START;
    overlayEl.style.display = 'none';
    welcomeEl.style.display = isRestart ? 'none' : 'flex';
    if (uiEl) uiEl.style.display = isRestart ? 'block' : 'none';
    bullets = [];
    bombs = [];

    //check if debug mode is enabled and if so show the room cords
    if (DEBUG_WINDOW_ENABLED) {
        roomEl.style.display = 'block';
    } else {
        roomEl.style.display = 'none';
    }

    // Reset player
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

        // Ensure player maintains inventory structure if not present in player.json
        if (pData.inventory === undefined) pData.inventory = { keys: 0 };
        Object.assign(player, pData);

        //2. load the bomb and gun data
        const [bData, gunData] = await Promise.all([
            fetch(`/json/weapons/bombs/${player.bombType}.json?t=` + Date.now()).then(res => res.json()),
            fetch(`/json/weapons/guns/${player.gunType}.json?t=` + Date.now()).then(res => res.json()),

        ])

        bomb = bData;
        gun = gunData;

        // 2. Pre-load ALL room templates
        roomTemplates = {};
        const templatePromises = [];

        // Always load start and boss
        templatePromises.push(fetch('/json/rooms/start/room.json?t=' + Date.now()).then(res => res.json()).then(data => roomTemplates["start"] = data));
        templatePromises.push(fetch('/json/rooms/boss1/room.json?t=' + Date.now()).then(res => res.json()).then(data => roomTemplates["boss"] = data));

        // Load all from manifest
        roomManifest.rooms.forEach(id => {
            templatePromises.push(fetch(`/json/rooms/${id}/room.json?t=` + Date.now()).then(res => res.json()).then(data => roomTemplates[id] = data));
        });

        await Promise.all(templatePromises);
        console.log("All room templates loaded:", Object.keys(roomTemplates));

        // 3. Pre-load ALL enemy templates
        enemyTemplates = {};
        const enemyManifest = await fetch('enemies/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ enemies: [] }));
        const ePromises = enemyManifest.enemies.map(id =>
            fetch(`enemies/${id}.json?t=` + Date.now())
                .then(res => res.json())
                .then(data => enemyTemplates[id] = data)
        );
        await Promise.all(ePromises);
        console.log("All enemy templates loaded:", Object.keys(enemyTemplates));

        // 4. Generate Level
        if (DEBUG_START_BOSS) {
            console.log("DEBUG MODE: Starting in Boss Room");
            bossCoord = "0,0";
            goldenPath = ["0,0"];
            bossIntroEndTime = Date.now() + 2000;
            // Create a minimal level map for debug
            levelMap["0,0"] = { roomData: JSON.parse(JSON.stringify(roomTemplates["boss"])), cleared: false };
        } else {
            generateLevel(gameData.NoRooms || 11);
        }

        // Set initial room from levelMap
        const startEntry = levelMap["0,0"];
        roomData = startEntry.roomData;
        visitedRooms["0,0"] = startEntry;

        canvas.width = roomData.width || 800;
        canvas.height = roomData.height || 600;

        if (gameState === STATES.PLAY) spawnEnemies();

        if (!gameLoopStarted) {
            gameLoopStarted = true;
            draw(); // Start loop only once
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
    /*
    0 = normal
    1= north
    2 = east
    3 = south
    4 = west
    360 = 360 degres
    */
    //check if the have bullets, they are in a mode where no bullets should be fired
    if (gun.Bullet?.NoBullets) {
        return;
    }
    if (direction === 0) {
        bullets.push({
            x: player.x,
            y: player.y,
            vx,
            vy,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homming,
            hitEnemies: []
        });

    }

    //360 degrees
    if (direction === 360) {
        for (let i = 0; i < 360; i++) {
            bullets.push({
                x: player.x,
                y: player.y,
                vx: Math.cos(i * Math.PI / 180) * speed,
                vy: Math.sin(i * Math.PI / 180) * speed,
                life: gun.Bullet?.range || 60,
                damage: gun.Bullet?.damage || 1,
                size: gun.Bullet?.size || 5,
                curve: gun.Bullet?.curve || 0,
                homing: gun.Bullet?.homming,
                hitEnemies: []
            });
        }
    }

    //up
    if (direction === 1) {
        bullets.push({
            x: player.x,
            y: player.y,
            vx: 0,
            vy: -speed,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homming,
            hitEnemies: []
        });
    }
    //right
    if (direction === 2) {
        bullets.push({
            x: player.x,
            y: player.y,
            vx: speed,
            vy: 0,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homming,
            hitEnemies: []
        });
    }

    //down
    if (direction === 3) {
        bullets.push({
            x: player.x,
            y: player.y,
            vx: 0,
            vy: speed,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homming,
            hitEnemies: []
        });
    }
    if (direction === 4) {
        bullets.push({
            x: player.x,
            y: player.y,
            vx: -speed,
            vy: 0,
            life: gun.Bullet?.range || 60,
            damage: gun.Bullet?.damage || 1,
            size: gun.Bullet?.size || 5,
            curve: gun.Bullet?.curve || 0,
            homing: gun.Bullet?.homming,
            hitEnemies: []
        });
    }
}

// --- Generic "Use" action (SPACE) ---
// Call this once per frame near the top of update(), BEFORE the WASD blocks.
function tryUse() {
    if (!keys["Space"]) return;

    // consume input so it fires once
    keys["Space"] = false;

    if (gameState !== STATES.PLAY) return;

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

    // Player Movement
    const roomLocked = enemies.length > 0;
    const doors = roomData.doors || {};

    // Auto-clear current room in cache if empty
    if (!roomLocked) {
        const currentCoord = `${player.roomX}, ${player.roomY}`;
        if (visitedRooms[currentCoord] && !visitedRooms[currentCoord].cleared) {
            visitedRooms[currentCoord].cleared = true;
            if (roomData.isBoss) {
                perfectEl.innerText = "BOSS CLEARED!";
                perfectEl.style.display = 'block';
                setTimeout(() => perfectEl.style.display = 'none', 5000);
            }
        }
    }

    if (keys['KeyM']) {
        gameMenu();
    }

    if (keys['KeyR'] && DEBUG_WINDOW_ENABLED) {
        restartGame();
    }
    tryUse()

    // --- Movement blocks (WASD) ---
    // Replace your current 4 movement blocks with these versions.
    // The only change: the unlock logic is removed (SPACE handles it), movement stays same.

    if (keys["KeyW"]) {
        player.lastMoveX = 0;
        player.lastMoveY = -1;

        const door = doors.top || { active: 0, locked: 0 };
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        const inDoorRange = player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        if (player.y > BOUNDARY || (inDoorRange && canPass)) {
            player.y -= player.speed;
        }
    }

    if (keys["KeyS"]) {
        player.lastMoveX = 0;
        player.lastMoveY = 1;

        const door = doors.bottom || { active: 0, locked: 0 };
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        const inDoorRange = player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        if (player.y < canvas.height - BOUNDARY || (inDoorRange && canPass)) {
            player.y += player.speed;
        }
    }

    if (keys["KeyA"]) {
        player.lastMoveX = -1;
        player.lastMoveY = 0;

        const door = doors.left || { active: 0, locked: 0 };
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        const inDoorRange = player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        if (player.x > BOUNDARY || (inDoorRange && canPass)) {
            player.x -= player.speed;
        }
    }

    if (keys["KeyD"]) {
        player.lastMoveX = 1;
        player.lastMoveY = 0;

        const door = doors.right || { active: 0, locked: 0 };
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        const inDoorRange = player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        if (player.x < canvas.width - BOUNDARY || (inDoorRange && canPass)) {
            player.x += player.speed;
        }
    }



    //check for bomb
    if (keys['KeyB']) {
        if (player.inventory && player.inventory.bombs > 0) {
            player.inventory.bombs--;
            //bombsInRoom++;
            keys['KeyB'] = false;
            dropBomb();
        }
        updateUI();
    }

    // Cheat Keys
    if (CHEATS_ENABLED && keys['KeyL']) {
        player.inventory.keys++;
        keysEl.innerText = player.inventory.keys;
        keys['KeyL'] = false; // Prevents spam
    }

    if (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']) {
        const fireDelay = (gun.Bullet?.fireRate !== undefined ? gun.Bullet.fireRate : 0.3) * 1000;
        if (Date.now() - (player.lastShot || 0) > fireDelay) {
            bulletsInRoom++;
            let baseAngle = 0;
            if (keys['ArrowUp']) baseAngle = -Math.PI / 2;
            else if (keys['ArrowDown']) baseAngle = Math.PI / 2;
            else if (keys['ArrowLeft']) baseAngle = Math.PI;
            else if (keys['ArrowRight']) baseAngle = 0;

            if (gun.Bullet?.homming) {
                if (enemies.length === 0) return;
                let nearest = null;
                let minDist = Infinity;
                enemies.forEach(en => {
                    let d = Math.hypot(player.x - en.x, player.y - en.y);
                    if (d < minDist) {
                        minDist = d;
                        nearest = en;
                    }
                });
                if (nearest) {
                    baseAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
                }
            }

            const bulletCount = gun.Bullet?.number || 1;
            const spreadRate = gun.Bullet?.spreadRate || 0.2; // Radians between streams

            for (let i = 0; i < bulletCount; i++) {
                let angle = baseAngle;

                if (bulletCount > 1) {
                    // Center the arc
                    angle += (i - (bulletCount - 1) / 2) * spreadRate;
                }

                if (gun.Bullet?.spread) {
                    angle += (Math.random() - 0.5) * gun.Bullet.spread;
                }

                const speed = gun.Bullet?.speed || 7;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                // topAndBottom mode: fire one bullet north and one south
                if (gun.Bullet?.multiDirectional.active) {
                    if (gun.Bullet?.multiDirectional.fire360) {
                        // All Directional mode: fire in all directions
                        fireBullet(360, speed, vx, vy, angle)
                    }

                    else {
                        if (gun.Bullet?.multiDirectional.fireNorth) {
                            // North bullet (up)
                            fireBullet(1, speed, vx, vy, angle);
                        }
                        if (gun.Bullet?.multiDirectional.fireEast) {
                            // East bullet (right)
                            fireBullet(2, speed, vx, vy, angle);
                        }
                        if (gun.Bullet?.multiDirectional.fireSouth) {
                            // South bullet (down)
                            fireBullet(3, speed, vx, vy, angle);
                        }
                        if (gun.Bullet?.multiDirectional.fireWest) {
                            // West bullet (left)
                            fireBullet(4, speed, vx, vy, angle);
                        }
                    }
                }
                else {
                    // Normal mode: fire in aimed direction
                    fireBullet(0)
                    //check if backFire is active and if it is then fire the opposite arrow key
                    if (gun.Bullet?.backfire) {
                        if (keys['ArrowUp']) {
                            // South bullet (down)
                            fireBullet(3, speed, vx, vy, angle);
                        }
                        if (keys['ArrowDown']) {
                            // North bullet (up)
                            fireBullet(1, speed, vx, vy, angle);
                        }
                        if (keys['ArrowLeft']) {
                            // East bullet (right)
                            fireBullet(2, speed, vx, vy, angle);

                        }
                        if (keys['ArrowRight']) {
                            // West bullet (left)
                            fireBullet(4, speed, vx, vy, angle);
                        }
                    }
                    else if (gun.Bullet?.frontLocked) {
                        //fire the bullet in the direction the player is moving, if the player is not moving then fire the bullet in the direction the player is looking
                        //looking should only work if the player is not moving ie no wasd key is pressed
                        if (!keys['KeyS'] && !keys['KeyW'] && !keys['KeyA'] && !keys['KeyD']) {
                            if (keys['ArrowUp']) {
                                // North bullet (up)
                                fireBullet(1, speed, vx, vy, angle);
                            }
                            if (keys['ArrowDown']) {
                                // South bullet (down)
                                fireBullet(3, speed, vx, vy, angle);
                            }
                            if (keys['ArrowLeft']) {
                                // West bullet (left)
                                fireBullet(4, speed, vx, vy, angle);
                            }
                            if (keys['ArrowRight']) {
                                // East bullet (right)
                                fireBullet(2, speed, vx, vy, angle);
                            }
                        }
                        else {
                            //if the player is moving then fire the bullet in the direction the player is moving
                            if (keys['KeyS']) {
                                fireBullet(3, speed, vx, vy, angle);
                            }
                            if (keys['KeyW']) {
                                fireBullet(1, speed, vx, vy, angle);
                            }
                            if (keys['KeyA']) {
                                fireBullet(4, speed, vx, vy, angle);
                            }
                            if (keys['KeyD']) {
                                fireBullet(2, speed, vx, vy, angle);
                            }

                        }
                    }
                    else {
                        //fire in the direction the player is looking, default fire 
                        fireBullet(0, speed, vx, vy, angle);
                    }



                }

            }
            player.lastShot = Date.now();
        }
    }

    // Room Transitions (Doors - strictly locked until enemies cleared)
    const d = roomData.doors || {};
    if (!roomLocked) {
        if (player.x < 10 && d.left && d.left.active) changeRoom(-1, 0);
        if (player.x > canvas.width - 10 && d.right && d.right.active) changeRoom(1, 0);
        if (player.y < 10 && d.top && d.top.active) changeRoom(0, -1);
        if (player.y > canvas.height - 10 && d.bottom && d.bottom.active) changeRoom(0, 1);
    }

    // Bullet Logic
    bullets.forEach((b, i) => {
        if (b.homing && enemies.length > 0) {
            let nearest = null;
            let minDist = Infinity;
            enemies.forEach(en => {
                let d = Math.hypot(b.x - en.x, b.y - en.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = en;
                }
            });
            if (nearest) {
                let desiredAngle = Math.atan2(nearest.y - b.y, nearest.x - b.x);
                let currentAngle = Math.atan2(b.vy, b.vx);
                let speed = Math.hypot(b.vx, b.vy);
                let diff = desiredAngle - currentAngle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                let steerAmount = 0.1;
                if (Math.abs(diff) < steerAmount) currentAngle = desiredAngle;
                else currentAngle += Math.sign(diff) * steerAmount;
                b.vx = Math.cos(currentAngle) * speed;
                b.vy = Math.sin(currentAngle) * speed;
            }
        }
        if (b.curve) {
            let speed = Math.hypot(b.vx, b.vy);
            let angle = Math.atan2(b.vy, b.vx);
            angle += b.curve; // curve as angle delta per frame
            b.vx = Math.cos(angle) * speed;
            b.vy = Math.sin(angle) * speed;
        }
        b.x += b.vx;
        b.y += b.vy;

        if (gun.Bullet?.wallBounce) {
            if (b.x < 0) { b.x = 0; b.vx = -b.vx; }
            if (b.x > canvas.width) { b.x = canvas.width; b.vx = -b.vx; }
            if (b.y < 0) { b.y = 0; b.vy = -b.vy; }
            if (b.y > canvas.height) { b.y = canvas.height; b.vy = -b.vy; }
        }
        b.life--;
        if (b.life <= 0) bullets.splice(i, 1);
    });

    // Enemy AI & Collision
    enemies.forEach((en, ei) => {
        const isFrozen = Date.now() < en.freezeUntil;

        if (!isFrozen) {
            // Move toward player
            let angle = Math.atan2(player.y - en.y, player.x - en.x);
            en.x += Math.cos(angle) * en.speed;
            en.y += Math.sin(angle) * en.speed;
        }

        // Bullet hit enemy
        bullets.forEach((b, bi) => {
            let dist = Math.hypot(b.x - en.x, b.y - en.y);
            if (dist < en.size) {
                // For piercing bullets, check if this enemy was already hit
                if (gun.Bullet?.pierce && b.hitEnemies && b.hitEnemies.includes(ei)) {
                    return; // Skip this enemy, already hit by this bullet
                }

                // Explosion Logic
                if (gun.Bullet?.Explode?.active && !b.isShard) {
                    const shardCount = gun.Bullet.Explode.shards || 8;
                    const step = (Math.PI * 2) / shardCount;
                    for (let i = 0; i < shardCount; i++) {
                        const angle = step * i;
                        bullets.push({
                            x: b.x,
                            y: b.y,
                            vx: Math.cos(angle) * (gun.Bullet?.speed || 7),
                            vy: Math.sin(angle) * (gun.Bullet?.speed || 7),
                            life: gun.Bullet.Explode.shardRange || 30,
                            damage: gun.Bullet.Explode.damage || 0.1,
                            size: gun.Bullet.Explode.size || 2,
                            isShard: true
                        });
                    }
                }

                // Only destroy bullet if not piercing
                if (!gun.Bullet?.pierce) {
                    bullets.splice(bi, 1);
                } else {
                    // Track that this bullet hit this enemy
                    if (!b.hitEnemies) b.hitEnemies = [];
                    b.hitEnemies.push(ei);
                    // Halve damage after each pierce
                    b.damage = (b.damage || 1) / 2;
                    // Destroy bullet if damage is too low
                    if (b.damage <= 0) {
                        bullets.splice(bi, 1);
                    }
                }

                const isFrozen = Date.now() < en.freezeUntil;
                if (!isFrozen) {
                    en.hp -= (b.damage || 1);
                    hitsInRoom++;

                    if (en.hp <= 0) {
                        enemies.splice(ei, 1);
                        if (enemies.length === 0) {
                            const currentCoord = `${player.roomX}, ${player.roomY}`;
                            if (visitedRooms[currentCoord]) visitedRooms[currentCoord].cleared = true;

                            const isPerfect = bulletsInRoom === hitsInRoom && bulletsInRoom > 0;
                            const elapsed = (Date.now() - roomStartTime) / 1000;
                            const isSpeedy = (roomData.speedGoal > 0) && (elapsed <= roomData.speedGoal);

                            let msg = "";
                            if (!keyUsedForRoom) {
                                if (isPerfect) {
                                    perfectStreak++;

                                    if (perfectStreak >= (gameData.perfectGoal || 3)) {
                                        player.perfectCount++;
                                        player.perfectTotalCount++;
                                        player.perfectCount = 0;
                                        msg = "PERFECT BONUS!"; // Bonus takes priority over combo text
                                    } else {
                                        player.perfectCount++;
                                        player.perfectTotalCount++;
                                        player.speedCount++;
                                        player.speedTotalCount++;
                                        msg = isSpeedy ? "SPEEDY PERFECT!" : "PERFECT!";
                                    }
                                } else if (isSpeedy) {
                                    msg = "SPEEDY!";
                                    perfectStreak = 0;
                                    player.speedCount++;
                                    player.speedTotalCount++;
                                } else {
                                    perfectStreak = 0;
                                    player.speedCount = 0;
                                    player.perfectCount = 0;
                                }
                            } else {
                                // Room bonus now awarded on entry
                            }

                            if (msg) {
                                perfectEl.innerText = msg;
                                perfectEl.style.display = 'block';
                                // Reset animation to ensure it plays again
                                perfectEl.style.animation = 'none';
                                perfectEl.offsetHeight; /* trigger reflow */
                                perfectEl.style.animation = null;
                                setTimeout(() => perfectEl.style.display = 'none', 2000);
                            }
                        }
                    }
                }
            }
        });

        // Portal Collision (Boss Room Victory)
        if (roomData.isBoss) {
            const currentCoord = `${player.roomX}, ${player.roomY}`;
            if (visitedRooms[currentCoord] && visitedRooms[currentCoord].cleared) {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const distToPortal = Math.hypot(player.x - cx, player.y - cy);

                // console.log(`Portal Check - Dist: ${ distToPortal.toFixed(2) } | Player: ${ player.x.toFixed(0) }, ${ player.y.toFixed(0) } | Center: ${ cx }, ${ cy }`);

                if (distToPortal < 50) {
                    console.log("VICTORY TRIGGERED!");
                    gameWon();
                }

                const time = Date.now() / 200;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(time);
                ctx.fillStyle = "#9b59b6";
                ctx.fillRect(-15, -15, 30, 30);
                ctx.rotate(-time * 2);
                ctx.strokeStyle = "#8e44ad";
                ctx.lineWidth = 3;
                ctx.strokeRect(-20, -20, 40, 40);
                ctx.restore();
            }
        }

        // Enemy hit player
        let pDist = Math.hypot(player.x - en.x, player.y - en.y);
        if (pDist < player.size + en.size) {
            playerHit(en, true, true, true);

        }
    });

    if (player.hp <= 0) {
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

async function draw() {
    await updateUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // --- Screen shake transform ---
    if (screenShake.power > 0) {
        const now = Date.now();
        if (now < screenShake.endAt) {
            const p = (screenShake.endAt - now) / (screenShake.endAt - (screenShake.endAt - 180)); // rough decay
            const strength = screenShake.power * Math.max(0, Math.min(1, p));

            ctx.save();
            ctx.translate(
                (Math.random() - 0.5) * strength,
                (Math.random() - 0.5) * strength
            );
        } else {
            screenShake.power = 0;
        }
    }


    // Draw Doors
    const roomLocked = enemies.length > 0;
    const doors = roomData.doors || {};
    const getDoorColor = (direction) => {
        if (roomLocked) return "#c0392b"; // Red if enemy-locked
        const door = doors[direction] || { locked: 0 };
        return door.locked ? "#f1c40f" : "#222"; // Yellow for key-locked, Dark for open
    };

    if (doors.top && doors.top.active) {
        ctx.fillStyle = getDoorColor('top');
        const doorX = doors.top.x !== undefined ? doors.top.x : canvas.width / 2;
        ctx.fillRect(doorX - DOOR_SIZE / 2, 0, DOOR_SIZE, DOOR_THICKNESS); // Top
    }
    if (doors.bottom && doors.bottom.active) {
        ctx.fillStyle = getDoorColor('bottom');
        const doorX = doors.bottom.x !== undefined ? doors.bottom.x : canvas.width / 2;
        ctx.fillRect(doorX - DOOR_SIZE / 2, canvas.height - DOOR_THICKNESS, DOOR_SIZE, DOOR_THICKNESS); // Bottom
    }
    if (doors.left && doors.left.active) {
        ctx.fillStyle = getDoorColor('left');
        const doorY = doors.left.y !== undefined ? doors.left.y : canvas.height / 2;
        ctx.fillRect(0, doorY - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE); // Left
    }
    if (doors.right && doors.right.active) {
        ctx.fillStyle = getDoorColor('right');
        const doorY = doors.right.y !== undefined ? doors.right.y : canvas.height / 2;
        ctx.fillRect(canvas.width - DOOR_THICKNESS, doorY - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE); // Right
    }

    // Draw Minimap
    drawMinimap();

    // Draw Player
    const isInvuln = player.invuln || Date.now() < player.invulnUntil;
    ctx.fillStyle = isInvuln ? 'white' : '#5dade2';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
    ctx.fill();

    // Reload Bar (when fire rate is > 1s)
    const fireRate = gun.Bullet?.fireRate !== undefined ? gun.Bullet.fireRate : 0.3;
    if (fireRate > 1) {
        const fireDelay = fireRate * 1000;
        const elapsed = Date.now() - (player.lastShot || 0);
        if (elapsed < fireDelay) {
            const barWidth = 40;
            const barHeight = 4;
            const bx = player.x - barWidth / 2;
            const by = player.y - player.size - 10;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(bx, by, barWidth, barHeight);

            // Progress (Cooldown)
            ctx.fillStyle = '#3498db'; // Nice blue for reload
            ctx.fillRect(bx, by, barWidth * (elapsed / fireDelay), barHeight);
        }
    }

    // Draw Bullets
    ctx.fillStyle = 'yellow';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 5, 0, Math.PI * 2);
        ctx.fill();
    });


    // Draw Bomb (if active)
    const now = Date.now();
    bombs.forEach(b => {
        const now = Date.now();

        for (let i = bombs.length - 1; i >= 0; i--) {
            const b = bombs[i];

            // Start exploding when timer runs out
            if (!b.exploding && now >= b.explodeAt) {
                b.exploding = true;
                b.explosionStartAt = now;
            }

            // EXPLOSION ANIMATION (from bomb edge outward)
            if (b.exploding) {
                const t = (now - b.explosionStartAt) / b.explosionDuration; // 0..1
                const p = Math.max(0, Math.min(1, t));

                // ey line: starts at baseR (bomb perimeter), grows to maxR
                const r = b.baseR + (b.maxR - b.baseR) * p;

                // --- Player damage + knockback + shake (once per bomb) ---
                if (b.canDamagePlayer && !b.didPlayerDamage && !player.invuln) {
                    const dist = Math.hypot(player.x - b.x, player.y - b.y);

                    if (dist <= r + player.size) {
                        b.didPlayerDamage = true;

                        // Damage
                        player.hp -= b.damage;
                        hpEl.innerText = player.hp;

                        // i-frames (your existing style)
                        player.invuln = true;
                        setTimeout(() => player.invuln = false, 1000);

                        // --- Knockback: push player OUTSIDE the blast radius ---
                        const dx = player.x - b.x;
                        const dy = player.y - b.y;
                        const len = Math.hypot(dx, dy) || 1;

                        const nx = dx / len;
                        const ny = dy / len;

                        // Push player to just outside the blast radius
                        const padding = 6;
                        const targetDist = b.maxR + player.size + padding;
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

                        // --- Screen shake (DO NOT depend on closeness anymore) ---
                        const explosionStrength = b.maxR / 40; // scale with explosion size
                        const shakePower = (b.shake || 8) * explosionStrength;

                        screenShake.power = Math.max(screenShake.power, shakePower);
                        screenShake.endAt = Date.now() + (b.shakeDuration || 200);

                    }
                }


                // Chain reaction: trigger other bombs inside current explosion radius
                for (let j = 0; j < bombs.length; j++) {
                    if (j === i) continue;
                    const other = bombs[j];

                    if (other.exploding) continue;           // already going
                    if (now < other.explodeAt) {             // still waiting (normal)
                        const dist = Math.hypot(other.x - b.x, other.y - b.y);

                        // if the other bomb's CENTER is inside this explosion radius (+ its base radius feels nicer)
                        if (dist <= r + (other.baseR || 0)) {
                            other.exploding = true;
                            other.explosionStartAt = now;
                            other.didDamage = false;             // ensure it deals damage
                            other.triggeredBy = b.id;            // optional debug
                        }
                    }
                }


                // optional: draw as a ring shockwave (feels more "explosion")
                ctx.save();
                ctx.fillStyle = b.explosionColour;
                ctx.beginPath();
                ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1 - p;
                ctx.strokeStyle = b.explosionColour;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                // Damage once (using maxR so it matches full blast)
                if (!b.didDamage) {
                    b.didDamage = true;
                    for (let ei = enemies.length - 1; ei >= 0; ei--) {
                        const e = enemies[ei];
                        const dist = Math.hypot(e.x - b.x, e.y - b.y);
                        if (dist <= b.maxR + e.size) {
                            e.hp = (e.hp ?? 0) - b.damage;
                            if (e.hp <= 0) enemies.splice(ei, 1);
                        }
                    }
                }

                // Remove after animation finishes
                if (p >= 1) bombs.splice(i, 1);
                continue;
            }

            // Waiting bomb (static)
            ctx.save();
            ctx.fillStyle = b.colour;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.baseR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

    });

    // Boss Intro Sequence
    if (roomData.isBoss && !roomData.cleared) {
        if (Date.now() < bossIntroEndTime) {
            // Draw Boss Name during intro
            ctx.fillStyle = "#e74c3c"; // Red text for visibility
            ctx.font = "bold 50px 'Courier New'"; // Matched Font
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const currentBossName = (enemyTemplates["boss"] && enemyTemplates["boss"].name) || "BOSS";
            ctx.fillText(currentBossName, canvas.width / 2, canvas.height / 2);

            // Don't draw enemies yet
        } else {
            // Draw enemies after intro
            //console.log("Drawing Enemies", roomData.bossName + ' ' + Date.now() + ' ' + bossIntroEndTime); // Debug log
            console.log("Enemies", enemies.length); // Debug log
            enemies.forEach((en, ei) => {
                ctx.fillStyle = en.color || "rgba(231, 76, 60, 0.8)";
                if (Date.now() < en.freezeUntil) {
                    ctx.fillStyle = "#3498db"; // Blue for frozen
                    ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.2;
                }

                ctx.beginPath();
                ctx.arc(en.x, en.y, en.size, 0, Math.PI * 2);
                ctx.fill();

                ctx.globalAlpha = 1.0; // Reset alpha
            });
        }
    } else {
        // Normal room enemy drawing
        enemies.forEach((en, ei) => {
            ctx.fillStyle = en.color || "rgba(231, 76, 60, 0.8)";
            if (Date.now() < en.freezeUntil) {
                ctx.fillStyle = "#3498db"; // Blue for frozen
                ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.2;
            }

            ctx.beginPath();
            ctx.arc(en.x, en.y, en.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1.0; // Reset alpha
        });
    }


    // Start Room Tutorial Text
    if (player.roomX === 0 && player.roomY === 0) {
        ctx.save();

        // Helper to draw a keycap
        function drawKey(text, x, y) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 2;

            // Keybox
            ctx.beginPath();
            ctx.roundRect(x - 20, y - 20, 40, 40, 5);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.font = "bold 20px 'Courier New'";
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, x, y);
        }

        // WASD (Left side)
        const lx = 200;
        const ly = canvas.height / 2;
        if (DEBUG_START_BOSS === false) {
            // Movement Icon (Running Stickman-ish)
            ctx.font = "16px 'Courier New'";
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.textAlign = "center";
            ctx.fillText("MOVE", lx, ly - 90);

            drawKey("W", lx, ly - 45);
            drawKey("A", lx - 45, ly);
            drawKey("S", lx, ly);
            drawKey("D", lx + 45, ly);

            // Arrows (Right side)
            const rx = canvas.width - 200;

            // Shooting Icon (Bullet)
            ctx.fillText("SHOOT", rx, ly - 90);
            // Draw a little bullet graphic
            ctx.beginPath();
            ctx.arc(rx, ly - 75, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#e74c3c"; // Red bullet color
            ctx.fill();
            // Speed lines
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.beginPath();
            ctx.moveTo(rx - 15, ly - 75); ctx.lineTo(rx - 8, ly - 75);
            ctx.moveTo(rx - 15, ly - 78); ctx.lineTo(rx - 10, ly - 78);
            ctx.moveTo(rx - 15, ly - 72); ctx.lineTo(rx - 10, ly - 72);
            ctx.stroke();

            drawKey("↑", rx, ly - 45);
            drawKey("←", rx - 45, ly);
            drawKey("→", rx + 45, ly);
            drawKey("↓", rx, ly + 45);

            // draw space bar
            let mx = canvas.width / 6;
            let my = canvas.height - 80;
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.fillText("ITEM", mx, my - 45);
            drawKey("⎵", mx, my);
            //restart
            mx = mx + 100
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.fillText("MENU", mx, my - 45);
            drawKey("M", mx, my);
            //bomb
            mx = mx + 100
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.fillText("BOMB", mx, my - 45);
            drawKey("B", mx, my);
            if (DEBUG_WINDOW_ENABLED) {
                mx = mx + 100
                ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
                ctx.fillText("RESTART", mx, my - 45);
                drawKey("R", mx, my);
            }
        }
    }


    // Draw Portal (only if cleared and NOT in intro)
    if (roomData.isBoss && (!bossIntroEndTime || Date.now() > bossIntroEndTime)) {
        const currentCoord = `${player.roomX}, ${player.roomY}`;
        if (visitedRooms[currentCoord] && visitedRooms[currentCoord].cleared) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const time = Date.now() / 200;
            const distToPortal = Math.hypot(player.x - cx, player.y - cy);

            console.log(`Portal Check - Dist: ${distToPortal.toFixed(2)} | Player: ${player.x.toFixed(0)}, ${player.y.toFixed(0)} | Center: ${cx}, ${cy}`);

            if (distToPortal < 50) {
                console.log("VICTORY TRIGGERED!");
                gameWon();
            }

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time);
            ctx.fillStyle = "#9b59b6";
            ctx.fillRect(-15, -15, 30, 30);
            ctx.rotate(-time * 2);
            ctx.strokeStyle = "#8e44ad";
            ctx.lineWidth = 3;
            ctx.strokeRect(-20, -20, 40, 40);
            // ctx.strokeStyle = "red";
            //ctx.lineWidth = 2;
            // ctx.stroke();
            ctx.restore();
        }

        // If we applied shake, restore the context
        if (screenShake.power > 0 && Date.now() < screenShake.endAt) {
            ctx.restore();
        }
    }
    requestAnimationFrame(() => {
        update();
        draw();
    });
    function gameWon() {
        gameState = STATES.GAMEOVER;
        overlayEl.style.display = 'flex';
        statsEl.innerText = "VICTORY! You cleared the dungeon!";
        document.querySelector('#overlay h1').innerText = "You Won!";
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
        mctx.restore();
    }
}