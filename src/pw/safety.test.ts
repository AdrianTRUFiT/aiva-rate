import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen, resourcesFor } from './safety';

/**
 * The screen is tuned for recall, not precision. These tests lock in that
 * asymmetry: crisis phrasings must route, and ordinary distress must not be
 * routed away from the help it came for.
 */

const MUST_ROUTE = [
  'I want to kill myself',
  "I don't want to be here anymore",
  'everyone would be better off without me',
  'I have been thinking about suicide',
  'I keep thinking about hurting myself',
  'there is no reason to go on',
  'my husband hits me and I am scared',
  'I am afraid for my safety at home',
  'I took too many of my pills',
];

const MUST_NOT_ROUTE = [
  'I just got laid off and I am freaking out',
  'I am completely burned out at work',
  "I can't shut my mind off at night",
  'my girlfriend left me last week',
  'I am overwhelmed and everything is piling up',
  'I killed it in my interview today',
  'this job is killing me slowly',
  'I feel so alone since the move',
];

test('routes every crisis phrasing', () => {
  for (const statement of MUST_ROUTE) {
    assert.equal(screen(statement).level, 'route', `should route: "${statement}"`);
  }
});

test('leaves ordinary distress in the funnel', () => {
  for (const statement of MUST_NOT_ROUTE) {
    assert.equal(screen(statement).level, 'none', `should not route: "${statement}"`);
  }
});

test('reports the category that fired', () => {
  assert.deepEqual(screen('I want to kill myself').categories, ['self-harm']);
  assert.deepEqual(screen('I am not safe at home').categories, ['abuse']);
});

test('a medical emergency leads with local emergency services', () => {
  const signal = screen("I have chest pain and can't breathe");
  assert.equal(signal.level, 'route');
  assert.equal(resourcesFor(signal)[0].region, 'Local');
});

test('curly apostrophes do not defeat the screen', () => {
  assert.equal(screen('I don’t want to live').level, 'route');
});

test('empty input is inert', () => {
  assert.equal(screen('').level, 'none');
});

test('inflected self-harm phrasings still route', () => {
  for (const s of ['I keep hurting myself', 'I have been cutting myself', 'I am harming my self']) {
    assert.equal(screen(s).level, 'route', `should route: "${s}"`);
  }
});
