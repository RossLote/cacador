import { animals, animalBySlug, type Animal } from '@cacador/data';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { AnimalCredits } from './AnimalCredits';

const boar = animalBySlug('javali') as Animal;

function renderCredits() {
  return render(
    <MemoryRouter initialEntries={['/animals/credits']}>
      <AnimalCredits />
    </MemoryRouter>,
  );
}

const rows = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('AnimalCredits', () => {
  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    const t = MESSAGES[locale].animals;

    it(`opens with the resized-and-cropped line, then a row per animal in the grid's order (${locale})`, () => {
      act(() => setLocale(locale));
      renderCredits();
      expect(screen.getByText(t.creditsIntro)).toHaveClass('text-sm', 'text-muted-foreground');
      expect(rows()).toHaveLength(19);
      rows().forEach((row, i) => {
        const animal = animals[i] as Animal;
        expect(within(row).getByText(animal.pt)).toBeInTheDocument();
        expect(within(row).getByRole('link', { name: t.sourceOf(animal.pt) })).toHaveAttribute('href', animal.source);
      });
    });

    it(`gives the boar's name, author and licence, and its Commons page in a new tab (${locale})`, () => {
      act(() => setLocale(locale));
      renderCredits();
      const row = rows()[animals.indexOf(boar)] as HTMLElement;
      expect(within(row).getByText('Javali')).toBeInTheDocument();
      expect(within(row).getByText('Valentin Panzirsch · CC BY-SA 3.0 AT')).toBeInTheDocument();
      const link = within(row).getByRole('link', { name: t.sourceOf('Javali') });
      expect(link).toHaveTextContent(locale === 'en' ? 'Source' : 'Fonte');
      expect(link).toHaveAttribute('href', boar.source);
      expect(link.getAttribute('href')).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:Wildschwein/);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link).toHaveClass('min-h-11');
      const thumb = row.querySelector('img') as HTMLImageElement;
      expect(thumb).toHaveAttribute('alt', '');
      expect(thumb).toHaveClass('size-11', 'object-cover');
      expect(thumb.style.objectPosition).toBe(boar.position);
    });
  }

  it('changes the intro and "Fonte" in Portuguese, and keeps the names', () => {
    act(() => setLocale('pt'));
    renderCredits();
    expect(screen.getByText('Fotografias da Wikimedia Commons, redimensionadas e recortadas.')).toBeInTheDocument();
    expect(screen.queryByText(MESSAGES.en.animals.creditsIntro)).not.toBeInTheDocument();
    expect(screen.getAllByText('Fonte')).toHaveLength(19);
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(screen.getByText('Javali')).toBeInTheDocument();
    expect(screen.getByText('Tordos')).toBeInTheDocument();
  });
});
