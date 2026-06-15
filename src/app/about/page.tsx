import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Volver</Link>
        </div>

        <div className="p-1">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Acerca de <b className="text-brand-500">D-MO</b></h1>
          <p className="mt-3 text-sm text-slate-500"> <b>D-MO</b> es un motor de transformación de datos que corre 100% en el navegador. Permite normalizar, validar y exportar distintos reportes sin enviar datos a servidores externos. Es ideal para procesar archivos localmente y generar salidas para análisis y dashboards.</p>

          <h2 className="mt-5 text-sm font-medium text-slate-700 dark:text-slate-200">Información sobre formatos de exportación</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm text-slate-500 space-y-2">
            <li><strong>CSV</strong>: n°1 en rapidez y tamaño (generación y descarga más liviana), pero no es ideal para lectura y análisis de datos con formatos.</li>
            <li><strong>XLSX</strong>: n°2 en rapidez; suele generar archivos más pesados que CSV pero ofrece buena compatibilidad y carga/descarga rápida.</li>
            <li><strong>XLS</strong>: tamaño y rendimiento moderado; suele posicionarse n°3 en velocidad de generación/descarga.</li>
            <li><strong>XLSB</strong>: formato binario óptimo para lectura y carga en dashboards (por ejemplo Power BI), pero es el más lento en generarse y descargarse desde D-MO.</li>
          </ol>

          <p className="mt-4 text-xs text-slate-400"> <b className="text-brand-700">Recomendación</b>: elige CSV para exportaciones ligeras y rápidas; XLSX para integración general; XLSB cuando priorices rendimiento de lectura en BI.</p>
        </div>
      </div>
    </div>
  );
}
