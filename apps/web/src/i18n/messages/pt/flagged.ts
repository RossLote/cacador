import type { Messages } from '../en';

export const flagged: Messages['flagged'] = {
  title: 'Assinaladas',
  empty: 'Nenhuma pergunta assinalada. Assinale uma depois de responder em Praticar.',
  loading: 'A carregar as assinaladas',
  list: 'Assinaladas, as mais recentes primeiro',
  questionNumber: (id) => `Pergunta ${id}`,
  kindEnglish: 'Inglês',
  kindHint: 'Dica',
  noNote: 'Sem nota',
  copy: 'Copiar',
  copied: 'Copiado',
  copyFailed: 'Não foi possível copiar',
  share: 'Partilhar',
  clear: 'Limpar',
  clearLabel: (id, kind) => `Limpar a assinalação de ${kind} na pergunta ${id}`,
};
