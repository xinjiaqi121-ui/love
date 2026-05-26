import { getStore } from "@netlify/blobs";

const key = "entries";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(payload, status = 200) {
  return new Response(payload === null ? "" : JSON.stringify(payload), { status, headers });
}

function cleanEntry(entry, fallbackId) {
  const now = Date.now();
  return {
    id: String(entry.id || fallbackId),
    date: String(entry.date || "").slice(0, 10),
    mood: String(entry.mood || "平常").slice(0, 16),
    title: String(entry.title || "未命名小事").trim().slice(0, 32),
    body: String(entry.body || "").trim().slice(0, 600),
    createdAt: Number(entry.createdAt || now),
    updatedAt: Number(entry.updatedAt || now)
  };
}

async function readEntries(store) {
  return (await store.get(key, { type: "json", consistency: "strong" })) || [];
}

async function writeEntries(store, entries) {
  await store.setJSON(key, entries);
}

export default async (request) => {
  if (request.method === "OPTIONS") return json(null, 204);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const store = getStore({ name: "love-diary", consistency: "strong" });

  if (request.method === "GET") {
    return json(await readEntries(store));
  }

  if (request.method === "POST") {
    const payload = await request.json();
    const entries = await readEntries(store);
    const entry = cleanEntry(payload, `entry-${Date.now()}`);
    entries.unshift(entry);
    await writeEntries(store, entries);
    return json(entry, 201);
  }

  if (request.method === "PUT" && id) {
    const payload = await request.json();
    const entries = await readEntries(store);
    const index = entries.findIndex((item) => item.id === id);
    if (index === -1) return json({ error: "Not found" }, 404);
    entries[index] = cleanEntry({ ...entries[index], ...payload, id }, id);
    await writeEntries(store, entries);
    return json(entries[index]);
  }

  if (request.method === "DELETE" && id) {
    const entries = await readEntries(store);
    await writeEntries(
      store,
      entries.filter((item) => item.id !== id)
    );
    return json(null, 204);
  }

  return json({ error: "Not found" }, 404);
};
