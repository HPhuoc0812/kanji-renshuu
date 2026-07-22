/**
 * Whiteboard module – Canvas-based drawing pad for Kanji practice.
 * Supports: freehand drawing with Bézier smoothing, undo, clear, stroke width.
 * Zero external dependencies. Uses Canvas 2D API.
 */

const MAX_UNDO_STEPS = 30;
const SMOOTHING_FACTOR = 0.35;

let canvas = null;
let ctx = null;
let isDrawing = false;
let strokeWidth = 2;
let undoStack = [];

// Stroke state
let rawPoints = [];
let smoothX = 0;
let smoothY = 0;
let lastMidX = 0;
let lastMidY = 0;

function getStrokeColor() {
  return document.body.classList.contains("dark-mode") ? "#effaf7" : "#17211f";
}

function getPointerPos(event) {
  const rect = canvas.getBoundingClientRect();

  if (event.touches && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX - rect.left,
      y: event.touches[0].clientY - rect.top
    };
  }

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function smooth(rawVal, prevSmooth) {
  return prevSmooth + (rawVal - prevSmooth) * SMOOTHING_FACTOR;
}

function saveSnapshot() {
  if (undoStack.length >= MAX_UNDO_STEPS) {
    undoStack.shift();
  }

  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

function clearCanvas() {
  if (!ctx || !canvas) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setupStroke() {
  ctx.strokeStyle = getStrokeColor();
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function beginStroke(event) {
  event.preventDefault();
  isDrawing = true;

  const pos = getPointerPos(event);
  smoothX = pos.x;
  smoothY = pos.y;
  lastMidX = pos.x;
  lastMidY = pos.y;
  rawPoints = [{ x: pos.x, y: pos.y }];

  setupStroke();

  // Draw a dot for single click/tap
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, strokeWidth / 2, 0, Math.PI * 2);
  ctx.fillStyle = getStrokeColor();
  ctx.fill();
}

function continueStroke(event) {
  if (!isDrawing) {
    return;
  }

  event.preventDefault();
  const raw = getPointerPos(event);

  // Apply exponential smoothing to reduce jitter
  smoothX = smooth(raw.x, smoothX);
  smoothY = smooth(raw.y, smoothY);

  const point = { x: smoothX, y: smoothY };
  rawPoints.push(point);

  if (rawPoints.length < 2) {
    return;
  }

  const prev = rawPoints[rawPoints.length - 2];

  // Calculate midpoint between previous and current smoothed point
  const midX = (prev.x + point.x) / 2;
  const midY = (prev.y + point.y) / 2;

  setupStroke();

  // Draw quadratic Bézier from last midpoint, through previous point, to current midpoint
  // This creates smooth curves that flow naturally through the drawn path
  ctx.beginPath();
  ctx.moveTo(lastMidX, lastMidY);
  ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
  ctx.stroke();

  lastMidX = midX;
  lastMidY = midY;
}

function endStroke(event) {
  if (!isDrawing) {
    return;
  }

  event.preventDefault();

  // Draw final segment to the last point
  if (rawPoints.length >= 2) {
    const lastPoint = rawPoints[rawPoints.length - 1];

    setupStroke();
    ctx.beginPath();
    ctx.moveTo(lastMidX, lastMidY);
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();
  }

  isDrawing = false;

  if (rawPoints.length > 0) {
    saveSnapshot();
  }

  rawPoints = [];
}

export function undo() {
  if (undoStack.length === 0) {
    clearCanvas();
    return;
  }

  undoStack.pop();

  if (undoStack.length === 0) {
    clearCanvas();
    return;
  }

  const snapshot = undoStack[undoStack.length - 1];
  ctx.putImageData(snapshot, 0, 0);
}

export function clear() {
  undoStack = [];
  clearCanvas();
}

function setStrokeWidth(size) {
  strokeWidth = size;
}

function resizeCanvas() {
  if (!canvas || !canvas.parentElement) {
    return;
  }

  const wrap = canvas.parentElement;
  const rect = wrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.width); // Square canvas

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  // Redraw from last snapshot if available
  if (undoStack.length > 0) {
    const lastSnapshot = undoStack[undoStack.length - 1];
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = lastSnapshot.width;
    tmpCanvas.height = lastSnapshot.height;
    const tmpCtx = tmpCanvas.getContext("2d");
    tmpCtx.putImageData(lastSnapshot, 0, 0);

    clearCanvas();
    ctx.drawImage(tmpCanvas, 0, 0, width, height);
  } else {
    clearCanvas();
  }
}

export function toggleWhiteboard() {
  const panel = document.getElementById("whiteboardPanel");
  const btn = document.getElementById("whiteboardToggleBtn");

  if (!panel) {
    return;
  }

  const isHidden = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !isHidden);

  if (btn) {
    btn.classList.toggle("active", isHidden);
    btn.title = isHidden ? "Tắt bảng viết (W)" : "Bật bảng viết (W)";
  }

  if (isHidden) {
    requestAnimationFrame(() => {
      resizeCanvas();
    });
  }
}

export function initWhiteboard() {
  canvas = document.getElementById("whiteboardCanvas");

  if (!canvas) {
    return;
  }

  ctx = canvas.getContext("2d");

  // Tool buttons – stroke width
  const sizeButtons = document.querySelectorAll("[data-wb-size]");

  sizeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sizeButtons.forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      setStrokeWidth(Number(button.dataset.wbSize));
    });
  });

  // Undo & Clear
  const undoBtn = document.getElementById("wbUndoBtn");
  const clearBtn = document.getElementById("wbClearBtn");

  if (undoBtn) {
    undoBtn.addEventListener("click", undo);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", clear);
  }

  // Toggle button
  const toggleBtn = document.getElementById("whiteboardToggleBtn");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", toggleWhiteboard);
  }

  // Mouse events
  canvas.addEventListener("mousedown", beginStroke);
  canvas.addEventListener("mousemove", continueStroke);
  canvas.addEventListener("mouseup", endStroke);
  canvas.addEventListener("mouseleave", endStroke);

  // Touch events
  canvas.addEventListener("touchstart", beginStroke, { passive: false });
  canvas.addEventListener("touchmove", continueStroke, { passive: false });
  canvas.addEventListener("touchend", endStroke, { passive: false });
  canvas.addEventListener("touchcancel", endStroke, { passive: false });

  // Resize observer
  const wrap = canvas.parentElement;

  if (wrap && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      const panel = document.getElementById("whiteboardPanel");

      if (panel && !panel.classList.contains("hidden")) {
        resizeCanvas();
      }
    });

    ro.observe(wrap);
  }

  // Initial resize if visible
  const panel = document.getElementById("whiteboardPanel");

  if (panel && !panel.classList.contains("hidden")) {
    resizeCanvas();
  }
}
