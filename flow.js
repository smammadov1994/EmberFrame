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
      say: 'Start with what the video is about. A product that is already selling is the fastest way in. Your own pictures, or just an idea, work too.' },
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
  var ORDER = ['subject', 'creator', 'format', 'script', 'voice', 'film'];
  var MAKES = [
    { id: 'clip', icon: I.point, t: 'Clip it', d: 'Your creator points up at the product and tells people why to buy it.', person: true },
    { id: 'pitch', icon: I.person, t: 'Talk to camera', d: 'Your creator holds it up and pitches it straight to the lens.', person: true },
    { id: 'showcase', icon: I.bag, t: 'Product showcase', d: 'A cinematic close-up of the product. No one on camera.' },
    { id: 'free', icon: I.spark, t: 'My own idea', d: 'Describe any shot and we film it.' }
  ];

  /* ---------- the graph ---------- */
  function rid() { return 'n' + Math.random().toString(36).slice(2, 8); }
  function mk(type, x, y) { return { id: rid(), type: type, x: Math.round(x), y: Math.round(y), d: type === 'subject' ? { tab: 'shop', sort: 'trending' } : type === 'format' ? { seconds: 8 } : {} }; }
  function fresh() { var n = mk('subject', 0, 0); return { guided: true, view: null, nodes: [n], wires: [], open: n.id }; }
  var G = null;
  try { G = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!G || !G.nodes || !G.nodes.length || !G.wires) G = fresh();
  G.nodes.forEach(function (n) { if (n.type === 'film' && n.d.film && n.d.film.state === 'run') n.d.film = null; });   // a render cannot be picked up after a reload
  var V = G.view || { x: 0, y: 0, k: 1 };
  function keep() { G.view = V; try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) {} }
  function P() { return S.project(); }
  function has(id) { return !!(id && P() && P().assets[id]); }
  function node(id) { return G.nodes.filter(function (n) { return n.id === id; })[0] || null; }
  function ins(id) { return G.wires.filter(function (w) { return w.to === id; }).map(function (w) { return node(w.from); }).filter(Boolean); }
  function outs(id) { return G.wires.filter(function (w) { return w.from === id; }).map(function (w) { return node(w.to); }).filter(Boolean); }
  function ctx(id) {                                         // the nearest node of each kind, looking back along the wires
    var out = {}, seen = {}, q = [id];
    while (q.length) { var n = node(q.shift()); if (!n || seen[n.id]) continue; seen[n.id] = 1; if (!out[n.type]) out[n.type] = n; ins(n.id).forEach(function (m) { q.push(m.id); }); }
    return out;
  }
  function below(id) {
    var out = [], seen = {}, q = outs(id).map(function (n) { return n.id; });
    while (q.length) { var n = node(q.shift()); if (!n || seen[n.id]) continue; seen[n.id] = 1; out.push(n); outs(n.id).forEach(function (m) { q.push(m.id); }); }
    return out;
  }
  function isDone(n) {
    var d = n.d;
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
      if (d.subject && d.subject.kind === 'asset' && !has(d.subject.asset)) { d.subject = null; changed(n); }
      if (d.creator && d.creator.kind === 'avatar' && !has(d.creator.asset)) { d.creator = null; changed(n); }
      if (d.voice && d.voice.kind === 'own' && !has(d.voice.asset)) d.voice = null;
      if (d.film && d.film.state === 'done' && !has(d.film.asset)) d.film = null;
    });
    if (G.open && !node(G.open)) G.open = null;
  }
  function freeSpot(x, y) {
    var hit = function () { return G.nodes.some(function (n) { return Math.abs(n.x - x) < NW + 30 && Math.abs(n.y - y) < NH + 24; }); };
    while (hit()) y += NH + 44;
    return { x: x, y: y };
  }
  function addNode(type, x, y, from, to) {
    var at = freeSpot(x, y), n = mk(type, at.x, at.y);
    G.nodes.push(n);
    if (from) G.wires.push({ from: from, to: n.id });
    if (to) { G.wires.push({ from: n.id, to: to }); clear(node(to), true); changed(node(to)); }
    return n;
  }
  function connect(a, b) {
    if (a.id === b.id || G.wires.some(function (w) { return w.from === a.id && w.to === b.id; })) return;
    if (b.id === a.id || below(b.id).some(function (m) { return m.id === a.id; })) return void say('That would make a loop. A wire has to lead forward.');
    G.wires.push({ from: a.id, to: b.id }); clear(b, true); changed(b);
    keep(); draw(); renderPanel();
  }
  function removeNode(n) {
    if (G.nodes.length < 2) return;
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
    var r = view.getBoundingClientRect(), phone = r.width < 760, pw = !panel.hidden && !phone ? panel.offsetWidth + 24 : 0;
    return { w: r.width - pw, h: phone && !panel.hidden ? r.height * 0.42 : r.height, left: r.left, top: r.top };
  }
  function toWorld(cx, cy) { var r = view.getBoundingClientRect(); return { x: (cx - r.left - V.x) / V.k, y: (cy - r.top - V.y) / V.k }; }
  function focusOn(n) { var r = room(); V.x = r.w / 2 - (n.x + NW / 2) * V.k; V.y = r.h / 2 - (n.y + NH / 2) * V.k; apply(true); keep(); }
  function fit() {
    var r = room(), xs = G.nodes.map(function (n) { return n.x; }), ys = G.nodes.map(function (n) { return n.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs) + NW, y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys) + NH;
    V.k = clamp(Math.min((r.w - 120) / (x1 - x0), (r.h - 120) / (y1 - y0)), 0.35, 1.15);
    V.x = r.w / 2 - (x0 + x1) / 2 * V.k; V.y = r.h / 2 - (y0 + y1) / 2 * V.k; apply(true); keep();
  }
  function zoomAt(cx, cy, k) {
    var r = view.getBoundingClientRect(), px = cx - r.left, py = cy - r.top; k = clamp(k, 0.35, 1.6);
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
  }
  wiresEl.addEventListener('dblclick', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-w'); if (i === null || i === undefined) return;
    var w = G.wires[Number(i)], b = w && node(w.to); if (!w) return;
    G.wires.splice(Number(i), 1); if (b) { clear(b, true); changed(b); }
    keep(); draw(); renderPanel();
  });
  function summary(n) {
    var d = n.d, t = '', s = '', img = '', c;
    if (n.type === 'subject' && d.subject) { t = d.subject.title || 'An idea'; img = d.subject.poster || ''; s = d.subject.kind === 'shop' ? (d.subject.price ? money(d.subject.price) + ' · ' : '') + 'TikTok Shop' : d.subject.kind === 'asset' ? 'Your own' : 'An idea'; }
    if (n.type === 'creator' && d.creator) { t = d.creator.kind === 'none' ? 'No one on camera' : d.creator.kind === 'describe' ? d.creator.text : (d.creator.title || 'My avatar'); img = d.creator.poster || ''; s = d.creator.kind === 'avatar' ? 'Your creator' : d.creator.kind === 'describe' ? 'Described' : 'Product only'; }
    if (n.type === 'format' && d.make === 'asis') { t = 'Edit it as it is'; s = 'No filming'; }
    else if (n.type === 'format' && d.make) { t = MAKES.filter(function (x) { return x.id === d.make; })[0].t; s = d.seconds + ' seconds · ' + money(cost(d.seconds)); }
    if (n.type === 'script' && d.script) { t = d.script.line ? '"' + d.script.line + '"' : d.script.shot; s = d.script.line ? d.script.line.split(/\s+/).length + ' words' : 'No speech'; }
    if (n.type === 'voice' && d.voice) { t = d.voice.kind === 'model' ? 'The presenter speaks' : d.voice.kind === 'fish' ? d.voice.title : 'My own voice'; s = d.voice.kind === 'model' ? 'Lips match' : 'Voiceover'; }
    if (n.type === 'film' && d.film) { c = ctx(n.id); t = d.film.state === 'done' ? 'Filmed' : d.film.state === 'run' ? 'Filming now' : 'Did not finish'; s = d.film.state === 'done' ? 'On your timeline' : d.film.state === 'run' ? 'A few minutes' : 'Open to try again'; img = d.film.state === 'done' && has(d.film.asset) ? thumb(P().assets[d.film.asset]) : ''; }
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
      if (port) { tmp = sv('path', { 'class': 'gw temp' }); wiresEl.appendChild(tmp); }
      var move = function (mv) {
        if (!moved && Math.abs(mv.clientX - x0) + Math.abs(mv.clientY - y0) < 5) return;
        moved = true;
        if (port) { var w = toWorld(mv.clientX, mv.clientY); tmp.setAttribute('d', curve(me.x + NW, me.y + NH / 2, w.x, w.y)); return; }
        e.classList.add('drag'); me.x = Math.round(ox + (mv.clientX - x0) / V.k); me.y = Math.round(oy + (mv.clientY - y0) / V.k);
        e.style.left = me.x + 'px'; e.style.top = me.y + 'px'; drawWires();
      };
      var up = function (u) {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        e.classList.remove('drag'); if (tmp) tmp.remove();
        if (port) {
          var hit = document.elementFromPoint(u.clientX, u.clientY), box = hit && hit.closest ? hit.closest('.gn') : null, t = box && node(box.getAttribute('data-id'));
          if (moved && t && t.id !== me.id) connect(me, t);
          else showMenu(me, moved ? toWorld(u.clientX, u.clientY) : { x: me.x + NW + GAP, y: me.y + NH / 2 });
        } else if (moved) keep();
        else open(me.id);
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    return e;
  }
  function paint(n, e) {
    var m = T[n.type], done = isDone(n), need = needs(n), sum = summary(n), box = e.querySelector('.gn-s');
    e.className = 'gn ' + n.type + (done ? ' done' : '') + (n.id === G.open ? ' open' : '') + (need.length ? ' need' : '') + (e.classList.contains('new') ? ' new' : '') +
      (n.type === 'film' && n.d.film && n.d.film.state === 'run' ? ' busy' : '');
    e.style.left = n.x + 'px'; e.style.top = n.y + 'px';
    e.querySelector('.fn-ic').innerHTML = svg(m.icon);
    e.querySelector('small').textContent = m.title; e.querySelector('b').textContent = done || sum ? m.title : m.ask;
    e.querySelector('.fn-t small').textContent = done ? '' : need.length ? 'Waiting' : n.id === G.open ? 'Now' : 'To do';
    box.textContent = '';
    if (done) return;                                        // a finished node says so with its green border, nothing more
    if (sum) { var th = el('span', { class: 'th', html: sum.img ? '' : svg(m.icon) }); if (sum.img) th.style.backgroundImage = 'url("' + sum.img + '")'; box.appendChild(th); box.appendChild(el('div', {}, [el('b', { text: sum.t }), el('span', { text: sum.s })])); }
    else box.appendChild(el('p', { text: need.length ? 'Needs ' + need.map(function (x) { return T[x.type].title.toLowerCase(); }).join(' and ') + ' first.' : m.hint }));
  }
  function draw() {
    var have = {};
    G.nodes.forEach(function (n) {
      have[n.id] = 1; var e = els[n.id];
      if (!e) { e = els[n.id] = build(n); e.classList.add('new'); world.appendChild(e); setTimeout(function () { e.classList.remove('new'); }, 700); }
      paint(n, e);
    });
    Object.keys(els).forEach(function (id) { if (!have[id]) { els[id].remove(); delete els[id]; } });
    drawWires();
    var sw = $('#flow-guided'); sw.setAttribute('aria-checked', String(!!G.guided));
    var on = G.open && node(G.open), left = G.nodes.filter(function (n) { return !isDone(n); }).length;
    $('#flow-step').textContent = on ? T[on.type].title : left ? left + ' to do' : 'All done';
    if (on) { var nd = needs(on); say(nd.length ? 'This one needs ' + nd.map(function (x) { return T[x.type].title.toLowerCase(); }).join(' and ') + ' first. Add it from here, or drag a wire into this node.' : guideFor(on)); }
    else say(G.guided ? 'Click a node to open it. I will add the next one as you finish each step. The editor opens once your clip is filmed.' : 'Drag a line out of a node\'s + to add what comes next, or double-click the board for a new node. Scroll to move, pinch or Ctrl-scroll to zoom.');
  }
  function guideFor(n) {
    if (n.type === 'film' && n.d.film && n.d.film.state === 'done') return 'Filmed. Have a look, then open it in the editor and we finish it together.';
    if (n.type === 'film' && n.d.film && n.d.film.state === 'run') return 'Filming now. This takes a few minutes; you can leave this open.';
    if (isDone(n) && !G.guided) return 'Done. Drag a line out of its + to choose what comes next.';
    return T[n.type].say;
  }
  function open(id) { G.open = id; hideMenu(); keep(); draw(); renderPanel(); var n = node(id); if (n) focusOn(n); }
  function complete(n) {                                     // a node has what it needs: lead on, or leave the next move to them
    keep(); draw();
    if (!G.guided) return void renderPanel();
    var o = outs(n.id);
    if (o.length) return void open(o[0].id);
    var c = ctx(n.id), next = ORDER.filter(function (t) { return !c[t]; })[0];
    if (!next || n.type === 'film') return void renderPanel();
    open(addNode(next, n.x + NW + GAP, n.y, n.id).id);
  }

  /* ---------- the "what next" menu ---------- */
  function hideMenu() { menuEl.hidden = true; }
  function showMenu(from, at) {
    var c = from ? ctx(from.id) : {}, next = ORDER.filter(function (t) { return !c[t]; })[0], r = view.getBoundingClientRect();
    menuEl.textContent = '';
    menuEl.appendChild(el('h4', { text: from ? 'What comes next?' : 'Add a node' }));
    ORDER.forEach(function (t) {
      menuEl.appendChild(el('button', { type: 'button', class: t === next && from ? 'hot' : null, onclick: function () {
        hideMenu(); var n = addNode(t, at.x, at.y - NH / 2, from ? from.id : null); keep(); open(n.id);
      } }, [el('span', { class: 'fn-ic', html: svg(T[t].icon) }), el('span', { class: 'tx' }, [el('b', { text: T[t].title }), el('span', { text: T[t].hint })]), t === next && from ? el('em', { text: 'Suggested' }) : null]));
    });
    menuEl.hidden = false;
    menuEl.style.left = clamp(at.x * V.k + V.x, 12, r.width - menuEl.offsetWidth - 12) + 'px';
    menuEl.style.top = clamp(at.y * V.k + V.y - 40, 12, r.height - menuEl.offsetHeight - 12) + 'px';
  }
  view.addEventListener('pointerdown', function (e) {        // drag the board to move around
    if (e.button || e.target.closest('.gn, .flow-panel, .flow-menu, .flow-zoom')) return;
    hideMenu();
    var x0 = e.clientX, y0 = e.clientY, vx = V.x, vy = V.y;
    view.classList.add('panning');
    var move = function (m) { V.x = vx + m.clientX - x0; V.y = vy + m.clientY - y0; apply(false); };
    var up = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); view.classList.remove('panning'); keep(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
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
  $('#flow-fit').addEventListener('click', fit);
  $('#flow-guided').addEventListener('click', function () { G.guided = !G.guided; keep(); draw(); renderPanel(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !root.hidden) { if (!menuEl.hidden) hideMenu(); else if (G.open) { G.open = null; keep(); draw(); renderPanel(); } } });

  /* ---------- the panel: the open node says what it wants ---------- */
  function renderPanel() {
    var n = G.open && node(G.open);
    panel.hidden = !n; root.classList.toggle('has-panel', !!n);
    if (!n) return;
    var m = T[n.type], body = el('div', { class: 'fp-body' }), need = needs(n);
    panel.textContent = '';
    panel.appendChild(el('header', { class: 'fp-h' }, [el('span', { class: 'fn-ic', html: svg(m.icon) }), el('div', { class: 'fn-t' }, [el('small', { text: m.title }), el('b', { text: m.ask })]),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close (Esc)', html: svg(I.x), onclick: function () { G.open = null; keep(); draw(); renderPanel(); } })]));
    panel.appendChild(body);
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
    ({ subject: renderSubject, creator: renderCreator, format: renderFormat, script: renderScript, voice: renderVoice, film: renderFilm })[n.type](body, n);
    if (isDone(n) && !G.guided && n.type !== 'film' && !outs(n.id).length) body.appendChild(el('div', { class: 'f-foot' }, [
      el('button', { type: 'button', class: 'btn', html: 'Choose what comes next' + svg(I.arrow), onclick: function () { showMenu(n, { x: n.x + NW + GAP, y: n.y + NH / 2 }); } })]));
  }
  function refresh(n) { if (G.open === n.id) renderPanel(); draw(); }

  /* ---------- a picture from our own models (a frame of a short test shot) ---------- */
  var pic = null, picErr = '';
  function picturePanel(box, n, purpose, prompt, done) {
    var price = cost(5.2), online = S.status().gpu && S.status().gpu.online;
    if (pic) {
      box.appendChild(el('div', { class: 'f-prog' }, [el('b', { id: 'f-pic-note', text: pic.note }), el('span', { id: 'f-pic-time', text: '' })]));
      box.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
      box.appendChild(el('div', { class: 'f-foot' }, [el('p', { class: 'f-note', text: 'We film the shortest clip our video model makes and keep a frame from it.' }), el('span', { class: 'grow' }),
        el('button', { type: 'button', class: 'btn', text: 'Stop', onclick: function () { api('/api/stop', { method: 'POST' }).catch(function () {}); } })]));
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
  function renderSubject(box, n) {
    var d = n.d, pick = function (s) { d.subject = s; changed(n); complete(n); };
    box.appendChild(el('div', { class: 'f-tabs', role: 'tablist' }, [['shop', 'TikTok Shop', I.bag], ['own', 'My own', I.up], ['idea', 'An idea', I.spark]].map(function (t) {
      return el('button', { type: 'button', role: 'tab', 'aria-selected': String(d.tab === t[0]), html: svg(t[2]), onclick: function () { d.tab = t[0]; picErr = ''; keep(); renderPanel(); } }, [t[1]]);
    })));
    if (d.tab === 'shop') {
      var shop = P().shop || {}, vids = shop.videos || [];
      var q = el('input', { class: 'f-in', type: 'search', placeholder: 'Search products: skincare, kitchen, pets', value: shop.query || '', 'aria-label': 'Search TikTok Shop' });
      box.appendChild(el('form', { class: 'f-row', onsubmit: function (e) { e.preventDefault(); search(n, q.value.trim(), d.sort); } }, [q, el('button', { type: 'submit', class: 'btn', text: 'Search' })]));
      box.appendChild(seg([['trending', 'Trending'], ['top', 'Most viewed']], d.sort, function (v) { d.sort = v; keep(); search(n, q.value.trim(), v); }));
      var grid = el('div', { class: 'f-grid' });
      if ((shopBusy && !vids.length) || (!vids.length && !shopTried)) { for (var k = 0; k < 9; k++) grid.appendChild(el('div', { class: 'f-skel' })); if (!shopBusy) search(n, '', d.sort); }
      else if (shopErr && !vids.length) { box.appendChild(el('p', { class: 'f-note warn', text: shopErr })); box.appendChild(el('button', { type: 'button', class: 'btn', text: 'Try again', onclick: function () { search(n, q.value.trim(), d.sort); } })); return; }
      else {
        if (shopErr) box.appendChild(el('p', { class: 'f-note warn', text: shopErr + ' Showing your last results.' }));
        if (!vids.length) box.appendChild(el('p', { class: 'f-note', text: 'Nothing came back for that. Try a broader word.' }));
        vids.forEach(function (v, k) {
          var c = card(v.poster, v.product || v.title || 'Video', (v.price ? money(v.price) : '') + (v.units_7d ? ' · ' + short(v.units_7d) + ' sold / 7d' : ''), short(v.views) + ' views',
            d.subject && d.subject.kind === 'shop' && String(d.subject.id) === String(v.id), function () {
              pick({ kind: 'shop', id: String(v.id), title: v.product || v.title || 'Video', poster: v.poster, price: v.price, units: v.units_7d, creator: v.creator });
            });
          c.style.setProperty('--k', Math.min(k, 12)); grid.appendChild(c);
        });
      }
      box.appendChild(grid);
      if (vids.length && shop.more !== false) box.appendChild(el('button', { type: 'button', class: 'btn', disabled: shopBusy ? '' : null, text: shopBusy ? 'Loading' : 'Load 100 more',
        onclick: function () { search(n, shop.query || '', shop.sort || d.sort, vids.length + 100); } }));
    } else if (d.tab === 'own') {
      box.appendChild(dropzone('Drop a picture or a clip of it here', 'or click to choose a file', 'image/*,video/*', function (id) { var a = P().assets[id]; pick({ kind: 'asset', asset: id, title: a.name, poster: thumb(a) }); }));
      var mine = Object.keys(P().assets).map(function (k) { return P().assets[k]; }).filter(function (a) { return a.kind !== 'audio' && !a.reference && a.id !== P().avatar; }).reverse();
      if (mine.length) {
        box.appendChild(el('p', { class: 'f-note', text: 'Or use something already in your library.' }));
        var g2 = el('div', { class: 'f-grid' });
        mine.forEach(function (a, k) {
          var c = card(thumb(a), a.name, a.kind === 'image' ? 'picture' : S.fmt(a.duration), a.source === 'generated' ? 'AI' : '', d.subject && d.subject.asset === a.id, function () { pick({ kind: 'asset', asset: a.id, title: a.name, poster: thumb(a) }); }, true);
          c.style.setProperty('--k', Math.min(k, 12)); g2.appendChild(c);
        });
        box.appendChild(g2);
      }
    } else {
      var area = el('textarea', { class: 'f-area', rows: '3', placeholder: 'A matte black travel mug that keeps coffee hot all day', 'aria-label': 'Describe what the video is about' });
      area.value = d.idea || '';
      area.addEventListener('input', function () { d.idea = area.value; keep(); });
      box.appendChild(el('span', { class: 'f-lab' }, ['Describe it'])); box.appendChild(area);
      if (picErr) box.appendChild(el('p', { class: 'f-note warn', text: picErr }));
      var make = picturePanel(box, n, 'subject', function () { return area.value; }, function (id) { var a = P().assets[id]; pick({ kind: 'asset', asset: id, title: a.name, poster: thumb(a), text: area.value.trim() }); });
      if (make) box.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn btn-accent', text: 'Use this idea', onclick: function () { var t = area.value.trim(); if (t.length > 3) pick({ kind: 'idea', text: t, title: t }); else area.focus(); } }), make,
        el('p', { class: 'f-note', text: 'An idea alone is free. A picture is a frame from a short test shot.' })]));
    }
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
        [el('span', { html: svg(I.film, 24) }), el('b', { text: 'Edit it as it is' }), el('span', { text: 'No filming. Your clip opens in the editor.' })]);
      asis.style.setProperty('--k', 4); opts.appendChild(asis);
    }
    box.appendChild(opts);
    if (d.make === 'asis') {
      box.appendChild(el('div', { class: 'f-foot' }, [el('p', { class: 'f-note', text: 'Nothing is filmed and nothing is charged.' }), el('span', { class: 'grow' }),
        el('button', { type: 'button', class: 'btn btn-accent', html: 'Open it in the editor' + svg(I.arrow), onclick: function () { S.editAsset(sub.asset); } })]));
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
      } else if (ev.type === 'flow_script') n.d.script = { line: ev.line, shot: ev.shot, name: ev.name, words: ev.words, product_asset: ev.product_asset, reference_asset: ev.reference_asset };
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
      fresh: n.d.fresh === undefined || n.d.fresh === null ? starterCut() : n.d.fresh, approved: price }, function (ev) {
      if (ev.type === 'progress' && n.d.film) { n.d.film.note = ev.note; var nn = $('#f-film-note'); if (nn) nn.textContent = ev.note; }
      else if (ev.type === 'flow_film') { asset = ev.rendered ? ev.asset : null; why = ev.rendered ? '' : (ev.reason || 'The render did not finish.'); said = ev.heard !== undefined ? { heard: ev.heard, match: ev.match } : null; }
      else if (ev.type === 'error') why = ev.message;
    }).catch(function () { why = 'The connection dropped.'; }).then(function () {
      clearInterval(filmTick);
      n.d.film = asset ? { state: 'done', asset: asset, said: said, voiced: vo.kind !== 'model' ? vo : null } : { state: 'fail', reason: why || 'The render did not finish.' };
      keep(); refresh(n);
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
        el('button', { type: 'button', class: 'btn', text: 'Stop', onclick: function () { api('/api/stop', { method: 'POST' }).catch(function () {}); } })]));
    } else if (st === 'done') {
      var fm = d.film, bad = fm.said && fm.said.match < 0.8 && !fm.voiced;
      if (fm.voiced) bill.appendChild(el('p', { class: 'f-note ok', text: 'The line is spoken word for word by ' + (fm.voiced.kind === 'fish' ? fm.voiced.title : 'your own voice') + ', laid over the clip.' }));
      else if (fm.said && sc.line) bill.appendChild(el('p', { class: 'f-note ' + (bad ? 'warn' : 'ok'), text: bad
        ? 'The voice did not say the line. I heard: "' + (fm.said.heard || 'nothing clear') + '"'
        : 'I listened back: the line came out right (' + Math.round(fm.said.match * 100) + '% of the words).' }));
      if (d.fix === 'run') { bill.appendChild(el('div', { class: 'f-prog' }, [el('b', { text: 'Recording the voice' })])); bill.appendChild(el('div', { class: 'f-bar' }, [el('i')])); }
      else if (d.fix === 'pick') {
        bill.appendChild(el('span', { class: 'f-lab' }, ['Pick the voice that reads the line']));
        bill.appendChild(el('div', { class: 'f-line', text: sc.line }));
        voiceList(bill, n, fm.voiced && fm.voiced.voice_id, function (v) { fixVoice(n, v, sc.line); });
        bill.appendChild(el('p', { class: 'f-note', text: 'The clip\'s own speech is muted and this voice is laid over it, so the lips will not match the words.' }));
      } else if (sc.line) bill.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn' + (bad ? ' btn-accent' : ''), html: svg(I.mic) + (fm.voiced ? 'Change the voice' : 'Replace the voice'), onclick: function () { d.fix = 'pick'; renderPanel(); } }),
        d.fixErr ? el('p', { class: 'f-note warn', text: d.fixErr }) : el('p', { class: 'f-note', text: bad ? 'A library voice reads your exact line. No new render.' : 'Words wrong, or want a different voice? No new render needed.' })]));
      bill.appendChild(el('p', { class: 'f-note', text: 'It is on your timeline, labelled AI-generated. Open the editor to cut it, caption it and post it.' }));
      bill.appendChild(el('div', { class: 'f-foot' }, [
        el('button', { type: 'button', class: 'btn btn-accent', html: 'Open in the editor' + svg(I.arrow), onclick: function () { finish(n); } }),
        el('button', { type: 'button', class: 'btn', text: 'Film another take', onclick: function () { d.film = null; keep(); refresh(n); } })]));
    } else {
      if (st === 'fail') bill.appendChild(el('p', { class: 'f-note warn', text: d.film.reason }));
      bill.appendChild(el('div', { class: 'f-cost' }, [money(price), el('small', { text: f.seconds + ' seconds · 9:16 · with sound' })]));
      var freshCut = d.fresh === undefined || d.fresh === null ? starterCut() : d.fresh;
      if (p.tracks.video.length) bill.appendChild(el('div', { class: 'f-row' }, [seg([[true, 'Start a new cut'], [false, 'Add to my cut']], freshCut, function (v) { d.fresh = v; keep(); renderPanel(); }),
        el('p', { class: 'f-note', text: freshCut ? 'Your current cut is kept in Versions.' : 'It goes on the end of your timeline.' })]));
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
  function finish(n) {                                       // hand over to the editor and to Ember
    var a = n.d.film && n.d.film.asset, c = P().tracks.video.filter(function (v) { return v.asset === a; })[0];
    S.toEditor();
    if (c) S.seek(c.start);
    S.bubble('ember', 'Your clip is on the timeline. Play it, then tell me what to change. I can caption it word by word, tighten it, film the next shot, or write the post.');
    S.showNext([{ label: 'Add captions', say: 'Add captions from the speech.' }, { label: 'Animated captions', say: 'Make word-by-word animated captions for this clip with the motion engine, in the house look.' }, { label: 'Film the next shot', say: 'Film a second shot that follows this one: a close-up of the product.' }, { label: 'Write the post', say: 'Write the post for this video.' }]);
  }

  /* ---------- open and close ---------- */
  var closing = 0;
  function open0() {
    if (!P()) return;
    clearTimeout(closing); root.classList.remove('leaving');
    try { localStorage.setItem(SEEN, '1'); } catch (e) {}
    validate(); root.hidden = false;
    draw(); renderPanel();
    if (!G.view) { var n = (G.open && node(G.open)) || G.nodes[0]; V = { x: 0, y: 0, k: 1 }; focusOn(n); world.classList.remove('glide'); } else apply(false);
  }
  function close() {
    if (root.hidden || root.classList.contains('leaving')) return;
    stopTake(); if (player) player.pause();
    root.classList.add('leaving');
    closing = setTimeout(function () { root.hidden = true; root.classList.remove('leaving'); }, 430);
  }
  $('#flow-reset').addEventListener('click', function () { G = fresh(); V = { x: 0, y: 0, k: 1 }; shopTried = false; Object.keys(els).forEach(function (id) { els[id].remove(); delete els[id]; }); draw(); renderPanel(); focusOn(G.nodes[0]); keep(); });
  window.addEventListener('resize', function () { if (!root.hidden) apply(false); });
  $('#flow .flow-top .orb').innerHTML = S.mascot();
  window.EmberFlow = { open: open0, close: close, seen: function () { try { return !!localStorage.getItem(SEEN); } catch (e) { return true; } } };
})();
