/***** MOCK DATA & STATE *****/
const RECIPES = [
  {id:'r1',title:'Paneer Butter Masala',cuisine:'Indian',difficulty:'Medium',time:40,
    img:'https://images.unsplash.com/photo-1601924578870-3f6fc2c4ad9a?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=7a3c5f6c7809757f2a0d0fecb6f8f9f4',
    ingredients:['paneer','butter','tomato','cream','garam masala'],steps:['Heat butter','Add spices','Add tomato puree','Add paneer & simmer']},
  {id:'r2',title:'Veg Biryani',cuisine:'Indian',difficulty:'Hard',time:90,
    img:'https://images.unsplash.com/photo-1604908554026-2f3f8e3a7a1f?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=6bdf8b1a1af1b1b9f3a3f0e2b5bf0b1c',
    ingredients:['rice','vegetables','biryani masala','yogurt'],steps:['Marinate veg','Fry masala','Layer rice & veg','Dum cook']},
  {id:'r3',title:'Spaghetti Aglio e Olio',cuisine:'Italian',difficulty:'Easy',time:20,
    img:'https://images.unsplash.com/photo-1523986371872-9d3ba2e2f642?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=3b8f3a6f1a4b2f7f9c9a9f6d2b9f5a1d',
    ingredients:['spaghetti','garlic','olive oil','chili'],steps:['Boil pasta','Sauté garlic','Toss with oil & chili']}
]

let state = {
  route:'home',
  selectedRecipe:null,
  pantry: JSON.parse(localStorage.getItem('cookmate_pantry')||'[]'),
  favorites: JSON.parse(localStorage.getItem('cookmate_favs')||'[]'),
  feedbacks: JSON.parse(localStorage.getItem('cookmate_feedback')||'[]'),
  activity: JSON.parse(localStorage.getItem('cookmate_activity')||'[]'),
  prefs: JSON.parse(localStorage.getItem('cookmate_prefs')||'{}')
}

/***** Routing UI *****/
const views = document.querySelectorAll('.view')
function showView(name){
  state.route = name
  views.forEach(v=>v.style.display='none')
  const el = document.getElementById('view-'+name)
  if(el) el.style.display='block'
  document.querySelectorAll('.side-list button, .nav-link').forEach(b=>{
    b.classList.toggle('active', b.dataset.route === name)
  })
  localSave()
  renderAll()
}
document.querySelectorAll('[data-route]').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.preventDefault()
    const r = btn.dataset.route
    showView(r)
  })
})

/***** Voice search stub (basic) *****/
const voiceBtn = document.getElementById('voiceBtn')
const globalSearch = document.getElementById('globalSearch')
let recognition = null
if(window.SpeechRecognition || window.webkitSpeechRecognition){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SR()
  recognition.continuous = false
  recognition.onresult = (ev)=> {
    const t = Array.from(ev.results).map(r=>r[0].transcript).join('')
    globalSearch.value = t
    performSearch()
  }
} else {
  voiceBtn.title = 'Voice not supported in this browser'
}
voiceBtn.addEventListener('click',()=>{
  if(!recognition){ alert('Voice not supported in this browser') ; return }
  recognition.start()
})

/***** Render / UI helpers *****/
const featuredGrid = document.getElementById('featuredGrid')
const recipesGrid = document.getElementById('recipesGrid')
function renderFeatured(){
  featuredGrid.innerHTML = ''
  RECIPES.forEach(r=>{
    const card = document.createElement('div'); card.className='recipe-card'
    card.innerHTML = `<div class="recipe-pic" style="background-image:url(${r.img})"></div>
      <div class="recipe-body">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${r.title}</strong><div class="muted" style="font-size:12px">${r.cuisine} • ${r.time}m</div></div>
          <div><span class="tag">${r.difficulty}</span></div>
        </div>
      </div>`
    card.addEventListener('click',()=>openRecipe(r.id))
    featuredGrid.appendChild(card)
  })
}
function renderRecipes(filter=''){
  recipesGrid.innerHTML = ''
  const cuisine = document.getElementById('filterCuisine').value
  const difficulty = document.getElementById('filterDifficulty').value
  const q = filter.toLowerCase()
  RECIPES.filter(r=>{
    if(cuisine && r.cuisine!==cuisine) return false
    if(difficulty && r.difficulty!==difficulty) return false
    if(q && !(r.title.toLowerCase().includes(q) || r.ingredients.join(' ').includes(q))) return false
    return true
  }).forEach(r=>{
    const card = document.createElement('div'); card.className='recipe-card'
    card.innerHTML = `<div class="recipe-pic" style="background-image:url(${r.img})"></div>
      <div class="recipe-body">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${r.title}</strong><div class="muted" style="font-size:12px">${r.cuisine} • ${r.time}m</div></div>
          <div><span class="tag">${r.difficulty}</span></div>
        </div>
        <div style="margin-top:8px"><small class="muted">${r.ingredients.slice(0,3).join(', ')}${r.ingredients.length>3?'...':''}</small></div>
      </div>`
    card.addEventListener('click',()=>openRecipe(r.id))
    recipesGrid.appendChild(card)
  })
}

function openRecipe(id){
  const r = RECIPES.find(x=>x.id===id)
  if(!r) return
  state.selectedRecipe = r
  showView('recipe-detail')
  document.getElementById('recipeHeader').innerHTML = `<div style="display:flex;gap:12px;align-items:center">
    <div style="width:120px;height:80px;background-image:url(${r.img});background-size:cover;border-radius:8px"></div>
    <div>
      <div style="font-weight:800">${r.title}</div>
      <div class="muted">${r.cuisine} • ${r.time} minutes • ${r.difficulty}</div>
    </div>
  </div>`
  // ingredients
  const ingDiv = document.getElementById('ingredientsList'); ingDiv.innerHTML=''
  r.ingredients.forEach(ing=>{
    const el = document.createElement('div'); el.className='row'; el.style.justifyContent='space-between'
    el.innerHTML = `<div style="font-weight:600">${ing}</div><div><button class="btn alt" data-ing="${ing}">Substitute</button></div>`
    ingDiv.appendChild(el)
  })
  // steps
  const stepsDiv = document.getElementById('stepsList'); stepsDiv.innerHTML=''
  r.steps.forEach((s,idx)=>{
    const st = document.createElement('div'); st.className='step'
    st.innerHTML = `<strong>Step ${idx+1}:</strong> ${s}`
    stepsDiv.appendChild(st)
  })
  // subs
  renderSubsForRecipe(r)
}

function renderSubsForRecipe(r){
  const subs = document.getElementById('subsList'); subs.innerHTML=''
  r.ingredients.forEach(ing=>{
    const row = document.createElement('div'); row.className='sub-row'
    row.innerHTML = `<div><strong>${ing}</strong><div class="muted" style="font-size:12px">Common substitutes</div></div>
      <div><small class="muted">loading...</small></div>`
    subs.appendChild(row)
  })
  // simulate suggestions
  setTimeout(()=>{
    subs.querySelectorAll('.sub-row').forEach((row,i)=>{
      const ing = r.ingredients[i]
      const suggestions = fakeSubstitute(ing)
      row.querySelector('div:last-child').innerHTML = suggestions.map(s=>`<button class="btn alt" data-sub="${s}" data-ori="${ing}">${s}</button>`).join(' ')
    })
  },450)
}

/***** Pantry UI *****/
const quickPantry = document.getElementById('quickPantry')
function renderPantry(){
  const g = document.getElementById('pantryGrid')
  g.innerHTML = ''
  quickPantry.innerHTML = ''
  state.pantry.forEach((it,idx)=>{
    const el = document.createElement('div'); el.className='pantry-item'
    el.innerHTML = `${it.name} <small style="margin-left:8px;color:#9ca3af">(${it.expiry}d)</small> <button style="margin-left:8px" class="btn alt" data-remove="${idx}">x</button>`
    g.appendChild(el)
    const q = document.createElement('div'); q.className='pantry-item'; q.innerText = it.name
    quickPantry.appendChild(q)
  })
}

document.getElementById('addPantryBtn').addEventListener('click',()=>{
  const name = document.getElementById('pantryInput').value.trim()
  const expiry = parseInt(document.getElementById('pantryExpiry').value) || 7
  if(!name) return alert('Enter ingredient')
  state.pantry.push({name,expiry})
  activityLog(`Pantry: added ${name}`)
  localSave(); renderPantry()
  document.getElementById('pantryInput').value=''; document.getElementById('pantryExpiry').value=''
})
document.getElementById('addRandom').addEventListener('click',()=>{
  const samples = ['tomato','onion','milk','egg','garlic','rice','flour']
  const pick = samples[Math.floor(Math.random()*samples.length)]
  state.pantry.push({name:pick,expiry:Math.ceil(Math.random()*12)})
  activityLog(`Pantry: added ${pick}`)
  localSave(); renderPantry()
})
document.addEventListener('click',e=>{
  if(e.target.dataset.remove){
    const idx = Number(e.target.dataset.remove)
    const removed = state.pantry.splice(idx,1)[0]
    activityLog(`Pantry: removed ${removed.name}`)
    localSave(); renderPantry()
  }
  if(e.target.dataset.ori){
    // substitution apply
    const ori = e.target.dataset.ori, sub = e.target.dataset.sub
    alert(`Substitute ${ori} with ${sub} (this is a demo action).`)
    activityLog(`Substitution used: ${ori} -> ${sub}`)
  }
})

/***** Substitution engine (fake) *****/
function fakeSubstitute(ingredient){
  // quick deterministic suggestions
  ingredient = ingredient.toLowerCase()
  const map = {
    milk:['yogurt','buttermilk','almond milk'],
    egg:['applesauce','banana','flaxseed mix'],
    butter:['margarine','olive oil','ghee'],
    paneer:['tofu','ricotta','halloumi'],
    cream:['coconut cream','yogurt','cashew cream'],
    tomato:['red bell pepper','tomato paste','sundried tomato']
  }
  for(const k in map) if(ingredient.includes(k)) return map[k]
  // fallback generics
  return ['similar ingredient','canned substitute','omit & adjust']
}

document.getElementById('findSubs').addEventListener('click',()=>{
  const q = document.getElementById('subQuery').value.trim()
  if(!q) return alert('Type an ingredient to substitute')
  const res = fakeSubstitute(q)
  const el = document.getElementById('subResults'); el.innerHTML=''
  res.forEach(s=>{
    const r = document.createElement('div'); r.className='sub-row'
    r.innerHTML = `<div>${s}</div><div><button class="btn alt" data-ori="${q}" data-sub="${s}">Use</button></div>`
    el.appendChild(r)
  })
  activityLog(`Substitution lookup for: ${q}`)
})

/***** Recipes search & select *****/
function performSearch(){
  const q = document.getElementById('globalSearch').value.trim()
  showView('recipes')
  renderRecipes(q)
}
document.getElementById('globalSearch').addEventListener('keydown',e=>{
  if(e.key==='Enter') performSearch()
})
document.getElementById('refreshRecipes').addEventListener('click',()=>renderRecipes(''))

/***** Recipe detail actions *****/
document.getElementById('addToPantryBtn').addEventListener('click',()=>{
  const ing = document.querySelector('#ingredientsList .row')?.querySelector('button')?.dataset?.ing
  // fallback: add first ingredient
  const ingName = document.getElementById('addPantryInput').value.trim() || (state.selectedRecipe && state.selectedRecipe.ingredients[0])
  if(!ingName) return alert('No ingredient selected')
  state.pantry.push({name:ingName,expiry:7})
  localSave(); renderPantry(); activityLog(`Pantry: added ${ingName}`)
  document.getElementById('addPantryInput').value=''
})
// favorite
document.getElementById('favBtn').addEventListener('click',()=>{
  if(!state.selectedRecipe) return
  if(!state.favorites.includes(state.selectedRecipe.id)) state.favorites.push(state.selectedRecipe.id)
  localSave(); activityLog(`Added ${state.selectedRecipe.title} to favorites`); alert('Added to favorites')
})
// feedback route
document.getElementById('feedbackBtn').addEventListener('click',()=>showView('feedback'))

/***** Voice playback for steps (SpeechSynthesis) *****/
let synth = window.speechSynthesis
let playIndex=0
function speakText(t, opts={}){
  if(!synth) return alert('Speech synthesis not supported')
  const utter = new SpeechSynthesisUtterance(t)
  utter.rate = (state.prefs.voiceRate) ? state.prefs.voiceRate : 0.95
  synth.speak(utter)
}
document.getElementById('startVoicePlay').addEventListener('click',()=>{
  if(!state.selectedRecipe) return
  const steps = state.selectedRecipe.steps
  // play sequentially
  playIndex = 0
  const playOne = ()=>{
    if(playIndex>=steps.length) return
    speakText(`Step ${playIndex+1}. ${steps[playIndex]}`)
    playIndex++
    setTimeout(()=>{ if(playIndex<steps.length) playOne() }, 3000)
  }
  playOne(); activityLog(`Playback started for ${state.selectedRecipe.title}`)
})
document.getElementById('stopVoicePlay').addEventListener('click',()=>{ if(synth) synth.cancel(); activityLog('Playback stopped') })

/***** Feedback submit *****/
document.getElementById('submitFb').addEventListener('click',()=>{
  const fb = {
    id: 'fb'+Date.now(),
    rating: document.querySelectorAll('#fbStars button.active').length || 5,
    spice: document.getElementById('fbSpice').value,
    salt: document.getElementById('fbSalt').value,
    sweet: document.getElementById('fbSweet').value,
    taste: document.getElementById('fbTaste').value,
    improve: document.getElementById('fbImprove').value,
    recipe: state.selectedRecipe ? state.selectedRecipe.id : null,
    ts: new Date().toISOString()
  }
  state.feedbacks.push(fb)
  activityLog('Feedback submitted')
  localSave(); alert('Thanks! Feedback saved locally.')
  // update admin stats
  renderAdmin()
})

/***** Small rating UI in feedback section *****/
function initFbStars(){
  const container = document.getElementById('fbStars'); container.innerHTML=''
  for(let i=1;i<=5;i++){
    const b = document.createElement('button'); b.innerText='★'; b.className='btn alt'; b.style.padding='6px 8px'
    b.addEventListener('click',()=>{ container.querySelectorAll('button').forEach(x=>x.classList.remove('active')); for(let j=0;j<i;j++) container.querySelectorAll('button')[j].classList.add('active') })
    container.appendChild(b)
  }
}

/***** Admin render *****/
function renderAdmin(){
  document.getElementById('statRecipes').innerText = RECIPES.length
  document.getElementById('statFeedback').innerText = state.feedbacks.length
  const act = document.getElementById('adminActivity'); act.innerHTML = ''
  state.activity.slice().reverse().forEach(a=>{
    const d = document.createElement('div'); d.style.padding='6px 8px'; d.style.borderBottom='1px dashed #f1f5f9'
    d.innerHTML = `<div style="font-size:13px">${a}</div><small class="muted">${new Date().toLocaleString()}</small>`
    act.appendChild(d)
  })
}

/***** Activity log & persistence *****/
function activityLog(text){
  state.activity.push(text)
  if(state.activity.length>200) state.activity.shift()
  localSave()
}
function localSave(){
  localStorage.setItem('cookmate_pantry', JSON.stringify(state.pantry))
  localStorage.setItem('cookmate_favs', JSON.stringify(state.favorites))
  localStorage.setItem('cookmate_feedback', JSON.stringify(state.feedbacks))
  localStorage.setItem('cookmate_activity', JSON.stringify(state.activity))
  localStorage.setItem('cookmate_prefs', JSON.stringify(state.prefs))
}

/***** Profile prefs save *****/
document.getElementById('savePrefs').addEventListener('click',()=>{
  const diet = document.getElementById('prefDiet').value
  const vrate = parseFloat(document.getElementById('prefVoiceRate').value)
  state.prefs.diet = diet; state.prefs.voiceRate = vrate
  localSave(); activityLog('Preferences updated'); alert('Preferences saved')
})

function renderAll(){
  renderFeatured(); renderRecipes(''); renderPantry(); initFbStars(); renderAdmin()
}

// initial render
renderAll()

// wire up search
document.getElementById('globalSearch').addEventListener('input', (e)=>{
  // live search while typing (after 600ms)
  clearTimeout(window._searchTimer)
  window._searchTimer = setTimeout(()=>renderRecipes(e.target.value),600)
})

// wire up filter changes
document.getElementById('filterCuisine').addEventListener('change',()=>renderRecipes(''))
document.getElementById('filterDifficulty').addEventListener('change',()=>renderRecipes(''))

// init nav
showView('home')

// subs buttons inside recipes (delegation for dynamic elements)
document.body.addEventListener('click', function(e){
  if(e.target.matches('.recipe-card') || e.target.closest('.recipe-card')) return; // skip
})

// small keyboard shortcuts
window.addEventListener('keydown', (e)=>{
  if(e.key==='/' && document.activeElement.tagName!=='INPUT') { e.preventDefault(); document.getElementById('globalSearch').focus() }
})