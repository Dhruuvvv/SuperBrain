import os
import sys
import json
import urllib.request
import urllib.parse
from dotenv import load_dotenv

# Ensure the root directory and ai_server are on the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append(os.path.abspath("."))

from ai_server.services.embedding_service import load_embedder, generate_embedding, build_structured_document

# Load env variables from multiple potential locations
env_locations = [
    ".env",
    "server/.env",
    "ai_server/.env",
    os.path.join(os.path.dirname(__file__), "..", "server", ".env"),
    os.path.join(os.path.dirname(__file__), "..", "ai_server", ".env"),
]
for loc in env_locations:
    if os.path.exists(loc):
        load_dotenv(loc)
        break

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment.")
    sys.exit(1)

# Normalise URL structure
SUPABASE_URL = SUPABASE_URL.rstrip('/')
STATE_FILE = "reindexed_reels.json"

def get_headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def make_request(url, method="GET", data=None):
    headers = get_headers()
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else []
    except Exception as e:
        print(f"❌ HTTP request to {url} failed: {e}")
        return None

def load_processed_ids():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
                return set(data.get("reindexed_ids", []))
        except Exception as e:
            print(f"⚠️ Failed to load state file: {e}. Starting fresh.")
    return set()

def save_processed_ids(processed_set):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({"reindexed_ids": list(processed_set)}, f, indent=2)
    except Exception as e:
        print(f"⚠️ Failed to save state file: {e}")

def main():
    print("==================================================")
    print("🚀 SuperBrain Embeddings Re-indexing Migration Script")
    print("==================================================")

    # 1. Load Sentence Transformer model
    print("⏳ Loading embedding model...")
    try:
        embedder = load_embedder()
    except Exception as e:
        print(f"❌ Failed to load embedding model: {e}")
        sys.exit(1)

    # 2. Fetch all metadata records
    print("⏳ Fetching reel_metadata records from Supabase...")
    metadata_url = f"{SUPABASE_URL}/rest/v1/reel_metadata?select=reel_id,title,summary,content_type,tags,mentioned_tools,extracted_urls,visual_description,resources"
    records = make_request(metadata_url)
    if records is None:
        print("❌ Could not retrieve records. Exiting.")
        sys.exit(1)

    print(f"✅ Retrieved {len(records)} metadata records.")

    # 3. Load transcripts to map transcripts
    print("⏳ Fetching transcripts from Supabase...")
    transcripts_url = f"{SUPABASE_URL}/rest/v1/transcripts?select=reel_id,plain_text"
    transcripts_data = make_request(transcripts_url)
    transcripts_map = {}
    if transcripts_data:
        for t in transcripts_data:
            transcripts_map[t["reel_id"]] = t.get("plain_text", "")
    print(f"✅ Mapped {len(transcripts_map)} transcripts.")

    # 4. Filter already processed records
    processed_ids = load_processed_ids()
    print(f"ℹ️ Found {len(processed_ids)} already re-indexed reels in {STATE_FILE}.")

    to_process = [r for r in records if r["reel_id"] not in processed_ids]
    print(f"🎯 Total reels remaining to process: {len(to_process)}")

    if not to_process:
        print("🎉 No migration needed. All reels are up to date!")
        return

    success_count = 0
    failure_count = 0

    # 5. Process loop
    for idx, record in enumerate(to_process):
        reel_id = record["reel_id"]
        title = record.get("title") or "Untitled Save"
        print(f"⏳ [{idx+1}/{len(to_process)}] Processing Reel ID {reel_id} ('{title}')...")

        # Map correct tags/tools format from list or JSON
        # Translate keys to match build_structured_document expected keys
        metadata_payload = {
            "title": record.get("title") or "",
            "content_type": record.get("content_type") or "",
            "tags": record.get("tags") or [],
            "mentioned_tools": record.get("mentioned_tools") or [],
            "resources": record.get("resources") or [],
            "extracted_urls": record.get("extracted_urls") or []
        }

        visual_desc = record.get("visual_description") or ""
        transcript = transcripts_map.get(reel_id, "")

        try:
            # Build structured document
            structured_doc = build_structured_document(
                metadata=metadata_payload,
                visual_desc=visual_desc,
                transcript=transcript
            )

            # Generate embedding
            embedding = generate_embedding(embedder, structured_doc)

            # Update database record
            update_url = f"{SUPABASE_URL}/rest/v1/reel_metadata?reel_id=eq.{reel_id}"
            update_data = {"embedding": json.dumps(embedding)}
            update_res = make_request(update_url, method="PATCH", data=update_data)

            if update_res is not None:
                # Mark as processed
                processed_ids.add(reel_id)
                save_processed_ids(processed_ids)
                success_count += 1
                print(f"  ✅ Successfully re-indexed and updated embedding.")
            else:
                failure_count += 1
                print(f"  ❌ Failed to update embedding in Supabase.")

        except Exception as err:
            failure_count += 1
            print(f"  ❌ Error processing Reel {reel_id}: {err}")

    print("==================================================")
    print("Migration Complete!")
    print(f"  - Successfully re-indexed: {success_count}")
    print(f"  - Failed: {failure_count}")
    print("==================================================")

if __name__ == "__main__":
    main()
