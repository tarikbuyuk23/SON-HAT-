import * as THREE from 'three';

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface TracerBeam {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  active: boolean;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  active: boolean;
}

interface DebrisChunk {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export class EffectsManager {
  private scene: THREE.Scene;

  private decalPool: THREE.Mesh[] = [];
  private decalIndex = 0;
  private decalGeo: THREE.PlaneGeometry;
  private decalMat: THREE.MeshBasicMaterial;

  private sparks: SparkParticle[] = [];
  private sparkGeo: THREE.BoxGeometry;
  private sparkMatOrange: THREE.MeshBasicMaterial;
  private sparkMatCyan: THREE.MeshBasicMaterial;

  private tracers: TracerBeam[] = [];
  private tracerGeo: THREE.CylinderGeometry;

  private shells: ShellCasing[] = [];
  private shellGeo: THREE.CylinderGeometry;
  private shellMat: THREE.MeshStandardMaterial;

  private debris: DebrisChunk[] = [];
  private debrisGeo: THREE.BoxGeometry;
  private debrisMatDark: THREE.MeshStandardMaterial;
  private debrisMatAccent: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, bulletHoleTex: THREE.CanvasTexture) {
    this.scene = scene;

    // Pooled bullet impact decals
    this.decalGeo = new THREE.PlaneGeometry(0.24, 0.24);
    this.decalMat = new THREE.MeshBasicMaterial({
      map: bulletHoleTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(this.decalGeo, this.decalMat);
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      this.decalPool.push(m);
    }

    // Pooled sparks
    this.sparkGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
    this.sparkMatOrange = new THREE.MeshBasicMaterial({ color: 0xff8c2b });
    this.sparkMatCyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    for (let i = 0; i < 110; i++) {
      const m = new THREE.Mesh(this.sparkGeo, i % 3 === 0 ? this.sparkMatCyan : this.sparkMatOrange);
      m.visible = false;
      this.scene.add(m);
      this.sparks.push({
        mesh: m,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.3,
        active: false,
      });
    }

    // Pooled tracer beams
    this.tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfdba74,
        transparent: true,
        opacity: 0.85,
      });
      const m = new THREE.Mesh(this.tracerGeo, mat);
      m.visible = false;
      this.scene.add(m);
      this.tracers.push({
        mesh: m,
        life: 0,
        maxLife: 0.07,
        active: false,
      });
    }

    // Pooled shell casings
    this.shellGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.048, 6);
    this.shellMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.85,
    });
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(this.shellGeo, this.shellMat);
      m.visible = false;
      this.scene.add(m);
      this.shells.push({
        mesh: m,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        active: false,
      });
    }

    // Pooled robot death debris chunks
    this.debrisGeo = new THREE.BoxGeometry(0.28, 0.24, 0.26);
    this.debrisMatDark = new THREE.MeshStandardMaterial({
      color: 0x273449,
      roughness: 0.45,
      metalness: 0.75,
    });
    this.debrisMatAccent = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0x9a3412,
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.6,
    });
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(
        this.debrisGeo,
        i % 4 === 0 ? this.debrisMatAccent : this.debrisMatDark
      );
      m.visible = false;
      m.castShadow = false;
      this.scene.add(m);
      this.debris.push({
        mesh: m,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.5,
        active: false,
      });
    }
  }

  public spawnBulletDecal(point: THREE.Vector3, normal: THREE.Vector3): void {
    const decal = this.decalPool[this.decalIndex];
    this.decalIndex = (this.decalIndex + 1) % this.decalPool.length;

    decal.position.copy(point).addScaledVector(normal, 0.016);
    _quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    decal.quaternion.copy(_quat);
    decal.rotateZ(Math.random() * Math.PI * 2);
    const s = 0.8 + Math.random() * 0.45;
    decal.scale.set(s, s, 1);
    decal.visible = true;
  }

  public spawnSparks(point: THREE.Vector3, normal: THREE.Vector3, count = 8, isCyan = false): void {
    let spawned = 0;
    for (let i = 0; i < this.sparks.length && spawned < count; i++) {
      const p = this.sparks[i];
      if (!p.active) {
        p.active = true;
        p.life = 0.22 + Math.random() * 0.2;
        p.maxLife = p.life;
        p.mesh.position.copy(point);
        p.mesh.material = isCyan ? this.sparkMatCyan : this.sparkMatOrange;
        p.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
        p.mesh.visible = true;

        p.vel.set(
          normal.x * (2.5 + Math.random() * 4) + (Math.random() - 0.5) * 4.5,
          normal.y * (2.5 + Math.random() * 4) + Math.random() * 3.5,
          normal.z * (2.5 + Math.random() * 4) + (Math.random() - 0.5) * 4.5
        );
        spawned++;
      }
    }
  }

  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex = 0xfdba74): void {
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) {
        _dir.subVectors(end, start);
        const len = _dir.length();
        if (len < 0.2) return;
        _dir.normalize();
        _mid.addVectors(start, end).multiplyScalar(0.5);

        t.active = true;
        t.maxLife = 0.065;
        t.life = t.maxLife;
        t.mesh.position.copy(_mid);
        t.mesh.scale.set(1, len, 1);
        t.mesh.quaternion.setFromUnitVectors(_up, _dir);
        const mat = t.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = 0.85;
        t.mesh.visible = true;
        break;
      }
    }
  }

  public spawnShellCasing(origin: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3): void {
    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (!s.active) {
        s.active = true;
        s.life = 1.1;
        s.mesh.position.copy(origin);
        s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        s.mesh.visible = true;
        s.vel
          .copy(right)
          .multiplyScalar(2.4 + Math.random() * 1.1)
          .addScaledVector(up, 1.8 + Math.random() * 0.9);
        s.rotVel.set(
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 24
        );
        break;
      }
    }
  }

  public spawnRobotExplosion(center: THREE.Vector3, scale = 1): void {
    let spawned = 0;
    const count = 10;
    for (let i = 0; i < this.debris.length && spawned < count; i++) {
      const d = this.debris[i];
      if (!d.active) {
        d.active = true;
        d.maxLife = 1.4 + Math.random() * 0.6;
        d.life = d.maxLife;
        d.mesh.position.set(
          center.x + (Math.random() - 0.5) * 0.6,
          center.y + 0.5 + Math.random() * 1.0,
          center.z + (Math.random() - 0.5) * 0.6
        );
        d.mesh.scale.set(
          (0.6 + Math.random() * 0.9) * scale,
          (0.5 + Math.random() * 0.8) * scale,
          (0.6 + Math.random() * 0.9) * scale
        );
        d.mesh.visible = true;
        d.vel.set(
          (Math.random() - 0.5) * 8.5,
          3.2 + Math.random() * 5.2,
          (Math.random() - 0.5) * 8.5
        );
        d.rotVel.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14
        );
        spawned++;
      }
    }
    this.spawnSparks(new THREE.Vector3(center.x, center.y + 1.0, center.z), _up, 16, false);
  }

  public update(dt: number): void {
    for (let i = 0; i < this.sparks.length; i++) {
      const p = this.sparks[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const ratio = p.life / p.maxLife;
      p.mesh.scale.setScalar(ratio);
    }

    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
        continue;
      }
      const mat = t.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (t.life / t.maxLife) * 0.85;
    }

    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      s.vel.y -= 15 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.rotVel.x * dt;
      s.mesh.rotation.y += s.rotVel.y * dt;
      s.mesh.rotation.z += s.rotVel.z * dt;
      if (s.mesh.position.y < 0.03) {
        s.mesh.position.y = 0.03;
        s.vel.y = Math.abs(s.vel.y) * 0.42;
        s.vel.x *= 0.72;
        s.vel.z *= 0.72;
      }
    }

    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.vel.y -= 18 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;
      if (d.mesh.position.y < 0.14) {
        d.mesh.position.y = 0.14;
        d.vel.y = Math.abs(d.vel.y) * 0.35;
        d.vel.x *= 0.75;
        d.vel.z *= 0.75;
        d.rotVel.multiplyScalar(0.75);
      }
      if (d.life < 0.35) {
        d.mesh.scale.multiplyScalar(0.92);
      }
    }
  }

  public clearTransient(): void {
    for (const d of this.decalPool) d.visible = false;
    for (const p of this.sparks) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
    for (const s of this.shells) {
      s.active = false;
      s.mesh.visible = false;
    }
    for (const d of this.debris) {
      d.active = false;
      d.mesh.visible = false;
    }
  }

  public dispose(): void {
    this.decalGeo.dispose();
    this.decalMat.dispose();
    this.sparkGeo.dispose();
    this.sparkMatOrange.dispose();
    this.sparkMatCyan.dispose();
    this.tracerGeo.dispose();
    for (const t of this.tracers) {
      (t.mesh.material as THREE.Material).dispose();
    }
    this.shellGeo.dispose();
    this.shellMat.dispose();
    this.debrisGeo.dispose();
    this.debrisMatDark.dispose();
    this.debrisMatAccent.dispose();
  }
}
