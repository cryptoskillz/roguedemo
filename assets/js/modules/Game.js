import { Globals } from './Globals.js';
import { STATES, BOUNDARY, DOOR_SIZE, DOOR_THICKNESS, CONFIG, DEBUG_FLAGS, JSON_PATHS, STORAGE_KEYS } from './Constants.js';
import { log, deepMerge, triggerSpeech, generateLore, spawnFloatingText } from './Utils.js';
import { SFX, introMusic, unlockAudio, fadeIn, fadeOut } from './Audio.js';
import { setupInput, handleGlobalInputs } from './Input.js';
import { drawStatsPanel, updateUI, updateWelcomeScreen, showLevelTitle, drawMinimap, drawTutorial, drawBossIntro, drawRoomIntro, drawDebugLogs, drawFloatingTexts, updateFloatingTexts, getGameStats, updateGameStats, loadGameStats, resetSessionStats, saveGameStats } from './UI.js';
import { renderDebugForm, updateDebugEditor } from './Debug.js';
import { generateLevel } from './Level.js';
import {
    spawnEnemies, updateEnemies, updateBulletsAndShards,
    pickupItem, applyModifierToGun, spawnRoomRewards,
    drawPlayer, drawBulletsAndShards, spawnBulletShards, spawnCurrencyShard, drawItems, drawEnemies,
    spawnBullet, dropBomb, drawBombs, updateBombDropping, updateMovementAndDoors, updateItems,
    updateRestart, updateRemoteDetonation, updateBombInteraction, updateUse, checkRemoteExplosions,
    updateBombsPhysics, updateShooting, updateShield, updatePortal, updateGhost,
    handleLevelComplete
} from './Entities.js';
import { spawnChests, updateChests, drawChests } from './Chests.js';
import { spawnSwitches, updateSwitches, drawSwitches } from './Switches.js';

// Placeholders for functions to be appended
// Prevent accidental tab closure
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
});

export async function initGame(isRestart = false, nextLevel = null, keepStats = false) {

    // 0. Force Audio Resume (Must be first, to catch user interaction)
    if (Globals.audioCtx.state === 'suspended') Globals.audioCtx.resume();

    Globals.isRestart = isRestart; // Track global state for startGame logic
    Globals.isLevelTransition = !!nextLevel; // Track level transition

    // Show Loading Immediately for transitions to hide empty room flash
    const loadingEl = document.getElementById('loading');
    if (loadingEl && Globals.isLevelTransition) loadingEl.style.display = 'flex';

    if (Globals.isInitializing) return;
    Globals.isInitializing = true;

    // Stats Init
    if (!keepStats) {
        loadGameStats();
        resetSessionStats();
    }

    // Reset Ghost Trap State
    Globals.ghostTrapActive = false;
    // Music Reset handled in startGame or updateRoomLock if state persists?
    // Force music reset if coming from Ghost Trap
    if (introMusic && introMusic.src.includes('ghost')) {
        introMusic.src = Globals.gameData.introMusic;
        if (!introMusic.paused) introMusic.play().catch(() => { });
    }

    log("TRACER: initGame Start. isRestart=", isRestart);

    // SEED INITIALIZATION
    if (!nextLevel) { // Only change seed state on new run or restart
        if (isRestart) {
            // Restart: Use the SAME seed again (Deterministic Replay)
            if (Globals.seed !== null) Globals.setSeed(Globals.seed);
        } else {
            // New Game: Generate Random Seed (unless provided in URL/Input later)
            // Check URL for seed
            const params = new URLSearchParams(window.location.search);
            const urlSeed = params.get('seed');
            if (urlSeed) {
                Globals.setSeed(urlSeed);
            } else {
                // Random new seed
                const newSeed = Math.floor(Math.random() * 999999);
                Globals.setSeed(newSeed);
            }
        }
    }

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

    // Debug panel setup moved after config load

    // MOVED: Music start logic is now handled AFTER game.json is loaded to respect "music": false setting.

    // Initialize Music Source
    if (introMusic && Globals.gameData.introMusic) {
        // Only valid if src works (check valid path)
        const target = Globals.gameData.introMusic;
        // Avoid resetting if already playing same track (via relative check)
        // new Audio() src is empty initially.
        if (!introMusic.src || !introMusic.src.includes(target.split('/').pop())) {
            introMusic.src = target;
            log("Initialized Music Source:", target);
        }
    }

    Globals.gameState = STATES.START; // Always reset to START first, let startGame() transition to PLAY
    if (Globals.elements.overlay) Globals.elements.overlay.style.display = 'none';
    if (Globals.elements.welcome) Globals.elements.welcome.style.display = 'none';

    // Initial UI State
    if (Globals.elements.ui) {
        Globals.elements.ui.style.display = 'flex'; // Always keep flex container for layout
        const statsPanel = document.getElementById('stats-panel');
        if (statsPanel) statsPanel.style.display = (Globals.gameData && Globals.gameData.showStatsPanel !== false) ? 'block' : 'none';

        const mapCanvas = document.getElementById('minimapCanvas');
        if (mapCanvas) mapCanvas.style.display = (Globals.gameData && Globals.gameData.showMinimap !== false) ? 'block' : 'none';
    }
    Globals.bullets = [];
    Globals.bombs = [];
    Globals.particles = [];
    Globals.enemies = [];
    Globals.switches = [];
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

    // Only reset Ghost Timer on Fresh Start
    if (!keepStats) {
        Globals.ghostTime = 0; // Accumulated time with ghost (Run)
        // Globals.ghostTimeSurvived must NOT be reset here! It is Lifetime.
        Globals.ghostTimeSessionSurvived = 0;
    }

    Globals.lastUpdate = Date.now(); // For delta time
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

    Globals.perfectStreak = 0;
    if (Globals.elements.perfect) Globals.elements.perfect.style.display = 'none';
    Globals.roomStartTime = Date.now();
    Globals.ghostSpawned = false; // Reset Ghost
    Globals.ghostKilled = false;
    Globals.foundUnlocks = []; // Reset found unlocks
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
                        // DEV: Prevent these from being overridden by saves so game.json controls them
                        if (overrides[k].showSpeedyTimer !== undefined) delete overrides[k].showSpeedyTimer;
                        if (overrides[k].showPerfectCount !== undefined) delete overrides[k].showPerfectCount;

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
        // Use nextLevel if provided.
        // If !isRestart (Welcome Screen), prioritize Start Level (Fresh Start).
        // If isRestart (R Key), prioritize Stored Level (Current Level).
        const storedLevel = localStorage.getItem('rogue_current_level');
        let levelFile = nextLevel;

        if (!levelFile) {
            if (isRestart) {
                // Restart: Resume current run or fallback to start
                levelFile = storedLevel || gData.startLevel;
            } else {
                // Fresh Load: ALWAYS use Start Level (Welcome)
                levelFile = gData.startLevel;
                // Fallback only if configured startLevel is missing
                if (!levelFile) levelFile = storedLevel;
            }
            log(`Initiating game. Level File: ${levelFile} (isRestart: ${isRestart}, stored: ${storedLevel}, default: ${gData.startLevel})`);
        }

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
                    // Update Persistence so Restart (R) uses this level
                    localStorage.setItem('rogue_current_level', levelFile);


                    const levelData = await levelRes.json();
                    // Set the level name
                    localStorage.setItem('current_level_name', levelData.name);

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

        // 3. Load Manifests in Parallel (Cached to prevent black screen on restart)
        let manData, mData, itemMan;
        if (!Globals.CACHE) Globals.CACHE = {};

        if (Globals.CACHE.manifests) {
            manData = Globals.CACHE.manifests.manData;
            mData = Globals.CACHE.manifests.mData;
            itemMan = Globals.CACHE.manifests.itemMan;
            log("Using Cached Manifests (Instant Load)");
        } else {
            [manData, mData, itemMan] = await Promise.all([
                fetch(JSON_PATHS.MANIFESTS.PLAYERS + '?t=' + Date.now()).then(res => res.json()),
                fetch(JSON_PATHS.MANIFESTS.ROOMS + '?t=' + Date.now()).then(res => res.json()).catch(() => ({ rooms: [] })),
                fetch(JSON_PATHS.MANIFESTS.ITEMS + '?t=' + Date.now()).then(res => res.json()).catch(() => ({ items: [] }))
            ]);
            Globals.CACHE.manifests = { manData, mData, itemMan };
        }



        Globals.gameData = gData;

        // --- SYNC DEBUG FLAGS FROM CONFIG ---
        if (Globals.gameData.debug) {
            DEBUG_FLAGS.START_BOSS = Globals.gameData.debug.startBoss ?? false;
            DEBUG_FLAGS.PLAYER = Globals.gameData.debug.player ?? true;
            DEBUG_FLAGS.GODMODE = Globals.gameData.debug.godMode ?? false;
            DEBUG_FLAGS.WINDOW = Globals.gameData.debug.windowEnabled ?? false;
            DEBUG_FLAGS.LOG = Globals.gameData.debug.log ?? false;
        }

        // Initialize Music Source (Now that gameData is loaded & merged)
        // Priority: level.json "music" (if string) > game.json "introMusic" > default
        let musicSrc = Globals.gameData.introMusic;

        // Unlock Status (Check Persistence or Game Config Override)
        const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
        let isMusicEnabled = unlockedIds.includes('music');
        if (Globals.gameData.music === true) isMusicEnabled = true;

        // Capture Level Override (Persistence across Welcome Screen)
        if (typeof Globals.gameData.music === 'string') {
            Globals.levelMusic = Globals.gameData.music;
        } else {
            Globals.levelMusic = null;
        }

        // DEBUG / HOTFIX: Force Level 5 Music if loading Level 5
        try {
            // Check nextLevel argument
            if (nextLevel && typeof nextLevel === 'string' && nextLevel.includes('5.json')) {
                log("HOTFIX: Forcing Level 5 Music");
                Globals.levelMusic = 'assets/music/level_05.mp3';
            }
        } catch (e) { }

        // FORCED WELCOME SCREEN BEHAVIOR
        // 1. Always Use Intro Music (Ignore Level Override)
        if (!isRestart && !nextLevel) {
            musicSrc = Globals.gameData.introMusic; // Force Intro Source
        } else {
            // Normal Gameplay: Respect Level Override if exists
            if (Globals.levelMusic) {
                musicSrc = Globals.levelMusic;
            }
        }

        // Apply Enabled State to Global Config (replacing any string override with boolean)
        Globals.gameData.music = isMusicEnabled;

        if (introMusic && musicSrc) {
            // Check if we need to change track
            const currentFile = introMusic.src ? introMusic.src.split('/').pop() : "";
            const targetFile = musicSrc.split('/').pop();

            if (currentFile !== targetFile) {
                log("Switching Music Track:", currentFile, "->", targetFile);
                introMusic.pause();
                introMusic.currentTime = 0;
                introMusic.src = musicSrc;
                introMusic.load();
            }

            // Auto-Play (if enabled)
            if (Globals.gameData.music) {
                // Force volume and play if paused or if we just switched
                if (introMusic.paused || currentFile !== targetFile) {
                    if (Globals.audioCtx.state === 'running') {
                        introMusic.volume = 0.4;
                        introMusic.play().catch(e => console.warn("Music Play Blocked", e));
                    } else {
                        log("Music waiting for interaction (AudioCtx suspended)");
                    }
                }
            } else if (!Globals.gameData.music && !introMusic.paused) {
                // Enforce Lock: Stop music if disabled/locked
                fadeOut(introMusic, 500); // Friendly fade out
                log("Music Halted (Locked/Disabled)");
            }
        }

        if (Globals.gameData.debug && Globals.gameData.debug.spawn) {
            DEBUG_FLAGS.SPAWN_ALL_ITEMS = Globals.gameData.debug.spawn.allItems ?? false;
            DEBUG_FLAGS.SPAWN_GUNS = Globals.gameData.debug.spawn.guns ?? false;
            DEBUG_FLAGS.SPAWN_BOMBS = Globals.gameData.debug.spawn.bombs ?? false;
            DEBUG_FLAGS.SPAWN_INVENTORY = Globals.gameData.debug.spawn.inventory ?? false;
            DEBUG_FLAGS.SPAWN_MODS_PLAYER = Globals.gameData.debug.spawn.modsPlayer ?? false;
            DEBUG_FLAGS.SPAWN_MODS_BULLET = Globals.gameData.debug.spawn.modsBullet ?? true;
        }

        // Apply Debug UI state
        if (Globals.elements.debugPanel) Globals.elements.debugPanel.style.display = DEBUG_FLAGS.WINDOW ? 'flex' : 'none';
        if (Globals.elements.debugLog) Globals.elements.debugLog.style.display = DEBUG_FLAGS.LOG ? 'block' : 'none';
        if (Globals.elements.room) Globals.elements.room.style.display = DEBUG_FLAGS.WINDOW ? 'block' : 'none';

        // Populate Debug Dropdown (Fix)
        updateDebugEditor();

        Globals.roomManifest = mData;

        // LOAD STARTING ITEMS
        // LOAD STARTING ITEMS & UNLOCKS
        Globals.groundItems = [];
        let allItems = [];

        // 1. Manifest Items & Unlock Loading (Cached Check to prevent reload lag)
        if (!Globals.CACHE.itemTemplates) {
            // 1. Manifest Items
            if (itemMan && itemMan.items) {
                log("Loading Items Manifest:", itemMan.items.length);
                const itemPromises = itemMan.items.map(i =>
                    fetch(`${JSON_PATHS.ROOT}rewards/items/${i}.json?t=` + Date.now())
                        .then(r => r.json())
                        .then(obj => {
                            if (!obj.location) obj.location = `rewards/items/${i}.json`;
                            return obj;
                        })
                        .catch(e => {
                            console.error("Failed to load item:", i, e);
                            return null;
                        })
                );
                const manifestItems = await Promise.all(itemPromises);

                // Avoid duplicates if manifest overlaps with hardcoded or other load steps (though this is the first step)
                // Just concat to allItems (which is empty here)
                allItems = allItems.concat(manifestItems.filter(i => i !== null));
            }

            // 2. Spawnable Unlocks
            let unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');

            // MIGRATION: 'ui' was renamed to 'statsPanel'
            if (unlockedIds.includes('ui')) {
                unlockedIds = unlockedIds.filter(id => id !== 'ui');
                if (!unlockedIds.includes('statsPanel')) unlockedIds.push('statsPanel');
                localStorage.setItem('game_unlocked_ids', JSON.stringify(unlockedIds));
                log("Migrated unlock: ui -> statsPanel");
            }
            // Load ALL potential unlocks so they exist for Matrix room testing
            // Standard "drop" logic in Entities.js will filter out locked ones based on localStorage.
            if (true) {
                const unlockManRes = await fetch(`${JSON_PATHS.ROOT}rewards/unlocks/manifest.json?t=` + Date.now());
                const unlockMan = await unlockManRes.json();
                const allUnlockIds = unlockMan.unlocks || [];

                log(`Loading ${allUnlockIds.length} potential unlocks from manifest...`);

                const unlockPromises = allUnlockIds.map(id =>
                    fetch(`${JSON_PATHS.ROOT}rewards/unlocks/${id}.json?t=` + Date.now())
                        .then(r => r.json())
                        .then(async data => {
                            if (data.spawnable && data.json) {
                                let item;
                                const path = data.json;

                                // Special Handling for Config Unlocks (game.json / player.json)
                                if (path === 'game.json' || path.endsWith('game.json') || path === 'player.json' || path.endsWith('player.json')) {
                                    item = {
                                        name: data.name || "Unknown Unlock",
                                        type: "unlock",
                                        rarity: "special", // Don't spawn randomly
                                        location: data.json,
                                        colour: "#fdcb6e", // Goldish
                                        size: 15,
                                        description: data.description,
                                        // Metadata for pickup logic
                                        instantTrigger: data.instantTrigger,
                                        unlockId: data.unlock,
                                        json: data.json,
                                        attr: data.attr,
                                        value: data.value,
                                        isUnlockWrapper: true, // Flag for renderer
                                        spawnable: data.spawnable
                                    };
                                } else {
                                    // Normal Item File
                                    // wrapper so it renders as an UNLOCK (Gold/Square) not the item itself
                                    item = {
                                        name: data.name || "Unlock Reward",
                                        type: "unlock", // FORCE TYPE TO UNLOCK
                                        rarity: "legendary",
                                        location: data.json, // The file it unlocks
                                        colour: "#fdcb6e", // Goldish
                                        size: 20,
                                        description: data.description,
                                        // Metadata
                                        instantTrigger: data.instantTrigger,
                                        unlockId: data.unlock,
                                        json: data.json,
                                        attr: data.attr,
                                        value: data.value,
                                        isUnlockWrapper: true, // Flag for renderer
                                        spawnable: data.spawnable
                                    };
                                }

                                if (item) {
                                    // Entities.js isUnlocked() + localStorage('game_unlocks') handles status.
                                    // Merge metadata if not present
                                    if (data.instantTrigger) item.instantTrigger = true;
                                    if (data.unlock) item.unlockId = data.unlock;
                                    if (data.attr) item.attr = data.attr;
                                    if (data.value) item.value = data.value;
                                    return item;
                                }
                            }
                            return null;
                        })
                        .catch(e => {
                            // console.warn("Failed to load unlock:", id); // Expected for non-item unlocks
                            return null;
                        })
                );
                const unlockedItems = await Promise.all(unlockPromises);
                const valid = unlockedItems.filter(i => i);
                log(`Loaded ${valid.length} spawnable unlocks.`);
                allItems = allItems.concat(valid);
            }
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
                    if (config.rarity) {
                        item.rarity = config.rarity;
                    }
                } catch (e) {
                    // console.warn("Could not load config for color:", item.name);
                }
            }));
            if (!Globals.CACHE) Globals.CACHE = {};
            Globals.CACHE.itemTemplates = allItems;
        } else {
            // Use Cache
            allItems = Globals.CACHE.itemTemplates;
            log("Using Cached Items (Size:" + allItems.length + ")");
        }
        window.allItemTemplates = allItems;

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
            // Use Deep Merge to ensure version compatibility (New keys in defaults are kept)
            deepMerge(Globals.player, savedPlayerStats);

            if (savedPlayerStats.perfectStreak !== undefined) {
                Globals.perfectStreak = savedPlayerStats.perfectStreak;
            }
        } else {
            // Apply Defaults / Unlocks to New Player
            if (!Globals.player.gunType && Globals.gameData.gunType) Globals.player.gunType = Globals.gameData.gunType;
            if (!Globals.player.bombType && Globals.gameData.bombType) Globals.player.bombType = Globals.gameData.bombType;

            // Fallback Defaults if still empty
            if (!Globals.player.bombType) Globals.player.bombType = 'normal';
            if (!Globals.player.gunType) Globals.player.gunType = 'peashooter';

            log("Player Initialized. Bomb:", Globals.player.bombType, "Gun:", Globals.player.gunType);
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

        // Check for SFX mute and ensure unlock status is respected
        const soundUnlocked = Globals.gameData.soundEffects || JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]').includes('soundEffects');
        if (soundUnlocked) {
            Globals.gameData.soundEffects = true;
            // Only force mute if explicitly requested? Or default to on.
            // Globals.sfxMuted = false; // Let's not force false if user muted it?
            // But if it was locked, it was forced true.
            // We need a persistence for user preference too ideally, but for now just unlock it.
        } else {
            Globals.sfxMuted = true;
        }

        if (Globals.gameData.music || JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]').includes('music')) {
            // Force enable if unlocked (override default config)
            Globals.gameData.music = true;
            // Respect previous state or load from storage
            if (Globals.musicMuted === undefined) {
                Globals.musicMuted = localStorage.getItem('music_muted') === 'true';
            }
            // --- 1. INSTANT AUDIO SETUP ---
            // Ensure global audio is ready
            introMusic.loop = true;
            introMusic.volume = 0.4;
            Globals.introMusic = introMusic; // Expose for Entities

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
                    log(data)

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
                    // SAFETY CHECK: Don't overwrite a 'start' room with a 'normal' one (Race condition fix)
                    if (Globals.roomTemplates[id] && Globals.roomTemplates[id]._type === 'start' && type !== 'start') {
                        // We already have a definitive Start Room for this ID. Don't downgrade it.
                        // However, we might want to store it by path still?
                        Globals.roomTemplates[path] = data; // Store path variant anyway
                        log(`Skipping override of Start Room ${id} with normal variant.`);
                        return;
                    }

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
        //is this required?
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

        // D. Secret Rooms (FIX: Needed to be explicitly loaded)
        if (Globals.gameData.secrectrooms) {
            Globals.gameData.secrectrooms.forEach(path => {
                roomProtos.push(loadRoomFile(path, 'secret'));
            });
        }
        // NEW: Load Special Secret Rooms (Trophy, Home, Matrix)
        if (Globals.gameData.trophyRoom && Globals.gameData.trophyRoom.active) {
            roomProtos.push(loadRoomFile(Globals.gameData.trophyRoom.room, 'secret'));
        }
        if (Globals.gameData.homeRoom && Globals.gameData.homeRoom.active) {
            roomProtos.push(loadRoomFile(Globals.gameData.homeRoom.room, 'secret'));
        }
        if (Globals.gameData.matrixRoom && Globals.gameData.matrixRoom.active) {
            roomProtos.push(loadRoomFile(Globals.gameData.matrixRoom.room, 'secret'));
        }

        // B. Boss Rooms
        let bosses = Globals.gameData.bossrooms || [];
        // Support singular 'bossRoom' fallback
        if (Globals.gameData.bossRoom && Globals.gameData.bossRoom.trim() !== "") {
            bosses.push(Globals.gameData.bossRoom);
        }
        bosses = bosses.filter(p => p && p.trim() !== "");
        bosses.forEach(path => roomProtos.push(loadRoomFile(path, 'boss')));
        log(bosses)
        // C. Shop Room
        if (Globals.gameData.shop && Globals.gameData.shop.active && Globals.gameData.shop.room) {
            roomProtos.push(loadRoomFile(Globals.gameData.shop.room, 'shop'));
        }

        // WAIT FOR ALL TEMPLATES TO LOAD BEFORE GENERATING LEVEL
        log("WAITING FOR ROOM PROTOS:", roomProtos.length);
        await Promise.all(roomProtos);
        log("ROOM TEMPLATES LOADED:", Object.keys(Globals.roomTemplates));

        Globals.areAssetsLoaded = true; // Flag for startGame

        // 4. Pre-load ALL enemy templates
        Globals.enemyTemplates = {};
        const enemyManifest = await fetch('json/enemies/manifest.json?t=' + Date.now()).then(res => res.json()).catch(() => ({ enemies: [] }));
        const ePromises = enemyManifest.enemies.map(id =>
            fetch(`json/enemies/${id}.json?t=` + Date.now())
                .then(res => res.json())
                .then(data => {
                    // Use the last part of the path as the key (e.g. "special/firstboss" -> "firstboss")
                    const key = id.split('/').pop();
                    log(key, data)
                    Globals.enemyTemplates[key] = data;
                })
        );
        await Promise.all(ePromises);

        // 5. Generate Level
        const urlParams = new URLSearchParams(window.location.search);
        const isDebugRoom = DEBUG_FLAGS.TEST_ROOM || urlParams.get('debugRoom') === 'true';
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
            log("Single Room Mode Detected via nextLevel");
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
        Globals.roomIntroEndTime = Globals.roomData.showIntro ? (Date.now() + 2000) : 0;
        Globals.visitedRooms["0,0"] = startEntry;

        // If we loaded a specific room/level (via nextLevel or debug), we need to ensure enemies are spawned
        // generateLevel usually handles this for procedural levels, but here we might be bypassing it.
        // We need to re-trigger spawnEnemies for the current room if it wasn't done.
        // CHECK: generateLevel populates the map. If we injected "0,0" manually (debug), we need to spawn.
        if (nextLevel || isDebugRoom || DEBUG_FLAGS.START_BOSS) {
            log("Debug/Direct Load: Spawning Enemies for 0,0");
            spawnEnemies(Globals.roomData);
            spawnChests(Globals.roomData);
            spawnSwitches(Globals.roomData);
        }

        Globals.canvas.width = Globals.roomData.width || 800;
        Globals.canvas.height = Globals.roomData.height || 600;

        // if (gameState === STATES.PLAY) { spawnEnemies(); ... } 
        // Logic removed: startGame() handles spawning now.
        Globals.isGameStarting = false;

        if (!Globals.gameLoopStarted) {
            Globals.gameLoopStarted = true;
            draw();
        }

        // Start Run Timer
        // on restart if its a new game (NOT level transition)
        if (isRestart && !nextLevel) {
            Globals.runStartTime = Date.now();
            Globals.runElapsedTime = 0;
        }

        // Level Split Tracking
        Globals.levelStartTime = Date.now();

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

        log("TRACER: initGame End. shouldAutoStart=", shouldAutoStart);

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
export async function startGame(keepState = false) {
    // Force Audio Resume on User Interaction
    if (Globals.audioCtx.state === 'suspended') Globals.audioCtx.resume();

    // Guard against starting while Initializing or Unlocking or already starting
    log("TRACER: startGame Called");

    // NEW: Wait for loading if initGame is still running
    if (Globals.isInitializing) {
        log("TRACER: Waiting for initialization...");
        while (Globals.isInitializing) {
            await new Promise(r => setTimeout(r, 100));
        }
    }
    // Also ensure templates are actually loaded (if startGame called directly)
    if (!Globals.areAssetsLoaded && !keepState) {
        console.warn("TRACER: Assets not loaded yet? Waiting...");
        // Ideally should call initGame() if not running, but assume initGame runs on load.
        // Just wait loop in case it's mid-load but isInitializing flag logic is weird.
    }

    if (Globals.gameState === STATES.PLAY || Globals.isGameStarting || Globals.isUnlocking) return;
    Globals.isGameStarting = true;

    // MUSIC TRANSITION (Welcome -> Gameplay)
    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
    const isMusicUnlocked = unlockedIds.includes('music');
    // Force update Globals music state
    Globals.gameData.music = isMusicUnlocked;

    if (isMusicUnlocked) {
        // If we have a specific level track pending
        if (Globals.levelMusic) {
            // Switch track
            // Check current src to avoid reload if same
            if (!introMusic.src || !introMusic.src.includes(Globals.levelMusic.split('/').pop())) {
                introMusic.src = Globals.levelMusic;
                introMusic.load();
                introMusic.play();
                log("Switched to Level Music:", Globals.levelMusic);
            }
        }
        // If no level override, keep playing whatever is playing (Intro)
    } else {
        // Locked -> Stop any music from Welcome screen
        fadeOut(introMusic, 500);
        log("Music Locked - Stopping Playback");
    }

    // Check Lock
    const p = Globals.availablePlayers[Globals.selectedPlayerIndex];

    if (p && p.locked) {
        log("Player Locked - Cannot Start");
        Globals.isGameStarting = false;
        return;
    }

    // SEED OVERRIDE FROM UI
    const seedInput = document.getElementById('seedInput');
    if (seedInput && seedInput.value && seedInput.value.trim() !== "") {
        const val = seedInput.value.trim();
        // FORCE Reset RNG State even if value is same (fixes restart bug)
        Globals.setSeed(val);
    }

    // Check if we need to regenerate level due to seed change
    // If not keeping state (fresh start) AND seed input exists
    // We compare with the seed used during initGame (Globals.seed)
    // If val != Globals.seed, we already set it. 
    // BUT initGame already ran generateLevel with old seed.
    // So if val was different, we MUST regenerate.

    if (!keepState && seedInput && seedInput.value && seedInput.value.trim() !== "") {
        const val = seedInput.value.trim();
        // If we just changed the seed (setSeed logs it, but we can verify)
        // Actually we just set it above. 
        // We need to know if the level CURRENTLY generated matches this seed.
        // A simple way is: if we are allowing seed input, we should probably ALWAYS regenerate the level 
        // on "Start Game" to be safe, OR track "seedUsedForGeneration".

        // Let's just regenerate if it's a fresh start. It's cheap enough.
        // Unless it's a "Restart" (keepState=false, isRestart=true) which handled seed in initGame.
        // But "Restart" doesn't show Welcome Screen input usually? 
        // Wait, restartGame calls initGame(true), which hides welcome. 
        // So this input logic only applies to MANUAL start from Welcome Screen.

        log("Regenerating level with selected seed:", Globals.seed);
        generateLevel(Globals.gameData.NoRooms !== undefined ? Globals.gameData.NoRooms : 11);

        // Also must respawn enemies for the start room (0,0) as generateLevel resets map
        if (Globals.levelMap["0,0"]) {
            Globals.roomData = Globals.levelMap["0,0"].roomData;
            Globals.roomIntroEndTime = Globals.roomData.showIntro ? (Date.now() + 2000) : 0;
            // spawnEnemies(Globals.roomData); // spawnEnemies uses Globals.roomData by default
            // Actually, initGame does NOT spawn enemies for 0,0 by default? 
            // updateEnemies loop handles it if they exist?
            // Let's check initGame again. It only spawns for debug/nextLevel.
            // Standard spawning happens in update() -> updateRoom() -> if (room != lastRoom)
            // So we just need to reset player.roomX/Y which we do below.
        }
    }

    // Increment Run Count (Persisted)
    if (!keepState && !Globals.isRestart) {
        // Only count as new run if not a level transition (keepState) 
        // Adjust logic: keepState is true for level transition? 
        // Wait, startGame(true) is used for next level? 
        // Let's check call sites. 
        // actually restartGame() sets isRestart=true. 
        // But a new game from menu? 

        // Simpler: Just check if we are resetting logic.
        // If keepState is FALSE, it's a fresh run (or restart).
        Globals.NumberOfRuns++;
        localStorage.setItem('numberOfRuns', Globals.NumberOfRuns);

        // RESET TIMER
        Globals.runStartTime = Date.now();
        Globals.runElapsedTime = 0;
        Globals.SessionRunTime = 0; // Fix persisted welcome screen timer

        resetSessionStats();
    }

    // Show Loading Screen immediately to block input/visuals
    // BUT skip if restarting (same level) to show teleport effect.
    // Show if transitioning levels (clean slate).
    const loadingEl = document.getElementById('loading');
    if (loadingEl && (!Globals.isRestart || Globals.isLevelTransition)) loadingEl.style.display = 'flex';
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
            log("TRACER: startGame Async End -> PLAY");
            Globals.gameState = STATES.PLAY;
            Globals.elements.welcome.style.display = 'none';

            if (Globals.elements.ui) {
                // Manage UI Components Independently
                Globals.elements.overlay.style.display = 'none'; // Ensure Game Over screen is hidden

                // Show Parent UI Container
                Globals.elements.ui.style.display = 'block';

                const statsPanel = document.getElementById('stats-panel');
                if (statsPanel) statsPanel.style.display = (Globals.gameData.showStatsPanel !== false) ? 'block' : 'none';

                // FORCE UI UPDATE for Room Name
                if (Globals.elements.roomName) {
                    Globals.elements.roomName.innerText = Globals.roomData.name || "Unknown Room";
                }
            }     // Show Level Title
            if (Globals.gameData.description || Globals.gameData.name) {
                showLevelTitle(Globals.gameData.description || Globals.gameData.name);
            }

            // Minimap Visibility
            if (Globals.mapCanvas) Globals.mapCanvas.style.display = (Globals.gameData.showMinimap !== false) ? 'block' : 'none';

            // If starting primarily in Boss Room (Debug Mode), reset intro timer
            if (Globals.roomData.isBoss) {
                Globals.bossIntroEndTime = Date.now() + 2000;
            }

            spawnEnemies();
            spawnChests(Globals.roomData);

            // Check for Start Room Bonus (First Start)
            if (Globals.gameData.rewards && Globals.gameData.rewards.startroom) {
                const dropped = spawnRoomRewards(Globals.gameData.rewards.startroom);
                if (dropped) {
                    spawnFloatingText(Globals.player.x, Globals.player.y, "START BONUS!", "#3498db");
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

        // SAVE CHESTS
        if (Globals.chests && Globals.chests.length > 0) {
            Globals.levelMap[currentCoord].savedChests = Globals.chests.map(c => ({
                id: c.id,
                x: c.x, y: c.y,
                width: c.width, height: c.height,
                config: c.config,
                state: c.state,
                locked: c.locked,
                hp: c.hp,
                manifest: c.manifest
            }));
        } else {
            Globals.levelMap[currentCoord].savedChests = null;
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

    // RESTORE CHESTS
    Globals.chests = [];
    if (Globals.levelMap[nextCoord] && Globals.levelMap[nextCoord].savedChests) {
        Globals.levelMap[nextCoord].savedChests.forEach(sc => {
            Globals.chests.push(sc);
        });
    } else if (Globals.levelMap[nextCoord]) {
        // If entering a room for first time OR no chests saved (but maybe existed?)
        // If visited but savedChests is null, implies no chests.
        // Wait. spawnChests should be called only if !visited?
        // But generateLevel creates "visitedRooms" entry? No.
        // Globals.visitedRooms only stores rooms we stepped in.
        // Globals.levelMap stores ALL generated rooms.
        // If we visited (has entry in visitedRooms?), then we use saved state.
        // If savedChests is null and visited, means 0 chests.
        // If NOT visited, spawn from template.

        if (!Globals.visitedRooms[nextCoord]) {
            spawnChests(Globals.levelMap[nextCoord].roomData);
        }
    }

    // Spawn Switches (Always reload from template for now)
    if (Globals.levelMap[nextCoord]) {
        spawnSwitches(Globals.levelMap[nextCoord].roomData);
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
        // RESET PORTAL STATE ON ROOM CHANGE
        // This ensures portals from other rooms (like Start/Matrix) don't bleed over.
        if (Globals.portal) {
            Globals.portal.active = false;
            Globals.portal.finished = false;
            Globals.portal.scrapping = false;
            Globals.portal.color = null; // Reset color override
            Globals.portal.x = 0;
            Globals.portal.y = 0;
        }

        Globals.roomData = nextEntry.roomData;

        // MUSIC SWITCH LOGIC (Trophy Room)
        if (Globals.introMusic) {
            let desiredTrack = Globals.levelMusic || Globals.gameData.introMusic;

            if (Globals.roomData.type === 'trophy' || Globals.roomData._type === 'trophy') {
                desiredTrack = Globals.gameData.trophyMusic || 'assets/music/trophyroom.mp3';
            }

            // Check if we need to switch
            // Use loose check for filename match to avoid full URL issues
            const currentFilename = Globals.introMusic.src ? Globals.introMusic.src.split('/').pop() : "";
            const targetFilename = desiredTrack ? desiredTrack.split('/').pop() : "";

            if (targetFilename && currentFilename !== targetFilename) {
                log("Switching Room Music:", currentFilename, "->", targetFilename);
                Globals.introMusic.src = desiredTrack;
                if (!Globals.musicMuted && Globals.gameData.music) {
                    Globals.introMusic.play().catch(e => console.warn("Music Switch Play Blocked", e));
                }
            }
        }
        Globals.roomIntroEndTime = Globals.roomData.showIntro ? (Date.now() + 2000) : 0;
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
        Globals.roomNativeStart = now; // ABSOLUTE START TIME (For Speedy Bonus Calculation)
        log("Globals.roomStartTime set to FreezeUntil: " + Globals.roomStartTime);

        log(`Room Freeze Active: ${actualDuration}ms (Enemies Frozen, Player Invulnerable)`);

        // GHOST FOLLOW LOGIC
        // If ghost was chasing and follow is on, fast-forward the timer so he appears immediately
        // EXCLUDE: Start, Boss, Shop, Home, Matrix
        const isExcluded = Globals.player.roomX === 0 && Globals.player.roomY === 0 ||
            Globals.roomData.isBoss ||
            Globals.roomData.type === 'shop' ||
            Globals.roomData._type === 'home' ||
            Globals.roomData._type === 'matrix';

        if (shouldFollow && !isExcluded) {
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
            log("Globals.roomStartTime overridden by Ghost Logic: " + Globals.roomStartTime);

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
        log("Update running. State:", Globals.gameState, "Keys:", JSON.stringify(Globals.keys), "Player:", Globals.player.x, Globals.player.y);
    }

    // 0. Global Inputs (Restart/Menu from non-play states)
    if (handleGlobalInputs({ restartGame, goToWelcome, newRun })) return;

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
    // Removed updateChests from here to fix collision order

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
    // updateRestart(); // HANDLED BY INPUT.JS & GHOST TRAP BELOW
    // updateMusicToggle(); // Moved up (called below now)
    updateMusicToggle();
    updateSFXToggle();
    updateRemoteDetonation(); // Remote Bombs - Check BEFORE Use consumes space
    updateBombInteraction(); // Kick/Interact with Bombs
    if (Globals.keys["Space"]) updateUse();
    //if (Globals.ghostSpawned && !window.DEBUG_WINDOW_ENABLED) {
    //trapped by ghsot no escape, pause or new run
    //trapped by ghsot no escape, pause or new run
    if ((Globals.keys["KeyP"] || Globals.keys["KeyT"] || Globals.keys["KeyR"]) && Globals.gameData.pause !== false) {

        if (Globals.ghostSpawned) {
            // Find the ghost entity
            const ghost = Globals.enemies.find(e => e.type === 'ghost');
            if (ghost) {
                // Determine Speech Key based on Input
                let speechKey = "ghost_pause";
                if (Globals.keys["KeyR"]) speechKey = "ghost_restart";
                if (Globals.keys["KeyT"]) speechKey = "ghost_newgame";

                const ghostLore = Globals.speechData.types?.[speechKey] || ["You cannot escape me!!"];
                //pick a random line from the ghost lore
                const ghostLine = ghostLore[Math.floor(Math.random() * ghostLore.length)];

                triggerSpeech(ghost, speechKey, ghostLine, true);

                Globals.keys['KeyP'] = false; // consume key
                Globals.keys['KeyT'] = false; // consume key
                Globals.keys['KeyR'] = false; // consume key
            }
        }
        else {
            // Normal Pause (Only P reaches here for Pause Menu)
            if (Globals.keys["KeyP"]) {
                Globals.keys["KeyP"] = false; // Prevent repeated triggers
                gameMenu();
                return;
            }
            // If T/R reached here (unlikely if !ghostSpawned, as Input.js handles them), consume
            if (Globals.keys["KeyT"]) Globals.keys["KeyT"] = false;
            if (Globals.keys["KeyR"]) Globals.keys["KeyR"] = false;
        }
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

    updateChests(); // Resolve new position collision
    updateSwitches();

    // 3. Combat Logic
    updateShooting();
    // updateRemoteDetonation(); // moved up
    updateReload(); // Add reload state check
    updateBulletsAndShards(aliveEnemies); // Pass enemies for homing check
    updateEnemies(); // Enemy movement + player collision handled inside

    // Update Run Timer
    if (Globals.runStartTime > 0) {
        Globals.runElapsedTime = Date.now() - Globals.runStartTime;
    }

    // Update Ghost Time (Delta Time Calculation)
    const now = Date.now();
    const dt = now - (Globals.lastUpdate || now);
    Globals.lastUpdate = now;

    Globals.ghostTimerActive = Globals.enemies.some(e => e.type === 'ghost' && !e.isDead);
    if (Globals.ghostTimerActive) {
        Globals.ghostTime += dt;
        Globals.ghostTimeSurvived += dt;
        Globals.ghostTimeSessionSurvived += dt;
    }

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

// --- MATRIX RAIN GLOBAL EFFECT ---
function drawMatrixRain() {
    // Lazy Init Columns
    if (!Globals.matrixDrops || Globals.matrixDrops.length !== Math.floor(Globals.canvas.width / 20)) {
        const cols = Math.floor(Globals.canvas.width / 20);
        Globals.matrixDrops = Array.from({ length: cols }, () => ({
            y: Math.random() * Globals.canvas.height, // Random start
            speed: Math.random() * 5 + 3, // Fast fall (3-8)
            chars: "01"
        }));
    }

    Globals.ctx.save();
    Globals.ctx.font = '15px monospace';
    // Use semi-transparent context for trails? No, clearRect kills it.
    // Instead simulate trails by drawing head + tail segments

    Globals.matrixDrops.forEach((d, i) => {
        // Draw Head (Bright)
        Globals.ctx.fillStyle = '#0f0';
        const char = Math.random() > 0.5 ? "1" : "0";
        Globals.ctx.fillText(char, i * 20, d.y);

        // Draw Tail (Faint)
        Globals.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        Globals.ctx.fillText(Math.random() > 0.5 ? "1" : "0", i * 20, d.y - 15);
        Globals.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        Globals.ctx.fillText(Math.random() > 0.5 ? "1" : "0", i * 20, d.y - 30);

        // Move
        if (Math.random() > 0.98) d.y = 0; // Random Reset
        d.y += d.speed;

        // Wrap
        if (d.y > Globals.canvas.height) {
            d.y = 0;
            d.speed = Math.random() * 5 + 3;
        }
    });

    Globals.ctx.restore();
}

//draw loop
export async function draw() {
    if (Globals.isInitializing) {
        requestAnimationFrame(() => { draw(); });
        return;
    }
    const aliveEnemies = Globals.enemies.filter(en => !en.isDead);
    const roomLocked = isRoomLocked();
    const doors = Globals.roomData.doors || {};
    await updateUI();
    Globals.ctx.clearRect(0, 0, Globals.canvas.width, Globals.canvas.height);

    // Trophy Room Background (Ghostly Effect)
    if (Globals.roomData && (Globals.roomData.type === 'trophy' || Globals.roomData._type === 'trophy')) {
        const w = Globals.canvas.width;
        const h = Globals.canvas.height;

        // Dark Base
        Globals.ctx.fillStyle = "#020205";
        Globals.ctx.fillRect(0, 0, w, h);

        // Procedural Fog/Orbs
        Globals.ctx.save();
        Globals.ctx.globalCompositeOperation = "screen"; // Make it glowy!
        const time = Date.now() * 0.0002;
        for (let i = 0; i < 15; i++) {
            // Random-ish movement based on time and index
            const x = ((Math.sin(time + i * 132.1) + 1) / 2) * w;
            const y = ((Math.cos(time * 0.7 + i * 35.2) + 1) / 2) * h;
            const s = 100 + Math.sin(time * 2 + i) * 50;
            const alpha = 0.05 + (Math.sin(time + i) * 0.03); // Slightly boosted alpha

            Globals.ctx.fillStyle = `rgba(100, 220, 255, ${alpha})`;
            Globals.ctx.beginPath();
            Globals.ctx.arc(x, y, s, 0, Math.PI * 2);
            Globals.ctx.fill();
        }
        Globals.ctx.restore();

        // Vignette Overlay
        const grad = Globals.ctx.createRadialGradient(w / 2, h / 2, w / 3, w / 2, h / 2, w * 0.8);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,10,20,0.8)");
        Globals.ctx.fillStyle = grad;
        Globals.ctx.fillRect(0, 0, w, h);

        // Wanted Poster (If Ghost not killed)
        // Check both 'ghost' (normal) and 'ghost_trophy' (trophy room variant)
        const ghostKills = (Globals.killStatsTotal?.types?.ghost || 0) + (Globals.killStatsTotal?.types?.ghost_trophy || 0);

        if (ghostKills === 0) {
            const px = w / 2;
            const py = h / 2;

            Globals.ctx.save();
            Globals.ctx.translate(px, py);
            Globals.ctx.rotate(Math.sin(Date.now() * 0.001) * 0.05); // Subtle swing

            // FORCE DEFAULT COMPOSITE to avoid "weird mask" issues
            Globals.ctx.globalCompositeOperation = 'source-over';
            Globals.ctx.globalAlpha = 1.0;

            // Paper
            Globals.ctx.fillStyle = "#f4f1e1"; // Parchment
            Globals.ctx.fillRect(-80, -100, 160, 200); // Slightly larger
            Globals.ctx.strokeStyle = "#5d4037";
            Globals.ctx.lineWidth = 4;
            Globals.ctx.strokeRect(-80, -100, 160, 200);

            // Pin
            Globals.ctx.fillStyle = "#c0392b"; // Red Pin
            Globals.ctx.beginPath();
            Globals.ctx.arc(0, -85, 6, 0, Math.PI * 2);
            Globals.ctx.fill();

            // Text
            Globals.ctx.fillStyle = "#3e2723";
            Globals.ctx.textAlign = "center";
            Globals.ctx.font = "bold 24px monospace"; // Larger Header
            Globals.ctx.fillText("WANTED", 0, -60);

            Globals.ctx.font = "bold 20px monospace";
            Globals.ctx.fillText("DEAD", 0, 70);

            const ghostName = Globals.enemyTemplates?.ghost?.displayName || "Player Snr";

            // Auto-scale name if too long
            const maxW = 140;
            let fontSize = 20;
            Globals.ctx.font = `bold ${fontSize}px monospace`;
            while (Globals.ctx.measureText(ghostName).width > maxW && fontSize > 10) {
                fontSize--;
                Globals.ctx.font = `bold ${fontSize}px monospace`;
            }
            Globals.ctx.fillText(ghostName, 0, 90);

            // Ghost Sketch
            Globals.ctx.strokeStyle = "#3e2723";
            Globals.ctx.lineWidth = 2;
            Globals.ctx.beginPath();

            const r = 25;
            const gx = 0;
            const gy = -10;
            const skirtH = 30;

            // Head (Top Semicircle)
            Globals.ctx.arc(gx, gy, r, Math.PI, 0);

            // Right Side
            Globals.ctx.lineTo(gx + r, gy + skirtH);

            // Bottom Skirt (Waves Right to Left)
            const waves = 3;
            const wWidth = (r * 2) / waves;
            for (let i = 1; i <= waves; i++) {
                const wx = (gx + r) - (wWidth * i);
                const wy = gy + skirtH;
                const cX = (gx + r) - (wWidth * (i - 0.5));
                const cY = wy - 8;
                Globals.ctx.quadraticCurveTo(cX, cY, wx, wy);
            }
            Globals.ctx.lineTo(gx - r, gy); // Close Left side up

            Globals.ctx.closePath();
            Globals.ctx.stroke();

            // Eyes
            Globals.ctx.fillStyle = "#3e2723";
            Globals.ctx.beginPath();
            Globals.ctx.arc(gx - 8, gy - 5, 4, 0, Math.PI * 2); // Left Eye
            Globals.ctx.arc(gx + 8, gy - 5, 4, 0, Math.PI * 2); // Right Eye
            Globals.ctx.fill();

            // Mouth (O shape)
            Globals.ctx.beginPath();
            Globals.ctx.arc(gx, gy + 15, 6, 0, Math.PI * 2);
            Globals.ctx.stroke();


            Globals.ctx.restore();
        }
    }

    // Global Matrix Effect (Background)
    if (Globals.roomData && Globals.roomData.name === "Guns Lots of Guns") {
        Globals.portal.active = true;
        Globals.roomData.isBoss = true;
        // Fix: Set Coordinates so it draws on screen (center)
        Globals.portal.x = Globals.canvas.width / 2;
        Globals.portal.y = Globals.canvas.height / 2;
        Globals.portal.color = 'green';

        drawMatrixRain();
        // createPortal is drawn at end of loop if active
    }
    // Ghost Trap Effect
    if (Globals.ghostTrapActive) {
        drawGhostBorder();
    }

    drawShake()
    drawDoors()
    drawBossSwitch() // Draw switch underneath entities
    drawStartRoomObjects(); // New: Draw start room specific floor items
    drawHomeRoomObjects();
    drawSwitches();
    drawPortal(); // Draw portal on floor
    drawPlayer()
    drawBulletsAndShards()
    drawBombs(doors)
    drawChests()
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

    // --- DRAW ROOM SHRINK VOID ---
    if (Globals.roomShrinkSize > 0) {
        Globals.ctx.fillStyle = "black";
        const s = Globals.roomShrinkSize;
        const w = Globals.canvas.width;
        const h = Globals.canvas.height;

        // Top
        Globals.ctx.fillRect(0, 0, w, s);
        // Bottom
        Globals.ctx.fillRect(0, h - s, w, s);
        // Left
        Globals.ctx.fillRect(0, 0, s, h);
        // Right
        Globals.ctx.fillRect(w - s, 0, s, h);
        if (typeof Globals.ghostRoomShrinkCount !== 'number') Globals.ghostRoomShrinkCount = 0;
        Globals.ghostRoomShrinkCount++;

        // every 500 frames (approx 8s), ONLY if playing (not Game Over)
        // using 4 instead of STATES.GAMEOVER (which is likely 4 or 3)
        // Safest: Check player HP > 0
        if (Globals.ghostRoomShrinkCount % 500 === 0 && Globals.player.hp > 0) {
            //make the ghost say something from ghost_room_shrink using lore
            const ghostLore = Globals.speechData.types?.ghost_room_shrink || ["COME TO ME!"];
            //pick a random line from the ghost lore
            const ghostLine = ghostLore[Math.floor(Globals.random() * ghostLore.length)];

            // Find the ghost entity
            const ghost = Globals.enemies.find(e => e.type === 'ghost');
            if (ghost) {
                triggerSpeech(ghost, "ghost_room_shrink", ghostLine, true);
            }

        }
    }
    drawStatsPanel();
    drawMinimap();
    if (!DEBUG_FLAGS.TEST_ROOM) drawTutorial();
    drawBossIntro();
    drawRoomIntro();
    // drawPortal() moved to before drawPlayer
    drawFloatingTexts(); // Draw notification texts on top
    drawDebugLogs();
    requestAnimationFrame(() => { update(); draw(); });
}

export function drawPortal(overrideColor = null) {
    // Only draw if active
    // log(Globals.portal.active + ' ' + Globals.roomData.isBoss) // Remove debug log?
    if (!Globals.portal.active) return;
    const time = Date.now() / 500;

    Globals.ctx.save();
    Globals.ctx.translate(Globals.portal.x, Globals.portal.y);

    // Determine Colors based on Room (Matrix Room = Green/Used)
    let mainColor = "#8e44ad"; // Default Purple
    let glowColor = "#8e44ad";
    let swirlColor = "#ffffff";

    // Check Override, Portal Obj Prop, or Room Name (Deprecated room name check)
    const colorMode = overrideColor || Globals.portal.color || 'purple';

    if (colorMode === 'green') {
        mainColor = "#2ecc71"; // Matrix Green
        glowColor = "#00ff00"; // Bright Green
        swirlColor = "#aaffaa"; // Light Green Swirl
    }

    // Outer glow
    Globals.ctx.shadowBlur = 20;
    Globals.ctx.shadowColor = glowColor;

    // Portal shape
    Globals.ctx.fillStyle = mainColor;
    Globals.ctx.beginPath();
    Globals.ctx.ellipse(0, 0, 30, 50, 0, 0, Math.PI * 2);
    Globals.ctx.fill();

    // Swirl effect
    Globals.ctx.strokeStyle = swirlColor;
    Globals.ctx.lineWidth = 3;
    Globals.ctx.beginPath();
    Globals.ctx.ellipse(0, 0, 20 + Math.sin(time) * 5, 40 + Math.cos(time) * 5, time, 0, Math.PI * 2);
    Globals.ctx.stroke();

    Globals.ctx.restore();
}

export function drawSwitch(cx = Globals.canvas.width / 2, cy = Globals.canvas.height / 2, size = 40) {


    Globals.ctx.save();
    Globals.ctx.fillStyle = "#9b59b6"; // Purple
    Globals.ctx.fillRect(cx - size / 2, cy - size / 2, size, size);

    // Optional: Add a border or inner detail to look like a switch plate
    Globals.ctx.strokeStyle = "#8e44ad";
    Globals.ctx.lineWidth = 4;
    Globals.ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

    Globals.ctx.restore();
}

export function drawBossSwitch() {
    if (!Globals.roomData.isBoss) return;
    drawSwitch()
}

export function drawStartRoomObjects() {
    // Check if we are in Start Room
    if (Globals.roomData.name == "The Beginning" && Globals.player.roomX === 0 && Globals.player.roomY === 0) {

    }
}

export function drawHomeRoomObjects() {
    if (Globals.roomData.type !== 'home' && Globals.roomData._type !== 'home') return;

    Globals.ctx.save();

    // Draw Bed (Top Left)
    Globals.ctx.fillStyle = "#34495e"; // Bed Frame
    Globals.ctx.fillRect(50, 50, 80, 140);
    Globals.ctx.fillStyle = "#ecf0f1"; // Mattress/Sheets
    Globals.ctx.fillRect(55, 80, 70, 105);
    Globals.ctx.fillStyle = "#bdc3c7"; // Pillow
    Globals.ctx.fillRect(60, 55, 60, 20);

    // Draw Table (Center)
    Globals.ctx.fillStyle = "#8e44ad"; // Table top
    Globals.ctx.beginPath();
    Globals.ctx.arc(200, 200, 45, 0, Math.PI * 2);
    Globals.ctx.fill();
    Globals.ctx.lineWidth = 4;
    Globals.ctx.strokeStyle = "#9b59b6";
    Globals.ctx.stroke();

    // Draw TV (Top Right)
    Globals.ctx.fillStyle = "#2c3e50"; // TV Stand
    Globals.ctx.fillRect(270, 40, 100, 20);
    Globals.ctx.fillStyle = "#34495e"; // TV Border
    Globals.ctx.fillRect(280, 30, 80, 10);
    Globals.ctx.fillRect(260, -20, 120, 60);
    Globals.ctx.fillStyle = "#111"; // Screen
    Globals.ctx.fillRect(265, -15, 110, 50);

    // TV Static/Glow
    Globals.ctx.fillStyle = "rgba(41, 128, 185, 0.4)";
    Globals.ctx.fillRect(265, -15, 110, 50);
    if (Math.random() > 0.8) {
        Globals.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        for (let i = 0; i < 5; i++) {
            Globals.ctx.fillRect(265, -15 + Math.random() * 45, 110, 2);
        }
    }

    // Draw Piggy Bank (Bottom Left)
    const px = 100, py = 320;

    // Body (Pink ellipse)
    Globals.ctx.fillStyle = "#ffb6c1"; // light pink
    Globals.ctx.beginPath();
    Globals.ctx.ellipse(px, py, 25, 20, 0, 0, Math.PI * 2);
    Globals.ctx.fill();
    Globals.ctx.lineWidth = 2;
    Globals.ctx.strokeStyle = "#ff69b4"; // hot pink border
    Globals.ctx.stroke();

    // Snout
    Globals.ctx.fillStyle = "#ffc0cb"; // slightly different pink
    Globals.ctx.beginPath();
    Globals.ctx.ellipse(px + 23, py, 8, 12, 0, 0, Math.PI * 2);
    Globals.ctx.fill();
    Globals.ctx.stroke();

    // Eye
    Globals.ctx.fillStyle = "#2c3e50";
    Globals.ctx.beginPath();
    Globals.ctx.arc(px + 12, py - 5, 2, 0, Math.PI * 2);
    Globals.ctx.fill();

    // Coin Slot
    Globals.ctx.fillStyle = "#34495e";
    Globals.ctx.fillRect(px - 5, py - 15, 10, 3);

    // Legs
    Globals.ctx.fillStyle = "#ff69b4";
    Globals.ctx.fillRect(px - 15, py + 15, 6, 8);
    Globals.ctx.fillRect(px + 5, py + 15, 6, 8);

    // Tail (Curly)
    Globals.ctx.beginPath();
    Globals.ctx.arc(px - 25, py - 5, 4, 0, Math.PI);
    Globals.ctx.stroke();

    // Proximity Prompt
    const pbDist = Math.hypot(Globals.player.x - px, Globals.player.y - py);
    if (pbDist < 60) {
        Globals.ctx.fillStyle = "white";
        Globals.ctx.font = "14px monospace";
        Globals.ctx.textAlign = "center";
        // Globals.ctx.fillText("Press Space to open bank", px, py - 40);
        spawnFloatingText(Globals.player.x, Globals.player.y - 40, "Press Space to open bank", "white");

    }

    Globals.ctx.restore();
}

export function updateMusicToggle() {
    // If music is NOT enabled (either via config or unlock), do not allow toggling
    // Check both GameData (instant ref) and Storage (persistence ref)
    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
    const isUnlocked = Globals.gameData.music || unlockedIds.includes('music');
    if (!isUnlocked) {
        // Ensure it stays muted if locked
        if (!Globals.musicMuted) Globals.musicMuted = true;
        return;
    }

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
            // Allow START(0), PLAY(1), GAMEOVER(2), GAMEMENU(3), WIN(4)
            if ([0, 1, 2, 3, 4].includes(Globals.gameState)) {
                fadeIn(introMusic, 5000); // Smooth fade in
            }
        }
        localStorage.setItem('music_muted', Globals.musicMuted);
    }

}

export function updateRoomTransitions(doors, roomLocked) {
    // --- 8. ROOM TRANSITIONS ---
    const t = 50;
    // Check if we are in a Trophy Room or Secret Room (Force Unlock logic for exiting)
    const isSecretExit = (Globals.roomData.type === 'trophy' || Globals.roomData._type === 'trophy' || Globals.roomData.isSecret);
    const triggerDist = t;

    // PREVENT INSTANT BACK-TRANSITION
    // Wait for 500ms after room start before allowing another transition
    // EXCEPTION: Secret Exits can be exited immediately
    if (!isSecretExit && Date.now() - Globals.roomStartTime < 500) return;

    // Constraint for center alignment
    const doorW = 50;
    const shrink = Globals.roomShrinkSize || 0;

    // Unified Door Handler
    const attemptDoor = (door, dx, dy) => {
        // 1. Basic Validity & Visibility Check
        if (!door || !door.active || door.hidden) return;

        // 2. Position Check
        let inRange = false;
        if (dx === -1) { // Left
            const doorY = door.y !== undefined ? door.y : Globals.canvas.height / 2;
            inRange = (Globals.player.x < triggerDist + shrink) && (Math.abs(Globals.player.y - doorY) < doorW);
        } else if (dx === 1) { // Right
            const doorY = door.y !== undefined ? door.y : Globals.canvas.height / 2;
            inRange = (Globals.player.x > Globals.canvas.width - triggerDist - shrink) && (Math.abs(Globals.player.y - doorY) < doorW);
        } else if (dy === -1) { // Top
            const doorX = door.x !== undefined ? door.x : Globals.canvas.width / 2;
            inRange = (Globals.player.y < triggerDist + shrink) && (Math.abs(Globals.player.x - doorX) < doorW);
        } else if (dy === 1) { // Bottom
            const doorX = door.x !== undefined ? door.x : Globals.canvas.width / 2;
            inRange = (Globals.player.y > Globals.canvas.height - triggerDist - shrink) && (Math.abs(Globals.player.x - doorX) < doorW);
        }

        if (!inRange) return;

        // 3. Input Check (Directional)
        let hasKeyInput = false;
        if (dx === -1) hasKeyInput = (Globals.keys['KeyA'] || Globals.keys['ArrowLeft']);
        if (dx === 1) hasKeyInput = (Globals.keys['KeyD'] || Globals.keys['ArrowRight']);
        if (dy === -1) hasKeyInput = (Globals.keys['KeyW'] || Globals.keys['ArrowUp']);
        if (dy === 1) hasKeyInput = (Globals.keys['KeyS'] || Globals.keys['ArrowDown']);

        if (!hasKeyInput) return;

        // 4. Lock & Access Logic
        // Force conversion to number, default to 0
        let lockVal = parseInt(door.locked, 10);
        if (isNaN(lockVal)) lockVal = 0;

        //console.log(`Door Check: ${dx},${dy} | Locked: ${door.locked} | Parsed: ${lockVal}`);

        let allowed = false;
        let promptY = Globals.player.y - 60;
        if (door.x == 400) promptY = Globals.player.y + 60; // Adjust for Top/Bottom doors

        // STRICT HIERARCHY: Specific Locks override generic "Unlocked" status
        if (lockVal === 2) { // Home Key
            if (Globals.player.inventory.houseKey) {
                // Interaction Required
                spawnFloatingText(Globals.player.x, promptY, "Press SPACE to open Home Room", "#fff", 2);

            } else {
                spawnFloatingText(Globals.player.x, promptY, "Need House Key!", "#ff0000", 2);
            }
        } else if (lockVal === 3) { // Matrix Key
            if (Globals.player.inventory.matrixKey) {
                spawnFloatingText(Globals.player.x, promptY, "Press SPACE to open Matrix Room", "#fff", 2);


            } else {
                spawnFloatingText(Globals.player.x, promptY, "Need Matrix Key!", "#ff0000", 2);
            }
        } else if (lockVal === 1) { // Standard Key
            // Interaction Required (Unified Logic)
            if (Globals.player.inventory.keys > 0) {
                log("Press SPACE to open door");
                spawnFloatingText(Globals.player.x, promptY, "Press SPACE", "#fff", 2);


            } else if (door.forcedOpen || isSecretExit) {
                // Allow passing through standard locked door if it's forced open or we are exiting secret room
                allowed = true;
            } else {
                spawnFloatingText(Globals.player.x, promptY, "Key Required!", "#ff0000", 2);
            }
        } else {
            // Unlocked (0)
            // Implicitly allow IF lockVal is 0. 
            // If it's some other weird number, Block it? 
            // console.log("Door Unlocked:", lockVal);
            //if (lockVal === 0) {
            allowed = true;

            /* } else {
                console.warn("Unknown Lock Value Blocked:", lockVal);
                allowed = false;
            } */
        }

        // 5. Execution
        if (!allowed) {
            return;
        }

        // Room Locked Check (Combat Lock)
        // If the door is ALLOWED (unlocked/key used), we still check if the ROOM itself prevents exit.
        // Exception: Secret Exits and Forced Open doors bypass Combat Lock.
        if (roomLocked && !door.forcedOpen && !isSecretExit) {
            // implicit block by enemies
            return;
        }

        changeRoom(dx, dy);
    };

    attemptDoor(doors.left, -1, 0);
    attemptDoor(doors.right, 1, 0);
    attemptDoor(doors.top, 0, -1);
    attemptDoor(doors.bottom, 0, 1);
}

export function isRoomLocked() {
    // Trophy Rooms are NEVER locked, regardless of enemies (trophies) inside
    // Add logging to verify this is called
    if (Globals.roomData.type === 'trophy' || Globals.roomData._type === 'trophy' || Globals.roomData.isSecret) {
        // log("isRoomLocked: False (Trophy/Secret Override)"); // Too spammy? Maybe occasional?
        return false;
    }

    const aliveEnemies = Globals.enemies.filter(en => !en.isDead && !en.indestructible);

    // 1. Any normal enemy -> LOCK
    const nonGhostEnemies = aliveEnemies.filter(en => en.type !== 'ghost' && en.type !== 'ghost_trophy');
    if (nonGhostEnemies.length > 0) return true;

    // 2. Ghost enemy -> LOCK only if it has triggered the lock
    const ghost = aliveEnemies.find(en => en.type === 'ghost');
    if (ghost && ghost.locksRoom) return true;

    return false;
}

Globals.isRoomLocked = isRoomLocked;

export function updateRoomLock() {
    // --- 2. ROOM & LOCK STATUS ---
    const roomLocked = isRoomLocked();

    // --- GHOST MUSIC LOGIC ---
    // If not already detected, check if ghost is trapping player
    const activeGhost = Globals.enemies.find(en => en.type === 'ghost');
    const isGhostTrap = activeGhost && activeGhost.locksRoom;

    if (isGhostTrap && !Globals.ghostTrapActive) {
        // Trap Started - FORCE PLAY GHOST MUSIC (Override mute/lock)
        if (introMusic) {
            // Store previous state (was it playing Tron?)
            if (Globals.wasMusicPlayingBeforeGhost === undefined) Globals.wasMusicPlayingBeforeGhost = !introMusic.paused;

            log("GHOST TRAP: Switching to Ghost Music and FORCING Play. Previous:", Globals.wasMusicPlayingBeforeGhost);
            introMusic.src = Globals.gameData.ghostMusic || 'assets/music/ghost.mp3';
            introMusic.volume = 0.4; // Force Volume Up (Override mute)
            // Force Play
            introMusic.play().then(() => log("Ghost Music Started")).catch((e) => { console.error("Ghost Music Force Play Failed:", e); });
            Globals.ghostTrapActive = true;
        }
    } else if (!isGhostTrap && Globals.ghostTrapActive) {
        // Trap Ended - Revert to Tron and Previous State
        if (introMusic) {
            let revertSrc = Globals.gameData.introMusic;
            // Check for level override (merged into gameData.music as string?)
            if (typeof Globals.gameData.music === 'string') {
                revertSrc = Globals.gameData.music;
            }
            introMusic.src = revertSrc;
            if (Globals.wasMusicPlayingBeforeGhost) {
                introMusic.play().catch(() => { });
            } else {
                introMusic.pause(); // Return to silence if it was silenced
            }
            Globals.ghostTrapActive = false;
            Globals.wasMusicPlayingBeforeGhost = undefined;
        }
    }
    const doors = Globals.roomData.doors || {};

    // Check if we expect enemies but none are present (meaning spawn failed or hasn't happened yet)
    // This handles the instant-clear racing condition on room entry
    const expectsEnemies = Globals.roomData.enemies && Globals.roomData.enemies.length > 0;
    const hasEnemiesList = Globals.enemies && Globals.enemies.length > 0;

    // Auto-fix Dead-on-Arrival Bug (Speedy Bonus Exploit Fix)
    // If room just started (< 1000ms after freeze ends) and all enemies are dead but shouldn't be
    const timeSinceFreeze = Date.now() - (Globals.roomFreezeUntil || 0);
    // Use a negative buffer because freezeUntil might be in future slightly or just passed
    // We care if we are within the first second of gameplay.
    const isEarlyGame = timeSinceFreeze > -1500 && timeSinceFreeze < 1000;

    if (!roomLocked && expectsEnemies && hasEnemiesList && !Globals.roomData.cleared && isEarlyGame) {
        // Check if all spawned enemies are dead (which is impossible for player to do instantly)
        const allDead = Globals.enemies.every(en => en.isDead || en.hp <= 0);

        if (allDead) {
            console.warn("Detected Dead-on-Arrival Glitch! Reviving enemies to enforce gameplay.");
            Globals.enemies.forEach(en => {
                if (en.isDead || en.hp <= 0) {
                    en.isDead = false;
                    en.hp = Math.max(en.maxHp || 1, 1);
                    if (en.baseStats) {
                        if (!en.baseStats.hp || en.baseStats.hp <= 0) en.baseStats.hp = en.hp;
                    } else {
                        en.baseStats = { hp: en.hp, speed: en.speed || 1, damage: en.damage || 1 };
                    }
                    en.deathTimer = undefined; // Reset despawn timer
                }
            });
            // Force roomLocked to true for this frame so we don't clear
            // But relies on isRoomLocked() next frame which will be true (since we revived them)
            return;
        }
    }

    if (expectsEnemies && !hasEnemiesList && !Globals.roomData.cleared) {
        // Room expects enemies, but none found in list. 
        // Do not clear. Wait for spawnEnemies() to populate list.
        return;
    }

    if (!roomLocked && !Globals.roomData.cleared) {
        // Prevent clearing room instantly during freeze/spawn time
        // This stops "Speedy Bonus" from triggering before enemies even spawn
        if (Globals.roomFreezeUntil && Date.now() < Globals.roomFreezeUntil) return;

        Globals.roomData.cleared = true;
        const currentCoord = `${Globals.player.roomX},${Globals.player.roomY}`; // Fixed space typo
        if (Globals.visitedRooms[currentCoord]) Globals.visitedRooms[currentCoord].cleared = true;

        // Trigger Room Rewards
        if (Globals.roomData.item) {
            spawnRoomRewards(Globals.roomData.item);
        }

        // --- SPEEDY BONUS ---
        // Calculate Time Taken using STABLE timer (Globals.roomNativeStart)
        // Subtract freeze duration to be fair (only gameplay time counts)
        const freezeEnd = Globals.roomFreezeUntil || Globals.roomNativeStart || 0;
        const timeTakenMs = Date.now() - freezeEnd; // Time since freeze ended

        // Require minimum time to disqualify glitches (e.g. 100ms)
        const isGlitch = timeTakenMs < 100;
        const speedyLimitMs = (Globals.roomData.speedGoal !== undefined) ? Globals.roomData.speedGoal : 5000;
        log(`Room Cleared! TimeTaken: ${timeTakenMs}ms, Limit: ${speedyLimitMs}ms (Start: ${freezeEnd}, Now: ${Date.now()})`);

        // Fix: check timeTakenMs > 100 to avoid glitch "instant clears"
        if (speedyLimitMs > 0 && timeTakenMs > 100 && timeTakenMs <= speedyLimitMs) {
            log("SPEEDY BONUS AWARDED!");
            Globals.speedyBonusCount++;
            Globals.speedyBonusSessionCount++;
            if (Globals.gameData.rewards && Globals.gameData.rewards.speedy) {
                const dropped = spawnRoomRewards(Globals.gameData.rewards.speedy);
                if (dropped) {
                    spawnFloatingText(Globals.player.x, Globals.player.y - 40, "SPEEDY BONUS!", "#3498db");
                    // Do not reset streak? Speedy is timer based. No streak.
                }
            }
        } else {
            log("Speedy Bonus Missed (or disabled).");
        }

        // --- PERFECT BONUS (STREAK) ---
        // Check if no damage taken in this room AND room had enemies
        const hasCombat = Globals.roomData.enemies && Globals.roomData.enemies.some(e => (e.count || 0) > 0);

        // Accuracy Check: No Missed Shots (hits >= bullets)
        // Note: Using >= to allow for piercing/explosions counting > 100% which is fine.
        const perfectAccuracy = (Globals.hitsInRoom >= Globals.bulletsInRoom);

        // --- PERFECT STREAK ---
        if (!Globals.player.tookDamageInRoom && hasCombat && perfectAccuracy) {
            Globals.perfectRoomCount++;
            Globals.perfectRoomSessionCount++;
            Globals.perfectStreak++;
            const goal = Globals.gameData.perfectGoal || 3;

            if (Globals.perfectStreak >= goal) {
                if (Globals.gameData.rewards && Globals.gameData.rewards.perfect) {
                    const dropped = spawnRoomRewards(Globals.gameData.rewards.perfect);
                    if (dropped) {
                        spawnFloatingText(Globals.player.x, Globals.player.y - 80, "PERFECT BONUS!", "#9b59b6");
                        Globals.perfectStreak = 0;
                    }
                }
            }
        } else if (Globals.player.tookDamageInRoom || (hasCombat && !perfectAccuracy)) {
            Globals.perfectStreak = 0; // Reset streak if hit OR missed a shot
        }

        // --- NO DAMAGE STREAK ---
        if (!Globals.player.tookDamageInRoom && hasCombat) {
            Globals.noDamageStreak++;
            const goal = Globals.gameData.noDamageGoal || 3;
            if (Globals.noDamageStreak >= goal) {
                if (Globals.gameData.rewards && Globals.gameData.rewards.noDamage) {
                    const dropped = spawnRoomRewards(Globals.gameData.rewards.noDamage);
                    if (dropped) {
                        spawnFloatingText(Globals.player.x, Globals.player.y - 40, "NO DAMAGE BONUS!", "#e74c3c");
                        Globals.noDamageStreak = 0;
                    }
                }
            }
        } else if (Globals.player.tookDamageInRoom) {
            Globals.noDamageStreak = 0;
        }

        // --- SHOOTER STREAK ---
        if (perfectAccuracy && hasCombat) {
            Globals.shooterStreak++;
            const goal = Globals.gameData.shooterGoal || 3;
            if (Globals.shooterStreak >= goal) {
                if (Globals.gameData.rewards && Globals.gameData.rewards.shooter) {
                    const dropped = spawnRoomRewards(Globals.gameData.rewards.shooter);
                    if (dropped) {
                        spawnFloatingText(Globals.player.x, Globals.player.y - 60, "SHARP SHOOTER!", "#f39c12");
                        Globals.shooterStreak = 0;
                    }
                }
            }
        } else if (hasCombat && !perfectAccuracy) {
            Globals.shooterStreak = 0;
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
        let s = Globals.screenShake.power * ((Globals.screenShake.endAt - now) / 180);

        // TELEPORT GLITCH BOOST
        if (Globals.screenShake.teleport) {
            s *= 3; // Super Shake
            // Random Color Flash (Digital Artifact)
            const color = Math.random() > 0.5 ? "cyan" : "magenta";
            Globals.ctx.fillStyle = color;
            Globals.ctx.globalAlpha = 0.2;
            Globals.ctx.fillRect(0, 0, Globals.canvas.width, Globals.canvas.height);
            Globals.ctx.globalAlpha = 1.0;
        }

        Globals.ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    else {
        // Reset Logic when shake ends
        if (Globals.screenShake.power > 0) {
            Globals.screenShake.power = 0;
            Globals.screenShake.teleport = 0;
        }
    }
}

export function drawDoors() {
    const roomLocked = isRoomLocked();
    const doors = Globals.roomData.doors || {};
    Object.entries(doors).forEach(([dir, door]) => {
        if (!door.active) return;

        let color = "#222"; // default open

        if (door.hidden) {
            // Hidden = Invisible (matches wall)
            // We simply don't draw it, OR we draw it as a wall if needed. 
            // But existing logic "continues" loop if !active. 
            // If active=1 and hidden=1, we skip drawing the door rect?
            // Actually, if we return, it looks like a gap?
            // No, walls are drawn by room background. Doors are drawn ON TOP.
            // So if we RETURN, we see the background/wall. Correct.
            return;
        } else if (roomLocked && !door.forcedOpen) {
            color = "#c0392b"; // red if locked by enemies
        } else if (door.locked) {
            color = "#f1c40f"; // yellow if locked by key
        }

        Globals.ctx.fillStyle = color;
        const dx = door.x ?? Globals.canvas.width / 2, dy = door.y ?? Globals.canvas.height / 2;
        const s = Globals.roomShrinkSize || 0;

        if (dir === 'top') Globals.ctx.fillRect(dx - DOOR_SIZE / 2, 0 + s, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'bottom') Globals.ctx.fillRect(dx - DOOR_SIZE / 2, Globals.canvas.height - DOOR_THICKNESS - s, DOOR_SIZE, DOOR_THICKNESS);
        if (dir === 'left') Globals.ctx.fillRect(0 + s, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);
        if (dir === 'right') Globals.ctx.fillRect(Globals.canvas.width - DOOR_THICKNESS - s, dy - DOOR_SIZE / 2, DOOR_THICKNESS, DOOR_SIZE);

        // DEBUG: Draw Hitbox Overlay
        const dit = true; // Enabled per user request
        if (dit) {
            Globals.ctx.save();
            Globals.ctx.strokeStyle = "magenta";
            Globals.ctx.lineWidth = 2;
            const doorRangeW = DOOR_SIZE; // +/- DOOR_SIZE from center = 2*DOOR_SIZE width
            const doorRangeH = 45; // BOUNDARY (20) + TOLERANCE (25)
            //show if debug is active

            if (DEBUG_FLAGS.WINDOW) {
                if (dir === 'top') Globals.ctx.strokeRect(dx - doorRangeW, 0, doorRangeW * 2, doorRangeH);
                if (dir === 'bottom') Globals.ctx.strokeRect(dx - doorRangeW, Globals.canvas.height - doorRangeH, doorRangeW * 2, doorRangeH);
                if (dir === 'left') Globals.ctx.strokeRect(0, dy - doorRangeW, doorRangeH, doorRangeW * 2);
                if (dir === 'right') Globals.ctx.strokeRect(Globals.canvas.width - doorRangeH, dy - doorRangeW, doorRangeH, doorRangeW * 2);
            }
            Globals.ctx.restore();
        }

    });
}

export function gameOver() {
    Globals.gameOver = gameOver; // Re-assign if needed, or ensure it's set

    // Determine state if not already set (default to GAMEOVER if just called independently)
    if (Globals.gameState !== STATES.WIN) Globals.gameState = STATES.GAMEOVER;

    // Save Persistent Stats (Lifetime)
    // Note: session stats are reset on next run, so current values are added to lifetime logic in saveGameStats.
    saveGameStats();

    Globals.elements.overlay.style.display = 'flex';
    // Fix: Count unique visited rooms instead of displacement
    Globals.elements.stats.innerText = getGameStats(0);

    const h1 = document.querySelector('#overlay h1');
    if (Globals.gameState === STATES.WIN) {
        h1.innerText = "VICTORY!";
    } else {
        h1.innerText = "Game Over";
        h1.style.color = "red";
    }

    // Show/Hide Layout based on Win/Loss
    const continueBtn = Globals.elements.overlay.querySelector('#continueBtn');
    const menuBtn = Globals.elements.overlay.querySelector('#menuBtn');
    const restartBtn = Globals.elements.overlay.querySelector('#restartBtn');
    const newRunBtn = Globals.elements.overlay.querySelector('#newRunBtn');

    // Add Seed Display
    let seedEl = document.getElementById('game-over-seed');
    if (!seedEl) {
        seedEl = document.createElement('div');
        seedEl.id = 'game-over-seed';
        seedEl.style.color = '#888';
        seedEl.style.marginTop = '10px';
        seedEl.style.fontFamily = 'monospace';
        // Insert before buttons container (which is usually flex column at bottom?)
        // Let's insert after stats
        Globals.elements.stats.parentNode.insertBefore(seedEl, Globals.elements.stats.nextSibling);
    }
    seedEl.innerText = `Seed: ${Globals.seed || 'Unknown'}`;

    if (Globals.gameState === STATES.WIN) {
        // Victory: Show Continue (Enter)
        continueBtn.style.display = 'block';
        continueBtn.innerText = "Continue (Enter) ";
        menuBtn.style.display = 'none'; // Hide Menu button on Victory? Or Keep it mapped to M?
        // Let's keep Menu visible but maybe mapped to M?
        // User asked for "Main Menu (Enter)" for DEATH popup. 
        // For Victory, they asked for "Enter to Continue".

        restartBtn.style.display = 'none';
        if (newRunBtn) newRunBtn.style.display = 'none';
    } else {
        // Death (Game Over)
        // Request: "Main Menu (Enter)"
        continueBtn.style.display = 'none'; // Hide continue on death (unless we want the revive hack visible)
        // If I hide continue, M/C keys still work.

        menuBtn.style.display = 'block';
        menuBtn.innerText = "Main Menu (Enter)";

        restartBtn.style.display = 'block';
        if (newRunBtn) newRunBtn.style.display = 'block';
    }
}

export function gameWon() {
    Globals.gameState = STATES.WIN;

    // Play End Game Music if configured and allowed
    // Play End Game Music if configured and allowed
    if (Globals.gameData.music) {
        const endMusic = Globals.gameData.endGameMusic || 'assets/music/endgame.mp3';
        if (!introMusic.src || !introMusic.src.includes(endMusic.split('/').pop())) {
            introMusic.src = endMusic;
            introMusic.play().catch(e => console.warn("Failed to play end music", e));
            log("Playing End Game Music:", endMusic);
        }
    }

    // Stats Update
    Globals.gameBeatCount++;
    Globals.gameBeatSessionCount++;
    if (Globals.BestRunTime === 0 || Globals.SessionRunTime < Globals.BestRunTime) {
        Globals.BestRunTime = Globals.SessionRunTime;
        localStorage.setItem('bestRunTime', Globals.BestRunTime);
    }

    // Persist all stats
    saveGameStats();

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
    overlayEl.querySelector('#continueBtn').innerText = "Continue (Enter)";

    overlayEl.querySelector('#restartBtn').style.display = '';

    // Show New Run Button
    const newRunBtn = overlayEl.querySelector('#newRunBtn');
    if (newRunBtn) {
        newRunBtn.style.display = '';
        newRunBtn.innerText = "New Run (T)";
    }

    // Show Main Menu Button
    const menuBtn = overlayEl.querySelector('#menuBtn');
    menuBtn.style.display = '';
    menuBtn.innerText = "Main Menu (M)";
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

export async function restartGame(keepItems = false, targetLevel = null) {
    const isDebug = Globals.gameData && (
        Globals.gameData.showDebugWindow !== undefined
            ? Globals.gameData.showDebugWindow
            : (Globals.gameData.debug && Globals.gameData.debug.windowEnabled === true)
    );
    if (!keepItems && !isDebug) resetWeaponState();

    // Trigger "Cool Teleport Effect" (Glitch Shake)
    Globals.screenShake.power = 20;
    Globals.screenShake.endAt = Date.now() + 600;
    Globals.screenShake.teleport = 1;
    SFX.restart();

    // Wait for init to complete, then auto-start
    await initGame(true, targetLevel, keepItems);
    // startGame is called by initGame internal logic (via shouldAutoStart)
}
Globals.restartGame = restartGame;

export async function newRun(targetLevel = null) {

    log("Starting New Run (Fresh Seed)");
    resetWeaponState();
    // Generate new seed manually here before calling init (as init handles restart specially)
    // Actually, calling initGame(false) treats it as a "New Game" which generates a random seed!
    // BUT initGame(false) shows the Welcome Screen by default (shouldAutoStart check).
    // If we want to skip welcome and start immediately:

    // 1. Set seed
    const newSeed = Math.floor(Math.random() * 999999);
    Globals.setSeed(newSeed);

    // Trigger "Cool Teleport Effect" (Glitch Shake)
    Globals.screenShake.power = 20;
    Globals.screenShake.endAt = Date.now() + 600;
    Globals.screenShake.teleport = 1;
    SFX.restart();

    // CRITICAL: We must clear the input box so startGame() doesn't overwrite our new random seed with the old input value.
    const seedInput = document.getElementById('seedInput');
    if (seedInput) seedInput.value = "";

    // 2. Call initGame as if it's a restart (to skip welcome) but with the NEW seed already set?
    await initGame(true, targetLevel);
}
Globals.newRun = newRun;

export function goToWelcome() {
    saveGameStats();
    resetWeaponState();
    initGame(false);
}
Globals.goToWelcome = goToWelcome;

export function beginPlay() {
    log("TRACER: beginPlay Called. GameState=", Globals.gameState);
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
        log("Globals.roomStartTime shifted by " + pausedDuration + " to " + Globals.roomStartTime);
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
    import('./Entities.js').then(m => {
        m.spawnEnemyAt(type, x, y, overrides);
    });
};

export async function handleUnlocks(unlockKeys) {
    Globals.handleUnlocks = handleUnlocks; // Expose for Entities
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
        Globals.keys = {}; // Clear inputs to prevent stuck movement after modal closes

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

            // SPECIAL: Instant Music Play
            if (key === 'music') {
                log("Music Unlocked! Playing immediately...");
                Globals.musicMuted = false;
                localStorage.setItem('music_muted', 'false');
                // Ensure music is enabled in gameData too so toggle works
                Globals.gameData.music = true;

                if (introMusic) {
                    if (introMusic.paused) fadeIn(introMusic, 5000);
                }
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
                
                <p style="font-size: 1.5em; margin: 20px 0; color: #3498db;">Game Info</p>
                <div style="color: #ccc; font-family: monospace; text-align: left; display: inline-block; margin: 0 auto;">
                     <p>Seed: <span style="color: #95a5a6">${Globals.seed || 'Unknown'}</span></p>
                </div>

                <p style="font-size: 1.2em; color: #aaa;">${data.description || "You have unlocked a new feature!"}</p>
                <p style="font-size: 1.5em; margin: 20px 0; color: #3498db;">Design & Code</p>
                <p style="color: #ccc;">Cryptoskillz</p>
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

        // IMMEDIATE UPDATE: If this is for game.json, update Globals.gameData too!
        if (file === 'game.json' || file === 'game') {
            if (Globals.gameData) {
                // handle nested? For now, attr is usually top level like "showTimer"
                // But could be "ghost.spawn".
                const parts = attr.split('.');
                let current = Globals.gameData;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
                log(`Updated Globals.gameData.${attr} = ${value}`);
            }
        }
    } catch (e) {
        console.error("Failed to save unlock persistence", e);
    }
}

export function confirmNewGame() {
    // Clear Persistence to ensure fresh start
    // Clear Persistence to ensure fresh start (Hard Reset)
    STORAGE_KEYS.HARD_RESET.forEach(key => localStorage.removeItem(key));

    location.reload();
}

export function cancelNewGame() {
    const modal = document.getElementById('newGameModal');
    if (modal) modal.style.display = 'none';
    Globals.isNewGameModalOpen = false;
}



Globals.loadRoom = initGame; // Alias for clarity
Globals.saveUnlockOverride = saveUnlockOverride;
Globals.confirmNewGame = confirmNewGame;

// --- GHOST EFFECT ---
export function drawGhostBorder() {
    const w = Globals.canvas.width;
    const h = Globals.canvas.height;

    // Flickering Red Overlay
    Globals.ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.1})`;
    Globals.ctx.fillRect(0, 0, w, h);

    // Draw "Creepy Particles" rising from borders
    Globals.ctx.fillStyle = `rgba(180, 0, 0, ${Math.random() * 0.5 + 0.5})`;
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const size = Math.random() * 6 + 2;

        // Only on edges (frame)
        if (x < 60 || x > w - 60 || y < 60 || y > h - 60) {
            Globals.ctx.fillRect(x, y, size, size);
        }
    }
}
// --- BANK / ATM UI ---
export function bankDeposit(amountStr) {
    if (Globals.gameState !== STATES.BANK) return;

    let amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    let bankedShards = parseInt(localStorage.getItem('piggy_bank_balance') || '0');
    let inventoryShards = Globals.player.inventory.greenShards || 0;

    if (inventoryShards > 0) {
        // Cap deposit amount to what player actually has
        const depositAmt = Math.min(amount, inventoryShards);

        bankedShards += depositAmt;
        Globals.player.inventory.greenShards -= depositAmt;
        localStorage.setItem('piggy_bank_balance', bankedShards);

        // Update UI
        if (Globals.elements.bankInvVal) Globals.elements.bankInvVal.innerText = Globals.player.inventory.greenShards;
        if (Globals.elements.bankVaultVal) Globals.elements.bankVaultVal.innerText = bankedShards;

        if (window.SFX && SFX.coin) window.SFX.coin();
        console.log(`Deposited ${depositAmt} green shards. Total: ${bankedShards}`);
    } else {
        if (window.SFX && SFX.cantPickup) window.SFX.cantPickup();
    }
}

export function bankWithdraw(amountStr) {
    if (Globals.gameState !== STATES.BANK) return;

    let amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    let bankedShards = parseInt(localStorage.getItem('piggy_bank_balance') || '0');

    if (bankedShards > 0) {
        // Cap withdraw amount to what is actually in the bank
        const withdrawAmt = Math.min(amount, bankedShards);

        Globals.player.inventory.greenShards += withdrawAmt;
        bankedShards -= withdrawAmt;
        localStorage.setItem('piggy_bank_balance', bankedShards);

        // Update UI
        if (Globals.elements.bankInvVal) Globals.elements.bankInvVal.innerText = Globals.player.inventory.greenShards;
        if (Globals.elements.bankVaultVal) Globals.elements.bankVaultVal.innerText = bankedShards;

        // Save inventory so player actually has them
        localStorage.setItem('currency_green', Globals.player.inventory.greenShards);

        if (window.SFX && SFX.coin) window.SFX.coin();
        console.log(`Withdrew ${withdrawAmt} green shards from Piggy Bank.`);
    } else {
        if (window.SFX && SFX.cantPickup) window.SFX.cantPickup();
    }
}

export function bankClose() {
    if (Globals.elements.bankModal) {
        Globals.elements.bankModal.style.display = 'none';
    }
    Globals.gameState = STATES.PLAY; // Resume play
}

