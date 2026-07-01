const CONFIG = {
    MAP_WIDTH: 4800,
    MAP_HEIGHT: 3600,
    MAX_ENEMIES: 24,
    BUILDING_COUNT: 72,
    TREE_COUNT: 260,
    WATER_COUNT: 10,
    ROAD_COUNT: 8,
    DRAW_MARGIN: 220
};
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
minimapCanvas.width = 160;
minimapCanvas.height = 160;
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;
let fpsTimer = 0;
const keys = {};
let gameActive = true;
const settings = { difficulty: 'normal', sensitivity: 1.0, quality: 'medium', particles: true, fullscreen: false, controlMode: 'keyboard' };
const player = { x: 0, y: 0, width: 26, height: 26, speed: 6, health: 100, maxHealth: 100, shield: 55, maxShield: 55, ammo: 1800, maxAmmo: 2500, reserve: 90, score: 0, kills: 0, angle: 0, weapon: 'rifle', vx: 0, vy: 0 };
function resetPlayerPosition() {
    player.x = CONFIG.MAP_WIDTH / 2;
    player.y = CONFIG.MAP_HEIGHT / 2;
}
resetPlayerPosition();
const weapons = { rifle: { damage: 80, fireRate: 110, spread: 0.04, speed: 10, ammo: 1800 }, shotgun: { damage: 32, fireRate: 520, spread: 0.38, speed: 8, ammo: 8 }, sniper: { damage: 98, fireRate: 1250, spread: 0, speed: 14, ammo: 5 }, pistol: { damage: 16, fireRate: 70, spread: 0.12, speed: 9, ammo: 20 } };
const bullets = [];
const buildings = [];
const enemies = [];
const particles = [];
const trees = [];
const lakes = [];
const roads = [];
const explosions = [];
let zones = [];
let lastShot = 0;
let spawnCounter = 0;
let crosshair = document.getElementById('crosshair');
let currentRound = 0;
const TOTAL_ROUNDS = 10;
const ROUND_ENEMIES = 16;
let roundKillsThisRound = 0;
let roundBannerTimer = 0;
let roundTransitionTimer = 0;
const roundBanner = document.getElementById('roundBanner');

// === CONTROLES TÁCTILES ===
let controlMode = 'keyboard';
const touchControls = document.getElementById('touchControls');
const joystickContainer = document.querySelector('.joystick-container');
const joystickStick = document.getElementById('joystickStick');
const fireButton = document.getElementById('fireButton');
const cycleWeaponButton = document.getElementById('cycleWeaponButton');
const controlModeText = document.getElementById('controlModeText');

// Variables del joystick
let joystickCenterX = 60;
let joystickCenterY = 60;
let joystickRadius = 60;
let joystickActive = false;
let joystickX = 0;
let joystickY = 0;

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function randRange(min, max) { return Math.random() * (max - min) + min; }
function buildZones() {
    zones = [
        {
            name: 'FOREST EDGE',
            x: CONFIG.MAP_WIDTH * 0.24,
            y: CONFIG.MAP_HEIGHT * 0.22,
            radius: Math.min(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT) * 0.16,
            color: 'rgba(92, 170, 84, 0.16)',
            enemyBias: { basic: 0.55, fast: 0.2, tank: 0.1, elite: 0.15 },
            bossChance: 0.14,
            bossActive: false,
            effect: 'HEAL +0.04 HP/s'
        },
        {
            name: 'CITY CORE',
            x: CONFIG.MAP_WIDTH * 0.58,
            y: CONFIG.MAP_HEIGHT * 0.58,
            radius: Math.min(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT) * 0.18,
            color: 'rgba(255, 197, 88, 0.14)',
            enemyBias: { basic: 0.4, fast: 0.25, tank: 0.2, elite: 0.15 },
            bossChance: 0.18,
            bossActive: false,
            effect: 'DAMAGE +10%'
        },
        {
            name: 'SWAMP BAY',
            x: CONFIG.MAP_WIDTH * 0.8,
            y: CONFIG.MAP_HEIGHT * 0.24,
            radius: Math.min(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT) * 0.16,
            color: 'rgba(67, 122, 184, 0.16)',
            enemyBias: { basic: 0.35, fast: 0.2, tank: 0.25, elite: 0.2 },
            bossChance: 0.16,
            bossActive: false,
            effect: 'SHIELD +0.04/s'
        }
    ];
}
function getCurrentZone(x = player.x, y = player.y) {
    return zones.find(zone => Math.hypot(x - zone.x, y - zone.y) <= zone.radius) || null;
}
function trySpawnZoneBoss(zone) {
    if (!zone || zone.bossActive || Math.random() > zone.bossChance) return false;
    const boss = new Enemy(zone.x + randRange(-120, 120), zone.y + randRange(-120, 120), 'boss');
    boss.isBoss = true;
    boss.zoneName = zone.name;
    enemies.push(boss);
    zone.bossActive = true;
    return true;
}
function applyZoneEffects(zone = getCurrentZone()) {
    if (!zone) return;
    if (zone.name === 'FOREST EDGE') {
        player.health = clamp(player.health + 0.04, 0, player.maxHealth);
    } else if (zone.name === 'CITY CORE') {
        player.shield = clamp(player.shield + 0.02, 0, player.maxShield);
    } else if (zone.name === 'SWAMP BAY') {
        player.shield = clamp(player.shield + 0.04, 0, player.maxShield);
    }
}
function isOnScreen(x, y, width = 0, height = 0, cameraX, cameraY, margin = CONFIG.DRAW_MARGIN) {
    const sx = x - cameraX + canvas.width / 2;
    const sy = y - cameraY + canvas.height / 2;
    return sx + width / 2 + margin >= 0 && sx - width / 2 - margin <= canvas.width &&
           sy + height / 2 + margin >= 0 && sy - height / 2 - margin <= canvas.height;
}

function showRoundBanner(text, duration = 1400) {
    if (!roundBanner) return;
    roundBanner.textContent = text;
    roundBanner.classList.add('show');
    roundBannerTimer = duration;
}

function updateRoundBanner(delta) {
    if (!roundBanner) return;
    if (roundBannerTimer > 0) {
        roundBannerTimer -= delta;
        if (roundBannerTimer <= 0) roundBanner.classList.remove('show');
    }
}

function startRound() {
    if (currentRound >= TOTAL_ROUNDS) {
        showRoundBanner('VICTORY!', 3000);
        gameActive = false;
        return;
    }
    currentRound += 1;
    roundKillsThisRound = 0;
    roundTransitionTimer = 0;
    enemies.length = 0;
    bullets.length = 0;
    particles.length = 0;
    explosions.length = 0;
    document.getElementById('gameOver').classList.remove('active');
    showRoundBanner(`ROUND ${currentRound}`, 1400);
    for (let i = 0; i < ROUND_ENEMIES; i++) spawnEnemy(false);
    gameActive = true;
}

// Inicializar joystick
function initJoystick() {
    if (!joystickContainer) return;
    const rect = joystickContainer.getBoundingClientRect();
    joystickCenterX = rect.width / 2;
    joystickCenterY = rect.height / 2;
    joystickRadius = rect.width / 2 - 10;
    if (joystickStick) joystickStick.style.transform = 'translate(-50%, -50%)';
}

// Manejar toque en joystick
function handleJoystickTouch(e) {
    e.preventDefault();
    if (!joystickContainer) return;
    const rect = joystickContainer.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const dx = x - joystickCenterX;
    const dy = y - joystickCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > joystickRadius) {
        const ratio = joystickRadius / distance;
        joystickX = dx * ratio;
        joystickY = dy * ratio;
    } else {
        joystickX = dx;
        joystickY = dy;
    }

    if (joystickStick) joystickStick.style.transform = `translate(${joystickX}px, ${joystickY}px)`;
    joystickActive = true;
}

function handleJoystickEnd() {
    joystickX = 0;
    joystickY = 0;
    if (joystickStick) joystickStick.style.transform = 'translate(-50%, -50%)';
    joystickActive = false;
    player.vx = 0;
    player.vy = 0;
}

// Botón de disparo
function handleFireTouchStart(e) {
    e.preventDefault();
    fireWeapon();
    if (fireButton) fireButton.style.transform = 'scale(0.95)';
}

function handleFireTouchEnd(e) {
    e.preventDefault();
    if (fireButton) fireButton.style.transform = 'scale(1)';
}

// Botón de cambiar arma
function handleCycleTouch(e) {
    e.preventDefault();
    cycleWeapon();
    if (cycleWeaponButton) {
        cycleWeaponButton.style.transform = 'scale(0.95)';
        setTimeout(() => {
            if (cycleWeaponButton) cycleWeaponButton.style.transform = 'scale(1)';
        }, 100);
    }
}

// Actualizar modo de control
function updateControlMode() {
    controlMode = settings.controlMode;
    if (touchControls) touchControls.classList.toggle('active', controlMode === 'touch');

    if (controlMode === 'touch') {
        if (controlModeText) controlModeText.textContent = 'CONTROLES: TÁCTIL';
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    } else {
        if (controlModeText) controlModeText.textContent = 'CONTROLES: TECLADO';
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }
    saveSettings();
}

class Particle {
    constructor(x, y, vx, vy, color, life = 24, size = 2) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.life = life; this.maxLife = life; this.size = size;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.vy += 0.18; this.life--;
    }
    draw(cx, cameraX, cameraY) {
        const alpha = clamp(this.life / this.maxLife, 0, 1);
        cx.globalAlpha = alpha;
        cx.fillStyle = this.color;
        const sx = this.x - cameraX + canvas.width / 2;
        const sy = this.y - cameraY + canvas.height / 2;
        cx.fillRect(sx - this.size / 2, sy - this.size / 2, this.size, this.size);
        cx.globalAlpha = 1;
    }
}

class Explosion {
    constructor(x, y, radius = 1) {
        this.x = x; this.y = y; this.radius = radius; this.life = 24; this.total = 24;
    }
    draw(cx, cameraX, cameraY) {
        const amount = 1 - this.life / this.total;
        const sx = this.x - cameraX + canvas.width / 2;
        const sy = this.y - cameraY + canvas.height / 2;
        cx.save();
        cx.globalAlpha = clamp(0.18 + amount * 0.7, 0, 1);
        cx.beginPath();
        cx.arc(sx, sy, amount * 70 * this.radius, 0, Math.PI * 2);
        cx.fillStyle = '#ff8b38';
        cx.fill();
        cx.globalAlpha = clamp(0.08 + amount * 0.4, 0, 1);
        cx.beginPath();
        cx.arc(sx, sy, amount * 42 * this.radius, 0, Math.PI * 2);
        cx.fillStyle = '#fff7a0';
        cx.fill();
        cx.restore();
    }
}

class Building {
    constructor(x, y, w, h, color) {
        this.x = x; this.y = y; this.w = w; this.h = h; this.color = color;
        this.health = 100; this.maxHealth = 100;
    }
    draw(cx, cameraX, cameraY) {
        const sx = this.x - cameraX + canvas.width / 2;
        const sy = this.y - cameraY + canvas.height / 2;
        if (sx + this.w / 2 < 0 || sx - this.w / 2 > canvas.width || sy + this.h / 2 < 0 || sy - this.h / 2 > canvas.height) return;
        cx.fillStyle = 'rgba(12, 16, 18, 0.98)';
        cx.fillRect(sx - this.w / 2 + 8, sy - this.h / 2 + 8, this.w, this.h);
        cx.fillStyle = this.color;
        cx.fillRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
        cx.strokeStyle = '#08120f';
        cx.lineWidth = 2;
        cx.strokeRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
        const windowSize = 14;
        cx.fillStyle = '#f2f7d8';
        for (let ix = -this.w / 2 + 18; ix < this.w / 2 - 12; ix += 34) {
            for (let iy = -this.h / 2 + 18; iy < this.h / 2 - 12; iy += 34) {
                cx.fillRect(sx + ix, sy + iy, windowSize, windowSize);
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(sx + ix, sy + iy, windowSize, windowSize);
            }
        }
        if (this.health < this.maxHealth) {
            cx.fillStyle = '#222222';
            cx.fillRect(sx - this.w / 2, sy - this.h / 2 - 10, this.w, 6);
            cx.fillStyle = '#0cf78b';
            cx.fillRect(sx - this.w / 2, sy - this.h / 2 - 10, (this.health / this.maxHealth) * this.w, 6);
        }
    }
}

class Enemy {
    constructor(x, y, type = 'basic') {
        this.x = x; this.y = y; this.w = 24; this.h = 24; this.type = type;
        this.shootCooldown = 0;
        const types = {
            basic: { color: '#f55a4d', speed: 2.6, health: 42, damage: 18, reward: 120 },
            fast: { color: '#f7b24f', speed: 4.1, health: 28, damage: 12, reward: 90 },
            tank: { color: '#d0365c', speed: 1.6, health: 80, damage: 22, reward: 180 },
            elite: { color: '#9a4eff', speed: 3.2, health: 64, damage: 26, reward: 220 }
        };
        const data = types[type] || types.basic;
        this.color = data.color; this.speed = data.speed; this.health = data.health;
        this.maxHealth = data.health; this.damage = data.damage; this.reward = data.reward;
        this.vx = 0; this.vy = 0;
    }
    update() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        if (distance > 40) {
            this.vx = (dx / distance) * this.speed;
            this.vy = (dy / distance) * this.speed;
        } else {
            this.vx *= 0.88; this.vy *= 0.88;
        }
        this.x += this.vx; this.y += this.vy;
        this.x = clamp(this.x, this.w / 2, CONFIG.MAP_WIDTH - this.w / 2);
        this.y = clamp(this.y, this.h / 2, CONFIG.MAP_HEIGHT - this.h / 2);
        if (distance < 40 && this.shootCooldown <= 0) {
            player.health -= this.damage * 0.3;
            this.shootCooldown = 50;
        }
        this.shootCooldown--;
    }
    draw(cx, cameraX, cameraY) {
        const sx = this.x - cameraX + canvas.width / 2;
        const sy = this.y - cameraY + canvas.height / 2;
        if (sx + this.w / 2 < 0 || sx - this.w / 2 > canvas.width || sy + this.h / 2 < 0 || sy - this.h / 2 > canvas.height) return;
        cx.fillStyle = this.color;
        cx.fillRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
        if (this.isBoss) {
            cx.fillStyle = '#ffd166';
            cx.fillRect(sx - this.w / 2 - 6, sy - this.h / 2 - 8, this.w + 12, 5);
            cx.fillStyle = '#ff5d73';
            cx.fillRect(sx - this.w / 2 - 6, sy - this.h / 2 - 8, ((this.health / this.maxHealth) * (this.w + 12)), 5);
        }
        cx.strokeStyle = '#0a0a0a';
        cx.lineWidth = 2;
        cx.strokeRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
        cx.fillStyle = '#111';
        cx.fillRect(sx - 10, sy - this.h / 2 - 8, 20, 4);
        cx.fillStyle = '#f4f4f4';
        cx.fillRect(sx - 10, sy - this.h / 2 - 8, (this.health / this.maxHealth) * 20, 4);
    }
}

function generateBuildings() {
    buildings.length = 0;
    let attempts = 0;
    while (buildings.length < CONFIG.BUILDING_COUNT && attempts < 1600) {
        attempts++;
        const w = randRange(100, 210);
        const h = randRange(90, 180);
        const x = randRange(w / 2 + 80, CONFIG.MAP_WIDTH - w / 2 - 80);
        const y = randRange(h / 2 + 80, CONFIG.MAP_HEIGHT - h / 2 - 80);
        const overlaps = buildings.some(b =>
            Math.abs(b.x - x) < (b.w + w) * 0.55 && Math.abs(b.y - y) < (b.h + h) * 0.55
        );
        if (!overlaps) {
            const color = `hsl(${randRange(180, 220)}, 30%, ${randRange(22, 38)}%)`;
            buildings.push(new Building(x, y, w, h, color));
        }
    }
}

function generateEnvironment() {
    trees.length = 0; lakes.length = 0; roads.length = 0;
    for (let i = 0; i < CONFIG.TREE_COUNT; i++) {
        trees.push({ x: randRange(40, CONFIG.MAP_WIDTH - 40), y: randRange(40, CONFIG.MAP_HEIGHT - 40), size: randRange(14, 26) });
    }
    for (let i = 0; i < CONFIG.WATER_COUNT; i++) {
        lakes.push({ x: randRange(200, CONFIG.MAP_WIDTH - 200), y: randRange(200, CONFIG.MAP_HEIGHT - 200), w: randRange(180, 260), h: randRange(110, 190) });
    }
    for (let i = 0; i < CONFIG.ROAD_COUNT; i++) {
        const horizontal = Math.random() > 0.5;
        if (horizontal) {
            const y = CONFIG.MAP_HEIGHT * ((i + 1) / (CONFIG.ROAD_COUNT + 1));
            roads.push({ x: 0, y, w: CONFIG.MAP_WIDTH, h: 42, horizontal: true });
        } else {
            const x = CONFIG.MAP_WIDTH * ((i + 1) / (CONFIG.ROAD_COUNT + 1));
            roads.push({ x, y: 0, w: 42, h: CONFIG.MAP_HEIGHT, horizontal: false });
        }
    }
}

function spawnEnemy(allowBoss = true) {
    const zone = getCurrentZone(player.x, player.y) || zones[Math.floor(Math.random() * zones.length)] || null;
    if (allowBoss && zone && !zone.bossActive && Math.random() < zone.bossChance) {
        trySpawnZoneBoss(zone);
        return;
    }
    const edge = Math.floor(Math.random() * 4);
    let x = player.x; let y = player.y;
    const distance = zone ? 620 : 480;
    if (edge === 0) { x = clamp(player.x + randRange(-distance, distance), 60, CONFIG.MAP_WIDTH - 60); y = player.y - distance; }
    if (edge === 1) { x = player.x + distance; y = clamp(player.y + randRange(-distance, distance), 60, CONFIG.MAP_HEIGHT - 60); }
    if (edge === 2) { x = clamp(player.x + randRange(-distance, distance), 60, CONFIG.MAP_WIDTH - 60); y = player.y + distance; }
    if (edge === 3) { x = player.x - distance; y = clamp(player.y + randRange(-distance, distance), 60, CONFIG.MAP_HEIGHT - 60); }
    const bias = zone ? zone.enemyBias : { basic: 0.55, fast: 0.2, tank: 0.15, elite: 0.1 };
    const roll = Math.random();
    let type = 'basic';
    let cumulative = 0;
    for (const [name, weight] of Object.entries(bias)) {
        cumulative += weight;
        if (roll < cumulative) {
            type = name;
            break;
        }
    }
    enemies.push(new Enemy(clamp(x, 45, CONFIG.MAP_WIDTH - 45), clamp(y, 45, CONFIG.MAP_HEIGHT - 45), type));
}

function fireWeapon() {
    if (!gameActive || player.ammo <= 0) return;
    const now = performance.now();
    const weapon = weapons[player.weapon];
    if (now - lastShot < weapon.fireRate) return;
    lastShot = now;
    const bulletsCount = player.weapon === 'shotgun' ? 8 : 1;
    const zone = getCurrentZone();
    const damageMultiplier = zone && zone.name === 'CITY CORE' ? 1.1 : 1;
    for (let i = 0; i < bulletsCount; i++) {
        const spread = player.weapon === 'sniper' ? 0 : randRange(-weapon.spread, weapon.spread);
        const angle = player.angle + spread;
        bullets.push({
            x: player.x + Math.cos(angle) * 30,
            y: player.y + Math.sin(angle) * 30,
            vx: Math.cos(angle) * weapon.speed,
            vy: Math.sin(angle) * weapon.speed,
            damage: weapon.damage * damageMultiplier,
            life: 280
        });
    }
    player.ammo--;
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(
            player.x, player.y,
            Math.cos(player.angle + randRange(-0.5,0.5)) * randRange(2,4),
            Math.sin(player.angle + randRange(-0.5,0.5)) * randRange(2,4),
            '#ffb663', 16, 2
        ));
    }
}

// MODIFICADA: updatePlayer con soporte para controles táctiles
function updatePlayer() {
    player.vx = 0;
    player.vy = 0;

    const zone = getCurrentZone();
    let movementSpeed = player.speed;
    if (zone && zone.name === 'CITY CORE') movementSpeed += 0.6;
    if (zone && zone.name === 'SWAMP BAY') movementSpeed -= 0.4;

    if (controlMode === 'keyboard') {
        if (keys['w']) player.vy -= movementSpeed;
        if (keys['s']) player.vy += movementSpeed;
        if (keys['a']) player.vx -= movementSpeed;
        if (keys['d']) player.vx += movementSpeed;
    } else if (controlMode === 'touch' && joystickActive) {
        const normalizedX = joystickX / joystickRadius;
        const normalizedY = joystickY / joystickRadius;
        player.vx = normalizedX * movementSpeed;
        player.vy = normalizedY * movementSpeed;
    }

    player.x += player.vx;
    player.y += player.vy;
    player.x = clamp(player.x, player.width / 2, CONFIG.MAP_WIDTH - player.width / 2);
    player.y = clamp(player.y, player.height / 2, CONFIG.MAP_HEIGHT - player.height / 2);

    for (const building of buildings) {
        if (player.x > building.x - building.w / 2 - player.width / 2 &&
            player.x < building.x + building.w / 2 + player.width / 2 &&
            player.y > building.y - building.h / 2 - player.height / 2 &&
            player.y < building.y + building.h / 2 + player.height / 2) {
            player.x -= player.vx;
            player.y -= player.vy;
        }
    }

    applyZoneEffects(zone);

    if (player.health <= 0) endGame();
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0) { bullets.splice(i, 1); continue; }
        if (b.x < 0 || b.x > CONFIG.MAP_WIDTH || b.y < 0 || b.y > CONFIG.MAP_HEIGHT) { bullets.splice(i, 1); continue; }
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.x > e.x - e.w / 2 && b.x < e.x + e.w / 2 && b.y > e.y - e.h / 2 && b.y < e.y + e.h / 2) {
                e.health -= b.damage;
                bullets.splice(i, 1);
                if (Math.random() < 0.5) {
                    for (let p = 0; p < 6; p++)
                        particles.push(new Particle(b.x, b.y, randRange(-1.6,1.6), randRange(-1.6,1.6), '#ffb56b', 18, 2));
                }
                if (e.health <= 0) {
                    enemies.splice(j, 1);
                    player.kills++;
                    roundKillsThisRound++;
                    player.score += e.reward || 150;
                    player.health = clamp(player.health + 8, 0, player.maxHealth);
                    if (e.isBoss) {
                        const bossZone = zones.find(zone => zone.name === e.zoneName);
                        if (bossZone) bossZone.bossActive = false;
                    }
                    explosions.push(new Explosion(e.x, e.y, e.isBoss ? 1.5 : 1.1));
                }
                break;
            }
        }
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        if (enemy.health <= 0) { enemies.splice(i, 1); continue; }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].life--;
        if (explosions[i].life <= 0) explosions.splice(i, 1);
    }
}

function drawMap(cameraX, cameraY) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0d1b29');
    gradient.addColorStop(1, '#081014');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 - cameraX, canvas.height / 2 - cameraY);
    ctx.fillStyle = '#112a18';
    ctx.fillRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);

    for (const zone of zones) {
        if (!isOnScreen(zone.x, zone.y, zone.radius * 2, zone.radius * 2, cameraX, cameraY, 120)) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
        ctx.fillStyle = zone.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 16px Segoe UI';
        ctx.fillText(zone.name, zone.x - zone.radius * 0.7, zone.y - zone.radius - 10);
        ctx.restore();
    }

    for (const road of roads) {
        if (!isOnScreen(road.x + road.w / 2, road.y + road.h / 2, road.w, road.h, cameraX, cameraY, 120)) continue;
        ctx.fillStyle = '#2e3f35';
        ctx.fillRect(road.x, road.y, road.w, road.h);
        ctx.strokeStyle = '#94ffb3';
        ctx.lineWidth = 2;
        if (road.horizontal) {
            const y = road.y + road.h / 2;
            for (let x = 0; x < CONFIG.MAP_WIDTH; x += 36) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke();
            }
        } else {
            const x = road.x + road.w / 2;
            for (let y = 0; y < CONFIG.MAP_HEIGHT; y += 36) {
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 18); ctx.stroke();
            }
        }
    }

    for (const lake of lakes) {
        if (!isOnScreen(lake.x, lake.y, lake.w, lake.h, cameraX, cameraY, 140)) continue;
        ctx.fillStyle = 'rgba(31, 100, 190, 0.8)';
        ctx.beginPath();
        ctx.ellipse(lake.x, lake.y, lake.w, lake.h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 220, 255, 0.5)';
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    for (const tree of trees) {
        if (!isOnScreen(tree.x, tree.y, tree.size * 1.8, tree.size * 1.8, cameraX, cameraY, 60)) continue;
        ctx.fillStyle = '#2b4f1b';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#122309';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + tree.size * 0.2, tree.size * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5cd08c';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - tree.size * 0.4, tree.size * 0.62, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = (canvas.width / 2 - cameraX) % 80; x < canvas.width; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = (canvas.height / 2 - cameraY) % 80; y < canvas.height; y += 80) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function drawBuildings(cameraX, cameraY) {
    for (const building of buildings) {
        if (!isOnScreen(building.x, building.y, building.w, building.h, cameraX, cameraY, 80)) continue;
        building.draw(ctx, cameraX, cameraY);
    }
}

function drawEnemies(cameraX, cameraY) {
    for (const enemy of enemies) {
        if (!isOnScreen(enemy.x, enemy.y, enemy.w, enemy.h, cameraX, cameraY, 80)) continue;
        enemy.draw(ctx, cameraX, cameraY);
    }
}

function drawBullets(cameraX, cameraY) {
    for (const bullet of bullets) {
        const sx = bullet.x - cameraX + canvas.width / 2;
        const sy = bullet.y - cameraY + canvas.height / 2;
        ctx.fillStyle = '#ffe868';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
}

function drawPlayer(cameraX, cameraY) {
    const sx = player.x - cameraX + canvas.width / 2;
    const sy = player.y - cameraY + canvas.height / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#e2ffbd';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.fillStyle = '#0d2928';
    ctx.fillRect(5, -7, 18, 14);
    ctx.restore();
}

function drawMinimap(cameraX, cameraY) {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minimapCtx.fillStyle = '#081410';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minimapCtx.fillStyle = '#1b7a2e';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const scaleX = minimapCanvas.width / CONFIG.MAP_WIDTH;
    const scaleY = minimapCanvas.height / CONFIG.MAP_HEIGHT;
    for (const lake of lakes) {
        minimapCtx.fillStyle = '#4fa6ff';
        minimapCtx.beginPath();
        minimapCtx.ellipse(lake.x * scaleX, lake.y * scaleY, lake.w * 0.45 * scaleX, lake.h * 0.45 * scaleY, 0, 0, Math.PI * 2);
        minimapCtx.fill();
    }
    minimapCtx.fillStyle = '#8ed18d';
    for (const tree of trees) {
        minimapCtx.fillRect(tree.x * scaleX - 1, tree.y * scaleY - 1, 2, 2);
    }
    minimapCtx.fillStyle = '#bebebe';
    for (const building of buildings) {
        minimapCtx.fillRect((building.x - building.w / 2) * scaleX, (building.y - building.h / 2) * scaleY, building.w * scaleX, building.h * scaleY);
    }
    for (const zone of zones) {
        minimapCtx.strokeStyle = 'rgba(255,255,255,0.28)';
        minimapCtx.lineWidth = 1;
        minimapCtx.beginPath();
        minimapCtx.arc(zone.x * scaleX, zone.y * scaleY, zone.radius * scaleX, 0, Math.PI * 2);
        minimapCtx.stroke();
        minimapCtx.fillStyle = 'rgba(255,255,255,0.72)';
        minimapCtx.fillRect(zone.x * scaleX - 2, zone.y * scaleY - 2, 4, 4);
    }
    minimapCtx.fillStyle = '#fa5f5f';
    minimapCtx.fillRect(player.x * scaleX - 3, player.y * scaleY - 3, 6, 6);
    minimapCtx.fillStyle = '#ffcb42';
    for (const enemy of enemies) {
        const size = enemy.isBoss ? 6 : 4;
        minimapCtx.fillRect(enemy.x * scaleX - size / 2, enemy.y * scaleY - size / 2, size, size);
    }
}

function updateHUD() {
    document.getElementById('fps').textContent = `FPS: ${fps}`;
    document.getElementById('kills').textContent = player.kills;
    document.getElementById('score').textContent = player.score;
    document.getElementById('enemyCount').textContent = enemies.length;
    document.getElementById('ammo').textContent = `${player.ammo} / ${player.reserve}`;
    document.getElementById('weaponType').textContent = player.weapon.toUpperCase();
    const currentZone = getCurrentZone();
    document.getElementById('zoneText').textContent = `ZONE: ${currentZone ? currentZone.name.toUpperCase() : 'OPEN FIELD'}`;
    document.getElementById('zoneEffectText').textContent = `EFFECT: ${currentZone ? currentZone.effect : 'NONE'}`;
    document.getElementById('healthFill').style.width = `${(player.health / player.maxHealth) * 100}%`;
    document.getElementById('shieldFill').style.width = `${(player.shield / player.maxShield) * 100}%`;
    document.getElementById('healthText').textContent = `${Math.max(0, Math.round(player.health))} / ${player.maxHealth}`;
}

function endGame() {
    gameActive = false;
    document.getElementById('gameOver').classList.add('active');
    document.getElementById('finalScore').textContent = `FINAL SCORE: ${player.score}`;
    document.getElementById('enemiesKilled').textContent = `TOTAL KILLS: ${player.kills}`;
}

// MODIFICADA: loadSettings con soporte para controlMode
function loadSettings() {
    const raw = localStorage.getItem('fps_shooter_settings');
    if (!raw) return;
    try {
        const saved = JSON.parse(raw);
        Object.assign(settings, saved);
        if (!['keyboard', 'touch'].includes(settings.controlMode)) {
            settings.controlMode = 'keyboard';
        }
    } catch (e) {}
}

async function loadRuntimeConfig() {
    try {
        const response = await fetch('map_config.json');
        if (!response.ok) return;
        const loaded = await response.json();
        Object.assign(CONFIG, loaded);
        buildZones();
        resetPlayerPosition();
    } catch (e) {}
}

function saveSettings() {
    localStorage.setItem('fps_shooter_settings', JSON.stringify(settings));
}

// MODIFICADA: syncSettingsUI con controlMode
function syncSettingsUI() {
    document.getElementById('controlMode').value = settings.controlMode;
    document.getElementById('difficulty').value = settings.difficulty;
    document.getElementById('sensitivity').value = settings.sensitivity;
    document.getElementById('sensitivityValue').textContent = `${settings.sensitivity.toFixed(1)}x`;
    document.getElementById('quality').value = settings.quality;
    document.getElementById('particles').checked = settings.particles;
    document.getElementById('fullscreen').checked = settings.fullscreen;
}

function switchWeapon(name) {
    if (!weapons[name]) return;
    player.weapon = name;
    player.ammo = Math.min(player.ammo, player.reserve + weapons[name].ammo);
}

function cycleWeapon() {
    const order = ['rifle', 'shotgun', 'sniper', 'pistol'];
    const index = order.indexOf(player.weapon);
    const next = order[(index + 1) % order.length];
    switchWeapon(next);
}

// MODIFICADA: init con inicialización de controles táctiles
async function init() {
    loadSettings();
    buildZones();
    await loadRuntimeConfig();
    syncSettingsUI();

    // Inicializar joystick
    initJoystick();

    // Configurar modo de control inicial
    controlMode = settings.controlMode;
    updateControlMode();

    generateBuildings();
    generateEnvironment();
    startRound();

    // Registrar eventos de teclado
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    requestAnimationFrame(gameLoop);
}

// === EVENT LISTENERS ORIGINALES ===
function handleKeyDown(e) {
    const key = e.key.toLowerCase();
    keys[key] = true;
    if (key === '1') switchWeapon('rifle');
    if (key === '2') switchWeapon('shotgun');
    if (key === '3') switchWeapon('sniper');
    if (key === '4') switchWeapon('pistol');
    if (key === 'escape') {
        if (document.getElementById('settingsMenu').classList.contains('active')) {
            closeSettings();
        } else {
            openSettings();
        }
    }
}

function handleKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
}

function openSettings() {
    document.getElementById('settingsMenu').classList.add('active');
    gameActive = false;
}

function closeSettings() {
    document.getElementById('settingsMenu').classList.remove('active');
    gameActive = true;
}

function gameLoop(time) {
    const delta = time - lastTime;
    lastTime = time;
    frameCount++;
    fpsTimer += delta;
    if (fpsTimer >= 1000) {
        fps = Math.round((frameCount * 1000) / fpsTimer);
        frameCount = 0;
        fpsTimer = 0;
    }

    updateRoundBanner(delta);

    if (gameActive) {
        updatePlayer();
        updateBullets();
        updateEnemies();
        if (settings.particles) updateParticles();
        updateExplosions();

        if (currentRound > 0 && enemies.length === 0 && roundKillsThisRound >= ROUND_ENEMIES && roundTransitionTimer <= 0) {
            roundTransitionTimer = 1200;
        }

        if (roundTransitionTimer > 0) {
            roundTransitionTimer -= delta;
            if (roundTransitionTimer <= 0) {
                startRound();
            }
        }
    }

    const cameraX = player.x;
    const cameraY = player.y;

    drawMap(cameraX, cameraY);
    drawBuildings(cameraX, cameraY);

    if (settings.quality !== 'low') {
        for (const explosion of explosions) explosion.draw(ctx, cameraX, cameraY);
    }

    if (settings.particles) {
        for (const particle of particles) particle.draw(ctx, cameraX, cameraY);
    }

    drawEnemies(cameraX, cameraY);
    drawBullets(cameraX, cameraY);
    drawPlayer(cameraX, cameraY);
    drawMinimap(cameraX, cameraY);
    updateHUD();

    requestAnimationFrame(gameLoop);
}

// === EVENT LISTENERS PARA MOVIMIENTO DEL RATÓN (solo en modo teclado) ===
window.addEventListener('mousemove', (e) => {
    if (controlMode === 'touch') return;
    const mouseX = (e.clientX - canvas.width / 2) * settings.sensitivity;
    const mouseY = (e.clientY - canvas.height / 2) * settings.sensitivity;
    player.angle = Math.atan2(mouseY, mouseX);
    crosshair.style.left = `${e.clientX}px`;
    crosshair.style.top = `${e.clientY}px`;
});

// Click para disparar (solo en modo teclado)
canvas.addEventListener('click', (e) => {
    if (controlMode === 'keyboard') {
        fireWeapon();
    }
});

// Context menu para cambiar arma (solo en modo teclado)
canvas.addEventListener('contextmenu', (e) => {
    if (controlMode === 'keyboard') {
        e.preventDefault();
        cycleWeapon();
    }
});

// === EVENT LISTENERS PARA CONTROLES TÁCTILES ===
if (joystickContainer) {
    joystickContainer.addEventListener('touchstart', handleJoystickTouch, { passive: false });
    joystickContainer.addEventListener('touchmove', handleJoystickTouch, { passive: false });
    joystickContainer.addEventListener('touchend', handleJoystickEnd);
    joystickContainer.addEventListener('touchcancel', handleJoystickEnd);

    // Para testing en PC
    joystickContainer.addEventListener('mousedown', handleJoystickTouch);
    joystickContainer.addEventListener('mousemove', (e) => {
        if (e.buttons === 1 && controlMode === 'touch') {
            handleJoystickTouch(e);
        }
    });
    joystickContainer.addEventListener('mouseup', handleJoystickEnd);
    joystickContainer.addEventListener('mouseleave', handleJoystickEnd);
}

if (fireButton) {
    fireButton.addEventListener('touchstart', handleFireTouchStart, { passive: false });
    fireButton.addEventListener('touchend', handleFireTouchEnd);
    fireButton.addEventListener('mousedown', handleFireTouchStart);
    fireButton.addEventListener('mouseup', handleFireTouchEnd);
}

if (cycleWeaponButton) {
    cycleWeaponButton.addEventListener('touchstart', handleCycleTouch, { passive: false });
    cycleWeaponButton.addEventListener('click', handleCycleTouch);
}

// === EVENT LISTENERS PARA CONFIGURACIÓN ===
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettings').addEventListener('click', closeSettings);

document.getElementById('applySettings').addEventListener('click', () => {
    settings.fullscreen = document.getElementById('fullscreen').checked;
    settings.particles = document.getElementById('particles').checked;
    settings.difficulty = document.getElementById('difficulty').value;
    settings.sensitivity = parseFloat(document.getElementById('sensitivity').value);
    settings.quality = document.getElementById('quality').value;
    settings.controlMode = document.getElementById('controlMode').value;

    saveSettings();
    updateControlMode();
    closeSettings();
});

document.getElementById('controlMode').addEventListener('change', (e) => {
    settings.controlMode = e.target.value;
    updateControlMode();
});

document.getElementById('difficulty').addEventListener('change', (e) => settings.difficulty = e.target.value);
document.getElementById('sensitivity').addEventListener('input', (e) => {
    settings.sensitivity = parseFloat(e.target.value);
    document.getElementById('sensitivityValue').textContent = `${settings.sensitivity.toFixed(1)}x`;
});
document.getElementById('quality').addEventListener('change', (e) => settings.quality = e.target.value);
document.getElementById('particles').addEventListener('change', (e) => settings.particles = e.target.checked);
document.getElementById('fullscreen').addEventListener('change', (e) => {
    settings.fullscreen = e.target.checked;
    if (settings.fullscreen && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    }
});

document.getElementById('playAgain').addEventListener('click', () => {
    resetPlayerPosition();
    player.health = 100;
    player.shield = 55;
    player.ammo = 1800;
    player.reserve = 90;
    player.score = 0;
    player.kills = 0;
    player.weapon = 'rifle';
    enemies.length = 0;
    bullets.length = 0;
    particles.length = 0;
    explosions.length = 0;
    currentRound = 0;
    roundKillsThisRound = 0;
    roundTransitionTimer = 0;
    roundBannerTimer = 0;
    gameActive = true;
    document.getElementById('gameOver').classList.remove('active');
    spawnCounter = 0;
    startRound();
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    minimapCanvas.width = 160;
    minimapCanvas.height = 160;
    setTimeout(initJoystick, 100);
});

// Iniciar el juego
init();