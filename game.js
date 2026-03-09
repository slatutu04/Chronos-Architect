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
        this.trail = [];
        this.ghosts = []; // For "After-image" effect
    }

    update(keys, canvas, dt) {
        this.vel = new Vector(0, 0);
        if (keys['w'] || keys['W'] || keys['ArrowUp']) this.vel.y = -1;
        if (keys['s'] || keys['S'] || keys['ArrowDown']) this.vel.y = 1;
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) this.vel.x = -1;
        if (keys['d'] || keys['D'] || keys['ArrowRight']) this.vel.x = 1;

        if (this.vel.mag() > 0) {
            this.vel = this.vel.normalize().mult(this.speed);
            this.isMoving = true;
            // Recharge energy only when moving (Real Time), and recharge faster
            this.energy = Math.min(this.maxEnergy, this.energy + 0.45 * dt); // Slightly faster (was 0.15)

            this.trail.push({ x: this.pos.x, y: this.pos.y, life: 1.0 });
        } else {
            this.isMoving = false;
            // No energy recharge while stopped
        }

        this.trail.forEach(t => t.life -= 0.05 * dt);
        this.trail = this.trail.filter(t => t.life > 0);

        this.ghosts.forEach(g => g.life -= 0.04 * dt);
        this.ghosts = this.ghosts.filter(g => g.life > 0);

        // Apply movement
        const nextPos = this.pos.add(this.vel.mult(dt));
        if (!game.checkCollision(nextPos, this.radius)) {
            this.pos = nextPos;
        } else if (this.vel.mag() > 0) {
            // Se houve tentativa de movimento mas falhou por colisão, logar para debug
            if (game.level === 20) {
                console.log("Bloqueado em:", nextPos.x, nextPos.y);
            }
        }

        if (keys[' '] && this.energy >= 30 && this.dashCooldown <= 0 && !game.isTimestopped) {
            this.dash();
        }

        if (this.dashCooldown > 0) this.dashCooldown -= dt;
    }

    dash() {
        const dashDir = this.vel.mag() > 0 ? this.vel.normalize() : new Vector(1, 0);
        const dashDist = 120;

        // High frequency points during dash
        let step = dashDir.mult(10); // Better spacing
        let current = this.pos;
        const totalSteps = Math.floor(dashDist / 10);
        for (let i = 0; i < totalSteps; i++) {
            let next = current.add(step);
            if (game.checkCollision(next, this.radius)) break;
            current = next;
            this.trail.push({ x: current.x, y: current.y, life: 1.2 });

            // Add ghost images at intervals
            if (i % 3 === 0) {
                this.ghosts.push({ x: current.x, y: current.y, life: 0.8 });
            }
        }

        this.pos = current;
        this.energy -= 30;
        this.dashCooldown = 20;
        game.createParticles(this.pos, '#00f2ff', 20);
        game.shake(10);
    }

    draw(ctx) {
        if (this.trail.length > 2) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Pass 1: Wide Neon Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f2ff';
            for (let i = 1; i < this.trail.length; i++) {
                const t1 = this.trail[i - 1];
                const t2 = this.trail[i];
                const dist = Math.sqrt((t1.x - t2.x) ** 2 + (t1.y - t2.y) ** 2);

                if (dist < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 242, 255, ${t2.life * 0.25})`;
                    ctx.lineWidth = this.radius * 2.2 * t2.life;
                    ctx.moveTo(t1.x, t1.y);
                    ctx.lineTo(t2.x, t2.y);
                    ctx.stroke();
                }
            }

            // Pass 2: Sharp Inner Core
            ctx.shadowBlur = 0;
            for (let i = 1; i < this.trail.length; i++) {
                const t1 = this.trail[i - 1];
                const t2 = this.trail[i];
                const dist = Math.sqrt((t1.x - t2.x) ** 2 + (t1.y - t2.y) ** 2);

                if (dist < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${t2.life * 0.6})`;
                    ctx.lineWidth = this.radius * 0.8 * t2.life;
                    ctx.moveTo(t1.x, t1.y);
                    ctx.lineTo(t2.x, t2.y);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        // Draw Ghosts (After-images)
        this.ghosts.forEach(g => {
            ctx.save();
            ctx.globalAlpha = g.life * 0.5;
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(g.x, g.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

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

        // Kill bullet if it goes too far out of world bounds
        const margin = 1000;
        if (this.pos.x < -margin || this.pos.x > game.worldWidth + margin ||
            this.pos.y < -margin || this.pos.y > game.worldHeight + margin) {
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
    update(dt) {
        this.angle += 0.05 * dt;
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
        this.width = 1600;
        this.height = 900;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.returningScreen = 'start-screen';
        this.selectedLevel = 1; // Track selection in menu

        // Visual Effects
        this.screenShake = 0;
        this.bgParticles = [];
        this.initBgParticles();

        this.timestopUnlocked = false;

        // Camera and Large World Support
        this.cameraX = 0;
        this.cameraY = 0;
        this.worldWidth = 1600;
        this.worldHeight = 900;

        // Intro Cutscene State
        this.isLevelIntro = false;
        this.introText = "";
        this.introTimer = 0;
        this.introTextProgress = 0;

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
        // Use a safety margin (padding) to avoid taskbar overlap
        const padding = 40;
        const availableWidth = window.innerWidth - padding;
        const availableHeight = window.innerHeight - padding;

        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        const screenRatio = availableWidth / availableHeight;
        const gameRatio = this.width / this.height;

        if (screenRatio > gameRatio) {
            this.scale = availableHeight / this.height;
            this.offsetX = (this.canvas.width - this.width * this.scale) / 2;
            this.offsetY = (this.canvas.height - this.height * this.scale) / 2;
        } else {
            this.scale = availableWidth / this.width;
            this.offsetY = (this.canvas.height - this.height * this.scale) / 2;
            this.offsetX = (this.canvas.width - this.width * this.scale) / 2;
        }
    }

    initBgParticles() {
        for (let i = 0; i < 200; i++) {
            this.bgParticles.push({
                x: Math.random() * this.worldWidth,
                y: Math.random() * this.worldHeight,
                z: Math.random() * 2 + 1,
                size: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5 + 0.1
            });
        }
    }

    shake(intensity) {
        this.screenShake = intensity;
    }

    // Radar logic for Phase 20
    drawRadar(ctx) {
        if (this.level !== 20) return;

        ctx.save();
        ctx.translate(this.width - 200, this.height - 200);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 180, 180);
        ctx.strokeStyle = '#00f2ff';
        ctx.strokeRect(0, 0, 180, 180);

        const radarScale = 180 / this.worldWidth;

        // Draw Player on radar
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.player.pos.x * radarScale - 2, this.player.pos.y * radarScale - 2, 4, 4);

        // Draw Keys on radar
        ctx.fillStyle = '#fff100';
        this.keys.forEach(k => {
            ctx.fillRect(k.pos.x * radarScale - 2, k.pos.y * radarScale - 2, 4, 4);
        });

        ctx.restore();
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
        this.worldWidth = 1600;  // Reset default world size
        this.worldHeight = 900;
        this.bgParticles = [];
        this.projectiles = [];

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        this.player.pos = new Vector(80, centerY);
        this.exit = new Vector(this.width - 80, centerY);

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
                this.enemies.push(new Enemy(this.width - 200, centerY, 'sniper'));
                this.walls.push({ x: centerX, y: centerY - 50, w: 40, h: 100 });
                break;
            case 6:
                for (let i = 0; i < 5; i++) {
                    const h = i % 2 ? 400 : this.height - 300;
                    this.walls.push({ x: 200 + i * 150, y: i % 2 ? 0 : 300, w: 30, h: h });
                    this.enemies.push(new Enemy(200 + i * 150 + 60, centerY, 'drone'));
                }
                break;
            case 7:
                this.enemies.push(new Enemy(centerX, 150, 'sniper'));
                this.enemies.push(new Enemy(centerX, this.height - 150, 'sniper'));
                this.enemies.push(new Enemy(centerX + 150, centerY, 'sentinel'));
                this.walls.push({ x: centerX - 100, y: centerY - 100, w: 200, h: 20 });
                this.walls.push({ x: centerX - 100, y: centerY + 100, w: 200, h: 20 });
                break;
            case 8:
                for (let i = 0; i < 4; i++) {
                    this.enemies.push(new Enemy(200 + i * 200, 100, 'sentinel'));
                    this.enemies.push(new Enemy(200 + i * 200, this.height - 100, 'sentinel'));
                }
                this.walls.push({ x: 150, y: centerY - 10, w: this.width - 300, h: 20 });
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
                this.keys.push(new Key(100, this.height - 100));
                this.enemies.push(new Enemy(this.width - 200, centerY, 'drone'));
                // Fixed wall: added passage in the middle
                this.walls.push({ x: centerX, y: 0, w: 20, h: centerY - 100 });
                this.walls.push({ x: centerX, y: centerY + 100, w: 20, h: centerY });
                break;
            case 13:
                this.keysRequired = 3;
                this.keys.push(new Key(centerX, 150));
                this.keys.push(new Key(centerX, centerY));
                this.keys.push(new Key(centerX, this.height - 150));
                for (let i = 0; i < 3; i++) this.enemies.push(new Enemy(this.width - 250, 150 + i * 200, 'sniper'));
                break;
            case 14:
                this.keysRequired = 2;
                this.keys.push(new Key(centerX - 50, centerY - 200));
                this.keys.push(new Key(centerX - 50, centerY + 200));
                this.enemies.push(new Enemy(200, centerY, 'sentinel'));
                this.enemies.push(new Enemy(this.width - 400, centerY, 'sentinel'));
                break;
            case 15:
                this.keysRequired = 4;
                this.keys.push(new Key(200, 200));
                this.keys.push(new Key(this.width - 200, 200));
                this.keys.push(new Key(200, this.height - 200));
                this.keys.push(new Key(this.width - 200, this.height - 200));
                this.enemies.push(new Enemy(centerX, centerY, 'sniper'));
                this.enemies.push(new Enemy(centerX, 100, 'sentinel'));
                this.enemies.push(new Enemy(centerX, this.height - 100, 'sentinel'));
                break;

            // CHALLENGE LEVELS (16-20) - TIME STOP MECHANIC
            case 16:
                this.enemies.push(new Enemy(400, centerY - 100, 'sniper'));
                this.enemies.push(new Enemy(400, centerY + 100, 'sniper'));
                this.enemies.push(new Enemy(centerX + 200, centerY - 150, 'sentinel'));
                this.enemies.push(new Enemy(centerX + 200, centerY + 150, 'sentinel'));
                // Wall with Gap in the middle (fixed "impossible" block)
                this.walls.push({ x: centerX, y: 0, w: 20, h: centerY - 100 });
                this.walls.push({ x: centerX, y: centerY + 100, w: 20, h: this.height - (centerY + 100) });
                break;
            case 17:
                this.keysRequired = 2;
                this.keys.push(new Key(centerX, 100));
                this.keys.push(new Key(centerX, this.height - 100));
                for (let i = 0; i < 4; i++) this.enemies.push(new Enemy(centerX + (i * 100), centerY + (i % 2 ? 50 : -50), 'sentinel'));
                this.enemies.push(new Enemy(centerX - 120, 100, 'sniper'));
                this.enemies.push(new Enemy(centerX + 120, this.height - 100, 'sniper'));
                break;
            case 18: // THE GREAT MAZE
                this.keysRequired = 3;
                // Maze Walls
                for (let i = 1; i < 6; i++) {
                    let wx = i * 200;
                    const h = i % 2 ? 450 : this.height - 300;
                    this.walls.push({ x: wx, y: (i % 2 ? 0 : 300), w: 30, h: h });
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
            case 20:
                this.worldWidth = 5000;
                this.worldHeight = 5000;
                this.keysRequired = 5;
                this.isLevelIntro = true;
                this.introText = "PROTOCOLO FINAL: O ARQUITETO DE CHRONOS. RECONSTRUA O NÚCLEO COLETANDO AS 5 ÂNCORAS TEMPORAIS.";
                this.introTimer = 0;
                this.introTextProgress = 0;

                // Portal at center
                this.exit = new Vector(2500, 2500);
                this.player.pos = new Vector(2500, 2550); // Start near portal

                // Create a massive maze logic
                // Using a regular grid of corridors with random blocks
                for (let i = 1; i < 20; i++) {
                    for (let j = 1; j < 20; j++) {
                        const wx = i * 250;
                        const wy = j * 250;
                        if (Math.random() > 0.65) { // Reduzido de 0.4 para 0.65 (menos paredes)
                            const isVert = Math.random() > 0.5;
                            this.walls.push({
                                x: wx, y: wy,
                                w: isVert ? 20 : 250,
                                h: isVert ? 250 : 20
                            });
                        }
                    }
                }

                // Clear center area around portal AND player using AABB check
                const clearRadius = 250;
                this.walls = this.walls.filter(w => {
                    // Check if wall overlaps with player spawn zone
                    const playerOverlap = (w.x < this.player.pos.x + clearRadius && w.x + w.w > this.player.pos.x - clearRadius &&
                        w.y < this.player.pos.y + clearRadius && w.y + w.h > this.player.pos.y - clearRadius);
                    // Check if wall overlaps with exit portal zone
                    const exitOverlap = (w.x < this.exit.x + clearRadius && w.x + w.w > this.exit.x - clearRadius &&
                        w.y < this.exit.y + clearRadius && w.y + w.h > this.exit.y - clearRadius);
                    return !playerOverlap && !exitOverlap;
                });

                console.log("Level 20 initialized. World:", this.worldWidth, "x", this.worldHeight);
                console.log("Player starting at:", this.player.pos.x, this.player.pos.y);
                console.log("Walls count:", this.walls.length);

                // Place 5 Keys in corners/edges
                const keyPos = [
                    new Vector(400, 400), new Vector(4600, 400),
                    new Vector(400, 4600), new Vector(4600, 4600),
                    new Vector(1000, 2500)
                ];
                keyPos.forEach(p => {
                    this.keys.push(new Key(p.x, p.y));
                    // Boss Guardian for each key
                    this.enemies.push(new Enemy(p.x + 40, p.y + 40, 'sniper'));
                    this.enemies.push(new Enemy(p.x - 40, p.y - 40, 'sentinel'));
                });

                // Scatter fewer normal snipers
                for (let i = 0; i < 18; i++) { // Reduzido de 40 para 18
                    const sx = Math.random() * (this.worldWidth - 600) + 300;
                    const sy = Math.random() * (this.worldHeight - 600) + 300;
                    if (new Vector(sx, sy).dist(this.player.pos) > 600) {
                        this.enemies.push(new Enemy(sx, sy, 'sniper'));
                    }
                }
                break;
        }

        // Initialize particles AFTER worldWidth/Height are set
        this.initBgParticles();

        // Focus camera on player initially
        this.cameraX = this.player.pos.x - 800;
        this.cameraY = this.player.pos.y - 450;
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - 1600));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - 900));

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
                this.shake(15);
            }
        } else {
            this.isTimestopped = false;
            this.shake(5);
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
        this.shake(8);
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
        // Only block if it goes OUTSIDE world bounds
        if (pos.x < 0 || pos.x > this.worldWidth || pos.y < 0 || pos.y > this.worldHeight) {
            console.log("Colisão com limite do mundo:", pos.x, pos.y);
            return true;
        }
        for (let wall of this.walls) {
            // Optimization: Skip distance walls (Broad-phase)
            if (Math.abs(pos.x - (wall.x + wall.w / 2)) > 300 ||
                Math.abs(pos.y - (wall.y + wall.h / 2)) > 300) continue;

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
        this.shake(20);
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
            alert("MISSÃO CUMPRIDA! VOCÊ DOMINOU O TEMPO.");
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

        if (!this.loopInitiated) {
            this.loopInitiated = true;
            this.loop(performance.now());
        }
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

    update(dt) {
        if (!this.running || this.isPaused) return;

        if (this.isLevelIntro) {
            // Allow skipping intro with Space, Enter or Escape
            if (this.inputKeys[' '] || this.inputKeys['Enter'] || this.inputKeys['Escape']) {
                this.isLevelIntro = false;
            }

            // Se o jogador tentar se mover, desativa o intro automaticamente
            if (this.inputKeys['w'] || this.inputKeys['a'] || this.inputKeys['s'] || this.inputKeys['d'] ||
                this.inputKeys['W'] || this.inputKeys['A'] || this.inputKeys['S'] || this.inputKeys['D'] ||
                this.inputKeys['ArrowUp'] || this.inputKeys['ArrowDown'] || this.inputKeys['ArrowLeft'] || this.inputKeys['ArrowRight']) {
                this.isLevelIntro = false;
            }

            this.introTimer += dt;
            if (this.introTimer > 1) {
                this.introTextProgress += 0.5 * dt;
                if (this.introTextProgress > this.introText.length + 60) {
                    this.isLevelIntro = false;
                }
            }
            // NOT returning here anymore - let the update continue below
        }

        // Camera Logic (Follow Player)
        this.cameraX = this.player.pos.x - 800; // Center (1600/2)
        this.cameraY = this.player.pos.y - 450; // Center (900/2)
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - 1600));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - 900));

        if (this.level === 20 && this.introTimer < 0.1) {
            console.log("Camera focused at:", this.cameraX, this.cameraY);
        }

        // Background Particles
        const ts = this.isTimestopped ? 0 : this.globalTimeFactor;
        this.bgParticles.forEach(p => {
            p.y += p.z * 0.5 * ts * dt;
            if (p.y > this.worldHeight) p.y = 0;
            if (p.y < 0) p.y = this.worldHeight;
        });

        if (this.screenShake > 0) this.screenShake -= 0.5 * dt;

        if (this.isTimestopped) {
            // TIME STOP MODES
            document.getElementById('time-overlay').className = 'timestop-active';
            document.getElementById('time-state').innerText = 'TIME STOP';

            this.player.update(this.inputKeys, this.canvas, dt);

            // Drain energy if moving
            if (this.player.isMoving) {
                this.timestopEnergy -= 0.8 * dt;
                if (this.timestopEnergy <= 0) {
                    this.timestopEnergy = 0;
                    this.isTimestopped = false;
                }
            }
            this.updateTimeStopUI();

            // Particles and Key collection still work
            this.particles.forEach(p => {
                p.pos = p.pos.add(p.vel.mult(dt));
                p.life -= 0.02 * dt;
            });
            this.particles = this.particles.filter(p => p.life > 0);
            this.keys.forEach(k => k.update(dt));

        } else {
            // NORMAL MODES
            this.globalTimeFactor = this.player.isMoving ? 1.0 : 0.05;
            const scaledTime = this.globalTimeFactor * dt;

            // Significantly faster recharge for Time Stop (was 0.02)
            if (this.level >= 16 && this.timestopEnergy < 100) {
                this.timestopEnergy += 0.15 * dt;
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

            this.player.update(this.inputKeys, this.canvas, dt);
            this.enemies.forEach(e => e.update(scaledTime, this.player.pos));
            this.keys.forEach(k => k.update(dt));
            this.projectiles.forEach(p => p.update(scaledTime));
            this.projectiles = this.projectiles.filter(p => p.active);

            this.particles.forEach(p => {
                p.pos = p.pos.add(p.vel.mult(dt));
                p.life -= 0.02 * dt;
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

        this.ctx.save();

        let sx = 0, sy = 0;
        if (this.screenShake > 0) {
            sx = (Math.random() - 0.5) * this.screenShake;
            sy = (Math.random() - 0.5) * this.screenShake;
        }

        this.ctx.translate(this.offsetX + sx, this.offsetY + sy);
        this.ctx.scale(this.scale, this.scale);

        // Apply Camera Offset
        this.ctx.translate(-this.cameraX, -this.cameraY);

        // Draw game boundary
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

        // Draw Background Particles with Frustum Culling
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.bgParticles.forEach(p => {
            // Only draw if inside camera view
            if (p.x > this.cameraX - 50 && p.x < this.cameraX + 1650 &&
                p.y > this.cameraY - 50 && p.y < this.cameraY + 950) {
                this.ctx.globalAlpha = p.alpha;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
        this.ctx.globalAlpha = 1.0;

        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = '#000';
        this.walls.forEach(w => {
            // Frustum Culling for walls
            if (w.x + w.w > this.cameraX && w.x < this.cameraX + 1600 &&
                w.y + w.h > this.cameraY && w.y < this.cameraY + 900) {
                this.ctx.fillRect(w.x, w.y, w.w, w.h);
                this.ctx.strokeStyle = '#333';
                this.ctx.strokeRect(w.x, w.y, w.w, w.h);
            }
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

        // Temporal Fog
        if (this.level === 20 && !this.isLevelIntro) {
            this.ctx.save();
            this.ctx.translate(this.cameraX, this.cameraY);
            const fogGrad = this.ctx.createRadialGradient(
                this.player.pos.x - this.cameraX, this.player.pos.y - this.cameraY, 200,
                this.player.pos.x - this.cameraX, this.player.pos.y - this.cameraY, 600
            );
            fogGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            fogGrad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            this.ctx.fillStyle = fogGrad;
            this.ctx.fillRect(0, 0, 1600, 900);
            this.ctx.restore();
        }

        this.ctx.restore();

        // UI
        this.drawRadar(this.ctx);

        if (this.isLevelIntro) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px "Outfit"';
            this.ctx.textAlign = 'center';
            const text = this.introText.substring(0, Math.floor(this.introTextProgress));
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.restore();
        }
    }
    loop(timestamp) {
        if (!this.running) {
            this.loopInitiated = false; // Reset so it can be restarted
            this.lastTime = 0;
            return;
        }

        if (!timestamp) timestamp = performance.now();
        if (!this.lastTime) this.lastTime = timestamp;

        // Normalize to 60fps and cap to avoid huge jumps
        const dt = Math.min((timestamp - this.lastTime) / (1000 / 60), 2.0);
        this.lastTime = timestamp;

        if (!this.isPaused) {
            this.update(dt);
            this.draw();
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}

const game = new ChronosEngine();
