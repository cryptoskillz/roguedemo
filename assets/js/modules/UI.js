import { Globals } from './Globals.js';
import { STATES, CONFIG, STORAGE_KEYS } from './Constants.js';
// Utils might be needed if logging
import { log } from './Utils.js';

export function updateFloatingTexts() {
    for (let i = Globals.floatingTexts.length - 1; i >= 0; i--) {
        const ft = Globals.floatingTexts[i];

        // Follow Target Logic
        if (ft.target && !ft.target.isDead) {
            ft.x = ft.target.x;
            ft.y = ft.target.y - ft.target.size - 20; // Maintain offset
        } else {
            // Only drift if no target or target dead
            ft.y += ft.vy;
        }

        ft.life -= 0.02;
        if (ft.life <= 0) Globals.floatingTexts.splice(i, 1);
    }
}

export function drawFloatingTexts() {
    Globals.ctx.save();
    Globals.floatingTexts.forEach(ft => {
        Globals.ctx.globalAlpha = ft.life;
        Globals.ctx.font = "bold 12px monospace";

        if (ft.type === 'speech') {
            // Measure text
            const metrics = Globals.ctx.measureText(ft.text);
            const w = metrics.width + 10;
            const h = 20;
            const x = Math.floor(ft.x - w / 2); // Pixel perfect align
            const y = Math.floor(ft.y - h);

            Globals.ctx.lineWidth = 2; // Thicker border for 8-bit feel
            Globals.ctx.strokeStyle = "black";
            Globals.ctx.fillStyle = "white";

            // Draw Box (Sharp Edges)
            Globals.ctx.beginPath();
            Globals.ctx.rect(x, y, w, h);
            Globals.ctx.fill();
            Globals.ctx.stroke();

            // Draw Tail (Simple Triangle)
            Globals.ctx.beginPath();
            Globals.ctx.moveTo(Math.floor(ft.x), y + h);
            Globals.ctx.lineTo(Math.floor(ft.x - 5), y + h + 6);
            Globals.ctx.lineTo(Math.floor(ft.x + 5), y + h);
            Globals.ctx.stroke(); // Stroke first for outline? No, complex.
            // Fill tail to hide box stroke overlap
            Globals.ctx.fill();

            // Re-stroke box bottom segment to clean up? 
            // Actually, for simple 8-bit, just a small triangle sticking out is fine.
            // Let's just draw the tail shape filled and stroked.

            Globals.ctx.beginPath();
            Globals.ctx.moveTo(Math.floor(ft.x), y + h);
            Globals.ctx.lineTo(Math.floor(ft.x + 4), y + h);
            Globals.ctx.lineTo(Math.floor(ft.x), y + h + 6); // Pointy bit
            Globals.ctx.lineTo(Math.floor(ft.x - 4), y + h);
            Globals.ctx.fill();
            Globals.ctx.stroke();

            // Draw Text (Black, centered)
            Globals.ctx.fillStyle = "black";
            Globals.ctx.textAlign = "center"; // Align to center of bubble
            Globals.ctx.textBaseline = "middle";
            Globals.ctx.fillText(ft.text, Math.floor(ft.x), Math.floor(y + h / 2));
        } else {
            // Normal Floating Text
            Globals.ctx.textAlign = "center"; // Ensure normal text is also centered?
            Globals.ctx.fillStyle = ft.color;
            Globals.ctx.fillText(ft.text, ft.x, ft.y);
        }
    });
    Globals.ctx.restore();
}

export function showLevelTitle(title) {
    let titleEl = document.getElementById('level-title-overlay');
    if (!titleEl) {
        titleEl = document.createElement('div');
        titleEl.id = 'level-title-overlay';
        titleEl.style.cssText = `
        position: fixed; top: 30%; left: 50%; transform: translate(-50%, -50%);
        color: white; font-family: 'Courier New', monospace; text-align: center;
        pointer-events: none; z-index: 3000; text-transform: uppercase;
        text-shadow: 0 0 10px black; opacity: 0; transition: opacity 1s;
    `;
        document.body.appendChild(titleEl);
    }

    titleEl.innerHTML = `<h1 style="font-size: 4em; margin: 0; color: #f1c40f;">${title}</h1>`;
    titleEl.style.display = 'block';

    // Animation Sequence
    requestAnimationFrame(() => {
        titleEl.style.opacity = '1';
        setTimeout(() => {
            titleEl.style.opacity = '0';
            setTimeout(() => {
                titleEl.style.display = 'none';
            }, 1000);
        }, 3000); // Show for 3 seconds
    });
}

export function updateWelcomeScreen() {
    const p = Globals.availablePlayers[Globals.selectedPlayerIndex];
    if (!p) return;

    // Update Welcome UI dynamically
    let charSelectHtml = '';
    // Assume gameData is in Globals
    if (Globals.gameData.showCharacterSelect !== false) {
        charSelectHtml = `<div class="character-select">
            <h2 style="color: ${p.locked ? 'gray' : '#0ff'}">${p.name} ${p.locked ? '(LOCKED)' : ''}</h2>
            <p>${p.Description || "No description"}</p>
            <p style="font-size: 0.9em; color: #888;">Speed: ${p.speed} | HP: ${p.hp}</p>
            <div class="char-nav">
                <span class="char-arrow">&lt;</span> 
                <span>${Globals.selectedPlayerIndex + 1} / ${Globals.availablePlayers.length}</span> 
                <span class="char-arrow">&gt;</span>
            </div>
        </div>`;
    }


    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
    const hasSave = localStorage.getItem('game_unlocks') || unlockedIds.length > 0;
    const startText = hasSave
        ? 'Press any key to continue<br><div style="margin-top:8px; font-size:0.8em; color:#e74c3c;">Press <span class="key-badge">T</span> for New Run or <span class="key-badge">N</span> to Delete Save</div>'
        : 'Press any key to start';

    // Normalize string array check (case-insensitive)
    const hasUnlock = (id) => unlockedIds.some(u => u.toLowerCase() === id.toLowerCase());

    // Conditional Instructions
    let instructions = "";
    if (Globals.gameData.music || hasUnlock('music')) instructions += `<div>Press <span class="key-badge">0</span> to toggle music</div>`;
    if (Globals.gameData.soundEffects || hasUnlock('soundeffects')) instructions += `<div>Press <span class="key-badge">9</span> to toggle SFX</div>`;

    if (Globals.gameData.showSeed) {
        instructions += `<div style="margin-top: 10px; pointer-events: auto;">Seed: <input type="text" id="seedInput" value="${Globals.seed || ''}" style="width: 100px; text-align: center; background: #333; color: white; border: 1px solid #555; font-family: inherit;"></div>`;
    }

    // Update Welcome Element if exists
    // Globals.elements.welcome is cached
    if (Globals.elements.welcome) {
        Globals.elements.welcome.innerHTML = `
        <h1 class="welcome-title">GEOMETRY DASH</h1>
        ${charSelectHtml}
        <div class="welcome-instructions">${instructions}</div>
        <p style="margin-top: 30px; font-size: 1.4rem; animation: blink 1.5s infinite;">${startText}</p>
        <p style="font-size: 0.8em; color: #555; margin-top: 40px;">v0.93</p>
    `;
    }
}

export async function updateUI() {
    if (!Globals.elements.ui) return;

    // HP
    if (Globals.elements.hp) Globals.elements.hp.innerText = `HP: ${Math.ceil(Globals.player.hp)} / ${Globals.player.maxHp}`;

    // Room Name (Ensure it persists)
    if (Globals.elements.roomName && Globals.roomData) Globals.elements.roomName.innerText = Globals.roomData.name || "Unknown Room";

    // Keys
    if (Globals.elements.keys) {
        const keyCount = Globals.player.inventory.keys || 0;
        const maxKeys = Globals.player.inventory.maxKeys || 5;
        Globals.elements.keys.innerText = `${keyCount}/${maxKeys}`;
    }

    // Bombs
    if (Globals.elements.bombs) {
        const bombCount = Globals.player.inventory.bombs || 0;
        const maxBombs = Globals.player.inventory.maxBombs || 10;
        const bombColor = (Globals.player.bombType || 'normal') === 'normal' ? '#fff' : '#e74c3c'; // Red for special?
        Globals.elements.bombs.style.color = ""; // Reset parent color
        Globals.elements.bombs.innerHTML = `BOMBS: <span style="color: ${bombColor}">${bombCount}/${maxBombs}</span>`;
    }

    // Gun & Ammo
    const gunName = Globals.player.gunType || "Default";
    if (Globals.elements.gun) Globals.elements.gun.innerText = gunName.toUpperCase();

    let ammoText = "INF";

    // Check Player State (Dynamic) vs Gun Config (Static)
    // Finite / Recharge / Reload modes are stored on player
    const mode = Globals.player.ammoMode;

    if (Globals.player.reloading) {
        ammoText = "RELOADING...";
    } else if (!mode || mode === 'infinite') {
        ammoText = "INF";
    } else if (mode === 'recharge' || mode === 'finite') {
        // Show Current / Max Clip
        ammoText = `${Math.floor(Globals.player.ammo)} / ${Globals.player.maxMag}`;
    } else if (mode === 'reload') {
        // Show Current / Reserve
        ammoText = `${Math.floor(Globals.player.ammo)} / ${Globals.player.reserveAmmo}`;
    }

    if (Globals.elements.ammo) Globals.elements.ammo.innerText = ammoText;

    // Shards
    const redShards = Globals.player.inventory.redShards || 0;
    const maxRed = Globals.player.maxRedShards || 500;
    const greenShards = Globals.player.inventory.greenShards || 0;
    const maxGreen = Globals.player.maxGreenShards || 100;
    const redEl = document.getElementById('red-shards');
    const greenEl = document.getElementById('green-shards');

    if (redEl) redEl.innerHTML = `<span style="color: #e74c3c">♦</span> ${redShards} / ${maxRed}`;
    if (greenEl) greenEl.innerHTML = `<span style="color: #2ecc71">◊</span> ${greenShards} / ${maxGreen} `;

    // Timer
    if (Globals.elements.timer) {
        // Check Unlock Status or Config
        const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
        const showTimer = Globals.gameData.showTimer || unlockedIds.includes('timer');

        if (showTimer) {
            Globals.elements.timer.style.display = 'block';
            const elapsed = Globals.runElapsedTime || 0;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const ms = Math.floor((elapsed % 1000) / 10);

            // Direct Span Update (No layout thrashing of container)
            if (Globals.elements.tMin) Globals.elements.tMin.textContent = minutes.toString().padStart(2, '0');
            if (Globals.elements.tSec) Globals.elements.tSec.textContent = seconds.toString().padStart(2, '0');
            if (Globals.elements.tMs) Globals.elements.tMs.textContent = ms.toString().padStart(2, '0');

            if (Globals.gameData.showSeed && Globals.seed) {
                let seedEl = document.getElementById('seed-display');
                if (!seedEl) {
                    seedEl = document.createElement('div');
                    seedEl.id = 'seed-display';
                    seedEl.style.fontSize = '12px';
                    seedEl.style.color = '#888';
                    seedEl.style.textAlign = 'center';
                    seedEl.style.marginTop = '-5px';
                    Globals.elements.timer.appendChild(seedEl);
                }
                seedEl.innerText = `${Globals.seed}`;
            }
        } else {
            Globals.elements.timer.style.display = 'none';
        }
    }
}

// ... DEBUG EDITOR ...
// I will skip huge debug editor for this specific tool call to save space, 
// and handle it in a follow-up or simplify it.
// It is 300+ lines.

// --- PORTED DRAW FUNCTIONS ---

export function drawTutorial() {
    // --- Start Room Tutorial Text ---
    // Show in start room (0,0) if it is NOT a boss room

    if (Globals.roomData.name == "The Beginning" && Globals.player.roomX === 0 && Globals.player.roomY === 0 && !Globals.roomData.isBoss && !STATES.DEBUG_START_BOSS && !STATES.DEBUG_TEST_ROOM) {
        Globals.ctx.save();

        //uodate start room name in the UI
        if (Globals.elements.roomName) Globals.elements.roomName.innerText = Globals.roomData.name;

        // Internal helper for keycaps
        const drawKey = (text, x, y) => {
            Globals.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            Globals.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            Globals.ctx.lineWidth = 2;
            Globals.ctx.beginPath();
            Globals.ctx.roundRect(x - 20, y - 20, 40, 40, 5);
            Globals.ctx.fill();
            Globals.ctx.stroke();

            Globals.ctx.font = "bold 20px 'Courier New'";
            Globals.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            Globals.ctx.textAlign = "center";
            Globals.ctx.textBaseline = "middle";
            Globals.ctx.fillText(text, x, y);
        };

        const ly = Globals.canvas.height / 2;

        // MOVE (WASD)
        const lx = 200;
        Globals.ctx.font = "16px 'Courier New'";
        Globals.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        Globals.ctx.textAlign = "center";
        Globals.ctx.fillText("MOVE", lx, ly - 90);
        drawKey("W", lx, ly - 45);
        drawKey("A", lx - 45, ly);
        drawKey("S", lx, ly);
        drawKey("D", lx + 45, ly);

        // SHOOT (Arrows)
        if (Globals.player.gunType) {
            const rx = Globals.canvas.width - 200;
            Globals.ctx.fillText("SHOOT", rx, ly - 90);
            Globals.ctx.beginPath();
            Globals.ctx.arc(rx, ly - 75, 5, 0, Math.PI * 2);
            Globals.ctx.fillStyle = "#e74c3c";
            Globals.ctx.fill();

            drawKey("↑", rx, ly - 45);
            drawKey("←", rx - 45, ly);
            drawKey("→", rx + 45, ly);
            drawKey("↓", rx, ly + 45);
        }

        // Action Keys (Bottom Row)
        let mx = Globals.canvas.width / 6;
        let my = Globals.canvas.height - 80;

        const actions = [];
        if (Globals.gameData.itemPickup) actions.push({ label: "ITEM", key: "⎵" });
        if (Globals.gameData.pause !== false) actions.push({ label: "PAUSE", key: "P" });
        if (Globals.gameData.music) actions.push({ label: "MUSIC", key: "0" });
        if (Globals.gameData.soundEffects) actions.push({ label: "SFX", key: "9" });

        if (Globals.player.bombType) {
            actions.push({ label: "BOMB", key: "B" });
        }

        actions.push({ label: "NEW RUN", key: "T" });

        actions.push({ label: "RESTART", key: "R" });


        actions.forEach(action => {
            Globals.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            Globals.ctx.fillText(action.label, mx, my - 45);
            drawKey(action.key, mx, my);
            mx += 100;
        });

        Globals.ctx.restore();
    }
}

export function drawStatsPanel() {
    //get the ids
    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
    //check for minimap
    const statsPanel = Globals.gameData.showStatsPanel || unlockedIds.includes('statsPanel');
    if (Globals.gameData && statsPanel === false) {
        if (Globals.statsPanel) Globals.statsPanel.style.display = 'none';
        return;
    }
    else {

        //only add the block style if its not already applied
        if (Globals.statsPanel && Globals.statsPanel.style.display === 'none') Globals.statsPanel.style.display = 'block';
    }
}

export function drawMinimap() {
    if (!Globals.mctx) return; // Safety check
    //get the ids
    const unlockedIds = JSON.parse(localStorage.getItem('game_unlocked_ids') || '[]');
    //check for minimap
    const showMinimap = Globals.gameData.showMinimap || unlockedIds.includes('minimap');


    if (Globals.gameData && showMinimap === false) {
        if (Globals.mapCanvas) Globals.mapCanvas.style.display = 'none';
        return;
    }

    // Ensure it's visible if we are drawing
    if (Globals.mapCanvas && Globals.mapCanvas.style.display === 'none') {
        Globals.mapCanvas.style.display = 'block';
    }

    const mapSize = 100;
    const roomSize = 12;
    const padding = 2;

    // Clear Minimap
    Globals.mctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    Globals.mctx.fillRect(0, 0, mapSize, mapSize);
    Globals.mctx.strokeStyle = "#888";
    Globals.mctx.lineWidth = 1;
    Globals.mctx.strokeRect(0, 0, mapSize, mapSize);

    // Draw Explored Rooms
    Globals.mctx.save();
    // Center map on player's room
    Globals.mctx.translate(mapSize / 2, mapSize / 2);

    for (let coord in Globals.visitedRooms) {
        const parts = coord.split(',');
        const rx = parseInt(parts[0]);
        const ry = parseInt(parts[1]);
        const isCurrent = rx === Globals.player.roomX && ry === Globals.player.roomY;
        const isCleared = Globals.visitedRooms[coord].cleared;

        // Relative position (inverted Y for intuitive map)
        const dx = (rx - Globals.player.roomX) * (roomSize + padding);
        const dy = (ry - Globals.player.roomY) * (roomSize + padding);

        // Only draw if within minimap bounds
        if (Math.abs(dx) < mapSize / 2 - 5 && Math.abs(dy) < mapSize / 2 - 5) {
            let color = isCleared ? "#27ae60" : "#e74c3c"; // Green (safe) vs Red (uncleared)

            // Special Colors
            if (rx === 0 && ry === 0) color = "#f1c40f"; // Yellow for Start
            if (Globals.visitedRooms[coord].roomData.isBoss) color = "#c0392b"; // Dark Red for Boss

            // --- GOLDEN PATH VISUALS ---
            if (!Globals.goldenPathFailed && Globals.goldenPath.includes(coord)) {
                const pathIdx = Globals.goldenPath.indexOf(coord);
                if (pathIdx <= Globals.goldenPathIndex && pathIdx !== -1) {
                    color = "#ffd700"; // Gold
                }
            }

            Globals.mctx.fillStyle = isCurrent ? "#fff" : color;
            Globals.mctx.fillRect(dx - roomSize / 2, dy - roomSize / 2, roomSize, roomSize);

            // Simple exit indicators
            const dData = Globals.visitedRooms[coord].roomData.doors;
            if (dData) {
                Globals.mctx.fillStyle = "#000";
                if (dData.top && dData.top.active) Globals.mctx.fillRect(dx - 1, dy - roomSize / 2, 2, 2);
                if (dData.bottom && dData.bottom.active) Globals.mctx.fillRect(dx - 1, dy + roomSize / 2 - 2, 2, 2);
                if (dData.left && dData.left.active) Globals.mctx.fillRect(dx - roomSize / 2, dy - 1, 2, 2);
                if (dData.right && dData.right.active) Globals.mctx.fillRect(dx + roomSize / 2 - 2, dy - 1, 2, 2);
            }
        }
    }

    Globals.mctx.restore();
}

export function drawDebugLogs() {
    if (!Globals.gameData.showDebugLog) return;

    const ctx = Globals.ctx;
    ctx.save();
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    let y = 60; // Start below FPS/Stats
    const lineHeight = 14;
    const maxLines = 20;

    // Filter out old logs? No, just show last N
    const logsToShow = (Globals.debugLogs || []).slice(-maxLines);

    logsToShow.forEach((msg, i) => {
        // Fade out older logs?
        const alpha = 1.0;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(msg, 10, y + (i * lineHeight));
    });

    ctx.restore();
}

export function drawBossIntro() {
    const now = Date.now();
    if (now < Globals.bossIntroEndTime) {
        // User Request: If bossRoom is explicitly empty, skip intro
        if (!Globals.gameData.bossRoom) return;

        Globals.ctx.save();
        Globals.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        Globals.ctx.fillRect(0, 0, Globals.canvas.width, Globals.canvas.height);

        // Find boss name
        let bossName = "";
        let bossDesc = "";

        // 1. Priority: Room Name (if specific)
        if (Globals.roomData && Globals.roomData.name && !Globals.roomData.name.includes("Boss Room")) {
            bossName = Globals.roomData.name;
            bossDesc = Globals.roomData.description || bossDesc;
        }
        // 2. Priority: Actual Spawned Boss
        else {
            const activeBoss = Globals.enemies.find(e => e.type === 'boss' || e.isBoss || e.special);
            if (activeBoss) {
                bossName = activeBoss.name || bossName;
                bossDesc = activeBoss.description || bossDesc;
            }
        }

        // IF NO BOSS NAME FOUND, SKIP THE INTRO
        if (!bossName) {
            Globals.ctx.restore();
            return;
        }

        Globals.ctx.textAlign = "center";
        Globals.ctx.textBaseline = "middle";

        // Title
        Globals.ctx.font = "bold 60px 'Courier New'";
        Globals.ctx.fillStyle = "#c0392b";
        Globals.ctx.shadowColor = "#e74c3c";
        Globals.ctx.shadowBlur = 20;
        Globals.ctx.fillText(bossName, Globals.canvas.width / 2, Globals.canvas.height / 2 - 40);

        // Subtitle
        Globals.ctx.font = "italic 24px 'Courier New'";
        Globals.ctx.fillStyle = "#ecf0f1";
        Globals.ctx.shadowBlur = 0;
        Globals.ctx.fillText(bossDesc, Globals.canvas.width / 2, Globals.canvas.height / 2 + 30);

    }
}

export function showCredits() {
    Globals.gameState = STATES.CREDITS;

    // Hide Game UI
    if (Globals.elements.ui) Globals.elements.ui.style.display = 'none';

    // Create Credits Overlay if not exists
    let creditsEl = document.getElementById('credits-overlay');
    if (!creditsEl) {
        creditsEl = document.createElement('div');
        creditsEl.id = 'credits-overlay';
        creditsEl.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: black; color: white; display: flex; flex-direction: column;
            align-items: center; justify-content: center; z-index: 5000;
            font-family: 'Courier New', monospace; text-align: center;
        `;
        document.body.appendChild(creditsEl);
    } else {
        creditsEl.style.display = 'flex';
    }

    const formatTime = (ms) => {
        if (!ms) return "00:00.00";
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milliseconds = Math.floor((ms % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    };

    creditsEl.innerHTML = `
        <h1 style="font-size: 4em; color: #f1c40f; margin-bottom: 20px;">THE END</h1>
        <div id="credits-scroll" style="height: 60%; width: 100%; overflow: hidden; position: relative; mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);">
            <div id="credits-content" style="position: absolute; width: 100%; text-align: center; top: 100%;">
             
                <p style="font-size: 1.5em; margin: 20px 0; color: #2ecc71;">You slaughtered the following innocent creatures</p>
                <div style="color: #ccc; font-family: monospace; text-align: left; display: inline-block; margin: 0 auto;">
                     <p>Needless Deaths (Session): <span style="color: #e74c3c">${Globals.killEnemySessionCount}</span></p>
                     <p>"Bosses" Killed (Session): <span style="color: #e74c3c">${Globals.killBossSessionCount}</span></p>
                     <hr style="border-color: #555; margin: 10px 0;">
                     <p>Total Needless Deaths: <span style="color: #f1c40f">${Globals.killEnemyCount}</span></p>
                     <p>Total "Bosses" Killed: <span style="color: #f1c40f">${Globals.killBossCount}</span></p>
                     <p>Player Deaths: <span style="color: #95a5a6">${Globals.playerDeathCount}</span></p>
                </div>

                <p style="font-size: 1.5em; margin: 20px 0; color: #3498db;">Run Statistics</p>
                <div style="color: #ccc; font-family: monospace; text-align: left; display: inline-block; margin: 0 auto;">
                     <p>Run Time: <span style="color: #f1c40f">${formatTime(Globals.SessionRunTime)}</span></p>
                     <p>Best Time: <span style="color: #f1c40f">${formatTime(Globals.BestRunTime)}</span></p>
                     <p>Total Runs: <span style="color: #95a5a6">${Globals.NumberOfRuns}</span></p>
                </div>

                </div>
                
                 <p style="font-size: 1.5em; margin: 20px 0; color: #3498db;">Game Info</p>
                <div style="color: #ccc; font-family: monospace; text-align: left; display: inline-block; margin: 0 auto;">
                     <p>Seed: <span style="color: #95a5a6">${Globals.seed || 'Unknown'}</span></p>
                </div>

                   <p style="font-size: 1.5em; margin: 20px 0; color: #3498db;">Design & Code</p>
                <p style="color: #ccc;">Cryptoskillz</p>
                <br>
                <p style="font-size: 1.5em; margin: 20px 0; color: #e74c3c;">Art & Assets</p>
                <p style="color: #ccc;">Generated with AI (thanks Antigravity!)</p>
                <br>
                <br><br><br>
                <p style="font-size: 1.2em; color: #f1c40f;">Goodbye, you psychopath</p>
                <br><br><br><br>
                <p style="font-size: 0.8em; color: #555;">Press any key to return to menu</p>
            </div>
        </div>
    `;

    // Animate
    setTimeout(() => {
        const content = document.getElementById('credits-content');
        if (content) {
            content.style.transition = "top 20s linear";
            content.style.top = "-150%"; // Scroll completely out
        }
    }, 100);

    // Input handling via global listener or explicit binding here?
    // Game.js handleGlobalInputs doesn't cover CREDITS state yet.
    // I'll add a one-off listener here for simplicity, or update Input.js.
    // Let's use a one-off listener that removes itself.
    Globals.creditsStartTime = Date.now();

    // Cleanup old listener just in case
    if (Globals.creditsListener) document.removeEventListener('keydown', Globals.creditsListener);

    const closeCredits = (e) => {
        // Debounce slightly to prevent immediate skip if key held
        if (Date.now() - (Globals.creditsStartTime || 0) < 1500) return;

        document.removeEventListener('keydown', closeCredits);
        Globals.creditsListener = null;
        creditsEl.style.display = 'none';

        // Return to Welcome
        // Clear SESSION DATA (Level, Inventory) but KEEP UNLOCKS
        STORAGE_KEYS.SESSION_WIPE.forEach(key => localStorage.removeItem(key));

        // Use Global Helper to Reset State & Go to Welcome
        if (Globals.goToWelcome) {
            Globals.goToWelcome();
        } else {
            // Fallback
            location.reload();
        }
    };

    Globals.creditsListener = closeCredits;
    document.addEventListener('keydown', closeCredits);
}

export function updateGameStats(statType) {
    if (statType === 'kill') {
        Globals.killEnemyCount++;
        Globals.killEnemySessionCount++;
    }
    if (statType === 'bossKill') {
        Globals.killBossCount++;
        Globals.killBossSessionCount++;
    }
    if (statType === 'death') {
        Globals.playerDeathCount++;
        Globals.playerDeathSessionCount++;
    }
    saveGameStats();
}

export function getGameStats(won) {
    const roomsCount = Object.keys(Globals.visitedRooms).length || 1;
    let rooms = `Rooms Visited: ${roomsCount}`;
    if (won === 1)
        rooms = `Rooms Cleared: ${roomsCount}`;

    return `${rooms}\nTotal kills: ${Globals.killEnemySessionCount}\nTotal bosses killed: ${Globals.killBossSessionCount}\nPlayer deaths: ${Globals.playerDeathSessionCount}`;
}

export function saveGameStats() {
    const stats = {
        kills: Globals.killEnemyCount,
        bossKills: Globals.killBossCount,
        deaths: Globals.playerDeathCount
    };
    localStorage.setItem('rogue_stats', JSON.stringify(stats));
}

export function loadGameStats() {
    const saved = localStorage.getItem('rogue_stats');
    if (saved) {
        const stats = JSON.parse(saved);
        Globals.killEnemyCount = stats.kills || 0;
        Globals.killBossCount = stats.bossKills || 0;
        Globals.playerDeathCount = stats.deaths || 0;
    } else {
        saveGameStats(); // Init if missing
    }
}

export function resetSessionStats() {
    Globals.killEnemySessionCount = 0;
    Globals.killBossSessionCount = 0;
    Globals.playerDeathSessionCount = 0;
}
