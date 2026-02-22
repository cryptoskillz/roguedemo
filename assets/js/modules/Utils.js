import { Globals } from './Globals.js';
import { CONFIG, DEBUG_FLAGS } from './Constants.js';
import { SFX } from './Audio.js';

export function log(...args) {


    // Console Log
    if (Globals.gameData && Globals.gameData.debug && Globals.gameData.debug.showConsole) {
        console.log(...args);
    }

    // Visual Log Gate: Check gameData first, fallback to FLags
    const showVisual = (Globals.gameData && Globals.gameData.debug && Globals.gameData.debug.log !== undefined)
        ? Globals.gameData.debug.log
        : DEBUG_FLAGS.LOG;

    if (!showVisual) return;

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

export function spawnFloatingText(x, y, text, color = "white", type = "normal", target = null) {
    let life = 1.0;
    let actualType = type;

    // Support numeric duration passed as type
    if (typeof type === 'number') {
        life = type;
        actualType = 'normal';
    } else {
        actualType = type;
    }

    // Speech bubbles: Static, longer life
    const isSpeech = actualType === 'speech';

    // throttle: if text exists, don't spawn another immediately 
    // (unless we want stacking? For now, keep existing logic to prevent spam)
    if (Globals.floatingTexts.length > 0) {
        // Optional: if different text, maybe replace?
        // For now, strict throttling.
        return;
    }

    Globals.floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        type: actualType,
        life: life,
        vy: isSpeech ? -0.5 : -1, // Speech floats slower
        target: target // Store target for following
    });
}
export function generateLore(enemy) {
    if (!Globals.loreData) return null;

    // Skip Bosses - they have their own names defined in JSON
    if (enemy.type === 'boss' || enemy.isBoss) return null;

    const prefix = Globals.loreData.prefixes[Math.floor(Globals.random() * Globals.loreData.prefixes.length)];

    let firstName, surname, nickname, displayName, fullName, title;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 20) {
        // 1. Name Parts
        firstName = Globals.loreData.firstNames[Math.floor(Globals.random() * Globals.loreData.firstNames.length)];

        // 2. Surname by Shape
        const shape = enemy.shape ? enemy.shape.toLowerCase() : 'default';
        const surnames = Globals.loreData.surnames[shape] || Globals.loreData.surnames['default'];
        const surnameList = (surnames && surnames.length > 0) ? surnames : Globals.loreData.surnames['default'];
        surname = surnameList[Math.floor(Globals.random() * surnameList.length)];

        // 3. Nickname by Stats
        nickname = "";
        let pool = [];
        if (enemy.speed > 3) pool.push('speed');
        if (enemy.hp > 5) pool.push('hp');
        if (enemy.damage > 2) pool.push('damage');
        if (enemy.size > 30) pool.push('size');
        if (enemy.size < 20) pool.push('tiny');
        if (enemy.alwaysAngry) pool.push('angry');

        if (pool.length === 0) pool = ['speed', 'hp'];

        const cat = pool[Math.floor(Globals.random() * pool.length)];
        const nicks = Globals.loreData.nicknames[cat] || [];
        if (nicks.length > 0) {
            nickname = nicks[Math.floor(Globals.random() * nicks.length)];
        }

        // 4. Randomize Display Format
        let options = [
            { type: 'first', val: firstName },
            { type: 'full', val: `${firstName} ${surname}` },
            { type: 'formal_sur', val: `${prefix} ${surname}` },
            { type: 'formal_full', val: `${prefix} ${firstName} ${surname}` }
        ];

        if (nickname) {
            options.push({ type: 'nick', val: nickname });
            options.push({ type: 'nick_mid', val: `${firstName} "${nickname}" ${surname}` });
        }

        const selected = options[Math.floor(Globals.random() * options.length)];
        displayName = selected.val;
        fullName = `${prefix} ${firstName} ${surname}`;
        title = `${nickname} ${firstName}`;

        // Ensure Uniqueness within current room enemies
        isUnique = true;
        if (Globals.enemies) {
            for (let e of Globals.enemies) {
                if (e !== enemy && e.lore) {
                    if (e.lore.displayName === displayName || e.lore.fullName === fullName || e.lore.title === title) {
                        isUnique = false;
                        break;
                    }
                }
            }
        }
        attempts++;
    }

    return {
        fullName: fullName,
        nickname: nickname,
        displayName: displayName, // Use this for rendering
        title: title
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
        if (type === 'idle' && Globals.random() > 0.001) return; // Low chance for idle
        if (type === 'hit' && Globals.random() > 0.3) return; // 30% chance on hit
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
                if (Globals.random() < 0.5) pool = speechData.types[enemy.type];
            }

            // 5. General Fallback
            if (!pool || pool.length === 0) {
                pool = speechData.general || ["..."];
            }
        }

        // Pick Random
        if (pool && pool.length > 0) {
            text = pool[Math.floor(Globals.random() * pool.length)];
        }
    }

    if (text) {
        // Trigger SFX for Ghost & Uppercase
        if (enemy.type === 'ghost') {
            SFX.ghostSpeak();
        }

        spawnFloatingText(enemy.x, enemy.y - enemy.size - 20, text, "black", "speech", enemy);
        enemy.lastSpeechTime = now;
    }
}
