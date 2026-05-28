// ============================================================
// admin.js — Admin Panel Logic (Supabase, Fully Fixed)
// ============================================================

const INC = 10; // $10M per click
const OVERLAY_DELAY = 2800; // ms — time display shows SOLD/UNSOLD before next player

// ── Globals ───────────────────────────────────────────────
let _currentPlayer  = null;
let _currentState   = null;
let _transitioning  = false;  // lock during sold/unsold transition

// ── DOM refs ─────────────────────────────────────────────
const elRoundBadge  = document.getElementById('round-badge');
const elSetBadge    = document.getElementById('set-badge');
const elStatQueue   = document.getElementById('stat-queue');
const elStatSold    = document.getElementById('stat-sold');
const elStatUnsold  = document.getElementById('stat-unsold');
const elNoPlayer    = document.getElementById('no-player');
const elNoPlayerMsg = document.getElementById('no-player-msg');
const elPlayerCard  = document.getElementById('player-card');
const elBidControls = document.getElementById('bid-controls');
const elNextSetArea = document.getElementById('next-set-area');
const elBtnNextSet  = document.getElementById('btn-next-set');
const elCatPrompt   = document.getElementById('category-prompt-area');
const elCatButtons  = document.getElementById('category-buttons');
const elRoundSummary= document.getElementById('round-summary');
const elQueueList   = document.getElementById('queue-list');
const elSoldList    = document.getElementById('sold-list');
const elUnsoldList  = document.getElementById('unsold-list');

const elPName   = document.getElementById('p-name');
const elPPos    = document.getElementById('p-pos');
const elPClub   = document.getElementById('p-club');
const elPPhoto  = document.getElementById('p-photo');
const elPPrice  = document.getElementById('p-price');
const elPBase   = document.getElementById('p-base');

const elSelCat  = document.getElementById('sel-cat');
const elSelSet  = document.getElementById('sel-set');

// ── Toast ────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = '0.25s';
    setTimeout(() => t.remove(), 260);
  }, 3000);
}

// ── Format ───────────────────────────────────────────────
function fmt(v) { return `$${v}M`; }

// ── Animate price ─────────────────────────────────────────
function animPrice(v) {
  elPPrice.classList.remove('pulse');
  void elPPrice.offsetWidth;
  elPPrice.textContent = fmt(v);
  elPPrice.classList.add('pulse');
}

// ── Render full admin view ────────────────────────────────
async function render() {
  // Fetch fresh state and all players once per render
  _currentState  = await getState();
  const allPlayers = await getPlayers();

  const cat    = _currentState.activeCategory || 'Forwards';
  const setNum = _currentState.activeSet || 1;
  const round  = _currentState.round || 1;

  // Sync selectors to DB state
  if (elSelCat.value !== cat) elSelCat.value = cat;
  if (Number(elSelSet.value) !== setNum) elSelSet.value = setNum;

  // Badges
  elRoundBadge.textContent = `Round ${round}`;
  elSetBadge.textContent   = `${cat} · Set ${setNum}`;

  // Stats for this set
  const setPlayers = allPlayers.filter(p => p.category === cat && p.setNumber === setNum);
  const pending = setPlayers.filter(p => p.status === 'pending');
  const sold    = allPlayers.filter(p => p.status === 'sold');
  const unsold  = setPlayers.filter(p => p.status === 'unsold');

  elStatQueue.textContent  = pending.length;
  elStatSold.textContent   = sold.length;
  elStatUnsold.textContent = unsold.length;

  // Current player from state
  _currentPlayer = _currentState.currentPlayerId
    ? allPlayers.find(p => p.id === _currentState.currentPlayerId) || null
    : null;

  // Is the active player in the currently viewed category/set?
  const playerInView = _currentPlayer &&
    _currentPlayer.category  === cat &&
    _currentPlayer.setNumber === setNum;

  if (!playerInView) {
    const nextSetInCat = getNextAvailableSetInSameCategory(cat, allPlayers);
    const availableCats = getAvailableCategories(allPlayers);
    
    // Always hide these initially
    elRoundSummary.classList.remove('show');
    elPlayerCard.classList.remove('show');
    elNoPlayer.classList.add('show');
    elBidControls.style.opacity = '0.35';
    elBidControls.style.pointerEvents = 'none';
    elBtnNextSet.style.display = 'none';
    elCatPrompt.style.display = 'none';

    // If we just reset, force the category prompt
    const justReset = _currentState.lastAction === 'reset' && !_currentState.currentPlayerId;

    if (nextSetInCat && !justReset) {
      // There's a next set in the SAME category
      elNoPlayerMsg.textContent = `Set ${setNum} completed.`;
      elBtnNextSet.style.display = 'inline-flex';
      elBtnNextSet.textContent = `Next Set: ${nextSetInCat.category} Set ${nextSetInCat.setNumber} ➔`;
      elBtnNextSet.dataset.nextCat = nextSetInCat.category;
      elBtnNextSet.dataset.nextSet = nextSetInCat.setNumber;
    } else if (availableCats.length > 0) {
      // Category is completely finished (or we just reset), but others remain
      elNoPlayerMsg.textContent = justReset ? 'Auction Reset.' : `Category ${cat} is complete.`;
      elCatPrompt.style.display = 'block';
      elCatButtons.innerHTML = '';
      
      availableCats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-blue-soft';
        btn.textContent = c;
        btn.onclick = () => {
          elSelCat.value = c;
          elSelSet.value = 1; // default to 1, user can change if they want before clicking load
          document.getElementById('btn-load').click();
        };
        elCatButtons.appendChild(btn);
      });
    } else {
      // Entire round is complete (no pending players left anywhere)
      elNoPlayer.classList.remove('show');
      elRoundSummary.classList.add('show');
      
      const summary = getAuctionSummary(allPlayers);
      document.getElementById('rs-spent').textContent = fmt(summary.totalSpent);
      document.getElementById('rs-sold').textContent = summary.soldCount;
      document.getElementById('rs-unsold').textContent = summary.unsoldCount;
    }
  } else {
    const p = _currentPlayer;
    elNoPlayer.classList.remove('show');
    elRoundSummary.classList.remove('show');
    elPlayerCard.classList.add('show');
    elBidControls.style.opacity = '1';
    elBidControls.style.pointerEvents = 'auto';

    elPName.textContent  = p.name;
    elPPos.innerHTML     = `<span class="badge badge-gold">${p.category}</span>`;
    elPClub.textContent  = `${p.club}  ·  ${p.nationality}`;
    elPPhoto.src         = p.photo || `https://i.pravatar.cc/200?u=${p.id}`;
    elPPhoto.onerror     = () => { elPPhoto.src = `https://i.pravatar.cc/200?u=${p.id}`; };
    elPBase.textContent  = `Base: ${fmt(p.basePrice)}`;
    animPrice(p.currentPrice);

    document.getElementById('btn-dec').disabled = p.currentPrice <= p.basePrice;
  }

  // Queue list
  renderQueueList(allPlayers, cat, setNum, _currentState.currentPlayerId);

  // Fetch teams for detailed metadata matching
  const teams = await getTeams();

  // Sold list
  renderSoldList(allPlayers.filter(p => p.status === 'sold'), teams);

  // Unsold list
  renderUnsoldList(allPlayers.filter(p => p.status === 'unsold'));

  // Status overview
  renderStatusOverview(allPlayers, teams, round);
}

// ── Queue list ───────────────────────────────────────────
function renderQueueList(all, cat, setNum, curId) {
  const queue = all.filter(p => p.status === 'pending' && p.category === cat && p.setNumber === setNum);
  elQueueList.innerHTML = '';
  if (!queue.length) {
    elQueueList.innerHTML = '<p class="empty-state">Queue empty</p>';
    return;
  }
  queue.forEach(p => {
    const el = document.createElement('div');
    el.className = `q-item${p.id === curId ? ' current' : ''}`;
    el.innerHTML = `
      <img src="${p.photo || ''}" alt="" onerror="this.src='https://i.pravatar.cc/72?u=${p.id}'" />
      <div class="q-info">
        <span class="q-name truncate">${p.name}</span>
        <span class="q-sub">${p.position || ''} · ${p.club}</span>
      </div>
      <span class="q-price">${fmt(p.basePrice)}</span>
    `;
    elQueueList.appendChild(el);
  });
}

// Helper to extract a 2-letter monogram for a team placeholder
function getMonogram(name) {
  if (!name) return 'FC';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// ── Sold list ────────────────────────────────────────────
function renderSoldList(sold, teams) {
  elSoldList.innerHTML = '';
  if (!sold.length) {
    elSoldList.innerHTML = '<p class="empty-state">No sold players yet</p>';
    return;
  }
  sold.forEach(p => {
    const team = teams.find(t => t.id === p.team_id);
    const teamName = team ? team.name : "Unknown Team";
    const teamLogo = team && team.logo_url ? team.logo_url : null;

    let logoHtml = '';
    if (teamLogo) {
      logoHtml = `<img src="${teamLogo}" style="width: 14px; height: 14px; border-radius: 50%; border: none; object-fit: contain; vertical-align: middle;" onerror="this.style.display='none';" />`;
    } else {
      logoHtml = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: var(--gold-dim); color: var(--gold); font-size: 0.55rem; font-weight: bold; vertical-align: middle;">${getMonogram(teamName)}</span>`;
    }

    const el = document.createElement('div');
    el.className = 'q-item';
    el.style.alignItems = 'center';
    el.innerHTML = `
      <img src="${p.photo || ''}" alt="" onerror="this.src='https://i.pravatar.cc/72?u=${p.id}'" />
      <div class="q-info" style="flex: 1; min-width: 0;">
        <span class="q-name truncate" style="font-weight: 700;">${p.name}</span>
        <span class="q-sub" style="font-size: 0.72rem; color: var(--text-2); display: flex; align-items: center; gap: 4px;">
          ${logoHtml}
          Sold to <strong style="color: var(--gold);">${teamName}</strong>
        </span>
      </div>
      <span class="q-price sold" style="font-family: 'Bebas Neue', sans-serif; font-size: 1.1rem; color: var(--green);">${fmt(p.currentPrice)}</span>
    `;
    elSoldList.appendChild(el);
  });
}

// ── Unsold list ──────────────────────────────────────────
function renderUnsoldList(unsold) {
  elUnsoldList.innerHTML = '';
  if (!unsold.length) {
    elUnsoldList.innerHTML = '<p class="empty-state">No unsold players yet</p>';
    return;
  }
  unsold.forEach(p => {
    const el = document.createElement('div');
    el.className = 'q-item';
    el.innerHTML = `
      <img src="${p.photo || ''}" alt="" onerror="this.src='https://i.pravatar.cc/72?u=${p.id}'" />
      <div class="q-info">
        <span class="q-name truncate">${p.name}</span>
        <span class="q-sub">${p.category} Set ${p.setNumber}</span>
      </div>
      <span class="q-price" style="color: var(--red); font-family: 'Bebas Neue', sans-serif; font-size: 1.1rem;">${fmt(p.basePrice)}</span>
    `;
    elUnsoldList.appendChild(el);
  });
}

// ── Status/Overview dashboard ──────────────────────────────
function renderStatusOverview(all, teams, round) {
  const elStatus = document.getElementById('status-overview');
  if (!elStatus) return;

  const sold = all.filter(p => p.status === 'sold');
  const unsold = all.filter(p => p.status === 'unsold');
  const pending = all.filter(p => p.status === 'pending');
  const totalSpent = sold.reduce((sum, p) => sum + p.currentPrice, 0);

  // Compute team-by-team stats
  const teamStats = teams.map(t => {
    const bought = sold.filter(p => p.team_id === t.id);
    const spent = bought.reduce((sum, p) => sum + p.currentPrice, 0);
    return {
      name: t.name,
      logo: t.logo_url || null,
      count: bought.length,
      spent: spent
    };
  });
  
  // Sort teams by most spent
  teamStats.sort((a, b) => b.spent - a.spent);

  let html = `
    <!-- Round and Overview Stats -->
    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
      <div style="background: var(--bg-3); border: 1px solid var(--border); padding: 12px; border-radius: var(--r-md); text-align: center;">
        <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-3); font-weight: 600; display: block; margin-bottom: 2px;">Active Stage</span>
        <strong style="font-family: 'Bebas Neue', sans-serif; font-size: 1.6rem; color: var(--gold); letter-spacing: 0.04em;">ROUND ${round}</strong>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div style="background: var(--bg-3); border: 1px solid var(--border); padding: 10px; border-radius: var(--r-md); text-align: center;">
          <span style="font-size: 0.65rem; color: var(--text-2); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">Total Spent</span>
          <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem; color: var(--green);">${fmt(totalSpent)}</span>
        </div>
        <div style="background: var(--bg-3); border: 1px solid var(--border); padding: 10px; border-radius: var(--r-md); text-align: center;">
          <span style="font-size: 0.65rem; color: var(--text-2); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 2px;">Remaining</span>
          <span style="font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem; color: var(--blue);">${pending.length} Players</span>
        </div>
      </div>
    </div>
    
    <!-- Title -->
    <h3 style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-3); margin-bottom: 8px; font-weight: 700;">Franchise Summary</h3>
  `;

  if (teamStats.length === 0) {
    html += `<p class="empty-state" style="padding: 10px;">No teams registered</p>`;
  } else {
    html += `
      <div style="background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border); background: var(--bg-3);">
              <th style="padding: 8px; font-weight: 600; color: var(--text-3); font-size: 0.65rem; text-transform: uppercase;">Team</th>
              <th style="padding: 8px; font-weight: 600; color: var(--text-3); font-size: 0.65rem; text-transform: uppercase; text-align: center;">Qty</th>
              <th style="padding: 8px; font-weight: 600; color: var(--text-3); font-size: 0.65rem; text-transform: uppercase; text-align: right;">Spent</th>
            </tr>
          </thead>
          <tbody>
    `;

    teamStats.forEach(t => {
      let logoHtml = '';
      if (t.logo) {
        logoHtml = `<img src="${t.logo}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: contain;" onerror="this.style.display='none';" />`;
      } else {
        logoHtml = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--gold-dim); color: var(--gold); font-size: 0.65rem; font-weight: bold;">${getMonogram(t.name)}</span>`;
      }

      html += `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 8px; display: flex; align-items: center; gap: 6px; font-weight: 600; min-width: 0;">
            ${logoHtml}
            <span class="truncate" style="flex: 1; min-width: 0;">${t.name}</span>
          </td>
          <td style="padding: 8px; text-align: center; color: var(--text-2); font-weight: 600;">${t.count}</td>
          <td style="padding: 8px; text-align: right; color: var(--green); font-weight: 700; font-family: 'Bebas Neue', sans-serif; font-size: 0.95rem;">${fmt(t.spent)}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  elStatus.innerHTML = html;
}

// ── Advance to next pending player ───────────────────────
async function advanceToNext() {
  const s = await getState();
  const cat    = s.activeCategory || 'Forwards';
  const setNum = s.activeSet || 1;
  const queue  = await getPendingQueue(cat, setNum);

  const next = queue.find(p => p.id !== s.currentPlayerId) || queue[0] || null;

  s.currentPlayerId = next ? next.id : null;
  s.lastAction      = next ? 'next' : 'queueEmpty';
  await saveState(s);
  await render();
}

// ── Actions ───────────────────────────────────────────────
document.getElementById('btn-dec').addEventListener('click', async () => {
  if (!_currentPlayer) return;
  if (_currentPlayer.currentPrice <= _currentPlayer.basePrice) {
    toast('Cannot go below base price', 'warning');
    return;
  }
  _currentPlayer.currentPrice -= 10;
  await updatePlayer(_currentPlayer);
  _currentState.lastAction = 'priceDown';
  await saveState(_currentState);
  animPrice(_currentPlayer.currentPrice);
  document.getElementById('btn-dec').disabled = _currentPlayer.currentPrice <= _currentPlayer.basePrice;
});

document.getElementById('btn-inc').addEventListener('click', async () => {
  if (!_currentPlayer) return;
  _currentPlayer.currentPrice += 10;
  await updatePlayer(_currentPlayer);
  _currentState.lastAction = 'priceUp';
  await saveState(_currentState);
  animPrice(_currentPlayer.currentPrice);
  document.getElementById('btn-dec').disabled = false;
});

// SOLD — open the confirm sale modal and populate teams
document.getElementById('btn-sold').addEventListener('click', async () => {
  if (!_currentPlayer || _transitioning) return;
  
  document.getElementById('sold-player-name').textContent = _currentPlayer.name;
  document.getElementById('sold-player-price').textContent = fmt(_currentPlayer.currentPrice);
  
  const selBuyingTeam = document.getElementById('sel-buying-team');
  selBuyingTeam.innerHTML = '<option value="">-- Choose Team --</option>';
  
  const teams = await getTeams();
  teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    selBuyingTeam.appendChild(opt);
  });
  
  document.getElementById('modal-sold').classList.add('open');
});

// Confirm sale from modal
document.getElementById('btn-confirm-sale').addEventListener('click', async () => {
  if (!_currentPlayer || _transitioning) return;
  
  const selBuyingTeam = document.getElementById('sel-buying-team');
  const teamId = selBuyingTeam.value;
  
  if (!teamId) {
    toast('Please select a buying team', 'error');
    return;
  }
  
  document.getElementById('btn-confirm-sale').disabled = true;
  document.getElementById('btn-confirm-sale').textContent = 'Confirming...';
  
  _transitioning = true;
  setActionButtons(false);
  
  _currentPlayer.status = 'sold';
  _currentPlayer.team_id = Number(teamId);
  await updatePlayer(_currentPlayer);
  
  let s = await getState();
  s.lastAction = 'sold';
  await saveState(s);
  
  document.getElementById('modal-sold').classList.remove('open');
  document.getElementById('btn-confirm-sale').disabled = false;
  document.getElementById('btn-confirm-sale').textContent = 'Confirm & Mark Sold';
  toast(`🏆 ${_currentPlayer.name} SOLD!`, 'success');
  
  await render();
  setTimeout(async () => {
    await advanceToNext();
    setActionButtons(true);
    _transitioning = false;
  }, OVERLAY_DELAY);
});

// ── Skip / Unsold ─────────────────────────────────────────
document.getElementById('btn-skip').addEventListener('click', async () => {
  if (!_currentPlayer || _transitioning) return;
  _transitioning = true;
  setActionButtons(false);

  _currentPlayer.status = 'unsold';
  _currentPlayer.currentPrice = _currentPlayer.basePrice;
  await updatePlayer(_currentPlayer);
  
  let s = await getState();
  s.lastAction = 'unsold';
  await saveState(s);
  
  toast(`${_currentPlayer.name} marked Unsold`, 'warning');
  
  await render();
  setTimeout(async () => {
    await advanceToNext();
    setActionButtons(true);
    _transitioning = false;
  }, OVERLAY_DELAY);
});

// ── Helper: enable/disable action buttons ─────────────────
function setActionButtons(enabled) {
  ['btn-sold', 'btn-skip', 'btn-inc', 'btn-dec'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

// ── Next Set ──────────────────────────────────────────────
document.getElementById('btn-next-set').addEventListener('click', async () => {
  const cat = elBtnNextSet.dataset.nextCat;
  const setNum = Number(elBtnNextSet.dataset.nextSet);
  
  if (!cat || !setNum) return;
  
  elSelCat.value = cat;
  elSelSet.value = setNum;
  
  document.getElementById('btn-load').click();
});

// ── Load Set Button ──────────────────────────────────────
document.getElementById('btn-load').addEventListener('click', async () => {
  const cat    = elSelCat.value;
  const setNum = Number(elSelSet.value);

  toast(`Shuffling ${cat} Set ${setNum}…`, 'info');

  // 1. Shuffle players in this set (writes sort_order to DB)
  await shuffleSet(cat, setNum);

  // 2. Fetch the now-shuffled queue and take first player
  const queue = await getPendingQueue(cat, setNum);

  const s = await getState();
  s.activeCategory  = cat;
  s.activeSet       = setNum;
  s.currentPlayerId = queue.length ? queue[0].id : null;
  s.lastAction      = 'loadSet';
  s.round           = 1;
  await saveState(s);

  toast(
    queue.length
      ? `🎲 Shuffled & loaded ${queue.length} players from ${cat} Set ${setNum}`
      : `No pending players in ${cat} Set ${setNum}`,
    queue.length ? 'success' : 'info'
  );
  await render();
});

// ── Global Round 2 ────────────────────────────────────────
document.getElementById('btn-start-global-round2').addEventListener('click', async () => {
  if (!confirm('Start Round 2? All unsold players will be re-entered into the auction.')) return;
  
  toast('Preparing Round 2...', 'info');
  const started = await startGlobalRound2();
  
  if (!started) {
    toast('No unsold players available for Round 2', 'warning');
    return;
  }
  
  const allPlayers = await getPlayers();
  const firstSet = getFirstAvailableSetGlobally(allPlayers);
  
  if (firstSet) {
    // Automatically load the first available set for Round 2
    elSelCat.value = firstSet.category;
    elSelSet.value = firstSet.setNumber;
    
    // Explicitly do what 'btn-load' does, but ensure round=2 state
    await shuffleSet(firstSet.category, firstSet.setNumber);
    const queue = await getPendingQueue(firstSet.category, firstSet.setNumber);
    
    const s = await getState();
    s.activeCategory  = firstSet.category;
    s.activeSet       = firstSet.setNumber;
    s.currentPlayerId = queue.length ? queue[0].id : null;
    s.lastAction      = 'round2';
    s.round           = 2;
    await saveState(s);
    
    toast(`🎲 Round 2 started! Loaded ${firstSet.category} Set ${firstSet.setNumber}`, 'success');
  } else {
    toast('Round 2 started but no players found?', 'error');
  }
  
  await render();
});

// ── Reset ─────────────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('Reset auction? This restores the default 20 mock players.')) return;
  toast('Resetting…', 'info');
  await resetAuction();
  toast('Auction reset to defaults', 'success');
  await render();
});

// ── Open/close player modal ──────────────────────────────
function openPlayerModal(mode = 'add', player = null) {
  const modal = document.getElementById('modal-player');
  const title = document.getElementById('modal-player-title');
  const submit = document.getElementById('btn-player-submit');
  const form = document.getElementById('form-player');

  form.reset();
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('f-edit-id').value = '';

  if (mode === 'edit' && player) {
    title.textContent  = 'Edit Player';
    submit.textContent = 'Save Changes';
    document.getElementById('f-edit-id').value   = player.id;
    document.getElementById('f-name').value      = player.name;
    document.getElementById('f-category').value  = player.category;
    document.getElementById('f-set').value       = player.setNumber;
    document.getElementById('f-position').value  = player.position || '';
    document.getElementById('f-club').value      = player.club || '';
    document.getElementById('f-nat').value       = player.nationality || '';
    document.getElementById('f-price').value     = player.basePrice;
    document.getElementById('f-url').value       = player.photo_url || player.photo || '';
    if (player.photo) {
      const prev = document.getElementById('photo-preview');
      prev.src = player.photo;
      prev.style.display = 'block';
    }
  } else {
    title.textContent  = 'Add Player';
    submit.textContent = 'Add to Database';
  }
  modal.classList.add('open');
}

document.getElementById('btn-add-player').addEventListener('click', () => openPlayerModal('add'));

// ── CRUD modal ────────────────────────────────────────────
document.getElementById('btn-manage').addEventListener('click', async () => {
  await renderCrudTable();
  document.getElementById('modal-db').classList.add('open');
});
document.getElementById('btn-db-add').addEventListener('click', () => openPlayerModal('add'));

async function renderCrudTable() {
  const container = document.getElementById('crud-container');
  container.innerHTML = '<p class="empty-state">Loading…</p>';
  const players = await getPlayers();

  if (!players.length) {
    container.innerHTML = '<p class="empty-state">No players found.</p>';
    return;
  }

  const tbl = document.createElement('table');
  tbl.className = 'crud-table';
  tbl.innerHTML = `
    <thead>
      <tr>
        <th></th>
        <th>Name</th>
        <th>Category</th>
        <th>Set</th>
        <th>Position</th>
        <th>Club</th>
        <th>Base</th>
        <th>Status</th>
        <th style="text-align:right;">Actions</th>
      </tr>
    </thead>
    <tbody id="crud-body"></tbody>
  `;

  const tbody = tbl.querySelector('#crud-body');
  players.forEach(p => {
    const tr = document.createElement('tr');
    const badgeClass = p.status === 'sold' ? 'badge-green' : p.status === 'unsold' ? 'badge-red' : 'badge-muted';
    tr.innerHTML = `
      <td><img src="${p.photo || ''}" alt="" onerror="this.src='https://i.pravatar.cc/64?u=${p.id}'" /></td>
      <td class="fw-600">${p.name}</td>
      <td><span class="badge badge-gold">${p.category}</span></td>
      <td class="text-muted">Set ${p.setNumber}</td>
      <td class="text-muted">${p.position || '—'}</td>
      <td class="text-muted">${p.club || '—'}</td>
      <td class="text-gold fw-600">${fmt(p.basePrice)}</td>
      <td><span class="badge ${badgeClass}">${p.status}</span></td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn btn-ghost btn-sm btn-edit" data-id="${p.id}">✏ Edit</button>
        <button class="btn btn-danger btn-sm btn-del" data-id="${p.id}" style="margin-left:4px;">🗑</button>
      </td>
    `;
    tr.querySelector('.btn-edit').addEventListener('click', () => { openPlayerModal('edit', p); });
    tr.querySelector('.btn-del').addEventListener('click',  () => confirmDel(p.id, p.name));
    tbody.appendChild(tr);
  });

  container.innerHTML = '';
  container.appendChild(tbl);
}

async function confirmDel(id, name) {
  if (!confirm(`Delete ${name} from the database?`)) return;
  
  // Prevent Foreign Key violation: if this player is currently active in the auction state, 
  // we must advance to the next player BEFORE deleting them from the database.
  const s = await getState();
  let wasCurrent = false;
  if (s.currentPlayerId === id) {
    wasCurrent = true;
    await advanceToNext(); // This changes currentPlayerId to someone else or null
  }

  const ok = await deletePlayer(id);
  
  if (ok) {
    toast(`${name} deleted`, 'success');
    await renderCrudTable();
    if (!wasCurrent) await render();
  } else {
    // If delete fails, we might want to revert the advance, but typically it's fine.
    toast('Delete failed', 'error');
  }
}

// ── Form submit (Add + Edit) ──────────────────────────────
document.getElementById('form-player').addEventListener('submit', async e => {
  e.preventDefault();

  const editId   = document.getElementById('f-edit-id').value;
  const name     = document.getElementById('f-name').value.trim();
  const category = document.getElementById('f-category').value;
  const setNum   = Number(document.getElementById('f-set').value);
  const position = document.getElementById('f-position').value.trim();
  const club     = document.getElementById('f-club').value.trim();
  const nat      = document.getElementById('f-nat').value.trim();
  const price    = Number(document.getElementById('f-price').value);
  const urlInput = document.getElementById('f-url').value.trim();
  const fileInput = document.getElementById('f-file');

  if (!name || !price) { toast('Name and base price are required', 'error'); return; }

  const btn = document.getElementById('btn-player-submit');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  let finalUrl = urlInput;

  // Upload to Supabase Storage if a file was picked
  if (fileInput.files.length > 0) {
    const file    = fileInput.files[0];
    const ext     = file.name.split('.').pop();
    const fname   = `player-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('player-images').upload(fname, file);
    if (upErr) {
      toast('Photo upload failed — using URL/placeholder', 'warning');
    } else {
      const { data: { publicUrl } } = supabase.storage.from('player-images').getPublicUrl(fname);
      finalUrl = publicUrl;
    }
  }

  if (editId) {
    // UPDATE
    const orig = await getPlayerById(editId);
    await updatePlayer({
      id:           editId,
      name, category, setNumber: setNum, position, club,
      nationality:  nat,
      basePrice:    price,
      currentPrice: orig ? orig.currentPrice : price,
      status:       orig ? orig.status : 'pending',
      round:        orig ? orig.round : 1,
      photo:        finalUrl || (orig ? orig.photo : null)
    });
    toast(`${name} updated`, 'success');
  } else {
    // CREATE
    const newP = await addPlayer({ name, category, setNumber: setNum, position, club, nationality: nat, basePrice: price, photo: finalUrl });
    if (newP) {
      toast(`${newP.name} added to database`, 'success');
      // Auto-set as current if queue was empty
      const s = await getState();
      if (!s.currentPlayerId && newP.category === (s.activeCategory || 'Forwards') && newP.setNumber === (s.activeSet || 1)) {
        s.currentPlayerId = newP.id;
        s.lastAction = 'playerAdded';
        await saveState(s);
      }
    } else {
      toast('Failed to add player', 'error');
    }
  }

  btn.disabled = false;
  btn.textContent = editId ? 'Save Changes' : 'Add to Database';
  document.getElementById('modal-player').classList.remove('open');
  e.target.reset();
  document.getElementById('photo-preview').style.display = 'none';

  // If CRUD modal is open, refresh it
  if (document.getElementById('modal-db').classList.contains('open')) await renderCrudTable();
  await render();
});

// ── Photo preview ─────────────────────────────────────────
document.getElementById('f-url').addEventListener('input', e => {
  const prev = document.getElementById('photo-preview');
  prev.src = e.target.value;
  prev.style.display = e.target.value ? 'block' : 'none';
});
document.getElementById('f-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const prev = document.getElementById('photo-preview');
  const reader = new FileReader();
  reader.onload = ev => { prev.src = ev.target.result; prev.style.display = 'block'; };
  reader.readAsDataURL(file);
});

// ── Real-time subscriptions ───────────────────────────────
supabase.channel('admin-rt')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, async () => {
    await render();
    if (document.getElementById('modal-db').classList.contains('open')) await renderCrudTable();
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_state' }, async () => {
    await render();
  })
  .subscribe();

// ══════════════════════════════════════════════════════════
// ── TEAMS CRUD ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

document.getElementById('btn-teams').addEventListener('click', async () => {
  await renderTeamsCrudTable();
  document.getElementById('modal-teams').classList.add('open');
});

document.getElementById('btn-team-add').addEventListener('click', () => {
  document.getElementById('modal-team-title').textContent = 'Add Team';
  document.getElementById('f-team-id').value = '';
  document.getElementById('f-team-name').value = '';
  document.getElementById('f-team-logo').value = '';
  document.getElementById('btn-team-submit').textContent = 'Add Team';
  document.getElementById('modal-team-form').classList.add('open');
});

async function renderTeamsCrudTable() {
  const container = document.getElementById('teams-crud-container');
  container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-3);">Loading teams...</div>';
  
  const teams = await getTeams();
  if (teams.length === 0) {
    container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-3);">No teams in database.</div>';
    return;
  }
  
  const tbl = document.createElement('table');
  tbl.className = 'crud-table';
  tbl.innerHTML = `
    <thead>
      <tr>
        <th style="width:48px;">Logo</th>
        <th>Team Name</th>
        <th style="text-align:right;">Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = tbl.querySelector('tbody');
  
  teams.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img src="${t.logo_url || `https://i.pravatar.cc/100?u=team${t.id}`}" alt="${t.name}" onerror="this.src='https://i.pravatar.cc/100?u=team${t.id}'" /></td>
      <td class="fw-600">${t.name}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="btn btn-ghost btn-sm btn-edit-team" data-id="${t.id}">✏ Edit</button>
        <button class="btn btn-danger btn-sm btn-del-team" data-id="${t.id}" style="margin-left:4px;">🗑</button>
      </td>
    `;
    tr.querySelector('.btn-edit-team').addEventListener('click', () => {
      document.getElementById('modal-team-title').textContent = 'Edit Team';
      document.getElementById('f-team-id').value = t.id;
      document.getElementById('f-team-name').value = t.name;
      document.getElementById('f-team-logo').value = t.logo_url || '';
      document.getElementById('btn-team-submit').textContent = 'Save Changes';
      document.getElementById('modal-team-form').classList.add('open');
    });
    tr.querySelector('.btn-del-team').addEventListener('click', async () => {
      if (!confirm(`Delete ${t.name}?`)) return;
      try {
        await deleteTeam(t.id);
        toast(`Team ${t.name} deleted`, 'success');
        await renderTeamsCrudTable();
      } catch (err) {
        toast('Failed to delete team', 'error');
      }
    });
    tbody.appendChild(tr);
  });
  
  container.innerHTML = '';
  container.appendChild(tbl);
}

document.getElementById('form-team').addEventListener('submit', async e => {
  e.preventDefault();
  
  const id = document.getElementById('f-team-id').value;
  const name = document.getElementById('f-team-name').value.trim();
  const logo_url = document.getElementById('f-team-logo').value.trim();
  
  if (!name) { toast('Team name is required', 'error'); return; }
  
  const btn = document.getElementById('btn-team-submit');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  
  try {
    if (id) {
      await updateTeam(id, { name, logo_url });
      toast('Team updated', 'success');
    } else {
      await addTeam({ name, logo_url });
      toast('Team added', 'success');
    }
    document.getElementById('modal-team-form').classList.remove('open');
    await renderTeamsCrudTable();
  } catch (err) {
    toast('Error saving team', 'error');
  }
  
  btn.disabled = false;
});

// ── Init ─────────────────────────────────────────────────
(async () => {
  await initStorage();
  await render();
})();
