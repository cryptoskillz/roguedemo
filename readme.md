# JS Dungeon Crawler - Geometry Dash (Rogue Demo)

A web-based roguelike dungeon crawler built with JavaScript. Explore procedurally generated rooms, defeat enemies, collect items, and battle bosses!

## How to Play

### Controls

| Action | Key |
| :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` |
| **Shoot** | `←`, `↑`, `↓`, `→` (Arrow Keys) |
| **Interact / Item** | `Spacebar` (Pick up items, enter doors) |
| **Place Bomb** | `B` |
| **Pause Game** | `P` |
| **Toggle Music** | `0` (Zero) |
| **Toggle SFX** | `9` |
| **Restart (Soft)** | `R` (Game Over / Win screen) |
| **Main Menu** | `M` (Game Over / Win screen) |
| **New Game (Hard Reset)** | `N` (Main Menu) |

### Game Mechanics

- **Objective**: Clear rooms, find the Boss Room, and defeat the Guardian to unlock the next level.
- **Health**: You start with 3 HP. Taking damage from enemies or bombs reduces HP.
- **Bombs**:
    - Use bombs (`B`) to damage enemies or open locked doors.
    - **Yellow Locked Doors**: Require a Key or a Bomb to open.
    - **Red Forced Doors**: Lock when enemies are present. Use a Bomb to force them open if you need a quick escape!
- **Ammo System**:
    - Weapons have different ammo types:
        - **Reload**: Mag + Reserve. Reloads automatically when empty.
        - **Recharge**: Infinite ammo that recharges over time after depletion.
        - **Finite**: Ammo depletes until empty. "OUT OF AMMO".
- **Items**:
    - **Keys**: Open locked doors.
    - **Bombs**: Replenish your bomb supply.
    - **Health Potions**: Restore HP.
    - **Shards**:
        - **Green Shards**: Session currency (reset on death).
        - **Red Shards**: Permanent currency (kept across runs).
- **Unlocks**:
    - Completing levels and achievements unlocks new items (Guns, Bombs) and features.
    - Unlocks are permanent unless you perform a **Hard Reset**.

### Save System

- **Session Save**: The game auto-saves your current run (Health, Inventory, Level).
- **Unlocks**: Unlocks are saved permanently.
- **New Game (`N` + `D`)**: Performs a **FACTORY RESET**. This deletes ALL progress, including Unlocks and Red Shards.
- **Completing a Run**: When you beat the game, your Session is wiped (so you can start fresh), but your Unlocks and Red Shards are PRESERVED.

## Installation / Running

1. **Prerequisites**: You need a local web server to run the game (due to JSON file loading).
2. **Run with Python** (e.g., Mac/Linux):
   ```bash
   python3 -m http.server
   ```
3. **Run with Node** (if `http-server` is installed):
   ```bash
   npx http-server .
   ```
4. Open your browser to `http://localhost:8080` (or whatever port is displayed).

## Configuration Files

The game is highly data-driven. You can modify the JSON files in the `json/` directory to change gameplay mechanics.

### `json/game.json`
Global game settings.
- `startLevel`: The starting level file (e.g., `json/levels/1.json`).
- `music`: Default music state (`true`/`false`).
- `soundEffects`: Default SFX state.
- `itemPickup`: Toggle item pickup mechanic.
- `showUI`: Toggle UI visibility.
- `showWelcome`: Toggle welcome screen.
- `debug`: Debug flags (God Mode, etc.).

### `json/rewards/items/guns/*.json`
Defines weapon behavior.
- `Bullet`:
    - `speed`: Bullet travel speed.
    - `damage`: Damage per bullet.
    - `range`: Max distance bullet travels.
    - `fireRate`: Cooldown between shots.
    - `spreadRate`: Spread angle for multiple bullets.
    - `ammo`:
        - `type`: "reload", "recharge", "finite".
        - `amount`: Shots per clip/magazine.
        - `maxAmount`: Total reserve ammo.
    - `Explode`:
        - `active`: Enable bullet explosion.
        - `shards`: Number of shrapnel shards.

### `json/rewards/items/bombs/*.json`
Defines bomb properties.
- `damage`: Damage dealt to enemies.
- `timer`: Time in ms until explosion.
- `explosion`:
    - `radius`: Blast radius in pixels.
    - `canDamagePlayer`: If `true`, the player takes damage from their own bombs.
- `doors`:
    - `openLockedDoors`: If `true`, opens yellow locked doors.
    - `openRedDoors`: If `true`, forces open red (enemy-locked) doors.

### `json/enemies/*.json`
Defines individual enemy stats.
- `hp`: Enemy health.
- `speed`: Movement speed.
- `damage`: Damage dealt to player.
- `special`: If `true`, the enemy is a special type (Boss, Ghost).

## Credits
- **Design & Code**: Cryptoskillz
- **Art & Assets**: Generated with AI
- **Music**: grand_project (Pixabay)