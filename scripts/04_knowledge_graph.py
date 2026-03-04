"""
04_knowledge_graph.py - Knowledge Graph Extraction
Extracts key concepts and builds a co-occurrence graph.
"""

import json
import re
from collections import defaultdict, Counter
import math

DATA_DIR = "/Users/jonathankurniawan/Documents/Claude Cowork/claude-chat-analysis"
OUT_DIR = f"{DATA_DIR}/web/data"

# ─── Domain-aware concept patterns ───────────────────────────────────────────

DOMAIN_CONCEPTS = {
    # AI / ML
    "large language model": "AI/ML", "llm": "AI/ML", "gpt": "AI/ML",
    "claude": "AI/ML", "anthropic": "AI/ML", "openai": "AI/ML",
    "neural network": "AI/ML", "deep learning": "AI/ML",
    "machine learning": "AI/ML", "transformer": "AI/ML",
    "fine-tuning": "AI/ML", "fine tuning": "AI/ML", "rag": "AI/ML",
    "retrieval augmented": "AI/ML", "embedding": "AI/ML", "vector": "AI/ML",
    "agent": "AI/ML", "agentic": "AI/ML", "prompt": "AI/ML",
    "gemini": "AI/ML", "mistral": "AI/ML", "llama": "AI/ML",
    "diffusion": "AI/ML", "stable diffusion": "AI/ML",
    "reinforcement learning": "AI/ML", "rlhf": "AI/ML",
    "inference": "AI/ML", "training": "AI/ML", "dataset": "AI/ML",

    # Software
    "python": "Software", "javascript": "Software", "typescript": "Software",
    "react": "Software", "node": "Software", "sql": "Software",
    "database": "Software", "api": "Software", "rest": "Software",
    "graphql": "Software", "docker": "Software", "kubernetes": "Software",
    "aws": "Software", "gcp": "Software", "azure": "Software",
    "git": "Software", "github": "Software", "devops": "Software",
    "microservice": "Software", "backend": "Software", "frontend": "Software",
    "cloud": "Software", "serverless": "Software", "architecture": "Software",

    # Business
    "startup": "Business", "product": "Business", "marketing": "Business",
    "strategy": "Business", "revenue": "Business", "customer": "Business",
    "growth": "Business", "roi": "Business", "kpi": "Business",
    "okr": "Business", "agile": "Business", "scrum": "Business",
    "stakeholder": "Business", "roadmap": "Business", "mvp": "Business",
    "venture": "Business", "funding": "Business", "investor": "Business",
    "enterprise": "Business", "saas": "Business", "b2b": "Business",

    # Data Science
    "data analysis": "Data Science", "statistics": "Data Science",
    "visualization": "Data Science", "dashboard": "Data Science",
    "pandas": "Data Science", "numpy": "Data Science",
    "regression": "Data Science", "classification": "Data Science",
    "clustering": "Data Science", "umap": "Data Science",
    "pipeline": "Data Science", "etl": "Data Science",

    # Leadership / Management
    "leadership": "Leadership", "management": "Leadership",
    "team": "Leadership", "hiring": "Leadership", "culture": "Leadership",
    "coaching": "Leadership", "mentoring": "Leadership",
    "performance": "Leadership", "feedback": "Leadership",
    "decision making": "Leadership", "organization": "Leadership",

    # Research / Writing
    "research": "Research", "writing": "Research", "content": "Research",
    "analysis": "Research", "report": "Research", "document": "Research",
    "summary": "Research", "thesis": "Research", "paper": "Research",
    "review": "Research", "framework": "Research",
}

CATEGORY_COLORS = {
    "AI/ML":        "#6366f1",
    "Software":     "#22c55e",
    "Business":     "#f59e0b",
    "Data Science": "#06b6d4",
    "Leadership":   "#ec4899",
    "Research":     "#a855f7",
    "Other":        "#94a3b8",
}

# ─── Load data ─────────────────────────────────────────────────────────────────

print("Loading conversations...")
with open(f"{DATA_DIR}/conversations.json", "r") as f:
    conversations = json.load(f)

# ─── Extract concepts from each conversation ──────────────────────────────────

def extract_concepts(text):
    text_lower = text.lower()
    found = set()
    for concept, category in DOMAIN_CONCEPTS.items():
        # word boundary match
        pattern = r'\b' + re.escape(concept) + r'\b'
        if re.search(pattern, text_lower):
            found.add(concept)
    return found

concept_freq = Counter()
concept_category = {}
concept_convs = defaultdict(set)  # concept -> set of conv UUIDs
co_occur = defaultdict(Counter)   # concept -> Counter of co-occurring concepts

print("Extracting concepts from conversations...")
for conv in conversations:
    uuid = conv["uuid"]
    # Combine all text
    all_text = conv.get("name", "") or ""
    for msg in conv.get("chat_messages", []):
        all_text += " " + (msg.get("text", "") or "")

    concepts = extract_concepts(all_text)

    for c in concepts:
        concept_freq[c] += 1
        concept_convs[c].add(uuid)
        concept_category[c] = DOMAIN_CONCEPTS[c]

    # co-occurrence
    concept_list = sorted(concepts)
    for i, c1 in enumerate(concept_list):
        for c2 in concept_list[i+1:]:
            co_occur[c1][c2] += 1
            co_occur[c2][c1] += 1

print(f"Found {len(concept_freq)} unique concepts")

# ─── Build graph: filter to top concepts ─────────────────────────────────────

MIN_FREQ = 8          # min conversations to appear as node
MIN_CO_OCCUR = 5      # min co-occurrences for an edge
MAX_NODES = 80
MAX_EDGES = 200

# Top nodes by frequency
top_concepts = [c for c, f in concept_freq.most_common(MAX_NODES) if f >= MIN_FREQ]
concept_set = set(top_concepts)

nodes = []
for concept in top_concepts:
    freq = concept_freq[concept]
    category = concept_category.get(concept, "Other")
    nodes.append({
        "id": concept,
        "label": concept.title(),
        "freq": freq,
        "category": category,
        "color": CATEGORY_COLORS.get(category, CATEGORY_COLORS["Other"]),
        "size": round(math.sqrt(freq) * 3, 1),  # visual size
    })

# Edges: only between top concepts, above threshold
edges = []
seen_edges = set()
all_edges = []
for c1 in top_concepts:
    for c2, weight in co_occur[c1].items():
        if c2 in concept_set and weight >= MIN_CO_OCCUR:
            key = tuple(sorted([c1, c2]))
            if key not in seen_edges:
                seen_edges.add(key)
                all_edges.append({
                    "source": c1,
                    "target": c2,
                    "weight": weight,
                    "width": round(math.log(weight + 1) * 1.5, 1),
                })

# Sort by weight and take top edges
all_edges.sort(key=lambda e: -e["weight"])
edges = all_edges[:MAX_EDGES]

print(f"Graph: {len(nodes)} nodes, {len(edges)} edges")

# ─── Compute centrality (degree) ──────────────────────────────────────────────

degree = Counter()
for e in edges:
    degree[e["source"]] += 1
    degree[e["target"]] += 1

for n in nodes:
    n["degree"] = degree.get(n["id"], 0)

# ─── Category-level aggregation ───────────────────────────────────────────────

category_stats = defaultdict(lambda: {"count": 0, "total_freq": 0, "concepts": []})
for n in nodes:
    cat = n["category"]
    category_stats[cat]["count"] += 1
    category_stats[cat]["total_freq"] += n["freq"]
    category_stats[cat]["concepts"].append(n["id"])

categories = [
    {
        "name": cat,
        "color": CATEGORY_COLORS.get(cat, CATEGORY_COLORS["Other"]),
        "count": v["count"],
        "total_freq": v["total_freq"],
        "concepts": v["concepts"][:10],
    }
    for cat, v in sorted(category_stats.items(), key=lambda x: -x[1]["total_freq"])
]

# ─── Write output ──────────────────────────────────────────────────────────────

output = {
    "nodes": nodes,
    "edges": edges,
    "categories": categories,
    "stats": {
        "n_nodes": len(nodes),
        "n_edges": len(edges),
        "n_categories": len(categories),
    }
}

with open(f"{OUT_DIR}/graph.json", "w") as f:
    json.dump(output, f, separators=(",", ":"))

size_kb = len(json.dumps(output)) // 1024
print(f"  Wrote graph.json ({size_kb} KB)")

print("\nTop 15 concepts by frequency:")
for concept, freq in concept_freq.most_common(15):
    cat = concept_category.get(concept, "?")
    print(f"  {concept:35s} {freq:4d} convs  [{cat}]")

print("\n✓ Knowledge graph extraction complete.")
