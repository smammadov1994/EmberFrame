// Scroll and pointer motion. Everything here is progressive: without this file,
// or with reduced motion, the page is fully visible and static.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Reading progress line and header state
  var bar = document.createElement('div');
  bar.className = 'progress';
  document.body.appendChild(bar);
  var reel = document.getElementById('reel');
  var foot = document.querySelector('.bf-stage');
  var queued = false;
  function frame() {
    queued = false;
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    root.classList.toggle('scrolled', window.scrollY > 8);
    if (foot && !reduce) {
      // 0 while the footer art is only peeking in, 1 at the very end of the page.
      // The last stretch of scroll is what lifts the wordmark out of the objects.
      var fr = foot.getBoundingClientRect();
      var seen = (window.innerHeight - fr.top) / Math.max(1, Math.min(fr.height, window.innerHeight));
      var p = Math.max(0, Math.min(1, (seen - 0.45) / 0.55));
      p = p * p * (3 - 2 * p);
      foot.parentNode.style.setProperty('--fp', p.toFixed(3));
    }
    if (reel && !reduce) {
      // the fanned reel straightens as it rises through the viewport
      var r = reel.getBoundingClientRect();
      var p = (window.innerHeight * 0.85 - r.top) / (window.innerHeight * 0.6);
      reel.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
    }
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  // Pointer spotlight on cards
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest ? e.target.closest('.cells > *, .plan') : null;
    if (!t) return;
    var r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  if (reduce || !('IntersectionObserver' in window)) return;
  root.classList.add('motion');

  // Headline: words rise one after another
  var k = 0;
  function split(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var inner = document.createElement('span'); inner.textContent = part;
          inner.style.setProperty('--k', k++);
          w.appendChild(inner); frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) split(n);
    });
  }
  $$('.h1').forEach(function (h) { h.setAttribute('aria-label', h.textContent); split(h); });

  // Reveal on scroll, staggered among siblings
  var sel = '.hero-copy > :not(.h1), .reel-note, .head > *, .head-row > .fine, .head-row > .sample, .split > .stack > *, ' +
    '.cells > *, .tiles > .tile, .plan, .panel, .stat, .joined, .group > .tag, .group > .fine, section .cta-row, ' +
    '.filters, .banner, .note, .prose > p, .shop-row, .final h2';
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  var counts = new Map();
  $$(sel).forEach(function (n) {
    if (n.classList.contains('rv')) return;
    var i = counts.get(n.parentNode) || 0;
    counts.set(n.parentNode, i + 1);
    n.style.setProperty('--rd', Math.min(i, 8) * 70 + 'ms');
    n.classList.add('rv');
    io.observe(n);
  });
  // Safety net: never leave content hidden if observers stall
  setTimeout(function () {
    // if the animation clock is not advancing (throttled embed), drop entrance animations
    var card = document.querySelector('.reel-card'), word = document.querySelector('.w > span');
    var stuck = (card && Number(getComputedStyle(card).opacity) < 0.05) || (word && getComputedStyle(word).transform !== 'none');
    if (stuck) root.classList.add('still');
    $$('.rv:not(.in)').forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) n.classList.add('in');
    });
  }, 2600);
})();
