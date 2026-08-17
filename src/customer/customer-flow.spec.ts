import { describe, expect, it, vi } from 'vitest';
import type { AgentAnswer } from '../agent/agent';
import { emptyTraceEntry, type ToolOutcome } from '../agent/tool-outcome';
import { getCustomerStatus, handleCustomerQuestion } from './customer-flow';
import type {
  CustomerRequestRecord,
  InsertRequestInput,
  InsertTicketInput,
  TicketRecord,
  TicketStore,
} from './ticket-store';

const outcome = (status: ToolOutcome['status']): ToolOutcome => ({
  status,
  content: status === 'ok' ? 'chunk' : 'nincs',
  report: {
    ...emptyTraceEntry('q'),
    distances: status === 'ok' ? [0.18] : [],
    empty: status !== 'ok',
    sources:
      status === 'ok'
        ? [{ source: 'https://ex/catan', game: 'Catan', section: 'jatekmenet', heading: null }]
        : [],
  },
});

const answer = (status: ToolOutcome['status'], text: string): AgentAnswer => ({
  answer: text,
  reports: [outcome(status)],
  usage: { tokens: 42 },
});

function memoryStore(): TicketStore & {
  requests: CustomerRequestRecord[];
  tickets: TicketRecord[];
} {
  const requests: CustomerRequestRecord[] = [];
  const tickets: TicketRecord[] = [];
  const store: TicketStore & { requests: CustomerRequestRecord[]; tickets: TicketRecord[] } = {
    requests,
    tickets,
    async insertRequest(input: InsertRequestInput) {
      requests.push({
        ...input,
        createdAt: 't0',
        feedback: null,
      });
    },
    async insertTicket(input: InsertTicketInput) {
      tickets.push({
        id: input.id,
        createdAt: 't0',
        requestId: input.requestId,
        question: input.question,
        reason: input.reason,
        draftAnswer: input.draftAnswer,
        status: 'pending',
        operatorAnswer: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionTag: null,
      });
    },
    async getRequest(id) {
      return requests.find((r) => r.id === id) ?? null;
    },
    async getTicket(id) {
      return tickets.find((t) => t.id === id) ?? null;
    },
    async listTickets(status) {
      return tickets.filter((t) => t.status === status);
    },
    async resolveTicket() {
      return null;
    },
    async flagWrongAuto() {
      return false;
    },
    async metrics() {
      return {
        requests: requests.length,
        auto: requests.filter((r) => r.path === 'auto').length,
        escalate: requests.filter((r) => r.path === 'escalate').length,
        pendingTickets: tickets.filter((t) => t.status === 'pending').length,
        resolvedTickets: 0,
        shouldHaveAuto: 0,
        wrongAuto: 0,
        avgLatencyMs: null,
      };
    },
  };
  return store;
}

describe('handleCustomerQuestion', () => {
  it('grounded találatnál auto-választ ad, jegyet nem nyit, forrást megtart', async () => {
    const tickets = memoryStore();
    let n = 0;
    const result = await handleCustomerQuestion('Catanban mi történik, ha 7-est dobok?', {
      ask: () => Promise.resolve(answer('ok', 'A rablót mozgatod, és eldobhatsz lapokat.')),
      tickets,
      now: (() => {
        let t = 1000;
        return () => {
          t += 100;
          return t;
        };
      })(),
      id: () => `id-${++n}`,
    });
    expect(result.path).toBe('auto');
    expect(result.ticketId).toBeNull();
    expect(result.customerMessage).toContain('A rablót mozgatod');
    expect(result.customerMessage).toContain('Szabálymester AI');
    expect(result.sources[0]?.game).toBe('Catan');
    expect(tickets.tickets).toHaveLength(0);
    expect(tickets.requests[0]?.path).toBe('auto');
    expect(tickets.requests[0]?.latencyMs).toBe(100);
  });

  it('üres keresésnél jegyet nyit, a vendég a draftot nem kapja meg válaszként', async () => {
    const tickets = memoryStore();
    let n = 0;
    const result = await handleCustomerQuestion('Hogyan kell játszani a Gloomhavennel?', {
      ask: () => Promise.resolve(answer('empty', 'Erről nincs információm a tudásbázisban.')),
      tickets,
      id: () => `id-${++n}`,
    });
    expect(result.path).toBe('escalate');
    expect(result.ticketStatus).toBe('pending');
    expect(result.customerMessage).toContain('játékmesternek');
    expect(result.customerMessage).toContain('id-1');
    expect(result.customerMessage).not.toContain('nincs információm');
    expect(tickets.tickets).toHaveLength(1);
    expect(tickets.tickets[0]?.reason).toBe('empty_retrieval');
    expect(tickets.tickets[0]?.draftAnswer).toContain('nincs információm');
  });

  it('más játék chunkjánál jegyet nyit, a hallucinált auto-szöveget a vendég nem kapja', async () => {
    const tickets = memoryStore();
    let n = 0;
    const hallucinated =
      'Különböző játékokban eltérő szabályok vannak. A "Gloomhaven"-ben a játékmenet…';
    const result = await handleCustomerQuestion('Hogyan kell játszani a Gloomhavennel?', {
      ask: () => Promise.resolve(answer('ok', hallucinated)),
      tickets,
      id: () => `id-${++n}`,
    });
    expect(result.path).toBe('escalate');
    expect(result.ticketStatus).toBe('pending');
    expect(result.customerMessage).toContain('játékmesternek');
    expect(result.customerMessage).not.toContain('Különböző játékokban');
    expect(tickets.tickets[0]?.reason).toBe('game_mismatch');
    expect(tickets.tickets[0]?.draftAnswer).toContain('Gloomhaven');
    expect(tickets.requests[0]?.retrievalStatus).toBe('ok');
  });

  it('ha az agent dob, jegyet nyit agent_error okkal, a vendég nem kap nyers hibát', async () => {
    const tickets = memoryStore();
    let n = 0;
    const result = await handleCustomerQuestion('Catanban mi történik, ha 7-est dobok?', {
      ask: () => Promise.reject(new Error('ECONNREFUSED')),
      tickets,
      id: () => `id-${++n}`,
    });
    expect(result.path).toBe('escalate');
    expect(result.ticketStatus).toBe('pending');
    expect(result.customerMessage).toContain('játékmesternek');
    expect(result.customerMessage).toContain('id-1');
    expect(result.customerMessage).not.toContain('ECONNREFUSED');
    expect(tickets.tickets).toHaveLength(1);
    expect(tickets.tickets[0]?.reason).toBe('agent_error');
    expect(tickets.tickets[0]?.draftAnswer).toBe('ECONNREFUSED');
    expect(tickets.requests[0]?.retrievalStatus).toBe('none');
  });
});

describe('getCustomerStatus', () => {
  it('hiányzó azonosítónál null', async () => {
    expect(await getCustomerStatus('nincs', memoryStore())).toBeNull();
  });

  it('lezárt jegynél a játékmester válaszát adja', async () => {
    const tickets = memoryStore();
    tickets.requests.push({
      id: 'req-1',
      createdAt: 't0',
      question: 'Gloomhaven?',
      path: 'escalate',
      retrievalStatus: 'empty',
      minDistance: null,
      answer: 'draft',
      sources: [],
      usageTokens: 1,
      latencyMs: 1,
      ticketId: 't-1',
      feedback: null,
    });
    tickets.tickets.push({
      id: 't-1',
      createdAt: 't0',
      requestId: 'req-1',
      question: 'Gloomhaven?',
      reason: 'empty_retrieval',
      draftAnswer: 'draft',
      status: 'approved',
      operatorAnswer: 'Ezt a címet még nem tudjuk magyarázni, írj a pultnak.',
      resolvedAt: 't1',
      resolvedBy: 'Anna',
      resolutionTag: 'out_of_scope',
    });
    const status = await getCustomerStatus('req-1', tickets);
    expect(status?.ticketStatus).toBe('approved');
    expect(status?.customerMessage).toContain('játékmester válasza');
    expect(status?.customerMessage).toContain('pultnak');
  });

  it('elutasított jegynél a játékmester indoklását adja, nem ügy-nyitási hibát', async () => {
    const tickets = memoryStore();
    tickets.requests.push({
      id: 'req-2',
      createdAt: 't0',
      question: 'Gloomhaven?',
      path: 'escalate',
      retrievalStatus: 'empty',
      minDistance: null,
      answer: 'draft',
      sources: [],
      usageTokens: 1,
      latencyMs: 1,
      ticketId: 't-2',
      feedback: null,
    });
    tickets.tickets.push({
      id: 't-2',
      createdAt: 't0',
      requestId: 'req-2',
      question: 'Gloomhaven?',
      reason: 'empty_retrieval',
      draftAnswer: 'draft',
      status: 'rejected',
      operatorAnswer: 'Ezt a címet nem tartjuk.',
      resolvedAt: 't1',
      resolvedBy: 'Anna',
      resolutionTag: 'out_of_scope',
    });
    const status = await getCustomerStatus('req-2', tickets);
    expect(status?.ticketStatus).toBe('rejected');
    expect(status?.customerMessage).toContain('nem tudott választ adni');
    expect(status?.customerMessage).not.toContain('ügyet nyitni');
    expect(status?.customerMessage).toContain('nem tartjuk');
  });

  it('auto-válasznál viszi a korábbi wrong_auto jelölést', async () => {
    const tickets = memoryStore();
    tickets.requests.push({
      id: 'req-3',
      createdAt: 't0',
      question: 'Catan 7-es?',
      path: 'auto',
      retrievalStatus: 'ok',
      minDistance: 0.2,
      answer: 'A rablót mozgatod.',
      sources: [],
      usageTokens: 1,
      latencyMs: 1,
      ticketId: null,
      feedback: 'wrong_auto',
    });
    const status = await getCustomerStatus('req-3', tickets);
    expect(status?.path).toBe('auto');
    expect(status?.feedback).toBe('wrong_auto');
  });
});

describe('handleCustomerQuestion — ask hívás', () => {
  it('a nyers kérdést trimelve adja az agentnek', async () => {
    const ask = vi.fn(() => Promise.resolve(answer('ok', 'ok')));
    await handleCustomerQuestion('  7-es  ', {
      ask,
      tickets: memoryStore(),
      id: () => 'x',
    });
    expect(ask).toHaveBeenCalledWith('7-es');
  });
});
