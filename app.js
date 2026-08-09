(function(){
  // Boot accelerators: start the 3D engine + fonts downloading NOW, in parallel with the page,
  // instead of waiting for DOMContentLoaded. Cuts cold time-to-interactive dramatically.
  var threeReady=false, domReady=false, threeFailed=false;
  function tryInit(){
    if(!threeReady || !domReady) return;
    try{ window.__dsApp(); }catch(e){ console.log('ds init err',e); }
    var w=document.getElementById('ds-3d-wait'); if(w) w.remove();
  }
  try{
    var th=document.createElement('script');
    th.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    th.onload=function(){ threeReady=true; tryInit(); };
    th.onerror=function(){ threeFailed=true;
      var r=document.getElementById('ds-root');
      if(r){ var m=document.createElement('p'); m.style.cssText='color:#0C0E11;font-family:monospace;padding:20px'; m.textContent='3D engine failed to load. Refresh to retry.'; r.prepend(m); }
    };
    document.head.appendChild(th);
    var fl=document.createElement('link'); fl.rel='stylesheet';
    fl.href='https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Work+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(fl);
  }catch(e){}
    function dsBoot(){
    document.body.classList.add('ds-on');
    try{
      var tw=document.getElementById('three-wrap');
      if(tw && !document.getElementById('ds-3d-wait')){ var ph=document.createElement('div'); ph.id='ds-3d-wait';
        ph.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 11px/1 "IBM Plex Mono",Menlo,monospace;letter-spacing:.22em;color:#0C0E11;opacity:.55;text-transform:uppercase';
        ph.textContent='Building 3D view\u2026'; tw.appendChild(ph); }
    }catch(e){}
    if(threeFailed){ var r2=document.getElementById('ds-root');
      if(r2){ var m2=document.createElement('p'); m2.style.cssText='color:#0C0E11;font-family:monospace;padding:20px'; m2.textContent='3D engine failed to load. Refresh to retry.'; r2.prepend(m2); } }
    domReady=true; tryInit();
  }
  window.__dsApp=function(){

// ---------- state ----------
const S = { w:16, d:12, h:36, spacing:16, stairW:4, stairPos:'fr', ledger:true, stairs:true, rail:true, tier2:false, w2:10, d2:10, h2:24, just2:'c', planMode:'framing', view:'3d' };

// effective lower tier height: at least 8, at least one riser below the upper, tier drop capped at 12 risers
function h2eff(){
  return Math.max(8, Math.min(Math.max(8, S.h - 8), Math.max(S.h2, S.h - 90)));
}
// lower tier center offset + tier stair placement on the shared edge overlap
function tierGeom(){
  const cx2 = S.just2==='l' ? (-S.w/2 + S.w2/2) : S.just2==='r' ? (S.w/2 - S.w2/2) : 0;
  const a = Math.max(-S.w/2, cx2 - S.w2/2), b = Math.min(S.w/2, cx2 + S.w2/2);
  const len = Math.max(0.5, b - a);
  return { cx2: cx2, tierC: (a+b)/2, tierSw: Math.min(S.stairW, Math.max(2, len - 1)) };
}

// resolved stair placement: edge ('front' along z=+d/2, 'left' x=-w/2, 'right' x=+w/2) + center along that edge
function stairPlace(wA, dA){
  if (!S.stairs) return null;
  wA = wA || S.w; dA = dA || S.d;
  const pos = S.stairPos || 'fr';
  const onEnd = (pos === 'el' || pos === 'er');
  const L = onEnd ? dA : wA;
  const sw = Math.min(S.stairW, Math.max(2, L - 1));
  if (onEnd){
    let c = L/2 - 1 - sw/2;
    c = Math.max(-L/2 + sw/2, Math.min(L/2 - sw/2, c));
    return { edge: pos === 'el' ? 'left' : 'right', c: c, sw: sw, ext: (c + 1.5*sw <= L/2) ? 1 : -1 };
  }
  let c = pos === 'fl' ? (-L/2 + 1 + sw/2) : pos === 'fc' ? 0 : (L/2 - 1 - sw/2);
  c = Math.max(-L/2 + sw/2, Math.min(L/2 - sw/2, c));
  return { edge: 'front', c: c, sw: sw, ext: (c + 1.5*sw <= L/2) ? 1 : -1 };
}

// ---------- engineering heuristics (preliminary) ----------
function joistSize(span, spacing){
  const f = spacing===12 ? 1.13 : 1.0;
  if (span <= 6*f) return '2x8';
  return '2x10';
}
function diaFor(postSp, trib){
  const dc = Math.ceil(Math.sqrt((postSp * trib * 50 / 1500) / Math.PI) * 24);
  return [16,18,20,24].find(function(x){ return x >= dc; }) || 24;
}
// one rectangular platform. ledgered = has an inner bearing (house ledger or the shared girder).
// extraSpan stretches the joist span for the lower tier, whose inner girder sits 1 ft behind its back edge.
function calcDeck(w, d, ledgered, extraSpan){
  const cant = 1.5;
  const joists = Math.floor(w*12/S.spacing)+1;
  const spanTotal = Math.max(2, d - (ledgered ? cant : 2*cant) + (extraSpan||0));
  const maxJ = 14 * (S.spacing===12 ? 1.13 : 1.0);
  const needMid = spanTotal > maxJ;
  const spanSeg = needMid ? spanTotal/2 : spanTotal;
  const jsize = joistSize(spanSeg, S.spacing);
  const beamRows = (ledgered ? 1 : 2) + (needMid ? 1 : 0);
  const postRun = Math.max(0.5, w - 3);
  const perRow = Math.max(2, Math.ceil(postRun/6)+1);
  const postSp = postRun / (perRow - 1);
  const tribDepth = needMid ? spanTotal/2 : spanTotal/2 + cant;
  const dia = diaFor(postSp, tribDepth);
  return { joists: joists, jsize: jsize, spanTotal: spanTotal, needMid: needMid, beamRows: beamRows,
    perRow: perRow, postSp: postSp, dia: dia, footings: perRow*beamRows, spliced: w > 20 };
}
function calc(){
  const up = calcDeck(S.w, S.d, S.ledger, 0);
  if (!S.tier2){
    const area = S.w*S.d;
    const deckLF = Math.round(area*12/5.5*1.12);
    const spc = stairPlace();
    const railLF = S.rail ? Math.max(0, (S.ledger ? S.w + 2*S.d : 2*S.w + 2*S.d) - (spc ? spc.sw : 0)) : 0;
    const risers = S.stairs ? Math.max(2, Math.ceil(S.h/7.5)) : 0;
    const swb = S.stairs && risers > 12;
    return { tier2:false, joists:up.joists, jsize:up.jsize, beamRows:up.beamRows, perRow:up.perRow,
      footings:up.footings, area:area, deckLF:deckLF, railLF:railLF, risers:risers,
      guardReq:S.h>30, needMid:up.needMid, dia:up.dia, spliced:up.spliced, swb:swb };
  }
  const h2e = h2eff();
  const lo = calcDeck(S.w2, S.d2, true, 1.5);
  const tg = tierGeom();
  // the upper's outer girder row carries the lower tier too: resize those footings for the combined
  // tributary, adding posts to the shared row rather than jumping past 20" tubes
  const sharedTrib = (up.spanTotal/2 + 1) + lo.spanTotal/2;
  let sharedPer = up.perRow;
  let sharedDia = diaFor(Math.max(0.5,S.w-3)/(sharedPer-1), sharedTrib);
  while (sharedDia > 20 && sharedPer < 8){ sharedPer++; sharedDia = diaFor(Math.max(0.5,S.w-3)/(sharedPer-1), sharedTrib); }
  const drop = S.h - h2e;
  const tierRisers = drop >= 4 ? Math.max(2, Math.ceil(drop/7.5)) : 0;
  const tierRun = tierRisers * (11/12);
  const tierOver = tierRisers > 0 && tierRun > S.d2 - 1;
  const gsp = stairPlace(S.w2, S.d2);
  const gradeRisers = S.stairs ? Math.max(2, Math.ceil(h2e/7.5)) : 0;
  const gswb = S.stairs && gradeRisers > 12;
  const girderMembers = up.beamRows + lo.beamRows + 1;
  const footTotal = sharedPer + (up.beamRows - 1)*up.perRow + lo.footings;
  const area = S.w*S.d + S.w2*S.d2;
  const deckLF = Math.round(area*12/5.5*1.12);
  let railLF = 0;
  if (S.rail){
    railLF = (S.ledger ? S.w + 2*S.d : 2*S.w + 2*S.d) - (tierRisers ? tg.tierSw : 0);
    railLF += S.w2 + 2*S.d2 - (gsp ? gsp.sw : 0);
    railLF = Math.max(0, Math.round(railLF));
  }
  return { tier2:true, up:up, lo:lo, h2e:h2e, tg:tg, sharedDia:sharedDia, sharedPer:sharedPer,
    tierRisers:tierRisers, tierRun:tierRun, tierOver:tierOver,
    gsp:gsp, gradeRisers:gradeRisers, swb:gswb,
    girderMembers:girderMembers, footTotal:footTotal, area:area, deckLF:deckLF, railLF:railLF,
    guardReq:S.h>30, guardLo:h2e>30, spliced: up.spliced || lo.spliced,
    joists:up.joists, jsize:up.jsize, beamRows:up.beamRows, perRow:up.perRow,
    footings:footTotal, needMid:up.needMid, dia:up.dia, risers:gradeRisers };
}

// ---------- takeoff panel ----------
function footStr(c){
  const parts = [];
  const add = function(n, dia){
    if (n <= 0) return;
    const hit = parts.find(function(p){ return p.dia === dia; });
    if (hit) hit.n += n; else parts.push({n:n, dia:dia});
  };
  add(c.sharedPer, c.sharedDia);
  add((c.up.beamRows - 1) * c.up.perRow, c.up.dia);
  add(c.lo.footings, c.lo.dia);
  parts.sort(function(a,b){ return b.dia - a.dia; });
  return parts.map(function(p){ return p.n+' @ '+p.dia+'"'; }).join(' + ');
}
function renderTakeoff(){
  const c = calc();
  let rows, note;
  if (!c.tier2){
    rows = [
      ['Deck area', c.area+' sq ft'],
      ['Joists', c.joists+' @ '+c.jsize+' / '+S.spacing+'" OC'+(c.needMid?' / 2 spans':'')],
      ['Girder'+(c.beamRows>1?'s':''), c.beamRows+' x (3)2x10 typ'],
      ['Posts 6x6 PT', c.footings],
      ['Footings', c.footings+' @ '+c.dia+'" dia'],
      ['Footing depth', 'per township (30\u201336" typ)'],
      ['Decking', '~'+c.deckLF+' LF (5-1/2" bd)'],
    ];
    if (S.ledger) rows.splice(6, 0, ['Ledger', c.jsize+' PT / lags 16" OC']);
    if (S.rail) rows.push(['Railing', '~'+c.railLF+' LF']);
    if (S.stairs){ const sp2 = stairPlace(); rows.push(['Stairs', (sp2 ? sp2.sw : S.stairW)+"' wide / "+c.risers+' risers'+(c.swb?' / switchback':'')]); }
    if (S.stairs) rows.push(['Stair footings', '8" dia sonotube'+(c.swb?' / landing on 4 posts':'')]);
    rows.push(['Guards', c.guardReq ? 'REQUIRED (>30")' : 'not required']);
    if (S.h >= 72) rows.push(['Post bracing', 'knee braces req\u2019d']);
    if (S.ledger) rows.push(['Lateral ties', '2 hold-downs @ 1,500 lb']);
    note = (c.swb ? 'Over 12 risers: mid landing added, stair shown as a standard switchback. ' : '')
      + (c.needMid ? 'Second girder row added: joist span is past the 2x10 table. ' : '')
      + (c.spliced ? 'Girder spliced over posts for stock length. ' : '')
      + (S.h >= 72 ? 'Posts over 6 ft get diagonal knee bracing \u2014 final bracing in the drawings. ' : '')
      + (S.ledger ? 'Attached decks get (2) lateral-load hold-downs near the deck edges per the IRC deck provisions \u2014 located in your permit set. ' : '');
  } else {
    rows = [
      ['Deck area', c.area+' sq ft / 2 tiers'],
      ['Upper joists', c.up.joists+' @ '+c.up.jsize+' / '+S.spacing+'" OC'+(c.up.needMid?' / 2 spans':'')],
      ['Lower joists', c.lo.joists+' @ '+c.lo.jsize+' / '+S.spacing+'" OC'+(c.lo.needMid?' / 2 spans':'')],
      ['Girders', c.girderMembers+' x (3)2x10 typ'],
      ['Posts 6x6 PT', c.footTotal],
      ['Footings', footStr(c)],
      ['Footing depth', 'per township (30\u201336" typ)'],
      ['Decking', '~'+c.deckLF+' LF (5-1/2" bd)'],
    ];
    if (S.ledger) rows.splice(7, 0, ['Ledger', c.up.jsize+' PT / lags 16" OC']);
    if (S.rail) rows.push(['Railing', '~'+c.railLF+' LF']);
    if (c.tierRisers > 0) rows.push(['Tier stair', c.tg.tierSw+"' wide / "+c.tierRisers+' risers']);
    if (S.stairs && c.gsp) rows.push(['Grade stair', c.gsp.sw+"' wide / "+c.gradeRisers+' risers'+(c.swb?' / switchback':'')]);
    if (S.stairs) rows.push(['Stair footings', '8" dia sonotube'+(c.swb?' / landing on 4 posts':'')]);
    rows.push(['Guards', c.guardReq ? 'REQUIRED (>30")' : (c.guardLo ? 'REQUIRED on lower (>30")' : 'not required')]);
    if (S.h >= 72) rows.push(['Post bracing', 'knee braces req\u2019d']);
    if (S.ledger) rows.push(['Lateral ties', '2 hold-downs @ 1,500 lb']);
    note = 'Lower tier hangs on the upper girder posts: shared row runs '+c.sharedPer+' posts on '+c.sharedDia+'" footings. '
      + (S.h >= 72 ? 'Posts over 6 ft get diagonal knee bracing \u2014 final bracing in the drawings. ' : '')
      + (S.ledger ? 'Attached decks get (2) lateral-load hold-downs near the deck edges per the IRC deck provisions \u2014 located in your permit set. ' : '')
      + (c.tierOver ? 'Tier stair run passes the lower edge at this depth: final stair layout is set in the drawings. ' : '')
      + (c.swb ? 'Grade stair over 12 risers: mid landing added, shown as a standard switchback. ' : '')
      + ((c.up.needMid || c.lo.needMid) ? 'Mid girder row added where the joist span runs past the 2x10 table. ' : '')
      + (c.spliced ? 'Girder spliced over posts for stock length. ' : '');
  }
  document.getElementById('takeoff').innerHTML = rows.map(function(r,i){
    return '<div class="row"><span>'+r[0]+'</span><b class="'+(i<2?'hl':'')+'">'+r[1]+'</b></div>';
  }).join('') + '<p class="note">'
    + note
    + 'Framing #2 SYP pressure-treated. Decking includes 12% waste (more for diagonal or picture-frame layouts). Footing depth is set by your township \u2014 most NJ towns run 30\u201336 in; your permit set uses your township\u2019s number. Footings sized for 1,500 psf soil. Planning numbers for pricing and visualization. Final sizes are set in your permit drawings.</p>';
  document.getElementById('railNote').textContent = c.tier2
    ? (c.guardReq || c.guardLo ? 'Tier surfaces over 30 inches above grade: guards are required by code.' : 'Both tiers under 30 inches: guards optional in most towns.')
    : (c.guardReq
      ? 'Deck surface over 30 inches above grade: guards are required by code.'
      : 'Under 30 inches above grade: guards optional in most towns.');
}

// ---------- copy ----------
function takeoffText(){
  const c = calc();
  return !c.tier2
    ? ('SANTINO DECK STUDIO takeoff\n'
    + 'Deck '+S.w+' ft x '+S.d+' ft, '+S.h+' in above grade, '+(S.ledger?'attached (ledger)':'freestanding')+'\n'
    + 'Joists '+c.joists+' @ '+c.jsize+' '+S.spacing+'in OC, Simpson hangers'+(c.needMid?' (2 spans, mid girder added)':'')+' / Girders '+c.beamRows+' x (3)2x10 typ'+(c.spliced?' (spliced over posts)':'')+'\n'
    + 'Footings '+c.footings+' @ '+c.dia+'in dia, depth per township (30-36in typ)'+(S.ledger?' / Ledger '+c.jsize+' PT, lags 16in OC':'')+'\n'
    + 'Decking ~'+c.deckLF+' LF incl 12% waste'+(S.rail?' / Railing ~'+c.railLF+' LF':'')+(S.stairs?' / Stairs '+S.stairW+'ft wide, '+c.risers+' risers'+(c.swb?', switchback w/ mid landing':''):'')+'\n'
    + 'Quote: https://santinodrafting.com/#quote')
    : ('SANTINO DECK STUDIO takeoff (two tier)\n'
    + 'Upper '+S.w+' ft x '+S.d+' ft at '+S.h+' in, '+(S.ledger?'attached (ledger)':'freestanding')+' / Lower '+S.w2+' ft x '+S.d2+' ft at '+c.h2e+' in, on shared posts\n'
    + 'Joists upper '+c.up.joists+' @ '+c.up.jsize+', lower '+c.lo.joists+' @ '+c.lo.jsize+', '+S.spacing+'in OC, Simpson hangers / Girders '+c.girderMembers+' x (3)2x10 typ\n'
    + 'Footings '+footStr(c).replace(/"/g,'in')+', depth per township (30-36in typ), shared row upsized'+(S.ledger?' / Ledger '+c.up.jsize+' PT, lags 16in OC':'')+'\n'
    + 'Decking ~'+c.deckLF+' LF'+(S.rail?' / Railing ~'+c.railLF+' LF':'')
    + (c.tierRisers?' / Tier stair '+c.tg.tierSw+'ft wide, '+c.tierRisers+' risers':'')
    + (S.stairs && c.gsp?' / Grade stair '+c.gsp.sw+'ft wide, '+c.gradeRisers+' risers'+(c.swb?', switchback w/ mid landing':''):'')+'\n'
    + 'Quote: https://santinodrafting.com/#quote');
}
document.getElementById('btnCopy').addEventListener('click', function(){
  const txt = takeoffText();
  const bC = document.getElementById('btnCopy');
  const okFn = function(){ bC.textContent='Copied'; setTimeout(function(){bC.textContent='Copy takeoff';},1400); };
  navigator.clipboard.writeText(txt).then(okFn).catch(function(){
    try{
      const ta2 = document.createElement('textarea'); ta2.value = txt;
      ta2.style.cssText = 'position:fixed;left:-999px;top:0';
      document.body.appendChild(ta2); ta2.select(); document.execCommand('copy'); ta2.remove(); okFn();
    }catch(e2){ bC.textContent='Copy failed'; setTimeout(function(){bC.textContent='Copy takeoff';},1600); }
  });
});

// ---------- 3D ----------
const wrap3 = document.getElementById('three-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xE9E5DC);
scene.fog = new THREE.Fog(0xE9E5DC, 70, 160);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap3.appendChild(renderer.domElement);

const amb = new THREE.HemisphereLight(0xffffff, 0xCFC9BC, 0.92); scene.add(amb);
const sun = new THREE.DirectionalLight(0xffffff, 0.88);
sun.position.set(26, 34, 18); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-44; sun.shadow.camera.right=44; sun.shadow.camera.top=44; sun.shadow.camera.bottom=-44;
scene.add(sun);

const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48),
  new THREE.MeshLambertMaterial({color:0x6F6B60}));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

const sidCanvas = document.createElement('canvas');
sidCanvas.width = 64; sidCanvas.height = 64;
(function(){
  const g = sidCanvas.getContext('2d');
  g.fillStyle = '#F1F0ED'; g.fillRect(0,0,64,64);
  g.fillStyle = 'rgba(112,112,112,0.35)'; g.fillRect(0,61,64,3);
})();
const sidTex = new THREE.CanvasTexture(sidCanvas);
sidTex.wrapS = THREE.RepeatWrapping; sidTex.wrapT = THREE.RepeatWrapping;

const M = {
  wood:  new THREE.MeshLambertMaterial({color:0xA98D68}),
  wood2: new THREE.MeshLambertMaterial({color:0xA18360}),
  siding:new THREE.MeshLambertMaterial({map:sidTex, color:0xFFFFFF}),
  frame: new THREE.MeshLambertMaterial({color:0x74604B}),
  post:  new THREE.MeshLambertMaterial({color:0x594939}),
  rail:  new THREE.MeshLambertMaterial({color:0x0C0E11}),
  house: new THREE.MeshLambertMaterial({color:0xE7E2D5}),
  accent:new THREE.MeshLambertMaterial({color:0xFF5A1F}),
  vinyl: new THREE.MeshLambertMaterial({color:0xF8F7F2}),
  ghost: new THREE.MeshLambertMaterial({color:0xE9E9E9}),
  ghostFrame: new THREE.MeshLambertMaterial({color:0xD7D7D7}),
  ghostDoor: new THREE.MeshLambertMaterial({color:0xB2B2B2}),
  ghostKnob: new THREE.MeshLambertMaterial({color:0x8A8A8A}),
  ghostGlass: new THREE.MeshLambertMaterial({color:0xCDCDCD, transparent:true, opacity:0.55}),
};
function box(w,h,d,mat,x,y,z,grp,shadow){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.castShadow = shadow!==false; m.receiveShadow = true; grp.add(m); return m;
}

let deckGroup = null;
// existing dwelling rendered half-toned (not in scope)
function buildHouse(grp, w, d, hft){
  const wallH = Math.max(16, hft + 9.5);
  sidTex.repeat.set(1, Math.max(8, Math.round(wallH/0.583)));
  sidTex.needsUpdate = true;
  const hw = box(w+8, wallH, 0.8, M.siding, 0, wallH/2, -0.4-d/2, grp);
  hw.receiveShadow = true;
  const wallZ = -d/2;
  // one door: 3'-0" x 80", threshold flush with finished deck surface
  const doorX = -w/4;
  box(3.5, 7.0, 0.06, M.ghostFrame, doorX, hft+3.5, wallZ+0.02, grp, false);
  box(3.0, 6.67, 0.07, M.ghostDoor, doorX, hft+6.67/2, wallZ+0.05, grp, false);
  box(0.12, 0.12, 0.15, M.ghostKnob, doorX+1.15, hft+3.0, wallZ+0.1, grp, false);
  // one window: 3'x4', sill held 36" above the deck surface
  const sill = 3.0, winW = 3.0, winH = 4.0, wx = w/4;
  box(winW+0.5, winH+0.5, 0.05, M.ghostFrame, wx, hft+sill+winH/2, wallZ+0.015, grp, false);
  box(winW, winH, 0.06, M.ghostGlass, wx, hft+sill+winH/2, wallZ+0.035, grp, false);
  box(0.08, winH, 0.075, M.ghostFrame, wx, hft+sill+winH/2, wallZ+0.04, grp, false);
  box(winW, 0.08, 0.075, M.ghostFrame, wx, hft+sill+winH/2, wallZ+0.04, grp, false);
}
// boards + rim + joists + girder rows with posts and footings, local to a deck center
// rowSpecs: [{z, footR, noPosts}] / jExt stretches joists behind the back edge (lower tier reaching its shared girder)
function buildFraming(grp, w, d, hft, rowSpecs, perRow, joists, jExt){
  const t = 1/12;
  const boardW = 0.46;
  const nB = Math.floor(d/boardW);
  for (let i=0;i<nB;i++){
    box(w, t, boardW-0.06, (i%2 ? M.wood2 : M.wood), 0, hft, -d/2 + boardW/2 + i*boardW, grp);
  }
  box(w, 0.62, 0.13, M.frame, 0, hft-0.36, d/2-0.07, grp);
  for (let j=0;j<joists;j++){
    const x = -w/2 + j*(S.spacing/12);
    if (x > w/2) break;
    box(0.13, 0.62, d + (jExt||0), M.frame, Math.min(x, w/2-0.07), hft-0.36, -(jExt||0)/2, grp);
  }
  rowSpecs.forEach(function(rs){
    box(w, 0.8, 0.42, M.post, 0, hft-0.85, rs.z, grp);
    if (rs.noPosts) return;
    const per = rs.per || perRow;
    for (let p=0;p<per;p++){
      const px = -w/2+1.5 + p*(Math.max(0.5,w-3)/(per-1));
      box(0.5, Math.max(0.4,hft-1.2), 0.5, M.post, px, (hft-1.2)/2, rs.z, grp);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(rs.footR,rs.footR,0.25,20), M.accent);
      foot.position.set(px, 0.12, rs.z); foot.castShadow=true; grp.add(foot);
    }
  });
}
// railing: white vinyl, top + bottom rails post to post, balusters between rails
// cut = one stair opening {edge, c, sw} or null
function buildRails(grp, w, d, hft, cut, includeBack){
  const railTop = 3.0, botY = 0.35;
  const segs = [];
  const addEdge = function(axis, at, L, cutHere){
    const parts = cutHere
      ? [{a:-L/2, b:cutHere.c - cutHere.sw/2}, {a:cutHere.c + cutHere.sw/2, b:L/2}]
      : [{a:-L/2, b:L/2}];
    parts.forEach(function(p){ if (p.b - p.a > 0.4) segs.push({axis:axis, at:at, a:p.a, b:p.b}); });
  };
  addEdge('x', d/2, w, (cut && cut.edge==='front') ? cut : null);
  addEdge('z', -w/2, d, (cut && cut.edge==='left') ? cut : null);
  addEdge('z', w/2, d, (cut && cut.edge==='right') ? cut : null);
  if (includeBack) addEdge('x', -d/2, w, null);
  segs.forEach(function(sg){
    const len = sg.b - sg.a; if (len < 0.8) return;
    const mid = (sg.a + sg.b)/2;
    if (sg.axis==='x'){
      box(len, 0.17, 0.26, M.vinyl, mid, hft+railTop-0.09, sg.at, grp);
      box(len, 0.11, 0.19, M.vinyl, mid, hft+botY, sg.at, grp);
    } else {
      box(0.26, 0.17, len, M.vinyl, sg.at, hft+railTop-0.09, mid, grp);
      box(0.19, 0.11, len, M.vinyl, sg.at, hft+botY, mid, grp);
    }
    const nP = Math.max(2, Math.ceil(len/6)+1);
    for (let p=0;p<nP;p++){
      const off = sg.a + p*(len/(nP-1));
      const px = sg.axis==='x' ? off : sg.at;
      const pz = sg.axis==='x' ? sg.at : off;
      box(0.32, railTop+0.22, 0.32, M.vinyl, px, hft+(railTop+0.22)/2, pz, grp);
      box(0.46, 0.11, 0.46, M.vinyl, px, hft+railTop+0.28, pz, grp);
    }
    const nBal = Math.floor(len/0.38);
    for (let b2=1;b2<nBal;b2++){
      const off = sg.a + b2*(len/nBal);
      const px = sg.axis==='x' ? off : sg.at;
      const pz = sg.axis==='x' ? sg.at : off;
      box(0.09, railTop-0.56, 0.09, M.vinyl, px, hft+botY+0.06+(railTop-0.56)/2, pz, grp, false);
    }
  });
}
// one straight flight descending +z locally from yTop; rails and balusters when railOn
function makeFlight(grp, n, rise, sw, yTop, cx, z0, dir, railOn){
  const t = 1/12, runL = 11/12;
  const runT = n*runL, drop = n*rise;
  for (let st=0; st<n; st++){
    box(sw, t*1.4, runL, M.wood, cx, yTop - rise*(st+1) + rise/2, z0 + dir*(runL/2 + st*runL), grp);
    box(sw, rise, 0.1, M.frame, cx, yTop - rise*(st+1), z0 + dir*(st*runL), grp);
  }
  if (railOn){
    const slope = Math.sqrt(runT*runT + drop*drop);
    const ang = Math.atan2(drop, runT) * dir;
    [cx - sw/2, cx + sw/2].forEach(function(hx){
      [2.85, 0.35].forEach(function(hy){
        const hr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, slope), M.vinyl);
        hr.position.set(hx, yTop - drop/2 + hy, z0 + dir*runT/2);
        hr.rotation.x = ang; hr.castShadow = true; hr.receiveShadow = true; grp.add(hr);
      });
      const nB = Math.max(2, Math.floor(runT/0.38));
      for (let k=1; k<nB; k++){
        const bz = k*(runT/nB);
        box(0.08, 2.38, 0.08, M.vinyl, hx, yTop - drop*(bz/runT) + 0.42 + 1.19, z0 + dir*bz, grp, false);
      }
    });
  }
}
// full stair assembly off one deck edge, to grade; switchback with mid landing past 12 risers
function buildStairs(grp, wF, dF, hIn, sp, railOn){
  const risers = Math.max(2, Math.ceil(hIn/7.5));
  const hft = hIn/12;
  const rise = hft/risers, runL = 11/12, sw = sp.sw;
  const t = 1/12;
  const ron = railOn && hIn > 30;
  const sgp = new THREE.Group();
  const swb = risers > 12;
  if (!swb){
    makeFlight(sgp, risers, rise, sw, hft, 0, 0, 1, ron);
    [-(sw/2-0.45), sw/2-0.45].forEach(function(fx){
      const sft = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.22,16), M.accent);
      sft.position.set(fx, 0.11, risers*runL - 0.4); sft.castShadow = true; sgp.add(sft);
    });
    if (ron){
      [-sw/2, sw/2].forEach(function(hx){ box(0.2, 2.95, 0.2, M.vinyl, hx, 1.47, risers*runL - 0.1, sgp); });
    }
  } else {
    const n1 = Math.ceil(risers/2), n2 = risers - n1;
    const len1 = n1*runL, Ld = Math.max(3, sw);
    const yLand = hft - n1*rise;
    const ex = sp.ext || 1;
    makeFlight(sgp, n1, rise, sw, hft, 0, 0, 1, ron);
    // landing platform on 4 posts with sonotube pads
    box(2*sw, t*2, Ld, M.wood, ex*sw/2, yLand, len1 + Ld/2, sgp);
    box(2*sw, 0.55, 0.16, M.frame, ex*sw/2, yLand - 0.32, len1 + 0.1, sgp, false);
    [ex*sw/2 - sw + 0.25, ex*sw/2 + sw - 0.25].forEach(function(px){
      [len1 + 0.25, len1 + Ld - 0.25].forEach(function(pz){
        box(0.4, Math.max(0.4, yLand - 0.05), 0.4, M.post, px, yLand/2, pz, sgp);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.22,16), M.accent);
        foot.position.set(px, 0.11, pz); foot.castShadow = true; sgp.add(foot);
      });
    });
    // landing guard: far edge + both side edges
    if (ron && yLand > 2.5){
      const guard = function(len, cxg, czg, alongX){
        if (alongX){
          box(len, 0.15, 0.22, M.vinyl, cxg, yLand + 2.9, czg, sgp);
          box(len, 0.10, 0.16, M.vinyl, cxg, yLand + 0.4, czg, sgp);
          const nB = Math.floor(len/0.38);
          for (let k=1; k<nB; k++) box(0.08, 2.3, 0.08, M.vinyl, cxg - len/2 + k*(len/nB), yLand + 0.45 + 1.15, czg, sgp, false);
        } else {
          box(0.22, 0.15, len, M.vinyl, cxg, yLand + 2.9, czg, sgp);
          box(0.16, 0.10, len, M.vinyl, cxg, yLand + 0.4, czg, sgp);
          const nB = Math.floor(len/0.38);
          for (let k=1; k<nB; k++) box(0.08, 2.3, 0.08, M.vinyl, cxg, yLand + 0.45 + 1.15, czg - len/2 + k*(len/nB), sgp, false);
        }
      };
      guard(2*sw, ex*sw/2, len1 + Ld - 0.12, true);
      guard(Ld, ex*(sw/2 + sw) - ex*0.12, len1 + Ld/2, false);
      guard(Ld, -ex*sw/2 + ex*0.12, len1 + Ld/2, false);
      [[ex*sw/2 - sw + 0.16, len1 + Ld - 0.16],[ex*sw/2 + sw - 0.16, len1 + Ld - 0.16],[ex*(sw/2 + sw) - ex*0.16, len1 + 0.16],[-ex*sw/2 + ex*0.16, len1 + 0.16]].forEach(function(pp){
        box(0.3, 3.1, 0.3, M.vinyl, pp[0], yLand + 1.55, pp[1], sgp);
        box(0.42, 0.1, 0.42, M.vinyl, pp[0], yLand + 3.15, pp[1], sgp);
      });
    }
    // return flight beside the first, descending back toward the deck face
    makeFlight(sgp, n2, rise, sw, yLand, ex*sw, len1, -1, ron);
    [ex*sw - (sw/2-0.45), ex*sw + (sw/2-0.45)].forEach(function(fx){
      const sft = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.22,16), M.accent);
      sft.position.set(fx, 0.11, len1 - n2*runL + 0.4); sft.castShadow = true; sgp.add(sft);
    });
    if (ron){
      [ex*sw - sw/2, ex*sw + sw/2].forEach(function(hx){ box(0.2, 2.95, 0.2, M.vinyl, hx, 1.47, len1 - n2*runL + 0.1, sgp); });
    }
  }
  if (sp.edge === 'front'){ sgp.position.set(sp.c, 0, dF/2); }
  else if (sp.edge === 'left'){ sgp.position.set(-wF/2, 0, sp.c); sgp.rotation.y = -Math.PI/2; }
  else { sgp.position.set(wF/2, 0, sp.c); sgp.rotation.y = Math.PI/2; }
  grp.add(sgp);
}
function buildDeck(){
  if (deckGroup) scene.remove(deckGroup);
  deckGroup = new THREE.Group();
  const w=S.w, d=S.d, hft=S.h/12;
  const c = calc();
  if (S.ledger) buildHouse(deckGroup, w, d, hft);
  if (!c.tier2){
    const rows = S.ledger ? [d/2-1.5] : [d/2-1.5, -d/2+1.5];
    if (c.needMid) rows.push(S.ledger ? -0.75 : 0);
    const footR = c.dia/24;
    buildFraming(deckGroup, w, d, hft, rows.map(function(z){ return {z:z, footR:footR}; }), c.perRow, c.joists, 0);
    const sp = stairPlace();
    if (S.rail) buildRails(deckGroup, w, d, hft, sp, !S.ledger);
    if (S.stairs && sp) buildStairs(deckGroup, S.w, S.d, S.h, sp, S.rail);
  } else {
    const hft2 = c.h2e/12, w2 = S.w2, d2 = S.d2, tg = c.tg;
    // upper tier: outer girder row is the shared row, footings upsized
    const rowsU = S.ledger ? [d/2-1.5] : [d/2-1.5, -d/2+1.5];
    if (c.up.needMid) rowsU.push(S.ledger ? -0.75 : 0);
    buildFraming(deckGroup, w, d, hft,
      rowsU.map(function(z){
        const shared = (z === d/2-1.5);
        return {z:z, footR:(shared ? c.sharedDia : c.up.dia)/24, per: shared ? c.sharedPer : c.up.perRow};
      }),
      c.up.perRow, c.up.joists, 0);
    const cutU = c.tierRisers > 0 ? {edge:'front', c:tg.tierC, sw:tg.tierSw} : null;
    if (S.rail) buildRails(deckGroup, w, d, hft, cutU, !S.ledger);
    // tier stair from the upper edge down onto the lower surface
    if (c.tierRisers > 0){
      const riseT = (hft - hft2)/c.tierRisers;
      const ron = S.rail && c.tierRisers >= 3;
      const tgrp = new THREE.Group();
      makeFlight(tgrp, c.tierRisers, riseT, tg.tierSw, hft, 0, 0, 1, ron);
      if (ron){
        [-tg.tierSw/2, tg.tierSw/2].forEach(function(hx){ box(0.2, 2.95, 0.2, M.vinyl, hx, hft2 + 1.47, c.tierRun - 0.1, tgrp); });
      }
      tgrp.position.set(tg.tierC, 0, d/2);
      deckGroup.add(tgrp);
    }
    // lower tier: joists reach back to a second girder bolted on the shared posts
    const lgrp = new THREE.Group();
    const rowsL = [{z: d2/2-1.5, footR: c.lo.dia/24}, {z: -d2/2-1.5, footR: 0, noPosts: true}];
    if (c.lo.needMid) rowsL.push({z: -1.5, footR: c.lo.dia/24});
    buildFraming(lgrp, w2, d2, hft2, rowsL, c.lo.perRow, c.lo.joists, 1);
    if (S.rail) buildRails(lgrp, w2, d2, hft2, c.gsp, false);
    if (S.stairs && c.gsp) buildStairs(lgrp, w2, d2, c.h2e, c.gsp, S.rail);
    lgrp.position.set(tg.cx2, 0, d/2 + d2/2);
    deckGroup.add(lgrp);
  }
  deckGroup.position.y = 0.01;
  scene.add(deckGroup);
}

// minimal orbit control
let theta = 0.9, phi = 1.12, radius = 34, target = new THREE.Vector3(0, 2.4, 0);
function applyCam(){
  camera.position.set(
    target.x + radius*Math.sin(phi)*Math.cos(theta),
    target.y + radius*Math.cos(phi),
    target.z + radius*Math.sin(phi)*Math.sin(theta));
  camera.lookAt(target);
}
const dCanvas = renderer.domElement;
dCanvas.style.touchAction = 'none';
const activePts = new Map();
let lastPinch = 0;
dCanvas.addEventListener('pointerdown', function(e){
  try{ dCanvas.setPointerCapture(e.pointerId); }catch(err){}
  activePts.set(e.pointerId, {x:e.clientX, y:e.clientY});
});
function endPt(e){ activePts.delete(e.pointerId); lastPinch = 0; }
dCanvas.addEventListener('pointerup', endPt);
dCanvas.addEventListener('pointercancel', endPt);
dCanvas.addEventListener('pointermove', function(e){
  const p = activePts.get(e.pointerId);
  if (!p) return;
  const px = p.x, py = p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (activePts.size === 2){
    const arr = Array.from(activePts.values());
    const dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    if (lastPinch > 0 && dist > 0){
      radius = Math.max(14, Math.min(80, radius * (lastPinch / dist)));
      applyCam();
    }
    lastPinch = dist;
  } else if (activePts.size === 1){
    const rc = dCanvas.getBoundingClientRect();
    theta += (e.clientX - px) * (4.6 / Math.max(300, rc.width));
    phi   -= (e.clientY - py) * (3.4 / Math.max(300, rc.height));
    phi = Math.max(0.25, Math.min(1.45, phi));
    applyCam();
  }
});
renderer.domElement.addEventListener('wheel', function(e){
  e.preventDefault();
  radius = Math.max(14, Math.min(80, radius + e.deltaY*0.03)); applyCam();
}, {passive:false});

function sizeStage(){
  const r = wrap3.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  camera.aspect = r.width/r.height; camera.updateProjectionMatrix();
}
window.addEventListener('resize', sizeStage);
function loop(){ requestAnimationFrame(loop); renderer.render(scene,camera); }

// ---------- 2D PLAN (SVG) ----------
function renderPlan(){
  const c = calc();
  const MODE = S.planMode || 'framing';
  const MOB = dsMob();
  const W = MOB ? 520 : 980, H = MOB ? 660 : 560, m=54;
  const availW = W - m*2 - 220, availH = H - m*2;
  if (c.tier2){ renderPlanTier2(c, W, H, m, availW, availH); return; }
  const spPre = stairPlace();
  const frontS = !!(S.stairs && spPre && spPre.edge==='front');
  const stairFt = frontS ? (c.swb ? (Math.ceil(c.risers/2)*(11/12) + Math.max(3, spPre.sw)) : c.risers*(11/12)) : 0;
  const sideFt = (S.stairs && spPre && (spPre.edge==='left'||spPre.edge==='right')) ? (c.risers*(11/12)+1) : 0;
  // fixed drafting scales (px/ft): drawing grows at constant scale; scale only steps at size thresholds
  const STEPS = [26, 22, 18, 14, 10];
  const wBud = MOB ? 430 : 770, dBud = MOB ? 300 : 370;
  let sc = STEPS[STEPS.length-1];
  for (let si=0; si<STEPS.length; si++){
    const t2 = STEPS[si];
    if ((S.w + sideFt)*t2 <= wBud && (S.d + stairFt)*t2 <= dBud){ sc = t2; break; }
  }
  const dw = S.w*sc, dd = S.d*sc;
  const x0 = MOB ? 42 : 84;
  const y0 = MOB ? 76 : 92;
  let s = '';
  const pleader = function(px,py, ex,ey, lines, side){
    const lx = ex + (side==='left'? -10 : 10);
    s += '<line x1="'+px+'" y1="'+py+'" x2="'+ex+'" y2="'+ey+'" stroke="#0C0E11" stroke-width="0.9"/>';
    s += '<line x1="'+ex+'" y1="'+ey+'" x2="'+lx+'" y2="'+ey+'" stroke="#0C0E11" stroke-width="0.9"/>';
    s += '<circle cx="'+px+'" cy="'+py+'" r="1.8" fill="#0C0E11"/>';
    const anch = (side==='left') ? 'end' : 'start';
    const tx0 = lx + (side==='left'? -4 : 4);
    for (let li=0; li<lines.length; li++){
      s += '<text x="'+tx0+'" y="'+(ey - ((lines.length-1)/2)*10.5 + li*10.5 + 3)+'" text-anchor="'+anch+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11">'+lines[li]+'</text>';
    }
  };
  const reg = function(x,y){ return '<path d="M'+(x-7)+' '+y+' H'+(x+7)+' M'+x+' '+(y-7)+' V'+(y+7)+'" stroke="#FF5A1F" stroke-width="2"/>'; };

  // ledger or rim at top
  if (S.ledger){
    s += '<rect x="'+(x0-30)+'" y="'+(y0-14)+'" width="'+(dw+60)+'" height="14" fill="url(#hatch)" stroke="#0C0E11" stroke-width="1.5"/>';
  }
  // outline
  s += '<rect x="'+x0+'" y="'+y0+'" width="'+dw+'" height="'+dd+'" fill="none" stroke="#0C0E11" stroke-width="2.5"/>';
  // decking boards (deck plan mode): parallel to the house
  if (MODE==='decking'){
    const bw2 = 0.46*sc;
    for (let by=y0+bw2; by<y0+dd-1; by+=bw2){
      s += '<line x1="'+x0+'" y1="'+by+'" x2="'+(x0+dw)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="0.7" opacity="0.5"/>';
    }
    const dl2 = 'PROPOSED COMPOSITE DECK';
    const dlw2 = dl2.length*6.6+14;
    s += '<rect x="'+(x0+dw/2-dlw2/2)+'" y="'+(y0+dd*0.5-10)+'" width="'+dlw2+'" height="16" fill="#F2EFE7" stroke="#0C0E11" stroke-width="0.8"/>';
    s += '<text x="'+(x0+dw/2)+'" y="'+(y0+dd*0.5+2)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#0C0E11">'+dl2+'</text>';
  }
  // joists (framing mode)
  const nJ = c.joists;
  if (MODE==='framing') for (let j=0;j<nJ;j++){
    let jx = x0 + j*(S.spacing/12)*sc;
    if (jx > x0+dw) break;
    const jhw = Math.max(1.2, 0.0625*sc);
    s += '<line x1="'+(jx-jhw)+'" y1="'+y0+'" x2="'+(jx-jhw)+'" y2="'+(y0+dd)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
    s += '<line x1="'+(jx+jhw)+'" y1="'+y0+'" x2="'+(jx+jhw)+'" y2="'+(y0+dd)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
  }
  // rim joist double line (framing)
  if (MODE==='framing'){
    s += '<rect x="'+(x0+3.5)+'" y="'+(y0+3.5)+'" width="'+(dw-7)+'" height="'+(dd-7)+'" fill="none" stroke="#0C0E11" stroke-width="0.9"/>';
  }
  // beams dashed + footings (framing mode)
  const rowsZ = (MODE==='framing') ? (S.ledger ? [S.d/2-1.5] : [S.d/2-1.5, -S.d/2+1.5]) : [];
  if (c.needMid) rowsZ.push(S.ledger ? -0.75 : 0);
  const rows = rowsZ.map(function(z){ return y0 + (z + S.d/2)*sc; });
  const fr9 = Math.max(7, Math.round(9 * c.dia/16));
  rows.forEach(function(by){
    s += '<line x1="'+(x0-6)+'" y1="'+(by-2.2)+'" x2="'+(x0+dw+6)+'" y2="'+(by-2.2)+'" stroke="#0C0E11" stroke-width="1.4" stroke-dasharray="10 5"/>';
    s += '<line x1="'+(x0-6)+'" y1="'+(by+2.2)+'" x2="'+(x0+dw+6)+'" y2="'+(by+2.2)+'" stroke="#0C0E11" stroke-width="1.4" stroke-dasharray="10 5"/>';
    const per = Math.max(2, Math.ceil(Math.max(0.5,S.w-3)/6)+1);
    for (let p=0;p<per;p++){
      const px = x0+1.5*sc + p*((dw-3*sc)/(per-1));
      s += '<circle cx="'+px+'" cy="'+by+'" r="'+fr9+'" fill="none" stroke="#FF5A1F" stroke-width="2.5"/>';
      s += '<line x1="'+(px-fr9*0.7)+'" y1="'+(by-fr9*0.7)+'" x2="'+(px+fr9*0.7)+'" y2="'+(by+fr9*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
      s += '<line x1="'+(px-fr9*0.7)+'" y1="'+(by+fr9*0.7)+'" x2="'+(px+fr9*0.7)+'" y2="'+(by-fr9*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
    }
  });
  // stairs
  let planSp = null, planSl = 0, planP = null;
  if (S.stairs){
    planSp = stairPlace();
    const swp = planSp.sw*sc;
    const risers = Math.max(2, Math.ceil(S.h/7.5));
    const swb2 = risers > 12;
    let avail;
    if (planSp.edge === 'front') avail = (H - 58) - (y0 + dd);
    else if (planSp.edge === 'left') avail = x0 - 42;
    else avail = (W - 252) - (x0 + dw);
    const ex = planSp.ext || 1;
    const eu0 = (planSp.edge === 'front')
      ? x0 + (planSp.c - planSp.sw/2 + S.w/2)*sc
      : y0 + (planSp.c - planSp.sw/2 + S.d/2)*sc;
    const P = planP = function(u, v){
      if (planSp.edge === 'front') return [eu0 + u, y0 + dd + v];
      if (planSp.edge === 'left')  return [x0 - v, eu0 + u];
      return [x0 + dw + v, eu0 + u];
    };
    const rect = function(u0, v0, u1, v1){
      const a = P(u0, v0), b = P(u1, v1);
      const xx = Math.min(a[0],b[0]), yy = Math.min(a[1],b[1]);
      s += '<rect x="'+xx+'" y="'+yy+'" width="'+Math.abs(b[0]-a[0])+'" height="'+Math.abs(b[1]-a[1])+'" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    };
    const tline = function(u0, v0, u1, v1){
      const a = P(u0, v0), b = P(u1, v1);
      s += '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#0C0E11" stroke-width="1"/>';
    };
    const sf = function(u, v){
      const q = P(u, v);
      s += '<circle cx="'+q[0]+'" cy="'+q[1]+'" r="5" fill="#F2EFE7" stroke="#FF5A1F" stroke-width="2"/><circle cx="'+q[0]+'" cy="'+q[1]+'" r="1.5" fill="#FF5A1F"/>';
    };
    if (!swb2){
      const nSh = Math.min(risers, 14);
      const run = Math.max(5, Math.min((11/12)*sc, avail/nSh));
      planSl = nSh*run;
      rect(0, 0, swp, planSl);
      if (MODE==='framing'){
        [8, swp/2, swp-8].forEach(function(su){ tline(su, 2, su, planSl-2); });
        sf(7, planSl - 7); sf(swp - 7, planSl - 7);
      } else {
        for (let st=1; st<nSh; st++) tline(0, st*run, swp, st*run);
      }
      const a1 = P(swp/2, planSl*0.2), a2 = P(swp/2, planSl*0.8);
      s += '<line x1="'+a1[0]+'" y1="'+a1[1]+'" x2="'+a2[0]+'" y2="'+a2[1]+'" stroke="#0C0E11" stroke-width="1"/>';
      s += '<path d="M'+a2[0]+' '+a2[1]+' m-3.5 -6 l3.5 6 l3.5 -6 z" fill="#0C0E11"/>';
      const lc = P(swp/2, planSl + 13);
      s += '<text x="'+lc[0]+'" y="'+lc[1]+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="#0C0E11">DN</text>';
    } else {
      const n1 = Math.ceil(risers/2), n2 = risers - n1;
      let run = (11/12)*sc, Ldp = Math.max(3, planSp.sw)*sc;
      const full = n1*run + Ldp;
      if (full > avail){ const kf = Math.max(0.3, avail/full); run *= kf; Ldp *= kf; }
      run = Math.max(4, run);
      const L1 = n1*run;
      planSl = L1 + Ldp;
      rect(0, 0, swp, L1);
      for (let st=1; st<n1; st++) tline(0, st*run, swp, st*run);
      const uland0 = ex > 0 ? 0 : -swp;
      rect(uland0, L1, uland0 + 2*swp, L1 + Ldp);
      const ulow0 = ex > 0 ? swp : -swp;
      rect(ulow0, L1 - n2*run, ulow0 + swp, L1);
      for (let st=1; st<n2; st++) tline(ulow0, L1 - st*run, ulow0 + swp, L1 - st*run);
      if (MODE==='framing'){
        sf(uland0 + 7, L1 + 7); sf(uland0 + 2*swp - 7, L1 + 7);
        sf(uland0 + 7, L1 + Ldp - 7); sf(uland0 + 2*swp - 7, L1 + Ldp - 7);
        sf(ulow0 + 7, L1 - n2*run + 7); sf(ulow0 + swp - 7, L1 - n2*run + 7);
      }
      const lc = P(uland0 + swp, L1 + Ldp + 13);
      s += '<text x="'+lc[0]+'" y="'+lc[1]+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#0C0E11">DN '+risers+'R SWITCHBACK</text>';
    }
  }
  // railing: inset guard line on railed edges, broken at the stair (deck plan mode)
  if (MODE==='decking' && S.rail){
    const ro = 5;
    const rseg = function(x1,y1,x2,y2){ s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="1.1" opacity="0.8"/>'; };
    const cutE = planSp ? planSp.edge : null;
    const cu0 = planSp ? ((cutE==='front') ? x0+(planSp.c-planSp.sw/2+S.w/2)*sc : y0+(planSp.c-planSp.sw/2+S.d/2)*sc) : 0;
    const cu1 = planSp ? cu0 + planSp.sw*sc : 0;
    const edgeR = function(edge){
      if (edge==='front'){
        const ey = y0+dd-ro;
        if (cutE==='front'){ if (cu0 > x0+ro+4) rseg(x0+ro, ey, Math.min(cu0, x0+dw-ro), ey); if (cu1 < x0+dw-ro-4) rseg(Math.max(cu1, x0+ro), ey, x0+dw-ro, ey); }
        else rseg(x0+ro, ey, x0+dw-ro, ey);
      } else if (edge==='back'){
        rseg(x0+ro, y0+ro, x0+dw-ro, y0+ro);
      } else {
        const ex = (edge==='left') ? x0+ro : x0+dw-ro;
        if (cutE===edge){ if (cu0 > y0+ro+4) rseg(ex, y0+ro, ex, Math.min(cu0, y0+dd-ro)); if (cu1 < y0+dd-ro-4) rseg(ex, Math.max(cu1, y0+ro), ex, y0+dd-ro); }
        else rseg(ex, y0+ro, ex, y0+dd-ro);
      }
    };
    edgeR('left'); edgeR('right'); edgeR('front');
    if (!S.ledger) edgeR('back');
  }
  // dimensions
  function dim(x1,y1,x2,y2,label,off,vert){
    const oxs = vert? off:0, oys = vert? 0:off;
    s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+(x1+oxs)+'" y2="'+(y1+oys)+'" stroke="#0C0E11" stroke-width="0.8"/>';
    s += '<line x1="'+x2+'" y1="'+y2+'" x2="'+(x2+oxs)+'" y2="'+(y2+oys)+'" stroke="#0C0E11" stroke-width="0.8"/>';
    const ax1=x1+oxs, ay1=y1+oys, ax2=x2+oxs, ay2=y2+oys;
    s += '<line x1="'+ax1+'" y1="'+ay1+'" x2="'+ax2+'" y2="'+ay2+'" stroke="#0C0E11" stroke-width="1.2"/>';
    const mx=(ax1+ax2)/2, my=(ay1+ay2)/2;
    if (vert){
      s += '<text x="'+(mx+14)+'" y="'+my+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="'+(dsMob()?15:13)+'" fill="#0C0E11" transform="rotate(90 '+(mx+14)+' '+my+')">'+label+'</text>';
    } else {
      s += '<text x="'+mx+'" y="'+(my-7)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="'+(dsMob()?15:13)+'" fill="#0C0E11">'+label+'</text>';
    }
    [[ax1,ay1,1],[ax2,ay2,-1]].forEach(function(a){
      if (vert){ s += '<path d="M'+a[0]+' '+a[1]+' l-4 '+(7*a[2])+' l8 0 z" fill="#0C0E11"/>'; }
      else { s += '<path d="M'+a[0]+' '+a[1]+' l'+(7*a[2])+' -4 l0 8 z" fill="#0C0E11"/>'; }
    });
  }
  if (planSp && planSp.edge==='front'){
    dim(x0, y0, x0+dw, y0, S.w+"'-0\"", -(S.ledger ? 46 : 32), false);
  } else {
    dim(x0, y0+dd, x0+dw, y0+dd, S.w+"'-0\"", Math.max(20, Math.min(34, (H-52)-(y0+dd))), false);
  }
  if (planSp && planSp.edge==='left'){
    dim(x0+dw, y0, x0+dw, y0+dd, S.d+"'-0\"", 34, true);
  } else {
    dim(x0, y0, x0, y0+dd, S.d+"'-0\"", -34, true);
  }
  const ftIn = function(v){ const f2=Math.floor(v+0.001); const in2=Math.round((v-f2)*12); return f2+"'-"+in2+'"'; };
  if (MODE==='framing' && (!planSp || (planSp.edge!=='right' && planSp.edge!=='left'))){
    const gyC = y0 + (S.d-1.5)*sc;
    dim(x0+dw, y0, x0+dw, gyC, ftIn(S.d-1.5), 30, true);
    dim(x0+dw, gyC, x0+dw, y0+dd, "1'-6\"", 30, true);
  }
  // post-spacing chain along the beam with centerline marks (his framing-plan signature)
  if (MODE==='framing'){
    const rowY = y0 + (S.d/2-1.5 + S.d/2)*sc;
    const per2 = Math.max(2, Math.ceil(Math.max(0.5,S.w-3)/6)+1);
    const pr2 = Math.max(0.5, S.w-3), psp2 = pr2/(per2-1);
    const pxs = []; for (let i3=0;i3<per2;i3++){ pxs.push(x0 + (1.5 + i3*psp2)*sc); }
    pxs.forEach(function(pxc){
      s += '<text x="'+pxc+'" y="'+(rowY-13)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#0C0E11">&#8452;</text>';
    });
    const chY = rowY + 20;
    const chain = [x0].concat(pxs).concat([x0+dw]);
    for (let i4=0;i4<chain.length-1;i4++){
      const a5=chain[i4], b5=chain[i4+1];
      if (b5-a5 < 14) continue;
      const lbl2 = (i4===0 || i4===chain.length-2) ? "1'-6\"" : ftIn(psp2);
      s += '<line x1="'+a5+'" y1="'+(chY-4)+'" x2="'+a5+'" y2="'+(chY+4)+'" stroke="#0C0E11" stroke-width="0.9"/>';
      s += '<line x1="'+b5+'" y1="'+(chY-4)+'" x2="'+b5+'" y2="'+(chY+4)+'" stroke="#0C0E11" stroke-width="0.9"/>';
      s += '<line x1="'+a5+'" y1="'+chY+'" x2="'+b5+'" y2="'+chY+'" stroke="#0C0E11" stroke-width="0.9"/>';
      s += '<text x="'+((a5+b5)/2)+'" y="'+(chY-6)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="'+(MOB?10.5:8.5)+'" fill="#0C0E11">'+lbl2+'</text>';
    }
  }
  // dim descriptor + section bubble (deck plan, his A-1 convention)
  (function(){
    const topDimY = (planSp && planSp.edge==='front') ? (y0 - (S.ledger ? 46 : 32)) : null;
    if (topDimY !== null){
      s += '<text x="'+(x0+dw/2)+'" y="'+(topDimY+11)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="7.5" fill="#0C0E11" opacity="0.85">PROPOSED DECK</text>';
    }
    if (MODE==='decking'){
      const bx = x0+dw+30, by2 = y0+dd/2;
      s += '<circle cx="'+bx+'" cy="'+by2+'" r="11" fill="#F2EFE7" stroke="#0C0E11" stroke-width="1.4"/>';
      s += '<line x1="'+(bx-11)+'" y1="'+by2+'" x2="'+(bx+11)+'" y2="'+by2+'" stroke="#0C0E11" stroke-width="1"/>';
      s += '<text x="'+bx+'" y="'+(by2-2.5)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#0C0E11">1</text>';
      s += '<text x="'+bx+'" y="'+(by2+8.5)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="6.5" fill="#0C0E11">A-2</text>';
      s += '<path d="M'+(bx-11)+' '+by2+' l-8 -5 l0 10 z" fill="#0C0E11"/>';
    }
  })();

  // note
  (function(){
    const num = (MODE==='decking') ? '2' : '1';
    const ttl = (MODE==='decking') ? 'PROPOSED DECK PLAN' : 'PROPOSED FRAMING PLAN';
    s += '<circle cx="46" cy="'+(H-30)+'" r="11" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="46" y="'+(H-26)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="#0C0E11">'+num+'</text>';
    s += '<text x="64" y="'+(H-26)+'" font-family="IBM Plex Mono" font-weight="600" font-size="12" letter-spacing="1" fill="#0C0E11">'+ttl+'</text>';
    s += '<line x1="64" y1="'+(H-19)+'" x2="'+(64+ttl.length*8.2+8)+'" y2="'+(H-19)+'" stroke="#0C0E11" stroke-width="1.4"/>';
    s += '<text x="'+(64+ttl.length*8.2+22)+'" y="'+(H-26)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.8">PERMIT SET DRAWN AT 1/4" = 1\'-0"</text>';
    s += '<text x="'+(W-20)+'" y="'+(H-26)+'" text-anchor="end" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#FF5A1F">PRELIMINARY / NOT FOR CONSTRUCTION</text>';
  })();
  document.getElementById('plan-wrap').innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<defs><pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="8" stroke="#0C0E11" stroke-width="1.4"/></pattern></defs>'
    + s + '</svg>';
}

// two tier framing plan: both rectangles, shared row marked, tier stair between, grade stair off the lower
function renderPlanTier2(c, W, H, m, availW, availH){
  const MODE = S.planMode || 'framing';
  const MOB = W < 700;
  const w=S.w, d=S.d, w2=S.w2, d2=S.d2, tg=c.tg;
  const minX = Math.min(-w/2, tg.cx2 - w2/2), maxX = Math.max(w/2, tg.cx2 + w2/2);
  const Wx = maxX - minX, Dz = d + d2;
  const gspPre = c.gsp;
  const frontG = !!(S.stairs && gspPre && gspPre.edge==='front');
  const stairFt2 = frontG ? (c.swb ? (Math.ceil(c.gradeRisers/2)*(11/12) + Math.max(3, gspPre.sw)) : c.gradeRisers*(11/12)) : 0;
  const STEPS2 = [20, 16, 13, 10, 8];
  const wBud2 = MOB ? 430 : 770, dBud2 = MOB ? 292 : 358;
  let sc = STEPS2[STEPS2.length-1];
  for (let si=0; si<STEPS2.length; si++){
    const t2 = STEPS2[si];
    if (Wx*t2 <= wBud2 && (Dz + stairFt2)*t2 <= dBud2){ sc = t2; break; }
  }
  const x0 = MOB ? 42 : 84;
  const y0 = MOB ? 72 : 86;
  const X = function(x){ return x0 + (x - minX)*sc; };
  const Y = function(z){ return y0 + (z + d/2)*sc; };
  let s = '';
  const reg = function(x,y){ return '<path d="M'+(x-7)+' '+y+' H'+(x+7)+' M'+x+' '+(y-7)+' V'+(y+7)+'" stroke="#FF5A1F" stroke-width="2"/>'; };

  if (S.ledger){
    s += '<rect x="'+(X(-w/2)-16)+'" y="'+(Y(-d/2)-14)+'" width="'+(w*sc+32)+'" height="14" fill="url(#hatch)" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="'+(X(w/2)+24)+'" y="'+(Y(-d/2)-3)+'" font-family="IBM Plex Mono" font-size="10" fill="#0C0E11">EXIST. HOUSE / LEDGER</text>';
  }
  // upper rectangle + joists
  s += '<rect x="'+X(-w/2)+'" y="'+Y(-d/2)+'" width="'+(w*sc)+'" height="'+(d*sc)+'" fill="none" stroke="#0C0E11" stroke-width="2.5"/>';
  if (MODE==='decking'){
    const bw2u = 0.46*sc;
    for (let by=Y(-d/2)+bw2u; by<Y(d/2)-1; by+=bw2u){
      s += '<line x1="'+X(-w/2)+'" y1="'+by+'" x2="'+X(w/2)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="0.7" opacity="0.5"/>';
    }
  }
  if (MODE==='framing') for (let j=0;j<c.up.joists;j++){
    const jx = X(-w/2) + j*(S.spacing/12)*sc;
    if (jx > X(w/2)) break;
    const jh2 = Math.max(1.1, 0.0625*sc);
    s += '<line x1="'+(jx-jh2)+'" y1="'+Y(-d/2)+'" x2="'+(jx-jh2)+'" y2="'+Y(d/2)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
    s += '<line x1="'+(jx+jh2)+'" y1="'+Y(-d/2)+'" x2="'+(jx+jh2)+'" y2="'+Y(d/2)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
  }
  // upper girder rows (outer row is the shared row, circles upsized)
  const rowsZU = (MODE==='framing') ? (S.ledger ? [d/2-1.5] : [d/2-1.5, -d/2+1.5]) : [];
  if (c.up.needMid) rowsZU.push(S.ledger ? -0.75 : 0);
  rowsZU.forEach(function(z){
    const by = Y(z);
    const shared = (z === d/2-1.5);
    const diaHere = shared ? c.sharedDia : c.up.dia;
    const perHere = shared ? c.sharedPer : c.up.perRow;
    const fr = Math.max(7, Math.round(9 * diaHere/16));
    s += '<line x1="'+(X(-w/2)-6)+'" y1="'+by+'" x2="'+(X(w/2)+6)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="2.5" stroke-dasharray="10 5"/>';
    for (let p=0;p<perHere;p++){
      const px = X(-w/2)+1.5*sc + p*((w-3)*sc/(perHere-1));
      s += '<circle cx="'+px+'" cy="'+by+'" r="'+fr+'" fill="none" stroke="#FF5A1F" stroke-width="2.5"/>';
      s += '<line x1="'+(px-fr*0.7)+'" y1="'+(by-fr*0.7)+'" x2="'+(px+fr*0.7)+'" y2="'+(by+fr*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
      s += '<line x1="'+(px-fr*0.7)+'" y1="'+(by+fr*0.7)+'" x2="'+(px+fr*0.7)+'" y2="'+(by-fr*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
    }
    if (z === d/2-1.5){
      s += '<text x="'+(X(-w/2)-12)+'" y="'+(by+3)+'" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11">SHARED ROW</text>';
    }
  });
  // lower rectangle + joists
  s += '<rect x="'+X(tg.cx2-w2/2)+'" y="'+Y(d/2)+'" width="'+(w2*sc)+'" height="'+(d2*sc)+'" fill="none" stroke="#0C0E11" stroke-width="2.5"/>';
  if (MODE==='decking'){
    const bw2l = 0.46*sc;
    for (let by=Y(d/2)+bw2l; by<Y(d/2+d2)-1; by+=bw2l){
      s += '<line x1="'+X(tg.cx2-w2/2)+'" y1="'+by+'" x2="'+X(tg.cx2+w2/2)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="0.7" opacity="0.5"/>';
    }
  }
  if (MODE==='framing') for (let j=0;j<c.lo.joists;j++){
    const jx = X(tg.cx2-w2/2) + j*(S.spacing/12)*sc;
    if (jx > X(tg.cx2+w2/2)) break;
    const jh3 = Math.max(1.1, 0.0625*sc);
    s += '<line x1="'+(jx-jh3)+'" y1="'+Y(d/2)+'" x2="'+(jx-jh3)+'" y2="'+Y(d/2+d2)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
    s += '<line x1="'+(jx+jh3)+'" y1="'+Y(d/2)+'" x2="'+(jx+jh3)+'" y2="'+Y(d/2+d2)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
  }
  // lower girder rows
  const rowsZL = (MODE==='framing') ? [d/2+d2-1.5] : [];
  if (c.lo.needMid) rowsZL.push(d/2 + d2/2 - 1.5);
  const frL = Math.max(7, Math.round(9 * c.lo.dia/16));
  rowsZL.forEach(function(z){
    const by = Y(z);
    s += '<line x1="'+(X(tg.cx2-w2/2)-6)+'" y1="'+by+'" x2="'+(X(tg.cx2+w2/2)+6)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="2.5" stroke-dasharray="10 5"/>';
    for (let p=0;p<c.lo.perRow;p++){
      const px = X(tg.cx2-w2/2)+1.5*sc + p*(Math.max(0.5,w2-3)*sc/(c.lo.perRow-1));
      s += '<circle cx="'+px+'" cy="'+by+'" r="'+frL+'" fill="none" stroke="#FF5A1F" stroke-width="2.5"/>';
      s += '<line x1="'+(px-frL*0.7)+'" y1="'+(by-frL*0.7)+'" x2="'+(px+frL*0.7)+'" y2="'+(by+frL*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
      s += '<line x1="'+(px-frL*0.7)+'" y1="'+(by+frL*0.7)+'" x2="'+(px+frL*0.7)+'" y2="'+(by-frL*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
    }
  });
  // tier stair inside the lower rect at the shared edge
  if (c.tierRisers > 0){
    const tswPx = tg.tierSw*sc;
    const u0 = X(tg.tierC - tg.tierSw/2);
    let runPx = c.tierRun*sc;
    const maxPx = d2*sc - 10;
    if (runPx > maxPx) runPx = Math.max(18, maxPx);
    s += '<rect x="'+u0+'" y="'+Y(d/2)+'" width="'+tswPx+'" height="'+runPx+'" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    for (let st=1; st<c.tierRisers; st++){
      const ty = Y(d/2) + st*(runPx/c.tierRisers);
      s += '<line x1="'+u0+'" y1="'+ty+'" x2="'+(u0+tswPx)+'" y2="'+ty+'" stroke="#0C0E11" stroke-width="1"/>';
    }
    s += '<text x="'+(u0+tswPx+7)+'" y="'+(Y(d/2)+runPx/2+3)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11">DN '+c.tierRisers+'R</text>';
  }
  // grade stair off the lower tier
  let planSl = 0;
  const gsp = c.gsp;
  if (S.stairs && gsp){
    const swp = gsp.sw*sc;
    const risers = c.gradeRisers;
    const swb2 = risers > 12;
    const cz2 = d/2 + d2/2;
    let avail, P;
    if (gsp.edge === 'front'){
      const eu0 = X(tg.cx2 + gsp.c - gsp.sw/2), bv = Y(d/2+d2);
      avail = (H - 58) - bv;
      P = function(u,v){ return [eu0 + u, bv + v]; };
    } else if (gsp.edge === 'left'){
      const xe = X(tg.cx2 - w2/2), ev0 = Y(cz2 + gsp.c - gsp.sw/2);
      avail = xe - 42;
      P = function(u,v){ return [xe - v, ev0 + u]; };
    } else {
      const xe = X(tg.cx2 + w2/2), ev0 = Y(cz2 + gsp.c - gsp.sw/2);
      avail = (W - 252) - xe;
      P = function(u,v){ return [xe + v, ev0 + u]; };
    }
    const rect = function(u0, v0, u1, v1){
      const a = P(u0, v0), b = P(u1, v1);
      const xx = Math.min(a[0],b[0]), yy = Math.min(a[1],b[1]);
      s += '<rect x="'+xx+'" y="'+yy+'" width="'+Math.abs(b[0]-a[0])+'" height="'+Math.abs(b[1]-a[1])+'" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    };
    const tline = function(u0, v0, u1, v1){
      const a = P(u0, v0), b = P(u1, v1);
      s += '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'" stroke="#0C0E11" stroke-width="1"/>';
    };
    const sf = function(u, v){
      const q = P(u, v);
      s += '<circle cx="'+q[0]+'" cy="'+q[1]+'" r="5" fill="#F2EFE7" stroke="#FF5A1F" stroke-width="2"/><circle cx="'+q[0]+'" cy="'+q[1]+'" r="1.5" fill="#FF5A1F"/>';
    };
    const ex = gsp.ext || 1;
    if (!swb2){
      const nSh = Math.min(risers, 14);
      const run = Math.max(5, Math.min((11/12)*sc, avail/nSh));
      planSl = nSh*run;
      rect(0, 0, swp, planSl);
      if (MODE==='framing'){
        [8, swp/2, swp-8].forEach(function(su){ tline(su, 2, su, planSl-2); });
        sf(7, planSl - 7); sf(swp - 7, planSl - 7);
      } else {
        for (let st=1; st<nSh; st++) tline(0, st*run, swp, st*run);
      }
      const a1 = P(swp/2, planSl*0.2), a2 = P(swp/2, planSl*0.8);
      s += '<line x1="'+a1[0]+'" y1="'+a1[1]+'" x2="'+a2[0]+'" y2="'+a2[1]+'" stroke="#0C0E11" stroke-width="1"/>';
      s += '<path d="M'+a2[0]+' '+a2[1]+' m-3.5 -6 l3.5 6 l3.5 -6 z" fill="#0C0E11"/>';
      const lc = P(swp/2, planSl + 13);
      s += '<text x="'+lc[0]+'" y="'+lc[1]+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="#0C0E11">DN</text>';
    } else {
      const n1 = Math.ceil(risers/2), n2 = risers - n1;
      let run = (11/12)*sc, Ldp = Math.max(3, gsp.sw)*sc;
      const full = n1*run + Ldp;
      if (full > avail){ const kf = Math.max(0.3, avail/full); run *= kf; Ldp *= kf; }
      run = Math.max(4, run);
      const L1 = n1*run;
      planSl = L1 + Ldp;
      rect(0, 0, swp, L1);
      for (let st=1; st<n1; st++) tline(0, st*run, swp, st*run);
      const uland0 = ex > 0 ? 0 : -swp;
      rect(uland0, L1, uland0 + 2*swp, L1 + Ldp);
      const ulow0 = ex > 0 ? swp : -swp;
      rect(ulow0, L1 - n2*run, ulow0 + swp, L1);
      for (let st=1; st<n2; st++) tline(ulow0, L1 - st*run, ulow0 + swp, L1 - st*run);
      if (MODE==='framing'){
        sf(uland0 + 7, L1 + 7); sf(uland0 + 2*swp - 7, L1 + 7);
        sf(uland0 + 7, L1 + Ldp - 7); sf(uland0 + 2*swp - 7, L1 + Ldp - 7);
        sf(ulow0 + 7, L1 - n2*run + 7); sf(ulow0 + swp - 7, L1 - n2*run + 7);
      }
      const lc = P(uland0 + swp, L1 + Ldp + 13);
      s += '<text x="'+lc[0]+'" y="'+lc[1]+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#0C0E11">DN '+risers+'R SWITCHBACK</text>';
    }
  }
  // railing: inset guard lines; upper cut at the tier stair, lower cut at the grade stair (deck plan)
  if (MODE==='decking' && S.rail){
    const ro = 5;
    const rseg = function(x1,y1,x2,y2){ s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="1.1" opacity="0.8"/>'; };
    // upper rect
    const ux0=X(-w/2), ux1=X(w/2), uy0=Y(-d/2), uy1=Y(d/2);
    rseg(ux0+ro, uy0+ro, ux0+ro, uy1-ro); rseg(ux1-ro, uy0+ro, ux1-ro, uy1-ro);
    if (!S.ledger) rseg(ux0+ro, uy0+ro, ux1-ro, uy0+ro);
    if (c.tierRisers > 0){
      const tc0=X(tg.tierC - tg.tierSw/2), tc1=X(tg.tierC + tg.tierSw/2);
      if (tc0 > ux0+ro+4) rseg(ux0+ro, uy1-ro, Math.min(tc0, ux1-ro), uy1-ro);
      if (tc1 < ux1-ro-4) rseg(Math.max(tc1, ux0+ro), uy1-ro, ux1-ro, uy1-ro);
    } else { rseg(ux0+ro, uy1-ro, ux1-ro, uy1-ro); }
    // lower rect
    const lx0=X(tg.cx2-w2/2), lx1=X(tg.cx2+w2/2), ly0=Y(d/2), ly1=Y(d/2+d2);
    rseg(lx0+ro, ly0+ro, lx0+ro, ly1-ro); rseg(lx1-ro, ly0+ro, lx1-ro, ly1-ro);
    if (gsp && gsp.edge==='front'){
      const gc0=X(tg.cx2 + gsp.c - gsp.sw/2), gc1=X(tg.cx2 + gsp.c + gsp.sw/2);
      if (gc0 > lx0+ro+4) rseg(lx0+ro, ly1-ro, Math.min(gc0, lx1-ro), ly1-ro);
      if (gc1 < lx1-ro-4) rseg(Math.max(gc1, lx0+ro), ly1-ro, lx1-ro, ly1-ro);
    } else { rseg(lx0+ro, ly1-ro, lx1-ro, ly1-ro); }
  }
  // dimensions
  function dim(x1,y1,x2,y2,label,off,vert){
    const oxs = vert? off:0, oys = vert? 0:off;
    s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+(x1+oxs)+'" y2="'+(y1+oys)+'" stroke="#0C0E11" stroke-width="0.8"/>';
    s += '<line x1="'+x2+'" y1="'+y2+'" x2="'+(x2+oxs)+'" y2="'+(y2+oys)+'" stroke="#0C0E11" stroke-width="0.8"/>';
    const ax1=x1+oxs, ay1=y1+oys, ax2=x2+oxs, ay2=y2+oys;
    s += '<line x1="'+ax1+'" y1="'+ay1+'" x2="'+ax2+'" y2="'+ay2+'" stroke="#0C0E11" stroke-width="1.2"/>';
    const mx=(ax1+ax2)/2, my=(ay1+ay2)/2;
    if (vert){
      s += '<text x="'+(mx+14)+'" y="'+my+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="'+(dsMob()?15:13)+'" fill="#0C0E11" transform="rotate(90 '+(mx+14)+' '+my+')">'+label+'</text>';
    } else {
      s += '<text x="'+mx+'" y="'+(my-7)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="'+(dsMob()?15:13)+'" fill="#0C0E11">'+label+'</text>';
    }
    [[ax1,ay1,1],[ax2,ay2,-1]].forEach(function(a){
      if (vert){ s += '<path d="M'+a[0]+' '+a[1]+' l-4 '+(7*a[2])+' l8 0 z" fill="#0C0E11"/>'; }
      else { s += '<path d="M'+a[0]+' '+a[1]+' l'+(7*a[2])+' -4 l0 8 z" fill="#0C0E11"/>'; }
    });
  }
  dim(X(-w/2), Y(-d/2), X(w/2), Y(-d/2), w+"'-0\"", -36, false);
  const offB2 = 34 + ((gsp && gsp.edge==='front') ? planSl + 12 : 0);
  dim(X(tg.cx2-w2/2), Y(d/2+d2), X(tg.cx2+w2/2), Y(d/2+d2), w2+"'-0\"", offB2, false);
  const offLU = -34 - ((gsp && gsp.edge==='left' && tg.cx2 - w2/2 <= -w/2 + 0.5) ? planSl + 12 : 0);
  dim(X(-w/2), Y(-d/2), X(-w/2), Y(d/2), d+"'-0\"", offLU, true);
  const offRL = 34 + ((gsp && gsp.edge==='right') ? planSl + 12 : 0);
  dim(X(tg.cx2+w2/2), Y(d/2), X(tg.cx2+w2/2), Y(d/2+d2), d2+"'-0\"", offRL, true);
  // notes
  (function(){
    const num = (MODE==='decking') ? '2' : '1';
    const ttl = (MODE==='decking') ? 'PROPOSED DECK PLAN' : 'PROPOSED FRAMING PLAN';
    s += '<circle cx="46" cy="'+(H-30)+'" r="11" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="46" y="'+(H-26)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="#0C0E11">'+num+'</text>';
    s += '<text x="64" y="'+(H-26)+'" font-family="IBM Plex Mono" font-weight="600" font-size="12" letter-spacing="1" fill="#0C0E11">'+ttl+'</text>';
    s += '<line x1="64" y1="'+(H-19)+'" x2="'+(64+ttl.length*8.2+8)+'" y2="'+(H-19)+'" stroke="#0C0E11" stroke-width="1.4"/>';
    s += '<text x="'+(64+ttl.length*8.2+22)+'" y="'+(H-26)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.8">PERMIT SET DRAWN AT 1/4" = 1\'-0"</text>';
    s += '<text x="'+(W-20)+'" y="'+(H-26)+'" text-anchor="end" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#FF5A1F">PRELIMINARY / NOT FOR CONSTRUCTION</text>';
  })();
  document.getElementById('plan-wrap').innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<defs><pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="8" stroke="#0C0E11" stroke-width="1.4"/></pattern></defs>'
    + s + '</svg>';
}


function dsMob(){
  const st = document.querySelector('.stage');
  return ((st && st.clientWidth) || 980) < 700;
}
// ---------- elevations ----------
function renderElevation(kind){
  const c = calc();
  const MOB = dsMob();
  const W = MOB ? 520 : 980, H = MOB ? 660 : 560;
  const GY = H-110;
  const hft = S.h/12, h2ft = (c.tier2? c.h2e/12 : 0);
  let s = '';
  // ---- tracked drawing: every linework op registers its extent; dims live in lanes outside ----
  const B = {x0:1e9, y0:1e9, x1:-1e9, y1:-1e9};
  const upd = function(x,y){ if(x<B.x0)B.x0=x; if(y<B.y0)B.y0=y; if(x>B.x1)B.x1=x; if(y>B.y1)B.y1=y; };
  const ln = function(x1,y1,x2,y2,w2,dash,op,ctx){
    s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="'+(w2||1)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+(op?' opacity="'+op+'"':'')+'/>';
    if(!ctx){ upd(x1,y1); upd(x2,y2); }
  };
  const rc = function(x,y,w2,h2,sw,dash,fill,ctx){
    s += '<rect x="'+x+'" y="'+y+'" width="'+w2+'" height="'+h2+'" fill="'+(fill||'none')+'" stroke="#0C0E11" stroke-width="'+(sw||1.5)+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
    if(!ctx){ upd(x,y); upd(x+w2,y+h2); }
  };
  const tx = function(x,y,t,size,anch,bold,col){
    s += '<text x="'+x+'" y="'+y+'" '+(anch?'text-anchor="'+anch+'" ':'')+'font-family="IBM Plex Mono" '+(bold?'font-weight="600" ':'')+'font-size="'+(size||10)+'" fill="'+(col||'#0C0E11')+'">'+t+'</text>';
  };
  const DF = MOB?14.5:12;
  const vdim = function(x,y1,y2,label){
    ln(x,y1,x,y2,1.2,null,null,true); ln(x-5,y1,x+5,y1,1,null,null,true); ln(x-5,y2,x+5,y2,1,null,null,true);
    s += '<path d="M'+x+' '+y1+' l-4 7 l8 0 z" fill="#0C0E11"/><path d="M'+x+' '+y2+' l-4 -7 l8 0 z" fill="#0C0E11"/>';
    s += '<text x="'+(x+13)+'" y="'+((y1+y2)/2)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="'+DF+'" fill="#0C0E11" transform="rotate(90 '+(x+13)+' '+((y1+y2)/2)+')">'+label+'</text>';
  };
  const hdim = function(x1,x2,y,label,sub){
    ln(x1,y,x2,y,1.2,null,null,true); ln(x1,y-5,x1,y+5,1,null,null,true); ln(x2,y-5,x2,y+5,1,null,null,true);
    s += '<path d="M'+x1+' '+y+' l7 -4 l0 8 z" fill="#0C0E11"/><path d="M'+x2+' '+y+' l-7 -4 l0 8 z" fill="#0C0E11"/>';
    tx((x1+x2)/2, y-7, label, DF, 'middle', true);
    if(sub) tx((x1+x2)/2, y+11, sub, 7.5, 'middle', false);
  };
  const ftIn = function(v){ const f2=Math.floor(v+0.001); const in2=Math.round((v-f2)*12); return f2+"'-"+in2+'"'; };
  const grade = function(xa,xb){
    ln(xa,GY,xb,GY,2,null,null,true);
    for (let gx2=xa; gx2<xb; gx2+=26){ ln(gx2,GY,gx2-9,GY+9,1,null,0.6,true); }
  };
  const footing = function(cx,wpx){
    rc(cx-wpx/2, GY+4, wpx, 26, 1.2, '5 4');
  };
  const railFront = function(xa,xb,rt){
    const topY = rt - 3.0*SV, botY = rt - 0.35*SV;
    ln(xa,topY,xb,topY,2.2); ln(xa,botY,xb,botY,1.4);
    const span = xb-xa, nP = Math.max(2, Math.ceil(span/(6*SV))+1);
    const hp = 0.16*SV;
    for (let i2=0;i2<nP;i2++){
      let px2 = xa + i2*(span/(nP-1));
      px2 = Math.min(Math.max(px2, xa+hp), xb-hp);
      rc(px2-hp, topY-4, 2*hp, rt-topY+4, 1.4);
      rc(px2-0.21*SV, topY-8, 0.42*SV, 4, 1.2);
    }
    for (let bx=xa+0.38*SV; bx<xb; bx+=0.38*SV){ ln(bx,botY,bx,topY,0.6,null,0.65); }
  };
  const deckBand = function(xa,xb,topZ){
    rc(xa, topZ, xb-xa, 0.95*SV, 2, null, '#F2EFE7');
    ln(xa, topZ+0.12*SV, xb, topZ+0.12*SV, 0.7, null, 0.7);
    ln(xa, topZ+0.52*SV, xb, topZ+0.52*SV, 0.7, null, 0.5);
  };
  const postAt = function(cx, yTopP){
    rc(cx-0.23*SV, yTopP, 0.46*SV, GY-yTopP, 1.6);
    footing(cx, 0.9*SV);
  };
  const stairProfile = function(x0s, topZ, risers, dirR, withRail){
    const rise = (topZ>=GY)?0:(GY-topZ)/risers, runp=(11/12)*SV;
    let px2=x0s, py2=topZ, path='M'+px2+' '+py2, ex2=px2;
    for (let r2=0;r2<risers;r2++){ py2 += rise; path += ' L'+ex2+' '+py2; ex2 += dirR*runp; path += ' L'+ex2+' '+py2; }
    s += '<path d="'+path+'" fill="none" stroke="#0C0E11" stroke-width="1.6"/>';
    upd(x0s, topZ); upd(ex2, GY);
    ln(x0s, topZ+rise, ex2-dirR*runp*0.6, GY, 1.2, null, 0.8);
    footing(x0s + dirR*(risers*runp)/2, 0.7*SV);
    if (withRail && S.rail){
      const g1x=x0s+0.12*SV*dirR, g1y=topZ-3.0*SV, g2x=ex2-runp*dirR*0.5, g2y=GY-3.0*SV+6;
      ln(g1x,g1y,g2x,g2y,2.2);
      ln(g1x,g1y+0.5*SV,g2x,g2y+0.5*SV,1.2);
      const nb2=Math.max(3,Math.floor(Math.abs(g2x-g1x)/(0.38*SV)));
      for (let b3=1;b3<nb2;b3++){
        const bt=b3/nb2, bx2=g1x+(g2x-g1x)*bt, by1=g1y+(g2y-g1y)*bt+0.5*SV;
        ln(bx2,by1,bx2,Math.min(by1+2.5*SV,GY),0.6,null,0.65);
      }
      rc(g1x-0.14*SV,g1y,0.28*SV,topZ-g1y,1.3);
      rc(g2x-0.14*SV,g2y,0.28*SV,GY-g2y,1.3);
    }
    return ex2;
  };
  let SV;
  // ================= FRONT =================
  if (kind==='front'){
    const w=S.w;
    const spPre=stairPlace();
    const stairProj=(S.stairs&&spPre)? (c.risers*(11/12)+1.2) : 0;
    const projL=(S.stairs&&spPre&&spPre.edge==='left')? stairProj : 0;
    const ESTEPS=[24,20,16,12,9];
    const ewBud = MOB?360:600;
    SV = ESTEPS[ESTEPS.length-1];
    for (let si=0; si<ESTEPS.length; si++){ const t2=ESTEPS[si]; if ((w+stairProj)*t2<=ewBud && (hft+3+1.2)*t2<=GY-96){ SV=t2; break; } }
    const dw=w*SV, x0=(MOB?110:170)+projL*SV;
    const deckTop=GY-hft*SV;
    deckBand(x0, x0+dw, deckTop);
    const yG=deckTop+0.95*SV;
    ln(x0+1.5*SV, yG+0.35*SV, x0+dw-1.5*SV, yG+0.35*SV, 1.3, '9 5');
    ln(x0+1.5*SV, yG+0.62*SV, x0+dw-1.5*SV, yG+0.62*SV, 1.3, '9 5');
    const per=c.perRow, run=Math.max(0.5,w-3);
    let px1st=0;
    for (let i2=0;i2<per;i2++){
      const px2=x0+(1.5+(per===1?0:i2*(run/(per-1))))*SV;
      if(i2===0)px1st=px2;
      postAt(px2, yG);
    }
    if (S.rail) railFront(x0, x0+dw, deckTop);
    const sp=stairPlace();
    if (S.stairs && sp){
      const dirR=(sp.edge==='left')?-1:1;
      const sx=(sp.edge==='front')? x0+(sp.c+w/2)*SV : (dirR>0? x0+dw : x0);
      stairProfile(sx, deckTop, c.risers, dirR, true);
    }
    let loTop=null, lx0=0, lw=0;
    if (c.tier2){
      const tg=c.tg, w2=S.w2;
      lx0=x0+(tg.cx2-w2/2+w/2)*SV; lw=w2*SV;
      loTop=GY-h2ft*SV;
      deckBand(lx0, lx0+lw, loTop);
      const yG2=loTop+0.95*SV, run2=Math.max(0.5,w2-3), per2=c.lo.perRow;
      for (let i2=0;i2<per2;i2++){ postAt(lx0+(1.5+(per2===1?0:i2*(run2/(per2-1))))*SV, yG2); }
      if (S.rail) railFront(lx0, lx0+lw, loTop);
    }
    grade(B.x0-30, B.x1+30);
    // ---- dim lanes from measured bounds ----
    const LX=B.x0-28, RX=B.x1+30, TY=B.y0-22, BY=Math.max(B.y1, GY+30)+22;
    hdim(x0, x0+dw, TY, w+"'-0\"", null);
    tx((x0+dw/2), TY+11, 'PROPOSED DECK', 7.5, 'middle');
    vdim(RX, deckTop, GY, S.h+'"');
    if (c.tier2 && loTop!==null) vdim(RX+30, loTop, GY, c.h2e+'"');
    if (S.rail) vdim(LX, deckTop-3.0*SV, deckTop, '36"');
    vdim(LX, GY, GY+30, '30"-36"');
    hdim(px1st-0.45*SV, px1st+0.45*SV, BY+14, Math.round(c.dia)+'"', null);
  } else {
  // ================= SIDE =================
    const dTot = S.tier2 ? (S.d+S.d2) : S.d;
    const spS = stairPlace(S.tier2?S.w2:S.w, S.tier2?S.d2:S.d);
    const stairFtP = S.stairs ? ((S.tier2? c.gradeRisers : c.risers)*(11/12)+1) : 0.5;
    const SSTEPS=[26,21,17,13,10,8];
    const swBud=MOB?420:700;
    SV=SSTEPS[SSTEPS.length-1];
    for (let si=0; si<SSTEPS.length; si++){ const t2=SSTEPS[si]; if ((dTot+stairFtP+1.5)*t2<=swBud && (hft+3+1.4)*t2<=GY-96){ SV=t2; break; } }
    // DATUM: the house face. Everything about the house lives at x < faceX; the deck at x >= faceX.
    const faceX = MOB?96:140;
    const deckTop = GY-hft*SV;
    if (S.ledger){
      const wallW=18, wTop=Math.max(26, deckTop-3.6*SV);
      rc(faceX-wallW, wTop, wallW, GY-wTop, 1.4, null, null, true);
      for (let sy=wTop+10; sy<GY-6; sy+=11){ ln(faceX-wallW, sy, faceX, sy-5, 0.5, null, 0.3, true); }
      ln(faceX, Math.max(20,wTop-8), faceX, GY, 2.2, null, null, true);
      rc(faceX, deckTop+2, 4, 0.83*SV, 1.6, null, '#0C0E11');
    }
    const dpx=S.d*SV;
    ln(faceX, deckTop, faceX+dpx, deckTop, 2.5);
    ln(faceX, deckTop+2.5, faceX+dpx, deckTop+2.5, 0.8, null, 0.7);
    rc(faceX, deckTop+2, dpx, 0.83*SV, 1.4);
    const yJb=deckTop+2+0.83*SV;
    const gx=faceX+(S.d-1.5)*SV;
    rc(gx-0.24*SV, yJb, 0.48*SV, 0.85*SV, 1.8);
    ln(gx-0.24*SV, yJb+0.28*SV, gx+0.24*SV, yJb+0.28*SV, 0.7, null, 0.7);
    ln(gx-0.24*SV, yJb+0.56*SV, gx+0.24*SV, yJb+0.56*SV, 0.7, null, 0.7);
    postAt(gx, yJb+0.85*SV);
    if (!S.ledger){ const gx0=faceX+1.5*SV; rc(gx0-0.24*SV,yJb,0.48*SV,0.85*SV,1.8); postAt(gx0, yJb+0.85*SV); }
    if (S.rail) railFront(faceX+(S.ledger?0.1*SV:0), faceX+dpx, deckTop);
    let endX=faceX+dpx;
    if (!S.tier2){
      if (S.stairs) endX = stairProfile(faceX+dpx, deckTop, c.risers, 1, true);
      grade(Math.min(faceX-(S.ledger?18:0), B.x0)-26, Math.max(endX,B.x1)+28);
      const LX=B.x0-28, RX=Math.max(B.x1,endX)+30, BY=Math.max(B.y1,GY+30)+22;
      hdim(faceX, gx, BY, ftIn(S.d-1.5), null);
      hdim(gx, faceX+dpx, BY, "1'-6\"", null);
      hdim(faceX, faceX+dpx, BY+26, S.d+"'-0\"", 'PROPOSED DECK');
      vdim(RX, deckTop, GY, S.h+'"');
      if (S.rail) vdim(RX+30, deckTop-3.0*SV, deckTop, '36"');
      vdim(LX, GY, GY+30, '30"-36"');
    } else {
      const d2px=S.d2*SV, loTop=GY-h2ft*SV;
      ln(faceX+dpx, loTop, faceX+dpx+d2px, loTop, 2.5);
      rc(faceX+dpx, loTop+2, d2px, 0.83*SV, 1.4);
      const yJb2=loTop+2+0.83*SV;
      const gx2=faceX+(S.d+S.d2-1.5)*SV;
      rc(gx2-0.24*SV, yJb2, 0.48*SV, 0.85*SV, 1.8);
      postAt(gx2, yJb2+0.85*SV);
      postAt(gx, yJb+0.85*SV);
      if (c.tierRisers>0){
        const rise2=((hft-h2ft)*SV)/c.tierRisers, runp2=(11/12)*SV;
        let px3=faceX+dpx, py3=deckTop, path2='M'+px3+' '+py3;
        for (let r3=0;r3<c.tierRisers;r3++){ py3+=rise2; path2+=' L'+px3+' '+py3; px3+=runp2; path2+=' L'+px3+' '+py3; }
        s += '<path d="'+path2+'" fill="none" stroke="#0C0E11" stroke-width="1.6"/>';
        upd(faceX+dpx, deckTop); upd(px3, loTop);
      }
      if (S.rail){ railFront(faceX+(S.ledger?0.1*SV:0), faceX+dpx, deckTop); railFront(faceX+dpx+(c.tierRisers? c.tierRisers*(11/12)*SV:0), faceX+dpx+d2px, loTop); }
      if (S.stairs) endX = stairProfile(faceX+dpx+d2px, loTop, Math.max(2,c.gradeRisers), 1, true);
      grade(Math.min(faceX-(S.ledger?18:0), B.x0)-26, Math.max(endX,B.x1)+28);
      const LX=B.x0-28, RX=Math.max(B.x1,endX)+30, BY=Math.max(B.y1,GY+30)+22;
      hdim(faceX, faceX+dpx, BY, S.d+"'-0\"", null);
      hdim(faceX+dpx, faceX+dpx+d2px, BY, S.d2+"'-0\"", null);
      vdim(RX, deckTop, GY, S.h+'"');
      vdim(RX+30, loTop, GY, c.h2e+'"');
      vdim(LX, GY, GY+30, '30"-36"');
    }
  }
  // ---- stamp + view title (fixed corners, outside lanes) ----
  s += '<text x="'+(W-20)+'" y="24" text-anchor="end" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#FF5A1F">PRELIMINARY / NOT FOR CONSTRUCTION</text>';
  (function(){
    const num=(kind==='front')?'3':'4';
    const ttl=(kind==='front')?'PROPOSED FRONT ELEVATION':'PROPOSED SIDE ELEVATION';
    s += '<circle cx="46" cy="'+(H-24)+'" r="11" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="46" y="'+(H-20)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="#0C0E11">'+num+'</text>';
    s += '<text x="64" y="'+(H-20)+'" font-family="IBM Plex Mono" font-weight="600" font-size="12" letter-spacing="1" fill="#0C0E11">'+ttl+'</text>';
    s += '<line x1="64" y1="'+(H-13)+'" x2="'+(64+ttl.length*8.2+8)+'" y2="'+(H-13)+'" stroke="#0C0E11" stroke-width="1.4"/>';
    s += '<text x="'+(64+ttl.length*8.2+22)+'" y="'+(H-20)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.8">PERMIT SET DRAWN AT 1/4" = 1\'-0"</text>';
  })();
  try{ window.__dsDbg = {view:kind, bounds:{x0:B.x0,y0:B.y0,x1:B.x1,y1:B.y1}}; }catch(e){}
  document.getElementById('plan-wrap').innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
}

// ---------- wiring ----------
function syncField(id, val){
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = val;
}
function refresh(){
  syncField('inW', S.w); syncField('numW', S.w);
  syncField('inD', S.d); syncField('numD', S.d);
  syncField('inH', S.h); syncField('numH', S.h);
  const h2v = h2eff();
  syncField('inW2', S.w2); syncField('numW2', S.w2);
  syncField('inD2', S.d2); syncField('numD2', S.d2);
  syncField('inH2', h2v); syncField('numH2', h2v);
  document.getElementById('tier2Ctrl').style.display = S.tier2 ? '' : 'none';
  document.getElementById('stairWCtrl').style.display = S.stairs ? '' : 'none';
  document.getElementById('stairPosCtrl').style.display = S.stairs ? '' : 'none';
  document.querySelector('#stairPosCtrl label').textContent = S.tier2 ? 'Grade stair location (lower)' : 'Stair location';
  renderTakeoff(); buildDeck(); renderView();
}
function bindDim(rangeId, numId, key, lo, hi){
  document.getElementById(rangeId).addEventListener('input', function(e){
    S[key] = +e.target.value; refresh();
  });
  const num = document.getElementById(numId);
  num.addEventListener('input', function(e){
    const v = parseFloat(e.target.value);
    if (isNaN(v) || v < lo || v > hi) return;
    S[key] = v; refresh();
  });
  num.addEventListener('change', function(e){
    let v = parseFloat(e.target.value);
    if (isNaN(v)) v = S[key];
    S[key] = Math.max(lo, Math.min(hi, Math.round(v)));
    e.target.value = S[key]; refresh();
  });
}
bindDim('inW', 'numW', 'w', 6, 32);
bindDim('inD', 'numD', 'd', 4, 20);
bindDim('inH', 'numH', 'h', 8, 120);
bindDim('inW2', 'numW2', 'w2', 4, 24);
bindDim('inD2', 'numD2', 'd2', 4, 16);
bindDim('inH2', 'numH2', 'h2', 8, 112);
document.querySelectorAll('#segJust2 button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('#segJust2 button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); S.just2=b.dataset.v; refresh();
  });
});
document.getElementById('swTier2').addEventListener('click', function(){
  this.classList.toggle('on'); S.tier2 = this.classList.contains('on');
  if (S.tier2){
    S.h2 = Math.max(8, Math.round(S.h/4)*2);
    target.z = 4; radius = Math.max(radius, 46);
  } else { target.z = 0; radius = Math.min(radius, 40); }
  applyCam(); refresh();
});
document.querySelectorAll('#segStairW button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('#segStairW button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); S.stairW=+b.dataset.v; refresh();
  });
});
document.querySelectorAll('#segStairPos button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('#segStairPos button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); S.stairPos=b.dataset.v; refresh();
  });
});
document.querySelectorAll('#segSpace button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('#segSpace button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); S.spacing=+b.dataset.v; refresh();
  });
});
[['swLedger','ledger'],['swStairs','stairs'],['swRail','rail']].forEach(function(pair){
  document.getElementById(pair[0]).addEventListener('click', function(){
    this.classList.toggle('on'); S[pair[1]] = this.classList.contains('on'); refresh();
  });
});
function renderView(){
  if (S.view==='framing' || S.view==='decking'){ S.planMode=S.view; renderPlan(); }
  else if (S.view==='elevF'){ renderElevation('front'); }
  else if (S.view==='elevS'){ renderElevation('side'); }
}
function viewHint(){
  var hint=document.getElementById('hint');
  if (S.view && S.view!=='3d'){ hint.style.display='none'; return; }
  hint.textContent='Drag to orbit / pinch or scroll to zoom';
  hint.style.display='block';
}
document.querySelectorAll('.tabs button').forEach(function(b){
  b.addEventListener('click', function(){
    if (b.dataset.v==='locked'){
      try{ updateQuoteFrame(); }catch(e){}
      var hint=document.getElementById('hint');
      hint.textContent='Sections & connection details are drawn per job in your 18x24 permit set \u2014 get a flat quote below';
      hint.style.display='block';
      window.location.hash='ds-quote';
      return;
    }
    document.querySelectorAll('.tabs button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on'); b.classList.remove('nudge');
    S.view = b.dataset.v;
    var is3d = S.view==='3d';
    document.getElementById('three-wrap').style.display = is3d ? 'block' : 'none';
    document.getElementById('plan-wrap').style.display = is3d ? 'none' : 'block';
    if (is3d){ sizeStage(); } else { renderView(); }
    viewHint();
  });
});

// ---------- quote form prefill ----------
// GHL prefills form fields from URL query params using each field's Query Key
// (ClientCue / GHL form builder: click the field -> "Query Key"). Wrong keys are harmless:
// the form still loads, the field just stays empty. Verify these two keys once.
var QUOTE_FORM_BASE='https://api.leadconnectorhq.com/widget/form/jeeVc4yGS270PcmiL5Pz';
var GHL_KEYS={ job:'multi_line_132f', ref:'referral_code_optional' };
var formTouched=false;
window.addEventListener('blur', function(){
  var f=document.getElementById('ds-quote-frame');
  if(f && document.activeElement===f) formTouched=true;
});
function dsJobId(){
  if(!window.__dsJobId) window.__dsJobId='DS-'+Date.now().toString(36).toUpperCase();
  return window.__dsJobId;
}
function updateQuoteFrame(){
  if(formTouched) return;
  var f=document.getElementById('ds-quote-frame'); if(!f) return;
  try{
    var ps=new URLSearchParams();
    ps.set(GHL_KEYS.job, takeoffText()+'\n\nDeck Studio ref '+dsJobId());
    var src=QUOTE_FORM_BASE+'?'+ps.toString();
    if(f.getAttribute('src')!==src) f.setAttribute('src',src);
  }catch(e){}
}
document.getElementById('btnQuote').addEventListener('click', function(){ updateQuoteFrame(); });

refresh(); sizeStage(); applyCam(); loop(); updateQuoteFrame();
let __dsRsz = null;
window.addEventListener('resize', function(){
  clearTimeout(__dsRsz);
  __dsRsz = setTimeout(function(){ if (S.view && S.view!=='3d') renderView(); }, 220);
});

  };
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',dsBoot)}
  else{dsBoot()}
})();
