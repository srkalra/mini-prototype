// ===== Stress levels (the same bands Garmin uses) =====
const LEVELS = [
  { name: "Rest", color: "var(--rest)", min: 0, max: 25 },
  { name: "Low", color: "var(--low)", min: 26, max: 50 },
  { name: "Medium", color: "var(--medium)", min: 51, max: 75 },
  { name: "High", color: "var(--high)", min: 76, max: 100 },
];

// Labels for the "I feel…" options, in the same order as LEVELS
const FELT_LABELS = ["Calm / resting", "Fine / a little stressed", "Moderately stressed", "Very stressed"];

// How wide the likely range is (+/-) for each confidence level
const SPREAD = { high: 4, moderate: 8, low: 13 };

// How many check-ins before the app says it has personalized your stress
const LEARN_GOAL = 5;

function levelIndex(value) {
  return LEVELS.findIndex((level) => value <= level.max);
}

// ===== Fake data for today =====
// One reading every 15 minutes from midnight to 2:45 PM (60 readings).
// A seeded random number generator makes the chart look the same every time.
function seededRandom(seed) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const random = seededRandom(42);
const readings = [];

for (let i = 0; i < 60; i++) {
  const hour = i / 4;
  let value;
  let confidence = "moderate";
  let reason = "Normal signal quality from your watch.";

  if (hour < 6.5) {
    // Asleep: resting stress, very reliable
    value = 12 + random() * 12;
    confidence = "high";
    reason = "You were still and your watch had a good signal, so this reading is reliable.";
  } else if (hour >= 7 && hour < 8) {
    // Morning run: Garmin doesn't measure stress during activities
    value = null;
  } else if (hour >= 8 && hour < 8.5) {
    value = 45 + random() * 15;
    confidence = "low";
    reason = "You had just finished a run, so your heart rate was still recovering. That makes stress harder to read.";
  } else if (hour < 11) {
    value = 28 + random() * 20;
  } else {
    value = 45 + random() * 25;
  }

  readings.push({
    minutes: i * 15,
    value: value === null ? null : Math.round(value),
    confidence: confidence,
    reason: reason,
  });
}

// The latest reading matches the example: "Garmin says medium stress, I feel fine"
const latest = readings[readings.length - 1];
latest.value = 58;
latest.reason = "Based on the last 15 minutes. You moved around a bit, which makes the reading less certain.";

function likelyRange(reading) {
  const spread = reading === latest ? 9 : SPREAD[reading.confidence];
  return {
    low: Math.max(0, reading.value - spread),
    high: Math.min(100, reading.value + spread),
  };
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + suffix;
}

// ===== Saved state =====
// Feedback is saved in the browser so the demo remembers it after a refresh.
const SAMPLE_HISTORY = [
  { when: "Yesterday, 8:15 PM", measured: 2, value: 74, felt: 1 },
  { when: "3 days ago, 10:30 AM", measured: 2, value: 61, felt: 0 },
];

let feedback = loadFeedback(); // { readingIndex: { felt, reasons, note } }
let selected = readings.length - 1;

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem("stressFeedbackV2")) || {};
  } catch (e) {
    return {};
  }
}

function saveFeedback() {
  try {
    localStorage.setItem("stressFeedbackV2", JSON.stringify(feedback));
  } catch (e) {
    // Saving isn't allowed, so feedback only lasts until the page reloads
  }
}

function checkInCount() {
  return SAMPLE_HISTORY.length + Object.keys(feedback).length;
}

// ===== Navigation =====
const $ = (id) => document.getElementById(id);

function showScreen(name) {
  $("screen-home").classList.toggle("hidden", name !== "home");
  $("screen-stress").classList.toggle("hidden", name !== "stress");
  if (name === "stress") $("screen-stress").querySelector(".scroll").scrollTop = 0;
  renderAll();
}

$("stress-tile").addEventListener("click", () => showScreen("stress"));
$("back-btn").addEventListener("click", () => showScreen("home"));
$("tab-home").addEventListener("click", () => showScreen("home"));

// Anything that isn't part of this prototype shows a small message instead
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}

document.querySelectorAll("[data-todo]").forEach((el) => {
  el.addEventListener("click", () => toast(el.dataset.todo + " isn't part of this prototype"));
});

// Keep the In Focus dots in sync with the swipeable cards
$("carousel").addEventListener("scroll", () => {
  const carousel = $("carousel");
  const cardWidth = carousel.firstElementChild.offsetWidth + 10;
  const index = Math.round(carousel.scrollLeft / cardWidth);
  document.querySelectorAll("#dots i").forEach((dot, i) => dot.classList.toggle("on", i === index));
});

// ===== Drawing helpers =====
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

// A full-circle progress ring, like the ones on Garmin's At a Glance tiles
function drawRing(svg, percent, color) {
  svg.innerHTML = "";
  const r = 40;
  const circumference = 2 * Math.PI * r;
  svg.appendChild(svgEl("circle", { cx: 50, cy: 50, r: r, fill: "none", stroke: "#333", "stroke-width": 10 }));
  svg.appendChild(svgEl("circle", {
    cx: 50, cy: 50, r: r, fill: "none", stroke: color, "stroke-width": 10, "stroke-linecap": "round",
    "stroke-dasharray": `${(percent / 100) * circumference} ${circumference}`,
    transform: "rotate(-90 50 50)",
  }));
}

// Points on the stress gauge: 0 is bottom-left, 100 is bottom-right
const GAUGE = { cx: 110, cy: 105, r: 86, start: 135, sweep: 270 };

function gaugePoint(value, r = GAUGE.r) {
  const angle = ((GAUGE.start + (value / 100) * GAUGE.sweep) * Math.PI) / 180;
  return [GAUGE.cx + r * Math.cos(angle), GAUGE.cy + r * Math.sin(angle)];
}

function gaugeArc(from, to) {
  const [x1, y1] = gaugePoint(from);
  const [x2, y2] = gaugePoint(to);
  const large = ((to - from) / 100) * GAUGE.sweep > 180 ? 1 : 0;
  return `M${x1} ${y1} A${GAUGE.r} ${GAUGE.r} 0 ${large} 1 ${x2} ${y2}`;
}

// ===== Home screen =====
function renderHome() {
  document.querySelectorAll("svg.ring[data-value]").forEach((svg) => {
    drawRing(svg, Number(svg.dataset.value), svg.dataset.color);
  });

  const level = LEVELS[levelIndex(latest.value)];
  drawRing($("stress-tile-ring"), latest.value, level.color);
  $("stress-tile-value").textContent = latest.value;
  $("stress-tile-level").textContent = level.name;
  $("tile-flag").classList.toggle("hidden", Object.keys(feedback).length === 0);
}

// ===== Stress screen =====
function renderGauge(reading) {
  const gauge = $("gauge");
  gauge.innerHTML = "";
  const isActivity = reading.value === null;

  // The four stress zones, dimmed
  LEVELS.forEach((level, i) => {
    const from = i === 0 ? 0 : level.min - 0.5;
    const to = level.max + (i === 3 ? 0 : 0.5);
    gauge.appendChild(svgEl("path", {
      d: gaugeArc(from + 0.8, to - 0.8), fill: "none", stroke: level.color,
      "stroke-width": 12, opacity: 0.28,
    }));
  });

  if (isActivity) return;

  // NEW: the likely range, drawn bright on top of the zones
  const range = likelyRange(reading);
  LEVELS.forEach((level) => {
    const from = Math.max(range.low, level.min === 0 ? 0 : level.min - 0.5);
    const to = Math.min(range.high, level.max + 0.5);
    if (from < to) {
      gauge.appendChild(svgEl("path", {
        d: gaugeArc(from, to), fill: "none", stroke: level.color, "stroke-width": 12,
      }));
    }
  });

  // Brackets at each end of the range
  [range.low, range.high].forEach((v) => {
    const [x1, y1] = gaugePoint(v, GAUGE.r - 10);
    const [x2, y2] = gaugePoint(v, GAUGE.r + 10);
    gauge.appendChild(svgEl("line", { x1, y1, x2, y2, stroke: "#fff", "stroke-width": 2, "stroke-linecap": "round" }));
  });

  // Marker for the reading itself
  const [mx, my] = gaugePoint(reading.value);
  gauge.appendChild(svgEl("circle", { cx: mx, cy: my, r: 8, fill: "#000", stroke: "#fff", "stroke-width": 3 }));

  // Scale labels
  [[0, "0"], [100, "100"]].forEach(([v, text]) => {
    const [x, y] = gaugePoint(v, GAUGE.r);
    const label = svgEl("text", { x: x, y: y + 16, "text-anchor": "middle", fill: "#777", "font-size": 11 });
    label.textContent = text;
    gauge.appendChild(label);
  });
}

function renderReading() {
  const reading = readings[selected];
  const isActivity = reading.value === null;
  $("reading-time").textContent = (reading === latest ? "Now · " : "") + formatTime(reading.minutes);
  renderGauge(reading);

  $("feedback-btn").disabled = isActivity;
  $("confidence-row").classList.toggle("hidden", isActivity);

  if (isActivity) {
    $("reading-value").textContent = "--";
    $("reading-level").textContent = "Activity";
    $("reading-level").style.color = "var(--muted)";
    $("range-note").textContent = "Stress isn't measured while you're doing an activity.";
    $("user-flag").classList.add("hidden");
    $("feedback-btn-title").textContent = "Doesn't feel right?";
    $("feedback-btn-sub").textContent = "Pick a stress reading to give feedback";
    return;
  }

  const level = LEVELS[levelIndex(reading.value)];
  $("reading-value").textContent = reading.value;
  $("reading-level").textContent = level.name;
  $("reading-level").style.color = level.color;

  // Likely range (the confidence interval)
  const range = likelyRange(reading);
  const lowLevel = LEVELS[levelIndex(range.low)].name;
  const highLevel = LEVELS[levelIndex(range.high)].name;
  $("range-text").textContent = range.low + "–" + range.high;
  $("confidence-text").textContent =
    reading.confidence.charAt(0).toUpperCase() + reading.confidence.slice(1) + " confidence";
  $("confidence-text").className = "conf-chip " + reading.confidence;

  let note = reading.reason;
  if (lowLevel !== highLevel) {
    note += " The range covers both " + lowLevel + " and " + highLevel + ", so it could be either.";
  }
  $("range-note").textContent = note;

  // Show what the user said about this reading, if anything
  const fb = feedback[selected];
  $("user-flag").classList.toggle("hidden", !fb);
  if (fb) {
    let text = "⚑ You said you felt <strong>" + FELT_LABELS[fb.felt].toLowerCase() + "</strong>";
    if (fb.reasons.length) text += " · " + fb.reasons.join(", ");
    if (fb.note) text += " · “" + escapeHtml(fb.note) + "”";
    $("user-flag").innerHTML = text;
  }

  $("feedback-btn-title").textContent = fb ? "Edit your feedback" : "Doesn't feel right?";
  $("feedback-btn-sub").textContent = fb
    ? "Change how you said you felt at " + formatTime(reading.minutes)
    : "Tell Garmin how you actually feel";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderChart() {
  const chart = $("stress-chart");
  chart.innerHTML = "";

  // Plot area inside the 340 x 160 SVG
  const left = 4;
  const right = 314;
  const top = 16;
  const bottom = 132;
  const slot = (right - left) / readings.length;
  const yFor = (value) => bottom - (value / 100) * (bottom - top);

  // Grid lines with labels on the right, like Garmin's charts
  [0, 25, 50, 75, 100].forEach((v) => {
    chart.appendChild(svgEl("line", {
      x1: left, x2: right, y1: yFor(v), y2: yFor(v), stroke: "#2a2a2a", "stroke-width": 1,
    }));
    const label = svgEl("text", { x: right + 6, y: yFor(v) + 3, fill: "#777", "font-size": 9 });
    label.textContent = v;
    chart.appendChild(label);
  });

  [["12 AM", 0, "start"], ["6 AM", 24, "middle"], ["12 PM", 48, "middle"], ["3 PM", 60, "end"]].forEach(([text, i, anchor]) => {
    const label = svgEl("text", { x: left + i * slot, y: 150, "text-anchor": anchor, fill: "#777", "font-size": 9 });
    label.textContent = text;
    chart.appendChild(label);
  });

  // Highlight behind the selected bar
  chart.appendChild(svgEl("rect", {
    x: left + selected * slot - 1, y: top - 12, width: slot + 2, height: bottom - top + 12,
    fill: "rgba(255,255,255,0.13)", rx: 2,
  }));

  readings.forEach((reading, i) => {
    const x = left + i * slot;
    const value = reading.value === null ? 80 : Math.max(3, reading.value);
    // Garmin's stress chart is just blue (rest) and orange (stress)
    const color = reading.value === null ? "var(--activity)" : reading.value <= 25 ? "var(--rest)" : "var(--stress)";
    chart.appendChild(svgEl("rect", {
      x: x + 0.5, y: yFor(value), width: slot - 1, height: bottom - yFor(value),
      fill: color, opacity: i === selected ? 1 : 0.85,
    }));

    // Small flag above readings the user has flagged
    if (feedback[i]) {
      const fx = x + slot / 2;
      const fy = yFor(value) - 13;
      chart.appendChild(svgEl("path", {
        d: `M${fx} ${fy + 10} V${fy} h6 l-2 2.5 l2 2.5 h-6`,
        stroke: "var(--accent)", fill: "var(--accent)", "stroke-width": 1.2,
      }));
    }
  });

  // Whisker showing the likely range on the selected bar
  const sel = readings[selected];
  if (sel.value !== null) {
    const range = likelyRange(sel);
    const cx = left + selected * slot + slot / 2;
    chart.appendChild(svgEl("path", {
      d: `M${cx - 3} ${yFor(range.high)} h6 M${cx} ${yFor(range.high)} V${yFor(range.low)} M${cx - 3} ${yFor(range.low)} h6`,
      stroke: "#fff", "stroke-width": 1.5, fill: "none",
    }));
  }

  // Invisible, full-height tap targets make the thin bars easy to hit
  readings.forEach((reading, i) => {
    const hit = svgEl("rect", {
      x: left + i * slot, y: 0, width: slot, height: 160, fill: "transparent", style: "cursor:pointer",
    });
    hit.addEventListener("click", () => {
      selected = i;
      renderStress();
    });
    chart.appendChild(hit);
  });
}

function renderBreakdown() {
  const counts = [0, 0, 0, 0];
  let total = 0;
  let measured = 0;
  readings.forEach((r) => {
    if (r.value !== null) {
      counts[levelIndex(r.value)]++;
      total += r.value;
      measured++;
    }
  });

  const overall = Math.round(total / measured);
  $("overall").textContent = "Overall " + overall + " · " + LEVELS[levelIndex(overall)].name;

  $("stacked").innerHTML = LEVELS.map((level, i) =>
    counts[i] ? `<div style="flex:${counts[i]};background:${level.color}"></div>` : ""
  ).join("");

  $("breakdown").innerHTML = LEVELS.map((level, i) => {
    const minutes = counts[i] * 15;
    const time = Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
    return `<div>${time}<span><i style="background:${level.color}"></i>${level.name}</span></div>`;
  }).join("");
}

function renderLearning() {
  const count = checkInCount();
  const done = Math.min(count, LEARN_GOAL);
  $("learn-count").textContent = done + " of " + LEARN_GOAL;
  $("learn-bar").style.width = (done / LEARN_GOAL) * 100 + "%";
  $("learn-text").textContent = count >= LEARN_GOAL
    ? "Your stress readings now take your feedback into account. Keep flagging readings that feel off."
    : "Flag " + (LEARN_GOAL - count) + " more reading" + (LEARN_GOAL - count === 1 ? "" : "s") +
      " that don't match how you feel and Garmin will start adjusting your readings to you.";

  // Today's flags first, then the sample history
  const todays = Object.keys(feedback).map(Number).sort((a, b) => b - a).map((i) => ({
    when: "Today, " + formatTime(readings[i].minutes),
    measured: levelIndex(readings[i].value),
    value: readings[i].value,
    felt: feedback[i].felt,
  }));

  $("history").innerHTML = todays.concat(SAMPLE_HISTORY).map((item) =>
    `<li><span>${item.when}</span><span>Measured ${LEVELS[item.measured].name} (${item.value}) → you felt ${FELT_LABELS[item.felt].toLowerCase()}</span></li>`
  ).join("");
}

function renderStress() {
  renderReading();
  renderChart();
  renderBreakdown();
  renderLearning();
}

function renderAll() {
  renderHome();
  renderStress();
}

// ===== Feedback sheet =====
let felt = null;

function openSheet() {
  const reading = readings[selected];
  if (reading.value === null) return;

  const measured = levelIndex(reading.value);
  const existing = feedback[selected];

  $("sheet-measured").innerHTML = "Garmin measured <strong>" + LEVELS[measured].name +
    " (" + reading.value + ")</strong> at " + formatTime(reading.minutes);

  // Mark which option matches Garmin's reading
  document.querySelectorAll("#felt-options button").forEach((btn) => {
    const old = btn.querySelector(".measured-tag");
    if (old) old.remove();
    if (Number(btn.dataset.level) === measured) {
      btn.insertAdjacentHTML("beforeend", '<span class="measured-tag">Garmin\'s reading</span>');
    }
  });

  // Fill in any earlier answer so it can be edited
  felt = existing ? existing.felt : null;
  document.querySelectorAll("#felt-options button").forEach((btn) => {
    btn.classList.toggle("selected", Number(btn.dataset.level) === felt);
  });
  document.querySelectorAll("#reason-options button").forEach((btn) => {
    btn.classList.toggle("selected", !!existing && existing.reasons.includes(btn.textContent));
  });
  $("note").value = existing ? existing.note : "";
  updateSendButton();

  $("sheet-form").classList.remove("hidden");
  $("sheet-thanks").classList.add("hidden");
  $("backdrop").classList.remove("hidden");
}

function closeSheet() {
  $("backdrop").classList.add("hidden");
}

function updateSendButton() {
  const measured = levelIndex(readings[selected].value);
  $("send-btn").disabled = felt === null;
  $("send-btn").textContent = felt === measured ? "Confirm Reading Is Right" : "Send Feedback";
}

document.querySelectorAll("#felt-options button").forEach((btn) => {
  btn.addEventListener("click", () => {
    felt = Number(btn.dataset.level);
    document.querySelectorAll("#felt-options button").forEach((b) => b.classList.toggle("selected", b === btn));
    updateSendButton();
  });
});

document.querySelectorAll("#reason-options button").forEach((btn) => {
  btn.addEventListener("click", () => btn.classList.toggle("selected"));
});

$("feedback-btn").addEventListener("click", openSheet);
$("cancel-btn").addEventListener("click", closeSheet);
$("done-btn").addEventListener("click", closeSheet);
$("backdrop").addEventListener("click", (event) => {
  if (event.target === $("backdrop")) closeSheet();
});

$("send-btn").addEventListener("click", () => {
  const reading = readings[selected];
  const measured = levelIndex(reading.value);
  const before = checkInCount();

  feedback[selected] = {
    felt: felt,
    reasons: [...document.querySelectorAll("#reason-options button.selected")].map((b) => b.textContent),
    note: $("note").value.trim(),
  };
  saveFeedback();

  // Thank-you message depends on what the user said
  let message;
  if (felt < measured) {
    message = "You felt calmer than Garmin measured. We'll use this to tune how your heart rate is read as stress.";
  } else if (felt > measured) {
    message = "You felt more stressed than Garmin measured. We'll use this to tune how your heart rate is read as stress.";
  } else {
    message = "Thanks for confirming this reading. Confirmations help Garmin learn too.";
  }
  $("thanks-text").textContent = message;

  const count = checkInCount();
  const done = Math.min(count, LEARN_GOAL);
  $("thanks-progress").textContent = count >= LEARN_GOAL
    ? "Your stress readings are now personalized to you."
    : done + " of " + LEARN_GOAL + " check-ins until your readings are personalized.";

  // Animate the progress bar from the old count to the new one
  $("thanks-bar").style.transition = "none";
  $("thanks-bar").style.width = (Math.min(before, LEARN_GOAL) / LEARN_GOAL) * 100 + "%";
  $("sheet-form").classList.add("hidden");
  $("sheet-thanks").classList.remove("hidden");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("thanks-bar").style.transition = "";
    $("thanks-bar").style.width = (done / LEARN_GOAL) * 100 + "%";
  }));

  renderAll();
});

$("reset-btn").addEventListener("click", () => {
  feedback = {};
  saveFeedback();
  selected = readings.length - 1;
  renderAll();
  toast("Demo reset");
});

renderAll();
