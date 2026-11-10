import { animals, animalBySlug, type Animal } from '@cacador/data';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { ANIMALS_KEY, type AnimalsProgress } from '@/storage';
import { AnimalsGrid } from './AnimalsGrid';

const T0 = Date.UTC(2026, 10, 10, 9, 0);
const boar = animalBySlug('javali') as Animal;
const rabbit = animalBySlug('coelho') as Animal;

/** Puts the animals' progress on the device as the storage module keeps it. */
const store = (progress: AnimalsProgress) => localStorage.setItem(ANIMALS_KEY, JSON.stringify(progress));

function renderGrid() {
  return render(
    <MemoryRouter initialEntries={['/animals']}>
      <AnimalsGrid />
    </MemoryRouter>,
  );
}

/** The tiles, in the grid's order. */
const tiles = () => within(screen.getByRole('list')).getAllByRole('link');
const tileOf = (animal: Animal) => tiles()[animals.indexOf(animal)] as HTMLElement;
/** The text in the tile's corner chip, or undefined when it has none. */
const chipOf = (tile: HTMLElement) => tile.querySelector('span.absolute') as HTMLElement | null;

describe('AnimalsGrid', () => {
  it('lists the 19 animals in the manifest order, three wide, each a link to its pass', () => {
    renderGrid();
    expect(animals).toHaveLength(19);
    expect(tiles()).toHaveLength(19);
    expect(screen.getByRole('list')).toHaveClass('grid-cols-3');
    animals.forEach((animal, i) => {
      expect(tiles()[i]).toHaveAttribute('href', `/animals/${animal.slug}`);
    });
  });

  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    it(`reads Javali over Wild boar, and Tordos / Thrushes on the last tile (${locale})`, () => {
      act(() => setLocale(locale));
      renderGrid();
      const names = (tile: HTMLElement) => [...tile.querySelectorAll('[lang]')].map((el) => el.textContent);
      expect(names(tileOf(boar))).toEqual(['Javali', 'Wild boar']);
      expect(names(tiles().at(-1) as HTMLElement)).toEqual(['Tordos', 'Thrushes']);
    });
  }

  it('shows no chip on a fresh device, and names each tile by its two names', () => {
    renderGrid();
    for (const tile of tiles()) expect(chipOf(tile)).toBeNull();
    expect(screen.getByRole('link', { name: MESSAGES.en.animals.tileName('Javali', 'Wild boar') })).toBe(tileOf(boar));
  });

  it('shows a last score in forest at 75 % or more and in rust below, in Fraunces on the card', () => {
    store({ javali: { last: { right: 17, total: 22, at: T0 } }, lebre: { last: { right: 9, total: 22, at: T0 } } });
    renderGrid();
    const boarChip = chipOf(tileOf(boar)) as HTMLElement;
    expect(boarChip).toHaveTextContent(/^17\/22$/);
    expect(boarChip).toHaveClass('text-forest', 'font-heading', 'bg-card', 'border-line');
    const hareChip = chipOf(tileOf(animalBySlug('lebre') as Animal)) as HTMLElement;
    expect(hareChip).toHaveTextContent(/^9\/22$/);
    expect(hareChip).toHaveClass('text-rust');
    expect(screen.getByRole('link', { name: 'Javali, Wild boar, 17 of 22 right' })).toBe(tileOf(boar));
  });

  for (const [locale, partway, started] of [
    ['en', '12 of 34', 'Coelho-bravo, Wild rabbit, 12 of 34 answered'],
    ['pt', '12 de 34', 'Coelho-bravo, Wild rabbit, 12 de 34 respondidas'],
  ] as const) {
    it(`shows a kept pass as "${partway}", also over a score (${locale})`, () => {
      expect(rabbit.questionIds).toHaveLength(34);
      expect([rabbit.pt, rabbit.en]).toEqual(['Coelho-bravo', 'Wild rabbit']);
      act(() => setLocale(locale));
      store({ coelho: { pass: { answered: 12, right: 12, missed: [] } } });
      const { unmount } = renderGrid();
      let chip = chipOf(tileOf(rabbit)) as HTMLElement;
      expect(chip).toHaveTextContent(new RegExp(`^${partway}$`));
      expect(chip).toHaveClass('bg-clay', 'border-rust', 'text-ink');
      expect(screen.getByRole('link', { name: started })).toBe(tileOf(rabbit));
      unmount();

      store({ coelho: { last: { right: 30, total: 34, at: T0 }, pass: { answered: 12, right: 10, missed: rabbit.questionIds.slice(0, 2) } } });
      renderGrid();
      chip = chipOf(tileOf(rabbit)) as HTMLElement;
      expect(chip).toHaveTextContent(new RegExp(`^${partway}$`));
      expect(screen.getByRole('link', { name: started })).toBe(tileOf(rabbit));
    });
  }

  it('names a scored tile in Portuguese with "certas"', () => {
    act(() => setLocale('pt'));
    store({ javali: { last: { right: 17, total: 22, at: T0 } } });
    renderGrid();
    expect(screen.getByRole('link', { name: 'Javali, Wild boar, 17 de 22 certas' })).toBe(tileOf(boar));
  });

  it('reads the progress again when it mounts, so a pass just played shows its chip', () => {
    const { unmount } = renderGrid();
    expect(chipOf(tileOf(boar))).toBeNull();
    unmount();
    store({ javali: { last: { right: 17, total: 22, at: T0 } } });
    renderGrid();
    expect(chipOf(tileOf(boar))).toHaveTextContent('17/22');
  });

  for (const locale of ['en', 'pt'] satisfies Locale[]) {
    it(`links to the photo credits under the grid (${locale})`, () => {
      act(() => setLocale(locale));
      renderGrid();
      const link = screen.getByRole('link', { name: MESSAGES[locale].animals.credits });
      expect(link).toHaveAttribute('href', '/animals/credits');
      expect(link).toHaveClass('min-h-11', 'text-forest');
    });
  }

  it('shows each photo in its square, cropped at the animal\'s position', () => {
    renderGrid();
    const img = tileOf(boar).querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveClass('object-cover');
    expect(img.style.objectPosition).toBe(boar.position);
    expect(img.getAttribute('src')).toMatch(/javali/);
  });
});
