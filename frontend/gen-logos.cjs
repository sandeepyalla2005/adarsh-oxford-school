const fs = require('fs');
const path = require('path');
const root = 'c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/frontend';
try {
  const red = fs.readFileSync(path.join(root, 'public/school-name-logo-red.png')).toString('base64');
  const yellow = fs.readFileSync(path.join(root, 'public/school-name-logo-yellow.png')).toString('base64');
  const content = `export const RED_LOGO_B64 = "data:image/png;base64,${red}";\nexport const YELLOW_LOGO_B64 = "data:image/png;base64,${yellow}";`;
  fs.writeFileSync(path.join(root, 'src/lib/logos.ts'), content);
  console.log('Successfully created logos.ts');
} catch (err) {
  console.error('Error creating logos.ts:', err);
}
