# Atlas of Nations — Interactive Data Visualization System

DSC327 (Data Visualization Techniques) — Lab Terminal Project, CLO 5

An interactive, web-based visualization system built with **D3.js v7** that
explores the Gapminder dataset: GDP per capita, life expectancy, and
population for 142 countries from 1952 to 2007.

---

## What's inside

```
project/
├── index.html          Page structure (3 linked views)
├── css/
│   └── style.css        Design system + layout (no framework)
├── js/
│   ├── data.js           Dataset, embedded as a JS array (no server/CORS needed)
│   └── script.js          All D3 logic: scales, charts, interactions
├── vendor/
│   └── d3.v7.min.js       D3.js library, bundled locally
├── data/
│   └── gapminder.csv      Original source CSV (kept for reference / reuse)
└── docs/
    └── Design_Documentation_Report.docx
```

## How to run it

**Option A — just open it.**
Because the dataset is embedded directly in `js/data.js` (not fetched via
`fetch()`), there is no CORS restriction. Double-click `index.html` and it
will run in any modern browser, no server required.

**Option B — local server (optional, for development).**
```bash
cd project
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to host it on GitHub Pages (per the assignment instructions)

1. Push the contents of `project/` to a GitHub repository (keep `index.html`
   at the repo root, or in a `/docs` folder if you prefer that Pages source).
2. In the repo, go to **Settings → Pages**.
3. Set **Source** to the branch/folder containing `index.html`.
4. GitHub will publish at `https://<username>.github.io/<repo-name>/`.

No build step is required — everything is plain HTML/CSS/JS.

## What you can do in the app

| Section | Interaction |
|---|---|
| **The Wealth & Health of Nations** (bubble chart) | Drag the year scrubber or press play to animate 1952→2007; swap X/Y axes between GDP, life expectancy, and population; click a continent in the legend to isolate/hide it; type a country name to highlight it; scroll/pinch to zoom, drag to pan |
| **Who Leads, Who Lags** (bar chart) | Switch the ranking measure; toggle Top 10 / Bottom 10; click any bar to load that country into the trend chart below |
| **A Country's Path Through Time** (line chart) | Pick any of the 142 countries and any measure to see its 1952–2007 trend, with a hoverable tooltip on each year |

## Browser support

Tested in Chromium. Uses standard ES6+ JavaScript and SVG — works in any
current version of Chrome, Firefox, Edge, or Safari. No IE11 support.

## Dataset

Source: Gapminder Foundation, distributed via the `plotly/datasets`
GitHub repository (`gapminderDataFiveYear.csv`). 1,704 rows, 6 columns,
no missing values. See the Design Documentation Report for the full
dataset overview, preprocessing notes, and EDA.
