import type { Messages } from '../en';

/** Uma contagem com o seu nome, no singular para um. */
const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const settings: Messages['settings'] = {
  title: 'Definições',
  notSaving:
    'O progresso não está a ser guardado neste dispositivo: dura apenas até fechar esta página. Exportar guarda uma cópia.',
  language: 'Idioma',
  progress: 'Progresso',
  progressHelp:
    'Exportar guarda as suas respostas, exames e assinalações num ficheiro. Importar junta o progresso desse ficheiro, deste ou de outro dispositivo, ao progresso aqui guardado.',
  export: 'Exportar',
  share: 'Partilhar',
  shareTitle: 'Progresso do Caçador',
  import: 'Importar',
  importFile: 'Ficheiro de progresso a importar',
  importing: 'A importar',
  imported: (answers, exams, flags) =>
    `Adicionado: ${counted(answers, 'resposta', 'respostas')}, ${counted(exams, 'exame', 'exames')} e ${counted(flags, 'assinalação', 'assinalações')}`,
  importRefused: 'Esse ficheiro não é uma exportação de progresso do Caçador. Nada foi alterado.',
  failed: 'Não foi possível ler nem gravar o progresso neste dispositivo. Nada foi alterado.',
  clear: 'Limpar o progresso',
  clearTitle: 'Limpar todo o progresso?',
  clearDescription:
    'Isto apaga todas as respostas, exames e assinalações deste dispositivo e não pode ser desfeito. O idioma mantém-se. Exporte primeiro para guardar uma cópia.',
  clearConfirm: 'Limpar tudo',
  clearCancel: 'Cancelar',
  cleared: 'Progresso limpo',
  flaggedLink: 'Assinaladas',
};
