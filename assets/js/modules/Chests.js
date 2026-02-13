import { Globals } from './Globals.js';
import { log, spawnFloatingText } from './Utils.js';
import { SFX } from './Audio.js';
import { JSON_PATHS, STATES, TILE_SIZE } from './Constants.js';

export function spawnChests(roomData) {
    Globals.chests = [];
    if (!roomData.chests) return;
    log("Checking Chests for Room:", roomData.name, roomData.chests);

    // Handle "chests" object structure
    // Structure: { "chestID": { config... }, "manifest": "..." }
    // Or maybe manifest is inside config?
    // Snippet 2714 suggests manifest is a sibling of chest keys if defined at top level?
    // User request: "bombs!": { "manfest": ... }

    // We iterate keys. If key is "manifest" (or typo "manfest"), we skip or store globally?
    // Let's assume keys that are NOT "manifest" are chests.

    const chestKeys = Object.keys(roomData.chests);
    chestKeys.forEach(key => {
        if (key === 'manifest' || key === 'manfest') return;

        const config = roomData.chests[key];

        // Check Instant Spawn
        let shouldSpawnNow = false;
        let shouldSpawnLater = false;

        // Instant Spawn Logic
        if (config.instantSpawn === true) {
            shouldSpawnNow = true;
        } else if (typeof config.instantSpawn === 'object') {
            if (config.instantSpawn.active !== false) { // Default active if object exists? Or strict true? User: "active": false.
                if (config.instantSpawn.active === true) shouldSpawnNow = true;
                // Add chance check? spawnChance
                if (shouldSpawnNow && config.instantSpawn.spawnChance !== undefined) {
                    if (Math.random() > config.instantSpawn.spawnChance) shouldSpawnNow = false;
                }
            }
        } else if (config.instantSpawn === undefined) {
            // Default? If spawnsOnClear is undefined, maybe default visible?
            // User example has instantSpawn: { active: false }.
            // If completely missing, assume visible? Or invisible?
            // Usually config defaults to visible if not specified? 
            // Let's assume visible unless spawnsOnClear is present.
            if (!config.spawnsOnClear && !config.spawnsOnClear) shouldSpawnNow = true;
        }

        // Spawn On Clear Logic
        const clearConfig = config.spawnsOnClear || config.spawnsOnClear;
        if (clearConfig) {
            let active = clearConfig === true;
            if (typeof clearConfig === 'object' && clearConfig.active !== false) { // active: true
                active = true; // Wait, user has active: false in snippet.
                if (clearConfig.active === true) active = true;
                else active = false;
            }
            if (active) shouldSpawnLater = true;
        }

        // If neither, skip
        log("Chest Spawn Decision:", key, "Now:", shouldSpawnNow, "Later:", shouldSpawnLater);
        if (!shouldSpawnNow && !shouldSpawnLater) return;

        const chest = {
            id: key,
            x: config.x,
            y: config.y,
            width: 40,
            height: 40,
            config: config,
            state: shouldSpawnNow ? 'closed' : 'hidden', // 'hidden' for spawnsOnClear
            locked: config.locked === true,
            solid: config.solid || false, // Default false
            hp: 1,
            manifest: config.manfest || config.manifest || roomData.chests.manifest || roomData.chests.manfest
        };

        Globals.chests.push(chest);
    });
}

export function updateChests() {
    // Check Room Clear to reveal hidden chests
    // Logic: If no enemies and not cleared? Or just check enemies.length
    const roomCleared = Globals.enemies.length === 0; // Simple check

    Globals.chests.forEach(chest => {
        if (chest.state === 'hidden') {
            if (roomCleared) {
                // Check spawnChance for late spawn
                const clearConfig = chest.config.spawnsOnClear || chest.config.spawnsOnClear;
                if (clearConfig && typeof clearConfig === 'object' && clearConfig.spawnChance !== undefined) {
                    if (Math.random() > clearConfig.spawnChance) {
                        chest.state = 'despawned'; // Failed chance
                        return;
                    }
                }
                chest.state = 'closed';
                SFX.doorUnlocked(); // Sound cue?
                spawnFloatingText(chest.x, chest.y - 20, "Appeared!", "#f1c40f");
            }
            return;
        }
        if (chest.state === 'despawned') return;
        // If open, we usually skip unless solid
        if (chest.state === 'open' && !chest.solid) return;

        // collision with player
        if (Globals.player) {
            if (checkCollision(Globals.player, chest)) {
                // If already open (and solid), just push back
                if (chest.state === 'open') {
                    resolveCollision(Globals.player, chest);
                    return;
                }

                // Interact?
                // Interact?
                if (chest.locked) {
                    if (Globals.player.inventory.keys > 0) {
                        Globals.player.inventory.keys--;
                        openChest(chest);
                        spawnFloatingText(chest.x, chest.y - 20, "Unlocked!", "#f1c40f");
                    } else {
                        spawnFloatingText(chest.x, chest.y - 20, "Locked", "#e74c3c");
                        // Push player back
                        resolveCollision(Globals.player, chest);
                    }
                } else {
                    // Just open? Or need interaction key?
                    // If SOLID, push back. Maybe open on contact?
                    if (chest.solid) {
                        resolveCollision(Globals.player, chest);
                        // Don't auto-open if solid? Or open AND solid?
                        // "Auto-open" on bump usually implies walk-through or minor bump.
                        // If explicit solid, maybe only open via INTERACT key?
                        // Or "canShoot"?
                        // Let's assume bump opens for now, but still pushes back slightly?
                        // No, if I push back, I might not count as "collision" for opening next frame?
                        // Actually, collision happened THIS frame.
                        openChest(chest);
                    } else {
                        openChest(chest);
                    }
                }
            }
        }
    });

    // Check Bullet Collisions
    Globals.bullets.forEach(bullet => {
        // Globals.bullets contains only active bullets. Remove !bullet.active check.
        Globals.chests.forEach(chest => {
            if (chest.state !== 'closed') return;
            if (chest.locked) return; // Locked chests are immune to bullets
            if (chest.config.canShoot === false) return; // Explicit check

            if (checkCollision(bullet, chest)) {
                bullet.markedForDeletion = true;
                openChest(chest);
            }
        });
    });

    // Check Bomb Collisions (Explosions)
    // Handled in Bomb update logic? 
    // Or here: iterate particles/explosions?
    // Usually explosions are momentary. 
    // We can check Glboals.bombs (if active && exploding)
    Globals.bombs.forEach(bomb => {
        if (bomb.exploding) { // Custom flag or check timer
            // Check dist
            Globals.chests.forEach(chest => {
                if (chest.state !== 'closed') return;
                if (chest.locked) return; // Locked chests are immune to bombs
                // Check boolean false
                if (chest.config.canBomb === false) return;
                // Check object config
                if (chest.config.canBomb && typeof chest.config.canBomb === 'object' && chest.config.canBomb.active === false && !chest.config.locked) return;

                const dx = bomb.x - chest.x;
                const dy = bomb.y - chest.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) { // Explosion radius
                    openChest(chest);
                }
            });
        }
    });
}

function checkCollision(a, b) {
    return a.x < b.x + b.width &&
        a.x + (a.width || a.size) > b.x &&
        a.y < b.y + b.height &&
        a.y + (a.height || a.size) > b.y;
}

function resolveCollision(player, chest) {
    // Simple pushback
    const dx = (player.x + 15) - (chest.x + 20);
    const dy = (player.y + 15) - (chest.y + 20);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > absY) {
        if (dx > 0) player.x = chest.x + chest.width;
        else player.x = chest.x - 30;
    } else {
        if (dy > 0) player.y = chest.y + chest.height;
        else player.y = chest.y - 30;
    }
}

async function openChest(chest) {
    if (chest.state === 'open') return;
    chest.state = 'open';
    SFX.doorUnlocked(); // Use unlock sound?

    // Spawn Items
    if (!chest.manifest) {
        log("Chest has no manifest!");
        return;
    }

    // Load Manifest
    let manifestData = null;
    // Cache check?
    // We accept raw path.
    const url = chest.manifest.startsWith('/') ? JSON_PATHS.ROOT + chest.manifest.substring(1) : JSON_PATHS.ROOT + chest.manifest;

    try {
        const res = await fetch(url);
        manifestData = await res.json();
    } catch (e) {
        console.error("Failed to load chest manifest", e);
        return;
    }

    const items = manifestData.items || manifestData.unlocks;
    if (!manifestData || !items) return;

    // Filter Items
    const contains = chest.config.contains || []; // Regex strings
    const pool = [];

    items.forEach(itemPath => {
        // Check if itemPath matches any regex in 'contains'
        // itemPath might be "unlocks/bombs/bigbomb"
        // Regex: "unlocks/bombs*"

        const match = contains.some(pattern => {
            // Convert wildcard * to regex .*
            // Escape other chars?
            const regexStr = pattern.replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexStr}$`);
            return regex.test(itemPath);
        });

        if (match) pool.push(itemPath);
    });

    if (pool.length === 0) {
        log("Chest found no matching items.");
        return;
    }

    // Spawn All Matches if * is used?
    // User request: "* means spawn all matches"
    // So we iterate the pool and spawn everything.

    pool.forEach(itemToSpawn => {
        spawnItem(itemToSpawn, chest.x, chest.y);
    });
}

async function spawnItem(path, x, y) {
    // Load item template
    // Prepend rewards/items/ if missing and not absolute
    let fullPath = path;
    if (!path.startsWith('/') && !path.startsWith('rewards/') && !path.startsWith('json/')) {
        fullPath = 'rewards/items/' + path;
    }

    try {
        const res = await fetch(`${JSON_PATHS.ROOT}${fullPath}.json?t=${Date.now()}`);
        const itemData = await res.json();

        Globals.groundItems.push({
            x: x + 10,
            y: y + 10,
            data: itemData,
            roomX: Globals.roomData.x || 0,
            roomY: Globals.roomData.y || 0,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            solid: true, moveable: true, friction: 0.9, size: 15,
            floatOffset: 0
        });
        log("Spawned item from chest:", path);

    } catch (e) {
        console.error("Failed to spawn chest item:", path, e);
    }
}

export function drawChests() {
    Globals.chests.forEach(chest => {
        const ctx = Globals.ctx;
        if (chest.state === 'closed') {
            ctx.fillStyle = chest.config.color || '#8e44ad'; // Purple
            ctx.fillRect(chest.x, chest.y, chest.width, chest.height);
            // Lock icon
            if (chest.locked) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(chest.x + 15, chest.y + 15, 10, 10);
            }
        } else {
            ctx.fillStyle = '#555'; // Open
            ctx.fillRect(chest.x, chest.y, chest.width, chest.height);
            ctx.strokeStyle = '#8e44ad';
            ctx.strokeRect(chest.x, chest.y, chest.width, chest.height);
        }
    });
}
