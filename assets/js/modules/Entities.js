import { Globals } from './Globals.js';
import { log, spawnFloatingText, triggerSpeech } from './Utils.js';
import { SFX } from './Audio.js';
import { generateLore } from './Utils.js'; // Assuming generateLore is in Utils (or I need to extract it)
import { CONFIG, STATES, BOUNDARY, DOOR_SIZE, JSON_PATHS } from './Constants.js';
import { updateWelcomeScreen, updateUI, drawTutorial, drawMinimap, drawBossIntro, updateFloatingTexts, drawFloatingTexts, showCredits, updateGameStats } from './UI.js';

// Functions will be appended below

// Debug Spawn Helper
export function spawnEnemyAt(type, x, y, overrides = {}) {
    if (!Globals.gameData.enemyConfig) return;

    const group = {
        type: "enemy",
        variant: type,
        x: x,
        y: y
    };

    // Apply Config & Defaults
    const inst = {
        type: 'enemy',
        x: x, y: y,
        roomX: Globals.player.roomX,
        roomY: Globals.player.roomY
    };

    applyEnemyConfig(inst, group);

    // Ensure Critical Stats
    inst.hp = overrides.hp || inst.hp || 10;
    inst.maxHp = inst.hp;
    inst.size = overrides.size || inst.size || 25;
    inst.color = overrides.color || inst.color || '#e74c3c';
    inst.speed = overrides.speed || inst.speed || 1;
    inst.damage = inst.damage || 1;
    inst.vx = (Math.random() - 0.5) * inst.speed;
    inst.vy = (Math.random() - 0.5) * inst.speed;
    inst.pushback = { x: 0, y: 0 };
    inst.isDead = false;
    inst.flashTime = 0;

    // Shape Override
    if (overrides.shape) inst.shape = overrides.shape;

    // MoveType Override (Static)
    if (overrides.moveType) {
        inst.moveType = overrides.moveType;
        if (inst.moveType === 'static') {
            inst.speed = 0;
            inst.vx = 0;
            inst.vy = 0;
        }
    }

    // Assign ID
    inst.id = Math.random().toString(36).substr(2, 9);

    Globals.enemies.push(inst);
    log("Debug Spawned Enemy:", type, "at", Math.round(x), Math.round(y));
}

export function applyEnemyConfig(inst, group) {
    const config = Globals.gameData.enemyConfig || {
        variants: ['speedy', 'small', 'large', 'massive', 'gunner', 'turret', 'medium'],
        shapes: ['circle', 'square', 'triangle', 'hexagon', 'diamond', 'star'],
        colors: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'],
        variantStats: {},
        modeStats: {}
    };

    // 1. Randomise Variant
    if (group.randomise || group.randomiseVariant) {
        group.variant = config.variants[Math.floor(Math.random() * config.variants.length)];
    }

    // 1b. Randomise Shape
    if (group.randomiseShape) {
        inst.shape = config.shapes[Math.floor(Math.random() * config.shapes.length)];
    }

    // 1c. Randomise Colour
    if (group.randomiseColour) {
        inst.color = config.colors[Math.floor(Math.random() * config.colors.length)];
    }

    // 2. Apply Variant Stats
    const stats = config.variantStats[group.variant];
    if (stats) {
        if (stats.size) inst.size = (inst.size || 25) * stats.size;
        if (stats.speed) inst.speed = (inst.speed || 1) * stats.speed;
        if (stats.hp) inst.hp = Math.max(1, (inst.hp || 10) * stats.hp);
        if (stats.damage) inst.damage = (inst.damage || 1) * stats.damage;
        if (stats.gun) inst.gun = stats.gun;

        // Special case for turret moveType
        if (group.variant === 'turret' && stats.moveType === 'static') {
            if (!group.moveType) group.moveType = {};
            if (!group.moveType.type) group.moveType.type = 'static';
        }
    }

    // 2b. Special Case for Turret Object Schema (New)
    if (group.turret && group.turret.active) {
        if (!inst.moveType) inst.moveType = {};
        // Ensure it's an object if it was a string
        if (typeof inst.moveType !== 'object') inst.moveType = { type: inst.moveType || 'static' };

        inst.moveType.type = 'static';
        inst.moveType.x = group.turret.x;
        inst.moveType.y = group.turret.y;

        // Force static properties
        inst.speed = 0;

        // Ensure it has a gun if not already assigned (by variant)
        if (!inst.gun) {
            const defaults = Globals.gameData.enemyConfig?.turretDefaults;
            inst.gun = defaults?.gun || "json/rewards/items/guns/enemy/peashooter.json";
        }
    }

    // 3. Apply Shape (Only if NOT randomised)
    if (group.shape && !group.randomiseShape) {
        inst.shape = group.shape;
    }

    // Capture Base Stats (After Variant, Before Mode)
    if (!inst.baseStats) {
        inst.baseStats = {
            speed: inst.speed,
            hp: inst.hp,
            damage: inst.damage,
            color: inst.color,
            size: inst.size
        };
    }

    // 4. Apply Mode (Angry)
    // ALWAYS ANGRY OVERRIDE
    if (group.alwaysAngry || inst.alwaysAngry) {
        group.mode = 'angry';
        inst.alwaysAngry = true;
    }

    inst.mode = group.mode || 'normal'; // Store mode for rendering
    if (group.mode === 'angry') {
        const angryStats = config.modeStats.angry;
        if (angryStats) {
            if (angryStats.hp) inst.hp = (inst.hp || 10) * angryStats.hp;
            if (angryStats.damage) inst.damage = (inst.damage || 1) * angryStats.damage;

            // Special handling for speedy variant speed in angry mode
            if (group.variant === 'speedy' && angryStats.speedySpeed) {
                inst.speed = (inst.speed || 1) * angryStats.speedySpeed;
            } else if (angryStats.speed) {
                inst.speed = (inst.speed || 1) * angryStats.speed;
            }

            if (angryStats.color) inst.color = angryStats.color;

            // Angry Timer
            if (inst.alwaysAngry) {
                inst.angryUntil = Infinity;
            } else {
                const duration = inst.angryTime || angryStats.angryTime;
                if (duration) {
                    inst.angryUntil = Date.now() + duration;
                }
            }
        }
    }

    // 5. Apply Modifiers (Overrides)
    if (group.modifiers) {
        Object.assign(inst, group.modifiers);
    }
}
export function spawnEnemies() {
    Globals.enemies = [];
    //add the invul timer to the freeze until so they invulnerable for the time in player json
    const freezeUntil = Date.now() + (Globals.gameData.enterRoomFreezeTime || Globals.player.invulTimer || 1000);

    // Only apply invulnerability if NOT in start room
    if (Globals.player.roomX !== 0 || Globals.player.roomY !== 0) {
        Globals.player.invulnUntil = freezeUntil;
    }

    // CHECK SAVED STATE (Persistence)
    const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`;
    // If we have specific saved enemies, restore them (PRECISE STATE)
    if (Globals.levelMap[currentCoord] && Globals.levelMap[currentCoord].savedEnemies) {
        log("Restoring saved enemies for this room...");
        Globals.levelMap[currentCoord].savedEnemies.forEach(saved => {
            const typeKey = saved.templateId || saved.type;
            const template = Globals.enemyTemplates[typeKey] || { hp: 1, speed: 1, size: 25 }; // fallback
            const inst = JSON.parse(JSON.stringify(template));

            // Re-attach templateId for next save
            inst.templateId = typeKey;

            // Overwrite with saved state
            inst.x = saved.x;
            inst.y = saved.y;
            inst.hp = saved.hp;
            inst.maxHp = saved.maxHp || inst.hp; // Restore Max HP
            if (saved.moveType) inst.moveType = saved.moveType;
            if (saved.solid !== undefined) inst.solid = saved.solid;
            if (saved.indestructible !== undefined) inst.indestructible = saved.indestructible;

            // Standard init
            inst.frozen = true;
            inst.freezeEnd = freezeUntil;
            // Restore invulnerability based on type/indestructible logic
            inst.invulnerable = inst.indestructible || false;

            enemies.push(inst);
        });

        // Handle Ghost if Haunted (still spawn it separately if consistent with design?)
        // The original code handled Haunted via map property. 
        // We should probably fall through to allow ghost spawn if desired, BUT
        // the original code returns early if room is cleared. 
        // Here we have enemies, so we should allow Ghost check below?
        // Let's stick to restoring only explicitly saved ones for now. 
        // If the room was haunted, the ghost might be handled separately or saved?
        // Original logic: "If room is haunted... return". 
        // Let's keep the Ghost Check that is BELOW this block in my insertion point?
        // Wait, I am inserting this at the top.
        // Let's actually ensure we do the Haunted check separately as it was.
    }

    // START STANDARD SPAWN (Skip if we restored)
    if (Globals.enemies.length > 0 && !(Globals.levelMap[currentCoord] && Globals.levelMap[currentCoord].haunted)) return;

    // CHECK HAUNTED STATUS
    // If room is haunted, skip normal enemies and spawn Ghost immediately
    // const currentCoord = `${player.roomX},${player.roomY}`; // Already defined above
    if (Globals.levelMap[currentCoord] && Globals.levelMap[currentCoord].haunted) {
        log("The room is Haunted! The Ghost returns...");

        // Ensure ghostSpawned is true so we don't spawn another one later via timer
        ghostSpawned = true;

        const template = enemyTemplates["ghost"] || { hp: 2000, speed: 1.2, size: 50, type: "ghost" };
        const inst = JSON.parse(JSON.stringify(template));
        inst.maxHp = inst.hp; // Ensure Max HP for health bar
        // Inst config
        if (loreData) {
            // inst.lore = generateLore(inst);
            inst.lore = {
                displayName: "Player Snr",
                fullName: "Player Snr",
                nickname: "The Departed",
                title: "Player Snr"
            };
        }


        // Standard random placement or center
        inst.x = Math.random() * (canvas.width - 60) + 30;
        inst.y = Math.random() * (canvas.height - 60) + 30;
        inst.frozen = false; // Active immediately
        inst.invulnerable = false;

        Globals.enemies.push(inst);
        SFX.ghost();
        // return; // Don't skip normal spawns - user wants enemies + ghost
    }

    // FIX: If room is cleared, do NOT spawn normal enemies (but Ghost still spawns if haunted)
    if (Globals.roomData.cleared) return;

    // Skip if explicitly set to 0 enemies
    if (Globals.roomData.enemyCount === 0) return;

    // Use roomData.enemies if defined (array of {type, count}), otherwise fallback
    if (Globals.roomData.enemies && Array.isArray(Globals.roomData.enemies)) {
        log(`Spawning enemies for room: ${Globals.roomData.name}`, Globals.roomData.enemies);
        Globals.roomData.enemies.forEach(group => {
            const template = Globals.enemyTemplates[group.type];
            log(`Looking for enemy type: ${group.type}, found: ${!!template}`);
            if (template) {
                for (let i = 0; i < group.count; i++) {
                    const inst = JSON.parse(JSON.stringify(template));
                    inst.templateId = group.type; // Store ID for persistence lookup

                    // NEW: Apply Variants, Modes, and Modifiers
                    applyEnemyConfig(inst, group);

                    // ASSIGN LORE
                    if (Globals.loreData) {
                        inst.lore = generateLore(inst);
                    }

                    // MERGE moveType from Room Config (Override)
                    if (group.moveType) {
                        inst.moveType = { ...(inst.moveType || {}), ...group.moveType };
                    }

                    // Allow top-level spawn overrides (x, y) from room.json
                    if (group.x !== undefined) {
                        inst.moveType = inst.moveType || {};
                        inst.moveType.x = group.x;
                    }
                    if (group.y !== undefined) {
                        inst.moveType = inst.moveType || {};
                        inst.moveType.y = group.y;
                    }

                    // Indestructible Check
                    if (inst.hp === 0) {
                        inst.indestructible = true;
                        inst.hp = 9999; // Set high HP just in case, though we rely on the flag
                    }

                    // Determine Spawn Position
                    // User Rule: Use specified X/Y "unless its 0,0 then it will be ignored"
                    // We check inst.moveType because we just merged it. 
                    // Or specifically check the group override? User phrasing implies generic behavior.

                    // Helper to check valid coord
                    const mt = inst.moveType;
                    let useFixed = false;
                    let fixedX = 0;
                    let fixedY = 0;

                    if (mt && typeof mt === 'object') {
                        if (mt.x !== undefined && mt.y !== undefined) {
                            // Rule 1: Ignore 0,0 (treat as unset/random)
                            // Rule 2: user requested "if movetype has x,y start it there" regardless of type
                            if (mt.x !== 0 || mt.y !== 0) {
                                useFixed = true;
                                fixedX = mt.x;
                                fixedY = mt.y;
                            }
                        }
                    }

                    if (useFixed) {
                        inst.x = fixedX;
                        inst.y = fixedY;
                    } else {
                        inst.x = Math.random() * (Globals.canvas.width - 60) + 30;
                        inst.y = Math.random() * (Globals.canvas.height - 60) + 30;
                    }
                    inst.frozen = true;
                    inst.freezeEnd = freezeUntil;
                    inst.invulnerable = true;

                    if (Globals.bossKilled) {
                        inst.hp = (inst.hp || 1) * 2;
                        inst.speed = (inst.speed || 1) * 2;
                        inst.damage = (inst.damage || 1) * 2;
                    }

                    Globals.enemies.push(inst);
                    log(`Spawned ${inst.type} (ID: ${group.type}). Stealth: ${inst.stealth}, Indestructible: ${inst.indestructible}`);
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
            inst.templateId = randomType; // Store ID for persistence lookup
            inst.x = Math.random() * (Globals.canvas.width - 60) + 30;
            inst.y = Math.random() * (Globals.canvas.height - 60) + 30;
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

    // --- LATE BINDING: LORE & SPEECH & ANGRY MODE ---
    Globals.enemies.forEach(en => {
        // 0. Ensure MaxHP (for health bars)
        if (!en.maxHp) en.maxHp = en.hp;

        // 1. Generate Lore if missing
        if (!en.lore && Globals.loreData) {
            en.lore = generateLore(en);
        }

        // 2. Global Angry Mode (Boss Killed)
        if (Globals.bossKilled) {
            en.mode = 'angry';
            en.alwaysAngry = true;
            en.angryUntil = Infinity;

            // Apply Angry Stats immediately
            const angryStats = (Globals.gameData.enemyConfig && Globals.gameData.enemyConfig.modeStats && Globals.gameData.enemyConfig.modeStats.angry) ? Globals.gameData.enemyConfig.modeStats.angry : null;

            if (angryStats) {
                if (angryStats.damage) en.damage = (en.baseStats?.damage || en.damage || 1) * angryStats.damage;
                if (angryStats.speed) en.speed = (en.baseStats?.speed || en.speed || 1) * angryStats.speed;
                if (angryStats.color) en.color = angryStats.color;
            }
        }
    });

}
export async function dropBomb() {
    if (!Globals.player.bombType) return false;

    // Parse Timer Config
    let timerDuration = 1000;
    let timerShow = true;

    // Safety check just in case Globals.bomb is minimal
    const bombConf = Globals.bomb || {};

    // Check Max Drop Limit
    if (bombConf.maxDrop && Globals.bombs.length >= bombConf.maxDrop) {
        log("Max bombs reached!");
        return false;
    }

    if (typeof bombConf.timer === 'object' && bombConf.timer !== null) {
        timerDuration = Number(bombConf.timer.time) || 1000;
        timerShow = bombConf.timer.show !== false;
        if (bombConf.timer.active === false) timerDuration = Infinity;
    } else {
        // Handle number or missing
        timerDuration = Number(bombConf.timer);
        // Handle number or missing
        timerDuration = Number(bombConf.timer);
        if (isNaN(timerDuration)) timerDuration = 1000;
    }

    // DEBUG LOG
    console.log("Dropping Bomb Config:", bombConf);
    console.log("Calculated Timer Duration:", timerDuration);
    console.log("Timer Show:", timerShow);

    const baseR = Globals.bomb.size || 20;
    const maxR = Globals.bomb.explosion?.radius || Globals.bomb.radius || 120;
    const gap = 6;
    const backDist = Globals.player.size + baseR + gap;

    const isMoving = (Globals.keys['KeyW'] || Globals.keys['KeyA'] || Globals.keys['KeyS'] || Globals.keys['KeyD']);
    const isShooting = (Globals.keys['ArrowUp'] || Globals.keys['ArrowLeft'] || Globals.keys['ArrowDown'] || Globals.keys['ArrowRight']);

    // Determine Drop Direction (Facing)
    let dirX = 0;
    let dirY = 0;

    if (isMoving) {
        // Use Movement Direction
        if (Globals.keys['KeyW']) dirY = -1;
        if (Globals.keys['KeyS']) dirY = 1;
        if (Globals.keys['KeyA']) dirX = -1;
        if (Globals.keys['KeyD']) dirX = 1;
    } else if (isShooting) {
        // Use Shooting Direction
        if (Globals.keys['ArrowUp']) dirY = -1;
        if (Globals.keys['ArrowDown']) dirY = 1;
        if (Globals.keys['ArrowLeft']) dirX = -1;
        if (Globals.keys['ArrowRight']) dirX = 1;
    } else {
        // Fallback to Last Moved
        dirX = (Globals.player.lastMoveX === undefined && Globals.player.lastMoveY === undefined) ? 0 : (Globals.player.lastMoveX || 0);
        dirY = (Globals.player.lastMoveX === undefined && Globals.player.lastMoveY === undefined) ? 1 : (Globals.player.lastMoveY || 0);
    }

    let dropX, dropY, dropVx = 0, dropVy = 0;

    if (isMoving) {
        // MOVING: Drop Behind
        dropX = Globals.player.x - (dirX * backDist);
        dropY = Globals.player.y - (dirY * backDist);
        dropVx = dirX * 2;
        dropVy = dirY * 2;
    } else {
        // STATIONARY: Drop IN FRONT (Pushable)
        dropX = Globals.player.x + (dirX * backDist);
        dropY = Globals.player.y + (dirY * backDist);
    }

    // Check if drop position overlaps with an existing bomb
    let canDrop = true;
    for (const b of Globals.bombs) {
        const dist = Math.hypot(dropX - b.x, dropY - b.y);
        if (dist < (b.baseR || 15) * 2) {
            canDrop = false;
            break;
        }
    }

    // Wall Check
    if (dropX < BOUNDARY || dropX > Globals.canvas.width - BOUNDARY || dropY < BOUNDARY || dropY > Globals.canvas.height - BOUNDARY) {
        if (!isMoving) {
            // Clamp & Push Logic
            let pushAngle = 0;
            let clamped = false;

            if (dropX < BOUNDARY) { dropX = BOUNDARY + baseR; pushAngle = 0; clamped = true; }
            else if (dropX > Globals.canvas.width - BOUNDARY) { dropX = Globals.canvas.width - BOUNDARY - baseR; pushAngle = Math.PI; clamped = true; }

            if (dropY < BOUNDARY) { dropY = BOUNDARY + baseR; pushAngle = Math.PI / 2; clamped = true; }
            else if (dropY > Globals.canvas.height - BOUNDARY) { dropY = Globals.canvas.height - BOUNDARY - baseR; pushAngle = -Math.PI / 2; clamped = true; }

            if (clamped) {
                const pushDist = backDist + 5;
                Globals.player.x = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.width - BOUNDARY - Globals.player.size, dropX + Math.cos(pushAngle) * pushDist));
                Globals.player.y = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.height - BOUNDARY - Globals.player.size, dropY + Math.sin(pushAngle) * pushDist));
                canDrop = true;
            } else {
                canDrop = false;
            }
        } else {
            canDrop = false;
        }
    }

    if (!canDrop) return false;

    // Check Delay
    const bombDelay = (Globals.bomb?.fireRate || 2) * 1000;
    if (Date.now() - (Globals.player.lastBomb || 0) < bombDelay) return false;

    Globals.player.lastBomb = Date.now();

    // Create Bomb
    const bomb = {
        x: dropX,
        y: dropY,
        vx: dropVx,
        vy: dropVy,
        baseR: baseR,
        maxR: maxR,
        damage: Globals.bomb.damage || 1,
        timer: timerDuration, // Duration
        timerShow: timerShow,
        timerStart: Date.now(),
        exploding: false,
        type: Globals.player.bombType, // Use Player's bomb type
        color: Globals.bomb.colour || 'yellow', // Default color
        canShoot: !!Globals.bomb.canShoot, // Shootable?
        solid: !!Globals.bomb.solid,       // Solid?
        remoteDenoate: Globals.bomb.remoteDenoate || null,
        explodeAt: Date.now() + timerDuration,
        explosionDuration: Globals.bomb.explosion?.expirationDuration || Globals.bomb.explosion?.explosionDuration || 300,
        explosionColour: Globals.bomb.explosion?.explosionColour || Globals.bomb.colour || 'white',
        explosionRadius: Globals.bomb.explosion?.radius || Globals.bomb.radius || 100, // Explicit radius prop
        canDamagePlayer: !!(Globals.bomb.explosion?.canDamagePlayer),

        // Physics
        moveable: !!Globals.bomb.moveable,
        physics: Globals.bomb.physics || { friction: 0.9, mass: 1, restitution: 0.5 },
        friction: Globals.bomb.physics?.friction || 0.9, // Direct access for convenience

        // Interaction
        canInteract: Globals.bomb.canInteract || {},

        // Doors
        doors: Globals.bomb.doors || {},
        openLockedDoors: !!Globals.bomb.doors?.openLockedDoors,
        openRedDoors: !!Globals.bomb.doors?.openRedDoors,
        openSecretRooms: !!Globals.bomb.doors?.openSecretRooms
    };

    // Add to Active Bombs
    Globals.bombs.push(bomb);

    return true;
}
// Global Helper for spawning bullets (Player OR Enemy)
export function spawnBullet(x, y, vx, vy, weaponSource, ownerType = "player", owner = null) {
    const bulletConfig = weaponSource.Bullet || {};

    // Determine shape
    let bulletShape = bulletConfig.geometry?.shape || "circle";
    if (bulletShape === 'random' && bulletConfig.geometry?.shapes?.length > 0) {
        const possibleShapes = bulletConfig.geometry.shapes;
        bulletShape = possibleShapes[Math.floor(Math.random() * possibleShapes.length)];
    }

    const b = {
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        life: bulletConfig.range || 60,
        damage: bulletConfig.damage || 1,
        size: (bulletConfig.size || 5),
        curve: bulletConfig.curve || 0,
        homing: bulletConfig.homing,
        canDamagePlayer: bulletConfig.canDamagePlayer !== undefined ? bulletConfig.canDamagePlayer : (ownerType === 'enemy'),
        hasLeftPlayer: ownerType === 'enemy',
        shape: bulletShape,
        animated: bulletConfig.geometry?.animated || false,
        filled: bulletConfig.geometry?.filled !== undefined ? bulletConfig.geometry.filled : true,
        colour: bulletConfig.colour || "yellow",
        spinAngle: 0,
        hitEnemies: [],
        ownerType: ownerType, // 'player' or 'enemy'
        speed: Math.hypot(vx, vy) // Store initial speed for homing reliability
    };

    if (ownerType === 'enemy') {
        b.hasLeftPlayer = true; // No safety buffer needed for player
        // Optional: Safety buffer for the enemy who shot it?
    }

    Globals.bullets.push(b);
    return b;
}

export function fireBullet(direction, speed, vx, vy, angle) {
    // 1. Safety check / No Bullets Mode
    if (Globals.gun.Bullet?.NoBullets) {
        const now = Date.now();
        if (now - (Globals.player.lastClick || 0) > 200) {
            SFX.click();
            Globals.player.lastClick = now;
        }
        return;
    }

    // Ammo Check
    if (Globals.gun.Bullet?.ammo?.active) {
        if (Globals.player.reloading) return;
        if (Globals.player.ammo <= 0) {
            if (Globals.player.ammoMode === 'finite') return;
            if (Globals.player.ammoMode === 'reload' && Globals.player.reserveAmmo <= 0) return;
            reloadWeapon();
            return;
        }
        Globals.player.ammo--;
        if (Globals.player.ammo <= 0) {
            if (Globals.player.reserveAmmo > 0 || Globals.player.ammoMode === 'recharge') {
                reloadWeapon();
            }
        }
    }

    // --- REFACTORED FIRING LOGIC (Legacy Port) ---
    const bulletConf = Globals.gun.Bullet || {};
    console.log("FireBullet", { name: Globals.gun.name, reverse: bulletConf.reverseFire, number: bulletConf.number, spread: bulletConf.spreadRate });

    const count = bulletConf.number || 1;
    const spreadRate = bulletConf.spreadRate || 0.2;
    // logic.js used: (gun.Bullet?.spreadRate || 0.2)
    // If user has 1 in JSON, logic.js used 1 radian (~57deg). 
    // If user intended 1 degree, they should have put ~0.017. 
    // I will use raw value to match logic.js exactly.

    // 1. Determine Center Angle
    let centerAngle = 0;
    if (direction === 0) { // Mouse
        centerAngle = Math.atan2(vy, vx);
    } else if (direction === 1) centerAngle = -Math.PI / 2; // North
    else if (direction === 2) centerAngle = 0;             // East
    else if (direction === 3) centerAngle = Math.PI / 2;   // South
    else if (direction === 4) centerAngle = Math.PI;       // West

    // 2. Loop & Fire
    for (let i = 0; i < count; i++) {
        // Calculate Angle (Legacy Formula)
        // logic.js: let fanAngle = centerAngle + (count > 1 ? (i - (count - 1) / 2) * spreadRate : 0);
        let fanAngle = centerAngle + (count > 1 ? (i - (count - 1) / 2) * spreadRate : 0);

        const bSpeed = bulletConf.speed || 7;
        const bvx = Math.cos(fanAngle) * bSpeed;
        const bvy = Math.sin(fanAngle) * bSpeed;

        // Spawn calc
        const barrelLength = Globals.player.size + 10;
        const startX = Globals.player.x + bvx * (barrelLength / bSpeed);
        const startY = Globals.player.y + bvy * (barrelLength / bSpeed);

        spawnBullet(startX, startY, bvx, bvy, Globals.gun, "player");

        // 3. Reverse Fire (Per Bullet)
        if (bulletConf.reverseFire) {
            console.log("Attempting Reverse Fire...");
            const revAngle = fanAngle + Math.PI;
            const rvx = Math.cos(revAngle) * bSpeed;
            const rvy = Math.sin(revAngle) * bSpeed;
            const rStartX = Globals.player.x + rvx * (barrelLength / bSpeed);
            const rStartY = Globals.player.y + rvy * (barrelLength / bSpeed);
            spawnBullet(rStartX, rStartY, rvx, rvy, Globals.gun, "player");
            console.log("Spawned Reverse Bullet");
        }
    }

    // 4. Multi-Directional (If active, fire cardinal/360 IN ADDITION to primary?)
    // In logic.js, this was inside the loop? No, in logic.js 3266 it was separate.
    // In logic.js 4363 (updateShooting), it called fireBullet(0...).
    // Inside fireBullet(0) (line 3304 logic.js), it checked multiDirectional.
    // So YES, for EVERY shot in the shotgun spread, it triggers Multi-Directional?
    // THAT seems like a lot of bullets. 
    // If count=3, it runs 3 times.
    // If inside that logic, it checks multiDirectional...
    // WAIT. logic.js `fireBullet` (3266) takes `direction`.
    // `updateShooting` calls `fireBullet(0, ...)` loops `count` times.
    // `fireBullet` at 3266 checks `direction === 0`.
    // So YES, it triggers multi-directional logic `count` times.
    // I will replicate this "flaw/feature" to ensure exact parity.

    if (bulletConf.multiDirectional?.active) {
        // Handle Multi-Directional (Runs ONCE per fire call in my refactor? 
        // No, I should run it `count` times if I want exact parity, 
        // BUT `Entities.js` `fireBullet` is called ONCE per click/key press with `count` handled inside.
        // So I should run it ONCE here, unless the user WANTS 3x 360 bursts.
        // logic.js called `fireBullet` `count` times.
        // My `fireBullet` handles `count`. 
        // So I should run it ONCE here.

        const md = bulletConf.multiDirectional;
        const spawn = (dx, dy) => {
            const barrelLength = Globals.player.size + 10;
            // Normalize direction to get Unit Vector, then scale by barrelLength
            const len = Math.hypot(dx, dy);
            // Avoid divide by zero
            const udx = len > 0 ? (dx / len) : 0;
            const udy = len > 0 ? (dy / len) : 0;

            const startX = Globals.player.x + udx * barrelLength;
            const startY = Globals.player.y + udy * barrelLength;

            spawnBullet(startX, startY, dx, dy, Globals.gun, "player");
        };

        if (md.fireNorth) spawn(0, -speed);
        if (md.fireEast) spawn(speed, 0);
        if (md.fireSouth) spawn(0, speed);
        if (md.fireWest) spawn(-speed, 0);
        if (md.fire360) {
            const step = 18; // Changed from 20 to 18 to ensure 90/270 (North/South) are hit (360/18 = 20 bullets)
            for (let d = 0; d < 360; d += step) {
                const rad = d * (Math.PI / 180);
                spawn(Math.cos(rad) * speed, Math.sin(rad) * speed);
            }
        }
    }



    Globals.bulletsInRoom++;
    Globals.bulletsInRoom++;

    // --- RECOIL ---
    const recoil = Globals.gun.Bullet?.recoil || 0;
    if (recoil > 0) {
        if (direction === 0) {
            // Mouse aiming - approximate recoil? Or just skip? 
            // For now, let's skip mouse recoil or calculate reverse vector
            const len = Math.hypot(vx, vy);
            if (len > 0) {
                Globals.player.x -= (vx / len) * recoil;
                Globals.player.y -= (vy / len) * recoil;
            }
        } else if (direction === 1) { // North
            Globals.player.y += recoil;
        } else if (direction === 2) { // East
            Globals.player.x -= recoil;
        } else if (direction === 3) { // South
            Globals.player.y -= recoil;
        } else if (direction === 4) { // West
            Globals.player.x += recoil;
        }

        // Wall collision check for player after recoil
        if (Globals.player.x < 50) Globals.player.x = 50;
        if (Globals.player.x > Globals.canvas.width - 50) Globals.player.x = Globals.canvas.width - 50;
        if (Globals.player.y < 50) Globals.player.y = 50;
        if (Globals.player.y > Globals.canvas.height - 50) Globals.player.y = Globals.canvas.height - 50;
    }
}

export function reloadWeapon() {
    if (Globals.player.reloading) return;
    if (Globals.player.ammoMode === 'finite') return; // No reload for finite mode

    Globals.player.reloading = true;
    Globals.player.reloadStart = Date.now();
    Globals.player.reloadDuration = Globals.player.reloadTime || 1000;

    log("Reloading...");
    // Optional: Add sound here
    // SFX.reload(); 
}
export function updateBulletsAndShards(aliveEnemies) {
    Globals.bullets.forEach((b, i) => {
        // --- PLAYER COLLISION (Friendly Fire) ---
        const distToPlayer = Math.hypot(Globals.player.x - b.x, b.y - Globals.player.y);
        const collisionThreshold = Globals.player.size + b.size;

        if (!b.hasLeftPlayer) {
            // Check if it has exited the player for the first time
            if (distToPlayer > collisionThreshold) {
                b.hasLeftPlayer = true;
            }
        } else {
            // Only check collision if it has safely left the player once
            if (distToPlayer < collisionThreshold) {
                // Debug Log
                if (b.canDamagePlayer) console.log("Bullet hitting player! Damage:", b.damage, "canDamagePlayer:", b.canDamagePlayer);

                // Hit Player
                if (b.canDamagePlayer) {
                    if (!Globals.player.invuln && Date.now() > (Globals.player.invulnUntil || 0)) {
                        takeDamage(b.damage || 1);
                        // Remove bullet
                        Globals.bullets.splice(i, 1);
                        return;
                    }
                } else {
                    // Harmless collision - destroy bullet
                    Globals.bullets.splice(i, 1);
                    return;
                }
            }
        }

        // --- HOMING LOGIC ---
        if (b.homing && aliveEnemies && aliveEnemies.length > 0) {
            // Filter valid targets (excluding stealth)
            const targets = aliveEnemies.filter(en => !en.stealth);

            if (targets.length > 0) {
                // Find closest enemy
                let closest = targets[0];
                let minDist = Infinity;
                targets.forEach(en => {
                    const d = Math.hypot(b.x - en.x, b.y - en.y);
                    if (d < minDist) { minDist = d; closest = en; }
                });

                // Rotate velocity towards target
                const targetAngle = Math.atan2(closest.y - b.y, closest.x - b.x);

                // Steer towards target
                // 0.1 steer strength is standard, 0.5 is very strong
                // logic.js used complex turn rate. 
                // Simple vector addition:
                const steerStr = 0.5; // Strong homing
                b.vx += Math.cos(targetAngle) * steerStr;
                b.vy += Math.sin(targetAngle) * steerStr;

                // Normalize to bullet's INTRINSIC speed (fixed on spawn)
                const speed = b.speed || 5;
                const currMag = Math.hypot(b.vx, b.vy);
                if (currMag > 0) {
                    b.vx = (b.vx / currMag) * speed;
                    b.vy = (b.vy / currMag) * speed;
                }
            } else {
                // No valid targets? Behave like normal bullet (or curve if set)
                // Fallthrough to curve check below if we want strict behavior, 
                // but usually homing bullets just go straight if no target.
            }

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
        // --- PARTICLES ---
        // --- PARTICLES ---
        if (Globals.gun.Bullet?.particles?.active && Math.random() < (Globals.gun.Bullet.particles.frequency || 0.5)) {
            Globals.particles.push({
                x: b.x,
                y: b.y,
                life: 1.0,
                maxLife: Globals.gun.Bullet.particles.life || 0.5,
                size: (b.size || 5) * (Globals.gun.Bullet.particles.sizeMult || 0.5),
                color: b.colour || "yellow"
            });
        }

        // --- WALL COLLISION ---
        if (b.x < 0 || b.x > Globals.canvas.width || b.y < 0 || b.y > Globals.canvas.height) {
            if (Globals.gun.Bullet?.wallBounce) {
                if (b.x < 0 || b.x > Globals.canvas.width) b.vx *= -1;
                if (b.y < 0 || b.y > Globals.canvas.height) b.vy *= -1;
            } else {
                // Check for wallExplode OR general explode on impact if not a shard
                if (Globals.gun.Bullet?.Explode?.active && !b.isShard) {
                    if (Globals.gun.Bullet.Explode.wallExplode) spawnShards(b);
                }
                Globals.bullets.splice(i, 1);
                return; // Use return to skip further processing for this bullet
            }
        }

        // --- Bomb Collision (Shootable Bombs) ---
        let hitBomb = false;
        for (let j = 0; j < Globals.bombs.length; j++) {
            const bomb = Globals.bombs[j]; // Renamed 'b' to 'bomb' to avoid conflict with 'bullet'
            // Collision check for ANY bomb (solid or shootable)
            const distToBomb = Math.hypot(bomb.x - b.x, bomb.y - b.y);
            const collisionRadius = (bomb.baseR || 15) + b.size;

            if (distToBomb < collisionRadius && !bomb.exploding) {
                if (bomb.canShoot) {
                    // Detonate
                    bomb.exploding = true;
                    bomb.explosionStartAt = Date.now();
                    SFX.explode(0.3);
                    Globals.bullets.splice(i, 1);
                    hitBomb = true;
                    break;
                } else if (bomb.solid) {
                    // Solid but not shootable = block bullet (destroy bullet)
                    // Optional: Spawn particles/sparks?
                    Globals.bullets.splice(i, 1);
                    hitBomb = true;
                    break;
                }
            }
        }
        if (hitBomb) return; // Use return to skip further processing for this bullet

        // --- Enemy Collision ---
        b.life--;
        if (b.life <= 0) Globals.bullets.splice(i, 1);
    });
}

export function updateShooting() {
    // --- 5. SHOOTING ---
    const shootingKeys = !Globals.gun.Bullet?.NoBullets && (Globals.keys['ArrowUp'] || Globals.keys['ArrowDown'] || Globals.keys['ArrowLeft'] || Globals.keys['ArrowRight']);
    if (shootingKeys) {

        // STATIONARY AIMING LOGIC
        // If not moving (no WASD), aim in the direction of the arrow key
        const isMoving = Globals.keys['KeyW'] || Globals.keys['KeyA'] || Globals.keys['KeyS'] || Globals.keys['KeyD'];
        if (!isMoving) {
            if (Globals.keys['ArrowUp']) { Globals.player.lastMoveX = 0; Globals.player.lastMoveY = -1; }
            else if (Globals.keys['ArrowDown']) { Globals.player.lastMoveX = 0; Globals.player.lastMoveY = 1; }
            else if (Globals.keys['ArrowLeft']) { Globals.player.lastMoveX = -1; Globals.player.lastMoveY = 0; }
            else if (Globals.keys['ArrowRight']) { Globals.player.lastMoveX = 1; Globals.player.lastMoveY = 0; }
        }

        const fireDelay = (Globals.gun.Bullet?.fireRate ?? 0.3) * 1000;
        if (Date.now() - (Globals.player.lastShot || 0) > fireDelay) {
            // Check if we can play audio (have ammo and not reloading)
            const hasAmmo = !Globals.gun.Bullet?.ammo?.active || (!Globals.player.reloading && Globals.player.ammo > 0);
            if (hasAmmo && !Globals.gun.Bullet?.NoBullets) SFX.shoot(0.05);

            let centerAngle = 0;
            let dirCode = 0; // Default to mouse? No, this is keyboard logic.
            // Map Keys to Direction Code
            // 1=North, 2=East, 3=South, 4=West
            // fireBullet uses these codes to set base angle.
            // However, fireBullet also accepts vx/vy for mouse.
            // If we pass dirCode 1-4, vx/vy are ignored in fireBullet logic I wrote?
            // Let's check fireBullet: "else if (direction === 1) centerAngle = -Math.PI / 2;"
            // Yes, it ignores vx/vy.

            if (Globals.gun.frontLocked) {
                // If front locked, aim matches movement?
                // logic checks lastMoveY/X.
                centerAngle = Math.atan2(Globals.player.lastMoveY || 0, Globals.player.lastMoveX || 1);
                // We need to convert this angle to a Direction Code or pass it?
                // fireBullet doesn't support arbitrary angle unless direction=0 and we pass vx/vy matching that angle.
                const speed = Globals.gun.Bullet?.speed || 7;
                fireBullet(0, speed, Math.cos(centerAngle) * speed, Math.sin(centerAngle) * speed, centerAngle);
            }
            else {
                if (Globals.keys['ArrowUp']) dirCode = 1;
                else if (Globals.keys['ArrowDown']) dirCode = 3;
                else if (Globals.keys['ArrowLeft']) dirCode = 4;
                else if (Globals.keys['ArrowRight']) dirCode = 2;

                // Call unified logic
                const speed = Globals.gun.Bullet?.speed || 7;
                fireBullet(dirCode, speed, 0, 0, 0);
            }

            Globals.player.lastShot = Date.now();
        }
    }
}

export function updateRemoteDetonation() {
    let detonated = false;

    for (let i = 0; i < Globals.bombs.length; i++) {
        const b = Globals.bombs[i];
        if (!b.exploding && b.remoteDenoate?.active) {
            const keyName = b.remoteDenoate.key || "space";

            let isPressed = false;
            // Use Globals.keys
            if (keyName.toLowerCase() === "space" && Globals.keys["Space"]) isPressed = true;
            else if (Globals.keys[keyName]) isPressed = true;

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
        if (Globals.keys["Space"]) Globals.keys["Space"] = false;
    }
}

export function updateBombInteraction() {
    if (!Globals.keys["Space"]) return;

    let kicked = false;
    // Find closest kickable bomb
    let closestB = null;
    let minD = Infinity;

    Globals.bombs.forEach(b => {
        if (b.canInteract?.active && b.canInteract.type === 'kick') {
            const d = Math.hypot(b.x - Globals.player.x, b.y - Globals.player.y);
            const kickRange = b.canInteract.distance || 60; // Default range

            if (d < kickRange && d < minD) {
                minD = d;
                closestB = b;
            }
        }
    });

    if (closestB) {
        // Calculate kick angle (from player to bomb)
        const angle = Math.atan2(closestB.y - Globals.player.y, closestB.x - Globals.player.x);
        const force = Globals.player.physics?.strength || 15; // Kick strength based on player stats

        // Apply velocity (physics must be enabled on bomb)
        closestB.vx = Math.cos(angle) * force;
        closestB.vy = Math.sin(angle) * force;

        log("Bomb Kicked!");
        kicked = true;
    }

    if (kicked) Globals.keys["Space"] = false; // Consume input
}



export function updateUse() {
    if (!Globals.keys["Space"]) return;

    // consume input so it fires once
    Globals.keys["Space"] = false;

    if (Globals.gameState !== STATES.PLAY) return;

    // Start the Tron music if it hasn't started yet
    // (Handled by startAudio listener now)

    const roomLocked = Globals.isRoomLocked();
    const doors = Globals.roomData.doors || {};
    if (roomLocked) return; // keep your existing rule: can't unlock while enemies alive

    // Helper: are we close enough to a door?
    const inRangeTop = (door) => {
        const doorX = door.x !== undefined ? door.x : Globals.canvas.width / 2;
        return Globals.player.y <= BOUNDARY + 5 && Globals.player.x > doorX - DOOR_SIZE && Globals.player.x < doorX + DOOR_SIZE;
    };
    const inRangeBottom = (door) => {
        const doorX = door.x !== undefined ? door.x : Globals.canvas.width / 2;
        return Globals.player.y >= Globals.canvas.height - BOUNDARY - 5 && Globals.player.x > doorX - DOOR_SIZE && Globals.player.x < doorX + DOOR_SIZE;
    };
    const inRangeLeft = (door) => {
        const doorY = door.y !== undefined ? door.y : Globals.canvas.height / 2;
        return Globals.player.x <= BOUNDARY + 5 && Globals.player.y > doorY - DOOR_SIZE && Globals.player.y < doorY + DOOR_SIZE;
    };
    const inRangeRight = (door) => {
        const doorY = door.y !== undefined ? door.y : Globals.canvas.height / 2;
        return Globals.player.x >= Globals.canvas.width - BOUNDARY - 5 && Globals.player.y > doorY - DOOR_SIZE && Globals.player.y < doorY + DOOR_SIZE;
    };

    // Prefer the door the player is "facing" (lastMoveX/lastMoveY), fall back to any nearby door.
    const candidates = [];
    if (doors.top?.active) candidates.push({ dir: "top", door: doors.top, inRange: inRangeTop });
    if (doors.bottom?.active) candidates.push({ dir: "bottom", door: doors.bottom, inRange: inRangeBottom });
    if (doors.left?.active) candidates.push({ dir: "left", door: doors.left, inRange: inRangeLeft });
    if (doors.right?.active) candidates.push({ dir: "right", door: doors.right, inRange: inRangeRight });

    const facingDir =
        Globals.player.lastMoveY === -1 ? "top" :
            Globals.player.lastMoveY === 1 ? "bottom" :
                Globals.player.lastMoveX === -1 ? "left" :
                    Globals.player.lastMoveX === 1 ? "right" : null;

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
        if (Globals.player.inventory?.keys > 0) {
            Globals.player.inventory.keys--;
            if (Globals.elements.keys) Globals.elements.keys.innerText = Globals.player.inventory.keys;
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

export function checkRemoteExplosions() {
    const now = Date.now();
    // Scan all visited rooms for saved bombs
    Object.keys(Globals.levelMap).forEach(key => {
        // Skip current room (handled by normal update)
        if (key === `${Globals.player.roomX},${Globals.player.roomY}`) return;

        const roomData = Globals.levelMap[key];
        if (roomData && roomData.savedBombs) {
            roomData.savedBombs.forEach(b => {
                // Check if exploded remotely and hasn't triggered shake yet
                if (b.explodeAt && now > b.explodeAt && !b.remoteShakeTriggered) {

                    // Trigger Shake
                    Globals.screenShake.power = 5;
                    Globals.screenShake.endAt = now + 300; // Short shake

                    // Mark as triggered so it doesn't loop forever
                    b.remoteShakeTriggered = true;

                    log(`Remote Explosion detected in room ${key}!`);
                }
            });
        }
    });
}

export function updateRestart() {
    // --- 1. RESTART (Key R) ---
    // User requested 'r' to restart (keep items if in debug mode)
    if (Globals.keys['KeyR']) {
        // Debounce? initGame handles debounce via isInitializing
        // check debug mode
        // Is DEBUG_WINDOW_ENABLED global or in Globals?
        // logic.js used window.DEBUG_WINDOW_ENABLED. 
        // We can check Globals.gameData.debug?.windowEnabled or use the DOM check
        const isDebug = (window.DEBUG_WINDOW_ENABLED === true) || (Globals.elements.debugPanel && Globals.elements.debugPanel.style.display === 'flex');

        // User requested 'r' -> Restart Run.
        // We want to reset HP/Keys/Bombs (initGame(false))
        // BUT if Debug is ON, we want to Keep Weapon (handled in Game.js via resetWeaponState check)

        if (Globals.restartGame) Globals.restartGame(false);

        Globals.keys['KeyR'] = false; // consume key
    }

    // Check for Space Bar interaction (Key Unlock)
    // Check for Space Bar interaction (Key Unlock) -- REMOVED (Handled in main loop)

}


export function updateBombsPhysics() {
    Globals.bombs.forEach(b => {
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
            if (b.x > Globals.canvas.width - BOUNDARY - r) { b.x = Globals.canvas.width - BOUNDARY - r; b.vx *= res; }
            if (b.y < BOUNDARY + r) { b.y = BOUNDARY + r; b.vy *= res; }
            if (b.y > Globals.canvas.height - BOUNDARY - r) { b.y = Globals.canvas.height - BOUNDARY - r; b.vy *= res; }

            // Bomb vs Enemy Collision (Explode OR Bounce)
            if (b.canInteract?.explodeOnImpact || Math.abs(b.vx) > 0.5 || Math.abs(b.vy) > 0.5) {
                for (const en of Globals.enemies) {
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

export function updateEnemies() {
    const now = Date.now();
    const isRoomFrozen = now < Globals.roomFreezeUntil;

    Globals.enemies.forEach((en, ei) => {
        // 1. Skip if dead
        if (en.isDead) {
            en.deathTimer--;
            if (en.deathTimer <= 0) Globals.enemies.splice(ei, 1);
            return;
        }

        // GHOST SPEECH - Idle Chatter
        if (en.type === 'ghost') triggerSpeech(en, 'idle');

        // ROOM FREEZE OVERRIDE
        if (isRoomFrozen) {
            en.frozen = true;
            en.invulnerable = true;
        } else {
            const isEffectFrozen = en.freezeEnd && now < en.freezeEnd;
            if (!isEffectFrozen) {
                en.frozen = false;
                en.invulnerable = false;
            }
        }

        // Angry Timer Revert
        if (en.mode === 'angry' && !en.alwaysAngry && en.angryUntil && now > en.angryUntil) {
            en.mode = 'normal';
            if (en.baseStats) {
                // Revert Stats
                en.speed = en.baseStats.speed;
                en.damage = en.baseStats.damage;
                // HP Handling: Maintain current HP percentage or just cap? 
                // If we drop max HP (implied by baseStats.hp being lower), we should probably ensure current hp isn't > base.
                // But en.hp is used as current HP. 
                // Simple approach: If current HP > base HP, cap it.
                if (en.hp > en.baseStats.hp) en.hp = en.baseStats.hp;

                en.color = en.baseStats.color;

                // Reset size if we changed it? (Angry doesn't usually change size but safe to have)
                en.size = en.baseStats.size;
            }
        }

        // 2. Frozen/Movement Logic
        if (!en.frozen) {
            // --- STATIC MOVEMENT CHECK ---
            let isStatic = false;
            if (en.moveType) {
                if (en.moveType === 'static') isStatic = true;
                if (typeof en.moveType === 'object' && en.moveType.type === 'static') isStatic = true;
                // 'track' type (or undefined) falls through to default movement below
            }

            if (!isStatic) {
                // --- STEERING BEHAVIORS ---
                // Determine Move Strategy
                let isRunAway = false;
                if (en.moveType === 'runAway') isRunAway = true;
                if (typeof en.moveType === 'object' && en.moveType.type === 'runAway') isRunAway = true;

                // 1. Seek (or Flee) Player
                let dx = Globals.player.x - en.x;
                let dy = Globals.player.y - en.y;
                const distToPlayer = Math.hypot(dx, dy);
                let dirX = 0, dirY = 0;

                if (distToPlayer > 0.1) {
                    // If runAway, we invert the direction to push AWAY from player
                    const factor = isRunAway ? -1.0 : 1.0;
                    dirX = (dx / distToPlayer) * factor;
                    dirY = (dy / distToPlayer) * factor;
                }

                // 2. Avoid Bombs
                const AVOID_WEIGHT = 4.0;
                // Heavy enemies (Bosses, Large Variants) don't fear bombs, they kick them.
                const isHeavy = (en.type === 'boss' || (en.size && en.size >= 35));

                if (!isHeavy) {
                    for (const b of Globals.bombs) {
                        if (b.solid && !b.exploding) {
                            const bdx = en.x - b.x; const bdy = en.y - b.y;
                            const bDist = Math.hypot(bdx, bdy);
                            const safeDist = en.size + (b.baseR || 15) + 50;
                            if (bDist < safeDist) {
                                const push = (safeDist - bDist) / safeDist;
                                if (bDist > 0) { dirX += (bdx / bDist) * push * AVOID_WEIGHT; dirY += (bdy / bDist) * push * AVOID_WEIGHT; }
                            }
                        }
                    }
                } else {
                    // Heavy Enemy Bomb Kicking Logic
                    for (const b of Globals.bombs) {
                        if (b.solid && !b.exploding) {
                            const dist = Math.hypot(en.x - b.x, en.y - b.y);
                            // Check simpler collision radius
                            if (dist < en.size + (b.baseR || 15)) {
                                // Kick!
                                const angle = Math.atan2(b.y - en.y, b.x - en.x);
                                const force = 8.0; // Strong kick
                                b.vx = Math.cos(angle) * force;
                                b.vy = Math.sin(angle) * force;
                                b.moveable = true; // Ensure it slides
                            }
                        }
                    }
                }

                // 2.2 Avoid Solid Enemies (e.g. Turrets)
                for (const other of Globals.enemies) {
                    if (other !== en && !other.isDead && other.solid) {
                        const odx = en.x - other.x; const ody = en.y - other.y;
                        const oDist = Math.hypot(odx, ody);
                        const safeDist = en.size + other.size + 40; // Detection range
                        if (oDist < safeDist) {
                            const push = (safeDist - oDist) / safeDist;
                            if (oDist > 0) {
                                dirX += (odx / oDist) * push * AVOID_WEIGHT;
                                dirY += (ody / oDist) * push * AVOID_WEIGHT;
                            }
                        }
                    }
                }

                // 2.5 Avoid Walls (Stay in Room)
                const WALL_DETECT_DIST = 30;
                const WALL_PUSH_WEIGHT = 1.5; // Reduced so they can corner the player

                if (en.x < BOUNDARY + WALL_DETECT_DIST) dirX += WALL_PUSH_WEIGHT * ((BOUNDARY + WALL_DETECT_DIST - en.x) / WALL_DETECT_DIST);
                if (en.x > Globals.canvas.width - BOUNDARY - WALL_DETECT_DIST) dirX -= WALL_PUSH_WEIGHT * ((en.x - (Globals.canvas.width - BOUNDARY - WALL_DETECT_DIST)) / WALL_DETECT_DIST);
                if (en.y < BOUNDARY + WALL_DETECT_DIST) dirY += WALL_PUSH_WEIGHT * ((BOUNDARY + WALL_DETECT_DIST - en.y) / WALL_DETECT_DIST);
                if (en.y > Globals.canvas.height - BOUNDARY - WALL_DETECT_DIST) dirY -= WALL_PUSH_WEIGHT * ((en.y - (Globals.canvas.height - BOUNDARY - WALL_DETECT_DIST)) / WALL_DETECT_DIST);

                // 3. Separation
                const SEP_WEIGHT = 6.0; // Increased for stronger push
                Globals.enemies.forEach((other, oi) => {
                    if (ei === oi || other.isDead) return;
                    const odx = en.x - other.x; const ody = en.y - other.y;
                    const odist = Math.hypot(odx, ody);
                    const checkDist = (en.size + other.size); // Full size check
                    if (odist < checkDist) {
                        const overlap = checkDist - odist;
                        if (odist === 0) {
                            // Random spread if exact overlap
                            const rx = (Math.random() - 0.5) * 2;
                            const ry = (Math.random() - 0.5) * 2;
                            dirX += rx * 10; dirY += ry * 10;
                            en.x += rx; en.y += ry; // Hard nudge
                        } else {
                            const push = (checkDist - odist) / checkDist;
                            // Cubic push for steering velocity
                            const strongPush = push * push * push;
                            dirX += (odx / odist) * strongPush * SEP_WEIGHT * 5;
                            dirY += (ody / odist) * strongPush * SEP_WEIGHT * 5;

                            // HARD MOVEMENT RESOLVE (Fix stuck enemies)
                            const resolveFactor = 0.1;
                            en.x += (odx / odist) * overlap * resolveFactor;
                            en.y += (ody / odist) * overlap * resolveFactor;
                        }
                    }
                });

                // 4. Move
                const finalMag = Math.hypot(dirX, dirY);
                if (finalMag > 0) {
                    const vx = (dirX / finalMag) * en.speed;
                    const vy = (dirY / finalMag) * en.speed;

                    // Collision Check
                    const isBlocked = (tx, ty) => {
                        // Check Bombs
                        for (const b of Globals.bombs) {
                            if (b.solid && !b.exploding && Math.hypot(tx - b.x, ty - b.y) < en.size + (b.baseR || 15)) return true;
                        }
                        // Check Solid Enemies (e.g. Turrets)
                        for (const other of Globals.enemies) {
                            if (other === en || other.isDead || !other.solid) continue;
                            const dist = Math.hypot(tx - other.x, ty - other.y);
                            if (dist < en.size + other.size) return true;
                        }
                        return false;
                    };
                    const nextX = en.x + vx; const nextY = en.y + vy;

                    // Helper to clamp
                    const clampX = (v) => Math.max(BOUNDARY + en.size / 2, Math.min(Globals.canvas.width - BOUNDARY - en.size / 2, v));
                    const clampY = (v) => Math.max(BOUNDARY + en.size / 2, Math.min(Globals.canvas.height - BOUNDARY - en.size / 2, v));

                    if (!isBlocked(nextX, nextY)) {
                        en.x = clampX(nextX);
                        en.y = clampY(nextY);
                    }
                    else if (!isBlocked(nextX, en.y)) { en.x = clampX(nextX); }
                    else if (!isBlocked(en.x, nextY)) { en.y = clampY(nextY); }
                }
            } // End !isStatic

            // --- GUN LOGIC ---
            if (en.gun && typeof en.gun === 'string' && !en.gunConfig) {
                if (!en.gunLoading) {
                    en.gunLoading = true;
                    fetch(en.gun + '?t=' + Date.now())
                        .then(r => r.json())
                        .then(d => {
                            en.gunConfig = d;
                            en.gunLoading = false;
                            console.log(`Loaded Enemy Gun: ${en.gun}`, d.Bullet?.canDamagePlayer ? "Has Damage" : "NO DAMAGE", d);
                        })
                        .catch(e => { en.gunConfig = { error: true }; });
                }
            }
            if (en.gunConfig && !en.gunConfig.error && Globals.player.hp > 0) {
                const dist = Math.hypot(Globals.player.x - en.x, Globals.player.y - en.y);
                if (dist < 500) {
                    let fireRate = (en.gunConfig.Bullet?.fireRate || 1) * 1000;

                    // Apply Angry Fire Rate Modifier
                    if (en.mode === 'angry') {
                        const config = Globals.gameData.enemyConfig || {};
                        const angryStats = config.modeStats?.angry;
                        if (angryStats && angryStats.fireRate) {
                            fireRate *= angryStats.fireRate;
                        }
                    }

                    if (!en.lastShot || now - en.lastShot > fireRate) {
                        const angle = Math.atan2(Globals.player.y - en.y, Globals.player.x - en.x);
                        const speed = en.gunConfig.Bullet?.speed || 4;
                        const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
                        const sx = en.x + Math.cos(angle) * (en.size + 5); const sy = en.y + Math.sin(angle) * (en.size + 5);
                        spawnBullet(sx, sy, vx, vy, en.gunConfig, "enemy", en);
                        en.lastShot = now;
                    }
                }
            }
        } // End !en.frozen

        // 3. Player Collision (Thorns)
        const distToPlayer = Math.hypot(Globals.player.x - en.x, Globals.player.y - en.y);
        if (distToPlayer < en.size + Globals.player.size) {
            const baseDmg = Globals.gun.Bullet?.damage || 1;
            const thornsDmg = baseDmg / 2;
            if (thornsDmg > 0 && !en.frozen && !en.invulnerable && !en.indestructible) {
                en.hp -= thornsDmg;
                en.hitTimer = 5;
                if (en.hp <= 0 && !en.isDead) { // Kill check handled by shared block below? No, separate logs usually.
                    // But shared block is safer. Let's rely on falling through.
                }
            }
            playerHit(en, true, true, true);
        }

        // 4. BULLET COLLISION
        Globals.bullets.forEach((b, bi) => {
            // Skip checks only if invulnerable AND NOT explicitly solid
            // (Standard enemies are valid targets, but if invulnerable we usually skip unless solid)
            // Default "solid" to false if undefined? No, standard behavior for invuln is pass-through.
            // If user sets "solid": true, we process collision even if invuln.
            if (en.invulnerable && !en.solid) return;

            if (b.ownerType === 'enemy') return;
            const dist = Math.hypot(b.x - en.x, b.y - en.y);
            if (dist < en.size + (b.size || 5)) {
                if (Globals.gun.Bullet?.pierce && b.hitEnemies?.includes(ei)) return;

                let finalDamage = b.damage || 1;
                const isCrit = Math.random() < (Globals.gun.Bullet?.critChance || 0);
                if (en.type !== 'ghost' && isCrit) {
                    finalDamage *= (Globals.gun.Bullet?.critDamage || 2);
                    en.lastHitCritical = true;
                    log(`CRIT! Chance: ${Globals.gun.Bullet?.critChance}, Damage: ${finalDamage}`);
                    SFX.yelp();

                    // Add hit particle
                    const hitColor = en.color || en.baseStats?.color || 'white';
                    Globals.particles.push({
                        x: en.x + (Math.random() - 0.5) * en.size,
                        y: en.y + (Math.random() - 0.5) * en.size,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5,
                        life: 0.5,
                        maxLife: 0.5,
                        size: 3,
                        color: hitColor
                    });
                    // Critical Hit Particles (Red + 50% Larger)
                    for (let i = 0; i < 8; i++) {
                        Globals.particles.push({
                            x: b.x,
                            y: b.y,
                            vx: (Math.random() - 0.5) * 5, // Explosion velocity
                            vy: (Math.random() - 0.5) * 5,
                            life: 1.0,
                            maxLife: 0.6,
                            size: (b.size || 5) * 0.75, // 50% larger than normal 0.5 mult
                            color: "red"
                        });
                    }
                } else {
                    en.lastHitCritical = false;
                }

                if (!en.indestructible && !en.invulnerable && Date.now() >= Globals.bossIntroEndTime) { // Only damage if not invuln/indestructible AND intro finished
                    en.hp -= finalDamage;
                    en.hitTimer = 10;

                    // Speech: Hit
                    triggerSpeech(en, 'hit');

                    // Angry After Hit Logic
                    if (en.angryAfterHit && Math.random() < en.angryAfterHit) {
                        const config = Globals.gameData.enemyConfig || {};
                        const angryStats = config.modeStats?.angry;
                        if (angryStats) {
                            // Ensure base stats are captured if they weren't already (e.g. if spawned without applyEnemyConfig or weird state)
                            if (!en.baseStats) {
                                en.baseStats = {
                                    speed: en.speed,
                                    hp: en.hp,
                                    damage: en.damage,
                                    color: en.color,
                                    size: en.size
                                };
                            }

                            // If already angry, just extend timer
                            if (en.mode === 'angry') {
                                if (!en.alwaysAngry && !Globals.bossKilled) {
                                    const duration = en.angryTime || angryStats.angryTime;
                                    if (duration) {
                                        en.angryUntil = Date.now() + duration;
                                    }
                                } else if (Globals.bossKilled) {
                                    en.alwaysAngry = true;
                                    en.angryUntil = Infinity;
                                }
                            } else {
                                // Become Angry
                                en.mode = 'angry';

                                // Apply Angry Stats (similar to applyEnemyConfig)
                                if (angryStats.damage) en.damage = (en.baseStats.damage || 1) * angryStats.damage;

                                // Special handling for speedy variant speed in angry mode
                                // We need to check variant. Assuming en.variant is set.
                                if (en.variant === 'speedy' && angryStats.speedySpeed) {
                                    en.speed = (en.baseStats.speed || 1) * angryStats.speedySpeed;
                                } else if (angryStats.speed) {
                                    // Use base speed * angry multiplier
                                    en.speed = (en.baseStats.speed || 1) * angryStats.speed;
                                }

                                if (angryStats.color) en.color = angryStats.color;

                                // Timer
                                if (en.alwaysAngry) {
                                    en.angryUntil = Infinity;
                                } else {
                                    const duration = en.angryTime || angryStats.angryTime;
                                    if (duration) {
                                        en.angryUntil = Date.now() + duration;
                                    }
                                }

                                log(`${en.type} became ANGRY!`);
                                SFX.scream();
                                spawnFloatingText(en.x, en.y - 30, "RAAAGH!", "red");

                                // Speech: Angry
                                triggerSpeech(en, 'angry');
                            }
                        }
                    }
                }

                // Explode/Remove bullet if it hit something solid or took damage
                // If it took damage, it's a hit.
                // If it didn't take damage (indestructible/invuln) BUT is solid, it's a hit.
                SFX.explode(0.08);

                if (en.type !== 'ghost' && Math.random() < (Globals.gun.Bullet?.freezeChance || 0)) {
                    en.frozen = true;
                    en.freezeEnd = now + (Globals.gun.Bullet?.freezeDuration || 1000);
                }

                if (Globals.gun.Bullet?.Explode?.active && !b.isShard) spawnShards(b);

                if (Globals.gun.Bullet?.pierce) {
                    if (!b.hitEnemies) b.hitEnemies = [];
                    b.hitEnemies.push(ei);
                    b.damage *= 0.5;
                    if (b.damage <= 0.1) Globals.bullets.splice(bi, 1);
                } else {
                    Globals.bullets.splice(bi, 1);
                }
            }
        });

        // 5. DEATH CHECK
        if (en.hp <= 0 && !en.isDead && !en.indestructible) {
            en.isDead = true;
            en.deathTimer = 30;
            log(`Enemy died: ${en.type}`);

            // DROP GREEN SHARDS (Difficulty Based)
            if (en.type !== 'boss') { // Bosses drop Red Shards separately
                const amount = calculateShardDrop('green', 'killEnemy', en);
                //update kill enemy global counter
                updateGameStats('kill');

                if (amount > 0) {
                    spawnShard(en.x, en.y, 'green', amount);
                }
            }

            if (en.type === 'boss') {
                log("BOSS DEFEATED! The Curse Strengthens... Resetting Rooms!");
                SFX.explode(0.5);

                // RED SHARD REWARD
                const amount = calculateShardDrop('red', 'killBoss', en);
                //update kill enemy global counter
                updateGameStats('bossKill');
                spawnShard(en.x, en.y, 'red', amount);

                Globals.bossKilled = true;

                // Clear Rooms
                Object.keys(Globals.visitedRooms).forEach(key => {
                    if (key !== `${Globals.player.roomX},${Globals.player.roomY}`) {
                        if (Globals.levelMap[key]) {
                            Globals.levelMap[key].cleared = false;
                            if (Globals.levelMap[key].roomData?.doors) {
                                Object.values(Globals.levelMap[key].roomData.doors).forEach(d => d.forcedOpen = true);
                            }
                        }
                    }
                });
            } else if (en.type === 'ghost') {
                log("Ghost Defeated!");
                if (Globals.gameData.rewards && Globals.gameData.rewards.ghost) {
                    spawnRoomRewards(Globals.gameData.rewards.ghost, "GHOST BONUS");
                    perfectEl.innerText = "GHOST BONUS!";
                    triggerPerfectText();

                    const specialPath = Globals.gameData.rewards.ghost.special?.item;
                    if (specialPath) {
                        (async () => {
                            try {
                                const url = "json" + (specialPath.startsWith('/') ? specialPath : '/' + specialPath);
                                const res = await fetch(`${url}?t=${Date.now()}`);
                                if (res.ok) {
                                    const itemData = await res.json();
                                    groundItems.push({
                                        x: en.x, y: en.y,
                                        data: itemData,
                                        roomX: Globals.player.roomX, roomY: Globals.player.roomY,
                                        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
                                        friction: 0.9, solid: true, moveable: true, size: 15, floatOffset: Math.random() * 100
                                    });
                                    log("Spawned Special Ghost Item:", itemData.name);
                                    spawnFloatingText(en.x, en.y - 40, "SPECIAL DROP!", "#e74c3c");
                                }
                            } catch (e) { console.error(e); }
                        })();
                    }
                }
            }
        }
    });

    // SPAWN PORTAL IF BOSS IS DEAD     AND NO ENEMIES LEFT
    // Only spawn portal in the BOSS ROOM
    const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`;
    // Check for active threats (ignore indestructible/static like turrets)
    const activeThreats = Globals.enemies.filter(en => !en.isDead && !en.indestructible);

    if (Globals.roomData.isBoss && activeThreats.length === 0 && !Globals.portal.active) {
        Globals.portal.active = true;
        Globals.portal.scrapping = false; // Reset flags
        Globals.portal.finished = false;
        Globals.portal.x = Globals.canvas.width / 2;
        Globals.portal.y = Globals.canvas.height / 2;
        log("Room Clear! Spawning Portal.");
    }
}

export function updatePortal() {
    if (!Globals.portal.active) return;
    const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`;
    // Only interact if in Boss Room (should match draw logic)
    if (!Globals.roomData.isBoss) return;

    const dist = Math.hypot(Globals.player.x - Globals.portal.x, Globals.player.y - Globals.portal.y);
    if (dist < 30) {

        // SCRAP MECHANIC
        if (!Globals.portal.scrapping && !Globals.portal.finished) {
            Globals.portal.scrapping = true;
            const scrapped = convertItemsToScrap(Globals.portal.x, Globals.portal.y);

            if (scrapped > 0) {
                // Wait for visual effect
                setTimeout(() => {
                    Globals.portal.scrapping = false;
                    Globals.portal.finished = true; // Prevent re-scrap

                    // EXPLICITLY TRIGGER COMPLETION (Don't wait for re-collision)
                    if (Globals.roomData.unlocks && Globals.roomData.unlocks.length > 0) {
                        Globals.handleUnlocks(Globals.roomData.unlocks);
                    } else {
                        handleLevelComplete();
                    }
                }, 1500);
                return;
            } else {
                Globals.portal.scrapping = false;
                Globals.portal.finished = true;
            }
        }

        if (Globals.portal.scrapping) return; // Wait

        // WIN GAME
        if (Globals.roomData.unlocks && Globals.roomData.unlocks.length > 0) {
            Globals.handleUnlocks(Globals.roomData.unlocks);
        } else {
            handleLevelComplete();
        }
    }
}

// Helper to scrap items -> Now converts to Red Shards if configured
function convertItemsToScrap(cx, cy) {
    let scrappedCount = 0;
    const scrapRange = 100; // Pixel radius to suck in items

    // Check Config
    const usePortalReward = Globals.gameData.rewards?.shards?.red?.enterPortal?.custom === true;

    for (let i = Globals.groundItems.length - 1; i >= 0; i--) {
        const item = Globals.groundItems[i];
        const dist = Math.hypot(item.x - cx, item.y - cy);

        if (dist < scrapRange) {

            if (usePortalReward) {
                // Convert to Red Shards - DIRECT AWARD (Auto-Pickup)
                const amount = calculateShardDrop('red', 'enterPortal', null);

                // Add to inventory directly
                Globals.player.inventory.redShards = (Globals.player.inventory.redShards || 0) + amount;
                Globals.player.redShards = Globals.player.inventory.redShards; // Sync legacy property if used

                // Visual Feedback
                spawnFloatingText(item.x, item.y, `+${amount} Shards`, "#e74c3c");

                // Optional: Spawn a particle effect or "ghost" shard flying to UI?
                // For now, text confirms it.
            } else {
                // Legacy Scrap Logic
                Globals.player.scrap = (Globals.player.scrap || 0) + 10;
                spawnFloatingText(item.x, item.y, "+10 Scrap", "#f1c40f");
            }

            // Remove item
            Globals.groundItems.splice(i, 1);
            scrappedCount++;
        }
    }
    return scrappedCount;
}

export function handleLevelComplete() {
    // GUARD: Prevent multiple triggers
    if (Globals.portal && !Globals.portal.active) return;
    if (Globals.portal) Globals.portal.active = false;

    // CREDITS CHECK (Before Unlocks or Next Level)
    if (Globals.roomData.completedItMate) {
        showCredits();
        return;
    }

    // 0. Handle Unlocks (First!)
    if (Globals.roomData.unlocks && Globals.roomData.unlocks.length > 0) {
        if (Globals.handleUnlocks) {
            // We await it? handleUnlocks is async (UI overlay). 
            // If we await, we pause the transition. That's desirable.
            // But handleLevelComplete is not async. 
            // We should make it async or handle the promise?
            // Existing handleUnlocks returns a promise that resolves when UI closes.
            Globals.handleUnlocks(Globals.roomData.unlocks).then(() => {
                // Recursively call to proceed after unlock UI used (clearing unlocks to prevent loop?)
                // OR just proceed logic here.
                proceedLevelComplete();
            });
            return;
        }
    }
    proceedLevelComplete();
}

function proceedLevelComplete() {
    // 1. Next Level?
    if (Globals.roomData.nextLevel && Globals.roomData.nextLevel.trim() !== "") {
        log("Proceeding to Next Level:", Globals.roomData.nextLevel);

        // Save State to LocalStorage (Robust Persistence)
        localStorage.setItem('rogue_transition', 'true');
        // Save Next Level as the "Current" level for restarts
        localStorage.setItem('rogue_current_level', Globals.roomData.nextLevel);

        // Ensure we save a clean copy without circular refs or huge data if any
        // But player object is simple enough.
        localStorage.setItem('rogue_player_state', JSON.stringify(Globals.player));

        // Load next level, Keep Stats
        initGame(true, Globals.roomData.nextLevel, true);
        return;
    }

    // 1.5 Welcome Screen?
    log("Checking Welcome Screen. Data:", Globals.roomData);
    if (Globals.roomData.welcomeScreen) {
        log("Level Complete. Returning to Welcome Screen.");
        if (Globals.goToWelcome) Globals.goToWelcome();
        return;
    }

    // 2. End Game / Victory?
    if (Globals.roomData.endGame) {
        Globals.gameState = STATES.WIN;
        updateUI();
        if (Globals.gameOver) Globals.gameOver();
        else console.error("Globals.gameOver is missing!");
        return;
    }

    // Default fallback: Just win/end if we hit the portal but no instructions (Legacy behavior)
    Globals.gameState = STATES.WIN;
    updateUI();
    if (Globals.gameOver) Globals.gameOver();
    else console.error("Globals.gameOver is missing!");
}

export function updateGhost() {
    if (Globals.gameState !== STATES.PLAY) return;

    // Check if Ghost should spawn
    const now = Date.now();
    // Use config from gameData, default if missing
    const ghostConfig = Globals.gameData.ghost || { spawn: true, roomGhostTimer: 10000 };

    // DELAY: If enemies are still alive (locking the room), hold the timer at zero.
    // This allows the player to fight without the ghost timer ticking down.
    // Check purely for combat enemies to avoid circular dependency with isRoomLocked()
    // EXCEPTION: If ghostEntry is set (ghost is following), we IGNORE this check and spawn immediately.
    const aliveEnemies = Globals.enemies.filter(en => !en.isDead);
    const combatMock = aliveEnemies.filter(en => en.type !== 'ghost');

    if (!Globals.ghostEntry && combatMock.length > 0) {
        Globals.roomStartTime = now;
        return;
    }

    // Only spawn if:
    // 1. Config enabled
    // 2. Not already spawned in this room
    // 3. Time exceeded
    if (ghostConfig.spawn && !Globals.ghostSpawned && (now - Globals.roomStartTime > ghostConfig.roomGhostTimer)) {
        if (Globals.player.roomX === 0 && Globals.player.roomY === 0) return; // Stop ghost in start room (Fixes welcome screen spawn)

        log("THE GHOST APPEARS!");
        Globals.ghostSpawned = true;

        // Mark room as Haunted (Persistent)
        const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`;
        if (Globals.levelMap[currentCoord]) {
            Globals.levelMap[currentCoord].haunted = true;
        }

        // Spawn Ghost
        const template = Globals.enemyTemplates["ghost"] || {
            hp: 2000, speed: 1.2, damage: 1000, size: 50, color: "rgba(231, 76, 60, 0.8)", type: "ghost"
        };

        const inst = JSON.parse(JSON.stringify(template));
        inst.maxHp = inst.hp; // Ensure Max HP for health bar

        // Assign Name
        inst.lore = {
            displayName: "Player Snr",
            fullName: "Player Snr",
            nickname: "The Departed",
            title: "Player Snr"
        };

        // Spawn Location   
        if (Globals.ghostEntry) {
            // Spawn at the door the player entered
            inst.x = Globals.ghostEntry.x;
            inst.y = Globals.ghostEntry.y;
            // Give it some momentum into the room
            inst.vx = Globals.ghostEntry.vx || 0;
            inst.vy = Globals.ghostEntry.vy || 0;
            Globals.ghostEntry = null; // Consume
        } else {
            // Default: Spawn away from player
            // Simple: Opposite corner or random edge
            if (Math.random() > 0.5) {
                inst.x = Globals.player.x > Globals.canvas.width / 2 ? 50 : Globals.canvas.width - 50;
                inst.y = Math.random() * Globals.canvas.height;
            } else {
                inst.x = Math.random() * Globals.canvas.width;
                inst.y = Globals.player.y > Globals.canvas.height / 2 ? 50 : Globals.canvas.height - 50;
            }
        }

        inst.frozen = false; // active immediately
        inst.invulnerable = false; // Ghost is killable? Or maybe super tanky (high HP in json)

        // Ghost specific: pass through walls? (Needs logic update in updateEnemies if so)
        // For now, standard movement

        Globals.enemies.push(inst);
        SFX.ghost(); // Spooky sound!
    }
}

// --- DAMAGE & SHIELD LOGIC ---
export function takeDamage(amount) {
    // 0. CHECK GODMODE
    if (typeof GODMODE_ENABLED !== 'undefined' && GODMODE_ENABLED) {
        log("BLOCKED DAMAGE! (God Mode Enabled)");
        return;
    }

    // 0. GLOBAL IMMUNITY CHECK (Room Freeze / I-Frames)
    // Applies to BOTH Shield and HP
    const now = Date.now();
    const until = Globals.player.invulnUntil || 0;

    if (Globals.player.invuln || now < until || Globals.gameData.debug?.godMode) {
        log(`BLOCKED DAMAGE! (Shield/HP Safe/GodMode). Rem Invul: ${until - now}ms`);
        return;
    }

    // 1. Check Shield
    if (Globals.player.shield?.active && Globals.player.shield.hp > 0) {
        Globals.player.shield.hp -= amount;
        SFX.click(0.5); // Shield hit sound (reuse click or new sound)

        // Overflow damage?
        if (Globals.player.shield.hp < 0) {
            // Optional: Surplus damage hits player?
            // For now, let's say shield break absorbs the full blow but breaks
            Globals.player.shield.hp = 0;
            SFX.explode(0.2); // Shield break sound
        }

        // Reset Regen Timer
        Globals.player.shield.lastHit = Date.now();
        return; // Damage absorbed
    }

    // 2. Health Damage
    Globals.player.hp -= amount;
    Globals.player.tookDamageInRoom = true;
    SFX.playerHit();

    // Trigger I-Frames
    // Use config timer, default 1000
    const iFrameDuration = Globals.player.invulHitTimer || 1000;
    Globals.player.invulnUntil = Date.now() + iFrameDuration;

    updateUI();
}

export function updateShield() {
    if (!Globals.player.shield?.active) return;

    // Debug only occasionally
    if (Math.random() < 0.005) {
        // log(`Shield Debug: Active=${player.shield.active}, HP=${player.shield.hp}/${player.shield.maxHp}, RegenActive=${player.shield.regenActive}, TimeSinceHit=${Math.round(now - (player.shield.lastHit || 0))}`);
    }

    if (!Globals.player.shield.regenActive) return;

    const now = Date.now();
    const regenDelay = Globals.player.shield.regenTimer || 1000;
    const lastHit = Globals.player.shield.lastHit || 0;
    const timeSinceHit = now - lastHit;

    // Only regen if we haven't been hit recently AND HP is not full
    if (timeSinceHit > 2000) {
        if (Globals.player.shield.hp < Globals.player.shield.maxHp) {
            // Regen tick
            if (!Globals.player.shield.lastRegen || now - Globals.player.shield.lastRegen > regenDelay) {
                Globals.player.shield.hp = Math.min(Globals.player.shield.hp + (Globals.player.shield.regen || 1), Globals.player.shield.maxHp);
                Globals.player.shield.lastRegen = now;
                // log(`Shield Regen Tick: +${player.shield.regen || 1} -> ${player.shield.hp}`);
            }
        }
    } else {
        // if (Math.random() < 0.01) log(`Shield Regen Paused: Hit ${Math.round(timeSinceHit)}ms ago`);
    }
}

export function drawEnemies() {

    Globals.enemies.forEach(en => {
        Globals.ctx.save();

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
            Globals.ctx.globalAlpha = en.isDead ? (en.deathTimer / 30) * baseAlpha : baseAlpha;

            // Ghostly Glow/Shadow
            Globals.ctx.shadowBlur = 20;
            Globals.ctx.shadowColor = en.color || "red";
        } else {
            // Standard Death Fade
            if (en.isDead) Globals.ctx.globalAlpha = en.deathTimer / 30;
        }

        // Visual Feedback: White for hit, Blue for frozen, Red for normal
        // Improved: Use invulColour if frozen/invulnerable
        if (en.hitTimer > 0) {
            Globals.ctx.fillStyle = en.invulColour || "white";
            en.hitTimer--; // Countdown the hit flash
        } else if (en.frozen || en.invulnerable) {
            Globals.ctx.fillStyle = en.invulColour || "#85c1e9"; // Use invulColour (white) if set, else fallback
        } else {
            Globals.ctx.fillStyle = en.color || "#e74c3c";
        }



        // DRAWING SHAPE
        const shape = en.shape || "circle";

        Globals.ctx.beginPath();

        if (shape === "square") {
            // Draw Square (centered)
            const s = (en.size + sizeMod) * 2; // Diameter to side length roughly? Or just size as half-width?
            // Existing logic uses size as radius. So square side should be roughly 2*radius?
            // Let's use size as "radius equivalent" so side = size * 2
            const side = (en.size + sizeMod); // actually let's stick to the visual expectation. radius 50 = 100 wide.
            // If I use rect from x-size, y-size to w=size*2, h=size*2
            Globals.ctx.rect(en.x - side, en.y + bounceY - side, side * 2, side * 2);
        } else if (shape === "triangle") {
            const r = en.size + sizeMod;
            const yOffset = en.y + bounceY;
            // Upward pointing triangle
            Globals.ctx.moveTo(en.x, yOffset - r);
            Globals.ctx.lineTo(en.x + r, yOffset + r);
            Globals.ctx.lineTo(en.x - r, yOffset + r);
            Globals.ctx.closePath();
        } else if (shape === "star") {
            const spikes = 5;
            const outerRadius = en.size + sizeMod;
            const innerRadius = outerRadius / 2;
            let rot = Math.PI / 2 * 3;
            let x = en.x;
            let y = en.y + bounceY;
            let step = Math.PI / spikes;

            Globals.ctx.moveTo(0, 0 - outerRadius); // Start at top
            for (let i = 0; i < spikes; i++) {
                x = en.x + Math.cos(rot) * outerRadius;
                y = en.y + bounceY + Math.sin(rot) * outerRadius;
                Globals.ctx.lineTo(x, y);
                rot += step;

                x = en.x + Math.cos(rot) * innerRadius;
                y = en.y + bounceY + Math.sin(rot) * innerRadius;
                Globals.ctx.lineTo(x, y);
                rot += step;
            }
            Globals.ctx.lineTo(en.x, en.y + bounceY - outerRadius);
            Globals.ctx.closePath();
        } else if (shape === "hexagon" || shape === "pentagon") {
            const sides = shape === "hexagon" ? 6 : 5;
            const r = en.size + sizeMod;
            const angleStep = (Math.PI * 2) / sides;
            // Rotate hexagon 30 deg (PI/6) to have flat top? Or 0 for pointy top.
            // Let's do -PI/2 to start at top center like circle/triangle expectations roughly
            const startAngle = -Math.PI / 2;

            Globals.ctx.moveTo(en.x + r * Math.cos(startAngle), (en.y + bounceY) + r * Math.sin(startAngle));
            for (let i = 1; i <= sides; i++) {
                const angle = startAngle + i * angleStep;
                Globals.ctx.lineTo(en.x + r * Math.cos(angle), (en.y + bounceY) + r * Math.sin(angle));
            }
            Globals.ctx.closePath();
        } else if (shape === "diamond") {
            const r = en.size + sizeMod;
            // Rhombus / Rotated Square
            Globals.ctx.moveTo(en.x, (en.y + bounceY) - r); // Top
            Globals.ctx.lineTo(en.x + r, (en.y + bounceY)); // Right
            Globals.ctx.lineTo(en.x, (en.y + bounceY) + r); // Bottom
            Globals.ctx.lineTo(en.x - r, (en.y + bounceY)); // Left
            Globals.ctx.closePath();
        } else {
            // Default: "circle"
            Globals.ctx.arc(en.x, en.y + bounceY, en.size + sizeMod, 0, Math.PI * 2);
        }

        Globals.ctx.fill();

        // Draw Name (After Fill to avoid color bleed)
        if (Globals.gameData.ShowEnemyNames !== false && en.lore && en.lore.displayName && !en.isDead) {
            Globals.ctx.save(); // Isolate text styles
            Globals.ctx.textAlign = "center";
            Globals.ctx.textBaseline = "bottom";
            Globals.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            Globals.ctx.font = "10px monospace";
            Globals.ctx.fillText(en.lore.displayName, en.x, en.y - en.size - 5);
            Globals.ctx.restore();
            Globals.ctx.restore();
        }

        // DRAW HEALTH BAR
        if (Globals.gameData.ShowEnemyHealth !== false && !en.isDead && en.maxHp > 0 && en.hp < en.maxHp) {
            const barWidth = 30;
            const barHeight = 4;
            const yOffset = en.size + 10; // Below enemy
            const pct = Math.max(0, en.hp / en.maxHp);

            Globals.ctx.save();
            Globals.ctx.fillStyle = "rgba(0,0,0,0.5)";
            Globals.ctx.fillRect(en.x - barWidth / 2, en.y + yOffset, barWidth, barHeight);

            Globals.ctx.fillStyle = pct > 0.5 ? "#2ecc71" : (pct > 0.25 ? "#f1c40f" : "#e74c3c");
            Globals.ctx.fillRect(en.x - barWidth / 2, en.y + yOffset, barWidth * pct, barHeight);
            Globals.ctx.restore();
        }

        // DRAW SPEECH BUBBLE
        if (en.speech && en.speech.timer > 0) {
            Globals.ctx.save();
            Globals.ctx.font = "bold 12px sans-serif";
            const text = en.speech.text;
            const textMetrics = Globals.ctx.measureText(text);
            const w = textMetrics.width + 10;
            const h = 20;
            const bX = en.x;
            const bY = en.y - en.size - 25 - (bounceY || 0); // Above name

            // Bubble Background
            Globals.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            Globals.ctx.strokeStyle = en.speech.color || "white";
            Globals.ctx.lineWidth = 1;

            // Rounded Rect
            Globals.ctx.beginPath();
            Globals.ctx.roundRect(bX - w / 2, bY - h, w, h, 5);
            Globals.ctx.fill();
            Globals.ctx.stroke();

            // Text
            Globals.ctx.fillStyle = en.speech.color || "white";
            Globals.ctx.textAlign = "center";
            Globals.ctx.textBaseline = "middle";
            Globals.ctx.fillText(text, bX, bY - h / 2);

            en.speech.timer--;
            Globals.ctx.restore();
        }

        // DRAW EYES
        Globals.ctx.fillStyle = "white";
        Globals.ctx.textAlign = "center";
        Globals.ctx.textBaseline = "middle";
        Globals.ctx.font = `bold ${Math.max(10, en.size * 0.8)}px sans-serif`;

        // Ensure eye color contrasts with body
        // Simple check: if body is white/very light, use black eyes? 
        // For now, default white, but if body is white (invuln), use black?
        if (en.hitTimer > 0 || en.frozen || en.invulnerable) {
            Globals.ctx.fillStyle = "black";
        }

        let eyes = "- -";

        if (en.frozen || (en.invulnerable && en.freezeEnd && Date.now() < en.freezeEnd)) {
            eyes = "* *";
        } else if (en.hitTimer > 0) {
            if (en.lastHitCritical) {
                eyes = "* !"; // Manga Style
            } else {
                eyes = "x x";
            }
        } else if (en.mode === 'angry') {
            eyes = "> <";
        }

        // Calculate Eye Offset to look at player
        const aimDx = Globals.player.x - en.x;
        const aimDy = Globals.player.y - en.y;
        const aimDist = Math.hypot(aimDx, aimDy);
        const lookOffset = en.size * 0.3; // How far eyes move
        let eyeX = en.x;
        let eyeY = en.y + bounceY;

        if (aimDist > 0) {
            eyeX += (aimDx / aimDist) * lookOffset;
            eyeY += (aimDy / aimDist) * lookOffset;
        }

        Globals.ctx.fillText(eyes, eyeX, eyeY);

        Globals.ctx.restore();
    });
}
// export function playerHit(en, invuln = false, knockback = false, shakescreen = false) {
// Refactored for Solidity vs Invulnerability Separation
// Refactored for Solidity vs Invulnerability Separation
export function playerHit(en, checkInvuln = true, applyKnockback = false, shakescreen = false) {

    // 1. DAMAGE CHECK (Invulnerability)
    // If checkInvuln is true (default), we verify I-frames
    // 1. DAMAGE CHECK (Invulnerability)
    let applyDamage = true;
    if (checkInvuln) {
        const now = Date.now();
        const until = Globals.player.invulnUntil || 0;
        if (Globals.player.invuln || (now < until && !en.ignoreInvuln)) {
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
    // Default solid to true if undefined
    const playerIsSolid = (Globals.player.solid !== undefined) ? Globals.player.solid : true;
    const enemyIsSolid = (en.solid !== undefined) ? en.solid : true;

    // DEBUG: Verify Solidity
    // log(`Hit Physics: PlayerSolid=${player.solid}, IsSolid=${playerIsSolid}, EnemySolid=${enemyIsSolid}, Apply=${applyKnockback}`);

    if (applyKnockback && playerIsSolid && enemyIsSolid) {
        let dx = Globals.player.x - en.x;
        let dy = Globals.player.y - en.y;

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
        const targetDist = en.size + Globals.player.size + padding;
        const needed = targetDist - len;

        if (needed > 0) {
            // Push player away
            Globals.player.x += nx * needed;
            Globals.player.y += ny * needed;
        }

        // Clamp to bounds
        Globals.player.x = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.width - BOUNDARY - Globals.player.size, Globals.player.x));
        Globals.player.y = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.height - BOUNDARY - Globals.player.size, Globals.player.y));
    }

    if (shakescreen) {
        const shakePower = (en.shake || 8) * (120 / 40);
        Globals.screenShake.power = Math.max(Globals.screenShake.power, shakePower);
        Globals.screenShake.endAt = Date.now() + (en.shakeDuration || 200);
    }
}
export function drawBombs(doors) {
    const now = Date.now();
    const ctx = Globals.ctx;

    // 3. --- BOMBS (Explosion & Door Logic) ---
    for (let i = Globals.bombs.length - 1; i >= 0; i--) {
        const b = Globals.bombs[i];
        if (!b.exploding && now >= b.explodeAt) {
            b.exploding = true;
            b.explosionStartAt = now;
            SFX.explode(0.3);

            // Local Explosion Shake (Stronger than remote)
            // Globals.screenShake or just screenShake? 
            // Previous code used screenShake variable. Assuming it's Global or filtered via Utils?
            // Usually Globals.screenShake in this codebase? Or maybe Utils handles it.
            // Let's assume Globals.screenShake if available, otherwise ignore or use function.
            // Actually previous code: screenShake.power = 20.
            // Let's use Globals.screenShake if defined.
            if (Globals.screenShake) {
                Globals.screenShake.power = 20;
                Globals.screenShake.endAt = now + 500;
            }
        }

        if (b.exploding) {
            const p = Math.min(1, (now - b.explosionStartAt) / b.explosionDuration);
            const r = b.baseR + (b.maxR - b.baseR) * p;

            if (!b.didDoorCheck) {
                b.didDoorCheck = true;
                Object.entries(doors).forEach(([dir, door]) => {
                    let dX = door.x ?? Globals.canvas.width / 2, dY = door.y ?? Globals.canvas.height / 2;
                    if (dir === 'top') dY = 0; if (dir === 'bottom') dY = Globals.canvas.height;
                    if (dir === 'left') dX = 0; if (dir === 'right') dX = Globals.canvas.width;

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

            // --- PLAYER PUSHBACK ---
            // Treat explosion as expanding solid circle
            const distToPlayer = Math.hypot(b.x - Globals.player.x, b.y - Globals.player.y);
            const safetyRadius = r + Globals.player.size + 2; // +2 padding

            if (distToPlayer < safetyRadius) {
                // Push player out
                let dx = Globals.player.x - b.x;
                let dy = Globals.player.y - b.y;

                // Handle perfect overlap
                if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
                    dx = (Math.random() - 0.5);
                    dy = (Math.random() - 0.5);
                }

                const len = Math.hypot(dx, dy);
                if (len > 0) {
                    const nx = dx / len;
                    const ny = dy / len;
                    const pushDist = safetyRadius - len;

                    Globals.player.x += nx * pushDist;
                    Globals.player.y += ny * pushDist;

                    // Clamp to bounds
                    Globals.player.x = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.width - BOUNDARY - Globals.player.size, Globals.player.x));
                    Globals.player.y = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.height - BOUNDARY - Globals.player.size, Globals.player.y));
                }
            }

            if (!b.didDamage) {
                b.didDamage = true;

                // --- PLAYER DAMAGE ---
                if (b.canDamagePlayer) {
                    const distPlayer = Math.hypot(b.x - Globals.player.x, b.y - Globals.player.y);
                    if (distPlayer < b.maxR) {
                        // takeDamage handles invulnerability checks
                        takeDamage(b.damage || 1);
                    }
                }

                Globals.enemies.forEach(en => {
                    const distEn = Math.hypot(b.x - en.x, b.y - en.y);
                    if (distEn < b.maxR) {
                        // FIX: check invulnerability AND Boss Intro
                        if (Globals.bossIntroEndTime && Date.now() < Globals.bossIntroEndTime) return;

                        // --- OCCLUSION CHECK: Is there a solid enemy in the way? ---
                        let blocked = false;
                        for (const blocker of Globals.enemies) {
                            if (blocker === en) continue; // Don't block self
                            if (blocker.isDead) continue; // Dead don't block
                            if (!blocker.solid) continue; // Only solid blocks

                            // Optimization: Blocker must be closer than the target
                            const distBlocker = Math.hypot(b.x - blocker.x, b.y - blocker.y);
                            if (distBlocker >= distEn) continue;

                            // Collision Check: Line Segment (Bomb -> Target) vs Circle (Blocker)
                            // Project Blocker onto Line Segment
                            const dx = en.x - b.x;
                            const dy = en.y - b.y;
                            const lenSq = dx * dx + dy * dy;
                            if (lenSq === 0) continue; // Overlap?

                            // t = projection factor
                            // Vector Bomb->Blocker (bx, by)
                            const bx = blocker.x - b.x;
                            const by = blocker.y - b.y;

                            // Dot Product
                            let t = (bx * dx + by * dy) / lenSq;
                            t = Math.max(0, Math.min(1, t)); // Clamp to segment

                            // Closest Point on segment
                            const closestX = b.x + t * dx;
                            const closestY = b.y + t * dy;

                            // Distance from Blocker Center to Closest Point
                            const distToLine = Math.hypot(blocker.x - closestX, blocker.y - closestY);

                            if (distToLine < (blocker.size || 25)) {
                                blocked = true;
                                log(`Blast Blocked! Target: ${en.type} saved by ${blocker.type}`);
                                break;
                            }
                        }

                        if (blocked) return;

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
                Globals.bombs.forEach(otherBomb => {
                    if (otherBomb !== b && !otherBomb.exploding) {
                        const dist = Math.hypot(b.x - otherBomb.x, b.y - otherBomb.y);
                        // Trigger if within blast radius
                        if (dist < b.maxR + otherBomb.baseR) {
                            // Instant detonate
                            otherBomb.exploding = true;
                            otherBomb.explosionStartAt = now; // Sync? Or delay slightly?
                            // Let's act immediately in next loop or force it?
                            // Setting exploding=true will handle it next frame or loop.
                            // But usually we want chain to feel instantaneous or rippling.
                            // Let's set startAt to now to trigger logic next frame.
                            otherBomb.explodeAt = now;
                        }
                    }
                });
            }

            // Draw Explosion
            ctx.fillStyle = b.explosionColour || "white";
            ctx.globalAlpha = 1 - p;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            if (p >= 1) {
                // Remove bomb
                Globals.bombs.splice(i, 1);
            }
        } else {
            // Draw ticking bomb
            ctx.save();
            ctx.translate(b.x, b.y);

            // Pulse effect?
            const pulse = 1 + Math.sin(now / 100) * 0.1;
            ctx.scale(pulse, pulse);

            // Draw Body
            ctx.fillStyle = b.colour || b.color || "yellow"; // Support both spellings
            ctx.beginPath();
            ctx.arc(0, 0, b.baseR, 0, Math.PI * 2);
            ctx.fill();

            // Draw Fuse / Detail?
            ctx.fillStyle = b.colour || b.color || "yellow"; // Match bomb color (no black hole)
            ctx.beginPath();
            ctx.arc(0, 0, b.baseR * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Draw Timer Text?
            if (b.timerShow && isFinite(b.explodeAt)) {
                ctx.fillStyle = "black"; // High contrast text
                ctx.font = "bold 12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const remaining = Math.max(0, ((b.explodeAt - now) / 1000).toFixed(1));
                ctx.fillText(remaining, 0, 0);
            }

            ctx.restore();
        }
    }
}





export function updateBombDropping() {
    if (Globals.keys['KeyB'] && Globals.player.inventory?.bombs > 0 && Globals.player.bombType) {
        // dropBomb handles delay checks, overlap checks, and valid position checks
        dropBomb().then(dropped => {
            if (dropped) {
                Globals.player.inventory.bombs--;
            }
        });
    }
}
export function updateMovementAndDoors(doors, roomLocked) {
    // 0. FREEZE if in Portal Scrap Logic
    if (typeof Globals.portal !== 'undefined' && Globals.portal.active && Globals.portal.scrapping) {
        // Optional: Pull player to center?
        const dx = Globals.portal.x - Globals.player.x;
        const dy = Globals.portal.y - Globals.player.y;
        Globals.player.x += dx * 0.1;
        Globals.player.y += dy * 0.1;
        return;
    }
    // --- 4. MOVEMENT & DOOR COLLISION ---
    const moveKeys = { "KeyW": [0, -1, 'top'], "KeyS": [0, 1, 'bottom'], "KeyA": [-1, 0, 'left'], "KeyD": [1, 0, 'right'] };

    // TRACK INPUT VECTOR for Diagonals
    let inputDx = 0;
    let inputDy = 0;
    if (Globals.keys['KeyW']) inputDy -= 1;
    if (Globals.keys['KeyS']) inputDy += 1;
    if (Globals.keys['KeyA']) inputDx -= 1;
    if (Globals.keys['KeyD']) inputDx += 1;

    // Update last move only if there is input
    if (inputDx !== 0 || inputDy !== 0) {
        Globals.player.lastMoveX = inputDx;
        Globals.player.lastMoveY = inputDy;
    }

    for (let [key, [dx, dy, dir]] of Object.entries(moveKeys)) {
        if (Globals.keys[key]) {
            // player.lastMoveX = dx; player.lastMoveY = dy; // REMOVED: Managed by vector above
            const door = doors[dir] || { active: 0, locked: 0, hidden: 0 };

            // Reference center for alignment
            let doorRef = (dir === 'top' || dir === 'bottom') ? (door.x ?? Globals.canvas.width / 2) : (door.y ?? Globals.canvas.height / 2);
            let playerPos = (dir === 'top' || dir === 'bottom') ? Globals.player.x : Globals.player.y;

            const inDoorRange = playerPos > doorRef - (DOOR_SIZE / 2) && playerPos < doorRef + (DOOR_SIZE / 2);
            // canPass checks if bomb or key removed the 'locked' status
            // If door.forcedOpen is true, we ignore roomLocked
            const canPass = door.active && !door.locked && !door.hidden && (!roomLocked || door.forcedOpen);

            if (dx !== 0) {
                const limit = dx < 0 ? BOUNDARY : Globals.canvas.width - BOUNDARY;
                const nextX = Globals.player.x + dx * Globals.player.speed;
                let collided = false;
                let hitMoveable = false;

                // Bomb Collision (Horizontal)
                Globals.bombs.forEach(b => {
                    if (b.solid && !b.exploding) {
                        const dist = Math.hypot(nextX - b.x, Globals.player.y - b.y);
                        if (dist < Globals.player.size + (b.baseR || 15)) {
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

                if (!collided && ((dx < 0 ? Globals.player.x > limit : Globals.player.x < limit) || (inDoorRange && canPass))) {
                    Globals.player.x = nextX;
                } else if (collided && !hitMoveable) {
                    Globals.player.x -= dx * 5; // Knockback only if not pushing
                    Globals.player.x = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.width - BOUNDARY - Globals.player.size, Globals.player.x));
                }
            } else {
                const limit = dy < 0 ? BOUNDARY : Globals.canvas.height - BOUNDARY;
                const nextY = Globals.player.y + dy * Globals.player.speed;
                let collided = false;
                let hitMoveable = false;

                // Bomb Collision (Vertical)
                Globals.bombs.forEach(b => {
                    if (b.solid && !b.exploding) {
                        const dist = Math.hypot(Globals.player.x - b.x, nextY - b.y);
                        if (dist < Globals.player.size + (b.baseR || 15)) {
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

                if (!collided && ((dy < 0 ? Globals.player.y > limit : Globals.player.y < limit) || (inDoorRange && canPass))) {
                    Globals.player.y = nextY;
                } else if (collided && !hitMoveable) {
                    Globals.player.y -= dy * 5; // Knockback only if not pushing
                    Globals.player.y = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.height - BOUNDARY - Globals.player.size, Globals.player.y));
                }
            }
        }
    }

}
export async function pickupItem(item, index) {


    if (item.pickingUp) return; // Debounce
    item.pickingUp = true;

    const data = item.data;
    const type = data.type;

    // Helper to Remove Item
    const removeItem = () => {
        const idx = Globals.groundItems.indexOf(item);
        if (idx !== -1) Globals.groundItems.splice(idx, 1);
    };

    // DEBUG TRACE
    console.log("PickupItem:", { type, data });

    // --- SIMPLE ITEMS (Sync) ---
    // Shards are handled in updateItems, but safety check here
    if (type === 'shard') {
        const amount = data.amount || 1;
        if (data.shardType === 'red') {
            const current = Globals.player.inventory.redShards || 0;
            const max = Globals.player.inventory.maxRedShards || 500;
            Globals.player.inventory.redShards = Math.min(max, current + amount);
            localStorage.setItem('currency_red', Globals.player.inventory.redShards);
            spawnFloatingText(Globals.player.x, Globals.player.y - 40, `+${amount} RED`, "#e74c3c");
        } else {
            const current = Globals.player.inventory.greenShards || 0;
            const max = Globals.player.inventory.maxGreenShards || 100;
            const newVal = Math.min(max, current + amount);
            log(`Picking up Green Shard. Current: ${current}, Max: ${max}, New: ${newVal}`);
            Globals.player.inventory.greenShards = newVal;
            spawnFloatingText(Globals.player.x, Globals.player.y - 40, `+${amount} GREEN`, "#2ecc71");
        }
        if (Globals.audioCtx.state !== 'suspended' && SFX.coin) SFX.coin();
        removeItem();
        return;
    }

    if (type === 'modifier' && data.modifiers && data.modifiers.hp) {
        if (Globals.player.hp >= Globals.player.maxHp) {
            item.pickingUp = false;
            //play cant pick up sound
            if (SFX && SFX.cantPickup) SFX.cantPickup();
            return; // Full HP
        }
        Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp + (data.modifiers?.hp ? parseInt(data.modifiers.hp) : (data.value || 1)));
        spawnFloatingText(Globals.player.x, Globals.player.y - 40, "+HP", "red");
        if (SFX && SFX.pickup) SFX.pickup();
        removeItem();
        return;
    }

    if (type === 'ammo') {
        if (Globals.player.ammoMode === 'finite' || Globals.player.ammoMode === 'reload') {
            const amount = data.amount || 20;
            if (Globals.player.ammoMode === 'reload') {
                Globals.player.reserveAmmo += amount;
            } else {
                Globals.player.ammo += amount;
            }
            spawnFloatingText(Globals.player.x, Globals.player.y - 40, `+${amount} AMMO`, "green");
            if (SFX && SFX.pickup) SFX.pickup();
            removeItem();
            return;
        }
        // Infinite ammo - don't pick up
        item.pickingUp = false;
        return;
    }

    // --- COMPLEX ITEMS (Async) ---
    const location = data.location;
    log(`Picking up ${data.name}...`);

    try {
        if (!location) throw new Error("No location definition for complex item");

        const res = await fetch(`${JSON_PATHS.ROOT}${location}?t=${Date.now()}`);
        const config = await res.json();

        if (type === 'gun') {
            // Drop Helper
            const oldName = Globals.player.gunType;
            if (oldName) {
                // CLAMP DROP POSITION (20% margin)
                const marginX = Globals.canvas.width * 0.2;
                const marginY = Globals.canvas.height * 0.2;
                let dropX = Globals.player.x;
                let dropY = Globals.player.y;

                if (dropX < marginX) dropX = marginX;
                if (dropX > Globals.canvas.width - marginX) dropX = Globals.canvas.width - marginX;
                if (dropY < marginY) dropY = marginY;
                if (dropY > Globals.canvas.height - marginY) dropY = Globals.canvas.height - marginY;

                Globals.groundItems.push({
                    x: dropX, y: dropY,
                    roomX: Globals.player.roomX, roomY: Globals.player.roomY,
                    vx: (Math.random() - 0.5) * 5, // Random pop
                    vy: (Math.random() - 0.5) * 5,
                    friction: 0.9,
                    solid: true,
                    moveable: true,
                    size: 15,
                    floatOffset: Math.random() * 100,
                    data: {
                        name: "gun_" + oldName,
                        type: "gun",
                        location: `rewards/items/guns/player/${oldName}.json`,
                        rarity: "common",
                        starter: false, // Old gun is no longer starter?
                        colour: (Globals.gun.Bullet && (Globals.gun.Bullet.colour || Globals.gun.Bullet.color)) || Globals.gun.colour || Globals.gun.color || "gold"
                    }
                });
            }

            Globals.gun = config;

            // REFRESH AMMO STATS
            if (Globals.gun.Bullet?.ammo?.active) {
                Globals.player.ammoMode = Globals.gun.Bullet?.ammo?.type || 'finite';
                Globals.player.maxMag = Globals.gun.Bullet?.ammo?.amount || 100;
                Globals.player.reloadTime = Globals.gun.Bullet?.ammo?.resetTimer !== undefined ? Globals.gun.Bullet?.ammo?.resetTimer : (Globals.gun.Bullet?.ammo?.reload || 1000);

                // Reset ammo to full on pickup? Yes, usually finding a gun gives you full ammo for it.
                Globals.player.ammo = Globals.player.maxMag;
                Globals.player.reloading = false;
            } else {
                // Infinite ammo fallback if config missing/inactive
                Globals.player.ammoMode = 'infinite';
                Globals.player.ammo = 999;
            }

            if (location.includes("/")) {
                const parts = location.split('/');
                const filename = parts[parts.length - 1].replace(".json", "");
                Globals.player.gunType = filename;
                Globals.player.gunType = filename;
                try {
                    // 1. Is this the first gun? (Base Checkpoint)
                    if (!localStorage.getItem('base_gun')) {
                        localStorage.setItem('base_gun', filename);
                        localStorage.setItem('base_gun_config', JSON.stringify(config));
                        log(`Checkpoint Set: Base Gun = ${filename}`);
                    }

                    // 2. Always update Current
                    localStorage.setItem('current_gun', filename);
                    localStorage.setItem('current_gun_config', JSON.stringify(config));
                } catch (e) { }
            }
            log(`Equipped Gun: ${config.name}`);
            spawnFloatingText(Globals.player.x, Globals.player.y - 30, config.name.toUpperCase(), config.colour || "gold");

            // PERSIST UNLOCKS ONLY (Peashooter)
            try {
                const saved = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
                const key = JSON_PATHS.GAME;
                if (!saved[key]) saved[key] = {};
                if (location.endsWith('peashooter.json')) {
                    saved[key].unlocked_peashooter = true;
                    localStorage.setItem('game_unlocks', JSON.stringify(saved));
                }
            } catch (e) { console.error("Failed to save unlock:", e); }
        }
        else if (type === 'bomb') {
            const oldName = Globals.player.bombType;
            if (oldName) {
                const marginX = Globals.canvas.width * 0.2;
                const marginY = Globals.canvas.height * 0.2;
                let dropX = Globals.player.x;
                let dropY = Globals.player.y;
                if (dropX < marginX) dropX = marginX;
                if (dropX > Globals.canvas.width - marginX) dropX = Globals.canvas.width - marginX;
                if (dropY < marginY) dropY = marginY;
                if (dropY > Globals.canvas.height - marginY) dropY = Globals.canvas.height - marginY;

                Globals.groundItems.push({
                    x: dropX, y: dropY,
                    roomX: Globals.player.roomX, roomY: Globals.player.roomY,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    friction: 0.9,
                    solid: true,
                    moveable: true,
                    size: 15,
                    floatOffset: Math.random() * 100,
                    data: {
                        name: "bomb_" + oldName,
                        type: "bomb",
                        location: `items/bombs/${oldName}.json`,
                        rarity: "common",
                        starter: false,
                        colour: Globals.bomb.colour || Globals.bomb.color || "white"
                    }
                });
            }

            Globals.bomb = config;
            if (location.includes("/")) {
                const parts = location.split('/');
                const filename = parts[parts.length - 1].replace(".json", "");
                Globals.player.bombType = filename;
                Globals.player.bombType = filename;
                try {
                    // 1. Is this the first bomb? (Base Checkpoint)
                    if (!localStorage.getItem('base_bomb')) {
                        localStorage.setItem('base_bomb', filename);
                        localStorage.setItem('base_bomb_config', JSON.stringify(config));
                        log(`Checkpoint Set: Base Bomb = ${filename}`);
                    }

                    // 2. Always update Current
                    localStorage.setItem('current_bomb', filename);
                    localStorage.setItem('current_bomb_config', JSON.stringify(config));
                } catch (e) { }
            }
            log(`Equipped Bomb: ${config.name}`);
            spawnFloatingText(Globals.player.x, Globals.player.y - 30, config.name.toUpperCase(), config.colour || "white");
        }
        else if (type === 'modifier' || data.modify) {
            // GENERIC MODIFIER HANDLER
            // Check target: modify="gun" or "key" or "player"
            const target = data.modify || (type === 'modifier' ? 'gun' : 'gun'); // Default?

            if (target === 'key' || (data.modifiers && data.modifiers.keys)) {
                // Key Pickup
                const amountProp = (data.modifiers && data.modifiers.keys) ? data.modifiers.keys : "+1";
                const amount = parseInt(amountProp) || 1;

                const current = Globals.player.inventory.keys || 0;
                const max = Globals.player.inventory.maxKeys || 5;

                if (current >= max) {
                    if (SFX && SFX.cantPickup) SFX.cantPickup();
                    item.pickingUp = false;
                    return; // Full
                }

                Globals.player.inventory.keys = Math.min(max, current + amount);
                spawnFloatingText(Globals.player.x, Globals.player.y - 40, `+${amount} KEY`, "#f1c40f");
                if (Globals.elements.keys) Globals.elements.keys.innerText = Globals.player.inventory.keys;
            }
            else if (target === 'gun') {
                log(`Attempting to apply gun modifier: ${JSON.stringify(data)}`);
                const applied = applyModifierToGun(Globals.gun, data);
                log(`Gun modifier applied result: ${applied}`);
                if (applied) {
                    spawnFloatingText(Globals.player.x, Globals.player.y - 40, "+GUN MOD", "#9b59b6");
                    // PERSIST CHANGE
                    localStorage.setItem('current_gun_config', JSON.stringify(Globals.gun));
                }
            }
            else if (target === 'player') {
                // Apply to Globals.player
                if (data.modifiers) {
                    let applied = false;
                    for (const key in data.modifiers) {
                        let val = data.modifiers[key];
                        // Map 'bombs' shorthand to 'inventory.bombs'
                        let targetKey = key;
                        if (targetKey === 'bombs') targetKey = 'inventory.bombs';

                        let isRelative = false;
                        if (typeof val === 'string' && (val.startsWith('+') || val.startsWith('-'))) {
                            isRelative = true;
                        }

                        // Type Coercion
                        if (val === "true") val = true;
                        else if (val === "false") val = false;
                        else if (!isNaN(val) && typeof val !== 'boolean') val = parseFloat(val);

                        // Handle Dot Notation (e.g. shield.active or inventory.bombs)
                        if (targetKey.includes('.')) {
                            const parts = targetKey.split('.');
                            let current = Globals.player;
                            let valid = true;
                            for (let i = 0; i < parts.length - 1; i++) {
                                if (current[parts[i]] === undefined) { valid = false; break; }
                                current = current[parts[i]];
                            }
                            if (valid) {
                                const leaf = parts[parts.length - 1];

                                // SPECIAL CHECK: Max Bombs
                                if (targetKey === 'inventory.bombs') {
                                    const maxBombs = Globals.player.inventory.maxBombs || 10;
                                    const currentBombs = typeof current[leaf] === 'number' ? current[leaf] : 0;

                                    if (currentBombs >= maxBombs && (isRelative ? val > 0 : val > currentBombs)) {
                                        if (SFX && SFX.cantPickup) SFX.cantPickup();
                                        item.pickingUp = false;
                                        return; // Full
                                    }
                                }

                                if (isRelative && typeof current[leaf] === 'number') {
                                    current[leaf] += val;
                                } else {
                                    current[leaf] = val;
                                }

                                // Clamp Bombs after add (just in case)
                                if (targetKey === 'inventory.bombs') {
                                    const maxBombs = Globals.player.inventory.maxBombs || 10;
                                    if (current[leaf] > maxBombs) current[leaf] = maxBombs;
                                }

                                applied = true;
                                log(`Player Mod: Set ${targetKey} to ${current[leaf]}`);
                            }
                        } else {
                            if (Globals.player[targetKey] !== undefined) {
                                if (isRelative && typeof Globals.player[targetKey] === 'number') {
                                    Globals.player[targetKey] += val;
                                } else {
                                    Globals.player[targetKey] = val;
                                }
                                applied = true;
                                log(`Player Mod: Set ${targetKey} to ${Globals.player[targetKey]}`);
                            }
                        }
                    }
                    if (applied) spawnFloatingText(Globals.player.x, Globals.player.y - 40, "+PLAYER MOD", "#3498db");
                }
            }
        }

        if (SFX && SFX.pickup) SFX.pickup();
        removeItem();

    } catch (e) {
        console.error("Failed to load/equip item:", e);
        item.pickingUp = false; // Allow retry on error?
        log("Error equipping item");
    }
}

export function applyModifierToGun(gunObj, modConfig) {
    // Fix: Define mods
    const mods = modConfig.modifiers;
    let appliedAny = false;
    for (const key in mods) {
        let val = mods[key];
        let isRelative = false;

        // Check for relative modifiers (String starting with + or -)
        if (typeof val === 'string') {
            if (val.startsWith('+') || val.startsWith('-')) {
                isRelative = true;
            }
        }

        // Type conversion
        if (val === "true") val = true;
        else if (val === "false") val = false;
        else if (!isNaN(val)) val = parseFloat(val);

        // Helper to apply
        const applyTo = (obj, prop, value, relative) => {
            // Handle Dot Notation (e.g. "multiDirectional.active")
            if (prop.includes('.')) {
                const parts = prop.split('.');
                let current = obj;
                // Traverse to parent
                for (let i = 0; i < parts.length - 1; i++) {
                    if (current[parts[i]] === undefined) return false; // Path doesn't exist
                    current = current[parts[i]];
                }
                const leaf = parts[parts.length - 1];

                // Now apply to leaf
                if (current[leaf] !== undefined) {
                    if (relative && typeof current[leaf] === 'number' && typeof value === 'number') {
                        let old = current[leaf];
                        current[leaf] += value;
                        if (current[leaf] < 0 && leaf !== 'startX' && leaf !== 'startY') current[leaf] = 0.05;
                    } else {
                        current[leaf] = value;
                    }
                    return true;
                }
                return false;
            }

            // Standard Flat Prop
            if (obj[prop] !== undefined) {
                if (relative && typeof obj[prop] === 'number' && typeof value === 'number') {
                    let old = obj[prop];
                    obj[prop] += value;
                    // Prevent negative stats where inappropriate (heuristic)
                    if (obj[prop] < 0 && prop !== 'startX' && prop !== 'startY') obj[prop] = 0.05; // Cap fireRate at 0.05 (20/sec)
                } else {
                    obj[prop] = value;
                }
                return true;
            }
            // ALLOW CREATION on Bullet object (for curve, homing, etc)
            if (obj === gunObj.Bullet) {
                obj[prop] = value;
                return true;
            }
            return false;
        };

        // Try Gun Root
        if (applyTo(gunObj, key, val, isRelative)) {
            appliedAny = true;
            continue;
        }

        // Try Bullet
        if (!gunObj.Bullet) gunObj.Bullet = {};
        if (applyTo(gunObj.Bullet, key, val, isRelative)) {
            appliedAny = true;
            continue;
        }

        // Catch-all fallbacks for specific keys if not handled above
        if (key === 'homing') {
            gunObj.Bullet.homing = val;
            appliedAny = true;
        }
    }
    return appliedAny;
}
// --- UNLOCK SYSTEM ---
let unlockQueue = [];
export function spawnRoomRewards(dropConfig, label = null) {
    if (!window.allItemTemplates) return false;
    // Debug MaxDrop
    if (dropConfig.maxDrop !== undefined) {
        log(`spawnRoomRewards: maxDrop=${dropConfig.maxDrop} for`, dropConfig);
    }

    let anyDropped = false;
    const pendingDrops = [];

    // 0. Fetch Unlock State
    const unlocks = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
    const isUnlocked = (item) => {
        if (!item.unlocked) return true; // Default: Unlocked
        let isActive = item.unlocked.active; // Default state from JSON

        // Check Persistence Overrides (Keyed by location/path)
        const stored = unlocks[item.location];
        if (stored && stored.unlocked && stored.unlocked.active !== undefined) {
            isActive = stored.unlocked.active;
        }
        return isActive;
    };

    // 1. Collect all POTENTIAL drops based on chances
    Object.keys(dropConfig).forEach(rarity => {
        // Skip special keys like "maxDrop"
        if (rarity === "maxDrop") return;

        const conf = dropConfig[rarity];
        if (!conf) return;

        // Roll for drop
        if (Math.random() < (conf.dropChance || 0)) {
            // Find items of this rarity
            // Fix: Check for null items in template list AND Unlock Status
            const candidates = window.allItemTemplates.filter(i =>
                i &&
                (i.rarity || 'common').toLowerCase() === rarity.toLowerCase() &&
                i.starter === false &&
                i.special !== true &&
                isUnlocked(i)
            );

            if (candidates.length > 0) {
                const count = conf.count || 1;
                for (let i = 0; i < count; i++) {
                    const item = candidates[Math.floor(Math.random() * candidates.length)];
                    pendingDrops.push({ item: item, rarity: rarity }); // Store for later
                }
            }
        }
    });

    // 2. Apply maxDrop limit
    if (dropConfig.maxDrop !== undefined && pendingDrops.length > dropConfig.maxDrop) {
        // Shuffle pendingDrops to randomly select which ones pass
        for (let i = pendingDrops.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pendingDrops[i], pendingDrops[j]] = [pendingDrops[j], pendingDrops[i]];
        }
        // Trim to maxDrop
        pendingDrops.length = dropConfig.maxDrop;
    }

    if (dropConfig.maxDrop !== undefined) {
        log(`spawnRoomRewards: Final pending count: ${pendingDrops.length}`);
    }

    // 2.5 Handle "Special" Drops (Array of Paths)
    if (dropConfig.special && Array.isArray(dropConfig.special)) {
        dropConfig.special.forEach(path => {
            (async () => {
                try {
                    // Normalize path: Ensure no double slashed, but handle simple relative paths
                    const url = path;
                    const res = await fetch(`${url}?t=${Date.now()}`);
                    if (res.ok) {
                        const itemData = await res.json();
                        // Spawn Logic
                        let dropX = (Globals.canvas.width / 2) + (Math.random() - 0.5) * 50;
                        let dropY = (Globals.canvas.height / 2) + (Math.random() - 0.5) * 50;

                        // Avoid Portal (if active & same room)
                        // Note: Portal usually spawns at center or specific spot.
                        if (Globals.portal.active && Globals.roomData.isBoss) {
                            const dist = Math.hypot(dropX - Globals.portal.x, dropY - Globals.portal.y);
                            if (dist < 80) {
                                // Push away
                                const angle = Math.atan2(dropY - Globals.portal.y, dropX - Globals.portal.x);
                                dropX = Globals.portal.x + Math.cos(angle) * 100;
                                dropY = Globals.portal.y + Math.sin(angle) * 100;
                            }
                        }

                        Globals.groundItems.push({
                            x: dropX,
                            y: dropY,
                            data: itemData,
                            roomX: Globals.player.roomX, roomY: Globals.player.roomY,
                            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
                            friction: 0.9, solid: true, moveable: true, size: 15, floatOffset: Math.random() * 100
                        });
                        log("Spawned Special Item:", itemData.name);
                        spawnFloatingText(Globals.canvas.width / 2, Globals.canvas.height / 2 - 60, "SPECIAL DROP!", "#e74c3c");
                    } else {
                        console.error("Failed to fetch special item:", url);
                    }
                } catch (e) { console.error("Error spawning special item:", e); }
            })();
            anyDropped = true;
        });
    }

    // 3. Spawn the final list
    pendingDrops.forEach(drop => {
        const item = drop.item;

        // CHECK DUPLICATE (Red Shard Conversion)
        // If an item with this name already exists in the room, convert to Red Shards
        const isDuplicate = Globals.groundItems.some(g =>
            g.roomX === Globals.player.roomX && g.roomY === Globals.player.roomY &&
            g.data && g.data.name === item.name
        );

        if (isDuplicate) {
            const shardReward = 5; // Small amount
            spawnFloatingText(Globals.player.x, Globals.player.y - 60, "DUPLICATE ITEM", "#e74c3c");
            // addRedShards(shardReward); // OLD
            // Spawn at the location the item WOULD have dropped
            // We don't have exact drop coords yet in the loop for the pending drops, 
            // but we calcuated them inside the loop? 
            // Wait, the loop calculates dropX/dropY AFTER this check?
            // No, the check is inside the loop? 
            // Ah, I added the check at the start of the loop item block.
            // I need to decide where to spawn it.
            // I'll spawn it near the player for now, or calculate a safe spot.
            // Let's spawn near player to be safe.
            spawnShard(Globals.player.x, Globals.player.y - 20, 'red', shardReward);
            return; // Skip spawn
        }

        log(`Room Clear Reward: Dropping ${drop.rarity} item: ${item.name}`);

        // Drop Logic (Clamp to Safe Zone & Prevent Overlap)
        const marginX = Globals.canvas.width * 0.2;
        const marginY = Globals.canvas.height * 0.2;
        const safeW = Globals.canvas.width - (marginX * 2);
        const safeH = Globals.canvas.height - (marginY * 2);

        let dropX, dropY;
        let valid = false;
        const minDist = 40; // Avoid overlapping items

        for (let attempt = 0; attempt < 10; attempt++) {
            dropX = marginX + Math.random() * safeW;
            dropY = marginY + Math.random() * safeH;

            // Check collision with existing items in this room
            const overlap = Globals.groundItems.some(i => {
                if (i.roomX !== Globals.player.roomX || i.roomY !== Globals.player.roomY) return false;
                return Math.hypot(i.x - dropX, i.y - dropY) < minDist;
            });

            // Check collision with Portal (if active)
            let portalOverlap = false;
            if (Globals.portal.active && Globals.roomData.isBoss) {
                const pDist = Math.hypot(dropX - Globals.portal.x, dropY - Globals.portal.y);
                if (pDist < 80) portalOverlap = true;
            }

            if (!overlap && !portalOverlap) {
                valid = true;
                break;
            }
        }

        Globals.groundItems.push({
            x: dropX, y: dropY,
            data: item,
            roomX: Globals.player.roomX, roomY: Globals.player.roomY,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            friction: 0.9,
            solid: true, moveable: true, size: 15,
            floatOffset: Math.random() * 100
        });

        anyDropped = true;

        // If a label was passed (e.g. "KEY BONUS"), show it!
        if (label) {
            spawnFloatingText(dropX, dropY - 20, label, "#FFD700"); // Gold text
        }
    });

    return anyDropped;
}

export function drawPlayer() {
    const now = Date.now();
    // 4. --- PLAYER ---

    // Gun Rendering (Barrels)
    if (Globals.gun && Globals.gun.Bullet && !Globals.gun.Bullet.NoBullets) {
        // Helper to draw a single barrel at a given angle
        const drawBarrel = (angle, color = "#555") => {
            Globals.ctx.save();
            Globals.ctx.translate(Globals.player.x, Globals.player.y);
            Globals.ctx.rotate(angle);
            Globals.ctx.fillStyle = color;
            Globals.ctx.fillRect(0, -4, Globals.player.size + 10, 8); // Extend 10px beyond center
            Globals.ctx.restore();
        };

        // 1. Main Barrel (Based on movement)
        let aimAngle = 0;
        if (Globals.player.lastMoveX || Globals.player.lastMoveY) {
            aimAngle = Math.atan2(Globals.player.lastMoveY, Globals.player.lastMoveX);
        }
        drawBarrel(aimAngle);

        // 2. Reverse Fire
        if (Globals.gun.Bullet?.reverseFire) {
            drawBarrel(aimAngle + Math.PI);
        }

        // 3. Multi-Directional
        if (Globals.gun.Bullet?.multiDirectional?.active) {
            const md = Globals.gun.Bullet.multiDirectional;
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

    const isInv = Globals.player.invuln || now < (Globals.player.invulnUntil || 0);
    Globals.ctx.fillStyle = isInv ? (Globals.player.invulColour || 'rgba(255,255,255,0.7)') : (Globals.player.colour || '#5dade2');

    Globals.ctx.beginPath();
    if (Globals.player.shape === 'square') {
        // Draw Square centered
        Globals.ctx.fillRect(Globals.player.x - Globals.player.size, Globals.player.y - Globals.player.size, Globals.player.size * 2, Globals.player.size * 2);
    } else if (Globals.player.shape === 'triangle') {
        // Draw Triangle centered
        Globals.ctx.moveTo(Globals.player.x, Globals.player.y - Globals.player.size);
        Globals.ctx.lineTo(Globals.player.x + Globals.player.size, Globals.player.y + Globals.player.size);
        Globals.ctx.lineTo(Globals.player.x - Globals.player.size, Globals.player.y + Globals.player.size);
        Globals.ctx.closePath();
        Globals.ctx.fill();
    } else {
        // Default Circle
        Globals.ctx.arc(Globals.player.x, Globals.player.y, Globals.player.size, 0, Math.PI * 2);
        Globals.ctx.fill();
    }

    // --- SHIELD RENDERING ---
    if (Globals.player.shield?.active && Globals.player.shield.hp > 0) {
        Globals.ctx.save();
        Globals.ctx.beginPath();
        // Outer ring
        Globals.ctx.arc(Globals.player.x, Globals.player.y, Globals.player.size + 8, 0, Math.PI * 2);
        Globals.ctx.strokeStyle = Globals.player.shield.colour || "blue";
        Globals.ctx.lineWidth = 3;

        // Opacity based on HP health
        Globals.ctx.globalAlpha = 0.4 + (0.6 * (Globals.player.shield.hp / Globals.player.shield.maxHp));
        Globals.ctx.stroke();

        // Inner fill (faint)
        Globals.ctx.fillStyle = Globals.player.shield.colour || "blue";
        Globals.ctx.globalAlpha = 0.1;
        Globals.ctx.fill();
        Globals.ctx.restore();
    }

    // --- SHIELD BAR (Above Reload/Cooldown) ---
    // Hide bar if shield is broken (hp <= 0)
    if (Globals.player.shield?.active && Globals.player.shield.hp > 0) {
        const barW = 40;
        const barH = 5;
        const barX = Globals.player.x - barW / 2;
        const barY = Globals.player.y - Globals.player.size - 30; // Above the reload/cooldown bar

        // Background
        Globals.ctx.fillStyle = "rgba(0,0,0,0.5)";
        Globals.ctx.fillRect(barX, barY, barW, barH);

        // Progress (HP)
        const shieldPct = Math.max(0, Math.min(Globals.player.shield.hp / Globals.player.shield.maxHp, 1));
        Globals.ctx.fillStyle = Globals.player.shield.colour || "blue"; // Use shield color
        Globals.ctx.fillRect(barX, barY, barW * shieldPct, barH);

        // Border
        Globals.ctx.strokeStyle = "white";
        Globals.ctx.lineWidth = 1;
        Globals.ctx.strokeRect(barX, barY, barW, barH);
    }

    // --- RELOAD / COOLDOWN BAR ---
    // If reloading, show reload bar (Blue/Cyan)
    if (Globals.player.reloading) {
        const reloadPct = Math.min((now - Globals.player.reloadStart) / Globals.player.reloadDuration, 1);
        const barW = 40;
        const barH = 5;
        const barX = Globals.player.x - barW / 2;
        const barY = Globals.player.y - Globals.player.size - 25; // Slightly higher or same position

        // Background
        Globals.ctx.fillStyle = "rgba(0,0,0,0.5)";
        Globals.ctx.fillRect(barX, barY, barW, barH);

        // Progress
        Globals.ctx.fillStyle = "#00ffff"; // Cyan for reload
        Globals.ctx.fillRect(barX, barY, barW * reloadPct, barH);

        // Border
        Globals.ctx.strokeStyle = "white";
        Globals.ctx.lineWidth = 1;
        Globals.ctx.strokeRect(barX, barY, barW, barH);

        // Text label (Optional, maybe too small)
        // ctx.fillStyle = "white";
        // ctx.font = "10px Arial";
        // ctx.fillText("RELOAD", barX, barY - 2);

    } else {
        // --- COOLDOWN BAR ---
        const fireDelay = (Globals.gun.Bullet?.fireRate || 0.3) * 1000;
        const timeSinceShot = now - (Globals.player.lastShot || 0);
        const pct = Math.min(timeSinceShot / fireDelay, 1);

        if (pct < 1 && Globals.gun.Bullet?.fireRate > 4) { // Only draw if reloading AND long cooldown
            const barW = 40;
            const barH = 5;
            const barX = player.x - barW / 2;
            const barY = player.y - player.size - 15;

            // Background
            Globals.ctx.fillStyle = "rgba(0,0,0,0.5)";
            Globals.ctx.fillRect(barX, barY, barW, barH);

            // Progress
            Globals.ctx.fillStyle = "orange";
            Globals.ctx.fillRect(barX, barY, barW * pct, barH);

            // Border
            Globals.ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
        }
    }
}
export function drawBulletsAndShards() {
    // 5. --- BULLETS & ENEMIES ---
    Globals.bullets.forEach(b => {
        Globals.ctx.save(); Globals.ctx.translate(b.x, b.y);

        // Rotation: Velocity + Spin
        let rot = Math.atan2(b.vy, b.vx);
        if (b.animated) rot += b.spinAngle || 0;
        Globals.ctx.rotate(rot);

        Globals.ctx.fillStyle = b.colour || 'yellow';
        Globals.ctx.strokeStyle = b.colour || 'yellow';
        Globals.ctx.lineWidth = 2;

        const s = b.size || 5;
        Globals.ctx.beginPath();
        if (b.shape === 'triangle') { Globals.ctx.moveTo(s, 0); Globals.ctx.lineTo(-s, s); Globals.ctx.lineTo(-s, -s); Globals.ctx.closePath(); }
        else if (b.shape === 'square') Globals.ctx.rect(-s, -s, s * 2, s * 2);
        else Globals.ctx.arc(0, 0, s, 0, Math.PI * 2);

        if (b.filled) Globals.ctx.fill();
        else Globals.ctx.stroke();

        Globals.ctx.restore();
    });
}

// --- RESTORED SHARD LOGIC ---
export function spawnShard(x, y, type, amount) {
    // Check config
    if (!Globals.gameData.redShards && type === 'red') return;
    if (!Globals.gameData.greenShards && type === 'green') return;

    const angle = Math.random() * Math.PI * 2;
    const offset = 30 + Math.random() * 20;
    const spawnX = x + Math.cos(angle) * offset;
    const spawnY = y + Math.sin(angle) * offset;

    Globals.groundItems.push({
        x: spawnX, y: spawnY,
        roomX: Globals.player.roomX, roomY: Globals.player.roomY,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        friction: 0.92,
        solid: true,
        moveable: true,
        size: 10,
        floatOffset: Math.random() * 100,
        pickupCooldown: 30, // 0.5s cooldown
        data: {
            type: 'shard',
            shardType: type, // 'red' or 'green'
            amount: amount,
            name: type === 'red' ? "Red Shard" : "Green Shard",
            rarity: 'common',
            colour: type === 'red' ? "#e74c3c" : "#2ecc71"
        }
    });
}

export function spawnShards(b) {
    const ex = Globals.gun.Bullet.Explode;
    for (let j = 0; j < ex.shards; j++) {
        const angle = (Math.PI * 2 / ex.shards) * j;
        Globals.bullets.push({
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
        });
    }
}

// export function updateItems() {
export function updateItems() {
    if (!Globals.groundItems) return;

    const PICKUP_THRESHOLD = 80; // Extended range for easier pickup
    const HEAT_MAX = 100;

    for (let i = Globals.groundItems.length - 1; i >= 0; i--) {
        const item = Globals.groundItems[i];

        // 1. Physics (Float/Slide)
        if (item.vx === undefined) { item.vx = 0; item.vy = 0; }

        item.x += item.vx;
        item.y += item.vy;

        item.vx *= (item.friction || 0.9);
        item.vy *= (item.friction || 0.9);

        // Wall Bounds
        const margin = item.size || 15;
        if (item.x < margin) { item.x = margin; item.vx *= -0.5; }
        if (item.x > Globals.canvas.width - margin) { item.x = Globals.canvas.width - margin; item.vx *= -0.5; }
        if (item.y < margin) { item.y = margin; item.vy *= -0.5; }
        if (item.y > Globals.canvas.height - margin) { item.y = Globals.canvas.height - margin; item.vy *= -0.5; }

        // Player Collision (Push/Slide away)
        const minDist = (Globals.player.size || 20) + (item.size || 15); // Collision radius
        const collisionDist = Math.hypot(Globals.player.x - item.x, Globals.player.y - item.y);

        if (collisionDist < minDist) {
            const angle = Math.atan2(item.y - Globals.player.y, item.x - Globals.player.x);

            // Push item away
            const overlap = minDist - collisionDist;
            // Split overlap to prevent snapping (soft push)
            item.x += Math.cos(angle) * overlap;
            item.y += Math.sin(angle) * overlap;

            // Add velocity for "kick" feel
            const pushForce = 0.5;
            item.vx += Math.cos(angle) * pushForce;
            item.vy += Math.sin(angle) * pushForce;
        }

        // Decrement Cooldown
        if (item.pickupCooldown > 0) item.pickupCooldown--;

        // Lazy Init Heat
        if (item.collisionHeat === undefined) item.collisionHeat = 0;

        const dist = Math.hypot(Globals.player.x - item.x, Globals.player.y - item.y);

        if (dist < PICKUP_THRESHOLD) {
            // Player is touching/close
            // Player is touching/close
            // if (!item.pickupCooldown || item.pickupCooldown <= 0) {
            //     // Increase Heat (Sustained contact or rapid bumps) -- DISABLED BY USER REQUEST
            //     item.collisionHeat += 5;
            //     if (item.collisionHeat > HEAT_MAX) item.collisionHeat = HEAT_MAX;
            // }

            // ALLOW MANUAL OVERRIDE (Space) OR HEAT TRIGGER
            // EXCEPTION: Shards are auto-pickup
            if (item.data && item.data.type === 'shard') {
                if (item.pickupCooldown && item.pickupCooldown > 0) continue;
                pickupItem(item, i);
                continue;
            }
            // EXCEPTION: Health/Ammo are auto-pickup (simple items)
            if (item.data && (item.data.type === 'health' || item.data.type === 'heart' || item.data.type === 'ammo')) {
                if (item.pickupCooldown && item.pickupCooldown > 0) continue;
                pickupItem(item, i);
                continue;
            }

            // WEAPONS REQUIRE SPACE ONLY (No Heat/Bump)
            // Use Globals.keys safely
            if ((Globals.keys && Globals.keys['Space'])) {
                if (Globals.keys) Globals.keys['Space'] = false; // Consume input
                pickupItem(item, i);
            }
        } else {
            // Decay Heat when away
            item.collisionHeat -= 2;
            if (item.collisionHeat < 0) item.collisionHeat = 0;
        }
    }
}



export function drawItems() {
    if (!Globals.groundItems) return;
    Globals.groundItems.forEach(item => {
        const x = item.x;
        const y = item.y;
        const size = 15;

        Globals.ctx.save();
        Globals.ctx.translate(x, y);

        // Hover effect
        const bob = Math.sin(Date.now() / 300) * 3;
        Globals.ctx.translate(0, bob);

        const itemType = item.type || (item.data && item.data.type);

        // Draw Item Base
        if (itemType === 'gun') {
            Globals.ctx.fillStyle = '#e74c3c'; // Redish
            Globals.ctx.fillRect(-size / 2, -size / 2, size, size);
            Globals.ctx.fillStyle = 'white';
            Globals.ctx.font = '10px monospace';
            Globals.ctx.textAlign = 'center';
            Globals.ctx.fillText("G", 0, 4);
        } else if (itemType === 'bomb') {
            Globals.ctx.fillStyle = '#f1c40f'; // Yellow
            Globals.ctx.beginPath();
            Globals.ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            Globals.ctx.fill();
            Globals.ctx.fillStyle = 'black';
            Globals.ctx.textAlign = 'center';
            Globals.ctx.fillText("B", 0, 4);
        } else if (itemType === 'health' || itemType === 'heart') {
            Globals.ctx.fillStyle = '#e74c3c';
            Globals.ctx.beginPath();
            Globals.ctx.moveTo(0, size / 3);
            Globals.ctx.arc(-size / 4, -size / 6, size / 4, Math.PI, 0);
            Globals.ctx.arc(size / 4, -size / 6, size / 4, Math.PI, 0);
            Globals.ctx.lineTo(0, size / 2);
            Globals.ctx.fill();
        } else if (itemType === 'ammo') {
            Globals.ctx.fillStyle = '#2ecc71'; // Green
            Globals.ctx.fillRect(-size / 3, -size / 2, size / 1.5, size);
        } else {
            // Generic Item - Use Type Color
            Globals.ctx.fillStyle = getItemTypeColor(itemType, item.data) || item.color || '#95a5a6';
            Globals.ctx.fillRect(-size / 2, -size / 2, size, size);
        }

        // Rarity Effects (Glow/Pulse)
        const rarity = (item.data && item.data.rarity) ? item.data.rarity.toLowerCase() : 'common';
        if (rarity !== 'common') {
            const time = Date.now() / 1000;
            let glowColor = 'rgba(255, 255, 255, 0.5)';
            let pulse = 0;
            let hasBeam = false;

            if (rarity === 'rare') {
                glowColor = 'rgba(52, 152, 219, 0.6)'; // Blue
                pulse = Math.sin(time * 2) * 5;
            } else if (rarity === 'epic') {
                glowColor = 'rgba(155, 89, 182, 0.8)'; // Purple
                pulse = Math.sin(time * 4) * 8;
            } else if (rarity === 'legendary') {
                glowColor = 'rgba(241, 196, 15, 0.9)'; // Gold
                pulse = Math.sin(time * 6) * 10;
                hasBeam = true; // Gravitas!

                // Sparkles for Legendary
                if (Math.random() < 0.2) { // More sparkles
                    Globals.particles.push({
                        x: item.x + (Math.random() - 0.5) * 30,
                        y: item.y + (Math.random() - 0.5) * 30,
                        // Float up
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: -Math.random() * 2.0 - 1.0,
                        life: 1.5,
                        color: Math.random() < 0.5 ? '#f1c40f' : '#ffffff',
                        size: Math.random() * 4
                    });
                }
            }

            // GRAVITAS BEAM (Legendary)
            if (hasBeam) {
                const beamHeight = 100 + Math.sin(time * 3) * 20;
                // Beam Core
                const grad = Globals.ctx.createLinearGradient(0, 0, 0, -beamHeight);
                grad.addColorStop(0, "rgba(241, 196, 15, 0.4)");
                grad.addColorStop(1, "rgba(241, 196, 15, 0)");
                Globals.ctx.fillStyle = grad;
                Globals.ctx.fillRect(-size / 2, -beamHeight, size, beamHeight);
                // Beam Outer
                const grad2 = Globals.ctx.createLinearGradient(0, 0, 0, -beamHeight * 1.5);
                grad2.addColorStop(0, "rgba(241, 196, 15, 0.1)");
                grad2.addColorStop(1, "rgba(241, 196, 15, 0)");
                Globals.ctx.fillStyle = grad2;
                Globals.ctx.fillRect(-size, -beamHeight * 1.5, size * 2, beamHeight * 1.5);
            }

            Globals.ctx.shadowBlur = 10 + pulse;
            Globals.ctx.shadowColor = glowColor;
            // Redraw border/shape with shadow
            Globals.ctx.strokeStyle = glowColor;
            Globals.ctx.lineWidth = 2;
            Globals.ctx.strokeRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
            Globals.ctx.shadowBlur = 0; // Reset
        }

        // Label
        const nameData = item.data?.name || item.name;
        if (nameData) {
            let DisplayName = nameData;
            if (DisplayName.startsWith("gun_")) DisplayName = DisplayName.replace("gun_", "");
            if (DisplayName.startsWith("bomb_")) DisplayName = DisplayName.replace("bomb_", "");

            Globals.ctx.fillStyle = 'white';
            Globals.ctx.font = '10px monospace';
            Globals.ctx.textAlign = 'center';
            Globals.ctx.fillText(DisplayName.toUpperCase(), 0, -size);
        }

        // Interact Prompt (Space)
        const dist = Math.hypot(Globals.player.x - item.x, Globals.player.y - item.y);
        if (dist < 80 && (!item.data || (item.data.type !== 'shard' && item.data.type !== 'visual_shard'))) {
            Globals.ctx.fillStyle = "#f1c40f"; // Gold
            Globals.ctx.font = "bold 12px monospace";
            Globals.ctx.fillText("SPACE", 0, 30);
        }

        Globals.ctx.restore();
    });
}

function calculateShardDrop(type, sourceKey, entity) {
    const rewards = Globals.gameData.rewards;
    if (!rewards || !rewards.shards) return 1; // Default fallback

    const config = rewards.shards[type];
    if (!config) return 1;

    let dropConfig = null;
    let bonus = 0;

    // sourceKey matches the JSON key (killEnemy, killBoss, enterPortal)
    if (config[sourceKey]) {
        dropConfig = config[sourceKey];

        if (sourceKey === 'killEnemy' && entity) {
            // Logic: Bonus based on HP (Hardness)
            const hp = entity.maxHp || 1;
            bonus = Math.floor(hp / 2);
        } else if (sourceKey === 'killBoss') {
            // Logic: Bonus based on Game Hardness
            const hardness = Globals.gameData.hardness || 1;
            bonus = hardness * 2;
        }
        // enterPortal has no bonus logic yet (just min/max)
    }

    if (!dropConfig) return 1;

    const min = dropConfig.minCount || 1;
    const max = dropConfig.maxCount || 1;

    // Random between min and max, plus bonus
    const base = Math.floor(min + Math.random() * (max - min + 1));
    return base + bonus;
}
// Helper for Item Colors based on Type
function getItemTypeColor(type, data) {
    if (type === 'gun') return '#e74c3c'; // Red
    if (type === 'bomb') return '#f1c40f'; // Yellow
    if (type === 'shard') {
        if (data && data.shardType === 'red') return '#e74c3c'; // Red Shard
        return '#2ecc71'; // Green Shard (Default)
    }
    if (type === 'health' || type === 'heart') return '#e74c3c';
    if (type === 'ammo') return '#2ecc71';

    if (type === 'modifier') {
        const loc = (data && data.location) ? data.location.toLowerCase() : "";
        if (loc.includes('player')) return '#3498db'; // Blue (Player Mod)
        if (loc.includes('bullets')) return '#9b59b6'; // Purple (Bullet Mod)
        return '#2ecc71'; // Green (Inventory/Other)
    }
    return null; // Fallback
}
