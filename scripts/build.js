#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function run(command, options = {}) {
  try {
    log(`Running: ${command}`, 'cyan');
    const result = execSync(command, { 
      stdio: 'inherit', 
      cwd: process.cwd(),
      ...options 
    });
    return result;
  } catch (error) {
    logError(`Command failed: ${command}`);
    logError(error.message);
    process.exit(1);
  }
}

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    logError(`Required file not found: ${filePath}`);
    return false;
  }
  return true;
}

function checkDependencies() {
  logInfo('Checking dependencies...');
  
  const requiredFiles = [
    'package.json',
    'electron/main.js',
    'electron/preload.js',
    'vite.config.ts',
    'src/main.tsx',
    'index.html'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    if (!checkFile(file)) {
      allFilesExist = false;
    }
  }
  
  if (!allFilesExist) {
    logError('Some required files are missing. Please check the project structure.');
    process.exit(1);
  }
  
  logSuccess('All required files found');
}

function installDependencies() {
  logInfo('Installing dependencies...');
  
  if (fs.existsSync('node_modules')) {
    logWarning('node_modules already exists, skipping installation');
    return;
  }
  
  if (fs.existsSync('pnpm-lock.yaml')) {
    run('pnpm install');
  } else if (fs.existsSync('yarn.lock')) {
    run('yarn install');
  } else {
    run('npm install');
  }
  
  logSuccess('Dependencies installed');
}

function buildApp() {
  logInfo('Building React app...');
  
  // Clean previous builds
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  if (fs.existsSync('dist-electron')) {
    fs.rmSync('dist-electron', { recursive: true, force: true });
  }
  
  if (fs.existsSync('pnpm-lock.yaml')) {
    run('pnpm build');
  } else if (fs.existsSync('yarn.lock')) {
    run('yarn build');
  } else {
    run('npm run build');
  }
  
  logSuccess('React app built successfully');
}

function buildElectron() {
  logInfo('Building Electron app...');
  
  // Check if dist folder exists
  if (!fs.existsSync('dist')) {
    logError('dist folder not found. Please run build first.');
    process.exit(1);
  }
  
  if (fs.existsSync('pnpm-lock.yaml')) {
    run('pnpm electron-build');
  } else if (fs.existsSync('yarn.lock')) {
    run('yarn electron-build');
  } else {
    run('npm run electron-build');
  }
  
  logSuccess('Electron app built successfully');
}

function devMode() {
  logInfo('Starting development server...');
  
  if (fs.existsSync('pnpm-lock.yaml')) {
    run('pnpm electron-dev');
  } else if (fs.existsSync('yarn.lock')) {
    run('yarn electron-dev');
  } else {
    run('npm run electron-dev');
  }
}

function generateIcon() {
  logInfo('Generating app icons...');
  
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.svg');
  if (!fs.existsSync(iconPath)) {
    logWarning('SVG icon not found, using default icon');
    return;
  }
  
  // Create different icon sizes for macOS
  const sizes = [16, 32, 128, 256, 512];
  const iconsDir = path.join(__dirname, '..', 'assets', 'icons');
  
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  // For now, just copy the SVG as different sizes
  // In a real implementation, you'd use a tool like sharp to convert SVG to different PNG sizes
  for (const size of sizes) {
    const targetPath = path.join(iconsDir, `icon-${size}.png`);
    logInfo(`Would generate ${size}x${size} icon at ${targetPath}`);
  }
  
  logSuccess('Icon generation completed (placeholder)');
}

function printHelp() {
  log(`
${colors.bright}Prompt IDE Build Script${colors.reset}

Usage: node scripts/build.js [command]

Commands:
  ${colors.green}check${colors.reset}       Check project structure and dependencies
  ${colors.green}install${colors.reset}     Install dependencies
  ${colors.green}build${colors.reset}       Build React app for production
  ${colors.green}electron${colors.reset}    Build Electron app
  ${colors.green}dev${colors.reset}         Start development server
  ${colors.green}icon${colors.reset}        Generate app icons
  ${colors.green}all${colors.reset}         Run complete build process
  ${colors.green}help${colors.reset}        Show this help message

Examples:
  node scripts/build.js check
  node scripts/build.js all
  node scripts/build.js dev
  `, 'cyan');
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'check':
    checkDependencies();
    break;
  case 'install':
    installDependencies();
    break;
  case 'build':
    buildApp();
    break;
  case 'electron':
    buildElectron();
    break;
  case 'dev':
    devMode();
    break;
  case 'icon':
    generateIcon();
    break;
  case 'all':
    checkDependencies();
    installDependencies();
    generateIcon();
    buildApp();
    buildElectron();
    logSuccess('Complete build process finished!');
    break;
  case 'help':
  default:
    printHelp();
    break;
} 