const SUPABASE_URL = globalThis.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = globalThis.SUPABASE_ANON_KEY || 'public-anon-key';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const themeButtons = [...document.querySelectorAll('.segmented-btn')];
const authCard = document.getElementById('auth-card');
const appSection = document.getElementById('app');
const content = document.getElementById('content');
const roleNav = document.getElementById('role-nav');

const roleViews = {
  chef: ['Сегодня', 'История', 'Аналитика'],
  storekeeper: ['Сегодня', 'Аналитика'],
  admin: ['Планы', 'Пользователи', 'Staff', 'Аналитика'],
  viewer: ['Просмотр', 'Аналитика']
};

const roleActions = {
  chef: ['Отправить план', 'Закрыть план'],
  storekeeper: ['Завершить проверку'],
  admin: ['Исправить (админ)', 'Вернуть на проверку'],
  viewer: []
};

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('rcontrol_theme', theme);
  themeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
}

const storedTheme = localStorage.getItem('rcontrol_theme') || 'light';
setTheme(storedTheme);
themeButtons.forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));

function badge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

function renderRoleTabs(role) {
  roleNav.innerHTML = '';
  (roleViews[role] || []).forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${i === 0 ? 'active' : ''}`;
    btn.textContent = name;
    btn.onclick = () => {
      roleNav.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderContent(role, name);
    };
    roleNav.appendChild(btn);
  });
}

function renderContent(role, section) {
  const actions = roleActions[role]
    .map(name => `<button class="btn-accent">${name}</button>`)
    .join('');

  const readOnlyNote = role === 'viewer' ? '<p class="muted">Режим только чтение.</p>' : '';
  content.innerHTML = `
    <h3>${section}</h3>
    ${readOnlyNote}
    <p>Статусы: ${badge('draft')} ${badge('submitted')} ${badge('checked')} ${badge('finalized')}</p>
    <div>${actions}</div>
    <hr />
    <p class="muted">Mobile-first интерфейс готов к подключению данных Supabase (plans, plan_items, analytics).</p>
  `;
}

async function loadProfile() {
  const { data: authData } = await sb.auth.getUser();
  if (!authData?.user) {
    authCard.classList.remove('hidden');
    appSection.classList.add('hidden');
    return;
  }

  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', authData.user.id).single();
  if (error || !profile) {
    document.getElementById('auth-msg').textContent = 'Профиль не найден.';
    return;
  }

  authCard.classList.add('hidden');
  appSection.classList.remove('hidden');
  document.getElementById('welcome').textContent = `Здравствуйте, ${profile.full_name}`;
  document.getElementById('role-label').textContent = `Роль: ${profile.role}`;

  renderRoleTabs(profile.role);
  renderContent(profile.role, roleViews[profile.role][0]);
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  document.getElementById('auth-msg').textContent = error ? error.message : 'Успешный вход';
  if (!error) loadProfile();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  loadProfile();
});

loadProfile();
