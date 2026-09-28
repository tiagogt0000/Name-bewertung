/* Replace this URL only when the Apps Script deployment receives a new URL. */
window.PROJEKTBLICK_API = "https://script.google.com/macros/s/AKfycbxeoaj9MlKorhn9-VqiUM3JgK1KwJMWcMv4J9ZPN7vhDAhOqF0_rQNB82e6zZ5aD30e/exec";
window.projektblickRequest = async function (payload) {
  const saving = payload && payload.action === "saveRating";
  const safeRead = payload && ["getProject", "getStudentRating", "getProjects", "getResults", "getProjectStats"].includes(payload.action);
  const maxAttempts = safeRead ? 2 : 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), saving ? 60000 : 20000);
    try {
      const response = await fetch(window.PROJEKTBLICK_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error("Der Server ist gerade nicht erreichbar.");
        error.code = "TRANSPORT_ERROR";
        throw error;
      }
      const result = await response.json();
      if (result && result.success === false) {
        const error = new Error(result.error || "Die Aktion ist fehlgeschlagen.");
        error.code = result.code;
        throw error;
      }
      return result;
    } catch (error) {
      if (saving && (error.name === "AbortError" || error.name === "TypeError" || error.code === "TRANSPORT_ERROR")) {
        const uncertain = new Error("Die Speicherung konnte nicht bestätigt werden. Bitte erneut versuchen.");
        uncertain.code = "SAVE_UNCERTAIN";
        throw uncertain;
      }
      if (error.name === "AbortError") throw new Error("Der Server antwortet gerade sehr langsam. Bitte erneut versuchen.");
      if (error instanceof SyntaxError) error.code = "BAD_RESPONSE";
      const canRetry = attempt + 1 < maxAttempts && (
        error.name === "TypeError" || error.code === "TRANSPORT_ERROR" || error.code === "BAD_RESPONSE" || error.code === "SERVER_ERROR" || (safeRead && error.code === "BAD_REQUEST")
      );
      if (!canRetry) {
        if (safeRead && (error.name === "TypeError" || error.code === "TRANSPORT_ERROR" || error.code === "BAD_RESPONSE")) {
          const unavailable = new Error("Server fehlgeschlagen. Bitte erneut versuchen.");
          unavailable.code = error.code || "TRANSPORT_ERROR";
          throw unavailable;
        }
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 350));
    } finally {
      clearTimeout(timeout);
    }
  }
};
