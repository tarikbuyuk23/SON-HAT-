import * as THREE from 'three';
import { EnemyType } from './types';
import { IndustrialMap } from './map';
import { SoundEngine } from './audio';
import { EffectsManager } from './effects';

type AIState = 'patrol' | 'chase' | 'cover_fire';

interface EnemyStats {
  label: string;
  baseHp: number;
  speed: number;
  fireCooldown: number;
  damage: number;
  preferredRange: number;
  scoreValue: number;
  scale: number;
  bodyColor: number;
  accentColor: number;
}

const ENEMY_CONFIGS: Record<EnemyType, EnemyStats> = {
  asker: {
    label: 'Asker Bot',
    baseHp: 90,
    speed: 4.5,
    fireCooldown: 1.25,
    damage: 11,
    preferredRange: 17,
    scoreValue: 100,
    scale: 1.0,
    bodyColor: 0x263248,
    accentColor: 0xf97316,
  },
  avci: {
    label: 'Avcı Bot',
    baseHp: 68,
    speed: 7.4,
    fireCooldown: 0.88,
    damage: 9,
    preferredRange: 9,
    scoreValue: 135,
    scale: 0.92,
    bodyColor: 0x1e293b,
    accentColor: 0xef4444,
  },
  zirhli: {
    label: 'Zırhlı Birim',
    baseHp: 230,
    speed: 2.9,
    fireCooldown: 1.45,
    damage: 18,
    preferredRange: 14,
    scoreValue: 240,
    scale: 1.24,
    bodyColor: 0x334155,
    accentColor: 0xfbbf24,
  },
};

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  label: string;
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  gunArm: THREE.Group;
  muzzleObj: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  muzzleFlashTimer: number;
  bodyMaterial: THREE.MeshStandardMaterial;
  baseBodyColor: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  scoreValue: number;
  scale: number;
  state: AIState;
  patrolTarget: THREE.Vector3;
  coverTarget: THREE.Vector3 | null;
  fireTimer: number;
  burstRemaining: number;
  burstTimer: number;
  patrolElapsed: number;
  coverTimer: number;
  flashTimer: number;
  staggerVel: THREE.Vector3;
  walkPhase: number;
  spottedPlayer: boolean;
  hitMeshes: THREE.Mesh[];
}

interface EnemyProjectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  damage: number;
  life: number;
  origin: THREE.Vector3;
  active: boolean;
}

const _toPlayer = new THREE.Vector3();
const _moveTarget = new THREE.Vector3();
const _steer = new THREE.Vector3();
const _eyeFrom = new THREE.Vector3();
const _eyeTo = new THREE.Vector3();
const _projStep = new THREE.Vector3();
const _prevPos = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
const _seg = new THREE.Vector3();
const _toCenter = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _projDir = new THREE.Vector3();
const _muzzlePos = new THREE.Vector3();

export class EnemyManager {
  public enemies: EnemyEntity[] = [];
  public hitMeshes: THREE.Object3D[] = [];

  private scene: THREE.Scene;
  private audio: SoundEngine;
  private nextId = 1;

  private sharedGeos: THREE.BufferGeometry[] = [];
  private sharedMats: THREE.Material[] = [];
  private projectiles: EnemyProjectile[] = [];
  private projGeo: THREE.CylinderGeometry;
  private projMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, audio: SoundEngine) {
    this.scene = scene;
    this.audio = audio;

    // Pooled elongated glowing enemy tracer bolts
    this.projGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6);
    this.projMat = new THREE.MeshBasicMaterial({ color: 0xff453a });
    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(this.projGeo, this.projMat);
      m.visible = false;
      this.scene.add(m);
      this.projectiles.push({
        mesh: m,
        vel: new THREE.Vector3(),
        damage: 10,
        life: 0,
        origin: new THREE.Vector3(),
        active: false,
      });
    }
  }

  private createRobotMesh(
    id: number,
    type: EnemyType
  ): {
    group: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    gunArm: THREE.Group;
    muzzleObj: THREE.Object3D;
    muzzleFlash: THREE.Mesh;
    bodyMaterial: THREE.MeshStandardMaterial;
    hitMeshes: THREE.Mesh[];
  } {
    const cfg = ENEMY_CONFIGS[type];
    const group = new THREE.Group();
    const hitMeshes: THREE.Mesh[] = [];

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      roughness: 0.45,
      metalness: 0.72,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.55,
      metalness: 0.8,
    });
    const gunSteel = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.3,
      metalness: 0.88,
    });
    const eyeGlow = new THREE.MeshStandardMaterial({
      color: 0xff2e2e,
      emissive: 0xff1e1e,
      emissiveIntensity: 3.0,
      roughness: 0.2,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: cfg.accentColor,
      emissive: cfg.accentColor,
      emissiveIntensity: 1.2,
      roughness: 0.35,
      metalness: 0.5,
    });
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff9f43,
      transparent: true,
      opacity: 0.95,
    });
    this.sharedMats.push(bodyMaterial, darkMetal, gunSteel, eyeGlow, accentMat, flashMat);

    const registerHit = (mesh: THREE.Mesh, zone: 'head' | 'body') => {
      mesh.userData.enemyId = id;
      mesh.userData.hitZone = zone;
      mesh.castShadow = true;
      hitMeshes.push(mesh);
    };

    // Legs (bottom-center grounded at y=0)
    const legGeo = new THREE.BoxGeometry(0.22, 0.82, 0.24);
    this.sharedGeos.push(legGeo);
    const leftLeg = new THREE.Mesh(legGeo, darkMetal);
    leftLeg.position.set(-0.19, 0.41, 0);
    group.add(leftLeg);
    registerHit(leftLeg, 'body');

    const rightLeg = new THREE.Mesh(legGeo, darkMetal);
    rightLeg.position.set(0.19, 0.41, 0);
    group.add(rightLeg);
    registerHit(rightLeg, 'body');

    // Pelvis & Torso
    const torsoW = type === 'zirhli' ? 0.76 : type === 'avci' ? 0.5 : 0.6;
    const torsoGeo = new THREE.BoxGeometry(torsoW, 0.72, 0.36);
    this.sharedGeos.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
    torso.position.set(0, 1.18, 0);
    group.add(torso);
    registerHit(torso, 'body');

    // Chest reactor core
    const coreGeo = new THREE.BoxGeometry(0.22, 0.16, 0.08);
    this.sharedGeos.push(coreGeo);
    const core = new THREE.Mesh(coreGeo, accentMat);
    core.position.set(0, 1.24, 0.19);
    group.add(core);
    registerHit(core, 'body');

    // Shoulder pauldrons
    const pauldronGeo = new THREE.BoxGeometry(type === 'zirhli' ? 0.28 : 0.18, 0.24, 0.28);
    this.sharedGeos.push(pauldronGeo);
    const leftShoulder = new THREE.Mesh(pauldronGeo, bodyMaterial);
    leftShoulder.position.set(-(torsoW / 2 + 0.1), 1.44, 0);
    group.add(leftShoulder);
    registerHit(leftShoulder, 'body');

    const rightShoulder = new THREE.Mesh(pauldronGeo, bodyMaterial);
    rightShoulder.position.set(torsoW / 2 + 0.1, 1.44, 0);
    group.add(rightShoulder);
    registerHit(rightShoulder, 'body');

    // Left support arm
    const armGeo = new THREE.BoxGeometry(0.16, 0.56, 0.16);
    this.sharedGeos.push(armGeo);
    const leftArm = new THREE.Mesh(armGeo, darkMetal);
    leftArm.position.set(-(torsoW / 2 + 0.1), 1.08, 0.08);
    leftArm.rotation.x = -0.55;
    group.add(leftArm);
    registerHit(leftArm, 'body');

    // Right Gun Arm + Multi-Part 3D Weapon
    const gunArm = new THREE.Group();
    gunArm.position.set(torsoW / 2 + 0.12, 1.34, 0.06);

    const rightArmMesh = new THREE.Mesh(armGeo, darkMetal);
    rightArmMesh.position.set(0, -0.14, 0.22);
    rightArmMesh.rotation.x = -1.35;
    gunArm.add(rightArmMesh);
    registerHit(rightArmMesh, 'body');

    // Weapon Receiver
    const rxGeo = new THREE.BoxGeometry(0.13, 0.16, 0.52);
    this.sharedGeos.push(rxGeo);
    const receiver = new THREE.Mesh(rxGeo, gunSteel);
    receiver.position.set(0, -0.14, 0.45);
    gunArm.add(receiver);
    registerHit(receiver, 'body');

    // Weapon Barrel (twin barrels on Zırhlı)
    const barrelGeo = new THREE.CylinderGeometry(0.028, 0.03, 0.48, 8);
    this.sharedGeos.push(barrelGeo);
    if (type === 'zirhli') {
      const b1 = new THREE.Mesh(barrelGeo, darkMetal);
      b1.rotation.x = Math.PI / 2;
      b1.position.set(-0.038, -0.12, 0.85);
      gunArm.add(b1);
      const b2 = new THREE.Mesh(barrelGeo, darkMetal);
      b2.rotation.x = Math.PI / 2;
      b2.position.set(0.038, -0.12, 0.85);
      gunArm.add(b2);
    } else {
      const barrel = new THREE.Mesh(barrelGeo, darkMetal);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, -0.12, 0.84);
      gunArm.add(barrel);
    }

    // Magazine
    const magGeo = new THREE.BoxGeometry(0.08, 0.2, 0.14);
    this.sharedGeos.push(magGeo);
    const mag = new THREE.Mesh(magGeo, darkMetal);
    mag.position.set(0, -0.28, 0.44);
    mag.rotation.x = 0.18;
    gunArm.add(mag);

    // Glowing Neon Weapon Core Strip
    const stripGeo = new THREE.BoxGeometry(0.14, 0.035, 0.38);
    this.sharedGeos.push(stripGeo);
    const gunStrip = new THREE.Mesh(stripGeo, accentMat);
    gunStrip.position.set(0, -0.07, 0.48);
    gunArm.add(gunStrip);

    // Muzzle Point & Visible Muzzle Flash
    const muzzleObj = new THREE.Object3D();
    muzzleObj.position.set(0, -0.12, 1.12);
    gunArm.add(muzzleObj);

    const flashGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.sharedGeos.push(flashGeo);
    const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.position.copy(muzzleObj.position);
    muzzleFlash.visible = false;
    gunArm.add(muzzleFlash);

    group.add(gunArm);

    // Head + Glowing Red Eyes (Dedicated Headshot Hitbox!)
    const headGeo = new THREE.BoxGeometry(0.36, 0.34, 0.34);
    this.sharedGeos.push(headGeo);
    const head = new THREE.Mesh(headGeo, bodyMaterial);
    head.position.set(0, 1.75, 0);
    group.add(head);
    registerHit(head, 'head');

    // Glowing red visor / eyes
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.06, 0.06);
    this.sharedGeos.push(eyeGeo);
    const leftEye = new THREE.Mesh(eyeGeo, eyeGlow);
    leftEye.position.set(-0.08, 1.77, 0.17);
    group.add(leftEye);
    registerHit(leftEye, 'head');

    const rightEye = new THREE.Mesh(eyeGeo, eyeGlow);
    rightEye.position.set(0.08, 1.77, 0.17);
    group.add(rightEye);
    registerHit(rightEye, 'head');

    // Antenna fin on Avcı / Zırhlı
    if (type !== 'asker') {
      const finGeo = new THREE.BoxGeometry(0.06, 0.22, 0.18);
      this.sharedGeos.push(finGeo);
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.position.set(0, 1.98, -0.02);
      group.add(fin);
      registerHit(fin, 'head');
    }

    group.scale.setScalar(cfg.scale);
    return { group, leftLeg, rightLeg, gunArm, muzzleObj, muzzleFlash, bodyMaterial, hitMeshes };
  }

  public spawnEnemy(type: EnemyType, pos: THREE.Vector3, wave: number, map: IndustrialMap): void {
    const id = this.nextId++;
    const cfg = ENEMY_CONFIGS[type];
    const hpScale = 1 + (wave - 1) * 0.14;
    const maxHp = Math.round(cfg.baseHp * hpScale);

    const built = this.createRobotMesh(id, type);
    built.group.position.copy(pos);
    this.scene.add(built.group);

    const patrolTarget =
      map.patrolPoints[Math.floor(Math.random() * map.patrolPoints.length)].clone();

    const entity: EnemyEntity = {
      id,
      type,
      label: cfg.label,
      group: built.group,
      leftLeg: built.leftLeg,
      rightLeg: built.rightLeg,
      gunArm: built.gunArm,
      muzzleObj: built.muzzleObj,
      muzzleFlash: built.muzzleFlash,
      muzzleFlashTimer: 0,
      bodyMaterial: built.bodyMaterial,
      baseBodyColor: cfg.bodyColor,
      hp: maxHp,
      maxHp,
      speed: cfg.speed + Math.min(1.6, (wave - 1) * 0.12),
      damage: Math.round(cfg.damage * (1 + (wave - 1) * 0.07)),
      scoreValue: cfg.scoreValue,
      scale: cfg.scale,
      state: 'patrol',
      patrolTarget,
      coverTarget: null,
      fireTimer: 0.45 + Math.random() * 0.55,
      burstRemaining: 0,
      burstTimer: 0,
      patrolElapsed: 0,
      coverTimer: 0,
      flashTimer: 0,
      staggerVel: new THREE.Vector3(),
      walkPhase: Math.random() * Math.PI * 2,
      spottedPlayer: false,
      hitMeshes: built.hitMeshes,
    };

    this.enemies.push(entity);
    this.rebuildHitMeshes();
  }

  public alertByGunshot(origin: THREE.Vector3, radius = 46): void {
    const rSq = radius * radius;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.spottedPlayer && e.group.position.distanceToSquared(origin) <= rSq) {
        e.spottedPlayer = true;
      }
    }
  }

  private rebuildHitMeshes(): void {
    this.hitMeshes.length = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const list = this.enemies[i].hitMeshes;
      for (let j = 0; j < list.length; j++) {
        this.hitMeshes.push(list[j]);
      }
    }
  }

  public damageEnemy(
    enemyId: number,
    damage: number,
    hitDir: THREE.Vector3,
    effects: EffectsManager
  ): { killed: boolean; enemy: EnemyEntity | null } {
    const idx = this.enemies.findIndex((e) => e.id === enemyId);
    if (idx === -1) return { killed: false, enemy: null };

    const enemy = this.enemies[idx];
    enemy.hp -= damage;
    enemy.spottedPlayer = true;
    enemy.flashTimer = 0.12;
    enemy.bodyMaterial.emissive.setHex(0xff2222);
    enemy.bodyMaterial.emissiveIntensity = 1.6;

    // Knockback stagger impulse
    const kbStrength = enemy.type === 'zirhli' ? 2.4 : 4.8;
    enemy.staggerVel.set(hitDir.x * kbStrength, 0, hitDir.z * kbStrength);

    if (enemy.hp <= 0) {
      effects.spawnRobotExplosion(enemy.group.position, enemy.scale);
      this.audio.playEnemyDeath();
      this.scene.remove(enemy.group);
      this.enemies.splice(idx, 1);
      this.rebuildHitMeshes();
      return { killed: true, enemy };
    }

    return { killed: false, enemy };
  }

  private spawnProjectile(origin: THREE.Vector3, target: THREE.Vector3, damage: number): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) {
        p.active = true;
        p.life = 2.6;
        p.damage = damage;
        p.origin.copy(origin);
        p.mesh.position.copy(origin);
        _projDir.subVectors(target, origin).normalize();
        p.vel.copy(_projDir).multiplyScalar(32);
        p.mesh.quaternion.setFromUnitVectors(_upAxis, _projDir);
        p.mesh.visible = true;
        break;
      }
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerEye: THREE.Vector3,
    map: IndustrialMap,
    onPlayerHit: (damage: number, attackerOrigin: THREE.Vector3) => void
  ): void {
    // Update AI robots
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];

      // Hit flash decay
      if (e.flashTimer > 0) {
        e.flashTimer -= dt;
        if (e.flashTimer <= 0) {
          e.bodyMaterial.emissive.setHex(0x000000);
          e.bodyMaterial.emissiveIntensity = 0;
        }
      }

      // Gun muzzle flash decay
      if (e.muzzleFlashTimer > 0) {
        e.muzzleFlashTimer -= dt;
        if (e.muzzleFlashTimer <= 0) {
          e.muzzleFlash.visible = false;
        }
      }

      // Stagger decay
      if (e.staggerVel.lengthSq() > 0.01) {
        e.group.position.addScaledVector(e.staggerVel, dt);
        e.staggerVel.multiplyScalar(Math.exp(-10 * dt));
      }

      _toPlayer.subVectors(playerPos, e.group.position);
      _toPlayer.y = 0;
      const distToPlayer = _toPlayer.length();

      _eyeFrom.set(e.group.position.x, e.group.position.y + 1.65 * e.scale, e.group.position.z);
      const canSeePlayer = distToPlayer < 55 && map.hasLineOfSight(_eyeFrom, playerEye);

      if (canSeePlayer || distToPlayer < 20) {
        e.spottedPlayer = true;
      } else if (!e.spottedPlayer) {
        e.patrolElapsed += dt;
        if (e.patrolElapsed > 4.5) {
          e.spottedPlayer = true;
        }
      }

      const cfg = ENEMY_CONFIGS[e.type];

      // State transitions
      if (!e.spottedPlayer) {
        e.state = 'patrol';
      } else if (canSeePlayer && distToPlayer <= cfg.preferredRange + 4) {
        e.state = 'cover_fire';
      } else {
        e.state = 'chase';
      }

      // Movement target selection
      let moveSpeed = e.speed;
      if (e.state === 'patrol') {
        moveSpeed = e.speed * 0.55;
        if (e.group.position.distanceTo(e.patrolTarget) < 1.8) {
          e.patrolTarget.copy(
            map.patrolPoints[Math.floor(Math.random() * map.patrolPoints.length)]
          );
        }
        _moveTarget.copy(e.patrolTarget);
      } else if (e.state === 'chase') {
        _moveTarget.copy(playerPos);
      } else {
        // cover_fire: strafe or duck toward nearest cover point
        e.coverTimer -= dt;
        if (e.coverTimer <= 0 || !e.coverTarget) {
          e.coverTimer = 2.2 + Math.random() * 1.4;
          let bestCover: THREE.Vector3 | null = null;
          let bestScore = Infinity;
          for (let c = 0; c < map.coverPoints.length; c++) {
            const cp = map.coverPoints[c];
            const dEnemy = cp.distanceTo(e.group.position);
            if (dEnemy < 14 && dEnemy > 1.5 && dEnemy < bestScore) {
              bestScore = dEnemy;
              bestCover = cp;
            }
          }
          if (bestCover && Math.random() < 0.65) {
            e.coverTarget = bestCover.clone();
          } else {
            const side = Math.random() < 0.5 ? 1 : -1;
            const perpX = (-_toPlayer.z / Math.max(0.1, distToPlayer)) * side * 3.5;
            const perpZ = (_toPlayer.x / Math.max(0.1, distToPlayer)) * side * 3.5;
            e.coverTarget = new THREE.Vector3(e.group.position.x + perpX, 0, e.group.position.z + perpZ);
          }
        }
        _moveTarget.copy(e.coverTarget);
        moveSpeed = e.speed * 0.72;
      }

      // Move toward target
      _steer.subVectors(_moveTarget, e.group.position);
      _steer.y = 0;
      const steerDist = _steer.length();
      let isMoving = false;
      if (steerDist > 0.65 && (e.state !== 'cover_fire' || steerDist > 0.8)) {
        _steer.divideScalar(steerDist);
        e.group.position.addScaledVector(_steer, moveSpeed * dt);
        isMoving = true;
      }

      // Separation from other robots so they don't stack
      for (let j = 0; j < this.enemies.length; j++) {
        if (i === j) continue;
        const other = this.enemies[j];
        const dx = e.group.position.x - other.group.position.x;
        const dz = e.group.position.z - other.group.position.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < 1.8 && dSq > 0.0001) {
          const d = Math.sqrt(dSq);
          const push = (1.35 - d) * 3.5 * dt;
          e.group.position.x += (dx / d) * push;
          e.group.position.z += (dz / d) * push;
        }
      }

      // Map collision + ground height
      map.resolveHorizontalCollision(e.group.position, 0.55 * e.scale, e.group.position.y, 1.9 * e.scale);
      e.group.position.y = map.getGroundHeightAt(e.group.position.x, e.group.position.z, e.group.position.y);

      // Facing direction
      const lookVec = e.spottedPlayer ? _toPlayer : _steer;
      if (lookVec.lengthSq() > 0.001) {
        const targetAngle = Math.atan2(lookVec.x, lookVec.z);
        let diff = targetAngle - e.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.group.rotation.y += diff * Math.min(1, 10 * dt);
      }

      // Leg walk animation
      if (isMoving) {
        e.walkPhase += dt * moveSpeed * 2.2;
        const swing = Math.sin(e.walkPhase) * 0.48;
        e.leftLeg.rotation.x = swing;
        e.rightLeg.rotation.x = -swing;
      } else {
        e.leftLeg.rotation.x = THREE.MathUtils.damp(e.leftLeg.rotation.x, 0, 10, dt);
        e.rightLeg.rotation.x = THREE.MathUtils.damp(e.rightLeg.rotation.x, 0, 10, dt);
      }

      // Gun arm pitch aim & burst firing
      const shoulderY = e.group.position.y + 1.3 * e.scale;
      const desiredPitch = canSeePlayer
        ? -Math.atan2(playerEye.y - 0.15 - shoulderY, Math.max(0.5, distToPlayer))
        : 0.15;

      if (canSeePlayer) {
        if (e.burstRemaining <= 0) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.burstRemaining = e.type === 'zirhli' ? 3 : 2;
            e.burstTimer = 0;
            e.fireTimer = cfg.fireCooldown * (0.75 + Math.random() * 0.35);
          }
        }

        if (e.burstRemaining > 0) {
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            e.burstRemaining -= 1;
            e.burstTimer = e.type === 'avci' ? 0.11 : 0.15;

            e.muzzleObj.getWorldPosition(_muzzlePos);
            _eyeTo.copy(playerEye);
            _eyeTo.x += (Math.random() - 0.5) * 0.65;
            _eyeTo.y += (Math.random() - 0.5) * 0.45 - 0.2;
            _eyeTo.z += (Math.random() - 0.5) * 0.65;

            this.spawnProjectile(_muzzlePos, _eyeTo, e.damage);
            this.audio.playEnemyShot(distToPlayer);

            // Visible muzzle flash & gun recoil kick
            e.muzzleFlash.visible = true;
            e.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
            e.muzzleFlash.scale.setScalar(0.85 + Math.random() * 0.4);
            e.muzzleFlashTimer = 0.065;
            e.gunArm.rotation.x = desiredPitch - 0.22;
          }
        }
      } else {
        e.burstRemaining = 0;
      }

      e.gunArm.rotation.x = THREE.MathUtils.damp(e.gunArm.rotation.x, desiredPitch, 12, dt);
    }

    // Update enemy tracer projectiles with swept segment-vs-player collision
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      _prevPos.copy(p.mesh.position);
      _projStep.copy(p.vel).multiplyScalar(dt);
      _nextPos.copy(_prevPos).add(_projStep);

      // Swept segment-to-player-axis check so bullets never tunnel
      _seg.subVectors(_nextPos, _prevPos);
      const segLenSq = _seg.lengthSq();
      let t = 0;
      if (segLenSq > 0.00001) {
        _toCenter.subVectors(playerPos, _prevPos);
        t = Math.max(0, Math.min(1, (_toCenter.x * _seg.x + _toCenter.z * _seg.z) / (_seg.x * _seg.x + _seg.z * _seg.z + 0.00001)));
      }
      _closest.copy(_prevPos).addScaledVector(_seg, t);
      const dx = _closest.x - playerPos.x;
      const dz = _closest.z - playerPos.z;
      const horizDistSq = dx * dx + dz * dz;

      if (
        horizDistSq < 0.62 * 0.62 &&
        _closest.y >= playerPos.y &&
        _closest.y <= playerEye.y + 0.3
      ) {
        p.active = false;
        p.mesh.visible = false;
        onPlayerHit(p.damage, p.origin);
        continue;
      }

      // Check wall hit
      if (!map.hasLineOfSight(_prevPos, _nextPos)) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.copy(_nextPos);
    }
  }

  public clearAll(): void {
    for (const e of this.enemies) {
      this.scene.remove(e.group);
    }
    this.enemies.length = 0;
    this.hitMeshes.length = 0;
    for (const p of this.projectiles) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  public dispose(): void {
    this.clearAll();
    this.projGeo.dispose();
    this.projMat.dispose();
    for (const g of this.sharedGeos) g.dispose();
    for (const m of this.sharedMats) m.dispose();
  }
}
