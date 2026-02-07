(() => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const debugEl = document.getElementById("matter-debug");

  if (!window.Matter) {
    if (debugEl) debugEl.textContent = "Matter: not loaded";
    console.error("Matter.js not loaded");
    return;
  }

  const canvas = document.getElementById("matter-canvas");
  if (!canvas) {
    if (debugEl) debugEl.textContent = "Matter: no canvas";
    console.error("No canvas element found");
    return;
  }

  const {
    Engine, Render, Runner, Bodies, Composite, Body, Events, Common
  } = Matter;

  const engine = Engine.create();
  engine.gravity.y = 1.05;

  const render = Render.create({
    canvas,
    engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "transparent"
    }
  });

  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // Pixel ratio sizing (prevents “nothing shows” on some setups)
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    render.options.pixelRatio = dpr;

    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;

    render.canvas.width = Math.floor(window.innerWidth * dpr);
    render.canvas.height = Math.floor(window.innerHeight * dpr);
    render.canvas.style.width = window.innerWidth + "px";
    render.canvas.style.height = window.innerHeight + "px";

    // Matter render uses context scale internally; reset transform:
    render.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // World bounds
  let bounds = [];
  function rebuildBounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const b of bounds) Composite.remove(engine.world, b);

    const t = 90;
    const floor = Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, { isStatic: true });
    const ceil  = Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, { isStatic: true });
    const left  = Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, { isStatic: true });
    const right = Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, { isStatic: true });

    bounds = [floor, ceil, left, right];
    Composite.add(engine.world, bounds);
  }

  resizeCanvas();
  rebuildBounds();

  // Letters
  const LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";

  function spawnLetter() {
    const w = window.innerWidth;
    const ch = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const fontSize = Common.random(26, 62);
    const box = fontSize * Common.random(0.9, 1.2);

    const body = Bodies.rectangle(
      Common.random(40, w - 40),
      -80,
      box,
      box,
      {
        restitution: Common.random(0.5, 0.85),
        friction: 0.2,
        frictionAir: 0.02,
        density: 0.0028,
        chamfer: { radius: 10 },
        render: { fillStyle: "rgba(0,0,0,0)", strokeStyle: "rgba(0,0,0,0)" }
      }
    );

    body.plugin = {
      letter: ch,
      fontSize,
      ink: "rgba(31,29,23,.28)"
    };

    Body.setVelocity(body, { x: Common.random(-2.2, 2.2), y: Common.random(0.2, 1.2) });
    Body.setAngularVelocity(body, Common.random(-0.08, 0.08));

    Composite.add(engine.world, body);
  }

  const MAX = 80;
  const TICK_MS = 380;

  setInterval(() => {
    const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic && b.plugin?.letter);
    if (bodies.length < MAX) spawnLetter();

    const h = window.innerHeight;
    for (const b of bodies) {
      if (b.position.y > h + 500) Composite.remove(engine.world, b);
    }
  }, TICK_MS);

  // Draw letters (afterRender)
  Events.on(render, "afterRender", () => {
    const ctx = render.context;
    const bodies = Composite.allBodies(engine.world);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const b of bodies) {
      if (!b.plugin?.letter) continue;

      const { letter, fontSize, ink } = b.plugin;

      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      ctx.fillStyle = ink;
      ctx.font = `700 ${fontSize}px Heebo, system-ui, sans-serif`;
      ctx.shadowColor = "rgba(31,29,23,.08)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;

      ctx.fillText(letter, 0, 2);

      ctx.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0);
    }

    ctx.restore();
  });

  // Debug: show live body count and FPS-ish
  let last = performance.now();
  let frames = 0;
  Events.on(render, "afterRender", () => {
    frames++;
    const now = performance.now();
    if (now - last > 800) {
      const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic && b.plugin?.letter).length;
      const fps = Math.round((frames * 1000) / (now - last));
      if (debugEl) debugEl.textContent = `Matter: running · bodies ${bodies} · ~${fps} fps`;
      frames = 0;
      last = now;
    }
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    rebuildBounds();
  });

  if (debugEl) debugEl.textContent = "Matter: starting…";
})();
