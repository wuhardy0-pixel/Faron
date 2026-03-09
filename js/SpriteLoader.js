
// ─── Sprite Loader with Black-Background Removal ─────────────────────────────
// Converts black/near-black pixels in sprite PNGs to transparent
// so they blend seamlessly onto any tile background.

const _spriteCache = {};

function loadSprite(src) {
    if (_spriteCache[src]) return _spriteCache[src];

    const entry = { canvas: null, loaded: false };
    _spriteCache[src] = entry;

    const img = new Image();
    img.onload = () => {
        const w = img.naturalWidth || 64;
        const h = img.naturalHeight || 64;
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx2 = offscreen.getContext('2d');
        ctx2.drawImage(img, 0, 0);

        try {
            const imageData = ctx2.getImageData(0, 0, w, h);
            const d = imageData.data;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                // Remove pixels that are near-black (the baked-in background color)
                if (r < 18 && g < 18 && b < 18) {
                    d[i + 3] = 0; // fully transparent
                }
            }
            ctx2.putImageData(imageData, 0, 0);
        } catch (e) {
            // CORS / security error – just use unprocessed image
            console.warn('SpriteLoader: could not process', src, e.message);
        }

        entry.canvas = offscreen;
        entry.loaded = true;
    };
    img.onerror = () => { entry.loaded = false; };
    img.src = src;
    return entry;
}
