export const STATES = { START: 0, PLAY: 1, GAMEOVER: 2, GAMEMENU: 3, WIN: 4, CREDITS: 5 };

export const BOUNDARY = 20;
export const DOOR_SIZE = 50;
export const DOOR_THICKNESS = 15;

//json constants
export const JSON_PATH = "/json/";

export const JSON_PATH_GAME = "game.json";
export const JSON_PATH_LEVELS = "levels.json";
export const JSON_PATH_PLAYER = "player.json";
export const JSON_PATH_REWARDS = "rewards/";
export const JSON_PATH_ENEMIES = "enemies/";
export const JSON_PATH_ITEMS = "items/";
export const JSON_PATH_BOSSES = "bosses/";
export const JSON_PATH_UNLOCKS = "unlocks/";
export const JSON_PATH_LORE = "lore/";
export const JSON_PATH_SPEECH = "speech/";

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
