import fs from 'fs';
import path from 'path';
import ports from './ports.json' with { type: 'json' };
let serverPort = ports.server;
function postTestResult(allResults, QUnit) {
  if (isCancelled()) {
    console.log('Cancelling test run -------------------------');
    QUnit.config.queue.length = 0;
    fs.unlinkSync(
      path.resolve(process.cwd(), './web-viewer/test-runner.env.json'),
    );
    allResults.meta.runCancelled = true;
  }
  fetch(`http://localhost:${serverPort}/results-updated`, {
    method: 'POST',
    body: JSON.stringify(allResults),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function updateStats(allResults) {
  const { meta, results } = allResults;
  const stats = {};
  stats.all = results.reduce((acc, test) => {
    return acc + (test.assertions.length || 0);
  }, 0);
  stats.passed = results.reduce((acc, test) => {
    return acc + (test.assertions.filter((a) => a.passed).length || 0);
  }, 0);
  stats.bad = results.reduce((acc, test) => {
    return acc + (test.assertions.filter((a) => !a.passed).length || 0);
  }, 0);
  stats.testCount = meta.runStart?.testCounts?.total;
  stats.completed = results.length;
  stats.defined = meta.runStart?.testCounts?.total;
  return stats;
}

export default function (QUnit, beginDetails) {
  let allResults = {
    meta: {
      stats: {},
    },
    results: [],
  };
  allResults.meta.beginDetails = beginDetails;
  postTestResult(allResults, QUnit);

  QUnit.config.reorder = false;

  QUnit.on('runStart', (runStart) => {
    const envPath = path.resolve(
      process.cwd(),
      './web-viewer/test-runner.env.json',
    );
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(path.resolve(envPath));
    }

    setTimeout(() => {
      allResults.meta.runStart = runStart;
      allResults.meta.stats = updateStats(allResults);
      postTestResult(allResults, QUnit);
    }, 1000);
  });

  QUnit.on('testStart', (testStart) => {
    allResults.meta.testStart = testStart;
    allResults.meta.stats = updateStats(allResults);
    postTestResult(allResults, QUnit);
  });

  QUnit.on('testEnd', (testEnd) => {
    testEnd.todo = testEnd.status === 'todo';
    testEnd.type = 'testEnd';
    ['errors', 'assertions'].forEach((k) => {
      const obj = testEnd[k].map((a) => {
        return {
          passed: a.passed || null,
          actual: a.actual || null,
          expected: a.expected || null,
          message: a.message || null,
          stack: a.stack || null,
          todo: a.todo || null,
        };
      });
      testEnd[k] = obj;
    });
    allResults.results.push(testEnd);
    allResults.meta.stats = updateStats(allResults);
    postTestResult(allResults, QUnit);
  });

  QUnit.on('runEnd', (runEnd) => {
    allResults.meta.runEnd = runEnd;
    allResults.meta.stats = updateStats(allResults);
    postTestResult(allResults, QUnit);
  });
}

function isCancelled() {
  const envPath = path.resolve(
    process.cwd(),
    './web-viewer/test-runner.env.json',
  );
  if (!fs.existsSync(envPath)) {
    return false;
  }
  const env = JSON.parse(fs.readFileSync(envPath, 'utf8'));
  return env.cancelRun === true;
}
