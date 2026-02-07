(() => {
  // Year stamp (because humans like calendars)
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const {
    Engine,
    Render,
    Runner,
    Bodies,
    Composite,
    Body,
    Events,
    Common,
    Mouse,
    MouseConstraint,
    Query,
    Vector
  } = Matter;

  const container = document.getElementById("bg-layer");
  if (!container) return;

  // Physics engine
  const engine = Engine.create();
  engine.gravity.y = 1.05;

  // Renderer
  const render = Render.create({
    element: container,
    engine,
    options: {
      width: window.innerWidth,
      height: window.innerHeight,
      wireframes: false,
      background: "transparent",
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
    }
  });

  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // World bounds
  let bounds = [];
  function rebuildBounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // remove old bounds
    for (const b of bounds) Composite.remove(engine.world, b);

    const thickness = 80;
    const floor = Bodies.rectangle(w / 2, h + thickness / 2, w + thickness * 2, thickness, { isStatic: true });
    const ceil  = Bodies.rectangle(w / 2, -thickness / 2, w + thickness * 2, thickness, { isStatic: true });
    const left  = Bodies.rectangle(-thickness / 2, h / 2, thickness, h + thickness * 2, { isStatic: true });
    const right = Bodies.rectangle(w + thickness / 2, h / 2, thickness, h + thickness * 2, { isStatic: true });

    bounds = [floor, ceil, left, right];
    Composite.add(engine.world, bounds);
  }
  rebuildBounds();

  // Content collision blockers (so letters don't cover your text too much)
  // We add invisible static bodies where the cards are located.
  let blockers = [];
  function rebuildBlockers() {
    for (const b of blockers) Composite.remove(engine.world, b);
    blockers = [];

    const cards = document.querySelectorAll(".card");
    const rects = Array.from(cards).map(el => el.getBoundingClientRect());

    // Convert DOM rects to physics bodies (static)
    for (const r of rects) {
      // Inflate a bit to keep letters away from text
      const pad = 10;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const body = Bodies.rectangle(cx, cy, r.width + pad * 2, r.height + pad * 2, {
        isStatic: true,
        render: { visible: false }
      });
      blockers.push(body);
    }

    Composite.add(engine.world, blockers);
  }
  rebuildBlockers();

  // Hebrew letters pool + a few Latin for variety
  const LETTERS = "אבגדהוזחטיכלמנסעפצקרשתABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  function spawnLetter() {
    const w = window.innerWidth;

    const ch = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const size = Common.random(28, 64);     // visual font size
    const box = size * Common.random(0.85, 1.15); // body size
    const x = Common.random(40, w - 40);
    const y = -80;

    const body = Bodies.rectangle(x, y, box, box, {
      restitution: Common.random(0.45, 0.85),
      friction: 0.25,
      frictionAir: 0.015,
      density: 0.0025,
      chamfer: { radius: 10 },
      render: {
        fillStyle: "rgba(0,0,0,0)",       // invisible box
        strokeStyle: "rgba(0,0,0,0)"      // no outline
      }
    });

    body.plugin = {
      letter: ch,
      fontSize: size,
      // subtle ink colors
      ink: Math.random() < 0.85 ? "rgba(31,29,23,.38)" : "rgba(31,29,23,.22)"
    };

    // Give it a little sideways drift and spin
    Body.setVelocity(body, { x: Common.random(-2.4, 2.4), y: Common.random(0.2, 1.2) });
    Body.setAngularVelocity(body, Common.random(-0.08, 0.08));

    Composite.add(engine.world, body);
  }

  // Spawn loop
  const MAX_BODIES = 90;
  const SPAWN_MS = 380;

  setInterval(() => {
    // keep body count in check
    const bodies = Composite.allBodies(engine.world)
      .filter(b => !b.isStatic && b.plugin && b.plugin.letter);

    if (bodies.length < MAX_BODIES) spawnLetter();

    // delete far-away bodies (just in case)
    const h = window.innerHeight;
    for (const b of bodies) {
      if (b.position.y > h + 400) Composite.remove(engine.world, b);
    }
  }, SPAWN_MS);

  // Draw letters on top of the physics bodies after render
  Events.on(render, "afterRender", () => {
    const ctx = render.context;
    const bodies = Composite.allBodies(engine.world);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const b of bodies) {
      if (!b.plugin || !b.plugin.letter) continue;

      const { letter, fontSize, ink } = b.plugin;

      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      // Letter style
      ctx.fillStyle = ink;
      ctx.font = `700 ${fontSize}px Heebo, system-ui, sans-serif`;

      // Slight shadow for depth
      ctx.shadowColor = "rgba(31,29,23,.10)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6;

      ctx.fillText(letter, 0, 2);

      // reset transform for next body
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    ctx.restore();
  });

  // Optional: mouse interaction (drag letters around)
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.12,
      render: { visible: false }
    }
  });
  Composite.add(engine.world, mouseConstraint);
  render.mouse = mouse;

  // Responsive
  function onResize() {
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;
    render.canvas.width = window.innerWidth * render.options.pixelRatio;
    render.canvas.height = window.innerHeight * render.options.pixelRatio;
    render.canvas.style.width = window.innerWidth + "px";
    render.canvas.style.height = window.innerHeight + "px";

    rebuildBounds();
    // Rebuild blockers after layout settles
    setTimeout(rebuildBlockers, 50);
  }

  window.addEventListener("resize", onResize);

  // Rebuild blockers if fonts load / content reflows
  window.addEventListener("load", () => setTimeout(rebuildBlockers, 100));
})();
