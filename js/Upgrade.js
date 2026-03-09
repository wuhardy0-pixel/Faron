
// ─── Upgrade System – Vertical Slider Style ───────────────────────────────────
const UPGRADE_SLIDERS = [
    { id: 'maxHp', label: 'MAX\nHEALTH', min: 20, max: 60, step: 5, costPer: 6, icon: '♥' },
    { id: 'maxMp', label: 'MAX\nENERGY', min: 12, max: 36, step: 3, costPer: 5, icon: '✦' },
    { id: 'swordDmg', label: 'ATTACK', min: 5, max: 29, step: 3, costPer: 8, icon: '⚔' },
    { id: 'magicPower', label: 'MAGIC', min: 0, max: 20, step: 2, costPer: 7, icon: '★' },
    { id: 'speed', label: 'SPEED', min: 170, max: 270, step: 20, costPer: 10, icon: '▶' },
];

class UpgradeSystem {
    constructor() {
        // Current stat values tracked here (applied to player on purchase)
        this.values = {
            maxHp: 20, maxMp: 12, swordDmg: 5, magicPower: 0, speed: 170,
        };
        this.levels = { maxHp: 0, maxMp: 0, swordDmg: 0, magicPower: 0, speed: 0 };
        this.selectedIdx = 2; // default: ATTACK selected
    }

    maxSteps(id) {
        const s = UPGRADE_SLIDERS.find(u => u.id === id);
        return s ? Math.floor((s.max - s.min) / s.step) : 0;
    }

    currentValue(id, player) {
        switch (id) {
            case 'maxHp': return player.maxHp;
            case 'maxMp': return player.maxMp;
            case 'swordDmg': return player.swordDamage;
            case 'magicPower': return (player.upgrades?.firePower || 0) * 2;
            case 'speed': return player.speed | 0;
            default: return 0;
        }
    }

    purchaseSelected(player) {
        const s = UPGRADE_SLIDERS[this.selectedIdx];
        if (!s) return false;
        const lvl = this.levels[s.id] || 0;
        const maxLvl = this.maxSteps(s.id);
        if (lvl >= maxLvl) return false;
        const cost = s.costPer * (lvl + 1);
        if (player.rupees < cost) return false;

        player.rupees -= cost;
        this.levels[s.id] = lvl + 1;

        // Apply effect
        if (s.id === 'maxHp') { player.maxHp += s.step; player.hp = Math.min(player.hp + s.step, player.maxHp); }
        if (s.id === 'maxMp') { player.maxMp += s.step; player.mp = Math.min(player.mp + s.step, player.maxMp); }
        if (s.id === 'swordDmg') { player.swordDamage += s.step; }
        if (s.id === 'magicPower') { player.upgrades = player.upgrades || {}; player.upgrades.firePower = (player.upgrades.firePower || 0) + 1; }
        if (s.id === 'speed') { player.speed += s.step; }
        return true;
    }

    navigate(dir) {
        this.selectedIdx = (this.selectedIdx + dir + UPGRADE_SLIDERS.length) % UPGRADE_SLIDERS.length;
    }

    draw(ctx, W, H, player, open) {
        if (!open) return;

        // Dim the game behind it
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);

        const panelW = 120, panelH = 340;
        const totalW = UPGRADE_SLIDERS.length * (panelW + 20) - 20;
        const startX = (W - totalW) / 2;
        const panelY = (H - panelH) / 2 - 20;

        // Rupee banner
        ctx.fillStyle = 'rgba(10,25,10,0.9)';
        ctx.strokeStyle = 'rgba(80,200,80,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(W / 2 - 130, panelY - 52, 260, 38, 8); ctx.fill(); ctx.stroke();
        ctx.font = "bold 12px 'Press Start 2P', monospace";
        ctx.fillStyle = '#40ff70'; ctx.textAlign = 'center';
        ctx.shadowColor = '#40ff70'; ctx.shadowBlur = 8;
        ctx.fillText(`◆ ${player.rupees}  RUPEES`, W / 2, panelY - 27);
        ctx.shadowBlur = 0;

        for (let i = 0; i < UPGRADE_SLIDERS.length; i++) {
            const s = UPGRADE_SLIDERS[i];
            const px = startX + i * (panelW + 20);
            const selected = i === this.selectedIdx;
            const lvl = this.levels[s.id] || 0;
            const maxLvl = this.maxSteps(s.id);
            const ratio = maxLvl > 0 ? lvl / maxLvl : 0;
            const nextCost = lvl < maxLvl ? s.costPer * (lvl + 1) : null;
            const canBuy = nextCost !== null && player.rupees >= nextCost;
            const currentVal = this.currentValue(s.id, player);

            // Panel bg
            ctx.fillStyle = selected ? 'rgba(30,60,30,0.95)' : 'rgba(12,22,12,0.92)';
            ctx.strokeStyle = selected ? 'rgba(120,255,120,0.9)' : 'rgba(40,100,40,0.6)';
            ctx.lineWidth = selected ? 2.5 : 1.5;
            ctx.beginPath(); ctx.roundRect(px, panelY, panelW, panelH, 8); ctx.fill(); ctx.stroke();

            // Label (multi-line)
            ctx.font = "bold 9px 'Press Start 2P', monospace";
            ctx.fillStyle = selected ? '#e0ffe0' : '#90b890';
            ctx.textAlign = 'center';
            const lines = s.label.split('\n');
            lines.forEach((line, li) => ctx.fillText(line, px + panelW / 2, panelY + 22 + li * 14));

            // Vertical slider track
            const trackX = px + panelW / 2;
            const trackTop = panelY + 60;
            const trackBot = panelY + panelH - 60;
            const trackH = trackBot - trackTop;

            // Track bg
            ctx.strokeStyle = 'rgba(60,80,60,0.8)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(trackX, trackTop); ctx.lineTo(trackX, trackBot); ctx.stroke();

            // Track fill
            const fillH = trackH * ratio;
            ctx.strokeStyle = selected ? '#80ff80' : '#40a040'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(trackX, trackBot); ctx.lineTo(trackX, trackBot - fillH); ctx.stroke();

            // Handle
            const handleY = trackBot - fillH;
            ctx.fillStyle = selected ? '#ffffff' : '#a0c0a0';
            ctx.shadowBlur = selected ? 10 : 0; ctx.shadowColor = '#80ff80';
            ctx.fillRect(trackX - 16, handleY - 3, 32, 6);
            ctx.shadowBlur = 0;

            // Current value at bottom
            ctx.font = "bold 12px 'Press Start 2P', monospace";
            ctx.fillStyle = selected ? '#ffffff' : '#a0c0a0';
            ctx.textAlign = 'center';
            ctx.fillText(currentVal, px + panelW / 2, panelY + panelH - 28);

            // Cost
            if (nextCost !== null) {
                ctx.font = "7px 'Press Start 2P', monospace";
                ctx.fillStyle = canBuy ? '#40ff70' : '#ff6060';
                ctx.fillText(`◆${nextCost}`, px + panelW / 2, panelY + panelH - 12);
            } else {
                ctx.font = "7px 'Press Start 2P', monospace";
                ctx.fillStyle = '#60e060';
                ctx.fillText('MAXED', px + panelW / 2, panelY + panelH - 12);
            }
        }

        // Instructions
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.fillStyle = 'rgba(140,200,140,0.65)';
        ctx.textAlign = 'center';
        ctx.fillText('← → Select   ·   Enter: Buy   ·   U: Close', W / 2, panelY + panelH + 24);
        ctx.textAlign = 'left';
    }
}
