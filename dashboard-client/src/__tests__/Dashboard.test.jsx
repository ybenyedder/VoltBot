// Dashboard page smoke test — mocks apiFetch to feed canned data
// (auth + empty guild list) so the page settles into its loaded state
// and renders the header.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.js';

const jsonResponse = (data, init = {}) => ({
  ok: true,
  status: 200,
  ...init,
  json: () => Promise.resolve(data),
  headers: { get: () => null },
});

vi.mock('../api', () => {
  const apiFetch = vi.fn((endpoint) => {
    if (endpoint.startsWith('/auth/me')) {
      return Promise.resolve(jsonResponse({ isGlobalOwner: false }));
    }
    if (endpoint.startsWith('/user/guilds')) {
      return Promise.resolve(jsonResponse([]));
    }
    if (endpoint.startsWith('/identify')) {
      return Promise.resolve(jsonResponse({ botName: 'Aegis' }));
    }
    if (endpoint.startsWith('/system/speedphrases')) {
      return Promise.resolve(jsonResponse([]));
    }
    if (endpoint.startsWith('/bot')) {
      return Promise.resolve(jsonResponse({ status: 'online', activity: { name: '', type: 0 } }));
    }
    return Promise.resolve(jsonResponse({}));
  });
  return { apiFetch, discoverBot: vi.fn() };
});

import Dashboard from '../pages/Dashboard.jsx';

describe('Dashboard page', () => {
  it('renders the page header once data resolves', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>,
    );

    // The header title is the bot name (default "Aegis").
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /aegis/i })).toBeInTheDocument();
    });
  });

  it('exposes a logout control', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      // The button uses aria-label = t("dashboard.logout") = "Déconnexion".
      expect(screen.getAllByRole('button', { name: /déconnexion/i }).length).toBeGreaterThan(0);
    });
  });
});
