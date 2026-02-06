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
- `NoRooms`: Number of rooms to clear.
- `music`: Default music state (`true`/`false`).
- `enterRoomFreezeTime`: ms to freeze enemies when entering a new room.
- `ghost`: Ghost settings.
    - `spawn`: Whether the ghost should spawn.
    - `roomGhostTimer`: ms to wait before the ghost appears in a room.
    - `roomFollow`: Whether the ghost should follow the player.

### `json/player.json`
Player starting stats.
- `name`: Player name.
- `description`: Player description.
- `hp`: Starting Health Points.
- `speed`: Movement speed.
- `size`: Player size in pixels.
- `physics`:
    - `strength`: strength of the player.
    - `mass`: mass of the player.
    - `drag`: drag of the player.
    - `friction`: friction of the player.
    - `elasticity`: elasticity of the player.
    - `bounciness`: bounciness of the player.
- `shield`:
    - `active`: whether the shield is active.
    - `colour`: colour of the shield.
    - `hp`: hp of the shield.
    - `maxHp`: max hp of the shield.
    - `regenActive`: whether the shield is regenerating.
    - `regen`: regen of the shield.
    - `regenTimer`: regen timer of the shield.
    - `regenColour`: regen colour of the shield.
- `luck` : luck of the player
- `roomX`: Starting room X position.
- `roomY`: Starting room Y position.
- `x`: Starting X position.
- `y`: Starting Y position.
- `invulTimer`: Duration of invulnerability after being hit.
- `invulnUntil`: When invulnerability ends.
- `invulnColor`: Color of invulnerability effect.
- `lastShot`: When the last shot was fired.
- `lastBomb`: When the last bomb was placed.
- `speedCount`: Number of speed boosts.
- `speedTotalCount`: Total number of speed boosts.
- `perfectCount`: Number of perfect rooms.
- `perfectTotalCount`: Total number of perfect rooms.
- `bombType`: Reference to the starting bomb file (e.g., "normal").
- `gunType`: Reference to the starting gun file (e.g., "geometry" loads `json/items/guns/geometry.json`).
- `inventory`: Starting `keys` and `bombs`.
        "roomGhostTimer": 10000,
        "roomFollow": true
    }

### `json/player.json`
Player starting stats.
- `name`: Player name.
- `description`: Player description.
- `hp`: Starting Health Points.
- `speed`: Movement speed.
- `size`: Player size in pixels.
- `physics`:
    - `strength`: strength of the player.
- `luck` : luck of the player
- `roomX`: Starting room X position.
- `roomY`: Starting room Y position.
- `x`: Starting X position.
- `y`: Starting Y position.
- `invulTimer`: Duration of invulnerability after being hit.
- `invulnUntil`: When invulnerability ends.
- `invulnColor`: Color of invulnerability effect.
- `lastShot`: When the last shot was fired.
- `lastBomb`: When the last bomb was placed.
- `speedCount`: Number of speed boosts.
- `speedTotalCount`: Total number of speed boosts.
- `perfectCount`: Number of perfect rooms.
- `perfectTotalCount`: Total number of perfect rooms.
- `bombType`: Reference to the starting bomb file (e.g., "normal").
- `gunType`: Reference to the starting gun file (e.g., "geometry" loads `json/items/guns/geometry.json`).
- `inventory`: Starting `keys` and `bombs`.

### `json/items/guns/*.json` (e.g., `geometry.json`)
Defines weapon behavior, bullet patterns, and special effects.
- `name`: Human-readable name of the gun (e.g., "Pea Shooter").
- `Bullet`:
    - `speed`: Bullet travel speed.
    - `size`: Bullet size in pixels.
    - `damage`: Damage per bullet.
    - `range`: Max distance bullet travels.
    - `fireRate`: Cooldown between shots.
    - `number`: Number of bullets fired per shot (e.g. shotgun style).
    - `spreadRate`: Spread angle for multiple bullets.
    - `recoil`: Screen shake/recoil intensity.
    - `curve`: Angular velocity/curving of the bullet path.
    - `homing`: If `true`, bullets track enemies.
    - `wallBounce`: If `true`, bullets bounce off walls.
    - `pierce`: If `true`, bullets pass through enemies.
    - `reverseFire`: If `true`, shoots backwards.
    - `critChance`: Probability (0.0 - 1.0) of a critical hit.
    - `critDamage`: Multiplier for critical hit damage.
    - `freezeChance`: Probability (0.0 - 1.0) to freeze enemies.
    - `freezeDuration`: Duration of freeze effect in ms.
    - `particles`:
        - `active`: Enable particle trail.
        - `frequency`, `life`, `sizeMult`: Particle emission settings.
    - `ammo`:
        - `active`: Enable ammo system (if false, weapon is infinite).
        - `type`: "reload" (magazine), "recharge" (infinite), "finite".
        - `amount`: Shots per clip/magazine.
        - `maxAmount`: Total reserve ammo.
        - `resetTimer`: Time in ms to reload.
    - `geometry`:
        - `shape`: "circle", "square", "triangle", or "random".
        - `shapes`: Array of shapes to cycle if "random".
        - `animated`: If `true`, shape rotates/animates.
        - `filled`: If `true`, shape is solid vs outlined.
    - `multiDirectional`:
        - `active`: Enable multi-directional firing.
        - `fireNorth`, `fireEast`, `fireSouth`, `fireWest`: Boolean toggles.
        - `fire360`: Fires in all directions.
    - `Explode`:
        - `active`: Enable bullet explosion on impact.
        - `shards`: Number of shrapnel shards released.
        - `size`, `damage`, `shardRange`: Shrapnel properties.
        - `wallExplode`: If `true`, explodes on striking walls.

### `json/items/bombs/*.json` (e.g., `golden.json`)
Defines bomb properties, explosion effects, and interactions.
- `name`: Unique identifier (e.g., "golden").
- `description`: Description of the bomb.
- `size`: Visual size of the bomb sprite.
- `colour`: Hex color code for the bomb.
- `damage`: Damage dealt to enemies.
- `fireRate`: Cooldown/rate for placing bombs.
- `timer`: {active: bool, time: int} Time in ms until explosion.
- `canShoot`: If `true`, the bomb can be shot by bullets.
- `maxDrop`: Maximum number of bombs that can be dropped.
- `solid`: If `true`, the bomb is solid vs bullets.
- `moveable`: If `true`, the bomb can be moved.
- `physics`:
    - `friction`: Friction of the bomb.
    - `mass`: Mass of the bomb.
    - `restitution`: Restitution of the bomb.
- `explosion`:
    - `radius`: Blast radius in pixels.
    - `explosionDuration`: Duration of the explosion hitbox/visual.
    - `explosionColour`: Hex color for the explosion.
    - `canDamagePlayer`: If `true`, the player takes damage from their own bombs.
- `doors`:
    - `openLockedDoors`: If `true`, opens yellow locked doors.
    - `openRedDoors`: If `true`, forces open red (enemy-locked) doors.
    - `openSecretRooms`: If `true`, can reveal hidden rooms.
- `canInteract`:
    - `active`: If `true`, the player can interact with the bomb (e.g. kick it).
    - `type`: Interaction type kick / throw.
    - `distance`: Distance the bomb travels when kicked.
    - `explodeOnImpact`: If `true`, explodes immediately when hitting an enemy.

### `json/enemies/*.json` (e.g., `grunt.json`)
Defines individual enemy stats.
- `type`: Enemy type.
- `description`: Description of the enemy.
- `damage`: Damage dealt to player on contact.
- `knockback`: Knockback force on contact.
- `shake`: Screen shake intensity on contact.
- `hp`: Enemy health.
- `speed`: Movement speed.
- `size`: Visual size of the enemy sprite.
- `color`: Hex color code for the enemy.
- `hitColor`: Color when hit.
- `deathType`: specific behavior on death (e.g., "fadeaway").
- `deathDuration`: Duration of death animation.
- `special`: If `true`, the enemy is special (e.g., boss, ghost).

