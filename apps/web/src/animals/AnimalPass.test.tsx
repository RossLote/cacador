import { animalBySlug, translationFor } from '@cacador/data';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { placeOf } from '@/components/question/names';
import { setLocale } from '@/i18n/locale';
import type { Locale } from '@/i18n/locales';
import { MESSAGES } from '@/i18n/messages';
import { listAnswers, readAnimals } from '@/storage';
import { correctOf, question, wrongOf } from '../../test/fixtures';
import { failStore } from '../../test/storage';

const BOAR = animalBySlug('javali')!.questionIds;
const MOUFLON = animalBySlug('muflao')!.questionIds;
/** The five boar questions the long walk answers wrongly, in the pass's order: one before the reload, two either side of the law questions. */
const BOAR_WRONG = [123, 126, 136, 422, 494];

type User = ReturnType<typeof userEvent.setup>;

/** The whole app at `path`, so the dock, the tab bar and the /animals/* route are the real ones. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const header = () => document.querySelector('header')!;
/** The counter at the right of the screen header, "3 of 22". */
const counter = () => within(header()).getByText(/^\d+ (of|de) \d+$/);
/** The number of the question on screen, from the header's line. */
const shown = () => Number(within(header()).getByText(/^(Question|Pergunta) \d+$/).textContent.replace(/\D/g, ''));
/** Waits for question `id` to be on screen. */
const waitFor = (id: number) => vi.waitFor(() => expect(shown()).toBe(id));

function words(locale: Locale = 'en') {
  const m = MESSAGES[locale];
  return {
    m,
    t: m.animals,
    option: (key: 'A' | 'B' | 'C') =>
      within(screen.getByRole('group', { name: m.practice.card.options })).getAllByRole('button')[['A', 'B', 'C'].indexOf(key)]!,
    nextButton: () => screen.queryByRole('button', { name: m.animals.next }),
    finishButton: () => screen.queryByRole('button', { name: m.animals.finish }),
    plate: (name: string) => screen.queryByRole('region', { name: m.animals.done(name) }),
  };
}

/** Answers `ids` in turn, each on screen first, wrongly where `wrong` holds it, and taps Next or, on the run's last, Finish. */
async function walk(user: User, ids: readonly number[], wrong: readonly number[], locale: Locale = 'en', last = true) {
  const w = words(locale);
  for (const [i, id] of ids.entries()) {
    await waitFor(id);
    await user.click(w.option(wrong.includes(id) ? wrongOf(id) : correctOf(id)));
    const final = last && i === ids.length - 1;
    expect(w.nextButton() === null).toBe(final);
    await user.click(final ? w.finishButton()! : w.nextButton()!);
  }
}

describe('AnimalPass', () => {
  const { t, m, option, nextButton, finishButton, plate } = words();

  it('opens a fresh device on the first question at "1 of 22", the chip under the header, and shows the flags row and Next once answered', async () => {
    const user = userEvent.setup();
    renderAt('/animals/javali');
    expect(shown()).toBe(123);
    expect(screen.getByText(placeOf(question(123), 'en'), { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(counter()).toHaveTextContent('1 of 22');
    expect(counter()).toHaveClass('font-heading');
    const chip = screen.getByText('Javali');
    expect(chip.parentElement).toHaveTextContent(`${t.practising}Javali`);
    expect(chip).toHaveAttribute('lang', 'pt-PT');
    expect(screen.getByRole('button', { name: m.practice.card.holdForEnglish })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.practice.card.hint })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: m.practice.flags.group })).not.toBeInTheDocument();
    expect(nextButton()).not.toBeInTheDocument();

    await user.click(option(wrongOf(123)));
    expect(screen.getByRole('group', { name: m.practice.flags.group })).toBeInTheDocument();
    expect(nextButton()).toHaveClass('bg-primary');
    expect(counter()).toHaveTextContent('1 of 22');
    await user.click(nextButton()!);
    await waitFor(124);
    expect(counter()).toHaveTextContent('2 of 22');
  });

  it('walks the boar in order across a reload, ends on its score, asks the missed ones again and goes again from question 1', async () => {
    const user = userEvent.setup();
    const first = renderAt('/animals/javali');
    await walk(user, BOAR.slice(0, 3), BOAR_WRONG, 'en', false);
    await waitFor(126);
    first.unmount();

    renderAt('/animals/javali');
    expect(shown()).toBe(126);
    expect(counter()).toHaveTextContent('4 of 22');
    // The pass's order runs from the boar's Biology topic into the law questions that name it: 136 then 422.
    expect(BOAR.indexOf(422)).toBe(BOAR.indexOf(136) + 1);
    await walk(user, BOAR.slice(3), BOAR_WRONG);

    const score = plate('Javali')!;
    expect(score).toHaveClass('bg-card');
    expect(within(score).getByRole('heading', { name: 'Javali done' })).toBeInTheDocument();
    expect(within(score).getByText('17')).toHaveClass('font-heading', 'text-[64px]');
    expect(within(score).getByText('of 22 right')).toBeInTheDocument();
    expect(counter()).toHaveTextContent('22 of 22');
    expect(screen.getByText(t.title, { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText('Practising')).not.toBeInTheDocument();
    const missedOnly = screen.getByRole('button', { name: 'Missed ones only (5)' });
    const again = screen.getByRole('button', { name: 'Go again' });
    const back = screen.getByRole('link', { name: 'Back to animals' });
    expect(missedOnly).toHaveClass('bg-primary', 'h-12', 'w-full');
    expect(again).toHaveClass('border-ink', 'h-12', 'w-full');
    expect(again).not.toHaveClass('bg-primary');
    expect(back).toHaveAttribute('href', '/animals');
    expect(back).toHaveClass('border-border', 'h-12', 'w-full');
    expect(score.compareDocumentPosition(missedOnly) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(missedOnly.compareDocumentPosition(again) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(again.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const answers = await listAnswers();
    expect(answers.map((a) => a.questionId)).toEqual(BOAR);
    expect(answers.every((a) => a.mode === 'practice')).toBe(true);
    expect(readAnimals().javali).toEqual({ last: { right: 17, total: 22, at: expect.any(Number) } });
    // The option keys answer nothing on the score.
    await user.keyboard('a');
    expect(await listAnswers()).toHaveLength(22);

    // Missed ones only: exactly the five, in order, counted out of five, and never kept.
    await user.click(missedOnly);
    expect(shown()).toBe(123);
    expect(counter()).toHaveTextContent('1 of 5');
    expect(screen.getByText('Javali').parentElement).toHaveTextContent('PractisingJavali');
    await walk(user, BOAR_WRONG, [126, 494]);
    expect(within(plate('Javali')!).getByText('3')).toBeInTheDocument();
    expect(within(plate('Javali')!).getByText('of 5 right')).toBeInTheDocument();
    expect(counter()).toHaveTextContent('5 of 5');
    expect(screen.getByRole('button', { name: 'Missed ones only (2)' })).toHaveClass('bg-primary');
    expect((await listAnswers()).map((a) => a.questionId).slice(22)).toEqual(BOAR_WRONG);
    expect(readAnimals().javali).toEqual({ last: { right: 17, total: 22, at: expect.any(Number) } });

    // Missed ones only again asks the two still wrong.
    await user.click(screen.getByRole('button', { name: 'Missed ones only (2)' }));
    expect(shown()).toBe(126);
    expect(counter()).toHaveTextContent('1 of 2');
    await walk(user, [126, 494], []);
    expect(within(plate('Javali')!).getByText('of 2 right')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Missed ones only/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go again' })).toHaveClass('bg-primary');

    // Go again: question 123 at "1 of 22", the stored score kept until the new pass ends.
    await user.click(screen.getByRole('button', { name: 'Go again' }));
    expect(shown()).toBe(123);
    expect(counter()).toHaveTextContent('1 of 22');
    expect(screen.getByRole('article').parentElement).toHaveFocus();
    await user.click(option(correctOf(123)));
    expect(readAnimals().javali).toEqual({
      last: { right: 17, total: 22, at: expect.any(Number) },
      pass: { answered: 1, right: 1, missed: [] },
    });
  });

  it('keeps the last full score while a Go again is partway, and keeps that pass', async () => {
    const user = userEvent.setup();
    renderAt('/animals/muflao');
    await walk(user, MOUFLON, [166]);
    await user.click(screen.getByRole('button', { name: 'Go again' }));
    await walk(user, MOUFLON.slice(0, 2), [], 'en', false);
    await waitFor(167);
    expect(readAnimals().muflao?.pass).toEqual({ answered: 2, right: 2, missed: [] });
    expect(readAnimals().muflao?.last).toMatchObject({ right: 2, total: 3 });
  });

  it('runs the mouflon\'s three questions to a score with nothing missed: no Missed ones only, and Go again in rust', async () => {
    const user = userEvent.setup();
    const view = renderAt('/animals/muflao');
    expect(counter()).toHaveTextContent('1 of 3');
    await walk(user, MOUFLON, []);
    expect(within(plate('Muflão')!).getByText('3')).toBeInTheDocument();
    expect(within(plate('Muflão')!).getByText('of 3 right')).toBeInTheDocument();
    expect(counter()).toHaveTextContent('3 of 3');
    expect(screen.queryByRole('button', { name: /Missed ones only/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go again' })).toHaveClass('bg-primary');
    expect(readAnimals().muflao).toEqual({ last: { right: 3, total: 3, at: expect.any(Number) } });

    // A reload on the score opens question 1 of a new pass: the pass is over.
    view.unmount();
    renderAt('/animals/muflao');
    expect(shown()).toBe(165);
    expect(counter()).toHaveTextContent('1 of 3');
  });

  it('says when an answer could not be saved, and the pass still moves on', async () => {
    const user = userEvent.setup();
    renderAt('/animals/muflao');
    const add = failStore('add');
    await user.click(option(wrongOf(165)));
    expect(await screen.findByText(t.answerNotSaved)).toBeInTheDocument();
    expect(await listAnswers()).toEqual([]);
    expect(readAnimals().muflao?.pass).toEqual({ answered: 1, right: 0, missed: [165] });
    add.mockRestore();
    await user.click(nextButton()!);
    await waitFor(166);
    expect(counter()).toHaveTextContent('2 of 3');
    expect(screen.queryByText(t.answerNotSaved)).not.toBeInTheDocument();
  });

  it('takes Practice\'s keys: A, B, C and 1, 2, 3 answer once, Enter goes on and finishes, held Space peeks', async () => {
    const user = userEvent.setup();
    renderAt('/animals/muflao');
    await user.keyboard('{Enter}');
    expect(shown()).toBe(165);
    await user.keyboard('b');
    await user.keyboard('c3');
    await vi.waitFor(async () => expect((await listAnswers()).map((a) => a.chosen)).toEqual(['B']));
    await user.keyboard('{Enter}');
    await waitFor(166);

    const english = translationFor(166)!.question;
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(screen.getByText(english)).toBeInTheDocument();
    fireEvent.keyUp(window, { key: ' ', code: 'Space' });
    expect(screen.queryByText(english)).not.toBeInTheDocument();

    await user.keyboard('2');
    await user.keyboard('{Enter}');
    await waitFor(167);
    await user.keyboard('C');
    expect(finishButton()).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(plate('Muflão')).toBeInTheDocument();
    expect((await listAnswers()).map((a) => a.chosen)).toEqual(['B', 'B', 'C']);

    // 1 and A on a fresh pass.
    await user.click(screen.getByRole('button', { name: 'Go again' }));
    await user.keyboard('1');
    await user.keyboard('{Enter}');
    await waitFor(166);
    await user.keyboard('a');
    expect((await listAnswers()).map((a) => a.chosen)).toEqual(['B', 'B', 'C', 'A', 'A']);
  });

  it('says it all in Portuguese: the counter, the chip, Terminar, the caption and the three buttons', async () => {
    act(() => setLocale('pt'));
    const pt = words('pt');
    const user = userEvent.setup();
    renderAt('/animals/muflao');
    expect(shown()).toBe(165);
    expect(counter()).toHaveTextContent('1 de 3');
    expect(screen.getByText(placeOf(question(165), 'pt'), { selector: 'p.eyebrow' })).toBeInTheDocument();
    expect(screen.getByText('Muflão').parentElement).toHaveTextContent('A praticarMuflão');
    await user.click(pt.option(correctOf(165)));
    expect(pt.nextButton()).toHaveTextContent('Seguinte');
    await user.click(pt.nextButton()!);
    await waitFor(166);
    expect(counter()).toHaveTextContent('2 de 3');
    await walk(user, MOUFLON.slice(1), [167], 'pt');
    const score = pt.plate('Muflão')!;
    expect(within(score).getByRole('heading', { name: 'Muflão concluído' })).toBeInTheDocument();
    expect(within(score).getByText('de 3 certas')).toBeInTheDocument();
    expect(counter()).toHaveTextContent('3 de 3');
    expect(screen.getByRole('button', { name: 'Só as erradas (1)' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: 'Outra vez' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar aos animais' })).toHaveAttribute('href', '/animals');
  });
});
