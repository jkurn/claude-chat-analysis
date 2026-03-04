"""
01_preprocess.py - Descriptive Analytics & Behavioral Lens
Generates stats, timeline, activity patterns, and conversation metadata.
"""

import json
import re
from datetime import datetime, timezone
from collections import defaultdict, Counter
import math

DATA_DIR = "/Users/jonathankurniawan/Documents/Claude Cowork/claude-chat-analysis"
OUT_DIR = f"{DATA_DIR}/web/data"

print("Loading conversations...")
with open(f"{DATA_DIR}/conversations.json", "r") as f:
    conversations = json.load(f)

with open(f"{DATA_DIR}/projects.json", "r") as f:
    projects = json.load(f)

print(f"Loaded {len(conversations)} conversations, {len(projects)} projects")

# ─── Parse & enrich conversations ─────────────────────────────────────────────

def parse_dt(s):
    s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)

conv_meta = []
daily = defaultdict(lambda: {"human": 0, "assistant": 0, "convs": 0, "chars": 0})
hourly = defaultdict(int)
weekday = defaultdict(int)
msg_lengths_human = []
msg_lengths_assistant = []
conv_turn_counts = []

for conv in conversations:
    created = parse_dt(conv["created_at"])
    updated = parse_dt(conv["updated_at"])
    msgs = conv.get("chat_messages", [])

    # message-level
    h_count = 0
    a_count = 0
    h_chars = 0
    a_chars = 0
    has_code = False
    has_attach = False
    all_text = []

    for msg in msgs:
        sender = msg.get("sender", "")
        text = msg.get("text", "") or ""
        ch = len(text)
        if sender == "human":
            h_count += 1
            h_chars += ch
            msg_lengths_human.append(ch)
        elif sender == "assistant":
            a_count += 1
            a_chars += ch
            msg_lengths_assistant.append(ch)
            # detect code blocks
            if "```" in text:
                has_code = True
        if msg.get("attachments") or msg.get("files"):
            has_attach = True
        all_text.append(text)

    day_key = created.strftime("%Y-%m-%d")
    daily[day_key]["human"] += h_count
    daily[day_key]["assistant"] += a_count
    daily[day_key]["convs"] += 1
    daily[day_key]["chars"] += h_chars + a_chars

    hourly[created.hour] += 1
    weekday[created.weekday()] += 1  # 0=Mon
    conv_turn_counts.append(h_count + a_count)

    # extract first ~300 chars of first human message as preview
    preview = ""
    for msg in msgs:
        if msg.get("sender") == "human":
            preview = (msg.get("text") or "")[:300].strip()
            break

    # duration in minutes
    duration_min = max(0, (updated - created).total_seconds() / 60)

    conv_meta.append({
        "uuid": conv["uuid"],
        "name": conv.get("name", "")[:120],
        "preview": preview,
        "created_at": conv["created_at"],
        "created_ts": created.timestamp(),
        "day": day_key,
        "hour": created.hour,
        "weekday": created.weekday(),
        "month": created.strftime("%Y-%m"),
        "year": created.year,
        "h_count": h_count,
        "a_count": a_count,
        "total_msgs": h_count + a_count,
        "h_chars": h_chars,
        "a_chars": a_chars,
        "has_code": has_code,
        "has_attach": has_attach,
        "duration_min": round(duration_min, 1),
    })

# ─── Aggregate stats ───────────────────────────────────────────────────────────

total_convs = len(conv_meta)
total_msgs = sum(c["total_msgs"] for c in conv_meta)
total_h = sum(c["h_count"] for c in conv_meta)
total_a = sum(c["a_count"] for c in conv_meta)
total_h_chars = sum(c["h_chars"] for c in conv_meta)
total_a_chars = sum(c["a_chars"] for c in conv_meta)
convs_with_code = sum(1 for c in conv_meta if c["has_code"])
convs_with_attach = sum(1 for c in conv_meta if c["has_attach"])

dates = sorted(daily.keys())
first_date = dates[0]
last_date = dates[-1]
active_days = len(daily)

# approximate total words
total_words = (total_h_chars + total_a_chars) // 5

# avg per conversation
avg_turns = total_msgs / total_convs if total_convs else 0

def percentile(lst, p):
    if not lst:
        return 0
    s = sorted(lst)
    idx = int(len(s) * p / 100)
    return s[min(idx, len(s)-1)]

stats = {
    "total_convs": total_convs,
    "total_msgs": total_msgs,
    "total_human_msgs": total_h,
    "total_assistant_msgs": total_a,
    "total_human_chars": total_h_chars,
    "total_assistant_chars": total_a_chars,
    "total_words_approx": total_words,
    "total_projects": len(projects),
    "convs_with_code": convs_with_code,
    "convs_with_attachments": convs_with_attach,
    "avg_turns_per_conv": round(avg_turns, 1),
    "avg_human_msg_len": round(sum(msg_lengths_human)/len(msg_lengths_human)) if msg_lengths_human else 0,
    "avg_assistant_msg_len": round(sum(msg_lengths_assistant)/len(msg_lengths_assistant)) if msg_lengths_assistant else 0,
    "max_turns": max(conv_turn_counts) if conv_turn_counts else 0,
    "first_date": first_date,
    "last_date": last_date,
    "active_days": active_days,
    "p50_turns": percentile(conv_turn_counts, 50),
    "p90_turns": percentile(conv_turn_counts, 90),
    "p95_turns": percentile(conv_turn_counts, 95),
}

print("Stats:", json.dumps(stats, indent=2))

# ─── Timeline: daily activity ──────────────────────────────────────────────────

# Build a full calendar from first to last date
from datetime import timedelta
start = datetime.strptime(first_date, "%Y-%m-%d")
end = datetime.strptime(last_date, "%Y-%m-%d")
timeline = []
cur = start
while cur <= end:
    key = cur.strftime("%Y-%m-%d")
    d = daily.get(key, {"human": 0, "assistant": 0, "convs": 0, "chars": 0})
    timeline.append({
        "date": key,
        "convs": d["convs"],
        "msgs": d["human"] + d["assistant"],
        "chars": d["chars"],
    })
    cur += timedelta(days=1)

# Monthly aggregation
monthly = defaultdict(lambda: {"convs": 0, "msgs": 0, "chars": 0})
for d in timeline:
    month = d["date"][:7]
    monthly[month]["convs"] += d["convs"]
    monthly[month]["msgs"] += d["msgs"]
    monthly[month]["chars"] += d["chars"]

monthly_series = [
    {"month": k, **v}
    for k, v in sorted(monthly.items())
]

# ─── Hourly / weekday heatmap ──────────────────────────────────────────────────

hour_data = [{"hour": h, "count": hourly[h]} for h in range(24)]
weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
weekday_data = [{"day": weekday_names[d], "idx": d, "count": weekday[d]} for d in range(7)]

# Hour × Weekday matrix for heatmap
heatmap = defaultdict(int)
for conv in conv_meta:
    heatmap[(conv["weekday"], conv["hour"])] += 1

heatmap_data = [
    {"weekday": wd, "hour": hr, "count": heatmap[(wd, hr)]}
    for wd in range(7) for hr in range(24)
]

# ─── Turn count distribution ───────────────────────────────────────────────────

turn_dist = Counter(conv_turn_counts)
turn_dist_data = [{"turns": k, "count": v} for k, v in sorted(turn_dist.items())]

# Message length distribution (binned)
def bin_lengths(lengths, bins=40):
    if not lengths:
        return []
    max_val = min(max(lengths), 8000)  # cap at 8k chars
    bin_size = max_val // bins
    if bin_size == 0:
        bin_size = 1
    counts = defaultdict(int)
    for l in lengths:
        b = min(l // bin_size, bins - 1)
        counts[b] += 1
    return [{"bin_start": b * bin_size, "count": counts[b]} for b in range(bins)]

msg_len_human = bin_lengths(msg_lengths_human)
msg_len_assistant = bin_lengths(msg_lengths_assistant)

# ─── Top conversations by length ───────────────────────────────────────────────

top_convs = sorted(conv_meta, key=lambda x: x["total_msgs"], reverse=True)[:50]
# Only keep fields needed for display
top_convs_slim = [
    {k: c[k] for k in ["uuid", "name", "preview", "created_at", "total_msgs", "h_chars", "a_chars", "has_code", "duration_min"]}
    for c in top_convs
]

# ─── Projects analysis ─────────────────────────────────────────────────────────

projects_data = []
for p in projects:
    doc_count = len(p.get("docs", []))
    prompt_len = len(p.get("prompt_template", "") or "")
    projects_data.append({
        "uuid": p["uuid"],
        "name": p.get("name", "")[:80],
        "description": (p.get("description", "") or "")[:200],
        "created_at": p.get("created_at", ""),
        "doc_count": doc_count,
        "prompt_len": prompt_len,
        "is_private": p.get("is_private", True),
    })

# ─── Write outputs ─────────────────────────────────────────────────────────────

outputs = {
    "stats.json": stats,
    "timeline.json": {"daily": timeline, "monthly": monthly_series},
    "activity.json": {
        "hourly": hour_data,
        "weekday": weekday_data,
        "heatmap": heatmap_data,
    },
    "distributions.json": {
        "turn_distribution": turn_dist_data,
        "msg_len_human": msg_len_human,
        "msg_len_assistant": msg_len_assistant,
    },
    "conversations_meta.json": conv_meta,
    "top_conversations.json": top_convs_slim,
    "projects_data.json": projects_data,
}

for fname, data in outputs.items():
    path = f"{OUT_DIR}/{fname}"
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size_kb = len(json.dumps(data)) // 1024
    print(f"  Wrote {fname} ({size_kb} KB)")

print("\n✓ Preprocessing complete.")
