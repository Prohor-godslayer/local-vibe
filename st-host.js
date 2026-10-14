// Мост SillyTavern. Генерация идёт через generateQuietPrompt клиента.
// Состояние пишется в settings.json (общее) или в файл чата (chat metadata).
import * as Silly from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';

const eventSource = Silly.eventSource;
const event_types = Silly.event_types;
const extension_prompt_types = Silly.extension_prompt_types;
const extension_prompt_roles = Silly.extension_prompt_roles;
const saveSettingsDebounced = Silly.saveSettingsDebounced;
const generateQuietPrompt = Silly.generateQuietPrompt;
const saveMetadata = Silly.saveMetadata || Silly.saveChatDebounced || (async () => {});

function createSillyHost(appKey) {
  const storeKey = 'local_suite_' + appKey;

  function rootStore() {
    const cur = extension_settings[storeKey];
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) extension_settings[storeKey] = {};
    return extension_settings[storeKey];
  }

  function chatBag() {
    const ctx = getContext();
    if (!ctx.chatMetadata || typeof ctx.chatMetadata !== 'object') ctx.chatMetadata = {};
    if (!ctx.chatMetadata.local_suite || typeof ctx.chatMetadata.local_suite !== 'object') {
      ctx.chatMetadata.local_suite = {};
    }
    const bag = ctx.chatMetadata.local_suite;
    if (!bag[appKey] || typeof bag[appKey] !== 'object') bag[appKey] = {};
    return bag[appKey];
  }

  const host = {
    platform: 'st',
    appKey,
    generating: false,
    async chatId() {
      const ctx = getContext();
      const id = ctx.chatId || (ctx.getCurrentChatId && ctx.getCurrentChatId());
      return String(id || ('char-' + (ctx.characterId ?? 'none')));
    },
    async names() {
      const ctx = getContext();
      return { user: ctx.name1 || 'Ты', char: ctx.name2 || 'Персонаж' };
    },
    async messages() {
      const ctx = getContext();
      const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
      return chat.map((m) => ({
        role: m.is_user ? 'user' : 'ai',
        name: m.name || (m.is_user ? (ctx.name1 || 'Ты') : (ctx.name2 || 'Персонаж')),
        text: String(m.mes || ''),
      }));
    },
    async cardText() {
      const ctx = getContext();
      const ch = ctx.characters && ctx.characters[ctx.characterId];
      if (!ch) return '';
      return [ch.description, ch.personality, ch.scenario].filter(Boolean).join('\n\n');
    },
    async lorebooks() { return []; },
    loreDepth() { return 4; },
    async generate(prompt) {
      host.generating = true;
      try {
        const out = await generateQuietPrompt(String(prompt || ''), false, true);
        return String(out || '').replace(/<think[\s\S]*?<\/think>/gi, '').trim();
      } finally {
        host.generating = false;
      }
    },
    async load(key) {
      const bag = rootStore();
      return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
    },
    async save(key, value) {
      rootStore()[key] = value;
      saveSettingsDebounced();
    },
    async loadChat(key) {
      const bag = chatBag();
      return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
    },
    async saveChat(key, value) {
      chatBag()[key] = value;
      try { await saveMetadata(); } catch (e) { /* старые сборки пишут metadata вместе с чатом */ }
    },
    toast(msg) {
      if (!msg) return;
      try {
        if (globalThis.toastr) globalThis.toastr.info(String(msg));
      } catch (e) { /* панель показывает ту же строку сама */ }
    },
    on(event, fn) {
      const names = {
        message: ['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED'],
        chat: ['CHAT_CHANGED'],
      }[event] || [];
      const bound = [];
      names.forEach((name) => {
        const ev = event_types[name];
        if (!ev) return;
        const wrap = (...args) => {
          if (host.generating) return;
          return fn(...args);
        };
        eventSource.on(ev, wrap);
        bound.push([ev, wrap]);
      });
      return () => bound.forEach(([ev, wrap]) => eventSource.removeListener(ev, wrap));
    },
    setContext(text) {
      const ctx = getContext();
      ctx.setExtensionPrompt(
        'local_' + appKey,
        text ? String(text) : '',
        extension_prompt_types.IN_PROMPT,
        1,
        false,
        extension_prompt_roles.SYSTEM,
      );
    },
    addMenu(label, onClick) {
      const id = 'lx-menu-' + appKey;
      const doc = document;
      if (doc.getElementById(id)) return;
      const el = doc.createElement('div');
      el.id = id;
      el.className = 'list-group-item flex-container flexGap5';
      el.style.cursor = 'pointer';
      el.textContent = label;
      el.addEventListener('click', onClick);
      const menu = doc.getElementById('extensionsMenu');
      if (menu) menu.appendChild(el);
    },
  };
  return host;
}

globalThis.createSillyHost = createSillyHost;
export { createSillyHost };
