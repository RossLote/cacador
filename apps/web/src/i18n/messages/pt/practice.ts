import type { Messages } from '../en';

export const practice: Messages['practice'] = {
  title: 'Praticar',
  next: 'Seguinte',
  loading: 'A escolher uma pergunta…',
  loadFailed: 'Não foi possível ler o progresso neste dispositivo, por isso não foi escolhida nenhuma pergunta. Recarregue a página para tentar de novo.',
  focusedOn: 'A praticar',
  flags: {
    group: 'Assinalar um problema nesta pergunta',
    englishOff: 'O inglês está errado',
    hintOff: 'A dica está errada',
    englishNote: 'O que está errado no inglês',
    hintNote: 'O que está errado na dica',
    save: 'Guardar',
    saved: 'Guardado',
  },
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
