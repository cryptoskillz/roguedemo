import { Globals } from './modules/Globals.js'; // Path relative to index.html? No, relative to main.js?
// If main.js is in assets/js/, then ./modules/Globals.js is correct.
import { setupInput } from './modules/Input.js';
import { initGame, restartGame, goToWelcome, goContinue, confirmNewGame, cancelNewGame } from './modules/Game.js';

window.addEventListener('load', () => {
    console.log("Main.js loaded - Initializing Game...");
    Globals.initDOM();

    // Setup Input Callbacks
    setupInput({
        restartGame: () => restartGame(),
        goToWelcome: () => goToWelcome(),
        goContinue: () => goContinue()
    });

    // Start Game Initialization
    initGame();
});

// Expose functions to window for HTML onclick handlers
window.restartGame = restartGame;
window.goToWelcome = goToWelcome;
window.goContinue = goContinue;
window.initGame = initGame;
window.confirmNewGame = confirmNewGame;
window.cancelNewGame = cancelNewGame;
