const DEFAULT_SUPABASE_URL = 'https://trdwwawnsfokztfrbdmr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZHd3YXduc2Zva3p0ZnJiZG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU4NTQsImV4cCI6MjA4NzgyMTg1NH0.r_sgBwcAofc6aKubWyZJaUKaHcKqTZkl83ikLGXFqmU';
const SUPABASE_URL = globalThis.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = globalThis.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const statusFlow = ['draft', 'submitted', 'checked', 'finalized'];
const state = {
  profile: null,
  plan: null,
  items: [],
  menuMode: null,
  categories: {
    Мясо: ['Курица', 'Говядина', 'Индейка'],
    Овощи: ['Картофель', 'Морковь', 'Лук'],
    Бакалея: ['Рис', 'Мука', 'Гречка']
  },
  popular: ['Курица', 'Рис', 'Картофель', 'Лук', 'Мука', 'Масло']
};

const themeButtons = [...document.querySelectorAll('.segmented-btn')];
const authCard = document.getElementById('auth-card');
const app = document.getElementById('app');
const authMsg = document.getElementById('auth-msg');
const dashboard = document.getElementById('dashboard');
const content = document.getElementById('content');
const actionBar = document.getElementById('action-bar');
const drawer = document.getElementById('drawer');

function saveDraft() {
  localStorage.setItem('rcontrol_plan_draft', JSON.stringify({ plan: state.plan, items: state.items }));
}

function loadDraft() {
  const raw = localStorage.getItem('rcontrol_plan_draft');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.plan = parsed.plan;
    state.items = parsed.items || [];
  } catch {
    localStorage.removeItem('rcontrol_plan_draft');
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('rcontrol_theme', theme);
  themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
}

function badge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

function ensurePlan() {
  if (!state.plan) {
    state.plan = {
      kitchen: 'Кухня №1',
      status: null,
      deadline: '23:59 Asia/Almaty',
      responsible1: '',
      responsible2: '',
      checkCompleted: false
    };
  }
}

function setMenu(mode) {
  state.menuMode = mode;
  drawer.classList.add('hidden');
  renderMain();
}

function setActions(actions) {
  actionBar.innerHTML = '';
  if (!actions.length) {
    actionBar.classList.add('hidden');
    return;
  }
  actionBar.classList.remove('hidden');
  actionBar.classList.toggle('single', actions.length === 1);
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.className = action.accent ? 'btn-accent' : '';
    btn.disabled = Boolean(action.disabled);
    btn.onclick = action.onClick;
    actionBar.appendChild(btn);
  });
}

function renderDashboard() {
  const name = state.profile?.first_name || 'Пользователь';
  const title = state.profile?.gender === 'f' ? 'ханым' : 'мырза';
  ensurePlan();
  dashboard.innerHTML = `
    <h3>Здравствуйте, ${name} ${title}</h3>
    <p class="muted">${state.plan.kitchen}</p>
    <p>Статус плана: ${state.plan.status ? badge(state.plan.status) : 'Пока пусто'}</p>
    ${state.plan.status === 'draft' ? `<span class="badge deadline">Дедлайн: ${state.plan.deadline}</span>` : ''}
  `;
}

function addItem(name, unit = 'kg') {
  if (state.items.some(i => i.name === name)) return;
  state.items.push({ name, unit, planned: '', actual: '', checked: false, comment: '' });
  saveDraft();
  renderMain();
}

function renderChefPlan() {
  ensurePlan();
  if (!state.plan.status) {
    content.innerHTML = '<button id="create-plan" class="btn-accent">Создать план</button>';
    document.getElementById('create-plan').onclick = () => {
      state.plan.status = 'draft';
      saveDraft();
      renderMain();
    };
    setActions([]);
    return;
  }

  const staffOpts = ['Алия', 'Ерлан', 'Нуржан', 'Дина'];
  const rows = state.items.map((item, idx) => `
    <div class="list-card">
      <strong>${item.name}</strong>
      <div class="row">
        <input data-planned="${idx}" type="number" step="0.1" placeholder="План" value="${item.planned}" ${state.plan.status !== 'draft' ? 'disabled' : ''} />
        <input value="${item.unit}" disabled />
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <h3>План закупа</h3>
    <p class="kpi">Позиций: ${state.items.length}</p>

    <div class="list-card">
      <h4>Ответственные</h4>
      <div class="row">
        <select id="r1" ${state.plan.status !== 'draft' ? 'disabled' : ''}>
          <option value="">Ответственный 1</option>
          ${staffOpts.map(s => `<option ${state.plan.responsible1 === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <select id="r2" ${state.plan.status !== 'draft' ? 'disabled' : ''}>
          <option value="">Ответственный 2</option>
          ${staffOpts.map(s => `<option ${state.plan.responsible2 === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="list-card">
      <h4>Популярные товары</h4>
      <div class="pill-row">${state.popular.map(p => `<button class="chip" data-pop="${p}" ${state.plan.status !== 'draft' ? 'disabled' : ''}>${p}</button>`).join('')}</div>
    </div>

    <div class="list-card">
      <h4>Категории</h4>
      ${Object.entries(state.categories).map(([cat, products]) => `
        <details class="details">
          <summary>${cat}</summary>
          <div class="pill-row">${products.map(p => `<button class="chip" data-cat="${p}" ${state.plan.status !== 'draft' ? 'disabled' : ''}>${p}</button>`).join('')}</div>
        </details>
      `).join('')}
    </div>

    <div class="list-card">
      <h4>Добавленные позиции</h4>
      ${rows || '<p class="muted">Позиции пока не добавлены</p>'}
    </div>
  `;

  document.querySelectorAll('[data-pop]').forEach(btn => btn.onclick = () => addItem(btn.dataset.pop));
  document.querySelectorAll('[data-cat]').forEach(btn => btn.onclick = () => addItem(btn.dataset.cat));
  document.querySelectorAll('[data-planned]').forEach(inp => {
    inp.oninput = () => {
      state.items[Number(inp.dataset.planned)].planned = inp.value;
      saveDraft();
    };
  });

  const r1 = document.getElementById('r1');
  const r2 = document.getElementById('r2');
  if (r1) r1.onchange = () => { state.plan.responsible1 = r1.value; saveDraft(); };
  if (r2) r2.onchange = () => { state.plan.responsible2 = r2.value; saveDraft(); };

  const actions = [];
  if (state.plan.status === 'draft') {
    actions.push({ label: 'Черновик', disabled: true });
    actions.push({ label: 'Отправить план', accent: true, onClick: () => { state.plan.status = 'submitted'; saveDraft(); renderMain(); } });
  }
  if (state.plan.status === 'checked') {
    actions.push({ label: 'Закрыть план', accent: true, onClick: () => { state.plan.status = 'finalized'; saveDraft(); renderMain(); } });
  }
  setActions(actions);
}

function renderStorekeeperCheck() {
  ensurePlan();
  if (state.plan.status !== 'submitted' && state.plan.status !== 'checked') {
    content.innerHTML = '<p class="muted">Нет планов со статусом submitted.</p>';
    setActions([]);
    return;
  }

  const readonly = state.plan.status === 'checked';
  const cards = state.items.map((item, idx) => {
    const delta = item.actual && item.planned ? Number(item.actual) - Number(item.planned) : 0;
    const percent = item.actual && item.planned ? ((delta / Number(item.planned || 1)) * 100).toFixed(1) : '0.0';
    return `
      <div class="list-card">
        <strong>${item.name}</strong>
        <p class="muted">План: ${item.planned || 0}</p>
        <input data-actual="${idx}" type="number" step="0.1" placeholder="Факт" value="${item.actual}" ${readonly ? 'disabled' : ''} />
        <label><input data-check="${idx}" type="checkbox" ${item.checked ? 'checked' : ''} ${readonly ? 'disabled' : ''}/> Проверено</label>
        <textarea data-comment="${idx}" placeholder="Комментарий" ${readonly ? 'disabled' : ''}>${item.comment || ''}</textarea>
        <p class="muted">Δ: ${delta.toFixed ? delta.toFixed(2) : delta} | %: ${percent}</p>
      </div>
    `;
  }).join('');

  const checkedCount = state.items.filter(i => i.checked).length;
  const progress = state.items.length ? Math.round((checkedCount / state.items.length) * 100) : 0;
  content.innerHTML = `<h3>Проверка</h3><p class="kpi">Прогресс проверки: ${progress}%</p>${cards || '<p class="muted">Нет строк плана</p>'}`;

  document.querySelectorAll('[data-actual]').forEach(inp => inp.oninput = () => { state.items[Number(inp.dataset.actual)].actual = inp.value; saveDraft(); });
  document.querySelectorAll('[data-check]').forEach(inp => inp.onchange = () => { state.items[Number(inp.dataset.check)].checked = inp.checked; saveDraft(); renderMain(); });
  document.querySelectorAll('[data-comment]').forEach(inp => inp.oninput = () => { state.items[Number(inp.dataset.comment)].comment = inp.value; saveDraft(); });

  setActions(readonly ? [] : [{ label: 'Завершить проверку', accent: true, onClick: () => { state.plan.status = 'checked'; saveDraft(); renderMain(); } }]);
}

function renderViewer() {
  const rows = state.items.map(i => {
    const p = Number(i.planned || 0);
    const a = Number(i.actual || 0);
    const d = a - p;
    const pr = p ? ((d / p) * 100).toFixed(1) : '0.0';
    return `<div class="list-card"><strong>${i.name}</strong><p>План: ${p} | Факт: ${a} | Δ: ${d.toFixed(1)} | %: ${pr}</p></div>`;
  }).join('');
  content.innerHTML = `<h3>Просмотр</h3>${rows || '<p class="muted">Нет данных</p>'}`;
  setActions([]);
}

function renderProfile() {
  content.innerHTML = `
    <h3>Профиль</h3>
    <input value="${state.profile.first_name}" disabled />
    <input value="${state.profile.last_name}" disabled />
    <input value="${state.profile.phone}" disabled />
  `;
  setActions([]);
}

function renderHistory() {
  content.innerHTML = '<h3>История планов</h3><p class="muted">Декоративный список, подключение к данным позже.</p>';
  setActions([]);
}

function renderAnalytics() {
  const checked = state.items.filter(i => i.checked).length;
  const total = state.items.length;
  const percent = total ? Math.round((checked / total) * 100) : 0;
  const top = [...state.items]
    .map(i => ({ name: i.name, delta: Math.abs(Number(i.actual || 0) - Number(i.planned || 0)) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);

  content.innerHTML = `
    <h3>Аналитика</h3>
    <p class="kpi">% проверенных: ${percent}%</p>
    <p class="kpi">Общее количество позиций: ${total}</p>
    <p class="kpi">Топ отклонений: ${top.map(t => `${t.name} (${t.delta.toFixed(1)})`).join(', ') || '—'}</p>
  `;
  setActions([]);
}

function renderMain() {
  renderDashboard();
  if (state.menuMode === 'profile') return renderProfile();
  if (state.menuMode === 'history') return renderHistory();
  if (state.menuMode === 'analytics') return renderAnalytics();

  if (state.profile.role === 'chef') return renderChefPlan();
  if (state.profile.role === 'storekeeper') return renderStorekeeperCheck();
  if (state.profile.role === 'viewer') return renderViewer();
  return renderChefPlan();
}

async function loadProfile() {
  const demo = localStorage.getItem('rcontrol_demo_profile');
  if (demo) {
    state.profile = JSON.parse(demo);
    authCard.classList.add('hidden');
    app.classList.remove('hidden');
    loadDraft();
    renderMain();
    return;
  }

  const { data: authData } = await sb.auth.getUser();
  if (!authData?.user) {
    authCard.classList.remove('hidden');
    app.classList.add('hidden');
    return;
  }

  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', authData.user.id).single();
  if (error || !profile) {
    authMsg.textContent = 'Профиль не найден.';
    return;
  }

  state.profile = {
    role: profile.role,
    first_name: profile.full_name.split(' ')[0] || 'Пользователь',
    last_name: profile.full_name.split(' ')[1] || '',
    phone: '+7 700 000 00 00',
    gender: 'f'
  };
  authCard.classList.add('hidden');
  app.classList.remove('hidden');
  loadDraft();
  renderMain();
}

setTheme(localStorage.getItem('rcontrol_theme') || 'light');
themeButtons.forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));

document.getElementById('menu-btn').addEventListener('click', () => drawer.classList.toggle('hidden'));
document.querySelectorAll('[data-menu]').forEach(btn => btn.addEventListener('click', () => setMenu(btn.dataset.menu)));

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  authMsg.textContent = error ? error.message : 'Успешный вход';
  if (!error) {
    state.menuMode = null;
    loadProfile();
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  localStorage.removeItem('rcontrol_demo_profile');
  await sb.auth.signOut();
  state.profile = null;
  state.menuMode = null;
  drawer.classList.add('hidden');
  loadProfile();
});

loadProfile();
