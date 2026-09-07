/*!
 * p5.brush.skeleton
 *
 * Sketched generated interfaces: a bento grid of UI cards drawn in pencil and
 * filled with watercolor washes, hatching, bars, sparklines, avatars, toggles
 * and buttons. Built on p5.js 2.x and p5.brush 2.x, nothing else.
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
    kinds: ["wash", "wash", "wash", "hatch", "hatch", "text", "avatar", "button", "bars", "line", "toggle"],

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

  /** Faint color tint or null, per `tintChance`. */
  function maybeTint(cell, opts) {
    return root.random() < opts.tintChance ? cell.color : null;
  }

  const helpers = { deg, rectPoints, circlePoints, wash, outline, lines, pill, maybeTint };

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
