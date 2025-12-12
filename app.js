const form = document.getElementById("case-form");
const singleLoading = document.getElementById("single-loading");
const bulkLoading = document.getElementById("bulk-loading");

document.addEventListener("DOMContentLoaded", () => {
  singleLoading.hidden = true;
  bulkLoading.hidden = true;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  singleLoading.hidden = false;

  await new Promise(r => setTimeout(r, 700)); // demo

  singleLoading.hidden = true;
  document.getElementById("result-empty").classList.add("hidden");
  document.getElementById("result-content").classList.remove("hidden");
  document.getElementById("risk-level").textContent = "MODERADO";
  document.getElementById("risk-score").textContent = "12";
});

document.getElementById("process-csv").addEventListener("click", () => {
  bulkLoading.hidden = false;

  setTimeout(() => {
    bulkLoading.hidden = true;
    document.getElementById("bulk-summary").textContent =
      "Archivo procesado correctamente";
    document.getElementById("bulk-summary").classList.remove("hidden");
  }, 800);
});
