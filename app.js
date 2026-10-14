function bootVibe(host) {
  const shell = globalThis.LocalShell;
  const eng = globalThis.LocalVibeEngine;
  const ui = shell.mount({
    id: 'vibe', glyph: '≋', label: 'Локальный вайб', accent: '#c48bb8', bottom: 336, right: 16,
  });

  let cfg = eng.defaultCfg();
  let level = 0;
  let running = false;
  let locked = false;
  let started = 0;
  let log = [];
  let socket = null;
  let deviceIndex = null;
  let msgId = 1;
  let timer = null;
  let view = 'main';

  function pushLog(text) {
    log.unshift({ t: Date.now(), text });
    log = log.slice(0, 12);
  }

  async function load() {
    const saved = await host.load('cfg');
    if (saved && typeof saved === 'object') cfg = Object.assign(eng.defaultCfg(), saved);
    if (!eng.isLocalDeviceUrl(cfg.deviceUrl)) cfg.deviceUrl = 'ws://127.0.0.1:12345';
  }

  async function save() { await host.save('cfg', cfg); publish(); }

  function publish() {
    if (!cfg.tellStory) { host.setContext(''); return; }
    if (!running) { host.setContext(''); return; }
    host.setContext('[В сцене есть локальный отклик интенсивности ' + level + ' из ' + cfg.cap + '. Не называй марки и не описывай интерфейс. Пиши только ощущение.]');
  }

  function stopHardware() {
    buzz(0);
    sendScalar(0);
  }

  function panic(why) {
    running = false;
    level = 0;
    locked = why === 'word';
    stopHardware();
    pushLog(why === 'word' ? 'стоп-слово, пульт заперт' : 'стоп');
    publish();
    render();
  }

  function buzz(amount) {
    const nav = shell.win().navigator;
    if (!cfg.phone || !nav || !nav.vibrate) return;
    if (amount <= 0.05) { nav.vibrate(0); return; }
    nav.vibrate(Math.round(40 + amount * 80));
  }

  function sendScalar(amount) {
    if (!socket || socket.readyState !== 1 || deviceIndex == null) return;
    const id = ++msgId;
    const body = [{
      ScalarCmd: {
        Id: id,
        DeviceIndex: deviceIndex,
        Scalars: [{ Index: 0, Scalar: Math.max(0, Math.min(1, amount)), ActuatorType: 'Vibrate' }],
      },
    }];
    try { socket.send(JSON.stringify(body)); } catch (e) { pushLog('устройство не приняло команду'); }
  }

  function connect() {
    if (!eng.isLocalDeviceUrl(cfg.deviceUrl)) {
      ui.toast('Адрес не локальный. Нужен этот компьютер или домашняя сеть.');
      return;
    }
    const prevSock = shell.win().__lxVibeSocket;
    try { if (prevSock) prevSock.close(); } catch (e) {}
    try { if (socket) socket.close(); } catch (e) {}
    pushLog('соединяюсь с ' + cfg.deviceUrl);
    let ws;
    const WS = shell.win().WebSocket;
    if (!WS) { ui.toast('В этом клиенте нет сокета'); return; }
    try { ws = new WS(cfg.deviceUrl); } catch (e) { ui.toast('Сокет не открылся'); return; }
    socket = ws;
    shell.win().__lxVibeSocket = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify([{ RequestServerInfo: { Id: ++msgId, ClientName: 'local-vibe', MessageVersion: 3 } }]));
    };
    ws.onmessage = (ev) => {
      let data = [];
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      if (!Array.isArray(data)) return;
      data.forEach((msg) => {
        if (msg.ServerInfo) {
          ws.send(JSON.stringify([{ RequestDeviceList: { Id: ++msgId } }]));
          ws.send(JSON.stringify([{ StartScanning: { Id: ++msgId } }]));
          pushLog('локальный сервер ответил');
        }
        const added = msg.DeviceAdded && msg.DeviceAdded.DeviceIndex;
        const list = msg.DeviceList && msg.DeviceList.Devices;
        if (added != null) deviceIndex = msg.DeviceAdded.DeviceIndex;
        if (Array.isArray(list) && list[0]) deviceIndex = list[0].DeviceIndex;
        if (deviceIndex != null) pushLog('устройство #' + deviceIndex);
      });
      render();
    };
    ws.onerror = () => pushLog('сокет оборвался');
    ws.onclose = () => { if (socket === ws) socket = null; deviceIndex = null; render(); };
  }

  function tick() {
    if (!running) return;
    if (cfg.maxMinutes > 0 && Date.now() - started > cfg.maxMinutes * 60000) {
      panic('time');
      ui.toast('Автостоп');
      return;
    }
    const out = eng.outputLevel(level, cfg.pattern, Date.now() - started, cfg.cap);
    buzz(out);
    sendScalar(out);
  }

  function ensureTimer() {
    const w = shell.win();
    if (w.__lxVibeTick) clearInterval(w.__lxVibeTick);
    timer = setInterval(tick, 250);
    w.__lxVibeTick = timer;
  }

  function consider(text, fromUser) {
    const word = String(cfg.safeword || '').trim().toLowerCase();
    if (fromUser && word && String(text || '').toLowerCase().indexOf(word) !== -1) {
      panic('word');
      return;
    }
    if (!cfg.aiControl || locked) return;
    const parsed = eng.parseScene(text);
    if (parsed.stop) { panic('word'); return; }
    if (parsed.level == null) return;
    level = eng.smooth(level, eng.clampLevel(parsed.level, cfg.cap));
    if (!running && level > 0) { running = true; started = Date.now(); }
    pushLog('сцена → ' + level);
    publish();
    if (!ui.body.closest('section').hidden && view === 'main') render();
  }

  function renderMain() {
    ui.setBack(null);
    ui.setTitle(locked ? 'заперто' : (running ? 'идёт' : 'тихо'), 'Вайб');
    const pct = Math.round((level / 20) * 100);
    const linked = socket && socket.readyState === 1;
    ui.body.innerHTML =
      '<div class="lx-card"><div class="lx-muted">уровень ' + level + ' / ' + cfg.cap + ' · ' + shell.esc(eng.PATTERN_LABEL[cfg.pattern] || cfg.pattern) + '</div>' +
      '<div class="lx-bar" style="height:18px;margin-top:8px"><span style="width:' + pct + '%"></span></div></div>' +
      '<label class="lx-field">Руками<input id="lx-level" type="range" min="0" max="' + cfg.cap + '" value="' + level + '"></label>' +
      '<div class="lx-grid">' + eng.PATTERNS.map((p) =>
        '<button type="button" class="lx-btn' + (cfg.pattern === p ? ' primary' : '') + '" data-act="pat" data-p="' + p + '">' + shell.esc(eng.PATTERN_LABEL[p]) + '</button>'
      ).join('') + '</div>' +
      '<div class="lx-row"><button type="button" class="lx-btn primary" data-act="run">' + (running ? 'Стоп' : 'Пуск') + '</button>' +
      '<button type="button" class="lx-btn" data-act="panic">Стоп сразу</button></div>' +
      '<div class="lx-muted">' + (linked ? 'локальное устройство на связи' : 'устройство не подключено — остаётся экран и вибрация телефона') + '</div>' +
      '<div class="lx-row"><button type="button" class="lx-btn" data-act="go" data-view="gear">Потолок и слово</button>' +
      '<button type="button" class="lx-btn" data-act="go" data-view="link">Устройство</button></div>' +
      '<div class="lx-list">' + log.map((l) => '<div class="lx-muted">' + shell.esc(l.text) + '</div>').join('') + '</div>';
    ui.body.querySelector('#lx-level').addEventListener('input', (e) => {
      if (locked) return;
      level = eng.clampLevel(e.target.value, cfg.cap);
      if (level > 0 && !running) { running = true; started = Date.now(); }
      publish();
    });
  }

  function renderGear() {
    ui.setBack(() => { view = 'main'; render(); });
    ui.setTitle('границы', 'Потолок');
    ui.body.innerHTML =
      '<label class="lx-row"><input type="checkbox" id="lx-ai"' + (cfg.aiControl ? ' checked' : '') + '> Слушать ответы персонажа</label>' +
      '<label class="lx-row"><input type="checkbox" id="lx-phone"' + (cfg.phone ? ' checked' : '') + '> Вибрация этого телефона</label>' +
      '<label class="lx-row"><input type="checkbox" id="lx-tell"' + (cfg.tellStory ? ' checked' : '') + '> Намёк персонажу, без марок</label>' +
      '<label class="lx-field">Потолок<select id="lx-cap">' + [5, 10, 14, 17, 20].map((n) =>
        '<option value="' + n + '"' + (Number(cfg.cap) === n ? ' selected' : '') + '>' + n + ' / 20</option>').join('') + '</select></label>' +
      '<label class="lx-field">Автостоп<select id="lx-min">' +
        [[5, '5 мин'], [10, '10 мин'], [20, '20 мин'], [45, '45 мин'], [0, 'без автостопа']].map((pair) =>
          '<option value="' + pair[0] + '"' + (Number(cfg.maxMinutes) === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>').join('') +
      '</select></label>' +
      '<label class="lx-field">Стоп-слово в твоём сообщении<input id="lx-word" maxlength="40" value="' + shell.esc(cfg.safeword) + '"></label>' +
      '<button type="button" class="lx-btn primary" data-act="save">Сохранить</button>' +
      (locked ? '<button type="button" class="lx-btn" data-act="unlock">Снять замок</button>' : '');
  }

  function renderLink() {
    ui.setBack(() => { view = 'main'; render(); });
    ui.setTitle('только свой адрес', 'Устройство');
    ui.body.innerHTML =
      '<p class="lx-muted">Подходит Intiface на этом компьютере или в домашней сети: localhost, 127.0.0.1, 10.*, 192.168.*, 172.16–31.*. Чужие сайты отклоняются.</p>' +
      '<label class="lx-field">Адрес<input id="lx-url" value="' + shell.esc(cfg.deviceUrl) + '" placeholder="ws://127.0.0.1:12345"></label>' +
      '<button type="button" class="lx-btn primary" data-act="connect">Подключить</button>' +
      '<button type="button" class="lx-btn" data-act="test">Короткий тест</button>';
  }

  function render() {
    if (view === 'gear') return renderGear();
    if (view === 'link') return renderLink();
    return renderMain();
  }

  ui.body.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.getAttribute('data-act');
    if (act === 'go') { view = el.getAttribute('data-view'); render(); return; }
    if (act === 'pat') { cfg.pattern = el.getAttribute('data-p'); await save(); render(); return; }
    if (act === 'run') {
      if (locked) { ui.toast('Сначала сними замок'); return; }
      running = !running;
      if (running) started = Date.now();
      else stopHardware();
      publish();
      render();
      return;
    }
    if (act === 'panic') { panic('button'); return; }
    if (act === 'unlock') { locked = false; ui.toast('Замок снят'); render(); return; }
    if (act === 'save') {
      cfg.aiControl = ui.body.querySelector('#lx-ai').checked;
      cfg.phone = ui.body.querySelector('#lx-phone').checked;
      cfg.tellStory = ui.body.querySelector('#lx-tell').checked;
      cfg.cap = Number(ui.body.querySelector('#lx-cap').value);
      cfg.maxMinutes = Number(ui.body.querySelector('#lx-min').value);
      cfg.safeword = ui.body.querySelector('#lx-word').value.trim() || 'стоп';
      level = eng.clampLevel(level, cfg.cap);
      await save();
      ui.toast('Сохранено на устройстве');
      return;
    }
    if (act === 'connect') {
      const url = ui.body.querySelector('#lx-url').value.trim();
      if (!eng.isLocalDeviceUrl(url)) { ui.toast('Этот адрес не локальный'); return; }
      cfg.deviceUrl = url;
      await save();
      connect();
      return;
    }
    if (act === 'test') {
      const prev = level;
      level = Math.min(cfg.cap, 6);
      running = true;
      started = Date.now();
      tick();
      setTimeout(() => { level = prev; if (!cfg.aiControl) { running = false; stopHardware(); } render(); }, 700);
    }
  });

  host.on('message', async () => {
    const msgs = await host.messages();
    const last = msgs[msgs.length - 1];
    if (!last) return;
    consider(last.text, last.role === 'user');
  });
  host.on('chat', () => panic('chat'));

  ensureTimer();
  const open = async () => { await load(); view = 'main'; ui.open(); render(); };
  host.addMenu('Локальный вайб', open);
  shell.listen(shell.win(), 'open-vibe', 'local-vibe-open', open);
  load();
  return { open, close: () => ui.close() };
}

const LocalVibeApp = { boot: bootVibe };
globalThis.LocalVibeApp = LocalVibeApp;
export { LocalVibeApp };
