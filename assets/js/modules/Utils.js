import { Globals } from './Globals.js';
import { CONFIG, DEBUG_FLAGS } from './Constants.js';

export function log(...args) {
    if (!DEBUG_FLAGS.LOG) return;

    // Console Log
    console.log(...args);

    // In-Game Log
    const msg = args.map(a => (typeof a === 'object') ? JSON.stringify(a) : String(a)).join(' ');
    Globals.debugLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

    if (Globals.debugLogs.length > CONFIG.MAX_DEBUG_LOGS) {
        Globals.debugLogs.shift();
    }

    // Update DOM if visible
    if (Globals.elements.debugLog) {
        // Optimization: Debounce or only update if visible?
        // For now, simpler port.
        const line = document.createElement('div');
        line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        line.style.borderBottom = "1px solid #333";
        Globals.elements.debugLog.appendChild(line);
        Globals.elements.debugLog.scrollTop = Globals.elements.debugLog.scrollHeight;

        while (Globals.elements.debugLog.childElementCount > CONFIG.MAX_DEBUG_LOGS) {
            Globals.elements.debugLog.removeChild(Globals.elements.debugLog.firstChild);
        }
    }
}

export function deepMerge(target, source) {
    const isObject = (obj) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
            target[key] = sourceValue; // Arrays: Replace (simplest for config)
        } else if (isObject(targetValue) && isObject(sourceValue)) {
            target[key] = deepMerge(Object.assign({}, targetValue), sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });

    return target;
}

export function spawnFloatingText(x, y, text, color = "white", type = "normal") {
    // Speech bubbles: Static, longer life
    const isSpeech = type === 'speech';

    Globals.floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        type: type,
        life: isSpeech ? 3.0 : 1.0, // Last longer
        vy: isSpeech ? 0 : -1.0 // Don't float if speech
    });
}
export function generateLore(enemy) {
    if (!Globals.loreData) return null;

    // Skip Bosses - they have their own names defined in JSON
    if (enemy.type === 'boss' || enemy.isBoss) return null;

    // 1. Name Parts
    const prefix = Globals.loreData.prefixes[Math.floor(Math.random() * Globals.loreData.prefixes.length)];
    const firstName = Globals.loreData.firstNames[Math.floor(Math.random() * Globals.loreData.firstNames.length)];

    // 2. Surname by Shape
    const shape = enemy.shape ? enemy.shape.toLowerCase() : 'default';
    const surnames = Globals.loreData.surnames[shape] || Globals.loreData.surnames['default'];
    // Fallback if shape key exists but list empty
    const surnameList = (surnames && surnames.length > 0) ? surnames : Globals.loreData.surnames['default'];
    const surname = surnameList[Math.floor(Math.random() * surnameList.length)];

    // 3. Nickname by Stats
    let nickname = "";
    // Build pool based on stats
    let pool = [];
    if (enemy.speed > 3) pool.push('speed');
    if (enemy.hp > 5) pool.push('hp');
    if (enemy.damage > 2) pool.push('damage');
    if (enemy.size > 30) pool.push('size');
    if (enemy.size < 20) pool.push('tiny');
    if (enemy.alwaysAngry) pool.push('angry');

    // Fallback pool
    if (pool.length === 0) pool = ['speed', 'hp'];

    const cat = pool[Math.floor(Math.random() * pool.length)];
    const nicks = Globals.loreData.nicknames[cat] || [];
    if (nicks.length > 0) {
        nickname = nicks[Math.floor(Math.random() * nicks.length)];
    }

    // 4. Randomize Display Format
    // Options: 
    // - Nickname (if exists)
    // - First Name
    // - Full Name (First Surname)
    // - Formal (Prefix Surname)
    // - Formal Full (Prefix First Surname)
    // - Nick Mid (First "Nick" Surname) - if exists

    let options = [
        { type: 'first', val: firstName },
        { type: 'full', val: `${firstName} ${surname}` },
        { type: 'formal_sur', val: `${prefix} ${surname}` },
        { type: 'formal_full', val: `${prefix} ${firstName} ${surname}` }
    ];

    if (nickname) {
        options.push({ type: 'nick', val: nickname }); // Just "The Tank"
        options.push({ type: 'nick_mid', val: `${firstName} "${nickname}" ${surname}` });
    }

    // Select Random
    const selected = options[Math.floor(Math.random() * options.length)];
    const displayName = selected.val;

    return {
        fullName: `${prefix} ${firstName} ${surname}`,
        nickname: nickname,
        displayName: displayName, // Use this for rendering
        title: `${nickname} ${firstName}`
    };
}

export function triggerSpeech(enemy, type, forceText = null, bypassCooldown = false) {
    const speechData = Globals.speechData;
    if ((!speechData && !forceText) || enemy.isDead) return;

    const now = Date.now();
    // Cooldown Check (5 seconds), ignored if forced text or bypass flag is set
    if (!forceText && !bypassCooldown && enemy.lastSpeechTime && now - enemy.lastSpeechTime < 5000) {
        return;
    }

    // Probability Checks (unless forced)
    if (!forceText && !bypassCooldown) {
        if (type === 'idle' && Math.random() > 0.001) return; // Low chance for idle
        if (type === 'hit' && Math.random() > 0.3) return; // 30% chance on hit
    }

    let text = forceText;

    if (!text && speechData) {
        let pool = [];

        // SPECIAL ENEMY OVERRIDE (Ghost, etc.)
        if (enemy.special) {
            if (speechData.types && speechData.types[type]) {
                pool = speechData.types[type];
            }
            else if (speechData.types && speechData.types[enemy.type]) {
                pool = speechData.types[enemy.type];
            }
        }
        // STANDARD LOGIC
        else {
            // 2. Mood
            if (type === 'angry' && speechData.moods && speechData.moods.angry) {
                pool = speechData.moods.angry;
            }
            // 3. Event Type
            else if (speechData.events && speechData.events[type]) {
                pool = speechData.events[type];
            }
            // 4. Enemy Type Specific
            else if (enemy.type && speechData.types && speechData.types[enemy.type]) {
                if (Math.random() < 0.5) pool = speechData.types[enemy.type];
            }

            // 5. General Fallback
            if (!pool || pool.length === 0) {
                pool = speechData.general || ["..."];
            }
        }

        // Pick Random
        if (pool && pool.length > 0) {
            text = pool[Math.floor(Math.random() * pool.length)];
        }
    }

    if (text) {
        spawnFloatingText(enemy.x, enemy.y - enemy.size - 20, text, "black", "speech");
        enemy.lastSpeechTime = now;
    }
}
