import type { Messages } from '../en';
import { common } from './common';

export const home: Messages['home'] = {
  title: common.appName,
  readiness: 'Preparação',
  loading: 'A carregar o progresso',
  percent: (percent) => `${percent} %`,
  passLine: (percent) => `Linha de aprovação ${percent} %`,
  unseen: (count) => `${count} por ver`,
  examInProgress: 'Exame em curso',
  minutesLeft: (minutes) => (minutes === 1 ? 'Falta 1 minuto' : `Faltam ${minutes} minutos`),
};
