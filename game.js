// Spectrum Egg Kong — ZX-style platformer
// Menu com gorila, 10 níveis progressivos, sprites pixel-art nítidos.
// Música chiptune ORIGINAL (WebAudio). MIT License.

(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const WIDTH = canvas.width, HEIGHT = canvas.height;

  // ===== Config & Estado =====
  const GRAV = 0.35, JUMP_V = -6.2, MOVE_V = 2.0;
  let running = false, frame = 0, gameState = 'MENU'; // MENU | PLAY | WIN | GAMEOVER
  let soundOn = true;
  let currentLevel = 0; // 0..9 (10 níveis)

  // Paleta ZX
  const ZX = {
    BLACK:"#000000", BLUE:"#0000D7", RED:"#D70000", MAGENTA:"#D700D7",
    GREEN:"#00D700", CYAN:"#00D7D7", YELLOW:"#D7D700", WHITE:"#D7D7D7", BRIGHT_WHITE:"#FFFFFF"
  };

  // ===== Input =====
  const keys = {};
  const onKey = (e,down) => { keys[e.code] = down; if(down && !running) startGame(); };
  window.addEventListener('keydown', e => onKey(e,true));
  window.addEventListener('keyup',   e => onKey(e,false));

  // Mobile buttons
  const startBtn = document.getElementById('startBtn');
  const bindBtn = (id, code) => {
    const el = document.getElementById(id); if(!el) return;
    const on = () => keys[code] = true;
    const off = () => keys[code] = false;
    el.addEventListener('touchstart', ev => { ev.preventDefault(); on(); }, {passive:false});
    el.addEventListener('touchend', off);
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  };
  bindBtn("btnLeft","ArrowLeft"); bindBtn("btnRight","ArrowRight");
  bindBtn("btnUp","ArrowUp"); bindBtn("btnDown","ArrowDown"); bindBtn("btnJump","Space");
  if (startBtn) startBtn.addEventListener('click', () => startGame());
  canvas.addEventListener('click', ()=> { if(gameState==='MENU') beginLevel(); });

  // ===== Áudio =====
  let audioCtx, masterGain;
  function initAudio(){
    if(audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(audioCtx.destination);
  }
  function beep(freq=440, dur=0.1, type='square', vol=0.2){
    if(!audioCtx || !soundOn) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = 0; osc.connect(g); g.connect(masterGain);
    osc.start(t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.stop(t0 + dur + 0.02);
  }
  // Música (loop simples original)
  const BPM = 132, beat = () => 60/BPM;
  const melody = [[0,1],[4,1],[7,1],[12,1],[9,1],[7,1],[4,1],[0,1],[2,1],[5,1],[9,1],[14,1],[12,1],[9,1],[5,1],[2,1]];
  let musicTimer = 0, musicIndex = 0;
  function tickMusic(dt){
    if(!audioCtx || !soundOn) return;
    musicTimer -= dt;
    if(musicTimer <= 0){
      const [semi, beats] = melody[musicIndex];
      const freq = 440 * Math.pow(2, semi/12);
      beep(freq, beats * beat() * 0.9, 'square', 0.09);
      musicTimer = beats * beat();
      musicIndex = (musicIndex + 1) % melody.length;
    }
  }
  const sfx = {
    jump(){ beep(720, 0.08, 'square', 0.12); },
    pickup(){ beep(1250, 0.05, 'square', 0.14); beep(1650, 0.05, 'square', 0.12); },
    hurt(){ beep(180, 0.25, 'square', 0.15); },
    win(){ [0,4,7,12].forEach((semi,i)=>setTimeout(()=>beep(440*Math.pow(2,semi/12),0.08,'square',0.13), i*90)); }
  };

  // ===== Sprites (estilo Chuckie Egg — arte original incluída aqui) =====
  const SPRITES = {};
  function spriteFromPattern(palette, pattern) {
    const h = pattern.length, w = pattern[0].length;
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const d = off.getContext('2d'); d.imageSmoothingEnabled = false;
    const imgData = d.createImageData(w, h);
    const put = (x,y,rgba)=>{ const i=(y*w+x)*4; imgData.data[i]=rgba[0]; imgData.data[i+1]=rgba[1]; imgData.data[i+2]=rgba[2]; imgData.data[i+3]=rgba[3]; };
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ put(x,y, palette[ pattern[y][x] ] || [0,0,0,0]); }
    d.putImageData(imgData,0,0);
    const img = new Image(); img.src = off.toDataURL(); return img;
  }
  const P = {
    K:[0,0,0,255], W:[235,235,235,255], Y:[215,215,0,255],
    B:[0,0,215,255], R:[215,0,0,255], G:[0,215,0,255],
    C:[139,69,19,255], T:[0,0,0,0]
  };

  // Agricultor (16x16) 2 frames (flat)
  const HARRY_F1 = [
  "TTTTKKYKKTTTTTTT","TTTKKYYYKKTTTTTT","TTTKYYYYYKT TTTT".replace(' ','T'),"TTTKYWWWYKT TTTT".replace(' ','T'),
  "TTTKYYYYYKT TTTT".replace(' ','T'),"TTTTKGGGKTTTTTTT","TTTTKGBBGKTTTTTT","TTTTKGBBGKTTTTTT",
  "TTTTKGBBGKTTTTTT","TTTTKBBBBKTTTTTT","TTTTKBBBBKTTTTTT","TTTTKBBBBKTTTTTT",
  "TTTTKBTTBKTTTTTT","TTTTKBTTBKTTTTTT","TTTTRKTTTKRTTTTT","TTTTTTTTTTTTTTTT"];
  const HARRY_F2 = [
  "TTTTKKYKKTTTTTTT","TTTKKYYYKKTTTTTT","TTTKYYYYYKT TTTT".replace(' ','T'),"TTTKYWWWYKT TTTT".replace(' ','T'),
  "TTTKYYYYYKT TTTT".replace(' ','T'),"TTTTKGGGKTTTTTTT","TTTTKGBBGKTTTTTT","TTTTKGBBGKTTTTTT",
  "TTTTKGBBGKTTTTTT","TTTTKBBBBKTTTTTT","TTTTKBBBBKTTTTTT","TTTTKBBBBKTTTTTT",
  "TTTTKBTBBKTTTTTT","TTTTKBTBBKTTTTTT","TTTTRKTTTKRTTTTT","TTTTTTTTTTTTTTTT"];
  function buildHarry(p){ return spriteFromPattern({K:P.K,W:P.W,Y:P.Y,G:P.G,B:P.B,R:P.R,T:P.T}, p); }
  SPRITES.player = [ buildHarry(HARRY_F1), buildHarry(HARRY_F2) ];

  // Gorila (castanho) 2 frames (piscar)
  const KONG_OPEN = [
  "TTTTTTKKKKTTTTTT","TTTTTKCCCCKKTTTT","TTTTKCCCCCCKTTTT","TTTKCCCWWCCCKTTT",
  "TTKCCCCYYCCCCKTT","TTKCCCYYYYCCCKTT","TTKCCCCYYYYCCKTT","TTKCCCCYYYYCCKTT",
  "TTKCCCCYYYYCCKTT","TTKCCCCCCCCCCKTT","TTTKCCCCCCCCKTTT","TTTTKCCCCCCKTTTT",
  "TTTTKCCCCCCKTTTT","TTTTKCCKKCCKTTTT","TTTTKCTTTTCKTTTT","TTTTTTKKKKTTTTTT"];
  const KONG_BLINK = KONG_OPEN.map((row,y)=> y===3 ? row.replace(/W/g,"Y") : row);
  function buildKong(p){ return spriteFromPattern({K:P.K,C:P.C,Y:P.Y,W:P.W,T:P.T}, p); }
  SPRITES.kong = [ buildKong(KONG_OPEN), buildKong(KONG_BLINK) ];

  // Ovo
  const EGG = [
  "TTTTTTTTTTTTTTTT","TTTTTTTWWWTTTTTT","TTTTTTWWWWWTTTTT","TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT","TTTTTWWWWWWWTTTT","TTTTTWWWWWWWTTTT","TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT","TTTTTTWWWWWTTTTT","TTTTTTTWWWTTTTTT","TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT","TTTTTTTTTTTTTTTT","TTTTTTTTTTTTTTTT","TTTTTTTTTTTTTTTT"];
  SPRITES.egg = spriteFromPattern({W:P.W,T:P.T}, EGG);

  // Barril
  const BARREL = [
  "TTTTTTTTTTTTTTTT","TTTTTTKRRRRKTTTT","TTTTKRRBBBBRRKTT","TTTKRBBBBBBBBRKT",
  "TTTKRBBBBBBBBRKT","TTTKRBBRRRBBBRTT","TTTKRBBBBBBBBRKT","TTTKRBBBBBBBBRKT",
  "TTTKRBBRRRBBBRTT","TTTKRBBBBBBBBRKT","TTTKRBBBBBBBBRKT","TTTTKRRBBBBRRKTT",
  "TTTTTTKRRRRKTTTT","TTTTTTTTTTTTTTTT","TTTTTTTTTTTTTTTT","TTTTTTTTTTTTTTTT"];
  SPRITES.barrel = spriteFromPattern({K:P.K,R:P.R,B:P.B,T:P.T}, BARREL);

  // Escada (apenas UMA definição!)
  const LADDER_PATTERN = Array.from({length:16},(_,y)=>{
    const arr = "TTTTTTTTTTTTTTTT".split("");
    arr[5]="Y"; arr[10]="Y";
    if (y%3===1) for(let x=5;x<=10;x++) arr[x]="Y";
    return arr.join("");
  });
  SPRITES.ladder = spriteFromPattern({Y:P.Y,T:P.T}, LADDER_PATTERN);

  // ===== Níveis (10) =====
  // 0 vazio, 1 sólido, 2 escada; escadas são aplicadas à grelha base
  const LEVEL_LAYOUTS = [
    [
      "0000000000000000","0000000000000000","0000000000000000","0000111111110000",
      "0000000000000000","0111111000001110","0000000000000000","0011111111100000",
      "0000000000000000","0111110000011110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0000000011111000","0000000000000000","0011111100000000",
      "0000000000000000","0000011111110000","0000000000000000","0000000001111100",
      "0000000000000000","0111110000011110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0000111111000000","0000000000000000","0000000011111100",
      "0000000000000000","0011111100000000","0000000000000000","0000000001111110",
      "0000000000000000","0111111000011110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0000001111110000","0000000000000000","0111110000011110",
      "0000000000000000","0000011111000000","0000000000000000","0011111000001110",
      "0000000000000000","0000000011111100","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0000001111110000","0000000000000000","0001111111111000",
      "0000000000000000","0111110000011110","0000000000000000","0000111111100000",
      "0000000000000000","0111111000011110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0000111110000000","0000000000000000","0000000001111100",
      "0000000000000000","0011111100001110","0000000000000000","0111110000011110",
      "0000000000000000","0000011111110000","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0001111100001110","0000000000000000","0111110000111110",
      "0000000000000000","0000011111110000","0000000000000000","0011111000001110",
      "0000000000000000","0111110000011110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0011111111111100","0000000000000000","0000001111110000",
      "0000000000000000","0111110000011110","0000000000000000","0000011111110000",
      "0000000000000000","0011111000001110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0000111111110000","0000000000000000","0111110001111110",
      "0000000000000000","0000011111000000","0000000000000000","0011111111001110",
      "0000000000000000","0111110000011110","0000000000000000","1111111111111111",
    ],
    [
      "0000000000000000","0011111111111100","0000000000000000","0111110000011110",
      "0000000000000000","0000011111110000","0000000000000000","0011111111111110",
      "0000000000000000","0111110000011110","0000000000000000","1111111111111111",
    ],
  ];

  const LEVEL_LADDERS = [
    [{x:3,y:3,h:2},{x:10,y:3,h:2},{x:2,y:5,h:3},{x:14,y:5,h:3},{x:6,y:7,h:2},{x:10,y:7,h:2},{x:1,y:9,h:2},{x:13,y:9,h:2}],
    [{x:2,y:1,h:3},{x:6,y:3,h:3},{x:12,y:5,h:3},{x:4,y:7,h:3},{x:10,y:9,h:2}],
    [{x:3,y:1,h:3},{x:8,y:3,h:3},{x:13,y:5,h:3},{x:5,y:7,h:3},{x:11,y:9,h:2}],
    [{x:5,y:1,h:3},{x:2,y:3,h:3},{x:12,y:5,h:3},{x:8,y:7,h:3},{x:14,y:9,h:2}],
    [{x:2,y:1,h:3},{x:7,y:3,h:3},{x:12,y:5,h:3},{x:5,y:7,h:3},{x:10,y:9,h:2}],
    [{x:4,y:1,h:3},{x:9,y:3,h:3},{x:13,y:5,h:3},{x:6,y:7,h:3},{x:1,y:9,h:2}],
    [{x:3,y:1,h:3},{x:7,y:3,h:3},{x:11,y:5,h:3},{x:5,y:7,h:3},{x:13,y:9,h:2}],
    [{x:2,y:1,h:3},{x:6,y:3,h:3},{x:10,y:5,h:3},{x:4,y:7,h:3},{x:12,y:9,h:2}],
    [{x:1,y:1,h:3},{x:5,y:3,h:3},{x:9,y:5,h:3},{x:13,y:7,h:3},{x:7,y:9,h:2}],
    [{x:2,y:1,h:3},{x:8,y:3,h:3},{x:12,y:5,h:3},{x:6,y:7,h:3},{x:10,y:9,h:2}],
  ];

  // Dificuldade por nível
  function levelConfig(idx){
    const baseSpawn = Math.max(1.15, 3.0 - idx*0.18);
    const speed = 1.4 + idx*0.12;
    const maxBarrels = 3 + Math.floor(idx/2);
    const eggsCount = 6 + Math.min(4, Math.floor(idx/2)); // 6..10
    return { baseSpawn, speed, maxBarrels, eggsCount };
  }

  // ===== Mundo e entidades =====
  const TILE = 16, mapW = 16, mapH = 12;
  let levelGrid = null;
  let player, kong, barrels, eggs;
  let spawnTimer = 0;

  function parseLevel(idx){
    const rows = LEVEL_LAYOUTS[idx].map(r => r.split('').map(c => +c));
    LEVEL_LADDERS[idx].forEach(L=>{
      for(let i=0;i<L.h;i++){
        if(rows[L.y - i] && rows[L.y - i][L.x] !== undefined) rows[L.y - i][L.x] = 2;
      }
    });
    return rows;
  }
  function placeEggs(rows, idx){
    const candidates = [];
    for(let y=1;y<mapH;y++){
      for(let x=0;x<mapW;x++){
        if(rows[y][x]===1 && rows[y-1][x]!==1) candidates.push({x, y});
      }
    }
    const { eggsCount } = levelConfig(idx);
    const selected = [];
    if(candidates.length === 0) return selected;
    for(let i=0;i<eggsCount;i++){
      const pos = Math.floor(i * (candidates.length-1) / Math.max(1,eggsCount-1));
      selected.push(candidates[pos]);
    }
    return selected.map(c => ({ x: c.x*TILE + 8, y: c.y*TILE - 8 }));
  }
  function loadLevel(idx){
    currentLevel = idx;
    levelGrid = parseLevel(idx);
    eggs = placeEggs(levelGrid, idx);
    player = { x:16, y:HEIGHT-32, w:12, h:14, dx:0, dy:0, onGround:false, climbing:false, score:0 };
    kong = { x: WIDTH-40, y: 16, t:0 };
    barrels = [];
    const { baseSpawn } = levelConfig(idx);
    spawnTimer = baseSpawn;
  }

  // utilitários tiles
  function solidAt(px,py){
    const tx = Math.floor(px/TILE), ty = Math.floor(py/TILE);
    if(tx<0||ty<0||tx>=mapW||ty>=mapH) return true;
    return levelGrid[ty][tx]===1;
  }
  function ladderAt(px,py){
    const tx = Math.floor(px/TILE), ty = Math.floor(py/TILE);
    if(tx<0||ty<0||tx>=mapW||ty>=mapH) return false;
    return levelGrid[ty][tx]===2;
  }
  function rectsOverlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  // ===== Loop principal =====
  let last=0;
  function startGame(){
    initAudio(); if(audioCtx.state === "suspended") audioCtx.resume();
    if(!running){
      const ui = document.getElementById('ui'); if(ui) ui.style.display='none';
      running = true; gameState = 'MENU'; last = performance.now();
      requestAnimationFrame(loop);
    }
  }
  function loop(ts){
    const dt = Math.min(0.05, (ts-last)/1000);
    last = ts;
    update(dt);
    draw();
    frame++;
    if(running) requestAnimationFrame(loop);
  }
  function beginLevel(){ loadLevel(currentLevel); gameState = 'PLAY'; }

  function update(dt){
    ctx.imageSmoothingEnabled = false;
    tickMusic(dt);

    // MENU inputs
    if(gameState === 'MENU'){
      if(keys["ArrowLeft"]){ currentLevel = (currentLevel+9)%10; keys["ArrowLeft"]=false; }
      if(keys["ArrowRight"]){ currentLevel = (currentLevel+1)%10; keys["ArrowRight"]=false; }
      if(keys["KeyM"]){ soundOn = !soundOn; keys["KeyM"]=false; }
      if(keys["Enter"]||keys["Space"]){ keys["Enter"]=keys["Space"]=false; beginLevel(); }
      for(let d=1; d<=9; d++){ if(keys["Digit"+d]){ currentLevel = d-1; keys["Digit"+d]=false; } }
      if(keys["Digit0"]){ currentLevel = 9; keys["Digit0"]=false; }
      return;
    }
    if(gameState !== 'PLAY') return;

    const cfg = levelConfig(currentLevel);

    // Spawn barris
    spawnTimer -= dt;
    if(spawnTimer <= 0 && barrels.length < cfg.maxBarrels){
      barrels.push({x: kong.x-4, y: kong.y+8, dx: -(cfg.speed + Math.random()*0.6), dy:0, w:10, h:10});
      spawnTimer = cfg.baseSpawn + Math.random()*0.8;
    }

    // Movimento jogador
    if(keys["ArrowLeft"]) player.dx = -MOVE_V;
    else if(keys["ArrowRight"]) player.dx = MOVE_V;
    else player.dx = 0;

    const onLadderMid = ladderAt(player.x+player.w/2, player.y+player.h/2);
    if(onLadderMid && (keys["ArrowUp"] || keys["ArrowDown"])) player.climbing = true;
    if(player.climbing){
      if(keys["ArrowUp"]) player.dy = -1.5; else if(keys["ArrowDown"]) player.dy = 1.5; else player.dy = 0;
      if(keys["Space"]) player.climbing = false;
    } else {
      player.dy += GRAV;
      if(keys["Space"] && player.onGround){ player.dy = JUMP_V; player.onGround = false; sfx.jump(); }
    }

    // Integração + colisões
    player.x += player.dx;
    if(player.dx>0 && (solidAt(player.x+player.w, player.y) || solidAt(player.x+player.w, player.y+player.h-1))){
      player.x = Math.floor((player.x+player.w)/TILE)*TILE - player.w - 0.01;
    } else if(player.dx<0 && (solidAt(player.x, player.y) || solidAt(player.x, player.y+player.h-1))){
      player.x = Math.floor(player.x/TILE+1)*TILE + 0.01;
    }

    player.y += player.dy;
    if(player.dy>0 && (solidAt(player.x+1, player.y+player.h) || solidAt(player.x+player.w-1, player.y+player.h))){
      player.y = Math.floor((player.y+player.h)/TILE)*TILE - player.h - 0.01; player.dy = 0; player.onGround = true;
    } else if(player.dy<0 && (solidAt(player.x+1, player.y) || solidAt(player.x+player.w-1, player.y))){
      player.y = Math.floor(player.y/TILE+1)*TILE + 0.01; player.dy = 0;
    } else if(player.dy>0){ player.onGround = false; }

    // Limites
    player.x = Math.max(0, Math.min(WIDTH-player.w, player.x));
    player.y = Math.max(0, Math.min(HEIGHT-player.h, player.y));

    // Barris
    barrels.forEach(b => {
      b.x += b.dx;
      const underSolid = solidAt(b.x+5, b.y+10);
      if(!underSolid) b.dy += GRAV; else b.dy = 0;
      b.y += b.dy;
      if(b.x < -20){ b.x = WIDTH + 10; b.y = 32 + Math.random()*40; }
      if(solidAt(b.x+2, b.y+10)){ const ty = Math.floor((b.y+10)/TILE); b.y = ty*TILE - 10 - 0.01; b.dy = 0; }
    });

    // Colisão com barris
    for(const b of barrels){ if(rectsOverlap(player,b)){ sfx.hurt(); gameState='GAMEOVER'; setTimeout(()=>gameState='MENU', 700); return; } }

    // Ovos
    eggs = eggs.filter(e => {
      const hit = Math.abs(player.x - e.x) < 10 && Math.abs(player.y - e.y) < 12;
      if(hit){ player.score += 100; sfx.pickup(); }
      return !hit;
    });

    // Vitória avança nível
    if(eggs.length === 0){
      sfx.win();
      if(currentLevel < 9){ currentLevel++; loadLevel(currentLevel); }
      else { gameState = 'WIN'; setTimeout(()=>gameState='MENU', 1400); }
    }

    // Kong anim
    kong.t += dt; kong.x = WIDTH-40 + Math.sin(kong.t*2)*4;
  }

  // ===== Render =====
  function pixChar(ch, x, y, color){
    const map = {
      '0':["111","101","101","101","101","111"], '1':["010","110","010","010","010","111"],
      '2':["111","001","001","111","100","111"], '3':["111","001","011","001","001","111"],
      '4':["101","101","101","111","001","001"], '5':["111","100","111","001","001","111"],
      '6':["111","100","111","101","101","111"], '7':["111","001","001","001","001","001"],
      '8':["111","101","111","101","101","111"], '9':["111","101","111","001","001","111"],
      'A':["010","101","101","111","101","101"], 'B':["110","101","110","101","101","110"],
      'C':["011","100","100","100","100","011"], 'D':["110","101","101","101","101","110"],
      'E':["111","100","110","100","100","111"], 'F':["111","100","110","100","100","100"],
      'G':["011","100","100","101","101","011"], 'H':["101","101","111","101","101","101"],
      'I':["111","010","010","010","010","111"], 'K':["101","101","110","101","101","101"],
      'L':["100","100","100","100","100","111"], 'M':["111","111","101","101","101","101"],
      'N':["101","111","111","101","101","101"], 'O':["010","101","101","101","101","010"],
      'P':["110","101","110","100","100","100"], 'R':["110","101","110","110","101","101"],
      'S':["011","100","011","001","001","110"], 'T':["111","010","010","010","010","010"],
      'U':["101","101","101","101","101","111"], 'V':["101","101","101","101","101","010"],
      'Y':["101","101","010","010","010","010"], ' ':["000","000","000","000","000","000"]
    };
    const g = map[ch] || map[' '];
    ctx.fillStyle = color;
    for(let r=0;r<6;r++) for(let c=0;c<3;c++) if(g[r][c]==='1') ctx.fillRect(x+c+0.5, y+r+0.5, 1,1);
  }
  function pixText(s, x, y, color){
    s = s.toUpperCase();
    for(let i=0;i<s.length;i++) pixChar(s[i], x + i*4, y, color);
  }

  function draw(){
    // Borda ZX animada
    const borderColors = [ZX.BLUE, ZX.RED, ZX.MAGENTA, ZX.GREEN, ZX.CYAN, ZX.YELLOW, ZX.WHITE];
    const border = borderColors[(frame>>2)%borderColors.length];
    canvas.style.borderColor = border;
    ctx.fillStyle = ZX.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);

    if(gameState==='MENU'){
      // Fundo com linhas
      for(let y=0;y<HEIGHT;y+=16){ ctx.fillStyle = (y/16)%2? "#001400":"#001000"; ctx.fillRect(0,y,WIDTH,16); }
      // Título
      ctx.fillStyle = ZX.BRIGHT_WHITE; ctx.fillRect(0,8,WIDTH,10);
      pixText("SPECTRUM", 12, 10, ZX.BLACK);
      pixText("EGG  KONG", 12, 16, ZX.BLACK);
      // Gorila grande no topo (truque: desenhar 2x lado a lado para parecer 2x largo)
      const kf = (Math.floor(frame/30)%2);
      ctx.drawImage(SPRITES.kong[kf], WIDTH-56, 22);
      ctx.drawImage(SPRITES.kong[kf], WIDTH-56+16, 22);
      // Texto de instruções
      pixText(`LEVEL ${currentLevel+1}/10`, 8, 48, ZX.YELLOW);
      pixText("LEFT/RIGHT: ESCOLHER", 8, 60, ZX.WHITE);
      pixText("ENTER/SPACE: JOGAR", 8, 68, ZX.WHITE);
      pixText(`M: SOM ${soundOn?"ON":"OFF"}`, 8, 76, soundOn?ZX.GREEN:ZX.RED);
      return;
    }

    // Tiles (plataformas e escadas)
    for(let y=0;y<mapH;y++){
      for(let x=0;x<mapW;x++){
        const t = levelGrid[y][x];
        if(t===1){
          ctx.fillStyle = ZX.GREEN;
          ctx.fillRect(x*TILE, y*TILE, TILE, 2);
          ctx.fillRect(x*TILE, y*TILE+2, TILE, 2);
        } else if(t===2){
          ctx.drawImage(SPRITES.ladder, x*TILE, y*TILE);
        }
      }
    }

    // Kong (2 frames a piscar)
    const kongFrame = (Math.floor(frame/30) % 2);
    ctx.drawImage(SPRITES.kong[kongFrame], kong.x-8, kong.y-8);

    // Barris
    barrels.forEach(b => ctx.drawImage(SPRITES.barrel, b.x-5, b.y-5));

    // Ovos
    eggs.forEach(e => ctx.drawImage(SPRITES.egg, e.x-4, e.y-6));

    // Jogador (2 frames quando em movimento/escada)
    const moving = Math.abs(player.dx) > 0.1 || player.climbing;
    const playerFrame = moving ? (Math.floor(frame/8) % 2) : 0;
    ctx.drawImage(SPRITES.player[playerFrame], Math.round(player.x), Math.round(player.y));

    // HUD
    ctx.fillStyle = ZX.BRIGHT_WHITE; ctx.fillRect(0,0,WIDTH,8);
    pixText(`LEVEL ${currentLevel+1}`, 4, 1, ZX.BLACK);
    pixText('EGGS '+eggs.length, WIDTH-70, 1, ZX.BLACK);
  }

})();
