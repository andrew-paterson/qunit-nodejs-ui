#!/bin/bash

starting_dir=$PWD
cd ./node_modules/qunit-nodejs-ui/web-viewer

node qunit-web-server.js --test-runner-path="$starting_dir/run-tests.js" --server-port=3002 --ui-port=8001
