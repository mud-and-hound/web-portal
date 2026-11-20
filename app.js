const $ = id => document.getElementById(id);
const state = $('status');
const links = $('links');
let records = [];

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  return null;
}

function element(tag, text, cssClass) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cssClass) node.className = cssClass;
  return node;
}

function renderPublic() {
  const query = $('search').value.trim().toLowerCase();
  const results = records.filter(row =>
    safeUrl(row.url) && (row.title + ' ' + row.description).toLowerCase().includes(query)
  );
  links.replaceChildren(...results.map(row => {
    const card = element('a', '', 'card');
    card.href = safeUrl(row.url);
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    const label = element('div');
    label.append(element('h3', row.title), element('p', row.description));
    const arrow = element('span', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    card.append(element('span', row.title.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase(), 'mark'), label, arrow);
    return card;
  }));
  state.textContent = results.length ? '' : 'ไม่พบลิงก์ที่ตรงกับการค้นหา';
}

async function loadPublic() {
  state.textContent = 'กำลังโหลดลิงก์…';
  try {
    const response = await fetch('./links.json');
    if (!response.ok) throw new Error('Could not load links');
    records = await response.json();
    $('search').addEventListener('input', renderPublic);
    renderPublic();
  } catch { state.textContent = 'โหลดลิงก์ไม่สำเร็จ กรุณาลองรีเฟรชหน้า'; }
}

loadPublic();
