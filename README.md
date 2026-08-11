# Second Brain Builder

Single-page wizards that reverse-engineer Trevor's second-brain system into a
`BLUEPRINT.md` — one instruction file the user pastes into Claude Code, which
then builds their vault (folders, CLAUDE.md, hot.md, grill engine, routines,
templates).

One build per person, each with its own password and its own contextualised
path. The landing page takes a first name and routes.

| Seat | Path | Built for |
|---|---|---|
| Erica | `/erica/` | Social Impact Administrator, ChildFund Rugby |
| Katie | `/katie/` | K1 Educator & Technology Integration Lead, ELC — ELC employee-brain pilot |

## Stack

Nothing. Static HTML, no build, no dependencies, no backend. Answers live in
`localStorage`; the blueprint is generated client-side. Design tokens from the
Trevor Cardozo design system; fonts from Google Fonts.

## Shape

```
index.html          landing — first name routes to a seat
core/core.css       design system + every component (shared)
core/core.js        gate · wizard state · bindings · chips · blueprint fragments
<seat>/index.html   that person's chapters + their SEAT config
```

**`core/` is the product; a seat is the personalisation.** Adding a person means
writing one `<seat>/index.html` and adding a line to `SEATS` in `index.html` —
no core changes. The core holds the parts that are the same for everyone because
they are the parts of the real system that survived: the hard rules, hot.md
discipline, the grill engine, `/save`, templates.

A seat page defines `window.SEAT` before loading `core.js`:

```js
window.SEAT = {
  key, password, name, titles,      // localStorage key, gate word, defaults
  blank,                            // default answer state
  blueprint(P, S, H) {},            // emits BLUEPRINT.md — P("line")
  summary(S, H) {},                 // recap card on the last step
  afterBuild(S, H) {}               // optional DOM touch-ups
};
```

`H` carries the helpers (`H.V()`, `H.NAME()`, `H.slug()`, `H.has()`, `H.on()`)
and `H.BP.*` — the shared blueprint fragments.

Wizard content is plain HTML, one `<section class="step">` per chapter. Inputs
bind by attribute: `data-k` (text), `data-radio` / `data-check` (choices),
`data-chips` + `data-chip-add` / `data-chip-btn` / `data-chip-why` (lists),
`data-showif="key=value"` (conditional).

## Passwords

Each seat sets its own in its `SEAT` block. **It is a curtain, not a lock** —
visible in page source by design. It keeps the page off casual eyes, nothing
more. Compared lowercased, so store it lowercase.

Nothing sensitive belongs in page source. Substance lives behind
access-controlled links (e.g. Katie's seed corpus is Google Docs in ELC Drive);
the page teaches shape and links out.

## Deploy

GitHub Pages, repo `Tr3v0r86/brain-builder`, branch `main`, folder `/`.
`CNAME` declares `brain.trevorcardozo.com`; Porkbun DNS has `CNAME brain →
tr3v0r86.github.io`. Enforce HTTPS is on.

## Local

```bash
python3 -m http.server 8765
```
