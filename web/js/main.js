/* ───────────────────────────────────────────────────────────────────────────
   Mind Map — Main JS
   D3.js v7 visualizations for Claude chat analysis
   ─────────────────────────────────────────────────────────────────────────── */

'use strict';

// ── Globals ──────────────────────────────────────────────────────────────────
const DATA = {};
const TOPIC_COLORS_FALLBACK = [
  "#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e",
  "#f97316","#f59e0b","#eab308","#84cc16","#22c55e",
  "#10b981","#14b8a6","#06b6d4","#0ea5e9","#3b82f6",
  "#6366f1","#d946ef","#fb7185"
];

// ── Load all data ────────────────────────────────────────────────────────────
async function loadData() {
  const files = [
    'data/stats.json',
    'data/timeline.json',
    'data/activity.json',
    'data/distributions.json',
    'data/topics.json',
    'data/topic_evolution.json',
    'data/umap.json',
    'data/graph.json',
    'data/top_conversations.json',
  ];

  const results = await Promise.all(files.map(f =>
    fetch(f).then(r => r.json()).catch(() => null)
  ));

  DATA.stats         = results[0];
  DATA.timeline      = results[1];
  DATA.activity      = results[2];
  DATA.distributions = results[3];
  DATA.topics        = results[4];
  DATA.topicEvol     = results[5];
  DATA.umap          = results[6];
  DATA.graph         = results[7];
  DATA.topConvs      = results[8];
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadData();
  document.getElementById('loading').classList.add('hidden');

  setupNav();
  setupProgress();
  setupReveal();
  animateCounters();
  renderCalendarHeatmap();
  renderMonthlyLine();
  renderActivityHeatmap();
  renderHourChart();
  renderWeekdayChart();
  renderTurnDist();
  renderMsgLenChart();
  renderTopConvs();
  renderTopicGrid();
  renderTopicStream();
  renderTopicBubbles();
  renderUMAP();
  renderGraph();
}

// ── Nav scroll effect ────────────────────────────────────────────────────────
function setupNav() {
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Active nav link
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('#nav-links a');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const match = document.querySelector(`#nav-links a[href="#${e.target.id}"]`);
        if (match) match.classList.add('active');
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(s => observer.observe(s));
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function setupProgress() {
  const bar = document.getElementById('progress-bar');
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// ── Reveal on scroll ─────────────────────────────────────────────────────────
function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
  els.forEach(el => obs.observe(el));
}

// ── Counter animation ─────────────────────────────────────────────────────────
function animateCounters() {
  const cards = document.querySelectorAll('[data-target]');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = +el.dataset.target;
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * ease).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  cards.forEach(c => obs.observe(c));
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function getTopicColor(id) {
  if (id < 0) return '#4a4a5a';
  if (!DATA.topics) return TOPIC_COLORS_FALLBACK[id % 18];
  const t = DATA.topics.topics.find(t => t.id === id);
  return t ? t.color : '#888';
}
function getTopicLabel(id) {
  if (id < 0) return 'Misc / Short';
  if (!DATA.topics) return `Topic ${id}`;
  const t = DATA.topics.topics.find(t => t.id === id);
  return t ? t.label : `Topic ${id}`;
}

// ── Responsive SVG dims ───────────────────────────────────────────────────────
function dims(selector, margin = { top: 20, right: 20, bottom: 40, left: 50 }) {
  const el = document.querySelector(selector);
  const w = el.getBoundingClientRect().width || 600;
  return {
    margin,
    outerW: w,
    outerH: Math.min(w * 0.45, 340),
    w: w - margin.left - margin.right,
    h: Math.min(w * 0.45, 340) - margin.top - margin.bottom,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════
function renderCalendarHeatmap() {
  if (!DATA.timeline) return;
  const daily = DATA.timeline.daily;

  const parseDate = d3.timeParse('%Y-%m-%d');
  const data = daily.map(d => ({ date: parseDate(d.date), value: d.convs }));

  const cellSize = 13;
  const cellPad = 2;
  const weekW = cellSize + cellPad;

  // Group by year
  const years = d3.groups(data, d => d.date.getFullYear());
  const container = document.getElementById('heatmap-container');

  // Color scale
  const maxVal = d3.max(data, d => d.value);
  const color = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateRgbBasis(['#1a1a26', '#4f46e5', '#7c6bff', '#c4b8ff']));

  // Legend boxes
  const legendEl = document.getElementById('heatmap-legend-boxes');
  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(t => {
    const box = document.createElement('div');
    box.className = 'heatmap-legend-box';
    box.style.background = color(t * maxVal);
    legendEl.appendChild(box);
  });

  const dayNames = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const monthFmt = d3.timeFormat('%b');

  years.forEach(([year, yearData]) => {
    // Number of weeks in year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const nWeeks = d3.timeWeeks(yearStart, d3.timeDay.offset(yearEnd, 1)).length;
    const svgW = nWeeks * weekW + 40;
    const svgH = 7 * weekW + 30;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', svgW)
      .attr('height', svgH)
      .attr('style', 'display: block; margin-bottom: 8px; min-width: ' + svgW + 'px');

    // Year label
    svg.append('text')
      .attr('x', 28).attr('y', 12)
      .attr('fill', '#6e6e8a')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(year);

    const g = svg.append('g').attr('transform', 'translate(40, 20)');

    // Day labels
    dayNames.forEach((name, i) => {
      if (!name) return;
      g.append('text')
        .attr('x', -4).attr('y', i * weekW + cellSize / 2 + 2)
        .attr('fill', '#3a3a55')
        .attr('font-size', '9px')
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(name);
    });

    // Build value map
    const fmt = d3.timeFormat('%Y-%m-%d');
    const valMap = new Map(yearData.map(d => [fmt(d.date), d.value]));

    // All days in year
    const allDays = d3.timeDays(yearStart, d3.timeDay.offset(yearEnd, 1));

    // Month labels
    const monthStarts = d3.timeMonths(yearStart, d3.timeDay.offset(yearEnd, 1));
    monthStarts.forEach(m => {
      const weekIdx = d3.timeWeek.count(d3.timeYear(m), m);
      g.append('text')
        .attr('x', weekIdx * weekW + cellSize / 2)
        .attr('y', -4)
        .attr('fill', '#3a3a55')
        .attr('font-size', '9px')
        .attr('text-anchor', 'middle')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(monthFmt(m));
    });

    // Cells
    const tooltip = createFloatingTooltip();
    const dateFmtFull = d3.timeFormat('%B %d, %Y');

    g.selectAll('rect')
      .data(allDays)
      .join('rect')
      .attr('x', d => d3.timeWeek.count(d3.timeYear(d), d) * weekW)
      .attr('y', d => d.getDay() * weekW)
      .attr('width', cellSize).attr('height', cellSize)
      .attr('rx', 2)
      .attr('fill', d => {
        const v = valMap.get(fmt(d)) || 0;
        return v === 0 ? '#1a1a26' : color(v);
      })
      .on('mouseover', function(event, d) {
        const v = valMap.get(fmt(d)) || 0;
        tooltip.show(event, `<strong>${dateFmtFull(d)}</strong><br/>${v} conversation${v !== 1 ? 's' : ''}`);
        d3.select(this).attr('rx', 4).attr('stroke', '#fff').attr('stroke-width', 0.5);
      })
      .on('mousemove', (e) => tooltip.move(e))
      .on('mouseout', function() {
        tooltip.hide();
        d3.select(this).attr('rx', 2).attr('stroke', null);
      });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTHLY LINE CHART
// ═══════════════════════════════════════════════════════════════════════════════
function renderMonthlyLine() {
  if (!DATA.timeline) return;
  const monthly = DATA.timeline.monthly;

  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const el = document.getElementById('monthly-chart');
  const W = el.getBoundingClientRect().width || 700;
  const H = 220;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const parseMonth = d3.timeParse('%Y-%m');
  const data = monthly.map(d => ({ date: parseMonth(d.month), convs: d.convs, msgs: d.msgs }));

  const svg = d3.select(el).append('svg')
    .attr('width', W).attr('height', H);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xScale = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, w]);
  const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.convs) * 1.15]).range([h, 0]);

  // Gradient
  const gradId = 'monthly-grad';
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#7c6bff').attr('stop-opacity', 0.4);
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#7c6bff').attr('stop-opacity', 0);

  // Area
  const area = d3.area().x(d => xScale(d.date)).y0(h).y1(d => yScale(d.convs)).curve(d3.curveCatmullRom);
  const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.convs)).curve(d3.curveCatmullRom);

  g.append('path').datum(data).attr('fill', `url(#${gradId})`).attr('d', area);
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', '#7c6bff').attr('stroke-width', 2).attr('d', line);

  // Axes
  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(d3.timeMonth.every(2)).tickFormat(d3.timeFormat('%b %y')))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d > 0 ? d : ''))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'))
    .call(g => g.selectAll('.tick line').clone().attr('x2', w).attr('stroke', 'rgba(255,255,255,0.04)'));

  // Peak annotation
  const peakPoint = data.reduce((a, b) => a.convs > b.convs ? a : b);
  const peakX = xScale(peakPoint.date);
  const peakY = yScale(peakPoint.convs);
  g.append('line')
    .attr('x1', peakX).attr('x2', peakX)
    .attr('y1', peakY + 4).attr('y2', h)
    .attr('stroke', '#7c6bff').attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,3').attr('opacity', 0.5);
  g.append('text')
    .attr('x', peakX + 5).attr('y', peakY - 6)
    .attr('fill', '#c4b8ff').attr('font-size', '10px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(`Peak: ${peakPoint.convs} convs`);

  // Dots + tooltip
  const tooltip = createFloatingTooltip();
  const fmtMonth = d3.timeFormat('%b %Y');

  g.selectAll('circle').data(data).join('circle')
    .attr('cx', d => xScale(d.date)).attr('cy', d => yScale(d.convs))
    .attr('r', 3.5).attr('fill', '#7c6bff').attr('stroke', '#0a0a0f').attr('stroke-width', 1.5)
    .on('mouseover', (event, d) => {
      tooltip.show(event, `<strong>${fmtMonth(d.date)}</strong><br/>${d.convs} conversations`);
    })
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide());
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY HEATMAP (Hour × Weekday)
// ═══════════════════════════════════════════════════════════════════════════════
function renderActivityHeatmap() {
  if (!DATA.activity) return;
  const heatmapData = DATA.activity.heatmap;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const el = document.getElementById('activity-heatmap');
  const W = el.getBoundingClientRect().width || 700;
  const cellW = Math.floor((W - margin.left - margin.right) / 24);
  const cellH = 30;
  const H = days.length * cellH + margin.top + margin.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const maxVal = d3.max(heatmapData, d => d.count);
  const color = d3.scaleSequential()
    .domain([0, maxVal])
    .interpolator(d3.interpolateRgbBasis(['#1a1a26', '#2563eb', '#7c6bff', '#c084fc']));

  const tooltip = createFloatingTooltip();
  const periodLabel = h => {
    if (h < 6) return 'Late night';
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    if (h < 21) return 'Evening';
    return 'Night';
  };

  // Cells
  g.selectAll('rect').data(heatmapData).join('rect')
    .attr('x', d => d.hour * cellW)
    .attr('y', d => d.weekday * cellH)
    .attr('width', cellW - 2)
    .attr('height', cellH - 2)
    .attr('rx', 3)
    .attr('fill', d => d.count === 0 ? '#1a1a26' : color(d.count))
    .on('mouseover', (event, d) => {
      tooltip.show(event,
        `<strong>${days[d.weekday]} ${String(d.hour).padStart(2,'0')}:00</strong><br/>
         ${d.count} conversations<br/>
         <span style="color:#7c6bff">${periodLabel(d.hour)}</span>`);
    })
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide());

  // Y axis (days)
  days.forEach((day, i) => {
    g.append('text')
      .attr('x', -6).attr('y', i * cellH + cellH / 2 - 1)
      .attr('fill', '#6e6e8a').attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .text(day);
  });

  // X axis (hours) — every 6
  [0, 6, 12, 18, 23].forEach(h => {
    g.append('text')
      .attr('x', h * cellW + cellW / 2).attr('y', days.length * cellH + 14)
      .attr('fill', '#6e6e8a').attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('text-anchor', 'middle')
      .text(h === 0 ? '12am' : h === 12 ? '12pm' : h === 23 ? '11pm' : `${h > 12 ? h-12 : h}${h >= 12 ? 'pm' : 'am'}`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOUR / WEEKDAY BAR CHARTS
// ═══════════════════════════════════════════════════════════════════════════════
function renderHourChart() {
  if (!DATA.activity) return;
  const data = DATA.activity.hourly;

  const margin = { top: 10, right: 10, bottom: 30, left: 35 };
  const el = document.getElementById('hour-chart');
  const W = el.getBoundingClientRect().width || 300;
  const H = 160;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.hour)).range([0, w]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.1]).range([h, 0]);

  const color = d3.scaleSequential().domain([0, 23])
    .interpolator(t => d3.interpolateTurbo(0.15 + t * 0.7));

  g.selectAll('rect').data(data).join('rect')
    .attr('x', d => x(d.hour)).attr('y', d => y(d.count))
    .attr('width', x.bandwidth()).attr('height', d => h - y(d.count))
    .attr('fill', d => color(d.hour)).attr('rx', 2).attr('opacity', 0.85);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues([0,6,12,18,23]).tickFormat(h => `${h}h`))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));

  g.append('g').call(d3.axisLeft(y).ticks(4))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));
}

function renderWeekdayChart() {
  if (!DATA.activity) return;
  const data = DATA.activity.weekday;

  const margin = { top: 10, right: 10, bottom: 30, left: 35 };
  const el = document.getElementById('weekday-chart');
  const W = el.getBoundingClientRect().width || 300;
  const H = 160;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.day)).range([0, w]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.1]).range([h, 0]);

  const palette = ['#6366f1','#7c6bff','#a78bfa','#c084fc','#ec4899','#fb7185','#f43f5e'];

  g.selectAll('rect').data(data).join('rect')
    .attr('x', d => x(d.day)).attr('y', d => y(d.count))
    .attr('width', x.bandwidth()).attr('height', d => h - y(d.count))
    .attr('fill', (d, i) => palette[i]).attr('rx', 2).attr('opacity', 0.85);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));

  g.append('g').call(d3.axisLeft(y).ticks(4))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TURN DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════
function renderTurnDist() {
  if (!DATA.distributions) return;
  const raw = DATA.distributions.turn_distribution;
  // Filter to < 40 turns for readability
  const data = raw.filter(d => d.turns <= 40);

  const margin = { top: 15, right: 15, bottom: 40, left: 50 };
  const el = document.getElementById('turn-chart');
  const W = el.getBoundingClientRect().width || 300;
  const H = 200;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.turns)).range([0, w]).padding(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.1]).range([h, 0]);

  const colorScale = d3.scaleSequential().domain([1, 40])
    .interpolator(d3.interpolateRgbBasis(['#6bffd3', '#7c6bff', '#ff6b9d']));

  const tooltip = createFloatingTooltip();

  g.selectAll('rect').data(data).join('rect')
    .attr('x', d => x(d.turns)).attr('y', d => y(d.count))
    .attr('width', x.bandwidth()).attr('height', d => h - y(d.count))
    .attr('fill', d => colorScale(d.turns)).attr('rx', 1)
    .on('mouseover', (event, d) => {
      tooltip.show(event, `<strong>${d.turns} turns</strong><br/>${d.count} conversations`);
    })
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', () => tooltip.hide());

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues([1,5,10,15,20,30,40]).tickFormat(d => d))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));

  g.append('g').call(d3.axisLeft(y).ticks(4))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'))
    .call(g => g.selectAll('.tick line').clone().attr('x2', w).attr('stroke', 'rgba(255,255,255,0.04)'));

  // X label
  g.append('text').attr('x', w/2).attr('y', h + 35)
    .attr('fill', '#6e6e8a').attr('font-size', 10).attr('text-anchor', 'middle')
    .text('Number of messages in conversation');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE LENGTH CHART
// ═══════════════════════════════════════════════════════════════════════════════
function renderMsgLenChart() {
  if (!DATA.distributions) return;
  const humanData = DATA.distributions.msg_len_human;
  const assistData = DATA.distributions.msg_len_assistant;

  const margin = { top: 15, right: 15, bottom: 50, left: 50 };
  const el = document.getElementById('msg-len-chart');
  const W = el.getBoundingClientRect().width || 300;
  const H = 220;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const combined = [...humanData, ...assistData];
  const maxX = d3.max(combined, d => d.bin_start);
  const maxY = d3.max(combined, d => d.count);

  const x = d3.scaleLinear().domain([0, maxX]).range([0, w]);
  const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([h, 0]);

  const areaFn = (dataset, fill) => {
    const area = d3.area()
      .x(d => x(d.bin_start))
      .y0(h).y1(d => y(d.count))
      .curve(d3.curveBasis);
    g.append('path').datum(dataset).attr('fill', fill).attr('opacity', 0.35).attr('d', area);

    const lineFn = d3.line().x(d => x(d.bin_start)).y(d => y(d.count)).curve(d3.curveBasis);
    g.append('path').datum(dataset).attr('fill', 'none').attr('stroke', fill)
      .attr('stroke-width', 1.5).attr('d', lineFn);
  };

  areaFn(humanData, '#ff6b9d');
  areaFn(assistData, '#7c6bff');

  // Legend
  [['Human', '#ff6b9d'], ['Claude', '#7c6bff']].forEach(([label, color], i) => {
    const lx = w - 100 + i * 55;
    g.append('rect').attr('x', lx).attr('y', 5).attr('width', 10).attr('height', 10).attr('fill', color).attr('opacity', 0.8).attr('rx', 2);
    g.append('text').attr('x', lx + 13).attr('y', 14).attr('fill', '#6e6e8a').attr('font-size', 10).text(label);
  });

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d > 999 ? `${(d/1000).toFixed(0)}k` : d))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));

  g.append('g').call(d3.axisLeft(y).ticks(4))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 9).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));

  g.append('text').attr('x', w/2).attr('y', h + 40)
    .attr('fill', '#6e6e8a').attr('font-size', 10).attr('text-anchor', 'middle')
    .text('Message length (characters)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function renderTopConvs() {
  if (!DATA.topConvs) return;
  const data = DATA.topConvs.slice(0, 20);

  const margin = { top: 10, right: 60, bottom: 10, left: 240 };
  const el = document.getElementById('top-convs-chart');
  const W = el.getBoundingClientRect().width || 700;
  const barH = 28;
  const H = data.length * barH + margin.top + margin.bottom;
  const w = W - margin.left - margin.right;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.total_msgs)]).range([0, w]);
  const y = d3.scaleBand().domain(data.map(d => d.uuid)).range([0, H - margin.top - margin.bottom]).padding(0.2);

  const tooltip = createFloatingTooltip();

  data.forEach((d, i) => {
    const yPos = y(d.uuid);
    const bColor = TOPIC_COLORS_FALLBACK[i % 18];

    // Bar
    g.append('rect')
      .attr('x', 0).attr('y', yPos)
      .attr('width', x(d.total_msgs)).attr('height', y.bandwidth())
      .attr('fill', bColor).attr('opacity', 0.7).attr('rx', 3);

    // Name (left)
    const nameText = d.name || '(Untitled)';
    g.append('text')
      .attr('x', -8).attr('y', yPos + y.bandwidth() / 2)
      .attr('fill', '#e8e8f0').attr('font-size', '11px')
      .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .text(nameText.length > 32 ? nameText.slice(0, 30) + '…' : nameText);

    // Count (right)
    g.append('text')
      .attr('x', x(d.total_msgs) + 5).attr('y', yPos + y.bandwidth() / 2)
      .attr('fill', bColor).attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('dominant-baseline', 'middle')
      .text(d.total_msgs);

    // Hover target
    g.append('rect')
      .attr('x', -margin.left).attr('y', yPos)
      .attr('width', W).attr('height', y.bandwidth())
      .attr('fill', 'transparent')
      .on('mouseover', (event) => {
        tooltip.show(event,
          `<strong>${d.name || '(Untitled)'}</strong><br/>
          ${d.total_msgs} messages<br/>
          ${Math.round(d.duration_min)} min duration<br/>
          ${d.has_code ? '💻 Contains code' : ''}`);
      })
      .on('mousemove', e => tooltip.move(e))
      .on('mouseout', () => tooltip.hide());
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC GRID
// ═══════════════════════════════════════════════════════════════════════════════
function renderTopicGrid() {
  if (!DATA.topics) return;
  const topics = [...DATA.topics.topics].sort((a, b) => b.doc_count - a.doc_count);

  const grid = document.getElementById('topic-grid');
  topics.forEach(t => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.style.setProperty('--topic-color', t.color);
    card.innerHTML = `
      <div class="count">${t.doc_count}</div>
      <div class="name">${t.label}</div>
      <div class="words">${t.top_words.slice(0, 5).map(w => w[0]).join(' · ')}</div>
    `;
    grid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC STREAM CHART (Stacked Area)
// ═══════════════════════════════════════════════════════════════════════════════
function renderTopicStream() {
  if (!DATA.topicEvol) return;
  const { data, months, n_topics } = DATA.topicEvol;

  const margin = { top: 20, right: 20, bottom: 50, left: 50 };
  const el = document.getElementById('topic-stream-chart');
  const W = el.getBoundingClientRect().width || 700;
  const H = 280;
  const w = W - margin.left - margin.right;
  const h = H - margin.top - margin.bottom;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const parseMonth = d3.timeParse('%Y-%m');
  const parsedData = data.map(d => {
    const row = { date: parseMonth(d.month) };
    for (let t = 0; t < n_topics; t++) row[`t${t}`] = d[`t${t}`] || 0;
    return row;
  });

  const keys = Array.from({ length: n_topics }, (_, i) => `t${i}`);
  const stack = d3.stack().keys(keys).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut);
  const series = stack(parsedData);

  const xScale = d3.scaleTime().domain(d3.extent(parsedData, d => d.date)).range([0, w]);
  const yScale = d3.scaleLinear()
    .domain([d3.min(series, layer => d3.min(layer, d => d[0])),
             d3.max(series, layer => d3.max(layer, d => d[1]))])
    .range([h, 0]);

  const area = d3.area()
    .x(d => xScale(d.data.date))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCatmullRom);

  const tooltip = createFloatingTooltip();

  g.selectAll('.stream-layer')
    .data(series)
    .join('path')
    .attr('class', 'stream-layer')
    .attr('d', area)
    .attr('fill', (d, i) => getTopicColor(i))
    .attr('opacity', 0.75)
    .on('mouseover', function(event, d) {
      const topicId = +d.key.replace('t', '');
      d3.select(this).attr('opacity', 1);
      tooltip.show(event, `<strong>${getTopicLabel(topicId)}</strong>`);
    })
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.75);
      tooltip.hide();
    });

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(xScale).ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat('%b %y')))
    .call(g => g.selectAll('text').attr('fill', '#6e6e8a').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace'))
    .call(g => g.selectAll('line,path').attr('stroke', 'rgba(255,255,255,0.08)'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC BUBBLE CHART
// ═══════════════════════════════════════════════════════════════════════════════
function renderTopicBubbles() {
  if (!DATA.topics) return;
  const topics = DATA.topics.topics;

  const el = document.getElementById('topic-bubble-chart');
  const W = el.getBoundingClientRect().width || 700;
  const H = 340;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);

  const rScale = d3.scaleSqrt().domain([0, d3.max(topics, d => d.doc_count)]).range([20, 70]);

  const pack = d3.pack().size([W - 4, H - 4]).padding(6);
  const root = d3.hierarchy({ children: topics }).sum(d => d.doc_count);
  pack(root);

  const tooltip = createFloatingTooltip();

  const node = svg.selectAll('.bubble')
    .data(root.leaves())
    .join('g')
    .attr('class', 'bubble')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  node.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => d.data.color)
    .attr('opacity', 0.7)
    .attr('stroke', d => d.data.color)
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.3)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 1);
      tooltip.show(event,
        `<strong>${d.data.label}</strong><br/>
        ${d.data.doc_count} conversations<br/>
        <em style="color:#888">${d.data.top_words.slice(0,4).map(w=>w[0]).join(', ')}</em>`);
    })
    .on('mousemove', e => tooltip.move(e))
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.7);
      tooltip.hide();
    });

  node.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', d => Math.max(8, Math.min(13, d.r * 0.28)))
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .each(function(d) {
      const words = d.data.label.split(' ');
      const el = d3.select(this);
      if (d.r < 28) {
        el.text('');
        return;
      }
      if (words.length === 1 || d.r < 40) {
        el.text(d.r < 30 ? '' : words[0]);
        return;
      }
      const mid = Math.ceil(words.length / 2);
      el.append('tspan').attr('x', 0).attr('dy', '-0.5em').text(words.slice(0, mid).join(' '));
      el.append('tspan').attr('x', 0).attr('dy', '1.1em').text(words.slice(mid).join(' '));
    });

  node.append('text')
    .attr('y', d => d.r - 8)
    .attr('text-anchor', 'middle')
    .attr('fill', 'rgba(255,255,255,0.7)')
    .attr('font-size', d => Math.max(7, Math.min(11, d.r * 0.22)))
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('pointer-events', 'none')
    .text(d => d.r > 30 ? d.data.doc_count : '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// UMAP GALAXY
// ═══════════════════════════════════════════════════════════════════════════════
function renderUMAP() {
  if (!DATA.umap) return;
  const { points, clusters } = DATA.umap;

  const container = document.getElementById('umap-container');
  const svgEl = document.getElementById('umap-svg');
  const tooltip = document.getElementById('umap-tooltip');
  const legend = document.getElementById('umap-legend');

  const W = container.getBoundingClientRect().width;
  const H = container.getBoundingClientRect().height;
  const PADDING = 30;

  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);

  // Scales: data is in [-1, 1]
  const xScale = d3.scaleLinear().domain([-1, 1]).range([PADDING, W - PADDING]);
  const yScale = d3.scaleLinear().domain([-1, 1]).range([H - PADDING, PADDING]);

  // Color modes
  const parseDate = d => d ? new Date(d) : new Date(0);
  const dateExtent = d3.extent(points, d => parseDate(d.date));
  const timeColor = d3.scaleSequential().domain(dateExtent).interpolator(d3.interpolateCool);

  const charExtent = d3.extent(points, d => d.total_chars);
  const lenColor = d3.scaleSequential().domain(charExtent).interpolator(d3.interpolateViridis);

  const clusterColors = ['#7c6bff','#ff6b9d','#6bffd3','#ffcc6b','#a855f7','#22c55e','#06b6d4','#f97316'];

  let currentMode = 'topic';

  function getColor(d) {
    switch (currentMode) {
      case 'topic':   return getTopicColor(d.topic);
      case 'time':    return timeColor(parseDate(d.date));
      case 'length':  return lenColor(d.total_chars);
      case 'cluster': return d.cluster === -1 ? '#333' : clusterColors[d.cluster % clusterColors.length];
      default:        return '#7c6bff';
    }
  }

  // Starfield background (faint ambient dots) — rendered first so dots appear above
  const bgGroup = svg.append('g').attr('class', 'starfield');
  const rng = (min, max) => min + Math.random() * (max - min);
  for (let i = 0; i < 150; i++) {
    bgGroup.append('circle')
      .attr('cx', rng(0, W)).attr('cy', rng(0, H))
      .attr('r', rng(0.3, 1))
      .attr('fill', '#ffffff').attr('opacity', rng(0.02, 0.08));
  }

  // Stats overlay (rendered last so it stays on top)
  const statsText = svg.append('text')
    .attr('x', 12).attr('y', H - 12)
    .attr('fill', '#3a3a55')
    .attr('font-size', '10px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text(`${points.length} conversations · scroll to zoom · drag to pan`);

  // Dot group — must be declared BEFORE zoom callback references it
  const dotGroup = svg.append('g').attr('class', 'dots');

  // Zoom behavior
  const zoom = d3.zoom().scaleExtent([0.3, 20]).on('zoom', (event) => {
    dotGroup.attr('transform', event.transform);
  });
  svg.call(zoom);

  // Auto-fit: center the data cloud in the canvas
  const x0 = d3.min(points, p => xScale(p.x));
  const x1 = d3.max(points, p => xScale(p.x));
  const y0 = d3.min(points, p => yScale(p.y));
  const y1 = d3.max(points, p => yScale(p.y));
  const dataW = x1 - x0, dataH = y1 - y0;
  const fitScale = Math.min(W / dataW, H / dataH) * 0.75;
  const fitTx = (W - (x0 + x1) * fitScale) / 2;
  const fitTy = (H - (y0 + y1) * fitScale) / 2;
  svg.call(zoom.transform, d3.zoomIdentity.translate(fitTx, fitTy).scale(fitScale));

  // Render dots
  const r = Math.max(2, Math.min(4, W / 450));

  const circles = dotGroup.selectAll('circle')
    .data(points)
    .join('circle')
    .attr('cx', d => xScale(d.x))
    .attr('cy', d => yScale(d.y))
    .attr('r', r)
    .attr('fill', d => getColor(d))
    .attr('opacity', 0.75)
    .attr('stroke', d => getColor(d))
    .attr('stroke-opacity', 0.2)
    .attr('stroke-width', 0.5);

  // Cluster labels — use getTopicLabel for correct display
  const clusterGroup = dotGroup.append('g').attr('class', 'cluster-labels');
  clusters.forEach(cl => {
    const label = getTopicLabel(cl.topic);
    const color = getTopicColor(cl.topic);
    clusterGroup.append('text')
      .attr('x', xScale(cl.center_x))
      .attr('y', yScale(cl.center_y))
      .attr('text-anchor', 'middle')
      .attr('fill', color)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, sans-serif')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'rgba(10,10,15,0.9)')
      .attr('stroke-width', 3)
      .attr('pointer-events', 'none')
      .text(`● ${label} (${cl.size})`);
  });

  // Tooltip interaction
  svg.on('mousemove', function(event) {
    const [mx, my] = d3.pointer(event);
    const transform = d3.zoomTransform(svgEl);
    const ix = transform.invertX(mx);
    const iy = transform.invertY(my);

    // Find nearest point
    let best = null, bestDist = Infinity;
    points.forEach(p => {
      const px = xScale(p.x), py = yScale(p.y);
      const dist = Math.hypot(ix - px, iy - py);
      if (dist < bestDist) { bestDist = dist; best = p; }
    });

    if (best && bestDist < 25) {
      const rect = container.getBoundingClientRect();
      const tx = event.clientX - rect.left + 12;
      const ty = event.clientY - rect.top + 12;

      tooltip.style.left = Math.min(tx, W - 300) + 'px';
      tooltip.style.top = Math.min(ty, H - 120) + 'px';
      tooltip.classList.add('visible');

      tooltip.querySelector('.tt-name').textContent = best.name || '(Untitled)';
      tooltip.querySelector('.tt-meta').innerHTML =
        `${best.date} · ${best.total_msgs} messages`;
      const topicEl = tooltip.querySelector('.tt-topic');
      topicEl.textContent = getTopicLabel(best.topic);
      topicEl.style.background = getTopicColor(best.topic) + '25';
      topicEl.style.color = getTopicColor(best.topic);
    } else {
      tooltip.classList.remove('visible');
    }
  }).on('mouseleave', () => tooltip.classList.remove('visible'));

  // Color mode buttons
  document.querySelectorAll('.umap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.umap-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.color;
      circles.transition().duration(400).attr('fill', d => getColor(d));
      updateLegend();
    });
  });

  // Legend
  function updateLegend() {
    legend.innerHTML = '';
    if (currentMode === 'topic') {
      const topics = DATA.topics ? DATA.topics.topics : [];
      topics.forEach(t => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<div class="legend-dot" style="background:${t.color}"></div>${t.label}`;
        legend.appendChild(item);
      });
    } else if (currentMode === 'cluster') {
      clusters.forEach(cl => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<div class="legend-dot" style="background:${cl.topic_color}"></div>${cl.topic_label} (${cl.size})`;
        legend.appendChild(item);
      });
    }
  }
  updateLegend();
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH
// ═══════════════════════════════════════════════════════════════════════════════
function renderGraph() {
  if (!DATA.graph) return;
  const { nodes, edges, categories } = DATA.graph;

  const container = document.getElementById('graph-container');
  const svg = d3.select('#graph-svg');
  const tooltip = document.getElementById('graph-tooltip');

  const W = container.getBoundingClientRect().width;
  const H = container.getBoundingClientRect().height;

  svg.attr('viewBox', `0 0 ${W} ${H}`);

  // Defs: arrowheads (not needed for undirected)
  const defs = svg.append('defs');
  const filter = defs.append('filter').attr('id', 'glow');
  filter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Zoom
  const zoomG = svg.append('g');
  const zoom = d3.zoom().scaleExtent([0.3, 8]).on('zoom', e => zoomG.attr('transform', e.transform));
  svg.call(zoom);

  // Category filter
  let activeCategories = new Set(categories.map(c => c.name));
  const pillsEl = document.getElementById('category-pills');
  const legendEl = document.getElementById('graph-legend');

  const CATEGORY_COLORS = {
    'AI/ML':        '#6366f1',
    'Software':     '#22c55e',
    'Business':     '#f59e0b',
    'Data Science': '#06b6d4',
    'Leadership':   '#ec4899',
    'Research':     '#a855f7',
    'Other':        '#94a3b8',
  };

  categories.forEach(cat => {
    const color = CATEGORY_COLORS[cat.name] || '#888';
    // Pill
    const pill = document.createElement('div');
    pill.className = 'pill active';
    pill.style.color = color;
    pill.style.borderColor = color + '60';
    pill.innerHTML = `<div class="dot" style="background:${color}"></div>${cat.name} (${cat.count})`;
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      if (activeCategories.has(cat.name)) activeCategories.delete(cat.name);
      else activeCategories.add(cat.name);
      updateVisibility();
    });
    pillsEl.appendChild(pill);

    // Legend item
    const li = document.createElement('div');
    li.className = 'legend-item';
    li.innerHTML = `<div class="legend-dot" style="background:${color}"></div>${cat.name}`;
    legendEl.appendChild(li);
  });

  // Force simulation
  const simNodes = nodes.map(n => ({ ...n }));
  const simLinks = edges.map(e => ({ ...e }));

  const sizeScale = d3.scaleSqrt().domain([0, d3.max(nodes, n => n.freq)]).range([4, 22]);

  const simulation = d3.forceSimulation(simNodes)
    .force('link', d3.forceLink(simLinks).id(d => d.id).distance(d => 80 + (1 / d.weight) * 60).strength(0.3))
    .force('charge', d3.forceManyBody().strength(-280).distanceMax(500))
    .force('center', d3.forceCenter(W / 2, H / 2).strength(0.05))
    .force('collision', d3.forceCollide(d => sizeScale(d.freq) + 8))
    .alphaDecay(0.015);

  // Links
  const linkSel = zoomG.append('g').attr('class', 'links')
    .selectAll('line').data(simLinks).join('line')
    .attr('stroke', d => {
      const sNode = nodes.find(n => n.id === d.source);
      return sNode ? (CATEGORY_COLORS[sNode.category] || '#888') : '#888';
    })
    .attr('stroke-opacity', 0.2)
    .attr('stroke-width', d => d.width);

  // Nodes
  const nodeSel = zoomG.append('g').attr('class', 'nodes')
    .selectAll('g').data(simNodes).join('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }));

  nodeSel.append('circle')
    .attr('r', d => sizeScale(d.freq))
    .attr('fill', d => CATEGORY_COLORS[d.category] || '#888')
    .attr('fill-opacity', 0.8)
    .attr('stroke', d => CATEGORY_COLORS[d.category] || '#888')
    .attr('stroke-width', 1.5)
    .attr('stroke-opacity', 0.4);

  nodeSel.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', 'white')
    .attr('font-size', d => Math.max(7, Math.min(12, sizeScale(d.freq) * 0.7)))
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-weight', '600')
    .attr('pointer-events', 'none')
    .attr('paint-order', 'stroke')
    .attr('stroke', 'rgba(10,10,15,0.5)')
    .attr('stroke-width', 2)
    .text(d => sizeScale(d.freq) > 8 ? d.label : '');

  // Tooltip
  nodeSel.on('mouseover', function(event, d) {
    d3.select(this).select('circle').attr('fill-opacity', 1).attr('filter', 'url(#glow)');
    tooltip.classList.add('visible');
    tooltip.innerHTML = `
      <strong style="color:${CATEGORY_COLORS[d.category]}">${d.label}</strong><br/>
      <span style="color:#6e6e8a">${d.category}</span><br/>
      <span style="font-family: monospace; font-size: 0.7em">${d.freq} conversations · ${d.degree} connections</span>
    `;
  })
  .on('mousemove', function(event) {
    const rect = container.getBoundingClientRect();
    tooltip.style.left = (event.clientX - rect.left + 12) + 'px';
    tooltip.style.top = (event.clientY - rect.top + 12) + 'px';
  })
  .on('mouseout', function() {
    d3.select(this).select('circle').attr('fill-opacity', 0.8).attr('filter', null);
    tooltip.classList.remove('visible');
  });

  simulation.on('tick', () => {
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  function updateVisibility() {
    nodeSel.attr('opacity', d => activeCategories.has(d.category) ? 1 : 0.1);
    linkSel.attr('opacity', d => {
      const s = simNodes.find(n => n.id === (d.source.id || d.source));
      const t = simNodes.find(n => n.id === (d.target.id || d.target));
      return (s && t && activeCategories.has(s.category) && activeCategories.has(t.category)) ? 1 : 0.02;
    });
  }

  // Graph controls
  document.getElementById('graph-zoom-in').addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.5);
  });
  document.getElementById('graph-zoom-out').addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.67);
  });
  document.getElementById('graph-reset').addEventListener('click', () => {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOLTIP UTILITY
// ═══════════════════════════════════════════════════════════════════════════════
function createFloatingTooltip() {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed;
    background: rgba(18,18,26,0.95);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-family: Inter, sans-serif;
    color: #e8e8f0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    z-index: 1000;
    max-width: 240px;
    line-height: 1.5;
    backdrop-filter: blur(8px);
  `;
  document.body.appendChild(el);

  return {
    show(event, html) {
      el.innerHTML = html;
      el.style.opacity = '1';
      this.move(event);
    },
    move(event) {
      const x = event.clientX + 14;
      const y = event.clientY + 14;
      el.style.left = Math.min(x, window.innerWidth - 260) + 'px';
      el.style.top = Math.min(y, window.innerHeight - 120) + 'px';
    },
    hide() { el.style.opacity = '0'; },
  };
}

// ── Start ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
