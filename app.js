const STORAGE_KEY = 'workshop-procurement-v1';
const USER_KEY = 'workshop-procurement-user';

const users = [
  { id: 'chef-sushi-1', name: 'Старший Суши #1', role: 'chef', workshops: ['sushi'] },
  { id: 'chef-sushi-2', name: 'Старший Суши #2', role: 'chef', workshops: ['sushi'] },
  { id: 'chef-panasia-1', name: 'Старший Паназия #1', role: 'chef', workshops: ['panasia'] },
  { id: 'chef-panasia-2', name: 'Старший Паназия #2', role: 'chef', workshops: ['panasia'] },
  { id: 'chef-pizza-1', name: 'Старший Пицца #1', role: 'chef', workshops: ['pizza'] },
  { id: 'chef-pizza-2', name: 'Старший Пицца #2', role: 'chef', workshops: ['pizza'] },
  { id: 'chef-pizza-3', name: 'Старший Пицца #3', role: 'chef', workshops: ['pizza'] },
  { id: 'buyer-1', name: 'Закупщик #1', role: 'buyer', workshops: ['sushi', 'panasia', 'pizza'] },
  { id: 'admin-me', name: 'Админ (я)', role: 'admin', workshops: ['sushi', 'panasia', 'pizza'] },
  { id: 'owner', name: 'Владелец кафе', role: 'admin', workshops: ['sushi', 'panasia', 'pizza'] }
];

const templates = {
  sushi: [
    { name: 'Лосось', category: 'Рыба', unit: 'кг', from: 'Центральный', to: 'Суши-цех' },
    { name: 'Рис для суши', category: 'Крупы', unit: 'кг', from: 'Центральный', to: 'Суши-цех' },
    { name: 'Нори', category: 'Сухие товары', unit: 'упак', from: 'Центральный', to: 'Суши-цех' }
  ],
  panasia: [
    { name: 'Лапша удон', category: 'Крупы', unit: 'кг', from: 'Центральный', to: 'Паназия-цех' },
    { name: 'Соус терияки', category: 'Соусы', unit: 'л', from: 'Центральный', to: 'Паназия-цех' },
    { name: 'Курица филе', category: 'Мясо', unit: 'кг', from: 'Центральный', to: 'Паназия-цех' }
  ],
  pizza: [
    { name: 'Мука', category: 'Крупы', unit: 'кг', from: 'Центральный', to: 'Пицца-цех' },
    { name: 'Сыр моцарелла', category: 'Молочка', unit: 'кг', from: 'Центральный', to: 'Пицца-цех' },
    { name: 'Томатный соус', category: 'Соусы', unit: 'л', from: 'Центральный', to: 'Пицца-цех' }
  ]
};

const workshopNames = { sushi: 'Суши', panasia: 'Паназия', pizza: 'Пицца' };

let state = loadState();
let selectedDate = kzToday();
let selectedWorkshop = 'sushi';
let mode = 'plan';
let selectedUserId = loadUser();
let currentSection = 'planning';

const dayPicker = document.getElementById('dayPicker');
const itemsTableBody = document.getElementById('itemsTableBody');
const closeDayBtn = document.getElementById('closeDayBtn');
const transferBody = document.getElementById('transferBody');
const categoryFilter = document.getElementById('categoryFilter');
const itemSearch = document.getElementById('itemSearch');
const addItemBtn = document.getElementById('addItemBtn');
const startReconciliationBtn = document.getElementById('startReconciliationBtn');
const dayRuleHint = document.getElementById('dayRuleHint');
const userSelect = document.getElementById('userSelect');
const accessHint = document.getElementById('accessHint');
const reconciliationList = document.getElementById('reconciliationList');
const tableWrap = document.getElementById('tableWrap');
const accountInfo = document.getElementById('accountInfo');
const appMenu = document.getElementById('appMenu');
const sectionTitle = document.getElementById('sectionTitle');
const workshopTabs = document.getElementById('workshopTabs');
const modeSwitch = document.getElementById('modeSwitch');
const catalogFilters = document.getElementById('catalogFilters');
const globalControls = document.getElementById('globalControls');

init();

function init() {
  dayPicker.value = selectedDate;
  ensureDay(selectedDate);
  migrateState();
  applyAutoCloseByKZT();
  renderUserSelect();
  enforceWorkshopAccess();
  bindEvents();
  render();
}

function bindEvents() {
  dayPicker.addEventListener('change', () => {
    selectedDate = dayPicker.value;
    ensureDay(selectedDate);
    applyAutoCloseByKZT();
    render();
  });

  userSelect.addEventListener('change', () => {
    selectedUserId = userSelect.value;
    saveUser(selectedUserId);
    enforceWorkshopAccess();
    render();
  });

  document.getElementById('menuToggleBtn').addEventListener('click', () => {
    appMenu.classList.toggle('hidden');
  });

  document.querySelectorAll('.menu-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSection = btn.dataset.section;
      document.querySelectorAll('.menu-item').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      if (currentSection === 'reconciliation') mode = 'acceptance';
      if (currentSection === 'planning') mode = 'plan';
      appMenu.classList.add('hidden');
      render();
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(USER_KEY);
    selectedUserId = users[0].id;
    saveUser(selectedUserId);
    renderUserSelect();
    enforceWorkshopAccess();
    appMenu.classList.add('hidden');
    render();
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetWorkshop = tab.dataset.workshop;
      if (!canAccessWorkshop(targetWorkshop)) return;
      selectedWorkshop = targetWorkshop;
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      render();
    });
  });

  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.mode').forEach((m) => m.classList.remove('active'));
      btn.classList.add('active');
      renderWorkshop();
    });
  });

  closeDayBtn.addEventListener('click', () => {
    if (!canCloseDay()) return;
    state.days[selectedDate].closed = true;
    saveState();
    render();
  });

  startReconciliationBtn.addEventListener('click', () => {
    if (!canStartReconciliation()) return;
    state.days[selectedDate].reconciliation[selectedWorkshop] = true;
    saveState();
    mode = 'acceptance';
    document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('active', m.dataset.mode === mode));
    renderWorkshop();
  });

  document.getElementById('historySearch').addEventListener('input', renderHistory);
  document.getElementById('historyWorkshop').addEventListener('change', renderHistory);

  document.getElementById('generateTransferBtn').addEventListener('click', () => {
    if (!canAccessWorkshop(selectedWorkshop)) return;
    buildTransfer();
    document.getElementById('transferView').classList.remove('hidden');
  });

  categoryFilter.addEventListener('change', renderWorkshop);
  itemSearch.addEventListener('input', renderWorkshop);

  addItemBtn.addEventListener('click', () => {
    if (!canAddItems()) {
      alert('Добавлять товары могут только старшие повара своего цеха в лист следующего дня до 00:00 (KZ).');
      return;
    }
    const name = prompt('Название товара:');
    if (!name || !name.trim()) return;

    const category = prompt('Категория товара:', 'Прочее') || 'Прочее';
    const unit = prompt('Единица измерения:', 'шт') || 'шт';
    const from = prompt('Склад-отправитель:', 'Центральный') || 'Центральный';
    const to = prompt('Склад-получатель:', `${workshopNames[selectedWorkshop]}-цех`) || `${workshopNames[selectedWorkshop]}-цех`;

    state.days[selectedDate].workshops[selectedWorkshop].push({ name: name.trim(), category: category.trim(), unit: unit.trim(), from: from.trim(), to: to.trim(), plan: 0, fact: 0, comment: '' });
    saveState();
    renderWorkshop();
  });
}

function ensureDay(date) {
  if (state.days[date]) return;
  state.days[date] = {
    closed: false,
    reconciliation: { sushi: false, panasia: false, pizza: false },
    workshops: Object.fromEntries(
      Object.entries(templates).map(([key, items]) => [
        key,
        items.map((item) => ({ ...item, plan: 0, fact: 0, comment: '' }))
      ])
    )
  };
  saveState();
}

function migrateState() {
  Object.values(state.days).forEach((day) => {
    if (!day.reconciliation) day.reconciliation = { sushi: false, panasia: false, pizza: false };
    Object.values(day.workshops).forEach((rows) => {
      rows.forEach((row) => {
        if (!row.category) row.category = 'Без категории';
      });
    });
  });
  saveState();
}

function applyAutoCloseByKZT() {
  const nowDate = kzToday();
  Object.entries(state.days).forEach(([date, day]) => {
    if (!day.closed && date < nowDate) day.closed = true;
  });
  saveState();
}

function render() {
  applyAutoCloseByKZT();
  renderTabsAccess();
  renderAccessHint();
  renderHistoryWorkshopFilter();
  renderAccount();
  syncSectionLayout();

  const showWorkshop = ['planning', 'reconciliation'].includes(currentSection);
  document.getElementById('workshopView').classList.toggle('hidden', !showWorkshop);
  document.getElementById('historyView').classList.toggle('hidden', currentSection !== 'history');
  document.getElementById('accountView').classList.toggle('hidden', currentSection !== 'account');
  document.getElementById('transferView').classList.add('hidden');

  if (currentSection === 'history') return renderHistory();
  if (currentSection === 'account') return;
  renderWorkshop();
}

function syncSectionLayout() {
  const titles = {
    planning: 'Запланировать закуп',
    reconciliation: 'Проверка закупа',
    history: 'История',
    account: 'Аккаунт'
  };
  sectionTitle.textContent = titles[currentSection] || 'Учёт закупа';

  const isWorkSection = ['planning', 'reconciliation'].includes(currentSection);
  workshopTabs.classList.toggle('hidden', !isWorkSection);
  modeSwitch.classList.toggle('hidden', !isWorkSection);
  catalogFilters.classList.toggle('hidden', !isWorkSection);

  globalControls.classList.toggle('hidden', currentSection === 'account');
  closeDayBtn.classList.toggle('hidden', currentSection !== 'reconciliation');

  if (currentSection === 'planning') mode = 'plan';
  if (currentSection === 'reconciliation') mode = 'acceptance';

  document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('active', m.dataset.mode === mode));
}

function renderWorkshop() {
  const day = state.days[selectedDate];
  const rows = day.workshops[selectedWorkshop] || [];
  const locked = day.closed;
  const canEditPlan = canEditPlanValues();
  const reconciliationStarted = Boolean(day.reconciliation[selectedWorkshop]);

  closeDayBtn.disabled = !canCloseDay();
  addItemBtn.disabled = !canAddItems();
  startReconciliationBtn.disabled = !canStartReconciliation() || reconciliationStarted;

  dayRuleHint.textContent = buildHintText({ locked, reconciliationStarted, canEditPlan });
  renderCategoryFilter(rows);

  const currentCategory = categoryFilter.value || 'all';
  const searchText = itemSearch.value.trim().toLowerCase();
  const filteredRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => currentCategory === 'all' || row.category === currentCategory)
    .filter(({ row }) => !searchText || row.name.toLowerCase().includes(searchText));

  if (mode === 'acceptance') {
    tableWrap.classList.add('hidden');
    renderReconciliationList(filteredRows, locked);
    return;
  }

  reconciliationList.classList.add('hidden');
  tableWrap.classList.remove('hidden');
  itemsTableBody.innerHTML = '';

  if (!filteredRows.length) {
    itemsTableBody.innerHTML = '<tr><td colspan="6">Нет товаров по выбранным фильтрам.</td></tr>';
    return;
  }

  filteredRows.forEach(({ row, index }) => {
    const tr = document.createElement('tr');
    if (locked) tr.classList.add('closed');
    tr.innerHTML = `
      <td data-label="Товар">${row.name} <span class="small">(${row.unit})</span></td>
      <td data-label="Категория">${row.category}</td>
      <td data-label="План">${numericInput(row.plan, locked || mode !== 'plan' || !canEditPlan, (v) => updateRow(index, 'plan', v))}</td>
      <td data-label="Факт">${numericInput(row.fact, true, (v) => updateRow(index, 'fact', v))}</td>
      <td data-label="Разница" class="readonly">${(Number(row.fact) - Number(row.plan)).toFixed(2)}</td>
      <td data-label="Комментарий">${textInput(row.comment, locked || !canAccessWorkshop(selectedWorkshop), (v) => updateRow(index, 'comment', v))}</td>
    `;
    itemsTableBody.appendChild(tr);
  });
  attachInputHandlers();
}

function renderReconciliationList(filteredRows, locked) {
  reconciliationList.innerHTML = '';
  reconciliationList.classList.remove('hidden');

  if (!filteredRows.length) {
    reconciliationList.innerHTML = '<li class="reconciliation-card">Нет товаров по выбранным фильтрам.</li>';
    return;
  }

  filteredRows.forEach(({ row, index }) => {
    const li = document.createElement('li');
    li.className = 'reconciliation-card';
    const diff = (Number(row.fact) - Number(row.plan)).toFixed(2);

    li.innerHTML = `
      <div class="recon-title">${row.name} <span class="small">(${row.unit})</span></div>
      <div class="small">Категория: ${row.category}</div>
      <div>План: <b>${Number(row.plan).toFixed(2)}</b></div>
      <label>Факт:
        ${numericInput(row.fact, locked || !canEditFactValues(), (v) => updateRow(index, 'fact', v))}
      </label>
      <div>Разница: <b>${diff}</b></div>
      <label>Комментарий:
        ${textInput(row.comment, locked || !canEditFactValues(), (v) => updateRow(index, 'comment', v))}
      </label>
    `;

    reconciliationList.appendChild(li);
  });

  attachInputHandlers();
}

function buildHintText({ locked, reconciliationStarted, canEditPlan }) {
  const user = getCurrentUser();
  if (locked) return 'День закрыт: редактирование заблокировано.';
  if (user.role === 'buyer') return reconciliationStarted ? 'Сверка запущена. Товары ниже показываются списком для приёмки.' : 'Закупщик видит все цеха, но не добавляет товары. Нажмите «Начать сверку». ';
  if (user.role === 'chef') return canEditPlan ? 'До 00:00 (Казахстан) старший повар заполняет план на завтрашнюю поставку.' : 'План редактируется только для завтрашней даты до 00:00 (Казахстан).';
  return 'Режим администратора: просмотр всех цехов и истории.';
}

function renderCategoryFilter(rows) {
  const categories = [...new Set(rows.map((r) => r.category || 'Без категории'))].sort((a, b) => a.localeCompare(b));
  const currentValue = categoryFilter.value || 'all';
  categoryFilter.innerHTML = ['<option value="all">Все категории</option>', ...categories.map((cat) => `<option value="${cat}">${cat}</option>`)].join('');
  categoryFilter.value = categories.includes(currentValue) ? currentValue : 'all';
}

function renderUserSelect() {
  userSelect.innerHTML = users.map((user) => `<option value="${user.id}">${user.name}</option>`).join('');
  userSelect.value = selectedUserId;
}

function renderAccount() {
  const user = getCurrentUser();
  const workshops = user.workshops.map((ws) => workshopNames[ws]).join(', ');
  accountInfo.textContent = `Роль: ${user.role}. Доступ: ${workshops}.`;
}

function getCurrentUser() {
  return users.find((user) => user.id === selectedUserId) || users[0];
}

function getAllowedWorkshops() {
  return getCurrentUser().workshops;
}

function canAccessWorkshop(workshop) {
  return getAllowedWorkshops().includes(workshop);
}

function canAddItems() {
  const user = getCurrentUser();
  if (user.role !== 'chef') return false;
  if (!canAccessWorkshop(selectedWorkshop)) return false;
  const day = state.days[selectedDate];
  if (!day || day.closed) return false;
  return selectedDate === kzTomorrow();
}

function canEditPlanValues() {
  const user = getCurrentUser();
  if (user.role !== 'chef') return false;
  if (!canAccessWorkshop(selectedWorkshop)) return false;
  const day = state.days[selectedDate];
  if (!day || day.closed) return false;
  return selectedDate === kzTomorrow();
}

function canStartReconciliation() {
  const user = getCurrentUser();
  if (!['buyer', 'admin'].includes(user.role)) return false;
  if (!canAccessWorkshop(selectedWorkshop)) return false;
  const day = state.days[selectedDate];
  return Boolean(day && !day.closed);
}

function canEditFactValues() {
  const user = getCurrentUser();
  if (!['buyer', 'admin'].includes(user.role)) return false;
  const day = state.days[selectedDate];
  if (!day || day.closed) return false;
  if (selectedDate > kzToday()) return false;
  if (!day.reconciliation[selectedWorkshop]) return false;
  return canAccessWorkshop(selectedWorkshop);
}

function canCloseDay() {
  const user = getCurrentUser();
  if (user.role !== 'buyer') return false;
  const day = state.days[selectedDate];
  return Boolean(day && !day.closed);
}

function enforceWorkshopAccess() {
  const allowed = getAllowedWorkshops();
  if (!allowed.includes(selectedWorkshop) && selectedWorkshop !== 'history') selectedWorkshop = allowed[0] || 'sushi';
}

function renderTabsAccess() {
  document.querySelectorAll('.tab').forEach((tab) => {
    const ws = tab.dataset.workshop;
    tab.classList.toggle('hidden', !canAccessWorkshop(ws));
  });
}

function renderAccessHint() {
  const user = getCurrentUser();
  const labels = user.workshops.map((ws) => workshopNames[ws]).join(', ');
  const closeRule = user.role === 'buyer' ? 'Можно закрывать день вручную.' : 'Закрытие вручную недоступно.';
  accessHint.textContent = `Пользователь: ${user.name}. Доступные цеха: ${labels}. ${closeRule}`;
}

function renderHistoryWorkshopFilter() {
  const select = document.getElementById('historyWorkshop');
  const allowed = getAllowedWorkshops();
  const options = allowed.map((ws) => `<option value="${ws}">${workshopNames[ws]}</option>`);
  if (allowed.length > 1) options.unshift('<option value="all">Все доступные</option>');

  const current = select.value;
  select.innerHTML = options.join('');
  select.value = [...allowed, 'all'].includes(current) ? current : (allowed.length > 1 ? 'all' : allowed[0]);
}

function numericInput(value, disabled, onChange) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `<input data-handler="${registerHandler(onChange)}" type="number" step="0.01" value="${safeValue}" ${disabled ? 'disabled' : ''} />`;
}

function textInput(value, disabled, onChange) {
  const escaped = String(value).replaceAll('"', '&quot;');
  return `<input data-handler="${registerHandler(onChange)}" type="text" value="${escaped}" ${disabled ? 'disabled' : ''} />`;
}

const handlers = [];
function registerHandler(fn) {
  handlers.push(fn);
  return handlers.length - 1;
}

function attachInputHandlers() {
  document.querySelectorAll('[data-handler]').forEach((el) => {
    const handler = handlers[Number(el.dataset.handler)];
    el.addEventListener('change', () => handler(el.value));
  });
}

function updateRow(index, key, value) {
  if (!canAccessWorkshop(selectedWorkshop)) return;
  const row = state.days[selectedDate].workshops[selectedWorkshop][index];
  row[key] = key === 'comment' ? value : Number(value || 0);
  saveState();
  renderWorkshop();
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const filterWorkshop = document.getElementById('historyWorkshop').value;
  const searchText = document.getElementById('historySearch').value.trim().toLowerCase();

  const allowedSet = new Set(getAllowedWorkshops());
  const entries = [];
  Object.entries(state.days)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([date, day]) => {
      Object.entries(day.workshops).forEach(([workshop, rows]) => {
        if (!allowedSet.has(workshop)) return;
        if (filterWorkshop !== 'all' && workshop !== filterWorkshop) return;
        rows.forEach((row) => {
          if (searchText && !row.name.toLowerCase().includes(searchText)) return;
          entries.push({ date, workshop, ...row, diff: row.fact - row.plan, closed: day.closed });
        });
      });
    });

  if (!entries.length) {
    container.innerHTML = '<p>По выбранным фильтрам ничего не найдено.</p>';
    return;
  }

  container.innerHTML = entries.map((e) => `<article class="history-card">
    <h3>${e.date} — ${workshopNames[e.workshop]}</h3>
    <div>Товар: <b>${e.name}</b> (${e.unit})</div>
    <div>Категория: ${e.category || 'Без категории'}</div>
    <div>План: ${e.plan} | Факт: ${e.fact} | Разница: ${e.diff.toFixed(2)}</div>
    <div>Комментарий: ${e.comment || '—'}</div>
    <div class="small">Статус дня: ${e.closed ? 'закрыт' : 'открыт'}</div>
  </article>`).join('');
}

function buildTransfer() {
  const day = state.days[selectedDate];
  const rows = day.workshops[selectedWorkshop].filter((r) => Number(r.fact) > 0);
  if (!rows.length) {
    transferBody.innerHTML = '<tr><td colspan="5">Нет данных по факту для перемещения.</td></tr>';
    return;
  }
  transferBody.innerHTML = rows.map((r) => `<tr>
    <td data-label="Товар">${r.name}</td>
    <td data-label="Количество">${Number(r.fact).toFixed(2)}</td>
    <td data-label="Ед.">${r.unit}</td>
    <td data-label="Склад-отправитель">${r.from}</td>
    <td data-label="Склад-получатель">${r.to}</td>
  </tr>`).join('');
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { days: {} };
  } catch {
    return { days: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadUser() {
  const stored = localStorage.getItem(USER_KEY);
  if (users.some((user) => user.id === stored)) return stored;
  return users[0].id;
}

function saveUser(userId) {
  localStorage.setItem(USER_KEY, userId);
}

function formatDateInTimeZone(date, timeZone = 'Asia/Almaty') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

function kzToday() {
  return formatDateInTimeZone(new Date(), 'Asia/Almaty');
}

function kzTomorrow() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return formatDateInTimeZone(now, 'Asia/Almaty');
}
