/*!
 * p5.brush.skeleton
 *
 * Sketched generated interfaces: a bento grid of UI cards drawn in pencil and
 * filled with watercolor washes, hatching, charts, forms, tables, avatars,
 * toggles and buttons. Built on p5.js 2.x and p5.brush 2.x, nothing else.
 *
 * Load after p5.js and p5.brush. Exposes a single global: `skeleton`.
 *
 * Usage (p5 global mode, WEBGL canvas):
 *
 *   function setup() {
 *     createCanvas(1106, 1280, WEBGL);
 *     background("#f7f8f5");
 *     translate(-width / 2, -height / 2);
 *     randomSeed(1);
 *     brush.scaleBrushes(2.2);
 *     skeleton.render({ cols: 7, rows: 9 });
 *   }
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  const defaults = {
    // Canvas area to fill. Defaults to the p5 canvas size.
    width: null,
    height: null,
    x: 0,
    y: 0,

    // Grid. `cols` and `rows` are counts or arrays of relative weights, so
    // `rows: [1, 1, 1.6, 1, 1]` gives a taller middle row.
    cols: 7,
    rows: 9,
    gutter: 26,

    // Probability that a cell grows into a 2x1, 1x2 or 2x2 block.
    spans: { wide: 0.24, tall: 0.14, big: 0.08 },

    // Grid regions to keep for something else (a wordmark, a photo). Given in
    // grid units: { col, row, spanC, spanR, kind }. Each becomes one cell drawn
    // with `kind` (default "ghost"). Use kind: null to leave the paper bare.
    reserve: [],

    // Which components to draw, sampled uniformly. Repeat a name to weight it.
    kinds: [
      "wash", "wash", "hatch",
      "text", "avatar", "button", "bars", "line", "toggle",
      "kpi", "input", "tabs", "progress", "list", "chips", "slider", "pie", "image", "table", "calendar",
    ],

    // Optional (cell, opts) => kind, overriding `kinds` sampling.
    pick: null,

    // Colors.
    palette: ["#386769", "#d8785e", "#8ea47a", "#e3c58a", "#7d93a3"],
    ink: "#2f4f52",
    muted: "#a3b0ae",
    ghost: "#c3cfcc",
    dot: "#b9c5c2",
    lift: "#ffffff",

    // Hand-drawn feel.
    tilt: 1.8,      // max card rotation, degrees
    jitter: 3,      // corner jitter, canvas units
    offset: 5,      // card centre jitter, canvas units
    wiggle: 1.2,    // brush.wiggle() strength while drawing (0 disables)
    pad: 18,        // inner padding of card content
    tintChance: 0.55, // chance a wireframe card gets a faint color wash

    // Pencil dot grid behind everything. 0 disables.
    dots: 46,

    // Brush names, so the whole look can be re-tooled.
    brushes: {
      outline: "2B",
      ghost: "2H",
      line: "HB",
      marker: "marker",
      dot: "2H",
      hatch: "HB",
    },
  };

  function merge(opts) {
    const out = Object.assign({}, defaults, opts || {});
    out.spans = Object.assign({}, defaults.spans, (opts && opts.spans) || {});
    out.brushes = Object.assign({}, defaults.brushes, (opts && opts.brushes) || {});
    if (out.width == null) out.width = root.width;
    if (out.height == null) out.height = root.height;
    return out;
  }

  // ---------------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------------

  /** Angles in the current p5 angleMode, for brush.hatch(). */
  function deg(a) {
    return root.angleMode() === root.DEGREES ? a : root.radians(a);
  }

  /** Corner points of a rectangle centred at (x, y), rotated and jittered. */
  function rectPoints(x, y, w, h, angle, jitter) {
    angle = angle || 0;
    jitter = jitter || 0;
    const cs = Math.cos(angle), sn = Math.sin(angle);
    const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    return corners.map(([px, py]) => {
      const jx = root.random(-jitter, jitter), jy = root.random(-jitter, jitter);
      return [x + (px + jx) * cs - (py + jy) * sn, y + (px + jx) * sn + (py + jy) * cs];
    });
  }

  /** Slightly irregular circle as a polygon. */
  function circlePoints(cx, cy, r, n, wobble) {
    n = n || 24;
    wobble = wobble == null ? 0.04 : wobble;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const rr = r * root.random(1 - wobble, 1 + wobble);
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    return pts;
  }

  /** Points along an arc from angle a0 to a1 (radians). */
  function arcPoints(cx, cy, r, a0, a1, n) {
    n = n || 16;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }

  /** Content box of a card after padding: { left, top, cw, ch }. */
  function inner(cell, opts) {
    const pad = opts.pad;
    return {
      left: cell.x - cell.w / 2 + pad,
      top: cell.y - cell.h / 2 + pad,
      cw: cell.w - 2 * pad,
      ch: cell.h - 2 * pad,
    };
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers. Each leaves stroke, fill and hatch disabled.
  // ---------------------------------------------------------------------------

  /** Watercolor fill of a polygon. */
  function wash(pts, color, opacity, bleed, texture, scatter) {
    brush.noStroke();
    brush.fill(color, opacity == null ? 140 : opacity);
    brush.fillBleed(bleed == null ? 0.08 : bleed, "out");
    brush.fillTexture(texture == null ? 0.5 : texture, 0.35, scatter !== false);
    brush.polygon(pts);
    brush.noFill();
  }

  /** Pencil outline of a polygon, optionally over a faint color wash. */
  function outline(pts, opts, weight, tint) {
    if (tint) wash(pts, tint, 42, 0.05, 0.35, false);
    brush.noFill();
    brush.set(opts.brushes.outline, opts.ink, weight == null ? 0.95 : weight);
    brush.polygon(pts);
    brush.noStroke();
  }

  /** Placeholder text: n horizontal pencil lines of random length. */
  function lines(x, y, w, h, opts, n, color) {
    n = Math.max(1, n || 2);
    const gap = h / (n + 1);
    brush.set(opts.brushes.line, color || opts.muted, 1.1);
    for (let i = 1; i <= n; i++) {
      const len = w * root.random(0.5, 0.92);
      const y0 = y - h / 2 + gap * i;
      brush.line(x - w / 2, y0, x - w / 2 + len, y0);
    }
    brush.noStroke();
  }

  /** Solid pill / small block used for buttons, toggles and bars. */
  function pill(x, y, w, h, angle, color, opacity) {
    wash(rectPoints(x, y, w, h, angle, 1.5), color, opacity == null ? 180 : opacity, 0.05, 0.4, false);
  }

  /** Thin pencil rectangle: input fields, image frames, checkboxes. */
  function frame(x, y, w, h, angle, opts, color, weight) {
    brush.noFill();
    brush.set(opts.brushes.line, color || opts.ink, weight == null ? 0.8 : weight);
    brush.polygon(rectPoints(x, y, w, h, angle, 1));
    brush.noStroke();
  }

  /** Faint color tint or null, per `tintChance`. */
  function maybeTint(cell, opts) {
    return root.random() < opts.tintChance ? cell.color : null;
  }

  /** Palette colors other than the card's own. */
  function others(cell, opts) {
    return opts.palette.filter((c) => c !== cell.color);
  }

  const helpers = { deg, rectPoints, circlePoints, arcPoints, inner, wash, outline, lines, pill, frame, maybeTint, others };

  // ---------------------------------------------------------------------------
  // Components. Signature: (cell, opts, helpers). `cell.pts` holds the card
  // corner polygon; `cell.color` is the accent color for this card.
  // ---------------------------------------------------------------------------

  const components = {};

  /** Faint outline only: what sits under a wordmark. */
  components.ghost = function (cell, opts) {
    brush.noFill();
    brush.set(opts.brushes.ghost, opts.ghost, 0.9);
    brush.polygon(cell.pts);
    brush.noStroke();
  };

  /** Bare paper. */
  components.blank = function () { };

  /** Lifted white panel with a pencil outline, for overlaid content. */
  components.panel = function (cell, opts) {
    wash(cell.pts, opts.lift, 120, 0.05, 0.3, false);
    outline(cell.pts, opts, 0.95);
  };

  /** Solid watercolor card. */
  components.wash = function (cell, opts) {
    wash(cell.pts, cell.color, root.random(120, 165), root.random(0.07, 0.13), 0.62, true);
    outline(cell.pts, opts, 0.9);
  };

  /** Diagonally hatched card. */
  components.hatch = function (cell, opts) {
    brush.noFill();
    brush.hatch(root.random(10, 16), deg(root.random([45, 135])), { rand: 0.15, continuous: false, gradient: 0.3 });
    brush.hatchStyle(opts.brushes.hatch, cell.color, 1);
    brush.set(opts.brushes.outline, opts.ink, 0.9);
    brush.polygon(cell.pts);
    brush.noHatch();
    brush.noStroke();
  };

  /** Title bar plus body copy. */
  components.text = function (cell, opts) {
    const { x, y, w, h, color, pts } = cell;
    const pad = opts.pad;
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    brush.set(opts.brushes.marker, color, 1);
    brush.line(x - w / 2 + pad, y - h / 2 + pad + 4, x - w / 2 + pad + w * root.random(0.3, 0.5), y - h / 2 + pad + 4);
    brush.noStroke();
    lines(x, y + 14, w - 2 * pad, h - 2 * pad - 20, opts, Math.max(2, Math.floor((h - 60) / 24)));
  };

  /** Avatar circle with two lines of text. */
  components.avatar = function (cell, opts) {
    const { x, y, w, h, color, pts } = cell;
    const pad = opts.pad;
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const r = Math.min(w, h) * 0.16;
    wash(circlePoints(x - w / 2 + pad + r, y, r, 24), color, 170, 0.06, 0.4, false);
    lines(x + r + 4, y, w - 2 * pad - 2 * r - 12, h * 0.45, opts, 2);
  };

  /** Two lines of text and a primary button. */
  components.button = function (cell, opts) {
    const { x, y, w, h, color, angle, pts } = cell;
    const pad = opts.pad;
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    lines(x, y - h * 0.12, w - 2 * pad, h * 0.3, opts, 2);
    const bw = Math.min(w * 0.5, 110), bh = 34;
    pill(x - w / 2 + pad + bw / 2, y + h / 2 - pad - bh / 2, bw, bh, angle, color, 185);
  };

  /** Bar chart. */
  components.bars = function (cell, opts) {
    const { x, y, w, h, color, angle, pts } = cell;
    const pad = opts.pad;
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const n = 4 + Math.floor(root.random(3));
    const bw = (w - 2 * pad) / n;
    const alt = opts.palette[opts.palette.length - 1];
    for (let i = 0; i < n; i++) {
      const bh = root.random(0.3, 0.9) * (h - 2 * pad);
      pill(x - w / 2 + pad + bw * (i + 0.5), y + h / 2 - pad - bh / 2, bw * 0.55, bh, angle,
        i % 2 === 0 ? color : alt, root.random(130, 175));
    }
  };

  /** Sparkline. */
  components.line = function (cell, opts) {
    const { x, y, w, h, color, pts } = cell;
    const pad = opts.pad;
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const n = 7;
    const path = [];
    for (let i = 0; i < n; i++) {
      path.push([x - w / 2 + pad + ((w - 2 * pad) * i) / (n - 1), y + h / 2 - pad - root.random(0.1, 0.9) * (h - 2 * pad)]);
    }
    brush.set(opts.brushes.marker, color, 1.1);
    brush.spline(path, 0.6);
    brush.noStroke();
  };

  /** Rows of toggle switches with labels. */
  components.toggle = function (cell, opts) {
    const { x, y, w, h, color, angle, pts } = cell;
    const pad = opts.pad;
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const rows = Math.max(2, Math.floor((h - 2 * pad) / 38));
    const gap = (h - 2 * pad) / rows;
    for (let i = 0; i < rows; i++) {
      const yy = y - h / 2 + pad + gap * (i + 0.5);
      const on = root.random() < 0.6;
      pill(x - w / 2 + pad + 22, yy, 44, 22, angle, on ? color : opts.ghost, on ? 180 : 160);
      brush.set(opts.brushes.line, opts.muted, 1.1);
      brush.line(x - w / 2 + pad + 58, yy, x - w / 2 + pad + 58 + (w - 2 * pad - 60) * root.random(0.5, 1), yy);
      brush.noStroke();
    }
  };

  /** Sparkline through a box, drawn with the marker. */
  function sparkline(x, y, w, h, color, opts) {
    const n = 8, path = [];
    for (let i = 0; i < n; i++) {
      path.push([x + (w * i) / (n - 1), y + h - root.random(0.1, 0.9) * h]);
    }
    brush.set(opts.brushes.marker, color, 1);
    brush.spline(path, 0.6);
    brush.noStroke();
  }

  /** KPI tile: caption, big number block, change chip, footnote, trend. */
  components.kpi = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const wide = cw >= 180;
    const tw = wide ? cw * 0.5 : cw;
    lines(left + tw * 0.2, top + 6, tw * 0.4, 12, opts, 1);
    const bw = Math.min(tw * 0.55, 90);
    pill(left + bw / 2, top + 34, bw, 28, angle, color, 190);
    if (tw - bw >= 44) pill(left + bw + 22, top + 34, 26, 14, angle, root.random(others(cell, opts)), 150);
    lines(left + tw * 0.35, top + 64, tw * 0.7, 12, opts, 1);
    if (wide) sparkline(left + cw * 0.58, top + 8, cw * 0.42, ch - 16, color, opts);
    else if (ch >= 150) sparkline(left, top + 90, cw, ch - 90, color, opts);
  };

  /** Form: labelled input fields and a submit button. */
  components.input = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const pitch = 52;
    const n = Math.max(1, Math.floor((ch - 28) / pitch));
    for (let i = 0; i < n; i++) {
      const y0 = top + pitch * i;
      lines(left + cw * 0.2, y0 + 5, cw * 0.4, 10, opts, 1);
      frame(left + cw / 2, y0 + 28, cw, 26, angle, opts, opts.ink, 0.8);
      if (i === 0) lines(left + 8 + cw * 0.3, y0 + 28, cw * 0.6, 10, opts, 1);
    }
    const bw = Math.min(cw * 0.6, 80);
    pill(left + bw / 2, top + ch - 14, bw, 28, angle, color, 185);
  };

  /** Tab bar with one active tab, then body copy. */
  components.tabs = function (cell, opts) {
    const { color, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const n = cw > 180 ? 4 : 3;
    const tw = cw / n;
    const active = Math.floor(root.random(n));
    brush.set(opts.brushes.line, opts.ghost, 1);
    brush.line(left, top + 19, left + cw, top + 19);
    for (let i = 0; i < n; i++) {
      const x0 = left + tw * i + tw * 0.15;
      brush.set(opts.brushes.line, i === active ? opts.ink : opts.muted, 1.1);
      brush.line(x0, top + 6, x0 + tw * root.random(0.45, 0.7), top + 6);
    }
    brush.set(opts.brushes.marker, color, 1);
    brush.line(left + tw * active, top + 18, left + tw * (active + 1), top + 18);
    brush.noStroke();
    lines(left + cw / 2, top + 24 + (ch - 24) / 2, cw, ch - 24, opts, Math.max(2, Math.floor((ch - 24) / 24)));
  };

  /** Labelled progress bars. */
  components.progress = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const n = Math.max(1, Math.floor((ch + 10) / 42));
    const gap = ch / n;
    for (let i = 0; i < n; i++) {
      const y0 = top + gap * i + 8;
      lines(left + cw * 0.2, y0, cw * 0.4, 10, opts, 1);
      pill(left + cw / 2, y0 + 18, cw, 10, angle, opts.ghost, 110);
      const f = root.random(0.25, 0.9);
      pill(left + (cw * f) / 2, y0 + 18, cw * f, 10, angle, color, 190);
    }
  };

  /** Checklist: checked and unchecked boxes with labels. */
  components.list = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const n = Math.max(2, Math.floor(ch / 26));
    const gap = ch / n;
    for (let i = 0; i < n; i++) {
      const yy = top + gap * (i + 0.5);
      if (root.random() < 0.5) pill(left + 7, yy, 14, 14, angle, color, 190);
      else frame(left + 7, yy, 14, 14, angle, opts, opts.ink, 0.8);
      brush.set(opts.brushes.line, opts.muted, 1.1);
      brush.line(left + 26, yy, left + 26 + (cw - 26) * root.random(0.45, 1), yy);
      brush.noStroke();
    }
  };

  /** Rows of tag chips under a caption. */
  components.chips = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    lines(left + cw * 0.25, top + 5, cw * 0.5, 10, opts, 1);
    const alt = others(cell, opts);
    for (let yy = top + 28; yy + 9 <= top + ch; yy += 26) {
      for (let xx = left; ;) {
        const cwid = root.random(22, 46);
        if (xx + cwid > left + cw) break;
        const roll = root.random();
        if (roll < 0.3) frame(xx + cwid / 2, yy, cwid, 18, angle, opts, opts.ink, 0.8);
        else pill(xx + cwid / 2, yy, cwid, 18, angle, roll < 0.75 ? color : root.random(alt), 150);
        xx += cwid + 7;
      }
    }
  };

  /** Labelled range sliders. */
  components.slider = function (cell, opts) {
    const { color, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const n = Math.max(1, Math.floor((ch + 10) / 44));
    const gap = ch / n;
    for (let i = 0; i < n; i++) {
      const y0 = top + gap * i + 8;
      lines(left + cw * 0.2, y0, cw * 0.4, 10, opts, 1);
      const yy = y0 + 20, f = root.random(0.2, 0.85);
      brush.set(opts.brushes.line, opts.ghost, 1.2);
      brush.line(left, yy, left + cw, yy);
      brush.set(opts.brushes.marker, color, 1);
      brush.line(left, yy, left + cw * f, yy);
      brush.noStroke();
      wash(circlePoints(left + cw * f, yy, 7, 16), color, 200, 0.04, 0.3, false);
    }
  };

  /** Donut chart in three colors, with a legend when the card is wide. */
  components.pie = function (cell, opts) {
    const { color, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const r = Math.min(cw, ch) * 0.42, r0 = r * 0.5;
    const legend = cw - 2 * r >= 48;
    const cx = legend ? left + r + 4 : left + cw / 2, cy = top + ch / 2;
    const alt = others(cell, opts);
    const cols = [color, alt[0], alt[alt.length - 1]];
    const fr = [root.random(0.35, 0.55), root.random(0.2, 0.3)];
    fr.push(1 - fr[0] - fr[1]);
    let a = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const a1 = a + fr[i] * Math.PI * 2, g = 0.05;
      wash(arcPoints(cx, cy, r, a + g, a1 - g, 14).concat(arcPoints(cx, cy, r0, a1 - g, a + g, 8)), cols[i], 165, 0.05, 0.4, false);
      a = a1;
    }
    if (legend) {
      for (let i = 0; i < 3; i++) {
        const yy = cy - 22 + 22 * i, x0 = cx + r + 28;
        pill(cx + r + 16, yy, 10, 10, 0, cols[i], 180);
        brush.set(opts.brushes.line, opts.muted, 1.1);
        brush.line(x0, yy, x0 + (left + cw - x0) * root.random(0.5, 0.9), yy);
        brush.noStroke();
      }
    }
  };

  /** Image placeholder: framed area with a sun and hills, caption if tall. */
  components.image = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const caption = ch > 140;
    const fh = caption ? ch * 0.65 : ch;
    const fx = left + cw / 2, fy = top + fh / 2;
    wash(rectPoints(fx, fy, cw, fh, angle, 1), opts.ghost, 60, 0.04, 0.3, false);
    frame(fx, fy, cw, fh, angle, opts, opts.ink, 0.8);
    wash(circlePoints(left + cw * 0.25, top + fh * 0.3, Math.min(cw, fh) * 0.09, 16), color, 170, 0.05, 0.3, false);
    const base = top + fh - 4;
    wash([
      [left + 4, base], [left + cw * 0.35, top + fh * 0.5], [left + cw * 0.55, top + fh * 0.75],
      [left + cw * 0.72, top + fh * 0.58], [left + cw - 4, base],
    ], color, 150, 0.05, 0.4, false);
    if (caption) lines(left + cw / 2, top + fh + (ch - fh) / 2, cw, ch - fh - 10, opts, 2);
  };

  /** Data table: tinted header row, rules, short cell text. */
  components.table = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    const rowH = 24;
    const n = Math.max(2, Math.floor(ch / rowH));
    const ncol = cw > 180 ? 4 : 3;
    const colW = cw / ncol;
    pill(left + cw / 2, top + rowH / 2, cw, rowH - 4, angle, color, 110);
    for (let r = 0; r < n; r++) {
      const yy = top + rowH * (r + 0.5);
      if (r > 0) {
        brush.set(opts.brushes.line, opts.ghost, 1);
        brush.line(left, top + rowH * r, left + cw, top + rowH * r);
      }
      brush.set(opts.brushes.line, r === 0 ? opts.ink : opts.muted, 1.1);
      for (let c = 0; c < ncol; c++) {
        const x0 = left + colW * c + 4;
        brush.line(x0, yy, x0 + (colW - 10) * root.random(0.4, 0.9), yy);
      }
    }
    brush.noStroke();
  };

  /** Calendar or heatmap: a month label over a grid of days, some marked. */
  components.calendar = function (cell, opts) {
    const { color, angle, pts } = cell;
    const { left, top, cw, ch } = inner(cell, opts);
    outline(pts, opts, 0.95, maybeTint(cell, opts));
    lines(left + cw * 0.25, top + 5, cw * 0.5, 10, opts, 1);
    const cols = 7, gridTop = top + 20, gridH = ch - 20;
    const sx = cw / cols;
    const rows = Math.max(3, Math.min(5, Math.floor(gridH / sx)));
    const sy = gridH / rows;
    const s = Math.min(sx, sy) * 0.55;
    const alt = others(cell, opts);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const xx = left + sx * (c + 0.5), yy = gridTop + sy * (r + 0.5);
        const roll = root.random();
        if (roll < 0.12) pill(xx, yy, s, s, angle, color, 185);
        else if (roll < 0.2) pill(xx, yy, s, s, angle, root.random(alt), 120);
        else pill(xx, yy, s * 0.8, s * 0.8, angle, opts.ghost, 70);
      }
    }
  };

  /** Add or replace a component. */
  function register(name, fn) {
    components[name] = fn;
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  /** Cumulative edges from a count or an array of weights, spanning `size`. */
  function edges(spec, size, origin) {
    const weights = Array.isArray(spec) ? spec : Array(spec).fill(1);
    const total = weights.reduce((a, b) => a + b, 0);
    const out = [origin];
    let acc = origin;
    for (const w of weights) {
      acc += (w / total) * size;
      out.push(acc);
    }
    return out;
  }

  /**
   * Bento layout. Returns cells: { x, y, w, h, col, row, spanC, spanR,
   * reserved, kind }. Cells that fall inside a reserved region are merged into
   * one reserved cell. Other cells may grow into 2x1, 1x2 or 2x2 blocks but
   * never into a reserved region.
   */
  function layout(options) {
    const opts = merge(options);
    const colEdges = edges(opts.cols, opts.width, opts.x);
    const rowEdges = edges(opts.rows, opts.height, opts.y);
    const cols = colEdges.length - 1;
    const rows = rowEdges.length - 1;
    const taken = Array.from({ length: rows }, () => Array(cols).fill(false));
    const cells = [];

    function make(c, r, spanC, spanR, extra) {
      for (let rr = 0; rr < spanR; rr++) for (let cc = 0; cc < spanC; cc++) taken[r + rr][c + cc] = true;
      const left = colEdges[c], right = colEdges[c + spanC];
      const top = rowEdges[r], bottom = rowEdges[r + spanR];
      cells.push(Object.assign({
        col: c, row: r, spanC, spanR,
        x: (left + right) / 2, y: (top + bottom) / 2,
        w: right - left - opts.gutter, h: bottom - top - opts.gutter,
        reserved: false, kind: null,
      }, extra));
    }

    for (const res of opts.reserve) {
      const spanC = Math.min(res.spanC || 1, cols - res.col);
      const spanR = Math.min(res.spanR || 1, rows - res.row);
      make(res.col, res.row, spanC, spanR, { reserved: true, kind: res.kind === undefined ? "ghost" : res.kind });
    }

    const free = (c, r) => c < cols && r < rows && !taken[r][c];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (taken[r][c]) continue;
        let spanC = 1, spanR = 1;
        const roll = root.random();
        const s = opts.spans;
        if (roll < s.wide && free(c + 1, r)) {
          spanC = 2;
        } else if (roll < s.wide + s.tall && free(c, r + 1)) {
          spanR = 2;
        } else if (roll < s.wide + s.tall + s.big && free(c + 1, r) && free(c, r + 1) && free(c + 1, r + 1)) {
          spanC = 2; spanR = 2;
        }
        make(c, r, spanC, spanR);
      }
    }
    return cells;
  }

  // ---------------------------------------------------------------------------
  // Assignment and drawing
  // ---------------------------------------------------------------------------

  /** Give every unreserved cell a kind, a color, a tilt and jittered corners. */
  function assign(cells, options) {
    const opts = merge(options);
    for (const cell of cells) {
      if (!cell.reserved) {
        cell.kind = opts.pick ? opts.pick(cell, opts) : root.random(opts.kinds);
      }
      if (cell.color == null) cell.color = root.random(opts.palette);
      if (cell.angle == null) cell.angle = (root.random(-opts.tilt, opts.tilt) * Math.PI) / 180;
      cell.x += root.random(-opts.offset, opts.offset);
      cell.y += root.random(-opts.offset, opts.offset);
      cell.pts = rectPoints(cell.x, cell.y, cell.w, cell.h, cell.angle, opts.jitter);
    }
    return cells;
  }

  /** Draw one card with its component. */
  function drawCard(cell, options) {
    const opts = merge(options);
    if (!cell.kind) return;
    const fn = components[cell.kind];
    if (!fn) throw new Error("skeleton: unknown component '" + cell.kind + "'");
    if (!cell.pts) cell.pts = rectPoints(cell.x, cell.y, cell.w, cell.h, cell.angle || 0, opts.jitter);
    fn(cell, opts, helpers);
    brush.noStroke();
    brush.noFill();
    brush.noHatch();
  }

  /** Pencil dot grid over the area. */
  function dots(options) {
    const opts = merge(options);
    const step = opts.dots;
    if (!step) return;
    brush.set(opts.brushes.dot, opts.dot, 1);
    for (let y = opts.y + step / 2; y < opts.y + opts.height; y += step) {
      for (let x = opts.x + step / 2; x < opts.x + opts.width; x += step) {
        brush.line(x, y, x + 1.5, y + 1.5);
      }
    }
    brush.noStroke();
  }

  /** Everything: dot grid, layout, assignment, drawing. Returns the cells. */
  function render(options) {
    const opts = merge(options);
    brush.noStroke();
    brush.noFill();
    brush.noHatch();
    dots(opts);
    const cells = assign(layout(opts), opts);
    if (opts.wiggle > 0) brush.wiggle(opts.wiggle);
    for (const cell of cells) drawCard(cell, opts);
    brush.noField();
    return cells;
  }

  root.skeleton = {
    version: "0.1.0",
    defaults,
    components,
    helpers,
    register,
    layout,
    assign,
    drawCard,
    dots,
    render,
  };
})(typeof window !== "undefined" ? window : globalThis);
