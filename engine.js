// Разбор сцены и рисунки интенсивности. Наружу уходит только уровень 0–20.
// Сокет и вибрация телефона решаются в панели и только для локального адреса.

const PATTERNS = ['wave', 'pulse', 'heartbeat', 'crescendo', 'surf', 'steady', 'edge', 'off'];

const PATTERN_LABEL = {
  wave: 'волна',
  pulse: 'пульс',
  heartbeat: 'сердце',
  crescendo: 'нарастание',
  surf: 'прибой',
  steady: 'ровно',
  edge: 'кромка',
  off: 'тишина',
};

function isLocalDeviceUrl(url) {
  let u;
  try { u = new URL(String(url || '')); } catch (e) { return false; }
  if (u.protocol !== 'ws:' && u.protocol !== 'wss:' && u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  const m = h.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (h.endsWith('.local')) return true;
  return false;
}

function clampLevel(n, cap) {
  const c = Math.max(0, Math.min(20, Number(cap) || 20));
  let v = Number(n) || 0;
  if (v < 0) v = 0;
  if (v > c) v = c;
  return Math.round(v);
}

function parseScene(text) {
  const s = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!s.trim()) return { stop: false, level: null };
  if (/(^|[^a-zа-я])(стоп|stop|safeword|красн(ый|ая)\s+свет)([^a-zа-я]|$)/i.test(s)) {
    return { stop: true, level: 0 };
  }
  const rules = [
    { re: /кульминац|оргазм|climax|кончил|кончает|не выдерж/, level: 19 },
    { re: /сильнее|быстрее|harder|faster|глубже|deeper|дрож|trembl/, level: 15 },
    { re: /стон|moan|rhythm|толч|thrust|внутрь/, level: 12 },
    { re: /поцел|kiss|ласк|caress|нежн|gentle|медленн|slow/, level: 6 },
    { re: /обнял|обняла|рядом|тихо|still|pause|пауза/, level: 2 },
  ];
  let level = null;
  rules.forEach((rule) => { if (level == null && rule.re.test(s)) level = rule.level; });
  return { stop: false, level };
}

function smooth(prev, target) {
  if (target == null) return prev;
  return Math.round(prev * 0.45 + target * 0.55);
}

function patternValue(name, ms) {
  const t = Math.max(0, Number(ms) || 0) / 1000;
  if (name === 'off') return 0;
  if (name === 'steady') return 1;
  if (name === 'wave') return 0.5 + 0.5 * Math.sin(t * Math.PI * 0.8);
  if (name === 'surf') return 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.7), 1.6);
  if (name === 'pulse') return (t % 1.2) < 0.28 ? 1 : 0.08;
  if (name === 'heartbeat') {
    const p = t % 1.15;
    if (p < 0.09 || (p > 0.2 && p < 0.3)) return 1;
    return 0;
  }
  if (name === 'crescendo') return Math.min(1, (t % 12) / 12);
  if (name === 'edge') {
    const base = 0.82;
    return ((t * 3) % 1) > 0.82 ? 0.2 : base;
  }
  return 0.5;
}

function outputLevel(level, pattern, ms, cap) {
  const shaped = (clampLevel(level, cap) / 20) * patternValue(pattern, ms);
  return Math.max(0, Math.min(1, shaped));
}

function defaultCfg() {
  return {
    cap: 14,
    maxMinutes: 20,
    safeword: 'стоп',
    aiControl: false,
    pattern: 'wave',
    deviceUrl: 'ws://127.0.0.1:12345',
    phone: true,
    tellStory: false,
  };
}

const LocalVibeEngine = {
  PATTERNS, PATTERN_LABEL, isLocalDeviceUrl, clampLevel, parseScene, smooth, patternValue, outputLevel, defaultCfg,
};
globalThis.LocalVibeEngine = LocalVibeEngine;
export { LocalVibeEngine };
