import { describe, expect, it } from 'vitest';
import type { Db } from '../rag/store';
import { createTicketStore } from './ticket-store';

interface Call {
  sql: string;
  params: unknown[];
}

function makeFakeDb(rows: Record<string, unknown>[] = []) {
  const calls: Call[] = [];
  const db: Db = {
    query: (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return Promise.resolve({ rows });
    },
    connect: () => Promise.reject(new Error('ticket-store nem nyit tranzakciót')),
  };
  return { db, calls };
}

const requestRow = {
  id: 'req-1',
  created_at: '2026-08-17T10:00:00.000Z',
  question: 'Catanban mi történik, ha 7-est dobok?',
  path: 'auto',
  retrieval_status: 'ok',
  min_distance: 0.21,
  answer: 'A rablót mozgatod.',
  sources: [{ source: 'https://ex', game: 'Catan', section: 'jatekmenet', heading: null }],
  usage_tokens: 8000,
  latency_ms: 1200,
  ticket_id: null,
};

describe('createTicketStore', () => {
  it('insertRequest paraméterezett SQL-lel ír, a sources JSON', async () => {
    const { db, calls } = makeFakeDb();
    const store = createTicketStore(db);
    await store.insertRequest({
      id: 'req-1',
      question: 'kérdés',
      path: 'auto',
      retrievalStatus: 'ok',
      minDistance: 0.2,
      answer: 'válasz',
      sources: [{ source: 'u', game: 'Catan', section: 'jatekmenet', heading: null }],
      usageTokens: 10,
      latencyMs: 5,
      ticketId: null,
    });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.sql).toMatch(/INSERT INTO customer_requests/i);
    expect(call?.params[0]).toBe('req-1');
    expect(call?.params[6]).toContain('Catan');
    expect(call?.params[10]).toBeUndefined();
  });

  it('getRequest üres találatnál null, sornál típusos rekord', async () => {
    const empty = makeFakeDb([]);
    expect(await createTicketStore(empty.db).getRequest('x')).toBeNull();

    const found = makeFakeDb([requestRow]);
    const rec = await createTicketStore(found.db).getRequest('req-1');
    expect(rec?.path).toBe('auto');
    expect(rec?.minDistance).toBe(0.21);
    expect(rec?.sources[0]?.game).toBe('Catan');
  });

  it('resolveTicket csak pending sort frissít, approve → approved', async () => {
    const { db, calls } = makeFakeDb([
      {
        id: 't-1',
        created_at: '2026-08-17T10:00:00.000Z',
        request_id: 'req-1',
        question: 'Gloomhaven?',
        reason: 'empty_retrieval',
        draft_answer: 'nincs infó',
        status: 'approved',
        operator_answer: 'Ezt a játékot még nem tudjuk.',
        resolved_at: '2026-08-17T10:05:00.000Z',
        resolved_by: 'Anna',
        resolution_tag: 'out_of_scope',
      },
    ]);
    const ticket = await createTicketStore(db).resolveTicket({
      ticketId: 't-1',
      action: 'approve',
      operator: 'Anna',
      answer: 'Ezt a játékot még nem tudjuk.',
      tag: 'out_of_scope',
    });
    expect(calls[0]?.sql).toMatch(/UPDATE customer_tickets/i);
    expect(calls[0]?.params[1]).toBe('approved');
    expect(ticket?.status).toBe('approved');
    expect(ticket?.resolutionTag).toBe('out_of_scope');
  });

  it('flagWrongAuto auto-ágon true, ha a UPDATE visszaad sort', async () => {
    const hit = makeFakeDb([{ id: 'req-1' }]);
    expect(await createTicketStore(hit.db).flagWrongAuto('req-1')).toBe(true);
    expect(hit.calls[0]?.sql).toMatch(/feedback = 'wrong_auto'/);

    const miss = makeFakeDb([]);
    expect(await createTicketStore(miss.db).flagWrongAuto('req-x')).toBe(false);
  });

  it('metrics a számlálókat számra alakítja', async () => {
    const { db } = makeFakeDb([
      {
        requests: '4',
        auto: '3',
        escalate: '1',
        pending_tickets: '1',
        resolved_tickets: '0',
        should_have_auto: '0',
        avg_latency_ms: '1500.5',
        wrong_auto: '0',
      },
    ]);
    const m = await createTicketStore(db).metrics();
    expect(m).toEqual({
      requests: 4,
      auto: 3,
      escalate: 1,
      pendingTickets: 1,
      resolvedTickets: 0,
      shouldHaveAuto: 0,
      wrongAuto: 0,
      avgLatencyMs: 1500.5,
    });
  });
});
