# Fiscora SaaS — Monorepo Base

Fiscora es un SaaS fiscal-contable inteligente mexicano propiedad de **ConSafeDev**.

Esta es la base del monorepo configurado con **pnpm workspaces**, **TypeScript**, **Fastify**, **React + Vite** y **Prisma (PostgreSQL)**.

---

## Estructura del Monorepo

```
fiscora/
├─ apps/
│  ├─ web/            # Frontend SPA con React + Vite + TypeScript + TailwindCSS
│  └─ api/            # Backend API con Fastify + TypeScript
├─ packages/
│  ├─ shared/         # Constantes y tipos comunes (UserRole, PlanKey, etc.)
│  ├─ validators/     # Esquemas de validación de datos con Zod
│  ├─ xml-engine/     # Analizador y validador de comprobantes XML CFDI
│  ├─ labor-engine/    # Motor de cálculos laborales según la LFT mexicana
│  └─ config/         # Configuraciones compartidas del desarrollador
├─ prisma/
│  └─ schema.prisma   # Esquema de base de datos Postgres (modelos del SaaS)
├─ docs/              # Documentación técnica y guías de prompts
├─ .env.example       # Plantilla de variables de entorno
├─ pnpm-workspace.yaml
├─ tsconfig.base.json # Configuración base de TypeScript
└─ package.json       # Scripts de orquestación a nivel raíz
```

---

## Requisitos Previos

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0

---

## Configuración Inicial

1. **Clonar el repositorio e instalar dependencias:**

   ```bash
   pnpm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo `.env.example` como `.env` en el directorio raíz:

   ```bash
   cp .env.example .env
   ```

   Rellena los valores necesarios (p. ej. `DATABASE_URL` y `REDIS_URL`).

3. **Generar el cliente de Prisma:**
   Genera los archivos del ORM de manera local en el API:
   ```bash
   pnpm prisma:generate
   ```

---

## Scripts Disponibles (Raíz)

Ejecuta estos comandos en la carpeta raíz del proyecto:

| Comando                | Descripción                                                                                                 |
| :--------------------- | :---------------------------------------------------------------------------------------------------------- |
| `pnpm dev`             | Inicia simultáneamente la API (Fastify) y el Web (Vite) de forma paralela y con colores de log distintivos. |
| `pnpm dev:web`         | Inicia solo el servidor de desarrollo del frontend (Vite) en `http://localhost:5173`.                       |
| `pnpm dev:api`         | Inicia solo el servidor de desarrollo de la API (Fastify) en `http://localhost:4000`.                       |
| `pnpm build`           | Compila recursivamente todos los paquetes y aplicaciones.                                                   |
| `pnpm typecheck`       | Ejecuta la comprobación estricta de TypeScript en todo el monorepo.                                         |
| `pnpm lint`            | Corre ESLint en todas las aplicaciones y librerías internas.                                                |
| `pnpm format`          | Formatea todos los archivos del monorepo usando Prettier.                                                   |
| `pnpm prisma:generate` | Genera los tipos de Prisma Client para el backend.                                                          |

---

## Endpoints Locales del Servidor API

Una vez iniciada la API con `pnpm dev:api`, puedes probar los siguientes endpoints:

- **Salud del Servidor:** `GET http://localhost:4000/health`
- **Versión del Sistema:** `GET http://localhost:4000/api/version`
