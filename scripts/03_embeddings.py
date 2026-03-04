"""
03_embeddings.py - Sentence Embeddings + UMAP + HDBSCAN
Topographical lens: creates a 2D "knowledge galaxy" of conversations.
"""

import json
import numpy as np
from sentence_transformers import SentenceTransformer
import umap
import hdbscan
from datetime import datetime

DATA_DIR = "/Users/jonathankurniawan/Documents/Claude Cowork/claude-chat-analysis"
OUT_DIR = f"{DATA_DIR}/web/data"

print("Loading data...")
with open(f"{DATA_DIR}/conversations.json", "r") as f:
    conversations = json.load(f)

with open(f"{OUT_DIR}/conv_topics.json", "r") as f:
    conv_topics_raw = json.load(f)

# Build topic lookup
topic_lookup = {ct["uuid"]: ct for ct in conv_topics_raw}

# Load topic colors
with open(f"{OUT_DIR}/topics.json", "r") as f:
    topics_data = json.load(f)

topic_colors = {t["id"]: t["color"] for t in topics_data["topics"]}
topic_labels = {t["id"]: t["label"] for t in topics_data["topics"]}

# ─── Build text for embedding ─────────────────────────────────────────────────

print("Building text corpus for embedding...")
texts = []
meta = []

for conv in conversations:
    # Use conversation name + first human message + first assistant response
    name = conv.get("name", "") or ""
    msgs = conv.get("chat_messages", [])

    parts = [name]
    human_added = 0
    assistant_added = 0

    for msg in msgs:
        sender = msg.get("sender", "")
        text = (msg.get("text", "") or "")
        if sender == "human" and human_added < 2:
            parts.append(text[:600])
            human_added += 1
        elif sender == "assistant" and assistant_added < 1:
            parts.append(text[:400])
            assistant_added += 1
        if human_added >= 2 and assistant_added >= 1:
            break

    combined = " ".join(parts).strip()
    if len(combined) < 20:
        combined = name or "untitled conversation"

    texts.append(combined[:1000])

    # Count total chars in conversation
    total_chars = sum(len(m.get("text", "") or "") for m in msgs)
    total_msgs = len(msgs)

    ct = topic_lookup.get(conv["uuid"], {})
    meta.append({
        "uuid": conv["uuid"],
        "name": (conv.get("name", "") or "")[:80],
        "created_at": conv.get("created_at", ""),
        "total_msgs": total_msgs,
        "total_chars": total_chars,
        "topic": ct.get("topic", -1),
        "topic_score": ct.get("score", 0),
    })

print(f"Texts to embed: {len(texts)}")

# ─── Sentence Embeddings ──────────────────────────────────────────────────────

print("Loading sentence transformer model (all-MiniLM-L6-v2)...")
model = SentenceTransformer("all-MiniLM-L6-v2")

print("Generating embeddings (this may take a few minutes)...")
embeddings = model.encode(
    texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True,
)
print(f"Embeddings shape: {embeddings.shape}")

# ─── UMAP 2D Reduction ────────────────────────────────────────────────────────

print("Running UMAP dimensionality reduction...")
reducer = umap.UMAP(
    n_components=2,
    n_neighbors=15,
    min_dist=0.1,
    metric="cosine",
    random_state=42,
    verbose=True,
)
coords_2d = reducer.fit_transform(embeddings)
print(f"UMAP done. Shape: {coords_2d.shape}")

# ─── HDBSCAN Clustering ───────────────────────────────────────────────────────

print("Running HDBSCAN clustering...")
clusterer = hdbscan.HDBSCAN(
    min_cluster_size=15,
    min_samples=5,
    metric="euclidean",
    cluster_selection_epsilon=0.3,
)
cluster_labels = clusterer.fit_predict(coords_2d)
n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
noise_count = (cluster_labels == -1).sum()
print(f"HDBSCAN: {n_clusters} clusters, {noise_count} noise points")

# ─── Build cluster summaries ──────────────────────────────────────────────────

# Find cluster centers
cluster_centers = {}
for cl in set(cluster_labels):
    if cl == -1:
        continue
    mask = cluster_labels == cl
    center = coords_2d[mask].mean(axis=0)
    cluster_centers[int(cl)] = [float(center[0]), float(center[1])]

# Find cluster label based on most common NMF topic
from collections import Counter
cluster_topic_map = {}
for cl in set(cluster_labels):
    if cl == -1:
        continue
    mask = np.where(cluster_labels == cl)[0]
    topics_in_cluster = [meta[i]["topic"] for i in mask]
    most_common_topic = Counter(topics_in_cluster).most_common(1)[0][0]
    cluster_topic_map[int(cl)] = most_common_topic

# ─── Normalize coordinates to [-1, 1] for web ────────────────────────────────

x_min, x_max = coords_2d[:, 0].min(), coords_2d[:, 0].max()
y_min, y_max = coords_2d[:, 1].min(), coords_2d[:, 1].max()

def norm(v, vmin, vmax):
    return float((v - vmin) / (vmax - vmin) * 2 - 1) if vmax > vmin else 0.0

# ─── Build output ─────────────────────────────────────────────────────────────

points = []
for i, (m, (x, y), cl) in enumerate(zip(meta, coords_2d, cluster_labels)):
    cl_int = int(cl)
    topic_id = m["topic"]

    points.append({
        "uuid": m["uuid"],
        "name": m["name"],
        "x": round(norm(x, x_min, x_max), 4),
        "y": round(norm(y, y_min, y_max), 4),
        "cluster": cl_int,
        "topic": topic_id,
        "color": topic_colors.get(topic_id, "#888"),
        "date": m["created_at"][:10],
        "total_msgs": m["total_msgs"],
        "total_chars": m["total_chars"],
    })

# Cluster metadata
clusters_meta = []
for cl_id, center in cluster_centers.items():
    topic_id = cluster_topic_map.get(cl_id, -1)
    cl_points = [p for p in points if p["cluster"] == cl_id]
    clusters_meta.append({
        "id": cl_id,
        "center_x": round(norm(center[0], x_min, x_max), 4),
        "center_y": round(norm(center[1], y_min, y_max), 4),
        "size": len(cl_points),
        "topic": topic_id,
        "topic_label": topic_labels.get(topic_id, "Unknown"),
        "topic_color": topic_colors.get(topic_id, "#888"),
    })

output = {
    "points": points,
    "clusters": clusters_meta,
    "n_clusters": n_clusters,
    "n_noise": int(noise_count),
    "bounds": {
        "x_min": float(x_min), "x_max": float(x_max),
        "y_min": float(y_min), "y_max": float(y_max),
    },
}

with open(f"{OUT_DIR}/umap.json", "w") as f:
    json.dump(output, f, separators=(",", ":"))

size_kb = len(json.dumps(output)) // 1024
print(f"  Wrote umap.json ({size_kb} KB, {len(points)} points, {n_clusters} clusters)")
print("\n✓ Embeddings + UMAP + HDBSCAN complete.")
