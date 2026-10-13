import type { Messages } from '../en';
import { common } from './common';

export const home: Messages['home'] = {
  title: common.appName,
  readiness: 'Preparação',
  loading: 'A carregar o progresso',
  loadFailed: 'Não foi possível ler o progresso neste dispositivo. Recarregue a página para tentar de novo.',
  percent: (percent) => `${percent} %`,
  passLine: (percent) => `Linha de aprovação ${percent} %`,
  unseen: (count) => `${count} por ver`,
  examInProgress: 'Exame em curso',
  minutesLeft: (minutes) => (minutes === 1 ? 'Falta 1 minuto' : `Faltam ${minutes} minutos`),
};
