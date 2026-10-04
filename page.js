// The client page, inlined so the worker serves it without an assets config.
// The client script avoids backticks, "${" and backslashes so it can live
// inside this template literal unchanged.
export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EWW ASCENSUS · Standup Wheel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#151110; --panel:#221a17; --line:#3a2c26; --text:#f4ece6; --muted:#b39f93; --accent:#f05a28; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Quicksand, system-ui, sans-serif; color:var(--text);
         background:radial-gradient(circle at 80% 0%, #4a2a14 0%, var(--bg) 55%); min-height:100vh; }
  header { padding:20px 28px 0; }
  h1 { margin:0; font-size:26px; letter-spacing:.5px; }
  h1 span { color:var(--accent); }
  .sub { color:var(--muted); margin-top:4px; }
  main { display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:24px; padding:20px 28px 40px; }
  @media (max-width: 900px) { main { grid-template-columns:1fr; } }
  .wheel-wrap { position:relative; display:flex; flex-direction:column; align-items:center; gap:14px; }
  .spin-for { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:10px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:10px 14px; }
  .spin-for label { color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:1px; font-size:13px; }
  input[type=date] { padding:7px 10px; border-radius:8px; border:1px solid var(--line); background:#160f0d; color:var(--text); font:inherit; color-scheme:dark; }
  .spin-status { font-size:13px; color:var(--muted); width:100%; text-align:center; }
  .spin-status.warn { color:#f6a93b; }
  .next-card { background:linear-gradient(135deg, #e8380d, #f47b30); border:0; color:#fff; }
  .next-card h2 { color:rgba(255,255,255,.8); }
  .next-card .who { font-size:26px; font-weight:700; line-height:1.15; }
  .next-card .when { margin-top:4px; font-size:14px; opacity:.9; }
  .next-card .also { margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,.3); font-size:13px; opacity:.9; }
  .next-card .also div { display:flex; align-items:center; gap:8px; }
  .next-card .also .n { flex:1; }
  .next-card .top { display:flex; align-items:flex-start; gap:8px; }
  .next-card .top > div { flex:1; }
  .next-card .x { background:none; border:0; color:rgba(255,255,255,.75); padding:2px 6px; font-size:16px; }
  .next-card .x:hover { color:#fff; }
  canvas { width:min(78vh, 100%); max-width:640px; aspect-ratio:1; cursor:pointer; filter:drop-shadow(0 12px 30px rgba(0,0,0,.5)); }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:16px; }
  .panel h2 { margin:0 0 12px; font-size:16px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); }
  form { display:flex; gap:8px; }
  input[type=text] { flex:1; padding:9px 11px; border-radius:8px; border:1px solid var(--line); background:#160f0d; color:var(--text); font:inherit; }
  button { padding:9px 14px; border:0; border-radius:8px; background:var(--accent); color:#fff; font:inherit; font-weight:700; cursor:pointer; }
  button.ghost { background:transparent; color:var(--muted); border:1px solid var(--line); }
  button:disabled { opacity:.5; cursor:not-allowed; }
  ul { list-style:none; margin:12px 0 0; padding:0; max-height:330px; overflow:auto; }
  li { display:flex; align-items:center; gap:8px; padding:7px 4px; border-bottom:1px solid var(--line); }
  li:last-child { border-bottom:0; }
  li .name { flex:1; }
  li .meta { color:var(--muted); font-size:12px; }
  li .x { background:none; border:0; color:var(--muted); padding:2px 6px; font-size:16px; }
  li .x:hover { color:#ff7b6b; }
  li.off .name { text-decoration:line-through; color:var(--muted); }
  .hint { color:var(--muted); font-size:12px; margin-top:8px; }
  .today { font-size:14px; color:var(--muted); margin-bottom:8px; }
  .today b { color:var(--text); font-size:18px; }
  .err { color:#ff7b6b; font-size:13px; margin-top:6px; min-height:1em; }
  dialog { border:0; border-radius:16px; padding:28px 36px; background:var(--panel); color:var(--text); text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.6); }
  dialog::backdrop { background:rgba(0,0,0,.6); }
  dialog .big { font-size:34px; font-weight:700; color:var(--accent); margin:8px 0 18px; }
  dialog .row { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  dialog .replace { color:#f6a93b; margin:-6px 0 16px; }
</style>
</head>
<body>
<header>
  <h1><span>EWW ASCENSUS</span> · Who leads the standup?</h1>
  <div class="sub">Click the wheel or press Ctrl+Enter to spin.</div>
</header>
<main>
  <section class="wheel-wrap">
    <div class="spin-for">
      <label for="spinDate">Spinning for</label>
      <input type="date" id="spinDate">
      <button class="ghost" id="nextDayBtn" type="button" title="Next standup day (Mon–Thu)">Next standup</button>
      <div class="spin-status" id="spinStatus"></div>
    </div>
    <canvas id="wheel" width="1000" height="1000" aria-label="Wheel"></canvas>
  </section>
  <aside>
    <div class="panel next-card">
      <h2>Next leader</h2>
      <div id="nextLeader"></div>
    </div>
    <div class="panel">
      <h2>Today</h2>
      <div class="today" id="today">No leader picked for today yet.</div>
    </div>
    <div class="panel">
      <h2>Team (<span id="count">0</span>)</h2>
      <form id="addForm">
        <input type="text" id="newName" placeholder="Full name" maxlength="80" autocomplete="off">
        <button type="submit">Add</button>
      </form>
      <div class="err" id="err"></div>
      <ul id="members"></ul>
      <div class="hint">Uncheck anyone who is out that day to leave them off the wheel. The ✕ removes them from the team.</div>
    </div>
    <div class="panel">
      <h2>History</h2>
      <ul id="history"></ul>
    </div>
  </aside>
</main>

<dialog id="winner">
  <div id="winnerWhen"></div>
  <div class="big" id="winnerName"></div>
  <div class="replace" id="winnerReplace" hidden></div>
  <div class="row">
    <button id="keepBtn">Done!</button>
    <button id="replaceBtn" hidden>Replace</button>
    <button class="ghost" id="cancelBtn" hidden>Keep current</button>
    <button class="ghost" id="respinBtn">Spin again</button>
  </div>
</dialog>

<script>
(function () {
  var COLORS = ["#e8380d", "#c8170f", "#7a2318", "#f47b30", "#f6a93b", "#f5dc5a"];
  var DARK_TEXT = { "#f6a93b": 1, "#f5dc5a": 1, "#f47b30": 1, "#e8380d": 1 };
  var canvas = document.getElementById("wheel");
  var ctx = canvas.getContext("2d");
  var members = [];
  var excluded = {};
  var standups = [];
  var pending = null;
  var rotation = 0;
  var spinning = false;
  var dateInput = document.getElementById("spinDate");

  // DATE-HELPERS (pure, tested from Node)
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function isoOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseISO(iso) {
    var p = iso.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function todayISO() { return isoOf(new Date()); }
  // Standups run Monday to Thursday. Returns the first standup day after fromIso.
  function nextStandupDay(fromIso) {
    var d = parseISO(fromIso);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() > 4);
    return isoOf(d);
  }
  function isStandupDay(iso) { var w = parseISO(iso).getDay(); return w >= 1 && w <= 4; }
  // END-DATE-HELPERS

  function fmtDate(iso) {
    return parseISO(iso).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function leaderOn(iso) {
    return standups.filter(function (r) { return r.date === iso; })[0];
  }
  function esc(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || "Error");
        return data;
      });
    });
  }

  function entries() {
    return members.filter(function (m) { return !excluded[m.id]; });
  }

  function draw() {
    var list = entries();
    var W = canvas.width, C = W / 2, R = C - 40;
    ctx.clearRect(0, 0, W, W);

    if (list.length === 0) {
      ctx.fillStyle = "#3a2c26";
      ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#b39f93"; ctx.font = "700 40px Quicksand"; ctx.textAlign = "center";
      ctx.fillText("Add people to the team", C, C);
      return;
    }

    var seg = (Math.PI * 2) / list.length;
    for (var i = 0; i < list.length; i++) {
      var start = rotation + i * seg;
      var color = COLORS[i % COLORS.length];
      // Avoid two equal colors next to each other when the wheel wraps around.
      if (i === list.length - 1 && i % COLORS.length === 0 && i > 0) color = COLORS[2];
      ctx.beginPath();
      ctx.moveTo(C, C);
      ctx.arc(C, C, R, start, start + seg);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.15)"; ctx.lineWidth = 2; ctx.stroke();

      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(start + seg / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = DARK_TEXT[color] ? "#2a1a12" : "#fff3ea";
      var size = Math.max(18, Math.min(44, 520 / list.length + 14));
      ctx.font = "500 " + size + "px Quicksand";
      var label = list[i].name;
      var maxW = R - 140;
      while (ctx.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -2);
      if (label !== list[i].name) label = label + "…";
      ctx.fillText(label, R - 30, 0);
      ctx.restore();
    }

    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2);
    ctx.lineWidth = 10; ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.stroke();

    ctx.beginPath(); ctx.arc(C, C, R * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();

    // Pointer on the right side, like the inspiration wheel.
    ctx.beginPath();
    ctx.moveTo(C + R - 18, C);
    ctx.lineTo(C + R + 38, C - 30);
    ctx.lineTo(C + R + 38, C + 30);
    ctx.closePath();
    ctx.fillStyle = "#e0301e"; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "#7a160c"; ctx.stroke();
  }

  function spin() {
    var list = entries();
    if (spinning || list.length === 0) return;
    if (!dateInput.value) { showErr("Pick a date to spin for."); return; }
    spinning = true;
    var winnerIdx = Math.floor(Math.random() * list.length);
    var seg = (Math.PI * 2) / list.length;
    // Segment centre must end at angle 0 (the pointer). Add jitter inside the segment.
    var jitter = (Math.random() - 0.5) * seg * 0.7;
    var target = -(winnerIdx + 0.5) * seg + jitter;
    var TAU = Math.PI * 2;
    var base = rotation - (((rotation - target) % TAU) + TAU) % TAU;
    var end = base + TAU * (6 + Math.floor(Math.random() * 3));
    if (end <= rotation) end += TAU;
    var from = rotation, dur = 5200, t0 = performance.now();

    function frame(now) {
      var t = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - t, 4);
      rotation = from + (end - from) * e;
      draw();
      if (t < 1) { requestAnimationFrame(frame); return; }
      rotation = rotation % TAU;
      spinning = false;
      choose(list[winnerIdx]);
    }
    requestAnimationFrame(frame);
  }

  function save(date, member) {
    return api("POST", "/api/standups", { date: date, member_id: member.id }).then(refresh);
  }

  function choose(member) {
    var date = dateInput.value;
    var current = leaderOn(date);
    var conflict = current && current.member_id !== member.id;
    document.getElementById("winnerWhen").textContent = "Standup leader for " + fmtDate(date);
    document.getElementById("winnerName").textContent = member.name;
    var note = document.getElementById("winnerReplace");
    note.hidden = !conflict;
    document.getElementById("keepBtn").hidden = !!conflict;
    document.getElementById("replaceBtn").hidden = !conflict;
    document.getElementById("cancelBtn").hidden = !conflict;
    if (conflict) {
      // Never overwrite a saved leader without an explicit confirmation.
      note.textContent = current.name + " already leads this standup. Replace?";
      document.getElementById("cancelBtn").textContent = "Keep " + current.name;
      pending = { date: date, member: member };
      document.getElementById("winner").showModal();
      return;
    }
    pending = null;
    save(date, member)
      .then(function () { document.getElementById("winner").showModal(); })
      .catch(function (e) { showErr(e.message); });
  }

  function renderSpinStatus() {
    var el = document.getElementById("spinStatus");
    var date = dateInput.value;
    if (!date) { el.className = "spin-status warn"; el.textContent = "Pick a date."; return; }
    var current = leaderOn(date);
    var warn = !isStandupDay(date);
    el.className = "spin-status" + (warn ? " warn" : "");
    var parts = [];
    if (warn) parts.push("Heads up: " + fmtDate(date) + " is not a standup day (Mon–Thu).");
    parts.push(current ? current.name + " already leads " + fmtDate(date) + "." : "No leader yet for " + fmtDate(date) + ".");
    el.textContent = parts.join(" ");
  }

  function undoBtn(date) {
    return '<button class="x" data-undo="' + date + '" title="Delete record">✕</button>';
  }

  function renderNext() {
    var today = todayISO();
    var future = standups.filter(function (r) { return r.date > today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var el = document.getElementById("nextLeader");
    if (future.length === 0) {
      el.innerHTML = '<div class="who">Not picked yet</div>' +
        '<div class="when">Spin for ' + fmtDate(nextStandupDay(today)) + '</div>';
      return;
    }
    var html = '<div class="top"><div><div class="who">' + esc(future[0].name) + '</div>' +
      '<div class="when">' + fmtDate(future[0].date) + '</div></div>' +
      undoBtn(future[0].date) + '</div>';
    if (future.length > 1) {
      html += '<div class="also">' + future.slice(1, 5).map(function (r) {
        return '<div><span class="n">' + esc(r.name) + '</span><span>' + fmtDate(r.date) + '</span>' +
          undoBtn(r.date) + '</div>';
      }).join("") + '</div>';
    }
    el.innerHTML = html;
  }

  function showErr(msg) {
    var el = document.getElementById("err");
    el.textContent = msg || "";
    if (msg) setTimeout(function () { el.textContent = ""; }, 4000);
  }

  function renderMembers() {
    document.getElementById("count").textContent = members.length;
    var ul = document.getElementById("members");
    ul.innerHTML = members.map(function (m) {
      var meta = m.led_count > 0
        ? m.led_count + "× · last " + fmtDate(m.last_led)
        : "never led";
      return '<li class="' + (excluded[m.id] ? "off" : "") + '">' +
        '<input type="checkbox" data-id="' + m.id + '"' + (excluded[m.id] ? "" : " checked") + ' title="Include in the wheel">' +
        '<span class="name">' + esc(m.name) + '<br><span class="meta">' + meta + '</span></span>' +
        '<button class="x" data-del="' + m.id + '" title="Remove from team">✕</button></li>';
    }).join("");
  }

  function renderHistory(all) {
    var rows = all.filter(function (r) { return r.date <= todayISO(); });
    var ul = document.getElementById("history");
    if (rows.length === 0) { ul.innerHTML = '<li class="meta">No records yet.</li>'; }
    else {
      ul.innerHTML = rows.map(function (r) {
        return '<li><span class="name">' + esc(r.name) + '</span>' +
          '<span class="meta">' + fmtDate(r.date) + '</span>' +
          '<button class="x" data-undo="' + r.date + '" title="Delete record">✕</button></li>';
      }).join("");
    }
    var today = leaderOn(todayISO());
    document.getElementById("today").innerHTML = today
      ? "Today's leader: <b>" + esc(today.name) + "</b>"
      : "No leader picked for today yet.";
  }

  function refresh() {
    return Promise.all([api("GET", "/api/members"), api("GET", "/api/standups?limit=60")])
      .then(function (res) {
        members = res[0];
        standups = res[1];
        renderMembers();
        renderHistory(standups);
        renderNext();
        renderSpinStatus();
        draw();
      })
      .catch(function (e) { showErr(e.message); });
  }

  document.getElementById("addForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var input = document.getElementById("newName");
    var name = input.value.trim();
    if (!name) return;
    api("POST", "/api/members", { name: name })
      .then(function () { input.value = ""; return refresh(); })
      .catch(function (e) { showErr(e.message); });
  });

  document.getElementById("members").addEventListener("click", function (ev) {
    var del = ev.target.getAttribute("data-del");
    if (del) {
      var m = members.filter(function (x) { return String(x.id) === del; })[0];
      if (!m || !confirm("Remove " + m.name + " from the team? Their history is kept.")) return;
      api("DELETE", "/api/members/" + del).then(refresh).catch(function (e) { showErr(e.message); });
      return;
    }
    var id = ev.target.getAttribute("data-id");
    if (id) {
      if (ev.target.checked) delete excluded[id]; else excluded[id] = true;
      renderMembers();
      draw();
    }
  });

  function onUndoClick(ev) {
    var date = ev.target.getAttribute("data-undo");
    if (!date) return;
    var r = leaderOn(date);
    var who = r ? r.name + " for " : "the record for ";
    if (!confirm("Delete " + who + fmtDate(date) + "?")) return;
    api("DELETE", "/api/standups/" + date).then(refresh).catch(function (e) { showErr(e.message); });
  }
  document.getElementById("history").addEventListener("click", onUndoClick);
  document.getElementById("nextLeader").addEventListener("click", onUndoClick);

  canvas.addEventListener("click", spin);
  document.addEventListener("keydown", function (ev) {
    if (ev.ctrlKey && ev.key === "Enter") spin();
  });
  document.getElementById("keepBtn").addEventListener("click", function () {
    document.getElementById("winner").close();
  });
  document.getElementById("replaceBtn").addEventListener("click", function () {
    var p = pending;
    pending = null;
    document.getElementById("winner").close();
    if (p) save(p.date, p.member).catch(function (e) { showErr(e.message); });
  });
  document.getElementById("cancelBtn").addEventListener("click", function () {
    pending = null;
    document.getElementById("winner").close();
  });
  dateInput.addEventListener("change", renderSpinStatus);
  document.getElementById("nextDayBtn").addEventListener("click", function () {
    dateInput.value = nextStandupDay(todayISO());
    renderSpinStatus();
  });
  document.getElementById("respinBtn").addEventListener("click", function () {
    pending = null;
    document.getElementById("winner").close();
    spin();
  });

  // The team spins at the end of a standup, so default to the next standup day.
  dateInput.value = nextStandupDay(todayISO());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  refresh();
})();
</script>
</body>
</html>`;
