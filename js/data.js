// ============================================================
// data.js — Mock player data and Supabase API integration
// ============================================================

const MOCK_PLAYERS = [
  { name: "Lionel Messi", position: "Forward", club: "Inter Miami", nationality: "Argentina", photo_url: "https://i.pravatar.cc/400?img=1", base_price: 100, current_price: 100, status: "pending", round: 1, category: "Forwards", set_number: 1 },
  { name: "Cristiano Ronaldo", position: "Forward", club: "Al Nassr", nationality: "Portugal", photo_url: "https://i.pravatar.cc/400?img=2", base_price: 90, current_price: 90, status: "pending", round: 1, category: "Forwards", set_number: 1 },
  { name: "Kylian Mbappé", position: "Forward", club: "Real Madrid", nationality: "France", photo_url: "https://i.pravatar.cc/400?img=3", base_price: 120, current_price: 120, status: "pending", round: 1, category: "Forwards", set_number: 1 },
  { name: "Erling Haaland", position: "Striker", club: "Man City", nationality: "Norway", photo_url: "https://i.pravatar.cc/400?img=4", base_price: 110, current_price: 110, status: "pending", round: 1, category: "Forwards", set_number: 1 },
  { name: "Vinicius Jr.", position: "Winger", club: "Real Madrid", nationality: "Brazil", photo_url: "https://i.pravatar.cc/400?img=5", base_price: 100, current_price: 100, status: "pending", round: 1, category: "Forwards", set_number: 2 },
  { name: "Kevin De Bruyne", position: "Midfielder", club: "Man City", nationality: "Belgium", photo_url: "https://i.pravatar.cc/400?img=6", base_price: 90, current_price: 90, status: "pending", round: 1, category: "Midfielders", set_number: 1 },
  { name: "Rodri", position: "Midfielder", club: "Man City", nationality: "Spain", photo_url: "https://i.pravatar.cc/400?img=7", base_price: 80, current_price: 80, status: "pending", round: 1, category: "Midfielders", set_number: 1 },
  { name: "Lamine Yamal", position: "Winger", club: "Barcelona", nationality: "Spain", photo_url: "https://i.pravatar.cc/400?img=8", base_price: 70, current_price: 70, status: "pending", round: 1, category: "Forwards", set_number: 2 },
  { name: "Pedri", position: "Midfielder", club: "Barcelona", nationality: "Spain", photo_url: "https://i.pravatar.cc/400?img=9", base_price: 80, current_price: 80, status: "pending", round: 1, category: "Midfielders", set_number: 2 },
  { name: "Jude Bellingham", position: "Midfielder", club: "Real Madrid", nationality: "England", photo_url: "https://i.pravatar.cc/400?img=10", base_price: 100, current_price: 100, status: "pending", round: 1, category: "Midfielders", set_number: 1 },
  { name: "Mohamed Salah", position: "Winger", club: "Liverpool", nationality: "Egypt", photo_url: "https://i.pravatar.cc/400?img=11", base_price: 85, current_price: 85, status: "pending", round: 1, category: "Forwards", set_number: 2 },
  { name: "Bukayo Saka", position: "Winger", club: "Arsenal", nationality: "England", photo_url: "https://i.pravatar.cc/400?img=12", base_price: 75, current_price: 75, status: "pending", round: 1, category: "Forwards", set_number: 2 },
  { name: "Harry Kane", position: "Striker", club: "Bayern Munich", nationality: "England", photo_url: "https://i.pravatar.cc/400?img=13", base_price: 90, current_price: 90, status: "pending", round: 1, category: "Forwards", set_number: 1 },
  { name: "Trent Alexander-Arnold", position: "Defender", club: "Real Madrid", nationality: "England", photo_url: "https://i.pravatar.cc/400?img=14", base_price: 70, current_price: 70, status: "pending", round: 1, category: "Defenders", set_number: 1 },
  { name: "Phil Foden", position: "Midfielder", club: "Man City", nationality: "England", photo_url: "https://i.pravatar.cc/400?img=15", base_price: 85, current_price: 85, status: "pending", round: 1, category: "Midfielders", set_number: 2 },
  { name: "Raphinha", position: "Winger", club: "Barcelona", nationality: "Brazil", photo_url: "https://i.pravatar.cc/400?img=16", base_price: 60, current_price: 60, status: "pending", round: 1, category: "Forwards", set_number: 3 },
  { name: "Gavi", position: "Midfielder", club: "Barcelona", nationality: "Spain", photo_url: "https://i.pravatar.cc/400?img=17", base_price: 70, current_price: 70, status: "pending", round: 1, category: "Midfielders", set_number: 2 },
  { name: "Ruben Dias", position: "Defender", club: "Man City", nationality: "Portugal", photo_url: "https://i.pravatar.cc/400?img=18", base_price: 65, current_price: 65, status: "pending", round: 1, category: "Defenders", set_number: 1 },
  { name: "Robert Lewandowski", position: "Striker", club: "Barcelona", nationality: "Poland", photo_url: "https://i.pravatar.cc/400?img=19", base_price: 80, current_price: 80, status: "pending", round: 1, category: "Forwards", set_number: 2 },
  { name: "Alisson Becker", position: "Goalkeeper", club: "Liverpool", nationality: "Brazil", photo_url: "https://i.pravatar.cc/400?img=20", base_price: 60, current_price: 60, status: "pending", round: 1, category: "Goalkeepers", set_number: 1 },
];

/** Helper mapping function to maintain backward-compatibility with existing camelCase logic */
function mapPlayerDbToJs(p) {
  if (!p) return null;
  return {
    ...p,
    photo: p.photo_url,
    basePrice: Number(p.base_price),
    currentPrice: Number(p.current_price),
    setNumber: Number(p.set_number)
  };
}

/** Initialise Supabase database if empty */
async function initStorage() {
  try {
    const { data: stateData, error: stateError } = await supabase
      .from('auction_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (stateError) throw stateError;

    if (!stateData) {
      // Find first pending forward of set 1
      const { data: firstPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('status', 'pending')
        .eq('category', 'Forwards')
        .eq('set_number', 1)
        .order('name')
        .limit(1)
        .maybeSingle();

      const { error: stateInsertError } = await supabase
        .from('auction_state')
        .insert({
          id: 1,
          current_player_id: firstPlayer ? firstPlayer.id : null,
          active_category: 'Forwards',
          active_set: 1,
          round: 1,
          last_action: 'init'
        });
      if (stateInsertError) throw stateInsertError;
    }
  } catch (err) {
    console.error("Error in initStorage:", err.message || err, err.details, err.hint, err.code);
  }
}

/** Get all players from storage */
async function getPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');
  if (error) {
    console.error("Error fetching players:", error);
    return [];
  }
  return data.map(mapPlayerDbToJs);
}

/** Get a single player by id */
async function getPlayerById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error(`Error fetching player by id ${id}:`, error);
    return null;
  }
  return mapPlayerDbToJs(data);
}

/** Get current auction state */
async function getState() {
  const { data, error } = await supabase
    .from('auction_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    console.error("Error fetching auction state:", error);
    return {};
  }

  if (!data) return {};

  // Return unified camelCase state format for compatibility
  return {
    currentPlayerId: data.current_player_id,
    activeCategory:  data.active_category,
    activeSet:       Number(data.active_set),
    round:           Number(data.round),
    lastAction:      data.last_action,
    ts:              data.updated_at  // raw ISO string — used as dedup key
  };
}

/** Save auction state */
async function saveState(state) {
  const updateData = {
    current_player_id: state.currentPlayerId !== undefined ? state.currentPlayerId : state.current_player_id,
    active_category: state.activeCategory !== undefined ? state.activeCategory : state.active_category,
    active_set: state.activeSet !== undefined ? Number(state.activeSet) : state.active_set,
    round: state.round !== undefined ? Number(state.round) : state.round,
    last_action: state.lastAction !== undefined ? state.lastAction : state.last_action,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('auction_state')
    .update(updateData)
    .eq('id', 1);

  if (error) {
    console.error("Error saving auction state:", error);
  }
}

/** Return the current player object */
async function getCurrentPlayer() {
  const state = await getState();
  if (!state || !state.currentPlayerId) return null;
  return await getPlayerById(state.currentPlayerId);
}

/** Fisher-Yates shuffle helper */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shuffle all pending players in a category+set and write their
 * sort_order to the DB so both admin & display see the same order.
 */
async function shuffleSet(category, setNumber) {
  // Fetch all pending players in this set
  const { data, error } = await supabase
    .from('players')
    .select('id')
    .eq('status', 'pending')
    .eq('category', category)
    .eq('set_number', Number(setNumber));

  if (error) {
    console.error('Error fetching players for shuffle:', error);
    return;
  }

  if (!data || !data.length) return;

  const shuffled = shuffleArray(data);

  // Write sort_order for each player (1-based)
  const updates = shuffled.map((p, i) =>
    supabase.from('players').update({ sort_order: i + 1 }).eq('id', p.id)
  );

  await Promise.all(updates);
  console.log(`Shuffled ${shuffled.length} players in ${category} Set ${setNumber}`);
}

/** Get all pending players for the current category & set — ordered by sort_order */
async function getPendingQueue(category, setNumber) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('status', 'pending')
    .eq('category', category)
    .eq('set_number', Number(setNumber))
    .order('sort_order', { ascending: true })
    .order('name',       { ascending: true }); // tiebreak for un-shuffled players
  if (error) {
    console.error('Error fetching pending queue:', error);
    return [];
  }
  return data.map(mapPlayerDbToJs);
}

/** Get next pending player after current inside selected category and set */
async function getNextPendingPlayer(currentId, category, setNumber) {
  const queue = await getPendingQueue(category, setNumber);
  if (!queue.length) return null;
  const idx = queue.findIndex(p => p.id === currentId);
  if (idx === -1) return queue[0];
  return queue[idx + 1] || null;
}

/** Update a single player in storage */
async function updatePlayer(updatedPlayer) {
  const updateData = {
    name: updatedPlayer.name,
    club: updatedPlayer.club,
    nationality: updatedPlayer.nationality,
    position: updatedPlayer.position,
    category: updatedPlayer.category,
    set_number: Number(updatedPlayer.setNumber !== undefined ? updatedPlayer.setNumber : updatedPlayer.set_number),
    base_price: Number(updatedPlayer.basePrice !== undefined ? updatedPlayer.basePrice : updatedPlayer.base_price),
    current_price: Number(updatedPlayer.currentPrice !== undefined ? updatedPlayer.currentPrice : updatedPlayer.current_price),
    status: updatedPlayer.status,
    photo_url: updatedPlayer.photo !== undefined ? updatedPlayer.photo : updatedPlayer.photo_url,
    round: Number(updatedPlayer.round || 1),
    team_id: updatedPlayer.team_id !== undefined ? updatedPlayer.team_id : null
  };

  const { error } = await supabase
    .from('players')
    .update(updateData)
    .eq('id', updatedPlayer.id);

  if (error) {
    console.error(`Error updating player ${updatedPlayer.id}:`, error);
  }
}

/** Add a brand-new player */
async function addPlayer(playerData) {
  const player = {
    name: playerData.name,
    position: playerData.position || "Unknown",
    club: playerData.club || "Free Agent",
    nationality: playerData.nationality || "Unknown",
    category: playerData.category || "Forwards",
    set_number: Number(playerData.setNumber || playerData.set_number || 1),
    base_price: Number(playerData.basePrice || playerData.base_price || 50),
    current_price: Number(playerData.basePrice || playerData.base_price || 50),
    status: "pending",
    photo_url: playerData.photo || playerData.photo_url || null,
    round: Number(playerData.round || 1),
  };

  const { data, error } = await supabase
    .from('players')
    .insert(player)
    .select()
    .single();

  if (error) {
    console.error("Error adding new player:", error.message || error, error.details, error.hint, error.code);
    return null;
  }
  return mapPlayerDbToJs(data);
}

/** Delete a player by ID (CRUD) */
async function deletePlayer(id) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`Error deleting player ${id}:`, error);
    return false;
  }
  return true;
}

/** Reset auction completely */
async function resetAuction() {
  try {
    // Reset all existing players back to starting values instead of deleting them
    const allPlayers = await getPlayers();
    
    if (allPlayers.length > 0) {
      const updates = allPlayers.map(p => 
        supabase.from('players').update({
          status: 'pending',
          round: 1,
          team_id: null,
          current_price: Number(p.basePrice)
        }).eq('id', p.id)
      );
      await Promise.all(updates);
    }

    const state = {
      current_player_id: null,
      active_category: 'Forwards',
      active_set: 1,
      round: 1,
      last_action: 'reset',
      updated_at: new Date().toISOString()
    };

    const { error: stateError } = await supabase
      .from('auction_state')
      .update(state)
      .eq('id', 1);

    if (stateError) throw stateError;
    return true;
  } catch (err) {
    console.error("Error resetting auction:", err);
    return false;
  }
}

/** Helper to get next available set within the SAME category */
function getNextAvailableSetInSameCategory(cat, allPlayers) {
  const pendingInCat = allPlayers.filter(p => p.category === cat && p.status === 'pending');
  if (pendingInCat.length > 0) {
    const setNumbers = pendingInCat.map(p => p.setNumber);
    return { category: cat, setNumber: Math.min(...setNumbers) };
  }
  return null;
}

/** Helper to get a list of all categories that still have pending players */
function getAvailableCategories(allPlayers) {
  const categories = ['Forwards', 'Midfielders', 'Defenders', 'Goalkeepers'];
  return categories.filter(cat => 
    allPlayers.some(p => p.category === cat && p.status === 'pending')
  );
}

/** Helper to get the absolute first available set for global round 2 */
function getFirstAvailableSetGlobally(allPlayers) {
  const categories = ['Forwards', 'Midfielders', 'Defenders', 'Goalkeepers'];
  for (const cat of categories) {
    const next = getNextAvailableSetInSameCategory(cat, allPlayers);
    if (next) return next;
  }
  return null;
}

/** Helper to get auction summary stats */
function getAuctionSummary(allPlayers) {
  const sold = allPlayers.filter(p => p.status === 'sold');
  const unsold = allPlayers.filter(p => p.status === 'unsold');
  const totalSpent = sold.reduce((sum, p) => sum + p.currentPrice, 0);
  
  return {
    soldCount: sold.length,
    unsoldCount: unsold.length,
    totalSpent: totalSpent
  };
}

/** Global Round 2: Re-enter all unsold players */
async function startGlobalRound2() {
  const allPlayers = await getPlayers();
  const summary = getAuctionSummary(allPlayers);
  if (summary.unsoldCount === 0) return false;

  const updates = allPlayers.filter(p => p.status === 'unsold').map(p => 
    supabase.from('players').update({
      status: 'pending',
      round: 2,
      current_price: Number(p.basePrice)
    }).eq('id', p.id)
  );
  
  await Promise.all(updates);
  return true;
}

// ─────────────────────────────────────────────────────────
// ── Teams CRUD Operations ──
// ─────────────────────────────────────────────────────────

async function getTeams() {
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) { console.error('getTeams error:', error); return []; }
  return data || [];
}

async function addTeam(team) {
  const { data, error } = await supabase.from('teams').insert([team]).select();
  if (error) { console.error('addTeam error:', error); throw error; }
  return data[0];
}

async function updateTeam(id, updates) {
  const { data, error } = await supabase.from('teams').update(updates).eq('id', id).select();
  if (error) { console.error('updateTeam error:', error); throw error; }
  return data[0];
}

async function deleteTeam(id) {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) { console.error('deleteTeam error:', error); throw error; }
}
