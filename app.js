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
  // DCA6: cantilever may not exceed 1/4 of the back-span; his standard 1'-6" applies
  // whenever the deck is deep enough, and clamps down automatically for shallow decks
  const cant = ledgered ? Math.min(1.5, d/5) : Math.min(1.5, d/6);
  const joists = Math.ceil(w*12/S.spacing - 0.001)+1;
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
    perRow: perRow, postSp: postSp, dia: dia, footings: perRow*beamRows, spliced: w > 20, cant: cant };
}
function calc(){
  sanitizeS();
  const up = calcDeck(S.w, S.d, S.ledger, 0);
  if (!S.tier2){
    const area = S.w*S.d;
    const deckLF = Math.round(area*12/5.5*1.12);
    const spc = stairPlace();
    const railLF = S.rail ? Math.max(0, (S.ledger ? S.w + 2*S.d : 2*S.w + 2*S.d) - (spc ? spc.sw : 0)) : 0;
    const risers = S.stairs ? Math.max(2, Math.ceil((S.h+0.5)/7.5)) : 0;
    const swb = S.stairs && risers > 12;
    return { tier2:false, cant:up.cant, joists:up.joists, jsize:up.jsize, beamRows:up.beamRows, perRow:up.perRow,
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
  const tierRisers = drop >= 4 ? Math.max(2, Math.ceil((drop+0.5)/7.5)) : 0;
  const tierRun = tierRisers * (11/12);
  const tierOver = tierRisers > 0 && tierRun > S.d2 - 1;
  const gsp = stairPlace(S.w2, S.d2);
  const gradeRisers = S.stairs ? Math.max(2, Math.ceil((h2e+0.5)/7.5)) : 0;
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
  return { tier2:true, cant:up.cant, up:up, lo:lo, h2e:h2e, tg:tg, sharedDia:sharedDia, sharedPer:sharedPer,
    tierRisers:tierRisers, tierRun:tierRun, tierOver:tierOver,
    gsp:gsp, gradeRisers:gradeRisers, swb:gswb,
    girderMembers:girderMembers, footTotal:footTotal, area:area, deckLF:deckLF, railLF:railLF,
    guardReq:S.h>30, guardLo:h2e>30, spliced: up.spliced || lo.spliced,
    joists:up.joists, jsize:up.jsize, beamRows:up.beamRows, perRow:up.perRow,
    footings:footTotal, needMid:up.needMid, dia:up.dia, risers:gradeRisers };
}

// ---------- MODEL CORE (Revit-style: params -> one resolved model -> every view projects it) ----------
// Part vocabulary follows Anthony's 16-part diagram, in diagram order.
const PARTS = [
  {p:1,  t:'footing',  name:'Footings'},
  {p:2,  t:'post',     name:'Support Posts'},
  {p:3,  t:'ledger',   name:'Ledger'},
  {p:4,  t:'joist',    name:'Joists'},
  {p:5,  t:'beam',     name:'Beams'},
  {p:6,  t:'blocking', name:'Blocking'},
  {p:7,  t:'stringer', name:'Stair Stringers'},
  {p:8,  t:'stairhdr', name:'Stair Header'},
  {p:9,  t:'hw',       name:'Structural Hardware'},
  {p:10, t:'flashing', name:'Flashing'},
  {p:11, t:'decking',  name:'Decking'},
  {p:12, t:'tread',    name:'Stair Treads & Risers'},
  {p:13, t:'fascia',   name:'Fascia'},
  {p:14, t:'railpost', name:'Railing Posts'},
  {p:15, t:'rail',     name:'Rails'},
  {p:16, t:'baluster', name:'Balusters'}
];
const PART_BY_T = {}; PARTS.forEach(function(pp){ PART_BY_T[pp.t]=pp; });

// Component: {t, p, sh:'box'|'cyl', x,y,z (world ft, y up from grade), dx,dy,dz | r,len,
//             rotX?,rotY?, tier, detail:'free'|'paid', m:{...}}
// World frame matches the 3D scene: x along house (centered), z out from house (face at -d/2), y up.
function resolve(){
  const c = calc();
  const C = [];
  const add = function(t, sh, o){
    const pp = PART_BY_T[t];
    C.push(Object.assign({t:t, p:pp.p, sh:sh, tier:o.tier||1, detail:o.detail||'free', m:o.m||{}}, o));
  };
  const t = 1/12, boardW = 0.46;

  // one platform (tier): emits decking, rim+fascia, ledger+flashing+hangers (if inner bearing is the house),
  // joists (+jExt reach-back), blocking, beams+posts+footings+hardware per row
  function platform(tier, w, d, hft, cd, opts){
    const ox = opts.ox||0, oz = opts.oz||0;           // world offset of platform center
    const attached = opts.attached;                    // inner bearing is house ledger
    const rows = opts.rows;                            // [{z(local), footR, per, dia, noPosts}]
    const jExt = opts.jExt||0;
    // decking
    const nB = Math.floor(d/boardW);
    for (let i=0;i<nB;i++)
      add('decking','box',{x:ox, y:hft, z:oz - d/2 + boardW/2 + i*boardW, dx:w, dy:t, dz:boardW-0.06, tier:tier, m:{alt:i%2}});
    // rim joist (outer face) stays structural; fascia covers it
    add('joist','box',{x:ox, y:hft-0.36, z:oz + d/2 - 0.07, dx:w, dy:0.62, dz:0.13, tier:tier, m:{rim:true}});
    if (!attached) add('joist','box',{x:ox, y:hft-0.36, z:oz - d/2 + 0.07, dx:w, dy:0.62, dz:0.13, tier:tier, m:{rim:true}});
    add('fascia','box',{x:ox, y:hft-0.34, z:oz + d/2 + 0.02, dx:w, dy:0.68, dz:0.06, tier:tier});
    add('fascia','box',{x:ox - w/2 - 0.02, y:hft-0.34, z:oz, dx:0.06, dy:0.68, dz:d, tier:tier});
    add('fascia','box',{x:ox + w/2 + 0.02, y:hft-0.34, z:oz, dx:0.06, dy:0.68, dz:d, tier:tier});
    if (!attached) add('fascia','box',{x:ox, y:hft-0.34, z:oz - d/2 - 0.02, dx:w, dy:0.68, dz:0.06, tier:tier});
    // ledger + flashing + hangers + hold-downs on the house face
    if (attached){
      add('ledger','box',{x:ox, y:hft-0.36, z:oz - d/2 + 0.065, dx:w, dy:0.62, dz:0.13, tier:tier, m:{size:cd.jsize}});
      add('flashing','box',{x:ox, y:hft+0.08, z:oz - d/2 + 0.02, dx:w+0.3, dy:0.3, dz:0.04, tier:tier});
    }
    // joists
    const xs = [];
    for (let j=0;j<cd.joists;j++){
      const x = -w/2 + j*(S.spacing/12);
      if (x > w/2) break;
      xs.push(Math.min(x, w/2-0.07));
    }
    // widths that aren't a spacing multiple still need a joist at the far edge
    if (xs.length && (w/2-0.07) - xs[xs.length-1] > 0.2) xs.push(w/2-0.07);
    xs.forEach(function(x){
      add('joist','box',{x:ox+x, y:hft-0.36, z:oz - jExt/2, dx:0.13, dy:0.62, dz:d + jExt, tier:tier, m:{size:cd.jsize}});
      if (attached) add('hw','box',{x:ox+x, y:hft-0.42, z:oz - d/2 + 0.16, dx:0.2, dy:0.34, dz:0.06, tier:tier, m:{kind:'hanger'}});
    });
    if (attached){
      add('hw','box',{x:ox - (w/2-1), y:hft-0.36, z:oz - d/2 + 0.18, dx:0.38, dy:0.38, dz:0.1, tier:tier, m:{kind:'holddown'}});
      add('hw','box',{x:ox + (w/2-1), y:hft-0.36, z:oz - d/2 + 0.18, dx:0.38, dy:0.38, dz:0.1, tier:tier, m:{kind:'holddown'}});
    }
    // blocking: one staggered row per span segment when the segment runs past 8 ft
    const segs = [];
    const cP = cd.cant;
    const innerZ = -d/2 + (attached ? 0 : cP), outerBeamZ = d/2 - cP;
    if (cd.needMid){ const midZ = attached ? -cP/2 : 0; segs.push([innerZ, midZ]); segs.push([midZ, outerBeamZ]); }
    else segs.push([innerZ, outerBeamZ]);
    segs.forEach(function(sg){
      if (sg[1]-sg[0] < 5) return;
      const zb = (sg[0]+sg[1])/2;
      for (let j=0;j<xs.length-1;j++){
        const gap = xs[j+1]-xs[j]; if (gap < 0.3) continue;
        add('blocking','box',{x:ox+(xs[j]+xs[j+1])/2, y:hft-0.36, z:oz + zb + (j%2? 0.09 : -0.09),
          dx:gap-0.13, dy:0.62, dz:0.13, tier:tier});
      }
    });
    // beams + posts + footings + post bases
    rows.forEach(function(rs){
      const beamY = Math.max(0.45, hft-0.85);
      add('beam','box',{x:ox, y:beamY, z:oz+rs.z, dx:Math.max(1, w-1.2), dy:0.8, dz:0.42, tier:tier, m:Object.assign({plies:3, size:'2x10'}, rs.m||{})});
      if (rs.noPosts) return;
      const per = rs.per;
      for (let p2=0;p2<per;p2++){
        const px = -w/2 + 1.5 + p2*(Math.max(0.5,w-3)/(per-1));
        add('post','box',{x:ox+px, y:(hft-1.2)/2, z:oz+rs.z, dx:0.5, dy:Math.max(0.4,hft-1.2), dz:0.5, tier:tier});
        add('hw','box',{x:ox+px, y:0.29, z:oz+rs.z, dx:0.55, dy:0.08, dz:0.55, tier:tier, m:{kind:'postbase'}});
        add('footing','cyl',{x:ox+px, y:0.12, z:oz+rs.z, r:rs.dia/24, len:0.25, tier:tier, m:{dia:rs.dia}});
      }
    });
    return xs;
  }

  // railing segments for one platform: [{axis:'x'|'z', at(local), a, b}] minus one stair cut
  function railSegs(w, d, cut, includeBack){
    const out = [];
    const addEdge = function(axis, at, L, cutHere){
      const parts = cutHere
        ? [{a:-L/2, b:cutHere.c - cutHere.sw/2}, {a:cutHere.c + cutHere.sw/2, b:L/2}]
        : [{a:-L/2, b:L/2}];
      parts.forEach(function(pp){ if (pp.b - pp.a > 0.15) out.push({axis:axis, at:at, a:pp.a, b:pp.b}); });
    };
    addEdge('x', d/2, w, (cut && cut.edge==='front') ? cut : null);
    addEdge('z', -w/2, d, (cut && cut.edge==='left') ? cut : null);
    addEdge('z', w/2, d, (cut && cut.edge==='right') ? cut : null);
    if (includeBack) addEdge('x', -d/2, w, null);
    return out;
  }
  function railing(tier, w, d, hft0, cut, includeBack, ox, oz){
    const hft = hft0 + 1/24;   // guard heights measure from the walking surface (decking top)
    const railTop = 3.0, botY = 0.35;
    railSegs(w, d, cut, includeBack).forEach(function(sg0){
      // post sleeves mount on the deck surface: pull the run inboard so the outer post face
      // lands flush with the fascia instead of overhanging it
      const sg = {axis:sg0.axis, at:sg0.at - Math.sign(sg0.at)*0.12, a:sg0.a, b:sg0.b};
      const len = sg.b - sg.a; if (len < 0.15) return;
      const mid = (sg.a + sg.b)/2;
      const P = function(off){ return sg.axis==='x' ? {x:ox+off, z:oz+sg.at} : {x:ox+sg.at, z:oz+off}; };
      const mp = P(mid);
      if (sg.axis==='x'){
        add('rail','box',{x:mp.x, y:hft+railTop-0.09, z:mp.z, dx:len, dy:0.17, dz:0.26, tier:tier, m:{pos:'top'}});
        add('rail','box',{x:mp.x, y:hft+botY, z:mp.z, dx:len, dy:0.11, dz:0.19, tier:tier, m:{pos:'bottom'}});
      } else {
        add('rail','box',{x:mp.x, y:hft+railTop-0.09, z:mp.z, dx:0.26, dy:0.17, dz:len, tier:tier, m:{pos:'top'}});
        add('rail','box',{x:mp.x, y:hft+botY, z:mp.z, dx:0.19, dy:0.11, dz:len, tier:tier, m:{pos:'bottom'}});
      }
      const nP = Math.max(2, Math.ceil(len/6)+1);
      for (let p2=0;p2<nP;p2++){
        const off = Math.max(sg.a+0.28, Math.min(sg.b-0.28, sg.a + p2*(len/(nP-1))));
        const q = P(off);
        add('railpost','box',{x:q.x, y:hft+(railTop+0.22)/2, z:q.z, dx:0.32, dy:railTop+0.22, dz:0.32, tier:tier});
        add('railpost','box',{x:q.x, y:hft+railTop+0.28, z:q.z, dx:0.46, dy:0.11, dz:0.46, tier:tier, m:{cap:true}});
      }
      const nBal = Math.floor(len/0.38);
      for (let b2=1;b2<nBal;b2++){
        const q = P(sg.a + b2*(len/nBal));
        add('baluster','box',{x:q.x, y:hft+botY+0.06+(railTop-0.56)/2, z:q.z, dx:0.09, dy:railTop-0.56, dz:0.09, tier:tier});
      }
    });
  }

  // one straight flight descending +z in LOCAL stair frame; caller places via {sx,sz,rotY}
  function flight(tier, T, n, rise, sw, yTop, cx, z0, dir, railOn){
    const runL = 11/12;
    const runT = n*runL, drop = n*rise;
    // stringers @ <=18" apart across the width
    const nStr = Math.max(2, Math.ceil(sw*12/18)+1);
    const slope = Math.sqrt(runT*runT + drop*drop);
    const ang = Math.atan2(drop, runT) * dir;
    for (let s2=0;s2<nStr;s2++){
      const sxo = cx - sw/2 + 0.08 + s2*((sw-0.16)/(nStr-1));
      // notched stringer built honestly: a low sloped carriage that can never break the tread
      // plane, plus sawtooth step blocks carrying each tread down to the carriage
      T.push({t:'stringer', sh:'box', lx:sxo, ly:yTop - drop/2 - (rise + 0.4), lz:z0 + dir*(runT/2 + 0.15),
        dx:0.13, dy:0.5, dz:Math.max(1, slope - 0.3), rotX:ang, tier:tier, m:{dir:dir, rise:rise, n:n}});
      for (let k=-1; k<n-1; k++){
        const tTop = yTop - rise*(k+1);
        T.push({t:'stringer', sh:'box', lx:sxo, ly:tTop - 0.12 - rise*0.45, lz:z0 + dir*(k+0.5)*runL,
          dx:0.13, dy:rise*0.9, dz:runL*0.78, tier:tier, m:{step:k}});
      }
    }

    // closed flight: risers span rise-to-rise (no see-through), treads sit on top with a nosing
    for (let st=0; st<n; st++){
      T.push({t:'tread', sh:'box', lx:cx, ly:yTop - rise*st - rise/2, lz:z0 + dir*(st*runL) + dir*0.04,
        dx:sw, dy:rise+0.02, dz:0.1, tier:tier, m:{kind:'riser'}});
      if (st < n-1){
        T.push({t:'tread', sh:'box', lx:cx, ly:yTop - rise*(st+1) - 0.06, lz:z0 + dir*(runL/2 + st*runL) - dir*0.03,
          dx:sw, dy:0.12, dz:runL+0.1, tier:tier, m:{kind:'tread'}});
      }
    }
    if (railOn){
      [cx - sw/2, cx + sw/2].forEach(function(hx){
        [3.0, 0.35].forEach(function(hy){
          T.push({t:'rail', sh:'box', lx:hx, ly:yTop - drop/2 + hy, lz:z0 + dir*runT/2,
            dx:0.12, dy:0.12, dz:slope, rotX:ang, tier:tier, m:{pos:'stair'}});
        });
        const nB = Math.max(2, Math.ceil(runT/0.32));
        for (let k=1;k<nB;k++){
          const bz = k*(runT/nB);
          T.push({t:'baluster', sh:'box', lx:hx, ly:yTop - drop*(bz/runT) + 0.42 + 1.19, lz:z0 + dir*bz,
            dx:0.08, dy:2.38, dz:0.08, tier:tier, m:{}});
        }
      });
    }
  }
  // full stair assembly off one platform edge in local frame, then transformed to world
  function stairs(tier, wF, dF, hIn, sp, railOn, ox, oz){
    // datum = walking surface (decking top), so every rise incl. the top step is uniform
    const wsIn = hIn + 0.5;
    const risers = Math.max(2, Math.ceil(wsIn/7.5));
    const hft = wsIn/12, rise = hft/risers, runL = 11/12, sw = sp.sw;
    const ron = railOn;   // caller passes the code-resolved handrail/guard requirement
    const swb = risers > 12;
    const T = [];   // local components with lx/ly/lz
    // stair header: doubled member across the opening at the deck edge
    T.push({t:'stairhdr', sh:'box', lx:0, ly:hft-0.36, lz:-0.10, dx:sw+0.5, dy:0.62, dz:0.13, tier:tier, m:{plies:2}});
    T.push({t:'stairhdr', sh:'box', lx:0, ly:hft-0.36, lz:-0.24, dx:sw+0.5, dy:0.62, dz:0.13, tier:tier, m:{plies:2}});
    if (!swb){
      flight(tier, T, risers, rise, sw, hft, 0, 0, 1, ron);
      T.push({t:'stringer', sh:'box', lx:0, ly:0.3, lz:risers*runL - 0.35, dx:sw, dy:0.14, dz:0.4, tier:tier, m:{kicker:true}});
      [-(sw/2-0.45), sw/2-0.45].forEach(function(fx){
        const sd = (risers > 10 || sw >= 5) ? 10 : 8;
        T.push({t:'footing', sh:'cyl', lx:fx, ly:0.11, lz:risers*runL - 0.35, r:sd/24, len:0.22, tier:tier, m:{dia:sd, kind:'sono'}});
      });
      if (ron) [-sw/2, sw/2].forEach(function(hx){
        T.push({t:'railpost', sh:'box', lx:hx, ly:1.47, lz:risers*runL - 0.1, dx:0.2, dy:2.95, dz:0.2, tier:tier, m:{}});
      });
    } else {
      const n1 = Math.ceil(risers/2), n2 = risers - n1;
      const len1 = n1*runL, Ld = Math.max(3, sw);
      const yLand = hft - n1*rise;
      const ex = sp.ext || 1;
      flight(tier, T, n1, rise, sw, hft, 0, 0, 1, ron);
      // landing platform on 4 posts with sonotube pads
      T.push({t:'decking', sh:'box', lx:ex*sw/2, ly:yLand - 1/12, lz:len1 + Ld/2, dx:2*sw, dy:2/12, dz:Ld, tier:tier, m:{landing:true}});
      T.push({t:'stairhdr', sh:'box', lx:ex*sw/2, ly:yLand - 0.32, lz:len1 + 0.1, dx:2*sw, dy:0.55, dz:0.16, tier:tier, m:{plies:1, landing:true}});
      [ex*sw/2 - sw + 0.25, ex*sw/2 + sw - 0.25].forEach(function(px){
        [len1 + 0.25, len1 + Ld - 0.25].forEach(function(pz){
          T.push({t:'post', sh:'box', lx:px, ly:yLand/2, lz:pz, dx:0.4, dy:Math.max(0.4, yLand - 0.05), dz:0.4, tier:tier, m:{landing:true}});
          T.push({t:'hw', sh:'box', lx:px, ly:0.27, lz:pz, dx:0.46, dy:0.07, dz:0.46, tier:tier, m:{kind:'postbase'}});
          T.push({t:'footing', sh:'cyl', lx:px, ly:0.11, lz:pz, r:0.5, len:0.22, tier:tier, m:{dia:12, kind:'sono'}});
        });
      });
      if (ron && yLand > 2.5){
        // landing guards: far edge + both sides (rails + balusters + corner posts)
        const guard = function(len, cxg, czg, alongX){
          if (alongX){
            T.push({t:'rail', sh:'box', lx:cxg, ly:yLand+3.07, lz:czg, dx:len, dy:0.15, dz:0.22, tier:tier, m:{pos:'top'}});
            T.push({t:'rail', sh:'box', lx:cxg, ly:yLand+0.4, lz:czg, dx:len, dy:0.10, dz:0.16, tier:tier, m:{pos:'bottom'}});
            const nB = Math.max(2, Math.ceil(len/0.32));
            for (let k=1;k<nB;k++) T.push({t:'baluster', sh:'box', lx:cxg - len/2 + k*(len/nB), ly:yLand + 0.45 + 1.15, lz:czg, dx:0.08, dy:2.3, dz:0.08, tier:tier, m:{}});
          } else {
            T.push({t:'rail', sh:'box', lx:cxg, ly:yLand+3.07, lz:czg, dx:0.22, dy:0.15, dz:len, tier:tier, m:{pos:'top'}});
            T.push({t:'rail', sh:'box', lx:cxg, ly:yLand+0.4, lz:czg, dx:0.16, dy:0.10, dz:len, tier:tier, m:{pos:'bottom'}});
            const nB = Math.max(2, Math.ceil(len/0.32));
            for (let k=1;k<nB;k++) T.push({t:'baluster', sh:'box', lx:cxg, ly:yLand + 0.45 + 1.15, lz:czg - len/2 + k*(len/nB), dx:0.08, dy:2.3, dz:0.08, tier:tier, m:{}});
          }
        };
        guard(2*sw, ex*sw/2, len1 + Ld - 0.12, true);
        guard(Ld, ex*(sw/2 + sw) - ex*0.12, len1 + Ld/2, false);
        guard(Ld, -ex*sw/2 + ex*0.12, len1 + Ld/2, false);
        [[ex*sw/2 - sw + 0.16, len1 + Ld - 0.16],[ex*sw/2 + sw - 0.16, len1 + Ld - 0.16],[ex*(sw/2 + sw) - ex*0.16, len1 + 0.16],[-ex*sw/2 + ex*0.16, len1 + 0.16]].forEach(function(pp){
          T.push({t:'railpost', sh:'box', lx:pp[0], ly:yLand + 1.55, lz:pp[1], dx:0.3, dy:3.1, dz:0.3, tier:tier, m:{}});
          T.push({t:'railpost', sh:'box', lx:pp[0], ly:yLand + 3.15, lz:pp[1], dx:0.42, dy:0.1, dz:0.42, tier:tier, m:{cap:true}});
        });
      }
      // return flight beside the first, descending back toward the deck face
      flight(tier, T, n2, rise, sw, yLand, ex*sw, len1, -1, ron);
      T.push({t:'stringer', sh:'box', lx:ex*sw, ly:0.3, lz:len1 - n2*runL + 0.35, dx:sw, dy:0.14, dz:0.4, tier:tier, m:{kicker:true}});
      [ex*sw - (sw/2-0.45), ex*sw + (sw/2-0.45)].forEach(function(fx){
        const sd2 = (n2 > 10 || sw >= 5) ? 10 : 8;
        T.push({t:'footing', sh:'cyl', lx:fx, ly:0.11, lz:len1 - n2*runL + 0.4, r:sd2/24, len:0.22, tier:tier, m:{dia:sd2, kind:'sono'}});
      });
      if (ron) [ex*sw - sw/2, ex*sw + sw/2].forEach(function(hx){
        T.push({t:'railpost', sh:'box', lx:hx, ly:1.47, lz:len1 - n2*runL + 0.1, dx:0.2, dy:2.95, dz:0.2, tier:tier, m:{}});
      });
    }
    // transform local -> world: edge determines origin + rotY
    let px, pz, rotY;
    if (sp.edge === 'front'){ px = ox + sp.c; pz = oz + dF/2; rotY = 0; }
    else if (sp.edge === 'left'){ px = ox - wF/2; pz = oz + sp.c; rotY = -Math.PI/2; }
    else { px = ox + wF/2; pz = oz + sp.c; rotY = Math.PI/2; }
    const cosr = Math.cos(rotY), sinr = Math.sin(rotY);
    T.forEach(function(q){
      const wx = px + q.lx*cosr + q.lz*sinr;
      const wz = pz - q.lx*sinr + q.lz*cosr;
      add(q.t, q.sh, {x:wx, y:q.ly, z:wz, dx:q.dx, dy:q.dy, dz:q.dz, r:q.r, len:q.len,
        rotX:q.rotX, rotY:rotY, tier:q.tier, m:q.m, stair:true});
    });
  }

  // ---- assemble ----
  const hft = S.h/12;
  if (!c.tier2){
    const cU = c.cant;
    const rows = S.ledger ? [{z:S.d/2-cU}] : [{z:S.d/2-cU},{z:-S.d/2+cU}];
    if (c.needMid) rows.push({z: S.ledger ? -cU/2 : 0});
    rows.forEach(function(r){ r.footR=c.dia/24; r.per=c.perRow; r.dia=c.dia; });
    platform(1, S.w, S.d, hft, c, {ox:0, oz:0, attached:S.ledger, rows:rows, jExt:0});
    const sp = stairPlace();
    if (S.rail) railing(1, S.w, S.d, hft, sp, !S.ledger, 0, 0);
    if (S.stairs && sp) stairs(1, S.w, S.d, S.h, sp, (S.rail && S.h > 30) || c.risers >= 4, 0, 0);
  } else {
    const hft2 = c.h2e/12, tg = c.tg;
    const cUp = c.up.cant;
    const rowsU = S.ledger ? [{z:S.d/2-cUp, shared:true}] : [{z:S.d/2-cUp, shared:true},{z:-S.d/2+cUp}];
    if (c.up.needMid) rowsU.push({z: S.ledger ? -cUp/2 : 0});
    rowsU.forEach(function(r){
      r.per = r.shared ? c.sharedPer : c.up.perRow;
      r.dia = r.shared ? c.sharedDia : c.up.dia;
      r.footR = r.dia/24;
    });
    platform(1, S.w, S.d, hft, c.up, {ox:0, oz:0, attached:S.ledger, rows:rowsU, jExt:0});
    const cutU = c.tierRisers > 0 ? {edge:'front', c:tg.tierC, sw:tg.tierSw} : null;
    if (S.rail) railing(1, S.w, S.d, hft, cutU, !S.ledger, 0, 0);
    if (c.tierRisers > 0){
      const spT = {edge:'front', c:tg.tierC, sw:tg.tierSw, ext:1};
      // tier stair descends from upper edge onto the lower surface (no footings/sono at a deck landing)
      const before = C.length;
      stairs(1, S.w, S.d, S.h - c.h2e, spT, S.rail && c.tierRisers >= 3, 0, 0);
      // lift the tier flight so its base lands on the lower deck surface, drop its ground footings
      for (let i=C.length-1; i>=before; i--){
        const q = C[i];
        if (q.t==='footing'){ C.splice(i,1); continue; }
        q.y += hft2;
      }
    }
    // lower tier: joists reach back 1 ft to a girder bolted on the shared posts
    const rowsL = [{z:S.d2/2-c.lo.cant, per:c.lo.perRow, dia:c.lo.dia, footR:c.lo.dia/24},
                   {z:-S.d2/2-1.0, noPosts:true, m:{shared:true}}];
    if (c.lo.needMid) rowsL.push({z:-1.5, per:c.lo.perRow, dia:c.lo.dia, footR:c.lo.dia/24});
    platform(2, S.w2, S.d2, hft2, c.lo, {ox:tg.cx2, oz:S.d/2 + S.d2/2, attached:false, rows:rowsL, jExt:1});
    if (S.rail) railing(2, S.w2, S.d2, hft2, c.gsp, false, tg.cx2, S.d/2 + S.d2/2);
    if (S.stairs && c.gsp) stairs(2, S.w2, S.d2, c.h2e, c.gsp, (S.rail && c.h2e > 30) || c.gradeRisers >= 4, tg.cx2, S.d/2 + S.d2/2);
  }

  // model-derived counts (single source shared by takeoff + legend; drawings project the same list)
  const n = function(t, f){ return C.filter(function(q){ return q.t===t && (!f || f(q)); }).length; };
  const counts = {
    footingsMain: n('footing', function(q){ return q.m.kind!=='sono'; }),
    footingsSono: n('footing', function(q){ return q.m.kind==='sono'; }),
    posts: n('post', function(q){ return !q.m.landing; }),
    landingPosts: n('post', function(q){ return q.m.landing; }),
    joists: n('joist', function(q){ return !q.m.rim && q.tier===1; }),
    joistsLo: n('joist', function(q){ return !q.m.rim && q.tier===2; }),
    blocking: n('blocking'),
    beams: n('beam'),
    stringers: n('stringer', function(q){ return q.m.step===undefined && !q.m.kicker; }),
    hangers: n('hw', function(q){ return q.m.kind==='hanger'; }),
    holddowns: n('hw', function(q){ return q.m.kind==='holddown'; }),
    postbases: n('hw', function(q){ return q.m.kind==='postbase'; }),
    balusters: n('baluster'),
    railposts: n('railpost', function(q){ return !q.m.cap; }),
    fasciaLF: Math.round(C.filter(function(q){ return q.t==='fascia'; }).reduce(function(a,q){ return a + Math.max(q.dx,q.dz); },0)),
    flashingLF: Math.round(C.filter(function(q){ return q.t==='flashing'; }).reduce(function(a,q){ return a + q.dx; },0)),
    treads: n('tread', function(q){ return q.m.kind==='tread'; }),
    risersN: n('tread', function(q){ return q.m.kind==='riser'; }),
    rims: n('joist', function(q){ return q.m.rim; }),
    stringersT1: n('stringer', function(q){ return q.m.step===undefined && !q.m.kicker && q.tier===1; }),
    stringersT2: n('stringer', function(q){ return q.m.step===undefined && !q.m.kicker && q.tier===2; })
  };
  // footings grouped by diameter for the takeoff line
  const diaMap = {};
  C.forEach(function(q){ if (q.t==='footing' && q.m.kind!=='sono'){ diaMap[q.m.dia] = (diaMap[q.m.dia]||0)+1; } });
  counts.footStr = Object.keys(diaMap).sort(function(a,b){ return b-a; })
    .map(function(k){ return diaMap[k]+' @ '+k+'"'; }).join(' + ');
  return {C:C, c:c, counts:counts};
}
let MODEL = null;
function model(){ if (!MODEL) MODEL = resolve(); return MODEL; }
function modelDirty(){ MODEL = null; }
// model queries used by the 2D views (projection helpers)
const MQ = {
  joistXs: function(tier){ return model().C.filter(function(q){ return q.t==='joist' && !q.m.rim && !q.stair && q.tier===tier; }).map(function(q){ return q.x; }); },
  beamZs:  function(tier){ return model().C.filter(function(q){ return q.t==='beam' && q.tier===tier && !q.m.shared; }).map(function(q){ return q.z; }); },
  postsAt: function(tier, z){ return model().C.filter(function(q){ return q.t==='post' && !q.m.landing && q.tier===tier && Math.abs(q.z-z)<0.3; }).map(function(q){ return q.x; }); },
  blockZs: function(tier){ const zs={}; model().C.forEach(function(q){ if (q.t==='blocking' && q.tier===tier) zs[Math.round(q.z*2)/2]=1; }); return Object.keys(zs).map(Number); },
  footDia: function(tier){ const f=model().C.find(function(q){ return q.t==='footing' && q.m.kind!=='sono' && q.tier===tier; }); return f ? f.m.dia : 16; }
};

// ---------- takeoff panel (counts derived from the resolved model) ----------
function renderTakeoff(){
  const md = model(), c = md.c, K = md.counts;
  let rows, note;
  const hwStr = K.hangers ? K.hangers+' hangers / '+K.postbases+' post bases'+(K.holddowns?' / '+K.holddowns+' hold-downs':'') : K.postbases+' post bases';
  if (!c.tier2){
    rows = [
      ['Deck area', c.area+' sq ft'],
      ['Joists', K.joists+' @ '+c.jsize+' / '+S.spacing+'" OC'+(c.needMid?' / 2 spans':'')],
      ['Girder'+(c.beamRows>1?'s':''), c.beamRows+' x (3)2x10 typ'],
      ['Rim/band', K.rims+' x '+c.jsize+' PT'],
      ['Blocking', K.blocking ? K.blocking+' pcs @ mid-span' : 'not req’d at this span'],
      ['Posts 6x6 PT', K.posts + (K.landingPosts ? ' + '+K.landingPosts+' landing' : '')],
      ['Footings', K.footingsMain+' @ '+c.dia+'" dia'],
      ['Footing depth', '36" below grade'],
      ['Decking', '~'+c.deckLF+' LF (5-1/2" bd)'],
      ['Fascia', '~'+K.fasciaLF+' LF'],
    ];
    if (S.ledger) rows.splice(7, 0, ['Ledger', c.jsize+' PT / lag schedule in permit set'], ['Flashing', '~'+K.flashingLF+' LF at ledger']);
    rows.push(['Hardware', hwStr]);
    if (S.rail) rows.push(['Railing', '~'+c.railLF+' LF']);
    if (S.stairs){ const sp2 = stairPlace(); rows.push(['Stairs', (sp2 ? sp2.sw : S.stairW)+"' wide / "+c.risers+' risers / '+K.stringersT1+' stringers'+(c.swb?' / switchback':'')]); }
    if (S.stairs && c.risers >= 4) rows.push(['Handrail', 'required (4+ risers) — included']);
    if (S.stairs) rows.push(['Stair footings', K.footingsSono+' @ 8" dia sonotube']);
    if (S.stairs) rows.push(['Stair landing', '36" min pad at grade']);
    rows.push(['Guards', c.guardReq ? 'REQUIRED (>30") — included' : 'not required']);
    if (S.h >= 72) rows.push(['Post bracing', 'knee braces req’d']);
    note = (c.swb ? 'Over 12 risers: mid landing added, stair shown as a standard switchback. ' : '')
      + (c.needMid ? 'Second girder row added: joist span is past the 2x10 table. ' : '')
      + (c.spliced ? 'Girder spliced over posts for stock length. ' : '')
      + (S.h >= 72 ? 'Posts over 6 ft get diagonal knee bracing — final bracing in the drawings. ' : '')
      + (S.ledger ? 'Attached decks get (2) lateral-load hold-downs near the deck edges per the IRC deck provisions — located in your permit set. ' : '');
  } else {
    rows = [
      ['Deck area', c.area+' sq ft / 2 tiers'],
      ['Upper joists', K.joists+' @ '+c.up.jsize+' / '+S.spacing+'" OC'+(c.up.needMid?' / 2 spans':'')],
      ['Lower joists', K.joistsLo+' @ '+c.lo.jsize+' / '+S.spacing+'" OC'+(c.lo.needMid?' / 2 spans':'')],
      ['Girders', K.beams+' x (3)2x10 typ'],
      ['Rim/band', K.rims+' x 2x10 PT'],
      ['Blocking', K.blocking ? K.blocking+' pcs @ mid-span' : 'not req’d at this span'],
      ['Posts 6x6 PT', K.posts + (K.landingPosts ? ' + '+K.landingPosts+' landing' : '')],
      ['Footings', K.footStr],
      ['Footing depth', '36" below grade'],
      ['Decking', '~'+c.deckLF+' LF (5-1/2" bd)'],
      ['Fascia', '~'+K.fasciaLF+' LF'],
    ];
    if (S.ledger) rows.splice(8, 0, ['Ledger', c.up.jsize+' PT / lag schedule in permit set'], ['Flashing', '~'+K.flashingLF+' LF at ledger']);
    rows.push(['Hardware', hwStr]);
    if (S.rail) rows.push(['Railing', '~'+c.railLF+' LF']);
    if (c.tierRisers > 0) rows.push(['Tier stair', c.tg.tierSw+"' wide / "+c.tierRisers+' risers / '+K.stringersT1+' stringers']);
    if (S.stairs && c.gsp) rows.push(['Grade stair', c.gsp.sw+"' wide / "+c.gradeRisers+' risers / '+K.stringersT2+' stringers'+(c.swb?' / switchback':'')]);
    if (S.stairs && c.gradeRisers >= 4) rows.push(['Handrail', 'required (4+ risers) — included']);
    if (S.stairs) rows.push(['Stair footings', K.footingsSono+' @ 8" dia sonotube']);
    if (S.stairs) rows.push(['Stair landing', '36" min pad at grade']);
    rows.push(['Guards', c.guardReq ? 'REQUIRED (>30") — included' : (c.guardLo ? 'REQUIRED on lower (>30") — included' : 'not required')]);
    if (S.h >= 72) rows.push(['Post bracing', 'knee braces req’d']);
    note = 'Lower tier hangs on the upper girder posts: shared row runs '+c.sharedPer+' posts on '+c.sharedDia+'" footings. '
      + (S.h >= 72 ? 'Posts over 6 ft get diagonal knee bracing — final bracing in the drawings. ' : '')
      + (S.ledger ? 'Attached decks get (2) lateral-load hold-downs near the deck edges per the IRC deck provisions — located in your permit set. ' : '')
      + (c.tierOver ? 'Tier stair run passes the lower edge at this depth: final stair layout is set in the drawings. ' : '')
      + (c.swb ? 'Grade stair over 12 risers: mid landing added, shown as a standard switchback. ' : '')
      + ((c.up.needMid || c.lo.needMid) ? 'Mid girder row added where the joist span runs past the 2x10 table. ' : '')
      + (c.spliced ? 'Girder spliced over posts for stock length. ' : '');
  }
  document.getElementById('takeoff').innerHTML = rows.map(function(r,i){
    return '<div class="row"><span>'+r[0]+'</span><b class="'+(i<2?'hl':'')+'">'+r[1]+'</b></div>';
  }).join('') + '<p class="note">'
    + note
    + 'Hardware counts are placement counts. Framing #2 SYP pressure-treated. Decking includes 12% waste (more for diagonal or picture-frame layouts). Footings 36 in below grade (at or below NJ frost depth), sized for 1,500 psf soil. Planning numbers for visualization and pricing — connector models, fastener schedules and final sizes are specified in your 18x24 permit set.</p>';
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
    + 'Joists '+c.joists+' @ '+c.jsize+' '+S.spacing+'in OC, galv. joist hangers'+(c.needMid?' (2 spans, mid girder added)':'')+' / Girders '+c.beamRows+' x (3)2x10 typ'+(c.spliced?' (spliced over posts)':'')+'\n'
    + 'Footings '+model().counts.footingsMain+' @ '+c.dia+'in dia, 36in below grade, blocking + hanger/hold-down placement per model'+(S.ledger?' / Ledger '+c.jsize+' PT, lag schedule in permit set':'')+'\n'
    + 'Decking ~'+c.deckLF+' LF incl 12% waste'+(S.rail?' / Railing ~'+c.railLF+' LF':'')+(S.stairs?' / Stairs '+((stairPlace()||{}).sw||S.stairW)+'ft wide, '+c.risers+' risers'+(c.swb?', switchback w/ mid landing':''):'')+'\n'
    + 'Quote: https://santinodrafting.com/#quote')
    : ('SANTINO DECK STUDIO takeoff (two tier)\n'
    + 'Upper '+S.w+' ft x '+S.d+' ft at '+S.h+' in, '+(S.ledger?'attached (ledger)':'freestanding')+' / Lower '+S.w2+' ft x '+S.d2+' ft at '+c.h2e+' in, on shared posts\n'
    + 'Joists upper '+c.up.joists+' @ '+c.up.jsize+', lower '+c.lo.joists+' @ '+c.lo.jsize+', '+S.spacing+'in OC, galv. joist hangers / Girders '+c.girderMembers+' x (3)2x10 typ\n'
    + 'Footings '+model().counts.footStr.replace(/"/g,'in')+', 36in below grade, shared row upsized'+(S.ledger?' / Ledger '+c.up.jsize+' PT, lag schedule in permit set':'')+'\n'
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
// ---------- 3D: meshes are a straight projection of the model ----------
const MAT = {
  decking0: new THREE.MeshLambertMaterial({color:0xA98D68}),
  decking1: new THREE.MeshLambertMaterial({color:0xA18360}),
  frame:    new THREE.MeshLambertMaterial({color:0x74604B}),
  post:     new THREE.MeshLambertMaterial({color:0x594939}),
  vinyl:    new THREE.MeshLambertMaterial({color:0xF8F7F2}),
  accent:   new THREE.MeshLambertMaterial({color:0xFF5A1F}),
  fascia:   new THREE.MeshLambertMaterial({color:0x6E573F}),
  flash:    new THREE.MeshLambertMaterial({color:0xC9CDD1}),
  hw:       new THREE.MeshLambertMaterial({color:0x9AA0A6}),
  hi:       new THREE.MeshLambertMaterial({color:0xFF5A1F, emissive:0xFF5A1F, emissiveIntensity:0.55})
};
function matFor(q){
  switch(q.t){
    case 'decking': return q.m.alt ? MAT.decking1 : MAT.decking0;
    case 'tread':   return q.m.kind==='riser' ? MAT.frame : MAT.decking0;
    case 'joist': case 'ledger': case 'blocking': case 'stairhdr': case 'stringer': return MAT.frame;
    case 'beam': case 'post': return MAT.post;
    case 'fascia': return MAT.fascia;
    case 'flashing': return MAT.flash;
    case 'hw': return MAT.hw;
    case 'footing': return MAT.accent;
    case 'railpost': case 'rail': case 'baluster': return MAT.vinyl;
    default: return MAT.frame;
  }
}
const NO_SHADOW = {baluster:1, hw:1, flashing:1};
function buildDeck(){
  if (deckGroup) scene.remove(deckGroup);
  deckGroup = new THREE.Group();
  const md = model();
  if (S.ledger) buildHouse(deckGroup, S.w, S.d, S.h/12);
  md.C.forEach(function(q){
    let g;
    if (q.sh === 'cyl') g = new THREE.CylinderGeometry(q.r, q.r, q.len, 20);
    else g = new THREE.BoxGeometry(q.dx, q.dy, q.dz);
    const mesh = new THREE.Mesh(g, matFor(q));
    mesh.position.set(q.x, q.y, q.z);
    if (q.rotX) mesh.rotation.x = q.rotX;
    if (q.rotY) mesh.rotation.y = q.rotY;
    if (q.rotX && q.rotY){ mesh.rotation.order = 'YXZ'; }
    mesh.castShadow = !NO_SHADOW[q.t]; mesh.receiveShadow = true;
    mesh.userData.t = q.t;
    deckGroup.add(mesh);
  });
  deckGroup.position.y = 0.01;
  scene.add(deckGroup);
  legendSync();
}
// ---------- numbered parts legend (names + counts only; specs live in the permit set) ----------
let legFlashT = null;
function legendCounts(){
  const md = model(), by = {};
  md.C.forEach(function(q){ by[q.t] = (by[q.t]||0) + 1; });
  // count what reads naturally per part (pieces), collapse caps/risers into their parts
  const adj = Object.assign({}, by);
  if (adj.railpost) adj.railpost = md.counts.railposts;
  if (adj.tread) adj.tread = md.counts.treads + md.counts.risersN;
  if (adj.hw) adj.hw = md.counts.hangers + md.counts.holddowns + md.counts.postbases;
  if (adj.stringer) adj.stringer = md.counts.stringers;
  if (adj.joist) adj.joist = md.counts.joists + md.counts.joistsLo;
  return adj;
}
function legendSync(){
  const el = document.getElementById('ds-legend-list');
  if (!el) return;
  const by = legendCounts();
  el.innerHTML = PARTS.map(function(pp){
    const n2 = by[pp.t] || 0;
    if (!n2) return '';
    return '<div class="ds-leg-row" data-t="'+pp.t+'"><span class="ds-leg-n">'+pp.p+'</span>'
      + '<span class="ds-leg-name">'+pp.name+'</span><span class="ds-leg-ct">'+n2+'</span></div>';
  }).join('');
}
function legendFlash(t){
  if (!deckGroup) return;
  if (legFlashT) clearTimeout(legFlashT);
  deckGroup.traverse(function(o){ if (o.isMesh && o.userData.saved){ o.material = o.userData.saved; delete o.userData.saved; } });
  deckGroup.traverse(function(o){ if (o.isMesh && o.userData.t === t){ o.userData.saved = o.material; o.material = MAT.hi; } });
  legFlashT = setTimeout(function(){
    deckGroup.traverse(function(o){ if (o.isMesh && o.userData.saved){ o.material = o.userData.saved; delete o.userData.saved; } });
  }, 1400);
}
function legendInit(){
  if (document.getElementById('ds-legend')) return;
  const st = document.createElement('style');
  st.textContent = '#ds-legend{position:absolute;top:8px;right:8px;z-index:7;font-family:"IBM Plex Mono",ui-monospace,monospace;max-width:230px}'
    + '#ds-legend .ds-leg-head{background:#0C0E11;color:#F2EFE7;border:2px solid #0C0E11;padding:6px 10px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;text-align:right;user-select:none}'
    + '#ds-legend-list{display:none;background:#F2EFE7;border:2px solid #0C0E11;border-top:none;max-height:330px;overflow-y:auto}'
    + '#ds-legend.open #ds-legend-list{display:block}'
    + '.ds-leg-row{display:flex;align-items:center;gap:7px;padding:4px 9px;font-size:10.5px;border-bottom:1px solid rgba(12,14,17,.18);cursor:pointer}'
    + '.ds-leg-row:hover{background:#0C0E11;color:#F2EFE7}'
    + '.ds-leg-n{flex:none;width:16px;height:16px;border:1.5px solid currentColor;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:600}'
    + '.ds-leg-name{flex:1}'
    + '.ds-leg-ct{opacity:.65;font-weight:600}'
    + '.ds-leg-note{padding:6px 9px;font-size:8.5px;letter-spacing:.06em;opacity:.6;text-transform:uppercase}'
    + '@media (max-width:640px){#ds-legend{max-width:190px}#ds-legend-list{max-height:210px}}';
  document.head.appendChild(st);
  const el = document.createElement('div');
  el.id = 'ds-legend';
  el.innerHTML = '<div class="ds-leg-head">Parts &#9662;</div><div id="ds-legend-list"></div>';
  document.getElementById('three-wrap').parentElement.appendChild(el);
  el.querySelector('.ds-leg-head').addEventListener('click', function(){ el.classList.toggle('open'); });
  el.addEventListener('click', function(e){
    const row = e.target.closest('.ds-leg-row');
    if (row) legendFlash(row.getAttribute('data-t'));
  });
  const note = document.createElement('div');
  note.className = 'ds-leg-note';
  note.textContent = 'Sizes + connections detailed in your 18x24 permit set';
  el.appendChild(note);
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

// center the drawing group (dims included) within the sheet, leaving the title strip alone;
// measured from the real rendered bbox so every view centers itself regardless of config
function centerViewG(W2, H2, bandTop, bandBot){
  try{
    const svg = document.querySelector('#plan-wrap svg');
    const g = svg && svg.querySelector('#ds-vg');
    if (!g || !g.getBBox) return;
    const bb = g.getBBox();
    if (!bb || !isFinite(bb.width) || bb.width<=0) return;
    let dx = (W2 - bb.width)/2 - bb.x;
    let dy = bandTop + ((bandBot - bandTop) - bb.height)/2 - bb.y;
    if (bb.width > W2 - 12) dx = 6 - bb.x;
    if (bb.height > (bandBot - bandTop)) dy = bandTop - bb.y;
    g.setAttribute('transform', 'translate('+dx.toFixed(1)+' '+dy.toFixed(1)+')');
  }catch(e){}
}
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
    if (MODE==='decking'){
      // existing door + swing onto the deck (geometry, not annotation)
      const dpxD = x0 + dw/4, dr = 3*sc;
      s += '<rect x="'+(dpxD-dr/2)+'" y="'+(y0-13)+'" width="'+dr+'" height="12" fill="#F2EFE7"/>';
      s += '<line x1="'+(dpxD-dr/2)+'" y1="'+y0+'" x2="'+(dpxD-dr/2)+'" y2="'+(y0+dr)+'" stroke="#0C0E11" stroke-width="1.2"/>';
      s += '<path d="M'+(dpxD-dr/2)+' '+(y0+dr)+' A'+dr+' '+dr+' 0 0 0 '+(dpxD+dr/2)+' '+y0+'" fill="none" stroke="#0C0E11" stroke-width="0.7" opacity="0.7"/>';
    }
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
  const jxsM = MQ.joistXs(1).map(function(mx){ return x0 + (mx + S.w/2)*sc; });
  if (MODE==='framing') jxsM.forEach(function(jx){
    if (jx > x0+dw+1) return;
    const jhw = Math.max(1.2, 0.0625*sc);
    s += '<line x1="'+(jx-jhw)+'" y1="'+y0+'" x2="'+(jx-jhw)+'" y2="'+(y0+dd)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
    s += '<line x1="'+(jx+jhw)+'" y1="'+y0+'" x2="'+(jx+jhw)+'" y2="'+(y0+dd)+'" stroke="#0C0E11" stroke-width="0.6" opacity="0.6"/>';
    if (S.ledger) s += '<line x1="'+jx+'" y1="'+(y0+1.5)+'" x2="'+jx+'" y2="'+(y0+6)+'" stroke="#0C0E11" stroke-width="1.4" opacity="0.5"/>';
  });
  // blocking rows (from model): staggered dash between joist pairs
  if (MODE==='framing') MQ.blockZs(1).forEach(function(zb){
    const by2 = y0 + (zb + S.d/2)*sc;
    for (let j2=0;j2<jxsM.length-1;j2++){
      const bo = (j2%2 ? 3 : -3);
      s += '<line x1="'+(jxsM[j2]+2)+'" y1="'+(by2+bo)+'" x2="'+(jxsM[j2+1]-2)+'" y2="'+(by2+bo)+'" stroke="#0C0E11" stroke-width="1.6" opacity="0.55"/>';
    }
  });
  // rim joist double line (framing)
  if (MODE==='framing'){
    s += '<rect x="'+(x0+3.5)+'" y="'+(y0+3.5)+'" width="'+(dw-7)+'" height="'+(dd-7)+'" fill="none" stroke="#0C0E11" stroke-width="0.9"/>';
  }
  // beams dashed + footings (framing mode)
  const rowsZ = (MODE==='framing') ? MQ.beamZs(1) : [];
  const rows = rowsZ.map(function(z){ return y0 + (z + S.d/2)*sc; });
  const fr9 = Math.max(7, Math.round(9 * MQ.footDia(1)/16));
  rowsZ.forEach(function(zRow){
    const by = y0 + (zRow + S.d/2)*sc;
    s += '<line x1="'+(x0-6)+'" y1="'+(by-2.2)+'" x2="'+(x0+dw+6)+'" y2="'+(by-2.2)+'" stroke="#0C0E11" stroke-width="1.4" stroke-dasharray="10 5"/>';
    s += '<line x1="'+(x0-6)+'" y1="'+(by+2.2)+'" x2="'+(x0+dw+6)+'" y2="'+(by+2.2)+'" stroke="#0C0E11" stroke-width="1.4" stroke-dasharray="10 5"/>';
    const pxsRow = MQ.postsAt(1, zRow).map(function(mx){ return x0 + (mx + S.w/2)*sc; });
    // 6x6 posts drawn as solid squares on the girder (footing circle-X around them)
    const psq = Math.max(3.5, 0.46*sc);
    pxsRow.forEach(function(px){
      s += '<rect x="'+(px-psq/2)+'" y="'+(by-psq/2)+'" width="'+psq+'" height="'+psq+'" fill="#0C0E11"/>';
    });
    pxsRow.forEach(function(px){
      s += '<circle cx="'+px+'" cy="'+by+'" r="'+fr9+'" fill="none" stroke="#FF5A1F" stroke-width="2.5"/>';
      s += '<line x1="'+(px-fr9*0.7)+'" y1="'+(by-fr9*0.7)+'" x2="'+(px+fr9*0.7)+'" y2="'+(by+fr9*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
      s += '<line x1="'+(px-fr9*0.7)+'" y1="'+(by+fr9*0.7)+'" x2="'+(px+fr9*0.7)+'" y2="'+(by-fr9*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
    });
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
    // railing per drafting standard: double rail line with hollow post squares <= 6'-0" OC
    const psq2 = Math.max(4, 0.46*sc), rw = Math.max(2.2, 0.25*sc);
    const rseg = function(x1,y1,x2,y2){
      const vert = Math.abs(x2-x1) < 0.5;
      const len = vert ? (y2-y1) : (x2-x1); if (len < 3) return;
      if (vert){
        const off = (x1 < x0+dw/2) ? 1 : -1;
        s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x1+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="1.1" opacity="0.85"/>';
        s += '<line x1="'+(x1+off*rw)+'" y1="'+y1+'" x2="'+(x1+off*rw)+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="0.8" opacity="0.85"/>';
      } else {
        const off = (y1 < y0+dd/2) ? 1 : -1;
        s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y1+'" stroke="#0C0E11" stroke-width="1.1" opacity="0.85"/>';
        s += '<line x1="'+x1+'" y1="'+(y1+off*rw)+'" x2="'+x2+'" y2="'+(y1+off*rw)+'" stroke="#0C0E11" stroke-width="0.8" opacity="0.85"/>';
      }
      const nP2 = Math.max(2, Math.ceil(Math.abs(len)/(6*sc))+1);
      for (let p3=0;p3<nP2;p3++){
        let t4 = p3/(nP2-1);
        const cx4 = vert ? x1 : (x1 + t4*len);
        const cy4 = vert ? (y1 + t4*len) : y1;
        const px4 = Math.min(Math.max(cx4, x0+ro+psq2/2), x0+dw-ro-psq2/2);
        const py4 = Math.min(Math.max(cy4, y0+ro+psq2/2), y0+dd-ro-psq2/2);
        s += '<rect x="'+((vert?px4:cx4)-psq2/2)+'" y="'+((vert?cy4:py4)-psq2/2)+'" width="'+psq2+'" height="'+psq2+'" fill="#F2EFE7" stroke="#0C0E11" stroke-width="1.2"/>';
      }
    };
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
    const gyC = y0 + (S.d-c.cant)*sc;
    dim(x0+dw, y0, x0+dw, gyC, ftIn(S.d-c.cant), 30, true);
    dim(x0+dw, gyC, x0+dw, y0+dd, ftIn(c.cant), 30, true);
  }
  // post-spacing chain along the beam with centerline marks (his framing-plan signature)
  if (MODE==='framing'){
    const rowY = y0 + (S.d/2-c.cant + S.d/2)*sc;
    const pxmRow = MQ.postsAt(1, S.d/2-c.cant);
    const pxs = pxmRow.map(function(mx){ return x0 + (mx + S.w/2)*sc; });
    const psp2 = pxmRow.length>1 ? (pxmRow[1] - pxmRow[0]) : 0;
    pxs.forEach(function(pxc){
      s += '<text x="'+pxc+'" y="'+(rowY-13)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#0C0E11">&#8452;</text>';
    });
    const chY = rowY + 20;
    const chain = [x0].concat(pxs).concat([x0+dw]);
    for (let i4=0;i4<chain.length-1;i4++){
      const a5=chain[i4], b5=chain[i4+1];
      if (b5-a5 < 14) continue;
      const lbl2 = (i4===0 || i4===chain.length-2) ? ftIn(1.5) : ftIn(psp2);
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
      s += '<text x="'+(x0+dw/2)+'" y="'+(topDimY+11)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.85">PROPOSED DECK</text>';
    }
    if (MODE==='decking'){
      const bx = x0+dw+30, by2 = y0+dd/2;
      s += '<circle cx="'+bx+'" cy="'+by2+'" r="11" fill="#F2EFE7" stroke="#0C0E11" stroke-width="1.4"/>';
      s += '<line x1="'+(bx-11)+'" y1="'+by2+'" x2="'+(bx+11)+'" y2="'+by2+'" stroke="#0C0E11" stroke-width="1"/>';
      s += '<text x="'+bx+'" y="'+(by2-2.5)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#0C0E11">1</text>';
      s += '<text x="'+bx+'" y="'+(by2+8.5)+'" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#0C0E11">A-2</text>';
      s += '<path d="M'+(bx-11)+' '+by2+' l-8 -5 l0 10 z" fill="#0C0E11"/>';
    }
  })();

  s = '<g id="ds-vg">' + s + '</g>';
  // note
  (function(){
    const num = (MODE==='decking') ? '2' : '1';
    const ttl = (MODE==='decking') ? 'PROPOSED DECK PLAN' : 'PROPOSED FRAMING PLAN';
    s += '<circle cx="46" cy="'+(H-30)+'" r="11" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="46" y="'+(H-26)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="#0C0E11">'+num+'</text>';
    s += '<text x="64" y="'+(H-26)+'" font-family="IBM Plex Mono" font-weight="600" font-size="12" letter-spacing="1" fill="#0C0E11">'+ttl+'</text>';
    s += '<line x1="64" y1="'+(H-19)+'" x2="'+(64+ttl.length*8.2+8)+'" y2="'+(H-19)+'" stroke="#0C0E11" stroke-width="1.4"/>';
    if (!MOB) s += '<text x="'+(64+ttl.length*8.2+22)+'" y="'+(H-26)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.8">PERMIT SET DRAWN AT 1/4" = 1\'-0"</text>';
    s += '<text x="'+(W-20)+'" y="'+(H-26)+'" text-anchor="end" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#FF5A1F">PRELIMINARY / NOT FOR CONSTRUCTION</text>';
  })();
  document.getElementById('plan-wrap').innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<defs><pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="8" stroke="#0C0E11" stroke-width="1.4"/></pattern></defs>'
    + s + '</svg>';
  centerViewG(W, H, 16, H-52);
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
  const cU2 = c.up.cant;
  const rowsZU = (MODE==='framing') ? (S.ledger ? [d/2-cU2] : [d/2-cU2, -d/2+cU2]) : [];
  if (c.up.needMid) rowsZU.push(S.ledger ? -cU2/2 : 0);
  rowsZU.forEach(function(z){
    const by = Y(z);
    const shared = (z === d/2-cU2);
    const diaHere = shared ? c.sharedDia : c.up.dia;
    const perHere = shared ? c.sharedPer : c.up.perRow;
    const fr = Math.max(7, Math.round(9 * diaHere/16));
    s += '<line x1="'+(X(-w/2)-6)+'" y1="'+by+'" x2="'+(X(w/2)+6)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="2.5" stroke-dasharray="10 5"/>';
    const psqU = Math.max(3.5, 0.46*sc);
    for (let p=0;p<perHere;p++){
      const px = X(-w/2)+1.5*sc + p*((w-3)*sc/(perHere-1));
      s += '<rect x="'+(px-psqU/2)+'" y="'+(by-psqU/2)+'" width="'+psqU+'" height="'+psqU+'" fill="#0C0E11"/>';
      s += '<circle cx="'+px+'" cy="'+by+'" r="'+fr+'" fill="none" stroke="#FF5A1F" stroke-width="2.5"/>';
      s += '<line x1="'+(px-fr*0.7)+'" y1="'+(by-fr*0.7)+'" x2="'+(px+fr*0.7)+'" y2="'+(by+fr*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
      s += '<line x1="'+(px-fr*0.7)+'" y1="'+(by+fr*0.7)+'" x2="'+(px+fr*0.7)+'" y2="'+(by-fr*0.7)+'" stroke="#FF5A1F" stroke-width="1.6"/>';
    }
    if (z === d/2-cU2){
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
  const rowsZL = (MODE==='framing') ? [d/2+d2-c.lo.cant] : [];
  if (c.lo.needMid) rowsZL.push(d/2 + d2/2 - c.lo.cant);
  const frL = Math.max(7, Math.round(9 * c.lo.dia/16));
  rowsZL.forEach(function(z){
    const by = Y(z);
    s += '<line x1="'+(X(tg.cx2-w2/2)-6)+'" y1="'+by+'" x2="'+(X(tg.cx2+w2/2)+6)+'" y2="'+by+'" stroke="#0C0E11" stroke-width="2.5" stroke-dasharray="10 5"/>';
    const psqL = Math.max(3.5, 0.46*sc);
    for (let p=0;p<c.lo.perRow;p++){
      const px = X(tg.cx2-w2/2)+1.5*sc + p*(Math.max(0.5,w2-3)*sc/(c.lo.perRow-1));
      s += '<rect x="'+(px-psqL/2)+'" y="'+(by-psqL/2)+'" width="'+psqL+'" height="'+psqL+'" fill="#0C0E11"/>';
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
    const midX2 = (X(-w/2)+X(w/2))/2, midY2 = (Y(-d/2)+Y(d/2+d2))/2;
    const psq3 = Math.max(4, 0.46*sc), rw3 = Math.max(2.2, 0.25*sc);
    const rseg = function(x1,y1,x2,y2){
      const vert = Math.abs(x2-x1) < 0.5;
      const len = vert ? (y2-y1) : (x2-x1); if (len < 3) return;
      if (vert){
        const off = (x1 < midX2) ? 1 : -1;
        s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x1+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="1.1" opacity="0.85"/>';
        s += '<line x1="'+(x1+off*rw3)+'" y1="'+y1+'" x2="'+(x1+off*rw3)+'" y2="'+y2+'" stroke="#0C0E11" stroke-width="0.8" opacity="0.85"/>';
      } else {
        const off = (y1 < midY2) ? 1 : -1;
        s += '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y1+'" stroke="#0C0E11" stroke-width="1.1" opacity="0.85"/>';
        s += '<line x1="'+x1+'" y1="'+(y1+off*rw3)+'" x2="'+x2+'" y2="'+(y1+off*rw3)+'" stroke="#0C0E11" stroke-width="0.8" opacity="0.85"/>';
      }
      const nP3 = Math.max(2, Math.ceil(Math.abs(len)/(6*sc))+1);
      for (let p4=0;p4<nP3;p4++){
        const t5 = p4/(nP3-1);
        let cx5 = vert ? x1 : (x1 + t5*len + (p4===0? psq3/2 : (p4===nP3-1? -psq3/2 : 0)));
        let cy5 = vert ? (y1 + t5*len + (p4===0? psq3/2 : (p4===nP3-1? -psq3/2 : 0))) : y1;
        s += '<rect x="'+(cx5-psq3/2)+'" y="'+(cy5-psq3/2)+'" width="'+psq3+'" height="'+psq3+'" fill="#F2EFE7" stroke="#0C0E11" stroke-width="1.2"/>';
      }
    };
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
  s = '<g id="ds-vg">' + s + '</g>';
  // notes
  (function(){
    const num = (MODE==='decking') ? '2' : '1';
    const ttl = (MODE==='decking') ? 'PROPOSED DECK PLAN' : 'PROPOSED FRAMING PLAN';
    s += '<circle cx="46" cy="'+(H-30)+'" r="11" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="46" y="'+(H-26)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="#0C0E11">'+num+'</text>';
    s += '<text x="64" y="'+(H-26)+'" font-family="IBM Plex Mono" font-weight="600" font-size="12" letter-spacing="1" fill="#0C0E11">'+ttl+'</text>';
    s += '<line x1="64" y1="'+(H-19)+'" x2="'+(64+ttl.length*8.2+8)+'" y2="'+(H-19)+'" stroke="#0C0E11" stroke-width="1.4"/>';
    if (!MOB) s += '<text x="'+(64+ttl.length*8.2+22)+'" y="'+(H-26)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.8">PERMIT SET DRAWN AT 1/4" = 1\'-0"</text>';
    s += '<text x="'+(W-20)+'" y="'+(H-26)+'" text-anchor="end" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#FF5A1F">PRELIMINARY / NOT FOR CONSTRUCTION</text>';
  })();
  document.getElementById('plan-wrap').innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<defs><pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="8" stroke="#0C0E11" stroke-width="1.4"/></pattern></defs>'
    + s + '</svg>';
  centerViewG(W, H, 16, H-52);
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
  const DF = MOB?10.5:8.5;
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
    const capH = Math.max(2.5, 0.16*SV), subH = Math.max(2, 0.11*SV), botH = Math.max(2, 0.12*SV);
    // top rail: cap over sub-rail
    rc(xa, topY, xb-xa, capH, 1.5, null, '#F2EFE7');
    rc(xa+1, topY+capH, xb-xa-2, subH, 1.1, null, '#F2EFE7');
    // bottom rail
    rc(xa+1, botY-botH, xb-xa-2, botH, 1.1, null, '#F2EFE7');
    // balusters: wide flat pickets between sub-rail and bottom rail
    const bw = Math.max(1.6, 0.12*SV), pitch = Math.max(bw*2.1, 0.34*SV);
    const byT = topY+capH+subH, byB = botY-botH;
    for (let bx=xa+pitch*0.6; bx<xb-bw-1; bx+=pitch){ rc(bx, byT, bw, byB-byT, 0.9, null, '#F2EFE7'); }
    const span = xb-xa, nP = Math.max(2, Math.ceil(span/(6*SV))+1);
    const hp = Math.max(2.2, 0.17*SV);
    // bottom-rail support blocks at midspans
    for (let i2=0;i2<nP-1;i2++){
      const mx = xa + (i2+0.5)*(span/(nP-1));
      rc(mx-0.08*SV, botY, 0.16*SV, rt-botY, 1, null, '#F2EFE7');
    }
    // posts: body + layered cap + base collar (solid: rails die into them)
    for (let i2=0;i2<nP;i2++){
      let px2 = xa + i2*(span/(nP-1));
      px2 = Math.min(Math.max(px2, xa+hp), xb-hp);
      rc(px2-hp, topY-3, 2*hp, rt-topY+3, 1.4, null, '#F2EFE7');
      rc(px2-hp-0.045*SV, topY-6, 2*hp+0.09*SV, 3.2, 1.2, null, '#F2EFE7');
      rc(px2-hp-0.075*SV, topY-9, 2*hp+0.15*SV, 3.2, 1.2, null, '#F2EFE7');
      rc(px2-hp-0.055*SV, rt-Math.max(3,0.22*SV), 2*hp+0.11*SV, Math.max(3,0.22*SV), 1.2, null, '#F2EFE7');
    }
  };
  const deckBand = function(xa,xb,topZ){
    rc(xa, topZ, xb-xa, 0.95*SV, 2, null, '#F2EFE7');
    ln(xa, topZ+0.12*SV, xb, topZ+0.12*SV, 0.7, null, 0.7);
  };
  const postAt = function(cx, yTopP){
    if (yTopP >= GY - 2){ footing(cx, 0.9*SV); return; }   // grade-bearing: no visible post
    rc(cx-0.23*SV, yTopP, 0.46*SV, GY-yTopP, 1.6);
    footing(cx, 0.9*SV);
  };
  const profileFlight = function(x0s, topY, botY, n, dirR, withRail){
    const rise = (botY-topY)/n, runp=(11/12)*SV;
    let px2=x0s, py2=topY, path='M'+px2+' '+py2, ex2=px2;
    for (let r2=0;r2<n;r2++){ py2 += rise; path += ' L'+ex2+' '+py2; ex2 += dirR*runp; path += ' L'+ex2+' '+py2; }
    s += '<path d="'+path+'" fill="none" stroke="#0C0E11" stroke-width="1.6"/>';
    upd(x0s, topY); upd(ex2, botY);
    ln(x0s, topY+1.5*rise, x0s + dirR*(n-1.5)*runp, botY, 1.2, null, 0.85);
    // tread boards: thickness + nose overhang so each step reads
    const tth = Math.max(2, 0.10*SV), nose = 0.06*SV;
    for (let r2=0;r2<n-1;r2++){
      const ty = topY + rise*(r2+1);
      const faceX2 = x0s + dirR*(r2*runp);
      const xA = Math.min(faceX2 - dirR*nose, faceX2 + dirR*runp);
      rc(xA, ty - tth, runp + nose, tth, 1.1, null, '#F2EFE7');
    }
    if (withRail){
      // per code diagram: rail runs newel-to-newel parallel to the pitch; balusters land on the treads
      const hp2=Math.max(2.2,0.17*SV);
      const capH=Math.max(2.5,0.16*SV), subH=Math.max(2,0.11*SV);
      const nTx = x0s;                                // rails die into the deck guard's corner post
      const nBx = x0s + dirR*Math.max(1,(n-1.5))*runp; // bottom newel stands ON the bottom tread
      const newelBase = Math.min(botY, topY + rise*(n-1)) - tth; // on the tread BOARD top
      const g1y = topY - 3.0*SV, g2y = topY + Math.max(0.5,(n-1.5))*rise - 3.0*SV;
      const poly=function(xa,ya,xb,yb,h){
        s += '<path d="M'+xa+' '+ya+' L'+xb+' '+yb+' L'+xb+' '+(yb+h)+' L'+xa+' '+(ya+h)+' Z" fill="#F2EFE7" stroke="#0C0E11" stroke-width="1.1"/>';
        upd(xa,ya); upd(xb,yb+h);
      };
      // sloped cap + sub-rail AND bottom rail, post face to post face (same system as the deck guard)
      const botH2=Math.max(2,0.12*SV);
      const railBotOff = 3.0*SV-0.35*SV-botH2;
      poly(nTx, g1y, nBx, g2y, capH);
      poly(nTx, g1y+capH, nBx, g2y+capH, subH);
      poly(nTx, g1y+railBotOff, nBx, g2y+railBotOff, botH2);
      // balusters between the rails (equal length along the slope)
      const bw2=Math.max(1.6,0.12*SV), pitch2=Math.max(bw2*2.1,0.34*SV);
      const span2=Math.abs(nBx-nTx), nB3=Math.floor(span2/pitch2);
      for (let b3=1;b3<nB3;b3++){
        const bt=b3/nB3, bx2=nTx+(nBx-nTx)*bt;
        const yTopB=g1y+(g2y-g1y)*bt+capH+subH;
        const yBotB=g1y+(g2y-g1y)*bt+railBotOff;
        rc(bx2-bw2/2, yTopB, bw2, yBotB-yTopB, 0.9, null, '#F2EFE7');
      }
      // one shared corner post at the top (the deck guard's); the stair adds only its bottom newel
      [[nBx, g2y, newelBase]].forEach(function(pp){
        rc(pp[0]-hp2, pp[1]-3, 2*hp2, pp[2]-(pp[1]-3), 1.3, null, '#F2EFE7');
        rc(pp[0]-hp2-0.045*SV, pp[1]-6, 2*hp2+0.09*SV, 3.2, 1.2, null, '#F2EFE7');
        rc(pp[0]-hp2-0.075*SV, pp[1]-9, 2*hp2+0.15*SV, 3.2, 1.2, null, '#F2EFE7');
        rc(pp[0]-hp2-0.055*SV, pp[2]-Math.max(3,0.22*SV), 2*hp2+0.11*SV, Math.max(3,0.22*SV), 1.2, null, '#F2EFE7');
      });
    }
    return ex2;
  };
  const stairProfile = function(x0s, topZ, risers, dirR, withRail){
    if (risers <= 12){
      dbgStair = 'profile';
      const ex2 = profileFlight(x0s, topZ, GY, risers, dirR, withRail);
      footing(ex2 - dirR*0.35*SV, 0.7*SV);
      return ex2;
    }
    // switchback: flight 1 out to a mid landing, return flight comes back UNDER flight 1
    dbgStair = 'profile-swb';
    const n1 = Math.ceil(risers/2), n2 = risers - n1;
    const rise = (GY-topZ)/risers, runp=(11/12)*SV;
    const Ld = Math.max(3, S.stairW)*SV;
    const yL = topZ + n1*rise;
    const x1 = profileFlight(x0s, topZ, yL, n1, dirR, withRail);
    // landing platform on posts with sonotube pads
    const lx1 = Math.min(x1, x1+dirR*Ld), lw2 = Ld;
    rc(lx1, yL, lw2, 0.3*SV, 1.5, null, '#F2EFE7');
    [x1 + dirR*0.18*SV, x1 + dirR*(Ld-0.18*SV)].forEach(function(px3){
      rc(px3-0.13*SV, yL+0.3*SV, 0.26*SV, GY-(yL+0.3*SV), 1.4, null, '#F2EFE7');
      footing(px3, 0.66*SV);
    });
    if (S.rail){
      // landing guard: horizontal rail 36" above the landing, closed by end posts
      ln(lx1, yL-3.0*SV, lx1+lw2, yL-3.0*SV, 2.2);
      ln(lx1, yL-3.0*SV+0.5*SV, lx1+lw2, yL-3.0*SV+0.5*SV, 1.2);
      for (let bx3=lx1+0.3*SV; bx3<lx1+lw2; bx3+=0.38*SV){ ln(bx3, yL-3.0*SV+0.5*SV, bx3, yL-0.05*SV, 0.6, null, 0.65); }
      [lx1, lx1+lw2-0.28*SV].forEach(function(gx3){
        rc(gx3, yL-3.0*SV-3, 0.28*SV, 3.0*SV+3, 1.3, null, '#F2EFE7');
        rc(gx3-0.06*SV, yL-3.0*SV-7, 0.4*SV, 4, 1.2, null, '#F2EFE7');
      });
    }
    // return flight descends back toward the deck, beneath flight 1
    const ex3 = profileFlight(x1, yL, GY, n2, -dirR, withRail);
    footing(x1 - dirR*(n2*runp) + dirR*0.35*SV, 0.7*SV);
    return Math.max(x1+dirR*Ld, ex3, x0s) ;
  };
  let SV;
  let dbgStair = null;
  // head-on stair: risers stacked between topY and botY across the opening — used when the
  // flight descends toward/away from the viewer (front stairs in FRONT view, end stairs in SIDE view)
  const frontalStair = function(sxL, swPx, topY, botY, risers, sono, hrOn){
    const RAILON = (hrOn !== undefined) ? hrOn : (S.rail || risers >= 4);
    const sxR = sxL + swPx;
    if (risers > 12 && botY === GY){
      // switchback head-on: two riser columns side by side, landing band between levels
      dbgStair = 'frontal-swb';
      const n1 = Math.ceil(risers/2), n2 = risers - n1;
      const rise = (botY-topY)/risers, yL = topY + n1*rise;
      const sx2R = sxR + swPx;
      s += '<rect x="'+sxL+'" y="'+topY+'" width="'+swPx+'" height="'+(botY-topY)+'" fill="#F2EFE7"/>';
      s += '<rect x="'+sxR+'" y="'+(yL-0.28*SV)+'" width="'+swPx+'" height="'+(botY-(yL-0.28*SV))+'" fill="#F2EFE7"/>';
      upd(sxL, topY); upd(sx2R, botY);
      // column 1: deck down to the landing
      ln(sxL, topY, sxR, topY, 1.6);
      ln(sxL, topY, sxL, botY, 1.6); ln(sxR, topY, sxR, yL-0.28*SV, 1.6);
      for (let r2=1; r2<=n1; r2++){ const yy = topY + r2*rise; if (yy < yL-1) ln(sxL, yy, sxR, yy, 1); }
      // landing band across both columns
      rc(sxL, yL-0.28*SV, 2*swPx, 0.28*SV, 1.5, null, '#F2EFE7');
      // column 2: landing down to grade
      ln(sxR, yL, sx2R, yL, 1.6);
      ln(sxR, yL-0.28*SV, sxR, botY, 1.6);
      ln(sx2R, yL-0.28*SV, sx2R, botY, 1.6);
      for (let r2=1; r2<n2; r2++){ const yy = yL + r2*((botY-yL)/n2); ln(sxR, yy, sx2R, yy, 1); }
      ln(sxL, botY, sx2R, botY, 1, null, 0.001);
      if (RAILON){
        rc(sxL-0.14*SV, topY-3.0*SV, 0.28*SV, (botY-8)-(topY-3.0*SV), 1.3, null, '#F2EFE7');
        rc(sx2R-0.14*SV, yL-3.0*SV, 0.28*SV, (botY-8)-(yL-3.0*SV), 1.3, null, '#F2EFE7');
      }
      if (sono){
        footing(sxL+0.35*SV, 0.7*SV); footing(sxR-0.35*SV, 0.7*SV);
        footing(sxR+0.35*SV, 0.66*SV); footing(sx2R-0.35*SV, 0.66*SV);
      }
      return;
    }
    dbgStair = 'frontal';
    // the flight is nearer the viewer than the deck: it occludes the structure behind it
    s += '<rect x="'+sxL+'" y="'+topY+'" width="'+swPx+'" height="'+(botY-topY)+'" fill="#F2EFE7"/>';
    upd(sxL, topY); upd(sxR, botY);
    ln(sxL, topY, sxR, topY, 1.6);
    ln(sxL, topY, sxL, botY, 1.6); ln(sxR, topY, sxR, botY, 1.6);
    for (let r2=1; r2<risers; r2++){ const yy = topY + r2*((botY-topY)/risers); ln(sxL, yy, sxR, yy, 1); }
    if (RAILON){
      [sxL, sxR].forEach(function(gx4){
        rc(gx4-0.14*SV, topY-3.0*SV, 0.28*SV, (botY-8)-(topY-3.0*SV), 1.3, null, '#F2EFE7');
        rc(gx4-0.185*SV, topY-3.0*SV-3.2, 0.37*SV, 3.2, 1.2, null, '#F2EFE7');
        rc(gx4-0.215*SV, topY-3.0*SV-6.4, 0.43*SV, 3.2, 1.2, null, '#F2EFE7');
      });
    }
    if (sono){ footing(sxL+0.35*SV, 0.7*SV); footing(sxR-0.35*SV, 0.7*SV); }
  };
  // ================= FRONT =================
  if (kind==='front'){
    const w=S.w;
    const spPre = c.tier2 ? c.gsp : stairPlace();
    const projRisers = c.tier2 ? c.gradeRisers : c.risers;
    const projSwb = projRisers > 12;
    const stairProj=(S.stairs&&spPre&&(spPre.edge==='left'||spPre.edge==='right'))? (projSwb ? (Math.ceil(projRisers/2)*(11/12) + Math.max(3,S.stairW) + 1.2) : (projRisers*(11/12)+1.2)) : 0;
    const projL=(S.stairs&&spPre&&spPre.edge==='left')? stairProj : 0;
    const ESTEPS=[24,20,16,12,9];
    const ewBud = MOB?360:600;
    SV = ESTEPS[ESTEPS.length-1];
    for (let si=0; si<ESTEPS.length; si++){ const t2=ESTEPS[si]; if ((w+stairProj)*t2<=ewBud && (hft+3+1.2)*t2<=GY-96){ SV=t2; break; } }
    const dw=w*SV, x0=(MOB?110:170)+projL*SV;
    const deckTop=GY-hft*SV;
    deckBand(x0, x0+dw, deckTop);
    const yG=deckTop+0.95*SV;
    // girder: visible solid (3)2x10 band across the width; posts bear on its underside
    rc(x0+0.6*SV, yG, dw-1.2*SV, Math.max(2, Math.min(0.8*SV, GY-yG-1)), 1.6);
    const per=(c.tier2? c.sharedPer : c.perRow), run=Math.max(0.5,w-3);
    let px1st=0;
    for (let i2=0;i2<per;i2++){
      const px2=x0+(1.5+(per===1?0:i2*(run/(per-1))))*SV;
      if(i2===0)px1st=px2;
      postAt(px2, yG+0.8*SV);
    }
    const sp = c.tier2 ? null : stairPlace();
    let cutA=null, cutB=null;
    if (!c.tier2 && S.stairs && sp && sp.edge==='front'){
      cutA = x0+(sp.c-sp.sw/2+w/2)*SV; cutB = cutA + sp.sw*SV;
    }
    if (c.tier2 && c.tierRisers>0){
      cutA = x0+(c.tg.tierC-c.tg.tierSw/2+w/2)*SV; cutB = cutA + c.tg.tierSw*SV;
    }
    if (S.rail){
      if (cutA!==null){
        if (cutA-x0>6) railFront(x0, cutA, deckTop);
        if (x0+dw-cutB>6) railFront(cutB, x0+dw, deckTop);
      } else railFront(x0, x0+dw, deckTop);
    }
    if (!c.tier2 && S.stairs && sp){
      const hrF = (S.rail && S.h > 30) || c.risers >= 4;
      if (sp.edge==='front'){
        frontalStair(cutA, cutB-cutA, deckTop, GY, c.risers, true);
      } else {
        const dirR=(sp.edge==='left')?-1:1;
        stairProfile(dirR>0? x0+dw : x0, deckTop, c.risers, dirR, hrF);
      }
    }
    let loTop=null, lx0=0, lw=0;
    if (c.tier2){
      const tg=c.tg, w2=S.w2;
      lx0=x0+(tg.cx2-w2/2+w/2)*SV; lw=w2*SV;
      loTop=GY-h2ft*SV;
      deckBand(lx0, lx0+lw, loTop);
      const yG2=loTop+0.95*SV, run2=Math.max(0.5,w2-3), per2=c.lo.perRow;
      rc(lx0+0.6*SV, yG2, Math.max(2*SV, lw-1.2*SV), Math.max(2, Math.min(0.8*SV, GY-yG2-1)), 1.6);
      for (let i2=0;i2<per2;i2++){ postAt(lx0+(1.5+(per2===1?0:i2*(run2/(per2-1))))*SV, yG2+0.8*SV); }
      let gA=null, gB=null;
      if (S.stairs && c.gsp && c.gsp.edge==='front'){
        gA = lx0+(c.gsp.c - c.gsp.sw/2 + S.w2/2)*SV; gB = gA + c.gsp.sw*SV;
      }
      if (S.rail){
        if (gA!==null){
          if (gA-lx0>6) railFront(lx0, gA, loTop);
          if (lx0+lw-gB>6) railFront(gB, lx0+lw, loTop);
        } else railFront(lx0, lx0+lw, loTop);
      }
      if (c.tierRisers>0 && cutA!==null) frontalStair(cutA, cutB-cutA, deckTop, loTop, c.tierRisers, false);
      if (S.stairs && c.gsp){
        if (c.gsp.edge==='front'){
          frontalStair(gA, gB-gA, loTop, GY, Math.max(2,c.gradeRisers), true);
        } else {
          const dirR=(c.gsp.edge==='left')?-1:1;
          stairProfile(dirR>0? lx0+lw : lx0, loTop, Math.max(2,c.gradeRisers), dirR, true);
        }
      }
    }
    grade(B.x0-30, B.x1+30);
    // ---- dim lanes from measured bounds ----
    const LX=B.x0-28, RX=B.x1+30, TY=B.y0-22, BY=Math.max(B.y1, GY+30)+22;
    hdim(x0, x0+dw, TY, w+"'-0\"", null);
    tx((x0+dw/2), TY+11, 'PROPOSED DECK', DF, 'middle');
    if (S.rail) vdim(RX, deckTop-3.0*SV, deckTop, '36"');
    vdim(RX, deckTop, GY, S.h+'"');
    vdim(RX, GY, GY+30, '36"');
    if (c.tier2 && loTop!==null) vdim(RX+26, loTop, GY, c.h2e+'"');
    hdim(px1st-0.45*SV, px1st+0.45*SV, BY+14, Math.round(c.tier2? c.sharedDia : c.dia)+'"', null);
  } else {
  // ================= SIDE =================
    const dTot = S.tier2 ? (S.d+S.d2) : S.d;
    const spS = S.tier2 ? c.gsp : stairPlace();
    const sideRisers = S.tier2 ? c.gradeRisers : c.risers;
    const stairFtP = (S.stairs && spS && spS.edge==='front')
      ? (sideRisers > 12 ? (Math.ceil(sideRisers/2)*(11/12) + Math.max(3,S.stairW) + 1.2) : (sideRisers*(11/12)+1))
      : 0.5;
    const SSTEPS=[26,21,17,13,10,8];
    const swBud=MOB?420:700;
    SV=SSTEPS[SSTEPS.length-1];
    for (let si=0; si<SSTEPS.length; si++){ const t2=SSTEPS[si]; if ((dTot+stairFtP+1.5)*t2<=swBud && (hft+3+1.4)*t2<=GY-96){ SV=t2; break; } }
    // DATUM: the house face. Everything about the house lives at x < faceX; the deck at x >= faceX.
    const faceX = MOB?96:140;
    const deckTop = GY-hft*SV;
    if (S.ledger){
      const wallW=18, wTop=Math.max(26, deckTop-4.2*SV);
      rc(faceX-wallW, wTop, wallW, GY-wTop, 1.4, null, null, true);
      for (let sy=wTop+10; sy<GY-6; sy+=11){ ln(faceX-wallW, sy, faceX, sy-5, 0.5, null, 0.3, true); }
      ln(faceX, wTop, faceX, GY, 2.2, null, null, true);
      // the dwelling continues above: mask the top edge and draw a break line
      s += '<rect x="'+(faceX-wallW-3)+'" y="'+(wTop-2.5)+'" width="'+(wallW+6)+'" height="6" fill="#F2EFE7"/>';
      (function(){
        const bx0=faceX-wallW-4, bx1=faceX+4, bm=(bx0+bx1)/2;
        s += '<path d="M'+bx0+' '+wTop+' L'+(bm-5)+' '+wTop+' l3.5 -5 l3 10 l3.5 -5 L'+bx1+' '+wTop+'" fill="none" stroke="#0C0E11" stroke-width="1.2"/>';
      })();
      rc(faceX, deckTop+2, 4, 0.83*SV, 1.6, null, '#0C0E11');
    }
    const dpx=S.d*SV;
    ln(faceX, deckTop, faceX+dpx, deckTop, 2.5);
    ln(faceX, deckTop+2.5, faceX+dpx, deckTop+2.5, 0.8, null, 0.7);
    rc(faceX, deckTop+2, dpx, 0.83*SV, 1.4);
    const yJb=Math.min(deckTop+2+0.83*SV, GY-Math.max(3,0.85*SV)-1);
    const gx=faceX+(S.d-c.cant)*SV;
    rc(gx-0.24*SV, yJb, 0.48*SV, 0.85*SV, 1.8);
    ln(gx-0.08*SV, yJb, gx-0.08*SV, yJb+0.85*SV, 0.7, null, 0.7);
    ln(gx+0.08*SV, yJb, gx+0.08*SV, yJb+0.85*SV, 0.7, null, 0.7);
    postAt(gx, yJb+0.85*SV);
    if (c.needMid && !c.tier2){
      const gxm = faceX + (S.ledger ? (S.d/2 - c.cant/2) : S.d/2)*SV;
      rc(gxm-0.24*SV, yJb, 0.48*SV, 0.85*SV, 1.8);
      ln(gxm-0.08*SV, yJb, gxm-0.08*SV, yJb+0.85*SV, 0.7, null, 0.7);
      ln(gxm+0.08*SV, yJb, gxm+0.08*SV, yJb+0.85*SV, 0.7, null, 0.7);
      postAt(gxm, yJb+0.85*SV);
    }
    if (!S.ledger){ const gx0=faceX+c.cant*SV; rc(gx0-0.24*SV,yJb,0.48*SV,0.85*SV,1.8); postAt(gx0, yJb+0.85*SV); }
    let cutSA=null, cutSB=null;
    if (!S.tier2 && S.stairs && spS && spS.edge!=='front'){
      cutSA = faceX + (spS.c - spS.sw/2 + S.d/2)*SV; cutSB = cutSA + spS.sw*SV;
    }
    const railA = faceX+(S.ledger?0.1*SV:0);
    if (!S.tier2 && S.rail){
      if (cutSA!==null){
        if (cutSA-railA>6) railFront(railA, cutSA, deckTop);
        if (faceX+dpx-cutSB>6) railFront(cutSB, faceX+dpx, deckTop);
      } else railFront(railA, faceX+dpx, deckTop);
    }
    let endX=faceX+dpx;
    if (!S.tier2){
      if (S.stairs){
        const hr = (S.rail && S.h > 30) || c.risers >= 4;
        if (spS && spS.edge!=='front'){ frontalStair(cutSA, cutSB-cutSA, deckTop, GY, c.risers, true); }
        else endX = stairProfile(faceX+dpx, deckTop, c.risers, 1, hr);
      }
      grade(Math.min(faceX-(S.ledger?18:0), B.x0)-26, Math.max(endX,B.x1)+28);
      const LX=B.x0-28, RX=Math.max(B.x1,endX)+30, BY=Math.max(B.y1,GY+30)+22;
      hdim(faceX, gx, BY, ftIn(S.d-c.cant), null);
      hdim(gx, faceX+dpx, BY, ftIn(c.cant), null);
      hdim(faceX, faceX+dpx, BY+26, S.d+"'-0\"", null);
      if (S.rail) vdim(RX, deckTop-3.0*SV, deckTop, '36"');
      vdim(RX, deckTop, GY, S.h+'"');
      vdim(RX, GY, GY+30, '36"');
    } else {
      const d2px=S.d2*SV, loTop=GY-h2ft*SV;
      ln(faceX+dpx, loTop, faceX+dpx+d2px, loTop, 2.5);
      rc(faceX+dpx, loTop+2, d2px, 0.83*SV, 1.4);
      const yJb2=loTop+2+0.83*SV;
      const gx2=faceX+(S.d+S.d2-c.lo.cant)*SV;
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
      if (S.rail){
        railFront(faceX+(S.ledger?0.1*SV:0), faceX+dpx, deckTop);
        const lrA = faceX+dpx+(c.tierRisers? c.tierRisers*(11/12)*SV:0), lrB = faceX+dpx+d2px;
        if (S.stairs && c.gsp && c.gsp.edge!=='front'){
          const gsA = faceX + dpx + (c.gsp.c - c.gsp.sw/2 + S.d2/2)*SV, gsB = gsA + c.gsp.sw*SV;
          if (gsA-lrA>6) railFront(lrA, gsA, loTop);
          if (lrB-gsB>6) railFront(gsB, lrB, loTop);
        } else railFront(lrA, lrB, loTop);
      }
      if (S.stairs && c.gsp){
        if (c.gsp.edge==='front'){ endX = stairProfile(faceX+dpx+d2px, loTop, Math.max(2,c.gradeRisers), 1, true); }
        else {
          const gsA = faceX + dpx + (c.gsp.c - c.gsp.sw/2 + S.d2/2)*SV;
          frontalStair(gsA, c.gsp.sw*SV, loTop, GY, Math.max(2,c.gradeRisers), true);
        }
      }
      grade(Math.min(faceX-(S.ledger?18:0), B.x0)-26, Math.max(endX,B.x1)+28);
      const LX=B.x0-28, RX=Math.max(B.x1,endX)+30, BY=Math.max(B.y1,GY+30)+22;
      hdim(faceX, faceX+dpx, BY, S.d+"'-0\"", null);
      hdim(faceX+dpx, faceX+dpx+d2px, BY, S.d2+"'-0\"", null);
      if (S.rail) vdim(RX, deckTop-3.0*SV, deckTop, '36"');
      vdim(RX, deckTop, GY, S.h+'"');
      vdim(RX, GY, GY+30, '36"');
      vdim(RX+26, loTop, GY, c.h2e+'"');
    }
  }
  s = '<g id="ds-vg">' + s + '</g>';
  // ---- stamp + view title (fixed corners, outside lanes) ----
  s += '<text x="'+(W-20)+'" y="24" text-anchor="end" font-family="IBM Plex Mono" font-weight="600" font-size="8.5" fill="#FF5A1F">PRELIMINARY / NOT FOR CONSTRUCTION</text>';
  (function(){
    const num=(kind==='front')?'3':'4';
    const ttl=(kind==='front')?'PROPOSED FRONT ELEVATION':'PROPOSED SIDE ELEVATION';
    s += '<circle cx="46" cy="'+(H-24)+'" r="11" fill="none" stroke="#0C0E11" stroke-width="1.5"/>';
    s += '<text x="46" y="'+(H-20)+'" text-anchor="middle" font-family="IBM Plex Mono" font-weight="600" font-size="11" fill="#0C0E11">'+num+'</text>';
    s += '<text x="64" y="'+(H-20)+'" font-family="IBM Plex Mono" font-weight="600" font-size="12" letter-spacing="1" fill="#0C0E11">'+ttl+'</text>';
    s += '<line x1="64" y1="'+(H-13)+'" x2="'+(64+ttl.length*8.2+8)+'" y2="'+(H-13)+'" stroke="#0C0E11" stroke-width="1.4"/>';
    if (!MOB) s += '<text x="'+(64+ttl.length*8.2+22)+'" y="'+(H-20)+'" font-family="IBM Plex Mono" font-size="8.5" fill="#0C0E11" opacity="0.8">PERMIT SET DRAWN AT 1/4" = 1\'-0"</text>';
  })();
  try{ window.__dsDbg = {view:kind, stair:dbgStair, bounds:{x0:B.x0,y0:B.y0,x1:B.x1,y1:B.y1}}; }catch(e){}
  document.getElementById('plan-wrap').innerHTML =
    '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">' + s + '</svg>';
  centerViewG(W, H, 34, H-46);
}

// ---------- wiring ----------
function syncField(id, val){
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = val;
}
function sanitizeS(){
  const num = function(v, lo, hi, dflt){ v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt; };
  S.w = num(S.w, 4, 40, 16); S.d = num(S.d, 3, 24, 12); S.h = num(S.h, 8, 120, 36);
  S.w2 = num(S.w2, 3, 30, 10); S.d2 = num(S.d2, 3, 20, 10); S.h2 = num(S.h2, 8, 112, 24);
  if (S.spacing !== 12) S.spacing = 16;
  if ([3,4,5].indexOf(+S.stairW) < 0) S.stairW = 4; else S.stairW = +S.stairW;
  if (['fl','fc','fr','el','er'].indexOf(S.stairPos) < 0) S.stairPos = 'fr';
  // a lower tier wider than the upper would cantilever the shared girder and open unguarded
  // edges — clamp to the upper width (mirrors the h2 clamp)
  if (S.tier2 && S.w2 > S.w) S.w2 = S.w;
}
function refresh(){
  sanitizeS();
  modelDirty();
  // code: guards are not optional over 30" — the tool includes them automatically
  const guardMust = S.h > 30 || (S.tier2 && h2eff() > 30);
  if (guardMust && !S.rail) S.rail = true;
  const swR = document.getElementById('swRail');
  if (swR){ swR.classList.toggle('on', S.rail); swR.style.opacity = guardMust ? '0.45' : ''; swR.dataset.lock = guardMust ? '1' : ''; }
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
  legendInit(); renderTakeoff(); buildDeck(); renderView();
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
    if (this.dataset.lock === '1') return;  // guards required by code at this height
    this.classList.toggle('on'); S[pair[1]] = this.classList.contains('on'); refresh();
  });
});
function renderView(){
  const lg = document.getElementById('ds-legend');
  if (lg) lg.style.display = (S.view === '3d') ? '' : 'none';
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
    if (is3d){ sizeStage(); const lg2=document.getElementById('ds-legend'); if (lg2) lg2.style.display=''; } else { renderView(); }
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
