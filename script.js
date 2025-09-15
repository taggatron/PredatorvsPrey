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
  const speedRange = document.getElementById('speedRange');
  const speedLabel = document.getElementById('speedLabel');
  const tickLabel = document.getElementById('tickLabel');
  const preyCountEl = document.getElementById('preyCount');
  const predCountEl = document.getElementById('predCount');

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

  // Chart
  const popCanvas = document.getElementById('popChart');
  const chartWarning = document.getElementById('chartWarning');
  let chart;

  // Simulation state
  let state = null;
  let timer = null;
  let cellSize = 7; // pixels per cell for drawing

  // Utilities
  const randInt = (n) => Math.floor(Math.random() * n);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function initState() {
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

    const initPrey = clamp(parseInt(initPreyInput.value, 10) || 800, 0, 20000);
    const initPred = clamp(parseInt(initPredatorsInput.value, 10) || 120, 0, 20000);
    const preyReproProb = clamp(parseFloat(preyReproProbInput.value) || 0.05, 0, 1);
    const predReproProb = clamp(parseFloat(predReproProbInput.value) || 0.02, 0, 1);
    const predMetabolism = clamp(parseFloat(predMetabolismInput.value) || 1.0, 0, 20);
    const energyPerPrey = clamp(parseFloat(energyPerPreyInput.value) || 10, 0, 100);
    const predReproEnergy = clamp(parseFloat(predReproEnergyInput.value) || 30, 0, 200);
    const maxGraphPoints = clamp(parseInt(maxGraphPointsInput.value, 10) || 1000, 50, 5000);

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
      W, H,
      prey,
      predators,
      tick: 0,
      params: { preyReproProb, predReproProb, predMetabolism, energyPerPrey, predReproEnergy, maxGraphPoints },
      graph: { t: [], prey: [], pred: [] },
    };

    resetChart(maxGraphPoints);
    updateStats();
    draw();
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
          },
          {
            label: 'Predators',
            data: [],
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255,107,107,0.15)',
            tension: 0.15,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        maintainAspectRatio: false, // let CSS control height
        plugins: {
          legend: { labels: { color: '#e5e7ef' } },
        },
        scales: {
          x: { ticks: { color: '#97a0b5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#97a0b5' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
    // store max points in chart for clipping
    chart.maxPoints = maxPoints;
  }

  function wrap(n, max) { return (n + max) % max; }

  function moveAgent(agent, W, H) {
    // Moore neighborhood random step
    const dx = randInt(3) - 1; // -1,0,1
    const dy = randInt(3) - 1;
    agent.x = wrap(agent.x + dx, W);
    agent.y = wrap(agent.y + dy, H);
  }

  function step() {
    if (!state) return;
    const { W, H, params } = state;

    // Move prey and handle reproduction
    const newPrey = [];
    for (let i = 0; i < state.prey.length; i++) {
      const p = state.prey[i];
      moveAgent(p, W, H);
      newPrey.push(p);
      if (Math.random() < params.preyReproProb) {
        newPrey.push({ x: p.x, y: p.y });
      }
    }
    state.prey = newPrey;

    // Build grid index to speed up predation lookups
    const preyIndex = new Map(); // key: y*W + x -> array indices
    for (let i = 0; i < state.prey.length; i++) {
      const p = state.prey[i];
      const key = p.y * W + p.x;
      let arr = preyIndex.get(key);
      if (!arr) { arr = []; preyIndex.set(key, arr); }
      arr.push(i);
    }

    // Predators: move, eat one prey if present, lose metabolism, reproduce probabilistically if energy high enough
    const survivors = [];
    const newbornPred = [];
    const eatenPreyIdx = new Set();
    for (let i = 0; i < state.predators.length; i++) {
      const pred = state.predators[i];
      moveAgent(pred, W, H);

      // Eat one prey on same cell, if any
      const key = pred.y * W + pred.x;
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
    }
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
})();
