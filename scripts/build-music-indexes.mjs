/**
 * Build static search indexes for Phase 5B source discovery.
 *
 * Usage: node scripts/build-music-indexes.mjs
 *
 * Fetches OpenScore TSVs + Mutopia musiccache.dat and writes JSON under
 * lib/music-indexes/. Commit the output so runtime search needs no network
 * for Mutopia/OpenScore (IMSLP stays live).
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "lib", "music-indexes");

const LIEDER_TAG = "v3.0.0";
const QUARTETS_REF = "main";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "CogNote-index-builder/1.0 (studio sheet music)" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.text();
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
  return folder.replace(/_/g, " ").replace(/,/g, ",").trim();
}

function buildOpenScore(rows, source, idPrefix) {
  return rows.map((row) => {
    const composer = composerFromPath(row.path);
    return {
      id: `${source}:${row.id}`,
      source,
      title: row.name || "Untitled",
      composer,
      format: "external",
      license_code: "cc0",
      license_url: "https://creativecommons.org/publicdomain/zero/1.0/",
      source_url: row.link,
      file_url: null,
      import_allowed: false,
      attribution: `OpenScore (${source === "openscore-lieder" ? "Lieder" : "String Quartets"}) — CC0. Credit appreciated.`,
      instrument:
        source === "openscore-lieder" ? "Voice, Piano" : "String Quartet",
      external_only: true,
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
    // Pad so short records don't throw
    while (lines.length < 32) lines.push("");

    const idno = lines[0]?.trim();
    if (!/^\d+$/.test(idno)) continue;

    const composerDir = lines[1]?.trim().replace(/\/$/, "") ?? "";
    const musicnm = lines[2]?.trim() ?? "";
    const a4pdf = lines[6]?.trim() ?? "";
    const title = lines[12]?.trim() ?? "";
    const composer = lines[13]?.trim() ?? "";
    const instrument = lines[16]?.trim() ?? "";
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
      external_only: !import_allowed,
      mutopia_id: mutopiaId,
      copyright_raw: copyright,
    });
  }

  return items;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching OpenScore Lieder scores.tsv…");
  const liederTsv = await fetchText(
    `https://raw.githubusercontent.com/OpenScore/Lieder/${LIEDER_TAG}/data/scores.tsv`
  );
  const lieder = buildOpenScore(parseTsv(liederTsv), "openscore-lieder", "lc");

  console.log("Fetching OpenScore String Quartets scores.tsv…");
  const quartetsTsv = await fetchText(
    `https://raw.githubusercontent.com/OpenScore/StringQuartets/${QUARTETS_REF}/data/scores.tsv`
  );
  const quartets = buildOpenScore(
    parseTsv(quartetsTsv),
    "openscore-quartets",
    "sq"
  );

  console.log("Fetching Mutopia musiccache.dat…");
  const cache = await fetchText(
    "https://www.mutopiaproject.org/datafiles/musiccache.dat"
  );
  const mutopia = parseMutopiaCache(cache);
  const mutopiaImportable = mutopia.filter((m) => m.import_allowed).length;

  const meta = {
    built_at: new Date().toISOString(),
    openscore_lieder_tag: LIEDER_TAG,
    openscore_quartets_ref: QUARTETS_REF,
    mutopia_cache_sha256: createHash("sha256").update(cache).digest("hex"),
    counts: {
      openscore_lieder: lieder.length,
      openscore_quartets: quartets.length,
      mutopia: mutopia.length,
      mutopia_importable: mutopiaImportable,
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
