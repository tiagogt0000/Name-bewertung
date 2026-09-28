(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const lookupForm = $("lookup-form");
  const ratingForm = $("rating-form");
  let project = null;
  let busy = false;

  function message(id, text, error = false) {
    const el = $(id);
    el.textContent = text;
    el.className = "message" + (text ? (error ? " error" : " ok") : "");
  }
  function setBusy(value, button, label) {
    busy = value;
    button.disabled = value;
    button.setAttribute("aria-busy", String(value));
    if (value) {
      button.dataset.originalLabel = button.innerHTML;
      button.textContent = label;
    } else if (button.dataset.originalLabel) {
      button.innerHTML = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
  }
  function list(value) {
    return (Array.isArray(value) ? value : String(value || "").split(","))
      .map(item => String(item).trim()).filter(Boolean);
  }
  function renderProject(data) {
    project = { code: String(data.code), titel: String(data.titel), klasse: String(data.klasse || ""), gruppen: list(data.gruppen), kriterien: list(data.kriterien) };
    if (!project.gruppen.length || !project.kriterien.length) throw new Error("Dieses Projekt hat keine Gruppen oder Kriterien.");
    $("project-class").textContent = project.klasse ? "KLASSE " + project.klasse : "PROJEKT";
    $("rating-title").textContent = project.titel;
    const host = $("rating-groups");
    host.replaceChildren();
    project.gruppen.forEach((group, gi) => {
      const section = document.createElement("section");
      section.className = "rating-group";
      const heading = document.createElement("h3");
      heading.textContent = group;
      section.append(heading);
      project.kriterien.forEach((criterion, ci) => {
        const id = `rating-${gi}-${ci}`;
        const row = document.createElement("div");
        row.className = "rating-row";
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = criterion;
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0";
        input.max = "10";
        input.step = "1";
        input.value = "5";
        input.id = id;
        const output = document.createElement("output");
        output.htmlFor = id;
        output.textContent = "5";
        input.addEventListener("input", () => { output.textContent = input.value; });
        row.append(label, input, output);
        section.append(row);
      });
      host.append(section);
    });
    $("rating-panel").classList.remove("hidden");
    $("rating-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  lookupForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const code = $("project-code").value.trim();
    if (!/^\d{4}$/.test(code)) return message("lookup-message", "Bitte einen vierstelligen Projektcode eingeben.", true);
    message("lookup-message", "");
    $("rating-panel").classList.add("hidden");
    setBusy(true, $("lookup-button"), "Projekt wird geladen …");
    try {
      const data = await window.projektblickRequest({ action: "getProject", code });
      if (!data || !data.code) throw new Error("Kein Projekt mit diesem Code gefunden.");
      renderProject(data);
      history.replaceState(null, "", "?code=" + encodeURIComponent(code));
    } catch (error) {
      project = null;
      message("lookup-message", error.message || "Projekt konnte nicht geladen werden.", true);
    } finally { setBusy(false, $("lookup-button")); }
  });
  ratingForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !project) return;
    const name = $("student-name").value.trim().replace(/\s+/g, " ");
    if (name.length < 2) return message("rating-message", "Bitte deinen Namen eingeben.", true);
    const bewertung = Object.create(null);
    project.gruppen.forEach((group, gi) => {
      bewertung[group] = Object.create(null);
      project.kriterien.forEach((criterion, ci) => {
        bewertung[group][criterion] = Number($(`rating-${gi}-${ci}`).value);
      });
    });
    message("rating-message", "Bitte warten: Deine Bewertung wird gespeichert. Lass diese Seite geöffnet, bis die Bestätigung erscheint.");
    $("rating-message").classList.add("pending");
    ratingForm.setAttribute("aria-busy", "true");
    setBusy(true, $("submit-button"), "Wird gespeichert …");
    try {
      const result = await window.projektblickRequest({ action: "saveRating", projektCode: project.code, schueler: name, bewertung });
      if (!result || result.success !== true) throw new Error("Speichern konnte nicht bestätigt werden.");
      $("rating-panel").classList.add("hidden");
      $("lookup-panel").classList.add("hidden");
      $("success-panel").classList.remove("hidden");
      $("success-panel").scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      const text = error.code === "ALREADY_RATED"
        ? "Für diesen Namen wurde bereits eine Bewertung abgegeben."
        : "Fehlgeschlagen. Bitte erneut versuchen.";
      message("rating-message", text, true);
    } finally {
      $("rating-message").classList.remove("pending");
      ratingForm.removeAttribute("aria-busy");
      setBusy(false, $("submit-button"));
    }
  });
  const code = new URLSearchParams(location.search).get("code");
  if (code && /^\d{4}$/.test(code)) {
    $("project-code").value = code;
    lookupForm.requestSubmit();
  }
})();
