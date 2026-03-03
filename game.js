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
            // Energy recharges ONLY while moving, and slower
            this.energy = Math.min(this.maxEnergy, this.energy + 0.15);
        } else {
            this.isMoving = false;
            // No energy recharge while stopped
        }

        // Apply movement
        const nextPos = this.pos.add(this.vel);
        if (!game.checkCollision(nextPos, this.radius)) {
            this.pos = nextPos;
        }

        if (keys[' '] && this.energy >= 30 && this.dashCooldown <= 0) {
            this.dash();
        }

        if (this.dashCooldown > 0) this.dashCooldown--;
    }

    dash() {
        const dashDir = this.vel.mag() > 0 ? this.vel.normalize() : new Vector(1, 0);
        const dashDist = 120;
        const targetPos = this.pos.add(dashDir.mult(dashDist));

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
        // Glow effect
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
    constructor(pos, vel, color = '#ff0055') {
        this.pos = pos;
        this.vel = vel;
        this.color = color;
        this.radius = 4;
        this.active = true;
    }

    update(timeScale) {
        const scaledVel = this.vel.mult(timeScale);
        this.pos = this.pos.add(scaledVel);

        if (game.checkCollision(this.pos, this.radius)) {
            this.active = false;
        }

        if (this.pos.dist(game.player.pos) < game.player.radius + this.radius) {
            game.gameOver();
        }
    }

    draw(ctx, timeScale) {
        // Ghost Path (Only when slow-mo)
        if (timeScale < 0.5) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
            ctx.beginPath();
            ctx.moveTo(this.pos.x, this.pos.y);
            const futurePos = this.pos.add(this.vel.mult(60)); // Show 1 second ahead
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
        this.type = type; // fixed, drone, sniper, sentinel
        this.shotTimer = 0;
        this.patrolStart = new Vector(x, y);
        this.patrolDir = 1;
        this.chargeTimer = 0; // For Sniper laser warning
    }

    update(timeScale, playerPos) {
        if (this.type === 'drone') {
            this.pos.x += 2 * this.patrolDir * timeScale;
            if (Math.abs(this.pos.x - this.patrolStart.x) > 150) this.patrolDir *= -1;
        }

        const fireRate = this.getFireRate();
        this.shotTimer += timeScale;

        // Sniper Laser Telegraphing
        if (this.type === 'sniper') {
            if (this.shotTimer > fireRate * 0.6) {
                this.chargeTimer = 1; // Start warning
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
            case 'sentinel': return 15; // Rapid fire
            case 'sniper': return 120; // Slow, powerful laser
            case 'drone': return 80;
            default: return 60;
        }
    }

    shoot(target) {
        const dir = target.sub(this.pos).normalize();

        if (this.type === 'sentinel') {
            // Rifles have faster bullets
            const vel = dir.mult(8);
            game.projectiles.push(new Projectile(this.pos, vel, '#ffae00'));
        } else if (this.type === 'sniper') {
            // Snipers have extremely fast projectiles
            const vel = dir.mult(15);
            game.projectiles.push(new Projectile(this.pos, vel, '#00ff88'));
        } else {
            const vel = dir.mult(5);
            game.projectiles.push(new Projectile(this.pos, vel));
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

            // Laser Warning Line
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
        this.exit = null;

        this.level = 1;
        this.maxLevels = 10;
        this.globalTimeFactor = 0.05;
        this.keys = {};
        this.running = false;

        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);
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

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.player.pos = new Vector(80, centerY);
        this.exit = new Vector(this.canvas.width - 80, centerY);

        switch (n) {
            case 1: // Tutorial: Basics
                this.walls.push({ x: centerX, y: centerY - 100, w: 20, h: 200 });
                this.enemies.push(new Enemy(centerX + 200, centerY, 'fixed'));
                break;
            case 2: // Tutorial: Movement
                this.walls.push({ x: 300, y: 0, w: 20, h: centerY - 50 });
                this.walls.push({ x: 300, y: centerY + 50, w: 20, h: centerY });
                this.enemies.push(new Enemy(500, centerY - 100, 'fixed'));
                this.enemies.push(new Enemy(500, centerY + 100, 'fixed'));
                break;
            case 3: // Intro Drones
                this.enemies.push(new Enemy(centerX, centerY - 150, 'drone'));
                this.enemies.push(new Enemy(centerX, centerY + 150, 'drone'));
                this.walls.push({ x: centerX - 100, y: centerY - 20, w: 200, h: 40 });
                break;
            case 4: // Intro Sentinel (Rapid)
                this.enemies.push(new Enemy(centerX + 100, centerY, 'sentinel'));
                this.walls.push({ x: centerX - 50, y: 100, w: 20, h: 200 });
                this.walls.push({ x: centerX - 50, y: centerY + 100, w: 20, h: 200 });
                break;
            case 5: // Intro Sniper (Laser)
                this.enemies.push(new Enemy(this.canvas.width - 200, centerY, 'sniper'));
                this.walls.push({ x: centerX, y: centerY - 50, w: 40, h: 100 });
                break;
            case 6: // The Maze
                for (let i = 0; i < 5; i++) {
                    this.walls.push({ x: 200 + i * 150, y: i % 2 ? 0 : 300, w: 30, h: 400 });
                    this.enemies.push(new Enemy(200 + i * 150 + 60, centerY, 'drone'));
                }
                break;
            case 7: // High Security
                this.enemies.push(new Enemy(centerX, 150, 'sniper'));
                this.enemies.push(new Enemy(centerX, this.canvas.height - 150, 'sniper'));
                this.enemies.push(new Enemy(centerX + 150, centerY, 'sentinel'));
                this.walls.push({ x: centerX - 100, y: centerY - 100, w: 200, h: 20 });
                this.walls.push({ x: centerX - 100, y: centerY + 100, w: 200, h: 20 });
                break;
            case 8: // Corridor of Death
                for (let i = 0; i < 4; i++) {
                    this.enemies.push(new Enemy(200 + i * 200, 100, 'sentinel'));
                    this.enemies.push(new Enemy(200 + i * 200, this.canvas.height - 100, 'sentinel'));
                }
                this.walls.push({ x: 150, y: centerY - 10, w: this.canvas.width - 300, h: 20 });
                break;
            case 9: // Sniper Valley
                for (let i = 0; i < 3; i++) {
                    this.enemies.push(new Enemy(centerX + (i * 100), 50 + (i * 200), 'sniper'));
                    this.walls.push({ x: centerX - 150 + (i * 100), y: 150 + (i * 200), w: 100, h: 20 });
                }
                break;
            case 10: // BOSS RUN: THE ARCHITECT'S WRATH
                // Maximum difficulty: All types combined
                this.enemies.push(new Enemy(centerX, centerY - 250, 'sniper'));
                this.enemies.push(new Enemy(centerX, centerY + 250, 'sniper'));
                this.enemies.push(new Enemy(centerX - 250, centerY, 'sentinel'));
                this.enemies.push(new Enemy(centerX + 250, centerY, 'sentinel'));
                this.enemies.push(new Enemy(centerX, centerY, 'fixed'));

                for (let i = 0; i < 12; i++) {
                    const ang = (i / 12) * Math.PI * 2;
                    const wx = centerX + Math.cos(ang) * 150;
                    const wy = centerY + Math.sin(ang) * 150;
                    this.walls.push({ x: wx - 20, y: wy - 20, w: 40, h: 40 });
                }
                // Moving Drones inside the ring
                this.enemies.push(new Enemy(centerX - 50, centerY - 50, 'drone'));
                this.enemies.push(new Enemy(centerX + 50, centerY + 50, 'drone'));
                break;
        }

        document.getElementById('level-display').innerText = n.toString().padStart(2, '0');
    }

    checkCollision(pos, radius) {
        // Bounds
        if (pos.x < 0 || pos.x > this.canvas.width || pos.y < 0 || pos.y > this.canvas.height) return true;

        // Walls
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
        document.getElementById('start-screen').classList.add('hidden');
        this.running = true;
        this.initLevel(this.level);
        this.loop();
    }

    gameOver() {
        this.running = false;
        document.getElementById('death-screen').classList.remove('hidden');
    }

    restartLevel() {
        document.getElementById('death-screen').classList.add('hidden');
        this.initLevel(this.level);
        this.running = true;
        this.loop();
    }

    nextLevel() {
        this.level++;
        if (this.level > this.maxLevels) {
            alert("VOCÊ ESCAPOU! ARQUITETO DE CHRONOS.");
            this.level = 1;
        }
        document.getElementById('clear-screen').classList.add('hidden');
        this.initLevel(this.level);
        this.running = true;
        this.loop();
    }

    update() {
        if (!this.running) return;

        // Mechanics: TimeScale logic
        this.globalTimeFactor = this.player.isMoving ? 1.0 : 0.05;

        // UI Updates
        document.getElementById('energy-fill').style.width = this.player.energy + '%';
        document.getElementById('time-state').innerText = this.player.isMoving ? 'TEMPO REAL' : 'SLOW MOTION';
        document.getElementById('time-overlay').className = this.player.isMoving ? '' : 'slow-mo';

        this.player.update(this.keys, this.canvas);

        this.enemies.forEach(e => e.update(this.globalTimeFactor, this.player.pos));

        this.projectiles.forEach(p => p.update(this.globalTimeFactor));
        this.projectiles = this.projectiles.filter(p => p.active);

        // Particle update
        this.particles.forEach(p => {
            p.pos = p.pos.add(p.vel);
            p.life -= 0.02;
        });
        this.particles = this.particles.filter(p => p.life > 0);

        // Check Exit
        if (this.player.pos.dist(this.exit) < 30) {
            this.running = false;
            document.getElementById('clear-screen').classList.remove('hidden');
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Walls
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = '#000';
        this.walls.forEach(w => {
            this.ctx.fillRect(w.x, w.y, w.w, w.h);
            this.ctx.strokeStyle = '#333';
            this.ctx.strokeRect(w.x, w.y, w.w, w.h);
        });

        // Draw Exit
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(this.exit.x, this.exit.y, 30, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.projectiles.forEach(p => p.draw(this.ctx, this.globalTimeFactor));
        this.enemies.forEach(e => e.draw(this.ctx));

        // Draw Particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.pos.x, p.pos.y, 3, 3);
        });
        this.ctx.globalAlpha = 1.0;

        this.player.draw(this.ctx);
    }

    loop() {
        if (!this.running) return;
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const game = new ChronosEngine();
