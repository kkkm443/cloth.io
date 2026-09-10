import { configureRuntime } from './runtime.js';
import KeeperApp from './keeper-app.js';
export function installKeeperUpgrade(runtime) { configureRuntime(runtime); return { KeeperApp }; }
