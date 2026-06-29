// GuildDashboard smoke test — mocks every apiFetch endpoint the page
// hits during initial load so the loading skeleton clears and the
// sidebar navigation renders with module labels.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../i18n.js';

const ok = (data) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
  headers: { get: () => null },
});

vi.mock('../api', () => {
  const apiFetch = vi.fn((endpoint) => {
    // Auth probe.
    if (endpoint.startsWith('/auth/me')) {
      return Promise.resolve(ok({ isGlobalOwner: false, roles: [] }));
    }

    // Core guild data — must all be ok so the page exits the loading branch.
    if (endpoint.endsWith('/modules')) {
      return Promise.resolve(
        ok([
          { name: 'antiraid', enabled: true },
          { name: 'moderation', enabled: true },
          { name: 'levels', enabled: false },
        ]),
      );
    }
    if (endpoint.endsWith('/settings')) return Promise.resolve(ok({}));
    if (endpoint.endsWith('/channels')) return Promise.resolve(ok([]));
    if (endpoint.endsWith('/stats')) {
      return Promise.resolve(
        ok({
          guild: { id: 'g1', name: 'TestGuild', icon: null, memberCount: 0 },
          members: { total: 0, online: 0 },
          messages: [],
          commands: [],
        }),
      );
    }
    if (endpoint.endsWith('/roles')) return Promise.resolve(ok([]));
    if (endpoint.endsWith('/tickets')) return Promise.resolve(ok({ config: {}, options: [] }));
    if (endpoint.endsWith('/permissions')) return Promise.resolve(ok({ permissions: [], availableCommands: [] }));

    // Optional secondary fetches.
    if (endpoint.endsWith('/economy')) return Promise.resolve(ok([]));
    if (endpoint.endsWith('/levels')) return Promise.resolve(ok({ users: [], roles: [] }));
    if (endpoint.endsWith('/economy/settings')) return Promise.resolve(ok({}));
    if (endpoint.endsWith('/casino/settings')) return Promise.resolve(ok({ casinoConfig: { rewards: [], settings: {} } }));
    if (endpoint.endsWith('/stats-channels')) return Promise.resolve(ok({}));
    if (endpoint.endsWith('/antiraid/whitelist')) return Promise.resolve(ok([]));
    if (endpoint.endsWith('/badwords')) return Promise.resolve(ok([]));
    if (endpoint.endsWith('/giveaways')) return Promise.resolve(ok([]));
    if (endpoint.endsWith('/audit-logs')) return Promise.resolve(ok([]));

    // Owner / security endpoints — return 401 so they're skipped gracefully.
    if (endpoint.startsWith('/bot/owners')) {
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}), headers: { get: () => null } });
    }

    // Console log polling — shape is { logs: [...] }.
    if (endpoint.startsWith('/bot/logs')) {
      return Promise.resolve(ok({ logs: [] }));
    }

    // Default: empty 200 so .json() never crashes downstream.
    return Promise.resolve(ok({}));
  });
  return { apiFetch, discoverBot: vi.fn() };
});

import GuildDashboard from '../pages/GuildDashboard.jsx';

const renderAtGuild = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard/g1']}>
      <Routes>
        <Route path="/dashboard/:guildId" element={<GuildDashboard />} />
      </Routes>
    </MemoryRouter>,
  );

describe('GuildDashboard page', () => {
  it('renders the sidebar navigation with the modules entry', async () => {
    renderAtGuild();

    // Once loading clears, the sidebar <nav aria-label="Navigation"> appears.
    await waitFor(
      () => {
        expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );

    // The "Modules" section button is always present in the sidebar.
    expect(screen.getAllByRole('button', { name: /modules/i }).length).toBeGreaterThan(0);
  });

  it('renders the stats / vue d\'ensemble entry in the sidebar', async () => {
    renderAtGuild();

    await waitFor(
      () => {
        // "Vue d'ensemble" comes from guild.sections.stats_title.
        expect(screen.getAllByRole('button', { name: /vue d.ensemble/i }).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });
});
