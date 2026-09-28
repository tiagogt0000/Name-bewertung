const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function makeSheet(header) {
  const rows = [header];
  return {
    rows,
    getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
    appendRow: row => rows.push(row),
    deleteRow: index => rows.splice(index - 1, 1)
  };
}

const sheets = {
  Projekte: makeSheet(["Code", "Titel", "Klasse", "Gruppen", "Kriterien"]),
  Bewertungen: makeSheet(["ProjektCode", "Schüler", "Zeit", "Bewertung"])
};
let secret = null;
const context = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => sheets[name] }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { JSON: "json" },
    createTextOutput: text => ({ text, setMimeType() { return this; } })
  },
  console
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8"), context);
const post = data => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(data) } }).text);

assert.equal(post({ action: "getProjects" }).code, "AUTH_NOT_CONFIGURED");
secret = "test-secret-longer-than-twenty-characters";
assert.equal(post({ action: "getProjects" }).code, "AUTH_REQUIRED");

const created = post({
  action: "createProject", adminToken: secret,
  titel: "Unsere Stadt", klasse: "8b", gruppen: ["A", "B"], kriterien: ["Inhalt", "Vortrag"]
});
assert.equal(created.success, true);
assert.match(created.code, /^\d{4}$/);
assert.equal(post({ action: "getProject", code: created.code }).gruppen.length, 2);

const rating = {
  action: "saveRating", projektCode: created.code, schueler: "Ada Lovelace",
  bewertung: { A: { Inhalt: 8, Vortrag: 9 }, B: { Inhalt: 6, Vortrag: 7 } }
};
assert.equal(post(rating).success, true);
assert.equal(post({ action: "getStudentRating", projektCode: created.code, schueler: "Ada Lovelace" }).exists, true);
assert.equal(post(rating).code, "ALREADY_RATED");
assert.equal(post({ action: "getResults", code: created.code, adminToken: secret }).length, 1);
assert.equal(post({ action: "getProjectStats", code: created.code, adminToken: secret }).gruppen.A, 8.5);

const invalid = post({ ...rating, schueler: "Grace Hopper", bewertung: { A: { Inhalt: 12 } } });
assert.equal(invalid.success, false);
assert.equal(sheets.Bewertungen.rows.length, 2);

assert.equal(post({ action: "deleteRating", projektCode: created.code, schueler: "Ada Lovelace", adminToken: secret }).deleted, 1);
assert.equal(post({ action: "deleteProject", code: created.code, adminToken: secret }).success, true);
assert.equal(sheets.Projekte.rows.length, 1);
console.log("Apps Script API tests passed");
