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
  sidenoteData: [],

  init() {
    this.cleanLegacyInlineFontLock();
    this.loadReaderPrefs();
    this.setupMainColumnGrid();
    this.wrapTablesForMobile();
    this.injectReaderToolbar();
    this.injectBottomSheets();
    this.initProgressBar();
    this.initEditorialSidenotes();

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
      html body main .diagram-container > div:first-child span,
      html body main .diagram-container figcaption,
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
      this.isAlignLeft ? 'left' : 'justify'
    );
    document.documentElement.style.setProperty('--body-size', this.bodySize + 'px');
    document.documentElement.style.setProperty('--line-height', String(this.lineHeight));
    this.enforceFontGuard();

    const nightBtn = document.getElementById('fkNightBtn');
    const fontBtn = document.getElementById('fkFontBtn');
    const alignBtn = document.getElementById('fkAlignBtn');
    const novelBtn = document.getElementById('fkNovelBtn');
    const sizeIndicator = document.getElementById('fkSizeIndicator');
    const noteModeBtn = document.getElementById('fkNoteModeBtn');

    const themeLabels = { paper: '☀️ 페이퍼', sage: '🍵 그린', night: '🌙 다크' };
    if (nightBtn) nightBtn.textContent = themeLabels[this.themeMode] || '☀️ 페이퍼';
    if (fontBtn) fontBtn.textContent = this.isSans ? '서체: 고딕' : '서체: 명조';
    if (alignBtn) alignBtn.textContent = this.isAlignLeft ? '정렬: 좌측' : '정렬: 양쪽';
    if (novelBtn) {
      novelBtn.textContent = this.isNovelMode ? '📱 웹소설뷰 ON' : '📱 웹소설뷰';
      novelBtn.style.borderColor = this.isNovelMode ? 'var(--accent)' : '';
      novelBtn.style.color = this.isNovelMode ? 'var(--accent)' : '';
    }
    if (sizeIndicator) sizeIndicator.textContent = this.bodySize + 'px';
    if (noteModeBtn) {
      noteModeBtn.textContent = this.isNotesInline ? '주석: 본문 내 펼침' : '주석: 팝업 캡슐(권장)';
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
    if (!mainEl || mainEl.querySelector('.main-column')) return;

    const col = document.createElement('div');
    col.className = 'main-column';
    while (mainEl.firstChild) {
      col.appendChild(mainEl.firstChild);
    }
    mainEl.appendChild(col);
  },

  wrapTablesForMobile() {
    const tables = document.querySelectorAll('main table.book-table');
    tables.forEach((tbl) => {
      if (tbl.parentElement && tbl.parentElement.classList.contains('table-scroll-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll-wrap';
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
  },

  injectReaderToolbar() {
    const navInner = document.querySelector('nav.sticky > div');
    if (!navInner || document.getElementById('fkReaderToolbar')) return;

    navInner.classList.add('flex-wrap', 'gap-2');
    const hasTocSidebar = !!document.getElementById('tocSidebar');

    const toolbar = document.createElement('div');
    toolbar.id = 'fkReaderToolbar';
    toolbar.className = 'flex flex-wrap items-center gap-1.5';
    const themeLabels = { paper: '☀️ 페이퍼', sage: '🍵 그린', night: '🌙 다크' };

    toolbar.innerHTML = `
      ${hasTocSidebar ? `<button onclick="HarnessEngine.openMobileTOC()" class="reader-ctrl-btn" title="단원 세부 목차 열기">☰ 목차</button>` : ''}
      <button id="fkNovelBtn" onclick="HarnessEngine.toggleNovelMode()" class="reader-ctrl-btn" title="갤럭시 S26 Ultra 웹소설 1단 몰입 모드">
        ${this.isNovelMode ? '📱 웹소설뷰 ON' : '📱 웹소설뷰'}
      </button>
      <button id="fkNightBtn" onclick="HarnessEngine.cycleThemeMode()" class="reader-ctrl-btn" title="배경 테마 전환 (페이퍼 / 그린 / AMOLED 다크)">
        ${themeLabels[this.themeMode] || '☀️ 페이퍼'}
      </button>
      <button id="fkFontBtn" onclick="HarnessEngine.toggleFontFamily()" class="reader-ctrl-btn">
        ${this.isSans ? '서체: 고딕' : '서체: 명조'}
      </button>
      <button onclick="HarnessEngine.adjustFontSize(-1)" class="reader-ctrl-btn" title="글자 작게">가-</button>
      <span id="fkSizeIndicator" style="font-size:11px; font-weight:700; color:var(--accent); padding:0 2px;">${this.bodySize}px</span>
      <button onclick="HarnessEngine.adjustFontSize(1)" class="reader-ctrl-btn" title="글자 크게">가+</button>
      <button onclick="HarnessEngine.openSettingsSheet()" class="reader-ctrl-btn" title="상세 리더 설정">⚙️ 설정</button>
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
      <div class="flex items-center justify-between pb-3 mb-3 border-b" style="border-color:var(--border-line);">
        <div id="fkNoteSheetTitle" style="font-size:14px; font-weight:800; color:var(--accent);">
          💡 핵심 기출 출제 포인트
        </div>
        <button onclick="HarnessEngine.closeAllSheets()" class="reader-ctrl-btn">닫기 ✕</button>
      </div>
      <ul id="fkNoteSheetList" class="fk-sheet-list"></ul>
    `;
    document.body.appendChild(noteSheet);

    // 2. Reader Settings Bottom Sheet (갤럭시 S26 Ultra 맞춤 리더 설정 시트)
    const settingsSheet = document.createElement('div');
    settingsSheet.id = 'fkSettingsBottomSheet';
    settingsSheet.className = 'fk-bottom-sheet';
    settingsSheet.innerHTML = `
      <div class="fk-sheet-handle"></div>
      <div class="flex items-center justify-between pb-3 mb-4 border-b" style="border-color:var(--border-line);">
        <div style="font-size:15px; font-weight:800; color:var(--text-main);">
          📖 웹소설 리더 & 갤럭시 S26 Ultra 맞춤 설정
        </div>
        <button onclick="HarnessEngine.closeAllSheets()" class="reader-ctrl-btn">닫기 ✕</button>
      </div>
      <div class="space-y-4" style="font-size:13.5px;">
        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">배경 테마</span>
          <div class="flex items-center gap-1.5">
            <button onclick="HarnessEngine.setThemeMode('paper')" class="reader-ctrl-btn" style="padding:6px 12px !important;">☀️ 리디 페이퍼</button>
            <button onclick="HarnessEngine.setThemeMode('sage')" class="reader-ctrl-btn" style="padding:6px 12px !important;">🍵 그린 에디션</button>
            <button onclick="HarnessEngine.setThemeMode('night')" class="reader-ctrl-btn" style="padding:6px 12px !important;">🌙 AMOLED 다크</button>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">읽기 레이아웃</span>
          <div class="flex items-center gap-1.5">
            <button onclick="HarnessEngine.toggleNovelMode()" class="reader-ctrl-btn" style="padding:6px 12px !important;">📱 1단 웹소설 모드 전환</button>
            <button id="fkNoteModeBtn" onclick="HarnessEngine.toggleNotesInline()" class="reader-ctrl-btn" style="padding:6px 12px !important;">
              ${this.isNotesInline ? '주석: 본문 내 펼침' : '주석: 팝업 캡슐(권장)'}
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">본문 및 표 글자 크기</span>
          <div class="flex items-center gap-2">
            <button onclick="HarnessEngine.adjustFontSize(-1)" class="reader-ctrl-btn" style="padding:6px 14px !important;">가 -</button>
            <button onclick="HarnessEngine.adjustFontSize(1)" class="reader-ctrl-btn" style="padding:6px 14px !important;">가 +</button>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span style="font-weight:700; color:var(--text-sub);">줄간격 (웹소설 호흡)</span>
          <div class="flex items-center gap-1.5">
            <button onclick="HarnessEngine.setLineHeight(1.8)" class="reader-ctrl-btn" style="padding:6px 12px !important;">조밀 (1.8)</button>
            <button onclick="HarnessEngine.setLineHeight(1.98)" class="reader-ctrl-btn" style="padding:6px 12px !important;">기본 (1.98)</button>
            <button onclick="HarnessEngine.setLineHeight(2.15)" class="reader-ctrl-btn" style="padding:6px 12px !important;">여유 (2.15)</button>
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
    const mainCol = document.querySelector('.main-column');
    if (!mainCol) return;

    // Remove existing pills before rebuilding
    mainCol.querySelectorAll('.novel-note-pill').forEach((el) => el.remove());
    this.sidenoteData = [];

    const notes = Array.from(mainCol.querySelectorAll('.sidenote'));
    notes.forEach((noteEl) => {
      const titleEl = noteEl.querySelector('.sidenote-title');
      const listEl = noteEl.querySelector('.sidenote-list');
      if (!listEl) return;

      const lis = Array.from(listEl.querySelectorAll('li'));
      if (lis.length === 0) return;

      const titleText = titleEl ? titleEl.textContent.trim() : '기출 출제 포인트';
      const firstPlain = lis[0].textContent.replace(/\s+/g, ' ').trim();
      const idx = this.sidenoteData.length;
      this.sidenoteData.push({
        title: titleText,
        count: lis.length,
        itemsHtml: listEl.innerHTML,
      });

      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'novel-note-pill';
      pill.onclick = () => this.openNoteSheet(idx);
      pill.innerHTML = `
        <span class="novel-note-badge">💡 ${titleText} (${lis.length})</span>
        <span class="novel-note-preview">${firstPlain}</span>
        <span class="novel-note-arrow">열기 ›</span>
      `;

      noteEl.parentNode.insertBefore(pill, noteEl);
    });
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

  renderUnitStats(containerId, stats) {
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

  renderQuizList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container || !items) return;

    let html = '';
    items.forEach((item, idx) => {
      const isO = item.isCorrect;
      const correctBadge = isO
        ? `<span style="font-size:11.5px; font-weight:700; color:var(--correct-ink);">[ O ] 옳은 지문</span>`
        : `<span style="font-size:11.5px; font-weight:700; color:var(--wrong-ink);">[ X ] 그른 지문</span>`;

      const origLinkBtn = item.origQId
        ? `<a href="#orig-card-${item.origQId}" class="reader-ctrl-btn" style="text-decoration:none;">관련 기출문항 &uarr;</a>`
        : '';

      html += `
        <div class="ox-card" id="ox-item-${item.id}">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span style="font-size:11.5px; font-weight:700; color:var(--accent); background:var(--accent-soft); padding:1px 7px; border-radius:3px;">
                지문 ${String(idx + 1).padStart(2, '0')}
              </span>
              ${item.source ? `<span style="font-size:11.5px; color:var(--text-muted);">${item.source}</span>` : ''}
              ${origLinkBtn}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="HarnessEngine.submitAnswer('${item.id}', true, ${isO})" class="reader-ctrl-btn" style="padding:5px 12px !important;">O</button>
              <button onclick="HarnessEngine.submitAnswer('${item.id}', false, ${isO})" class="reader-ctrl-btn" style="padding:5px 12px !important;">X</button>
              <button id="toggle-btn-${item.id}" onclick="HarnessEngine.toggleExplanation('${item.id}')" class="reader-ctrl-btn">해설 열기 &darr;</button>
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
