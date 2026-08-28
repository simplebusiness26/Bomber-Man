import { COLS, ROWS, TILE, WORLDS, cellKey, generateStage, levelToWorldStage, mulberry32 } from './core.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = {
  hud: document.getElementById('hud'), controls: document.getElementById('controls'), menu: document.getElementById('menu'), modal: document.getElementById('modal'),
  world: document.getElementById('hudWorld'), score: document.getElementById('hudScore'), lives: document.getElementById('hudLives'), bombs: document.getElementById('hudBombs'), range: document.getElementById('hudRange'),
  pause: document.getElementById('pauseBtn'), newGame: document.getElementById('newGameBtn'), continueBtn: document.getElementById('continueBtn'), how: document.getElementById('howBtn'),
  mode: document.getElementById('modeBtn'), modeLabel: document.getElementById('modeLabel'), ability: document.getElementById('abilityBtn'), bomb: document.getElementById('bombBtn'),
  modalEyebrow: document.getElementById('modalEyebrow'), modalTitle: document.getElementById('modalTitle'), modalBody: document.getElementById('modalBody'), modalStats: document.getElementById('modalStats'), modalActions: document.getElementById('modalActions'),
};

const SAVE_KEY = 'blastGrid.save.v1';
const MAX_LEVEL_KEY = 'blastGrid.maxLevel.v1';
const LOGICAL_W = 960, LOGICAL_H = 540;
const arena = { x: 154, y: 72, w: 652, h: 478 };
const tileW = arena.w / COLS, tileH = arena.h / ROWS;
const dirs = { up: [0,-1], down:[0,1], left:[-1,0], right:[1,0] };
const modeNames = { fuse:'FUSE', pulse:'PULSE', pierce:'PIERCE', frost:'FROST', mine:'MINE' };

let state = 'menu';
let stage = null;
let level = 1;
let score = 0;
let lives = 3;
let player = makePlayer();
let bombs = [];
let explosions = [];
let enemies = [];
let pickups = new Map();
let projectiles = [];
let floatingText = [];
let last = performance.now();
let heldDir = null;
let nextMoveAt = 0;
let pauseStarted = 0;
let rng = mulberry32(12345);
let screenShake = 0;
let audioMuted = false;
let audioCtx = null;

function makePlayer() {
  return { c:1, r:1, vx:1, vy:1, maxBombs:1, range:2, speed:0, shield:0, abilities:new Set(), bombMode:'fuse', invulnUntil:0, alive:true, lastDir:'right' };
}

function clonePlayerStats(p) {
  const n = makePlayer();
  n.maxBombs = p.maxBombs; n.range = p.range; n.speed = p.speed; n.shield = p.shield; n.abilities = new Set(p.abilities); n.bombMode = p.bombMode;
  return n;
}

function saveGame() {
  const data = { level, score, lives, player:{ maxBombs:player.maxBombs, range:player.range, speed:player.speed, shield:player.shield, abilities:[...player.abilities], bombMode:player.bombMode } };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const max = Math.max(Number(localStorage.getItem(MAX_LEVEL_KEY) || 1), level);
  localStorage.setItem(MAX_LEVEL_KEY, String(max));
}

function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!d) return false;
    level = Math.max(1, Math.min(30, d.level || 1)); score = d.score || 0; lives = Math.max(1, d.lives || 3);
    player = makePlayer();
    Object.assign(player, d.player || {}); player.abilities = new Set(d.player?.abilities || []);
    startStage(); return true;
  } catch { return false; }
}

function beginNewRun() {
  level = 1; score = 0; lives = 3; player = makePlayer(); startStage();
}

function startStage() {
  stage = generateStage(level);
  rng = mulberry32(stage.seed ^ 0x91e10da5);
  const preserved = clonePlayerStats(player);
  player = preserved; player.c = 1; player.r = 1; player.vx = 1; player.vy = 1; player.invulnUntil = performance.now() + 900; player.alive = true;
  bombs = []; explosions = []; projectiles = []; floatingText = []; pickups = new Map();
  enemies = stage.enemies.map((e, i) => ({ ...e, id:`e${level}-${i}`, nextMove:0, nextAttack:performance.now()+1000+rng()*1200, frozenUntil:0, dir:'left' }));
  state = 'playing'; heldDir = null;
  ui.menu.classList.add('hidden'); ui.modal.classList.add('hidden'); ui.hud.classList.remove('hidden'); ui.controls.classList.remove('hidden');
  updateHud(); saveGame(); cue('start');
}

function updateHud() {
  const ws = levelToWorldStage(level);
  ui.world.textContent = `${ws.world}-${ws.stage}`;
  ui.score.textContent = score.toLocaleString(); ui.lives.textContent = lives; ui.bombs.textContent = player.maxBombs; ui.range.textContent = player.range;
  ui.modeLabel.textContent = modeNames[player.bombMode] || 'FUSE';
}

function showModal(eyebrow, title, body, actions, stats=[]) {
  ui.modalEyebrow.textContent = eyebrow; ui.modalTitle.textContent = title; ui.modalBody.textContent = body;
  ui.modalStats.innerHTML = stats.map(([k,v]) => `<div class="stat-pill">${k} <strong>${v}</strong></div>`).join('');
  ui.modalActions.innerHTML = '';
  actions.forEach(({label, primary=true, run}) => { const b=document.createElement('button'); b.className=primary?'primary':'secondary'; b.textContent=label; b.onclick=run; ui.modalActions.appendChild(b); });
  ui.modal.classList.remove('hidden');
}

function showHow() {
  showModal('FIELD MANUAL','How to play','Move around the grid and DROP bombs. Blasts travel in four directions, stop at solid blocks and destroy cracked blocks. Chain bombs together, collect hidden upgrades and clear every hostile unit to power the exit.\n\nTYPE cycles unlocked bomb tech. ACTION remotely triggers Pulse bombs. Kick bombs by walking into them after finding KICK.', [{label:'GOT IT',run:()=>ui.modal.classList.add('hidden')}], [['30','STAGES'],['5','WORLDS'],['5','BOMB TYPES']]);
}

function pauseGame() {
  if (state !== 'playing') return;
  state='paused'; pauseStarted=performance.now(); heldDir=null;
  showModal('SYSTEM HOLD','Paused','Your run is safe.', [
    {label:'RESUME',run:resumeGame},
    {label:'RESTART STAGE',primary:false,run:startStage},
    {label:'MAIN MENU',primary:false,run:toMenu},
  ]);
}
function resumeGame() { const shift=performance.now()-pauseStarted; bombs.forEach(b=>b.detonateAt+=shift); enemies.forEach(e=>{e.nextMove+=shift;e.nextAttack+=shift}); state='playing'; ui.modal.classList.add('hidden'); }
function toMenu() { state='menu'; ui.modal.classList.add('hidden'); ui.hud.classList.add('hidden'); ui.controls.classList.add('hidden'); ui.menu.classList.remove('hidden'); heldDir=null; }

function isBlocked(c,r, ignoreBomb=false) {
  if (!stage || c<0 || r<0 || c>=COLS || r>=ROWS) return true;
  if (stage.grid[r][c] !== TILE.FLOOR) return true;
  if (!ignoreBomb && bombs.some(b=>!b.exploded && b.c===c && b.r===r)) return true;
  return false;
}

function tryMovePlayer(dir, now=performance.now()) {
  if (state!=='playing' || now<nextMoveAt) return;
  const [dc,dr]=dirs[dir]; const nc=player.c+dc, nr=player.r+dr; player.lastDir=dir;
  const bomb = bombs.find(b=>!b.exploded && b.c===nc && b.r===nr);
  if (bomb && player.abilities.has('kick')) { if (kickBomb(bomb,dc,dr,now)) { nextMoveAt=now+moveInterval(); return; } }
  if (!isBlocked(nc,nr)) {
    player.c=nc; player.r=nr; nextMoveAt=now+moveInterval(); cue('step',.12); checkPickup(); checkExit();
  }
}
function moveInterval(){ return Math.max(78, 150-player.speed*14); }

function kickBomb(b,dc,dr,now){ const nc=b.c+dc,nr=b.r+dr; if(isBlocked(nc,nr))return false; b.slide={dc,dr,next:now+95}; cue('kick'); return true; }

function availableModes(){ const a=['fuse']; if(player.abilities.has('pulse'))a.push('pulse'); if(player.abilities.has('pierce'))a.push('pierce'); if(player.abilities.has('frost'))a.push('frost'); if(player.abilities.has('mine'))a.push('mine'); return a; }
function cycleMode(){ if(state!=='playing')return; const a=availableModes(); const i=a.indexOf(player.bombMode); player.bombMode=a[(i+1)%a.length]; updateHud(); cue('select'); }

function placeBomb() {
  if(state!=='playing'||!player.alive)return;
  const owned=bombs.filter(b=>b.team==='player'&&!b.exploded).length; if(owned>=player.maxBombs)return cue('deny');
  if(bombs.some(b=>!b.exploded&&b.c===player.c&&b.r===player.r))return;
  const now=performance.now(); const mode=player.bombMode;
  bombs.push({c:player.c,r:player.r,type:mode,range:player.range,team:'player',detonateAt: mode==='pulse'||mode==='mine'?Infinity:now+(mode==='frost'?1450:1800),created:now,exploded:false,slide:null});
  cue('drop'); haptic(18);
}

function triggerAction(){
  if(state!=='playing')return;
  const remote=bombs.filter(b=>!b.exploded&&b.team==='player'&&b.type==='pulse').sort((a,b)=>a.created-b.created)[0];
  if(remote){ remote.detonateAt=performance.now(); cue('trigger'); return; }
  cue('deny');
}

function updateBombs(now){
  for(const b of bombs){
    if(b.exploded)continue;
    if(b.slide && now>=b.slide.next){ const nc=b.c+b.slide.dc,nr=b.r+b.slide.dr; if(isBlocked(nc,nr)){b.slide=null}else{b.c=nc;b.r=nr;b.slide.next=now+82; if(enemies.some(e=>e.hp>0&&e.c===b.c&&e.r===b.r)){b.detonateAt=now; b.slide=null;} } }
    if(b.type==='mine' && enemies.some(e=>e.hp>0&&Math.abs(e.c-b.c)+Math.abs(e.r-b.r)<=1)) b.detonateAt=now;
    if(now>=b.detonateAt) explodeBomb(b,now);
  }
  bombs=bombs.filter(b=>!b.exploded || now-b.explodedAt<120);
}

function explodeBomb(b,now){
  if(b.exploded)return; b.exploded=true; b.explodedAt=now; b.slide=null;
  const cells=[{c:b.c,r:b.r}]; const destroyed=[]; const directions=[[1,0],[-1,0],[0,1],[0,-1]];
  for(const [dc,dr] of directions){
    let pierced=0;
    for(let i=1;i<=b.range;i++){
      const c=b.c+dc*i,r=b.r+dr*i; if(c<0||r<0||c>=COLS||r>=ROWS)break;
      if(stage.grid[r][c]===TILE.HARD)break;
      cells.push({c,r});
      const other=bombs.find(o=>!o.exploded&&o.c===c&&o.r===r); if(other)other.detonateAt=now;
      if(stage.grid[r][c]===TILE.SOFT){ destroyed.push({c,r}); if(b.type==='pierce'&&pierced<1){pierced++;continue;} break; }
    }
  }
  for(const d of destroyed) destroySoft(d.c,d.r);
  explosions.push({cells,until:now+360,type:b.type,team:b.team,hit:new Set()});
  screenShake=Math.min(12,screenShake+5); cue(b.type==='frost'?'frost':'boom'); haptic(45);
}

function destroySoft(c,r){
  if(stage.grid[r][c]!==TILE.SOFT)return; stage.grid[r][c]=TILE.FLOOR; score+=20;
  const k=cellKey(c,r); if(stage.exit.c===c&&stage.exit.r===r){stage.exit.revealed=true; floating('+ EXIT',c,r,'#8cf4ff');}
  if(stage.powerups.has(k)){pickups.set(k,stage.powerups.get(k)); stage.powerups.delete(k);}
}

function updateExplosions(now){
  explosions=explosions.filter(ex=>ex.until>now);
  for(const ex of explosions){
    if(ex.team==='player'){
      for(const e of enemies){ if(e.hp<=0||ex.hit.has(e.id))continue; if(ex.cells.some(p=>p.c===e.c&&p.r===e.r)){ ex.hit.add(e.id); if(ex.type==='frost')e.frozenUntil=now+2200; damageEnemy(e,1); } }
    }
    if(ex.team==='enemy' && now>=player.invulnUntil && ex.cells.some(p=>p.c===player.c&&p.r===player.r)) hurtPlayer(now);
  }
}

function damageEnemy(e,amount){ e.hp-=amount; if(e.hp<=0){ score+=e.kind==='warden'?2500:150; e.deadAt=performance.now(); floating(e.kind==='warden'?'+2500':'+150',e.c,e.r,'#ffe768'); cue('enemy'); if(e.kind==='warden') { player.abilities.add('mine'); floating('MINE TECH',e.c,e.r,'#ff8be8'); } } else { floating(`-${amount}`,e.c,e.r,'#fff'); } }

function hurtPlayer(now){
  if(now<player.invulnUntil||state!=='playing')return;
  if(player.shield>0){player.shield--;player.invulnUntil=now+1200;floating('SHIELD',player.c,player.r,'#8cf4ff');cue('shield');updateHud();return;}
  lives--; player.alive=false; cue('hurt'); haptic([60,40,80]); updateHud();
  if(lives<=0){ setTimeout(gameOver,450); return; }
  setTimeout(()=>{ player.c=1;player.r=1;player.vx=1;player.vy=1;player.alive=true;player.invulnUntil=performance.now()+1600; bombs=[]; explosions=[]; projectiles=[]; },450);
}

function checkPickup(){
  const k=cellKey(player.c,player.r); const type=pickups.get(k); if(!type)return; pickups.delete(k); score+=75; cue('pickup'); haptic(22);
  if(type==='blast')player.range=Math.min(7,player.range+1);
  else if(type==='bomb')player.maxBombs=Math.min(7,player.maxBombs+1);
  else if(type==='speed')player.speed=Math.min(5,player.speed+1);
  else if(type==='shield')player.shield=Math.min(3,player.shield+1);
  else if(type==='heart')lives=Math.min(9,lives+1);
  else player.abilities.add(type);
  floating(type.toUpperCase(),player.c,player.r,'#fff09a'); updateHud(); saveGame();
}

function checkExit(){
  if(stage.exit.revealed && enemies.every(e=>e.hp<=0) && player.c===stage.exit.c && player.r===stage.exit.r) completeStage();
}

function completeStage(){
  if(state!=='playing')return; state='clear'; score+=500+level*25; cue('clear'); saveGame();
  if(level>=30){ localStorage.setItem(MAX_LEVEL_KEY,'30'); showModal('GRID RESTORED','Run complete','You cleared all five sectors and shut down the Array Warden network. Your upgrades and score are saved — start again and chase a cleaner run.',[{label:'NEW RUN',run:beginNewRun},{label:'MAIN MENU',primary:false,run:toMenu}],[['SCORE',score.toLocaleString()],['LIVES',lives],['STAGES','30/30']]); return; }
  const ws=levelToWorldStage(level); level++; localStorage.setItem(MAX_LEVEL_KEY,String(Math.max(level,Number(localStorage.getItem(MAX_LEVEL_KEY)||1)))); saveGame();
  showModal(ws.boss?'SECTOR SECURED':'STAGE CLEAR',ws.boss?'Warden down':`Stage ${ws.world}-${ws.stage} cleared`, 'The route ahead is open.', [{label:'NEXT STAGE',run:startStage},{label:'MAIN MENU',primary:false,run:toMenu}], [['SCORE',score.toLocaleString()],['NEXT',levelToWorldStage(level).world+'-'+levelToWorldStage(level).stage],['BLAST',player.range]]);
}

function gameOver(){
  if(state==='gameover')return; state='gameover'; localStorage.removeItem(SAVE_KEY);
  showModal('RUN ENDED','Grid offline','The sector got you this time. Start a fresh run and rebuild your upgrades.', [{label:'TRY AGAIN',run:beginNewRun},{label:'MAIN MENU',primary:false,run:toMenu}], [['SCORE',score.toLocaleString()],['REACHED',levelToWorldStage(level).world+'-'+levelToWorldStage(level).stage]]);
}

function enemyCanMove(e,c,r){
  if(c<1||r<1||c>=COLS-1||r>=ROWS-1)return false;
  if(stage.grid[r][c]===TILE.HARD)return false;
  if(e.kind!=='orb'&&stage.grid[r][c]===TILE.SOFT)return false;
  if(bombs.some(b=>!b.exploded&&b.c===c&&b.r===r))return false;
  return true;
}

function updateEnemies(now){
  for(const e of enemies){
    if(e.hp<=0)continue;
    if(e.kind==='turret'){ if(now>=e.nextAttack){turretAttack(e,now);e.nextAttack=now+1500+rng()*1000;} continue; }
    if(now<e.frozenUntil)continue;
    if(now>=e.nextMove){ moveEnemy(e,now); }
    if(e.kind==='warden'&&now>=e.nextAttack){ enemyBomb(e.c,e.r,now); e.nextAttack=now+2000-rng()*300; }
    if(e.c===player.c&&e.r===player.r)hurtPlayer(now);
  }
  enemies=enemies.filter(e=>e.hp>0 || now-(e.deadAt||now)<200);
  if(stage.exit.revealed && enemies.every(e=>e.hp<=0) && !floatingText.some(f=>f.text==='EXIT OPEN')) floating('EXIT OPEN',stage.exit.c,stage.exit.r,'#8cf4ff',1100);
}

function moveEnemy(e,now){
  const options=[]; for(const [name,[dc,dr]] of Object.entries(dirs)){ if(enemyCanMove(e,e.c+dc,e.r+dr))options.push({name,dc,dr}); }
  if(!options.length){e.nextMove=now+300;return;}
  let pick;
  if(e.kind==='hunter'||e.kind==='warden'){
    options.sort((a,b)=>(Math.abs(e.c+a.dc-player.c)+Math.abs(e.r+a.dr-player.r))-(Math.abs(e.c+b.dc-player.c)+Math.abs(e.r+b.dr-player.r)));
    pick=rng()<.78?options[0]:options[Math.floor(rng()*options.length)];
  } else if(e.kind==='spark') pick=options[Math.floor(rng()*options.length)];
  else { const forward=options.find(o=>o.name===e.dir); pick=forward&&rng()<.65?forward:options[Math.floor(rng()*options.length)]; }
  e.c+=pick.dc;e.r+=pick.dr;e.dir=pick.name;
  const base=e.kind==='spark'?105:e.kind==='warden'?260:e.kind==='hunter'?175:220; e.nextMove=now+base+(rng()*60);
}

function clearLine(c1,r1,c2,r2){
  if(c1!==c2&&r1!==r2)return false;
  const dc=Math.sign(c2-c1),dr=Math.sign(r2-r1); let c=c1+dc,r=r1+dr;
  while(c!==c2||r!==r2){ if(stage.grid[r][c]!==TILE.FLOOR)return false;c+=dc;r+=dr;} return true;
}
function turretAttack(e,now){
  if(!clearLine(e.c,e.r,player.c,player.r))return;
  const dc=Math.sign(player.c-e.c),dr=Math.sign(player.r-e.r); projectiles.push({c:e.c,r:e.r,dc,dr,next:now+90,until:now+2600}); cue('shot');
}
function enemyBomb(c,r,now){ if(bombs.some(b=>!b.exploded&&b.c===c&&b.r===r))return; bombs.push({c,r,type:'fuse',range:2,team:'enemy',detonateAt:now+1250,created:now,exploded:false,slide:null}); cue('enemyDrop'); }
function updateProjectiles(now){
  for(const p of projectiles){ if(now>=p.next){p.c+=p.dc;p.r+=p.dr;p.next=now+110;if(isBlocked(p.c,p.r,true))p.until=0;if(p.c===player.c&&p.r===player.r){hurtPlayer(now);p.until=0;}} }
  projectiles=projectiles.filter(p=>p.until>now);
}

function floating(text,c,r,color='#fff',duration=800){ floatingText.push({text,c,r,color,created:performance.now(),duration}); }

function update(now){
  if(state!=='playing')return;
  if(heldDir)tryMovePlayer(heldDir,now);
  updateBombs(now); updateExplosions(now); updateEnemies(now); updateProjectiles(now);
  if(explosions.some(ex=>ex.team==='player'&&now>=player.invulnUntil&&ex.cells.some(p=>p.c===player.c&&p.r===player.r)))hurtPlayer(now);
  if(screenShake>0)screenShake*=.84;
  player.vx += (player.c-player.vx)*.34; player.vy += (player.r-player.vy)*.34;
  checkExit(); updateHud();
}

function draw(now){
  ctx.clearRect(0,0,LOGICAL_W,LOGICAL_H);
  const pal=stage?.palette||WORLDS[0];
  ctx.fillStyle='#080c16';ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
  drawBackdrop(pal,now);
  if(!stage)return;
  ctx.save();
  if(screenShake>.2){ctx.translate((rng()-.5)*screenShake,(rng()-.5)*screenShake);}
  drawArena(pal,now); drawPickups(now); drawExit(now); drawBombs(now); drawExplosions(now); drawProjectiles(); drawEnemies(now); drawPlayer(now); drawFloating(now);
  ctx.restore();
}

function drawBackdrop(pal,now){
  const g=ctx.createRadialGradient(480,270,20,480,270,560);g.addColorStop(0,pal.floor+'cc');g.addColorStop(.6,'#101728');g.addColorStop(1,'#05070d');ctx.fillStyle=g;ctx.fillRect(0,0,960,540);
  ctx.globalAlpha=.08;ctx.strokeStyle=pal.accent;ctx.lineWidth=1;for(let x=-60;x<1020;x+=42){ctx.beginPath();ctx.moveTo(x+((now*.01)%42),0);ctx.lineTo(x-180+((now*.01)%42),540);ctx.stroke();}ctx.globalAlpha=1;
}
function cellRect(c,r,pad=0){return{x:arena.x+c*tileW+pad,y:arena.y+r*tileH+pad,w:tileW-pad*2,h:tileH-pad*2};}
function drawArena(pal){
  ctx.fillStyle='rgba(3,5,10,.85)';roundRect(ctx,arena.x-12,arena.y-12,arena.w+24,arena.h+24,18,true);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=2;roundRect(ctx,arena.x-12,arena.y-12,arena.w+24,arena.h+24,18,false,true);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const a=cellRect(c,r);ctx.fillStyle=(c+r)%2?pal.floor:pal.alt;ctx.fillRect(a.x,a.y,a.w+1,a.h+1);ctx.strokeStyle='rgba(255,255,255,.035)';ctx.strokeRect(a.x,a.y,a.w,a.h);if(stage.grid[r][c]===TILE.HARD)drawHard(a,pal);else if(stage.grid[r][c]===TILE.SOFT)drawSoft(a,pal);}
}
function drawHard(a,pal){ctx.fillStyle=pal.hard;roundRect(ctx,a.x+4,a.y+4,a.w-8,a.h-8,6,true);ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(a.x+8,a.y+8,a.w-16,4);ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(a.x+8,a.y+a.h-11,a.w-16,4);ctx.fillStyle='rgba(20,28,36,.7)';for(const [x,y] of [[a.x+10,a.y+11],[a.x+a.w-10,a.y+11],[a.x+10,a.y+a.h-10],[a.x+a.w-10,a.y+a.h-10]]){ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill();}}
function drawSoft(a,pal){ctx.fillStyle=pal.soft;roundRect(ctx,a.x+3,a.y+3,a.w-6,a.h-6,5,true);ctx.strokeStyle='rgba(0,0,0,.24)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x+8,a.y+8);ctx.lineTo(a.x+a.w-8,a.y+a.h-8);ctx.moveTo(a.x+a.w-8,a.y+8);ctx.lineTo(a.x+8,a.y+a.h-8);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=2;ctx.strokeRect(a.x+8,a.y+8,a.w-16,a.h-16);}
function drawPlayer(now){ if(!player.alive)return; const a=cellRect(player.vx,player.vy,5);const blink=now<player.invulnUntil&&Math.floor(now/90)%2===0;if(blink)return;const cx=a.x+a.w/2,cy=a.y+a.h/2;ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#e9f4ff';roundRect(ctx,-12,-12,24,27,8,true);ctx.fillStyle='#1b2940';roundRect(ctx,-10,-8,20,10,4,true);ctx.fillStyle='#61e8ff';ctx.fillRect(-6,-5,12,3);ctx.fillStyle='#ffc84a';ctx.beginPath();ctx.arc(0,-16,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#25334d';ctx.fillRect(-13,7,7,8);ctx.fillRect(6,7,7,8);ctx.restore();}
function drawBombs(now){ for(const b of bombs){if(b.exploded)continue;const a=cellRect(b.c,b.r);const cx=a.x+a.w/2,cy=a.y+a.h/2;const pulse=1+Math.sin(now/90)*.06;ctx.save();ctx.translate(cx,cy);ctx.scale(pulse,pulse);ctx.fillStyle=b.team==='enemy'?'#d64b57':b.type==='frost'?'#72efff':b.type==='pulse'?'#d785ff':b.type==='pierce'?'#ff8b55':b.type==='mine'?'#77e790':'#262b36';ctx.beginPath();ctx.arc(0,2,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.32)';ctx.beginPath();ctx.arc(-4,-3,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d6b95e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(4,-10);ctx.quadraticCurveTo(10,-17,13,-12);ctx.stroke();if(Number.isFinite(b.detonateAt)&&b.detonateAt-now<650){ctx.fillStyle='#fff27a';ctx.beginPath();ctx.arc(14,-13,4+Math.sin(now/45)*2,0,Math.PI*2);ctx.fill();}ctx.restore();}}
function drawExplosions(now){for(const ex of explosions){const alpha=Math.max(0,(ex.until-now)/360);for(const p of ex.cells){const a=cellRect(p.c,p.r,2);ctx.globalAlpha=.45+alpha*.55;ctx.fillStyle=ex.type==='frost'?'#7cf3ff':ex.team==='enemy'?'#ff5968':'#ffb52f';roundRect(ctx,a.x,a.y,a.w,a.h,10,true);ctx.fillStyle='#fffbe0';const inset=9+(1-alpha)*4;roundRect(ctx,a.x+inset,a.y+inset,a.w-inset*2,a.h-inset*2,5,true);}ctx.globalAlpha=1;}}
function drawPickups(now){for(const [k,type] of pickups){const[c,r]=k.split(',').map(Number);const a=cellRect(c,r,9);const y=a.y+Math.sin(now/180+c)*2;ctx.fillStyle='#101827';roundRect(ctx,a.x,y,a.w,a.h,7,true);ctx.strokeStyle='#ffe870';ctx.lineWidth=2;roundRect(ctx,a.x,y,a.w,a.h,7,false,true);ctx.fillStyle='#fff4a8';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';const icons={blast:'F+',bomb:'B+',speed:'>>',kick:'K',pulse:'P',pierce:'X',frost:'*',shield:'S',heart:'+'};ctx.fillText(icons[type]||'?',a.x+a.w/2,y+a.h/2);}}
function drawExit(now){if(!stage.exit.revealed)return;const open=enemies.every(e=>e.hp<=0);const a=cellRect(stage.exit.c,stage.exit.r,5);ctx.save();ctx.translate(a.x+a.w/2,a.y+a.h/2);ctx.rotate(now/800);ctx.strokeStyle=open?'#76f5ff':'#718096';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*1.5);ctx.stroke();ctx.rotate(Math.PI);ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*1.5);ctx.stroke();ctx.restore();}
function drawEnemies(now){for(const e of enemies){if(e.hp<=0)continue;const a=cellRect(e.c,e.r,5);const cx=a.x+a.w/2,cy=a.y+a.h/2;ctx.save();ctx.translate(cx,cy);if(e.frozenUntil>now)ctx.globalAlpha=.55;if(e.kind==='drifter'){ctx.fillStyle='#72df75';ctx.beginPath();ctx.arc(0,2,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#132318';ctx.fillRect(-6,-2,4,4);ctx.fillRect(3,-2,4,4);}else if(e.kind==='hunter'){ctx.fillStyle='#ff7d68';roundRect(ctx,-14,-12,28,24,8,true);ctx.fillStyle='#1b1520';ctx.fillRect(-8,-3,16,5);}else if(e.kind==='orb'){ctx.fillStyle='#d481ff';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f1c2ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();}else if(e.kind==='turret'){ctx.fillStyle='#49a6a0';roundRect(ctx,-15,-11,30,22,5,true);ctx.fillStyle='#173038';ctx.fillRect(-9,-4,18,8);ctx.fillStyle='#a7fff4';ctx.fillRect(-5,-2,10,3);}else if(e.kind==='spark'){ctx.fillStyle='#ffeb68';for(let i=0;i<8;i++){const ang=i*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(ang)*7,Math.sin(ang)*7);ctx.lineTo(Math.cos(ang)*17,Math.sin(ang)*17);ctx.strokeStyle='#ffeb68';ctx.lineWidth=3;ctx.stroke();}ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='#eb4f82';roundRect(ctx,-18,-16,36,32,10,true);ctx.fillStyle='#261325';roundRect(ctx,-12,-6,24,9,4,true);ctx.fillStyle='#ffdf6b';ctx.fillRect(-7,-3,14,3);ctx.fillStyle='#fff';ctx.font='900 9px system-ui';ctx.textAlign='center';ctx.fillText(`${e.hp}`,0,21);}ctx.restore();}}
function drawProjectiles(){for(const p of projectiles){const a=cellRect(p.c,p.r);ctx.fillStyle='#ff664a';ctx.beginPath();ctx.arc(a.x+a.w/2,a.y+a.h/2,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffe887';ctx.beginPath();ctx.arc(a.x+a.w/2,a.y+a.h/2,3,0,Math.PI*2);ctx.fill();}}
function drawFloating(now){floatingText=floatingText.filter(f=>now-f.created<f.duration);for(const f of floatingText){const t=(now-f.created)/f.duration;const a=cellRect(f.c,f.r);ctx.globalAlpha=1-t;ctx.fillStyle=f.color;ctx.font='900 11px system-ui';ctx.textAlign='center';ctx.fillText(f.text,a.x+a.w/2,a.y-4-t*20);ctx.globalAlpha=1;}}
function roundRect(c,x,y,w,h,r,fill,stroke=false){c.beginPath();c.roundRect(x,y,w,h,r);if(fill)c.fill();if(stroke)c.stroke();}

function cue(kind,volume=1){
  if(audioMuted)return; try{ audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume(); const t=audioCtx.currentTime; const o=audioCtx.createOscillator();const g=audioCtx.createGain();const settings={drop:[150,.06],boom:[65,.18],frost:[380,.2],pickup:[720,.1],enemy:[210,.08],hurt:[95,.22],clear:[660,.3],start:[440,.12],select:[520,.05],deny:[110,.05],trigger:[880,.06],kick:[240,.05],step:[85,.025],shield:[540,.12],shot:[330,.06],enemyDrop:[120,.05]};const [freq,dur]=settings[kind]||[220,.05];o.type=kind==='boom'||kind==='hurt'?'sawtooth':'square';o.frequency.setValueAtTime(freq,t);if(kind==='clear')o.frequency.exponentialRampToValueAtTime(990,t+dur);g.gain.setValueAtTime(.035*volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+dur);}catch{}
}
function haptic(pattern){try{navigator.vibrate?.(pattern)}catch{}}

function frame(now){ last=now;update(now);draw(now);requestAnimationFrame(frame); }
requestAnimationFrame(frame);

document.querySelectorAll('.dir').forEach(btn=>{const dir=btn.dataset.dir;const down=e=>{e.preventDefault();heldDir=dir;btn.classList.add('active');tryMovePlayer(dir);};const up=e=>{e.preventDefault();if(heldDir===dir)heldDir=null;btn.classList.remove('active');};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);});
ui.bomb.addEventListener('pointerdown',e=>{e.preventDefault();placeBomb();});ui.mode.addEventListener('click',cycleMode);ui.ability.addEventListener('click',triggerAction);ui.pause.addEventListener('click',pauseGame);ui.newGame.addEventListener('click',beginNewRun);ui.continueBtn.addEventListener('click',()=>{if(!loadGame())beginNewRun();});ui.how.addEventListener('click',showHow);
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter','KeyX','KeyZ','Escape'].includes(e.code))e.preventDefault();const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(map[e.code]){heldDir=map[e.code];tryMovePlayer(heldDir);}if(e.code==='Space'||e.code==='KeyZ')placeBomb();if(e.code==='KeyX')triggerAction();if(e.code==='Enter')cycleMode();if(e.code==='Escape')state==='paused'?resumeGame():pauseGame();});window.addEventListener('keyup',e=>{const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};if(map[e.code]===heldDir)heldDir=null;});
window.addEventListener('blur',()=>{if(state==='playing')pauseGame();});

ui.continueBtn.disabled=!localStorage.getItem(SAVE_KEY);if(ui.continueBtn.disabled){ui.continueBtn.style.opacity='.45';}
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
