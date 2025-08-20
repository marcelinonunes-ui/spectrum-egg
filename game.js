// Spectrum Egg Kong — ZX-style platformer (com sprites desenhados por código)
// MIT License. Música chiptune ORIGINAL via WebAudio (inspirada, NÃO é a melodia de Chuckie Egg).

(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const WIDTH = canvas.width, HEIGHT = canvas.height;

  // Física
  const GRAV = 0.35;
  const JUMP_V = -6.2;
  const MOVE_V = 2.0;
  let running = false;
  let frame = 0;

  // Paleta ZX
  const ZX = {
    BLACK:"#000000", BLUE:"#0000D7", RED:"#D70000", MAGENTA:"#D700D7",
    GREEN:"#00D700", CYAN:"#00D7D7", YELLOW:"#D7D700", WHITE:"#D7D7D7", BRIGHT_WHITE:"#FFFFFF"
  };

  // Input
  const keys = {};
  const onKey = (e,down) => { keys[e.code] = down; if(down && !running) startGame(); };
  window.addEventListener('keydown', e => onKey(e,true));
  window.addEventListener('keyup',   e => onKey(e,false));

  // Mobile
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
  bindBtn("btnLeft","ArrowLeft");
  bindBtn("btnRight","ArrowRight");
  bindBtn("btnUp","ArrowUp");
  bindBtn("btnDown","ArrowDown");
  bindBtn("btnJump","Space");
  if (startBtn) startBtn.addEventListener('click', () => startGame());

  // Áudio
  let audioCtx, masterGain;
  function initAudio(){
    if(audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.15;
    masterGain.connect(audioCtx.destination);
  }
  function beep(freq=440, dur=0.1, type='square', vol=0.2){
    if(!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g); g.connect(masterGain);
    osc.start(t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.stop(t0 + dur + 0.02);
  }
  // Música (loop original)
  const BPM = 130;
  const beat = () => 60 / BPM;
  const melody = [
    [0,1],[4,1],[7,1],[12,1],
    [9,1],[7,1],[4,1],[0,1],
    [2,1],[5,1],[9,1],[14,1],
    [12,1],[9,1],[5,1],[2,1],
  ];
  let musicTimer = 0, musicIndex = 0;
  function tickMusic(dt){
    if(!audioCtx) return;
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
    jump(){ beep(700, 0.08, 'square', 0.12); },
    pickup(){ beep(1200, 0.06, 'square', 0.15); beep(1600, 0.05, 'square', 0.12); },
    hurt(){ beep(180, 0.25, 'square', 0.15); },
    win(){ [0,4,7,12].forEach((semi,i)=>setTimeout(()=>beep(440*Math.pow(2,semi/12),0.08,'square',0.13), i*90)); }
  };

  // Tiles
  const TILE = 16, mapW=16, mapH=12;
  // 0 vazio, 1 sólido, 2 escada
  const level = [
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
    "0000111111110000",
    "0000000000000000",
    "0111111000001110",
    "0000000000000000",
    "0011111111100000",
    "0000000000000000",
    "0111110000011110",
    "0000000000000000",
    "1111111111111111",
  ].map(row => row.split('').map(c => +c));

  const ladders = [
    {x:3,y:3,h:2},{x:10,y:3,h:2},
    {x:2,y:5,h:3},{x:14,y:5,h:3},
    {x:6,y:7,h:2},{x:10,y:7,h:2},
    {x:1,y:9,h:2},{x:13,y:9,h:2},
  ];
  ladders.forEach(L=>{ for(let i=0;i<L.h;i++){ if(level[L.y-i] && level[L.y-i][L.x]!==undefined) level[L.y-i][L.x]=2; } });

  // ===== Sprites desenhados por código (melhorados e animados) =====
  const SPRITES = {};

  // utilitário: cria sprite a partir de padrão (matriz de chars)
  function spriteFromPattern(palette, pattern) {
    const h = pattern.length;
    const w = pattern[0].length;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const d = off.getContext('2d');
    const imgData = d.createImageData(w, h);
    const putPixel = (x,y,rgba)=>{
      const i = (y*w+x)*4;
      imgData.data[i+0]=rgba[0];
      imgData.data[i+1]=rgba[1];
      imgData.data[i+2]=rgba[2];
      imgData.data[i+3]=rgba[3];
    };
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const k = pattern[y][x];
        const col = palette[k] || [0,0,0,0];
        putPixel(x,y,col);
      }
    }
    d.putImageData(imgData,0,0);
    const img = new Image();
    img.src = off.toDataURL();
    return img;
  }

  // paleta RGBA mapeada a letras
  const P = {
    K: [0,0,0,255],            // preto
    W: [215,215,215,255],      // branco
    Y: [215,215,0,255],        // amarelo
    B: [0,0,215,255],          // azul
    R: [215,0,0,255],          // vermelho
    G: [0,215,0,255],          // verde
    T: [0,0,0,0]               // transparente
  };

  // Agricultor (16x16) — 2 frames (passo)
  const FARMER_FRAME_1 = [
  "TTTTKYYYKKTTTTTT",
  "TTTKYYYYYYKTTTTT",
  "TTKYYYYYYYYKTTTT",
  "TTKYWYWYWYYKTTTT",
  "TTTKYYYYYYKTTTTT",
  "TTTTKGGGKTTTTTTT",
  "TTTTKGBBGKTTTTTT",
  "TTTTKGBBGKTTTTTT",
  "TTTTKGBBGKTTTTTT",
  "TTTTKBBBBKTTTTTT",
  "TTTTKBBBBKTTTTTT",
  "TTTTKBBBBKTTTTTT",
  "TTTTKBTTBKTTTTTT",
  "TTTTKBTTBKTTTTTT",
  "TTTTRKTTTKRTTTTT",
  "TTTTTTTTTTTTTTTT",
  ];
  const FARMER_FRAME_2 = [
  "TTTTKYYYKKTTTTTT",
  "TTTKYYYYYYKTTTTT",
  "TTKYYYYYYYYKTTTT",
  "TTKYWKWYWYYKTTTT",
  "TTTKYYYYYYKTTTTT",
  "TTTTKGGGKTTTTTTT",
  "TTTTKGBBGKTTTTTT",
  "TTTTKGBBGKTTTTTT",
  "TTTTKGBBGKTTTTTT",
  "TTTTKBBBBKTTTTTT",
  "TTTTKBBBBKTTTTTT",
  "TTTTKBBBBKTTTTTT",
  "TTTTKBTBBKTTTTTT",
  "TTTTKBTBBKTTTTTT",
  "TTTTRKTTTKRTTTTT",
  "TTTTTTTTTTTTTTTT",
  ];
  function buildFarmer(pat){ return spriteFromPattern({K:P.K,Y:P.Y,W:P.W,G:P.G,B:P.B,R:P.R,T:P.T}, pat); }
  SPRITES.player = [ buildFarmer(FARMER_FRAME_1), buildFarmer(FARMER_FRAME_2) ];

  // Gorila (Kong) — 2 frames (piscar)
  const KONG_OPEN = [
  "TTTTTTKKKKTTTTTT",
  "TTTTTKBBBBKKTTTT",
  "TTTTKBBBBBBKTTTT",
  "TTTKBBBWYBBBKTTT",
  "TTKBBBBYYBBBBKTT",
  "TTKBBBYYYYBBBKTT",
  "TTKBBBBYYYYBBKTT",
  "TTKBBBBYYYYBBKTT",
  "TTKBBBBYYYYBBKTT",
  "TTKBBBBBBBBBBKTT",
  "TTTKBBBBBBBBKTTT",
  "TTTTKBBBBBBKTTTT",
  "TTTTKBBBBBBKTTTT",
  "TTTTKBBKKBBKTTTT",
  "TTTTKBTTTTBKTTTT",
  "TTTTTTKKKKTTTTTT",
  ];
  const KONG_CLOSED = KONG_OPEN.map((row,y)=> y===3 ? row.replace("W","Y") : row);
  function buildKong(pat){ return spriteFromPattern({K:P.K,B:P.B,Y:P.Y,W:P.W,T:P.T}, pat); }
  SPRITES.kong = [ buildKong(KONG_OPEN), buildKong(KONG_CLOSED) ];

  // Barril detalhado
  const BARREL = [
  "TTTTTTTTTTTTTTTT",
  "TTTTTTKRRRRKTTTT",
  "TTTTKRRBBBBRRKTT",
  "TTTKRBBBBBBBBRKT",
  "TTTKRBBBBBBBBRKT",
  "TTTKRBBRRRBBBRTT",
  "TTTKRBBBBBBBBRKT",
  "TTTKRBBBBBBBBRKT",
  "TTTKRBBRRRBBBRTT",
  "TTTKRBBBBBBBBRKT",
  "TTTKRBBBBBBBBRKT",
  "TTTTKRRBBBBRRKTT",
  "TTTTTTKRRRRKTTTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
  ];
  SPRITES.barrel = spriteFromPattern({K:P.K,R:P.R,B:P.B,T:P.T}, BARREL);

  // Ovo com brilho
  const EGG = [
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTWWWTTTTTT",
  "TTTTTTWWWWWTTTTT",
  "TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT",
  "TTTTTWWWWWWWTTTT",
  "TTTTTTWWWWWTTTTT",
  "TTTTTTTWWWTTTTTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTTTTT",
  ];
  SPRITES.egg = spriteFromPattern({W:P.W,T:P.T}, EGG);

  // Escada
  const LADDER = Array.from({length:16},(_,y)=>{
    const arr = "TTTTTTTTTTTTTTTT".split("");
    arr[5]="Y"; arr[10]="Y";
    if (y%3===1) for(let x=5;x<=10;x++) arr[x]="Y";
    return arr.join("");
  });
  SPRITES.ladder = spriteFromPattern({Y:P.Y,T:P.T}, LADDER);

  // Entidades
  const player = { x:16, y:HEIGHT-32, w:12, h:14, dx:0, dy:0, onGround:false, climbing:false, score:0 };
  const chicken = { x: WIDTH-40, y: 16, t:0 }; // usamos a mesma variável de posição para o "Kong"
  let barrels = [];
  let eggs = [
    {x: 80, y: HEIGHT-40}, {x: 200, y: HEIGHT-40},
    {x: 60, y: HEIGHT-72}, {x: 220, y: HEIGHT-72},
    {x: 40, y: HEIGHT-104}, {x: 180, y: HEIGHT-104},
    {x: 110, y: HEIGHT-136}
  ];
  let spawnTimer = 0;

  // Utilitários de colisão
  function solidAt(px,py){
    const tx = Math.floor(px/TILE), ty = Math.floor(py/TILE);
    if(tx<0||ty<0||tx>=mapW||ty>=mapH) return true;
    return level[ty][tx]===1;
  }
  function ladderAt(px,py){
    const tx = Math.floor(px/TILE), ty = Math.floor(py/TILE);
    if(tx<0||ty<0||tx>=mapW||ty>=mapH) return false;
    return level[ty][tx]===2;
  }
  function rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  // Loop
  let last=0;
  function startGame(){
    initAudio(); if(audioCtx.state === "suspended") audioCtx.resume();
    if(!running){
      const ui = document.getElementById('ui'); if(ui) ui.style.display='none';
      running = true;
      last = performance.now();
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

  function update(dt){
    tickMusic(dt);

    // Spawn barris
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      barrels.push({x: chicken.x-4, y: chicken.y+8, dx: -1.5 - Math.random()*0.6, dy:0, w:10, h:10});
      spawnTimer = 2.5 + Math.random()*1.5;
    }

    // Movimento jogador
    if(keys["ArrowLeft"]) player.dx = -MOVE_V;
    else if(keys["ArrowRight"]) player.dx = MOVE_V;
    else player.dx = 0;

    const onLadderMid = ladderAt(player.x+player.w/2, player.y+player.h/2);
    if(onLadderMid && (keys["ArrowUp"] || keys["ArrowDown"])) player.climbing = true;
    if(player.climbing){
      if(keys["ArrowUp"]) player.dy = -1.5;
      else if(keys["ArrowDown"]) player.dy = 1.5;
      else player.dy = 0;
      if(keys["Space"]) player.climbing = false;
    } else {
      player.dy += GRAV;
      if(keys["Space"] && player.onGround){
        player.dy = JUMP_V; player.onGround = false; sfx.jump();
      }
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
      player.y = Math.floor((player.y+player.h)/TILE)*TILE - player.h - 0.01;
      player.dy = 0; player.onGround = true;
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
      if(!underSolid) { b.dy += GRAV; } else b.dy = 0;
      b.y += b.dy;

      if(b.x < -20){ b.x = WIDTH + 10; b.y = 32 + Math.random()*40; }

      if(solidAt(b.x+2, b.y+10)){
        const ty = Math.floor((b.y+10)/TILE);
        b.y = ty*TILE - 10 - 0.01; b.dy = 0;
      }
    });

    // Colisão com barris
    for(const b of barrels){
      if(rectsOverlap(player,b)){ sfx.hurt(); reset(false); return; }
    }

    // Recolha ovos
    eggs = eggs.filter(e => {
      const hit = Math.abs(player.x - e.x) < 10 && Math.abs(player.y - e.y) < 12;
      if(hit){ player.score += 100; sfx.pickup(); }
      return !hit;
    });

    // Vitória
    if(eggs.length === 0){ sfx.win(); reset(true); }

    // “Kong” a fazer bobbing
    chicken.t += dt; chicken.x = WIDTH-40 + Math.sin(chicken.t*2)*4;
  }

  function reset(_won){
    setTimeout(()=>{
      player.x = 16; player.y = HEIGHT-32; player.dx=player.dy=0; player.onGround=false; player.climbing=false;
      player.score = 0; barrels = [];
      eggs = [
        {x: 80, y: HEIGHT-40}, {x: 200, y: HEIGHT-40},
        {x: 60, y: HEIGHT-72}, {x: 220, y: HEIGHT-72},
        {x: 40, y: HEIGHT-104}, {x: 180, y: HEIGHT-104},
        {x: 110, y: HEIGHT-136}
      ];
    }, 200);
  }

  // Render
  function draw(){
    // Borda ZX
    const borderColors = [ZX.BLUE, ZX.RED, ZX.MAGENTA, ZX.GREEN, ZX.CYAN, ZX.YELLOW, ZX.WHITE];
    const border = borderColors[(frame>>2)%borderColors.length];
    canvas.style.borderColor = border;

    // Fundo
    ctx.fillStyle = ZX.BLACK; ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Tiles
    for(let y=0;y<mapH;y++){
      for(let x=0;x<mapW;x++){
        const t = level[y][x];
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
    ctx.drawImage(SPRITES.kong[kongFrame], chicken.x-8, chicken.y-8);

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
    pixText(`SCORE ${player.score}`, 4, 1, ZX.BLACK);
    pixText('EGGS '+eggs.length, WIDTH-80, 1, ZX.BLACK);
  }

  // Texto pixel
  const font = {
    W:4, H:6, map: {
      '0':["111","101","101","101","101","111"], '1':["010","110","010","010","010","111"],
      '2':["111","001","001","111","100","111"], '3':["111","001","011","001","001","111"],
      '4':["101","101","101","111","001","001"], '5':["111","100","111","001","001","111"],
      '6':["111","100","111","101","101","111"], '7':["111","001","001","001","001","001"],
      '8':["111","101","111","101","101","111"], '9':["111","101","111","001","001","111"],
      'A':["010","101","101","111","101","101"], 'B':["110","101","110","101","101","110"],
      'C':["011","100","100","100","100","011"], 'D':["110","101","101","101","101","110"],
      'E':["111","100","110","100","100","111"], 'G':["011","100","100","101","101","011"],
      'K':["101","101","110","101","101","101"], 'O':["010","101","101","101","101","010"],
      'R':["110","101","110","110","101","101"], 'S':["011","100","011","001","001","110"],
      ' ':["000","000","000","000","000","000"]
    }
  };
  function pixChar(ch, x, y, color){
    const g = font.map[ch] || font.map[' '];
    ctx.fillStyle = color;
    for(let r=0;r<6;r++){ for(let c=0;c<3;c++){ if(g[r][c]==='1') ctx.fillRect(x+c+0.5, y+r+0.5, 1,1); } }
  }
  function pixText(s, x, y, color){ s = s.toUpperCase(); for(let i=0;i<s.length;i++){ pixChar(s[i], x + i*4, y, color); } }
})();
