# Predator vs Prey — Interactive Ecosystem

An agent-based predator–prey simulation rendered on an HTML canvas with a live Chart.js graph of populations over time.

## Run it

- Double-click `index.html` to open it in your browser (Chrome, Safari, Edge).
- No build or server is required.

If your browser restricts file access and the page looks blank, you can serve it locally with any static server, e.g. Python 3:

```bash
# from the project folder
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Controls

- Start / Pause: toggle the simulation.
- Step: advance one tick when paused.
- Reset: stop and reinitialize with current parameters.
- Speed: adjust milliseconds per tick.
- Initialization: world size and starting populations.
- Model parameters:
  - Prey reproduction probability per tick.
  - Predator reproduction probability per tick (if energy threshold is met).
  - Predator metabolism (energy cost per tick).
  - Energy per prey eaten.
  - Predator reproduce energy threshold.
  - Max graph points: rolling window size for the live chart.

Live stats are displayed below the controls. The world wraps around edges (toroidal).

## Model overview

This is a simple agent-based model:

- World: W×H grid; multiple agents can share a cell; edges wrap (toroidal).
- Prey (green): move randomly each tick; reproduce with probability `preyReproProb`.
- Predators (red): move randomly; if sharing a cell with prey, they eat at most one prey and gain `energyPerPrey` energy. Each tick they lose `predMetabolism` energy. If energy ≤ 0 they die. If energy ≥ `predReproEnergy`, they reproduce with probability `predReproProb`, splitting energy with the offspring.

The line chart shows the number of prey and predators by tick. The chart uses a rolling window with a maximum number of points.

## Notes and ideas

- You can increase the world size and populations, but very large numbers may slow rendering. Reduce grid overlay or cell size for performance tweaks.
- Alternative dynamics: logistic prey reproduction, vision radius, directional chasing, carrying capacity, disease, obstacles.
- Export data: you can copy series from the devtools console by accessing `chart.data.datasets` (Chart.js is available globally).

## Files

- `index.html` – page structure, Chart.js import, and script bootstrap
- `styles.css` – layout and theme
- `script.js` – the simulation engine, rendering, controls, and chart integration

## Troubleshooting

- Nothing displays: check browser console for errors; ensure `index.html`, `styles.css`, and `script.js` are all in the same folder.
- Chart not visible: some content blockers may block CDNs. Try the local server method above or an alternative network.

---

Made with vanilla JS, Canvas, and Chart.js.