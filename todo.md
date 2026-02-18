DONT DO ANY OF THESE TASKS AI
133262
bug

new room.json format
        add matrix room with matrix key
        add home room with home key

        ghost wont go into boss room
            

    shop room
        shop can spawm a locked door as the only way to the boss there should always be a keysless way to the boss if we not we should spawn them a key in the start room as a hint its a hard level, save that key
    can we store google font locally to make it work offline
    load music from room json is it exists when you leave that room go back to the old
    music
    live portals should be purple used ones should be green (when you spawn them from debug)
    look into json compressors 
    seret room
        secret rooms should be an unlock
        secret rooms dont show on the mini map
    add level 6 maze level (World 7-4) 
    gun turret requrie its x y back (if it spawns off screen move it until it is on screen)
    remove the matrix att in room and use id instead
    add speech attr to enemy, used for bosses, enter, die
    if ghost / enemy speech is at top of screen you cant read it so make it show below the enemy
    unlock spawns is slow after boss kill
    golden path bonus shows on the perfect bonus counter
    now you turret goes the way you last fire, this should only be when you fire a bullet if you are moving and not shooting is should 
    revert to pointing the way you are moving,
    ublock drop that have already been locked
    implement can go through bullets modifier
    "staysAngryWhenHit": false  ,
    dont spawn same unock twice
    give red shards if their are no unlocks left
    enemes spawm outside the room if they are very big
    shield shows when you go into the portal
    bomb goes blue when you leave the room and go back in
    dont use the same enmy name in a room
    add back old ghost gun
    bombs are blue when you leave and reenter a room s
    unlock spawn that have already been already unlocked
    fix debug logs 
    the bomb raudis should not hit you at once as the wave is coming to you should be able to run but make add wave speed as its a little slow
    matrix room does not spawn untik after first boss
    add god mode to the debug window
 tried to run out of a room with a ghost and enemies it would not let me even though i blew it with a red bomb
    speedytimer shoukd be set for standard peashooter time but adjust down for the more powerful gun you have we dont have to be super precise with this and min max it mayber have perOverPeashooter and it uses this to adjsut the speedy bonus accordingly, that can read speedy pea shooter bonuses
    bomb drop don has a big B
level 0 = shows last screen a little before going to welcome screen (unlocks)
level 1 = shows last screen a little before going to welcome screen (unlocks)
level 2 = shows last screen a little before going to welcome screen (unlocks)
level 5 = loads credits fine then shows last screen a little before going to welcome screen (unlocks / not)
    boss spwans with portal sometimes
    minimap moves down on restaer then goes back up
    add epic rarity 
    add a powered down portal to the start room
    add bullet time
    you ca move bobs into other bombs that are solid
    if you pick it up the portal unlock screen is not required (should it active immediately?)
    if yo press 0 or 9 it should update the debug buttons to on / off
    chained explosion should bliw in sequence not all at the same time
    if you leave the room with a remote bomb it wont detonate with space bar
    golden bomb does not not stay on the next level went back to -- if you equip bomb at start it stays if you pick it up it doesnt
    is death speech working?
    add player enter room speech for enemies
    add event to boss speech (entry and death)
    max bullet+1 didnt stay on next level same with pierce , modify etc
    you pick up 360 gun and drop 360 (the name)
    add shop room 
    add home room
    add trophy room


    modifiers
        when you chnage gun all the modifiers are removed a nice item to unlock would be global gun / bomb modifiers
        you lose the gun modifies on coplete level but if you pock another gun up the coem abck pn player restart
        if you drop a gun with modifers such as homing if you pick it back up it should have those modifiers still
     decide if modifiers that are effecvivetly the same as guns want to look the same ie 360 modifier it seems to have different stats to the 360 gun


next up 
SFX  ui updates and new items
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

sound
    different sound for each gun
    different sound for each type yelp angry etc
    add sound effects to button presses 
    sound effect when you go past secret room (add seret room)
    different guns have different sounds
    when the enemies speak give them a speech sound (different for each enemy)

Welcome screen
    Settings screen

    
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
    look into a local db maybe sqllite with sql.js or absurd-sql so we can replace local storage and have it sync to a server. 
    add mobile inputes / touch screen
    add pyshics matter.js
    add joypad support 
    rtophy room has matrix room and house requiring house and matrix key
    this is why he never goes in the portal room or the start room (which will have a portal)
    show an increasingf number of enemies type you killed to the welcome screen with the big ghost occasionally showing
    add what killed you to the game over screen
    count the number of dead enemies and show on dead complete screen, scroll the dead enemy types up

    add correct enemies to each room

    beat the game to unlock permance mode 
       add restarts to the session and global stats

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
    when you kill the ghost and equip the ghost gun you go to the trophy room and the
    poeral will appear taking you to the ghost realm this is the real last level of the game.
    if the ghost respawns his health is reset think so he should be really hard to kill you shuold clear the level go back coax him and have him chase you 
    if you get to far away he stops following you and goes back to the void and comes back later fully healed. 
    add ghost to the welcome screen
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
you kill the ghost by buying the ghost trap and lettign hoim out in the ghost room
    you have to buy the ghost trap for 10000 red shards, requires upgrading the shard system
    yuo catch the ghost
    you then got 5 seconds in the trap (never enough)
    you have to upgrade the timer of the trap
    you take the gost to a protal room and let him out
    he dies

NPCsds
    shop keeper 

rooms
    number of rooms json change this to per level if used
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
    add pyshics to the enemies json instead of having them hard coded in logic.js
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
    speed+
    luck+
    randomstat+
    kick bombs
    speical item is game.json
        add fps item

    guns 

        add critical gun
        add freeze gun
        angry gun

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
    item to show secret rooms
    item will show boss
    whole mini map should be shown always (is this true we have a button which will show the full map)
    mini map should not show red for static enemies once the room is clear it should go yellow
    when you have killed the boss all rooms go red until you go through them
    bigger mini map item
    even bigger mini map item
    massive mini map item 
    full screen mini map item 
debug window 
    updateDebugEditor make it update in realtime when something happens in the game
    when you click off of it it should focus back on the game

modifiers
    luck
        this is added to the bonus room, secret room and item drop chance 

sratch pad






