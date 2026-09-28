/* Replace this URL only when the Apps Script deployment receives a new URL. */
window.PROJEKTBLICK_API = "https://script.google.com/macros/s/AKfycbxeoaj9MlKorhn9-VqiUM3JgK1KwJMWcMv4J9ZPN7vhDAhOqF0_rQNB82e6zZ5aD30e/exec";
window.projektblickRequest = async function (payload) {
  const controller = new AbortController();
  const saving = payload && payload.action === "saveRating";
  const timeout = setTimeout(() => controller.abort(), saving ? 60000 : 45000);
  try {
    const response = await fetch(window.PROJEKTBLICK_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Der Server ist gerade nicht erreichbar.");
    const result = await response.json();
    if (result && result.success === false) {
      const error = new Error(result.error || "Die Aktion ist fehlgeschlagen.");
      error.code = result.code;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError" && saving) {
      const uncertain = new Error("Die Speicherung konnte nicht bestätigt werden. Bitte frage deine Lehrkraft, bevor du erneut absendest.");
      uncertain.code = "SAVE_UNCERTAIN";
      throw uncertain;
    }
    if (error.name === "AbortError") throw new Error("Der Server antwortet gerade sehr langsam. Bitte erneut versuchen.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
