const API = "/api";

export async function fetchProfiles() {
  const res = await fetch(`${API}/profiles`);
  if (!res.ok) throw new Error("Unable to load publisher profiles");
  return res.json();
}

export async function processDocument({ file, profileId, reviews = [], signal }) {
  const form = new FormData();
  form.append("file", file);
  form.append("profile_id", profileId);
  form.append("review_json", JSON.stringify(reviews));
  const res = await fetch(`${API}/process`, { method: "POST", body: form, signal });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Processing failed (HTTP ${res.status})`);
  }
  return data;
}

export async function processBatch({ files, profileId, signal }) {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  form.append("profile_id", profileId);
  const res = await fetch(`${API}/process-batch`, { method: "POST", body: form, signal });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Batch processing failed (HTTP ${res.status})`);
  }
  return data;
}