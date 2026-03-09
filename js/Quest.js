
// ─── Quest System ─────────────────────────────────────────────────────────────
class QuestSystem {
    constructor() {
        this.quests = [
            {
                id: 'forest_bane',
                title: "Forest's Bane",
                desc: 'Defeat 6 Bamboo Enemies lurking in Faron Forest.',
                hint: 'The bamboo creatures cluster near the southern paths.',
                track: 'bamboo_kills', goal: 6, progress: 0,
                status: 'active', // active, complete, collected
                reward: { type: 'maxHp', amount: 4, display: '+4 Max HP' },
            },
            {
                id: 'hidden_treasure',
                title: 'Hidden Treasure',
                desc: 'Find the ancient chest hidden behind the great waterfall.',
                hint: 'They say a brave adventurer once stepped through falling water...',
                track: 'waterfall_chest', goal: 1, progress: 0,
                status: 'active',
                reward: { type: 'firePower', amount: 1, display: 'Fireball Power Up' },
            },
            {
                id: 'guardian_slain',
                title: 'Guardian Slain',
                desc: 'Slay the Forest Guardian and free Faron from its curse.',
                hint: 'A great evil stirs in the ruins at the forest\'s edge...',
                track: 'boss_killed', goal: 1, progress: 0,
                status: 'active',
                reward: { type: 'unlockLeafStorm', display: 'Leaf Storm (R) Unlocked!' },
            },
            {
                id: 'ruin_explorer',
                title: 'Ruin Explorer',
                desc: 'Reach the Ancient Ruins in the depths of the forest.',
                hint: 'A secret passage lies beyond the forest\'s center.',
                track: 'enter_ruins', goal: 1, progress: 0,
                status: 'active',
                reward: { type: 'maxMp', amount: 3, display: '+3 Max MP' },
            },
            {
                id: 'town_choice',
                title: 'A New Ally',
                desc: 'Recruit a teammate from Faron Town to help your journey.',
                hint: 'Hardy and Sophia are waiting in the village square.',
                track: 'recruit_ally', goal: 1, progress: 0,
                status: 'active',
                reward: { type: 'teammate_stats', display: 'Team Morale Boost!' },
            },
            {
                id: 'portal_key',
                title: 'Ancient Keys',
                desc: 'Find the 3 Ancient Keys hidden in the Waterfall Caves.',
                hint: 'Look behind the waterfall in the northern woods for the cave entrance.',
                track: 'collect_key', goal: 3, progress: 0,
                status: 'active',
                reward: { type: 'unlock_portal', display: 'Town Portal Unlocked!' },
            },
        ];

        this.log = []; // Messages shown in quest log
        this.notifications = []; // Popup notifications
    }

    track(eventType, amount = 1) {
        let updated = false;
        for (const q of this.quests) {
            if (q.status !== 'active') continue;
            if (q.track === eventType) {
                q.progress = Math.min(q.goal, q.progress + amount);
                if (q.progress >= q.goal && q.status === 'active') {
                    q.status = 'complete';
                    this.notify(`Quest Complete: ${q.title}!`, '#ffe060');
                    updated = true;
                }
            }
        }
        return updated;
    }

    collectReward(questId, player) {
        const q = this.quests.find(q => q.id === questId && q.status === 'complete');
        if (!q) return false;
        q.status = 'collected';
        const r = q.reward;
        if (r.type === 'maxHp') { player.maxHp += r.amount; player.hp = Math.min(player.hp + r.amount, player.maxHp); }
        if (r.type === 'firePower') { player.upgrades.firePower = (player.upgrades.firePower || 0) + r.amount; }
        if (r.type === 'maxMp') { player.maxMp += r.amount; player.mp = Math.min(player.mp + r.amount, player.maxMp); }
        if (r.type === 'unlockLeafStorm') { player.upgrades.leafStormUnlocked = true; }
        if (r.type === 'unlock_portal') {
            this.notify('Town Portal is now open!', '#44ff44');
            // Logic to unlock portal in current world if in Town
            if (window._game && window._game.world) {
                const p = window._game.world.portals.find(p => p.questId === 'portal_key');
                if (p) { p.locked = false; p.label = '▼ Ancient Ruins'; }
            }
        }
        this.notify(`Reward: ${r.display}`, '#80ff80');
        return true;
    }

    notify(msg, color = '#fff') {
        this.notifications.push({ msg, color, life: 3.5, maxLife: 3.5 });
    }

    update(dt) {
        for (let i = this.notifications.length - 1; i >= 0; i--) {
            this.notifications[i].life -= dt;
            if (this.notifications[i].life <= 0) this.notifications.splice(i, 1);
        }
    }

    draw(ctx, W, H, open) {
        // Quest notifications (top center, stacked)
        ctx.save();
        let ny = 80;
        for (const n of this.notifications) {
            const alpha = Math.min(1, n.life / n.maxLife * 3);
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle = 'rgba(10,30,10,0.9)';
            ctx.strokeStyle = n.color;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(W / 2 - 220, ny, 440, 32, 8); ctx.fill(); ctx.stroke();
            ctx.font = "11px 'Press Start 2P', monospace";
            ctx.fillStyle = n.color;
            ctx.textAlign = 'center';
            ctx.shadowColor = n.color; ctx.shadowBlur = 8;
            ctx.fillText(n.msg, W / 2, ny + 22);
            ctx.shadowBlur = 0;
            ny += 40;
        }
        ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.restore();

        if (!open) return;

        // Quest Log overlay
        ctx.save();
        ctx.fillStyle = 'rgba(5,18,5,0.94)';
        ctx.strokeStyle = 'rgba(60,180,60,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(W / 2 - 300, H / 2 - 240, 600, 480, 14); ctx.fill(); ctx.stroke();

        ctx.font = "bold 14px 'Press Start 2P', monospace";
        ctx.fillStyle = '#80ff80';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#40ff40'; ctx.shadowBlur = 10;
        ctx.fillText('QUEST LOG', W / 2, H / 2 - 210);
        ctx.shadowBlur = 0;

        let qy = H / 2 - 175;
        for (const q of this.quests) {
            const col = q.status === 'collected' ? '#606060' : q.status === 'complete' ? '#ffe060' : '#c0ffc0';
            ctx.fillStyle = 'rgba(20,50,20,0.7)';
            ctx.beginPath(); ctx.roundRect(W / 2 - 280, qy, 560, 90, 8); ctx.fill();

            ctx.font = "bold 10px 'Press Start 2P', monospace";
            ctx.fillStyle = col;
            ctx.textAlign = 'left';
            const icon = q.status === 'collected' ? '✓' : q.status === 'complete' ? '★' : '◆';
            ctx.fillText(`${icon} ${q.title}`, W / 2 - 265, qy + 20);

            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.fillStyle = 'rgba(180,220,180,0.85)';
            ctx.fillText(q.desc, W / 2 - 265, qy + 38);

            // Progress bar
            const barW = 300;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(W / 2 - 265, qy + 54, barW, 10);
            ctx.fillStyle = col;
            ctx.fillRect(W / 2 - 265, qy + 54, barW * Math.min(1, q.progress / q.goal), 10);

            ctx.font = "8px 'Press Start 2P', monospace";
            ctx.fillStyle = '#a0c0a0';
            ctx.textAlign = 'right';
            ctx.fillText(`${q.progress}/${q.goal}`, W / 2 + 280, qy + 63);

            if (q.status === 'complete') {
                ctx.fillStyle = '#ffe060'; ctx.textAlign = 'center';
                ctx.font = "8px 'Press Start 2P', monospace";
                ctx.fillText(`REWARD: ${q.reward.display}  (Enter to collect)`, W / 2, qy + 80);
            }

            qy += 100;
        }

        ctx.font = "9px 'Press Start 2P', monospace";
        ctx.fillStyle = 'rgba(120,180,120,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('TAB to close', W / 2, H / 2 + 215);
        ctx.restore();
    }
}
