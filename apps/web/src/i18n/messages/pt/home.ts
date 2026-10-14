import type { Messages } from '../en';
import { common } from './common';

const minutesLeft = (minutes: number) => (minutes === 1 ? 'Falta 1 minuto' : `Faltam ${minutes} minutos`);

export const home: Messages['home'] = {
  title: common.appName,
  readiness: 'Preparação',
  loading: 'A carregar o progresso',
  loadFailed: 'Não foi possível ler o progresso neste dispositivo. Recarregue a página para tentar de novo.',
  percent: (percent) => `${percent} %`,
  passLine: (percent) => `Linha de aprovação ${percent} %`,
  unseen: (count) => `${count} por ver`,
  examInProgress: 'Exame em curso',
  examStatus: (minutes, answered, size) => `${minutesLeft(minutes)} · ${answered} de ${size} respondidas`,
  practiceLine: 'As mais fracas primeiro',
  examLine: (size, minutes) => `${size} perguntas · ${minutes} min`,
  weakestTopics: 'Temas mais fracos',
  allTopics: 'Todos os temas',
  seen: (seen, total) => `Vistas ${seen} de ${total}`,
  topicRow: (name, percent, seen, total) => `${name}: ${percent} %, vistas ${seen} de ${total}`,
};
