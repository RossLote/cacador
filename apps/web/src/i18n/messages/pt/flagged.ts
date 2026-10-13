import type { Messages } from '../en';

export const flagged: Messages['flagged'] = {
  title: 'Assinaladas',
  empty: 'Nenhuma assinalação. Assinale uma pergunta depois de responder em Praticar.',
  loading: 'A carregar as assinalações',
  loadFailed: 'Não foi possível ler nem alterar as assinalações neste dispositivo. Recarregue a página para tentar de novo.',
  list: 'Assinalações, as mais recentes primeiro',
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
