/* ============================================================
   Second Brain Builder — shared core
   ------------------------------------------------------------
   Every seat page (/erica/, /katie/, …) defines window.SEAT
   BEFORE loading this file, then this file runs the wizard.

   SEAT = {
     key:        localStorage key, unique per seat
     password:   gate word (a curtain, not a lock — visible in source)
     name:       default name
     titles:     [step titles] — length must match .step count
     blank:      default state object
     blueprint:  (P, S, H) => void      // emits the seat's BLUEPRINT.md
     summary:    (S, H) => htmlString   // the recap card on the last step
     afterBuild: (S, H) => void         // optional: patch seat-specific DOM
   }

   H (helpers) is passed to seat functions and also exposed as window.H.
   H.BP holds the blueprint fragments that are identical for every seat —
   the parts that survived two years of the real system, so they are
   written once here rather than copied per person.
   ============================================================ */
(function () {
  const SEAT = window.SEAT;
  if (!SEAT) { console.error('No SEAT config — the seat page must define window.SEAT before core.js'); return; }

  /* ================== gate ================== */
  const gate = document.getElementById('gate'), app = document.getElementById('app');
  const pw = document.getElementById('pw'), gerr = document.getElementById('gerr');
  const SESSION_KEY = SEAT.key + '_in';
  function unlock() { gate.style.display = 'none'; app.classList.add('on'); sessionStorage.setItem(SESSION_KEY, '1'); }
  if (sessionStorage.getItem(SESSION_KEY) === '1') unlock();
  pw.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (pw.value.trim().toLowerCase() === SEAT.password) { unlock(); }
    else { gerr.textContent = 'Not it — try again'; pw.value = ''; }
  });
  setTimeout(() => { if (gate.style.display !== 'none') pw.focus(); }, 250);

  /* ================== state ================== */
  const BLANK = SEAT.blank;
  let S = Object.assign({}, JSON.parse(JSON.stringify(BLANK)));
  try { const raw = localStorage.getItem(SEAT.key); if (raw) S = Object.assign({}, JSON.parse(JSON.stringify(BLANK)), JSON.parse(raw)); } catch (e) { }
  const save = () => { try { localStorage.setItem(SEAT.key, JSON.stringify(S)); } catch (e) { } };

  /* ================== helpers ================== */
  const slug = t => t.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-+$/g, "").replace(/-+/g, "-").slice(0, 42);
  const H = {
    S, save, slug,
    V: () => (S.vault || "").trim() || "brain",
    NAME: () => (S.name || "").trim() || SEAT.name,
    STAR: () => (S.star === "__custom" ? ((S.starCustom || "").trim() || "Persistence") : S.star),
    STARLINE: () => (S.starLine || "").trim() || "",
    on: listKey => (S[listKey] || []).filter(x => x.on).map(x => x.t),
    has: (k, v) => (S[k] || []).includes(v)
  };
  window.H = H;

  /* ================== steps / rail ================== */
  const steps = [...document.querySelectorAll('.step')];
  const rail = document.getElementById('railsteps');
  const LAST = steps.length - 1;
  let cur = 0, maxSeen = 0;
  rail.innerHTML = SEAT.titles.map((t, i) => `<li data-jump="${i}"><span class="n">${i}</span><span class="t">${t}</span></li>`).join('');
  function go(n) {
    cur = Math.max(0, Math.min(LAST, n)); maxSeen = Math.max(maxSeen, cur);
    steps.forEach(s => s.classList.toggle('on', +s.dataset.step === cur));
    [...rail.children].forEach((li, i) => { li.classList.toggle('on', i === cur); li.classList.toggle('done', i < maxSeen || i < cur); });
    document.querySelectorAll('.stepcount').forEach(el => el.textContent = `${cur + 1} / ${steps.length}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (cur === LAST) buildBlueprint();
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { go(+g.dataset.go); return; }
    const j = e.target.closest('[data-jump]'); if (j) { go(+j.dataset.jump); return; }
  });
  const resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (!confirm('Clear every answer and start again?')) return;
    localStorage.removeItem(SEAT.key); location.reload();
  });

  /* ================== bindings ================== */
  document.querySelectorAll('[data-k]').forEach(el => {
    el.value = S[el.dataset.k] || "";
    el.addEventListener('input', () => { S[el.dataset.k] = el.value; save(); syncCond(); });
  });
  document.querySelectorAll('[data-radio]').forEach(grp => {
    const key = grp.dataset.radio;
    grp.querySelectorAll('.opt').forEach(opt => {
      const inp = opt.querySelector('input');
      opt.addEventListener('click', e => { e.preventDefault(); S[key] = inp.value; save(); paintRadio(grp, key); syncCond(); });
    });
    paintRadio(grp, key);
  });
  function paintRadio(grp, key) { grp.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o.querySelector('input').value === S[key])); }
  document.querySelectorAll('[data-check]').forEach(grp => {
    const key = grp.dataset.check;
    grp.querySelectorAll('.opt').forEach(opt => {
      const inp = opt.querySelector('input');
      opt.addEventListener('click', e => {
        e.preventDefault();
        const v = inp.value, i = S[key].indexOf(v);
        if (i > -1) S[key].splice(i, 1); else S[key].push(v);
        save(); paintCheck(grp, key);
      });
    });
    paintCheck(grp, key);
  });
  function paintCheck(grp, key) { grp.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', S[key].includes(o.querySelector('input').value))); }
  function syncCond() {
    document.querySelectorAll('[data-showif]').forEach(el => {
      const [k, v] = el.dataset.showif.split('=');
      el.style.display = (S[k] === v) ? 'block' : 'none';
    });
  }
  syncCond();

  /* ================== chips ==================
     Any element with data-chips="stateKey" gets a chip editor.
     It expects a sibling input[data-chip-add] and button[data-chip-btn]
     carrying the same key. Each chip may hold an optional note (why it
     is in the list) shown under the label.                              */
  document.querySelectorAll('[data-chips]').forEach(mount => {
    const listKey = mount.dataset.chips;
    function paint() {
      mount.innerHTML = (S[listKey] || []).map((it, i) =>
        `<span class="chip${it.on ? '' : ' off'}" data-i="${i}" title="${it.why ? String(it.why).replace(/"/g, '&quot;') : ''}"><span class="tog" style="cursor:pointer">${it.t}</span><span class="x" data-x="${i}">×</span></span>`).join('');
    }
    mount.addEventListener('click', e => {
      const x = e.target.closest('[data-x]');
      if (x) { S[listKey].splice(+x.dataset.x, 1); save(); paint(); return; }
      const c = e.target.closest('.chip');
      if (c) { const i = +c.dataset.i; S[listKey][i].on = !S[listKey][i].on; save(); paint(); }
    });
    const inp = document.querySelector(`[data-chip-add="${listKey}"]`);
    const btn = document.querySelector(`[data-chip-btn="${listKey}"]`);
    const why = document.querySelector(`[data-chip-why="${listKey}"]`);
    const add = () => {
      const v = inp.value.trim(); if (!v) return;
      const w = why ? why.value.trim() : "";
      S[listKey].push({ t: v, on: true, why: w });
      inp.value = ''; if (why) why.value = '';
      save(); paint();
    };
    if (btn) btn.addEventListener('click', add);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    paint();
  });

  /* ================== shared blueprint fragments ==================
     Written once. These are the parts that are the same for every
     person, because they are the parts of the real system that worked. */
  H.BP = {
    hardRules(P) {
      P(`## How you work with me — hard rules`);
      P(`1. **One question at a time.** Never a numbered list of questions. Ask, wait, apply my answer, then ask the next.`);
      P(`2. **Suggest, wait, act.** Propose what you think should happen and why, then wait for my yes. Never write to a file, and never change one, without me agreeing in that exchange.`);
      P(`3. **Never invent facts about my work.** If you do not know, say you do not know and ask. A confident wrong answer is worse than no answer.`);
      P(`4. **Nothing is silently dropped.** If you cannot work out where something belongs, leave it where it is and tell me. Never bury it.`);
      P(`5. **Write for retrieval, not for looks.** These files exist so you can answer questions later. Dense and current beats pretty. Out-of-date is worse than empty.`);
      P(`6. **Plain language.** I am not a developer. No jargon, no filler, no flattery.`);
    },
    hotDiscipline(P) {
      P(`## hot.md discipline`);
      P(`Newest at the top. One block per session:`);
      P(``);
      P(`\`## YYYY-MM-DD [AM|PM|WEEK] | one sentence on what changed\``);
      P(``);
      P(`Under it, short bullets. Use ⭐ for something that matters, ⚠️ for a risk or something unresolved, ✅ for done, 📌 for a standing rule. Bold the claim, link the evidence.`);
      P(`Keep the file under about 200 lines. When it grows past that, move the closed weeks into \`recaps/weekly/\` rather than deleting them.`);
    },
    grillEngine(P, n, priorities, examples) {
      P('```markdown');
      P(`# Grill engine`);
      P(``);
      P(`Shared behaviour for every routine. Read this before running any of them.`);
      P(``);
      P(`## The point`);
      P(`Interview ${n} properly. Surface what the files cannot show. Challenge the claims made against what is already written down. Update the target file as answers arrive — not at the end.`);
      P(``);
      P(`## One question at a time`);
      P(`Strict. Ask one. Wait. Apply the answer to the file. Then the next. Never list several questions and wait.`);
      P(``);
      P(`## Question shape`);
      P(`Lead with what you know and what you think it means, then land the question at the end. Two to four sentences. Do not add a "recommended answer" line — fold your read into how you ask.`);
      P(``);
      P(`Good: "${examples.good}"`);
      P(``);
      P(`Weak: "${examples.weak}"`);
      P(``);
      P(`## What to grill about, best first`);
      priorities.forEach((p, i) => P(`${i + 1}. ${p}`));
      P(``);
      P(`## Challenge, do not accept fog`);
      P(`Sharpen vague language every time: "when you say it is done — has it happened, or has it been agreed to happen?" · "does 'following up' mean something exists, or that you intend to write one?"`);
      P(``);
      P(`## As answers arrive`);
      P(`Apply each answer to the file immediately, show me the one line you wrote, then move on. Never batch the writing to the end.`);
      P(``);
      P(`## Stop`);
      P(`When the gaps are closed, or I say stop / enough / done, or after **eight questions**. Hard cap. If gaps remain, list them at the bottom of the recap as open threads so they come back next time.`);
      P(``);
      P(`## Tone`);
      P(`Direct, warm, no filler. Not polite for the sake of it. The grill is the product — but never sour, and never sarcastic about work that has not been done.`);
      P('```');
    },
    saveCmd(P) {
      P(`### \`/save\` — file what just happened`);
      P(``);
      P(`I will run this after a conversation, a decision, or a messy thread. Read back through our conversation and pull out: decisions made · commitments made in either direction · new people · anything that changes the state of an area. Propose where each piece goes, wait for my yes, write it, and tell me in one line each what landed where.`);
    },
    templates(P, extra) {
      P(`Short files in \`templates/\`. Sections only — do not pad them:`);
      P(``);
      P(`- \`project.md\` — what it is · why it matters · who owns what · key dates · current state · next actions · decisions`);
      P(`- \`meeting.md\` — who · what it was for · what was decided · who owes what by when · what I need to do next`);
      P(`- \`recap.md\` — what happened · decisions · commitments made or received · what is stuck · what is next`);
      P(`- \`note.md\` — what this is · the content · what it relates to`);
      (extra || []).forEach(l => P(`- ${l}`));
    },
    finallyBlock(P, lines) {
      P(`## Finally`);
      P(``);
      lines.forEach((l, i) => P(`${i + 1}. ${l}`));
      P(``);
      P(`Do not add features I have not asked for. If you think something is missing, say so in one line at the end — do not build it.`);
    }
  };

  /* ================== build + deliver ================== */
  function buildBlueprint() {
    const L = [];
    const P = s => L.push(s);
    SEAT.blueprint(P, S, H);
    const md = L.join("\n");
    document.getElementById('bptext').textContent = md;
    document.getElementById('bplen').textContent = `${md.split("\n").length} lines`;
    window.__bp = md;
    const sum = document.getElementById('summary');
    if (sum && SEAT.summary) sum.innerHTML = SEAT.summary(S, H);
    if (SEAT.afterBuild) SEAT.afterBuild(S, H);
  }

  function flash(t) { const el = document.getElementById('dlok'); el.textContent = t; setTimeout(() => { if (el.textContent === t) el.textContent = ''; }, 4000); }
  document.getElementById('dlbtn').addEventListener('click', () => {
    const b = new Blob([window.__bp || ""], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'BLUEPRINT.md'; a.click();
    URL.revokeObjectURL(a.href);
    flash('Downloaded — now drag it into your brain folder');
  });
  document.getElementById('cpbtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(window.__bp || ""); flash('Copied'); }
    catch (e) { flash('Copy failed — use download'); }
  });

  go(0);
})();
