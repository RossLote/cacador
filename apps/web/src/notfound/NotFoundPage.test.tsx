import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import { NotFoundPage } from './NotFoundPage';

describe('Not found page', () => {
  it('shows its title in Fraunces with the back control to Home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(MESSAGES.en.common.notFound.title);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(title.closest('header')).not.toBeNull();
    expect(title).toHaveClass('font-heading');
    expect(screen.getByRole('link', { name: MESSAGES.en.common.backToHome })).toBeInTheDocument();
  });
});
