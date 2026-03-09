
// ─── Magic Spell Projectiles & Effects ───────────────────────────────────────
class MagicSystem {
    constructor() {
        this.projectiles = [];
        this.effects = [];
    }

    // Q – Fireball: shoots a fireball in facing direction
    castFireball(player, upgrades) {
        const dirMap = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
        const [dx, dy] = dirMap[player.dir];
        const power = 5 + (upgrades.magicPower || 0) * 2;
        this.projectiles.push({
            x: player.x + dx * 20, y: player.y + dy * 20,
            vx: dx * 340, vy: dy * 340,
            type: 'fireball',
            damage: power,
            radius: 10,
            life: 1.6,
            maxLife: 1.6,
            trail: [],
            color: '#ff6020',
            glowColor: '#ff9040',
        });
    }

    // E – Spin Attack: instant 360° sweep — damage applied immediately on cast
    castSpin(player, particles, upgrades, enemies) {
        const power = 4 + (upgrades.magicPower || 0) * 2;
        const radius = 80;

        // Visual burst ring
        for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            particles.spawn(
                player.x + Math.cos(angle) * 36,
                player.y + Math.sin(angle) * 36,
                { color: a % 2 === 0 ? '#c0c0ff' : '#ffffff', count: 1, speed: 180, life: 0.45, size: 6 }
            );
        }

        // Hit every alive enemy in radius RIGHT NOW
        const alreadyHit = new Set();
        if (enemies) {
            for (const e of enemies) {
                if (!e.alive) continue;
                const dist = Math.hypot(e.x - player.x, e.y - player.y);
                if (dist < radius + e.radius) {
                    e.takeDamage(power, player.x, player.y);
                    particles.spawnHit(e.x, e.y);
                    particles.addText(e.x, e.y - 28, `-${power}`, '#c0c0ff', 16);
                    alreadyHit.add(e);
                }
            }
        }

        // Visual-only ring effect (damage:0 since already dealt)
        this.effects.push({
            x: player.x, y: player.y, type: 'spin', radius,
            damage: 0, life: 0.3, maxLife: 0.3,
            hitEnemies: alreadyHit, color: '#c0c0ff',
        });

        return [...alreadyHit];
    }


    // R – Leaf Storm: erupts a ring of homing leaves
    castLeafStorm(player, particles, upgrades) {
        if (!player.upgrades.leafStormUnlocked) return false;
        const power = 6 + (upgrades.magicPower || 0) * 3;
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            this.projectiles.push({
                x: player.x, y: player.y,
                vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200,
                type: 'leaf',
                damage: power,
                radius: 8, life: 1.2, maxLife: 1.2,
                color: '#40e060', glowColor: '#80ff80',
                trail: [],
            });
        }
        for (let i = 0; i < 20; i++) {
            const ang = Math.random() * Math.PI * 2;
            particles.particles.push({
                x: player.x, y: player.y,
                vx: Math.cos(ang) * 120, vy: Math.sin(ang) * 120,
                life: 0.6, maxLife: 0.6,
                size: 5, color: '#60ff80', gravity: -30,
            });
        }
        return true;
    }

    update(dt, enemies, player, particles) {
        const hitEnemies = [];

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 8) p.trail.shift();
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // Leaf slight homing toward nearest enemy
            if (p.type === 'leaf' && enemies.length > 0) {
                let nearest = null, nearDist = 999999;
                for (const e of enemies) {
                    if (!e.alive) continue;
                    const d = Math.hypot(e.x - p.x, e.y - p.y);
                    if (d < nearDist) { nearDist = d; nearest = e; }
                }
                if (nearest && nearDist < 250) {
                    const dx = nearest.x - p.x, dy = nearest.y - p.y;
                    const len = Math.hypot(dx, dy) || 1;
                    p.vx += (dx / len) * 300 * dt;
                    p.vy += (dy / len) * 300 * dt;
                    const speed = Math.hypot(p.vx, p.vy);
                    if (speed > 220) { p.vx = (p.vx / speed) * 220; p.vy = (p.vy / speed) * 220; }
                }
            }

            if (p.life <= 0) { this.projectiles.splice(i, 1); continue; }

            // Hit enemies
            let hit = false;
            for (const e of enemies) {
                if (!e.alive) continue;
                const dist = Math.hypot(e.x - p.x, e.y - p.y);
                if (dist < p.radius + e.radius) {
                    e.takeDamage(p.damage, p.x, p.y);
                    particles.spawnHit(e.x, e.y);
                    particles.addText(e.x, e.y - 24, `-${p.damage}`, '#ff8040', 15);
                    hitEnemies.push(e);
                    if (p.type === 'fireball') {
                        particles.spawnDeath(p.x, p.y, '#ff6020');
                        this.projectiles.splice(i, 1);
                        hit = true;
                        break;
                    }
                }
            }
            if (hit) continue;
        }

        // Update spin effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const eff = this.effects[i];
            eff.life -= dt;
            if (eff.life <= 0) { this.effects.splice(i, 1); continue; }

            for (const e of enemies) {
                if (!e.alive || eff.hitEnemies.has(e)) continue;
                const dist = Math.hypot(e.x - eff.x, e.y - eff.y);
                if (dist < eff.radius + e.radius) {
                    eff.hitEnemies.add(e);
                    e.takeDamage(eff.damage, eff.x, eff.y);
                    particles.spawnHit(e.x, e.y);
                    particles.addText(e.x, e.y - 24, `-${eff.damage}`, '#c0c0ff', 15);
                    hitEnemies.push(e);
                }
            }
        }

        return hitEnemies;
    }

    draw(ctx, camX, camY) {
        // Draw spin effects
        for (const eff of this.effects) {
            const t = eff.life / eff.maxLife;
            ctx.globalAlpha = t * 0.55;
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(eff.x - camX, eff.y - camY, eff.radius * (1.2 - t * 0.3), 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw projectiles
        for (const p of this.projectiles) {
            const sx = p.x - camX, sy = p.y - camY;

            // Trail
            for (let t = 0; t < p.trail.length; t++) {
                const tp = p.trail[t];
                const alpha = (t / p.trail.length) * 0.5;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(tp.x - camX, tp.y - camY, p.radius * (t / p.trail.length) * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Main orb
            ctx.shadowBlur = 18; ctx.shadowColor = p.glowColor;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(sx, sy, p.radius, 0, Math.PI * 2); ctx.fill();
            // Core
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(sx - p.radius * 0.3, sy - p.radius * 0.3, p.radius * 0.35, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}
