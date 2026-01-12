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
let bossCoord = "";
let bossIntroEndTime = 0;

function updateUI() {
    hpEl.innerText = player.hp;
    keysEl.innerText = player.inventory.keys;
    roomEl.innerText = `${player.roomX},${player.roomY}`;
    roomNameEl.innerText = roomData.name || "Unknown Room";
    console.log(DEBUG_PLAYER);
    if (DEBUG_PLAYER) {
        const playerDup = structuredClone(player);

        playerEl.innerText = `Player: ${JSON.stringify(playerDup, null, 2)}`;
    }
}

// --- Level Generation Logic ---
function generateGoldenPath(length) {
    let path = ["0,0"];
    let cx = 0, cy = 0;
    const dirs = [
        { dx: 0, dy: -1 }, // Top
        { dx: 0, dy: 1 },  // Bottom
        { dx: -1, dy: 0 }, // Left
        { dx: 1, dy: 0 }   // Right
    ];

    for (let i = 0; i < length; i++) {
        let possible = dirs.filter(d => !path.includes(`${cx + d.dx},${cy + d.dy}`));
        if (possible.length === 0) break; // Trapped, rare
        let move = possible[Math.floor(Math.random() * possible.length)];
        cx += move.dx;
        cy += move.dy;
        path.push(`${cx},${cy}`);
    }
    goldenPath = path;
    bossCoord = path[path.length - 1];
    console.log("Golden Path Generated:", goldenPath);
}

const BOUNDARY = 20;
const DOOR_SIZE = 50;
const DOOR_THICKNESS = 15;
// Load configurations (Async)
const DEBUG_START_BOSS = false; // TOGGLE THIS FOR DEBUGGING
const DEBUG_PLAYER = true;

// configurations
function initGame(isRestart = false) {
    // Synchronous reset to prevent race conditions
    gameState = isRestart ? STATES.PLAY : STATES.START;
    overlayEl.style.display = 'none';
    welcomeEl.style.display = isRestart ? 'none' : 'flex';
    if (uiEl) uiEl.style.display = isRestart ? 'block' : 'none';
    bullets = [];

    // Hardcoded safe values to use while loading
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
    visitedRooms = {}; // Clear persistence on new game



    if (DEBUG_START_BOSS) {
        console.log("DEBUG MODE: Starting in Boss Room");
        Promise.all([
            fetch('player.json?t=' + Date.now()).then(res => res.json()),
            fetch('rooms/boss1/room.json?t=' + Date.now()).then(res => res.json()),
            fetch('game.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 })),
            fetch('rooms/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] }))
        ]).then(([pData, rData, gData, mData]) => {
            gameData = gData;
            roomManifest = mData;

            // Debug: Skip Golden Path, treat 0,0 as Boss
            bossCoord = "0,0";
            goldenPath = ["0,0"];
            player.roomX = 0;
            player.roomY = 0;

            Object.assign(player, pData);
            /*
            hpEl.innerText = player.hp;
            keysEl.innerText = player.inventory.keys;
            roomEl.innerText = `${player.roomX},${player.roomY}`;
            roomNameEl.innerText = rData.name || "Unknown Room";
            console.log(DEBUG_PLAYER);
            if (DEBUG_PLAYER) {
                playerEl.innerText = `${player}`;
            }
                */
            updateUI();
            roomData = rData;
            canvas.width = roomData.width || 800;
            canvas.height = roomData.height || 600;

            visitedRooms["0,0"] = { roomData: roomData, cleared: false }; // Not cleared initially
            console.log("Boss Intro End Time set", bossIntroEndTime);
            bossIntroEndTime = Date.now() + 2000; // Trigger intro for debug start
            if (gameState === STATES.PLAY) {
                spawnEnemies();
                //console.log("Boss Intro End Time set to", bossIntroEndTime);
                //bossIntroEndTime = Date.now() + 2000; // Trigger intro for debug start
            }
            draw(); // Start the game loop
        }).catch(err => {
            console.warn("Could not load configurations", err);
            draw(); // Start the game loop even if config fails
        });
    } else {
        // Normal Game Start
        Promise.all([
            fetch('player.json?t=' + Date.now()).then(res => res.json()),
            fetch('rooms/start/room.json?t=' + Date.now()).then(res => res.json()),
            fetch('game.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 })),
            fetch('rooms/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] }))
        ]).then(([pData, rData, gData, mData]) => {
            gameData = gData;
            roomManifest = mData;

            generateGoldenPath(gameData.NoRooms || 11);

            Object.assign(player, pData);
            /*
            hpEl.innerText = player.hp;
            keysEl.innerText = player.inventory.keys;
            roomEl.innerText = `${player.roomX},${player.roomY}`;
            roomNameEl.innerText = rData.name || "Unknown Room";
            console.log(DEBUG_PLAYER);
            if (DEBUG_PLAYER) {
                playerEl.innerText = `${player}`;
            }
                */
            updateUI();

            roomData = rData;
            canvas.width = roomData.width || 800;
            canvas.height = roomData.height || 600;

            visitedRooms["0,0"] = { roomData: roomData, cleared: true };

            if (gameState === STATES.PLAY) spawnEnemies();
            draw(); // Start the game loop
        }).catch(err => {
            console.warn("Could not load configurations", err);
            if (gameState === STATES.PLAY) spawnEnemies();
            draw(); // Start the game loop even if config fails
        });
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
    if (enemies.length > 0) return; // Don't double spawn if not cleared logic fails

    // Use roomData.enemyCount if defined (strict override), otherwise random calculation
    let count;
    if (roomData.enemyCount !== undefined) {
        count = roomData.enemyCount;
    } else {
        count = 3 + Math.floor(Math.random() * 3);
        if (gameData.difficulty) count += gameData.difficulty;
    }
    const freezeUntil = Date.now() + 1000; // Freeze for 1s
    player.invulnUntil = freezeUntil; // Player also safe for 1s
    for (let i = 0; i < count; i++) {
        enemies.push({
            x: Math.random() * (canvas.width - 60) + 30,
            y: Math.random() * (canvas.height - 60) + 30,
            size: roomData.isBoss ? 40 : 25,
            hp: roomData.isBoss ? 5 : 2,
            speed: (1 + Math.random()) * (roomData.isBoss ? 0.5 : 1),
            freezeUntil: freezeUntil
        });
    }
}

function changeRoom(dx, dy) {
    // Save cleared status of current room before leaving
    const currentCoord = `${player.roomX},${player.roomY}`;
    if (visitedRooms[currentCoord]) {
        visitedRooms[currentCoord].cleared = (enemies.length === 0);
    }

    // Check if door was locked and consume a key
    let doorUsed = null;
    if (dx === 1) doorUsed = "right";
    if (dx === -1) doorUsed = "left";
    if (dy === 1) doorUsed = "bottom";
    if (dy === -1) doorUsed = "top";

    if (doorUsed && roomData.doors && roomData.doors[doorUsed].locked && player.inventory.keys > 0) {
        player.inventory.keys--;
        keysEl.innerText = player.inventory.keys;
        roomData.doors[doorUsed].locked = 0; // Persist unlock
    }

    player.roomX += dx;
    player.roomY += dy;
    const nextCoord = `${player.roomX},${player.roomY}`;
    roomEl.innerText = nextCoord;

    bulletsInRoom = 0;
    hitsInRoom = 0;
    perfectEl.style.display = 'none';

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

    // Dynamic Door Interconnectivity: Automatically connects adjacent discovered rooms
    function syncNeighborDoors(rx, ry, data) {
        const neighbors = [
            { dx: 0, dy: -1, door: "top", opposite: "bottom" },
            { dx: 0, dy: 1, door: "bottom", opposite: "top" },
            { dx: -1, dy: 0, door: "left", opposite: "right" },
            { dx: 1, dy: 0, door: "right", opposite: "left" }
        ];

        neighbors.forEach(n => {
            // Check for override
            if (data.allDoorsUnlocked) {
                if (!data.doors) data.doors = {};
                if (!data.doors[n.door]) data.doors[n.door] = { active: 1, locked: 0 };
                else {
                    data.doors[n.door].active = 1;
                    data.doors[n.door].locked = 0;
                }
                // Ensure coordinates
                if (n.door === "top" || n.door === "bottom") {
                    if (data.doors[n.door].x === undefined) data.doors[n.door].x = (data.width || 800) / 2;
                } else {
                    if (data.doors[n.door].y === undefined) data.doors[n.door].y = (data.height || 600) / 2;
                }
            }

            const neighborCoord = `${rx + n.dx},${ry + n.dy}`;
            if (visitedRooms[neighborCoord]) {
                // Activate door in current room
                if (!data.doors) data.doors = {};
                if (!data.doors[n.door]) data.doors[n.door] = { active: 1, locked: 0 };
                else {
                    data.doors[n.door].active = 1;
                    data.doors[n.door].locked = 0;
                }

                // Ensure current door has coordinates
                if (n.door === "top" || n.door === "bottom") {
                    if (data.doors[n.door].x === undefined) data.doors[n.door].x = (data.width || 800) / 2;
                } else {
                    if (data.doors[n.door].y === undefined) data.doors[n.door].y = (data.height || 600) / 2;
                }

                // Activate matching door in neighbor room (two-way travel)
                const nData = visitedRooms[neighborCoord].roomData;
                if (!nData.doors) nData.doors = {};
                if (!nData.doors[n.opposite]) nData.doors[n.opposite] = { active: 1, locked: 0 };
                else {
                    nData.doors[n.opposite].active = 1;
                    nData.doors[n.opposite].locked = 0;
                }

                // Ensure neighbor door has coordinates
                if (n.opposite === "top" || n.opposite === "bottom") {
                    if (nData.doors[n.opposite].x === undefined) nData.doors[n.opposite].x = (nData.width || 800) / 2;
                } else {
                    if (nData.doors[n.opposite].y === undefined) nData.doors[n.opposite].y = (nData.height || 600) / 2;
                }
            }
        });
    }

    // Load from cache if visited
    if (visitedRooms[nextCoord]) {
        roomData = visitedRooms[nextCoord].roomData;
        syncNeighborDoors(player.roomX, player.roomY, roomData); // Sync all neighbors
        roomNameEl.innerText = roomData.name || "Unknown Room";
        canvas.width = roomData.width || 800;
        canvas.height = roomData.height || 600;
        spawnPlayer(dx, dy, roomData);
        roomStartTime = Date.now();
        if (!visitedRooms[nextCoord].cleared) {
            spawnEnemies();
        } else {
            enemies = []; // Already cleared
        }
        return;
    }

    // Load the room data (randomly for new rooms or Boss room)
    let roomUrl;
    if (nextCoord === bossCoord) {
        roomUrl = 'rooms/boss1/room.json';
    } else {
        const randomRoom = roomManifest.rooms[Math.floor(Math.random() * roomManifest.rooms.length)];
        roomUrl = `rooms/${randomRoom}/room.json`;
    }

    if (roomManifest.rooms.length > 0) {
        fetch(roomUrl + '?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                roomNameEl.innerText = data.name || "Unknown Room";
                canvas.width = data.width || 800;
                canvas.height = data.height || 600;
                roomStartTime = Date.now();

                // Boss Room Logic: Strictly ONE entry door
                if (data.isBoss) {
                    if (!data.doors) data.doors = {};
                    const entryDoor = dx === 1 ? 'left' : (dx === -1 ? 'right' : (dy === 1 ? 'top' : 'bottom'));

                    // Only activate the entry door
                    data.doors[entryDoor].active = 1;
                    data.doors[entryDoor].locked = 0;

                    // Trigger Intro
                    bossIntroEndTime = Date.now() + 2000;
                } else {
                    // Normal Room Logic: Stitching & Neighbor Sync
                    const pathIndex = goldenPath.indexOf(nextCoord);
                    if (pathIndex !== -1 && pathIndex < goldenPath.length - 1) {
                        const nextP = goldenPath[pathIndex + 1].split(',').map(Number);
                        const doorToNext = nextP[0] > player.roomX ? 'right' : (nextP[0] < player.roomX ? 'left' : (nextP[1] > player.roomY ? 'bottom' : 'top'));

                        if (!data.doors) data.doors = {};
                        if (!data.doors[doorToNext]) data.doors[doorToNext] = { active: 1, locked: 0 };
                        else data.doors[doorToNext].active = 1;
                    }

                    // Prune doors for side rooms (dead ends)
                    if (pathIndex === -1 && nextCoord !== "0,0") {
                        const entryDoor = dx === 1 ? 'left' : (dx === -1 ? 'right' : (dy === 1 ? 'top' : 'bottom'));
                        const others = ['top', 'bottom', 'left', 'right'].filter(d => d !== entryDoor);
                        others.forEach(d => {
                            if (Math.random() > 0.3) {
                                if (data.doors && data.doors[d]) data.doors[d].active = 0;
                            }
                        });
                    }

                    syncNeighborDoors(player.roomX, player.roomY, data);
                }

                spawnPlayer(dx, dy, data);

                roomData = data;
                // Cache the new room
                visitedRooms[nextCoord] = { roomData: roomData, cleared: false };
                spawnEnemies();
            })
            .catch(err => {
                console.error("Critical: Failed to load room.", err);
                spawnEnemies();
            });
    } else {
        spawnEnemies();
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
        console.log(player)
        const door = doors.top || { active: 0, locked: 0 };
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        const inDoorRange = player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
        const canPass = door.active && (!door.locked || player.inventory.keys > 0) && !roomLocked;
        if (player.y > BOUNDARY || (inDoorRange && canPass)) {
            player.y -= player.speed;
        }
    }
    if (keys['KeyS']) {
        const door = doors.bottom || { active: 0, locked: 0 };
        const doorX = door.x !== undefined ? door.x : canvas.width / 2;
        const inDoorRange = player.x > doorX - DOOR_SIZE && player.x < doorX + DOOR_SIZE;
        const canPass = door.active && (!door.locked || player.inventory.keys > 0) && !roomLocked;
        if (player.y < canvas.height - BOUNDARY || (inDoorRange && canPass)) {
            player.y += player.speed;
        }
    }
    if (keys['KeyA']) {
        const door = doors.left || { active: 0, locked: 0 };
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        const inDoorRange = player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
        const canPass = door.active && (!door.locked || player.inventory.keys > 0) && !roomLocked;
        if (player.x > BOUNDARY || (inDoorRange && canPass)) {
            player.x -= player.speed;
        }
    }
    if (keys['KeyD']) {
        const door = doors.right || { active: 0, locked: 0 };
        const doorY = door.y !== undefined ? door.y : canvas.height / 2;
        const inDoorRange = player.y > doorY - DOOR_SIZE && player.y < doorY + DOOR_SIZE;
        const canPass = door.active && (!door.locked || player.inventory.keys > 0) && !roomLocked;
        if (player.x < canvas.width - BOUNDARY || (inDoorRange && canPass)) {
            player.x += player.speed;
        }
    }

    // Cheat Keys
    if (keys['KeyK']) {
        player.inventory.keys++;
        keysEl.innerText = player.inventory.keys;
        keys['KeyK'] = false; // Prevents spam
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
                            if (isPerfect) {
                                perfectStreak++;
                                if (perfectStreak >= (gameData.perfectGoal || 3)) {
                                    msg = "PERFECT BONUS!"; // Bonus takes priority over combo text
                                } else {
                                    msg = isSpeedy ? "SPEEDY PERFECT!" : "PERFECT!";
                                }
                            } else if (isSpeedy) {
                                msg = "SPEEDY!";
                                perfectStreak = 0;
                            } else {
                                perfectStreak = 0; // Reset streak if neither
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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Doors
    const roomLocked = enemies.length > 0;
    const doors = roomData.doors || {};
    const getDoorColor = (direction) => {
        if (roomLocked) return "#c0392b"; // Red if locked
        const door = doors[direction] || { locked: 0 };
        return door.locked ? "#c0392b" : "#222"; // Red for key-locked, Dark for open
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