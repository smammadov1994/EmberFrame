(function () {
  'use strict';
  var C = window.EMBER_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var el = function (tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  };
  var money = function (n) {
    return '$' + (n < 0.1 && Math.round(n * 1000) % 10 !== 0 ? n.toFixed(3) : n.toFixed(2));
  };
  var LOCK = '<svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><rect x="4" y="11" width="16" height="10"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';

  /* ---------- Accounts ----------
     STUB: accounts live in this browser's localStorage so the flow can be
     tried end to end. Replace `Auth` with calls to a real backend before
     launch; nothing here is real security. */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function digest(email, pass) {
    var text = email + '|' + pass;
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return Promise.resolve('x' + h);
  }
  var Auth = {
    user: function () {
      var email = store.get('ember_session', null);
      var users = store.get('ember_users', {});
      return email && users[email] ? { email: email, plan: users[email].plan } : null;
    },
    signup: function (email, pass, plan) {
      email = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error('Enter a valid email address.'));
      if (pass.length < 8) return Promise.reject(new Error('Password needs at least 8 characters.'));
      var users = store.get('ember_users', {});
      if (users[email]) return Promise.reject(new Error('That email already has an account. Log in instead.'));
      return digest(email, pass).then(function (h) {
        users[email] = { hash: h, plan: plan };
        store.set('ember_users', users);
        store.set('ember_session', email);
      });
    },
    login: function (email, pass) {
      email = email.trim().toLowerCase();
      var users = store.get('ember_users', {});
      return digest(email, pass).then(function (h) {
        if (!users[email] || users[email].hash !== h) throw new Error('Email or password does not match.');
        store.set('ember_session', email);
      });
    },
    logout: function () { store.del('ember_session'); }
  };

  function changed() {
    renderAccount();
    document.dispatchEvent(new Event('ember:auth'));
  }

  function renderAccount() {
    var box = $('#account');
    if (!box) return;
    var dark = box.hasAttribute('data-dark');
    var u = Auth.user();
    box.textContent = '';
    if (u) {
      box.appendChild(el('a', { class: 'btn btn-accent', href: 'studio.html', text: 'Open studio' }));
      box.appendChild(el('span', { class: 'who', text: u.email, title: u.email }));
      box.appendChild(el('button', { type: 'button', class: 'btn ' + (dark ? 'btn-ghost-dark' : ''), text: 'Log out', onclick: function () { Auth.logout(); changed(); } }));
    } else {
      box.appendChild(el('button', { type: 'button', class: 'btn ' + (dark ? 'btn-ghost-dark' : ''), text: 'Log in', onclick: function () { openAuth('login'); } }));
      box.appendChild(el('button', { type: 'button', class: 'btn btn-accent', text: 'Sign up', onclick: function () { openAuth('signup'); } }));
    }
  }

  /* ---------- Sign up / log in modal ---------- */
  var overlay = null, lastFocus = null;
  function closeAuth() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') closeAuth(); }

  function openAuth(mode, opts) {
    opts = opts || {};
    if (!overlay) lastFocus = document.activeElement;
    if (overlay) overlay.remove();
    var state = { plan: opts.plan || 'payg' };
    var title = mode === 'login' ? 'Welcome back' : mode === 'pay' ? 'Payment' : mode === 'done' ? 'You are in' : 'Join Emberframe';
    var modal = el('div', { class: 'modal stack', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'auth-title' });
    modal.appendChild(el('div', { class: 'between' }, [
      el('h2', { id: 'auth-title', class: 'display', text: title }),
      el('button', { type: 'button', class: 'x', 'aria-label': 'Close', onclick: closeAuth, html: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"><path d="M5 5l14 14M19 5L5 19"></path></svg>' })
    ]));

    if (mode === 'signup' || mode === 'login') {
      var tabs = el('div', { class: 'seg', role: 'group', 'aria-label': 'Account' }, [
        el('button', { type: 'button', 'aria-pressed': String(mode === 'signup'), text: 'Sign up', onclick: function () { openAuth('signup'); } }),
        el('button', { type: 'button', 'aria-pressed': String(mode === 'login'), text: 'Log in', onclick: function () { openAuth('login'); } })
      ]);
      var email = el('input', { id: 'auth-email', type: 'email', autocomplete: 'email', placeholder: 'you@yourshop.com', required: '' });
      var pass = el('input', { id: 'auth-pass', type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', required: '' });
      var err = el('p', { class: 'err', role: 'alert' });
      var form = el('form', { class: 'stack', style: 'gap:14px', novalidate: '' }, [
        tabs,
        el('div', {}, [el('label', { for: 'auth-email', text: 'Email' }), email]),
        el('div', {}, [el('label', { for: 'auth-pass', text: mode === 'signup' ? 'Password (8 characters or more)' : 'Password' }), pass])
      ]);
      if (mode === 'signup') {
        var pick = el('div', { class: 'planpick', role: 'group', 'aria-label': 'Plan' });
        C.plans.forEach(function (p) {
          var b = el('button', { type: 'button', 'aria-pressed': String(p.id === state.plan) }, [
            el('span', {}, [el('b', { text: p.name }), el('small', { text: p.detail })]),
            el('i', { text: p.price ? '$' + p.price + '/mo' : money(C.videoRate) + '/s' })
          ]);
          b.addEventListener('click', function () {
            state.plan = p.id;
            $$('button', pick).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
            go.textContent = p.price ? 'Create account and continue' : 'Create account';
          });
          pick.appendChild(b);
        });
        form.appendChild(pick);
      }
      var go = el('button', { type: 'submit', class: 'btn btn-lg btn-accent', text: mode === 'signup' ? 'Create account' : 'Log in' });
      form.appendChild(err);
      form.appendChild(go);
      if (mode === 'signup') form.appendChild(el('p', { class: 'fine', text: 'An account opens the full library and the studio. You only pay when you render or pick a plan. [YOUR CANCELLATION TERMS]' }));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        err.textContent = '';
        var job = mode === 'signup' ? Auth.signup(email.value, pass.value, state.plan) : Auth.login(email.value, pass.value);
        job.then(function () {
          changed();
          var plan = C.plans.filter(function (p) { return p.id === state.plan; })[0];
          if (mode === 'signup') openAuth(plan.price ? 'pay' : 'done', { plan: plan.id });
          else closeAuth();
        }).catch(function (x) { err.textContent = x.message; });
      });
      modal.appendChild(form);
    }

    if (mode === 'pay') {
      var plan = C.plans.filter(function (p) { return p.id === state.plan; })[0];
      modal.appendChild(el('p', { text: 'Your account is created and the library is open. One step left to start the plan.' }));
      modal.appendChild(el('div', { class: 'receipt' }, [el('span', { text: plan.name + ' plan, billed monthly' }), el('b', { text: '$' + plan.price })]));
      modal.appendChild(el('div', { class: 'checkout', text: '[YOUR CHECKOUT GOES HERE: card form from your payment provider]' }));
      modal.appendChild(el('p', { class: 'fine', text: 'Payments are not switched on yet. Nothing is charged.' }));
      modal.appendChild(el('button', { type: 'button', class: 'btn', text: 'Continue to the library', onclick: function () { closeAuth(); if (!$('#library-grid')) location.href = 'library.html'; } }));
    }

    if (mode === 'done') {
      modal.appendChild(el('p', { text: 'Your account is created. Every video in the library is open to you now.' }));
      modal.appendChild(el('button', { type: 'button', class: 'btn btn-accent btn-lg', text: 'Open the library', onclick: function () { closeAuth(); if (!$('#library-grid')) location.href = 'library.html'; } }));
    }

    overlay = el('div', { class: 'overlay' }, [modal]);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeAuth(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    var first = $('input', modal) || $('.btn', modal);
    if (first) first.focus();
  }

  /* ---------- Video tiles ---------- */
  var watcher = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
      else e.target.pause();
    });
  }, { threshold: 0.25 }) : null;

  // A real file plays muted, looping, with a poster, paused off screen.
  // Until one exists the slot shows its placeholder art and label.
  function frame(item, i, topLabel, emptyLabel) {
    var f = el('div', { class: 'frame art-' + (i % 4) });
    if (item.aspect) f.style.aspectRatio = item.aspect;
    var v = null;
    if (item.src) {
      f.classList.add('has-video');
      v = el('video', { src: item.src, muted: '', loop: '', playsinline: '', preload: 'metadata' });
      v.muted = true;
      if (item.poster) v.poster = item.poster;
      f.appendChild(v);
      if (watcher) watcher.observe(v); else v.autoplay = true;
    }
    // Nothing is drawn over a playing video. A click on it turns its sound on or off.
    if (v) {
      f.addEventListener('click', function () {
        var on = v.muted;
        $$('video').forEach(function (o) { o.muted = true; });
        v.muted = !on;
      });
    } else if (emptyLabel) {
      f.appendChild(el('span', { class: 'gen', text: emptyLabel }));
    }
    return f;
  }

  // 7-day units where Kaiyros measures them, otherwise the video's views.
  function stat(p) { return p.units ? p.units + ' units / 7 days' : p.views + ' views'; }

  function productTile(p, i, open) {
    var media;
    if (open) {
      media = frame(p, i, { text: i < C.freePreviews ? 'FREE PREVIEW' : 'UNLOCKED', badge: true }, '[KAIYROS VIDEO]');
    } else {
      media = el('button', { type: 'button', class: 'frame locked art-' + (i % 4), 'aria-label': 'Sign up to unlock the ' + p.name + ' video', html: LOCK + '<b>Sign up to unlock</b>', onclick: function () { openAuth('signup'); } });
      if (p.poster) { media.style.backgroundImage = 'url(' + p.poster + ')'; media.classList.add('has-poster'); }
    }
    var note = el('p', { class: 'fine', role: 'status' });
    return el('article', { class: 'tile stack' }, [
      media,
      el('div', { class: 'stack' }, [
        el('span', { class: 'tile-name', text: p.name }),
        el('span', { class: 'fine', text: p.cat + ' · ' + stat(p) }),
        p.creator ? el('span', { class: 'fine credit', text: '@' + p.creator + ' on TikTok' }) : null,
        open ? el('button', { type: 'button', class: 'remake', text: 'Remake with my avatar', onclick: function () {
          if (!Auth.user()) return openAuth('signup');
          note.textContent = 'The Creator tab is not built yet. This will open it with this video preselected.';
        } }) : null,
        note
      ])
    ]);
  }

  function fillProducts(grid, limit) {
    var cat = grid.getAttribute('data-cat') || 'All';
    var signedIn = !!Auth.user();
    grid.textContent = '';
    C.products.forEach(function (p, i) {
      if (limit && i >= limit) return;
      if (cat !== 'All' && p.cat !== cat) return;
      grid.appendChild(productTile(p, i, signedIn || i < C.freePreviews));
    });
  }

  /* ---------- Page wiring ---------- */
  function initPrices() {
    var vals = {
      rate: money(C.videoRate), image: money(C.imagePrice), clip5: money(C.videoRate * 5),
      creator: '$' + C.plans[1].price, pro: '$' + C.plans[2].price
    };
    $$('[data-price]').forEach(function (n) { n.textContent = vals[n.getAttribute('data-price')]; });
  }

  function initExamples() {
    var groups = { swap: $('#examples-swap'), wide: $('#examples-wide') };
    if (!groups.swap) return;
    var count = { swap: 0, wide: 0 };
    C.examples.forEach(function (x, i) {
      var top = x.group === 'swap' ? 'ORIGINAL | REMADE' : 'SHOT ' + ('0' + (++count.wide)).slice(-2);
      groups[x.group].appendChild(el('figure', { class: 'tile stack' }, [
        frame(x, i, { text: top }, ''),
        el('figcaption', { class: 'stack' }, [el('span', { class: 'tile-title', text: x.title }), el('span', { class: 'fine', text: x.note + (x.group === 'swap' ? '. Right half AI-generated' : ' · AI-generated') })])
      ]));
    });
  }

  // Hero: the most viewed selling videos in the Kaiyros pull, beside one remade video.
  function initShop() {
    var rows = $('#shop-rows');
    if (!rows) return;
    var top = C.products.slice().sort(function (a, b) { return b.viewsN - a.viewsN; }).slice(0, 5);
    top.forEach(function (p, i) {
      var bar = el('span', { class: 'bar' }, [el('i')]);
      bar.firstChild.style.width = Math.max(4, Math.round(p.viewsN / top[0].viewsN * 100)) + '%';
      rows.appendChild(el('a', { class: 'shop-row', href: 'library.html' }, [
        el('span', { class: 'r', text: ('0' + (i + 1)).slice(-2) }),
        el('span', { class: 'n' }, [el('b', { text: p.name }), el('small', { text: p.cat + (p.units ? ' · ' + p.units + ' units / 7d' : '') })]),
        bar,
        el('span', { class: 'u', text: p.views })
      ]));
    });
  }

  // Hero reel: a fan of clips rendered on our GPUs.
  function initReel() {
    var reel = $('#reel');
    if (!reel) return;
    var mid = (C.reel.length - 1) / 2;
    C.reel.forEach(function (x, i) {
      var card = el('figure', { class: 'reel-card' }, [frame(x, i, { text: x.title }, '')]);
      card.style.setProperty('--i', i - mid);
      card.style.setProperty('--a', Math.abs(i - mid));
      card.style.setProperty('--k', i);
      reel.appendChild(card);
    });
  }

  // Hero: a few selling-video thumbnails floating at the edges, like finds on a desk.
  function initFloats() {
    var box = $('#hero-floats');
    if (!box) return;
    // four only, kept above the reel so none sits behind a clip
    C.products.slice(3, 7).forEach(function (p, i) {
      var n = el('img', { src: p.poster, alt: '', loading: 'lazy', class: 'float f' + [0, 1, 3, 4][i] });
      n.style.setProperty('--k', i);
      box.appendChild(n);
    });
  }

  // Ticker: every product in the pull, scrolling. Decorative copy of the library data.
  function initTicker() {
    var t = $('#ticker');
    if (!t) return;
    for (var pass = 0; pass < 2; pass++) {
      C.products.forEach(function (p) {
        t.appendChild(el('span', {}, [el('b', { text: p.name }), el('i', { text: stat(p) }), el('em', { text: '@' + p.creator })]));
      });
    }
  }

  // Visual for one node's output: a picture resolving, checks ticking, lines or
  // JSON appearing, a voice wave, the swap wipe, start pictures, or the video.
  var TICK = '<svg aria-hidden="true" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5.5"/></svg>';
  function stageVisual(st) {
    var vis = el('div', { class: 'cv-vis k-' + st.kind });
    var img = function (src, cls) { var n = el('img', { src: src, alt: '', class: cls || '' }); if (st.pos) n.style.objectPosition = st.pos; return n; };
    var seq = function (cls, items, make) {
      return el('div', { class: cls }, items.map(function (t, n) { var c = make(t); c.style.setProperty('--n', n); return c; }));
    };
    if (st.kind === 'image') vis.appendChild(img(st.src));
    if (st.kind === 'checks') {
      vis.appendChild(img(st.src));
      vis.appendChild(seq('cv-checks', st.items, function (t) { var c = el('span', { html: TICK }); c.appendChild(document.createTextNode(t)); return c; }));
    }
    if (st.kind === 'lines') {
      vis.appendChild(seq('cv-lines' + (st.quote ? ' quote' : ''), st.items, function (t) { var c = el('span', { html: st.quote ? '' : TICK }); c.appendChild(document.createTextNode(t)); return c; }));
    }
    if (st.kind === 'json') {
      var rows = [['{', '']].concat(st.rows).concat([['}', '']]);
      vis.appendChild(seq('cv-json', rows, function (r) {
        return r[1] === '' ? el('span', { class: 'brace', text: r[0] }) : el('span', {}, [el('b', { text: '"' + r[0] + '"' }), document.createTextNode(': '), el('i', { text: r[1] })]);
      }));
    }
    if (st.kind === 'wave') {
      var bars = [];
      for (var i = 0; i < 40; i++) { var bar = el('i'); bar.style.setProperty('--n', i); bar.style.setProperty('--h', (18 + Math.abs(Math.sin(i * 1.7) * 60) + (i % 3) * 6).toFixed(0) + '%'); bars.push(bar); }
      vis.appendChild(el('div', { class: 'cv-wave' }, bars));
    }
    if (st.kind === 'wipe') {
      vis.appendChild(img(st.src));
      vis.appendChild(img(st.src2, 'over'));
      vis.appendChild(el('span', { class: 'cv-scan' }));
    }
    if (st.kind === 'grid') {
      vis.appendChild(seq('cv-grid', st.items, function (src) { return el('span', {}, [el('img', { src: src, alt: '' })]); }));
      $$('.cv-grid span', vis).forEach(function (c, n) { c.appendChild(el('b', { text: String(n + 1) })); });
    }
    if (st.kind === 'video') vis.appendChild(frame(st.video, 0, {}, ''));
    return vis;
  }

  /* ---------- n8n-style workflow canvas ---------- */
  var ICON = {
    scheduleTrigger: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    manualTrigger: '<path d="M6 4l13 7.5-5.5 1.8L11.5 19z"/>',
    code: '<path d="M9 4c-2 0-3 1-3 3v2c0 1.2-.8 2.2-2 3 1.2.8 2 1.8 2 3v2c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2c0 1.2.8 2.2 2 3-1.2.8-2 1.8-2 3v2c0 2-1 3-3 3"/>',
    executeCommand: '<path d="M4 6l6 6-6 6M12.5 18H20"/>',
    set: '<path d="M4 20l4.5-1L19.5 8l-3.5-3.5L5 15.5z"/>',
    'if': '<path d="M3 12h6l4-6h8M9 12l4 6h8"/>',
    noOp: '<path d="M4 12h15M13.5 6.5L19 12l-5.5 5.5"/>'
  };
  var svgIcon = function (d) { return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  var NS = 'http://www.w3.org/2000/svg';
  var svgEl = function (tag, attrs) { var n = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; };
  var NODE = 64;

  // Draws the graph and returns handles to its nodes and wires.
  function drawFlow(wf, canvas) {
    var S = 0.66, N = NODE, PX = 56, PY = 34;
    var minX = Math.min.apply(null, wf.nodes.map(function (n) { return n.x; }));
    var minY = Math.min.apply(null, wf.nodes.map(function (n) { return n.y; }));
    var g = { pos: {}, els: {}, wires: {}, type: {}, sub: {} }, w = 0, h = 0;
    canvas.textContent = '';
    var svg = svgEl('svg', { 'aria-hidden': 'true' });
    canvas.appendChild(svg);
    wf.nodes.forEach(function (n) {
      var x = (n.x - minX) * S + PX, y = (n.y - minY) * S + PY;
      g.pos[n.name] = { x: x, y: y, type: n.type };
      g.type[n.name] = n.type; g.sub[n.name] = n.sub || '';
      w = Math.max(w, x + N + PX + 34); h = Math.max(h, y + N + 66);
      var trig = /Trigger$/.test(n.type);
      var node = el('div', { class: 'n8 t-' + n.type + (trig ? ' trig' : '') + (n.ghost ? ' ghost' : ''), html: svgIcon(ICON[n.type] || ICON.noOp) });
      node.style.left = x + 'px'; node.style.top = y + 'px';
      node.style.setProperty('--d', Math.round((x - PX) * 0.5) + 'ms');
      if (trig) node.appendChild(el('span', { class: 'bolt', html: '<svg aria-hidden="true" viewBox="0 0 10 10" fill="currentColor"><path d="M6 0L1 6h3l-1 4 5-6H5z"/></svg>' }));
      node.appendChild(el('span', { class: 'ok', html: TICK }));
      node.appendChild(el('span', { class: 'cap' }, [el('b', { text: n.name }), n.sub ? el('small', { text: n.sub }) : null]));
      canvas.appendChild(node);
      g.els[n.name] = node;
    });
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    wf.edges.forEach(function (e) {
      var a = g.pos[e[0]], b = g.pos[e[1]];
      if (!a || !b) return;
      var branch = a.type === 'if';
      var x1 = a.x + N, y1 = a.y + N * (branch ? (e[2] ? 0.72 : 0.28) : 0.5), x2 = b.x, y2 = b.y + N / 2;
      var dx = Math.max(36, (x2 - x1) * 0.5);
      var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2;
      var wire = svgEl('path', { class: 'wire', d: d });
      svg.appendChild(wire);
      var lit = svgEl('path', { class: 'lit', d: d });
      svg.appendChild(lit);
      var len = Math.ceil(lit.getTotalLength ? lit.getTotalLength() : 0) || 400;
      lit.style.setProperty('--len', len);
      svg.appendChild(svgEl('circle', { cx: x1, cy: y1, r: 4 }));
      svg.appendChild(svgEl('circle', { cx: x2, cy: y2, r: 4 }));
      if (branch) { var t = svgEl('text', { x: x1 + 9, y: y1 + (e[2] ? 14 : -7) }); t.textContent = e[2] ? 'false' : 'true'; svg.appendChild(t); }
      g.wires[e[0] + '>' + e[1]] = lit;
    });
    return g;
  }

  // Plays one run through the workflow: a token rides each wire, the node it
  // reaches runs, and the panel below shows what that node produced. Then the
  // next workflow. Only runs while the canvas is on screen.
  function initPipelines() {
    var P = window.EMBER_PIPELINES, RUNS = window.EMBER_RUNS, tabs = $('#flow-tabs');
    if (!P || !RUNS || !tabs) return;
    var canvas = $('#flow-canvas'), scroll = $('#flow-scroll'), strip = $('#flow-strip');
    var text = $('#flow-text'), out = $('#flow-out'), state = $('#flow-state');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var cur = 0, step = -1, timer = null, visible = false, g = null, run = [], token = null, raf = 0;
    var later = function (fn, ms) { clearTimeout(timer); timer = setTimeout(fn, ms); };

    function moveToken(x, y) { token.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }
    // a spark the ember sheds as it travels: drifts up and burns out
    function spark(x, y) {
      var sp = el('i', { class: 'flow-spark' });
      sp.style.left = (x + (Math.random() - 0.5) * 8) + 'px';
      sp.style.top = (y + (Math.random() - 0.5) * 8) + 'px';
      sp.style.setProperty('--dx', ((Math.random() - 0.5) * 18).toFixed(1) + 'px');
      sp.style.setProperty('--dy', (-8 - Math.random() * 18).toFixed(1) + 'px');
      canvas.appendChild(sp);
      setTimeout(function () { sp.remove(); }, 620);
    }
    function ride(path, ms) {
      cancelAnimationFrame(raf);
      var len = path.getTotalLength(), t0 = performance.now(), shed = 0;
      token.classList.remove('in');
      (function go(t) {
        var k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var pt = path.getPointAtLength(len * e);
        moveToken(pt.x, pt.y);
        if (t - shed > 26) { shed = t; spark(pt.x, pt.y); }
        if (k < 1) raf = requestAnimationFrame(go);
      })(t0);
    }
    function show(i) {
      var s = run[i], wf = P[cur];
      $$('video', out).forEach(function (v) { if (watcher) watcher.unobserve(v); v.pause(); });
      text.textContent = ''; out.textContent = '';
      text.appendChild(el('span', { class: 'tag', text: 'Node ' + ('0' + (i + 1)).slice(-2) + ' of ' + ('0' + run.length).slice(-2) + ' / output' }));
      text.appendChild(el('h3', { text: s.node }));
      if (g.sub[s.node]) text.appendChild(el('span', { class: 'fine', text: g.sub[s.node] }));
      text.appendChild(el('p', { text: s.text }));
      if (i === run.length - 1) text.appendChild(el('p', { class: 'flow-status', text: wf.status }));
      var holder = el('div', { class: 'cv-stage' }, [stageVisual(s.out)]);
      out.appendChild(holder);
      setTimeout(function () { holder.classList.add('active'); }, 40);
      $$('span', strip).forEach(function (c, k) { c.classList.toggle('on', k === i); c.classList.toggle('seen', k <= i); });
      var chip = strip.children[i];
      if (chip) strip.scrollLeft = Math.max(0, chip.offsetLeft - strip.clientWidth / 2);
    }
    function arrive(i) {
      var s = run[i], node = g.els[s.node], p = g.pos[s.node];
      $$('.running', canvas).forEach(function (n) { n.classList.remove('running'); n.classList.add('ran'); });
      node.classList.add('running');
      // the ember lands in the node: the node blips, the ember is absorbed
      // the ember stops at the node's edge and is taken in there; orange then
      // spreads around the border from the point of contact
      node.classList.remove('blip', 'eat'); void node.offsetWidth; node.classList.add('blip', 'eat');
      token.classList.add('in');
      if (i > 0) for (var b = 0; b < 5; b++) spark(p.x, p.y + NODE / 2);
      var left = p.x + NODE / 2 - scroll.clientWidth / 2;
      if (scroll.scrollTo) scroll.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' }); else scroll.scrollLeft = Math.max(0, left);
      show(i);
      later(next, s.ms);
    }
    function next() {
      if (!visible) { timer = null; return; }
      if (step >= run.length - 1) {
        $$('.running', canvas).forEach(function (n) { n.classList.remove('running'); n.classList.add('ran'); });
        state.textContent = 'Finished'; state.classList.add('done');
        later(function () { build((cur + 1) % P.length); }, 4200);
        return;
      }
      step++;
      var wire = step > 0 ? g.wires[run[step - 1].node + '>' + run[step].node] : null;
      if (wire) { wire.classList.add('go'); ride(wire, 460); later(function () { arrive(step); }, 470); }
      else arrive(step);
    }
    function build(i) {
      clearTimeout(timer); timer = null; cancelAnimationFrame(raf);
      cur = i; step = -1;
      var wf = P[i];
      run = RUNS[wf.id] || [];
      $$('button', tabs).forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
      $('#flow-name').textContent = wf.name;
      state.textContent = 'Running'; state.classList.remove('done');
      canvas.classList.remove('play');
      g = drawFlow(wf, canvas);
      token = el('span', { class: 'flow-token in' }, [el('i')]);
      canvas.appendChild(token);
      scroll.scrollLeft = 0;
      strip.textContent = '';
      run.forEach(function (s) {
        var chip = el('span', { html: s.thumb ? '' : svgIcon(ICON[g.type[s.node]] || ICON.noOp) });
        if (s.thumb) chip.style.backgroundImage = 'url(' + s.thumb + ')';
        strip.appendChild(chip);
      });
      setTimeout(function () { canvas.classList.add('play'); }, 40);
      if (reduce) {                       // no motion: show the finished run and its last output
        run.forEach(function (s, k) { g.els[s.node].classList.add('ran'); if (k) { var w = g.wires[run[k - 1].node + '>' + s.node]; if (w) w.classList.add('go'); } });
        token.style.display = 'none'; state.textContent = 'Finished'; state.classList.add('done');
        show(run.length - 1);
        return;
      }
      show(0); step = -1;
      if (visible) later(next, 900);
    }
    P.forEach(function (wf, i) { tabs.appendChild(el('button', { type: 'button', text: wf.name, onclick: function () { build(i); } })); });
    // Run only while the panel is on screen; resume where it stopped.
    var flow = $('#flow');
    var inView = function () { var r = flow.getBoundingClientRect(); return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15; };
    var check = function () {
      var now = inView();
      if (now && !visible && !timer && !reduce) later(next, 500);
      if (!now && visible) { clearTimeout(timer); timer = null; }
      visible = now;
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    setInterval(check, 800);          // scroll events can be throttled; this keeps the run honest
    visible = inView();
    // start on the Episode machine: the longest run, with branches
    var first = 0;
    P.forEach(function (wf, i) { if (wf.id === 'episode-machine') first = i; });
    build(first);
  }

  function initTicket() {
    var t = $('#ticket');
    if (!t) return;
    var st = { mode: 'idea', product: 0, who: 0, secs: C.clipSeconds.default };
    var prompt = $('#ticket-prompt'), range = $('#ticket-secs'), msg = $('#ticket-msg');
    range.min = C.clipSeconds.min; range.max = C.clipSeconds.max; range.value = st.secs;
    prompt.value = C.ideas[0];

    C.ideas.forEach(function (idea, i) {
      $('#ticket-ideas').appendChild(el('button', { type: 'button', text: 'Idea ' + (i + 1) + ': ' + idea.split(',')[0], onclick: function () { prompt.value = idea; draw(); } }));
    });
    C.products.slice(0, 3).forEach(function (p, i) {
      $('#ticket-products').appendChild(el('button', { type: 'button', 'data-i': i, onclick: function () { st.product = i; draw(); } }, [el('b', { text: p.name }), el('span', { text: stat(p) })]));
    });
    $$('#ticket-mode button').forEach(function (b) {
      b.addEventListener('click', function () { st.mode = b.getAttribute('data-mode'); st.who = 0; draw(); });
    });
    range.addEventListener('input', function () { st.secs = Number(range.value); draw(); });
    $('#ticket-go').addEventListener('click', function () {
      if (!Auth.user()) return openAuth('signup');
      msg.textContent = 'Rendering is not connected yet. Your ticket is ready for when it is.';
    });

    function draw() {
      var idea = st.mode === 'idea';
      $$('#ticket-mode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === st.mode)); });
      $('#ticket-idea').hidden = !idea;
      $('#ticket-shop').hidden = idea;
      $$('#ticket-products button').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-i')) === st.product)); });
      var people = idea ? ['No one'].concat(C.creators) : C.creators;
      $('#ticket-who-label').textContent = idea ? '02 / WHO IS IN IT' : '02 / YOUR CREATOR';
      var who = $('#ticket-who');
      who.textContent = '';
      people.forEach(function (n, i) {
        who.appendChild(el('button', { type: 'button', 'aria-pressed': String(i === st.who), text: n, onclick: function () { st.who = i; draw(); } }));
      });
      var name = people[st.who];
      var wait = Math.round(st.secs * C.renderSecondsPerClipSecond);
      $('#ticket-secs-label').textContent = st.secs + ' seconds';
      $('#ticket-summary').textContent = idea
        ? 'Your shot, with sound' + (name === 'No one' ? '' : ', starring ' + name)
        : name + ' selling the ' + C.products[st.product].name.toLowerCase();
      $('#ticket-wait').textContent = wait >= 120 ? 'about ' + Math.round(wait / 60) + ' min' : 'about ' + wait + ' s';
      $('#ticket-total').textContent = money(C.videoRate * st.secs);
      msg.textContent = '';
    }
    draw();
  }

  function initEditor() {
    var ed = $('#editor');
    if (!ed) return;
    var chat = $('#ed-chat');
    var say = function (who, text) {
      chat.appendChild(el('div', { class: 'msg ' + who, text: text }));
      chat.scrollTop = chat.scrollHeight;
    };
    var acts = {
      hook: { ask: 'Make the hook hit sooner.', done: 'Cut the hook from 2.4 s to 1.2 s and moved the syrup pour up.', run: function () {
        var c = $('#clip-hook'); c.style.flexGrow = '0.5'; c.classList.add('hot'); $('#ed-len').textContent = '6.8 s';
      } },
      captions: { ask: 'Add captions.', done: 'Added a caption track timed to the voice. Three lines, one per beat.', run: function () {
        $('#track-captions').hidden = false; $('#ed-cap').hidden = false; $('#ed-captions').textContent = 'On';
      } },
      creator: { ask: 'Swap Juno for Rafa.', done: 'Recast the on-camera shots with Rafa and re-voiced the lines. Same script, same timing.', run: function () {
        $('#ed-creator').textContent = 'Rafa'; $('#ed-voice').textContent = 'Rafa, warm'; $('#clip-voice').textContent = 'Rafa: voice'; $('#clip-voice').classList.add('hot');
      } },
      ending: { ask: 'Try a different ending.', done: 'Wrote a second offer shot: the price on screen, then a tap on the lid. Kept the first as an alternate.', run: function () {
        var c = $('#clip-offer'); c.textContent = 'Offer B'; c.classList.add('hot');
      } }
    };
    $$('#ed-chips button').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = acts[b.getAttribute('data-act')];
        b.disabled = true;
        say('you', a.ask);
        setTimeout(function () { a.run(); say('agent', a.done); }, 500);
      });
    });
  }

  function initLibrary() {
    var grid = $('#library-grid');
    var teaser = $('#teaser-grid');
    var draw = function () {
      if (grid) fillProducts(grid);
      if (teaser) fillProducts(teaser, 8);
      var signedIn = !!Auth.user();
      $$('[data-guest]').forEach(function (n) { n.hidden = signedIn; });
      $$('[data-member]').forEach(function (n) { n.hidden = !signedIn; });
    };
    $$('#cats button').forEach(function (b) {
      b.addEventListener('click', function () {
        grid.setAttribute('data-cat', b.getAttribute('data-cat'));
        $$('#cats button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        draw();
      });
    });
    document.addEventListener('ember:auth', draw);
    draw();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-auth]') : null;
    if (!t) return;
    e.preventDefault();
    if (Auth.user() && t.hasAttribute('data-href')) { location.href = t.getAttribute('data-href'); return; }
    openAuth(t.getAttribute('data-auth'));
  });

  renderAccount();
  initPrices();
  initExamples();
  initShop();
  initReel();
  initFloats();
  initTicker();
  initPipelines();
  initTicket();
  initEditor();
  initLibrary();
})();
