bugs
    homing missles should start at the side of the key that was pressde
    if you get hit perfect bonus will reset 
    360 bullet mode the right bullet is a little slow

start room
    if its first time it should just say game complete and unlock door and take you back to the menu
    implemebt new and save game (use sqllite to store the game data)
    the second time you will have doors
    each time you finish the game you will unlock more stuff



bullets  
    no bullets
    added ammo, if it is active it should count count
    

bombs
bombs are dropped with space bar 
you can only have one bomb type at a time it upgrades from normal to golden 
bombs can get be dropped, thrown and kicked with items you pick as well as default settings
bombs are in the invetroy and can be picked up, when you press the space bar they can be dropped normal bombs can blow open doors and secret doors (in walls etc)golden bombs can blow open red doors with enemies still in the room 
    bombs.josn
        size
        damage
        timer
        canBePlaced
        canBeDropped
        canBeThrown

enemies
    have enemies be able to use bullets
    have swarm enemies that run away unless there are x of them
    have run away enemies
    last enemy tougher


key binding
    i = inventory
    m = shows full map
    s = stats
    p = perfect
    

next up 
    enemies become twice as hard if you kill the boss and back track
    
mini map
    item should show the whole mini map
    item suould shou secret rooms
    item will show boss
    wds

debug window 
    CHEATS_ENABLED
    enemies
    updateDebugEditor make it update in realtime when something happens in the game
    when you click off of it it should focus back on the game
    add a export json option
    move the cords into this 





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

items


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




