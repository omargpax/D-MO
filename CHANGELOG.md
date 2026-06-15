# Changelog — D-MO

## 2026-06-20 — UI refactor, detección inteligente y mejoras de UX

Resumen
 - Refactor de la capa UI para mejorar la experiencia y el onboarding.
 - Implementación de detección automática de tipo de reporte por coincidencia de columnas.
 - Nueva página `/about`, componente `Header` compartido, y mejoras en la gestión de temas (light/dark).

Categorías (Convención: Added / Changed / Fixed / Notes)

### Added
- `src/components/Header.tsx`: nuevo header compartido para usar en `layout`.
- `src/app/about/page.tsx`: página dedicada `/about` con descripción y guia de formatos.
- `src/components/PreviewTable.tsx`: vista previa ligera de filas (primeras N filas).
- `src/components/HowItWorks.tsx`: guía de 3 pasos en el flujo de usuario.
- Detección de mejor correspondencia entre columnas y RFE schemas (`calculateCompatibility`, `detectBestMatch`).

### Changed
- `src/app/page.tsx`: refactor completo — manejo de estados, preview, logs (summary + technical), detección automática y sugerencias de autocorrección.
- `src/app/layout.tsx`: ahora incluye `Header` y aplica `bg-slate-50 dark:bg-slate-950` para respetar el tema global.
- `src/components/Header.tsx`: añadido soporte explícito de fondo y variantes `dark:` para que responda al toggle de tema.
- Export formats: información movida desde el panel inline a la nueva ruta `/about`.
- `src/styles.d.ts`: añadido para evitar errores por import side-effect de CSS en TypeScript.

### Fixed
- Evitar sugerencias engañosas entre reportes equivalentes (`cartera` <-> `colocaciones`) mediante grupos equivalentes.
- Corregido bug donde el header no cambiaba su fondo en tema oscuro (falta de clases `dark:` en el layout/header).
- Reinicio correcto del estado de detección al limpiar archivo cargado.

Files touched (selección relevante)
- `src/app/page.tsx` — entrada principal del UI y orquestador del cliente.
- `src/app/layout.tsx` — layout raíz (ahora importa `Header`).
- `src/components/Header.tsx` — nuevo componente compartido.
- `src/app/about/page.tsx` — nueva página `About`.
- `src/components/PreviewTable.tsx`, `HowItWorks.tsx`, `DropZone.tsx`, `LogConsole.tsx` — UI y microcopy.
- `src/lib/file-parser.ts` — parsers usados (sin modificaciones mayores).
- `src/lib/etl-engine.ts` — lógica ETL sin cambios.
- `src/styles.d.ts` — declaración de tipos para CSS.

Notas técnicas
- Framework: Next.js + React + TypeScript (100% client-side).
- Librerías: `papaparse`, `xlsx` para parsing/export; `next-themes` para gestión de tema.
- Diseño: cambio del header a componente compartida en `layout` para consistencia entre rutas.

Asistencia de IA
- Modificaciones realizadas con asistencia de IA (generación de código y refactorizaciones).

Antes / Después — Previsualización de la interfaz

Descripción breve:
- Antes: UI con menos orientación, header localizado solo en la página principal, ausencia de detección automática y ayuda contextual sobre formatos.
- Después: header global en `layout`, página `/about`, detección automática con sugerencias, previews y mejor microcopy para guiar al usuario.


![comparison v1.2.0 (AI)](public/assets/comparison-v1_2_0.jpg)

Fuente de la imagen:
> @omargpax - "Diseño: D-MO — captura antes/después"
