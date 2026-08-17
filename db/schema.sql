-- Szabálymester tudásbázis-séma (pgvector).
-- Két tábla: dokumentum-nyilvántartás + chunkok. Idempotens (IF NOT EXISTS),
-- így friss initdb-ként ÉS kézi újrafuttatással (pnpm db:schema) is biztonságos.
-- Részletek: ARCHITECTURE-SPINE.md #AD-5 (tranzakciós konzisztencia, CASCADE),
-- #AD-10 (dokumentum-granularitás: a section dokumentum-tulajdon).

CREATE EXTENSION IF NOT EXISTS vector;

-- A dokumentum mint első osztályú entitás: e nélkül nincs mihez képest változást
-- érzékelni (hash-alapú inkrementális frissítés). A `section` kizárólag itt él (AD-10).
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id           serial PRIMARY KEY,
  source       text NOT NULL UNIQUE,        -- letöltési URL vagy fájl-út (provenance → grounding)
  title        text NOT NULL,
  game         text NOT NULL,               -- melyik játék (a chunk-fejléc és a szűrés alapja)
  section      text NOT NULL
    CHECK (section IN ('attekintes', 'elokeszules', 'jatekmenet', 'pontozas', 'gyik')),
  content_hash text NOT NULL,               -- a NORMALIZÁLT törzs SHA-256 hash-e
  chunk_count  int  NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deleted')),
  indexed_at   timestamptz NOT NULL DEFAULT now()  -- mikor vektorizáltuk utoljára
);

CREATE INDEX IF NOT EXISTS idx_documents_game ON knowledge_documents (game);
CREATE INDEX IF NOT EXISTS idx_documents_status ON knowledge_documents (status);

-- A chunkok: a keresés egysége. Az embedding a játéknév-fejléces `content` vektora (AD-4);
-- a `heading` a chunk breadcrumbja (megjelenítéshez/debughoz), a `section` NEM ismétlődik itt.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          serial PRIMARY KEY,
  document_id int  NOT NULL REFERENCES knowledge_documents (id) ON DELETE CASCADE,
  chunk_index int  NOT NULL,                -- folytonos sorszám a dokumentumon belül
  heading     text,                         -- breadcrumb a dokumentumon belül (pl. "Építkezés > Város")
  content     text NOT NULL,               -- a chunk szövege a fejléccel együtt (EZT embeddeljük)
  embedding   vector(1536) NOT NULL,        -- text-embedding-3-small (config.embeddingDimensions)
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON knowledge_chunks (document_id);

-- Megjegyzés: a korpusz kicsi (~250-350 chunk), ezen a méreten a pontos (seq-scan)
-- koszinusz-keresés gyors — szándékosan NINCS approximate (HNSW/IVFFlat) vektor-index,
-- hogy a golden-set kiértékelés pontos top-K-t lásson (ld. spine Deferred). Nagyobb
-- korpusznál ide kerül egy `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)` sor.

-- Ügyfélirányú PoC: kérésnapló + emberi kapu (eszkalációs jegy). Az id-t az alkalmazás
-- adja (UUID szövegként) — így nincs pgcrypto-függőség. Idempotens, mint a fenti táblák.
CREATE TABLE IF NOT EXISTS customer_requests (
  id                text PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  question          text NOT NULL,
  path              text NOT NULL CHECK (path IN ('auto', 'escalate')),
  retrieval_status  text NOT NULL CHECK (retrieval_status IN ('ok', 'empty', 'error', 'none')),
  min_distance      double precision,
  answer            text,
  sources           jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_tokens      int NOT NULL DEFAULT 0,
  latency_ms        int NOT NULL DEFAULT 0,
  ticket_id         text,
  feedback          text CHECK (feedback IS NULL OR feedback IN ('wrong_auto'))
);

CREATE INDEX IF NOT EXISTS idx_customer_requests_created ON customer_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_customer_requests_path ON customer_requests (path);

CREATE TABLE IF NOT EXISTS customer_tickets (
  id                text PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  request_id        text NOT NULL REFERENCES customer_requests (id),
  question          text NOT NULL,
  reason            text NOT NULL,
  draft_answer      text,
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  operator_answer   text,
  resolved_at       timestamptz,
  resolved_by       text,
  resolution_tag    text
    CHECK (resolution_tag IS NULL OR resolution_tag IN ('answered', 'should_have_auto', 'out_of_scope'))
);

CREATE INDEX IF NOT EXISTS idx_customer_tickets_status ON customer_tickets (status);
CREATE INDEX IF NOT EXISTS idx_customer_tickets_request ON customer_tickets (request_id);
