/* ==========================================================================
   Atlas of Nations — D3.js application logic
   DSC327 Lab Terminal Project
   --------------------------------------------------------------------------
   Structure:
     1. Shared state & helpers
     2. Scatter plot ("The Time Machine") — bubble chart with year scrubber,
        zoom/pan, continent filtering, search, and tooltips
     3. Bar chart ("Who Leads, Who Lags") — top/bottom 10 ranking
     4. Line chart ("A Country's Path Through Time") — single-country trend
     5. Wiring: cross-chart interaction (clicking a bar drives the trend chart)
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * 1. SHARED STATE & HELPERS
   * ------------------------------------------------------------------ */

  const DATA = GAPMINDER_DATA; // loaded from js/data.js
  const YEARS = Array.from(new Set(DATA.map((d) => d.year))).sort((a, b) => a - b);
  const CONTINENTS = Array.from(new Set(DATA.map((d) => d.continent))).sort();
  const COUNTRIES = Array.from(new Set(DATA.map((d) => d.country))).sort();

  const CONTINENT_COLOR = {
    Africa: "#E07A5F",
    Americas: "#81B29A",
    Asia: "#E8B95A",
    Europe: "#5B9BD5",
    Oceania: "#B388C9",
  };

  const METRIC_LABEL = {
    lifeExp: "Life expectancy (years)",
    gdpPercap: "GDP per capita ($)",
    pop: "Population",
  };

  const fmt = {
    lifeExp: (v) => v.toFixed(1) + " yrs",
    gdpPercap: (v) => "$" + d3.format(",.0f")(v),
    pop: (v) => d3.format(".3s")(v).replace("G", "B"),
  };

  // Application state, mutated by UI controls
  const state = {
    yearIndex: YEARS.length - 1, // start at 2007
    xMetric: "gdpPercap",
    yMetric: "lifeExp",
    activeContinents: new Set(CONTINENTS),
    searchedCountry: null,
    rankMetric: "lifeExp",
    rankDirection: "top",
    trendCountry: "Pakistan",
    trendMetric: "lifeExp",
    playing: false,
    timer: null,
  };

  function dataForYear(year) {
    return DATA.filter((d) => d.year === year);
  }

  function rowsForCountry(country) {
    return DATA.filter((d) => d.country === country).sort((a, b) => a.year - b.year);
  }

  /* ------------------------------------------------------------------ *
   * 2. SCATTER PLOT — "The Time Machine"
   * ------------------------------------------------------------------ */

  const scatterMargin = { top: 24, right: 28, bottom: 50, left: 64 };
  let scatterWidth = 760;
  let scatterHeight = 520;

  const scatterSvg = d3.select("#scatter");
  const scatterRoot = scatterSvg.append("g").attr("class", "scatter-root");
  const zoomLayer = scatterRoot.append("g").attr("class", "zoom-layer");
  const gridLayerX = zoomLayer.append("g").attr("class", "grid grid-x");
  const gridLayerY = zoomLayer.append("g").attr("class", "grid grid-y");
  const bubbleLayer = zoomLayer.append("g").attr("class", "bubble-layer");
  const xAxisG = scatterRoot.append("g").attr("class", "axis axis-x");
  const yAxisG = scatterRoot.append("g").attr("class", "axis axis-y");
  const xLabel = scatterRoot.append("text").attr("class", "axis-label").attr("text-anchor", "middle");
  const yLabel = scatterRoot.append("text").attr("class", "axis-label").attr("text-anchor", "middle");

  let xScale, yScale, rScale, currentZoomTransform = d3.zoomIdentity;

  function buildScales() {
    const allX = DATA.map((d) => d[state.xMetric]);
    const allY = DATA.map((d) => d[state.yMetric]);
    const allPop = DATA.map((d) => d.pop);

    const xBuilder = state.xMetric === "gdpPercap" ? d3.scaleLog : d3.scaleLinear;
    const yBuilder = state.yMetric === "gdpPercap" ? d3.scaleLog : d3.scaleLinear;

    xScale = xBuilder()
      .domain(state.xMetric === "gdpPercap" ? [Math.max(1, d3.min(allX) * 0.9), d3.max(allX) * 1.1] : [d3.min(allX) * 0.95, d3.max(allX) * 1.05])
      .range([scatterMargin.left, scatterWidth - scatterMargin.right])
      .nice();

    yScale = yBuilder()
      .domain(state.yMetric === "gdpPercap" ? [Math.max(1, d3.min(allY) * 0.9), d3.max(allY) * 1.1] : [d3.min(allY) * 0.92, d3.max(allY) * 1.08])
      .range([scatterHeight - scatterMargin.bottom, scatterMargin.top])
      .nice();

    rScale = d3.scaleSqrt().domain([d3.min(allPop), d3.max(allPop)]).range([4, 38]);
  }

  function drawScatterAxes() {
    const xAxis = d3.axisBottom(xScale).ticks(6, state.xMetric === "gdpPercap" ? "~s" : null);
    const yAxis = d3.axisLeft(yScale).ticks(6, state.yMetric === "gdpPercap" ? "~s" : null);
    xAxisG.attr("transform", `translate(0,${scatterHeight - scatterMargin.bottom})`).call(xAxis);
    yAxisG.attr("transform", `translate(${scatterMargin.left},0)`).call(yAxis);

    xLabel.attr("x", (scatterWidth) / 2).attr("y", scatterHeight - 8).text(METRIC_LABEL[state.xMetric]);
    yLabel
      .attr("x", -scatterHeight / 2)
      .attr("y", 18)
      .attr("transform", "rotate(-90)")
      .text(METRIC_LABEL[state.yMetric]);

    gridLayerX
      .selectAll("line")
      .data(yScale.ticks(6))
      .join("line")
      .attr("class", "grid-line")
      .attr("x1", scatterMargin.left)
      .attr("x2", scatterWidth - scatterMargin.right)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d));
  }

  const tooltip = d3.select("#scatter-tooltip");

  function showTooltip(event, d) {
    tooltip
      .style("left", event.offsetX + 16 + "px")
      .style("top", event.offsetY - 10 + "px")
      .html(
        `<div class="t-country">${d.country}</div>
         <div class="t-row"><span>Continent</span><span>${d.continent}</span></div>
         <div class="t-row"><span>Life exp.</span><span>${fmt.lifeExp(d.lifeExp)}</span></div>
         <div class="t-row"><span>GDP / capita</span><span>${fmt.gdpPercap(d.gdpPercap)}</span></div>
         <div class="t-row"><span>Population</span><span>${fmt.pop(d.pop)}</span></div>`
      )
      .attr("hidden", null);
  }
  function hideTooltip() {
    tooltip.attr("hidden", true);
  }

  function drawBubbles() {
    const year = YEARS[state.yearIndex];
    const rows = dataForYear(year);

    const sel = bubbleLayer
      .selectAll("circle.bubble")
      .data(rows, (d) => d.country);

    sel
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "bubble")
            .attr("cx", (d) => xScale(Math.max(d[state.xMetric], xScale.domain()[0])))
            .attr("cy", (d) => yScale(Math.max(d[state.yMetric], yScale.domain()[0])))
            .attr("r", 0)
            .attr("fill", (d) => CONTINENT_COLOR[d.continent])
            .attr("fill-opacity", 0.78)
            .attr("stroke", (d) => d3.color(CONTINENT_COLOR[d.continent]).darker(0.6))
            .attr("stroke-width", 0.8)
            .call((e) => e.transition().duration(400).attr("r", (d) => rScale(d.pop))),
        (update) =>
          update.call((u) =>
            u
              .transition()
              .duration(450)
              .ease(d3.easeCubicOut)
              .attr("cx", (d) => xScale(Math.max(d[state.xMetric], xScale.domain()[0])))
              .attr("cy", (d) => yScale(Math.max(d[state.yMetric], yScale.domain()[0])))
              .attr("r", (d) => rScale(d.pop))
          ),
        (exit) => exit.transition().duration(250).attr("r", 0).remove()
      )
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("stroke-width", 2);
        showTooltip(event, d);
      })
      .on("mousemove", (event, d) => showTooltip(event, d))
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-width", 0.8);
        hideTooltip();
      });

    applyContinentFilter();
    applySearchHighlight();
  }

  function applyContinentFilter() {
    bubbleLayer
      .selectAll("circle.bubble")
      .classed("dimmed", (d) => !state.activeContinents.has(d.continent));
  }

  function applySearchHighlight() {
    bubbleLayer.selectAll(".bubble-highlight").remove();
    if (!state.searchedCountry) return;
    const year = YEARS[state.yearIndex];
    const row = DATA.find((d) => d.country === state.searchedCountry && d.year === year);
    if (!row) return;
    bubbleLayer
      .append("circle")
      .attr("class", "bubble-highlight")
      .attr("cx", xScale(row[state.xMetric]))
      .attr("cy", yScale(row[state.yMetric]))
      .attr("r", rScale(row.pop) + 5);
  }

  function buildLegend() {
    const legend = d3.select("#legend");
    const items = legend.selectAll(".legend-item").data(CONTINENTS).join("div").attr("class", "legend-item");
    items.html("");
    items.each(function (continent) {
      const item = d3.select(this);
      item.append("span").attr("class", "legend-swatch").style("background", CONTINENT_COLOR[continent]);
      item.append("span").text(continent);
    });
    items.on("click", function (event, continent) {
      if (state.activeContinents.has(continent)) {
        state.activeContinents.delete(continent);
      } else {
        state.activeContinents.add(continent);
      }
      d3.select(this).classed("off", !state.activeContinents.has(continent));
      applyContinentFilter();
    });
  }

  function setupZoom() {
    const zoom = d3
      .zoom()
      .scaleExtent([1, 12])
      .translateExtent([
        [0, 0],
        [scatterWidth, scatterHeight],
      ])
      .on("zoom", (event) => {
        currentZoomTransform = event.transform;
        zoomLayer.attr("transform", event.transform);
        zoomLayer.selectAll("circle.bubble").attr("stroke-width", 0.8 / event.transform.k);
      });
    scatterSvg.call(zoom);

    d3.select("#zoom-reset").on("click", () => {
      scatterSvg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });
  }

  function resizeScatter() {
    const containerWidth = document.querySelector(".chart-wrap").clientWidth;
    scatterWidth = containerWidth;
    scatterHeight = Math.max(380, Math.min(560, containerWidth * 0.62));
    scatterSvg.attr("viewBox", `0 0 ${scatterWidth} ${scatterHeight}`);
    buildScales();
    drawScatterAxes();
    drawBubbles();
  }

  function initScatter() {
    buildLegend();
    setupZoom();
    resizeScatter();
    window.addEventListener("resize", debounce(resizeScatter, 200));
  }

  /* ------------------------------------------------------------------ *
   * Year slider + play/pause
   * ------------------------------------------------------------------ */

  function initYearControl() {
    const slider = d3.select("#year-slider");
    const readout = d3.select("#year-readout");

    slider.on("input", function () {
      state.yearIndex = +this.value;
      readout.text(YEARS[state.yearIndex]);
      drawBubbles();
    });

    d3.select("#play-btn").on("click", togglePlay);
  }

  function togglePlay() {
    state.playing = !state.playing;
    d3.select("#play-icon").attr("hidden", state.playing ? true : null);
    d3.select("#pause-icon").attr("hidden", state.playing ? null : true);

    if (state.playing) {
      state.timer = setInterval(() => {
        state.yearIndex = (state.yearIndex + 1) % YEARS.length;
        d3.select("#year-slider").property("value", state.yearIndex);
        d3.select("#year-readout").text(YEARS[state.yearIndex]);
        drawBubbles();
        if (state.yearIndex === YEARS.length - 1) {
          stopPlay();
        }
      }, 900);
    } else {
      stopPlay();
    }
  }

  function stopPlay() {
    clearInterval(state.timer);
    state.playing = false;
    d3.select("#play-icon").attr("hidden", null);
    d3.select("#pause-icon").attr("hidden", true);
  }

  /* ------------------------------------------------------------------ *
   * Axis selectors + search
   * ------------------------------------------------------------------ */

  function initAxisControls() {
    d3.select("#x-axis-select").on("change", function () {
      state.xMetric = this.value;
      resizeScatter();
    });
    d3.select("#y-axis-select").on("change", function () {
      state.yMetric = this.value;
      resizeScatter();
    });
  }

  function initSearch() {
    const datalist = d3.select("#country-list");
    datalist
      .selectAll("option")
      .data(COUNTRIES)
      .join("option")
      .attr("value", (d) => d);

    d3.select("#country-search").on("input", function () {
      const val = this.value.trim();
      state.searchedCountry = COUNTRIES.includes(val) ? val : null;
      applySearchHighlight();
    });
  }

  /* ------------------------------------------------------------------ *
   * 3. BAR CHART — "Who Leads, Who Lags"
   * ------------------------------------------------------------------ */

  const barMargin = { top: 16, right: 70, bottom: 16, left: 168 };
  let barWidth = 760;
  let barHeight = 420;
  const barSvg = d3.select("#bars");
  const barRoot = barSvg.append("g");

  function drawBars() {
    const year = YEARS[state.yearIndex];
    const rows = dataForYear(year)
      .slice()
      .sort((a, b) => d3.descending(a[state.rankMetric], b[state.rankMetric]));

    const slice = state.rankDirection === "top" ? rows.slice(0, 10) : rows.slice(-10).reverse();

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(slice, (d) => d[state.rankMetric]) * 1.05])
      .range([barMargin.left, barWidth - barMargin.right]);

    const y = d3
      .scaleBand()
      .domain(slice.map((d) => d.country))
      .range([barMargin.top, barHeight - barMargin.bottom])
      .padding(0.28);

    barSvg.attr("viewBox", `0 0 ${barWidth} ${barHeight}`);

    const bars = barRoot.selectAll("rect.bar").data(slice, (d) => d.country);
    bars
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "bar")
            .attr("x", x(0))
            .attr("y", (d) => y(d.country))
            .attr("height", y.bandwidth())
            .attr("width", 0)
            .attr("fill", (d) => CONTINENT_COLOR[d.continent])
            .call((e) => e.transition().duration(400).attr("width", (d) => x(d[state.rankMetric]) - x(0))),
        (update) =>
          update.call((u) =>
            u
              .transition()
              .duration(400)
              .attr("y", (d) => y(d.country))
              .attr("width", (d) => x(d[state.rankMetric]) - x(0))
          ),
        (exit) => exit.transition().duration(200).attr("width", 0).remove()
      )
      .on("click", (event, d) => {
        state.trendCountry = d.country;
        d3.select("#trend-country").property("value", d.country);
        drawLine();
        document.querySelector("#trend").scrollIntoView({ behavior: "smooth", block: "start" });
      });

    const labels = barRoot.selectAll("text.bar-label").data(slice, (d) => d.country);
    labels
      .join("text")
      .attr("class", "bar-label")
      .attr("x", barMargin.left - 10)
      .attr("y", (d) => y(d.country) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text((d) => d.country);

    const values = barRoot.selectAll("text.bar-value").data(slice, (d) => d.country);
    values
      .join("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d[state.rankMetric]) + 8)
      .attr("y", (d) => y(d.country) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text((d) => fmt[state.rankMetric](d[state.rankMetric]));
  }

  function initBars() {
    barWidth = document.querySelector("#bars").clientWidth || 760;
    barHeight = 420;

    d3.select("#rank-metric").on("change", function () {
      state.rankMetric = this.value;
      drawBars();
    });

    d3.selectAll(".seg-btn").on("click", function () {
      d3.selectAll(".seg-btn").classed("active", false);
      d3.select(this).classed("active", true);
      state.rankDirection = this.dataset.dir;
      drawBars();
    });

    window.addEventListener(
      "resize",
      debounce(() => {
        barWidth = document.querySelector("#bars").clientWidth || 760;
        drawBars();
      }, 200)
    );

    drawBars();
  }

  /* ------------------------------------------------------------------ *
   * 4. LINE CHART — "A Country's Path Through Time"
   * ------------------------------------------------------------------ */

  const lineMargin = { top: 20, right: 28, bottom: 36, left: 64 };
  let lineWidth = 760;
  let lineHeight = 360;
  const lineSvg = d3.select("#line");
  const lineRoot = lineSvg.append("g");
  const lineAxisX = lineRoot.append("g").attr("class", "axis");
  const lineAxisY = lineRoot.append("g").attr("class", "axis");

  function drawLine() {
    const rows = rowsForCountry(state.trendCountry);
    const metric = state.trendMetric;

    const x = d3
      .scaleLinear()
      .domain(d3.extent(YEARS))
      .range([lineMargin.left, lineWidth - lineMargin.right]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d[metric]) * 1.15])
      .range([lineHeight - lineMargin.bottom, lineMargin.top])
      .nice();

    lineSvg.attr("viewBox", `0 0 ${lineWidth} ${lineHeight}`);

    lineAxisX.attr("transform", `translate(0,${lineHeight - lineMargin.bottom})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
    lineAxisY.attr("transform", `translate(${lineMargin.left},0)`).call(d3.axisLeft(y).ticks(5, metric === "pop" ? "~s" : null));

    const area = d3
      .area()
      .x((d) => x(d.year))
      .y0(lineHeight - lineMargin.bottom)
      .y1((d) => y(d[metric]))
      .curve(d3.curveMonotoneX);

    const line = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d[metric]))
      .curve(d3.curveMonotoneX);

    lineRoot.selectAll("path.line-area").data([rows]).join("path").attr("class", "line-area").transition().duration(400).attr("d", area);

    lineRoot.selectAll("path.line-path").data([rows]).join("path").attr("class", "line-path").transition().duration(400).attr("d", line);

    const dots = lineRoot.selectAll("circle.line-dot").data(rows, (d) => d.year);
    dots
      .join("circle")
      .attr("class", "line-dot")
      .attr("r", 4)
      .transition()
      .duration(400)
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d[metric]));

    lineRoot
      .selectAll("circle.line-dot")
      .on("mouseenter", function (event, d) {
        showTooltip(event, d);
        tooltip.style("left", event.offsetX + lineSvg.node().getBoundingClientRect().left - scatterSvg.node().getBoundingClientRect().left + 16 + "px");
      })
      .on("mouseleave", hideTooltip);
  }

  function initLine() {
    lineWidth = document.querySelector("#line").clientWidth || 760;

    const select = d3.select("#trend-country");
    select.selectAll("option").data(COUNTRIES).join("option").attr("value", (d) => d).text((d) => d);
    select.property("value", state.trendCountry);
    select.on("change", function () {
      state.trendCountry = this.value;
      drawLine();
    });

    d3.select("#trend-metric").on("change", function () {
      state.trendMetric = this.value;
      drawLine();
    });

    window.addEventListener(
      "resize",
      debounce(() => {
        lineWidth = document.querySelector("#line").clientWidth || 760;
        drawLine();
      }, 200)
    );

    drawLine();
  }

  /* ------------------------------------------------------------------ *
   * 5. UTIL + BOOTSTRAP
   * ------------------------------------------------------------------ */

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    initScatter();
    initYearControl();
    initAxisControls();
    initSearch();
    initBars();
    initLine();
  });
})();
