// Charts of the paper's results, drawn into <div class="chart" data-chart="NAME">.
// Values are read off the paper's Figures 2–7; Figures 2–4 each sum to the 103 events.
(function () {
  // Stack order keeps blue and violet apart: they are too close to share an edge
  const NETS = ['B2', 'Cluster', 'B4'];
  const COLOR = { B2: '#3987e5', Cluster: '#c98500', B4: '#9085e9', Shared: '#6b7a99' };
  const TOTAL = { B2: 34, Cluster: 43, B4: 26 };

  // Figure 2: [control, data, management] per network
  const PLANES = { Cluster: [18, 10, 15], B2: [9, 13, 12], B4: [16, 3, 7] };

  // Figure 3: [element, count, network]
  const ELEMENTS = [
    ['CAR', 15, 'Cluster'], ['B2BR', 15, 'B2'], ['CPN', 12, 'Shared'], ['ToR', 11, 'Cluster'],
    ['Fabric', 10, 'Cluster'], ['B2CR', 9, 'B2'], ['B4BR', 8, 'B4'], ['B2 bundle', 7, 'B2'],
    ['BwE', 6, 'B4'], ['B4 bundle', 5, 'B4'], ['Topology Modeler', 3, 'B4'], ['Gateway', 2, 'B4'],
  ];

  // Figures 4, 6, 7: [label, [B2, Cluster, B4]]
  const IMPACT = [
    ['Blackhole', [6, 18, 10]],
    ['High priority, high loss', [15, 11, 0]],
    ['High priority, low loss', [1, 0, 0]],
    ['Low priority, high loss', [8, 6, 8]],
    ['Low priority, low loss', [3, 5, 7]],
    ['No impact', [1, 3, 1]],
  ];

  const EVOLUTION = [
    ['MOp in progress', [19, 32, 17]],
    ['Software bug', [4, 20, 12]],
    ['Configuration change', [13, 7, 7]],
    ['Software rollout', [0, 15, 4]],
    ['Upgrade', [8, 4, 4]],
  ];

  const CAUSES = {
    Data: [
      ['Concurrent hardware failure', [8, 1, 4]],
      ['CPN failure', [0, 4, 6]],
      ['Device resource overruns', [1, 4, 3]],
      ['Fabric asymmetry or freeze', [0, 6, 1]],
      ['Bad CoS markings', [4, 0, 2]],
      ['Link flaps or errors', [2, 1, 0]],
    ],
    Control: [
      ['Inconsistent control-plane elements', [1, 8, 0]],
      ['Concurrent buggy software push', [0, 5, 1]],
      ['Cascade of control-plane elements', [0, 0, 5]],
      ['Data and control plane out of sync', [2, 1, 2]],
      ['Control-plane failure', [0, 2, 1]],
      ['Incorrect traffic engineering', [0, 1, 2]],
      ['Convergence delays', [1, 0, 1]],
    ],
    Management: [
      ['Process executed wrong', [5, 6, 1]],
      ['Risk assessment failure', [5, 4, 2]],
      ['Routing misconfiguration', [6, 2, 1]],
      ['Bug in management automation', [0, 5, 2]],
      ['Wrong or incomplete process', [2, 3, 1]],
      ['Competing drains or upgrades', [2, 1, 0]],
    ],
  };

  // Figure 5, traced: [minutes, fraction of failures resolved by then]
  const DURATION = {
    B2: [[4, 0], [5.8, 0.06], [10, 0.15], [13.5, 0.23], [18.7, 0.35], [26, 0.38], [36, 0.47], [45, 0.56],
      [60, 0.75], [88, 0.82], [133, 0.91], [300, 0.94], [1000, 0.97], [1870, 1]],
    Cluster: [[1, 0.02], [5, 0.12], [10, 0.15], [18, 0.28], [26, 0.35], [42, 0.47], [70, 0.58], [107, 0.65],
      [165, 0.77], [230, 0.86], [285, 0.91], [1470, 0.93], [2900, 0.95], [6000, 0.98], [10400, 1]],
    B4: [[2, 0.04], [3, 0.08], [5, 0.12], [11, 0.16], [19, 0.23], [23, 0.27], [32, 0.46], [63, 0.54],
      [105, 0.58], [133, 0.65], [200, 0.73], [285, 0.77], [400, 0.81], [520, 0.85], [1000, 0.89],
      [4600, 0.92], [6900, 0.96], [13700, 1]],
  };

  const sum = a => a.reduce((x, y) => x + y, 0);
  const title = t => `<div class="ctitle">${t}</div>`;
  const legend = keys => '<div class="legend">' +
    keys.map(k => `<span><i style="background:${COLOR[k]}"></i>${k}</span>`).join('') + '</div>';

  // Horizontal bars; each row is [label, [[network, value], ...]]
  function bars(rows, max) {
    return '<div class="rows">' + rows.map(([label, parts]) => {
      const total = sum(parts.map(p => p[1]));
      const segs = parts.filter(p => p[1] > 0).map(([net, v]) =>
        `<span class="seg" style="flex:${v} 1 0;background:${COLOR[net]}" data-tip="${label} · ${net}: ${v}"></span>`).join('');
      return `<span class="lbl">${label}</span><span class="track">` +
        `<span class="cbar" style="width:calc((100% - 2.2em) * ${total / max})">${segs}</span>` +
        `<b class="val">${total}</b></span>`;
    }).join('') + '</div>';
  }

  const stacked = rows => rows.map(([label, vals]) => [label, vals.map((v, i) => [NETS[i], v])]);

  const render = {
    dataset() {
      const squares = NETS.flatMap(net => Array.from({ length: TOTAL[net] },
        () => `<i style="background:${COLOR[net]}" data-tip="${net}: ${TOTAL[net]} failure events"></i>`));
      return '<div class="dataset"><div class="hero"><b>103</b><span>high-impact failures,<br>two years</span></div>' +
        `<div><div class="waffle">${squares.join('')}</div>` +
        '<div class="legend">' + NETS.map(n =>
          `<span><i style="background:${COLOR[n]}"></i>${n} <b>${TOTAL[n]}</b></span>`).join('') + '</div></div></div>';
    },

    planes() {
      const max = 18;
      const head = '<tr><th></th><th>Control</th><th>Data</th><th>Mgmt</th><th>Total</th></tr>';
      const body = ['Cluster', 'B2', 'B4'].map(net => '<tr><th class="row">' + net + '</th>' +
        PLANES[net].map((v, i) => {
          const plane = ['control', 'data', 'management'][i];
          const mix = Math.round(18 + 72 * v / max);
          const callout = net === 'B4' && i === 0 ? ' class="callout"' : '';
          return `<td${callout} style="background:color-mix(in srgb, #3987e5 ${mix}%, #131d33)" ` +
            `data-tip="${net} · ${plane}: ${v} of ${TOTAL[net]}">${v}</td>`;
        }).join('') + `<td class="total">${TOTAL[net]}</td></tr>`).join('');
      return title('By network and plane') + `<table class="heat">${head}${body}</table>`;
    },

    elements() {
      const rows = ELEMENTS.map(([label, v, net]) => [label, [[net, v]]]);
      return title('By network element') + legend(['B2', 'Cluster', 'B4', 'Shared']) + bars(rows, 15);
    },

    impact() {
      return legend(NETS) + bars(stacked(IMPACT), 34);
    },

    evolution() {
      return legend(NETS) + bars(stacked(EVOLUTION), 68);
    },

    causes() {
      return legend(NETS) + '<div class="cols">' + Object.entries(CAUSES).map(([plane, rows]) =>
        `<div class="compact">${title(plane + ' plane')}${bars(stacked(rows), 13)}</div>`).join('') + '</div>';
    },

    duration() {
      const W = 300, H = 210, L = 40, R = 12, T = 30, B = 30;
      const pw = W - L - R, ph = H - T - B, span = 4.2;
      const x = m => L + Math.log10(m) / span * pw;
      const y = f => T + (1 - f) * ph;
      const at = (pts, m) => Math.max(0, ...pts.filter(p => p[0] <= m).map(p => p[1]));
      const ticks = [[1, '1 min'], [10, '10 min'], [60, '1 h'], [1440, '1 day'], [10080, '1 wk']];
      return '<div class="cdfs">' + NETS.map(net => {
        const pts = DURATION[net];
        const share = Math.round((at(pts, 100) - at(pts, 10)) * 100);
        const d = `M${x(pts[0][0])} ${y(0)}` + pts.map(([m, f], i) => (i ? `H${x(m)}` : '') + `V${y(f)}`).join('') + `H${x(10 ** span)}`;
        const hits = pts.map(([m, f]) => `<circle cx="${x(m)}" cy="${y(f)}" r="7" fill="transparent">` +
          `<title>${Math.round(f * 100)}% of ${net} failures resolved within ${m < 120 ? Math.round(m) + ' min' : Math.round(m / 60) + ' h'}</title></circle>`).join('');
        return `<div class="cdf"><div class="ctitle"><i style="background:${COLOR[net]}"></i>${net} <span>n = ${TOTAL[net]}</span></div>` +
          `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${net}: about ${share}% of failures lasted 10 to 100 minutes">` +
          `<rect x="${x(10)}" y="${T}" width="${x(100) - x(10)}" height="${ph}" fill="#8fa3cf" fill-opacity="0.12"/>` +
          `<text class="band" x="${(x(10) + x(100)) / 2}" y="${T - 8}">≈${share}% here</text>` +
          [0, 0.5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(f)}" y2="${y(f)}" class="grid"/>` +
            `<text class="tick" x="${L - 6}" y="${y(f) + 4}" text-anchor="end">${f * 100}%</text>`).join('') +
          ticks.map(([m, t]) => `<text class="tick" x="${x(m)}" y="${H - 8}" text-anchor="middle">${t}</text>`).join('') +
          `<path d="${d}" fill="none" stroke="${COLOR[net]}" stroke-width="2" stroke-linejoin="round"/>${hits}</svg></div>`;
      }).join('') + '</div>';
    },
  };

  function init() {
    document.querySelectorAll('.chart[data-chart]').forEach(el => {
      el.innerHTML = render[el.dataset.chart]();
    });
    Reveal.layout();
  }

  Reveal.isReady() ? init() : Reveal.on('ready', init);
})();
