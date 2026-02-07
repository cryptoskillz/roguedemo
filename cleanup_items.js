
const fs = require('fs');
const path = require('path');

const fileList = [
    // Bullet Modifiers
    'json/items/modifiers/bullets/2way.json',
    'json/items/modifiers/bullets/360.json',
    'json/items/modifiers/bullets/4way.json',
    'json/items/modifiers/bullets/critChance.json',
    'json/items/modifiers/bullets/critDamage.json',
    'json/items/modifiers/bullets/curve.json',
    'json/items/modifiers/bullets/damage.json',
    'json/items/modifiers/bullets/decreasefirerate.json',
    'json/items/modifiers/bullets/explode.json',
    'json/items/modifiers/bullets/freezeChance.json',
    'json/items/modifiers/bullets/freezeDuration.json',
    'json/items/modifiers/bullets/homing.json',
    'json/items/modifiers/bullets/number.json',
    'json/items/modifiers/bullets/pierce.json',
    'json/items/modifiers/bullets/range.json',
    'json/items/modifiers/bullets/recoil.json',
    'json/items/modifiers/bullets/size.json',
    'json/items/modifiers/bullets/speed.json',
    'json/items/modifiers/bullets/spreadrate.json',
    'json/items/modifiers/bullets/wallbounce.json',

    // Inventory - Bombs
    'json/items/inventory/bombs/add.json',
    'json/items/inventory/bombs/add3.json',
    'json/items/inventory/bombs/add5.json',

    // Inventory - Keys
    'json/items/inventory/key/add.json',
    'json/items/inventory/key/add3.json',
    'json/items/inventory/key/add5.json'
];

fileList.forEach(filePath => {
    const fullPath = path.resolve(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const json = JSON.parse(content);

            // Create cleaned object (keep only colour if it exists, maybe name?)
            // User put name in the Reward file.
            // Game.js only reads color.
            const newObj = {};
            if (json.colour) newObj.colour = json.colour;

            fs.writeFileSync(fullPath, JSON.stringify(newObj, null, 4));
            console.log(`Cleaned: ${filePath}`);
        } catch (e) {
            console.error(`Error processing ${filePath}:`, e);
        }
    } else {
        console.warn(`File not found: ${filePath}`);
    }
});
