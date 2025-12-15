// ===============================
// Configuración
// ===============================
const API_URL = "http://127.0.0.1:8000/api";
const USE_MOCK_EVALUATION = true;

// ===============================
// Utilidades
// ===============================
function stripAccents(text) {
  const map = {
    á: "a", à: "a", ä: "a", â: "a", Á: "a", À: "a", Ä: "a", Â: "a",
    é: "e", è: "e", ë: "e", ê: "e", É: "e", È: "e", Ë: "e", Ê: "e",
    í: "i", ì: "i", ï: "i", î: "i", Í: "i", Ì: "i", Ï: "i", Î: "i",
    ó: "o", ò: "o", ö: "o", ô: "o", Ó: "o", Ò: "o", Ö: "o", Ô: "o",
    ú: "u", ù: "u", ü: "u", û: "u", Ú: "u", Ù: "u", Ü: "u", Û: "u",
    ñ: "n", Ñ: "n",
  };
  return String(text).replace(/[^\u0000-\u007E]/g, (a) => map[a] || a);
}

// ===============================
// Evaluación local (mock)
// ===============================
function evaluateLocally(description) {
  // Normalización agresiva para recall
  let text = stripAccents(String(description || "").toLowerCase())
    .replace(/[^\w\s]/g, " ")     // quita puntuación
    .replace(/\s+/g, " ")        // colapsa espacios
    .trim();

  let score = 0;
  const factors = [];
  const reasons = []; // 👈 auditoría: qué disparó

  const addFactor = (label, points, reason) => {
    if (!factors.includes(label)) {
      factors.push(label);
      score += points;
    }
    if (reason) reasons.push(reason);
  };

  // ===============================
  // Patrones por raíces (RECALL)
  // ===============================

  // Armas
  const reArmaFuego = /\b(pistola|revolver|rev[oó]lver|rifle|escopeta|arma\s+de\s+fuego|disparo|balazo|balas)\b/;
  const reArmaBlanca = /\b(cuchill\w*|navaj\w*|machet\w*|punal\w*|apu[nñ]al\w*|cort\w*|taj\w*)\b/;

  // Asfixia / estrangulamiento (factor crítico)
  const reAsfixia = /\b(ahorc\w*|estrang\w*|asfix\w*|sofoc\w*|ahog\w*|le\s+apreto\s+el\s+cuello|le\s+apret\w*\s+el\s+cuello|presion\w*\s+el\s+cuello)\b/;

  // Violencia física (raíces comunes)
  const reViolenciaFisica = /\b(golpe\w*|peg\w*|pate\w*|empuj\w*|cachete\w*|pu[nñ]etaz\w*|patad\w*|agredi\w*|lesion\w*|lastim\w*)\b/;

  // Violencia reiterada / previa (indicadores)
  const reViolenciaPrevia = /\b(no\s+es\s+la\s+primera\s+vez|ya\s+habia\s+pasado|ya\s+la\s+habia|otra\s+vez|otras\s+veces|siempre|reiterad\w*|constant\w*|desde\s+hace\s+tiempo|frecuent\w*|varias\s+veces)\b/;

  // Control/celos (raíces)
  const reControl = /\b(celos\w*|control\w*|vigila\w*|acos\w*|amenaz\w*\s+con\s+quitarl(e|a)\s+el\s+telefono|revis\w*\s+el\s+tel[eé]fono|no\s+la\s+deja\s+salir|no\s+me\s+deja\s+salir|aisla\w*|no\s+le\s+permite\s+trabajar|no\s+me\s+permite\s+trabajar)\b/;

  // Desaparición
  const reDesaparicion = /\b(desaparec\w*|no\s+regres\w*|no\s+aparec\w*|desconocen\s+su\s+paradero|paradero\s+desconocido)\b/;

  // ===============================
  // Amenaza de muerte (RECALL)
  // ===============================

  // Familias raíz
  const reAmenaza = /\b(amenaz\w*|intimid\w*|advirti\w*|dijo\s+que|me\s+dijo\s+que|le\s+dijo\s+que|advirti[oó]|intento\s+amenazar)\b/;
  const reMatar = /\b(mat\w+)\b/;          // mata, mataré, matarte, matarla, matanza...
  const reAsesinar = /\b(asesin\w+)\b/;    // asesinar, asesinato, asesinarla...
  const reMuerte = /\b(muer\w+)\b/;        // muerte, muerta, muerto...
  const reQuitarVida = /\b(quitar(le)?\s+la\s+vida|privar(le)?\s+de\s+la\s+vida)\b/;

  // Amenaza directa muy fuerte (casi siempre)
  const reAmenazaDirecta = /\b(te|la|lo|me|se|nos|les)\s+(voy|van|va)\s+a\s+(matar|asesinar)\b/;

  // Amenaza por co-ocurrencia en ventana (RECALL): si aparece "amenaz*" cerca de "mat*/asesin*/muer*/quitar vida"
  const threatByWindow = (() => {
    const idx = text.search(reAmenaza);
    if (idx === -1) return false;
    const window = text.slice(Math.max(0, idx - 90), idx + 220);
    return reMatar.test(window) || reAsesinar.test(window) || reMuerte.test(window) || reQuitarVida.test(window);
  })();

  const hayAmenazaMuerte =
    reAmenazaDirecta.test(text) ||
    threatByWindow ||
    reQuitarVida.test(text) ||
    // Para recall: si aparece "amenaza de muerte" aunque no haya verbo matar
    /\bamenaza(s)?\s+de\s+muerte\b/.test(text);

  // ===============================
  // Aplicación de factores (con puntaje)
  // ===============================

  if (reArmaFuego.test(text)) addFactor("Uso de arma de fuego", 15, "match: arma_fuego");
  if (reArmaBlanca.test(text)) addFactor("Uso de arma blanca", 12, "match: arma_blanca");

  if (reAsfixia.test(text)) addFactor("Intento de asfixia/estrangulamiento", 18, "match: asfixia");

  // Amenaza de muerte es crítica: para recall la marcamos si cualquiera de las reglas dispara
  if (hayAmenazaMuerte) addFactor("Amenazas directas de muerte", 15, "match: amenaza_muerte");

  if (reViolenciaFisica.test(text)) addFactor("Violencia física directa", 12, "match: violencia_fisica");
  if (reViolenciaPrevia.test(text)) addFactor("Antecedentes de violencia reiterada", 12, "match: violencia_previa");
  if (reDesaparicion.test(text)) addFactor("Referencia a desaparición", 10, "match: desaparicion");
  if (reControl.test(text)) addFactor("Control y celos extremos", 8, "match: control_celos");

  // ===============================
  // Combos (suben recall de grave/extremo)
  // ===============================
  const tieneAmenaza = factors.includes("Amenazas directas de muerte");
  const tieneFisica = factors.includes("Violencia física directa");
  const tienePrevia = factors.includes("Antecedentes de violencia reiterada");
  const tieneAsfixiaFactor = factors.includes("Intento de asfixia/estrangulamiento");

  if (tieneAmenaza && tieneFisica) score += 5;
  if (tieneFisica && tienePrevia) score += 4;
  if (tieneAmenaza && tienePrevia) score += 4;

  // ===============================
  // Nivel (RECALL: umbrales más bajos + reglas duras)
  // ===============================
  let level = "moderado";

  // Regla dura: asfixia casi nunca es moderado
  if (tieneAsfixiaFactor) {
    level = score >= 28 ? "extremo" : "grave";
  } else if (tieneAmenaza && (tieneFisica || tienePrevia)) {
    level = score >= 28 ? "extremo" : "grave";
  } else {
    // Umbrales más sensibles (recall)
    if (score <= 15) level = "moderado";
    else if (score <= 28) level = "grave";
    else level = "extremo";
  }

  return {
    risk_score: score,
    risk_level: level,
    risk_factors: factors.length ? factors : ["Sin factores de alto riesgo identificados en el texto analizado"],
    // reasons, // 👈 si luego quieres mostrar auditoría en UI, descomenta
  };
}


// ===============================
// UI - Individual
// ===============================
const form = document.getElementById("case-form");
const errorBox = document.getElementById("form-error");

const resultEmpty = document.getElementById("result-empty");
const resultContent = document.getElementById("result-content");
const riskLevelEl = document.getElementById("risk-level");
const riskScoreEl = document.getElementById("risk-score");
const factorsListEl = document.getElementById("risk-factors-list");
const recommendationsEl = document.getElementById("recommendations-list");

const singleLoading = document.getElementById("single-loading");

function setSingleLoading(isLoading) {
  if (!singleLoading) return;
  singleLoading.hidden = !isLoading; // true -> visible, false -> hidden
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = "";
    }

    const formData = new FormData(form);
    const payload = {
      victim_name: formData.get("victim_name") || null,
      victim_age: formData.get("victim_age") ? Number(formData.get("victim_age")) : null,
      municipality: formData.get("municipality") || null,
      aggressor_relation: formData.get("aggressor_relation") || null,
      description: (formData.get("description") || "").trim(),
    };

    if (!payload.description) {
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = "La descripción de los hechos es obligatoria.";
      }
      return;
    }

    try {
      setSingleLoading(true);

      let data;
      if (USE_MOCK_EVALUATION) {
        data = {
          message: "Caso evaluado localmente (modo demo)",
          data: { id: null, ...payload, ...evaluateLocally(payload.description) },
        };
      } else {
        const res = await fetch(`${API_URL}/cases`, {
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
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent =
          err.message || "Ocurrió un error al evaluar el caso. Intenta nuevamente.";
      }
    } finally {
      setSingleLoading(false);
    }
  });
}

function renderResult(caseData) {
  if (resultEmpty) resultEmpty.classList.add("hidden");
  if (resultContent) resultContent.classList.remove("hidden");

  const level = caseData.risk_level || "moderado";
  if (riskLevelEl) {
    riskLevelEl.textContent = level.toUpperCase();
    riskLevelEl.classList.remove("badge-moderado", "badge-grave", "badge-extremo");
    riskLevelEl.classList.add(`badge-${level}`);
  }

  if (riskScoreEl) riskScoreEl.textContent = caseData.risk_score ?? 0;

  if (factorsListEl) {
    factorsListEl.innerHTML = "";
    (caseData.risk_factors || []).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f;
      factorsListEl.appendChild(li);
    });
  }

  if (recommendationsEl) {
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
    } else {
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
}

// ===============================
// UI - Evaluación masiva CSV
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

function resetBulkUI() {
  if (bulkError) {
    bulkError.hidden = true;
    bulkError.textContent = "";
  }
  if (bulkStatus) bulkStatus.textContent = "";
  if (bulkSummary) bulkSummary.classList.add("hidden");
  if (bulkTableWrapper) bulkTableWrapper.classList.add("hidden");
  if (bulkTbody) bulkTbody.innerHTML = "";
}

if (csvInput && processCsvBtn) {
  csvInput.addEventListener("change", () => {
    resetBulkUI();
    if (bulkFileName) {
      bulkFileName.textContent = csvInput.files[0]
        ? `Archivo seleccionado: ${csvInput.files[0].name}`
        : "";
    }
  });

  processCsvBtn.addEventListener("click", () => {
    resetBulkUI();

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
          setBulkLoading(false, "Archivo procesado correctamente");
        } catch (e) {
          console.error(e);
          setBulkLoading(false, "");
          if (bulkError) {
            bulkError.hidden = false;
            bulkError.textContent =
              "Ocurrió un error al procesar el archivo. Verifica que tenga la columna de descripción del hecho.";
          }
        }
      },
      error: (err) => {
        console.error(err);
        setBulkLoading(false, "");
        if (bulkError) {
          bulkError.hidden = false;
          bulkError.textContent = "No se pudo leer el archivo CSV. Verifica el formato.";
        }
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
    row.hechos ||
    "";

  const getId = (row, idx) =>
    row.euv_caso || row.euv || row.id || row.ID || `Caso ${idx + 1}`;

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
  if (!bulkSummary || !bulkTableWrapper || !bulkTbody) {
    throw new Error("Faltan elementos del DOM para la tabla masiva (IDs no coinciden).");
  }

  if (!cases.length) {
    bulkSummary.classList.add("hidden");
    bulkTableWrapper.classList.add("hidden");
    if (bulkError) {
      bulkError.hidden = false;
      bulkError.textContent =
        "No se encontraron registros con descripción de hechos para analizar.";
    }
    return;
  }

  bulkSummary.classList.remove("hidden");
  bulkTableWrapper.classList.remove("hidden");

  if (bulkTotalEl) bulkTotalEl.textContent = cases.length;
  if (bulkModeradoEl) bulkModeradoEl.textContent = totals.moderado;
  if (bulkGraveEl) bulkGraveEl.textContent = totals.grave;
  if (bulkExtremoEl) bulkExtremoEl.textContent = totals.extremo;

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
    tdNivel.textContent = String(c.risk_level || "").toUpperCase();

    const tdScore = document.createElement("td");
    tdScore.textContent = c.risk_score;

    tr.append(tdId, tdMun, tdEdad, tdNivel, tdScore);
    bulkTbody.appendChild(tr);
  });
}

// ===============================
// ✅ Evitar que loaders aparezcan al cargar la página
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  if (singleLoading) singleLoading.hidden = true;
  if (bulkLoading) bulkLoading.hidden = true;
});
