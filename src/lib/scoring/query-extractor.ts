export interface ExtractedQuery {
  query: string;
  source: "heading" | "faq" | "topic" | "keyword";
  confidence: number;
}

/**
 * Convert a heading string into a question form.
 * "Best CRM Features" -> "What are the best CRM features?"
 * "How to Choose a CRM" -> "How to choose a CRM?"
 * "Why X Matters" -> "Why does X matter?"
 */
function headingToQuestion(heading: string): string {
  const trimmed = heading.trim();

  // Already a question
  if (trimmed.endsWith("?")) {
    return trimmed;
  }

  // "How to ..." -> keep as-is, add question mark
  const howToMatch = trimmed.match(/^how\s+to\s+(.+)/i);
  if (howToMatch) {
    return `How to ${howToMatch[1]}?`;
  }

  // "Why X Matters" / "Why X Is Important" -> "Why does X matter?"
  const whyMatch = trimmed.match(/^why\s+(.+?)\s+(matters?|is\s+important)/i);
  if (whyMatch) {
    return `Why does ${whyMatch[1]} matter?`;
  }

  // "Why ..." generic -> add question mark
  if (/^why\s+/i.test(trimmed)) {
    return `${trimmed}?`;
  }

  // "When to ..." -> add question mark
  if (/^when\s+to\s+/i.test(trimmed)) {
    return `${trimmed}?`;
  }

  // "What ..." already starts with question word
  if (/^(what|where|which|who)\s+/i.test(trimmed)) {
    return `${trimmed}?`;
  }

  // Default: prepend "What are" / "What is"
  // Heuristic: if the heading ends with a plural-looking word, use "are"
  const lastWord = trimmed.split(/\s+/).pop() ?? "";
  const usePlural =
    lastWord.endsWith("s") &&
    !lastWord.endsWith("ss") &&
    !lastWord.endsWith("us");
  const verb = usePlural ? "are" : "is";

  return `What ${verb} ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}?`;
}

/**
 * Extract the primary topic from the first paragraph of markdown content.
 * Returns a general question about the topic.
 */
function extractTopicQuery(markdown: string): string | null {
  // Strip front matter if present
  const withoutFrontMatter = markdown.replace(/^---[\s\S]*?---\s*/, "");

  // Find first non-empty, non-heading line
  const lines = withoutFrontMatter.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("![") ||
      trimmed.startsWith("---")
    ) {
      continue;
    }

    // Take first 120 chars, cut at last word boundary
    const snippet = trimmed.slice(0, 120).replace(/\s+\S*$/, "").trim();
    if (snippet.length > 20) {
      return `What is ${snippet.split(/[.!?]/)[0].trim().toLowerCase()}?`;
    }
  }

  return null;
}

/**
 * Deduplicate queries by normalizing and comparing lowercase forms.
 */
function deduplicateQueries(queries: ExtractedQuery[]): ExtractedQuery[] {
  const seen = new Set<string>();
  const result: ExtractedQuery[] = [];

  for (const q of queries) {
    const normalized = q.query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(q);
    }
  }

  return result;
}

/**
 * Extract probe queries from markdown content for AEO citation validation.
 *
 * Sources:
 * - Markdown headings (## and ###) converted to question form
 * - FAQ sections (Q: lines)
 * - First paragraph topic
 * - Keyword-based generated queries
 *
 * All extraction is done via regex and string manipulation. No LLM calls.
 */
export function extractProbeQueries(
  markdown: string,
  keywords: string[],
  maxQueries: number = 5
): ExtractedQuery[] {
  const queries: ExtractedQuery[] = [];

  // 1. Extract headings (## and ###) and convert to questions
  const headingRegex = /^#{2,3}\s+(.+)$/gm;
  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRegex.exec(markdown)) !== null) {
    const headingText = headingMatch[1].trim();
    // Skip very short headings or purely decorative ones
    if (headingText.length < 4) continue;

    queries.push({
      query: headingToQuestion(headingText),
      source: "heading",
      confidence: 0.8,
    });
  }

  // 2. Extract FAQ questions (lines starting with Q: or **Q:** or **Q.**)
  const faqRegex =
    /^(?:\*{0,2})Q[:.]\s*\*{0,2}\s*(.+?)(?:\*{0,2})\s*$/gim;
  let faqMatch: RegExpExecArray | null;
  while ((faqMatch = faqRegex.exec(markdown)) !== null) {
    const question = faqMatch[1].trim();
    if (question.length < 5) continue;

    queries.push({
      query: question.endsWith("?") ? question : `${question}?`,
      source: "faq",
      confidence: 0.9,
    });
  }

  // 3. Extract topic query from first paragraph
  const topicQuery = extractTopicQuery(markdown);
  if (topicQuery) {
    queries.push({
      query: topicQuery,
      source: "topic",
      confidence: 0.7,
    });
  }

  // 4. Generate keyword-based queries
  for (const keyword of keywords) {
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword.length < 2) continue;

    queries.push({
      query: `What is the best ${trimmedKeyword}?`,
      source: "keyword",
      confidence: 0.6,
    });
  }

  // Deduplicate, sort by confidence descending, limit
  const deduplicated = deduplicateQueries(queries);

  deduplicated.sort((a, b) => b.confidence - a.confidence);

  return deduplicated.slice(0, maxQueries);
}
