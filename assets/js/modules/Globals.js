export const Globals = {
    // DOM / Context
    canvas: null,
    ctx: null,
    mapCanvas: null,
    mctx: null,

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
        debugLog: null
    },



    //gane counters
    playerDeathCount: 0,
    playerDeathSessionCount: 0,
    //note we could extend this later to hold the number of each type of enemy killed and even their names, to keep the we are the bad 
    //guy theme going
    killEnemyCount: 0,
    killEnemySessionCount: 0,
    killBossCount: 0,
    killBossSessionCount: 0,





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

    // Lore
    loreData: null,
    speechData: null, // Saw this in outline earlier

    // State Flags
    isInitializing: false,
    isGameStarting: false,
    isUnlocking: false,
    isRestart: false,

    // Timers
    lastInputTime: 0,
    roomStartTime: 0,
    roomFreezeUntil: 0,
    bossIntroEndTime: 0,
    perfectStreak: 0,
    pauseStartTime: 0,
    lastMusicToggle: 0,
    unlockQueue: [],

    // Runtime Counters/Flags
    gameLoopStarted: false,
    ghostSpawned: false,
    wasRoomLocked: false,
    bombsInRoom: 0,
    bombsInRoom: 0,
    bulletsInRoom: 0,
    hitsInRoom: 0, // Added
    screenShake: { power: 0, endAt: 0, teleport: 0 },
    ghostEntry: null, // Added

    // Special Entities
    portal: { active: false, x: 0, y: 0, scrapping: false },

    // Setup Function
    initDOM: function () {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.mapCanvas = document.getElementById('minimapCanvas');
        this.mctx = this.mapCanvas ? this.mapCanvas.getContext('2d') : null;

        // Initialize AudioContext
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const ids = ['hp', 'keys', 'room', 'overlay', 'welcome', 'ui',
            'stats', 'perfect', 'roomName', 'bombs', 'ammo', 'gun',
            'debug-select', 'debug-form', 'debug-panel', 'debug-log'];

        ids.forEach(id => {
            // camelCase conversion for property name
            const prop = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            // Dictionary mapping check
            const key = prop === 'debugSelect' ? 'debugSelect' :
                prop === 'debugForm' ? 'debugForm' :
                    prop === 'debugPanel' ? 'debugPanel' :
                        prop === 'debugLog' ? 'debugLog' : prop;

            this.elements[key] = document.getElementById(id);
        });
    }
};
