import { Globals } from './Globals.js';
import { log, spawnFloatingText, triggerSpeech } from './Utils.js';
import { SFX, fadeIn } from './Audio.js';
import { generateLore } from './Utils.js'; // Assuming generateLore is in Utils (or I need to extract it)
import { CONFIG, STATES, BOUNDARY, DOOR_SIZE, JSON_PATHS } from './Constants.js';
import { updateWelcomeScreen, updateUI, drawTutorial, drawMinimap, drawBossIntro, updateFloatingTexts, drawFloatingTexts, showCredits, updateGameStats, saveGameStats } from './UI.js';

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
    inst.variant = group.variant;
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

            // Fix: Apply to instance immediately
            inst.moveType = 'static';
        }
    }

    // Apply moveType if present in group (explicit logic)
    if (group.moveType) {
        inst.moveType = group.moveType;
        if (group.moveType.type) inst.moveType = group.moveType.type;
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

    // TROPHY ROOM LOGIC
    const rData = Globals.roomData || {};

    if (rData.type === 'trophy' || rData._type === 'trophy') {
        const stats = (Globals.killStatsTotal && Globals.killStatsTotal.types) ? Globals.killStatsTotal.types : {};
        if (!stats) console.warn("TROPHY ROOM: No killStatsTotal types found!");

        const sizes = Globals.killStatsTotal.sizes;
        const types = Object.keys(stats);
        log("TROPHY LOG: Stats", stats, "Types", types, "sizes", sizes);

        const startX = 100;
        const startY = 100;
        const gap = 120;
        const cols = 7;
        const templates = Globals.enemyTemplates || {};

        // Calculate Collection Stats (Combinations)
        const config = Globals.gameData.enemyConfig || {};
        const variantsList = config.variants || [];
        const shapesList = config.shapes || [];

        const totalTypes = Object.keys(templates).length;
        const totalCount = totalTypes * (variantsList.length + shapesList.length);

        const combos = (Globals.killStatsTotal && Globals.killStatsTotal.combos) ? Globals.killStatsTotal.combos : {};
        const killedCount = Object.keys(combos).length;

        Globals.trophyCounts = { killed: killedCount, total: totalCount };

        // Spawn Ghosts for each Unique Combo
        const keys = Object.keys(combos);
        log("TROPHY DEBUG: Keys:", keys, "Templates:", Object.keys(Globals.enemyTemplates || {}).length);

        keys.forEach((key, i) => {

            const parts = key.split('_');
            let type = parts[0];
            const suffix = parts.slice(1).join('_');

            let tmpl = templates[type];
            // Fix: If type is a variant name (turret/gunner), create a base template from it
            if (!tmpl && (type === 'turret' || type === 'gunner')) {
                tmpl = { type: type, name: type, size: 25, color: '#95a5a6', speed: 1, hp: 1 };
            }

            if (!tmpl) tmpl = { type: type, name: type, size: 25, color: '#95a5a6', speed: 1, hp: 1 };

            const en = JSON.parse(JSON.stringify(tmpl));
            en.id = `trophy_${i}`;

            // Apply Configuration using Game Data
            const config = Globals.gameData.enemyConfig || {};
            const variants = config.variants || [];
            const colors = config.colors || [];

            const shapes = config.shapes || [];
            let labelParts = [];
            let variantApplied = false;

            // Fix: Apply variant config if the "type" itself is a variant
            if (variants.includes(type)) {
                applyEnemyConfig(en, { variant: type });
                variantApplied = true;
            }

            for (let j = 1; j < parts.length; j++) {
                const p = parts[j];
                if (variants.includes(p)) {
                    applyEnemyConfig(en, { variant: p });
                    variantApplied = true;
                    labelParts.push(p);
                    const idx = variants.indexOf(p);
                    if (colors[idx]) en.color = colors[idx];
                } else if (shapes.includes(p)) {
                    en.shape = p;
                    labelParts.push(p);
                } else if (p !== 'normal' && p !== 'circle') {
                    labelParts.push(p);
                }
            }
            if (!variantApplied) applyEnemyConfig(en, { variant: 'medium' });

            const variantsStr = labelParts.length > 0 ? labelParts.join(' ') : "";
            if (en.name) {
                en.displayInfo = en.name + (variantsStr ? " " + variantsStr : "");
            } else {
                en.displayInfo = variantsStr || "Normal";
            }


            en.killCount = combos[key] || 0;

            // Random Position
            const w = (Globals.canvas && Globals.canvas.width) || 800;
            const h = (Globals.canvas && Globals.canvas.height) || 600;
            en.x = 100 + Math.random() * (w - 200);
            en.y = 100 + Math.random() * (h - 200);

            en.moveType = (en.type === 'turret' || en.moveType === 'static') ? 'static' : 'wander';
            en.hostile = false;
            en.gun = null;
            en.gunConfig = null;
            en.indestructible = true;
            en.hp = 9999;
            en.isStatDisplay = true;
            en.solid = false;

            // Safety check for size
            if (!en.size) en.size = 25;

            // Always assign ghost_trophy type for maximum chattiness
            en.type = 'ghost_trophy';

            Globals.enemies.push(en);
            log("Spawned Trophy:", en.type, en.x, en.y, en.color, en.shape, "Stat:", en.isStatDisplay);
        });
        return; // Skip normal spawn
    }
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

            // Force Min HP if restored dead or corrupted
            if (!inst.hp || inst.hp <= 0) {
                log("Restored enemy HP was 0/Null. Forcing to 1.");
                inst.hp = 1;
                inst.maxHp = Math.max(inst.maxHp || 0, 1);
                // Check and fix baseStats if they carried the corruption
                if (inst.baseStats && (inst.baseStats.hp <= 0)) inst.baseStats.hp = 1;
                else if (!inst.baseStats) inst.baseStats = { hp: 1, speed: inst.speed, damage: inst.damage };
            }

            Globals.enemies.push(inst);
            log(`Restored Enemy: ${inst.type}, HP: ${inst.hp}`);
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
        Globals.ghostSpawned = true;

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

        if (Globals.ghostHP !== undefined && Globals.ghostHP > 0) {
            inst.hp = Globals.ghostHP;
        } else {
            Globals.ghostHP = inst.hp;
        }

        inst.spawnTime = Date.now(); // FIX: Ensure spawnTime is set so lock timer works properly



        // Standard random placement or center
        inst.x = Globals.random() * (Globals.canvas.width - 60) + 30;
        inst.y = Globals.random() * (Globals.canvas.height - 60) + 30;
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

    // Handle Explicit Boss Property (e.g. "boss": "enemies/bosses/boss1.json")
    if (Globals.roomData.boss) {
        const bossKey = Globals.roomData.boss.split('/').pop().replace('.json', '');
        const template = Globals.enemyTemplates[bossKey];

        if (template) {
            log("Spawning Boss from Property:", bossKey);
            const inst = JSON.parse(JSON.stringify(template));
            inst.templateId = bossKey;

            // Init Defaults (Avoid Center so portal doesn't trap them)
            inst.x = (Globals.canvas.width / 2);
            inst.y = (Globals.canvas.height / 4);
            if (inst.size) {
                inst.x -= inst.size / 2;
                inst.y -= inst.size / 2;
            }

            // Use template overrides if valid
            if (template.x !== undefined) inst.x = template.x;
            if (template.y !== undefined) inst.y = template.y;

            // Standard Init
            inst.frozen = true;
            inst.freezeEnd = freezeUntil;
            inst.invulnerable = true; // Wait for freeze

            // Ensure ID/Key is set for uniqueness/logic
            inst.isBoss = true;

            Globals.enemies.push(inst);
        } else {
            console.error("Boss Template Not Found for key:", bossKey);
        }
    }

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
                        inst.x = Math.max(30, Math.min(fixedX, Globals.canvas.width - 30));
                        inst.y = Math.max(30, Math.min(fixedY, Globals.canvas.height - 30));
                    } else {
                        inst.x = Globals.random() * (Globals.canvas.width - 60) + 30;
                        inst.y = Globals.random() * (Globals.canvas.height - 60) + 30;

                        // Guard against bosses spawning in absolute center (portal trap)
                        if (inst.isBoss || inst.type === 'boss') {
                            const cx = Globals.canvas.width / 2;
                            const cy = Globals.canvas.height / 2;
                            if (Math.hypot(inst.x - cx, inst.y - cy) < 60) {
                                inst.y = Globals.canvas.height / 4; // Shift up
                            }
                        }
                    }
                    inst.frozen = true;
                    inst.freezeEnd = freezeUntil;
                    inst.invulnerable = true;

                    if (Globals.bossKilled) {
                        inst.hp = (inst.hp || 1) * 2;
                        inst.speed = (inst.speed || 1) * 2;
                        inst.damage = (inst.damage || 1) * 2;
                    }

                    // Force Min HP
                    if (!inst.hp || inst.hp <= 0) {
                        console.warn("Enemy HP was 0/Null on Spawn. Forcing to 1. Original:", inst.hp, "Variant:", group.variant);
                        inst.hp = 1;
                        inst.maxHp = Math.max(inst.maxHp || 0, 1);
                        // Ensure baseStats logic doesn't revert it
                        if (inst.baseStats && inst.baseStats.hp <= 0) inst.baseStats.hp = 1;
                    }

                    Globals.enemies.push(inst);
                    log(`Spawned ${inst.type} (ID: ${group.type}). HP: ${inst.hp}, Index: ${i}`);
                }
            } else {
                console.warn(`Enemy template not found for: ${group.type}`);
            }
        });
    } else {
        // Fallback: Random Grunts
        // FILTER: Don't spawn special enemies (Boss, Ghost) as randoms
        const validKeys = Object.keys(Globals.enemyTemplates).filter(k => !Globals.enemyTemplates[k].special).sort();
        const randomType = validKeys.length > 0 ? validKeys[Math.floor(Globals.random() * validKeys.length)] : "grunt";

        let count = 3 + Math.floor(Globals.random() * 3);
        if (Globals.gameData.difficulty) count += Globals.gameData.difficulty;

        const template = enemyTemplates[randomType] || { hp: 2, speed: 1, size: 25 };


        for (let i = 0; i < count; i++) {
            const inst = JSON.parse(JSON.stringify(template));
            inst.templateId = randomType; // Store ID for persistence lookup
            inst.x = Globals.random() * (Globals.canvas.width - 60) + 30;
            inst.y = Globals.random() * (Globals.canvas.height - 60) + 30;
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

            Globals.enemies.push(inst);
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
    log("Dropping Bomb Config:", bombConf);
    log("Calculated Timer Duration:", timerDuration);
    log("Timer Show:", timerShow);

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

    // Check overlaps with chests
    if (canDrop) {
        for (const chest of Globals.chests) {
            if (chest.state !== 'closed' && chest.state !== 'open') continue; // Only physical chests

            // Simple Box Collision Check (Bomb is Point or Small Circle)
            // Chest is Rect (x, y, w, h)
            // Expand chest box by Bomb Radius roughly
            const bombR = baseR || 15;
            const buffer = 5;

            if (dropX + bombR > chest.x - buffer &&
                dropX - bombR < chest.x + chest.width + buffer &&
                dropY + bombR > chest.y - buffer &&
                dropY - bombR < chest.y + chest.height + buffer) {

                canDrop = false;
                log("Bomb drop blocked by Chest collision");
                break;
            }
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

    if (!canDrop) {
        log("Can't drop bomb");
        SFX.cantDoIt();
        return false;
    }

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
        animated: bulletConfig.geometry?.animated || false,
        animated: bulletConfig.geometry?.animated || false,
        filled: bulletConfig.geometry?.filled === 'random' ? (Math.random() < 0.5) : (bulletConfig.geometry?.filled !== undefined ? bulletConfig.geometry.filled : true),
        colour: null, // Placeholder, calculated below
        spinAngle: 0,
        hitEnemies: [],
        ownerType: ownerType, // 'player' or 'enemy'
        speed: Math.hypot(vx, vy), // Store initial speed for homing reliability
        createdAt: Date.now()
    };

    // Calculate Color based on Rarity (if not overridden)
    let bColor = bulletConfig.colour;
    if (!bColor) {
        const rarity = (weaponSource && weaponSource.rarity) ? weaponSource.rarity.toLowerCase() : 'common';
        if (rarity === 'common') bColor = 'yellow';
        else if (rarity === 'uncommon') bColor = '#2ecc71'; // Green
        else if (rarity === 'rare') bColor = '#e74c3c'; // Red
        else if (rarity === 'legendary') {
            bColor = 'yellow'; // Base color
            b.sparkly = true; // Flag for particle effect
        } else {
            bColor = 'yellow';
        }
    }
    b.colour = bColor;

    if (ownerType === 'enemy') {
        b.hasLeftPlayer = true; // No safety buffer needed for player
        // Optional: Safety buffer for the enemy who shot it?
    }

    if (ownerType === 'player') {
        Globals.bulletsInRoom++;
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
    log("FireBullet", { name: Globals.gun.name, reverse: bulletConf.reverseFire, number: bulletConf.number, spread: bulletConf.spreadRate });

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
            log("Attempting Reverse Fire...");
            const revAngle = fanAngle + Math.PI;
            const rvx = Math.cos(revAngle) * bSpeed;
            const rvy = Math.sin(revAngle) * bSpeed;
            const rStartX = Globals.player.x + rvx * (barrelLength / bSpeed);
            const rStartY = Globals.player.y + rvy * (barrelLength / bSpeed);
            spawnBullet(rStartX, rStartY, rvx, rvy, Globals.gun, "player");
            log("Spawned Reverse Bullet");
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
    // Remove deleted bullets
    Globals.bullets = Globals.bullets.filter(b => !b.markedForDeletion);

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
                if (b.canDamagePlayer) log("Bullet hitting player! Damage:", b.damage, "canDamagePlayer:", b.canDamagePlayer);

                // Hit Player
                if (b.canDamagePlayer) {
                    if (!Globals.player.invuln && Date.now() > (Globals.player.invulnUntil || 0)) {
                        takeDamage(b.damage || 1);
                        // Remove bullet
                        Globals.bullets.splice(i, 1);
                        return;
                    }
                } else {
                    // Harmless collision - Eat bullet and Push Player
                    // "Prolonged push that eats the bullet"

                    // Safety: Wait before eating (100ms)
                    if (Date.now() - (b.createdAt || 0) < 100) return;

                    // Init velocity if missing
                    if (typeof Globals.player.vx === 'undefined') Globals.player.vx = 0;
                    if (typeof Globals.player.vy === 'undefined') Globals.player.vy = 0;

                    // Transfer momentum (Push Strength)
                    const pushFactor = 0.5;
                    Globals.player.vx += b.vx * pushFactor;
                    Globals.player.vy += b.vy * pushFactor;

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
                    if (Globals.gun.Bullet.Explode.wallExplode) spawnBulletShards(b); // Can count as hit? Maybe.
                    // If it explodes, maybe NOT a miss? But usually wall hit = miss.
                }
                if (!b.isShard && b.ownerType !== 'enemy' && !b.hasHit) {
                    Globals.perfectStreak = 0; // Missed Shot (Hit Wall)
                    Globals.shooterStreak = 0; // Shooter Reset
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
                    Globals.hitsInRoom++; // Count hit on bomb
                    Globals.bullets.splice(i, 1);
                    hitBomb = true;
                    break;
                } else if (bomb.solid) {
                    // Solid but not shootable = block bullet (destroy bullet)
                    // Optional: Spawn particles/sparks?
                    if (b.ownerType !== 'enemy' && !b.hasHit) {
                        Globals.perfectStreak = 0; // Missed (Hit Solid Bomb non-shootable)
                        Globals.shooterStreak = 0; // Shooter Reset
                    }
                    Globals.bullets.splice(i, 1);
                    hitBomb = true;
                    break;
                }
            }
        }
        if (hitBomb) return; // Use return to skip further processing for this bullet

        // --- Enemy Collision ---
        b.life--;
        if (b.life <= 0) {
            if (!b.isShard && b.ownerType !== 'enemy' && !b.hasHit) {
                Globals.perfectStreak = 0; // Missed Shot (Expired)
                Globals.shooterStreak = 0; // Shooter Reset
            }
            Globals.bullets.splice(i, 1);
        }
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
                if (Globals.keys['ArrowUp']) { dirCode = 1; Globals.player.lastShootX = 0; Globals.player.lastShootY = -1; }
                else if (Globals.keys['ArrowDown']) { dirCode = 3; Globals.player.lastShootX = 0; Globals.player.lastShootY = 1; }
                else if (Globals.keys['ArrowLeft']) { dirCode = 4; Globals.player.lastShootX = -1; Globals.player.lastShootY = 0; }
                else if (Globals.keys['ArrowRight']) { dirCode = 2; Globals.player.lastShootX = 1; Globals.player.lastShootY = 0; }

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

    // Piggy Bank Interaction (Home Room)
    if (Globals.roomData.type === 'home' || Globals.roomData._type === 'home') {
        const pbDist = Math.hypot(Globals.player.x - 100, Globals.player.y - 320);
        if (pbDist < 60) {
            // Open Bank UI
            if (Globals.elements.bankModal) {
                let bankedShards = parseInt(localStorage.getItem('piggy_bank_balance') || '0');
                if (Globals.elements.bankInvVal) Globals.elements.bankInvVal.innerText = Globals.player.inventory.greenShards || 0;
                if (Globals.elements.bankVaultVal) Globals.elements.bankVaultVal.innerText = bankedShards;

                Globals.elements.bankModal.style.display = 'flex';
                Globals.gameState = STATES.BANK; // Prevent other inputs
                if (window.SFX && SFX.pickup) SFX.pickup(); // generic UI open sound
            }
            return; // Interaction complete
        }

        // Bed is x:50-130, y:50-190. Expand box by ~30px for interaction
        const nearBed = Globals.player.x > 20 && Globals.player.x < 160 && Globals.player.y > 20 && Globals.player.y < 220;
        if (nearBed) {
            if (Globals.usedBed) {
                spawnFloatingText(Globals.player.x, Globals.player.y - 50, "Already rested today!", "white", 2);
            } else if (Globals.player.hp < Globals.player.maxHp) {
                Globals.player.hp = Globals.player.maxHp;

                const keysLost = Math.min(Globals.player.inventory.keys, Math.floor(Math.random() * 3) + 1);
                Globals.player.inventory.keys -= keysLost;

                const bombsLost = Math.min(Globals.player.inventory.bombs, Math.floor(Math.random() * 3) + 1);
                Globals.player.inventory.bombs -= bombsLost;

                Globals.usedBed = true;

                if (window.SFX && SFX.powerup) SFX.powerup();
                spawnFloatingText(Globals.player.x, Globals.player.y - 50, `Rested! Lost ${keysLost} Keys & ${bombsLost} Bombs`, "lightgreen", 5);
                Globals.sleepTimer = Date.now();
                Globals.roomFreezeUntil = Date.now() + 2000;
                Globals.player.invulnUntil = Date.now() + 2000;
            } else {
                spawnFloatingText(Globals.player.x, Globals.player.y - 50, "Already well rested!", "white", 2);
            }
            return;
        }
    }

    const roomLocked = Globals.isRoomLocked();
    const doors = Globals.roomData.doors || {};

    // Feedback for Room Lock
    if (roomLocked) {
        log("Cannot use doors - Room is Locked (Enemies active)");
        spawnFloatingText(Globals.player.x, Globals.player.y - 40, "Room Locked!", "red");
        return;
    }

    // Helper: are we close enough to a door?
    // FIX: Increased tolerance from +5 to +25 because collision logic stops player movement
    // slightly outside the boundary (based on speed/step size).
    const TOLERANCE = 25;

    const inRangeTop = (door) => {
        const doorX = door.x !== undefined ? door.x : Globals.canvas.width / 2;
        return Globals.player.y <= BOUNDARY + TOLERANCE && Globals.player.x > doorX - DOOR_SIZE && Globals.player.x < doorX + DOOR_SIZE;
    };
    const inRangeBottom = (door) => {
        const doorX = door.x !== undefined ? door.x : Globals.canvas.width / 2;
        return Globals.player.y >= Globals.canvas.height - BOUNDARY - TOLERANCE && Globals.player.x > doorX - DOOR_SIZE && Globals.player.x < doorX + DOOR_SIZE;
    };
    const inRangeLeft = (door) => {
        const doorY = door.y !== undefined ? door.y : Globals.canvas.height / 2;
        return Globals.player.x <= BOUNDARY + TOLERANCE && Globals.player.y > doorY - DOOR_SIZE && Globals.player.y < doorY + DOOR_SIZE;
    };
    const inRangeRight = (door) => {
        const doorY = door.y !== undefined ? door.y : Globals.canvas.height / 2;
        return Globals.player.x >= Globals.canvas.width - BOUNDARY - TOLERANCE && Globals.player.y > doorY - DOOR_SIZE && Globals.player.y < doorY + DOOR_SIZE;
    };

    // Prefer the door the player is "facing" (lastMoveX/lastMoveY), fall back to any nearby door.
    const candidates = [];
    if (doors.top?.active) candidates.push({ dir: "top", door: doors.top, inRange: inRangeTop });
    if (doors.bottom?.active) candidates.push({ dir: "bottom", door: doors.bottom, inRange: inRangeBottom });
    if (doors.left?.active) candidates.push({ dir: "left", door: doors.left, inRange: inRangeLeft });
    if (doors.right?.active) candidates.push({ dir: "right", door: doors.right, inRange: inRangeRight });

    // DEBUG: Log candidates and player position
    console.log(`updateUse: Space Pressed. Player: (${Globals.player.x.toFixed(1)}, ${Globals.player.y.toFixed(1)}) BOUNDARY: ${BOUNDARY} TOLERANCE: ${TOLERANCE}`);
    candidates.forEach(c => {
        const doorX = c.door.x !== undefined ? c.door.x : Globals.canvas.width / 2;
        const doorY = c.door.y !== undefined ? c.door.y : Globals.canvas.height / 2;
        const inRange = c.inRange(c.door);
        console.log(`  Checking ${c.dir}: Active=${c.door.active}, Locked=${c.door.locked}, InRange=${inRange} (Door Post: ${doorX}, ${doorY}) (DistX: ${(Globals.player.x - doorX).toFixed(1)})`);
    })

    const facingDir =
        Globals.player.lastMoveY === -1 ? "top" :
            Globals.player.lastMoveY === 1 ? "bottom" :
                Globals.player.lastMoveX === -1 ? "left" :
                    Globals.player.lastMoveX === 1 ? "right" : null;

    let target = null;

    // DEBUG: Log Facing
    console.log(`  Facing: ${facingDir} (LastMove: ${Globals.player.lastMoveX}, ${Globals.player.lastMoveY})`);

    // 1) facing door if in range
    if (facingDir) {
        const c = candidates.find(x => x.dir === facingDir);
        if (c && c.inRange(c.door)) target = c;
    }

    // 2) otherwise first door in range
    if (!target) {
        target = candidates.find(c => c.inRange(c.door)) || null;
    }

    if (!target) {
        console.log("  No target found in range.");
        return;
    }

    console.log(`  Target Acquired: ${target.dir} (Locked: ${target.door.locked})`);

    const d = target.door;

    // unlock if locked and player has keys
    if (d.locked && d.locked == 1) {
        const keyCount = Globals.player.inventory?.keys || 0;
        console.log(`  Attempting Type 1 Unlock. Keys: ${keyCount}`);

        if (keyCount > 0) {
            Globals.player.inventory.keys--;
            if (Globals.elements.keys) Globals.elements.keys.innerText = Globals.player.inventory.keys;
            d.locked = 0;
            d.unlockedByKey = true;
            log(`${target.dir} door unlocked via USE (Space)`);
            SFX.doorUnlocked();
        } else {
            log("Door is locked - no keys");
            spawnFloatingText(Globals.player.x, Globals.player.y - 40, "Locked (Need Key)", "red");
            SFX.doorLocked();
        }
        return;
    }

    // unlock if locked and player has keys
    if (d.locked && d.locked == 2) {
        if (Globals.player.inventory?.matrixKey === true) {
            d.locked = 0;
            d.unlockedByKey = true;
            log(`${target.dir} house door unlocked via USE (Space)`);
            SFX.doorUnlocked();
        } else {
            log("Door is locked - no keys");
            spawnFloatingText(Globals.player.x, Globals.player.y - 40, "Locked (Need Key)", "red");
            SFX.doorLocked();
        }
        return;
    }

    if (d.locked && d.locked == 3) {
        if (Globals.player.inventory?.houseKey === true) {
            d.locked = 0;
            d.unlockedByKey = true;
            log(`${target.dir} matrix door unlocked via USE (Space)`);
            SFX.doorUnlocked();
        } else {
            log("Door is locked - no keys");
            spawnFloatingText(Globals.player.x, Globals.player.y - 40, "Locked (Need Key)", "red");
            SFX.doorLocked();
        }
        return;
    }

    // (optional) if you ever add "open but interact" doors, handle here
    // log(`${target.dir} door used (already unlocked)`);
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

        //check if the ghost is in the room and we are not in debug mode
        //note the debug flag isnt working but i dont mind that the GHOST is more powerful than the CODE!!!
        if (Globals.ghostSpawned && !window.DEBUG_WINDOW_ENABLED) {
            // Find the ghost entity
            const ghost = Globals.enemies.find(e => e.type === 'ghost');
            if (ghost) {
                //pick the ghost lore from ghost restart
                if (Globals.keys['KeyT']) {
                    const ghostLore = Globals.speechData.types?.ghost_restart || ["You cannot escape me!!"];
                    const ghostLine = ghostLore[Math.floor(Math.random() * ghostLore.length)];
                    triggerSpeech(ghost, "ghost_restart", ghostLine, true);
                }
                if (Globals.keys['KeyR']) {
                    const ghostLore = Globals.speechData.types?.ghost_newgame || ["Now New world for you!"];
                    const ghostLine = ghostLore[Math.floor(Math.random() * ghostLore.length)];
                    triggerSpeech(ghost, "ghost_newgame", ghostLine, true);
                }
            }
        }
        else {
            if (Globals.restartGame) Globals.restartGame(false);
            const shakePower = 5;
            Globals.screenShake.power = Math.max(Globals.screenShake.power, shakePower);
            Globals.screenShake.endAt = Date.now() + 500;
            Globals.screenShake.teleport = 1; // Trigger Teleport Effect
            SFX.restart();

        }
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
                            // bullets = [];
                            // bombs = [];
                            // particles = [];
                            // roomStartTime = Date.now();
                            // ghostSpawned = false; // Reset Ghost Timer

                            // Check if visited before
                            // Check if visited before
                            const coord = `${Globals.player.roomX},${Globals.player.roomY}`;
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

            // Bomb vs Bomb Collision (Solid only)
            if (b.solid) {
                // To avoid checking the same pair twice, we just check against the rest of the array
                // We'll iterate manually since this is inside a forEach
                for (let j = 0; j < Globals.bombs.length; j++) {
                    const b2 = Globals.bombs[j];
                    if (b === b2 || !b2.solid || b2.exploding) continue;

                    const dx = b.x - b2.x;
                    const dy = b.y - b2.y;
                    const dist = Math.hypot(dx, dy);
                    const r1 = b.baseR || 15;
                    const r2 = b2.baseR || 15;
                    const minDist = r1 + r2;

                    if (dist < minDist && dist > 0) {
                        const overlap = minDist - dist;
                        const nx = dx / dist;
                        const ny = dy / dist;

                        // Push both bombs apart equally (assuming similar mass for simplicity)
                        b.x += nx * (overlap / 2);
                        b.y += ny * (overlap / 2);
                        b2.x -= nx * (overlap / 2);
                        b2.y -= ny * (overlap / 2);

                        // Basic elastic bounce
                        const vxDiff = b.vx - b2.vx;
                        const vyDiff = b.vy - b2.vy;
                        const dot = vxDiff * nx + vyDiff * ny;

                        if (dot < 0) { // Only bounce if moving towards each other
                            const m1 = b.physics?.mass || 1.5;
                            const m2 = b2.physics?.mass || 1.5;
                            const res = Math.min(b.physics?.restitution || 0.5, b2.physics?.restitution || 0.5);

                            const impulse = -(1 + res) * dot / ((1 / m1) + (1 / m2));

                            b.vx += (impulse / m1) * nx;
                            b.vy += (impulse / m1) * ny;
                            b2.vx -= (impulse / m2) * nx;
                            b2.vy -= (impulse / m2) * ny;
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
        if (en.type === 'ghost' || en.type === 'ghost_trophy') triggerSpeech(en, 'idle');

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
                const isRunAway = en.moveType === 'runAway' || (typeof en.moveType === 'object' && en.moveType.type === 'runAway');
                const isWander = en.moveType === 'wander';

                // 1. Seek (or Flee) Player
                let dx = Globals.player.x - en.x;
                let dy = Globals.player.y - en.y;
                const distToPlayer = Math.hypot(dx, dy);
                let dirX = 0, dirY = 0;

                if (isWander) {
                    if (en.wanderAngle === undefined) en.wanderAngle = Math.random() * Math.PI * 2;
                    en.wanderAngle += (Math.random() - 0.5) * 0.5; // Turn slightly
                    dirX = Math.cos(en.wanderAngle);
                    dirY = Math.sin(en.wanderAngle);
                } else if (distToPlayer > 0.1) {
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
                            log(`Loaded Enemy Gun: ${en.gun}`, d.Bullet?.canDamagePlayer ? "Has Damage" : "NO DAMAGE", d);
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
        // Skip for trophy display
        if (!en.isStatDisplay) {
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
        }

        // 4. BULLET COLLISION
        Globals.bullets.forEach((b, bi) => {
            if (en.isStatDisplay) return;
            // Skip checks only if invulnerable AND NOT explicitly solid
            // (Standard enemies are valid targets, but if invulnerable we usually skip unless solid)
            // Default "solid" to false if undefined? No, standard behavior for invuln is pass-through.
            // If user sets "solid": true, we process collision even if invuln.
            if (en.invulnerable && !en.solid) return;

            if (b.ownerType === 'enemy') return;
            const dist = Math.hypot(b.x - en.x, b.y - en.y);
            if (dist < en.size + (b.size || 5)) {
                if (Globals.gun.Bullet?.pierce && b.hitEnemies?.includes(ei)) return;

                // Track Accuracy (Perfect Bonus)
                Globals.hitsInRoom++;
                b.hasHit = true;

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
                    if (en.type === 'ghost') Globals.ghostHP = en.hp; // Sync Persistence
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

                if (Globals.gun.Bullet?.Explode?.active && !b.isShard) spawnBulletShards(b);

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
                updateGameStats('kill', en);

                if (amount > 0) {
                    spawnCurrencyShard(en.x, en.y, 'green', amount);
                }

                // UNLOCK ITEM DROP (New Logic for Normal Enemies)
                const unlockCfg = en.gunConfig?.unlockItem || en.unlockItem;
                if (unlockCfg && unlockCfg.active) {
                    const chance = unlockCfg.unlockChance || 0; // Default 0 for normal enemies unless configured
                    if (Math.random() <= chance) {
                        const count = unlockCfg.count || 1;
                        let finalFilter = (typeof unlockCfg.rarity === 'object') ? unlockCfg.rarity : null;
                        if (typeof unlockCfg.rarity === 'string') finalFilter = { [unlockCfg.rarity]: true };

                        for (let i = 0; i < count; i++) {
                            spawnUnlockItem(en.x + (i * 20), en.y, false, finalFilter);
                        }
                    }
                }
            }

            if (en.type === 'boss') {
                log("BOSS DEFEATED! The Curse Strengthens... Resetting Rooms!");
                SFX.explode(0.5);

                // RED SHARD REWARD
                const amount = calculateShardDrop('red', 'killBoss', en);
                //update kill enemy global counter
                updateGameStats('bossKill', en);
                spawnCurrencyShard(en.x, en.y, 'red', amount);

                Globals.bossKilled = true;

                // UNLOCK ITEM DROP (New Logic for Enemies & Bosses)
                const unlockCfg = en.gunConfig?.unlockItem || en.unlockItem || Globals.roomData.unlockItem;
                // Note: en.unlockItem comes from enemy JSON (e.g. Grunt/Tank)

                if (unlockCfg && unlockCfg.active) {
                    const chance = unlockCfg.unlockChance || 1;
                    log(`Enemy/Boss Defeated! Checking unlock drop. Chance: ${chance}`);

                    if (Math.random() <= chance) {
                        const count = unlockCfg.count || 1;
                        const rarityFilter = (typeof unlockCfg.rarity === 'object') ? unlockCfg.rarity : null;
                        // If rarity is a string "common", convert to filter? 
                        // Legacy support: if rarity is string, make object { [str]: true }
                        let finalFilter = rarityFilter;
                        if (typeof unlockCfg.rarity === 'string') {
                            finalFilter = { [unlockCfg.rarity]: true };
                        }

                        log(`Roll Success! Spawning ${count} unlock items. Filter:`, finalFilter);
                        for (let i = 0; i < count; i++) {
                            spawnUnlockItem(en.x + (i * 20), en.y, en.type === 'boss', finalFilter);
                        }
                    } else {
                        log("Unlock Roll Failed.");
                    }
                }

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
                Globals.ghostKilled = true;
                if (Globals.gameData.rewards && Globals.gameData.rewards.ghost) {
                    spawnRoomRewards(Globals.gameData.rewards.ghost, "GHOST BONUS");

                    if (Globals.elements.perfect) {
                        Globals.elements.perfect.innerText = "GHOST BONUS!";
                        Globals.elements.perfect.classList.add('show');
                        setTimeout(() => Globals.elements.perfect.classList.remove('show'), 2000);
                    }

                    const specialPath = Globals.gameData.rewards.ghost.special?.item;
                    if (specialPath) {
                        (async () => {
                            try {
                                const cleanPath = specialPath.trim();
                                const url = (cleanPath.startsWith('json') || cleanPath.startsWith('/json'))
                                    ? cleanPath
                                    : ("json" + (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath));
                                log("Loading Special Ghost Item:", cleanPath, "->", url);

                                const res = await fetch(`${url}?t=${Date.now()}`);
                                if (res.ok) {
                                    const itemData = await res.json();
                                    Globals.groundItems.push({
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

    const isMatrixRoom = Globals.roomData._type === 'matrix' || Globals.roomData.name === "Guns Lots of Guns";

    if (Globals.roomData.isBoss && activeThreats.length === 0 && !Globals.portal.active && !isMatrixRoom) {
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
    // Only interact if active
    // if (!Globals.roomData.isBoss) return; // Allow anywhere per user request
    log(Globals.portal);
    const dist = Math.hypot(Globals.player.x - Globals.portal.x, Globals.player.y - Globals.portal.y);
    if (dist < 30) {

        let shardsCollected = false;

        // Check for Warning Feature
        const nextLevel = Globals.roomData.nextLevel !== undefined ? Globals.roomData.nextLevel : Globals.gameData.nextLevel;
        const welcomeScreen = Globals.roomData.welcomeScreen !== undefined ? Globals.roomData.welcomeScreen : Globals.gameData.welcomeScreen;
        const completedItMate = Globals.roomData.completedItMate !== undefined ? Globals.roomData.completedItMate : Globals.gameData.completedItMate;
        const hasNextLevel = nextLevel && nextLevel.trim() !== "";
        const isSpecialRoom = ['start', 'matrix', 'home', 'upgrade'].includes(Globals.roomData.type) || ['start', 'matrix', 'home', 'upgrade'].includes(Globals.roomData._type) || Globals.roomData.inactivePortal;
        // A Boss Room portal is NEVER inactive
        const isInactivePortal = !Globals.roomData.isBoss && ((!hasNextLevel && !welcomeScreen && !completedItMate) || isSpecialRoom);

        if (Globals.gameData.portalWarning && Globals.groundItems.length > 0 && !isInactivePortal) {

            // Auto-collect shards and evaluate if any real items remain
            const realItems = [];
            for (let i = Globals.groundItems.length - 1; i >= 0; i--) {
                const item = Globals.groundItems[i];
                if (item.data && item.data.type === 'shard') {
                    // Auto-collect the shard
                    pickupItem(item, "You");
                    Globals.groundItems.splice(i, 1);
                    shardsCollected = true;
                } else {
                    realItems.push(item);
                }
            }

            // Only fire modal if REAL items (not just shards) are left and its an active portal
            if (realItems.length > 0) {
                if (!Globals.portal.warningActive) {
                    Globals.portal.warningActive = true;
                    // Pause input manually
                    Globals.inputDisabled = true;

                    // Pop Modal (via Global window export)
                    if (window.showPortalWarningModal) {
                        window.showPortalWarningModal(realItems.length);
                    }
                }
                return;
            }
        }

        // 4. Inactive / Tutorial Portals
        if (isInactivePortal) {
            log("Inactive portal touched. Ignoring logic.");
            return;
        }

        // WIN GAME (Default Transition)
        if (!Globals.portal.transitioning) {
            Globals.portal.transitioning = true;
            Globals.inputDisabled = true; // prevent moving while waiting

            if (shardsCollected) {
                setTimeout(() => {
                    Globals.inputDisabled = false;
                    handleLevelComplete();
                }, 1000);
            } else {
                Globals.inputDisabled = false;
                handleLevelComplete();
            }
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
    Globals.handleLevelComplete = handleLevelComplete; // Expose for UI.js

    // 0. Handle Unlocks (First priority as requested)
    const roomUnlocks = Globals.roomData.unlocks || [];
    const foundUnlocks = Globals.foundUnlocks || [];
    const allUnlocks = [...roomUnlocks, ...foundUnlocks];
    const uniqueUnlocks = [...new Set(allUnlocks)];

    if (uniqueUnlocks.length > 0) {
        if (Globals.handleUnlocks) {
            Globals.handleUnlocks(uniqueUnlocks).then(() => {
                proceedLevelComplete();
            });
            return;
        }
    }
    proceedLevelComplete();
}

function proceedLevelComplete() {
    // Save Stats before transition
    saveGameStats();

    // Track Level Split
    if (Globals.levelStartTime) {
        const split = Date.now() - Globals.levelStartTime;
        Globals.levelSplits = Globals.levelSplits || [];

        // Store Object: { name, time }
        const levelName = localStorage.getItem('current_level_name') || Globals.gameData.name || `Level ${Globals.levelSplits.length + 1}`;
        Globals.levelSplits.push({
            name: levelName,
            time: split
        });
        localStorage.setItem('rogue_level_splits', JSON.stringify(Globals.levelSplits));
    }

    const nextLevel = Globals.roomData.nextLevel !== undefined ? Globals.roomData.nextLevel : Globals.gameData.nextLevel;
    const welcomeScreen = Globals.roomData.welcomeScreen !== undefined ? Globals.roomData.welcomeScreen : Globals.gameData.welcomeScreen;
    const completedItMate = Globals.roomData.completedItMate !== undefined ? Globals.roomData.completedItMate : Globals.gameData.completedItMate;
    const hasNextLevel = nextLevel && nextLevel.trim() !== "";

    // 1. Always go to welcome screen
    if (hasNextLevel && welcomeScreen === true && completedItMate === false) {
        log("Level Complete. Returning to Welcome Screen. Pending Next Level:", nextLevel);
        localStorage.setItem('rogue_transition', 'true');
        localStorage.setItem('rogue_current_level', nextLevel);
        localStorage.setItem('rogue_player_state', JSON.stringify(Globals.player));
        if (Globals.goToWelcome) Globals.goToWelcome();
        return;
    }

    // 2. Always go to end credits
    if (hasNextLevel && welcomeScreen === false && completedItMate === true) {
        const endTime = Date.now();
        const duration = endTime - Globals.runStartTime;
        Globals.SessionRunTime = duration;
        Globals.NumberOfSessionRuns++;

        if (Globals.BestRunTime === 0 || duration < Globals.BestRunTime) {
            Globals.BestRunTime = duration;
            localStorage.setItem('bestRunTime', duration);
        }
        localStorage.setItem('numberOfRuns', Globals.NumberOfRuns);

        showCredits();
        return;
    }

    // 3. Always go to next level
    if (hasNextLevel && welcomeScreen === false && completedItMate === false) {
        log("Proceeding to Next Level:", nextLevel);
        if (Globals.introMusic) {
            Globals.introMusic.pause();
            Globals.introMusic.currentTime = 0;
        }
        localStorage.setItem('rogue_transition', 'true');
        localStorage.setItem('rogue_current_level', nextLevel);
        localStorage.setItem('rogue_player_state', JSON.stringify(Globals.player));
        initGame(true, nextLevel, true);
        return;
    }

    // 4. Inactive / Tutorial Portals (No transition logic defined)
    if (!hasNextLevel && !welcomeScreen && !completedItMate) {
        log("Inactive portal touched. Ignoring logic.");
        if (Globals.portal) Globals.portal.transitioning = false;
        Globals.inputDisabled = false;
        return;
    }

    // 5. Any other configuration throw an error
    console.error("INVALID LEVEL TRANSITION CONFIGURATION!", { nextLevel, welcomeScreen, completedItMate });
    //if (window.alert) alert("INVALID PORTAL CONFIGURATION. Check console errors.");
}

export function updateGhost() {
    if (Globals.gameState !== STATES.PLAY) return;

    // GHOST EXCLUSION: Boss, Shop, Home, Matrix
    // If we are in these rooms, ensure ghost is gone.
    if (Globals.roomData.isBoss || Globals.roomData.type === 'shop' || Globals.roomData._type === 'home' || Globals.roomData._type === 'matrix') {
        if (Globals.ghostSpawned) {
            Globals.enemies = Globals.enemies.filter(e => e.type !== 'ghost' && e.type !== 'ghost_trophy');
            Globals.ghostSpawned = false;
            Globals.ghostEntry = null; // Clear entry point
        }
        return;
    }

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
        if (Globals.roomData.type === 'shop') return; // Stop ghost in shop

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

        inst.spawnTime = now; // Track when ghost appeared
        Globals.enemies.push(inst);
        SFX.ghost(); // Spooky sound!
    } // End Spawn Check

    // --- ROOM SHRINKING LOGIC & LOCKING ---
    const ghost = Globals.enemies.find(e => e.type === 'ghost' && !e.isDead);
    if (ghost) {
        // Use logic from Game Data (roomGhostTimer)
        const ghostConfig = Globals.gameData.ghost || { roomGhostTimer: 10000 };
        const delay = ghostConfig.roomGhostTimer;
        const elapsed = Date.now() - (ghost.spawnTime || 0);

        // 1. LOCK DOORS (after 1 timer cycle)
        if (elapsed > delay) {
            ghost.locksRoom = true;
        } else {
            ghost.locksRoom = false;
        }

        // 2. SHRINK ROOM (after 2 timer cycles)
        if (elapsed > delay * 2) {
            if (!ghost.hasSpokenGhostHealth) {
                // Only speak if we actually have health bar to hide (and it's not already hidden locally)
                if (!ghost.hideHealth) triggerSpeech(ghost, "", "HEALTH BAR BE GONE!!!!", false);

                ghost.hasSpokenGhostHealth = true;
                ghost.hideHealth = true; // Local hide, do not modify Global Config
            }

            // Shrink the room!
            const maxShrink = (Globals.canvas.width / 2) - 60; // Leave a 120px box
            if (Globals.roomShrinkSize < maxShrink) {
                Globals.roomShrinkSize += 0.1; // Slow creep
            }
        }

        // 3. GLANCE AT SECRET DOORS
        // Check if there are any hidden doors in this room
        const doors = Globals.roomData.doors || {};
        const hiddenDoors = Object.entries(doors).filter(([dir, d]) => d.active && d.hidden);

        if (hiddenDoors.length > 0) {
            // Chance to glance
            if (!ghost.glanceTimer) ghost.glanceTimer = Date.now() + 2000 + Math.random() * 3000;

            if (Date.now() > ghost.glanceTimer) {
                // Pick a target door
                const [dir, targetDoor] = hiddenDoors[Math.floor(Math.random() * hiddenDoors.length)];

                // Calculate target point
                let tx = targetDoor.x ?? Globals.canvas.width / 2;
                let ty = targetDoor.y ?? Globals.canvas.height / 2;
                if (dir === 'top') ty = 0;
                if (dir === 'bottom') ty = Globals.canvas.height;
                if (dir === 'left') tx = 0;
                if (dir === 'right') tx = Globals.canvas.width;

                // Set Glance State
                ghost.glanceTarget = { x: tx, y: ty };
                ghost.glanceEndTime = Date.now() + 1000; // Look for 1s

                // Reset Timer
                ghost.glanceTimer = Date.now() + 3000 + Math.random() * 5000;
                // log("Ghost glancing at secret door:", dir);
            }
        }
    } else {
        // Reset if ghost is gone
        if (Globals.roomShrinkSize > 0) {
            Globals.roomShrinkSize -= 2.0; // Fast expand
            if (Globals.roomShrinkSize < 0) Globals.roomShrinkSize = 0;
        }
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
    Globals.perfectStreak = 0; // Failed Streak (Hit)
    Globals.noDamageStreak = 0; // No Damage Reset
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

    // Helper for 3D/Shape Drawing
    const drawEnemyShape = (ctx, en, x, y, size) => {
        const shape = en.shape || "circle";
        const isGhost = en.type === 'ghost' || (en.isStatDisplay && !en.needsKill);

        ctx.beginPath();
        if (shape === "square") {
            if (isGhost) {
                // Square with wavy feet
                ctx.moveTo(x - size, y + size); // Bottom Left
                ctx.lineTo(x - size, y - size); // Top Left
                ctx.lineTo(x + size, y - size); // Top Right
                ctx.lineTo(x + size, y + size); // Bottom Right
                // Waves (R -> L)
                const width = size * 2;
                const waves = 3;
                const waveWidth = width / waves;
                for (let i = 1; i <= waves; i++) {
                    const waveX = (x + size) - (waveWidth * i);
                    const waveY = (y + size);
                    const cX = (x + size) - (waveWidth * (i - 0.5));
                    const cY = waveY - (size * 0.3);
                    ctx.quadraticCurveTo(cX, cY, waveX, waveY);
                }
                ctx.closePath();
            } else {
                ctx.rect(x - size, y - size, size * 2, size * 2);
            }
        } else if (shape === "triangle") {
            if (isGhost) {
                ctx.moveTo(x, y - size); // Top
                ctx.lineTo(x + size, y + size); // Bottom Right
                // Waves
                const width = size * 2;
                const waves = 3;
                const waveWidth = width / waves;
                for (let i = 1; i <= waves; i++) {
                    const waveX = (x + size) - (waveWidth * i);
                    const waveY = (y + size);
                    const cX = (x + size) - (waveWidth * (i - 0.5));
                    const cY = waveY - (size * 0.3);
                    ctx.quadraticCurveTo(cX, cY, waveX, waveY);
                }
                ctx.closePath();
            } else {
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y + size);
                ctx.lineTo(x - size, y + size);
                ctx.closePath();
            }
        } else if (shape === "star") {
            const spikes = 5;
            const outerRadius = size;
            const innerRadius = size / 2;
            let rot = Math.PI / 2 * 3;
            let step = Math.PI / spikes;

            if (isGhost) {
                ctx.moveTo(x, y - outerRadius);
                // i = 0
                ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius); rot += step;
                ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius); rot += step;
                // i = 1
                ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius); rot += step;
                ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius); rot += step;

                // SKIRT
                ctx.lineTo(x + size, y + size);
                const waves = 3;
                const waveWidth = (size * 2) / waves;
                for (let j = 1; j <= waves; j++) {
                    const waveX = (x + size) - (waveWidth * j);
                    const waveY = (y + size);
                    const cX = (x + size) - (waveWidth * (j - 0.5));
                    const cY = waveY - (size * 0.3);
                    ctx.quadraticCurveTo(cX, cY, waveX, waveY);
                }

                // Resume at i = 3 inner (skip bottom points)
                rot = Math.PI / 2 * 3 + step * 7;
                ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius); rot += step;
                // i = 4
                ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius); rot += step;
                ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius);
                ctx.closePath();
            } else {
                ctx.moveTo(x, y - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    let px = x + Math.cos(rot) * outerRadius;
                    let py = y + Math.sin(rot) * outerRadius;
                    ctx.lineTo(px, py);
                    rot += step;
                    px = x + Math.cos(rot) * innerRadius;
                    py = y + Math.sin(rot) * innerRadius;
                    ctx.lineTo(px, py);
                    rot += step;
                }
                ctx.lineTo(x, y - outerRadius);
                ctx.closePath();
            }
        } else if (shape === "hexagon" || shape === "pentagon") {
            const sides = shape === "hexagon" ? 6 : 5;
            const angleStep = (Math.PI * 2) / sides;
            const startAngle = -Math.PI / 2;

            if (isGhost) {
                ctx.moveTo(x + size * Math.cos(startAngle), y + size * Math.sin(startAngle));
                if (sides === 5) {
                    ctx.lineTo(x + size * Math.cos(startAngle + 1 * angleStep), y + size * Math.sin(startAngle + 1 * angleStep));
                } else {
                    ctx.lineTo(x + size * Math.cos(startAngle + 1 * angleStep), y + size * Math.sin(startAngle + 1 * angleStep));
                    ctx.lineTo(x + size * Math.cos(startAngle + 2 * angleStep), y + size * Math.sin(startAngle + 2 * angleStep));
                }

                // SKIRT
                ctx.lineTo(x + size, y + size);
                const waves = 3;
                const waveWidth = (size * 2) / waves;
                for (let j = 1; j <= waves; j++) {
                    const waveX = (x + size) - (waveWidth * j);
                    const waveY = (y + size);
                    const cX = (x + size) - (waveWidth * (j - 0.5));
                    const cY = waveY - (size * 0.3);
                    ctx.quadraticCurveTo(cX, cY, waveX, waveY);
                }

                if (sides === 5) {
                    ctx.lineTo(x + size * Math.cos(startAngle + 4 * angleStep), y + size * Math.sin(startAngle + 4 * angleStep));
                } else {
                    ctx.lineTo(x + size * Math.cos(startAngle + 4 * angleStep), y + size * Math.sin(startAngle + 4 * angleStep));
                    ctx.lineTo(x + size * Math.cos(startAngle + 5 * angleStep), y + size * Math.sin(startAngle + 5 * angleStep));
                }
                ctx.closePath();
            } else {
                ctx.moveTo(x + size * Math.cos(startAngle), y + size * Math.sin(startAngle));
                for (let i = 1; i <= sides; i++) {
                    const angle = startAngle + i * angleStep;
                    ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
                }
                ctx.closePath();
            }
        } else if (shape === "diamond") {
            if (isGhost) {
                ctx.moveTo(x, y - size); // Top
                ctx.lineTo(x + size, y); // Right
                // Skirt
                ctx.lineTo(x + size, y + size);
                const waves = 3;
                const waveWidth = (size * 2) / waves;
                for (let j = 1; j <= waves; j++) {
                    const waveX = (x + size) - (waveWidth * j);
                    const waveY = (y + size);
                    const cX = (x + size) - (waveWidth * (j - 0.5));
                    const cY = waveY - (size * 0.3);
                    ctx.quadraticCurveTo(cX, cY, waveX, waveY);
                }
                ctx.lineTo(x - size, y); // Left
                ctx.closePath();
            } else {
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y);
                ctx.lineTo(x, y + size);
                ctx.lineTo(x - size, y);
                ctx.closePath();
            }
        } else if (en.type === 'ghost' || en.type === 'ghost_trophy' || (isGhost && (shape === 'circle' || !shape))) {
            const r = size;
            const h = r * 0.8;
            ctx.arc(x, y - (r * 0.2), r, Math.PI, 0);
            ctx.lineTo(x + r, y + h);
            const waves = 3;
            const waveWidth = (r * 2) / waves;
            for (let i = 1; i <= waves; i++) {
                const waveX = (x + r) - (waveWidth * i);
                const waveY = (y + h);
                const cX = (x + r) - (waveWidth * (i - 0.5));
                const cY = waveY - (r * 0.3);
                ctx.quadraticCurveTo(cX, cY, waveX, waveY);
            }
            ctx.closePath();
        } else {
            ctx.arc(x, y, size, 0, Math.PI * 2);
        }
    };

    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
    const isGlobal3D = Globals.gameData["3dGlasses"] || Globals.gameData["3dglasses"] || unlockedIds.includes('3dGlasses') || unlockedIds.includes('3dglasses') || Globals.player["3dGlasses"] || Globals.player["3dglasses"];

    Globals.enemies.forEach(en => {
        Globals.ctx.save();

        // --- GLANCE LOGIC (Enhanced for Obviousness) ---
        // Frequent glances: every 0.5s - 2.5s
        if (!en.glanceTimer) en.glanceTimer = Date.now() + 2000 + Math.random() * 5000;

        if (Date.now() > en.glanceTimer) {
            const doors = Globals.roomData.doors || {};
            const hiddenDoors = Object.entries(doors).filter(([dir, d]) => d.active && d.hidden);

            if (hiddenDoors.length > 0) {
                const [dir, targetDoor] = hiddenDoors[Math.floor(Math.random() * hiddenDoors.length)];
                let tx = targetDoor.x ?? Globals.canvas.width / 2;
                let ty = targetDoor.y ?? Globals.canvas.height / 2;
                if (dir === 'top') ty = 0;
                if (dir === 'bottom') ty = Globals.canvas.height;
                if (dir === 'left') tx = 0;
                if (dir === 'right') tx = Globals.canvas.width;

                en.glanceTarget = { x: tx, y: ty };
                // Long Look: 2s
                en.glanceEndTime = Date.now() + 2000;
            }
            // Short Cooldown: 1s - 3s
            en.glanceTimer = Date.now() + 1000 + Math.random() * 2000;
        }

        // GHOST EFFECTS
        let bounceY = 0;
        let sizeMod = 0;

        // PICTURE FRAME (Unkilled in Trophy Room)
        if (en.needsKill) {
            Globals.ctx.save();
            Globals.ctx.strokeStyle = "#f1c40f"; // Gold Frame
            Globals.ctx.lineWidth = 5;
            Globals.ctx.strokeRect(en.x - en.size - 10, en.y - en.size - 10, (en.size * 2) + 20, (en.size * 2) + 20);
            Globals.ctx.restore();
        }

        if (en.type === 'ghost' || (en.isStatDisplay && !en.needsKill)) {
            // Ectoplasmic Wobble
            const time = Date.now() / 200;
            bounceY = Math.sin(time) * 5; // Float up and down
            sizeMod = Math.cos(time) * 2; // Pulse size slightly

            // Translucency (Base 0.8 for better visibility)
            const baseAlpha = 0.8;
            Globals.ctx.globalAlpha = en.isDead ? (en.deathTimer / 30) * baseAlpha : baseAlpha;
            Globals.ctx.globalCompositeOperation = "screen"; // Additive glow

            // Ghostly Glow/Shadow
            Globals.ctx.shadowBlur = 35;
            Globals.ctx.shadowColor = en.color || "white";
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
        const size = en.size + sizeMod;
        const currentY = en.y + bounceY;

        // 3D Effect (Extrusion)
        if (en["3d"] || isGlobal3D) {
            Globals.ctx.save();
            Globals.ctx.filter = 'brightness(0.7)'; // Darker shade for sides
            const depth = 20; // Internal steps
            for (let d = depth; d > 0; d -= 2) {
                // More X offset, Less Y offset (Squashed height)
                drawEnemyShape(Globals.ctx, en, en.x + (d * 0.5), currentY + (d * 0.5), size);
                Globals.ctx.fill();
            }
            Globals.ctx.restore();
        }

        // Main Shape
        drawEnemyShape(Globals.ctx, en, en.x, currentY, size);
        Globals.ctx.fill();

        // RESTORED: Original Ghost Eyes (Large Black) - Now with Glance
        if (en.type === 'ghost' || en.type === 'ghost_trophy') {
            Globals.ctx.save(); // Save context for ghost eyes
            Globals.ctx.globalCompositeOperation = "source-over"; // Reset blend mode
            Globals.ctx.globalAlpha = 1.0; // Reset alpha to fully opaque
            Globals.ctx.fillStyle = "black";

            const eyeSize = en.size * 0.3;
            const eyeXOffset = en.size * 0.4;
            const lookDist = en.size * 0.15; // How far eyes track player

            // Calculate Look Vector
            const dx = Globals.player.x - en.x;
            const dy = Globals.player.y - en.y;

            const d = Math.hypot(dx, dy);
            let lx = 0, ly = 0;
            if (d > 0) { lx = (dx / d) * lookDist; ly = (dy / d) * lookDist; }

            // Left Eye
            Globals.ctx.beginPath();
            Globals.ctx.arc(en.x - eyeXOffset + lx, en.y + bounceY + ly, eyeSize, 0, Math.PI * 2);
            Globals.ctx.fill();

            // Right Eye
            Globals.ctx.beginPath();
            Globals.ctx.arc(en.x + eyeXOffset + lx, en.y + bounceY + ly, eyeSize, 0, Math.PI * 2);
            Globals.ctx.fill();

            Globals.ctx.restore();
        }

        // Draw Name (After Fill to avoid color bleed)
        if (Globals.gameData.showEnemyNames !== false && en.lore && en.lore.displayName && !en.isDead) {
            Globals.ctx.save(); // Isolate text styles
            Globals.ctx.textAlign = "center";
            Globals.ctx.textBaseline = "bottom";
            Globals.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            Globals.ctx.font = "10px monospace";
            Globals.ctx.fillText(en.lore.displayName, en.x, en.y - en.size - 5);
            Globals.ctx.restore();
            Globals.ctx.restore();
        }

        // DRAW HEALTH BAR, use ShowGhost health to draw the ghost
        // DRAW HEALTH BAR

        // STAT DISPLAY (Trophy Room)
        // STAT DISPLAY (Trophy Room)
        if (en.isStatDisplay) {
            Globals.ctx.save();
            Globals.ctx.fillStyle = "#f1c40f";
            Globals.ctx.textAlign = "center";
            Globals.ctx.font = "bold 14px monospace";
            Globals.ctx.shadowColor = "black";
            Globals.ctx.shadowBlur = 2;

            if (en.displayInfo) {
                Globals.ctx.font = "bold 10px monospace";
                Globals.ctx.fillText(en.displayInfo.toUpperCase(), en.x, en.y - en.size - 10);
                Globals.ctx.font = "bold 14px monospace";
            }

            // Calculate Max Kills based on type
            let maxKills = 1000;
            const mkc = Globals.gameData.maxKillCount;
            if (typeof mkc === 'number') {
                maxKills = mkc;
            } else if (mkc) {
                if (en.type === 'boss') maxKills = mkc.boss || 100;
                else if (en.type === 'ghost') maxKills = mkc.ghost || 1;
                else maxKills = mkc.normal || 1000;
            }

            Globals.ctx.fillText(`Kills: ${en.killCount} / ${maxKills}`, en.x, en.y + en.size + 20);
            Globals.ctx.restore();
            // Skip Health Bar
        } else if (Globals.gameData.showEnemyHealth !== false && !en.isDead && en.maxHp > 0 && en.hp <= en.maxHp) {
            let skipDraw = false;

            // Ghost specific logic
            if (en.type === 'ghost') {
                // If globally disabled OR locally hidden (by lock)
                if (Globals.gameData.showGhostHealth === false || en.hideHealth) {
                    skipDraw = true;
                    // Trigger Speech if it happens during lock event?
                    // No, logic handles speech. Drawing just stops here.
                }
            }

            if (!skipDraw) {
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
            Globals.ctx.restore();
        }






        Globals.ctx.fillStyle = "white";
        Globals.ctx.textAlign = "center";
        Globals.ctx.textBaseline = "middle";
        Globals.ctx.font = `bold ${Math.max(10, en.size * 0.8)}px sans-serif`;

        // SKIP TEXT EYES ON GHOST (It has its own eyes)
        if (en.type !== 'ghost' && en.type !== 'ghost_trophy') {

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

            // Calculate Eye Offset to look at player OR Glance Target
            let aimDx = Globals.player.x - en.x;
            let aimDy = Globals.player.y - en.y;

            // GLANCE OVERRIDE
            if (en.glanceTarget && Date.now() < en.glanceEndTime) {
                aimDx = en.glanceTarget.x - en.x;
                aimDy = en.glanceTarget.y - en.y;
            }

            const aimDist = Math.hypot(aimDx, aimDy);
            const lookOffset = en.size * 0.3; // How far eyes move
            let eyeX = en.x;
            let eyeY = en.y + bounceY;

            if (aimDist > 0) {
                eyeX += (aimDx / aimDist) * lookOffset;
                eyeY += (aimDy / aimDist) * lookOffset;
            }

            Globals.ctx.fillText(eyes, eyeX, eyeY);
        }

        Globals.ctx.restore();
    });

    // TROPHY ROOM UI Overlay

    if (Globals.roomData && (Globals.roomData.type === 'trophy' || Globals.roomData._type === 'trophy') && Globals.trophyCounts) {
        const ctx = Globals.ctx;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`COLLECTION: ${Globals.trophyCounts.killed} / ${Globals.trophyCounts.total}`, Globals.canvas.width / 2, 80);
        ctx.font = '12px monospace';
        ctx.fillText("UNIQUE SPECIES ADDED TO MY COLLECTION", Globals.canvas.width / 2, 100);
        ctx.restore();
    }
}
// export function playerHit(en, invuln = false, knockback = false, shakescreen = false) {
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
                    const distCheck = Math.hypot(b.x - dX, b.y - dY);
                    if (distCheck < b.maxR + 30) {
                        if (!door.unbombable) {
                            // log("Bomb hit door:", dir, "locked:", door.locked, "hidden:", door.hidden, "openSecretRooms:", b.openSecretRooms); // Debug
                            if (b.openLockedDoors && (door.locked === 1 || door.locked === true)) door.locked = 0; // Unlock standard locks
                            if (b.openRedDoors) {
                                // Force open even if enemies are present
                                door.forcedOpen = true;
                            }
                            if (b.openSecretRooms && door.hidden) {
                                door.hidden = false;
                                door.active = true;
                                log("Secret Room Revealed:", dir);
                            }
                        } else {
                            log("Bomb hit UNBOMBABLE door, ignoring.");
                        }
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
                        if (en.type === 'ghost') Globals.ghostHP = en.hp; // Sync Persistence
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
            // Draw Explosion (Shockwave + Core)
            const color = b.explosionColour || "white";

            // 1. Central Flash (Initial Bang) - Rapid Fade White
            if (p < 0.2) {
                const flashP = p * 5; // 0 to 1 over 0.2s
                ctx.fillStyle = "white";
                ctx.globalAlpha = 1 - flashP;
                ctx.beginPath();
                ctx.arc(b.x, b.y, r * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Shockwave Ring (Expanding Outline)
            ctx.strokeStyle = color;
            ctx.lineWidth = 15 * (1 - p); // Starts thick, thins out
            ctx.globalAlpha = Math.max(0, (1 - p)); // Linear fade
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.stroke();

            // 3. Inner Blast (Core Fume)
            ctx.fillStyle = color;
            ctx.globalAlpha = Math.max(0, (1 - p) * 0.4); // Subtle fill
            ctx.beginPath();
            ctx.arc(b.x, b.y, r * 0.9, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1; // Reset

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

            // Draw Body (Geometric Sphere)
            const mainColor = b.colour || b.color || "#333";
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.arc(0, 0, b.baseR, 0, Math.PI * 2);
            ctx.fill();

            // Shine (Top Left)
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.beginPath();
            ctx.arc(-b.baseR * 0.3, -b.baseR * 0.3, b.baseR * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // Cap (Top Rect)
            const capW = b.baseR * 0.6;
            const capH = b.baseR * 0.3;
            const capY = -b.baseR * 0.9;
            ctx.fillStyle = "#555";
            ctx.fillRect(-capW / 2, capY - capH, capW, capH);

            // Fuse (Bezier Curve)
            ctx.strokeStyle = "#8e44ad"; // Darker Fuse
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, capY - capH);
            const fuseTipX = capW * 0.8;
            const fuseTipY = capY - capH - (b.baseR * 0.6);
            ctx.quadraticCurveTo(0, capY - capH - 10, fuseTipX, fuseTipY);
            ctx.stroke();

            // Spark (Flickering Star) at Fuse Tip
            if (now % 200 < 100) { // Flicker based on time
                ctx.fillStyle = "#f1c40f"; // Yellow Spark
                ctx.beginPath();
                ctx.arc(fuseTipX, fuseTipY, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#e67e22"; // Orange Core
                ctx.beginPath();
                ctx.arc(fuseTipX, fuseTipY, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Timer Text?
            if (b.timerShow && isFinite(b.explodeAt)) {
                ctx.fillStyle = "black";
                ctx.font = "bold 14px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const remaining = Math.max(0, ((b.explodeAt - now) / 1000).toFixed(1));
                ctx.fillText(remaining, 0, 5);
            }

            // Draw Remote Key Indicator (in center)
            if (b.remoteDenoate && b.remoteDenoate.active) { // Typo in property 'remoteDenoate' preserved
                const key = (b.remoteDenoate.key || "SPACE").toUpperCase();
                ctx.fillStyle = "white";
                ctx.font = "bold 12px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                // Center it (override timer if timer hidden, or stack?)
                // Usually remote bombs have hidden timer. If both, stack.
                const y = (b.timerShow && isFinite(b.explodeAt)) ? -8 : 0;
                ctx.fillText(`[${key}]`, 0, y);
            }

            ctx.restore();
        }
    }
}





export function updateBombDropping() {
    if (Globals.keys['KeyB']) {
        // 1. Check Inventory
        const bombCount = Globals.player.inventory?.bombs || 0;

        if (bombCount <= 0) {
            // Error Sound (Debounced)
            const now = Date.now();
            if (now - (Globals.player.lastBombError || 0) > 500) {
                SFX.cantDoIt();
                Globals.player.lastBombError = now;
            }
            return;
        }

        // 2. Check Type (Should always exist)
        if (Globals.player.bombType) {
            dropBomb().then(dropped => {
                if (dropped) {
                    Globals.player.inventory.bombs--;
                }
            });
        }
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

    // --- PHYSICS MOMENTUM (Knockback/Slide) ---
    if (Math.abs(Globals.player.vx || 0) > 0.1 || Math.abs(Globals.player.vy || 0) > 0.1) {
        Globals.player.x += (Globals.player.vx || 0);
        Globals.player.y += (Globals.player.vy || 0);

        // Friction
        Globals.player.vx *= 0.9;
        Globals.player.vy *= 0.9;

        // Stop if negligible
        if (Math.abs(Globals.player.vx) < 0.1) Globals.player.vx = 0;
        if (Math.abs(Globals.player.vy) < 0.1) Globals.player.vy = 0;

        // Basic Boundary Clamp for Momentum (Use simple boundary to allow door proximity)
        const s = Globals.roomShrinkSize || 0;
        const p = Globals.player;
        p.x = Math.max(BOUNDARY + s, Math.min(Globals.canvas.width - BOUNDARY - s, p.x));
        p.y = Math.max(BOUNDARY + s, Math.min(Globals.canvas.height - BOUNDARY - s, p.y));
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
                const nextX = Globals.player.x + dx * Globals.player.speed;
                // Movement Constraints with Shrink
                const shrink = Globals.roomShrinkSize || 0;
                let limit = 0;

                if (dx < 0) { // Moving Left
                    limit = BOUNDARY + shrink;
                } else { // Moving Right
                    limit = Globals.canvas.width - BOUNDARY - shrink;
                }

                // Restore Bomb Collision (Horizontal)
                let collided = false;
                let hitMoveable = false;

                // Home Room Statics Collision
                if (Globals.roomData.type === 'home' || Globals.roomData._type === 'home') {
                    const size = Globals.player.size;
                    const bedCheck = nextX + size > 50 && nextX - size < 130 && Globals.player.y + size > 50 && Globals.player.y - size < 190;
                    // Circle collision for table at 200, 200, radius 45
                    const distTable = Math.hypot(nextX - 300, Globals.player.y - 200);
                    const tableCheck = distTable < 45 + size;
                    const tvCheck = nextX + size > 260 && nextX - size < 380 && Globals.player.y + size > -20 && Globals.player.y - size < 60;
                    //check piggy bank at (100, 320)
                    const pbCheck = nextX + size > 75 && nextX - size < 125 && Globals.player.y + size > 300 && Globals.player.y - size < 340;
                    if (bedCheck || tableCheck || tvCheck || pbCheck) {
                        collided = true;
                    }
                }

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

                // Correct logic:
                // Normal wall: Cannot pass limit.
                // Door: Can pass limit IF in range.

                // Check if we are trying to cross the limit
                const crossingLimit = (dx < 0 && nextX < limit) || (dx > 0 && nextX > limit);

                if (!collided && (!crossingLimit || (inDoorRange && canPass))) {
                    Globals.player.x = nextX;
                } else if (collided && !hitMoveable) {
                    Globals.player.x = Math.max(BOUNDARY + Globals.player.size, Math.min(Globals.canvas.width - BOUNDARY - Globals.player.size, Globals.player.x));
                } else if (crossingLimit && !canPass && inDoorRange) {
                    if (door.hidden) {
                        // Ensure we snap back to limit to prevent slight seepage
                        if (dx < 0) Globals.player.x = limit; // Left Wall
                        if (dx > 0) Globals.player.x = limit; // Right Wall
                    }
                }
            } else {
                const limit = dy < 0 ? BOUNDARY : Globals.canvas.height - BOUNDARY;
                const nextY = Globals.player.y + dy * Globals.player.speed;
                let collided = false;
                let hitMoveable = false;

                // Home Room Statics Collision (Vertical)
                if (Globals.roomData.type === 'home' || Globals.roomData._type === 'home') {
                    const size = Globals.player.size;
                    const bedCheck = Globals.player.x + size > 50 && Globals.player.x - size < 130 && nextY + size > 50 && nextY - size < 190;
                    const distTable = Math.hypot(Globals.player.x - 300, nextY - 200);
                    const tableCheck = distTable < 45 + size;
                    const tvCheck = Globals.player.x + size > 260 && Globals.player.x - size < 380 && nextY + size > -20 && nextY - size < 60;
                    // Piggy Bank collision box (100, 320)
                    const pbCheck = Globals.player.x + size > 75 && Globals.player.x - size < 125 && nextY + size > 300 && nextY - size < 340;

                    if (bedCheck || tableCheck || tvCheck || pbCheck) {
                        collided = true;
                    }
                }

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

                // Y-Axis Constraints with Shrink
                const shrink = Globals.roomShrinkSize || 0;
                let limitY = 0;
                if (dy < 0) { // Up
                    limitY = BOUNDARY + shrink;
                } else { // Down
                    limitY = Globals.canvas.height - BOUNDARY - shrink;
                }

                const crossingLimit = (dy < 0 && nextY < limitY) || (dy > 0 && nextY > limitY);

                if (!collided && (!crossingLimit || (inDoorRange && canPass))) {
                    Globals.player.y = nextY;
                } else if (collided && !hitMoveable) {
                    Globals.player.y = Math.max(BOUNDARY + Globals.player.size + shrink, Math.min(Globals.canvas.height - BOUNDARY - Globals.player.size - shrink, Globals.player.y));
                }
            }
        }
    }

    // --- APPLY ROOM SHRINK CONSTRAINT ---
    if (Globals.roomShrinkSize > 0) {
        const s = Globals.roomShrinkSize;
        const p = Globals.player;

        // Push player inward
        if (p.x < s + p.size) p.x = s + p.size;
        if (p.x > Globals.canvas.width - s - p.size) p.x = Globals.canvas.width - s - p.size;
        if (p.y < s + p.size) p.y = s + p.size;
        if (p.y > Globals.canvas.height - s - p.size) p.y = Globals.canvas.height - s - p.size;
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
    log("PickupItem:", { type, data });

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

    if (type === 'unlock') {
        // UNIFY ALL UNLOCKS TO BE IMMEDIATE
        // Original "Queue for Portal" logic is deprecated in favor of immediate gratification.

        // 1. Persist
        const history = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
        if (!history.includes(data.unlockId)) {
            history.push(data.unlockId);
            localStorage.setItem('game_unlocked_ids', JSON.stringify(history));
        }

        // 2. Notification
        const displayName = (data.name || data.unlockId).toUpperCase().replace(/_/g, ' ');
        spawnFloatingText(Globals.player.x, Globals.player.y - 40, `UNLOCKED: ${displayName}`, "#2ecc71");

        const details = data.details || data;

        if (details.instantTrigger) {

            // Apply the override immediately
            if (Globals.saveUnlockOverride && details.json && details.attr && details.value !== undefined) {
                Globals.saveUnlockOverride(details.json, details.attr, details.value);
                log(`Instant Unlock Triggered: ${details.attr} = ${details.value}`);
            }

            // Persistence for Instant ID
            const detailID = details.unlock || data.unlockId;
            let historyUpdated = false;

            if (detailID && !history.includes(detailID)) {
                history.push(detailID);
                historyUpdated = true;
                log(`Instant Unlock Detail ID Saved: ${detailID}`);
            }

            // Fix: Also save the Manifest ID (data.unlockId) if different, to prevent respawning
            if (data.unlockId && data.unlockId !== detailID && !history.includes(data.unlockId)) {
                history.push(data.unlockId);
                historyUpdated = true;
                log(`Instant Unlock Manifest ID Saved: ${data.unlockId}`);
            }

            if (historyUpdated) {
                localStorage.setItem('game_unlocked_ids', JSON.stringify(history));
            }

            // SPECIAL: Instant sound effect
            if (detailID === 'soundEffects') {
                log("Sound Effect Unlocked via Pickup! key=" + detailID);
                Globals.gameData.soundEffects = true;
                Globals.sfxMuted = false;
                if (SFX && SFX.upgrade) SFX.upgrade();
                else if (SFX && SFX.coin) SFX.coin();
            }

            // SPECIAL: Instant Music Play
            if (detailID === 'music') {
                log("Music Unlocked via Pickup! key=" + detailID);

                Globals.musicMuted = false;
                localStorage.setItem('music_muted', 'false');
                Globals.gameData.music = true;

                if (Globals.introMusic) {
                    log("Starting Music Playback...");
                    if (Globals.introMusic.paused) {
                        fadeIn(Globals.introMusic, 2000, 0.4);
                    } else {
                        // already playing? ensure volume
                        Globals.introMusic.volume = 0.4;
                    }
                } else {
                    console.error("Globals.introMusic is missing!");
                }
            }
        }

        if (Globals.audioCtx.state !== 'suspended' && SFX.coin) SFX.coin();
        removeItem();
        return;
    }

    // --- COMPLEX ITEMS (Async) ---
    const location = data.location;
    log(`Picking up ${data.name}...`);

    // Simplified: Use existing data as config, fetch only if minimal ref
    let config = data;
    try {
        if (location && (!config.damage && !config.modifiers && !config.timer && !config.value)) {
            log("Fetching full config from location:", location);
            const res = await fetch(`${JSON_PATHS.ROOT}${location}?t=${Date.now()}`);
            config = await res.json();
        }

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
                        location: `${JSON_PATHS.ITEMS_DIR}guns/player/${oldName}.json`,
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

            // FIXED: If the ground item lacked a location, but the fetched config has one, use the config's location!
            const saveLocation = config.location || location || "";

            if (saveLocation.includes("/")) {
                const parts = saveLocation.split('/');
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
                } catch (e) { console.error("Gun save failed:", e); }
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
                        location: `${JSON_PATHS.ITEMS_DIR}bombs/${oldName}.json`,
                        rarity: "common",
                        starter: false,
                        colour: Globals.bomb.colour || Globals.bomb.color || "white"
                    }
                });
            }

            Globals.bomb = config;
            // FIXED: If the ground item lacked a location, but the fetched config has one, use the config's location!
            const saveLocation = config.location || location || "";

            if (saveLocation.includes("/")) {
                const parts = saveLocation.split('/');
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
            else if (target === 'player' || target.startsWith('player.')) {
                // Apply to Globals.player
                if (data.modifiers) {
                    let applied = false;
                    const baseTarget = target === 'player' ? '' : target.substring(7) + '.'; // e.g. "inventory."

                    for (const key in data.modifiers) {
                        let val = data.modifiers[key];
                        // Map 'bombs' shorthand to 'inventory.bombs'
                        let targetKey = baseTarget + key;
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
                                // Initialize intermediate object paths if they don't exist
                                if (current[parts[i]] === undefined) {
                                    current[parts[i]] = {};
                                }
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

                                // SPECIAL CHECK: Max Keys
                                if (targetKey === 'inventory.keys') {
                                    const maxKeys = Globals.player.inventory.maxKeys || 5;
                                    const currentKeys = typeof current[leaf] === 'number' ? current[leaf] : 0;

                                    if (currentKeys >= maxKeys && (isRelative ? val > 0 : val > currentKeys)) {
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
                                // Clamp Keys after add
                                if (targetKey === 'inventory.keys') {
                                    const maxKeys = Globals.player.inventory.maxKeys || 5;
                                    if (current[leaf] > maxKeys) current[leaf] = maxKeys;
                                }

                                applied = true;
                                log(`Player Mod: Set ${targetKey} to ${current[leaf]}`);
                            }
                        } else {
                            // Allow adding new properties (e.g. 3dglasses)
                            // if (Globals.player[targetKey] !== undefined) {
                            if (isRelative && typeof Globals.player[targetKey] === 'number') {
                                Globals.player[targetKey] += val;
                            } else {
                                Globals.player[targetKey] = val;
                            }
                            applied = true;
                            log(`Player Mod: Set ${targetKey} to ${Globals.player[targetKey]}`);
                            // }
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
// Helper to spawn unlock item
export async function spawnUnlockItem(x, y, isBossDrop = false, rarityFilter = null) {
    try {
        // 1. Fetch Manifest
        const res = await fetch(`${JSON_PATHS.ROOT}rewards/unlocks/manifest.json?t=${Date.now()}`);
        if (!res.ok) return;
        const manifest = await res.json();
        const allUnlocks = manifest.unlocks || [];

        // 2. Filter Unlocked
        const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
        Globals.sessionSpawnedUnlocks = Globals.sessionSpawnedUnlocks || [];

        const available = allUnlocks.filter(path => {
            // Normalize manifest path to simple ID (filename)
            const simpleId = path.split('/').pop().replace(/\.json$/i, '');
            // Check against permanent storage AND the current session's spawned items
            return !unlockedIds.includes(simpleId) && !unlockedIds.includes(path) && !Globals.sessionSpawnedUnlocks.includes(path);
        });

        log(`SpawnUnlockItem: Found ${allUnlocks.length} total, ${unlockedIds.length} unlocked. Available: ${available.length}`);

        if (available.length === 0) {
            log("All items unlocked! Spawning EXTRA Shards!");
            // Provide Red Shards if no unlocks left
            spawnCurrencyShard(x, y, 'red', 25);
            return;
        }

        // 3. Pick Random (Filter Spawnable logic + Rarity)
        // Parallelize fetching to eliminate the massive boss kill lag
        Globals.unlockDetailsCache = Globals.unlockDetailsCache || {};

        const fetchPromises = available.map(async id => {
            if (Globals.unlockDetailsCache[id]) {
                return { id, d: Globals.unlockDetailsCache[id] };
            }
            try {
                const dRes = await fetch(`${JSON_PATHS.ROOT}rewards/unlocks/${id}.json?t=${Date.now()}`);
                if (dRes.ok) {
                    const d = await dRes.json();
                    Globals.unlockDetailsCache[id] = d;
                    return { id, d };
                }
            } catch (e) { }
            return null;
        });

        const results = await Promise.all(fetchPromises);

        const candidates = [];
        const priorityCandidates = []; // for hasItem: false items

        for (const res of results) {
            if (!res) continue;
            const { id, d } = res;

            // Filter: Spawnable Check
            if (d.spawnable === false) continue;

            // Filter: Rarity Check (if filter provided)
            if (rarityFilter) {
                const r = d.rarity || 'common'; // Default to common
                if (!rarityFilter[r]) continue;
            }

            // User Request: Prioritize hasItem: false (Meta Unlocks)
            if (d.hasItem === false) {
                priorityCandidates.push(id);
            } else {
                candidates.push(id);
            }
        }

        // PRIORITIZE "hasItem: false" items first
        let nextUnlockId = null;

        if (priorityCandidates.length > 0) {
            log("Spawning PRIORITY Unlock (hasItem: false): Found " + priorityCandidates.length);
            nextUnlockId = priorityCandidates[Math.floor(Math.random() * priorityCandidates.length)];
        } else if (candidates.length > 0) {
            nextUnlockId = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
            // Give red shards if no valid candidate left matching filters
            spawnCurrencyShard(x, y, 'red', 25);
            return;
        }

        log("Spawning Unlock Item:", nextUnlockId);

        // Flag this item as spawned to prevent concurrent identical boss drops
        Globals.sessionSpawnedUnlocks.push(nextUnlockId);

        // Details pull from cache safely now
        let unlockName = "Unlock Reward";
        let unlockDetails = Globals.unlockDetailsCache[nextUnlockId] || null;
        if (unlockDetails && unlockDetails.name) unlockName = unlockDetails.name;

        // 4. Spawn Physical Item

        //chris<---
        Globals.groundItems.push({
            x: x, y: y,
            roomX: Globals.player.roomX, roomY: Globals.player.roomY,
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
            friction: 0.9, solid: true, moveable: true, size: 20,
            floatOffset: 0,
            data: {
                name: unlockName,
                details: unlockDetails, // Store full details
                type: "unlock", // New Type
                unlockId: nextUnlockId,
                colour: "gold",
                size: 20,
                rarity: "legendary",
                isBossDrop: isBossDrop
            }
        });
        spawnFloatingText(x, y - 40, "UNLOCK REWARD!", "gold");

    } catch (e) {
        console.error("Failed to spawn unlock item:", e);
    }
}

export function spawnRoomRewards(dropConfig, label = null) {
    if (!dropConfig) return false;

    // DIRECT SPAWN LOGIC (For simple rewards like defined Shards)
    if (dropConfig.type) {
        let dropX = (Globals.canvas.width / 2) + (Math.random() - 0.5) * 40;
        let dropY = (Globals.canvas.height / 2) + (Math.random() - 0.5) * 40;

        // Spawn Manually
        Globals.groundItems.push({
            x: dropX,
            y: dropY,
            data: dropConfig,
            roomX: Globals.player.roomX, roomY: Globals.player.roomY,
            vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
            friction: 0.9, solid: true, moveable: true, size: 15, floatOffset: Math.random() * 100
        });

        // Label
        if (label) {
            spawnFloatingText(dropX, dropY - 20, label, "#f1c40f");
        }
        return true;
    }

    if (!window.allItemTemplates) return false;
    // Debug MaxDrop
    if (dropConfig.maxDrop !== undefined) {
        log(`spawnRoomRewards: maxDrop=${dropConfig.maxDrop} for`, dropConfig);
    }

    let anyDropped = false;
    const pendingDrops = [];
    // 0. Fetch Unlock State
    const unlocks = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');

    const isUnlocked = (item) => {
        if (!item.unlocked) return true; // Default: Unlocked
        let isActive = item.unlocked.active; // Default state from JSON

        // Check Persistence Overrides (Keyed by location/path)
        const stored = unlocks[item.location];
        if (stored && stored.unlocked && stored.unlocked.active !== undefined) {
            isActive = stored.unlocked.active;
        }

        // Check ID-based Unlocks (game_unlocked_ids)
        // 1. Explicit unlockId in item JSON
        if (item.unlockId && unlockedIds.some(id => id === item.unlockId)) return true;

        // 2. Implicit ID Logic (Filename vs Path)
        if (item.location) {
            const cleanPath = item.location.replace(/\.json$/i, '').toLowerCase(); // Full path w/o ext
            const filenameId = cleanPath.split('/').pop(); // Just filename (e.g. "add3bombs")

            // Check against unlocked IDs
            const match = unlockedIds.some(rawId => {
                const id = rawId.toLowerCase();
                // A. Exact Filename Match (e.g. ID "add3bombs" matches "add3bombs.json")
                if (id === filenameId) return true;

                // B. Path Suffix Match (e.g. ID "inventory/add3bombs" matches ".../inventory/add3bombs.json")
                // Only if ID contains a slash to avoid generic suffix false positives
                if (id.includes('/') && cleanPath.endsWith(id)) return true;

                return false;
            });
            if (match) return true;
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
                (i._isUnlock === true || isUnlocked(i))
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
                        // Inject location property for special drops so pickupItem can save it!
                        if (!itemData.location) itemData.location = url;
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
            spawnCurrencyShard(Globals.player.x, Globals.player.y - 20, 'red', shardReward);
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
            data: { ...item, rarity: drop.rarity }, // Inject rarity from bucket/logic
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
    if (Globals.portal?.transitioning || Globals.portal?.warningActive) return;
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

        // 1. Main Barrel (Based on Last Shooting Direction, then Movement)
        let aimAngle = 0;
        let shootX = 0;
        let shootY = 0;

        // Check Input (Real-time override)
        if (Globals.keys['ArrowUp']) shootY = -1;
        if (Globals.keys['ArrowDown']) shootY = 1;
        if (Globals.keys['ArrowLeft']) shootX = -1;
        if (Globals.keys['ArrowRight']) shootX = 1;

        if (shootX !== 0 || shootY !== 0) {
            aimAngle = Math.atan2(shootY, shootX);
            // Update lastShoot if actively pressing keys (failsafe if updateShooting lags)
            Globals.player.lastShootX = shootX;
            Globals.player.lastShootY = shootY;
        }
        // FIX: Prioritize MOVEMENT direction if not actively shooting. 
        // User requesting: "if you are moving and not shooting he should be facing the way he is moving"
        else if (Globals.player.lastMoveX || Globals.player.lastMoveY) {
            aimAngle = Math.atan2(Globals.player.lastMoveY, Globals.player.lastMoveX);
        }
        // Fallback to last shoot direction only if no movement? Or maybe just remove this fallback entirely
        // to strictly follow movement. But let's keep it as a last resort if stationary?
        // Actually, if stationary (lastMoveX=0), we want to face last move direction usually.
        // The above 'else if' covers "lastMove". 
        // So we just need to ensure we don't accidentally use 'lastShoot' when moving.
        else if (Globals.player.lastShootX || Globals.player.lastShootY) {
            // Use Last Shot Direction only if no movement data (e.g. start of game? or purely stationary shooting?)
            aimAngle = Math.atan2(Globals.player.lastShootY, Globals.player.lastShootX);
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
        else if (b.shape === 'hexagon') {
            // 6 sides
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3;
                const hx = s * Math.cos(angle);
                const hy = s * Math.sin(angle);
                if (i === 0) Globals.ctx.moveTo(hx, hy);
                else Globals.ctx.lineTo(hx, hy);
            }
            Globals.ctx.closePath();
        }
        else if (b.shape === 'diamond') {
            // 4 points, rotated square
            Globals.ctx.moveTo(s, 0);
            Globals.ctx.lineTo(0, s);
            Globals.ctx.lineTo(-s, 0);
            Globals.ctx.lineTo(0, -s);
            Globals.ctx.closePath();
        }
        else if (['pentagon', 'heptagon', 'octagon', 'nonagon', 'decagon'].includes(b.shape)) {
            const sides = { pentagon: 5, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 }[b.shape];
            for (let i = 0; i < sides; i++) {
                const angle = (i * 2 * Math.PI / sides) - Math.PI / 2; // Start at top
                const px = s * Math.cos(angle);
                const py = s * Math.sin(angle);
                if (i === 0) Globals.ctx.moveTo(px, py);
                else Globals.ctx.lineTo(px, py);
            }
            Globals.ctx.closePath();
        }
        else if (b.shape === 'parallelogram') {
            // Skewed Rectangle
            Globals.ctx.moveTo(-s, -s / 2);
            Globals.ctx.lineTo(s / 2, -s / 2);
            Globals.ctx.lineTo(s, s / 2);
            Globals.ctx.lineTo(-s / 2, s / 2);
            Globals.ctx.closePath();
        }
        else if (b.shape === 'trapezoid') {
            // Narrow top, wide bottom
            Globals.ctx.moveTo(-s / 2, -s / 2);
            Globals.ctx.lineTo(s / 2, -s / 2);
            Globals.ctx.lineTo(s, s / 2);
            Globals.ctx.lineTo(-s, s / 2);
            Globals.ctx.closePath();
        }
        else if (b.shape === 'kite') {
            // 4 points, long tail
            Globals.ctx.moveTo(0, -s);
            Globals.ctx.lineTo(s / 2, 0);
            Globals.ctx.lineTo(0, s * 1.5);
            Globals.ctx.lineTo(-s / 2, 0);
            Globals.ctx.closePath();
        }
        else if (b.shape === 'rhombus') {
            // Basically a diamond but maybe we just treat it same
            Globals.ctx.moveTo(0, -s);
            Globals.ctx.lineTo(s * 0.7, 0);
            Globals.ctx.lineTo(0, s);
            Globals.ctx.lineTo(-s * 0.7, 0);
            Globals.ctx.closePath();
        }
        else if (b.shape === 'star') {
            // 5 points
            const spikes = 5;
            const outerRadius = s;
            const innerRadius = s / 2;
            let rotAngle = Math.PI / 2 * 3;
            let cx = 0; let cy = 0;
            let step = Math.PI / spikes;

            Globals.ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                let x = cx + Math.cos(rotAngle) * outerRadius;
                let y = cy + Math.sin(rotAngle) * outerRadius;
                Globals.ctx.lineTo(x, y);
                rotAngle += step;

                x = cx + Math.cos(rotAngle) * innerRadius;
                y = cy + Math.sin(rotAngle) * innerRadius;
                Globals.ctx.lineTo(x, y);
                rotAngle += step;
            }
            Globals.ctx.lineTo(cx, cy - outerRadius);
            Globals.ctx.closePath();
        }
        else Globals.ctx.arc(0, 0, s, 0, Math.PI * 2);

        if (b.filled) Globals.ctx.fill();
        else Globals.ctx.stroke();

        Globals.ctx.restore();

        // SPARKLY EFFECT (Legendary)
        if (b.sparkly && Math.random() < 0.3) {
            Globals.particles.push({
                x: b.x + (Math.random() - 0.5) * 5,
                y: b.y + (Math.random() - 0.5) * 5,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                life: 0.5,
                maxLife: 0.5,
                size: 2,
                color: 'gold'
            });
        }
    });
}

// --- RESTORED SHARD LOGIC ---
export function spawnCurrencyShard(x, y, type, amount) {
    // Check config
    if (!Globals.gameData.redShards && type === 'red') return;
    if (!Globals.gameData.greenShards && type === 'green') return;

    const angle = Math.random() * Math.PI * 2;
    const offset = 30 + Math.random() * 20;
    const spawnX = x + Math.cos(angle) * offset;
    const spawnY = y + Math.sin(angle) * offset;
    let shardMessage = 'shard'
    if (amount > 1)
        shardMessage = 'shards'

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
            name: type === 'red' ? `${amount} Red ${shardMessage}` : `${amount} Green ${shardMessage}`,
            rarity: 'common',
            colour: type === 'red' ? "#e74c3c" : "#2ecc71"
        }
    });
}

export function spawnBulletShards(b) {
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

        // 3.5 Item-Item Collision (Bounce off each other)
        for (let j = i - 1; j >= 0; j--) {
            const other = Globals.groundItems[j];
            const dx = item.x - other.x;
            const dy = item.y - other.y;
            const dist = Math.hypot(dx, dy);
            const minD = (item.size || 15) + (other.size || 15);

            if (dist < minD) {
                const angle = Math.atan2(dy, dx);
                const overlap = minD - dist;

                // Push apart (half each)
                const pushX = Math.cos(angle) * overlap * 0.5;
                const pushY = Math.sin(angle) * overlap * 0.5;

                item.x += pushX;
                item.y += pushY;
                other.x -= pushX;
                other.y -= pushY;

                // Bounce (add velocity away from center)
                const kick = 0.2; // Small bounce
                const kvx = Math.cos(angle) * kick;
                const kvy = Math.sin(angle) * kick;

                item.vx += kvx;
                item.vy += kvy;
                other.vx -= kvx;
                other.vy -= kvy;
            }
        }

        // 3.6 Chest Collision (Push items away from solid chests)
        Globals.chests.forEach(chest => {
            if (chest.solid || chest.state !== 'hidden') { // Avoid all visible chests? User said "chest is solid!"
                // Use AABB vs Circle
                const padding = 5;
                const cX = chest.x - padding;
                const cY = chest.y - padding;
                const cW = chest.width + padding * 2;
                const cH = chest.height + padding * 2;

                const iR = item.size || 15;

                // Find closest point on AABB to Circle Center
                const closestX = Math.max(cX, Math.min(item.x, cX + cW));
                const closestY = Math.max(cY, Math.min(item.y, cY + cH));

                const dx = item.x - closestX;
                const dy = item.y - closestY;
                const distSq = dx * dx + dy * dy;

                if (distSq < iR * iR) {
                    // Collision!
                    const dist = Math.sqrt(distSq);
                    const overlap = iR - dist;

                    // Normal
                    let nx = dx / dist;
                    let ny = dy / dist;

                    // Edge case: item inside chest center? dist=0
                    if (dist === 0) {
                        nx = 1; ny = 0; // Push right
                    }

                    item.x += nx * overlap;
                    item.y += ny * overlap;

                    // Bounce
                    item.vx += nx * 2;
                    item.vy += ny * 2;
                }
            }
        });

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
                // Only consume input if pickup succeeded
                if (pickupItem(item, i)) {
                    // console.log("Entities.js Consumed SPACE for item:", item);
                    if (Globals.keys) Globals.keys['Space'] = false; // Consume input
                }
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

        // Check Matrix Theme (from room config or name)
        const isMatrix = (Globals.roomData && (Globals.roomData.name === "Guns Lots of Guns" || (Globals.roomData.item && Globals.roomData.item.matrix))) || (item.data && item.data.rarity === 'matrix');

        if (isMatrix) {
            // Matrix Digital Rain Effect (Mini) around item
            Globals.ctx.fillStyle = `rgba(0, 255, 0, ${Math.random() * 0.5 + 0.2})`;
            Globals.ctx.font = '10px monospace';
            // Draw random 0s and 1s floating
            if (Math.random() > 0.8) {
                Globals.ctx.fillText(Math.random() > 0.5 ? "1" : "0", (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
            }
        }

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
        } else if (itemType === 'unlock') {
            // UNLOCK REWARD (Gold Square)
            Globals.ctx.fillStyle = '#f1c40f'; // Gold
            Globals.ctx.fillRect(-size / 2, -size / 2, size, size);
            Globals.ctx.strokeStyle = '#fff';
            Globals.ctx.lineWidth = 2;
            Globals.ctx.strokeRect(-size / 2, -size / 2, size, size);
            Globals.ctx.fillStyle = 'black';
            Globals.ctx.textAlign = 'center';
            Globals.ctx.fillText("U", 0, 4);
        } else {
            // Generic Item - Use Type Color
            Globals.ctx.fillStyle = getItemTypeColor(itemType, item.data) || item.color || '#95a5a6';
            Globals.ctx.fillRect(-size / 2, -size / 2, size, size);
        }

        // Rarity Effects (Glow/Pulse)
        let rarity = (item.data && item.data.rarity) ? item.data.rarity.toLowerCase() : 'common';

        // Auto-Upgrade Unlocks to Legendary (for visual effects)
        if (item.data && (item.data.name === 'Minimap' || item.data.unlock || item.data.unlockId || item.data.type === 'unlock')) {
            if (rarity === 'common' || rarity === 'special') rarity = 'legendary';
        }

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
            // Clean up prefixes if they exist
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
    if (!rewards || !rewards.shards) return 0; // Default fallback

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

    if (!dropConfig) return 0;

    const min = dropConfig.minCount || 1;
    const max = dropConfig.maxCount || 1;

    // Random between min and max, plus bonus
    //60% of the time override and award no bonus
    const awardIt = Math.floor(Math.random() * (Globals.randomGreenMaxCount - Globals.randomGreenMinCount) + Globals.randomGreenMinCount)
    if (awardIt < Globals.randomGreenPerAward) {
        const base = Math.floor(min + Math.random() * (max - min + 1));
        return base + bonus
    }
    else
        return 0;
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

    if (type === 'unlock' || (data && (data.unlock || data.unlockId))) return '#f1c40f'; // Gold for Unlocks (Legendary)

    if (type === 'modifier') {
        const loc = (data && data.location) ? data.location.toLowerCase() : "";
        if (loc.includes('player')) return '#3498db'; // Blue (Player Mod)
        if (loc.includes('bullets')) return '#9b59b6'; // Purple (Bullet Mod)
        return '#2ecc71'; // Green (Inventory/Other)
    }
    return null; // Fallback
}