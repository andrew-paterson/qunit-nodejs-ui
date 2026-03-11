#!/bin/bash

cd ./node_modules/qunit-nodejs-ui/web-viewer
node qunit-web-server.js --test-runner-path="/home/paddy/development/qunit-nodejs-ui-monorepo/test-app/run-tests.js" --server-port=3002 --ui-port=8001
