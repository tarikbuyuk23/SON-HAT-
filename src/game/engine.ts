import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { createIndustrialMap, IndustrialMap } from './map';
import { PlayerController } from './player';
import { WeaponSystem } from './weapons';
import { EnemyManager } from './enemies';
import { EffectsManager } from './effects';
import {
  DamageIndicator,
  EnemyType,
  GameScreen,
  GameSettings,
  HudSnapshot,
  KillFeedEntry,
  SUPPLY_COSTS,
  WEAPON_SPECS,
  WeaponId,
} from './types';

const HIGHSCORE_KEY = 'son_hat_highscore_v1';

const _raycaster = new THREE.Raycaster();
const _camDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _spreadDir = new THREE.Vector3();
const _eyePos = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();

export class SonHatEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private audio: SoundEngine;
  private textures: ProceduralTextureSet;
  private map: IndustrialMap;
  private player: PlayerController;
  private weapons: WeaponSystem;
  private enemies: EnemyManager;
  private effects: EffectsManager;

  private screen: GameScreen = 'menu';
  private settings: GameSettings;
  private onHudUpdate: (snap: HudSnapshot) => void;

  private frameId = 0;
  private lastTime = 0;
  private elapsedMenuTime = 0;
  private hudEmitTimer = 0;
  private hitstopTimer = 0;
  private disposed = false;

  // Game session state
  private wave = 1;
  private score = 0;
  private highScore = 0;
  private isNewHighScore = false;
  private kills = 0;
  private headshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;

  private pendingSpawns: EnemyType[] = [];
  private spawnTimer = 0;
  private breakTimer = 0;

  // Input & feedback state
  private leftMouseDown = false;
  private autoFireHeld = false;
  private hitmarker: 'none' | 'body' | 'head' = 'none';
  private hitmarkerTimer = 0;
  private headshotBannerKey = 0;
  private damageFlash = 0;
  private damageIndicators: DamageIndicator[] = [];
  private killFeed: KillFeedEntry[] = [];
  private nextFeedId = 1;
  private nextDamageId = 1;
  private pointerLocked = false;

  // Bound event listeners
  private onResizeBound: () => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseUpBound: (e: MouseEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onContextMenuBound: (e: MouseEvent) => void;
  private onPointerLockChangeBound: () => void;
  private onBlurBound: () => void;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    onHudUpdate: (snap: HudSnapshot) => void
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.onHudUpdate = onHudUpdate;

    // Load saved high score
    try {
      const saved = Number(localStorage.getItem(HIGHSCORE_KEY) || '0');
      this.highScore = Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      this.highScore = 0;
    }

    // Detect software WebGL cleanly
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060b17);
    this.scene.fog = new THREE.FogExp2(0x060b17, 0.017);

    // Studio environment map for crisp metallic reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.08, 220);
    this.scene.add(this.camera);

    // 3-point atmospheric night lighting rig
    const hemi = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.65);
    this.scene.add(hemi);

    const moonKey = new THREE.DirectionalLight(0xcbd5e1, 1.35);
    moonKey.position.set(28, 48, 22);
    moonKey.castShadow = !this.isSoftwareGl;
    moonKey.shadow.mapSize.width = 1024;
    moonKey.shadow.mapSize.height = 1024;
    moonKey.shadow.camera.near = 5;
    moonKey.shadow.camera.far = 130;
    const d = 48;
    moonKey.shadow.camera.left = -d;
    moonKey.shadow.camera.right = d;
    moonKey.shadow.camera.top = d;
    moonKey.shadow.camera.bottom = -d;
    moonKey.shadow.bias = -0.0005;
    moonKey.shadow.normalBias = 0.02;
    this.scene.add(moonKey);

    const rimLight = new THREE.DirectionalLight(0xf97316, 0.45);
    rimLight.position.set(-34, 18, -32);
    this.scene.add(rimLight);

    // Subsystems
    this.audio = new SoundEngine();
    this.audio.setVolume(this.settings.volume);
    this.textures = createProceduralTextures(this.renderer);
    this.map = createIndustrialMap(this.textures);
    this.scene.add(this.map.group);

    this.effects = new EffectsManager(this.scene, this.textures.bulletHole);
    this.player = new PlayerController(this.camera, this.audio);
    this.weapons = new WeaponSystem(this.camera, this.audio);
    this.enemies = new EnemyManager(this.scene, this.audio);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.onResizeBound = () => this.handleResize();
    this.onKeyDownBound = (e) => this.handleKeyDown(e);
    this.onKeyUpBound = (e) => this.handleKeyUp(e);
    this.onMouseMoveBound = (e) => this.handleMouseMove(e);
    this.onMouseDownBound = (e) => this.handleMouseDown(e);
    this.onMouseUpBound = (e) => this.handleMouseUp(e);
    this.onWheelBound = (e) => this.handleWheel(e);
    this.onContextMenuBound = (e) => e.preventDefault();
    this.onPointerLockChangeBound = () => this.handlePointerLockChange();
    this.onBlurBound = () => this.handleWindowBlur();

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    window.addEventListener('wheel', this.onWheelBound, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenuBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.addEventListener('blur', this.onBlurBound);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    // Start loop
    this.lastTime = performance.now();
    this.emitHud();
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    this.audio.setVolume(this.settings.volume);
    if (!this.weapons.isAds) {
      this.camera.fov = this.settings.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  public requestPointerLock(): void {
    this.audio.unlock();
    try {
      this.renderer.domElement.requestPointerLock();
    } catch {
      // Fallback gracefully if pointer lock is blocked
    }
  }

  public startNewGame(): void {
    this.audio.unlock();
    this.player.reset();
    this.weapons.resetAll();
    this.enemies.clearAll();
    this.effects.clearTransient();

    this.wave = 1;
    this.score = 0;
    this.isNewHighScore = false;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.damageFlash = 0;
    this.damageIndicators = [];
    this.killFeed = [];
    this.hitmarker = 'none';
    this.leftMouseDown = false;
    this.autoFireHeld = false;

    this.screen = 'playing';
    this.startWave(1);
    this.requestPointerLock();
    this.emitHud();
  }

  public resumeGame(): void {
    if (this.screen === 'paused') {
      this.screen = 'playing';
      this.requestPointerLock();
      this.emitHud();
    }
  }

  public pauseGame(): void {
    if (this.screen === 'playing') {
      this.screen = 'paused';
      this.player.clearKeys();
      this.leftMouseDown = false;
      this.autoFireHeld = false;
      this.weapons.isAds = false;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.emitHud();
    }
  }

  public returnToMenu(): void {
    this.screen = 'menu';
    this.player.clearKeys();
    this.enemies.clearAll();
    this.effects.clearTransient();
    this.pendingSpawns = [];
    this.weapons.isAds = false;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.emitHud();
  }

  public skipBreakToNextWave(): void {
    if (this.screen !== 'break') return;
    this.wave += 1;
    this.screen = 'playing';
    this.startWave(this.wave);
    this.requestPointerLock();
    this.emitHud();
  }

  // Supply Crate Purchases
  public buyHeal(): boolean {
    if (this.score < SUPPLY_COSTS.heal || this.player.health >= this.player.maxHealth) return false;
    this.score -= SUPPLY_COSTS.heal;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 50);
    this.audio.playPurchase();
    this.emitHud();
    return true;
  }

  public buyAmmo(): boolean {
    if (this.score < SUPPLY_COSTS.ammo) return false;
    this.score -= SUPPLY_COSTS.ammo;
    this.weapons.refillAllAmmo();
    this.audio.playPurchase();
    this.emitHud();
    return true;
  }

  public buyArmor(): boolean {
    if (this.score < SUPPLY_COSTS.armor || this.player.armor >= this.player.maxArmor) return false;
    this.score -= SUPPLY_COSTS.armor;
    this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 50);
    this.audio.playPurchase();
    this.emitHud();
    return true;
  }

  public buyWeaponUpgrade(weaponId: WeaponId): boolean {
    const summary = this.weapons.getSummaries().find((w) => w.id === weaponId);
    if (!summary) return false;
    const cost = SUPPLY_COSTS.upgradeBase + summary.upgradeLevel * SUPPLY_COSTS.upgradeStep;
    if (this.score < cost) return false;
    this.score -= cost;
    this.weapons.upgradeWeapon(weaponId);
    this.audio.playPurchase();
    this.emitHud();
    return true;
  }

  private startWave(waveNum: number): void {
    this.pendingSpawns = [];
    const totalCount = 5 + waveNum * 2;
    for (let i = 0; i < totalCount; i++) {
      let type: EnemyType = 'asker';
      const r = Math.random();
      if (waveNum >= 3 && r < 0.22) {
        type = 'zirhli';
      } else if (waveNum >= 2 && r < 0.56) {
        type = 'avci';
      }
      this.pendingSpawns.push(type);
    }
    this.spawnTimer = 0.2;
    this.audio.playWaveStart();
  }

  private processSpawns(dt: number): void {
    if (this.pendingSpawns.length === 0) return;
    if (this.enemies.enemies.length >= 9) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const nextType = this.pendingSpawns.shift()!;
      // Choose a spawn point farthest from player
      let chosen = this.map.spawnPoints[0];
      let bestScore = -1;
      for (const sp of this.map.spawnPoints) {
        const d = sp.distanceTo(this.player.position);
        const jitter = d + Math.random() * 14;
        if (d > 14 && jitter > bestScore) {
          bestScore = jitter;
          chosen = sp;
        }
      }
      this.enemies.spawnEnemy(nextType, chosen, this.wave, this.map);
      this.spawnTimer = 0.55;
    }
  }

  private fireActiveWeapon(): void {
    const shot = this.weapons.tryFire(this.effects, this.camera);
    if (!shot) return;

    this.shotsFired += 1;
    this.player.addRecoil(shot.recoilPitch, shot.recoilYaw);
    this.enemies.alertByGunshot(this.player.position, 46);

    // Raycast from center of camera with weapon spread
    this.camera.getWorldPosition(_eyePos);
    this.camera.getWorldDirection(_camDir);
    _camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    _camUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);

    const spreadAngle = Math.random() * Math.PI * 2;
    const spreadMag = Math.random() * shot.spread;
    _spreadDir
      .copy(_camDir)
      .addScaledVector(_camRight, Math.cos(spreadAngle) * spreadMag)
      .addScaledVector(_camUp, Math.sin(spreadAngle) * spreadMag)
      .normalize();

    const spec = this.weapons.getActiveSpec();
    _raycaster.set(_eyePos, _spreadDir);
    _raycaster.near = 0.1;
    _raycaster.far = spec.range;

    const targets = [...this.map.shootableMeshes, ...this.enemies.hitMeshes];
    const hits = _raycaster.intersectObjects(targets, false);

    if (hits.length > 0) {
      const hit = hits[0];
      const hitEnemyId = hit.object.userData?.enemyId as number | undefined;

      this.effects.spawnTracer(
        shot.muzzleWorld,
        hit.point,
        this.weapons.activeId === 'sessiz_ok' ? 0x22d3ee : 0xfdba74
      );

      if (hitEnemyId !== undefined) {
        const isHead = hit.object.userData?.hitZone === 'head';
        const dmg = isHead ? shot.damage * 2 : shot.damage;
        this.shotsHit += 1;

        this.hitmarker = isHead ? 'head' : 'body';
        this.hitmarkerTimer = 0.16;
        this.audio.playHitmarker(isHead);

        if (isHead) {
          this.headshotBannerKey += 1;
        }

        _hitNormal.copy(_spreadDir).negate();
        this.effects.spawnSparks(hit.point, _hitNormal, isHead ? 12 : 7, isHead);

        const res = this.enemies.damageEnemy(hitEnemyId, dmg, _spreadDir, this.effects);
        if (res.killed && res.enemy) {
          this.kills += 1;
          if (isHead) this.headshots += 1;
          const bonus = isHead ? 50 : 0;
          this.score += res.enemy.scoreValue + bonus;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewHighScore = true;
            try {
              localStorage.setItem(HIGHSCORE_KEY, String(this.highScore));
            } catch {
              // ignore storage errors
            }
          }

          this.hitstopTimer = isHead || res.enemy.type === 'zirhli' ? 0.038 : 0.018;

          this.killFeed.unshift({
            id: this.nextFeedId++,
            weaponName: spec.name,
            enemyName: res.enemy.label,
            headshot: isHead,
            createdAt: performance.now(),
          });
          if (this.killFeed.length > 4) this.killFeed.pop();
        }
      } else {
        // World geometry impact (wall, container, floor, crate)
        if (hit.face) {
          _hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        } else {
          _hitNormal.copy(_spreadDir).negate();
        }
        this.effects.spawnBulletDecal(hit.point, _hitNormal);
        this.effects.spawnSparks(hit.point, _hitNormal, 6, false);
      }
    } else {
      const farPt = _eyePos.clone().addScaledVector(_spreadDir, 80);
      this.effects.spawnTracer(shot.muzzleWorld, farPt);
    }
  }

  private handlePlayerDamage(amount: number, attackerOrigin: THREE.Vector3): void {
    if (this.screen !== 'playing' && this.screen !== 'break') return;
    this.player.takeDamage(amount);
    this.damageFlash = 1.0;

    // Calculate relative angle to attacker for directional indicator
    const dx = attackerOrigin.x - this.player.position.x;
    const dz = attackerOrigin.z - this.player.position.z;
    const worldAngle = Math.atan2(dx, -dz); // angle where 0 is -Z (north)
    // Player forward when yaw=0 is -Z, rotating left (+yaw) turns forward toward -X
    const playerForwardAngle = -this.player.yaw;
    let relAngle = worldAngle - playerForwardAngle;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    this.damageIndicators.push({
      id: this.nextDamageId++,
      angle: relAngle,
      ttl: 1.0,
      maxTtl: 1.0,
    });
    if (this.damageIndicators.length > 5) this.damageIndicators.shift();

    if (this.player.health <= 0) {
      this.screen = 'gameover';
      this.player.clearKeys();
      this.leftMouseDown = false;
      this.autoFireHeld = false;
      this.weapons.isAds = false;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.emitHud();
    }
  }

  private tick(): void {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    // Subtle animated neon light flicker
    const tSec = now * 0.001;
    for (const al of this.map.animatedLights) {
      const flicker = Math.sin(tSec * al.speed + al.phase) * 0.14 + Math.sin(tSec * 19 + al.phase) * 0.06;
      al.light.intensity = al.baseIntensity * (1 + flicker);
    }

    if (this.screen === 'menu' || this.screen === 'gameover') {
      // Smooth atmospheric camera pan over the neon industrial yard
      this.elapsedMenuTime += dt;
      const angle = this.elapsedMenuTime * 0.14;
      const camR = 30;
      this.camera.position.set(Math.cos(angle) * camR, 12.5 + Math.sin(angle * 1.5) * 1.8, Math.sin(angle) * camR);
      this.camera.lookAt(0, 2.2, 0);
      this.weapons.rootGroup.visible = false;
      this.effects.update(dt);
    } else if (this.screen === 'playing' || this.screen === 'break') {
      this.weapons.rootGroup.visible = true;

      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.player.update(dt, this.map, this.weapons.isAds);
        this.weapons.update(
          dt,
          this.player.currentSpeed,
          this.player.isGrounded,
          this.player.isCrouching,
          this.camera,
          this.settings.fov
        );

        if (this.screen === 'playing') {
          if (this.autoFireHeld && WEAPON_SPECS[this.weapons.activeId].automatic && this.pointerLocked) {
            this.fireActiveWeapon();
          }

          this.processSpawns(dt);
          this.player.getEyePosition(_eyePos);
          this.enemies.update(dt, this.player.position, _eyePos, this.map, (dmg, origin) =>
            this.handlePlayerDamage(dmg, origin)
          );

          // Check wave completion
          if (this.pendingSpawns.length === 0 && this.enemies.enemies.length === 0) {
            this.screen = 'break';
            this.breakTimer = 15.0;
            this.leftMouseDown = false;
            this.autoFireHeld = false;
            this.weapons.isAds = false;
            this.player.clearKeys();
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
            this.emitHud();
          }
        } else if (this.screen === 'break') {
          this.breakTimer -= dt;
          if (this.breakTimer <= 0) {
            this.skipBreakToNextWave();
          }
        }

        this.effects.update(dt);
      }

      // Decay UI hitmarkers, damage flash, indicators & kill feed
      if (this.hitmarkerTimer > 0) {
        this.hitmarkerTimer -= dt;
        if (this.hitmarkerTimer <= 0) this.hitmarker = 'none';
      }
      if (this.damageFlash > 0) {
        this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
      }
      for (let i = this.damageIndicators.length - 1; i >= 0; i--) {
        this.damageIndicators[i].ttl -= dt;
        if (this.damageIndicators[i].ttl <= 0) {
          this.damageIndicators.splice(i, 1);
        }
      }
      const killExpire = now - 4500;
      if (this.killFeed.length > 0 && this.killFeed[this.killFeed.length - 1].createdAt < killExpire) {
        this.killFeed = this.killFeed.filter((k) => k.createdAt >= killExpire);
      }
    }

    this.renderer.render(this.scene, this.camera);

    // Throttled HUD snapshot emission (~24Hz for smooth bars/crosshair without React churn)
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.04) {
      this.hudEmitTimer = 0;
      if (this.screen === 'playing' || this.screen === 'break') {
        this.emitHud();
      }
    }

    this.scheduleNextFrame();
  }

  private emitHud(): void {
    const accuracy =
      this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0;

    this.onHudUpdate({
      screen: this.screen,
      health: Math.ceil(this.player.health),
      maxHealth: this.player.maxHealth,
      armor: Math.ceil(this.player.armor),
      maxArmor: this.player.maxArmor,
      wave: this.wave,
      score: this.score,
      highScore: this.highScore,
      remainingEnemies: this.enemies.enemies.length + this.pendingSpawns.length,
      breakTimeLeft: Math.max(0, Math.ceil(this.breakTimer)),
      activeWeaponId: this.weapons.activeId,
      weapons: this.weapons.getSummaries(),
      isReloading: this.weapons.isReloading,
      reloadProgress: this.weapons.reloadProgress,
      isAds: this.weapons.isAds,
      isCrouching: this.player.isCrouching,
      crosshairSpread: this.weapons.currentSpread,
      hitmarker: this.hitmarker,
      headshotBannerKey: this.headshotBannerKey,
      damageFlash: this.damageFlash,
      damageIndicators: this.damageIndicators.map((d) => ({ ...d })),
      killFeed: [...this.killFeed],
      pointerLocked: this.pointerLocked,
      stats: {
        wave: this.wave,
        score: this.score,
        highScore: this.highScore,
        kills: this.kills,
        headshots: this.headshots,
        shotsFired: this.shotsFired,
        shotsHit: this.shotsHit,
        accuracy,
        isNewHighScore: this.isNewHighScore,
      },
    });
  }

  // Event handlers
  private handleResize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.screen === 'playing' || this.screen === 'break') {
      if (e.ctrlKey || e.code === 'Space') {
        e.preventDefault();
      }
      this.player.keys.add(e.code);

      if (e.code === 'Space') {
        this.player.queueJump();
      } else if (e.code === 'KeyR') {
        this.weapons.startReload();
      } else if (e.code === 'Digit1') {
        this.weapons.switchWeapon('kuzgun');
      } else if (e.code === 'Digit2') {
        this.weapons.switchWeapon('sessiz_ok');
      } else if (e.code === 'Digit3') {
        this.weapons.switchWeapon('diken');
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.player.keys.delete(e.code);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.screen !== 'playing' || !this.pointerLocked) return;
    this.player.applyLookDelta(
      e.movementX,
      e.movementY,
      this.settings.sensitivity,
      this.weapons.isAds
    );
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.screen !== 'playing') return;

    // Only capture clicks on the canvas itself or when locked
    const target = e.target as HTMLElement | null;
    const isCanvas = target === this.renderer.domElement;

    if (!this.pointerLocked) {
      if (isCanvas) {
        this.requestPointerLock();
      }
      return;
    }

    if (e.button === 0) {
      this.leftMouseDown = true;
      this.autoFireHeld = true;
      this.fireActiveWeapon();
    } else if (e.button === 2) {
      this.weapons.isAds = true;
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.leftMouseDown = false;
      this.autoFireHeld = false;
    } else if (e.button === 2) {
      this.weapons.isAds = false;
    }
    void this.leftMouseDown;
  }

  private handleWheel(e: WheelEvent): void {
    if (this.screen !== 'playing' || !this.pointerLocked) return;
    if (Math.abs(e.deltaY) > 2) {
      this.weapons.cycleWeapon(e.deltaY);
    }
  }

  private handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked && this.screen === 'playing') {
      this.pauseGame();
    } else {
      this.emitHud();
    }
  }

  private handleWindowBlur(): void {
    this.player.clearKeys();
    this.leftMouseDown = false;
    this.autoFireHeld = false;
    this.weapons.isAds = false;
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    window.removeEventListener('wheel', this.onWheelBound);
    window.removeEventListener('contextmenu', this.onContextMenuBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.removeEventListener('blur', this.onBlurBound);

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    this.enemies.dispose();
    this.weapons.dispose();
    this.effects.dispose();
    this.map.dispose();
    this.textures.dispose();
    this.audio.dispose();

    if (this.scene.environment) {
      this.scene.environment.dispose();
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
