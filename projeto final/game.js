/* game.js — Mini Game Rota — Cidade 2D */
(function () {

  /* ── Resolução virtual de desenho ─────────────────────── */
  var VW = 800, VH = 420;

  /* ── Nós do mapa (coordenadas virtuais) ───────────────── */
  var NODES = {
    garagem:  { id:"garagem",  label:"Garagem",       vx:58,  vy:210, type:"start", icon:"⛽" },
    centro:   { id:"centro",   label:"Centro",        vx:220, vy:78,  type:"stop",  icon:"🏢" },
    pgrande:  { id:"pgrande",  label:"P. Grande",     vx:236, vy:342, type:"stop",  icon:"🏘️" },
    vnova:    { id:"vnova",    label:"Vila Nova",     vx:458, vy:78,  type:"stop",  icon:"🏡" },
    jamerica: { id:"jamerica", label:"J. América",    vx:474, vy:342, type:"stop",  icon:"🌳" },
    facul:    { id:"facul",    label:"Faculdade",     vx:738, vy:210, type:"end",   icon:"🎓" },
  };

  var ROADS = [
    ["garagem","centro"],["garagem","pgrande"],
    ["centro","vnova"],["centro","pgrande"],["centro","facul"],
    ["pgrande","jamerica"],["pgrande","vnova"],
    ["vnova","jamerica"],["vnova","facul"],
    ["jamerica","facul"],
  ];

  var DIST = {
    "garagem-centro":8,"garagem-pgrande":12,
    "centro-vnova":9,"centro-pgrande":6,"centro-facul":17,
    "pgrande-jamerica":7,"pgrande-vnova":11,
    "vnova-jamerica":6,"vnova-facul":11,
    "jamerica-facul":9,
  };
  function getDist(a,b){ return DIST[a+"-"+b]||DIST[b+"-"+a]||0; }

  var PHASES = [
    { id:1, title:"Fase 1 — Noite tranquila",
      desc:"2 alunos confirmados. Clique nos pontos azuis na ordem de coleta e confirme.",
      students:["centro","pgrande"], optimal:29,
      hint:"Garagem → Centro → Paulo Grande → Faculdade" },
    { id:2, title:"Fase 2 — Rota completa",
      desc:"3 alunos confirmados. Planeje a ordem para economizar combustível do Fábio.",
      students:["centro","pgrande","vnova"], optimal:36,
      hint:"Garagem → Centro → Paulo Grande → Vila Nova → Faculdade" },
    { id:3, title:"Fase 3 — Madrugada pesada",
      desc:"4 alunos. Atenção máxima na ordem de coleta!",
      students:["centro","pgrande","vnova","jamerica"], optimal:38,
      hint:"Garagem → Centro → P.Grande → J.América → Vila Nova → Faculdade" },
  ];

  /* ── Prédios da cidade (coordenadas virtuais) ─────────── */
  var BUILDINGS = [
    /* quarteirão sup-esq */
    {x:70, y:94, w:52,h:34},{x:130,y:98, w:38,h:28},{x:70, y:142,w:42,h:46},{x:120,y:146,w:54,h:34},
    /* quarteirão inf-esq */
    {x:72, y:258,w:52,h:42},{x:132,y:262,w:38,h:34},{x:74, y:314,w:46,h:40},{x:128,y:308,w:52,h:46},
    /* quarteirão sup-centro */
    {x:252,y:94, w:56,h:34},{x:318,y:98, w:46,h:28},{x:374,y:92, w:54,h:36},
    {x:254,y:142,w:40,h:50},{x:302,y:138,w:64,h:54},{x:374,y:144,w:52,h:48},
    /* quarteirão inf-centro */
    {x:252,y:258,w:54,h:44},{x:316,y:262,w:50,h:36},{x:376,y:256,w:52,h:42},
    {x:254,y:312,w:46,h:44},{x:308,y:306,w:66,h:48},{x:384,y:312,w:48,h:42},
    /* quarteirão sup-dir */
    {x:494,y:94, w:54,h:34},{x:556,y:98, w:58,h:28},{x:624,y:92, w:52,h:36},{x:686,y:96, w:44,h:32},
    {x:496,y:142,w:50,h:52},{x:554,y:148,w:56,h:46},{x:620,y:144,w:60,h:50},{x:690,y:148,w:42,h:52},
    /* quarteirão inf-dir */
    {x:494,y:256,w:56,h:44},{x:558,y:252,w:60,h:48},{x:628,y:258,w:52,h:42},{x:690,y:252,w:46,h:48},
    {x:496,y:308,w:50,h:46},{x:556,y:306,w:62,h:46},{x:626,y:310,w:56,h:44},{x:690,y:308,w:46,h:48},
    /* extremidades */
    {x:752,y:94, w:40,h:100},{x:752,y:220,w:40,h:108},{x:755,y:316,w:36,h:90},
    {x:6,  y:92, w:38,h:100},{x:6,  y:225,w:38,h:100},{x:6,  y:316,w:38,h:90},
  ];

  /* ── Janelas determinísticas ──────────────────────────── */
  var WINDOWS = (function(){
    var ws=[], s=31337;
    function r(){ s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/4294967295; }
    BUILDINGS.forEach(function(b){
      for(var row=0; row*11+4<b.h-2; row++){
        for(var col=0; col*11+4<b.w-2; col++){
          ws.push({x:b.x+4+col*11, y:b.y+4+row*11, lit:r()>0.3, warm:r()>0.5});
        }
      }
    });
    return ws;
  }());

  /* ── Estado do jogo ───────────────────────────────────── */
  var S = { phase:0, route:[], confirmed:false, animating:false, frame:null,
            vanX:58, vanY:210, vanFlip:false, routeColor:null };

  var canvas, ctx, wrap;
  function el(id){ return document.getElementById(id); }

  /* ── Escala virtual → canvas ──────────────────────────── */
  function sx(v){ return v/VW*canvas.width; }
  function sy(v){ return v/VH*canvas.height; }
  function ss(v){ return v/VW*canvas.width; } /* scalar scale */

  function nPx(id){
    var n=NODES[id]; return {x:sx(n.vx),y:sy(n.vy)};
  }

  /* ── Inicialização ────────────────────────────────────── */
  function initGame(){
    var c=el("game-container"); if(!c) return;
    c.innerHTML=[
      '<div id="g-wrap">',
        '<div id="g-header">',
          '<div id="g-phase-info">',
            '<span id="g-title"></span>',
            '<p id="g-desc"></p>',
          '</div>',
          '<div id="g-badges">',
            PHASES.map(function(p,i){ return '<span class="g-badge" id="g-b'+i+'">'+p.id+'</span>'; }).join(""),
          '</div>',
        '</div>',
        '<div id="g-map"><canvas id="g-canvas"></canvas></div>',
        '<div id="g-bar">',
          '<span id="g-route-txt">Clique nos pontos azuis na ordem de coleta</span>',
          '<div id="g-btns">',
            '<button id="g-confirm" class="button button-main" disabled>Confirmar rota</button>',
            '<button id="g-reset"   class="button button-ghost">↺ Reiniciar</button>',
          '</div>',
        '</div>',
        '<div id="g-result" hidden></div>',
      '</div>',
    ].join("");

    canvas=el("g-canvas"); wrap=el("g-map"); ctx=canvas.getContext("2d");
    S.vanX=NODES.garagem.vx; S.vanY=NODES.garagem.vy;

    canvas.addEventListener("click",   onCanvasClick);
    canvas.addEventListener("touchend", onCanvasTouch, {passive:true});
    el("g-confirm").addEventListener("click", confirmRoute);
    el("g-reset").addEventListener("click",   resetPhase);
    window.addEventListener("resize", function(){ drawScene(S.route, S.routeColor); });
    renderPhase();
  }

  function onCanvasClick(e){
    if(S.confirmed||S.animating) return;
    var r=canvas.getBoundingClientRect();
    checkHit( (e.clientX-r.left)*(canvas.width/r.width),
              (e.clientY-r.top )*(canvas.height/r.height) );
  }
  function onCanvasTouch(e){
    if(S.confirmed||S.animating) return;
    var t=e.changedTouches[0], r=canvas.getBoundingClientRect();
    checkHit( (t.clientX-r.left)*(canvas.width/r.width),
              (t.clientY-r.top )*(canvas.height/r.height) );
  }
  function checkHit(mx,my){
    var ph=PHASES[S.phase], best=null, bestD=9999;
    ph.students.forEach(function(key){
      var p=nPx(key);
      var d=Math.sqrt(Math.pow(mx-p.x,2)+Math.pow(my-p.y,2));
      if(d<ss(26)&&d<bestD){ bestD=d; best=key; }
    });
    if(best) toggle(best);
  }

  /* ── Resize canvas (mantém aspect ratio) ─────────────── */
  function resizeCanvas(){
    var W=wrap.offsetWidth;
    canvas.width  = W;
    canvas.height = Math.round(W*(VH/VW));
    wrap.style.height = canvas.height+"px";
  }

  /* ── Cena principal ───────────────────────────────────── */
  function drawScene(route, routeColor){
    resizeCanvas();
    drawBackground();
    drawBuildings();
    drawWindows();
    drawRoads(route, routeColor);
    drawStreetLights();
    drawNodes();
    drawVan(sx(S.vanX), sy(S.vanY), S.vanFlip);
  }

  /* ── Fundo ────────────────────────────────────────────── */
  function drawBackground(){
    var W=canvas.width, H=canvas.height;
    var g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#060c1a"); g.addColorStop(1,"#0d0818");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }

  /* ── Calçadas entre prédios ───────────────────────────── */
  function drawBuildings(){
    BUILDINGS.forEach(function(b){
      /* calçada */
      ctx.fillStyle="#10172a";
      ctx.fillRect(sx(b.x-5),sy(b.y-5),sx(b.x+b.w+5)-sx(b.x-5),sy(b.y+b.h+5)-sy(b.y-5));
      /* fachada */
      var g=ctx.createLinearGradient(sx(b.x),sy(b.y),sx(b.x+b.w),sy(b.y+b.h));
      g.addColorStop(0,"#1a2540"); g.addColorStop(1,"#111c30");
      ctx.fillStyle=g;
      ctx.fillRect(sx(b.x),sy(b.y),sx(b.x+b.w)-sx(b.x),sy(b.y+b.h)-sy(b.y));
      /* topo */
      ctx.fillStyle="rgba(148,163,184,0.07)";
      ctx.fillRect(sx(b.x),sy(b.y),sx(b.x+b.w)-sx(b.x),ss(3));
    });
  }

  /* ── Janelas iluminadas ───────────────────────────────── */
  function drawWindows(){
    WINDOWS.forEach(function(w){
      if(!w.lit) return;
      var x=sx(w.x),y=sy(w.y),ww=Math.max(2,ss(5)),wh=Math.max(2,ss(5));
      ctx.shadowColor=w.warm?"#fbbf24":"#93c5fd";
      ctx.shadowBlur=ss(6);
      ctx.fillStyle=w.warm?"rgba(251,191,36,0.75)":"rgba(147,197,253,0.65)";
      ctx.fillRect(x,y,ww,wh);
      ctx.shadowBlur=0;
    });
  }

  /* ── Ruas + rota ──────────────────────────────────────── */
  function drawRoads(route, routeColor){
    var RW=ss(22);

    /* sombra das ruas */
    ctx.lineCap="round"; ctx.lineWidth=RW+8;
    ctx.strokeStyle="rgba(0,0,0,0.7)"; ctx.setLineDash([]);
    ROADS.forEach(function(r){ var a=nPx(r[0]),b=nPx(r[1]); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); });

    /* asfalto */
    ctx.lineWidth=RW;
    ctx.strokeStyle="#1a2540";
    ROADS.forEach(function(r){ var a=nPx(r[0]),b=nPx(r[1]); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); });

    /* borda de calçada */
    ctx.lineWidth=RW+2;
    ctx.strokeStyle="rgba(148,163,184,0.06)";
    ROADS.forEach(function(r){ var a=nPx(r[0]),b=nPx(r[1]); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); });

    /* rota selecionada — glow */
    if(route&&route.length>0){
      var full=["garagem"].concat(route).concat(["facul"]);
      var col=routeColor||"#3b82f6";
      ctx.lineWidth=RW*0.65; ctx.strokeStyle=col;
      ctx.shadowColor=col; ctx.shadowBlur=ss(20); ctx.setLineDash([]);
      for(var i=0;i<full.length-1;i++){
        var pa=nPx(full[i]),pb=nPx(full[i+1]);
        ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.stroke();
      }
      ctx.shadowBlur=0;
    }

    /* faixa central tracejada */
    ctx.lineWidth=ss(1.2); ctx.strokeStyle="rgba(255,255,255,0.15)";
    ctx.setLineDash([ss(10),ss(9)]);
    ROADS.forEach(function(r){ var a=nPx(r[0]),b=nPx(r[1]); ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); });
    ctx.setLineDash([]);

    /* badges km */
    ctx.font="bold "+ss(11)+"px sans-serif";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ROADS.forEach(function(r){
      var a=nPx(r[0]),b=nPx(r[1]);
      var mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      var lbl=getDist(r[0],r[1])+" km";
      var lw=ctx.measureText(lbl).width+ss(8);
      ctx.fillStyle="rgba(6,12,28,0.9)";   ctx.fillRect(mx-lw/2,my-ss(7),lw,ss(14));
      ctx.strokeStyle="rgba(255,255,255,0.1)"; ctx.lineWidth=1; ctx.strokeRect(mx-lw/2,my-ss(7),lw,ss(14));
      ctx.fillStyle="rgba(196,218,255,0.88)"; ctx.fillText(lbl,mx,my);
    });
  }

  /* ── Postes de luz (halos) ────────────────────────────── */
  function drawStreetLights(){
    Object.keys(NODES).forEach(function(key){
      var p=nPx(key);
      var rad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,ss(38));
      rad.addColorStop(0,"rgba(251,191,36,0.07)"); rad.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=rad;
      ctx.beginPath(); ctx.arc(p.x,p.y,ss(38),0,Math.PI*2); ctx.fill();
    });
  }

  /* ── Nós do mapa ──────────────────────────────────────── */
  function drawNodes(){
    var ph=PHASES[S.phase];
    Object.keys(NODES).forEach(function(key){
      var n=NODES[key], p=nPx(key);
      var isStop=ph.students.indexOf(key)!==-1;
      var selIdx=S.route.indexOf(key);
      var isSelected=selIdx!==-1;
      var R=ss(19);

      /* sombra */
      ctx.shadowColor="rgba(0,0,0,0.7)"; ctx.shadowBlur=ss(10);
      ctx.fillStyle="#060c1a";
      ctx.beginPath(); ctx.arc(p.x,p.y,R+ss(3),0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      /* borda pulsante nos stops */
      if(isStop&&!isSelected&&!S.confirmed){
        ctx.strokeStyle="rgba(59,130,246,0.6)"; ctx.lineWidth=ss(2);
        ctx.setLineDash([ss(4),ss(3)]);
        ctx.beginPath(); ctx.arc(p.x,p.y,R+ss(5),0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }

      /* cor de fundo do círculo */
      var bg = n.type==="start" ? "#064e3b" :
               n.type==="end"   ? "#78350f" :
               isSelected       ? "#1e3a8a" :
               isStop           ? "#1e293b" : "#0f172a";
      ctx.fillStyle=bg;
      ctx.beginPath(); ctx.arc(p.x,p.y,R,0,Math.PI*2); ctx.fill();

      /* borda */
      ctx.strokeStyle = n.type==="start"?"#10b981":
                        n.type==="end"  ?"#f59e0b":
                        isSelected      ?"#60a5fa":
                        isStop          ?"#3b82f6":"#334155";
      ctx.lineWidth=ss(2.2); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x,p.y,R,0,Math.PI*2); ctx.stroke();

      /* conteúdo */
      if(isSelected){
        ctx.fillStyle="#fff";
        ctx.font="bold "+ss(14)+"px sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(selIdx+1, p.x, p.y);
      } else {
        ctx.font=ss(15)+"px sans-serif";
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(n.icon, p.x, p.y-(ss(0.5)));
      }

      /* label */
      var above=n.vy<VH/2;
      var ly=above ? p.y+R+ss(12) : p.y-R-ss(5);
      ctx.font="bold "+ss(10)+"px sans-serif";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      var lw=ctx.measureText(n.label).width+ss(8);
      ctx.fillStyle="rgba(6,12,28,0.92)"; ctx.fillRect(p.x-lw/2,ly-ss(6.5),lw,ss(13));
      ctx.fillStyle=isStop||n.type!=="stop"?"#e2e8f0":"#475569";
      ctx.fillText(n.label,p.x,ly);
    });
  }

  /* ── Van (desenhada no canvas) ────────────────────────── */
  function drawVan(x,y,flip){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(flip?-1:1,1);
    var s=ss(1);

    /* sombra */
    ctx.fillStyle="rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0,s*10,s*20,s*5,0,0,Math.PI*2); ctx.fill();

    /* carroceria */
    ctx.fillStyle="#1d4ed8";
    ctx.beginPath();
    ctx.moveTo(-s*22, s*7);
    ctx.lineTo(-s*22,-s*8);
    ctx.lineTo(-s*14,-s*12);
    ctx.lineTo( s*12,-s*12);
    ctx.lineTo( s*22,-s*6);
    ctx.lineTo( s*22, s*7);
    ctx.closePath();
    ctx.fill();

    /* parte inferior (mais escura) */
    ctx.fillStyle="#1e3a8a";
    ctx.fillRect(-s*22,s*3,s*44,s*4);

    /* cabine */
    ctx.fillStyle="#172554";
    ctx.fillRect(s*12,-s*12,s*10,s*19);

    /* para-brisa */
    ctx.fillStyle="#93c5fd";
    ctx.beginPath();
    ctx.moveTo(s*12,-s*11); ctx.lineTo(s*21,-s*5);
    ctx.lineTo(s*21,s*0);   ctx.lineTo(s*12,s*0);
    ctx.closePath(); ctx.fill();

    /* janelas laterais */
    ctx.fillStyle="#bfdbfe";
    ctx.fillRect(-s*20,-s*11,s*8,s*7);
    ctx.fillRect(-s*10,-s*11,s*8,s*7);
    ctx.fillRect( s*0, -s*11,s*8,s*7);

    /* rodas */
    ctx.fillStyle="#0f172a";
    ctx.beginPath(); ctx.arc(-s*12,s*9,s*5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( s*14,s*9,s*5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#475569";
    ctx.beginPath(); ctx.arc(-s*12,s*9,s*2.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( s*14,s*9,s*2.5,0,Math.PI*2); ctx.fill();

    /* faróis */
    ctx.shadowColor="#fef08a"; ctx.shadowBlur=s*10;
    ctx.fillStyle="#fef08a";
    ctx.fillRect(s*20,-s*4,s*4,s*4);
    ctx.shadowBlur=0;

    /* lanternas */
    ctx.fillStyle="#dc2626";
    ctx.fillRect(-s*24,-s*4,s*3,s*4);

    ctx.restore();
  }

  /* ── Fase ─────────────────────────────────────────────── */
  function renderPhase(){
    var ph=PHASES[S.phase];
    S.route=[]; S.confirmed=false; S.animating=false; S.routeColor=null;
    if(S.frame){ cancelAnimationFrame(S.frame); S.frame=null; }
    S.vanX=NODES.garagem.vx; S.vanY=NODES.garagem.vy; S.vanFlip=false;

    el("g-title").textContent=ph.title;
    el("g-desc").textContent=ph.desc;
    PHASES.forEach(function(_,i){
      var b=el("g-b"+i);
      b.className=i===S.phase?"g-badge active":i<S.phase?"g-badge done":"g-badge";
    });
    drawScene([],null);
    updateBar();
    el("g-result").hidden=true;
    el("g-confirm").disabled=true;
    el("g-confirm").style.display="";
  }

  function toggle(id){
    var ph=PHASES[S.phase];
    var idx=S.route.indexOf(id);
    if(idx===-1) S.route.push(id); else S.route.splice(idx,1);
    drawScene(S.route,null);
    updateBar();
    el("g-confirm").disabled=S.route.length!==ph.students.length;
  }

  function updateBar(){
    var d=el("g-route-txt");
    if(!S.route.length){ d.textContent="Clique nos pontos azuis na ordem de coleta"; return; }
    d.textContent=["Garagem"].concat(S.route.map(function(id){ return NODES[id].label; })).concat(["Faculdade"]).join(" → ");
  }

  /* ── Confirmar rota ───────────────────────────────────── */
  function confirmRoute(){
    var ph=PHASES[S.phase];
    S.confirmed=true;
    el("g-confirm").disabled=true; el("g-confirm").style.display="none";

    var full=["garagem"].concat(S.route).concat(["facul"]);
    var tot=0;
    for(var i=0;i<full.length-1;i++) tot+=getDist(full[i],full[i+1]);
    var fuel=(tot*0.1).toFixed(1);
    var diff=tot-ph.optimal;
    var pct=Math.round(diff/ph.optimal*100);
    var win=diff<=Math.ceil(ph.optimal*0.1);
    var ok=!win&&diff<=Math.ceil(ph.optimal*0.3);
    S.routeColor=win?"#10b981":ok?"#3b82f6":"#ef4444";

    drawScene(S.route,S.routeColor);
    animateVan(full,0,function(){ showResult(tot,fuel,diff,pct,win,ok,ph); });
  }

  /* ── Animação da van ──────────────────────────────────── */
  function animateVan(full,seg,done){
    if(seg>=full.length-1){ S.animating=false; done(); return; }
    S.animating=true;
    var from=NODES[full[seg]], to=NODES[full[seg+1]];
    var x0=from.vx,y0=from.vy,x1=to.vx,y1=to.vy;
    var dist=Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
    var dur=Math.max(500,dist/0.14);
    var t0=null;
    S.vanFlip=x1<x0;

    function step(ts){
      if(!t0) t0=ts;
      var p=Math.min((ts-t0)/dur,1);
      S.vanX=x0+(x1-x0)*p; S.vanY=y0+(y1-y0)*p;
      drawScene(S.route,S.routeColor);
      if(p<1){ S.frame=requestAnimationFrame(step); }
      else {
        S.vanX=x1; S.vanY=y1;
        drawScene(S.route,S.routeColor);
        setTimeout(function(){ animateVan(full,seg+1,done); },300);
      }
    }
    S.frame=requestAnimationFrame(step);
  }

  /* ── Resultado ────────────────────────────────────────── */
  function showResult(tot,fuel,diff,pct,win,ok,ph){
    var hasNext=S.phase<PHASES.length-1;
    var btns="";
    if(hasNext&&(win||ok)) btns+='<button class="button button-main" id="g-next">Próxima fase →</button>';
    btns+='<button class="button button-ghost" id="g-retry">Tentar novamente</button>';
    if(!win) btns+='<details class="g-hint"><summary>Ver rota ótima</summary><p>'+ph.hint+' ('+ph.optimal+' km)</p></details>';
    var r=el("g-result");
    r.hidden=false;
    r.innerHTML=[
      '<div class="g-res-icon">'+(win?"🏆":ok?"👍":"😓")+'</div>',
      '<div class="g-res-text">'+(win?"<strong>Rota ótima!</strong> Fábio chegou rápido e economizou combustível.":ok?"<strong>Boa rota!</strong> Dá pra melhorar, mas Fábio chegou.":"<strong>Rota longa.</strong> Fábio gastou combustível à toa.")+'</div>',
      '<div class="g-res-stats">',
        '<div class="g-stat"><span>Distância</span><strong>'+tot+' km</strong></div>',
        '<div class="g-stat"><span>Combustível</span><strong>'+fuel+' L</strong></div>',
        '<div class="g-stat"><span>Rota ótima</span><strong>'+ph.optimal+' km</strong></div>',
        '<div class="g-stat '+(diff>0?"g-bad":"g-good")+'"><span>Diferença</span><strong>'+(diff>0?"+":"")+diff+' km ('+(diff>0?"+":"")+pct+'%)</strong></div>',
      '</div>',
      '<div class="g-res-btns">'+btns+'</div>',
    ].join("");
    var nb=el("g-next"),rb=el("g-retry");
    if(nb) nb.addEventListener("click",function(){ S.phase=Math.min(S.phase+1,PHASES.length-1); renderPhase(); });
    if(rb) rb.addEventListener("click",resetPhase);
  }

  function resetPhase(){ el("g-confirm").style.display=""; renderPhase(); }

  /* ── Boot ─────────────────────────────────────────────── */
  window.rotaInitGame = initGame;

}());

