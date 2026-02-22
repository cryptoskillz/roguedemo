import { Globals } from './modules/Globals.js'; // Path relative to index.html? No, relative to main.js?
// If main.js is in assets/js/, then ./modules/Globals.js is correct.
import { setupInput } from './modules/Input.js';
import { initGame, restartGame, newRun, goToWelcome, goContinue, confirmNewGame, cancelNewGame, gameMenu, bankDeposit, bankWithdraw, bankClose } from './modules/Game.js';
import { SFX } from './modules/Audio.js';

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
        cancelNewGame: () => cancelNewGame(),
        goPause: () => gameMenu()
    });

    // Ensure window forms keyboard focus
    window.focus();
    const cvs = document.getElementById('gameCanvas');
    if (cvs) cvs.focus();

    // Start Game Initialization
    initGame();
});

import { confirmPortalTransition, cancelPortalTransition, showPortalWarningModal } from './modules/UI.js';

// Expose functions to window for HTML onclick handlers
window.restartGame = restartGame;
window.newRun = newRun;
window.goToWelcome = goToWelcome;
window.goContinue = goContinue;
window.initGame = initGame;
window.confirmNewGame = confirmNewGame;
window.cancelNewGame = cancelNewGame;
window.bankDeposit = bankDeposit;
window.bankWithdraw = bankWithdraw;
window.bankClose = bankClose;
window.confirmPortalTransition = confirmPortalTransition;
window.cancelPortalTransition = cancelPortalTransition;
window.showPortalWarningModal = showPortalWarningModal;
window.SFX = SFX;
