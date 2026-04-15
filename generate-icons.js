// ============================================
// ICON GENERATOR SCRIPT
// ============================================
// Save this file as: generate-icons.js
// Run with: node generate-icons.js
// ============================================

const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Check if sharp is installed
try {
    require.resolve('sharp');
} catch (e) {
    console.log('❌ Sharp is not installed!');
    console.log('📦 Run: npm install sharp');
    console.log('Then run this script again.');
    process.exit(1);
}

const sharp = require('sharp');

// SVG template for the icon
const svgIcon = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="url(#grad)"/>
  
  <!-- Building Icon -->
  <g transform="translate(156, 156)" fill="white">
    <!-- Main Building -->
    <rect x="0" y="60" width="200" height="140" rx="8"/>
    
    <!-- Roof/Top Section -->
    <rect x="30" y="20" width="40" height="40" rx="4"/>
    <rect x="90" y="20" width="40" height="40" rx="4"/>
    <rect x="150" y="20" width="40" height="40" rx="4"/>
    
    <!-- Windows Row 1 -->
    <rect x="30" y="80" width="25" height="35" rx="3" fill="#764ba2"/>
    <rect x="80" y="80" width="25" height="35" rx="3" fill="#764ba2"/>
    <rect x="130" y="80" width="25" height="35" rx="3" fill="#764ba2"/>
    
    <!-- Windows Row 2 -->
    <rect x="30" y="130" width="25" height="35" rx="3" fill="#764ba2"/>
    <rect x="80" y="130" width="25" height="35" rx="3" fill="#764ba2"/>
    <rect x="130" y="130" width="25" height="35" rx="3" fill="#764ba2"/>
    
    <!-- Door -->
    <rect x="75" y="140" width="50" height="60" rx="5" fill="#4a2d6e"/>
  </g>
  
  <!-- Text -->
  <text x="256" y="430" font-family="Arial, Helvetica, sans-serif" 
        font-size="42" font-weight="bold" fill="white" text-anchor="middle">
    Society 360
  </text>
</svg>
`;

// Save SVG file
const svgPath = path.join(iconsDir, 'icon.svg');
fs.writeFileSync(svgPath, svgIcon);
console.log('✅ Created icon.svg');

// Icon sizes to generate
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate icons for each size
async function generateIcons() {
    console.log('\n🎨 Generating PWA icons...\n');
    
    for (const size of sizes) {
        const outputFile = path.join(iconsDir, `icon-${size}x${size}.png`);
        
        await sharp(svgPath)
            .resize(size, size)
            .png()
            .toFile(outputFile);
        
        console.log(`  ✅ Created icon-${size}x${size}.png`);
    }
    
    // Generate maskable icon (with padding for adaptive icons)
    const maskableFile = path.join(iconsDir, 'maskable-icon.png');
    await sharp(svgPath)
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 102, g: 126, b: 234 } // #667eea
        })
        .png()
        .toFile(maskableFile);
    console.log('  ✅ Created maskable-icon.png');
    
    // Generate badge icon (small notification badge)
    const badgeSvg = `
    <svg width="72" height="72" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="34" fill="#667eea"/>
      <circle cx="36" cy="36" r="28" fill="white"/>
      <circle cx="36" cy="36" r="18" fill="#764ba2"/>
    </svg>
    `;
    
    const badgeFile = path.join(iconsDir, 'badge-72x72.png');
    await sharp(Buffer.from(badgeSvg))
        .resize(72, 72)
        .png()
        .toFile(badgeFile);
    console.log('  ✅ Created badge-72x72.png');
    
    // Generate favicon
    const faviconFile = path.join(__dirname, 'favicon.ico');
    await sharp(svgPath)
        .resize(32, 32)
        .toFile(faviconFile);
    console.log('  ✅ Created favicon.ico');
    
    // Generate Apple touch icon
    const appleIconFile = path.join(iconsDir, 'apple-touch-icon.png');
    await sharp(svgPath)
        .resize(180, 180)
        .png()
        .toFile(appleIconFile);
    console.log('  ✅ Created apple-touch-icon.png');
    
    console.log('\n✨ All icons generated successfully!\n');
    console.log('📁 Icons saved in: ' + iconsDir);
}

generateIcons().catch(console.error);