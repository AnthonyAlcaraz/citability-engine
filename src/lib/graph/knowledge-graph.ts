/**
 * Knowledge Graph Module — KuzuDB-backed entity graph for Citability Engine
 *
 * Solves three problems the relational DB cannot:
 * 1. Entity Resolution: "Salesforce CRM" and "Salesforce Sales Cloud" → same node
 * 2. Citation Path Analysis: Content → citedIn → Response → fromProvider → SearchBackend
 * 3. Temporal Tracking: Citation trajectory over time per entity per provider
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const kuzu = require("kuzu");
const { Database, Connection } = kuzu;

// ─── Types ───

export interface EntityNode {
  id: string;
  canonicalName: string;
  type: "brand" | "product" | "feature" | "category";
  domain: string | null;
}

export interface EntityAlias {
  alias: string;
  entityId: string;
  source: string; // which provider generated this alias
}

export interface CitationEvent {
  id: string;
  entityId: string;
  provider: string;
  query: string;
  cited: boolean;
  sentiment: string;
  position: number;
  confidence: number;
  timestamp: string; // ISO date
}

export interface CitationPath {
  entity: string;
  provider: string;
  query: string;
  cited: boolean;
  sentiment: string;
  position: number;
}

export interface EntityResolution {
  canonicalName: string;
  aliases: string[];
  providers: string[];
}

export interface CitationTrajectory {
  entityName: string;
  provider: string;
  dataPoints: Array<{
    date: string;
    citationRate: number;
    avgSentiment: string;
    avgPosition: number;
  }>;
}

// ─── Graph Manager ───

export class KnowledgeGraph {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private conn: any = null;
  private dbPath: string;
  private initialized = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.conn = new Connection(this.db);

    // Create schema
    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Entity(
        id STRING PRIMARY KEY,
        canonicalName STRING,
        type STRING,
        domain STRING
      )
    `);

    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Provider(
        name STRING PRIMARY KEY,
        searchBackend STRING
      )
    `);

    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Query(
        text STRING PRIMARY KEY,
        category STRING
      )
    `);

    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Citation(
        id STRING PRIMARY KEY,
        cited BOOLEAN,
        sentiment STRING,
        position INT64,
        confidence DOUBLE,
        timestamp STRING
      )
    `);

    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS ALIAS_OF(
        FROM Entity TO Entity,
        source STRING
      )
    `);

    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS CITED_IN(
        FROM Entity TO Citation
      )
    `);

    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS FROM_PROVIDER(
        FROM Citation TO Provider
      )
    `);

    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS FOR_QUERY(
        FROM Citation TO Query
      )
    `);

    await this.conn.query(`
      CREATE REL TABLE IF NOT EXISTS COMPETES_WITH(
        FROM Entity TO Entity,
        category STRING
      )
    `);

    // Seed providers with their search backends
    const providers = [
      { name: "openai", searchBackend: "Bing" },
      { name: "anthropic", searchBackend: "Brave" },
      { name: "google", searchBackend: "Google Search" },
      { name: "perplexity", searchBackend: "Multi-index" },
      { name: "tavily", searchBackend: "Aggregated (20+ sources)" },
    ];

    for (const p of providers) {
      await this.conn.query(
        `MERGE (p:Provider {name: '${p.name}'}) SET p.searchBackend = '${p.searchBackend}'`
      );
    }

    this.initialized = true;
  }

  // ─── Entity Resolution ───

  /**
   * Add or merge an entity. If a similar name exists, creates an ALIAS_OF edge
   * instead of a duplicate node.
   */
  async upsertEntity(
    name: string,
    type: EntityNode["type"],
    domain: string | null,
    source: string
  ): Promise<string> {
    await this.init();

    // Check if this name matches an existing entity (fuzzy)
    const existing = await this.resolveEntity(name);
    if (existing) {
      // Add alias edge if this is a new variant
      if (!existing.aliases.includes(name.toLowerCase())) {
        const aliasId = `alias-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await this.conn!.query(`
          MERGE (alias:Entity {id: '${aliasId}'})
          SET alias.canonicalName = '${this.escape(name)}',
              alias.type = '${type}',
              alias.domain = '${domain ?? ""}'
        `);
        await this.conn!.query(`
          MATCH (alias:Entity {id: '${aliasId}'}), (canonical:Entity {id: '${existing.canonicalName}'})
          CREATE (alias)-[:ALIAS_OF {source: '${source}'}]->(canonical)
        `);
      }
      return existing.canonicalName;
    }

    // New entity
    const id = `entity-${this.slugify(name)}`;
    await this.conn!.query(`
      MERGE (e:Entity {id: '${id}'})
      SET e.canonicalName = '${this.escape(name)}',
          e.type = '${type}',
          e.domain = '${domain ?? ""}'
    `);

    return id;
  }

  /**
   * Resolve a name to its canonical entity using fuzzy matching.
   * Handles: "Salesforce CRM" → "Salesforce", "HubSpot Sales Hub" → "HubSpot"
   */
  async resolveEntity(name: string): Promise<EntityResolution | null> {
    await this.init();

    const normalized = name.toLowerCase().trim();

    // Exact match first
    const exactResult = await this.conn!.query(`
      MATCH (e:Entity)
      WHERE toLower(e.canonicalName) = '${this.escape(normalized)}'
      RETURN e.id AS id, e.canonicalName AS name
    `);
    const exactRows = await exactResult.getAll();

    if (exactRows.length > 0) {
      return this.buildResolution(exactRows[0].id);
    }

    // Substring match (e.g., "Salesforce CRM" contains "Salesforce")
    const substringResult = await this.conn!.query(`
      MATCH (e:Entity)
      WHERE toLower('${this.escape(normalized)}') CONTAINS toLower(e.canonicalName)
         OR toLower(e.canonicalName) CONTAINS toLower('${this.escape(normalized)}')
      RETURN e.id AS id, e.canonicalName AS name
      LIMIT 1
    `);
    const substringRows = await substringResult.getAll();

    if (substringRows.length > 0) {
      return this.buildResolution(substringRows[0].id);
    }

    return null;
  }

  private async buildResolution(entityId: string): Promise<EntityResolution> {
    // Get all aliases
    const aliasResult = await this.conn!.query(`
      MATCH (alias:Entity)-[:ALIAS_OF]->(canonical:Entity {id: '${entityId}'})
      RETURN alias.canonicalName AS alias
    `);
    const aliasRows = await aliasResult.getAll();

    // Get providers that have cited this entity
    const providerResult = await this.conn!.query(`
      MATCH (e:Entity {id: '${entityId}'})-[:CITED_IN]->(c:Citation)-[:FROM_PROVIDER]->(p:Provider)
      RETURN DISTINCT p.name AS provider
    `);
    const providerRows = await providerResult.getAll();

    return {
      canonicalName: entityId,
      aliases: aliasRows.map((r: any) => r.alias?.toLowerCase() ?? ""),
      providers: providerRows.map((r: any) => r.provider ?? ""),
    };
  }

  // ─── Citation Ingestion ───

  /**
   * Record a citation event from a probe result.
   * Creates Citation node + edges to Entity, Provider, and Query.
   */
  async recordCitation(event: {
    entityName: string;
    entityType: EntityNode["type"];
    entityDomain: string | null;
    provider: string;
    query: string;
    queryCategory: string;
    cited: boolean;
    sentiment: string;
    position: number;
    confidence: number;
  }): Promise<void> {
    await this.init();

    // Resolve or create entity
    const entityId = await this.upsertEntity(
      event.entityName,
      event.entityType,
      event.entityDomain,
      event.provider
    );

    // Ensure query exists
    await this.conn!.query(`
      MERGE (q:Query {text: '${this.escape(event.query)}'})
      SET q.category = '${this.escape(event.queryCategory)}'
    `);

    // Create citation node
    const citationId = `cit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    await this.conn!.query(`
      CREATE (c:Citation {
        id: '${citationId}',
        cited: ${event.cited},
        sentiment: '${event.sentiment}',
        position: ${event.position},
        confidence: ${event.confidence},
        timestamp: '${timestamp}'
      })
    `);

    // Create edges
    await this.conn!.query(`
      MATCH (e:Entity {id: '${entityId}'}), (c:Citation {id: '${citationId}'})
      CREATE (e)-[:CITED_IN]->(c)
    `);

    await this.conn!.query(`
      MATCH (c:Citation {id: '${citationId}'}), (p:Provider {name: '${event.provider}'})
      CREATE (c)-[:FROM_PROVIDER]->(p)
    `);

    await this.conn!.query(`
      MATCH (c:Citation {id: '${citationId}'}), (q:Query {text: '${this.escape(event.query)}'})
      CREATE (c)-[:FOR_QUERY]->(q)
    `);
  }

  /**
   * Record a competitive relationship between entities.
   */
  async recordCompetition(
    brandName: string,
    competitorName: string,
    category: string
  ): Promise<void> {
    await this.init();

    const brandId = `entity-${this.slugify(brandName)}`;
    const competitorId = `entity-${this.slugify(competitorName)}`;

    await this.conn!.query(`
      MATCH (a:Entity {id: '${brandId}'}), (b:Entity {id: '${competitorId}'})
      MERGE (a)-[:COMPETES_WITH {category: '${this.escape(category)}'}]->(b)
    `);
  }

  // ─── Citation Path Analysis ───

  /**
   * Trace the full citation path for an entity:
   * Entity → CITED_IN → Citation → FROM_PROVIDER → Provider
   *                              → FOR_QUERY → Query
   */
  async getCitationPaths(entityName: string): Promise<CitationPath[]> {
    await this.init();

    const entity = await this.resolveEntity(entityName);
    if (!entity) return [];

    const result = await this.conn!.query(`
      MATCH (e:Entity {id: '${entity.canonicalName}'})-[:CITED_IN]->(c:Citation)-[:FROM_PROVIDER]->(p:Provider),
            (c)-[:FOR_QUERY]->(q:Query)
      RETURN e.canonicalName AS entity,
             p.name AS provider,
             q.text AS query,
             c.cited AS cited,
             c.sentiment AS sentiment,
             c.position AS position
      ORDER BY c.timestamp DESC
    `);

    const rows = await result.getAll();
    return rows.map((r: any) => ({
      entity: r.entity,
      provider: r.provider,
      query: r.query,
      cited: r.cited,
      sentiment: r.sentiment,
      position: r.position ?? 0,
    }));
  }

  /**
   * Find which search backends (Bing, Brave, Google) surface an entity most.
   */
  async getSearchBackendAnalysis(entityName: string): Promise<
    Array<{ backend: string; provider: string; citationRate: number; totalProbes: number }>
  > {
    await this.init();

    const entity = await this.resolveEntity(entityName);
    if (!entity) return [];

    const result = await this.conn!.query(`
      MATCH (e:Entity {id: '${entity.canonicalName}'})-[:CITED_IN]->(c:Citation)-[:FROM_PROVIDER]->(p:Provider)
      WITH p.name AS provider, p.searchBackend AS backend,
           COUNT(c) AS total, SUM(CASE WHEN c.cited THEN 1 ELSE 0 END) AS cited
      RETURN provider, backend, cited, total
      ORDER BY cited DESC
    `);

    const rows = await result.getAll();
    return rows.map((r: any) => ({
      backend: r.backend,
      provider: r.provider,
      citationRate: this.num(r.total) > 0 ? Math.round((this.num(r.cited) / this.num(r.total)) * 100) : 0,
      totalProbes: this.num(r.total),
    }));
  }

  // ─── Temporal Tracking ───

  /**
   * Get citation trajectory over time for an entity per provider.
   * Groups by date, calculates daily citation rate.
   */
  async getCitationTrajectory(
    entityName: string,
    days: number = 30
  ): Promise<CitationTrajectory[]> {
    await this.init();

    const entity = await this.resolveEntity(entityName);
    if (!entity) return [];

    const cutoff = new Date(Date.now() - days * 86400000).toISOString();

    const result = await this.conn!.query(`
      MATCH (e:Entity {id: '${entity.canonicalName}'})-[:CITED_IN]->(c:Citation)-[:FROM_PROVIDER]->(p:Provider)
      WHERE c.timestamp > '${cutoff}'
      WITH p.name AS provider,
           substring(c.timestamp, 0, 10) AS date,
           COUNT(c) AS total,
           SUM(CASE WHEN c.cited THEN 1 ELSE 0 END) AS cited,
           c.sentiment AS sentiment,
           c.position AS position
      RETURN provider, date, total, cited, sentiment, position
      ORDER BY provider, date
    `);

    const rows = await result.getAll();

    // Group by provider
    const byProvider = new Map<string, Array<any>>();
    for (const row of rows) {
      const provider = row.provider;
      if (!byProvider.has(provider)) byProvider.set(provider, []);
      byProvider.get(provider)!.push(row);
    }

    const trajectories: CitationTrajectory[] = [];
    for (const [provider, data] of byProvider) {
      trajectories.push({
        entityName: entity.canonicalName,
        provider,
        dataPoints: data.map((d: any) => ({
          date: d.date,
          citationRate: this.num(d.total) > 0 ? Math.round((this.num(d.cited) / this.num(d.total)) * 100) : 0,
          avgSentiment: d.sentiment ?? "neutral",
          avgPosition: this.num(d.position),
        })),
      });
    }

    return trajectories;
  }

  // ─── Cross-Provider Entity Resolution ───

  /**
   * Find all naming variants for an entity across providers.
   * Answers: "How does each AI engine refer to this brand?"
   */
  async getEntityVariants(entityName: string): Promise<
    Array<{ variant: string; provider: string; frequency: number }>
  > {
    await this.init();

    const entity = await this.resolveEntity(entityName);
    if (!entity) return [];

    const result = await this.conn!.query(`
      MATCH (alias:Entity)-[:ALIAS_OF]->(canonical:Entity {id: '${entity.canonicalName}'})
      MATCH (alias)-[:CITED_IN]->(c:Citation)-[:FROM_PROVIDER]->(p:Provider)
      RETURN alias.canonicalName AS variant, p.name AS provider, COUNT(c) AS frequency
      ORDER BY frequency DESC
    `);

    const rows = await result.getAll();
    return rows.map((r: any) => ({
      variant: r.variant,
      provider: r.provider,
      frequency: this.num(r.frequency),
    }));
  }

  /**
   * Get competitive graph: who competes with whom, in which categories.
   */
  async getCompetitiveGraph(): Promise<
    Array<{ brand: string; competitor: string; category: string; brandRate: number; competitorRate: number }>
  > {
    await this.init();

    const result = await this.conn!.query(`
      MATCH (a:Entity)-[r:COMPETES_WITH]->(b:Entity)
      OPTIONAL MATCH (a)-[:CITED_IN]->(ca:Citation)
      OPTIONAL MATCH (b)-[:CITED_IN]->(cb:Citation)
      WITH a.canonicalName AS brand, b.canonicalName AS competitor, r.category AS category,
           COUNT(DISTINCT ca) AS brandCitations, COUNT(DISTINCT cb) AS competitorCitations
      RETURN brand, competitor, category, brandCitations, competitorCitations
    `);

    const rows = await result.getAll();
    return rows.map((r: any) => ({
      brand: r.brand,
      competitor: r.competitor,
      category: r.category,
      brandRate: this.num(r.brandCitations),
      competitorRate: this.num(r.competitorCitations),
    }));
  }

  // ─── Stats ───

  async getStats(): Promise<{
    entities: number;
    citations: number;
    queries: number;
    aliases: number;
  }> {
    await this.init();

    const entityResult = await this.conn!.query("MATCH (e:Entity) RETURN COUNT(e) AS count");
    const citationResult = await this.conn!.query("MATCH (c:Citation) RETURN COUNT(c) AS count");
    const queryResult = await this.conn!.query("MATCH (q:Query) RETURN COUNT(q) AS count");
    const aliasResult = await this.conn!.query("MATCH ()-[a:ALIAS_OF]->() RETURN COUNT(a) AS count");

    const entities = this.num((await entityResult.getAll())[0]?.count);
    const citations = this.num((await citationResult.getAll())[0]?.count);
    const queries = this.num((await queryResult.getAll())[0]?.count);
    const aliases = this.num((await aliasResult.getAll())[0]?.count);

    return { entities, citations, queries, aliases };
  }

  // ─── Helpers ───

  /** Convert BigInt (from KuzuDB COUNT/SUM) to Number safely */
  private num(val: unknown): number {
    if (typeof val === "bigint") return Number(val);
    if (typeof val === "number") return val;
    return 0;
  }

  private escape(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
  }

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async close(): Promise<void> {
    // KuzuDB handles cleanup on GC
    this.initialized = false;
  }
}

// ─── Singleton ───

let graphInstance: KnowledgeGraph | null = null;

export function getKnowledgeGraph(dbPath?: string): KnowledgeGraph {
  if (!graphInstance) {
    const path = dbPath ?? "./data/aeo-graph";
    graphInstance = new KnowledgeGraph(path);
  }
  return graphInstance;
}
