import * as THREE from 'three';
import { WEAPON_SPECS, WeaponId, WeaponRuntimeSummary } from './types';
import { SoundEngine } from './audio';
import { EffectsManager } from './effects';

interface WeaponInstance {
  id: WeaponId;
  group: THREE.Group;
  muzzlePoint: THREE.Object3D;
  ejectPoint: THREE.Object3D;
  hipPos: THREE.Vector3;
  adsPos: THREE.Vector3;
  ammo: number;
  magSize: number;
  reserve: number;
  damage: number;
  upgradeLevel: number;
  neonColor: number;
}

interface RimUniforms {
  uTime: { value: number };
}

const _muzzleWorld = new THREE.Vector3();
const _ejectWorld = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();

export class WeaponSystem {
  public rootGroup = new THREE.Group();
  public activeId: WeaponId = 'kuzgun';
  public isAds = false;
  public isReloading = false;
  public reloadProgress = 0;
  public currentSpread = 0;

  private instances: Record<WeaponId, WeaponInstance>;
  private muzzleLight: THREE.PointLight;
  private weaponRimLight: THREE.PointLight;
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleTimer = 0;

  private fireCooldown = 0;
  private reloadTimer = 0;
  private reloadHalfSoundPlayed = false;
  private recoilOffsetZ = 0;
  private recoilRotX = 0;
  private adsBlend = 0;
  private swayTime = 0;
  private shaderTime = 0;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private rimUniformSets: RimUniforms[] = [];
  private audio: SoundEngine;

  constructor(camera: THREE.PerspectiveCamera, audio: SoundEngine) {
    this.audio = audio;
    camera.add(this.rootGroup);

    const sharedTimeUniform = { value: 0 };
    this.rimUniformSets.push({ uTime: sharedTimeUniform });

    const makeRimMat = (
      baseColor: number,
      roughness: number,
      metalness: number,
      rimColorHex: number,
      rimPower: number,
      rimStrength: number,
      cacheKey: string
    ): THREE.MeshStandardMaterial => {
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness,
        metalness,
      });
      const rimCol = new THREE.Color(rimColorHex);
      mat.customProgramCacheKey = () => `sonhat-rim-${cacheKey}`;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uRimColor = { value: rimCol };
        shader.uniforms.uRimPower = { value: rimPower };
        shader.uniforms.uRimStrength = { value: rimStrength };
        shader.uniforms.uTime = sharedTimeUniform;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uRimColor;
          uniform float uRimPower;
          uniform float uRimStrength;
          uniform float uTime;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          vec3 rimViewDir = normalize(vViewPosition);
          float rimDot = 1.0 - clamp(dot(normalize(normal), rimViewDir), 0.0, 1.0);
          float rimFactor = pow(rimDot, uRimPower) * uRimStrength;
          float rimPulse = 0.9 + 0.1 * sin(uTime * 3.0);
          totalEmissiveRadiance += uRimColor * rimFactor * rimPulse;`
        );
      };
      return this.trackMat(mat);
    };

    // Cyan-rimmed materials for Kuzgun & Diken (with subtle secondary orange accent)
    const cyanMetal = makeRimMat(0x1e293b, 0.3, 0.86, 0x22d3ee, 2.3, 1.35, 'cyan-metal');
    const cyanPoly = makeRimMat(0x0f172a, 0.68, 0.25, 0x06b6d4, 2.6, 0.95, 'cyan-poly');
    const cyanSteel = makeRimMat(0x64748b, 0.22, 0.92, 0x38bdf8, 2.1, 1.15, 'cyan-steel');

    // Orange-rimmed materials for Sessiz Ok sniper
    const orangeMetal = makeRimMat(0x1e293b, 0.3, 0.86, 0xf97316, 2.2, 1.45, 'orange-metal');
    const orangePoly = makeRimMat(0x0f172a, 0.68, 0.25, 0xea580c, 2.5, 1.0, 'orange-poly');
    const orangeSteel = makeRimMat(0x64748b, 0.22, 0.92, 0xfb923c, 2.0, 1.2, 'orange-steel');

    const cyanGlow = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.4,
        roughness: 0.2,
      })
    );
    const orangeGlow = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xf97316,
        emissiveIntensity: 2.4,
        roughness: 0.2,
      })
    );
    const cyanOutlineMat = this.trackMat(
      new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45,
      })
    );
    const orangeOutlineMat = this.trackMat(
      new THREE.LineBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.5,
      })
    );

    const kuzgun = this.buildKuzgun(cyanMetal, cyanPoly, cyanSteel, cyanGlow, orangeGlow, cyanOutlineMat);
    const sessizOk = this.buildSessizOk(orangeMetal, orangePoly, orangeSteel, orangeGlow, cyanGlow, orangeOutlineMat);
    const diken = this.buildDiken(cyanMetal, cyanPoly, cyanSteel, cyanGlow, orangeGlow, cyanOutlineMat);

    this.instances = {
      kuzgun,
      sessiz_ok: sessizOk,
      diken,
    };

    Object.values(this.instances).forEach((w) => {
      w.group.visible = w.id === this.activeId;
      this.rootGroup.add(w.group);
    });

    // Dedicated viewmodel rim fill light matched to active weapon neon color
    this.weaponRimLight = new THREE.PointLight(0x22d3ee, 1.6, 2.2, 1.5);
    this.weaponRimLight.position.set(-0.25, 0.25, -0.2);
    this.rootGroup.add(this.weaponRimLight);

    // Shared muzzle flash & light
    const flashGeo = this.trackGeo(new THREE.OctahedronGeometry(0.065, 0));
    const flashMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfdba74,
        transparent: true,
        opacity: 0.92,
      })
    );
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.visible = false;
    this.rootGroup.add(this.muzzleFlashMesh);

    this.muzzleLight = new THREE.PointLight(0xf97316, 0, 8, 2);
    this.rootGroup.add(this.muzzleLight);
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private addPart(
    parent: THREE.Group,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    outlineMat?: THREE.LineBasicMaterial
  ): THREE.Mesh {
    this.trackGeo(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parent.add(m);

    if (outlineMat) {
      const edges = this.trackGeo(new THREE.EdgesGeometry(geo, 28));
      const line = new THREE.LineSegments(edges, outlineMat);
      line.scale.setScalar(1.012);
      m.add(line);
    }
    return m;
  }

  private buildKuzgun(
    metal: THREE.Material,
    poly: THREE.Material,
    steel: THREE.Material,
    primaryGlow: THREE.Material,
    secondaryGlow: THREE.Material,
    outlineMat: THREE.LineBasicMaterial
  ): WeaponInstance {
    const g = new THREE.Group();
    // Upper receiver & chassis with neon edge outline
    this.addPart(g, new THREE.BoxGeometry(0.068, 0.085, 0.44), metal, 0, 0, 0, 0, outlineMat);
    // Handguard shroud
    this.addPart(g, new THREE.BoxGeometry(0.062, 0.072, 0.24), poly, 0, 0.005, -0.32, 0, outlineMat);
    // Barrel
    this.addPart(g, new THREE.CylinderGeometry(0.013, 0.013, 0.28, 8), steel, 0, 0.014, -0.52, Math.PI / 2);
    // Muzzle brake
    this.addPart(g, new THREE.BoxGeometry(0.032, 0.032, 0.055), metal, 0, 0.014, -0.66, 0, outlineMat);
    // Pistol grip
    this.addPart(g, new THREE.BoxGeometry(0.044, 0.13, 0.058), poly, 0, -0.095, 0.11, 0.28);
    // Curved magazine + orange charge strip
    this.addPart(g, new THREE.BoxGeometry(0.042, 0.17, 0.072), metal, 0, -0.115, -0.07, -0.16, outlineMat);
    this.addPart(g, new THREE.BoxGeometry(0.044, 0.09, 0.012), secondaryGlow, 0, -0.11, -0.095, -0.16);
    // Stock
    this.addPart(g, new THREE.BoxGeometry(0.05, 0.08, 0.22), poly, 0, -0.01, 0.31, 0, outlineMat);
    // Reflex optic housing + cyan neon rail strips
    this.addPart(g, new THREE.BoxGeometry(0.052, 0.042, 0.09), metal, 0, 0.066, -0.02, 0, outlineMat);
    this.addPart(g, new THREE.BoxGeometry(0.008, 0.01, 0.28), primaryGlow, 0.036, 0.018, -0.12);
    this.addPart(g, new THREE.BoxGeometry(0.008, 0.01, 0.28), primaryGlow, -0.036, 0.018, -0.12);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.014, -0.7);
    g.add(muzzlePoint);

    const ejectPoint = new THREE.Object3D();
    ejectPoint.position.set(0.04, 0.02, -0.04);
    g.add(ejectPoint);

    const spec = WEAPON_SPECS.kuzgun;
    return {
      id: 'kuzgun',
      group: g,
      muzzlePoint,
      ejectPoint,
      hipPos: new THREE.Vector3(0.24, -0.22, -0.38),
      adsPos: new THREE.Vector3(0, -0.155, -0.31),
      ammo: spec.baseMagSize,
      magSize: spec.baseMagSize,
      reserve: spec.startReserve,
      damage: spec.baseDamage,
      upgradeLevel: 0,
      neonColor: 0x22d3ee,
    };
  }

  private buildSessizOk(
    metal: THREE.Material,
    poly: THREE.Material,
    steel: THREE.Material,
    primaryGlow: THREE.Material,
    secondaryGlow: THREE.Material,
    outlineMat: THREE.LineBasicMaterial
  ): WeaponInstance {
    const g = new THREE.Group();
    // Long sniper chassis with orange neon outline
    this.addPart(g, new THREE.BoxGeometry(0.064, 0.082, 0.52), poly, 0, 0, 0.04, 0, outlineMat);
    // Long fluted barrel
    this.addPart(g, new THREE.CylinderGeometry(0.014, 0.016, 0.56, 8), steel, 0, 0.016, -0.48, Math.PI / 2);
    // Heavy suppressor / muzzle
    this.addPart(g, new THREE.CylinderGeometry(0.026, 0.026, 0.16, 10), metal, 0, 0.016, -0.8, Math.PI / 2, outlineMat);
    // Scope tube + bell + glowing cyan optic ring
    this.addPart(g, new THREE.CylinderGeometry(0.024, 0.024, 0.28, 10), metal, 0, 0.078, -0.05, Math.PI / 2, outlineMat);
    this.addPart(g, new THREE.CylinderGeometry(0.032, 0.026, 0.06, 10), metal, 0, 0.078, -0.2, Math.PI / 2);
    this.addPart(g, new THREE.CylinderGeometry(0.028, 0.028, 0.014, 10), secondaryGlow, 0, 0.078, -0.175, Math.PI / 2);
    // Magazine
    this.addPart(g, new THREE.BoxGeometry(0.04, 0.11, 0.085), metal, 0, -0.08, -0.08, 0, outlineMat);
    // Grip & skeleton stock
    this.addPart(g, new THREE.BoxGeometry(0.042, 0.12, 0.054), poly, 0, -0.085, 0.16, 0.25);
    this.addPart(g, new THREE.BoxGeometry(0.046, 0.09, 0.24), metal, 0, -0.015, 0.38, 0, outlineMat);
    // Dual neon orange rail strips
    this.addPart(g, new THREE.BoxGeometry(0.008, 0.012, 0.38), primaryGlow, 0.034, 0.018, -0.06);
    this.addPart(g, new THREE.BoxGeometry(0.008, 0.012, 0.38), primaryGlow, -0.034, 0.018, -0.06);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.016, -0.9);
    g.add(muzzlePoint);

    const ejectPoint = new THREE.Object3D();
    ejectPoint.position.set(0.04, 0.02, 0.02);
    g.add(ejectPoint);

    const spec = WEAPON_SPECS.sessiz_ok;
    return {
      id: 'sessiz_ok',
      group: g,
      muzzlePoint,
      ejectPoint,
      hipPos: new THREE.Vector3(0.25, -0.23, -0.4),
      adsPos: new THREE.Vector3(0, -0.145, -0.28),
      ammo: spec.baseMagSize,
      magSize: spec.baseMagSize,
      reserve: spec.startReserve,
      damage: spec.baseDamage,
      upgradeLevel: 0,
      neonColor: 0xf97316,
    };
  }

  private buildDiken(
    metal: THREE.Material,
    poly: THREE.Material,
    steel: THREE.Material,
    primaryGlow: THREE.Material,
    secondaryGlow: THREE.Material,
    outlineMat: THREE.LineBasicMaterial
  ): WeaponInstance {
    const g = new THREE.Group();
    // Slide with cyan neon outline
    this.addPart(g, new THREE.BoxGeometry(0.042, 0.046, 0.24), metal, 0, 0.02, -0.02, 0, outlineMat);
    // Polymer lower frame
    this.addPart(g, new THREE.BoxGeometry(0.04, 0.032, 0.22), poly, 0, -0.015, -0.01, 0, outlineMat);
    // Extended barrel tip
    this.addPart(g, new THREE.CylinderGeometry(0.01, 0.01, 0.06, 8), steel, 0, 0.018, -0.16, Math.PI / 2);
    // Angled grip + orange bottom core
    this.addPart(g, new THREE.BoxGeometry(0.036, 0.115, 0.052), poly, 0, -0.075, 0.06, 0.26);
    this.addPart(g, new THREE.BoxGeometry(0.038, 0.012, 0.048), secondaryGlow, 0, -0.125, 0.073, 0.26);
    // Neon iron sights & side slide strips
    this.addPart(g, new THREE.BoxGeometry(0.012, 0.014, 0.012), secondaryGlow, 0, 0.048, -0.12);
    this.addPart(g, new THREE.BoxGeometry(0.03, 0.012, 0.01), primaryGlow, 0, 0.048, 0.08);
    this.addPart(g, new THREE.BoxGeometry(0.005, 0.008, 0.16), primaryGlow, 0.022, 0.024, -0.02);
    this.addPart(g, new THREE.BoxGeometry(0.005, 0.008, 0.16), primaryGlow, -0.022, 0.024, -0.02);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.018, -0.2);
    g.add(muzzlePoint);

    const ejectPoint = new THREE.Object3D();
    ejectPoint.position.set(0.028, 0.028, -0.01);
    g.add(ejectPoint);

    const spec = WEAPON_SPECS.diken;
    return {
      id: 'diken',
      group: g,
      muzzlePoint,
      ejectPoint,
      hipPos: new THREE.Vector3(0.22, -0.2, -0.34),
      adsPos: new THREE.Vector3(0, -0.145, -0.28),
      ammo: spec.baseMagSize,
      magSize: spec.baseMagSize,
      reserve: spec.startReserve,
      damage: spec.baseDamage,
      upgradeLevel: 0,
      neonColor: 0x22d3ee,
    };
  }

  public resetAll(): void {
    (Object.keys(this.instances) as WeaponId[]).forEach((id) => {
      const spec = WEAPON_SPECS[id];
      const w = this.instances[id];
      w.magSize = spec.baseMagSize;
      w.damage = spec.baseDamage;
      w.ammo = spec.baseMagSize;
      w.reserve = spec.startReserve;
      w.upgradeLevel = 0;
    });
    this.activeId = 'kuzgun';
    this.isAds = false;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadProgress = 0;
    this.fireCooldown = 0;
    this.adsBlend = 0;
    this.recoilOffsetZ = 0;
    this.recoilRotX = 0;
    this.syncVisibility();
  }

  private syncVisibility(): void {
    (Object.keys(this.instances) as WeaponId[]).forEach((id) => {
      this.instances[id].group.visible = id === this.activeId;
    });
    const active = this.instances[this.activeId];
    if (this.weaponRimLight && active) {
      this.weaponRimLight.color.setHex(active.neonColor);
    }
  }

  public switchWeapon(id: WeaponId): void {
    if (id === this.activeId) return;
    this.activeId = id;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadProgress = 0;
    this.fireCooldown = 0.18;
    this.recoilOffsetZ = 0.05;
    this.syncVisibility();
  }

  public cycleWeapon(delta: number): void {
    const order: WeaponId[] = ['kuzgun', 'sessiz_ok', 'diken'];
    const idx = order.indexOf(this.activeId);
    const next = (idx + (delta > 0 ? 1 : -1) + order.length) % order.length;
    this.switchWeapon(order[next]);
  }

  public getActiveInstance(): WeaponInstance {
    return this.instances[this.activeId];
  }

  public getActiveSpec() {
    return WEAPON_SPECS[this.activeId];
  }

  public startReload(): boolean {
    const w = this.getActiveInstance();
    if (this.isReloading) return false;
    if (w.ammo >= w.magSize || w.reserve <= 0) return false;
    this.isReloading = true;
    this.isAds = false;
    this.reloadTimer = WEAPON_SPECS[this.activeId].reloadTime;
    this.reloadProgress = 0;
    this.reloadHalfSoundPlayed = false;
    this.audio.playReload('out');
    return true;
  }

  public refillAllAmmo(): void {
    (Object.keys(this.instances) as WeaponId[]).forEach((id) => {
      const w = this.instances[id];
      w.reserve = WEAPON_SPECS[id].maxReserve;
      w.ammo = w.magSize;
    });
  }

  public upgradeWeapon(id: WeaponId): void {
    const w = this.instances[id];
    w.upgradeLevel += 1;
    w.damage = Math.round(WEAPON_SPECS[id].baseDamage * (1 + w.upgradeLevel * 0.1));
    w.magSize = WEAPON_SPECS[id].baseMagSize + w.upgradeLevel * 5;
    w.ammo = w.magSize;
    w.reserve = Math.min(WEAPON_SPECS[id].maxReserve, w.reserve + w.magSize);
  }

  public tryFire(
    effects: EffectsManager,
    camera: THREE.PerspectiveCamera
  ): { fired: boolean; damage: number; spread: number; recoilPitch: number; recoilYaw: number; muzzleWorld: THREE.Vector3 } | null {
    const w = this.getActiveInstance();
    const spec = WEAPON_SPECS[this.activeId];

    if (this.isReloading || this.fireCooldown > 0) return null;

    if (w.ammo <= 0) {
      this.fireCooldown = 0.25;
      this.audio.playEmptyClick();
      if (w.reserve > 0) this.startReload();
      return null;
    }

    w.ammo -= 1;
    this.fireCooldown = 1 / spec.fireRate;
    this.recoilOffsetZ = this.activeId === 'sessiz_ok' ? 0.085 : 0.045;
    this.recoilRotX = this.activeId === 'sessiz_ok' ? 0.14 : 0.07;

    this.audio.playShot(this.activeId);

    // Muzzle flash
    w.muzzlePoint.getWorldPosition(_muzzleWorld);
    this.muzzleTimer = 0.045;
    this.muzzleFlashMesh.position.copy(w.muzzlePoint.position).add(w.group.position);
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    this.muzzleFlashMesh.scale.setScalar(this.activeId === 'sessiz_ok' ? 1.45 : 0.95);
    this.muzzleFlashMesh.visible = true;
    this.muzzleLight.position.copy(this.muzzleFlashMesh.position);
    this.muzzleLight.intensity = 10;

    // Eject shell casing in world space
    w.ejectPoint.getWorldPosition(_ejectWorld);
    _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    effects.spawnShellCasing(_ejectWorld, _camRight, _camUp);

    const yawKick = (Math.random() - 0.5) * 2 * spec.recoilYaw;
    const pitchKick = spec.recoilPitch * (this.isAds ? 0.72 : 1.0);

    if (w.ammo === 0 && w.reserve > 0) {
      // Auto-trigger reload cleanly after a brief beat
      setTimeout(() => {
        if (!this.isReloading && w.ammo === 0 && w.reserve > 0) {
          this.startReload();
        }
      }, 140);
    }

    return {
      fired: true,
      damage: w.damage,
      spread: this.currentSpread,
      recoilPitch: pitchKick,
      recoilYaw: yawKick,
      muzzleWorld: _muzzleWorld.clone(),
    };
  }

  public update(
    dt: number,
    playerSpeed: number,
    isGrounded: boolean,
    isCrouching: boolean,
    camera: THREE.PerspectiveCamera,
    baseFov: number
  ): void {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.shaderTime += dt;
    for (let i = 0; i < this.rimUniformSets.length; i++) {
      this.rimUniformSets[i].uTime.value = this.shaderTime;
    }

    // Reload handling
    const w = this.getActiveInstance();
    const spec = WEAPON_SPECS[this.activeId];
    if (this.isReloading) {
      this.reloadTimer -= dt;
      this.reloadProgress = Math.max(0, Math.min(1, 1 - this.reloadTimer / spec.reloadTime));
      if (!this.reloadHalfSoundPlayed && this.reloadProgress >= 0.6) {
        this.reloadHalfSoundPlayed = true;
        this.audio.playReload('in');
      }
      if (this.reloadTimer <= 0) {
        const needed = w.magSize - w.ammo;
        const transfer = Math.min(needed, w.reserve);
        w.ammo += transfer;
        w.reserve -= transfer;
        this.isReloading = false;
        this.reloadProgress = 0;
      }
    }

    // ADS FOV & Viewmodel Position
    const targetAds = this.isAds && !this.isReloading ? 1 : 0;
    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, targetAds, 16, dt);

    const targetFov = THREE.MathUtils.lerp(baseFov, spec.adsFov, this.adsBlend);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    // Hide sniper 3D model when scoped in so scope reticle takes full sight
    if (this.activeId === 'sessiz_ok') {
      w.group.visible = this.adsBlend < 0.72;
    } else {
      w.group.visible = true;
    }

    // Spread calculation
    const moveFactor = Math.min(1, playerSpeed / 10);
    const airFactor = isGrounded ? 0 : 0.032;
    const crouchFactor = isCrouching ? 0.65 : 1.0;
    const base = THREE.MathUtils.lerp(spec.baseSpread, spec.adsSpread, this.adsBlend);
    this.currentSpread = (base + moveFactor * 0.018 + airFactor) * crouchFactor;

    // Viewmodel sway & recoil recovery
    this.recoilOffsetZ = THREE.MathUtils.damp(this.recoilOffsetZ, 0, 15, dt);
    this.recoilRotX = THREE.MathUtils.damp(this.recoilRotX, 0, 15, dt);

    if (playerSpeed > 0.8 && isGrounded) {
      this.swayTime += dt * (playerSpeed > 8.5 ? 11 : 7.5);
    } else {
      this.swayTime += dt * 1.4;
    }
    const swayAmt = (1 - this.adsBlend * 0.82) * (playerSpeed > 0.8 ? 0.008 : 0.002);
    const swayX = Math.cos(this.swayTime) * swayAmt;
    const swayY = Math.abs(Math.sin(this.swayTime)) * swayAmt;

    const reloadDip = this.isReloading ? Math.sin(this.reloadProgress * Math.PI) * 0.14 : 0;
    const reloadTilt = this.isReloading ? Math.sin(this.reloadProgress * Math.PI) * -0.45 : 0;

    w.group.position.set(
      THREE.MathUtils.lerp(w.hipPos.x, w.adsPos.x, this.adsBlend) + swayX,
      THREE.MathUtils.lerp(w.hipPos.y, w.adsPos.y, this.adsBlend) - swayY - reloadDip,
      THREE.MathUtils.lerp(w.hipPos.z, w.adsPos.z, this.adsBlend) + this.recoilOffsetZ
    );
    w.group.rotation.set(this.recoilRotX + reloadTilt, 0, 0);

    // Muzzle flash timer
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }
  }

  public getSummaries(): WeaponRuntimeSummary[] {
    return (['kuzgun', 'sessiz_ok', 'diken'] as WeaponId[]).map((id) => {
      const w = this.instances[id];
      return {
        id,
        name: WEAPON_SPECS[id].name,
        slot: WEAPON_SPECS[id].slot,
        ammo: w.ammo,
        magSize: w.magSize,
        reserve: w.reserve,
        damage: w.damage,
        upgradeLevel: w.upgradeLevel,
      };
    });
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
