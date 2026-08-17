import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAgent } from '../agent/agent';
import { loadConfig } from '../config';
import { createPgDb } from '../rag/store';
import { getCustomerStatus, handleCustomerQuestion } from './customer-flow';
import {
  createTicketStore,
  type ResolutionTag,
  type TicketStatus,
} from './ticket-store';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');
const DEFAULT_PORT = 3847;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

interface JsonBody {
  question?: unknown;
  action?: unknown;
  answer?: unknown;
  operator?: unknown;
  tag?: unknown;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function parseJson(req: IncomingMessage): Promise<JsonBody> {
  const raw = await readBody(req);
  if (raw.trim() === '') return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed !== null && typeof parsed === 'object' ? (parsed as JsonBody) : {};
}

function parsePort(env: NodeJS.ProcessEnv): number {
  const raw = env.POC_PORT?.trim();
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`POC_PORT érvénytelen: ${raw}`);
  }
  return n;
}

function isResolutionTag(value: unknown): value is ResolutionTag {
  return value === 'answered' || value === 'should_have_auto' || value === 'out_of_scope';
}

async function servePublic(res: ServerResponse, fileName: string): Promise<void> {
  const ext = fileName.slice(fileName.lastIndexOf('.'));
  const mime = MIME[ext];
  if (mime === undefined) {
    sendText(res, 404, 'Nincs ilyen fájl.');
    return;
  }
  try {
    const buf = await readFile(join(PUBLIC_DIR, fileName));
    res.writeHead(200, { 'content-type': mime });
    res.end(buf);
  } catch {
    sendText(res, 404, 'Nincs ilyen fájl.');
  }
}

/**
 * Vendég- és játékmester-felület a meglévő agent fölött. Fail-fast config, élő RAG,
 * üres találatnál emberi kapu — előre rögzített válasz nincs.
 */
export async function startPocServer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ port: number; close: () => Promise<void> }> {
  const config = loadConfig(env);
  const port = parsePort(env);
  const db = createPgDb(config.databaseUrl);
  const tickets = createTicketStore(db);
  const agent = createAgent(config);

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    const method = req.method ?? 'GET';

    try {
      if (method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        await servePublic(res, 'index.html');
        return;
      }
      if (method === 'GET' && (url.pathname === '/operator' || url.pathname === '/operator.html')) {
        await servePublic(res, 'operator.html');
        return;
      }
      if (method === 'GET' && url.pathname === '/styles.css') {
        await servePublic(res, 'styles.css');
        return;
      }
      if (method === 'GET' && url.pathname === '/customer.js') {
        await servePublic(res, 'customer.js');
        return;
      }
      if (method === 'GET' && url.pathname === '/operator.js') {
        await servePublic(res, 'operator.js');
        return;
      }

      if (method === 'POST' && url.pathname === '/api/ask') {
        const body = await parseJson(req);
        const question = typeof body.question === 'string' ? body.question.trim() : '';
        if (question === '') {
          sendJson(res, 400, { error: 'Hiányzó kérdés.' });
          return;
        }
        const result = await handleCustomerQuestion(question, { ask: agent.ask, tickets });
        sendJson(res, 200, result);
        return;
      }

      const statusMatch = /^\/api\/requests\/([^/]+)$/.exec(url.pathname);
      if (method === 'GET' && statusMatch?.[1]) {
        const result = await getCustomerStatus(decodeURIComponent(statusMatch[1]), tickets);
        if (result === null) {
          sendJson(res, 404, { error: 'Nincs ilyen azonosító.' });
          return;
        }
        sendJson(res, 200, result);
        return;
      }

      if (method === 'GET' && url.pathname === '/api/tickets') {
        const statusParam = url.searchParams.get('status') ?? 'pending';
        const status: TicketStatus =
          statusParam === 'approved' || statusParam === 'rejected' ? statusParam : 'pending';
        sendJson(res, 200, { tickets: await tickets.listTickets(status) });
        return;
      }

      const resolveMatch = /^\/api\/tickets\/([^/]+)\/resolve$/.exec(url.pathname);
      if (method === 'POST' && resolveMatch?.[1]) {
        const body = await parseJson(req);
        const action = body.action === 'reject' ? 'reject' : 'approve';
        const operator = typeof body.operator === 'string' ? body.operator.trim() : '';
        const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
        const tag = isResolutionTag(body.tag) ? body.tag : 'answered';
        if (operator === '' || answer === '') {
          sendJson(res, 400, { error: 'A játékmester neve és a válasz kötelező.' });
          return;
        }
        const ticket = await tickets.resolveTicket({
          ticketId: decodeURIComponent(resolveMatch[1]),
          action,
          operator,
          answer,
          tag,
        });
        if (ticket === null) {
          sendJson(res, 409, { error: 'A jegy nincs pending állapotban, vagy nem létezik.' });
          return;
        }
        sendJson(res, 200, { ticket });
        return;
      }

      if (method === 'GET' && url.pathname === '/api/metrics') {
        sendJson(res, 200, await tickets.metrics());
        return;
      }

      const feedbackMatch = /^\/api\/requests\/([^/]+)\/feedback$/.exec(url.pathname);
      if (method === 'POST' && feedbackMatch?.[1]) {
        const ok = await tickets.flagWrongAuto(decodeURIComponent(feedbackMatch[1]));
        if (!ok) {
          sendJson(res, 409, { error: 'Csak auto-választ lehet jelölni, és csak egyszer.' });
          return;
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: 'Ismeretlen útvonal.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ismeretlen hiba.';
      sendJson(res, 500, { error: message });
    }
  }

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    port,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await agent.close();
      await db.end();
    },
  };
}

async function main(): Promise<void> {
  const { port } = await startPocServer();
  console.log(`Szabálymester ügyfél-PoC: http://127.0.0.1:${port}/`);
  console.log(`Játékmester kapu:         http://127.0.0.1:${port}/operator`);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
