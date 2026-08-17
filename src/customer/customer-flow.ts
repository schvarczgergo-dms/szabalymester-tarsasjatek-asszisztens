import { randomUUID } from 'node:crypto';
import type { AgentAnswer } from '../agent/agent';
import type { RetrievedSourceRecord } from '../agent/tool-outcome';
import { decidePath, minDistance, retrievalStatus, type EscalateReason } from './decide-path';
import type { TicketStore } from './ticket-store';

export interface CustomerAskResult {
  requestId: string;
  path: 'auto' | 'escalate';
  /** Auto-ágon a grounded válasz; eszkalációnál a vendégnek szóló várakozási szöveg. */
  customerMessage: string;
  sources: RetrievedSourceRecord[];
  ticketId: string | null;
  ticketStatus: 'pending' | 'approved' | 'rejected' | null;
  feedback: 'wrong_auto' | null;
}

export interface CustomerStatusResult {
  requestId: string;
  path: 'auto' | 'escalate';
  customerMessage: string;
  sources: RetrievedSourceRecord[];
  ticketId: string | null;
  ticketStatus: 'pending' | 'approved' | 'rejected' | null;
  feedback: 'wrong_auto' | null;
}

const AI_DISCLOSURE =
  'Ezt a választ a Szabálymester AI állította össze a tudásbázisból. Nem hivatalos bírói döntés.';

const ESCALATE_COPY =
  'Ezt a kérdést továbbítottuk a játékmesternek, mert a tudásbázisban nem találtunk elég megbízható választ. Add meg később az azonosítót, és megnézheted, válaszolt-e már.';

function uniqueSources(result: AgentAnswer): RetrievedSourceRecord[] {
  const seen = new Set<string>();
  const sources: RetrievedSourceRecord[] = [];
  for (const outcome of result.reports) {
    for (const source of outcome.report.sources) {
      if (!seen.has(source.source)) {
        seen.add(source.source);
        sources.push(source);
      }
    }
  }
  return sources;
}

function formatAutoMessage(answer: string): string {
  return `${answer.trim()}\n\n${AI_DISCLOSURE}`;
}

function formatEscalateMessage(requestId: string): string {
  return `${ESCALATE_COPY}\n\nAzonosító: ${requestId}`;
}

async function persistEscalation(
  tickets: TicketStore,
  input: {
    requestId: string;
    ticketId: string;
    question: string;
    reason: EscalateReason;
    retrievalStatus: 'ok' | 'empty' | 'error' | 'none';
    minDistance: number | null;
    answer: string | null;
    sources: RetrievedSourceRecord[];
    usageTokens: number;
    latencyMs: number;
  },
): Promise<CustomerAskResult> {
  await tickets.insertRequest({
    id: input.requestId,
    question: input.question,
    path: 'escalate',
    retrievalStatus: input.retrievalStatus,
    minDistance: input.minDistance,
    answer: input.answer,
    sources: input.sources,
    usageTokens: input.usageTokens,
    latencyMs: input.latencyMs,
    ticketId: input.ticketId,
  });
  await tickets.insertTicket({
    id: input.ticketId,
    requestId: input.requestId,
    question: input.question,
    reason: input.reason,
    draftAnswer: input.answer,
  });
  return {
    requestId: input.requestId,
    path: 'escalate',
    customerMessage: formatEscalateMessage(input.requestId),
    sources: [],
    ticketId: input.ticketId,
    ticketStatus: 'pending',
    feedback: null,
  };
}

/**
 * Egy vendégkérdés végigvitele: a meglévő grounded agent + döntés (auto / emberi kapu) + napló.
 * Az agent, a tudásbázis és a searchRules tool változatlan — ez csak új bejárat.
 */
export async function handleCustomerQuestion(
  question: string,
  deps: {
    ask: (q: string) => Promise<AgentAnswer>;
    tickets: TicketStore;
    now?: () => number;
    id?: () => string;
  },
): Promise<CustomerAskResult> {
  const trimmed = question.trim();
  const nextId = deps.id ?? randomUUID;
  const t0 = (deps.now ?? Date.now)();
  let result: AgentAnswer;
  try {
    result = await deps.ask(trimmed);
  } catch (error) {
    const latencyMs = Math.max(0, (deps.now ?? Date.now)() - t0);
    const draft = error instanceof Error ? error.message : 'Ismeretlen hiba.';
    return persistEscalation(deps.tickets, {
      requestId: nextId(),
      ticketId: nextId(),
      question: trimmed,
      reason: 'agent_error',
      retrievalStatus: 'none',
      minDistance: null,
      answer: draft,
      sources: [],
      usageTokens: 0,
      latencyMs,
    });
  }
  const latencyMs = Math.max(0, (deps.now ?? Date.now)() - t0);
  const decision = decidePath(result.reports, trimmed);
  const sources = uniqueSources(result);
  const requestId = nextId();

  if (decision.path === 'auto') {
    const customerMessage = formatAutoMessage(result.answer);
    await deps.tickets.insertRequest({
      id: requestId,
      question: trimmed,
      path: 'auto',
      retrievalStatus: retrievalStatus(result.reports),
      minDistance: minDistance(result.reports),
      answer: result.answer,
      sources,
      usageTokens: result.usage.tokens,
      latencyMs,
      ticketId: null,
    });
    return {
      requestId,
      path: 'auto',
      customerMessage,
      sources,
      ticketId: null,
      ticketStatus: null,
      feedback: null,
    };
  }

  return persistEscalation(deps.tickets, {
    requestId,
    ticketId: nextId(),
    question: trimmed,
    reason: decision.reason,
    retrievalStatus: retrievalStatus(result.reports),
    minDistance: minDistance(result.reports),
    answer: result.answer,
    sources,
    usageTokens: result.usage.tokens,
    latencyMs,
  });
}

/** A vendég az azonosítóval megnézi, hol tart a kérdése (auto-válasz vagy jegyállapot). */
export async function getCustomerStatus(
  requestId: string,
  tickets: TicketStore,
): Promise<CustomerStatusResult | null> {
  const request = await tickets.getRequest(requestId.trim());
  if (request === null) return null;

  if (request.path === 'auto') {
    return {
      requestId: request.id,
      path: 'auto',
      customerMessage: formatAutoMessage(request.answer ?? ''),
      sources: request.sources,
      ticketId: null,
      ticketStatus: null,
      feedback: request.feedback,
    };
  }

  const ticket = request.ticketId === null ? null : await tickets.getTicket(request.ticketId);
  if (ticket === null || ticket.status === 'pending') {
    return {
      requestId: request.id,
      path: 'escalate',
      customerMessage: formatEscalateMessage(request.id),
      sources: [],
      ticketId: request.ticketId,
      ticketStatus: 'pending',
      feedback: null,
    };
  }

  const prefix =
    ticket.status === 'approved'
      ? 'A játékmester válasza:'
      : 'A játékmester nem tudott választ adni erre a kérdésre:';
  return {
    requestId: request.id,
    path: 'escalate',
    customerMessage: `${prefix}\n\n${(ticket.operatorAnswer ?? '').trim()}`,
    sources: [],
    ticketId: ticket.id,
    ticketStatus: ticket.status,
    feedback: null,
  };
}
