export type LogEntry = {
  type: "info" | "warn" | "error" | "success" | "dim";
  message: string;
  ts: string;
};

export type ETLResult = {
  rows: Record<string, unknown>[];
  cols: string[];
  logs: LogEntry[];
};

function ts(): string {
  return new Date().toISOString().split("T")[1].split(".")[0];
}

function mkLog(type: LogEntry["type"], message: string): LogEntry {
  return { type, message, ts: ts() };
}

function trimVal(v: unknown): unknown {
  return typeof v === "string" ? v.trim() : v;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s_\-]+/g, "_").trim();
}

function buildNormMap(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  headers.forEach((h) => { m[normalizeKey(h)] = h; });
  return m;
}

function resolveCol(nm: Record<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    const nk = normalizeKey(c);
    if (nm[nk]) return nm[nk];
  }
  return null;
}

function getVal(row: Record<string, unknown>, col: string | null): unknown {
  if (!col) return "";
  const v = row[col];
  return typeof v === "string" ? v.trim() : v;
}

/* ─── LAYOUT FILTER HELPER ─── */
function filterByLayout(
  data: Record<string, unknown>[],
  headers: string[],
  layout: string[],
  aliases: Record<string, string[]>,
  label: string,
  logs: LogEntry[]
): ETLResult {
  const nm = buildNormMap(headers);
  const colMap: Record<string, string | null> = {};

  layout.forEach((col) => {
    const found = resolveCol(nm, [col, ...(aliases[col] || [])]);
    if (found) {
      colMap[col] = found;
      logs.push(mkLog("dim", `Mapeado: "${col}" ← "${found}"`));
    } else {
      logs.push(mkLog("warn", `[ADVERTENCIA] Columna "${col}" no encontrada. Se dejará vacía.`));
      colMap[col] = null;
    }
  });

  const rows = data.map((r) => {
    const out: Record<string, unknown> = {};
    layout.forEach((col) => { out[col] = colMap[col] ? getVal(r, colMap[col]) : ""; });
    return out;
  });

  logs.push(mkLog("info", `${rows.length} filas estructuradas · ${label}`));
  return { rows, cols: layout, logs };
}

/* ─── CASO 1: CLIENTES ─── */
export function processClientes(
  data: Record<string, unknown>[],
  headers: string[]
): ETLResult {
  const logs: LogEntry[] = [];
  const nm = buildNormMap(headers);

  const cEstado = resolveCol(nm, ["estado bc", "estado_bc", "bc"]);
  const cAgencia = resolveCol(nm, ["cod_agencia", "codigo agencia"]);
  const cDescAg = resolveCol(nm, ["agencia", "descripcion agencia"]);
  const cAsesor = resolveCol(nm, ["cod_asesor", "codigo asesor"]);
  const cNomAs = resolveCol(nm, ["asesor_servicios", "nombre_asesor"]);
  const cCodAc = resolveCol(nm, ["cod_ac", "codigo_ac", "codigo asociacion"]);
  const cAsoc = resolveCol(nm, ["asociacion_comunal", "asociacion_co"]);
  const cSit = resolveCol(nm, ["situación", "situacion", "estado_cliente"]);

  const toStr = (v: unknown) => String(v ?? "");
  if (!cEstado) {
    logs.push(mkLog("warn", "[ADVERTENCIA] ESTADO BC no encontrado. Omitiendo filtro CASTIGADO."));
  }

  // ─── FILTRO CASTIGADO ───
  const before = data.length;
  const filtered = cEstado
    ? data.filter((r) => toStr(getVal(r, cEstado)).toUpperCase().trim() !== "CASTIGADO")
    : data;

  logs.push(
    mkLog("info", `Filtro CASTIGADO: ${before - filtered.length} removidos · ${filtered.length} restantes`)
  );

  // ─── CONTADORES (single pass) ───
  const acMap = new Map<string, number>();
  const asMap = new Map<string, number>();
  const keys = new Array<{ asK: string; acK: string }>(filtered.length);

  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    const asK = toStr(getVal(r, cAsesor));
    const acK = `${toStr(getVal(r, cCodAc))}|${asK}`;
    keys[i] = { asK, acK };
    acMap.set(acK, (acMap.get(acK) || 0) + 1);
    asMap.set(asK, (asMap.get(asK) || 0) + 1);
  }

  logs.push(mkLog("info", "Columnas AC y AS calculadas (CONTAR.SI.CONJUNTO / CONTAR.SI)"));

  const cols = [
    "codigo_agency",
    "desc_agencia",
    "codigo_asesor",
    "asesor",
    "codigo_asociacion",
    "asociacion",
    "Situación",
    "Num_clientes_AC",
    "Num_clientes_AS",
  ];

  // ─── GENERACIÓN + DEDUP (single pass) ───
  const uniqueMap = new Map<string, any>();
  let duplicates = 0;

  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    const codigo_agency = getVal(r, cAgencia);
    const codigo_asesor = getVal(r, cAsesor);
    const codigo_asociacion = getVal(r, cCodAc);
    const dedupKey = `${codigo_agency}|${codigo_asesor}|${codigo_asociacion}`;

    if (uniqueMap.has(dedupKey)) {
      duplicates++;
      continue;
    }

    const { asK, acK } = keys[i];

    uniqueMap.set(dedupKey, {
      codigo_agency,
      desc_agencia: toStr(getVal(r, cDescAg)).trim(),
      codigo_asesor,
      asesor: toStr(getVal(r, cNomAs)).trim(),
      codigo_asociacion,
      asociacion: toStr(getVal(r, cAsoc)).trim(),
      "Situación": toStr(getVal(r, cSit)).toUpperCase().trim(),
      Num_clientes_AC: acMap.get(acK) || 0,
      Num_clientes_AS: asMap.get(asK) || 0,
    });
  }

  logs.push(mkLog("info", `Duplicados removidos: ${duplicates}`));
  return { rows: Array.from(uniqueMap.values()), cols, logs };
}

/* ─── CASO 2: CLIENTES IN ─── */
export function processClientesIN(data: Record<string, unknown>[], headers: string[]): ETLResult { // TODO: validar campos de carga de los casos 2-6.
  const logs: LogEntry[] = [];
  const layout = ["AGENCIA", "CODIGO AS", "ASESOR DE SERVICIO", "CODIGO AC", "ASOCIACION COMUNAL", "CODIGO CLIENTE", "NOMBRE CLIENTE", "TIPO SOCIO", "Mes"];
  const aliases: Record<string, string[]> = {
    "AGENCIA": ["agencia", "desc_agencia"], "CODIGO AS": ["codigo_asesor", "cod_asesor"],
    "ASESOR DE SERVICIO": ["asesor", "asesor_servicios"], "CODIGO AC": ["codigo_ac", "cod_ac", "codigo_asociacion"],
    "ASOCIACION COMUNAL": ["asociacion_comunal", "asociacion"], "CODIGO CLIENTE": ["codigo_cliente", "cod_cliente"],
    "NOMBRE CLIENTE": ["nombre_cliente", "cliente"], "TIPO SOCIO": ["tipo_socio", "tipo socio"],
    "Mes": ["mes", "month", "periodo"],
  };
  return filterByLayout(data, headers, layout, aliases, "CLIENTES IN", logs);
}

/* ─── CASO 3: CLIENTES OUT ─── */
export function processClientesOUT(data: Record<string, unknown>[], headers: string[]): ETLResult {
  const logs: LogEntry[] = [];
  const layout = ["AGENCIA", "CODIGO AS", "ASESOR DE SERVICIO", "CODIGO AC", "ASOCIACION COMUNAL", "CODIGO CLIENTE", "NOMBRE CLIENTE", "TIPO SOCIO", "MOTIVO SALIDA", "Mes"];
  const aliases: Record<string, string[]> = {
    "AGENCIA": ["agencia", "desc_agencia"], "CODIGO AS": ["codigo_asesor", "cod_asesor"],
    "ASESOR DE SERVICIO": ["asesor", "asesor_servicios"], "CODIGO AC": ["codigo_ac", "cod_ac"],
    "ASOCIACION COMUNAL": ["asociacion_comunal", "asociacion"], "CODIGO CLIENTE": ["codigo_cliente", "cod_cliente"],
    "NOMBRE CLIENTE": ["nombre_cliente", "cliente"], "TIPO SOCIO": ["tipo_socio"],
    "MOTIVO SALIDA": ["motivo_salida", "motivo salida", "causa_salida"], "Mes": ["mes", "periodo"],
  };
  return filterByLayout(data, headers, layout, aliases, "CLIENTES OUT", logs);
}

/* ─── CASO 4: COLOCACIONES ─── */
export function processColocaciones(data: Record<string, unknown>[], headers: string[]): ETLResult {
  const logs: LogEntry[] = [];
  const layout = ["cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "cod_cliente", "cliente", "documento", "num_credito", "cod_tipo_credito", "tipo_credito", "fecha_desembolso", "monto_colocado", "modalidad", "estado_credito"];
  const aliases: Record<string, string[]> = {
    "cod_agencia": ["codigo_agencia", "cod agencia"], "agencia": ["desc_agencia", "nombre_agencia"],
    "cod_asesor": ["codigo_asesor", "codigo as"], "asesor_servicios": ["asesor", "nombre_asesor"],
    "cod_ac": ["codigo_ac", "cod_asociacion"], "asociacion_comunal": ["asociacion"],
    "cod_cliente": ["codigo_cliente"], "cliente": ["nombre_cliente"],
    "documento": ["dni", "numero_documento"], "num_credito": ["numero_credito", "nro_credito"],
    "cod_tipo_credito": ["cod_producto", "tipo_credito_cod"], "tipo_credito": ["producto"],
    "fecha_desembolso": ["fecha desembolso", "fecha_colocacion", "fecha"],
    "monto_colocado": ["monto", "importe"], "modalidad": ["mod_pago", "modalidad_pago"],
    "estado_credito": ["estado", "estado credito"],
  };
  return filterByLayout(data, headers, layout, aliases, "COLOCACIONES", logs);
}

/* ─── CASO 5: CARTERA ─── */
export function processCartera(data: Record<string, unknown>[], headers: string[]): ETLResult {
  const logs: LogEntry[] = [];
  const nm = buildNormMap(headers);
  const layout = ["cod_agencia", "agencia", "cod_asesor", "asesor_servicios", "cod_ac", "asociacion_comunal", "num_credito", "Cod_tipo_credito", "tipo_credito", "monto_colocado", "saldo_capital", "saldo_total", "dias_atraso", "capital_mora", "situacion", "clasificacion", "Mes", "provision", "zona_geografica_ac"];
  const aliases: Record<string, string[]> = {
    "cod_agencia": ["codigo_agencia"], "agencia": ["desc_agencia"],
    "cod_asesor": ["codigo_asesor"], "asesor_servicios": ["asesor", "asesor de servicios"],
    "cod_ac": ["codigo_ac", "cod_asociacion"], "asociacion_comunal": ["asociacion", "asociacion comunal"],
    "num_credito": ["numero_credito"], "Cod_tipo_credito": ["cod_tipo_credito"],
    "tipo_credito": ["Tipo_credito", "nombre_producto"], "monto_colocado": ["monto"],
    "saldo_capital": ["capital", "saldo cap"], "saldo_total": ["saldo total"],
    "dias_atraso": ["dias de atraso", "dias_mora"], "capital_mora": ["mora_capital"],
    "situacion": ["situación"], "clasificacion": ["clasif"],
    "Mes": ["mes", "periodo"], "provision": ["provision_requerida"],
    "zona_geografica_ac": ["zona_geo_ac", "zona_geografica"],
  };

  const colMap: Record<string, string | null> = {};
  layout.forEach((col) => {
    const found = resolveCol(nm, [col, ...(aliases[col] || [])]);
    if (found) {
      colMap[col] = found;
      logs.push(mkLog("dim", `OK: "${col}" ← "${found}"`));
    } else {
      if (col === "Cod_tipo_credito") {
        const alt = resolveCol(nm, ["cod_tipo_credito"]);
        if (alt) { colMap[col] = alt; logs.push(mkLog("warn", `[ADVERTENCIA] Cod_tipo_credito no encontrado → mapeado desde "${alt}"`)); }
        else { colMap[col] = null; logs.push(mkLog("warn", `[ADVERTENCIA] Cod_tipo_credito sin alias. Se dejará vacía.`)); }
      } else if (col === "tipo_credito") {
        const alt = resolveCol(nm, ["Tipo_credito"]);
        if (alt) { colMap[col] = alt; logs.push(mkLog("warn", `[ADVERTENCIA] tipo_credito no encontrado → mapeado desde "${alt}"`)); }
        else { colMap[col] = null; }
      } else {
        logs.push(mkLog("warn", `[ADVERTENCIA] "${col}" no encontrada.`));
        colMap[col] = null;
      }
    }
  });

  const rows = data.map((r) => {
    const out: Record<string, unknown> = {};
    layout.forEach((col) => { out[col] = colMap[col] ? getVal(r, colMap[col]) : ""; });
    return out;
  });
  logs.push(mkLog("info", `${rows.length} registros reordenados según spec Cartera`));
  return { rows, cols: layout, logs };
}

/* ─── CASO 6: FONDO COMÚN ─── */
export function processFondoComun(
  data: Record<string, unknown>[],
  headers: string[],
  rawRows?: unknown[][],          // ← filas crudas (necesarias para saltar fila 1)
  headerRowIndex?: number
): ETLResult {
  const logs: LogEntry[] = [];

  // ── 1. AJUSTE ESTRUCTURAL: si llegan filas crudas, reasignar headers desde fila 2
  // La fila 0 = título combinado (se descarta), fila 1 = headers reales
  // Esta lógica se activa solo cuando el caller pasa rawRows
  let workData = data;
  let workHeaders = headers;

  if (rawRows && rawRows.length >= 2) {
    const detectedIndex = headerRowIndex ?? 0;

    if (detectedIndex === 1) {
      // ✔ Se detectó y eliminó la fila título (celda combinada)
      const titleCellContent = String((rawRows[0] as unknown[])[0] ?? "").trim();
      logs.push(mkLog("success",
        `Fila 1 detectada como título/celda combinada: "${titleCellContent.slice(0, 60)}${titleCellContent.length > 60 ? "…" : ""}" → eliminada correctamente.`
      ));
      logs.push(mkLog("info",
        `Headers tomados de fila 2 (${(rawRows[1] as unknown[]).filter((c) => String(c ?? "").trim() !== "").length} columnas con contenido).`
      ));
    } else {
      // ⚠ No se detectó fila título — la fila 1 ya era de headers
      logs.push(mkLog("warn",
        `[ADVERTENCIA] No se detectó fila título/celda combinada. La fila 1 fue tratada directamente como encabezados.`
      ));
      logs.push(mkLog("dim",
        `  → Primera fila: "${(rawRows[0] as unknown[]).slice(0, 4).map((c) => String(c ?? "")).join(" | ")}…"`
      ));
    }

    // Reasignar headers y datos desde rawRows para garantizar consistencia
    workHeaders = (rawRows[detectedIndex] as unknown[]).map((h) => String(h ?? "").trim());
    workData = (rawRows.slice(detectedIndex + 1) as unknown[][])
      .filter((row) => row.some((c) => String(c ?? "").trim() !== ""))  // descartar filas vacías
      .map((row) => {
        const obj: Record<string, unknown> = {};
        workHeaders.forEach((h, i) => { obj[h] = row[i] ?? ""; });
        return obj;
      });

    logs.push(mkLog("dim", `Filas de datos tras ajuste estructural: ${workData.length}`));
  }

  // ── 2. FILTROS DE NEGOCIO
  const nm = buildNormMap(workHeaders);

  const cEstadoCredito = resolveCol(nm, ["Estado credito", "estado_credito", "estadocredito"]);
  const cEstadoBanco = resolveCol(nm, ["Estado banco", "estado_banco", "estadobanco"]);

  if (!cEstadoCredito) logs.push(mkLog("warn", "[ADVERTENCIA] Columna 'Estado credito' no encontrada. Filtro CASTIGADO omitido."));
  if (!cEstadoBanco) logs.push(mkLog("warn", "[ADVERTENCIA] Columna 'Estado banco' no encontrada. Filtro CERRADO omitido."));

  const before = workData.length;
  workData = workData.filter((r) => {
    const ec = String(getVal(r, cEstadoCredito) ?? "").toUpperCase().trim();
    const eb = String(getVal(r, cEstadoBanco) ?? "").toUpperCase().trim();
    return ec !== "CASTIGADO" && eb !== "CERRADO";
  });
  logs.push(mkLog("info", `Filtros de negocio: ${before - workData.length} filas excluidas (CASTIGADO / CERRADO) · ${workData.length} restantes`));

  // ── 3. HELPER: split por primer guion
  function leftOf(val: unknown): string {
    const s = String(val ?? "").trim();
    const idx = s.indexOf("-");
    return idx === -1 ? s : s.slice(0, idx).trim();
  }
  function rightOf(val: unknown): string {
    const s = String(val ?? "").trim();
    const idx = s.indexOf("-");
    return idx === -1 ? s : s.slice(idx + 1).trim();
  }
  function numVal(val: unknown): number {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  }

  // ── 4. MAPEO DE COLUMNAS ORIGINALES
  const cAgencia = resolveCol(nm, ["Nombre Agencia", "nombre_agencia", "agencia"]);
  const cAsesor = resolveCol(nm, ["Asesor de banca comunal", "asesor_de_banca_comunal", "asesor banca comunal", "asesor"]);
  const cNroOp = resolveCol(nm, ["Nro de operación", "nro de operacion", "nro_de_operacion", "numero operacion"]);
  const cCodBC = resolveCol(nm, ["Codigo de bc", "cod_bc", "codigo_bc"]);
  const cNombreBC = resolveCol(nm, ["Nombre banca comunal", "nombre_banca_comunal"]);
  const cNroInt = resolveCol(nm, ["Nro de integrantes bc", "nro_integrantes_bc", "integrantes bc"]);
  const cDiasMora = resolveCol(nm, ["Dias mora", "dias_mora", "días mora"]);
  const cMontoDesemb = resolveCol(nm, ["Monto desembolsado", "monto_desembolsado"]);
  const cSaldoPrest = resolveCol(nm, ["Saldo de prestamo", "saldo_de_prestamo", "saldo prestamo"]);
  const cAporteProg = resolveCol(nm, ["Aporte programado", "aporte_programado"]);
  const cAporteVol = resolveCol(nm, ["Aporte voluntario", "aporte_voluntario"]);
  const cOtrosIng = resolveCol(nm, ["Otros ingresos", "otros_ingresos"]);
  const cPrestFC = resolveCol(nm, ["Prestamo fondo comun", "prestamo_fondo_comun"]);
  const cDevolucion = resolveCol(nm, ["Devolucion prestamo de fondo comun", "devolucion_prestamo_fondo_comun", "devolución préstamo"]);
  const cSaldoFC = resolveCol(nm, ["Saldo de prestamo fondo comun", "saldo_prestamo_fondo_comun"]);
  const cReservaK = resolveCol(nm, ["Reserva capital", "reserva_capital"]);
  const cFondoRes = resolveCol(nm, ["Fondo de reserva", "fondo_reserva"]);
  const cCtaCobrar = resolveCol(nm, ["Cuenta por cobrar", "cuenta_por_cobrar"]);
  const cSaldoInterno = resolveCol(nm, ["Saldo prestamo interno", "saldo_prestamo_interno"]);
  const cSaldoEnFC = resolveCol(nm, ["Saldo en el fondo comun", "saldo_en_el_fondo_comun", "saldo fondo comun"]);
  const cNoSocios = resolveCol(nm, ["No socios cta. int.", "no_socios_cta_int", "no socios cta int"]);
  const cEntidadFin = resolveCol(nm, ["Entidad financiera", "entidad_financiera"]);

  // log columnas críticas no encontradas
  [
    [cAgencia, "Nombre Agencia"],
    [cAsesor, "Asesor de Banca Comunal"],
    [cAporteProg, "Aporte Programado (J)"],
    [cAporteVol, "Aporte Voluntario (K)"],
    [cEntidadFin, "Entidad Financiera"],
  ].forEach(([col, label]) => {
    if (!col) logs.push(mkLog("warn", `[ADVERTENCIA] Columna "${label}" no encontrada.`));
  });

  logs.push(mkLog("info", "Aplicando fórmulas de extracción (LEFT / RIGHT por guion) y calculando Aportaciones…"));

  // ── 5. CONSTRUIR FILAS FINALES
  const OUTPUT_COLS = [
    "cod_agency", "agencia",
    "cod_asesor", "asesor_servicio",
    "Nro de operación", "Codigo de BC", "Nombre Banca Comunal",
    "Nro de integrantes BC", "Dias Mora",
    "Monto desembolsado", "Saldo de Prestamo",
    "Prestamo Fondo Comun", "Devolucion prestamo de Fondo Comun",
    "Aportaciones", "Otros Ingresos",
    "Saldo de prestamo Fondo Comun",
    "Reserva Capital", "Fondo de Reserva",
    "Cuenta por Cobrar", "Saldo Prestamo Interno",
    "Saldo en el Fondo Comun", "No Socios Cta. Int.",
    "Entidad Financiera",
  ];

  const rows = workData.map((r) => ({
    // A → split
    "cod_agency": leftOf(getVal(r, cAgencia)),
    "agencia": rightOf(getVal(r, cAgencia)),
    // B → split
    "cod_asesor": leftOf(getVal(r, cAsesor)),
    "asesor_servicio": rightOf(getVal(r, cAsesor)),
    // C–I → as-is
    "Nro de operación": getVal(r, cNroOp),
    "Codigo de BC": getVal(r, cCodBC),
    "Nombre Banca Comunal": getVal(r, cNombreBC),
    "Nro de integrantes BC": getVal(r, cNroInt),
    "Dias Mora": getVal(r, cDiasMora),
    "Monto desembolsado": getVal(r, cMontoDesemb),
    "Saldo de Prestamo": getVal(r, cSaldoPrest),
    // M, N → as-is
    "Prestamo Fondo Comun": getVal(r, cPrestFC),
    "Devolucion prestamo de Fondo Comun": getVal(r, cDevolucion),
    // J + K → calculado
    "Aportaciones": numVal(getVal(r, cAporteProg)) + numVal(getVal(r, cAporteVol)),
    // L → as-is
    "Otros Ingresos": getVal(r, cOtrosIng),
    // O–T → as-is
    "Saldo de prestamo Fondo Comun": getVal(r, cSaldoFC),
    "Reserva Capital": getVal(r, cReservaK),
    "Fondo de Reserva": getVal(r, cFondoRes),
    "Cuenta por Cobrar": getVal(r, cCtaCobrar),
    "Saldo Prestamo Interno": getVal(r, cSaldoInterno),
    "Saldo en el Fondo Comun": getVal(r, cSaldoEnFC),
    "No Socios Cta. Int.": getVal(r, cNoSocios),
    // V → right only
    "Entidad Financiera": rightOf(getVal(r, cEntidadFin)),
  }));

  logs.push(mkLog("success", `Fondo Común procesado: ${rows.length} filas · ${OUTPUT_COLS.length} columnas`));
  return { rows, cols: OUTPUT_COLS, logs };
}

/* ─── CUSTOM MODE ─── */
export function processCustom(
  data: Record<string, unknown>[],
  selectedCols: string[],
  logs: LogEntry[]
): ETLResult {
  if (!selectedCols.length) {
    logs.push(mkLog("warn", "[ADVERTENCIA] Sin columnas seleccionadas. Exportando todo."));
    const allCols = Object.keys(data[0] || {});
    const rows = data.map((r) => {
      const out: Record<string, unknown> = {};
      allCols.forEach((c) => { out[c] = trimVal(r[c]); });
      return out;
    });
    return { rows, cols: allCols, logs };
  }

  logs.push(mkLog("info", `Selección manual activada: ${selectedCols.length} columnas seleccionadas para exportación`));
  logs.push(mkLog("dim", `Columnas: ${selectedCols.join(" · ")}`));
  logs.push(mkLog("info", "Aplicando TRIM a todos los campos de texto…"));

  let trimCount = 0;

  const rows = data.map((r) => {
    const out: Record<string, unknown> = {};
    selectedCols.forEach((c) => {
      const raw = r[c] !== undefined ? r[c] : "";
      const trimmed = trimVal(raw);
      if (typeof raw === "string" && raw !== trimmed) trimCount++;
      out[c] = trimmed;
    });
    return out;
  });

  logs.push(mkLog("dim", `TRIM aplicado: ${trimCount} campo(s) con espacios eliminados`));
  return { rows, cols: selectedCols, logs };
}