const rendered = [];
const results = [];
QUnit.config.maxDepth = 50;
let wsData;
updateUI();
const parsedQueryParams = getUrlParams();
if (parsedQueryParams.initialise) {
  document.querySelector('body').classList.add('initialise');
}
const serverPort = parsedQueryParams.server_port || '3000';

function testStart(details) {
  var running, bad;

  running = id('qunit-testresult-display');
  if (running) {
    addClass(running, 'running');
    bad = QUnit.config.reorder && details.previousFailure;
    running.innerHTML = [
      getProgressHtml(config.stats),
      bad ? 'Rerunning previously failed test: <br />' : 'Running: ',
      getNameHtml(details.name, details.module),
      getRerunFailedHtml(stats.failedTests),
    ].join('');
  }
}

function removeEl(identifier) {
  let el;
  if (typeof identifier === 'string') {
    el = document.querySelector(identifier);
  } else {
    el = identifier;
  }
  if (el) {
    el.parentNode.removeChild(el);
  }
}

function removeQueryParam(paramName) {
  const url = new URL(window.location.href); // parse current URL
  url.searchParams.delete(paramName); // remove the param (all occurrences)
  // Build the new path+query+hash (no origin, so replaceState uses a relative URL)
  const newPath =
    url.pathname +
    (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') +
    (url.hash || '');
  history.replaceState(null, '', newPath); // update address bar w/out reload
}

function updateUI() {
  if (!document.getElementById('qunit-tests')?.hasChildNodes()) {
    setTimeout(() => updateUI(), 50);
    return;
  }

  if (parsedQueryParams.initialise) {
    removeQueryParam('initialise');
    const newEl = document.createElement('div');
    newEl.id = 'initialise-feedback';
    newEl.innerHTML = `
    <h2>QUnit has been initialised.</h2>
    <p>You can run a subset of tests using the filter and modules controls above, or run all tests by removing all url params and refreshing the page.</p>

    `;
    document.querySelector('body').classList.add('initialise');

    document.body.appendChild(newEl);
  }

  if (document.querySelector('#qunit-urlconfig-notrycatch')) {
    removeEl(
      document.querySelector('#qunit-urlconfig-notrycatch').parentElement,
    );
  }

  if (document.querySelector('#qunit-urlconfig-noglobals')) {
    removeEl(
      document.querySelector('#qunit-urlconfig-noglobals').parentElement,
    );
  }
}
let didBegin = false;
function update(data) {
  if (!data) {
    return;
  }
  wsData = data;
  config.stats = data.meta.stats;
  if (data.meta.beginDetails && !didBegin) {
    begin(data.meta.beginDetails);
    didBegin = true;
  }

  let obj;
  if (data.meta?.testStart) {
    obj = data.meta.testStart;
    obj.module = obj.suiteName;
    obj.testId = generateHash(obj.suiteName, obj.name);
    testStart(obj);
  }
  data.results
    .filter((test) => !rendered.includes(test.testId))
    .forEach((test) => {
      onTestEnd(test, data.meta);
    });
  if (
    (data.meta.runEnd && data.meta.runCancelled) ||
    data.results.length === data.meta.runStart.testCounts.total
  ) {
    runEnd(data.meta.runEnd);
    return;
  }
}

function abortTests() {
  var abortButton = id('qunit-abort-tests-button');
  if (abortButton) {
    abortButton.disabled = true;
    abortButton.innerHTML = 'Aborting...';
  }
  QUnit.config.queue.length = 0;
  ws.send(JSON.stringify({ action: 'cancel-run' }));

  return false;
}

function onTestEnd(test, meta) {
  setTimeout(() => {
    test.testId = generateHash(test.suiteName, test.name);
    appendTest(test.name, test.testId, test.suiteName);

    const rowContainer = document.getElementById(
      `qunit-test-output-${test.testId}`,
    );
    if (!rowContainer) {
      return;
    }
    rowContainer.classList.add(test.status === 'passed' ? 'pass' : 'fail');
    if (rendered.includes(test.testId)) {
      return;
    }

    test.skipped = test.status === 'skipped';
    test.failed = test.assertions.filter((a) => !a.passed).length;
    test.passed = test.assertions.filter((a) => a.passed).length;

    test.assertions.forEach((assertion) => {
      const details = {
        module: test.suiteName,
        name: test.name,
        result: assertion.passed,
        actual: assertion.actual,
        testId: test.testId,
        negative: false,
        todo: assertion.todo,
        message: assertion.message,
        expected: assertion.expected,
        runtime: 0,
        source: assertion.stack,
      };
      setTimeout(() => log(details));
    });
    testDone(test);
    if (wsData.meta.runEnd) {
      runEnd(wsData.meta.runEnd);
    }
    setTimeout(() => {
      test.assertions.forEach((assertion, index) => {
        assertion.element = getAssertionElement(test, index);
        renderHtml(assertion);
        togglableDiff(assertion);
        insertCopyTextButtons(assertion);
      });
    });

    rendered.push(test.testId);
    results.push(test);
  }, 1000);
}

function renderHtml(assertion) {
  if (
    isValidHTMLPage(assertion.expected) ||
    isValidHTMLPage(assertion.actual)
  ) {
    renderMarkup(
      assertion,
      assertion.actual,
      assertion.passed ? 'Actual & Expected' : 'Actual',
    );
    if (isValidHTMLPage(assertion.expected) && !assertion.passed) {
      renderMarkup(assertion, assertion.expected, 'Expected');
    }
  }
}

function assertionTypes(assertion) {
  return ['.test-expected', '.test-actual', '.test-diff']
    .map((selector) => {
      if (!assertion.element.querySelector(selector)) {
        return;
      }
      const type = selector.replace('.test-', '');
      return {
        type: type,
        element: assertion.element.querySelector(selector),
        text: assertion[type],
      };
    })
    .filter(Boolean);
}

function isValidHTMLPage(str) {
  if (typeof str !== 'string') {
    return false;
  }
  if (
    !str.toLowerCase().startsWith('<!doctype html>') &&
    !str.startsWith('<html')
  ) {
    return false;
  }
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = str;
  // If the body has child nodes, and the input string is not just plain text
  return doc.body.childNodes.length > 0 && doc.body.innerHTML !== str;
}

function togglableDiff(assertion) {
  if (assertion.passed) {
    return;
  }

  const longItems = assertionTypes(assertion).filter(
    (i) => i.text && (i.text || '').length > 2000,
  );

  if (longItems.length === 0) {
    return;
  }

  const items = assertionTypes(assertion);

  items.forEach((item) => {
    const preEl = item.element.querySelector('td > pre');
    if (!preEl) {
      return;
    }
    //  Function to get the rendered height of the <pre> element
    const color = window.getComputedStyle(preEl).color;
    preEl.style.display = 'none';
    const toggleTextButton = document.createElement('button');
    toggleTextButton.textContent = 'Show';
    toggleTextButton.style.marginLeft = '10px';
    applyButtonStyles(toggleTextButton, color);
    toggleTextButton.onclick = () => {
      const isHidden = preEl.style.display === 'none';
      preEl.style.display = isHidden ? 'block' : 'none';
      toggleTextButton.textContent = isHidden ? 'Hide' : 'Show';
      if (preEl.style.display === 'block' && item.type === 'diff') {
        const insDelEls = preEl.querySelectorAll('ins, del');
        const firstNode = insDelEls[0];
        if (firstNode) {
          // Scroll so the element is at the top
          firstNode.scrollIntoView({ block: 'start', behavior: 'smooth' });
          // Adjust by 400px
          window.scrollBy(0, -400);
        }
      }
    };
    preEl.parentElement.insertBefore(toggleTextButton, preEl);
  });
  const diffItem = items.find((i) => i.type === 'diff');
  if (diffItem) {
    const diffPreEl = diffItem.element.querySelector('td > pre');
    const insDelEls = diffPreEl.querySelectorAll('ins, del');
    const htmlMarkup = Array.from(insDelEls)
      .map((node) => node.outerHTML)
      .join('');
  }
}

function insertCopyTextButtons(assertion) {
  const items = assertionTypes(assertion).filter((i) => i.text);
  items.forEach((item) => {
    const preEl = item.element.querySelector('td > pre');
    const color = window.getComputedStyle(preEl).color;

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.marginLeft = '10px';
    applyButtonStyles(copyButton, color);
    copyButton.onclick = () => {
      let text = item.text;
      if (typeof text === 'object' && !Array.isArray(text) && text !== null) {
        text = JSON.stringify(item.text, null, 2);
      }
      navigator.clipboard.writeText(text);
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy';
      }, 500);
    };
    preEl.parentElement.insertBefore(copyButton, preEl);
  });
}

function applyButtonStyles(button, color) {
  button.style.padding = '1px 8px';
  button.style.fontSize = '12px';
  button.style.cursor = 'pointer';
  button.style.color = color;
  button.style.border = `1px solid ${color}`;
  button.style.backgroundColor = 'transparent';
  button.style.borderRadius = '3px';
}

function renderMarkup(assertion, markup, heading) {
  if (!assertion.element.querySelector('.rendered-markup')) {
    const renderContainer = document.createElement('div');
    renderContainer.className = 'rendered-markup';
    renderContainer.style.display = 'flex';
    renderContainer.style.justifyContent = 'flex-start';
    renderContainer.style.height = '535px';
    renderContainer.style.marginTop = '10px';
    renderContainer.style.paddingLeft = '10px';

    const runTimeSpan = assertion.element.querySelector('.runtime');
    if (!runTimeSpan) {
      return;
    }
    runTimeSpan.insertAdjacentElement('afterend', renderContainer);
  }
  const renderContainer = assertion.element.querySelector('.rendered-markup');
  const renderDiv = document.createElement('div');
  renderDiv.style.width = '800px';
  renderDiv.style.height = '800px';
  const iframeEl = document.createElement('iframe');
  iframeEl.style.width = '100%';
  iframeEl.style.height = '750px';
  iframeEl.style.overflow = 'auto';
  iframeEl.style.transform = 'scale(0.65)';
  iframeEl.style.transformOrigin = 'top left';
  iframeEl.style.border = '1px solid #333';
  renderDiv.style.margin = '10px';
  renderDiv.style.marginLeft = '0';
  const headingEl = document.createElement('h4');
  headingEl.style.color = '#000';
  headingEl.style.margin = '0';
  headingEl.style.marginBottom = '10px';
  headingEl.textContent = heading;
  renderDiv.appendChild(headingEl);

  iframeEl.srcdoc = markup;
  renderDiv.appendChild(iframeEl);
  renderContainer.appendChild(renderDiv);
}

function getAssertionElement(test, index) {
  const testEl = document.querySelector(`#qunit-test-output-${test.testId}`);
  if (!testEl) {
    return;
  }
  return testEl.querySelectorAll('.qunit-assert-list > li')[index];
}

const ws = new WebSocket(`ws://localhost:${serverPort}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.meta.runStart) {
    update(data);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Parse current page query params and send them with the WebSocket message
  const params = new URLSearchParams(window.location.search).toString();

  setTimeout(
    () => ws.send(JSON.stringify({ action: 'run-tests', params })),
    100,
  );
});

document.addEventListener('click', function (event) {
  if (event.target.matches('ol#qunit-tests li a')) {
    event.preventDefault();
    abortTests();
    reloadOnRunEnd(event.target.href);
  }
});

function reloadOnRunEnd(href) {
  if (wsData.meta.runEnd) {
    if (href) {
      window.location.href = href;
    } else {
      window.location.reload();
    }
  } else {
    setTimeout(() => {
      reloadOnRunEnd(href);
    }, 50);
  }
}

// From QUnit.begin, which is disabled
function begin(beginDetails) {
  if (!beginDetails) {
    return;
  }
  appendInterface(beginDetails);
}

// From QUnit.onRunEnd, which is disabled
function runEnd(runEnd) {
  runEnd = runEnd || {
    testCounts: {},
  };
  var banner = id('qunit-banner');
  var tests = id('qunit-tests');
  var abortButton = id('qunit-abort-tests-button');
  var assertPassed = config.stats.all - config.stats.bad;
  var html = [
    runEnd.testCounts.total,
    ' tests completed in ',
    runEnd.runtime,
    ' milliseconds, with ',
    runEnd.testCounts.failed,
    ' failed, ',
    runEnd.testCounts.skipped,
    ' skipped, and ',
    runEnd.testCounts.todo,
    ' todo.<br />',
    "<span class='passed'>",
    assertPassed,
    "</span> assertions of <span class='total'>",
    config.stats.all,
    "</span> passed, <span class='failed'>",
    config.stats.bad,
    '</span> failed.',
    getRerunFailedHtml(stats.failedTests),
  ].join('');
  // var test;
  // var assertLi;
  // var assertList;

  // // Update remaining tests to aborted
  if (abortButton && abortButton.disabled) {
    html = 'Tests aborted after ' + runEnd.runtime + ' milliseconds.';
    // for (var i = 0; i < tests.children.length; i++) {
    //   test = tests.children[i];
    //   if (test.className === '' || test.className === 'running') {
    //     test.className = 'aborted';
    //     assertList = test.getElementsByTagName('ol')[0];
    //     assertLi = document.createElement('li');
    //     assertLi.className = 'fail';
    //     assertLi.innerHTML = 'Test aborted.';
    //     assertList.appendChild(assertLi);
    //   }
    // }
  }
  if (banner && (!abortButton || abortButton.disabled === false)) {
    banner.className = runEnd.status === 'failed' ? 'qunit-fail' : 'qunit-pass';
  }
  if (abortButton) {
    abortButton.parentNode.removeChild(abortButton);
  }
  if (tests) {
    id('qunit-testresult-display').innerHTML = html;
  }
  if (config.altertitle && document.title) {
    // Show ✖ for good, ✔ for bad suite result in title
    // use escape sequences in case file gets loaded with non-utf-8
    // charset
    document.title = [
      runEnd.status === 'failed' ? '\u2716' : '\u2714',
      document.title.replace(/^[\u2714\u2716] /i, ''),
    ].join(' ');
  }

  // Scroll back to top to show results
  if (config.scrolltop && window$1.scrollTo) {
    window$1.scrollTo(0, 0);
  }
}
