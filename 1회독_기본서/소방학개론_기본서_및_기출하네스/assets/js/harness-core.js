/**
 * 소방 수험 기본서 & 갤럭시 S26 Ultra 웹소설 리더 코어 스크립트 (v4)
 * - 데스크톱 2단 기본서 모드 & 갤럭시 S26 Ultra 1단 웹소설 몰입 모드 완벽 지원
 * - 웹소설 모드/모바일에서 본문을 가리지 않는 인라인 요약 캡슐 + 바텀시트(Bottom Sheet) 주석 팝업
 * - 표(.book-table), 본문(.prose-body), 기출문제/OX 지문 글자 크기(14~26px) 및 서체(명조/고딕) 100% 실시간 동기화
 */

const HarnessEngine = {
  isPinned: false,
  themeMode: 'paper', // 'paper' | 'sage' | 'night'
  isNight: false,
  isSans: false,
  isAlignLeft: false,
  isNovelMode: false,
  isNotesInline: false,
  bodySize: 17,
  lineHeight: 1.98,
  sidePad: 16,
  lastScrollY: 0,
  sidenoteData: [],

  init() {
    this.cleanLegacyInlineFontLock();
    this.loadReaderPrefs();
    this.setupMainColumnGrid();
    this.wrapTablesForMobile();
    this.injectReaderToolbar();
    this.injectBottomSheets();
    this.initAutoHideNav();
    this.initProgressBar();
    this.initEditorialSidenotes();
    this.handleOxDeepLink();

    window.addEventListener('resize', () => {
      this.preventSidenoteOverlap();
    });
  },

  cleanLegacyInlineFontLock() {
    const styleTags = document.querySelectorAll('head style');
    styleTags.forEach((st) => {
      if (st.id === 'fkFontGuardStyle') return;
      if (st.textContent && st.textContent.includes('font-family') && st.textContent.includes('!important')) {
        st.textContent = st.textContent.replace(/\*[\s\S]*?\}/g, '');
      }
    });

    document.querySelectorAll('.font-mono').forEach((el) => {
      el.classList.remove('font-mono');
    });

    this.enforceFontGuard();
    window.addEventListener('load', () => this.enforceFontGuard());
  },

  enforceFontGuard() {
    let guard = document.getElementById('fkFontGuardStyle');
    if (!guard) {
      guard = document.createElement('style');
      guard.id = 'fkFontGuardStyle';
    }
    const sz = (this.bodySize || 17) + 'px';
    const lh = this.lineHeight || 1.98;
    guard.textContent = `
      html body,
      html body * {
        font-family: var(--font-sans) !important;
      }
      html body main .prose-body,
      html body main .prose-body *:not(.fn-ref),
      html body main .book-p,
      html body main .book-p *:not(.fn-ref),
      html body main table.book-table,
      html body main table.book-table th,
      html body main table.book-table td,
      html body main table.book-table *:not(.fn-ref),
      html body .fk-sheet-list li,
      html body .fk-sheet-list li * {
        font-family: var(--font-body) !important;
      }
      html body main .prose-body {
        font-size: ${sz} !important;
        line-height: ${lh} !important;
      }
      html body main table.book-table,
      html body main table.book-table th,
      html body main table.book-table td,
      html body main table.book-table th *:not(sub):not(sup),
      html body main table.book-table td *:not(sub):not(sup),
      html body main .diagram-container:not(.cheat-sheet-wrap) > div:first-child span,
      html body main .diagram-container:not(.cheat-sheet-wrap) figcaption,
      html body main .schema-board,
      html body main .schema-board *:not(.schema-badge-icon):not(sub):not(sup) {
        font-family: var(--font-body) !important;
        font-size: ${sz} !important;
        line-height: 1.78 !important;
      }
      html body main .schema-panel-title {
        font-size: calc(${sz} + 1px) !important;
        font-weight: 800 !important;
      }
      html body main .sidenote {
        font-size: calc(${sz} * 0.84) !important;
      }
      html body main .sidenote-title {
        font-size: calc(${sz} * 0.78) !important;
      }
      nav.sticky {
        transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease !important;
        will-change: transform;
      }
      nav.sticky.fk-nav-hidden {
        transform: translateY(-110%) !important;
        pointer-events: none !important;
      }
      @media (max-width: 1119px) {
        html body main,
        html body.mode-novel main {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: ${this.sidePad}px !important;
          padding-right: ${this.sidePad}px !important;
          border-left: none !important;
          border-right: none !important;
          border-radius: 0 !important;
        }
        html body main .main-column {
          width: 100% !important;
          max-width: 100% !important;
        }
      }
      html body.mode-novel main {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-left: ${this.sidePad}px !important;
        padding-right: ${this.sidePad}px !important;
      }
      html body.mode-novel main .main-column {
        width: 100% !important;
        max-width: 100% !important;
      }
    `;
    document.head.appendChild(guard);
  },

  loadReaderPrefs() {
    try {
      const savedTheme = localStorage.getItem('fk_theme_mode');
      const legacyNight = localStorage.getItem('fk_night_mode') === '1';
      this.themeMode = savedTheme || (legacyNight ? 'night' : 'paper');
      this.isNight = (this.themeMode === 'night');
      this.isSans = localStorage.getItem('fk_font_sans') === '1';
      this.isAlignLeft = localStorage.getItem('fk_align_left') === '1';
      this.isNovelMode = localStorage.getItem('fk_novel_mode') === '1';
      this.isNotesInline = localStorage.getItem('fk_notes_inline') === '1';
      const savedSize = parseInt(localStorage.getItem('fk_font_size') || '17', 10);
      if (!isNaN(savedSize) && savedSize >= 14 && savedSize <= 26) {
        this.bodySize = savedSize;
      }
      const savedLh = parseFloat(localStorage.getItem('fk_line_height') || '1.98');
      if (!isNaN(savedLh) && savedLh >= 1.6 && savedLh <= 2.3) {
        this.lineHeight = savedLh;
      }
      const savedPad = parseInt(localStorage.getItem('fk_side_pad') || '16', 10);
      if (!isNaN(savedPad) && savedPad >= 0 && savedPad <= 64) {
        this.sidePad = savedPad;
      }
    } catch (e) {}
    this.applyReaderPrefs();
  },

  applyReaderPrefs() {
    this.isNight = (this.themeMode === 'night');
    document.body.classList.toggle('mode-night', this.themeMode === 'night');
    document.body.classList.toggle('mode-sage', this.themeMode === 'sage');
    document.body.classList.toggle('mode-novel', this.isNovelMode);
    document.body.classList.toggle('notes-inline-open', this.isNotesInline);

    document.documentElement.style.setProperty(
      '--font-body',
      this.isSans
        ? '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
        : '"RIDIBatang", "Noto Serif KR", "Nanum Myeongjo", Georgia, serif'
    );
    document.documentElement.style.setProperty(
      '--text-align-mode',
      'left'
    );
    document.documentElement.style.setProperty('--body-size', this.bodySize + 'px');
    document.documentElement.style.setProperty('--line-height', String(this.lineHeight));
    document.documentElement.style.setProperty('--side-pad', this.sidePad + 'px');
    this.enforceFontGuard();

    const fontBtn = document.getElementById('fkFontBtn');
    const alignBtn = document.getElementById('fkAlignBtn');
    const novelBtn = document.getElementById('fkNovelBtn');
    const sizeIndicator = document.getElementById('fkSizeIndicator');
    const padIndicator = document.getElementById('fkPadIndicator');
    const padSlider = document.getElementById('fkPadSlider');
    const noteModeBtn = document.getElementById('fkNoteModeBtn');

    if (fontBtn) fontBtn.textContent = this.isSans ? '고딕' : '명조';
    if (alignBtn) alignBtn.textContent = this.isAlignLeft ? '좌측 정렬' : '양쪽 정렬';
    if (novelBtn) {
      novelBtn.textContent = this.isNovelMode ? '1단 꽉찬뷰 ON' : '1단 꽉찬뷰 OFF';
      novelBtn.style.borderColor = this.isNovelMode ? 'var(--accent)' : '';
      novelBtn.style.color = this.isNovelMode ? 'var(--accent)' : '';
    }
    if (sizeIndicator) sizeIndicator.textContent = this.bodySize + 'px';
    if (padIndicator) padIndicator.textContent = this.sidePad + 'px';
    if (padSlider) padSlider.value = String(this.sidePad);
    if (noteModeBtn) {
      noteModeBtn.textContent = this.isNotesInline ? '주석: 본문 펼침' : '주석: 캡슐 팝업';
    }
  },

  cycleThemeMode() {
    const order = ['paper', 'sage', 'night'];
    const nextIdx = (order.indexOf(this.themeMode) + 1) % order.length;
    this.setThemeMode(order[nextIdx]);
  },

  setThemeMode(mode) {
    this.themeMode = mode;
    try {
      localStorage.setItem('fk_theme_mode', mode);
      localStorage.setItem('fk_night_mode', mode === 'night' ? '1' : '0');
    } catch (e) {}
    this.applyReaderPrefs();
  },

  toggleNightMode() {
    this.cycleThemeMode();
  },

  toggleFontFamily() {
    this.isSans = !this.isSans;
    try { localStorage.setItem('fk_font_sans', this.isSans ? '1' : '0'); } catch (e) {}
    this.applyReaderPrefs();
    setTimeout(() => this.preventSidenoteOverlap(), 60);
  },

  toggleTextAlign() {
    this.isAlignLeft = !this.isAlignLeft;
    try { localStorage.setItem('fk_align_left', this.isAlignLeft ? '1' : '0'); } catch (e) {}
    this.applyReaderPrefs();
  },

  toggleNovelMode() {
    this.isNovelMode = !this.isNovelMode;
    try { localStorage.setItem('fk_novel_mode', this.isNovelMode ? '1' : '0'); } catch (e) {}
    this.applyReaderPrefs();
    setTimeout(() => this.preventSidenoteOverlap(), 80);
  },

  toggleNotesInline() {
    this.isNotesInline = !this.isNotesInline;
    try { localStorage.setItem('fk_notes_inline', this.isNotesInline ? '1' : '0'); } catch (e) {}
    this.applyReaderPrefs();
    setTimeout(() => this.preventSidenoteOverlap(), 80);
  },

  adjustFontSize(delta) {
    this.bodySize = Math.min(26, Math.max(14, this.bodySize + delta));
    try { localStorage.setItem('fk_font_size', String(this.bodySize)); } catch (e) {}
    this.applyReaderPrefs();
    setTimeout(() => this.preventSidenoteOverlap(), 60);
  },

  setLineHeight(lh) {
    this.lineHeight = lh;
    try { localStorage.setItem('fk_line_height', String(lh)); } catch (e) {}
    this.applyReaderPrefs();
    setTimeout(() => this.preventSidenoteOverlap(), 60);
  },

  setupMainColumnGrid() {
    const mainEl = document.querySelector('main');
    if (!mainEl || mainEl.querySelector('.main-column') || !mainEl.querySelector('.sidenote')) return;

    const col = document.createElement('div');
    col.className = 'main-column';
    while (mainEl.firstChild) {
      col.appendChild(mainEl.firstChild);
    }
    mainEl.appendChild(col);
  },

  wrapTablesForMobile() {
    const tables = document.querySelectorAll('#sec1 table.book-table, #sec2 table.book-table, #sec3 table.book-table');
    tables.forEach((tbl) => {
      const block = tbl.closest('.overflow-x-auto') || tbl.closest('.para-block') || tbl;
      block.style.display = 'none';
    });
  },

  adjustSidePad(delta) {
    this.setSidePad(Math.min(64, Math.max(0, this.sidePad + delta)));
  },

  setSidePad(val) {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    this.sidePad = Math.min(64, Math.max(0, num));
    try { localStorage.setItem('fk_side_pad', String(this.sidePad)); } catch (e) {}
    this.applyReaderPrefs();
    setTimeout(() => this.preventSidenoteOverlap(), 60);
  },

  initAutoHideNav() {
    const navEl = document.querySelector('nav.sticky');
    if (!navEl) return;
    this.lastScrollY = window.scrollY || 0;

    window.addEventListener('scroll', () => {
      const curY = window.scrollY || 0;
      const diff = curY - this.lastScrollY;
      if (diff > 10 && curY > 56) {
        navEl.classList.add('fk-nav-hidden');
      } else if (diff < -8 || curY <= 24) {
        navEl.classList.remove('fk-nav-hidden');
      }
      this.lastScrollY = curY;
    }, { passive: true });

    document.addEventListener('click', (e) => {
      if (!navEl) return;
      const target = e.target;
      if (!target) return;
      if (target.closest('a, button, input, select, textarea, label, summary, details, nav.sticky, .novel-note-pill, .fk-bottom-sheet, #tocSidebar, #tocTriggerArea')) {
        return;
      }
      const sel = window.getSelection ? window.getSelection().toString() : '';
      if (sel && sel.length > 0) return;

      if (navEl.classList.contains('fk-nav-hidden')) {
        navEl.classList.remove('fk-nav-hidden');
      } else if ((window.scrollY || 0) > 56) {
        navEl.classList.add('fk-nav-hidden');
      }
    });
  },

  injectReaderToolbar() {
    const navInner = document.querySelector('nav.sticky > div');
    if (!navInner || document.getElementById('fkReaderToolbar')) return;

    navInner.classList.add('gap-1.5');
    // 모바일에서 긴 단원 제목이 줄바꿈을 유발하지 않도록 말줄임 처리
    const midSpan = navInner.querySelector('div > span.font-bold');
    if (midSpan) {
      midSpan.classList.add('hidden', 'md:inline', 'truncate');
    }
    const pipeSpan = navInner.querySelector('div > span.text-slate-600');
    if (pipeSpan) {
      pipeSpan.classList.add('hidden', 'md:inline');
    }

    const hasTocSidebar = !!document.getElementById('tocSidebar');
    const toolbar = document.createElement('div');
    toolbar.id = 'fkReaderToolbar';
    toolbar.className = 'flex items-center gap-1 shrink-0';

    // 상단바에는 오직 [목차]와 [설정] 버튼만 노출하고 나머지는 설정 시트 내부로 수납
    toolbar.innerHTML = `
      ${hasTocSidebar ? `<button onclick="HarnessEngine.openMobileTOC()" class="reader-ctrl-btn" title="단원 목차">☰ 목차</button>` : ''}
      <button onclick="HarnessEngine.openSettingsSheet()" class="reader-ctrl-btn" title="화면 및 여백 설정">⚙️ 설정</button>
    `;
    navInner.appendChild(toolbar);
  },

  injectBottomSheets() {
    if (document.getElementById('fkNoteBottomSheet')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'fkBackdrop';
    backdrop.className = 'fk-backdrop';
    backdrop.onclick = () => this.closeAllSheets();
    document.body.appendChild(backdrop);

    // 1. Sidenote Bottom Sheet (웹소설 주석 팝업 시트)
    const noteSheet = document.createElement('div');
    noteSheet.id = 'fkNoteBottomSheet';
    noteSheet.className = 'fk-bottom-sheet';
    noteSheet.innerHTML = `
      <div class="fk-sheet-handle"></div>
      <div class="flex items-center justify-between pb-2.5 mb-2.5 border-b" style="border-color:var(--border-line);">
        <div id="fkNoteSheetTitle" style="font-size:14px; font-weight:800; color:var(--accent);">
          💡 핵심 출제 포인트
        </div>
        <button onclick="HarnessEngine.closeAllSheets()" class="reader-ctrl-btn">✕</button>
      </div>
      <ul id="fkNoteSheetList" class="fk-sheet-list"></ul>
    `;
    document.body.appendChild(noteSheet);

    // 2. Reader Settings Bottom Sheet (모든 보기·서체·크기·좌우간격 설정 통합)
    const settingsSheet = document.createElement('div');
    settingsSheet.id = 'fkSettingsBottomSheet';
    settingsSheet.className = 'fk-bottom-sheet';
    settingsSheet.innerHTML = `
      <div class="fk-sheet-handle"></div>
      <div class="flex items-center justify-between pb-2.5 mb-3.5 border-b" style="border-color:var(--border-line);">
        <div style="font-size:14.5px; font-weight:800; color:var(--text-main);">
          ⚙️ 화면 · 글자 · 좌우 간격 설정
        </div>
        <button onclick="HarnessEngine.closeAllSheets()" class="reader-ctrl-btn">✕ 닫기</button>
      </div>
      <div class="space-y-3.5" style="font-size:13px;">
        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">배경 테마</span>
          <div class="flex items-center gap-1">
            <button onclick="HarnessEngine.setThemeMode('paper')" class="reader-ctrl-btn" style="padding:5px 10px !important;">☀️ 페이퍼</button>
            <button onclick="HarnessEngine.setThemeMode('sage')" class="reader-ctrl-btn" style="padding:5px 10px !important;">🍵 그린</button>
            <button onclick="HarnessEngine.setThemeMode('night')" class="reader-ctrl-btn" style="padding:5px 10px !important;">🌙 다크</button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">서체 · 정렬</span>
          <div class="flex items-center gap-1">
            <button id="fkFontBtn" onclick="HarnessEngine.toggleFontFamily()" class="reader-ctrl-btn" style="padding:5px 10px !important;">
              ${this.isSans ? '고딕' : '명조'}
            </button>
            <button id="fkAlignBtn" onclick="HarnessEngine.toggleTextAlign()" class="reader-ctrl-btn" style="padding:5px 10px !important;">
              ${this.isAlignLeft ? '좌측 정렬' : '양쪽 정렬'}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">글자 크기</span>
          <div class="flex items-center gap-1.5">
            <button onclick="HarnessEngine.adjustFontSize(-1)" class="reader-ctrl-btn" style="padding:5px 12px !important;">가 -</button>
            <span id="fkSizeIndicator" style="font-size:12px; font-weight:800; color:var(--accent); min-width:36px; text-align:center;">${this.bodySize}px</span>
            <button onclick="HarnessEngine.adjustFontSize(1)" class="reader-ctrl-btn" style="padding:5px 12px !important;">가 +</button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">좌우 간격(여백)</span>
          <div class="flex items-center gap-1.5">
            <button onclick="HarnessEngine.adjustSidePad(-4)" class="reader-ctrl-btn" style="padding:5px 9px !important;">좁게 -</button>
            <input id="fkPadSlider" type="range" min="0" max="64" step="2" value="${this.sidePad}" oninput="HarnessEngine.setSidePad(this.value)" style="width:90px; accent-color:var(--accent);" />
            <span id="fkPadIndicator" style="font-size:12px; font-weight:800; color:var(--accent); min-width:32px; text-align:center;">${this.sidePad}px</span>
            <button onclick="HarnessEngine.adjustSidePad(4)" class="reader-ctrl-btn" style="padding:5px 9px !important;">넓게 +</button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">줄간격</span>
          <div class="flex items-center gap-1">
            <button onclick="HarnessEngine.setLineHeight(1.8)" class="reader-ctrl-btn" style="padding:5px 10px !important;">조밀</button>
            <button onclick="HarnessEngine.setLineHeight(1.98)" class="reader-ctrl-btn" style="padding:5px 10px !important;">기본</button>
            <button onclick="HarnessEngine.setLineHeight(2.15)" class="reader-ctrl-btn" style="padding:5px 10px !important;">여유</button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">레이아웃 · 주석</span>
          <div class="flex items-center gap-1">
            <button id="fkNovelBtn" onclick="HarnessEngine.toggleNovelMode()" class="reader-ctrl-btn" style="padding:5px 10px !important;">
              ${this.isNovelMode ? '1단 꽉찬뷰 ON' : '1단 꽉찬뷰 OFF'}
            </button>
            <button id="fkNoteModeBtn" onclick="HarnessEngine.toggleNotesInline()" class="reader-ctrl-btn" style="padding:5px 10px !important;">
              ${this.isNotesInline ? '주석: 본문 펼침' : '주석: 캡슐 팝업'}
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(settingsSheet);

    // Close mobile TOC when clicking a TOC link
    const tocSidebar = document.getElementById('tocSidebar');
    if (tocSidebar) {
      tocSidebar.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => this.closeAllSheets());
      });
    }
  },

  openNoteSheet(noteIdx) {
    const data = this.sidenoteData[noteIdx];
    if (!data) return;
    const titleEl = document.getElementById('fkNoteSheetTitle');
    const listEl = document.getElementById('fkNoteSheetList');
    const sheet = document.getElementById('fkNoteBottomSheet');
    const backdrop = document.getElementById('fkBackdrop');
    if (!sheet || !listEl) return;

    if (titleEl) titleEl.innerHTML = `💡 ${data.title}`;
    listEl.innerHTML = data.itemsHtml;
    backdrop.classList.add('open');
    sheet.classList.add('open');
  },

  openSettingsSheet() {
    const sheet = document.getElementById('fkSettingsBottomSheet');
    const backdrop = document.getElementById('fkBackdrop');
    if (!sheet || !backdrop) return;
    backdrop.classList.add('open');
    sheet.classList.add('open');
  },

  openMobileTOC() {
    const sidebar = document.getElementById('tocSidebar');
    const backdrop = document.getElementById('fkBackdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.add('mobile-open');
    backdrop.classList.add('open');
  },

  closeAllSheets() {
    const backdrop = document.getElementById('fkBackdrop');
    const noteSheet = document.getElementById('fkNoteBottomSheet');
    const settingsSheet = document.getElementById('fkSettingsBottomSheet');
    const sidebar = document.getElementById('tocSidebar');
    if (backdrop) backdrop.classList.remove('open');
    if (noteSheet) noteSheet.classList.remove('open');
    if (settingsSheet) settingsSheet.classList.remove('open');
    if (sidebar) sidebar.classList.remove('mobile-open');
  },

  handleOxDeepLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromOx = params.get('from') === 'ox';
      const paraParam = params.get('para');
      const hlParam = params.get('hl') || '';
      if (!fromOx && paraParam === null && !hlParam) return;

      const paras = Array.from(document.querySelectorAll('main p.prose-body'));
      if (paras.length === 0) return;

      let targetPara = null;
      const pIdx = parseInt(paraParam, 10);
      if (!isNaN(pIdx) && pIdx >= 0 && pIdx < paras.length) {
        targetPara = paras[pIdx];
      }
      if (!targetPara && hlParam) {
        targetPara = paras.find((p) => p.textContent.includes(hlParam)) || paras[0];
      }
      if (!targetPara) return;

      if (hlParam && hlParam.length >= 2) {
        const safeHl = hlParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        targetPara.innerHTML = targetPara.innerHTML.replace(
          new RegExp(`(?![^<]*>)(${safeHl})`),
          '<mark style="background-color:rgba(139,38,53,0.18); color:var(--accent); font-weight:800; padding:1px 4px; border-radius:4px;">$1</mark>'
        );
      }

      targetPara.style.cssText += '; padding: 14px 16px; border-radius: 12px; border: 2px solid var(--accent); background-color: var(--accent-soft); transition: all 0.3s ease;';

      const qnumParam = params.get('qnum') || '';
      const qLabel = qnumParam ? `(${String(qnumParam).padStart(2, '0')}번) ` : '';
      const banner = document.createElement('div');
      banner.id = 'fkOxDeepLinkBanner';
      banner.style.cssText = 'position:fixed; bottom:18px; left:50%; transform:translateX(-50%); z-index:9999; display:flex; align-items:center; gap:8px; background:transparent; font-family:var(--font-sans) !important;';
      banner.innerHTML = `
        <a href="ox_app.html?v=6&resume=1" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:11px 20px; border-radius:999px; background-color:#8B2635; color:#FFFFFF; font-size:13px; font-weight:800; text-decoration:none; box-shadow:0 8px 24px rgba(0,0,0,0.45); border:1.5px solid rgba(255,255,255,0.22); white-space:nowrap;">
          🔙 풀던 OX 문제${qLabel}슬라이드로 즉시 복귀
        </a>
      `;
      document.body.appendChild(banner);

      setTimeout(() => {
        targetPara.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } catch (e) {}
  },

  initEditorialSidenotes() {
    const mainCol = document.querySelector('.main-column');
    if (!mainCol) return;

    const paragraphs = Array.from(mainCol.querySelectorAll('p.prose-body'));
    paragraphs.forEach((p) => {
      let wrapper = p.parentElement;
      if (!wrapper.classList.contains('para-block')) {
        wrapper = document.createElement('div');
        wrapper.className = 'para-block';
        p.parentNode.insertBefore(wrapper, p);
        wrapper.appendChild(p);
      }
    });

    this.buildNovelNotePills();
    setTimeout(() => this.preventSidenoteOverlap(), 80);
  },

  buildNovelNotePills() {
    const mainCol = document.querySelector('.main-column') || document.querySelector('main');
    if (!mainCol) return;
    mainCol.querySelectorAll('.novel-note-pill, .sidenote').forEach((el) => {
      el.style.display = 'none';
    });
    this.sidenoteData = [];
  },

  preventSidenoteOverlap() {
    const notes = Array.from(document.querySelectorAll('.main-column .sidenote'));
    if (window.innerWidth < 1120 || this.isNovelMode) {
      notes.forEach((n) => { n.style.top = ''; });
      return;
    }

    let lastBottom = -Infinity;
    notes.forEach((n) => {
      if (n.offsetParent === null) return;
      n.style.top = '2px';
      const rect = n.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const absTop = rect.top + scrollY;

      if (absTop < lastBottom + 14) {
        const shift = (lastBottom + 14) - absTop;
        n.style.top = (2 + shift) + 'px';
      }

      const newRect = n.getBoundingClientRect();
      lastBottom = newRect.bottom + scrollY;
    });
  },

  initProgressBar() {
    window.addEventListener('scroll', () => {
      const progressBar = document.getElementById('readingProgressBar');
      if (!progressBar) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight > 0) {
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
      }
    });
  },

  togglePinTOC() {
    const sidebar = document.getElementById('tocSidebar');
    const pinBtn = document.getElementById('pinBtn');
    if (!sidebar || !pinBtn) return;

    this.isPinned = !this.isPinned;
    if (this.isPinned) {
      sidebar.classList.add('pinned');
      pinBtn.textContent = '고정 해제';
    } else {
      sidebar.classList.remove('pinned');
      pinBtn.textContent = '목차 고정';
    }
  },

  renderStats(stats) {
    this.renderUnitStats('statsContainer', stats);
  },

  renderOrigQuestions(questions) {
    this.renderOriginalQuestions('origQuestions', questions);
  },

  renderUnitStats(containerId, stats) {
    if (typeof containerId === 'object' && containerId !== null && !stats) {
      stats = containerId;
      containerId = 'statsContainer';
    }
    const container = document.getElementById(containerId);
    if (!container || !stats) return;

    let rowsHtml = '';
    (stats.themes || []).forEach((t) => {
      rowsHtml += `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-main);">${t.name}</div>
          </td>
          <td style="white-space:nowrap; font-weight:700; color:var(--accent);">
            ${t.qCount}문항 <span style="font-size:0.88em; font-weight:400; color:var(--text-muted);">(${t.examCount}회)</span>
          </td>
          <td>${t.years}</td>
          <td>${t.summary}</td>
        </tr>
      `;
    });

    const topTheme = (stats.themes && stats.themes[0]) ? stats.themes[0].name : '전 영역 고른 출제';

    container.innerHTML = `
      <div class="para-block">
        <div class="mb-3">
          <h3 class="book-h3 mt-1" style="font-size:1.2rem; font-weight:700;">출제 경향 및 핵심 쟁점 요약</h3>
        </div>

        <div class="table-scroll-wrap">
          <table class="book-table">
            <thead>
              <tr>
                <th style="width:28%;">주제 및 쟁점</th>
                <th style="width:16%;">출제 문항</th>
                <th style="width:22%;">기출 연도</th>
                <th>주요 출제 포인트</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <aside class="sidenote">
          <div class="sidenote-box">
            <div class="sidenote-title">단원 출제 요약</div>
            <ul class="sidenote-list">
              <li><strong>기출 문항</strong>: ${stats.totalUniqueQs}문항</li>
              <li><strong>확인 지문</strong>: OX ${stats.totalOx}문항</li>
              <li><strong>최다 출제</strong>: ${topTheme}</li>
            </ul>
          </div>
        </aside>
      </div>
    `;

    this.buildNovelNotePills();
    setTimeout(() => this.preventSidenoteOverlap(), 60);
  },

  toggleOrigQuestion(qId) {
    const expEl = document.getElementById(`orig-exp-${qId}`);
    const btnEl = document.getElementById(`orig-btn-${qId}`);
    const noteBodyEl = document.getElementById(`orig-note-ans-${qId}`);
    if (!expEl) return;

    const isOpen = expEl.classList.contains('open');
    if (isOpen) {
      expEl.classList.remove('open');
      if (btnEl) btnEl.innerHTML = `정답 및 해설 보기 &darr;`;
    } else {
      expEl.classList.add('open');
      if (btnEl) btnEl.innerHTML = `해설 접기 &uarr;`;
      if (noteBodyEl) noteBodyEl.classList.remove('hidden');
    }
    setTimeout(() => this.preventSidenoteOverlap(), 350);
  },

  toggleAllOrigQuestions(containerId, openAll) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const expEls = container.querySelectorAll('.orig-explanation');
    expEls.forEach((el) => {
      const qId = el.id.replace('orig-exp-', '');
      const btnEl = document.getElementById(`orig-btn-${qId}`);
      const noteBodyEl = document.getElementById(`orig-note-ans-${qId}`);
      if (openAll) {
        el.classList.add('open');
        if (btnEl) btnEl.innerHTML = `해설 접기 &uarr;`;
        if (noteBodyEl) noteBodyEl.classList.remove('hidden');
      } else {
        el.classList.remove('open');
        if (btnEl) btnEl.innerHTML = `정답 및 해설 보기 &darr;`;
      }
    });
    setTimeout(() => this.preventSidenoteOverlap(), 350);
  },

  selectOrigChoice(qId, choiceIdx, ansIdx) {
    const feedbackEl = document.getElementById(`orig-feedback-${qId}`);
    const expEl = document.getElementById(`orig-exp-${qId}`);
    const btnEl = document.getElementById(`orig-btn-${qId}`);
    const noteBodyEl = document.getElementById(`orig-note-ans-${qId}`);
    const circNums = ['', '①', '②', '③', '④'];

    for (let i = 1; i <= 4; i++) {
      const cBtn = document.getElementById(`orig-choice-${qId}-${i}`);
      if (!cBtn) continue;
      if (i === ansIdx) {
        cBtn.style.borderColor = 'var(--correct-border)';
        cBtn.style.backgroundColor = 'var(--correct-bg)';
        cBtn.style.fontWeight = '700';
      } else if (i === choiceIdx && choiceIdx !== ansIdx) {
        cBtn.style.borderColor = 'var(--wrong-border)';
        cBtn.style.backgroundColor = 'var(--wrong-bg)';
      } else {
        cBtn.style.borderColor = 'var(--border-line)';
        cBtn.style.backgroundColor = 'var(--bg-sheet)';
        cBtn.style.fontWeight = '400';
      }
    }

    if (feedbackEl) {
      feedbackEl.classList.remove('hidden');
      if (choiceIdx === ansIdx) {
        feedbackEl.style.cssText = 'background:var(--correct-bg); color:var(--correct-ink); border:1px solid var(--correct-border); padding:8px 12px; border-radius:4px; font-size:13px; font-weight:700; margin:10px 0;';
        feedbackEl.innerHTML = `✓ 정답입니다 · 정답: ${circNums[ansIdx]}번`;
      } else {
        feedbackEl.style.cssText = 'background:var(--wrong-bg); color:var(--wrong-ink); border:1px solid var(--wrong-border); padding:8px 12px; border-radius:4px; font-size:13px; font-weight:700; margin:10px 0;';
        feedbackEl.innerHTML = `✗ 오답입니다 (선택: ${circNums[choiceIdx]}번) · 정답: ${circNums[ansIdx]}번`;
      }
    }

    if (noteBodyEl) {
      noteBodyEl.classList.remove('hidden');
    }

    if (expEl && !expEl.classList.contains('open')) {
      expEl.classList.add('open');
      if (btnEl) btnEl.innerHTML = `해설 접기 &uarr;`;
    }
    setTimeout(() => this.preventSidenoteOverlap(), 350);
  },

  renderOriginalQuestions(containerId, questions) {
    if (Array.isArray(containerId) && !questions) {
      questions = containerId;
      containerId = 'origQuestions';
    }
    const container = document.getElementById(containerId);
    if (!container || !questions) return;

    const circNums = ['①', '②', '③', '④'];
    let html = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3 border-b" style="border-color:var(--border-line);">
        <div style="font-size:12.5px; color:var(--text-sub);">
          선택지(①부터 ④까지)를 누르면 정답 확인과 함께 선택지별 해설이 펼쳐집니다.
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="HarnessEngine.toggleAllOrigQuestions('${containerId}', true)" class="reader-ctrl-btn">
            해설 모두 펼치기
          </button>
          <button onclick="HarnessEngine.toggleAllOrigQuestions('${containerId}', false)" class="reader-ctrl-btn">
            해설 모두 접기
          </button>
        </div>
      </div>
      <div class="space-y-6">
    `;

    questions.forEach((q, idx) => {
      const qId = q.id || `Q_${idx + 1}`;
      let choicesHtml = '';
      (q.choices || []).forEach((cText, cIdx) => {
        const num = cIdx + 1;
        choicesHtml += `
          <button id="orig-choice-${qId}-${num}" onclick="HarnessEngine.selectOrigChoice('${qId}', ${num}, ${q.ans})"
            class="w-full text-left px-3.5 py-2.5 rounded border transition flex items-start gap-2.5"
            style="background-color:var(--bg-sheet); border-color:var(--border-line); color:var(--text-main);">
            <span style="font-weight:700; color:var(--accent); flex-shrink:0;">${circNums[cIdx]}</span>
            <span class="book-p" style="font-size:calc(var(--body-size, 17px) - 0.5px) !important; line-height:1.72 !important; margin:0 !important;">${cText || '(도식 선택지 — 아래 해설 참조)'}</span>
          </button>
        `;
      });

      const stemBoxHtml = q.stem_box
        ? `<div class="mb-3.5 p-3.5 rounded border-l-2 leading-relaxed book-p" style="background-color:var(--bg-sheet); border-color:var(--accent); color:var(--text-sub); font-size:calc(var(--body-size, 17px) - 1px) !important;">${q.stem_box}</div>`
        : '';

      let choiceExplsHtml = '';
      (q.c_expls || []).forEach((ceText, cIdx) => {
        const num = cIdx + 1;
        const isAns = (num === q.ans);
        const boxBg = isAns ? 'var(--correct-bg)' : 'var(--bg-sheet)';
        const boxBorder = isAns ? 'var(--correct-border)' : 'var(--border-line)';
        const badgeText = isAns ? `선택지 ${circNums[cIdx]} · 정답` : `선택지 ${circNums[cIdx]}`;
        const badgeColor = isAns ? 'var(--correct-ink)' : 'var(--accent)';

        choiceExplsHtml += `
          <div class="p-3 rounded border flex flex-col gap-1" style="background-color:${boxBg}; border-color:${boxBorder};">
            <div class="flex items-center gap-2 flex-wrap">
              <span style="font-size:11.5px; font-weight:700; color:${badgeColor};">${badgeText}</span>
              <span style="font-size:12px; color:var(--text-muted);">${(q.choices && q.choices[cIdx]) ? q.choices[cIdx] : ''}</span>
            </div>
            <p class="book-p" style="font-size:calc(var(--body-size, 17px) - 1px) !important; color:var(--text-main); line-height:1.75 !important; margin:2px 0 0 0 !important;">
              ${ceText}
            </p>
          </div>
        `;
      });

      html += `
        <div class="para-block" id="orig-card-${qId}">
          <div class="p-5 rounded border" style="background-color:var(--bg-subtle); border-color:var(--border-line);">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b" style="border-color:var(--border-line);">
              <div class="flex items-center gap-2 flex-wrap">
                <span style="font-size:12px; font-weight:700; color:var(--accent);">
                  문항 ${String(idx + 1).padStart(2, '0')} · ${q.source}
                </span>
                <span style="font-size:11.5px; color:var(--text-muted);">
                  · ${q.topic}
                </span>
              </div>
              <button id="orig-btn-${qId}" onclick="HarnessEngine.toggleOrigQuestion('${qId}')" class="reader-ctrl-btn">
                정답 및 해설 보기 &darr;
              </button>
            </div>

            <p class="book-p font-semibold mb-3.5" style="font-size:var(--body-size, 17px) !important; line-height:1.82 !important;">
              ${q.stem}
            </p>

            ${stemBoxHtml}

            <div class="grid grid-cols-1 gap-1.5 mb-2">
              ${choicesHtml}
            </div>

            <div id="orig-feedback-${qId}" class="hidden"></div>

            <div id="orig-exp-${qId}" class="orig-explanation">
              <div class="mt-3.5 pt-3.5 border-t" style="border-color:var(--border-line);">
                <div class="flex items-center gap-2 mb-2.5">
                  <span style="font-size:12px; font-weight:700; color:var(--accent); background:var(--accent-soft); padding:2px 8px; border-radius:3px;">
                    정답: ${circNums[q.ans - 1]}번
                  </span>
                  <span style="font-size:12px; font-weight:600; color:var(--text-sub);">
                    주제: ${q.freq_key || q.topic}
                  </span>
                </div>

                <div class="mb-3 p-3 rounded border-l-2 book-p" style="background-color:var(--bg-sheet); border-color:var(--accent); font-size:calc(var(--body-size, 17px) - 0.5px) !important; color:var(--text-main); line-height:1.78 !important;">
                  <strong style="color:var(--accent); display:block; margin-bottom:2px;">[핵심 해설]</strong>
                  ${q.q_expl}
                </div>

                <div class="space-y-2">
                  <div style="font-size:11.5px; font-weight:700; color:var(--accent);">
                    [선택지별 근거]
                  </div>
                  ${choiceExplsHtml}
                </div>
              </div>
            </div>
          </div>

          <aside class="sidenote">
            <div class="sidenote-box">
              <div class="sidenote-title"><span>[문항 ${String(idx + 1).padStart(2, '0')}]</span> 출제 포인트</div>
              <ul class="sidenote-list">
                <li><strong>기출</strong>: ${q.source}</li>
                <li><strong>주제</strong>: ${q.topic}</li>
              </ul>
              <div id="orig-note-ans-${qId}" class="hidden mt-2 pt-2 border-t" style="border-color:var(--border-line);">
                <div style="font-weight:700; color:var(--accent);">✓ 정답: ${circNums[q.ans - 1]}번</div>
              </div>
            </div>
          </aside>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
    this.buildNovelNotePills();
    setTimeout(() => this.preventSidenoteOverlap(), 80);
  },

  toggleExplanation(id) {
    const explanationEl = document.getElementById(`explanation-${id}`);
    const toggleBtn = document.getElementById(`toggle-btn-${id}`);
    if (!explanationEl) return;

    const isOpen = explanationEl.classList.contains('open');
    if (isOpen) {
      explanationEl.classList.remove('open');
      if (toggleBtn) toggleBtn.innerHTML = `해설 열기 &darr;`;
    } else {
      explanationEl.classList.add('open');
      if (toggleBtn) toggleBtn.innerHTML = `해설 닫기 &uarr;`;
    }
  },

  submitAnswer(id, userChoice, isCorrectAnswer) {
    const feedbackBadge = document.getElementById(`feedback-${id}`);
    const explanationEl = document.getElementById(`explanation-${id}`);
    const toggleBtn = document.getElementById(`toggle-btn-${id}`);
    const isUserRight = (userChoice === isCorrectAnswer);

    if (feedbackBadge) {
      feedbackBadge.classList.remove('hidden');
      if (isUserRight) {
        feedbackBadge.style.cssText = 'background:var(--correct-bg); color:var(--correct-ink); border:1px solid var(--correct-border); padding:6px 11px; border-radius:4px; font-size:12.5px; font-weight:700; display:inline-block;';
        feedbackBadge.innerHTML = `✓ 정답입니다 [ ${isCorrectAnswer ? 'O' : 'X'} ]`;
      } else {
        feedbackBadge.style.cssText = 'background:var(--wrong-bg); color:var(--wrong-ink); border:1px solid var(--wrong-border); padding:6px 11px; border-radius:4px; font-size:12.5px; font-weight:700; display:inline-block;';
        feedbackBadge.innerHTML = `✗ 오답입니다 · 정답은 [ ${isCorrectAnswer ? 'O' : 'X'} ]`;
      }
    }

    if (explanationEl && !explanationEl.classList.contains('open')) {
      explanationEl.classList.add('open');
      if (toggleBtn) toggleBtn.innerHTML = `해설 닫기 &uarr;`;
    }
  },

  toggleSubjBlank(el) {
    if (!el) return;
    el.classList.toggle('open');
  },

  toggleSubjCardAns(cardId) {
    const card = document.getElementById(`subj-card-${cardId}`);
    if (!card) return;
    const blanks = card.querySelectorAll('.subj-blank');
    const ansBox = document.getElementById(`subj-ansbox-${cardId}`);
    const btn = document.getElementById(`subj-btn-${cardId}`);
    const anyClosed = Array.from(blanks).some((b) => !b.classList.contains('open'));
    blanks.forEach((b) => b.classList.toggle('open', anyClosed));
    if (ansBox) ansBox.classList.toggle('hidden', !anyClosed);
    if (btn) btn.innerHTML = anyClosed ? '빈칸 가리기 &uarr;' : '정답·해설 확인 &darr;';
  },

  toggleAllSubjBlanks(containerId, open) {
    const wrap = document.getElementById(`subj-wrap-${containerId}`);
    if (!wrap) return;
    wrap.querySelectorAll('.subj-blank').forEach((b) => b.classList.toggle('open', open));
    wrap.querySelectorAll('.subj-ansbox').forEach((box) => box.classList.toggle('hidden', !open));
    wrap.querySelectorAll('[data-subj-btn="1"]').forEach((btn) => {
      btn.innerHTML = open ? '빈칸 가리기 &uarr;' : '정답·해설 확인 &darr;';
    });
  },

  toggleSubjSection(containerId) {
    const listEl = document.getElementById(`subj-list-${containerId}`);
    const btn = document.getElementById(`subj-sec-btn-${containerId}`);
    if (!listEl) return;
    const isHidden = listEl.classList.toggle('hidden');
    if (btn) btn.innerHTML = isHidden ? '주관식 목록 펼치기 &darr;' : '주관식 목록 접기 &uarr;';
  },

  buildSubjSectionHtml(containerId, subjItems) {
    if (!Array.isArray(subjItems) || subjItems.length === 0) return '';
    let cardsHtml = '';
    subjItems.forEach((s, idx) => {
      const badgeBg = s.type === 'formula' ? 'var(--accent)' : 'var(--navy-ink, #1E3A5F)';
      cardsHtml += `
        <div class="subj-card" id="subj-card-${s.id}">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span style="font-size:11.5px; font-weight:800; color:var(--text-main);">
                주관식 ${String(idx + 1).padStart(2, '0')}
              </span>
              <span style="font-size:11px; font-weight:800; color:#fff; background:${badgeBg}; padding:1px 7px; border-radius:3px;">
                ${s.badge || '핵심 공식·수치'}
              </span>
              <span style="font-size:12.5px; font-weight:800; color:var(--accent);">
                ${s.title}
              </span>
            </div>
            <button id="subj-btn-${s.id}" data-subj-btn="1" onclick="HarnessEngine.toggleSubjCardAns('${s.id}')" class="reader-ctrl-btn">
              정답·해설 확인 &darr;
            </button>
          </div>
          ${s.promptHtml}
          <div id="subj-ansbox-${s.id}" class="subj-ansbox hidden mt-2.5 p-3 rounded border-l-2" style="background-color:var(--bg-sheet); border-color:var(--correct-border, #8CBE9B); font-size:calc(var(--body-size, 17px) - 1px) !important;">
            <div style="font-weight:800; color:var(--correct-ink, #164E28); margin-bottom:2px;">
              ✓ 핵심 정답: ${s.answerEq}
            </div>
            ${s.fullFormula ? `<div style="font-weight:700; color:var(--accent); margin-bottom:2px;">[전체 공식·서열] ${s.fullFormula}</div>` : ''}
            <div style="color:var(--text-sub); line-height:1.68;">
              ${s.explanation}
            </div>
          </div>
        </div>
      `;
    });

    return `
      <div class="subj-section-wrap" id="subj-wrap-${containerId}">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b" style="border-color:var(--border-line);">
          <div>
            <div class="inline-flex items-center gap-1.5 text-xs font-extrabold px-2 py-0.5 rounded mb-1" style="background-color:var(--navy-soft, rgba(30,58,95,0.08)); color:var(--navy-ink, #1E3A5F);">
              ✍️ STEP 1 · 필수 공식 · 산정식 · 핵심 수치 주관식 빈칸 인출 (${subjItems.length}문항)
            </div>
            <div class="text-xs" style="color:var(--text-sub);">
              점선 빈칸(<strong>[ 빈칸 · 정답 확인 ]</strong>)을 터치하면 개별 정답이 토글되며, 인쇄 시 자동으로 서술형 괄호(<strong>[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</strong>)로 변환됩니다.
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button onclick="HarnessEngine.toggleAllSubjBlanks('${containerId}', true)" class="reader-ctrl-btn" style="border-color:var(--accent); color:var(--accent); font-weight:800;">
              전체 빈칸 정답 펼치기
            </button>
            <button onclick="HarnessEngine.toggleAllSubjBlanks('${containerId}', false)" class="reader-ctrl-btn">
              전체 빈칸 가리기
            </button>
            <button id="subj-sec-btn-${containerId}" onclick="HarnessEngine.toggleSubjSection('${containerId}')" class="reader-ctrl-btn">
              주관식 목록 접기 &uarr;
            </button>
          </div>
        </div>
        <div id="subj-list-${containerId}">
          ${cardsHtml}
        </div>
      </div>
    `;
  },

  filterInlineOx(containerId, tierFilter) {
    const cards = document.querySelectorAll(`#${containerId} .ox-card`);
    cards.forEach((el) => {
      const t = el.getAttribute('data-tier') || 'core';
      const isEss = el.getAttribute('data-essential') === '1';
      const match =
        tierFilter === 'all' ||
        (tierFilter === 'essential' && isEss) ||
        t === tierFilter ||
        (tierFilter === 'core' && (t === 'core' || t === 'ext'));
      el.style.display = match ? '' : 'none';
    });
    const btns = document.querySelectorAll(`[data-ox-flt-btn="${containerId}"]`);
    btns.forEach((b) => {
      const active = b.getAttribute('data-tier-val') === tierFilter;
      b.style.borderColor = active ? 'var(--accent)' : 'var(--border-line)';
      b.style.color = active ? 'var(--accent)' : 'var(--text-main)';
      b.style.fontWeight = active ? '800' : '600';
    });
  },

  toggleAllInlineOx(containerId, expand) {
    const cards = document.querySelectorAll(`#${containerId} .ox-card`);
    cards.forEach((el) => {
      if (el.style.display === 'none') return;
      const exp = el.querySelector('.ox-explanation');
      const btn = el.querySelector('[data-ox-toggle-btn="1"]');
      if (!exp) return;
      if (expand) {
        exp.classList.add('open');
        if (btn) btn.innerHTML = '해설 닫기 &uarr;';
      } else {
        exp.classList.remove('open');
        if (btn) btn.innerHTML = '해설 열기 &darr;';
      }
    });
  },

  renderQuizList(containerId, items) {
    if (Array.isArray(containerId) && !items) {
      items = containerId;
      containerId = 'quizList';
    }
    const container = document.getElementById(containerId);
    if (!container || !items) return;

    const OX_UNIT_COUNTS = {"intro": {"01_01": 92, "01_02": 49, "01_03": 49, "02_01": 67, "02_02": 49, "02_03": 56, "02_04": 77, "02_05": 70, "03_01": 63, "03_02": 50, "03_03": 63, "04_01": 42, "04_02": 39, "04_03": 40, "05_01": 39, "05_02": 48, "05_03": 52}, "law": {"01_01": 60, "01_02": 50, "01_03": 52, "01_04": 53, "01_05": 54, "01_06": 53, "02_01": 54, "02_02": 52, "02_03": 58, "02_04": 51, "03_01": 51, "03_02": 57, "03_03": 42, "03_04": 47, "03_05": 50, "03_06": 52, "03_07": 47, "04_01": 52, "04_02": 62, "04_03": 44}, "his": {"01_01": 50, "01_02": 50, "01_03": 50, "02_01": 50, "02_02": 50, "02_03": 50, "03_01": 50, "03_02": 50, "03_03": 50, "04_01": 50, "04_02": 50, "04_03": 50, "05_01": 50, "05_02": 50, "05_03": 50, "06_01": 50, "06_02": 50, "06_03": 50, "07_01": 50, "07_02": 50, "07_03": 50}};
    const isOxAppSubject = items.length > 0 && items[0].id && (items[0].id.startsWith('LAW_') || items[0].id.startsWith('EXT_LAW') || items[0].id.startsWith('PRED_LAW') || items[0].id.startsWith('SCI') || items[0].id.startsWith('PRED_SCI') || items[0].id.startsWith('HIS') || /^\d+-\d+-/.test(items[0].id));
    let ctaBannerHtml = '';

    const essCount = items.filter((x) => x.isEssential !== false).length;
    const hasEssSubset = essCount > 0 && essCount < items.length;
    const defaultFilter = hasEssSubset ? 'essential' : 'all';
    const subjItems = Array.isArray(window.SUBJ_DATA) ? window.SUBJ_DATA : [];
    const subjHtml = this.buildSubjSectionHtml(containerId, subjItems);

    if (isOxAppSubject) {
      const firstId = String(items[0].id || '');
      const decPath = decodeURIComponent(window.location.pathname || '');
      const subjKey = (firstId.startsWith('SCI') || firstId.startsWith('PRED_SCI') || decPath.includes('소방학개론'))
        ? 'intro'
        : ((firstId.startsWith('HIS') || /^\d+-\d+-/.test(firstId) || decPath.includes('한국사')) ? 'his' : 'law');
      const mPath = window.location.pathname.match(/(\d{2}_\d{2})/);
      const mCid = containerId.match(/(\d+)_(\d+)/);
      const unitId = mPath ? mPath[1] : (mCid ? `${String(mCid[1]).padStart(2, '0')}_${String(mCid[2]).padStart(2, '0')}` : 'all');
      const totalUnitOx = (OX_UNIT_COUNTS[subjKey] && OX_UNIT_COUNTS[subjKey][unitId]) ? OX_UNIT_COUNTS[subjKey][unitId] : items.length;
      const subjBadge = subjKey === 'his'
        ? `기출 20 + 사료 추론 10 + 최신기출·적중 20 · 총 ${totalUnitOx}문항`
        : `주관식 ${subjItems.length}제 + 핵심 정예 OX ${essCount}제 (전체 풀 ${totalUnitOx}제 보존)`;

      const quizSec = document.getElementById('quizSection') || document.getElementById('oxQuizSection') || container.closest('section');
      if (quizSec && !quizSec.id) quizSec.id = 'quizSection';
      const tocQuizLink = document.querySelector('#tocSidebar a[href="#quizSection"], #tocSidebar a[href="#oxQuizSection"]');
      if (tocQuizLink) {
        tocQuizLink.textContent = `🔥 공식 주관식(${subjItems.length}제) & 정예 OX(${essCount}제)`;
      }

      const tocSidebar = document.getElementById('tocSidebar');
      if (tocSidebar && !document.getElementById('fkTocOxQuickBox')) {
        const quickBox = document.createElement('div');
        quickBox.id = 'fkTocOxQuickBox';
        quickBox.className = 'mt-4 pt-3 border-t space-y-2';
        quickBox.style.borderColor = 'var(--border-line)';
        quickBox.innerHTML = `
          <a href="ox_app.html?v=6&unit=${unitId}" class="block w-full py-2 px-3 rounded-lg text-center text-xs font-extrabold text-white transition" style="background-color:var(--accent); text-decoration:none;">
            ⚡ 이 단원 OX 타격 (정예 ${essCount} / 전체 ${totalUnitOx}) &rarr;
          </a>
          <div class="flex items-center justify-between gap-2 text-[11px] font-bold pt-1">
            <a href="index.html" style="color:var(--text-sub); text-decoration:none;">&larr; 과목 전체 목차</a>
            <a href="../index.html" style="color:var(--accent); text-decoration:none;">🏠 3과목 통합 포털</a>
          </div>
        `;
        const navInToc = tocSidebar.querySelector('nav');
        if (navInToc) {
          navInToc.appendChild(quickBox);
        }
      }

      ctaBannerHtml = `
        <div class="p-5 sm:p-6 mb-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4" style="background-color:var(--bg-subtle); border-color:var(--border-strong);">
          <div class="space-y-1">
            <div class="inline-flex items-center gap-1.5 text-xs font-extrabold px-2 py-0.5 rounded" style="background-color:var(--accent-soft); color:var(--accent);">
              🔥 단원 정독 완료 · 주관식 공식 인출 &amp; 핵심 정예 OX (${subjBadge})
            </div>
            <h3 class="text-lg font-extrabold" style="color:var(--text-main); margin:4px 0 0 0 !important;">
              필수 공식·수치 주관식(${subjItems.length}제)과 중복 압축 정예 OX(${essCount}제)로 핵심을 즉시 점검하세요
            </h3>
            <p class="text-xs" style="color:var(--text-sub); margin:0 !important;">
              동일 개념 중복 지문을 1개로 압축한 <strong>핵심 정예(${essCount}제)</strong>가 기본 노출되며, <strong>전체 풀(${items.length}제)</strong> 탭이나 전용 OX 앱(${totalUnitOx}제)에서 전 문항을 빠짐없이 풀 수 있습니다.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <a href="ox_app.html?v=6&unit=${unitId}" class="px-4 py-2.5 rounded-xl font-extrabold text-xs text-white transition" style="background-color:var(--accent); text-decoration:none;">
              ⚡ 전용 OX 앱 실행 (${totalUnitOx}제) &rarr;
            </a>
            <a href="ox_app.html?v=6&sort=shuffle" class="px-3.5 py-2.5 rounded-xl font-bold text-xs border transition" style="background-color:var(--bg-sheet); border-color:var(--border-line); color:var(--text-main); text-decoration:none;">
              🎲 전 단원 랜덤
            </a>
          </div>
        </div>
      `;
    }

    const coreCount = items.filter((x) => (x.tier || 'core') !== 'pred' && !String(x.id || '').startsWith('PRED_')).length;
    const predCount = items.filter((x) => x.tier === 'pred' || String(x.id || '').startsWith('PRED_')).length;
    const filterBarHtml = `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b" style="border-color:var(--border-line);">
        <div class="flex flex-wrap items-center gap-1.5">
          ${hasEssSubset ? `<button data-ox-flt-btn="${containerId}" data-tier-val="essential" onclick="HarnessEngine.filterInlineOx('${containerId}', 'essential')" class="reader-ctrl-btn" style="border-color:var(--accent); color:var(--accent); font-weight:800;">🔥 핵심 정예 (${essCount} · 중복압축)</button>` : ''}
          <button data-ox-flt-btn="${containerId}" data-tier-val="all" onclick="HarnessEngine.filterInlineOx('${containerId}', 'all')" class="reader-ctrl-btn" ${!hasEssSubset ? 'style="border-color:var(--accent); color:var(--accent); font-weight:800;"' : ''}>
            전체 풀 (${items.length})
          </button>
          ${coreCount > 0 ? `<button data-ox-flt-btn="${containerId}" data-tier-val="core" onclick="HarnessEngine.filterInlineOx('${containerId}', 'core')" class="reader-ctrl-btn">1회독 기출·확장 (${coreCount})</button>` : ''}
          ${predCount > 0 ? `<button data-ox-flt-btn="${containerId}" data-tier-val="pred" onclick="HarnessEngine.filterInlineOx('${containerId}', 'pred')" class="reader-ctrl-btn">🎯 2회독 주변확장 (${predCount})</button>` : ''}
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="HarnessEngine.toggleAllInlineOx('${containerId}', true)" class="reader-ctrl-btn">해설 모두 펼치기</button>
          <button onclick="HarnessEngine.toggleAllInlineOx('${containerId}', false)" class="reader-ctrl-btn">해설 모두 접기</button>
        </div>
      </div>
    `;

    let html = ctaBannerHtml + subjHtml + filterBarHtml;
    items.forEach((item, idx) => {
      const isO = item.isCorrect;
      const rawId = String(item.id || '');
      const tier = item.tier || (rawId.startsWith('PRED_') ? 'pred' : (rawId.startsWith('EXT_') ? 'ext' : 'core'));
      const isEss = item.isEssential !== false;
      const hideInit = (defaultFilter === 'essential' && !isEss) ? 'style="display:none;"' : '';
      const essPill = isEss
        ? `<span style="font-size:10.5px; font-weight:800; color:var(--accent); border:1px solid var(--accent); padding:0px 5px; border-radius:3px;">★정예</span>`
        : '';
      const tierPill = tier === 'pred'
        ? `<span style="font-size:11px; font-weight:800; color:#fff; background:var(--accent); padding:1px 7px; border-radius:3px;">🎯 2회독 확장</span>`
        : (tier === 'ext'
          ? `<span style="font-size:11px; font-weight:700; color:var(--accent); background:var(--accent-soft); padding:1px 7px; border-radius:3px;">1회독 기출확장</span>`
          : `<span style="font-size:11px; font-weight:700; color:var(--accent); background:var(--accent-soft); padding:1px 7px; border-radius:3px;">1회독 기출</span>`);
      const correctBadge = isO
        ? `<span style="font-size:11.5px; font-weight:700; color:var(--correct-ink);">[ O ] 옳은 지문</span>`
        : `<span style="font-size:11.5px; font-weight:700; color:var(--wrong-ink);">[ X ] 그른 지문</span>`;

      const origLinkBtn = item.origQId
        ? `<a href="#orig-card-${item.origQId}" class="reader-ctrl-btn" style="text-decoration:none;">관련 기출문항 &uarr;</a>`
        : '';

      html += `
        <div class="ox-card" id="ox-item-${item.id}" data-tier="${tier}" data-essential="${isEss ? '1' : '0'}" ${hideInit}>
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-main);">
                지문 ${String(idx + 1).padStart(2, '0')}
              </span>
              ${essPill}
              ${tierPill}
              ${item.source ? `<span style="font-size:11.5px; color:var(--text-muted);">${item.source}</span>` : ''}
              ${origLinkBtn}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="HarnessEngine.submitAnswer('${item.id}', true, ${isO})" class="reader-ctrl-btn" style="padding:5px 12px !important;">O</button>
              <button onclick="HarnessEngine.submitAnswer('${item.id}', false, ${isO})" class="reader-ctrl-btn" style="padding:5px 12px !important;">X</button>
              <button id="toggle-btn-${item.id}" data-ox-toggle-btn="1" onclick="HarnessEngine.toggleExplanation('${item.id}')" class="reader-ctrl-btn">해설 열기 &darr;</button>
            </div>
          </div>

          <p class="book-p" style="font-size:var(--body-size, 17px) !important; line-height:1.82 !important; margin-bottom:0.4rem !important;">
            ${item.text}
          </p>

          <div id="feedback-${item.id}" class="hidden my-2"></div>

          <div id="explanation-${item.id}" class="ox-explanation">
            <div class="p-3.5 my-2 rounded border-l-2 book-p" style="background-color:var(--bg-subtle); border-color:var(--accent); font-size:calc(var(--body-size, 17px) - 0.5px) !important; color:var(--text-main); line-height:1.78 !important;">
              <div class="flex items-center gap-2 mb-1.5">
                <span style="font-weight:700;">판정:</span>
                ${correctBadge}
              </div>
              <p style="margin:0; color:var(--text-sub);">
                <strong style="color:var(--text-main);">해설:</strong> ${item.explanation}
              </p>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  HarnessEngine.init();
});
