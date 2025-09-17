// Predator vs Prey — agent-based simulation with Chart.js graph
// World: toroidal grid. Multiple agents per cell allowed.
// Predators move randomly, eat at most one prey per tick on their cell, lose energy by metabolism, gain by eating. Reproduce probabilistically if energy >= threshold.
// Prey move randomly and reproduce probabilistically.

(function () {
  'use strict';

  // DOM
  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const stepBtn = document.getElementById('stepBtn');
  const resetBtn = document.getElementById('resetBtn');
  const modelSelect = document.getElementById('modelSelect');
  const speedRange = document.getElementById('speedRange');
  const speedLabel = document.getElementById('speedLabel');
  const tickLabel = document.getElementById('tickLabel');
  const preyCountEl = document.getElementById('preyCount');
  const predCountEl = document.getElementById('predCount');
  const presetSelect = document.getElementById('presetSelect');

  // Params inputs
  const worldWidthInput = document.getElementById('worldWidth');
  const worldHeightInput = document.getElementById('worldHeight');
  const initPreyInput = document.getElementById('initPrey');
  const initPredatorsInput = document.getElementById('initPredators');
  const preyReproProbInput = document.getElementById('preyReproProb');
  const predReproProbInput = document.getElementById('predReproProb');
  const predMetabolismInput = document.getElementById('predMetabolism');
  const energyPerPreyInput = document.getElementById('energyPerPrey');
  const predReproEnergyInput = document.getElementById('predReproEnergy');
  const maxGraphPointsInput = document.getElementById('maxGraphPoints');
  const predVisionInput = document.getElementById('predVision');
  const preyKInput = document.getElementById('preyK');

  // ODE inputs removed (LV/RM no longer exposed)

  // Chart
  const popCanvas = document.getElementById('popChart');
  const chartCanvasContainer = document.getElementById('chartCanvasContainer');
  const expandChartBtn = document.getElementById('expandChartBtn');
  const chartModal = document.getElementById('chartModal');
  const chartModalHost = document.getElementById('chartModalCanvasHost');
  const closeChartBtn = document.getElementById('closeChartBtn');
  const toggleMeanLines = document.getElementById('toggleMeanLines');
  const toggleMeanLinesModal = document.getElementById('toggleMeanLinesModal');
  const modalStartPauseBtn = document.getElementById('modalStartPauseBtn');
  const modalResetBtn = document.getElementById('modalResetBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const chartWarning = document.getElementById('chartWarning');
  let chart;

  // Simulation state
  let state = null;
  let timer = null;
  let cellSize = 7; // pixels per cell for drawing

  // Utilities
  const randInt = (n) => Math.floor(Math.random() * n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ODE params function removed

  function initState() {
  const mode = 'agent';
    const W = clamp(parseInt(worldWidthInput.value, 10) || 120, 20, 400);
    const H = clamp(parseInt(worldHeightInput.value, 10) || 80, 20, 300);

  // Resize canvas to fit viewport without scrolling too much
  // Compute a target pixel size bounded by viewport
  // Measure available space from the sim panel container to keep canvas compact
  const simPanel = document.querySelector('.panel.sim');
  const rect = simPanel ? simPanel.getBoundingClientRect() : { width: canvas.parentElement?.clientWidth || canvas.width, height: canvas.parentElement?.clientHeight || canvas.height };
  const maxCanvasWidth = Math.max(240, Math.floor(rect.width - 8));
  const maxCanvasHeight = Math.max(160, Math.floor(rect.height - 40));
  // Estimate cell size to fit within those bounds
  const sizeByW = Math.floor(maxCanvasWidth / W);
  const sizeByH = Math.floor(maxCanvasHeight / H);
  cellSize = Math.max(1, Math.min(8, Math.min(sizeByW, sizeByH)));
  // Fallback to previous size if bounds were too tight
  if (!isFinite(cellSize) || cellSize < 1) cellSize = 4;
  canvas.width = Math.max(100, W * cellSize);
  canvas.height = Math.max(100, H * cellSize);

    const initPrey = clamp(parseInt(initPreyInput.value, 10) || 800, 0, 2000000);
    const initPred = clamp(parseInt(initPredatorsInput.value, 10) || 120, 0, 2000000);
    const preyReproProb = clamp(parseFloat(preyReproProbInput.value) || 0.05, 0, 1);
    const predReproProb = clamp(parseFloat(predReproProbInput.value) || 0.02, 0, 1);
    const predMetabolism = clamp(parseFloat(predMetabolismInput.value) || 1.0, 0, 20);
    const energyPerPrey = clamp(parseFloat(energyPerPreyInput.value) || 10, 0, 100);
    const predReproEnergy = clamp(parseFloat(predReproEnergyInput.value) || 30, 0, 200);
    const maxGraphPoints = clamp(parseInt(maxGraphPointsInput.value, 10) || 1000, 50, 5000);
    const predVision = clamp(parseInt(predVisionInput?.value, 10) || 4, 0, 20);
    const preyK = (() => {
      const v = parseFloat(preyKInput?.value);
      if (isNaN(v) || v <= 0) return 1500; // default stable value per request
      return v;
    })();
  if (mode === 'agent') {
      const prey = new Array(initPrey).fill(0).map(() => ({
        x: randInt(W),
        y: randInt(H),
      }));
      const predators = new Array(initPred).fill(0).map(() => ({
        x: randInt(W),
        y: randInt(H),
        // Start predators with moderate energy to avoid immediate die-off or instant reproduction burst
        energy: Math.max(predReproEnergy * 0.6, predMetabolism * 6),
      }));

      state = {
        mode,
        W, H,
        prey,
        predators,
        tick: 0,
        params: { preyReproProb, predReproProb, predMetabolism, energyPerPrey, predReproEnergy, maxGraphPoints, predVision, preyK },
        graph: { t: [], prey: [], pred: [] },
      };
    }

    resetChart(maxGraphPoints);
    updateStats();
    draw();
  }

  function applyPreset(name) {
    // Define a few balanced presets
    const presets = {
      classic: {
        initPrey: 500, initPred: 60,
        preyReproProb: 0.045, predReproProb: 0.03,
        predMetabolism: 0.9, energyPerPrey: 8, predReproEnergy: 24,
        worldWidth: 80, worldHeight: 60, maxGraphPoints: 1200,
        predVision: 4, preyK: 1500,
      },
      chaotic: {
        initPrey: 700, initPred: 50,
        preyReproProb: 0.06, predReproProb: 0.045,
        predMetabolism: 0.8, energyPerPrey: 10, predReproEnergy: 22,
        worldWidth: 80, worldHeight: 60, maxGraphPoints: 1500,
        predVision: 5, preyK: 0,
      },
      stable: {
        initPrey: 400, initPred: 70,
        preyReproProb: 0.035, predReproProb: 0.02,
        predMetabolism: 1.0, energyPerPrey: 8, predReproEnergy: 26,
        worldWidth: 80, worldHeight: 60, maxGraphPoints: 1000,
        predVision: 3, preyK: 0,
      },
    };
    const p = presets[name] || presets.classic;
    // Update visible inputs
    initPreyInput.value = p.initPrey;
    initPredatorsInput.value = p.initPred;
    // Update advanced inputs
    worldWidthInput.value = p.worldWidth;
    worldHeightInput.value = p.worldHeight;
    if ('preyReproProb' in p) preyReproProbInput.value = p.preyReproProb;
    if ('predReproProb' in p) predReproProbInput.value = p.predReproProb;
    if ('predMetabolism' in p) predMetabolismInput.value = p.predMetabolism;
    if ('energyPerPrey' in p) energyPerPreyInput.value = p.energyPerPrey;
    if ('predReproEnergy' in p) predReproEnergyInput.value = p.predReproEnergy;
    if ('maxGraphPoints' in p) maxGraphPointsInput.value = p.maxGraphPoints;
    if (predVisionInput && 'predVision' in p) predVisionInput.value = p.predVision;
    if (preyKInput && 'preyK' in p) preyKInput.value = p.preyK || '';
    // Model is fixed to agent-based
  }

  function resetChart(maxPoints) {
    if (chart) chart.destroy();
    if (typeof Chart === 'undefined') {
      if (chartWarning) chartWarning.hidden = false;
      chart = null;
      return;
    } else if (chartWarning) {
      chartWarning.hidden = true;
    }
    chart = new Chart(popCanvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Prey',
            data: [],
            borderColor: '#58f0a7',
            backgroundColor: 'rgba(88,240,167,0.15)',
            tension: 0.15,
            pointRadius: 0,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Predators',
            data: [],
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255,107,107,0.15)',
            tension: 0.15,
            pointRadius: 0,
            borderWidth: 2,
            yAxisID: 'y1',
          },
          // Trend lines (smoothed), hidden by default
          {
            label: 'Prey trend',
            data: [],
            borderColor: 'rgba(88,240,167,0.6)',
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
            hidden: true,
            yAxisID: 'y',
          },
          {
            label: 'Predators trend',
            data: [],
            borderColor: 'rgba(255,107,107,0.6)',
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
            hidden: true,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        maintainAspectRatio: false, // let CSS control height
        plugins: {
          legend: {
            labels: { color: '#e5e7ef' },
            // Hide trend lines from legend when they are toggled off
            labels: {
              color: '#e5e7ef',
              filter: (legendItem, data) => {
                const di = legendItem.datasetIndex;
                if (di === 2 || di === 3) {
                  const ds = data?.datasets?.[di];
                  return ds && !ds.hidden; // show only when visible
                }
                return true;
              },
            },
          },
          zoom: {
            limits: {
              x: { min: 'original', max: 'original' },
              y: { min: 'original', max: 'original' },
              y1: { min: 'original', max: 'original' },
            },
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: null,
              threshold: 10,
            },
            zoom: {
              wheel: { enabled: true, speed: 0.05 },
              pinch: { enabled: true },
              mode: 'x',
              drag: { enabled: false },
            },
          },
        },
        layout: {
          padding: { top: 6, right: 6, bottom: 14, left: 6 },
        },
        scales: {
          x: {
            ticks: {
              color: '#97a0b5',
              padding: 6,
              callback: (val, idx, ticks) => {
                // labels[] stores ticks; convert to years with 50 ticks = 1 year
                const t = chart?.data?.labels?.[idx] ?? val;
                const years = (Number(t) || 0) / 50;
                return years.toFixed(1);
              },
            },
            title: { display: true, text: 'Time (years)', color: '#97a0b5' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            border: { display: true, color: '#2b3256' },
          },
          y: { ticks: { color: '#97a0b5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y1: {
            position: 'right',
            ticks: { color: '#97a0b5' },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
    // store max points in chart for clipping
    chart.maxPoints = maxPoints;
    // Double click/tap to reset zoom
    popCanvas.addEventListener('dblclick', () => {
      try { chart.resetZoom?.(); } catch { /* no-op */ }
    });
    popCanvas.addEventListener('touchend', (e) => {
      if (e.touches && e.touches.length === 0 && e.changedTouches && e.changedTouches.length === 1) {
        // quick double tap detection
        const now = Date.now();
        if (!popCanvas._lastTap) popCanvas._lastTap = 0;
        if (now - popCanvas._lastTap < 350) {
          try { chart.resetZoom?.(); } catch { /* no-op */ }
        }
        popCanvas._lastTap = now;
      }
    }, { passive: true });
    chart.computeTrends = function computeTrends(alpha = 0.12) {
      // Exponential smoothing to produce a smooth trend line for each series
      const smooth = (arr) => {
        const out = new Array(arr.length);
        if (!arr.length) return out || [];
        let s = arr[0];
        out[0] = s;
        for (let i = 1; i < arr.length; i++) {
          const v = arr[i];
          s = alpha * v + (1 - alpha) * s;
          out[i] = s;
        }
        return out;
      };
      const d0 = chart.data.datasets[0].data; // prey
      const d1 = chart.data.datasets[1].data; // predators
      chart.data.datasets[2].data = smooth(d0);
      chart.data.datasets[3].data = smooth(d1);
    };
  }

  function wrap(n, max) { return (n + max) % max; }

  function moveAgent(agent, W, H) {
    // Moore neighborhood random step
    const dx = randInt(3) - 1; // -1,0,1
    const dy = randInt(3) - 1;
    agent.x = wrap(agent.x + dx, W);
    agent.y = wrap(agent.y + dy, H);
  }

  function moveToward(agent, target, W, H) {
    // Choose the shortest wrap-around direction per axis
    const dxRaw = target.x - agent.x;
    const dyRaw = target.y - agent.y;
    const dx = Math.abs(dxRaw) > W / 2 ? -Math.sign(dxRaw) : Math.sign(dxRaw);
    const dy = Math.abs(dyRaw) > H / 2 ? -Math.sign(dyRaw) : Math.sign(dyRaw);
    agent.x = wrap(agent.x + dx, W);
    agent.y = wrap(agent.y + dy, H);
  }

  function step() {
    if (!state) return;
    const { W, H, params, mode } = state;

    // Agent-based model below
    
    const { W: _W, H: _H } = state; // shadow for clarity
    
    // Move prey and handle reproduction (logistic, approximated): p * (1 - N/K)

    const newPrey = [];
    const K = Math.max(1, state.params.preyK);
    const N = state.prey.length;
    const effRepro = Math.max(0, Math.min(1, state.params.preyReproProb * (1 - N / K)));
    for (let i = 0; i < state.prey.length; i++) {
      const p = state.prey[i];
      moveAgent(p, _W, _H);
      newPrey.push(p);
      if (Math.random() < effRepro) {
        newPrey.push({ x: p.x, y: p.y });
      }
    }
    state.prey = newPrey;

    // Build grid index to speed up predation lookups
    const preyIndex = new Map(); // key: y*W + x -> array indices
    for (let i = 0; i < state.prey.length; i++) {
      const p = state.prey[i];
      const key = p.y * _W + p.x;
      let arr = preyIndex.get(key);
      if (!arr) { arr = []; preyIndex.set(key, arr); }
      arr.push(i);
    }

    // Predators: move (vision-aware), eat one prey if present, lose metabolism, reproduce probabilistically if energy high enough
    const survivors = [];
    const newbornPred = [];
    const eatenPreyIdx = new Set();
    for (let i = 0; i < state.predators.length; i++) {
      const pred = state.predators[i];
      // Move: if prey within vision radius, step toward nearest; else random
      const V = params.predVision;
      let target = null;
      if (V > 0 && state.prey.length) {
        // search small neighborhood for nearest prey
        let bestD2 = Infinity;
        for (let j = 0; j < state.prey.length; j++) {
          const pr = state.prey[j];
          // compute toroidal distance squared
          const dx = Math.min(Math.abs(pr.x - pred.x), W - Math.abs(pr.x - pred.x));
          const dy = Math.min(Math.abs(pr.y - pred.y), H - Math.abs(pr.y - pred.y));
          if (dx <= V && dy <= V) {
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; target = pr; }
          }
        }
      }
      if (target) moveToward(pred, target, _W, _H); else moveAgent(pred, _W, _H);

      // Eat one prey on same cell, if any
      const key = pred.y * _W + pred.x;
      const indices = preyIndex.get(key);
      if (indices && indices.length) {
        // pop one prey index and mark as eaten
        const eatenIdx = indices.pop();
        if (eatenIdx !== undefined) {
          eatenPreyIdx.add(eatenIdx);
          pred.energy += params.energyPerPrey;
        }
      }

      // Metabolism cost
      pred.energy -= params.predMetabolism;

      // Death check
      if (pred.energy <= 0) {
        continue; // dies
      }

      // Reproduction
      if (pred.energy >= params.predReproEnergy && Math.random() < params.predReproProb) {
        // Split energy with offspring
        const childEnergy = pred.energy / 2;
        pred.energy = childEnergy;
        newbornPred.push({ x: pred.x, y: pred.y, energy: childEnergy });
      }

      survivors.push(pred);
    }

    // Remove eaten prey efficiently by filtering once
    if (eatenPreyIdx.size > 0) {
      const keep = [];
      for (let i = 0; i < state.prey.length; i++) {
        if (!eatenPreyIdx.has(i)) keep.push(state.prey[i]);
      }
      state.prey = keep;
    }

    // Add newborn predators
    state.predators = survivors.concat(newbornPred);

    state.tick++;

    // Record for chart
    appendGraphPoint(state.tick, state.prey.length, state.predators.length);

    updateStats();
    draw();
  }

  function appendGraphPoint(t, preyN, predN) {
    if (!chart) return;
    const labels = chart.data.labels;
    const d0 = chart.data.datasets[0].data;
    const d1 = chart.data.datasets[1].data;
    labels.push(t);
    d0.push(preyN);
    d1.push(predN);
    const maxPoints = chart.maxPoints || 1000;
    if (labels.length > maxPoints) {
      labels.shift();
      d0.shift();
      d1.shift();
      // keep trend arrays in sync (they will be recomputed below anyway)
      if (chart.data.datasets[2].data.length) chart.data.datasets[2].data.shift();
      if (chart.data.datasets[3].data.length) chart.data.datasets[3].data.shift();
    }
    chart.computeTrends();
    chart.update('none');
  }

  function updateStats() {
    tickLabel.textContent = state.tick.toString();
    preyCountEl.textContent = state.prey.length.toString();
    predCountEl.textContent = state.predators.length.toString();
  }

  function draw() {
    const { W, H } = state;
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw prey
    ctx.fillStyle = '#58f0a7';
    for (let i = 0; i < state.prey.length; i++) {
      const p = state.prey[i];
      ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
    }

    // Draw predators
    ctx.fillStyle = '#ff6b6b';
    for (let i = 0; i < state.predators.length; i++) {
      const pr = state.predators[i];
      ctx.fillRect(pr.x * cellSize, pr.y * cellSize, cellSize, cellSize);
    }

    // Grid overlay (light)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) {
      const px = x * cellSize + 0.5; // crisp line
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      const py = y * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W * cellSize, py);
      ctx.stroke();
    }
  }

  function setRunning(running) {
    if (running) {
      if (timer) return;
      startPauseBtn.textContent = 'Pause';
      stepBtn.disabled = true;
      const tickInterval = parseInt(speedRange.value, 10) || 60;
      timer = setInterval(step, tickInterval);
    } else {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      startPauseBtn.textContent = 'Start';
      stepBtn.disabled = false;
    }
    if (modalStartPauseBtn) {
      modalStartPauseBtn.textContent = timer ? 'Pause' : 'Start';
    }
  }

  // Event listeners
  startPauseBtn.addEventListener('click', () => {
    setRunning(!timer);
  });

  stepBtn.addEventListener('click', () => {
    if (!timer) step();
  });

  resetBtn.addEventListener('click', () => {
    setRunning(false);
    initState();
  });

  // modelSelect is now fixed to agent-based; no change handler needed

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      applyPreset(presetSelect.value);
      // auto-reset to apply immediately
      setRunning(false);
      initState();
    });
  }

  speedRange.addEventListener('input', () => {
    const v = parseInt(speedRange.value, 10) || 60;
    speedLabel.textContent = `${v} ms/tick`;
    if (timer) {
      // restart timer with new speed
      clearInterval(timer);
      timer = setInterval(step, v);
    }
  });

  // Initialize
  speedLabel.textContent = `${speedRange.value} ms/tick`;
  // Apply the initial preset on load
  if (presetSelect) applyPreset(presetSelect.value || 'classic');
  initState();
  // Recompute layout when window resizes
  window.addEventListener('resize', () => {
    if (!state) return;
    // Re-init to recompute canvas size based on container; keep populations
    const { prey, predators, params, tick } = state;
    const W = clamp(parseInt(worldWidthInput.value, 10) || state.W, 20, 400);
    const H = clamp(parseInt(worldHeightInput.value, 10) || state.H, 20, 300);
    // Recompute canvas sizing without resetting agents
    const simPanel = document.querySelector('.panel.sim');
    const rect = simPanel ? simPanel.getBoundingClientRect() : { width: canvas.parentElement?.clientWidth || canvas.width, height: canvas.parentElement?.clientHeight || canvas.height };
    const maxCanvasWidth = Math.max(240, Math.floor(rect.width - 8));
    const maxCanvasHeight = Math.max(160, Math.floor(rect.height - 40));
    const sizeByW = Math.floor(maxCanvasWidth / W);
    const sizeByH = Math.floor(maxCanvasHeight / H);
    cellSize = Math.max(1, Math.min(8, Math.min(sizeByW, sizeByH)));
    canvas.width = Math.max(100, W * cellSize);
    canvas.height = Math.max(100, H * cellSize);
    draw();
  });

  // Full-screen chart modal logic: move canvas into modal host and back
  function openChartModal() {
    if (!chartModal || !chartCanvasContainer) return;
    chartModal.hidden = false;
    document.body.classList.add('no-scroll');
    chartModalHost.appendChild(popCanvas);
    // Resize for new container
    if (chart) chart.resize();
    if (modalStartPauseBtn) {
      modalStartPauseBtn.textContent = timer ? 'Pause' : 'Start';
    }
  }

  function closeChartModal() {
    if (!chartModal || !chartCanvasContainer) return;
    chartModal.hidden = true;
    document.body.classList.remove('no-scroll');
    chartCanvasContainer.appendChild(popCanvas);
    if (chart) chart.resize();
  }

  expandChartBtn?.addEventListener('click', openChartModal);
  closeChartBtn?.addEventListener('click', closeChartModal);
  chartModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeChartModal);

  // Modal keyboard shortcuts: ESC close, Space start/pause, R reset
  window.addEventListener('keydown', (e) => {
    if (!chartModal || chartModal.hidden) return;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
    if (e.key === 'Escape') {
      closeChartModal();
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault(); // avoid page scroll
      const running = !!timer;
      setRunning(!running);
      return;
    }
    if (e.key && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      setRunning(false);
      initState();
      return;
    }
  });

  // Trend lines toggle (panel and modal stay in sync)
  function setTrendVisibility(visible) {
    if (!chart) return;
    chart.data.datasets[2].hidden = !visible;
    chart.data.datasets[3].hidden = !visible;
    chart.update('none');
  }
  toggleMeanLines?.addEventListener('change', () => {
    const v = !!toggleMeanLines.checked;
    if (toggleMeanLinesModal) toggleMeanLinesModal.checked = v;
    setTrendVisibility(v);
  });
  toggleMeanLinesModal?.addEventListener('change', () => {
    const v = !!toggleMeanLinesModal.checked;
    if (toggleMeanLines) toggleMeanLines.checked = v;
    setTrendVisibility(v);
  });

  // Modal Start/Pause and Reset mirror the main controls
  modalStartPauseBtn?.addEventListener('click', () => {
    const running = !!timer;
    setRunning(!running);
    modalStartPauseBtn.textContent = running ? 'Start' : 'Pause';
  });
  modalResetBtn?.addEventListener('click', () => {
    setRunning(false);
    initState();
    // Reset button labels after reset
    const isRunning = !!timer;
    modalStartPauseBtn.textContent = isRunning ? 'Pause' : 'Start';
  });

  // Export PNG
  exportPngBtn?.addEventListener('click', () => {
    if (!chart) return;
    const link = document.createElement('a');
    link.download = 'populations.png';
    link.href = chart.toBase64Image('image/png', 1);
    link.click();
  });

  // Export CSV of current chart series
  exportCsvBtn?.addEventListener('click', () => {
    if (!chart) return;
    const labels = chart.data.labels;
    const prey = chart.data.datasets[0].data;
    const pred = chart.data.datasets[1].data;
    const header = 'tick,years,prey,predators\n';
    const rows = labels.map((t, i) => {
      const years = (Number(t) || 0) / 50;
      return `${t},${years.toFixed(3)},${prey[i] ?? ''},${pred[i] ?? ''}`;
    });
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'populations.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
})();
