/* The flow: a node canvas, like a workflow editor. Nodes sit on a board you can pan and zoom.
   Drag a line out of a node to add the next one; open a node and it tells you what it wants.
   With Guided on, finishing a node grows the next one for you. A Film node at the end renders
   the clip, and the editor opens with it. */
(function () {
  'use strict';
  var S = window.EmberStudio;
  if (!S || !S.user) return;
  var $ = S.$, el = S.el, svg = S.svg, api = S.api, clamp = S.clamp;
  var root = $('#flow'), view = $('#flow-view'), world = $('#flow-world'), wiresEl = $('#flow-wires'), panel = $('#flow-panel'), menuEl = $('#flow-menu');
  var KEY = 'ember_graph_' + S.user + '_' + S.projectId, SEEN = 'ember_flow_seen_' + S.user, NW = 248, NH = 104, GAP = 128;
  var I = {
    bag: '<path d="M4.5 7h11l-1 9h-9zM7.5 7V5.8a2.5 2.5 0 0 1 5 0V7"/>',
    person: '<circle cx="10" cy="7" r="3.2"/><path d="M3.8 16.5c.8-3.2 3.2-4.8 6.2-4.8s5.4 1.6 6.2 4.8"/>',
    spark: '<path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z"/>',
    script: '<path d="M4.5 5h11M4.5 9h11M4.5 13h6M13 16l3.5-3.5"/>',
    film: '<rect x="3" y="5" width="14" height="10" rx="2.5"/><path d="M8.5 8l3.5 2-3.5 2z"/>',
    mic: '<rect x="7.5" y="3" width="5" height="9" rx="2.5"/><path d="M5 10a5 5 0 0 0 10 0M10 15v2.5"/>',
    up: '<path d="M10 13.5v-9M6 8l4-4 4 4M4.5 15.5h11"/>',
    arrow: '<path d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"/>',
    check: '<path d="M5 10.5l3.2 3.2L15 6.5"/>',
    none: '<circle cx="10" cy="10" r="6.5"/><path d="M5.5 14.5l9-9"/>',
    x: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
    play: '<path d="M7 5l8 5-8 5z"/>',
    point: '<circle cx="10" cy="8" r="2.6"/><path d="M5 16.5c.6-2.8 2.4-4.2 5-4.2s4.4 1.4 5 4.2M15.5 6V2.5M13.8 4l1.700-1.700L17.200 4"/>'
  };
  var T = {
    subject: { title: 'The subject', ask: 'What is the video about?', icon: I.bag, hint: 'A product, your own picture, or an idea.',
      say: 'Pick what the video is about: a selling video in Shop, or one of your own files in Media. Or chat about it with Ember.' },
    creator: { title: 'On camera', ask: 'Who is on camera?', icon: I.person, hint: 'Your face, a creator we make, or no one.',
      say: 'Who is on camera? Use your own face or creator, have us make one, or leave people out.' },
    format: { title: 'What to make', ask: 'What do you want to make?', icon: I.spark, hint: 'The kind of video and how long it runs.',
      say: 'Pick the kind of video and how long it runs. The price follows the length.' },
    script: { title: 'The script', ask: 'The script', icon: I.script, hint: 'I write the words and the shot.',
      say: 'Here is what I would shoot. Change any word you like. Nothing is filmed yet.' },
    voice: { title: 'The voice', ask: 'Whose voice is it?', icon: I.mic, hint: 'The presenter, a library voice, or your own.',
      say: 'Whose voice says the line? The presenter can speak it, a voice from the library can narrate it, or you can record your own.' },
    film: { title: 'Film it', ask: 'Film it', icon: I.film, hint: 'See the price, then render it on our GPUs.',
      say: 'Ready to film. You see the price first, and nothing renders until you press the button.' }
  };
  T.media = { title: 'Media', ask: 'Media', icon: I.film, hint: '', say: 'One of your files. Drag a line out of its + to do something with it, or wire it into the final video.' };
  T.final = { title: 'Final video', ask: 'Your final video', icon: I.play, hint: 'Wire clips into this. In order, they are your video.',
    say: 'This is your video: every clip wired into it, in order. Play it here, caption it, tighten it, then export.' };
  var ORDER = ['subject', 'creator', 'format', 'script', 'voice', 'film'];
  var MAKES = [
    { id: 'clip', icon: I.point, t: 'Clip it', d: 'Your creator points up at the product and tells people why to buy it.', person: true },
    { id: 'pitch', icon: I.person, t: 'Talk to camera', d: 'Your creator holds it up and pitches it straight to the lens.', person: true },
    { id: 'showcase', icon: I.bag, t: 'Product showcase', d: 'A cinematic close-up of the product. No one on camera.' },
    { id: 'free', icon: I.spark, t: 'My own idea', d: 'Describe any shot and we film it.' }
  ];

  /* ---------- the step panel lives in the left rail: the board keeps the whole right side ---------- */
  var docked = false;
  (function () { var lib = $('#lib'); if (lib && window.innerWidth > 760) { lib.appendChild(panel); panel.classList.add('in-rail'); docked = true; } })();

  /* ---------- the graph ---------- */
  function rid() { return 'n' + Math.random().toString(36).slice(2, 8); }
  function mk(type, x, y) { return { id: rid(), type: type, x: Math.round(x), y: Math.round(y), d: type === 'subject' ? { tab: 'shop', sort: 'trending' } : type === 'format' ? { seconds: 8 } : {} }; }
  function fresh() { var n = mk('subject', 0, 0); return { guided: true, view: null, nodes: [n], wires: [], open: n.id, pristine: true }; }
  var G = null;
  try { G = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!G || !G.nodes || !G.nodes.length || !G.wires) G = fresh();
  G.nodes.forEach(function (n) {                              // a render that was running when the page was left keeps running on the server: wait for its clip
    var fl = n.type === 'film' && n.d.film;
    if (!fl || fl.state !== 'run') return;
    if (Date.now() - (fl.t0 || 0) < 40 * 60000) { fl.resumed = true; fl.note = 'Still filming. The clip appears here when it is done.'; }
    else n.d.film = { state: 'fail', reason: 'The render did not report back. If it finished, the clip is in Media.' };
  });
  var V = G.view || { x: 0, y: 0, k: 1 };
  var pushT = 0, pushOff = false;
  function keep() {                                           // saved in this browser at once, and beside the project on the server a moment later
    G.view = V; delete G.pristine; G.saved = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) {}
    if (pushOff) return;
    clearTimeout(pushT);
    pushT = setTimeout(function () { api('/api/board', { method: 'PUT', body: G }).catch(function () { pushOff = true; }); }, 2500);   // an older server has no board store: stop trying
  }
  api('/api/board').then(function (b) {                       // another browser, or cleared storage: the server's copy is the board
    if (!b || !Array.isArray(b.nodes) || !b.nodes.length || !Array.isArray(b.wires)) return;
    if (!G.pristine && (G.saved || 0) >= (b.saved || 0)) return;   // this browser's copy is the newer one
    G = b; V = G.view || { x: 0, y: 0, k: 1 }; G.open = null;
    G.nodes.forEach(function (n) { if (n.type === 'film' && n.d && n.d.film && n.d.film.state === 'run') n.d.film.resumed = true; });
    try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) {}
    Object.keys(els).forEach(function (id) { els[id].remove(); delete els[id]; });
    if (!root.hidden && P()) { validate(); sync(); draw(); renderPanel(); apply(false); }
  }).catch(function () {});
  function P() { return S.project(); }
  function has(id) { return !!(id && P() && P().assets[id]); }
  function node(id) { return G.nodes.filter(function (n) { return n.id === id; })[0] || null; }
  function ins(id) { return G.wires.filter(function (w) { return w.to === id; }).map(function (w) { return node(w.from); }).filter(Boolean); }
  function outs(id) { return G.wires.filter(function (w) { return w.from === id; }).map(function (w) { return node(w.to); }).filter(Boolean); }
  function ctx(id) {                                         // the nearest node of each kind, looking back along the wires
    var out = {}, seen = {}, q = [id];
    while (q.length) { var n = node(q.shift()); if (!n || seen[n.id]) continue; seen[n.id] = 1; var key = n.type === 'media' ? n.d.role : n.type; if (key && !out[key]) out[key] = n; ins(n.id).forEach(function (m) { q.push(m.id); }); }
    return out;
  }
  function below(id) {
    var out = [], seen = {}, q = outs(id).map(function (n) { return n.id; });
    while (q.length) { var n = node(q.shift()); if (!n || seen[n.id]) continue; seen[n.id] = 1; out.push(n); outs(n.id).forEach(function (m) { q.push(m.id); }); }
    return out;
  }
  function isDone(n) {
    var d = n.d;
    if (n.type === 'media') return has(d.asset);
    if (n.type === 'final') return false;
    return n.type === 'subject' ? !!d.subject : n.type === 'creator' ? !!d.creator : n.type === 'format' ? !!(d.make && d.ok) : n.type === 'script' ? !!(d.script && d.ok)
         : n.type === 'voice' ? !!d.voice : !!(d.film && d.film.state === 'done');
  }
  function needs(n) {                                        // what this node cannot work without
    var c = ctx(n.id), want = n.type === 'format' ? ['subject'] : n.type === 'script' ? ['subject', 'format'] : n.type === 'film' ? ['script'] : [];
    return want.filter(function (t) { return !c[t] || !isDone(c[t]); }).map(function (t) { return { type: t, node: c[t] || null }; });
  }
  function clear(m, hard) { if (m.type === 'script' && hard) { m.d.script = null; m.d.ok = false; } if (m.type === 'film') m.d.film = null; }
  function changed(n) { var hard = n.type !== 'script' && n.type !== 'voice'; below(n.id).forEach(function (m) { clear(m, hard); }); }
  function validate() {                                      // the library may have changed since this was saved
    G.nodes.forEach(function (n) {
      var d = n.d;
      if (d.subject && (d.subject.kind === 'asset' || d.subject.kind === 'reference') && !has(d.subject.asset)) { d.subject = null; changed(n); }   // the file was deleted: the step is open again
      if (d.creator && d.creator.kind === 'avatar' && !has(d.creator.asset)) { d.creator = null; changed(n); }
      if (d.voice && d.voice.kind === 'own' && !has(d.voice.asset)) d.voice = null;
      if (d.film && d.film.state === 'done' && !has(d.film.asset)) d.film = null;
    });
    if (G.open && !node(G.open)) G.open = null;
  }
  /* ---------- media on the canvas, and the final video ---------- */
  function finalNode() { return G.nodes.filter(function (n) { return n.type === 'final'; })[0] || null; }
  function holder(a) {                                        // the workflow step that already holds this file as its subject
    var vid = a.meta && a.meta.video_id;
    return G.nodes.filter(function (m) { var s = m.type !== 'media' && m.d.subject; return s && (s.asset === a.id || (s.kind === 'shop' && vid && String(s.id) === String(vid))); })[0] || null;
  }
  function adopt(a) {                                         // a selling video arrived (Ember fetched it, or it was imported) while step one was still empty: it is the subject
    if (!a.reference || holder(a)) return false;
    var n = G.nodes.filter(function (m) { return m.type === 'subject' && !m.d.subject; }).sort(function (x, y) { return (y.id === G.open) - (x.id === G.open); })[0];
    if (!n) return false;
    n.d.subject = { kind: 'reference', asset: a.id, title: (a.meta && a.meta.product) || a.name, poster: thumb(a), price: a.meta && a.meta.price };
    changed(n); G.lead = n.id;
    if (S.acting && S.acting()) {                             // Ember is doing this for them: the board shows its steps, and the picker gets out of the way
      var p = P(), av = p.avatar && p.assets[p.avatar];
      if (av && !outs(n.id).length) { var c = addNode('creator', n.x + NW + GAP, n.y, n.id); c.d.creator = { kind: 'avatar', asset: av.id, title: av.name, poster: av.url }; G.lead = c.id; }
      if (G.open === n.id) G.open = null;
    }
    return true;
  }
  function finalShown() {                                     // the final video only appears once there is something to put in it (or it was asked for)
    var fin = finalNode(), p = P(); if (!fin || !p) return false;
    if (G.open === fin.id || p.tracks.video.length || p.tracks.audio.length) return true;
    return G.nodes.some(function (n) {
      if (n.type === 'film') return !!(n.d.film && n.d.film.state);
      var a = n.type === 'media' && p.assets[n.d.asset]; return !!a && a.kind !== 'image' && !a.reference;   // a clip or a sound of your own can be wired in
    });
  }
  function mediaNode(asset) { return G.nodes.filter(function (n) { return n.type === 'media' && n.d.asset === asset; })[0] || null; }
  function wired(a, b) { return G.wires.some(function (w) { return w.from === a && w.to === b; }); }
  function inCut(asset) { var p = P(); return p.tracks.video.concat(p.tracks.audio).some(function (c) { return c.asset === asset; }); }
  function fill(n) {                                          // what a media node is, to the nodes it feeds: the subject, the person, or the voice
    var a = P().assets[n.d.asset]; if (!a) return;
    var person = function () {                                // a picture that comes after the subject, or leads into "Who is on camera", is the person
      return outs(n.id).some(function (m) { return m.type === 'creator'; }) || ins(n.id).some(function (m) { return !!ctx(m.id).subject; });
    };
    var role = a.kind === 'audio' ? 'voice' : a.kind === 'video' ? 'subject' : n.d.as || (a.id === P().avatar ? 'creator' : a.source === 'product' ? 'subject' : person() ? 'creator' : P().avatar ? 'subject' : 'creator');
    n.d.role = role; delete n.d.subject; delete n.d.creator; delete n.d.voice;
    if (role === 'subject') n.d.subject = { kind: a.reference ? 'reference' : 'asset', asset: a.id, title: (a.meta && a.meta.product) || a.name, poster: thumb(a), price: a.meta && a.meta.price };
    else if (role === 'creator') n.d.creator = { kind: 'avatar', asset: a.id, title: a.name, poster: a.url };
    else n.d.voice = { kind: 'own', asset: a.id, title: a.name };
  }
  var claimed = null;                                         // an open "Who is on camera" step that a wired-in picture has just answered
  function claim() {                                          // a picture of a person wired into "Who is on camera" is the answer to it
    var p = P(), got = null;
    G.nodes.forEach(function (n) {
      ['subject', 'voice'].forEach(function (k) {             // a step a file answered empties when that file is unwired
        var v = n.type === k && n.d[k];
        if (v && v.from && !ins(n.id).some(function (x) { return x.id === v.from; })) { n.d[k] = null; changed(n); }
      });
      if (n.type !== 'creator') return;
      var c = n.d.creator;
      if (c && c.from && !ins(n.id).some(function (x) { return x.id === c.from && x.d.role === 'creator'; })) { n.d.creator = c = null; changed(n); }   // unwired, or it is the product after all
      if (c) return;
      var m = ins(n.id).filter(function (x) { var a = x.type === 'media' && p.assets[x.d.asset]; return a && a.kind === 'image' && x.d.role === 'creator'; })[0];
      if (!m) return;
      var a = p.assets[m.d.asset];
      n.d.creator = { kind: 'avatar', asset: a.id, title: a.name, poster: a.url, from: m.id }; changed(n);
      if (G.open === n.id) got = n;
    });
    return got;
  }
  function filming(n) {                                       // a clip is being filmed: anywhere on the board, or from the steps that follow n
    var run = function (m) { return m.type === 'film' && m.d.film && m.d.film.state === 'run'; };
    if (!n) return G.nodes.filter(run)[0] || null;
    return run(n) ? n : below(n.id).filter(run)[0] || null;
  }
  function shopClick(v) {                                     // a Shop video was clicked in the rail or the grid. The board decides what that means; Ember is not sent off on it.
    var f = filming();
    if (f) return void stop(f, 'A clip is being filmed right now. Wait for it to finish before starting from another video.');
    if (S.acting && S.acting()) return void stop(null, 'Ember is working. Wait for it to finish, then pick a video.');
    var n = G.nodes.filter(function (m) { return m.type === 'subject' && !m.d.subject; })[0];
    if (n) {                                                 // step one is still empty: this video is what the video is about
      delete n.d.via;
      n.d.subject = { kind: 'shop', id: String(v.id), title: v.product || v.title || 'Video', poster: v.poster, price: v.price, units: v.units_7d, creator: v.creator, url: v.url, image: v.image, rating: v.rating,
        more: { price_was: v.price_was, reviews: v.reviews, sold_total: v.sold_total, seller: v.seller, category: v.category, stock: v.stock } };
      changed(n); S.pick(null);
      return void (G.guided ? complete(n) : open(n.id));
    }
    var has = G.nodes.filter(function (m) { return m.type === 'subject' && m.d.subject; })[0];
    stop(null, 'This video already has its subject' + (has ? ' (' + called(has) + ')' : '') + '. To use another product, click step 1 and pick it there, or press Start over for a new video.');
  }
  function addRight(asset, fin) {                             // something new goes to the right of everything on the board, and the final video stays last
    var rest = G.nodes.filter(function (n) { return n.type !== 'final'; });
    var m = addMedia(asset, rest.length ? Math.max.apply(null, rest.map(function (n) { return n.x; })) + NW + GAP : 0, fin ? fin.y : 0);
    if (fin && fin.x < m.x + NW + GAP) fin.x = m.x + NW + GAP;
    return m;
  }
  function addMedia(asset, x, y) { var at = freeSpot(x, y), n = { id: rid(), type: 'media', x: at.x, y: at.y, d: { asset: asset } }; G.nodes.push(n); fill(n); return n; }
  function sync() {                                           // the canvas follows the project: files that exist, and the cut wired into Final
    var p = P(); if (!p) return;
    if (G.pristine && (p.tracks.video.length || p.tracks.audio.length)) { G.nodes = []; G.wires = []; G.open = null; }   // an existing video opens as itself, not as an empty workflow
    G.nodes = G.nodes.filter(function (n) { return n.type !== 'media' || p.assets[n.d.asset]; });
    var fin = finalNode();
    if (!fin) {
      var right = G.nodes.length ? Math.max.apply(null, G.nodes.map(function (n) { return n.x; })) + 2 * (NW + GAP) : NW + GAP;
      fin = { id: rid(), type: 'final', x: right, y: 0, d: {} }; G.nodes.push(fin);
    }
    G.nodes.forEach(function (n) {                            // a filmed clip sits right after the node that filmed it
      var a = n.type === 'film' && n.d.film && n.d.film.state === 'done' && n.d.film.asset;
      if (a && p.assets[a] && !mediaNode(a) && Math.abs(fin.x - (n.x + NW + GAP)) < NW + 30 && Math.abs(fin.y - n.y) < NH + 24) fin.x = n.x + 2 * (NW + GAP);   // the final video makes room for the new clip
      if (a && p.assets[a]) { var m = mediaNode(a) || addMedia(a, n.x + NW + GAP, n.y); if (!wired(n.id, m.id)) G.wires.push({ from: n.id, to: m.id }); }
    });
    if (!G.known) { G.known = {}; Object.keys(p.assets).forEach(function (id) { G.known[id] = 1; }); }   // first time: the whole library does not flood the canvas
    Object.keys(p.assets).forEach(function (id) {             // anything new (Ember made it, you uploaded it) appears as a node
      if (G.known[id]) return; G.known[id] = 1;
      var a = p.assets[id];
      var rf = a.source === 'generated' && !mediaNode(id) && G.nodes.filter(function (m) { return m.type === 'film' && m.d.film && m.d.film.state === 'run' && m.d.film.resumed; })[0];
      if (rf) {                                              // the clip a reloaded page was waiting for
        rf.d.film = { state: 'done', asset: id };
        var got = addMedia(id, rf.x + NW + GAP, rf.y); G.wires.push({ from: rf.id, to: got.id });
        if (fin.x < got.x + NW + GAP) fin.x = got.x + NW + GAP;
        return;
      }
      if (a.source === 'product' || mediaNode(id) || adopt(a)) return;
      var lead = a.source === 'generated' && G.lead && node(G.lead);   // a clip Ember filmed from the steps it filled in: it comes out of the last of them
      if (lead && !outs(lead.id).length && !G.nodes.some(function (m) { return m.type === 'film' && m.d.film && m.d.film.state === 'run'; })) {
        var made = addMedia(id, lead.x + NW + GAP, lead.y); G.wires.push({ from: lead.id, to: made.id }); G.lead = null;
        if (fin.x < made.x + NW + GAP) fin.x = made.x + NW + GAP;   // the final video stays to the right of the new clip
        return;
      }
      if (current() && a.source !== 'generated' && a.source !== 'edited') return;   // guided, a step is waiting: a new file stays in the media list, not loose on the board
      addRight(id, fin).d.auto = 1;
    });
    G.nodes = G.nodes.filter(function (n) {                    // a file a workflow node already holds (the avatar picked in On camera, the selling video picked in The subject) is not also a loose node
      if (n.type !== 'media' || !n.d.auto || G.wires.some(function (w) { return w.from === n.id || w.to === n.id; }) || inCut(n.d.asset)) return true;
      var a = p.assets[n.d.asset], vid = a.meta && a.meta.video_id;
      return !G.nodes.some(function (m) {
        if (m.type === 'media') return false; var d = m.d;
        return (d.creator && d.creator.asset === a.id) || (d.voice && d.voice.asset === a.id) ||
               (d.subject && (d.subject.asset === a.id || (d.subject.kind === 'shop' && vid && String(d.subject.id) === String(vid))));
      });
    });
    var cut = {}; p.tracks.video.concat(p.tracks.audio).forEach(function (c) { cut[c.asset] = 1; });
    Object.keys(cut).forEach(function (id) { var m = mediaNode(id) || addRight(id, fin); if (!wired(m.id, fin.id)) G.wires.push({ from: m.id, to: fin.id }); });
    G.wires = G.wires.filter(function (w) {
      var a = node(w.from), b = node(w.to); if (!a || !b) return false;
      return b.id !== fin.id || (a.type === 'media' && cut[a.d.asset]);
    });
    G.nodes.forEach(function (n) { if (n.type === 'media') fill(n); });
    claimed = claim() || claimed;
    if (G.open && !node(G.open)) G.open = null;
  }
  function choose(title, at, items) {                         // a small menu on the board
    var r = view.getBoundingClientRect();
    menuEl.textContent = ''; menuEl.appendChild(el('h4', { text: title }));
    items.forEach(function (it) {
      menuEl.appendChild(el('button', { type: 'button', class: it.hot ? 'hot' : null, disabled: it.off ? '' : null, onclick: function () { hideMenu(); it.on(); } },
        [el('span', { class: 'fn-ic', html: svg(it.icon || I.spark) }), el('span', { class: 'tx' }, [el('b', { text: it.t }), el('span', { text: it.d || '' })]), it.hot ? el('em', { text: 'Suggested' }) : null]));
    });
    menuEl.hidden = false;
    menuEl.style.left = clamp(at.x * V.k + V.x, 12, r.width - menuEl.offsetWidth - 12) + 'px';
    menuEl.style.top = clamp(at.y * V.k + V.y - 40, 12, r.height - menuEl.offsetHeight - 12) + 'px';
  }
  function remake(subject, person) {                          // "make this, with this person": a What to make node fed by both
    if (person) { var pa = P().assets[person.d.asset]; if (pa && pa.kind === 'image') person.d.as = 'creator'; fill(person); }
    var sa = P().assets[subject.d.asset]; if (sa && sa.kind === 'image') subject.d.as = 'subject'; fill(subject);
    var x = Math.max(subject.x, person ? person.x : subject.x) + NW + GAP, y = person ? Math.round((subject.y + person.y) / 2) : subject.y;
    var n = addNode('format', x, y, subject.id);
    if (person) G.wires.push({ from: person.id, to: n.id });
    keep(); open(n.id);
  }
  function avatarNode(near) {                                 // the person's avatar as a node, added beside `near` if it is not on the canvas yet
    var id = P().avatar; if (!id || !P().assets[id]) return null;
    return mediaNode(id) || addMedia(id, near.x, near.y + NH + 44);
  }
  function link(a, b) {                                       // two things were wired together: what does that mean?
    var p = P(), A = a.type === 'media' ? p.assets[a.d.asset] : null, B = b.type === 'media' ? p.assets[b.d.asset] : null;
    var at = { x: (a.x + b.x) / 2 + NW / 2, y: (a.y + b.y) / 2 + NH / 2 };
    if (a.type === 'final') { say('The final video is the end of the line. Export it from its panel.'); return true; }
    if (b.type === 'final') {
      if (!A) { say('Only clips and sounds go into the final video. A Film node makes a clip; wire that in.'); return true; }
      if (A.reference) { choose('This is another creator\'s video', at, [
        { t: 'Remake it with my avatar', d: 'Film your own version, then use that.', icon: I.point, hot: true, off: !p.avatar, on: function () { remake(a, avatarNode(a)); } },
        { t: 'Remake it with no one on camera', d: 'Product shots only.', icon: I.bag, on: function () { remake(a, null); } }]);
        say('A selling video is here to work from. It cannot go into your video as it is.'); return true; }
      if (A.kind === 'image') { say('A picture does not play by itself. Wire it into "What to make" and film it.'); return true; }
      S.cut.add(A.id); return true;
    }
    if (!A || !B) return false;                               // a media node into a workflow node: an ordinary wire
    var vid = function (x) { return x.kind === 'video'; }, own = function (x) { return x.kind === 'video' && !x.reference; }, items = [];
    if ((vid(A) && B.kind === 'image') || (A.kind === 'image' && vid(B))) {
      var sub = vid(A) ? a : b, per = vid(A) ? b : a, ref = p.assets[sub.d.asset].reference;
      items.push({ t: ref ? 'Remake this video with this person' : 'Film this person, working from this clip', d: 'A new script, a new shot, their face.', icon: I.point, hot: true, on: function () { remake(sub, per); } });
    }
    if (A.kind === 'image' && B.kind === 'image') items.push({ t: 'Film this person with this product', d: 'The first is who, the second is what.', icon: I.point, hot: true, on: function () { remake(b, a); } });
    if (own(A) && own(B)) {
      items.push({ t: 'Play one after the other', d: 'Both go into the final video, in this order.', icon: I.film, hot: true, on: function () { S.cut.add(A.id); S.cut.add(B.id); } });
      items.push({ t: 'Put them side by side', d: 'Ember builds one clip from the two.', icon: I.spark, on: function () { S.send('Put "' + A.name + '" on the left and "' + B.name + '" on the right as one side by side clip, and add it to the video.'); } });
      items.push({ t: 'Stack one above the other', d: 'Ember builds one clip from the two.', icon: I.spark, on: function () { S.send('Stack "' + A.name + '" above "' + B.name + '" as one clip, and add it to the video.'); } });
    }
    if ((A.kind === 'audio' && own(B)) || (own(A) && B.kind === 'audio')) {
      var snd = A.kind === 'audio' ? A : B, clip = A.kind === 'audio' ? B : A;
      items.push({ t: 'Use this sound as the voice of this clip', d: 'The clip\'s own sound is muted.', icon: I.mic, hot: true, on: function () {
        if (!inCut(clip.id)) S.cut.add(clip.id);
        say('Laying the voice over the clip.');
        sse('flow_voice', { asset: clip.id, voice: { kind: 'own', asset: snd.id }, line: '' }, function () {}).catch(function () {}).then(function () { say('The voice is on the clip.'); });
      } });
    }
    items.push({ t: 'Ask Ember about these two', d: 'Say what you want done with them.', icon: I.spark, on: function () { S.ask('With "' + A.name + '" and "' + B.name + '": '); } });
    choose('What should these two make?', at, items);
    return true;
  }
  function place(asset, cx, cy) {                             // put a file on the canvas where it was dropped
    sync();
    var n = mediaNode(asset) || addMedia(asset, 0, 0), w = toWorld(cx, cy), at;
    n.x = -99999; at = freeSpot(Math.round(w.x - NW / 2), Math.round(w.y - NH / 2)); n.x = at.x; n.y = at.y;
    keep(); draw(); return n;
  }

  function begin(n) {                                         // dropped on empty board and left unwired: the start of a new workflow
    if (outs(n.id).length) return void open(n.id);            // it already feeds something; just show it
    var p = P(), a = p.assets[n.d.asset];
    var go = function () {
      var rules = may(n), next = ORDER.filter(function (t) { return !rules[t]; })[0];
      if (!next) return void open(n.id);
      keep(); open(addNode(next, n.x + NW + GAP, n.y, n.id).id);
    };
    if (a && a.kind === 'image' && a.id !== p.avatar && a.source !== 'product' && !n.d.as && !ins(n.id).length) {   // a picture can be either: ask, do not guess
      open(n.id);
      return void choose('What is this picture?', { x: n.x + NW + 30, y: n.y + NH / 2 }, [
        { t: 'The person on camera', d: 'You, or a creator you have the rights to.', icon: I.person, hot: !p.avatar, on: function () { n.d.as = 'creator'; fill(n); go(); } },
        { t: 'The product', d: 'What the video is about.', icon: I.bag, hot: !!p.avatar, on: function () { n.d.as = 'subject'; fill(n); go(); } }]);
    }
    go();
  }
  /* ---------- guided: one step at a time ---------- */
  var toast = el('div', { class: 'flow-toast', role: 'status', hidden: '' }), toastT = 0;
  view.appendChild(toast);
  function current() {                                        // guided: the step being worked on (open and unfinished, else the first unfinished)
    if (!G.guided) return null;
    var waiting = function (n) { return n && n.type !== 'media' && n.type !== 'final' && !isDone(n) && !(n.type === 'film' && n.d.film && n.d.film.state === 'run'); }, on = G.open && node(G.open);   // a step that is filming is not waiting for the person
    if (waiting(on)) return on;
    return G.nodes.filter(waiting).sort(function (x, y) { return ORDER.indexOf(x.type) - ORDER.indexOf(y.type); })[0] || null;
  }
  function stop(n, text) {                                    // not now: say why, where they are looking, and point at the step that is waiting
    if (n && G.open !== n.id) open(n.id);
    say(text);
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { toast.hidden = true; }, 6500);
    var e = n && els[n.id];
    if (e) { e.classList.remove('nudge'); void e.offsetWidth; e.classList.add('nudge'); setTimeout(function () { e.classList.remove('nudge'); }, 1300); }
  }
  function offer(asset) {                                     // guided: a file arrived while a step is waiting. The step takes it, or says where it belongs.
    var cur = current(), p = P(), a = p.assets[asset]; if (!cur || !a) return false;
    if (cur.type === 'subject') {
      if (a.id === p.avatar) return stop(cur, 'That is your avatar. It comes in at step 2, who is on camera. First choose what the video is about.'), true;
      if (a.kind === 'audio') return stop(cur, 'A sound comes in at step 5, the voice. First choose what the video is about.'), true;
      cur.d.subject = { kind: a.reference ? 'reference' : 'asset', asset: a.id, title: (a.meta && a.meta.product) || a.name, poster: thumb(a), price: a.meta && a.meta.price };
    } else if (cur.type === 'creator') {
      if (a.kind !== 'image' || a.reference) return stop(cur, 'Step 2 needs a picture of the person on camera. ' + (a.kind === 'audio' ? 'A sound comes in at step 5, the voice.' : 'A clip cannot stand in for them.')), true;
      cur.d.creator = { kind: 'avatar', asset: a.id, title: a.name, poster: a.url };
    } else if (cur.type === 'voice') {
      if (a.kind !== 'audio') return stop(cur, 'Step 5 takes a sound: a recording of the voice. Pictures and clips do not go here.'), true;
      cur.d.voice = { kind: 'own', asset: a.id, title: 'My own voice' };
    } else {
      return stop(cur, 'Step ' + (ORDER.indexOf(cur.type) + 1) + ', ' + T[cur.type].title.toLowerCase() + ', does not take files. Finish it first. Your file is saved in your media.'), true;
    }
    toast.hidden = true; changed(cur); complete(cur);          // the step is answered: on to the next one
    return true;
  }
  function dropHint() {                                       // what a drop on the board will do right now
    var cur = current();
    return !cur ? 'Drop to put it on the canvas'
      : cur.type === 'subject' ? 'Drop it here: it becomes what the video is about'
      : cur.type === 'creator' ? 'Drop a picture here: it becomes who is on camera'
      : cur.type === 'voice' ? 'Drop a sound here: it becomes the voice'
      : 'This step does not take files. It will be saved in your media';
  }
  function dropped(asset, cx, cy, onto) {                     // a file or a rail item landed on the board
    sync();
    var a = P().assets[asset], h = a && !mediaNode(asset) && holder(a), target = onto && node(onto), n;
    if (h) { keep(); draw(); if (G.guided) complete(h); else open(h.id); return h; }   // step one took it as its subject: carry on from there
    if (a && current()) { offer(asset); keep(); return null; }   // guided, and a step is waiting: it decides
    if (target && !(target.type === 'media' && target.d.asset === asset)) {   // dropped onto a node: wire it into that node
      n = mediaNode(asset) || addMedia(asset, target.x - NW - GAP, target.y);
      keep(); draw(); connect(n, target); return n;
    }
    n = place(asset, cx, cy); begin(n); return n;
  }

  function lay(plan) {                                        // Ember chose every step: they go on the board filled in, and it stops before filming
    if (!plan || !plan.subject || root.hidden) return;
    if (filming()) return void stop(filming(), 'Ember set up a new video, but a clip is still being filmed. Ask again when it is done.');
    sync();
    var p = P(), s = plan.subject, subj, a = s.asset && p.assets[s.asset];
    if (s.kind === 'idea') subj = { kind: 'idea', text: s.text, title: s.text };
    else if (a) subj = { kind: a.reference ? 'reference' : 'asset', asset: a.id, title: (a.meta && a.meta.product) || a.name, poster: thumb(a), price: a.meta && a.meta.price };
    else return;
    var n = (a && holder(a)) || G.nodes.filter(function (m) { return m.type === 'subject' && !m.d.subject; })[0];
    if (!n) n = addNode('subject', 0, Math.max.apply(null, G.nodes.map(function (m) { return m.y; })) + NH + 90);
    n.d.subject = subj; delete n.d.via;
    if (!plan.creator || plan.creator.kind === 'ask') { changed(n); G.lead = null; keep(); draw(); return void complete(n); }   // only the subject was set: the person chooses the rest, step by step
    var step = function (type, fillIn) {                      // the next step along this chain: the one already there, or a new one
      var m = outs(n.id).filter(function (x) { return x.type === type; })[0] || addNode(type, n.x + NW + GAP, n.y, n.id);
      fillIn(m.d); n = m; return m;
    };
    var c = plan.creator || { kind: 'none' }, av = c.kind === 'avatar' && p.assets[c.asset];
    step('creator', function (d) { d.creator = av ? { kind: 'avatar', asset: av.id, title: av.name, poster: av.url } : c.kind === 'describe' ? { kind: 'describe', text: c.text } : { kind: 'none' }; });
    step('format', function (d) { d.make = plan.make || 'clip'; d.seconds = plan.seconds || 8; d.ok = true; if (d.make === 'free') d.idea = s.text || subj.title; });
    var words = step('script', function (d) { d.script = null; d.ok = false; });
    delete scriptErr[words.id];
    if (plan.voice) step('voice', function (d) { d.voice = plan.voice; d.mode = plan.voice.kind; });
    step('film', function (d) { d.film = null; });
    G.lead = null; keep(); draw(); open(words.id); fit();     // the script is written here now; they read it, then Film shows the price
  }

  function freeSpot(x, y) {
    var hit = function () { return G.nodes.some(function (n) { return Math.abs(n.x - x) < NW + 30 && Math.abs(n.y - y) < NH + 24; }); };
    while (hit()) y += NH + 44;
    return { x: x, y: y };
  }
  function addNode(type, x, y, from, to) {
    var fin = finalNode();                                     // the final video makes room: a new step never lands under or on it
    if (fin && Math.abs(fin.x - x) < NW + 30 && Math.abs(fin.y - y) < NH + 24) { fin.x = x + NW + GAP; while (G.nodes.some(function (m) { return m !== fin && Math.abs(m.x - fin.x) < NW + 30 && Math.abs(m.y - fin.y) < NH + 24; })) fin.x += NW + GAP; }
    var at = freeSpot(x, y), n = mk(type, at.x, at.y);
    G.nodes.push(n);
    if (from) G.wires.push({ from: from, to: n.id });
    if (to) { G.wires.push({ from: n.id, to: to }); clear(node(to), true); changed(node(to)); }
    return n;
  }
  /* ---------- the rules: what may follow what ---------- */
  var IDX = {}; ORDER.forEach(function (t, i) { IDX[t] = i; });
  function called(n) { var a = n.type === 'media' && P().assets[n.d.asset], s = n.type !== 'media' && summary(n); return String(a ? a.name : s ? s.t : T[n.type].title).slice(0, 40); }
  function may(from) {                                        // every step, and why it cannot come next after `from` ('' when it can)
    var c = from ? ctx(from.id) : {}, out = {};
    ORDER.forEach(function (t) {
      out[t] = from && from.type === 'final' ? 'Nothing follows the final video.'
        : c[t] ? 'Already set: ' + called(c[t])
        : !from && t !== 'subject' && t !== 'creator' ? 'Starts from a subject or a person.'
        : (t === 'subject' || t === 'creator') && c.format ? 'Goes before "What to make".'
        : t === 'format' && !c.subject ? 'Needs a subject first.'
        : t === 'script' && !c.format ? 'Needs "What to make" first.'
        : (t === 'voice' || t === 'film') && !c.script ? 'Needs the script first.'
        : t === 'voice' && c.film ? 'Goes before filming.'
        : t === 'voice' && c.script.d.script && !c.script.d.script.line ? 'Nobody speaks in this video.' : '';
    });
    return out;
  }
  function answers(a, b) {                                    // a file wired into the step it answers: a picture or clip is the subject, a picture is the person, a sound is the voice
    var A = a.type === 'media' && P().assets[a.d.asset]; if (!A) return false;
    return (b.type === 'subject' && A.kind !== 'audio' && a.d.role !== 'creator') || (b.type === 'creator' && A.kind === 'image') || (b.type === 'voice' && A.kind === 'audio');
  }
  function wireRule(a, b) {                                   // why this wire is not allowed ('' when it is)
    if (a.type === 'final' || b.type === 'final') return '';  // link() speaks for the final video
    if (b.type === 'media') return a.type === 'media' ? '' : 'A file is a starting point. Drag from the file into a step, not from a step into the file.';
    if (answers(a, b)) return isDone(b) ? '"' + T[b.type].title + '" is already answered (' + called(b) + '). Change it in its panel, or delete that step first.' : '';
    var ka = a.type === 'media' ? a.d.role : a.type;
    if (IDX[ka] >= IDX[b.type] && !(ka === 'creator' && b.type === 'subject'))
      return 'Steps run in order: ' + ORDER.map(function (t) { return T[t].title.toLowerCase(); }).join(', ') + '. That wire would go backwards.';
    var ca = ctx(a.id), cb = ctx(b.id), dup = ORDER.filter(function (t) { return ca[t] && cb[t] && ca[t].id !== cb[t].id; })[0];
    if (dup) return 'That step already has "' + T[dup].title.toLowerCase() + '" (' + called(cb[dup]) + '). Unwire it first.';
    return '';
  }
  function take(a, b) {                                       // the step takes the file as its answer
    var A = P().assets[a.d.asset];
    if (b.type === 'subject') { if (A.kind === 'image') a.d.as = 'subject'; b.d.subject = { kind: A.reference ? 'reference' : 'asset', asset: A.id, title: (A.meta && A.meta.product) || A.name, poster: thumb(A), price: A.meta && A.meta.price, from: a.id }; }
    else if (b.type === 'creator') a.d.as = 'creator';         // claim() fills the step from it
    else b.d.voice = { kind: 'own', asset: A.id, title: 'My own voice', from: a.id };
  }

  function connect(a, b) {
    if (a.id === b.id || G.wires.some(function (w) { return w.from === a.id && w.to === b.id; })) return;
    if (b.id === a.id || below(b.id).some(function (m) { return m.id === a.id; })) return void say('That would make a loop. A wire has to lead forward.');
    var no = filming(b) ? 'That step is being filmed right now. Wire it after the render ends.' : wireRule(a, b); if (no) return void say(no);
    if (link(a, b)) return;
    if (answers(a, b)) take(a, b);
    G.wires.push({ from: a.id, to: b.id }); clear(b, true); changed(b);
    G.nodes.forEach(function (n) { if (n.type === 'media') fill(n); });
    var got = claim(); keep(); draw();
    var ans = b.type === 'creator' ? b.d.creator : b.type === 'subject' ? b.d.subject : b.type === 'voice' ? b.d.voice : null;
    if (ans && ans.from === a.id) return void (G.guided ? complete(b) : open(b.id));   // the file answered that step: carry on
    if (got && G.guided) return void complete(got);
    renderPanel();
  }
  function removeNode(n) {
    if (G.nodes.length < 2 || n.type === 'final') return;
    if (filming(n)) return void stop(filming(n), 'This is being filmed right now. Stop the render in "Film it" first, or wait for it to finish.');
    if (n.d.via) S.chatPoint(false, null, true);            // it was being answered by typing: the field goes back to normal chat
    if (n.type === 'media' && inCut(n.d.asset)) S.cut.remove(n.d.asset);        // off the canvas means out of the video
    outs(n.id).forEach(function (m) { clear(m, true); changed(m); });
    G.nodes = G.nodes.filter(function (m) { return m.id !== n.id; });
    G.wires = G.wires.filter(function (w) { return w.from !== n.id && w.to !== n.id; });
    if (G.open === n.id) G.open = null;
    keep(); draw(); renderPanel();
  }

  /* ---------- small helpers ---------- */
  function rate() { return Number(S.status().rate) || 0.04; }
  function cost(sec) { return Math.round(sec * rate() * 100) / 100; }
  function money(v) { return '$' + Number(v).toFixed(2); }
  function thumb(a) { return a ? (a.poster_url || (a.kind === 'image' ? a.url : '')) : ''; }
  function short(x) { x = Number(x) || 0; return x >= 1e6 ? (x / 1e6).toFixed(1).replace('.0', '') + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(x); }
  function say(text) { var p = $('#flow-say'); if (p.textContent === text) return; var q = el('p', { id: 'flow-say', text: text }); p.parentNode.replaceChild(q, p); }
  function sse(name, args, on) {
    if (S.acting && S.acting()) {                            // one job at a time: Ember is mid-turn, so the board waits
      on({ type: 'error', message: 'Ember is working on something. Try again when it is done.' });
      return Promise.resolve();
    }
    return fetch('/api/action', { method: 'POST', headers: S.headers(true), body: JSON.stringify({ name: name, args: args }) }).then(function (r) {
      if (!r.ok || !r.body) throw new Error('The studio did not answer.');
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      var pump = function () {
        return reader.read().then(function (res) {
          if (res.done) return;
          buf += dec.decode(res.value, { stream: true });
          var parts = buf.split('\n\n'); buf = parts.pop();
          parts.forEach(function (chunk) {
            chunk.split('\n').forEach(function (line) {
              if (line.indexOf('data: ') !== 0) return;
              var ev; try { ev = JSON.parse(line.slice(6)); } catch (e) { return; }
              if (ev.type === 'project') S.setProject(ev.project);
              on(ev);
            });
          });
          return pump();
        });
      };
      return pump();
    });
  }
  function upload(file, voice) {
    var fd = new FormData(); fd.append('file', file, file.name || 'My voice.webm');
    return api('/api/upload' + (voice ? '?voice=1' : ''), { method: 'POST', body: fd }).then(function (r) { S.setProject(r.project); return r.asset; });
  }
  function seg(items, value, on) {
    return el('div', { class: 'f-seg', role: 'group' }, items.map(function (it) {
      return el('button', { type: 'button', 'aria-pressed': String(it[0] === value), text: it[1], onclick: function () { on(it[0]); } });
    }));
  }
  function card(img, title, sub, chip, picked, on, square) {
    var im = el('span', { class: 'im' }); if (img) im.style.backgroundImage = 'url("' + img + '")';
    return el('button', { type: 'button', class: 'f-card' + (square ? ' sq' : '') + (picked ? ' picked' : ''), onclick: on }, [
      im, chip ? el('span', { class: 'chip', text: chip }) : null, el('span', { class: 'use', text: 'Use this' }),
      el('span', { class: 'ov' }, [el('b', { text: title }), sub ? el('span', { text: sub }) : null])
    ]);
  }
  function dropzone(text, small, accept, on, voice) {
    var inp = el('input', { type: 'file', accept: accept, hidden: '' }), label = el('span', { text: text });
    var zone = el('label', { class: 'f-drop', html: svg(I.up, 24) }, [label, el('small', { text: small }), inp]);
    var take = function (file) { if (!file) return; label.textContent = 'Uploading ' + file.name; upload(file, voice).then(on).catch(function (e) { label.textContent = 'Could not upload that. ' + e.message; }); };
    inp.addEventListener('change', function () { take(inp.files[0]); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); zone.classList.remove('over'); take(e.dataTransfer.files[0]); });
    return zone;
  }

  /* ---------- the board: pan, zoom, nodes, wires ---------- */
  var els = {}, NS = 'http://www.w3.org/2000/svg';
  function apply(glide) {
    world.classList.toggle('glide', !!glide);
    world.style.transform = 'translate(' + V.x.toFixed(1) + 'px,' + V.y.toFixed(1) + 'px) scale(' + V.k.toFixed(3) + ')';
    view.style.backgroundSize = (26 * V.k).toFixed(1) + 'px ' + (26 * V.k).toFixed(1) + 'px';
    view.style.backgroundPosition = V.x.toFixed(1) + 'px ' + V.y.toFixed(1) + 'px';
    $('#flow-pct').textContent = Math.round(V.k * 100) + '%';
  }
  function room() {                                          // the part of the board not covered by the open panel
    var r = view.getBoundingClientRect(), phone = window.innerWidth <= 760, pw = !panel.hidden && !phone && !docked ? panel.offsetWidth + 24 : 0;
    if (r.width - pw < NW + 40) pw = 0;                        // the panel covers nearly the whole board (a narrow window): centre on the board itself
    return { w: r.width - pw, h: phone && !panel.hidden ? r.height * 0.42 : r.height, left: r.left, top: r.top };
  }
  function toWorld(cx, cy) { var r = view.getBoundingClientRect(); return { x: (cx - r.left - V.x) / V.k, y: (cy - r.top - V.y) / V.k }; }
  function focusOn(n) { var r = room(); V.x = r.w / 2 - (n.x + NW / 2) * V.k; V.y = r.h / 2 - (n.y + NH / 2) * V.k; apply(true); keep(); }
  function fit() {
    var seen = G.nodes.filter(function (n) { return n.type !== 'final' || finalShown(); }); if (!seen.length) seen = G.nodes;
    var r = room(), xs = seen.map(function (n) { return n.x; }), ys = seen.map(function (n) { return n.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs) + NW, y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys) + NH;
    V.k = clamp(Math.min((r.w - 96) / (x1 - x0), (r.h - 96) / (y1 - y0)), 0.05, 1.15);   // as small as it takes: Fit always shows every node
    V.x = r.w / 2 - (x0 + x1) / 2 * V.k; V.y = r.h / 2 - (y0 + y1) / 2 * V.k; apply(true); keep();
  }
  function zoomAt(cx, cy, k) {
    var r = view.getBoundingClientRect(), px = cx - r.left, py = cy - r.top; k = clamp(k, 0.1, 1.6);
    V.x = px - (px - V.x) * (k / V.k); V.y = py - (py - V.y) * (k / V.k); V.k = k; apply(false); keep();
  }
  function curve(x1, y1, x2, y2) { var d = Math.max(46, Math.abs(x2 - x1) / 2); return 'M' + x1 + ' ' + y1 + ' C' + (x1 + d) + ' ' + y1 + ' ' + (x2 - d) + ' ' + y2 + ' ' + x2 + ' ' + y2; }
  function sv(tag, attrs) { var n = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; }
  function drawWires() {
    wiresEl.textContent = '';
    G.wires.forEach(function (w, i) {
      var a = node(w.from), b = node(w.to); if (!a || !b) return;
      var d = curve(a.x + NW, a.y + NH / 2, b.x, b.y + NH / 2);
      wiresEl.appendChild(sv('path', { 'class': 'gw' + (isDone(a) ? ' on' : ''), d: d }));
      var hit = sv('path', { 'class': 'gw-hit', d: d, 'data-w': i }); hit.appendChild(sv('title', {})).textContent = 'Double-click to remove this wire';
      wiresEl.appendChild(hit);
      if (b.id === G.open && isDone(a)) {                     // an ember rides the wire into the node you are on
        var dot = sv('circle', { 'class': 'gw-ember', r: 4.5 }), mo = sv('animateMotion', { dur: '1.7s', repeatCount: 'indefinite', path: d });
        dot.appendChild(mo); wiresEl.appendChild(dot);
      }
    });
    var fin = finalNode();
    if (fin && finalShown()) G.nodes.forEach(function (n) {   // a clip being filmed is on its way to the final video: the wire shows before the clip exists
      if (n.type !== 'film' || !n.d.film || n.d.film.state !== 'run') return;
      var d = curve(n.x + NW, n.y + NH / 2, fin.x, fin.y + NH / 2);
      wiresEl.appendChild(sv('path', { 'class': 'gw soon', d: d }));
      var dot = sv('circle', { 'class': 'gw-ember', r: 4.5 }); dot.appendChild(sv('animateMotion', { dur: '2.2s', repeatCount: 'indefinite', path: d })); wiresEl.appendChild(dot);
    });
  }
  wiresEl.addEventListener('dblclick', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-w'); if (i === null || i === undefined) return;
    var w = G.wires[Number(i)], b = w && node(w.to); if (!w) return;
    var from = node(w.from); if (b && b.type === 'final' && from && from.type === 'media') return void S.cut.remove(from.d.asset);   // unwired from Final: out of the video
    G.wires.splice(Number(i), 1); if (b) { clear(b, true); changed(b); }
    keep(); draw(); renderPanel();
  });
  function summary(n) {
    var d = n.d, t = '', s = '', img = '', c;
    if (n.type === 'subject' && d.subject) { t = d.subject.title || 'An idea'; img = d.subject.poster || ''; s = d.subject.kind === 'shop' ? (d.subject.price ? money(d.subject.price) + ' · ' : '') + 'TikTok Shop' : d.subject.kind === 'asset' ? 'Your own' : 'An idea'; }
    if (n.type === 'creator' && d.creator) { t = d.creator.kind === 'none' ? 'No one on camera' : d.creator.kind === 'describe' ? d.creator.text : (d.creator.title || 'My avatar'); img = d.creator.poster || ''; s = d.creator.kind === 'avatar' ? 'Your creator' : d.creator.kind === 'describe' ? 'Described' : 'Product only'; }
    if (n.type === 'format' && d.make === 'asis') { t = 'Use it as it is'; s = 'No filming'; }
    else if (n.type === 'format' && d.make) { t = MAKES.filter(function (x) { return x.id === d.make; })[0].t; s = d.seconds + ' seconds · ' + money(cost(d.seconds)); }
    if (n.type === 'script' && d.script) { t = d.script.line ? '"' + d.script.line + '"' : d.script.shot; s = d.script.line ? d.script.line.split(/\s+/).length + ' words' : 'No speech'; }
    if (n.type === 'voice' && d.voice) { t = d.voice.kind === 'model' ? 'The presenter speaks' : d.voice.kind === 'fish' ? d.voice.title : 'My own voice'; s = d.voice.kind === 'model' ? 'Lips match' : 'Voiceover'; }
    if (n.type === 'film' && d.film) { c = ctx(n.id); t = d.film.state === 'done' ? 'Filmed' : d.film.state === 'run' ? 'Filming now' : 'Did not finish'; s = d.film.state === 'done' ? 'In your final video' : d.film.state === 'run' ? 'A few minutes' : 'Open to try again'; img = d.film.state === 'done' && has(d.film.asset) ? thumb(P().assets[d.film.asset]) : ''; }
    return t ? { t: t, s: s, img: img } : null;
  }
  function build(n) {
    var e = el('div', { class: 'gn', 'data-id': n.id }, [
      el('i', { class: 'gp in' }),
      el('div', { class: 'gn-h' }, [el('span', { class: 'fn-ic' }), el('div', { class: 'fn-t' }, [el('small'), el('b')]),
        el('button', { type: 'button', class: 'gn-x', title: 'Remove this node', 'aria-label': 'Remove this node', html: svg(I.x), onclick: function (ev) { ev.stopPropagation(); removeNode(node(n.id)); } })]),
      el('div', { class: 'gn-s' }),
      el('button', { type: 'button', class: 'gp out', title: 'Drag a line out to add the next step', 'aria-label': 'Add the next step', text: '+' })
    ]);
    e.addEventListener('pointerdown', function (ev) {
      if (ev.button || ev.target.closest('.gn-x')) return;
      ev.stopPropagation(); hideMenu();
      var me = node(n.id), x0 = ev.clientX, y0 = ev.clientY, ox = me.x, oy = me.y, port = !!ev.target.closest('.gp.out'), moved = false, tmp = null;
      if (ev.shiftKey && !port) { if (SEL[me.id]) delete SEL[me.id]; else SEL[me.id] = 1; markSel(); return; }   // shift-click adds to, or takes from, the selection
      if (!SEL[me.id]) clearSel();
      var orig = (SEL[me.id] ? G.nodes.filter(function (m) { return SEL[m.id]; }) : [me]).map(function (m) { return { n: m, x: m.x, y: m.y }; });
      if (port) { tmp = sv('path', { 'class': 'gw temp' }); wiresEl.appendChild(tmp); }
      var move = function (mv) {
        if (!moved && Math.abs(mv.clientX - x0) + Math.abs(mv.clientY - y0) < 5) return;
        moved = true;
        if (port) { var w = toWorld(mv.clientX, mv.clientY); tmp.setAttribute('d', curve(me.x + NW, me.y + NH / 2, w.x, w.y)); return; }
        e.classList.add('drag');
        orig.forEach(function (o) {                           // everything selected moves together
          o.n.x = Math.round(o.x + (mv.clientX - x0) / V.k); o.n.y = Math.round(o.y + (mv.clientY - y0) / V.k);
          var oe = els[o.n.id]; if (oe) { oe.style.left = o.n.x + 'px'; oe.style.top = o.n.y + 'px'; }
        });
        drawWires();
      };
      var up = function (u) {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        e.classList.remove('drag'); if (tmp) tmp.remove();
        if (port) {
          var hit = document.elementFromPoint(u.clientX, u.clientY), box = hit && hit.closest ? hit.closest('.gn') : null, t = box && node(box.getAttribute('data-id'));
          if (moved && t && t.id !== me.id) connect(me, t);
          else showMenu(me, moved ? toWorld(u.clientX, u.clientY) : { x: me.x + NW + GAP, y: me.y + NH / 2 });
        } else if (moved) keep();
        else { peek = me.id; open(me.id); }                   // they opened it themselves: it may stay open even if finished
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    return e;
  }
  function paint(n, e) {
    if (n.type === 'media' || n.type === 'final') return void paintMedia(n, e);
    var m = T[n.type], done = isDone(n), need = needs(n), sum = summary(n), box = e.querySelector('.gn-s');
    var cur = !G.open && current(), wait = !!cur && cur.id === n.id;   // nothing is open: the step that is waiting asks to be clicked
    var chatty = (n.type === 'subject' || n.type === 'creator') && n.d.via === 'chat' && !done;   // this step is being answered in the chat
    e.className = 'gn ' + n.type + (done ? ' done' : '') + (n.id === G.open ? ' open' : '') + (wait ? ' next' : '') + (chatty ? ' chatty' : '') + (need.length ? ' need' : '') + (e.classList.contains('new') ? ' new' : '') +
      (n.type === 'film' && n.d.film && n.d.film.state === 'run' ? ' busy' : '');
    e.style.left = n.x + 'px'; e.style.top = n.y + 'px';
    var ic = e.querySelector('.fn-ic'), pic = done && sum && sum.img;   // a finished step shows what was chosen: its picture and its name
    ic.classList.toggle('pic', !!pic); ic.style.backgroundImage = pic ? 'url("' + sum.img + '")' : ''; ic.innerHTML = pic ? '' : svg(m.icon);
    e.querySelector('b').textContent = done && sum ? sum.t : chatty ? (n.type === 'creator' ? 'Describing who is on camera' : 'Typing what it is about') : done || sum ? m.title : m.ask;
    e.querySelector('.fn-t small').textContent = done ? m.title : chatty ? 'Chat' : need.length ? 'Waiting' : n.id === G.open ? 'Now' : wait ? (n.type === 'subject' ? 'Start here' : 'Next') : 'To do';
    e.title = done && sum ? m.title + ': ' + sum.t : '';
    box.textContent = '';
    if (done) return;                                        // a finished node says so with its green border, nothing more
    if (sum) { var th = el('span', { class: 'th', html: sum.img ? '' : svg(m.icon) }); if (sum.img) th.style.backgroundImage = 'url("' + sum.img + '")'; box.appendChild(th); box.appendChild(el('div', {}, [el('b', { text: sum.t }), el('span', { text: sum.s })])); }
    else box.appendChild(el('p', { text: need.length ? 'Needs ' + need.map(function (x) { return T[x.type].title.toLowerCase(); }).join(' and ') + ' first.' : chatty ? 'Type in the box at the bottom of the board.' : m.hint }));
  }
  function paintMedia(n, e) {
    var p = P(), ic = e.querySelector('.fn-ic'), small = e.querySelector('.fn-t small'), b = e.querySelector('.fn-t b'), box = e.querySelector('.gn-s');
    e.style.left = n.x + 'px'; e.style.top = n.y + 'px'; box.textContent = '';
    var cls = 'gn ' + n.type + (n.id === G.open ? ' open' : '') + (e.classList.contains('new') ? ' new' : '') + (e.classList.contains('acting') ? ' acting' : '');
    if (n.type === 'final') {
      e.hidden = !finalShown();
      var clips = p.tracks.video.length;
      e.className = cls + (clips ? ' has' : ''); ic.style.backgroundImage = ''; ic.innerHTML = svg(I.play);
      var filming = !clips && G.nodes.some(function (m) { return m.type === 'film' && m.d.film && m.d.film.state === 'run'; });
      small.textContent = 'Final video'; b.textContent = clips ? 'Your video' : filming ? 'Waiting for your clip' : 'Nothing wired in yet';
      box.appendChild(el('p', { text: clips ? clips + ' clip' + (clips === 1 ? '' : 's') + ' · ' + S.fmt(p.duration) + (p.tracks.captions.length ? ' · captions' : '') : filming ? 'It lands here as soon as filming ends.' : 'Wire a clip into this node.' }));
      return;
    }
    var a = p.assets[n.d.asset]; if (!a) return;
    var th = thumb(a), cut = inCut(a.id);
    e.className = cls + ' ' + a.kind + (cut ? ' incut' : '') + (a.reference ? ' ref' : '');
    ic.style.backgroundImage = th ? 'url("' + th + '")' : ''; ic.innerHTML = th ? '' : svg(a.kind === 'audio' ? I.mic : I.film);
    small.textContent = a.id === p.avatar ? 'My avatar' : a.reference ? 'Selling video' : a.kind === 'image' ? (n.d.role === 'creator' ? 'Person' : 'Picture') : a.kind === 'audio' ? 'Sound' : a.source === 'generated' ? 'Filmed clip' : 'Clip';
    b.textContent = a.name;
    box.appendChild(el('p', { text: (a.kind === 'image' ? '' : S.fmt(a.duration) + ' · ') + (cut ? 'In the video' : a.reference ? 'To work from' : 'Not in the video') }));
  }
  function draw() {
    var have = {};
    G.nodes.forEach(function (n) {
      have[n.id] = 1; var e = els[n.id];
      if (!e) { e = els[n.id] = build(n); e.classList.add('new'); world.appendChild(e); setTimeout(function () { e.classList.remove('new'); }, 700); }
      paint(n, e); e.classList.toggle('sel', !!SEL[n.id]);
    });
    Object.keys(els).forEach(function (id) { if (!have[id]) { els[id].remove(); delete els[id]; } });
    drawWires();
    var sw = $('#flow-guided'); sw.setAttribute('aria-checked', String(!!G.guided));
    var on = G.open && node(G.open), left = G.nodes.filter(function (n) { return n.type !== 'final' && !isDone(n); }).length;
    var cs = !on && current();
    $('#flow-step').textContent = on ? T[on.type].title : cs ? 'Step ' + (ORDER.indexOf(cs.type) + 1) + ' of 6' : left ? left + ' to do' : 'Your canvas';
    if (on) { var nd = needs(on); say(nd.length ? 'This one needs ' + nd.map(function (x) { return T[x.type].title.toLowerCase(); }).join(' and ') + ' first. Add it from here, or drag a wire into this node.' : guideFor(on)); }
    else {
      var cur = current();
      var clipsIn = P().tracks.video.length;
      say(!cur && clipsIn ? 'Your video has ' + clipsIn + (clipsIn === 1 ? ' clip' : ' clips') + '. Click Final video to play it, caption it and export it. Start over begins a new one.'
        : !cur ? 'Drag media in, wire nodes together, or tell Ember what to do. Drag on the empty board to select several nodes; hold Space and drag to move the board. Whatever is wired into Final video is your video.'
        : cur.type === 'subject' ? 'Step 1: click "What is the video about?" to pick a product, or drop a product picture on the canvas. Or tell Ember below and it sets the video up.'
        : 'Step ' + (ORDER.indexOf(cur.type) + 1) + ': click "' + T[cur.type].ask + '" to carry on.');
    }
  }
  function guideFor(n) {
    if (n.type === 'film' && n.d.film && n.d.film.state === 'done') return 'Filmed. The clip is wired into your final video.';
    if (n.type === 'film' && n.d.film && n.d.film.state === 'run') return 'Filming now. This takes a few minutes; you can leave this open.';
    if (n.type === 'media' || n.type === 'final') return T[n.type].say;
    if (isDone(n) && !G.guided) return 'Done. Drag a line out of its + to choose what comes next.';
    return T[n.type].say;
  }
  var peek = null;                                            // a finished step the person opened by hand
  function settle() {                                         // guided: a finished step's panel does not stay open by itself; the next waiting step takes over
    var on = G.guided && G.open && node(G.open);
    if (!on || on.type === 'media' || on.type === 'final' || on.type === 'film' || !isDone(on) || peek === on.id) return;
    complete(on);
    if (G.open === on.id) { G.open = null; keep(); draw(); renderPanel(); }   // nothing left to do after it: close
  }
  function open(id) { if (peek !== id) peek = null; G.open = id; hideMenu(); keep(); draw(); renderPanel(); var n = node(id); if (n) focusOn(n); }
  function complete(n) {                                     // a node has what it needs: lead on, or leave the next move to them
    if (n.d.via) { delete n.d.via; S.chatPoint(false, null, true); }   // it was being answered by typing and got answered another way: the field goes back to normal chat
    keep(); draw();
    if (!G.guided) return void renderPanel();
    var o = outs(n.id);
    if (o.length) {                                          // on to the next step that still needs something
      var nx = o[0], hop = 0;
      while (nx.type !== 'media' && nx.type !== 'final' && nx.type !== 'film' && isDone(nx) && outs(nx.id).length && hop++ < 12) nx = outs(nx.id)[0];
      return void open(nx.id);
    }
    var rules = may(n), next = ORDER.filter(function (t) { return !rules[t]; })[0];
    if (!next || n.type === 'film' || n.type === 'media' || n.type === 'final') return void renderPanel();
    open(addNode(next, n.x + NW + GAP, n.y, n.id).id);
  }

  /* ---------- the "what next" menu ---------- */
  function hideMenu() { menuEl.hidden = true; }
  function showMenu(from, at) {
    var c = from ? ctx(from.id) : {}, next = ORDER.filter(function (t) { return !c[t]; })[0], r = view.getBoundingClientRect();
    var fa = from && from.type === 'media' ? P().assets[from.d.asset] : null;
    menuEl.textContent = '';
    menuEl.appendChild(el('h4', { text: from ? 'What comes next?' : 'Add a node' }));
    var quick = function (icon, t, d, on) { menuEl.appendChild(el('button', { type: 'button', class: 'hot', onclick: function () { hideMenu(); on(); } }, [el('span', { class: 'fn-ic', html: svg(icon) }), el('span', { class: 'tx' }, [el('b', { text: t }), el('span', { text: d })])])); };
    if (fa && fa.kind !== 'image' && !fa.reference && !inCut(fa.id)) quick(I.play, 'Add to the final video', 'It plays after what is already there.', function () { S.cut.add(fa.id); });
    if (fa && fa.kind === 'video' && P().avatar) quick(I.point, fa.reference ? 'Remake it with my avatar' : 'Film my avatar from this clip', 'A new script and a new shot.', function () { remake(from, avatarNode(from)); });
    var rules = may(from); next = ORDER.filter(function (t) { return !rules[t]; })[0];
    ORDER.forEach(function (t) {
      menuEl.appendChild(el('button', { type: 'button', class: t === next && from ? 'hot' : null, disabled: rules[t] ? '' : null, title: rules[t] || null, onclick: function () {
        hideMenu(); var n = addNode(t, at.x, at.y - NH / 2, from ? from.id : null); keep(); open(n.id);
      } }, [el('span', { class: 'fn-ic', html: svg(T[t].icon) }), el('span', { class: 'tx' }, [el('b', { text: T[t].title }), el('span', { text: rules[t] || T[t].hint })]), t === next && from ? el('em', { text: 'Suggested' }) : null]));
    });
    menuEl.hidden = false;
    menuEl.style.left = clamp(at.x * V.k + V.x, 12, r.width - menuEl.offsetWidth - 12) + 'px';
    menuEl.style.top = clamp(at.y * V.k + V.y - 40, 12, r.height - menuEl.offsetHeight - 12) + 'px';
  }
  /* ---------- selecting several nodes, and moving the board ---------- */
  var SEL = {}, spaceDown = false;
  function selCount() { return Object.keys(SEL).length; }
  function markSel() { Object.keys(els).forEach(function (id) { els[id].classList.toggle('sel', !!SEL[id]); }); }
  function clearSel() { if (selCount()) { SEL = {}; markSel(); } }
  function idle(t) { var tag = t && t.tagName; return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || (t && t.isContentEditable)); }
  document.addEventListener('keydown', function (e) { if (e.code === 'Space' && !root.hidden && idle(e.target)) { spaceDown = true; view.classList.add('grab'); e.preventDefault(); } });
  document.addEventListener('keyup', function (e) { if (e.code === 'Space') { spaceDown = false; view.classList.remove('grab'); } });
  view.addEventListener('pointerdown', function (e) {        // drag on the empty board selects; hold Space (or the middle button) and drag to move the board
    if (e.target.closest('.gn, .flow-panel, .flow-menu, .flow-zoom, .flow-toast')) return;
    var x0 = e.clientX, y0 = e.clientY;
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault(); hideMenu();
      var vx = V.x, vy = V.y;
      view.classList.add('panning');
      var pan = function (m) { V.x = vx + m.clientX - x0; V.y = vy + m.clientY - y0; apply(false); };
      var done = function () { window.removeEventListener('pointermove', pan); window.removeEventListener('pointerup', done); view.classList.remove('panning'); keep(); };
      window.addEventListener('pointermove', pan); window.addEventListener('pointerup', done);
      return;
    }
    if (e.button) return;
    hideMenu();
    var r = view.getBoundingClientRect(), box = null, base = e.shiftKey ? Object.assign({}, SEL) : {};
    var move = function (m) {
      if (!box) { if (Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) < 5) return; box = el('div', { class: 'flow-marquee' }); view.appendChild(box); }
      var x = Math.min(x0, m.clientX), y = Math.min(y0, m.clientY), w = Math.abs(m.clientX - x0), h = Math.abs(m.clientY - y0);
      box.style.left = (x - r.left) + 'px'; box.style.top = (y - r.top) + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
      SEL = Object.assign({}, base);
      G.nodes.forEach(function (n) { var ne = els[n.id]; if (!ne || ne.hidden) return; var b = ne.getBoundingClientRect(); if (b.left < x + w && b.right > x && b.top < y + h && b.bottom > y) SEL[n.id] = 1; });
      markSel();
    };
    var up = function () {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (!box) return void (e.shiftKey ? 0 : clearSel());       // a plain click on the empty board lets go of the selection
      box.remove();
      var k = selCount(); if (k) say(k + ' selected. Drag one to move them together, press Backspace to take them off the board, Escape to let go.');
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  function tidy() {                                           // a clean left-to-right layout: each step one column on from what feeds it, each separate chain on its own rows
    var fin = finalNode(), depth = {}, STEP = NH + 46, COL = NW + GAP;
    var deep = function (n, seen) {
      if (depth[n.id] !== undefined) return depth[n.id];
      if (seen[n.id]) return 0; seen[n.id] = 1;
      var ps = ins(n.id), v = ps.length ? Math.max.apply(null, ps.map(function (p) { return deep(p, seen) + 1; })) : 0;
      depth[n.id] = v; return v;
    };
    G.nodes.forEach(function (n) { deep(n, {}); });
    var top = {}, find = function (id) { while (top[id] !== id) id = top[id]; return id; };
    G.nodes.forEach(function (n) { top[n.id] = n.id; });
    G.wires.forEach(function (w) { if (top[w.from] === undefined || top[w.to] === undefined) return; var a = find(w.from), b = find(w.to); if (a !== b) top[a] = b; });
    var groups = {}; G.nodes.forEach(function (n) { var k = find(n.id); (groups[k] = groups[k] || []).push(n); });
    var list = Object.keys(groups).map(function (k) { return groups[k]; }), minY = function (g) { return Math.min.apply(null, g.map(function (n) { return n.y; })); };
    if (fin && !ins(fin.id).length && list.length > 1) {      // a final video with nothing wired in closes the first chain
      list = list.filter(function (g) { return g.indexOf(fin) < 0; });
      list.sort(function (A, B) { return minY(A) - minY(B); });
      depth[fin.id] = Math.max.apply(null, list[0].map(function (n) { return depth[n.id]; })) + 1; list[0].push(fin);
    } else list.sort(function (A, B) { return minY(A) - minY(B); });
    var y0 = 0;
    list.forEach(function (g) {
      var layers = {}, row = {};
      g.forEach(function (n) { (layers[depth[n.id]] = layers[depth[n.id]] || []).push(n); });
      var keys = Object.keys(layers).map(Number).sort(function (a, b) { return a - b; }), tall = Math.max.apply(null, keys.map(function (k) { return layers[k].length; }));
      keys.forEach(function (k) {
        var L = layers[k], lean = function (n) { var ps = ins(n.id).filter(function (p) { return row[p.id] !== undefined; }); return ps.length ? ps.reduce(function (s, p) { return s + row[p.id]; }, 0) / ps.length : -1; };
        L.sort(function (a, b) { return lean(a) - lean(b) || a.y - b.y; });
        var off = (tall - L.length) / 2;
        L.forEach(function (n, i) { row[n.id] = off + i; n.x = k * COL; n.y = Math.round(y0 + (off + i) * STEP); });
      });
      y0 += tall * STEP + 36;
    });
    keep(); draw(); fit();
  }
  view.addEventListener('dragover', function (e) {            // media dragged from the rail
    var t = e.dataTransfer && Array.prototype.slice.call(e.dataTransfer.types || []);
    if (t && (t.indexOf('text/ember-asset') >= 0 || t.indexOf('text/ember-shop') >= 0)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
  });
  view.addEventListener('drop', function (e) {
    var asset = e.dataTransfer.getData('text/ember-asset'), shop = e.dataTransfer.getData('text/ember-shop');
    if (!asset && !shop) return;
    e.preventDefault();
    var hitNode = e.target.closest ? e.target.closest('.gn') : null, onto = hitNode ? hitNode.getAttribute('data-id') : null;
    if (asset && has(asset)) return void dropped(asset, e.clientX, e.clientY, onto);
    var cur = current();
    if (cur && cur.type !== 'subject') return void stop(cur, 'This video already has its subject. Click step 1 to change it, or press Start over for a new video.');
    var cx = e.clientX, cy = e.clientY;
    say('Bringing that selling video onto the canvas.');
    S.quiet('shop_import', { video_ids: [shop] }).catch(function () {}).then(function () {
      var id = Object.keys(P().assets).filter(function (k) { return String((P().assets[k].meta || {}).video_id) === String(shop); })[0];
      if (id) dropped(id, cx, cy, onto); else say('That video could not be fetched from TikTok. Try another.');
    });
  });
  view.addEventListener('dblclick', function (e) { if (e.target.closest('.gn, .flow-panel, .flow-menu, .flow-zoom') || e.target.getAttribute('data-w') !== null) return; showMenu(null, toWorld(e.clientX, e.clientY)); });
  view.addEventListener('wheel', function (e) {
    if (e.target.closest('.flow-panel, .flow-menu')) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, V.k * Math.exp(-e.deltaY * 0.0045));
    else { V.x -= e.deltaX; V.y -= e.deltaY; apply(false); keep(); }
  }, { passive: false });
  $('#flow-in').addEventListener('click', function () { var r = view.getBoundingClientRect(); zoomAt(r.left + room().w / 2, r.top + r.height / 2, V.k * 1.2); });
  $('#flow-out').addEventListener('click', function () { var r = view.getBoundingClientRect(); zoomAt(r.left + room().w / 2, r.top + r.height / 2, V.k / 1.2); });
  $('#flow-fit').addEventListener('click', tidy);            // Fit tidies the board first, then fits it in view
  $('#flow-guided').addEventListener('click', function () { G.guided = !G.guided; keep(); draw(); renderPanel(); });
  document.addEventListener('keydown', function (e) {        // Backspace or Delete takes the selected node off the board
    if ((e.key !== 'Backspace' && e.key !== 'Delete') || root.hidden || (!G.open && !selCount()) || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || (t && t.closest && t.closest('.flow-panel, .chat-head, .chat-log, .chat-foot, #lib, .dlg, .menu-pop'))) return;
    if (selCount()) {                                         // several selected: they all go
      e.preventDefault();
      var ids = Object.keys(SEL), gone = 0; SEL = {};
      ids.forEach(function (id) { var m = node(id); if (!m || m.type === 'final' || G.nodes.filter(function (x) { return x.type !== 'final'; }).length < 2) return; removeNode(m); if (!node(id)) gone++; });
      return void (gone ? say(gone + (gone === 1 ? ' node' : ' nodes') + ' taken off the board. Files stay in your media.') : 0);
    }
    var n = node(G.open); if (!n) return;
    e.preventDefault();
    if (n.type === 'final') return void say('The final video stays. Unwire a clip from it to take that clip out.');
    if (G.nodes.filter(function (m) { return m.type !== 'final'; }).length < 2) return void say('This is the only step on the board. Use Start over to begin again.');
    var file = n.type === 'media'; removeNode(n);
    if (node(n.id)) return;                                  // it was not removed (it is being filmed): the reason is already on screen
    say(file ? 'Taken off the board. The file is still in your media.' : 'Step removed.');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !root.hidden) { clearSel(); if (!menuEl.hidden) hideMenu(); else if (G.open) { G.open = null; keep(); draw(); renderPanel(); } } });

  /* ---------- the panel: the open node says what it wants ---------- */
  function renderPanel() {
    var n = G.open && node(G.open);
    S.parkMonitor();                                          // the preview player lives in the Final panel only while that is open
    if (S.railWide) S.railWide(!!n && n.type !== 'subject' && docked);   // the rail gets room while a step is worked on in it
    if (n && n.type === 'subject') { panel.hidden = true; root.classList.remove('has-panel'); return void pickSubject(n); }   // step one has no panel: the left rail is where it is chosen
    S.pick(null);
    panel.hidden = !n; root.classList.toggle('has-panel', !!n);
    if (!n) return;
    var m = T[n.type], body = el('div', { class: 'fp-body' }), need = needs(n);
    if (n.type === 'media') m = { icon: m.icon, title: 'Media', ask: (P().assets[n.d.asset] || {}).name || 'Media' };
    panel.textContent = '';
    panel.appendChild(el('header', { class: 'fp-h' }, [el('span', { class: 'fn-ic', html: svg(m.icon) }), el('div', { class: 'fn-t' }, [el('small', { text: m.title }), el('b', { text: m.ask })]),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close (Esc)', html: svg(I.x), onclick: function () { G.open = null; keep(); draw(); renderPanel(); } })]));
    panel.appendChild(body);
    if (n.type !== 'film' && n.type !== 'media' && n.type !== 'final' && filming(n)) {   // its clip is being filmed with these choices: read-only until that ends
      var fm = filming(n), sum0 = summary(n);
      body.appendChild(el('div', { class: 'fp-need' }, [el('span', { class: 'fn-ic', html: svg(I.film) }),
        el('div', {}, [el('b', { text: 'Filming with this choice' }), el('span', { text: (sum0 ? sum0.t + '. ' : '') + 'It can be changed when the render ends.' })]),
        el('button', { type: 'button', class: 'btn btn-accent', text: 'Open Film it', onclick: function () { open(fm.id); } })]));
      return;
    }
    if (need.length) {
      need.forEach(function (x) {
        body.appendChild(el('div', { class: 'fp-need' }, [el('span', { class: 'fn-ic', html: svg(T[x.type].icon) }),
          el('div', {}, [el('b', { text: x.node ? 'Finish "' + T[x.type].title + '" first' : 'I need ' + T[x.type].title.toLowerCase() + ' first' }), el('span', { text: x.node ? 'It is on the board but not done yet.' : T[x.type].hint })]),
          el('button', { type: 'button', class: 'btn btn-accent', text: x.node ? 'Open it' : 'Add it', onclick: function () {
            if (x.node) return void open(x.node.id);
            open(addNode(x.type, n.x - NW - GAP, n.y, null, n.id).id);
          } })]));
      });
      body.appendChild(el('p', { class: 'f-note', text: 'You can also drag a line from any node that has it into this one.' }));
      return;
    }
    ({ creator: renderCreator, format: renderFormat, script: renderScript, voice: renderVoice, film: renderFilm, media: renderMedia, final: renderFinal })[n.type](body, n);
    if (n.type === 'media' || n.type === 'final') return;
    if (isDone(n) && !G.guided && n.type !== 'film' && !outs(n.id).length) body.appendChild(el('div', { class: 'f-foot' }, [
      el('button', { type: 'button', class: 'btn', html: 'Choose what comes next' + svg(I.arrow), onclick: function () { showMenu(n, { x: n.x + NW + GAP, y: n.y + NH / 2 }); } })]));
  }
  function refresh(n) { if (G.open === n.id) renderPanel(); draw(); }
  function renderMedia(box, n) {
    var p = P(), a = p.assets[n.d.asset]; if (!a) return;
    var cut = inCut(a.id), view2 = el('div', { class: 'f-media ' + a.kind });
    if (a.kind === 'video') view2.appendChild(el('video', { src: a.url, controls: '', playsinline: '', poster: a.poster_url || null }));
    else if (a.kind === 'audio') view2.appendChild(el('audio', { src: a.url, controls: '', class: 'f-audio' }));
    else view2.appendChild(el('img', { src: a.url, alt: '' }));
    box.appendChild(view2);
    box.appendChild(el('p', { class: 'f-note', text: (a.reference ? 'Another creator\'s selling video. It is here to work from: its order and its beats. It never goes into your video.'
      : a.kind === 'image' ? 'A picture. Film it by wiring it into "What to make".' : cut ? 'This is in your video.' : 'This is on the canvas but not in your video yet.') }));
    if (a.kind === 'image' && a.source !== 'product') {
      box.appendChild(el('span', { class: 'f-lab' }, ['This picture is']));
      box.appendChild(seg([['creator', 'The person on camera'], ['subject', 'The product']], n.d.role, function (v) { n.d.as = v; fill(n); claim(); changed(n); keep(); draw(); refresh(n); }));
    }
    var foot = el('div', { class: 'f-foot' });
    if (a.kind !== 'image' && !a.reference) foot.appendChild(el('button', { type: 'button', class: 'btn' + (cut ? '' : ' btn-accent'), text: cut ? 'Take it out of the video' : 'Add to the final video', onclick: function () { if (cut) S.cut.remove(a.id); else S.cut.add(a.id); } }));
    if (a.kind === 'video') foot.appendChild(el('button', { type: 'button', class: 'btn' + (a.reference ? ' btn-accent' : ''), disabled: p.avatar ? null : '', title: p.avatar ? null : 'Save an avatar first: drop a photo of your creator on the canvas', text: a.reference ? 'Remake it with my avatar' : 'Film my avatar from it', onclick: function () { remake(n, avatarNode(n)); } }));
    if (a.kind === 'image' && a.id !== p.avatar && n.d.role === 'creator') foot.appendChild(el('button', { type: 'button', class: 'btn btn-accent', text: 'Use as my avatar', onclick: function () { S.setAvatar(a.id); } }));
    if (a.kind === 'image') foot.appendChild(el('button', { type: 'button', class: 'btn', html: 'Film it' + svg(I.arrow), onclick: function () { remake(n, n.d.role === 'creator' ? null : avatarNode(n)); } }));
    foot.appendChild(el('button', { type: 'button', class: 'btn', text: 'Ask Ember about it', onclick: function () { S.ask('About "' + a.name + '": '); } }));
    box.appendChild(foot);
    if (a.kind === 'video' && !p.avatar) box.appendChild(el('p', { class: 'f-note', text: 'To put yourself in it, drop a photo of your creator on the canvas and wire the two together.' }));
  }
  function renderFinal(box, n) {
    var p = P(), clips = p.tracks.video;
    if (!clips.length) {
      box.appendChild(el('div', { class: 'fp-need' }, [el('span', { class: 'fn-ic', html: svg(I.play) }),
        el('div', {}, [el('b', { text: 'Nothing is wired in yet' }), el('span', { text: 'Drag a line from a clip\'s + onto this node, drop a clip from the left, or film one.' })]), el('span')]));
      return;
    }
    var holder = el('div', { class: 'f-player' }); box.appendChild(holder); S.mountMonitor(holder);
    box.appendChild(el('span', { class: 'f-lab' }, ['In this video, in order', el('em', { text: S.fmt(p.duration) })]));
    var list = el('div', { class: 'f-clips' });
    clips.forEach(function (c, i) {
      var a = p.assets[c.asset], th = el('i'); if (thumb(a)) th.style.backgroundImage = 'url("' + thumb(a) + '")';
      list.appendChild(el('div', { class: 'f-clip' }, [th, el('div', {}, [el('b', { text: a.name }), el('span', { text: S.fmt(c.out - c.in) })]),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Earlier', title: 'Earlier', disabled: i ? null : '', html: svg('<path d="M10 15V5M5.5 9.5L10 5l4.5 4.5"/>'), onclick: function () { S.cut.move(c.id, -1); } }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Later', title: 'Later', disabled: i < clips.length - 1 ? null : '', html: svg('<path d="M10 5v10M5.5 10.5L10 15l4.5-4.500"/>'), onclick: function () { S.cut.move(c.id, 1); } }),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Take out', title: 'Take out of the video', html: svg(I.x), onclick: function () { S.cut.drop(c.id); } })]));
    });
    box.appendChild(list);
    var caps = p.tracks.captions.length;
    box.appendChild(el('div', { class: 'f-foot' }, [
      el('button', { type: 'button', class: 'btn', text: caps ? 'Redo captions' : 'Add captions', onclick: function () { S.act('auto_captions'); } }),
      caps ? el('button', { type: 'button', class: 'btn', text: 'Clear captions', onclick: function () { S.cut.clearCaptions(); } }) : null,
      el('button', { type: 'button', class: 'btn', text: 'Cut the pauses', onclick: function () { S.act('remove_silences'); } }),
      el('button', { type: 'button', class: 'btn', html: svg(I.mic) + 'Record my voice', onclick: function () { S.record(); } })]));
    box.appendChild(el('p', { class: 'f-note', text: (caps ? caps + ' caption' + (caps === 1 ? '' : 's') + ', timed to the words. ' : '') + 'For anything finer (trim a clip, move a caption, change the pace), tell Ember.' }));
    box.appendChild(el('div', { class: 'f-foot' }, [el('span', { class: 'grow' }), el('button', { type: 'button', class: 'btn btn-accent btn-lg', html: 'Export and post' + svg(I.arrow), onclick: function () { S.post(); } })]));
  }

  /* ---------- a picture from our own models (a frame of a short test shot) ---------- */
  var pic = null, picErr = '';
  function picturePanel(box, n, purpose, prompt, done) {
    var price = cost(5.2), online = S.status().gpu && S.status().gpu.online;
    if (pic) {
      box.appendChild(el('div', { class: 'f-prog' }, [el('b', { id: 'f-pic-note', text: pic.note }), el('span', { id: 'f-pic-time', text: '' })]));
      box.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
      box.appendChild(el('div', { class: 'f-foot' }, [el('p', { class: 'f-note', text: 'We film the shortest clip our video model makes and keep a frame from it.' }), el('span', { class: 'grow' }),
        el('button', { type: 'button', class: 'btn', text: 'Stop', onclick: function () { api('/api/stop', { method: 'POST', body: { what: 'board' } }).catch(function () {}); } })]));
      return null;
    }
    return el('button', { type: 'button', class: 'btn', disabled: online ? null : '', title: online ? 'Films a short test shot on our GPU and keeps a frame' : 'Our GPU is offline right now',
      text: (purpose === 'creator' ? 'Make their picture' : 'Make a picture of it') + ' · ' + money(price), onclick: function () {
        var text = prompt().trim(); if (text.length < 4) return;
        pic = { note: 'Sending it to our GPU', t0: Date.now() }; picErr = ''; refresh(n);
        var got = null, err = '';
        var tick = setInterval(function () { var t = $('#f-pic-time'); if (t && pic) t.textContent = Math.round((Date.now() - pic.t0) / 1000) + 's'; }, 1000);
        sse('flow_picture', { prompt: text, purpose: purpose, approved: price }, function (ev) {
          if (ev.type === 'progress' && pic) { pic.note = ev.note; var nn = $('#f-pic-note'); if (nn) nn.textContent = ev.note; }
          else if (ev.type === 'flow_picture') { got = ev.asset; err = ev.asset ? '' : (ev.reason || 'The picture was not made.'); }
          else if (ev.type === 'error') err = ev.message;
        }).catch(function () { err = 'The connection dropped.'; }).then(function () {
          clearInterval(tick); pic = null;
          if (got) done(got); else { picErr = err || 'The picture was not made.'; refresh(n); }
        });
      } });
  }

  /* ---------- node: the subject ---------- */
  var shopBusy = false, shopErr = '', shopTried = false;
  function search(n, query, sort, more) {
    if (shopBusy) return;
    shopBusy = true; shopErr = ''; shopTried = true; refresh(n);
    sse('shop_search', { sort: sort, query: query || null, n: more || 100 }, function (ev) {
      if (ev.type === 'step' && ev.state === 'fail') shopErr = String(ev.detail || 'The Shop search did not answer.').replace(/^\w+Error: /, '');
      else if (ev.type === 'error') shopErr = ev.message;
    }).catch(function () { shopErr = 'The Shop search did not answer.'; }).then(function () { shopBusy = false; refresh(n); });
  }
  function pickSubject(n) {                                   // step one is chosen in the left rail: a selling video in Shop, a file of your own in Media, or by chatting
    if (filming(n)) { S.pick(null); return void stop(null, 'This video is being filmed right now. Step 1 can be changed when the render ends.'); }
    var d = n.d, take = function (subj) { delete d.via; d.subject = subj; changed(n); S.pick(null); complete(n); };
    S.pick({ step: 'Step 1', title: T.subject.ask,
      onShop: function (v) { if (v.stock === 'out_of_stock') say('Heads up: the listing shows this product as out of stock right now.'); take({ kind: 'shop', id: String(v.id), title: v.product || v.title || 'Video', poster: v.poster, price: v.price, units: v.units_7d, creator: v.creator, url: v.url, image: v.image, rating: v.rating,
        more: { price_was: v.price_was, reviews: v.reviews, sold_total: v.sold_total, seller: v.seller, category: v.category, stock: v.stock } }); },
      onAsset: function (a) {
        if (a.id === P().avatar) return void stop(n, 'That is your avatar. It comes in at step 2, who is on camera. Pick what the video is about first.');
        if (a.kind === 'audio') return void stop(n, 'A sound comes in at step 5, the voice. Pick a picture or a clip of what the video is about.');
        take({ kind: a.reference ? 'reference' : 'asset', asset: a.id, title: (a.meta && a.meta.product) || a.name, poster: thumb(a), price: a.meta && a.meta.price });
      },
      onChat: function () { subjectChat(n); } });
  }
  function subjectChat(n) {                                   // step one is answered by typing it
    var d = n.d;
    chatStep(n, { label: 'step 1: what the video is about', hint: 'Describe the video: a dinosaur walking through a city at night',
          say: 'Type what the video is about in the box at the bottom. That becomes step 1, and the next step opens.',
          take: function (text) {
            d.subject = { kind: 'idea', text: text, title: text }; changed(n); S.pick(null); complete(n);
            return 'Got it. The video is about: ' + text + '. Next step: who is on camera.';
          } });
  }
  function describe() {                                       // "Describe a video" in the chat: step one, answered by typing
    var n = G.nodes.filter(function (m) { return m.type === 'subject' && !m.d.subject; })[0];
    if (!n || filming()) return false;
    open(n.id); subjectChat(n); return true;
  }
  function chatStep(n, o) {                                   // this step is answered in Ember's message field: the text fills the step, nothing is rendered
    n.d.via = 'chat'; keep(); draw(); say(o.say);
    S.chatPoint(true, { label: o.label, hint: o.hint,
      take: function (text) { delete n.d.via; return o.take(text); },
      cancel: function () { delete n.d.via; keep(); draw(); } });
  }

  /* ---------- node: who is on camera ---------- */
  function renderCreator(box, n) {
    var d = n.d, p = P(), av = p.avatar && p.assets[p.avatar], opts = el('div', { class: 'f-opts' }), k = 0;
    var pick = function (c) { d.creator = c; d.cmode = ''; changed(n); complete(n); };
    var useAvatar = function (id) { var a = P().assets[id], go = function () { pick({ kind: 'avatar', asset: id, title: a.name, poster: a.url }); }; if (P().avatar === id) go(); else S.setAvatar(id).then(go); };
    var opt = function (icon, title, text, on, pressed, photo) {
      var b = el('button', { type: 'button', class: 'f-opt', 'aria-pressed': String(!!pressed), onclick: on }, [photo ? el('span', { class: 'ph' }) : el('span', { html: svg(icon, 24) }), el('b', { text: title }), el('span', { text: text })]);
      if (photo) b.firstChild.style.backgroundImage = 'url("' + photo + '")';
      b.style.setProperty('--k', k++); opts.appendChild(b); return b;
    };
    if (av) opt(I.person, 'Use my avatar', av.name, function () { useAvatar(av.id); }, d.creator && d.creator.asset === av.id, av.url);
    var file = el('input', { type: 'file', accept: 'image/*', hidden: '' });
    file.addEventListener('change', function () { if (file.files[0]) upload(file.files[0]).then(useAvatar).catch(function () {}); });
    opt(I.up, av ? 'Upload a different photo' : 'Upload a photo', 'Your own face, or a creator you have the rights to.', function () { file.click(); }).appendChild(file);
    opt(I.spark, 'Make one with our models', 'Describe a presenter and we film them for you.', function () { d.cmode = d.cmode === 'make' ? '' : 'make'; picErr = ''; keep(); renderPanel(); }, d.cmode === 'make');
    opt(I.none, 'No one on camera', 'Product shots only, no presenter.', function () { pick({ kind: 'none' }); }, d.creator && d.creator.kind === 'none');
    opt(I.script, 'Chat about it', 'Describe who you want on camera in the box at the bottom.', function () {
      chatStep(n, { label: 'step 2: who is on camera', hint: 'Describe them: a woman in her twenties, warm smile, cream sweater',
        say: 'Describe who is on camera in the box at the bottom. Then choose: make their picture with our models, or just use the description.',
        take: function (text) {
          d.cmode = 'make'; d.cdesc = text; keep(); open(n.id);
          return 'Got it. On the right: make their picture with our models (the price is on the button), or just use the description for free.';
        } });
    }, d.via === 'chat');
    box.appendChild(opts);
    if (d.cmode === 'make') {
      var area = el('textarea', { class: 'f-area', rows: '3', placeholder: 'A woman in her late twenties, warm smile, dark hair in a low bun, cream knit sweater', 'aria-label': 'Describe the presenter' });
      area.value = d.cdesc || '';
      area.addEventListener('input', function () { d.cdesc = area.value; keep(); });
      box.appendChild(el('span', { class: 'f-lab' }, ['Describe them'])); box.appendChild(area);
      if (picErr) box.appendChild(el('p', { class: 'f-note warn', text: picErr }));
      var make = picturePanel(box, n, 'creator', function () { return area.value; }, function (id) { useAvatar(id); });
      if (make) box.appendChild(el('div', { class: 'f-foot' }, [make,
        el('button', { type: 'button', class: 'btn', text: 'Just use the description', onclick: function () { var t = area.value.trim(); if (t.length > 3) pick({ kind: 'describe', text: t }); else area.focus(); } }),
        el('p', { class: 'f-note', text: 'A picture keeps them the same in every clip. A description alone is free, but they will look different each time.' })]));
    }
    var pics = Object.keys(p.assets).map(function (x) { return p.assets[x]; }).filter(function (a) { return a.kind === 'image' && !a.reference && a.source !== 'product' && a.id !== p.avatar; }).reverse();
    if (pics.length && d.cmode !== 'make') {
      box.appendChild(el('p', { class: 'f-note', text: 'Or pick a picture you already have.' }));
      var g = el('div', { class: 'f-grid' });
      pics.forEach(function (a) { g.appendChild(card(a.url, a.name, 'picture', '', false, function () { useAvatar(a.id); }, true)); });
      box.appendChild(g);
    }
  }

  /* ---------- node: what to make ---------- */
  function renderFormat(box, n) {
    var d = n.d, c = ctx(n.id), cr = c.creator && c.creator.d.creator, nobody = !cr || cr.kind === 'none', opts = el('div', { class: 'f-opts' }), sub = c.subject.d.subject;
    var ownClip = sub.kind === 'asset' && has(sub.asset) && P().assets[sub.asset].kind === 'video';   // their own footage can go straight to the editor
    if (!d.make && sub.kind === 'idea') { d.make = 'free'; d.idea = d.idea || sub.text; }   // the video was described in words: that description is the shot, ready to edit
    if (!c.creator) box.appendChild(el('p', { class: 'f-note', text: 'No one on camera is connected, so this will be product only. Wire an "On camera" node into this one to put a person in it.' }));
    MAKES.forEach(function (m, k) {
      var off = m.person && nobody;
      var b = el('button', { type: 'button', class: 'f-opt', 'aria-pressed': String(d.make === m.id), disabled: off ? '' : null,
        onclick: function () { d.make = m.id; d.ok = false; if (m.id === 'free' && !d.idea && sub && sub.text) d.idea = sub.text; changed(n); keep(); refresh(n); } },
        [el('span', { html: svg(m.icon, 24) }), el('b', { text: m.t }), el('span', { text: off ? 'Needs someone on camera.' : m.d })]);
      b.style.setProperty('--k', k); opts.appendChild(b);
    });
    if (ownClip) {
      var asis = el('button', { type: 'button', class: 'f-opt', 'aria-pressed': String(d.make === 'asis'), onclick: function () { d.make = 'asis'; d.ok = false; keep(); refresh(n); } },
        [el('span', { html: svg(I.film, 24) }), el('b', { text: 'Use it as it is' }), el('span', { text: 'No filming. Your clip goes into the final video.' })]);
      asis.style.setProperty('--k', 4); opts.appendChild(asis);
    }
    box.appendChild(opts);
    if (d.make === 'asis') {
      box.appendChild(el('div', { class: 'f-foot' }, [el('p', { class: 'f-note', text: 'Nothing is filmed and nothing is charged.' }), el('span', { class: 'grow' }),
        el('button', { type: 'button', class: 'btn btn-accent', html: 'Add it to the final video' + svg(I.arrow), onclick: function () { S.cut.add(sub.asset); var fn = finalNode(); if (fn) open(fn.id); } })]));
      return;
    }
    var area = null;
    if (d.make === 'free') {
      area = el('textarea', { class: 'f-area', rows: '3', placeholder: 'The mug slides across a wet bar top into frame, steam rising, neon reflections', 'aria-label': 'Describe the shot' });
      area.value = d.idea || '';
      area.addEventListener('input', function () { d.idea = area.value; keep(); });
      box.appendChild(el('span', { class: 'f-lab' }, ['Describe the shot'])); box.appendChild(area);
    }
    box.appendChild(el('span', { class: 'f-lab' }, ['Length', el('em', { html: '<b>' + money(cost(d.seconds)) + '</b> to film' })]));
    box.appendChild(seg([6, 8, 10, 12, 15].map(function (s) { return [s, s + 's']; }), d.seconds, function (v) { d.seconds = v; d.ok = false; changed(n); keep(); refresh(n); }));
    box.appendChild(el('div', { class: 'f-foot' }, [el('span', { class: 'grow' }),
      el('button', { type: 'button', class: 'btn btn-accent', disabled: d.make ? null : '', html: (isDone(n) ? 'Keep this' : 'This one') + svg(I.arrow), onclick: function () {
        if (!d.make) return;
        if (d.make === 'free' && (d.idea || '').trim().length < 4) return void area.focus();
        d.ok = true; complete(n);
      } })]));
  }

  /* ---------- node: the script ---------- */
  var writing = null, steps = [], scriptErr = {};
  function writeScript(n) {
    if (writing) return;
    var c = ctx(n.id), cr = (c.creator && c.creator.d.creator) || { kind: 'none' }, f = c.format.d, vo = c.voice && c.voice.d.voice;
    writing = n.id; steps = []; delete scriptErr[n.id]; n.d.script = null; n.d.ok = false; refresh(n);
    sse('flow_script', { subject: c.subject.d.subject, creator: cr, make: f.make, seconds: f.seconds, idea: f.make === 'free' ? f.idea : '', voice: vo || null }, function (ev) {
      if (ev.type === 'step') {
        if (ev.state === 'run') steps.push({ id: ev.id, label: ev.label, state: 'run' });
        else steps.forEach(function (s) { if (s.id === ev.id) { s.state = ev.state; s.detail = ev.detail; } });
        if (G.open === n.id) renderPanel();
      } else if (ev.type === 'flow_script') n.d.script = { line: ev.line, shot: ev.shot, name: ev.name, words: ev.words, product_asset: ev.product_asset, reference_asset: ev.reference_asset, facts: ev.facts || [] };
      else if (ev.type === 'error') scriptErr[n.id] = ev.message;
    }).catch(function () { scriptErr[n.id] = 'The connection dropped.'; }).then(function () {
      writing = null; if (!n.d.script && !scriptErr[n.id]) scriptErr[n.id] = 'The script was not written. Try again.';
      keep(); refresh(n);
    });
  }
  function renderScript(box, n) {
    var d = n.d;
    if (!d.script && !writing && !scriptErr[n.id]) return void writeScript(n);
    if (writing === n.id) {
      var list = el('div', { class: 'f-steps' });
      steps.forEach(function (s) { list.appendChild(el('div', { class: 'stp ' + s.state }, [el('span', { class: 'ic', html: svg(s.state === 'ok' ? I.check : s.state === 'fail' ? I.none : I.spark) }), el('span', { class: 'lb', text: s.label }), s.detail ? el('small', { text: s.detail }) : null])); });
      box.appendChild(list); box.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
      return;
    }
    if (!d.script) {
      box.appendChild(el('p', { class: 'f-note warn', text: scriptErr[n.id] || 'Another script is being written. One moment.' }));
      box.appendChild(el('div', { class: 'f-foot' }, [el('button', { type: 'button', class: 'btn btn-accent', text: 'Try again', onclick: function () { delete scriptErr[n.id]; writeScript(n); } })]));
      return;
    }
    var limit = d.script.words || 19, count = el('em');
    var line = el('textarea', { class: 'f-area', rows: '3', placeholder: 'Leave empty if nobody speaks', 'aria-label': 'What is said' }); line.value = d.script.line || '';
    var shot = el('textarea', { class: 'f-area', rows: '6', 'aria-label': 'The shot' }); shot.value = d.script.shot || '';
    var tally = function () { var w = line.value.trim() ? line.value.trim().split(/\s+/).length : 0; count.textContent = w + ' of about ' + limit + ' words'; count.className = w > limit + 3 ? 'over' : ''; };
    line.addEventListener('input', function () { d.script.line = line.value; changed(n); tally(); keep(); });
    shot.addEventListener('input', function () { d.script.shot = shot.value; changed(n); keep(); });
    tally();
    box.appendChild(el('span', { class: 'f-lab' }, ['What is said', count])); box.appendChild(line);
    box.appendChild(el('span', { class: 'f-lab' }, ['The shot'])); box.appendChild(shot);
    if (d.script.facts && d.script.facts.length) {            // what the writer was given: nothing in the script may go beyond this
      box.appendChild(el('span', { class: 'f-lab' }, ['Facts it was written from']));
      box.appendChild(el('ul', { class: 'f-facts' }, d.script.facts.map(function (x) { return el('li', { text: x }); })));
    }
    box.appendChild(el('p', { class: 'f-note', text: 'Product facts only. The presenter never claims to have used it.' + (d.script.reference_asset ? ' The selling video was used for the order of its beats, not its words.' : '') }));
    box.appendChild(el('div', { class: 'f-foot' }, [
      el('button', { type: 'button', class: 'btn', text: 'Write it again', onclick: function () { writeScript(n); } }), el('span', { class: 'grow' }),
      el('button', { type: 'button', class: 'btn btn-accent', html: 'Looks good' + svg(I.arrow), onclick: function () { if (shot.value.trim().length < 8) return void shot.focus(); d.ok = true; complete(n); } })]));
  }

  /* ---------- node: the voice ---------- */
  var voices = {}, voiceQ = '', player = null, take = null;   // take: a recording in progress { mr, stream, t0, timer }
  function loadVoices(n, q) {
    voiceQ = q;
    if (voices[q]) return;
    voices[q] = 'wait';
    api('/api/voices?q=' + encodeURIComponent(q)).then(function (list) { voices[q] = list; }).catch(function (e) { voices[q] = { error: e.message || 'The voice library did not answer.' }; }).then(function () { refresh(n); });
  }
  function stopTake() { if (!take) return; clearInterval(take.timer); if (take.mr && take.mr.state !== 'inactive') take.mr.stop(); take.stream.getTracks().forEach(function (t) { t.stop(); }); }
  function voiceList(box, n, current, onPick) {
    var q = el('input', { class: 'f-in', type: 'search', placeholder: 'warm storyteller, bright young woman, deep calm man', value: voiceQ, 'aria-label': 'Search voices' });
    box.appendChild(el('form', { class: 'f-row', onsubmit: function (e) { e.preventDefault(); loadVoices(n, q.value.trim()); renderPanel(); } }, [q, el('button', { type: 'submit', class: 'btn', text: 'Search' })]));
    var list = voices[voiceQ];
    if (!list) { loadVoices(n, voiceQ); list = 'wait'; }
    if (list === 'wait') return void box.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
    if (list.error) return void box.appendChild(el('p', { class: 'f-note warn', text: list.error }));
    if (!list.length) return void box.appendChild(el('p', { class: 'f-note', text: 'No voices matched. Try other words.' }));
    var rows = el('div', { class: 'f-voices' });
    list.forEach(function (v) {
      var on = current === v.id;
      rows.appendChild(el('div', { class: 'f-voice' + (on ? ' on' : '') }, [
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Play a sample of ' + v.title, title: v.sample_url ? 'Play a sample' : 'No sample', disabled: v.sample_url ? null : '', html: svg(I.play), onclick: function () {
          if (player) player.pause(); player = new Audio(v.sample_url); var pp = player.play(); if (pp && pp.catch) pp.catch(function () {});
        } }),
        el('div', {}, [el('b', { text: v.title }), el('span', { text: (v.tags || []).slice(0, 4).join(' · ') })]),
        el('button', { type: 'button', class: 'btn' + (on ? ' btn-accent' : ''), text: on ? 'Using this' : 'Use this', onclick: function () {
          if (player) player.pause();
          try { localStorage.setItem('ember_voice_' + S.user, JSON.stringify({ voice_id: v.id, title: v.title })); } catch (e) {}
          onPick({ kind: 'fish', voice_id: v.id, title: v.title });
        } })]));
    });
    box.appendChild(rows);
  }
  function lastVoice() { try { return JSON.parse(localStorage.getItem('ember_voice_' + S.user) || 'null'); } catch (e) { return null; } }
  function renderVoice(box, n) {
    var d = n.d, c = ctx(n.id), cr = c.creator && c.creator.d.creator, nobody = !cr || cr.kind === 'none', line = c.script && c.script.d.script && c.script.d.script.line;
    var mode = d.mode || (d.voice && d.voice.kind) || '', opts = el('div', { class: 'f-opts' });
    var pick = function (v) { d.voice = v; changed(n); complete(n); };
    var opt = function (id, icon, title, text, on, off) {
      opts.appendChild(el('button', { type: 'button', class: 'f-opt', 'aria-pressed': String(mode === id), disabled: off ? '' : null, onclick: on }, [el('span', { html: svg(icon, 24) }), el('b', { text: title }), el('span', { text: text })]));
    };
    opt('model', I.person, 'The presenter speaks', nobody ? 'No one is on camera, so there is no one to speak.' : 'Our video model gives them a voice, and their lips match the words.', function () { d.mode = 'model'; pick({ kind: 'model' }); }, nobody);
    opt('fish', I.spark, 'A voice from the library', 'Pick a narrator by ear. It is laid over the clip as a voiceover.', function () { d.mode = 'fish'; keep(); renderPanel(); });
    opt('own', I.mic, 'My own voice', 'Record the line here, or upload a recording of it.', function () { d.mode = 'own'; keep(); renderPanel(); });
    box.appendChild(opts);
    if (mode === 'fish' || mode === 'own') box.appendChild(el('p', { class: 'f-note', text: 'A voiceover plays over the picture: the presenter does not speak on camera, so their lips stay still.' }));
    if (line && mode) { box.appendChild(el('span', { class: 'f-lab' }, ['The line'])); box.appendChild(el('div', { class: 'f-line', text: line })); }
    if (mode === 'fish') {
      var last = lastVoice();
      if (last && !(d.voice && d.voice.kind === 'fish')) box.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn btn-accent', text: 'Use ' + last.title + ' again', onclick: function () { pick({ kind: 'fish', voice_id: last.voice_id, title: last.title }); } }),
        el('p', { class: 'f-note', text: 'The voice you used last time.' })]));
      voiceList(box, n, d.voice && d.voice.kind === 'fish' ? d.voice.voice_id : null, pick);
      box.appendChild(el('p', { class: 'f-note', text: 'The line is recorded in this voice when you film, word for word.' }));
    } else if (mode === 'own') {
      var cur = d.voice && d.voice.kind === 'own' && has(d.voice.asset) ? P().assets[d.voice.asset] : null;
      if (cur) {
        box.appendChild(el('audio', { src: cur.url, controls: '', class: 'f-audio' }));
        box.appendChild(el('div', { class: 'f-foot' }, [el('button', { type: 'button', class: 'btn', text: 'Record again', onclick: function () { d.voice = null; changed(n); keep(); refresh(n); } }), el('span', { class: 'grow' }),
          isDone(n) ? el('p', { class: 'f-note', text: 'This take goes under the clip when you film.' }) : null]));
      } else if (take) {
        box.appendChild(el('div', { class: 'f-prog rec' }, [el('i'), el('b', { text: 'Recording' }), el('span', { id: 'f-take-time', text: '0:00.0' })]));
        box.appendChild(el('div', { class: 'f-foot' }, [el('button', { type: 'button', class: 'btn btn-accent', text: 'Stop', onclick: stopTake })]));
      } else {
        var saved = function (id) { pick({ kind: 'own', asset: id, title: 'My own voice' }); };
        box.appendChild(el('div', { class: 'f-foot' }, [
          el('button', { type: 'button', class: 'btn btn-accent', html: svg(I.mic) + 'Record', onclick: function () {
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) return void (d.err = 'This browser cannot record. Upload a recording instead.', renderPanel());
            navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
              var kinds = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].filter(function (m) { return MediaRecorder.isTypeSupported(m); });
              var mr = new MediaRecorder(stream, kinds.length ? { mimeType: kinds[0] } : undefined), chunks = [];
              mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
              mr.onstop = function () {
                var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), secs = (Date.now() - take.t0) / 1000; take = null;
                if (secs < 0.4 || blob.size < 800) { d.err = 'That take was too short to keep.'; return void refresh(n); }
                d.err = ''; var ext = /mp4/.test(blob.type) ? '.m4a' : /ogg/.test(blob.type) ? '.ogg' : '.webm';
                upload(new File([blob], 'My voice' + ext, { type: blob.type }), true).then(saved).catch(function (e) { d.err = 'Could not save that take. ' + e.message; refresh(n); });
              };
              take = { mr: mr, stream: stream, t0: Date.now() };
              take.timer = setInterval(function () { var t = $('#f-take-time'); if (t && take) t.textContent = S.fmt((Date.now() - take.t0) / 1000); if (take && Date.now() - take.t0 > 180000) stopTake(); }, 100);
              mr.start(250); renderPanel();
            }).catch(function () { d.err = 'I could not reach your microphone. Allow microphone access for this page, or upload a recording.'; renderPanel(); });
          } }), el('span', { class: 'f-note', text: 'or' })]));
        box.appendChild(dropzone('Upload a recording of the line', 'an audio file from your phone or computer', 'audio/*', saved, true));
        if (d.err) box.appendChild(el('p', { class: 'f-note warn', text: d.err }));
      }
    }
  }

  /* ---------- node: film ---------- */
  var filmTick = 0;
  function starterCut() { var v = P().tracks.video; return !v.length || v.every(function (c) { var a = P().assets[c.asset]; return a && (a.name === 'Presenter take' || a.name === 'Savanna walk'); }); }
  function film(n) {
    var c = ctx(n.id), f = c.format.d, sc = c.script.d.script, sub = c.subject.d.subject, cr = (c.creator && c.creator.d.creator) || { kind: 'none' }, vo = (c.voice && c.voice.d.voice) || { kind: 'model' };
    var price = cost(f.seconds), asset = null, why = '', said = null;
    n.d.film = { state: 'run', note: 'Sending it to our GPU', t0: Date.now() }; refresh(n);
    clearInterval(filmTick);
    filmTick = setInterval(function () { var t = $('#f-film-time'); if (t && n.d.film && n.d.film.state === 'run') t.textContent = Math.round((Date.now() - n.d.film.t0) / 1000) + 's'; }, 1000);
    sse('flow_film', { line: sc.line, shot: sc.shot, seconds: f.seconds, name: sc.name, voice: vo,
      creator_asset: cr.kind === 'avatar' ? cr.asset : null, creator_text: cr.kind === 'describe' ? cr.text : '',
      product_asset: sc.product_asset || (sub.kind === 'asset' && has(sub.asset) && P().assets[sub.asset].kind === 'image' ? sub.asset : null),
      fresh: false, approved: price }, function (ev) {
      if (ev.type === 'progress' && n.d.film) { n.d.film.note = ev.note; var nn = $('#f-film-note'); if (nn) nn.textContent = ev.note; }
      else if (ev.type === 'flow_film') { asset = ev.rendered ? ev.asset : null; why = ev.rendered ? '' : (ev.reason || 'The render did not finish.'); said = ev.heard !== undefined ? { heard: ev.heard, match: ev.match } : null; }
      else if (ev.type === 'error') why = ev.message;
    }).catch(function () { why = 'The connection dropped.'; }).then(function () {
      clearInterval(filmTick);
      n.d.film = asset ? { state: 'done', asset: asset, said: said, voiced: vo.kind !== 'model' ? vo : null } : { state: 'fail', reason: why || 'The render did not finish.' };
      if (asset && said && said.match < 0.8 && vo.kind === 'model' && sc.line) n.d.fix = 'pick';   // the words came out wrong: the voices to fix it with are already showing
      sync(); keep(); refresh(n);
    });
  }
  function renderFilm(box, n) {
    var d = n.d, st = d.film && d.film.state, p = P(), c = ctx(n.id), f = c.format.d, sc = c.script.d.script, sub = c.subject.d.subject, cr = (c.creator && c.creator.d.creator) || { kind: 'none' }, vo = (c.voice && c.voice.d.voice) || { kind: 'model' };
    var online = S.status().gpu && S.status().gpu.online, price = cost(f.seconds), screen = el('div', { class: 'f-screen' });
    if (st === 'done' && has(d.film.asset)) {
      screen.appendChild(el('video', { src: p.assets[d.film.asset].url, autoplay: '', loop: '', playsinline: '', controls: '' })); screen.firstChild.muted = true;
      screen.appendChild(el('span', { class: 'tag-ai', text: 'AI-generated' }));
    } else {
      var bg = cr.poster || sub.poster;
      if (bg) { var im = el('span', { class: 'im' }); im.style.backgroundImage = 'url("' + bg + '")'; screen.appendChild(im); }
      screen.appendChild(el('span', { class: 'orb' + (st === 'run' ? ' busy' : ''), html: S.mascot() }));
    }
    var bill = el('div', { class: 'f-bill' }, [el('h3', { text: sc.name || 'New clip' })]), cast = el('div', { class: 'f-cast' });
    var chip = function (img, text, icon) { var i = el('i', { html: img ? '' : svg(icon || I.spark) }); if (img) i.style.backgroundImage = 'url("' + img + '")'; cast.appendChild(el('span', {}, [i, el('em', { text: text })])); };
    if (cr.kind !== 'none') chip(cr.poster, cr.kind === 'avatar' ? (cr.title || 'My avatar') : 'A described presenter', I.person);
    chip(sub.poster, sub.title || 'Your idea', I.bag);
    chip('', vo.kind === 'fish' ? 'Voice: ' + vo.title : vo.kind === 'own' ? 'Your own voice' : cr.kind === 'none' ? 'No voice' : 'The presenter speaks', I.mic);
    bill.appendChild(cast);
    if (st === 'run') {
      bill.appendChild(el('div', { class: 'f-prog' }, [el('b', { id: 'f-film-note', text: d.film.note }), el('span', { id: 'f-film-time', text: Math.round((Date.now() - d.film.t0) / 1000) + 's' })]));
      bill.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
      bill.appendChild(el('div', { class: 'f-foot' }, [el('p', { class: 'f-note', text: 'A render takes a few minutes. Stopping cancels it.' }), el('span', { class: 'grow' }),
        el('button', { type: 'button', class: 'btn', text: 'Stop', onclick: function () {
          api('/api/stop', { method: 'POST', body: { what: 'board' } }).catch(function () {});
          if (d.film && d.film.resumed) { d.film = null; keep(); refresh(n); }   // a reloaded page has no stream to hear the answer on
        } })]));
    } else if (st === 'done') {
      var fm = d.film, bad = fm.said && fm.said.match < 0.8 && !fm.voiced;
      if (fm.voiced) bill.appendChild(el('p', { class: 'f-note ok', text: 'The line is spoken word for word by ' + (fm.voiced.kind === 'fish' ? fm.voiced.title : 'your own voice') + ', laid over the clip.' }));
      else if (fm.said && sc.line) bill.appendChild(el('p', { class: 'f-note ' + (bad ? 'warn' : 'ok'), text: bad
        ? 'The voice did not say the line. I heard: "' + (fm.said.heard || 'nothing clear') + '"'
        : 'I listened back: the line came out right (' + Math.round(fm.said.match * 100) + '% of the words).' }));
      if (d.fix === 'run') { bill.appendChild(el('div', { class: 'f-prog' }, [el('b', { text: 'Recording the voice' })])); bill.appendChild(el('div', { class: 'f-bar' }, [el('i')])); }
      else if (d.fix === 'pick') {
        bill.appendChild(el('span', { class: 'f-lab' }, [bad ? 'The words came out wrong. Tap a voice to fix it' : 'Pick the voice that reads the line']));
        bill.appendChild(el('div', { class: 'f-line', text: sc.line }));
        voiceList(bill, n, fm.voiced && fm.voiced.voice_id, function (v) { fixVoice(n, v, sc.line); });
        bill.appendChild(el('p', { class: 'f-note', text: 'The clip\'s own speech is muted and this voice is laid over it, so the lips will not match the words.' }));
      } else if (sc.line) bill.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn' + (bad ? ' btn-accent' : ''), html: svg(I.mic) + (fm.voiced ? 'Change the voice' : 'Replace the voice'), onclick: function () { d.fix = 'pick'; renderPanel(); } }),
        d.fixErr ? el('p', { class: 'f-note warn', text: d.fixErr }) : el('p', { class: 'f-note', text: bad ? 'A library voice reads your exact line. No new render.' : 'Words wrong, or want a different voice? No new render needed.' })]));
      bill.appendChild(el('p', { class: 'f-note', text: 'It is wired into your final video, labelled AI-generated.' }));
      bill.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn btn-accent', html: 'Open the final video' + svg(I.arrow), onclick: function () { var fn = finalNode(); if (fn) open(fn.id); } }),
        el('button', { type: 'button', class: 'btn', text: 'Film another take', onclick: function () { d.film = null; keep(); refresh(n); } })]));
    } else {
      if (st === 'fail') bill.appendChild(el('p', { class: 'f-note warn', text: d.film.reason }));
      bill.appendChild(el('div', { class: 'f-cost' }, [money(price), el('small', { text: f.seconds + ' seconds · 9:16 · with sound' })]));
      if (!online) bill.appendChild(el('p', { class: 'f-note warn', text: 'Our GPU is offline right now, so nothing can be filmed. Your board is saved; come back to this node when it is on.' }));
      bill.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn btn-accent btn-lg', disabled: online ? null : '', html: svg(I.film) + (st === 'fail' ? 'Try again' : 'Film it') + ' · ' + money(price), onclick: function () { film(n); } }),
        el('p', { class: 'f-note', text: 'Nothing renders, and nothing is charged, until you press this.' })]));
    }
    box.appendChild(el('div', { class: 'f-film' }, [screen, bill]));
  }
  function fixVoice(n, voice, line) {                        // the exact line in a library voice, over a clip that is already filmed
    var d = n.d, ok = false, err = '';
    d.fix = 'run'; d.fixErr = ''; refresh(n);
    sse('flow_voice', { asset: d.film.asset, voice: voice, line: line }, function (ev) {
      if (ev.type === 'flow_voice') ok = true; else if (ev.type === 'error') err = ev.message;
    }).catch(function () { err = 'The connection dropped.'; }).then(function () {
      d.fix = ''; if (ok) d.film.voiced = voice; else d.fixErr = err || 'The voice could not be recorded.';
      keep(); refresh(n);
    });
  }

  /* ---------- open and close ---------- */
  var closing = 0;
  function open0() {
    if (!P()) return;
    clearTimeout(closing); root.classList.remove('leaving');
    try { localStorage.setItem(SEEN, '1'); } catch (e) {}
    G.open = null;                                            // the page opens on the board itself; a panel opens when a step is clicked, or when the flow leads on
    validate(); sync(); root.hidden = false;
    draw(); renderPanel();
    if (claimed) { var c0 = claimed; claimed = null; if (G.guided && G.open === c0.id) complete(c0); }
    settle();
    if (!G.view || window.innerWidth <= 760) { V = { x: 0, y: 0, k: 1 }; if (G.open && node(G.open)) focusOn(node(G.open)); else fit(); world.classList.remove('glide'); } else apply(false);   // a phone always opens on the whole board: a view saved on a wide screen would show nothing
  }
  function close() {
    if (root.hidden || root.classList.contains('leaving')) return;
    stopTake(); if (player) player.pause();
    root.classList.add('leaving');
    closing = setTimeout(function () { root.hidden = true; root.classList.remove('leaving'); }, 430);
  }
  var resetBtn = $('#flow-reset'), resetT = 0;
  function unsure() { clearTimeout(resetT); resetBtn.classList.remove('sure'); resetBtn.textContent = 'Start over'; }
  resetBtn.addEventListener('click', function () {            // Start over wipes the board: every step, every node, and the clips in the video. Files stay in Media.
    if (filming()) return void stop(filming(), 'A clip is being filmed right now. Stop the render in "Film it" first, or wait for it, then start over.');
    if (S.acting && S.acting()) return void stop(null, 'Ember is working. Wait for it to finish, then start over.');
    var p = P(), used = {}; p.tracks.video.concat(p.tracks.audio).forEach(function (c) { used[c.asset] = 1; });
    var clips = Object.keys(used);
    if (clips.length && !resetBtn.classList.contains('sure')) {
      resetBtn.classList.add('sure'); resetBtn.textContent = 'Clear everything?';
      say('Start over clears the board and takes ' + clips.length + (clips.length === 1 ? ' clip' : ' clips') + ' out of your video. Your files stay in Media. Press again to confirm.');
      clearTimeout(resetT); resetT = setTimeout(unsure, 6000); return;
    }
    unsure(); S.chatPoint(false, null, true); S.pick(null);
    clips.forEach(function (id) { S.cut.remove(id); });
    if (P().tracks.captions.length) S.cut.clearCaptions();
    G = fresh(); delete G.pristine; G.open = null; SEL = {}; claimed = null; peek = null; V = { x: 0, y: 0, k: 1 }; shopTried = false;
    Object.keys(els).forEach(function (id) { els[id].remove(); delete els[id]; });
    sync(); draw(); renderPanel(); focusOn(G.nodes[0]); keep();
  });
  window.addEventListener('resize', function () { if (!root.hidden) apply(false); });
  setInterval(function () {                                   // a render this page did not start itself (it was reloaded mid-render): look for its clip
    var waiting = G.nodes.filter(function (m) { return m.type === 'film' && m.d.film && m.d.film.state === 'run' && m.d.film.resumed; });
    if (!waiting.length || root.hidden || !P() || (S.acting && S.acting())) return;
    waiting.forEach(function (m) {
      if (Date.now() - (m.d.film.t0 || 0) > 40 * 60000) { m.d.film = { state: 'fail', reason: 'The render did not report back. If it finished, the clip is in Media.' }; keep(); draw(); if (G.open === m.id) renderPanel(); }
    });
    S.api('/api/project').then(function (p) { if (p && P() && p.version !== P().version) S.setProject(p); }).catch(function () {});
  }, 8000);
  $('#flow .flow-top .orb').innerHTML = S.mascot();
  S.onChange(function () {                                    // the project changed (you, or Ember): the canvas follows
    if (root.hidden || !P()) return;
    validate(); sync(); draw(); keep();
    if (claimed) { var c0 = claimed; claimed = null; if (G.guided && G.open === c0.id) return void complete(c0); }
    settle();
    var on = G.open && node(G.open);
    if (!on || on.type === 'media' || on.type === 'final') renderPanel();
  });
  function boardText() {                                      // the steps as plain lines, for Ember: what is chosen, what is waiting
    var cur = current(), p = P(), lines = [];
    G.nodes.filter(function (n) { return n.type !== 'media' && n.type !== 'final'; }).sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (n) {
      var sum = summary(n), d = n.d, more = '';
      if (n.type === 'subject' && d.subject) more = d.subject.kind === 'shop' ? ' (TikTok Shop video id ' + d.subject.id + ', not imported yet)' : d.subject.asset ? ' (library file ' + d.subject.asset + ')' : ' (an idea, no product)';
      if (n.type === 'creator' && d.creator && d.creator.asset) more = ' (picture ' + d.creator.asset + ')';
      if (n.type === 'script' && d.script) more = ' Shot: ' + String(d.script.shot || '').slice(0, 160);
      if (n.type === 'film' && d.film) more = d.film.state === 'run' ? ' (a render is running now)' : '';
      lines.push('Step ' + (ORDER.indexOf(n.type) + 1) + ', ' + T[n.type].title + ': ' + (isDone(n) && sum ? sum.t + (sum.s ? ' · ' + sum.s : '') : d.via === 'chat' ? 'being typed by the person' : sum ? sum.t + ' (not confirmed)' : 'not answered yet') + more);
    });
    if (!lines.length) return '';
    lines.push('Final video: ' + p.tracks.video.length + (p.tracks.video.length === 1 ? ' clip' : ' clips'));
    lines.push(cur ? 'Waiting on the person: step ' + (ORDER.indexOf(cur.type) + 1) + ', ' + T[cur.type].title.toLowerCase() : 'No step is waiting.');
    return lines.join('\n');
  }
  window.EmberFlow = { open: open0, close: close, place: place, dropped: dropped, lay: lay, fit: fit, shopClick: shopClick, describe: describe, boardText: boardText, dropHint: dropHint, guiding: function () { return !!current(); }, showFinal: function () { var fn = finalNode(); if (fn) open(fn.id); },
    working: function () { var on = !root.hidden && G.open && node(G.open); return !!on && on.type !== 'media' && on.type !== 'final' && !isDone(on); },   // a step is open and not finished
    refresh: function () { if (!root.hidden) { sync(); draw(); renderPanel(); } }, seen: function () { try { return !!localStorage.getItem(SEEN); } catch (e) { return true; } } };
})();
