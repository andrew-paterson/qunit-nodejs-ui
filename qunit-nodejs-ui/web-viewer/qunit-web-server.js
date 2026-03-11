import express from 'express';
import livereload from 'livereload';
import path from 'path';
import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';
import nodeSundries from 'node-sundries';
const app = express();
const livereloadPort = nodeSundries.getNamedArgVal('--ui-port') || 8000;
const resultsUpdatedWsPort =
  nodeSundries.getNamedArgVal('--server-port') || 3000;

const ports = {
  ui: livereloadPort,
  server: resultsUpdatedWsPort,
};
fs.writeFileSync('./public/ports.json', JSON.stringify(ports, null, 2));
fs.writeFileSync(
  './public/ports.js',
  `const uiPort = ${ports.ui};\nconst serverPort = ${ports.server}`,
);

const pathToTestRunnerScript =
  nodeSundries.getNamedArgVal('--test-runner-path');
// Create a livereload server and watch your public directory
const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(process.cwd(), 'public'));

// Ping the browser on Express boot once connected
liveReloadServer.server.once('connection', () => {
  liveReloadServer.refresh('/');
});
updateEnvFile({ serverPort: resultsUpdatedWsPort });
// Serve static files (e.g., HTML, CSS, JS)
app.use(express.static('public'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(livereloadPort, () => {
  console.log(
    `QUnit browser results available at http://localhost:${livereloadPort}?initialise`,
  );
});

// Create an HTTP server using Express
const server = http.createServer(app);
// Create a WebSocket server instance attached to the HTTP server
const wss = new WebSocket.Server({ server });

let _ws;

// Handle WebSocket connections
wss.on('connection', (ws) => {
  _ws = ws;
  _ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);
    if (parsedMessage.action === 'run-tests') {
      runTests(parsedMessage.params);
    }

    if (parsedMessage.action === 'cancel-run') {
      console.log('cancelling run -------------------------');
      cancelRun();
    }
  });
});

app.get('/trigger-live-reload', (req, res) => {
  res.send('ok');
  liveReloadServer.refresh('/');
});

app.post('/results-updated', express.json(), (req, res) => {
  if (_ws) {
    _ws.send(JSON.stringify(req.body));
  }
  res.send('ok');
});

server.listen(resultsUpdatedWsPort, () => {
  console.log(
    `WebSocket server for results updates listening on port ${resultsUpdatedWsPort}`,
  );
});

let child;

async function runTests(queryParams) {
  const { spawn } = await import('child_process');
  const cwd = new URL('..', import.meta.url).pathname;
  updateEnvFile({ queryParams: queryParams, src: 'web-viewer' });
  child = spawn(
    'bash',
    [
      path.resolve(process.cwd(), './run-tests.sh'),
      path.resolve(process.cwd(), pathToTestRunnerScript),
    ],
    {
      cwd,
      stdio: 'inherit',
    },
  );

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', () => reject);
  });
}

function cancelRun() {
  updateEnvFile({ cancelRun: true });
}

function updateEnvFile(updates) {
  const envFilePath = path.resolve(process.cwd(), './test-runner.env.json');
  let envData = {};
  if (fs.existsSync(envFilePath)) {
    const fileContent = fs.readFileSync(envFilePath, 'utf-8');
    envData = JSON.parse(fileContent);
  }
  Object.assign(envData, updates);
  fs.writeFileSync(envFilePath, JSON.stringify(envData, null, 2));
}
