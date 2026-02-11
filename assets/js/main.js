import { Globals } from './modules/Globals.js'; // Path relative to index.html? No, relative to main.js?
// If main.js is in assets/js/, then ./modules/Globals.js is correct.
import { setupInput } from './modules/Input.js';
import { initGame, restartGame, newRun, goToWelcome, goContinue, confirmNewGame, cancelNewGame } from './modules/Game.js';

window.addEventListener('load', () => {
    console.log("Main.js loaded - Initializing Game...");
    Globals.initDOM();

    // Setup Input Callbacks
    setupInput({
        restartGame: () => restartGame(),
        newRun: () => newRun(),
        goToWelcome: () => goToWelcome(),
        goContinue: () => goContinue(),
        confirmNewGame: () => confirmNewGame(),
        cancelNewGame: () => cancelNewGame()
    });

    // Start Game Initialization
    initGame();
});

// Expose functions to window for HTML onclick handlers
window.restartGame = restartGame;
window.newRun = newRun;
window.goToWelcome = goToWelcome;
window.goContinue = goContinue;
window.initGame = initGame;
window.confirmNewGame = confirmNewGame;
window.cancelNewGame = cancelNewGame;
