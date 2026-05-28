import { useState, useEffect } from "react";
import {
  Sun,
  Moon,
  FileCode2,
  Users2,
  ShieldCheck,
  Building2,
  TrendingUp,
  FolderLock,
  ArrowUpRight,
  Database,
  Terminal,
} from "lucide-react";
import { AUDITORIA_XML, LABORAL, PROFESSIONAL } from "@fiscora/shared";

export default function App() {
  const [darkMode, setDarkMode] = useState(true);

  // Initialize theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans transition-colors duration-300">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card p-6 flex flex-col justify-between hidden md:flex">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
                FISCORA
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-wider font-semibold uppercase">
                ConSafeDev SaaS
              </p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            <a
              href="#dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary/10 text-primary transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Dashboard</span>
            </a>
            <a
              href="#xml"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Auditoría XML</span>
              <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono uppercase">
                Activo
              </span>
            </a>
            <a
              href="#labor"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <Users2 className="w-4 h-4" />
              <span>Módulo Laboral</span>
              <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono uppercase">
                Activo
              </span>
            </a>
            <a
              href="#config"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <FolderLock className="w-4 h-4" />
              <span>Administración</span>
            </a>
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            <span className="font-semibold">Consorcio ConSafeDev</span>
          </div>
          <div className="text-[10px] font-mono opacity-80">v1.0.0 (Base Monorepo)</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4 md:hidden">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Fiscora</span>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">
            SaaS de Control y Auditoría Fiscal Mexicano
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Toggle Theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Profile Mockup */}
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center font-bold text-white text-xs">
                AD
              </div>
              <span className="text-xs font-semibold hidden sm:inline">Admin Fiscora</span>
            </div>
          </div>
        </header>

        {/* Workspace Contents */}
        <section className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">
          {/* Main banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-8 md:p-10 border border-slate-800 shadow-xl shadow-indigo-950/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="max-w-2xl relative z-10 space-y-3">
              <span className="bg-primary/20 text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Plan Seleccionado: {PROFESSIONAL}
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight font-sans">
                Fiscora — SaaS Fiscal Contable
              </h2>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                Fundación de monorepo inicializada con pnpm workspaces. Listo para la integración de
                certificados, auditoría de comprobantes XML CFDI y administración laboral de
                plantillas bajo la Ley Federal del Trabajo.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <a
                  href="#endpoints"
                  className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Documentación Local
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* Engine status cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* XML engine placeholder */}
            <div className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <FileCode2 className="w-5 h-5" />
                </div>
                <span className="text-xs bg-muted px-2.5 py-1 rounded font-semibold text-muted-foreground uppercase">
                  Módulo: {AUDITORIA_XML}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                Motor de Auditoría XML CFDI
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Analizador e validador de archivos XML. Soporta la detección de tipos de comprobante
                y cálculo de incongruencias fiscales en CFDI 3.3 y 4.0.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 border border-border/50 text-[11px] font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paquete:</span>
                  <span>@fiscora/xml-engine</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className="text-emerald-500 font-semibold">Listo (Mock)</span>
                </div>
              </div>
            </div>

            {/* Labor engine placeholder */}
            <div className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-500">
                  <Users2 className="w-5 h-5" />
                </div>
                <span className="text-xs bg-muted px-2.5 py-1 rounded font-semibold text-muted-foreground uppercase">
                  Módulo: {LABORAL}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">
                Motor Laboral Mexicano
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Calculadora de aguinaldos, primas vacacionales, finiquitos y liquidaciones de
                acuerdo a las leyes de la LFT mexicana actualizadas.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 border border-border/50 text-[11px] font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paquete:</span>
                  <span>@fiscora/labor-engine</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className="text-indigo-500 font-semibold">Listo (Mock)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monorepo stack diagram */}
          <div className="p-6 rounded-xl border border-border bg-card space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Estructura de la Infraestructura del Monorepo
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El siguiente diagrama detalla cómo se comunican las dependencias internas entre las
              aplicaciones web, la API y los subpaquetes de lógica de negocio:
            </p>
            <div className="bg-muted/50 border border-border/50 rounded-lg p-4 font-mono text-[10px] text-muted-foreground overflow-x-auto space-y-2">
              <div>{"apps/web    ──[ depends on ]──>  packages/shared & packages/validators"}</div>
              <div>
                {"apps/api    ──[ depends on ]──>  packages/shared & packages/validators & engines"}
              </div>
              <div>{"prisma/     ──[ generates ]───>  @prisma/client inside apps/api"}</div>
              <div>{"packages/   ──[ export ts  ]──>  dist/ directories mapped in exports"}</div>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="p-6 rounded-xl border border-border bg-card space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Verificación de Endpoints Locales
            </h3>
            <p className="text-xs text-muted-foreground">
              Puedes verificar que el backend API de Fastify esté funcionando correctamente enviando
              una petición HTTP a los siguientes endpoints:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-lg bg-muted border border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-primary uppercase">
                    Endpoint de Salud
                  </div>
                  <div className="font-mono text-sm mt-1">GET http://localhost:4000/health</div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                  200 OK
                </span>
              </div>
              <div className="p-4 rounded-lg bg-muted border border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold text-primary uppercase">
                    Endpoint de Versión
                  </div>
                  <div className="font-mono text-sm mt-1">
                    GET http://localhost:4000/api/version
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-500/20 text-indigo-400">
                  200 OK
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-4 px-6 text-center text-xs text-muted-foreground bg-card/30">
          &copy; 2026 Fiscora SaaS. Todos los derechos reservados. Propiedad de ConSafeDev.
        </footer>
      </main>
    </div>
  );
}
