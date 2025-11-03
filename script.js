// Meal Tracker main script (full rebuild for: grid selection + charts + theme)

const monthSelect = document.getElementById('monthSelect');
const generateGridBtn = document.getElementById('generateGrid');
const gridWrap = document.getElementById('gridWrap');
const saveAllBtn = document.getElementById('saveAll');
const clearMonthBtn = document.getElementById('clearMonth');
const entryTbody = document.getElementById('entryTbody');
const mealRateInput = document.getElementById('mealRate');

const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
const monthlyMealsCtx = document.getElementById('monthlyMealsChart').getContext('2d');
const yearlyCtx = document.getElementById('yearlyChart').getContext('2d');

const themeSwitch = document.getElementById('themeSwitch');

const STORAGE_ENTRIES = 'mealEntries_v2';
const STORAGE_RATES = 'monthRates_v2';
const STORAGE_THEME = 'mealTrackerTheme_v2';

// generate amount options: 0,0.5,1,...,6
const AMOUNTS = [];
for (let v = 0; v <= 12; v++) AMOUNTS.push((v * 0.5).toFixed(1).replace('.0',''));

// helpers
function loadEntries(){ const raw = localStorage.getItem(STORAGE_ENTRIES); return raw ? JSON.parse(raw) : {}; }
// entries stored as { "YYYY-MM-DD": mealsNumber, ... }
function saveEntries(obj){ localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(obj)); }
function loadRates(){ const raw = localStorage.getItem(STORAGE_RATES); return raw ? JSON.parse(raw) : {}; }
function saveRates(o){ localStorage.setItem(STORAGE_RATES, JSON.stringify(o)); }
function getMonthKeyFromMonthInput(monthVal){ return monthVal || null; }
function daysInMonth(year, month){ return new Date(year, month, 0).getDate(); }
function formatMonthKey(mk){ return mk; }

// theme
function applyTheme(t){
  if(t==='dark'){ document.body.classList.add('dark'); themeSwitch.textContent='☀️'; }
  else { document.body.classList.remove('dark'); themeSwitch.textContent='🌙'; }
}
(function initTheme(){
  const s = localStorage.getItem(STORAGE_THEME);
  if(s) applyTheme(s);
  else if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
  else applyTheme('light');
})();
themeSwitch.addEventListener('click', ()=>{
  const cur = document.body.classList.contains('dark') ? 'dark' : 'light';
  const nxt = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_THEME, nxt);
  applyTheme(nxt);
});

// build grid for selected month
function buildGridForMonth(monthKey){
  if(!monthKey) return gridWrap.innerHTML = '<p class="note">Please pick a month above and click "Generate Month Grid".</p>';
  const [y, m] = monthKey.split('-').map(Number);
  const days = daysInMonth(y, m);
  const entries = loadEntries();

  // table: first column Date, then one column per amount option
  let html = '<table class="meal-grid"><thead><tr><th>Date</th>';
  for(const a of AMOUNTS) html += `<th>${a}</th>`;
  html += '</tr></thead><tbody>';
  for(let d=1; d<=days; d++){
    const date = `${monthKey}-${String(d).padStart(2,'0')}`;
    const selected = typeof entries[date] !== 'undefined' ? String(entries[date]) : '';
    html += `<tr data-date="${date}"><td style="text-align:left;padding-left:8px">${date}</td>`;
    for(const a of AMOUNTS){
      const id = `r_${date}_${a.replace('.','_')}`;
      const checked = selected === a ? 'checked' : '';
      html += `<td class="meal-cell">
        <input class="meal-radio" type="radio" name="sel_${date}" id="${id}" value="${a}" ${checked}>
        <label class="meal-label" for="${id}">${a}</label>
      </td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  gridWrap.innerHTML = html;

  // attach radio change handlers (save single day when changed)
  gridWrap.querySelectorAll('.meal-radio').forEach(radio=>{
    radio.addEventListener('change', (e)=>{
      const val = Number(e.target.value);
      const tr = e.target.closest('tr');
      const date = tr.dataset.date;
      const entriesObj = loadEntries();
      entriesObj[date] = val;
      saveEntries(entriesObj);
      renderEntriesTable();
      updateCharts();
    });
  });
}

// save all current selections in grid (iterate rows and read selected)
function saveAllGrid(){
  const radios = gridWrap.querySelectorAll('input[type="radio"]:checked');
  if(radios.length===0) { alert('No selections in grid to save.'); return; }
  const entriesObj = loadEntries();
  radios.forEach(r=>{
    const tr = r.closest('tr'); if(!tr) return;
    const date = tr.dataset.date;
    entriesObj[date] = Number(r.value);
  });
  saveEntries(entriesObj);
  renderEntriesTable();
  updateCharts();
  alert('Selections saved.');
}

function clearMonthData(monthKey){
  if(!monthKey) return;
  if(!confirm('Clear all saved entries for this month?')) return;
  const entriesObj = loadEntries();
  for(const k of Object.keys(entriesObj)){
    if(k.startsWith(monthKey)) delete entriesObj[k];
  }
  saveEntries(entriesObj);
  buildGridForMonth(monthKey);
  renderEntriesTable();
  updateCharts();
}

// entries table render
function renderEntriesTable(){
  const entriesObj = loadEntries();
  const rows = Object.keys(entriesObj).sort().map(d=>({date:d, meals:entriesObj[d]}));
  entryTbody.innerHTML = rows.map(r=>`<tr><td>${r.date}</td><td>${r.meals}</td>
    <td><button class="btn edit" data-date="${r.date}">Edit</button>
    <button class="btn danger del" data-date="${r.date}">Delete</button></td></tr>`).join('') || '<tr><td colspan="3" style="color:var(--muted)">No entries</td></tr>';

  // attach edit/delete
  entryTbody.querySelectorAll('.del').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const d = e.target.dataset.date;
      if(!confirm(`Delete entry ${d}?`)) return;
      const o = loadEntries(); delete o[d]; saveEntries(o);
      const currentMonth = monthSelect.value;
      if(currentMonth) buildGridForMonth(currentMonth);
      renderEntriesTable(); updateCharts();
    });
  });
  entryTbody.querySelectorAll('.edit').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const d = e.target.dataset.date;
      // focus row in grid if visible
      const row = gridWrap.querySelector(`tr[data-date="${d}"]`);
      if(row) row.scrollIntoView({behavior:'smooth',block:'center'});
      // no inline edit UI: user can change radio in grid or delete+recreate
    });
  });
}

// chart management
let monthlyChart = null, monthlyMealsChart = null, yearlyChart = null;

function getDailyMealsForMonth(monthKey){
  const entries = loadEntries();
  if(!monthKey) return {labels:[], data:[]};
  const [y,m] = monthKey.split('-').map(Number);
  const days = daysInMonth(y,m);
  const labels = [], data = [];
  for(let d=1; d<=days; d++){
    const date = `${monthKey}-${String(d).padStart(2,'0')}`;
    labels.push(String(d));
    data.push(Number(entries[date] || 0));
  }
  return {labels,data};
}

function getLastNMonthKeys(n=12) {
  const now = new Date();
  const keys = [];
  // Start from 6 months ago (-5) and show up to 6 months ahead (+6)
  for(let i = -5; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return keys;
}

function updateMonthlyChart(){
  const mk = monthSelect.value;
  const {labels,data} = getDailyMealsForMonth(mk);
  if(monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(monthlyCtx, {
    type:'bar',
    data:{labels, datasets:[{label:`Meals per day (${mk})`, data, backgroundColor:'rgba(54,162,235,0.7)'}]},
    options:{scales:{y:{beginAtZero:true}}}
  });
  // update monthly total display in console or dev; also compute cost if rate available
  const total = data.reduce((a,b)=>a+b,0);
  // set mealRate value if stored for this month
  const rates = loadRates();
  if(rates[mk]) mealRateInput.value = rates[mk];
  // compute cost
  const rate = Number(rates[mk]||0);
  const cost = +(total * rate).toFixed(2);
  // show small alert in footer? keep minimal: set document.title update
  document.title = `Meals: ${total} — Cost: ৳${cost}`;
}

function updateMonthlyMealsChart(){
  const keys = getLastNMonthKeys(12);
  const entries = loadEntries();
  const labels = [], data = [];
  for(const k of keys){
    const total = Object.keys(entries).filter(d=>d.startsWith(k)).reduce((acc,d)=>acc + Number(entries[d]||0), 0);
    labels.push(k);
    data.push(+total.toFixed(2));
  }
  if(monthlyMealsChart) monthlyMealsChart.destroy();
  monthlyMealsChart = new Chart(monthlyMealsCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Past and Future Monthly Meals', // Changed label
        data,
        borderColor: 'rgba(20, 225, 225, 1)',
        backgroundColor: 'rgba(75,192,192,0.15)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {y: {beginAtZero: true}},
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const date = new Date();
              const [y,m] = context.label.split('-');
              const isFeature = new Date(y, m-1) > date;
              return `${context.raw} meals ${isFeature ? '(Planned)' : ''}`;
            }
          }
        }
      }
    }
  });
}

function updateYearlyChart(){
  const keys = getLastNMonthKeys(12);
  const entries = loadEntries();
  const rates = loadRates();
  const labels = [], data = [];
  for(const k of keys){
    const total = Object.keys(entries).filter(d=>d.startsWith(k)).reduce((acc,d)=>acc + Number(entries[d]||0), 0);
    const rate = Number(rates[k]||0);
    labels.push(k);
    data.push(+(total * rate).toFixed(2));
  }
  if(yearlyChart) yearlyChart.destroy();
  yearlyChart = new Chart(yearlyCtx, {
    type:'bar',
    data:{labels, datasets:[{label:'Monthly cost (৳)', data, backgroundColor:'rgba(255,159,64,0.8)'}]},
    options:{scales:{y:{beginAtZero:true, ticks:{callback:v=> '৳'+v}}}}
  });
}

function updateCharts(){
  updateMonthlyChart();
  updateMonthlyMealsChart();
  updateYearlyChart();
}

// event wiring
generateGridBtn.addEventListener('click', ()=>{
  const mk = monthSelect.value;
  if(!mk){ alert('Choose a month first.'); return; }
  buildGridForMonth(mk);
  updateCharts();
});
saveAllBtn.addEventListener('click', saveAllGrid);
clearMonthBtn.addEventListener('click', ()=>{ const mk = monthSelect.value; if(!mk){ alert('Select month first'); return;} clearMonthData(mk); });

// save rate for selected month
mealRateInput.addEventListener('change', ()=>{
  const mk = monthSelect.value;
  if(!mk){ alert('Select month first'); mealRateInput.value=''; return; }
  const rates = loadRates();
  if(mealRateInput.value === '' || Number(mealRateInput.value) <= 0) delete rates[mk];
  else rates[mk] = Number(mealRateInput.value);
  saveRates(rates);
  updateCharts();
});

// initial ui
(function init(){
  // set monthSelect default to current month
  const now = new Date();
  monthSelect.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  // build grid for current month automatically
  buildGridForMonth(monthSelect.value);
  renderEntriesTable();
  updateCharts();
})();