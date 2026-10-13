import type { Messages } from '../en';

const answers = (total: number) => (total === 1 ? '1 resposta' : `${total} respostas`);
const dayCounts = (total: number, correct: number) =>
  `${answers(total)}, ${correct === 1 ? '1 certa' : `${correct} certas`}`;
const questions = (total: number) => (total === 1 ? '1 pergunta' : `${total} perguntas`);

export const progress: Messages['progress'] = {
  title: 'Progresso',
  loading: 'A carregar o progresso',
  loadFailed: 'Não foi possível ler o progresso neste dispositivo. Recarregue a página para tentar de novo.',
  readiness: 'Preparação',
  percent: (percent) => `${percent} %`,
  unseen: (count) => `${count} por ver`,
  passLine: (percent) => `Linha de aprovação ${percent} %`,

  days: 'Últimos 30 dias',
  daysChart: 'Respostas por dia, da mais antiga para a mais recente',
  dayBar: (date, total, correct) => `${date}: ${dayCounts(total, correct)}`,
  todayBar: (date, total, correct) => `Hoje, ${date}: ${dayCounts(total, correct)}`,
  today: 'Hoje',
  todayCounts: (total, correct) => `Hoje: ${dayCounts(total, correct)}`,

  groups: 'Taxa de acerto',
  groupsHint: 'Os mais fracos primeiro. Toque num deles para o praticar.',
  topics: 'Temas',
  sections: 'Secções',
  patterns: 'Padrões',
  seen: (seen, total) => `Vistas ${seen} de ${total}`,
  questions,
  notStarted: 'Por começar',
  startedRow: (name, percent, seen, total) => `${name}: ${percent} %, vistas ${seen} de ${total}`,
  notStartedRow: (name, total) => `${name}: por começar, ${questions(total)}`,

  exams: 'Exames anteriores',
  noExams: 'Ainda não há exames terminados.',
  score: (score, size) => `${score} / ${size}`,
  passed: 'Aprovado',
  notPassed: 'Não aprovado',
  examRow: (date, score, size, outcome) => `${date}: ${score} de ${size}, ${outcome}`,

  flagged: (count) => `Assinaladas (${count})`,
};
