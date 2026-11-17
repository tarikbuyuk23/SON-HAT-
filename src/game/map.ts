import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface RampSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  dir: 1 | -1; // +1 means height increases toward max, -1 means height increases toward min
  baseY: number;
  topY: number;
}

export interface IndustrialMap {
  group: THREE.Group;
  colliders: ColliderBox[];
  ramps: RampSurface[];
  shootableMeshes: THREE.Object3D[];
  spawnPoints: THREE.Vector3[];
  patrolPoints: THREE.Vector3[];
  coverPoints: THREE.Vector3[];
  animatedLights: { light: THREE.PointLight; baseIntensity: number; speed: number; phase: number }[];
  getGroundHeightAt: (x: number, z: number, currentFeetY: number) => number;
  resolveHorizontalCollision: (pos: THREE.Vector3, radius: number, feetY: number, height: number) => void;
  hasLineOfSight: (from: THREE.Vector3, to: THREE.Vector3) => boolean;
  dispose: () => void;
}

const _raycaster = new THREE.Raycaster();
const _losDir = new THREE.Vector3();

export function createIndustrialMap(textures: ProceduralTextureSet): IndustrialMap {
  const group = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const ramps: RampSurface[] = [];
  const shootableMeshes: THREE.Object3D[] = [];
  const animatedLights: { light: THREE.PointLight; baseIntensity: number; speed: number; phase: number }[] = [];

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Shared materials
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.floor,
      roughness: 0.86,
      metalness: 0.12,
    })
  );
  const outerGroundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.95,
      metalness: 0.05,
    })
  );
  const warehouseMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.warehouseWall,
      roughness: 0.68,
      metalness: 0.35,
    })
  );
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.72,
      metalness: 0.45,
    })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.88,
      metalness: 0.1,
    })
  );
  const steelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.78,
    })
  );
  const hazardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.hazard,
      roughness: 0.65,
      metalness: 0.25,
    })
  );
  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.crate,
      roughness: 0.58,
      metalness: 0.42,
    })
  );
  const containerMats = [
    trackMat(new THREE.MeshStandardMaterial({ map: textures.containerOrange, roughness: 0.55, metalness: 0.55 })),
    trackMat(new THREE.MeshStandardMaterial({ map: textures.containerCyan, roughness: 0.55, metalness: 0.55 })),
    trackMat(new THREE.MeshStandardMaterial({ map: textures.containerSlate, roughness: 0.52, metalness: 0.62 })),
  ];
  const neonOrangeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  const neonCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.1,
    })
  );

  // Helper to add static box with collider
  function addSolidBox(
    x: number,
    yCenter: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    castShadow = true,
    registerCollider = true
  ): THREE.Mesh {
    const geo = trackGeo(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, yCenter, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    shootableMeshes.push(mesh);

    if (registerCollider) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: yCenter - h / 2,
        maxY: yCenter + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    }
    return mesh;
  }

  // Helper to add a walkable ramp (axis 'x' or 'z')
  function addRamp(
    cx: number,
    cz: number,
    w: number,
    d: number,
    baseY: number,
    topY: number,
    axis: 'x' | 'z',
    dir: 1 | -1
  ): void {
    const minX = cx - w / 2;
    const maxX = cx + w / 2;
    const minZ = cz - d / 2;
    const maxZ = cz + d / 2;

    ramps.push({ minX, maxX, minZ, maxZ, axis, dir, baseY, topY });

    // Build custom wedge geometry for visual ramp
    const h = topY - baseY;
    const hw = w / 2;
    const hd = d / 2;

    let yNX_NZ = baseY;
    let yPX_NZ = baseY;
    let yNX_PZ = baseY;
    let yPX_PZ = baseY;

    if (axis === 'x') {
      if (dir === 1) {
        yPX_NZ = topY;
        yPX_PZ = topY;
      } else {
        yNX_NZ = topY;
        yNX_PZ = topY;
      }
    } else {
      if (dir === 1) {
        yNX_PZ = topY;
        yPX_PZ = topY;
      } else {
        yNX_NZ = topY;
        yPX_NZ = topY;
      }
    }

    // Visual sloped deck box (thin slab rotated along ramp angle)
    const run = axis === 'x' ? w : d;
    const length = Math.hypot(run, h);
    const angle = Math.atan2(h, run);

    const slabGeo = trackGeo(new THREE.BoxGeometry(axis === 'x' ? length : w, 0.22, axis === 'z' ? length : d));
    const slab = new THREE.Mesh(slabGeo, steelMat);
    slab.position.set(cx, baseY + h / 2 - 0.1, cz);
    if (axis === 'x') {
      slab.rotation.z = dir === 1 ? angle : -angle;
    } else {
      slab.rotation.x = dir === 1 ? -angle : angle;
    }
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
    shootableMeshes.push(slab);

    // Side safety neon rail strips on ramp
    const railGeo = trackGeo(new THREE.BoxGeometry(axis === 'x' ? length : 0.1, 0.08, axis === 'z' ? length : 0.1));
    const offset = (axis === 'x' ? hd : hw) - 0.12;
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, neonCyanMat);
      rail.position.set(
        cx + (axis === 'z' ? side * offset : 0),
        baseY + h / 2 + 0.06,
        cz + (axis === 'x' ? side * offset : 0)
      );
      if (axis === 'x') rail.rotation.z = dir === 1 ? angle : -angle;
      else rail.rotation.x = dir === 1 ? -angle : angle;
      group.add(rail);
    }

    void yNX_NZ;
    void yPX_NZ;
    void yNX_PZ;
    void yPX_PZ;
  }

  // 1. Main Playable Floor (90x90) + Surrounding Industrial Apron (extending to fog)
  const floorGeo = trackGeo(new THREE.PlaneGeometry(92, 92));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  shootableMeshes.push(floor);

  const outerFloorGeo = trackGeo(new THREE.PlaneGeometry(340, 340));
  const outerFloor = new THREE.Mesh(outerFloorGeo, outerGroundMat);
  outerFloor.rotation.x = -Math.PI / 2;
  outerFloor.position.y = -0.05;
  group.add(outerFloor);

  // 2. Outer Perimeter Industrial Walls (creating narrow corridors behind warehouses)
  const arenaHalf = 45;
  const wallH = 6.5;
  addSolidBox(0, wallH / 2, -arenaHalf, 92, wallH, 1.5, warehouseMat, true);
  addSolidBox(0, wallH / 2, arenaHalf, 92, wallH, 1.5, warehouseMat, true);
  addSolidBox(-arenaHalf, wallH / 2, 0, 1.5, wallH, 92, warehouseMat, true);
  addSolidBox(arenaHalf, wallH / 2, 0, 1.5, wallH, 92, warehouseMat, true);

  // Perimeter hazard stripe bands
  const bandN = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(88, 0.35, 0.1)), hazardMat);
  bandN.position.set(0, 1.2, -arenaHalf + 0.8);
  group.add(bandN);
  const bandS = bandN.clone();
  bandS.position.set(0, 1.2, arenaHalf - 0.8);
  group.add(bandS);

  // 3. Distant Industrial Skyline Silhouettes (beyond perimeter wall into fog)
  const siloMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.2 }));
  const silhouettePositions = [
    [-64, 14, -62, 16, 28, 16],
    [62, 18, -58, 18, 36, 14],
    [-68, 12, 56, 14, 24, 20],
    [66, 15, 62, 20, 30, 16],
    [0, 20, -76, 36, 40, 14],
    [-76, 16, 4, 14, 32, 34],
    [76, 17, -6, 14, 34, 30],
  ];
  for (const [sx, sy, sz, sw, sh, sd] of silhouettePositions) {
    const b = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(sw, sh, sd)), siloMat);
    b.position.set(sx, sy, sz);
    group.add(b);
    // Distant warning beacon
    const beacon = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.45, 8, 8)), neonOrangeMat);
    beacon.position.set(sx, sy + sh / 2 + 0.5, sz);
    group.add(beacon);
  }

  // 4. WAREHOUSE A (West Depo: x in [-37, -21], z in [-16, 16])
  // Leaves narrow corridor behind it: x in [-44, -37]
  {
    const whH = 7.2;
    const whRoofY = 7.4;
    // Roof
    addSolidBox(-29, whRoofY, 0, 16.6, 0.5, 32.6, roofMat, true);
    // Front wall (x = -21) with wide center doorway (gap z in [-4, 4])
    addSolidBox(-21, whH / 2, -10, 0.9, whH, 12, warehouseMat);
    addSolidBox(-21, whH / 2, 10, 0.9, whH, 12, warehouseMat);
    addSolidBox(-21, 5.7, 0, 0.9, 3.0, 8, warehouseMat); // doorway header
    // Back wall (x = -37) with two side doorways (gaps at z=-9.. -5 and z=5..9)
    addSolidBox(-37, whH / 2, -13.5, 0.9, whH, 5, warehouseMat);
    addSolidBox(-37, whH / 2, 0, 0.9, whH, 10, warehouseMat);
    addSolidBox(-37, whH / 2, 13.5, 0.9, whH, 5, warehouseMat);
    addSolidBox(-37, 5.7, -7, 0.9, 3.0, 4, warehouseMat);
    addSolidBox(-37, 5.7, 7, 0.9, 3.0, 4, warehouseMat);
    // North & South end walls with doorways
    addSolidBox(-33.5, whH / 2, -16, 7, whH, 0.9, warehouseMat);
    addSolidBox(-24.5, whH / 2, -16, 7, whH, 0.9, warehouseMat);
    addSolidBox(-29, 5.7, -16, 4, 3.0, 0.9, warehouseMat);

    addSolidBox(-33.5, whH / 2, 16, 7, whH, 0.9, warehouseMat);
    addSolidBox(-24.5, whH / 2, 16, 7, whH, 0.9, warehouseMat);
    addSolidBox(-29, 5.7, 16, 4, 3.0, 0.9, warehouseMat);

    // Interior support pillars & cover crates
    addSolidBox(-29, 3.6, -8, 1.1, whH, 1.1, steelMat);
    addSolidBox(-29, 3.6, 8, 1.1, whH, 1.1, steelMat);
    addSolidBox(-26, 0.75, -3, 1.5, 1.5, 1.5, crateMat);
    addSolidBox(-32, 0.75, 3, 1.6, 1.5, 1.6, crateMat);
    addSolidBox(-25.5, 0.65, 9, 1.3, 1.3, 2.2, crateMat);

    // Neon ceiling strip & light
    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.15, 18)), neonCyanMat);
    strip.position.set(-29, 6.9, 0);
    group.add(strip);
    const pt = new THREE.PointLight(0x22d3ee, 28, 28, 1.7);
    pt.position.set(-29, 6.2, 0);
    group.add(pt);
  }

  // 5. WAREHOUSE B (East Depo: x in [21, 37], z in [-16, 16])
  // Leaves narrow corridor behind it: x in [37, 44]
  {
    const whH = 7.2;
    const whRoofY = 7.4;
    addSolidBox(29, whRoofY, 0, 16.6, 0.5, 32.6, roofMat, true);
    // Front wall (x = 21) with two loading bays (gaps z=-10..-5 and z=5..10)
    addSolidBox(21, whH / 2, -13.5, 0.9, whH, 5, warehouseMat);
    addSolidBox(21, whH / 2, 0, 0.9, whH, 10, warehouseMat);
    addSolidBox(21, whH / 2, 13.5, 0.9, whH, 5, warehouseMat);
    addSolidBox(21, 5.7, -7.5, 0.9, 3.0, 5, warehouseMat);
    addSolidBox(21, 5.7, 7.5, 0.9, 3.0, 5, warehouseMat);
    // Back wall (x = 37) with center corridor exit
    addSolidBox(37, whH / 2, -10, 0.9, whH, 12, warehouseMat);
    addSolidBox(37, whH / 2, 10, 0.9, whH, 12, warehouseMat);
    addSolidBox(37, 5.7, 0, 0.9, 3.0, 8, warehouseMat);
    // North & South walls with doorways
    addSolidBox(24.5, whH / 2, -16, 7, whH, 0.9, warehouseMat);
    addSolidBox(33.5, whH / 2, -16, 7, whH, 0.9, warehouseMat);
    addSolidBox(29, 5.7, -16, 4, 3.0, 0.9, warehouseMat);

    addSolidBox(24.5, whH / 2, 16, 7, whH, 0.9, warehouseMat);
    addSolidBox(33.5, whH / 2, 16, 7, whH, 0.9, warehouseMat);
    addSolidBox(29, 5.7, 16, 4, 3.0, 0.9, warehouseMat);

    // Interior crates & pillars
    addSolidBox(29, 3.6, -7, 1.1, whH, 1.1, steelMat);
    addSolidBox(29, 3.6, 7, 1.1, whH, 1.1, steelMat);
    addSolidBox(26, 0.75, 0, 1.8, 1.5, 1.8, crateMat);
    addSolidBox(31.5, 0.75, -9, 1.5, 1.5, 1.5, crateMat);
    addSolidBox(31.5, 2.1, -9, 1.2, 1.2, 1.2, crateMat);

    const strip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.15, 18)), neonOrangeMat);
    strip.position.set(29, 6.9, 0);
    group.add(strip);
    const pt = new THREE.PointLight(0xf97316, 28, 28, 1.7);
    pt.position.set(29, 6.2, 0);
    group.add(pt);
    animatedLights.push({ light: pt, baseIntensity: 28, speed: 5.5, phase: 1.2 });
  }

  // 6. MAIN PLAZA (ANA MEYDAN) — Central Tactical Cover & Raised Walkways
  // Central Neon Pylon & Control Station
  addSolidBox(0, 1.3, 0, 2.4, 2.6, 2.4, steelMat);
  const pylonGlow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.55, 0.25, 2.55)), neonCyanMat);
  pylonGlow.position.set(0, 2.35, 0);
  group.add(pylonGlow);
  const plazaBeacon = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.25, 0.35, 5.5, 8)), steelMat);
  plazaBeacon.position.set(0, 5.2, 0);
  group.add(plazaBeacon);
  const beaconTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.45, 10, 10)), neonCyanMat);
  beaconTip.position.set(0, 8.2, 0);
  group.add(beaconTip);
  const centerLight = new THREE.PointLight(0x22d3ee, 35, 36, 1.5);
  centerLight.position.set(0, 8.6, 0);
  group.add(centerLight);

  // Low Concrete Jersey Barriers & Tactical Cover Crates around Main Plaza
  addSolidBox(-7.5, 0.65, -5.5, 3.8, 1.3, 0.9, concreteMat);
  addSolidBox(7.5, 0.65, 5.5, 3.8, 1.3, 0.9, concreteMat);
  addSolidBox(-7.5, 0.65, 5.5, 0.9, 1.3, 3.8, concreteMat);
  addSolidBox(7.5, 0.65, -5.5, 0.9, 1.3, 3.8, concreteMat);

  addSolidBox(-12, 0.75, 0, 1.6, 1.5, 1.6, crateMat);
  addSolidBox(12, 0.75, 0, 1.6, 1.5, 1.6, crateMat);
  addSolidBox(-4.5, 0.75, 11, 1.5, 1.5, 1.5, crateMat);
  addSolidBox(4.5, 0.75, -11, 1.5, 1.5, 1.5, crateMat);

  // 7. ELEVATED CATWALKS & WALKABLE RAMPS (North & South Plaza Overlooks)
  // North Overlook Platform (x in [-6, 6], z in [-21, -16], topY = 2.4)
  addSolidBox(0, 2.2, -18.5, 12, 0.4, 5, steelMat);
  // Support legs
  addSolidBox(-5.2, 1.0, -20.4, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(5.2, 1.0, -20.4, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(-5.2, 1.0, -16.6, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(5.2, 1.0, -16.6, 0.6, 2.0, 0.6, steelMat);
  // Low waist cover on front edge of north platform
  addSolidBox(0, 2.85, -16.2, 8.5, 0.9, 0.35, hazardMat);
  // Two ramps climbing onto North Platform from West & East
  addRamp(-9.5, -18.5, 7, 4.2, 0, 2.4, 'x', 1);
  addRamp(9.5, -18.5, 7, 4.2, 0, 2.4, 'x', -1);

  // South Overlook Platform (x in [-6, 6], z in [16, 21], topY = 2.4)
  addSolidBox(0, 2.2, 18.5, 12, 0.4, 5, steelMat);
  addSolidBox(-5.2, 1.0, 20.4, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(5.2, 1.0, 20.4, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(-5.2, 1.0, 16.6, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(5.2, 1.0, 16.6, 0.6, 2.0, 0.6, steelMat);
  addSolidBox(0, 2.85, 16.2, 8.5, 0.9, 0.35, hazardMat);
  addRamp(-9.5, 18.5, 7, 4.2, 0, 2.4, 'x', 1);
  addRamp(9.5, 18.5, 7, 4.2, 0, 2.4, 'x', -1);

  // 8. SHIPPING CONTAINER STACKS (Konteyner Yığınları) — North & South Yards
  const containerSpecs: [number, number, number, number, number, number, number][] = [
    // [x, yCenter, z, w, h, d, matIdx]
    // North-West container cluster
    [-28, 1.5, -28, 7.5, 3.0, 3.0, 0],
    [-28, 4.5, -28, 7.5, 3.0, 3.0, 2],
    [-19, 1.5, -33, 3.0, 3.0, 7.5, 1],
    [-35, 1.5, -35, 7.5, 3.0, 3.0, 2],
    // North-East container cluster
    [28, 1.5, -28, 7.5, 3.0, 3.0, 1],
    [28, 4.5, -28, 7.5, 3.0, 3.0, 0],
    [19, 1.5, -33, 3.0, 3.0, 7.5, 2],
    [35, 1.5, -35, 7.5, 3.0, 3.0, 0],
    // North center twin containers creating narrow corridor
    [-3.5, 1.5, -32, 3.0, 3.0, 7.5, 0],
    [3.5, 1.5, -32, 3.0, 3.0, 7.5, 1],
    // South-West container cluster
    [-28, 1.5, 28, 7.5, 3.0, 3.0, 1],
    [-28, 4.5, 28, 7.5, 3.0, 3.0, 2],
    [-19, 1.5, 33, 3.0, 3.0, 7.5, 0],
    // South-East container cluster
    [28, 1.5, 28, 7.5, 3.0, 3.0, 0],
    [28, 4.5, 28, 7.5, 3.0, 3.0, 1],
    [19, 1.5, 33, 3.0, 3.0, 7.5, 2],
    // South center containers
    [-6, 1.5, 33, 7.5, 3.0, 3.0, 2],
    [6, 1.5, 33, 7.5, 3.0, 3.0, 0],
  ];

  for (const [cx, cy, cz, cw, ch, cd, mIdx] of containerSpecs) {
    addSolidBox(cx, cy, cz, cw, ch, cd, containerMats[mIdx]);
  }

  // Extra cover crates in yards & corridors
  const extraCrates: [number, number, number][] = [
    [-14, 0.75, -26],
    [14, 0.75, -26],
    [-14, 0.75, 26],
    [14, 0.75, 26],
    [-40.5, 0.75, -8],
    [-40.5, 0.75, 8],
    [40.5, 0.75, -8],
    [40.5, 0.75, 8],
    [0, 0.75, -26],
    [0, 0.75, 26],
  ];
  for (const [kx, ky, kz] of extraCrates) {
    addSolidBox(kx, ky, kz, 1.6, 1.5, 1.6, crateMat);
  }

  // 9. Neon Industrial Floodlight Poles at 4 Courtyard Corners
  const towerPositions: [number, number, number][] = [
    [-15, -14, 0xf97316],
    [15, -14, 0x22d3ee],
    [-15, 14, 0x22d3ee],
    [15, 14, 0xf97316],
  ];
  for (let i = 0; i < towerPositions.length; i++) {
    const [tx, tz, col] = towerPositions[i];
    addSolidBox(tx, 3.5, tz, 0.55, 7.0, 0.55, steelMat);
    const head = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.1, 0.35, 1.1)),
      col === 0xf97316 ? neonOrangeMat : neonCyanMat
    );
    head.position.set(tx, 7.1, tz);
    group.add(head);

    const pLight = new THREE.PointLight(col, 24, 26, 1.6);
    pLight.position.set(tx, 6.6, tz);
    group.add(pLight);
    if (i % 2 === 0) {
      animatedLights.push({ light: pLight, baseIntensity: 24, speed: 3.2 + i, phase: i * 1.7 });
    }
  }

  // Spawn points around outer yards & corridors (away from center player spawn)
  const spawnPoints = [
    new THREE.Vector3(-32, 0, -39),
    new THREE.Vector3(0, 0, -39),
    new THREE.Vector3(32, 0, -39),
    new THREE.Vector3(-40, 0, -18),
    new THREE.Vector3(40, 0, -18),
    new THREE.Vector3(-40, 0, 18),
    new THREE.Vector3(40, 0, 18),
    new THREE.Vector3(-32, 0, 39),
    new THREE.Vector3(0, 0, 39),
    new THREE.Vector3(32, 0, 39),
  ];

  // Patrol waypoints throughout plaza, warehouses, and yards
  const patrolPoints = [
    new THREE.Vector3(-12, 0, -12),
    new THREE.Vector3(12, 0, -12),
    new THREE.Vector3(12, 0, 12),
    new THREE.Vector3(-12, 0, 12),
    new THREE.Vector3(-29, 0, 0),
    new THREE.Vector3(29, 0, 0),
    new THREE.Vector3(0, 0, -27),
    new THREE.Vector3(0, 0, 27),
    new THREE.Vector3(-23, 0, -24),
    new THREE.Vector3(23, 0, 24),
  ];

  // Tactical cover spots behind barriers/crates/containers
  const coverPoints = [
    new THREE.Vector3(-9.5, 0, -5.5),
    new THREE.Vector3(9.5, 0, 5.5),
    new THREE.Vector3(-9.5, 0, 5.5),
    new THREE.Vector3(9.5, 0, -5.5),
    new THREE.Vector3(-14, 0, 0),
    new THREE.Vector3(14, 0, 0),
    new THREE.Vector3(-16, 0, -26),
    new THREE.Vector3(16, 0, -26),
    new THREE.Vector3(-16, 0, 26),
    new THREE.Vector3(16, 0, 26),
    new THREE.Vector3(-24, 0, -5),
    new THREE.Vector3(24, 0, 5),
  ];

  function getGroundHeightAt(x: number, z: number, currentFeetY: number): number {
    let highest = 0;

    // Check walkable ramps
    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        let t = 0;
        if (r.axis === 'x') {
          t = (x - r.minX) / (r.maxX - r.minX);
        } else {
          t = (z - r.minZ) / (r.maxZ - r.minZ);
        }
        if (r.dir === -1) t = 1 - t;
        t = Math.max(0, Math.min(1, t));
        const ry = r.baseY + t * (r.topY - r.baseY);
        if (ry <= currentFeetY + 0.75 && ry > highest) {
          highest = ry;
        }
      }
    }

    // Check top of solid boxes (e.g. elevated platforms, crates)
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x >= c.minX - 0.1 && x <= c.maxX + 0.1 && z >= c.minZ - 0.1 && z <= c.maxZ + 0.1) {
        if (c.maxY <= currentFeetY + 0.55 && c.maxY > highest) {
          highest = c.maxY;
        }
      }
    }

    return highest;
  }

  function resolveHorizontalCollision(
    pos: THREE.Vector3,
    radius: number,
    feetY: number,
    height: number
  ): void {
    // Clamp inside outer perimeter
    pos.x = Math.max(-44 + radius, Math.min(44 - radius, pos.x));
    pos.z = Math.max(-44 + radius, Math.min(44 - radius, pos.z));

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        // Skip boxes completely below feet (walkable step/platform) or completely above head (doorway header/roof)
        if (c.maxY <= feetY + 0.42 || c.minY >= feetY + height - 0.05) {
          continue;
        }

        const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));

        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = radius - dist;
            pos.x += (dx / dist) * overlap;
            pos.z += (dz / dist) * overlap;
          } else {
            // Center inside AABB — push out along shallowest axis
            const penLeft = Math.abs(pos.x - c.minX);
            const penRight = Math.abs(c.maxX - pos.x);
            const penTop = Math.abs(pos.z - c.minZ);
            const penBot = Math.abs(c.maxZ - pos.z);
            const minPen = Math.min(penLeft, penRight, penTop, penBot);
            if (minPen === penLeft) pos.x = c.minX - radius;
            else if (minPen === penRight) pos.x = c.maxX + radius;
            else if (minPen === penTop) pos.z = c.minZ - radius;
            else pos.z = c.maxZ + radius;
          }
        }
      }
    }
  }

  function hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    _losDir.subVectors(to, from);
    const dist = _losDir.length();
    if (dist < 0.05) return true;
    _losDir.divideScalar(dist);
    _raycaster.set(from, _losDir);
    _raycaster.near = 0.1;
    _raycaster.far = dist - 0.2;
    const hits = _raycaster.intersectObjects(shootableMeshes, false);
    return hits.length === 0;
  }

  return {
    group,
    colliders,
    ramps,
    shootableMeshes,
    spawnPoints,
    patrolPoints,
    coverPoints,
    animatedLights,
    getGroundHeightAt,
    resolveHorizontalCollision,
    hasLineOfSight,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
