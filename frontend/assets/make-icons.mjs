import sharp from 'sharp'
const src = process.argv[2], out = process.argv[3]
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
// Caja del símbolo: píxeles naranjas por encima del rótulo.
let x0 = W, y0 = H, x1 = 0, y1 = 0
for (let y = 0; y < Math.round(H * 0.54); y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 3
  if (data[i] > 200 && data[i + 2] < 120) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
}
const pad = 12
x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
const cw = x1 - x0, ch = y1 - y0
console.log('symbol box', x0, y0, cw, ch)
// Ampliar x4 y endurecer el borde: queda un trazo limpio aunque el original sea pequeño.
const K = 4
const up = await sharp(src).removeAlpha().extract({ left: x0, top: y0, width: cw, height: ch })
  .resize(cw * K, ch * K, { kernel: 'lanczos3' }).blur(1.2).raw().toBuffer()
const mask = Buffer.alloc(cw * K * ch * K)
for (let p = 0; p < mask.length; p++) {
  const t = Math.min(1, Math.max(0, (up[p * 3] - 30) / 190))
  const s = Math.min(1, Math.max(0, (t - 0.4) / 0.2))
  mask[p] = Math.round(255 * s * s * (3 - 2 * s))
}
const SIZE = 1024
const grad = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="0.5" stop-color="#ff7a36"/><stop offset="1" stop-color="#ee5a2c"/></linearGradient>`
const svg = (fill, defs = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><defs>${defs}</defs><rect width="100%" height="100%" fill="${fill}"/></svg>`)
async function icon(name, bg, fg, scale) {
  const w = Math.round(SIZE * scale), h = Math.round(w * ch / cw)
  const m = await sharp(mask, { raw: { width: cw * K, height: ch * K, channels: 1 } }).resize(w, h, { kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer()
  const rgb = await sharp(fg).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer()
  const rgba = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) { rgba[p * 4] = rgb[p * 3]; rgba[p * 4 + 1] = rgb[p * 3 + 1]; rgba[p * 4 + 2] = rgb[p * 3 + 2]; rgba[p * 4 + 3] = m[p] }
  const layer = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
  await sharp(bg).composite([{ input: layer, left: Math.round((SIZE - w) / 2), top: Math.round((SIZE - h) / 2) }]).png().toFile(`${out}/${name}.png`)
}
const orange = svg('url(#g)', grad('g'))
await icon('a-naranja-sobre-oscuro', svg('#0c1219'), orange, 0.66)
await icon('b-blanco-sobre-naranja', orange, svg('#ffffff'), 0.66)
await icon('c-oscuro-sobre-naranja', orange, svg('#0c1219'), 0.66)
// Primer plano para el icono adaptable de Android: el símbolo dentro de la zona segura (≈60 %).
await icon('fg-a', svg('#0c1219'), orange, 0.46)
await icon('fg-b', orange, svg('#ffffff'), 0.46)
await icon('fg-c', orange, svg('#0c1219'), 0.46)
// Hoja de comparación con las esquinas redondeadas de un móvil y a tamaño pequeño.
const round = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.225}" fill="#fff"/></svg>`)
const tiles = []
let x = 40
for (const n of ['a-naranja-sobre-oscuro', 'b-blanco-sobre-naranja', 'c-oscuro-sobre-naranja']) {
  for (const [s, y] of [[300, 40], [120, 380], [60, 540]]) {
    const t = await sharp(`${out}/${n}.png`).resize(s, s).composite([{ input: round(s), blend: 'dest-in' }]).png().toBuffer()
    tiles.push({ input: t, left: x, top: y })
  }
  x += 340
}
await sharp({ create: { width: 1060, height: 640, channels: 3, background: '#8a94a3' } }).composite(tiles).png().toFile(`${out}/comparacion.png`)

// Archivos fuente para las apps (los lee @capacitor/assets).
const dest = process.argv[4]
if (dest) {
  async function place(file, size, bg, fg, scale) {
    const w = Math.round(size * scale), h = Math.round(w * ch / cw)
    const m = await sharp(mask, { raw: { width: cw * K, height: ch * K, channels: 1 } }).resize(w, h, { kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer()
    const rgb = await sharp(fg).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer()
    const rgba = Buffer.alloc(w * h * 4)
    for (let p = 0; p < w * h; p++) { rgba[p * 4] = rgb[p * 3]; rgba[p * 4 + 1] = rgb[p * 3 + 1]; rgba[p * 4 + 2] = rgb[p * 3 + 2]; rgba[p * 4 + 3] = m[p] }
    const layer = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
    const base = bg ? sharp(bg).resize(size, size) : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    await base.composite([{ input: layer, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }]).png().toFile(`${dest}/${file}`)
  }
  await place('icon-only.png', 1024, orange, svg('#ffffff'), 0.66)
  await place('icon-foreground.png', 1024, null, svg('#ffffff'), 0.44)
  await sharp(orange).png().toFile(`${dest}/icon-background.png`)
  await place('splash.png', 2732, svg('#0c1219'), orange, 0.2)
  await place('splash-dark.png', 2732, svg('#0c1219'), orange, 0.2)
}
