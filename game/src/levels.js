// Shadow Lantern — the three hand-built heist maps.
// Tile legend: '#' wall, '.' floor, 'c' crate (blocks movement and sight),
// 'b' bush (blocks sight, walkable, hides the thief), 's' shadow floor
// (detection fills slowly there), 'g' gem loot, 'E' exit door, 'P' thief start,
// '1'..'4' guard spawn tiles (first waypoint of that guard's patrol loop).
// Every map is 28 columns by 16 rows.
import { MAP_COLS, MAP_ROWS } from './config.js';

export const LEVELS = [
  {
    name: 'The Museum',
    sub: 'Level 1 · steal the Star Sapphire',
    par: 75,
    theme: 'museum',
    map: [
      '############################',
      '#P....#.......#...........E#',
      '#.....#...c...#..g....c....#',
      '#..b..#.......#............#',
      '#.....#...1...#.....g......#',
      '#.....#####.##......########',
      '#..........................#',
      '#.c.....b...#....g....2....#',
      '#...........#..............#',
      '#..g....#...#......c.......#',
      '#.......#...#..............#',
      '####.####...#..b......#....#',
      '#..........s#.........#....#',
      '#....c......#....3....#..g.#',
      '#...........#.........#....#',
      '############################',
    ],
    guards: [
      { waypoints: [[10, 4], [11, 3], [12, 2], [12, 4]] },
      { waypoints: [[23, 7], [25, 7], [25, 10], [23, 10]] },
      { waypoints: [[16, 13], [18, 13], [18, 10], [16, 10]] },
    ],
  },
  {
    name: 'The Vault',
    sub: 'Level 2 · crack the iron vault',
    par: 95,
    theme: 'vault',
    map: [
      '############################',
      '#P...#......#......#......E#',
      '#....#..c...#..g......c....#',
      '#.b..#......#......#.......#',
      '#...........#..1...#...g...#',
      '#....#......#......#.......#',
      '#.g..#..c......b...#.......#',
      '#....#......#......#...2...#',
      '#####.#######..#####.#######',
      '#.......#.........g........#',
      '#..c....#....3....#....c...#',
      '#.......#.........#........#',
      '#...b...####.#######..###..#',
      '#..............g......#....#',
      '#..g....#....4........#..g.#',
      '############################',
    ],
    guards: [
      { waypoints: [[15, 4], [18, 4], [18, 6], [16, 6]] },
      { waypoints: [[23, 7], [25, 7], [25, 9], [23, 9]] },
      { waypoints: [[13, 10], [13, 11], [17, 11], [17, 10]] },
      { waypoints: [[13, 14], [17, 14], [17, 13], [13, 13]] },
    ],
  },
  {
    name: 'Rooftop Garden',
    sub: 'Level 3 · vanish into the night',
    par: 110,
    theme: 'garden',
    map: [
      '############################',
      '#P....b......s.....b......E#',
      '#.....b......s.....b.......#',
      '#..g..b...1..s..g..b...c...#',
      '#.....b......s.....b.......#',
      '#sssss#......s.....#bbbbbbb#',
      '#.....#..c...s..2..#.......#',
      '#..b..#......s.....#...g...#',
      '#..b..#......s.....#.......#',
      '#..b..####.#####...####.####',
      '#..g.........#.........g...#',
      '#.....b......#....3....b...#',
      '#.....b4.....#....b....b...#',
      '#..c..b..g...#....b....b..g#',
      '#.....b......#....b....b...#',
      '############################',
    ],
    guards: [
      { waypoints: [[10, 3], [10, 5], [13, 5], [13, 3]] },
      { waypoints: [[20, 6], [20, 8], [23, 8], [23, 6]] },
      { waypoints: [[19, 11], [19, 13], [22, 13], [22, 11]] },
      { waypoints: [[7, 12], [9, 12], [9, 11], [7, 11]] },
    ],
  },
];

/** Parse a level into tiles, spawn points, gems and the exit. Throws on a bad map. */
export function parseLevel(level) {
  const rows = level.map;
  if (rows.length !== MAP_ROWS) throw new Error(`${level.name}: ${rows.length} rows, expected ${MAP_ROWS}`);
  const tiles = [];
  let player = null;
  let exit = null;
  const gems = [];
  const guardSpawns = [];
  for (let y = 0; y < MAP_ROWS; y += 1) {
    const row = rows[y];
    if (row.length !== MAP_COLS) throw new Error(`${level.name} row ${y}: ${row.length} cols, expected ${MAP_COLS}`);
    tiles.push([]);
    for (let x = 0; x < MAP_COLS; x += 1) {
      const ch = row[x];
      if (ch === 'P') { player = { x, y }; tiles[y].push('.'); }
      else if (ch === 'E') { exit = { x, y }; tiles[y].push('E'); }
      else if (ch === 'g') { gems.push({ x, y, taken: false }); tiles[y].push('.'); }
      else if (ch >= '1' && ch <= '4') { guardSpawns.push({ x, y, index: ch.charCodeAt(0) - 49 }); tiles[y].push('.'); }
      else if ('#.cbs'.includes(ch)) tiles[y].push(ch);
      else if (ch === '.') tiles[y].push('.');
      else throw new Error(`${level.name}: unknown tile '${ch}' at ${x},${y}`);
    }
  }
  if (!player) throw new Error(`${level.name}: no player start`);
  if (!exit) throw new Error(`${level.name}: no exit`);
  if (guardSpawns.length !== level.guards.length) {
    throw new Error(`${level.name}: ${guardSpawns.length} guard spawns but ${level.guards.length} guard defs`);
  }
  return { tiles, player, exit, gems, guardSpawns };
}

/** True when a tile blocks movement (walls and crates). */
export function isSolidTile(ch) {
  return ch === '#' || ch === 'c';
}

/** True when a tile blocks a guard's line of sight (walls, crates, bushes). */
export function blocksSightTile(ch) {
  return ch === '#' || ch === 'c' || ch === 'b';
}
