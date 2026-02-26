import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const svgContent = readFileSync(join(rootDir, 'public', 'logo.svg'), 'utf8');

// Output configurations
const outputs = [
  // Web/PWA
  { path: 'public/logoapp.png', size: 512 },

  // Android drawable (for splash screen)
  { path: 'android/app/src/main/res/drawable/logoapp.png', size: 432 },

  // Android mipmap icons (app launcher)
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', size: 48 },
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png', size: 48 },
  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', size: 72 },
  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png', size: 72 },
  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', size: 96 },
  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', size: 96 },
  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', size: 144 },
  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png', size: 144 },
  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', size: 192 },
  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png', size: 192 },
];

async function generateLogos() {
  console.log('Generating logo images...\n');

  for (const output of outputs) {
    const fullPath = join(rootDir, output.path);

    // Ensure directory exists
    mkdirSync(dirname(fullPath), { recursive: true });

    await sharp(Buffer.from(svgContent))
      .resize(output.size, output.size)
      .png()
      .toFile(fullPath);

    console.log(`Generated: ${output.path} (${output.size}x${output.size})`);
  }

  // Also copy to root for backward compatibility
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(join(rootDir, 'logoapp.png'));

  console.log('\nGenerated: logoapp.png (512x512) - root');
  console.log('\nAll logos generated successfully!');
}

generateLogos().catch(console.error);
