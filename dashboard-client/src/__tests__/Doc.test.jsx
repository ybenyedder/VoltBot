// Doc page smoke test — mocks /commands to return two categories so
// the table-of-contents <aside aria-label="Table des matières"> renders.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n.js';

vi.mock('../api', () => {
  const apiFetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { name: 'ping', category: 'Général', description: 'Ping the bot', aliases: [] },
          { name: 'ban', category: 'Modération', description: 'Ban a user', aliases: [] },
        ]),
      headers: { get: () => null },
    }),
  );
  return { apiFetch, discoverBot: vi.fn() };
});

import Doc from '../pages/Doc.jsx';

const renderDoc = () =>
  render(
    <MemoryRouter initialEntries={['/doc']}>
      <Doc />
    </MemoryRouter>,
  );

describe('Doc page', () => {
  it('renders the Documentation heading', () => {
    renderDoc();
    expect(screen.getByRole('heading', { level: 1, name: /documentation/i })).toBeInTheDocument();
  });

  it('renders the table-of-contents sidebar once commands resolve', async () => {
    renderDoc();
    await waitFor(() => {
      // aria-label="Table des matières" is the TOC <aside>.
      const toc = screen.getByLabelText(/table des matières/i);
      expect(toc).toBeInTheDocument();
    });
  });

  it('lists at least one category in the TOC', async () => {
    renderDoc();
    await waitFor(() => {
      // The two mocked categories should each appear as a TOC button.
      expect(screen.getByRole('button', { name: /général/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /modération/i })).toBeInTheDocument();
    });
  });
});
