/* ==========================================================
   HELLBORNE — Raycasting FPS Engine
   A playable DOOM-style first-person shooter in pure JS+Canvas
   ========================================================== */

(function () {
  'use strict';

  // ─── CONFIG ───
  const CFG = {
    FOV: Math.PI / 3,
    MOVE_SPEED: 3.0,
    ROT_SPEED: 2.5,
    MAP_CELL: 1,
    WALL_H: 1,
    FIRE_RATE: 300,
    DEMON_SPEED: 1.2,
    DEMON_HP: 3,
    DEMON_DMG: 8,
    DEMON_ATTACK_DIST: 1.2,
    DEMON_ATTACK_RATE: 1000,
    BULLET_DMG: 1,
    MAX_HP: 100,
    MAX_AMMO: 50,
    SPAWN_INTERVAL: 4000,
    MAX_DEMONS: 15,
    MINIMAP_SCALE: 6,
    MINIMAP_X: 16,
    MINIMAP_Y: 16,
  };

  // ─── MAP (1 = wall, 0 = floor) ───
  const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,0,0,0,1,1,1,1,0,0,0,1,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,1,0,0,0,1,1,1,1,0,0,0,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  const MAP_H = MAP.length;
  const MAP_W = MAP[0].length;

  function isWall(x, y) {
    const mx = Math.floor(x), my = Math.floor(y);
    if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return true;
    return MAP[my][mx] === 1;
  }

  // ─── STATE ───
  const player = { x: 2.5, y: 2.5, angle: 0, hp: CFG.MAX_HP, ammo: CFG.MAX_AMMO, score: 0 };
  const keys = {};
  let demons = [];
  let bullets = []; // visual tracers
  let lastFire = 0;
  let lastSpawn = 0;
  let gunFlash = 0;
  let hitFlash = 0;
  let killCount = 0;
  let gameOver = false;
  let gameStarted = false;
  let pointerLocked = false;
  let mouseDX = 0;

  // ─── CANVAS SETUP ───
  let canvas, ctx, W, H;

  function initCanvas() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    W = canvas.width = Math.max(rect.width, 300);
    H = canvas.height = Math.max(rect.height, 200);
  }

  // ─── INPUT ───
  function initInput() {
    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });

    canvas.addEventListener('click', () => {
      if (!gameStarted) { gameStarted = true; spawnWave(); }
      if (gameOver) { restartGame(); return; }
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', e => {
      if (pointerLocked) mouseDX += e.movementX;
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0 && gameStarted && !gameOver) shoot();
    });
  }

  // ─── DEMON CLASS ───
  function createDemon() {
    let x, y, tries = 0;
    do {
      x = 2 + Math.random() * (MAP_W - 4);
      y = 2 + Math.random() * (MAP_H - 4);
      tries++;
    } while ((isWall(x, y) || dist(x, y, player.x, player.y) < 5) && tries < 100);

    return {
      x, y, hp: CFG.DEMON_HP, alive: true,
      lastAttack: 0,
      flash: 0,
      type: Math.random() > 0.7 ? 'big' : 'normal',
    };
  }

  function spawnWave() {
    for (let i = 0; i < 4; i++) {
      if (demons.length < CFG.MAX_DEMONS) demons.push(createDemon());
    }
  }

  // ─── SHOOT ───
  function shoot() {
    const now = performance.now();
    if (now - lastFire < CFG.FIRE_RATE) return;
    if (player.ammo <= 0) return;
    lastFire = now;
    player.ammo--;
    gunFlash = 6;

    // raycast to find hit demon
    const hitDemon = raycastDemon();
    if (hitDemon) {
      hitDemon.hp -= CFG.BULLET_DMG;
      hitDemon.flash = 4;
      if (hitDemon.hp <= 0) {
        hitDemon.alive = false;
        player.score += hitDemon.type === 'big' ? 200 : 100;
        killCount++;
        // ammo drop
        player.ammo = Math.min(CFG.MAX_AMMO, player.ammo + 2);
        // health drop on kill
        if (Math.random() > 0.5) player.hp = Math.min(CFG.MAX_HP, player.hp + 5);
      }
    }
  }

  function raycastDemon() {
    // sort demons by distance
    const sorted = demons
      .filter(d => d.alive)
      .map(d => ({ demon: d, dist: dist(player.x, player.y, d.x, d.y) }))
      .sort((a, b) => a.dist - b.dist);

    for (const { demon, dist: dd } of sorted) {
      const dx = demon.x - player.x;
      const dy = demon.y - player.y;
      let angle = Math.atan2(dy, dx) - player.angle;
      // normalize
      while (angle < -Math.PI) angle += 2 * Math.PI;
      while (angle > Math.PI) angle -= 2 * Math.PI;

      if (Math.abs(angle) < 0.15 && dd < 18) {
        // check wall between
        if (!wallBetween(player.x, player.y, demon.x, demon.y)) {
          return demon;
        }
      }
    }
    return null;
  }

  function wallBetween(x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    const steps = Math.ceil(d * 4);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      if (isWall(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true;
    }
    return false;
  }

  // ─── UPDATE ───
  function update(dt) {
    if (!gameStarted || gameOver) return;
    const now = performance.now();

    // mouse rotation
    player.angle += mouseDX * 0.002;
    mouseDX = 0;

    // keyboard rotation (arrow keys)
    if (keys['ArrowLeft']) player.angle -= CFG.ROT_SPEED * dt;
    if (keys['ArrowRight']) player.angle += CFG.ROT_SPEED * dt;

    // movement
    let mx = 0, my = 0;
    const cos = Math.cos(player.angle), sin = Math.sin(player.angle);
    if (keys['KeyW'] || keys['ArrowUp']) { mx += cos; my += sin; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx -= cos; my -= sin; }
    if (keys['KeyA']) { mx += sin; my -= cos; }
    if (keys['KeyD']) { mx -= sin; my += cos; }

    const len = Math.sqrt(mx * mx + my * my);
    if (len > 0) {
      mx = (mx / len) * CFG.MOVE_SPEED * dt;
      my = (my / len) * CFG.MOVE_SPEED * dt;
      const r = 0.2;
      if (!isWall(player.x + mx + (mx > 0 ? r : -r), player.y)) player.x += mx;
      if (!isWall(player.x, player.y + my + (my > 0 ? r : -r))) player.y += my;
    }

    // keyboard shoot
    if (keys['Space']) shoot();

    // demons AI
    demons.forEach(d => {
      if (!d.alive) return;
      const dd = dist(player.x, player.y, d.x, d.y);
      // move toward player
      if (dd > CFG.DEMON_ATTACK_DIST) {
        const dx = player.x - d.x, dy = player.y - d.y;
        const l = Math.sqrt(dx * dx + dy * dy);
        const speed = (d.type === 'big' ? CFG.DEMON_SPEED * 0.7 : CFG.DEMON_SPEED) * dt;
        const nx = d.x + (dx / l) * speed;
        const ny = d.y + (dy / l) * speed;
        if (!isWall(nx, ny)) { d.x = nx; d.y = ny; }
        else if (!isWall(nx, d.y)) { d.x = nx; }
        else if (!isWall(d.x, ny)) { d.y = ny; }
      }
      // attack
      if (dd < CFG.DEMON_ATTACK_DIST && now - d.lastAttack > CFG.DEMON_ATTACK_RATE) {
        d.lastAttack = now;
        const dmg = d.type === 'big' ? CFG.DEMON_DMG * 2 : CFG.DEMON_DMG;
        player.hp -= dmg;
        hitFlash = 8;
        if (player.hp <= 0) { player.hp = 0; gameOver = true; }
      }
      if (d.flash > 0) d.flash--;
    });

    // remove dead
    demons = demons.filter(d => d.alive);

    // spawning
    if (now - lastSpawn > CFG.SPAWN_INTERVAL && demons.length < CFG.MAX_DEMONS) {
      demons.push(createDemon());
      lastSpawn = now;
    }

    if (gunFlash > 0) gunFlash--;
    if (hitFlash > 0) hitFlash--;
  }

  // ─── RAYCASTING RENDER ───
  const zBuffer = [];

  function renderWalls() {
    const numRays = W;
    const halfFov = CFG.FOV / 2;

    for (let i = 0; i < numRays; i++) {
      const rayAngle = player.angle - halfFov + (i / numRays) * CFG.FOV;
      const cos = Math.cos(rayAngle), sin = Math.sin(rayAngle);

      let d = 0;
      const step = 0.02;
      let hitX, hitY;
      while (d < 20) {
        d += step;
        hitX = player.x + cos * d;
        hitY = player.y + sin * d;
        if (isWall(hitX, hitY)) break;
      }

      // fix fisheye
      const corrected = d * Math.cos(rayAngle - player.angle);
      zBuffer[i] = corrected;

      const wallH = (H / corrected) * 0.8;
      const top = (H - wallH) / 2;

      // wall shade by distance
      const shade = Math.max(0, 1 - corrected / 14);

      // side coloring: check if hit is more horizontal or vertical
      const fracX = hitX - Math.floor(hitX);
      const fracY = hitY - Math.floor(hitY);
      const isVertical = fracX < 0.02 || fracX > 0.98;

      const r = isVertical ? Math.floor(140 * shade) : Math.floor(100 * shade);
      const g = Math.floor(8 * shade);
      const b = Math.floor(8 * shade);

      // ceiling
      const ceilGrad = ctx.createLinearGradient(i, 0, i, top);
      ceilGrad.addColorStop(0, '#050505');
      ceilGrad.addColorStop(1, `rgb(${Math.floor(30 * shade)},0,0)`);
      ctx.fillStyle = ceilGrad;
      ctx.fillRect(i, 0, 1, top);

      // wall
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(i, top, 1, wallH);

      // floor
      const floorGrad = ctx.createLinearGradient(i, top + wallH, i, H);
      floorGrad.addColorStop(0, `rgb(${Math.floor(20 * shade)},0,0)`);
      floorGrad.addColorStop(1, '#111');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(i, top + wallH, 1, H - top - wallH);
    }
  }

  // ─── RENDER DEMONS (billboard sprites) ───
  function renderDemons() {
    const sorted = demons
      .filter(d => d.alive)
      .map(d => ({ ...d, dist: dist(player.x, player.y, d.x, d.y) }))
      .sort((a, b) => b.dist - a.dist); // far to near

    for (const d of sorted) {
      let angle = Math.atan2(d.y - player.y, d.x - player.x) - player.angle;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      while (angle > Math.PI) angle -= 2 * Math.PI;

      if (Math.abs(angle) > CFG.FOV / 2 + 0.2) continue;

      const screenX = W / 2 + (angle / (CFG.FOV / 2)) * (W / 2);
      const correctedDist = d.dist * Math.cos(angle);
      const spriteH = (H / correctedDist) * 0.7;
      const spriteW = spriteH * 0.7;
      const top = (H - spriteH) / 2;
      const left = screenX - spriteW / 2;

      // check if behind wall
      const rayIdx = Math.floor(screenX);
      if (rayIdx >= 0 && rayIdx < W && correctedDist > zBuffer[rayIdx] + 0.3) continue;

      const shade = Math.max(0.15, 1 - d.dist / 12);

      if (d.type === 'big') {
        drawBigDemon(left, top, spriteW, spriteH, shade, d.flash > 0);
      } else {
        drawDemon(left, top, spriteW, spriteH, shade, d.flash > 0);
      }
    }
  }

  function drawDemon(x, y, w, h, shade, hit) {
    ctx.save();
    const baseR = hit ? 255 : Math.floor(200 * shade);
    const baseG = hit ? 50 : Math.floor(30 * shade);
    const baseB = hit ? 50 : Math.floor(30 * shade);

    // body
    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = `rgb(${Math.floor(baseR * 0.8)},${Math.floor(baseG * 0.5)},${Math.floor(baseB * 0.5)})`;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.25, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = `rgba(255, ${hit ? 255 : 50}, 0, ${shade})`;
    ctx.beginPath();
    ctx.arc(x + w * 0.38, y + h * 0.23, w * 0.05, 0, Math.PI * 2);
    ctx.arc(x + w * 0.62, y + h * 0.23, w * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // horns
    ctx.strokeStyle = `rgb(${Math.floor(120 * shade)},${Math.floor(20 * shade)},0)`;
    ctx.lineWidth = Math.max(1, w * 0.04);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.32, y + h * 0.15);
    ctx.lineTo(x + w * 0.2, y + h * 0.02);
    ctx.moveTo(x + w * 0.68, y + h * 0.15);
    ctx.lineTo(x + w * 0.8, y + h * 0.02);
    ctx.stroke();

    ctx.restore();
  }

  function drawBigDemon(x, y, w, h, shade, hit) {
    ctx.save();
    const bw = w * 1.4, bh = h * 1.2;
    const bx = x - (bw - w) / 2, by = y - (bh - h);

    const baseR = hit ? 255 : Math.floor(160 * shade);
    const baseG = hit ? 80 : Math.floor(50 * shade);
    const baseB = hit ? 200 : Math.floor(60 * shade);

    // body
    ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
    ctx.beginPath();
    ctx.ellipse(bx + bw / 2, by + bh * 0.55, bw * 0.4, bh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = `rgb(${Math.floor(baseR * 0.8)},${Math.floor(baseG * 0.6)},${Math.floor(baseB * 0.5)})`;
    ctx.beginPath();
    ctx.ellipse(bx + bw / 2, by + bh * 0.22, bw * 0.25, bh * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes (3 eyes!)
    ctx.fillStyle = `rgba(0, 255, ${hit ? 255 : 100}, ${shade})`;
    ctx.beginPath();
    ctx.arc(bx + bw * 0.35, by + bh * 0.2, bw * 0.04, 0, Math.PI * 2);
    ctx.arc(bx + bw * 0.5, by + bh * 0.17, bw * 0.05, 0, Math.PI * 2);
    ctx.arc(bx + bw * 0.65, by + bh * 0.2, bw * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // horns bigger
    ctx.strokeStyle = `rgb(${Math.floor(100 * shade)},0,${Math.floor(80 * shade)})`;
    ctx.lineWidth = Math.max(2, bw * 0.05);
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.25, by + bh * 0.12);
    ctx.lineTo(bx + bw * 0.1, by - bh * 0.05);
    ctx.moveTo(bx + bw * 0.75, by + bh * 0.12);
    ctx.lineTo(bx + bw * 0.9, by - bh * 0.05);
    ctx.stroke();

    ctx.restore();
  }

  // ─── HUD ───
  function renderHUD() {
    // Gun
    drawGun();

    // Crosshair
    ctx.strokeStyle = 'rgba(230, 0, 18, 0.8)';
    ctx.lineWidth = 2;
    const cx = W / 2, cy = H / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12);
    ctx.stroke();

    // Hit flash
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${hitFlash * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Gun flash
    if (gunFlash > 3) {
      ctx.fillStyle = `rgba(255, 200, 50, ${(gunFlash - 3) * 0.15})`;
      ctx.beginPath();
      ctx.arc(W / 2, H - 80, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom HUD bar
    const hudH = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, H - hudH, W, hudH);
    ctx.strokeStyle = 'rgba(230, 0, 18, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - hudH);
    ctx.lineTo(W, H - hudH);
    ctx.stroke();

    ctx.font = '700 12px Orbitron, monospace';
    ctx.textBaseline = 'middle';
    const hudY = H - hudH / 2;

    // HP bar
    ctx.fillStyle = '#444';
    ctx.fillRect(20, hudY - 8, 120, 16);
    const hpPct = player.hp / CFG.MAX_HP;
    const hpColor = hpPct > 0.5 ? '#e60012' : hpPct > 0.25 ? '#ff6600' : '#ff0000';
    ctx.fillStyle = hpColor;
    ctx.fillRect(20, hudY - 8, 120 * hpPct, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP ${player.hp}`, 150, hudY);

    // Ammo
    ctx.fillStyle = '#aaa';
    ctx.fillText(`AMMO`, W / 2 - 60, hudY - 8);
    ctx.font = '900 22px Orbitron, monospace';
    ctx.fillStyle = player.ammo > 5 ? '#ff4444' : '#ff0000';
    ctx.fillText(`${player.ammo}`, W / 2 - 60, hudY + 12);

    // Score
    ctx.font = '700 12px Orbitron, monospace';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'right';
    ctx.fillText(`KILLS: ${killCount}`, W - 20, hudY - 8);
    ctx.font = '900 18px Orbitron, monospace';
    ctx.fillStyle = '#ff4444';
    ctx.fillText(`${player.score}`, W - 20, hudY + 12);
    ctx.textAlign = 'left';
  }

  function drawGun() {
    const gw = Math.min(200, W * 0.25);
    const gh = gw * 1.2;
    const gx = W / 2 - gw / 2 + (gunFlash > 0 ? (Math.random() - 0.5) * 4 : 0);
    const gy = H - gh + 10 - 60 + (gunFlash > 0 ? -8 : 0);

    ctx.save();
    // barrel
    ctx.fillStyle = '#333';
    ctx.fillRect(gx + gw * 0.42, gy, gw * 0.16, gh * 0.5);

    // body
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(gx + gw * 0.25, gy + gh * 0.5);
    ctx.lineTo(gx + gw * 0.75, gy + gh * 0.5);
    ctx.lineTo(gx + gw * 0.7, gy + gh * 0.85);
    ctx.lineTo(gx + gw * 0.3, gy + gh * 0.85);
    ctx.closePath();
    ctx.fill();

    // grip
    ctx.fillStyle = '#444';
    ctx.fillRect(gx + gw * 0.4, gy + gh * 0.7, gw * 0.2, gh * 0.3);

    // details
    ctx.fillStyle = '#e60012';
    ctx.fillRect(gx + gw * 0.35, gy + gh * 0.52, gw * 0.3, 3);

    // muzzle flash
    if (gunFlash > 3) {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(gx + gw * 0.5, gy - 10);
      ctx.lineTo(gx + gw * 0.35, gy + 15);
      ctx.lineTo(gx + gw * 0.65, gy + 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(gx + gw * 0.5, gy, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ─── MINIMAP ───
  function renderMinimap() {
    const s = CFG.MINIMAP_SCALE;
    const mx = CFG.MINIMAP_X, my = CFG.MINIMAP_Y;
    const mw = MAP_W * s, mh = MAP_H * s;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        ctx.fillStyle = MAP[y][x] ? '#3a0000' : '#111';
        ctx.fillRect(mx + x * s, my + y * s, s, s);
      }
    }

    // demons
    demons.forEach(d => {
      if (!d.alive) return;
      ctx.fillStyle = d.type === 'big' ? '#aa00ff' : '#ff4444';
      ctx.beginPath();
      ctx.arc(mx + d.x * s, my + d.y * s, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // player
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(mx + player.x * s, my + player.y * s, 3, 0, Math.PI * 2);
    ctx.fill();

    // direction
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + player.x * s, my + player.y * s);
    ctx.lineTo(mx + (player.x + Math.cos(player.angle) * 2) * s, my + (player.y + Math.sin(player.angle) * 2) * s);
    ctx.stroke();

    ctx.restore();
  }

  // ─── SCREENS ───
  function renderStartScreen() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // vignette
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8);
    grad.addColorStop(0, 'rgba(60,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = '900 clamp(28px, 5vw, 52px) Orbitron, monospace';
    ctx.fillStyle = '#e60012';
    ctx.shadowColor = '#e60012';
    ctx.shadowBlur = 30;
    ctx.fillText('HELLBORNE', W / 2, H * 0.35);
    ctx.shadowBlur = 0;

    ctx.font = '400 clamp(12px, 2vw, 18px) Rajdhani, monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('WASD para mover  ·  Mouse para mirar  ·  Click para atirar', W / 2, H * 0.50);
    ctx.fillText('Espaço também atira  ·  Setas do teclado também funcionam', W / 2, H * 0.56);

    // pulsing click text
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
    ctx.font = '700 clamp(14px, 2.5vw, 22px) Orbitron, monospace';
    ctx.fillStyle = `rgba(230, 0, 18, ${0.4 + pulse * 0.6})`;
    ctx.fillText('[ CLIQUE PARA INICIAR ]', W / 2, H * 0.72);
    ctx.textAlign = 'left';
  }

  function renderGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = '900 clamp(28px, 5vw, 48px) Orbitron, monospace';
    ctx.fillStyle = '#e60012';
    ctx.shadowColor = '#e60012';
    ctx.shadowBlur = 20;
    ctx.fillText('VOCÊ MORREU', W / 2, H * 0.35);
    ctx.shadowBlur = 0;

    ctx.font = '700 clamp(16px, 3vw, 28px) Orbitron, monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${killCount} KILLS  ·  ${player.score} PTS`, W / 2, H * 0.48);

    ctx.font = '400 clamp(12px, 2vw, 16px) Rajdhani, monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('A versão completa tem checkpoints e mais armas.', W / 2, H * 0.58);

    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
    ctx.font = '700 clamp(12px, 2vw, 18px) Orbitron, monospace';
    ctx.fillStyle = `rgba(230, 0, 18, ${0.4 + pulse * 0.6})`;
    ctx.fillText('[ CLIQUE PARA RECOMEÇAR ]', W / 2, H * 0.72);
    ctx.textAlign = 'left';
  }

  function restartGame() {
    player.x = 2.5; player.y = 2.5; player.angle = 0;
    player.hp = CFG.MAX_HP; player.ammo = CFG.MAX_AMMO; player.score = 0;
    demons = []; killCount = 0; gameOver = false; lastSpawn = 0;
    spawnWave();
  }

  // ─── GAME LOOP ───
  let lastTime = 0;

  function loop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (!gameStarted) {
      renderStartScreen();
    } else if (gameOver) {
      // still render world behind overlay
      renderWalls();
      renderDemons();
      renderHUD();
      renderGameOver();
    } else {
      update(dt);
      renderWalls();
      renderDemons();
      renderHUD();
      renderMinimap();
    }

    requestAnimationFrame(loop);
  }

  // ─── UTIL ───
  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // ─── INIT ───
  function init() {
    if (!initCanvas()) return;
    initInput();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
