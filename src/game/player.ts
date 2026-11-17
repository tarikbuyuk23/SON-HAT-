import * as THREE from 'three';
import { IndustrialMap } from './map';
import { SoundEngine } from './audio';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();

export class PlayerController {
  public position = new THREE.Vector3(0, 0, 8); // feet position
  public velocity = new THREE.Vector3();
  public yaw = 0; // radians
  public pitch = 0; // radians
  public recoilPitch = 0;
  public recoilYaw = 0;

  public health = 100;
  public maxHealth = 100;
  public armor = 50;
  public maxArmor = 100;

  public isGrounded = true;
  public isCrouching = false;
  public isSprinting = false;
  public currentSpeed = 0;

  private eyeHeight = 1.7;
  private standEyeHeight = 1.7;
  private crouchEyeHeight = 1.12;
  private radius = 0.48;
  private standHeight = 1.85;
  private crouchHeight = 1.25;

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private bobTimer = 0;
  private footstepTimer = 0;

  public keys = new Set<string>();
  public camera: THREE.PerspectiveCamera;
  private audio: SoundEngine;

  constructor(camera: THREE.PerspectiveCamera, audio: SoundEngine) {
    this.camera = camera;
    this.audio = audio;
    this.camera.rotation.order = 'YXZ';
    this.syncCamera(0);
  }

  public reset(): void {
    this.position.set(0, 0, 8);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 50;
    this.maxArmor = 100;
    this.isGrounded = true;
    this.isCrouching = false;
    this.isSprinting = false;
    this.eyeHeight = this.standEyeHeight;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.bobTimer = 0;
    this.footstepTimer = 0;
    this.keys.clear();
    this.syncCamera(0);
  }

  public clearKeys(): void {
    this.keys.clear();
  }

  public queueJump(): void {
    this.jumpBufferTimer = 0.12;
  }

  public applyLookDelta(dx: number, dy: number, sensitivity: number, isAds: boolean): void {
    const adsScale = isAds ? 0.55 : 1.0;
    const scale = 0.0021 * sensitivity * adsScale;
    this.yaw -= dx * scale;
    this.pitch -= dy * scale;
    const maxPitch = Math.PI * 0.47;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  public addRecoil(pitchKick: number, yawKick: number): void {
    this.recoilPitch += pitchKick;
    this.recoilYaw += yawKick;
  }

  public takeDamage(amount: number): void {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.65);
      this.armor = Math.max(0, this.armor - absorbed);
      const remainder = amount - absorbed;
      this.health = Math.max(0, this.health - remainder);
    } else {
      this.health = Math.max(0, this.health - amount);
    }
    this.audio.playPlayerHurt();
  }

  public update(dt: number, map: IndustrialMap, isAds: boolean): void {
    const crouchHeld =
      this.keys.has('ControlLeft') ||
      this.keys.has('ControlRight') ||
      this.keys.has('KeyC');
    this.isCrouching = crouchHeld;

    const targetEye = this.isCrouching ? this.crouchEyeHeight : this.standEyeHeight;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 14, dt);

    const forwardInput =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafeInput =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

    const sprintHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.isSprinting = sprintHeld && forwardInput > 0 && !this.isCrouching && !isAds;

    let moveSpeed = 7.4;
    if (this.isCrouching) moveSpeed = 4.0;
    else if (isAds) moveSpeed = 4.6;
    else if (this.isSprinting) moveSpeed = 11.2;

    // Horizontal wish direction from yaw
    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _moveDir.set(0, 0, 0);
    _moveDir.addScaledVector(_forward, forwardInput);
    _moveDir.addScaledVector(_right, strafeInput);
    if (_moveDir.lengthSq() > 0.001) {
      _moveDir.normalize();
    }

    const accel = this.isGrounded ? 18 : 6.5;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, _moveDir.x * moveSpeed, accel, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, _moveDir.z * moveSpeed, accel, dt);

    // Coyote time & jump buffer
    if (this.isGrounded) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = 7.8;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
    }

    // Gravity
    this.velocity.y -= 21 * dt;

    // Move horizontally & resolve collisions
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    const playerHeight = this.isCrouching ? this.crouchHeight : this.standHeight;
    map.resolveHorizontalCollision(this.position, this.radius, this.position.y, playerHeight);

    // Vertical integration & ground/ramp height snapping
    this.position.y += this.velocity.y * dt;
    const groundY = map.getGroundHeightAt(this.position.x, this.position.z, this.position.y);

    if (this.position.y <= groundY) {
      this.position.y = groundY;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.isGrounded = true;
    } else if (this.isGrounded && this.position.y - groundY < 0.25 && this.velocity.y <= 0) {
      // Smoothly follow downward ramp slope
      this.position.y = groundY;
      this.velocity.y = 0;
    } else {
      this.isGrounded = false;
    }

    this.currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    // Head bob & footstep audio
    if (this.isGrounded && this.currentSpeed > 1.2) {
      const freq = this.isSprinting ? 13 : 9;
      this.bobTimer += dt * freq;
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.audio.playFootstep(this.isSprinting);
        this.footstepTimer = this.isSprinting ? 0.31 : 0.44;
      }
    } else {
      this.bobTimer = 0;
      this.footstepTimer = 0.08;
    }

    // Smooth recoil recovery
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 12, dt);
    this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 12, dt);

    this.syncCamera(dt);
  }

  public syncCamera(_dt: number): void {
    const bobOffset =
      this.isGrounded && this.currentSpeed > 1.2
        ? Math.sin(this.bobTimer) * (this.isSprinting ? 0.055 : 0.03)
        : 0;

    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight + bobOffset,
      this.position.z
    );

    const totalPitch = Math.max(
      -Math.PI * 0.48,
      Math.min(Math.PI * 0.48, this.pitch + this.recoilPitch)
    );
    this.camera.rotation.y = this.yaw + this.recoilYaw;
    this.camera.rotation.x = totalPitch;
    this.camera.rotation.z = 0;
  }

  public getEyePosition(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
  }
}
