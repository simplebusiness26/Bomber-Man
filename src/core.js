export const COLS = 15;
export const ROWS = 11;
export const TILE = { FLOOR: 0, HARD: 1, SOFT: 2 };

export const WORLDS = [
  { name: 'Neon Yard', floor: '#163b46', alt: '#1c4c55', hard: '#8aa6ac', soft: '#38a694', accent: '#ffe25a' },
  { name: 'Frost Foundry', floor: '#17304f', alt: '#1f4167', hard: '#a9c8df', soft: '#4b83a8', accent: '#8cf4ff' },
  { name: 'Moss Circuit', floor: '#203c31', alt: '#294b3b', hard: '#91a89a', soft: '#64a65d', accent: '#d5ff76' },
  { name: 'Ember Vault', floor: '#4a241f', alt: '#5b2c24', hard: '#b8957f', soft: '#b65b3e', accent: '#ffb14a' },
  { name: 'Void Array', floor: '#2a2042', alt: '#362951', hard: '#978ab9', soft: '#7357a6', accent: '#ef7dff' },
];

export const POWERUP_TYPES = ['blast', 'bomb', 'speed', 'kick', 'pulse', 'pierce', 'frost', 'shield', 'heart'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelToWorldStage(level) {
  const clamped = Math.max(1, Math.min(30, level));
  return {
    world: Math.floor((clamped - 1) / 6) + 1,
    stage: ((clamped - 1) % 6) + 1,
    boss: clamped % 6 === 0,
  };
}

export function cellKey(c, r) {
  return `${c},${r}`;
}

export function isHardPattern(c, r) {
  return c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1 || (c % 2 === 0 && r % 2 === 0);
}

function safeSpawnCell(c, r) {
  return (c === 1 && r === 1) || (c === 2 && r === 1) || (c === 1 && r === 2);
}

function openFloorCells(grid) {
  const cells = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === TILE.FLOOR && !safeSpawnCell(c, r)) cells.push({ c, r });
    }
  }
  return cells;
}

function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function generateStage(level) {
  const { world, stage, boss } = levelToWorldStage(level);
  const rng = mulberry32(0xb10a57 + level * 7919);
  const density = Math.min(0.64, 0.36 + level * 0.007);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.FLOOR));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isHardPattern(c, r)) grid[r][c] = TILE.HARD;
      else if (!safeSpawnCell(c, r) && rng() < density) grid[r][c] = TILE.SOFT;
    }
  }

  grid[1][1] = TILE.FLOOR;
  grid[1][2] = TILE.FLOOR;
  grid[2][1] = TILE.FLOOR;

  const softCells = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === TILE.SOFT) softCells.push({ c, r });
    }
  }
  shuffle(softCells, rng);

  const exit = softCells[0] ?? { c: 3, r: 1 };
  if (grid[exit.r][exit.c] !== TILE.SOFT) grid[exit.r][exit.c] = TILE.SOFT;

  const powerups = new Map();
  const guaranteed = ['blast', 'bomb'];
  if (level >= 3) guaranteed.push('speed');
  if (level >= 5) guaranteed.push('kick');
  if (level >= 8) guaranteed.push('pulse');
  if (level >= 11) guaranteed.push('pierce');
  if (level >= 15) guaranteed.push('frost');
  for (let i = 0; i < guaranteed.length && i + 1 < softCells.length; i++) {
    powerups.set(cellKey(softCells[i + 1].c, softCells[i + 1].r), guaranteed[i]);
  }
  for (let i = guaranteed.length + 1; i < softCells.length; i++) {
    if (rng() < 0.09) {
      const weighted = ['blast', 'bomb', 'speed', 'blast', 'bomb', 'shield', 'heart'];
      powerups.set(cellKey(softCells[i].c, softCells[i].r), weighted[Math.floor(rng() * weighted.length)]);
    }
  }

  const floors = shuffle(openFloorCells(grid), rng).filter(({ c, r }) => Math.abs(c - 1) + Math.abs(r - 1) > 5);
  const enemies = [];
  if (boss) {
    const spawn = floors.find(({ c, r }) => c > 9 && r > 6) ?? floors[0] ?? { c: 13, r: 9 };
    enemies.push({ kind: 'warden', c: spawn.c, r: spawn.r, hp: 5 + world * 2 });
  } else {
    const count = Math.min(9, 2 + world + Math.floor(stage / 2));
    const pool = ['drifter'];
    if (level >= 3) pool.push('hunter');
    if (level >= 7) pool.push('orb');
    if (level >= 10) pool.push('turret');
    if (level >= 16) pool.push('spark');
    for (let i = 0; i < count && i < floors.length; i++) {
      enemies.push({ kind: pool[Math.floor(rng() * pool.length)], c: floors[i].c, r: floors[i].r, hp: 1 });
    }
  }

  return {
    level,
    world,
    stage,
    boss,
    name: WORLDS[world - 1].name,
    palette: WORLDS[world - 1],
    grid,
    exit: { ...exit, revealed: false },
    powerups,
    enemies,
    seed: 0xb10a57 + level * 7919,
  };
}

export function canOccupy(grid, c, r) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === TILE.FLOOR;
}
