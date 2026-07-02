#!/usr/bin/env node
// Generates frontend/public/models/demo-arm.glb: a small two-link robot arm
// (Base, Shoulder, ArmPivot > UpperArm, ForearmPivot > Forearm, StatusLamp).
// Pure Node, no dependencies — geometry is a shared unit cube; each part is a
// glTF node with its own translation/scale and material.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'frontend',
  'public',
  'models',
  'demo-arm.glb',
);

// ---- unit cube: 24 verts (4 per face, flat normals), 36 indices, CCW ----
// For each face, u x v = n so the corner loop winds counter-clockwise
// when viewed from outside.
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];
const positions = [];
const normals = [];
const indices = [];
FACES.forEach((f, fi) => {
  const base = fi * 4;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (let i = 0; i < 3; i++) positions.push(0.5 * f.n[i] + 0.5 * a * f.u[i] + 0.5 * b * f.v[i]);
    normals.push(...f.n);
  }
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
});

const posBuf = Buffer.from(new Float32Array(positions).buffer);
const nrmBuf = Buffer.from(new Float32Array(normals).buffer);
const idxBuf = Buffer.from(new Uint16Array(indices).buffer);
const bin = Buffer.concat([posBuf, nrmBuf, idxBuf]);

const materials = [
  { name: 'BaseMat', pbrMetallicRoughness: { baseColorFactor: [0.45, 0.47, 0.5, 1], metallicFactor: 0.2, roughnessFactor: 0.8 } },
  { name: 'ArmMat', pbrMetallicRoughness: { baseColorFactor: [0.15, 0.35, 0.8, 1], metallicFactor: 0.3, roughnessFactor: 0.5 } },
  { name: 'ForearmMat', pbrMetallicRoughness: { baseColorFactor: [0.25, 0.55, 0.95, 1], metallicFactor: 0.3, roughnessFactor: 0.5 } },
  { name: 'LampMat', pbrMetallicRoughness: { baseColorFactor: [0.08, 0.08, 0.08, 1], metallicFactor: 0.1, roughnessFactor: 0.4 }, emissiveFactor: [0, 0, 0] },
];

const gltf = {
  asset: { version: '2.0', generator: 'automation-sim demo-arm generator' },
  scene: 0,
  scenes: [{ name: 'DemoArm', nodes: [0, 1, 2, 6] }],
  nodes: [
    { name: 'Base', mesh: 0, translation: [0, 0.2, 0], scale: [0.8, 0.4, 0.8] },
    { name: 'Shoulder', mesh: 0, translation: [0, 0.5, 0], scale: [0.22, 0.2, 0.22] },
    { name: 'ArmPivot', translation: [0, 0.55, 0], children: [3, 4] },
    { name: 'UpperArm', mesh: 1, translation: [0, 0.5, 0], scale: [0.15, 1, 0.15] },
    { name: 'ForearmPivot', translation: [0, 1, 0], children: [5] },
    { name: 'Forearm', mesh: 2, translation: [0, 0.35, 0], scale: [0.12, 0.7, 0.12] },
    { name: 'StatusLamp', mesh: 3, translation: [0.3, 0.5, 0.3], scale: [0.08, 0.2, 0.08] },
  ],
  meshes: materials.map((m, i) => ({
    name: m.name.replace('Mat', ''),
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: i }],
  })),
  materials,
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
    { buffer: 0, byteOffset: posBuf.length, byteLength: nrmBuf.length, target: 34962 },
    { buffer: 0, byteOffset: posBuf.length + nrmBuf.length, byteLength: idxBuf.length, target: 34963 },
  ],
  buffers: [{ byteLength: bin.length }],
};

// ---- GLB container: 12-byte header + JSON chunk (space-padded) + BIN chunk ----
const jsonRaw = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc((4 - (jsonRaw.length % 4)) % 4, 0x20)]);
const binChunk = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);

const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const out = Buffer.alloc(total);
out.writeUInt32LE(0x46546c67, 0); // 'glTF'
out.writeUInt32LE(2, 4);
out.writeUInt32LE(total, 8);
out.writeUInt32LE(jsonChunk.length, 12);
out.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
jsonChunk.copy(out, 20);
const binStart = 20 + jsonChunk.length;
out.writeUInt32LE(binChunk.length, binStart);
out.writeUInt32LE(0x004e4942, binStart + 4); // 'BIN\0'
binChunk.copy(out, binStart + 8);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${total} bytes)`);
