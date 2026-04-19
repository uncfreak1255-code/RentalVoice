#!/usr/bin/env node

console.error('Rental Voice web is disabled right now.');
console.error('');
console.error('Why: the current Expo web target boots to a white screen before first render.');
console.error('Use the supported iOS contributor path instead:');
console.error('  1. npm run ios');
console.error('  2. npm run start:demo');
console.error('  3. press i if the simulator does not open automatically');
console.error('');
console.error('If you need to debug the broken web target anyway, run: npm run web:debug');
process.exit(1);
