/* Modelo de dados: estado inicial, categorias sugeridas e migrações. */
const M = (() => {
  const SCHEMA = 1;

  const cat = (id, name, nature, kind, extra = {}) => ({ id, name, nature, kind, essential: false, limit: null, archived: false, system: false, ...extra });

  function seedCategories() {
    return [
      // Profissional, receitas
      cat('c_pro_mens', 'Mensalidades de clientes', 'profissional', 'receita'),
      cat('c_pro_pont', 'Serviços pontuais', 'profissional', 'receita'),
      cat('c_pro_prod', 'Produtos digitais', 'profissional', 'receita'),
      // Profissional, despesas
      cat('c_pro_ferr', 'Ferramentas e assinaturas', 'profissional', 'despesa', { essential: true }),
      cat('c_pro_equipe', 'Equipe e designers', 'profissional', 'despesa', { essential: true }),
      cat('c_pro_imp', 'Impostos e DAS', 'profissional', 'despesa', { essential: true }),
      cat('c_pro_cont', 'Contabilidade', 'profissional', 'despesa', { essential: true }),
      cat('c_pro_trafego', 'Anúncios próprios', 'profissional', 'despesa'),
      cat('c_pro_equip', 'Equipamentos', 'profissional', 'despesa'),
      cat('c_pro_curso', 'Cursos e capacitação', 'profissional', 'despesa'),
      cat('c_pro_tel', 'Internet e telefone (parte do trabalho)', 'profissional', 'despesa'),
      cat('c_pro_tarifa', 'Tarifas bancárias PJ', 'profissional', 'despesa'),
      cat('c_pro_outros', 'Outras despesas profissionais', 'profissional', 'despesa'),
      // Pessoal, receitas
      cat('c_pes_outras', 'Outras entradas pessoais', 'pessoal', 'receita'),
      // Pessoal, despesas
      cat('c_pes_moradia', 'Moradia', 'pessoal', 'despesa', { essential: true }),
      cat('c_pes_casa', 'Contas da casa', 'pessoal', 'despesa', { essential: true }),
      cat('c_pes_alim', 'Alimentação e mercado', 'pessoal', 'despesa', { essential: true }),
      cat('c_pes_transp', 'Transporte', 'pessoal', 'despesa', { essential: true }),
      cat('c_pes_saude', 'Saúde', 'pessoal', 'despesa', { essential: true }),
      cat('c_pes_educ', 'Educação', 'pessoal', 'despesa'),
      cat('c_pes_dizimo', 'Dízimo e ofertas', 'pessoal', 'despesa'),
      cat('c_pes_lazer', 'Lazer e restaurantes', 'pessoal', 'despesa'),
      cat('c_pes_compras', 'Compras pessoais', 'pessoal', 'despesa'),
      cat('c_pes_beleza', 'Beleza e cuidados', 'pessoal', 'despesa'),
      cat('c_pes_assin', 'Assinaturas pessoais', 'pessoal', 'despesa'),
      cat('c_pes_presentes', 'Presentes', 'pessoal', 'despesa'),
      cat('c_pes_outros', 'Outras despesas pessoais', 'pessoal', 'despesa'),
      // Sistema (usadas pelos cálculos; podem ser renomeadas, não excluídas)
      cat('sys_juros_pes', 'Juros e tarifas de crédito', 'pessoal', 'despesa', { system: true }),
      cat('sys_juros_pro', 'Juros e tarifas de crédito', 'profissional', 'despesa', { system: true }),
      cat('sys_fatdif_pes', 'Fatura: valor sem detalhamento', 'pessoal', 'despesa', { system: true }),
      cat('sys_fatdif_pro', 'Fatura: valor sem detalhamento', 'profissional', 'despesa', { system: true }),
    ];
  }

  function defaultSettings() {
    return {
      startDate: null,
      horizon: 6,
      dueAlertDays: 5,
      contractAlertDays: 60,
      adjustAlertDays: 30,
      shortfallDays: 60,
      staleDays: 30,
      categoryAlertPct: 30,
      cardCommitPct: 30,
      overdueReceivables: 'excluir', // 'excluir' | 'incluir'
      includePlannedContributions: true,
      proBufferMode: 'meses', // 'meses' | 'valor'
      proBufferMonths: 1,
      proBufferValue: null,
      withdrawDays: 30,
      proGoal: null,
      debtBudget: null,
      avoidCardIds: [],
      cardGoalStart: null,
      reviewEveryDays: 7,
      defaultProAccountId: null,
      defaultPesAccountId: null,
    };
  }

  function defaultState() {
    return {
      schema: SCHEMA,
      meta: { rev: 0, createdAt: new Date().toISOString(), updatedAt: null },
      settings: defaultSettings(),
      setup: { start: null, accounts: null, clients: null, fixed: null, cards: null, debts: null, goals: null },
      accounts: [],
      categories: seedCategories(),
      services: [],
      clients: [],
      series: [],
      entries: [],
      cards: [],
      purchases: [],
      invoices: {},
      debts: [],
      reserves: [],
      tasks: {},
      manualTasks: [],
      reviews: [],
      scenarios: [],
    };
  }

  // Garante campos novos em estados antigos ou importados
  function migrate(st) {
    const d = defaultState();
    const out = { ...d, ...st };
    out.settings = { ...d.settings, ...(st.settings || {}) };
    out.setup = { ...d.setup, ...(st.setup || {}) };
    out.meta = { ...d.meta, ...(st.meta || {}) };
    for (const k of ['accounts', 'categories', 'services', 'clients', 'series', 'entries', 'cards', 'purchases', 'debts', 'reserves', 'manualTasks', 'reviews', 'scenarios']) {
      if (!Array.isArray(out[k])) out[k] = [];
    }
    if (!out.invoices || typeof out.invoices !== 'object') out.invoices = {};
    if (!out.tasks || typeof out.tasks !== 'object') out.tasks = {};
    // categorias de sistema sempre presentes
    const ids = new Set(out.categories.map((c) => c.id));
    for (const c of seedCategories()) if (c.system && !ids.has(c.id)) out.categories.push(c);
    out.schema = SCHEMA;
    return out;
  }

  // Validação básica de um backup importado
  function validateBackup(obj) {
    const errs = [];
    if (!obj || typeof obj !== 'object') return ['O arquivo não contém um objeto JSON.'];
    const st = obj.app === 'painel-financeiro-mel' ? obj.data : obj;
    if (!st || typeof st !== 'object') errs.push('Não encontrei os dados do painel no arquivo.');
    else {
      for (const k of ['accounts', 'entries', 'categories']) if (st[k] && !Array.isArray(st[k])) errs.push(`O campo "${k}" está em formato inválido.`);
      if (!st.settings && !st.accounts && !st.entries) errs.push('O arquivo não parece ser um backup deste painel.');
    }
    return errs;
  }

  const SETUP_STEPS = [
    { key: 'start', title: 'Data de início', desc: 'A partir de quando o painel passa a acompanhar suas finanças.', limit: 'Sem a data de início, o painel usa a data de hoje como referência.' },
    { key: 'accounts', title: 'Contas e saldos atuais', desc: 'Suas duas contas pessoais, a conta PJ e o saldo de cada uma hoje.', limit: 'Sem saldos, a projeção de caixa começa do zero e não mostra quando o dinheiro vai faltar.' },
    { key: 'clients', title: 'Clientes e próximas entradas', desc: 'Mensalidades, término de contrato e vencimentos.', limit: 'Sem clientes, o faturamento previsto fica vazio e a retirada sugerida não tem base.' },
    { key: 'fixed', title: 'Custos fixos e contas conhecidas', desc: 'Aluguel, contas da casa, assinaturas, impostos, equipe.', limit: 'Sem custos fixos, as saídas previstas ficam subestimadas.' },
    { key: 'cards', title: 'Cartões e parcelas a pagar', desc: 'Seus cartões, o cartão da sua mãe e só as parcelas que ainda faltam.', limit: 'Sem cartões, as faturas futuras não entram na projeção.' },
    { key: 'debts', title: 'Dívidas em aberto', desc: 'Contas atrasadas, empréstimos e parcelamentos.', limit: 'Sem dívidas, o plano de quitação e os alertas de juros ficam indisponíveis.' },
    { key: 'goals', title: 'Categorias, metas e reservas', desc: 'Ajustes de categorias, meta de faturamento, reserva de emergência.', limit: 'Sem metas, o painel não calcula quanto falta faturar nem o progresso das reservas.' },
  ];

  return { SCHEMA, seedCategories, defaultSettings, defaultState, migrate, validateBackup, SETUP_STEPS };
})();
if (typeof module !== 'undefined') module.exports = { M };
