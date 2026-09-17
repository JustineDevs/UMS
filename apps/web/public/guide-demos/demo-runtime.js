/**
 * Shared guide demo runtime: admin-shaped sidebar (matches apps/web/src/config/admin-nav.ts),
 * requestAnimationFrame timeline, fake cursor, Web Speech + HTML5 tick audio.
 * Presentation and manual modes, speed, pause, skip, progress, mute, reduced motion.
 *
 * DEMO_BY_KEY must stay aligned with apps/web/src/lib/guide-demos-catalog.ts
 */
(function (global) {
  "use strict";

  var BASE = "https://admin.example.com";

  var DEMO_BY_KEY = {
    dashboard: "demo-dashboard.html",
    catalog: "demo-products.html",
    inventory: "demo-inventory.html",
    orders: "demo-orders.html",
    pos: "demo-pos.html",
    cms: "demo-cms.html",
    analytics: "demo-analytics.html",
    payments: "demo-payments.html",
    crm: "demo-crm.html",
    employees: "demo-employees.html",
    loyalty: "demo-loyalty.html",
    campaigns: "demo-mkt-campaigns.html",
    devices: "demo-hardware.html",
    channels: "demo-channels.html",
    "chat-orders": "demo-chat-orders.html",
    storefront: "demo-storefront.html",
    reviews: "demo-product-reviews.html",
    "offline-queue": "demo-pos-offline.html",
  };

  var NAV_GROUPS = [
    {
      label: "Commerce",
      items: [
        { key: "dashboard", label: "Dashboard", href: "/admin" },
        { key: "catalog", label: "Products", href: "/admin/catalog" },
        { key: "inventory", label: "Inventory", href: "/admin/inventory" },
        { key: "orders", label: "Orders", href: "/admin/orders" },
        { key: "pos", label: "POS", href: "/admin/pos" },
        { key: "offline-queue", label: "Offline queue", href: "/admin/offline-queue" },
        { key: "crm", label: "CRM", href: "/admin/crm" },
      ],
    },
    {
      label: "Operations",
      items: [
        { key: "employees", label: "Employees", href: "/admin/employees" },
        { key: "devices", label: "Devices", href: "/admin/devices" },
        { key: "channels", label: "Channels", href: "/admin/channels" },
        { key: "chat-orders", label: "Chat orders", href: "/admin/chat-orders" },
      ],
    },
    {
      label: "Marketing",
      items: [
        { key: "analytics", label: "Analytics", href: "/admin/analytics" },
        { key: "loyalty", label: "Loyalty", href: "/admin/loyalty" },
        { key: "campaigns", label: "Campaigns", href: "/admin/campaigns" },
        { key: "storefront", label: "Storefront home", href: "/admin/settings/storefront" },
        { key: "cms", label: "Content", href: "/admin/cms" },
        { key: "reviews", label: "Reviews", href: "/admin/reviews" },
      ],
    },
    {
      label: "Settings",
      items: [
        { key: "docs", label: "Admin guide", href: "/admin/docs" },
        { key: "preferences", label: "Workspace UI", href: "/admin/settings/preferences" },
        { key: "payments", label: "Payments", href: "/admin/settings/payments" },
        { key: "receipts", label: "Receipts", href: "/admin/receipts" },
        { key: "workflow", label: "Workflow", href: "/admin/workflow" },
        { key: "audit", label: "Audit log", href: "/admin/audit" },
      ],
    },
  ];

  var CMS_SUB_GROUPS = [
    {
      label: "Content (website)",
      items: [
        { key: "cms-pages", label: "Pages", href: "/admin/cms/pages" },
        { key: "cms-navigation", label: "Navigation and footer", href: "/admin/cms/navigation" },
        { key: "cms-announcement", label: "Announcement bar", href: "/admin/cms/announcement" },
        { key: "cms-categories", label: "Category pages", href: "/admin/cms/categories" },
        { key: "cms-media", label: "Media library", href: "/admin/cms/media" },
        { key: "cms-blog", label: "Blog", href: "/admin/cms/blog" },
        { key: "cms-forms", label: "Form submissions", href: "/admin/cms/forms" },
        { key: "cms-redirects", label: "Redirects", href: "/admin/cms/redirects" },
        { key: "cms-experiments", label: "Page tests", href: "/admin/cms/experiments" },
        { key: "cms-commerce", label: "Product lookup", href: "/admin/cms/commerce" },
      ],
    },
  ];

  var KEY_TO_HREF = {};

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildKeyMap() {
    KEY_TO_HREF = {};
    NAV_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        KEY_TO_HREF[it.key] = it.href;
      });
    });
    CMS_SUB_GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        KEY_TO_HREF[it.key] = it.href;
      });
    });
  }

  buildKeyMap();

  function getUrlForKey(key) {
    var h = KEY_TO_HREF[key];
    return h ? BASE + h : null;
  }

  function renderCmsBlock() {
    var html = '<div class="nav-cms-block">';
    CMS_SUB_GROUPS.forEach(function (g) {
      html += '<div class="nav-cms-group-label">' + escapeHtml(g.label) + "</div>";
      g.items.forEach(function (it) {
        html +=
          '<div class="nav-cms-item" data-nav-key="' +
          escapeHtml(it.key) +
          '">' +
          escapeHtml(it.label) +
          "</div>";
      });
    });
    html += "</div>";
    return html;
  }

  function renderSidebar(container, currentKey) {
    var el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;
    var html = "";
    NAV_GROUPS.forEach(function (group) {
      html += '<div class="nav-group-label">' + escapeHtml(group.label) + "</div>";
      group.items.forEach(function (item) {
        var isActive = item.key === currentKey;
        var demo = DEMO_BY_KEY[item.key];
        var cls =
          "nav-item" +
          (isActive ? " active" : "") +
          (demo ? " nav-item-demo" : " nav-item-static");
        if (demo) {
          html +=
            '<a class="' +
            cls +
            '" href="' +
            escapeHtml(demo) +
            '" data-nav-key="' +
            escapeHtml(item.key) +
            '">' +
            escapeHtml(item.label) +
            "</a>";
        } else {
          html +=
            '<div class="' +
            cls +
            '" data-nav-key="' +
            escapeHtml(item.key) +
            '" role="presentation">' +
            escapeHtml(item.label) +
            "</div>";
        }
        if (item.key === "cms") {
          html += renderCmsBlock();
        }
      });
    });
    el.innerHTML = html;
  }

  function qs(sel, root) {
    if (!sel) return null;
    return (root || document).querySelector(sel);
  }

  function parseSpeed(v) {
    var n = parseFloat(v, 10);
    if (!isFinite(n) || n < 0.5) return 1;
    if (n > 3) return 3;
    return n;
  }

  function attachPlayer(opts) {
    var timeline = opts.timeline;
    var totalMs = opts.totalMs;
    var stage = qs(opts.stage);
    var cursor = qs(opts.cursor);
    var ripple = qs(opts.ripple);
    var caption = qs(opts.caption);
    var urlBar = qs(opts.urlBar);
    var btnPlay = qs(opts.btnPlay);
    var btnReset = qs(opts.btnReset);
    var btnPause = qs(opts.btnPause);
    var btnSkip = qs(opts.btnSkip);
    var btnStep = qs(opts.btnStep);
    var selSpeed = qs(opts.selSpeed);
    var selMode = qs(opts.selMode);
    var chkMute = qs(opts.chkMute);
    var progressBar = qs(opts.progressBar);
    var progressWrap = qs(opts.progressWrap);
    var narrationEl = qs(opts.narrationAudio);
    var uiTick = opts.uiTick ? qs(opts.uiTick) : qs("#ui-tick");
    var wrap = opts.wrap ? qs(opts.wrap) : qs("#wrap");
    var sidebar = opts.sidebar ? qs(opts.sidebar) : stage ? stage.querySelector(".sidebar") : null;
    var currentKey = opts.currentKey || "dashboard";
    var defaultUrl = opts.defaultUrl || getUrlForKey(currentKey) || BASE + "/admin";

    var mute = false;
    if (chkMute && chkMute.checked) mute = true;

    var speed = opts.speed != null ? parseSpeed(opts.speed) : 1.45;
    if (selSpeed && selSpeed.value) speed = parseSpeed(selSpeed.value);

    var reduceMotion =
      (typeof opts.reduceMotion === "boolean" && opts.reduceMotion) ||
      (typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function applyReducedMotionClass() {
      if (!wrap) return;
      if (reduceMotion) wrap.classList.add("guide-demo-reduced-motion");
      else wrap.classList.remove("guide-demo-reduced-motion");
    }

    applyReducedMotionClass();
    try {
      if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        var onMq = function (e) {
          reduceMotion = e.matches;
          applyReducedMotionClass();
        };
        if (mq.addEventListener) mq.addEventListener("change", onMq);
        else if (mq.addListener) mq.addListener(onMq);
      }
    } catch (e0) {}

    var setScene =
      opts.setScene ||
      function (idx) {
        var a = document.getElementById("scene-0");
        var b = document.getElementById("scene-1");
        if (a) a.classList.toggle("on", idx === 0);
        if (b) b.classList.toggle("on", idx === 1);
        if (opts.urlForScene) {
          var u = opts.urlForScene(idx);
          if (u && urlBar) urlBar.textContent = u;
        }
      };

    var customReset = opts.reset || function () {};

    function navEls() {
      return sidebar ? [].slice.call(sidebar.querySelectorAll(".nav-item")) : [];
    }

    function setNavActive(key) {
      navEls().forEach(function (el) {
        el.classList.remove("active");
        el.classList.remove("flash");
      });
      navEls().forEach(function (el) {
        if (el.getAttribute("data-nav-key") === key) el.classList.add("active");
      });
    }

    function flashNav(key) {
      navEls().forEach(function (el) {
        el.classList.remove("flash");
        if (el.getAttribute("data-nav-key") === key) el.classList.add("flash");
      });
    }

    var audioCtx = null;
    function beepOsc() {
      if (mute) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        g.gain.value = 0.04;
        o.frequency.value = 620;
        o.start();
        o.stop(audioCtx.currentTime + 0.06);
      } catch (e) {}
    }

    function clickSound() {
      if (mute) return;
      if (uiTick && uiTick.play) {
        try {
          uiTick.currentTime = 0;
          uiTick.volume = 0.35;
          uiTick.play().catch(function () {
            beepOsc();
          });
          return;
        } catch (e) {}
      }
      beepOsc();
    }

    function speak(text) {
      if (mute || !text || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.rate = reduceMotion ? 1 : 1.05;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }

    function stopNarration() {
      if (narrationEl && narrationEl.pause) {
        try {
          narrationEl.pause();
          narrationEl.currentTime = 0;
        } catch (e) {}
      }
    }

    function playNarrationForEvent(ev) {
      if (!ev || !ev.narrSrc || !narrationEl) return;
      try {
        narrationEl.pause();
        narrationEl.src = ev.narrSrc;
        narrationEl.volume = mute ? 0 : 1;
        var p = narrationEl.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    var posKeys = [];
    for (var pi = 0; pi < timeline.length; pi++) {
      var pe = timeline[pi];
      if (pe.x != null && pe.y != null) posKeys.push({ t: pe.t, x: pe.x, y: pe.y });
    }

    function posAt(ms) {
      if (posKeys.length === 0) return { x: 0.5, y: 0.5 };
      if (reduceMotion) {
        var best = posKeys[0];
        for (var r = 0; r < posKeys.length; r++) {
          if (posKeys[r].t <= ms) best = posKeys[r];
          else break;
        }
        return { x: best.x, y: best.y };
      }
      if (ms <= posKeys[0].t) return { x: posKeys[0].x, y: posKeys[0].y };
      var last = posKeys[posKeys.length - 1];
      if (ms >= last.t) return { x: last.x, y: last.y };
      for (var j = 0; j < posKeys.length - 1; j++) {
        var a = posKeys[j];
        var b = posKeys[j + 1];
        if (ms >= a.t && ms <= b.t) {
          var span = b.t - a.t;
          var u = span <= 0 ? 1 : (ms - a.t) / span;
          return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
        }
      }
      return { x: last.x, y: last.y };
    }

    var raf = 0;
    var startMs = 0;
    var running = false;
    var paused = false;
    var pauseStarted = 0;
    var totalPaused = 0;
    var fired = new Set();
    var mode = selMode && selMode.value === "manual" ? "manual" : "presentation";
    var manualIdx = 0;

    function updateModeUi() {
      mode = selMode && selMode.value === "manual" ? "manual" : "presentation";
      if (btnStep) {
        btnStep.style.display = mode === "manual" ? "" : "none";
        btnStep.disabled = true;
      }
      if (btnPause) {
        btnPause.style.display = mode === "presentation" ? "" : "none";
        if (mode === "manual") btnPause.disabled = true;
      }
    }

    updateModeUi();

    function setProgress(pct) {
      if (!progressBar) return;
      var v = Math.max(0, Math.min(100, pct));
      progressBar.style.width = v + "%";
      if (progressWrap) {
        progressWrap.setAttribute("aria-valuenow", String(Math.round(v)));
      }
    }

    function getVirtualElapsed(now) {
      var wall = now - startMs - totalPaused;
      if (paused) wall = pauseStarted - startMs - totalPaused;
      return Math.max(0, wall * speed);
    }

    function doClick(ev, elapsed) {
      cursor.classList.add("click");
      clickSound();
      setTimeout(function () {
        cursor.classList.remove("click");
      }, 320);

      var p = posAt(elapsed);
      var rx = ev.x != null ? ev.x : p.x;
      var ry = ev.y != null ? ev.y : p.y;
      var rw = stage.clientWidth;
      var rh = stage.clientHeight;
      ripple.style.left = rw * rx + "px";
      ripple.style.top = rh * ry + "px";
      ripple.classList.remove("on");
      void ripple.offsetWidth;
      ripple.classList.add("on");

      if (opts.onClick) {
        opts.onClick(ev, {
          setScene: setScene,
          setNavActive: setNavActive,
          flashNav: flashNav,
          urlBar: urlBar,
        });
      }

      if (ev.navFlash && !ev.navKey) flashNav(ev.navFlash);

      if (ev.navKey) {
        var nk = ev.navKey;
        var delay = ev.navDelay != null ? ev.navDelay : reduceMotion ? 0 : 200;
        flashNav(nk);
        setTimeout(
          function () {
            setNavActive(nk);
            var u = getUrlForKey(nk);
            if (u && !ev.skipUrl && urlBar) urlBar.textContent = u;
          },
          reduceMotion ? 0 : delay,
        );
      }
    }

    function processEventAtIndex(k, useTimelineT) {
      var ev = timeline[k];
      if (!ev) return;
      var elapsed = useTimelineT ? ev.t : ev.t;
      if (ev.cap && caption) caption.textContent = ev.cap;
      if (ev.speak) speak(ev.speak);
      playNarrationForEvent(ev);
      if (ev.scene !== undefined) setScene(ev.scene);
      if (ev.click) doClick(ev, elapsed);
      else if (ev.navKey && !ev.click) {
        flashNav(ev.navKey);
        setNavActive(ev.navKey);
        var u = getUrlForKey(ev.navKey);
        if (u && urlBar && !ev.skipUrl) urlBar.textContent = u;
      }
    }

    function syncCursorForVirtual(elapsed) {
      if (!stage || !cursor) return;
      var rect = stage.getBoundingClientRect();
      var pos = posAt(elapsed);
      cursor.style.left = rect.width * pos.x + "px";
      cursor.style.top = rect.height * pos.y + "px";
    }

    function tick(now) {
      if (!running || mode !== "presentation") return;
      if (paused) {
        raf = requestAnimationFrame(tick);
        return;
      }

      var vElapsed = getVirtualElapsed(now);
      if (vElapsed >= totalMs) {
        stopPresentation(true);
        return;
      }

      for (var k = 0; k < timeline.length; k++) {
        var ev = timeline[k];
        if (vElapsed < ev.t) continue;
        if (fired.has(k)) continue;
        fired.add(k);
        if (ev.cap && caption) caption.textContent = ev.cap;
        if (ev.speak) speak(ev.speak);
        playNarrationForEvent(ev);
        if (ev.scene !== undefined) setScene(ev.scene);
        if (ev.click) doClick(ev, vElapsed);
      }

      syncCursorForVirtual(vElapsed);
      setProgress((vElapsed / totalMs) * 100);

      raf = requestAnimationFrame(tick);
    }

    function stopPresentation(completed) {
      running = false;
      paused = false;
      cancelAnimationFrame(raf);
      if (btnPlay) btnPlay.disabled = false;
      if (btnReset) btnReset.disabled = false;
      if (btnPause) {
        btnPause.disabled = true;
        btnPause.textContent = "Pause";
      }
      if (wrap) wrap.classList.remove("playing");
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      stopNarration();
      if (completed && caption) {
        caption.textContent = caption.textContent || "Demo complete.";
      }
      setProgress(completed ? 100 : 0);
    }

    function stop() {
      stopPresentation(false);
    }

    function pauseToggle() {
      if (!running || mode !== "presentation") return;
      if (!paused) {
        paused = true;
        pauseStarted = performance.now();
        if (btnPause) btnPause.textContent = "Resume";
      } else {
        totalPaused += performance.now() - pauseStarted;
        paused = false;
        if (btnPause) btnPause.textContent = "Pause";
        raf = requestAnimationFrame(tick);
      }
    }

    function skipToEnd() {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      stopNarration();
      if (mode === "manual") {
        for (var k = manualIdx; k < timeline.length; k++) {
          processEventAtIndex(k, true);
        }
        manualIdx = timeline.length;
        if (caption) caption.textContent = "Skipped to end (manual).";
        if (btnStep) btnStep.disabled = true;
        if (wrap) wrap.classList.remove("playing");
        if (btnPlay) btnPlay.disabled = false;
        if (btnReset) btnReset.disabled = false;
        setProgress(100);
        var endPos = posAt(totalMs);
        if (stage && cursor) {
          var rect = stage.getBoundingClientRect();
          cursor.style.left = rect.width * endPos.x + "px";
          cursor.style.top = rect.height * endPos.y + "px";
        }
        return;
      }
      for (var i = 0; i < timeline.length; i++) {
        if (fired.has(i)) continue;
        fired.add(i);
        var ev2 = timeline[i];
        if (ev2.cap && caption) caption.textContent = ev2.cap;
        if (ev2.scene !== undefined) setScene(ev2.scene);
        if (ev2.click) doClick(ev2, ev2.t);
        else if (ev2.navKey) {
          setNavActive(ev2.navKey);
          var u2 = getUrlForKey(ev2.navKey);
          if (u2 && urlBar && !ev2.skipUrl) urlBar.textContent = u2;
        }
      }
      stopPresentation(true);
      syncCursorForVirtual(totalMs);
    }

    function syncCursorToStart() {
      if (!stage || !cursor) return;
      var r = stage.getBoundingClientRect();
      var p0 = posAt(0);
      cursor.style.left = r.width * p0.x + "px";
      cursor.style.top = r.height * p0.y + "px";
    }

    function reset() {
      stopPresentation(false);
      fired.clear();
      totalPaused = 0;
      paused = false;
      manualIdx = 0;
      setScene(0);
      setNavActive(currentKey);
      navEls().forEach(function (el) {
        el.classList.remove("flash");
      });
      if (urlBar) urlBar.textContent = defaultUrl;
      if (caption) caption.textContent = "Press Play to start. In Manual mode, use Next step.";
      customReset();
      syncCursorToStart();
      setProgress(0);
      updateModeUi();
    }

    function startPresentation() {
      if (running) return;
      if (selMode) selMode.value = "presentation";
      reset();
      mode = "presentation";
      updateModeUi();
      running = true;
      if (btnPlay) btnPlay.disabled = true;
      if (btnReset) btnReset.disabled = true;
      if (btnPause) {
        btnPause.disabled = false;
        btnPause.textContent = "Pause";
      }
      if (wrap) wrap.classList.add("playing");
      startMs = performance.now();
      totalPaused = 0;
      paused = false;
      raf = requestAnimationFrame(tick);
    }

    function startManualSession() {
      if (selMode) selMode.value = "manual";
      reset();
      mode = "manual";
      updateModeUi();
      if (wrap) wrap.classList.add("playing");
      if (btnStep) btnStep.disabled = false;
      if (btnPlay) btnPlay.disabled = true;
      if (btnReset) btnReset.disabled = false;
      if (caption) caption.textContent = "Manual mode: press Next step to advance the script.";
      setProgress(0);
    }

    function manualAdvance() {
      if (mode !== "manual" || manualIdx >= timeline.length) return;
      processEventAtIndex(manualIdx, true);
      manualIdx++;
      syncCursorForVirtual(manualIdx > 0 ? timeline[manualIdx - 1].t : 0);
      setProgress((manualIdx / timeline.length) * 100);
      if (manualIdx >= timeline.length) {
        if (wrap) wrap.classList.remove("playing");
        if (btnStep) btnStep.disabled = true;
        if (btnPlay) btnPlay.disabled = false;
        if (btnReset) btnReset.disabled = false;
        if (caption) caption.textContent = "Demo complete. Reset to run again.";
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
        stopNarration();
      }
    }

    if (btnPlay) {
      btnPlay.addEventListener("click", function () {
        if (running && mode === "presentation") return;
        if (selMode && selMode.value === "manual") {
          startManualSession();
        } else {
          startPresentation();
        }
      });
    }

    if (btnPause) {
      btnPause.addEventListener("click", function () {
        pauseToggle();
      });
    }

    if (btnSkip) {
      btnSkip.addEventListener("click", function () {
        skipToEnd();
      });
    }

    if (btnStep) {
      btnStep.addEventListener("click", function () {
        manualAdvance();
      });
    }

    if (btnReset) {
      btnReset.addEventListener("click", function () {
        reset();
      });
    }

    if (selSpeed) {
      selSpeed.addEventListener("change", function () {
        speed = parseSpeed(selSpeed.value);
      });
    }

    if (selMode) {
      selMode.addEventListener("change", function () {
        updateModeUi();
        if (running || (wrap && wrap.classList.contains("playing"))) {
          reset();
        }
      });
    }

    if (chkMute) {
      chkMute.addEventListener("change", function () {
        mute = chkMute.checked;
        if (mute) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {}
          stopNarration();
        }
      });
    }

    window.addEventListener("beforeunload", function () {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      stopNarration();
    });

    if (urlBar) urlBar.textContent = defaultUrl;
    setNavActive(currentKey);
    syncCursorToStart();
    setProgress(0);
    updateModeUi();

    return { reset: reset, stop: stop, pauseToggle: pauseToggle, skipToEnd: skipToEnd };
  }

  global.GuideDemo = {
    BASE: BASE,
    DEMO_BY_KEY: DEMO_BY_KEY,
    NAV_GROUPS: NAV_GROUPS,
    CMS_SUB_GROUPS: CMS_SUB_GROUPS,
    getUrlForKey: getUrlForKey,
    renderSidebar: renderSidebar,
    attachPlayer: attachPlayer,
    parseSpeed: parseSpeed,
  };
})(typeof window !== "undefined" ? window : this);
