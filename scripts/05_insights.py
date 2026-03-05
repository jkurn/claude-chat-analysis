"""
05_insights.py - Substance-Focused Analysis
Digs into WHAT the user thinks about: depth, obsessions, recurring threads,
meta-cognitive patterns, and the intellectual fingerprint.

Computes A-K analyses as a "chief AI scientist" examining a mind through its conversations.
"""

import json
import re
import math
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict, Counter

DATA_DIR = "/Users/jonathankurniawan/Documents/Claude Cowork/claude-chat-analysis"
OUT_DIR = f"{DATA_DIR}/web/data"

# ─── Load all data sources ────────────────────────────────────────────────────

print("Loading data...")
with open(f"{DATA_DIR}/conversations.json", "r") as f:
    conversations = json.load(f)

with open(f"{OUT_DIR}/conv_topics.json", "r") as f:
    conv_topics = json.load(f)

with open(f"{OUT_DIR}/conversations_meta.json", "r") as f:
    conv_meta = json.load(f)

with open(f"{OUT_DIR}/topics.json", "r") as f:
    topics_data = json.load(f)

print(f"  {len(conversations)} conversations, {len(conv_topics)} topic-assigned, {len(conv_meta)} meta records")

# Build lookups
conv_lookup = {c["uuid"]: c for c in conversations}
meta_lookup = {c["uuid"]: c for c in conv_meta}
topic_lookup = {ct["uuid"]: ct for ct in conv_topics}

N_TOPICS = topics_data["n_topics"]
topic_labels = {t["id"]: t["label"] for t in topics_data["topics"]}
topic_colors = {t["id"]: t["color"] for t in topics_data["topics"]}

# ─── A. Per-Topic Depth Metrics ───────────────────────────────────────────────

print("\n[A] Computing per-topic depth metrics...")

topic_convs = defaultdict(list)
for ct in conv_topics:
    meta = meta_lookup.get(ct["uuid"])
    if meta:
        topic_convs[ct["topic"]].append({
            "uuid": ct["uuid"],
            "name": ct["name"],
            "date": ct["date"],
            "score": ct["score"],
            "total_msgs": meta["total_msgs"],
            "h_chars": meta["h_chars"],
            "a_chars": meta["a_chars"],
            "has_code": meta["has_code"],
            "duration_min": meta["duration_min"],
            "month": meta["month"],
        })

topic_depth = {}
for tid in range(N_TOPICS):
    convs = topic_convs.get(tid, [])
    if not convs:
        topic_depth[tid] = {
            "avg_turns": 0, "avg_human_chars": 0, "avg_assistant_chars": 0,
            "depth_score": 0, "pct_code": 0, "pct_deep": 0, "top_conversations": []
        }
        continue

    turns = [c["total_msgs"] for c in convs]
    h_chars = [c["h_chars"] for c in convs]
    a_chars = [c["a_chars"] for c in convs]

    avg_turns = sum(turns) / len(turns)
    avg_h = sum(h_chars) / len(h_chars)
    avg_a = sum(a_chars) / len(a_chars)

    depth_score = avg_turns * math.log(avg_h + avg_a + 1)
    pct_code = sum(1 for c in convs if c["has_code"]) / len(convs) * 100
    pct_deep = sum(1 for c in convs if c["total_msgs"] > 20) / len(convs) * 100

    top5 = sorted(convs, key=lambda x: x["total_msgs"], reverse=True)[:5]

    topic_depth[tid] = {
        "avg_turns": round(avg_turns, 1),
        "avg_human_chars": round(avg_h),
        "avg_assistant_chars": round(avg_a),
        "depth_score": round(depth_score, 1),
        "pct_code": round(pct_code, 1),
        "pct_deep": round(pct_deep, 1),
        "top_conversations": [
            {"uuid": c["uuid"], "name": c["name"], "turns": c["total_msgs"], "date": c["date"][:10]}
            for c in top5
        ],
    }

for tid in sorted(topic_depth, key=lambda t: -topic_depth[t]["depth_score"]):
    d = topic_depth[tid]
    print(f"  [{tid:2d}] {topic_labels.get(tid, ''):35s} depth={d['depth_score']:7.1f}  avg_turns={d['avg_turns']:5.1f}  deep={d['pct_deep']:4.1f}%")

# ─── B. Obsession Score ──────────────────────────────────────────────────────

print("\n[B] Computing obsession scores...")

topic_months = defaultdict(set)
for ct in conv_topics:
    month = ct["date"][:7]
    topic_months[ct["topic"]].add(month)

obsession_scores = {}
for tid in range(N_TOPICS):
    doc_count = len(topic_convs.get(tid, []))
    avg_turns = topic_depth[tid]["avg_turns"]
    months_active = len(topic_months.get(tid, set()))
    obsession = (doc_count * avg_turns * months_active) / 100
    obsession_scores[tid] = {
        "doc_count": doc_count,
        "avg_turns": round(avg_turns, 1),
        "months_active": months_active,
        "obsession_score": round(obsession, 1),
    }

for tid in sorted(obsession_scores, key=lambda t: -obsession_scores[t]["obsession_score"])[:5]:
    o = obsession_scores[tid]
    print(f"  [{tid:2d}] {topic_labels.get(tid, ''):35s} obsession={o['obsession_score']:7.1f}  ({o['doc_count']} convos × {o['avg_turns']} turns × {o['months_active']} months)")

# ─── C. Intellectual Fingerprint ──────────────────────────────────────────────

print("\n[C] Computing intellectual fingerprint...")

fingerprint_axes = {
    "Building":      [0, 6, 15, 17],   # AI Agents, Product Dev, Web/Landing, Code
    "Strategizing":  [7, 8, 12],        # Business Strategy, Data Governance, Marketing
    "Learning":      [5, 14, 3, 10],    # Reading, LLM Prompting, Prompt Templates, AI Thinking
    "Reflecting":    [1, 16],            # Conversations & Dialogue, Personal Identity
    "Consulting":    [2, 11, 13],        # Dubai Gov, Insurance, Project/Requirements
    "Exploring":     [4, 9],             # Indonesian, Career & Job Search
}

fingerprint_raw = {}
for axis, topic_ids in fingerprint_axes.items():
    score = sum(
        len(topic_convs.get(tid, [])) * topic_depth.get(tid, {}).get("depth_score", 0)
        for tid in topic_ids
    )
    fingerprint_raw[axis] = round(score, 1)

max_fp = max(fingerprint_raw.values()) if fingerprint_raw.values() else 1
fingerprint = {k: round(v / max_fp * 100, 1) for k, v in fingerprint_raw.items()}

for axis, score in sorted(fingerprint.items(), key=lambda x: -x[1]):
    print(f"  {axis:15s} {score:5.1f}  (raw: {fingerprint_raw[axis]:.0f})")

# ─── D. Reading List Extraction ───────────────────────────────────────────────

print("\n[D] Extracting reading list...")

reading_convs = [ct for ct in conv_topics if ct["topic"] == 5]
books = []
for ct in reading_convs:
    name = ct.get("name", "")
    meta = meta_lookup.get(ct["uuid"], {})
    # Determine topic overlaps from top3
    overlaps = []
    for tid, score in ct.get("top3", []):
        if tid != 5 and score > 0.1:
            overlaps.append({"id": tid, "label": topic_labels.get(tid, ""), "score": round(score, 3)})

    books.append({
        "name": name,
        "date": ct["date"][:10],
        "turns": meta.get("total_msgs", 0),
        "h_chars": meta.get("h_chars", 0),
        "topic_overlaps": overlaps,
    })

books.sort(key=lambda x: x["date"])
print(f"  {len(books)} reading conversations found")
for b in books[:5]:
    print(f"    {b['date']}  {b['name'][:60]}  ({b['turns']} msgs)")

# ─── E. Conversation Type Taxonomy ───────────────────────────────────────────

print("\n[E] Building conversation type taxonomy...")

type_taxonomy = {}
for cat_key, label, turns_range in [
    ("quick_lookup", "Quick Lookup", "2"),
    ("focused_exchange", "Focused Exchange", "3-10"),
    ("deep_dive", "Deep Dive", "11-30"),
    ("marathon", "Marathon", "31+"),
]:
    type_taxonomy[cat_key] = {
        "label": label, "turns_range": turns_range,
        "count": 0, "pct": 0, "by_topic": {},
    }

for ct in conv_topics:
    meta = meta_lookup.get(ct["uuid"])
    if not meta:
        continue
    turns = meta["total_msgs"]
    tid = str(ct["topic"])

    if turns <= 2:
        cat = "quick_lookup"
    elif turns <= 10:
        cat = "focused_exchange"
    elif turns <= 30:
        cat = "deep_dive"
    else:
        cat = "marathon"

    type_taxonomy[cat]["count"] += 1
    type_taxonomy[cat]["by_topic"][tid] = type_taxonomy[cat]["by_topic"].get(tid, 0) + 1

total_ct = sum(t["count"] for t in type_taxonomy.values())
for cat in type_taxonomy:
    type_taxonomy[cat]["pct"] = round(type_taxonomy[cat]["count"] / total_ct * 100, 1) if total_ct else 0

for cat, d in type_taxonomy.items():
    print(f"  {d['label']:20s} {d['count']:5d} ({d['pct']:5.1f}%)")

# ─── F. Cross-Topic Bridges ──────────────────────────────────────────────────

print("\n[F] Finding cross-topic bridges...")

bridges = []
for ct in conv_topics:
    top3 = ct.get("top3", [])
    multi = [(tid, score) for tid, score in top3 if score > 0.15]
    if len(multi) >= 2:
        meta = meta_lookup.get(ct["uuid"])
        bridges.append({
            "uuid": ct["uuid"],
            "name": ct["name"],
            "date": ct["date"][:10],
            "topics": [
                {"id": tid, "label": topic_labels.get(tid, f"Topic {tid}"), "score": round(score, 3)}
                for tid, score in multi
            ],
            "turns": meta["total_msgs"] if meta else 0,
        })

bridge_pairs = Counter()
for b in bridges:
    tids = sorted([t["id"] for t in b["topics"]])
    for i in range(len(tids)):
        for j in range(i + 1, len(tids)):
            bridge_pairs[(tids[i], tids[j])] += 1

top_bridge_pairs = [
    {
        "topic_a": {"id": ta, "label": topic_labels.get(ta, "")},
        "topic_b": {"id": tb, "label": topic_labels.get(tb, "")},
        "count": cnt,
    }
    for (ta, tb), cnt in bridge_pairs.most_common(20)
]

print(f"  {len(bridges)} bridge conversations found")
for bp in top_bridge_pairs[:5]:
    print(f"    {bp['topic_a']['label'][:25]} ↔ {bp['topic_b']['label'][:25]}  ({bp['count']}x)")

# ─── G. The Personal Layer ───────────────────────────────────────────────────

print("\n[G] Analyzing personal layer (topic 1)...")

personal_convs = [ct for ct in conv_topics if ct["topic"] == 1]
personal_analysis = {"count": len(personal_convs), "avg_turns": 0, "themes": [], "top_conversations": []}

if personal_convs:
    personal_meta = [meta_lookup[ct["uuid"]] for ct in personal_convs if ct["uuid"] in meta_lookup]
    if personal_meta:
        personal_analysis["avg_turns"] = round(
            sum(m["total_msgs"] for m in personal_meta) / len(personal_meta), 1
        )

    coaching_words = [
        "confidence", "worthiness", "growth", "identity", "overthinking", "anxiety",
        "enough", "wealth", "health", "joey", "coach", "personal", "reflection",
        "mindset", "fear", "purpose", "meaning", "joy", "happiness", "values",
        "pillars", "intentional", "resilience", "clarity", "self", "belief",
    ]
    theme_keywords = defaultdict(int)
    for ct in personal_convs:
        name_lower = (ct.get("name", "") or "").lower()
        for word in coaching_words:
            if word in name_lower:
                theme_keywords[word] += 1

    personal_analysis["themes"] = sorted(
        [{"theme": k, "count": v} for k, v in theme_keywords.items() if v > 0],
        key=lambda x: -x["count"],
    )

    personal_with_meta = []
    for ct in personal_convs:
        meta = meta_lookup.get(ct["uuid"])
        if meta:
            personal_with_meta.append({
                "name": ct["name"], "turns": meta["total_msgs"],
                "date": ct["date"][:10], "duration_min": meta["duration_min"],
            })
    personal_with_meta.sort(key=lambda x: x["turns"], reverse=True)
    personal_analysis["top_conversations"] = personal_with_meta[:10]

print(f"  {personal_analysis['count']} personal conversations, avg {personal_analysis['avg_turns']} turns")
for t in personal_analysis["themes"][:5]:
    print(f"    theme: {t['theme']} ({t['count']}x)")

# ─── H. Recurring Threads (Semantic Similarity) ──────────────────────────────

print("\n[H] Computing embeddings for recurring thread detection...")

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Build text corpus (same method as 03_embeddings.py)
texts = []
text_meta = []

for conv in conversations:
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

    total_msgs = len(msgs)
    ct = topic_lookup.get(conv["uuid"], {})
    text_meta.append({
        "uuid": conv["uuid"],
        "name": (conv.get("name", "") or "")[:80],
        "date": conv.get("created_at", "")[:10],
        "total_msgs": total_msgs,
        "topic": ct.get("topic", -1) if isinstance(ct, dict) else -1,
    })

print(f"  Generating embeddings for {len(texts)} conversations...")
model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(texts, batch_size=64, show_progress_bar=True, convert_to_numpy=True)

# Save embeddings to disk for potential future use
np.save(f"{OUT_DIR}/embeddings.npy", embeddings)
print(f"  Saved embeddings.npy ({embeddings.shape})")

print("  Computing pairwise similarity (this may take a moment)...")
sim_matrix = cosine_similarity(embeddings)

print("  Finding recurring threads...")

# Build adjacency list: conversations with sim > 0.7 and temporal gap > 7 days
adj = defaultdict(list)
for i in range(len(text_meta)):
    date_i = text_meta[i]["date"]
    if not date_i:
        continue
    try:
        dt_i = datetime.strptime(date_i, "%Y-%m-%d")
    except ValueError:
        continue

    # Get indices with sim > 0.7 (use argsort for efficiency)
    row = sim_matrix[i]
    candidates = np.where(row > 0.7)[0]

    for j in candidates:
        if i == j:
            continue
        date_j = text_meta[j]["date"]
        if not date_j:
            continue
        try:
            dt_j = datetime.strptime(date_j, "%Y-%m-%d")
        except ValueError:
            continue
        if abs((dt_j - dt_i).days) >= 7:
            adj[i].append(j)

# BFS to find connected components
visited = set()
threads = []

for i in range(len(text_meta)):
    if i in visited or i not in adj:
        continue
    # BFS
    queue = [i]
    component = set()
    while queue:
        node = queue.pop(0)
        if node in visited:
            continue
        visited.add(node)
        component.add(node)
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                queue.append(neighbor)

    if len(component) < 3:
        continue

    convs_in_thread = sorted(
        [text_meta[idx] for idx in component],
        key=lambda x: x["date"],
    )

    dates = [c["date"] for c in convs_in_thread if c["date"]]
    if len(dates) >= 2:
        first = datetime.strptime(dates[0], "%Y-%m-%d")
        last = datetime.strptime(dates[-1], "%Y-%m-%d")
        span_days = (last - first).days
    else:
        span_days = 0

    # Dominant topic
    tc = Counter(c["topic"] for c in convs_in_thread if c["topic"] >= 0)
    dominant_topic = tc.most_common(1)[0][0] if tc else -1

    # Trend: compare first half vs second half turn counts
    turns = [c["total_msgs"] for c in convs_in_thread]
    if len(turns) >= 3:
        half = len(turns) // 2
        first_half_avg = sum(turns[:half]) / max(half, 1)
        second_half_avg = sum(turns[half:]) / max(len(turns) - half, 1)
        if second_half_avg > first_half_avg * 1.3:
            trend = "deepening"
        elif second_half_avg < first_half_avg * 0.7:
            trend = "fading"
        else:
            trend = "stable"
    else:
        trend = "stable"

    # Is open: last conversation within 90 days of dataset end
    dataset_end = datetime.strptime("2026-03-04", "%Y-%m-%d")
    try:
        last_thread_date = datetime.strptime(dates[-1], "%Y-%m-%d")
        is_open = (dataset_end - last_thread_date).days <= 90
    except (ValueError, IndexError):
        is_open = False

    # I. Evolution metrics
    if len(turns) >= 3:
        increasing = sum(1 for k in range(1, len(turns)) if turns[k] > turns[k - 1])
        decreasing = sum(1 for k in range(1, len(turns)) if turns[k] < turns[k - 1])
        ratio = increasing / max(increasing + decreasing, 1)
        evolution_type = "progressive" if ratio > 0.6 else ("regressive" if ratio < 0.4 else "cyclical")
    else:
        evolution_type = "cyclical"

    if len(dates) >= 2:
        gaps = []
        for k in range(1, len(dates)):
            try:
                d1 = datetime.strptime(dates[k - 1], "%Y-%m-%d")
                d2 = datetime.strptime(dates[k], "%Y-%m-%d")
                gaps.append((d2 - d1).days)
            except ValueError:
                pass
        avg_gap = sum(gaps) / len(gaps) if gaps else 0
    else:
        avg_gap = 0

    threads.append({
        "conversations": [
            {"uuid": c["uuid"], "name": c["name"], "date": c["date"], "turns": c["total_msgs"]}
            for c in convs_in_thread
        ],
        "size": len(convs_in_thread),
        "span_days": span_days,
        "topic": dominant_topic,
        "topic_label": topic_labels.get(dominant_topic, "Misc"),
        "topic_color": topic_colors.get(dominant_topic, "#888"),
        "trend": trend,
        "is_open": is_open,
        "evolution_type": evolution_type,
        "avg_gap_days": round(avg_gap, 1),
    })

threads.sort(key=lambda x: (-x["size"], -x["span_days"]))

print(f"  {len(threads)} recurring threads found")
for t in threads[:5]:
    print(f"    [{t['size']} convos, {t['span_days']}d] {t['topic_label'][:25]}  trend={t['trend']}  open={t['is_open']}")
    for c in t["conversations"][:3]:
        print(f"      {c['date']}  {c['name'][:50]}  ({c['turns']} msgs)")

# ─── J. Meta-Cognitive: User Voice vs AI-Pasted ──────────────────────────────

print("\n[J] Classifying user voice vs AI-pasted content...")

AI_START_PATTERNS = [
    r"^(?:certainly|here'?s|i'?ll|based on|let me|sure,?\s|absolutely|great question|of course|i understand|i'd be happy|thank you for)",
]
AI_STRUCTURAL = [
    r"^#{1,3}\s",     # Markdown headers
    r"^\*\*[A-Z]",    # Bold capitalized starts
]

USER_SPEECH = {
    "yeah", "wanna", "gonna", "kinda", "don't", "i want to", "help me",
    "can you", "how do i", "what should", "ok so", "basically", "so,",
    "hey", "hmm", "hm", "btw", "pls", "plz", "thx", "ty", "nah",
    "lol", "tbh", "idk", "imo", "fyi",
}


def classify_message(text):
    """Classify a human message as user_written or ai_pasted."""
    if not text or len(text.strip()) == 0:
        return "user_written"

    text_lower = text.lower().strip()
    first_200 = text_lower[:200]

    ai_signals = 0
    user_signals = 0

    # Short messages are almost always user-written
    if len(text) < 300:
        user_signals += 3
    elif len(text) > 2000:
        ai_signals += 1

    # AI start patterns
    for pat in AI_START_PATTERNS:
        if re.match(pat, first_200):
            ai_signals += 3
            break

    # Structural markers in first 200 chars
    for pat in AI_STRUCTURAL:
        if re.search(pat, text[:200], re.MULTILINE):
            ai_signals += 2

    # High bullet/list density
    lines = text.split("\n")
    non_empty = [l for l in lines if l.strip()]
    if len(non_empty) > 3:
        list_lines = sum(1 for l in non_empty if re.match(r"^\s*[-*•]\s|^\s*\d+[\.\)]\s", l))
        if list_lines / len(non_empty) > 0.5:
            ai_signals += 2

    # User speech patterns
    for pattern in USER_SPEECH:
        if pattern in text_lower:
            user_signals += 1

    # First-person questions and requests
    if re.search(r"\b(how do i|what should i|can you|could you|help me|i want|i need|i'm trying|i'm looking)\b", text_lower):
        user_signals += 2

    # Fragments, informal style
    if len(non_empty) > 0:
        short_no_period = sum(1 for l in non_empty if 0 < len(l.strip()) < 80 and not l.strip().endswith("."))
        if short_no_period > len(non_empty) * 0.5:
            user_signals += 1

    return "ai_pasted" if ai_signals > user_signals else "user_written"


conv_voice_ratios = {}
all_user_written_msgs = []
all_first_messages = []

for conv in conversations:
    uuid = conv["uuid"]
    msgs = conv.get("chat_messages", [])

    user_written_chars = 0
    ai_pasted_chars = 0
    is_first_human = True

    created_str = conv.get("created_at", "")
    try:
        conv_hour = datetime.fromisoformat(created_str.replace("Z", "+00:00")).hour
    except (ValueError, AttributeError):
        conv_hour = 0

    for msg in msgs:
        if msg.get("sender") != "human":
            continue
        text = msg.get("text", "") or ""
        classification = classify_message(text)

        if classification == "user_written":
            user_written_chars += len(text)
            all_user_written_msgs.append({
                "uuid": uuid,
                "text": text,
                "date": created_str[:10],
                "hour": conv_hour,
            })
        else:
            ai_pasted_chars += len(text)

        if is_first_human:
            all_first_messages.append({
                "uuid": uuid,
                "text": text[:500],
                "classification": classification,
            })
            is_first_human = False

    total_human = user_written_chars + ai_pasted_chars
    conv_voice_ratios[uuid] = {
        "user_written_chars": user_written_chars,
        "ai_pasted_chars": ai_pasted_chars,
        "voice_ratio": round(user_written_chars / total_human, 3) if total_human > 0 else 1.0,
    }

total_user_written = sum(v["user_written_chars"] for v in conv_voice_ratios.values())
total_ai_pasted = sum(v["ai_pasted_chars"] for v in conv_voice_ratios.values())
total_human_all = total_user_written + total_ai_pasted

voice_stats = {
    "user_written_chars": total_user_written,
    "ai_pasted_chars": total_ai_pasted,
    "user_written_pct": round(total_user_written / total_human_all * 100, 1) if total_human_all else 0,
    "ai_pasted_pct": round(total_ai_pasted / total_human_all * 100, 1) if total_human_all else 0,
}

# Per-topic voice ratio
topic_voice = defaultdict(lambda: {"user": 0, "ai": 0})
for ct in conv_topics:
    vr = conv_voice_ratios.get(ct["uuid"])
    if vr:
        topic_voice[ct["topic"]]["user"] += vr["user_written_chars"]
        topic_voice[ct["topic"]]["ai"] += vr["ai_pasted_chars"]

topic_voice_ratios = {}
for tid in range(N_TOPICS):
    tv = topic_voice[tid]
    total = tv["user"] + tv["ai"]
    topic_voice_ratios[tid] = round(tv["user"] / total * 100, 1) if total > 0 else 100.0

voice_stats["by_topic"] = {
    str(tid): {"user_pct": ratio, "label": topic_labels.get(tid, "")}
    for tid, ratio in sorted(topic_voice_ratios.items(), key=lambda x: x[1])
}

print(f"  Voice: {voice_stats['user_written_pct']}% user-written, {voice_stats['ai_pasted_pct']}% AI-pasted")

# ─── K. Meta-Cognitive Pattern Analysis ──────────────────────────────────────

print("\n[K] Analyzing meta-cognitive patterns...")

# K1. Conversation starters taxonomy
starter_types = Counter()
for fm in all_first_messages:
    text = fm["text"].strip()
    text_lower = text.lower()

    if not text:
        starter_types["empty"] += 1
    elif text_lower.endswith("?") or re.match(
        r"^(what|how|why|when|where|who|can|could|is|are|do|does|should|would|which|tell me)\b",
        text_lower,
    ):
        starter_types["question"] += 1
    elif re.match(
        r"^(help|create|build|make|write|generate|design|implement|add|fix|update|show|find|search|list|give|analyze|review|summarize|convert|translate|explain)\b",
        text_lower,
    ):
        starter_types["command"] += 1
    elif re.match(r"^(brainstorm|ideas?\b|what if|imagine|think about|explore)\b", text_lower):
        starter_types["brainstorm"] += 1
    elif len(text) > 1000 or text.count("\n") > 8:
        starter_types["context_paste"] += 1
    elif len(text) < 150:
        starter_types["question"] += 1
    else:
        starter_types["context_paste"] += 1

total_starters = sum(starter_types.values())
conversation_starters = [
    {"type": k, "count": v, "pct": round(v / total_starters * 100, 1)}
    for k, v in starter_types.most_common()
]

print(f"  Conversation starters:")
for s in conversation_starters:
    print(f"    {s['type']:20s} {s['count']:5d} ({s['pct']:5.1f}%)")

# K2. Emotional undertone taxonomy (user-written messages only)
intent_patterns = {
    "exploring":      [r"tell me about", r"what is\b", r"explain", r"i want to understand", r"how does", r"what are\b", r"describe"],
    "building":       [r"help me create", r"i want to (?:make|build|create)", r"build\b", r"implement", r"create\b", r"design\b", r"develop"],
    "processing":     [r"here is", r"analyze this", r"review\b", r"look at this", r"check this", r"summarize", r"extract"],
    "reflecting":     [r"i feel like", r"i'm realizing", r"i think\b", r"i've been thinking", r"i notice", r"i wonder", r"i'm reflecting"],
    "struggling":     [r"i'm stuck", r"this isn't working", r"overthinking", r"frustrated", r"confused", r"don't know how", r"can't figure"],
    "brainstorming":  [r"brainstorm", r"ideas for", r"what if\b", r"possibilities", r"options for", r"how might we", r"let's think"],
}

intent_counts = Counter()
intent_by_topic = defaultdict(Counter)
intent_by_hour = defaultdict(Counter)

for msg_data in all_user_written_msgs:
    text_lower = msg_data["text"].lower()
    matched_intent = None
    max_matches = 0

    for intent, patterns in intent_patterns.items():
        matches = sum(1 for p in patterns if re.search(p, text_lower))
        if matches > max_matches:
            max_matches = matches
            matched_intent = intent

    if not matched_intent:
        # Default by length/structure
        if "?" in msg_data["text"]:
            matched_intent = "exploring"
        elif len(msg_data["text"]) > 500:
            matched_intent = "processing"
        else:
            matched_intent = "exploring"

    intent_counts[matched_intent] += 1

    ct = topic_lookup.get(msg_data["uuid"])
    if ct:
        intent_by_topic[matched_intent][ct["topic"]] += 1

    intent_by_hour[matched_intent][msg_data["hour"]] += 1

total_intents = sum(intent_counts.values())
emotional_taxonomy = [
    {"intent": k, "count": v, "pct": round(v / total_intents * 100, 1) if total_intents else 0}
    for k, v in intent_counts.most_common()
]

print(f"  Emotional undertones:")
for e in emotional_taxonomy:
    print(f"    {e['intent']:15s} {e['count']:5d} ({e['pct']:5.1f}%)")

# K3. Hidden patterns
reflecting_topics = intent_by_topic.get("reflecting", Counter()).most_common(5)
struggling_topics = intent_by_topic.get("struggling", Counter()).most_common(5)
building_topics = intent_by_topic.get("building", Counter()).most_common(5)
exploring_topics = intent_by_topic.get("exploring", Counter()).most_common(5)

def format_hour_peaks(hour_counter):
    return [{"hour": h, "count": c} for h, c in sorted(hour_counter.items(), key=lambda x: -x[1])[:3]]

hidden_patterns = {
    "reflecting_topics": [
        {"id": tid, "label": topic_labels.get(tid, ""), "count": cnt}
        for tid, cnt in reflecting_topics
    ],
    "struggling_topics": [
        {"id": tid, "label": topic_labels.get(tid, ""), "count": cnt}
        for tid, cnt in struggling_topics
    ],
    "building_topics": [
        {"id": tid, "label": topic_labels.get(tid, ""), "count": cnt}
        for tid, cnt in building_topics
    ],
    "exploring_topics": [
        {"id": tid, "label": topic_labels.get(tid, ""), "count": cnt}
        for tid, cnt in exploring_topics
    ],
    "reflecting_peak_hours": format_hour_peaks(intent_by_hour.get("reflecting", {})),
    "building_peak_hours": format_hour_peaks(intent_by_hour.get("building", {})),
    "struggling_peak_hours": format_hour_peaks(intent_by_hour.get("struggling", {})),
}

# K4. Recurring questions
questions = []
for msg_data in all_user_written_msgs:
    sentences = re.split(r"[.!?\n]", msg_data["text"])
    for s in sentences:
        s = s.strip()
        if len(s) > 10 and len(s) < 300 and "?" in msg_data["text"]:
            # Check if this sentence likely ends with ? in original
            idx = msg_data["text"].find(s)
            if idx >= 0 and idx + len(s) < len(msg_data["text"]) and msg_data["text"][idx + len(s):idx + len(s) + 1] == "?":
                questions.append(s + "?")

# Group by first 4 words
question_groups = defaultdict(list)
for q in questions:
    key = " ".join(q.lower().split()[:4])
    question_groups[key].append(q)

recurring_questions = sorted(
    [{"pattern": k, "count": len(v), "examples": v[:3]}
     for k, v in question_groups.items() if len(v) >= 3],
    key=lambda x: -x["count"],
)[:20]

print(f"  {len(recurring_questions)} recurring question patterns")
for rq in recurring_questions[:5]:
    print(f"    \"{rq['pattern']}...\" ({rq['count']}x)")

# ─── Assemble & Write Output ─────────────────────────────────────────────────

print("\nAssembling insights.json...")

insights = {
    # A: Per-topic depth
    "topic_depth": {str(k): v for k, v in topic_depth.items()},

    # B: Obsession scores (sorted)
    "obsession_scores": sorted(
        [{
            "topic_id": tid,
            "label": topic_labels.get(tid, ""),
            "color": topic_colors.get(tid, "#888"),
            **v,
        } for tid, v in obsession_scores.items()],
        key=lambda x: -x["obsession_score"],
    ),

    # C: Intellectual fingerprint
    "fingerprint": fingerprint,
    "fingerprint_raw": fingerprint_raw,
    "fingerprint_axes": {axis: tids for axis, tids in fingerprint_axes.items()},

    # D: Reading list
    "reading": {"count": len(books), "books": books},

    # E: Conversation type taxonomy
    "conversation_types": type_taxonomy,

    # F: Cross-topic bridges
    "bridges": {
        "count": len(bridges),
        "top_pairs": top_bridge_pairs,
        "sample_bridges": sorted(bridges, key=lambda x: -x["turns"])[:30],
    },

    # G: Personal layer
    "personal": personal_analysis,

    # H + I: Recurring threads with evolution
    "recurring_threads": threads[:30],
    "thread_stats": {
        "total": len(threads),
        "open": sum(1 for t in threads if t["is_open"]),
        "deepening": sum(1 for t in threads if t["trend"] == "deepening"),
        "stable": sum(1 for t in threads if t["trend"] == "stable"),
        "fading": sum(1 for t in threads if t["trend"] == "fading"),
    },

    # J: Voice analysis
    "voice": voice_stats,

    # K: Meta-cognitive
    "meta_cognitive": {
        "conversation_starters": conversation_starters,
        "emotional_taxonomy": emotional_taxonomy,
        "hidden_patterns": hidden_patterns,
        "recurring_questions": recurring_questions,
    },
}

with open(f"{OUT_DIR}/insights.json", "w") as f:
    json.dump(insights, f, separators=(",", ":"))

size_kb = len(json.dumps(insights)) // 1024
print(f"\n  Wrote insights.json ({size_kb} KB)")
print(f"  - {N_TOPICS} topic depth profiles")
print(f"  - Top obsession: {insights['obsession_scores'][0]['label']} (score: {insights['obsession_scores'][0]['obsession_score']})")
print(f"  - Fingerprint: {fingerprint}")
print(f"  - {len(books)} reading conversations")
print(f"  - {len(bridges)} cross-topic bridges")
print(f"  - {len(threads)} recurring threads ({sum(1 for t in threads if t['is_open'])} still open)")
print(f"  - Voice: {voice_stats['user_written_pct']}% user-written, {voice_stats['ai_pasted_pct']}% AI-pasted")
print(f"  - {len(recurring_questions)} recurring question patterns")
emo_summary = ', '.join(f'{e["intent"]}={e["pct"]}%' for e in emotional_taxonomy[:4])
print(f"  - Emotional: {emo_summary}")
print("\n✓ Insights analysis complete.")
