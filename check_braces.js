const fs = require('fs');
const file = 'assets/js/modules/Entities.js';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const startLine = parseInt(process.argv[2]) || 0;
// Note: startLine is 0-indexed logic here, but argv input is likely 1-indexed? 
// Let's assume input is 0-indexed or adjust logic. 
// "1878" in input means line 1878 (1-indexed) -> index 1877.
// I'll subtract 1 from args if I use index-based loop.
const startIdx = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
const endIdx = process.argv[3] ? parseInt(process.argv[3]) - 1 : lines.length;

let balance = 0;
// Calculate initial balance up to startIdx if needed? 
// Or just start from 0 and look for logic errors relative to start?
// If I start inside a function, balance starts at X. I don't know X.
// So I should scan from 0 but only PRINT from startIdx.
// OR, scan whole file and filter logging.

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignore comments
    const cleanLine = line.split('//')[0];

    // Check balance update
    let lineBalanceChange = 0;
    for (let char of cleanLine) {
        if (char === '{') lineBalanceChange++;
        if (char === '}') lineBalanceChange--;
    }

    // Log BEFORE update if meaningful? Or AFTER?
    // User wants to know brace count at start of line?

    if (i >= startIdx && i < endIdx) {
        if (line.includes('export function') || line.includes('function ')) {
            console.log(`Line ${i + 1} (Start: ${balance}): ${line.trim()}`);
        }
    }

    balance += lineBalanceChange;

    if (balance < 0) {
        if (i >= startIdx && i < endIdx) console.log(`Balance went negative at line ${i + 1}: ${line.trim()}`);
        // process.exit(1);
    }
}
console.log(`Final balance: ${balance}`);
