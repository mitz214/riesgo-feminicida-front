// ===============================
// Configuración
// ===============================
const USE_MOCK_EVALUATION = true;

// ===============================
// Helpers texto
// ===============================
function stripAccents(text) {
  const map = {
    á:"a", à:"a", ä:"a", â:"a", Á:"a", À:"a", Ä:"a", Â:"a",
    é:"e", è:"e", ë:"e", ê:"e", É:"e", È:"e", Ë:"e", Ê:"e",
    í:"i", ì:"i", ï:"i", î:"i", Í:"i", Ì:"i", Ï:"i", Î:"i",
    ó:"o", ò:"o", ö:"o", ô:"o", Ó:"o", Ò:"o", Ö:"o", Ô:"o",
    ú:"u", ù:"u", ü:"u", û:"u", Ú:"u", Ù:"u", Ü:"u", Û:"u",
    ñ:"n", Ñ:"n",
  };
  return text.replace(/[^\u0000-\u007E]/g, (a) => map[a] || a);
}

// ===============================
// Evaluación local
// ===============================
function evaluateLocally(description) {
  let text = stripAccents(String(description || "").toLowerCase());
  let score = 0;
  const factors = [];

  const keywords = {
    arma_fuego: {
      palabras: ["pistola", "arma de fuego", "revolver", "rifle"],
      puntos: 15,
      etiqueta: "Uso de arma de fuego",
    },
    arma_blanca: {
      palabras: ["cuchillo", "navaja", "machete", "punalada", "apunalar", "apunialada"],
      puntos: 12,
      etiqueta: "Uso de arma blanca",
    },
    asfixia: {
      palabras: ["ahorco", "ahorcar", "estrangulo", "estrangular", "asfixio", "asfixiar"],
      puntos: 18,
      etiqueta: "Intento de asfixia/estrangulamiento",
    },
    amenaza_muerte: {
      palabras: [
        "te voy a matar",
        "si me dejas te mato",
        "prefiero verte muerta",
        "si no eres mia no eres de nadie",
        "te mato",
      ],
      puntos: 15,
      etiqueta: "Amenazas directas de muerte",
    },
    violencia_fisica: {
      palabras: [
        "la golpeo","la golpea","golpes","golpeada","le pego",
        "la pateo","la empujo","la agredio fisicamente","la lastimo",
      ],
      puntos: 12,
      etiqueta: "Violencia física directa",
    },
    violencia_previa: {
      palabras: [
        "ya la habia golpeado","antes ya la habia golpeado","otras veces la golpeo",
        "no es la primera vez","siempre la golpea","varias veces la ha golpeado",
        "desde hace tiempo la agrede","repetidamente la golpea",
      ],
      puntos: 12,
      etiqueta: "Antecedentes de violencia reiterada",
    },
    desaparicion: {
      palabras: ["desaparecida", "desaparecio", "no regreso", "no aparecio"],
      puntos: 10,
      etiqueta: "Referencia a desaparición",
    },
    control_celos: {
      palabras: [
        "no me deja salir","no la deja salir","revisa mi telefono","revisa su telefono",
        "no me permite trabajar","no le permite trabajar","la controla",
        "control excesivo","celos","celoso",
      ],
      puntos: 8,
      etiqueta: "Control y celos extremos",
    },
  };

  Object.values(keywords).forEach((cfg) => {
    const found = cfg.palabras.some((w) => text.includes(stripAccents(w)));
    if (found) {
      score += cfg.puntos;
      factors.push(cfg.etiqueta);
    }
  });

  const tieneAmenazaMuerte = factors.includes("Amenazas directas de muerte");
  const tieneViolenciaFisica = factors.includes("Violencia física directa");
  const tieneViolenciaPrevia = factors.includes("Antecedentes de violencia reiterada");
  const tieneAsfixia = factors.includes("Intento de asfixia/estrangulamiento");

  if (tieneAmenazaMuerte && tieneViolenciaFisica) score += 5;
  if (tieneViolenciaFisica && tieneViolenciaPrevia) score += 4;
  if (tieneAmenazaMuerte && tieneViolenciaPrevia) score += 4;

  let level = "moderado";
  if (tieneAsfixia) level = score >= 35 ? "extremo" : "grave";
  else if (tieneAmenazaMuerte && (tieneViolenciaFisica || tieneViolenciaPrevia))
    level = score >= 35 ? "extremo" : "grave";
  else {
    if (score <= 20) level = "moderado";
    else if (score <= 35) level = "grave";
    else level = "extremo";
  }

  return {
    risk_score: score,
    risk_level: level,
    risk_factors: factors.length ? factors : ["Sin factores de alto riesgo en el texto"],
  };
}

// ===============================
// UI - Individual
// ===============================
const form = document.getElementById("case-form");
const submitBtn = form?.querySelector('button[type="submit"]');
const singleLoading = document.getElementById("single-loading");
const errorBox = document.getElementById("form-error");

const resultEmpty = document.getElementById("result-empty");
const resultContent = document.getElementById("result-content");
const riskLevelEl = document.getElementById("risk-level");
const riskScoreEl = document.getElementById("risk-score");
const factorsListEl = document.getElementById("risk-factors-list");
const recommendationsEl = document.getElementById("recommendations-list");

function setSingleLoading(isLoading) {
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Evaluando..." : "Evaluar riesgo";
  }
  if (singleLoading) singleLoading.hidden = !isLoading;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ""; }

    const fd = new FormData(form);
    const desc = String(fd.get("description") || "").trim();

    if (!desc) {
      if (errorBox) { errorBox.hidden = false; errorBox.textContent = "La descripción es obligatoria."; }
      return;
    }

    setSingleLoading(true);

    try {
      if (USE_MOCK_EVALUATION) await new Promise((r) => setTimeout(r, 400));
      const evalRes = evaluateLocally(desc);

      if (resultEmpty) resultEmpty.classList.add("hidden");
      if (resultContent) resultContent.classList.remove("hidden");

      if (riskLevelEl) riskLevelEl.textContent = evalRes.risk_level.toUpperCase();
      if (riskScoreEl) riskScoreEl.textContent = String(evalRes.risk_score ?? 0);

      if (factorsListEl) {
        factorsListEl.innerHTML = "";
        evalRes.risk_factors.forEach((f) => {
          const li = document.createElement("li");
          li.textContent = f;
          factorsListEl.appendChild(li);
        });
      }

      // Si tu UI tiene recomendaciones-list, lo llenamos
      if (recommendationsEl) {
        recommendationsEl.innerHTML = "";
        const level = evalRes.risk_level;
        const recs =
          level === "extremo" ? [
            "Activar de inmediato los protocolos de alto riesgo feminicida.",
            "Gestionar medidas de protección y vigilancia prioritaria.",
            "Asegurar comunicación urgente con la víctima y/o su red de apoyo.",
          ] : level === "grave" ? [
            "Valorar medidas de protección urgentes y canalización inmediata.",
            "Registrar el caso en sistemas institucionales de riesgo.",
            "Coordinar con área jurídica y de seguridad según protocolos vigentes.",
          ] : [
            "Valorar seguimiento cercano y acompañamiento psicosocial.",
            "Explorar antecedentes y fortalecer red de apoyo.",
            "Informar sobre recursos institucionales disponibles.",
          ];
        recs.forEach((r) => {
          const li = document.createElement("li");
          li.textContent = r;
          recommendationsEl.appendChild(li);
        });
      }
    } catch (err) {
      console.error(err);
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = "Ocurrió un error al evaluar el caso.";
      }
    } finally {
      setSingleLoading(false);
    }
  });
}

// ===============================
// UI - CSV Masivo
// ===============================
const csvInput = document.getElementById("csv-file");
const processCsvBtn = document.getElementById("process-csv");
const bulkError = document.getElementById("bulk-error");
const bulkFileName = document.getElementById("bulk-file-name");
const bulkStatus = document.getElementById("bulk-status");
const bulkLoading = document.getElementById("bulk-loading");

const bulkSummary = document.getElementById("bulk-summary");
const bulkTableWrapper = document.getElementById("bulk-table-wrapper");
const bulkTbody = document.getElementById("bulk-tbody");

const bulkTotalEl = document.getElementById("bulk-total");
const bulkModeradoEl = document.getElementById("bulk-moderado");
const bulkGraveEl = document.getElementById("bulk-grave");
const bulkExtremoEl = document.getElementById("bulk-extremo");

function setBulkLoading(isLoading, message = "") {
  if (processCsvBtn) {
    processCsvBtn.disabled = isLoading;
    processCsvBtn.textContent = isLoading ? "Procesando..." : "Procesar archivo";
  }
  if (bulkLoading) bulkLoading.hidden = !isLoading;
  if (bulkStatus) bulkStatus.textContent = message;
}

function renderBulkTable(cases, totals) {
  if (!cases.length) {
    if (bulkSummary) bulkSummary.classList.add("hidden");
    if (bulkTableWrapper) bulkTableWrapper.classList.add("hidden");
    if (bulkError) {
      bulkError.hidden = false;
      bulkError.textContent = "No se encontraron registros con descripción de hechos para analizar.";
    }
    return;
  }

  if (bulkError) { bulkError.hidden = true; bulkError.textContent = ""; }

  if (bulkSummary) bulkSummary.classList.remove("hidden");
  if (bulkTableWrapper) bulkTableWrapper.classList.remove("hidden");

  if (bulkTotalEl) bulkTotalEl.textContent = String(cases.length);
  if (bulkModeradoEl) bulkModeradoEl.textContent = String(totals.moderado);
  if (bulkGraveEl) bulkGraveEl.textContent = String(totals.grave);
  if (bulkExtremoEl) bulkExtremoEl.textContent = String(totals.extremo);

  if (bulkTbody) {
    bulkTbody.innerHTML = "";
    cases.forEach((c) => {
      const tr = document.createElement("tr");
      tr.classList.add(`risk-${c.risk_level}`);

      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${c.municipio || "-"}</td>
        <td>${c.edad || "-"}</td>
        <td>${String(c.risk_level).toUpperCase()}</td>
        <td>${c.risk_score}</td>
      `;
      bulkTbody.appendChild(tr);
    });
  }
}

function handleCsvData(rows) {
  const getDesc = (row) =>
    row.hecho_descripcion ||
    row.descripcion_hecho ||
    row.descripcion_hecho_extensa ||
    row.descripcion ||
    "";

  const getId = (row, idx) => row.euv_caso || row.euv || row.id || `Caso ${idx + 1}`;
  const getMunicipio = (row) => row.hecho_municipio || row.victima_municipio || row.municipio || "";
  const getEdad = (row) => row.victima_edad || row.edad || row.victima_edad_aprox || "";

  const processed = [];
  let countModerado = 0, countGrave = 0, countExtremo = 0;

  rows.forEach((row, idx) => {
    const desc = String(getDesc(row) || "").trim();
    if (!desc) return;

    const evalRes = evaluateLocally(desc);
    const level = evalRes.risk_level || "moderado";

    if (level === "extremo") countExtremo++;
    else if (level === "grave") countGrave++;
    else countModerado++;

    processed.push({
      id: getId(row, idx),
      municipio: getMunicipio(row),
      edad: getEdad(row),
      risk_level: level,
      risk_score: evalRes.risk_score ?? 0,
    });
  });

  renderBulkTable(processed, {
    moderado: countModerado,
    grave: countGrave,
    extremo: countExtremo,
  });
}

// ✅ reset al cargar
document.addEventListener("DOMContentLoaded", () => {
  if (singleLoading) singleLoading.hidden = true;
  if (bulkLoading) bulkLoading.hidden = true;
  if (bulkSummary) bulkSummary.classList.add("hidden");
  if (bulkTableWrapper) bulkTableWrapper.classList.add("hidden");
  if (bulkStatus) bulkStatus.textContent = "";
});

if (csvInput) {
  csvInput.addEventListener("change", () => {
    if (bulkError) { bulkError.hidden = true; bulkError.textContent = ""; }
    if (bulkStatus) bulkStatus.textContent = "";
    if (bulkFileName) {
      bulkFileName.textContent = csvInput.files?.[0] ? `Archivo: ${csvInput.files[0].name}` : "";
    }
  });
}

if (processCsvBtn && csvInput) {
  processCsvBtn.addEventListener("click", () => {
    if (bulkError) { bulkError.hidden = true; bulkError.textContent = ""; }
    if (bulkSummary) bulkSummary.classList.add("hidden");
    if (bulkTableWrapper) bulkTableWrapper.classList.add("hidden");

    if (!csvInput.files || !csvInput.files[0]) {
      if (bulkError) {
        bulkError.hidden = false;
        bulkError.textContent = "Primero selecciona un archivo CSV.";
      }
      return;
    }

    const file = csvInput.files[0];
    setBulkLoading(true, "Procesando archivo, por favor espera...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "ISO-8859-1",
      complete: (results) => {
        try {
          handleCsvData(results.data || []);
          setBulkLoading(false, "Procesamiento finalizado.");
        } catch (e) {
          console.error(e);
          setBulkLoading(false, "");
          if (bulkError) {
            bulkError.hidden = false;
            bulkError.textContent =
              "Error al procesar. Verifica que el CSV tenga columna de descripción del hecho.";
          }
        }
      },
      error: (err) => {
        console.error(err);
        setBulkLoading(false, "");
        if (bulkError) {
          bulkError.hidden = false;
          bulkError.textContent = "No se pudo leer el CSV. Verifica el formato.";
        }
      },
    });
  });
}
