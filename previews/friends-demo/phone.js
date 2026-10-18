// Loaded by the web export (export_presets.cfg head_include) before the engine starts.
// 1. Caps the render resolution: iPhones report a pixel ratio of 3, which with 3D
//    anti-aliasing can exhaust Safari's graphics memory. ?dpr=1|2|3 overrides the cap.
// 2. Stops the browser's own page pinch-zoom and double-tap zoom (they fight the game's
//    pinch and can crop the game), and snaps the page back if it zooms anyway.
// 3. Only on the home network (or with ?debug): sends console output, errors, WebGL
//    context loss and a heartbeat (frames per second) to the server's /log, so a phone can
//    be debugged from the Mac. Published builds (itch.io) send nothing.
(function () {
  var q = new URLSearchParams(location.search);
  var real = window.devicePixelRatio || 1;
  var cap = Number(q.get("dpr") || 2);
  var dpr = Math.min(real, cap);
  try { Object.defineProperty(window, "devicePixelRatio", { get: function () { return dpr; } }); } catch (e) {}
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (k) {
    document.addEventListener(k, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener("touchmove", function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement("meta"); vp.name = "viewport"; document.head.appendChild(vp); }
  var VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  vp.content = VIEWPORT;
  // iPhone browsers ignore user-scalable=no (accessibility), so a stray pinch or double tap
  // can zoom the whole page and crop the game on both sides (seen in Brave, 2026-10-10).
  // Pin the page, stop page zoom gestures everywhere, and undo any zoom that gets through.
  var css = document.createElement("style");
  css.textContent = "html,body{position:fixed;inset:0;margin:0;overflow:hidden;touch-action:none;" +
    "overscroll-behavior:none;-webkit-text-size-adjust:100%;-webkit-user-select:none;user-select:none;" +
    "-webkit-touch-callout:none}canvas{touch-action:none}";
  document.head.appendChild(css);
  document.addEventListener("dblclick", function (e) { e.preventDefault(); }, { passive: false });
  var lastTouchEnd = 0;
  document.addEventListener("touchend", function (e) {
    var now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();  // a quick second tap would zoom the page
    lastTouchEnd = now;
  }, { passive: false });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      if (window.visualViewport.scale > 1.01) {
        // Re-applying the viewport makes WebKit snap back to scale 1.
        vp.content = VIEWPORT.replace("maximum-scale=1", "maximum-scale=1.0001");
        setTimeout(function () { vp.content = VIEWPORT; }, 50);
      }
    });
  }
  // Memory for ?debug and the home-network log: the engine's WebAssembly memory (it only
  // grows) and, in Chromium, the JS heap. Each heartbeat is kept in localStorage; a page
  // that was killed (iOS reloads a tab that used too much memory) never gets its pagehide,
  // so the next load can say what memory looked like just before it died.
  var wasmMem = null;
  ["instantiate", "instantiateStreaming"].forEach(function (k) {
    var orig = WebAssembly[k];
    if (!orig) return;
    WebAssembly[k] = function () {
      return orig.apply(WebAssembly, arguments).then(function (r) {
        var ex = (r.instance || r).exports || {};
        for (var n in ex) if (ex[n] instanceof WebAssembly.Memory) wasmMem = ex[n];
        return r;
      });
    };
  });
  function memText() {
    var s = "wasm " + (wasmMem ? Math.round(wasmMem.buffer.byteLength / 1048576) : "?") + " MB";
    if (performance.memory) s += "  js " + Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB";
    return s;
  }
  var KEY = "meridian-last-beat";
  var died = null;
  try { died = localStorage.getItem(KEY); localStorage.removeItem(KEY); } catch (e) {}
  window.addEventListener("pagehide", function () { try { localStorage.removeItem(KEY); } catch (e) {} clearInterval(beat); });
  var beat = setInterval(function () {
    try { localStorage.setItem(KEY, new Date().toISOString() + "  " + memText()); } catch (e) {}
  }, 2000);
  // ?debug: a small overlay with the sizes the browser reports, for layout bugs on phones.
  if (q.has("debug")) {
    var box = document.createElement("div");
    box.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:9999;background:rgba(0,0,0,.75);color:#0f0;" +
      "font:11px/1.3 monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre";
    document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(box); });
    setInterval(function () {
      var c = document.querySelector("canvas");
      var r = c ? c.getBoundingClientRect() : null;
      var vv = window.visualViewport;
      box.textContent = "inner " + innerWidth + "x" + innerHeight + "  screen " + screen.width + "x" + screen.height +
        "\nvv " + (vv ? Math.round(vv.width) + "x" + Math.round(vv.height) + " scale " + vv.scale.toFixed(2) : "none") +
        "  dpr real " + real + " used " + dpr +
        "\ncanvas " + (c ? c.width + "x" + c.height + " css " + Math.round(r.width) + "x" + Math.round(r.height) + " at " + Math.round(r.left) + "," + Math.round(r.top) : "none") +
        "\nstandalone " + (navigator.standalone === true || matchMedia("(display-mode: standalone)").matches) +
        "\n" + (window.godotFit || "godot: not reported yet") +
        "\n" + memText() + (died ? "\nlast page died: " + died : "");
    }, 500);
  }
  var t0 = Date.now();
  var lan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|localhost$|127\.)/.test(location.hostname);
  if (!lan && !q.has("debug")) return;
  function send(kind, msg) {
    var body = JSON.stringify({ t: ((Date.now() - t0) / 1000).toFixed(1), kind: kind, msg: String(msg).slice(0, 2000) });
    try { navigator.sendBeacon("/log", body); } catch (e) {}
  }
  ["log", "warn", "error"].forEach(function (k) {
    var orig = console[k].bind(console);
    console[k] = function () { orig.apply(null, arguments); send(k, Array.prototype.join.call(arguments, " ")); };
  });
  window.addEventListener("error", function (e) { send("onerror", e.message + " @" + e.filename + ":" + e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { send("rejection", e.reason); });
  document.addEventListener("visibilitychange", function () { send("visibility", document.visibilityState); });
  var frames = 0;
  (function tick() { frames++; requestAnimationFrame(tick); })();
  setInterval(function () { send("heartbeat", Math.round(frames / 5) + " fps, " + memText()); frames = 0; }, 5000);
  if (died) send("died", "the last page ended without pagehide (killed?); its last beat: " + died);
  var hooked = setInterval(function () {
    var c = document.querySelector("canvas");
    if (!c) return;
    clearInterval(hooked);
    c.addEventListener("webglcontextlost", function () { send("webgl", "CONTEXT LOST"); }, false);
    c.addEventListener("webglcontextrestored", function () { send("webgl", "context restored"); }, false);
  }, 200);
  send("start", "real dpr " + real + ", using " + dpr + ", screen " + screen.width + "x" + screen.height + ", " + navigator.userAgent);
})();
