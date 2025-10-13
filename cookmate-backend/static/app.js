/***** STATE *****/
let state = {
  route: 'home',
  selectedRecipe: null,
  pantry: [],
  favorites: [],
  feedbacks: [],
  activity: [],
  prefs: {},
  currentUser: null,
  recipes: []
};

const API = ''; // Flask backend served from same origin

/***** VOICE FUNCTIONALITY *****/
let recognition;
let synthesis = window.speechSynthesis;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    console.log('Voice recognition started');
    document.getElementById('voiceBtn').style.background = '#10b981';
    document.getElementById('voiceAnim').style.animation = 'voice 300ms linear infinite alternate';
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    console.log('Heard:', transcript);

    try {
      const res = await fetch(`${API}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript })
      });
      const data = await res.json();
      speakText(data.response || 'Sorry, I did not understand that.');
    } catch (err) {
      console.error('Voice API error:', err);
      speakText('Sorry, there was an error processing your request.');
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    document.getElementById('voiceBtn').style.background = '';
  };

  recognition.onend = () => {
    console.log('Voice recognition ended');
    document.getElementById('voiceBtn').style.background = '';
    document.getElementById('voiceAnim').style.animation = 'voice 1000ms linear infinite alternate';
  };
}

function startVoiceRecognition() {
  if (recognition) recognition.start();
  else alert('Speech recognition not supported in your browser. Use Chrome/Edge.');
}

function speakText(text) {
  if (!synthesis) return;
  synthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = parseFloat(document.getElementById('prefVoiceRate')?.value || 0.95);
  utter.pitch = 1;
  utter.volume = 1;
  synthesis.speak(utter);
}

/***** ROUTING UI *****/
const views = document.querySelectorAll('.view');
function showView(name) {
  state.route = name;
  views.forEach(v => v.style.display = 'none');
  const el = document.getElementById('view-' + name);
  if (el) el.style.display = 'block';
  document.querySelectorAll('[data-route]').forEach(b => b.classList.toggle('active', b.dataset.route === name));
  renderAll();
}

document.querySelectorAll('[data-route]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    showView(btn.dataset.route);
  });
});

/***** FETCH RECIPES *****/
async function fetchRecipes() {
  try {
    const res = await fetch(`${API}/api/recipes`);
    state.recipes = await res.json();
    renderFeatured();
    renderRecipes();
    updateAdminStats();
  } catch (err) {
    console.error('Error fetching recipes:', err);
  }
}

async function openRecipe(id) {
  try {
    const res = await fetch(`${API}/api/recipes/${id}`);
    const r = await res.json();
    state.selectedRecipe = r;
    showView('recipe-detail');

    const imgPath = `${API}/static/images/${r.img}`;
    document.getElementById('recipeHeader').innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div style="width:120px;height:80px;background-image:url(${imgPath});background-size:cover;border-radius:8px"></div>
        <div>
          <div style="font-weight:800">${r.title}</div>
          <div class="muted">${r.cuisine} • ${r.time}m • ${r.difficulty}</div>
        </div>
      </div>`;

    const ingDiv = document.getElementById('ingredientsList');
    ingDiv.innerHTML = '';
    r.ingredients.forEach(ing => {
      const el = document.createElement('div');
      el.className = 'row';
      el.style.justifyContent = 'space-between';
      el.innerHTML = `<div style="font-weight:600">${ing}</div>
                      <div><button class="btn alt" data-ing="${ing}">Substitute</button></div>`;
      ingDiv.appendChild(el);
    });

    const stepsDiv = document.getElementById('stepsList');
    stepsDiv.innerHTML = '';
    r.steps.forEach((s, idx) => {
      const st = document.createElement('div');
      st.className = 'step';
      st.innerHTML = `<strong>Step ${idx+1}:</strong> ${s}`;
      stepsDiv.appendChild(st);
    });

    renderSubsForRecipe(r);
  } catch (err) {
    console.error('Error opening recipe:', err);
  }
}

/***** RENDER HELPERS *****/
function renderFeatured() {
  const grid = document.getElementById('featuredGrid');
  grid.innerHTML = '';
  state.recipes.slice(0,6).forEach(r => {
    const imgPath = `${API}/static/images/${r.img}`;
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `<div class="recipe-pic" style="background-image:url(${imgPath})"></div>
      <div class="recipe-body">
        <strong>${r.title}</strong>
        <div class="muted" style="font-size:12px">${r.cuisine} • ${r.time}m</div>
      </div>`;
    card.addEventListener('click', () => openRecipe(r.id));
    grid.appendChild(card);
  });
}

function renderRecipes(filter='') {
  const grid = document.getElementById('recipesGrid');
  if (!state.recipes) return;
  grid.innerHTML = '';
  const cuisine = document.getElementById('filterCuisine')?.value || '';
  const difficulty = document.getElementById('filterDifficulty')?.value || '';
  const q = filter.toLowerCase();

  state.recipes.filter(r => {
    if (cuisine && r.cuisine!==cuisine) return false;
    if (difficulty && r.difficulty!==difficulty) return false;
    if (q && !(r.title.toLowerCase().includes(q) || r.ingredients.join(' ').toLowerCase().includes(q))) return false;
    return true;
  }).forEach(r => {
    const imgPath = `${API}/static/images/${r.img}`;
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `<div class="recipe-pic" style="background-image:url(${imgPath})"></div>
      <div class="recipe-body">
        <strong>${r.title}</strong>
        <div class="muted" style="font-size:12px">${r.cuisine} • ${r.time}m</div>
        <small class="muted">${r.ingredients.slice(0,3).join(', ')}${r.ingredients.length>3?'...':''}</small>
      </div>`;
    card.addEventListener('click', () => openRecipe(r.id));
    grid.appendChild(card);
  });
}

/***** PANTRY *****/
async function fetchPantry() {
  if (!state.currentUser) return;
  const res = await fetch(`${API}/api/pantry?user=${state.currentUser}`);
  state.pantry = await res.json();
  renderPantry();
}

function renderPantry() {
  const grid = document.getElementById('pantryGrid');
  const quick = document.getElementById('quickPantry');
  if (!grid) return;
  grid.innerHTML = '';
  quick.innerHTML = '';
  state.pantry.forEach(it => {
    const el = document.createElement('div');
    el.className = 'pantry-item';
    el.innerHTML = `${it.name} <small style="margin-left:8px;color:#9ca3af">(${it.expiry}d)</small> <button class="btn alt" data-remove="${it._id}">x</button>`;
    grid.appendChild(el);

    const q = document.createElement('div');
    q.className = 'pantry-item';
    q.innerText = it.name;
    quick.appendChild(q);
  });
}

async function addPantryItem(name, expiry) {
  if (!state.currentUser) return;
  await fetch(`${API}/api/pantry`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({user: state.currentUser, name, expiry})
  });
  fetchPantry();
}

async function removePantryItem(id) {
  if (!state.currentUser) return;
  await fetch(`${API}/api/pantry/${id}`, {method:'DELETE'});
  fetchPantry();
}

document.getElementById('addPantryBtn')?.addEventListener('click', () => {
  const name = document.getElementById('pantryInput').value.trim();
  const expiry = parseInt(document.getElementById('pantryExpiry').value) || 7;
  if (!name) return alert('Enter ingredient');
  addPantryItem(name, expiry);
  document.getElementById('pantryInput').value='';
  document.getElementById('pantryExpiry').value='';
});

document.addEventListener('click', e => {
  if (e.target.dataset.remove) removePantryItem(e.target.dataset.remove);
});

/***** FAVORITES *****/
async function fetchFavorites() {
  if (!state.currentUser) return;
  const res = await fetch(`${API}/api/favorites?user=${state.currentUser}`);
  state.favorites = await res.json();
  renderFavorites();
}

async function addFavorite(recipeId) {
  if (!state.currentUser) return;
  await fetch(`${API}/api/favorites`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({user: state.currentUser, recipeId})
  });
  fetchFavorites();
}

document.getElementById('favBtn')?.addEventListener('click', () => {
  if (!state.selectedRecipe) return;
  addFavorite(state.selectedRecipe.id);
  alert('Added to favorites');
});

function renderFavorites() {
  const grid = document.getElementById('favoritesGrid');
  if (!grid) return;
  grid.innerHTML='';
  state.favorites.forEach(r => {
    const imgPath = `${API}/static/images/${r.img}`;
    const card = document.createElement('div');
    card.className='recipe-card';
    card.innerHTML = `<div class="recipe-pic" style="background-image:url(${imgPath})"></div>
                      <div class="recipe-body"><strong>${r.title}</strong></div>`;
    card.addEventListener('click', () => openRecipe(r.id));
    grid.appendChild(card);
  });
}

/***** AUTH *****/
let isLogin = true;
const authForm = document.getElementById('authForm');
authForm?.addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPassword').value.trim();
  if (!email || !pass) return alert('Enter email & password');
  if (isLogin) login(email, pass);
  else register(email, pass);
});

async function login(email, pass) {
  const res = await fetch(`${API}/api/auth/login`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email, pass})
  });
  const data = await res.json();
  if (data.success) {
    state.currentUser = data.user.email;
    showView('profile');
    fetchPantry();
    fetchFavorites();
  } else alert('Invalid credentials');
}

async function register(email, pass) {
  const res = await fetch(`${API}/api/auth/register`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email, pass})
  });
  const data = await res.json();
  if (data.success) {
    alert('Registered! Please login.');
    toggleAuth.click();
  } else alert('User exists');
}

/***** VOICE PLAYBACK FOR STEPS *****/
let currentStepIndex = 0;
let isPlayingSteps = false;

document.getElementById('startVoicePlay')?.addEventListener('click', () => {
  if (!state.selectedRecipe) return;
  isPlayingSteps = true;
  currentStepIndex = 0;
  speakNextStep();
});

document.getElementById('stopVoicePlay')?.addEventListener('click', () => {
  isPlayingSteps = false;
  synthesis.cancel();
});

function speakNextStep() {
  if (!isPlayingSteps || !state.selectedRecipe) return;
  const steps = state.selectedRecipe.steps;
  if (currentStepIndex < steps.length) {
    const stepText = `Step ${currentStepIndex+1}: ${steps[currentStepIndex]}`;
    const utter = new SpeechSynthesisUtterance(stepText);
    utter.rate = parseFloat(document.getElementById('prefVoiceRate')?.value || 0.95);
    utter.onend = () => {
      currentStepIndex++;
      if (isPlayingSteps && currentStepIndex<steps.length) setTimeout(speakNextStep, 1000);
      else { speakText('Recipe steps completed. Enjoy!'); isPlayingSteps=false; }
    };
    synthesis.speak(utter);
  }
}

/***** ADMIN STATS *****/
function updateAdminStats() {
  document.getElementById('statRecipes').innerText = state.recipes.length || 0;
}

/***** SUBSTITUTIONS *****/
function renderSubsForRecipe(r) {
  const list = document.getElementById('subsList');
  if (!list) return;
  list.innerHTML='';
  r.ingredients.slice(0,5).forEach(ing=>{
    const row = document.createElement('div');
    row.className='sub-row';
    row.innerHTML=`<div>${ing}</div><button class="btn alt" onclick="findSubFor('${ing}')">Find Substitute</button>`;
    list.appendChild(row);
  });
}

function findSubFor(ingredient) {
  document.getElementById('subQuery').value = ingredient;
  showView('subs');
  document.getElementById('findSubs')?.click();
}

document.getElementById('findSubs')?.addEventListener('click', ()=>{
  const query = document.getElementById('subQuery').value.trim();
  if (!query) return alert('Enter ingredient');
  const subs = {
    'buttermilk':['Yogurt+water','Milk+lemon juice','Sour cream'],
    'butter':['Ghee','Coconut oil','Olive oil'],
    'egg':['Flax egg','Banana','Applesauce'],
    'milk':['Almond milk','Coconut milk','Soy milk'],
    'tomato':['Tomato paste+water','Red bell pepper','Canned tomatoes']
  };
  const results = subs[query.toLowerCase()] || ['No substitutions found.'];
  const div = document.getElementById('subResults');
  div.innerHTML='<h4>Suggested Substitutes:</h4>';
  results.forEach(sub=>{
    const row = document.createElement('div');
    row.className='sub-row';
    row.innerText=sub;
    div.appendChild(row);
  });
});

/***** PREFERENCES *****/
document.getElementById('savePrefs')?.addEventListener('click', () => {
  state.prefs.diet = document.getElementById('prefDiet')?.value;
  state.prefs.voiceRate = document.getElementById('prefVoiceRate')?.value;
  alert('Preferences saved!');
});

/***** FILTERS & SEARCH *****/
document.getElementById('searchQuery')?.addEventListener('input', e=>renderRecipes(e.target.value));
document.getElementById('filterCuisine')?.addEventListener('change', ()=>renderRecipes());
document.getElementById('filterDifficulty')?.addEventListener('change', ()=>renderRecipes());
document.getElementById('globalSearch')?.addEventListener('input', e=>{
  showView('recipes');
  renderRecipes(e.target.value.toLowerCase());
});

/***** FEEDBACK *****/
document.getElementById('submitFb')?.addEventListener('click', ()=>{
  alert('Thank you for your feedback!');
  ['fbSpice','fbSalt','fbSweet','fbTaste','fbImprove'].forEach(id=>document.getElementById(id).value='');
});

/***** INIT *****/
fetchRecipes();
if (state.currentUser) { fetchPantry(); fetchFavorites(); }
showView('home');
