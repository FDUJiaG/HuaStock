#!/usr/bin/env node

/**
 * HuaStock Build Script
 * =======================
 * Scans Stocks/ directory for HTML report files,
 * extracts metadata, and generates index.html
 * as a professional research report portal.
 *
 * Usage: node build.js
 *
 * Naming convention for reports (Stocks/*.html):
 *   {CompanyName}-{Ticker}-{ReportType}.html
 *   Example: 宁德时代-300750-深度研究.html
 *   Example: Nvidia-NVDA-行业分析.html
 */

const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────
const SITE_TITLE = '国仕无双 · 研究报告库';
const SITE_SUBTITLE = 'HuaStock Research Reports';
const SITE_DESCRIPTION = '研究覆盖 A 股、港股、美股 — 专业深度，价值发现';
const STOCKS_DIR = path.join(__dirname, 'Stocks');
const OUTPUT_HTML = path.join(__dirname, 'index.html');

// Category display mapping
const CATEGORY_MAP = {
  'A-Shares':  { label: 'A 股',   badge: 'A股', color: '#dc2626' },
  'HK-Stocks': { label: '港股',   badge: '港股', color: '#2563eb' },
  'US-Stocks': { label: '美股',   badge: '美股', color: '#059669' },
};

// ─── File Scanner ────────────────────────────────────────────────────
function scanHtmlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...scanHtmlFiles(fullPath));
    } else if (item.isFile() && /\.html$/i.test(item.name) && item.name !== 'index.html') {
      const category = path.basename(dir);
      const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
      const stats = fs.statSync(fullPath);
      results.push({
        filePath: relativePath,
        fileName: item.name,
        category,
        mtime: stats.mtime,
        size: stats.size,
      });
    }
  }
  return results;
}

// ─── Title Extractor ──────────────────────────────────────────────────
function extractTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/<title>([^<]*)<\/title>/i);
    return match ? cleanTitle(match[1].trim()) : null;
  } catch {
    return null;
  }
}

// Strips trailing date/period qualifiers from titles, since the date
// is already displayed separately on the card.
// Examples:
//   "CME Group 深度分析报告 — 2026年4月"  → "CME Group 深度分析报告"
//   "某报告（2026年5月）"                   → "某报告"
//   "某报告 | 2026 Q1"                      → "某报告"
function cleanTitle(title) {
  // Pattern: trailing separator + year-based period/date
  // Matches: — 2026年4月, — 2026年4月29日, — 2026.04, — 2026-04, — 2026/04
  //          | 2026年4月, (2026年4月), 2026年4月 (at end)
  return title.replace(
    /[\s]*[—–\-|/\\()（）]\s*\d{4}\s*[年.\-\/]\s*(?:\d{1,2}\s*[月.\-\/]?\s*(?:\d{1,2}\s*日?)?)?\s*$/, 
    ''
  ).trim();
}

// ─── Description Extractor (first heading / meta description) ────────
function extractDescription(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Try meta description first
    const metaMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    if (metaMatch) return metaMatch[1].trim();
    // Fallback: first <h1> or <h2> text
    const hMatch = content.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
    if (hMatch) return hMatch[1].trim();
    return null;
  } catch {
    return null;
  }
}

// ─── Report date extractor ───────────────────────────────────────────
// Extracts report date from HTML content with decreasing priority.
// Prefers dates explicitly labeled as report/analysis dates.
function extractReportDate(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Priority 1: Explicit <div class="date">...</div>
    const dateDivMatch = content.match(/<div\s+class=["']date["'][^>]*>([^<]*)<\/div>/i);
    if (dateDivMatch) {
      const parsed = parseDateStr(dateDivMatch[1].trim());
      if (parsed) return parsed;
    }

    // Priority 2: <meta name="date" content="...">
    const metaDateMatch = content.match(/<meta\s+name=["']date["']\s+content=["']([^"']+)["']/i);
    if (metaDateMatch) {
      const parsed = parseDateStr(metaDateMatch[1].trim());
      if (parsed) return parsed;
    }

    // Priority 3: Any element containing a date label keyword
    // Matches: 报告日期、分析日期、生成时间、发布日期、撰写日期、数据截止日期
    // followed by a date in any format (YYYY年M月D日, YYYY-MM-DD, YYYY.M.D, etc.)
    const labelDateRE = /(?:报告日期|分析日期|生成时间|发布日期|撰写日期|数据截止日期)[：:]\s*(\d{4})\s*[年.\-\/]\s*(\d{1,2})\s*[月.\-\/]\s*(\d{1,2})\s*[日]?/;
    const labelMatch = content.match(labelDateRE);
    if (labelMatch) {
      return `${labelMatch[1]}.${String(Number(labelMatch[2])).padStart(2, '0')}.${String(Number(labelMatch[3])).padStart(2, '0')}`;
    }

    // Priority 4: Standalone "YYYY年M月D日" anywhere
    const chineseDateRE = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
    const chineseMatch = content.match(chineseDateRE);
    if (chineseMatch) {
      return `${chineseMatch[1]}.${String(Number(chineseMatch[2])).padStart(2, '0')}.${String(Number(chineseMatch[3])).padStart(2, '0')}`;
    }

    return null;
  } catch {
    return null;
  }
}

// Parses a variety of date strings into "YYYY.MM.DD" format
function parseDateStr(str) {
  // "2026年5月8日"
  let m = str.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${m[1]}.${String(Number(m[2])).padStart(2, '0')}.${String(Number(m[3])).padStart(2, '0')}`;

  // "2026.5.8" or "2026-05-08" or "2026/05/08"
  m = str.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (m) return `${m[1]}.${String(Number(m[2])).padStart(2, '0')}.${String(Number(m[3])).padStart(2, '0')}`;

  return null;
}

// ─── Truncate ────────────────────────────────────────────────────────
function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ─── HTML Escaper ────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Generate Index HTML ─────────────────────────────────────────────
function generateIndex(reports, categoryRawCounts) {
  const uniqueCount = reports.length;
  const totalRaw = Object.values(categoryRawCounts).reduce((a, b) => a + b, 0);
  const hasDups = totalRaw > uniqueCount;
  // Sort by report date descending (newest first), fallback to mtime
  reports.sort((a, b) => {
    if (a.reportDate && b.reportDate) {
      return b.reportDate.localeCompare(a.reportDate);
    }
    if (a.reportDate) return -1;
    if (b.reportDate) return 1;
    return new Date(b.mtime) - new Date(a.mtime);
  });

  const reportsJSON = JSON.stringify(
    reports.map(r => {
      const badges = r.categories.map(cat => ({
        label: CATEGORY_MAP[cat]?.badge || cat,
        color: CATEGORY_MAP[cat]?.color || '#6b7280',
        category: cat,
      }));
      return {
        title: esc(r.title),
        fileName: esc(r.fileName),
        path: r.paths[0],
        categories: r.categories,
        badges,
        date: r.reportDate || formatDate(r.mtime),
        description: esc(truncate(r.description, 120)),
      };
    })
  );

  const uniqueTotal = reports.length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${esc(SITE_DESCRIPTION)}" />
  <link rel="icon" href="favicon.jpg" type="image/jpeg" />
  <title>${SITE_TITLE}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#312e81', 900: '#1e1b4b', 950: '#0f172a' },
            navy: { 900: '#0a1628', 800: '#0f1f3a', 700: '#162a4a', 600: '#1e3a5f' },
            gold: { DEFAULT: '#c9a84c', light: '#dfc06a', dark: '#a8882e' },
          },
          fontFamily: {
            display: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
            body: ['"Inter"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
          },
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@400;600;700;900&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
      background: #f0f2f5;
      color: #1f2937;
      min-height: 100vh;
    }

    /* ── Header ── */
    .site-header {
      background: linear-gradient(135deg, #0a1628 0%, #162a4a 50%, #1e3a5f 100%);
      border-bottom: 3px solid #c9a84c;
      position: relative;
      overflow: hidden;
    }
    .site-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%);
      border-radius: 50%;
    }
    .site-header::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: 20%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%);
      border-radius: 50%;
    }

    /* ── Filters ── */
    .filter-tab {
      padding: 8px 20px;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1.5px solid transparent;
      background: #f3f4f6;
      color: #6b7280;
      user-select: none;
    }
    .filter-tab:hover { background: #e5e7eb; color: #374151; }
    .filter-tab.active {
      background: #0a1628;
      color: #c9a84c;
      border-color: #c9a84c;
      box-shadow: 0 2px 8px rgba(201,168,76,0.25);
    }

    /* ── Search ── */
    .search-input {
      width: 100%;
      padding: 10px 16px 10px 40px;
      border: 1.5px solid #e5e7eb;
      border-radius: 10px;
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s ease;
      background: white;
    }
    .search-input:focus {
      border-color: #c9a84c;
      box-shadow: 0 0 0 3px rgba(201,168,76,0.15);
    }
    .search-wrapper { position: relative; }
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      pointer-events: none;
    }

    /* ── Stats Bar ── */
    .stat-bubble {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    /* ── Cards ── */
    .report-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }
    @media (max-width: 480px) {
      .report-grid { grid-template-columns: 1fr; }
    }

    .report-card {
      background: white;
      border-radius: 14px;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid #f0f0f0;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .report-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 30px rgba(0,0,0,0.08);
      border-color: #e0e0e0;
    }

    .card-accent {
      height: 4px;
      flex-shrink: 0;
    }

    .card-body {
      padding: 20px 22px 18px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .card-badge {
      display: inline-block;
      padding: 3px 12px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-bottom: 12px;
      align-self: flex-start;
      color: white;
    }

    .card-title {
      font-family: 'Noto Serif SC', 'Source Han Serif SC', Georgia, serif;
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.5;
      color: #111827;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-filename {
      font-size: 0.78rem;
      color: #9ca3af;
      margin-bottom: 10px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid #f3f4f6;
    }

    .card-date {
      font-size: 0.78rem;
      color: #6b7280;
    }

    .card-link {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #0a1628;
      text-decoration: none;
      transition: all 0.2s;
      padding: 4px 12px;
      border-radius: 8px;
      background: #f3f4f6;
    }
    .card-link:hover {
      background: #0a1628;
      color: #c9a84c;
      gap: 8px;
    }

    /* ── Empty State ── */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
    }
    .empty-state svg { margin: 0 auto 16px; }

    /* ── Footer ── */
    .site-footer {
      text-align: center;
      padding: 30px 20px;
      color: #9ca3af;
      font-size: 0.8rem;
      border-top: 1px solid #e5e7eb;
      margin-top: 50px;
      background: white;
    }

    /* ── Category dot colors ── */
    .dot-A\\股 { color: #dc2626; }
    .dot-港股 { color: #2563eb; }
    .dot-美股 { color: #059669; }

    /* ── Animations ── */
    .card-enter {
      animation: cardFadeIn 0.35s ease forwards;
    }
    @keyframes cardFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .card-exit {
      animation: cardFadeOut 0.25s ease forwards;
    }
    @keyframes cardFadeOut {
      from { opacity: 1; transform: scale(1); }
      to   { opacity: 0; transform: scale(0.95); }
    }
  </style>
</head>
<body>

  <!-- ════ Header ════ -->
  <header class="site-header">
    <div class="relative z-10 max-w-6xl mx-auto px-6 py-12 sm:py-16">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border-2 border-gold/40 shadow-lg shadow-gold/10">
          <img src="favicon.jpg" alt="HuaStock" class="w-full h-full object-cover" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white font-display tracking-wide">${SITE_TITLE}</h1>
      </div>
      <p class="text-gray-400 text-sm sm:text-base mb-2">${SITE_SUBTITLE}</p>
      <p class="text-gray-500 text-sm">${SITE_DESCRIPTION}</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <span class="stat-bubble bg-white/10 text-gray-300 border border-white/10">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          共 <strong id="total-count">${uniqueTotal}</strong> 份研究报告
          ${hasDups ? `<span class="text-gray-500 text-[10px] ml-1">(去重)</span>` : ''}
        </span>
        ${Object.entries(categoryRawCounts).map(([label, count]) =>
          `<span class="stat-bubble bg-white/10 text-gray-300 border border-white/10">${label} <strong>${count}</strong></span>`
        ).join('')}
      </div>
    </div>
  </header>

  <!-- ════ Main ════ -->
  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-8">

    <!-- ── Filters ── -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
      <div class="flex flex-wrap gap-2">
        <button class="filter-tab active" data-filter="all">🏛️ 全部</button>
        <button class="filter-tab" data-filter="A-Shares">📈 A 股</button>
        <button class="filter-tab" data-filter="HK-Stocks">🇭🇰 港股</button>
        <button class="filter-tab" data-filter="US-Stocks">🇺🇸 美股</button>
      </div>
      <div class="search-wrapper sm:ml-auto sm:w-64">
        <svg class="search-icon w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input class="search-input" type="text" placeholder="搜索报告标题…" id="search-input" />
      </div>
    </div>

    <!-- ── Reports Grid ── -->
    <div id="reports-grid" class="report-grid">
      <!-- Cards are rendered by JS -->
    </div>

    <!-- ── Empty State (shown when no results match) ── -->
    <div id="empty-state" class="empty-state hidden">
      <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p class="text-lg font-medium text-gray-400">未找到匹配的研究报告</p>
      <p class="text-sm text-gray-400 mt-1">试试其他关键词或分类</p>
    </div>

  </main>

  <!-- ════ Footer ════ -->
  <footer class="site-footer">
    <div class="max-w-3xl mx-auto">
      <p class="text-xs leading-relaxed text-gray-400">
        <strong>免责声明：</strong>本网站提供的研究报告仅供信息参考，不构成任何投资建议。<br />
        报告中的观点、数据及分析可能受市场环境变化及你对<span class="text-gold font-bold">华总的信仰程度</span>影响，投资者应独立判断并自担风险。
      </p>
      <p class="mt-3 text-xs text-gray-400">
        © ${new Date().getFullYear()} 国仕无双 · HuaStock &nbsp;|&nbsp; Powered by Hua Research Platform
      </p>
    </div>
  </footer>

  <!-- ════ Report Data (embedded by build script) ════ -->
  <script id="reports-data" type="application/json">${reportsJSON}</script>

  <!-- ════ Client-Side Rendering ════ -->
  <script>
    (function() {
      'use strict';

      const reports = JSON.parse(document.getElementById('reports-data').textContent);
      const grid = document.getElementById('reports-grid');
      const emptyState = document.getElementById('empty-state');
      const totalCountEl = document.getElementById('total-count');

      let currentFilter = 'all';
      let currentSearch = '';

      const filterTabs = document.querySelectorAll('.filter-tab');
      const searchInput = document.getElementById('search-input');

      function render() {
        // Filter by category
        let filtered = reports;
        if (currentFilter !== 'all') {
          filtered = filtered.filter(r => r.categories.includes(currentFilter));
        }
        // Search by keyword
        if (currentSearch.trim()) {
          const q = currentSearch.trim().toLowerCase();
          filtered = filtered.filter(r =>
            r.title.toLowerCase().includes(q) ||
            r.fileName.toLowerCase().includes(q)
          );
        }

        // Update visible count
        if (totalCountEl) totalCountEl.textContent = filtered.length;

        // Empty state
        if (filtered.length === 0) {
          emptyState.classList.remove('hidden');
          grid.innerHTML = '';
          return;
        }
        emptyState.classList.add('hidden');

        // Build cards
        grid.innerHTML = filtered.map((r, i) => {
          const badgesHtml = r.badges.map((b, bi) => \`
            <span class="card-badge" style="background: \${b.color}">\${b.label}</span>
          \`).join('');

          // Card accent bar: gradient if multiple categories, solid if one
          let accentStyle;
          if (r.badges.length === 1) {
            accentStyle = 'background: ' + r.badges[0].color;
          } else {
            const stops = r.badges.map((b, bi) =>
              b.color + ' ' + (bi / r.badges.length * 100) + '%' +
              ', ' + b.color + ' ' + ((bi + 1) / r.badges.length * 100) + '%'
            ).join(', ');
            accentStyle = 'background: linear-gradient(to right, ' + stops + ')';
          }

          return \`
          <div class="report-card card-enter" style="animation-delay: \${Math.min(i * 30, 300)}ms">
            <div class="card-accent" style="\${accentStyle}"></div>
            <div class="card-body">
              <div class="flex flex-wrap gap-1.5 mb-2.5">
                \${badgesHtml}
              </div>
              <h3 class="card-title" title="\${r.title}">\${r.title}</h3>
              <div class="card-filename" title="\${r.fileName}">\${r.fileName}</div>
              <div class="card-meta">
                <span class="card-date">
                  <svg class="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  \${r.date}
                </span>
                <a class="card-link" href="\${r.path}" target="_blank">
                  阅读报告
                  <svg class="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        \`}).join('');
      }

      // ── Event Listeners ──
      filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
          filterTabs.forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          currentFilter = this.dataset.filter;
          render();
        });
      });

      searchInput.addEventListener('input', function() {
        currentSearch = this.value;
        render();
      });

      // Initial render
      render();
    })();
  </script>

</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────
function main() {
  console.log('🔍 扫描研究报告...');
  const files = scanHtmlFiles(STOCKS_DIR);

  if (files.length === 0) {
    console.log('⚠️  未在 Stocks/ 目录下找到 HTML 报告文件。');
  } else {
    console.log(`📄 发现 ${files.length} 份研究报告`);
  }

  // Extract metadata
  const raw = files.map(f => {
    const title = extractTitle(f.filePath);
    const description = extractDescription(f.filePath);
    const reportDate = extractReportDate(f.filePath);
    console.log(`   ${title || f.fileName}  [${reportDate || '日期未知'}]`);
    return { ...f, title: title || f.fileName.replace(/\.html$/i, ''), description, reportDate };
  });

  // Merge duplicates: same fileName across multiple folders → single entry with multiple categories
  const grouped = {};
  const categoryRawCounts = {};
  for (const r of raw) {
    const catLabel = CATEGORY_MAP[r.category]?.label || r.category;
    categoryRawCounts[catLabel] = (categoryRawCounts[catLabel] || 0) + 1;

    if (!grouped[r.fileName]) {
      grouped[r.fileName] = { ...r, categories: [r.category], paths: [r.filePath] };
    } else {
      // Merge: add category if not already present, add path
      const g = grouped[r.fileName];
      if (!g.categories.includes(r.category)) {
        g.categories.push(r.category);
        g.paths.push(r.filePath);
      }
      // Prefer later date if current report has a date
      if (r.reportDate && (!g.reportDate || r.reportDate > g.reportDate)) {
        g.reportDate = r.reportDate;
      }
    }
  }
  const reports = Object.values(grouped);
  // Sort by reportDate, then fileName for ties
  reports.sort((a, b) => {
    if (a.reportDate && b.reportDate) {
      const cmp = b.reportDate.localeCompare(a.reportDate);
      if (cmp !== 0) return cmp;
    }
    if (a.reportDate) return -1;
    if (b.reportDate) return 1;
    return a.fileName.localeCompare(b.fileName);
  });

  // Generate index
  console.log('\n📝 生成 index.html...');
  const html = generateIndex(reports, categoryRawCounts);
  fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');

  const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
  const uniqueCount = reports.length;
  const rawCount = Object.values(categoryRawCounts).reduce((a, b) => a + b, 0);
  console.log(`✅ 构建完成！index.html (${sizeKb} KB) 已生成`);
  console.log(`   📊 ${uniqueCount} 份独立报告${rawCount > uniqueCount ? `（${rawCount} 次文件分布，已去重）` : ''}`);
  console.log(`🌐 打开 index.html 即可浏览研究报告库`);
}

main();
