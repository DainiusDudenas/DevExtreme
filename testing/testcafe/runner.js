const createTestCafe = require('testcafe');
const fs = require('fs');
const process = require('process');
const parseArgs = require('minimist');
require('nconf').argv();

let testCafe;
createTestCafe('localhost', 1437, 1438)
    .then(tc => {
        testCafe = tc;

        const args = getArgs();
        const testName = args.test.trim();
        const meta = args.meta.trim();
        const indices = args.indices.trim();
        let componentFolder = args.componentFolder.trim();
        const file = args.file.trim();

        componentFolder = componentFolder ? `${componentFolder}/**` : '**';
        if(fs.existsSync('./testing/testcafe/screenshots')) {
        // eslint-disable-next-line spellcheck/spell-checker
            fs.rmdirSync('./testing/testcafe/screenshots', { recursive: true });
        }
        const runner = testCafe.createRunner()
            .browsers(args.browsers.split(' '))

            .src([`./testing/testcafe/tests/${componentFolder}/${file}.ts`]);

        if(args.concurrency > 0) {
            runner.concurrency(args.concurrency);
        }
        const filters = [];
        if(indices) {
            const [current, total] = indices.split(/_|of|\\|\//ig).map(x => +x);
            let testIndex = 0;
            filters.push(() => {
                const result = (testIndex % total) === (current - 1);
                testIndex += 1;
                return result;
            });
        }
        if(testName) {
            filters.push(name => name === testName);
        }
        if(meta) {
            filters.push((testName, fixtureName, fixturePath, testMeta, fixtureMeta) => {
                return testMeta[meta] || fixtureMeta[meta];
            });
        }
        if(filters.length) {
            runner.filter((...args) => {
                for(let i = 0; i < filters.length; i++) {
                    if(!filters[i](...args)) {
                        return false;
                    }
                }
                return true;
            });
        }
        if(args.cache) {
            runner.cache = args.cache;
        }
        return runner.run({
            quarantineMode: args.quarantineMode
        });
    })
    .then(failedCount => {
        testCafe.close();
        if(failedCount !== 0) {
            process.exit(failedCount);
        }
    });

function getArgs() {
    return parseArgs(process.argv.slice(1), {
        default: {
            concurrency: 0,
            browsers: 'chrome',
            test: '',
            meta: '',
            componentFolder: '',
            file: '*',
            cache: true,
            quarantineMode: false,
            indices: ''
        }
    });
}
