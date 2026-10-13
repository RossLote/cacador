import { hintFor, type OptionKey } from '@cacador/data';
import { fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBObjectStore } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import { getLocale, setLocale } from '@/i18n/locale';
import { bankPool, patternPool, seededRandom, type RandomSource } from '@/model';
import { getFlags, listAnswers, setFlag } from '@/storage';
import { PracticePage } from './PracticePage';
import { usePracticePool } from './usePracticePool';
import { question, wrongOf } from '../../test/fixtures';

const t = MESSAGES.en.practice;
const flagsT = t.flags;
const first: RandomSource = () => 0;

/** Practice at /practice<query>, drawing with `random` in place of Math.random. */
function renderPractice(query = '', random: RandomSource = first) {
  vi.spyOn(Math, 'random').mockImplementation(random);
  return render(
    <MemoryRouter initialEntries={[`/practice${query}`]}>
      <PracticePage />
    </MemoryRouter>,
  );
}

async function shownId(): Promise<number> {
  const label = await screen.findByText(/^Question \d+$/);
  return Number(label.textContent?.replace(/\D/g, ''));
}

const optionFor = (key: OptionKey) =>
  within(screen.getByRole('group', { name: t.card.options })).getAllByRole('button')[['A', 'B', 'C'].indexOf(key)]!;
const nextButton = () => screen.queryByRole('button', { name: t.next });
const flagsRow = () => screen.queryByRole('group', { name: flagsT.group });
const englishOff = () => screen.getByRole('button', { name: flagsT.englishOff });
const hintOff = () => screen.getByRole('button', { name: flagsT.hintOff });

async function waitForChange(from: number): Promise<number> {
  await vi.waitFor(async () => expect(await shownId()).not.toBe(from));
  return shownId();
}

/** Answers the question on screen wrongly. */
async function answer(user: ReturnType<typeof userEvent.setup>): Promise<number> {
  const id = await shownId();
  await user.click(optionFor(wrongOf(id)));
  return id;
}

/** Answers and moves on `count` times, returning every id seen, the first included. */
async function draws(user: ReturnType<typeof userEvent.setup>, count: number): Promise<number[]> {
  const ids = [await shownId()];
  for (let i = 0; i < count; i++) {
    await answer(user);
    await user.click(nextButton()!);
    ids.push(await waitForChange(ids.at(-1)!));
  }
  return ids;
}

describe('focused practice (D4)', () => {
  it('?topic=patos draws only ids 228 to 255 and names the topic in a chip', async () => {
    const user = userEvent.setup();
    renderPractice('?topic=patos');
    const ids = await draws(user, 12);
    for (const id of ids) expect(id).toBeGreaterThanOrEqual(228);
    for (const id of ids) expect(id).toBeLessThanOrEqual(255);
    // The recent window of ten keeps the first ten draws distinct.
    expect(new Set(ids.slice(0, 10)).size).toBe(10);
    const chip = screen.getByText('Ducks');
    expect(chip).toHaveAttribute('data-slot', 'badge');
    expect(chip.className).not.toContain('rounded-full');
    expect(chip.className).not.toContain('rounded-4xl');
  });

  it('names the topic in Portuguese when the interface is Portuguese', async () => {
    setLocale('pt');
    renderPractice('?topic=patos');
    await screen.findByText(/^Pergunta \d+$/);
    expect(screen.getByText('Patos')).toHaveAttribute('data-slot', 'badge');
    expect(screen.queryByText('Ducks')).not.toBeInTheDocument();
    expect(getLocale()).toBe('pt');
  });

  it('?section=terrenos rotates questions 413 to 415 and never repeats the last at once', async () => {
    const user = userEvent.setup();
    renderPractice('?section=terrenos', seededRandom(7));
    const ids = await draws(user, 12);
    for (const id of ids) expect([413, 414, 415]).toContain(id);
    expect(new Set(ids)).toEqual(new Set([413, 414, 415]));
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    expect(screen.getByText('Hunting grounds')).toBeInTheDocument();
  });

  it('?pattern=only draws only questions whose hint carries the tag, with the pattern name in the chip', async () => {
    const user = userEvent.setup();
    renderPractice('?pattern=only');
    const ids = await draws(user, 6);
    for (const id of ids) expect(hintFor(id)?.patterns).toContain('only');
    expect(screen.getByText('Only (só, apenas)')).toHaveAttribute('data-slot', 'badge');
  });

  it('an unknown slug draws from the whole bank with no chip', async () => {
    renderPractice('?topic=nao-existe');
    expect(await shownId()).toBe(1);
    expect(document.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('no parameters: the whole bank and no chip', async () => {
    renderPractice();
    expect(await shownId()).toBe(1);
    expect(document.querySelector('[data-slot="badge"]')).toBeNull();
  });
});

describe('usePracticePool', () => {
  const wrapper = (query: string) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <MemoryRouter initialEntries={[`/practice${query}`]}>{children}</MemoryRouter>;
    };

  it('keeps the same result object across renders while the query is unchanged', () => {
    const { result, rerender } = renderHook(() => usePracticePool(), { wrapper: wrapper('?topic=patos') });
    const before = result.current;
    rerender();
    expect(result.current).toBe(before);
    expect(result.current.pool).toHaveLength(28);
  });

  it('the whole bank is the model bankPool itself', () => {
    const { result } = renderHook(() => usePracticePool(), { wrapper: wrapper('') });
    expect(result.current.pool).toBe(bankPool);
    expect(result.current.group).toBeUndefined();
  });

  it('with several parameters topic wins over section, and section over pattern', () => {
    const both = renderHook(() => usePracticePool(), { wrapper: wrapper('?pattern=only&section=terrenos&topic=patos') });
    expect(both.result.current.group?.en).toBe('Ducks');
    const sectionOverPattern = renderHook(() => usePracticePool(), { wrapper: wrapper('?pattern=only&section=terrenos') });
    expect(sectionOverPattern.result.current.pool).toEqual([413, 414, 415]);
    const patternOnly = renderHook(() => usePracticePool(), { wrapper: wrapper('?pattern=only') });
    expect(patternOnly.result.current.pool).toEqual(patternPool('only'));
  });
});

describe('the flags row (D2)', () => {
  it('appears only after answering', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    expect(flagsRow()).not.toBeInTheDocument();
    await answer(user);
    expect(flagsRow()).toBeInTheDocument();
    await user.click(nextButton()!);
    await waitForChange(1);
    expect(flagsRow()).not.toBeInTheDocument();
  });

  it('a tap on Hint is off stores one hint flag with an empty note and opens the note field; Save stores the note; a second tap removes it', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(hintOff()).toBeEnabled());
    expect(hintOff()).toHaveAttribute('aria-pressed', 'false');
    expect(englishOff()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(hintOff());
    expect(hintOff()).toHaveAttribute('aria-pressed', 'true');
    expect(englishOff()).toHaveAttribute('aria-pressed', 'false');
    const field = screen.getByRole('textbox', { name: flagsT.hintNote });
    await vi.waitFor(async () =>
      expect(await getFlags(1)).toEqual([expect.objectContaining({ questionId: 1, kind: 'hint', note: '' })]),
    );

    await user.type(field, 'wrong verb');
    expect((await getFlags(1))[0]!.note).toBe('');
    await user.click(screen.getByRole('button', { name: flagsT.save }));
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([expect.objectContaining({ kind: 'hint', note: 'wrong verb' })]));
    expect(await screen.findByRole('status')).toHaveTextContent(flagsT.saved);

    await user.click(hintOff());
    expect(hintOff()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([]));
  });

  it('English is off stores a translation flag', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(englishOff()).toBeEnabled());
    await user.click(englishOff());
    await user.type(screen.getByRole('textbox', { name: flagsT.englishNote }), 'bad{Enter}');
    await vi.waitFor(async () =>
      expect(await getFlags(1)).toEqual([expect.objectContaining({ kind: 'translation', note: 'bad' })]),
    );
  });

  it('shows an existing flag as set when the question is drawn again', async () => {
    await setFlag(1, 'translation', 'old note');
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(englishOff()).toHaveAttribute('aria-pressed', 'true'));
    expect(hintOff()).toHaveAttribute('aria-pressed', 'false');
    // Tapping it removes the stored flag.
    await user.click(englishOff());
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([]));
  });

  it('typing in the note field never answers, advances or peeks', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(hintOff()).toBeEnabled());
    await user.click(hintOff());
    const field = screen.getByRole('textbox', { name: flagsT.hintNote });
    await user.type(field, 'a1 b');
    expect(field).toHaveValue('a1 b');
    expect(await shownId()).toBe(1);
    expect(screen.getByText(question(1).question)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(await shownId()).toBe(1);
    expect(nextButton()).toBeInTheDocument();
    expect(optionFor('A')).toBeDisabled();
    // Enter in the field saved the note; the test ends once that write has landed.
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([expect.objectContaining({ kind: 'hint', note: 'a1 b' })]));
  });

  it('Enter on a focused flag button toggles it without advancing', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(hintOff()).toBeEnabled());
    hintOff().focus();
    await user.keyboard('{Enter}');
    expect(hintOff()).toHaveAttribute('aria-pressed', 'true');
    expect(await shownId()).toBe(1);
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([expect.objectContaining({ kind: 'hint' })]));
    await user.keyboard(' ');
    expect(hintOff()).toHaveAttribute('aria-pressed', 'false');
    expect(await shownId()).toBe(1);
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([]));
  });

  it('a second tap before the first write lands removes the flag, and the writes land in tap order', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(hintOff()).toBeEnabled());
    // Both taps in one tick, so the first write cannot have landed before the second tap.
    fireEvent.click(hintOff());
    fireEvent.click(hintOff());
    expect(hintOff()).toHaveAttribute('aria-pressed', 'false');
    // The row's writes are queued in order, so once the English flag is stored the two hint writes have landed.
    fireEvent.click(englishOff());
    await vi.waitFor(async () => expect(await getFlags(1)).toEqual([expect.objectContaining({ kind: 'translation' })]));
    expect(hintOff()).toHaveAttribute('aria-pressed', 'false');
    expect(englishOff()).toHaveAttribute('aria-pressed', 'true');
  });

  it('a write that fails puts the row back to what is stored', async () => {
    const user = userEvent.setup();
    renderPractice();
    await shownId();
    await answer(user);
    await vi.waitFor(() => expect(hintOff()).toBeEnabled());
    await vi.waitFor(async () => expect(await listAnswers()).toHaveLength(1));
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    // A synchronous tap, so the row is checked before the failed write can put it back.
    fireEvent.click(hintOff());
    expect(hintOff()).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => expect(hintOff()).toHaveAttribute('aria-pressed', 'false'));
    expect(put).toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(await getFlags(1)).toEqual([]);
  });

  it('has an English and a Portuguese string for every flags key', () => {
    expect(Object.keys(MESSAGES.pt.practice.flags).sort()).toEqual(Object.keys(MESSAGES.en.practice.flags).sort());
    expect(MESSAGES.pt.practice.focusedOn).toBeTruthy();
  });
});
