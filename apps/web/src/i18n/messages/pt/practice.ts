import type { Messages } from '../en';

export const practice: Messages['practice'] = {
  title: 'Praticar',
  next: 'Seguinte',
  loading: 'A escolher uma pergunta…',
  card: {
    questionNumber: (id: number) => `Pergunta ${id}`,
    pictureAlt: (id: number) => `A imagem da pergunta ${id}`,
    options: 'Opções',
    holdForEnglish: 'Manter premido para ver em inglês',
    hint: 'Dica',
    languageNotes: 'Notas de língua',
    noLanguageNotes: 'Não há notas de língua para esta pergunta.',
    nudge: 'Pista',
    right: 'Certo',
    wrong: 'Errado',
    correctAnswer: 'Resposta certa',
  },
};
