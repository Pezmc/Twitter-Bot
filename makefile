SHELL=/bin/bash

test:
	npm test

lib-cov:
	rm -rf lib-cov && ./node_modules/jscoverage/bin/jscoverage lib lib-cov

coverage.lcov: lib-cov
	rm -f coverage.lcov
	TWITTER_BOT_COV=1 node_modules/.bin/mocha -R mocha-lcov-reporter > coverage.lcov
	rm -rf lib-cov

coverage.html: lib-cov
	TWITTER_BOT_COV=1 node_modules/.bin/mocha -R html-cov > coverage.html
	open coverage.html
	rm -rf lib-cov
    
coveralls: coverage.lcov
	./node_modules/coveralls/bin/coveralls.js < coverage.lcov
	rm -f coverage.lcov
    
codeclimate: coverage.lcov
	export CODECLIMATE_REPO_TOKEN=cb11de025c8df27bb28527df703bb3cf04ac6dd12df48511c78a08a2e35fdc70 && \
	./node_modules/codeclimate-test-reporter/bin/codeclimate.js < coverage.lcov
	rm -f coverage.lcov
    
.PHONY: codeclimate coveralls coverage.html test