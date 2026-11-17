import * as THREE from 'three';

export interface ProceduralTextureSet {
  floor: THREE.CanvasTexture;
  warehouseWall: THREE.CanvasTexture;
  containerOrange: THREE.CanvasTexture;
  containerCyan: THREE.CanvasTexture;
  containerSlate: THREE.CanvasTexture;
  crate: THREE.CanvasTexture;
  hazard: THREE.CanvasTexture;
  bulletHole: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

function createFloorCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concrete noise
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 14 + Math.floor(Math.random() * 20);
    ctx.fillStyle = `rgb(${v}, ${v + 5}, ${v + 15})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Slab grid seams
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Subtle industrial lane markings
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 492, 492);

  return c;
}

function createWarehouseWallCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#1b2436';
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? '#222d42' : '#161e2e';
    ctx.fillRect(x, 0, 16, 256);
    ctx.fillStyle = '#0d1320';
    ctx.fillRect(x + 30, 0, 2, 256);
  }

  // Horizontal structural seam + neon accent hairline
  ctx.fillStyle = '#0c111c';
  ctx.fillRect(0, 124, 256, 8);
  ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
  ctx.fillRect(0, 224, 256, 4);

  return c;
}

function createCorrugatedCanvas(base: string, rib: string, stripe: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = rib;
    ctx.fillRect(x, 0, 7, 256);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(x + 7, 0, 3, 256);
  }

  // Frame border
  ctx.strokeStyle = 'rgba(10, 15, 26, 0.7)';
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, 256, 256);

  // Neon ID band
  ctx.fillStyle = stripe;
  ctx.fillRect(16, 36, 72, 10);

  return c;
}

function createCrateCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#253044';
  ctx.fillRect(0, 0, 256, 256);

  // Outer bevel frame
  ctx.strokeStyle = '#131a29';
  ctx.lineWidth = 20;
  ctx.strokeRect(0, 0, 256, 256);

  // Diagonal X brace
  ctx.strokeStyle = '#1b2436';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(22, 22);
  ctx.lineTo(234, 234);
  ctx.moveTo(234, 22);
  ctx.lineTo(22, 234);
  ctx.stroke();

  // Corner neon bolts
  ctx.fillStyle = '#f97316';
  const corners = [28, 220];
  for (const cx of corners) {
    for (const cy of corners) {
      ctx.fillRect(cx, cy, 8, 8);
    }
  }

  return c;
}

function createHazardCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#ea580c';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

function createBulletHoleCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 26);
  grad.addColorStop(0, 'rgba(5, 8, 15, 0.96)');
  grad.addColorStop(0.32, 'rgba(249, 115, 22, 0.65)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.72)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const floor = finalizeTexture(createFloorCanvas(), aniso, 20, 20, true);
  const warehouseWall = finalizeTexture(createWarehouseWallCanvas(), aniso, 4, 2, true);
  const containerOrange = finalizeTexture(
    createCorrugatedCanvas('#4b2416', '#7c341a', '#f97316'),
    aniso,
    2,
    1,
    true
  );
  const containerCyan = finalizeTexture(
    createCorrugatedCanvas('#122b3d', '#193d54', '#22d3ee'),
    aniso,
    2,
    1,
    true
  );
  const containerSlate = finalizeTexture(
    createCorrugatedCanvas('#1e293b', '#2b394f', '#94a3b8'),
    aniso,
    2,
    1,
    true
  );
  const crate = finalizeTexture(createCrateCanvas(), aniso, 1, 1, true);
  const hazard = finalizeTexture(createHazardCanvas(), aniso, 4, 1, true);
  const bulletHole = finalizeTexture(createBulletHoleCanvas(), 1, 1, 1, true);
  bulletHole.wrapS = THREE.ClampToEdgeWrapping;
  bulletHole.wrapT = THREE.ClampToEdgeWrapping;

  return {
    floor,
    warehouseWall,
    containerOrange,
    containerCyan,
    containerSlate,
    crate,
    hazard,
    bulletHole,
    dispose: () => {
      floor.dispose();
      warehouseWall.dispose();
      containerOrange.dispose();
      containerCyan.dispose();
      containerSlate.dispose();
      crate.dispose();
      hazard.dispose();
      bulletHole.dispose();
    },
  };
}
