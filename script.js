const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const localStorageKey = "xjq-myb-love-diary";
const canUseSharedApi = location.protocol !== "file:";
const apiCandidates = ["/.netlify/functions/entries", "/api/entries"];
const diaryForm = document.querySelector("#diaryForm");
const entryId = document.querySelector("#entryId");
const entryDate = document.querySelector("#entryDate");
const entryMood = document.querySelector("#entryMood");
const entryTitle = document.querySelector("#entryTitle");
const entryBody = document.querySelector("#entryBody");
const saveEntry = document.querySelector("#saveEntry");
const cancelEdit = document.querySelector("#cancelEdit");
const entrySearch = document.querySelector("#entrySearch");
const entryCount = document.querySelector("#entryCount");
const diaryList = document.querySelector("#diaryList");

const text = {
  save: "\u4fdd\u5b58\u8bb0\u5f55",
  update: "\u66f4\u65b0\u8bb0\u5f55",
  edit: "\u7f16\u8f91",
  remove: "\u5220\u9664",
  noDate: "\u672a\u5199\u65e5\u671f",
  noResult: "\u6ca1\u6709\u627e\u5230\u76f8\u5173\u8bb0\u5f55\u3002",
  empty: "\u8fd8\u6ca1\u6709\u8bb0\u5f55\uff0c\u7b2c\u4e00\u4ef6\u5c0f\u4e8b\u5c31\u4ece\u4eca\u5929\u5f00\u59cb\u3002",
  sharedOff:
    "\u5f53\u524d\u662f\u672c\u5730\u6587\u4ef6\u6253\u5f00\uff0c\u8bb0\u5f55\u53ea\u80fd\u81ea\u5df1\u770b\u89c1\u3002\u7528 server.js \u6216\u90e8\u7f72\u540e\u7684\u7f51\u5740\u6253\u5f00\uff0c\u624d\u80fd\u5171\u4eab\u4fdd\u5b58\u3002",
  sharedOn: "\u5f53\u524d\u4f7f\u7528\u5171\u4eab\u5c0f\u4e8b\u672c\uff0c\u4fdd\u5b58\u540e\u5176\u4ed6\u4eba\u6253\u5f00\u540c\u4e00\u4e2a\u7f51\u5740\u4e5f\u80fd\u770b\u89c1\u3002",
  sharedFallback:
    "\u6ca1\u6709\u8fde\u4e0a\u5171\u4eab\u670d\u52a1\uff0c\u6682\u65f6\u6539\u4e3a\u672c\u673a\u4fdd\u5b58\u3002\u8bf7\u68c0\u67e5\u540e\u7aef\u670d\u52a1\u662f\u5426\u5df2\u542f\u52a8\u3002"
};

let diaryEntries = [];
let usingSharedApi = false;
let statusNode;
let activeApiBase = null;

function todayValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalEntries() {
  try {
    return JSON.parse(localStorage.getItem(localStorageKey)) || [];
  } catch {
    return [];
  }
}

function writeLocalEntries() {
  localStorage.setItem(localStorageKey, JSON.stringify(diaryEntries));
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function apiPath(id) {
  if (!id) return activeApiBase;
  return `${activeApiBase}?id=${encodeURIComponent(id)}`;
}

async function loadEntries() {
  if (!canUseSharedApi) {
    usingSharedApi = false;
    diaryEntries = readLocalEntries();
    updateStorageStatus(text.sharedOff);
    return;
  }

  for (const candidate of apiCandidates) {
    try {
      activeApiBase = candidate;
      diaryEntries = await requestJson(apiPath());
      usingSharedApi = true;
      updateStorageStatus(text.sharedOn);
      return;
    } catch {
      activeApiBase = null;
    }
  }

  usingSharedApi = false;
  diaryEntries = readLocalEntries();
  updateStorageStatus(text.sharedFallback);
}

async function saveEntryToStore(draft) {
  if (!usingSharedApi) {
    if (entryId.value) {
      diaryEntries = diaryEntries.map((item) => (item.id === entryId.value ? draft : item));
    } else {
      diaryEntries = [draft, ...diaryEntries];
    }
    writeLocalEntries();
    return;
  }

  if (entryId.value) {
    await requestJson(apiPath(entryId.value), {
      method: "PUT",
      body: JSON.stringify(draft)
    });
  } else {
    await requestJson(apiPath(), {
      method: "POST",
      body: JSON.stringify(draft)
    });
  }

  diaryEntries = await requestJson(apiPath());
}

async function deleteEntryFromStore(id) {
  if (!usingSharedApi) {
    diaryEntries = diaryEntries.filter((entry) => entry.id !== id);
    writeLocalEntries();
    return;
  }

  await requestJson(apiPath(id), { method: "DELETE" });
  diaryEntries = await requestJson(apiPath());
}

function resetForm() {
  diaryForm.reset();
  entryId.value = "";
  entryDate.value = todayValue();
  saveEntry.textContent = text.save;
  cancelEdit.hidden = true;
}

function updateStorageStatus(message) {
  if (!statusNode) {
    statusNode = document.createElement("p");
    statusNode.className = "storage-status";
    diaryForm.insertAdjacentElement("beforebegin", statusNode);
  }
  statusNode.textContent = message;
  statusNode.dataset.mode = usingSharedApi ? "shared" : "local";
}

function formatDate(value) {
  if (!value) return text.noDate;
  return value.replaceAll("-", ".");
}

function filteredEntries() {
  const query = entrySearch.value.trim().toLowerCase();
  return diaryEntries
    .filter((item) => {
      if (!query) return true;
      return [item.title, item.body, item.mood, item.date].some((value) =>
        String(value).toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function createEntryNode(item) {
  const article = document.createElement("article");
  article.className = "entry-item";

  const meta = document.createElement("div");
  meta.className = "entry-meta";

  const date = document.createElement("span");
  date.textContent = formatDate(item.date);

  const mood = document.createElement("span");
  mood.className = "mood-pill";
  mood.textContent = item.mood;

  const title = document.createElement("h3");
  title.textContent = item.title;

  const body = document.createElement("p");
  body.textContent = item.body;

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = text.edit;
  editButton.addEventListener("click", () => editEntry(item.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = text.remove;
  deleteButton.addEventListener("click", () => deleteEntry(item.id));

  meta.append(date, mood);
  actions.append(editButton, deleteButton);
  article.append(meta, title, body, actions);
  return article;
}

function renderEntries() {
  const entries = filteredEntries();
  entryCount.textContent = diaryEntries.length;
  diaryList.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = entrySearch.value.trim() ? text.noResult : text.empty;
    diaryList.append(empty);
    return;
  }

  entries.forEach((item) => diaryList.append(createEntryNode(item)));
}

function editEntry(id) {
  const item = diaryEntries.find((entry) => entry.id === id);
  if (!item) return;

  entryId.value = item.id;
  entryDate.value = item.date;
  entryMood.value = item.mood;
  entryTitle.value = item.title;
  entryBody.value = item.body;
  saveEntry.textContent = text.update;
  cancelEdit.hidden = false;
  diaryForm.scrollIntoView({ behavior: "smooth", block: "center" });
  entryTitle.focus();
}

async function deleteEntry(id) {
  const item = diaryEntries.find((entry) => entry.id === id);
  if (!item) return;

  const confirmed = window.confirm(`\u5220\u9664\u201c${item.title}\u201d\u8fd9\u6761\u8bb0\u5f55\u5417\uff1f`);
  if (!confirmed) return;

  await deleteEntryFromStore(id);
  renderEntries();
  if (entryId.value === id) resetForm();
}

diaryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const current = diaryEntries.find((item) => item.id === entryId.value);
  const draft = {
    id: entryId.value || createId(),
    date: entryDate.value,
    mood: entryMood.value,
    title: entryTitle.value.trim(),
    body: entryBody.value.trim(),
    createdAt: current?.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  await saveEntryToStore(draft);
  resetForm();
  renderEntries();
});

cancelEdit.addEventListener("click", resetForm);
entrySearch.addEventListener("input", renderEntries);

resetForm();
loadEntries().then(renderEntries);
