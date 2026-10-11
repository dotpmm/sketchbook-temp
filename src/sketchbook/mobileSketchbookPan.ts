/**
 * Mobile framing for the Singapore sketchbook.
 *
 * The authored page renders the open spread as DOM inside an iframe and fits
 * the whole spread to the viewport width, which makes each page tiny on
 * phones. On narrow viewports this layer widens the book so one page roughly
 * fills the viewport and lets a horizontal touch drag pan across the spread.
 *
 * Everything here is scoped to `(max-width: 640px)` — the breakpoint the
 * authored page already uses for its mobile rules — and touch pointers only.
 * Desktop (mouse/pen, wide viewports) keeps the authored behavior untouched.
 * The packaged HTML, assets, and ThreeUI sources are never modified; this
 * runs through the frame's `applyScene` seam and only appends one <style>
 * and a few listeners inside the live frame.
 */

const STYLE_ID = "meng-mobile-pan";

/**
 * One page (~half the spread) fills the viewport when the book is this wide
 * relative to the stage. Derived from the composition, not tuned per device.
 */
const BOOK_WIDTH_PCT = 175;

/** Touch slop before a press becomes a pan (px). Mirrors common touch slop. */
const TAP_SLOP = 10;

const MOBILE_QUERY = "(max-width: 640px)";

const MOBILE_CSS = `@media ${MOBILE_QUERY} {
  /* Left-align the widened book so the initial view is the left page;
     the stage clips the overflow into a pan viewport. */
  #sbStage {
    justify-content: flex-start;
    overflow: hidden;
  }
  #sbStage > #sb3d {
    flex: none;
    width: ${BOOK_WIDTH_PCT}%;
    max-width: none;
  }
}
/* Panning is direct manipulation (no transitions), so there is nothing
   to gate behind prefers-reduced-motion. Tap-to-turn reuses the authored
   arrow buttons, which already respect the page's reduced-motion path. */`;

type PanState = {
  pointerId: number;
  x0: number;
  y0: number;
  pan0: number;
  panning: boolean;
  scrolled: boolean;
};

function isMobile(win: Window | null): boolean {
  try {
    return !!win?.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MOBILE_CSS;
  doc.head.appendChild(style);
}

/** Clamp a pan offset so the book edges meet the stage edges, never beyond. */
function clampPan(stage: HTMLElement, book: HTMLElement, sb3d: HTMLElement, tx: number): number {
  const stageW = stage.clientWidth;
  const bookW = book.getBoundingClientRect().width;
  const overflow = bookW - stageW;
  if (overflow <= 0) return 0;
  return Math.min(0, Math.max(-overflow, tx));
}

function setPan(sb3d: HTMLElement, tx: number): void {
  sb3d.style.transform = tx ? `translate3d(${tx.toFixed(1)}px,0,0)` : "";
}

function currentPan(sb3d: HTMLElement): number {
  const m = /translate3d\((-?[\d.]+)px/.exec(sb3d.style.transform);
  return m ? Number(m[1]) : 0;
}

/**
 * Idempotent: safe to run on every frame load and every `applyScene` call.
 * Attaches one capture-phase gesture handler to the authored stage.
 */
export function applyMobileSketchbookPan(frame: HTMLIFrameElement | null): void {
  let doc: Document | null = null;
  try {
    doc = frame?.contentDocument ?? null;
  } catch {
    return;
  }
  if (!doc?.head) return;
  ensureStyle(doc);

  const stage = doc.getElementById("sbStage") as HTMLElement | null;
  const sb3d = doc.getElementById("sb3d") as HTMLElement | null;
  const book = doc.getElementById("sbBook") as HTMLElement | null;
  const win = frame?.contentWindow ?? null;
  if (!stage || !sb3d || !book) return;
  if (stage.dataset.mengPan === "1") return;
  stage.dataset.mengPan = "1";

  let tracking: PanState | null = null;

  const mobile = () => isMobile(win);

  const resetToDesktop = () => {
    tracking = null;
    if (!mobile()) setPan(sb3d, 0);
    else setPan(sb3d, clampPan(stage, book, sb3d, currentPan(sb3d)));
  };

  win?.addEventListener("resize", resetToDesktop);

  stage.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      // Only touch drags on the page-turn surface are panned. Mouse/pen,
      // the loupe, arrows, and tools keep their authored behavior, and
      // wide viewports keep the desktop spread untouched.
      if (e.pointerType !== "touch" || !mobile()) return;
      // NOTE: no `instanceof Element` check here — this callback runs in the
      // parent window's realm, where cross-realm `instanceof` is always false
      // for nodes inside the frame. A `closest` capability check is realm-safe.
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest(".loupe")) return;
      if (!target.closest(".sb-zone")) return;
      if (tracking) {
        // A second finger while panning: keep the first gesture, never
        // start a competing page turn.
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already released — the up/cancel handler resets state */
      }
      tracking = {
        pointerId: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        pan0: currentPan(sb3d),
        panning: false,
        scrolled: false,
      };
    },
    { capture: true },
  );

  stage.addEventListener(
    "pointermove",
    (e) => {
      if (!tracking || e.pointerId !== tracking.pointerId) return;
      if (tracking.scrolled) return;
      const dx = e.clientX - tracking.x0;
      const dy = e.clientY - tracking.y0;
      if (!tracking.panning) {
        // Vertical intent belongs to document scrolling; leave it alone.
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > TAP_SLOP) {
          tracking.scrolled = true;
          tracking = null;
          return;
        }
        if (Math.abs(dx) <= TAP_SLOP) return;
        tracking.panning = true;
      }
      const tx = clampPan(stage, book, sb3d, tracking.pan0 + dx);
      setPan(sb3d, tx);
    },
    { capture: true },
  );

  const finish = (e: PointerEvent) => {
    if (!tracking || e.pointerId !== tracking.pointerId) return;
    const t = tracking;
    tracking = null;
    if (t.scrolled) return;
    if (t.panning) {
      // End of a pan: stay where the finger left the spread. No snap or
      // animation — direct manipulation only.
      setPan(sb3d, clampPan(stage, book, sb3d, currentPan(sb3d)));
      return;
    }
    // A tap (no real movement): turn the page like the authored tap does,
    // reusing the arrow buttons so the authored turn animation — including
    // its reduced-motion path — runs unchanged.
    const moved = Math.max(Math.abs(e.clientX - t.x0), Math.abs(e.clientY - t.y0));
    if (moved > TAP_SLOP) return;
    const r = book.getBoundingClientRect();
    if (!r.width) return;
    const next = (t.x0 - r.left) / r.width > 0.5;
    const btn = doc?.getElementById(next ? "sbRight" : "sbLeft") as HTMLButtonElement | null;
    btn?.click();
  };

  stage.addEventListener("pointerup", finish, { capture: true });
  stage.addEventListener("pointercancel", (e) => {
    // The browser took the gesture (e.g. vertical scroll): drop our state
    // without turning or panning.
    if (tracking && e.pointerId === tracking.pointerId) tracking = null;
  }, { capture: true });
}
