
// Asset base path (relative to the Faron/ folder → go back to the 1/ folder)
const ASSET_BASE = '../1';

// Tile constants
const TILE = { GRASS: 0, TREE: 1, WATER: 2, PATH: 3, STONE: 4, FLOWER: 5, SAND: 6 };
const TILE_PASSABLE = new Set([TILE.GRASS, TILE.PATH, TILE.FLOWER, TILE.SAND]);

class World {
    constructor() {
        this.tileSize = 64;
        this.mapW = 40;
        this.mapH = 30;
        this.items = [];
        this.enemySpawns = [];
        this.grassImages = [];
        this.objectImages = [];
        this.floorImg = null;
        this.detailsImg = null;
        this.groundImg = null;
        this.assetsLoaded = 0;
        this.totalAssets = 0;
        this.map = this.generate();
        this._loadImages();
        this.brokenTiles = new Map(); // must init before _validateEnemySpawns (isPassable calls isBroken)
        this._validateEnemySpawns();
    }

    _loadImg(src) {
        this.totalAssets++;
        const img = new Image();
        img.onload = () => this.assetsLoaded++;
        img.onerror = () => this.assetsLoaded++;
        img.src = src;
        return img;
    }

    _loadImages() {
        // Grass tiles
        for (let i = 1; i <= 3; i++) {
            this.grassImages.push(this._loadImg(`${ASSET_BASE}/graphics/grass/grass_${i}.png`));
        }
        // Object tiles (scattered trees/rocks)
        for (let i = 0; i <= 20; i++) {
            this.objectImages.push(this._loadImg(`${ASSET_BASE}/graphics/objects/${i < 10 ? '0' + i : i}.png`));
        }
        this.floorImg = this._loadImg(`${ASSET_BASE}/graphics/tilemap/Floor.png`);
        this.detailsImg = this._loadImg(`${ASSET_BASE}/graphics/tilemap/details.png`);
        this.groundImg = this._loadImg(`${ASSET_BASE}/graphics/tilemap/ground.png`);
    }

    _validateEnemySpawns() {
        const offsets = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1],
        [0, -2], [2, 0], [0, 2], [-2, 0], [2, -2], [-2, 2]];
        for (const s of this.enemySpawns) {
            const ts = this.tileSize;
            let tx = Math.floor(s.wx / ts), ty = Math.floor(s.wy / ts);
            if (!this.isPassable(tx, ty)) {
                for (const [ox, oy] of offsets) {
                    if (this.isPassable(tx + ox, ty + oy)) {
                        s.wx = (tx + ox) * ts + ts / 2;
                        s.wy = (ty + oy) * ts + ts / 2;
                        break;
                    }
                }
            }
        }
    }

    breakTile(tx, ty) {
        this.brokenTiles.set(`${tx},${ty}`, 50);
    }

    isBroken(tx, ty) {
        return this.brokenTiles.has(`${tx},${ty}`);
    }

    updateBrokenTiles(dt) {
        for (const [key, t] of this.brokenTiles) {
            const remaining = t - dt;
            if (remaining <= 0) this.brokenTiles.delete(key);
            else this.brokenTiles.set(key, remaining);
        }
    }

    noise(x, y, s = 1) {
        const n = Math.sin(x * 127.1 + y * 311.7 + s * 53.3) * 43758.5453;
        return n - Math.floor(n);
    }

    generate() {
        const W = this.mapW, H = this.mapH;
        const map = [];
        for (let y = 0; y < H; y++) {
            map[y] = [];
            for (let x = 0; x < W; x++) {
                if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
                    map[y][x] = TILE.TREE;
                } else {
                    const n = this.noise(x, y);
                    if (n > 0.72) map[y][x] = TILE.TREE;
                    else if (n > 0.65) map[y][x] = TILE.FLOWER;
                    else map[y][x] = TILE.GRASS;
                }
            }
        }

        // Player spawn area — large clearing so player is never trapped
        const spawnTX = Math.floor(W / 2);
        const spawnTY = Math.floor(H * 0.72);
        for (let y = spawnTY - 7; y <= spawnTY + 5; y++) {
            for (let x = spawnTX - 9; x <= spawnTX + 9; x++) {
                if (y > 0 && y < H - 1 && x > 0 && x < W - 1) map[y][x] = TILE.GRASS;
            }
        }
        // Corridor from clearing to the right (toward the winding path)
        for (let y = spawnTY - 1; y <= spawnTY + 1; y++) {
            for (let x = spawnTX + 9; x <= spawnTX + 14; x++) {
                if (y > 0 && y < H - 1 && x > 0 && x < W - 1) map[y][x] = TILE.GRASS;
            }
        }
        // Corridor from clearing to the left
        for (let y = spawnTY - 1; y <= spawnTY + 1; y++) {
            for (let x = spawnTX - 14; x <= spawnTX - 9; x++) {
                if (y > 0 && y < H - 1 && x > 0 && x < W - 1) map[y][x] = TILE.GRASS;
            }
        }
        this.spawnWorldX = spawnTX * this.tileSize + this.tileSize / 2;
        this.spawnWorldY = spawnTY * this.tileSize + this.tileSize / 2;


        // Winding N-S path
        for (let y = 1; y < H - 1; y++) {
            const px = Math.floor(spawnTX + Math.sin(y * 0.38) * 4);
            const cl = Math.max(2, Math.min(W - 3, px));
            map[y][cl] = TILE.PATH;
            map[y][cl + 1] = TILE.PATH;
        }

        // Lake
        const lkX = 8, lkY = 6;
        for (let y = lkY; y <= lkY + 5; y++) {
            for (let x = lkX; x <= lkX + 7; x++) {
                if (this._inBounds(x, y, W, H)) map[y][x] = TILE.WATER;
            }
        }
        for (let y = lkY - 1; y <= lkY + 6; y++) {
            for (let x = lkX - 1; x <= lkX + 8; x++) {
                if (this._inBounds(x, y, W, H) && map[y][x] !== TILE.WATER) map[y][x] = TILE.SAND;
            }
        }

        // Stone ruins (upper-right)
        const layout = [
            [1, 1, 0, 1, 1], [1, 0, 0, 0, 1], [0, 0, 3, 0, 0], [1, 0, 0, 0, 1], [1, 1, 0, 1, 1],
        ];
        const rX = 28, rY = 5;
        for (let ry = 0; ry < 5; ry++) {
            for (let rx = 0; rx < 5; rx++) {
                const mx = rX + rx, my = rY + ry;
                if (this._inBounds(mx, my, W, H)) {
                    map[my][mx] = layout[ry][rx] === 1 ? TILE.STONE : layout[ry][rx] === 3 ? TILE.PATH : TILE.GRASS;
                }
            }
        }

        // Small clearing mid-left
        for (let y = 14; y <= 18; y++) {
            for (let x = 4; x <= 10; x++) {
                if (this._inBounds(x, y, W, H)) map[y][x] = TILE.GRASS;
            }
        }

        // Items
        this.items = [
            { x: 11, y: 8, type: 'rupee', value: 5 },
            { x: 33, y: 7, type: 'heart' },
            { x: 7, y: 16, type: 'rupee', value: 1 },
            { x: 20, y: 12, type: 'rupee', value: 5 },
            { x: 31, y: 12, type: 'rupee', value: 20 },
            { x: 5, y: 22, type: 'heart' },
            { x: 36, y: 22, type: 'rupee', value: 1 },
            { x: 25, y: 20, type: 'rupee', value: 5 },
            { x: 15, y: 5, type: 'rupee', value: 1 },
            { x: 38, y: 15, type: 'heart' },
        ].map(i => ({
            ...i,
            wx: i.x * this.tileSize + this.tileSize / 2,
            wy: i.y * this.tileSize + this.tileSize / 2,
            alive: true,
            bobOffset: Math.random() * Math.PI * 2,
        }));

        // Enemy spawns — raccoon is now boss-only, removed here
        this.enemySpawns = [
            { tx: 7, ty: 9, type: 'bamboo' },
            { tx: 13, ty: 13, type: 'bamboo' },
            { tx: 25, ty: 9, type: 'spirit' },
            { tx: 30, ty: 18, type: 'bamboo' },
            { tx: 14, ty: 20, type: 'spirit' },
            { tx: 5, ty: 19, type: 'bamboo' },
            { tx: 37, ty: 25, type: 'bamboo' },
            { tx: 18, ty: 5, type: 'spirit' },
            { tx: 4, ty: 5, type: 'bamboo' },
            { tx: 22, ty: 22, type: 'bamboo' },
            { tx: 9, ty: 24, type: 'spirit' },
            { tx: 30, ty: 5, type: 'squid' },
            { tx: 35, ty: 14, type: 'squid' },
            { tx: 6, ty: 15, type: 'squid' },
            { tx: 26, ty: 24, type: 'squid' },
            { tx: 16, ty: 10, type: 'squid' },
            { tx: 38, ty: 20, type: 'squid' },
        ].map(s => ({
            ...s,
            wx: s.tx * this.tileSize + this.tileSize / 2,
            wy: s.ty * this.tileSize + this.tileSize / 2,
        }));

        // Boss spawn: Tanuki Lord rises from the lake (tiles 8-15, 6-11 → center ~12,9)
        this.bossSpawn = { type: 'raccoon', wx: 12 * this.tileSize, wy: 9 * this.tileSize };


        return map;
    }

    _inBounds(x, y, W, H) { return x > 0 && x < W - 1 && y > 0 && y < H - 1; }

    getTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.mapW || ty >= this.mapH) return TILE.TREE;
        return this.map[ty][tx];
    }

    isPassable(tx, ty) {
        const tile = this.getTile(tx, ty);
        if (tile === TILE.TREE && this.isBroken(tx, ty)) return true;
        return TILE_PASSABLE.has(tile);
    }

    isWorldPassable(wx, wy, r = 14) {
        const ts = this.tileSize;
        return (
            this.isPassable(Math.floor((wx - r) / ts), Math.floor((wy - r) / ts)) &&
            this.isPassable(Math.floor((wx + r) / ts), Math.floor((wy - r) / ts)) &&
            this.isPassable(Math.floor((wx - r) / ts), Math.floor((wy + r) / ts)) &&
            this.isPassable(Math.floor((wx + r) / ts), Math.floor((wy + r) / ts))
        );
    }

    worldW() { return this.mapW * this.tileSize; }
    worldH() { return this.mapH * this.tileSize; }

    draw(ctx, camX, camY, viewW, viewH, time) {
        const ts = this.tileSize;
        const sx = Math.max(0, Math.floor(camX / ts) - 1);
        const sy = Math.max(0, Math.floor(camY / ts) - 1);
        const ex = Math.min(this.mapW, Math.ceil((camX + viewW) / ts) + 1);
        const ey = Math.min(this.mapH, Math.ceil((camY + viewH) / ts) + 1);
        for (let ty = sy; ty < ey; ty++) {
            for (let tx = sx; tx < ex; tx++) {
                const px = Math.floor(tx * ts - camX);
                const py = Math.floor(ty * ts - camY);
                this._drawTile(ctx, this.map[ty][tx], px, py, ts + 1, tx, ty, time);
            }
        }
    }

    _drawTile(ctx, type, sx, sy, ts, tx, ty, time) {
        switch (type) {
            case TILE.GRASS: {
                // Try to draw real grass image; fallback to color
                const v = this.noise(tx, ty, 2);
                const img = this.grassImages[(this.noise(tx, ty, 6) * 3) | 0];
                if (img && img.complete && img.naturalWidth) {
                    ctx.drawImage(img, sx, sy, ts, ts);
                } else {
                    ctx.fillStyle = `rgb(${(30 + v * 20) | 0},${(95 + v * 35) | 0},${(22 + v * 18) | 0})`;
                    ctx.fillRect(sx, sy, ts, ts);
                }
                break;
            }
            case TILE.TREE: {
                // Ground fill under tree
                const v2 = this.noise(tx, ty, 8);
                ctx.fillStyle = `rgb(${(38 + v2 * 14) | 0},${(90 + v2 * 30) | 0},${(28 + v2 * 12) | 0})`;
                ctx.fillRect(sx, sy, ts + 1, ts + 1);
                if (this.isBroken(tx, ty)) {
                    // Show stump / bare ground when chopped down
                    const rem = this.brokenTiles.get(`${tx},${ty}`) || 0;
                    if (rem < 10) {
                        const gAlpha = (1 - rem / 10) * 0.35 * (Math.sin(time * 4) * 0.5 + 0.5);
                        ctx.fillStyle = `rgba(60,200,60,${gAlpha})`;
                        ctx.fillRect(sx + 20, sy + 20, ts - 40, ts - 40);
                    }
                    break;
                }
                // Use a real object image if loaded
                const objIdx = ((tx * 7 + ty * 13) % 12) + 1;
                const objImg = this.objectImages[objIdx];
                if (objImg && objImg.complete && objImg.naturalWidth > 0) {
                    ctx.drawImage(objImg, sx, sy, ts + 1, ts + 1);
                } else {
                    // Fallback: drawn canopy
                    const cx2 = sx + ts / 2, cy2 = sy + ts / 2;
                    const grad = ctx.createRadialGradient(cx2 - 5, cy2 - 8, 3, cx2, cy2 - 2, ts / 2);
                    grad.addColorStop(0, '#5aaa2a');
                    grad.addColorStop(0.5, '#2d7a14');
                    grad.addColorStop(1, '#164a09');
                    ctx.fillStyle = grad;
                    ctx.beginPath(); ctx.arc(cx2, cy2 - 4, ts / 2 - 2, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case TILE.WATER: {
                const wave = Math.sin(time * 1.8 + tx * 0.9 + ty * 0.6) * 0.2;
                ctx.fillStyle = `rgb(${(14 + wave * 15) | 0},${(70 + wave * 25) | 0},${(185 + wave * 30) | 0})`;
                ctx.fillRect(sx, sy, ts, ts);
                ctx.strokeStyle = `rgba(140,210,255,${0.25 + Math.abs(wave) * 0.5})`;
                ctx.lineWidth = 1.5;
                const wy2 = sy + ts / 2 + Math.sin(time * 1.4 + tx * 1.3) * 5;
                ctx.beginPath();
                ctx.moveTo(sx + 5, wy2);
                ctx.quadraticCurveTo(sx + ts / 3, wy2 - 6, sx + ts * 2 / 3, wy2);
                ctx.quadraticCurveTo(sx + ts - 5, wy2 + 6, sx + ts - 5, wy2);
                ctx.stroke();
                break;
            }
            case TILE.PATH: {
                const n = this.noise(tx, ty, 3);
                ctx.fillStyle = `rgb(${(162 + n * 22) | 0},${(112 + n * 18) | 0},${(52 + n * 12) | 0})`;
                ctx.fillRect(sx, sy, ts, ts);
                if (n > 0.45) {
                    ctx.fillStyle = 'rgba(120,90,40,0.35)';
                    ctx.beginPath(); ctx.arc(sx + n * (ts - 10) + 5, sy + (1 - n) * (ts - 10) + 5, 3, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case TILE.STONE: {
                const n = this.noise(tx, ty, 4);
                ctx.fillStyle = `rgb(${(105 + n * 35) | 0},${(105 + n * 35) | 0},${(112 + n * 30) | 0})`;
                ctx.fillRect(sx, sy, ts, ts);
                ctx.strokeStyle = 'rgba(50,50,60,0.45)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(sx + 10, sy + 14); ctx.lineTo(sx + 34, sy + 24); ctx.lineTo(sx + 28, sy + 40); ctx.stroke();
                if (n > 0.5) {
                    ctx.fillStyle = 'rgba(50,110,35,0.22)'; ctx.beginPath(); ctx.arc(sx + 10, sy + 10, 8, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case TILE.FLOWER: {
                const v = this.noise(tx, ty, 2);
                const img = this.grassImages[(this.noise(tx, ty, 6) * 3) | 0];
                if (this.isBroken(tx, ty)) {
                    // Draw bare grass — plant is cut down
                    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, sx, sy, ts + 1, ts + 1);
                    else { ctx.fillStyle = `rgb(${(30 + v * 20) | 0},${(95 + v * 35) | 0},${(22 + v * 18) | 0})`; ctx.fillRect(sx, sy, ts + 1, ts + 1); }
                    // Faint green sprout glow in last 10s before regrow
                    const rem = this.brokenTiles.get(`${tx},${ty}`) || 0;
                    if (rem < 10) {
                        const gAlpha = (1 - rem / 10) * 0.35 * (Math.sin(time * 4) * 0.5 + 0.5);
                        ctx.fillStyle = `rgba(60,200,60,${gAlpha})`;
                        ctx.fillRect(sx + 20, sy + 20, ts - 40, ts - 40);
                    }
                    break;
                }
                if (img && img.complete && img.naturalWidth) ctx.drawImage(img, sx, sy, ts + 1, ts + 1);
                else { ctx.fillStyle = `rgb(${(30 + v * 20) | 0},${(95 + v * 35) | 0},${(22 + v * 18) | 0})`; ctx.fillRect(sx, sy, ts + 1, ts + 1); }
                const cols = ['#ff8090', '#ffee50', '#cc80ff', '#80eeff'];
                for (let i = 0; i < 3; i++) {
                    const fx = sx + this.noise(tx * 5 + i, ty * 7, 9) * (ts - 12) + 6;
                    const fy = sy + this.noise(tx * 7 + i, ty * 5, 11) * (ts - 12) + 6;
                    const fc = cols[(this.noise(tx + i, ty + i, 13) * 4) | 0];
                    ctx.strokeStyle = '#2a6010'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(fx, fy + 8); ctx.lineTo(fx, fy); ctx.stroke();
                    ctx.fillStyle = fc; ctx.beginPath(); ctx.arc(fx, fy, 5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,200,0.9)'; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
                }
                break;
            }
            case TILE.SAND: {
                const n = this.noise(tx, ty, 5);
                ctx.fillStyle = `rgb(${(215 + n * 22) | 0},${(185 + n * 18) | 0},${(115 + n * 22) | 0})`;
                ctx.fillRect(sx, sy, ts, ts);
                break;
            }
            default:
                ctx.fillStyle = '#1a3d1a'; ctx.fillRect(sx, sy, ts, ts);
        }
    }

    drawItems(ctx, camX, camY, time) {
        for (const item of this.items) {
            if (!item.alive) continue;
            const sx = item.wx - camX;
            const sy = item.wy - camY + Math.sin(time * 2.5 + item.bobOffset) * 4;
            if (sx < -30 || sy < -30 || sx > 1600 || sy > 900) continue;
            if (item.type === 'heart') {
                ctx.save();
                ctx.translate(sx, sy);
                ctx.shadowBlur = 16; ctx.shadowColor = '#ff4488';
                ctx.fillStyle = '#ff3377';
                this._drawHeart(ctx, 0, 0, 13);
                ctx.shadowBlur = 0;
                ctx.restore();
            } else if (item.type === 'portal_key') {
                ctx.save(); ctx.translate(sx, sy);
                ctx.shadowBlur = 20; ctx.shadowColor = '#ffe060';
                ctx.fillStyle = '#ffe060';
                ctx.strokeStyle = '#e08020'; ctx.lineWidth = 2;
                // Key head
                ctx.beginPath(); ctx.arc(0, -8, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                // Key shaft
                ctx.fillRect(-2, -2, 4, 16); ctx.strokeRect(-2, -2, 4, 16);
                // Key teeth
                ctx.fillRect(2, 6, 6, 3); ctx.fillRect(2, 11, 6, 3);
                ctx.shadowBlur = 0; ctx.restore();
            } else {
                const color = item.value === 1 ? '#40ff60' : item.value === 5 ? '#4080ff' : '#ff4040';
                ctx.save(); ctx.translate(sx, sy);
                ctx.shadowBlur = 14; ctx.shadowColor = color;
                ctx.fillStyle = color;
                ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, -14); ctx.lineTo(8, -5); ctx.lineTo(8, 5); ctx.lineTo(0, 14); ctx.lineTo(-8, 5); ctx.lineTo(-8, -5); ctx.closePath();
                ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0; ctx.restore();
            }
        }
    }

    _drawHeart(ctx, x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.3);
        ctx.bezierCurveTo(x, y - s * 0.1, x - s, y - s * 0.1, x - s, y + s * 0.3);
        ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s * 1.1, x, y + s * 1.2);
        ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s * 0.7, x + s, y + s * 0.3);
        ctx.bezierCurveTo(x + s, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.3);
        ctx.fill();
    }

    drawMinimap(ctx, px, py, mx, my, mw, mh) {
        ctx.save();
        ctx.fillStyle = 'rgba(8,18,8,0.85)';
        ctx.strokeStyle = 'rgba(60,180,60,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 6); ctx.fill(); ctx.stroke();
        const scX = mw / this.worldW(), scY = mh / this.worldH();
        const ts = this.tileSize;
        for (let ty = 0; ty < this.mapH; ty++) {
            for (let tx = 0; tx < this.mapW; tx++) {
                const tile = this.map[ty][tx];
                ctx.fillStyle = tile === TILE.TREE ? '#1a4a1a' : tile === TILE.WATER ? '#1a50c0' : tile === TILE.PATH ? '#8b6014' : tile === TILE.STONE ? '#888' : tile === TILE.SAND ? '#c0a050' : '#2a6a18';
                ctx.fillRect(mx + tx * ts * scX, my + ty * ts * scY, Math.max(1, ts * scX), Math.max(1, ts * scY));
            }
        }
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 6; ctx.shadowColor = '#fff';
        ctx.beginPath(); ctx.arc(mx + px * scX, my + py * scY, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.restore();
    }
}
