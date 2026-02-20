export const Globals = {
    // DOM / Context
    canvas: null,
    ctx: null,
    mapCanvas: null,
    mctx: null,
    statsPanel: null,
    usedBed: false,

    randomGreenMinCount: 1,
    randomGreenMaxCount: 100,
    randomGreenPerAward: 30,

    // UI Elements
    elements: {
        hp: null,
        keys: null,
        room: null,
        overlay: null,
        welcome: null,
        ui: null,
        stats: null,
        perfect: null,
        roomName: null,
        bombs: null,
        ammo: null,
        gun: null,
        debugSelect: null,
        debugForm: null,
        debugPanel: null,
        debugLog: null,
        timer: null,
        tMin: null, tSec: null, tMs: null,
        bankModal: null,
        bankInvVal: null,
        bankVaultVal: null
    },

    //game counters
    playerDeathCount: parseInt(localStorage.getItem('playerDeathCount') || '0'),
    playerDeathSessionCount: 0,

    killEnemyCount: parseInt(localStorage.getItem('killEnemyCount') || '0'),
    killEnemySessionCount: 0,

    killBossCount: parseInt(localStorage.getItem('killBossCount') || '0'),
    killBossSessionCount: 0,

    // New Counters
    perfectRoomCount: parseInt(localStorage.getItem('perfectRoomCount') || '0'),
    perfectRoomSessionCount: 0,

    speedyBonusCount: parseInt(localStorage.getItem('speedyBonusCount') || '0'),
    speedyBonusSessionCount: 0,

    gameBeatCount: parseInt(localStorage.getItem('gameBeatCount') || '0'),
    gameBeatSessionCount: 0,

    ghostTimeSurvived: parseInt(localStorage.getItem('ghostTimeSurvived') || '0'),
    ghostTimeSessionSurvived: 0,

    // Stats (Persisted)
    NumberOfRuns: parseInt(localStorage.getItem('numberOfRuns') || '0'),
    NumberOfSessionRuns: 0,
    SessionRunTime: 0,
    BestRunTime: parseInt(localStorage.getItem('bestRunTime') || '0'),






    // Audio
    audioCtx: null,
    musicMuted: false,
    sfxMuted: false,

    // Methods
    restartGame: null,
    handleUnlocks: null,

    // Game Logic
    gameState: 0, // Will correspond to STATES.START
    gameData: { perfectGoal: 3 }, // Default config
    perfectStreak: 0,
    noDamageStreak: 0,
    shooterStreak: 0,

    // Entities
    player: {
        x: 300, y: 200, speed: 4, hp: 3, roomX: 0, roomY: 0,
        inventory: { keys: 0, bombs: 0, redShards: 0, greenShards: 0 },
        size: 20
    },
    availablePlayers: [],
    selectedPlayerIndex: 0,

    // Arrays
    bullets: [],
    particles: [],
    enemies: [],
    bombs: [],
    keys: {}, // Input keys
    groundItems: [],
    chests: [],
    floatingTexts: [],
    debugLogs: [],

    // Weapon Configs (Runtime)
    gun: {},
    bomb: {},

    // Templates
    roomTemplates: {},
    enemyTemplates: {},
    allItemTemplates: [], // Cache array or object? logic.js used allItemTemplates as array sometimes, but also itemTemplates as object? Reference Debug.js use: allItemTemplates (array).
    itemTemplates: {}, // Map for lookup


    // Level
    levelMap: {},
    roomData: {},
    visitedRooms: {},

    // Path Generation
    goldenPath: [],
    goldenPathIndex: 0,
    goldenPathFailed: false,
    bossCoord: null,

    // Logic Flags
    bossKilled: false,
    ghostKilled: false,

    // Unlock Queue
    foundUnlocks: [],

    // Lore
    loreData: null,
    speechData: null, // Saw this in outline earlier

    // State Flags
    isInitializing: false,
    isGameStarting: false,
    isUnlocking: false,
    isRestart: false,

    roomFreezeUntil: 0,
    bossIntroEndTime: 0,
    roomIntroEndTime: 0,
    // Run Timer
    runStartTime: 0,
    runElapsedTime: 0,
    levelSplits: [],
    levelStartTime: 0,

    perfectStreak: 0,
    pauseStartTime: 0,
    lastMusicToggle: 0,
    unlockQueue: [],

    // Runtime Counters/Flags
    gameLoopStarted: false,
    ghostSpawned: false,
    ghostRoomShrinkCount: false,
    wasRoomLocked: false,
    bombsInRoom: 0,
    bombsInRoom: 0,
    bulletsInRoom: 0,
    hitsInRoom: 0, // Added
    screenShake: { power: 0, endAt: 0, teleport: 0 },
    ghostEntry: null, // Added
    roomShrinkSize: 0, // Decreases playable area when Ghost is active

    // Special Entities
    portal: { active: false, x: 0, y: 0, scrapping: false },

    // RNG
    seed: null,
    rngState: 0,

    setSeed: function (s) {
        // String to hash or number
        let h = 2166136261 >>> 0;
        let str = s.toString();
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        }
        this.rngState = h >>> 0;
        this.seed = s;
    },

    random: function () {
        if (this.seed === null) {
            // Fallback to Math.random if no seed set (should set seed though)
            return Math.random();
        }
        // Mulberry32
        let t = this.rngState += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        this.rngState = t >>> 0; // update state
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },

    // Setup Function
    initDOM: function () {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapCanvas = document.getElementById('minimapCanvas');
        this.statsPanel = document.getElementById('stats-panel');
        this.mctx = this.mapCanvas ? this.mapCanvas.getContext('2d') : null;

        // Initialize AudioContext
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const ids = ['hp', 'keys', 'room', 'overlay', 'welcome', 'ui',
            'stats', 'perfect-count', 'nodamage-count', 'shooter-count',
            'roomName', 'bombs', 'ammo', 'gun',
            'debug-select', 'debug-form', 'debug-panel', 'debug-log', 'timer',
            't-min', 't-sec', 't-ms', 'bankModal', 'bankInvVal', 'bankVaultVal'];

        ids.forEach(id => {
            // camelCase conversion for property name
            let prop = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

            // Manual overrides for specific counters to match Game.js expectation
            if (id === 'perfect-count') prop = 'perfect';
            if (id === 'nodamage-count') prop = 'nodamage';
            if (id === 'shooter-count') prop = 'shooter';

            const key = prop === 'debugSelect' ? 'debugSelect' :
                prop === 'debugForm' ? 'debugForm' :
                    prop === 'debugPanel' ? 'debugPanel' :
                        prop === 'debugLog' ? 'debugLog' : prop;

            this.elements[key] = document.getElementById(id);
        });

        // Initialize Debug Log Visibility from Storage
        if (this.elements.debugLog) {
            try {
                const saved = JSON.parse(localStorage.getItem('game_data') || '{}');
                // Default to true if not set (or match game.json default which is true)
                const showLog = (saved.debug && saved.debug.log !== undefined) ? saved.debug.log : true;
                this.elements.debugLog.style.display = showLog ? 'block' : 'none';
            } catch (e) { console.warn("Failed to load debug log state", e); }
        }
    }
};
