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

export async function applyEdits({ jobId, edits, message, setTitle }) {
  const res = await fetch(`${API}/apply-edits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      edits,
      message,
      ...(setTitle ? { set_title: setTitle } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Apply edits failed (HTTP ${res.status})`);
  }
  return data;
}

export async function fetchHistory(jobId) {
  const res = await fetch(`${API}/history/${encodeURIComponent(jobId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `History unavailable (HTTP ${res.status})`);
  }
  return data;
}

export async function openVelox(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/open`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Not a Circuit Networks .velox document (HTTP ${res.status})`);
  }
  return data;
}

export async function applyOpenEdits({ file, edits, message }) {
  const form = new FormData();
  form.append("file", file);
  form.append("edits_json", JSON.stringify(edits));
  form.append("message", message || "");
  const res = await fetch(`${API}/open-apply`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Restore failed (HTTP ${res.status})`);
  }
  return data;
}