"""
02_topics.py - Topic Modeling (TF-IDF + NMF)
Extracts latent topics from conversations, assigns them, tracks evolution.
"""

import json
import re
from datetime import datetime
from collections import defaultdict
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import NMF
from sklearn.preprocessing import normalize

DATA_DIR = "/Users/jonathankurniawan/Documents/Claude Cowork/claude-chat-analysis"
OUT_DIR = f"{DATA_DIR}/web/data"

N_TOPICS = 18
N_TOP_WORDS = 12
N_TOP_WORDS_DISPLAY = 8

print("Loading conversations...")
with open(f"{DATA_DIR}/conversations.json", "r") as f:
    conversations = json.load(f)

# ─── Build corpus ──────────────────────────────────────────────────────────────

# Stopwords (extended)
STOPWORDS = set("""
a about above after again against all also am an and any are aren't as at
be because been before being below between both but by can't cannot could
couldn't did didn't do does doesn't doing don't down during each few for
from further get go got had hadn't has hasn't have haven't having he he'd
he'll he's her here here's hers herself him himself his how how's i i'd
i'll i'm i've if in into is isn't it it's its itself let's me more most
mustn't my myself no nor not of off on once only or other ought our ours
ourselves out over own same shan't she she'd she'll she's should shouldn't
so some such than that that's the their theirs them themselves then there
there's these they they'd they'll they're they've this those through to
too under until up very was wasn't we we'd we'll we're we've were weren't
what what's when when's where where's which while who who's whom why why's
will with won't would wouldn't you you'd you'll you're you've your yours
yourself yourselves also just like use used using can one two make need want
way think know well good new say may much many first come see now look back
still time thing make take right even also though
""".split())

def clean_text(text):
    text = (text or "").lower()
    text = re.sub(r'```[\s\S]*?```', ' code_block ', text)
    text = re.sub(r'http\S+', ' url ', text)
    text = re.sub(r'[^a-z\s]', ' ', text)
    text = re.sub(r'\b\w{1,2}\b', ' ', text)  # remove very short words
    text = re.sub(r'\s+', ' ', text).strip()
    return text

corpus = []
conv_ids = []
conv_dates = []
conv_names = []

for conv in conversations:
    # combine conversation name + all message text
    parts = [conv.get("name", "")]
    for msg in conv.get("chat_messages", []):
        if msg.get("sender") == "human":
            parts.append(msg.get("text", "") or "")
        # include first assistant message too
        elif msg.get("sender") == "assistant" and len(parts) < 3:
            parts.append((msg.get("text", "") or "")[:500])

    text = clean_text(" ".join(parts))
    if len(text) > 30:
        corpus.append(text)
        conv_ids.append(conv["uuid"])
        conv_dates.append(conv.get("created_at", ""))
        conv_names.append(conv.get("name", "")[:80])

print(f"Corpus size: {len(corpus)} documents")

# ─── TF-IDF ───────────────────────────────────────────────────────────────────

print("Fitting TF-IDF...")
vectorizer = TfidfVectorizer(
    max_features=8000,
    min_df=3,
    max_df=0.85,
    ngram_range=(1, 2),
    stop_words=list(STOPWORDS),
)
tfidf_matrix = vectorizer.fit_transform(corpus)
feature_names = vectorizer.get_feature_names_out()
print(f"Vocabulary size: {len(feature_names)}, Matrix: {tfidf_matrix.shape}")

# ─── NMF Topic Modeling ───────────────────────────────────────────────────────

print(f"Fitting NMF ({N_TOPICS} topics)...")
nmf = NMF(n_components=N_TOPICS, random_state=42, max_iter=400, l1_ratio=0.1)
W = nmf.fit_transform(tfidf_matrix)  # doc × topic
H = nmf.components_                   # topic × word

# Normalize W so each row sums to 1 (soft assignment)
W_norm = normalize(W, norm='l1')

# ─── Extract topic labels ──────────────────────────────────────────────────────

# Manually curated labels (will be overridden if we can infer them)
AUTO_LABELS = {
    0:  "AI Agents & Systems",
    1:  "Conversations & Dialogue",
    2:  "Dubai & Gov Digital",
    3:  "Prompt Templates",
    4:  "Indonesian Conversations",
    5:  "Reading & Personal Notes",
    6:  "Product Development",
    7:  "Business Strategy",
    8:  "Data Governance",
    9:  "Career & Job Search",
    10: "AI Thinking Patterns",
    11: "Insurance & Claims",
    12: "Marketing & Intelligence",
    13: "Project & Requirements",
    14: "LLM Prompting & AI Tools",
    15: "Web & Landing Pages",
    16: "Personal Identity",
    17: "Code & Documentation",
}

topic_colors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
    "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
    "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
    "#6366f1", "#d946ef", "#fb7185",
]

topics = []
for i in range(N_TOPICS):
    top_indices = H[i].argsort()[::-1][:N_TOP_WORDS]
    top_words = [(feature_names[j], float(H[i][j])) for j in top_indices]

    topics.append({
        "id": i,
        "label": AUTO_LABELS.get(i, f"Topic {i}"),
        "color": topic_colors[i % len(topic_colors)],
        "top_words": top_words[:N_TOP_WORDS_DISPLAY],
        "all_words": top_words,
        "doc_count": int((W_norm.argmax(axis=1) == i).sum()),
    })

# ─── Assign dominant topic to each conversation ───────────────────────────────

dominant_topics = W_norm.argmax(axis=1)
topic_scores = W_norm.max(axis=1)  # confidence

conv_topics = []
for idx, (conv_id, date_str, name) in enumerate(zip(conv_ids, conv_dates, conv_names)):
    topic_id = int(dominant_topics[idx])
    score = float(topic_scores[idx])

    # top-3 topics with scores
    top3_idx = W_norm[idx].argsort()[::-1][:3]
    top3 = [(int(j), float(W_norm[idx][j])) for j in top3_idx]

    conv_topics.append({
        "uuid": conv_id,
        "name": name,
        "date": date_str,
        "topic": topic_id,
        "score": round(score, 3),
        "top3": top3,
    })

# ─── Topic evolution over time ─────────────────────────────────────────────────

# Group by month
monthly_topics = defaultdict(lambda: defaultdict(int))
for ct in conv_topics:
    month = ct["date"][:7]
    monthly_topics[month][ct["topic"]] += 1

all_months = sorted(monthly_topics.keys())
topic_evolution = []
for month in all_months:
    row = {"month": month}
    total = sum(monthly_topics[month].values())
    for t in range(N_TOPICS):
        row[f"t{t}"] = monthly_topics[month].get(t, 0)
        row[f"t{t}_pct"] = round(monthly_topics[month].get(t, 0) / total * 100, 1) if total else 0
    topic_evolution.append(row)

# ─── Top conversations per topic ──────────────────────────────────────────────

topic_top_convs = defaultdict(list)
for ct in sorted(conv_topics, key=lambda x: x["score"], reverse=True):
    tid = ct["topic"]
    if len(topic_top_convs[tid]) < 5:
        topic_top_convs[tid].append({
            "uuid": ct["uuid"],
            "name": ct["name"],
            "score": ct["score"],
        })

for t in topics:
    t["top_conversations"] = topic_top_convs[t["id"]]

# ─── Write outputs ─────────────────────────────────────────────────────────────

with open(f"{OUT_DIR}/topics.json", "w") as f:
    json.dump({
        "topics": topics,
        "n_topics": N_TOPICS,
    }, f, separators=(",", ":"))
print(f"  Wrote topics.json")

with open(f"{OUT_DIR}/conv_topics.json", "w") as f:
    json.dump(conv_topics, f, separators=(",", ":"))
print(f"  Wrote conv_topics.json ({len(conv_topics)} records)")

with open(f"{OUT_DIR}/topic_evolution.json", "w") as f:
    json.dump({
        "months": all_months,
        "n_topics": N_TOPICS,
        "data": topic_evolution,
    }, f, separators=(",", ":"))
print(f"  Wrote topic_evolution.json")

print("\nTopic summary:")
for t in sorted(topics, key=lambda x: -x["doc_count"]):
    words = ", ".join(w[0] for w in t["top_words"][:5])
    print(f"  [{t['id']:2d}] {t['label']:35s} {t['doc_count']:4d} convs  [{words}]")

print("\n✓ Topic modeling complete.")
