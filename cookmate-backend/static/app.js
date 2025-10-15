// ============================
// CookMate - Full app.js Fixed
// ============================

// ---------------------------
// STATE
// ---------------------------
const state = {
  currentView: 'home',
  currentUser: null,
  recipes: [],
  allRecipes: [],
  selectedRecipe: null,
  pendingRoute: null
};

const API = 'http://localhost:5000';
let currentUtterance = null;

// ---------------------------
// DOM Helpers
// ---------------------------
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

// ---------------------------
// UTILS
// ---------------------------
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
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

// ---------------------------
// INITIALIZATION
// ---------------------------
document.addEventListener('DOMContentLoaded', async () => {
  console.log('CookMate client starting...');
  initUIBindings();
  setupAuth();
  setupVoiceRecognition();
  setupSearch();
  setupLogoutBinding();
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

// ---------------------------
// UI BINDINGS
// ---------------------------
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
        renderRecipeDetail(recipe);
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
      console.error(err);
      alert('Failed to submit feedback');
    }
  });
}

// ---------------------------
// ROUTING
// ---------------------------
function navigateToRoute(route) {
  if (!route) route = 'home';
  const view = qs(`#${route}`);
  if (!view) return console.warn('Route not found:', route);

  const protectedRoutes = ['pantry', 'profile', 'feedback', 'admin'];
  if (protectedRoutes.includes(route) && !state.currentUser) {
    state.pendingRoute = route;
    showAuthModal();
    return;
  }
  if (route === 'admin' && !state.currentUser?.isAdmin) {
    alert('Access denied — admin only');
    route = 'home';
  }

  try { window.history.pushState({}, '', `/${route}`); } catch {}

  qsa('.view').forEach(v => { v.classList.remove('active'); v.style.display = 'none'; });
  view.classList.add('active');
  view.style.display = 'block';
  setActiveNav(route);

  renderContent(route);
  state.currentView = route;
  window.scrollTo(0, 0);
}

// ---------------------------
// RENDERING
// ---------------------------
function renderContent(route) {
  switch (route) {
    case 'home': renderFeatured(); break;
    case 'recipes': renderRecipes(); break;
    case 'recipe-detail': if (state.selectedRecipe) renderRecipeDetail(state.selectedRecipe); break;
    case 'pantry': renderPantry(); break;
    case 'profile': renderProfile(); break;
    case 'feedback': renderFeedback(); break;
    case 'admin': renderAdmin(); break;
    default: console.warn('No render handler for', route);
  }
}

// ---------------------------
// FETCH DATA
// ---------------------------
async function fetchRecipes() {
  try {
    const res = await fetch(`${API}/api/recipes`);
    if (!res.ok) throw new Error('Failed to fetch recipes');
    const data = await res.json();
    state.recipes = data.map(r => ({ ...r, id: (r.id || (r.name || r.title || '').toLowerCase().replace(/ /g, '-')) }));
    state.allRecipes = [...state.recipes];
    console.log('Recipes loaded:', state.recipes.length);
  } catch (err) { console.error('fetchRecipes error:', err); }
}

// ---------------------------
// FEATURED + RECIPES
// ---------------------------
function renderFeatured() {
  const grid = qs('#featuredGrid');
  if (!grid) return;
  const featured = state.recipes.slice(0, 6);
  grid.innerHTML = featured.map(r => `
    <div class="recipe-card" data-id="${r.id}" style="cursor:pointer">
      <div class="recipe-img" style="background-image:url('${getRecipeImageUrl(r)}')"></div>
      <div class="recipe-info" style="padding:12px">
        <div class="recipe-title">${escapeHtml(r.title || r.name)}</div>
        <div class="recipe-meta"><small class="muted">${r.cuisine || 'Various'}</small> • <small class="muted">${r.time || '30'} mins</small></div>
      </div>
    </div>`).join('');
}

function renderRecipes() {
  const grid = qs('#recipesGrid');
  if (!grid) return;
  grid.innerHTML = state.recipes.map(r => `
    <div class="recipe-card" data-id="${r.id}" style="cursor:pointer">
      <div class="recipe-img" style="background-image:url('${getRecipeImageUrl(r)}');height:160px"></div>
      <div class="recipe-info" style="padding:12px">
        <div class="recipe-title">${escapeHtml(r.title || r.name)}</div>
        <div class="recipe-meta"><small class="muted">${r.cuisine || 'Various'}</small> • <small class="muted">${r.time || '30'} mins</small></div>
      </div>
    </div>`).join('');
}

// ---------------------------
// RECIPE DETAIL
// ---------------------------
function renderRecipeDetail(recipe) {
  if (!recipe) return;
  state.selectedRecipe = recipe;

  const recipesView = qs('#recipes');
  const target = qs('#recipeDetailArea') || (() => {
    const el = document.createElement('div');
    el.id = 'recipeDetailArea';
    recipesView.prepend(el);
    return el;
  })();

  const ingredientsHTML = (recipe.ingredients || []).map(i => `<li>${escapeHtml(typeof i === 'string' ? i : (i.name || ''))}</li>`).join('');
  const stepsHTML = (recipe.steps || []).map((s, idx) => `<div class="step"><strong>Step ${idx+1}:</strong> ${escapeHtml(s)}</div>`).join('');
  const altHTML = (recipe.alternatives || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');

  target.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div style="width:240px;min-height:140px;background-image:url('${getRecipeImageUrl(recipe)}');background-size:cover;border-radius:10px"></div>
        <div style="flex:1">
          <h2>${escapeHtml(recipe.title || recipe.name)}</h2>
          <div style="margin-bottom:8px;color:var(--muted)">${escapeHtml(recipe.cuisine || 'Various')} • ${escapeHtml(recipe.time || '30')} mins</div>
          <div style="margin-top:10px">
            <button id="favBtnDetail" class="btn">☆ Add to Favorites</button>
            <button id="openRecipeBtn" class="btn alt">Open in Recipes</button>
            <button id="speakRecipeBtn" class="btn">🔊 Speak</button>
            <button id="stopRecipeBtn" class="btn alt">⏹ Stop Voice</button>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;display:grid;grid-template-columns:1fr 320px;gap:16px">
        <div>
          <h4>Ingredients</h4>
          <ul id="ingredientsList">${ingredientsHTML}</ul>
          <input id="substituteInput" placeholder="Add substitute" style="margin-top:4px"/>
          <button id="addSubBtn" class="btn">Add</button>
          <h4>Steps</h4>${stepsHTML}
        </div>
        <aside>
          <h4>Alternatives</h4>
          <ul id="alternativesList">${altHTML}</ul>
        </aside>
      </div>
    </div>`;

  on(qs('#favBtnDetail'), 'click', () => toggleFavorite(recipe.id));
  on(qs('#openRecipeBtn'), 'click', () => navigateToRoute('recipes'));
  on(qs('#speakRecipeBtn'), 'click', () => speakRecipe(recipe));
  on(qs('#stopRecipeBtn'), 'click', stopVoice);
  on(qs('#addSubBtn'), 'click', () => {
    const val = qs('#substituteInput')?.value?.trim();
    if (!val) return;
    const li = document.createElement('li');
    li.textContent = val;
    qs('#alternativesList').appendChild(li);
    qs('#substituteInput').value = '';
    if (!recipe.alternatives) recipe.alternatives = [];
    recipe.alternatives.push(val);
  });

  speakRecipe(recipe);
}

// ---------------------------
// SPEECH
// ---------------------------
function speakRecipe(recipe) {
  stopVoice();
  if (!recipe || !recipe.steps) return;
  const text = `Here's ${recipe.title || recipe.name}. ` + recipe.steps.join('. ');
  speak(text);
}

function speak(text) {
  if (!window.speechSynthesis) return console.warn('No TTS available');
  currentUtterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(currentUtterance);
}

function stopVoice() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

// ---------------------------
// PANTRY
// ---------------------------
async function renderPantry() {
  const grid = qs('#pantryGrid');
  if (!grid) return;
  if (!state.currentUser) { grid.innerHTML = '<small class="muted">Login to manage your pantry</small>'; showAuthModal(); return; }

  try {
    const res = await fetch(`${API}/api/pantry?user=${encodeURIComponent(state.currentUser.email)}`);
    const items = await res.json();
    grid.innerHTML = items.length ? items.map(it => `
      <div class="pantry-item" style="display:flex;align-items:center;gap:8px">
        <span>${escapeHtml(it.name)}</span>
        <small class="muted">${it.days_left ?? it.expiry} days</small>
        <button class="pantry-delete" data-id="${it._id}" style="margin-left:auto">❌</button>
      </div>`).join('') : '<small class="muted">No items in pantry</small>';
  } catch (err) { console.error(err); grid.innerHTML = '<small class="muted">Failed to load pantry</small>'; }
}

async function addPantryItem(name, expiry = 7) {
  if (!state.currentUser) { state.pendingRoute = 'pantry'; showAuthModal(); return; }
  try {
    await fetch(`${API}/api/pantry?user=${encodeURIComponent(state.currentUser.email)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, expiry })
    });
    renderPantry();
  } catch (err) { console.error(err); alert('Failed to add pantry item'); }
}

async function deletePantryItem(id) {
  if (!state.currentUser) { state.pendingRoute = 'pantry'; showAuthModal(); return; }
  try {
    await fetch(`${API}/api/pantry/${id}?user=${encodeURIComponent(state.currentUser.email)}`, { method: 'DELETE' });
    renderPantry();
  } catch (err) { console.error(err); alert('Failed to delete pantry item'); }
}

// ---------------------------
// FAVORITES
// ---------------------------
async function toggleFavorite(recipeId) {
  if (!state.currentUser) { state.pendingRoute = 'profile'; showAuthModal(); return; }
  try {
    await fetch(`${API}/api/favorites?user=${encodeURIComponent(state.currentUser.email)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeId })
    });
    alert('Added to favorites');
  } catch (err) { console.error(err); alert('Failed to add favorite'); }
}

// ---------------------------
// AUTH
// ---------------------------
function setupAuth() {
  const userStr = localStorage.getItem('cookmateUser');
  if (userStr) state.currentUser = JSON.parse(userStr);
}

function showAuthModal() {
  const modal = qs('#loginModal'); 
  if (!modal) { alert('Login required'); return; }
  modal.style.display = 'block';
}

// Call after successful login
function loginSuccess(user) {
  state.currentUser = user;
  localStorage.setItem('cookmateUser', JSON.stringify(user));
  const modal = qs('#loginModal');
  if (modal) modal.style.display = 'none';

  if (state.pendingRoute) {
    const pending = state.pendingRoute;
    state.pendingRoute = null;
    navigateToRoute(pending);
  }
}

function setupLogoutBinding() {
  on(qs('#logoutBtn'), 'click', () => {
    state.currentUser = null;
    localStorage.removeItem('cookmateUser');
    alert('Logged out');
    navigateToRoute('home');
  });
}

// ---------------------------
// VOICE SEARCH
// ---------------------------
function setupVoiceRecognition() {
  // Optional later
}

// ---------------------------
// SEARCH
// ---------------------------
function setupSearch() {
  const searchInput = qs('#searchInput');
  if (!searchInput) return;
  on(searchInput, 'input', () => {
    const q = searchInput.value.trim().toLowerCase();
    state.recipes = state.allRecipes.filter(r => (r.name || r.title || '').toLowerCase().includes(q));
    renderRecipes();
  });
}
