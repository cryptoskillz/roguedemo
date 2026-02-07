import { Globals } from './Globals.js';
import { STATES, DEBUG_FLAGS } from './Constants.js';
import { updateWelcomeScreen } from './UI.js';
import { updateDebugEditor, renderDebugForm } from './Debug.js';
import { Globals as G } from './Globals.js'; // Short alias if needed

export function setupInput(callbacks) {
    // Callbacks: { restartGame, goToWelcome, goContinue }

    window.addEventListener('keydown', e => {
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
        else if (Globals.gameState === STATES.START) {
            // Allow Arrow Keys for char select (handled in handleGlobalInputs, but prevent start on them?)
            // Also prevent Music/SFX toggles (0/9) from starting game
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Digit0' || e.code === 'Digit9') return;

            // Any other key starts game
            // Any other key starts game
            if (e.code === 'KeyN') {
                // FORCE NEW GAME (Clear Data)
                localStorage.removeItem('rogue_player_state');
                localStorage.removeItem('rogue_transition');
                localStorage.removeItem('current_gun');
                localStorage.removeItem('current_bomb');
                localStorage.removeItem('current_gun_config');
                localStorage.removeItem('current_bomb_config');
                localStorage.removeItem('base_gun'); // Optional: Clear base too if we want total reset
                location.reload();
                return;
            }

            if (Globals.beginPlay) Globals.beginPlay();
        }
    });

    window.addEventListener('keyup', e => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        Globals.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
        Globals.keys = {};
    });
}

// Polling Handler (called in Game Loop)
export function handleGlobalInputs(callbacks) {
    // Restart
    if (Globals.keys['KeyR']) {
        if (Globals.gameState === STATES.GAMEOVER || Globals.gameState === STATES.WIN || Globals.gameState === STATES.GAMEMENU) {
            callbacks.restartGame();
            return true;
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
