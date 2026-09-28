(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const views = ["dashboard", "create", "detail", "presentation"];
  let projects = [];
  let activeProject = null;
  let ratings = [];
  let busy = false;
  // The teacher page is intentionally accessible by link without login.
  // This value is public in the page source and provides no access control.
  const PUBLIC_TEACHER_TOKEN = "123456712345671234567";
  const dialog = $("app-dialog");

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = String(text);
    if (className) el.className = className;
    return el;
  }
  function list(value) {
    return (Array.isArray(value) ? value : String(value || "").split(","))
      .map(value => String(value).trim()).filter(Boolean);
  }
  function setMessage(id, text, error = false) {
    const el = $(id);
    el.textContent = text;
    el.className = "message" + (text ? (error ? " error" : " ok") : "");
  }
  function showView(name) {
    views.forEach(view => $(view + "-view").classList.toggle("hidden", view !== name));
    scrollTo({ top: 0, behavior: "smooth" });
  }
  function setBusy(value, button) {
    busy = value;
    if (button) button.disabled = value;
  }
  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("visible"), 3500);
  }
  function studentLink(code) {
    const url = new URL("student.html", location.href);
    url.searchParams.set("code", code);
    return url.href;
  }
  function shareContent(code) {
    const container = node("div", undefined, "qr-share");
    container.append(node("div", "Projektcode: " + code, "code"));
    const target = node("div", undefined, "qr-canvas");
    container.append(target, node("code", studentLink(code), "share-url"));
    if (typeof QRCode === "function") {
      new QRCode(target, { text: studentLink(code), width: 180, height: 180, colorDark: "#17332d", colorLight: "#ffffff" });
    } else {
      target.append(node("p", "QR-Code konnte nicht geladen werden. Der Link kann weiterhin kopiert werden."));
    }
    return container;
  }
  function showQr(code) {
    showDialog("Projekt teilen", "Schülerinnen und Schüler gelangen mit dem QR-Code direkt zur Bewertung.", [
      button("Link kopieren", () => copy(studentLink(code)), "button button-secondary"),
      button("Schließen", () => dialog.close(), "button")
    ], shareContent(code), "EINLADUNG");
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Link kopiert"); }
    catch { showDialog("Link teilen", "Bitte diesen Link kopieren:", [button("Schließen", () => dialog.close())], node("code", text)); }
  }
  function button(label, action, kind = "button") {
    const el = node("button", label, kind);
    el.type = "button";
    el.addEventListener("click", action);
    return el;
  }
  function showDialog(title, description, actions = [], extra = null, kicker = "PROJEKTBLICK") {
    $("dialog-title").textContent = title;
    $("dialog-kicker").textContent = kicker;
    const body = $("dialog-body");
    body.replaceChildren(node("p", description));
    if (extra) body.append(extra);
    $("dialog-actions").replaceChildren(...actions);
    if (!dialog.open) dialog.showModal();
  }
  async function api(payload, requiresAdmin = false) {
    const data = requiresAdmin ? { ...payload, adminToken: PUBLIC_TEACHER_TOKEN } : payload;
    return window.projektblickRequest(data);
  }
  function field(kind, value = "") {
    const host = $(kind + "-fields");
    const row = node("div", undefined, "dynamic-row");
    const input = node("input");
    input.type = "text";
    input.required = true;
    input.maxLength = 60;
    input.placeholder = kind === "group" ? "Name der Gruppe" : "Bewertungskriterium";
    input.value = value;
    const remove = button("×", () => { if (host.children.length > 1) row.remove(); }, "icon-button");
    remove.setAttribute("aria-label", "Feld entfernen");
    row.append(input, remove);
    host.append(row);
  }
  function collect(kind) {
    return [...$(kind + "-fields").querySelectorAll("input")].map(el => el.value.trim()).filter(Boolean);
  }
  function validateNames(items, label) {
    if (!items.length) throw new Error("Bitte mindestens ein " + label + " eingeben.");
    if (items.some(x => x.includes(","))) throw new Error(label + " dürfen keine Kommas enthalten.");
    if (new Set(items.map(x => x.toLocaleLowerCase("de"))).size !== items.length) throw new Error(label + " dürfen nicht doppelt vorkommen.");
  }
  function renderProjects() {
    $("project-count").textContent = projects.length;
    $("dashboard-status").textContent = projects.length === 1 ? "1 Projekt vorhanden" : projects.length + " Projekte vorhanden";
    const host = $("project-grid");
    host.replaceChildren();
    if (!projects.length) {
      const empty = node("div", undefined, "empty-state");
      empty.append(node("div", "◇", "symbol"), node("h2", "Noch keine Projekte"), node("p", "Erstelle dein erstes Projekt und teile den Code mit deiner Klasse."), button("+ Projekt erstellen", () => showView("create"), "button"));
      host.append(empty);
      return;
    }
    [...projects].reverse().forEach(project => {
      const card = node("article", undefined, "project-card");
      card.append(node("div", project.klasse || "Projekt", "badge"), node("h3", project.titel), node("p", list(project.gruppen).length + " Gruppen · " + list(project.kriterien).length + " Kriterien"));
      const footer = node("div", undefined, "project-card-footer");
      const actions = node("div", undefined, "card-actions");
      actions.append(button("QR-Code", () => showQr(project.code), "button button-secondary button-small"), button("Öffnen →", () => openProject(project.code), "button button-small"));
      footer.append(node("span", project.code, "code"), actions);
      card.append(footer);
      host.append(card);
    });
  }
  async function loadProjects() {
    setMessage("dashboard-status", "Projekte werden geladen …");
    try {
      const result = await api({ action: "getProjects" }, true);
      if (!Array.isArray(result)) throw new Error("Ungültige Antwort vom Server.");
      projects = result.map(p => ({ ...p, code: String(p.code) }));
      renderProjects();
    } catch (error) {
      setMessage("dashboard-status", error.message || "Projekte konnten nicht geladen werden.", true);
    }
  }
  async function createProject(event) {
    event.preventDefault();
    if (busy) return;
    try {
      const titel = $("project-title").value.trim();
      const klasse = $("project-class").value.trim();
      const gruppen = collect("group"), kriterien = collect("criterion");
      if (!titel || !klasse) throw new Error("Bitte Titel und Klasse eingeben.");
      validateNames(gruppen, "Gruppennamen");
      validateNames(kriterien, "Kriterien");
      setMessage("create-message", "");
      setBusy(true, $("create-button"));
      const result = await api({ action: "createProject", titel, klasse, gruppen, kriterien }, true);
      if (!result || !result.success || !/^\d{4}$/.test(String(result.code))) throw new Error("Projekt konnte nicht bestätigt werden.");
      $("create-form").reset();
      $("group-fields").replaceChildren(); field("group");
      $("criterion-fields").replaceChildren(); field("criterion");
      const code = String(result.code);
      projects.push({ code, titel, klasse, gruppen: gruppen.join(","), kriterien: kriterien.join(",") });
      renderProjects();
      const link = studentLink(code);
      showDialog("Projekt erstellt", "Teile den Code oder diesen Link mit der Klasse.", [
        button("Link kopieren", () => copy(link), "button button-secondary"),
        button("Zur Übersicht", () => { dialog.close(); showView("dashboard"); }, "button")
      ], shareContent(code), "ERFOLGREICH");
    } catch (error) {
      setMessage("create-message", error.message || "Projekt konnte nicht erstellt werden.", true);
    } finally { setBusy(false, $("create-button")); }
  }
  async function openProject(code) {
    activeProject = projects.find(p => p.code === String(code));
    if (!activeProject) return;
    $("detail-title").textContent = activeProject.titel;
    $("detail-class").textContent = activeProject.klasse ? "KLASSE " + activeProject.klasse : "PROJEKT";
    $("detail-code").textContent = activeProject.code;
    $("group-count").textContent = list(activeProject.gruppen).length;
    $("criterion-count").textContent = list(activeProject.kriterien).length;
    showView("detail");
    await loadRatings();
  }
  async function loadRatings() {
    if (!activeProject) return;
    setMessage("detail-message", "Bewertungen werden geladen …");
    try {
      const result = await api({ action: "getResults", code: activeProject.code }, true);
      if (!Array.isArray(result)) throw new Error("Ungültige Antwort vom Server.");
      ratings = result;
      $("rating-count").textContent = ratings.length;
      const host = $("rating-rows");
      host.replaceChildren();
      if (!ratings.length) {
        const row = node("tr");
        const cell = node("td", "Noch keine Bewertungen abgegeben.");
        cell.colSpan = 3; row.append(cell); host.append(row);
      }
      ratings.forEach(item => {
        const row = node("tr");
        const date = item.zeit ? new Date(item.zeit) : null;
        const display = date && !isNaN(date) ? date.toLocaleString("de-DE") : "–";
        const actions = node("div", undefined, "table-actions");
        actions.append(button("Details", () => showRating(item)), button("Löschen", () => deleteRating(item), "danger"));
        const cell = node("td"); cell.append(actions);
        row.append(node("td", item.schueler), node("td", display), cell);
        host.append(row);
      });
      setMessage("detail-message", "");
    } catch (error) { setMessage("detail-message", error.message || "Bewertungen konnten nicht geladen werden.", true); }
  }
  function showRating(item) {
    let parsed;
    try { parsed = typeof item.bewertung === "string" ? JSON.parse(item.bewertung) : item.bewertung; }
    catch { parsed = {}; }
    const content = node("div");
    Object.entries(parsed || {}).forEach(([group, values]) => {
      content.append(node("h3", group));
      const listEl = node("ul", undefined, "dialog-list");
      Object.entries(values || {}).forEach(([criterion, score]) => {
        const li = node("li");
        li.append(node("span", criterion), node("strong", String(score) + " / 10"));
        listEl.append(li);
      });
      content.append(listEl);
    });
    showDialog("Bewertung von " + item.schueler, "", [button("Schließen", () => dialog.close(), "button")], content, "EINZELWERTE");
  }
  function confirmAction(title, description, onConfirm) {
    showDialog(title, description, [
      button("Abbrechen", () => dialog.close(), "button button-secondary"),
      button("Löschen", async () => {
        dialog.close();
        try { await onConfirm(); toast("Gelöscht"); }
        catch (error) { showDialog("Löschen fehlgeschlagen", error.message || "Bitte erneut versuchen.", [button("Schließen", () => dialog.close())]); }
      }, "button button-danger")
    ], null, "BITTE BESTÄTIGEN");
  }
  function deleteRating(item) {
    confirmAction("Bewertung löschen?", "Die Bewertung von " + item.schueler + " wird entfernt.", async () => {
      const result = await api({ action: "deleteRating", projektCode: activeProject.code, schueler: item.schueler }, true);
      if (!result || !result.success) throw new Error("Löschen konnte nicht bestätigt werden.");
      await loadRatings();
    });
  }
  function deleteProject() {
    if (!activeProject) return;
    confirmAction("Projekt löschen?", "„" + activeProject.titel + "“ und alle zugehörigen Bewertungen werden unwiderruflich entfernt.", async () => {
      const result = await api({ action: "deleteProject", code: activeProject.code }, true);
      if (!result || !result.success) throw new Error("Löschen konnte nicht bestätigt werden.");
      projects = projects.filter(project => project.code !== activeProject.code);
      activeProject = null;
      renderProjects();
      showView("dashboard");
    });
  }
  function renderPresentation(selectedGroup) {
    if (!activeProject || !ratings.length) {
      toast("Für diese Präsentation sind Bewertungen nötig.");
      return;
    }
    $("presentation-title").textContent = activeProject.titel;
    $("presentation-class").textContent = activeProject.klasse ? "KLASSE " + activeProject.klasse : "ERGEBNISSE";
    const groupStats = new Map();
    const criterionTotals = new Map();
    let allScoreSum = 0, allScoreCount = 0;
    ratings.forEach(item => {
      let scores;
      try { scores = typeof item.bewertung === "string" ? JSON.parse(item.bewertung) : item.bewertung; }
      catch { return; }
      const countedGroups = new Set();
      Object.entries(scores || {}).forEach(([group, criteria]) => {
        if (!criteria || typeof criteria !== "object" || Array.isArray(criteria)) return;
        if (!groupStats.has(group)) groupStats.set(group, { sum: 0, count: 0, responses: 0, criteria: new Map() });
        const stats = groupStats.get(group);
        Object.entries(criteria || {}).forEach(([criterion, raw]) => {
          const value = Number(raw);
          if (!Number.isFinite(value) || value < 0 || value > 10) return;
          stats.sum += value;
          stats.count++;
          if (!stats.criteria.has(criterion)) stats.criteria.set(criterion, { sum: 0, count: 0, low: 0, middle: 0, high: 0 });
          const itemStats = stats.criteria.get(criterion);
          itemStats.sum += value;
          itemStats.count++;
          if (value <= 3) itemStats.low++;
          else if (value <= 7) itemStats.middle++;
          else itemStats.high++;
          if (!criterionTotals.has(criterion)) criterionTotals.set(criterion, { sum: 0, count: 0 });
          const total = criterionTotals.get(criterion);
          total.sum += value;
          total.count++;
          allScoreSum += value;
          allScoreCount++;
          countedGroups.add(group);
        });
      });
      countedGroups.forEach(group => groupStats.get(group).responses++);
    });
    const ranking = [...groupStats].map(([name, stats]) => ({ name, average: stats.sum / stats.count, ...stats }))
      .filter(group => group.count > 0).sort((a, b) => b.average - a.average);
    const host = $("presentation-content");
    host.replaceChildren();
    const bestCriterion = [...criterionTotals].sort((a, b) => (b[1].sum / b[1].count) - (a[1].sum / a[1].count))[0];
    const metrics = node("div", undefined, "presentation-metrics");
    [
      ["Bewertungen", String(ratings.length), "abgegeben"],
      ["Projektdurchschnitt", allScoreCount ? (allScoreSum / allScoreCount).toFixed(1) + " / 10" : "–", "über alle Gruppen und Kriterien"],
      ["Stärkstes Kriterium", bestCriterion ? bestCriterion[0] : "–", bestCriterion ? (bestCriterion[1].sum / bestCriterion[1].count).toFixed(1) + " Punkte im Schnitt" : "Noch keine Werte"]
    ].forEach(([label, value, note]) => {
      const card = node("article", undefined, "presentation-metric");
      card.append(node("span", label), node("strong", value), node("small", note));
      metrics.append(card);
    });
    host.append(metrics);

    const section = node("section", undefined, "presentation-groups");
    section.append(node("div", "ERGEBNISSE NACH GRUPPE", "eyebrow"), node("h2", "Gruppen im Vergleich"), node("p", "Wähle eine Gruppe, um ihre Kriterien und Bewertungsverteilung anzusehen."));
    const cards = node("div", undefined, "group-result-grid");
    const chosen = ranking.some(group => group.name === selectedGroup) ? selectedGroup : ranking[0] && ranking[0].name;
    ranking.forEach((group, index) => {
      const card = button("", () => renderPresentation(group.name), "group-result-button" + (group.name === chosen ? " selected" : ""));
      card.setAttribute("aria-pressed", String(group.name === chosen));
      const top = node("span", undefined, "group-result-top");
      top.append(node("span", index === 0 ? "PLATZ 1" : "PLATZ " + (index + 1), "rank-number"), node("strong", group.average.toFixed(1) + " / 10"));
      const track = node("span", undefined, "bar-track");
      const fill = node("span", undefined, "bar-fill");
      fill.style.width = Math.max(0, Math.min(100, group.average * 10)) + "%";
      track.append(fill);
      card.append(top, node("span", group.name, "group-result-name"), track, node("small", group.responses + (group.responses === 1 ? " Bewertung" : " Bewertungen")));
      cards.append(card);
    });
    section.append(cards);
    host.append(section);

    const chosenGroup = ranking.find(group => group.name === chosen);
    if (chosenGroup) {
      const detail = node("section", undefined, "group-detail-card");
      const heading = node("div", undefined, "group-detail-heading");
      const titleBlock = node("div");
      titleBlock.append(node("div", "GRUPPENDETAIL", "eyebrow"), node("h2", chosenGroup.name), node("p", chosenGroup.responses + (chosenGroup.responses === 1 ? " Bewertung" : " Bewertungen") + " · " + chosenGroup.count + " Einzelwerte"));
      heading.append(titleBlock, node("strong", chosenGroup.average.toFixed(1) + " / 10", "group-detail-score"));
      detail.append(heading);
      const criteria = node("div", undefined, "criterion-detail-list");
      [...chosenGroup.criteria].sort((a, b) => (b[1].sum / b[1].count) - (a[1].sum / a[1].count)).forEach(([name, result]) => {
        const average = result.sum / result.count;
        const row = node("article", undefined, "criterion-detail");
        const label = node("div", undefined, "bar-label");
        label.append(node("strong", name), node("strong", average.toFixed(1) + " / 10"));
        const track = node("div", undefined, "bar-track");
        const fill = node("div", undefined, "bar-fill");
        fill.style.width = Math.max(0, Math.min(100, average * 10)) + "%";
        track.append(fill);
        row.append(label, track, node("small", "0–3 Punkte: " + result.low + " · 4–7 Punkte: " + result.middle + " · 8–10 Punkte: " + result.high));
        criteria.append(row);
      });
      detail.append(criteria);
      host.append(detail);
    } else {
      host.append(node("p", "Für diese Bewertungen konnten keine gültigen Punkte ermittelt werden.", "message error"));
    }
    if ($("presentation-view").classList.contains("hidden")) showView("presentation");
  }

  $("new-project-top").addEventListener("click", () => showView("create"));
  $("refresh-button").addEventListener("click", loadProjects);
  $("add-group").addEventListener("click", () => field("group"));
  $("add-criterion").addEventListener("click", () => field("criterion"));
  $("create-form").addEventListener("submit", createProject);
  $("refresh-detail").addEventListener("click", loadRatings);
  $("copy-detail-link").addEventListener("click", () => activeProject && copy(studentLink(activeProject.code)));
  $("qr-detail-link").addEventListener("click", () => activeProject && showQr(activeProject.code));
  $("present-button").addEventListener("click", renderPresentation);
  $("delete-project").addEventListener("click", deleteProject);
  $("dialog-close").addEventListener("click", () => dialog.close());
  document.querySelectorAll("[data-view]").forEach(el => el.addEventListener("click", () => showView(el.dataset.view)));
  field("group");
  field("criterion");
  loadProjects();
})();
