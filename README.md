# Overview

Adds the functionality of the QUnit browser UI to QUnit tests run in Nodejs.

- All tests that are run display in a list of accordions.
- Passed and failed assertions are listed.
- The Hide passed tests checkbox can be toggled to hide or show passed tests.
- Refreshing the browser window reruns tests
- Click the rerun link of any test to run it again.
- Click the "Rerun failed tests" link after a test run completes to rerun all failed tests.
- Use the QUnit modules dropdopwn to select any subset of test modules to run.
- Use the filter input to run only tests where the module name and title match the string passed.
- Applies the QUnit browser diff feature to show the diff between expectaions and results where tests fail.

## Additional features

- Where the expectaion or result of an assertion is valid HTML, it is rendered in the browser.
- Adds copy buttons to the expectaions and results of assertions.

# How it works

An small express server starts both a web server and a UI.

The server opens a web socket connection which the UI joins.

Tests are run using the imported test runner module. This module sends data to the server when the QuUnit event bacllbacks occur, and the server forwards those to the UI.

Conversely, the UI sends a message back to the server to initiate a test run whenever the page is reloaded. The UI query params are included, which enables the implementation of features listed above.

# Usage

`npm install qunit-nodejs-ui`

The server must be started from within the node_module.

```bash
cd ./node_modules/qunit-nodejs-ui/web-viewer
node qunit-web-server.js --test-runner-path="path-to-your-tests-file" --server-port=3002 --ui-port=8001
```

Both `--server-port` and `ui-port` are optional, and can be used to customise the ports on which the server and UI are served. Defaults to 3000 for the server and 8000 for the UI.

## Tests file

The tests need to be defined as an array of objects as in the example below, rather than by calling the QUnit methods in the nomral way, which looks like this: `QUnit.module('My module', function () {...}`

This is because the test runner needs to generate the unique hash for each test (A hash of the module concatenated with test name), in the same way the the QUnit browser code does.

The QUnit broser code adds these hashes to the url query params when we use UI cointrols to run specuirfic tests or modules.

By passing the test runner an array of objects, as shown in `testModules` below, the test runner can determine the hashes of the tests and filter them appropriately.

### Example

```javascript
import { uiTestRunner } from 'qunit-nodejs-ui/web-viewer/utils/test-runner';

const testModules = [
  {
    moduleName: 'My module',
    tests: [
      {
        name: 'My test',
        fn: async (assert) => {
          assert.equal(1, 1);
        },
      },
    ],
  },
];

uiTestRunner(testModules);
```

## Usage example

`git clone git@github.com:andrew-paterson/qunit-nodejs-ui.git`

`npm install`

`cd usage-example`

`./start-qunit-web-server.sh`

Visit [http://localhost:8001](http://localhost:8001)

Refresh the page if the tests to not run immediately.
