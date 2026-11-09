import { collections, canvasBounds } from "../data/canvas";
import {
  clampScale,
  fitRect,
  zoomAt,
  type Camera,
  type Point,
} from "./canvas-camera";

const canvas = document.querySelector<HTMLElement>("#canvas")!;
const world = document.querySelector<HTMLElement>("#world")!;
const zoomValue = document.querySelector<HTMLOutputElement>("#zoom-value")!;
const announcement = document.querySelector<HTMLElement>(
  "#canvas-announcement",
)!;
const dialog = document.querySelector<HTMLDialogElement>("#info-dialog")!;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const viewport = () => ({
  width: canvas.clientWidth,
  height: canvas.clientHeight,
});
const center = () => ({
  x: canvas.clientWidth / 2,
  y: canvas.clientHeight / 2,
});
let camera: Camera = { x: 0, y: 0, scale: 1 };
let animation = 0;
let opened: string | null = null;
let savedCamera: Camera | null = null;
let activeView = "home";
let dialogTrigger: HTMLElement | null = null;

function render() {
  world.style.transform = `translate3d(${camera.x}px,${camera.y}px,0) scale(${camera.scale})`;
  const small = 24 * camera.scale;
  const large = small * 5;
  canvas.style.backgroundSize = `${small}px ${small}px,${small}px ${small}px,${large}px ${large}px,${large}px ${large}px`;
  canvas.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
  zoomValue.value = `${Math.round(camera.scale * 100)}%`;
  const marker = document.querySelector<HTMLElement>("#map-viewport")!;
  marker.style.left = `${(-camera.x / camera.scale / 1900) * 100}%`;
  marker.style.top = `${(-camera.y / camera.scale / 3100) * 100}%`;
  marker.style.width = `${(canvas.clientWidth / camera.scale / 1900) * 100}%`;
  marker.style.height = `${(canvas.clientHeight / camera.scale / 3100) * 100}%`;
}
function stop() {
  cancelAnimationFrame(animation);
}
function moveTo(next: Camera, animate = true) {
  stop();
  if (!animate || reducedMotion.matches) {
    camera = next;
    render();
    return;
  }
  const from = { ...camera };
  const start = performance.now();
  function tick(now: number) {
    const progress = Math.min(1, (now - start) / 650);
    const ease = 1 - Math.pow(1 - progress, 4);
    camera = {
      x: from.x + (next.x - from.x) * ease,
      y: from.y + (next.y - from.y) * ease,
      scale: from.scale + (next.scale - from.scale) * ease,
    };
    render();
    if (progress < 1) animation = requestAnimationFrame(tick);
  }
  animation = requestAnimationFrame(tick);
}
function collapse(restore = true) {
  if (!opened) return;
  const group = document.querySelector<HTMLElement>(`#collection-${opened}`)!;
  group.classList.remove("is-open");
  group.querySelector<HTMLElement>(".spread")!.hidden = true;
  const stack = group.querySelector<HTMLButtonElement>(".stack")!;
  stack.setAttribute("aria-expanded", "false");
  if (group.contains(document.activeElement))
    stack.focus({ preventScroll: true });
  document.body.classList.remove("has-open");
  document.querySelector<HTMLElement>("#escape-hint")!.hidden = true;
  opened = null;
  if (restore && savedCamera) {
    activeView = "custom";
    moveTo(savedCamera);
  }
  savedCamera = null;
}
function focusCollection(id: string, animate = true) {
  const group = collections.find((group) => group.id === id)!;
  const mobile = canvas.clientWidth <= 700;
  const spread = document.querySelector<HTMLElement>(`#spread-${id}`)!;
  moveTo(
    fitRect(
      {
        x: group.x,
        y: group.y,
        width: spread.offsetWidth || (mobile ? 560 : 1210),
        height: spread.offsetHeight || (mobile ? 1000 : 755),
      },
      viewport(),
      mobile,
    ),
    animate,
  );
}
function openCollection(id: string) {
  if (!collections.some((group) => group.id === id)) return;
  if (opened === id) return focusCollection(id);
  const previous = savedCamera ?? { ...camera };
  collapse(false);
  savedCamera = previous;
  opened = id;
  activeView = "collection";
  const group = document.querySelector<HTMLElement>(`#collection-${id}`)!;
  const keyboardFocus =
    group.contains(document.activeElement) ||
    document.querySelector("#index-panel")!.contains(document.activeElement);
  group.classList.add("is-open");
  group.querySelector<HTMLElement>(".spread")!.hidden = false;
  group.querySelector(".stack")!.setAttribute("aria-expanded", "true");
  document.body.classList.add("has-open");
  document.querySelector<HTMLElement>("#escape-hint")!.hidden = false;
  togglePanel("index", false);
  focusCollection(id);
  if (keyboardFocus)
    group
      .querySelector<HTMLButtonElement>(".fold-button")!
      .focus({ preventScroll: true });
  announcement.textContent = `${collections.find((group) => group.id === id)!.title} opened. Select an image, or press Escape to fold the collection.`;
}
function navigate(view: string, animate = true) {
  collapse(false);
  activeView = view;
  const rect =
    view === "all"
      ? canvasBounds
      : view === "archive"
        ? { x: 170, y: 1360, width: 1510, height: 700 }
        : { x: 180, y: 90, width: 1400, height: 1040 };
  moveTo(fitRect(rect, viewport()), animate);
}
function togglePanel(name: "map" | "index", show?: boolean) {
  const panel = document.querySelector<HTMLElement>(`#${name}-panel`)!;
  panel.hidden = show === undefined ? !panel.hidden : !show;
  document
    .querySelector(`#${name}-toggle`)!
    .setAttribute("aria-expanded", String(!panel.hidden));
}
function showDialog(panelName: string) {
  if (!["reading", "notes"].includes(panelName)) return;
  dialogTrigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  document
    .querySelectorAll<HTMLElement>("[data-panel]")
    .forEach((panel) => (panel.hidden = panel.dataset.panel !== panelName));
  document.querySelector("#dialog-title")!.textContent =
    panelName === "notes"
      ? "Private notes"
      : panelName.charAt(0).toUpperCase() + panelName.slice(1);
  dialog.showModal();
  togglePanel("index", false);
}

document
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () => navigate(button.dataset.view!)),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-open]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      openCollection(button.dataset.open!),
    ),
  );
document.querySelectorAll<HTMLButtonElement>("[data-jump]").forEach((button) =>
  button.addEventListener("click", () => {
    openCollection(button.dataset.jump!);
    togglePanel("map", false);
  }),
);
document
  .querySelectorAll<HTMLButtonElement>("[data-dialog]")
  .forEach((button) =>
    button.addEventListener("click", () => showDialog(button.dataset.dialog!)),
  );
document
  .querySelector("#close-dialog")!
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  }
});
dialog.addEventListener("close", () => {
  dialogTrigger?.focus({ preventScroll: true });
  if (location.hash === "#notes")
    history.replaceState(null, "", location.pathname + location.search);
});
for (const group of collections) {
  const section = document.querySelector<HTMLElement>(
    `#collection-${group.id}`,
  )!;
  section
    .querySelector(".stack")!
    .addEventListener("click", () => openCollection(group.id));
  section
    .querySelector(".fold-button")!
    .addEventListener("click", () => collapse());
  section.querySelectorAll<HTMLButtonElement>(".thumbnail").forEach((button) =>
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const item = group.items[index];
      const image =
        section.querySelector<HTMLImageElement>(".selected-work img")!;
      image.src = item.src;
      image.alt = item.alt ?? item.title;
      image.width = item.width;
      image.height = item.height;
      section.querySelector(".selected-title")!.textContent = item.title;
      section.querySelector(".selected-number")!.textContent =
        `${String(index + 1).padStart(2, "0")} / ${String(group.items.length).padStart(2, "0")}`;
      section
        .querySelectorAll(".thumbnail")
        .forEach((other) =>
          other.setAttribute("aria-pressed", String(other === button)),
        );
      announcement.textContent = `${item.title}, image ${index + 1} of ${group.items.length}`;
    }),
  );
}
function zoom(multiplier: number) {
  activeView = "custom";
  moveTo(zoomAt(camera, camera.scale * multiplier, center()));
}
document.querySelector("#zoom-in")!.addEventListener("click", () => zoom(1.25));
document.querySelector("#zoom-out")!.addEventListener("click", () => zoom(0.8));
document
  .querySelector("#map-toggle")!
  .addEventListener("click", () => togglePanel("map"));
document
  .querySelector("#index-toggle")!
  .addEventListener("click", () => togglePanel("index"));
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".navigator")) togglePanel("map", false);
  if (!target.closest(".collection-menu")) togglePanel("index", false);
});

// One camera governs dragging, wheel panning, cursor-anchored zoom, and touch pinch.
const pointers = new Map<number, Point>();
let gesture: {
  camera: Camera;
  anchor: Point;
  distance: number;
  start: Point;
  moved: boolean;
} | null = null;
let suppressClick = false;
function midpoint(): Point {
  const values = [...pointers.values()];
  return values.length === 1
    ? values[0]
    : {
        x: (values[0].x + values[1].x) / 2,
        y: (values[0].y + values[1].y) / 2,
      };
}
function distance() {
  const values = [...pointers.values()];
  return values.length < 2
    ? 0
    : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
}
function beginGesture() {
  const mid = midpoint();
  gesture = {
    camera: { ...camera },
    anchor: {
      x: (mid.x - camera.x) / camera.scale,
      y: (mid.y - camera.y) / camera.scale,
    },
    distance: distance(),
    start: mid,
    moved: pointers.size > 1 || suppressClick,
  };
}
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || (event.target as HTMLElement).closest("a")) return;
  stop();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) suppressClick = false;
  if (pointers.size > 1) suppressClick = true;
  beginGesture();
});
canvas.addEventListener("pointermove", (event) => {
  if (!pointers.has(event.pointerId) || !gesture) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const mid = midpoint();
  const moved = Math.hypot(mid.x - gesture.start.x, mid.y - gesture.start.y);
  if (moved > 5 || pointers.size > 1) gesture.moved = true;
  if (!gesture.moved) return;
  activeView = "custom";
  suppressClick = true;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("dragging");
  const scale =
    pointers.size > 1 && gesture.distance > 0
      ? clampScale((gesture.camera.scale * distance()) / gesture.distance)
      : gesture.camera.scale;
  camera = {
    x: mid.x - gesture.anchor.x * scale,
    y: mid.y - gesture.anchor.y * scale,
    scale,
  };
  render();
});
function endGesture(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  if (pointers.size) beginGesture();
  else {
    gesture = null;
    canvas.classList.remove("dragging");
    setTimeout(() => {
      suppressClick = false;
    }, 0);
  }
}
window.addEventListener("pointerup", endGesture);
window.addEventListener("pointercancel", endGesture);
window.addEventListener("blur", () => {
  pointers.clear();
  gesture = null;
  suppressClick = false;
  canvas.classList.remove("dragging");
});
canvas.addEventListener(
  "click",
  (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);
canvas.addEventListener("dragstart", (event) => event.preventDefault());
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    stop();
    activeView = "custom";
    const unit =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? canvas.clientHeight
          : 1;
    if (event.ctrlKey || event.metaKey)
      camera = zoomAt(
        camera,
        camera.scale * Math.exp(-event.deltaY * unit * 0.008),
        { x: event.clientX, y: event.clientY },
      );
    else {
      camera.x -= (event.shiftKey ? event.deltaY : event.deltaX) * unit;
      camera.y -= (event.shiftKey ? 0 : event.deltaY) * unit;
    }
    render();
  },
  { passive: false },
);
canvas.addEventListener("focusin", (event) => {
  const section = (event.target as HTMLElement).closest<HTMLElement>(
    ".collection",
  );
  if (!section || opened) return;
  // Make off-screen stacks reachable when tabbing through the page.
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  if (
    rect.top < 75 ||
    rect.bottom > canvas.clientHeight - 90 ||
    rect.left < 0 ||
    rect.right > canvas.clientWidth
  ) {
    const group = collections.find(
      (group) => group.id === section.dataset.collection,
    )!;
    activeView = "custom";
    moveTo(
      fitRect(
        { x: group.x - 30, y: group.y - 30, width: 560, height: 600 },
        viewport(),
      ),
    );
  }
});
document.addEventListener("keydown", (event) => {
  if (
    dialog.open ||
    (event.target as HTMLElement).matches("input,textarea,select") ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  )
    return;
  if (event.key === "Escape") {
    collapse();
    togglePanel("map", false);
    togglePanel("index", false);
    return;
  }
  if (!(event.target === canvas || event.target === document.body)) return;
  const directions: Record<string, Point> = {
    ArrowLeft: { x: 90, y: 0 },
    ArrowRight: { x: -90, y: 0 },
    ArrowUp: { x: 0, y: 90 },
    ArrowDown: { x: 0, y: -90 },
  };
  if (directions[event.key]) {
    event.preventDefault();
    activeView = "custom";
    const d = directions[event.key];
    moveTo({ ...camera, x: camera.x + d.x, y: camera.y + d.y });
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoom(1.25);
  }
  if (event.key === "-") {
    event.preventDefault();
    zoom(0.8);
  }
  if (event.key === "Home" || event.key === "0") {
    event.preventDefault();
    navigate("home");
  }
});
let lastViewport = viewport();
new ResizeObserver(() => {
  const size = viewport();
  if (size.width === lastViewport.width && size.height === lastViewport.height)
    return;
  if (opened) focusCollection(opened, false);
  else if (activeView !== "custom") navigate(activeView, false);
  else {
    camera.x += (size.width - lastViewport.width) / 2;
    camera.y += (size.height - lastViewport.height) / 2;
    render();
  }
  lastViewport = size;
}).observe(canvas);
window.addEventListener("hashchange", () => {
  if (location.hash === "#notes" && !dialog.open) showDialog("notes");
});
navigate("home", false);
if (location.hash === "#notes") showDialog("notes");
