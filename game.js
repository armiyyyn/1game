// Avdeev's Universe - Completely rebuilt for reliability

const GAME = { width: () => window.innerWidth, height: () => window.innerHeight };

// Global state
let game;
let player;
let platforms, spikes, finishLine, movingPlatforms = [];
let cursors, wasd;
let levelIndex = 0, totalLevels = 10;
let burgerScore = 0; // Track collected burgers
let levelBurgerScore = 0; // Burgers collected in current level attempt
let levelEl, burgerEl;
let hasDoubleJumped = false;
let timeLeftGround = 0; // Track time since leaving ground for better double jump
let particleEmitters = [];
let backgroundMusic = null;
let musicEnabled = true;
let burgers; // Group for collectible burgers

const playerConfig = { 
  hairColor: 0x5D4037, // brown, red, green, or 'bald'
  kimonoColor: 0xFFFFFF, // white or blue
  beltColor: 0xD32F2F // white, yellow, orange, green, blue, brown, black (judo belts)
};

// Phaser config
const config = {
  type: Phaser.AUTO,
  width: GAME.width(),
  height: GAME.height(),
  parent: 'game-container',
  backgroundColor: '#0d0a1a',
  physics: { default: 'arcade', arcade: { gravity: { y: 1200 }, debug: false } },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: { preload, create, update }
};

function startGame() {
  if (!window.Phaser) { console.error('Phaser not loaded'); return; }
  if (game) { try { game.destroy(true); } catch(e){} game = null; }
  levelIndex = 0;
  burgerScore = 0; // Reset burger score
  levelBurgerScore = 0; // Reset level burger score
  game = new Phaser.Game(config);
  
  // Start HTML5 audio music
  const audioElement = document.getElementById('background-music');
  if(audioElement && musicEnabled){
    audioElement.volume = 0.8; // 80% volume
    audioElement.play().catch(e => console.log('Music autoplay blocked:', e));
  }
}

// UI wiring
document.addEventListener('DOMContentLoaded', () => {
  const mainMenu = document.getElementById('main-menu');
  const settingsMenu = document.getElementById('settings-menu');
  const characterMenu = document.getElementById('character-menu');
  const startGameBtn = document.getElementById('start-game-btn');
  const gameHud = document.getElementById('game-hud');
  const playBtn = document.getElementById('play-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const backBtn = document.getElementById('back-btn');
  const restartBtn = document.getElementById('restart-btn');
  const menuBtn = document.getElementById('menu-btn');
  const exitBtn = document.getElementById('exit-btn');
  const brightnessSlider = document.getElementById('brightness-slider');
  const brightnessValue = document.getElementById('brightness-value');
  const congratsScreen = document.getElementById('congrats-screen');
  const playAgainBtn = document.getElementById('play-again-btn');
  const backToMenuBtn = document.getElementById('back-to-menu-btn');
  const finalScoreEl = document.getElementById('final-score');

  levelEl = document.getElementById('level');
  burgerEl = document.getElementById('burger-score');

  function hideAllMenus(){
    if(mainMenu) mainMenu.classList.remove('active');
    if(settingsMenu) settingsMenu.classList.remove('active');
    if(characterMenu) characterMenu.classList.remove('active');
    if(congratsScreen) congratsScreen.classList.remove('active');
  }

  // Character customization
  const hairBoxes = document.querySelectorAll('.color-box[data-hair]');
  hairBoxes.forEach(b => b.addEventListener('click', () => {
    hairBoxes.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const hairValue = b.dataset.hair;
    playerConfig.hairColor = hairValue === 'bald' ? 'bald' : parseInt(hairValue.replace('#','0x'));
  }));
  
  const kimonoBoxes = document.querySelectorAll('.kimono-box');
  kimonoBoxes.forEach(b => b.addEventListener('click', () => {
    kimonoBoxes.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    playerConfig.kimonoColor = parseInt(b.dataset.kimono.replace('#','0x'));
  }));
  
  const beltBoxes = document.querySelectorAll('.belt-box');
  beltBoxes.forEach(b => b.addEventListener('click', () => {
    beltBoxes.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    playerConfig.beltColor = parseInt(b.dataset.belt.replace('#','0x'));
  }));
  
  // Music toggle
  const musicToggle = document.getElementById('music-toggle');
  const audioElement = document.getElementById('background-music');
  
  if(musicToggle) musicToggle.addEventListener('change', e => {
    musicEnabled = e.target.checked;
    if(audioElement){
      if(musicEnabled){
        audioElement.play();
      } else {
        audioElement.pause();
      }
    }
  });

  // Menus
  if (playBtn) playBtn.addEventListener('click', () => { hideAllMenus(); if(characterMenu) characterMenu.classList.add('active'); });
  if (startGameBtn) startGameBtn.addEventListener('click', () => { hideAllMenus(); if(gameHud) gameHud.classList.remove('hidden'); startGame(); });
  if (settingsBtn) settingsBtn.addEventListener('click', () => { hideAllMenus(); if(settingsMenu) settingsMenu.classList.add('active'); });
  if (backBtn) backBtn.addEventListener('click', () => { hideAllMenus(); if(mainMenu) mainMenu.classList.add('active'); });
  if (restartBtn) restartBtn.addEventListener('click', () => { if(game && game.scene.scenes[0]) game.scene.scenes[0].scene.restart(); });
  if (menuBtn) menuBtn.addEventListener('click', () => { hideAllMenus(); if(mainMenu) mainMenu.classList.add('active'); if(gameHud) gameHud.classList.add('hidden'); if(game&&game.scene.scenes[0]) game.scene.scenes[0].scene.pause(); });
  if (exitBtn) exitBtn.addEventListener('click', () => { hideAllMenus(); if(mainMenu) mainMenu.classList.add('active'); if(gameHud) gameHud.classList.add('hidden'); if(game&&game.scene.scenes[0]) game.scene.scenes[0].scene.pause(); });
  if (playAgainBtn) playAgainBtn.addEventListener('click', () => { hideAllMenus(); if(gameHud) gameHud.classList.remove('hidden'); startGame(); });
  if (backToMenuBtn) backToMenuBtn.addEventListener('click', () => { hideAllMenus(); if(mainMenu) mainMenu.classList.add('active'); });

  if (brightnessSlider) brightnessSlider.addEventListener('input', e => { const v = e.target.value; if(brightnessValue) brightnessValue.textContent = v+'%'; document.body.style.filter = `brightness(${v}%)`; });
  
  // Draw Avdeev avatar on main menu
  const avatarCanvas = document.getElementById('avdeev-avatar');
  if(avatarCanvas) {
    const ctx = avatarCanvas.getContext('2d');
    const scale = 3; // 3x scale for full height menu avatar
    
    // Brown hair
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(13*scale, 0, 20*scale, 9*scale);
    ctx.fillRect(10*scale, 2*scale, 5*scale, 7*scale);
    ctx.fillRect(30*scale, 2*scale, 5*scale, 7*scale);
    
    // Head
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(13*scale, 7*scale, 20*scale, 14*scale);
    
    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(18*scale, 13*scale, 3*scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(28*scale, 13*scale, 3*scale, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(18*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(28*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyebrows
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(16*scale, 10*scale, 5*scale, 1.5*scale);
    ctx.fillRect(26*scale, 10*scale, 5*scale, 1.5*scale);
    
    // Mouth (smile - shorter)
    ctx.fillStyle = '#000000';
    ctx.fillRect(19*scale, 18*scale, 8*scale, 1.5*scale); // Shorter smile line (8px instead of 10px)
    ctx.fillRect(18*scale, 16.5*scale, 1.5*scale, 1.5*scale); // Left corner ABOVE
    ctx.fillRect(26.5*scale, 16.5*scale, 1.5*scale, 1.5*scale); // Right corner ABOVE
    
    // White Kimono
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(10*scale, 21*scale, 25*scale, 18*scale);
    ctx.fillRect(5*scale, 23*scale, 7*scale, 13*scale);
    ctx.fillRect(33*scale, 23*scale, 7*scale, 13*scale);
    
    // V-neck
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath();
    ctx.moveTo(22*scale, 21*scale);
    ctx.lineTo(18*scale, 28*scale);
    ctx.lineTo(27*scale, 28*scale);
    ctx.closePath();
    ctx.fill();
    
    // Black Belt
    ctx.fillStyle = '#000000';
    ctx.fillRect(10*scale, 35*scale, 25*scale, 4*scale);
    
    // White judogi pants
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(14*scale, 39*scale, 6*scale, 10*scale);
    ctx.fillRect(25*scale, 39*scale, 6*scale, 10*scale);
    
    // Legs
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(14*scale, 49*scale, 6*scale, 3*scale);
    ctx.fillRect(25*scale, 49*scale, 6*scale, 3*scale);
  }
  
  // Draw burger on main menu
  const burgerCanvas = document.getElementById('menu-burger');
  if(burgerCanvas) {
    const ctx2 = burgerCanvas.getContext('2d');
    
    // Top bun (smoother, matches bottom bun shape)
    ctx2.fillStyle = '#8B5A3C';
    ctx2.fillRect(28, 8, 45, 4); // Rounded top edge
    ctx2.fillRect(25, 12, 50, 8); // Main top bun
    
    // Sesame seeds
    ctx2.fillStyle = '#FFD700';
    ctx2.fillRect(33, 9, 4, 4);
    ctx2.fillRect(45, 8, 4, 4);
    ctx2.fillRect(58, 9, 4, 4);
    
    // Sparkles
    ctx2.fillStyle = '#FFFFFF';
    ctx2.fillRect(34, 9, 1, 1);
    ctx2.fillRect(46, 8, 1, 1);
    
    // Lettuce (right below bun, no gap)
    ctx2.fillStyle = '#7FD17F';
    ctx2.fillRect(20, 20, 60, 9);
    
    // Meat
    ctx2.fillStyle = '#8B4513';
    ctx2.fillRect(20, 29, 60, 11);
    
    // Grill marks
    ctx2.fillStyle = '#654321';
    ctx2.fillRect(28, 29, 3, 11);
    ctx2.fillRect(40, 29, 3, 11);
    ctx2.fillRect(53, 29, 3, 11);
    ctx2.fillRect(65, 29, 3, 11);
    
    // Tomato
    ctx2.fillStyle = '#FF4444';
    ctx2.fillRect(20, 40, 60, 9);
    
    // Bottom bun (matches top bun shape)
    ctx2.fillStyle = '#8B5A3C';
    ctx2.fillRect(25, 49, 50, 8); // Main bottom bun
    ctx2.fillRect(28, 57, 45, 4); // Rounded bottom edge (same as top)
  }
  
  // Draw Coke bottle on main menu
  const cokeCanvas = document.getElementById('menu-coke');
  if(cokeCanvas) {
    const ctx3 = cokeCanvas.getContext('2d');
    
    // Bottle cap (red)
    ctx3.fillStyle = '#D32F2F';
    ctx3.fillRect(18, 5, 24, 8);
    ctx3.fillRect(20, 0, 20, 5);
    
    // Cap ridges (darker red)
    ctx3.fillStyle = '#B71C1C';
    ctx3.fillRect(20, 2, 2, 3);
    ctx3.fillRect(24, 2, 2, 3);
    ctx3.fillRect(28, 2, 2, 3);
    ctx3.fillRect(32, 2, 2, 3);
    ctx3.fillRect(36, 2, 2, 3);
    
    // Bottle neck
    ctx3.fillStyle = '#8B4513';
    ctx3.fillRect(22, 13, 16, 15);
    
    // Main bottle body (brown glass)
    ctx3.fillStyle = '#6D4C41';
    ctx3.fillRect(15, 28, 30, 70);
    
    // Coke label (red with white text area)
    ctx3.fillStyle = '#D32F2F';
    ctx3.fillRect(15, 45, 30, 25);
    
    // Label highlight/text area
    ctx3.fillStyle = '#FFFFFF';
    ctx3.fillRect(18, 52, 24, 10);
    
    // Coca-Cola wave (red)
    ctx3.fillStyle = '#D32F2F';
    ctx3.beginPath();
    ctx3.moveTo(18, 57);
    ctx3.quadraticCurveTo(25, 54, 30, 57);
    ctx3.quadraticCurveTo(35, 60, 42, 57);
    ctx3.lineTo(42, 62);
    ctx3.lineTo(18, 62);
    ctx3.closePath();
    ctx3.fill();
    
    // Bottle reflection (white highlight)
    ctx3.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx3.fillRect(17, 30, 4, 40);
    
    // Bottom of bottle
    ctx3.fillStyle = '#5D4037';
    ctx3.fillRect(15, 98, 30, 10);
    ctx3.fillRect(18, 108, 24, 4);
  }
  
  // Draw Pizza slice on main menu
  const pizzaCanvas = document.getElementById('menu-pizza');
  if(pizzaCanvas) {
    const ctx4 = pizzaCanvas.getContext('2d');
    
    // Pizza crust (golden brown triangle)
    ctx4.fillStyle = '#D4A574';
    ctx4.beginPath();
    ctx4.moveTo(50, 10);
    ctx4.lineTo(10, 90);
    ctx4.lineTo(90, 90);
    ctx4.closePath();
    ctx4.fill();
    
    // Pizza sauce/cheese (yellow-orange)
    ctx4.fillStyle = '#FDB813';
    ctx4.beginPath();
    ctx4.moveTo(50, 20);
    ctx4.lineTo(18, 82);
    ctx4.lineTo(82, 82);
    ctx4.closePath();
    ctx4.fill();
    
    // Pepperoni slices (red circles)
    ctx4.fillStyle = '#C1440E';
    ctx4.beginPath();
    ctx4.arc(50, 35, 8, 0, Math.PI * 2);
    ctx4.fill();
    ctx4.beginPath();
    ctx4.arc(40, 55, 7, 0, Math.PI * 2);
    ctx4.fill();
    ctx4.beginPath();
    ctx4.arc(60, 55, 7, 0, Math.PI * 2);
    ctx4.fill();
    ctx4.beginPath();
    ctx4.arc(35, 70, 6, 0, Math.PI * 2);
    ctx4.fill();
    ctx4.beginPath();
    ctx4.arc(65, 70, 6, 0, Math.PI * 2);
    ctx4.fill();
    
    // Pepperoni highlights
    ctx4.fillStyle = '#A03C0B';
    ctx4.fillRect(48, 33, 3, 3);
    ctx4.fillRect(39, 54, 2, 2);
    ctx4.fillRect(59, 54, 2, 2);
    
    // Cheese strings
    ctx4.strokeStyle = '#FFE082';
    ctx4.lineWidth = 2;
    ctx4.beginPath();
    ctx4.moveTo(45, 75);
    ctx4.lineTo(48, 82);
    ctx4.stroke();
    ctx4.beginPath();
    ctx4.moveTo(55, 75);
    ctx4.lineTo(52, 82);
    ctx4.stroke();
  }
  
  // Draw Phone on main menu (bigger - 50x70)
  const phoneCanvas = document.getElementById('menu-phone');
  if(phoneCanvas) {
    const ctx5 = phoneCanvas.getContext('2d');
    
    // Phone body (black/dark gray)
    ctx5.fillStyle = '#212121';
    ctx5.fillRect(7, 3.5, 36, 63);
    ctx5.fillRect(8.5, 2, 33, 66);
    
    // Phone screen (light blue/cyan)
    ctx5.fillStyle = '#4FC3F7';
    ctx5.fillRect(11, 10.5, 28, 42);
    
    // Screen icons/notifications
    ctx5.fillStyle = '#FFFFFF';
    ctx5.fillRect(14, 14, 5.5, 5.5);
    ctx5.fillRect(22.5, 14, 5.5, 5.5);
    ctx5.fillRect(31, 14, 5.5, 5.5);
    ctx5.fillRect(14, 24.5, 8.5, 8.5);
    ctx5.fillRect(25.5, 24.5, 8.5, 8.5);
    
    // App icons (colorful)
    ctx5.fillStyle = '#FF5252';
    ctx5.fillRect(14, 36.5, 7, 7);
    ctx5.fillStyle = '#4CAF50';
    ctx5.fillRect(24, 36.5, 7, 7);
    ctx5.fillStyle = '#FFC107';
    ctx5.fillRect(14, 45.5, 7, 7);
    ctx5.fillStyle = '#2196F3';
    ctx5.fillRect(24, 45.5, 7, 7);
    
    // Home button
    ctx5.fillStyle = '#424242';
    ctx5.beginPath();
    ctx5.arc(25, 59.5, 5.5, 0, Math.PI * 2);
    ctx5.fill();
    
    // Camera at top
    ctx5.fillStyle = '#1565C0';
    ctx5.beginPath();
    ctx5.arc(25, 7, 2, 0, Math.PI * 2);
    ctx5.fill();
  }
  
  // Draw Avdeev's Dad (fat, bald, angry)
  const dadCanvas = document.getElementById('avdeev-dad');
  if(dadCanvas) {
    const ctx6 = dadCanvas.getContext('2d');
    const scale = 3;
    
    // Bald head (larger, rounder)
    ctx6.fillStyle = '#FFDBAC';
    ctx6.fillRect(13*scale, 5*scale, 24*scale, 18*scale); // Wider head
    ctx6.fillRect(10*scale, 8*scale, 30*scale, 15*scale); // Extra wide
    
    // Angry eyes (smaller, mean-looking)
    ctx6.fillStyle = '#FFFFFF';
    ctx6.beginPath();
    ctx6.arc(18*scale, 14*scale, 2.5*scale, 0, Math.PI * 2);
    ctx6.fill();
    ctx6.beginPath();
    ctx6.arc(32*scale, 14*scale, 2.5*scale, 0, Math.PI * 2);
    ctx6.fill();
    
    ctx6.fillStyle = '#000000';
    ctx6.beginPath();
    ctx6.arc(18*scale, 14*scale, 1.2*scale, 0, Math.PI * 2);
    ctx6.fill();
    ctx6.beginPath();
    ctx6.arc(32*scale, 14*scale, 1.2*scale, 0, Math.PI * 2);
    ctx6.fill();
    
    // Smaller eyebrows (normal, not angry)
    ctx6.fillStyle = '#3E2723';
    ctx6.fillRect(16*scale, 11*scale, 4*scale, 1.5*scale);
    ctx6.fillRect(30*scale, 11*scale, 4*scale, 1.5*scale);
    
    // Happy smile (corners above main line)
    ctx6.fillStyle = '#000000';
    ctx6.fillRect(20*scale, 19*scale, 10*scale, 1.5*scale); // Main smile line
    ctx6.fillRect(19*scale, 17.5*scale, 1.5*scale, 1.5*scale); // Left corner ABOVE
    ctx6.fillRect(29.5*scale, 17.5*scale, 1.5*scale, 1.5*scale); // Right corner ABOVE
    
    // Fat neck (double chin) - rounded
    ctx6.fillStyle = '#FFDBAC';
    ctx6.beginPath();
    ctx6.arc(25*scale, 23*scale, 10*scale, 0, Math.PI);
    ctx6.fill();
    ctx6.fillRect(15*scale, 23*scale, 20*scale, 6*scale);
    
    // Neck crease (double chin line)
    ctx6.strokeStyle = '#E0C097';
    ctx6.lineWidth = 1.5;
    ctx6.beginPath();
    ctx6.moveTo(15*scale, 27*scale);
    ctx6.lineTo(35*scale, 27*scale);
    ctx6.stroke();
    
    // Fat body (white t-shirt, very wide) - smoother with rounded corners
    ctx6.fillStyle = '#FFFFFF';
    
    // Main body with rounded top corners
    ctx6.beginPath();
    ctx6.arc(12*scale, 32*scale, 4*scale, Math.PI, Math.PI * 1.5); // Top left corner
    ctx6.arc(38*scale, 32*scale, 4*scale, Math.PI * 1.5, 0); // Top right corner
    ctx6.lineTo(42*scale, 49*scale);
    ctx6.lineTo(8*scale, 49*scale);
    ctx6.closePath();
    ctx6.fill();
    
    // Left arm RAISED (waving) - rotated 8 degrees to the left
    ctx6.save(); // Save current state
    ctx6.translate(7*scale, 27*scale); // Move to arm base
    ctx6.rotate(-8 * Math.PI / 180); // Rotate -8 degrees (left)
    
    ctx6.beginPath();
    ctx6.arc(0, -5*scale, 4*scale, 0, Math.PI * 2); // Hand at top (raised up)
    ctx6.fill();
    ctx6.fillRect(-4*scale, -5*scale, 8*scale, 10*scale); // Arm
    
    ctx6.restore(); // Restore to normal state
    
    // Right arm (normal, down)
    ctx6.beginPath();
    ctx6.arc(43*scale, 39*scale, 4*scale, 0, Math.PI * 2); // Right arm rounded end
    ctx6.fill();
    ctx6.fillRect(39*scale, 32*scale, 8*scale, 15*scale); // Right arm
    
    // Belt (struggling to hold belly)
    ctx6.fillStyle = '#5D4037';
    ctx6.fillRect(8*scale, 45*scale, 34*scale, 4*scale);
    
    // Belt buckle
    ctx6.fillStyle = '#FFD700';
    ctx6.fillRect(23*scale, 44*scale, 4*scale, 6*scale);
    
    // Dark pants
    ctx6.fillStyle = '#424242';
    ctx6.fillRect(12*scale, 49*scale, 12*scale, 10*scale);
    ctx6.fillRect(26*scale, 49*scale, 12*scale, 10*scale);
  }
});

function preload(){
  // No external assets needed - burger created with graphics
}

function create(){
  const w = this.scale.width;
  const h = this.scale.height;
  
  // Reset state
  hasDoubleJumped = false;
  movingPlatforms = [];
  levelBurgerScore = 0; // Reset burgers for this level attempt
  
  // Create burgers group
  burgers = this.physics.add.staticGroup();
  
  // Enhanced background
  this.add.rectangle(w/2, h/2, w, h, 0x1b1336);
  
  // Stars
  for(let i=0; i<200; i++){
    const x = Phaser.Math.Between(0, w);
    const y = Phaser.Math.Between(0, h);
    const size = Phaser.Math.Between(1, 3);
    this.add.circle(x, y, size, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9));
  }
  
  // Glowing moon in corner (top left, away from finish)
  const moonX = w * 0.15, moonY = h * 0.12;
  this.add.circle(moonX, moonY, 50, 0xe8e8e8, 1);
  this.add.circle(moonX - 10, moonY - 8, 12, 0xd0d0d0, 0.6); // crater
  this.add.circle(moonX + 8, moonY + 6, 8, 0xd0d0d0, 0.5); // crater
  
  // Falling meteorites
  for(let i=0; i<5; i++){
    const mx = Phaser.Math.Between(0, w);
    const my = Phaser.Math.Between(0, h * 0.6);
    const gfx = this.add.graphics();
    gfx.lineStyle(2, 0xff6b6b, 0.7);
    gfx.lineBetween(mx, my, mx + 30, my + 30);
    gfx.fillStyle(0xffaa00, 0.9);
    gfx.fillCircle(mx, my, 4);
  }
  
  // Create platforms group
  platforms = this.physics.add.staticGroup();
  
  // Build level based on levelIndex
  buildLevelLayout(this, levelIndex);
  
  // Create Avdeev with accessories (10% smaller - 45x54 for better proportions)
  // Spawn above the platform so he stands on top of it
  player = this.physics.add.sprite(150, h-110, null);
  player.setDisplaySize(45, 54);
  player.setBounce(0.1);
  player.setCollideWorldBounds(true);
  player.setDrag(0, 0); // No drag - instant speed
  player.setMaxVelocity(280, 1200); // Cap at movement speed
  
  // Draw Avdeev as detailed pixel boy with judogi (canvas - 45x54)
  const gfx = this.add.graphics();
  
  // Brown hair on top (if not bald)
  if(playerConfig.hairColor !== 'bald'){
    gfx.fillStyle(playerConfig.hairColor, 1);
    gfx.fillRect(13, 0, 20, 9); // Hair
    gfx.fillRect(10, 2, 5, 7); // Left hair tuft
    gfx.fillRect(30, 2, 5, 7); // Right hair tuft
  }
  
  // Head (skin tone)
  gfx.fillStyle(0xFFDBAC, 1); // Light skin
  gfx.fillRect(13, 7, 20, 14); // Head
  
  // Eyes - realistic with white eyeballs and black pupils (moved higher)
  gfx.fillStyle(0xFFFFFF, 1); // White eyeballs
  gfx.fillCircle(18, 13, 3); // Left eyeball (moved up from 15 to 13)
  gfx.fillCircle(28, 13, 3); // Right eyeball (moved up from 15 to 13)
  
  gfx.fillStyle(0x000000, 1); // Black pupils
  gfx.fillCircle(18, 13, 1.5); // Left pupil
  gfx.fillCircle(28, 13, 1.5); // Right pupil
  
  // Eyebrows (small, dark brown, above eyes)
  gfx.fillStyle(0x3E2723, 1); // Dark brown/black
  gfx.fillRect(16, 10, 5, 1.5); // Left eyebrow
  gfx.fillRect(26, 10, 5, 1.5); // Right eyebrow
  
  // Mouth (small smile)
  gfx.fillStyle(0x000000, 1); // Black
  gfx.fillRect(20, 17, 6, 1); // Mouth line
  gfx.fillRect(19, 18, 1, 1); // Left corner
  gfx.fillRect(26, 18, 1, 1); // Right corner
  
  // Judogi top with V-neck opening (kimono)
  gfx.fillStyle(playerConfig.kimonoColor, 1);
  gfx.fillRect(10, 21, 25, 18); // Main body
  gfx.fillRect(5, 23, 7, 13); // Left sleeve
  gfx.fillRect(33, 23, 7, 13); // Right sleeve
  
  // V-neck chest opening (skin showing through)
  gfx.fillStyle(0xFFDBAC, 1); // Skin tone
  gfx.fillTriangle(22, 21, 18, 28, 27, 28); // V-shaped chest opening
  
  // Kimono collar lines (darker outline)
  gfx.lineStyle(1, 0xCCCCCC, 1);
  gfx.beginPath();
  gfx.moveTo(18, 21);
  gfx.lineTo(22, 21);
  gfx.lineTo(18, 28);
  gfx.strokePath();
  
  gfx.beginPath();
  gfx.moveTo(27, 21);
  gfx.lineTo(22, 21);
  gfx.lineTo(27, 28);
  gfx.strokePath();
  
  // Belt (obi) - judo belt colors (thinner)
  gfx.fillStyle(playerConfig.beltColor, 1);
  gfx.fillRect(10, 35, 25, 4); // Belt across waist (thinner - 4px instead of 6px)
  
  // White judogi pants
  gfx.fillStyle(playerConfig.kimonoColor, 1);
  gfx.fillRect(14, 39, 6, 10); // Left pant leg
  gfx.fillRect(25, 39, 6, 10); // Right pant leg
  
  // Realistic naked legs below pants (skin tone with knees)
  gfx.fillStyle(0xFFDBAC, 1);
  gfx.fillRect(14, 49, 6, 3); // Left lower leg (shin)
  gfx.fillRect(25, 49, 6, 3); // Right lower leg (shin)
  
  // Realistic feet (full foot shape)
  gfx.fillStyle(0xFFDBAC, 1); // Skin tone for feet
  // Left foot
  gfx.fillRect(13, 51, 7, 3); // Foot base
  gfx.fillCircle(13, 52, 1.5); // Heel roundness
  gfx.fillRect(17, 51, 3, 2); // Toes
  
  // Right foot
  gfx.fillRect(25, 51, 7, 3); // Foot base
  gfx.fillCircle(25, 52, 1.5); // Heel roundness
  gfx.fillRect(29, 51, 3, 2); // Toes
  
  gfx.generateTexture('avdeev', 45, 54);
  gfx.destroy();
  player.setTexture('avdeev');
  
  // Fix collision box so Avdeev stands properly on platforms (not sinking)
  player.body.setSize(30, 50); // Smaller collision box
  player.body.setOffset(7, 4); // Offset to align feet with platform
  
  // Controls
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({up:'W', left:'A', right:'D'});
  
  // Collisions
  this.physics.add.collider(player, platforms, (p, platform) => {
    if(platform.isTrampoline){
      player.setVelocityY(-700);
      hasDoubleJumped = false;
    } else if(platform.isDeadly){
      // Die on spike contact
      respawnPlayer(this);
    }
  });
  movingPlatforms.forEach(mp => this.physics.add.collider(player, mp));
  this.physics.add.overlap(player, finishLine, ()=>nextLevel(this));
  
  // Burger collection
  this.physics.add.overlap(player, burgers, (player, burger) => {
    burger.destroy();
    burgerScore++;
    levelBurgerScore++; // Track burgers in current level
    if(burgerEl) burgerEl.textContent = '🍔 ' + burgerScore;
  });
  
  // Deadly spike floor at bottom - covers entire width
  const spikeFloorY = h - 15;
  const spikeWidth = 30;
  const numSpikes = Math.ceil(w / spikeWidth) + 2;
  
  for(let i = 0; i < numSpikes; i++){
    const sx = i * spikeWidth;
    const spikeGfx = this.add.graphics();
    spikeGfx.fillStyle(0xFF0000, 1);
    spikeGfx.fillTriangle(sx, h, sx + 15, h - 20, sx + 30, h);
    
    const floorSpike = this.add.rectangle(sx + 15, spikeFloorY, 30, 30, 0xFF0000, 0);
    this.physics.add.existing(floorSpike, true);
    floorSpike.isDeadly = true;
    platforms.add(floorSpike);
  }
  
  // Failsafe floor trigger below spikes
  const floor = this.add.rectangle(w/2, h + 20, w * 2, 40, 0x000000, 0);
  this.physics.add.existing(floor, true);
  this.physics.add.overlap(player, floor, () => {
    console.log('Floor hit - respawning');
    respawnPlayer(this);
  });
  
  // HUD
  if(levelEl) levelEl.textContent = 'Level: '+(levelIndex+1);
  
  // Add help sign on level 1 only - positioned at edge of starting platform
  if(levelIndex === 0){
    const signX = 230; // At the edge of starting platform (150 + 140/2 = 220, plus some margin)
    const signY = h - 90; // Just above the platform
    
    // Wooden sign (bigger and better colored)
    const signGfx = this.add.graphics();
    signGfx.fillStyle(0x6D4C41, 1); // Darker brown post
    signGfx.fillRect(signX-2.5, signY, 5, 35); // Thicker post
    
    // Sign board (bigger, more visible)
    signGfx.fillStyle(0xF4A460, 1); // Sandy brown (more visible)
    signGfx.fillRect(signX-75, signY-30, 150, 45);
    
    // Border
    signGfx.lineStyle(3, 0x4E342E, 1); // Dark brown border
    signGfx.strokeRect(signX-75, signY-30, 150, 45);
    
    // Text (bigger font)
    const helpText = this.add.text(signX, signY-8, 'Help Avdeev get to\nthe training on time!', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#2C1810',
      align: 'center',
      fontStyle: 'bold'
    });
    helpText.setOrigin(0.5, 0.5);
    
    // Sign stays until level 2 (will be destroyed when scene restarts)
  }
  
  // Add fade-in transition at level start
  const fadeOverlay = this.add.rectangle(w/2, h/2, w, h, 0x000000, 1);
  fadeOverlay.setDepth(1000); // On top of everything
  this.tweens.add({
    targets: fadeOverlay,
    alpha: 0,
    duration: 500,
    ease: 'Power2',
    onComplete: () => fadeOverlay.destroy()
  });
}

function buildLevelLayout(scene, level){
  const w = scene.scale.width;
  const h = scene.scale.height;
  
  finishLine = scene.physics.add.staticGroup();
  
if(level === 0){
 // Level 1: Basic platforming
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff); // Starting platform (bottom left)
    addMovingPlatform(scene, w*0.45, h*0.45, w*0.4, w*0.5, 1.5);
    addTrampoline(scene, w*0.2, h*0.55); // Trampoline on left side
    
    // Middle platform to help reach finish
    addPlatform(scene, w*0.7, h*0.6, 100, 20, 0x6B9BD1); // Blue platform between trampoline and finish
    
    addSpike(scene, w*0.37, h*0.75);
    addSpike(scene, w*0.38, h*0.72);
    addSpike(scene, w*0.39, h*0.69);
    addSpike(scene, w*0.40, h*0.66);
    addSpike(scene, w*0.41, h*0.63);
    addSpike(scene, w*0.42, h*0.6);
    addSpike(scene, w*0.43, h*0.57);
    addSpike(scene, w*0.44, h*0.54);
    addSpike(scene, w*0.45, h*0.51);
    
    // Burgers (no additional platforms - you'll add them later)
    addBurger(scene, w*0.15, h*0.16); // Near moon
    addBurger(scene, w*0.88, h*0.88); // Below finish door
    
    // Trampolines under burgers
    addTrampoline(scene, w*0.88, h*0.92); // Trampoline under burger 2
    
    addFinish(scene, w*0.9, h*0.25); // Finish door at top righ
  } 
  if (level === 1){
    // Level 2: Trampoline challenge
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.25, h*0.7, 100, 20, 0x6B9BD1);
    addTrampoline(scene, w*0.68, h*0.5);
    addPlatform(scene, w*0.82, h*0.25, 120, 20, 0xffffff);
    addMovingPlatform(scene, w*0.35, h*0.55, w*0.3, w*0.45, 2);
    addSpike(scene, w*0.32, h*0.76);
    addSpike(scene, w*0.6, h*0.46);
    
    // Burgers
    addBurger(scene, w*0.16, h*0.14); // Near moon
    addBurger(scene, w*0.86, h*0.84); // Below finish door
    
    // Trampoline under burger 2
    addTrampoline(scene, w*0.86, h*0.88); // Trampoline under burger 2
    
    addFinish(scene, w*0.88, 100);
  } 
  if(level === 2){
   // Level 3: Moving platforms
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.01, h*0.76, 110, 20, 0xA9C7F7);
    addMovingPlatform(scene, w*0.25, h*0.6, w*0.2, w*0.35, 1.8);
    addPlatform(scene, w*0.01, h*0.5, 80, 20, 0x6B9BD1); // Additional platform to reach first burger
    addMovingPlatform(scene, w*0.5, h*0.5, w*0.45, w*0.6, 2.2);
    addPlatform(scene, w*0.8, h*0.60, 100, 20, 0xA9C7F7);
    addPlatform(scene, w*0.98, h*0.40, 100, 20, 0xA9C7F7);
    addSpike(scene, w*0.3, h*0.72);
    addSpike(scene, w*0.4, h*0.7);
    addSpike(scene, w*0.58, h*0.58);
    addSpike(scene, w*0.65, h*0.55);
    
    // Burgers
    addBurger(scene, w*0.16, h*0.12); // Near moon
    addBurger(scene, w*0.88, h*0.83); // Below finish door
    addTrampoline(scene, w*0.8804, h*0.88);
    addFinish(scene, w*0.9, 90);
  } 
   if(level === 3){
    // Level 4: Obstacle course
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.25, h*0.7, 100, 20, 0x6B9BD1);
    addTrampoline(scene, w*0.68, h*0.5);
    addPlatform(scene, w*0.82, h*0.25, 120, 20, 0xffffff);
    addMovingPlatform(scene, w*0.35, h*0.55, w*0.3, w*0.45, 2);
    addSpike(scene, w*0.32, h*0.76);
    addSpike(scene, w*0.6, h*0.08);
    addSpike(scene, w*0.6, h*0.11);
    addSpike(scene, w*0.6, h*0.31);
    addSpike(scene, w*0.6, h*0.34);
    addSpike(scene, w*0.6, h*0.37);
    addSpike(scene, w*0.6, h*0.49);
    addSpike(scene, w*0.6, h*0.46);
    addSpike(scene, w*0.6, h*0.43);
    addSpike(scene, w*0.6, h*0.40);
    
    // Burgers
    addBurger(scene, w*0.15, h*0.14); // Near moon
    addBurger(scene, w*0.86, h*0.85); // Below finish door
    
    addFinish(scene, w*0.88, 100);
  }
   if (level  === 4){
    // Level 5: Final challenge
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addTrampoline(scene, w*0.2, h*0.75);
    addMovingPlatform(scene, w*0.35, h*0.55, w*0.28, w*0.42, 2.5);
    addSpike(scene, w*0.25, h*0.81);
    addSpike(scene, w*0.38, h*0.65);
    addPlatform(scene, w*0.52, h*0.42, 90, 20, 0xA9C7F7);
    addTrampoline(scene, w*0.62, h*0.5);
    addMovingPlatform(scene, w*0.72, h*0.3, w*0.68, w*0.78, 2);
    addSpike(scene, w*0.58, h*0.48);
    addSpike(scene, w*0.75, h*0.38);
    addSpike(scene, w*0.8, h*0.38);
    addPlatform(scene, w*0.88, h*0.2, 100, 20, 0xffffff);
    
    // Burgers
    addBurger(scene, w*0.14, h*0.13); // Near moon
    addBurger(scene, w*0.90, h*0.82); // Below finish door
    
    addFinish(scene, w*0.92, 90);
  }
  
  // Additional levels 6-10
  if(level === 5){
    // Level 6: Speed run
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addMovingPlatform(scene, w*0.22, h*0.7, w*0.15, w*0.30, 3);
    addMovingPlatform(scene, w*0.45, h*0.55, w*0.38, w*0.52, 3);
    addMovingPlatform(scene, w*0.68, h*0.4, w*0.62, w*0.75, 3);
    addTrampoline(scene, w*0.32, h*0.78);
    addTrampoline(scene, w*0.58, h*0.63);
    addSpike(scene, w*0.4, h*0.76);
    addSpike(scene, w*0.53, h*0.6);
    addSpike(scene, w*0.78, h*0.46);
    addPlatform(scene, w*0.87, h*0.25, 110, 20, 0xffffff);
    
    // Burgers
    addBurger(scene, w*0.15, h*0.13); // Near moon
    addBurger(scene, w*0.88, h*0.80); // Below finish door
    
    addFinish(scene, w*0.91, 100);
  }
  
  if(level === 6){
    // Level 7: Precision jumps
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.25, h*0.7, 80, 20, 0x6B9BD1);
    addPlatform(scene, w*0.4, h*0.58, 70, 20, 0xA9C7F7);
    addPlatform(scene, w*0.53, h*0.46, 80, 20, 0x6B9BD1);
    addPlatform(scene, w*0.68, h*0.34, 70, 20, 0xA9C7F7);
    addPlatform(scene, w*0.82, h*0.22, 90, 20, 0xffffff);
    addSpike(scene, w*0.33, h*0.76);
    addSpike(scene, w*0.47, h*0.64);
    addSpike(scene, w*0.61, h*0.52);
    addSpike(scene, w*0.75, h*0.4);
    addTrampoline(scene, w*0.15, h*0.8);
    
    // Burgers
    addBurger(scene, w*0.14, h*0.12); // Near moon
    addBurger(scene, w*0.87, h*0.78); // Below finish door
    
    addFinish(scene, w*0.9, 85);
  }
  
  if(level === 7){
    // Level 8: Moving maze
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addMovingPlatform(scene, w*0.25, h*0.7, w*0.2, w*0.35, 2);
    addPlatform(scene, w*0.42, h*0.58, 90, 20, 0xA9C7F7);
    addMovingPlatform(scene, w*0.55, h*0.45, w*0.48, w*0.62, 2.5);
    addPlatform(scene, w*0.7, h*0.32, 85, 20, 0x6B9BD1);
    addMovingPlatform(scene, w*0.82, h*0.22, w*0.78, w*0.88, 2);
    addSpike(scene, w*0.32, h*0.76);
    addSpike(scene, w*0.38, h*0.76);
    addSpike(scene, w*0.5, h*0.64);
    addSpike(scene, w*0.63, h*0.51);
    addSpike(scene, w*0.77, h*0.38);
    addTrampoline(scene, w*0.35, h*0.68);
    
    // Burgers
    addBurger(scene, w*0.15, h*0.14); // Near moon
    addBurger(scene, w*0.88, h*0.76); // Below finish door
    
    addFinish(scene, w*0.92, 80);
  }
  
  if(level === 8){
    // Level 9: Extreme challenge
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addTrampoline(scene, w*0.2, h*0.75);
    addMovingPlatform(scene, w*0.32, h*0.6, w*0.25, w*0.40, 3);
    addSpike(scene, w*0.28, h*0.81);
    addSpike(scene, w*0.35, h*0.66);
    addPlatform(scene, w*0.48, h*0.48, 75, 20, 0xA9C7F7);
    addMovingPlatform(scene, w*0.6, h*0.35, w*0.54, w*0.68, 2.8);
    addSpike(scene, w*0.52, h*0.54);
    addSpike(scene, w*0.62, h*0.41);
    addTrampoline(scene, w*0.73, h*0.45);
    addMovingPlatform(scene, w*0.82, h*0.25, w*0.78, w*0.88, 2.2);
    addSpike(scene, w*0.85, h*0.31);
    addPlatform(scene, w*0.92, h*0.18, 80, 20, 0xffffff);
    
    // Burgers
    addBurger(scene, w*0.14, h*0.11); // Near moon
    addBurger(scene, w*0.90, h*0.75); // Below finish door
    
    addFinish(scene, w*0.94, 75);
  }
  
  if(level === 9){
    // Level 10: Master finale
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addMovingPlatform(scene, w*0.22, h*0.72, w*0.15, w*0.30, 3.5);
    addTrampoline(scene, w*0.32, h*0.78);
    addSpike(scene, w*0.26, h*0.82);
    addMovingPlatform(scene, w*0.42, h*0.58, w*0.35, w*0.50, 3);
    addSpike(scene, w*0.46, h*0.64);
    addPlatform(scene, w*0.58, h*0.44, 70, 20, 0xA9C7F7);
    addTrampoline(scene, w*0.66, h*0.52);
    addMovingPlatform(scene, w*0.75, h*0.35, w*0.70, w*0.82, 2.8);
    addSpike(scene, w*0.72, h*0.41);
    addSpike(scene, w*0.78, h*0.41);
    addPlatform(scene, w*0.88, h*0.22, 75, 20, 0xffffff);
    addSpike(scene, w*0.85, h*0.28);
    addSpike(scene, w*0.91, h*0.28);
    
    // Burgers
    addBurger(scene, w*0.15, h*0.10); // Near moon
    addBurger(scene, w*0.92, h*0.73); // Below finish door
    
    addFinish(scene, w*0.94, 80);
  }
}

function addPlatform(scene, x, y, w, h, color){
  const plat = scene.add.rectangle(x, y, w, h, color);
  scene.physics.add.existing(plat, true);
  platforms.add(plat);
}

function addMovingPlatform(scene, x, y, minX, maxX, speed){
  const mp = scene.physics.add.sprite(x, y, null);
  mp.setDisplaySize(100, 18);
  mp.setTint(0x000000); // Black moving platforms
  mp.body.setAllowGravity(false);
  mp.body.setImmovable(true);
  mp.moveMin = minX;
  mp.moveMax = maxX;
  mp.moveSpeed = speed;
  mp.moveDir = 1;
  movingPlatforms.push(mp);
}

function addTrampoline(scene, x, y){
  const tramp = scene.add.rectangle(x, y, 60, 12, 0xFFE66D);
  scene.physics.add.existing(tramp, true);
  tramp.isTrampoline = true;
  platforms.add(tramp);
}

function addSpike(scene, x, y){
  const spike = scene.add.triangle(x, y, 0, 12, 10, -12, 20, 12, 0xFF0000);
  scene.physics.add.existing(spike, true);
  spike.body.setSize(20, 24);
  platforms.add(spike);
  spike.isDeadly = true; // Mark as deadly obstacle
}

function addBurger(scene, x, y){
  // Create burger using HTML Canvas (bypasses all loading issues!)
  if (!scene.textures.exists('burgerImage')) {
    // Create an HTML canvas element
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    
    // Draw burger pixel art on canvas
    // Top bun (darker brown - more brownish)
    ctx.fillStyle = '#8B5A3C'; // Darker brown
    ctx.fillRect(12, 3, 36, 3); // Very top
    ctx.fillRect(10, 6, 40, 8); // Main top bun
    
    // Sesame seeds (golden/yellow - highlighted)
    ctx.fillStyle = '#FFD700'; // Golden
    ctx.fillRect(16, 4, 3, 3);
    ctx.fillRect(26, 3, 3, 3);
    ctx.fillRect(36, 4, 3, 3);
    ctx.fillRect(42, 5, 2, 2);
    ctx.fillRect(22, 7, 2, 2);
    
    // Sparkle highlights on seeds (bright white)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(17, 4, 1, 1);
    ctx.fillRect(27, 3, 1, 1);
    ctx.fillRect(37, 4, 1, 1);
    
    // Lettuce (bright green - BIGGER than buns)
    ctx.fillStyle = '#7FD17F';
    ctx.fillRect(6, 14, 48, 7); // Main lettuce layer
    ctx.fillRect(4, 16, 2, 2); // Left wavy edge
    ctx.fillRect(54, 16, 2, 2); // Right wavy edge
    ctx.fillRect(3, 18, 2, 2); // Extra left wave
    ctx.fillRect(55, 18, 2, 2); // Extra right wave
    
    // Tomato (red - BIGGER than buns)
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(6, 21, 48, 7); // Bigger tomato layer
    
    // Meat patty (dark brown - BIGGER than buns)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(6, 28, 48, 9); // Bigger meat patty
    
    // Grill marks on meat (darker brown)
    ctx.fillStyle = '#654321';
    ctx.fillRect(12, 28, 2, 9);
    ctx.fillRect(22, 28, 2, 9);
    ctx.fillRect(32, 28, 2, 9);
    ctx.fillRect(42, 28, 2, 9);
    
    // Bottom bun (same darker brown as top)
    ctx.fillStyle = '#8B5A3C'; // Same darker brown
    ctx.fillRect(10, 37, 40, 8); // Main bottom bun
    ctx.fillRect(12, 45, 36, 3); // Very bottom (rounded)
    
    // Convert canvas to Phaser texture
    scene.textures.addCanvas('burgerImage', canvas);
    console.log('✅ Burger created using HTML Canvas!');
  }
  
  const burger = burgers.create(x, y, 'burgerImage');
  burger.setDisplaySize(60, 60);
  burger.refreshBody();
  
  // Add floating/levitating animation
  scene.tweens.add({
    targets: burger,
    y: y - 10, // Float up 10 pixels
    duration: 1000, // 1 second
    ease: 'Sine.easeInOut',
    yoyo: true, // Return back down
    repeat: -1 // Loop forever
  });
}

function addFinish(scene, x, y){
  // Brown door with black handle
  const doorGfx = scene.add.graphics();
  
  // Door frame (darker brown)
  doorGfx.fillStyle(0x4E342E, 1);
  doorGfx.fillRect(x-45, y-65, 90, 130);
  
  // Door body (medium brown)
  doorGfx.fillStyle(0x8D6E63, 1);
  doorGfx.fillRect(x-40, y-60, 80, 120);
  
  // Door panels (darker brown inset)
  doorGfx.fillStyle(0x6D4C41, 1);
  doorGfx.fillRect(x-35, y-55, 30, 50); // Top left panel
  doorGfx.fillRect(x+5, y-55, 30, 50); // Top right panel
  doorGfx.fillRect(x-35, y, 30, 50); // Bottom left panel
  doorGfx.fillRect(x+5, y, 30, 50); // Bottom right panel
  
  // Black door handle
  doorGfx.fillStyle(0x000000, 1);
  doorGfx.fillCircle(x+25, y, 8); // Round handle
  doorGfx.fillRect(x+20, y-3, 15, 6); // Handle extension
  
  const finish = scene.add.rectangle(x, y, 90, 130, 0xffffff, 0);
  scene.physics.add.existing(finish, true);
  finishLine.add(finish);
}

function respawnPlayer(scene){
  player.setPosition(150, scene.scale.height - 110);
  player.setVelocity(0, 0);
  // Reset burger score to previous level completion
  burgerScore -= levelBurgerScore;
  levelBurgerScore = 0;
  if(burgerEl) burgerEl.textContent = '🍔 ' + burgerScore;
}

function update(){
  if(!player || !player.body) return;
  
  // Check if player fell below screen (failsafe for floor detection)
  if(player.y > GAME.height() + 10){
    console.log('Player fell below screen - respawning');
    respawnPlayer(this);
    return;
  }
  
  // Move moving platforms
  movingPlatforms.forEach(mp => {
    mp.x += mp.moveSpeed * mp.moveDir;
    if(mp.x >= mp.moveMax || mp.x <= mp.moveMin){
      mp.moveDir *= -1;
    }
  });
  
  // Constant speed movement (no acceleration) - slower speed
  const speed = 240;
  
  if(wasd.left.isDown){
    player.setVelocityX(-speed);
  } else if(wasd.right.isDown){
    player.setVelocityX(speed);
  } else {
    player.setVelocityX(0);
  }
  
  // Jump with double jump
  const onGround = player.body.touching.down;
  
  // Track time since leaving ground (coyote time for better double jump)
  if(onGround) {
    hasDoubleJumped = false;
    timeLeftGround = 0;
  } else {
    timeLeftGround++;
  }
  
  // Allow double jump within 10 frames of leaving ground (coyote time)
  const canDoubleJump = !hasDoubleJumped && timeLeftGround > 0;
  
  if(Phaser.Input.Keyboard.JustDown(wasd.up)){
    if(onGround || timeLeftGround < 10){
      // Regular jump (works on ground or shortly after leaving)
      player.setVelocityY(-550); // Higher jump
      hasDoubleJumped = false;
    } else if(canDoubleJump){
      // Double jump
      player.setVelocityY(-580); // More powerful double jump
      hasDoubleJumped = true;
    }
  }
}

function nextLevel(scene){
  // Fade out transition before changing level
  const w = scene.scale.width;
  const h = scene.scale.height;
  const fadeOverlay = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0);
  fadeOverlay.setDepth(1000); // On top of everything
  
  scene.tweens.add({
    targets: fadeOverlay,
    alpha: 1,
    duration: 300,
    ease: 'Power2',
    onComplete: () => {
      levelIndex++; // Sequential progression: 0→1→2→3→4→5→6→7→8→9
      if(levelIndex>=totalLevels){
        // Show congratulations screen with Avdeev expression based on burgers
        showCongratsScreen();
        return;
      }
      if(levelEl) levelEl.textContent='Level: '+(levelIndex+1);
      scene.scene.restart(); // Restart with fade-in (handled in create())
    }
  });
}

function showCongratsScreen() {
  const congratsScreen = document.getElementById('congrats-screen');
  const finalBurgerScoreEl = document.getElementById('final-burger-score');
  const hud = document.getElementById('game-hud');
  
  if(finalBurgerScoreEl) finalBurgerScoreEl.textContent = burgerScore;
  if(hud) hud.classList.add('hidden');
  
  // Create Avdeev avatar based on burger score
  const avatarCanvas = document.getElementById('final-avdeev-avatar');
  if(avatarCanvas) {
    const ctx = avatarCanvas.getContext('2d');
    const scale = 4; // Large avatar for final screen
    
    // Clear canvas
    ctx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);
    
    // Brown hair (if not bald)
    if(playerConfig.hairColor !== 'bald'){
      ctx.fillStyle = '#5D4037';
      ctx.fillRect(13*scale, 0, 20*scale, 9*scale);
      ctx.fillRect(10*scale, 2*scale, 5*scale, 7*scale);
      ctx.fillRect(30*scale, 2*scale, 5*scale, 7*scale);
    }
    
    // Head
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(13*scale, 7*scale, 20*scale, 14*scale);
    
    // Draw eyes and mouth based on burger count
    if(burgerScore >= 18) {
      // 18-20: Very happy with stars
      // Happy eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(18*scale, 12*scale, 4*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 12*scale, 4*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(18*scale, 12*scale, 2*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 12*scale, 2*scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Happy eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(15*scale, 8*scale, 6*scale, 2*scale);
      ctx.fillRect(25*scale, 8*scale, 6*scale, 2*scale);
      
      // Big smile
      ctx.fillStyle = '#000000';
      ctx.fillRect(18*scale, 17*scale, 10*scale, 2*scale);
      ctx.fillRect(17*scale, 19*scale, 2*scale, 2*scale);
      ctx.fillRect(27*scale, 19*scale, 2*scale, 2*scale);
      
      // Draw stars below head
      ctx.fillStyle = '#FFD700';
      const starPositions = [
        {x: 10*scale, y: 24*scale},
        {x: 23*scale, y: 26*scale},
        {x: 36*scale, y: 24*scale}
      ];
      starPositions.forEach(pos => {
        ctx.beginPath();
        for(let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const x = pos.x + Math.cos(angle) * 3*scale;
          const y = pos.y + Math.sin(angle) * 3*scale;
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      });
      
    } else if(burgerScore >= 14) {
      // 14-17: Happy but not ecstatic
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Normal eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(16*scale, 10*scale, 5*scale, 1.5*scale);
      ctx.fillRect(26*scale, 10*scale, 5*scale, 1.5*scale);
      
      // Smile
      ctx.fillStyle = '#000000';
      ctx.fillRect(20*scale, 17*scale, 6*scale, 1.5*scale);
      ctx.fillRect(19*scale, 18.5*scale, 1.5*scale, 1.5*scale);
      ctx.fillRect(25.5*scale, 18.5*scale, 1.5*scale, 1.5*scale);
      
    } else if(burgerScore >= 8) {
      // 8-13: Neutral/OK
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Flat eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(16*scale, 11*scale, 5*scale, 1.5*scale);
      ctx.fillRect(26*scale, 11*scale, 5*scale, 1.5*scale);
      
      // Straight mouth (neutral)
      ctx.fillStyle = '#000000';
      ctx.fillRect(19*scale, 17*scale, 8*scale, 1.5*scale);
      
    } else if(burgerScore >= 4) {
      // 4-7: Angry/Bothered
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 1.5*scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Angry eyebrows (angled down)
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(15*scale, 11*scale, 6*scale, 2*scale);
      ctx.fillRect(25*scale, 9*scale, 6*scale, 2*scale);
      ctx.fillRect(14*scale, 9*scale, 2*scale, 2*scale);
      ctx.fillRect(30*scale, 11*scale, 2*scale, 2*scale);
      
      // Frown
      ctx.fillStyle = '#000000';
      ctx.fillRect(20*scale, 19*scale, 6*scale, 1.5*scale);
      ctx.fillRect(19*scale, 17.5*scale, 1.5*scale, 1.5*scale);
      ctx.fillRect(25.5*scale, 17.5*scale, 1.5*scale, 1.5*scale);
      
    } else {
      // 0-3: Dead (crosses for eyes)
      // X eyes (crosses)
      ctx.fillStyle = '#000000';
      ctx.fillRect(16*scale, 12*scale, 5*scale, 1.5*scale);
      ctx.fillRect(18*scale, 10*scale, 1.5*scale, 5*scale);
      ctx.fillRect(26*scale, 12*scale, 5*scale, 1.5*scale);
      ctx.fillRect(28*scale, 10*scale, 1.5*scale, 5*scale);
      
      // Sad/dead eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(15*scale, 9*scale, 6*scale, 1.5*scale);
      ctx.fillRect(25*scale, 9*scale, 6*scale, 1.5*scale);
      
      // Dead mouth (O shape)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(23*scale, 18*scale, 3*scale, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // White Kimono body (same for all)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(10*scale, 21*scale, 25*scale, 18*scale);
    ctx.fillRect(5*scale, 23*scale, 7*scale, 13*scale);
    ctx.fillRect(33*scale, 23*scale, 7*scale, 13*scale);
    
    // V-neck
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath();
    ctx.moveTo(22*scale, 21*scale);
    ctx.lineTo(18*scale, 28*scale);
    ctx.lineTo(27*scale, 28*scale);
    ctx.closePath();
    ctx.fill();
    
    // Belt
    ctx.fillStyle = '#000000';
    ctx.fillRect(10*scale, 35*scale, 25*scale, 4*scale);
  }
  
  // Set message based on burger score
  const congratsMessage = document.getElementById('congrats-message');
  if(congratsMessage) {
    if(burgerScore >= 18) {
      congratsMessage.textContent = '🌟 Perfect! Avdeev is extremely satisfied! 🌟';
    } else if(burgerScore >= 14) {
      congratsMessage.textContent = '😊 Great job! Avdeev is happy!';
    } else if(burgerScore >= 8) {
      congratsMessage.textContent = '😐 OK, but not enough burgers...';
    } else if(burgerScore >= 4) {
      congratsMessage.textContent = '😠 Avdeev is not satisfied!';
    } else {
      congratsMessage.textContent = '💀 Avdeev died from lack of burgers...';
    }
  }
  
  if(congratsScreen) congratsScreen.classList.add('active');
  
  // Reset for next playthrough
  levelIndex = 0;
  burgerScore = 0;
  levelBurgerScore = 0;
}

window.addEventListener('resize',()=>{ if(game) game.scale.resize(GAME.width(),GAME.height()); });