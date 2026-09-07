# Shade 2050

Shade 2050 is a portfolio-quality urban planning decision-support prototype for Melbourne. It lets planners select an area, configure a tree-planting scenario, and compare current conditions with no-intervention and planting outcomes for 2035 or 2050.

## Run locally

```bash
npm install
npm run dev
```

The app uses React, TypeScript, Tailwind CSS, Leaflet with OpenStreetMap tiles, Recharts, Lucide icons, and the bundled accessible UI primitives. Scenario data is mocked and recalculated in the browser; no API keys or backend are required.

## Project structure

- `app/page.tsx` — lightweight product home page and current-priority preview
- `app/scenario/page.tsx` — interactive scenario planner, map, results, Model B analytics, and street comparison
- `app/components/live-map.tsx` — live Melbourne map that moves by area and renders the requested number of proposed trees
- `app/priority/page.tsx` — 13-area priority ranking based on heat, canopy deficit, and vulnerability
- `app/data.ts` — area baselines, priority inputs, species reference data, recursive growth curve generator, and scenario calculations
- `app/globals.css` — complete responsive visual system
- `public/shade-2050-carlton-streetscape-comparison.png` — original three-stage Carlton streetscape visual

## Model B

Model B is represented by `makeGrowthData()` and `calculateScenario()` in `app/data.ts`. It recursively projects species-specific crown area through 2050, derives crown radius, aggregates the per-tree forecasts for the planting scenario, and exposes reference-range and confidence information in the Model B results tab.

This version intentionally uses credible demo assumptions and precomputed-style data for product storytelling. The same data interface can later be replaced by an API response from a trained forecasting service.
