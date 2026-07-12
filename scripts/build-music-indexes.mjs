/**
 * Build static search indexes for free-score discovery.
 *
 * Usage: node scripts/build-music-indexes.mjs
 *
 * Fetches OpenScore TSVs + GitHub tree (for .mxl presence) + Mutopia
 * musiccache.dat and writes JSON under lib/music-indexes/.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "lib", "music-indexes");

/** Lieder MXL lives on main (not the older v3.0.0 tag). */
const LIEDER_REF = "main";
const QUARTETS_REF = "main";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "CogNote-index-builder/1.0 (studio sheet music)" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "CogNote-index-builder/1.0 (studio sheet music)",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function composerFromPath(path) {
  const folder = path.split("/")[0] ?? "";
  return folder.replace(/_/g, " ").trim();
}

function encodeGithubPath(path) {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/**
 * Map score id → relative path under scores/…/lc{id}.mxl from the git tree.
 */
async function loadOpenScoreMxlPaths(repo, ref, idPrefix) {
  const tree = await fetchJson(
    `https://api.github.com/repos/OpenScore/${repo}/git/trees/${ref}?recursive=1`
  );
  if (tree.truncated) {
    console.warn(`Warning: ${repo} tree truncated — MXL map may be incomplete`);
  }
  const byId = new Map();
  const re = new RegExp(`/${idPrefix}(\\d+)\\.mxl$`, "i");
  for (const entry of tree.tree ?? []) {
    if (entry.type !== "blob" || !entry.path?.endsWith(".mxl")) continue;
    const m = entry.path.match(re);
    if (!m) continue;
    // path like scores/Composer/_/Song/lc123.mxl → scores-relative dir
    const dir = entry.path.replace(/\/[^/]+\.mxl$/i, "");
    byId.set(m[1], dir);
  }
  return byId;
}

function buildOpenScore(rows, source, idPrefix, repo, ref, mxlById) {
  return rows.map((row) => {
    const composer = composerFromPath(row.path);
    const mxlDir = mxlById.get(String(row.id));
    const hasMxl = Boolean(mxlDir);
    const file_url = hasMxl
      ? `https://raw.githubusercontent.com/OpenScore/${repo}/${ref}/${encodeGithubPath(mxlDir)}/${idPrefix}${row.id}.mxl`
      : null;

    return {
      id: `${source}:${row.id}`,
      source,
      title: row.name || "Untitled",
      composer,
      format: hasMxl ? "mxl" : "external",
      license_code: "cc0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
      source_url: row.link,
      github_url: hasMxl
        ? `https://github.com/OpenScore/${repo}/blob/${ref}/${encodeGithubPath(mxlDir)}/${idPrefix}${row.id}.mxl`
        : `https://github.com/OpenScore/${repo}/tree/${ref}/scores/${encodeGithubPath(row.path)}`,
      file_url,
      import_allowed: hasMxl,
      attribution: `OpenScore (${source === "openscore-lieder" ? "Lieder" : "String Quartets"}) — CC0. Credit appreciated.`,
      instrument:
        source === "openscore-lieder" ? "Voice, Piano" : "String Quartet",
      external_only: !hasMxl,
      path: row.path,
      score_id: row.id,
      id_prefix: idPrefix,
    };
  });
}

function mapMutopiaLicense(copyright) {
  const c = (copyright || "").trim();
  if (c === "Public Domain") {
    return {
      license_code: "public_domain",
      import_allowed: true,
      license_url: null,
    };
  }
  if (/^Creative Commons Attribution( \d\.\d)?$/i.test(c)) {
    return {
      license_code: "cc_by",
      import_allowed: true,
      license_url: "https://creativecommons.org/licenses/by/4.0/",
    };
  }
  if (/Attribution-ShareAlike/i.test(c)) {
    return {
      license_code: "cc_by_sa",
      import_allowed: false,
      license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
    };
  }
  return {
    license_code: "unknown",
    import_allowed: false,
    license_url: null,
  };
}

function parseMutopiaCache(text) {
  const parts = text.split("**********").slice(1);
  const items = [];

  for (const part of parts) {
    const lines = part.replace(/^\r?\n/, "").split(/\r?\n/);
    while (lines.length < 32) lines.push("");

    const idno = lines[0]?.trim();
    if (!/^\d+$/.test(idno)) continue;

    const composerDir = lines[1]?.trim().replace(/\/$/, "") ?? "";
    const musicnm = lines[2]?.trim() ?? "";
    const a4pdf = lines[6]?.trim() ?? "";
    const title = lines[12]?.trim() ?? "";
    const composer = lines[13]?.trim() ?? "";
    const instrument = lines[16]?.trim() ?? "";
    const style = lines[18]?.trim() ?? "";
    const arranger = lines[20]?.trim() ?? "";
    const copyright = lines[22]?.trim() ?? "";
    const mutopiaId = lines[23]?.trim() ?? "";

    if (!title || !a4pdf || !composerDir || !musicnm) continue;

    const midrif = `${composerDir}/${musicnm}`;
    const license = mapMutopiaLicense(copyright);
    const isPdf = a4pdf.toLowerCase().endsWith(".pdf");
    const file_url = `https://www.mutopiaproject.org/ftp/${midrif}/${a4pdf}`;
    const source_url = `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${idno}`;
    const import_allowed = license.import_allowed && isPdf;

    items.push({
      id: `mutopia:${idno}`,
      source: "mutopia",
      title,
      composer,
      arranger: arranger.replace(/^arr\.\s*/i, ""),
      format: isPdf ? "pdf" : "external",
      license_code: license.license_code,
      license_url: license.license_url,
      source_url,
      file_url: isPdf ? file_url : null,
      import_allowed,
      attribution:
        license.license_code === "cc_by"
          ? `Mutopia Project piece ${mutopiaId || idno}. ${copyright}.`
          : `Mutopia Project piece ${mutopiaId || idno}.`,
      instrument,
      style: style || undefined,
      external_only: !import_allowed,
      mutopia_id: mutopiaId,
      copyright_raw: copyright,
    });
  }

  return items;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching OpenScore Lieder MXL tree…");
  const liederMxl = await loadOpenScoreMxlPaths("Lieder", LIEDER_REF, "lc");
  console.log(`  ${liederMxl.size} MXL files`);

  console.log("Fetching OpenScore Lieder scores.tsv…");
  const liederTsv = await fetchText(
    `https://raw.githubusercontent.com/OpenScore/Lieder/${LIEDER_REF}/data/scores.tsv`
  );
  const lieder = buildOpenScore(
    parseTsv(liederTsv),
    "openscore-lieder",
    "lc",
    "Lieder",
    LIEDER_REF,
    liederMxl
  );

  console.log("Fetching OpenScore String Quartets MXL tree…");
  const quartetsMxl = await loadOpenScoreMxlPaths(
    "StringQuartets",
    QUARTETS_REF,
    "sq"
  );
  console.log(`  ${quartetsMxl.size} MXL files`);

  console.log("Fetching OpenScore String Quartets scores.tsv…");
  const quartetsTsv = await fetchText(
    `https://raw.githubusercontent.com/OpenScore/StringQuartets/${QUARTETS_REF}/data/scores.tsv`
  );
  const quartets = buildOpenScore(
    parseTsv(quartetsTsv),
    "openscore-quartets",
    "sq",
    "StringQuartets",
    QUARTETS_REF,
    quartetsMxl
  );

  console.log("Fetching Mutopia musiccache.dat…");
  const cache = await fetchText(
    "https://www.mutopiaproject.org/datafiles/musiccache.dat"
  );
  const mutopia = parseMutopiaCache(cache);

  const meta = {
    built_at: new Date().toISOString(),
    openscore_lieder_ref: LIEDER_REF,
    openscore_quartets_ref: QUARTETS_REF,
    mutopia_cache_sha256: createHash("sha256").update(cache).digest("hex"),
    counts: {
      openscore_lieder: lieder.length,
      openscore_lieder_importable: lieder.filter((r) => r.import_allowed).length,
      openscore_quartets: quartets.length,
      openscore_quartets_importable: quartets.filter((r) => r.import_allowed)
        .length,
      mutopia: mutopia.length,
      mutopia_importable: mutopia.filter((m) => m.import_allowed).length,
    },
  };

  await writeFile(
    join(OUT_DIR, "openscore-lieder.json"),
    JSON.stringify(lieder)
  );
  await writeFile(
    join(OUT_DIR, "openscore-quartets.json"),
    JSON.stringify(quartets)
  );
  await writeFile(join(OUT_DIR, "mutopia.json"), JSON.stringify(mutopia));
  await writeFile(join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));

  console.log("Wrote indexes:", meta.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
