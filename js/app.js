// app.js
// Frontend logic only. All Gemini calls go through /api/chat (server-side key).

(function () {
  const bowlEl = document.getElementById("stadiumBowl");
  const minuteSlider = document.getElementById("minuteSlider");
  const matchMinuteEl = document.getElementById("matchMinute");
  const gateSelect = document.getElementById("gateSelect");
  const languageSelect = document.getElementById("languageSelect");
  const a11yToggle = document.getElementById("accessibilityToggle");
  const chatLog = document.getElementById("chatLog");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const roleToggle = document.getElementById("roleToggle");
  const opsPanel = document.getElementById("opsPanel");
  const opsStats = document.getElementById("opsStats");
  const opsSustainability = document.getElementById("opsSustainability");
  const opsRecommendBtn = document.getElementById("opsRecommendBtn");

  let matchMinute = 0;
  let accessibilityMode = false;
  let role = "fan";
  let latestDensity = [];

  // Simple response cache: avoids re-calling Gemini for an identical
  // question under identical stadium conditions (efficiency + cost control).
  const responseCache = new Map();
  const MAX_CACHE_ENTRIES = 30;

  function cacheKey(message, contextSummary, language, mode) {
    return `${message}::${contextSummary}::${language}::${mode}`;
  }

  function colorForLevel(level) {
    if (level === "Low") return "var(--pitch-green)";
    if (level === "Moderate") return "var(--scoreboard-amber)";
    return "var(--alert-crimson)";
  }

  function renderBowl() {
    latestDensity = simulateCrowdDensity(matchMinute, Date.now());
    bowlEl.innerHTML = "";
    latestDensity.forEach((section) => {
      const level = getCrowdLevel(section.occupancyRatio);
      const div = document.createElement("div");
      div.className = "bowl__section";
      div.style.backgroundColor = colorForLevel(level);
      div.innerHTML = `${section.id}<span>${level}</span>`;
      div.title = `${section.zone} — ${Math.round(section.occupancyRatio * 100)}% full`;
      bowlEl.appendChild(div);
    });
  }

  function buildContextSummary() {
    const mySection = gateSelect.value;
    const lines = latestDensity.map((s) => {
      const level = getCrowdLevel(s.occupancyRatio);
      const queue = estimateQueueMinutes(s.occupancyRatio, matchMinute);
      return `${s.id} (${s.zone}, ${s.gate}): ${level} crowd, ~${queue} min queue`;
    });
    return [
      `Match minute: ${matchMinute}'`,
      `User's section: ${mySection}`,
      `Accessibility mode: ${accessibilityMode ? "on" : "off"}`,
      "Section status:",
      ...lines,
    ].join("\n");
  }

  function appendMessage(text, kind) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-msg--${kind}`;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function callChatApi({ message, showUserMessage = true, targetRole = role }) {
    if (showUserMessage) appendMessage(message, "user");

    const contextSummary = buildContextSummary();
    const language = languageSelect.value;
    const key = cacheKey(message, contextSummary, language, accessibilityMode);

    if (responseCache.has(key)) {
      appendMessage(responseCache.get(key), "bot");
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          contextSummary,
          language,
          accessibilityMode,
          role: targetRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendMessage(data.error || "Something went wrong.", "error");
        return;
      }
      appendMessage(data.reply, "bot");

      if (responseCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        responseCache.delete(oldestKey);
      }
      responseCache.set(key, data.reply);
    } catch (err) {
      appendMessage("Network error — please check your connection and try again.", "error");
    }
  }

  function askAssistant(message) {
    return callChatApi({ message, showUserMessage: true, targetRole: role });
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;
    chatInput.value = "";
    askAssistant(value);
  });

  // Debounce slider-driven re-renders: dragging fires many "input" events,
  // but re-computing/re-painting the whole bowl on every one is wasteful.
  // rAF collapses that down to at most one render per animation frame.
  let renderQueued = false;
  minuteSlider.addEventListener("input", () => {
    matchMinute = Number(minuteSlider.value);
    matchMinuteEl.textContent = `${String(matchMinute).padStart(2, "0")}'`;
    if (!renderQueued) {
      renderQueued = true;
      requestAnimationFrame(() => {
        renderBowl();
        if (!opsPanel.hidden) renderOpsPanel();
        renderQueued = false;
      });
    }
  });

  a11yToggle.addEventListener("click", () => {
    accessibilityMode = !accessibilityMode;
    a11yToggle.setAttribute("aria-pressed", String(accessibilityMode));
    a11yToggle.textContent = accessibilityMode ? "✔ Accessibility mode on" : "♿ Accessibility mode";
  });

  roleToggle.addEventListener("click", () => {
    role = role === "fan" ? "staff" : "fan";
    const isStaff = role === "staff";
    roleToggle.setAttribute("aria-pressed", String(isStaff));
    roleToggle.textContent = isStaff ? "🎟️ Switch to Fan View" : "🧑‍💼 Switch to Staff View";
    opsPanel.hidden = !isStaff;
    if (isStaff) renderOpsPanel();
  });

  function renderOpsPanel() {
    const avgOccupancy =
      latestDensity.reduce((sum, s) => sum + s.occupancyRatio, 0) / latestDensity.length;
    const highCrowdSections = latestDensity.filter((s) => getCrowdLevel(s.occupancyRatio) === "High");
    const busiest = [...latestDensity].sort((a, b) => b.occupancyRatio - a.occupancyRatio)[0];

    opsStats.innerHTML = `
      <div><dt>Average occupancy</dt><dd>${Math.round(avgOccupancy * 100)}%</dd></div>
      <div><dt>Sections at High crowd</dt><dd>${highCrowdSections.length} / ${latestDensity.length}</dd></div>
      <div><dt>Busiest section</dt><dd>${busiest ? busiest.id : "—"}</dd></div>
      <div><dt>Match minute</dt><dd>${matchMinute}'</dd></div>
    `;

    const transitAmenity = AMENITIES.find((a) => a.type === "transit_stop");
    const nearBusyTransit =
      transitAmenity && highCrowdSections.some((s) => s.id === transitAmenity.nearSection);

    opsSustainability.textContent = nearBusyTransit
      ? `Sustainability tip: crowd is building near ${transitAmenity.nearSection}, close to ${transitAmenity.name}. Consider directing departing fans toward public transit now to reduce post-match vehicle congestion.`
      : "Sustainability tip: crowd levels near transit points are currently manageable. Continue encouraging public transit and on-site recycling stations as fans move between sections.";
  }

  opsRecommendBtn.addEventListener("click", () => {
    const busiest = [...latestDensity].sort((a, b) => b.occupancyRatio - a.occupancyRatio)[0];
    const prompt = busiest
      ? `Given current conditions, what operational action should staff take first, focusing on section ${busiest.id}?`
      : "What operational action should staff take first given current conditions?";
    callChatApi({ message: prompt, showUserMessage: true, targetRole: "staff" });
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.action;
      const mySection = gateSelect.value;
      const amenity = findNearestAmenity(mySection, type, accessibilityMode);
      if (!amenity) {
        appendMessage(`No ${type.replace("_", " ")} found in the demo data.`, "error");
        return;
      }
      const label = amenity.name ? `${amenity.name}` : type.replace("_", " ");
      const near = latestDensity.find((s) => s.id === amenity.nearSection);
      const level = near ? getCrowdLevel(near.occupancyRatio) : "Unknown";
      appendMessage(
        `Nearest ${label} is near section ${amenity.nearSection} (${level} crowd)${
          amenity.accessible ? ", wheelchair accessible" : ""
        }.`,
        "bot"
      );
    });
  });

  // Live refresh every 8 seconds to simulate real-time sensor updates.
  // Paused while the tab is hidden so we're not doing pointless work in
  // a background tab (efficiency + battery friendliness).
  let refreshTimer = null;

  function startRefresh() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      renderBowl();
      if (!opsPanel.hidden) renderOpsPanel();
    }, 8000);
  }

  function stopRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRefresh();
    else {
      renderBowl();
      if (!opsPanel.hidden) renderOpsPanel();
      startRefresh();
    }
  });

  startRefresh();
  renderBowl();
})();
