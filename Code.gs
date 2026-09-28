/**
 * Google Apps Script for the existing spreadsheet.
 * Tabs: "Projekte" (Code, Titel, Klasse, Gruppen, Kriterien)
 *       "Bewertungen" (ProjektCode, Schüler, Zeit, Bewertung)
 *
 * The current teacher page works by link without login. Its API token is public
 * in teacher.js for compatibility with the deployed script. It is not security.
 */
const PROJECT_SHEET = "Projekte";
const RATING_SHEET = "Bewertungen";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Leere Anfrage.");
    const data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== "object") throw new Error("Ungültige Anfrage.");
    switch (data.action) {
      case "getProject": return json_(getProject_(data.code));
      case "getStudentRating": return json_({ exists: hasRating_(data.projektCode, data.schueler) });
      case "saveRating": return json_(saveRating_(data));
      case "getProjects": requireAdmin_(data); return json_(getProjects_());
      case "getResults": requireAdmin_(data); return json_(getResults_(data.code));
      case "getProjectStats": requireAdmin_(data); return json_(getProjectStats_(data.code));
      case "createProject": requireAdmin_(data); return json_(createProject_(data));
      case "deleteProject": requireAdmin_(data); return json_(deleteProject_(data.code));
      case "deleteRating": requireAdmin_(data); return json_(deleteRating_(data.projektCode, data.schueler));
      default: throw new Error("Unbekannte Aktion.");
    }
  } catch (error) {
    return json_({ success: false, code: error.code || "BAD_REQUEST", error: error.message || "Unbekannter Fehler." });
  }
}

function doGet() {
  return json_({ success: true, service: "Projektblick" });
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(message, code) {
  const error = new Error(message);
  error.code = code || "BAD_REQUEST";
  throw error;
}

function requireAdmin_(data) {
  const secret = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
  if (!secret || secret.length < 20) fail_("ADMIN_TOKEN muss zuerst in den Script Properties eingerichtet werden.", "AUTH_NOT_CONFIGURED");
  if (typeof data.adminToken !== "string" || data.adminToken !== secret) fail_("Lehrkraft-Schlüssel fehlt oder ist falsch.", "AUTH_REQUIRED");
}

function sheet_(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet && spreadsheet.getSheetByName(name);
  if (!sheet) fail_("Tabellenblatt „" + name + "“ fehlt.", "SHEET_MISSING");
  return sheet;
}

function rows_(name, columns) {
  const sheet = sheet_(name);
  const count = sheet.getLastRow() - 1;
  return count > 0 ? sheet.getRange(2, 1, count, columns).getValues() : [];
}

function projectCache_() {
  return CacheService.getScriptCache();
}

function clearProjectCache_() {
  projectCache_().remove("projects-v1");
}

function text_(value, max, label) {
  const result = String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  if (!result || result.length > max) fail_(label + " fehlt oder ist zu lang.");
  return result;
}

function cellText_(value) {
  // Prevent spreadsheet formula execution from user input.
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function code_(value) {
  const code = String(value == null ? "" : value).trim();
  if (!/^\d{4}$/.test(code)) fail_("Ungültiger Projektcode.");
  return code;
}

function names_(value, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) fail_(label + ": 1 bis 30 Einträge erforderlich.");
  const names = value.map(item => text_(item, 60, label));
  if (names.some(name => name.includes(","))) fail_(label + " dürfen keine Kommas enthalten.");
  if (new Set(names.map(name => name.toLocaleLowerCase("de"))).size !== names.length) fail_(label + " dürfen nicht doppelt vorkommen.");
  return names;
}

function getProject_(value) {
  const code = code_(value);
  const project = getProjects_().find(item => item.code === code);
  if (!project) return null;
  return {
    ...project,
    gruppen: project.gruppen.split(",").filter(Boolean),
    kriterien: project.kriterien.split(",").filter(Boolean)
  };
}

function getProjects_() {
  const cache = projectCache_();
  const cached = cache.get("projects-v1");
  if (cached) return JSON.parse(cached);
  const projects = rows_(PROJECT_SHEET, 5).filter(row => row[0] !== "").map(row => ({
    code: String(row[0]),
    titel: String(row[1]),
    klasse: String(row[2]),
    gruppen: String(row[3]),
    kriterien: String(row[4])
  }));
  try { cache.put("projects-v1", JSON.stringify(projects), 60); } catch (_) {}
  return projects;
}

function withLock_(operation) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return operation(); }
  finally { lock.releaseLock(); }
}

function createProject_(data) {
  const titel = text_(data.titel, 100, "Projekttitel");
  const klasse = text_(data.klasse, 40, "Klasse");
  const gruppen = names_(data.gruppen, "Gruppen");
  const kriterien = names_(data.kriterien, "Kriterien");
  return withLock_(() => {
    const existing = new Set(rows_(PROJECT_SHEET, 1).map(row => String(row[0])));
    let code;
    for (let i = 0; i < 100; i++) {
      code = String(Math.floor(1000 + Math.random() * 9000));
      if (!existing.has(code)) break;
      code = null;
    }
    if (!code) fail_("Zurzeit kann kein freier Projektcode erzeugt werden.");
    sheet_(PROJECT_SHEET).appendRow([code, cellText_(titel), cellText_(klasse), gruppen.map(cellText_).join(","), kriterien.map(cellText_).join(",")]);
    clearProjectCache_();
    return { success: true, code };
  });
}

function hasRating_(projectCode, student) {
  const code = code_(projectCode);
  const name = text_(student, 80, "Name").toLocaleLowerCase("de");
  return rows_(RATING_SHEET, 2).some(row => String(row[0]) === code && String(row[1]).toLocaleLowerCase("de") === name);
}

function saveRating_(data) {
  const code = code_(data.projektCode);
  const name = text_(data.schueler, 80, "Name");
  const project = getProject_(code);
  if (!project) fail_("Projekt nicht gefunden.");
  const rating = data.bewertung;
  if (!rating || typeof rating !== "object" || Array.isArray(rating)) fail_("Bewertung fehlt.");
  const expectedGroups = project.gruppen;
  const expectedCriteria = project.kriterien;
  if (Object.keys(rating).length !== expectedGroups.length) fail_("Bewertung enthält nicht alle Gruppen.");
  expectedGroups.forEach(group => {
    const values = Object.prototype.hasOwnProperty.call(rating, group) ? rating[group] : null;
    if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length !== expectedCriteria.length) fail_("Bewertung enthält nicht alle Kriterien.");
    expectedCriteria.forEach(criterion => {
      const score = Object.prototype.hasOwnProperty.call(values, criterion) ? values[criterion] : undefined;
      if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 10) fail_("Punkte müssen zwischen 0 und 10 liegen.");
    });
  });
  return withLock_(() => {
    if (hasRating_(code, name)) fail_("Für diesen Namen liegt bereits eine Bewertung vor.", "ALREADY_RATED");
    sheet_(RATING_SHEET).appendRow([code, cellText_(name), new Date(), JSON.stringify(rating)]);
    return { success: true };
  });
}

function getResults_(value) {
  const code = code_(value);
  return rows_(RATING_SHEET, 4).filter(row => String(row[0]) === code).map(row => {
    let rating = {};
    try { rating = JSON.parse(String(row[3])); } catch (_) {}
    return { projektCode: code, schueler: String(row[1]), zeit: row[2] instanceof Date ? row[2].toISOString() : row[2], bewertung: rating };
  });
}

function getProjectStats_(value) {
  const results = getResults_(value);
  const sum = Object.create(null), count = Object.create(null);
  results.forEach(item => Object.keys(item.bewertung || {}).forEach(group => {
    const criteria = item.bewertung[group];
    if (!criteria || typeof criteria !== "object") return;
    Object.values(criteria).forEach(raw => {
      const score = Number(raw);
      if (!Number.isFinite(score) || score < 0 || score > 10) return;
      sum[group] = (sum[group] || 0) + score;
      count[group] = (count[group] || 0) + 1;
    });
  }));
  const gruppen = Object.create(null);
  Object.keys(sum).forEach(group => { gruppen[group] = Math.round(sum[group] / count[group] * 100) / 100; });
  return { anzahlBewertungen: results.length, gruppen };
}

function deleteRating_(projectCode, student) {
  const code = code_(projectCode);
  const name = text_(student, 80, "Name").toLocaleLowerCase("de");
  return withLock_(() => {
    const sheet = sheet_(RATING_SHEET);
    const rows = rows_(RATING_SHEET, 2);
    let deleted = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][0]) === code && String(rows[i][1]).toLocaleLowerCase("de") === name) {
        sheet.deleteRow(i + 2);
        deleted++;
      }
    }
    return { success: true, deleted };
  });
}

function deleteProject_(value) {
  const code = code_(value);
  return withLock_(() => {
    [PROJECT_SHEET, RATING_SHEET].forEach(name => {
      const sheet = sheet_(name);
      const rows = rows_(name, 1);
      for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === code) sheet.deleteRow(i + 2);
    });
    clearProjectCache_();
    return { success: true };
  });
}
