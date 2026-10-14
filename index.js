import './shell.js';
import './engine.js';
import './app.js';
import { createSillyHost } from './st-host.js';

globalThis.LocalVibeApp.boot(createSillyHost('vibe'));
