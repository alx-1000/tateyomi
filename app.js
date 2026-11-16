const state = {
  dictionary: [],
  searchIndex: new Map(),
  rows: [],
  lastSelections: new Map(),
  lastSampleIndex: -1,
  animationTimer: null,
};

const samples = [
"春眠不覚暁", 
"国破れて山河在り", 
"白日依山尽", 
"夏草や兵どもが夢の跡",
"山路を登りながらこう考えた",
"我思う故に我あり", 
"少年老い易く学成り難し",
"月落烏啼霜満天",
"紀貫之"
];

const sourceText = document.querySelector('#source-text');
const charCount = document.querySelector('#char-count');
const errorBox = document.querySelector('#error-box');
const longTextNotice = document.querySelector('#long-text-notice');
const composition = document.querySelector('#composition');
const emptyState = document.querySelector('#empty-state');
const resultActions = document.querySelector('#result-actions');
const resultCaption = document.querySelector('#result-caption');
const resultFrame = document.querySelector('#result-frame');
const gridToggle = document.querySelector('#grid-toggle');

async function loadDictionary() {
  try {
    const response = await fetch('dictionary.json');
    if (!response.ok) throw new Error(`辞書の読み込みに失敗しました (${response.status})`);
    state.dictionary = await response.json();
    buildSearchIndex();
  } catch (error) {
    showError('辞書データを読み込めませんでした。dictionary.json と同じ場所からアプリを開いてください。');
    console.error(error);
  }
}

function isKanji(character) {
  return /[一-龯々〆ヵヶ]/u.test(character);
}

function expandOdoriji(text) {
  const characters = [...text];
  const expanded = [];
  characters.forEach((character, index) => {
    expanded.push(character === '々' && index > 0 ? expanded[index - 1] : character);
  });
  return expanded.join('');
}

function isKanjiIdiomForm(text) {
  return /^[一-龯々〆ヵヶ]{4}$/u.test(text);
}

function idiomText(entry) {
  return entry.headword || entry.idiom;
}

function idiomMeaning(entry) {
  if (Array.isArray(entry.gloss)) return entry.gloss.join(' / ');
  return entry.meaning || '意味情報なし';
}

function buildSearchIndex() {
  state.searchIndex = new Map();
  const seen = new Set();
  state.dictionary.forEach((entry) => {
    const forms = [...new Set([idiomText(entry), ...(entry.variants || [])])]
      .filter(isKanjiIdiomForm);
    forms.forEach((displayText) => {
      const searchableCharacters = [...expandOdoriji(displayText)].map((character, position) => ({ character, position }));
      [...displayText].forEach((character, position) => {
        if (character === '々') searchableCharacters.push({ character, position });
      });
      searchableCharacters.forEach(({ character, position }) => {
        const key = `${entry.id || idiomText(entry)}|${displayText}|${character}|${position}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!state.searchIndex.has(character)) state.searchIndex.set(character, []);
        state.searchIndex.get(character).push({ entry, displayText, position });
      });
    });
  });
}

function findCandidates(character) {
  return state.searchIndex.get(character) || [];
}

function randomIndex(length, previousIndex) {
  if (length < 2) return 0;
  let index = Math.floor(Math.random() * length);
  while (index === previousIndex) index = Math.floor(Math.random() * length);
  return index;
}

function makeRows(text, forceDifferent = false) {
  const failures = [];
  const rows = [...text].map((character, rowIndex) => {
    if (!isKanji(character)) return { character, rowIndex, plain: true };
    const candidates = findCandidates(character);
    if (!candidates.length) {
      failures.push({ character, rowIndex: rowIndex + 1 });
      return { character, rowIndex, candidates: [] };
    }
    const previousIndex = forceDifferent ? state.lastSelections.get(rowIndex) : undefined;
    const selectedIndex = randomIndex(candidates.length, previousIndex);
    state.lastSelections.set(rowIndex, selectedIndex);
    return { character, rowIndex, candidates, selectedIndex };
  });
  return { rows, failures };
}

function showError(message, failures = []) {
  if (!message) {
    errorBox.hidden = true;
    errorBox.innerHTML = '';
    return;
  }
  const detail = failures.length
    ? `<br><strong>見つからない文字：</strong> ${[...new Set(failures.map((failure) => `「${failure.character}」`))].join('、')}`
    : '';
  errorBox.innerHTML = `${message}${detail}`;
  errorBox.hidden = false;
}

function render() {
  const targetColumn = 3;
  composition.innerHTML = '';

  state.rows.forEach((row) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'composition-row';
    rowElement.style.paddingLeft = `${row.plain ? targetColumn : targetColumn - row.candidates[row.selectedIndex].position}em`;
    rowElement.dataset.rowIndex = row.rowIndex;

    if (row.plain) {
      const glyph = document.createElement('span');
      glyph.className = 'plain-glyph';
      glyph.textContent = row.character;
      glyph.style.gridColumnStart = targetColumn + 1;
      rowElement.style.paddingLeft = '0';
      rowElement.append(glyph);
      composition.append(rowElement);
      return;
    }

    const selected = row.candidates[row.selectedIndex];
    [...expandOdoriji(selected.displayText)].forEach((character, position) => {
      const button = document.createElement('button');
      button.className = `idiom-button${position === selected.position ? ' target-glyph' : ''}`;
      button.type = 'button';
      button.title = 'クリックで別の候補に変更';
      button.dataset.rowIndex = row.rowIndex;
      button.dataset.position = position;

      const glyph = document.createElement('span');
      glyph.className = `idiom-glyph${position === selected.position ? ' target-glyph' : ''}`;
      glyph.textContent = character;
      button.append(glyph);
      rowElement.append(button);
    });

    const info = document.createElement('span');
    info.className = 'idiom-info';
    info.innerHTML = `<strong>${idiomText(selected.entry)}</strong><small>${selected.entry.reading}</small><p>${idiomMeaning(selected.entry)}</p>`;
    rowElement.append(info);
    composition.append(rowElement);
  });

  composition.hidden = false;
  emptyState.hidden = true;
  resultActions.hidden = false;
  resultCaption.hidden = false;
}

function generate(forceDifferent = false) {
  const text = sourceText.value;
  showError('');
  if (!text) {
    state.rows = [];
    composition.hidden = true;
    emptyState.hidden = false;
    resultActions.hidden = true;
    resultCaption.hidden = true;
    return;
  }
  const result = makeRows(text, forceDifferent);
  if (result.failures.length) {
    state.rows = [];
    composition.hidden = true;
    emptyState.hidden = false;
    resultActions.hidden = true;
    resultCaption.hidden = true;
    showError('この文章は再構成できませんでした。辞書にない漢字が含まれています。', result.failures);
    return;
  }
  state.rows = result.rows;
  render();
}

composition.addEventListener('click', (event) => {
  const button = event.target.closest('.idiom-button');
  if (!button) return;
  const rowIndex = Number(button.dataset.rowIndex);
  const row = state.rows[rowIndex];
  row.selectedIndex = (row.selectedIndex + 1) % row.candidates.length;
  state.lastSelections.set(rowIndex, row.selectedIndex);
  render();
});

document.querySelector('#generate-button').addEventListener('click', () => generate());
document.querySelector('#regenerate-button').addEventListener('click', () => generate(true));
const animationButton = document.querySelector('#animation-button');
animationButton.addEventListener('click', () => {
  if (state.animationTimer) {
    clearInterval(state.animationTimer);
    state.animationTimer = null;
    animationButton.setAttribute('aria-pressed', 'false');
    animationButton.textContent = 'アニメーション';
    return;
  }
  state.animationTimer = setInterval(() => generate(true), 100);
  animationButton.setAttribute('aria-pressed', 'true');
  animationButton.textContent = '停止する';
});
document.querySelector('#sample-button').addEventListener('click', () => {
  let sampleIndex = Math.floor(Math.random() * samples.length);
  while (samples.length > 1 && sampleIndex === state.lastSampleIndex) {
    sampleIndex = Math.floor(Math.random() * samples.length);
  }
  state.lastSampleIndex = sampleIndex;
  sourceText.value = samples[sampleIndex];
  updateCount();
  generate();
  sourceText.focus();
});
sourceText.addEventListener('input', updateCount);
gridToggle.addEventListener('click', () => {
  const enabled = gridToggle.getAttribute('aria-pressed') !== 'true';
  gridToggle.setAttribute('aria-pressed', String(enabled));
  resultFrame.classList.toggle('grid-paper', enabled);
});

function updateCount() {
  const count = [...sourceText.value].length;
  charCount.textContent = count;
  longTextNotice.hidden = count < 40;
}

document.querySelector('#png-button').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  const scale = 2;
  const rows = state.rows;
  const width = 720;
  const rowHeight = 72;
  canvas.width = width * scale;
  canvas.height = Math.max(280, rows.length * rowHeight + 80) * scale;
  const context = canvas.getContext('2d');
  context.scale(scale, scale);
  context.fillStyle = '#fffdf9';
  context.fillRect(0, 0, width, canvas.height / scale);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const axis = width / 2;
  rows.forEach((row, index) => {
    const y = 44 + index * rowHeight;
    if (row.plain) {
      context.fillStyle = '#37645a';
      context.font = '32px serif';
      context.fillText(row.character, axis, y);
      return;
    }
    const selected = row.candidates[row.selectedIndex];
    const startX = axis - (selected.position * 44);
    [...expandOdoriji(selected.displayText)].forEach((character, position) => {
      context.fillStyle = position === selected.position ? '#d65b3f' : '#1d2725';
      context.font = '32px serif';
      context.fillText(character, startX + position * 44, y);
    });
  });
  const link = document.createElement('a');
  link.download = 'tateyomi.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

updateCount();
loadDictionary().then(() => generate());
