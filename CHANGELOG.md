## [v1.2.1-beta] — Sheet Navigation 🗂️

### 🚀 Features
- **Navegación entre hojas (modo Custom):** Al cargar un archivo `.xlsx` con múltiples hojas, el selector "Reporte" se habilita automáticamente y lista todas las hojas disponibles del workbook. Al cambiar de hoja, los datos, encabezados y panel de columnas se actualizan en tiempo real sin necesidad de recargar el archivo.

### 🔧 Changed
- **`src/lib/file-parser.ts`:** Extracción de la lógica de parseo a la función interna `parseWorksheet()` para eliminar duplicación de código. `parseExcel` ahora devuelve `sheetNames: string[]` con todos los nombres de hojas del workbook. Nueva función exportada `parseExcelSheet(buffer, sheetName)` para parsear una hoja específica bajo demanda.
- **`src/app/page.tsx`:** Nuevo estado `fileBuffer` que persiste el `ArrayBuffer` original al cargar un Excel, necesario para re-parsear hojas sin releer el archivo. `FileState` extendido con `sheetNames` y `activeSheet`. El `SelectField` de Reporte en modo Custom se alimenta dinámicamente de `fileState.sheetNames` y permanece deshabilitado si el archivo es CSV o tiene una sola hoja.

### 🐛 Fixed
- **Importación faltante de `parseExcelSheet`:** La función existía en `file-parser.ts` pero no estaba importada en `page.tsx`, causando que el cambio de hoja fallara silenciosamente.
- **Bloque CSV sobreescrito:** En `handleFile`, el resultado de `parseCSV` era inmediatamente sobreescrito por una llamada a `parseExcel` dentro del mismo bloque condicional, corrompiendo la lectura de archivos CSV.
- **`fileBuffer` no persistido para Excel:** `setFileBuffer` estaba ubicado dentro del bloque CSV en lugar del bloque Excel, dejando `fileBuffer` siempre en `null` para archivos `.xlsx` e impidiendo el cambio de hoja.

---

## [v1.2.0] — UI Refactor 📦

### 🚀 Features
- **Detección inteligente de reportes:** Implementación de algoritmos de correspondencia (`calculateCompatibility`, `detectBestMatch`) para identificar automáticamente el tipo de esquema RFE según las columnas del archivo cargado.
- **Capa de privacidad de metadatos:** Restricción de seguridad perimetral en la UI; las columnas autodetectadas y las advertencias de estructura solo se revelan si el archivo coincide en más del 50% con un esquema legítimo de la organización.
- **Nuevos componentes de interfaz:**
  - `src/components/Header.tsx`: Navbar global compartido y unificado.
  - `src/components/PreviewTable.tsx`: Previsualización ligera y eficiente de las primeras filas del archivo en caliente.
  - `src/components/HowItWorks.tsx`: Onboarding visual de 3 pasos integrado en el flujo principal.
- **Ruta `/about`:** Página dedicada `src/app/about/page.tsx` con la documentación del proyecto, guías de formato y especificaciones técnicas, aliviando la carga visual de la vista principal.

### 🔧 Changed
- **Refactor de `src/app/page.tsx`:** Reorganización completa del estado de la aplicación, consola de logs (separación de logs técnicos y resumen de negocio) y manejo de alertas contextuales.
- **Soporte nativo de Temas:** Integración de clases `dark:` en el Layout raíz y en el Header para garantizar una transición fluida y consistente en el modo oscuro (`bg-slate-50` / `bg-slate-950`).
- **Modularización:** Migración de la información estática de formatos de exportación desde paneles inline hacia la nueva interfaz de `/about`.
- **Selección de fila de encabezado (modo Custom):** Permite indicar qué fila del archivo contiene los nombres reales de las columnas; las filas previas se descartan automáticamente y el panel de selección de columnas se actualiza en tiempo real. El valor se confirma al salir del campo o al presionar Enter, evitando re-mapeos intermedios durante la edición.
- **Tipado robusto:** Incorporación de `src/styles.d.ts` para resolver side-effects de importación de CSS en el entorno de compilación de TypeScript.

### 🐛 Fixed
- **Falsos positivos en esquemas similares:** Corrección en el motor de compatibilidad mediante la creación de grupos equivalentes para evitar sugerencias cruzadas erróneas (ej. `cartera` ↔ `colocaciones`).
- **Fuga de estilos en Modo Oscuro:** Solucionado el problema de persistencia de fondos claros en el Header al alternar el tema global.
- **Persistencia de estado:** Corrección del ciclo de vida del estado de detección, asegurando un reset limpio de metadatos al remover el archivo actual.

