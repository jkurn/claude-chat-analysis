/* ───────────────────────────────────────────────────────────────────────────
   Inside the Machine Mind — Scrollytelling D3.js Visualizations
   ─────────────────────────────────────────────────────────────────────────── */

'use strict';

const DATA = {};
const STATE = {};

const TOPIC_COLORS = [
  "#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e",
  "#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6",
  "#6366f1","#d946ef","#fb7185"
];

// ═══════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadData() {
  const files = [
    'data/stats.json', 'data/topics.json', 'data/umap.json',
    'data/graph.json', 'data/insights.json',
  ];
  const results = await Promise.all(
    files.map(f => fetch(f).then(r => r.json()).catch(() => null))
  );
  DATA.stats    = results[0];
  DATA.topics   = results[1];
  DATA.umap     = results[2];
  DATA.graph    = results[3];
  DATA.insights = results[4];
}

// ═══════════════════════════════════════════════════════════════════════════
// SCROLL SYSTEM (IntersectionObserver on .step elements)
// ═══════════════════════════════════════════════════════════════════════════

function setupScrollama() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const step = entry.target;
      const section = step.closest('.scroll-section');
      if (!section) return;
      const sectionId = section.id;
      const stepIndex = parseInt(step.dataset.step);

      // Activate step card visually
      section.querySelectorAll('.step').forEach(s =>
        s.classList.toggle('active', s === step)
      );

      // Dispatch to section handler
      handleStepEnter(sectionId, stepIndex);
    });
  }, { threshold: 0.5, rootMargin: '-10% 0px -10% 0px' });

  document.querySelectorAll('.step').forEach(el => observer.observe(el));
}

function handleStepEnter(sectionId, stepIndex) {
  const prev = STATE[sectionId + '_step'];
  if (prev === stepIndex) return;
  STATE[sectionId + '_step'] = stepIndex;

  switch (sectionId) {
    case 'landscape':     updateLandscapeStep(stepIndex); break;
    case 'obsessions':    updateObsessionsStep(stepIndex); break;
    case 'library':       updateLibraryStep(stepIndex); break;
    case 'dual-life':     updateDualLifeStep(stepIndex); break;
    case 'threads':       updateThreadsStep(stepIndex); break;
    case 'meta-cognitive': updateMetaCogStep(stepIndex); break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: HERO — Animated Counters
// ═══════════════════════════════════════════════════════════════════════════

function animateCounters() {
  document.querySelectorAll('.stat-value[data-target]').forEach(el => {
    const target = +el.dataset.target;
    const suffix = el.dataset.suffix || '';
    const duration = 1800;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = Math.round(target * ease);
      el.textContent = val.toLocaleString() + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: LANDSCAPE — UMAP Galaxy (Scrollytelling)
// ═══════════════════════════════════════════════════════════════════════════

function initLandscapeChart() {
  const W = 900, H = 620;

  const svg = d3.select('#landscape-svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Starfield background
  const bgGroup = svg.append('g').attr('class', 'bg');
  for (let i = 0; i < 200; i++) {
    bgGroup.append('circle')
      .attr('cx', Math.random() * W)
      .attr('cy', Math.random() * H)
      .attr('r', Math.random() * 0.8 + 0.2)
      .attr('fill', `rgba(255,255,255,${Math.random() * 0.15 + 0.02})`);
  }

  const points = DATA.umap.points;
  const pad = 40;
  const xExt = d3.extent(points, d => d.x);
  const yExt = d3.extent(points, d => d.y);
  // Add 5% padding to extent
  const xPad = (xExt[1] - xExt[0]) * 0.05;
  const yPad = (yExt[1] - yExt[0]) * 0.05;
  const xScale = d3.scaleLinear().domain([xExt[0] - xPad, xExt[1] + xPad]).range([pad, W - pad]);
  const yScale = d3.scaleLinear().domain([yExt[0] - yPad, yExt[1] + yPad]).range([pad, H - pad]);

  const dotGroup = svg.append('g').attr('class', 'dots');

  // Topic color lookup from topics.json
  const topicColorMap = {};
  const topicLabelMap = {};
  if (DATA.topics) {
    DATA.topics.topics.forEach(t => {
      topicColorMap[t.id] = t.color;
      topicLabelMap[t.id] = t.label;
    });
  }

  dotGroup.selectAll('.dot')
    .data(points)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', 2.5)
    .attr('fill', '#333')
    .attr('opacity', 0);

  STATE.landscape = { svg, dotGroup, xScale, yScale, W, H, topicColorMap, topicLabelMap };
}

function updateLandscapeStep(step) {
  if (!STATE.landscape) return;
  const { dotGroup, topicColorMap, topicLabelMap, svg, W, H } = STATE.landscape;
  const dots = dotGroup.selectAll('.dot');

  // Remove previous annotations
  svg.selectAll('.annotation').remove();

  switch (step) {
    case 0:
      dots.transition()
        .delay((d, i) => Math.floor(i / 30) * 20)
        .duration(600)
        .attr('opacity', 0.7)
        .attr('fill', '#7c6bff')
        .attr('r', 2.5);
      break;

    case 1:
      dots.transition().duration(600)
        .attr('fill', d => topicColorMap[d.topic] || '#555')
        .attr('opacity', 0.7)
        .attr('r', 2.5);
      buildLandscapeLegend(topicLabelMap, topicColorMap);
      break;

    case 2: highlightTopics(dots, new Set([1]), topicColorMap); break;
    case 3: highlightTopics(dots, new Set([5]), topicColorMap); break;
    case 4: highlightTopics(dots, new Set([0, 6, 15, 17]), topicColorMap); break;

    case 5:
      dots.transition().duration(600)
        .attr('fill', d => topicColorMap[d.topic] || '#555')
        .attr('opacity', 0.7)
        .attr('r', 2.5);
      break;
  }
}

function highlightTopics(dots, topicSet, colorMap) {
  dots.transition().duration(400)
    .attr('opacity', d => topicSet.has(d.topic) ? 0.9 : 0.05)
    .attr('r', d => topicSet.has(d.topic) ? 4 : 1.5)
    .attr('fill', d => topicSet.has(d.topic) ? (colorMap[d.topic] || '#888') : '#1a1a26');
}

function buildLandscapeLegend(labelMap, colorMap) {
  const container = document.getElementById('landscape-legend');
  if (!container || container.children.length > 0) return;
  const counts = {};
  DATA.umap.points.forEach(p => { counts[p.topic] = (counts[p.topic] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  sorted.forEach(([tid, cnt]) => {
    const id = +tid;
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-dot" style="background:${colorMap[id] || '#555'}"></div>
      <span>${labelMap[id] || 'Topic ' + id} (${cnt})</span>`;
    container.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: OBSESSIONS — Horizontal Bar Chart
// ═══════════════════════════════════════════════════════════════════════════

function initObsessionsChart() {
  const W = 900, H = 620;
  const margin = { top: 20, right: 60, bottom: 30, left: 200 };

  const svg = d3.select('#obsessions-svg')
    .attr('viewBox', `0 0 ${W} ${H}`);

  const scores = DATA.insights.obsession_scores.slice(0, 18);

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(scores, d => d.obsession_score) * 1.1])
    .range([margin.left, W - margin.right]);

  const yScale = d3.scaleBand()
    .domain(scores.map(d => d.label))
    .range([margin.top, H - margin.bottom])
    .padding(0.25);

  // Y axis
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(yScale).tickSize(0))
    .select('.domain').remove();

  svg.selectAll('.axis text')
    .style('fill', '#6e6e8a')
    .style('font-size', '11px');

  // Bars (start at 0 width)
  svg.selectAll('.bar')
    .data(scores)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', margin.left)
    .attr('y', d => yScale(d.label))
    .attr('width', 0)
    .attr('height', yScale.bandwidth())
    .attr('fill', d => d.color)
    .attr('rx', 3)
    .attr('opacity', 0.8);

  // Score labels
  svg.selectAll('.score-label')
    .data(scores)
    .enter().append('text')
    .attr('class', 'score-label')
    .attr('x', margin.left)
    .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('fill', '#6e6e8a')
    .attr('font-size', '10px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('opacity', 0)
    .text(d => d.obsession_score.toFixed(0));

  STATE.obsessions = { svg, xScale, yScale, scores, margin, W, H };
}

function updateObsessionsStep(step) {
  if (!STATE.obsessions) return;
  const { svg, xScale, yScale, scores, margin } = STATE.obsessions;
  const bars = svg.selectAll('.bar');
  const labels = svg.selectAll('.score-label');

  svg.selectAll('.annotation').remove();

  switch (step) {
    case 0:
      // All bars animate in
      bars.transition().duration(800).delay((d, i) => i * 40)
        .attr('width', d => xScale(d.obsession_score) - margin.left)
        .attr('opacity', 0.8)
        .attr('fill', d => d.color);
      labels.transition().duration(800).delay((d, i) => i * 40 + 400)
        .attr('x', d => xScale(d.obsession_score) + 8)
        .attr('opacity', 1);
      break;

    case 1:
      // Highlight top 3
      bars.transition().duration(400)
        .attr('opacity', (d, i) => i < 3 ? 1 : 0.2)
        .attr('width', d => xScale(d.obsession_score) - margin.left);
      labels.transition().duration(400)
        .attr('opacity', (d, i) => i < 3 ? 1 : 0.15);
      break;

    case 2:
      // Highlight the deep-but-rare topics (Career, AI Agents, etc.)
      const deepTopics = new Set();
      DATA.insights.obsession_scores.forEach(s => {
        const depth = DATA.insights.topic_depth[String(s.topic_id)];
        if (depth && depth.depth_score > 70 && s.doc_count < 80) {
          deepTopics.add(s.label);
        }
      });
      bars.transition().duration(400)
        .attr('opacity', d => deepTopics.has(d.label) ? 1 : 0.15);
      labels.transition().duration(400)
        .attr('opacity', d => deepTopics.has(d.label) ? 1 : 0.1);
      break;

    case 3:
      // Show all bars with depth-based gradient
      bars.transition().duration(400)
        .attr('opacity', 0.8);
      labels.transition().duration(400).attr('opacity', 0.8);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: LIBRARY — Reading Conversations Timeline
// ═══════════════════════════════════════════════════════════════════════════

function initLibraryChart() {
  const W = 900, H = 620;
  const margin = { top: 40, right: 30, bottom: 50, left: 40 };

  const svg = d3.select('#library-svg')
    .attr('viewBox', `0 0 ${W} ${H}`);

  const books = DATA.insights.reading.books;
  const parseDate = d3.timeParse('%Y-%m-%d');

  books.forEach(b => { b._date = parseDate(b.date); });
  const validBooks = books.filter(b => b._date);

  const xScale = d3.scaleTime()
    .domain(d3.extent(validBooks, d => d._date))
    .range([margin.left, W - margin.right]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(validBooks, d => d.turns) || 64])
    .range([H - margin.bottom, margin.top]);

  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(validBooks, d => d.h_chars) || 5000])
    .range([3, 14]);

  // X axis
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, ${H - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.timeFormat('%b %Y')))
    .select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');

  // Y axis label
  svg.append('text')
    .attr('x', 12).attr('y', margin.top - 12)
    .attr('fill', '#6e6e8a').attr('font-size', '10px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .text('Messages per conversation');

  // Grid lines
  svg.append('g').attr('class', 'grid')
    .selectAll('line')
    .data(yScale.ticks(5))
    .enter().append('line')
    .attr('x1', margin.left).attr('x2', W - margin.right)
    .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
    .attr('stroke', 'rgba(255,255,255,0.04)');

  // Book dots
  const dotGroup = svg.append('g').attr('class', 'book-dots');
  dotGroup.selectAll('.book-dot')
    .data(validBooks)
    .enter().append('circle')
    .attr('class', 'book-dot')
    .attr('cx', d => xScale(d._date))
    .attr('cy', d => yScale(d.turns))
    .attr('r', 0)
    .attr('fill', '#f97316')
    .attr('opacity', 0)
    .attr('stroke', 'rgba(249, 115, 22, 0.3)')
    .attr('stroke-width', 1);

  // Labels group
  svg.append('g').attr('class', 'book-labels');

  STATE.library = { svg, dotGroup, xScale, yScale, rScale, validBooks, margin, W, H };
}

function updateLibraryStep(step) {
  if (!STATE.library) return;
  const { svg, dotGroup, xScale, yScale, rScale, validBooks, margin, W, H } = STATE.library;
  const dots = dotGroup.selectAll('.book-dot');

  svg.selectAll('.book-labels text').remove();
  svg.selectAll('.annotation').remove();
  svg.selectAll('.bridge-line').remove();

  switch (step) {
    case 0:
      dots.transition().duration(600).delay((d, i) => i * 15)
        .attr('r', d => rScale(d.h_chars))
        .attr('opacity', 0.7)
        .attr('fill', '#f97316');
      break;

    case 1:
      // Label notable books
      dots.transition().duration(400)
        .attr('opacity', d => d.turns >= 15 ? 0.9 : 0.3);

      const notable = validBooks.filter(b => b.turns >= 15).slice(0, 8);
      const labelGroup = svg.select('.book-labels');
      notable.forEach((b, i) => {
        const x = xScale(b._date);
        const y = yScale(b.turns) - rScale(b.h_chars) - 8;
        labelGroup.append('text')
          .attr('x', x).attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('fill', '#f97316')
          .attr('font-size', '9px')
          .attr('font-family', "'JetBrains Mono', monospace")
          .attr('opacity', 0)
          .text(b.name.slice(0, 30) + (b.name.length > 30 ? '…' : ''))
          .transition().delay(i * 80).duration(400)
          .attr('opacity', 0.9);
      });
      break;

    case 2:
      dots.transition().duration(400).attr('opacity', 0.6);
      // Add annotation about extraction pattern
      const ann = svg.append('g').attr('class', 'annotation');
      ann.append('text')
        .attr('x', W / 2).attr('y', margin.top + 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f97316')
        .attr('font-size', '12px')
        .attr('font-family', "'JetBrains Mono', monospace")
        .attr('opacity', 0)
        .text('scratchpad → observations → extraction → essence')
        .transition().duration(600).attr('opacity', 0.85);
      break;

    case 3:
      dots.transition().duration(400)
        .attr('opacity', 0.5)
        .attr('fill', '#f97316');
      // Show bridge connection annotation
      const bridgeAnn = svg.append('g').attr('class', 'annotation');
      bridgeAnn.append('text')
        .attr('x', W / 2).attr('y', H - margin.bottom + 35)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6e6e8a')
        .attr('font-size', '11px')
        .text('Reading ↔ Business Strategy: 81 shared conversations')
        .attr('opacity', 0)
        .transition().duration(600).attr('opacity', 0.8);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: DUAL LIFE — Radar / Spider Chart
// ═══════════════════════════════════════════════════════════════════════════

function initDualLifeChart() {
  const W = 900, H = 620;

  const svg = d3.select('#duallife-svg')
    .attr('viewBox', `0 0 ${W} ${H}`);

  const fp = DATA.insights.fingerprint;
  const axes = ['Strategizing', 'Learning', 'Consulting', 'Building', 'Reflecting', 'Exploring'];
  const values = axes.map(a => fp[a] || 0);

  const cx = W / 2, cy = H / 2;
  const radius = Math.min(W, H) / 2 - 70;
  const angleSlice = (Math.PI * 2) / axes.length;

  const axisColors = {
    Strategizing: '#f43f5e', Learning: '#f59e0b', Consulting: '#06b6d4',
    Building: '#22c55e', Reflecting: '#a855f7', Exploring: '#ec4899',
  };

  // Grid circles
  const levels = 5;
  for (let i = 1; i <= levels; i++) {
    const r = radius * (i / levels);
    const pts = axes.map((_, j) => {
      const angle = angleSlice * j - Math.PI / 2;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    });
    svg.append('polygon')
      .attr('points', pts.map(p => p.join(',')).join(' '))
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.06)')
      .attr('stroke-width', 1);

    // Level label
    if (i === levels) {
      svg.append('text')
        .attr('x', cx + 6).attr('y', cy - r - 4)
        .attr('fill', '#3a3a55').attr('font-size', '9px')
        .attr('font-family', "'JetBrains Mono', monospace")
        .text('100');
    }
  }

  // Axis lines and labels
  axes.forEach((axis, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);

    svg.append('line')
      .attr('x1', cx).attr('y1', cy)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', 'rgba(255,255,255,0.08)');

    const labelR = radius + 28;
    svg.append('text')
      .attr('class', `radar-label radar-label-${i}`)
      .attr('x', cx + labelR * Math.cos(angle))
      .attr('y', cy + labelR * Math.sin(angle))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#6e6e8a')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text(axis);

    // Value label
    const valR = radius * (values[i] / 100) + 14;
    svg.append('text')
      .attr('class', `radar-val radar-val-${i}`)
      .attr('x', cx + valR * Math.cos(angle))
      .attr('y', cy + valR * Math.sin(angle))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', axisColors[axis])
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('opacity', 0)
      .text(Math.round(values[i]));
  });

  // Data polygon
  const dataPoints = axes.map((axis, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const r = radius * (values[i] / 100);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });

  svg.append('polygon')
    .attr('class', 'radar-shape')
    .attr('points', dataPoints.map(p => p.join(',')).join(' '))
    .attr('fill', 'rgba(124, 107, 255, 0.12)')
    .attr('stroke', '#7c6bff')
    .attr('stroke-width', 2)
    .attr('opacity', 0);

  // Data dots
  dataPoints.forEach((p, i) => {
    svg.append('circle')
      .attr('class', `radar-dot radar-dot-${i}`)
      .attr('cx', p[0]).attr('cy', p[1])
      .attr('r', 5)
      .attr('fill', axisColors[axes[i]])
      .attr('opacity', 0);
  });

  STATE.dualLife = { svg, axes, cx, cy, radius, angleSlice, dataPoints, values, axisColors };
}

function updateDualLifeStep(step) {
  if (!STATE.dualLife) return;
  const { svg, axes, axisColors } = STATE.dualLife;

  switch (step) {
    case 0:
      // Full shape appears
      svg.select('.radar-shape')
        .transition().duration(800)
        .attr('opacity', 1);
      axes.forEach((_, i) => {
        svg.select(`.radar-dot-${i}`)
          .transition().delay(i * 80).duration(500)
          .attr('opacity', 1);
        svg.select(`.radar-val-${i}`)
          .transition().delay(i * 80 + 200).duration(400)
          .attr('opacity', 0.9);
      });
      // Reset all labels
      axes.forEach((_, i) => {
        svg.select(`.radar-label-${i}`)
          .transition().duration(400)
          .attr('fill', '#6e6e8a').attr('font-size', '12px');
      });
      break;

    case 1:
      // Pulse Reflecting axis (index 4)
      axes.forEach((axis, i) => {
        const isReflecting = i === 4;
        svg.select(`.radar-label-${i}`)
          .transition().duration(400)
          .attr('fill', isReflecting ? axisColors[axis] : '#3a3a55')
          .attr('font-size', isReflecting ? '14px' : '11px');
        svg.select(`.radar-dot-${i}`)
          .transition().duration(400)
          .attr('r', isReflecting ? 8 : 3)
          .attr('opacity', isReflecting ? 1 : 0.2);
        svg.select(`.radar-val-${i}`)
          .transition().duration(400)
          .attr('opacity', isReflecting ? 1 : 0.15);
      });
      svg.select('.radar-shape')
        .transition().duration(400)
        .attr('opacity', 0.3);
      break;

    case 2:
      // Pulse Strategizing axis (index 0)
      axes.forEach((axis, i) => {
        const isStrat = i === 0;
        svg.select(`.radar-label-${i}`)
          .transition().duration(400)
          .attr('fill', isStrat ? axisColors[axis] : '#3a3a55')
          .attr('font-size', isStrat ? '14px' : '11px');
        svg.select(`.radar-dot-${i}`)
          .transition().duration(400)
          .attr('r', isStrat ? 8 : 3)
          .attr('opacity', isStrat ? 1 : 0.2);
        svg.select(`.radar-val-${i}`)
          .transition().duration(400)
          .attr('opacity', isStrat ? 1 : 0.15);
      });
      break;

    case 3:
      // Both highlighted, full shape
      svg.select('.radar-shape')
        .transition().duration(600)
        .attr('opacity', 1)
        .attr('fill', 'rgba(124, 107, 255, 0.15)');
      axes.forEach((axis, i) => {
        svg.select(`.radar-label-${i}`)
          .transition().duration(400)
          .attr('fill', axisColors[axis])
          .attr('font-size', '12px');
        svg.select(`.radar-dot-${i}`)
          .transition().duration(400)
          .attr('r', 5).attr('opacity', 1);
        svg.select(`.radar-val-${i}`)
          .transition().duration(400).attr('opacity', 0.9);
      });
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: THREADS — Recurring Conversation Timelines
// ═══════════════════════════════════════════════════════════════════════════

function initThreadsChart() {
  const W = 900, H = 620;
  const margin = { top: 30, right: 30, bottom: 40, left: 220 };

  const svg = d3.select('#threads-svg')
    .attr('viewBox', `0 0 ${W} ${H}`);

  const threads = DATA.insights.recurring_threads.slice(0, 15);
  const parseDate = d3.timeParse('%Y-%m-%d');

  // Collect all dates
  let allDates = [];
  threads.forEach(t => {
    t.conversations.forEach(c => {
      if (c.date) allDates.push(parseDate(c.date));
    });
  });
  allDates = allDates.filter(Boolean);

  const xScale = d3.scaleTime()
    .domain(d3.extent(allDates))
    .range([margin.left, W - margin.right]);

  const yScale = d3.scaleBand()
    .domain(threads.map((t, i) => i))
    .range([margin.top, H - margin.bottom])
    .padding(0.35);

  // X axis
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, ${H - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %Y')))
    .select('.domain').attr('stroke', 'rgba(255,255,255,0.08)');

  // Thread labels
  threads.forEach((t, i) => {
    const label = t.topic_label.length > 22 ? t.topic_label.slice(0, 22) + '…' : t.topic_label;
    svg.append('text')
      .attr('x', margin.left - 8)
      .attr('y', yScale(i) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#6e6e8a')
      .attr('font-size', '10px')
      .text(`${label} (${t.size})`);
  });

  // Thread lines
  const threadGroup = svg.append('g').attr('class', 'thread-lines');

  threads.forEach((t, i) => {
    const y = yScale(i) + yScale.bandwidth() / 2;
    const dates = t.conversations.map(c => parseDate(c.date)).filter(Boolean);
    if (dates.length < 2) return;

    // Span line
    threadGroup.append('line')
      .attr('class', `thread-line thread-${i}`)
      .attr('x1', xScale(d3.min(dates)))
      .attr('x2', xScale(d3.max(dates)))
      .attr('y1', y).attr('y2', y)
      .attr('stroke', t.topic_color || '#555')
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    // Conversation dots
    t.conversations.forEach(c => {
      const d = parseDate(c.date);
      if (!d) return;
      threadGroup.append('circle')
        .attr('class', `thread-dot thread-dot-${i}`)
        .attr('cx', xScale(d))
        .attr('cy', y)
        .attr('r', Math.min(c.turns / 4, 6) + 2)
        .attr('fill', t.topic_color || '#555')
        .attr('opacity', 0);
    });
  });

  STATE.threads = { svg, threads, margin, W, H };
}

function updateThreadsStep(step) {
  if (!STATE.threads) return;
  const { svg, threads } = STATE.threads;

  svg.selectAll('.annotation').remove();

  switch (step) {
    case 0:
      // All threads appear
      threads.forEach((t, i) => {
        svg.selectAll(`.thread-${i}`)
          .transition().delay(i * 60).duration(600)
          .attr('opacity', 0.7);
        svg.selectAll(`.thread-dot-${i}`)
          .transition().delay(i * 60 + 200).duration(400)
          .attr('opacity', 0.8);
      });
      break;

    case 1:
      // Highlight open threads
      threads.forEach((t, i) => {
        const opacity = t.is_open ? 1 : 0.15;
        svg.selectAll(`.thread-${i}`).transition().duration(400).attr('opacity', opacity);
        svg.selectAll(`.thread-dot-${i}`).transition().duration(400).attr('opacity', opacity);
      });
      break;

    case 2:
      // Color by trend
      const trendColors = { deepening: '#22c55e', stable: '#f59e0b', fading: '#f43f5e' };
      threads.forEach((t, i) => {
        const color = trendColors[t.trend] || '#555';
        svg.selectAll(`.thread-${i}`)
          .transition().duration(400)
          .attr('stroke', color).attr('opacity', 0.8);
        svg.selectAll(`.thread-dot-${i}`)
          .transition().duration(400)
          .attr('fill', color).attr('opacity', 0.8);
      });
      break;

    case 3:
      // Highlight largest threads
      threads.forEach((t, i) => {
        const opacity = i < 3 ? 1 : 0.15;
        svg.selectAll(`.thread-${i}`)
          .transition().duration(400)
          .attr('stroke', t.topic_color || '#555').attr('opacity', opacity);
        svg.selectAll(`.thread-dot-${i}`)
          .transition().duration(400)
          .attr('fill', t.topic_color || '#555').attr('opacity', opacity);
      });
      break;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: META-COGNITIVE MIRROR — Multi-view
// ═══════════════════════════════════════════════════════════════════════════

function initMetaCogChart() {
  const W = 900, H = 620;

  const svg = d3.select('#metacog-svg')
    .attr('viewBox', `0 0 ${W} ${H}`);

  STATE.metacog = { svg, W, H };
}

function updateMetaCogStep(step) {
  if (!STATE.metacog) return;
  const { svg, W, H } = STATE.metacog;

  // Clear previous
  svg.selectAll('*').remove();

  const cx = W / 2, cy = H / 2;
  const mc = DATA.insights.meta_cognitive;

  switch (step) {
    case 0:
      drawDonutChart(svg, mc.conversation_starters, cx, cy, Math.min(W, H) * 0.35, 'How conversations start');
      break;
    case 1:
      drawVoiceBar(svg, DATA.insights.voice, W, H);
      break;
    case 2:
      drawEmotionalBars(svg, mc.emotional_taxonomy, W, H);
      break;
    case 3:
      drawHiddenPatterns(svg, mc.hidden_patterns, W, H);
      break;
  }
}

function drawDonutChart(svg, data, cx, cy, radius, title) {
  const colorMap = {
    context_paste: '#8b5cf6', question: '#06b6d4',
    command: '#22c55e', brainstorm: '#f59e0b', empty: '#3a3a55',
  };

  svg.append('text')
    .attr('x', cx).attr('y', 35)
    .attr('text-anchor', 'middle')
    .attr('fill', '#6e6e8a').attr('font-size', '12px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .text(title);

  const pie = d3.pie().value(d => d.count).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);

  const arcs = svg.append('g')
    .attr('transform', `translate(${cx}, ${cy})`)
    .selectAll('path')
    .data(pie(data))
    .enter().append('path')
    .attr('d', arc)
    .attr('fill', d => colorMap[d.data.type] || '#555')
    .attr('stroke', '#12121a')
    .attr('stroke-width', 2)
    .attr('opacity', 0);

  arcs.transition().delay((d, i) => i * 100).duration(600)
    .attr('opacity', 0.85);

  // Labels
  const labelArc = d3.arc().innerRadius(radius * 0.8).outerRadius(radius * 1.3);
  svg.append('g')
    .attr('transform', `translate(${cx}, ${cy})`)
    .selectAll('text')
    .data(pie(data))
    .enter().append('text')
    .attr('transform', d => `translate(${labelArc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('fill', d => colorMap[d.data.type] || '#888')
    .attr('font-size', '10px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('opacity', 0)
    .text(d => `${d.data.type} ${d.data.pct}%`)
    .transition().delay((d, i) => i * 100 + 400).duration(400)
    .attr('opacity', 0.9);
}

function drawVoiceBar(svg, voice, W, H) {
  const barH = 50;
  const barW = W * 0.65;
  const x0 = (W - barW) / 2;
  const y0 = H / 2 - barH / 2;

  svg.append('text')
    .attr('x', W / 2).attr('y', y0 - 40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8e8f0').attr('font-size', '14px').attr('font-weight', '600')
    .text('Your words vs AI-pasted content');

  const userW = barW * (voice.user_written_pct / 100);

  // User-written bar
  svg.append('rect')
    .attr('x', x0).attr('y', y0)
    .attr('width', 0).attr('height', barH)
    .attr('fill', '#7c6bff').attr('rx', 6)
    .transition().duration(800)
    .attr('width', userW);

  // AI-pasted bar
  svg.append('rect')
    .attr('x', x0 + userW).attr('y', y0)
    .attr('width', 0).attr('height', barH)
    .attr('fill', '#f43f5e').attr('rx', 0)
    .transition().delay(400).duration(600)
    .attr('width', barW - userW);

  // Right edge rounding
  svg.append('rect')
    .attr('x', x0).attr('y', y0)
    .attr('width', barW).attr('height', barH)
    .attr('fill', 'none').attr('stroke', 'rgba(255,255,255,0.1)')
    .attr('rx', 6);

  // Labels
  svg.append('text')
    .attr('x', x0 + userW / 2).attr('y', y0 + barH / 2 + 5)
    .attr('text-anchor', 'middle')
    .attr('fill', 'white').attr('font-size', '16px').attr('font-weight', '700')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('opacity', 0)
    .text(`${voice.user_written_pct}% your words`)
    .transition().delay(500).duration(400).attr('opacity', 1);

  svg.append('text')
    .attr('x', x0 + userW + (barW - userW) / 2).attr('y', y0 + barH / 2 + 5)
    .attr('text-anchor', 'middle')
    .attr('fill', 'white').attr('font-size', '12px')
    .attr('font-family', "'JetBrains Mono', monospace")
    .attr('opacity', 0)
    .text(`${voice.ai_pasted_pct}%`)
    .transition().delay(700).duration(400).attr('opacity', 0.8);
}

function drawEmotionalBars(svg, taxonomy, W, H) {
  const margin = { top: 50, right: 40, bottom: 30, left: 130 };
  const barColors = {
    exploring: '#06b6d4', building: '#22c55e', processing: '#f59e0b',
    reflecting: '#a855f7', brainstorming: '#ec4899', struggling: '#f43f5e',
  };

  svg.append('text')
    .attr('x', W / 2).attr('y', 25)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8e8f0').attr('font-size', '14px').attr('font-weight', '600')
    .text('Emotional undertones of your messages');

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(taxonomy, d => d.pct)])
    .range([margin.left, W - margin.right]);

  const yScale = d3.scaleBand()
    .domain(taxonomy.map(d => d.intent))
    .range([margin.top, H - margin.bottom])
    .padding(0.3);

  // Labels
  taxonomy.forEach(d => {
    svg.append('text')
      .attr('x', margin.left - 8)
      .attr('y', yScale(d.intent) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('fill', barColors[d.intent] || '#6e6e8a')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text(d.intent);
  });

  // Bars
  taxonomy.forEach((d, i) => {
    svg.append('rect')
      .attr('x', margin.left)
      .attr('y', yScale(d.intent))
      .attr('width', 0)
      .attr('height', yScale.bandwidth())
      .attr('fill', barColors[d.intent] || '#555')
      .attr('rx', 3)
      .attr('opacity', 0.8)
      .transition().delay(i * 80).duration(600)
      .attr('width', xScale(d.pct) - margin.left);

    svg.append('text')
      .attr('x', xScale(d.pct) + 8)
      .attr('y', yScale(d.intent) + yScale.bandwidth() / 2)
      .attr('dominant-baseline', 'central')
      .attr('fill', '#6e6e8a')
      .attr('font-size', '11px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('opacity', 0)
      .text(`${d.pct}%`)
      .transition().delay(i * 80 + 400).duration(400)
      .attr('opacity', 0.8);
  });
}

function drawHiddenPatterns(svg, patterns, W, H) {
  svg.append('text')
    .attr('x', W / 2).attr('y', 35)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8e8f0').attr('font-size', '14px').attr('font-weight', '600')
    .text('When vulnerability meets ambition');

  const sections = [
    { label: 'Reflecting clusters in:', data: patterns.reflecting_topics, color: '#a855f7', y: 80 },
    { label: 'Building clusters in:', data: patterns.building_topics, color: '#22c55e', y: H / 2 - 20 },
    { label: 'Struggling clusters in:', data: patterns.struggling_topics, color: '#f43f5e', y: H - 120 },
  ];

  sections.forEach((sec, si) => {
    svg.append('text')
      .attr('x', 40).attr('y', sec.y)
      .attr('fill', sec.color).attr('font-size', '12px').attr('font-weight', '600')
      .text(sec.label);

    sec.data.slice(0, 3).forEach((topic, ti) => {
      const barW = Math.min((topic.count / 80) * (W - 200), W - 200);
      svg.append('rect')
        .attr('x', 40)
        .attr('y', sec.y + 15 + ti * 28)
        .attr('width', 0).attr('height', 20)
        .attr('fill', sec.color).attr('rx', 3).attr('opacity', 0.6)
        .transition().delay(si * 200 + ti * 80).duration(600)
        .attr('width', barW);

      svg.append('text')
        .attr('x', 48)
        .attr('y', sec.y + 15 + ti * 28 + 14)
        .attr('fill', 'white').attr('font-size', '10px')
        .attr('opacity', 0)
        .text(`${topic.label} (${topic.count})`)
        .transition().delay(si * 200 + ti * 80 + 300).duration(400)
        .attr('opacity', 0.9);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: KNOWLEDGE GRAPH (Interactive Bowl)
// ═══════════════════════════════════════════════════════════════════════════

function renderGraph() {
  if (!DATA.graph) return;
  const container = document.getElementById('graph-container');
  const W = container.clientWidth;
  const H = container.clientHeight;

  const svg = d3.select('#graph-svg').attr('viewBox', `0 0 ${W} ${H}`);
  const tooltip = document.getElementById('graph-tooltip');

  const nodes = DATA.graph.nodes;
  const links = DATA.graph.edges;

  const catColors = {
    'AI/ML': '#7c6bff', 'Software': '#06b6d4', 'Business': '#22c55e',
    'Data Science': '#f59e0b', 'Leadership': '#f43f5e', 'Research': '#a855f7',
  };

  // Category pills
  const pillContainer = document.getElementById('category-pills');
  const cats = [...new Set(nodes.map(n => n.category))];
  const activeCats = new Set(cats);

  cats.forEach(cat => {
    const pill = document.createElement('div');
    pill.className = 'pill active';
    pill.style.color = catColors[cat] || '#888';
    pill.innerHTML = `<div class="dot" style="background:${catColors[cat] || '#888'}"></div>${cat}`;
    pill.addEventListener('click', () => {
      if (activeCats.has(cat)) { activeCats.delete(cat); pill.classList.remove('active'); }
      else { activeCats.add(cat); pill.classList.add('active'); }
      updateGraphVisibility();
    });
    pillContainer.appendChild(pill);
  });

  // Scales
  const rScale = d3.scaleSqrt()
    .domain(d3.extent(nodes, n => n.freq))
    .range([4, 22]);

  const wScale = d3.scaleLinear()
    .domain(d3.extent(links, l => l.weight))
    .range([0.5, 4]);

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-280).distanceMax(500))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => rScale(d.freq) + 4))
    .alphaDecay(0.015);

  // Zoom
  const g = svg.append('g');
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event) => g.attr('transform', event.transform));
  svg.call(zoom);

  // Zoom controls
  document.getElementById('graph-zoom-in').addEventListener('click', () =>
    svg.transition().duration(300).call(zoom.scaleBy, 1.4));
  document.getElementById('graph-zoom-out').addEventListener('click', () =>
    svg.transition().duration(300).call(zoom.scaleBy, 0.7));
  document.getElementById('graph-reset').addEventListener('click', () =>
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity));

  // Links
  const link = g.append('g').selectAll('line')
    .data(links).enter().append('line')
    .attr('stroke', 'rgba(255,255,255,0.08)')
    .attr('stroke-width', d => wScale(d.weight));

  // Nodes
  const node = g.append('g').selectAll('g')
    .data(nodes).enter().append('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.1).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  node.append('circle')
    .attr('r', d => rScale(d.freq))
    .attr('fill', d => catColors[d.category] || '#555')
    .attr('opacity', 0.75)
    .attr('stroke', d => catColors[d.category] || '#555')
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.3);

  node.append('text')
    .text(d => d.id)
    .attr('text-anchor', 'middle')
    .attr('dy', d => rScale(d.freq) + 12)
    .attr('fill', '#6e6e8a')
    .attr('font-size', d => rScale(d.freq) > 12 ? '10px' : '8px')
    .attr('font-family', "'JetBrains Mono', monospace");

  // Tooltip
  node.on('mouseover', (event, d) => {
    tooltip.innerHTML = `<strong style="color:${catColors[d.category]}">${d.id}</strong><br>
      <span style="color:#6e6e8a;font-size:11px">${d.category} · ${d.freq} mentions · ${d.degree} connections</span>`;
    tooltip.classList.add('visible');
    tooltip.style.left = event.offsetX + 10 + 'px';
    tooltip.style.top = event.offsetY - 10 + 'px';
  }).on('mouseout', () => tooltip.classList.remove('visible'));

  simulation.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  function updateGraphVisibility() {
    node.attr('opacity', d => activeCats.has(d.category) ? 1 : 0.05);
    link.attr('opacity', d => {
      const s = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
      const t = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
      return (activeCats.has(s.category) && activeCats.has(t.category)) ? 0.5 : 0.02;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: EXPLORE — Interactive UMAP Galaxy
// ═══════════════════════════════════════════════════════════════════════════

function renderExploreUMAP() {
  if (!DATA.umap) return;

  const container = document.getElementById('umap-container');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const svg = d3.select('#umap-svg').attr('viewBox', `0 0 ${W} ${H}`);
  const tooltip = document.getElementById('umap-tooltip');

  const points = DATA.umap.points;
  const pad = 40;
  const xScale = d3.scaleLinear().domain([-1, 1]).range([pad, W - pad]);
  const yScale = d3.scaleLinear().domain([-1, 1]).range([pad, H - pad]);

  // Starfield
  const bgG = svg.append('g');
  for (let i = 0; i < 150; i++) {
    bgG.append('circle')
      .attr('cx', Math.random() * W).attr('cy', Math.random() * H)
      .attr('r', Math.random() * 0.6 + 0.2)
      .attr('fill', `rgba(255,255,255,${Math.random() * 0.12 + 0.02})`);
  }

  const dotGroup = svg.append('g');
  const zoom = d3.zoom().scaleExtent([0.5, 8])
    .on('zoom', e => dotGroup.attr('transform', e.transform));
  svg.call(zoom);

  // Topic data
  const topicColorMap = {};
  const topicLabelMap = {};
  if (DATA.topics) {
    DATA.topics.topics.forEach(t => {
      topicColorMap[t.id] = t.color;
      topicLabelMap[t.id] = t.label;
    });
  }

  // Color modes
  let colorMode = 'topic';
  const dateExtent = d3.extent(points, p => p.date);
  const timeColor = d3.scaleSequential(d3.interpolateViridis)
    .domain([new Date(dateExtent[0]), new Date(dateExtent[1])]);
  const lenExtent = d3.extent(points, p => p.total_chars);
  const lenColor = d3.scaleSequential(d3.interpolateInferno).domain(lenExtent);

  function getColor(d) {
    switch (colorMode) {
      case 'topic': return topicColorMap[d.topic] || '#555';
      case 'time': return timeColor(new Date(d.date));
      case 'length': return lenColor(d.total_chars);
      case 'cluster': return d.cluster >= 0 ? TOPIC_COLORS[d.cluster % TOPIC_COLORS.length] : '#4a4a5a';
      default: return '#555';
    }
  }

  const dots = dotGroup.selectAll('.dot')
    .data(points)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', 2.5)
    .attr('fill', d => getColor(d))
    .attr('opacity', 0.7)
    .attr('cursor', 'pointer');

  // Tooltip
  dots.on('mouseover', (event, d) => {
    const topicLabel = topicLabelMap[d.topic] || 'Unknown';
    const topicColor = topicColorMap[d.topic] || '#555';
    tooltip.querySelector('.tt-name').textContent = d.name || 'Untitled';
    tooltip.querySelector('.tt-meta').textContent = `${d.date} · ${d.total_msgs} messages`;
    const ttTopic = tooltip.querySelector('.tt-topic');
    ttTopic.textContent = topicLabel;
    ttTopic.style.background = topicColor + '22';
    ttTopic.style.color = topicColor;
    tooltip.classList.add('visible');

    const rect = container.getBoundingClientRect();
    tooltip.style.left = Math.min(event.clientX - rect.left + 12, W - 290) + 'px';
    tooltip.style.top = event.clientY - rect.top - 10 + 'px';
  }).on('mouseout', () => tooltip.classList.remove('visible'));

  // Color mode buttons
  document.querySelectorAll('.umap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.umap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      colorMode = btn.dataset.color;
      dots.transition().duration(400).attr('fill', d => getColor(d));
    });
  });

  // Legend
  const legendContainer = document.getElementById('umap-legend');
  const sorted = Object.entries(topicLabelMap).sort((a, b) => a[0] - b[0]);
  sorted.forEach(([tid, label]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-dot" style="background:${topicColorMap[tid] || '#555'}"></div>
      <span>${label}</span>`;
    legendContainer.appendChild(item);
  });

  // Auto-fit
  const xMin = d3.min(points, p => xScale(p.x));
  const xMax = d3.max(points, p => xScale(p.x));
  const yMin = d3.min(points, p => yScale(p.y));
  const yMax = d3.max(points, p => yScale(p.y));
  const dW = xMax - xMin, dH = yMax - yMin;
  const scale = Math.min(W / (dW + 80), H / (dH + 80)) * 0.9;
  const tx = W / 2 - (xMin + dW / 2) * scale;
  const ty = H / 2 - (yMin + dH / 2) * scale;
  svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

// ═══════════════════════════════════════════════════════════════════════════
// NAV, PROGRESS, REVEAL
// ═══════════════════════════════════════════════════════════════════════════

function setupNav() {
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);

    // Progress bar
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    document.getElementById('progress-bar').style.width = pct + '%';
  }, { passive: true });
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

async function init() {
  await loadData();
  document.getElementById('loading').classList.add('hidden');

  setupNav();
  setupReveal();
  animateCounters();

  // Initialize scrollytelling charts
  initLandscapeChart();
  initObsessionsChart();
  initLibraryChart();
  initDualLifeChart();
  initThreadsChart();
  initMetaCogChart();

  // Trigger first step for each section
  updateLandscapeStep(0);
  updateObsessionsStep(0);

  // Set up scroll observers
  setupScrollama();

  // Interactive bowl sections (render when scrolled into view)
  const bowlObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      if (e.target.id === 'graph-section' && !STATE.graphRendered) {
        STATE.graphRendered = true;
        renderGraph();
      }
      if (e.target.id === 'explore-section' && !STATE.umapRendered) {
        STATE.umapRendered = true;
        renderExploreUMAP();
      }
    });
  }, { threshold: 0.1 });

  const graphEl = document.getElementById('graph-section');
  const exploreEl = document.getElementById('explore-section');
  if (graphEl) bowlObserver.observe(graphEl);
  if (exploreEl) bowlObserver.observe(exploreEl);
}

init();
