// Read-only PNG asset metadata. Does not convert or modify generated art.
const fs = require('node:fs');
for (const file of process.argv.slice(2)) {
  const data = fs.readFileSync(file);
  if (data.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`Not PNG: ${file}`);
  console.log(JSON.stringify({file, bytes:data.length,width:data.readUInt32BE(16),height:data.readUInt32BE(20),bitDepth:data[24],colorType:data[25],hasAlphaChannel:[4,6].includes(data[25])}));
}
