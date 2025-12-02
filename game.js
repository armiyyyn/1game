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
let deathCount = 0; // Track total deaths across all levels
let gameStartTime = 0; // Track when game started (timestamp)
let gameEndTime = 0; // Track when game ended (timestamp)
let levelEl, burgerEl, deathEl, timerEl;
let hasDoubleJumped = false;
let timeLeftGround = 0; // Track time since leaving ground for better double jump
let particleEmitters = [];
let backgroundMusic = null;
let musicEnabled = true;
let burgers; // Group for collectible burgers
let isDying = false; // Prevent multiple death animations
let levelVisited = []; // Track which levels have been visited

// Level names for preview screen
const levelNames = [
  "Level 1: The Beginning",
  "Level 2: Jump Challenge", 
  "Level 3: Moving Platforms",
  "Level 4: Obstacle Course",
  "Level 5: Half way there!",
  "Level 6: The Path",
  "Level 7: Chaos",
  "Level 8: Trampoline Madness",
  "Level 9: Extreme",
  "Level 10: Master Finale"
];

const playerConfig = { 
  hairColor: 0x3E2723, // Darker brown (was 0x5D4037)
  kimonoColor: 0xFFFFFF, // White kimono (default - matches HTML active state)
  beltColor: 0x1976D2, // Darker blue belt (was 0x2196F3)
  selectedMusicTrack: 'assets/music/background.mp3' // Default track
};

// Phaser config
const config = {
  type: Phaser.AUTO,
  width: GAME.width(),
  height: GAME.height(),
  parent: 'game-container',
  transparent: true, // Make Phaser canvas transparent
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
  deathCount = 0; // Reset death counter
  gameStartTime = Date.now(); // Start timer
  gameEndTime = 0; // Reset end time
  levelVisited = []; // Reset level visited tracking
  game = new Phaser.Game(config);
  
  // Stop any preview audio that might be playing from character menu
  const previewAudio = document.getElementById('preview-audio');
  if(previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
  }
  
  // Start HTML5 audio music with selected track (only if music is enabled)
  const audioElement = document.getElementById('background-music');
  if(audioElement && musicEnabled){
    // Update source to selected track
    audioElement.src = playerConfig.selectedMusicTrack;
    audioElement.volume = 0.8; // 80% volume
    audioElement.load(); // Reload with new source
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
  deathEl = document.getElementById('death-count');
  timerEl = document.getElementById('timer');

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
    if(hairValue === 'bald') {
      playerConfig.hairColor = 'bald';
    } else {
      // Convert hex string to number (e.g., "#5D4037" -> 0x5D4037)
      playerConfig.hairColor = parseInt(hairValue.replace('#', ''), 16);
    }
    console.log('Hair color set to:', playerConfig.hairColor);
    updatePreviewAvatar(); // Update live preview
  }));
  
  const kimonoBoxes = document.querySelectorAll('.kimono-box');
  kimonoBoxes.forEach(b => b.addEventListener('click', () => {
    kimonoBoxes.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    // Convert hex string to number (e.g., "#2196F3" -> 0x2196F3)
    playerConfig.kimonoColor = parseInt(b.dataset.kimono.replace('#', ''), 16);
    console.log('Kimono color set to:', playerConfig.kimonoColor);
    updatePreviewAvatar(); // Update live preview
  }));
  
  const beltBoxes = document.querySelectorAll('.belt-box');
  beltBoxes.forEach(b => b.addEventListener('click', () => {
    beltBoxes.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    // Convert hex string to number (e.g., "#1976D2" -> 0x1976D2)
    playerConfig.beltColor = parseInt(b.dataset.belt.replace('#', ''), 16);
    console.log('Belt color set to:', playerConfig.beltColor);
    updatePreviewAvatar(); // Update live preview
  }));
  
  // Draw initial preview avatar
  updatePreviewAvatar();
  
  // Music track selection
  const musicTracks = document.querySelectorAll('input[name="music-track"]');
  
  // Create a dedicated preview audio element (separate from game music)
  let previewAudio = document.getElementById('preview-audio');
  if(!previewAudio) {
    previewAudio = new Audio();
    previewAudio.id = 'preview-audio';
    previewAudio.volume = 0.5; // Lower volume for preview
    document.body.appendChild(previewAudio); // Add to DOM so we can reference it later
  }
  
  musicTracks.forEach(track => {
    track.addEventListener('change', (e) => {
      playerConfig.selectedMusicTrack = e.target.value;
      console.log('🎵 Music track selected:', e.target.value);
      
      // Stop any currently playing preview
      previewAudio.pause();
      previewAudio.currentTime = 0;
      
      // Play preview of selected track (8 seconds)
      previewAudio.src = e.target.value;
      previewAudio.currentTime = 10; // Start at 10 seconds into the track
      previewAudio.play().catch(err => console.log('Preview play blocked:', err));
      
      // Update track name display in character menu
      const trackNameDisplay = document.getElementById('current-track-name');
      const trackLabel = e.target.parentElement.textContent.trim();
      if(trackNameDisplay) {
        trackNameDisplay.textContent = '♪ ' + trackLabel;
        trackNameDisplay.style.opacity = '1';
      }
      
      // Stop preview after 8 seconds
      setTimeout(() => {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        // Fade out track name
        if(trackNameDisplay) {
          trackNameDisplay.style.opacity = '0';
        }
      }, 8000);
    });
  });
  
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
  if (startGameBtn) startGameBtn.addEventListener('click', () => { 
    hideAllMenus(); 
    if(gameHud) gameHud.classList.remove('hidden'); 
    // Stop any preview music before starting game
    const previewAudio = document.getElementById('preview-audio');
    if(previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    startGame(); 
  });
  if (settingsBtn) settingsBtn.addEventListener('click', () => { hideAllMenus(); if(settingsMenu) settingsMenu.classList.add('active'); });
  if (backBtn) backBtn.addEventListener('click', () => { 
    hideAllMenus(); 
    if(mainMenu) mainMenu.classList.add('active'); 
    // Stop preview music when going back to main menu
    const previewAudio = document.getElementById('preview-audio');
    if(previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
  });
  if (restartBtn) restartBtn.addEventListener('click', () => { if(game && game.scene.scenes[0]) game.scene.scenes[0].scene.restart(); });
  if (menuBtn) menuBtn.addEventListener('click', () => { 
    hideAllMenus(); 
    if(mainMenu) mainMenu.classList.add('active'); 
    if(gameHud) gameHud.classList.add('hidden'); 
    if(game&&game.scene.scenes[0]) game.scene.scenes[0].scene.pause(); 
    // Stop game music when returning to main menu
    const audioElement = document.getElementById('background-music');
    if(audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    // Reset all counters when returning to main menu
    burgerScore = 0;
    levelBurgerScore = 0;
    deathCount = 0;
    gameStartTime = 0;
    gameEndTime = 0;
  });
  if (exitBtn) exitBtn.addEventListener('click', () => { 
    hideAllMenus(); 
    if(mainMenu) mainMenu.classList.add('active'); 
    if(gameHud) gameHud.classList.add('hidden'); 
    if(game&&game.scene.scenes[0]) game.scene.scenes[0].scene.pause(); 
    // Stop game music when exiting to main menu
    const audioElement = document.getElementById('background-music');
    if(audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    // Reset all counters when exiting to main menu
    burgerScore = 0;
    levelBurgerScore = 0;
    deathCount = 0;
    gameStartTime = 0;
    gameEndTime = 0;
  });
  if (playAgainBtn) playAgainBtn.addEventListener('click', () => { hideAllMenus(); if(gameHud) gameHud.classList.remove('hidden'); startGame(); });
  if (backToMenuBtn) backToMenuBtn.addEventListener('click', () => { 
    hideAllMenus(); 
    if(mainMenu) mainMenu.classList.add('active'); 
    // Stop game music when returning to main menu from congrats screen
    const audioElement = document.getElementById('background-music');
    if(audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
  });

  if (brightnessSlider) brightnessSlider.addEventListener('input', e => { const v = e.target.value; if(brightnessValue) brightnessValue.textContent = v+'%'; document.body.style.filter = `brightness(${v}%)`; });
  
  // Draw Avdeev avatar on main menu
  const avatarCanvas = document.getElementById('avdeev-avatar');
  if(avatarCanvas) {
    const ctx = avatarCanvas.getContext('2d');
    const scale = 3; // 3x scale for full height menu avatar
    
    // Darker brown hair
    ctx.fillStyle = '#3E2723'; // Darker brown
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
    
    // Hand sleeves
    ctx.fillRect(5*scale, 23*scale, 6*scale, 13*scale);
    ctx.fillRect(34*scale, 23*scale, 6*scale, 13*scale);
    
    // Hands (skin tone)
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(3*scale, 30*scale, 4*scale, 6*scale);
    ctx.fillRect(38*scale, 30*scale, 4*scale, 6*scale);
    
    // V-neck triangle (skin showing through)
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath();
    ctx.moveTo(18*scale, 21*scale);
    ctx.lineTo(27*scale, 21*scale);
    ctx.lineTo(22.5*scale, 28*scale);
    ctx.closePath();
    ctx.fill();
    
    // Pants (BEFORE belt endings)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(14*scale, 39*scale, 6*scale, 10*scale);
    ctx.fillRect(25*scale, 39*scale, 6*scale, 10*scale);
    
    // Legs (BEFORE belt endings - behind belt)
    ctx.fillStyle = '#FFDBAC';
    ctx.fillRect(14*scale, 49*scale, 6*scale, 3*scale);
    ctx.fillRect(25*scale, 49*scale, 6*scale, 3*scale);
    
    // Belt endings - DRAWN BEFORE knot so they appear BEHIND it
    ctx.fillStyle = '#1976D2'; // Darker blue belt (was #2196F3)
    // Left ending
    ctx.beginPath();
    ctx.moveTo(21*scale, 38*scale);
    ctx.lineTo(18*scale, 38*scale);
    ctx.lineTo(15*scale, 44*scale); // Back to original length
    ctx.lineTo(18*scale, 44*scale); // Back to original length
    ctx.closePath();
    ctx.fill();
    // Right ending
    ctx.beginPath();
    ctx.moveTo(25*scale, 38*scale);
    ctx.lineTo(28*scale, 38*scale);
    ctx.lineTo(31*scale, 44*scale); // Back to original length
    ctx.lineTo(28*scale, 44*scale); // Back to original length
    ctx.closePath();
    ctx.fill();
    
    // Belt endings borders
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = scale * 0.3;
    ctx.beginPath();
    ctx.moveTo(21*scale, 38*scale);
    ctx.lineTo(18*scale, 38*scale);
    ctx.lineTo(15*scale, 44*scale);
    ctx.lineTo(18*scale, 44*scale);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(25*scale, 38*scale);
    ctx.lineTo(28*scale, 38*scale);
    ctx.lineTo(31*scale, 44*scale);
    ctx.lineTo(28*scale, 44*scale);
    ctx.closePath();
    ctx.stroke();
    
    // Blue Belt (AFTER endings)
    ctx.fillStyle = '#1976D2'; // Darker blue belt (was #2196F3)
    ctx.fillRect(10*scale, 35*scale, 25*scale, 4*scale);
    
    // Belt knot center (SMALLER)
    ctx.fillRect(21.5*scale, 35*scale, 3*scale, 4*scale); // SMALLER knot (3x4)
    
    // Belt outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = scale * 0.3;
    ctx.strokeRect(10*scale, 35*scale, 25*scale, 4*scale);
    ctx.strokeRect(21.5*scale, 35*scale, 3*scale, 4*scale);
    
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
    
    // Pizza crust (golden brown triangle with rounded bottom)
    ctx4.fillStyle = '#D4A574';
    ctx4.beginPath();
    ctx4.moveTo(50, 10); // Top point
    ctx4.lineTo(10, 90); // Bottom left
    ctx4.quadraticCurveTo(50, 100, 90, 90); // Curved bottom (rounded crust)
    ctx4.closePath();
    ctx4.fill();
    
    // Pizza sauce/cheese (yellow-orange)
    ctx4.fillStyle = '#FDB813';
    ctx4.beginPath();
    ctx4.moveTo(50, 20); // Top point
    ctx4.lineTo(18, 82); // Bottom left
    ctx4.quadraticCurveTo(50, 90, 82, 82); // Curved bottom
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
  
  // Draw Phone on main menu (1.5x bigger, rotated 15 degrees left)
  const phoneCanvas = document.getElementById('menu-phone');
  if(phoneCanvas) {
    const ctx5 = phoneCanvas.getContext('2d');
    
    // Clear canvas first
    ctx5.clearRect(0, 0, phoneCanvas.width, phoneCanvas.height);
    
    // Save context and rotate (center the phone in canvas)
    ctx5.save();
    ctx5.translate(50, 55); // Center of rotation
    ctx5.rotate(-15 * Math.PI / 180); // Rotate 15 degrees left (negative = counterclockwise)
    ctx5.translate(-50, -55); // Move back
    
    // Phone body (black/dark gray) - 1.5x bigger (37.5 x 67.5)
    ctx5.fillStyle = '#212121';
    ctx5.fillRect(20, 20, 37.5, 67.5);
    ctx5.fillRect(21.5, 18.5, 34.5, 70.5);
    
    // Phone screen (light blue/cyan)
    ctx5.fillStyle = '#4FC3F7';
    ctx5.fillRect(25, 28, 30, 45);
    
    // Screen icons/notifications
    ctx5.fillStyle = '#FFFFFF';
    ctx5.fillRect(28, 32, 6, 6);
    ctx5.fillRect(38, 32, 6, 6);
    ctx5.fillRect(48, 32, 6, 6);
    ctx5.fillRect(28, 42, 9, 9);
    ctx5.fillRect(41, 42, 9, 9);
    
    // App icons (colorful)
    ctx5.fillStyle = '#FF5252';
    ctx5.fillRect(28, 56, 7.5, 7.5);
    ctx5.fillStyle = '#4CAF50';
    ctx5.fillRect(39, 56, 7.5, 7.5);
    ctx5.fillStyle = '#FFC107';
    ctx5.fillRect(28, 65, 7.5, 7.5);
    ctx5.fillStyle = '#2196F3';
    ctx5.fillRect(39, 65, 7.5, 7.5);
    
    // Home button
    ctx5.fillStyle = '#424242';
    ctx5.beginPath();
    ctx5.arc(38.75, 80, 6, 0, Math.PI * 2);
    ctx5.fill();
    
    // Camera at top
    ctx5.fillStyle = '#1565C0';
    ctx5.beginPath();
    ctx5.arc(38.75, 24, 2.25, 0, Math.PI * 2);
    ctx5.fill();
    
    ctx5.restore(); // Restore context
    
    // Add sparkle in top left corner (OUTSIDE rotation, so it stays in corner)
    ctx5.fillStyle = '#FFFFFF';
    ctx5.beginPath();
    ctx5.arc(10, 7, 3, 0, Math.PI * 2);
    ctx5.fill();
    
    // Sparkle rays (cross shape)
    ctx5.fillStyle = '#FFFFFF';
    ctx5.fillRect(9.5, 3, 1, 8); // Vertical ray
    ctx5.fillRect(6, 6.5, 8, 1); // Horizontal ray
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
    
    // Angry eyebrows (angled down toward center)
    ctx6.fillStyle = '#3E2723';
    ctx6.fillRect(15*scale, 11*scale, 6*scale, 2*scale);
    ctx6.fillRect(29*scale, 11*scale, 6*scale, 2*scale);
    ctx6.fillRect(14*scale, 9*scale, 2*scale, 2*scale);
    ctx6.fillRect(34*scale, 9*scale, 2*scale, 2*scale);
    
    // Angry frown (curved DOWN - corners pointing down)
    ctx6.fillStyle = '#000000';
    ctx6.fillRect(20*scale, 19*scale, 10*scale, 1.5*scale); // Main frown line
    ctx6.fillRect(19*scale, 20.5*scale, 1.5*scale, 1.5*scale); // Left corner DOWN
    ctx6.fillRect(29.5*scale, 20.5*scale, 1.5*scale, 1.5*scale); // Right corner DOWN
    
    // Fat neck (double chin)
    ctx6.fillStyle = '#FFDBAC';
    ctx6.beginPath();
    ctx6.arc(25*scale, 23*scale, 10*scale, 0, Math.PI);
    ctx6.fill();
    ctx6.fillRect(15*scale, 23*scale, 20*scale, 6*scale);
    
    // Neck crease
    ctx6.strokeStyle = '#E0C097';
    ctx6.lineWidth = 1.5;
    ctx6.beginPath();
    ctx6.moveTo(15*scale, 27*scale);
    ctx6.lineTo(35*scale, 27*scale);
    ctx6.stroke();
    
    // Fat body (white t-shirt)
    ctx6.fillStyle = '#FFFFFF';
    ctx6.fillRect(8*scale, 29*scale, 34*scale, 20*scale);
    ctx6.fillRect(3*scale, 32*scale, 8*scale, 15*scale);
    ctx6.fillRect(39*scale, 32*scale, 8*scale, 15*scale);
    
    // Belt
    ctx6.fillStyle = '#5D4037';
    ctx6.fillRect(8*scale, 45*scale, 34*scale, 4*scale);
    
    // Belt buckle
    ctx6.fillStyle = '#FFD700';
    ctx6.fillRect(23*scale, 44*scale, 4*scale, 6*scale);
    
    // Dark pants
    ctx6.fillStyle = '#424242';
    ctx6.fillRect(12*scale, 49*scale, 12*scale, 10*scale);
    ctx6.fillRect(26*scale, 49*scale, 12*scale, 10*scale);
    
    // Black shoes
    ctx6.fillStyle = '#000000';
    ctx6.fillRect(12*scale, 59*scale, 12*scale, 4*scale); // Left shoe
    ctx6.fillRect(26*scale, 59*scale, 12*scale, 4*scale); // Right shoe
  }
});

// Function to update the live preview avatar based on selected colors
function updatePreviewAvatar() {
  const previewCanvas = document.getElementById('customize-preview-avatar');
  if(!previewCanvas) return;
  
  const ctx = previewCanvas.getContext('2d');
  const scale = 6; // 6x scale for big preview (270x324 canvas)
  
  // Clear canvas
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  
  // Convert hex color number to CSS hex string
  function numToHex(num) {
    if(num === 'bald') return 'bald';
    return '#' + num.toString(16).padStart(6, '0').toUpperCase();
  }
  
  const hairColor = numToHex(playerConfig.hairColor);
  const kimonoColor = numToHex(playerConfig.kimonoColor);
  const beltColor = numToHex(playerConfig.beltColor);
  
  // Hair (if not bald)
  if(hairColor !== 'bald') {
    ctx.fillStyle = hairColor;
    ctx.fillRect(13*scale, 0, 20*scale, 9*scale);
    ctx.fillRect(10*scale, 2*scale, 5*scale, 7*scale);
    ctx.fillRect(30*scale, 2*scale, 5*scale, 7*scale);
    
    // Hair outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = scale * 0.3;
    ctx.strokeRect(13*scale, 0, 20*scale, 9*scale);
  }
  
  // Head
  ctx.fillStyle = '#FFDBAC';
  ctx.fillRect(13*scale, 7*scale, 20*scale, 14*scale);
  
  // Head outline (darker)
  ctx.strokeStyle = '#D4A574';
  ctx.lineWidth = scale;
  ctx.strokeRect(13*scale, 7*scale, 20*scale, 14*scale);
  
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
  
  // Mouth (smile)
  ctx.fillStyle = '#000000';
  ctx.fillRect(19*scale, 18*scale, 8*scale, 1.5*scale);
  ctx.fillRect(18*scale, 16.5*scale, 1.5*scale, 1.5*scale);
  ctx.fillRect(26.5*scale, 16.5*scale, 1.5*scale, 1.5*scale);
  
  // Kimono
  ctx.fillStyle = kimonoColor;
  ctx.fillRect(10*scale, 21*scale, 25*scale, 18*scale); // Main body
  
  // Kimono outline
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = scale * 0.5;
  ctx.strokeRect(10*scale, 21*scale, 25*scale, 18*scale);
  
  // V-neck - TRIANGLE AT TOP (point down)
  ctx.fillStyle = '#FFDBAC';
  ctx.beginPath();
  ctx.moveTo(18*scale, 21*scale); // Left top
  ctx.lineTo(27*scale, 21*scale); // Right top
  ctx.lineTo(22.5*scale, 28*scale); // Point down (at top of kimono)
  ctx.closePath();
  ctx.fill();
  
  // Kimono collar lines (darker outline)
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = scale * 1.5;
  ctx.beginPath();
  ctx.moveTo(18*scale, 21*scale);
  ctx.lineTo(22.5*scale, 28*scale);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(27*scale, 21*scale);
  ctx.lineTo(22.5*scale, 28*scale);
  ctx.stroke();
  
  // Hand sleeves (kimono color extending to hands)
  ctx.fillStyle = kimonoColor;
  ctx.fillRect(5*scale, 23*scale, 6*scale, 13*scale); // Left sleeve (raised, taller)
  ctx.fillRect(34*scale, 23*scale, 6*scale, 13*scale); // Right sleeve (raised, taller)
  
  // Sleeve outlines
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = scale * 0.5;
  ctx.strokeRect(5*scale, 23*scale, 6*scale, 13*scale);
  ctx.strokeRect(34*scale, 23*scale, 6*scale, 13*scale);
  
  // Hands (same skin tone as head) - WITHOUT ROUNDED ENDS
  ctx.fillStyle = '#FFDBAC';
  // Left hand
  ctx.fillRect(3*scale, 30*scale, 4*scale, 6*scale);
  // Right hand
  ctx.fillRect(38*scale, 30*scale, 4*scale, 6*scale);
  
  // Hand outlines
  ctx.strokeStyle = '#D4A574';
  ctx.lineWidth = scale;
  ctx.strokeRect(3*scale, 30*scale, 4*scale, 6*scale);
  ctx.strokeRect(38*scale, 30*scale, 4*scale, 6*scale);
  
  // Belt with detailed knot
  ctx.fillStyle = beltColor;
  ctx.fillRect(10*scale, 35*scale, 25*scale, 4*scale);
  
  // Belt outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = scale * 0.3;
  ctx.strokeRect(10*scale, 35*scale, 25*scale, 4*scale);
  
  // Pants (DRAWN BEFORE belt knot so knot appears on top)
  ctx.fillStyle = kimonoColor;
  ctx.fillRect(14*scale, 39*scale, 6*scale, 10*scale);
  ctx.fillRect(25*scale, 39*scale, 6*scale, 10*scale);
  
  // Pants outline
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = scale * 0.5;
  ctx.strokeRect(14*scale, 39*scale, 6*scale, 10*scale);
  ctx.strokeRect(25*scale, 39*scale, 6*scale, 10*scale);
  
  // Legs (DRAWN BEFORE belt endings - behind belt)
  ctx.fillStyle = '#FFDBAC';
  ctx.fillRect(14*scale, 49*scale, 6*scale, 3*scale);
  ctx.fillRect(25*scale, 49*scale, 6*scale, 3*scale);
  
  // Legs outline
  ctx.strokeStyle = '#D4A574';
  ctx.lineWidth = scale;
  ctx.strokeRect(14*scale, 49*scale, 6*scale, 3*scale);
  ctx.strokeRect(25*scale, 49*scale, 6*scale, 3*scale);
  
  // Belt endings - DRAWN BEFORE knot so they appear BEHIND it
  // Left ending - angled LEFT (parallelogram)
  ctx.fillStyle = beltColor;
  ctx.beginPath();
  ctx.moveTo(21*scale, 38*scale); // Top right (INSIDE knot)
  ctx.lineTo(18*scale, 38*scale); // Top left (INSIDE knot)
  ctx.lineTo(15*scale, 44*scale); // Bottom left (back to original)
  ctx.lineTo(18*scale, 44*scale); // Bottom right (back to original)
  ctx.closePath();
  ctx.fill();
  
  // Right ending - angled RIGHT (parallelogram)
  ctx.beginPath();
  ctx.moveTo(25*scale, 38*scale); // Top left (INSIDE knot)
  ctx.lineTo(28*scale, 38*scale); // Top right (INSIDE knot)
  ctx.lineTo(31*scale, 44*scale); // Bottom right (back to original)
  ctx.lineTo(28*scale, 44*scale); // Bottom left (back to original)
  ctx.closePath();
  ctx.fill();
  
  // Borders for endings
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = scale * 0.3; // Same as belt outline (matches main belt)
  // Left ending border
  ctx.beginPath();
  ctx.moveTo(21*scale, 38*scale);
  ctx.lineTo(18*scale, 38*scale);
  ctx.lineTo(15*scale, 44*scale);
  ctx.lineTo(18*scale, 44*scale);
  ctx.closePath();
  ctx.stroke();
  // Right ending border
  ctx.beginPath();
  ctx.moveTo(25*scale, 38*scale);
  ctx.lineTo(28*scale, 38*scale);
  ctx.lineTo(31*scale, 44*scale);
  ctx.lineTo(28*scale, 44*scale);
  ctx.closePath();
  ctx.stroke();
  
  // Belt knot in center - DRAWN AFTER endings so it appears ON TOP (SMALLER)
  ctx.fillStyle = beltColor;
  ctx.fillRect(21.5*scale, 35*scale, 3*scale, 4*scale); // SMALLER knot (3x4)
  
  // Knot center outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = scale * 0.4;
  ctx.strokeRect(21.5*scale, 35*scale, 3*scale, 4*scale);
  
  // Legs
  ctx.fillStyle = '#FFDBAC';
  ctx.fillRect(14*scale, 49*scale, 6*scale, 3*scale);
  ctx.fillRect(25*scale, 49*scale, 6*scale, 3*scale);
  
  // Legs outline
  ctx.strokeStyle = '#D4A574';
  ctx.lineWidth = scale;
  ctx.strokeRect(14*scale, 49*scale, 6*scale, 3*scale);
  ctx.strokeRect(25*scale, 49*scale, 6*scale, 3*scale);
}

function preload(){
  // Load rocket image from root directory
  this.load.image('rocket', 'rocket.png');
  
  // Load background image
  this.load.image('background', 'space.png');
  
  // Log loading progress
  this.load.on('complete', () => {
    console.log('✅ All assets loaded successfully!');
  });
  
  this.load.on('loaderror', (file) => {
    console.error('❌ Error loading:', file.key, 'from', file.url);
  });
}

function showLevelPreview(scene, levelName) {
  const w = scene.scale.width;
  const h = scene.scale.height;
  
  // Create semi-transparent black blurred overlay (lets level show through)
  const overlay = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.4); // Black with 40% opacity
  overlay.setDepth(2000);
  
  // Add blur effect by creating additional semi-transparent black layers
  const blurLayer1 = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.2);
  blurLayer1.setDepth(1999);
  const blurLayer2 = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.15);
  blurLayer2.setDepth(1998);
  
  // Create level name text with white color and black borders
  const levelText = scene.add.text(w/2, h/2, levelName, {
    fontSize: '72px',
    fontFamily: 'Arial Black',
    color: '#FFFFFF', // White text
    stroke: '#000000', // Black stroke/border
    strokeThickness: 8,
    align: 'center',
    shadow: {
      offsetX: 0,
      offsetY: 0,
      color: '#FFFFFF', // White shadow
      blur: 35,
      fill: true
    }
  });
  levelText.setOrigin(0.5);
  levelText.setDepth(2001);
  levelText.setAlpha(0);
  levelText.setScale(0.5);
  
  // Animate text entrance (zoom in + fade in) - VERY FAST
  scene.tweens.add({
    targets: levelText,
    alpha: 1,
    scale: 1,
    duration: 720, // Very fast entrance (was 800)
    ease: 'Back.easeOut',
    onComplete: () => {
      // Hold for just 300ms, then fade out immediately
      scene.time.delayedCall(300, () => { // Reduced from 1500 to 300
        scene.tweens.add({
          targets: [overlay, levelText, blurLayer1, blurLayer2],
          alpha: 0,
          duration: 300, // Fast fade out (was 500)
          ease: 'Power2',
          onComplete: () => {
            overlay.destroy();
            levelText.destroy();
            blurLayer1.destroy();
            blurLayer2.destroy();
          }
        });
      });
    }
  });
  
  // Pulsing glow effect - FASTER
  scene.tweens.add({
    targets: levelText,
    scale: 1.08,
    duration: 400, // Faster pulse (was 900)
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1
  });
}

function create(){
  const w = this.scale.width;
  const h = this.scale.height;
  
  // Reset state
  hasDoubleJumped = false;
  movingPlatforms = [];
  levelBurgerScore = 0; // Reset burgers for this level attempt
  isDying = false; // Reset death flag
  
  // Create burgers group
  burgers = this.physics.add.staticGroup();
  
  // No Phaser background - using HTML/CSS layer instead
  console.log('🌌 Using HTML space.png background');
  
  // Create platforms group
  platforms = this.physics.add.staticGroup();
  
  // Build level based on levelIndex first (so it shows in background)
  buildLevelLayout(this, levelIndex);
  
  // Show level preview AFTER building level (on top of level)
  if(!levelVisited[levelIndex]) {
    levelVisited[levelIndex] = true;
    showLevelPreview(this, levelNames[levelIndex]);
    // Don't return - let level be created and visible underneath
  }
  
  // Create Avdeev with accessories (10% smaller - 45x54 for better proportions)
  // Spawn above the platform so he stands on top of it
  // Special spawn position for level 7 (bottom right)
  let spawnX = 150;
  let spawnY = h - 110;
  
  if(levelIndex === 6) {
    // Level 7: Start at bottom right
    spawnX = w * 0.92;
    spawnY = h - 110;
  }
  
  player = this.physics.add.sprite(spawnX, spawnY, null);
  player.setDisplaySize(45, 54);
  player.setBounce(0); // No bounce at all
  player.setCollideWorldBounds(true);
  player.setDrag(0); // No drag
  player.setDamping(false); // Disable damping (this causes acceleration!)
  player.setMaxVelocity(260, 1200); // Max velocity matches movement speed exactly
  player.setFriction(0, 0); // No friction
  player.body.useDamping = false; // Explicitly disable damping
  
  // Draw Avdeev as detailed pixel boy with judogi (canvas - 45x54)
  const gfx = this.add.graphics();
  
  // Brown hair on top (if not bald)
  if(playerConfig.hairColor !== 'bald'){
    gfx.fillStyle(playerConfig.hairColor, 1);
    gfx.fillRect(13, 0, 20, 9); // Hair
    gfx.fillRect(10, 2, 5, 7); // Left hair tuft
    gfx.fillRect(30, 2, 5, 7); // Right hair tuft
    
    // Hair outline
    gfx.lineStyle(1, 0x000000, 0.3);
    gfx.strokeRect(13, 0, 20, 9);
  }
  
  // Head (skin tone) with darker outline
  gfx.fillStyle(0xFFDBAC, 1); // Light skin
  gfx.fillRect(13, 7, 20, 14); // Head
  
  // Head outline
  gfx.lineStyle(1, 0xD4A574, 1); // Darker skin outline
  gfx.strokeRect(13, 7, 20, 14);
  
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
  
  // Kimono outline
  gfx.lineStyle(1, 0xCCCCCC, 0.5);
  gfx.strokeRect(10, 21, 25, 18);
  
  // V-neck chest opening (skin showing through) - TRIANGLE AT TOP (point down)
  gfx.fillStyle(0xFFDBAC, 1); // Skin tone
  gfx.fillTriangle(18, 21, 27, 21, 22.5, 28); // Triangle at top of kimono (point at 28)
  
  // Kimono collar lines (darker outline)
  gfx.lineStyle(1.5, 0x999999, 1);
  gfx.beginPath();
  gfx.moveTo(18, 21);
  gfx.lineTo(22.5, 28);
  gfx.strokePath();
  
  gfx.beginPath();
  gfx.moveTo(27, 21);
  gfx.lineTo(22.5, 28);
  gfx.strokePath();
  
  // Hand sleeves (kimono color extending to hands) - RAISED HIGHER
  gfx.fillStyle(playerConfig.kimonoColor, 1);
  gfx.fillRect(5, 23, 6, 13); // Left sleeve (raised from 28 to 23, height 13)
  gfx.fillRect(34, 23, 6, 13); // Right sleeve (raised from 28 to 23, height 13)
  
  // Sleeve outlines
  gfx.lineStyle(1, 0xCCCCCC, 0.5);
  gfx.strokeRect(5, 23, 6, 13);
  gfx.strokeRect(34, 23, 6, 13);
  
  // Hands (same skin tone as head) - WITHOUT ROUNDED ENDS
  gfx.fillStyle(0xFFDBAC, 1);
  // Left hand
  gfx.fillRect(3, 30, 4, 6); // Hand extending from left sleeve
  // Right hand
  gfx.fillRect(38, 30, 4, 6); // Hand extending from right sleeve
  
  // Hand outlines
  gfx.lineStyle(1, 0xD4A574, 1);
  gfx.strokeRect(3, 30, 4, 6);
  gfx.strokeRect(38, 30, 4, 6);
  
  // Belt (obi) - judo belt colors with detailed knot
  gfx.fillStyle(playerConfig.beltColor, 1);
  gfx.fillRect(10, 35, 25, 4); // Belt across waist
  
  // White judogi pants (DRAWN BEFORE belt endings so endings appear on top)
  gfx.fillStyle(playerConfig.kimonoColor, 1);
  gfx.fillRect(14, 39, 6, 10); // Left pant leg
  gfx.fillRect(25, 39, 6, 10); // Right pant leg
  
  // Pants outline
  gfx.lineStyle(1, 0xCCCCCC, 0.5);
  gfx.strokeRect(14, 39, 6, 10);
  gfx.strokeRect(25, 39, 6, 10);
  
  // Realistic naked legs below pants (DRAWN BEFORE belt endings - behind belt)
  gfx.fillStyle(0xFFDBAC, 1);
  gfx.fillRect(14, 49, 6, 3); // Left lower leg (shin)
  gfx.fillRect(25, 49, 6, 3); // Right lower leg (shin)
  
  // Legs outline
  gfx.lineStyle(1, 0xD4A574, 1);
  gfx.strokeRect(14, 49, 6, 3);
  gfx.strokeRect(25, 49, 6, 3);
  
  // Belt outline (DRAWN AFTER legs so it appears on top)
  gfx.lineStyle(1, 0x000000, 0.3);
  gfx.strokeRect(10, 35, 25, 4);
  
  // Belt endings - DRAWN BEFORE knot so they appear BEHIND it (AFTER legs)
  // Left ending - angled LEFT (parallelogram coming from inside knot)
  gfx.fillStyle(playerConfig.beltColor, 1);
  gfx.fillPoints([
    {x: 21, y: 38},  // Top right (INSIDE knot)
    {x: 18, y: 38},  // Top left (INSIDE knot)
    {x: 15, y: 44},  // Bottom left (back to original)
    {x: 18, y: 44}   // Bottom right (back to original)
  ], true);
  
  // Right ending - angled RIGHT (parallelogram coming from inside knot)
  gfx.fillPoints([
    {x: 25, y: 38},  // Top left (INSIDE knot)
    {x: 28, y: 38},  // Top right (INSIDE knot)
    {x: 31, y: 44},  // Bottom right (back to original)
    {x: 28, y: 44}   // Bottom left (back to original)
  ], true);
  
  // Borders for endings
  gfx.lineStyle(1, 0x000000, 0.3); // Same as belt outline (was 0.8, 0.4)
  // Left ending border
  gfx.strokePoints([
    {x: 21, y: 38},
    {x: 18, y: 38},
    {x: 15, y: 44},
    {x: 18, y: 44}
  ], true);
  // Right ending border
  gfx.strokePoints([
    {x: 25, y: 38},
    {x: 28, y: 38},
    {x: 31, y: 44},
    {x: 28, y: 44}
  ], true);
  
  // Belt knot in center - DRAWN AFTER endings so it appears ON TOP (SMALLER + RAISED)
  gfx.fillStyle(playerConfig.beltColor, 1);
  gfx.fillRect(21.5, 35, 3, 4); // Knot center - SMALLER and SHORTER (was 3x6, now 3x4)
  
  // Knot center outline
  gfx.lineStyle(1, 0x000000, 0.4);
  gfx.strokeRect(21.5, 35, 3, 4);
  
  // Bigger feet with toes for visible rotation (DRAWN AFTER legs)
  gfx.fillStyle(0xFFDBAC, 1); // Skin tone for feet
  // Left foot (bigger with toes)
  gfx.fillRect(13, 51, 7, 4); // Foot base (bigger)
  gfx.fillRect(18, 51, 6, 3); // Toes sticking out to the right (longer)
  
  // Right foot (bigger with toes)
  gfx.fillRect(25, 51, 7, 4); // Foot base (bigger)
  gfx.fillRect(30, 51, 6, 3); // Toes sticking out to the right (longer)
  
  // Feet outline
  gfx.lineStyle(1, 0xD4A574, 1);
  gfx.strokeRect(13, 51, 7, 4);
  gfx.strokeRect(18, 51, 6, 3);
  gfx.strokeRect(25, 51, 7, 4);
  gfx.strokeRect(30, 51, 6, 3);
  
  gfx.generateTexture('avdeev', 45, 54);
  gfx.destroy();
  player.setTexture('avdeev');
  
  // Store player's last direction
  player.lastDirection = 'right'; // Default facing right
  
  // Fix collision box so Avdeev stands properly on platforms (not sinking)
  player.body.setSize(30, 50); // Smaller collision box
  player.body.setOffset(7, 4); // Offset to align feet with platform
  
  // Controls
  cursors = this.input.keyboard.createCursorKeys();
  wasd = this.input.keyboard.addKeys({up:'W', left:'A', right:'D'});
  
  // Collisions
  this.physics.add.collider(player, platforms, (p, platform) => {
    if(platform.isSuperTrampoline){
      player.setVelocityY(-1400); // 2x regular trampoline (-700 * 2)
      hasDoubleJumped = false;
    } else if(platform.isTrampoline){
      player.setVelocityY(-700);
      hasDoubleJumped = false;
    } else if(platform.isDeadly && !isDying){
      // Die on spike contact with animation (only if not already dying)
      createDeathAnimation(this, player.x, player.y);
    }
  });
  
  // Moving platform collisions with proper blocking from all sides
  movingPlatforms.forEach(mp => {
    const collider = this.physics.add.collider(player, mp, null, null, this);
    // Enable collision on all sides
    mp.body.checkCollision.up = true;
    mp.body.checkCollision.down = true;
    mp.body.checkCollision.left = true;
    mp.body.checkCollision.right = true;
  });
  
  // Finish door collision - prevent multiple triggers
  let levelCompleting = false;
  this.physics.add.overlap(player, finishLine, (p, door) => {
    if(!levelCompleting) {
      levelCompleting = true;
      // Create colorful sparks around the door
      createFinishSparks(this, door.x, door.y);
      // Transition to next level after sparks animation
      this.time.delayedCall(400, () => {
        nextLevel(this);
      });
    }
  });
  
  // Burger collection
  this.physics.add.overlap(player, burgers, (player, burger) => {
    const burgerX = burger.x;
    const burgerY = burger.y;
    
    burger.destroy();
    burgerScore++;
    levelBurgerScore++; // Track burgers in current level
    if(burgerEl) burgerEl.textContent = '🍔 ' + burgerScore;
    
    // Create burger crumbs particle effect
    createBurgerCrumbs(this, burgerX, burgerY);
  });
  
  // Deadly spike floor at bottom - covers entire width
  const spikeFloorY = h - 15;
  const spikeWidth = 30;
  const numSpikes = Math.ceil(w / spikeWidth) + 2;
  
  for(let i = 0; i < numSpikes; i++){
    const sx = i * spikeWidth;
    const spikeGfx = this.add.graphics();
    spikeGfx.fillStyle(0x8B0000, 1); // Dark red (same as other spikes)
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
  if(deathEl) deathEl.textContent = '💀 ' + deathCount;
  
  // Update timer display every 100ms
  const timerInterval = setInterval(() => {
    if(gameStartTime > 0 && gameEndTime === 0) {
      const elapsed = Date.now() - gameStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const milliseconds = Math.floor((elapsed % 1000) / 10);
      if(timerEl) timerEl.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
  }, 100);
  
  // Show and position rocket based on level
  const gameRocket = document.getElementById('game-rocket');
  const gameAmongus = document.getElementById('game-amongus');
  const spaceBackground = document.getElementById('space-background');
  
  // Show space background during gameplay
  if(spaceBackground) {
    spaceBackground.classList.add('active');
    console.log('✅ Space background activated');
  }
  
  // Position decorative images based on level
  if(gameRocket) gameRocket.classList.add('active');
  if(gameAmongus) gameAmongus.classList.add('active');
  
  // Position all images for each level
  switch(levelIndex) {
    case 0: // Level 1
      if(gameRocket) { gameRocket.style.left = '75%'; gameRocket.style.top = '20%'; }
      if(gameAmongus) { gameAmongus.style.left = '35%'; gameAmongus.style.top = '15%'; }
      break;
    case 1: // Level 2
      if(gameRocket) { gameRocket.style.left = '5%'; gameRocket.style.top = '25%'; }
      if(gameAmongus) { gameAmongus.style.left = '55%'; gameAmongus.style.top = '65%'; }
      break;
    case 2: // Level 3
      if(gameRocket) { gameRocket.style.left = '75%'; gameRocket.style.top = '15%'; }
      if(gameAmongus) { gameAmongus.style.left = '15%'; gameAmongus.style.top = '60%'; }
      break;
    case 3: // Level 4
      if(gameRocket) { gameRocket.style.left = '12%'; gameRocket.style.top = '15%'; }
      if(gameAmongus) { gameAmongus.style.left = '50%'; gameAmongus.style.top = '65%'; }
      break;
    case 4: // Level 5
      if(gameRocket) { gameRocket.style.left = '8%'; gameRocket.style.top = '30%'; }
      if(gameAmongus) { gameAmongus.style.left = '30%'; gameAmongus.style.top = '70%'; }
      break;
    case 5: // Level 6
      if(gameRocket) { gameRocket.style.left = '50%'; gameRocket.style.top = '40%'; }
      if(gameAmongus) { gameAmongus.style.left = '35%'; gameAmongus.style.top = '60%'; }
      break;
    case 6: // Level 7
      if(gameRocket) { gameRocket.style.left = '45%'; gameRocket.style.top = '10%'; }
      if(gameAmongus) { gameAmongus.style.left = '35%'; gameAmongus.style.top = '50%'; }
      break;
    case 7: // Level 8
      if(gameRocket) { gameRocket.style.left = '15%'; gameRocket.style.top = '20%'; }
      if(gameAmongus) { gameAmongus.style.left = '35%'; gameAmongus.style.top = '50%'; }
      break;
    case 8: // Level 9
      if(gameRocket) { gameRocket.style.left = '10%'; gameRocket.style.top = '35%'; }
      if(gameAmongus) { gameAmongus.style.left = '25%'; gameAmongus.style.top = '60%'; }
      break;
    case 9: // Level 10
      if(gameRocket) { gameRocket.style.left = '8%'; gameRocket.style.top = '25%'; }
      if(gameAmongus) { gameAmongus.style.left = '50%'; gameAmongus.style.top = '60%'; }
      break;
  }
  
  // Add help sign on level 1 only - positioned at left corner
  if(levelIndex === 0){
    const signX = 90; // At the left corner of starting platform
    const signY = h - 180; // Much higher to give space for full Avdeev
    
    // Wooden sign
    const signGfx = this.add.graphics();
    signGfx.fillStyle(0x6D4C41, 1); // Darker brown post
    signGfx.fillRect(signX-2.5, signY, 5, 140); // Much taller post (140px)
    
    // Sign board
    signGfx.fillStyle(0xF4A460, 1); // Sandy brown
    signGfx.fillRect(signX-75, signY-30, 150, 48); // Slightly taller board for 3 lines
    
    // Border
    signGfx.lineStyle(3, 0x4E342E, 1);
    signGfx.strokeRect(signX-75, signY-30, 150, 48);
    
    // Text - updated with feeding message
    const helpText = this.add.text(signX, signY-6, 'Help Avdeev get to\nthe training and\nfeed him on his way!', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#2C1810',
      align: 'center',
      fontStyle: 'bold',
      lineSpacing: 1
    });
    helpText.setOrigin(0.5, 0.5);
    
    // Sign stays until level 2 (will be destroyed when scene restarts)
  }
  
  // Add motivational sign on level 10 only - positioned at left corner
  if(levelIndex === 9){
    const signX = 90; // At the left corner of starting platform
    const signY = h - 120; // Higher position
    
    // Wooden sign
    const signGfx = this.add.graphics();
    signGfx.fillStyle(0x6D4C41, 1); // Darker brown post
    signGfx.fillRect(signX-2.5, signY, 5, 80); // Post
    
    // Sign board
    signGfx.fillStyle(0xF4A460, 1); // Sandy brown
    signGfx.fillRect(signX-60, signY-30, 120, 35);
    
    // Border
    signGfx.lineStyle(3, 0x4E342E, 1);
    signGfx.strokeRect(signX-60, signY-30, 120, 35);
    
    // Text
    const helpText = this.add.text(signX, signY-12, 'Ok, last push!', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#2C1810',
      align: 'center',
      fontStyle: 'bold'
    });
    helpText.setOrigin(0.5, 0.5);
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
   addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.8, h*0.3, 120, 20, 0xffffff);
    addMovingPlatform(scene, w*0.45, h*0.45, w*0.35, w*0.75, 2.2);
    addTrampoline(scene, w*0.18, h*0.65);
    addBurger(scene, w*0.16, h*0.14);
    addBurger(scene, w*0.48, h*0.12);
    addSpike(scene, w*0.37, h*0.75);
    addSpike(scene, w*0.38, h*0.72);
    addSpike(scene, w*0.39, h*0.69);
    addSpike(scene, w*0.40, h*0.66);
    addSpike(scene, w*0.41, h*0.63);
    addSpike(scene, w*0.42, h*0.6);
    addSpike(scene, w*0.43, h*0.57);
    addSpike(scene, w*0.44, h*0.54);
    addSpike(scene, w*0.45, h*0.51);
    addFinish(scene, w*0.9, 120);
  } 
  if (level === 1){
    // Level 2: Trampoline challenge
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    addPlatform(scene, w*0.25, h*0.7, 100, 20, 0x5B3A8F); // Dark purple
    addTrampoline(scene, w*0.68, h*0.5);
    addPlatform(scene, w*0.82, h*0.25, 120, 20, 0x5B3A8F); // Finish platform (dark purple)
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
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    addPlatform(scene, w*0.01, h*0.76, 110, 20, 0x5B3A8F); // Dark purple
    addMovingPlatform(scene, w*0.25, h*0.6, w*0.2, w*0.35, 1.8);
    addPlatform(scene, w*0.01, h*0.5, 80, 20, 0x5B3A8F); // Dark purple
    addMovingPlatform(scene, w*0.5, h*0.5, w*0.45, w*0.6, 2.2);
    addPlatform(scene, w*0.8, h*0.60, 100, 20, 0x5B3A8F); // Dark purple
    addPlatform(scene, w*0.98, h*0.40, 100, 20, 0x5B3A8F); // Dark purple
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
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    addPlatform(scene, w*0.25, h*0.7, 100, 20, 0x5B3A8F); // Dark purple
    addTrampoline(scene, w*0.68, h*0.5);
    addPlatform(scene, w*0.82, h*0.25, 120, 20, 0x5B3A8F); // Finish platform (dark purple)
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
    addSpike(scene, w*0.6, h*0.52);
    addSpike(scene, w*0.6, h*0.55);
    // Burgers
    addBurger(scene, w*0.21, h*0.24); // Near moon
    addTrampoline(scene, w*0.8598, h*0.9);
    addBurger(scene, w*0.86, h*0.85); // Below finish door
    
    addFinish(scene, w*0.88, 100);
  }
   if (level  === 4){
   // Level 5: Final challenge
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    addTrampoline(scene, w*0.2, h*0.75);
    addMovingPlatform(scene, w*0.35, h*0.55, w*0.28, w*0.42, 2.5);
    addSpike(scene, w*0.25, h*0.81);
    addSpike(scene, w*0.38, h*0.65);
    addPlatform(scene, w*0.52, h*0.42, 90, 20, 0x5B3A8F); // Dark purple
    addTrampoline(scene, w*0.62, h*0.5);
    addMovingPlatform(scene, w*0.72, h*0.3, w*0.68, w*0.78, 2);
    addSpike(scene, w*0.58, h*0.48);
    addSpike(scene, w*0.85, h*0.74);
    addSpike(scene, w*0.75, h*0.74);
    addSpike(scene, w*0.8, h*0.74);
    addSpike(scene, w*0.9, h*0.74);
    
    // Burgers
    addBurger(scene, w*0.14, h*0.13); // Near moon
    addTrampoline(scene, w*0.9, h*0.75);
    addTrampoline(scene, w*0.85, h*0.75);
    addTrampoline(scene, w*0.8, h*0.75);
    addTrampoline(scene, w*0.75, h*0.75);
    addBurger(scene, w*0.90, h*0.82); // Below finish door
    
    // Finish door higher up (reachable by jumping from moving platform)
    addFinish(scene, w*0.94, h*0.15);
  }
  
  // Additional levels 6-10
  if(level === 5){
    // Level 6: Path goes RIGHT → UP → LEFT to finish (upper left corner)
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    
    // Path going RIGHT first
    addPlatform(scene, w*0.3, h*0.75, 100, 20, 0x5B3A8F); // Dark purple
    addMovingPlatform(scene, w*0.45, h*0.75, w*0.40, w*0.52, 2.5);
    addPlatform(scene, w*0.62, h*0.75, 100, 20, 0x5B3A8F); // Dark purple
    addSpike(scene, w*0.38, h*0.81);
    addSpike(scene, w*0.54, h*0.71);
    
    // Burger on the right side
    addBurger(scene, w*0.88, h*0.70);
    addPlatform(scene, w*0.88, h*0.78, 90, 20, 0x5B3A8F); // Dark purple
    
    // Path going UP from right
    addPlatform(scene, w*0.8, h*0.5, 100, 20, 0x5B3A8F); // Dark purple
    addPlatform(scene, w*0.8, h*0.83, 56, 12, 0xFFE66D); // Fake trampoline (platform)
    addPlatform(scene, w*0.75, h*0.83, 56, 12, 0xFFE66D); // Fake trampoline (platform)
    addPlatform(scene, w*0.70, h*0.83, 56, 12, 0xFFE66D); // Fake trampoline (platform)
    addUpsideDownSpike(scene, w*0.79, h*0.66);
    addUpsideDownSpike(scene, w*0.775, h*0.66);
    addUpsideDownSpike(scene, w*0.76, h*0.66);
    addUpsideDownSpike(scene, w*0.745, h*0.66);
    addUpsideDownSpike(scene, w*0.73, h*0.66);
    addUpsideDownSpike(scene, w*0.715, h*0.66);
 
    addSpike(scene, w*0.71, h*0.5);
    
    // Path going LEFT to finish
    addPlatform(scene, w*0.58, h*0.35, 90, 20, 0x5B3A8F); // Dark purple
    addPlatform(scene, w*0.505, h*0.25, 90, 20, 0x5B3A8F); // Dark purple
    addSpike(scene, w*0.65, h*0.41);
    addSpike(scene, w*0.48, h*0.51);
    
    // TRAP: Three REAL trampolines close together with spikes above (Avdeev can fit between)
    addTrampoline(scene, w*0.28, h*0.25); // Real trampoline 1
    addTrampoline(scene, w*0.32, h*0.25); // Real trampoline 2  
    addTrampoline(scene, w*0.36, h*0.25); // Real trampoline 3
    addTrampoline(scene, w*0.4, h*0.25);
    
    // Red spikes ABOVE the trampolines (pointing DOWN) - with enough space for Avdeev (60px gap)
    addUpsideDownSpike(scene, w*0.273, h*0.12);
    addUpsideDownSpike(scene, w*0.288, h*0.12);
    addUpsideDownSpike(scene, w*0.303, h*0.12);
    addUpsideDownSpike(scene, w*0.318, h*0.12);
    addUpsideDownSpike(scene, w*0.333, h*0.12);
    addUpsideDownSpike(scene, w*0.348, h*0.12);
    addUpsideDownSpike(scene, w*0.363, h*0.12);
    addUpsideDownSpike(scene, w*0.378, h*0.12);
    addUpsideDownSpike(scene, w*0.393, h*0.12);
    addUpsideDownSpike(scene, w*0.408, h*0.12);
    
    // Burger on left side before finish (stays at same place)
    addBurger(scene, w*0.18, h*0.125);
    
    // Finish door at upper left corner
    addFinish(scene, w*0.12, h*0.08);
  }
  
  if(level === 6){
    // Level 7: CHAOS - Only moving platforms! Start: bottom right → Finish: top left (30% fewer platforms)
    // Starting platform at bottom right
    addPlatform(scene, w*0.92, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    
    // Bottom right area (near start)
    addMovingPlatform(scene, w*0.78, h*0.85, w*0.72, w*0.88, 2.2);
    addSpike(scene, w*0.85, h*0.91);
    
    // Right side moving platforms
    addMovingPlatform(scene, w*0.88, h*0.68, w*0.82, w*0.95, 2.5);
    addMovingPlatform(scene, w*0.75, h*0.58, w*0.68, w*0.82, 2);
    
    // Upper right area - burger location
    addMovingPlatform(scene, w*0.85, h*0.42, w*0.78, w*0.92, 1.9);
    addBurger(scene, w*0.88, h*0.18); // First burger - top right corner
    addMovingPlatform(scene, w*0.88, h*0.25, w*0.82, w*0.95, 2);
    addSpike(scene, w*0.78, h*0.38);
    
    // Middle area - crossing platforms
    addMovingPlatform(scene, w*0.55, h*0.72, w*0.45, w*0.65, 2.8);
    addPlatform(scene, w*0.60, h*0.60, 90, 20, 0x5B3A8F); // Dark purple - SAFE PLATFORM 1
    addMovingPlatform(scene, w*0.60, h*0.45, w*0.50, w*0.70, 2.1);
    addMovingPlatform(scene, w*0.42, h*0.38, w*0.32, w*0.52, 2.6);
    
    // Left side moving platforms
    addMovingPlatform(scene, w*0.32, h*0.68, w*0.22, w*0.42, 2.2);
    addMovingPlatform(scene, w*0.25, h*0.52, w*0.15, w*0.35, 2);
    
    // Bottom left area - burger location
    addPlatform(scene, w*0.12, h*0.82, 80, 20, 0x5B3A8F); // Dark purple - SAFE PLATFORM 2
    addBurger(scene, w*0.12, h*0.75); // Second burger - bottom left corner
    addSpike(scene, w*0.15, h*0.88);
    
    // Upper left area - toward finish
    addMovingPlatform(scene, w*0.15, h*0.28, w*0.08, w*0.25, 1.8);
    addMovingPlatform(scene, w*0.08, h*0.18, w*0.02, w*0.18, 1.5);
    
    // Finish door at top left (no platform needed)
    addFinish(scene, w*0.08, h*0.08);
  }
  
  if(level === 7){
    // Level 8: TRAMPOLINE CHAOS - Only 7 trampolines and fewer spikes
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    
    // ONLY 7 TRAMPOLINES - strategically placed
    addTrampoline(scene, w*0.30, h*0.85); // Bottom left
    addTrampoline(scene, w*0.50, h*0.70); // Middle-low center
    addTrampoline(scene, w*0.70, h*0.85); // Bottom right
    addTrampoline(scene, w*0.25, h*0.55); // Middle left
    addTrampoline(scene, w*0.75, h*0.55); // Middle right
    addTrampoline(scene, w*0.45, h*0.35); // Upper-middle left
    addTrampoline(scene, w*0.85, h*0.25); // Top right (near finish)
    
    // FEWER SPIKES - only 8 total for strategic placement
    addSpike(scene, w*0.40, h*0.90);
    addSpike(scene, w*0.60, h*0.90);
    
    addSpike(scene, w*0.35, h*0.70);
    addSpike(scene, w*0.65, h*0.70);

    addUpsideDownSpike(scene, w*0.485, h*0.64);
    addUpsideDownSpike(scene, w*0.50, h*0.64);
    addUpsideDownSpike(scene, w*0.515, h*0.64);
    
    addUpsideDownSpike(scene, w*0.40, h*0.40);
    addUpsideDownSpike(scene, w*0.60, h*0.40);
    addUpsideDownSpike(scene, w*0.70, h*0.20);
    
    // Burgers
    addBurger(scene, w*0.50, h*0.76); // Near moon
    addBurger(scene, w*0.90, h*0.85); // Bottom right
    
    // Finish door at top right
    addFinish(scene, w*0.92, h*0.08);
  }
  
  if(level === 8){
    // Level 9: Extreme challenge
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    
    // LEFT SPIKE COLUMN - pointing RIGHT (toward the right side) - FULL HEIGHT
    // Positioned at 2% of screen width
    const leftColumnX = w*0.02; // Left spike column at 2%
    const spikeSpacing = 0.03; // Vertical spacing between spikes (3% of height)
    
    // Create left column spikes (pointing right) from bottom to ceiling
    for(let i = 0.95; i >= 0.05; i -= spikeSpacing) {
      addRightPointingSpike(scene, leftColumnX, h*i);
    }
    
    // RIGHT SPIKE COLUMN - pointing LEFT (toward the left side) - WITH GAP AT TOP
    // Goes from bottom to 15% from top (leaves exit gap at top)
    const rightColumnX = w*0.20; // Right spike column at 20%
    
    // Create right column spikes (pointing left) from bottom to near top (leaves gap)
    for(let i = 0.95; i >= 0.15; i -= spikeSpacing) {
      addLeftPointingSpike(scene, rightColumnX, h*i);
    }
    
    // PURPLE CLIMBING PLATFORMS between the spike columns
    // Platforms alternate between left (near 2%) and right (near 20%) columns
    addPlatform(scene, w*0.051, h*0.85, 90, 15, 0x5B3A8F); // Bottom - close to left column
    addPlatform(scene, w*0.155, h*0.60, 90, 15, 0x5B3A8F); // Upper - close to right column
    addPlatform(scene, w*0.051, h*0.4, 90, 15, 0x5B3A8F); // Upper - close to left column
    addPlatform(scene, w*0.18, h*0.15, 90, 15, 0x5B3A8F); // Near top - close to right column
    
    // Bottom right section - moving platform with spike obstacles
    addPlatform(scene, w*0.28, h*0.9, 100, 20, 0x5B3A8F); // Starting platform
    
    // Moving platform at same level - travels toward burger (LONGER - 70px)
    addMovingPlatform(scene, w*0.40, h*0.9, w*0.38, w*0.78, 2.5); // Moves from 38% to 78%
    
    // Three red spike columns (4 spikes each) above the moving platform path - MORE SPACING
    // First column at ~43%
    addSpike(scene, w*0.43, h*0.90);
    addSpike(scene, w*0.43, h*0.87);
    addSpike(scene, w*0.43, h*0.84);
    addSpike(scene, w*0.43, h*0.81);
    
    // Second column at ~58% (15% spacing instead of 12%)
    addSpike(scene, w*0.58, h*0.90);
    addSpike(scene, w*0.58, h*0.87);
    addSpike(scene, w*0.58, h*0.84);
    addSpike(scene, w*0.58, h*0.81);

    addSpike(scene, w*0.58, h*0.62);
    addSpike(scene, w*0.595, h*0.62);
    addSpike(scene, w*0.610, h*0.62);
    addSpike(scene, w*0.625, h*0.62);
    addSpike(scene, w*0.640, h*0.62);
    addSpike(scene, w*0.655, h*0.62);
    addSpike(scene, w*0.670, h*0.62);
    addSpike(scene, w*0.685, h*0.62);
    addSpike(scene, w*0.565, h*0.59);
    addSpike(scene, w*0.7, h*0.59);
    addSpike(scene, w*0.550, h*0.56);
    addSpike(scene, w*0.715, h*0.56);

    addUpsideDownSpike(scene, w*0.781,h*0.329)
    addUpsideDownSpike(scene, w*0.796,h*0.329)
    addUpsideDownSpike(scene, w*0.811,h*0.329)
    addUpsideDownSpike(scene, w*0.826,h*0.329)
    addUpsideDownSpike(scene, w*0.841,h*0.329)
    addUpsideDownSpike(scene, w*0.856,h*0.329)
    addUpsideDownSpike(scene, w*0.871,h*0.329)
    addUpsideDownSpike(scene, w*0.886,h*0.329)
    addUpsideDownSpike(scene, w*0.901,h*0.329)
    addUpsideDownSpike(scene, w*0.916,h*0.329)
    addUpsideDownSpike(scene, w*0.931,h*0.329)
    addUpsideDownSpike(scene, w*0.946,h*0.329)
    addUpsideDownSpike(scene, w*0.961,h*0.329)
    addUpsideDownSpike(scene, w*0.976,h*0.329)
    addUpsideDownSpike(scene, w*0.991,h*0.329)
    
    // Third column at ~73% (15% spacing instead of 12%)
    addSpike(scene, w*0.73, h*0.90);
    addSpike(scene, w*0.73, h*0.87);
    addSpike(scene, w*0.73, h*0.84);
    addSpike(scene, w*0.73, h*0.81);
    
    // Trampoline under burger in bottom right corner
    addTrampoline(scene, w*0.90, h*0.88);

    addPlatform(scene, w*0.43, h*0.53, 310, 15, 0x5B3A8F); 
    addPlatform(scene, w*0.80, h*0.53, 200, 15, 0x5B3A8F);
    addPlatform(scene, w*0.59, h*0.31, 540, 15, 0x5B3A8F); // Moved down by 0.03 (was 0.28)
    
    // Two trampolines on top of the long platform
    addTrampoline(scene, w*0.50, h*0.303); // Moved down by 0.03 (was 0.273)
    addTrampoline(scene, w*0.68, h*0.303); // Moved down by 0.03 (was 0.273)
    
    // Ceiling spikes above trampolines - sticking to ceiling with one side
    // Positioned lower at ~30 pixels down from ceiling (h*0.03 = 3% of height)
    for(let i = 0.45; i <= 0.73; i += 0.015) {
      addUpsideDownSpike(scene, w*i, h*0.03); // At 3% height (~30 pixels from ceiling)
    }
    
    // Spike wall column blocking path from top purple platform to middle platform
    // Creates a wall at left edge of 310px platform (right-pointing spikes) from ceiling to platform level
    // Platform at w*0.43 with width 310, so left edge is at w*0.43 - 155 (half width)
    const platformLeftEdge = w*0.43 - 155;
    for(let i = 0.05; i <= 0.53; i += 0.03) {
      addRightPointingSpike(scene, platformLeftEdge, h*i);
    }
    
    // Burgers
    addBurger(scene, w*0.254, h*0.4); // Near moon (left side)
    addBurger(scene, w*0.90, h*0.85); // Bottom right corner
    
    // Finish door at top right (above the gap in right spike column)
    addFinish(scene, w*0.92, h*0.08);
  }
  
  if(level === 9){
     // Level 10: EXTREME FINALE - Avoid Dad, reach Judo Club! (Wiggly paths, tons of obstacles)
    addPlatform(scene, 150, h-40, 140, 20, 0x5B3A8F); // Starting platform (dark purple)
    
    // BOTTOM SECTION - Wiggly path with Dad obstacles
    addPlatform(scene, w*0.18, h*0.85, 80, 15, 0x5B3A8F);
    
    // Synchronized moving platforms that meet in the middle
    // First platform: moves from 0.24 to 0.34 (range of 0.10)
    // Second platform: moves from 0.34 to 0.44 (range of 0.10) - shares meeting point at 0.34
    addMovingPlatform(scene, w*0.26, h*0.88, w*0.26, w*0.56, 3.0); // Start at left, move right
    addPlatform(scene, w*0.38, h*0.70, 70, 15, 0x5B3A8F);
    addDad(scene, w*0.355, h*0.6); // Dad on the first static platform
    
    
    // MIDDLE SECTION - Tight platforms with Dad and spikes
    addPlatform(scene, w*0.60, h*0.74, 75, 15, 0x5B3A8F);
    addDad(scene, w*0.575, h*0.75); // Dad on platform

    

    addPlatform(scene, w*0.82, h*0.60, 75, 15, 0x5B3A8F);
    
    addTrampoline(scene, w*0.70, h*0.60);
    addTrampoline(scene, w*0.715, h*0.60);
    addTrampoline(scene, w*0.73, h*0.60);
    addTrampoline(scene, w*0.745, h*0.60);
    addTrampoline(scene, w*0.76, h*0.60);
    addTrampoline(scene, w*0.775, h*0.60);


    addSpike(scene, w*0.78, h*0.9);
    addSpike(scene, w*0.765, h*0.9);
    addSpike(scene, w*0.75, h*0.9);
    addSpike(scene, w*0.735, h*0.9);
    addSpike(scene, w*0.72, h*0.9);
    addSpike(scene, w*0.705, h*0.9);
    addSpike(scene, w*0.69, h*0.9);
    addSpike(scene, w*0.675, h*0.9);



    // Right bottom corner SUPER trampoline (2x jump height)
    addPlatform(scene, w*0.84, h*0.9, 160, 15, 0x5B3A8F);
    addSuperTrampoline(scene, w*0.92, h*0.9);
    addBurger(scene, w*0.92, h*0.2); // Bottom right (dangerous)
    
    // SPIKE TUNNEL around supertrampoline - two vertical columns
    // Left column at w*0.88 (pointing RIGHT into tunnel) - WITH ENTRANCE GAP
    const spikeSpacing = 0.03; // 3% vertical spacing
    // Create entrance gap from h*0.8 to h*0.9 (bottom section) - no spikes here
   
    for(let i = 0.74; i >= 0.24; i -= spikeSpacing) {
      addRightPointingSpike(scene, w*0.88, h*i); // Top spikes above entrance
    }
    
    // Right column at w*0.97 (pointing LEFT into tunnel)
    for(let i = 0.95; i >= 0.04; i -= spikeSpacing) {
      addLeftPointingSpike(scene, w*0.97, h*i);
    }

    // Horizontal line of spikes at h*0.5 (splitting level into two parts)
    addHorizontalSpikeLine(scene, 0.02, 0.80, h*0.5, 0.015);
    
    
    addPlatform(scene, w*0.82, h*0.48, 70, 15, 0x5B3A8F);

    
    // UPPER WIGGLY SECTION - Narrow path with multiple Dads
    addPlatform(scene, w*0.75, h*0.38, 65, 15, 0x5B3A8F);
    
    
    addPlatform(scene, w*0.55, h*0.20, 70, 15, 0x5B3A8F);
    addSpike(scene, w*0.58, h*0.26);
    
    // TRICKY TRAMPOLINE SECTION
    addTrampoline(scene, w*0.45, h*0.28);
    addUpsideDownSpike(scene, w*0.45, h*0.15); // Spike above trampoline
    
    // PATH TO FINISH - Very narrow with multiple Dads
    
    addMovingPlatform(scene, w*0.25, h*0.25, w*0.22, w*0.32, 2.5);
    addDad(scene, w*0.30, h*0.33);
    addPlatform(scene, w*0.15, h*0.28, 70, 15, 0x5B3A8F);
    addSpike(scene, w*0.12, h*0.31);
    
    
    // Additional obstacles scattered around
    addSpike(scene, w*0.22, h*0.88);
    
    // Burgers (2 total - hard to get!)
    addBurger(scene, w*0.18, h*0.12); // Near moon (top left)
    
    // Levitating Among Us character in free space (right side)
    addAmongUs(scene, w*0.90, h*0.35);
    
    // Judo Club door at top left corner (finish)
    addJudoClubDoor(scene, w*0.08, h*0.2);
  }
}

function addPlatform(scene, x, y, w, h, color){
  const plat = scene.add.rectangle(x, y, w, h, color);
  scene.physics.add.existing(plat, true);
  platforms.add(plat);
}

function addMovingPlatform(scene, x, y, minX, maxX, speed){
  const mp = scene.physics.add.sprite(x, y, null);
  mp.setDisplaySize(62, 22); // 49px width (30% smaller than 70px), 20px height
  mp.body.setAllowGravity(false);
  mp.body.setImmovable(true);
  mp.body.pushable = false; // Cannot be pushed by player
  mp.body.moves = true; // Allow platform to move
  mp.moveMin = minX;
  mp.moveMax = maxX;
  mp.moveSpeed = speed;
  mp.moveDir = 1;
  
  // Set collision box to match visual size exactly
  mp.body.setSize(49, 20);
  mp.body.setOffset(0, 0);
  
  // Draw darker grey rectangle (create texture if not exists)
  if (!scene.textures.exists('movingPlatformGrey')) {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0xFF9800, 1); // Orange color (was 0x2196F3 blue)
    gfx.fillRect(0, 0, 49, 20); // 49px wide, 20px tall
    gfx.generateTexture('movingPlatformGrey', 49, 20);
    gfx.destroy();
  }
  
  mp.setTexture('movingPlatformGrey');
  movingPlatforms.push(mp);
}

function addTrampoline(scene, x, y){
  const tramp = scene.add.rectangle(x, y, 60, 12, 0xFFE66D);
  scene.physics.add.existing(tramp, true);
  tramp.isTrampoline = true;
  platforms.add(tramp);
}

function addSuperTrampoline(scene, x, y){
  const supertramp = scene.add.rectangle(x, y, 60, 12, 0x00BFFF); // Electric blue color
  scene.physics.add.existing(supertramp, true);
  supertramp.isSuperTrampoline = true; // Mark as super trampoline
  platforms.add(supertramp);
}

function addSpike(scene, x, y){
  const spike = scene.add.triangle(x, y, 0, 12, 10, -12, 20, 12, 0x8B0000); // Dark red spikes
  scene.physics.add.existing(spike, true);
  spike.body.setSize(20, 24); // Full hitbox - matches visual size
  spike.body.setOffset(0, 0); // No offset - covers entire spike
  platforms.add(spike);
  spike.isDeadly = true; // Mark as deadly obstacle
}

function addUpsideDownSpike(scene, x, y){
  const spike = scene.add.triangle(x, y, 0, -12, 10, 12, 20, -12, 0x8B0000); // Dark red spikes
  scene.physics.add.existing(spike, true);
  spike.body.setSize(20, 24); // Full hitbox - matches visual size
  spike.body.setOffset(0, 0); // No offset - covers entire spike
  platforms.add(spike);
  spike.isDeadly = true; // Mark as deadly obstacle
}

function addRightPointingSpike(scene, x, y){
  // Spike pointing to the RIGHT (90 degrees clockwise from upward)
  const spike = scene.add.triangle(x, y, -12, 0, 12, 10, -12, 20, 0x8B0000); // Dark red spikes
  scene.physics.add.existing(spike, true);
  spike.body.setSize(24, 20); // Rotated hitbox
  spike.body.setOffset(0, 0);
  platforms.add(spike);
  spike.isDeadly = true;
}

function addLeftPointingSpike(scene, x, y){
  // Spike pointing to the LEFT (90 degrees counterclockwise from upward)
  const spike = scene.add.triangle(x, y, 12, 0, -12, 10, 12, 20, 0x8B0000); // Dark red spikes
  scene.physics.add.existing(spike, true);
  spike.body.setSize(24, 20); // Rotated hitbox
  spike.body.setOffset(0, 0);
  platforms.add(spike);
  spike.isDeadly = true;
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
    
    // Lettuce (bright green - BIGGER than buns) - NOW FIRST
    ctx.fillStyle = '#7FD17F';
    ctx.fillRect(6, 14, 48, 7); // Main lettuce layer
    ctx.fillRect(4, 16, 2, 2); // Left wavy edge
    ctx.fillRect(54, 16, 2, 2); // Right wavy edge
    ctx.fillRect(3, 18, 2, 2); // Extra left wave
    ctx.fillRect(55, 18, 2, 2); // Extra right wave
    
    // Meat patty (dark brown - BIGGER than buns) - NOW SECOND
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(6, 21, 48, 9); // Bigger meat patty
    
    // Grill marks on meat (darker brown)
    ctx.fillStyle = '#654321';
    ctx.fillRect(12, 21, 2, 9);
    ctx.fillRect(22, 21, 2, 9);
    ctx.fillRect(32, 21, 2, 9);
    ctx.fillRect(42, 21, 2, 9);
    
    // Tomato (red - BIGGER than buns) - NOW THIRD
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(6, 30, 48, 7); // Bigger tomato layer
    
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
  
  // Invisible platform behind door so Avdeev doesn't fall
  const invisiblePlatform = scene.add.rectangle(x, y+65, 100, 20, 0xffffff, 0);
  scene.physics.add.existing(invisiblePlatform, true);
  platforms.add(invisiblePlatform);
  
  const finish = scene.add.rectangle(x, y, 90, 130, 0xffffff, 0);
  scene.physics.add.existing(finish, true);
  finishLine.add(finish);
}

function addJudoClubDoor(scene, x, y){
  // White door with black borders and "JUDO CLUB" text
  const doorGfx = scene.add.graphics();
  
  // Door frame (black border)
  doorGfx.fillStyle(0x000000, 1);
  doorGfx.fillRect(x-47, y-67, 94, 134);
  
  // Door body (white)
  doorGfx.fillStyle(0xFFFFFF, 1);
  doorGfx.fillRect(x-40, y-60, 80, 120);
  
  // White border inside (double border effect)
  doorGfx.lineStyle(3, 0xFFFFFF, 1);
  doorGfx.strokeRect(x-43, y-63, 86, 126);
  
  // Door panels (light gray inset for depth)
  doorGfx.fillStyle(0xEEEEEE, 1);
  doorGfx.fillRect(x-35, y-55, 30, 50); // Top left panel
  doorGfx.fillRect(x+5, y-55, 30, 50); // Top right panel
  doorGfx.fillRect(x-35, y, 30, 50); // Bottom left panel
  doorGfx.fillRect(x+5, y, 30, 50); // Bottom right panel
  
  // Black door handle
  doorGfx.fillStyle(0x000000, 1);
  doorGfx.fillCircle(x+25, y, 8); // Round handle
  doorGfx.fillRect(x+20, y-3, 15, 6); // Handle extension
  
  // "JUDO CLUB" text above door
  const judoText = scene.add.text(x, y-85, 'JUDO CLUB', {
    fontSize: '18px',
    fontFamily: 'Arial Black',
    color: '#FFFFFF',
    stroke: '#000000',
    strokeThickness: 4,
    align: 'center',
    fontStyle: 'bold'
  });
  judoText.setOrigin(0.5);
  
  // Invisible platform behind door so Avdeev doesn't fall
  const invisiblePlatform = scene.add.rectangle(x, y+65, 100, 20, 0xffffff, 0);
  scene.physics.add.existing(invisiblePlatform, true);
  platforms.add(invisiblePlatform);
  
  const finish = scene.add.rectangle(x, y, 90, 130, 0xffffff, 0);
  scene.physics.add.existing(finish, true);
  finishLine.add(finish);
}

function addHorizontalSpikeLine(scene, startPercent, endPercent, yPos, spacing) {
  // Add a horizontal line of upside-down spikes
  // startPercent: starting position (0.02 = 2% from left)
  // endPercent: ending position (0.68 = 68% from left)
  // yPos: vertical position (e.g., h*0.5)
  // spacing: spacing between spikes (0.015 = 1.5% increments)
  const w = scene.scale.width;
  
  for(let i = startPercent; i <= endPercent; i += spacing) {
    addUpsideDownSpike(scene, w*i, yPos);
  }
}

function addAmongUs(scene, x, y) {
  // Create Among Us character using graphics
  const amongGfx = scene.add.graphics();
  
  // Body (red)
  amongGfx.fillStyle(0xFF0000, 1);
  amongGfx.fillRoundedRect(x-20, y-15, 40, 50, 8);
  
  // Visor (light blue/cyan glass)
  amongGfx.fillStyle(0x4FC3F7, 1);
  amongGfx.fillRoundedRect(x-12, y-8, 24, 18, 4);
  
  // Visor reflection (white)
  amongGfx.fillStyle(0xFFFFFF, 0.6);
  amongGfx.fillRect(x-10, y-5, 8, 6);
  
  // Backpack
  amongGfx.fillStyle(0xCC0000, 1);
  amongGfx.fillRoundedRect(x+12, y-10, 12, 30, 4);
  
  // Legs
  amongGfx.fillStyle(0xFF0000, 1);
  amongGfx.fillRoundedRect(x-15, y+30, 12, 8, 4); // Left leg
  amongGfx.fillRoundedRect(x+3, y+30, 12, 8, 4); // Right leg
  
  amongGfx.generateTexture('amongUsChar', 60, 60);
  amongGfx.destroy();
  
  const amongSprite = scene.add.sprite(x, y, 'amongUsChar');
  
  // Add floating/levitating animation
  scene.tweens.add({
    targets: amongSprite,
    y: y - 15, // Float up 15 pixels
    duration: 1500, // 1.5 seconds
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1
  });
}

function createFinishSparks(scene, x, y) {
  // Create colorful sparks flying upward in chaotic/scattered directions
  const colors = [0xFFD700, 0xFF4444, 0x4CAF50, 0x2196F3, 0xFF9800, 0x9C27B0];
  const numSparks = 30;
  
  for(let i = 0; i < numSparks; i++) {
    const color = Phaser.Utils.Array.GetRandom(colors);
    const size = Phaser.Math.Between(6, 12);
    
    // Create spark particle starting from door position
    const spark = scene.add.rectangle(
      x + Phaser.Math.Between(-30, 30), // Spread slightly horizontally
      y,
      size,
      size,
      color
    );
    scene.physics.add.existing(spark);
    
    // Fly UPWARD but in CHAOTIC directions (random angles upward)
    const angle = Phaser.Math.Between(-140, -40); // Wide upward range (-90 is straight up)
    const angleRad = angle * (Math.PI / 180);
    const speed = Phaser.Math.Between(250, 450); // Fast chaotic speeds
    const vx = Math.cos(angleRad) * speed;
    const vy = Math.sin(angleRad) * speed; // Negative = upward
    spark.body.setVelocity(vx, vy);
    spark.body.setGravityY(0); // No gravity - just fly up and fade
    
    // Fade out and rotate as they rise
    scene.tweens.add({
      targets: spark,
      alpha: 0,
      angle: Phaser.Math.Between(-180, 180), // Random rotation
      scale: 0.2,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => spark.destroy()
    });
  }
}

function addDad(scene, x, y){
  // Create Avdeev's Dad obstacle (bald, fat, angry - BIGGER!)
  const scale = 1.4; // 40% bigger than before (was 1)
  
  // Create a graphics object for Dad
  const dadGfx = scene.add.graphics();
  
  // Bald head (larger, rounder)
  dadGfx.fillStyle(0xFFDBAC, 1);
  dadGfx.fillRect(x+13*scale, y+5*scale, 24*scale, 18*scale); // Wider head
  dadGfx.fillRect(x+10*scale, y+8*scale, 30*scale, 15*scale); // Extra wide
  
  // Angry eyes (smaller, mean-looking)
  dadGfx.fillStyle(0xFFFFFF, 1);
  dadGfx.fillCircle(x+18*scale, y+14*scale, 2.5*scale);
  dadGfx.fillCircle(x+32*scale, y+14*scale, 2.5*scale);
  
  dadGfx.fillStyle(0x000000, 1);
  dadGfx.fillCircle(x+18*scale, y+14*scale, 1.2*scale);
  dadGfx.fillCircle(x+32*scale, y+14*scale, 1.2*scale);
  
  // Angry eyebrows (angled down toward center)
  dadGfx.fillStyle(0x3E2723, 1);
  dadGfx.fillRect(x+15*scale, y+11*scale, 6*scale, 2*scale);
  dadGfx.fillRect(x+29*scale, y+11*scale, 6*scale, 2*scale);
  dadGfx.fillRect(x+14*scale, y+9*scale, 2*scale, 2*scale);
  dadGfx.fillRect(x+34*scale, y+9*scale, 2*scale, 2*scale);
  
  // Angry frown (curved DOWN - corners pointing down) - POSITIONED LOWER
  dadGfx.fillStyle(0x000000, 1);
  dadGfx.fillRect(x+20*scale, y+19*scale, 10*scale, 1.5*scale); // Main frown line
  dadGfx.fillRect(x+19*scale, y+20.5*scale, 1.5*scale, 1.5*scale); // Left corner DOWN
  dadGfx.fillRect(x+29.5*scale, y+20.5*scale, 1.5*scale, 1.5*scale); // Right corner DOWN
  
  // Fat neck (double chin)
  dadGfx.fillStyle(0xFFDBAC, 1);
  dadGfx.fillCircle(x+25*scale, y+23*scale, 10*scale, Math.PI, 0);
  dadGfx.fillRect(x+15*scale, y+23*scale, 20*scale, 6*scale);
  
  // Fat body (white t-shirt)
  dadGfx.fillStyle(0xFFFFFF, 1);
  dadGfx.fillRect(x+8*scale, y+29*scale, 34*scale, 20*scale);
  dadGfx.fillRect(x+3*scale, y+32*scale, 8*scale, 15*scale);
  dadGfx.fillRect(x+39*scale, y+32*scale, 8*scale, 15*scale);
  
  // Belt
  dadGfx.fillStyle(0x5D4037, 1);
  dadGfx.fillRect(x+8*scale, y+45*scale, 34*scale, 4*scale);
  
  // Belt buckle
  dadGfx.fillStyle(0xFFD700, 1);
  dadGfx.fillRect(x+23*scale, y+44*scale, 4*scale, 6*scale);
  
  // Dark pants
  dadGfx.fillStyle(0x424242, 1);
  dadGfx.fillRect(x+12*scale, y+49*scale, 12*scale, 10*scale);
  dadGfx.fillRect(x+26*scale, y+49*scale, 12*scale, 10*scale);
  
  // Black shoes
  dadGfx.fillStyle(0x000000, 1);
  dadGfx.fillRect(x+12*scale, y+59*scale, 12*scale, 4*scale); // Left shoe
  dadGfx.fillRect(x+26*scale, y+59*scale, 12*scale, 4*scale); // Right shoe
  
  // Create invisible hitbox for collision detection (bigger to match scale)
  const dadHitbox = scene.add.rectangle(x+25*scale, y+34*scale, 42*scale, 62*scale, 0xFF0000, 0);
  scene.physics.add.existing(dadHitbox, true);
  dadHitbox.isDeadly = true; // Mark as deadly obstacle
  platforms.add(dadHitbox);
}

function createBurgerCrumbs(scene, x, y){
  // Create 10-15 crumb particles
  const numCrumbs = Phaser.Math.Between(10, 15);
  
  for(let i = 0; i < numCrumbs; i++){
    // Random crumb colors (brown, yellow, green for lettuce, red for tomato)
    const colors = [0x8B4513, 0xFFD700, 0x7FD17F, 0xFF4444, 0x8B5A3C];
    const color = Phaser.Utils.Array.GetRandom(colors);
    const size = Phaser.Math.Between(4, 8);
    
    // Create square crumb particle
    const crumb = scene.add.rectangle(x, y, size, size, color);
    scene.physics.add.existing(crumb);
    
    // Random velocity in all directions
    const velocityX = Phaser.Math.Between(-200, 200);
    const velocityY = Phaser.Math.Between(-300, -100); // Mostly upward
    crumb.body.setVelocity(velocityX, velocityY);
    crumb.body.setGravityY(600); // Gravity pulls crumbs down
    
    // Fade out and destroy after 1 second
    scene.tweens.add({
      targets: crumb,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => crumb.destroy()
    });
  }
}

function createDeathAnimation(scene, x, y){
  // Prevent multiple death animations
  if(isDying) return;
  isDying = true;
  
  // Increment death counter
  deathCount++;
  if(deathEl) deathEl.textContent = '💀 ' + deathCount;
  
  // Freeze player movement and hide immediately
  player.setVelocity(0, 0);
  player.body.setAllowGravity(false);
  player.setVisible(false);
  
  // INSTANT EXPLOSION - No falling, no rotation, just pieces!
  const pieceColors = [
    0xFFFFFF, // White (always included)
    playerConfig.kimonoColor, // Kimono color
    playerConfig.beltColor // Belt color
  ];
  
  // Add hair color if not bald
  if(playerConfig.hairColor !== 'bald') {
    pieceColors.push(playerConfig.hairColor);
  }
  
  const numPieces = Phaser.Math.Between(15, 20);
  for(let i = 0; i < numPieces; i++){
    const pieceSize = Phaser.Math.Between(4, 10);
    const color = Phaser.Utils.Array.GetRandom(pieceColors);
    
    const piece = scene.add.rectangle(
      x + Phaser.Math.Between(-20, 20), 
      y + Phaser.Math.Between(-20, 20), 
      pieceSize, 
      pieceSize, 
      color
    );
    scene.physics.add.existing(piece);
    
    // Random UPWARD/OUTWARD velocity (explosion effect)
    const velocityX = Phaser.Math.Between(-150, 150);
    const velocityY = Phaser.Math.Between(-400, -200);
    piece.body.setVelocity(velocityX, velocityY);
    piece.body.setGravityY(0);
    
    // Rotate and fade out
    scene.tweens.add({
      targets: piece,
      angle: Phaser.Math.Between(-360, 360),
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => piece.destroy()
    });
  }
  
  // Respawn after pieces fly away
  scene.time.delayedCall(800, () => {
    respawnPlayer(scene);
    player.setVisible(true);
    player.body.setAllowGravity(true);
    isDying = false;
  });
}

function respawnPlayer(scene){
  const w = scene.scale.width;
  const h = scene.scale.height;
  
  // Spawn at correct position based on level
  let spawnX = 150;
  let spawnY = h - 110;
  
  if(levelIndex === 6) {
    // Level 7: Respawn at bottom right
    spawnX = w * 0.92;
    spawnY = h - 110;
  }
  
  player.setPosition(spawnX, spawnY);
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
  
  // Move moving platforms using velocity for proper physics collision
  movingPlatforms.forEach(mp => {
    // Move platform by updating position directly
    mp.x += mp.moveSpeed * mp.moveDir;
    
    // Check boundaries and reverse direction
    if(mp.x >= mp.moveMax || mp.x <= mp.moveMin){
      mp.moveDir *= -1;
    }
  });
  
  // Direct movement - instant response, instant stop (NO ACCELERATION)
  const speed = 260;
  
  if(wasd.left.isDown){
    player.setVelocityX(-speed); // Instant full speed
    // Flip sprite to face left when moving left
    if(player.lastDirection !== 'left'){
      player.setFlipX(true);
      player.lastDirection = 'left';
    }
  } else if(wasd.right.isDown){
    player.setVelocityX(speed); // Instant full speed
    // Keep sprite facing right when moving right
    if(player.lastDirection !== 'right'){
      player.setFlipX(false);
      player.lastDirection = 'right';
    }
  } else {
    // Stop immediately when no key is pressed
    player.setVelocityX(0);
  }
  
  // Jump with double jump - smoother jumps
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
      
      // Create wind/air burst effect under feet
      createDoubleJumpEffect(this, player.x, player.y + 25);
    }
  }
}

function createDoubleJumpEffect(scene, x, y) {
  // Create multiple wind/air particles bursting downward and outward
  const numParticles = 8;
  
  for(let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2; // Spread particles in circle
    const speed = Phaser.Math.Between(150, 250);
    
    // Create wind particle (white/cyan streak)
    const particle = scene.add.rectangle(x, y, 12, 3, 0xCCFFFF, 0.9);
    particle.setRotation(angle);
    scene.physics.add.existing(particle);
    
    // Burst outward and downward
    const vx = Math.cos(angle) * speed;
    const vy = Math.abs(Math.sin(angle)) * speed + 100; // Force downward
    particle.body.setVelocity(vx, vy);
    particle.body.setGravityY(-400); // Negative gravity to slow down
    
    // Fade out and shrink
    scene.tweens.add({
      targets: particle,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 400,
      ease: 'Power2',
      onComplete: () => particle.destroy()
    });
  }
}

function nextLevel(scene){
  // Fast fade out transition before changing level
  const w = scene.scale.width;
  const h = scene.scale.height;
  const fadeOverlay = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0);
  fadeOverlay.setDepth(1000); // On top of everything
  
  scene.tweens.add({
    targets: fadeOverlay,
    alpha: 1,
    duration: 150, // Much faster fade (was 300)
    ease: 'Power2',
    onComplete: () => {
      levelIndex++; // Sequential progression: 0→1→2→3→4→5→6→7→8→9
      if(levelIndex>=totalLevels){
        // Stop timer when game is completed
        gameEndTime = Date.now();
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
  const finalDeathCountEl = document.getElementById('final-death-count');
  const finalTimerEl = document.getElementById('final-timer');
  const hud = document.getElementById('game-hud');
  const gameRocket = document.getElementById('game-rocket');
  const gameAmongus = document.getElementById('game-amongus');
  const spaceBackground = document.getElementById('space-background');
  
  // Hide all decorative images and space background on congrats screen
  if(gameRocket) gameRocket.classList.remove('active');
  if(gameAmongus) gameAmongus.classList.remove('active');
  if(spaceBackground) spaceBackground.classList.remove('active');
  
  if(finalBurgerScoreEl) finalBurgerScoreEl.textContent = burgerScore;
  
  // Display death count with animation
  if(finalDeathCountEl) {
    finalDeathCountEl.textContent = deathCount;
    finalDeathCountEl.style.animation = 'none';
    setTimeout(() => finalDeathCountEl.style.animation = 'pulse 1s ease-in-out', 10);
  }
  
  // Display final time
  if(finalTimerEl && gameEndTime > 0) {
    const totalTime = gameEndTime - gameStartTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    const milliseconds = Math.floor((totalTime % 1000) / 10);
    finalTimerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    finalTimerEl.style.animation = 'none';
    setTimeout(() => finalTimerEl.style.animation = 'pulse 1s ease-in-out', 10);
  }
  
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
      // 18-20: Very happy with big smile
      // Happy eyes (bigger and brighter)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 3.5*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 3.5*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(18*scale, 13*scale, 1.8*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28*scale, 13*scale, 1.8*scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Happy raised eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(15*scale, 9*scale, 6*scale, 1.5*scale);
      ctx.fillRect(25*scale, 9*scale, 6*scale, 1.5*scale);
      
      // Big happy smile (curved up)
      ctx.fillStyle = '#000000';
      ctx.fillRect(18*scale, 18*scale, 10*scale, 2*scale); // Main smile
      ctx.fillRect(17*scale, 16.5*scale, 2*scale, 1.5*scale); // Left corner up
      ctx.fillRect(27*scale, 16.5*scale, 2*scale, 1.5*scale); // Right corner up
      
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
      // 14-17: Happy and satisfied
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
      
      // Normal happy eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(16*scale, 10*scale, 5*scale, 1.5*scale);
      ctx.fillRect(26*scale, 10*scale, 5*scale, 1.5*scale);
      
      // Nice smile (curved up)
      ctx.fillStyle = '#000000';
      ctx.fillRect(19*scale, 18*scale, 8*scale, 1.5*scale);
      ctx.fillRect(18*scale, 16.5*scale, 1.5*scale, 1.5*scale); // Left corner up
      ctx.fillRect(26.5*scale, 16.5*scale, 1.5*scale, 1.5*scale); // Right corner up
      
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
      // 4-7: Disappointed/Unhappy
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
      
      // Sad lowered eyebrows
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(15*scale, 11*scale, 6*scale, 1.5*scale);
      ctx.fillRect(25*scale, 11*scale, 6*scale, 1.5*scale);
      
      // Frown (curved down)
      ctx.fillStyle = '#000000';
      ctx.fillRect(19*scale, 19*scale, 8*scale, 1.5*scale);
      ctx.fillRect(18*scale, 20.5*scale, 1.5*scale, 1.5*scale); // Left corner down
      ctx.fillRect(26.5*scale, 20.5*scale, 1.5*scale, 1.5*scale); // Right corner down
      
    } else {
      // 0-3: Very sad/starving (X eyes)
      // X eyes (dead/starving)
      ctx.fillStyle = '#000000';
      // Left X
      ctx.fillRect(15.5*scale, 12*scale, 5*scale, 2*scale);
      ctx.fillRect(17*scale, 10.5*scale, 2*scale, 5*scale);
      // Right X
      ctx.fillRect(25.5*scale, 12*scale, 5*scale, 2*scale);
      ctx.fillRect(27*scale, 10.5*scale, 2*scale, 5*scale);
      
      // Very sad eyebrows (angled down heavily)
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(14*scale, 9*scale, 6*scale, 2*scale);
      ctx.fillRect(26*scale, 9*scale, 6*scale, 2*scale);
      
      // Open mouth (shocked/starving - O shape)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(23*scale, 19*scale, 3*scale, 0, Math.PI * 2);
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
  
  // Reset for next playthrough (but keep stats for display)
  levelIndex = 0;
  // Don't reset burgerScore, deathCount, or timer - they're displayed on congrats screen
}

window.addEventListener('resize',()=>{ if(game) game.scale.resize(GAME.width(),GAME.height()); });
