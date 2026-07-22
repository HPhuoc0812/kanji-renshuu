/**
 * Whiteboard module – High-performance Canvas drawing pad for Kanji practice.
 * Supports: PointerEvents, requestAnimationFrame render loop, Bézier smoothing.
 */

const MAX_UNDO_STEPS = 30;
const SMOOTHING_FACTOR = 0.45;

let canvas = null;
let ctx = null;
let isDrawing = false;
let strokeWidth = 2;
let undoStack = [];
let canvasRect = null; // Cached rect

// Render loop state
let pendingPoints = [];
let renderLoopId = null;
let needsRender = false;

// Stroke state
let lastRawX = 0;
let lastRawY = 0;
let smoothX = 0;
let smoothY = 0;
let lastMidX = 0;
let lastMidY = 0;
let strokePointCount = 0;

function getStrokeColor() {
  return document.body.classList.contains("dark-mode") ? "#effaf7" : "#17211f";
}

function updateCanvasRect() {
  if (canvas) {
    canvasRect = canvas.getBoundingClientRect();
  }
}

function getPointerPos(clientX, clientY) {
  // Use cached rect for performance. 
  // We assume updateCanvasRect is called on resize/scroll/pointerdown.
  if (!canvasRect) updateCanvasRect();
  return {
    x: clientX - canvasRect.left,
    y: clientY - canvasRect.top
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
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setupStroke() {
  ctx.strokeStyle = getStrokeColor();
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

// ----------------------------------------------------
// Rendering Loop (rAF)
// ----------------------------------------------------

function startRenderLoop() {
  if (renderLoopId === null) {
    renderLoopId = requestAnimationFrame(renderLoop);
  }
}

function stopRenderLoop() {
  if (renderLoopId !== null) {
    cancelAnimationFrame(renderLoopId);
    renderLoopId = null;
  }
}

function renderLoop() {
  renderLoopId = requestAnimationFrame(renderLoop);

  if (!needsRender || pendingPoints.length === 0) {
    return;
  }

  setupStroke();
  ctx.beginPath();
  
  // We process all points accumulated since the last frame
  for (let i = 0; i < pendingPoints.length; i++) {
    const raw = pendingPoints[i];
    
    // First point of a stroke
    if (strokePointCount === 0) {
      smoothX = raw.x;
      smoothY = raw.y;
      lastMidX = raw.x;
      lastMidY = raw.y;
      
      // Draw initial dot
      ctx.arc(raw.x, raw.y, strokeWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = getStrokeColor();
      ctx.fill();
      ctx.beginPath(); // Start new path for following lines
    } else {
      // Apply exponential smoothing
      smoothX = smooth(raw.x, smoothX);
      smoothY = smooth(raw.y, smoothY);

      // Calculate midpoint for Bézier curve
      const midX = (lastRawX + smoothX) / 2;
      const midY = (lastRawY + smoothY) / 2;

      ctx.moveTo(lastMidX, lastMidY);
      ctx.quadraticCurveTo(lastRawX, lastRawY, midX, midY);
      
      lastMidX = midX;
      lastMidY = midY;
    }
    
    lastRawX = smoothX;
    lastRawY = smoothY;
    strokePointCount++;
  }
  
  ctx.stroke();
  pendingPoints = []; // Clear processed points
  needsRender = false;
}

// ----------------------------------------------------
// Input Handling (Pointer Events)
// ----------------------------------------------------

function handlePointerDown(event) {
  // Only accept primary button (left click) or touch/pen
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  updateCanvasRect(); // Crucial: refresh bounds on interaction start
  
  isDrawing = true;
  strokePointCount = 0;
  pendingPoints = [];
  needsRender = true;
  startRenderLoop();
  
  pendingPoints.push(getPointerPos(event.clientX, event.clientY));
}

function processPointerEvent(event) {
  // Modern browsers support coalesced events (higher polling rate than frame rate)
  if (event.getCoalescedEvents) {
    const coalesced = event.getCoalescedEvents();
    if (coalesced.length > 0) {
      for (const e of coalesced) {
        pendingPoints.push(getPointerPos(e.clientX, e.clientY));
      }
      needsRender = true;
      return;
    }
  }
  
  // Fallback if no coalesced events
  pendingPoints.push(getPointerPos(event.clientX, event.clientY));
  needsRender = true;
}

function handlePointerMove(event) {
  if (!isDrawing) return;
  event.preventDefault();
  processPointerEvent(event);
}

function handlePointerUpOrCancel(event) {
  if (!isDrawing) return;
  event.preventDefault();
  isDrawing = false;
  
  // Process any remaining position data
  processPointerEvent(event);
  
  // Draw final segment to the exact end point (no smoothing for the very tip)
  const pos = getPointerPos(event.clientX, event.clientY);
  pendingPoints.push(pos);
  needsRender = true;
  
  // Force a final render synchronously so the snapshot captures it
  stopRenderLoop();
  renderLoop();
  
  canvas.releasePointerCapture(event.pointerId);
  saveSnapshot();
}

// ----------------------------------------------------
// Public API
// ----------------------------------------------------

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
  if (!canvas || !canvas.parentElement) return;

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
  
  updateCanvasRect();

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

  if (!panel) return;

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
  if (!canvas) return;

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
  if (undoBtn) undoBtn.addEventListener("click", undo);
  if (clearBtn) clearBtn.addEventListener("click", clear);

  // Toggle button
  const toggleBtn = document.getElementById("whiteboardToggleBtn");
  if (toggleBtn) toggleBtn.addEventListener("click", toggleWhiteboard);

  // Pointer Events (replaces mouse and touch events)
  canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  canvas.addEventListener("pointerup", handlePointerUpOrCancel, { passive: false });
  canvas.addEventListener("pointercancel", handlePointerUpOrCancel, { passive: false });
  canvas.addEventListener("pointerout", handlePointerUpOrCancel, { passive: false });

  // Prevent scroll when touching the canvas on mobile
  canvas.style.touchAction = "none";

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

  // Update rect on scroll
  window.addEventListener('scroll', updateCanvasRect, { passive: true });

  // Initial resize if visible
  const panel = document.getElementById("whiteboardPanel");
  if (panel && !panel.classList.contains("hidden")) {
    resizeCanvas();
  }
}
