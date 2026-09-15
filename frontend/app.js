// Circuit Networks — offline UI logic (vanilla JS, no external CDNs).
"use strict";

const state = { payload: null, downloadPrefix: "" };

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    const res = await fetch("/api/profiles");
    const profiles = await res.json();
    const sel = $("profile");
    sel.innerHTML = "";
    for (const p of profiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    if (profiles.length === 0) {
      const opt = document.createElement("option");
      opt.value = "default";
      opt.textContent = "Default Publisher";
      sel.appendChild(opt);
    }
  } catch (e) {
    console.warn("profiles unavailable", e);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text == null ? "" : text);
  return div.innerHTML;
}

function setStatus(msg, kind) {
  const el = $("status");
  el.textContent = msg;
  el.style.color = kind === "error" ? "var(--err)" : kind === "ok" ? "var(--ok)" : "var(--ink)";
}

$("process").addEventListener("click", async () => {
  const fileInput = $("file");
  const file = fileInput.files[0];
  if (!file) {
    setStatus("Please choose a .docx file.", "error");
    return;
  }
  const btn = $("process");
  btn.disabled = true;
  setStatus("Processing locally...");

  const form = new FormData();
  form.append("file", file);
  form.append("profile_id", $("profile").value);
  form.append("review_json", "[]");

  try {
    const res = await fetch("/api/process", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setStatus("Processing failed: " + (data.detail || res.statusText), "error");
      return;
    }
    state.payload = data.payload;
    renderResults(data);
    setStatus("Complete. Integrity: " + data.integrity_status, "ok");
  } catch (e) {
    setStatus("Request failed: " + e.message, "error");
  } finally {
    btn.disabled = false;
  }
});

function renderResults(data) {
  const payload = data.payload;
  const integrity = payload.integrity;
  const ok = integrity.status === "pass";

  const badge = document.createElement("span");
  badge.className = "badge " + (ok ? "pass" : "fail");
  badge.textContent = ok ? "INTEGRITY PASS" : "INTEGRITY FAIL";
  $("integrity").innerHTML = "";
  $("integrity").appendChild(badge);
  $("integrity").append(
    document.createTextNode(
      `  ${integrity.source_paragraphs} paragraphs, ${integrity.source_words} words, ${integrity.source_chars} chars.`
    )
  );
  $("integrity").classList.remove("hidden");

  const base = payload.source.path.split(/[\\/]/).pop().replace(/\.docx$/i, "");
  const dl = $("downloads");
  dl.innerHTML = "";
  dl.classList.remove("hidden");
  for (const [kind, urlPath] of [
    ["Publication DOCX", data.output_docx],
    ["Audit JSON", data.audit_json],
    ["Audit HTML", data.audit_html],
  ]) {
    const a = document.createElement("a");
    a.href = "/api/download/" + encodeURIComponent(urlPath.split(/[\\/]/).pop());
    a.textContent = "Download " + kind;
    a.style.marginRight = "12px";
    dl.appendChild(a);
  }

  renderStructure(payload.structure_outline);
  renderIssues(payload.preflight_issues);
  renderReview(payload.review.items);
  renderClassifications(payload.classifications);
}

function renderStructure(outline) {
  $("structureCard").classList.remove("hidden");
  const tbody = $("structureTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const o of outline) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = "  ".repeat(o.depth) + (o.text || "");
    tr.appendChild(name);
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: o.element_type }));
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: o.confidence.toFixed(2) }));
    tbody.appendChild(tr);
  }
  if (!outline.length) {
    tbody.innerHTML = '<tr><td colspan="3">No headings detected.</td></tr>';
  }
}

function renderIssues(issues) {
  $("issuesCard").classList.remove("hidden");
  const tbody = $("issuesTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const i of issues) {
    const tr = document.createElement("tr");
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: i.code }));
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: i.severity }));
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: i.message }));
    tbody.appendChild(tr);
  }
  if (!issues.length) {
    tbody.innerHTML = '<tr><td colspan="3">No issues.</td></tr>';
  }
}

function renderReview(items) {
  $("reviewCard").classList.remove("hidden");
  const tbody = $("reviewTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const r of items) {
    const tr = document.createElement("tr");
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: r.source_index }));
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: r.element_type }));
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: r.confidence.toFixed(2) }));
    tr.appendChild(Object.assign(document.createElement("td"), { textContent: r.text || "" }));
    tbody.appendChild(tr);
  }
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="4">No review items.</td></tr>';
  }
}

function renderClassifications(classifications) {
  const headings = classifications.filter(c => ["title","chapter","section","subsection","subsubsection"].includes(c.element_type));
  $("classCard").classList.remove("hidden");
  $("classPre").textContent = headings.length
    ? JSON.stringify(headings.slice(0, 50), null, 2)
    : "No headings classified.";
}

init();