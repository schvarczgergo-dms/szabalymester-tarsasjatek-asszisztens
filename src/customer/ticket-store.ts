import type { RetrievedSourceRecord } from '../agent/tool-outcome';
import type { Db } from '../rag/store';
import type { EscalateReason } from './decide-path';

export type RequestPath = 'auto' | 'escalate';
export type RetrievalStatus = 'ok' | 'empty' | 'error' | 'none';
export type TicketStatus = 'pending' | 'approved' | 'rejected';
export type ResolutionTag = 'answered' | 'should_have_auto' | 'out_of_scope';

export interface CustomerRequestRecord {
  id: string;
  createdAt: string;
  question: string;
  path: RequestPath;
  retrievalStatus: RetrievalStatus;
  minDistance: number | null;
  answer: string | null;
  sources: RetrievedSourceRecord[];
  usageTokens: number;
  latencyMs: number;
  ticketId: string | null;
  feedback: 'wrong_auto' | null;
}

export interface TicketRecord {
  id: string;
  createdAt: string;
  requestId: string;
  question: string;
  reason: EscalateReason | string;
  draftAnswer: string | null;
  status: TicketStatus;
  operatorAnswer: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionTag: ResolutionTag | null;
}

export interface InsertRequestInput {
  id: string;
  question: string;
  path: RequestPath;
  retrievalStatus: RetrievalStatus;
  minDistance: number | null;
  answer: string | null;
  sources: RetrievedSourceRecord[];
  usageTokens: number;
  latencyMs: number;
  ticketId: string | null;
}

export interface InsertTicketInput {
  id: string;
  requestId: string;
  question: string;
  reason: EscalateReason;
  draftAnswer: string | null;
}

export interface ResolveTicketInput {
  ticketId: string;
  action: 'approve' | 'reject';
  operator: string;
  answer: string;
  tag: ResolutionTag;
}

export interface MetricsSnapshot {
  requests: number;
  auto: number;
  escalate: number;
  pendingTickets: number;
  resolvedTickets: number;
  shouldHaveAuto: number;
  wrongAuto: number;
  avgLatencyMs: number | null;
}

export interface TicketStore {
  insertRequest(input: InsertRequestInput): Promise<void>;
  insertTicket(input: InsertTicketInput): Promise<void>;
  getRequest(id: string): Promise<CustomerRequestRecord | null>;
  getTicket(id: string): Promise<TicketRecord | null>;
  listTickets(status: TicketStatus): Promise<TicketRecord[]>;
  resolveTicket(input: ResolveTicketInput): Promise<TicketRecord | null>;
  flagWrongAuto(requestId: string): Promise<boolean>;
  metrics(): Promise<MetricsSnapshot>;
}

const INSERT_REQUEST_SQL = `
  INSERT INTO customer_requests
    (id, question, path, retrieval_status, min_distance, answer, sources, usage_tokens, latency_ms, ticket_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
`;

const INSERT_TICKET_SQL = `
  INSERT INTO customer_tickets
    (id, request_id, question, reason, draft_answer, status)
  VALUES ($1, $2, $3, $4, $5, 'pending')
`;

const GET_REQUEST_SQL = `
  SELECT id, created_at, question, path, retrieval_status, min_distance, answer, sources,
         usage_tokens, latency_ms, ticket_id, feedback
  FROM customer_requests
  WHERE id = $1
`;

const GET_TICKET_SQL = `
  SELECT id, created_at, request_id, question, reason, draft_answer, status,
         operator_answer, resolved_at, resolved_by, resolution_tag
  FROM customer_tickets
  WHERE id = $1
`;

const LIST_TICKETS_SQL = `
  SELECT id, created_at, request_id, question, reason, draft_answer, status,
         operator_answer, resolved_at, resolved_by, resolution_tag
  FROM customer_tickets
  WHERE status = $1
  ORDER BY created_at ASC
`;

const RESOLVE_TICKET_SQL = `
  UPDATE customer_tickets
  SET status = $2,
      operator_answer = $3,
      resolved_at = now(),
      resolved_by = $4,
      resolution_tag = $5
  WHERE id = $1 AND status = 'pending'
  RETURNING id, created_at, request_id, question, reason, draft_answer, status,
            operator_answer, resolved_at, resolved_by, resolution_tag
`;

const FLAG_WRONG_AUTO_SQL = `
  UPDATE customer_requests
  SET feedback = 'wrong_auto'
  WHERE id = $1 AND path = 'auto' AND feedback IS NULL
  RETURNING id
`;

const METRICS_SQL = `
  SELECT
    (SELECT count(*)::int FROM customer_requests) AS requests,
    (SELECT count(*)::int FROM customer_requests WHERE path = 'auto') AS auto,
    (SELECT count(*)::int FROM customer_requests WHERE path = 'escalate') AS escalate,
    (SELECT count(*)::int FROM customer_tickets WHERE status = 'pending') AS pending_tickets,
    (SELECT count(*)::int FROM customer_tickets WHERE status IN ('approved', 'rejected')) AS resolved_tickets,
    (SELECT count(*)::int FROM customer_tickets WHERE resolution_tag = 'should_have_auto') AS should_have_auto,
    (SELECT count(*)::int FROM customer_requests WHERE feedback = 'wrong_auto') AS wrong_auto,
    (SELECT avg(latency_ms) FROM customer_requests) AS avg_latency_ms
`;

function asRecord(row: Record<string, unknown>): CustomerRequestRecord {
  const sourcesRaw = row.sources;
  const sources = Array.isArray(sourcesRaw) ? (sourcesRaw as RetrievedSourceRecord[]) : [];
  return {
    id: String(row.id ?? ''),
    createdAt: String(row.created_at ?? ''),
    question: String(row.question ?? ''),
    path: row.path === 'escalate' ? 'escalate' : 'auto',
    retrievalStatus: parseRetrievalStatus(row.retrieval_status),
    minDistance: row.min_distance == null ? null : Number(row.min_distance),
    answer: row.answer == null ? null : String(row.answer),
    sources,
    usageTokens: Number(row.usage_tokens ?? 0),
    latencyMs: Number(row.latency_ms ?? 0),
    ticketId: row.ticket_id == null ? null : String(row.ticket_id),
    feedback: row.feedback === 'wrong_auto' ? 'wrong_auto' : null,
  };
}

function asTicket(row: Record<string, unknown>): TicketRecord {
  const status = parseTicketStatus(row.status);
  const tag = parseResolutionTag(row.resolution_tag);
  return {
    id: String(row.id ?? ''),
    createdAt: String(row.created_at ?? ''),
    requestId: String(row.request_id ?? ''),
    question: String(row.question ?? ''),
    reason: String(row.reason ?? ''),
    draftAnswer: row.draft_answer == null ? null : String(row.draft_answer),
    status,
    operatorAnswer: row.operator_answer == null ? null : String(row.operator_answer),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
    resolvedBy: row.resolved_by == null ? null : String(row.resolved_by),
    resolutionTag: tag,
  };
}

function parseRetrievalStatus(value: unknown): RetrievalStatus {
  if (value === 'ok' || value === 'empty' || value === 'error' || value === 'none') return value;
  return 'none';
}

function parseTicketStatus(value: unknown): TicketStatus {
  if (value === 'pending' || value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

function parseResolutionTag(value: unknown): ResolutionTag | null {
  if (value === 'answered' || value === 'should_have_auto' || value === 'out_of_scope') return value;
  return null;
}

/** A PoC jegy- és kérésnaplója (paraméterezett SQL, a `Db` porton). */
export function createTicketStore(db: Db): TicketStore {
  return {
    async insertRequest(input) {
      await db.query(INSERT_REQUEST_SQL, [
        input.id,
        input.question,
        input.path,
        input.retrievalStatus,
        input.minDistance,
        input.answer,
        JSON.stringify(input.sources),
        input.usageTokens,
        input.latencyMs,
        input.ticketId,
      ]);
    },

    async insertTicket(input) {
      await db.query(INSERT_TICKET_SQL, [
        input.id,
        input.requestId,
        input.question,
        input.reason,
        input.draftAnswer,
      ]);
    },

    async getRequest(id) {
      const result = await db.query(GET_REQUEST_SQL, [id]);
      const row = result.rows[0];
      return row === undefined ? null : asRecord(row);
    },

    async getTicket(id) {
      const result = await db.query(GET_TICKET_SQL, [id]);
      const row = result.rows[0];
      return row === undefined ? null : asTicket(row);
    },

    async listTickets(status) {
      const result = await db.query(LIST_TICKETS_SQL, [status]);
      return result.rows.map(asTicket);
    },

    async resolveTicket(input) {
      const status: TicketStatus = input.action === 'approve' ? 'approved' : 'rejected';
      const result = await db.query(RESOLVE_TICKET_SQL, [
        input.ticketId,
        status,
        input.answer,
        input.operator,
        input.tag,
      ]);
      const row = result.rows[0];
      return row === undefined ? null : asTicket(row);
    },

    async flagWrongAuto(requestId) {
      const result = await db.query(FLAG_WRONG_AUTO_SQL, [requestId]);
      return result.rows[0] !== undefined;
    },

    async metrics() {
      const result = await db.query(METRICS_SQL);
      const row = result.rows[0] ?? {};
      const avg = row.avg_latency_ms;
      return {
        requests: Number(row.requests ?? 0),
        auto: Number(row.auto ?? 0),
        escalate: Number(row.escalate ?? 0),
        pendingTickets: Number(row.pending_tickets ?? 0),
        resolvedTickets: Number(row.resolved_tickets ?? 0),
        shouldHaveAuto: Number(row.should_have_auto ?? 0),
        wrongAuto: Number(row.wrong_auto ?? 0),
        avgLatencyMs: avg == null ? null : Number(avg),
      };
    },
  };
}
