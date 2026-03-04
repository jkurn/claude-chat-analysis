# Inside the Machine Mind

A [Pudding.cool](https://pudding.cool)-style scrollytelling data visualization analyzing **21 months of Claude conversations** — 2,098 conversations, 13,690 messages, and 7 million+ words of dialogue.

Built as a data science exploration combining NLP topic modeling, dimensionality reduction, clustering, and knowledge graph extraction into an interactive, dark-themed web experience.

![Hero section](https://img.shields.io/badge/conversations-2%2C098-7c6bff) ![Messages](https://img.shields.io/badge/messages-13%2C690-ff6b9d) ![Words](https://img.shields.io/badge/words-7M%2B-6bffd3)

## Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | **Overview** | Hero stats with animated counters |
| 2 | **Timeline** | GitHub-style calendar heatmap + monthly line chart |
| 3 | **Activity** | Hour × day-of-week heatmap, hourly/daily bar charts |
| 4 | **Distributions** | Turn count histograms, message length comparison, top 20 deepest conversations |
| 5 | **Topics** | 18 NMF topics displayed as cards, stacked area evolution chart, force-layout bubble chart |
| 6 | **Galaxy** | 2,098-point UMAP scatter plot with color modes (topic, time, length, cluster) and starfield background |
| 7 | **Network** | Force-directed knowledge graph of co-occurring concepts (80 nodes, 200 edges) |

## Pipeline

The analysis runs as four sequential Python scripts:

```
conversations.json (105 MB)
        │
        ▼
┌─────────────────────┐
│  01_preprocess.py    │  → stats, timeline, activity, distributions
│  02_topics.py        │  → TF-IDF (8k features) + NMF (18 topics)
│  03_embeddings.py    │  → sentence-transformers → UMAP → HDBSCAN
│  04_knowledge_graph.py│  → domain-aware concept extraction → co-occurrence graph
└─────────────────────┘
        │
        ▼
   web/data/*.json  →  D3.js v7 visualizations
```

### Topic Modeling
- **TF-IDF** vectorizer with 8,000 features, (1,2)-gram range
- **NMF** (Non-negative Matrix Factorization) extracting 18 latent topics
- Topics labeled from NMF top words: AI Agents & Systems, Business Strategy, Dubai & Gov Digital, Code & Documentation, Career & Job Search, etc.

### Embeddings & Clustering
- **all-MiniLM-L6-v2** sentence transformer (384-dim embeddings)
- **UMAP** reduction to 2D (cosine metric, n_neighbors=15, min_dist=0.1)
- **HDBSCAN** clustering (min_cluster_size=15)

### Knowledge Graph
- Domain-aware concept extraction across 6 categories (AI/ML, Software, Business, Data Science, Leadership, Research)
- Co-occurrence edges weighted by how often concepts appear together across conversations
- Filtered to top 80 nodes, 200 edges

## Tech Stack

| Layer | Tools |
|-------|-------|
| Data processing | Python 3.11, pandas, scikit-learn, NLTK |
| NLP | TF-IDF + NMF, sentence-transformers |
| Dimensionality reduction | UMAP |
| Clustering | HDBSCAN |
| Graph analysis | NetworkX |
| Visualization | D3.js v7 |
| Frontend | Vanilla HTML/CSS/JS, dark theme, IntersectionObserver scroll animations |

## Setup

### Prerequisites

- Python 3.11 with: `scikit-learn`, `pandas`, `numpy`, `nltk`, `sentence-transformers==2.7.0`, `umap-learn`, `hdbscan`, `networkx`
- Node.js (for the dev server via `npx serve`)

### Data

Export your Claude conversations from [claude.ai](https://claude.ai) (Settings → Export Data). Place `conversations.json` in the project root.

### Run

```bash
# 1. Process the data (generates web/data/*.json)
npm run process

# 2. Start the dev server
npm run serve
# → http://localhost:3001
```

The `process` script runs all four Python scripts sequentially:
```bash
python3.11 scripts/01_preprocess.py
python3.11 scripts/02_topics.py
python3.11 scripts/03_embeddings.py
python3.11 scripts/04_knowledge_graph.py
```

## Project Structure

```
├── scripts/
│   ├── 01_preprocess.py      # Stats, timeline, activity patterns
│   ├── 02_topics.py          # TF-IDF + NMF topic modeling
│   ├── 03_embeddings.py      # Sentence embeddings + UMAP + HDBSCAN
│   └── 04_knowledge_graph.py # Co-occurrence concept graph
├── web/
│   ├── index.html            # Main scrollytelling page
│   ├── css/main.css          # Dark theme styles
│   ├── js/main.js            # All D3.js visualizations
│   └── data/                 # Generated JSON (gitignored)
├── conversations.json        # Raw export (gitignored)
└── package.json
```

## License

MIT
