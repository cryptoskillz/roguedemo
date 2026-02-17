import { Globals } from './Globals.js';
import { JSON_PATHS, DEBUG_FLAGS } from './Constants.js';
import { SFX, introMusic, fadeIn, fadeOut } from './Audio.js'; // Assuming SFX is exported
import { log } from './Utils.js';
import { updateUI } from './UI.js';

export function updateDebugEditor() {
    const selector = Globals.elements.debugSelect;
    if (!selector) return;

    // Only populate if empty
    if (selector.options.length === 0) {
        const options = [
            { value: 'main', label: "Main Menu" },
            { value: 'player', label: "Player Data" },
            { value: 'room', label: "Room Data" },
            { value: 'spawn', label: "Spawn Item" },
            { value: 'spawnEnemy', label: "Spawn Enemy" },
            { value: 'spawnRoom', label: "Spawn Room" }
        ];

        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.innerText = opt.label;
            selector.appendChild(el);
        });

        selector.onchange = () => {
            renderDebugForm();
        };

        // Initial Render
        renderDebugForm();
    }
}

export function renderDebugForm() {
    const debugForm = Globals.elements.debugForm;
    const debugSelect = Globals.elements.debugSelect;

    if (!debugForm || !debugSelect) return;
    debugForm.innerHTML = '';


    const type = debugSelect.value;

    function createInputStyle(el) {
        el.style.width = "100%";
        el.style.marginBottom = "10px";
        el.style.background = "#333";
        el.style.color = "#fff";
        el.style.border = "1px solid #555";
        el.style.padding = "5px";
    }

    // MAIN MENU
    if (type === 'main') {
        const createBtn = (label, color, onClick) => {
            const btn = document.createElement('button');
            btn.innerText = label;
            createInputStyle(btn);
            if (color) btn.style.background = color;
            btn.style.cursor = "pointer";
            btn.onclick = () => { btn.blur(); onClick(); };
            debugForm.appendChild(btn);
        };



        const musicState = Globals.gameData.music ? 'ON' : 'OFF';
        createBtn(`TOGGLE MUSIC (${musicState}) (0 key)`, "#3498db", () => {
            // Toggle Config
            Globals.gameData.music = !Globals.gameData.music;
            // Sync Runtime Mute
            Globals.musicMuted = !Globals.gameData.music;

            localStorage.setItem('setting_music', Globals.gameData.music);

            if (Globals.gameData.music) {
                log("Music Enabled");
                fadeIn(introMusic, 5000);
            } else {
                log("Music Disabled");
                fadeOut(introMusic, 2000);
            }
            renderDebugForm();
        });

        const sfxState = Globals.gameData.soundEffects ? 'ON' : 'OFF';
        createBtn(`TOGGLE SFX (${sfxState}) (9 key)`, "#9b59b6", () => {
            // Toggle Config
            Globals.gameData.soundEffects = !Globals.gameData.soundEffects;
            // Sync Runtime Mute
            Globals.sfxMuted = !Globals.gameData.soundEffects;

            localStorage.setItem('setting_sfx', Globals.gameData.soundEffects);
            log(Globals.gameData.soundEffects ? "SFX Enabled" : "SFX Disabled");
            renderDebugForm();
        });

        const godModeState = DEBUG_FLAGS.GODMODE ? 'ON' : 'OFF';
        createBtn(`GOD MODE (${godModeState})`, "#f39c12", () => {
            const newVal = !DEBUG_FLAGS.GODMODE;
            DEBUG_FLAGS.GODMODE = newVal;

            // Sync to Game Data (used in Entities.js)
            if (!Globals.gameData.debug) Globals.gameData.debug = {};
            Globals.gameData.debug.godMode = newVal;

            log("God Mode:", newVal);
            renderDebugForm();
        });

        createBtn("NEW GAME (RESET & RELOAD)", "#2ecc71", () => {
            if (confirm("Reset game data and reload?")) {
                localStorage.clear();
                location.reload();
            }
        });

        createBtn("LOAD MATRIX ROOM", "#c0392b", () => {
            const path = "json/rooms/secret/matrix/room.json";
            log("Debug Loading Matrix Room:", path);
            if (Globals.gameData) Globals.gameData.startRoom = null;
            if (window.DEBUG_FLAGS) window.DEBUG_FLAGS.TEST_ROOM = true;
            if (Globals.loadRoom) Globals.loadRoom(true, path, true);
        });

        createBtn("SPAWN LOADOUT (Shotgun/Keys/Bombs)", "#e67e22", async () => {
            console.log("Debug Spawn Button Clicked");
            if (!Globals.player) {
                console.error("Globals.player is undefined!");
                return;
            }

            // 1. Inventory
            if (!Globals.player.inventory) Globals.player.inventory = { keys: 0, bombs: 0, redShards: 0, greenShards: 0 };

            console.log("Current Inventory (Before):", JSON.stringify(Globals.player.inventory));
            Globals.player.inventory.keys = (Globals.player.inventory.keys || 0) + 5;
            Globals.player.inventory.bombs = (Globals.player.inventory.bombs || 0) + 5;
            Globals.player.inventory.redShards = 1000;
            Globals.player.inventory.greenShards = 1000;
            console.log("Updated Inventory (After):", Globals.player.inventory.keys, Globals.player.inventory.bombs);
            log("Added 5 Keys & 5 Bombs");

            // 2. Shotgun
            try {
                // Ensure gun type is updated for persistence/logic
                Globals.player.gunType = 'shotgun';
                if (Globals.gameData) Globals.gameData.gunType = 'shotgun';

                console.log("Fetching Shotgun...");
                const res = await fetch('json/rewards/items/guns/player/shotgun.json?t=' + Date.now());
                if (res.ok) {
                    const gunData = await res.json();
                    Globals.gun = gunData;
                    console.log("Shotgun Loaded:", gunData);
                    log("Equipped Shotgun!");
                } else {
                    console.error("Failed to load shotgun json. Status:", res.status);
                }
            } catch (e) { console.error("Shotgun fetch error:", e); }

            updateUI();
            console.log("UI Updated called");
        });

        return;
    }

    // SPAWN LOGIC
    if (type === 'spawn') {
        // Assume allItemTemplates is global or in Globals. 
        // Logic.js used window.allItemTemplates. We should encourage Globals.itemTemplates.
        // For now, fallback to window if Globals missing.
        const items = window.allItemTemplates || Globals.itemTemplates;

        if (!items) {
            debugForm.innerText = "No items loaded.";
            return;
        }

        const container = document.createElement('div');
        container.style.padding = "10px";

        const searchInput = document.createElement('input');
        searchInput.placeholder = "Search items...";
        createInputStyle(searchInput);

        const select = document.createElement('select');
        createInputStyle(select);
        select.size = 10;

        function populate(filter = "") {
            select.innerHTML = "";
            items.forEach((item, idx) => {
                if (!item) return;
                const name = item.name || item.id || "Unknown";
                if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;

                const opt = document.createElement('option');
                opt.value = idx;
                const rarity = item.rarity ? `[${item.rarity.toUpperCase()}] ` : "";
                opt.innerText = `${rarity}${name} (${item.type})`;
                select.appendChild(opt);
            });
        }
        populate();

        searchInput.addEventListener('input', (e) => populate(e.target.value));

        const spawnBtn = document.createElement('button');
        spawnBtn.innerText = "SPAWN";
        createInputStyle(spawnBtn);
        spawnBtn.style.background = "#27ae60";
        spawnBtn.style.cursor = "pointer";
        spawnBtn.onclick = () => {
            spawnBtn.blur();
            const idx = select.value;
            if (idx === "") return;
            const itemTemplate = items[idx];
            log("Debug Spawn Template:", itemTemplate);

            Globals.groundItems.push({
                x: Globals.player.x + (Math.random() * 60 - 30),
                y: Globals.player.y + (Math.random() * 60 - 30),
                data: JSON.parse(JSON.stringify(itemTemplate)),
                roomX: Globals.player.roomX,
                roomY: Globals.player.roomY,
                vx: 0, vy: 0,
                solid: true, moveable: true, friction: 0.9, size: 15,
                floatOffset: Math.random() * 100
            });
            log("Spawned:", itemTemplate.name);
        };

        select.ondblclick = () => spawnBtn.click();

        container.appendChild(searchInput);
        container.appendChild(select);
        container.appendChild(spawnBtn);
        debugForm.appendChild(container);
        return;
    }

    // SPAWN ENEMY LOGIC
    // SPAWN ENEMY LOGIC
    if (type === 'spawnEnemy') {
        const config = Globals.gameData.enemyConfig || {};
        const variants = config.variants || [];
        const shapes = config.shapes || ['circle', 'square'];
        const colors = config.colors || ['red', 'blue'];

        if (!variants || variants.length === 0) {
            debugForm.innerText = "No enemy variants found in gameData.";
            return;
        }

        const container = document.createElement('div');
        container.style.padding = "10px";

        // Variant Select
        const select = document.createElement('select');
        createInputStyle(select);
        select.style.height = "auto";
        select.style.marginBottom = "10px";

        variants.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.innerText = "Variant: " + v.toUpperCase();
            select.appendChild(opt);
        });
        select.selectedIndex = 0;

        // Helper: Create Labelled Input
        function createLabelledInput(labelText, inputType = 'text', defaultValue = '', options = []) {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = "5px";
            wrapper.style.display = "flex";
            wrapper.style.justifyContent = "space-between";
            wrapper.style.alignItems = "center";

            const label = document.createElement('label');
            label.innerText = labelText;
            label.style.fontSize = "12px";
            label.style.color = "#aaa";
            label.style.marginRight = "10px";

            let input;
            if (inputType === 'select') {
                input = document.createElement('select');
                options.forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.innerText = optVal;
                    input.appendChild(opt);
                });
            } else {
                input = document.createElement('input');
                input.type = inputType;
                input.value = defaultValue;
            }

            input.style.width = "60%";
            input.style.background = "#222";
            input.style.border = "1px solid #444";
            input.style.color = "#fff";
            input.style.padding = "2px";

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            container.appendChild(wrapper);
            return input;
        }

        container.appendChild(select);

        const shapeInput = createLabelledInput("Shape", 'select', '', ['random', ...shapes]);
        const colorInput = createLabelledInput("Color", 'select', '', ['random', ...colors]);
        const hpInput = createLabelledInput("HP Override", 'number', '');
        const speedInput = createLabelledInput("Speed Override", 'number', '');

        // Size Dropdown
        const sizeWrapper = document.createElement('div');
        sizeWrapper.style.marginBottom = "5px";
        sizeWrapper.style.display = "flex";
        sizeWrapper.style.justifyContent = "space-between";
        sizeWrapper.style.alignItems = "center";

        const sizeLabel = document.createElement('label');
        sizeLabel.innerText = "Size";
        sizeLabel.style.fontSize = "12px";
        sizeLabel.style.color = "#aaa";
        sizeLabel.style.marginRight = "10px";

        const sizeSelect = document.createElement('select');
        sizeSelect.style.width = "60%";
        sizeSelect.style.background = "#222";
        sizeSelect.style.border = "1px solid #444";
        sizeSelect.style.color = "#fff";
        sizeSelect.style.padding = "2px";

        const sizeOptions = [
            { label: 'Default', value: '' },
            { label: 'Small (0.5)', value: '0.5' },
            { label: 'Medium (1.0)', value: '1.0' },
            { label: 'Large/Big (1.5)', value: '1.5' },
            { label: 'Massive (2.0)', value: '2.0' }
        ];

        sizeOptions.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.innerText = opt.label;
            sizeSelect.appendChild(el);
        });

        sizeWrapper.appendChild(sizeLabel);
        sizeWrapper.appendChild(sizeSelect);
        container.appendChild(sizeWrapper);

        // Static Checkbox
        const staticWrapper = document.createElement('div');
        staticWrapper.style.marginBottom = "10px";
        staticWrapper.style.display = "flex";
        staticWrapper.style.alignItems = "center";

        const staticInput = document.createElement('input');
        staticInput.type = "checkbox";
        staticInput.id = "debug-spawn-static";
        staticInput.style.marginRight = "10px";

        const staticLabel = document.createElement('label');
        staticLabel.innerText = "Static (No Movement)";
        staticLabel.setAttribute("for", "debug-spawn-static");
        staticLabel.style.fontSize = "12px";
        staticLabel.style.color = "#aaa";

        staticWrapper.appendChild(staticInput);
        staticWrapper.appendChild(staticLabel);
        container.appendChild(staticWrapper);

        const spawnBtn = document.createElement('button');
        spawnBtn.innerText = "SPAWN ENEMY";
        createInputStyle(spawnBtn);
        spawnBtn.style.background = "#e74c3c";
        spawnBtn.style.cursor = "pointer";
        spawnBtn.style.marginTop = "10px";

        spawnBtn.onclick = () => {
            spawnBtn.blur();
            const variant = select.value;
            if (!variant) return;

            const overrides = {};
            if (shapeInput.value !== 'random') overrides.shape = shapeInput.value;
            if (colorInput.value !== 'random') overrides.color = colorInput.value;
            if (hpInput.value) overrides.hp = parseFloat(hpInput.value);
            if (speedInput.value) overrides.speed = parseFloat(speedInput.value);
            if (sizeSelect.value) overrides.size = parseFloat(sizeSelect.value);
            if (staticInput.checked) overrides.moveType = 'static';

            if (Globals.spawnEnemy) {
                // Pass overrides to the global handler
                Globals.spawnEnemy(variant, Globals.player.x + (Math.random() * 200 - 100), Globals.player.y + (Math.random() * 200 - 100), overrides);
                log("Spawned Enemy:", variant, overrides);
            } else {
                console.error("Globals.spawnEnemy not defined.");
            }
        };

        container.appendChild(spawnBtn);
        debugForm.appendChild(container);
        return;
    }

    // ... Simplified Logic for brevity in plan vs actual code ...
    // I will include the other blocks (spawnRoom, spawnEnemy, edit Logic) 
    // but refactored to use Globals.


    // SPAWN ROOM LOGIC
    if (type === 'spawnRoom') {
        const rooms = Globals.roomManifest ? Globals.roomManifest.rooms : [];
        if (!rooms || rooms.length === 0) {
            debugForm.innerText = "No rooms found in manifest.";
            return;
        }

        const container = document.createElement('div');
        container.style.padding = "10px";

        const label = document.createElement('div');
        label.innerText = "Select Room:";
        label.style.color = "#aaa";
        label.style.marginBottom = "5px";
        container.appendChild(label);

        const select = document.createElement('select');
        createInputStyle(select);
        select.style.height = "auto";
        select.size = 10;

        rooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.innerText = "Room " + r;
            select.appendChild(opt);
        });

        // Append Boss Rooms (Dynamic)
        fetch('json/rooms/bosses/manifest.json')
            .then(res => res.json())
            .then(data => {
                const list = data.rooms || data.items || [];
                list.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = "bosses/" + b;
                    opt.innerText = "BOSS: " + b.toUpperCase();
                    select.appendChild(opt);
                });
            })
            .catch(e => console.warn("No boss room manifest found:", e));

        // Append Shop Rooms (Dynamic)
        fetch('json/rooms/shops/manfiest.json')
            .then(res => res.json())
            .then(data => {
                if (data.rooms) {
                    data.rooms.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = "shops/" + s;
                        opt.innerText = "SHOP: " + s.toUpperCase();
                        select.appendChild(opt);
                    });
                }
            })
            .catch(e => console.warn("No shop manifest found", e));

        // Append Secret Rooms (Dynamic)
        fetch('json/rooms/secret/manifest.json')
            .then(res => res.json())
            .then(data => {
                const list = data.items || data.rooms || [];
                if (list.length > 0) {
                    list.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = "secret/" + s;
                        opt.innerText = "SECRET: " + s.toUpperCase();
                        select.appendChild(opt);
                    });
                }
            })
            .catch(e => console.warn("No secret manifest found", e));

        const loadBtn = document.createElement('button');
        loadBtn.innerText = "GO TO ROOM";
        createInputStyle(loadBtn);
        loadBtn.style.background = "#3498db";
        loadBtn.style.cursor = "pointer";
        loadBtn.style.marginTop = "10px";

        loadBtn.onclick = () => {
            loadBtn.blur();
            const roomId = select.value;
            if (!roomId) return;

            // Construct Path - assumig standard structure
            const path = `json/rooms/${roomId}/room.json`;
            log("Debug Loading Room:", path);

            if (Globals.loadRoom) {
                // isRestart=true (to reset room state), nextLevel=path, keepStats=true
                Globals.loadRoom(true, path, true);
            } else {
                console.error("Globals.loadRoom not defined.");
            }
        };

        select.ondblclick = () => loadBtn.click();

        container.appendChild(select);
        container.appendChild(loadBtn);
        debugForm.appendChild(container);
        return;
    }


    // Edit Object Logic
    const target = (type === 'player') ? Globals.player : Globals.roomData;

    function createFields(parent, obj, path) {
        for (const key in obj) {
            if (key === 'lastShot' || key === 'invulnUntil') continue;

            const value = obj[key];
            const currentPath = path ? `${path}.${key}` : key;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const group = document.createElement('div');
                group.className = 'debug-nested';
                // ... styling ...
                const header = document.createElement('div');
                header.innerText = key;
                header.style.color = '#5dade2';
                header.style.fontSize = '13px';
                header.style.fontWeight = 'bold';
                header.style.marginBottom = '8px';
                header.style.paddingBottom = '4px';
                header.style.borderBottom = '1px solid rgba(93, 173, 226, 0.3)';
                group.appendChild(header);

                group.style.marginBottom = '10px';
                group.style.marginLeft = '10px';

                createFields(group, value, currentPath);
                parent.appendChild(group);
            } else {
                const field = document.createElement('div');
                field.className = 'debug-field';
                field.style.display = 'flex';
                field.style.justifyContent = 'space-between';
                field.style.marginBottom = '5px';

                const label = document.createElement('label');
                label.innerText = key;
                label.style.fontSize = '12px';
                label.style.color = '#aaa';
                field.appendChild(label);

                const input = document.createElement('input');
                // ... input logic ...
                if (typeof value === 'boolean') {
                    input.type = 'checkbox';
                    input.checked = value;
                } else if (typeof value === 'number') {
                    input.type = 'number';
                    input.value = value;
                    input.step = 'any';
                    input.style.width = "60px";
                    input.style.background = "#222";
                    input.style.border = "1px solid #444";
                    input.style.color = "#fff";
                } else {
                    input.type = 'text';
                    input.value = value;
                    input.style.width = "100px";
                    input.style.background = "#222";
                    input.style.border = "1px solid #444";
                    input.style.color = "#fff";
                }

                input.addEventListener('input', (e) => {
                    let newVal = input.type === 'checkbox' ? input.checked : input.value;
                    if (input.type === 'number') newVal = parseFloat(newVal);

                    // Update state
                    let o = type === 'player' ? Globals.player : Globals.roomData;
                    const parts = currentPath.split('.');
                    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
                    o[parts[parts.length - 1]] = newVal;

                    if (key === 'hp' || key === 'luck') updateUI();
                });

                field.appendChild(input);
                parent.appendChild(field);
            }
        }
    }
    createFields(debugForm, target, '');
}
