// Editor State
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const entityListEl = document.getElementById('entity-list');
const assetSearchEl = document.getElementById('assetSearch');
const entityTypeSelector = document.getElementById('entityTypeSelector');
const itemCategorySelector = document.getElementById('itemCategorySelector');

let roomData = {
    name: "New Room",
    description: "",
    keyBonus: 1.0,
    speedGoal: 0,
    allDoorsUnlocked: 0,
    width: 800,
    height: 600,
    item: {
        common: { count: 0, dropChance: 0 },
        uncommon: { count: 0, dropChance: 0 },
        rare: { count: 0, dropChance: 0 },
        legendary: { count: 0, dropChance: 0 }
    },
    doors: {
        top: { active: 0, locked: 0, secret: false },
        bottom: { active: 0, locked: 0, secret: false },
        left: { active: 0, locked: 0, secret: false },
        right: { active: 0, locked: 0, secret: false }
    },
    enemies: [], // { type, x, y, moveType? }
    items: [] // { type, x, y }
};

let loadedAssets = {
    enemies: [],
    items: [],
    rooms: [],
    weapons: {
        guns_enemy: [],
        guns_player: [],
        inventory_bombs: [],
        inventory_key: [],
        modifiers_bullets: [],
        modifiers_player: []
    }
};

let selectedEntity = null; // The template we want to place
let tileSize = 50; // Grid size

// Dragging & Selection
let isDragging = false;
let draggedEntity = null; // Reference to object in roomData
let dragOffset = { x: 0, y: 0 };
let selectedPlacedEntity = null; // The object on the canvas we are editing

// --- INITIALIZATION ---
window.onload = async function () {
    console.log("Initializing Room Editor...");

    // Setup Canvas interaction
    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMove);
    canvas.addEventListener('mouseup', handleCanvasUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault()); // Block context menu

    // Setup UI inputs
    document.getElementById('roomName').addEventListener('input', updateRoomConfig);
    document.getElementById('roomDescription').addEventListener('input', updateRoomConfig);
    document.getElementById('roomKeyBonus').addEventListener('change', updateRoomConfig);
    document.getElementById('roomSpeedGoal').addEventListener('change', updateRoomConfig);
    document.getElementById('roomAllDoorsUnlocked').addEventListener('change', updateRoomConfig);

    // Item Drops Inputs
    const dropTypes = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    dropTypes.forEach(type => {
        document.getElementById(`drop${type}Count`).addEventListener('change', updateRoomConfig);
        document.getElementById(`drop${type}Chance`).addEventListener('change', updateRoomConfig);
    });

    document.getElementById('roomWidth').addEventListener('change', updateRoomSize);
    document.getElementById('roomHeight').addEventListener('change', updateRoomSize);
    const doorDirs = ['Top', 'Bottom', 'Left', 'Right'];
    doorDirs.forEach(d => {
        document.getElementById(`door${d}Active`).addEventListener('change', updateDoors);
        document.getElementById(`door${d}Locked`).addEventListener('change', updateDoors);
        document.getElementById(`door${d}Secret`).addEventListener('change', updateDoors);
    });

    assetSearchEl.addEventListener('input', renderAssetList);
    entityTypeSelector.addEventListener('change', renderAssetList);
    itemCategorySelector.addEventListener('change', renderAssetList);

    // Selected Object Inputs
    document.getElementById('selObjCount').addEventListener('change', updateSelectedObjectData);
    document.getElementById('selObjMoveType').addEventListener('change', updateSelectedObjectData);
    document.getElementById('selObjRandomStart').addEventListener('change', updateSelectedObjectData);

    // Initial Render
    draw();

    // Load Assets
    await loadAssetManifests();
};

function updateRoomConfig() {
    roomData.name = document.getElementById('roomName').value;
    roomData.description = document.getElementById('roomDescription').value;
    roomData.keyBonus = parseFloat(document.getElementById('roomKeyBonus').value) || 1.0;
    roomData.speedGoal = parseInt(document.getElementById('roomSpeedGoal').value) || 0;
    roomData.allDoorsUnlocked = document.getElementById('roomAllDoorsUnlocked').checked ? 1 : 0;

    // Update Item Drops
    const dropTypes = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    dropTypes.forEach(type => {
        const key = type.toLowerCase();
        if (!roomData.item[key]) roomData.item[key] = { count: 0, dropChance: 0 };

        roomData.item[key].count = parseInt(document.getElementById(`drop${type}Count`).value) || 0;
        roomData.item[key].dropChance = parseFloat(document.getElementById(`drop${type}Chance`).value) || 0;
    });
}

function updateRoomSize() {
    const w = parseInt(document.getElementById('roomWidth').value);
    const h = parseInt(document.getElementById('roomHeight').value);

    roomData.width = w;
    roomData.height = h;
    canvas.width = w;
    canvas.height = h;
    draw();
}

function updateDoors() {
    const dirs = ['Top', 'Bottom', 'Left', 'Right'];
    dirs.forEach(d => {
        const key = d.toLowerCase();

        if (!roomData.doors[key]) roomData.doors[key] = { active: 0, locked: 0, secret: false };

        roomData.doors[key].active = document.getElementById(`door${d}Active`).checked ? 1 : 0;
        roomData.doors[key].locked = document.getElementById(`door${d}Locked`).checked ? 1 : 0;
        roomData.doors[key].secret = document.getElementById(`door${d}Secret`).checked;
    });
    draw();
}

function updateSelectedObjectData() {
    if (!selectedPlacedEntity) return;

    selectedPlacedEntity.count = parseInt(document.getElementById('selObjCount').value) || 1;

    if (selectedPlacedEntity.moveType) {
        selectedPlacedEntity.moveType.type = document.getElementById('selObjMoveType').value;
        const isRandom = document.getElementById('selObjRandomStart').checked;

        if (isRandom) {
            selectedPlacedEntity.moveType.x = 0;
            selectedPlacedEntity.moveType.y = 0;
        } else {
            selectedPlacedEntity.moveType.x = selectedPlacedEntity.x;
            selectedPlacedEntity.moveType.y = selectedPlacedEntity.y;
        }
    }
}

function updateSelectPanel() {
    const panel = document.getElementById('selectedObjectPanel');
    if (!selectedPlacedEntity) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    document.getElementById('selObjType').innerText = selectedPlacedEntity.type;
    document.getElementById('selObjCoords').innerText = `${selectedPlacedEntity.x}, ${selectedPlacedEntity.y}`;

    if (selectedPlacedEntity.count !== undefined) {
        document.getElementById('selObjCount').parentElement.style.display = 'block';
        document.getElementById('selObjCount').value = selectedPlacedEntity.count;
    } else {
        document.getElementById('selObjCount').parentElement.style.display = 'none';
    }

    if (selectedPlacedEntity.moveType) {
        document.getElementById('selObjMoveType').parentElement.parentNode.style.display = 'grid'; // Ensure grid is visible
        document.getElementById('selObjMoveType').parentElement.style.display = 'block';
        document.getElementById('selObjMoveType').value = selectedPlacedEntity.moveType.type;
        document.getElementById('selObjRandomStart').parentElement.parentElement.style.display = 'block';

        // Determine Random Start State from data
        // If x=0 and y=0, we assume Random Start is ON (unless user explicitly placed at 0,0, but that's edge case)
        const isRandom = selectedPlacedEntity.moveType.x === 0 && selectedPlacedEntity.moveType.y === 0;
        document.getElementById('selObjRandomStart').checked = isRandom;

    } else {
        document.getElementById('selObjMoveType').parentElement.style.display = 'none';
        document.getElementById('selObjRandomStart').parentElement.parentElement.style.display = 'none';
    }
}

// --- ASSET LOADING ---
async function loadAssetManifests() {
    try {
        // Load Enemy Manifest
        const resEnemies = await fetch('json/enemies/manifest.json');
        const manifestEnemies = await resEnemies.json();

        // Load details for each enemy to get "hp" or "name" if possible, 
        // OR just list filenames for V1.
        loadedAssets.enemies = await Promise.all(manifestEnemies.enemies.map(async e => {
            try {
                const res = await fetch(`json/enemies/${e}.json`);
                const data = await res.json();
                return {
                    id: e.replace('.json', ''),
                    file: e,
                    type: 'enemy',
                    // Visual Properties
                    size: data.size || 15,
                    color: data.color || 'red',
                    shape: data.shape || 'circle',
                    defaultMoveType: data.moveType ? data.moveType.type : 'static'
                };
            } catch (err) {
                console.warn("Failed to load enemy config:", e);
                return {
                    id: e.replace('.json', ''),
                    file: e,
                    type: 'enemy',
                    size: 20, color: 'red', shape: 'circle'
                };
            }
        }));

        // Load Item Manifest
        const resItems = await fetch('json/rewards/items/manifest.json');
        const manifestItems = await resItems.json();

        loadedAssets.items = manifestItems.items.map(i => ({
            id: i,
            file: `${i}.json`,
            type: 'item'
        }));

        // Load Room Manifest
        try {
            const resRooms = await fetch('json/rooms/manifest.json');
            const manifestRooms = await resRooms.json();
            // Manifest is just IDs: ["1", "2", "testit"]
            loadedAssets.rooms = manifestRooms.rooms.map(r => ({
                id: r,
                file: `json/rooms/${r}/room.json`, // Path structure based on user context
                type: 'room'
            }));
        } catch (err) {
            console.warn("Failed to load room manifest", err);
        }

        // Load Weapon Components (Nested Items)
        const loadWeaponType = async (category, subPath, keyName) => {
            try {
                const res = await fetch(`json/items/${subPath}/manifest.json`);
                const manifest = await res.json();
                // Assumes manifest has a key like "items", "guns", "modifiers", etc.
                // We need to inspect the manifest structure. 
                // Based on `json/weapons/guns/enemy/manifest.json` cursor: let's assumes standard arrays.
                // Or just use Object.values(manifest)[0] if key varies.
                // But for safety, let's assume specific keys if known or just iterate.
                // Actually, cleaner V1: map whatever array is found.
                const list = manifest.guns || manifest.items || manifest.modifiers || manifest.bombs || manifest.keys || [];

                loadedAssets.weapons[keyName] = list.map(i => ({
                    id: i,
                    file: `json/items/${subPath}/${i}.json`,
                    type: 'item' // Treat as items for placement
                }));
            } catch (err) {
                console.warn(`Failed to load weapon manifest: ${subPath}`, err);
            }
        };

        await Promise.all([
            loadWeaponType('guns', 'guns/enemy', 'guns_enemy'),
            loadWeaponType('guns', 'guns/player', 'guns_player'),
            loadWeaponType('inventory', 'inventory/bombs', 'inventory_bombs'),
            loadWeaponType('inventory', 'inventory/key', 'inventory_key'),
            loadWeaponType('modifiers', 'modifiers/bullets', 'modifiers_bullets'),
            loadWeaponType('modifiers', 'modifiers/player', 'modifiers_player')
        ]);

        renderAssetList();

    } catch (e) {
        console.error("Failed to load manifests:", e);
        entityListEl.innerHTML = `<div style="color:red; padding:5px;">Error loading assets. Ensure server is running.</div>`;
    }
}

function renderAssetList() {
    const filter = assetSearchEl.value.toLowerCase();
    const mode = entityTypeSelector.value;
    let list = [];

    // Reset UI
    itemCategorySelector.style.display = 'none';

    if (mode === 'enemy') {
        list = loadedAssets.enemies;
    } else if (mode === 'item') {
        itemCategorySelector.style.display = 'block';
        // Use sub-category
        const subCat = itemCategorySelector.value || 'guns_enemy';
        list = loadedAssets.weapons[subCat] || [];

        // Also include standard items? 
        // User asked to break items down. 
        // Previous 'items' (loadedAssets.items) likely belong to one of these or are generic.
        // Let's allow selecting "Generic" if needed, but for now specific categories requested.
        // If we want to show the OLD items, we might need a "Generic" option in dropdown.
        // But user request seems to replace the single "Items" view with these categories.
    } else if (mode === 'room') {
        list = loadedAssets.rooms;
    }

    entityListEl.innerHTML = '';

    list.forEach(asset => {
        if (filter && !asset.id.toLowerCase().includes(filter)) return;

        const div = document.createElement('div');
        div.className = 'entity-item';
        if (selectedEntity && selectedEntity.id === asset.id) div.classList.add('selected');

        div.innerText = asset.id;

        if (asset.type === 'room') {
            div.onclick = () => loadRoomAsset(asset);
        } else {
            div.onclick = () => selectTool(asset);
        }

        entityListEl.appendChild(div);
    });
}

async function loadRoomAsset(asset) {
    if (!confirm(`Load room "${asset.id}"? Unsaved changes will be lost.`)) return;

    try {
        const res = await fetch(asset.file);
        if (!res.ok) throw new Error("File not found");
        const data = await res.json();

        // Use existing load logic (but we need to adapt it since loadFromClipboard expects clipboard)
        // Let's refactor loadFromClipboard to reuse a common parsing function 'loadRoomData(data)'?
        // OR just simulate it.
        // Actually, we can just update roomData and UI directly, effectively what loadFromClipboard does.
        // Or extract the logic.
        // I'll extract a helper: processLoadedRoom(data)
        processLoadedRoom(data);
        showToast(`Room "${asset.id}" loaded!`, "success");

    } catch (e) {
        console.error(e);
        showToast("Failed to load room: " + e.message, "error");
    }
}

// Helper to share logic with loadFromClipboard
function processLoadedRoom(data) {
    // Basic Validation
    if (!data.width || !data.height) throw new Error("Invalid Room JSON");

    // Hydrate Data: Restore top-level x,y for Editor if missing (from MoveType)
    if (data.enemies) {
        const explodedEnemies = [];
        data.enemies.forEach(en => {
            // Determine Count
            const count = en.count || 1;

            // Explode based on count
            for (let i = 0; i < count; i++) {
                const newEn = JSON.parse(JSON.stringify(en)); // Deep copy
                newEn.count = 1; // Reset count for individual entity

                // 1. Try to get from moveType (Base coord)
                if (newEn.x === undefined && newEn.moveType && newEn.moveType.x !== undefined) newEn.x = newEn.moveType.x;
                if (newEn.y === undefined && newEn.moveType && newEn.moveType.y !== undefined) newEn.y = newEn.moveType.y;

                // 2. Fallback: Random placement if missing or 0,0
                if (newEn.x === undefined || (newEn.moveType && newEn.moveType.x === 0)) {
                    if (newEn.x === undefined || newEn.x === 0) {
                        newEn.x = Math.floor(Math.random() * (data.width - 100)) + 50;
                    }
                }
                if (newEn.y === undefined || (newEn.moveType && newEn.moveType.y === 0)) {
                    if (newEn.y === undefined || newEn.y === 0) {
                        newEn.y = Math.floor(Math.random() * (data.height - 100)) + 50;
                    }
                }

                explodedEnemies.push(newEn);
            }
        });
        data.enemies = explodedEnemies;
    }

    roomData = data;

    // Update UI inputs
    // (We need to ensure document.getElementById calls work. They should.)
    if (document.getElementById('roomName')) document.getElementById('roomName').value = roomData.name || "Unnamed";
    if (document.getElementById('roomDescription')) document.getElementById('roomDescription').value = roomData.description || "";
    if (document.getElementById('roomKeyBonus')) document.getElementById('roomKeyBonus').value = roomData.keyBonus !== undefined ? roomData.keyBonus : 1.0;
    if (document.getElementById('roomSpeedGoal')) document.getElementById('roomSpeedGoal').value = roomData.speedGoal !== undefined ? roomData.speedGoal : 0;
    if (document.getElementById('roomAllDoorsUnlocked')) document.getElementById('roomAllDoorsUnlocked').checked = !!roomData.allDoorsUnlocked;

    // Populate Drop Inputs
    const dropTypes = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    dropTypes.forEach(type => {
        const key = type.toLowerCase();
        const d = roomData.item && roomData.item[key] ? roomData.item[key] : { count: 0, dropChance: 0 };
        const elCount = document.getElementById(`drop${type}Count`);
        const elChance = document.getElementById(`drop${type}Chance`);
        if (elCount) elCount.value = d.count;
        if (elChance) elChance.value = d.dropChance;
    });

    if (document.getElementById('roomWidth')) document.getElementById('roomWidth').value = roomData.width;
    if (document.getElementById('roomHeight')) document.getElementById('roomHeight').value = roomData.height;

    // Doors
    const bindDoor = (dir) => {
        const d = roomData.doors[dir];
        const elActive = document.getElementById(`door${dir.charAt(0).toUpperCase() + dir.slice(1)}Active`);
        const elLocked = document.getElementById(`door${dir.charAt(0).toUpperCase() + dir.slice(1)}Locked`);
        const elSecret = document.getElementById(`door${dir.charAt(0).toUpperCase() + dir.slice(1)}Secret`);
        if (elActive) elActive.checked = !!d?.active;
        if (elLocked) elLocked.checked = !!d?.locked;
        if (elSecret) elSecret.checked = !!d?.secret;
    };
    bindDoor('top');
    bindDoor('bottom');
    bindDoor('left');
    bindDoor('right');

    draw();
}

function selectTool(asset) {
    selectedEntity = asset;
    document.getElementById('currentTool').innerText = asset.id;
    renderAssetList(); // Re-render to update highlight
}

// --- CANVAS INTERACTION ---
// --- CANVAS INTERACTION ---
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 0) { // Left Click
        // 1. Check for collision with existing entities (Reverse order to pick top-most)
        let hit = null;
        // Check enemies
        for (let i = roomData.enemies.length - 1; i >= 0; i--) {
            const en = roomData.enemies[i];
            const size = 30; // Approx hit box
            if (x >= en.x - size / 2 && x <= en.x + size / 2 && y >= en.y - size / 2 && y <= en.y + size / 2) {
                hit = en;
                break;
            }
        }
        // Check items (if no enemy hit)
        if (!hit && roomData.items) {
            for (let i = roomData.items.length - 1; i >= 0; i--) {
                const it = roomData.items[i];
                if (Math.hypot(it.x - x, it.y - y) <= 15) {
                    hit = it;
                    break;
                }
            }
        }

        if (hit) {
            // Start Dragging & Selection
            isDragging = true;
            draggedEntity = hit;
            selectedPlacedEntity = hit;
            dragOffset.x = x - hit.x;
            dragOffset.y = y - hit.y;
            updateSelectPanel();
            draw();
            return; // Don't place new entity
        }

        // Deselect
        selectedPlacedEntity = null;
        updateSelectPanel();

        // 2. Place New Entity (if no existing entity clicked)
        const snap = document.getElementById('snapToggle').checked;
        const finalX = snap ? Math.round(x / 25) * 25 : x;
        const finalY = snap ? Math.round(y / 25) * 25 : y;

        if (!selectedEntity) return;

        if (selectedEntity.type === 'enemy') {
            const defType = selectedEntity.defaultMoveType || 'static';
            const isStatic = defType === 'static';

            const newEnemy = {
                type: selectedEntity.id,
                count: 1,
                x: finalX,
                y: finalY,
                moveType: {
                    type: defType,
                    x: isStatic ? finalX : 0,
                    y: isStatic ? finalY : 0
                }
            };
            roomData.enemies.push(newEnemy);
            selectedPlacedEntity = newEnemy; // Auto-select new
            updateSelectPanel();
        }
        else if (selectedEntity.type === 'item') {
            if (!roomData.items) roomData.items = [];
            const newItem = {
                type: selectedEntity.id,
                x: finalX,
                y: finalY,
                count: 1
            };
            roomData.items.push(newItem);
            selectedPlacedEntity = newItem;
            updateSelectPanel();
        }
    } else if (e.button === 2) { // Right Click: Delete
        roomData.enemies = roomData.enemies.filter(en => {
            const dist = Math.hypot(en.x - x, en.y - y);
            return dist > 20;
        });
        if (roomData.items) {
            roomData.items = roomData.items.filter(it => Math.hypot(it.x - x, it.y - y) > 20);
        }
        // Deselect if deleted
        if (selectedPlacedEntity &&
            !roomData.enemies.includes(selectedPlacedEntity) &&
            (!roomData.items || !roomData.items.includes(selectedPlacedEntity))) {
            selectedPlacedEntity = null;
            updateSelectPanel();
        }
    }

    draw();
}

function handleCanvasMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update Drag
    if (isDragging && draggedEntity) {
        const snap = document.getElementById('snapToggle').checked;
        let rawX = x - dragOffset.x;
        let rawY = y - dragOffset.y;

        if (snap) {
            draggedEntity.x = Math.round(rawX / 25) * 25;
            draggedEntity.y = Math.round(rawY / 25) * 25;
        } else {
            draggedEntity.x = rawX;
            draggedEntity.y = rawY;
        }

        // Also update moveType default pos for static enemies if they are moved
        // AND if Random Start is NOT checked
        if (draggedEntity.moveType) {
            const isRandom = draggedEntity.moveType.x === 0 && draggedEntity.moveType.y === 0;
            // Better to rely on UI check? Or data? 
            // If data is 0,0 we treat as random. If we drag, do we WANT to break randomness?
            // Usually dragging implies setting specific coord. 
            // But if "Random Start" is ON, we shouldn't update moveType coords, just visual coords.

            // To be precise: We check the Checkbox if this is the SELECTED entity.
            // If dragging something NOT selected, we might assume... 
            // Let's assume user works on Selected object mostly. 
            // If we drag, let's look at the object data directly.

            // Logic: If currently 0,0, keep 0,0 (assume Random).
            // Unless.. the user unchecks the box.

            // Wait, if I drag a Random object, I probably want to POSITION it to Un-Random it? 
            // Or just position it for visual reference?
            // The UX: Check "Random" -> Coords become 0,0 in JSON. Visuals stay.
            // Drag "Random" object -> Visuals move. JSON stays 0,0.

            // So:
            if (draggedEntity.moveType.x !== 0 || draggedEntity.moveType.y !== 0) {
                draggedEntity.moveType.x = draggedEntity.x;
                draggedEntity.moveType.y = draggedEntity.y;
            }
            // If it IS 0,0, we leave it 0,0.
        }

        updateSelectPanel(); // Update text
        draw();
    }

    document.getElementById('cursor-coords').innerText = `${Math.round(x)}, ${Math.round(y)}`;
}

function handleCanvasUp(e) {
    isDragging = false;
    draggedEntity = null;
}

// --- VISUAL UTILS ---
function drawShape(ctx, x, y, size, shape, color) {
    ctx.fillStyle = color;
    ctx.beginPath();

    if (shape === 'square') {
        ctx.rect(x - size / 2, y - size / 2, size, size);
    }
    else if (shape === 'triangle') {
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 2, y + size / 2);
        ctx.lineTo(x - size / 2, y + size / 2);
        ctx.closePath();
    }
    else if (shape === 'diamond') {
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 2, y);
        ctx.lineTo(x, y + size / 2);
        ctx.lineTo(x - size / 2, y);
        ctx.closePath();
    }
    else if (shape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const px = x + Math.cos(angle) * (size / 2);
            const py = y + Math.sin(angle) * (size / 2);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }
    else if (shape === 'star') {
        const spokes = 5;
        const inset = 0.5;
        for (let i = 0; i < spokes * 2; i++) {
            const angle = i * Math.PI / spokes - Math.PI / 2;
            const r = (i % 2 === 0) ? size / 2 : (size / 2) * inset;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }
    else { // Circle (default)
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    }

    ctx.fill();
    // Border for contrast
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
}

// --- RENDERING ---
function draw() {
    // 1. Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Grid
    if (document.getElementById('gridToggle').checked) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += tileSize) {
            ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
        }
        for (let y = 0; y <= canvas.height; y += tileSize) {
            ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
        }
        ctx.stroke();
    }

    // 3. Doors (Visual placeholders)
    // 3. Doors (Visual placeholders)
    ctx.fillStyle = '#555';
    // Draw Locked/Secret Colors if needed?
    // Let's stick to simple active check for now, maybe add color indicator for locked

    function getDoorColor(door) {
        if (!door || !door.active) return null;
        if (door.secret) return '#8e44ad'; // Purple for secret
        if (door.locked) return '#c0392b'; // Red for locked
        return '#555'; // Gray for normal
    }

    const cTop = getDoorColor(roomData.doors.top);
    if (cTop) { ctx.fillStyle = cTop; ctx.fillRect(canvas.width / 2 - 50, 0, 100, 20); }

    const cBottom = getDoorColor(roomData.doors.bottom);
    if (cBottom) { ctx.fillStyle = cBottom; ctx.fillRect(canvas.width / 2 - 50, canvas.height - 20, 100, 20); }

    const cLeft = getDoorColor(roomData.doors.left);
    if (cLeft) { ctx.fillStyle = cLeft; ctx.fillRect(0, canvas.height / 2 - 50, 20, 100); }

    const cRight = getDoorColor(roomData.doors.right);
    if (cRight) { ctx.fillStyle = cRight; ctx.fillRect(canvas.width - 20, canvas.height / 2 - 50, 20, 100); }

    // 4. Items (Draw first so enemies are on top)
    if (roomData.items) {
        roomData.items.forEach(it => {
            ctx.fillStyle = 'gold'; // Gold for items
            ctx.beginPath();
            ctx.arc(it.x, it.y, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(it.type, it.x, it.y - 15);
        });
    }

    // 5. Enemies
    roomData.enemies.forEach(en => {
        // Look up asset data for visuals
        const asset = loadedAssets.enemies.find(a => a.id === en.type);
        const size = asset ? asset.size : 20;
        const color = asset ? asset.color : 'red';
        const shape = asset ? asset.shape : 'circle';

        drawShape(ctx, en.x, en.y, size, shape, color);

        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(en.type, en.x, en.y - size / 2 - 5);
    });

    // Draw Selection Box
    if (selectedPlacedEntity) {
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.strokeRect(selectedPlacedEntity.x - 20, selectedPlacedEntity.y - 20, 40, 40);
        ctx.font = "10px monospace";
        ctx.fillStyle = "#f39c12";
        ctx.fillText("SEL", selectedPlacedEntity.x, selectedPlacedEntity.y - 25);
    }
}

// --- EXPORT ---
window.exportJSON = function () {
    try {
        // Deep copy to clean up for export
        const cleanData = JSON.parse(JSON.stringify(roomData));

        if (cleanData.enemies) {
            cleanData.enemies.forEach(en => {
                // User requested: "only require x,y in the movetype"
                // So if moveType exists, we remove top-level x,y to reduce redundancy.
                if (en.moveType) {
                    delete en.x;
                    delete en.y;
                }
            });
        }

        const json = JSON.stringify(cleanData, null, 4);
        const outputParams = document.getElementById('jsonOutput');

        // 1. Always fill and select the textarea first (Reliable Fallback)
        if (outputParams) {
            outputParams.value = json;
            outputParams.select();
        }

        // 2. Try Async Clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
                showToast("JSON copied to clipboard!", "success");
            }).catch(err => {
                console.error("Clipboard write failed:", err);
                // We already selected the text above, so just notify
                showToast("Clipboard failed. Text selected for manual copy.", "error");
            });
        } else {
            console.warn("Clipboard API missing");
            showToast("Clipboard not supported. Text selected for manual copy.", "info");
        }
    } catch (e) {
        console.error("Export Failed:", e);
        showToast("Export error: " + e.message, "error");
    }
};

window.loadFromClipboard = async function () {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);

        // Basic Validation
        if (!data.width || !data.height) throw new Error("Invalid Room JSON");

        processLoadedRoom(data);

        draw();
        showToast("Room Loaded!", "success");
    } catch (e) {
        showToast("Failed to load JSON: " + e.message, "error");
    }
};

// Update UI inputs
// (This block was orphaned - removing it)

// Helper to share logic with loadFromClipboard
function processLoadedRoom(data) {
    // Basic Validation
    if (!data.width || !data.height) throw new Error("Invalid Room JSON");

    // Hydrate Data: Restore top-level x,y for Editor if missing (from MoveType)
    if (data.enemies) {
        const explodedEnemies = [];
        data.enemies.forEach(en => {
            // Determine Count
            const count = en.count || 1;

            // Explode based on count
            for (let i = 0; i < count; i++) {
                const newEn = JSON.parse(JSON.stringify(en)); // Deep copy
                newEn.count = 1; // Reset count for individual entity

                // 1. Try to get from moveType (Base coord)
                if (newEn.x === undefined && newEn.moveType && newEn.moveType.x !== undefined) newEn.x = newEn.moveType.x;
                if (newEn.y === undefined && newEn.moveType && newEn.moveType.y !== undefined) newEn.y = newEn.moveType.y;

                // 2. Fallback: Random placement if missing or 0,0
                if (newEn.x === undefined || (newEn.moveType && newEn.moveType.x === 0)) {
                    if (newEn.x === undefined || newEn.x === 0) {
                        newEn.x = Math.floor(Math.random() * (data.width - 100)) + 50;
                    }
                }
                if (newEn.y === undefined || (newEn.moveType && newEn.moveType.y === 0)) {
                    if (newEn.y === undefined || newEn.y === 0) {
                        newEn.y = Math.floor(Math.random() * (data.height - 100)) + 50;
                    }
                }

                explodedEnemies.push(newEn);
            }
        });
        data.enemies = explodedEnemies;
    }

    roomData = data;

    // Update UI inputs
    if (document.getElementById('roomName')) document.getElementById('roomName').value = roomData.name || "Unnamed";
    if (document.getElementById('roomDescription')) document.getElementById('roomDescription').value = roomData.description || "";
    if (document.getElementById('roomKeyBonus')) document.getElementById('roomKeyBonus').value = roomData.keyBonus !== undefined ? roomData.keyBonus : 1.0;
    if (document.getElementById('roomSpeedGoal')) document.getElementById('roomSpeedGoal').value = roomData.speedGoal !== undefined ? roomData.speedGoal : 0;
    if (document.getElementById('roomAllDoorsUnlocked')) document.getElementById('roomAllDoorsUnlocked').checked = !!roomData.allDoorsUnlocked;

    // Populate Drop Inputs
    const dropTypes = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    dropTypes.forEach(type => {
        const key = type.toLowerCase();
        const d = roomData.item && roomData.item[key] ? roomData.item[key] : { count: 0, dropChance: 0 };
        const elCount = document.getElementById(`drop${type}Count`);
        const elChance = document.getElementById(`drop${type}Chance`);
        if (elCount) elCount.value = d.count;
        if (elChance) elChance.value = d.dropChance;
    });

    if (document.getElementById('roomWidth')) document.getElementById('roomWidth').value = roomData.width;
    if (document.getElementById('roomHeight')) document.getElementById('roomHeight').value = roomData.height;

    // Doors
    const bindDoor = (dir) => {
        const d = roomData.doors[dir];
        const elActive = document.getElementById(`door${dir.charAt(0).toUpperCase() + dir.slice(1)}Active`);
        const elLocked = document.getElementById(`door${dir.charAt(0).toUpperCase() + dir.slice(1)}Locked`);
        const elSecret = document.getElementById(`door${dir.charAt(0).toUpperCase() + dir.slice(1)}Secret`);
        if (elActive) elActive.checked = !!d?.active;
        if (elLocked) elLocked.checked = !!d?.locked;
        if (elSecret) elSecret.checked = !!d?.secret;
    };
    bindDoor('top');
    bindDoor('bottom');
    bindDoor('left');
    bindDoor('right');

    const json = JSON.stringify(roomData, null, 4);
    if (document.getElementById('jsonOutput')) document.getElementById('jsonOutput').value = json;

    draw();
}

async function loadRoomAsset(asset) {
    if (!confirm(`Load room "${asset.id}"? Unsaved changes will be lost.`)) return;

    try {
        const res = await fetch(asset.file);
        if (!res.ok) throw new Error("File not found");
        const data = await res.json();

        processLoadedRoom(data);
        showToast(`Room "${asset.id}" loaded!`, "success");

    } catch (e) {
        console.error(e);
        showToast("Failed to load room: " + e.message, "error");
    }
}

window.testRoom = function () {
    // 1. Save current room data to localStorage
    const json = JSON.stringify(roomData);
    localStorage.setItem('debugRoomData', json);

    // 2. Open Iframe Modal
    const modal = document.getElementById('testModal');
    const frame = document.getElementById('testFrame');

    frame.src = 'index.html?debugRoom=true&t=' + Date.now();

    modal.style.display = 'flex';

    // Focus button to allow easy close? No, focus iframe?
    // Let's add global ESC handler
    if (!window.escHandler) {
        window.escHandler = function (e) {
            if (e.key === 'Escape') closeTestModal();
        };
        window.addEventListener('keydown', window.escHandler);
    }
};

window.closeTestModal = function () {
    const modal = document.getElementById('testModal');
    const frame = document.getElementById('testFrame');

    modal.style.display = 'none';
    frame.src = ''; // Stop game

    // Remove listener? Or keep it? keeping is fine.

    // Maybe reload editor canvas if needed to clear glitches?
    draw();
};

window.showToast = function (msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);

    // Auto remove from DOM after animation
    setTimeout(() => {
        toast.remove();
    }, 3000);
};


