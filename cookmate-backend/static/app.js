const state = { 
  currentView: 'home', 
  currentUser: null, 
  recipes: [], 
  allRecipes: [], 
  selectedRecipe: null, 
  pendingRoute: null,
  voiceMode: {
    active: false,
    currentStep: 0,
    recognition: null,
    synthesis: null
  }
}; 

const API = 'http://localhost:5000'; 
let currentUtterance = null;

// DOM Helpers 
const qs = (s, el = document) => el.querySelector(s); 
const qsa = (s, el = document) => Array.from(el.querySelectorAll(s)); 
const on = (el, ev, fn) => el && el.addEventListener(ev, fn); 

// UTILS 
function escapeHtml(s) { 
  if (!s && s !== 0) return ''; 
  return String(s) 
    .replace(/&/g,'&amp;') 
    .replace(/</g,'&lt;') 
    .replace(/>/g,'&gt;') 
    .replace(/\"/g,'&quot;') 
    .replace(/'/g,'&#39;'); 
} 

function getRecipeImageUrl(recipe) { 
  if (!recipe) return `${API}/static/images/default-recipe.jpg`; 
  if (!recipe.img) { 
    const name = (recipe.title || recipe.name || 'default-recipe').toLowerCase().replace(/ /g, '_'); 
    return `${API}/static/images/${name}.jpg`; 
  } 
  return recipe.img.startsWith('/') ? `${API}${recipe.img}` : `${API}/static/images/${recipe.img}`; 
} 

function setActiveNav(route) { 
  qsa('.side-btn, .nav-link').forEach(el => el.classList.toggle('active', el.dataset.route === route)); 
} 

// INITIALIZATION 
document.addEventListener('DOMContentLoaded', async () => { 
  initUIBindings(); 
  setupAuth(); 
  setupVoiceRecognition(); 
  setupSearch(); 
  setupLogoutBinding(); 
  initVoiceMode();
  await fetchRecipes(); 
  const path = window.location.pathname.slice(1) || 'home'; 
  const validViews = ['home','recipes','recipe-detail','pantry','profile','feedback','admin']; 
  const route = validViews.includes(path) ? path : 'home'; 
  navigateToRoute(route); 
  window.addEventListener('popstate', () => { 
    const route = window.location.pathname.slice(1) || 'home'; 
    navigateToRoute(route); 
  }); 
}); 

// UI BINDINGS 
function initUIBindings() { 
  document.addEventListener('click', (e) => { 
    const navItem = e.target.closest('[data-route]'); 
    if (navItem) { 
      e.preventDefault(); 
      navigateToRoute(navItem.dataset.route); 
      return; 
    } 
    const card = e.target.closest('.recipe-card'); 
    if (card) { 
      const id = card.dataset.id; 
      const recipe = state.recipes.find(r => r.id === id); 
      if (recipe) { 
        state.selectedRecipe = recipe; 
        navigateToRoute('recipe-detail'); 
      } 
    } 
    if (e.target.matches('.pantry-delete')) { 
      deletePantryItem(e.target.dataset.id); 
    } 
  }); 
  on(qs('#addPantryBtn'), 'click', () => { 
    const name = qs('#pantryInput')?.value?.trim(); 
    const expiry = qs('#pantryExpiry')?.value || 7; 
    if (!name) return alert('Enter item name'); 
    if (!state.currentUser) { 
      state.pendingRoute = 'pantry'; 
      showAuthModal(); 
      return; 
    } 
    addPantryItem(name, expiry); 
    qs('#pantryInput').value = ''; 
  }); 
  on(qs('#submitFb'), 'click', async () => { 
    const text = qs('#fbText')?.value?.trim(); 
    if (!text) return alert('Enter feedback'); 
    try { 
      await fetch(`${API}/api/feedback`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ user: state.currentUser?.email || 'guest', text }) 
      }); 
      alert('Thanks. Feedback submitted.'); 
      if (qs('#fbText')) qs('#fbText').value = ''; 
    } catch (err) { 
      alert('Failed to submit feedback'); 
    } 
  }); 
} 

// ROUTING 
function navigateToRoute(route) { 
  if (!route) route = 'home'; 
  const view = qs(`#${route}`); 
  if (!view) return; 
  const protectedRoutes = ['pantry', 'profile', 'feedback', 'admin']; 
  if (protectedRoutes.includes(route) && !state.currentUser) { 
    state.pendingRoute = route; 
    showAuthModal(); 
    return; 
  } 
  if (route === 'admin' && !state.currentUser?.isAdmin) { 
    alert('Access denied – admin only'); 
    route = 'home'; 
  } 
  
  // Stop voice mode when navigating away from recipe-detail
  if (state.currentView === 'recipe-detail' && route !== 'recipe-detail') {
    stopVoiceMode();
  }
  
  try { 
    window.history.pushState({}, '', `/${route}`); 
  } catch {} 
  qsa('.view').forEach(v => { 
    v.classList.remove('active'); 
    v.style.display = 'none'; 
  }); 
  view.classList.add('active'); 
  view.style.display = 'block'; 
  setActiveNav(route); 
  renderContent(route); 
  state.currentView = route; 
  window.scrollTo(0, 0); 
} 

// RENDERING 
function renderContent(route) { 
  switch (route) { 
    case 'home': 
      renderFeatured(); 
      break; 
    case 'recipes': 
      renderRecipes(); 
      break; 
    case 'recipe-detail': 
      if (state.selectedRecipe) renderRecipeDetail(state.selectedRecipe); 
      break; 
    case 'pantry': 
      renderPantry(); 
      break; 
    case 'profile': 
      renderProfile(); 
      break; 
    case 'feedback': 
      renderFeedback(); 
      break; 
    case 'admin': 
      renderAdmin(); 
      break; 
  } 
} 

// FETCH DATA 
async function fetchRecipes() { 
  try { 
    const res = await fetch(`${API}/api/recipes`); 
    if (!res.ok) throw new Error('Failed to fetch recipes'); 
    const data = await res.json(); 
    state.recipes = data.map(r => ({ 
      ...r, 
      id: (r.id || (r.name || r.title || '').toLowerCase().replace(/ /g, '-')) 
    })); 
    state.allRecipes = [...state.recipes]; 
  } catch (err) { 
    // silent
  } 
} 

// FEATURED + RECIPES 
function renderFeatured() { 
  const grid = qs('#featuredGrid'); 
  if (!grid) return; 
  const featured = state.recipes.slice(0, 6); 
  grid.innerHTML = featured.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <div class="recipe-img" style="background-image:url('${getRecipeImageUrl(r)}')"></div>
      <div class="recipe-info">
        <div class="recipe-title">${escapeHtml(r.title || r.name)}</div>
        <div class="recipe-meta">
          <span>🕐 ${escapeHtml(r.time || '30')} min</span>
          <span>🌍 ${escapeHtml(r.cuisine || 'Indian')}</span>
        </div>
      </div>
    </div>
  `).join(''); 
} 

function renderRecipes() { 
  const container = qs('#recipesList'); 
  if (!container) return; 
  if (!state.recipes.length) { 
    container.innerHTML = '<p class="muted">No recipes available</p>'; 
    return; 
  } 
  container.innerHTML = `
    <div class="grid">
      ${state.recipes.map(r => `
        <div class="recipe-card" data-id="${r.id}">
          <div class="recipe-img" style="background-image:url('${getRecipeImageUrl(r)}')"></div>
          <div class="recipe-info">
            <div class="recipe-title">${escapeHtml(r.title || r.name)}</div>
            <div class="recipe-meta">
              <span>🕐 ${escapeHtml(r.time || '30')} min</span>
              <span>🌍 ${escapeHtml(r.cuisine || 'Indian')}</span>
              <span>⚡ ${escapeHtml(r.difficulty || 'Easy')}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `; 
} 

// RECIPE DETAIL WITH VOICE MODE
function renderRecipeDetail(recipe) { 
  const container = qs('#recipeDetail'); 
  if (!container) return; 
  
  const steps = recipe.steps || []; 
  const ingredients = recipe.ingredients || []; 
  
  container.innerHTML = `
    <div class="card">
      <div style="display:flex; gap:20px; align-items:start; flex-wrap:wrap;">
        <img src="${getRecipeImageUrl(recipe)}" alt="${escapeHtml(recipe.name)}" 
             style="width:100%; max-width:400px; border-radius:12px; object-fit:cover;">
        <div style="flex:1; min-width:300px;">
          <h2 style="margin-top:0; color:var(--accent);">${escapeHtml(recipe.name || recipe.title)}</h2>
          <div class="recipe-meta" style="gap:16px; font-size:15px; margin-bottom:16px;">
            <span>🕐 ${escapeHtml(recipe.time || '30')} min</span>
            <span>🌍 ${escapeHtml(recipe.cuisine || 'Indian')}</span>
            <span>⚡ ${escapeHtml(recipe.difficulty || 'Easy')}</span>
          </div>
          
          <div style="margin-top:20px;">
            <button id="startVoiceMode" class="btn primary" style="font-size:16px; padding:14px 24px;">
              🎙️ Start Voice Mode
            </button>
            <p class="muted" style="margin-top:8px; font-size:13px;">
              Voice commands: "next", "repeat", "back", "stop"
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>📝 Ingredients</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:8px;">
        ${ingredients.map(ing => `
          <div style="padding:8px; background:#f8fafc; border-radius:6px; font-size:14px;">
            ✓ ${escapeHtml(typeof ing === 'string' ? ing : ing.name || ing)}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h3>👨‍🍳 Cooking Steps</h3>
      <div id="voice-status" class="voice-status" style="display:none;">
        <div class="voice-indicator"></div>
        <span id="voice-status-text">Voice mode active - Say "next", "repeat", "back", or "stop"</span>
      </div>
      <div id="stepsContainer">
        ${steps.map((step, i) => `
          <div class="step" data-step="${i}" id="step-${i}">
            <strong style="color:var(--accent);">Step ${i + 1}:</strong> ${escapeHtml(step)}
          </div>
        `).join('')}
      </div>
    </div>

    ${recipe.alternatives && recipe.alternatives.length ? `
      <div class="card">
        <h3>🔄 Alternative Ingredients</h3>
        <div style="font-size:14px; line-height:1.8;">
          ${recipe.alternatives.map(alt => `<div>• ${escapeHtml(alt)}</div>`).join('')}
        </div>
      </div>
    ` : ''}
  `; 
  
  // Bind voice mode button
  const startBtn = qs('#startVoiceMode');
  if (startBtn) {
    on(startBtn, 'click', toggleVoiceMode);
  }
} 

// VOICE MODE FUNCTIONALITY
function initVoiceMode() {
  // Speech synthesis
  if ('speechSynthesis' in window) {
    state.voiceMode.synthesis = window.speechSynthesis;
  }
  // Speech recognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.voiceMode.recognition = new SpeechRecognition();
    state.voiceMode.recognition.continuous = true;
    state.voiceMode.recognition.interimResults = false;
    state.voiceMode.recognition.lang = 'en-US';
    
    state.voiceMode.recognition.onresult = handleVoiceCommand;
    state.voiceMode.recognition.onerror = (event) => {
      if (event.error === 'no-speech' && state.voiceMode.active) {
        try { state.voiceMode.recognition.start(); } catch {}
      }
    };
    state.voiceMode.recognition.onend = () => {
      if (state.voiceMode.active) {
        try { state.voiceMode.recognition.start(); } catch {}
      }
    };
  }
}

function toggleVoiceMode() {
  if (state.voiceMode.active) {
    stopVoiceMode();
  } else {
    startVoiceMode();
  }
}

function startVoiceMode() {
  if (!state.selectedRecipe || !state.selectedRecipe.steps || !state.selectedRecipe.steps.length) {
    alert('No recipe steps available for voice mode');
    return;
  }
  if (!state.voiceMode.synthesis) {
    alert('Text-to-speech is not supported in your browser');
    return;
  }
  if (!state.voiceMode.recognition) {
    alert('Voice recognition is not supported in your browser');
    return;
  }
  state.voiceMode.active = true;
  state.voiceMode.currentStep = 0;

  const startBtn = qs('#startVoiceMode');
  if (startBtn) {
    startBtn.innerHTML = '⏸️ Stop Voice Mode';
    startBtn.classList.add('active-voice');
  }
  const voiceStatus = qs('#voice-status');
  if (voiceStatus) {
    voiceStatus.style.display = 'flex';
  }

  try { state.voiceMode.recognition.start(); } catch {}

  const recipeName = state.selectedRecipe.name || state.selectedRecipe.title;
  speak(`Starting voice mode for ${recipeName}. I will read the steps. Say next for the next step, repeat to hear again, back for previous step, or stop to exit.`);
  setTimeout(() => { readCurrentStep(); }, 5000);
}

function stopVoiceMode() {
  state.voiceMode.active = false;
  if (state.voiceMode.synthesis) state.voiceMode.synthesis.cancel();
  if (state.voiceMode.recognition) {
    try { state.voiceMode.recognition.stop(); } catch {}
  }
  const startBtn = qs('#startVoiceMode');
  if (startBtn) {
    startBtn.innerHTML = '🎙️ Start Voice Mode';
    startBtn.classList.remove('active-voice');
  }
  const voiceStatus = qs('#voice-status');
  if (voiceStatus) voiceStatus.style.display = 'none';
  qsa('.step').forEach(step => step.classList.remove('active-step'));
}

function readCurrentStep() {
  if (!state.voiceMode.active || !state.selectedRecipe) return;
  const steps = state.selectedRecipe.steps || [];
  const currentStep = state.voiceMode.currentStep;
  if (currentStep >= steps.length) {
    speak('You have completed all the steps. Recipe is done. Say stop to exit voice mode.');
    return;
  }
  qsa('.step').forEach((step, i) => {
    if (i === currentStep) {
      step.classList.add('active-step');
      step.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      step.classList.remove('active-step');
    }
  });
  const stepText = steps[currentStep];
  speak(`Step ${currentStep + 1}. ${stepText}`);
}

function speak(text) {
  if (!state.voiceMode.synthesis) return;
  state.voiceMode.synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = state.currentUser?.preferences?.voice_rate || 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  state.voiceMode.synthesis.speak(utterance);
}

function handleVoiceCommand(event) {
  if (!state.voiceMode.active) return;
  const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();

  const statusText = qs('#voice-status-text');
  if (statusText) {
    statusText.textContent = `Heard: "${transcript}"`;
    setTimeout(() => {
      if (state.voiceMode.active) {
        statusText.textContent = 'Voice mode active - Say "next", "repeat", "back", or "stop"';
      }
    }, 2000);
  }

  const steps = state.selectedRecipe?.steps || [];
  if (transcript.includes('next') || transcript.includes('continue')) {
    if (state.voiceMode.currentStep < steps.length - 1) {
      state.voiceMode.currentStep++;
      readCurrentStep();
    } else {
      speak('This is the last step. Say stop to exit voice mode.');
    }
  } else if (transcript.includes('repeat') || transcript.includes('again')) {
    readCurrentStep();
  } else if (transcript.includes('back') || transcript.includes('previous')) {
    if (state.voiceMode.currentStep > 0) {
      state.voiceMode.currentStep--;
      readCurrentStep();
    } else {
      speak('This is the first step.');
    }
  } else if (transcript.includes('stop') || transcript.includes('exit') || transcript.includes('quit')) {
    speak('Stopping voice mode.');
    setTimeout(() => stopVoiceMode(), 1500);
  } else if (transcript.includes('help')) {
    speak('Say next for next step, repeat to hear again, back for previous step, or stop to exit.');
  }
}

// PANTRY 
async function renderPantry() { 
  const list = qs('#pantryList'); 
  if (!list) return; 
  if (!state.currentUser) { 
    list.innerHTML = '<p class="muted">Please log in to manage your pantry</p>'; 
    return; 
  } 
  try { 
    const res = await fetch(`${API}/api/pantry?user=${encodeURIComponent(state.currentUser.email)}`); 
    const items = await res.json(); 
    if (!items || !items.length) { 
      list.innerHTML = '<p class="muted">Your pantry is empty. Add items above.</p>'; 
      return; 
    } 
    list.innerHTML = items.map(item => `
      <div class="pantry-item">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="muted">Expires in ${item.days_left || item.expiry} days</span>
        <button class="pantry-delete" data-id="${item._id}">Delete</button>
      </div>
    `).join(''); 
  } catch (err) { 
    list.innerHTML = '<p class="muted">Failed to load pantry items</p>'; 
  } 
} 

async function addPantryItem(name, expiry) { 
  try { 
    const res = await fetch(`${API}/api/pantry?user=${encodeURIComponent(state.currentUser.email)}`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ name, expiry: parseInt(expiry, 10) }) 
    }); 
    if (!res.ok) throw new Error('Failed to add item'); 
    renderPantry(); 
  } catch (err) { 
    alert('Failed to add pantry item'); 
  } 
} 

async function deletePantryItem(id) { 
  if (!confirm('Remove this item from your pantry?')) return; 
  try { 
    const res = await fetch(`${API}/api/pantry/${id}?user=${encodeURIComponent(state.currentUser.email)}`, { 
      method: 'DELETE' 
    }); 
    if (!res.ok) throw new Error('Failed to delete'); 
    renderPantry(); 
  } catch (err) { 
    alert('Failed to delete pantry item'); 
  } 
} 

// PROFILE 
function renderProfile() { 
  const profileInfo = qs('#profileInfo'); 
  if (!profileInfo) return; 
  if (!state.currentUser) { 
    profileInfo.innerHTML = '<p class="muted">Please log in to view your profile</p>'; 
    return; 
  } 
  profileInfo.innerHTML = `
    <div style="padding:16px; background:#f8fafc; border-radius:8px; margin-bottom:16px;">
      <div style="font-size:18px; font-weight:600; color:var(--accent); margin-bottom:8px;">
        ${escapeHtml(state.currentUser.name || 'User')}
      </div>
      <div style="color:var(--muted); margin-bottom:4px;">
        📧 ${escapeHtml(state.currentUser.email)}
      </div>
      <div style="color:var(--muted); font-size:13px;">
        Member since ${state.currentUser.created_at ? new Date(state.currentUser.created_at).toLocaleDateString() : 'N/A'}
      </div>
    </div>
    <button id="logoutBtn" class="logout-btn">Logout</button>
  `; 
  setupLogoutBinding(); 
} 

// FEEDBACK 
function renderFeedback() { 
  // placeholder
} 

// ADMIN 
function renderAdmin() { 
  const adminStats = qs('#adminStats'); 
  if (!adminStats) return; 
  if (!state.currentUser || !state.currentUser.isAdmin) { 
    adminStats.innerHTML = '<p class="muted">Access denied - Admin only</p>'; 
    return; 
  } 
  adminStats.innerHTML = `
    <div class="row" style="gap:16px; flex-wrap:wrap;">
      <div class="card" style="flex:1; min-width:200px;">
        <h4>📚 Total Recipes</h4>
        <div style="font-size:32px; font-weight:700; color:var(--accent);">
          ${state.recipes.length}
        </div>
      </div>
      <div class="card" style="flex:1; min-width:200px;">
        <h4>👥 Active Users</h4>
        <div style="font-size:32px; font-weight:700; color:var(--accent);">
          ${state.currentUser ? '1' : '0'}
        </div>
      </div>
    </div>
  `; 
} 

// AUTH 
function setupAuth() { 
  const userStr = localStorage.getItem('cookmateUser'); 
  if (userStr) { 
    try { 
      state.currentUser = JSON.parse(userStr); 
    } catch (e) { 
      localStorage.removeItem('cookmateUser'); 
    } 
  } 
  const authOverlay = qs('#authOverlay'); 
  const closeBtn = qs('.closeBtn'); 
  const authTabs = qsa('.auth-tab'); 
  const authForm = qs('#authForm'); 
  const authSubmit = qs('#authSubmit'); 
  if (closeBtn) { 
    on(closeBtn, 'click', () => { 
      authOverlay.classList.add('hidden'); 
    }); 
  } 
  if (authOverlay) { 
    on(authOverlay, 'click', (e) => { 
      if (e.target === authOverlay) { 
        authOverlay.classList.add('hidden'); 
      } 
    }); 
  } 
  authTabs.forEach(tab => { 
    on(tab, 'click', () => { 
      authTabs.forEach(t => t.classList.remove('active')); 
      tab.classList.add('active'); 
      const mode = tab.dataset.tab; 
      if (authSubmit) { 
        authSubmit.textContent = mode === 'login' ? 'Login' : 'Register'; 
      } 
    }); 
  }); 
  if (authForm) { 
    on(authForm, 'submit', async (e) => { 
      e.preventDefault(); 
      const email = qs('#authEmail')?.value?.trim(); 
      const password = qs('#authPassword')?.value; 
      const mode = qs('.auth-tab.active')?.dataset.tab || 'login'; 
      const errorDiv = qs('.auth-error'); 
      if (!email || !password) { 
        if (errorDiv) { 
          errorDiv.textContent = 'Please fill in all fields'; 
          errorDiv.classList.remove('hidden'); 
        } 
        return; 
      } 
      try { 
        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'; 
        const res = await fetch(`${API}${endpoint}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ email, pass: password }) 
        }); 
        const data = await res.json(); 
        if (!res.ok || !data.success) { 
          if (errorDiv) { 
            errorDiv.textContent = data.error || 'Authentication failed'; 
            errorDiv.classList.remove('hidden'); 
          } 
          return; 
        } 
        loginSuccess(data.user); 
        authForm.reset(); 
        if (errorDiv) errorDiv.classList.add('hidden'); 
      } catch (err) { 
        if (errorDiv) { 
          errorDiv.textContent = 'Connection failed. Please try again.'; 
          errorDiv.classList.remove('hidden'); 
        } 
      } 
    }); 
  } 
} 

function showAuthModal() { 
  const authOverlay = qs('#authOverlay'); 
  if (authOverlay) { 
    authOverlay.classList.remove('hidden'); 
  } 
} 

function loginSuccess(user) { 
  state.currentUser = user; 
  localStorage.setItem('cookmateUser', JSON.stringify(user)); 
  const authOverlay = qs('#authOverlay'); 
  if (authOverlay) authOverlay.classList.add('hidden'); 
  if (state.pendingRoute) { 
    const pending = state.pendingRoute; 
    state.pendingRoute = null; 
    navigateToRoute(pending); 
  } else { 
    renderProfile(); 
  } 
} 

function setupLogoutBinding() { 
  on(qs('#logoutBtn'), 'click', () => { 
    stopVoiceMode();
    state.currentUser = null; 
    localStorage.removeItem('cookmateUser'); 
    alert('Logged out successfully'); 
    navigateToRoute('home'); 
  }); 
} 

// VOICE SEARCH 
function setupVoiceRecognition() { 
  const voiceBtn = qs('#voiceBtn'); 
  if (!voiceBtn) return; 
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { 
    voiceBtn.disabled = true; 
    voiceBtn.title = 'Voice search not supported'; 
    return; 
  } 
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
  const recognition = new SpeechRecognition(); 
  recognition.continuous = false; 
  recognition.interimResults = false; 
  on(voiceBtn, 'click', () => { 
    recognition.start(); 
    voiceBtn.textContent = '🎤 Listening...'; 
  }); 
  recognition.onresult = (event) => { 
    const transcript = event.results[0][0].transcript; 
    const searchInput = qs('#globalSearch'); 
    if (searchInput) { 
      searchInput.value = transcript; 
      const inputEvent = new Event('input', { bubbles: true }); 
      searchInput.dispatchEvent(inputEvent); 
    } 
    voiceBtn.textContent = '🎙️'; 
  }; 
  recognition.onerror = () => { 
    voiceBtn.textContent = '🎙️'; 
    alert('Voice recognition error'); 
  }; 
  recognition.onend = () => { 
    voiceBtn.textContent = '🎙️'; 
  }; 
} 

// SEARCH 
function setupSearch() { 
  const searchInput = qs('#globalSearch'); 
  if (!searchInput) return; 
  on(searchInput, 'input', () => { 
    const q = searchInput.value.trim().toLowerCase(); 
    if (!q) { 
      state.recipes = [...state.allRecipes]; 
    } else { 
      state.recipes = state.allRecipes.filter(r => 
        (r.name || r.title || '').toLowerCase().includes(q) || 
        (r.cuisine || '').toLowerCase().includes(q) || 
        (r.ingredients || []).some(ing => 
          (typeof ing === 'string' ? ing : ing.name || '').toLowerCase().includes(q) 
        ) 
      ); 
    } 
    if (state.currentView === 'recipes' || state.currentView === 'home') { 
      if (state.currentView === 'recipes') { 
        renderRecipes(); 
      } else { 
        renderFeatured(); 
      } 
    } 
  }); 
} 

function stopVoice() { 
  if (currentUtterance) { 
    window.speechSynthesis.cancel(); 
  } 
  stopVoiceMode();
}
