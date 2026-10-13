import { expect, it } from 'vitest';
import sinal from '@cacador/data/images/sinal.jpg';

it('imports a question image from @cacador/data as a URL', () => {
  expect(sinal).toMatch(/sinal.*\.jpg$/);
});
