
class UI {
    constructor() {
        this.font = "bold 14px 'Press Start 2P', 'Courier New', monospace";
        this.fontSm = "11px 'Press Start 2P', 'Courier New', monospace";
        this.fontTiny = "10px 'Press Start 2P', 'Courier New', monospace";
    }

    // ─── In-game HUD ─────────────────────────────────────────────────────────────
    draw(ctx, player, world, W, H, levelName) {
        // === TOP-LEFT PANEL: HP + MP bars ===
        ctx.fillStyle = 'rgba(8,18,8,0.88)';
        ctx.strokeStyle = 'rgba(60,180,60,0.65)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(8, 8, 260, 96, 10); ctx.fill(); ctx.stroke();

        // HP Label
        ctx.font = "bold 12px 'Press Start 2P', monospace";
        ctx.fillStyle = '#ff6080'; ctx.textAlign = 'left';
        ctx.fillText('HP', 18, 30);

        // HP Bar
        const hpRatio = Math.max(0, player.hp / player.maxHp);
        const hpW = 178;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(52, 14, hpW, 20, 4); ctx.fill();
        const hpColor = hpRatio > 0.5 ? '#40e860' : hpRatio > 0.25 ? '#e0a020' : '#e03030';
        ctx.fillStyle = hpColor;
        ctx.beginPath(); ctx.roundRect(52, 14, hpW * hpRatio, 20, 4); ctx.fill();
        ctx.font = "bold 10px 'Press Start 2P', monospace";
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.hp}/${player.maxHp}`, 52 + hpW / 2, 29);

        // MP Label
        ctx.fillStyle = '#60a0ff'; ctx.textAlign = 'left';
        ctx.font = "bold 12px 'Press Start 2P', monospace";
        ctx.fillText('MP', 18, 58);

        // MP Bar
        const mpRatio = Math.max(0, player.mp / player.maxMp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(52, 42, hpW, 20, 4); ctx.fill();
        ctx.fillStyle = '#60e880';
        ctx.beginPath(); ctx.roundRect(52, 42, hpW * mpRatio, 20, 4); ctx.fill();
        ctx.font = "bold 10px 'Press Start 2P', monospace";
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`${player.mp}/${player.maxMp}`, 52 + hpW / 2, 57);

        // XP bar
        const xpRatio = Math.max(0, player.xp / player.xpToNext);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.roundRect(18, 70, hpW + 16, 12, 3); ctx.fill();
        ctx.fillStyle = '#c0a0ff';
        ctx.beginPath(); ctx.roundRect(18, 70, (hpW + 16) * xpRatio, 12, 3); ctx.fill();
        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.fillStyle = '#c0b0ff'; ctx.textAlign = 'left';
        ctx.fillText(`Lv ${player.level}  XP ${player.xp}/${player.xpToNext}`, 18, 94);

        // === TOP-RIGHT: Rupees + Level Name ===
        ctx.fillStyle = 'rgba(8,18,8,0.88)';
        ctx.strokeStyle = 'rgba(60,180,60,0.65)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(W - 220, 8, 212, 64, 8); ctx.fill(); ctx.stroke();

        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.fillStyle = '#40ff70'; ctx.shadowColor = '#40ff70'; ctx.shadowBlur = 6;
        ctx.textAlign = 'left';
        ctx.fillText('◆', W - 204, 36); ctx.shadowBlur = 0;
        ctx.fillStyle = '#c8ffa0';
        ctx.fillText(`${player.rupees}`, W - 180, 36);

        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.fillStyle = 'rgba(160,230,160,0.7)';
        ctx.fillText(levelName || 'Faron Forest', W - 208, 58);

        // === BOTTOM-LEFT: Spell bar ===
        this._drawSpellBar(ctx, player, H);

        // === BOTTOM-RIGHT: Minimap ===
        const mmW = 140, mmH = 110;
        world.drawMinimap(ctx, player.x, player.y, W - mmW - 12, H - mmH - 12, mmW, mmH);
    }

    _drawSpellBar(ctx, player, H) {
        const spells = [
            { key: 'Q', name: 'Fireball', cost: 4, color: '#ff6020', unlocked: true },
            { key: 'E', name: 'Spin', cost: 3, color: '#a0a0ff', unlocked: true },
            { key: 'R', name: 'Leaf ☘', cost: 6, color: '#40e060', unlocked: player.upgrades.leafStormUnlocked },
        ];

        let bx = 14, by = H - 68;
        for (const sp of spells) {
            const canCast = sp.unlocked && player.mp >= sp.cost;
            ctx.fillStyle = 'rgba(8,18,8,0.85)';
            ctx.strokeStyle = sp.unlocked ? (canCast ? 'rgba(100,200,100,0.7)' : 'rgba(80,80,80,0.6)') : 'rgba(40,40,40,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect(bx, by, 62, 54, 6); ctx.fill(); ctx.stroke();

            if (!sp.unlocked) {
                ctx.fillStyle = 'rgba(80,80,80,0.5)';
                ctx.fillRect(bx, by, 62, 54);
                ctx.fillStyle = '#666'; ctx.textAlign = 'center'; ctx.font = "9px 'Press Start 2P', monospace";
                ctx.fillText('LOCKED', bx + 31, by + 30);
            } else {
                ctx.fillStyle = canCast ? sp.color : 'rgba(120,120,120,0.6)';
                ctx.shadowBlur = canCast ? 8 : 0; ctx.shadowColor = sp.color;
                ctx.font = "bold 11px 'Press Start 2P', monospace";
                ctx.textAlign = 'center';
                ctx.fillText(`[${sp.key}]`, bx + 31, by + 20);
                ctx.shadowBlur = 0;
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.fillStyle = 'rgba(160,200,160,0.8)';
                ctx.fillText(sp.name, bx + 31, by + 35);
                ctx.fillStyle = canCast ? '#60e060' : '#ff6060';
                ctx.fillText(`${sp.cost} MP`, bx + 31, by + 50);
            }
            bx += 70;
        }
        ctx.textAlign = 'left';
    }

    // ─── Title Screen ─────────────────────────────────────────────────────────────
    drawTitle(ctx, W, H, time) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, Math.max(W, H));
        const pulse = Math.sin(time * 0.6) * 0.1;
        grad.addColorStop(0, `rgba(${(20 + pulse * 15) | 0},${(50 + pulse * 20) | 0},${(20 + pulse * 15) | 0},1)`);
        grad.addColorStop(0.5, 'rgba(8,22,8,1)');
        grad.addColorStop(1, 'rgba(3,10,3,1)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

        // Sparkles
        for (let i = 0; i < 40; i++) {
            const tx = (Math.sin(i * 2.4 + time * 0.25) * 0.5 + 0.5) * W;
            const ty = (Math.sin(i * 3.7 + time * 0.18) * 0.5 + 0.5) * H;
            const sz = 1.5 + Math.sin(i * 5.1 + time * 2) * 1;
            ctx.globalAlpha = Math.max(0, 0.15 + Math.sin(i * 4.3 + time * 1.5) * 0.1);
            ctx.fillStyle = '#60ff90';
            ctx.beginPath(); ctx.arc(tx, ty, sz, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Tree silhouettes
        [[W * 0.1, H * 0.75, 90], [W * 0.85, H * 0.72, 80], [W * 0.03, H * 0.6, 60], [W * 0.92, H * 0.58, 65]].forEach(([x, y, s]) => {
            ctx.fillStyle = 'rgba(8,25,8,0.75)';
            ctx.beginPath(); ctx.arc(x, y - s * 0.5, s * 0.55, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x - s * 0.22, y - s * 0.2, s * 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + s * 0.22, y - s * 0.2, s * 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(x - s * 0.07, y - s * 0.05, s * 0.14, s * 0.55);
        });

        // Title
        const titleY = H / 2 - 80 + Math.sin(time * 0.8) * 6;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = "bold 96px 'Press Start 2P', serif";
        const tg = ctx.createLinearGradient(W / 2 - 250, titleY - 80, W / 2 + 250, titleY + 10);
        tg.addColorStop(0, '#a8ffb0'); tg.addColorStop(0.3, '#60ff80'); tg.addColorStop(0.6, '#20c050'); tg.addColorStop(1, '#0a8030');
        ctx.fillStyle = tg;
        ctx.shadowColor = '#30ff70'; ctx.shadowBlur = 40;
        ctx.fillText('FARON', W / 2, titleY); ctx.shadowBlur = 0;
        ctx.restore();

        ctx.save(); ctx.textAlign = 'center';
        ctx.font = "15px 'Press Start 2P', monospace";
        ctx.fillStyle = `rgba(160,220,160,${0.6 + Math.sin(time * 1.2) * 0.3})`;
        ctx.shadowColor = '#20a040'; ctx.shadowBlur = 10;
        ctx.fillText('A LEGEND OF THE FOREST', W / 2, H / 2 + 8); ctx.shadowBlur = 0; ctx.restore();

        if (Math.sin(time * 3.5) > 0) {
            ctx.save(); ctx.textAlign = 'center';
            ctx.font = "13px 'Press Start 2P', monospace";
            ctx.fillStyle = '#80ee80'; ctx.shadowColor = '#20c040'; ctx.shadowBlur = 8;
            ctx.fillText('PRESS ENTER TO BEGIN', W / 2, H / 2 + 80); ctx.shadowBlur = 0; ctx.restore();
        }

        // Controls hint on title
        ctx.save(); ctx.textAlign = 'center';
        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.fillStyle = 'rgba(120,180,120,0.5)';
        ctx.fillText('Move: WASD/Arrows  ·  Attack: Space  ·  Magic: Q/E/R  ·  Upgrade: U  ·  Quests: Tab', W / 2, H / 2 + 130);
        ctx.restore();

        ctx.save(); ctx.textAlign = 'right';
        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.fillStyle = 'rgba(100,160,100,0.35)';
        ctx.fillText('FARON v2.0', W - 14, H - 12); ctx.restore();
    }

    drawGameOver(ctx, W, H, time, win = false) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
        const col = win ? '#ffe060' : '#ff4060';
        const glow = win ? '#ffb020' : '#ff2040';
        const msg = win ? 'VICTORY!' : 'GAME OVER';
        ctx.save(); ctx.textAlign = 'center';
        ctx.font = "bold 64px 'Press Start 2P', serif";
        ctx.fillStyle = col; ctx.shadowColor = glow; ctx.shadowBlur = 40;
        ctx.fillText(msg, W / 2, H / 2 - 40); ctx.shadowBlur = 0; ctx.restore();
        if (Math.sin(time * 3) > 0) {
            ctx.save(); ctx.textAlign = 'center'; ctx.font = "13px 'Press Start 2P', monospace";
            ctx.fillStyle = '#c0c0c0';
            ctx.fillText('PRESS ENTER TO RESTART', W / 2, H / 2 + 40); ctx.restore();
        }
    }

    drawPause(ctx, W, H) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.textAlign = 'center';
        ctx.font = "bold 48px 'Press Start 2P', serif";
        ctx.fillStyle = '#c0ffa0'; ctx.shadowColor = '#40ff40'; ctx.shadowBlur = 20;
        ctx.fillText('PAUSED', W / 2, H / 2); ctx.shadowBlur = 0;
        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.fillStyle = '#80c080';
        ctx.fillText('P – Resume   ·   U – Upgrades   ·   Tab – Quests', W / 2, H / 2 + 54);
        ctx.restore();
    }

    drawLevelTransition(ctx, W, H, text, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.font = "bold 32px 'Press Start 2P', monospace";
        ctx.fillStyle = '#80ff80';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#40ff40'; ctx.shadowBlur = 20;
        ctx.fillText(text, W / 2, H / 2);
        ctx.shadowBlur = 0; ctx.restore();
    }

    drawChoiceBox(ctx, W, H, selectionIdx) {
        const bw = 180, bh = 80, bx = W / 2 - bw / 2, by = H - 220;
        ctx.fillStyle = 'rgba(10,30,10,0.95)';
        ctx.strokeStyle = '#80ff80'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();

        ctx.font = "bold 12px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';

        const options = ['YES', 'NO'];
        options.forEach((opt, idx) => {
            const isSelected = idx === selectionIdx;
            ctx.fillStyle = isSelected ? '#fff' : '#60a060';
            if (isSelected) {
                ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
                ctx.fillText(`> ${opt} <`, bx + bw / 2, by + 30 + idx * 30);
                ctx.shadowBlur = 0;
            } else {
                ctx.fillText(opt, bx + bw / 2, by + 30 + idx * 30);
            }
        });
        ctx.textAlign = 'left';
    }
}
