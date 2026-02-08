export const STATES = { START: 0, PLAY: 1, GAMEOVER: 2, GAMEMENU: 3, WIN: 4, CREDITS: 5 };

export const BOUNDARY = 20;
export const DOOR_SIZE = 50;
export const DOOR_THICKNESS = 15;

// JSON Paths
export const JSON_PATHS = {
    ROOT: "/json/",
    GAME: "/json/game.json",
    ENEMIES: {
        LORE_NAMES: "/json/enemies/lore/names.json",
        LORE_SPEECH: "/json/enemies/lore/speech.json",
        SPECIAL_DIR: "/json/enemies/special/"
    },
    MANIFESTS: {
        PLAYERS: "/json/players/manifest.json",
        ROOMS: "json/rooms/manifest.json",
        ITEMS: "json/rewards/items/manifest.json"
    }
};


export const CONFIG = {
    MAX_DEBUG_LOGS: 1000,
    HEAT_MAX: 100, // Assuming this value based on usage context usually
    HEAT_DECAY: 2
};

// Debug Flags (These act as defaults, can be overridden by save/load logic)
export const DEBUG_FLAGS = {
    START_BOSS: false,
    TEST_ROOM: false,
    PLAYER: true,
    GODMODE: true,
    WINDOW: false,
    LOG: false,
    SPAWN_ALL_ITEMS: false,
    SPAWN_GUNS: false,
    SPAWN_BOMBS: false,
    SPAWN_INVENTORY: false,
    SPAWN_MODS_PLAYER: false,
    SPAWN_MODS_BULLET: true
};
