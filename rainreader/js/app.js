/* ============================================================
   Reader App - Multi-Format Architecture
   ============================================================ */
(() => {
  'use strict';

  // ---------- DOM Elements ----------
  const DOM = {
    viewer: document.getElementById('viewer'),
    fileInput: document.getElementById('fileInput'),
    openBtn: document.getElementById('openBtn'),
    emptyOpenBtn: document.getElementById('emptyOpenBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    pageCurrent: document.getElementById('pageCurrent'),
    pageTotal: document.getElementById('pageTotal'),
    pageInfo: document.getElementById('pageInfo'),
    progressFill: document.getElementById('progressFill'),
    tocList: document.getElementById('tocList'),
    bookTitle: document.getElementById('bookTitle'),
    bookSub: document.getElementById('bookSub'),
    emptyState: document.getElementById('emptyState'),
    loading: document.getElementById('loading'),
    toast: document.getElementById('toast'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    menuBtn: document.getElementById('menuBtn'),
    closeSidebar: document.getElementById('closeSidebar'),
    themeBtn: document.getElementById('themeBtn'),
    themeIcon: document.getElementById('themeIcon'),
    html: document.documentElement,
    app: document.querySelector('.app')
  };

  const SettingsUI = {
    fontInc: document.getElementById('fontInc'), fontDec: document.getElementById('fontDec'), fontSizeLabel: document.getElementById('fontSizeLabel'),
    lhInc: document.getElementById('lhInc'), lhDec: document.getElementById('lhDec'), lhLabel: document.getElementById('lhLabel'),
    widthInc: document.getElementById('widthInc'), widthDec: document.getElementById('widthDec'), widthLabel: document.getElementById('widthLabel')
  };

  // ---------- State & Configuration ----------
  const state = {
    engine: null, // Active reader engine (EPUB, MOBI, etc.)
    theme: localStorage.getItem('r-theme') || 'light',
    fontSize: parseInt(localStorage.getItem('r-font') || '100', 10),
    lineHeight: parseFloat(localStorage.getItem('r-lh') || '1.6'),
    widthIdx: parseInt(localStorage.getItem('r-width') || '1', 10),
    tocMap: new Map(),
    currentFile: null,
  };

  const WIDTHS = [
    { label: 'Narrow', max: 520 },
    { label: 'Medium', max: 680 },
    { label: 'Wide', max: 860 },
  ];

  const READER_THEMES = {
    light: {
      'html, body': { 'color': '#111827 !important', 'background': '#ffffff !important' },
      'p, div, span, li, h1, h2, h3': { 'color': '#111827 !important' },
      'a, a:visited': { 'color': '#2563eb !important' },
    },
    dark: {
      'html, body': { 'color': '#f9fafb !important', 'background': '#111827 !important' },
      'p, div, span, li, h1, h2, h3': { 'color': '#f9fafb !important' },
      'a, a:visited': { 'color': '#60a5fa !important' },
      'img, svg': { 'opacity': '0.9' },
    },
    sepia: {
      'html, body': { 'color': '#433422 !important', 'background': '#fbf0d9 !important' },
      'p, div, span, li, h1, h2, h3': { 'color': '#433422 !important' },
      'a, a:visited': { 'color': '#92400e !important' },
    },
  };

  // ---------- Utilities ----------
  const utils = {
    debounce: (fn, ms = 200) => {
      let t;
      return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },
    toastTimer: null,
    showToast: (msg, ms = 2500) => {
      DOM.toast.textContent = msg;
      DOM.toast.classList.add('show');
      clearTimeout(utils.toastTimer);
      utils.toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), ms);
    },
    setLoading: (on) => {
      DOM.loading.classList.toggle('hidden', !on);
    },
    isMobile: () => window.innerWidth < 768,
    getFileExtension: (filename) => filename.split('.').pop().toLowerCase()
  };

  // ============================================================
  // READER ENGINES (Adapter Pattern)
  // ============================================================

  /**
   * EPUB Engine Wrapper (using epub.js)
   */
  class EpubEngine {
    constructor(file, buffer) {
      this.book = ePub(buffer);
      this.rendition = null;
      this.totalLocations = 0;
    }

    async render(containerId) {
      this.rendition = this.book.renderTo(containerId, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        manager: 'default',
        allowScriptedContent: false,
      });

      // Register & Apply Themes
      Object.entries(READER_THEMES).forEach(([name, rules]) => {
        this.rendition.themes.register(name, rules);
      });
      this.applyStyles();

      await this.rendition.display();

      // Hook up locations and TOC
      this.book.ready.then(() => this.book.locations.generate(1024))
        .then(() => {
          this.totalLocations = this.book.locations.length();
          this.updateProgress(this.rendition.currentLocation());
        }).catch(() => {});

      this.book.loaded.navigation.then(nav => buildTOC(nav.toc || []));

      // Events
      this.rendition.on('relocated', (loc) => {
        this.updateProgress(loc);
        highlightTOC(loc.start.href);
      });

      attachSwipe(DOM.viewer, () => this.prev(), () => this.next());
    }

   applyStyles() {
      if (!this.rendition) return;
      
      // 1. Apply internal styles (Font size, Line height, and Word wrapping)
      this.rendition.themes.select(state.theme);
      this.rendition.themes.fontSize(state.fontSize + '%');
      this.rendition.themes.override('line-height', `${state.lineHeight} !important`, true);
      this.rendition.themes.override('word-break', 'break-word', true); // Prevents long words from spilling

      // 2. Apply layout styles to the EXTERNAL container, not the iframe
      DOM.viewer.style.maxWidth = WIDTHS[state.widthIdx].max + 'px';
      DOM.viewer.style.margin = '0 auto';
      
      // Add padding based on screen size (less padding on mobile)
      DOM.viewer.style.padding = utils.isMobile() ? '0.5rem 1rem' : '1rem 2rem';

      // 3. Force epub.js to recalculate the pages with the new dimensions/fonts
      if (this.rendition.manager) {
        this.rendition.resize();
      }
    }

    next() { this.rendition && this.rendition.next(); }
    prev() { this.rendition && this.rendition.prev(); }
    goTo(hrefOrCfi) { this.rendition && this.rendition.display(hrefOrCfi); }
    
    updateProgress(loc) {
      if (!loc) return;
      if (this.totalLocations > 0) {
        const pct = this.book.locations.percentageFromCfi(loc.start.cfi) * 100;
        DOM.progressFill.style.width = pct.toFixed(2) + '%';
        DOM.pageCurrent.textContent = this.book.locations.locationFromCfi(loc.start.cfi) + 1;
        DOM.pageTotal.textContent = this.totalLocations;
      }
    }

    destroy() {
      if (this.rendition) this.rendition.destroy();
      if (this.book) this.book.destroy();
    }
  }

  /**
   * MOBI / AZW Engine Stub
   * Structural placeholder for Amazon binary formats.
   */
  class BinaryEngine {
    constructor(file, buffer) {
      this.file = file;
      this.buffer = buffer; // ArrayBuffer of the .mobi / .azw file
    }

    async render(containerId) {
      const container = document.getElementById(containerId);
      
      // Hook for actual WASM parsing in the future.
      // For now, render a graceful fallback UI within the viewer.
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:2rem;color:var(--text);">
          <i class="bi bi-file-earmark-binary" style="font-size:4rem;margin-bottom:1rem;color:var(--text-muted);"></i>
          <h2 style="margin-bottom:0.5rem;">Kindle Format Detected</h2>
          <p style="color:var(--text-muted);max-width:400px;line-height:1.5;">
            You opened a <strong>.${utils.getFileExtension(this.file.name)}</strong> file. 
            Native browser rendering of Amazon proprietary formats requires server-side conversion or an external WebAssembly plugin.
          </p>
          <p style="margin-top:1.5rem;font-size:0.9rem;color:var(--accent);">
            <i class="bi bi-info-circle"></i> Convert this file to EPUB to read it here.
          </p>
        </div>
      `;

      DOM.pageCurrent.textContent = '1';
      DOM.pageTotal.textContent = '1';
      DOM.progressFill.style.width = '100%';
      buildTOC([]); // Empty TOC
    }

    applyStyles() {} // Managed by parent UI CSS
    next() { utils.showToast("End of preview."); }
    prev() {}
    goTo() {}
    destroy() { document.getElementById('viewer').innerHTML = ''; }
  }

  // ============================================================
  // APP LOGIC
  // ============================================================

  async function openBook(file) {
    if (!file) return;

    utils.setLoading(true);
    DOM.emptyState.classList.add('hidden');
    DOM.bookTitle.textContent = file.name.replace(/\.(epub|mobi|azw3?)$/i, '');
    DOM.bookSub.textContent = 'Loading engine...';

    // Cleanup previous engine
    if (state.engine) {
      state.engine.destroy();
      state.engine = null;
    }
    
    state.currentFile = file;
    state.tocMap.clear();
    DOM.pageCurrent.textContent = '—';
    DOM.pageTotal.textContent = '—';
    DOM.progressFill.style.width = '0%';
    DOM.tocList.innerHTML = '<p class="empty">Loading…</p>';

    try {
      const buffer = await file.arrayBuffer();
      const ext = utils.getFileExtension(file.name);

      // Route to correct engine based on file type
      if (ext === 'epub') {
        state.engine = new EpubEngine(file, buffer);
      } else if (['mobi', 'azw', 'azw3'].includes(ext)) {
        state.engine = new BinaryEngine(file, buffer);
      } else {
        throw new Error('Unsupported format');
      }

      await state.engine.render('viewer');
      DOM.bookSub.textContent = ext === 'epub' ? 'Swipe or tap edges to turn' : 'Format requires conversion';

    } catch (err) {
      console.error(err);
      DOM.emptyState.classList.remove('hidden');
      utils.showToast(`Could not open ${file.name}`);
      DOM.bookTitle.textContent = 'Reader';
      DOM.bookSub.textContent = 'Open an eBook to begin';
    } finally {
      utils.setLoading(false);
    }
  }

  // ---------- UI Bindings ----------

  function applyUITheme(theme) {
    state.theme = theme;
    DOM.html.setAttribute('data-theme', theme);

    const icons = { dark: 'bi-sun-fill', sepia: 'bi-circle-half', light: 'bi-moon-stars' };
    DOM.themeIcon.className = 'bi ' + (icons[theme] || icons.light);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#111827' : theme === 'sepia' ? '#fbf0d9' : '#ffffff');

    document.querySelectorAll('.theme-swatch').forEach(el => {
      el.classList.toggle('active', el.dataset.themePick === theme);
    });

    localStorage.setItem('r-theme', theme);
    if (state.engine) state.engine.applyStyles();
  }

  function updateReaderStyles() {
    SettingsUI.fontSizeLabel.textContent = state.fontSize + '%';
    SettingsUI.lhLabel.textContent = state.lineHeight.toFixed(1);
    SettingsUI.widthLabel.textContent = WIDTHS[state.widthIdx].label;

    localStorage.setItem('r-font', state.fontSize);
    localStorage.setItem('r-lh', state.lineHeight);
    localStorage.setItem('r-width', state.widthIdx);

    if (state.engine) state.engine.applyStyles();
  }

  // File Input Listeners
  const pickFile = () => DOM.fileInput.click();
  DOM.openBtn.addEventListener('click', pickFile);
  DOM.emptyOpenBtn.addEventListener('click', pickFile);
  DOM.fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) openBook(e.target.files[0]);
    DOM.fileInput.value = '';
  });

  // Sidebar Toggles
  const toggleSidebar = (forceClose = false) => {
    const isOpen = DOM.sidebar.classList.contains('open');
    if (utils.isMobile()) {
      DOM.sidebar.classList.toggle('open', !isOpen && !forceClose);
      DOM.sidebarBackdrop.classList.toggle('show', !isOpen && !forceClose);
    } else {
      DOM.app.classList.toggle('sidebar-collapsed', forceClose || !DOM.app.classList.contains('sidebar-collapsed'));
    }
  };
  
  DOM.menuBtn.addEventListener('click', () => toggleSidebar());
  DOM.closeSidebar.addEventListener('click', () => toggleSidebar(true));
  DOM.sidebarBackdrop.addEventListener('click', () => toggleSidebar(true));

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab, .tab-panel').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Settings Controls
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.addEventListener('click', () => applyUITheme(el.dataset.themePick));
  });
  DOM.themeBtn.addEventListener('click', () => {
    const order = ['light', 'dark', 'sepia'];
    applyUITheme(order[(order.indexOf(state.theme) + 1) % order.length]);
  });

  SettingsUI.fontInc.addEventListener('click', () => { state.fontSize = Math.min(state.fontSize + 10, 200); updateReaderStyles(); });
  SettingsUI.fontDec.addEventListener('click', () => { state.fontSize = Math.max(state.fontSize - 10, 60); updateReaderStyles(); });
  SettingsUI.lhInc.addEventListener('click', () => { state.lineHeight = Math.min(+(state.lineHeight + 0.1).toFixed(1), 2.4); updateReaderStyles(); });
  SettingsUI.lhDec.addEventListener('click', () => { state.lineHeight = Math.max(+(state.lineHeight - 0.1).toFixed(1), 1.0); updateReaderStyles(); });
  SettingsUI.widthInc.addEventListener('click', () => { state.widthIdx = Math.min(state.widthIdx + 1, WIDTHS.length - 1); updateReaderStyles(); });
  SettingsUI.widthDec.addEventListener('click', () => { state.widthIdx = Math.max(state.widthIdx - 1, 0); updateReaderStyles(); });

  // Navigation
  DOM.nextBtn.addEventListener('click', () => state.engine && state.engine.next());
  DOM.prevBtn.addEventListener('click', () => state.engine && state.engine.prev());

  document.addEventListener('keydown', (e) => {
    if (!state.engine || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); state.engine.next(); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); state.engine.prev(); break;
      case 'Escape': toggleSidebar(true); break;
    }
  });

  // TOC Helpers
  function buildTOC(items) {
    if (!items.length) {
      DOM.tocList.innerHTML = '<p class="empty">No table of contents</p>';
      return;
    }
    const frag = document.createDocumentFragment();
    const walk = (list, depth) => {
      list.forEach(item => {
        if (!item) return;
        const el = document.createElement('div');
        el.className = 'toc-item' + (depth ? ` depth-${Math.min(depth, 3)}` : '');
        el.textContent = item.label ? item.label.trim() : '(untitled)';
        el.addEventListener('click', () => {
          if (item.href && state.engine) {
            state.engine.goTo(item.href);
            if (utils.isMobile()) toggleSidebar(true);
          }
        });
        frag.appendChild(el);
        const key = (item.href || '').split('#')[0];
        if (key && !state.tocMap.has(key)) state.tocMap.set(key, el);
        if (item.subitems?.length) walk(item.subitems, depth + 1);
      });
    };
    walk(items, 0);
    DOM.tocList.innerHTML = '';
    DOM.tocList.appendChild(frag);
  }

  function highlightTOC(href) {
    if (!href) return;
    const key = href.split('#')[0];
    const target = state.tocMap.get(key);
    document.querySelectorAll('.toc-item.active').forEach(e => e.classList.remove('active'));
    if (target) {
      target.classList.add('active');
      if (!utils.isMobile() || DOM.sidebar.classList.contains('open')) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  // Swipe Helpers
  function attachSwipe(element, onPrev, onNext) {
    let startX = 0, startY = 0, active = false;
    element.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      active = true;
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) onNext(); else onPrev();
    }, { passive: true });
  }

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(evt => document.addEventListener(evt, (e) => {
    e.preventDefault();
    if (!state.engine) DOM.emptyState.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => document.addEventListener(evt, (e) => {
    e.preventDefault();
    DOM.emptyState.classList.remove('dragover');
  }));
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) openBook(f);
  });

  // Initialization
  applyUITheme(state.theme);
  updateReaderStyles();
  document.body.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#viewer')) return;
  }, { passive: true });

})();