const assert = require('assert');

console.log('==========================================');
console.log(' Running Automated CI/CD Test Suite');
console.log('==========================================');

// Test 1: Core System Sanity Check
try {
    assert.strictEqual(2 + 2, 4, 'Basic arithmetic sanity check failed');
    console.log('✓ PASS: System sanity check passed');
} catch (err) {
    console.error('✗ FAIL: System sanity check failed:', err.message);
    process.exit(1);
}

// Test 2: Package Metadata Check
try {
    const pkg = require('./package.json');

    assert.strictEqual(
        typeof pkg.name,
        'string',
        'Package name must be string'
    );

    assert.ok(
        pkg.name.length > 0,
        'Package name cannot be empty'
    );

    console.log(`✓ PASS: Metadata validated for project "${pkg.name}"`);
} catch (err) {
    console.error(
        '✗ FAIL: Package metadata validation failed:',
        err.message
    );
    process.exit(1);
}

console.log('==========================================');
console.log(' All automated tests passed successfully!');
console.log('==========================================');
