// SpaceDex - Completely rebuilt for reliability

const GAME = { width: () => window.innerWidth, height: () => window.innerHeight };

// Global state
let game;
let player;
let platforms, spikes, finishLine, movingPlatforms = [];
let cursors, wasd;
let score = 0, levelIndex = 0, totalLevels = 10;
let scoreEl, levelEl;
let hasDoubleJumped = false;
let particleEmitters = [];
let backgroundMusic = null;
let musicEnabled = true;

const playerConfig = { color: 0x6C5CE7, hat:false, glasses:false, chain:false, hair:false };

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
  score = 0;
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

  scoreEl = document.getElementById('score');
  levelEl = document.getElementById('level');

  function hideAllMenus(){
    if(mainMenu) mainMenu.classList.remove('active');
    if(settingsMenu) settingsMenu.classList.remove('active');
    if(characterMenu) characterMenu.classList.remove('active');
    if(congratsScreen) congratsScreen.classList.remove('active');
  }

  // Character customization
  const colorBoxes = document.querySelectorAll('.color-box');
  colorBoxes.forEach(b => b.addEventListener('click', () => {
    colorBoxes.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    playerConfig.color = parseInt(b.dataset.color.replace('#','0x'));
  }));
  const hatT = document.getElementById('hat-toggle'); if(hatT) hatT.addEventListener('change', e=> playerConfig.hat = e.target.checked);
  const glT = document.getElementById('glasses-toggle'); if(glT) glT.addEventListener('change', e=> playerConfig.glasses = e.target.checked);
  const chT = document.getElementById('chain-toggle'); if(chT) chT.addEventListener('change', e=> playerConfig.chain = e.target.checked);
  const hrT = document.getElementById('hair-toggle'); if(hrT) hrT.addEventListener('change', e=> playerConfig.hair = e.target.checked);
  
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
});

function preload(){
  // Music handled by HTML5 audio tag
}

function create(){
  const w = this.scale.width;
  const h = this.scale.height;
  
  // Reset state
  hasDoubleJumped = false;
  movingPlatforms = [];
  
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
  
  // Create Dex with accessories (bigger - 35x35)
  player = this.physics.add.sprite(150, h-70, null);
  player.setDisplaySize(35, 35);
  player.setBounce(0.1);
  player.setCollideWorldBounds(true);
  player.setDrag(0, 0); // No drag - instant speed
  player.setMaxVelocity(280, 1200); // Cap at movement speed
  
  // Draw Dex with eyes, hands, and accessories (bigger canvas)
  const gfx = this.add.graphics();
  gfx.fillStyle(playerConfig.color, 1);
  gfx.fillRoundedRect(0, 0, 35, 35, 5); // body
  // Eyes
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle(11, 12, 5);
  gfx.fillCircle(24, 12, 5);
  gfx.fillStyle(0x000000, 1);
  gfx.fillCircle(11, 12, 3);
  gfx.fillCircle(24, 12, 3);
  // Hands
  gfx.fillStyle(playerConfig.color, 1);
  gfx.fillRect(-5, 15, 5, 10); // left hand
  gfx.fillRect(35, 15, 5, 10); // right hand
  
  // Accessories
  if(playerConfig.hat){
    gfx.fillStyle(0xFF6B6B, 1);
    gfx.fillTriangle(8, 0, 17, -14, 27, 0); // red hat (bigger, better positioned)
  }
  if(playerConfig.glasses){
    gfx.lineStyle(3, 0x000000, 1);
    gfx.strokeCircle(11, 12, 7);
    gfx.strokeCircle(24, 12, 7);
    gfx.lineBetween(18, 12, 17, 12); // bridge
  }
  if(playerConfig.chain){
    gfx.lineStyle(4, 0xFFD700, 1);
    gfx.beginPath();
    gfx.arc(17, 24, 10, 0, Math.PI, false);
    gfx.strokePath();
  }
  if(playerConfig.hair){
    gfx.fillStyle(0x8B4513, 1);
    gfx.fillRect(8, -5, 5, 8);
    gfx.fillRect(14, -6, 6, 9);
    gfx.fillRect(21, -5, 5, 8);
  }
  
  gfx.generateTexture('dex', 36, 28);
  gfx.destroy();
  player.setTexture('dex');
  
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
  if(scoreEl) scoreEl.textContent = 'Score: '+score;
}

function buildLevelLayout(scene, level){
  const w = scene.scale.width;
  const h = scene.scale.height;
  
  finishLine = scene.physics.add.staticGroup();
  
  if(level === 0){
    // Level 1: Basic platforming
   addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.8, h*0.3, 120, 20, 0xffffff);
    addMovingPlatform(scene, w*0.45, h*0.45, w*0.4, w*0.5, 1.5);
    addTrampoline(scene, w*0.2, h*0.61);
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
    addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.25, h*0.7, 100, 20, 0x6B9BD1);
    addTrampoline(scene, w*0.68, h*0.5);
    addPlatform(scene, w*0.82, h*0.25, 120, 20, 0xffffff);
    addMovingPlatform(scene, w*0.35, h*0.55, w*0.3, w*0.45, 2);
    addSpike(scene, w*0.32, h*0.76);
    addSpike(scene, w*0.6, h*0.46);
    addFinish(scene, w*0.88, 100);
  } 
  if(level === 2){
    // Level 3: Moving platforms
 addPlatform(scene, 150, h-40, 140, 20, 0xffffff);
    addPlatform(scene, w*0.01, h*0.76, 110, 20, 0xA9C7F7);
    addMovingPlatform(scene, w*0.25, h*0.65, w*0.2, w*0.35, 1.8);
    addMovingPlatform(scene, w*0.5, h*0.5, w*0.45, w*0.6, 2.2);
    addPlatform(scene, w*0.7, h*0.35, 100, 20, 0xA9C7F7);
    addSpike(scene, w*0.3, h*0.72);
    addSpike(scene, w*0.4, h*0.7);
    addSpike(scene, w*0.58, h*0.58);
    addSpike(scene, w*0.65, h*0.55);
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
    addSpike(scene, w*0.6, h*0.14);
    addSpike(scene, w*0.6, h*0.17);
    addSpike(scene, w*0.6, h*0.20);
    addSpike(scene, w*0.6, h*0.31);
    addSpike(scene, w*0.6, h*0.34);
    addSpike(scene, w*0.6, h*0.37);
    addSpike(scene, w*0.6, h*0.49);
    addSpike(scene, w*0.6, h*0.46);
    addSpike(scene, w*0.6, h*0.43);
    addSpike(scene, w*0.6, h*0.40);
    addSpike(scene, w*0.6, h*0.49);
    addSpike(scene, w*0.6, h*0.52);
    addSpike(scene, w*0.6, h*0.55);
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

function addFinish(scene, x, y){
  const gfx = scene.add.graphics();
  for(let r=0; r<6; r++){
    for(let c=0; c<4; c++){
      const col = (r+c)%2===0 ? 0x000000 : 0xffffff;
      gfx.fillStyle(col, 1);
      gfx.fillRect(x-40+c*20, y-60+r*20, 20, 20);
    }
  }
  const finish = scene.add.rectangle(x, y, 80, 120, 0xffffff, 0);
  scene.physics.add.existing(finish, true);
  finishLine.add(finish);
}

function respawnPlayer(scene){
  player.setPosition(150, scene.scale.height - 70);
  player.setVelocity(0, 0);
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
  if(onGround) hasDoubleJumped = false;
  
  if(Phaser.Input.Keyboard.JustDown(wasd.up)){
    if(onGround){
      player.setVelocityY(-550); // Higher jump
    } else if(!hasDoubleJumped){
      player.setVelocityY(-580); // More powerful double jump
      hasDoubleJumped = true;
    }
  }
}

function nextLevel(scene){
  score++;
  if(scoreEl) scoreEl.textContent='Score: '+score;
  levelIndex++; // Sequential progression: 0→1→2→3→4→5→6→7→8→9
  if(levelIndex>=totalLevels){
    // Show congratulations screen
    const congratsScreen = document.getElementById('congrats-screen');
    const finalScoreEl = document.getElementById('final-score');
    const hud = document.getElementById('game-hud');
    
    if(finalScoreEl) finalScoreEl.textContent = score;
    if(hud) hud.classList.add('hidden');
    if(congratsScreen) congratsScreen.classList.add('active');
    
    // Reset for next playthrough
    levelIndex = 0;
    score = 0;
    return;
  }
  if(levelEl) levelEl.textContent='Level: '+(levelIndex+1);
  scene.scene.restart();
}

window.addEventListener('resize',()=>{ if(game) game.scale.resize(GAME.width(),GAME.height()); });