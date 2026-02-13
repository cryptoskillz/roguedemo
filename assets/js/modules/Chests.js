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
                const isInteractKey = Globals.keys['Space'] || Globals.keys['Enter'] || Globals.keys['e']; // Support E/Enter/Space

                if (chest.locked) {
                    if (isInteractKey) {
                        // Debounce?
                        Globals.keys['Space'] = false; // Consume
                        Globals.keys['Enter'] = false;
                        Globals.keys['e'] = false;

                        if (Globals.player.inventory.keys > 0) {
                            Globals.player.inventory.keys--;
                            openChest(chest);
                            spawnFloatingText(chest.x, chest.y - 20, "Unlocked!", "#f1c40f");
                        } else {
                            spawnFloatingText(chest.x, chest.y - 20, "Locked", "#e74c3c");
                        }
                    }
                    // Always resolve collision if locked
                    resolveCollision(Globals.player, chest);
                } else {
                    // Unlocked
                    if (chest.solid) {
                        // Push back
                        resolveCollision(Globals.player, chest);

                        // Open only on key press
                        if (isInteractKey) {
                            Globals.keys['Space'] = false; // Consume
                            Globals.keys['Enter'] = false;
                            Globals.keys['e'] = false;
                            openChest(chest);
                        }
                    } else {
                        // Non-solid (auto-open on bump)
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
    // a = Entity (Player/Bullet) - Center Origin (size) or TopLeft (width)
    // b = Chest - Top-Left Origin (width/height)

    // A Bounds
    let aLeft, aRight, aTop, aBottom;
    if (a.size && !a.width) { // Radius/Center logic (and no explicit width override)
        aLeft = a.x - a.size;
        aRight = a.x + a.size;
        aTop = a.y - a.size;
        aBottom = a.y + a.size;
    } else { // Top-Left logic (fallback)
        aLeft = a.x;
        aRight = a.x + (a.width || 30);
        aTop = a.y;
        aBottom = a.y + (a.height || 30);
    }

    // B Bounds (Chest)
    const bLeft = b.x;
    const bRight = b.x + b.width;
    const bTop = b.y;
    const bBottom = b.y + b.height;

    return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function resolveCollision(player, chest) {
    // PAD COLLISION to fix "20px into it"
    const padding = 25; // Increased buffer for gun
    const chestW = chest.width + padding * 2;
    const chestH = chest.height + padding * 2;
    const chestX = chest.x - padding;
    const chestY = chest.y - padding;

    // Use Player Size/Dimensions
    const pW = player.width || player.size || 30;
    const pH = player.height || player.size || 30;

    const playerCX = player.x + pW / 2;
    const playerCY = player.y + pH / 2;
    const chestCX = chestX + chestW / 2;
    const chestCY = chestY + chestH / 2;

    const dx = playerCX - chestCX;
    const dy = playerCY - chestCY;

    const combinedHalfW = pW / 2 + chestW / 2;
    const combinedHalfH = pH / 2 + chestH / 2;

    const overlapX = combinedHalfW - Math.abs(dx);
    const overlapY = combinedHalfH - Math.abs(dy);

    if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
            if (dx > 0) player.x += overlapX;
            else player.x -= overlapX;
        } else {
            if (dy > 0) player.y += overlapY;
            else player.y -= overlapY;
        }
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
    const url = chest.manifest.startsWith('/') ? JSON_PATHS.ROOT + chest.manifest.substring(1) : JSON_PATHS.ROOT + chest.manifest;

    try {
        const res = await fetch(url);
        manifestData = await res.json();
    } catch (e) {
        console.error("Failed to load chest manifest", e);
        return;
    }

    let items = manifestData.items;
    let basePath = 'rewards/items/';

    if (!items && manifestData.unlocks) {
        items = manifestData.unlocks;
        basePath = 'rewards/unlocks/';
    }

    if (!manifestData || !items) return;

    // Filter Items
    const contains = chest.config.contains || []; // Regex strings
    const pool = [];

    items.forEach(itemPath => {
        const match = contains.some(pattern => {
            const regexStr = pattern.replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexStr}`); // Remove $ to allow partial match if desired? User used "game*" vs "game/logic..."
            // "game*" -> "^game.*" matches "game/logic/items"
            // With ^ and $, "game*" matches "game/logic/items". 
            // Correct.
            return regex.test(itemPath);
        });

        if (match) pool.push(itemPath);
    });

    if (pool.length === 0) {
        log("Chest found no matching items.");
        return;
    }

    pool.forEach(itemToSpawn => {
        spawnItem(itemToSpawn, chest.x, chest.y, basePath);
    });
}

async function spawnItem(path, x, y, basePath = 'rewards/items/') {
    // Load item template
    let fullPath = path;
    if (!path.startsWith('/') && !path.startsWith('rewards/') && !path.startsWith('json/')) {
        fullPath = basePath + path;
    }

    try {
        const res = await fetch(`${JSON_PATHS.ROOT}${fullPath}.json?t=${Date.now()}`);
        const itemData = await res.json();
        if (!itemData.spawnable) return

        Globals.groundItems.push({
            x: x + 10 + (Math.random() - 0.5) * 20, // Spread spawn
            y: y + 10 + (Math.random() - 0.5) * 20,
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

        // --- DRAW CHEST GRAPHIC ---
        // Box Body
        const x = chest.x;
        const y = chest.y;
        const w = chest.width;
        const h = chest.height;
        const baseColor = chest.config.color || '#8e44ad'; // Purple default

        // Shadow/Base
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x + 2, y + h - 5, w - 4, 5);

        if (chest.state === 'closed') {
            // Main Box
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y + 10, w, h - 10);

            // Lid (Top part)
            ctx.fillStyle = adjustColor(baseColor, 20); // Lighter
            ctx.fillRect(x, y, w, 10);

            // Trim / Detail (Dark border or straps)
            ctx.fillStyle = '#34495e';
            ctx.fillRect(x + 5, y + 10, 5, h - 10); // Left strap
            ctx.fillRect(x + w - 10, y + 10, 5, h - 10); // Right strap

            // Lock
            if (chest.locked) {
                ctx.fillStyle = '#f1c40f'; // Gold lock
                ctx.fillRect(x + w / 2 - 5, y + 5, 10, 10);

                // Keyhole
                ctx.fillStyle = '#000';
                ctx.fillRect(x + w / 2 - 2, y + 8, 4, 4);
            } else {
                // Metal clasp
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(x + w / 2 - 4, y + 5, 8, 8);
            }
        } else {
            // Open State
            // Back of box (dark inside)
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(x, y + 10, w, h - 10);

            // Front panel (fallen?) or just open box logic
            // Let's draw open box (top flap open?)

            // Front face (same color)
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y + 15, w, h - 15);

            // Lid (Open, maybe slanted up)
            ctx.fillStyle = adjustColor(baseColor, 20);
            // Draw Lid rotated? Simplified: Just a thin rect above?
            ctx.fillRect(x, y - 10, w, 10);

            // Trim
            ctx.fillStyle = '#34495e';
            ctx.fillRect(x + 5, y + 15, 5, h - 15);
            ctx.fillRect(x + w - 10, y + 15, 5, h - 15);
        }

        // --- DRAW NAME ABOVE ---
        // Name Logic: config.name || id
        const name = chest.config.name || chest.id || "Chest";

        ctx.save();
        ctx.font = "12px 'Press Start 2P', monospace"; // Match game font if possible
        ctx.textAlign = "center";

        // Text Shadow
        ctx.fillStyle = "black";
        ctx.fillText(name, x + w / 2 + 1, y - 8 + 1);

        // Text Color
        ctx.fillStyle = "white";
        ctx.fillText(name, x + w / 2, y - 8);

        // INTERACTION PROMPT
        if (chest.state === 'closed') {
            const dist = Math.hypot(Globals.player.x - (x + w / 2), Globals.player.y - (y + h / 2));
            if (dist < 60) {
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.fillStyle = "#f1c40f"; // Gold
                ctx.fillText("SPACE", x + w / 2, y - 22);
            }
        }

        ctx.restore();
    });
}
// Helper (Quick HSL adjust or similar would be better but simple hex logic is tricky without libs)
// Placeholder for color adjust, just using hex for specific parts above.
function adjustColor(color, amount) {
    return color; // TODO: Implement color adjustment or use static variants
}
