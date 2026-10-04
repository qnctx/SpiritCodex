// Read-only diagnostic for the existing 1×1 PNG samples extracted by the recorder.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const directory = process.argv[2];
if (!directory) throw new Error('Usage: node inspect-video-markers.cjs <raw marker directory>');
function readRgb(file) {
  const buffer = fs.readFileSync(file), chunks = [];
  let width, height, colorType, depth;
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; colorType = data[9]; }
    if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  if (width !== 1 || height !== 1 || depth !== 8 || ![2, 6].includes(colorType)) throw new Error(`Unexpected PNG format in ${file}`);
  const row = zlib.inflateSync(Buffer.concat(chunks));
  return { rgb: [...row.subarray(1, 4)], filter: row[0] };
}
const frames = fs.readdirSync(directory).filter(name => /^marker-\d+\.png$/.test(name)).sort().map((name, index) => {
  const pixel = readRgb(path.join(directory, name)), [r, g, b] = pixel.rgb;
  return { frame: index, name, ...pixel, kind: r > 180 && g < 80 && b > 180 ? 'magenta' : r < 80 && g > 180 && b < 80 ? 'green' : r > 220 && g > 220 && b > 220 ? 'white' : 'other', magentaScore: Math.min(r, b) - g };
});
const histogram = new Map(), groups = [];
for (const frame of frames) {
  const key = frame.rgb.join(','); histogram.set(key, (histogram.get(key) || 0) + 1);
  if (groups.at(-1)?.kind === frame.kind) groups.at(-1).end = frame.frame;
  else groups.push({ kind: frame.kind, start: frame.frame, end: frame.frame, rgb: frame.rgb });
}
console.log(JSON.stringify({ directory, totalFrames: frames.length, filters: [...new Set(frames.map(frame => frame.filter))],
  groups, magentaFrames: frames.filter(frame => frame.kind === 'magenta').map(frame => frame.frame),
  topColors: [...histogram].sort((a, b) => b[1] - a[1]).slice(0, 20),
  strongestMagenta: [...frames].sort((a, b) => b.magentaScore - a.magentaScore).slice(0, 10),
  first: frames.slice(0, 5), last: frames.slice(-5) }, null, 2));
