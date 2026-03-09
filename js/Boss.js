
// ─── Boss Enemy ───────────────────────────────────────────────────────────────
class Boss {
    constructor(type, wx, wy) {
        this.type = type;
        this.x = wx; this.y = wy;
        this.startX = wx; this.startY = wy;

        const cfg = {
            raccoon: {
                name: 'Tanuki Lord',
                hp: 100, speed: 70, radius: 36,
                attackDmg: 6, attackRange: 65, attackCd: 1.6,
                alertRange: 700, color: '#c06030',
                phases: 3,
                spritePath: './1/graphics/monsters/raccoon',
                slashCd: 3.5,   // claw slash special
                spikeCd: 6.0,   // spike line special
            },
            forest_guardian: {
                name: 'Forest Guardian',
                hp: 80, speed: 55, radius: 40,
                attackDmg: 7, attackRange: 60, attackCd: 2.0,
                alertRange: 600, color: '#a06820',
                phases: 2,
                spritePath: './1/graphics/monsters/raccoon',
                slashCd: 99, spikeCd: 99,
            },
            stone_golem: {
                name: 'Stone Golem',
                hp: 120, speed: 40, radius: 50,
                attackDmg: 10, attackRange: 65, attackCd: 2.5,
                alertRange: 600, color: '#889080',
                phases: 2,
                spritePath: './1/graphics/monsters/raccoon',
                slashCd: 99, spikeCd: 99,
            },
            shadow_lord: {
                name: 'Shadow Lord',
                hp: 160, speed: 90, radius: 38,
                attackDmg: 12, attackRange: 55, attackCd: 1.8,
                alertRange: 600, color: '#7020c0',
                phases: 3,
                spritePath: './1/graphics/monsters/spirit',
                slashCd: 99, spikeCd: 99,
            },
        };

        const c = cfg[type] || cfg.forest_guardian;
        Object.assign(this, c);
        this.maxHp = this.hp;
        this.phase = 1;
        this.state = 'idle';
        this.attackTimer = 0;
        this.hurtTimer = 0;
        this.deadTimer = 0;
        this.alive = true;
        this.spawnX = wx; this.spawnY = wy;     // original spawn for respawn
        this.respawnTimer = 0;
        this.radius = c.radius;
        this.knockX = 0; this.knockY = 0;
        this.animFrame = 0; this.animTimer = 0;
        this.roarTimer = 0;
        this.specialTimer = c.attackCd * 2;
        this.slashTimer = (c.slashCd || 99) * 0.5;
        this.spikeTimer = (c.spikeCd || 99);
        this.projectiles = [];
        this.slowTimer = 0;


        // 🦝 Raccoon boss: ground slam AoE
        this.slamCooldown = 5;  // seconds between slams
        this.slamTimer = 3;     // initial delay
        this.slamState = 'none'; // 'none' | 'windup' | 'shockwave'
        this.slamWindup = 0;
        this.shockwaveR = 0;
        this.shockwaveAlive = false;
        this.shockwaveHit = false; // only damages once per slam

        this.rising = false;
        this.risingTimer = 0;
        this.risingMax = 3.0;
        this.risingYOffset = 60; // start 60px below

        // Sprite loading
        this.sprites = { idle: [], move: [], attack: [] };
        this._loadSprites(c.spritePath);
    }

    _loadImg(src) { const img = new Image(); img.src = src; return img; }

    _loadSprites(base) {
        const counts = { idle: 4, move: 4, attack: 4 };
        for (const [s, n] of Object.entries(counts)) {
            for (let i = 0; i < n; i++) this.sprites[s].push(this._loadImg(`${base}/${s}/${i}.png`));
        }
    }

    _getFrame() {
        const stateName = this.state === 'chase' ? 'move' : this.state === 'attack' ? 'attack' : 'idle';
        const frames = this.sprites[stateName];
        if (!frames || !frames.length) return null;
        const img = frames[this.animFrame % frames.length];
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    update(dt, player, world, particles) {
        if (this.rising) {
            this.risingTimer += dt;
            if (this.risingTimer >= this.risingMax) {
                this.rising = false;
                if (particles) particles.addText(this.x, this.y - 60, 'RAWR!', '#ff8040', 25);
            }
            return;
        }

        if (!this.alive) {
            this.deadTimer += dt;
            if (this.deadTimer > 0.2) {
                this.respawnTimer += dt;
                if (this.respawnTimer >= 20) {
                    // Full respawn
                    this.hp = this.maxHp;
                    this.alive = true;
                    this.phase = 1;
                    this.deadTimer = 0;
                    this.respawnTimer = 0;
                    this.x = this.spawnX;
                    this.y = this.spawnY;
                    this.state = 'idle';
                    this.hurtTimer = 0;
                    this.attackTimer = 0;
                    this.slashTimer = (this.slashCd || 99) * 0.5;
                    this.spikeTimer = (this.spikeCd || 99);
                    this.knockX = 0; this.knockY = 0;
                    this.projectiles = [];
                    this.speed = (cfg[this.type] || cfg.forest_guardian).speed; // reset speed
                }
            }
            return;
        }

        // Phase transitions
        const hpRatio = this.hp / this.maxHp;
        if (this.phases >= 2 && hpRatio < 0.5 && this.phase === 1) {
            this.phase = 2;
            this.speed *= 1.4;
            this.attackCd *= 0.75;
            particles.spawnDeath(this.x, this.y, this.color);
            particles.addText(this.x, this.y - 60, 'PHASE 2!', '#ff4040', 22);
        }
        if (this.phases >= 3 && hpRatio < 0.25 && this.phase === 2) {
            this.phase = 3;
            this.speed *= 1.3;
            particles.addText(this.x, this.y - 60, 'FINAL PHASE!', '#ff2020', 22);
        }

        // Knockback
        if (Math.abs(this.knockX) > 0.5 || Math.abs(this.knockY) > 0.5) {
            this.x += this.knockX * dt;
            this.y += this.knockY * dt;
            this.knockX *= (1 - 8 * dt);
            this.knockY *= (1 - 8 * dt);
        }

        if (this.slowTimer > 0) this.slowTimer -= dt;
        const currentSpeed = this.slowTimer > 0 ? this.speed * 0.5 : this.speed;

        if (this.hurtTimer > 0) this.hurtTimer -= dt;
        if (this.attackTimer > 0) this.attackTimer -= dt;
        if (this.specialTimer > 0) this.specialTimer -= dt;
        if (this.slashTimer > 0) this.slashTimer -= dt;
        if (this.spikeTimer > 0) this.spikeTimer -= dt;

        // Compute direction to player (needed by slam + specials + AI below)
        const dx = player.x - this.x, dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        const dirLen = dist || 1;

        // ── 🦝 Raccoon: Ground Slam AoE ──────────────────────────────────────
        if (this.type === 'raccoon') {
            this.slamTimer -= dt;
            if (this.slamState === 'none' && this.slamTimer <= 0 && dist < 180 && !player.dead) {
                this.slamState = 'windup';
                this.slamWindup = 0;
                particles.addText(this.x, this.y - 60, '⚡ SLAM!', '#ffcc00', 14);
            }
            if (this.slamState === 'windup') {
                this.slamWindup += dt;
                if (this.slamWindup >= 0.55) {
                    this.slamState = 'shockwave';
                    this.shockwaveR = 10;
                    this.shockwaveAlive = true;
                    this.shockwaveHit = false;
                }
            }
            if (this.slamState === 'shockwave') {
                this.shockwaveR += 280 * dt;
                if (!this.shockwaveHit && !player.dead && Math.hypot(player.x - this.x, player.y - this.y) < this.shockwaveR + player.radius) {
                    player.takeDamage(6);
                    particles.spawnPlayerHurt(player.x, player.y);
                    particles.addText(player.x, player.y - 30, '-6', '#ff4400', 18);
                    this.shockwaveHit = true;
                }
                if (this.shockwaveR > 200) {
                    this.slamState = 'none';
                    this.shockwaveAlive = false;
                    this.slamTimer = 6 + Math.random() * 2;
                }
            }
        }


        // ── CLAW SLASH: fan of 5 slash projectiles (phase 1+) ─────────────────
        if (this.slashCd < 90 && this.slashTimer <= 0 && dist < 500 && !player.dead) {
            this.slashTimer = this.slashCd * (this.phase === 1 ? 1.0 : 0.65);
            const baseAngle = Math.atan2(dy, dx);
            for (let i = -2; i <= 2; i++) {
                const angle = baseAngle + i * 0.25;
                this.projectiles.push({
                    x: this.x + Math.cos(angle) * (this.radius + 10),
                    y: this.y + Math.sin(angle) * (this.radius + 10),
                    vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130,
                    life: 30.0, radius: 10, damage: this.attackDmg,
                    color: '#e08040', type: 'slash',
                });
            }
            particles.spawnHit(this.x, this.y);
            particles.addText(this.x, this.y - 50, 'SLASH!', '#ff8040', 14);
        }

        // ── SPIKE LINE: straight row of spikes toward player (phase 2+) ─────
        if (this.spikeCd < 90 && this.phase >= 2 && this.spikeTimer <= 0 && dist < 600 && !player.dead) {
            this.spikeTimer = this.spikeCd * (this.phase === 2 ? 1.0 : 0.7);
            const normX = dx / dirLen, normY = dy / dirLen;
            for (let i = 0; i < 7; i++) {
                const delay = i * 0.08;
                this.projectiles.push({
                    x: this.x + normX * (this.radius + 20 + i * 28),
                    y: this.y + normY * (this.radius + 20 + i * 28),
                    vx: normX * 260, vy: normY * 260,
                    life: 0.9 + delay, radius: 14, damage: Math.ceil(this.attackDmg * 0.8),
                    color: '#804040', type: 'spike',
                });
            }
            particles.addText(this.x, this.y - 50, 'SPIKE LINE!', '#ff4040', 14);
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;

            // Wall collision check
            if (world && !world.isWorldPassable(nx, ny, p.radius)) {
                this.projectiles.splice(i, 1);
                continue;
            }

            p.x = nx; p.y = ny;
            p.life -= dt;
            if (!player.dead) {
                const d = Math.hypot(player.x - p.x, player.y - p.y);
                if (d < p.radius + player.radius && player.takeDamage(p.damage)) {
                    particles.spawnPlayerHurt(player.x, player.y);
                }
            }
            if (p.life <= 0) this.projectiles.splice(i, 1);
        }

        // AI
        if (dist < this.attackRange && !player.dead) {
            this.state = 'attack';
            if (this.attackTimer <= 0) {
                if (player.takeDamage(this.attackDmg)) {
                    this.attackTimer = this.attackCd;
                }
            }
        } else if (dist < this.alertRange && !player.dead) {
            this.state = 'chase';
            if (dist > 0) {
                this.x += (dx / dist) * currentSpeed * dt;
                this.y += (dy / dist) * currentSpeed * dt;
            }
        } else {
            this.state = 'idle';
        }

        this.animTimer += dt;
        if (this.animTimer > 0.12) {
            this.animTimer = 0;
            const frames = this.sprites[this.state === 'chase' ? 'move' : this.state === 'attack' ? 'attack' : 'idle'];
            this.animFrame = (this.animFrame + 1) % Math.max(1, frames.length);
        }
    }

    takeDamage(amount, fx, fy) {
        if (!this.alive) return;
        this.hp -= amount;
        this.hurtTimer = 0.2;
        const dx = this.x - fx, dy = this.y - fy;
        const len = Math.hypot(dx, dy) || 1;
        this.knockX = (dx / len) * 120;
        this.knockY = (dy / len) * 120;
        if (this.hp <= 0) { this.alive = false; this.deadTimer = 0; }
    }

    draw(ctx, camX, camY, time) {
        // Ghost indicator 3s before respawn
        if (!this.alive && this.respawnTimer > 17) {
            const gsx = this.spawnX - camX, gsy = this.spawnY - camY;
            const t = (this.respawnTimer - 17) / 3;
            const pulse = Math.sin(time * 6) * 0.35 + 0.65;
            ctx.globalAlpha = t * 0.6 * pulse;
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 30; ctx.shadowColor = this.color;
            ctx.beginPath(); ctx.arc(gsx, gsy, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            return;
        }
        // Invisible while dead
        if (!this.alive) return;

        const sx = this.x - camX, sy = this.y - (this.rising ? camY + this.risingYOffset * (1 - this.risingTimer / this.risingMax) : camY);
        if (sx < -100 || sy < -100 || sx > 1400 || sy > 900) return;

        ctx.globalAlpha = this.rising ? 0.3 + (this.risingTimer / this.risingMax) * 0.7 : 1;


        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(sx, sy + this.radius + 6, this.radius * 1.1, this.radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();

        const flash = this.hurtTimer > 0 && Math.floor(time * 14) % 2 === 0;
        const frame = this._getFrame();
        const scale = this.type === 'stone_golem' ? 1.6 : 1.35;
        const sw = 80 * scale, sh = 80 * scale;

        if (frame && !flash) {
            ctx.drawImage(frame, sx - sw / 2, sy - sh / 2 - 10, sw, sh);
        } else if (frame && flash) {
            ctx.save();
            ctx.drawImage(frame, sx - sw / 2, sy - sh / 2 - 10, sw, sh);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255,50,50,0.7)';
            ctx.fillRect(sx - sw / 2, sy - sh / 2 - 10, sw, sh);
            ctx.restore();
        } else {
            // Fallback
            ctx.fillStyle = flash ? '#ff6060' : this.color;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2); ctx.fill();
        }

        // Phase indicator ring
        if (this.alive) {
            const ringColor = this.phase === 1 ? 'rgba(80,200,80,0.4)' : this.phase === 2 ? 'rgba(255,160,40,0.5)' : 'rgba(255,40,40,0.6)';
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = 3 + Math.sin(time * 4) * 1.5;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius + 8, 0, Math.PI * 2); ctx.stroke();
        }

        // Boss projectiles
        for (const p of this.projectiles) {
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 16; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x - camX, p.y - camY, p.radius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        // 🦝 Raccoon ground slam shockwave ring
        if (this.type === 'raccoon' && this.slamState === 'windup') {
            const pulse = Math.sin(time * 20) * 0.4 + 0.6;
            ctx.strokeStyle = `rgba(255,200,0,${pulse})`;
            ctx.lineWidth = 4;
            ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.arc(sx, sy, this.radius + 18, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }
        if (this.type === 'raccoon' && this.shockwaveAlive) {
            const alpha = Math.max(0, 1 - this.shockwaveR / 200);
            ctx.strokeStyle = `rgba(255,180,0,${alpha})`;
            ctx.lineWidth = 6;
            ctx.shadowBlur = 20; ctx.shadowColor = '#ffaa00';
            ctx.beginPath(); ctx.arc(sx, sy, this.shockwaveR, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
    }

    drawBossBar(ctx, W, H) {
        if (!this.alive && this.deadTimer > 0.5) return;
        if (this.rising) return;
        const alpha = this.alive ? 1 : Math.max(0, 1 - this.deadTimer * 2);
        ctx.save();
        ctx.globalAlpha = alpha;

        // Boss bar at top center
        const bw = 500, bh = 22, bx = W / 2 - bw / 2, by = H - 60;
        ctx.fillStyle = 'rgba(8,16,8,0.9)';
        ctx.strokeStyle = this.phase === 1 ? 'rgba(80,180,80,0.7)' : this.phase === 2 ? 'rgba(255,160,40,0.7)' : 'rgba(255,50,50,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(bx - 8, by - 30, bw + 16, bh + 38, 10); ctx.fill(); ctx.stroke();

        // Name
        ctx.font = "bold 11px 'Press Start 2P', monospace";
        ctx.fillStyle = '#e0ffe0';
        ctx.textAlign = 'center';
        const phaseStr = this.phase > 1 ? ` (Phase ${this.phase})` : '';
        ctx.fillText(this.name + phaseStr, W / 2, by - 10);

        // BG bar
        ctx.fillStyle = 'rgba(30,0,0,0.8)';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();

        // HP bar with pulse
        const ratio = Math.max(0, this.hp / this.maxHp);
        const barColor = ratio > 0.5 ? '#40e060' : ratio > 0.25 ? '#e0a020' : '#e02020';
        ctx.fillStyle = barColor;
        ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 5); ctx.fill();

        // HP text
        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.max(0, this.hp)} / ${this.maxHp}`, W / 2, by + bh - 6);

        ctx.restore();
    }
}
