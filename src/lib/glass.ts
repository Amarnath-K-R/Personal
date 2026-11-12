// Liquid glass refraction. Every glass surface gets an SVG filter, used as its backdrop filter, whose displacement
// map bends what is behind it along a rounded rim (Snell's law through a convex bevel), with a slight colour split.
// Only Chromium can use an SVG filter as a backdrop filter; Safari and Firefox keep the clear CSS glass
// (--glass-blur in liquid.css). CSS picks the filter up through --lg-filter.
const SELECTOR = '.button-dark, .email-copy, .filter-chip, .wall-rail, .wall-rail-back, .hl-close, .chapter-topbar, .project-node';
const SVG = 'http://www.w3.org/2000/svg';
const IOR = 1.5; // glass
const STRENGTH = 2.4; // exaggerates the bend so it reads at a glance over the dark sky

// Height of the bevel at t (0 = outer edge, 1 = where the flat top begins): a convex squircle.
const bevel = (t: number) => Math.pow(1 - Math.pow(1 - t, 4), .25);

// How far (px) the backdrop is pulled inward at each pixel step across a bevel `width` px wide.
function profile(width: number) {
  const steps = Math.max(2, Math.ceil(width));
  const out = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(Math.max(i / steps, .002), .998);
    const slope = (bevel(t + .001) - bevel(t - .001)) / .002; // surface height and run are both `width`
    const incidence = Math.atan(slope);
    const refracted = Math.asin(Math.sin(incidence) / IOR);
    out[i] = bevel(t) * width * Math.tan(incidence - refracted) * STRENGTH;
  }
  return out;
}

// Displacement map for a w×h rounded rectangle: red = x shift, green = y shift, 128 = none.
function displacementMap(w: number, h: number, r: number, width: number) {
  const bend = profile(width);
  const max = Math.max(...bend) || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(w, h);
  const data = image.data;
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + .5 - w / 2;
      const py = y + .5 - h / 2;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      // Signed distance to the rounded edge (negative inside), and the outward normal.
      let nx: number;
      let ny: number;
      let inside: number;
      if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy);
        inside = r - length;
        nx = qx / length;
        ny = qy / length;
      } else if (qx > qy) {
        inside = r - qx;
        nx = 1;
        ny = 0;
      } else {
        inside = r - qy;
        nx = 0;
        ny = 1;
      }
      nx *= Math.sign(px) || 1;
      ny *= Math.sign(py) || 1;
      let red = 128;
      let green = 128;
      if (inside >= 0 && inside < width) {
        const pull = bend[Math.round(inside / width * (bend.length - 1))] / (2 * max); // share of the filter's scale, inward
        red = 128 - 255 * nx * pull;
        green = 128 - 255 * ny * pull;
      }
      const i = (y * w + x) * 4;
      data[i] = red;
      data[i + 1] = green;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return { url: canvas.toDataURL(), scale: 2 * max };
}

export function initGlass() {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  if (!brands?.some(({ brand }) => brand === 'Chromium')) return;

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.append(svg);
  // ponytail: filters are kept per size and never dropped; fine for a handful of surfaces and resizes.
  const filters = new Map<string, string>();

  function filterFor(w: number, h: number, r: number) {
    const key = `${w}x${h}r${r}`;
    const known = filters.get(key);
    if (known) return known;
    const id = `liquid-glass-${filters.size}`;
    // Pills bend across their whole height; cards and slabs get a rim about as wide as their corner.
    const width = Math.max(8, Math.min(Math.min(w, h) / 2, r > 0 ? r * 1.15 : 16, 30));
    const { url, scale } = displacementMap(w, h, r, width);
    const channel = (name: string, k: number, matrix: string) =>
      `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(scale * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="d${name}"/>` +
      `<feColorMatrix in="d${name}" type="matrix" values="${matrix}" result="${name}"/>`;
    const filter = document.createElementNS(SVG, 'filter');
    filter.id = id;
    for (const [name, value] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) filter.setAttribute(name, String(value));
    // Red bends a little less than blue, so the rim splits colour slightly, as real glass does.
    filter.innerHTML =
      `<feImage href="${url}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
      channel('r', .96, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0') +
      channel('g', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0') +
      channel('b', 1.04, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0') +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen" result="rgb"/>' +
      '<feColorMatrix in="rgb" type="saturate" values="1.35"/>';
    svg.append(filter);
    filters.set(key, id);
    return id;
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      const w = Math.round(entry.borderBoxSize[0].inlineSize);
      const h = Math.round(entry.borderBoxSize[0].blockSize);
      if (w < 8 || h < 8) continue;
      const r = Math.round(Math.min(parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0, w / 2, h / 2));
      element.style.setProperty('--lg-filter', `url(#${filterFor(w, h, r)})`);
    }
  });
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((element) => observer.observe(element, { box: 'border-box' }));
}
