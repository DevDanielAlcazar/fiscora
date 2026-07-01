# AGENTS.md — fiscora / contable

Monorepo for Fiscora SaaS fiscal-contable mexicano propiedad de ConSafeDev.
Remote: `https://github.com/DevDanielAlcazar/fiscora.git`

## Tech Stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + TypeScript + Fastify
- **Database**: PostgreSQL con Prisma
- **Package Manager**: pnpm workspaces
- **Authentication**: argon2 for password hashing
- **Validation**: Zod schemas
- **Code Quality**: ESLint + Prettier

## Project Structure

```
fiscora/
├─ apps/
│  ├─ web/          # Frontend React + Vite
│  └─ api/          # Backend Fastify + TypeScript
├─ packages/
│  ├─ shared/       # Tipos compartidos
│  ├─ validators/   # Zod schemas
│  ├─ xml-engine/   # Motor de auditoría XML
│  ├─ labor-engine/ # Motor laboral mexicano
│  └─ config/       # Configuración compartida
├─ prisma/          # Schema PostgreSQL
├─ docs/            # Documentación
└─ scripts/         # Scripts utilitarios
```

## Current Implementation Status

✅ **Base Structure**: Monorepo con pnpm workspaces configurado
✅ **Frontend**: App React + Vite + TailwindCSS con layout básico
✅ **Backend**: Servidor Fastify con endpoints /health y /version
✅ **Database**: Prisma schema con modelos base
✅ **Auth**: Password service con argon2 hashing y validación
✅ **Bootstrap Admin**: Sistema seguro para crear admin inicial
✅ **Validation**: Zod schemas para validación de datos
✅ **Code Quality**: ESLint y Prettier configurados
✅ **Tax Advanced Validations**: 13 nuevos códigos (A1–G3) en helper separado, regresión 202/202
✅ **Concept Advanced Validations**: 20 nuevos códigos en helper separado, regresión 212/212
✅ **Catalog Manifest & Traceability**: SHA-256 hashes, runtime tracker, catalogRuntime en analysisMeta
✅ **XSD Validation Infrastructure**: Registry de schemas SAT, preflight de namespaces, metadata segura en analysisMeta, 361/361 tests pasados

## Auth Module

- **Location**: `apps/api/src/modules/auth/password.service.ts`
- **Features**:
  - Hash seguro con argon2
  - Verificación de contraseñas
  - Validación (mínimo 12 caracteres, no vacío)
  - Sin hardcodeo de secretos
- **Bootstrap Admin**: `apps/api/src/modules/auth/bootstrap-admin.ts`
  - Crea admin automáticamente en el arranque
  - Variables de entorno: BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD
  - Evita duplicados y valida contraseñas
  - Rol: SUPER_ADMIN
- **JWT Plugin**: `apps/api/src/plugins/jwt.plugin.ts`
  - Integración con @fastify/jwt
  - Tipo AuthTokenPayload con userId, email, role, organizationId opcional
  - Tokens con expiración de 15 minutos

## Development Commands

```bash
# Instalar dependencias
pnpm install

# Levantar desarrollo
pnpm dev          # API + Web concurrently
pnpm dev:api      # Solo backend
pnpm dev:web      # Solo frontend

# Validación
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm format       # Prettier + Prisma format
pnpm prisma:generate  # Generar Prisma client
```

## Next Steps

- Implementar sistema de autenticación completo
- Crear bootstrap admin seguro
- Implementar Stripe integration
- Desarrollar módulos XML y laboral

## Security Notes

- Nunca hardcodear credenciales o secretos
- Usar variables de entorno para todos los secrets
- Contraseñas mínimas 12 caracteres
- Validar todas las entradas con Zod
