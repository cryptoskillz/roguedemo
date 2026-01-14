// window.onload = function () {
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hpEl = document.getElementById('hp');
const keysEl = document.getElementById('keys');
const roomEl = document.getElementById('room');
const playerEl = document.getElementById('player');
const overlayEl = document.getElementById('overlay');
const welcomeEl = document.getElementById('welcome');
const uiEl = document.getElementById('ui');
const statsEl = document.getElementById('stats');
const perfectEl = document.getElementById('perfect');
const roomNameEl = document.getElementById('roomName');
const mapCanvas = document.getElementById('minimapCanvas');
const mctx = mapCanvas.getContext('2d');

// --- Game State ---
let player = {
    x: 300, y: 200, speed: 4, hp: 3, roomX: 0, roomY: 0,
    inventory: { keys: 0 },
    size: 20
};
let bullets = [];
let enemies = [];
let keys = {};

let bulletsInRoom = 0;
let hitsInRoom = 0;
let perfectStreak = 0;
let gameData = { perfectGoal: 3 };

const STATES = { START: 0, PLAY: 1, GAMEOVER: 2 };
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
    hpEl.innerText = player.hp;
    keysEl.innerText = player.inventory.keys;
    roomEl.innerText = `${player.roomX},${player.roomY}`;
    roomNameEl.innerText = roomData.name || "Unknown Room";
    // console.log(player);
    if (DEBUG_PLAYER) {
        const playerDup = structuredClone(player);
        playerEl.innerText = `Player: ${JSON.stringify(playerDup, null, 2)}`;
    }
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

        // Boss room logic - ensure only entry is open
        if (data.isBoss) {
            // Find which neighbor is in goldenPath just before boss
            const bossIndex = goldenPath.indexOf(coord);
            if (bossIndex > 0) {
                const prevCoord = goldenPath[bossIndex - 1];
                const [prx, pry] = prevCoord.split(',').map(Number);
                const entryDir = prx < rx ? "left" : (prx > rx ? "right" : (pry < ry ? "top" : "bottom"));

                // Close all doors except entry
                ["top", "bottom", "left", "right"].forEach(dir => {
                    if (data.doors[dir]) data.doors[dir].active = (dir === entryDir ? 1 : 0);
                });
            }
        }
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

// configurations
// configurations
async function initGame(isRestart = false) {
    gameState = isRestart ? STATES.PLAY : STATES.START;
    overlayEl.style.display = 'none';
    welcomeEl.style.display = isRestart ? 'none' : 'flex';
    if (uiEl) uiEl.style.display = isRestart ? 'block' : 'none';
    bullets = [];

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
            fetch('player.json?t=' + Date.now()).then(res => res.json()),
            fetch('game.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 })),
            fetch('rooms/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] }))
        ]);

        gameData = gData;
        roomManifest = mData;

        // Ensure player maintains inventory structure if not present in player.json
        if (pData.inventory === undefined) pData.inventory = { keys: 0 };
        Object.assign(player, pData);

        // 2. Pre-load ALL room templates
        roomTemplates = {};
        const templatePromises = [];

        // Always load start and boss
        templatePromises.push(fetch('rooms/start/room.json?t=' + Date.now()).then(res => res.json()).then(data => roomTemplates["start"] = data));
        templatePromises.push(fetch('rooms/boss1/room.json?t=' + Date.now()).then(res => res.json()).then(data => roomTemplates["boss"] = data));

        // Load all from manifest
        roomManifest.rooms.forEach(id => {
            templatePromises.push(fetch(`rooms/${id}/room.json?t=` + Date.now()).then(res => res.json()).then(data => roomTemplates[id] = data));
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
window.addEventListener('keyup', e => keys[e.code] = false);

function spawnEnemies() {
    enemies = [];

    const freezeUntil = Date.now() + 1000;
    player.invulnUntil = freezeUntil;

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
        roomStartTime = Date.now();
        keyUsedForRoom = keyWasUsedForThisRoom; // Apply key usage penalty to next room

        // If you enter a room through a door, it must be open (unlocked)
        if (roomData.doors) {
            const entryDoor = dx === 1 ? "left" : (dx === -1 ? "right" : (dy === 1 ? "top" : "bottom"));
            if (roomData.doors[entryDoor]) {
                roomData.doors[entryDoor].locked = 0;
            }
        }

        if (roomData.isBoss) {
            bossIntroEndTime = Date.now() + 2000;
        }

        if (!nextEntry.cleared) {
            spawnEnemies();
        } else {
            enemies = [];
        }
    } else {
        console.error("Critical: Room not found in levelMap at", nextCoord);
        // Fallback: stay in current room but reset coords
        player.roomX -= dx;
        player.roomY -= dy;
    }
}



function update() {

    if (gameState !== STATES.PLAY) return;

    // Player Movement
    const roomLocked = enemies.length > 0;
    const doors = roomData.doors || {};

    // Auto-clear current room in cache if empty
    if (!roomLocked) {
        const currentCoord = `${player.roomX},${player.roomY}`;
        if (visitedRooms[currentCoord] && !visitedRooms[currentCoord].cleared) {
            visitedRooms[currentCoord].cleared = true;
            if (roomData.isBoss) {
                perfectEl.innerText = "BOSS CLEARED!";
                perfectEl.style.display = 'block';
                setTimeout(() => perfectEl.style.display = 'none', 5000);
            }
        }
    }

    if (keys['KeyW']) {
        const door = doors.top || { active: 0, locked: 0 };
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        const inDoorRange = player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        // Unlocking on touch with K key
        if (!roomLocked && door.active && door.locked && player.inventory && player.inventory.keys > 0 && player.y <= BOUNDARY + 5 && inDoorRange && keys['KeyK']) {
            player.inventory.keys--;
            keysEl.innerText = player.inventory.keys;
            door.locked = 0;
            door.unlockedByKey = true;
            console.log("Top door unlocked via K key");
            keys['KeyK'] = false;
        }

        if (player.y > BOUNDARY || (inDoorRange && canPass)) {
            player.y -= player.speed;
        }
    }
    if (keys['KeyS']) {
        const door = doors.bottom || { active: 0, locked: 0 };
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        const inDoorRange = player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        // Unlocking on touch with K key
        if (!roomLocked && door.active && door.locked && player.inventory && player.inventory.keys > 0 && player.y >= canvas.height - BOUNDARY - 5 && inDoorRange && keys['KeyK']) {
            player.inventory.keys--;
            keysEl.innerText = player.inventory.keys;
            door.locked = 0;
            door.unlockedByKey = true;
            console.log("Bottom door unlocked via K key");
            keys['KeyK'] = false;
        }

        if (player.y < canvas.height - BOUNDARY || (inDoorRange && canPass)) {
            player.y += player.speed;
        }
    }
    if (keys['KeyA']) {
        const door = doors.left || { active: 0, locked: 0 };
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        const inDoorRange = player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        // Unlocking on touch with K key
        if (!roomLocked && door.active && door.locked && player.inventory && player.inventory.keys > 0 && player.x <= BOUNDARY + 5 && inDoorRange && keys['KeyK']) {
            player.inventory.keys--;
            keysEl.innerText = player.inventory.keys;
            door.locked = 0;
            door.unlockedByKey = true;
            console.log("Left door unlocked via K key");
            keys['KeyK'] = false;
        }

        if (player.x > BOUNDARY || (inDoorRange && canPass)) {
            player.x -= player.speed;
        }
    }
    if (keys['KeyD']) {
        const door = doors.right || { active: 0, locked: 0 };
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        const inDoorRange = player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
        const canPass = door.active && !door.locked && !roomLocked;

        // Unlocking on touch with K key
        if (!roomLocked && door.active && door.locked && player.inventory && player.inventory.keys > 0 && player.x >= canvas.width - BOUNDARY - 5 && inDoorRange && keys['KeyK']) {
            player.inventory.keys--;
            keysEl.innerText = player.inventory.keys;
            door.locked = 0;
            door.unlockedByKey = true;
            console.log("Right door unlocked via K key");
            keys['KeyK'] = false;
        }

        if (player.x < canvas.width - BOUNDARY || (inDoorRange && canPass)) {
            player.x += player.speed;
        }
    }

    // Cheat Keys
    if (CHEATS_ENABLED && keys['KeyL']) {
        player.inventory.keys++;
        keysEl.innerText = player.inventory.keys;
        keys['KeyL'] = false; // Prevents spam
    }

    if (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']) {
        if (Date.now() - (player.lastShot || 0) > 300) {
            bulletsInRoom++;
            let vx = 0, vy = 0;
            if (keys['ArrowUp']) vy = -7;
            else if (keys['ArrowDown']) vy = 7;
            else if (keys['ArrowLeft']) vx = -7;
            else if (keys['ArrowRight']) vx = 7;

            bullets.push({ x: player.x, y: player.y, vx, vy, life: 60 });
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
        b.x += b.vx;
        b.y += b.vy;
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
                const isFrozen = Date.now() < en.freezeUntil;
                if (!isFrozen) {
                    en.hp--;
                    hitsInRoom++;
                    bullets.splice(bi, 1);
                    if (en.hp <= 0) {
                        enemies.splice(ei, 1);
                        if (enemies.length === 0) {
                            const currentCoord = `${player.roomX},${player.roomY}`;
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
                                if (Math.random() < 0.1) {
                                    msg = "ROOM BONUS!";
                                }
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
            const currentCoord = `${player.roomX},${player.roomY}`;
            if (visitedRooms[currentCoord] && visitedRooms[currentCoord].cleared) {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const distToPortal = Math.hypot(player.x - cx, player.y - cy);

                // console.log(`Portal Check - Dist: ${distToPortal.toFixed(2)} | Player: ${player.x.toFixed(0)},${player.y.toFixed(0)} | Center: ${cx},${cy}`);

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
        if (pDist < 20) {
            const isInvuln = player.invuln || Date.now() < player.invulnUntil;
            // Very basic "iframes" logic
            if (!isInvuln) {
                player.hp--;
                hpEl.innerText = player.hp;
                player.invuln = true;
                setTimeout(() => player.invuln = false, 1000);
            }
        }
    });

    if (player.hp <= 0) {
        gameOver();
    }
}

function gameOver() {
    gameState = STATES.GAMEOVER;
    overlayEl.style.display = 'flex';
    statsEl.innerText = "Rooms cleared: " + (Math.abs(player.roomX) + Math.abs(player.roomY));
    document.querySelector('#overlay h1').innerText = "Game Over";
}

function gameWon() {
    gameState = STATES.GAMEOVER;
    overlayEl.style.display = 'flex';
    statsEl.innerText = "Rooms cleared: " + (Math.abs(player.roomX) + Math.abs(player.roomY));
    document.querySelector('#overlay h1').innerText = "VICTORY!";
    document.querySelector('#overlay h1').style.color = "#f1c40f"; // Gold for victory
}

function restartGame() {
    initGame(true);
}

function goToWelcome() {
    initGame(false);
}

async function draw() {
    await updateUI();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

    // Draw Bullets
    ctx.fillStyle = 'yellow';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Boss Intro Sequence
    if (roomData.isBoss) {
        if (Date.now() < bossIntroEndTime) {
            // Draw Boss Name during intro
            ctx.fillStyle = "#e74c3c"; // Red text for visibility
            ctx.font = "bold 50px 'Courier New'"; // Matched Font
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(roomData.bossName || "BOSS", canvas.width / 2, canvas.height / 2);

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
        }
    }


    // Draw Portal (only if cleared and NOT in intro)
    if (roomData.isBoss && (!bossIntroEndTime || Date.now() > bossIntroEndTime)) {
        const currentCoord = `${player.roomX},${player.roomY}`;
        if (visitedRooms[currentCoord] && visitedRooms[currentCoord].cleared) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const time = Date.now() / 200;
            const distToPortal = Math.hypot(player.x - cx, player.y - cy);

            console.log(`Portal Check - Dist: ${distToPortal.toFixed(2)} | Player: ${player.x.toFixed(0)},${player.y.toFixed(0)} | Center: ${cx},${cy}`);

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