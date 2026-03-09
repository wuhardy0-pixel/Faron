
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.W = this.canvas.width;
        this.H = this.canvas.height;

        this.state = 'title'; // title, playing, paused, gameover, win
        this.keys = {};
        this.prevKeys = {};
        this.time = 0;
        this.titlePlayedFanfare = false;

        // Camera
        this.camX = 0; this.camY = 0;

        // Systems
        this.levelMgr = new LevelManager();
        this.world = null;
        this.player = null;
        this.enemies = [];
        this.boss = null;
        this.particles = new ParticleSystem();
        this.magic = new MagicSystem();
        this.quests = new QuestSystem();
        this.upgrades = new UpgradeSystem();
        this.ui = new UI();
        this.audio = new AudioManager();

        // Multiplayer
        this.mpManager = new MultiplayerManager();
        this._setupMultiplayer();

        // State flags
        this.upgradeOpen = false;
        this.questOpen = false;
        this.npcDialog = null; // { npc, lineIdx, choiceActive }
        this.selectionIdx = 0; // 0=Yes, 1=No
        this.teammateProjectiles = [];

        this._setupInput();
        this._loop(0);
    }

    _setupInput() {
        window.addEventListener('keydown', e => {
            if (this._isInputActive()) return;
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    }

    _isInputActive() {
        const active = document.activeElement;
        return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    }

    _setupMultiplayer() {
        const lobby = document.getElementById('lobby');
        const nickSection = document.getElementById('nicknameSection');
        const roomSection = document.getElementById('roomSection');
        const nickInput = document.getElementById('nicknameInput');
        const connectBtn = document.getElementById('connectBtn');
        const roomList = document.getElementById('roomList');
        const refreshBtn = document.getElementById('refreshBtn');
        const newRoomId = document.getElementById('newRoomId');
        const isPrivate = document.getElementById('isPrivate');
        const roomCode = document.getElementById('roomCode');
        const createRoomBtn = document.getElementById('createRoomBtn');
        const errorMsg = document.getElementById('errorMsg');
        const serverUrlInput = document.getElementById('serverUrlInput');

        isPrivate.addEventListener('change', () => {
            roomCode.classList.toggle('hidden', !isPrivate.checked);
        });

        connectBtn.addEventListener('click', () => {
            const nick = nickInput.value.trim();
            if (!nick) return errorMsg.textContent = 'ENTER A NICKNAME';

            const serverUrl = serverUrlInput.value.trim();

            if (!this.mpManager.isAvailable()) {
                return errorMsg.textContent = 'SERVER NOT REACHABLE (USE SINGLE PLAYER)';
            }

            this.mpManager.onConnected = () => {
                nickSection.classList.add('hidden');
                roomSection.classList.remove('hidden');
                this._refreshRooms();
            };
            this.mpManager.onError = (msg) => errorMsg.textContent = msg;
            this.mpManager.connect(nick, serverUrl || null);
        });

        refreshBtn.addEventListener('click', () => this._refreshRooms());

        createRoomBtn.addEventListener('click', () => {
            const rid = newRoomId.value.trim();
            if (!rid) return errorMsg.textContent = 'ENTER ROOM NAME';
            const code = isPrivate.checked ? roomCode.value.trim() : null;
            if (isPrivate.checked && !code) return errorMsg.textContent = 'ENTER PRIVATE CODE';

            this.mpManager.onRoomJoined = () => {
                lobby.classList.add('hidden');
                this.state = 'playing';
                this._startGame();
            };
            this.mpManager.joinRoom(rid, isPrivate.checked, code);
        });

        this.mpManager.onRoomJoined = () => {
            lobby.classList.add('hidden');
            this.state = 'playing';
            this._startGame();
        };
    }

    _refreshRooms() {
        const roomList = document.getElementById('roomList');
        const privateCode = document.getElementById('joinPrivateCode');
        this.mpManager.getPublicRooms((rooms) => {
            roomList.innerHTML = '';
            rooms.forEach(r => {
                const li = document.createElement('li');
                const privateTag = r.isPrivate ? ' <span style="color:#ff4444; font-size:8px;">(PRIVATE)</span>' : '';
                li.innerHTML = `<span>${r.id}${privateTag}</span> <span>${r.playerCount}/6</span>`;
                li.onclick = () => {
                    let code = privateCode.value.trim();
                    if (r.isPrivate && !code) {
                        code = prompt('ENTER ROOM CODE:');
                        if (code === null) return; // Cancelled
                    }
                    this.mpManager.joinRoom(r.id, r.isPrivate, code);
                };
                roomList.appendChild(li);
            });
        });
    }

    _just(code) { return this.keys[code] && !this.prevKeys[code]; }

    // ─── Start / Reset ───────────────────────────────────────────────────────────
    _startGame() {
        this.levelMgr = new LevelManager();
        this.world = buildTownWorld();
        this.player = new Player(this.world.spawnWorldX, this.world.spawnWorldY, this.mpManager.nickname);
        this.enemies = this.world.enemySpawns.map(s => new Enemy(s.type, s.wx, s.wy));
        this.boss = null;
        this.particles = new ParticleSystem();
        this.magic = new MagicSystem();
        this.quests = new QuestSystem();
        this.upgrades = new UpgradeSystem();
        this.upgradeOpen = false;
        this.questOpen = false;
        this.npcDialog = null;
        this.enemyProjectiles = [];
        this.playerSlowTimer = 0;
        this.swordSwingHits = new Set(); // tracks enemies hit in current swing
        this.camX = this.player.x - this.W / 2;
        this.camY = this.player.y - this.H / 2;
        this._clampCamera();
        this.audio.startBgMusic();
    }

    _loadLevel(id, spawnPos) {
        const builders = [buildForestWorld, buildCaveWorld, buildRuinsWorld, buildBossWorld, buildTownWorld];
        const oldTeam = this.player ? [...this.player.team] : [];
        const oldHistory = this.player ? [...this.player.history] : [];

        this.world = (builders[id] || builders[0])();
        if (spawnPos) { this.player.x = spawnPos.x; this.player.y = spawnPos.y; }
        else { this.player.x = this.world.spawnWorldX; this.player.y = this.world.spawnWorldY; }

        // Restore team state
        this.player.team = oldTeam;
        this.player.history = oldHistory;
        this.teammateProjectiles = [];

        this.enemies = this.world.enemySpawns.map(s => new Enemy(s.type, s.wx, s.wy));

        // Conditional Boss Spawn (Tanuki Lord only with 3 keys)
        const hasKeys = this.quests.quests.find(q => q.id === 'portal_key')?.progress === 3;
        if (id === LEVEL_IDS.FOREST && !hasKeys) {
            this.boss = null;
        } else {
            this.boss = this.world.bossSpawn ? new Boss(this.world.bossSpawn.type, this.world.bossSpawn.wx, this.world.bossSpawn.wy) : null;
        }

        this.magic.projectiles = []; this.magic.effects = [];
        this.enemyProjectiles = [];
        this.playerSlowTimer = 0;
        this.swordSwingHits = new Set();
        this.camX = this.player.x - this.W / 2; this.camY = this.player.y - this.H / 2;
        this._clampCamera();
        if (id === LEVEL_IDS.CAVES) this.quests.track('ruin_explorer'); // track discovery
        if (id === LEVEL_IDS.RUINS) this.quests.track('enter_ruins');
    }

    _clampCamera() {
        this.camX = Math.max(0, Math.min(this.camX, this.world.worldW() - this.W));
        this.camY = Math.max(0, Math.min(this.camY, this.world.worldH() - this.H));
    }

    // ─── Update ──────────────────────────────────────────────────────────────────
    update(dt) {
        this.time += dt;

        if (this.levelMgr.update(dt)) { /* transition done */ }

        switch (this.state) {
            case 'cutscene': {
                this._updateCutscene(dt);
                break;
            }
            case 'title': {
                if (!this.titlePlayedFanfare) { this.audio.titleFanfare(); this.titlePlayedFanfare = true; }
                if (this._just('Enter') || this._just('Space')) {
                    if (this.mpManager.isAvailable()) {
                        document.getElementById('lobby').classList.remove('hidden');
                    } else {
                        // No server – start solo immediately
                        this.state = 'playing';
                        this._startGame();
                    }
                }
                break;
            }
            case 'playing': {
                if (this._just('KeyP') || this._just('Escape')) { this.state = 'paused'; break; }
                if (!this.player) break;
                this._updatePlaying(dt);

                // Re-check for boss spawn if in forest and just got keys
                const hasKeys = this.quests.quests.find(q => q.id === 'portal_key')?.progress === 3;
                if (this.levelMgr.currentId === LEVEL_IDS.FOREST && !this.boss && hasKeys) {
                    this.boss = new Boss('raccoon', 12 * 64, 9 * 64);
                    this.boss.rising = true;
                    this.state = 'cutscene';
                }
                break;
            }
            case 'paused': {
                if (this._just('KeyP') || this._just('Escape')) { this.state = 'playing'; this.upgradeOpen = false; this.questOpen = false; }
                // Upgrade nav
                if (this.upgradeOpen) {
                    const n = UPGRADE_SLIDERS.length;
                    if (this._just('ArrowRight')) this.upgrades.selectedIdx = (this.upgrades.selectedIdx + 1) % n;
                    if (this._just('ArrowLeft')) this.upgrades.selectedIdx = (this.upgrades.selectedIdx - 1 + n) % n;
                    if (this._just('Enter')) {
                        if (this.upgrades.purchaseSelected(this.player)) {
                            this.particles.addText(this.player.x, this.player.y - 30, 'Upgraded!', '#ffe060', 16);
                            this.audio.pickup();
                        }
                    }
                    if (this._just('KeyU')) this.upgradeOpen = false;
                } else if (this.questOpen) {
                    // Collect complete quest rewards
                    if (this._just('Enter')) {
                        for (const q of this.quests.quests) {
                            if (q.status === 'complete') { this.quests.collectReward(q.id, this.player); break; }
                        }
                    }
                    if (this._just('Tab')) this.questOpen = false;
                } else {
                    if (this._just('KeyU')) { this.upgradeOpen = true; }
                    if (this._just('Tab')) { this.questOpen = true; }
                }
                break;
            }
            case 'gameover':
            case 'win': {
                if (this._just('Enter')) { this.state = 'title'; this.titlePlayedFanfare = false; this.audio.stopBgMusic(); }
                break;
            }
        }

        this.prevKeys = { ...this.keys };
    }

    _updatePlaying(dt) {
        const p = this.player;
        // Build enemy list up-front so magic spells (E) can access it immediately
        const allEnemies = [...this.enemies, ...(this.boss && this.boss.alive ? [this.boss] : [])];

        // Toggle menus (even while playing)
        if (this._just('KeyU')) { this.state = 'paused'; this.upgradeOpen = true; return; }
        if (this._just('Tab')) { this.state = 'paused'; this.questOpen = true; return; }

        // NPC dialog
        if (this.npcDialog) {
            const nd = this.npcDialog;
            const isRecruit = nd.npc.action === 'recruit';
            const isLastLine = nd.lineIdx === nd.npc.lines.length - 1;

            if (isRecruit && isLastLine) {
                if (this._just('ArrowUp') || this._just('ArrowW')) this.selectionIdx = 0;
                if (this._just('ArrowDown') || this._just('ArrowS')) this.selectionIdx = 1;

                if (this._just('Enter') || this._just('Space')) {
                    if (this.selectionIdx === 0) {
                        const alreadyIn = p.team.find(t => t.name === nd.npc.name);
                        if (!alreadyIn) {
                            p.team.push({ name: nd.npc.name, color: nd.npc.color, type: nd.npc.recruitType });
                            this.quests.track('recruit_ally');
                            this.particles.addText(p.x, p.y - 40, `${nd.npc.name} joined!`, '#ffe060', 16);
                            this.audio.pickup();
                        }
                    }
                    this.npcDialog = null;
                }
            } else {
                if (this._just('Enter') || this._just('Space')) {
                    nd.lineIdx++;
                    if (nd.lineIdx >= nd.npc.lines.length) this.npcDialog = null;
                }
            }

            p.update(dt, {}, this.world); // no movement during dialog
            this._updateCamera(dt);
            this.quests.update(dt);
            return;
        }

        // Apply ink slow debuff before player update
        const _origSpeed = p.speed;
        if (this.playerSlowTimer > 0) {
            this.playerSlowTimer = Math.max(0, this.playerSlowTimer - dt);
            p.speed = Math.round(_origSpeed * 0.45);
        }

        // Player update
        p.update(dt, this.keys, this.world);
        p.speed = _origSpeed; // restore after update

        // Push player out of impassable tile (tree/wall) if stuck
        if (!this.world.isWorldPassable(p.x, p.y, p.radius || 14)) {
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
            for (const [dx, dy] of dirs) {
                const tx = p.x + dx * 20, ty = p.y + dy * 20;
                if (this.world.isWorldPassable(tx, ty, p.radius || 14)) { p.x = tx; p.y = ty; break; }
            }
        }

        // Magic spells
        if (this._just('KeyQ') && p.mp >= 4 && p.state !== 'attack') {
            p.mp -= 4;
            this.magic.castFireball(p, this.upgrades.levels);
            this.audio.swordSwing();
        }
        if (this._just('KeyE') && p.mp >= 3 && p.state !== 'attack') {
            p.mp -= 3;
            const spinHits = this.magic.castSpin(p, this.particles, this.upgrades.levels, allEnemies);
            for (const e of spinHits) { if (!e.alive) this._onEnemyDie(e); }
            this.audio.swordSwing();
        }
        if (this._just('KeyR') && p.mp >= 6 && p.upgrades.leafStormUnlocked && p.state !== 'attack') {
            p.mp -= 6;
            this.magic.castLeafStorm(p, this.particles, this.upgrades.levels);
            this.audio.swordSwing();
        }

        // Player attack sound
        if ((this._just('Space') || this._just('KeyZ')) && p.state !== 'attack') this.audio.swordSwing();

        // Items
        if (this.world.items) {
            for (const item of this.world.items) {
                if (!item.alive) continue;
                const dist = Math.hypot(item.wx - p.x, item.wy - p.y);
                if (dist < 32) {
                    item.alive = false;
                    if (item.type === 'chest') {
                        this.quests.track(item.questEvent || '');
                        this.particles.spawnPickup(item.wx, item.wy);
                        this.audio.pickup();
                        this.particles.addText(item.wx, item.wy - 28, 'SECRET FOUND!', '#ffe060', 14);
                    } else if (item.type === 'portal_key') {
                        this.quests.track('collect_key');
                        this.particles.spawnPickup(item.wx, item.wy);
                        this.audio.pickup();
                        this.particles.addText(item.wx, item.wy - 28, 'PORTAL KEY FOUND!', '#ffe060', 14);
                    } else {
                        p.collectItem(item);
                        this.particles.spawnPickup(item.wx, item.wy);
                        if (item.type === 'heart') { this.audio.heartPickup(); this.particles.addText(item.wx, item.wy - 24, '+8 HP', '#ff80aa'); }
                        else this.audio.pickup();
                    }
                }
            }
        }

        // NPC proximity
        if (this.world.npcs) {
            for (const npc of this.world.npcs) {
                const d = Math.hypot(npc.wx - p.x, npc.wy - p.y);
                if (d < npc.talkRadius && this._just('Enter')) {
                    this.npcDialog = { npc, lineIdx: 0 };
                    this.selectionIdx = 0; // reset for new dialog
                }
            }
        }

        // Portal traversal
        if (this.world.portals && !this.levelMgr.transitioning) {
            for (const portal of this.world.portals) {
                const d = Math.hypot(portal.wx - p.x, portal.wy - p.y);
                if (d < portal.radius) {
                    if (portal.locked) {
                        if (Math.floor(this.time * 2) % 2 === 0 && !this._lastLockedHintTime || this.time - this._lastLockedHintTime > 2) {
                            const msg = portal.questId === 'portal_key' ? "Need 3 Ancient Keys..." : "It's locked...";
                            this.particles.addText(portal.wx, portal.wy - 25, msg, '#ff80a0', 12);
                            this._lastLockedHintTime = this.time;
                        }
                        break;
                    }
                    const toId = portal.toLevel, spawnWorld = portal.spawnX !== undefined
                        ? { x: portal.spawnX, y: portal.spawnY } : null;
                    this.levelMgr.requestTransition(toId, spawnWorld, (id, sp) => {
                        this._loadLevel(id, sp);
                    });
                    break;
                }
            }
        }

        // ─── Sword vs Enemies ───────────────────────────────────────
        const swordHB = p.getSwordHitbox();

        // Clear per-swing hit set when a new swing starts
        if (this._just('Space') || this._just('KeyZ') || this._just('KeyX')) {
            this.swordSwingHits = new Set();
        }
        // Also clear when no longer attacking
        if (p.state !== 'attack') this.swordSwingHits = new Set();

        for (const enemy of allEnemies) {
            if (!enemy.alive || this.swordSwingHits.has(enemy)) continue;
            if (swordHB) {
                const dist = Math.hypot(enemy.x - swordHB.x, enemy.y - swordHB.y);
                if (dist < swordHB.r + enemy.radius) {
                    this.swordSwingHits.add(enemy); // mark hit — can't be hit again this swing
                    const was = enemy.alive;
                    enemy.takeDamage(swordHB.damage, p.x, p.y);
                    this.particles.spawnHit(enemy.x, enemy.y);
                    this.audio.hit();
                    this.particles.addText(enemy.x, enemy.y - 28, `-${swordHB.damage}`, '#ff4040', 16);
                    if (!enemy.alive && was) this._onEnemyDie(enemy);
                }
            }
            enemy.update(dt, p, this.world, this.particles);
            // Collect new projectiles emitted this frame
            if (enemy.newProjectiles && enemy.newProjectiles.length) {
                this.enemyProjectiles.push(...enemy.newProjectiles);
                enemy.newProjectiles = [];
            }
        }

        // Update enemy projectiles (bamboo spears + squid ink)
        this.enemyProjectiles = this.enemyProjectiles.filter(proj => {
            proj.life -= dt;
            if (proj.type === 'bamboo_spear') {
                proj.x += proj.vx * dt; proj.y += proj.vy * dt;
                proj.dist += Math.hypot(proj.vx, proj.vy) * dt;
                if (proj.dist >= proj.maxDist || proj.life <= 0) return false;
                if (!p.dead && Math.hypot(proj.x - p.x, proj.y - p.y) < 20) {
                    p.takeDamage(proj.damage);
                    this.audio.playerHurt();
                    this.particles.addText(p.x, p.y - 30, `-${proj.damage}`, '#ff8000', 16);
                    return false;
                }
                return true;
            }
            if (proj.type === 'squid_ink') {
                if (!proj.lingering) {
                    proj.x += proj.vx * dt; proj.y += proj.vy * dt;
                    proj.dist += Math.hypot(proj.vx, proj.vy) * dt;
                    proj.radius = Math.min(proj.maxRadius, proj.radius + 45 * dt);
                    if (proj.dist >= proj.maxDist) { proj.lingering = true; proj.vx = 0; proj.vy = 0; }
                }
                if (!p.dead && Math.hypot(proj.x - p.x, proj.y - p.y) < proj.radius) {
                    if (this.playerSlowTimer <= 0.1)
                        this.particles.addText(p.x, p.y - 34, 'SLOWED!', '#8040c0', 13);
                    this.playerSlowTimer = Math.max(this.playerSlowTimer, 2.5);
                }
                return proj.life > 0;
            }
            return proj.life > 0;
        });

        // Magic hits
        const magicHits = this.magic.update(dt, allEnemies, p, this.particles);
        for (const e of magicHits) {
            if (!e.alive) this._onEnemyDie(e);
        }

        // Team Projectiles (Sophia's magic)
        if (this.player.teammateProjectiles && this.player.teammateProjectiles.length > 0) {
            this.teammateProjectiles.push(...this.player.teammateProjectiles);
            this.player.teammateProjectiles = [];
        }

        this.teammateProjectiles = this.teammateProjectiles.filter(proj => {
            proj.x += proj.vx * dt; proj.y += proj.vy * dt;
            proj.life -= dt;
            if (proj.life <= 0) return false;
            if (!this.world.isWorldPassable(proj.x, proj.y, proj.radius)) return false;

            // Hit enemies
            for (const en of allEnemies) {
                if (en.hp > 0 && Math.hypot(en.x - proj.x, en.y - proj.y) < en.radius + proj.radius) {
                    en.takeDamage(proj.damage, proj.x, proj.y);
                    if (proj.type === 'ice_bolt') en.slowTimer = 3.5;
                    this.particles.spawnHit(proj.x, proj.y);
                    if (!en.alive) this._onEnemyDie(en);
                    return false;
                }
            }

            // Hit boss
            if (this.boss && this.boss.alive && Math.hypot(this.boss.x - proj.x, this.boss.y - proj.y) < this.boss.radius + proj.radius) {
                this.boss.takeDamage(proj.damage, proj.x, proj.y);
                if (proj.type === 'ice_bolt') this.boss.slowTimer = 2.0;
                this.particles.spawnHit(proj.x, proj.y);
                return false;
            }
            return true;
        });

        // Sword breaks plant/tree tiles
        if (swordHB && p.state === 'attack') {
            const ts = this.world.tileSize;
            const tx1 = Math.floor((swordHB.x - swordHB.r) / ts);
            const tx2 = Math.floor((swordHB.x + swordHB.r) / ts);
            const ty1 = Math.floor((swordHB.y - swordHB.r) / ts);
            const ty2 = Math.floor((swordHB.y + swordHB.r) / ts);
            for (let ty = ty1; ty <= ty2; ty++) {
                for (let tx = tx1; tx <= tx2; tx++) {
                    const tile = this.world.getTile(tx, ty);
                    const breakable = tile === TILE.FLOWER || tile === TILE.TREE;
                    if (breakable && !this.world.isBroken(tx, ty)) {
                        this.world.breakTile(tx, ty);
                        this.particles.spawnHit(tx * ts + ts / 2, ty * ts + ts / 2);
                        this.audio.hit();
                    }
                }
            }
        }

        // Magic projectiles break plant/tree tiles they fly through
        for (const proj of this.magic.projectiles) {
            const ts = this.world.tileSize;
            const tx = Math.floor(proj.x / ts), ty = Math.floor(proj.y / ts);
            const tile = this.world.getTile(tx, ty);
            if ((tile === TILE.FLOWER || tile === TILE.TREE) && !this.world.isBroken(tx, ty)) {
                this.world.breakTile(tx, ty);
                this.particles.spawnHit(tx * ts + ts / 2, ty * ts + ts / 2);
            }
        }


        // Player hurt
        if (p.hurtTimer > 0.22 && p.hurtTimer < 0.25) {
            this.audio.playerHurt();
            this.particles.spawnPlayerHurt(p.x, p.y);
        }

        // Player dead
        if (p.dead && p.deathTimer > 2) { this.state = 'gameover'; this.audio.gameOver(); }

        // Win: boss dead
        if (this.boss && !this.boss.alive && this.boss.deadTimer > 2) {
            this.quests.track('boss_killed');
            this.state = 'win';
            this.audio.stopBgMusic();
        }

        // Quests
        this.world.updateBrokenTiles(dt); // regrow broken plant tiles
        this.quests.update(dt);
        this.particles.update(dt);
        this._updateCamera(dt);

        // Multiplayer Broadcast
        if (this.time - (this._lastBroadcast || 0) > 0.033) {
            this.mpManager.updateState({
                x: p.x, y: p.y, dir: p.dir, state: p.state
            });
            this._lastBroadcast = this.time;
        }
    }

    _onEnemyDie(enemy) {
        this.particles.spawnDeath(enemy.x, enemy.y, enemy.color);
        this.audio.enemyDie();
        // XP gain + level up
        const lvledUp = this.player.gainXp(enemy.xp || 10);
        if (lvledUp) {
            this.particles.addText(this.player.x, this.player.y - 50, 'LEVEL UP!', '#c0a0ff', 18);
            this.audio.pickup();
        }
        // Drop rupees occasionally
        if (Math.random() < 0.5) {
            const v = Math.random() < 0.2 ? 5 : 1;
            this.world.items = this.world.items || [];
            this.world.items.push({ type: 'rupee', wx: enemy.x, wy: enemy.y, alive: true, value: v, bobOffset: Math.random() * 6.28 });
        }
        // Quest tracking
        if (enemy.type === 'bamboo') this.quests.track('bamboo_kills');
    }

    _updateCamera(dt) {
        const tx = this.player.x - this.W / 2;
        const ty = this.player.y - this.H / 2;
        this.camX += (tx - this.camX) * 6 * dt;
        this.camY += (ty - this.camY) * 6 * dt;
        this._clampCamera();
    }

    _updateCutscene(dt) {
        if (!this.boss) { this.state = 'playing'; return; }

        // Shake screen near end
        let sx = 0, sy = 0;
        if (this.boss.risingTimer > 2.2) {
            sx = (Math.random() - 0.5) * 6;
            sy = (Math.random() - 0.5) * 6;
        }

        // Pan camera to boss
        const tx = (this.boss.x - this.W / 2) + sx;
        const ty = (this.boss.y - this.H / 2) + sy;
        this.camX += (tx - this.camX) * 3 * dt;
        this.camY += (ty - this.camY) * 3 * dt;
        this._clampCamera();

        // Spawn bubbles
        if (Math.random() < 0.4) {
            this.particles.add(this.boss.x + (Math.random() - 0.5) * 80, this.boss.y + (Math.random() - 0.5) * 40, {
                vx: 0, vy: -30 - Math.random() * 40,
                life: 0.8, color: '#80c0ff', radius: 4 + Math.random() * 6
            });
        }

        this.boss.update(dt, this.player, this.world, this.particles);
        this.particles.update(dt);

        if (!this.boss.rising) {
            this.state = 'playing';
            this.audio.hit(); // splash!
        }
    }


    // ─── Render ──────────────────────────────────────────────────────────────────
    render() {
        const { ctx, W, H } = this;
        // Fill with forest green so transparent tile edges don't show black
        ctx.fillStyle = '#2a5a14';
        ctx.fillRect(0, 0, W, H);

        if (this.state === 'title') { this.ui.drawTitle(ctx, W, H, this.time); this.prevKeys = { ...this.keys }; return; }

        if (this.world) {
            this.world.draw(ctx, this.camX, this.camY, W, H, this.time);
            this.world.drawItems(ctx, this.camX, this.camY, this.time);
        }

        // NPCs
        if (this.world?.npcs) {
            for (const npc of this.world.npcs) {
                const sx = npc.wx - this.camX, sy = npc.wy - this.camY;
                ctx.fillStyle = '#ffe060'; ctx.shadowBlur = 8; ctx.shadowColor = '#ffa020';
                ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
                ctx.fillStyle = '#2a1a0a';
                ctx.font = "bold 10px monospace"; ctx.textAlign = 'center';
                ctx.fillText('!', sx, sy + 4);
                // Proximity hint
                const d = this.player ? Math.hypot(npc.wx - this.player.x, npc.wy - this.player.y) : 9999;
                if (d < 80) {
                    ctx.font = "8px 'Press Start 2P',monospace"; ctx.fillStyle = 'rgba(220,220,100,0.9)'; ctx.textAlign = 'center';
                    ctx.fillText('[Enter] Talk', sx, sy - 24);
                }
                ctx.textAlign = 'left';
            }
        }

        // Portals
        if (this.world?.portals) {
            for (const portal of this.world.portals) {
                const sx = portal.wx - this.camX, sy = portal.wy - this.camY;
                const pulse = Math.sin(this.time * 3) * 0.3 + 0.7;

                if (portal.locked) {
                    ctx.fillStyle = `rgba(160,60,255,${pulse * 0.4})`;
                    ctx.strokeStyle = `rgba(255,0,64,${pulse * 0.9})`;
                    ctx.shadowColor = '#ff4040';
                } else {
                    ctx.fillStyle = `rgba(80,200,120,${pulse * 0.35})`;
                    ctx.strokeStyle = `rgba(80,255,140,${pulse * 0.8})`;
                    ctx.shadowColor = '#40ff80';
                }

                ctx.lineWidth = 2;
                ctx.shadowBlur = 16;
                ctx.beginPath(); ctx.arc(sx, sy, portal.radius * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0;

                const d = this.player ? Math.hypot(portal.wx - this.player.x, portal.wy - this.player.y) : 9999;
                if (d < portal.radius * 2) {
                    ctx.font = "8px 'Press Start 2P',monospace";
                    ctx.fillStyle = portal.locked ? '#ff80a0' : 'rgba(180,255,180,0.9)';
                    ctx.textAlign = 'center';
                    const lbl = portal.locked ? 'LOCKED PORTAL' : portal.label;
                    ctx.fillText(lbl, sx, sy - portal.radius - 6);
                    ctx.textAlign = 'left';
                }
            }
        }

        // Draw enemies + boss sorted by Y
        const toDraw = [...this.enemies, ...(this.boss ? [this.boss] : [])].sort((a, b) => a.y - b.y);
        for (const e of toDraw) e.draw(ctx, this.camX, this.camY, this.time);

        // Player
        if (this.player) this.player.draw(ctx, this.camX, this.camY, this.time);

        // Other Players
        for (const id in this.mpManager.players) {
            Player.drawOtherPlayer(ctx, this.mpManager.players[id], this.camX, this.camY, this.time);
        }

        // Magic effects
        this.magic.draw(ctx, this.camX, this.camY);

        // Enemy projectiles (bamboo spears + squid ink clouds)
        for (const proj of this.enemyProjectiles) {
            const sx = proj.x - this.camX, sy = proj.y - this.camY;
            if (proj.type === 'bamboo_spear') {
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(proj.angle);
                ctx.fillStyle = '#7a4a1a';
                ctx.strokeStyle = '#4a2a0a'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.roundRect(-22, -3, 44, 6, 2); ctx.fill(); ctx.stroke();
                // Spear tip
                ctx.fillStyle = '#c08040';
                ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(29, -4); ctx.lineTo(29, 4); ctx.closePath(); ctx.fill();
                ctx.restore();
            } else if (proj.type === 'squid_ink') {
                const alpha = Math.min(0.8, proj.life * 0.28) * (proj.lingering ? 0.6 : 0.85);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#2a0840';
                ctx.shadowBlur = 14; ctx.shadowColor = '#6010a0';
                ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, proj.radius), 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            }
        }

        // Teammate projectiles (Sophia)
        for (const p of this.teammateProjectiles) {
            ctx.fillStyle = p.color || '#fff';
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x - this.camX, p.y - this.camY, p.radius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Particles
        this.particles.draw(ctx, this.camX, this.camY);

        // HUD
        if (this.player && this.world) {
            this.ui.draw(ctx, this.player, this.world, W, H, this.levelMgr.name);
        }

        // Boss bar
        if (this.boss) this.boss.drawBossBar(ctx, W, H);

        // Quest notifications always visible
        this.quests.draw(ctx, W, H, this.questOpen);

        // Upgrade overlay (paused state)
        if (this.player) this.upgrades.draw(ctx, W, H, this.player, this.upgradeOpen);

        // Pause
        if (this.state === 'paused' && !this.upgradeOpen && !this.questOpen) {
            this.ui.drawPause(ctx, W, H);
        }

        // NPC dialog box
        if (this.npcDialog) {
            const nd = this.npcDialog;
            const line = nd.npc.lines[nd.lineIdx] || '';
            ctx.fillStyle = 'rgba(5,18,5,0.95)';
            ctx.strokeStyle = 'rgba(80,200,80,0.8)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(W / 2 - 300, H - 130, 600, 110, 10); ctx.fill(); ctx.stroke();
            ctx.font = "bold 10px 'Press Start 2P',monospace";
            ctx.fillStyle = '#ffe060'; ctx.textAlign = 'left';
            ctx.fillText(nd.npc.name, W / 2 - 285, H - 105);
            ctx.font = "9px 'Press Start 2P',monospace";
            ctx.fillStyle = '#c0ffc0';
            // Word wrap
            const words = line.split(' '); let row = '', dy = 0;
            for (const w of words) {
                if ((row + w).length > 55) { ctx.fillText(row, W / 2 - 285, H - 82 + dy); row = ''; dy += 18; }
                row += w + ' ';
            }
            if (row) ctx.fillText(row, W / 2 - 285, H - 82 + dy);

            // Choice box for recruiters
            if (nd.npc.action === 'recruit' && nd.lineIdx === nd.npc.lines.length - 1) {
                this.ui.drawChoiceBox(ctx, W, H, this.selectionIdx);
            } else if (Math.sin(this.time * 4) > 0) {
                ctx.fillStyle = '#80e880'; ctx.textAlign = 'right'; ctx.fillText('▼ Enter', W / 2 + 285, H - 24);
            }
            ctx.textAlign = 'left';
        }

        // Level transition fade
        if (this.levelMgr.transitioning) {
            const textMap = ['Entering Faron Forest...', 'Entering Faron Caves...', 'Entering Ancient Ruins...', '⚠ Final Chamber'];
            this.ui.drawLevelTransition(ctx, W, H, textMap[this.levelMgr.nextLevelId] || '...', this.levelMgr.transitionAlpha);
        }

        // Game over / win
        if (this.state === 'gameover') this.ui.drawGameOver(ctx, W, H, this.time, false);
        if (this.state === 'win') this.ui.drawGameOver(ctx, W, H, this.time, true);

        this.prevKeys = { ...this.keys };
    }

    _loop(ts) {
        const dt = Math.min((ts - (this._lastTs || ts)) / 1000, 0.05);
        this._lastTs = ts;
        this.update(dt);
        this.render();
        requestAnimationFrame(t => this._loop(t));
    }
}

window.addEventListener('load', () => { window._game = new Game(); });
