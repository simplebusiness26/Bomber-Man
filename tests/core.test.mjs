import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, TILE, generateStage, isHardPattern, levelToWorldStage } from '../src/core.js';

test('campaign contains five worlds of six stages', () => {
  assert.deepEqual(levelToWorldStage(1), { world:1, stage:1, boss:false });
  assert.deepEqual(levelToWorldStage(6), { world:1, stage:6, boss:true });
  assert.deepEqual(levelToWorldStage(30), { world:5, stage:6, boss:true });
});

test('stage generator preserves classic solid-wall grid and safe spawn', () => {
  for (const level of [1,5,6,12,24,30]) {
    const s=generateStage(level);
    assert.equal(s.grid.length, ROWS);
    assert.equal(s.grid[0].length, COLS);
    assert.equal(s.grid[1][1], TILE.FLOOR);
    assert.equal(s.grid[1][2], TILE.FLOOR);
    assert.equal(s.grid[2][1], TILE.FLOOR);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(isHardPattern(c,r)) assert.equal(s.grid[r][c],TILE.HARD);
  }
});

test('every stage has a hidden exit and enemies', () => {
  for(let level=1;level<=30;level++){
    const s=generateStage(level);
    assert.equal(s.grid[s.exit.r][s.exit.c], TILE.SOFT);
    assert.ok(s.enemies.length>=1);
    if(level%6===0) assert.equal(s.enemies[0].kind,'warden');
  }
});
