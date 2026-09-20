import { NextRequest, NextResponse } from "next/server";

const queries: Record<string, string> = {
  top: "(technology OR science OR discovery OR innovation OR culture)",
  world: "(world OR international OR global)",
  science: "(science OR research OR space OR technology)",
};

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

function words(title: string) {
  return new Set(title.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(word => word.length > 3));
}

function overlap(a: string, b: string) {
  const one = words(a); const two = words(b);
  if (!one.size || !two.size) return 0;
  let shared = 0; one.forEach(word => { if (two.has(word)) shared += 1; });
  return shared / Math.min(one.size, two.size);
}

function ageLabel(raw?: string) {
  if (!raw) return "RECENT";
  const match = raw.match(/^(\d{8})T(\d{6})Z$/);
  if (!match) return "RECENT";
  const iso = `${match[1].slice(0,4)}-${match[1].slice(4,6)}-${match[1].slice(6,8)}T${match[2].slice(0,2)}:${match[2].slice(2,4)}:${match[2].slice(4,6)}Z`;
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 60 ? `${mins} MIN AGO` : mins < 1440 ? `${Math.floor(mins/60)} HR AGO` : `${Math.floor(mins/1440)} DAY AGO`;
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || "top";
  const query = queries[category] || queries.top;
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("mode", "artlist");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("maxrecords", "40");
  endpoint.searchParams.set("timespan", "24h");
  endpoint.searchParams.set("sort", "datedesc");

  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit);
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    const payload = await response.json() as { articles?: GdeltArticle[] };
    const raw = (payload.articles || []).filter(article => article.title && article.url);
    const clusters: Array<{ lead: GdeltArticle; domains: Set<string> }> = [];
    for (const article of raw) {
      const existing = clusters.find(cluster => overlap(cluster.lead.title || "", article.title || "") >= 0.58);
      if (existing) existing.domains.add(article.domain || new URL(article.url!).hostname);
      else clusters.push({ lead: article, domains: new Set([article.domain || new URL(article.url!).hostname]) });
    }
    const accents = ["lime", "orange", "blue"];
    const stories = clusters.slice(0, 12).map((cluster, index) => ({
      id: index + 101,
      place: (cluster.lead.sourcecountry || "WORLD").toUpperCase(),
      topic: category === "top" ? "TRENDING" : category.toUpperCase(),
      time: ageLabel(cluster.lead.seendate),
      title: cluster.lead.title,
      dek: `Coverage detected from ${cluster.lead.domain || "a global news source"}. Open the source before script approval.`,
      sources: cluster.domains.size,
      score: Math.min(98, 55 + cluster.domains.size * 11),
      tone: "Find the human absurdity without changing the underlying facts.",
      accent: accents[index % accents.length],
      mark: category === "science" ? "S" : index % 2 ? "?!" : "N",
      url: cluster.lead.url,
      domain: cluster.lead.domain || new URL(cluster.lead.url!).hostname,
      verified: cluster.domains.size >= 2,
    }));
    return NextResponse.json({ stories, provider: "GDELT", refreshedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, max-age=120, s-maxage=300" } });
  } catch {
    return NextResponse.json({ stories: [], provider: "unavailable", refreshedAt: new Date().toISOString() }, { status: 503 });
  }
}
