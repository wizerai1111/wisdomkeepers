import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the proxy server
const proxyServer = spawn('node', ['src/server/proxy.js'], {
  stdio: 'inherit'
});

// Start the Vite development server
const viteServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit'
});

// Handle process termination
process.on('SIGINT', () => {
  proxyServer.kill();
  viteServer.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  proxyServer.kill();
  viteServer.kill();
  process.exit();
}); 