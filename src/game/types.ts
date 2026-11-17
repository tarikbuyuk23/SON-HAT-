export type GameScreen = 'menu' | 'playing' | 'paused' | 'break' | 'gameover';

export type WeaponId = 'kuzgun' | 'sessiz_ok' | 'diken';

export type EnemyType = 'asker' | 'avci' | 'zirhli';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: string;
  slot: 1 | 2 | 3;
  automatic: boolean;
  baseDamage: number;
  baseMagSize: number;
  startReserve: number;
  maxReserve: number;
  fireRate: number; // shots per second
  reloadTime: number; // seconds
  baseSpread: number; // radians
  adsSpread: number;
  recoilPitch: number;
  recoilYaw: number;
  adsFov: number;
  range: number;
}

export interface WeaponRuntimeSummary {
  id: WeaponId;
  name: string;
  slot: 1 | 2 | 3;
  ammo: number;
  magSize: number;
  reserve: number;
  damage: number;
  upgradeLevel: number;
}

export interface GameSettings {
  sensitivity: number; // 0.2 to 2.5
  volume: number; // 0 to 1
  fov: number; // 70 to 110
}

export interface KillFeedEntry {
  id: number;
  weaponName: string;
  enemyName: string;
  headshot: boolean;
  createdAt: number;
}

export interface DamageIndicator {
  id: number;
  angle: number; // radians relative to player forward (0 = front, PI = behind, +PI/2 = right)
  ttl: number;
  maxTtl: number;
}

export interface GameStats {
  wave: number;
  score: number;
  highScore: number;
  kills: number;
  headshots: number;
  shotsFired: number;
  shotsHit: number;
  accuracy: number;
  isNewHighScore: boolean;
}

export interface HudSnapshot {
  screen: GameScreen;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  wave: number;
  score: number;
  highScore: number;
  remainingEnemies: number;
  breakTimeLeft: number;
  activeWeaponId: WeaponId;
  weapons: WeaponRuntimeSummary[];
  isReloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  isCrouching: boolean;
  crosshairSpread: number;
  hitmarker: 'none' | 'body' | 'head';
  headshotBannerKey: number;
  damageFlash: number;
  damageIndicators: DamageIndicator[];
  killFeed: KillFeedEntry[];
  pointerLocked: boolean;
  stats: GameStats;
}

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  kuzgun: {
    id: 'kuzgun',
    name: 'Kuzgun',
    category: 'Taarruz Tüfeği',
    slot: 1,
    automatic: true,
    baseDamage: 28,
    baseMagSize: 30,
    startReserve: 150,
    maxReserve: 240,
    fireRate: 9.5,
    reloadTime: 1.55,
    baseSpread: 0.014,
    adsSpread: 0.004,
    recoilPitch: 0.022,
    recoilYaw: 0.008,
    adsFov: 54,
    range: 140,
  },
  sessiz_ok: {
    id: 'sessiz_ok',
    name: 'Sessiz Ok',
    category: 'Keskin Nişancı',
    slot: 2,
    automatic: false,
    baseDamage: 120,
    baseMagSize: 5,
    startReserve: 25,
    maxReserve: 45,
    fireRate: 0.95,
    reloadTime: 2.1,
    baseSpread: 0.024,
    adsSpread: 0.0008,
    recoilPitch: 0.068,
    recoilYaw: 0.012,
    adsFov: 24,
    range: 220,
  },
  diken: {
    id: 'diken',
    name: 'Diken',
    category: 'Taktik Tabanca',
    slot: 3,
    automatic: false,
    baseDamage: 36,
    baseMagSize: 12,
    startReserve: 72,
    maxReserve: 120,
    fireRate: 5.5,
    reloadTime: 0.9,
    baseSpread: 0.011,
    adsSpread: 0.0035,
    recoilPitch: 0.019,
    recoilYaw: 0.006,
    adsFov: 60,
    range: 100,
  },
};

export const SUPPLY_COSTS = {
  heal: 100,
  ammo: 80,
  armor: 120,
  upgradeBase: 200,
  upgradeStep: 100,
} as const;
