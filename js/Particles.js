
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.texts = [];
    }

    spawn(x, y, { color = '#fff', count = 6, speed = 80, life = 0.5, size = 4, spread = Math.PI * 2 } = {}) {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * spread - spread / 2 + Math.random() * 0.4;
            const spd = speed * (0.6 + Math.random() * 0.8);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life, maxLife: life,
                size: size * (0.5 + Math.random() * 0.8),
                color,
                gravity: 60,
            });
        }
    }

    spawnHit(x, y) {
        this.spawn(x, y, { color: '#ff6a00', count: 8, speed: 120, life: 0.4, size: 5 });
        this.spawn(x, y, { color: '#ffe040', count: 5, speed: 80, life: 0.3, size: 3 });
    }

    spawnDeath(x, y, color = '#e04040') {
        this.spawn(x, y, { color, count: 14, speed: 160, life: 0.7, size: 7 });
        this.spawn(x, y, { color: '#fff', count: 8, speed: 100, life: 0.5, size: 4 });
        this.spawn(x, y, { color: '#ffe040', count: 6, speed: 60, life: 0.8, size: 3 });
    }

    spawnPickup(x, y) {
        this.spawn(x, y, { color: '#40ff80', count: 10, speed: 90, life: 0.6, size: 4 });
        this.spawn(x, y, { color: '#fff', count: 6, speed: 120, life: 0.4, size: 3 });
    }

    spawnHeartPickup(x, y) {
        this.spawn(x, y, { color: '#ff4080', count: 12, speed: 100, life: 0.7, size: 5 });
        this.spawn(x, y, { color: '#ffaacc', count: 6, speed: 60, life: 0.5, size: 3 });
    }

    spawnPlayerHurt(x, y) {
        this.spawn(x, y, { color: '#ff2020', count: 10, speed: 140, life: 0.5, size: 6 });
        this.spawn(x, y, { color: '#ff8080', count: 6, speed: 80, life: 0.4, size: 4 });
    }

    addText(x, y, text, color = '#fff', size = 18, duration = 1.2) {
        this.texts.push({ x, y, vy: -50, text, color, size, life: duration, maxLife: duration });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += p.gravity * dt;
            p.vx *= (1 - 4 * dt);
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.y += t.vy * dt;
            t.vy *= (1 - 3 * dt);
            t.life -= dt;
            if (t.life <= 0) this.texts.splice(i, 1);
        }
    }

    draw(ctx, camX, camY) {
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x - camX, p.y - camY, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        for (const t of this.texts) {
            const alpha = Math.min(1, t.life / t.maxLife * 2);
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.font = `bold ${t.size}px 'Press Start 2P', monospace`;
            ctx.fillStyle = t.color;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 3;
            ctx.textAlign = 'center';
            ctx.strokeText(t.text, t.x - camX, t.y - camY);
            ctx.fillText(t.text, t.x - camX, t.y - camY);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }
}
