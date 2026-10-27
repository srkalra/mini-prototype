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
    reason = "You had just finished an activity, so your heart rate was still recovering. That makes stress harder to read.";
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
  { when: "Yesterday, 8:15 PM", measured: 2, value: 74, felt: 1, reasons: ["Excited / happy"] },
  { when: "3 days ago, 10:30 AM", measured: 2, value: 61, felt: 0, reasons: ["Caffeine"] },
];

let feedback = loadFeedback(); // { readingIndex: { felt, reasons, note } }
let selected = readings.length - 1;

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem("stressFeedback")) || {};
  } catch (e) {
    return {};
  }
}

function saveFeedback() {
  try {
    localStorage.setItem("stressFeedback", JSON.stringify(feedback));
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
  $("screen-myday").classList.toggle("hidden", name !== "myday");
  $("screen-stress").classList.toggle("hidden", name !== "stress");
  if (name === "stress") $("screen-stress").querySelector(".scroll").scrollTop = 0;
  renderAll();
}

$("stress-card").addEventListener("click", () => showScreen("stress"));
$("back-btn").addEventListener("click", () => showScreen("myday"));

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

// ===== Drawing helpers =====
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

function barColor(reading) {
  return reading.value === null ? "var(--activity)" : LEVELS[levelIndex(reading.value)].color;
}

// ===== My Day screen =====
function renderMyDay() {
  $("myday-stress-value").textContent = latest.value;
  $("myday-stress-level").textContent = LEVELS[levelIndex(latest.value)].name + " · Now";
  $("myday-flag-pill").classList.toggle("hidden", Object.keys(feedback).length === 0);

  const chart = $("myday-stress-chart");
  chart.innerHTML = "";
  const barWidth = 160 / readings.length;
  readings.forEach((reading, i) => {
    const h = reading.value === null ? 30 : Math.max(2, (reading.value / 100) * 48);
    chart.appendChild(svgEl("rect", {
      x: i * barWidth, y: 50 - h, width: barWidth - 0.8, height: h, fill: barColor(reading),
    }));
  });
}

// ===== Stress screen =====
function renderReading() {
  const reading = readings[selected];
  $("reading-time").textContent = (reading === latest ? "Now · " : "") + formatTime(reading.minutes);

  const isActivity = reading.value === null;
  $("feedback-btn").disabled = isActivity;
  $("feedback-btn").style.opacity = isActivity ? 0.4 : 1;
  document.querySelector(".range-block").classList.toggle("hidden", isActivity);

  if (isActivity) {
    $("reading-value").textContent = "—";
    $("reading-level").textContent = "Activity";
    $("reading-level").style.color = "var(--muted)";
    $("user-flag").classList.add("hidden");
    $("feedback-btn-title").textContent = "Doesn't feel right?";
    $("feedback-btn-sub").textContent = "Stress isn't measured during activities";
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

  $("range-band").style.left = range.low + "%";
  $("range-band").style.width = range.high - range.low + "%";
  $("dim-left").style.width = range.low + "%";
  $("dim-right").style.width = 100 - range.high + "%";
  $("range-dot").style.left = reading.value + "%";

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
    : "Tell us how you actually feel so Garmin can learn";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderChart() {
  const chart = $("stress-chart");
  chart.innerHTML = "";

  // Plot area inside the 340 x 150 SVG
  const left = 24;
  const right = 336;
  const top = 14;
  const bottom = 124;
  const slot = (right - left) / readings.length;
  const yFor = (value) => bottom - (value / 100) * (bottom - top);

  // Grid lines at each stress band
  [25, 50, 75, 100].forEach((v) => {
    chart.appendChild(svgEl("line", {
      x1: left, x2: right, y1: yFor(v), y2: yFor(v), stroke: "#2c2c2e", "stroke-width": 1,
    }));
    const label = svgEl("text", { x: left - 6, y: yFor(v) + 3, "text-anchor": "end", fill: "#6c6c70", "font-size": 9 });
    label.textContent = v;
    chart.appendChild(label);
  });

  // Time labels
  [["12A", 0], ["6A", 24], ["12P", 48], ["3P", 60]].forEach(([text, i]) => {
    const anchor = i === 0 ? "start" : i === readings.length ? "end" : "middle";
    const label = svgEl("text", { x: left + i * slot, y: 142, "text-anchor": anchor, fill: "#6c6c70", "font-size": 9 });
    label.textContent = text;
    chart.appendChild(label);
  });

  // Highlight behind the selected bar
  chart.appendChild(svgEl("rect", {
    x: left + selected * slot - 1, y: top - 10, width: slot + 2, height: bottom - top + 10,
    fill: "rgba(255,255,255,0.12)", rx: 2,
  }));

  readings.forEach((reading, i) => {
    const x = left + i * slot;
    const value = reading.value === null ? 70 : Math.max(3, reading.value);
    chart.appendChild(svgEl("rect", {
      x: x + 0.5, y: yFor(value), width: slot - 1, height: bottom - yFor(value),
      fill: barColor(reading), opacity: i === selected ? 1 : 0.8,
    }));

    // Small flag above readings the user has flagged
    if (feedback[i]) {
      const fx = x + slot / 2;
      const fy = yFor(value) - 12;
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
      x: left + i * slot, y: 0, width: slot, height: 150, fill: "transparent", style: "cursor:pointer",
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
  readings.forEach((r) => {
    if (r.value !== null) counts[levelIndex(r.value)]++;
  });

  $("breakdown").innerHTML = LEVELS.map((level, i) => {
    const minutes = counts[i] * 15;
    const time = Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
    return `<div><i style="background:${level.color}"></i>${time}<span>${level.name}</span></div>`;
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
  renderMyDay();
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
  $("send-btn").textContent = felt === measured ? "Confirm reading is right" : "Send feedback";
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
