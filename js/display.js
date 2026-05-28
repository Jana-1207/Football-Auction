// ============================================================
// display.js — Live Display Logic (State Machine Edition)
// Screens: welcome → setstart → player | sold/unsold overlay
// ============================================================

// ── Tracked state ─────────────────────────────────────────
let _lastPlayerId  = null;
let _lastPrice     = null;
let _lastActionKey = null;   // `${lastAction}-${ts}` to deduplicate overlays
let _rtConnected   = false;
let _pollInterval  = null;
let _isFirstLoad   = true;   // show welcome screen only once per page load
let _lastLoadedSet = null;   // `${category}-${setNum}` — detect set changes
let _teamsCache    = [];     // pre-cached list of franchise teams

// ── DOM refs ─────────────────────────────────────────────
const elWelcome  = document.getElementById('screen-welcome');
const elSetStart = document.getElementById('screen-setstart');
const elWaiting  = document.getElementById('waiting');
const elDisplay  = document.getElementById('display');
const elSummary  = document.getElementById('screen-summary');
const elName     = document.getElementById('d-name');
const elPos      = document.getElementById('d-pos');
const elClub     = document.getElementById('d-club');
const elNat      = document.getElementById('d-nat');
const elPhoto    = document.getElementById('d-photo');
const elPrice    = document.getElementById('d-price');
const elBase     = document.getElementById('d-base');
const elRound    = document.getElementById('d-round');
const elSetBadge = document.getElementById('d-set-badge');
const elArrow    = document.getElementById('d-arrow');
const elStatus   = document.getElementById('rt-status');

// Set-start screen elements
const elSsCat     = document.getElementById('ss-cat');
const elSsTitle   = document.getElementById('ss-title');
const elSsPlayers = document.getElementById('ss-players');

// ── Format ───────────────────────────────────────────────
function fmt(v) { return `$${v}M`; }

// ── Show / hide screens ───────────────────────────────────
function showScreen(name) {
  // name: 'welcome' | 'setstart' | 'waiting' | 'player' | 'summary'
  elWelcome.classList.remove('fade-out');
  elWelcome.classList.add('hidden');
  elSetStart.classList.remove('show', 'fade-out');
  elWaiting.classList.remove('show');
  elDisplay.classList.remove('show');
  elSummary.classList.remove('show');

  if (name === 'welcome') {
    elWelcome.classList.remove('hidden');
  } else if (name === 'setstart') {
    elSetStart.classList.add('show');
  } else if (name === 'waiting') {
    elWaiting.classList.add('show');
  } else if (name === 'player') {
    elDisplay.classList.add('show');
  } else if (name === 'summary') {
    elSummary.classList.add('show');
  }
}

// Helper to extract a beautiful monogram placeholder
function getMonogram(name) {
  if (!name) return 'FC';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Pre-load and cache the list of franchise teams
async function loadTeamsCache() {
  try {
    _teamsCache = await getTeams();
  } catch (e) {
    console.error('[Display] Failed to load teams cache:', e);
  }
}

// ── Show sold/unsold overlay ──────────────────────────────
function showOverlay(type, player) {
  const el = document.getElementById(`overlay-${type}`);
  if (!el) return;
  
  if (type === 'sold' && player) {
    const elTeam = document.getElementById('ov-sold-team');
    const elPrice = document.getElementById('ov-sold-price');
    const elLogo = document.getElementById('ov-sold-logo');
    const elPlaceholder = document.getElementById('ov-sold-logo-placeholder');
    const elLogoContainer = document.getElementById('ov-sold-logo-container');

    let teamName = "Unknown Franchise";
    let logoUrl = null;

    if (player.team_id) {
      const team = _teamsCache.find(t => t.id === player.team_id);
      if (team) {
        teamName = team.name;
        logoUrl = team.logo_url;
      }
    }

    if (elTeam) elTeam.textContent = teamName;
    if (elPrice) elPrice.textContent = fmt(player.currentPrice);

    if (logoUrl) {
      elLogo.src = logoUrl;
      elLogo.style.display = 'block';
      elPlaceholder.style.display = 'none';
      if (elLogoContainer) elLogoContainer.classList.add('has-logo');

      elLogo.onerror = () => {
        elLogo.style.display = 'none';
        elPlaceholder.textContent = getMonogram(teamName);
        elPlaceholder.style.display = 'flex';
        if (elLogoContainer) elLogoContainer.classList.remove('has-logo');
      };
    } else {
      elLogo.style.display = 'none';
      elPlaceholder.textContent = getMonogram(teamName);
      elPlaceholder.style.display = 'flex';
      if (elLogoContainer) elLogoContainer.classList.remove('has-logo');
    }
  }
  
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
  }, 2800);
}

// ── Dismiss welcome with fade ─────────────────────────────
function dismissWelcome() {
  if (elWelcome.classList.contains('hidden')) return;
  elWelcome.classList.add('fade-out');
  setTimeout(() => elWelcome.classList.add('hidden'), 850);
}

// ── Show set-start announcement, then auto-dismiss ────────
function showSetStart(cat, setNum, playerCount) {
  elSsCat.textContent     = cat.toUpperCase();
  elSsTitle.textContent   = `Set ${setNum}`;
  elSsPlayers.textContent = `${playerCount} player${playerCount !== 1 ? 's' : ''} ready`;

  showScreen('setstart');

  // Auto dismiss after 3s then show player
  setTimeout(() => {
    elSetStart.classList.add('fade-out');
    setTimeout(() => {
      elSetStart.classList.remove('show', 'fade-out');
    }, 650);
  }, 3000);
}

// ── Update player fields ──────────────────────────────────
function updatePlayerFields(player) {
  elName.textContent = player.name;
  elPos.textContent  = player.category; // Only show category, not specific position
  elClub.textContent = `🏟  ${player.club}`;
  elNat.textContent  = `🌍  ${player.nationality}`;
  elBase.textContent = `Base: ${fmt(player.basePrice)}`;

  // Photo crossfade
  elPhoto.style.opacity = '0';
  const src = player.photo || `https://i.pravatar.cc/800?u=${player.id}`;
  const img = new Image();
  img.onload = () => {
    elPhoto.src = src;
    elPhoto.style.transition = 'opacity 0.5s ease';
    elPhoto.style.opacity = '1';
  };
  img.onerror = () => {
    elPhoto.src = `https://i.pravatar.cc/800?u=${player.id}`;
    elPhoto.style.opacity = '1';
  };
  img.src = src;

  elPrice.textContent = fmt(player.currentPrice);
  _lastPlayerId = player.id;
  _lastPrice    = player.currentPrice;
}

// ── Animate price ─────────────────────────────────────────
function animPrice(player) {
  if (player.currentPrice === _lastPrice) return;
  const up = player.currentPrice > (_lastPrice ?? player.basePrice);

  elArrow.textContent   = up ? '▲' : '▼';
  elArrow.className     = `d-arrow ${up ? 'up' : 'down'}`;
  elArrow.style.opacity = '1';
  setTimeout(() => { elArrow.style.opacity = '0'; }, 1200);

  elPrice.classList.remove('pulse');
  void elPrice.offsetWidth;
  elPrice.textContent = fmt(player.currentPrice);
  elPrice.classList.add('pulse');
  _lastPrice = player.currentPrice;
}

// ── Main render ───────────────────────────────────────────
async function renderDisplay() {
  // Asynchronously refresh teams cache in the background so it remains fresh
  loadTeamsCache().catch(() => {});

  let state, player;

  try {
    state  = await getState();
    player = await getCurrentPlayer();
  } catch (e) {
    console.error('renderDisplay error:', e);
    return;
  }

  if (!state) return;

  // ── Handle Reset ──
  if (state.lastAction === 'reset') {
    _isFirstLoad = true;
    _lastLoadedSet = null;
    showScreen('welcome');
    return;
  }

  // ── Handle Empty State (Waiting for Admin) ──
  if (!state.activeCategory) {
    if (!_isFirstLoad) showScreen('waiting');
    return;
  }

  const cat    = state.activeCategory || 'Forwards';
  const setNum = state.activeSet || 1;
  const setKey = `${cat}-${setNum}`;
  const actionKey = `${state.lastAction}-${state.ts}`;

  // Update footer badges
  if (elSetBadge) elSetBadge.textContent = `${cat} · Set ${setNum}`;
  elRound.textContent = `Round ${state.round || 1} — Live`;

  // ── Detect a brand new set being loaded ──
  const isNewSet = (state.lastAction === 'loadSet') && (setKey !== _lastLoadedSet);

  // ── If it's the first load ever (welcome screen showing) ──
  if (_isFirstLoad) {
    if (state.lastAction === 'init' && !state.currentPlayerId) {
      // Stay on welcome screen — admin hasn't loaded a set yet
      return;
    }
    // Admin has loaded something — dismiss welcome
    _isFirstLoad = false;
    dismissWelcome();
  }

  // ── Check player validity ──
  const validPlayer = player &&
    player.category  === cat &&
    player.setNumber === setNum;

  // ── Handle new set announcement ──
  if (isNewSet) {
    _lastLoadedSet = setKey;
    _lastPlayerId  = null;
    _lastPrice     = null;

    // Count players in this set
    let playerCount = 0;
    try {
      const all = await getPlayers();
      playerCount = all.filter(p => p.category === cat && p.setNumber === setNum && p.status === 'pending').length;
    } catch (e) { /* silent */ }

    showSetStart(cat, setNum, playerCount);

    // After set-start animation (3s show + 0.65s fade = ~3.65s), show the player
    setTimeout(async () => {
      if (validPlayer) {
        showScreen('player');
        updatePlayerFields(player);
      } else {
        showScreen('waiting');
      }
    }, 3700);

    await renderTicker(cat, setNum);
    return;
  }

  // ── No valid player → check if round complete or just waiting ──
  if (!validPlayer) {
    if (!_isFirstLoad) {
      let all;
      try { all = await getPlayers(); } catch (e) { all = []; }
      
      const nextSetGlobally = getFirstAvailableSetGlobally(all);
      
      if (!nextSetGlobally) {
        // Round complete! Show summary
        const summary = getAuctionSummary(all);
        document.getElementById('d-sum-spent').textContent = fmt(summary.totalSpent);
        document.getElementById('d-sum-sold').textContent = summary.soldCount;
        document.getElementById('d-sum-unsold').textContent = summary.unsoldCount;
        showScreen('summary');
      } else {
        // Just waiting for admin to load the next set
        // Show set completion stats on the waiting screen
        const setPlayers = all.filter(p => p.category === cat && p.setNumber === setNum);
        const soldCount = setPlayers.filter(p => p.status === 'sold').length;
        const unsoldCount = setPlayers.filter(p => p.status === 'unsold').length;
        
        document.querySelector('.waiting-title').textContent = `Set ${setNum} Completed`;
        document.querySelector('.waiting-sub').textContent = `${soldCount} Sold, ${unsoldCount} Unsold. Waiting for admin to load the next set…`;
        
        showScreen('waiting');
      }
    }
    _lastPlayerId = null;
    _lastPrice    = null;
    await renderTicker(cat, setNum);
    return;
  }

  // ── Show the player ──
  showScreen('player');

  // Player changed → full update with animation
  if (player.id !== _lastPlayerId) {
    elDisplay.classList.remove('fade-up');
    void elDisplay.offsetWidth;
    elDisplay.classList.add('fade-up');
    updatePlayerFields(player);
  }

  // Price changed → animate
  animPrice(player);

  // ── Overlay triggers — once per unique action ──
  if (actionKey !== _lastActionKey) {
    _lastActionKey = actionKey;
    if (state.lastAction === 'sold')   showOverlay('sold', player);
    if (state.lastAction === 'unsold') showOverlay('unsold', player);
  }

  await renderTicker(cat, setNum);
}

// ── Footer ticker ─────────────────────────────────────────
async function renderTicker(cat, setNum) {
  try {
    const all    = await getPlayers();
    const subset = all.filter(p => p.category === cat && p.setNumber === setNum);
    document.getElementById('t-sold').textContent   = subset.filter(p => p.status === 'sold').length;
    document.getElementById('t-unsold').textContent = subset.filter(p => p.status === 'unsold').length;
    document.getElementById('t-remain').textContent = subset.filter(p => p.status === 'pending').length;
  } catch (e) { /* silent */ }
}

// ── Status indicator ──────────────────────────────────────
function setStatusIndicator(mode) {
  if (!elStatus) return;
  if (mode === 'live') {
    elStatus.textContent = '● LIVE';
    elStatus.style.color = '#22c55e';
    elStatus.title = 'Real-time connected';
  } else {
    elStatus.textContent = '● POLLING';
    elStatus.style.color = '#f0b429';
    elStatus.title = 'Polling every 2s';
  }
}

// ── Polling fallback ──────────────────────────────────────
function startPolling() {
  if (_pollInterval) return;
  console.warn('[Display] Falling back to 2s polling');
  setStatusIndicator('polling');
  _pollInterval = setInterval(renderDisplay, 2000);
}
function stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

// ── Supabase Real-Time ────────────────────────────────────
supabase.channel('display-rt')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, renderDisplay)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_state' }, renderDisplay)
  .subscribe(status => {
    console.log('[Display] RT status:', status);
    if (status === 'SUBSCRIBED') {
      _rtConnected = true;
      stopPolling();
      setStatusIndicator('live');
    } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
      _rtConnected = false;
      startPolling();
    }
  });

// ── Fullscreen on double-click ─────────────────────────────
document.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});

// ── Init ─────────────────────────────────────────────────
(async () => {
  // Always start on welcome screen
  showScreen('welcome');
  elWelcome.classList.remove('hidden');

  await initStorage();
  await loadTeamsCache(); // Pre-cache the franchise teams before rendering
  await renderDisplay();

  // If RT hasn't connected after 5s, start polling
  setTimeout(() => { if (!_rtConnected) startPolling(); }, 5000);
})();
