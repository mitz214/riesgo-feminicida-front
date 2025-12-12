// ===============================
// Configuración
// ===============================

// Cuando tengas backend, cambia esta URL por tu API real
const API_URL = "http://127.0.0.1:8000/api/cases"; // o la URL de ngrok
const USE_MOCK_EVALUATION = true; // por ahora usamos evaluación local

// ===============================
// Evaluación local (mock)
// ===============================

function stripAccents(text) {
  const map = {
    á: "a", à: "a", ä: "a", â: "a",
    Á: "a", À: "a", Ä: "a", Â: "a",
    é: "e", è: "e", ë: "e", ê: "e",
    É: "e", È: "e", Ë: "e", Ê: "e",
    í: "i", ì: "i", ï: "i", î: "i",
    Í: "i", Ì: "i", Ï: "i", Î: "i",
    ó: "o", ò: "o", ö: "o", ô: "o",
    Ó: "o", Ò: "o", Ö: "o", Ô: "o",
    ú: "u", ù: "u", ü: "u", û: "u",
    Ú: "u", Ù: "u", Ü: "u", Û: "u",
    ñ: "n", Ñ: "n",
  };
  return text.replace(/[^\u0000-\u007E]/g, (a) => map[a] || a);
}

function evaluateLocally(description) {
  let text = stripAccents(description.toLowerCase());
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
        "la golpeo", "la golpeo varias veces", "la golpea", "golpes",
        "golpeada", "golpeado", "le pego", "le pego varias veces",
        "la pateo", "la pateaba", "la empujo", "la empujaba",
        "la agredio fisicamente", "la lastimo", "la lastimaba",
      ],
      puntos: 12,
      etiqueta: "Violencia física directa",
    },
    violencia_previa: {
      palabras: [
        "ya la habia golpeado",
        "antes ya la habia golpeado",
        "otras veces la golpeo",
        "no es la primera vez",
        "siempre la golpea",
        "varias veces la ha golpeado",
        "desde hace tiempo la agrede",
        "repetidamente la golpea",
        "la ha golpeado en otras ocasiones",
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
        "no me deja salir",
        "no la deja salir",
        "revisa mi telefono",
        "revisa su telefono",
        "no me permite trabajar",
        "no le permite trabajar",
        "la controla",
        "control excesivo",
        "celos",
        "celoso",
      ],
      puntos: 8,
      etiqueta: "Control y celos extremos",
    },
    intento_suicidio: {
      palabras: [
        "intento quitarse la vida",
        "intentó quitarse la vida",
        "intento suicidarse",
        "quiso matarse",
      ],
      puntos: 8,
      etiqueta: "Intento de suicidio de la víctima",
    },
  };

  Object.values(keywords).forEach((cfg) => {
    const found = cfg.palabras.some((w) =>
      text.includes(stripAccents(w.toLowerCase()))
    );
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

  if (tieneAsfixia) {
    level = score >= 35 ? "extremo" : "grave";
  } else if (tieneAmenazaMuerte && (tieneViolenciaFisica || tieneViolenciaPrevia)) {
    level = score >= 35 ? "extremo" : "grave";
  } else {
    if (score <= 20) level = "moderado";
    else if (score <= 35) level = "grave";
    else level = "extremo";
  }

  return {
    risk_score: score,
    risk_level: level,
    risk_factors: factors.length
      ? factors
      : ["Sin factores de alto riesgo identificados en el texto analizado"],
  };
}

// ===============================
// UI – evaluación individual
// ===============================

const form = document.getElementById("case-form");
const errorBox = document.getElementById("form-error");
const resultEmpty = document.getElementById("result-empty");
const resultContent = document.getElementById("result-content");
const riskLevelEl = document.getElementById("risk-level");
const riskScoreEl = document.getElementById("risk-score");
const factorsListEl = document.getElementById("risk-factors-list");
const recommendationsEl = document.getElementById("recommendations-list");

const submitBtn = form.querySelector('button[type="submit"]');
const singleLoading = document.getElementById("single-loading");

// ✅ Al cargar la página, los loaders deben estar ocultos sí o sí
document.addEventListener("DOMContentLoaded", () => {
  if (singleLoading) singleLoading.hidden = true;
  if (bulkLoading) bulkLoading.hidden = true;

  // (opcional pero recomendado) reset UI masiva
  if (bulkStatus) bulkStatus.textContent = "";
  if (bulkFileName) bulkFileName.textContent = "";
  if (bulkSummary) bulkSummary.classList.add("hidden");
  if (bulkTableWrapper) bulkTableWrapper.classList.add("hidden");
});


function setSingleLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Evaluando..." : "Evaluar riesgo";
  if (singleLoading) singleLoading.hidden = !isLoading; // ✅ NATIVO
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  errorBox.textContent = "";

  const formData = new FormData(form);
  const payload = {
    victim_name: formData.get("victim_name") || null,
    victim_age: formData.get("victim_age") ? Number(formData.get("victim_age")) : null,
    municipality: formData.get("municipality") || null,
    aggressor_relation: formData.get("aggressor_relation") || null,
    description: (formData.get("description") || "").trim(),
  };

  if (!payload.description) {
    errorBox.hidden = false;
    errorBox.textContent = "La descripción de los hechos es obligatoria.";
    return;
  }

  setSingleLoading(true);

  try {
    let data;

    if (USE_MOCK_EVALUATION) {
      // pequeño delay para que se alcance a ver el loading
      await new Promise((res) => setTimeout(res, 600));

      data = {
        message: "Caso evaluado localmente (modo demo)",
        data: {
          id: null,
          ...payload,
          ...evaluateLocally(payload.description),
        },
      };
    } else {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error al evaluar el caso");
      }

      data = await res.json();
    }

    renderResult(data.data);
  } catch (err) {
    console.error(err);
    errorBox.hidden = false;
    errorBox.textContent =
      err.message || "Ocurrió un error al evaluar el caso. Intenta nuevamente.";
  } finally {
    setSingleLoading(false);
  }
});

function renderResult(caseData) {
  resultEmpty.classList.add("hidden");
  resultContent.classList.remove("hidden");

  const level = caseData.risk_level || "moderado";
  riskLevelEl.textContent = level.toUpperCase();
  riskLevelEl.classList.remove("badge-moderado", "badge-grave", "badge-extremo");
  riskLevelEl.classList.add(`badge-${level}`);

  riskScoreEl.textContent = caseData.risk_score ?? 0;

  factorsListEl.innerHTML = "";
  (caseData.risk_factors || []).forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f;
    factorsListEl.appendChild(li);
  });

  recommendationsEl.innerHTML = "";
  let recs = [];

  if (level === "moderado") {
    recs = [
      "Valorar necesidad de seguimiento cercano y acompañamiento psicosocial.",
      "Explorar antecedentes de violencia y fortalecer red de apoyo.",
      "Informar sobre recursos institucionales disponibles para protección.",
    ];
  } else if (level === "grave") {
    recs = [
      "Valorar medidas de protección urgentes y canalización inmediata.",
      "Registrar el caso en sistemas institucionales de riesgo.",
      "Coordinar con área jurídica y de seguridad según protocolos vigentes.",
    ];
  } else if (level === "extremo") {
    recs = [
      "Activar de inmediato los protocolos de alto riesgo feminicida.",
      "Gestionar medidas de protección y vigilancia prioritaria.",
      "Asegurar comunicación urgente con la víctima y/o su red de apoyo.",
    ];
  }

  recs.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    recommendationsEl.appendChild(li);
  });
}

// ===============================
// Evaluación masiva desde CSV
// ===============================

const csvInput = document.getElementById("csv-file");
const processCsvBtn = document.getElementById("process-csv");
const bulkError = document.getElementById("bulk-error");
const bulkFileName = document.getElementById("bulk-file-name");
const bulkStatus = document.getElementById("bulk-status");
const bulkSummary = document.getElementById("bulk-summary");
const bulkTableWrapper = document.getElementById("bulk-table-wrapper");
const bulkTbody = document.getElementById("bulk-tbody");
const bulkTotalEl = document.getElementById("bulk-total");
const bulkModeradoEl = document.getElementById("bulk-moderado");
const bulkGraveEl = document.getElementById("bulk-grave");
const bulkExtremoEl = document.getElementById("bulk-extremo");
const bulkLoading = document.getElementById("bulk-loading");

function setBulkLoading(isLoading, message = "") {
  if (processCsvBtn) {
    processCsvBtn.disabled = isLoading;
    processCsvBtn.textContent = isLoading ? "Procesando..." : "Procesar archivo";
  }
  if (bulkLoading) bulkLoading.hidden = !isLoading; // ✅ NATIVO
  if (bulkStatus) bulkStatus.textContent = message;
}

if (csvInput && processCsvBtn) {
  csvInput.addEventListener("change", () => {
    bulkError.hidden = true;
    bulkError.textContent = "";
    bulkStatus.textContent = "";
    bulkFileName.textContent = csvInput.files[0]
      ? `Archivo seleccionado: ${csvInput.files[0].name}`
      : "";
  });

  processCsvBtn.addEventListener("click", () => {
    bulkError.hidden = true;
    bulkError.textContent = "";
    bulkSummary.classList.add("hidden");
    bulkTableWrapper.classList.add("hidden");

    if (!csvInput.files || !csvInput.files[0]) {
      bulkError.hidden = false;
      bulkError.textContent = "Primero selecciona un archivo CSV.";
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
          bulkError.hidden = false;
          bulkError.textContent =
            "Ocurrió un error al procesar el archivo. Verifica que tenga la columna de descripción del hecho.";
        }
      },
      error: (err) => {
        console.error(err);
        setBulkLoading(false, "");
        bulkError.hidden = false;
        bulkError.textContent =
          "No se pudo leer el archivo CSV. Verifica el formato.";
      },
    });
  });
}

function handleCsvData(rows) {
  const getDesc = (row) =>
    row.hecho_descripcion ||
    row.descripcion_hecho ||
    row.descripcion_hecho_extensa ||
    row.descripcion ||
    "";

  const getId = (row, idx) =>
    row.euv_caso || row.euv || row.id || `Caso ${idx + 1}`;

  const getMunicipio = (row) =>
    row.hecho_municipio || row.victima_municipio || row.municipio || "";

  const getEdad = (row) =>
    row.victima_edad || row.edad || row.victima_edad_aprox || "";

  const processed = [];

  let countModerado = 0;
  let countGrave = 0;
  let countExtremo = 0;

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

function renderBulkTable(cases, totals) {
  if (!cases.length) {
    bulkSummary.classList.add("hidden");
    bulkTableWrapper.classList.add("hidden");
    bulkError.hidden = false;
    bulkError.textContent =
      "No se encontraron registros con descripción de hechos para analizar.";
    return;
  }

  bulkSummary.classList.remove("hidden");
  bulkTableWrapper.classList.remove("hidden");

  bulkTotalEl.textContent = cases.length;
  bulkModeradoEl.textContent = totals.moderado;
  bulkGraveEl.textContent = totals.grave;
  bulkExtremoEl.textContent = totals.extremo;

  bulkTbody.innerHTML = "";

  cases.forEach((c) => {
    const tr = document.createElement("tr");
    tr.classList.add(`risk-${c.risk_level}`);

    const tdId = document.createElement("td");
    tdId.textContent = c.id;

    const tdMun = document.createElement("td");
    tdMun.textContent = c.municipio || "-";

    const tdEdad = document.createElement("td");
    tdEdad.textContent = c.edad || "-";

    const tdNivel = document.createElement("td");
    tdNivel.textContent = c.risk_level.toUpperCase();

    const tdScore = document.createElement("td");
    tdScore.textContent = c.risk_score;

    tr.appendChild(tdId);
    tr.appendChild(tdMun);
    tr.appendChild(tdEdad);
    tr.appendChild(tdNivel);
    tr.appendChild(tdScore);

    bulkTbody.appendChild(tr);
  });
}

