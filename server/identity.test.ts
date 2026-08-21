import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearResumeCookie,
  hashToken,
  issueResumeToken,
  newEnrollmentId,
  normaliseEmail,
  readResumeCookie,
  resumeCookie,
  tokenMatches,
} from './identity';

test('issued tokens are unique and never equal their stored hash', () => {
  const a = issueResumeToken();
  const b = issueResumeToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, a.token);
  assert.equal(a.hash, hashToken(a.token));
});

test('a token matches only its own hash', () => {
  const a = issueResumeToken();
  const b = issueResumeToken();
  assert.equal(tokenMatches(a.token, a.hash), true);
  assert.equal(tokenMatches(b.token, a.hash), false);
});

test('a malformed token is rejected rather than throwing', () => {
  const a = issueResumeToken();
  assert.equal(tokenMatches('', a.hash), false);
  assert.equal(tokenMatches('not-a-token', a.hash), false);
  assert.equal(tokenMatches(a.token, 'deadbeef'), false);
});

test('the resume cookie is httpOnly and same-site, and secure when asked', () => {
  const cookie = resumeCookie('abc', true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.doesNotMatch(resumeCookie('abc', false), /Secure/);
});

test('the cookie round-trips through a Cookie header', () => {
  const { token } = issueResumeToken();
  const header = `other=1; ${resumeCookie(token, false).split(';')[0]}; another=2`;
  assert.equal(readResumeCookie(header), token);
  assert.equal(readResumeCookie(undefined), null);
  assert.equal(readResumeCookie('unrelated=1'), null);
});

test('clearing the cookie expires it immediately', () => {
  assert.match(clearResumeCookie(), /Max-Age=0/);
});

test('email normalisation lowercases, trims, and rejects nonsense', () => {
  assert.equal(normaliseEmail('  Person@Example.COM '), 'person@example.com');
  assert.equal(normaliseEmail('nope'), null);
  assert.equal(normaliseEmail('a@b'), null);
  assert.equal(normaliseEmail('a b@c.com'), null);
  assert.equal(normaliseEmail(''), null);
});

test('enrollment ids are prefixed and unique', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newEnrollmentId()));
  assert.equal(ids.size, 200);
  assert.match([...ids][0], /^enr_/);
});
