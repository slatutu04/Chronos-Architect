/**
 * Chronos Architect - Core Engine
 * "Time is a slave to movement."
 */

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    mult(n) { return new Vector(this.x * n, this.y * n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const m = this.mag();
        return m > 0 ? new Vector(this.x / m, this.y / m) : new Vector(0, 0);
    }
    dist(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
}

class Player {
    constructor() {
        this.pos = new Vector(0, 0);
        this.vel = new Vector(0, 0);
        this.radius = 12;
        this.speed = 4;
        this.energy = 100;
        this.maxEnergy = 100;
        this.isMoving = false;
        this.dashCooldown = 0;
    }

    update(keys, canvas) {
        this.vel = new Vector(0, 0);
        if (keys['w'] || keys['ArrowUp']) this.vel.y = -1;
        if (keys['s'] || keys['ArrowDown']) this.vel.y = 1;
        if (keys['a'] || keys['ArrowLeft']) this.vel.x = -1;
        if (keys['d'] || keys['ArrowRight']) this.vel.x = 1;

        if (this.vel.mag() > 0) {
            this.vel = this.vel.normalize().mult(this.speed);
            this.isMoving = true;
            // Recharge energy only when moving (Real Time), and recharge faster
            this.energy = Math.min(this.maxEnergy, this.energy + 0.45); // Slightly faster (was 0.15)
        } else {
            this.isMoving = false;
            // No energy recharge while stopped
        }

        // Apply movement
        const nextPos = this.pos.add(this.vel);
        if (!game.checkCollision(nextPos, this.radius)) {
            this.pos = nextPos;
        }

        if (keys[' '] && this.energy >= 30 && this.dashCooldown <= 0 && !game.isTimestopped) {
            this.dash();
        }

        if (this.dashCooldown > 0) this.dashCooldown--;
    }

    dash() {
        const dashDir = this.vel.mag() > 0 ? this.vel.normalize() : new Vector(1, 0);
        const dashDist = 120;

        // Simple raycast for dash collision
        let step = dashDir.mult(5);
        let current = this.pos;
        for (let i = 0; i < dashDist / 5; i++) {
            let next = current.add(step);
            if (game.checkCollision(next, this.radius)) break;
            current = next;
        }

        this.pos = current;
        this.energy -= 30;
        this.dashCooldown = 20;
        game.createParticles(this.pos, '#00f2ff', 20);
    }

    draw(ctx) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f2ff';
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

class Projectile {
    constructor(pos, vel, color = '#ff0055', canPenetrate = false) {
        this.pos = pos;
        this.vel = vel;
        this.color = color;
        this.radius = 4;
        this.active = true;
        this.canPenetrate = canPenetrate;
    }

    update(timeScale) {
        const scaledVel = this.vel.mult(timeScale);
        this.pos = this.pos.add(scaledVel);

        // Only collide with walls if NOT a Sniper projectile
        if (!this.canPenetrate && game.checkCollision(this.pos, this.radius)) {
            this.active = false;
        }

        // Kill bullet if it goes too far out of screenspace
        if (this.pos.x < -1000 || this.pos.x > 5000 || this.pos.y < -1000 || this.pos.y > 5000) {
            this.active = false;
        }

        if (this.pos.dist(game.player.pos) < game.player.radius + this.radius) {
            game.gameOver();
        }
    }

    draw(ctx, timeScale) {
        if (timeScale < 0.5) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            const futurePos = this.pos.add(this.vel.mult(60));
            ctx.lineTo(futurePos.x, futurePos.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(x, y, type = 'fixed') {
        this.pos = new Vector(x, y);
        this.type = type;
        this.shotTimer = 0;
        this.patrolStart = new Vector(x, y);
        this.patrolDir = 1;
        this.chargeTimer = 0;
    }

    update(timeScale, playerPos) {
        if (this.type === 'drone') {
            this.pos.x += 2 * this.patrolDir * timeScale;
            if (Math.abs(this.pos.x - this.patrolStart.x) > 150) this.patrolDir *= -1;
        }

        const fireRate = this.getFireRate();
        this.shotTimer += timeScale;

        if (this.type === 'sniper') {
            if (this.shotTimer > fireRate * 0.6) {
                this.chargeTimer = 1;
            } else {
                this.chargeTimer = 0;
            }
        }

        if (this.shotTimer > fireRate) {
            this.shoot(playerPos);
            this.shotTimer = 0;
            this.chargeTimer = 0;
        }
    }

    getFireRate() {
        switch (this.type) {
            case 'sentinel': return 10;   // Faster rapid fire
            case 'sniper': return 70;     // Balanced sniper shots
            case 'drone': return 40;      // Faster patrol drones
            default: return 30;           // Faster fixed turrets
        }
    }

    shoot(target) {
        const dir = target.sub(this.pos).normalize();
        if (this.type === 'sentinel') {
            game.projectiles.push(new Projectile(this.pos, dir.mult(8), '#ffae00', false));
        } else if (this.type === 'sniper') {
            // ONLY Sniper penetrates walls (true flag)
            game.projectiles.push(new Projectile(this.pos, dir.mult(22), '#00ff88', true));
        } else {
            game.projectiles.push(new Projectile(this.pos, dir.mult(5), '#ff0055', false));
        }
    }

    draw(ctx) {
        ctx.shadowBlur = 15;
        if (this.type === 'fixed') {
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.fillRect(this.pos.x - 15, this.pos.y - 15, 30, 30);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(this.pos.x - 15, this.pos.y - 15, 30, 30);
        } else if (this.type === 'drone') {
            ctx.fillStyle = '#ff00aa';
            ctx.shadowColor = '#ff00aa';
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y - 15);
            ctx.lineTo(this.pos.x + 15, this.pos.y + 15);
            ctx.lineTo(this.pos.x - 15, this.pos.y + 15);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'sentinel') {
            ctx.fillStyle = '#ffae00';
            ctx.shadowColor = '#ffae00';
            ctx.fillRect(this.pos.x - 10, this.pos.y - 20, 20, 40);
            ctx.strokeRect(this.pos.x - 10, this.pos.y - 20, 20, 40);
        } else if (this.type === 'sniper') {
            ctx.fillStyle = '#00ff88';
            ctx.shadowColor = '#00ff88';
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, 18, 0, Math.PI * 2);
            ctx.fill();
            if (this.chargeTimer > 0) {
                const targetDir = game.player.pos.sub(this.pos).normalize();
                ctx.setLineDash([2, 5]);
                ctx.strokeStyle = 'rgba(0, 255, 136, 0.4)';
                ctx.beginPath();
                ctx.moveTo(this.pos.x, this.pos.y);
                ctx.lineTo(this.pos.x + targetDir.x * 2000, this.pos.y + targetDir.y * 2000);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        ctx.shadowBlur = 0;
    }
}

class Key {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.radius = 10;
        this.collected = false;
        this.angle = 0;
    }
    update() {
        this.angle += 0.05;
        if (!this.collected && this.pos.dist(game.player.pos) < 30) {
            this.collected = true;
            game.onKeyCollected();
        }
    }
    draw(ctx) {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff100';
        ctx.fillStyle = '#fff100';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.restore();
    }
}

class ChronosEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.player = new Player();
        this.enemies = [];
        this.projectiles = [];
        this.walls = [];
        this.particles = [];
        this.keys = [];
        this.keysRequired = 0;
        this.keysFound = 0;
        this.exit = null;
        this.level = 1;
        this.maxLevels = 20; // 15 original + 5 new
        this.globalTimeFactor = 0.05;
        this.inputKeys = {};
        this.running = false;
        this.isPaused = false;
        this.loopInitiated = false; // Add guard for single loop
        this.returningScreen = 'start-screen';
        this.selectedLevel = 1; // Track selection in menu

        // Time Stop Stats
        this.timestopEnergy = 100;
        this.isTimestopped = false;
        this.timestopUses = 2;
        this.timestopUnlocked = false;

        window.addEventListener('keydown', e => {
            this.inputKeys[e.key] = true;
            if (this.running && !this.isPaused) {
                if (e.key === 'r' || e.key === 'R') this.toggleTimestop();
            }
            if (e.key === 'Escape') this.handleEscape();
        });
        window.addEventListener('keyup', e => this.inputKeys[e.key] = false);
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initLevel(n) {
        this.enemies = [];
        this.projectiles = [];
        this.walls = [];
        this.particles = [];
        this.keys = [];
        this.keysFound = 0;
        this.keysRequired = 0;
        this.player.energy = 100; // Reset Energy

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.player.pos = new Vector(80, centerY);
        this.exit = new Vector(this.canvas.width - 80, centerY);

        const keyDisplay = document.getElementById('key-display');
        keyDisplay.classList.add('hidden');
        keyDisplay.classList.remove('complete');

        switch (n) {
            case 1:
                this.walls.push({ x: centerX, y: centerY - 100, w: 20, h: 200 });
                this.enemies.push(new Enemy(centerX + 200, centerY, 'fixed'));
                break;
            case 2:
                this.walls.push({ x: 300, y: 0, w: 20, h: centerY - 50 });
                this.walls.push({ x: 300, y: centerY + 50, w: 20, h: centerY });
                this.enemies.push(new Enemy(500, centerY - 100, 'fixed'));
                this.enemies.push(new Enemy(500, centerY + 100, 'fixed'));
                break;
            case 3:
                this.enemies.push(new Enemy(centerX, centerY - 150, 'drone'));
                this.enemies.push(new Enemy(centerX, centerY + 150, 'drone'));
                this.walls.push({ x: centerX - 100, y: centerY - 20, w: 200, h: 40 });
                break;
            case 4:
                this.enemies.push(new Enemy(centerX + 100, centerY, 'sentinel'));
                this.walls.push({ x: centerX - 50, y: 100, w: 20, h: 200 });
                this.walls.push({ x: centerX - 50, y: centerY + 100, w: 20, h: 200 });
                break;
            case 5:
                this.enemies.push(new Enemy(this.canvas.width - 200, centerY, 'sniper'));
                this.walls.push({ x: centerX, y: centerY - 50, w: 40, h: 100 });
                break;
            case 6:
                for (let i = 0; i < 5; i++) {
                    this.walls.push({ x: 200 + i * 150, y: i % 2 ? 0 : 300, w: 30, h: 400 });
                    this.enemies.push(new Enemy(200 + i * 150 + 60, centerY, 'drone'));
                }
                break;
            case 7:
                this.enemies.push(new Enemy(centerX, 150, 'sniper'));
                this.enemies.push(new Enemy(centerX, this.canvas.height - 150, 'sniper'));
                this.enemies.push(new Enemy(centerX + 150, centerY, 'sentinel'));
                this.walls.push({ x: centerX - 100, y: centerY - 100, w: 200, h: 20 });
                this.walls.push({ x: centerX - 100, y: centerY + 100, w: 200, h: 20 });
                break;
            case 8:
                for (let i = 0; i < 4; i++) {
                    this.enemies.push(new Enemy(200 + i * 200, 100, 'sentinel'));
                    this.enemies.push(new Enemy(200 + i * 200, this.canvas.height - 100, 'sentinel'));
                }
                this.walls.push({ x: 150, y: centerY - 10, w: this.canvas.width - 300, h: 20 });
                break;
            case 9:
                for (let i = 0; i < 3; i++) {
                    this.enemies.push(new Enemy(centerX + (i * 100), 50 + (i * 200), 'sniper'));
                    this.walls.push({ x: centerX - 150 + (i * 100), y: 150 + (i * 200), w: 100, h: 20 });
                }
                break;
            case 10:
                this.enemies.push(new Enemy(centerX, centerY - 250, 'sniper'));
                this.enemies.push(new Enemy(centerX, centerY + 250, 'sniper'));
                this.enemies.push(new Enemy(centerX - 250, centerY, 'sentinel'));
                this.enemies.push(new Enemy(centerX + 250, centerY, 'sentinel'));
                this.enemies.push(new Enemy(centerX, centerY, 'fixed'));
                for (let i = 0; i < 12; i++) {
                    const ang = (i / 12) * Math.PI * 2;
                    this.walls.push({ x: centerX + Math.cos(ang) * 150 - 20, y: centerY + Math.sin(ang) * 150 - 20, w: 40, h: 40 });
                }
                this.enemies.push(new Enemy(centerX - 50, centerY - 50, 'drone'));
                this.enemies.push(new Enemy(centerX + 50, centerY + 50, 'drone'));
                break;
            case 11:
                this.keysRequired = 1;
                this.keys.push(new Key(centerX, 100));
                this.enemies.push(new Enemy(centerX, centerY, 'sentinel'));
                // Removed wall around sentinel as requested
                break;
            case 12:
                this.keysRequired = 2;
                this.keys.push(new Key(100, 100));
                this.keys.push(new Key(100, this.canvas.height - 100));
                this.enemies.push(new Enemy(this.canvas.width - 200, centerY, 'drone'));
                // Fixed wall: added passage in the middle
                this.walls.push({ x: centerX, y: 0, w: 20, h: centerY - 100 });
                this.walls.push({ x: centerX, y: centerY + 100, w: 20, h: centerY });
                break;
            case 13:
                this.keysRequired = 3;
                this.keys.push(new Key(centerX, 150));
                this.keys.push(new Key(centerX, centerY));
                this.keys.push(new Key(centerX, this.canvas.height - 150));
                for (let i = 0; i < 3; i++) this.enemies.push(new Enemy(this.canvas.width - 250, 150 + i * 200, 'sniper'));
                break;
            case 14:
                this.keysRequired = 2;
                this.keys.push(new Key(centerX - 50, centerY - 200));
                this.keys.push(new Key(centerX - 50, centerY + 200));
                this.enemies.push(new Enemy(200, centerY, 'sentinel'));
                this.enemies.push(new Enemy(this.canvas.width - 400, centerY, 'sentinel'));
                break;
            case 15:
                this.keysRequired = 4;
                this.keys.push(new Key(200, 200));
                this.keys.push(new Key(this.canvas.width - 200, 200));
                this.keys.push(new Key(200, this.canvas.height - 200));
                this.keys.push(new Key(this.canvas.width - 200, this.canvas.height - 200));
                this.enemies.push(new Enemy(centerX, centerY, 'sniper'));
                this.enemies.push(new Enemy(centerX, 100, 'sentinel'));
                this.enemies.push(new Enemy(centerX, this.canvas.height - 100, 'sentinel'));
                break;

            // CHALLENGE LEVELS (16-20) - TIME STOP MECHANIC
            case 16:
                this.enemies.push(new Enemy(400, centerY - 100, 'sniper'));
                this.enemies.push(new Enemy(400, centerY + 100, 'sniper'));
                this.enemies.push(new Enemy(centerX + 200, centerY - 150, 'sentinel'));
                this.enemies.push(new Enemy(centerX + 200, centerY + 150, 'sentinel'));
                // Wall with Gap in the middle (fixed "impossible" block)
                this.walls.push({ x: centerX, y: 0, w: 20, h: centerY - 100 });
                this.walls.push({ x: centerX, y: centerY + 100, w: 20, h: this.canvas.height - (centerY + 100) });
                break;
            case 17:
                this.keysRequired = 2;
                this.keys.push(new Key(centerX, 100));
                this.keys.push(new Key(centerX, this.canvas.height - 100));
                for (let i = 0; i < 4; i++) this.enemies.push(new Enemy(centerX + (i * 100), centerY + (i % 2 ? 50 : -50), 'sentinel'));
                break;
            case 18: // THE GREAT MAZE
                this.keysRequired = 3;
                // Maze Walls
                for (let i = 1; i < 6; i++) {
                    let wx = i * 200;
                    this.walls.push({ x: wx, y: (i % 2 ? 0 : 300), w: 30, h: 450 });
                }
                this.keys.push(new Key(250, 100));
                this.keys.push(new Key(650, 500));
                this.keys.push(new Key(1050, 100));
                // Sniper coverage
                for (let i = 0; i < 5; i++) this.enemies.push(new Enemy(300 + i * 250, centerY, 'sniper'));
                break;
            case 19:
                this.enemies.push(new Enemy(centerX, centerY, 'fixed'));
                for (let i = 0; i < 8; i++) {
                    const ang = (i / 8) * Math.PI * 2;
                    this.enemies.push(new Enemy(centerX + Math.cos(ang) * 300, centerY + Math.sin(ang) * 300, 'sniper'));
                }
                break;
            case 20: // FINAL BOSS: THE TIME ENGINE
                this.keysRequired = 1;
                this.keys.push(new Key(centerX, centerY));
                for (let i = 0; i < 10; i++) {
                    this.enemies.push(new Enemy(Math.random() * this.canvas.width, Math.random() * this.canvas.height, 'sentinel'));
                }
                for (let i = 0; i < 4; i++) {
                    this.enemies.push(new Enemy(i * 300 + 100, 100, 'sniper'));
                    this.enemies.push(new Enemy(i * 300 + 100, this.canvas.height - 100, 'sniper'));
                }
                break;
        }

        // Show Time Stop HUD only on 16+
        const tsHud = document.getElementById('timestop-hud-container');
        if (n >= 16) {
            tsHud.classList.remove('hidden');
        } else {
            tsHud.classList.add('hidden');
        }

        this.timestopUses = 2; // Reset uses per level
        this.timestopEnergy = 100;
        this.isTimestopped = false;
        this.updateTimeStopUI();

        if (this.keysRequired > 0) {
            keyDisplay.classList.remove('hidden');
            document.getElementById('hud').classList.add('hud-shifted');
            this.updateKeyUI();
        } else {
            document.getElementById('hud').classList.remove('hud-shifted');
        }
        document.getElementById('level-display').innerText = n.toString().padStart(2, '0');
    }

    toggleTimestop() {
        if (!this.running || this.level < 16) return;

        if (!this.isTimestopped) {
            if (this.timestopUses > 0 && this.timestopEnergy > 10) {
                this.isTimestopped = true;
                this.timestopUses--;
                this.createParticles(this.player.pos, '#fff100', 50);
            }
        } else {
            this.isTimestopped = false;
        }
        this.updateTimeStopUI();
    }

    updateTimeStopUI() {
        const fill = document.getElementById('timestop-fill');
        const usesTxt = document.getElementById('timestop-uses');
        if (fill) fill.style.width = this.timestopEnergy + '%';
        if (usesTxt) usesTxt.innerText = `Uses: ${this.timestopUses}/2`;
    }

    onKeyCollected() {
        this.keysFound++;
        this.updateKeyUI();
        this.createParticles(this.player.pos, '#fff100', 30);
    }

    updateKeyUI() {
        const el = document.getElementById('key-display');
        if (this.keysFound >= this.keysRequired) {
            el.innerText = "Chaves coletadas!";
            el.classList.add('complete');
        } else {
            el.innerText = `Chaves coletadas: ${this.keysFound}/${this.keysRequired}`;
            el.classList.remove('complete');
        }
    }

    checkCollision(pos, radius) {
        if (pos.x < 0 || pos.x > this.canvas.width || pos.y < 0 || pos.y > this.canvas.height) return true;
        for (let wall of this.walls) {
            if (pos.x + radius > wall.x && pos.x - radius < wall.x + wall.w &&
                pos.y + radius > wall.y && pos.y - radius < wall.y + wall.h) {
                return true;
            }
        }
        return false;
    }

    createParticles(pos, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                pos: new Vector(pos.x, pos.y),
                vel: new Vector((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
                life: 1.0,
                color: color
            });
        }
    }

    start() {
        this.inputKeys = {};
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('controls-screen').classList.add('hidden');

        this.running = true;
        this.isPaused = false;
        this.initLevel(this.level);

        // ONLY call loop if it has never been started
        if (!this.loopInitiated) {
            this.loopInitiated = true;
            this.loop();
        }
        window.focus();
    }

    showControls() {
        this.returningScreen = 'start-screen';
        this.hideAllOverlays();
        document.getElementById('controls-screen').classList.remove('hidden');
    }

    showControlsFromPause() {
        this.returningScreen = 'pause-screen';
        this.hideAllOverlays();
        document.getElementById('controls-screen').classList.remove('hidden');
    }

    showMenu() {
        this.hideAllOverlays();
        document.getElementById(this.returningScreen).classList.remove('hidden');
    }

    hideAllOverlays() {
        const screens = ['start-screen', 'pause-screen', 'controls-screen', 'level-select-screen', 'death-screen', 'clear-screen', 'unlock-screen', 'quit-screen'];
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.add('hidden');
        });
    }

    showLevelSelect() {
        this.returningScreen = 'start-screen';
        this.openLevelSelect();
    }

    showLevelSelectFromPause() {
        this.returningScreen = 'pause-screen';
        this.openLevelSelect();
    }

    openLevelSelect() {
        this.hideAllOverlays();
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        this.selectedLevel = this.level;

        for (let i = 1; i <= this.maxLevels; i++) {
            const btn = document.createElement('button');
            btn.className = 'level-btn' + (i === this.selectedLevel ? ' selected' : '');
            btn.innerText = i;
            btn.onclick = () => {
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedLevel = i;
            };
            grid.appendChild(btn);
        }
        document.getElementById('level-select-screen').classList.remove('hidden');
    }

    confirmLevelSelect() {
        this.level = this.selectedLevel;
        // If they select level 16+, assume they unlocked it for testing
        if (this.level >= 16) this.timestopUnlocked = true;

        this.hideAllOverlays();
        this.running = true;
        this.isPaused = false;
        this.initLevel(this.level);
        if (!this.loopInitiated) {
            this.loopInitiated = true;
            this.loop();
        }
        window.focus();
    }

    handleEscape() {
        // If in controls or level select, go back
        if (!document.getElementById('controls-screen').classList.contains('hidden') ||
            !document.getElementById('level-select-screen').classList.contains('hidden')) {
            this.showMenu();
            return;
        }
        // If playing, toggle pause
        if (this.running) {
            this.togglePause();
        }
    }

    quit() {
        this.running = false;
        this.hideAllOverlays();
        document.getElementById('quit-screen').classList.remove('hidden');
    }

    gameOver() {
        this.running = false;
        document.getElementById('death-screen').classList.remove('hidden');
    }

    restartLevel() {
        this.hideAllOverlays();
        this.initLevel(this.level);
        this.running = true;
        if (!this.loopInitiated) {
            this.loopInitiated = true;
            this.loop();
        }
    }

    nextLevel() {
        if (this.level === 15 && !this.timestopUnlocked) {
            this.showUnlockCutscene();
            return;
        }

        this.level++;
        if (this.level > this.maxLevels) {
            alert("MISÃO CUMPRIDA! VOCÊ DOMINOU O TEMPO.");
            this.level = 1;
            this.timestopUnlocked = false;
        }
        this.hideAllOverlays();
        this.initLevel(this.level);
        this.running = true;
        if (!this.loopInitiated) {
            this.loopInitiated = true;
            this.loop();
        }
    }

    showUnlockCutscene() {
        this.running = false;
        document.getElementById('clear-screen').classList.add('hidden');
        document.getElementById('unlock-screen').classList.remove('hidden');
    }

    finalizeUnlock() {
        this.timestopUnlocked = true;
        document.getElementById('unlock-screen').classList.add('hidden');
        this.level = 16;
        this.initLevel(this.level);
        this.running = true;
        this.loop();
    }

    togglePause() {
        if (!this.running) return;

        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.hideAllOverlays();
            document.getElementById('pause-screen').classList.remove('hidden');
        } else {
            this.resume();
        }
    }

    resume() {
        this.isPaused = false;
        this.inputKeys = {}; // IMPORTANT: Flush all inputs
        this.hideAllOverlays();
        window.focus();
    }

    showControlsFromPause() {
        this.returningScreen = 'pause-screen';
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('controls-screen').classList.remove('hidden');
    }

    update() {
        if (!this.running || this.isPaused) return;

        if (this.isTimestopped) {
            // TIME STOP MODES
            document.getElementById('time-overlay').className = 'timestop-active';
            document.getElementById('time-state').innerText = 'TIME STOP';

            this.player.update(this.inputKeys, this.canvas);

            // Drain energy if moving
            if (this.player.isMoving) {
                this.timestopEnergy -= 0.8;
                if (this.timestopEnergy <= 0) {
                    this.timestopEnergy = 0;
                    this.isTimestopped = false;
                }
            }
            this.updateTimeStopUI();

            // Particles and Key collection still work
            this.particles.forEach(p => {
                p.pos = p.pos.add(p.vel);
                p.life -= 0.02;
            });
            this.particles = this.particles.filter(p => p.life > 0);
            this.keys.forEach(k => k.update());

        } else {
            // NORMAL MODES
            this.globalTimeFactor = this.player.isMoving ? 1.0 : 0.05;

            // Significantly faster recharge for Time Stop (was 0.02)
            if (this.level >= 16 && this.timestopEnergy < 100) {
                this.timestopEnergy += 0.15;
                this.updateTimeStopUI();
            }

            const energyFill = document.getElementById('energy-fill');
            energyFill.style.width = this.player.energy + '%';
            if (this.player.energy < 30) {
                energyFill.classList.add('low-energy');
            } else {
                energyFill.classList.remove('low-energy');
            }

            document.getElementById('time-state').innerText = this.player.isMoving ? 'TEMPO REAL' : 'SLOW MOTION';
            document.getElementById('time-overlay').className = this.player.isMoving ? '' : 'slow-mo';

            this.player.update(this.inputKeys, this.canvas);
            this.enemies.forEach(e => e.update(this.globalTimeFactor, this.player.pos));
            this.keys.forEach(k => k.update());
            this.projectiles.forEach(p => p.update(this.globalTimeFactor));
            this.projectiles = this.projectiles.filter(p => p.active);

            this.particles.forEach(p => {
                p.pos = p.pos.add(p.vel);
                p.life -= 0.02;
            });
            this.particles = this.particles.filter(p => p.life > 0);
        }

        if (this.player.pos.dist(this.exit) < 30 && this.keysFound >= this.keysRequired) {
            this.running = false;
            document.getElementById('clear-screen').classList.remove('hidden');
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = '#000';
        this.walls.forEach(w => {
            this.ctx.fillRect(w.x, w.y, w.w, w.h);
            this.ctx.strokeStyle = '#333';
            this.ctx.strokeRect(w.x, w.y, w.w, w.h);
        });
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = (this.keysFound >= this.keysRequired) ? '#00ff88' : '#333';
        this.ctx.beginPath();
        this.ctx.arc(this.exit.x, this.exit.y, 30, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.projectiles.forEach(p => p.draw(this.ctx, this.globalTimeFactor));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.keys.forEach(k => k.draw(this.ctx));
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.pos.x, p.pos.y, 3, 3);
        });
        this.ctx.globalAlpha = 1.0;
        this.player.draw(this.ctx);
    }

    loop() {
        if (!this.running) {
            this.loopInitiated = false; // Reset so it can be restarted
            return;
        }

        if (!this.isPaused) {
            this.update();
            this.draw();
        }

        requestAnimationFrame(() => this.loop());
    }
}

const game = new ChronosEngine();
