import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});


const PORT = process.env.PORT || 5174;

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing env var: ${name}`);
  }
}

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

/**
 * MOVIES (TMDB)
 * GET /api/search/movies?q=batman
 */
app.get("/api/search/movies", async (req, res) => {
  try {
    requireEnv("TMDB_API_KEY");
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing query param q" });

    const url = new URL("https://api.themoviedb.org/3/search/movie");
    url.searchParams.set("query", q);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", "1");
    url.searchParams.set("api_key", process.env.TMDB_API_KEY);

    const r = await fetch(url);
    const data = await r.json();

    // Normalize to common shape
    const items = (data.results || []).slice(0, 20).map((m) => ({
      id: m.id,
      type: "movie",
      title: m.title,
      subtitle: m.release_date ? `(${m.release_date.slice(0, 4)})` : "",
      image: m.poster_path
        ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
        : "",
      raw: m
    }));

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * BOOKS (Google Books)
 * GET /api/search/books?q=harry%20potter
 */
app.get("/api/search/books", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing query param q" });

    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", q);
    url.searchParams.set("maxResults", "20");

    // Key is optional for Google Books for many use cases, but include if you have one
    if (process.env.GOOGLE_BOOKS_API_KEY) {
      url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
    }

    const r = await fetch(url);
    const data = await r.json();

    const items = (data.items || []).slice(0, 20).map((b) => {
      const info = b.volumeInfo || {};
      const thumb =
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        "";
      return {
        id: b.id,
        type: "book",
        title: info.title || "Untitled",
        subtitle: info.authors?.length ? info.authors.join(", ") : "",
        image: thumb,
        raw: b
      };
    });

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * ALBUMS (Discogs)
 * GET /api/search/albums?q=daft%20punk
 *
 * Discogs search returns many types; we filter to "release" + "master" and label as album.
 */
app.get("/api/search/albums", async (req, res) => {
  try {
    requireEnv("DISCOGS_TOKEN");
    requireEnv("DISCOGS_USER_AGENT");

    const q = (req.query.q || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing query param q" });

    const url = new URL("https://api.discogs.com/database/search");
    url.searchParams.set("q", q);
    url.searchParams.set("per_page", "20");
    url.searchParams.set("page", "1");

    // Better defaults for "albums"
    url.searchParams.set("type", "master");     // master = album-ish canonical entry
    url.searchParams.set("format", "album");    // helps remove singles/compilations

    const r = await fetch(url, {
      headers: {
        "User-Agent": process.env.DISCOGS_USER_AGENT,
        "Authorization": `Discogs token=${process.env.DISCOGS_TOKEN}`
      }
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!r.ok) {
      console.error("Discogs error:", r.status, data);
      return res.status(r.status).json({
        error: "Discogs request failed",
        status: r.status,
        details: data
      });
    }

    const items = (data.results || []).slice(0, 20).map((a) => ({
      id: a.id,
      type: "album",
      title: a.title || "Untitled",
      subtitle: a.year ? `(${a.year})` : (a.format?.[0] || ""),
      image: a.cover_image || "",
      raw: a
    }));

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
