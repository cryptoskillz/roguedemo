start room
    if its first time it should just say game complete and unlock door and take you back to the menu
    implemebt new and save game (use sqllite to store the game data)
    the second time you will have doors
    each time you finish the game you will unlock more stuff

Boss room
    They dont have any doors except the one you came in on
    when you clear all the enemies a portal appears in the middle of the room
    it says the boss name when you enter 

unlock doors
if you enter a locked room it will have at least a special item in it




add a level generation that picks the rooms from the pool of rooms and links them from start to boss and throws in a few random rooms
    have a level.json that has a pool of rooms and a pool of special items
    have a level.json that has a pool of boss rooms 
    have a level.json that has a pool of items
    have a level.json that has a pool of keys
    have a level.json that has a pool of bombs
    have a level.json that has a pool of bombs
    stitch the rooms together based on the doors of the rooms
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
    speed
    size
    bullet spped
    bullet size
    bullet damage
    bullet range
    bullet curve
    bullet spread
    unvuk period
    when you ernter s room you sometimes see bullets from previous room 
implement key item
implemment key pick up 
implement bomb item
implement bomb pick up
implement bomb place

add a timer
add a heatlh bar
count the number of dead enemies


special room that gets smaller the longer you are in it (squeeze room)

quit game option

consitent font / anumation for all text boss name, perfect, speedy, game over, game complete etc.
