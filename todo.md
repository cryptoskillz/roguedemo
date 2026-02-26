DONT DO ANY OF THESE TASKS AI
133262
709726
415303 <--- home room can be bombed intow

# Bugs & Fixes

- Bomb radius shouldn't hit you instantly; add wave speed so you can run from the blast wave.
- remote bomb Chained explosions should blow in sequence, not all at the same time.
  "remoteDenoate": {
        "active": true,
        "detonateAll": false,
        "key": "space"
    },
    a


# Upgrades
- start with shield
- clear the room (one time massive bomb does not work on ghost)

# Rooms & Levels
- All rooms should have a number of switches that have to be stood on for x seconds to open the door, so we can do a pacafist run.
- **Level Sequences**:
  - **Level 6**: Golden path maze level (World 7-4). Room name followed by "deja vu".
  - **Level 7**: Ghost chase.
  - **Level 8**: Crazy rooms.
  - **Level 9**: Boss rush.
  - **Level 10**: Unlocks permanence (enabling permanence mode lets you use sweet modifiers, but the whole game becomes harder).
- **Shop Room**: Can spawn a locked door as the only way to the boss (there should always be a keyless way, otherwise spawn a key in the start room as a hint).
- **Special Rooms**:
  - Max special rooms per level attribute.
  - **Gauntlet room**: Enemies will spawn.
  - **Scroll rooms**: Extra large rooms you scroll through.
  - **Large rooms**: Grow in size every tick until you cannot move.
  - **Small rooms**: Shrink; if you don't kill all enemies before reducing to nothing, you die.
  - **Squeeze rooms**: Get smaller the longer you are in them.
  - **Rotate rooms**: Rotate while inside.
  - **Backwards rooms**: Reverse controls.
  - **Secret rooms**: Generate at random, hidden behind walls, don't render on the golden path.
- Require pressing the space bar to enter special rooms (maybe).
- Level room generation: instead of static level JSON, use `maxHardness` and `maxRooms` (and player modifiers) to decide room pool.

# Gameplay & Mechanics
- Implement "can go through bullets" modifier.
- Add bullet time.
- Drops should calculate room hardness and player modifiers to increase drop pool chances.
- **Modifiers**:
- `max bullet+1`, `pierce`, and other modifiers don't stay on the next level.
  - You pick up `360 gun` and drop `360` (name mismatch).
  - Global gun/bomb modifiers as unlockables.
  - Lose gun modifiers on complete level, but they return on player restart if you pick the gun back up.
  - Dropped guns shouldn't lose their modifiers.
  - Luck modifier affects bonus room, secret room, and item drop chances.
- **Pacifist Run**: Complete game without killing to get Pacifist Gun. The boss room requirement for opening the portal could be standing on tile(s) for a set amount of time or in a sequence.
- [x] in the portal warning if you hit cancel it brings it straight back up as you are still in the portal, could we push the player out if you hit cancel?
- **Iron Man Mode**: One hit dead, all modifiers reset (requires saving first).
- **Triangle/Player Rotation**: Should point the way you are moving.
- Show blur effect if player speed goes over 2x starting speed.

# UI, Polish, & Sound
- Level transition fix: Last screen shows a little before going to the welcome screen on levels 0, 1, 2, and 5.
- Add "Speech" attribute to enemies (used for entering, bosses, death). Show text below enemies rather than at the top of the screen.
- Narration:
  - Level 0: "You can hear me? go through the portal"
  - Level 1: "you found it again, interesting"
  - Level 2: "you will require some help"
  - Level 3: "find the secrets"
- Achievements: Enemies killed, feed the portal.
- Game Over Screen: Add what killed you.
- Completion Screen: Count dead enemies, scroll dead enemy types. Show an increasing number of killed enemy types on the Welcome screen.
- Screen overlays for portals: Live portals purple, used ones green (when spawned via debug).
- Add Epic rarity items.
- Menus & Settings: Add Inventory screen (shows unlocked items), Stats, Player modifiers, unlocks.
- Minimap:
  - Show full map button (or item additions for bigger, massive, fullscreen map, show boss, secret rooms).
  - Change static enemies to yellow once room is clear.
  - If boss killed, rooms turn red until traversed.
- Key bindings: `i` = inventory, `m` = full map, `s` = stats.
- **Sound**: Different sounds for each gun, enemy speech/type (yelp, angry), button presses, passing a secret room.
- If no bullets and you fire, play a broken gun sound.

# Ghost Mechanics
- Ghost shouldn't go into matrix room, home room, start room, or boss room ("what is he scared of?").
- Ghost won't enter a room with an indestructible enemy.
- Add back the old Ghost Gun.
- Kill ghost -> equip ghost gun -> go to trophy room -> portal to ghost realm (real final level).
- Ghost respawns fully healed if you get too far away (should be hard to kill; coax him to chase you).
- Add ghost to the welcome screen.
- Ghost and non-solid enemies pass through bombs (bombs don't explode) and solid objects/enemies.
- Dropping a bomb inside the ghost: eating you doesn't explode it (maybe kick mechanic fires).
- Backtracking through multiple rooms shows multiple ghosts. Ghost position updates based on speed when re-entering.
- Defeating Ghost: Buy ghost trap (10k red shards) -> Catch ghost (5 seconds) -> take to portal room to let out -> he dies. Upgrade trap timer.

# Enemies & NPCs
- Enemies spawn outside the room if they are very big.
- Add stay angry when hit feature
- Add Shopkeeper NPC.
- Boss speech events (entry & death).
- Add physics and hit/death sounds to enemy JSON instead of hardcoded in `logic.js`.
- Transformer boss: square, circle, 4 rectangles (take out limbs).
- Swarm enemies that run away unless there are >X of them.
- Add `canPickUp` flag: enemies steal and use player items/guns.
- Add Charisma stat: turns enemies into pets/friends.
- Random states: Happy (jump for joy, heal player if hit), Dazed (run away), Confused (attack each other).
- Scared "WITNESS ME" enemies: they run out of rooms, group up in boss room, and attack shouting "WITNESS ME", Boss responds "MEDIOCRE".
- Secrets interaction: enemies look at the secret quickly, then look away.
- **Shapes**:
  - Regular: pentagon, heptagon, octagon, nonagon, decagon, parallelogram, rhombus, trapezoid, kite.
  - Irregular: triangle, quadrilateral, pentagon, hexagon, heptagon, octagon, nonagon, decagon.
  - 3D: sphere, cone, box, cube, cylinder, pyramid.

# Items, Guns, & Bombs
- Only drop unlocked items.
- Item concepts: `speed+`, `luck+`, `randomstat+`, kick bombs, `fps item` (special item is `game.json`).
- **Guns**: Critical gun, freeze gun, angry gun, cosine gun, shard gun (got by pushing 50 items into the portal).
- **Turrets/Gunners**: Separate enemy type. Fire delay (so multiple turrets stagger fire). Line of sight matching. Ranges. Shoot through enemies. Default load patterns (tl, c, tr, bl, br, tc, bc).
- **Bombs**: Size, explode time/radius/damage/duration. Explode on impact/enemy/player/wall/floor/ceiling/nothing/everything. Range, damage, solid toggles. Remote detonate. Can shoot/kick. Max drop count.

# Player / Stats
- Add an idle state.
- Parameters to tune: speed, size, strength, mass, drag, friction, elasticity, bounciness, luck, solid.
- Shield parameters: hp, maxHp, regenActive, regen, regenTimer.

# Editor & Debug
- If you press 0 or 9, it should update the debug buttons to on/off.
- Update debug editor so it updates in real-time when the game runs.
- Clicking off the debug window should focus back on the game.
- Add God mode to the debug window.
- Add visual editors: Enemy editor, player editor, item editor, object editor.
- Look into JSON compressors.

# Backend & Persistence
- Replace `localStorage` with a local DB (like SQLite with `sql.js` or `absurd-sql`) to sync with a server.
- Store permance unlocks, permanent modifiers, session/global stats.
- Speedrun leaderboard: Store player name, level, and time on the server.
- Permanent unlocks can be purchased with red shards once permanence mode is unlocked.

# Misc Engine Needs
- Mobile inputs, touch screen, and joypad support.
- Implement `matter.js` for physics.

# Balance
- Speedy timer should be set for standard peashooter time, but adjust down for more powerful guns.
- change the portal bonus based on how many items are in the room.

