// Animated neural-network particle background
(() => {
  const c = document.getElementById('bg');
  const x = c.getContext('2d');
  let w, h, P = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    w = c.width = innerWidth;
    h = c.height = innerHeight;
    P = Array.from({ length: Math.min(90, Math.floor((w * h) / 16000)) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35
    }));
  }
  addEventListener('resize', resize);
  resize();

  function frame() {
    x.clearRect(0, 0, w, h);
    for (const p of P) {
      if (!reduce) { p.x += p.vx; p.y += p.vy; }
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      x.fillStyle = 'rgba(0,229,255,.7)';
      x.beginPath();
      x.arc(p.x, p.y, 1.4, 0, 6.283);
      x.fill();
    }
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = dx * dx + dy * dy;
        if (d < 17000) {
          x.strokeStyle = `rgba(139,92,246,${0.22 * (1 - d / 17000)})`;
          x.beginPath();
          x.moveTo(P[i].x, P[i].y);
          x.lineTo(P[j].x, P[j].y);
          x.stroke();
        }
      }
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
})();
