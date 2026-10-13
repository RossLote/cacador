import type { Messages } from '../en';

export const exam: Messages['exam'] = {
  title: 'Exame',
  loading: 'A carregar o exame…',
  intro: (size, minutes, passMark) =>
    `Um exame simulado como o verdadeiro: ${size} perguntas tiradas de todo o banco, ${minutes} minutos e ${passMark} respostas certas para ficar aprovado.`,
  rules: 'Pode andar livremente entre as perguntas e mudar qualquer resposta até entregar. Sem inglês nem dicas até aos resultados.',
  start: 'Começar',
  position: (n, total) => `${n} de ${total}`,
  timeLeft: 'Tempo restante',
  markers: 'Perguntas',
  marker: (n) => `Pergunta ${n}`,
  answered: 'Respondida',
  previous: 'Anterior',
  next: 'Seguinte',
  submit: 'Entregar',
  unansweredTitle: (count) => `${count} por responder — entregar mesmo assim?`,
  unansweredBody: 'Uma pergunta sem resposta conta como errada.',
  keepGoing: 'Voltar ao exame',
  confirmSubmit: 'Entregar',
};
