import { Globals } from './Globals.js';
import { log } from './Utils.js';

export function generateLevel(length) {
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
        let move = possible[Math.floor(Globals.random() * possible.length)];
        cx += move.dx;
        cy += move.dy;
        path.push(`${cx},${cy}`);
    }

    Globals.goldenPath = [...path];
    Globals.goldenPathIndex = 0;
    Globals.goldenPathFailed = false;
    Globals.bossCoord = path[path.length - 1];
    Globals.trophyCoord = null;
    Globals.homeCoord = null;
    Globals.matrixCoord = null;

    // 2. Add Branches (Dead Ends)
    let fullMapCoords = [...path];
    path.forEach(coord => {
        if (coord === Globals.bossCoord || coord === "0,0") return;

        // 50% chance to start a branch from this node
        if (Globals.random() > 0.5) {
            const branchLength = Math.floor(Globals.random() * 3) + 1; // 1 to 3 rooms deep
            let bx = parseInt(coord.split(',')[0]);
            let by = parseInt(coord.split(',')[1]);

            for (let b = 0; b < branchLength; b++) {
                // Find valid moves from current branch tip
                let possible = dirs.filter(d => !fullMapCoords.includes(`${bx + d.dx},${by + d.dy}`));
                if (possible.length === 0) break; // Stuck, stop branching

                let move = possible[Math.floor(Globals.random() * possible.length)];
                bx += move.dx;
                by += move.dy;
                fullMapCoords.push(`${bx},${by}`);
            }
        }
    });

    // 3. Initialize levelMap with room data
    Globals.levelMap = {};

    // Helper to find specific types
    const findStartTemplate = () => {
        const templates = Globals.roomTemplates;
        // 0. Explicit loaded start room (tagged with _type = 'start')
        const allKeys = Object.keys(templates).sort();
        const explicitStart = allKeys.find(k => templates[k]._type === 'start');
        if (explicitStart) return templates[explicitStart];

        // 1. Try explicit "start" (legacy or named)
        if (templates["start"]) return templates["start"];
        if (templates["rooms/start/room.json"]) return templates["rooms/start/room.json"];
        if (templates["rooms/start.json"]) return templates["rooms/start.json"];

        // 2. Try to find any room with "start" in name/ID
        const startKey = allKeys.find(k => k.toLowerCase().includes('start'));
        if (startKey) return templates[startKey];

        // 3. Fallback: Take the first "normal" room available
        const keys = allKeys.filter(k =>
            !templates[k]._type || templates[k]._type !== 'boss'
        );
        if (keys.length > 0) return templates[keys[0]];

        return null; // Fatal
    };

    const findBossTemplate = () => {
        const templates = Globals.roomTemplates;
        // 1. Try explicit "boss" (legacy)
        if (templates["boss"]) return templates["boss"];

        // 2. Try any room tagged as boss (from bossrooms list)
        const allKeys = Object.keys(templates).sort();
        const bossKey = allKeys.find(k => templates[k]._type === 'boss');
        if (bossKey) {
            log("Found Boss Template:", bossKey);
            return templates[bossKey];
        }

        // 3. Fallback
        if (Globals.gameData.bossRoom !== "" && Globals.gameData.bossRoom !== null) {
            console.warn("No Boss Template found. Using last available.");
        }
        // keys is already sorted via allKeys if we used it, otherwise sort here
        const keys = Object.keys(templates).sort();
        return templates[keys[keys.length - 1]];
    };

    const startTmpl = findStartTemplate();
    const bossTmpl = findBossTemplate();

    // Upgrade Room Logic
    let upgradeCoord = null;
    let upgradeTmpl = null;

    if (Globals.isUpgradeUnlocked && Globals.gameData.upgradeRoom && typeof Globals.gameData.upgradeRoom === 'object' && Globals.gameData.upgradeRoom.room) {
        const tmplPath = Globals.gameData.upgradeRoom.room;
        const cleanPath = tmplPath.startsWith('/') ? tmplPath.substring(1) : tmplPath;
        upgradeTmpl = Globals.roomTemplates[cleanPath] || Globals.roomTemplates[tmplPath];
        if (!upgradeTmpl) {
            const key = Object.keys(Globals.roomTemplates).find(k => k.includes(cleanPath) || cleanPath.includes(k));
            if (key) upgradeTmpl = Globals.roomTemplates[key];
        }
        if (upgradeTmpl) {
            upgradeCoord = "-1,0";
            if (!fullMapCoords.includes(upgradeCoord)) {
                fullMapCoords.push(upgradeCoord);
            }
            log("Upgrade Room forced to left of start:", upgradeCoord);
        } else {
            log("Missing Upgrade Room Template:", tmplPath);
        }
    }

    // Shop Placement Logic
    const findShopTemplate = () => {
        const templates = Globals.roomTemplates;
        // 1. Try explicit "shop" (legacy)
        if (templates["shop"]) return templates["shop"];

        // 2. Try any room tagged as shop
        const allKeys = Object.keys(templates).sort();
        const shopKey = allKeys.find(k => templates[k]._type === 'shop');
        if (shopKey) {
            log("Found Shop Template:", shopKey);
            return templates[shopKey];
        }
        return null;
    };

    const shopTmpl = findShopTemplate();
    let shopCoord = null;

    if (shopTmpl && Globals.gameData.shop && Globals.gameData.shop.active) {
        // Find candidates: Any room that is NOT Start and NOT Boss
        // Priority: Dead Ends (1 neighbor) AND Distance > 1 from Start
        let candidates = fullMapCoords.filter(c => {
            if (c === "0,0" || c === Globals.bossCoord || c === upgradeCoord) return false;

            const [x, y] = c.split(',').map(Number);

            // Prevent spawning next to start (locked door issue)
            if (Math.abs(x) + Math.abs(y) <= 1) return false;

            let neighbors = 0;
            dirs.forEach(d => {
                if (fullMapCoords.includes(`${x + d.dx},${y + d.dy}`)) neighbors++;
            });
            return neighbors === 1;
        });

        if (candidates.length > 0) {
            shopCoord = candidates[Math.floor(Globals.random() * candidates.length)];
            log("Shop placed at (Dead End):", shopCoord);
        } else {
            // Fallback: Pick random valid (Distance > 1)
            let backup = fullMapCoords.filter(c => {
                if (c === "0,0" || c === Globals.bossCoord || c === upgradeCoord) return false;
                const [x, y] = c.split(',').map(Number);
                return (Math.abs(x) + Math.abs(y) > 1);
            });

            if (backup.length > 0) {
                shopCoord = backup[Math.floor(Globals.random() * backup.length)];
                log("Shop placed at (Random - No DeadEnd):", shopCoord);
            }
        }
    }

    // 3. New Special Room Logic (Trophy Hub)
    let trophyCoord = null;

    // A. Spawn Trophy Room (Secret)
    if (Globals.gameData.trophyRoom && Globals.gameData.trophyRoom.active) {
        const tmplPath = Globals.gameData.trophyRoom.room;
        log("Trying to spawn Trophy Room:", tmplPath);

        // Find best candidate for trophy room (limit distance to not be too close to start)
        const candidates = fullMapCoords.filter(c => {
            if (c === "0,0" || c === Globals.bossCoord || c === shopCoord || c === upgradeCoord) return false;
            const [hx, hy] = c.split(',').map(Number);

            // 1. Can we place Trophy Room HERE? (Host needs >= 1 free neighbor)
            const hostFreeSpots = dirs.filter(d => !fullMapCoords.includes(`${hx + d.dx},${hy + d.dy}`));
            if (hostFreeSpots.length === 0) return false;

            // 2. Can the Trophy Room support sub-rooms (Home + Matrix)?
            // We need to check EACH potential Trophy Room spot
            // If ANY spot works, this candidate is valid
            let needed = 0;
            if (Globals.gameData.homeRoom?.active) needed++;
            if (Globals.gameData.matrixRoom?.active) needed++;

            // Check if ANY of the free spots around Host can accommodate the sub-rooms
            const validSpot = hostFreeSpots.some(move => {
                const tx = hx + move.dx;
                const ty = hy + move.dy;
                // Check free neighbors around Trophy Room (excluding the one back to Host)
                let tFree = 0;
                dirs.forEach(td => {
                    const nx = tx + td.dx;
                    const ny = ty + td.dy;
                    // It's free if not in map AND not the host we came from (already covered by map check since host is in map)
                    if (!fullMapCoords.includes(`${nx},${ny}`)) tFree++;
                });
                return tFree >= needed;
            });

            return validSpot;
        });

        if (candidates.length > 0) {
            const hostCoord = candidates[Math.floor(Globals.random() * candidates.length)];
            const [hx, hy] = hostCoord.split(',').map(Number);

            // Find spot for Trophy Room (re-run logic to pick valid one)
            let needed = 0;
            if (Globals.gameData.homeRoom?.active) needed++;
            if (Globals.gameData.matrixRoom?.active) needed++;

            const hostFreeSpots = dirs.filter(d => !fullMapCoords.includes(`${hx + d.dx},${hy + d.dy}`));
            // Filter spots that can support sub-rooms
            const validSpots = hostFreeSpots.filter(move => {
                const tx = hx + move.dx;
                const ty = hy + move.dy;
                let tFree = 0;
                dirs.forEach(td => {
                    const nx = tx + td.dx;
                    const ny = ty + td.dy;
                    if (!fullMapCoords.includes(`${nx},${ny}`)) tFree++;
                });
                return tFree >= needed;
            });

            if (validSpots.length > 0) {
                const move = validSpots[Math.floor(Globals.random() * validSpots.length)];
                trophyCoord = `${hx + move.dx},${hy + move.dy}`;

                fullMapCoords.push(trophyCoord);
                log("Trophy Room placed at:", trophyCoord, "connected to", hostCoord);

                Globals.trophyCoord = trophyCoord;
                Globals.secretRooms = Globals.secretRooms || {};
                Globals.secretRooms[trophyCoord] = tmplPath;

                // B. Attach Home Room to Trophy Room
                if (Globals.gameData.homeRoom && Globals.gameData.homeRoom.active) {
                    const homePath = Globals.gameData.homeRoom.room;
                    // Find free spot around Trophy Room
                    const tSpots = dirs.filter(d => !fullMapCoords.includes(`${(hx + move.dx) + d.dx},${(hy + move.dy) + d.dy}`));
                    if (tSpots.length > 0) {
                        const hMove = tSpots[0]; // Just take first
                        const homeCoord = `${(hx + move.dx) + hMove.dx},${(hy + move.dy) + hMove.dy}`;
                        fullMapCoords.push(homeCoord);
                        Globals.homeCoord = homeCoord;
                        Globals.secretRooms[homeCoord] = homePath;
                        // Mark connection type? For now just secret room logic handles it
                        log("Home Room attached to Trophy Room at:", homeCoord);
                    }
                }

                // C. Attach Matrix Room to Trophy Room
                if (Globals.gameData.matrixRoom && Globals.gameData.matrixRoom.active) {
                    const matrixPath = Globals.gameData.matrixRoom.room;
                    // Recalculate free spots (Home might have taken one)
                    const tSpots = dirs.filter(d => !fullMapCoords.includes(`${(hx + move.dx) + d.dx},${(hy + move.dy) + d.dy}`));
                    if (tSpots.length > 0) {
                        const mMove = tSpots[0];
                        const matrixCoord = `${(hx + move.dx) + mMove.dx},${(hy + move.dy) + mMove.dy}`;
                        fullMapCoords.push(matrixCoord);
                        Globals.matrixCoord = matrixCoord;
                        Globals.secretRooms[matrixCoord] = matrixPath;
                        log("Matrix Room attached to Trophy Room at:", matrixCoord);
                    }
                }
            }
        }
    }

    // Legacy Secret Room Logic (keep for other levels or generic secrets)
    // Filter out Trophy/Home/Matrix rooms from being spawned generically,
    // as they are handled by the cluster logic above.
    let secretRoomTemplates = Globals.gameData.secrectrooms || [];
    secretRoomTemplates = secretRoomTemplates.filter(tmplPath => {
        if (!tmplPath) return false;
        if (Globals.gameData.trophyRoom && Globals.gameData.trophyRoom.active && tmplPath.includes(Globals.gameData.trophyRoom.room)) return false;
        if (Globals.gameData.homeRoom && Globals.gameData.homeRoom.active && tmplPath.includes(Globals.gameData.homeRoom.room)) return false;
        if (Globals.gameData.matrixRoom && Globals.gameData.matrixRoom.active && tmplPath.includes(Globals.gameData.matrixRoom.room)) return false;
        return true;
    });

    if (secretRoomTemplates.length > 0) {
        secretRoomTemplates.forEach(templatePath => {
            // ... (rest of legacy logic)
            // Find candidates: Any room that is NOT Start, NOT Boss, NOT Shop
            let candidates = fullMapCoords.filter(c => {
                if (c === "0,0" || c === Globals.bossCoord || c === shopCoord || c === upgradeCoord) return false;

                const [x, y] = c.split(',').map(Number);

                // Allow spawning near start, but prefer distance > 1

                // Must have at least one free spot neighboring it to place the secret room
                let hasFreeNeighbor = false;
                dirs.forEach(d => {
                    const nx = x + d.dx;
                    const ny = y + d.dy;
                    if (!fullMapCoords.includes(`${nx},${ny}`)) {
                        hasFreeNeighbor = true;
                    }
                });
                return hasFreeNeighbor;
            });

            if (candidates.length > 0) {
                // Pick a random host room
                const hostCoord = candidates[Math.floor(Globals.random() * candidates.length)];
                const [hx, hy] = hostCoord.split(',').map(Number);

                // Find a free spot next to host
                const freeSpots = dirs.filter(d => !fullMapCoords.includes(`${hx + d.dx},${hy + d.dy}`));

                if (freeSpots.length > 0) {
                    const move = freeSpots[Math.floor(Globals.random() * freeSpots.length)];
                    const secretCoord = `${hx + move.dx},${hy + move.dy}`;

                    fullMapCoords.push(secretCoord);
                    log("Secret Room placed at:", secretCoord, "connected to", hostCoord);

                    // Mark it for later template assignment
                    Globals.secretRooms = Globals.secretRooms || {};
                    Globals.secretRooms[secretCoord] = templatePath;
                }
            }
        });
    }

    fullMapCoords.forEach(coord => {
        let template;
        if (coord === "0,0") {
            template = startTmpl;
        } else if (coord === upgradeCoord) {
            template = upgradeTmpl;
            log("Generating Upgrade Room at:", coord);
        } else if (coord === Globals.bossCoord) {
            template = bossTmpl;
        } else if (coord === shopCoord) {
            template = shopTmpl;
            log("Generating Shop at:", coord);
        } else if (Globals.secretRooms && Globals.secretRooms[coord]) {
            // Secret Room Template
            const tmplPath = Globals.secretRooms[coord];
            // Try to find it in templates (assuming loaded by key)
            // Keys in roomTemplates are usually "json/rooms/..." or just "room_name" if legacy
            // The gameData.secrectrooms has full path "/json/rooms/..."
            // We might need to strip leading slash or match strictly
            const cleanPath = tmplPath.startsWith('/') ? tmplPath.substring(1) : tmplPath;

            template = Globals.roomTemplates[cleanPath] || Globals.roomTemplates[tmplPath];
            if (!template) {
                // Try loose matching
                const key = Object.keys(Globals.roomTemplates).find(k => k.includes(cleanPath) || cleanPath.includes(k));
                if (key) template = Globals.roomTemplates[key];
            }
            if (!template) log("Missing Secret Template:", tmplPath);
        } else {
            const templates = Globals.roomTemplates;
            const keys = Object.keys(templates).sort().filter(k => {
                const tmpl = templates[k];
                // Exclude explicit Start/Boss/Shop/Secret templates
                if (tmpl === startTmpl) { log("Filter Skip:", k, "Matches Start"); return false; }
                if (tmpl === bossTmpl) { log("Filter Skip:", k, "Matches Boss"); return false; }
                if (tmpl === shopTmpl) { log("Filter Skip:", k, "Matches Shop"); return false; }
                if (upgradeTmpl && tmpl === upgradeTmpl) { log("Filter Skip:", k, "Matches Upgrade"); return false; }
                if (tmpl._type && tmpl._type !== 'normal') { log("Filter Skip:", k, "Non-Normal Type:", tmpl._type); return false; } // Strict: Only undefined or 'normal'
                log("Filter Keep:", k);
                return true;
            });

            if (keys.length > 0) {
                const rnd = Globals.random();
                const idx = Math.floor(rnd * keys.length);
                const randomKey = keys[idx];
                template = templates[randomKey];

                if (!template) {
                    console.error(`CRITICAL: Template Selection Failed! Rnd: ${rnd}, Idx: ${idx}/${keys.length}, Key: ${randomKey}, Template: ${template}`);
                    log("Keys Available:", keys);
                }
            } else {
                console.warn(`No Normal Room Keys allowed for filter! Fallback to Start Room.`);
                template = startTmpl; // Last resort
            }
        }

        // Check if template exists
        if (!template) {
            if (Globals.secretRooms && Globals.secretRooms[coord]) {
                console.error(`Missing SECRET template for coord: ${coord}. Path:`, Globals.secretRooms[coord]);
            } else {
                console.error(`Missing NORMAL template for coord: ${coord}.`);
            }
            console.warn("Available Templates Keys:", Object.keys(Globals.roomTemplates));
            template = startTmpl || { width: 800, height: 600, name: "Empty Error Room", doors: {} };
        }

        // Deep copy template
        const roomInstance = JSON.parse(JSON.stringify(template));
        // Force Boss Flag on designate Boss Coord
        if (coord === Globals.bossCoord) {
            roomInstance.isBoss = true;
            roomInstance._type = 'boss';
        }
        if (Globals.secretRooms && Globals.secretRooms[coord]) {
            roomInstance.isSecret = true;
            // Specific Type Assignment
            if (coord === Globals.trophyCoord) {
                roomInstance._type = 'trophy';
            } else if (coord === Globals.homeCoord) {
                roomInstance._type = 'home';
            } else if (coord === Globals.matrixCoord) {
                roomInstance._type = 'matrix';
            } else {
                roomInstance._type = 'secret';
            }
        }

        Globals.levelMap[coord] = {
            roomData: roomInstance,
            // Start room is pre-cleared ONLY if it's NOT a boss room
            cleared: (coord === "0,0") && !roomInstance.isBoss
        };
    });

    // 4. Pre-stitch doors between all adjacent rooms
    for (let coord in Globals.levelMap) {
        const [rx, ry] = coord.split(',').map(Number);
        const data = Globals.levelMap[coord].roomData;
        if (!data.doors) data.doors = {};

        dirs.forEach(d => {
            const neighborCoord = `${rx + d.dx},${ry + d.dy}`;
            if (Globals.levelMap[neighborCoord]) {
                // If neighbor exists, ensure door is active and unlocked
                if (!data.doors[d.name]) {
                    data.doors[d.name] = { active: 1, locked: 0 };
                } else {
                    // Always force active if neighbor exists
                    data.doors[d.name].active = 1;
                }

                // Keep locked status if template specifically had it, otherwise 0
                if (data.doors[d.name].locked === undefined) data.doors[d.name].locked = 0;

                // FORCE UNLOCK AND ACTIVE on Golden Path (unless it's the shop?)
                // Actually Shop can be on Golden Path?
                // Logic says Shop is "not boss coord" and "not 0,0".
                // If Shop ends up on golden path (possible if Dead End logic fails or path has dead end?),
                // we still want to lock it.
                // Priority: Lock Shop > Golden Path Unlock?
                // Usually Golden Path should be openable.
                // If Shop is blocking Golden Path (unlikely if it's dead end), user must have key.
                // But generally Shop is a branch.
                if (Globals.goldenPath.includes(coord) && Globals.goldenPath.includes(neighborCoord)) {
                    data.doors[d.name].locked = 0;
                    data.doors[d.name].active = 1;
                }

                // SHOP LOCK LOGIC (Overrides Golden Path if conflict)
                if ((coord === shopCoord || neighborCoord === shopCoord) && shopCoord !== null) {
                    data.doors[d.name].locked = 1; // 1 = Key
                    data.doors[d.name].active = 1;
                }

                // SECRET / SPECIAL ROOM LOGIC
                // Prevent Boss Room or Upgrade Room from ever being hidden/secret
                let isTargetBossOrUpgrade = (neighborCoord === Globals.bossCoord || neighborCoord === upgradeCoord);

                // 1. Trophy Room Logic
                if (coord === Globals.trophyCoord) {
                    // Only allow connections to: Host, Home, Matrix
                    // Host connection is HIDDEN by default (unless revealed)
                    // Home/Matrix connections are VISIBLE but LOCKED with special keys
                    let allowed = false;
                    let hidden = true;
                    let locked = 0; // Default unlocked

                    // Connected to Host?
                    if (neighborCoord === Globals.homeCoord) {
                        allowed = true;
                        hidden = false;
                        locked = 2; // HOUSE KEY
                    } else if (neighborCoord === Globals.matrixCoord) {
                        allowed = true;
                        hidden = false;
                        locked = 3; // MATRIX KEY
                    } else {
                        // Must be the host (or a random neighbor we shouldn't connect to?)
                        // For now: Default secret behavior (Hidden)
                        allowed = true; // It's a secret door
                        hidden = !isTargetBossOrUpgrade; // Never hide Boss or Upgrade connection
                        locked = 0;
                    }

                    if (allowed) {
                        data.doors[d.name].locked = locked;
                        data.doors[d.name].active = 1;
                        data.doors[d.name].hidden = hidden;
                        data.doors[d.name].forcedOpen = (locked === 0 && !hidden); // Only force open if unlocked and visible? No, let keys handle it.
                    } else {
                        data.doors[d.name].active = 0; // Block random neighbors
                    }

                    // 2. Home / Matrix Logic
                } else if (coord === Globals.homeCoord || coord === Globals.matrixCoord) {
                    // STRICT: Only connect to Trophy Room
                    if (neighborCoord === Globals.trophyCoord) {
                        data.doors[d.name].locked = (coord === Globals.homeCoord) ? 2 : 3; // Lock from inside too? Or just open? 
                        // Usually keys unlock both sides. Let's keep it locked so they need key to exit too? 
                        // Or maybe just exit is free? "You can check out any time you like..."
                        // Let's make it symmetric for now.
                        data.doors[d.name].active = 1;
                        data.doors[d.name].hidden = false; // Always visible from inside
                    } else {
                        data.doors[d.name].active = 0; // Solid wall to everyone else
                    }

                    // 3. Standard Room connecting TO a Special Room
                } else if (neighborCoord === Globals.trophyCoord) {
                    // I am the Host (or random neighbor). Secret Door to Trophy.
                    data.doors[d.name].locked = 0; // Standard Secret Door (Unlocked but Hidden)
                    data.doors[d.name].active = 1;
                    data.doors[d.name].hidden = !isTargetBossOrUpgrade; // Protect Boss/Upgrade
                } else if (neighborCoord === Globals.homeCoord || neighborCoord === Globals.matrixCoord) {
                    // I am a random neighbor of Home/Matrix. I should NOT see a door.
                    data.doors[d.name].active = 0;

                    // 4. Generic Secret Room (Legacy)
                } else if ((Globals.secretRooms && Globals.secretRooms[coord])) {
                    // ... existing generic logic if needed ...
                    data.doors[d.name].locked = 0;
                    data.doors[d.name].active = 1;
                    data.doors[d.name].hidden = !isTargetBossOrUpgrade; // Protect Boss/Upgrade
                    data.doors[d.name].forcedOpen = true;
                } else if ((Globals.secretRooms && Globals.secretRooms[neighborCoord])) {
                    // Neighbor is generic secret
                    data.doors[d.name].locked = 1;
                    data.doors[d.name].active = 1;
                    data.doors[d.name].hidden = !isTargetBossOrUpgrade; // Protect Boss/Upgrade from being hidden
                }

                // Sync door coordinates if missing
                if (d.name === "top" || d.name === "bottom") {
                    if (data.doors[d.name].x === undefined) data.doors[d.name].x = (data.width || 800) / 2;
                } else {
                    if (data.doors[d.name].y === undefined) data.doors[d.name].y = (data.height || 600) / 2;
                }
            } else {
                // If no neighbor, ensure door is inactive (unless it's a boss room entry which we handle... logic omitted in concise version but kept implied)
                if (data.doors[d.name]) data.doors[d.name].active = 0;
            }
        });
    }

    log("Level Generated upfront with", Object.keys(Globals.levelMap).length, "rooms.");
    log("Golden Path:", Globals.goldenPath);
}
