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

function safeText(v) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

/**
 * ✅ Fix mojibake típico: "MÃ©rida" => "Mérida"
 * Esto pasa cuando UTF-8 fue interpretado como Latin1.
 */
function fixEncoding(value) {
  if (value === null || value === undefined) return value;
  const s = String(value);

  // Si no tiene patrones raros, no tocar (evita dañar texto normal)
  if (!/[ÃÂ�]/.test(s)) return value;

  try {
    // Re-decoding: bytes latin1 -> utf8
    return decodeURIComponent(escape(s));
  } catch {
    return value;
  }
}

function normalizeRow(row) {
  const out = {};
  Object.entries(row || {}).forEach(([k, v]) => {
    const key = fixEncoding(k);
    const val = typeof v === "string" ? fixEncoding(v) : v;
    out[key] = val;
  });
  return out;
}

// ===============================
// Evaluación local (mock)
// ===============================
function evaluateLocally(description) {
  let text = stripAccents(String(description || "").toLowerCase())
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let score = 0;
  const factors = [];

  const addFactor = (label, points) => {
    if (!factors.includes(label)) {
      factors.push(label);
      score += points;
    }
  };

  const reArmaFuego =
    /\b(pistola|revolver|rev[oó]lver|rifle|escopeta|arma\s+de\s+fuego|disparo|balazo|balas)\b/;
  const reArmaBlanca =
    /\b(cuchill\w*|navaj\w*|machet\w*|punal\w*|apu[nñ]al\w*|cort\w*|taj\w*)\b/;

  const reAsfixia =
    /\b(ahorc\w*|estrang\w*|asfix\w*|sofoc\w*|ahog\w*|le\s+apret\w*\s+el\s+cuello|presion\w*\s+el\s+cuello)\b/;

  const reViolenciaFisica =
    /\b(golpe\w*|peg\w*|pate\w*|empuj\w*|cachete\w*|pu[nñ]etaz\w*|patad\w*|agredi\w*|lesion\w*|lastim\w*)\b/;

  const reViolenciaPrevia =
    /\b(no\s+es\s+la\s+primera\s+vez|ya\s+habia\s+pasado|ya\s+la\s+habia|otra\s+vez|otras\s+veces|siempre|reiterad\w*|constant\w*|desde\s+hace\s+tiempo|frecuent\w*|varias\s+veces)\b/;

  const reControl =
    /\b(celos\w*|control\w*|vigila\w*|acos\w*|revis\w*\s+el\s+tel[eé]fono|no\s+la\s+deja\s+salir|no\s+me\s+deja\s+salir|aisla\w*|no\s+le\s+permite\s+trabajar|no\s+me\s+permite\s+trabajar)\b/;

  const reDesaparicion =
    /\b(desaparec\w*|no\s+regres\w*|no\s+aparec\w*|desconocen\s+su\s+paradero|paradero\s+desconocido)\b/;

  const reAmenaza =
    /\b(amenaz\w*|intimid\w*|advirti\w*|dijo\s+que|me\s+dijo\s+que|le\s+dijo\s+que|advirti[oó]|intento\s+amenazar)\b/;

  const reMatar = /\b(mat\w+)\b/;
  const reAsesinar = /\b(asesin\w+)\b/;
  const reMuerte = /\b(muer\w+)\b/;
  const reQuitarVida =
    /\b(quitar(le)?\s+la\s+vida|privar(le)?\s+de\s+la\s+vida)\b/;

  const reAmenazaDirecta =
    /\b(te|la|lo|me|se|nos|les)\s+(voy|van|va)\s+a\s+(matar|asesinar)\b/;

  const threatByWindow = (() => {
    const idx = text.search(reAmenaza);
    if (idx === -1) return false;
    const windowText = text.slice(Math.max(0, idx - 90), idx + 220);
    return (
      reMatar.test(windowText) ||
      reAsesinar.test(windowText) ||
      reMuerte.test(windowText) ||
      reQuitarVida.test(windowText)
    );
  })();

  const hayAmenazaMuerte =
    reAmenazaDirecta.test(text) ||
    threatByWindow ||
    reQuitarVida.test(text) ||
    /\bamenaza(s)?\s+de\s+muerte\b/.test(text);

  const reRepeticion =
    /\b(2|3|4|5|dos|tres|cuatro|cinco|varias|muchas)\s+veces\b|\breiterad\w*\b|\bconstant\w*\b/;

  const amenazaReiterada = hayAmenazaMuerte && reRepeticion.test(text);

  if (reArmaFuego.test(text)) addFactor("Uso de arma de fuego", 15);
  if (reArmaBlanca.test(text)) addFactor("Uso de arma blanca", 12);

  if (reAsfixia.test(text)) addFactor("Intento de asfixia/estrangulamiento", 18);
  if (hayAmenazaMuerte) addFactor("Amenazas directas de muerte", 15);

  if (reViolenciaFisica.test(text)) addFactor("Violencia física directa", 12);
  if (reViolenciaPrevia.test(text)) addFactor("Antecedentes de violencia reiterada", 12);

  if (reDesaparicion.test(text)) addFactor("Referencia a desaparición", 10);
  if (reControl.test(text)) addFactor("Control y celos extremos", 8);

  const tieneAmenaza = factors.includes("Amenazas directas de muerte");
  const tieneFisica = factors.includes("Violencia física directa");
  const tienePrevia = factors.includes("Antecedentes de violencia reiterada");
  const tieneAsfixiaFactor = factors.includes("Intento de asfixia/estrangulamiento");

  if (tieneAmenaza && tieneFisica) score += 5;
  if (tieneFisica && tienePrevia) score += 4;
  if (tieneAmenaza && tienePrevia) score += 4;

  let level = "moderado";

  if (tieneAsfixiaFactor) {
    level = score >= 28 ? "extremo" : "grave";
  } else if (amenazaReiterada) {
    level = score >= 28 ? "extremo" : "grave";
  } else if (tieneAmenaza && (tieneFisica || tienePrevia)) {
    level = score >= 28 ? "extremo" : "grave";
  } else {
    if (score <= 15) level = "moderado";
    else if (score <= 28) level = "grave";
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
  singleLoading.hidden = !isLoading;
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
      if (singleLoading) singleLoading.hidden = true;
    }
  });
}

function renderResult(caseData) {
  if (singleLoading) singleLoading.hidden = true;

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

// ✅ MODAL (DETALLE)
const bulkModal = document.getElementById("bulk-modal");
const bulkModalClose = document.getElementById("bulk-modal-close");
const bulkModalCopy = document.getElementById("bulk-modal-copy");
const bulkCopyStatus = document.getElementById("bulk-copy-status");

const bulkModalSubtitle = document.getElementById("bulk-modal-subtitle");
const bulkModalSummary = document.getElementById("bulk-modal-summary");
const bulkModalFactors = document.getElementById("bulk-modal-factors");
const bulkModalCsv = document.getElementById("bulk-modal-csv");
const bulkModalDesc = document.getElementById("bulk-modal-desc");

let bulkSelectedCase = null;

// ✅ Estado global para filtros
let bulkAllCases = [];
let bulkCurrentFilter = "all";
let bulkTotals = { moderado: 0, grave: 0, extremo: 0 };

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

  bulkAllCases = [];
  bulkCurrentFilter = "all";

  document.querySelectorAll("#bulk-summary .chip").forEach((b) => {
    b.classList.remove("is-active");
  });
  const btnAll = document.querySelector('#bulk-summary .chip[data-filter="all"]');
  if (btnAll) btnAll.classList.add("is-active");
}

function getFilteredCases(cases, filter) {
  if (filter === "all") return cases;
  return cases.filter((c) => c.risk_level === filter);
}

function setActiveChip(filter) {
  document.querySelectorAll("#bulk-summary .chip").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.filter === filter);
  });
}

// ✅ MODAL helpers
function buildCopyText(caseObj) {
  const nivel = String(caseObj.risk_level || "").toUpperCase();
  const factores = (caseObj.risk_factors || []).map((f) => `- ${f}`).join("\n");
  const desc = safeText(caseObj.descripcion);

  return `RESUMEN DE CASO (Valoración de riesgo feminicida - Prototipo)
ID: ${safeText(caseObj.id)}
Municipio: ${safeText(caseObj.municipio)}
Edad víctima: ${safeText(caseObj.edad)}
Nivel de riesgo: ${nivel}
Puntaje: ${safeText(caseObj.risk_score)}

Factores detectados:
${factores || "- —"}

Descripción del hecho:
${desc}
`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback antiguo
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      document.body.removeChild(ta);
      return false;
    }
  }
}

function showCopyStatus() {
  if (!bulkCopyStatus) return;
  bulkCopyStatus.hidden = false;
  clearTimeout(showCopyStatus._t);
  showCopyStatus._t = setTimeout(() => {
    bulkCopyStatus.hidden = true;
  }, 1200);
}

function openBulkModal(caseObj) {
  if (!bulkModal) return;
  bulkSelectedCase = caseObj;

  if (bulkCopyStatus) bulkCopyStatus.hidden = true;

  if (bulkModalSubtitle) {
    bulkModalSubtitle.textContent =
      `ID: ${safeText(caseObj.id)} · Nivel: ${String(caseObj.risk_level || "").toUpperCase()} · Puntaje: ${safeText(caseObj.risk_score)}`;
  }

  if (bulkModalSummary) {
    bulkModalSummary.innerHTML = `
      <div class="k">Municipio</div><div class="v">${safeText(caseObj.municipio)}</div>
      <div class="k">Edad</div><div class="v">${safeText(caseObj.edad)}</div>
      <div class="k">Nivel</div><div class="v">${String(caseObj.risk_level || "").toUpperCase()}</div>
      <div class="k">Puntaje</div><div class="v">${safeText(caseObj.risk_score)}</div>
    `;
  }

  if (bulkModalFactors) {
    bulkModalFactors.innerHTML = "";
    const list = Array.isArray(caseObj.risk_factors) ? caseObj.risk_factors : [];
    (list.length ? list : ["—"]).forEach((f) => {
      const li = document.createElement("li");
      li.textContent = safeText(f);
      bulkModalFactors.appendChild(li);
    });
  }

  if (bulkModalDesc) {
    bulkModalDesc.textContent = safeText(caseObj.descripcion);
  }

    if (bulkModalCsv) {
    bulkModalCsv.innerHTML = "";

    const raw = caseObj.raw || {};

    // ✅ Columnas que suelen contener la misma descripción (para no duplicar)
    const DESC_KEYS = new Set([
      "hecho_descripcion",
      "descripcion_hecho",
      "descripcion_hecho_extensa",
      "descripcion",
      "hechos",
    ]);

    Object.entries(raw).forEach(([k, v]) => {
      // ✅ si es una columna de descripción, la saltamos (ya se muestra arriba)
      if (DESC_KEYS.has(String(k).trim())) return;

      const tr = document.createElement("tr");

      const tdK = document.createElement("td");
      tdK.textContent = k;

      const tdV = document.createElement("td");
      tdV.textContent = safeText(v);

      tr.append(tdK, tdV);
      bulkModalCsv.appendChild(tr);
    });
  }

  bulkModal.hidden = false;
}

function closeBulkModal() {
  if (!bulkModal) return;
  bulkModal.hidden = true;
  bulkSelectedCase = null;
}

if (bulkModal) {
  bulkModal.addEventListener("click", (e) => {
    if (e.target === bulkModal) closeBulkModal();
  });
}
if (bulkModalClose) {
  bulkModalClose.addEventListener("click", closeBulkModal);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && bulkModal && !bulkModal.hidden) closeBulkModal();
});

if (bulkModalCopy) {
  bulkModalCopy.addEventListener("click", async () => {
    if (!bulkSelectedCase) return;
    const ok = await copyToClipboard(buildCopyText(bulkSelectedCase));
    if (ok) showCopyStatus();
  });
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
          // ✅ Normalizamos TODAS las filas por si vienen con mojibake
          const normalizedRows = (results.data || []).map(normalizeRow);

          handleCsvData(normalizedRows);
          setBulkLoading(false, "Archivo procesado correctamente");
          if (bulkLoading) bulkLoading.hidden = true;
        } catch (e) {
          console.error(e);
          setBulkLoading(false, "");
          if (bulkLoading) bulkLoading.hidden = true;
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
        if (bulkLoading) bulkLoading.hidden = true;
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
      id: fixEncoding(getId(row, idx)),
      municipio: fixEncoding(getMunicipio(row)),
      edad: fixEncoding(getEdad(row)),
      risk_level: level,
      risk_score: evalRes.risk_score ?? 0,
      risk_factors: evalRes.risk_factors || [],
      raw: row,
      descripcion: fixEncoding(desc),
    });
  });

  bulkAllCases = processed;
  bulkTotals = { moderado: countModerado, grave: countGrave, extremo: countExtremo };

  renderBulkTable(getFilteredCases(bulkAllCases, bulkCurrentFilter), bulkTotals);
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

  if (bulkTotalEl) bulkTotalEl.textContent = bulkAllCases.length;
  if (bulkModeradoEl) bulkModeradoEl.textContent = totals.moderado;
  if (bulkGraveEl) bulkGraveEl.textContent = totals.grave;
  if (bulkExtremoEl) bulkExtremoEl.textContent = totals.extremo;

  if (!bulkSummary.dataset.filtersReady) {
    bulkSummary.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-filter]");
      if (!btn) return;

      bulkCurrentFilter = btn.dataset.filter || "all";
      setActiveChip(bulkCurrentFilter);

      const filtered = getFilteredCases(bulkAllCases, bulkCurrentFilter);
      renderBulkTable(filtered, bulkTotals);
    });
    bulkSummary.dataset.filtersReady = "1";
  }

  bulkTbody.innerHTML = "";

  cases.forEach((c) => {
    const tr = document.createElement("tr");
    tr.classList.add(`risk-${c.risk_level}`);

    const tdId = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link-btn";
    btn.textContent = safeText(c.id);
    btn.addEventListener("click", () => openBulkModal(c));
    tdId.appendChild(btn);

    const tdMun = document.createElement("td");
    tdMun.textContent = safeText(c.municipio);

    const tdEdad = document.createElement("td");
    tdEdad.textContent = safeText(c.edad);

    const tdNivel = document.createElement("td");
    tdNivel.textContent = String(c.risk_level || "").toUpperCase();

    const tdScore = document.createElement("td");
    tdScore.textContent = c.risk_score;

    tr.append(tdId, tdMun, tdEdad, tdNivel, tdScore);
    bulkTbody.appendChild(tr);
  });
}

// ✅ Evitar que loaders aparezcan al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  if (singleLoading) singleLoading.hidden = true;
  if (bulkLoading) bulkLoading.hidden = true;
});
