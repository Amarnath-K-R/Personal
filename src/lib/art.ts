const palette: Record<string, string> = {
  imaging: '#5a708c',
  omics: '#6b7447',
  clinical: '#b45d42',
  trust: '#77596f',
};
const paper = '#e7e8df';
const ink = '#244d3b';
const citron = '#d3f16b';
function hash(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function buildCover(canvas: HTMLCanvasElement) {
  const seed = canvas.dataset.seed || 'cover';
  const random = rng(hash(seed));
  const accent = palette[canvas.dataset.area || 'imaging'] || palette.imaging;
  const width = 900;
  const height = 675;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * .64, height * .42, 6, width * .64, height * .42, width * .68);
  glow.addColorStop(0, `${accent}55`);
  glow.addColorStop(.45, `${accent}1c`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Broad, slow contours give each art seed its own atmospheric structure.
  ctx.lineCap = 'round';
  for (let layer = 0; layer < 13; layer++) {
    const color = layer % 5 === 0 ? ink : layer % 7 === 0 ? '#b45d42' : accent;
    const y = height * (.12 + layer * .064 + (random() - .5) * .055);
    const drift = (random() - .5) * 180;
    ctx.beginPath();
    ctx.moveTo(-60, y + drift * .25);
    ctx.bezierCurveTo(width * .21, y - 165 + drift, width * .46, y + 165 - drift, width * .66, y + drift * .45);
    ctx.bezierCurveTo(width * .82, y - 100 + drift, width * .93, y + 100 - drift, width + 80, y + drift * .14);
    ctx.strokeStyle = color;
    ctx.globalAlpha = .12 + random() * .19;
    ctx.lineWidth = 1 + random() * 3;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 90; i++) {
    const x = random() * width;
    const y = random() * height;
    const size = random() > .9 ? 3 : .8 + random() * 1.2;
    ctx.fillStyle = random() > .9 ? citron : ink;
    ctx.globalAlpha = .17 + random() * .33;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = `${ink}35`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(width * (.58 + random() * .1), height * (.42 + random() * .14), width * .23, height * .34, -.35, 0, Math.PI * 2);
  ctx.stroke();
}

export function initArtwork() {
  const covers = [...document.querySelectorAll<HTMLCanvasElement>('canvas[data-cover]')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          buildCover(entry.target as HTMLCanvasElement);
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '180px' });
    covers.forEach((canvas) => observer.observe(canvas));
  } else covers.forEach(buildCover);
}
