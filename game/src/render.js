// Shadow Lantern — every pixel the player sees: the night map, the vision
// cones, the cover, the lantern light, the HUD and all the screens.
// The canvas is fixed at 1280x720 logical pixels.
import {
  CONE_HALF_ANGLE, CONE_RANGE, MAP_COLS, MAP_H, MAP_ROWS, MAP_W, MAP_X, MAP_Y,
  NOISE_RADIUS, TILE, VIEW_H, VIEW_W,
} from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_GAME_CLEAR = 'gameclear';

const THEMES = {
  museum: { floorA: '#272c39', floorB: '#212634', wall: '#3a4152', wallTop: '#5a6378', trim: '#8a6d2f', accent: '#d8b45a' },
  vault: { floorA: '#26313d', floorB: '#1f2833', wall: '#39434e', wallTop: '#5d6b7a', trim: '#4a7a8a', accent: '#7fd4e8' },
  garden: { floorA: '#243829', floorB: '#1e2e22', wall: '#33402f', wallTop: '#4d6046', trim: '#5a7a3a', accent: '#9ed47a' },
};

function themeFor(level) {
  return THEMES[level.theme] || THEMES.museum;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const dark = document.createElement('canvas');
  dark.width = VIEW_W;
  dark.height = VIEW_H;
  const dctx = dark.getContext('2d');
  let speckles = [];
  let speckleTheme = '';

  function ensureSpeckles(level) {
    if (speckleTheme === level.name) return;
    speckleTheme = level.name;
    const rnd = createRandom(level.name.length * 7919 + 13);
    speckles = [];
    for (let i = 0; i < 260; i += 1) {
      speckles.push({ x: rnd.range(MAP_X, MAP_X + MAP_W), y: rnd.range(MAP_Y, MAP_Y + MAP_H), r: rnd.range(1, 2.4), a: rnd.range(0.04, 0.12) });
    }
  }

  function px(mapX, mapY) {
    return { x: mapX + MAP_X, y: mapY + MAP_Y };
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawFloor(state) {
    const theme = themeFor(state.level);
    ctx.fillStyle = '#0b0d13';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let ty = 0; ty < MAP_ROWS; ty += 1) {
      for (let tx = 0; tx < MAP_COLS; tx += 1) {
        const ch = state.tiles[ty][tx];
        const x = MAP_X + tx * TILE;
        const y = MAP_Y + ty * TILE;
        ctx.fillStyle = (tx + ty) % 2 === 0 ? theme.floorA : theme.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (ch === '#') {
          ctx.fillStyle = theme.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = theme.wallTop;
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else if (ch === 's') {
          ctx.fillStyle = 'rgba(8,12,28,0.55)';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = 'rgba(140,170,255,0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 9, 0.6, Math.PI * 1.5);
          ctx.stroke();
        }
      }
    }
    for (const s of speckles) {
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = theme.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(MAP_X - 3, MAP_Y - 3, MAP_W + 6, MAP_H + 6);
  }

  function drawCoverAndLoot(state, now) {
    for (let ty = 0; ty < MAP_ROWS; ty += 1) {
      for (let tx = 0; tx < MAP_COLS; tx += 1) {
        const ch = state.tiles[ty][tx];
        const x = MAP_X + tx * TILE;
        const y = MAP_Y + ty * TILE;
        if (ch === 'c') {
          ctx.fillStyle = '#6b4a26';
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = '#4a3016';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
          ctx.fillStyle = '#8a6538';
          ctx.fillRect(x + 6, y + 6, TILE - 12, 4);
        } else if (ch === 'b') {
          ctx.fillStyle = 'rgba(20,60,28,0.9)';
          ctx.beginPath();
          ctx.arc(x + 13, y + 24, 13, 0, Math.PI * 2);
          ctx.arc(x + 27, y + 15, 12, 0, Math.PI * 2);
          ctx.arc(x + 24, y + 28, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(90,160,80,0.85)';
          ctx.beginPath();
          ctx.arc(x + 13, y + 21, 5, 0, Math.PI * 2);
          ctx.arc(x + 27, y + 13, 4, 0, Math.PI * 2);
          ctx.arc(x + 24, y + 26, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Gems: pulsing gold diamonds.
    for (const gem of state.gems) {
      if (gem.taken) continue;
      const p = px(gem.x, gem.y);
      const pulse = 1 + Math.sin(now * 3 + gem.x) * 0.12;
      const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 26 * pulse);
      glow.addColorStop(0, 'rgba(255,215,90,0.55)');
      glow.addColorStop(1, 'rgba(255,215,90,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd75a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 10 * pulse);
      ctx.lineTo(p.x + 7 * pulse, p.y);
      ctx.lineTo(p.x, p.y + 10 * pulse);
      ctx.lineTo(p.x - 7 * pulse, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 10 * pulse);
      ctx.lineTo(p.x + 7 * pulse, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
    }
    // Exit: a glowing green door with a beam of light.
    const e = px(state.exit.x, state.exit.y);
    const beam = 0.5 + Math.sin(now * 2.4) * 0.2;
    const beamGrad = ctx.createLinearGradient(e.x, e.y - 60, e.x, e.y + 20);
    beamGrad.addColorStop(0, `rgba(90,255,150,${0.05 + beam * 0.12})`);
    beamGrad.addColorStop(1, `rgba(90,255,150,${0.25 + beam * 0.2})`);
    ctx.fillStyle = beamGrad;
    ctx.fillRect(e.x - 14, e.y - 60, 28, 80);
    ctx.fillStyle = '#12351f';
    roundRect(ctx, e.x - 15, e.y - 14, 30, 28, 4);
    ctx.fill();
    ctx.strokeStyle = '#5aff96';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#5aff96';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', e.x, e.y - 26);
    ctx.fillStyle = '#d8ffe6';
    ctx.fillRect(e.x - 2, e.y - 8, 4, 16);
  }

  /** The guard's vision cone as a polygon: 26 rays across the cone, each
   *  marched until it hits a wall, crate or bush, so the cone hugs the cover
   *  instead of shining through it. Points are canvas pixels. */
  function conePoints(state, guard) {
    const p = px(guard.x, guard.y);
    const rays = 26;
    const pts = [];
    for (let i = 0; i <= rays; i += 1) {
      const ang = guard.facing - CONE_HALF_ANGLE + (2 * CONE_HALF_ANGLE * i) / rays;
      let r = CONE_RANGE;
      for (let d = 8; d <= CONE_RANGE; d += 6) {
        const mx = guard.x + Math.cos(ang) * d;
        const my = guard.y + Math.sin(ang) * d;
        const tx = Math.floor(mx / TILE);
        const ty = Math.floor(my / TILE);
        if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) { r = d; break; }
        const ch = state.tiles[ty][tx];
        if (ch === '#' || ch === 'c' || ch === 'b') { r = d; break; }
      }
      pts.push({ x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r });
    }
    return pts;
  }

  function traceCone(c, state, guard) {
    const p = px(guard.x, guard.y);
    const pts = conePoints(state, guard);
    c.beginPath();
    c.moveTo(p.x, p.y);
    for (const pt of pts) c.lineTo(pt.x, pt.y);
    c.closePath();
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const color = guard.state === 'alert'
        ? '255,60,60' : guard.state === 'suspicious' ? '255,150,40' : '255,214,64';
      const alpha = guard.state === 'alert' ? 0.34 : guard.state === 'suspicious' ? 0.3 : 0.2;
      traceCone(ctx, state, guard);
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${color},0.5)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawGuards(state, now) {
    for (const guard of state.guards) {
      const p = px(guard.x, guard.y);
      // Body: navy uniform with a brass helmet.
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x + 2, p.y + 4, 14, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = guard.state === 'alert' ? '#7a1f24' : '#2c3e5e';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = guard.state === 'alert' ? '#ff6b6b' : '#8fa8d0';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f4e3a1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(guard.facing) * 18, p.y + Math.sin(guard.facing) * 18);
      ctx.stroke();
      // Suspicion arc above the head.
      if (guard.suspicion > 0.03) {
        ctx.strokeStyle = guard.suspicion >= 1 ? '#ff5252' : guard.suspicion >= 0.35 ? '#ff9f2e' : '#ffd640';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 19, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        ctx.stroke();
      }
      // "?" while investigating, "!" while chasing.
      if (guard.state !== 'patrol') {
        const mark = guard.state === 'alert' ? '!' : '?';
        const bounce = Math.sin(now * 6) * 2;
        ctx.font = 'bold 22px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = guard.state === 'alert' ? '#ff5252' : '#ffb02e';
        ctx.fillText(mark, p.x, p.y - 30 + bounce);
      }
    }
  }

  function drawPlayer(state, now) {
    const player = state.player;
    const p = px(player.x, player.y);
    // Noise ring while walking loud.
    if (player.moving && !player.sneaking) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, NOISE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = player.hidden ? 0.55 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 5, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloak: a dark hooded circle with a gold trim.
    ctx.fillStyle = player.sneaking ? '#241d33' : '#33264a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.sneaking ? 12 : 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd75a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#171226';
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(player.facing - 0.9) * 12, p.y + Math.sin(player.facing - 0.9) * 12);
    ctx.lineTo(p.x + Math.cos(player.facing) * 17, p.y + Math.sin(player.facing) * 17);
    ctx.lineTo(p.x + Math.cos(player.facing + 0.9) * 12, p.y + Math.sin(player.facing + 0.9) * 12);
    ctx.closePath();
    ctx.fill();
    // The lantern: a warm gold dot that swings as the thief moves.
    const swing = player.moving ? Math.sin(now * 9) * 3 : 0;
    const lx = p.x - Math.sin(player.facing) * 10 + swing;
    const ly = p.y + Math.cos(player.facing) * 10;
    const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 16);
    glow.addColorStop(0, 'rgba(255,220,120,0.95)');
    glow.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (player.hidden) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9ed47a';
      ctx.fillText('HIDDEN', p.x, p.y - 24);
    }
  }

  function drawDarkness(state) {
    dctx.clearRect(0, 0, VIEW_W, VIEW_H);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(4,6,16,0.30)';
    dctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
    dctx.globalCompositeOperation = 'destination-out';
    // Lantern light around the thief.
    const p = px(state.player.x, state.player.y);
    let g = dctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 215);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(p.x, p.y, 215, 0, Math.PI * 2);
    dctx.fill();
    // Each guard's cone is lit so the danger stays readable.
    for (const guard of state.guards) {
      const gp = px(guard.x, guard.y);
      g = dctx.createRadialGradient(gp.x, gp.y, 10, gp.x, gp.y, CONE_RANGE);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = g;
      traceCone(dctx, state, guard);
      dctx.fill();
    }
    // The exit glows through the dark.
    const e = px(state.exit.x, state.exit.y);
    g = dctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, 90);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(e.x, e.y, 90, 0, Math.PI * 2);
    dctx.fill();
    ctx.drawImage(dark, 0, 0);
  }

  function drawHint(state) {
    if (state.hintUntil <= state.now) return;
    ctx.save();
    ctx.setLineDash([7, 7]);
    // Guard patrol routes.
    ctx.strokeStyle = 'rgba(255,180,60,0.8)';
    ctx.lineWidth = 2;
    for (const guard of state.guards) {
      ctx.beginPath();
      guard.waypoints.forEach((w, i) => {
        const p = px(w.x, w.y);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    // A safe path from the thief to the exit (computed by the main loop when
    // the hint is shown and stored on the state as hintPath).
    ctx.strokeStyle = 'rgba(90,255,150,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const start = px(state.player.x, state.player.y);
    ctx.moveTo(start.x, start.y);
    const path = state.hintPath && state.hintPath.length ? state.hintPath : null;
    if (path) {
      for (const node of path) {
        const p = px(node.x, node.y);
        ctx.lineTo(p.x, p.y);
      }
    } else {
      const e = px(state.exit.x, state.exit.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5aff96';
    ctx.fillText('HINT — dashed gold: guard patrols · green: safe path to the exit', VIEW_W / 2, MAP_Y + MAP_H - 12);
  }

  function drawHud(state, screen, ui) {
    const level = state.level;
    ctx.fillStyle = '#0e1119';
    ctx.fillRect(0, 0, VIEW_W, 56);
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 56);
    ctx.lineTo(VIEW_W, 56);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8b45a';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillText('SHADOW LANTERN', 16, 17);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${level.name}  ·  ${level.sub}`, 16, 38);
    // Loot.
    ctx.fillStyle = '#ffd75a';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`◆ ${state.loot}/${state.lootTotal}`, 470, 29);
    // Detection meter.
    const mx = 600;
    const mw = 220;
    ctx.fillStyle = '#9aa0b5';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('DETECTION', mx, 14);
    ctx.fillStyle = '#1c2230';
    roundRect(ctx, mx, 22, mw, 14, 7);
    ctx.fill();
    const det = state.detection;
    const detColor = det >= 1 ? '#ff5252' : det >= 0.35 ? '#ff9f2e' : '#ffd640';
    if (det > 0.01) {
      ctx.fillStyle = detColor;
      roundRect(ctx, mx + 2, 24, Math.max(4, (mw - 4) * Math.min(1, det)), 10, 5);
      ctx.fill();
    }
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 1.5;
    roundRect(ctx, mx, 22, mw, 14, 7);
    ctx.stroke();
    ctx.fillStyle = det >= 1 ? '#ff5252' : '#9aa0b5';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(det >= 1 ? 'SPOTTED!' : det >= 0.35 ? 'SUSPICIOUS…' : 'UNSEEN', mx + mw + 10, 29);
    // Timer and score.
    const mm = Math.floor(state.time / 60);
    const ss = Math.floor(state.time % 60).toString().padStart(2, '0');
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${mm}:${ss}`, 1060, 22);
    ctx.fillStyle = '#9aa0b5';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`score ${state.score}`, 1060, 42);
    // Guard status dots.
    ctx.textAlign = 'left';
    let gx = 1090;
    for (const guard of state.guards) {
      ctx.fillStyle = guard.state === 'alert' ? '#ff5252' : guard.state === 'suspicious' ? '#ff9f2e' : '#4caf6d';
      ctx.beginPath();
      ctx.arc(gx, 29, 7, 0, Math.PI * 2);
      ctx.fill();
      gx += 20;
    }
    ctx.fillStyle = '#9aa0b5';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(state.alarm ? 'ALARM!' : 'guards', gx + 4, 29);
    // Bottom hint strip.
    ctx.fillStyle = '#0e1119';
    ctx.fillRect(0, VIEW_H - 16, VIEW_W, 16);
    ctx.fillStyle = '#6b7286';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASD / arrows move · click to walk there · Shift sneak · H hint · R restart · Esc pause · M sound · 1/2/3 levels', VIEW_W / 2, VIEW_H - 8);
  }

  function panel(title, lines, accent, extra = 0) {
    ctx.fillStyle = 'rgba(5,7,12,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 560;
    const h = 130 + lines.length * 30 + extra;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = '#12151f';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(title, VIEW_W / 2, y + 48);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = '16px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 100 + i * 30));
    return { x, y, w, h };
  }

  function drawStars(cx, y, count, size = 30) {
    ctx.font = `${size}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < count ? '#ffd75a' : '#3a4152';
      ctx.fillText('★', cx + (i - 1) * (size + 10), y);
    }
  }

  function levelCardRect(index) {
    const cardW = 250;
    const cardH = 118;
    const gap = 30;
    const totalW = cardW * 3 + gap * 2;
    const x0 = (VIEW_W - totalW) / 2;
    return { x: x0 + index * (cardW + gap), y: 300, w: cardW, h: cardH };
  }

  function drawTitle(state, ui) {
    ctx.fillStyle = 'rgba(5,7,12,0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd75a';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('A LANTERN THIEF’S HEIST', VIEW_W / 2, 128);
    ctx.fillStyle = '#f4e9c8';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.fillText('SHADOW LANTERN', VIEW_W / 2, 196);
    ctx.fillStyle = '#c9cede';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Slip past the guards. Take the gems. Reach the exit — unseen.', VIEW_W / 2, 248);
    // Level cards.
    const y0 = 300;
    state.levels.forEach((level, i) => {
      const card = levelCardRect(i);
      const x = card.x;
      const cardW = card.w;
      const cardH = card.h;
      const selected = i === ui.selectedLevel;
      ctx.fillStyle = selected ? '#1d2436' : '#12151f';
      roundRect(ctx, x, y0, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffd75a' : '#3a4152';
      ctx.lineWidth = selected ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = '#e8eaf2';
      ctx.font = 'bold 19px Georgia, serif';
      ctx.fillText(`${i + 1} · ${level.name}`, x + cardW / 2, y0 + 30);
      ctx.fillStyle = '#9aa0b5';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(level.sub, x + cardW / 2, y0 + 56);
      drawStars(x + cardW / 2, y0 + 88, ui.stars[i] || 0, 20);
    });
    ctx.fillStyle = '#ffd75a';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Click a level, or press Space to play', VIEW_W / 2, 470);
    ctx.fillStyle = '#9aa0b5';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD / arrows or click to move · Shift to sneak (slow, quiet, hard to see) · hide in bushes and shadows', VIEW_W / 2, 506);
    ctx.fillText('Yellow cones are guard sight — fill the detection meter and you are caught · H shows patrol routes', VIEW_W / 2, 530);
    if (ui.best > 0) {
      ctx.fillStyle = '#d8b45a';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`Best score: ${ui.best}`, VIEW_W / 2, 570);
    }
  }

  function draw(state, screen, ui) {
    ensureSpeckles(state.level);
    const now = state.now;
    drawFloor(state);
    drawCones(state);
    drawCoverAndLoot(state, now);
    drawGuards(state, now);
    drawPlayer(state, now);
    drawDarkness(state);
    drawHint(state);
    drawHud(state, screen, ui);
    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    else if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['Esc or Space to keep sneaking', 'R restart the level · Q back to the menu'], '#8fa8d0');
    } else if (screen === SCREEN_CAUGHT) {
      panel('CAUGHT!', [`A guard spotted you in ${state.level.name}.`, `Loot kept: ${state.loot} gem${state.loot === 1 ? '' : 's'} · Time ${Math.floor(state.time)}s`, 'R try again · Q back to the menu'], '#ff5252');
    } else if (screen === SCREEN_CLEAR) {
      const stars = ui.lastStars || 0;
      const rect = panel('LEVEL CLEAR!', [
        `${state.level.name} — ${state.loot}/${state.lootTotal} gems · ${Math.floor(state.time)}s · score ${state.score}`,
        state.everAlerted ? 'You were spotted — the alarm still rings.' : 'Never spotted. A perfect shadow.',
        'Enter next level · R replay · Q menu',
      ], '#5aff96', 44);
      drawStars(VIEW_W / 2, rect.y + rect.h - 26, stars, 30);
    } else if (screen === SCREEN_GAME_CLEAR) {
      panel('THE HEIST IS COMPLETE', [
        `All three levels cleared · total score ${ui.totalScore}`,
        `Stars ${ui.totalStars}/9 — the lantern thief vanishes into the night.`,
        'Q back to the menu · R play again',
      ], '#ffd75a');
    }
  }

  return { draw, levelCardRect };
}
