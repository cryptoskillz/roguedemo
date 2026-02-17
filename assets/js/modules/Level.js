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

    // Update Globals
    Globals.goldenPath = path;
    Globals.goldenPathIndex = 0;
    Globals.goldenPathFailed = false;
    Globals.bossCoord = path[path.length - 1];

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
        console.warn("No Boss Template found. Using last available.");
        // keys is already sorted via allKeys if we used it, otherwise sort here
        const keys = Object.keys(templates).sort();
        return templates[keys[keys.length - 1]];
    };

    const startTmpl = findStartTemplate();
    const bossTmpl = findBossTemplate();

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
            if (c === "0,0" || c === Globals.bossCoord) return false;

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
                if (c === "0,0" || c === Globals.bossCoord) return false;
                const [x, y] = c.split(',').map(Number);
                return (Math.abs(x) + Math.abs(y) > 1);
            });

            if (backup.length > 0) {
                shopCoord = backup[Math.floor(Globals.random() * backup.length)];
                log("Shop placed at (Random - No DeadEnd):", shopCoord);
            }
        }
    }

    // Secret Room Placement Logic
    const secretRoomTemplates = Globals.gameData.secrectrooms || [];
    if (secretRoomTemplates.length > 0) {
        secretRoomTemplates.forEach(templatePath => {
            // Find candidates: Any room that is NOT Start, NOT Boss, NOT Shop
            let candidates = fullMapCoords.filter(c => {
                if (c === "0,0" || c === Globals.bossCoord || c === shopCoord) return false;

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
        } else if (coord === Globals.bossCoord) {
            template = bossTmpl;
        } else if (coord === shopCoord) {
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
            // Random Normal Room
            const templates = Globals.roomTemplates;
            const keys = Object.keys(templates).sort().filter(k =>
                templates[k] !== startTmpl && templates[k] !== bossTmpl &&
                templates[k] !== shopTmpl &&
                (!templates[k]._type || (templates[k]._type !== 'boss' && templates[k]._type !== 'shop'))
            );

            if (keys.length > 0) {
                const randomKey = keys[Math.floor(Globals.random() * keys.length)];
                template = templates[randomKey];
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
        // Force Boss Flag on designate Boss Coord
        if (coord === Globals.bossCoord) {
            roomInstance.isBoss = true;
            roomInstance._type = 'boss';
        }
        if (Globals.secretRooms && Globals.secretRooms[coord]) {
            roomInstance.isSecret = true;
            roomInstance._type = 'secret';
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

                // SECRET ROOM LOGIC
                if ((Globals.secretRooms && Globals.secretRooms[coord]) || (Globals.secretRooms && Globals.secretRooms[neighborCoord])) {
                    // One of them is secret -> Hidden Door
                    data.doors[d.name].locked = 1; // Locked (or just hidden?)
                    data.doors[d.name].active = 1;
                    data.doors[d.name].hidden = true; // Make it look like a wall
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
