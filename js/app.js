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

  let matchMinute = 0;
  let accessibilityMode = false;
  let latestDensity = [];

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

  async function askAssistant(message) {
    appendMessage(message, "user");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          contextSummary: buildContextSummary(),
          language: languageSelect.value,
          accessibilityMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        appendMessage(data.error || "Something went wrong.", "error");
        return;
      }
      appendMessage(data.reply, "bot");
    } catch (err) {
      appendMessage("Network error — please check your connection and try again.", "error");
    }
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = chatInput.value.trim();
    if (!value) return;
    chatInput.value = "";
    askAssistant(value);
  });

  minuteSlider.addEventListener("input", () => {
    matchMinute = Number(minuteSlider.value);
    matchMinuteEl.textContent = `${String(matchMinute).padStart(2, "0")}'`;
    renderBowl();
  });

  a11yToggle.addEventListener("click", () => {
    accessibilityMode = !accessibilityMode;
    a11yToggle.setAttribute("aria-pressed", String(accessibilityMode));
    a11yToggle.textContent = accessibilityMode ? "✔ Accessibility mode on" : "♿ Accessibility mode";
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

  // Live refresh every 8 seconds to simulate real-time sensor updates
  setInterval(renderBowl, 8000);

  renderBowl();
})();
