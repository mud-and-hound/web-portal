import { config } from './config.js';

const $ = id => document.getElementById(id);
const state = $('status');
const links = $('links');
const storageKey = 'mud-web-portal-session';
let session;
try { session = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); }
catch { sessionStorage.removeItem(storageKey); }
let records = [];
let editing = null;

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  return null;
}

function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
  else sessionStorage.removeItem(storageKey);
}

async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(config.url + path, {
    method,
    headers: { apikey: config.key, 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error('Request failed');
    error.status = response.status;
    throw error;
  }
  return response.status === 204 || response.headers.get('content-length') === '0'
    ? null : response.json();
}

async function accessToken() {
  if (!session?.access_token) throw new Error('Sign-in required');
  if (session.expires_at > Date.now() / 1000 + 30) return session.access_token;
  try {
    saveSession(await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: session.refresh_token },
    }));
    return session.access_token;
  } catch (error) {
    if (error.status === 400 || error.status === 401) saveSession(null);
    throw error;
  }
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
    !row.hidden && safeUrl(row.url) && (row.title + ' ' + row.description).toLowerCase().includes(query)
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
    records = config.url
      ? await request('/rest/v1/portal_links?select=title,description,url,hidden&hidden=eq.false&order=position,id')
      : await fetch('./seed.json').then(response => response.json());
    $('search').addEventListener('input', renderPublic);
    renderPublic();
  } catch { state.textContent = 'โหลดลิงก์ไม่สำเร็จ กรุณาลองรีเฟรชหน้า'; }
}

function formTask(form, task, failure) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const buttons = [...form.querySelectorAll('button')].filter(button => !button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    try { await task(new FormData(form)); }
    catch { state.textContent = failure; }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  });
}

function resetEditor() {
  editing = null;
  $('editor').reset();
  $('editor-title').textContent = 'เพิ่มลิงก์';
  $('cancel-edit').hidden = true;
}

async function mutate(path, method, body) {
  const rows = await request(path, { method, body, token: await accessToken(),
    headers: { Prefer: 'return=representation' } });
  if (rows?.length !== 1) throw new Error('No row updated');
}

async function loadAdmin() {
  const token = await accessToken();
  if (await request('/rest/v1/rpc/is_portal_admin', { method: 'POST', body: {}, token }) !== true) {
    saveSession(null);
    $('login').hidden = false;
    $('workspace').hidden = true;
    state.textContent = 'บัญชีนี้ไม่มีสิทธิ์จัดการลิงก์';
    return false;
  }
  records = await request('/rest/v1/portal_links?select=*&order=position,id', { token });
  links.replaceChildren(...records.map(row => {
    const item = element('article', '', 'admin-row');
    item.dataset.hidden = row.hidden;
    const details = element('div');
    details.append(element('strong', row.title), element('p', (row.hidden ? 'ซ่อนอยู่ · ' : 'แสดงอยู่ · ') + (row.url || 'รอ URL')));
    const actions = element('div', '', 'actions');
    const edit = element('button', 'แก้ไข', 'secondary');
    edit.onclick = () => {
      editing = row.id;
      for (const name of ['title', 'url', 'description']) $('editor').elements[name].value = row[name] || '';
      $('editor-title').textContent = 'แก้ไขลิงก์';
      $('cancel-edit').hidden = false;
      $('editor').elements.title.focus();
    };
    const toggle = element('button', row.hidden ? 'กู้คืน' : 'ซ่อน', 'secondary');
    toggle.disabled = !row.url;
    toggle.onclick = async () => {
      toggle.disabled = true;
      try {
        await mutate('/rest/v1/portal_links?id=eq.' + row.id, 'PATCH', { hidden: !row.hidden });
        await loadAdmin();
        state.textContent = row.hidden ? 'กู้คืนลิงก์แล้ว' : 'ซ่อนลิงก์แล้ว';
      } catch { state.textContent = 'เปลี่ยนสถานะลิงก์ไม่สำเร็จ'; }
      finally { toggle.disabled = false; }
    };
    actions.append(edit, toggle);
    item.append(details, actions);
    return item;
  }));
  $('login').hidden = true;
  $('password').hidden = true;
  $('workspace').hidden = false;
  state.textContent = '';
  return true;
}

async function initAdmin() {
  if (!config.url) {
    $('login').hidden = true;
    state.textContent = 'กำลังตั้งค่าฐานข้อมูลสำหรับจัดการลิงก์';
    return;
  }
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('access_token') && hash.has('refresh_token')) {
    history.replaceState(null, '', location.pathname + location.search);
    saveSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'),
      expires_at: Date.now() / 1000 + Number(hash.get('expires_in') || 0) });
    if (['recovery', 'invite'].includes(hash.get('type'))) {
      $('login').hidden = true;
      $('password').hidden = false;
    }
  }

  formTask($('login'), async data => {
    saveSession(await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: data.get('email'), password: data.get('password') },
    }));
    $('login').reset();
    await loadAdmin();
  }, 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน');

  $('reset').onclick = async () => {
    const email = $('login').elements.email;
    if (!email.reportValidity()) return;
    try {
      const redirect = encodeURIComponent(location.origin + location.pathname);
      await request('/auth/v1/recover?redirect_to=' + redirect, { method: 'POST', body: { email: email.value } });
      state.textContent = 'หากอีเมลนี้อยู่ในระบบ คุณจะได้รับลิงก์ตั้งรหัสผ่าน';
    } catch { state.textContent = 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่'; }
  };

  const signup = $('signup');
  signup.onclick = async () => {
    const form = $('login');
    if (!form.reportValidity()) return;
    const email = form.elements.email.value;
    const password = form.elements.password.value;
    if (password.length < 12) {
      state.textContent = 'ใช้รหัสผ่านอย่างน้อย 12 ตัวอักษร';
      return;
    }
    signup.disabled = true;
    try {
      const redirect = encodeURIComponent(location.origin + location.pathname);
      await request('/auth/v1/signup?redirect_to=' + redirect, { method: 'POST', body: { email, password } });
      form.elements.password.value = '';
      state.textContent = 'ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ';
    } catch { state.textContent = 'เปิดบัญชีไม่สำเร็จ กรุณาตรวจสอบอีเมล หรือลองตั้งรหัสผ่านใหม่'; }
    finally { signup.disabled = false; }
  };

  formTask($('password'), async data => {
    await request('/auth/v1/user', { method: 'PUT', token: await accessToken(), body: { password: data.get('password') } });
    $('password').reset();
    await loadAdmin();
  }, 'บันทึกรหัสผ่านไม่สำเร็จ');

  formTask($('editor'), async data => {
    const url = safeUrl(data.get('url'));
    const title = data.get('title').trim();
    if (!url || !title) {
      state.textContent = 'กรุณากรอกชื่อระบบและ URL แบบ https:// หรือ http://';
      return;
    }
    const id = editing;
    await mutate('/rest/v1/portal_links' + (id ? '?id=eq.' + id : ''), id ? 'PATCH' : 'POST',
      { title, url, description: data.get('description').trim() });
    resetEditor();
    await loadAdmin();
    state.textContent = 'บันทึกลิงก์แล้ว';
  }, 'บันทึกลิงก์ไม่สำเร็จ');

  $('cancel-edit').onclick = resetEditor;
  $('logout').onclick = async () => {
    try { await request('/auth/v1/logout?scope=local', { method: 'POST', token: await accessToken() }); }
    catch {}
    saveSession(null);
    resetEditor();
    links.replaceChildren();
    $('login').hidden = false;
    $('workspace').hidden = true;
    state.textContent = 'ออกจากระบบแล้ว';
  };
  if (session && $('password').hidden) {
    try { await loadAdmin(); }
    catch { state.textContent = 'โหลดข้อมูลแอดมินไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง'; }
  }
}

if ($('login')) initAdmin();
else loadPublic();
