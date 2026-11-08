import { afterEach, describe, expect, it } from 'vitest';
import { loginRedirect, nextFromLogin, noteSignOut } from './redirect.ts';

describe('loginRedirect', () => {
  it('keeps the path and query in next', () => {
    expect(loginRedirect({ pathname: '/scenario-lab', search: '?date=2026-11-04' })).toBe('/login?next=%2Fscenario-lab%3Fdate%3D2026-11-04');
  });
  afterEach(() => noteSignOut(false));
  it('drops next after the user signs out on purpose', () => {
    noteSignOut(true);
    expect(loginRedirect({ pathname: '/data', search: '' })).toBe('/login');
    expect(loginRedirect({ pathname: '/data', search: '' })).toBe('/login');
    noteSignOut(false);
    expect(loginRedirect({ pathname: '/data', search: '' })).toBe('/login?next=%2Fdata');
  });
});

describe('nextFromLogin', () => {
  it('accepts a relative path', () => {
    expect(nextFromLogin('?next=%2Fdata')).toBe('/data');
  });
  it('keeps path, query and hash', () => {
    expect(nextFromLogin('?next=%2Fdata%3Fa%3D1%23x')).toBe('/data?a=1#x');
  });
  it.each(['?next=https://evil.com', '?next=%2F%2Fevil.com', '?next=%2F%5Cevil.com', '?next=%2F%09%2Fevil.com', '?next=%2F%0A%2Fevil.com', '?next=%2F%2Ftab', '?next=%2F%20%2Fevil.com', '?next=evil', '', '?x=1'])('falls back to / for %s', (s) => {
    expect(nextFromLogin(s)).toBe('/');
  });
});
