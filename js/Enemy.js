
// Monster stats — significantly buffed HP so enemies last longer
const MONSTER_STATS = {
    bamboo: { hp: 60, speed: 80, attackDmg: 3, alertRange: 220, attackRange: 40, attackCd: 1.4, color: '#60c040', xp: 8 },
    spirit: { hp: 50, speed: 110, attackDmg: 3, alertRange: 240, attackRange: 35, attackCd: 1.2, color: '#a060e0', xp: 7 },
    raccoon: { hp: 180, speed: 60, attackDmg: 5, alertRange: 200, attackRange: 50, attackCd: 1.8, color: '#c06030', xp: 20 },
    squid: { hp: 90, speed: 90, attackDmg: 4, alertRange: 180, attackRange: 42, attackCd: 1.5, color: '#805080', xp: 14 },
};

class Enemy {
    constructor(id, type, wx, wy) {
        this.id = id;
        this.type = type;
        this.x = wx; this.y = wy;
        const cfg = MONSTER_STATS[type] || MONSTER_STATS.bamboo;
        this.hp = cfg.hp; this.maxHp = cfg.hp;
        this.speed = cfg.speed;
        this.attackDmg = cfg.attackDmg;
        this.alertRange = cfg.alertRange;
        this.attackRange = cfg.attackRange;
        this.attackCd = cfg.attackCd;
        this.color = cfg.color;
        this.xp = cfg.xp;
        this.radius = type === 'raccoon' ? 22 : 16;
        this.state = 'idle';
        this.patrolTimer = 0; this.patrolDir = { x: 0, y: 0 }; this.patrolTime = 0;
        this.attackTimer = 0; this.hurtTimer = 0; this.deadTimer = 0;
        this.alive = true;
        this.spawnX = wx; this.spawnY = wy;
        this.respawnTimer = 0;
        this.animFrame = 0; this.animTimer = 0; this.animSpeed = 0.15;
        this.knockX = 0; this.knockY = 0;
        this.sprites = { idle: [], move: [], attack: [] };
        this._loadSprites();

        // Game.js collects these each frame then clears them
        this.newProjectiles = [];

        // 🎋 Bamboo: slow spear throw every 3-4s
        this.spearTimer = 1.5 + Math.random() * 2;

        // 👻 Spirit: blink teleport
        this.blinkCooldown = 3 + Math.random() * 2; // seconds until next blink
        this.blinkTimer = 0;     // how long currently invisible
        this.isBlinking = false;
        this._bTX = 0; this._bTY = 0; // teleport destination

        // 🦑 Squid: ink spray
        this.inkTimer = 2 + Math.random() * 3;

        // 🦝 Raccoon: ground slam (added for smaller raccoons)
        if (this.type === 'raccoon') {
            this.slamTimer = 4 + Math.random() * 2;
            this.slamState = 'none';
            this.slamWindup = 0;
            this.shockwaveR = 0;
            this.shockwaveAlive = false;
            this.shockwaveHit = false;
        }

        this.slowTimer = 0;
    }

    _loadImg(src) { const img = new Image(); img.src = src; return img; }

    _loadSprites() {
        const base = `./1/graphics/monsters/${this.type}`;
        const counts = {
            bamboo: { idle: 4, move: 4, attack: 1 },
            spirit: { idle: 4, move: 4, attack: 1 },
            raccoon: { idle: 6, move: 5, attack: 4 },
            squid: { idle: 5, move: 4, attack: 1 },
        };
        const cfg = counts[this.type] || counts.bamboo;
        for (const [s, n] of Object.entries(cfg)) {
            for (let i = 0; i < n; i++) this.sprites[s].push(this._loadImg(`${base}/${s}/${i}.png`));
        }
    }

    _getFrame() {
        const st = this.state === 'chase' ? 'move' : this.state === 'attack' ? 'attack' : 'idle';
        const frames = this.sprites[st];
        if (!frames || !frames.length) return null;
        const img = frames[this.animFrame % frames.length];
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    update(dt, player, world) {
        if (!this.alive) {
            this.deadTimer += dt;
            if (this.deadTimer > 0.15) {
                this.respawnTimer += dt;
                if (this.respawnTimer >= 20) {
                    this.hp = this.maxHp;
                    this.alive = true;
                    this.deadTimer = 0; this.respawnTimer = 0;
                    this.x = this.spawnX; this.y = this.spawnY;
                    this.state = 'idle';
                    this.hurtTimer = 0; this.attackTimer = 0;
                    this.knockX = 0; this.knockY = 0;
                    this.readyToRespawn = true;
                }
            }
        }

        // New projectiles list — reset every frame
        this.newProjectiles = [];

        // Knockback
        if (Math.abs(this.knockX) > 0.5 || Math.abs(this.knockY) > 0.5) {
            const nx = this.x + this.knockX * dt, ny = this.y + this.knockY * dt;
            if (world.isWorldPassable(nx, this.y, this.radius)) this.x = nx;
            if (world.isWorldPassable(this.x, ny, this.radius)) this.y = ny;
            this.knockX *= (1 - 10 * dt); this.knockY *= (1 - 10 * dt);
        }

        if (this.slowTimer > 0) this.slowTimer -= dt;
        const currentSpeed = this.slowTimer > 0 ? this.speed * 0.5 : this.speed;

        if (this.hurtTimer > 0) this.hurtTimer -= dt;
        if (this.attackTimer > 0) this.attackTimer -= dt;

        const distX = player.x - this.x, distY = player.y - this.y;
        const dist = Math.hypot(distX, distY);

        // ── 👻 Spirit: blink teleport ────────────────────────────────────────
        if (this.type === 'spirit') {
            if (this.isBlinking) {
                this.blinkTimer += dt;
                if (this.blinkTimer >= 0.4) {
                    // Reappear beside player
                    this.x = this._bTX; this.y = this._bTY;
                    this.isBlinking = false;
                    this.blinkTimer = 0;
                    this.blinkCooldown = 4 + Math.random() * 2;
                }
                return; // completely paused + invisible while blinking
            } else {
                this.blinkCooldown -= dt;
                if (this.blinkCooldown <= 0 && dist < 300 && !player.dead) {
                    // Pick a random spot 70-130px around the player
                    const angle = Math.random() * Math.PI * 2;
                    const r = 70 + Math.random() * 60;
                    this._bTX = player.x + Math.cos(angle) * r;
                    this._bTY = player.y + Math.sin(angle) * r;
                    this.isBlinking = true;
                    this.blinkTimer = 0;
                }
            }
        }

        // ── 🎋 Bamboo: slow spear throw ────────────────────────────────────
        if (this.type === 'bamboo') {
            this.spearTimer -= dt;
            if (this.spearTimer <= 0 && dist < 280 && !player.dead) {
                this.spearTimer = 3 + Math.random();
                const baseAngle = Math.atan2(distY, distX);
                const spd = 130;
                const spread = 0.35; // ~20 degrees between each spear
                for (let i = -1; i <= 1; i++) {
                    const angle = baseAngle + i * spread;
                    this.newProjectiles.push({
                        type: 'bamboo_spear',
                        x: this.x, y: this.y,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        dist: 0, maxDist: 360,
                        damage: 2,
                        life: 4,
                        angle: angle,
                    });
                }
            }
        }

        // ── 🦑 Squid: ink spray cone ─────────────────────────────────────────
        if (this.type === 'squid') {
            this.inkTimer -= dt;
            if (this.inkTimer <= 0 && dist < 240 && !player.dead) {
                this.inkTimer = 5 + Math.random() * 2;
                const baseAngle = Math.atan2(distY, distX);
                // 3 ink blobs in a spread cone
                for (let i = -1; i <= 1; i++) {
                    const angle = baseAngle + i * 0.38;
                    const spd = 80 + Math.random() * 30;
                    this.newProjectiles.push({
                        type: 'squid_ink',
                        x: this.x, y: this.y,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        dist: 0, maxDist: 190,
                        life: 3.8,
                        radius: 4, maxRadius: 50,
                        lingering: false,
                    });
                }
            }
        }

        // 🦝 Raccoon: ground slam logic
        if (this.type === 'raccoon') {
            this.slamTimer -= dt;
            if (this.slamState === 'none' && this.slamTimer <= 0 && dist < 120 && !player.dead) {
                this.slamState = 'windup';
                this.slamWindup = 0;
            }
            if (this.slamState === 'windup') {
                this.slamWindup += dt;
                if (this.slamWindup >= 0.6) {
                    this.slamState = 'shockwave';
                    this.shockwaveR = 10;
                    this.shockwaveAlive = true;
                    this.shockwaveHit = false;
                }
                return; // pause regular AI during slam windup
            }
            if (this.slamState === 'shockwave') {
                this.shockwaveR += 220 * dt;
                if (!this.shockwaveHit && !player.dead && Math.hypot(player.x - this.x, player.y - this.y) < this.shockwaveR + player.radius) {
                    player.takeDamage(4);
                    this.shockwaveHit = true;
                }
                if (this.shockwaveR > 150) {
                    this.slamState = 'none';
                    this.shockwaveAlive = false;
                    this.slamTimer = 5 + Math.random() * 3;
                }
                return; // pause regular AI during shockwave
            }
        }

        // ── Standard chase / attack / patrol AI ──────────────────────────────
        if (dist < this.attackRange && !player.dead) {
            this.state = 'attack';
            if (this.attackTimer <= 0) {
                if (player.takeDamage(this.attackDmg)) this.attackTimer = this.attackCd;
            }
        } else if (dist < this.alertRange && !player.dead) {
            this.state = 'chase';
            if (dist > 0) {
                const nx = this.x + (distX / dist) * currentSpeed * dt;
                const ny = this.y + (distY / dist) * currentSpeed * dt;
                if (world.isWorldPassable(nx, this.y, this.radius)) this.x = nx;
                if (world.isWorldPassable(this.x, ny, this.radius)) this.y = ny;
            }
        } else {
            this.state = 'idle';
            this.patrolTimer -= dt;
            if (this.patrolTimer <= 0) {
                this.patrolTimer = 1.5 + Math.random() * 2;
                const angle = Math.random() * Math.PI * 2;
                this.patrolDir = { x: Math.cos(angle), y: Math.sin(angle) };
                this.patrolTime = Math.random() * 1.5;
            }
            if (this.patrolTime > 0) {
                this.patrolTime -= dt;
                this.state = 'patrol';
                const nx = this.x + this.patrolDir.x * (currentSpeed * 0.4) * dt;
                const ny = this.y + this.patrolDir.y * (currentSpeed * 0.4) * dt;
                if (world.isWorldPassable(nx, this.y, this.radius)) this.x = nx;
                if (world.isWorldPassable(this.x, ny, this.radius)) this.y = ny;
            }
        }

        // Animation
        this.animTimer += dt;
        const animSpd = (this.state === 'chase' || this.state === 'patrol') ? this.animSpeed : this.animSpeed * 2;
        if (this.animTimer > animSpd) {
            this.animTimer = 0;
            const frames = this.sprites[this.state === 'chase' ? 'move' : this.state === 'attack' ? 'attack' : 'idle'];
            this.animFrame = (this.animFrame + 1) % Math.max(1, frames.length);
        }
    }

    takeDamage(amount, fromX, fromY) {
        if (!this.alive) return;
        if (this.isBlinking) return; // spirit is untargetable while blinking
        this.hp -= amount; this.hurtTimer = 0.25; this.state = 'hurt';
        const dx = this.x - fromX, dy = this.y - fromY;
        const len = Math.hypot(dx, dy) || 1;
        this.knockX = (dx / len) * 280; this.knockY = (dy / len) * 280;
        if (this.onHit) this.onHit(this.id, amount);
        if (this.hp <= 0) { this.alive = false; this.deadTimer = 0; }
    }

    draw(ctx, camX, camY, time) {
        // Ghost indicator 3s before respawn
        if (!this.alive && this.respawnTimer > 17) {
            const gsx = this.spawnX - camX, gsy = this.spawnY - camY;
            const t = (this.respawnTimer - 17) / 3;
            const pulse = Math.sin(time * 8) * 0.3 + 0.7;
            ctx.globalAlpha = t * 0.55 * pulse;
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 20; ctx.shadowColor = this.color;
            ctx.beginPath(); ctx.arc(gsx, gsy, this.radius * 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            return;
        }

        if (this.readyToRespawn) {
            this.readyToRespawn = false;
            if (this.onRespawn) this.onRespawn(this.id);
        }
        if (!this.alive) return;
        if (this.isBlinking) return; // spirit invisible while teleporting

        const sx = this.x - camX, sy = this.y - camY;
        if (sx < -80 || sy < -80 || sx > 1440 || sy > 900) return;
        const flash = this.hurtTimer > 0 && Math.floor(time * 14) % 2 === 0;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(sx, sy + this.radius + 4, this.radius * 0.9, this.radius * 0.35, 0, 0, Math.PI * 2); ctx.fill();

        const sprW = this.type === 'raccoon' ? 80 : 64, sprH = sprW;
        const frame = this._getFrame();
        if (frame && !flash) {
            ctx.drawImage(frame, sx - sprW / 2, sy - sprH / 2 - 6, sprW, sprH);
        } else if (frame && flash) {
            ctx.save();
            ctx.drawImage(frame, sx - sprW / 2, sy - sprH / 2 - 6, sprW, sprH);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255,60,60,0.6)'; ctx.fillRect(sx - sprW / 2, sy - sprH / 2 - 6, sprW, sprH);
            ctx.restore();
        } else {
            ctx.fillStyle = flash ? '#ff6060' : this.color;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2); ctx.fill();
        }

        // Spirit: show a dashed ring when blink is almost ready
        if (this.type === 'spirit' && this.blinkCooldown < 1.2 && !this.isBlinking) {
            ctx.strokeStyle = 'rgba(180,80,255,0.65)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(sx, sy, this.radius + 9, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }

        // HP bar when damaged
        if (this.hp < this.maxHp) {
            const bw = 44, bh = 5, bx = sx - bw / 2, by = sy - this.radius - 14;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
            ctx.fillStyle = '#e03030'; ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = '#40e040'; ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
            ctx.font = "7px 'Press Start 2P',monospace"; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
            ctx.fillText(`${this.hp}`, sx, by + bh + 7); ctx.textAlign = 'left';
        }

        // Raccoon Slam Visuals
        if (this.type === 'raccoon') {
            if (this.slamState === 'windup') {
                const pulse = Math.sin(time * 15) * 0.5 + 0.5;
                ctx.strokeStyle = `rgba(255,160,0,${0.3 + pulse * 0.4})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath(); ctx.arc(sx, sy, this.radius + 12, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
            }
            if (this.shockwaveAlive) {
                const alpha = Math.max(0, 1 - this.shockwaveR / 150);
                ctx.strokeStyle = `rgba(255,180,0,${alpha * 0.8})`;
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(sx, sy, this.shockwaveR, 0, Math.PI * 2); ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
    }
}
