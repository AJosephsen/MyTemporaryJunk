// Player page: runs a project with the TurboWarp runtime (scaffolding), reloads on rebuild,
// and exposes window.workbench for headless tests.
/* global Scaffolding */
(() => {
  const params = new URLSearchParams(location.search);
  const testMode = params.has("test");
  const $ = id => document.getElementById(id);

  const scaffolding = new Scaffolding.Scaffolding();
  scaffolding.width = 480;
  scaffolding.height = 360;
  scaffolding.resizeMode = "preserve-ratio";
  scaffolding.editableLists = false;
  scaffolding.shouldConnectPeripherals = false;
  scaffolding.setup();
  scaffolding.appendTo($("stage"));
  const vm = scaffolding.vm;

  // Count frames, so tests can step exactly one frame at a time.
  let frames = 0;
  const step = vm.runtime._step.bind(vm.runtime);
  vm.runtime._step = () => { frames++; step(); };
  const errors = [];
  window.addEventListener("error", e => errors.push(String(e.message)));

  let current = null;
  const findVar = name => {
    const targets = [vm.runtime.getTargetForStage(), ...vm.runtime.targets.filter(t => !t.isStage && t.isOriginal)];
    for (const t of targets) for (const v of Object.values(t.variables)) if (v.name === name && v.type !== "broadcast_msg") return v;
    return null;
  };

  const workbench = {
    async load(path) {
      const res = await fetch("/project/" + path);
      if (!res.ok) throw new Error(`Cannot load ${path}: HTTP ${res.status}`);
      await scaffolding.loadProject(await res.arrayBuffer());
      current = path;
      frames = 0;
    },
    vm,
    current: () => current,
    greenFlag: () => scaffolding.greenFlag(),
    stop: () => scaffolding.stopAll(),
    frames: () => frames,
    errors: () => errors.slice(),
    // All variables and lists of the Stage and every sprite (Stage wins on name clashes).
    vars() {
      const out = {};
      const targets = [...vm.runtime.targets.filter(t => !t.isStage && t.isOriginal), vm.runtime.getTargetForStage()];
      for (const t of targets) for (const v of Object.values(t.variables)) {
        if (v.type === "") out[v.name] = v.value;
        else if (v.type === "list") out[v.name] = v.value.slice();
      }
      return out;
    },
    set(name, value) {
      const v = findVar(name);
      if (!v) throw new Error(`No variable called ${name}`);
      v.value = value;
    },
    key(key, isDown) { vm.postIOData("keyboard", { key, isDown }); },
    place(name, x, y, direction) {
      const t = vm.runtime.getSpriteTargetByName(name);
      if (!t) throw new Error(`No sprite called ${name}`);
      t.setXY(x, y);
      if (direction !== undefined) t.setDirection(direction);
    },
    sprite(name) {
      const t = vm.runtime.getSpriteTargetByName(name);
      if (!t) throw new Error(`No sprite called ${name}`);
      const bubble = t.getCustomState("Scratch.looks");
      return { x: t.x, y: t.y, direction: t.direction, costume: t.getCostumes()[t.currentCostume].name,
        visible: t.visible, bubble: bubble && bubble.text ? String(bubble.text) : "" };
    },
  };
  window.workbench = workbench;

  if (testMode) {
    // Manual stepping with a virtual clock: the engine's own timer is stopped, and each step advances
    // time by exactly one frame (1/30 s) and runs one frame. Waits like "say for 2 seconds" therefore
    // take exactly 60 steps, however fast the machine is.
    const KEYS = { "up arrow": "ArrowUp", "down arrow": "ArrowDown", "left arrow": "ArrowLeft",
      "right arrow": "ArrowRight", space: " ", enter: "Enter" };
    // Timers (setTimeout) also run on the virtual clock: blocks like "say for 2 seconds" use them.
    let virtual = null;
    const timers = new Map();
    let nextTimer = 1;
    const startVirtualClock = () => {
      if (virtual) return;
      const p0 = performance.now(), d0 = Date.now();
      const realClear = window.clearTimeout.bind(window);
      // Within a frame, each reading of the clock moves it on by a tiny fixed amount. Scratch keeps
      // re-running loops within a frame until most of the frame's time has passed (when nothing needs
      // redrawing), so a clock that stood still would let such loops run forever.
      virtual = { elapsed: 0, reads: 0 };
      const now = () => virtual.elapsed + Math.min(++virtual.reads * 0.05, 30);
      performance.now = () => p0 + now();
      Date.now = () => d0 + now();
      window.setTimeout = (fn, ms, ...args) => {
        const id = 1e9 + nextTimer++;
        timers.set(id, { at: virtual.elapsed + (Number(ms) || 0), fn, args });
        return id;
      };
      window.clearTimeout = id => { if (!timers.delete(id)) realClear(id); };
    };
    // Lets pending promise callbacks run, without waiting for real time to pass.
    const channel = new MessageChannel();
    const settle = () => new Promise(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
    const runDueTimers = () => {
      const due = [...timers].filter(([, t]) => t.at <= virtual.elapsed).sort((a, b) => a[1].at - b[1].at);
      for (const [id, t] of due) { timers.delete(id); t.fn(...t.args); }
    };

    Object.assign(workbench, {
      async greenFlag() {
        startVirtualClock();
        scaffolding.greenFlag();
        vm.runtime.frameLoop.stop();
        await settle();
      },
      async step(n) {
        const stepMs = 1000 / vm.runtime.frameLoop.framerate;
        for (let i = 0; i < n; i++) {
          virtual.elapsed += stepMs;
          virtual.reads = 0;
          runDueTimers();
          await settle();
          vm.runtime._step();
        }
        await settle();
      },
      key(name, isDown) { vm.postIOData("keyboard", { key: KEYS[name] ?? name, isDown }); },
      // Moves the mouse to a Stage position (x: -240..240, y: -180..180).
      mouse(x, y, isDown = false) {
        vm.postIOData("mouse", { x: x + 240, y: 180 - y, canvasWidth: 480, canvasHeight: 360, isDown });
      },
      // Steps frame by frame until check(vars, workbench, memo) is true; check runs here, in the page.
      async until(source, max) {
        const check = new Function("v", "w", "memo", `return (${source})(v, w, memo)`);
        const memo = {};
        for (let i = 0; i <= max; i++) {
          const v = workbench.vars();
          if (check(v, workbench, memo)) return { ok: true, vars: v, frames: i };
          await workbench.step(1);
        }
        return { ok: false, vars: workbench.vars(), frames: max };
      },
    });
    document.body.dataset.ready = "1";
    return;
  }

  // ---------------------------------------------------------------- interactive player
  const status = (text, cls = "") => { $("status").textContent = text; $("status").className = cls; };
  const select = $("project");

  async function open(path, start) {
    status(`Loading ${path}…`, "busy");
    try {
      await workbench.load(path);
      if (start) workbench.greenFlag();
      status(`${path}${start ? " · running" : " · loaded"}`);
    } catch (e) { status(String(e.message || e), "error"); }
  }

  async function refreshList(selected) {
    const list = await (await fetch("/api/projects")).json();
    select.innerHTML = "";
    for (const p of list) select.add(new Option(p, p, false, p === selected));
    return list;
  }

  select.addEventListener("change", () => {
    history.replaceState(null, "", "?project=" + encodeURIComponent(select.value));
    open(select.value, false);
  });
  $("go").addEventListener("click", () => { workbench.greenFlag(); status(`${current} · running`); });
  $("stop").addEventListener("click", () => { workbench.stop(); status(`${current} · stopped`); });

  // Live variables panel.
  setInterval(() => {
    const vars = workbench.vars();
    $("vars").innerHTML = Object.keys(vars).sort((a, b) => a.localeCompare(b)).map(k => {
      const v = Array.isArray(vars[k]) ? `[${vars[k].join(", ")}]` : String(vars[k]);
      return `<tr><td>${k}</td><td>${v.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td></tr>`;
    }).join("");
  }, 250);

  // Live reload after rebuilds.
  const events = new EventSource("/events");
  events.onmessage = async ev => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "building") status("Rebuilding…", "busy");
    if (msg.type !== "rebuilt") return;
    $("log").textContent = msg.output;
    $("log-box").hidden = msg.ok;
    if (!msg.ok) { status("Build failed: see build output", "error"); return; }
    await refreshList(current);
    if (msg.changed.includes(current)) await open(current, $("autostart").checked);
    else status(`${current} · rebuilt, no change to this project`);
  };

  (async () => {
    const list = await refreshList(params.get("project"));
    const first = params.get("project") && list.includes(params.get("project")) ? params.get("project") : list[0];
    if (!first) { status("No .sb3 projects found", "error"); return; }
    select.value = first;
    await open(first, false);
  })();
})();
