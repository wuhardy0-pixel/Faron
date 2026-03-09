
class Player {
    constructor(wx, wy, nickname = 'Player') {
        this.x = wx; this.y = wy;
        this.nickname = nickname;
        this.speed = 170;
        this.radius = 16;
        this.dir = 'down';
        this.state = 'idle';

        // HP / MP (numeric, not hearts)
        this.maxHp = 30; this.hp = 30;
        this.maxMp = 12; this.mp = 12;
        this.mpRegen = 1.8;   // MP per second
        this.mpRegenTimer = 0;

        // Stats
        this.swordDamage = 5;
        this.defense = 0;
        this.rupees = 0;
        this.level = 1;
        this.xp = 0;
        this.xpToNext = 30;

        // Upgrades bag passed to magic etc.
        this.upgrades = {
            firePower: 0,
            leafStormUnlocked: false,
        };

        this.attackTimer = 0;
        this.attackDuration = 0.28;
        this.attackCooldown = 0;
        this.invincible = 0;
        this.hurtTimer = 0;
        this.dead = false;
        this.deathTimer = 0;
        this._prevAttackKey = false; // track fresh press to prevent hold-attack

        this.animFrame = 0;
        this.animTimer = 0;
        this.animSpeed = 0.14;

        this.swordLen = 40;
        this.swordAngle = 0;

        // Team & Recruits
        this.team = [];     // Array of { type, name, color, ... }
        this.history = [];  // Trail of past positions for following teammates
        for (let i = 0; i < 60; i++) this.history.push({ x: wx, y: wy });
        this.teammateProjectiles = []; // Game.js collects these


        // Sprites (Shared across all instances)
        if (!Player.sprites) {
            Player.sprites = {};
            this._loadSprites();
        }
        this.weaponImgs = {};
        this._loadWeapon();
    }

    static sprites = null;

    _loadImg(src) { const img = new Image(); img.src = src; return img; }

    _loadSprites() {
        const base = './1/graphics/player';
        const dirs = ['down', 'up', 'left', 'right'];
        for (const dir of dirs) {
            Player.sprites[dir] = { idle: [], walk: [], attack: [] };
            for (let i = 0; i < 4; i++) Player.sprites[dir].walk.push(this._loadImg(`${base}/${dir}/${dir}_${i}.png`));
            Player.sprites[dir].idle.push(this._loadImg(`${base}/${dir}_idle/idle_${dir}.png`));
            Player.sprites[dir].attack.push(this._loadImg(`${base}/${dir}_attack/attack_${dir}.png`));
        }
    }

    _loadWeapon() {
        ['down', 'up', 'left', 'right'].forEach(d => {
            this.weaponImgs[d] = this._loadImg(`./1/graphics/weapons/sword/${d}.png`);
        });
    }

    _getFrame() {
        const st = this.state === 'hurt' ? 'idle' : this.state;
        const frames = Player.sprites[this.dir]?.[st];
        if (!frames || !frames.length) return null;
        const img = frames[this.animFrame % frames.length];
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    getSwordHitbox() {
        if (this.state !== 'attack') return null;
        const dirMap = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 };
        const angle = dirMap[this.dir];
        const progress = 1 - this.attackTimer / this.attackDuration;
        const swingAngle = angle + (progress - 0.5) * 1.4;
        const hx = this.x + Math.cos(swingAngle) * (this.radius + this.swordLen * 0.55);
        const hy = this.y + Math.sin(swingAngle) * (this.radius + this.swordLen * 0.55);
        this.swordAngle = swingAngle;
        return { x: hx, y: hy, r: 28, damage: this.swordDamage };
    }

    update(dt, keys, world) {
        if (this.dead) { this.deathTimer += dt; return; }

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.hurtTimer > 0) this.hurtTimer -= dt;

        // MP regen
        this.mpRegenTimer += dt;
        if (this.mpRegenTimer >= 1 / this.mpRegen) {
            this.mpRegenTimer = 0;
            this.mp = Math.min(this.maxMp, this.mp + 1);
        }

        // Attack state
        if (this.state === 'attack') {
            this.attackTimer -= dt;
            this.animTimer += dt;
            if (this.animTimer > this.animSpeed) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
            if (this.attackTimer <= 0) { this.state = 'idle'; this.attackTimer = 0; }
            return;
        }

        // Sword attack — only trigger on a FRESH press (not held)
        const attackKey = keys['Space'] || keys['KeyZ'] || keys['KeyX'];
        if (attackKey && !this._prevAttackKey && this.attackCooldown <= 0) {
            this.state = 'attack';
            this.attackTimer = this.attackDuration;
            this.attackCooldown = 0.44;
            this.animFrame = 0; this.animTimer = 0;
            this._prevAttackKey = true;
            return;
        }
        if (!attackKey) this._prevAttackKey = false;

        // Movement
        let dx = 0, dy = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
        if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) dy += 1;

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            dx /= len; dy /= len;
            if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
            else this.dir = dy > 0 ? 'down' : 'up';
            this.state = 'walk';
            const nx = this.x + dx * this.speed * dt;
            const ny = this.y + dy * this.speed * dt;
            if (world.isWorldPassable(nx, this.y, this.radius)) this.x = nx;
            if (world.isWorldPassable(this.x, ny, this.radius)) this.y = ny;
            this.animTimer += dt;
            if (this.animTimer > this.animSpeed) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
            this.animTimer += dt;
            if (this.animTimer > this.animSpeed * 2) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 2; }
        }

        // Record history
        const last = this.history[0];
        if (Math.hypot(last.x - this.x, last.y - this.y) > 2) {
            this.history.unshift({ x: this.x, y: this.y });
            if (this.history.length > 200) this.history.pop();
        }

        this._updateTeammates(dt, world);
    }

    _updateTeammates(dt, world) {
        this.teammateProjectiles = [];
        const enemies = window._game ? window._game.enemies : [];
        const boss = window._game ? window._game.boss : null;
        const allTargets = [...enemies, ...(boss && boss.alive ? [boss] : [])];

        this.team.forEach((tm, idx) => {
            if (!tm.attackTimer) tm.attackTimer = 1 + idx * 0.5;
            if (!tm.state) tm.state = 'follow';
            tm.attackTimer -= dt;

            // Targeting
            const delay = (idx + 1) * 18;
            const pos = this.history[Math.min(this.history.length - 1, delay)] || { x: this.x, y: this.y };

            if (tm.attackTimer <= 0 && allTargets.length > 0) {
                // Find nearest enemy to the teammate's current position (breadcrumb position)
                let nearest = null, minDist = 250;
                for (const en of allTargets) {
                    const d = Math.hypot(en.x - pos.x, en.y - pos.y);
                    if (d < minDist) { minDist = d; nearest = en; }
                }

                if (nearest) {
                    if (tm.type === 'warrior') { // Hardy logic
                        if (minDist < 60) {
                            tm.state = 'attack';
                            tm.attackTimer = 1.2;
                            nearest.takeDamage(4, pos.x, pos.y);
                            if (window._game) {
                                window._game.particles.addText(nearest.x, nearest.y - 20, '-4', '#ff4444', 12);
                                window._game.particles.spawnHit(nearest.x, nearest.y);
                            }
                        }
                    } else if (tm.type === 'mage') { // Sophia logic
                        tm.state = 'attack';
                        tm.attackTimer = 1.8;
                        const angle = Math.atan2(nearest.y - pos.y, nearest.x - pos.x);
                        tm.spellType = (tm.spellType === 'ice' ? 'fire' : 'ice');
                        this.teammateProjectiles.push({
                            type: tm.spellType === 'ice' ? 'ice_bolt' : 'fire_bolt',
                            x: pos.x, y: pos.y,
                            vx: Math.cos(angle) * 220,
                            vy: Math.sin(angle) * 220,
                            life: 2.0, radius: 8, damage: tm.spellType === 'ice' ? 2 : 5,
                            color: tm.spellType === 'ice' ? '#80e0ff' : '#ff6020'
                        });
                    }
                }
            }
            if (tm.attackTimer < 0.8 && tm.state === 'attack') tm.state = 'follow';
        });
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(this.xpToNext * 1.5);
            this.maxHp += 3; this.hp = this.maxHp;
            this.maxMp += 2; this.mp = this.maxMp;
            return true; // leveled up
        }
        return false;
    }

    takeDamage(amount) {
        if (this.invincible > 0 || this.dead) return false;
        const actual = Math.max(1, amount - this.defense);
        this.hp = Math.max(0, this.hp - actual);
        this.invincible = 1.2;
        this.hurtTimer = 0.25;
        if (this.hp <= 0) this.dead = true;
        return true;
    }

    collectItem(item) {
        if (item.type === 'heart') this.hp = Math.min(this.maxHp, this.hp + 8);
        else if (item.type === 'rupee') this.rupees += item.value;
    }

    draw(ctx, camX, camY, time) {
        const sx = this.x - camX, sy = this.y - camY;
        const flash = this.invincible > 0 && Math.floor(time * 12) % 2 === 0;
        if (flash) ctx.globalAlpha = 0.3;
        if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / 1.5);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(sx, sy + 18, 16, 7, 0, 0, Math.PI * 2); ctx.fill();

        const frame = this._getFrame();
        if (frame) {
            ctx.drawImage(frame, sx - 32, sy - 40, 64, 64);
        } else {
            this._drawFallback(ctx, sx, sy, time);
        }

        // Weapon during attack
        if (this.state === 'attack') {
            const wImg = this.weaponImgs[this.dir];
            const offsets = { down: [18, 24], up: [-18, -24], left: [-30, 4], right: [30, 4] };
            const [ox, oy] = offsets[this.dir];
            if (wImg && wImg.complete && wImg.naturalWidth > 0) {
                ctx.drawImage(wImg, sx + ox - 16, sy + oy - 16, 32, 32);
            } else {
                const hb = this.getSwordHitbox();
                if (hb) {
                    ctx.strokeStyle = '#e8e8ff'; ctx.lineWidth = 5; ctx.shadowBlur = 10; ctx.shadowColor = '#aaccff';
                    ctx.beginPath();
                    ctx.moveTo(sx + Math.cos(this.swordAngle) * 18, sy + Math.sin(this.swordAngle) * 18);
                    ctx.lineTo(sx + Math.cos(this.swordAngle) * (this.swordLen + 6), sy + Math.sin(this.swordAngle) * (this.swordLen + 6));
                    ctx.stroke(); ctx.shadowBlur = 0;
                }
            }
        }

        this.drawTeammates(ctx, camX, camY, time);

        // Nickname
        if (this.nickname) {
            ctx.font = "bold 10px 'Press Start 2P', monospace";
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 4; ctx.shadowColor = '#000';
            ctx.fillText(this.nickname, sx, sy - 45);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
        }

        ctx.globalAlpha = 1;
    }

    drawTeammates(ctx, camX, camY, time) {
        this.team.forEach((tm, idx) => {
            const delay = (idx + 1) * 18;
            const pos = this.history[Math.min(this.history.length - 1, delay)] || { x: this.x, y: this.y };
            const sx = pos.x - camX, sy = pos.y - camY;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(sx, sy + 14, 12, 5, 0, 0, Math.PI * 2); ctx.fill();

            // Teammate Body
            ctx.fillStyle = tm.color || '#aaa';
            const bob = Math.sin(time * 6 + idx) * 3;
            ctx.beginPath(); ctx.arc(sx, sy + (tm.state === 'attack' ? -8 : bob), 10, 0, Math.PI * 2); ctx.fill();

            // Interaction visual
            if (tm.state === 'attack') {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy - 8, 14, 0, Math.PI * 2); ctx.stroke();
            }
            // Teammate Name Tag
            ctx.font = "bold 8px 'Press Start 2P', monospace";
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(tm.name, sx, sy - 18);
            ctx.textAlign = 'left';
        });
    }

    static drawOtherPlayer(ctx, player, camX, camY, time) {
        const sx = player.x - camX, sy = player.y - camY;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(sx, sy + 18, 16, 7, 0, 0, Math.PI * 2); ctx.fill();

        // Sprite drawing
        const st = player.state || 'idle';
        const dir = player.dir || 'down';
        const frames = Player.sprites?.[dir]?.[st];

        if (frames && frames.length > 0) {
            const animFrame = Math.floor(time / 0.14) % frames.length;
            const img = frames[animFrame];
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, sx - 32, sy - 40, 64, 64);
            } else {
                Player.prototype._drawFallback.call({ state: st, dir: dir, animFrame: animFrame, hurtTimer: 0 }, ctx, sx, sy, time);
            }
        } else {
            Player.prototype._drawFallback.call({ state: st, dir: dir, animFrame: 0, hurtTimer: 0 }, ctx, sx, sy, time);
        }

        // Nickname
        ctx.font = "bold 10px 'Press Start 2P', monospace";
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4; ctx.shadowColor = '#000';
        ctx.fillText(player.nickname || 'Player', sx, sy - 45);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    }

    _drawFallback(ctx, sx, sy, time) {
        const bobY = this.state === 'walk' ? Math.sin(this.animFrame * Math.PI / 2) * 2 : 0;
        const dy = sy - bobY;
        ctx.fillStyle = this.hurtTimer > 0 ? '#ff8080' : '#3a8a20';
        ctx.beginPath(); ctx.ellipse(sx, dy + 4, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c87840';
        ctx.beginPath(); ctx.arc(sx, dy - 14, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a7010';
        ctx.beginPath(); ctx.moveTo(sx, dy - 32); ctx.lineTo(sx - 12, dy - 16); ctx.lineTo(sx + 12, dy - 16); ctx.closePath(); ctx.fill();
        const leg = this.state === 'walk' ? Math.sin(this.animFrame * Math.PI / 2) * 5 : 0;
        ctx.fillStyle = '#3060a0';
        ctx.beginPath(); ctx.ellipse(sx - 5, dy + 17 + leg, 4.5, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + 5, dy + 17 - leg, 4.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
}
