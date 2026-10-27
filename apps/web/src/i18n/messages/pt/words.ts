import type { Messages } from '../en';

export const words: Messages['words'] = {
  title: 'Palavras',
  position: (n, size) => `${n} de ${size}`,
  options: 'Opções',
  next: 'Seguinte',
  finish: 'Terminar',
  questionNumber: (id) => `Pergunta ${id}`,
  done: 'Ronda terminada',
  ofRight: (size) => `de ${size} certas`,
  missed: 'Falhada',
  another: (size) => `Mais ${size}`,
};
