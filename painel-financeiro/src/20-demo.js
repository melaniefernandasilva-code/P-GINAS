/* Modo demonstração: dados fictícios, separados dos reais e nunca salvos. */
function demoState() {
  const T = E.today();
  const st = M.defaultState();
  const m0 = U.monthKey(T);
  const day = (n) => U.addDays(T, n);
  st.settings.startDate = U.monthKey(T) + '-01';
  st.settings.proGoal = 1200000;
  st.settings.cardGoalStart = st.settings.startDate;
  st.setup = { start: 'feito', accounts: 'feito', clients: 'feito', fixed: 'feito', cards: 'feito', debts: 'feito', goals: 'pulado' };
  st.accounts = [
    { id: 'da1', name: 'Exemplo: conta pessoal 1', type: 'pessoal', bank: 'Banco A', initialBalance: 84000, refDate: T, balanceSetAt: 1 },
    { id: 'da2', name: 'Exemplo: conta pessoal 2', type: 'pessoal', bank: 'Banco B', initialBalance: 12000, refDate: T, balanceSetAt: 1 },
    { id: 'da3', name: 'Exemplo: conta PJ', type: 'pj', bank: 'Banco C', initialBalance: 615000, refDate: T, balanceSetAt: 1 },
  ];
  st.settings.defaultPesAccountId = 'da1';
  st.settings.defaultProAccountId = 'da3';
  st.services = [
    { id: 'dv1', name: 'Gestão de Instagram', kind: 'servico', price: 250000, recurring: true },
    { id: 'dv2', name: 'Gestão de tráfego', kind: 'servico', price: 180000, recurring: true },
    { id: 'dv3', name: 'Consultoria de posicionamento', kind: 'servico', price: 120000, recurring: false },
  ];
  st.clients = [
    { id: 'dc1', name: 'Cliente exemplo: Café Lume', serviceId: 'dv1', amount: 250000, startDate: U.addMonths(T, -8), endDate: null, dueDay: 10, frequency: 'mensal', status: 'ativo', renewal: 'sem_termino', adjustments: [{ id: 'a1', date: U.addMonths(T, 2).slice(0, 8) + '01', amount: 275000, confirmed: false }], accountId: 'da3', categoryId: 'c_pro_mens' },
    { id: 'dc2', name: 'Cliente exemplo: Studio Norte', serviceId: 'dv2', amount: 180000, startDate: U.addMonths(T, -5), endDate: U.addDays(U.addMonths(T, 1), 18), dueDay: 5, frequency: 'mensal', status: 'ativo', renewal: 'nao_confirmada', adjustments: [], accountId: 'da3', categoryId: 'c_pro_mens' },
    { id: 'dc3', name: 'Cliente exemplo: Loja Brisa', serviceId: 'dv1', amount: 220000, startDate: U.addMonths(T, -3), endDate: null, dueDay: 20, frequency: 'mensal', status: 'ativo', renewal: 'sem_termino', adjustments: [], accountId: 'da1', categoryId: 'c_pro_mens' },
  ];
  st.series = [
    { id: 'ds1', type: 'despesa', description: 'Aluguel', amount: 160000, categoryId: 'c_pes_moradia', nature: 'pessoal', accountId: 'da1', frequency: 'mensal', startDate: m0 + '-08', certainty: 'confirmado' },
    { id: 'ds2', type: 'despesa', description: 'Luz e internet', amount: 32000, categoryId: 'c_pes_casa', nature: 'pessoal', accountId: 'da1', frequency: 'mensal', startDate: m0 + '-15', certainty: 'estimado' },
    { id: 'ds3', type: 'despesa', description: 'Designer parceira', amount: 150000, categoryId: 'c_pro_equipe', nature: 'profissional', accountId: 'da3', frequency: 'mensal', startDate: m0 + '-12', certainty: 'confirmado' },
    { id: 'ds4', type: 'despesa', description: 'DAS', amount: 42000, categoryId: 'c_pro_imp', nature: 'profissional', accountId: 'da3', frequency: 'mensal', startDate: m0 + '-20', certainty: 'estimado' },
    { id: 'ds5', type: 'despesa', description: 'Ferramenta de design', amount: 5500, categoryId: 'c_pro_ferr', nature: 'profissional', cardId: 'dk1', frequency: 'mensal', startDate: m0 + '-03', certainty: 'confirmado' },
    { id: 'ds6', type: 'despesa', description: 'Mercado (estimativa)', amount: 90000, categoryId: 'c_pes_alim', nature: 'pessoal', accountId: 'da1', frequency: 'mensal', startDate: m0 + '-25', certainty: 'estimado' },
  ];
  st.entries = [
    { id: 'de1', type: 'transferencia', fromId: 'da3', toId: 'da1', amount: 350000, dueDate: day(3), status: 'previsto', purpose: 'retirada', description: 'Retirada pessoal' },
    { id: 'de2', type: 'receita', description: 'Consultoria pontual', amount: 120000, categoryId: 'c_pro_pont', nature: 'profissional', accountId: 'da3', dueDate: day(12), status: 'previsto', certainty: 'confirmado' },
    { id: 'de3', type: 'despesa', description: 'Conta de luz atrasada', amount: 21000, categoryId: 'c_pes_casa', nature: 'pessoal', accountId: 'da1', dueDate: day(-6), status: 'previsto', certainty: 'confirmado' },
  ];
  st.cards = [
    { id: 'dk1', name: 'Exemplo: meu cartão', owner: 'proprio', limit: 600000, closingDay: 3, dueDay: 10, payAccountId: 'da1', defaultNature: 'pessoal', avoid: false },
    { id: 'dk2', name: 'Exemplo: cartão da mãe', owner: 'mae', holder: 'Mãe', closingDay: 25, dueDay: 5, payAccountId: 'da1', defaultNature: 'pessoal', avoid: true, endMonth: '2027-02' },
  ];
  st.purchases = [
    { id: 'dp1', kind: 'compra', cardId: 'dk2', description: 'Celular (parcelas restantes)', date: U.addMonths(T, -9), categoryId: 'c_pes_compras', nature: 'pessoal', mode: 'restante', installmentValue: 41000, remaining: Math.max(1, U.monthsDiff(m0, '2027-02') + 1), paidBefore: 8, firstInvoice: U.addMonthKey(m0, 1), status: 'ativa' },
    { id: 'dp2', kind: 'compra', cardId: 'dk1', description: 'Curso de copywriting', date: day(-20), categoryId: 'c_pro_curso', nature: 'profissional', mode: 'total', total: 89700, n: 3, firstInvoice: E.invoiceMonthFor({ closingDay: 3, dueDay: 10 }, day(-20)), status: 'ativa' },
    { id: 'dp3', kind: 'compra', cardId: 'dk1', description: 'Farmácia', date: day(-2), categoryId: 'c_pes_saude', nature: 'pessoal', mode: 'total', total: 12850, n: 1, firstInvoice: E.invoiceMonthFor({ closingDay: 3, dueDay: 10 }, day(-2)), status: 'ativa' },
    { id: 'dp4', kind: 'pix_credito', cardId: 'dk1', description: 'Pix no crédito para o aluguel', date: day(-12), nature: 'pessoal', mode: 'total', total: 96000, n: 4, net: 80000, destination: 'conta', accountId: 'da1', firstInvoice: E.invoiceMonthFor({ closingDay: 3, dueDay: 10 }, day(-12)), status: 'ativa' },
  ];
  st.debts = [
    { id: 'dd1', creditor: 'Exemplo: empréstimo pessoal', type: 'emprestimo', nature: 'pessoal', balance: 640000, balanceDate: day(-10), rate: 4.9, ratePeriod: 'mensal', installmentAmount: 52000, installmentsLeft: 18, nextDueDate: day(9), status: 'ativa', payAccountId: 'da1', linkedPurchaseIds: [] },
    { id: 'dd2', creditor: 'Exemplo: parcelas no cartão da mãe', type: 'cartao_terceiro', nature: 'pessoal', balance: null, status: 'ativa', linkedPurchaseIds: ['dp1'] },
    { id: 'dd3', creditor: 'Exemplo: conta de telefone antiga', type: 'conta_atrasada', nature: 'pessoal', balance: 38000, balanceDate: day(-40), rate: null, overdueSince: day(-70), nextDueDate: day(-70), status: 'ativa', payAccountId: 'da1', linkedPurchaseIds: [] },
  ];
  st.reserves = [
    { id: 'dr1', nature: 'pessoal', kind: 'reserva', name: 'Reserva de emergência pessoal', initialBalance: 150000, initialDate: T, months: 6, base: { mode: 'itens', seriesIds: ['ds1', 'ds2', 'ds6'] }, monthlyPlan: 20000, planDay: 15, planAccountId: 'da1' },
    { id: 'dr2', nature: 'profissional', kind: 'reserva', name: 'Reserva profissional', initialBalance: 300000, initialDate: T, months: 3, base: { mode: 'itens', seriesIds: ['ds3', 'ds4'] } },
  ];
  st.meta.rev = 1;
  return M.migrate(st);
}
ACT.demoOn = () => {
  if (UI.demo) return;
  UI.realState = S; UI.demo = true; S = demoState(); UI.undo = null;
  go('inicio');
  toast('Demonstração aberta. Nada aqui é salvo.');
};
ACT.demoOff = () => {
  if (!UI.demo) return;
  S = UI.realState; UI.realState = null; UI.demo = false; UI.undo = null;
  go('inicio');
  toast('Você voltou aos seus dados.');
};
