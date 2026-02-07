// --- CREDITS SCREEN (Melon Dezign Style) ---
// Depends on globals exposed by logic.js


let creditTextY = 600;
let creditQrImg = null;
let time = 0;
let scrollerX = 800;
let playedStartupSound = false; // Track if sound played
let logoFinishTime = -1; // Track when animation finishes for sequencing
let cracktroAudio = null; // Music track

// Add to global state at top of file
let playedMusic = false;
let playedExitSound = false;
window.isExiting = false;
window.exitStartTime = 0;
window.cracktroExitComplete = false;

window.triggerCracktroExit = function () {
    if (window.isExiting) return;
    window.isExiting = true;
    window.exitStartTime = time;

    // Fade Out Music
    if (cracktroAudio) {
        const fadeInterval = setInterval(() => {
            // Safety check if audio is still there
            if (!cracktroAudio) {
                clearInterval(fadeInterval);
                return;
            }
            if (cracktroAudio.volume > 0.02) {
                cracktroAudio.volume -= 0.02;
            } else {
                cracktroAudio.volume = 0;
                cracktroAudio.pause();
                cracktroAudio.currentTime = 0;
                clearInterval(fadeInterval);
            }
        }, 20); // Fast smooth fade (approx 600ms)
    }
};



// Melon style greetings - DEFAULT / FALLBACK
let scrollerText = "               GREETS TO:   CRYPTO SKILLZ   -   THE CODERS   -   THE HACKERS   -   THE GAMERS   -   ALL BITCOINERS   -   POWERED BY RAW CODE AND SINE WAVES   -   THANKS FOR PLAYING!               ";

// 3D Cube Vertices
const cubeVertices = [
    { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 }, { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }
];
// Faces (indices of vertices)
const cubeFaces = [
    [0, 1, 2, 3], // Front
    [1, 5, 6, 2], // Right
    [5, 4, 7, 6], // Back
    [4, 0, 3, 7], // Left
    [3, 2, 6, 7], // Top
    [4, 5, 1, 0]  // Bottom
];

// Explicitly attach to window
window.showCredits = function () {
    console.log("Credits: showCredits called (Melon Mode + Jelly Cube)");

    if (window.setGameState && window.gameStates) {
        window.setGameState(window.gameStates.CREDITS);
    }

    if (window.gameCanvas) {
        creditTextY = window.gameCanvas.height + 50;
        scrollerX = window.gameCanvas.width;
    }

    // Reset State
    playedStartupSound = false;
    playedMusic = false;
    playedExitSound = false;
    logoFinishTime = -1;
    time = 0;

    // Stop and Reset Music if exists
    if (cracktroAudio) {
        cracktroAudio.pause();
        cracktroAudio.currentTime = 0;
    }
    // Init Music
    cracktroAudio = new Audio('assets/music/cracktro.mp3');
    cracktroAudio.loop = true;
    cracktroAudio.volume = 0.6;
    window.cracktroAudio = cracktroAudio; // Expose for unlock

    // Fetch Scroller Text externally
    fetch('json/cracktro.json?t=' + Date.now())
        .then(response => response.json())
        .then(data => {
            if (data && data.scrollerText) {
                scrollerText = data.scrollerText;
            }
        })
        .catch(err => console.warn("Failed to load cracktro.json, using default scroller."));

    // Init Starfield (More stars, faster)


    // Load QR Code
    if (!creditQrImg) {
        creditQrImg = new Image();
        creditQrImg.onerror = () => { console.warn("Credits: QR Code image failed to load"); };
        creditQrImg.src = "assets/images/btc_qr.png";
    }

    // Hide UI
    if (window.uiEl) window.uiEl.style.display = 'none';
    if (window.statsEl) window.statsEl.style.display = 'none';
};

window.updateCredits = function () {
    time += 0.05;

    const k = window.gameKeys || {};
    if (k['Enter'] || k['Escape'] || k['Space']) {
        if (cracktroAudio) {
            cracktroAudio.pause();
            cracktroAudio.currentTime = 0;
        }
        if (window.goToWelcome) window.goToWelcome();
        return;
    }

    // DELAY CONSTANTS (Time units. @0.05 per frame, 1.0 = ~20 frames. Wait.
    // Actually time += 0.05 means 1.0 "time" = 20 frames = ~0.33s? 
    // Let's assume time runs approx 3 units per second if 60fps * 0.05 = 3.0/sec.
    // So 2 seconds = 6.0 units.
    const DELAY_CUBE = 6.0;
    const DELAY_SCROLL = 18.0;

    // Sequencing Logic
    // If logo finished (we check animY in draw), proceed.

    // Update Stars


    // Horizontal Scroller Speed (ONLY AFTER DELAY)
    if (logoFinishTime > 0 && time > logoFinishTime + DELAY_SCROLL) {
        scrollerX -= 6;
        const scrollWidth = scrollerText.length * 35; // Approx width
        if (window.gameCanvas && scrollerX < -scrollWidth) {
            scrollerX = window.gameCanvas.width;
        }
    }
};

window.drawCredits = function () {
    const ctx = window.gameCtx;
    const cvs = window.gameCanvas;

    if (!ctx || !cvs) return;

    const cx = cvs.width / 2;
    const cy = cvs.height / 2;

    // Time scaling estimate: 3 units / sec
    // 1. TEXT "HELLO FRIEND" Starts at +2s
    const DELAY_TEXT = 6.0;

    // 2. CUBE Starts at +4s (2s after Text)
    const DELAY_CUBE = 12.0;

    // 3. SCROLL Starts at +6s (2s after Cube)
    const DELAY_SCROLL = 18.0;

    // 4. BG Starts at +8s (2s after Scroll)
    const DELAY_BG = 24.0;

    // 1. Checkerboard Background (Start Static, Animate Later)
    const checkSize = 40;
    let px = 0;
    let py = 0;

    // Calculate BG movement if phase reached
    if (logoFinishTime > 0 && time > logoFinishTime + DELAY_BG) {
        // Calculate "local time" for the background to ensure smooth start from 0
        let bgTime = time - (logoFinishTime + DELAY_BG);

        // REVERSE IF EXITING
        // We want to "rewind" time relative to the exit start point
        if (window.isExiting) {
            const exitRel = time - window.exitStartTime;
            // Calculate what time was at the moment of exit
            const timeAtExit = window.exitStartTime - (logoFinishTime + DELAY_BG);
            // Move backwards from that point
            bgTime = timeAtExit - exitRel;
        }
        const scrollSpeed = 60;

        // Use Checksize * 2 creates the repeating pattern period (White/Grey Pair)
        const period = checkSize * 2;

        // Continuous shift values
        const rawX = (bgTime * scrollSpeed);
        const rawY = (Math.sin(bgTime * 0.5) * scrollSpeed);

        // Wrap shift to period [0, period)
        // Using custom modulus to handle negatives smoothly
        // ((x % n) + n) % n
        px = ((rawX % period) + period) % period;
        py = ((rawY % period) + period) % period;
    }

    ctx.save();
    // Translate the entire grid by the wrapped phase offset
    ctx.translate(px, py);

    // Fill screen with checks
    // We draw slightly larger area to accommodate the translation wrap
    // Pattern is static here, movement is handled by ctx.translate
    const startMapX = -checkSize * 2;
    const endMapX = cvs.width + checkSize * 2; // Extra buffer
    const startMapY = -checkSize * 2;
    const endMapY = cvs.height + checkSize * 2;

    for (let y = startMapY; y < endMapY; y += checkSize) {
        for (let x = startMapX; x < endMapX; x += checkSize) {
            // Determine color based on STATIC grid position
            const ix = Math.floor(x / checkSize);
            const iy = Math.floor(y / checkSize);
            const isWhite = (ix + iy) % 2 === 0;

            ctx.fillStyle = isWhite ? "#f0f0f0" : "#dcdcdc";
            ctx.fillRect(x, y, checkSize + 1, checkSize + 1);
        }
    }
    ctx.restore();

    // NEW: White Header Bar (Overwrites top of checkerboard) - MOVED to after vignette
    // to prevent it being darkened.

    // 2. Draw Stars


    // IMPLEMENT EXIT SEQUENCE
    // We do NOT hide immediately. We animate out.
    const exitTime = window.isExiting ? (time - window.exitStartTime) : 0;

    // Exit Phases (Time units)
    const EXIT_T_SCROLL = 0;
    const EXIT_T_TEXT = 1.0;
    const EXIT_T_CUBE = 2.0;
    const EXIT_T_BAR_EXIT = 2.5; // NEW: Bar scrolls out
    const EXIT_T_LOGO = 3.5;     // Delayed Logo exit (after bar starts/finishes)

    // 3. JELLY 3D CUBE (CONDITIONAL: 4s After Logo / 2s After Text)
    // HIDE IF EXITING (Old) -> ANIMATE OUT (New)
    // Only draw if NOT exiting OR if exiting but not yet fully gone
    let cubeScale = 120;
    let cubeAlpha = 1.0;
    let drawCube = false;

    if (logoFinishTime > 0 && time > logoFinishTime + DELAY_CUBE) {
        drawCube = true;
        // ENTER ANIMATION
        const enterT = time - (logoFinishTime + DELAY_CUBE);
        const progress = Math.min(1.0, enterT / 2.0);
        const ease = 1 - Math.pow(1 - progress, 3);
        cubeScale = 120 * ease;
    }

    if (window.isExiting) {
        if (exitTime > EXIT_T_CUBE) {
            const t = exitTime - EXIT_T_CUBE;
            // Shrink fast
            cubeScale = Math.max(0, 120 - (t * 100));
            if (cubeScale <= 0) drawCube = false;
        }
    }

    if (drawCube) {
        // Rotate cube (Slower)
        const rotX = time * 0.2;
        const rotY = time * 0.3;
        const scale = cubeScale; // Use dynamic scale

        // Project vertices
        const projected = cubeVertices.map(v => {
            // Rotate
            let x = v.x, y = v.y, z = v.z;

            // Jelly Distortion (Sine wave on Y affects X/Z)
            const jelly = Math.sin(time * 4 + y * 2) * 0.2;
            x += jelly;
            z += jelly;

            // Rotation X
            let y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
            let z2 = y * Math.sin(rotX) + z * Math.cos(rotX);
            y = y2; z = z2;

            // Rotation Y
            let x2 = x * Math.cos(rotY) - z * Math.sin(rotY);
            z2 = x * Math.sin(rotY) + z * Math.cos(rotY);
            x = x2; z = z2;

            // Perspective Project
            const fov = 400;
            const pz = z * scale + 500; // Push back
            const px = (x * scale * fov) / pz + cx;
            const py = (y * scale * fov) / pz + cy;

            return { x: px, y: py, z: pz };
        });

        // Draw Faces
        // Sort faces by Z (Painter's algorithm - simpler than full z-buffer)
        // Calc avg Z for each face
        const sortedFaces = cubeFaces.map((indices, i) => {
            const avgZ = indices.reduce((sum, idx) => sum + projected[idx].z, 0) / 4;
            return { indices, avgZ, id: i };
        }).sort((a, b) => b.avgZ - a.avgZ);

        ctx.lineWidth = 3;
        ctx.lineJoin = "round";

        sortedFaces.forEach(face => {
            ctx.beginPath();
            const pts = face.indices.map(i => projected[i]);
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
            ctx.lineTo(pts[2].x, pts[2].y);
            ctx.lineTo(pts[3].x, pts[3].y);
            ctx.closePath();

            // Face style
            // Solid Green (Melon style)
            // Light variance for shading based on Index (fake lighting)
            const light = 50 + (face.id % 3) * 20;
            ctx.fillStyle = `rgb(50, ${180 + light}, 50)`; // Solid Opaque Green variations

            ctx.fill();
            ctx.strokeStyle = "rgba(200, 255, 200, 0.9)";
            ctx.stroke();
        });

        // QR Code (Orbiting) - Group with Cube
        if (creditQrImg && creditQrImg.complete && creditQrImg.naturalWidth > 0 && cubeScale > 5) {
            const size = 100 * (cubeScale / 120); // Scale QR with cube
            const qTime = time * 1.0;
            // Orbit around Cube
            const qRadius = 180 * (cubeScale / 120);
            const qx = cx + Math.cos(qTime) * qRadius;
            const qy = cy + Math.sin(qTime * 1.3) * 60 * (cubeScale / 120);

            ctx.save();
            ctx.translate(qx, qy);
            ctx.rotate(-time);

            try {
                ctx.fillStyle = "white";
                ctx.beginPath();
                ctx.arc(0, 0, size / 2 + 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.drawImage(creditQrImg, -size / 2, -size / 2, size, size);
            } catch (e) { }

            ctx.restore();
        }
    }

    // 3.5. TEXT "HELLO FRIEND" Phase (CONDITIONAL: 2s After Logo)
    let drawText = false;
    let textScale = 0;
    let textAlpha = 0;

    if (logoFinishTime > 0 && time > logoFinishTime + DELAY_TEXT) {
        drawText = true;
        // ENTER ANIMATION
        const enterT = time - (logoFinishTime + DELAY_TEXT);
        const progress = Math.min(1.0, enterT / 1.0);
        const ease = 1 - Math.pow(1 - progress, 3);

        textScale = ease;
        textAlpha = Math.min(1.0, progress * 2);
    }

    // EXIT ANIM FOR TEXT (Fade/Zoom Out)

    if (window.isExiting && drawText) {
        if (exitTime > EXIT_T_TEXT) {
            const t = exitTime - EXIT_T_TEXT;
            // Zoom out and fade
            textScale = Math.max(0, 1.0 - (t * 0.5));
            textAlpha = Math.max(0, 1.0 - (t * 1.0));
            if (textAlpha <= 0) drawText = false;
        }
    }

    if (drawText) {
        // TRIGGER MUSIC HERE
        if (!playedMusic) {
            playedMusic = true;
            if (cracktroAudio) {
                cracktroAudio.volume = 0; // Start Silent
                cracktroAudio.play().then(() => {
                    // Fade In
                    const fadeIn = setInterval(() => {
                        if (!cracktroAudio || window.isExiting) {
                            clearInterval(fadeIn);
                            return;
                        }
                        if (cracktroAudio.volume < 0.6) {
                            cracktroAudio.volume = Math.min(0.6, cracktroAudio.volume + 0.01);
                        } else {
                            clearInterval(fadeIn);
                        }
                    }, 50); // Slow fade (~3s)
                }).catch(e => console.warn("Audio play blocked", e));
            }
        }
        // Animation Vars (Shared with Cube concept but computed here)
        const squash = (1 + Math.sin(time * 6) * 0.15) * textScale;
        const stretch = (1 - Math.sin(time * 6) * 0.15) * textScale;
        const rotation = Math.sin(time * 2) * 0.05;

        // NEW TEXT: "HELLO FRIEND :]"
        const mainLogoText = "HELLO FRIEND :]";

        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.translate(cx, cy - 40);
        ctx.translate(0, -150);

        ctx.rotate(rotation);
        ctx.scale(squash, stretch);

        ctx.textAlign = "center";

        // Slightly smaller font if text is longer? "HELLO FRIEND :]" is longer than "CONGRATULATIONS"? 
        // "CONGRATULATIONS" = 15 chars. "HELLO FRIEND :]" = 15 chars. Exact match. 
        ctx.font = "900 60px 'Orbitron', sans-serif";

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fillText(mainLogoText, 8, 8);

        // Text Gradient
        const tGrad = ctx.createLinearGradient(0, -35, 0, 35);
        tGrad.addColorStop(0, "#ccffcc");
        tGrad.addColorStop(0.5, "#ffffff");
        tGrad.addColorStop(1, "#00ff00");

        ctx.fillStyle = tGrad;
        ctx.fillText(mainLogoText, 0, 0);

        // Stroke
        ctx.lineWidth = 3;
        ctx.strokeStyle = "white";
        ctx.strokeText(mainLogoText, 0, 0);

        ctx.restore();
    }

    // 6. Bouncy Scroller (Bottom) - CONDITIONAL (6s After Logo / 2s After Cube)
    let drawScroll = false;
    if (logoFinishTime > 0 && time > logoFinishTime + DELAY_SCROLL) {
        drawScroll = true;
        // Unlock Input (User can now exit)
        if (!window.cracktroLogoComplete) {
            window.cracktroLogoComplete = true;
        }
    }

    // EXIT ANIM FOR SCROLLER (Drop Down)
    let scrollYOffset = 0;

    if (window.isExiting && drawScroll) {
        if (exitTime > EXIT_T_SCROLL) {
            const t = exitTime - EXIT_T_SCROLL;
            // Drop down fast
            scrollYOffset = t * 200;
            if (scrollYOffset > 300) drawScroll = false;
        }
    }

    if (drawScroll) {
        // Make sure we have text
        const txt = scrollerText || "";

        const bounceAmp = 30;
        const bounceFreq = 0.3;
        const baseY = cvs.height - 50 + scrollYOffset; // Apply drop
        const fixedSpacing = 10; // Extra padding between letters

        ctx.font = "900 40px 'Orbitron', sans-serif";

        let currentX = scrollerX;

        for (let i = 0; i < txt.length; i++) {
            const char = txt[i];
            const charWidth = ctx.measureText(char).width; // Proportional width

            // Draw if on screen (with buffer)
            if (currentX > -100 && currentX < cvs.width + 100) {
                const ty = baseY + Math.sin((time * 5) + (i * bounceFreq)) * bounceAmp;
                const hue = (time * 150 + i * 20) % 360;

                ctx.fillStyle = "rgba(0,0,0,0.3)";
                ctx.fillText(char, currentX + 4, ty + 4);

                ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
                ctx.fillText(char, currentX, ty);
            }

            // Advance cursor by real character width + spacing
            currentX += charWidth + fixedSpacing;
        }

        // Move the entire scroller left based on speed (Slower: 1.5)
        scrollerX -= 1.5;

        // Restore distinctWidth for loop check
        const distinctWidth = ctx.measureText(txt).width + (txt.length * fixedSpacing);

        if (scrollerX < -distinctWidth) {
            scrollerX = cvs.width;
            // Mark loop as complete to enable exit
            window.cracktroLoopComplete = true;
            // Also notify user visually? maybe later.
        }
    }

    // 7. Vignette
    const grad = ctx.createRadialGradient(cx, cy, cvs.width * 0.4, cx, cy, cvs.width * 0.8);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    // 8. Top Right Logo (Refined Melon Style)
    // 8. Top Right Logo (Refined Melon Style)
    // SEQUENCE:
    // 0. Checkers Only [t=0 to 1.0]
    // 1. White Bar Scrolls In (Left to Right) [t=1.0 to 2.5]
    // 2. Logo Drops Down [t=2.5+]

    const DELAY_BAR_START = 1.0;
    const TIME_BAR_SCROLL = 1.5;

    let barX = -cvs.width; // Start off-screen LEFT
    let animY = -150;     // Start off-screen top

    // A. Bar Scroll
    if (time >= DELAY_BAR_START && time <= (DELAY_BAR_START + TIME_BAR_SCROLL)) {
        // Ease out cubic
        const p = Math.min(1.0, (time - DELAY_BAR_START) / TIME_BAR_SCROLL);
        const ease = 1 - Math.pow(1 - p, 3);
        barX = -cvs.width + (cvs.width * ease);
    } else if (time > (DELAY_BAR_START + TIME_BAR_SCROLL)) {
        barX = 0; // Finished
    }

    // B. Logo Drop (Starts after bar)
    const LOGO_START = DELAY_BAR_START + TIME_BAR_SCROLL;
    if (time > LOGO_START) {
        const logoTime = time - LOGO_START;
        // Drop fast
        animY = Math.min(0, -100 + (logoTime * 80));
    }

    // MODIFY ANIM Y IF EXITING (Slide UP) - DELAYED
    if (window.isExiting) {
        // A. Bar Exit (Scrolls back to Left)
        if (exitTime > EXIT_T_BAR_EXIT) {
            const t = exitTime - EXIT_T_BAR_EXIT;
            // Scroll OUT (Right to Left / Back to -width)
            // 0 -> -width
            barX = -(t * 1200); // Fast exit
            if (barX < -cvs.width) barX = -cvs.width;
        }

        // B. Logo Exit (Slide UP) - Only after bar is mostly gone
        if (exitTime > EXIT_T_LOGO) {
            // TRIGGER EXIT SOUND (Reverse Ding)
            if (!playedExitSound) {
                playedExitSound = true;
                const ac = window.gameAudio;
                if (ac && ac.state !== 'suspended') {
                    const osc = ac.createOscillator();
                    const gain = ac.createGain();
                    osc.type = 'square';
                    // Slide Down from C7 to C6
                    osc.frequency.setValueAtTime(2093, ac.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(1046.5, ac.currentTime + 0.2);

                    gain.gain.setValueAtTime(0.1, ac.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.3);

                    osc.connect(gain);
                    gain.connect(ac.destination);
                    osc.start();
                    osc.stop(ac.currentTime + 0.3);
                }
            }

            const t = exitTime - EXIT_T_LOGO;
            // Slide UP fast
            animY = 0 - (t * 60);

            // CHECK IF GONE -> TRIGGER EXIT COMPLETE
            if (animY < -150) {
                window.cracktroExitComplete = true;
            }
        }
    }

    // TRIGGER SOUND ON FINISH & RECORD TIME
    if (animY >= 0 && !window.isExiting) {
        // Record finish time for sequencing
        // Record finish time for sequencing
        if (logoFinishTime < 0) {
            logoFinishTime = time;
            // Logo Finished (Wait for scroller to unlock)
        }

        if (!playedStartupSound) {
            playedStartupSound = true;

            // Play Music (Cracktro.mp3) - MOVED TO TEXT PHASE

            // PLay "Gameboy Ding"
            const ac = window.gameAudio;
            if (ac && ac.state !== 'suspended') {
                // Tone 1: High Ping (Sampled 'Bing')
                const osc = ac.createOscillator();
                const gain = ac.createGain();

                // Harmonic Square (Gameboy-ish)
                osc.type = 'square';

                // Gameboy startup is roughly: 
                // A quick harmonic ping. Let's try a distinct high chord.
                // B6 (1975Hz) -> fade
                osc.frequency.setValueAtTime(1046.5, ac.currentTime); // C6
                osc.frequency.exponentialRampToValueAtTime(2093, ac.currentTime + 0.1); // Slide up to C7 (Ding!)

                gain.gain.setValueAtTime(0.1, ac.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.6);

                osc.connect(gain);
                gain.connect(ac.destination);

                osc.start();
                osc.stop(ac.currentTime + 0.6);

                // Second harmony for "chime" effect
                const osc2 = ac.createOscillator();
                const gain2 = ac.createGain();
                osc2.type = 'square';
                osc2.frequency.setValueAtTime(2637, ac.currentTime + 0.05); // E7
                gain2.gain.setValueAtTime(0.05, ac.currentTime + 0.05);
                gain2.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.4);

                osc2.connect(gain2);
                gain2.connect(ac.destination);

                osc2.start(ac.currentTime + 0.05);
                osc2.stop(ac.currentTime + 0.4);
            }
        }
    }

    // DRAW WHITE HEADER BAR HERE (Post-Vignette)
    // Ensures, it matches the logo white exactly.
    // Animates X scroll. Fixed Y=0.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(barX, 0, cvs.width, 40);

    // - Black Box (Tight to Text)
    // - White Border (Large/Stroke)
    // - Dot (In White Border, Black Text, Bottom Aligned, Large)

    ctx.save();
    const logoScale = 0.3; // 50% smaller (was 0.6)

    ctx.font = "900 60px 'Orbitron', sans-serif";
    ctx.textBaseline = "middle";

    // Widths
    const textCrypt = "CRYPT";
    const textSkillz = "SKILLZ";

    const wCrypt = ctx.measureText("CRYPT").width;
    const wO = ctx.measureText("O").width;
    const wSkillz = ctx.measureText("SKILLZ").width;
    // UPDATED DOT WIDTH ESTIMATE (120px Impact)
    // Was 40, user says right border is way too big. Reducing to 18 to tighten it up.
    // For Orbitron, maybe keep 18 for now, see if it needs tuning.
    const wDot = 18;

    // TIGHT PADDING (Smaller black borders)
    const pad = 12; // Adjusted tight
    const h = 74;   // Slight tighter height

    // Layout Widths
    const halfO = wO / 2;
    const whiteBoxYInset = 8;
    const innerWhiteStartX = pad + wCrypt + halfO;
    const innerWhiteW = halfO + wSkillz + 2;
    const innerWhiteEndX = innerWhiteStartX + innerWhiteW;

    // 2. Black Box Ends matches White Box Y Inset
    const blackBoxW = innerWhiteEndX + whiteBoxYInset;

    // Thick White Border Params
    const borderW = 20;

    // Dot Placement
    const dotMargin = 10;

    // White Rect Dimension
    // Left Padding: borderW
    // Right Padding: borderW (AFTER DOT)
    const whiteRectW = borderW + blackBoxW + dotMargin + wDot + borderW;
    const whiteRectH = h + (borderW * 2);

    // Total Visual Width
    // Note: Previously visual width assumed left borderW was implied in translate logic if 0 based.
    // Actually we drew White Rect at 0,0.
    // Black Box at borderW, borderW.
    // So White Rect needs to be full width.

    const totalVisW = whiteRectW;

    // Position Top LEFT (Snug - No Padding)
    ctx.translate(0, animY);
    ctx.scale(logoScale, logoScale);

    // 1. Draw Thick White Background (The "Border")
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, whiteRectW, whiteRectH);

    // 2. Draw Black Box (Inset by borderW)
    ctx.fillStyle = "#222222";
    ctx.fillRect(borderW, borderW, blackBoxW, h);

    // 3. Draw Inner White Box (inside Black Box)
    const innerWhiteH = h - (whiteBoxYInset * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(borderW + innerWhiteStartX, borderW + whiteBoxYInset, innerWhiteW, innerWhiteH);

    // Text Drawing Y
    const yText = borderW + h / 2 + 4;

    // A. "CRYPT" - White
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText("CRYPT", borderW + pad, yText);

    // B. "O" - Split
    const oX = borderW + pad + wCrypt;

    // Left O
    ctx.save();
    ctx.beginPath();
    ctx.rect(borderW, borderW, innerWhiteStartX, h);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillText("O", oX, yText);
    ctx.restore();

    // Right O (Black)
    ctx.save();
    ctx.beginPath();
    ctx.rect(borderW + innerWhiteStartX, borderW + whiteBoxYInset, innerWhiteW, innerWhiteH);
    ctx.clip();
    ctx.fillStyle = "#222222";
    ctx.fillText("O", oX, yText);
    ctx.restore();

    // C. "SKILLZ" - Black
    const sX = oX + wO;
    ctx.fillStyle = "#222222";
    ctx.fillText("SKILLZ", sX, yText);

    // D. "." - BIG DOT
    // Position: dotRelX (relative to left black box edge)
    // Offset by borderW
    const dX = borderW + blackBoxW + dotMargin;

    ctx.save();
    ctx.fillStyle = "#000000";
    ctx.font = "900 120px 'Orbitron', sans-serif"; // Double Size

    // Manual Adjustment for Bottom Alignment
    const manualOffset = 21;

    ctx.textBaseline = "bottom";
    ctx.fillText(".", dX, borderW + h + manualOffset);
    ctx.restore();

    ctx.restore();
};
