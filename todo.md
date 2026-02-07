bugs
    add const paths to the json files so we dont require absolute urls as this can lead to errors
    shield shows when you go into the portal
    bomb goes blue when you leave the room and go back in
    going to main menu and starting a new game keeps gun modifiers once you pick up a new gun, you correctly start with the peashooter or unarmed
    golden bomb statys on level relaod but not red 
    goldent bomb dodnt not stay on the next level went back to -- if you equip bomb at start it stays if you pick it up it doesnt
    i took golden bomb from first boss fight (lucky drop) but ti wentback to normal bomb on restart
    bombs are blue when you leave and reenter a room 
    is death speech working?
    add player enter room speech for enemies
    add event to boss speech (entry and death)
    max bukket+1 didnt stay on next level same with pierce , modify etc
    you lose the gun modifies on coplete level but if you pock another gun up the coem abck pn player restart
    you pick up 360 gun and drop 360 (the name)
    pull the player still persissts seems to happen when you pick up an item / spawn an item 
    sometimes when you pick up an item they all despawn
    dont use the same enmy name in a room
  
next up 
    refactor
    balance 5 + room enemies
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


refactor 

  
       
    remove bump to pick up items
    guns and bombs working

    remove autostart = true from index call
  
    ui show correct
    bombs drop 
    red and gree shards should update in UI and store in localstorage
    red shards for dup items etc as in logic js
    modifiers not working 
    items dont keep spawning in next room 
    god mode not working
    debug not working 
    debug log not working 
    

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


onky spaw itesm that have 

unlocked / active = true in the item josn or it has been unlocked as is in localstorage. 

If it modifyType session then it is not a persistent upgrade so it only activates when you it pick it up during a game if it persistent then you apply it at gameinit
 
    on game over restart get rid of all the session items

    only drop items that ulocked / active / true
    add unlock rarity to game json and give a unlock if nextlevel is set and the unlock url in room is blank
    add to the unlock and update the unlock state of the item
    sound effects on / off
    add a idele state for player
    msui fade in / fade out 
    check gun unified
    upddate readme 
    add a proper end game outro (star field with text a game by crypto skillz and a btc qr code)
    ui should be a fixed height
    mini map should under ui and bigger
    implement seed system to regenerate exact level so we can debug whilst the boss room does not always spawn
    make most items locked at the start and you can unlock x items at random everytime you beat a level, 
    add correct enemies to each room
    show redshards on welcome screen
    max keys in player json
    max bombs in player json
    




    balance 5  ^ 

        drops should take into account the room hardness of the room and the player modifiers to incrase the pool chances of dropping to help with balancing 

        rather than add the rooms to the json of level instead add a maxHardnes and maxRooms to decide the rooms that go into the level (you could even factor in the player modifiers)

        peermant unlocks can be purchased for gold coins you collect once you unlock permance mode you can pay to buy any item you unlocked 


        beat the game to unlock permance mode 
        so you cna buy the item you want for the next run you can also get really expensice items that are permant upgrades so upgrades are permant and active when you start a new run such as enemy names

        Add a canPickUp flag to enemy Json to steal and use your spawned items and guns 
        using the follow mechanic, gun modifier, canhurtplayer (set to false) and canhurt enemies (set to true) we can create pets that follow you and shoot at enemies

        Add a charisma stat / item that can be used to turn enemies into pets / friends useful for the pacacifer runs

        add a mechanic for the passiver run the boss room to open the portal i am thinking of standing on tile(s) for a set amount of time and / or in a set sequence

        A sucessful pacacfier run awards you the pacacfier gun that does no damage but could be used to turn enemies into pets / friends

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
    running into an enemy shoul dmake a sound

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

 another ghost spawens every 10 seconds if you dont kill the first ghost ghost timer should stop when the ghost spawns (only ever spawns max 2 ghosts)
ghost non solid enmeies should be able to pass through bombs (they dont explode)
ghost appears when you stay on th ewelcoem screen for 10 seconds stopping ghost from spawining in start room will fix this 
ghost does not appear in boss rooms
if you go through multiple room and back track you will see multiple ghosts
if you leave a room and come back the ghost should be the same place + closer to you basedo on the speed the ghost moves. 
if you kill some of the enemeis and leave a room and back there should only be the remaining enemies left (with ghost or blowing doors)
  door is gone
    ghost timer is running when you are on the welcome screen
    ghpst wont enter a room with an indestrcutible eemies
    if an enemy is nor sold (ie ghost) he should nor try to around enemies just go through them
        solid enemies cant go through each other, player or objects
        non solid enemies can be shot by bullets
        solid enemies can be shot by bullets
        player can alos be solid or non solid    



level plan
    on level tooling up if you dont pick up the peashoort or bombs you go into a pacafist run 
    use item flag unlocked on level 3
drop items flag on level 3 if not picked up items are never dropped
    guns items (uses items)
bombs
inventory
bullets 
player
level 4 standaed boss 
level 5 is golcen path maze (it will say room name followed by dejavu)
level 6 is harder level one
level 7 ghost chase
level 8 is crazy rooms
level 9 is boss rush
level 10 unlocks permanance (if enable permeane mode you can do the sweet modifiers but the whole game becomes harder as a result)




NPCs
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
    dont drop the same item twice


    solid false
    coin item :
    start room in a 10000 chance to drop a legendary item 
    room bonus
    key bonus
    speedy bonus
    perfect bonus
    inventory screen
    inventory screen should show the items that are unlocked
    only drop items that are unlocked
    shield+
    speed+
    luck+
    randomstat+
    kick bombs
    speical item is game.json

    guns
        max ammo
        ammo
        reload time
        chrage time

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
        invuln
        invulnUntil
        invulTimer
        invulColour
        shield hp
        shield maxHp
        shield regenActive
        shield regen
        shield regenTimer




    shield


        
     


     inventory   
    


levels
    

logic
    reload gun / bomb when they pick up a new item
    if you get hit perfect bonus will reset 
    show gun name in the UI
    update game.json vars to implemnt various switches   


bombs
    add an explode on enemy / anything 


level 1

start room
    if its first time it should just say game complete and unlock door and take you back to the menu
    implemebt new and save game (use sqllite to store the game data)
    the second time you will have doors
    each time you finish the game you will unlock more stuff

player 
    triangle should rotate to be the point the way you are moving
    iron man mode (ooe hit dead, all modifiers reset) (require save first)
    if speed is over 2 x starting speed show a blur effect
    gemoetry gun shows triangle, square etc
    peashooter shows peashooter
    


bullets  
    cosine gun
    if no bullets and you press fire you should get a broken gun sound




key binding
    i = inventory
    m = shows full map
    s = stats
    

    
mini map
    item should show the whole mini map
    item suould shou secret rooms
    item will show boss
    whole mini map should be shown always (is this true we have a button which will show the full map)
    make rooms go golden if you follow the golden path as a later level will be random rooms that get harder and harder everytime you go off the golden path and enemies respawn in rooms.
    mini map should not show red for static enemies once the room is clear it should go yellow


debug window 
    updateDebugEditor make it update in realtime when something happens in the game
    when you click off of it it should focus back on the game
    add a export json option











modifiers
    luck
        this is added to the bonus room, secret room and item drop chance 

sratch pad

add a level generation that picks the rooms from the pool of rooms and links them from start to boss and throws in a few random rooms
    have a level.json that has a pool of rooms and a pool of special items
    have a level.json that has a pool of boss rooms 
    have a level.json that has a pool of items
    have a level.json that has a pool of keys
    have a level.json that has a pool of bombs
    have a level.json that has a pool of bombs
    move the rooms to a level folder and have a level.json that has a pool of rooms

have a perfect mode if you dont waster a bullet (perfects have to be sequential but we could have an item that turns it into no sequential)*
    x > perfects drop a perfect message*
    x > perfects drop a perfect item
   =
if it is done in under 10 show speedy.
    in the future have a speed clear var in the room json and this sets the speed clear
    x > speed clears drops a speed items
    move this to room.json 


player.json
    unvuk period
    implemment key pick up 
    implement bomb item
    implement bomb pick up
    implement bomb place

add a timer
add a heatlh bar
count the number of dead enemies




