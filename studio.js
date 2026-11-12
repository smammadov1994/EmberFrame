/* Emberframe Studio. Ember chat on the left, the editor on the right.
   The project document comes from the server (/api/project). The user changes it by
   dragging; Ember changes it through its tools; both end up as the same document. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var fmt = function (t) { t = Math.max(0, t || 0); var m = Math.floor(t / 60); var s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  var uid = function (p) { return p + '_' + Math.random().toString(16).slice(2, 8); };
  var svg = function (d, vb) { return '<svg viewBox="0 0 ' + (vb || 20) + ' ' + (vb || 20) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };

  /* ---------- Ember: a small flame with a face. Drawn here, so every part of it can move. ---------- */
  var emN = 0;
  function mascot(still) {
    var g = 'emg' + (emN++), ink = '#2B1206', line = '" fill="none" stroke="' + ink + '" stroke-width="1.8" stroke-linecap="round"/>';
    return '<svg class="em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">' +
      '<defs><radialGradient id="' + g + '" cx="50%" cy="72%" r="66%"><stop offset="0" stop-color="#FFEDB8"/><stop offset="0.42" stop-color="#FFB25C"/><stop offset="1" stop-color="#F2562A"/></radialGradient></defs>' +
      (still ? '' : '<g class="em-sparks" fill="#FFC27A"><circle cx="12" cy="22" r="1.7"/><circle cx="53" cy="17" r="1.4"/><circle cx="45" cy="7" r="1.1"/></g>') +
      '<g class="em-body"><path d="M34 6C34 13 40 16 45 21C50 26 53 31 53 38C53 49.5 43.6 58 32 58C20.4 58 11 49.5 11 38C11 29 17 22.5 24 19C29 16.5 33 12 34 6Z" fill="url(#' + g + ')"/>' +
      '<ellipse cx="21" cy="31" rx="2.6" ry="4.6" transform="rotate(30 21 31)" fill="#fff" opacity="0.3"/>' +
      '<g class="em-face"><ellipse cx="19.5" cy="45.6" rx="3.3" ry="2.1" fill="#FF5A36" opacity="0.4"/><ellipse cx="44.5" cy="45.6" rx="3.3" ry="2.1" fill="#FF5A36" opacity="0.4"/>' +
      '<g class="em-eyes"><g class="em-open"><ellipse cx="24.6" cy="40" rx="3.1" ry="4.1" fill="' + ink + '"/><ellipse cx="39.4" cy="40" rx="3.1" ry="4.1" fill="' + ink + '"/><circle cx="25.7" cy="38.4" r="1.15" fill="#fff"/><circle cx="40.5" cy="38.4" r="1.15" fill="#fff"/></g>' +
      (still ? '' : '<path class="em-arc" d="M21.4 41.8Q24.6 37 27.8 41.8M36.2 41.8Q39.4 37 42.6 41.8' + line + '<path class="em-shut" d="M21.6 40.4Q24.6 42.6 27.6 40.4M36.4 40.4Q39.4 42.6 42.4 40.4' + line) + '</g>' +
      '<path class="em-smile" d="M29.3 45.2Q32 47.9 34.7 45.2' + line +
      (still ? '' : '<ellipse class="em-o" cx="32" cy="46.3" rx="2" ry="2.3" fill="' + ink + '"/>') + '</g></g></svg>';
  }
  $$('.orb').forEach(function (o) { o.innerHTML = mascot(); });
  (function () {                                              // the same face in the browser tab
    var l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/svg+xml';
    l.href = 'data:image/svg+xml,' + encodeURIComponent(mascot(true));
    document.head.appendChild(l);
  })();
  var orbEl = $('#orb'), happyTimer = 0, lookAt = 0;
  function mood(m) { ['busy', 'talk', 'happy'].forEach(function (c) { orbEl.classList.toggle(c, c === m); }); }
  document.addEventListener('pointermove', function (e) {     // Ember watches the pointer
    var now = Date.now(); if (now - lookAt < 50) return; lookAt = now;
    $$('.orb').forEach(function (o) {
      var r = o.getBoundingClientRect(); if (!r.width) return;
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.62), d = Math.sqrt(dx * dx + dy * dy) || 1, k = Math.min(1, d / 140);
      o.style.setProperty('--lx', (dx / d * k * 2).toFixed(2) + 'px'); o.style.setProperty('--ly', (dy / d * k * 1.5).toFixed(2) + 'px');
    });
  });

  /* ---------- who is signed in (the site's stub accounts) ---------- */
  var user = null;
  try { user = JSON.parse(localStorage.getItem('ember_session') || 'null'); } catch (e) {}
  var projectId = 'main';                                    // which of the person's projects this window is on
  try { projectId = localStorage.getItem('ember_project_' + user) || 'main'; } catch (e) {}
  var headers = function (json) { var h = { 'X-Ember-User': user || 'local', 'X-Ember-Project': projectId }; if (json) h['Content-Type'] = 'application/json'; return h; };
  var api = function (path, opts) {
    opts = opts || {};
    return fetch(path, { method: opts.method || 'GET', headers: headers(!!opts.body && !(opts.body instanceof FormData)),
      body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.ok ? r.json() : r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.detail || 'Request failed'); }); });
  };
  function gate(title, text, code, go, href) {
    $('#gate-title').textContent = title; $('#gate-text').textContent = text;
    if (code) { $('#gate-code').textContent = code; $('#gate-code').hidden = false; }
    $('#gate-go').textContent = go; $('#gate-go').href = href;
    $('#gate').hidden = false;
  }

  /* ---------- state ---------- */
  var P = null;                 // the project
  var T = 0, playing = false;   // playhead (seconds) and transport
  var pps = 70;                 // timeline zoom: pixels per second
  var sel = null;               // selected clip or caption id
  var undo = [], redo = [];
  var saveTimer = 0, dirty = 0;
  var busy = false;             // Ember (or an action) is running
  var STATUS = {};
  var REVIEW = { findings: [], marks: [] };   // what Ember would point out in the cut (from /api/review)
  var seen = {}, reviewTimer = 0, turnPath = '', nextEl = null, shown = null, turnFailed = false;
  var rec = null;               // a voice recording in progress
  var changeListeners = [];

  function A(id) { return P.assets[id]; }
  function clipLen(c) { return c.out - c.in; }
  function layout() {           // same rules as the server's normalize()
    var t = 0;
    P.tracks.video.forEach(function (c) { c.start = t; t += clipLen(c); });
    var end = t;
    P.tracks.audio.forEach(function (c) { end = Math.max(end, c.start + clipLen(c)); });
    P.tracks.captions.sort(function (a, b) { return a.start - b.start; });
    P.duration = end;
  }
  function snapshot() { return JSON.stringify({ tracks: P.tracks, name: P.name, aspect: P.aspect }); }
  function remember() { REVIEW.marks = []; undo.push(snapshot()); if (undo.length > 80) undo.shift(); redo = []; }
  function restore(s) { var o = JSON.parse(s); P.tracks = o.tracks; P.name = o.name; P.aspect = o.aspect; layout(); drawAll(); save(); }
  function changed() { layout(); drawAll(); save(); }
  function saved(text) { var n = $('#s-saved'); n.textContent = text; }
  function save() {
    var mine = ++dirty;
    saved('Saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      api('/api/project', { method: 'PUT', body: { tracks: P.tracks, name: P.name, aspect: P.aspect } }).then(function (p) {
        if (mine === dirty) { P.version = p.version; P.assets = p.assets; saved('Saved'); scheduleReview(true, 2200); }
      }).catch(function () { saved('Not saved'); });
    }, 350);
  }
  function setProject(p, fromEmber) {
    if (fromEmber && P) undo.push(snapshot());           // Ember's edits can be undone too
    if (P && P.canvas && !p.canvas) p.canvas = P.canvas;
    if (P && P.shop && p.shop === undefined) p.shop = P.shop;   // Shop rows only travel when they change
    P = p; layout();
    syncBrowseBtn();
    T = clamp(T, 0, P.duration);
    drawAll();
  }

  /* ---------- library ---------- */
  var ICON_AUDIO = svg('<path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4"/>', 24);
  function drawLibrary() {
    var box = $('#lib-media'); box.textContent = '';
    var list = Object.keys(P.assets).map(function (k) { return P.assets[k]; }).reverse();
    if (!list.length) box.appendChild(el('p', { class: 'lib-empty', text: 'Your library is empty. Drop files here, or ask Ember to film a shot.' }));
    list.forEach(function (a) {
      var th = el('div', { class: 'th', html: a.kind === 'audio' ? ICON_AUDIO : '' });
      if (a.poster_url) th.style.backgroundImage = 'url(' + a.poster_url + ')';
      else if (a.kind === 'image') th.style.backgroundImage = 'url(' + a.url + ')';
      var tag = a.id === P.avatar ? ['me', 'My avatar'] : a.reference ? ['ref', 'Reference'] : a.source === 'generated' ? ['gen', 'AI'] : a.source === 'voice' ? ['voice', 'Voice'] : ['', a.source];
      var card = el('div', { class: 'as', draggable: 'true', title: a.name }, [
        th,
        el('span', { class: 'src ' + tag[0], text: tag[1] }),
        el('div', { class: 'meta' }, [el('b', { text: a.name }), el('span', { text: a.kind === 'image' ? 'image' : fmt(a.duration) })]),
        a.kind !== 'image' ? el('button', { type: 'button', class: 'add', 'aria-label': 'Add ' + a.name + ' to the timeline', text: '+', onclick: function () { addAsset(a.id); } })
          : !a.reference ? el('button', { type: 'button', class: 'add me' + (a.id === P.avatar ? ' is' : ''), title: a.id === P.avatar ? 'This is your avatar. Click to clear.' : 'Use as my avatar', 'aria-label': 'Use ' + a.name + ' as my avatar',
              html: svg('<circle cx="10" cy="7" r="3.2"/><path d="M3.8 16.5c.8-3.2 3.200-4.800 6.200-4.800s5.400 1.600 6.200 4.800"/>'), onclick: function () { setAvatar(a.id === P.avatar ? null : a.id); } }) : null,
        el('button', { type: 'button', class: 'rm', 'aria-label': 'Remove ' + a.name + ' from the library', text: '✕', onclick: function () {
          api('/api/asset/' + a.id, { method: 'DELETE' }).then(function (p) { setProject(p); });
        } })
      ]);
      card.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/ember-asset', a.id); e.dataTransfer.effectAllowed = 'copy'; });
      box.appendChild(card);
    });
    var shop = $('#lib-shop'); shop.textContent = '';
    var vids = (P.shop && P.shop.videos) || [];
    $('#shop-count').textContent = vids.length ? String(vids.length) : '';
    if (!vids.length) shop.appendChild(el('p', { class: 'lib-empty', text: 'Ask Ember what is selling, for example "find trending skincare videos". Results land here.' }));
    if (vids.length) {
      var all = el('button', { type: 'button', class: 'sv-all', text: 'Open all ' + vids.length + ' videos', onclick: function () { openBrowse(defaultCanvas()); } });
      all.insertAdjacentHTML('beforeend', svg('<path d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"/>'));
      shop.appendChild(all);
    }
    var n = function (x) { return x >= 1e6 ? (x / 1e6).toFixed(1).replace('.0', '') + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(x || 0); };
    vids.forEach(function (v, k) {                             // a grid of posters, the same cards as the full view
      var card = el('button', { type: 'button', class: 'vcard', title: v.product || v.title, onclick: function () {
        send('I pick this one: "' + (v.product || v.title || 'video').slice(0, 80) + '" by @' + (v.creator || 'creator') + ' (video id ' + v.id + ').');
      } }, [
        el('img', { src: v.poster || '', alt: '', loading: 'lazy' }),
        el('span', { class: 'vtop' }, [el('span', { class: 'vchips' }, [el('span', { class: 'chip', text: n(v.views) + ' views' })])]),
        el('span', { class: 'pick', text: 'Work from this' }),
        el('span', { class: 'ov' }, [el('b', { text: v.product || v.title }), el('span', { text: (v.price ? '$' + v.price : '@' + (v.creator || 'creator')) + (v.units_7d ? ' · ' + n(v.units_7d) + ' sold' : '') })])
      ]);
      card.style.setProperty('--k', Math.min(k, 12));
      card.draggable = true;                                  // drag it onto the canvas to work from it
      card.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/ember-shop', String(v.id)); e.dataTransfer.effectAllowed = 'copy'; });
      shop.appendChild(card);
    });
    if (vids.length && P.shop.more !== false) shop.appendChild(el('button', { type: 'button', class: 'sv-all more', text: shopBusy ? 'Loading' : 'Load 100 more', onclick: function () { shopSearch(P.shop.query || '', P.shop.sort || 'trending', vids.length + 100); } }));
  }
  /* ---------- Shop: search and paging, without filling the chat ---------- */
  var shopBusy = false, shopNote = '';
  function quiet(name, args, on) {                            // run a studio action and take its project updates, silently
    return fetch('/api/action', { method: 'POST', headers: headers(true), body: JSON.stringify({ name: name, args: args }) }).then(function (r) {
      if (!r.ok || !r.body) throw new Error('The studio did not answer.');
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      var pump = function () {
        return reader.read().then(function (res) {
          if (res.done) return;
          buf += dec.decode(res.value, { stream: true });
          var parts = buf.split('\n\n'); buf = parts.pop();
          parts.forEach(function (chunk) { chunk.split('\n').forEach(function (line) {
            if (line.indexOf('data: ') !== 0) return;
            var ev; try { ev = JSON.parse(line.slice(6)); } catch (e) { return; }
            if (ev.type === 'project') setProject(ev.project);
            if (on) on(ev);
          }); });
          return pump();
        });
      };
      return pump();
    });
  }
  function shopSearch(query, sort, n) {
    if (shopBusy) return;
    shopBusy = true; shopNote = ''; redrawShop();
    quiet('shop_search', { sort: sort, query: query || null, n: n || 100 }, function (ev) {
      if (ev.type === 'step' && ev.state === 'fail') shopNote = String(ev.detail || 'The Shop search did not answer.').replace(/^\w+Error: /, '');
      else if (ev.type === 'error') shopNote = ev.message;
    }).catch(function () { shopNote = 'The Shop search did not answer.'; }).then(function () { shopBusy = false; redrawShop(); });
  }
  function redrawShop() { drawLibrary(); if (isBrowse() && shown && shown.shop) renderCanvas(shopCanvas(), true); }
  function setAvatar(id) {                                    // the person's own creator: the face their clips are filmed from
    return api('/api/project', { method: 'PUT', body: { avatar: id } }).then(function (p) {
      setProject(p); note(id ? '"' + A(id).name + '" is now your avatar. Clips of you are filmed from it.' : 'Avatar cleared.');
    }).catch(function (e) { note('Could not set the avatar. ' + e.message); });
  }
  function addAsset(id, index, start) {
    var a = A(id); if (!a || a.kind === 'image') return;
    remember();
    var c = { id: uid('c'), asset: id, in: 0, out: a.duration, volume: 1 };
    if (a.kind === 'audio') { c.start = start === undefined ? T : start; P.tracks.audio.push(c); }
    else P.tracks.video.splice(index === undefined ? P.tracks.video.length : index, 0, c);
    sel = c.id; changed();
  }
  function showTab(which) {
    $$('.lib-tabs [role=tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x.getAttribute('data-tab') === which)); });
    $('#lib-media').hidden = which !== 'media'; $('#lib-shop').hidden = which !== 'shop';
  }
  $$('.lib-tabs [role=tab]').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });
  function uploadFiles(files, where, at) {                    // where: 'library' (default), 'cut' (also onto the timeline), 'chat' (hand it to Ember)
    var chain = Promise.resolve(), added = [];
    Array.prototype.forEach.call(files, function (f) {
      chain = chain.then(function () {
        var n = note('Uploading ' + f.name);
        var fd = new FormData(); fd.append('file', f);
        return api('/api/upload', { method: 'POST', body: fd }).then(function (r) {
          setProject(r.project); showTab('media'); added.push(r.asset);
          var a = A(r.asset);
          if (where === 'cut' && a.kind !== 'image') { addAsset(r.asset, a.kind === 'audio' ? undefined : indexAt(at === undefined ? 1e9 : at), a.kind === 'audio' ? Math.max(0, at || 0) : undefined); n.textContent = 'Added ' + f.name + ' to the cut.'; }
          else if (where === 'canvas' && window.EmberFlow) {    // the first file starts a workflow (or wires into the node it landed on); the rest sit beside it
            if (added.length === 1) window.EmberFlow.dropped(r.asset, at.x, at.y, at.onto); else window.EmberFlow.place(r.asset, at.x, at.y + (added.length - 1) * 150);
            n.textContent = 'Put ' + f.name + ' on the canvas.';
          }
          else n.textContent = 'Added ' + f.name + ' to the library.';
          if (a.kind === 'image' && !P.avatar) {               // a photo and no avatar yet: offer the obvious
            var row = el('div', { class: 'next' }, [el('button', { type: 'button', text: 'Use as my avatar', onclick: function () { row.remove(); setAvatar(r.asset); } })]);
            log.appendChild(row); scrollLog();
          }
          if (window.EmberFlow && window.EmberFlow.refresh) window.EmberFlow.refresh();
        })
          .catch(function (e) { n.textContent = 'Could not upload ' + f.name + '. ' + e.message; });
      });
    });
    return chain.then(function () {
      if (where === 'chat' && added.length && !busy) {         // dropped on Ember: start the sentence for them
        var names = added.map(function (id) { return '"' + A(id).name + '"'; }).join(' and ');
        if (!input.value.trim()) input.value = 'About ' + names + ': ';
        input.focus(); input.setSelectionRange(input.value.length, input.value.length);
      }
      return added;
    });
  }
  ['#upload', '#upload-chat'].forEach(function (s) { $(s).addEventListener('change', function (e) { uploadFiles(e.target.files, s === '#upload-chat' ? 'chat' : 'library'); e.target.value = ''; }); });
  /* ---------- drop files anywhere: from a folder onto the library, the timeline or Ember ---------- */
  var veil = $('#drop-veil'), dragDepth = 0;
  function hasFiles(e) { return !!e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  function dropPlace(e) { var t = e.target && e.target.closest ? e.target : null; return !t ? 'library' : t.closest('.flow-panel') ? 'library' : t.closest('#flow-view') ? 'canvas' : t.closest('.chat') ? 'chat' : 'library'; }
  function veilOff() { dragDepth = 0; veil.hidden = true; $$('.drop-here').forEach(function (n) { n.classList.remove('drop-here'); }); }
  window.addEventListener('dragenter', function (e) { if (!hasFiles(e) || !P) return; e.preventDefault(); dragDepth++; veil.hidden = false; });
  window.addEventListener('dragover', function (e) {
    if (!hasFiles(e) || !P) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    var place = dropPlace(e), zone = place === 'canvas' ? $('#flow-view') : place === 'chat' ? $('.chat') : $('#lib');
    $('#drop-text').textContent = place === 'canvas' ? 'Drop to put it on the canvas' : place === 'chat' ? 'Drop to give it to Ember' : 'Drop to add to your library';
    $$('.drop-here').forEach(function (n) { if (n !== zone) n.classList.remove('drop-here'); });
    zone.classList.add('drop-here');
  });
  window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) veilOff(); });
  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    var place = dropPlace(e), handled = e.defaultPrevented;    // a drop zone of its own (the workflow's) has already taken it
    e.preventDefault(); veilOff();
    if (handled || !P || !e.dataTransfer.files.length) return;
    var hitNode = e.target.closest ? e.target.closest('.gn') : null;
    uploadFiles(e.dataTransfer.files, place, place === 'canvas' ? { x: e.clientX, y: e.clientY, onto: hitNode ? hitNode.getAttribute('data-id') : null } : undefined);
  });

  /* ---------- timeline ---------- */
  var lanes = { video: $('#lane-video'), audio: $('#lane-audio'), captions: $('#lane-captions') };
  var scroll = $('#tl-scroll'), inner = $('#tl-inner');
  function drawTimeline() {
    var w = Math.max(scroll.clientWidth, (P.duration + 6) * pps);
    inner.style.width = w + 'px';
    var ruler = $('#ruler'); ruler.textContent = '';
    var major = pps >= 120 ? 1 : pps >= 50 ? 2 : 5, minor = major === 1 ? 0.5 : 1;
    for (var s = 0; s * pps < w; s += minor) {
      var isMajor = Math.abs(s / major - Math.round(s / major)) < 1e-6;
      var i = el('i', { class: isMajor ? '' : 'min' }, isMajor ? [el('b', { text: fmt(s).replace('.0', '') })] : []);
      i.style.left = s * pps + 'px'; ruler.appendChild(i);
    }
    Object.keys(lanes).forEach(function (k) { lanes[k].textContent = ''; });
    P.tracks.video.forEach(function (c) { lanes.video.appendChild(clipEl(c, 'video')); });
    P.tracks.audio.forEach(function (c) { lanes.audio.appendChild(clipEl(c, 'audio')); });
    P.tracks.captions.forEach(function (c) { lanes.captions.appendChild(clipEl(c, 'captions')); });
    (REVIEW.marks || []).forEach(function (m) {              // dead air and slivers, drawn where they are
      var fl = el('i', { class: 'flag ' + m.kind, title: m.kind === 'quiet' ? 'Dead air' : 'Leftover sliver' });
      fl.style.left = m.start * pps + 'px'; fl.style.width = Math.max(3, (m.end - m.start) * pps) + 'px';
      lanes.video.appendChild(fl);
    });
    drawHead();
    $('#t-all').textContent = fmt(P.duration);
    $('#t-del').disabled = !sel; $('#t-undo').disabled = !undo.length; $('#t-redo').disabled = !redo.length;
    $('#empty').hidden = P.tracks.video.length > 0;
    drawInspector();
  }
  function clipEl(c, track) {
    var a = track === 'captions' ? null : A(c.asset);
    var len = track === 'captions' ? c.end - c.start : clipLen(c);
    var n = el('div', { class: 'clip ' + (track === 'audio' ? 'a' : track === 'captions' ? 'c' : 'v') + (c.id === sel ? ' sel' : '') + (a && a.reference ? ' ref' : ''), 'data-id': c.id }, [
      track === 'video' ? el('span', { class: 'film' }) : null,
      a && a.wave_url ? el('span', { class: 'wave' }) : null,
      el('span', { class: 'nm', text: track === 'captions' ? c.text : a.name }),
      track !== 'captions' ? el('span', { class: 'du', text: len.toFixed(1) + 's' }) : null,
      el('span', { class: 'h l' }), el('span', { class: 'h r' })
    ]);
    n.style.left = c.start * pps + 1 + 'px'; n.style.width = Math.max(8, len * pps - 2) + 'px';
    if (track === 'video' && a.poster_url) $('.film', n).style.backgroundImage = 'url(' + a.poster_url + ')';
    if (a && a.wave_url) {                                   // show the part of the sound this clip actually uses
      var wv = $('.wave', n);
      wv.style.backgroundImage = 'url(' + a.wave_url + ')';
      wv.style.backgroundSize = a.duration * pps + 'px 100%';
      wv.style.backgroundPosition = -c.in * pps + 'px 0';
    }
    n.addEventListener('pointerdown', function (e) { startDrag(e, c, track, n); });
    return n;
  }
  function drawHead() {
    $('#playhead').style.left = T * pps + 'px';
    $('#t-now').textContent = fmt(T);
  }
  function seek(t, keepPlaying) {
    T = clamp(t, 0, P.duration);
    if (!keepPlaying && playing) pause();
    drawHead(); syncMedia(true);
  }
  function scrub(e) {             // click or drag on the ruler and empty lane area moves the playhead
    var move = function (ev) { var r = inner.getBoundingClientRect(); seek((ev.clientX - r.left) / pps); };
    move(e);
    var up = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  $('#ruler').addEventListener('pointerdown', scrub);
  $('#playhead').firstElementChild.addEventListener('pointerdown', function (e) { e.preventDefault(); scrub(e); });
  Object.keys(lanes).forEach(function (k) {
    var lane = lanes[k];
    lane.addEventListener('pointerdown', function (e) { if (e.target === lane) { sel = null; scrub(e); drawTimeline(); } });
    lane.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('text/ember-asset') >= 0) { e.preventDefault(); lane.classList.add('over'); } });
    lane.addEventListener('dragleave', function () { lane.classList.remove('over'); });
    lane.addEventListener('drop', function (e) {
      lane.classList.remove('over');
      var id = e.dataTransfer.getData('text/ember-asset'); if (!id) return;
      e.preventDefault();
      var t = (e.clientX - inner.getBoundingClientRect().left) / pps;
      if (A(id).kind === 'audio') addAsset(id, undefined, Math.max(0, t));
      else addAsset(id, indexAt(t));
    });
  });
  function indexAt(t, skip) {       // where a video clip dropped at time t belongs
    var i = 0;
    P.tracks.video.forEach(function (c) { if (c.id !== skip && t > c.start + clipLen(c) / 2) i++; });
    return i;
  }
  function startDrag(e, c, track, node) {
    if (e.button) return;
    e.preventDefault();
    var handle = e.target.classList.contains('h') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
    var x0 = e.clientX, moved = false, saved0 = false;
    var o = { in: c.in, out: c.out, start: c.start, end: c.end };
    var a = track === 'captions' ? null : A(c.asset);
    sel = c.id; $$('.clip.sel').forEach(function (n) { n.classList.remove('sel'); }); node.classList.add('sel');
    $('#t-del').disabled = false; drawInspector();
    var marker = $('#marker');
    var move = function (ev) {
      var d = (ev.clientX - x0) / pps;
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      if (!saved0) { remember(); saved0 = true; }
      moved = true;
      if (track === 'captions') {
        if (handle === 'l') c.start = clamp(o.start + d, 0, c.end - 0.2);
        else if (handle === 'r') c.end = Math.max(c.start + 0.2, o.end + d);
        else { var len = o.end - o.start; c.start = Math.max(0, o.start + d); c.end = c.start + len; }
        layout(); drawTimeline();
      } else if (handle === 'l') {
        c.in = clamp(o.in + d, 0, c.out - 0.2);
        if (track === 'audio') c.start = Math.max(0, o.start + (c.in - o.in));
        layout(); drawTimeline();
      } else if (handle === 'r') {
        c.out = clamp(o.out + d, c.in + 0.2, a.duration);
        layout(); drawTimeline();
      } else if (track === 'audio') {
        c.start = Math.max(0, o.start + d); layout(); drawTimeline();
      } else {                                              // reorder on the magnetic video track
        node.classList.add('dragging');
        node.style.transform = 'translateX(' + (ev.clientX - x0) + 'px)';
        var idx = indexAt(o.start + d + clipLen(c) / 2, c.id);
        var others = P.tracks.video.filter(function (v) { return v.id !== c.id; });
        var x = idx >= others.length ? (others.length ? others[others.length - 1].start + clipLen(others[others.length - 1]) : 0) : others[idx].start;
        marker.hidden = false; marker.style.left = x * pps + 'px';
        node._idx = idx;
      }
    };
    var up = function () {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      marker.hidden = true;
      if (!moved) { drawTimeline(); return; }
      if (track === 'video' && !handle && node._idx !== undefined) {
        var list = P.tracks.video; list.splice(list.indexOf(c), 1); list.splice(node._idx, 0, c);
      }
      changed();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function findSel() {
    var out = null;
    ['video', 'audio', 'captions'].forEach(function (k) { P.tracks[k].forEach(function (c) { if (c.id === sel) out = { c: c, track: k }; }); });
    return out;
  }
  // a small inspector for whatever is selected: caption text, or clip volume
  function drawInspector() {
    var box = $('#insp'), s = sel && findSel();
    if (!s) { box.hidden = true; box.textContent = ''; box._id = null; return; }
    if (box._id === sel && document.activeElement && box.contains(document.activeElement)) return;   // do not rebuild while typing
    box.hidden = false; box.textContent = ''; box._id = sel;
    var once = false, mark = function () { if (!once) { remember(); once = true; } };
    if (s.track === 'captions') {
      var inp = el('input', { type: 'text', value: s.c.text, 'aria-label': 'Caption text' });
      inp.addEventListener('input', function () { mark(); s.c.text = inp.value; var n = $('.clip[data-id="' + s.c.id + '"] .nm'); if (n) n.textContent = inp.value; syncMedia(false); save(); });
      box.appendChild(el('span', { text: 'Caption' })); box.appendChild(inp);
      box.appendChild(el('span', { text: fmt(s.c.start) + ' to ' + fmt(s.c.end) }));
    } else {
      var a = A(s.c.asset), vol = el('input', { type: 'range', min: '0', max: '150', value: String(Math.round((s.c.volume === undefined ? 1 : s.c.volume) * 100)), 'aria-label': 'Volume' });
      var read = el('span', { text: vol.value + '%' });
      vol.addEventListener('input', function () { mark(); s.c.volume = Number(vol.value) / 100; read.textContent = vol.value + '%'; syncMedia(false); save(); });
      box.appendChild(el('b', { text: a.name })); box.appendChild(el('span', { text: 'Volume' })); box.appendChild(vol); box.appendChild(read);
    }
  }
  function splitAtHead() {
    var c = P.tracks.video.filter(function (v) { return T > v.start + 0.1 && T < v.start + clipLen(v) - 0.1; })[0];
    if (!c) return note('Move the playhead inside a clip to split it.');
    remember();
    var cut = c.in + (T - c.start);
    var b = { id: uid('c'), asset: c.asset, in: cut, out: c.out, volume: c.volume };
    c.out = cut;
    P.tracks.video.splice(P.tracks.video.indexOf(c) + 1, 0, b);
    sel = b.id; changed();
  }
  function deleteSel() {
    if (!sel) return;
    remember();
    ['video', 'audio', 'captions'].forEach(function (k) { P.tracks[k] = P.tracks[k].filter(function (c) { return c.id !== sel; }); });
    sel = null; changed();
  }
  function doUndo() { if (undo.length) { redo.push(snapshot()); restore(undo.pop()); } }
  function doRedo() { if (redo.length) { undo.push(snapshot()); restore(redo.pop()); } }
  $('#t-split').addEventListener('click', splitAtHead);
  $('#t-del').addEventListener('click', deleteSel);
  $('#t-undo').addEventListener('click', doUndo);
  $('#t-redo').addEventListener('click', doRedo);
  $('#t-clean').addEventListener('click', function () { runAction('remove_silences', {}); });
  $('#t-caps').addEventListener('click', function () { runAction('auto_captions', {}); });
  $('#t-cap1').addEventListener('click', function () {
    remember(); var c = { id: uid('t'), start: T, end: T + 2, text: 'New caption' }; P.tracks.captions.push(c); sel = c.id; changed();
    var inp = $('#insp input[type=text]'); if (inp) { inp.focus(); inp.select(); }
  });
  $('#zoom').addEventListener('input', function (e) { pps = Number(e.target.value); drawTimeline(); });
  window.addEventListener('resize', function () { if (P) drawTimeline(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isBrowse()) { e.preventDefault(); closeBrowse(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !P || isBrowse() || !$('#flow').hidden) return;
    var mod = e.metaKey || e.ctrlKey;
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === 's' && !mod) splitAtHead();
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
    else if (mod && e.key === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    else if (e.key === 'ArrowLeft') seek(T - (e.shiftKey ? 1 : 0.1));
    else if (e.key === 'ArrowRight') seek(T + (e.shiftKey ? 1 : 0.1));
  });

  /* ---------- playback: two video elements swap at each cut, audio clips ride along ---------- */
  var vids = [$('#vid-a'), $('#vid-b')], cur = 0, curClip = null, audios = {}, lastTick = 0;
  function clipAt(t) { return P.tracks.video.filter(function (c) { return t >= c.start && t < c.start + clipLen(c); })[0] || null; }
  function show(c, force) {
    var v = vids[cur], a = A(c.asset), want = c.in + (T - c.start);
    if (v._asset !== c.asset) {                             // a different file: use the other element
      var o = vids[1 - cur];
      if (o._asset !== c.asset) { o.src = a.url; o._asset = c.asset; }
      v.pause(); v.classList.remove('on'); cur = 1 - cur; v = o; force = true;
    }
    v.classList.add('on');
    v.muted = !!rec;                                          // silent while the microphone is open
    v.volume = clamp(c.volume === undefined ? 1 : c.volume, 0, 1);
    if (force || Math.abs(v.currentTime - want) > 0.3) { try { v.currentTime = want; } catch (e) {} }
    if (playing && v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (!playing && !v.paused) v.pause();
    var next = P.tracks.video[P.tracks.video.indexOf(c) + 1];   // warm up the next clip's file
    if (next && next.asset !== c.asset && vids[1 - cur]._asset !== next.asset) { var h = vids[1 - cur]; h.src = A(next.asset).url; h._asset = next.asset; h.preload = 'auto'; }
    curClip = c.id;
  }
  function syncMedia(force) {
    var c = clipAt(T);
    if (c) show(c, force || c.id !== curClip);
    else { vids.forEach(function (v) { v.pause(); v.classList.remove('on'); }); curClip = null; }
    var live = {};
    P.tracks.audio.forEach(function (ac) {
      if (!(T >= ac.start && T < ac.start + clipLen(ac))) return;
      live[ac.id] = 1;
      var au = audios[ac.id] || (audios[ac.id] = new Audio(A(ac.asset).url));
      var want = ac.in + (T - ac.start);
      au.muted = !!rec;
      au.volume = clamp(ac.volume === undefined ? 1 : ac.volume, 0, 1);
      if (force || Math.abs(au.currentTime - want) > 0.3) { try { au.currentTime = want; } catch (e) {} }
      if (playing && au.paused) { var p = au.play(); if (p && p.catch) p.catch(function () {}); }
      if (!playing && !au.paused) au.pause();
    });
    Object.keys(audios).forEach(function (k) { if (!live[k]) audios[k].pause(); });
    var cap = P.tracks.captions.filter(function (x) { return T >= x.start && T < x.end; })[0];
    var box = $('#cap-live');
    box.hidden = !cap;
    if (cap && box._t !== cap.text) { box.textContent = ''; box.appendChild(el('span', { text: cap.text })); box._t = cap.text; }
  }
  function tick(now) {
    if (!playing) return;
    T += (now - lastTick) / 1000; lastTick = now;
    if (T >= P.duration && !(rec && rec.mr)) { T = P.duration; pause(); drawHead(); return; }
    if (T >= P.duration) { drawHead(); requestAnimationFrame(tick); return; }   // the take can run past the picture
    drawHead(); syncMedia(false);
    var x = T * pps;                                          // keep the playhead in view
    if (x > scroll.scrollLeft + scroll.clientWidth - 40) scroll.scrollLeft = x - 80;
    requestAnimationFrame(tick);
  }
  function play() {
    if (!P.duration) return;
    if (T >= P.duration - 0.05) T = 0;
    playing = true; lastTick = performance.now();
    $('#play-ico').setAttribute('d', 'M5.5 4h3.2v12H5.5zM11.3 4h3.2v12h-3.2z');
    syncMedia(true); requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    $('#play-ico').setAttribute('d', 'M6.5 4.2l10 5.8-10 5.8z');
    vids.forEach(function (v) { v.pause(); }); Object.keys(audios).forEach(function (k) { audios[k].pause(); });
  }
  function cuts() { var out = [0]; P.tracks.video.forEach(function (c) { out.push(c.start + clipLen(c)); }); return out; }
  $('#play').addEventListener('click', function () { playing ? pause() : play(); });
  $('#tp-prev').addEventListener('click', function () { var c = cuts().filter(function (x) { return x < T - 0.15; }); seek(c.length ? c[c.length - 1] : 0); });
  $('#tp-next').addEventListener('click', function () { var c = cuts().filter(function (x) { return x > T + 0.05; }); seek(c.length ? c[0] : P.duration); });
  $$('#aspect button').forEach(function (b) { b.addEventListener('click', function () { if (P.aspect === b.getAttribute('data-a')) return; remember(); P.aspect = b.getAttribute('data-a'); changed(); }); });
  $('#s-name').addEventListener('change', function (e) { P.name = e.target.value.trim() || 'Untitled cut'; save(); });

  function drawAll() {
    if (document.activeElement !== $('#s-name')) $('#s-name').value = P.name;
    $$('#aspect button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-a') === P.aspect)); });
    $('#screen').style.aspectRatio = P.aspect.replace(':', ' / ');
    drawLibrary(); drawTimeline(); syncMedia(false); drawChips();
    changeListeners.forEach(function (fn) { try { fn(); } catch (e) {} });   // the canvas redraws itself from the project
  }

  /* ---------- Ember ---------- */
  var log = $('#chat-log'), input = $('#chat-input');
  var msgEl = null, actEl = null, stepMap = {}, rcpt = null, turnStart = null, turnStartState = null;
  var TOOL_ICON = {
    edit_timeline: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="14" r="2.2"/><path d="M8 7.2L16 14M8 12.8L16 6"/>',
    remove_silences: '<path d="M3 10h2M7 6v8M10.5 8.5v3M14 4.5v11M17 10h0"/>',
    auto_captions: '<rect x="2.5" y="4.5" width="15" height="11" rx="3"/><path d="M6 11.5h3M11 11.5h3"/>',
    transcribe: '<path d="M4 9v2M7.5 6v8M11 8v4M14.5 5v10"/>',
    look_at: '<path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.2"/>',
    shop_search: '<path d="M4.5 7h11l-1 9h-9zM7.5 7V5.8a2.5 2.5 0 0 1 5 0V7"/>',
    shop_import: '<path d="M10 4v9M6.5 9.5L10 13l3.5-3.5M4.5 16h11"/>',
    generate_clip: '<path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z"/>',
    list_voices: '<rect x="7.5" y="3" width="5" height="9" rx="2.5"/><path d="M5 10a5 5 0 0 0 10 0M10 15v2.5"/>',
    speak: '<rect x="7.5" y="3" width="5" height="9" rx="2.5"/><path d="M5 10a5 5 0 0 0 10 0M10 15v2.5"/>',
    render: '<path d="M10 13.5v-9M6 8l4-4 4 4M4.5 15.5h11"/>',
    prepare_post: '<path d="M17 3L9 11M17 3l-5 14-3-6-6-3z"/>',
    remember: '<path d="M6 3.5h8v13l-4-3-4 3z"/>',
    show_canvas: '<rect x="3" y="3.500" width="6" height="6" rx="1.500"/><rect x="11" y="3.500" width="6" height="9" rx="1.500"/><rect x="3" y="11.500" width="6" height="5" rx="1.500"/>',
    make_clip: '<path d="M4 16l9-9M11.500 5.500l3 3M14 3l.700 1.800L16.500 5.500l-1.800.700L14 8l-.700-1.800L11.500 5.500l1.800-.700zM5 4.500v2M4 5.500h2"/>',
    record_voice: '<rect x="7.5" y="3" width="5" height="9" rx="2.5"/><path d="M5 10a5 5 0 0 0 10 0M10 15v2.5"/>',
    set_avatar: '<circle cx="10" cy="7" r="3.2"/><path d="M3.8 16.5c.8-3.2 3.200-4.800 6.200-4.800s5.400 1.600 6.200 4.800"/>',
    swap_person: '<circle cx="7" cy="7" r="2.5"/><circle cx="13.5" cy="8" r="2"/><path d="M3 16c.5-3 2-4.5 4-4.5s3.5 1.5 4 4.5M12 12c2.5-.3 4 1.200 4.500 3.500"/>'
  };
  function scrollLog() { log.scrollTop = log.scrollHeight; }
  var ACT_AT = { edit_timeline: '.gn.final', remove_silences: '.gn.final', auto_captions: '.gn.final', make_clip: '.gn.final', speak: '.gn.final', record_voice: '.gn.final', raea: '.gn.final',
    shop_search: '#lib', shop_import: '#lib', set_avatar: '#lib', show_canvas: '#lib', set_view: '#lib', raea_files: '#lib',
    transcribe: '.gn.final', look_at: '.gn.final', generate_clip: '#flow-view', render: '.gn.final', swap_person: '#flow-view', prepare_post: '.gn.final', raea_docs: '#flow-view' };
  var acting = {};                                            // step id -> the panel it is lighting
  function actOn(id, name) { var n = ACT_AT[name] && $(ACT_AT[name]); if (!n) return; acting[id] = n; n.classList.add('acting'); }
  function actOff(id) {
    var n = acting[id]; delete acting[id];
    if (n) setTimeout(function () { if (!Object.keys(acting).some(function (k) { return acting[k] === n; })) n.classList.remove('acting'); }, 2200);   // one lap of the light, so even an instant edit is seen
  }
  function clipState() { var m = {}; ['video', 'audio', 'captions'].forEach(function (k) { P.tracks[k].forEach(function (c) { m[c.id] = [c.asset, c.in, c.out, c.volume, c.text, c.end === undefined ? '' : (c.end - c.start).toFixed(2), k === 'video' ? '' : c.start].join('|'); }); }); return m; }
  function glowChanged(before) {                              // the clips Ember just touched glow once
    var now = clipState();
    Object.keys(now).forEach(function (id) { if (before[id] !== now[id]) { var n = $('.clip[data-id="' + id + '"]'); if (n) n.classList.add('touched'); } });
  }
  function md(t) {                                            // just enough formatting for chat
    var h = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
    var out = [], list = false;
    h.split('\n').forEach(function (line) {
      var m = /^\s*[-•]\s+(.*)/.exec(line);
      if (m) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + m[1] + '</li>'); }
      else { if (list) { out.push('</ul>'); list = false; } out.push(line + '<br>'); }
    });
    if (list) out.push('</ul>');
    return out.join('').replace(/(<br>)+$/, '').replace(/<br>(<ul>)/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
  }
  function bubble(cls, text) {
    var w = $('.hello', log); if (w && cls !== 'note') w.remove();
    var n = el('div', { class: 'm ' + cls });
    if (cls.indexOf('ember') === 0) { n._raw = text || ''; n.innerHTML = md(n._raw); } else n.textContent = text || '';
    log.appendChild(n); scrollLog(); return n;
  }
  function note(text) { return bubble('note', text); }
  function setBusy(on) {
    busy = on;
    mood(on ? 'busy' : null);
    $('.chat').classList.toggle('working', on);
    $('#ember-state').textContent = on ? 'Thinking' : STATUS.brain !== 'offline' ? 'Ready' : 'Basic mode: model not connected';
    $('#chat-send').hidden = on; $('#chat-stop').hidden = !on;
    input.placeholder = on ? 'Ember is working' : 'Tell Ember what to do';
    ['#t-clean', '#t-caps', '#post-export'].forEach(function (s) { $(s).disabled = on; });
  }
  function describe() { return { d: P.duration, v: P.tracks.video.length, a: P.tracks.audio.length, c: P.tracks.captions.length }; }
  function receipt() {                                       // one per turn: what changed, and a way back
    var b = turnStart, n = describe(), parts = [];
    if (Math.abs(n.d - b.d) > 0.05) parts.push('<b>' + fmt(b.d) + '</b> to <b>' + fmt(n.d) + '</b>');
    if (n.v !== b.v) parts.push('<b>' + n.v + '</b> clip' + (n.v === 1 ? '' : 's'));
    if (n.c !== b.c) parts.push('<b>' + n.c + '</b> caption' + (n.c === 1 ? '' : 's'));
    if (n.a !== b.a) parts.push('<b>' + n.a + '</b> on the audio track');
    if (!rcpt) {
      var back = turnStartState;
      rcpt = el('div', { class: 'rcpt', html: svg('<path d="M4 6h12M4 10h8M4 14h5M13.5 12.500l1.800 1.800 3.200-3.800"/>') }, [
        el('span'),
        el('button', { type: 'button', text: 'Undo', onclick: function (e) { remember(); restore(back); e.target.disabled = true; e.target.textContent = 'Undone'; } })
      ]);
      log.appendChild(rcpt);
    }
    $('span', rcpt).innerHTML = 'Video updated' + (parts.length ? ': ' + parts.join(' · ') : '');
    log.appendChild(rcpt);                                    // keep it under the latest step
  }
  function onEvent(ev) {
    if (ev.type === 'text') {
      if (!msgEl) { msgEl = bubble('ember live', ''); actEl = null; }
      msgEl._raw += ev.delta; msgEl.innerHTML = md(msgEl._raw); scrollLog();
      $('#ember-state').textContent = 'Writing'; mood('talk');
    } else if (ev.type === 'step') {
      if (ev.state === 'run') {
        if (msgEl) { msgEl.classList.remove('live'); msgEl = null; }
        if (!actEl) { actEl = el('div', { class: 'act' }); log.appendChild(actEl); }
        var row = el('div', { class: 'stp run' }, [el('span', { class: 'ic', html: svg(TOOL_ICON[ev.name] || '<circle cx="10" cy="10" r="3"/>') }), el('span', { class: 'lb', text: ev.label })]);
        row._t = Date.now(); stepMap[ev.id] = row; actEl.appendChild(row); actOn(ev.id, ev.name);
        $('#ember-state').textContent = ev.label; mood('busy');
      } else if (stepMap[ev.id]) {
        actOff(ev.id);
        var r = stepMap[ev.id];
        r.className = 'stp ' + ev.state;
        r.appendChild(el('small', { text: ev.detail ? ev.detail : ((Date.now() - r._t) / 1000).toFixed(1) + 's' }));
        $('#ember-state').textContent = 'Thinking';
      }
      scrollLog();
    } else if (ev.type === 'progress') {
      $('#ember-state').textContent = ev.note + (ev.elapsed ? ' · ' + ev.elapsed + 's' : '');
    } else if (ev.type === 'project') {
      var hadShop = P && P.shop ? JSON.stringify(P.shop.videos.map(function (v) { return v.id; })) : '';
      var was = JSON.stringify(describe()), clipsWere = clipState();
      REVIEW.marks = [];
      setProject(ev.project, true);
      glowChanged(clipsWere);
      if (JSON.stringify(describe()) !== JSON.stringify(turnStart)) receipt();
      if (JSON.stringify(describe()) !== was && isBrowse()) closeBrowse();   // an edit is landing: show the editor
      if (P.shop && JSON.stringify(P.shop.videos.map(function (v) { return v.id; })) !== hadShop) showTab('shop');
      scrollLog();
    } else if (ev.type === 'canvas') {
      openBrowse(ev.canvas);
    } else if (ev.type === 'view') {
      if (ev.view === 'browse') openBrowse(); else closeBrowse();
    } else if (ev.type === 'record') {
      recordCard(ev);
    } else if (ev.type === 'suggest') {
      showNext(ev.options || []);
    } else if (ev.type === 'approval') {
      askApproval(ev);
    } else if (ev.type === 'rendered') {
      showRender(ev.render);
    } else if (ev.type === 'open_post') {
      openSheet('post');
    } else if (ev.type === 'error') {
      turnFailed = true; bubble('err', ev.message);
    }
  }
  function askApproval(ev) {
    if (msgEl) { msgEl.classList.remove('live'); msgEl = null; } actEl = null;
    var card = el('div', { class: 'ask' }, [
      el('span', { class: 'tg', text: 'Needs your OK' }),
      el('b', { text: ev.title }),
      el('div', {}, ev.lines.map(function (l) { return el('p', { text: l }); })),
      ev.cost !== null && ev.cost !== undefined ? el('div', { class: 'cost' }, ['$' + Number(ev.cost).toFixed(2), el('small', { text: 'nothing renders until you approve' })]) : null
    ]);
    var answer = function (allow) {
      card.classList.add('done'); row.remove();
      card.appendChild(el('p', { text: allow ? 'Approved.' : 'Not now.' }));
      api('/api/approve', { method: 'POST', body: { id: ev.id, allow: allow } }).catch(function () {});
    };
    var row = el('div', { class: 'row' }, [
      el('button', { type: 'button', class: 'btn btn-accent', text: 'Approve', onclick: function () { answer(true); } }),
      el('button', { type: 'button', class: 'btn', text: 'Not now', onclick: function () { answer(false); } })
    ]);
    card.appendChild(row); log.appendChild(card); scrollLog();
  }
  function endTurn() {
    if (msgEl) msgEl.classList.remove('live');
    $$('.act', log).forEach(function (a) {                    // long runs fold into one line
      if (a._done) return; a._done = true;
      var n = $$('.stp', a).length;
      if (n > 3) {
        var sum = el('button', { type: 'button', class: 'act-sum', text: n + ' steps', onclick: function () { a.classList.toggle('fold'); } });
        a.insertBefore(sum, a.firstChild); a.classList.add('fold', 'folded-once');
      }
    });
    setBusy(false);
    Object.keys(acting).forEach(actOff);
    if (nextEl) log.appendChild(nextEl);                      // next steps stay under everything else
    mood('happy'); clearTimeout(happyTimer); happyTimer = setTimeout(function () { if (!busy) mood(null); }, 1300);
    var chat = turnPath === '/api/chat' && STATUS.brain !== 'offline';
    var failed = !!turnFailed; turnFailed = false;
    refreshReview(!chat, chat).then(function () {             // after a chat turn Ember has already had its say
      if (chat && !nextEl && !failed && !busy) showNext(fallbackNext());
    });
    scrollLog();
  }
  function stream(path, body) {                               // POST and read a server-sent event stream
    msgEl = null; actEl = null; stepMap = {}; rcpt = null; nextEl = null; turnPath = path;
    $$('.next', log).forEach(function (n) { n.classList.add('used'); });
    turnStart = describe(); turnStartState = snapshot();
    setBusy(true);
    return fetch(path, { method: 'POST', headers: headers(true), body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok || !r.body) throw new Error('Ember did not answer.');
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      var pump = function () {
        return reader.read().then(function (res) {
          if (res.done) return;
          buf += dec.decode(res.value, { stream: true });
          var parts = buf.split('\n\n'); buf = parts.pop();
          parts.forEach(function (chunk) {
            chunk.split('\n').forEach(function (line) { if (line.indexOf('data: ') === 0) { try { onEvent(JSON.parse(line.slice(6))); } catch (e) {} } });
          });
          return pump();
        });
      };
      return pump();
    }).catch(function (e) { turnFailed = true; bubble('err', e.message || 'The connection dropped.'); }).then(endTurn);
  }
  function send(text) {
    text = (text || '').trim();
    if (!text || busy || !P) return;
    bubble('you', text);
    input.value = ''; input.style.height = '';
    var viewNow = isBrowse() ? 'browse' : 'editor';
    if (isBrowse() && text.length < 90 && /\b(back|return|go|take me|bring me)\b.{0,30}\beditor\b|\b(see|show|open)\b.{0,16}\beditor\b|\bclose (this|that|it|the (view|canvas|videos|grid))\b/i.test(text)) closeBrowse();
    clearTimeout(saveTimer);                                 // make sure Ember sees the latest hand edits
    api('/api/project', { method: 'PUT', body: { tracks: P.tracks, name: P.name, aspect: P.aspect } }).catch(function () {})
      .then(function () { saved('Saved'); return stream('/api/chat', { text: text, view: viewNow }); });
  }
  function runAction(name, args) { if (!busy) stream('/api/action', { name: name, args: args }); }
  $('#chat-form').addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  input.addEventListener('input', function () { input.style.height = ''; input.style.height = Math.min(170, input.scrollHeight) + 'px'; });
  $('#chat-stop').addEventListener('click', function () { api('/api/stop', { method: 'POST' }).catch(function () {}); $('#ember-state').textContent = 'Stopping'; });
  function drawChips() {}                                    // the row of chips is gone: next steps sit under Ember's replies
  /* ---------- your own voice: record it here, to picture ---------- */
  var MIC = '<rect x="7.5" y="3" width="5" height="9" rx="2.5"/><path d="M5 10a5 5 0 0 0 10 0M10 15v2.5"/>';
  function recUI(state, text) {
    var b = $('#t-rec'); b.classList.toggle('arm', state === 'arm'); b.classList.toggle('on', state === 'on'); b.setAttribute('aria-pressed', String(!!state));
    $('#t-rec-label').textContent = text || 'Record voice';
    $('#rec-live').hidden = state !== 'on';
    $$('.rec-card .go').forEach(function (g) { g.textContent = state ? (state === 'on' ? 'Stop recording' : 'Get ready') : 'Record'; g.classList.toggle('on', state === 'on'); });
  }
  function startRecording(at) {
    if (rec) return stopRecording();
    if (busy || !P) return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) return void note('This browser cannot record sound. Upload a voice file instead and I will place it.');
    closeBrowse(); pause();
    rec = { start: at === undefined ? T : clamp(at, 0, P.duration) };
    recUI('arm', 'Allow the mic');
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      if (!rec) return void stream.getTracks().forEach(function (t) { t.stop(); });   // cancelled while the browser was asking
      rec.stream = stream; seek(rec.start);
      var n = 3, cd = $('#rec-count'); cd.hidden = false; cd.textContent = n; recUI('arm', 'Get ready');
      rec.count = setInterval(function () {
        n--; cd.textContent = n;
        if (n > 0) return;
        clearInterval(rec.count); rec.count = 0; cd.hidden = true; roll();
      }, 750);
    }).catch(function () { rec = null; recUI(null); note('I could not reach your microphone. Allow microphone access for this page and try again, or upload a voice file.'); });
  }
  function roll() {                                           // the microphone is open: picture plays silently, the take runs
    var kinds = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].filter(function (m) { return MediaRecorder.isTypeSupported(m); });
    var mr = new MediaRecorder(rec.stream, kinds.length ? { mimeType: kinds[0] } : undefined), chunks = [], mine = rec;
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function () { keepTake(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), mine.start, (Date.now() - mine.t0) / 1000); };
    rec.mr = mr; rec.t0 = Date.now(); mr.start(250);
    try {                                                     // a level meter, so they can see the mic hears them
      var AC = window.AudioContext || window.webkitAudioContext; rec.ctx = new AC();
      var an = rec.ctx.createAnalyser(); an.fftSize = 256; rec.ctx.createMediaStreamSource(rec.stream).connect(an);
      var buf = new Uint8Array(an.fftSize);
      rec.meter = function () { an.getByteTimeDomainData(buf); var pk = 0; for (var i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i] - 128)); return Math.min(1, pk / 70); };
    } catch (e) {}
    rec.timer = setInterval(function () {
      var t = (Date.now() - mine.t0) / 1000;
      recUI('on', 'Stop ' + fmt(t));
      if (mine.meter) $('#t-rec-level').style.transform = 'scaleX(' + mine.meter().toFixed(2) + ')';
      if (t > 180) stopRecording();
    }, 100);
    recUI('on', 'Stop 0:00.0');
    if (P.duration > rec.start + 0.2) play();
  }
  function stopRecording() {
    if (!rec) return;
    var r = rec; rec = null;
    clearInterval(r.count); clearInterval(r.timer); $('#rec-count').hidden = true;
    pause(); vids.forEach(function (v) { v.muted = false; }); Object.keys(audios).forEach(function (k) { audios[k].muted = false; });
    if (r.mr && r.mr.state !== 'inactive') r.mr.stop();
    if (r.stream) r.stream.getTracks().forEach(function (t) { t.stop(); });
    if (r.ctx) r.ctx.close().catch(function () {});
    $('#t-rec-level').style.transform = ''; recUI(null);
  }
  function keepTake(blob, start, secs) {
    if (secs < 0.4 || blob.size < 800) return void note('That take was too short to keep. Press Record and talk for a moment.');
    var n = note('Saving your take');
    var count = Object.keys(P.assets).filter(function (k) { return P.assets[k].meta && P.assets[k].meta.own_voice; }).length + 1;
    var ext = /mp4/.test(blob.type) ? '.m4a' : /ogg/.test(blob.type) ? '.ogg' : '.webm';
    var fd = new FormData(); fd.append('file', blob, 'My voice ' + count + ext);
    api('/api/upload?voice=1', { method: 'POST', body: fd }).then(function (r) {
      setProject(r.project); showTab('media');
      addAsset(r.asset, undefined, start);                    // onto the audio track where the take began
      seek(start);
      var a = A(r.asset), end = start + a.duration;
      var loud = P.tracks.video.filter(function (c) { return c.start < end && c.start + clipLen(c) > start && (c.volume === undefined ? 1 : c.volume) > 0 && A(c.asset).has_audio; });
      n.textContent = 'Your voice is on the audio track at ' + fmt(start) + ' (' + a.duration.toFixed(1) + 's). Press play to hear it.';
      if (loud.length) {
        var row = el('div', { class: 'next' }, [el('button', { type: 'button', text: 'Mute the clip\'s own sound', onclick: function () {
          remember(); loud.forEach(function (c) { c.volume = 0; }); changed(); row.remove(); note('Muted the original sound under your voice. Undo brings it back.');
        } })]);
        log.appendChild(row); scrollLog();
      }
    }).catch(function (e) { n.textContent = 'Could not save that take. ' + e.message; });
  }
  function recordCard(ev) {                                   // Ember hands the person a script and a record button
    if (msgEl) { msgEl.classList.remove('live'); msgEl = null; } actEl = null;
    var go = el('button', { type: 'button', class: 'btn btn-accent go', text: 'Record', onclick: function () { startRecording(ev.start || 0); } });
    log.appendChild(el('div', { class: 'ask rec-card' }, [
      el('span', { class: 'tg', html: svg(MIC) + 'Your voice' }),
      el('b', { text: ev.script ? 'Read this, in your own voice' : 'Say it in your own voice' }),
      ev.script ? el('div', { class: 'script', text: ev.script }) : null,
      el('p', { text: 'The cut plays silently from ' + fmt(ev.start || 0) + ' while you talk. Press Stop when you are done; your take lands on the audio track.' }),
      el('div', { class: 'row' }, [go])
    ]));
    scrollLog();
  }
  $('#t-rec').addEventListener('click', function () { startRecording(); });

  /* ---------- Ember speaks first: what it noticed in the cut, and what to do next ---------- */
  try { seen = JSON.parse(sessionStorage.getItem('ember_seen_' + user) || '{}'); } catch (e) {}
  function refreshReview(speak, quiet) {
    return api('/api/review').then(function (r) {
      REVIEW = r;
      var live = {}; r.findings.forEach(function (f) { live[f.id] = 1; if (quiet) seen[f.id] = 1; });
      Object.keys(seen).forEach(function (k) { if (!live[k]) delete seen[k]; });   // fixed: may be raised again if it comes back
      try { sessionStorage.setItem('ember_seen_' + user, JSON.stringify(seen)); } catch (e) {}
      drawTimeline(); drawChips();
      if (speak) notice();
    }).catch(function () {});
  }
  function scheduleReview(speak, ms) { clearTimeout(reviewTimer); reviewTimer = setTimeout(function () { if (!busy) refreshReview(speak); }, ms || 1600); }
  function notice() {
    if (busy || !P) return;
    var fresh = REVIEW.findings.filter(function (f) { return !seen[f.id]; });
    if (!fresh.length) return;
    fresh.forEach(function (f) { seen[f.id] = 1; });
    try { sessionStorage.setItem('ember_seen_' + user, JSON.stringify(seen)); } catch (e) {}
    $$('.nt', log).forEach(function (n) { if (!n._used) n.remove(); });        // one live card at a time
    var fixes = fresh.filter(function (f) { return f.kind === 'fix'; }).length;
    var card = el('div', { class: 'nt' }, [
      el('div', { class: 'nt-h' }, [el('span', { class: 'orb', html: mascot(), 'aria-hidden': 'true' }),
        el('b', { text: fixes > 1 ? 'I spotted ' + fixes + ' things in your cut.' : fixes ? 'I spotted something in your cut.' : 'A thought on your cut.' }),
        el('button', { type: 'button', class: 'icon-btn x', 'aria-label': 'Not now', title: 'Not now', html: svg('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'), onclick: function () { card.remove(); } })])
    ].concat(fresh.slice(0, 3).map(function (f, k) {
      var row = el('div', { class: 'nt-i ' + f.kind }, [el('i', { class: 'd' }), el('div', {}, [el('b', { text: f.title }), el('span', { text: f.detail })]),
        el('button', { type: 'button', text: f.label, onclick: function () { if (busy) return; row.classList.add('sent'); card._used = true; send(f.say); } })]);
      row.style.setProperty('--k', k); return row;
    })));
    log.appendChild(card); scrollLog();
  }
  function fallbackNext() {                                   // when Ember offers none: the obvious next moves from here
    var out = [], sv = shopVideos();
    if (isBrowse() && sv.length) {
      var top = sv.slice().sort(function (x, y) { return (y.views || 0) - (x.views || 0); })[0];
      out.push({ label: 'Remake the top one', fn: function () { pick('I pick this one: "' + (top.product || top.title || 'video').slice(0, 80) + '" by @' + (top.creator || 'creator') + ' (video id ' + top.id + ').'); } });
      out.push({ label: 'What do the winners share?', say: 'Look at the top videos in this search and tell me what they have in common: the hook, the length, the offer.' });
      out.push({ label: 'Back to the editor', fn: closeBrowse });
    } else {
      var refs = Object.keys(P.assets).filter(function (k) { return P.assets[k].reference; });
      if (refs.length && !REVIEW.findings.some(function (f) { return f.id === 'ref' || f.id === 'refonly'; }))
        out.push({ label: 'Clip it with my avatar', say: 'Clip "' + A(refs[refs.length - 1]).name + '" with my avatar: write a new script from its beats and the product facts, then film it.' });
      REVIEW.findings.slice(0, 2).forEach(function (f) { out.push({ label: f.label, say: f.say }); });
      out.push(P.tracks.video.length ? { label: 'What would you change?', say: 'Look at my cut and tell me the one change that would improve it most.' }
                                     : { label: 'Show me what is selling', say: 'Show me the top TikTok Shop videos right now.' });
    }
    return out.slice(0, 3);
  }
  function showNext(options) {                                // buttons under Ember's reply
    if (!options.length) return;
    if (nextEl) nextEl.remove();
    nextEl = el('div', { class: 'next' }, options.map(function (o, k) {
      var b = el('button', { type: 'button', text: o.label, onclick: function () { if (busy) return; if (o.fn) { nextEl.classList.add('used'); o.fn(); } else send(o.say); } });
      b.insertAdjacentHTML('beforeend', svg('<path d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"/>'));
      b.style.setProperty('--k', k); return b;
    }));
    log.appendChild(nextEl); scrollLog();
  }
  function hello() {
    var on = STATUS.brain !== 'offline';
    var cards = [
      ['<path d="M3 10h2M7 6v8M10.5 8.5v3M14 4.5v11M17 10h0"/>', 'Clean up my cut', 'Cut the pauses and tighten it', 'Clean it up'],
      ['<rect x="2.5" y="4.5" width="15" height="11" rx="3"/><path d="M6 11.5h3M11 11.5h3"/>', 'Add captions', 'From the speech, timed', 'Add captions'],
      ['<path d="M4.5 7h11l-1 9h-9zM7.5 7V5.8a2.5 2.5 0 0 1 5 0V7"/>', 'What is selling?', 'Search TikTok Shop', 'Find what is trending on TikTok Shop right now and show me the best five to remake.'],
      ['<path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z"/>', 'Film a new shot', 'Rendered on our GPUs', null]
    ];
    var box = el('div', { class: 'hello' }, [
      el('span', { class: 'orb hi', html: mascot(), 'aria-hidden': 'true' }),
      el('h3', { html: 'What are we <em>making</em> today?' }),
      el('p', { text: on ? 'Tell me what you want this video to be. I cut, caption, voice and film. You can also just drag things around; I see what you change.'
                         : 'My full model is not connected on this machine, so for now I follow plain commands like "cut from 2 to 4" or "add captions". The editor works fully by hand.' }),
      el('div', { class: 'hello-cards' }, cards.map(function (c) {
        return el('button', { type: 'button', html: svg(c[0]), onclick: function () { if (c[3]) send(c[3]); else { input.value = 'Film a 6 second vertical shot: '; input.focus(); } } },
          [el('b', { text: c[1] }), el('span', { text: c[2] })]);
      }))
    ]);
    log.appendChild(box);
  }
  function showLog(items) {
    log.textContent = '';
    items.slice(-40).forEach(function (m) {
      if (m.role === 'user') bubble('you', m.text);
      else {
        if (m.steps && m.steps.length) {
          var a = el('div', { class: 'act' }); a._done = true;
          m.steps.forEach(function (s) { a.appendChild(el('div', { class: 'stp ok' }, [el('span', { class: 'ic', html: svg('<path d="M5 10.500l3.200 3.200L15 6.500"/>') }), el('span', { class: 'lb', text: s })])); });
          log.appendChild(a);
        }
        if (m.text) bubble('ember', m.text);
      }
    });
    if (!items.length) hello();
    scrollLog();
  }
  /* ---------- projects: one person, many videos ---------- */
  function switchProject(id) { try { localStorage.setItem('ember_project_' + user, id); } catch (e) {} location.reload(); }
  function newProject() { api('/api/projects', { method: 'POST', body: { name: 'Untitled video' } }).then(function (r) { switchProject(r.id); }).catch(function (e) { note('Could not start a new project. ' + e.message); }); }
  function inFlow() { return false; }                          // the canvas is the studio now, not a separate step
  function when(t) { return t ? new Date(t * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; }

  /* ---------- dialogs ---------- */
  var dlg = $('#dlg'), dlgIn = $('#dlg-in');
  function closeDialog() { dlg.hidden = true; dlgIn.textContent = ''; }
  function dialog(title, sub, wide) {
    dlgIn.textContent = ''; dlgIn.className = 'dlg-in' + (wide ? ' wide' : '');
    dlgIn.appendChild(el('header', { class: 'dlg-h' }, [el('div', {}, [el('h2', { text: title }), sub ? el('p', { text: sub }) : null]),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close (Esc)', html: svg('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>'), onclick: closeDialog })]));
    var body = el('div', { class: 'dlg-b' }); dlgIn.appendChild(body); dlg.hidden = false;
    return body;
  }
  dlg.addEventListener('pointerdown', function (e) { if (e.target === dlg) closeDialog(); });
  function projectsDialog() {
    var body = dialog('Your projects', 'Each project is one video: its own library, cut, chats and board.', true);
    body.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
    api('/api/projects').then(function (list) {
      body.textContent = '';
      var grid = el('div', { class: 'pj-grid' });
      grid.appendChild(el('button', { type: 'button', class: 'pj new', onclick: newProject }, [el('span', { class: 'pj-th', html: svg('<path d="M10 4.5v11M4.5 10h11"/>') }), el('b', { text: 'New project' }), el('span', { text: 'Starts in the workflow' })]));
      list.forEach(function (p) {
        var th = el('span', { class: 'pj-th' }); if (p.poster) th.style.backgroundImage = 'url("' + p.poster + '")';
        if (p.id === projectId) th.appendChild(el('em', { text: 'Open now' }));
        grid.appendChild(el('button', { type: 'button', class: 'pj' + (p.id === projectId ? ' cur' : ''), onclick: function () { if (p.id === projectId) closeDialog(); else switchProject(p.id); } }, [
          th, el('b', { text: p.name }),
          el('span', { text: (p.stage === 'edit' ? p.clips + ' clip' + (p.clips === 1 ? '' : 's') + ' · ' + fmt(p.seconds) : 'In the workflow') + ' · ' + when(p.updated) })]));
      });
      body.appendChild(grid);
    }).catch(function (e) { body.textContent = ''; body.appendChild(el('p', { class: 'dlg-empty', text: 'Could not load your projects. ' + e.message })); });
  }
  function historyDialog(tab) {                               // chats and versions of this project, in one place
    var body = dialog('History', 'Everything kept for "' + P.name + '".', true);
    var tabs = el('div', { class: 'dlg-tabs', role: 'tablist' }), pane = el('div', { class: 'hs-list' });
    var show = function (which) {
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-t') === which)); });
      pane.textContent = ''; pane.appendChild(el('div', { class: 'f-bar' }, [el('i')]));
      if (which === 'chats') api('/api/chats').then(function (list) {
        pane.textContent = '';
        pane.appendChild(el('div', { class: 'hs now' }, [el('span', { class: 'dot' }), el('div', {}, [el('b', { text: 'This chat' }), el('span', { text: 'The conversation on screen now' })]),
          el('button', { type: 'button', class: 'btn', text: 'Start a new chat', onclick: function () { closeDialog(); $('#chat-clear').click(); } })]));
        if (!list.length) pane.appendChild(el('p', { class: 'dlg-empty', text: 'No earlier chats yet. When you start a new chat, the old one is kept here.' }));
        list.forEach(function (c) {
          pane.appendChild(el('div', { class: 'hs' }, [el('span', { class: 'dot' }), el('div', {}, [el('b', { text: c.title }), el('span', { text: when(c.at) + ' · ' + c.messages + ' message' + (c.messages === 1 ? '' : 's') })]),
            el('button', { type: 'button', class: 'btn', text: 'Open', onclick: function () { if (busy) return; api('/api/chats/open', { method: 'POST', body: { id: c.id } }).then(function (items) { showLog(items); closeDialog(); }); } })]));
        });
      }); else api('/api/versions').then(function (list) {
        pane.textContent = '';
        if (!list.length) pane.appendChild(el('p', { class: 'dlg-empty', text: 'No versions yet. One is saved each time you or Ember change the cut.' }));
        list.forEach(function (v, i) {
          pane.appendChild(el('div', { class: 'hs' + (v.label.indexOf('Ember:') === 0 ? ' ember' : '') + (i === 0 ? ' now' : '') }, [el('span', { class: 'dot' }),
            el('div', {}, [el('b', { text: v.label || 'Version' }), el('span', { text: when(v.at) + ' · ' + fmt(v.duration) + ' · ' + v.clips + ' clip' + (v.clips === 1 ? '' : 's') + (v.captions ? ' · ' + v.captions + ' captions' : '') })]),
            i === 0 ? el('em', { text: 'Current' }) : el('button', { type: 'button', class: 'btn', text: 'Restore', onclick: function () {
              if (busy) return;
              remember();                                    // so Undo brings the current cut back
              api('/api/versions/restore', { method: 'POST', body: { id: v.id } }).then(function (p) {
                dirty++; clearTimeout(saveTimer); setProject(p); saved('Saved'); closeDialog();
                note('Restored the version from ' + when(v.at) + '. Undo brings back what you had.');
              });
            } })]));
        });
      });
    };
    [['chats', 'Chats'], ['versions', 'Versions of the cut']].forEach(function (t) { tabs.appendChild(el('button', { type: 'button', role: 'tab', 'data-t': t[0], text: t[1], onclick: function () { show(t[0]); } })); });
    body.appendChild(tabs); body.appendChild(pane); show(tab || 'chats');
  }
  function shortcutsDialog() {
    var body = dialog('Keyboard shortcuts', 'In the editor.'), rows = [['Space', 'Play or pause'], ['S', 'Split at the playhead'], ['Delete', 'Delete the selection'], ['Cmd Z', 'Undo'], ['Shift Cmd Z', 'Redo'],
      ['Left / Right', 'Move the playhead (hold Shift for a second)'], ['Esc', 'Close a menu, a dialog or the Shop view']];
    body.appendChild(el('div', { class: 'keys-list' }, rows.map(function (r) { return el('div', {}, [el('kbd', { text: r[0] }), el('span', { text: r[1] })]); })));
  }

  /* ---------- the menu bar: File, Edit, View, Tools, History, Help ---------- */
  var menuPop = $('#menu-pop'), menuOpen = null;
  var MENUS = {
    File: function () { var flow = inFlow(), has = P.tracks.video.length > 0; return [
      { t: 'New project', on: newProject },
      { t: 'Open project…', on: projectsDialog },
      { t: 'Rename project', on: function () { var n = $('#s-name'); n.focus(); n.select(); } }, 0,
      { t: 'Export video', off: flow || !has, on: function () { openSheet('post'); $('#post-export').click(); } },
      { t: 'Post…', off: flow || !has, on: function () { openSheet('post'); } }, 0,
      { t: 'Sign out', on: function () { try { localStorage.removeItem('ember_session'); } catch (e) {} location.href = 'index.html'; } }]; },
    Edit: function () { var flow = inFlow(); return [
      { t: 'Undo', k: 'Cmd Z', off: flow || !undo.length, on: doUndo }, { t: 'Redo', k: 'Shift Cmd Z', off: flow || !redo.length, on: doRedo }, 0,
      { t: 'Clear the captions', off: !P.tracks.captions.length, on: function () { remember(); P.tracks.captions = []; changed(); } }]; },
    View: function () { var flow = inFlow(), frame = function (a, label) { return { t: label, mark: P.aspect === a, off: flow, on: function () { if (P.aspect !== a) { remember(); P.aspect = a; changed(); } } }; }; return [
      { t: 'Shop videos', off: flow, on: function () { openBrowse(shopCanvas()); if (!shopVideos().length) shopSearch('', 'trending', 100); } },
      { t: 'What Ember last showed', off: flow || !P.canvas, on: function () { openBrowse(P.canvas); } },
      { t: 'Back to the canvas', k: 'Esc', off: !isBrowse(), on: closeBrowse }, 0,
      { t: 'Fit the canvas', on: function () { closeBrowse(); window.EmberFlow.fit(); } },
      { t: 'Open the final video', on: function () { closeBrowse(); window.EmberFlow.showFinal(); } }, 0,
      frame('9:16', 'Vertical frame, 9:16'), frame('1:1', 'Square frame, 1:1'), frame('16:9', 'Wide frame, 16:9'), 0,
      { t: 'Reset panel sizes', off: flow, on: function () { sizes = {}; try { localStorage.removeItem('ember_sizes_canvas'); } catch (e) {} applySizes(); } }]; },
    Tools: function () { var flow = inFlow(), none = flow || !P.tracks.video.length; return [
      { t: 'Cut the pauses', off: none || busy, on: function () { runAction('remove_silences', {}); } },
      { t: 'Captions from the speech', off: none || busy, on: function () { runAction('auto_captions', {}); } },
      { t: 'Record my voice', off: none, on: function () { window.EmberFlow.showFinal(); startRecording(); } }, 0,
      { t: 'Find what is selling', off: flow || busy, on: function () { send('Show me what is selling on TikTok Shop right now.'); } }]; },
    History: function () { var flow = inFlow(); return [
      { t: 'Chats…', off: flow, on: function () { historyDialog('chats'); } },
      { t: 'Versions of the cut…', off: flow, on: function () { historyDialog('versions'); } }, 0,
      { t: 'Start a new chat', off: flow || busy, on: function () { $('#chat-clear').click(); } }]; },
    Help: function () { return [
      { t: 'What can Ember do?', off: inFlow() || busy, on: function () { send('What can you do?'); } },
      { t: 'Keyboard shortcuts', on: shortcutsDialog }]; }
  };
  function closeMenu() { menuPop.hidden = true; menuOpen = null; $$('#menubar button, #acct-btn').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  function openMenu(btn, items) {
    menuPop.textContent = '';
    items.forEach(function (it) {
      if (!it) return void menuPop.appendChild(el('hr'));
      if (it.info) return void menuPop.appendChild(el('p', { text: it.t }));
      menuPop.appendChild(el('button', { type: 'button', role: 'menuitem', disabled: it.off ? '' : null, onclick: function () { closeMenu(); it.on(); } },
        [el('i', { text: it.mark ? '✓' : '' }), el('span', { text: it.t }), it.k ? el('kbd', { text: it.k }) : null]));
    });
    var r = btn.getBoundingClientRect();
    menuPop.hidden = false;
    menuPop.style.top = (r.bottom + 6) + 'px';
    menuPop.style.left = Math.max(8, Math.min(r.left, innerWidth - menuPop.offsetWidth - 8)) + 'px';
    $$('#menubar button, #acct-btn').forEach(function (b) { b.setAttribute('aria-expanded', String(b === btn)); });
    menuOpen = btn;
  }
  Object.keys(MENUS).forEach(function (name) {
    var b = el('button', { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', text: name });
    var show = function () { if (P) openMenu(b, MENUS[name]()); };
    b.addEventListener('click', function () { if (menuOpen === b) closeMenu(); else show(); });
    b.addEventListener('pointerenter', function () { if (menuOpen && menuOpen !== b) show(); });   // slide along the bar once a menu is open
    $('#menubar').appendChild(b);
  });
  $('#acct-btn').addEventListener('click', function () {
    var b = $('#acct-btn'); if (menuOpen === b) return closeMenu();
    openMenu(b, [{ info: 1, t: user }, { info: 1, t: 'Render machine: ' + (STATUS.gpu && STATUS.gpu.online ? 'online' : 'offline') },
      { info: 1, t: P && P.spent ? '$' + Number(P.spent).toFixed(2) + ' rendered in this project' : 'Nothing rendered in this project yet' }, 0,
      { t: 'Your projects…', on: projectsDialog }, { t: 'Sign out', on: function () { try { localStorage.removeItem('ember_session'); } catch (e) {} location.href = 'index.html'; } }]);
  });
  document.addEventListener('pointerdown', function (e) { if (menuOpen && !menuPop.contains(e.target) && !e.target.closest('#menubar, #acct-btn')) closeMenu(); });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (menuOpen) { closeMenu(); e.stopPropagation(); } else if (!dlg.hidden) { closeDialog(); e.stopPropagation(); } }, true);

  $('#chat-clear').addEventListener('click', function () { if (busy) return; api('/api/reset', { method: 'POST' }).then(function () { showLog([]); note('A clean chat about the same video. The last one is in History.'); }); });

  /* ---------- the browse view: the library rail grown over the editor, drawn from blocks Ember composed ---------- */
  var num = function (x) { x = Number(x) || 0; return x >= 1e6 ? (x / 1e6).toFixed(1).replace('.0', '') + 'M' : x >= 1e4 ? Math.round(x / 1e3) + 'K' : x >= 1e3 ? (x / 1e3).toFixed(1).replace('.0', '') + 'K' : (Math.round(x * 100) / 100).toLocaleString(); };
  var METRIC = { views: ['views', ''], likes: ['likes', ''], units_7d: ['units / 7 days', ''], price: ['price', '$'], seconds: ['seconds', ''] };
  var HUES = ['#F25A2B', '#FFB08E', '#FFD08A', '#5FD3B0', '#9DB4FF', '#C39BFF', '#8A2E12', '#8B8881'];
  function shopVideos() { return (P.shop && P.shop.videos) || []; }
  function chartData(b) {
    if (b.data) return { rows: b.data, unit: b.unit || '', pre: '' };
    if (b.source === 'project') return { rows: P.tracks.video.map(function (c, i) { return { label: (i + 1) + '. ' + A(c.asset).name, value: Math.round(clipLen(c) * 10) / 10 }; }), unit: 's', pre: '' };
    var m = b.metric || 'views', key = b.label === 'creator' ? 'creator' : 'product';
    var rows = shopVideos().filter(function (v) { return v[m] !== null && v[m] !== undefined; }).map(function (v) {
      return { label: key === 'creator' ? '@' + (v.creator || 'creator') : (v.product || v.title || 'Video'), value: Number(v[m]) };
    }).sort(function (x, y) { return y.value - x.value; }).slice(0, b.limit || 10);
    return { rows: rows, unit: '', pre: METRIC[m][1] };
  }
  function pick(text) { closeBrowse(); send(text); }
  function countUp(node, to, pre, suf) {                      // numbers run up to their value as the view opens
    var t0 = Date.now(), whole = to % 1 === 0, put = function (v) { node.textContent = pre + (pre === '$' && v < 1000 ? Number(v).toFixed(2) : num(v)) + suf; };
    put(0);
    var iv = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0 - 380) / 900);
      if (k < 0) return;
      if (k >= 1) { clearInterval(iv); put(to); } else { var v = to * (1 - Math.pow(1 - k, 3)); put(whole ? Math.round(v) : Math.round(v * 100) / 100); }
    }, 32);
  }
  function drawBlock(b) {
    var box = el('section', { class: 'blk' });
    if (b.type === 'videos') {
      var grid = el('div', { class: 'vgrid' }), items, sortKey = b.source === 'library' ? null : (browseSort || b.sort || null);
      if (b.source === 'library') {
        items = Object.keys(P.assets).map(function (k) { return P.assets[k]; }).filter(function (a) { return a.kind === 'video' && (!b.ids || b.ids.indexOf(a.id) >= 0); }).map(function (a) {
          return { rank: '', img: a.poster_url, title: a.name, sub: fmt(a.duration) + ' · ' + (a.reference ? 'reference' : a.source), chip: a.reference ? 'REF' : a.source === 'generated' ? 'AI' : '', say: 'I pick "' + a.name + '" from my library (asset ' + a.id + ').' };
        });
      } else {
        var vids = shopVideos().filter(function (v) { return !b.ids || b.ids.indexOf(String(v.id)) >= 0; });
        if (sortKey) vids = vids.slice().sort(function (x, y) { return sortKey === 'seconds' ? (x.seconds || 1e9) - (y.seconds || 1e9) : (y[sortKey] || 0) - (x[sortKey] || 0); });
        var seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Order' });
        [['views', 'Most viewed'], ['units_7d', 'Best selling'], ['likes', 'Most liked'], ['seconds', 'Shortest']].forEach(function (o) {
          if (!vids.some(function (v) { return v[o[0]]; })) return;
          seg.appendChild(el('button', { type: 'button', 'aria-pressed': String(sortKey === o[0]), text: o[1], onclick: function () { browseSort = o[0]; renderCanvas(shown, true); } }));
        });
        box.appendChild(el('div', { class: 'vbar' }, [el('h4', { class: 'blk-h', text: (b.heading || 'Videos') + ' · ' + Math.min(vids.length, b.limit || 1000) }), vids.length > 1 ? seg : null]));
        items = vids.slice(0, b.limit || 1000).map(function (v, i) {
          return { img: v.poster, title: v.product || v.title, sub: '@' + (v.creator || 'creator') + (v.seconds ? ' · ' + v.seconds + 's' : '') + (v.price ? ' · $' + v.price : ''),
            chip: num(v.views) + ' views', chip2: v.units_7d ? num(v.units_7d) + ' sold / 7d' : '', hot: i === 0 && !!sortKey, rank: sortKey && i < 3 ? '#' + (i + 1) : '',
            say: 'I pick this one: "' + (v.product || v.title || 'video').slice(0, 80) + '" by @' + (v.creator || 'creator') + ' (video id ' + v.id + ').' };
        });
      }
      if (b.source === 'library' && b.heading) box.appendChild(el('h4', { class: 'blk-h', text: b.heading + ' · ' + items.length }));
      if (!items.length) box.appendChild(el('p', { class: 'lib-empty', text: 'Nothing to show here yet.' }));
      items.forEach(function (it, k) {                       // an even grid: every card the same shape
        var card = el('button', { type: 'button', class: 'vcard', onclick: function () { pick(it.say); } }, [
          el('img', { src: it.img || '', alt: '', loading: 'lazy' }),
          el('span', { class: 'vtop' }, [el('span', { class: 'vchips' }, [it.rank ? el('span', { class: 'chip rank', text: it.rank }) : null, it.chip ? el('span', { class: 'chip' + (it.hot ? ' hot' : ''), text: it.chip }) : null]), it.chip2 ? el('span', { class: 'chip', text: it.chip2 }) : null]),
          el('span', { class: 'pick', text: 'Work from this' }),
          el('span', { class: 'ov' }, [el('b', { text: it.title }), el('span', { text: it.sub })])
        ]);
        card.style.setProperty('--k', Math.min(k, 16));
        grid.appendChild(card);
      });
      box.appendChild(grid);
    } else if (b.type === 'shopbar') {                        // search what is selling, right in the view
      var shop = P.shop || {}, sq = el('input', { class: 'f-in', type: 'search', placeholder: 'Search products: skincare, kitchen, pets, a brand', value: shop.query || '', 'aria-label': 'Search TikTok Shop' });
      var ssort = shop.sort || 'trending', sgo = function (sort) { shopSearch(sq.value.trim(), sort || ssort, 100); };
      box.className = 'blk shopbar';
      box.appendChild(el('form', { class: 'f-row', onsubmit: function (e) { e.preventDefault(); sgo(); } }, [sq,
        el('div', { class: 'seg', role: 'group', 'aria-label': 'Ranking' }, [['trending', 'Trending'], ['top', 'Most viewed'], ['latest', 'Newest']].map(function (o) {
          return el('button', { type: 'button', 'aria-pressed': String(ssort === o[0]), text: o[1], onclick: function () { sgo(o[0]); } }); })),
        el('button', { type: 'submit', class: 'btn btn-accent', text: shopBusy ? 'Searching' : 'Search', disabled: shopBusy ? '' : null })]));
      if (shopNote) box.appendChild(el('p', { class: 'lib-empty', text: shopNote }));
      else if (shopBusy && !shopVideos().length) box.appendChild(el('p', { class: 'lib-empty', text: 'Loading what is selling right now.' }));
    } else if (b.type === 'shopmore') {
      var have = shopVideos().length;
      if (have && P.shop.more !== false) box.appendChild(el('button', { type: 'button', class: 'btn more-btn', disabled: shopBusy ? '' : null, text: shopBusy ? 'Loading' : 'Load 100 more', onclick: function () { shopSearch(P.shop.query || '', P.shop.sort || 'trending', have + 100); } }));
      else if (have) box.appendChild(el('p', { class: 'blk-note', text: 'That is every video for this search: ' + have + '.' }));
    } else if (b.type === 'insights') {                      // headline numbers, worked out here from the search results
      var sv = shopVideos(), nz = function (k) { return sv.map(function (v) { return Number(v[k]); }).filter(function (x) { return x > 0; }); };
      var add = function (a) { return a.reduce(function (t, x) { return t + x; }, 0); };
      var mid = function (a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; };
      var best = sv.slice().sort(function (x, y) { return (y.views || 0) - (x.views || 0); })[0], prod = {};
      sv.forEach(function (v) { if (v.units_7d) prod[v.product || v.id] = Number(v.units_7d); });
      var units = Object.keys(prod).map(function (k) { return prod[k]; });
      var cells = [{ label: 'Videos', n: sv.length, hint: P.shop && P.shop.query ? 'for "' + P.shop.query + '"' : 'in your last search' }];
      if (nz('views').length) cells.push({ label: 'Combined views', n: add(nz('views')), hint: 'across these videos' });
      if (best && best.views) cells.push({ label: 'Top video', n: best.views, hint: '@' + (best.creator || 'creator') });
      if (units.length) cells.push({ label: 'Sold in 7 days', n: add(units), hint: 'across ' + units.length + ' product' + (units.length === 1 ? '' : 's') });
      if (nz('price').length) cells.push({ label: 'Median price', n: mid(nz('price')), pre: '$' });
      if (nz('seconds').length) cells.push({ label: 'Median length', n: mid(nz('seconds')), suf: 's' });
      box.appendChild(el('div', { class: 'cstats auto' }, cells.map(function (it, k) {
        var val = el('b'), cell = el('div', { class: 'cstat' }, [el('span', { text: it.label }), val, it.hint ? el('i', { text: it.hint }) : null]);
        cell.style.setProperty('--k', k); countUp(val, it.n, it.pre || '', it.suf || ''); return cell;
      })));
      box.appendChild(el('p', { class: 'blk-note', text: 'Worked out from the ' + sv.length + ' videos in this search. Nothing here is estimated.' }));
    } else if (b.type === 'stats') {
      box.appendChild(el('div', { class: 'cstats' }, b.items.map(function (it) {
        return el('div', { class: 'cstat' }, [el('span', { text: it.label }), el('b', { text: it.value }), it.hint ? el('i', { text: it.hint }) : null]);
      })));
    } else if (b.type === 'chart') {
      var d = chartData(b), rows = d.rows, card2 = el('div', { class: 'cchart' }, [el('h3', { text: b.title || (b.metric ? METRIC[b.metric][0] : 'Chart') })]);
      var show = function (v) { return d.pre + num(v) + (d.unit ? ' ' + d.unit : ''); };
      var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
      if (!rows.length) card2.appendChild(el('p', { class: 'lib-empty', text: 'No figures available for this.' }));
      else if (b.kind === 'line') {
        var W = 900, H = 220, px = 34, py = 22, n = rows.length;
        var X = function (i) { return px + (W - 2 * px) * (n === 1 ? 0.5 : i / (n - 1)); }, Y = function (v) { return H - py - (H - 2 * py) * (v / max); };
        var pts = rows.map(function (r, i) { return X(i).toFixed(1) + ' ' + Y(r.value).toFixed(1); });
        var s2 = '<defs><linearGradient id="cv-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(242,90,43,0.35)"/><stop offset="1" stop-color="rgba(242,90,43,0)"/></linearGradient></defs>';
        [0.25, 0.5, 0.75, 1].forEach(function (g) { s2 += '<line class="gr" x1="' + px + '" x2="' + (W - px) + '" y1="' + Y(max * g) + '" y2="' + Y(max * g) + '"/>'; });
        s2 += '<path class="ar" d="M' + pts.join(' L') + ' L' + X(n - 1) + ' ' + (H - py) + ' L' + X(0) + ' ' + (H - py) + ' Z"/><path class="ln" d="M' + pts.join(' L') + '"/>';
        rows.forEach(function (r, i) { s2 += '<circle cx="' + X(i) + '" cy="' + Y(r.value) + '" r="4"/><text x="' + X(i) + '" y="' + (Y(r.value) - 10) + '" text-anchor="middle">' + show(r.value) + '</text><text x="' + X(i) + '" y="' + (H - 4) + '" text-anchor="middle">' + r.label.slice(0, 14).replace(/[<&]/g, '') + '</text>'; });
        var sv = el('div', { html: '<svg class="line" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + s2 + '</svg>' }).firstChild;
        card2.appendChild(sv);
        requestAnimationFrame(function () { var ln = sv.querySelector('.ln'); sv.style.setProperty('--len', Math.ceil(ln.getTotalLength())); setTimeout(function () { sv.classList.add('go'); }, 60); });
      } else if (b.kind === 'donut') {
        var total = rows.reduce(function (t, r) { return t + r.value; }, 0) || 1, C = 2 * Math.PI * 70, off = 0, circles = '';
        rows = rows.slice(0, 8);
        rows.forEach(function (r, i) { var len = C * r.value / total; circles += '<circle cx="95" cy="95" r="70" stroke="' + HUES[i % 8] + '" stroke-dasharray="' + len.toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '"/>'; off += len; });
        card2.appendChild(el('div', { class: 'donut' }, [
          el('div', { html: '<svg viewBox="0 0 190 190">' + circles + '</svg>' }).firstChild,
          el('div', { class: 'lg' }, rows.map(function (r, i) { var sw = el('i'); sw.style.background = HUES[i % 8]; return el('span', {}, [sw, r.label, el('b', { text: show(r.value) + ' · ' + Math.round(r.value / total * 100) + '%' })]); }))
        ]));
      } else {
        var bars = el('div', { class: 'bars' });
        rows.forEach(function (r, k) {
          var fill = el('i'); fill.style.setProperty('--k', k);
          bars.appendChild(el('div', { class: 'bar' }, [el('span', { class: 'lb', text: r.label, title: r.label }), el('span', { class: 'tr' }, [fill]), el('span', { class: 'vl', text: show(r.value) })]));
          setTimeout(function () { fill.style.width = Math.max(1.5, r.value / max * 100) + '%'; }, 60);
        });
        card2.appendChild(bars);
      }
      box.appendChild(card2);
    } else if (b.type === 'table') {
      if (b.title) box.appendChild(el('h4', { class: 'blk-h', text: b.title }));
      box.appendChild(el('div', { class: 'ctable' }, [el('table', {}, [
        el('thead', {}, [el('tr', {}, b.columns.map(function (c) { return el('th', { text: c }); }))]),
        el('tbody', {}, b.rows.map(function (r) { return el('tr', {}, r.map(function (c) { return el('td', { text: c }); })); }))
      ])]));
    } else if (b.type === 'text') {
      box.className = 'blk ctext';
      if (b.heading) box.appendChild(el('h3', { text: b.heading }));
      box.appendChild(el('p', { html: md(b.body || '') }));
    }
    return box;
  }
  var edBox = $('.ed'), browseSort = null;
  function isBrowse() { return edBox.classList.contains('browse'); }
  function measure() { edBox.style.setProperty('--edw', edBox.clientWidth + 'px'); edBox.style.setProperty('--edh', edBox.clientHeight + 'px'); }
  function syncBrowseBtn() {}
  function shopCanvas() {                                     // the Shop view: search, the grid, load more
    var q = (P.shop && P.shop.query) || '';
    return { local: true, shop: true, title: q ? 'TikTok Shop: ' + q : 'TikTok Shop', subtitle: 'Videos that are selling. Search, sort, then click one to work from it.',
      blocks: (showNums && shopVideos().length ? [{ type: 'insights' }, { type: 'chart', kind: 'bar', title: 'Views by video', source: 'shop', metric: 'views', label: 'product', limit: 8 }] : [])
        .concat([{ type: 'shopbar' }, { type: 'videos', source: 'shop', sort: null, heading: 'Videos' }, { type: 'shopmore' }]) };
  }
  var showNums = false;
  try { showNums = localStorage.getItem('ember_shop_numbers') === '1'; } catch (e) {}
  function defaultCanvas() {                                  // what the full view shows when Ember has not composed one
    var sv = shopVideos(), own = Object.keys(P.assets).filter(function (k) { return P.assets[k].kind === 'video'; });
    if (sv.length || (P.shop && P.shop.sort)) return shopCanvas();
    if (own.length) return { local: true, title: 'Your library', subtitle: 'Everything you have to cut with. Click a clip to work from it.',
      blocks: [{ type: 'videos', source: 'library', heading: 'Clips' }].concat(P.tracks.video.length ? [{ type: 'chart', kind: 'bar', title: 'Length of each clip in the cut', source: 'project' }] : []) };
    return { local: true, title: 'Nothing to browse yet', subtitle: '', blocks: [{ type: 'text', heading: 'Ask me what is selling', body: 'Try "show me the top TikTok videos for skincare". I search TikTok Shop and this view fills with the videos and their numbers.' }] };
  }
  function renderCanvas(c, keep) {
    shown = c;
    $('#cv-title').textContent = c.title; $('#cv-sub').textContent = c.subtitle || '';
    var nb = $('#cv-nums'); nb.hidden = !c.shop; nb.setAttribute('aria-pressed', String(showNums)); nb.lastChild.textContent = showNums ? 'Hide the numbers' : 'Show the numbers';
    var body = $('#cv-body'), top = body.scrollTop; body.textContent = '';
    body.classList.toggle('quick', !!keep);
    c.blocks.forEach(function (b, i) { var n = drawBlock(b); n.style.setProperty('--i', i); body.appendChild(n); });
    body.scrollTop = keep ? top : 0;
  }
  function openBrowse(c) {                                    // the rail grows over the editor
    if (!P) return;
    c = c || P.canvas || defaultCanvas();
    if (!c.local) P.canvas = c;
    browseSort = null; pause();
    $('#sheet-create').hidden = true; $('#sheet-post').hidden = true;
    measure();
    edBox.classList.add('browse'); $('#canvas').setAttribute('aria-hidden', 'false');
    renderCanvas(c);                                        // after the class: at phone width the view only has a size once it is open
    syncBrowseBtn(); drawChips();
  }
  function closeBrowse() {                                    // and folds back into the rail
    if (!isBrowse()) return;
    edBox.classList.remove('browse'); $('#canvas').setAttribute('aria-hidden', 'true');
    syncBrowseBtn(); drawChips();
  }
  /* ---------- panels resize: drag the gaps between them. Sizes are kept, and fitted to the window. ---------- */
  var sizes = {};
  try { sizes = JSON.parse(localStorage.getItem('ember_sizes_canvas') || '{}'); } catch (e) {}
  function applySizes() {
    var body = document.body, phone = innerWidth <= 760;
    body.classList.add('sizing'); clearTimeout(applySizes.t);   // sizes snap into place; only the browse view animates
    applySizes.t = setTimeout(function () { body.classList.remove('sizing'); }, 150);
    var put = function (node, name, v) { if (phone || !v) node.style.removeProperty(name); else node.style.setProperty(name, Math.round(v) + 'px'); };
    put(body, '--chatw', sizes.chat && clamp(sizes.chat, 300, Math.max(300, Math.min(680, innerWidth - 640))));
    put(edBox, '--rail', sizes.rail && clamp(sizes.rail, 170, Math.max(170, Math.min(560, edBox.clientWidth - 330))));
    put(edBox, '--tlh', sizes.tl && clamp(sizes.tl, 236, Math.max(236, Math.min(600, edBox.clientHeight - 230))));
    measure();
    if (P) drawTimeline();
  }
  [['#rz-chat', 'chat', 'x', function () { return $('.chat').offsetWidth; }],
   ['#rz-rail', 'rail', 'x', function () { return $('#lib').offsetWidth; }],
   ['#rz-tl', 'tl', 'y', function () { return $('.tl').offsetHeight; }]].forEach(function (h) {
    var bar = $(h[0]), key = h[1], axis = h[2], read = h[3];
    var keep = function () { try { localStorage.setItem('ember_sizes_canvas', JSON.stringify(sizes)); } catch (e) {} };
    bar.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      e.preventDefault();
      var from = axis === 'x' ? e.clientX : e.clientY, size = read();
      document.body.classList.add('resizing', axis === 'x' ? 'rz-x' : 'rz-y'); bar.classList.add('on');
      var move = function (ev) { sizes[key] = size + (axis === 'x' ? ev.clientX - from : from - ev.clientY); applySizes(); };
      var up = function () {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing', 'rz-x', 'rz-y'); bar.classList.remove('on');
        sizes[key] = read(); keep();                          // store what it actually ended up as
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
    bar.addEventListener('dblclick', function () { delete sizes[key]; keep(); applySizes(); });
    bar.addEventListener('keydown', function (e) {             // arrow keys nudge it
      var d = { ArrowLeft: -24, ArrowRight: 24, ArrowUp: 24, ArrowDown: -24 }[e.key];
      if (!d || (axis === 'x') !== (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      e.preventDefault(); e.stopPropagation(); sizes[key] = read() + d; applySizes(); sizes[key] = read(); keep();
    });
  });
  window.addEventListener('resize', applySizes);
  applySizes();
  $('#cv-nums').addEventListener('click', function () {
    showNums = !showNums; try { localStorage.setItem('ember_shop_numbers', showNums ? '1' : '0'); } catch (e) {}
    renderCanvas(shopCanvas()); $('#cv-body').scrollTop = 0;
  });
  $('#cv-close').addEventListener('click', closeBrowse);
  $('#lib-grow').addEventListener('click', function () { openBrowse(defaultCanvas()); });   // opened by hand: the plain grid, never a saved view with numbers
  window.addEventListener('resize', function () { measure(); if (isBrowse() && shown) renderCanvas(shown, true); });

  /* ---------- steps: create and post ---------- */
  function openSheet(which) {                                 // the Post step sits over the editor
    if (which) closeBrowse();
    $('#sheet-create').hidden = true; $('#sheet-post').hidden = which !== 'post';
    if (which === 'post') {
      pause();
      var post = P.post || {};
      $('#post-caption').value = post.caption || '';
      $('#post-tags').value = (post.hashtags || []).join(', ');
      if (post.render) showRender(post.render);
      $('#post-msg').textContent = '';
    }
  }
  function showRender(r) {
    P.post = P.post || {}; P.post.render = r;
    var v = $('#post-video'); v.src = r.url; v.hidden = false; $('#post-wait').hidden = true;
    $('#post-info').textContent = fmt(r.seconds) + ' · ' + r.size_mb + ' MB · ' + r.label;
    $('#post-export').textContent = 'Export again';
  }
  function savePost() {
    var tags = $('#post-tags').value.split(/[,\s#]+/).filter(Boolean);
    return api('/api/project', { method: 'PUT', body: { post: { caption: $('#post-caption').value, hashtags: tags } } });
  }
  $('#s-next').addEventListener('click', function () { openSheet('post'); if (!(P.post && P.post.render)) $('#post-export').click(); });
  $$('.sheet [data-close]').forEach(function (b) { b.addEventListener('click', function () { openSheet(null); }); });
  $$('#sheet-create .starts button').forEach(function (b) {
    b.addEventListener('click', function () {
      openSheet(null);
      if (b.hasAttribute('data-upload')) $('#upload').click();
      else if (b.getAttribute('data-say')) send(b.getAttribute('data-say'));
      else { input.value = b.getAttribute('data-fill'); input.focus(); }
    });
  });
  $('#post-export').addEventListener('click', function () {
    $('#post-wait').hidden = false; $('#post-wait').textContent = 'Exporting'; $('#post-video').hidden = true;
    runAction('render', {});
  });
  $('#post-manual').addEventListener('click', function () {
    if (!(P.post && P.post.render)) return void ($('#post-msg').textContent = 'Export the video first.');
    savePost().then(function () { return api('/api/post', { method: 'POST', body: { mode: 'manual' } }); }).then(function (r) {
      var text = [r.caption].concat((r.hashtags || []).map(function (h) { return '#' + h; })).join(' ').trim();
      var a = el('a', { href: r.download, download: '' }); document.body.appendChild(a); a.click(); a.remove();
      var done = function (ok) { $('#post-msg').textContent = 'Downloading the video.' + (text ? (ok ? ' Caption copied: paste it when you post.' : ' Copy the caption above when you post.') : ''); };
      if (text && navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); }); else done(false);
    }).catch(function (e) { $('#post-msg').textContent = e.message; });
  });
  $('#post-auto').addEventListener('click', function () {
    if (!(P.post && P.post.render)) return void ($('#post-msg').textContent = 'Export the video first.');
    savePost().then(function () { return api('/api/post', { method: 'POST', body: { mode: 'auto' } }); }).then(function (r) {
      $('#post-msg').textContent = 'Added to your queue (position ' + r.position + '). Auto-posting is ' + r.status + ', so nothing is sent yet.';
    }).catch(function (e) { $('#post-msg').textContent = e.message; });
  });

  /* ---------- what the guided flow (flow.js) may use ---------- */
  window.EmberStudio = { $: $, $$: $$, el: el, svg: svg, api: api, headers: headers, mascot: mascot, fmt: fmt, clamp: clamp, user: user,
    project: function () { return P; }, status: function () { return STATUS; }, setProject: setProject, setAvatar: setAvatar,
    bubble: bubble, showNext: showNext, seek: seek, projectId: projectId, newProject: newProject, quiet: quiet, send: send,
    onChange: function (fn) { changeListeners.push(fn); },
    ask: function (text) { input.value = text; input.focus(); input.setSelectionRange(text.length, text.length); },
    act: function (name) { runAction(name, {}); },
    record: function () { startRecording(); },
    post: function () { openSheet('post'); if (!(P.post && P.post.render)) $('#post-export').click(); },
    mountMonitor: function (holder) { holder.appendChild(monEl); syncMedia(true); },
    parkMonitor: function () { if (monEl.parentNode !== monHome) { pause(); monHome.appendChild(monEl); } },
    cut: {                                                    // the video, changed from the canvas
      add: function (asset) { if (A(asset) && A(asset).kind !== 'image') addAsset(asset, undefined, 0); },
      remove: function (asset) { remember(); P.tracks.video = P.tracks.video.filter(function (c) { return c.asset !== asset; }); P.tracks.audio = P.tracks.audio.filter(function (c) { return c.asset !== asset; }); sel = null; changed(); },
      drop: function (id) { remember(); P.tracks.video = P.tracks.video.filter(function (c) { return c.id !== id; }); sel = null; changed(); },
      move: function (id, by) { var v = P.tracks.video, i = v.map(function (c) { return c.id; }).indexOf(id), j = i + by; if (i < 0 || j < 0 || j >= v.length) return; remember(); v.splice(j, 0, v.splice(i, 1)[0]); changed(); },
      clearCaptions: function () { remember(); P.tracks.captions = []; changed(); }
    },
    toEditor: toEditor, editAsset: function (id) { if (!P.tracks.video.some(function (c) { return c.asset === id; })) addAsset(id); toEditor(); } };
  function toEditor() { openSheet(null); if (window.EmberFlow) window.EmberFlow.showFinal(); }
  var monEl = $('.mon'), monHome = $('.ed-top');                // the preview player: parked out of sight, shown inside the Final video panel
  document.body.classList.add('canvas');
  $('.ed').appendChild($('#flow'));                             // the board is the main screen, beside Ember and the media rail

  /* ---------- start ---------- */
  if (!user) return gate('Sign in to open the studio', 'The studio keeps your library, your cuts and your conversation with Ember.', null, 'Go to sign in', 'index.html');
  $('#s-who').textContent = user;
  api('/api/status').then(function (s) {
    STATUS = s;
    $('#orb').classList.toggle('off', s.brain === 'offline');
    setBusy(false);
    return Promise.all([api('/api/project'), api('/api/history')]);
  }).then(function (r) {
    setProject(r[0]);
    undo = []; saved('Saved');
    showLog(r[1]);
    drawTimeline(); measure();
    refreshReview(true);                                     // Ember looks the cut over and speaks first
    if (window.EmberFlow) window.EmberFlow.open();           // the canvas is the studio
  }).catch(function () {
    gate('The studio needs Ember\'s server', 'This page is the studio\'s screen. Ember, the editor\'s storage and the models run from a small server on your machine. Start it, then open the studio from there.',
      'uv run server/ember.py\n\nthen open  http://127.0.0.1:4180/studio.html', 'Back to the site', 'index.html');
  });
})();
