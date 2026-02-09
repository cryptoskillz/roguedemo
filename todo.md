bugs

I fixed the issue where some unlocks (like the Minimap and Timer) were missing the Legendary particle effects.
The logs revealed that these items had a rarity of "special" (instead of "common"), which my previous auto-upgrade logic was ignoring. I have updated the code to automatically upgrade both "common" and "special" rarity unlocks to Legendary.
This means all unlock items—whether Minimap, Timer, or Keys—will now correctly display the Gold Light Beam and Sparkles, matching the Shotgun's appearance. Please check it out!


matrix room does not spawn untik after first boss
pause restart does not show sweet teleport
    if you pick it up the portal unlock screen is not required (should it active immediately?)
    if yo press 0 or 9 it should update the debug buttons to on / off
    drawtutoiral in load roomd
    chained explosion should bliw in sequence not all at the same time
    if you leave the room with a remote bomb it wont detonate with space bar
    golden bomb statys on level relaod but not red 
    golden bomb does not not stay on the next level went back to -- if you equip bomb at start it stays if you pick it up it doesnt
    i took golden bomb from first boss fight (lucky drop) but ti wentback to normal bomb on restart
    is death speech working?
    add player enter room speech for enemies
    add event to boss speech (entry and death)
    max bullet+1 didnt stay on next level same with pierce , modify etc
    you pick up 360 gun and drop 360 (the name)

    modifiers
        when you chnage gun all the modifiers are removed a nice item to unlock would be global gun / bomb modifiers
        you lose the gun modifies on coplete level but if you pock another gun up the coem abck pn player restart
        if you drop a gun with modifers such as homing if you pick it back up it should have those modifiers still
     decide if modifiers that are effecvivetly the same as guns want to look the same ie 360 modifier it seems to have different stats to the 360 gun


next up 
  bug fix 6
  sfx & ui updates
        game settings
            inventory
            stats
            player with modifiers
            unlocked items
            unlocked enemies
            unlocked players
            unlocked rooms
            unlocked guns
            unlocked bombs
    
    ghost
    rooms
    items
    balance
    unlocks / permance
    server    

Bug fix 6
    check bomb json 
    tweak guns
    twweak bombs
    add a powered down portal to the start room
    fix debug logs 
    add more unlocks
    no route to boss room
    On the server we dont see the sweet teleport as the screen goes black so either remove this or have the teelport at the start not the end 
    On the server we are not seeing the last level unlock 
    wasd during pick up items locks up occasionlllay and pulls in you a random direction for a while, firing seems to fix it. 
    somme gold doors wont unlock you have to clear the room go out and go back in and its fine
    enemes spawm outside the room if they are very big
    shield shows when you go into the portal
    bomb goes blue when you leave the room and go back in
    dont use the same enmy name in a room
    add back old ghost gun
    bombs are blue when you leave and reenter a room 

    
Levels
    Level 5 harder boss (with gun)
    level 6 is golcen path maze (it will say room name followed by dejavu)
    level 7 ghost chase
    level 8 is crazy rooms
    level 9 is boss rush
    level 10 unlocks permanance (if enable permeane mode you can do the sweet modifiers but the whole game becomes harder as a result)


   
    

narartor
    add narrator speech 

    level 0 
        You can hear me?  go through the portal
    level 1
        you found it again, intreting 
    level 2
        you will require some help
    level 3
        find the secrets

    

       
achivements
    enemies killed
    feed the portal


Balance
    add what killed you to the game over screen
    tweak guns and bombs
    add correct enemies to each room

 implement seed system to regenerate exact level so we can debug whilst the boss room does not always spawn
    beat the game to unlock permance mode 
       add restarts to the session and global stats

    count the number of dead enemies and show on dead complete screen, scroll the dead enemy types up
        This will be the first thing we store on the server we will store the players name, level and time and have a speed run leaderboard
    drops should take into account the room hardness of the room and the player modifiers to incrase the pool chances of dropping to help with balancing 
    rather than add the rooms to the json of level instead add a maxHardnes and maxRooms to decide the rooms that go into the level (you could even factor in the player modifiers)
    peermant unlocks can be purchased for red shards you collect once you unlock permance mode you can pay to buy any item you unlocked 


    Add a canPickUp flag to enemy Json to steal and use your spawned items and guns 
    using the follow mechanic, gun modifier, canhurtplayer (set to false) and canhurt enemies (set to true) we can create pets that follow you and shoot at enemies
    Add a charisma stat / item that can be used to turn enemies into pets / friends useful for the pacacifer runs
    add a mechanic for the passiver run the boss room to open the portal i am thinking of standing on tile(s) for a set amount of time and / or in a set sequence
    enemies have a happy mode where they run around and jump for joy and add hp to you if you hit them 
    enemies have a dazed mode theres eyes turn to circles and they run away from the player for a few seconds
    enemies have a confused mode and they attack each other 
    enemy can randomly be scared and they run away out of the room,  You fimd these enemies in the bnss room explaining their cowardice and they attack in the boss battle which shouting 
    
    "WITNESS ME"

    to which the boss always responds

    "MEDICORE"

    if there is a secret in the room some enemies will quickly look in its direction the look away after a second or two

sound
    sound effect for portal
    sound effect for bomb
    sound effect for item spswn
    different sound for each gun
    different sound for each type yelp angry etc
    add sound effects to button presses 
    sound effect when you go past secret room (add seret room)
    WHNE YOU CNT PIcK UP AN ITEM GIVE A fail SOUND
    different guns have different sounds
    when the enemies speak give them a speech sound (different for each enemy)


enemies

    regular
        pentagon
        heptagon
        octagon
        nonagon
        decagon
        parrallelogram
        rhombus
        trapezoid
        kite

    irregular
        triangle
        quadrilateral
        pentagon
        hexagon
        heptagon
        octagon
        nonagon
        decagon

    3d
        sphere
        right circular cone
        ectangular box
        cube
        cylinder
        pyramid


    with even number of sides



ghost
    when you drop a bomb inside the ghost when it eats you as its not solid it never explodes (maybe kick mechanic is firing)
    ghost non solid enmeies should be able to pass through bombs (they dont explode)
    ghost should be able to pass through solid enemies 
    ghost should be able to pass through solid objects
    if you go through multiple room and back track you will see multiple ghosts
    if you leave a room and come back the ghost should be the same place + closer to you basedo on the speed the ghost moves. 
    if you kill some of the enemeis and leave a room and back there should only be the remaining enemies left (with ghost or blowing doors)
    door is gone
    ghost wont enter a room with an indestrcutible enemy
    add a timer to show you how long you survice
    ghost wont enter a start or boss room what is he scared of?


NPCsds
    shop keeper 

rooms
    number of rooms json change this to per level if used
    change the drop chane from 100% once we are finished testing
    if movetype has an x,y start it there
    Boss room
    shop
        shows up once a round (have to add coins)
    secrets roons
        secret room generate at random and can be hidden behind walls etc these do not render in the golden path special things unlock them
    special room
        special rooms are things like shops etc they can have a max per level attr
        special room that gets smaller the longer you are in it (squeeze room)
    guantlet room
        enemies with spawn
    scroll rooms 
        extra large rooms that you scroll through
    large rooms 
        rooms where you grow in size every tick until you are so big you cannot move
    small rooms
        rooms where you get smaller and if you dont kill all the enemies before you go to nothing you die
    squeeze rooms
        rooms that get smaller the longer you are in them
    rotate roons
        roons that rotate as you in them
    backwards
        rooms that revers the controls

editor
    add a enemy editor
    add a player editor
    add an item editor
    add an object editor

enemies
    add enemy hit and enemy death sound  from json
    [x] boss should not get name from names.json he already has a name from json
    maybe if ghost is x rooms away we just spawn him in the new room
    add pyshics to the enemies json instead of having them hard coded in logic.js
    add more shapes
    transformer boss square, circle, 4 rectnagles for legs and you have to take out each limb
        have swarm enemies that run away unless there are x of them
    enemy move types
        pattern


server
    store game data
    store permaant unlocks 
    store permant modiifers

items
    inventory screen
    inventory screen should show the items that are unlocked
    only drop items that are unlocked
    shield+
    speed+
    luck+
    randomstat+
    kick bombs
    speical item is game.json

     bombs
        size
        explode time
        explode radius
        explode damage
        explode on impact
        explode on enemy
        explode on player
        explode on wall
        explode on floor
        explode on ceiling
        explode on nothing
        explode on everything
        range
        damage
        inrease timer
        decrease timer
        solid
        remote detonate
        remote detomate all
        can shoot
        can kick
        kick explore on impact
        kick distance
        explode radius
        expldoe duration
        max drop

     player
        add a idle state for player
        speed
        size
        strength
        mass
        drag
        friction
        elasticity
        bounciness
        luck
        solid
        shield hp
        shield maxHp
        shield regenActive
        shield regen
        shield regenTimer

    shield

     inventory   
    
logic


bombs
    add an explode on enemy / anything 

player 
    triangle should rotate to be the point the way you are moving
    iron man mode (ooe hit dead, all modifiers reset) (require save first)
    if speed is over 2 x starting speed show a blur effect

bullets / guns 
    gunner and truuets 
        gunner should have a fire delay so not all turrerts fire at once if there are many in the room
        turrets should have line of site and only fire if they can see the player
        turrets shoild have range and only fire if you are in range (stealth missions)
        gunner should its own enemy type that way we can use small,large,mega etc.
        gunners can shoot through  enemies
        many turrts in the room we ahould have a way to define fire rate etc i am not sure the modifierf is working on the gun may require a seperate gun modifer
        defualtlaod patterns tl, c, tr, bl, br, tc, bc.  it is middle indent so it does block door
        if count > 1 place the next one x pixels away until they are all placed
    cosine gun
    if no bullets and you press fire you should get a broken gun sound
    shard gun got from pushing 50 items into portal room 
    pacifist gun, get by completing the game withoug killing anything 

key binding
    i = inventory
    m = shows full map
    s = stats
    
mini map
    item should show the whole mini map
    item suould shou secret rooms
    item will show boss
    whole mini map should be shown always (is this true we have a button which will show the full map)
    mini map should not show red for static enemies once the room is clear it should go yellow
    when you have killed the boss all rooms go red until you go through them

debug window 
    updateDebugEditor make it update in realtime when something happens in the game
    when you click off of it it should focus back on the game
    add a export json option

modifiers
    luck
        this is added to the bonus room, secret room and item drop chance 

sratch pad






