import { Globals } from './Globals.js';
import { log, spawnFloatingText } from './Utils.js';
import { SFX } from './Audio.js';

export function spawnSwitches(roomData) {
    Globals.switches = [];
    if (!roomData.switches) return;

    const config = roomData.switches;
    let list = [];

    // Dictionary Support (Object of Objects)
    if (typeof config === 'object' && !Array.isArray(config) && config.x === undefined) {
        list = Object.values(config);
    }
    // Single Object
    else if (!Array.isArray(config)) {
        list = [config];
    }
    // Array
    else {
        list = config;
    }

    list.forEach(cfg => {
        if (!cfg.x || !cfg.y) return;

        // Parse Reroll Cost Logic
        let startCost = 0;
        let increment = 0;
        if (cfg.reroll && typeof cfg.reroll === 'object') {
            startCost = cfg.reroll.cost || 0;
            increment = cfg.reroll.incrementCost || 0;
        } else {
            // Legacy / Simple support
            startCost = (cfg.rerollCost !== undefined) ? cfg.rerollCost : (cfg.defaultCost || 0);
            increment = 0;
        }

        Globals.switches.push({
            x: cfg.x,
            y: cfg.y,
            size: cfg.size || 40,
            action: cfg.action || 'none',
            rerollCost: startCost,
            rerollIncrement: increment,
            shard: cfg.shard || 'green', // Default to green
            colour: cfg.colour || cfg.color || null, // Store custom color
            state: 'idle', // idle, active
            cooldown: 0,
            isPressed: false
        });
    });
}

export function updateSwitches() {
    Globals.switches.forEach(s => {
        if (s.cooldown > 0) s.cooldown--;

        // Collision with Player
        const p = Globals.player;
        if (!p) return;

        const dist = Math.hypot(p.x - s.x, p.y - s.y);

        // Visual Press State (Down if player is on it)
        s.isPressed = (dist < s.size);

        // Activation Distance (Step on)
        if (s.isPressed && s.state === 'idle' && s.cooldown <= 0) {
            activateSwitch(s);
        }

        // Reset if stepped off
        if (dist > s.size + 10 && s.state === 'active') {
            s.state = 'idle';
        }
    });
}

function activateSwitch(s) {
    // Check Cost
    if (s.rerollCost > 0) {
        const cost = s.rerollCost;
        const shardType = s.shard || 'green';
        const inventoryKey = shardType === 'red' ? 'redShards' : 'greenShards';
        const currentShards = Globals.player.inventory[inventoryKey] || 0;

        if (currentShards < cost) {
            spawnFloatingText(s.x, s.y, cost + " " + shardType.toUpperCase() + " Shards!", "#e74c3c"); // Red Text
            s.cooldown = 60;
            SFX.cantDoIt()
            return;
        }

        Globals.player.inventory[inventoryKey] -= cost;
        // Determine color for floating text based on shard type
        const floatColor = shardType === 'red' ? '#e74c3c' : '#2ecc71';
        spawnFloatingText(s.x, s.y - 10, "-" + cost, floatColor);

        // Increment Cost handling
        if (s.rerollIncrement > 0) {
            if (s.rerollIncrement <= 1) {
                // Percentage (e.g. 1 = 100%, 0.1 = +10%)
                const newCost = cost * (1 + s.rerollIncrement);
                s.rerollCost = Math.round(newCost);
                // Ensure it always increases by at least 1
                if (s.rerollCost <= cost) s.rerollCost = cost + 1;
            } else {
                // Flat addition
                s.rerollCost = cost + s.rerollIncrement;
            }
        }
    }

    s.state = 'active';
    s.cooldown = 60; // 1 second debounce
    SFX.doorUnlocked(); // Click sound
    log("Switch Activated:", s.action);

    if (s.action === 'shop') {
        try {
            rerollShop(s);
        } catch (e) {
            console.error("Reroll failed", e);
        }
    }
}

function rerollShop(s) {
    // Reroll Logic
    // 1. Find all chests
    // 2. Assign new random item
    // 3. Reset state logic

    const allItems = window.allItemTemplates || Globals.itemTemplates; // Ensure consistent access
    // Filter for valid spawnable items only

    // User requested active check for shop items
    const pool = Array.isArray(allItems) ? allItems.filter(i =>
        i && i.location &&
        i.spawnable !== false &&
        i.type !== 'unlock' &&
        i.rarity !== 'special' &&
        (!i.purchasable || i.purchasable.active !== false)
    ) : []; // Handle if itemTemplates is object not array? logic implies array.

    if (pool.length === 0) {
        spawnFloatingText(s.x, s.y, "No Items!", "red");
        return;
    }

    let rerolledCount = 0;
    Globals.chests.forEach(chest => {
        // Validation
        if (!chest || !chest.config || typeof chest.config !== 'object') return;

        // Decide what chests to reroll. All of them?
        // Only "Shop" chests usually. 
        // But we don't have a "shop type" on chest.
        // Assuming all chests in a "Shop Room" are shop items.

        // Pick random item
        const item = pool[Math.floor(Math.random() * pool.length)];

        if (item && item.location) {
            // Update Chest Config
            // We need to support 'contains' as an array
            chest.config.contains = [item.location];

            // Name Update (Optional, will be resolved on Interaction/Draw ideally, but we have helper in Chests.js)
            if (item.name) chest.config.name = item.name;

            // Reset State
            chest.state = 'closed';

            // Update Cost and Lock
            if (item.purchasable && item.purchasable.active) {
                // Determine Unlock Type based on purchaseType
                // Chests.js expects 'greenshards', 'redshards', or 'key'
                let uType = item.purchasable.purchaseType || 'greenshards';
                // Normalize if needed, but Chests.js handles 'green' includes

                chest.locked = true;
                chest.config.locked = {
                    unlockType: uType,
                    cost: item.purchasable.cost || 0
                };

                // Cleanup old simple cost if any
                delete chest.config.cost;
                delete chest.config.purchaseType;
            } else {
                // Free item?
                chest.locked = false;
                delete chest.config.locked;
                delete chest.config.cost;
            }

            rerolledCount++;
            spawnFloatingText(chest.x, chest.y - 20, "Restocked!", "#2ecc71");
        }
    });

    if (rerolledCount > 0) {
        spawnFloatingText(s.x, s.y - 20, "SHOP REROLLED", "#f1c40f");
    } else {
        spawnFloatingText(s.x, s.y - 20, "Nothing to reroll", "#95a5a6");
    }
}

export function drawSwitches() {
    const ctx = Globals.ctx;
    ctx.save();
    Globals.switches.forEach(s => {
        const x = s.x;
        const y = s.y;
        const size = s.size;
        const isActive = s.state === 'active';
        const isDepressed = isActive || s.isPressed;

        // Depression Offset: Idle = -4px (Up), Active = 0px (Flush)
        const offset = isDepressed ? 0 : -4;

        // Shadow (if raised)
        if (!isDepressed) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x - size / 2 + 4, y - size / 2 + 4, size, size);
        }

        // Main Plate Color (User Custom or Default Red/Green)
        const btnColor = isActive ? '#27ae60' : (s.colour || s.color || '#c0392b');

        // Fill
        ctx.fillStyle = btnColor;
        ctx.fillRect(x - size / 2, y - size / 2 + offset, size, size);

        // Border (Thick, darker - mimicking the snippet's style)
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Generic darkening for border
        ctx.strokeRect(x - size / 2, y - size / 2 + offset, size, size);

        // Label
        ctx.font = "8px 'Press Start 2P'";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";

        let label = s.action === 'shop' ? "REROLL" : "SWITCH";
        if (s.rerollCost > 0) {
            // Updated Label as per Step 1480 logic
            label += ` (${s.rerollCost} Shards)`;
        }
        ctx.fillText(label, x, y + size / 2 + 15);
    });
    ctx.restore();
}
