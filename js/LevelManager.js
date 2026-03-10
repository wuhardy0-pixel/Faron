
// ─── Level Definitions ────────────────────────────────────────────────────────
// Each level has: name, tilemap (procedural or defined), enemies, portals, secrets, boss

const LEVEL_IDS = { FOREST: 0, CAVES: 1, RUINS: 2, BOSS_CHAMBER: 3, TOWN: 4 };

class LevelManager {
    constructor() {
        this.currentId = LEVEL_IDS.TOWN;
        this.transitionAlpha = 0;
        this.transitioning = false;
        this.transitionTimer = 0;
        this.transitionDuration = 1.2;
        this.nextLevelId = null;
        this.nextSpawn = null;
        this.pendingCallback = null;
    }

    get name() {
        return ['Faron Forest', 'Faron Caves', 'Ancient Ruins', 'Final Chamber', 'Peaceful Town'][this.currentId] || 'Unknown';
    }

    requestTransition(toId, spawnPos, onComplete) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.transitionTimer = 0;
        this.nextLevelId = toId;
        this.nextSpawn = spawnPos;
        this.pendingCallback = onComplete;
    }

    update(dt) {
        if (!this.transitioning) return false;
        this.transitionTimer += dt;
        const halfway = this.transitionDuration / 2;

        if (this.transitionTimer >= halfway && this.pendingCallback) {
            this.pendingCallback(this.nextLevelId, this.nextSpawn);
            this.pendingCallback = null;
            this.currentId = this.nextLevelId;
        }

        this.transitionAlpha = this.transitionTimer < halfway
            ? (this.transitionTimer / halfway)
            : (1 - (this.transitionTimer - halfway) / halfway);

        if (this.transitionTimer >= this.transitionDuration) {
            this.transitioning = false;
            this.transitionAlpha = 0;
            return true; // done
        }
        return false;
    }
}

// ─── World extended with Level awareness ──────────────────────────────────────
// Level 0: Forest (existing)     Level 1: Caves     Level 2: Ruins     Level 3: Boss

function buildForestWorld() {
    const w = new World();
    // Add portals: stepping on these triggers level transitions
    w.portals = [
        // Waterfall cave entrance — on the left sand edge of the lake (tile 7,9 = walkable sand)
        {
            wx: 7 * w.tileSize + 32, wy: 9 * w.tileSize + 32, toLevel: LEVEL_IDS.CAVES,
            spawnX: 3 * w.tileSize + 32, spawnY: 3 * w.tileSize + 32,
            radius: 36, label: '▼ Waterfall Cave', secret: false, triggered: false
        },
        // Ruins portal (stone arch at ruins area)
        {
            wx: 31 * w.tileSize + 32, wy: 7 * w.tileSize + 32, toLevel: LEVEL_IDS.RUINS,
            spawnX: 3 * w.tileSize, spawnY: 5 * w.tileSize,
            radius: 36, label: '▼ Ancient Ruins', secret: false, triggered: false
        },
        // Town portal (near start area)
        {
            wx: 18 * w.tileSize, wy: 24 * w.tileSize, toLevel: LEVEL_IDS.TOWN,
            spawnX: 10 * w.tileSize, spawnY: 14 * w.tileSize,
            radius: 44, label: '▼ Faron Town', secret: false
        },
    ];
    // bossSpawn set by World.generate() — Tanuki Lord raccoon boss

    // NPCs
    w.npcs = [
        {
            wx: 22 * w.tileSize + 24, wy: 22 * w.tileSize + 24,
            name: 'Old Sage',
            lines: [
                'A great darkness spreads across Faron Forest...',
                'Seek the hidden cave behind the great falls.',
                'And beware the Guardian that lurks in the ruins.',
                'Defeat it, and peace shall return to the land.',
            ],
            lineIdx: 0, talkRadius: 50
        }
    ];
    return w;
}

function buildCaveWorld() {
    const ts = 64;
    const W = new World();
    W.tileSize = ts;
    W.mapW = 20; W.mapH = 16;
    // Manually create cave map
    W.map = [];
    for (let y = 0; y < W.mapH; y++) {
        W.map[y] = [];
        for (let x = 0; x < W.mapW; x++) {
            const border = x === 0 || x === W.mapW - 1 || y === 0 || y === W.mapH - 1;
            const n = W.noise(x, y);
            if (border || n > 0.75) W.map[y][x] = TILE.STONE;
            else if (n > 0.65) W.map[y][x] = TILE.WATER;
            else W.map[y][x] = TILE.PATH; // cave floor = path tile
        }
    }
    // Clear center area
    for (let y = 3; y <= 12; y++) for (let x = 2; x <= 17; x++) {
        if (W.map[y][x] === TILE.STONE && !(x < 2 || x > 17 || y < 3 || y > 12)) {
            if (W.noise(x, y, 7) < 0.6) W.map[y][x] = TILE.PATH;
        }
    }
    // Spawn + exit portal
    W.spawnWorldX = 3 * ts; W.spawnWorldY = 3 * ts;
    W.portals = [
        {
            wx: 3 * ts + 16, wy: 14 * ts, toLevel: LEVEL_IDS.FOREST,
            spawnX: 12 * ts, spawnY: 14 * ts,   // grass south of lake, NOT in water
            radius: 36, label: '▲ Exit Cave', secret: false
        },
    ];
    // Secret chest (quest trigger waterfall_chest)
    W.items = [
        {
            type: 'chest', wx: 16 * ts, wy: 7 * ts, alive: true, questEvent: 'waterfall_chest',
            bobOffset: 0, value: 0, reward: 'Quest: Hidden Treasure!'
        },
        { type: 'rupee', wx: 12 * ts, wy: 5 * ts, alive: true, value: 20, bobOffset: 1 },
        { type: 'heart', wx: 6 * ts, wy: 11 * ts, alive: true, bobOffset: 2 },
        // Hidden Portal Keys
        { type: 'portal_key', wx: 17 * ts, wy: 13 * ts, alive: true, bobOffset: 0 },
        { type: 'portal_key', wx: 2 * ts, wy: 5 * ts, alive: true, bobOffset: 1 },
        { type: 'portal_key', wx: 12 * ts, wy: 2 * ts, alive: true, bobOffset: 2 },
    ];
    W.enemySpawns = [
        { type: 'spirit', wx: 9 * ts, wy: 4 * ts },
        { type: 'spirit', wx: 15 * ts, wy: 8 * ts },
        { type: 'squid', wx: 11 * ts, wy: 11 * ts },
        { type: 'squid', wx: 14 * ts, wy: 5 * ts },
        { type: 'bamboo', wx: 5 * ts, wy: 9 * ts },
    ].map((s, idx) => ({ ...s, id: `cave_${idx}` }));
    W.npcs = [];
    W.bossSpawn = null;
    W._validateEnemySpawns();
    return W;
}

function buildRuinsWorld() {
    const ts = 64;
    const W = new World();
    W.tileSize = ts; W.mapW = 28; W.mapH = 22;
    W.map = [];
    for (let y = 0; y < W.mapH; y++) {
        W.map[y] = [];
        for (let x = 0; x < W.mapW; x++) {
            const border = x === 0 || x === W.mapW - 1 || y === 0 || y === W.mapH - 1;
            if (border) { W.map[y][x] = TILE.STONE; continue; }
            const n = W.noise(x, y, 9);
            W.map[y][x] = n > 0.78 ? TILE.STONE : n > 0.60 ? TILE.GRASS : TILE.PATH;
        }
    }
    // Corridors
    for (let x = 1; x < W.mapW - 1; x++) { W.map[10][x] = TILE.PATH; W.map[11][x] = TILE.PATH; }
    for (let y = 1; y < W.mapH - 1; y++) { W.map[y][13] = TILE.PATH; W.map[y][14] = TILE.PATH; }
    // Boss room
    for (let y = 3; y <= 8; y++) for (let x = 20; x <= 26; x++) { if (y > 0 && x < W.mapW - 1) W.map[y][x] = TILE.STONE; }
    for (let y = 4; y <= 7; y++) for (let x = 21; x <= 25; x++) W.map[y][x] = TILE.PATH;

    W.spawnWorldX = 6 * ts;   // far from portal (portal is at 2*ts)
    W.spawnWorldY = 10 * ts + ts / 2;

    W.portals = [
        { wx: 2 * ts, wy: 10 * ts, toLevel: LEVEL_IDS.FOREST, spawnX: 30 * ts, spawnY: 7 * ts, radius: 36, label: '▲ Back to Forest' },
        { wx: 23 * ts, wy: 6 * ts, toLevel: LEVEL_IDS.BOSS_CHAMBER, spawnX: 5 * ts, spawnY: 8 * ts, radius: 36, label: '▼ Boss Chamber' },
    ];
    W.items = [
        { type: 'rupee', wx: 8 * ts, wy: 5 * ts, alive: true, value: 20, bobOffset: 0 },
        { type: 'rupee', wx: 18 * ts, wy: 15 * ts, alive: true, value: 10, bobOffset: 1 },
        { type: 'heart', wx: 6 * ts, wy: 17 * ts, alive: true, bobOffset: 2 },
    ];
    W.enemySpawns = [
        { type: 'raccoon', wx: 8 * ts, wy: 5 * ts },
        { type: 'raccoon', wx: 18 * ts, wy: 15 * ts },
        { type: 'squid', wx: 6 * ts, wy: 17 * ts },
        { type: 'spirit', wx: 15 * ts, wy: 5 * ts },
        { type: 'bamboo', wx: 20 * ts, wy: 18 * ts },
        { type: 'bamboo', wx: 10 * ts, wy: 12 * ts },
    ].map((s, idx) => ({ ...s, id: `ruins_${idx}` }));
    W.npcs = [
        {
            wx: 4 * ts, wy: 8 * ts, name: 'Ruins Ghost',
            lines: ['You have entered the Ancient Ruins...', 'The Forest Guardian awaits beyond the stone door.', 'Beware its fury when weakened – it grows stronger!'],
            lineIdx: 0, talkRadius: 55
        }
    ];
    W.bossSpawn = null;
    W._validateEnemySpawns();
    return W;
}

function buildBossWorld() {
    const ts = 64;
    const W = new World();
    W.tileSize = ts; W.mapW = 14; W.mapH = 12;
    W.map = [];
    for (let y = 0; y < W.mapH; y++) {
        W.map[y] = [];
        for (let x = 0; x < W.mapW; x++) {
            const border = x === 0 || x === W.mapW - 1 || y === 0 || y === W.mapH - 1;
            W.map[y][x] = border ? TILE.STONE : TILE.PATH;
        }
    }
    // Stone pillars
    [[3, 3], [3, 8], [10, 3], [10, 8]].forEach(([x, y]) => { W.map[y][x] = TILE.STONE; W.map[y][x + 1] = TILE.STONE; });
    W.spawnWorldX = 3 * ts; W.spawnWorldY = 9 * ts;
    W.portals = [
        { wx: 3 * ts, wy: 10 * ts, toLevel: LEVEL_IDS.RUINS, spawnX: 23 * ts, spawnY: 5 * ts, radius: 40, label: '▲ Retreat' },
    ];
    W.items = [
        { type: 'heart', wx: 7 * ts, wy: 10 * ts, alive: true, bobOffset: 0 },
        { type: 'heart', wx: 11 * ts, wy: 10 * ts, alive: true, bobOffset: 1 },
    ];
    W.enemySpawns = [];
    W.bossSpawn = { id: 'boss_forest', type: 'forest_guardian', wx: 7 * ts, wy: 4 * ts };
    W.npcs = [];
    return W;
}
function buildTownWorld() {
    const ts = 64;
    const W = new World();
    W.tileSize = ts; W.mapW = 20; W.mapH = 18;
    W.map = [];
    for (let y = 0; y < W.mapH; y++) {
        W.map[y] = [];
        for (let x = 0; x < W.mapW; x++) {
            const border = x === 0 || x === W.mapW - 1 || y === 0 || y === W.mapH - 1;
            const n = W.noise(x, y, 12);
            if (border) W.map[y][x] = TILE.TREE;
            else if (n > 0.8) W.map[y][x] = TILE.STONE;
            else if (n > 0.65) W.map[y][x] = TILE.PATH;
            else W.map[y][x] = TILE.GRASS;
        }
    }
    // Town Square
    for (let y = 8; y <= 11; y++) for (let x = 8; x <= 11; x++) W.map[y][x] = TILE.PATH;

    W.spawnWorldX = 10 * ts; W.spawnWorldY = 14 * ts;
    W.portals = [
        { wx: 10 * ts, wy: 17 * ts, toLevel: LEVEL_IDS.FOREST, spawnX: 18 * ts, spawnY: 23 * ts, radius: 44, label: '▲ To Forest' },
        // Locked Portal in town center
        { wx: 10 * ts, wy: 9.5 * ts, toLevel: LEVEL_IDS.RUINS, spawnX: 3 * ts, spawnY: 5 * ts, radius: 40, label: '??? (Locked)', locked: true, questId: 'portal_key' },
    ];
    W.items = [
        { type: 'heart', wx: 4 * ts, wy: 4 * ts, alive: true, bobOffset: 0 },
        { type: 'rupee', wx: 16 * ts, wy: 4 * ts, alive: true, value: 5, bobOffset: 1 },
    ];
    W.enemySpawns = []; // No monsters in town!
    W.npcs = [
        {
            wx: 10 * ts, wy: 12 * ts, name: 'Town Mayor',
            lines: [
                'Welcome to our peaceful village.',
                'A strange portal appeared in our square, but it is sealed tight.',
                'The Sage says the keys were lost in the cavern under the waterfall.',
                'Find the 3 Ancient Keys hidden there, then I can help you.',
            ],
            lineIdx: 0, talkRadius: 60
        },
        {
            wx: 16 * ts, wy: 11 * ts, name: 'Shopkeeper Sarah',
            lines: [
                'Fresh bread! Oh, traveler...',
                'The Waterfall Cave is dangerous. Ghosts and spirits haunt those halls.',
                'I heard a merchant dropped something shiny near the back of the cave.',
            ],
            lineIdx: 0, talkRadius: 50
        },
        {
            wx: 4 * ts, wy: 14 * ts, name: 'Guard Greg',
            lines: [
                'Keep the peace, stranger.',
                'The Forest to the south is crawling with monsters lately.',
                'If you\'re looking for the waterfall, it\'s deep in the northern woods.',
            ],
            lineIdx: 0, talkRadius: 50
        },
        {
            wx: 6 * ts, wy: 8 * ts, name: 'Brave Hardy',
            lines: [
                'I want to help defend the forest!',
                'Choose me and I shall follow you to the end.',
                'Will you take me on your team? (Talk again to recruit)'
            ],
            action: 'recruit', recruitType: 'warrior', color: '#ff4444',
            lineIdx: 0, talkRadius: 50
        },
        {
            wx: 14 * ts, wy: 8 * ts, name: 'Swift Sophia',
            lines: [
                'My magic is yours if you need it.',
                'The forest is dangerous, you should not go alone.',
                'Shall I join your journey? (Talk again to recruit)'
            ],
            action: 'recruit', recruitType: 'mage', color: '#4444ff',
            lineIdx: 0, talkRadius: 50
        }
    ];
    return W;
}
