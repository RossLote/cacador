/** Storage set-ups the tests share: an exam's answers saved, and IndexedDB made to fail. */
import { expect, vi } from 'vitest';
import { saveExamAnswer, type OptionKey } from '@/storage';

/** Saves each of `answers` on the running exam, chosen at `at` (now when left out), and expects every save to be taken. */
export async function answerExam(examId: string, answers: Record<number, OptionKey>, at?: number): Promise<void> {
  for (const [id, option] of Object.entries(answers)) expect(await saveExamAnswer(examId, Number(id), option, at)).toBe(true);
}

type StoreMethod = 'add' | 'put' | 'getAll';

/**
 * Makes IndexedDB's `method` throw, as a full or broken database would: on
 * every store, or on `store` only, and for every call, or for the next `times`
 * only; any other call goes through. Returns the spy; test/setup.ts restores it
 * after the test, and it is restored before failing the same method again.
 */
export function failStore(method: StoreMethod, { store, times = Infinity }: { store?: string; times?: number } = {}) {
  const original = IDBObjectStore.prototype[method];
  let left = times;
  return vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (this: IDBObjectStore, ...args: unknown[]) {
    if ((store === undefined || this.name === store) && left-- > 0) throw new DOMException(`${method} refused`, 'UnknownError');
    return Reflect.apply(original, this, args);
  });
}
