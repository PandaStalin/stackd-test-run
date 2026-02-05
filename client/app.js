const API_BASE = "http://localhost:5174/api";

const els = {
  tabs: document.querySelectorAll(".tab"),
  viewSearch: document.querySelector("#view-search"),
  viewProfile: document.querySelector("#view-profile"),
  category: document.querySelector("#category"),
  query: document.querySelector("#query"),
  btnSearch: document.querySelector("#btnSearch"),
  status: document.querySelector("#status"),
  results: document.querySelector("#results"),
  favMovie: document.querySelector("#fav-movie"),
  favBook: document.querySelector("#fav-book"),
  favAlbum: document.querySelector("#fav-album"),
  btnClear: document.querySelector("#btnClear")
};

const STORAGE_KEY = "mediaStacks.favorites.v1";

function loadFavorites() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { movie: [], book: [], album: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      movie: Array.isArray(parsed.movie) ? parsed.movie : [],
      book: Array.isArray(parsed.book) ? parsed.book : [],
      album: Array.isArray(parsed.album) ? parsed.album : []
    };
  } catch {
    return { movie: [], book: [], album: [] };
  }
}

function saveFavorites(favs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function switchView(view) {
  const isSearch = view === "search";
  els.viewSearch.classList.toggle("hidden", !isSearch);
  els.viewProfile.classList.toggle("hidden", isSearch);

  els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === view));

  if (!isSearch) renderFavorites();
}

els.tabs.forEach((t) =>
  t.addEventListener("click", () => switchView(t.dataset.view))
);

function cardTemplate(item, { showAdd, showRemove }) {
  const img = item.image
    ? `<img src="${item.image}" alt="">`
    : `<div class="muted" style="padding:10px;text-align:center;">No image</div>`;

  return `
    <article class="item">
      <div class="thumb">${img}</div>
      <div class="content">
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="sub">${escapeHtml(item.subtitle || "")}</div>
        <div class="actions">
          ${showAdd ? `<button data-action="add" data-type="${item.type}" data-id="${item.id}">Add to Favorites</button>` : ""}
          ${showRemove ? `<button class="danger" data-action="remove" data-type="${item.type}" data-id="${item.id}">Remove</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mapCategoryToFavType(category) {
  if (category === "movies") return "movie";
  if (category === "books") return "book";
  return "album";
}

async function runSearch() {
  const category = els.category.value;
  const q = els.query.value.trim();
  if (!q) {
    setStatus("Type something to search.");
    return;
  }

  setStatus("Searching...");
  els.results.innerHTML = "";

  try {
    const r = await fetch(`${API_BASE}/search/${category}?q=${encodeURIComponent(q)}`);
    const data = await r.json();

    if (!r.ok) throw new Error(data.error || "Search failed.");

    const items = data.items || [];
    if (!items.length) {
      setStatus("No results.");
      return;
    }

    setStatus(`Showing ${items.length} result(s). Click “Add to Favorites”.`);

    els.results.innerHTML = items
      .map((item) => cardTemplate(item, { showAdd: true, showRemove: false }))
      .join("");

  } catch (e) {
    setStatus(e.message);
  }
}

els.btnSearch.addEventListener("click", runSearch);
els.query.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

els.results.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='add']");
  if (!btn) return;

  const id = btn.dataset.id;
  const type = btn.dataset.type;

  // Find item data from DOM card (simple approach: re-run from rendered HTML via a dataset would be better,
  // but we'll pull minimal values from the card for now.)
  const card = btn.closest(".item");
  const title = card.querySelector(".title")?.textContent || "";
  const subtitle = card.querySelector(".sub")?.textContent || "";
  const imgEl = card.querySelector("img");
  const image = imgEl ? imgEl.src : "";

  addFavorite({ id, type, title, subtitle, image });
});

function addFavorite(item) {
  const favs = loadFavorites();
  const key = item.type; // movie|book|album

  // prevent duplicates
  if (favs[key].some((x) => String(x.id) === String(item.id))) {
    setStatus("Already in favorites.");
    return;
  }

  if (favs[key].length >= 5) {
    setStatus(`You already have 5 ${key}s. Remove one first.`);
    return;
  }

  favs[key].push(item);
  saveFavorites(favs);
  setStatus(`Added to ${key} favorites.`);
}

function removeFavorite(type, id) {
  const favs = loadFavorites();
  favs[type] = favs[type].filter((x) => String(x.id) !== String(id));
  saveFavorites(favs);
  renderFavorites();
}

function renderFavorites() {
  const favs = loadFavorites();

  els.favMovie.innerHTML = favs.movie
    .map((item) => cardTemplate(item, { showAdd: false, showRemove: true }))
    .join("") || `<p class="muted">No movie favorites yet.</p>`;

  els.favBook.innerHTML = favs.book
    .map((item) => cardTemplate(item, { showAdd: false, showRemove: true }))
    .join("") || `<p class="muted">No book favorites yet.</p>`;

  els.favAlbum.innerHTML = favs.album
    .map((item) => cardTemplate(item, { showAdd: false, showRemove: true }))
    .join("") || `<p class="muted">No album favorites yet.</p>`;
}

els.viewProfile.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='remove']");
  if (!btn) return;
  removeFavorite(btn.dataset.type, btn.dataset.id);
});

els.btnClear.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderFavorites();
});

// default
switchView("search");
