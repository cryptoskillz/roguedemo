bugs
    if music has been toggled off it shouldnt turn back on on restart / going back to main menu
    the enemies get stuck they should work their way around obstacles
    solid false does make you invul when you are hit  
    check freezeDuration works below 1 second.  
    if ghost appears and hyou leave a room with enemies when you go back only the ghost remaims 
    ghost does not seem to be following you he seems to be stuck frozen in the room
    when you reenter the guardian room it shows the intro 
    ghost time should not start until the enemies are dead
    reload gun when you enter a new room should not reset
    if an enemy hits you do they take damage?
    room tweaking
    rooom bonus item drop
    speedy item drop
    perfect item drop
    angry enemies do not restart on new game
    enemies should move through ghost enemies and try not stay inside them 
    dont spawn items on top of one another
    360 modifier does not work
    items should moce away from doors when they are pushed as they cannot be picked up
    explode modifier does not work  
    update game.json vars to implemnt various switches   
    use bonuses from game.json to reward the user they should be 100% and these 
    should be considered as special binuses
    special items should get from a special folder in items


next up 
    items
    debug window
    enemies
    rooms
    server
    levels

server
    store game data
    store permaant unlocks 
    store permant modiifers

items
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
    level 1 is a basic intro
    level 2 is golcen path maze (it will say room name followed by dejavu)
    level 3 is harder level one
    level 4 is crazy rooms
    level 5 is boss rush
    level 6 unlocks permanance (if enable permeane mode you can do the sweet modifiers but the whole game becomes harder as a result)


logic
    reload gun / bomb when they pick up a new item
    if you get hit perfect bonus will reset 
    show gun name in the UI

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



enemies
    have enemies be able to use bullets
    have swarm enemies that run away unless there are x of them
    have run away enemies
    last enemy tougher
    add enemy hit and enemy death sound   from json
    boss hit boss death   from json
    death shake  from json
    maybe if ghost is x rooms away we just spawn him in the new room



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
    CHEATS_ENABLED
    enemies
    bombs
    guns
    items
    updateDebugEditor make it update in realtime when something happens in the game
    when you click off of it it should focus back on the game
    add a export json option
    move the cords into this 
    go to room (renders it in)
    move it left
    move the log to below the debug window
    add spawn items 






rooms
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




