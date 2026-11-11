// Ember streams: hundreds of fine particles ride a slowly turning flow field
// and leave fading trails, like smoke lit from below. They curl around the
// pointer and surge with scroll. Decorative only: no pointer events, paused
// when the tab is hidden, one still frame for reduced motion.
(function () {
  'use strict';
  var c = document.getElementById('embers');
  if (!c || !c.getContext) return;
  var ctx = c.getContext('2d');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, pts = [], raf = 0, last = 0, time = 0;
  var mouse = { x: 0, y: 0, on: false };
  var lastScroll = window.scrollY || 0, kick = 0, surge = 0;
  var PALETTE = ['255,122,74', '242,90,43', '255,176,128', '255,214,186', '196,62,24'];

  function spawn(p, anywhere) {
    p.x = Math.random() * W;
    p.y = anywhere ? Math.random() * H : H * (0.35 + Math.random() * 0.75);
    p.px = p.x; p.py = p.y;
    p.life = 0;
    p.max = 3 + Math.random() * 6;                       // seconds
    p.sp = 22 + Math.random() * 46;                      // px per second
    p.w = Math.random() < 0.12 ? 1.8 : 0.7 + Math.random() * 0.6;
    p.col = PALETTE[(Math.random() * PALETTE.length) | 0];
    p.a = 0.17 + Math.random() * 0.42;
    return p;
  }
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = Math.max(110, Math.min(580, Math.round(W * H / 2400)));
    while (pts.length < want) pts.push(spawn({}, true));
    pts.length = want;
    if (still) still_frame();
  }
  // Flow direction at a point: layered waves, biased upward like heat rising.
  function angle(x, y) {
    var a = Math.sin(x * 0.0019 + time * 0.11) * Math.cos(y * 0.0024 - time * 0.07) * 2.2;
    a += Math.sin((x + y) * 0.0011 + time * 0.05) * 1.3;
    a += Math.cos(x * 0.0043 - y * 0.0031 + time * 0.09) * 0.5;
    return a - 1.5708;                                   // centre the field on "up"
  }
  function step(dt) {
    // fade what is already drawn, keeping the canvas transparent
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.5, 0.065 + Math.abs(kick) * 0.004).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    surge += (Math.min(3, Math.abs(kick) * 0.08) - surge) * Math.min(1, dt * 5);
    var shift = kick; kick = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.life += dt;
      if (shift) { p.y -= shift * 0.45; p.py -= shift * 0.45; }
      var a = angle(p.x, p.y), sp = p.sp * (1 + surge);
      var vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      if (mouse.on) {
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 52900 && d2 > 1) {                      // within 230px: orbit the pointer
          var d = Math.sqrt(d2), f = (1 - d / 230);
          vx += (-dy / d) * 170 * f - (dx / d) * 34 * f;
          vy += (dx / d) * 170 * f - (dy / d) * 34 * f;
        }
      }
      p.px = p.x; p.py = p.y;
      p.x += vx * dt; p.y += vy * dt;
      var k = p.life / p.max;
      if (k >= 1 || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) { spawn(p, false); continue; }
      var alpha = p.a * Math.sin(k * 3.1416);            // fade in, fade out
      ctx.strokeStyle = 'rgba(' + p.col + ',' + alpha.toFixed(3) + ')';
      ctx.lineWidth = p.w;
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function still_frame() {
    ctx.clearRect(0, 0, W, H);
    for (var n = 0; n < 90; n++) { time += 0.016; step(0.016); }
  }
  function tick(t) {
    var dt = Math.min(0.04, (t - last) / 1000 || 0);
    last = t; time += dt;
    step(dt);
    raf = requestAnimationFrame(tick);
  }
  function run() { if (!still && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  // Streams are brightest behind the hero and settle back once you are reading.
  function dim() { c.style.opacity = String(Math.max(0.36, 0.85 - (window.scrollY || 0) / 1100)); }

  window.addEventListener('resize', size);
  window.addEventListener('scroll', function () {
    var y = window.scrollY || 0;
    kick += Math.max(-90, Math.min(90, y - lastScroll));
    lastScroll = y;
    dim();
  }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', function () { mouse.on = false; });
  window.addEventListener('blur', function () { mouse.on = false; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else run(); });
  size(); dim();
  if (!still) { for (var n = 0; n < 40; n++) { time += 0.016; step(0.016); } }   // arrive already flowing
  run();
})();
