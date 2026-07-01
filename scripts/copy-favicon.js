const fs = require('fs');
const path = require('path');

const sourcePath = path.join(process.cwd(), 'public', 'images', '14446129.png');
const destPath = path.join(process.cwd(), 'public', 'favicon.ico');

try {
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log('✓ Copied 14446129.png to favicon.ico');
  } else {
    console.warn('⚠ Warning: 14446129.png not found, skipping favicon copy');
  }
} catch (error) {
  console.error('Error copying favicon:', error);
  process.exit(1);
}
