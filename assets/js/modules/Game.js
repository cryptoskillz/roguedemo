import { Globals } from './Globals.js';
import { STATES, BOUNDARY, DOOR_SIZE, DOOR_THICKNESS, CONFIG, DEBUG_FLAGS, JSON_PATHS, STORAGE_KEYS } from './Constants.js';
import { log, deepMerge, triggerSpeech } from './Utils.js';
import { SFX, introMusic, unlockAudio, fadeIn, fadeOut } from './Audio.js';
import { setupInput, handleGlobalInputs } from './Input.js';
import { updateUI, updateWelcomeScreen, showLevelTitle, drawMinimap, drawTutorial, drawBossIntro, drawDebugLogs, drawFloatingTexts, updateFloatingTexts, getGameStats, updateGameStats, loadGameStats, resetSessionStats } from './UI.js';
import { renderDebugForm, updateDebugEditor } from './Debug.js';
import { generateLevel } from './Level.js';
import {
    spawnEnemies, updateEnemies, updateBulletsAndShards,
    pickupItem, applyModifierToGun, spawnRoomRewards,
    drawPlayer, drawBulletsAndShards, spawnShards, spawnShard, drawItems, drawEnemies,
    spawnBullet, dropBomb, drawBombs, updateBombDropping, updateMovementAndDoors, updateItems,
    updateRestart, updateRemoteDetonation, updateBombInteraction, updateUse, checkRemoteExplosions,
    updateBombsPhysics, updateShooting, updateShield, updatePortal, updateGhost,
    handleLevelComplete
} from './Entities.js';

// Placeholders for functions to be appended
export async function initGame(isRestart = false, nextLevel = null, keepStats = false) {
    // 0. Force Audio Resume (Must be first, to catch user interaction)
    if (Globals.audioCtx.state === 'suspended') Globals.audioCtx.resume();

    if (Globals.isInitializing) return;
    Globals.isInitializing = true;

    // Stats Init
    loadGameStats();
    if (!keepStats) resetSessionStats();

    console.log("TRACER: initGame Start. isRestart=", isRestart);

    // FIX: Enforce Base State on Fresh Run (Reload/Restart)
    const isDebug = Globals.gameData && Globals.gameData.debug && Globals.gameData.debug.windowEnabled === true;
    if (!keepStats && !isDebug) {
        resetWeaponState();
    }

    // KILL ZOMBIE AUDIO (Fix for duplicate music glitch)
    // If a legacy window.introMusic exists and is playing, stop it.
    if (window.introMusic && typeof window.introMusic.pause === 'function') {
        window.introMusic.pause();
        window.introMusic = null;
    }
    // Also pause the global one just in case we are restarting
    if (introMusic && !introMusic.paused) {
        // Don't pause here if we want seamless loop, but given the bugs, let's ensure clean state
        // introMusic.pause(); 
    }

    // Debug panel setup moved after config load

    // MOVED: Music start logic is now handled AFTER game.json is loaded to respect "music": false setting.

    Globals.gameState = STATES.START; // Always reset to START first, let startGame() transition to PLAY
    if (Globals.elements.overlay) Globals.elements.overlay.style.display = 'none';
    if (Globals.elements.welcome) Globals.elements.welcome.style.display = 'none';

    // Initial UI State
    if (Globals.elements.ui) {
        Globals.elements.ui.style.display = 'flex'; // Always keep flex container for layout
        const statsPanel = document.getElementById('stats-panel');
        if (statsPanel) statsPanel.style.display = (Globals.gameData && Globals.gameData.showUI !== false) ? 'block' : 'none';

        const mapCanvas = document.getElementById('minimapCanvas');
        if (mapCanvas) mapCanvas.style.display = (Globals.gameData && Globals.gameData.showMinimap !== false) ? 'block' : 'none';
    }
    Globals.bullets = [];
    Globals.bombs = [];
    Globals.particles = [];
    Globals.enemies = [];
    if (Globals.portal) {
        Globals.portal.active = false;
        Globals.portal.finished = false;
        Globals.portal.scrapping = false;
    }

    // ... [Previous debug and player reset logic remains the same] ...
    // Room debug display setup moved after config load

    // Room debug display setup moved after config load

    // Preserved Stats for Next Level
    let savedPlayerStats = null;
    log(`initGame called. isRestart=${isRestart}, keepStats=${keepStats}, player.bombType=${Globals.player ? Globals.player.bombType : 'null'}`);

    if (keepStats && Globals.player) {
        // Deep Clone to preserve ALL properties (items, modifiers, etc.)
        savedPlayerStats = JSON.parse(JSON.stringify(Globals.player));

        // Remove volatile runtime state
        delete savedPlayerStats.x;
        delete savedPlayerStats.y;
        delete savedPlayerStats.vx;
        delete savedPlayerStats.vy;
        delete savedPlayerStats.roomX;
        delete savedPlayerStats.roomY;
        delete savedPlayerStats.invulnUntil;
        delete savedPlayerStats.frozen;

        log("Saved Complete Player State");
    }

    if (!savedPlayerStats) {
        Globals.player.hp = 3;
        Globals.player.speed = 4;
        Globals.player.inventory.keys = 0;
        Globals.player.inventory.bombs = 0; // Ensure bombs reset too if not kept
        Globals.perfectStreak = 0; // Reset streak ONLY on fresh start
    }
    // Always reset pos
    Globals.player.x = 300;
    Globals.player.y = 200;
    Globals.player.roomX = 0;
    Globals.player.roomY = 0;
    Globals.bulletsInRoom = 0;
    Globals.player.roomY = 0;
    Globals.bulletsInRoom = 0;
    Globals.hitsInRoom = 0;

    // SHARD CURRENCY INIT
    // Red Shards (Permanent)
    const storedRed = localStorage.getItem('currency_red');
    const redVal = storedRed ? parseInt(storedRed) : 0;
    Globals.player.redShards = redVal;

    // KEY FIX: Sync to inventory if it exists (which controls UI now)
    if (Globals.player.inventory) {
        Globals.player.inventory.redShards = redVal;
    }

    // Green Shards (Run-based)
    Globals.player.inventory.greenShards = 0; // Always reset on run start

    // perfectStreak = 0; // REMOVED: Managed above
    if (Globals.elements.perfect) Globals.elements.perfect.style.display = 'none';
    Globals.roomStartTime = Date.now();
    Globals.ghostSpawned = false; // Reset Ghost
    Globals.ghostEntry = null;    // Reset Ghost Entry State
    Globals.roomFreezeUntil = 0;  // Reset Freeze Timer
    Globals.bossKilled = false;   // Reset Boss Kill State
    Globals.visitedRooms = {};
    Globals.levelMap = {};

    try {
        // 1. Load Game Config First
        let gData = await fetch(JSON_PATHS.GAME + '?t=' + Date.now()).then(res => res.json()).catch(() => ({ perfectGoal: 3, NoRooms: 11 }));

        // 1b. Load Lore & Speech Data
        try {
            const [lData, sData] = await Promise.all([
                fetch(JSON_PATHS.ENEMIES.LORE_NAMES + '?t=' + Date.now()).then(r => r.json()).catch(() => null),
                fetch(JSON_PATHS.ENEMIES.LORE_SPEECH + '?t=' + Date.now()).then(r => r.json()).catch(() => null)
            ]);
            Globals.loreData = lData;
            Globals.speechData = sData;
            log("Loaded Lore & Speech Data");
        } catch (e) { console.error("Lore/Speech load failed", e); }

        // CHECK UNLOCKS FOR WELCOME SCREEN
        try {
            const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
            if (unlockedIds.includes('welcome')) {
                gData.showWelcome = true;
                log("Welcome Screen Unlocked");
            }
        } catch (e) { }

        // LOAD SAVED WEAPONS OVERRIDE
        const savedGun = localStorage.getItem('current_gun');
        const savedBomb = localStorage.getItem('current_bomb');
        if (savedGun) {
            if (!gData) gData = {};
            gData.gunType = savedGun;
            log("Restored Gun: " + savedGun);
        }
        if (savedBomb) {
            if (!gData) gData = {};
            gData.bombType = savedBomb;
            log("Restored Bomb: " + savedBomb);
        }

        // APPLY SAVED UNLOCK OVERRIDES (Moved here to affect startLevel)
        try {
            const saved = localStorage.getItem('game_unlocks');
            if (saved) {
                const overrides = JSON.parse(saved);
                // Target keys might still be old format in storage, so we keep compatibility or just check new
                const targetKeys = [JSON_PATHS.GAME, 'game.json', '/json/game.json'];
                targetKeys.forEach(k => {
                    if (overrides[k]) {
                        log("Applying Unlock Overrides for:", k, overrides[k]);
                        gData = deepMerge(gData, overrides[k]);
                    }
                });
            }
        } catch (e) {
            console.error("Failed to apply saved unlocks", e);
        }

        // 2. Apply Permanent Unlocks to Default Loadout (Fix for Fresh Load/Refresh)
        if (!gData.gunType && gData.unlocked_peashooter) {
            gData.gunType = 'peashooter';
            log("Applying Unlocked Peashooter to Loadout");
        }
        if (!gData.bombType && gData.unlocked_bomb_normal) {
            gData.bombType = 'normal';
            log("Applying Unlocked Normal Bomb to Loadout");
        }

        // 3. Load Level Specific Data
        // Use nextLevel if provided, else check stored level (Restart/Continue), else defaults
        const storedLevel = localStorage.getItem('rogue_current_level');
        const levelFile = nextLevel || storedLevel || gData.startLevel;
        if (levelFile) {
            try {
                log("Loading Level:", levelFile);
                // Normalize path to prevent double prefixing
                let normalized = levelFile;
                if (normalized.startsWith('json/')) normalized = normalized.substring(5);
                if (normalized.startsWith('/json/')) normalized = normalized.substring(6);
                if (normalized.startsWith('/')) normalized = normalized.substring(1);

                const url = `${JSON_PATHS.ROOT}${normalized}`;
                const levelRes = await fetch(`${url}?t=${Date.now()}`);
                if (levelRes.ok) {
                    const levelData = await levelRes.json();

                    // AUTO-DETECT: If this file is a Room (has isBoss), ensure it's set as the bossRoom 
                    // so it gets loaded into templates correctly.
                    if (levelData.isBoss && !levelData.bossRoom) {
                        log("Level file identified as Boss Room. Setting bossRoom to self:", levelFile);
                        levelData.bossRoom = levelFile;
                        // Also force NoRooms to 1? Or let generation handle it?
                        // Usually boss levels are 1 room.
                        if (levelData.NoRooms === undefined) levelData.NoRooms = 1;
                    }

                    // Merge level data into game data (Level overrides Game)
                    gData = { ...gData, ...levelData };
                } else {
                    console.error("Failed to load level file:", gData.startLevel);
                }
            } catch (err) {
                console.error("Error parsing level file:", err);
            }
        }

        // 3. Load Manifests in Parallel
        const [manData, mData, itemMan] = await Promise.all([
            fetch(JSON_PATHS.MANIFESTS.PLAYERS + '?t=' + Date.now()).then(res => res.json()),
            fetch(JSON_PATHS.MANIFESTS.ROOMS + '?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] })),
            fetch(JSON_PATHS.MANIFESTS.ITEMS + '?t=' + Date.now()).then(res => res.json()).catch(() => ({ items: [] }))
        ]);



        Globals.gameData = gData;

        // --- SYNC DEBUG FLAGS FROM CONFIG ---
        if (Globals.gameData.debug) {
            DEBUG_FLAGS.START_BOSS = Globals.gameData.debug.startBoss ?? false;
            DEBUG_FLAGS.PLAYER = Globals.gameData.debug.player ?? true;
            DEBUG_FLAGS.GODMODE = Globals.gameData.debug.godMode ?? false;
            DEBUG_FLAGS.WINDOW = Globals.gameData.debug.windowEnabled ?? false;
            DEBUG_FLAGS.LOG = Globals.gameData.debug.log ?? false;

            if (Globals.gameData.debug.spawn) {
                DEBUG_FLAGS.SPAWN_ALL_ITEMS = Globals.gameData.debug.spawn.allItems ?? false;
                DEBUG_FLAGS.SPAWN_GUNS = Globals.gameData.debug.spawn.guns ?? false;
                DEBUG_FLAGS.SPAWN_BOMBS = Globals.gameData.debug.spawn.bombs ?? false;
                DEBUG_FLAGS.SPAWN_INVENTORY = Globals.gameData.debug.spawn.inventory ?? false;
                DEBUG_FLAGS.SPAWN_MODS_PLAYER = Globals.gameData.debug.spawn.modsPlayer ?? false;
                DEBUG_FLAGS.SPAWN_MODS_BULLET = Globals.gameData.debug.spawn.modsBullet ?? true;
            }
        }

        // Apply Debug UI state
        if (Globals.elements.debugPanel) Globals.elements.debugPanel.style.display = DEBUG_FLAGS.WINDOW ? 'flex' : 'none';
        if (Globals.elements.debugLog) Globals.elements.debugLog.style.display = DEBUG_FLAGS.LOG ? 'block' : 'none';
        if (Globals.elements.room) Globals.elements.room.style.display = DEBUG_FLAGS.WINDOW ? 'block' : 'none';

        // Populate Debug Dropdown (Fix)
        updateDebugEditor();

        Globals.roomManifest = mData;

        // LOAD STARTING ITEMS
        Globals.groundItems = [];
        if (itemMan && itemMan.items) {
            log("Loading Items Manifest:", itemMan.items.length);
            const itemPromises = itemMan.items.map(i =>
                fetch(`${JSON_PATHS.ROOT}rewards/items/${i}.json?t=` + Date.now()).then(r => r.json()).catch(e => {
                    console.error("Failed to load item:", i, e);
                    return null;
                })
            );
            const allItems = await Promise.all(itemPromises);
            window.allItemTemplates = allItems; // Expose for room drops

            // ENHANCE: Fetch color from target config
            await Promise.all(allItems.map(async (item) => {
                if (!item || !item.location) return;
                try {
                    const url = item.location.startsWith(JSON_PATHS.ROOT) ? item.location : `${JSON_PATHS.ROOT}${item.location}`;
                    const res = await fetch(`${url}?t=${Date.now()}`);
                    const config = await res.json();

                    // Check Top Level (Bombs/Modifiers) OR Bullet Level (Guns)
                    const color = config.colour || config.color ||
                        (config.Bullet && (config.Bullet.colour || config.Bullet.color));

                    if (color) {
                        item.colour = color;
                    }
                } catch (e) {
                    // console.warn("Could not load config for color:", item.name);
                }
            }));

            // Filter starters
            // Legacy: Previously spawned all 'starter:false' items.
            // NOW: Only spawn if DEBUG flag is set.
            // Filter starters
            // Legacy: Previously spawned all 'starter:false' items.
            // NOW: Spawn based on granular DEBUG flags.
            const starters = allItems.filter(i => {
                if (!i) return false;

                // 1. Explicitly enabled by ALL flag
                if (DEBUG_FLAGS.SPAWN_ALL_ITEMS) return true;

                // 2. Category Checks
                const isGun = i.type === 'gun';
                const isBomb = i.type === 'bomb';
                const isMod = i.type === 'modifier';
                const loc = (i.location || "").toLowerCase();

                // Inventory (Keys/Bombs/Consumables) - often identified by path or lack of "modifier" type?
                // Actually user defines them as type="modifier" usually. 
                // Let's look for "inventory" in path.
                const isInventory = isMod && loc.includes('inventory');

                // Player Mods (Stats, Shields)
                const isPlayerMod = isMod && loc.includes('modifiers/player') && !isInventory;

                // Bullet Mods (Homing, FireRate, etc)
                const isBulletMod = isMod && loc.includes('modifiers/bullets');

                if (DEBUG_FLAGS.SPAWN_GUNS && isGun) return true;
                if (DEBUG_FLAGS.SPAWN_BOMBS && isBomb) return true;
                if (DEBUG_FLAGS.SPAWN_INVENTORY && isInventory) return true;
                if (DEBUG_FLAGS.SPAWN_MODS_PLAYER && isPlayerMod) return true;
                if (DEBUG_FLAGS.SPAWN_MODS_BULLET && isBulletMod) return true;

                return false;
            });
            log(`Found ${allItems.length} total items. Spawning ${starters.length} floor items.`);

            // Spawn them in a row
            // Spawn them in a grid within safe margins
            const marginX = Globals.canvas.width * 0.2;
            const marginY = Globals.canvas.height * 0.2;
            const safeW = Globals.canvas.width - (marginX * 2);
            const itemSpacing = 80;
            const cols = Math.floor(safeW / itemSpacing);

            starters.forEach((item, idx) => {
                const c = idx % cols;
                const r = Math.floor(idx / cols);

                groundItems.push({
                    x: marginX + (c * itemSpacing) + (itemSpacing / 2),
                    y: marginY + (r * itemSpacing) + (itemSpacing / 2),
                    data: item,
                    roomX: 0,
                    roomY: 0,
                    // Add physics properties immediately
                    vx: 0, vy: 0,
                    solid: true, moveable: true, friction: 0.9, size: 15,
                    floatOffset: Math.random() * 100
                });
            });
            log(`Spawned ${starters.length} starter items.`);
        } else {
            log("No item manifest found!");
        }

        // Load all players
        Globals.availablePlayers = [];
        if (manData && manData.players) {
            const playerPromises = manData.players.map(p =>
                fetch(`/json/players/${p.file}?t=` + Date.now())
                    .then(res => res.json())
                    .then(data => ({ ...data, file: p.file })) // Keep file ref if needed
            );
            Globals.availablePlayers = await Promise.all(playerPromises);
        }

        // Default to first player
        if (Globals.availablePlayers.length > 0) {
            Globals.player = JSON.parse(JSON.stringify(Globals.availablePlayers[0]));
        } else {
            console.error("No players found!");
            Globals.player = { hp: 3, speed: 4, inventory: { keys: 0 }, gunType: 'geometry', bombType: 'normal' }; // Fallback
        }

        // Restore Stats if kept
        if (savedPlayerStats) {
            log("Restoring Full Player State");
            // Merge saved state OVER the default template
            // This ensures we keep new defaults if valid, but restore all our progress
            // Merge saved state OVER the default template (Deep Merge to preserve structure like inventory.maxKeys)
            deepMerge(Globals.player, savedPlayerStats);

            // Explicitly ensure criticals if missing (shouldn't happen with full clone)
            if (savedPlayerStats.perfectStreak !== undefined) {
                Globals.perfectStreak = savedPlayerStats.perfectStreak;
            }
        }

        // Apply Game Config Overrides
        // FIXED: Only override if we are NOT preserving stats (Fresh Start / Restart),
        // or if the stat was missing.
        if (Globals.gameData.gunType && !savedPlayerStats) {
            log("Applying gameData override for gunType:", Globals.gameData.gunType);
            Globals.player.gunType = Globals.gameData.gunType;
        }
        if (Globals.gameData.bombType && !savedPlayerStats) {
            log("Applying gameData override for bombType:", Globals.gameData.bombType);
            Globals.player.bombType = Globals.gameData.bombType;
        }

        // Load player specific assets
        let fetchedGun = null;
        let fetchedBomb = null;

        try {
            if (Globals.player.gunType) {
                const gunUrl = `/json/rewards/items/guns/player/${Globals.player.gunType}.json?t=` + Date.now();
                const gRes = await fetch(gunUrl);
                if (gRes.ok) {
                    fetchedGun = await gRes.json();
                    if (fetchedGun.location) {
                        let loc = fetchedGun.location;
                        if (loc.startsWith('items/')) loc = 'rewards/' + loc;
                        const realRes = await fetch(`${JSON_PATHS.ROOT}${loc}?t=` + Date.now());
                        if (realRes.ok) fetchedGun = await realRes.json();
                    }
                } else console.error("Gun fetch failed:", gRes.status, gRes.statusText);
            } else {
                log("No player.gunType defined, skipping initial fetch.");
            }
        } catch (e) { console.error("Gun fetch error:", e); }

        if (!fetchedGun && !savedPlayerStats) {
            log("Attempting fallback to 'peashooter'...");
            try {
                const res = await fetch(`/json/rewards/items/guns/player/peashooter.json?t=` + Date.now());
                if (res.ok) {
                    fetchedGun = await res.json();
                    if (fetchedGun.location) {
                        // Normalize location path
                        let loc = fetchedGun.location;
                        if (loc.startsWith('items/')) loc = 'rewards/' + loc;
                        const realRes = await fetch(`${JSON_PATHS.ROOT}${loc}?t=` + Date.now());
                        if (realRes.ok) fetchedGun = await realRes.json();
                    }
                    player.gunType = 'peashooter'; // Update player state
                }
            } catch (e) { }
        }

        const bombUrl = Globals.player.bombType ? `/json/rewards/items/bombs/${Globals.player.bombType}.json?t=` + Date.now() : null;
        if (bombUrl) {
            try {
                const bRes = await fetch(bombUrl);
                if (bRes.ok) {
                    fetchedBomb = await bRes.json();
                    if (fetchedBomb.location) {
                        let loc = fetchedBomb.location;
                        if (loc.startsWith('items/')) loc = 'rewards/' + loc;
                        const realRes = await fetch(`${JSON_PATHS.ROOT}${loc}?t=` + Date.now());
                        if (realRes.ok) fetchedBomb = await realRes.json();
                    }
                }
            } catch (e) { }
        }

        if (!fetchedGun) {
            console.error("CRITICAL: Could not load ANY gun. Player will be unarmed.");
            Globals.gun = { Bullet: { NoBullets: true } };
            spawnFloatingText(canvas.width / 2, canvas.height / 2, "ERROR: GUN LOAD FAILED", "red");
        } else {
            Globals.gun = fetchedGun;
            log("Loaded Gun Data:", Globals.gun.name);
        }
        Globals.bomb = fetchedBomb || {};

        // SAVE BASE LOADOUT (For Resets/Deaths)
        // Only save if NOT already saved, to preserve the true "starting" weapon
        if (!savedPlayerStats && !isRestart) {
            if (!localStorage.getItem('base_gun') && Globals.player.gunType) {
                localStorage.setItem('base_gun', Globals.player.gunType);
                log("Saved Base Gun:", Globals.player.gunType);
            }
            if (!localStorage.getItem('base_bomb') && Globals.player.bombType) {
                localStorage.setItem('base_bomb', Globals.player.bombType);
                log("Saved Base Bomb:", Globals.player.bombType);
            }
        }

        if (Globals.gameData.music) {
            // --- 1. INSTANT AUDIO SETUP ---
            // Ensure global audio is ready
            introMusic.loop = true;
            introMusic.volume = 0.4;

            // This attempts to play immediately.
            // If the browser blocks it, the 'keydown' listener below will catch it.
            if (!Globals.musicMuted) {
                introMusic.play().catch(() => {
                    log("Autoplay blocked: Waiting for first user interaction to start music.");
                });
            }

            // Fallback: Start music on the very first key press or click if autoplay failed
            const startAudio = () => {
                if (introMusic.paused && !Globals.musicMuted) fadeIn(introMusic, 5000);
                if (Globals.audioCtx.state === 'suspended') Globals.audioCtx.resume();
                window.removeEventListener('keydown', startAudio);
                window.removeEventListener('mousedown', startAudio);
            };
            window.addEventListener('keydown', startAudio);
            window.addEventListener('mousedown', startAudio);
        }

        // Init Menu UI
        if (!isRestart) updateWelcomeScreen();
        // Initialize Ammo
        if (gun.Bullet?.ammo?.active) {
            player.ammoMode = gun.Bullet?.ammo?.type || 'finite'; // 'finite', 'reload', 'recharge'
            player.maxMag = gun.Bullet?.ammo?.amount || 100; // Clip size
            // Handle resetTimer being 0 or undefined, treat as 0 if finite, but if reload/recharge usually non-zero.
            // But if user sets resetTimer to 0, it instant reloads?
            player.reloadTime = gun.Bullet?.ammo?.resetTimer !== undefined ? gun.Bullet?.ammo?.resetTimer : (gun.Bullet?.ammo?.reload || 1000);

            // Initial State
            player.ammo = player.maxMag;
            player.reloading = false;

            // Reserve Logic
            if (player.ammoMode === 'reload') {
                // Magazine Mode: maxAmount is total reserve
                player.reserveAmmo = (gun.Bullet?.ammo?.maxAmount || 0) - player.maxMag;
                if (player.reserveAmmo < 0) player.reserveAmmo = 0;
            } else if (player.ammoMode === 'recharge') {
                // Recharge Mode: Infinite reserve
                player.reserveAmmo = Infinity;
            } else {
                // Finite Mode: No reserve
                player.reserveAmmo = 0;
            }
        }



        // 4. Load Room Templates (Dynamic from Level Data)
        Globals.roomTemplates = {};
        const roomProtos = [];

        // Helper to load a room file
        const loadRoomFile = (path, type) => {
            if (!path || path.trim() === "") return Promise.resolve();
            // Handle relative paths from JSON (e.g. "rooms/start.json")
            // Ensure we don't double stack "json/" if valid path provided
            const url = path.startsWith('http') || path.startsWith('/') || path.startsWith('json/') ? path : `json/${path}`;
            return fetch(url + '?t=' + Date.now())
                .then(res => {
                    if (!res.ok) throw new Error("404");
                    return res.json();
                })
                .then(data => {
                    // ID Generation: Handle "room.json" collision
                    const parts = path.split('/');
                    let id = parts[parts.length - 1].replace('.json', '');
                    if (id === 'room' && parts.length > 1) {
                        id = parts[parts.length - 2]; // Use folder name (e.g. "boss4", "start")
                    }

                    data.templateId = id;
                    // Tag it
                    if (type) data._type = type;

                    // Store
                    // Store
                    Globals.roomTemplates[id] = data;
                    // Also store by full path just in case
                    Globals.roomTemplates[path] = data;
                    log(`Loaded Room: ${id} (${type || 'normal'})`);
                })
                .catch(err => console.error(`Failed to load room: ${path}`, err));
        };

        // A. Standard Rooms
        let available = Globals.gameData.avalibleroons || Globals.gameData.availablerooms || [];
        available = available.filter(p => p && p.trim() !== "");
        // If empty, fallback to manifest?
        // ONE CHECK: Only fallback if we DON'T have a startRoom/bossRoom config
        // meaning we are truly in a "default game" state, not a specific level file state.
        if (available.length === 0 && !Globals.gameData.startRoom && !Globals.gameData.bossRoom) {
            // FALLBACK: Load from old manifest
            try {
                const m = await fetch(JSON_PATHS.MANIFESTS.ROOMS + '?t=' + Date.now()).then(res => res.json());
                if (m.rooms) {
                    m.rooms.forEach(r => roomProtos.push(loadRoomFile(`rooms/${r}/room.json`, 'normal')));
                    // Also try to load start/boss legacy
                    roomProtos.push(loadRoomFile(JSON_PATHS.DEFAULTS.START_ROOM, 'start'));
                    roomProtos.push(loadRoomFile(JSON_PATHS.DEFAULTS.BOSS_ROOM, 'boss'));
                }
            } catch (e) { console.warn("No legacy manifest found"); }
        } else {
            available.forEach(path => roomProtos.push(loadRoomFile(path, 'normal')));
        }

        // C. Explicit Start Room
        if (Globals.gameData.startRoom) {
            roomProtos.push(loadRoomFile(Globals.gameData.startRoom, 'start'));
        }

        // B. Boss Rooms
        let bosses = Globals.gameData.bossrooms || [];
        // Support singular 'bossRoom' fallback
        if (Globals.gameData.bossRoom && Globals.gameData.bossRoom.trim() !== "") {
            bosses.push(Globals.gameData.bossRoom);
        }
        bosses = bosses.filter(p => p && p.trim() !== "");
        bosses.forEach(path => roomProtos.push(loadRoomFile(path, 'boss')));



        await Promise.all(roomProtos);

        // 4. Pre-load ALL enemy templates
        Globals.enemyTemplates = {};
        const enemyManifest = await fetch('json/enemies/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ enemies: [] }));
        const ePromises = enemyManifest.enemies.map(id =>
            fetch(`json/enemies/${id}.json?t=` + Date.now())
                .then(res => res.json())
                .then(data => {
                    // Use the last part of the path as the key (e.g. "special/firstboss" -> "firstboss")
                    const key = id.split('/').pop();
                    Globals.enemyTemplates[key] = data;
                })
        );
        await Promise.all(ePromises);

        // 5. Generate Level
        const urlParams = new URLSearchParams(window.location.search);
        const isDebugRoom = urlParams.get('debugRoom') === 'true';
        DEBUG_FLAGS.TEST_ROOM = isDebugRoom;

        if (DEBUG_FLAGS.START_BOSS) {
            Globals.bossCoord = "0,0";
            Globals.goldenPath = ["0,0"];
            Globals.bossIntroEndTime = Date.now() + 2000;
            Globals.levelMap["0,0"] = { roomData: JSON.parse(JSON.stringify(Globals.roomTemplates["boss"])), cleared: false };
        }
        else if (isDebugRoom) {
            // --- EDITOR TEST ROOM BYPASS ---
            try {
                const debugJson = localStorage.getItem('debugRoomData');
                if (debugJson) {
                    const debugData = JSON.parse(debugJson);

                    bossCoord = "0,0";
                    goldenPath = ["0,0"];
                    levelMap["0,0"] = { roomData: debugData, cleared: false }; // Directly inject into map

                    // Force Skip Welcome
                    Globals.gameData.showWelcome = false;
                } else {
                    console.error("No debugRoomData found in localStorage");
                    generateLevel(Globals.gameData.NoRooms !== undefined ? Globals.gameData.NoRooms : 11);
                }
            } catch (e) {
                console.error("Failed to load test room", e);
                generateLevel(Globals.gameData.NoRooms !== undefined ? Globals.gameData.NoRooms : 11);
            }
        }
        else if (nextLevel && (Globals.gameData.tiles || Globals.gameData.enemies)) {
            console.log("Single Room Mode Detected via nextLevel");
            Globals.bossCoord = "0,0";
            Globals.goldenPath = ["0,0"];
            // Use gData as the room source since nextLevel was merged into it
            Globals.levelMap["0,0"] = { roomData: JSON.parse(JSON.stringify(Globals.gameData)), cleared: false };
        }
        else {
            generateLevel(Globals.gameData.NoRooms !== undefined ? Globals.gameData.NoRooms : 11);
        }

        const startEntry = Globals.levelMap["0,0"];
        Globals.roomData = startEntry.roomData;
        Globals.visitedRooms["0,0"] = startEntry;

        // If we loaded a specific room/level (via nextLevel or debug), we need to ensure enemies are spawned
        // generateLevel usually handles this for procedural levels, but here we might be bypassing it.
        // We need to re-trigger spawnEnemies for the current room if it wasn't done.
        // CHECK: generateLevel populates the map. If we injected "0,0" manually (debug), we need to spawn.
        if (nextLevel || isDebugRoom || DEBUG_FLAGS.START_BOSS) {
            console.log("Debug/Direct Load: Spawning Enemies for 0,0");
            spawnEnemies(Globals.roomData);
        }

        // MATRIX ROOM: Spawn ALL Items
        if (Globals.roomData.item && Globals.roomData.item.matrix) {
            console.log("MATRIX ROOM DETECTED: Spawning all items...");
            const items = window.allItemTemplates || Globals.itemTemplates || [];
            if (items.length > 0) {
                const cols = 10; // Items per row
                const spacing = 50;
                const startX = 100;
                const startY = 100;

                // Prevent overlap: Clear existing items in this room 0,0 first? 
                // Or just clear all ground items if this is a "Matrix Mode" load
                Globals.groundItems = Globals.groundItems.filter(i => i.roomX !== (Globals.roomData.x || 0) || i.roomY !== (Globals.roomData.y || 0));

                items.forEach((itemTemplate, idx) => {
                    if (!itemTemplate) return;

                    const col = idx % cols;
                    const row = Math.floor(idx / cols);

                    Globals.groundItems.push({
                        x: startX + (col * spacing),
                        y: startY + (row * spacing),
                        data: JSON.parse(JSON.stringify(itemTemplate)),
                        roomX: Globals.roomData.x || 0, // Should be 0,0 locally
                        roomY: Globals.roomData.y || 0,
                        vx: 0, vy: 0,
                        solid: true, moveable: true, friction: 0.9, size: 15,
                        floatOffset: Math.random() * 100
                    });
                });
                console.log(`Spawned ${items.length} items for Matrix Room.`);

                // Move Player to Safe Spot (Bottom Center)
                if (Globals.player) {
                    Globals.player.x = 400;
                    Globals.player.y = 500;
                    console.log("Moved player to safe spot (400, 500) for Matrix Mode.");
                }
            }
        }

        Globals.canvas.width = Globals.roomData.width || 800;
        Globals.canvas.height = Globals.roomData.height || 600;

        // if (gameState === STATES.PLAY) { spawnEnemies(); ... } 
        // Logic removed: startGame() handles spawning now.

        if (!Globals.gameLoopStarted) {
            Globals.gameLoopStarted = true;
            draw();
        }

        // AUTO START IF CONFIGURED (After everything is ready)
    } finally {
        Globals.isInitializing = false;
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        // AUTO START IF CONFIGURED (After everything is ready)
        // Moved here to ensure isInitializing is false before starting
        // AUTO START IF CONFIGURED (After everything is ready)
        // Moved here to ensure isInitializing is false before starting
        const params = new URLSearchParams(window.location.search);
        const shouldAutoStart = Globals.gameData.showWelcome === false || isRestart || params.get('autostart') === 'true';

        console.log("TRACER: initGame End. shouldAutoStart=", shouldAutoStart);

        if (shouldAutoStart) {
            // Pass savedPlayerStats existence as keepState flag
            startGame((savedPlayerStats && Object.keys(savedPlayerStats).length > 0) ? true : false);
        } else {
            // Manual Start (Show Welcome)
            log("Waiting for user input (Welcome Screen)...");
            Globals.gameState = STATES.START;
            Globals.elements.welcome.style.display = 'flex';
            updateWelcomeScreen();
        }
        window.startGame = startGame;
    }
}
export function startGame(keepState = false) {
    // Force Audio Resume on User Interaction
    if (Globals.audioCtx.state === 'suspended') Globals.audioCtx.resume();

    // Guard against starting while Initializing or Unlocking or already starting
    console.log("TRACER: startGame Called");
    if (Globals.gameState === STATES.PLAY || Globals.isGameStarting || Globals.isInitializing || Globals.isUnlocking) return;
    Globals.isGameStarting = true;

    // Check Lock
    const p = Globals.availablePlayers[Globals.selectedPlayerIndex];

    if (p && p.locked) {
        log("Player Locked - Cannot Start");
        Globals.isGameStarting = false;
        return;
    }

    // Show Loading Screen immediately to block input/visuals
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    Globals.elements.welcome.style.display = 'none';

    // Apply Selected Player Stats
    // IF keepState is true, we assume player object is already correctly set (loaded or preserved)
    if (!keepState && p) {
        // Apply stats but keep runtime properties like x/y if needed (though start resets them)
        // Actually initGame reset player.x/y already.
        const defaults = { x: 300, y: 200, roomX: 0, roomY: 0 };
        Globals.player = { ...defaults, ...JSON.parse(JSON.stringify(p)) };
        if (!Globals.player.maxHp) Globals.player.maxHp = Globals.player.hp || 3;
        if (!Globals.player.inventory) Globals.player.inventory = { keys: 0, bombs: 0 };

        // RE-APPLY GameOverrides (Fixed: startGame was wiping initGame overrides)
        if (Globals.gameData.gunType) Globals.player.gunType = Globals.gameData.gunType;
        if (Globals.gameData.bombType) Globals.player.bombType = Globals.gameData.bombType;

        // RESTORE RED SHARDS (Fix: startGame wiped initGame sync)
        const storedRed = localStorage.getItem('currency_red');
        if (storedRed && Globals.player.inventory) {
            Globals.player.inventory.redShards = parseInt(storedRed);
            Globals.player.redShards = parseInt(storedRed); // Sync legacy too
        }
    }

    // Async Load Assets then Start
    // Async Load Assets then Start
    (async () => {
        try {
            // FIXED: Only fetch weapons if NOT preserving state. 
            // If keepState is true, 'gun' and 'bomb' globals retain their runtime modifications (upgrades).
            if (!keepState) {
                const [gData, bData] = await Promise.all([
                    (async () => {
                        try {
                            const cachedGun = localStorage.getItem('current_gun_config');
                            if (cachedGun) return JSON.parse(cachedGun);
                        } catch (e) { }

                        return Globals.player.gunType ? fetch(`/json/rewards/items/guns/player/${Globals.player.gunType}.json?t=` + Date.now())
                            .then(res => res.json())
                            .then(async (data) => {
                                if (data.location) {
                                    const realRes = await fetch(`json/${data.location}?t=` + Date.now());
                                    if (realRes.ok) return await realRes.json();
                                }
                                return data;
                            })
                            : Promise.resolve({ Bullet: { NoBullets: true } });
                    })(),
                    (async () => {
                        try {
                            const cachedBomb = localStorage.getItem('current_bomb_config');
                            if (cachedBomb) return JSON.parse(cachedBomb);
                        } catch (e) { }

                        return Globals.player.bombType ? fetch(`/json/rewards/items/bombs/${Globals.player.bombType}.json?t=` + Date.now())
                            .then(res => res.json())
                            .then(async (data) => {
                                if (data.location) {
                                    const realRes = await fetch(`json/${data.location}?t=` + Date.now());
                                    if (realRes.ok) return await realRes.json();
                                }
                                return data;
                            })
                            : Promise.resolve({});
                    })()

                ]);
                Globals.gun = gData;
                Globals.bomb = bData;
            } else {
                log("Keeping existing Weapon State (Gun/Bomb globals preserved)");
            }

            if (loadingEl) loadingEl.style.display = 'none'; // Hide loading when done


            // Initialize Ammo for new gun (Only if NOT keeping state or if we swapped guns?)
            // If keeping state, ammo should be preserved.
            if (!keepState && Globals.gun.Bullet?.ammo?.active) {
                Globals.player.ammoMode = Globals.gun.Bullet?.ammo?.type || 'finite';
                Globals.player.maxMag = Globals.gun.Bullet?.ammo?.amount || 100;
                Globals.player.reloadTime = Globals.gun.Bullet?.ammo?.resetTimer !== undefined ? Globals.gun.Bullet?.ammo?.resetTimer : (Globals.gun.Bullet?.ammo?.reload || 1000);
                Globals.player.ammo = Globals.player.maxMag;
                Globals.player.reloading = false;
                Globals.player.reserveAmmo = (Globals.player.ammoMode === 'reload') ? ((Globals.gun.Bullet?.ammo?.maxAmount || 0) - Globals.player.maxMag) : (Globals.gun.Bullet?.ammo?.recharge ? Infinity : 0);
                if (Globals.player.reserveAmmo < 0) Globals.player.reserveAmmo = 0;
            }

            // Start Game
            console.log("TRACER: startGame Async End -> PLAY");
            Globals.gameState = STATES.PLAY;
            Globals.elements.welcome.style.display = 'none';

            if (Globals.elements.ui) {
                // Manage UI Components Independently
                Globals.elements.overlay.style.display = 'none'; // Ensure Game Over screen is hidden

                // Show Parent UI Container
                Globals.elements.ui.style.display = 'block';

                const statsPanel = document.getElementById('stats-panel');
                if (statsPanel) statsPanel.style.display = (Globals.gameData.showUI !== false) ? 'block' : 'none';
            }     // Show Level Title
            if (Globals.gameData.name) {
                showLevelTitle(Globals.gameData.name);
            }

            // Minimap Visibility
            if (Globals.mapCanvas) Globals.mapCanvas.style.display = (Globals.gameData.showMinimap !== false) ? 'block' : 'none';

            // If starting primarily in Boss Room (Debug Mode), reset intro timer
            if (Globals.roomData.isBoss) {
                Globals.bossIntroEndTime = Date.now() + 2000;
            }

            spawnEnemies();

            // Check for Start Room Bonus (First Start)
            if (Globals.gameData.rewards && Globals.gameData.rewards.startroom) {
                const dropped = spawnRoomRewards(Globals.gameData.rewards.startroom);
                if (dropped) {
                    Globals.elements.perfect.innerText = "START BONUS!";
                    triggerPerfectText();
                }
            }

            renderDebugForm();
            updateUI();
        } catch (err) {
            console.error("Error starting game assets:", err);
            // Re-show welcome if failed so user can try again
            Globals.elements.welcome.style.display = 'flex';
            Globals.isGameStarting = false;
        } finally {
            Globals.isGameStarting = false;
        }
    })();
}
// Position player on opposite side of door (exactly on the boundary and centered on the DOOR)
export function spawnPlayer(dx, dy, data) {
    let requiredDoor = null;
    if (dx === 1) requiredDoor = "left";
    if (dx === -1) requiredDoor = "right";
    if (dy === 1) requiredDoor = "top";
    if (dy === -1) requiredDoor = "bottom";

    const door = (data.doors && data.doors[requiredDoor]) || { x: (data.width || 800) / 2, y: (data.height || 600) / 2 };

    // Use a safe offset > the door trigger threshold (t=50)
    const SAFE_OFFSET = 70; // Must be > 50

    if (dx === 1) {
        Globals.player.x = BOUNDARY + SAFE_OFFSET;
        Globals.player.y = door.y !== undefined ? door.y : (data.height || 600) / 2;
    }
    if (dx === -1) {
        Globals.player.x = (data.width || 800) - BOUNDARY - SAFE_OFFSET;
        Globals.player.y = door.y !== undefined ? door.y : (data.height || 600) / 2;
    }
    if (dy === 1) {
        Globals.player.y = BOUNDARY + SAFE_OFFSET;
        Globals.player.x = door.x !== undefined ? door.x : (data.width || 800) / 2;
    }
    if (dy === -1) {
        Globals.player.y = (data.height || 600) - BOUNDARY - SAFE_OFFSET;
        Globals.player.x = door.x !== undefined ? door.x : (data.width || 800) / 2;
    }
    // --- LATE BINDING: LORE & SPEECH & ANGRY MODE ---
    Globals.enemies.forEach(en => {
        // 1. Generate Lore if missing
        if (!en.lore && Globals.loreData) {
            en.lore = generateLore(en);
        }

        // 2. Global Angry Mode (Boss Killed)w
        if (Globals.bossKilled) {
            // Ghosts do NOT get angry
            if (en.type === 'ghost') return;

            en.mode = 'angry';
            en.alwaysAngry = true;
            en.angryUntil = Infinity;

            // Apply Angry Stats immediately
            const angryStats = gameData.enemyConfig?.modeStats?.angry;
            if (angryStats) {
                if (angryStats.damage) en.damage = (en.baseStats?.damage || en.damage || 1) * angryStats.damage;
                if (angryStats.speed) en.speed = (en.baseStats?.speed || en.speed || 1) * angryStats.speed;
                if (angryStats.color) en.color = angryStats.color;
            }
        }
    });
}

export function changeRoom(dx, dy) {
    // Save cleared status of current room before leaving
    const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`;
    if (Globals.levelMap[currentCoord]) {
        // FILTER: Save only valid, living enemies (skip ghosts, dead, friendly)
        const survivors = Globals.enemies.filter(en => !en.isDead && en.type !== 'ghost' && en.ownerType !== 'player');

        // If enemies remain, save their state
        if (survivors.length > 0) {
            Globals.levelMap[currentCoord].savedEnemies = survivors.map(en => ({
                templateId: en.templateId, // Save the Lookup Key
                type: en.type,
                x: en.x,
                y: en.y,
                hp: en.hp,
                maxHp: en.maxHp, // If applicable
                moveType: en.moveType,
                solid: en.solid,
                indestructible: en.indestructible,
                // Add other necessary props if dynamic (e.g. specialized gun config? usually static)
            }));
            Globals.levelMap[currentCoord].cleared = false;
        } else {
            // No survivors? Room is cleared.
            Globals.levelMap[currentCoord].savedEnemies = null;
            Globals.levelMap[currentCoord].cleared = true;
        }

        // SAVE BOMBS
        // Only save unexploded bombs. We save absolute 'explodeAt' so time passes while away.
        const activeBombs = Globals.bombs.filter(b => !b.exploded && b.explodeAt > Date.now());
        if (activeBombs.length > 0) {
            Globals.levelMap[currentCoord].savedBombs = activeBombs.map(b => ({
                x: b.x, y: b.y,
                explodeAt: b.explodeAt, // Save Absolute Time
                maxTimer: b.maxTimer,
                damage: b.damage, radius: b.radius,
                color: b.color,
                ownerType: b.ownerType,
                vx: b.vx || 0, vy: b.vy || 0,
                // Visual Properties
                type: b.type,
                timerShow: b.timerShow,
                image: b.image, // If it has an image
                canInteract: b.canInteract,
                openLockedDoors: b.openLockedDoors,
                openRedDoors: b.openRedDoors,
                openSecretRooms: b.openSecretRooms,
                baseR: b.baseR, maxR: b.maxR,
                explosionDuration: b.explosionDuration
            }));
            log(`Saved ${activeBombs.length} bombs in ${currentCoord}`);
        } else {
            Globals.levelMap[currentCoord].savedBombs = null;
        }

        // SAVE ITEMS (Ground Items)
        if (Globals.groundItems && Globals.groundItems.length > 0) {
            Globals.levelMap[currentCoord].savedItems = Globals.groundItems.map(i => ({
                x: i.x, y: i.y,
                type: i.type,
                name: i.name,
                data: i.data,
                vx: i.vx, vy: i.vy,
                color: i.color,
                pickupCooldown: i.pickupCooldown
            }));
            log(`Saved ${Globals.groundItems.length} items in ${currentCoord}`);
        } else {
            Globals.levelMap[currentCoord].savedItems = null;
        }
    }

    // Reset Room Specific Flags
    Globals.player.tookDamageInRoom = false;

    // Check if door was locked or recently unlocked by a key
    let doorUsed = null;
    if (dx === 1) doorUsed = "right";
    if (dx === -1) doorUsed = "left";
    if (dy === 1) doorUsed = "bottom";
    if (dy === -1) doorUsed = "top";

    let keyWasUsedForThisRoom = false;
    if (doorUsed && Globals.roomData.doors && Globals.roomData.doors[doorUsed]) {
        if (Globals.roomData.doors[doorUsed].unlockedByKey) {
            keyWasUsedForThisRoom = true;
        }
    }

    Globals.player.roomX += dx;
    Globals.player.roomY += dy;
    const nextCoord = `${Globals.player.roomX},${Globals.player.roomY}`;

    // --- GOLDEN PATH LOGIC ---
    if (nextCoord === "0,0") {
        // Reset if back at start
        Globals.goldenPathIndex = 0;
        Globals.goldenPathFailed = false;
        log("Returned to Start.  Golden Path Reset.");
    } else if (!Globals.goldenPathFailed) {
        // Check if this is the next step in the path
        // path[0] is "0,0". path[1] is the first real step.
        // We want to be at path[goldenPathIndex + 1]
        const expectedCoord = Globals.goldenPath[Globals.goldenPathIndex + 1];

        if (nextCoord === expectedCoord) {
            Globals.goldenPathIndex++;
            log("Golden Path Progress:", Globals.goldenPathIndex);
        } else if (Globals.goldenPath.includes(nextCoord) && Globals.goldenPath.indexOf(nextCoord) <= Globals.goldenPathIndex) {
            // Just backtracking along the known path, do nothing
        } else {
            // Deviated!
            Globals.goldenPathFailed = true;
            log("Golden Path FAILED. Return to start to reset.");
        }
    }

    Globals.bullets = []; // Clear bullets on room entry
    Globals.bombs = []; // Clear bombs on room entry
    Globals.groundItems = []; // Clear items on room entry (Fix persistence bug)

    // RESTORE BOMBS
    if (Globals.levelMap[nextCoord] && Globals.levelMap[nextCoord].savedBombs) {
        const now = Date.now();
        Globals.levelMap[nextCoord].savedBombs.forEach(sb => {
            // "Keep Ticking" Logic:
            // If the bomb exploded while we were away (now > explodeAt), do NOT restore it.
            // (Or restore it as exploding? Usually better to just assume it's gone)
            if (now > sb.explodeAt) {
                // SIMULATED EXPLOSION
                // The bomb exploded while we were away. Check if it should have hit any doors.
                // We need to access the doors of the room we are ABOUT to enter.
                // Fortunately, we can access levelMap[nextCoord].roomData
                const targetRoom = Globals.levelMap[nextCoord].roomData;
                if (targetRoom && targetRoom.doors) {
                    // Check Logic similar to drawBombs collision
                    Object.entries(targetRoom.doors).forEach(([dir, door]) => {
                        let dX = door.x ?? (targetRoom.width || 800) / 2;
                        let dY = door.y ?? (targetRoom.height || 600) / 2;
                        if (dir === 'top') dY = 0; if (dir === 'bottom') dY = (targetRoom.height || 600);
                        if (dir === 'left') dX = 0; if (dir === 'right') dX = (targetRoom.width || 800);

                        // Max Radius (approximate if stored, else default)
                        const maxR = sb.maxR || 100;
                        if (Math.hypot(sb.x - dX, sb.y - dY) < maxR + 30) {
                            if (sb.openLockedDoors && door.locked) {
                                door.locked = 0;
                                log(`Simulated Explosion: Unlocked ${dir} door`);
                            }
                            if (sb.openRedDoors) {
                                door.forcedOpen = true;
                                log(`Simulated Explosion: Blew open ${dir} red door`);
                            }
                            if (sb.openSecretRooms && door.hidden) {
                                door.hidden = false;
                                door.active = true;
                                log(`Simulated Explosion: Revealed ${dir} secret door`);
                            }
                        }
                    });
                }
                return;
            }

            Globals.bombs.push({
                x: sb.x, y: sb.y,
                explodeAt: sb.explodeAt, // Restore absolute
                maxTimer: sb.maxTimer,
                damage: sb.damage, radius: sb.radius,
                color: sb.color,
                ownerType: sb.ownerType,
                vx: sb.vx, vy: sb.vy,
                exploded: false,
                // Restore Visuals & Props
                type: sb.type,
                timerShow: sb.timerShow,
                image: sb.image,
                canInteract: sb.canInteract,
                openLockedDoors: sb.openLockedDoors,
                openRedDoors: sb.openRedDoors,
                openSecretRooms: sb.openSecretRooms,
                baseR: sb.baseR || 15, maxR: sb.maxR || 100,
                explosionDuration: sb.explosionDuration || 300
            });
        });
        log(`Restored ${Globals.bombs.length} bombs in ${nextCoord}`);
    }

    // RESTORE ITEMS
    if (Globals.levelMap[nextCoord] && Globals.levelMap[nextCoord].savedItems) {
        Globals.levelMap[nextCoord].savedItems.forEach(si => {
            Globals.groundItems.push(si);
        });
        log(`Restored ${Globals.levelMap[nextCoord].savedItems.length} items for ${nextCoord}`);
    }

    // Check if Ghost should follow
    const ghostConfig = Globals.gameData.ghost || { spawn: true, roomGhostTimer: 10000, roomFollow: false };
    const activeGhost = Globals.enemies.find(e => e.type === 'ghost' && !e.isDead);
    const shouldFollow = Globals.ghostSpawned && ghostConfig.roomFollow && activeGhost;

    // Calculate Travel Time relative to the door we are exiting
    let travelTime = 0;
    if (shouldFollow) {
        // Determine exit door coordinates (where player is going)
        let doorX = Globals.player.x, doorY = Globals.player.y;
        if (dx === 1) { doorX = Globals.canvas.width; doorY = Globals.canvas.height / 2; } // Right
        else if (dx === -1) { doorX = 0; doorY = Globals.canvas.height / 2; } // Left
        else if (dy === 1) { doorX = Globals.canvas.width / 2; doorY = Globals.canvas.height; } // Bottom
        else if (dy === -1) { doorX = Globals.canvas.width / 2; doorY = 0; } // Top

        const dist = Math.hypot(activeGhost.x - doorX, activeGhost.y - doorY);
        // Speed ~1.2px/frame @ 60fps ~ 0.072px/ms -> ms = dist / 0.072 = dist * 13.8
        travelTime = dist * 14;
        log(`Ghost chasing! Distance: ${Math.round(dist)}, Travel Delay: ${Math.round(travelTime)}ms`);
    }

    Globals.ghostSpawned = false; // Reset Ghost flag (will respawn via timer hack if following)
    Globals.bulletsInRoom = 0;
    Globals.hitsInRoom = 0;
    Globals.elements.perfect.style.display = 'none';

    // Transition to the pre-generated room
    const nextEntry = Globals.levelMap[nextCoord];
    if (nextEntry) {
        Globals.roomData = nextEntry.roomData;
        Globals.visitedRooms[nextCoord] = nextEntry; // Add to visited for minimap

        Globals.elements.roomName.innerText = Globals.roomData.name || "Unknown Room";
        Globals.canvas.width = Globals.roomData.width || 800;
        Globals.canvas.height = Globals.roomData.height || 600;

        spawnPlayer(dx, dy, Globals.roomData);

        // REMOVE OLD FREEZE LOGIC
        // let freezeDelay = (player.roomX === 0 && player.roomY === 0) ? 0 : 1000;
        // if (roomData.isBoss) freezeDelay = 2000;

        // NEW ROOM FREEZE MECHANIC
        // "freezeTimer" config (default 2000ms), applies to Player Invuln AND Enemy Freeze
        const freezeDuration = (Globals.gameData.room && Globals.gameData.room.freezeTimer) ? Globals.gameData.room.freezeTimer : 2000;

        // Skip freeze only for very first start room if desired (optional, maybe keep it consistent)
        // const actualDuration = (player.roomX === 0 && player.roomY === 0) ? 0 : freezeDuration;
        const actualDuration = freezeDuration; // Use config consistently

        const now = Date.now();
        Globals.roomFreezeUntil = now + actualDuration;
        Globals.player.invulnUntil = Globals.roomFreezeUntil;
        Globals.roomStartTime = Globals.roomFreezeUntil; // Ghost timer starts AFTER freeze ends

        log(`Room Freeze Active: ${actualDuration}ms (Enemies Frozen, Player Invulnerable)`);

        // GHOST FOLLOW LOGIC
        // If ghost was chasing and follow is on, fast-forward the timer so he appears immediately
        if (shouldFollow && !(Globals.player.roomX === 0 && Globals.player.roomY === 0) && !Globals.roomData.isBoss) {
            log("The Ghost follows you...");
            // Trigger time = desired spawn time
            // roomStartTime = Now - (ConfigTime - TravelTime)
            // Example: Config=10s, Travel=2s. We want spawn in 2s.
            // Timer checks: (Now - Start) > 10s.
            // (Now - Start) should start at 8s.
            // Start = Now - 8s = Now - (10s - 2s).
            // We add 100ms buffer to ensure it triggers after the frame update
            // Actually, if we want it to spawn AFTER travel time, we set the accumulator to (Target - Travel).

            const timeAlreadyElapsed = ghostConfig.roomGhostTimer - travelTime;
            // Clamp so we don't wait forever if travel is huge (max delay 3x timer?) or negative?
            // If travelTime > ghostTimer, timeAlreadyElapsed is negative, so we wait longer than usual. Correct.

            Globals.roomStartTime = Date.now() - timeAlreadyElapsed;

            // Set Ghost Entry Point (The door we just came through)
            // Player is currently AT the door (spawnPlayer just ran)
            Globals.ghostEntry = {
                x: Globals.player.x,
                y: Globals.player.y,
                vx: dx * 2, // Move in the same direction player entered
                vy: dy * 2
            };
        } else {
            // ghostConfig local variable from earlier? Or was it gameData.ghost?
            // "ghostConfig" was defined earlier in changeRoom as local.
            // But ghostEntry is Global.
            Globals.ghostEntry = null;
        }

        const keyUsedForRoom = keyWasUsedForThisRoom; // Apply key usage penalty to next room

        // Immediate Room Bonus if key used
        // Immediate Room Bonus if key used (First visit only)
        if (keyUsedForRoom && !Globals.levelMap[nextCoord].bonusAwarded) {
            // Use game.json bonuses.key config
            if (Globals.gameData.bonuses && Globals.gameData.bonuses.key) {
                const dropped = spawnRoomRewards(Globals.gameData.bonuses.key); // Try to spawn rewards

                if (dropped) {
                    Globals.levelMap[nextCoord].bonusAwarded = true; // Mark bonus as awarded
                    Globals.elements.perfect.innerText = "KEY BONUS!"; // Renamed from Room Bonus
                    Globals.elements.perfect.style.display = 'block';
                    Globals.elements.perfect.style.animation = 'none';
                    Globals.elements.perfect.offsetHeight; /* trigger reflow */
                    Globals.elements.perfect.style.animation = null;
                    setTimeout(() => Globals.elements.perfect.style.display = 'none', 2000);
                }
            }
        }

        // If you enter a room through a door, it must be open (unlocked)
        if (Globals.roomData.doors) {
            const entryDoor = dx === 1 ? "left" : (dx === -1 ? "right" : (dy === 1 ? "top" : "bottom"));
            if (Globals.roomData.doors[entryDoor]) {
                Globals.roomData.doors[entryDoor].locked = 0;
                // Force active so the door exists (fixes Boss Room issue where defaults are 0)
                Globals.roomData.doors[entryDoor].active = 1;
                Globals.roomData.doors[entryDoor].hidden = false;
            }
        }
        if (Globals.roomData.isBoss && !nextEntry.cleared) {
            Globals.bossIntroEndTime = Date.now() + 2000;
        }

        // --- GOLDEN PATH BONUS ---
        if (Globals.roomData.isBoss && !Globals.goldenPathFailed && !nextEntry.goldenBonusAwarded) {
            nextEntry.goldenBonusAwarded = true;
            log("GOLDEN PATH BONUS AWARDED!");

            Globals.elements.perfect.innerText = "GOLDEN PATH BONUS!";
            Globals.elements.perfect.style.color = "gold";
            Globals.elements.perfect.style.display = 'block';
            Globals.elements.perfect.style.animation = 'none';
            Globals.elements.perfect.offsetHeight; /* trigger reflow */
            Globals.elements.perfect.style.animation = null;

            // Reward
            Globals.player.inventory.bombs += 10;
            Globals.player.inventory.keys += 3;
            Globals.player.hp = Math.min(Globals.player.hp + 2, 10); // Heal

            setTimeout(() => {
                Globals.elements.perfect.style.display = 'none';
                Globals.elements.perfect.style.color = '#e74c3c'; // Reset
            }, 4000);
        }



        if (!nextEntry.cleared) {
            spawnEnemies();
        } else {
            Globals.enemies = [];
        }
        updateUI();
        renderDebugForm(); // Refresh form for new room
    } else {
        console.error("Critical: Room not found in levelMap at", nextCoord);
        // Fallback: stay in current room but reset coords
        Globals.player.roomX -= dx;
        Globals.player.roomY -= dy;
    }
}
// update loop
export function update() {
    // 0. STOP updates if loading/initializing OR unlocking to prevent movement during transition
    if (Globals.isInitializing || Globals.isUnlocking) return;

    // DEBUG INPUT
    if (Math.random() < 0.01) {
        console.log("Update running. State:", Globals.gameState, "Keys:", JSON.stringify(Globals.keys), "Player:", Globals.player.x, Globals.player.y);
    }

    // 0. Global Inputs (Restart/Menu from non-play states)
    if (handleGlobalInputs()) return;

    // Music Toggle (Global) - Allow toggling in Start, Play, etc.
    updateMusicToggle();

    // 1. If already dead or in credits, stop all logic
    if (Globals.gameState === STATES.GAMEOVER || Globals.gameState === STATES.WIN || Globals.gameState === STATES.CREDITS) return;

    // 2. TRIGGER GAME OVER
    if (Globals.player.hp <= 0) {
        updateGameStats('death');
        Globals.player.hp = 0; // Prevent negative health
        updateUI();    // Final UI refresh
        gameOver();    // Trigger your overlay function
        return;        // Exit loop
    }
    if (Globals.gameState !== STATES.PLAY) return;
    if (Globals.audioCtx.state === 'suspended') Globals.audioCtx.resume();

    updateItems(); // Check for item pickups
    updateFloatingTexts(); // Animate floating texts

    //const now = Date.now(); // Check for item pickups

    // const roomLocked = aliveEnemies.length > 0;
    const roomLocked = isRoomLocked();

    // DETAIL: Trigger Ghost Speech on Door Close (Transition Unlocked -> Locked)
    if (roomLocked && !Globals.wasRoomLocked) {
        // Find active Ghost
        const ghost = Globals.enemies.find(en => en.type === 'ghost' && !en.isDead);
        if (ghost) {
            triggerSpeech(ghost, 'ghost_doors_close', null, true);
        }
    }
    // DETAIL: Green Shards on Room Clear (Locked -> Unlocked)
    else if (!roomLocked && Globals.wasRoomLocked) {
        // Award Green Shards
        // Amount = Hardness + Random(0-Hardness)
        const base = Globals.gameData.hardness || 1;
        const reward = Math.ceil(base + Math.random() * base);
        // addGreenShards(reward); // OLD INTANT ADD
        // spawnShard(Globals.player.x, Globals.player.y, 'green', reward); // DISABLED: Now handled by Enemy Drops (rewards.shards.green)
    }
    Globals.wasRoomLocked = roomLocked;

    const aliveEnemies = Globals.enemies.filter(en => !en.isDead); // Keep for homing logic
    const doors = Globals.roomData.doors || {};

    // 1. Inputs & Music
    updateRestart();
    // updateMusicToggle(); // Moved up (called below now)
    updateMusicToggle();
    updateSFXToggle();
    updateRemoteDetonation(); // Remote Bombs - Check BEFORE Use consumes space
    updateBombInteraction(); // Kick/Interact with Bombs
    if (Globals.keys["Space"]) updateUse();
    if (Globals.keys["KeyP"] && Globals.gameData.pause !== false) {
        Globals.keys["KeyP"] = false; // Prevent repeated triggers
        gameMenu();
        return;
    }

    // 2. World Logic
    // FORCE ROOM FREEZE IMMUNITY
    // Ensure player immunity matches room freeze (prevents resets)
    if (Date.now() < Globals.roomFreezeUntil) {
        Globals.player.invulnUntil = Math.max(Globals.player.invulnUntil || 0, Globals.roomFreezeUntil);
    }

    updateRoomLock();
    updateBombDropping();
    checkRemoteExplosions(); // Check for off-screen booms
    updateBombsPhysics(); // Bomb Physics (Push/Slide)
    updateMovementAndDoors(doors, roomLocked);

    // 3. Combat Logic
    updateShooting();
    // updateRemoteDetonation(); // moved up
    updateReload(); // Add reload state check
    updateBulletsAndShards(aliveEnemies); // Pass enemies for homing check
    updateEnemies(); // Enemy movement + player collision handled inside

    // 4. Transitions
    updateRoomTransitions(doors, roomLocked);

    // Shield Regen
    updateShield();

    updatePortal();
    updateGhost(); // Check for ghost spawn
}

export function updateReload() {
    if (Globals.player.reloading) {
        const now = Date.now();
        if (now - Globals.player.reloadStart >= Globals.player.reloadDuration) {
            // Reload Complete
            if (Globals.player.ammoMode === 'recharge') {
                Globals.player.ammo = Globals.player.maxMag;
            } else {
                const needed = Globals.player.maxMag - Globals.player.ammo;
                const take = Math.min(needed, Globals.player.reserveAmmo);
                Globals.player.ammo += take;
                if (Globals.player.ammoMode === 'reload') Globals.player.reserveAmmo -= take;
            }

            Globals.player.reloading = false;
            log("Reloaded!");
        }
    }
}

//draw loop
export async function draw() {
    if (Globals.isInitializing) {
        Globals.ctx.fillStyle = "black";
        Globals.ctx.fillRect(0, 0, Globals.canvas.width, Globals.canvas.height);
        requestAnimationFrame(() => { draw(); });
        return;
    }
    const aliveEnemies = Globals.enemies.filter(en => !en.isDead);
    const roomLocked = isRoomLocked();
    const doors = Globals.roomData.doors || {};
    await updateUI();
    Globals.ctx.clearRect(0, 0, Globals.canvas.width, Globals.canvas.height);
    drawShake()
    drawDoors()
    drawBossSwitch() // Draw switch underneath entities
    drawPlayer()
    drawBulletsAndShards()
    drawBombs(doors)
    drawItems() // Draw ground items
    drawEnemies()
    if (Globals.screenShake.power > 0) Globals.ctx.restore();

    // --- PARTICLES ---
    if (Globals.particles) {
        for (let i = Globals.particles.length - 1; i >= 0; i--) {
            const p = Globals.particles[i];
            Globals.ctx.save();
            Globals.ctx.globalAlpha = p.life;
            Globals.ctx.fillStyle = p.color || "white";
            Globals.ctx.beginPath();
            Globals.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            Globals.ctx.fill();
            Globals.ctx.restore();

            if (p.vx) p.x += p.vx;
            if (p.vy) p.y += p.vy;

            p.life -= 0.05; // Decay
            if (p.life <= 0) Globals.particles.splice(i, 1);
        }
    }

    drawMinimap();
    if (!DEBUG_FLAGS.TEST_ROOM) drawTutorial();
    drawBossIntro();
    drawPortal();
    drawFloatingTexts(); // Draw notification texts on top
    drawDebugLogs();
    requestAnimationFrame(() => { update(); draw(); });
}

export function drawPortal() {
    // Only draw if active AND in the boss room
    if (!Globals.portal.active || !Globals.roomData.isBoss) return;
    const time = Date.now() / 500;

    Globals.ctx.save();
    Globals.ctx.translate(Globals.portal.x, Globals.portal.y);

    // Outer glow
    Globals.ctx.shadowBlur = 20;
    Globals.ctx.shadowColor = "#8e44ad";

    // Portal shape
    Globals.ctx.fillStyle = "#8e44ad";
    Globals.ctx.beginPath();
    Globals.ctx.ellipse(0, 0, 30, 50, 0, 0, Math.PI * 2);
    Globals.ctx.fill();

    // Swirl effect
    Globals.ctx.strokeStyle = "#ffffff";
    Globals.ctx.lineWidth = 3;
    Globals.ctx.beginPath();
    Globals.ctx.ellipse(0, 0, 20 + Math.sin(time) * 5, 40 + Math.cos(time) * 5, time, 0, Math.PI * 2);
    Globals.ctx.stroke();

    Globals.ctx.restore();
}

export function drawBossSwitch() {
    if (!Globals.roomData.isBoss) return;

    const cx = Globals.canvas.width / 2;
    const cy = Globals.canvas.height / 2;
    const size = 40; // Smaller to be hidden by portal

    Globals.ctx.save();
    Globals.ctx.fillStyle = "#9b59b6"; // Purple
    Globals.ctx.fillRect(cx - size / 2, cy - size / 2, size, size);

    // Optional: Add a border or inner detail to look like a switch plate
    Globals.ctx.strokeStyle = "#8e44ad";
    Globals.ctx.lineWidth = 4;
    Globals.ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

    Globals.ctx.restore();
}

export function updateMusicToggle() {
    // If music is disabled in config, do not allow toggling
    if (!Globals.gameData.music) return;

    if (Globals.keys['Digit0']) {
        Globals.keys['Digit0'] = false; // consume key
        Globals.musicMuted = !Globals.musicMuted;
        if (Globals.musicMuted) {
            log("Music Muted");
            fadeOut(introMusic, 2000); // Smooth fade out
            if (window.cracktroAudio) fadeOut(window.cracktroAudio, 2000);
        } else {
            log("Music Unmuted");
            // Only play if we are in state where music should play
            if (Globals.gameState === 1 || Globals.gameState === 2 || Globals.gameState === 4) {
                fadeIn(introMusic, 5000); // Smooth fade in
            }
        }
    }
}

export function updateRoomTransitions(doors, roomLocked) {

    // --- 8. ROOM TRANSITIONS ---
    // --- 8. ROOM TRANSITIONS ---
    // Increased threshold to account for larger player sizes (Triangle=20)
    const t = 50;

    // Debug Door Triggers
    if (Globals.player.x < t + 10 && doors.left?.active) {
        // log(`Left Door Check: X=${Math.round(player.x)} < ${t}? Locked=${doors.left.locked}, RoomLocked=${roomLocked}`);
    }

    // Constraint for center alignment
    // Only allow transition if player is roughly in front of the door
    const doorW = 50; // Half-width tolerance (Total 100px)

    // Allow transition if room is unlocked OR if the specific door is forced open (red door blown)
    if (Globals.player.x < t && doors.left?.active) {
        if (Math.abs(Globals.player.y - Globals.canvas.height / 2) < doorW) {
            if (!doors.left.locked && (!roomLocked || doors.left.forcedOpen)) changeRoom(-1, 0);
            else log("Left Door Blocked: Locked or Room Locked");
        }
    }
    else if (Globals.player.x > Globals.canvas.width - t && doors.right?.active) {
        if (Math.abs(Globals.player.y - Globals.canvas.height / 2) < doorW) {
            if (!doors.right.locked && (!roomLocked || doors.right.forcedOpen)) changeRoom(1, 0);
            else log("Right Door Blocked: Locked or Room Locked");
        }
    }
    else if (Globals.player.y < t && doors.top?.active) {
        if (Math.abs(Globals.player.x - Globals.canvas.width / 2) < doorW) {
            if (!doors.top.locked && (!roomLocked || doors.top.forcedOpen)) changeRoom(0, -1);
            else log("Top Door Blocked: Locked or Room Locked");
        }
    }
    else if (Globals.player.y > Globals.canvas.height - t && doors.bottom?.active) {
        if (Math.abs(Globals.player.x - Globals.canvas.width / 2) < doorW) {
            if (!doors.bottom.locked && (!roomLocked || doors.bottom.forcedOpen)) changeRoom(0, 1);
            else log("Bottom Door Blocked: Locked or Room Locked");
        }
    }
}

export function isRoomLocked() {
    // Alive enemies that are NOT indestructible
    const aliveEnemies = Globals.enemies.filter(en => !en.isDead && !en.indestructible);
    let isLocked = false;
    const nonGhostEnemies = aliveEnemies.filter(en => en.type !== 'ghost');

    if (nonGhostEnemies.length > 0) {
        // Normal enemies always lock
        isLocked = true;
    } else if (aliveEnemies.length > 0) {
        // Only ghosts remain
        const ghostConfig = Globals.gameData.ghost || { spawn: true, roomGhostTimer: 10000 };
        const now = Date.now();
        const elapsed = now - Globals.roomStartTime;
        const limit = ghostConfig.roomGhostTimer * 2;

        // Debug once per second (approx) to avoid spam
        if (Math.random() < 0.01) {
            // log(`Ghost Lock Check: Elapsed ${Math.round(elapsed)} vs Limit ${limit}`);
        }

        // Lock if time > 2x ghost timer
        if (elapsed > limit) {
            isLocked = true;
            if (Math.random() < 0.05) {
                log(`LOCKED! Elapsed: ${Math.round(elapsed)} > Limit: ${limit}`);
                log(`Diagnostics: Now=${now}, Start=${Globals.roomStartTime}, ConfigTimer=${ghostConfig.roomGhostTimer}`);
            }
        }
    }
    return isLocked;
}
Globals.isRoomLocked = isRoomLocked;

export function updateRoomLock() {
    // --- 2. ROOM & LOCK STATUS ---
    const roomLocked = isRoomLocked();
    const doors = Globals.roomData.doors || {};

    if (!roomLocked && !Globals.roomData.cleared) {
        Globals.roomData.cleared = true;
        const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`; // Fixed space typo
        if (Globals.visitedRooms[currentCoord]) Globals.visitedRooms[currentCoord].cleared = true;

        // Trigger Room Rewards
        if (Globals.roomData.item) {
            spawnRoomRewards(Globals.roomData.item);
        }

        // --- SPEEDY BONUS ---
        // Check if room cleared quickly (e.g. within 5 seconds)
        // Hardcoded to 5s if speedyGoal not in logic (using local var here)
        const timeTakenMs = Date.now() - Globals.roomStartTime;
        // Default to 5000 if undefined, but explicit 0 means 0 (no bonus)
        const speedyLimitMs = (Globals.roomData.speedGoal !== undefined) ? Globals.roomData.speedGoal : 5000;

        if (speedyLimitMs > 0 && timeTakenMs <= speedyLimitMs) {
            if (Globals.gameData.rewards && Globals.gameData.rewards.speedy) {
                const dropped = spawnRoomRewards(Globals.gameData.rewards.speedy);
                if (dropped) {
                    Globals.elements.perfect.innerText = "SPEEDY BONUS!";
                    triggerPerfectText();
                }
            }
        }

        // --- PERFECT BONUS (STREAK) ---
        // Check if no damage taken in this room AND room had enemies
        const hasCombat = Globals.roomData.enemies && Globals.roomData.enemies.some(e => (e.count || 0) > 0);

        if (!Globals.player.tookDamageInRoom && hasCombat) {
            Globals.perfectStreak++;
            const goal = Globals.gameData.perfectGoal || 3;

            if (Globals.perfectStreak >= goal) {
                // Check drop config
                if (Globals.gameData.bonuses && Globals.gameData.bonuses.perfect) {
                    const dropped = spawnRoomRewards(Globals.gameData.bonuses.perfect);
                    if (dropped) {
                        perfectEl.innerText = "PERFECT BONUS!";
                        triggerPerfectText();
                        // Reset or Reduce? "only kick in if this is met" likely means reset to start new streak
                        Globals.perfectStreak = 0;
                    }
                }
            }
        } else {
            Globals.perfectStreak = 0; // Reset streak if hit
        }
    }
}

// Helper to show/hide the big text
export function triggerPerfectText() {
    Globals.elements.perfect.style.display = 'block';
    Globals.elements.perfect.style.animation = 'none';
    Globals.elements.perfect.offsetHeight;
    Globals.elements.perfect.style.animation = null;
    setTimeout(() => Globals.elements.perfect.style.display = 'none', 2000);
}
export function drawShake() {
    const now = Date.now();
    // 1. --- SHAKE ---
    if (Globals.screenShake.power > 0 && now < Globals.screenShake.endAt) {
        Globals.ctx.save();
        const s = Globals.screenShake.power * ((Globals.screenShake.endAt - now) / 180);
        Globals.ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
}

export function drawDoors() {
    const roomLocked = isRoomLocked();
    const doors = Globals.roomData.doors || {};
    Object.entries(doors).forEach(([dir, door]) => {
        if (!door.active || door.hidden) return;

        let color = "#222"; // default open
        if (roomLocked && !door.forcedOpen) color = "#c0392b"; // red if locked by enemies (and not forced)
        else if (door.locked) color = "#f1c40f"; // yellow if locked by key

        Globals.ctx.fillStyle = color;
        const dx = door.x ?? Globals.canvas.width / 2, dy = door.y ?? Globals.canvas.height / 2;
        if (dir === 'top') Globals.ctx.fillRect(dx - DOOR_SIZE / 2, 0, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'bottom') Globals.ctx.fillRect(dx - DOOR_SIZE / 2, Globals.canvas.height - DOOR_THICKNESS, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'left') Globals.ctx.fillRect(0, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
        if (dir === 'right') Globals.ctx.fillRect(Globals.canvas.width - DOOR_THICKNESS, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
    });
}

export function gameOver() {
    Globals.gameOver = gameOver; // Re-assign if needed, or ensure it's set

    // Determine state if not already set (default to GAMEOVER if just called independently)
    if (Globals.gameState !== STATES.WIN) Globals.gameState = STATES.GAMEOVER;

    Globals.elements.overlay.style.display = 'flex';
    // Fix: Count unique visited rooms instead of displacement
    Globals.elements.stats.innerText = getGameStats(0);

    const h1 = document.querySelector('#overlay h1');
    if (Globals.gameState === STATES.WIN) {
        h1.innerText = "VICTORY!";
        h1.style.color = "#f1c40f"; // Gold
    } else {
        h1.innerText = "Game Over";
        h1.style.color = "red";
    }

    // Show/Hide Layout based on Win/Loss
    const continueBtn = Globals.elements.overlay.querySelector('#continueBtn');
    const menuBtn = Globals.elements.overlay.querySelector('#menuBtn');
    const restartBtn = Globals.elements.overlay.querySelector('#restartBtn');

    if (Globals.gameState === STATES.WIN) {
        // Victory: Show Continue (Enter)
        continueBtn.style.display = 'block';
        continueBtn.innerText = "(Enter) Continue";
        menuBtn.style.display = 'none'; // Hide Menu button on Victory? Or Keep it mapped to M?
        // Let's keep Menu visible but maybe mapped to M?
        // User asked for "Main Menu (Enter)" for DEATH popup. 
        // For Victory, they asked for "Enter to Continue".

        restartBtn.style.display = 'none';
    } else {
        // Death (Game Over)
        // Request: "Main Menu (Enter)"
        continueBtn.style.display = 'none'; // Hide continue on death (unless we want the revive hack visible)
        // If I hide continue, M/C keys still work.

        menuBtn.style.display = 'block';
        menuBtn.innerText = "Main Menu (Enter)";

        restartBtn.style.display = 'block';
    }
}

export function gameWon() {
    Globals.gameState = STATES.WIN;
    overlayEl.style.display = 'flex';
    statsEl.innerText = getGameStats(1);

    // Explicitly call gameOver logic to update UI text/buttons sharing logic
    gameOver();
}

export function gameMenu() {
    Globals.gameState = STATES.GAMEMENU;
    Globals.pauseStartTime = Date.now(); // Record Pause Start
    Globals.elements.overlay.style.display = 'flex';
    const title = document.getElementById('overlayTitle');
    if (title) title.innerText = "Pause";
    const overlayEl = Globals.elements.overlay;

    // Configure Buttons for Pause
    overlayEl.querySelector('#continueBtn').style.display = '';
    overlayEl.querySelector('#continueBtn').innerText = "(Enter) Continue";

    overlayEl.querySelector('#restartBtn').style.display = '';

    // Show Main Menu Button
    const menuBtn = overlayEl.querySelector('#menuBtn');
    menuBtn.style.display = '';
    menuBtn.innerText = "(M)ain Menu";
}

// Helper to reset runtime state to base state (Death/Restart)
function resetWeaponState() {
    const baseGun = localStorage.getItem('base_gun');
    const baseGunConfig = localStorage.getItem('base_gun_config');

    if (baseGun) {
        localStorage.setItem('current_gun', baseGun);
        if (baseGunConfig) localStorage.setItem('current_gun_config', baseGunConfig);
        log(`Reset Gun to Base: ${baseGun}`);
    } else {
        // Fallback: If no base saved, CLEAR current so initGame uses player default
        localStorage.removeItem('current_gun');
        localStorage.removeItem('current_gun_config');
        log("No Base Gun found. Cleared Current Gun to force default.");
    }

    const baseBomb = localStorage.getItem('base_bomb');
    const baseBombConfig = localStorage.getItem('base_bomb_config');
    if (baseBomb) {
        localStorage.setItem('current_bomb', baseBomb);
        if (baseBombConfig) localStorage.setItem('current_bomb_config', baseBombConfig);
    } else {
        localStorage.removeItem('current_bomb');
        localStorage.removeItem('current_bomb_config');
    }
}

export function updateSFXToggle() {
    // Key 9 to toggle SFX
    if (Globals.keys['Digit9']) {
        const now = Date.now();
        // 300ms cooldown
        if (now - (Globals.lastSFXToggle || 0) > 300) {
            Globals.sfxMuted = !Globals.sfxMuted;
            log(`SFX Muted: ${Globals.sfxMuted}`);
            Globals.lastSFXToggle = now;
        }
    }
}

export async function restartGame(keepItems = false) {
    const isDebug = Globals.gameData && (
        Globals.gameData.showDebugWindow !== undefined
            ? Globals.gameData.showDebugWindow
            : (Globals.gameData.debug && Globals.gameData.debug.windowEnabled === true)
    );
    if (!keepItems && !isDebug) resetWeaponState();

    // Wait for init to complete, then auto-start
    await initGame(true, null, keepItems);
    startGame(true);
}
Globals.restartGame = restartGame;

export function goToWelcome() {
    resetWeaponState();
    initGame(false);
}
Globals.goToWelcome = goToWelcome;

export function beginPlay() {
    console.log("TRACER: beginPlay Called. GameState=", Globals.gameState);
    // Check if we are in START state, then call startGame
    if (Globals.gameState === STATES.START) {
        startGame(false); // Fresh start from welcome screen
    }
}
Globals.beginPlay = beginPlay;

export function goContinue() {
    Globals.elements.overlay.style.display = 'none';

    // Adjust Timer for Pause Duration
    if (Globals.pauseStartTime > 0) {
        const pausedDuration = Date.now() - Globals.pauseStartTime;
        Globals.roomStartTime += pausedDuration; // Shift room start time forward
        Globals.pauseStartTime = 0;
        log("Resumed. Paused for: " + (pausedDuration / 1000).toFixed(1) + "s. Ghost Timer Adjusted.");
    }

    // If Continuing from Death (Game Over), Revive Player
    if (Globals.player.hp <= 0) {
        Globals.player.hp = 3; // Basic Revive
        updateUI();
    }

    // If Continuing from Victory, disable portal to prevent re-trigger
    if (Globals.gameState === STATES.WIN) {
        if (typeof Globals.portal !== 'undefined') Globals.portal.active = false;
    }

    Globals.gameState = STATES.PLAY;
}






Globals.handleUnlocks = handleUnlocks;
Globals.gameOver = gameOver; // Assign for circular dependency fix
Globals.spawnEnemy = (type, x, y, overrides = {}) => {
    // Import dynamically or use the one we imported?
    // We imported spawnEnemies from Entities.js.
    // Entities.spawnEnemies(count, type, x, y) signature?
    // Let's check Entities.js signature.
    // spawnEnemies(amount, type) -> random pos
    // We want specific pos. 
    // Entities.js likely has "spawnEnemy(type, x, y)" or similar helper?
    // If not, we might need to add one or use a hack.
    // Looking at Entities.js...

    // For now, let's assume we can reuse spawnEnemies but we need to pass x,y.
    // If spawnEnemies doesn't support x,y, we should add support or export a single spawn function.
    // Let's check Entities.js content first.
    // Wait, I can't check it inside this replace block.
    // I will assume I need to export a helper from Entities and attach it here.
    // OR, I can just attach it here if I have access to the class/function.

    // Actually, looking at imports in Game.js:
    // import { spawnEnemies ... } from './Entities.js';

    // I'll attach a wrapper here.
    import('./Entities.js').then(m => {
        m.spawnEnemyAt(type, x, y, overrides);
    });
};

export async function handleUnlocks(unlockKeys) {
    if (Globals.isUnlocking) return;
    Globals.isUnlocking = true;
    Globals.unlockQueue = [...unlockKeys]; // Copy

    // Create Unlock UI if not exists
    let unlockEl = document.getElementById('unlock-overlay');
    if (!unlockEl) {
        unlockEl = document.createElement('div');
        unlockEl.id = 'unlock-overlay';
        unlockEl.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: none; flex-direction: column;
            align-items: center; justify-content: center; z-index: 2000; color: white;
            font-family: monospace; text-align: center;
        `;
        document.body.appendChild(unlockEl);
    }

    // Process first unlock
    await showNextUnlock();
}


export async function showNextUnlock() {
    const unlockEl = document.getElementById('unlock-overlay');
    if (Globals.unlockQueue.length === 0) {
        // All Done -> Proceed to Victory
        unlockEl.style.display = 'none';
        Globals.isUnlocking = false;

        // Final Win State
        handleLevelComplete();
        return;
    }

    const key = Globals.unlockQueue.shift();
    // Try to fetch unlock data
    try {
        // Handle "victory" specially or just ignore if file missing (user deleted it)
        // If file is missing, fetch throws or returns 404
        const res = await fetch(`json/rewards/unlocks/${key}.json?t=${Date.now()}`);
        if (res.ok) {
            const data = await res.json();

            // Save Persistent Override (if applicable)
            if (data.json && data.attr && data.value !== undefined) {
                saveUnlockOverride(data.json, data.attr, data.value);
            }

            // CHECK HISTORY: Skip if already unlocked
            const history = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
            if (history.includes(key)) {
                log(`Skipping already unlocked: ${key}`);
                showNextUnlock();
                return;
            }

            // Add to history now (or after OK? better now to prevent loop if crash)
            history.push(key);
            localStorage.setItem('game_unlocked_ids', JSON.stringify(history));

            // Render
            unlockEl.innerHTML = `
                <h1 style="color: gold; text-shadow: 0 0 10px gold;">UNLOCKED!</h1>
                <h2 style="font-size: 2em; margin: 20px;">${data.name || key}</h2>
                <p style="font-size: 1.2em; color: #aaa;">${data.description || "You have unlocked a new feature!"}</p>
                <div style="margin-top: 40px; padding: 10px 20px; border: 2px solid white; cursor: pointer; display: inline-block;" id="unlock-ok-btn">
                    CONTINUE (Enter)
                </div>
            `;
            unlockEl.style.display = 'flex';

            // SFX??
            if (window.SFX && SFX.coin) SFX.coin(); // Reuse coin sound for now

            // Handler for click/key
            const proceed = () => {
                window.removeEventListener('keydown', keyHandler);
                document.getElementById('unlock-ok-btn').removeEventListener('click', proceed);
                showNextUnlock(); // Recursion for next item
            };

            const keyHandler = (e) => {
                if (e.code === 'Enter' || e.code === 'Space') {
                    proceed();
                }
            };

            document.getElementById('unlock-ok-btn').addEventListener('click', proceed);
            window.addEventListener('keydown', keyHandler);

        } else {
            console.warn(`Unlock file not found for: ${key}`);
            showNextUnlock(); // Skip if not found
        }
    } catch (e) {
        console.warn(`Failed to load unlock: ${key}`, e);
        showNextUnlock(); // Skip on error
    }
}

export function saveUnlockOverride(file, attr, value) {
    try {
        const store = JSON.parse(localStorage.getItem('game_unlocks') || '{}');
        if (!store[file]) store[file] = {};

        // Handle dot notation for nested attributes (e.g., "ghost.spawn")
        const parts = attr.split('.');
        let current = store[file];

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;

        localStorage.setItem('game_unlocks', JSON.stringify(store));
        log(`Saved Unlock Override: ${file} -> ${attr} = ${value}`);
    } catch (e) {
        console.error("Failed to save unlock persistence", e);
    }
}

export function confirmNewGame() {
    // Clear Persistence to ensure fresh start
    STORAGE_KEYS.RESET_ON_NEW_GAME.forEach(key => localStorage.removeItem(key));

    location.reload();
}

export function cancelNewGame() {
    const modal = document.getElementById('newGameModal');
    if (modal) modal.style.display = 'none';
    Globals.isNewGameModalOpen = false;
}



Globals.loadRoom = initGame; // Alias for clarity
