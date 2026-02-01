bugs

    in debug space is spqaing room
 
next up 
    enemies
    debug
    rooms
    items 5
    server
    levels


enemies
    add enemy hit and enemy death sound  from json
    boss hit boss death  from json
    death shake from json
    maybe if ghost is x rooms away we just spawn him in the new room
    add pyshics to the enemies json instead of having them hard coded in logic.js
    add more shapes
    transformer boss square, circle, 4 rectnagles for legs and you have to take out each limb
        have swarm enemies that run away unless there are x of them
    enemy move types
        pattern


ghost
- [x] ghost does not always seem to kill you if it hots i think if there are other emenuies something is going wrong witht he collision

if you go through multiple room and back track you will see multiple ghosts
if you leave a room and come back the ghost should be the same place + closer to you basedo on the speed the ghost moves. 
if you kill some of the enemeis and leave a room and back there should only be the remaining enemies left (with ghost or blowing doors)


level plan

level 0

Player is on a black background, with a grey portal.  Nothing else.  you 
move over the portal and it says game complete.

welcome screen unlocked 
text unlocked 
start room unclocked 

level 1

the player is in the start room, no mini map, no ui, no weapon, no doors.  The portal is there this time purple (the main on we use for the rest of the game).  came compelete screen shows up

doors unlocked
rooms unlocked
enemies unlocked 


level 2
the player starts in the start room with doors and the following items

peashooet item
normal bomb item 
mini map
ui 

you can equip these if you want to you get a bonus for each of these you dont equip at the end of the level. 

You go through a few rooms and shoot a few enemies

eventually you enter the "boss" room but there is no boss just the portal. came compelete screen shows up

boss enemies unlocked
music & sfx unlocked

level 3

the unpicked up items stay in the starting room and the game begins proper at this point.

level 4 is golcen path maze (it will say room name followed by dejavu)
level 5 is harder level one
level 6 ghost chase
level 6 is crazy rooms
level 7 is boss rush
level 8 unlocks permanance (if enable permeane mode you can do the sweet modifiers but the whole game becomes harder as a result)




server
    store game data
    store permaant unlocks 
    store permant modiifers

items
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

debug window 
    updateDebugEditor make it update in realtime when something happens in the game
    when you click off of it it should focus back on the game
    add a export json option






rooms
    number of rooms json change this to per level if used
change the drop chane from 100% once we are finished testing
    Boss room
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




