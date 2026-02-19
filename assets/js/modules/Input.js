import { Globals } from './Globals.js';
import { STATES, DEBUG_FLAGS } from './Constants.js';
import { updateWelcomeScreen } from './UI.js';
import { updateDebugEditor, renderDebugForm } from './Debug.js';
import { Globals as G } from './Globals.js'; // Short alias if needed
import { log } from './Utils.js';

export function setupInput(callbacks) {
    // Callbacks: { restartGame, goToWelcome, goContinue }

    window.addEventListener('keydown', e => {
        // IGNORE INPUT FIELDS (Prevent typing from moving player)
        // EXCEPTION: Allow Enter key to trigger start even from input
        if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.code !== 'Enter') return;

        // Update Key State
        Globals.keys[e.code] = true;

        // Debug Toggle
        if (e.code === 'Backquote') {
            const panel = Globals.elements.debugPanel;
            const logEl = Globals.elements.debugLog;

            const isVisible = panel && panel.style.display === 'flex';
            if (panel) panel.style.display = isVisible ? 'none' : 'flex';
            if (logEl) logEl.style.display = isVisible ? 'none' : 'block';

            // Trigger a render so it refreshes data
            if (!isVisible) {
                renderDebugForm();
            }
        }

        // Game Over / Win States
        if (Globals.gameState === STATES.GAMEOVER) {
            if (e.code === 'Enter') callbacks.goToWelcome();
            if (e.code === 'KeyR') callbacks.restartGame();

            // "Revive" hack (C / M)
            if (e.code === 'KeyM' || e.code === 'KeyC') {
                callbacks.goContinue();
            }
        }
        else if (Globals.gameState === STATES.WIN) {
            if (e.code === 'Enter') callbacks.goToWelcome();
            if (e.code === 'KeyC' || e.code === 'KeyM') callbacks.goContinue();
            if (e.code === 'KeyR') callbacks.restartGame();
        }
        else if (Globals.gameState === STATES.GAMEMENU) {
            if (e.code === 'KeyP' || e.code === 'KeyC' || e.code === 'Enter') {
                callbacks.goContinue();
            }
            if (e.code === 'KeyR') callbacks.restartGame();
            if (e.code === 'KeyM') callbacks.goToWelcome();
        }
        else if (Globals.gameState === STATES.PLAY) {
            // Pause Game
            if (e.code === 'KeyP' || e.code === 'Escape') {
                // Prevent pause if Ghost is hunting
                if (Globals.ghostSpawned) return;

                if (callbacks.goPause) callbacks.goPause();
            }
        }
        else if (Globals.gameState === STATES.START) {
            // Allow Arrow Keys for char select (handled in handleGlobalInputs, but prevent start on them?)
            // Also prevent Music/SFX toggles (0/9) from starting game
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Digit0' || e.code === 'Digit9') return;

            // Any other key starts game
            // Any other key starts game
            // Trigger Delete Save Modal on N (as requested)
            if (e.code === 'KeyN') {
                const modal = document.getElementById('newGameModal');
                if (modal) {
                    modal.style.display = 'flex';
                    Globals.isNewGameModalOpen = true;
                }
                return;
            }

            // Trigger New Run directly on T
            if (e.code === 'KeyT' || e.code === 'KeyP') {
                // Let handleGlobalInputs handle it, or call here
                return; // Allow propagation to handleGlobalInputs?
            }

            // Handle Modal Inputs
            if (Globals.isNewGameModalOpen) {
                if (e.code === 'KeyD') {
                    // CONFIRM DELETE
                    if (callbacks.confirmNewGame) callbacks.confirmNewGame();
                }
                if (e.code === 'Escape' || e.code === 'Enter') {
                    // CANCEL
                    if (callbacks.cancelNewGame) callbacks.cancelNewGame();
                }
                return; // Block other inputs while modal is open
            }

            if (Globals.beginPlay) Globals.beginPlay();
        }
    });

    window.addEventListener('keyup', e => {
        // ALWAYS CLEAR (Prevent sticking even if focus changed)
        Globals.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
        Globals.keys = {};
    });
}

// Polling Handler (called in Game Loop)
export function handleGlobalInputs(callbacks) {
    const isDebug = Globals.gameData && (
        Globals.gameData.showDebugWindow !== undefined
            ? Globals.gameData.showDebugWindow
            : (Globals.gameData.debug && Globals.gameData.debug.windowEnabled === true)
    );

    // Restart (R)
    if (Globals.keys['KeyR']) {
        // BUT if Ghost is SPAWNED (Hunting) in PLAY state, do NOT handle here (let Game.js handle trap)
        if (Globals.ghostSpawned) return;

        // Allow Restart in PLAY, GAMEOVER, WIN, MENU, GHOSTKILLED
        if (Globals.gameState === STATES.PLAY || Globals.gameState === STATES.GAMEOVER || Globals.gameState === STATES.WIN || Globals.gameState === STATES.GAMEMENU || Globals.ghostKilled) {

            // PRODUCTION MODE: R -> Start Level
            if (!isDebug) {
                const startLevel = Globals.gameData && Globals.gameData.startLevel;
                // keepItems = false, targetLevel = startLevel
                callbacks.restartGame(false, startLevel || null);
            } else {
                // DEBUG MODE: R -> Restart Current Level (Default)
                callbacks.restartGame();
            }
            return true;
        }
    }

    // New Run (Y) - Restart on Level 4 (Debug Only?)
    // User requested "T & Y do nothing if debug not active"
    if (isDebug && Globals.keys['KeyY']) {
        log("New Run key pressed (Y). Target: Level 4.");
        if (Globals.ghostSpawned) return;
        Globals.gameState = STATES.START;
        if (callbacks.newRun) {
            log("Calling newRun('levels/4.json')...");
            callbacks.newRun('levels/4.json').catch(err => console.error("newRun failed:", err));
            return true;
        }
    }

    // New Run (T) - Restart Current Level, New Seed (Debug Only?)
    // User requested "T & Y do nothing if debug not active"
    if (isDebug && Globals.keys['KeyT']) {
        log("New Run key pressed (T). Target: Current Level.");
        if (Globals.ghostSpawned) return;
        if (Globals.gameState === STATES.PLAY || Globals.gameState === STATES.GAMEOVER || Globals.gameState === STATES.WIN || Globals.gameState === STATES.GAMEMENU || Globals.gameState === STATES.START || Globals.ghostKilled) {
            if (callbacks.newRun) {
                log("Calling newRun...");
                callbacks.newRun().catch(err => console.error("newRun failed:", err));
                return true;
            }
        }
    }
    // Main Menu
    if (Globals.keys['KeyM']) {
        if (Globals.gameState === STATES.GAMEOVER || Globals.gameState === STATES.WIN || Globals.gameState === STATES.GAMEMENU) {
            callbacks.goToWelcome();
            return true;
        }
    }

    // Player Selection (Only in Menu)
    const now = Date.now();
    if (Globals.gameState === STATES.START || Globals.gameState === STATES.GAMEMENU) {
        if (Globals.keys['ArrowRight']) {
            if (now - Globals.lastInputTime > 200) {
                Globals.selectedPlayerIndex = (Globals.selectedPlayerIndex + 1) % Globals.availablePlayers.length;
                updateWelcomeScreen();
                Globals.lastInputTime = now;
            }
        }
        if (Globals.keys['ArrowLeft']) {
            if (now - Globals.lastInputTime > 200) {
                Globals.selectedPlayerIndex = (Globals.selectedPlayerIndex - 1 + Globals.availablePlayers.length) % Globals.availablePlayers.length;
                updateWelcomeScreen();
                Globals.lastInputTime = now;
            }
        }
    }

    return false;
}
