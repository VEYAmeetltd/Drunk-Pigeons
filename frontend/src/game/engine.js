import { CONFIG, fatLevelFor, pigeonRadiusFor } from '../config';

const PPM = CONFIG.PIXELS_PER_METRE;
const OW = CONFIG.OBSTACLE_WIDTH;

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
  let running = false;
  let dead = false;
  let invincibleUntil = 0;
  let usedRevive = false;
  let flapPulse = 0;
  // 1000m blackout Easter egg
  let eventTriggered = false; // fired once this run
  let blackoutStartT = 0;
  let blackoutEndT = 0;
  let quietUntilT = 0; // suppress obstacle/chip spawns until this time (blackout + recovery)
  const dirtyObstacles = new Set();
  let T = CONFIG; // active tuning (standard = CONFIG; Easy Mode overrides via reset)

  // Window heckler (tiny angry person) — single slot, bound to an obstacle window.
  const heckler = { active: false, obsIndex: -1, side: 'bottom', wx: 0, wy: 0, life: 0, insultR: 0, reactionR: 0, id: 0 };
  let hecklerTimer = 4;
  let hecklerPending = false;

  for (let i = 0; i < CONFIG.OBSTACLE_POOL; i++) {
    obstacles.push({ active: false, x: 0, topH: 0, gap: CONFIG.GAP_BASE, kind: 0, seed: 0, passed: false });
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
    const speed = Math.min(T.SPEED_MAX, T.SPEED_BASE + score * T.SPEED_PER_SCORE);
    const gap = Math.max(T.GAP_MIN, T.GAP_BASE - score * T.GAP_SHRINK_PER_SCORE);
    const spacing = Math.max(T.SPACING_MIN, T.SPACING_BASE - score * T.SPACING_SHRINK_PER_SCORE);
    return { speed, gap, spacing };
  }

  function placeObstacle(idx, x) {
    // if a heckler is bound to this slot, release it before reuse
    if (heckler.active && heckler.obsIndex === idx) heckler.active = false;
    const { gap } = difficulty();
    const minTop = T.MIN_TOP;
    const maxTop = groundY() - T.MIN_BOTTOM - gap;
    let topH = minTop + Math.random() * Math.max(20, maxTop - minTop);
    // Easy Mode: clamp vertical change vs the previous building so there are never
    // aggressive high/low transitions (gentle, forgiving flight path).
    if (T.MAX_TOP_DELTA > 0) {
      let prevTopH = null;
      let maxX = -Infinity;
      for (const o of obstacles) {
        if (o.active && o.x > maxX) { maxX = o.x; prevTopH = o.topH; }
      }
      if (prevTopH != null) {
        topH = Math.max(prevTopH - T.MAX_TOP_DELTA, Math.min(prevTopH + T.MAX_TOP_DELTA, topH));
        topH = Math.max(minTop, Math.min(Math.max(minTop, maxTop), topH));
      }
    }
    const o = obstacles[idx];
    o.active = true;
    o.x = x;
    o.topH = topH;
    o.gap = gap;
    o.kind = Math.floor(Math.random() * 4);
    o.seed = Math.floor(Math.random() * 1000000);
    o.passed = false;
    dirtyObstacles.add(idx);
    generateChipsForObstacle(idx);
  }

  function lastObstacleX() {
    let max = -Infinity;
    for (const o of obstacles) if (o.active && o.x > max) max = o.x;
    return max;
  }

  // Attach a tiny angry heckler to a valid window on a fully on-screen building.
  // The person becomes a dependent of that obstacle slot (moves/dies with it).
  const WIN_W = 36;
  const WIN_H = 36;
  function trySpawnHeckler() {
    if (heckler.active) return;
    const gY = groundY();
    const cands = [];
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      // building must be fully on-screen (window can fit completely on screen)
      if (o.active && o.x >= W * 0.45 && o.x + OW <= W - 4) cands.push(i);
    }
    if (cands.length === 0) return;
    const idx = cands[Math.floor(Math.random() * cands.length)];
    const o = obstacles[idx];
    const bottomTop = o.topH + o.gap;
    const pad = 12;
    const topRoom = o.topH - (WIN_H + pad * 2);
    const bottomRoom = gY - bottomTop - (WIN_H + pad * 2);
    let side, top;
    if (bottomRoom > 0 && (topRoom <= 0 || Math.random() < 0.6)) {
      side = 'bottom';
      top = bottomTop + pad + Math.random() * bottomRoom;
    } else if (topRoom > 0) {
      side = 'top';
      top = pad + Math.random() * topRoom;
    } else {
      return; // no window fits => do not spawn
    }
    heckler.active = true;
    heckler.obsIndex = idx;
    heckler.side = side;
    heckler.wx = OW / 2; // window centre within the column
    heckler.wy = top + WIN_H / 2; // absolute vertical centre (building doesn't move vertically)
    heckler.life = 1.5 + Math.random() * 0.5;
    heckler.insultR = Math.random();
    heckler.reactionR = Math.random();
    heckler.id += 1;
    hecklerPending = true;
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

  // Validate a chip's FULL bounds (+safe padding) against ground, ceiling and every
  // active building. Returns true only if the chip sits entirely in open flying space.
  function isChipPosSafe(x, y) {
    const r = CONFIG.CHIP_SIZE * 0.5;
    const pad = 12;
    const gY = groundY();
    if (y - r - pad < 6) return false;
    if (y + r + pad > gY) return false;
    for (const o of obstacles) {
      if (!o.active) continue;
      const bx1 = o.x - pad;
      const bx2 = o.x + OW + pad;
      if (x + r < bx1 || x - r > bx2) continue; // not horizontally near this column
      // near this column: chip must fit fully inside the open gap band
      if (y - r - pad < o.topH) return false; // would clip the top building
      if (y + r + pad > o.topH + o.gap) return false; // would clip the bottom building
    }
    return true;
  }

  function placeIfSafe(x, y) {
    if (isChipPosSafe(x, y)) spawnChip(x, y);
  }

  // Generate validated chips for a newly placed obstacle: a couple inside its gap
  // corridor, plus a short trail in the OPEN sky between it and the previous obstacle.
  function generateChipsForObstacle(idx) {
    const B = obstacles[idx];
    if (!B || !B.active) return;
    const r = CONFIG.CHIP_SIZE * 0.5;
    const pad = 12;

    // 1) up to 2 chips inside B's own gap (safe by construction, still validated)
    const gapCy = B.topH + B.gap / 2;
    let placedGap = 0;
    for (const oy of [0, -24, 24]) {
      if (placedGap >= 2) break;
      if (isChipPosSafe(B.x + OW / 2, gapCy + oy)) {
        spawnChip(B.x + OW / 2, gapCy + oy);
        placedGap += 1;
      }
    }

    // 2) trail in the open span between the previous building and B
    let prev = null;
    for (const o of obstacles) {
      if (o.active && o !== B && o.x < B.x) {
        if (!prev || o.x > prev.x) prev = o;
      }
    }
    if (prev) {
      const x1 = prev.x + OW + pad + r + 8;
      const x2 = B.x - pad - r - 8;
      if (x2 - x1 > 44) {
        const n = 2 + Math.floor(Math.random() * 3); // 2-4
        const form = Math.floor(Math.random() * 4); // line / arc / rise / fall
        const gY = groundY();
        const baseY = 100 + Math.random() * (gY - 200);
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0.5 : k / (n - 1);
          const x = x1 + (x2 - x1) * t;
          let y = baseY;
          if (form === 1) y = baseY - Math.sin(t * Math.PI) * 70;
          else if (form === 2) y = baseY - (t - 0.5) * 120;
          else if (form === 3) y = baseY + (t - 0.5) * 120;
          placeIfSafe(x, y); // each chip validated independently; invalid ones skipped
        }
      }
    }
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

  function reset(width, height, tuning) {
    T = tuning ? { ...CONFIG, ...tuning } : CONFIG;
    W = width;
    H = height;
    pigeon.x = W * CONFIG.PIGEON_X_RATIO;
    pigeon.y = H * 0.4;
    pigeon.vy = 0;
    scrollSpeed = CONFIG.SPEED_BASE;
    score = 0;
    chipCount = 0;
    distance = 0;
    running = true;
    dead = false;
    invincibleUntil = 0;
    usedRevive = false;
    eventTriggered = false;
    blackoutStartT = 0;
    blackoutEndT = 0;
    quietUntilT = 0;
    heckler.active = false;
    heckler.id = 0;
    hecklerPending = false;
    hecklerTimer = 3.5 + Math.random() * 3;
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

    // 1000m "pigeon closes its eyes" blackout — fires once per run.
    // Clears the world to open sky so the blind stretch is fair, suppresses
    // spawns during the blackout + a short recovery buffer, then resumes.
    if (!eventTriggered && Math.floor(distance / PPM) >= CONFIG.BLACKOUT_TRIGGER_M) {
      eventTriggered = true;
      blackoutStartT = now;
      blackoutEndT = now + CONFIG.BLACKOUT_MS;
      quietUntilT = blackoutEndT + CONFIG.BLACKOUT_RECOVERY_MS;
      obstacles.forEach((o) => (o.active = false));
      chips.forEach((c) => (c.active = false));
      heckler.active = false;
    }

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
      if (o.x + w < -20) {
        o.active = false;
        if (heckler.active && heckler.obsIndex === i) heckler.active = false;
      }
    }
    // spawn new obstacle to keep the course endless (chips are generated in placeObstacle)
    // gated by quietUntilT so the 1000m blackout keeps an open, obstacle-free sky
    const lx = lastObstacleX();
    if (now >= quietUntilT && lx < W - spacing) {
      const free = obstacles.findIndex((o) => !o.active);
      if (free >= 0) {
        placeObstacle(free, Math.max(W + 40, lx + spacing));
      }
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

    // window heckler: bound to its building; expire on life, or when the building
    // is gone / has scrolled off. Never repositioned independently.
    if (heckler.active) {
      const o = obstacles[heckler.obsIndex];
      heckler.life -= dt;
      const px = o && o.active ? o.x + heckler.wx : -9999;
      if (!o || !o.active || px < -60 || px > W + 60 || heckler.life <= 0) {
        heckler.active = false;
      }
    }
    hecklerTimer -= dt;
    if (hecklerTimer <= 0) {
      hecklerTimer = 3.5 + Math.random() * 4.5;
      trySpawnHeckler();
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

  // 0..1 alpha for the 1000m blackout overlay — pure function of time (fade in/hold/out).
  function currentBlackout(now) {
    if (!eventTriggered || now >= blackoutEndT || now < blackoutStartT) return 0;
    const fadeIn = 450;
    const fadeOut = 800;
    if (now < blackoutStartT + fadeIn) return (now - blackoutStartT) / fadeIn;
    if (now > blackoutEndT - fadeOut) return Math.max(0, (blackoutEndT - now) / fadeOut);
    return 1;
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
      blackout: currentBlackout(now),
      distM: Math.floor(distance / PPM),
      distPx: distance,
      dead: dead ? 1 : 0,
      heckler: (() => {
        const o = heckler.active ? obstacles[heckler.obsIndex] : null;
        const on = o && o.active;
        return {
          x: on ? o.x + heckler.wx : -999,
          y: heckler.wy,
          w: WIN_W,
          h: WIN_H,
          active: on ? 1 : 0,
          life: Math.max(0, heckler.life),
        };
      })(),
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

  function getObstacleGeom() {    return obstacles.map((o) => ({
      active: o.active,
      topH: o.topH,
      gap: o.gap,
      kind: o.kind,
      seed: o.seed,
    }));
  }

  function consumeHeckler() {
    if (!hecklerPending) return null;
    hecklerPending = false;
    return { id: heckler.id, insultR: heckler.insultR, reactionR: heckler.reactionR };
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
    consumeHeckler,
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
