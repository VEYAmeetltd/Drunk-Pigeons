import { CONFIG, fatLevelFor, pigeonRadiusFor } from '../config';

const PPM = CONFIG.PIXELS_PER_METRE;

// Pure(ish) game simulation. No rendering. Mutates internal state each step.
// Rendering layer reads getSnapshot(). Collision/scoring use plain JS state.
export function createEngine({ onScore, onChip, onCrash }) {
  let W = 400;
  let H = 800;

  const pigeon = { x: 0, y: 0, vy: 0 };
  const obstacles = [];
  const chips = [];
  const feathers = [];

  let scrollSpeed = CONFIG.SPEED_BASE;
  let score = 0;
  let chipCount = 0;
  let distance = 0;
  let chipTimer = 0;
  let running = false;
  let dead = false;
  let invincibleUntil = 0;
  let usedRevive = false;
  let flapPulse = 0;
  const dirtyObstacles = new Set();

  for (let i = 0; i < CONFIG.OBSTACLE_POOL; i++) {
    obstacles.push({ active: false, x: 0, topH: 0, gap: CONFIG.GAP_BASE, kind: 0, passed: false });
  }
  for (let i = 0; i < CONFIG.CHIP_POOL; i++) {
    chips.push({ active: false, x: 0, y: 0, eaten: false, anim: 0 });
  }
  for (let i = 0; i < CONFIG.FEATHER_POOL; i++) {
    feathers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, life: 0 });
  }

  function groundY() {
    return H - CONFIG.GROUND_H;
  }

  function difficulty() {
    const speed = Math.min(CONFIG.SPEED_MAX, CONFIG.SPEED_BASE + score * CONFIG.SPEED_PER_SCORE);
    const gap = Math.max(CONFIG.GAP_MIN, CONFIG.GAP_BASE - score * CONFIG.GAP_SHRINK_PER_SCORE);
    const spacing = Math.max(CONFIG.SPACING_MIN, CONFIG.SPACING_BASE - score * 1.2);
    return { speed, gap, spacing };
  }

  function placeObstacle(idx, x) {
    const { gap } = difficulty();
    const minTop = CONFIG.MIN_TOP;
    const maxTop = groundY() - CONFIG.MIN_BOTTOM - gap;
    const topH = minTop + Math.random() * Math.max(20, maxTop - minTop);
    const o = obstacles[idx];
    o.active = true;
    o.x = x;
    o.topH = topH;
    o.gap = gap;
    o.kind = Math.floor(Math.random() * 4);
    o.passed = false;
    dirtyObstacles.add(idx);
  }

  function lastObstacleX() {
    let max = -Infinity;
    for (const o of obstacles) if (o.active && o.x > max) max = o.x;
    return max;
  }

  function spawnChip(x, y) {
    const c = chips.find((c) => !c.active);
    if (!c) return;
    c.active = true;
    c.eaten = false;
    c.anim = 0;
    c.x = x;
    c.y = y;
  }

  function explodeFeathers(x, y, feather) {
    let spawned = 0;
    for (const f of feathers) {
      if (f.active) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 320;
      f.active = true;
      f.x = x;
      f.y = y;
      f.vx = Math.cos(ang) * spd;
      f.vy = Math.sin(ang) * spd - 120;
      f.rot = Math.random() * 360;
      f.vr = (Math.random() - 0.5) * 720;
      f.life = 1;
      spawned++;
      if (spawned >= 14) break;
    }
  }

  function reset(width, height) {
    W = width;
    H = height;
    pigeon.x = W * CONFIG.PIGEON_X_RATIO;
    pigeon.y = H * 0.4;
    pigeon.vy = 0;
    scrollSpeed = CONFIG.SPEED_BASE;
    score = 0;
    chipCount = 0;
    distance = 0;
    chipTimer = 0.8;
    running = true;
    dead = false;
    invincibleUntil = 0;
    usedRevive = false;
    obstacles.forEach((o) => (o.active = false));
    chips.forEach((c) => (c.active = false));
    feathers.forEach((f) => (f.active = false));
    // Seed first obstacles off to the right.
    const { spacing } = difficulty();
    let x = W + 120;
    for (let i = 0; i < 3; i++) {
      placeObstacle(i, x);
      x += spacing;
    }
  }

  function flap() {
    if (!running || dead) return;
    pigeon.vy = CONFIG.FLAP_VELOCITY;
    flapPulse = 1;
  }

  function collides(now) {
    if (now < invincibleUntil) return false;
    const r = pigeonRadiusFor(fatLevelFor(chipCount));
    const py = pigeon.y;
    // ground
    if (py + r >= groundY()) return true;
    // obstacles (circle vs top/bottom rect)
    const px = pigeon.x;
    const w = CONFIG.OBSTACLE_WIDTH;
    for (const o of obstacles) {
      if (!o.active) continue;
      if (px + r < o.x || px - r > o.x + w) continue;
      // top rect [o.x,0]..[o.x+w,o.topH]; bottom [o.x, o.topH+o.gap]..ground
      const nx = Math.max(o.x, Math.min(px, o.x + w));
      // top
      let ny = Math.max(0, Math.min(py, o.topH));
      if ((px - nx) ** 2 + (py - ny) ** 2 < r * r) return true;
      // bottom
      const bTop = o.topH + o.gap;
      ny = Math.max(bTop, Math.min(py, groundY()));
      if (py + r > bTop && (px - nx) ** 2 + (py - ny) ** 2 < r * r) return true;
    }
    return false;
  }

  function step(dt, now) {
    // feathers always simulate (for crash animation continuity)
    for (const f of feathers) {
      if (!f.active) continue;
      f.vy += 900 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.life -= dt * 0.7;
      if (f.life <= 0) f.active = false;
    }

    if (flapPulse > 0) flapPulse = Math.max(0, flapPulse - dt * 5);

    if (!running || dead) return;

    const { speed, spacing } = difficulty();
    scrollSpeed = speed;

    // physics
    pigeon.vy = Math.min(CONFIG.MAX_FALL_SPEED, pigeon.vy + CONFIG.GRAVITY * dt);
    pigeon.y += pigeon.vy * dt;
    if (pigeon.y < 12) {
      pigeon.y = 12;
      if (pigeon.vy < 0) pigeon.vy = 0;
    }
    distance += speed * dt;

    // move obstacles + scoring + recycle
    const w = CONFIG.OBSTACLE_WIDTH;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!o.active) continue;
      o.x -= speed * dt;
      if (!o.passed && o.x + w < pigeon.x) {
        o.passed = true;
        score += 1;
        if (onScore) onScore(score);
      }
      if (o.x + w < -20) o.active = false;
    }
    // spawn new obstacle to keep the course endless
    const lx = lastObstacleX();
    if (lx < W - spacing) {
      const free = obstacles.findIndex((o) => !o.active);
      if (free >= 0) {
        placeObstacle(free, Math.max(W + 40, lx + spacing));
        // chance to drop chips inside/around the new gap
        const o = obstacles[free];
        const cy = o.topH + o.gap / 2;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          spawnChip(o.x + w / 2 + (k - (n - 1) / 2) * 42, cy + (Math.random() - 0.5) * (o.gap * 0.5));
        }
      }
    }

    // ambient chip stream between obstacles
    chipTimer -= dt;
    if (chipTimer <= 0) {
      chipTimer = CONFIG.CHIP_SPAWN_MIN + Math.random() * (CONFIG.CHIP_SPAWN_MAX - CONFIG.CHIP_SPAWN_MIN);
      const y = 80 + Math.random() * (groundY() - 160);
      spawnChip(W + 30, y);
    }

    // move chips + collection
    const rr = pigeonRadiusFor(fatLevelFor(chipCount));
    for (const c of chips) {
      if (!c.active) continue;
      if (c.eaten) {
        c.anim += dt * 4;
        if (c.anim >= 1) c.active = false;
        continue;
      }
      c.x -= speed * dt;
      if (c.x < -40) {
        c.active = false;
        continue;
      }
      const dx = c.x - pigeon.x;
      const dy = c.y - pigeon.y;
      const pick = rr + CONFIG.CHIP_SIZE * 0.5;
      if (dx * dx + dy * dy < pick * pick) {
        c.eaten = true;
        c.anim = 0;
        chipCount += 1;
        if (onChip) onChip(chipCount);
      }
    }

    // collision
    if (collides(now)) {
      dead = true;
      running = false;
      explodeFeathers(pigeon.x, pigeon.y);
      if (onCrash) onCrash({ score, chips: chipCount, distance: Math.floor(distance / PPM) });
    }
  }

  // Revive: reposition to safe spot, grant temporary invincibility, keep score/chips.
  function revive(now) {
    if (usedRevive) return false;
    usedRevive = true;
    dead = false;
    running = true;
    // clear obstacles near the pigeon so it doesn't instantly die
    const w = CONFIG.OBSTACLE_WIDTH;
    for (const o of obstacles) {
      if (o.active && o.x + w > pigeon.x - 40 && o.x < pigeon.x + W * 0.55) {
        o.active = false;
      }
    }
    pigeon.y = H * 0.4;
    pigeon.vy = 0;
    invincibleUntil = now + CONFIG.REVIVE_INVINCIBLE_MS;
    return true;
  }

  function getSnapshot(now) {
    const fat = fatLevelFor(chipCount);
    const inv = now < invincibleUntil ? 1 : 0;
    const tilt = Math.max(-28, Math.min(70, pigeon.vy * 0.06));
    return {
      px: pigeon.x,
      py: pigeon.y,
      t: now,
      tilt,
      flap: flapPulse,
      fat,
      inv,
      distM: Math.floor(distance / PPM),
      dead: dead ? 1 : 0,
      obs: obstacles.map((o) => ({ x: o.x, active: o.active ? 1 : 0 })),
      chips: chips.map((c) => ({
        x: c.x,
        y: c.y,
        active: c.active ? 1 : 0,
        anim: c.anim,
        eaten: c.eaten ? 1 : 0,
      })),
      feathers: feathers.map((f) => ({
        x: f.x,
        y: f.y,
        rot: f.rot,
        active: f.active ? 1 : 0,
        life: Math.max(0, f.life),
      })),
    };
  }

  function getObstacleGeom() {
    return obstacles.map((o) => ({
      active: o.active,
      topH: o.topH,
      gap: o.gap,
      kind: o.kind,
    }));
  }

  function consumeDirty() {
    if (dirtyObstacles.size === 0) return null;
    const arr = Array.from(dirtyObstacles);
    dirtyObstacles.clear();
    return arr;
  }

  return {
    reset,
    step,
    flap,
    revive,
    getSnapshot,
    getObstacleGeom,
    consumeDirty,
    get score() {
      return score;
    },
    get chipCount() {
      return chipCount;
    },
    get distanceMeters() {
      return Math.floor(distance / PPM);
    },
    get dead() {
      return dead;
    },
    get running() {
      return running;
    },
    get usedRevive() {
      return usedRevive;
    },
    canRevive() {
      return dead && !usedRevive;
    },
  };
}
