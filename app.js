const STORAGE_KEY = 'workshop-procurement-v1';

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
let selectedDate = today();
let selectedWorkshop = 'sushi';
let mode = 'plan';

const dayPicker = document.getElementById('dayPicker');
const itemsTableBody = document.getElementById('itemsTableBody');
const closeDayBtn = document.getElementById('closeDayBtn');
const transferBody = document.getElementById('transferBody');
const categoryFilter = document.getElementById('categoryFilter');
const itemSearch = document.getElementById('itemSearch');
const addItemBtn = document.getElementById('addItemBtn');
const dayRuleHint = document.getElementById('dayRuleHint');

init();

function init() {
  dayPicker.value = selectedDate;
  ensureDay(selectedDate);
  migrateState();
  bindEvents();
  render();
}

function bindEvents() {
  dayPicker.addEventListener('change', () => {
    selectedDate = dayPicker.value;
    ensureDay(selectedDate);
    render();
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      selectedWorkshop = tab.dataset.workshop;
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
    state.days[selectedDate].closed = true;
    saveState();
    render();
  });

  document.getElementById('historySearch').addEventListener('input', renderHistory);
  document.getElementById('historyWorkshop').addEventListener('change', renderHistory);

  document.getElementById('generateTransferBtn').addEventListener('click', () => {
    buildTransfer();
    document.getElementById('transferView').classList.remove('hidden');
  });

  categoryFilter.addEventListener('change', renderWorkshop);
  itemSearch.addEventListener('input', renderWorkshop);

  addItemBtn.addEventListener('click', () => {
    if (!canEditPlanList()) {
      alert('Добавлять товары можно только для текущего дня до 00:00 и если день не закрыт.');
      return;
    }

    const name = prompt('Название товара:');
    if (!name || !name.trim()) return;

    const category = prompt('Категория товара (например: Соусы, Мясо, Овощи):', 'Прочее') || 'Прочее';
    const unit = prompt('Единица измерения (кг, л, упак и т.д.):', 'шт') || 'шт';
    const from = prompt('Склад-отправитель:', 'Центральный') || 'Центральный';
    const to = prompt('Склад-получатель:', `${workshopNames[selectedWorkshop]}-цех`) || `${workshopNames[selectedWorkshop]}-цех`;

    state.days[selectedDate].workshops[selectedWorkshop].push({
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim(),
      from: from.trim(),
      to: to.trim(),
      plan: 0,
      fact: 0,
      comment: ''
    });

    saveState();
    renderWorkshop();
  });
}

function ensureDay(date) {
  if (state.days[date]) return;
  state.days[date] = {
    closed: false,
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
    Object.values(day.workshops).forEach((rows) => {
      rows.forEach((row) => {
        if (!row.category) row.category = 'Без категории';
      });
    });
  });
  saveState();
}

function render() {
  const historyMode = selectedWorkshop === 'history';
  document.getElementById('workshopView').classList.toggle('hidden', historyMode);
  document.getElementById('historyView').classList.toggle('hidden', !historyMode);
  document.getElementById('transferView').classList.add('hidden');

  if (historyMode) {
    renderHistory();
    return;
  }

  renderWorkshop();
}

function renderWorkshop() {
  const day = state.days[selectedDate];
  const rows = day.workshops[selectedWorkshop];
  const locked = day.closed;
  const canEditList = canEditPlanList();

  closeDayBtn.disabled = locked;
  addItemBtn.disabled = !canEditList;

  dayRuleHint.textContent = canEditList
    ? 'До 00:00 старший шеф-повар может добавлять новые товары в список текущего дня.'
    : 'Редактирование списка товаров закрыто: добавление доступно только для текущего дня до 00:00.';

  renderCategoryFilter(rows);

  const currentCategory = categoryFilter.value || 'all';
  const searchText = itemSearch.value.trim().toLowerCase();

  const filteredRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => currentCategory === 'all' || row.category === currentCategory)
    .filter(({ row }) => !searchText || row.name.toLowerCase().includes(searchText));

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
      <td data-label="План">${numericInput(row.plan, locked || mode !== 'plan', (v) => updateRow(index, 'plan', v))}</td>
      <td data-label="Факт">${numericInput(row.fact, locked || mode !== 'acceptance', (v) => updateRow(index, 'fact', v))}</td>
      <td data-label="Разница" class="readonly">${(Number(row.fact) - Number(row.plan)).toFixed(2)}</td>
      <td data-label="Комментарий">${textInput(row.comment, locked, (v) => updateRow(index, 'comment', v))}</td>
    `;

    itemsTableBody.appendChild(tr);
  });

  attachInputHandlers();
}

function renderCategoryFilter(rows) {
  const categories = [...new Set(rows.map((r) => r.category || 'Без категории'))].sort((a, b) => a.localeCompare(b));
  const currentValue = categoryFilter.value || 'all';

  categoryFilter.innerHTML = [
    '<option value="all">Все категории</option>',
    ...categories.map((cat) => `<option value="${cat}">${cat}</option>`)
  ].join('');

  if (categories.includes(currentValue)) {
    categoryFilter.value = currentValue;
  } else {
    categoryFilter.value = 'all';
  }
}

function canEditPlanList() {
  const day = state.days[selectedDate];
  if (!day || day.closed) return false;
  if (selectedDate !== today()) return false;
  return true;
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
  const row = state.days[selectedDate].workshops[selectedWorkshop][index];
  row[key] = key === 'comment' ? value : Number(value || 0);
  saveState();
  renderWorkshop();
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const filterWorkshop = document.getElementById('historyWorkshop').value;
  const searchText = document.getElementById('historySearch').value.trim().toLowerCase();

  const entries = [];
  Object.entries(state.days)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([date, day]) => {
      Object.entries(day.workshops).forEach(([workshop, rows]) => {
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

  container.innerHTML = entries
    .map(
      (e) => `<article class="history-card">
        <h3>${e.date} — ${workshopNames[e.workshop]}</h3>
        <div>Товар: <b>${e.name}</b> (${e.unit})</div>
        <div>Категория: ${e.category || 'Без категории'}</div>
        <div>План: ${e.plan} | Факт: ${e.fact} | Разница: ${e.diff.toFixed(2)}</div>
        <div>Комментарий: ${e.comment || '—'}</div>
        <div class="small">Статус дня: ${e.closed ? 'закрыт' : 'открыт'}</div>
      </article>`
    )
    .join('');
}

function buildTransfer() {
  const day = state.days[selectedDate];
  const rows = day.workshops[selectedWorkshop].filter((r) => Number(r.fact) > 0);

  if (!rows.length) {
    transferBody.innerHTML = '<tr><td colspan="5">Нет данных по факту для перемещения.</td></tr>';
    return;
  }

  transferBody.innerHTML = rows
    .map(
      (r) => `<tr>
      <td data-label="Товар">${r.name}</td>
      <td data-label="Количество">${Number(r.fact).toFixed(2)}</td>
      <td data-label="Ед.">${r.unit}</td>
      <td data-label="Склад-отправитель">${r.from}</td>
      <td data-label="Склад-получатель">${r.to}</td>
    </tr>`
    )
    .join('');
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

function today() {
  return new Date().toISOString().slice(0, 10);
}
