const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function main() {
    // Assuming dev server is running on localhost:5173
    const url = 'http://localhost:5173/dashboard';
    console.log('Loading', url);
    const dom = await JSDOM.fromURL(url, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    });

    const window = dom.window;
    const errors = [];

    window.addEventListener('error', (event) => {
        errors.push({
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
    });

    // Wait for page to load and scripts to execute
    await new Promise(resolve => {
        window.addEventListener('load', resolve);
    });

    // Additional wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Total errors:', errors.length);
    errors.forEach((err, idx) => {
        console.log(`Error ${idx + 1}:`, err.message);
        console.log('  at', err.filename, err.lineno, err.colno);
        if (err.error && err.error.stack) {
            console.log('Stack:', err.error.stack);
        }
    });

    if (errors.length === 0) {
        console.log('No JavaScript errors detected.');
    }

    window.close();
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});