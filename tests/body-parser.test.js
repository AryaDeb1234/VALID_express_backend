const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const lock = require(path.join(__dirname, '..', 'package-lock.json'));

// Version of body-parser that contains the fix for GHSA-27r3-jxmh-p828.
const FIXED_VERSION = '2.4.0';

function parse(version) {
  const parts = String(version).split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function gte(a, b) {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return true;
}

// Enough of the caret ranges used by this lockfile to prove the bump stays installable.
function satisfiesCaret(version, range) {
  if (!range.startsWith('^')) return true;
  const [major, minor, patch] = parse(range.slice(1));
  const [vMajor, vMinor, vPatch] = parse(version);
  if (vMajor !== major) return vMajor > major;
  if (major === 0) return vMinor >= minor && vPatch >= patch;
  return vMinor > minor || (vMinor === minor && vPatch >= patch);
}

test('body-parser resolves to the GHSA-27r3-jxmh-p828 fixed release', () => {
  const entry = lock.packages['node_modules/body-parser'];
  assert.ok(entry, 'package-lock.json pins body-parser');

  assert.ok(
    gte(entry.version, FIXED_VERSION),
    `body-parser must be >= ${FIXED_VERSION}, found ${entry.version}`
  );
  assert.match(
    entry.resolved,
    new RegExp(`/body-parser/-/body-parser-${entry.version}\\.tgz$`),
    'the resolved tarball must match the pinned version'
  );

  // body-parser is pulled in by express; the new version must still satisfy the
  // ranges already declared in the lockfile, otherwise npm ci cannot install it.
  for (const [name, pkg] of Object.entries(lock.packages)) {
    const range = (pkg.dependencies || {})['body-parser'];
    if (!range) continue;
    assert.ok(
      satisfiesCaret(entry.version, range),
      `${name} requires body-parser@${range}, which ${entry.version} does not satisfy`
    );
  }
});
