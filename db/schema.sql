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
