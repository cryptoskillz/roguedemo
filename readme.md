# JS Dungeon Crawler - Rogue Demo

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
| **Toggle Music** | `M` |
| **Restart** | `R` (Game Over screen) |
| **Main Menu** | `M` (Game Over screen) |

### Game Mechanics

- **Objective**: Clear rooms, find the Boss Room, and defeat the Guardian.
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
- `perfectGoal`: Number of "perfect" rooms (no damage taken) required for a reward.
- `enterRoomFreezeTime`: ms to freeze enemies when entering a new room.
- `music`: Default music state (`true`/`false`).

### `json/player.json`
Player starting stats.
- `hp`: Starting Health Points.
- `speed`: Movement speed.
- `invulTimer`: Duration of invulnerability after being hit.
- `inventory`: Starting `keys` and `bombs`.
- `gunType`: Reference to the starting gun file (e.g., "geometry" loads `json/weapons/guns/geometry.json`).
- `bombType`: Reference to the starting bomb file (e.g., "normal").

### `json/weapons/guns/*.json` (e.g., `geometry.json`)
Defines weapon behavior and bullet patterns.
- `Bullet.ammo`:
    - `type`: "reload" (magazine), "recharge" (infinite), "finite".
    - `amount`: Shots per clip/magazine.
    - `maxAmount`: Total reserve ammo (for "reload" mode).
    - `resetTimer`: Time in ms to reload.
- `Bullet.geometry`:
    - `shapes`: Array of shapes ("circle", "square", "triangle").
- `Bullet.damage`: Damage per bullet.
- `Bullet.fireRate`: Cooldown between shots.
- `Bullet.multiDirectional`: Config for shooting multiple bullets at once (North, South, East, West, 360).

### `json/weapons/bombs/*.json` (e.g., `normal.json`)
Defines bomb properties.
- `damage`: Damage to enemies.
- `radius`: Blast radius.
- `timer`: Time until explosion.
- `canDamagePlayer`: If `true`, the player takes damage from their own bombs.
- `openLockedDoors`: If `true`, opens yellow doors.
- `openRedDoors`: If `true`, forces open red (enemy-locked) doors.
- `shootable`: If `true`, bullets can detonate the bomb early.

### `json/enemies/*.json` (e.g., `grunt.json`)
Defines individual enemy stats.
- `hp`: Enemy health.
- `speed`: Movement speed.
- `damage`: Damage dealt to player on contact.
- `deathType`: specific behavior on death (e.g., "fadeaway").
