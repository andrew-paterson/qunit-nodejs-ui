import QUnit from 'qunit';
import qunitCallbacks from '../qunit-callbacks.js';
import { getFromEnvFile } from './get-from-env.js';
const queryParams = getFromEnvFile('queryParams');
const beginDetails = {};

// From qunit.js
function getUrlParams(queryParams = '') {
  if (!queryParams) {
    return {};
  }
  var urlParams = Object.create(null);
  var params = queryParams.split('&');
  var length = params.length;
  for (var i = 0; i < length; i++) {
    if (params[i]) {
      var param = params[i].split('=');
      var name = decodeQueryParam(param[0]);

      // Allow just a key to turn on a flag, e.g., test.html?noglobals
      var value =
        param.length === 1 || decodeQueryParam(param.slice(1).join('='));
      if (name in urlParams) {
        urlParams[name] = [].concat(urlParams[name], value);
      } else {
        urlParams[name] = value;
      }
    }
  }
  return urlParams;
}

// From qunit.js
function decodeQueryParam(param) {
  return decodeURIComponent(param.replace(/\+/g, '%20'));
}
const parsedQueryParams = getUrlParams(queryParams);
console.log(getFromEnvFile('src'));
if (getFromEnvFile('src') === 'web-viewer') {
  qunitCallbacks(QUnit, beginDetails);
}

function generateHash(module, testName) {
  var str = module + '\x1C' + testName;
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  // Convert the possibly negative integer hash code into an 8 character hex string, which isn't
  // strictly necessary but increases user understanding that the id is a SHA-like hash
  var hex = (0x100000000 + hash).toString(16);
  if (hex.length < 8) {
    hex = '0000000' + hex;
  }
  return hex.slice(-8);
}

function processModule(module) {
  const moduleId = generateHash(module.moduleName);

  if (parsedQueryParams.moduleId) {
    if (typeof parsedQueryParams.moduleId === 'string') {
      parsedQueryParams.moduleId = [parsedQueryParams.moduleId];
    }
    if (
      parsedQueryParams.moduleId?.length &&
      !parsedQueryParams.moduleId.includes(moduleId)
    ) {
      return;
    }
  }
  const filteredTests = module.tests.filter((test) => {
    const testId = generateHash(module.moduleName, test.name);
    if (
      parsedQueryParams.filter &&
      !`${module.moduleName}: ${test.name}`
        .toLowerCase()
        .includes(parsedQueryParams.filter.toLowerCase())
    ) {
      return false;
    }

    if (parsedQueryParams.testId) {
      if (typeof parsedQueryParams.testId === 'string') {
        parsedQueryParams.testId = [parsedQueryParams.testId];
      }
      if (
        parsedQueryParams.testId?.length &&
        !parsedQueryParams.testId.includes(testId)
      ) {
        return false;
      }
    }
    return true;
  });
  if (filteredTests.length === 0) {
    return;
  }

  QUnit.module(module.moduleName, function () {
    filteredTests.forEach((test) => {
      if (test.todo) {
        QUnit.todo(test.name, test.fn);
        return;
      }
      if (test.skip || Object.hasOwn(parsedQueryParams, 'initialise')) {
        QUnit.skip(test.name, test.fn);
        return;
      }
      QUnit.test(test.name, test.fn);
    });
  });
}

export function uiTestRunner(testModules) {
  beginDetails.modules = testModules.map((module) => {
    return {
      name: module.moduleName,
      moduleId: generateHash(module.moduleName),
      tests: module.tests.map((test) => {
        return {
          name: test.name,
          testId: generateHash(module.moduleName, test.name),
          skip: test.skip || false,
        };
      }),
    };
  });
  beginDetails.testCount = testModules.reduce((acc, module) => {
    return acc + module.tests.length;
  }, 0);

  testModules.forEach((module) => {
    processModule(module);
  });
}
