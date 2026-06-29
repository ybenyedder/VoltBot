// Login page smoke tests — mounts the page in a MemoryRouter, mocks
// the api module so no network calls are made, and verifies the core
// form scaffolding is present.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.js';

vi.mock('../api', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })),
  discoverBot: vi.fn(() => Promise.resolve({ success: false, error: 'mock' })),
}));

import Login from '../pages/Login.jsx';

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Login />
    </MemoryRouter>,
  );

describe('Login page', () => {
  beforeEach(() => {
    // Prevent the auto-login useEffect from firing.
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders the brand heading', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: /aegis/i })).toBeInTheDocument();
  });

  it('renders both credential inputs', () => {
    renderLogin();
    // Match the form inputs by their explicit ids — the page also has
    // decorative labels that would otherwise create ambiguity.
    expect(document.getElementById('bot-id')).toBeInTheDocument();
    expect(document.getElementById('bot-phrase')).toBeInTheDocument();
  });

  it('renders the submit button with an accessible label', () => {
    renderLogin();
    // The button text comes from i18n key login.submit — use the aria-label
    // (which the component sets to the same translation) so this assertion
    // stays stable even while the loading spinner is on screen.
    const buttons = screen.getAllByRole('button', { name: /soumettre/i });
    expect(buttons.length).toBeGreaterThan(0);
  });
});
