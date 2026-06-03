# PRD — Fiscora / ConSafeDev

**Documento:** Product Requirements Document + control de avance  
**Proyecto:** Fiscora — SaaS fiscal, contable y laboral para México  
**Propietario:** ConSafeDev  
**Fecha de actualización:** 2026-06-03  
**Estado:** MVP en construcción  
**Criterio operativo:** desarrollo incremental con prompts atómicos para reducir riesgo, facilitar revisión y aprovechar límites de herramientas IA.

> **Nota de seguridad:** este documento no contiene claves reales, secretos, tokens, `sk_*`, `pk_*`, `whsec_*`, contraseñas ni información sensible. Cualquier valor secreto debe permanecer exclusivamente en variables de entorno o en el administrador de secretos correspondiente.

---

## 1. Visión del producto

Fiscora será un SaaS fiscal, contable y laboral orientado a México, diseñado para ayudar a usuarios individuales, organizaciones, despachos contables, auditores y perfiles forenses a validar, analizar y documentar información fiscal/laboral de forma clara, trazable y profesional.

La plataforma deberá permitir iniciar con un MVP técnico sólido y evolucionar hacia una experiencia premium, moderna, cómoda, intuitiva y altamente profesional.

---

## 2. Objetivos de negocio

- [x] Definir Fiscora como nombre final del SaaS.
- [x] Asociar Fiscora como producto de ConSafeDev.
- [x] Construir una base SaaS multiusuario con planes, organizaciones y control de acceso.
- [x] Integrar Stripe Checkout hospedado por Stripe para evitar construir formularios de pago propios.
- [x] Integrar Stripe Webhooks para actualizar suscripciones localmente.
- [x] Integrar Stripe Billing Portal para que el usuario administre/cancele su suscripción desde Stripe.
- [x] Implementar control administrativo de usuarios, planes y módulos.
- [x] Implementar control de uso mensual por plan.
- [ ] Implementar módulo real de Auditoría XML CFDI.
- [ ] Implementar módulo real Laboral México.
- [ ] Implementar analítica administrativa ejecutiva.
- [ ] Implementar UI/UX final premium.
- [ ] Publicar despliegue productivo estable con dominio, HTTPS y políticas completas.

---

## 3. Principios rectores

- [x] Usar prompts pequeños, atómicos y con alcance cerrado para OpenCode/Antigravity.
- [x] Evitar cambios masivos no auditables.
- [x] Mantener typecheck y lint como puertas mínimas de calidad.
- [x] No exponer secretos en logs, UI ni respuestas API.
- [x] Preferir Stripe Checkout hospedado para pagos.
- [x] Preferir Stripe Billing Portal para autogestión de suscripciones.
- [x] Mantener webhooks idempotentes.
- [x] Mantener borrado lógico en lugar de borrado físico para usuarios.
- [ ] Implementar auditoría interna más formal para acciones administrativas.
- [ ] Implementar pruebas automatizadas unitarias/integración/e2e.
- [ ] Implementar pipeline CI/CD.

---

## 4. Stack técnico actual

| Componente | Estado | Descripción |
|---|---:|---|
| Monorepo pnpm | [x] | Proyecto con varios workspaces. |
| API Fastify | [x] | Backend principal. |
| Frontend React + Vite | [x] | UI actual funcional, todavía no final premium. |
| TypeScript | [x] | Uso en API/web/packages. |
| Prisma ORM | [x] | Modelado y migraciones. |
| PostgreSQL remoto/local LAN | [x] | Base `fiscora_db`. |
| Stripe SDK | [x] | Checkout, webhooks y Billing Portal. |
| JWT | [x] | Autenticación por bearer token. |
| Argon2 | [x] | Hash de contraseñas. |
| ExcelJS | [x] | Exportación de usuarios a Excel. |
| Cloudflare Tunnel / exposición temporal | [x] | Usado para pruebas de webhook. |
| Stripe CLI | [x] | Usado para forwarding local de webhooks. |

---

## 5. Roles y permisos

### 5.1 Roles definidos

- [x] `SUPER_ADMIN`
- [x] `ORG_ADMIN`
- [x] `ORG_USER`

### 5.2 Reglas actuales

- [x] `SUPER_ADMIN` puede ver módulos administrativos.
- [x] `SUPER_ADMIN` puede administrar usuarios.
- [x] `SUPER_ADMIN` puede administrar planes comerciales.
- [x] `SUPER_ADMIN` puede administrar permisos de módulos.
- [x] `ORG_ADMIN` puede operar dentro de su organización.
- [ ] Implementar invitación de usuarios dentro de organizaciones.
- [ ] Implementar administración de roles dentro de una organización.
- [ ] Implementar permisos más granulares por operación.

---

## 6. Tipos de cuenta

| Tipo | Estado | Descripción |
|---|---:|---|
| `INDIVIDUAL` | [x] | Cuenta individual ligada a una organización técnica tipo individual. |
| `ORGANIZATION` | [x] | Cuenta de organización/despacho. |

### Reglas

- [x] Toda cuenta nueva queda asociada a una organización técnica.
- [x] Toda cuenta nueva inicia con plan Essential.
- [x] `INDIVIDUAL` y `ORGANIZATION` reciben suscripción Essential activa al registrarse.
- [x] El usuario inicial de cada cuenta queda como `ORG_ADMIN`.
- [ ] Soportar múltiples usuarios por organización según límite de plan.
- [ ] Soportar invitaciones por correo.
- [ ] Soportar baja/alta de usuarios dentro de organización por `ORG_ADMIN`.

---

## 7. Planes comerciales

### 7.1 Planes definidos

| Plan | Estado | Descripción operativa |
|---|---:|---|
| Essential | [x] | Plan gratuito base. |
| Professional | [x] | Plan pagado para contadores/despachos pequeños. |
| Corporation | [x] | Plan pagado para empresas/despachos medianos. |
| Forensic Auditor | [x] | Plan pagado para auditoría masiva/peritos. |

### 7.2 Reglas comerciales conocidas

#### Essential

- [x] 20 usos mensuales.
- [x] 1 RFC permitido.
- [x] Auditoría XML individual.
- [x] No ZIP.
- [ ] No logotipo personalizado.
- [ ] Sin módulos pagados completos.
- [ ] Sin funcionalidades forenses avanzadas.

#### Professional

- [x] Plan pagado.
- [x] Auditoría XML individual y ZIP.
- [x] Laboral habilitado.
- [x] Límite de RFCs definido en plan.
- [x] Uso mensual ilimitado (`monthlyUsageLimit = null`).
- [ ] Acceso a reportes PDF personalizados según módulo.
- [ ] Logotipo personalizado permitido por ser plan de pago.

#### Corporation

- [x] Plan pagado.
- [x] Auditoría XML individual y ZIP.
- [x] Laboral habilitado.
- [x] Límite de RFCs definido en plan.
- [x] Uso mensual ilimitado (`monthlyUsageLimit = null`).
- [ ] Soporte a más usuarios/RFCs según configuración comercial.
- [ ] Logotipo personalizado permitido.

#### Forensic Auditor

- [x] Plan pagado.
- [x] Auditoría XML individual y ZIP.
- [x] Laboral habilitado.
- [x] Uso mensual ilimitado.
- [x] En UI final, RFCs deben mostrarse como “ilimitados”, no como número `999`.
- [ ] Funcionalidad forense avanzada.
- [ ] Reportes avanzados personalizados.
- [ ] Soporte prioritario/VIP según propuesta comercial.

---

## 8. Modelo de datos — avance

### 8.1 Entidades implementadas o ampliadas

| Modelo | Estado | Campos / propósito |
|---|---:|---|
| `User` | [x] | Usuario del sistema. |
| `Organization` | [x] | Cuenta/organización vinculada a usuarios. |
| `Subscription` | [x] | Suscripción local de la organización. |
| `Plan` | [x] | Plan comercial y técnico. |
| `Module` | [x] | Módulos funcionales disponibles. |
| `PlanModuleAccess` | [x] | Matriz de acceso plan-módulo. |
| `UsageEvent` | [x] | Registro de consumo mensual. |
| `StripeWebhookEvent` | [x] | Registro idempotente de eventos Stripe. |
| `AdminAuditLog` | [ ] | Existe referencia visual, pero falta formalizar auditoría integral. |
| `RfcProfile` | [ ] | Pendiente para administración de RFCs por organización. |
| `XmlAnalysis` / metadata XML | [ ] | Pendiente para módulo XML real. |
| `LaborCalculation` | [ ] | Pendiente para módulo laboral. |

### 8.2 Campos relevantes implementados

#### User

- [x] `id`
- [x] `email`
- [x] `passwordHash`
- [x] `name`
- [x] `role`
- [x] `organizationId`
- [x] `status` con valores operativos `ACTIVE`, `BANNED`, `DELETED`
- [x] `bannedAt`
- [x] `bannedReason`
- [x] `deletedAt`
- [x] `deletedReason`
- [x] `createdAt`
- [x] `updatedAt`

#### Organization

- [x] `id`
- [x] `name`
- [x] `accountType`
- [x] `stripeCustomerId`
- [ ] Datos fiscales de organización.
- [ ] Logotipo personalizado.
- [ ] Datos de contacto.
- [ ] Responsable/firma para reportes.

#### Subscription

- [x] `id`
- [x] `organizationId`
- [x] `planId`
- [x] `status`
- [x] `stripeSubscriptionId`
- [x] `cancelAtPeriodEnd`
- [x] `currentPeriodEnd`
- [x] `canceledAt`
- [ ] Historial completo de cambios de plan.
- [ ] Diferenciación formal de override manual vs Stripe-managed.
- [ ] Campos de periodo de facturación adicionales si se requieren.

#### Plan

- [x] `key`
- [x] `name`
- [x] `stripePriceId` legacy/conservado.
- [x] `maxUsers`
- [x] `maxRfcProfiles`
- [x] `description`
- [x] `monthlyPriceCents`
- [x] `yearlyPriceCents`
- [x] `currency`
- [x] `stripeMonthlyPriceId`
- [x] `stripeYearlyPriceId`
- [x] `features`
- [x] `isPublic`
- [x] `monthlyUsageLimit`

#### PlanModuleAccess

- [x] `enabled`
- [x] `adminOnly`
- [x] `beta`
- [x] `consumesUsage`
- [x] `allowSingleXml`
- [x] `allowZip`
- [x] Índice único por `planId + moduleId`.

---

## 9. Autenticación y seguridad

### 9.1 Registro/Login

- [x] Registro público `/api/auth/register`.
- [x] Login `/api/auth/login`.
- [x] Endpoint `/api/auth/me`.
- [x] JWT con secret mínimo requerido.
- [x] Plugin JWT en Fastify.
- [x] Hook de autenticación `authenticate`.
- [x] Hash de password con Argon2.
- [x] Contraseñas mínimas de 12 caracteres.
- [x] Login bloquea usuarios `BANNED`.
- [x] Login bloquea usuarios `DELETED`.
- [x] Registro crea organización + usuario `ORG_ADMIN` + suscripción Essential.
- [x] Bootstrap admin crea `SUPER_ADMIN` si no existe.
- [ ] Recuperación de contraseña.
- [ ] Cambio de contraseña por usuario.
- [ ] MFA/2FA.
- [ ] Verificación de correo.
- [ ] Rate limiting de login/register.
- [ ] Bloqueo por intentos fallidos.
- [ ] Gestión de sesiones activas.
- [ ] Logout server-side / blacklist de tokens si aplica.

### 9.2 Respuestas seguras

- [x] No exponer `passwordHash` en respuestas.
- [x] No exponer secretos Stripe en endpoints públicos.
- [x] No imprimir secretos en logs.
- [ ] Sanitización centralizada de errores.
- [ ] Políticas CORS finales para producción.
- [ ] Headers HTTP de seguridad.
- [ ] Hardening productivo.

---

## 10. Dashboard

### 10.1 Implementado

- [x] Login redirige a dashboard.
- [x] Dashboard muestra información del usuario.
- [x] Dashboard muestra plan actual.
- [x] Dashboard muestra estado de suscripción.
- [x] Dashboard muestra RFCs permitidos.
- [x] Forensic Auditor muestra RFCs como “ilimitados”.
- [x] Dashboard muestra suscripción Stripe cuando existe.
- [x] Dashboard muestra uso mensual.
- [x] Dashboard muestra módulos disponibles.
- [x] Botón “Ver planes”.
- [x] Botón “Cerrar sesión”.
- [x] Botón “Webhook Stripe” para `SUPER_ADMIN`.
- [x] Botón “Permisos de módulos” para `SUPER_ADMIN`.
- [x] Botón “Usuarios” para `SUPER_ADMIN`.
- [x] Botón “Costos y planes” para `SUPER_ADMIN`.
- [x] Botón “Administrar suscripción” cuando hay `stripeSubscriptionId`.

### 10.2 Pendiente inmediato

- [x] Mostrar cancelación programada en dashboard si `cancelAtPeriodEnd = true`. *(Decisión UX: No mostrar cancelación programada cuando sea false para no incentivar cancelación. Solo mostrar información cuando exista cancelación activa.)*
- [x] Mostrar `currentPeriodEnd` en formato amigable.
- [x] Mostrar `canceledAt` cuando aplique.
- [x] Mostrar estado traducido de suscripción en todos los casos.
- [x] Dashboard oculta "Cancelación programada: No".
- [ ] Mejorar layout responsive.
- [ ] Rehacer UI/UX final premium.

---

## 11. Planes públicos

### 11.1 Backend

- [x] Endpoint público `GET /api/plans`.
- [x] No requiere token.
- [x] Devuelve solo planes `isPublic = true`.
- [x] Ordena Essential → Professional → Corporation → Forensic Auditor.
- [x] No expone IDs internos.
- [x] No expone Stripe Price IDs.

### 11.2 Frontend

- [x] `/plans` consume `GET /api/plans`.
- [x] Elimina arreglo hardcodeado anterior.
- [x] Muestra nombre, descripción, precios y features desde DB.
- [x] Toggle mensual/anual.
- [x] Essential se muestra como gratuito y sin checkout.
- [x] Planes pagados mantienen botón “Suscribirse”.
- [x] Checkout funciona para mensual/anual.
- [ ] Mejorar copy comercial final.
- [ ] Mejorar diseño visual final.
- [ ] Agregar comparativa de planes.
- [ ] Agregar FAQ comercial.
- [ ] Agregar términos visibles antes de pago.

---

## 12. Admin — Costos y planes

### 12.1 Backend

- [x] `GET /api/admin/plans`.
- [x] `PATCH /api/admin/plans/:planKey`.
- [x] Ambos requieren autenticación.
- [x] Ambos requieren `SUPER_ADMIN`.
- [x] Permite actualizar nombre, descripción, precios, moneda, Stripe Price IDs, límites, features e `isPublic`.
- [x] `GET /api/plans` refleja cambios públicos.

### 12.2 Frontend

- [x] Ruta `/admin/plans`.
- [x] Pantalla “Costos y Planes”.
- [x] Formulario por plan.
- [x] Edición de features por textarea, una por línea.
- [x] Botón guardar por plan.
- [x] Mensajes de éxito/error.
- [x] Botón volver al dashboard.
- [x] Dashboard muestra acceso a `SUPER_ADMIN`.
- [ ] Validaciones UI más finas para cents/precios.
- [ ] Formato monetario visual amigable.
- [ ] Confirmaciones antes de cambios críticos.
- [ ] Historial/auditoría de cambios de precios.

---

## 13. Stripe Checkout

### 13.1 Implementado

- [x] Stripe Checkout hospedado por Stripe.
- [x] Endpoint `POST /api/billing/checkout`.
- [x] Requiere token.
- [x] Valida `planKey`.
- [x] Valida `billingCycle`.
- [x] Essential no permite checkout.
- [x] Usa `stripeMonthlyPriceId` / `stripeYearlyPriceId` desde DB.
- [x] Ya no depende de Price IDs hardcodeados/env en checkout.
- [x] `Admin Costos y Planes` puede modificar Price IDs y checkout los usa automáticamente.
- [x] `client_reference_id = organizationId`.
- [x] Metadata incluye `userId`, `organizationId`, `planKey`, `billingCycle`.
- [x] Si organización tiene `stripeCustomerId`, reutiliza `customer`.
- [x] Si no tiene `stripeCustomerId`, usa `customer_email` + `customer_creation: "always"`.
- [x] No envía `customer` y `customer_email` al mismo tiempo.
- [x] Páginas `/billing/success` y `/billing/cancel`.
- [x] Pruebas exitosas en Stripe test.
- [x] Se identificó y corrigió problema de `STRIPE_WEBHOOK_SECRET` incompleto.

### 13.2 Pendientes

- [ ] Validar flujo completo en producción real.
- [ ] Manejo avanzado de upgrade/downgrade inmediato.
- [ ] Cupón/promotion codes si se decide.
- [ ] Tax automático si se decide.
- [ ] Facturación fiscal mexicana automatizada si se decide.
- [ ] Gestión formal de suscripciones incompletas.
- [ ] Validación de moneda por país si se expande.

---

## 14. Stripe Webhooks

### 14.1 Implementado

- [x] Endpoint `POST /api/webhooks/stripe`.
- [x] Raw body parser para validar firma.
- [x] Validación de firma con `STRIPE_WEBHOOK_SECRET`.
- [x] Tabla `StripeWebhookEvent`.
- [x] Idempotencia por `stripeEventId`.
- [x] No guardar payload completo ni secretos.
- [x] Estados de evento: `RECEIVED`, `PROCESSED`, `FAILED`.
- [x] Registro de `livemode`.
- [x] Registro de `receivedAt`.
- [x] Registro de `processedAt`.
- [x] Registro de `errorMessage`.
- [x] Manejo de duplicados.
- [x] Manejo de `checkout.session.completed`.
- [x] Manejo de `customer.subscription.updated`.
- [x] Manejo de `customer.subscription.deleted`.
- [x] Manejo de `invoice.payment_failed`.
- [x] Manejo de `invoice.paid`.
- [x] `checkout.session.completed` actualiza plan y `stripeSubscriptionId`.
- [x] `checkout.session.completed` guarda `stripeCustomerId` en organización.
- [x] `customer.subscription.updated` actualiza status/plan/campos de cancelación.
- [x] `customer.subscription.deleted` marca cancelación y regresa/cambia a Essential cuando aplica.
- [x] `invoice.payment_failed` marca `past_due`.
- [x] `invoice.paid` reactiva `active`.
- [x] Eventos duplicados se saltan por idempotencia.
- [x] Errores se marcan como `FAILED` sin guardar payload sensible.

### 14.2 Admin webhook

- [x] Endpoint admin `GET /api/admin/stripe-webhook/status`.
- [x] Requiere token.
- [x] Requiere `SUPER_ADMIN`.
- [x] Devuelve URL interna y URL completa.
- [x] Devuelve último evento.
- [x] Devuelve eventos últimas 24h.
- [x] Devuelve fallidos últimas 24h.
- [x] Pantalla `/admin/stripe-webhook`.
- [x] Botón copiar URL.
- [x] Dashboard muestra botón para `SUPER_ADMIN`.

### 14.3 Pendientes

- [ ] Checklist visual de configuración webhook más completo.
- [ ] Healthcheck público no sensible para webhook.
- [ ] Monitoreo de latencia del webhook.
- [ ] Cola para procesamiento pesado.
- [ ] Reintentos internos controlados.
- [ ] Panel de últimos N eventos con detalle ampliado.
- [ ] Acción de reprocesar evento fallido si es seguro.
- [ ] Alertas administrativas por fallos repetidos.

---

## 15. Stripe Billing Portal

### 15.1 Backend

- [x] Endpoint `POST /api/billing/portal`.
- [x] Requiere token.
- [x] Valida `organizationId`.
- [x] Valida `Organization.stripeCustomerId`.
- [x] Crea sesión de Stripe Billing Portal.
- [x] Usa `return_url = WEB_URL/dashboard`.
- [x] Devuelve `{ url }`.
- [x] Si no hay cliente Stripe, responde 400 claro.

### 15.2 Frontend

- [x] Dashboard muestra botón “Administrar suscripción” si hay `stripeSubscriptionId`.
- [x] Botón llama endpoint.
- [x] Redirige al Billing Portal.
- [x] Se probó apertura del portal.
- [x] Mostrar en Dashboard aviso de cancelación programada.
- [ ] Verificar comportamiento de downgrade/cancelación en portal.
- [ ] Mejorar copy operativo para usuario final.

---

## 16. Estado actual de suscripción

### Backend

- [x] Endpoint `GET /api/billing/current-plan`.
- [x] Devuelve `status`.
- [x] Devuelve `stripeSubscriptionId`.
- [x] Devuelve `plan`.
- [x] Devuelve `currentPeriodEnd`.
- [x] Devuelve `cancelAtPeriodEnd`.
- [x] Devuelve `canceledAt`.

### Frontend

- [x] Dashboard consume current plan.
- [x] Dashboard muestra plan/estado/RFCs/suscripción.
- [x] Dashboard muestra mensaje si `cancelAtPeriodEnd = true`.
- [x] Dashboard muestra fecha de fin de periodo en formato legible.
- [x] Dashboard oculta "Cancelación programada: No".
- [x] Dashboard muestra estados como Activa, Pago pendiente, Cancelada, Incompleta, etc. traducidos.

---

## 17. Control de uso mensual

### Backend

- [x] Campo `Plan.monthlyUsageLimit`.
- [x] Seed: Essential = 20 usos/mes.
- [x] Seed: planes pagados = `null` / ilimitado.
- [x] Modelo `UsageEvent`.
- [x] Servicio `UsageService.registerUsage()`.
- [x] Endpoint `GET /api/usage/current`.
- [x] Endpoint temporal `POST /api/usage/test-consume`.
- [x] Cálculo mensual del primer día 00:00 al primer día del siguiente mes 00:00.
- [x] Essential bloquea uso 21 con `USAGE_LIMIT_EXCEEDED`.
- [x] Planes pagados no bloquean por límite.
- [x] `test-consume` permite registrar sin consumir si `consumesUsage=false`.

### Frontend

- [x] Dashboard muestra tarjeta “Uso mensual”.
- [x] Plan pagado muestra ilimitado.
- [x] Essential muestra usados, límite y restantes.
- [x] Al llegar a cero muestra alerta roja.
- [x] Al estar cerca del límite muestra alerta amarilla.
- [ ] Integrar consumo real desde módulo XML.
- [ ] Integrar consumo real desde módulo Laboral si aplica.
- [ ] Eliminar o proteger endpoint temporal en producción.
- [ ] Definir qué acciones consumen uso por módulo.

---

## 18. Control de módulos

### 18.1 Módulos definidos

| Módulo | Estado | Descripción |
|---|---:|---|
| `AUDITORIA_XML` | [x] | Módulo de auditoría/análisis XML. |
| `LABORAL` | [x] | Módulo laboral México. |
| `ADMIN_STRIPE_WEBHOOK` | [x] | Administración webhook Stripe. |
| `ADMIN_USERS` | [x] | Administración de usuarios. |
| `ADMIN_MODULES` | [x] | Administración de permisos de módulos. |
| `ADMIN_ANALYTICS` | [x] | Analítica administrativa. |

### 18.2 Matriz plan-módulo

- [x] `PlanModuleAccess` implementado.
- [x] Seed idempotente con reglas.
- [x] Essential tiene Auditoría XML individual sin ZIP.
- [x] Essential no tiene Laboral.
- [x] Professional/Corporation/Forensic tienen Auditoría XML + ZIP.
- [x] Professional/Corporation/Forensic tienen Laboral.
- [x] Módulos admin son `adminOnly`.
- [x] Permisos contemplan `enabled`, `adminOnly`, `beta`, `consumesUsage`, `allowSingleXml`, `allowZip`.

### 18.3 Endpoints/UI

- [x] `GET /api/modules/available`.
- [x] `ModuleAccessService.assertModuleAccess()`.
- [x] Dashboard muestra módulos disponibles.
- [x] Cards de módulos navegables.
- [x] Placeholder `/modules/xml-audit`.
- [x] Placeholder `/modules/labor`.
- [x] `GET /api/admin/modules/access`.
- [x] `PATCH /api/admin/modules/access/:id`.
- [x] Pantalla `/admin/modules`.
- [x] Checkboxes para permisos de módulos.
- [ ] Mejorar UI final de módulos.
- [ ] Implementar módulo XML real.
- [ ] Implementar módulo Laboral real.
- [ ] Implementar Admin Analytics real.

---

## 19. Admin Usuarios

### 19.1 Backend

- [x] `GET /api/admin/users`.
- [x] `GET /api/admin/users/export`.
- [x] `POST /api/admin/users`.
- [x] `PATCH /api/admin/users/:userId`.
- [x] `PATCH /api/admin/users/:userId/plan`.
- [x] `PATCH /api/admin/users/:userId/status`.
- [x] `DELETE /api/admin/users/:userId`.
- [x] Todos requieren `SUPER_ADMIN`.
- [x] Exportación con ExcelJS.
- [x] No se expone `passwordHash`.
- [x] No se exponen secretos.
- [x] Cambio manual de plan es override local y no cancela Stripe.
- [x] Cambio a Essential limpia `stripeSubscriptionId`.
- [x] Suspensión bloquea login.
- [x] Reactivación limpia `bannedAt`/`bannedReason`.
- [x] Eliminación lógica usa `status = DELETED`.
- [x] Eliminación lógica bloquea login.
- [x] No permite autosuspensión.
- [x] No permite autoeliminación.

### 19.2 Frontend

- [x] Pantalla `/admin/users`.
- [x] Tabla de usuarios.
- [x] Exportar Excel.
- [x] Crear usuario.
- [x] Editar nombre/email/organización.
- [x] Cambiar plan con selector.
- [x] Suspender.
- [x] Reactivar.
- [x] Eliminar lógicamente.
- [x] Usuarios `DELETED` quedan sin acciones operativas.
- [x] Mensajes de éxito/error.
- [ ] Mejorar tabla responsive.
- [ ] Agregar filtros/búsqueda.
- [ ] Agregar paginación.
- [ ] Agregar ordenamiento.
- [ ] Agregar auditoría de cambios.
- [ ] Agregar vista detalle de usuario.
- [ ] Mejorar formularios con componentes premium.

---

## 20. Admin Analytics

- [x] Módulo definido.
- [x] Aparece como módulo admin para `SUPER_ADMIN`.
- [ ] Endpoint real de KPIs.
- [ ] Dashboard analítico real.
- [ ] Métricas de uso por módulo.
- [ ] Métricas por plan.
- [ ] Métricas por organización.
- [ ] Métricas de conversión checkout.
- [ ] Métricas de fallos Stripe.
- [ ] Exportación de reportes.
- [ ] Alertas.

---

## 21. Módulo Auditoría XML CFDI

### 21.1 Requisitos base

- [x] Módulo definido en DB.
- [x] Placeholder frontend.
- [x] Control de acceso por plan.
- [x] Essential permite XML individual.
- [x] Planes pagados permiten XML individual y ZIP.
- [x] Essential consume uso mensual.
- [ ] Carga real de XML individual.
- [ ] Carga real de ZIP.
- [ ] Parseo CFDI.
- [ ] Validación estructura XML.
- [ ] Detección tipo comprobante.
- [ ] Detección complemento de pago.
- [ ] Extracción de UUID.
- [ ] Extracción de RFC emisor/receptor.
- [ ] Extracción de subtotal, impuestos, retenciones, total.
- [ ] Extracción de serie/folio/fecha/moneda.
- [ ] Validación de uso CFDI.
- [ ] Validación contra SAT.
- [ ] Consulta automática de estatus SAT cuando sea posible.
- [ ] Reintento manual si falla SAT.
- [ ] Mostrar estatus legal SAT.
- [ ] Reporte de hallazgos.
- [ ] Exportación Excel.
- [ ] Exportación PDF.
- [ ] Manejo de XML mal formado.
- [ ] Manejo seguro de BOM/UTF-8 sin reescritura riesgosa.
- [ ] Validación masiva ZIP.
- [ ] Control de cuota/uso por análisis.
- [ ] Registro de metadata temporal.
- [ ] Eliminación automática de metadata después de 24 horas.
- [ ] No almacenamiento permanente de XML/PDF fuente por regla base.
- [ ] Admin puede consultar metadata completa por usuario durante ventana permitida.
- [ ] Admin puede descargar Excel diario dentro de 24h.

### 21.2 Requisitos futuros fiscales

- [ ] Administración de RFCs por organización/despacho.
- [ ] Alta/baja manual de RFCs.
- [ ] Alta automática al cargar XML si detecta RFC nuevo y hay cupo.
- [ ] Bloqueo si se excede cupo de RFCs.
- [ ] Futuras e.firmas limitadas a RFCs registrados y capacidad del plan.
- [ ] Validar documentos con criterios SAT actualizados.
- [ ] Avisos claros de que el análisis no sustituye revisión fiscal profesional.

---

## 22. Módulo Laboral México

### 22.1 Alcance funcional

- [x] Módulo definido en DB.
- [x] Placeholder frontend.
- [x] Control de acceso por plan.
- [x] Essential no accede.
- [x] Planes pagados acceden.
- [ ] Cálculo de aguinaldo.
- [ ] Cálculo de vacaciones.
- [ ] Cálculo de prima vacacional.
- [ ] Cálculo de PTU/utilidades.
- [ ] Cálculo de finiquito por renuncia.
- [ ] Cálculo de liquidación/indemnización por despido.
- [ ] Cálculo de prima de antigüedad.
- [ ] Cálculo de conceptos relacionados.
- [ ] Parámetros por vigencia legal.
- [ ] Motor parametrizable, no hardcodeado en UI.
- [ ] Reportes PDF.
- [ ] Reportes con nombre de despacho/organización.
- [ ] Reportes con firma/responsable/datos de contacto.
- [ ] Logotipo personalizado solo en planes pagados.
- [ ] Essential sin logotipo personalizado.
- [ ] Historial de cálculos.
- [ ] Exportación Excel.
- [ ] Auditoría de cálculos.

### 22.2 Requisitos no funcionales laborales

- [ ] Versionado de parámetros legales.
- [ ] Trazabilidad de fórmula aplicada.
- [ ] Fecha de vigencia de cálculo.
- [ ] Disclaimer legal.
- [ ] Validaciones de entrada robustas.

---

## 23. Facturación / solicitud de factura

- [x] Cobro por Stripe.
- [x] Checkout hospedado.
- [x] Portal de cliente Stripe.
- [ ] Factura de suscripción se solicita por correo a `consafedev@gmail.com`.
- [ ] Mostrar ID de suscriptor con sesión iniciada.
- [ ] Agregar copy claro para solicitud de factura.
- [ ] Automatizar solicitud de factura en el futuro si conviene.
- [ ] Integración con proveedor fiscal/facturación si se decide.

---

## 24. Privacidad, seguridad y retención de datos

### 24.1 Requisitos

- [ ] Aviso de Privacidad para MVP.
- [ ] Términos y Condiciones para MVP.
- [ ] Política de retención de metadata fiscal por 24 horas.
- [ ] Eliminación automática de metadata después de 24 horas.
- [ ] No almacenamiento permanente de XML/PDF fuente por regla base.
- [ ] Admin puede consultar metadata completa por usuario para depuración/analítica/mejora, dentro de la ventana permitida.
- [ ] Logs sin secretos.
- [ ] Respuestas API sin secretos.
- [ ] Definir política de backups.
- [ ] Definir política de eliminación de cuenta/organización.
- [ ] Definir cumplimiento legal para datos fiscales/laborales mexicanos.
- [ ] Definir controles de acceso administrativos.
- [ ] Definir política de soporte y tratamiento de datos.

---

## 25. UI/UX

### 25.1 Estado actual

- [x] Login funcional.
- [x] Registro funcional.
- [x] Dashboard funcional.
- [x] Planes funcional.
- [x] Admin Usuarios funcional.
- [x] Admin Planes funcional.
- [x] Admin Módulos funcional.
- [x] Admin Webhook funcional.
- [x] Páginas billing success/cancel funcionales.
- [x] Tema oscuro inicial.
- [x] Flujo técnico validable.

### 25.2 Requisito final

- [ ] UI premium.
- [ ] UX moderna.
- [ ] Interfaz cómoda e intuitiva.
- [ ] Look & feel altamente profesional.
- [ ] Diseño responsive real.
- [ ] Componentes consistentes.
- [ ] Estados de carga refinados.
- [ ] Estados de error refinados.
- [ ] Microcopy profesional.
- [ ] Accesibilidad.
- [ ] Landing pública comercial.
- [ ] Onboarding guiado.
- [ ] Navegación lateral/topbar formal.
- [ ] Diseño visual por módulos.
- [ ] Empty states profesionales.
- [ ] Confirmaciones y modales propios en lugar de `window.confirm/prompt`.

---

## 26. Despliegue e infraestructura

### 26.1 Actual

- [x] Desarrollo local en PC.
- [x] PostgreSQL accesible en LAN.
- [x] Stripe test validado.
- [x] Cloudflare Tunnel/Stripe CLI usados para pruebas.
- [ ] Despliegue final en servidor Debian vía GitHub.
- [ ] Dominio público final.
- [ ] HTTPS final.
- [ ] Variables de entorno productivas.
- [ ] Servicio systemd/PM2/containerización si se decide.
- [ ] Nginx/Reverse proxy.
- [ ] Backups PostgreSQL.
- [ ] Logs estructurados.
- [ ] Observabilidad.
- [ ] Monitoreo.
- [ ] CI/CD desde GitHub.
- [ ] Separación ambientes dev/staging/prod.
- [ ] Migraciones controladas en producción.

---

## 27. Variables de entorno

### 27.1 Variables conocidas

- [x] `DATABASE_URL`
- [x] `JWT_ACCESS_SECRET`
- [x] `BOOTSTRAP_ADMIN_EMAIL`
- [x] `BOOTSTRAP_ADMIN_PASSWORD`
- [x] `STRIPE_SECRET_KEY`
- [x] `STRIPE_WEBHOOK_SECRET`
- [x] `STRIPE_PRICE_PROFESSIONAL_MONTHLY`
- [x] `STRIPE_PRICE_PROFESSIONAL_YEARLY`
- [x] `STRIPE_PRICE_CORPORATION_MONTHLY`
- [x] `STRIPE_PRICE_CORPORATION_YEARLY`
- [x] `STRIPE_PRICE_FORENSIC_AUDITOR_MONTHLY`
- [x] `STRIPE_PRICE_FORENSIC_AUDITOR_YEARLY`
- [x] `WEB_URL`

### 27.2 Reglas

- [x] No exponer valores reales en documentación.
- [x] No imprimir secretos en logs.
- [x] Price IDs iniciales pueden sembrarse desde env.
- [x] Checkout ya usa Price IDs desde DB.
- [ ] Validar env por ambiente.
- [ ] Separar test/live formalmente.
- [ ] Documentar `.env.example`.

---

## 28. APIs implementadas

### Auth

- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `GET /api/auth/me`

### Billing

- [x] `POST /api/billing/checkout`
- [x] `POST /api/billing/portal`
- [x] `GET /api/billing/current-plan`

### Stripe

- [x] `POST /api/webhooks/stripe`
- [x] `GET /api/admin/stripe-webhook/status`

### Plans

- [x] `GET /api/plans`
- [x] `GET /api/admin/plans`
- [x] `PATCH /api/admin/plans/:planKey`

### Modules

- [x] `GET /api/modules/available`
- [x] `GET /api/admin/modules/access`
- [x] `PATCH /api/admin/modules/access/:id`

### Usage

- [x] `GET /api/usage/current`
- [x] `POST /api/usage/test-consume`

### Admin Users

- [x] `GET /api/admin/users`
- [x] `GET /api/admin/users/export`
- [x] `POST /api/admin/users`
- [x] `PATCH /api/admin/users/:userId`
- [x] `PATCH /api/admin/users/:userId/plan`
- [x] `PATCH /api/admin/users/:userId/status`
- [x] `DELETE /api/admin/users/:userId`

### Pendientes API

- [ ] `POST /api/xml-audit/analyze`
- [ ] `POST /api/xml-audit/analyze-zip`
- [ ] `GET /api/xml-audit/results/:id`
- [ ] `GET /api/xml-audit/export/:id`
- [ ] `POST /api/labor/calculate`
- [ ] `GET /api/labor/results/:id`
- [ ] `GET /api/labor/export/:id`
- [ ] `GET /api/admin/analytics`
- [ ] `GET /api/admin/audit-logs`
- [ ] Endpoints RFC profiles.
- [ ] Endpoints organización/perfil fiscal.
- [ ] Endpoints de facturación/solicitud de factura.

---

## 29. Frontend implementado

- [x] `/login`
- [x] `/register`
- [x] `/dashboard`
- [x] `/plans`
- [x] `/billing/success`
- [x] `/billing/cancel`
- [x] `/admin/stripe-webhook`
- [x] `/admin/modules`
- [x] `/admin/users`
- [x] `/admin/plans`
- [x] `/modules/xml-audit`
- [x] `/modules/labor`

### Pendientes Frontend

- [ ] Layout principal premium.
- [ ] Navegación global.
- [ ] Landing pública.
- [ ] Página legal: Aviso de Privacidad.
- [ ] Página legal: Términos y Condiciones.
- [ ] Página de soporte/contacto.
- [ ] Gestión de RFCs.
- [ ] Perfil de organización.
- [ ] Módulo XML real.
- [ ] Módulo Laboral real.
- [ ] Admin Analytics.
- [ ] Reportes/descargas reales.
- [ ] Componentes propios de modal/confirmación.

---

## 30. Requisitos no funcionales

### Seguridad

- [x] Password hash con Argon2.
- [x] JWT con secret.
- [x] Rutas admin protegidas por rol.
- [x] Stripe webhook con firma.
- [x] No almacenar secretos en eventos.
- [x] Borrado lógico de usuarios.
- [ ] Rate limiting.
- [ ] Protección CSRF si aplica.
- [ ] Hardening headers.
- [ ] Auditoría administrativa.
- [ ] Gestión de permisos granular.
- [ ] Revisión de dependencias.
- [ ] Política de backup/restauración.
- [ ] Escaneo de secretos en repositorio.
- [ ] Gestión segura de archivos XML/PDF.
- [ ] Encriptación de datos sensibles en reposo si aplica.

### Rendimiento

- [x] MVP opera con consultas directas Prisma.
- [ ] Paginación en Admin Usuarios.
- [ ] Paginación en eventos webhooks.
- [ ] Procesamiento en cola para ZIP/XML masivo.
- [ ] Límites de tamaño de archivo.
- [ ] Streaming de cargas grandes.
- [ ] Optimización de consultas por índices.
- [ ] Cache donde aplique.

### Escalabilidad

- [x] Arquitectura modular por planes/módulos.
- [x] Módulos habilitables por DB.
- [ ] Workers para análisis XML.
- [ ] Queue para tareas pesadas.
- [ ] Separación API/worker.
- [ ] Almacenamiento temporal de archivos seguro.
- [ ] Arquitectura multiambiente.

### Observabilidad

- [x] Logs básicos Fastify.
- [x] Estado de webhook últimas 24h.
- [ ] Healthcheck general.
- [ ] Healthcheck no sensible de webhook.
- [ ] Métricas de latencia.
- [ ] Métricas de uso.
- [ ] Alertas.
- [ ] Correlation IDs.
- [ ] Dashboard admin analytics.

### Mantenibilidad

- [x] Prompts atómicos.
- [x] Typecheck/lint recurrentes.
- [x] Seed idempotente.
- [x] Migraciones Prisma.
- [ ] Tests unitarios.
- [ ] Tests de integración.
- [ ] Tests e2e.
- [ ] Documentación técnica de endpoints.
- [ ] `.env.example`.
- [ ] Guía de despliegue.
- [ ] Runbook operativo.

### Legal/Compliance

- [ ] Aviso de Privacidad.
- [ ] Términos y Condiciones.
- [ ] Política de cookies si aplica.
- [ ] Consentimiento de tratamiento de datos fiscales/laborales.
- [ ] Política de retención.
- [ ] Disclaimer fiscal/laboral.
- [ ] Procedimiento de eliminación/exportación de datos.

---

## 31. Pruebas ejecutadas / evidencia funcional

- [x] Login correcto con admin.
- [x] Login con contraseña incorrecta rechaza.
- [x] `/api/auth/me` responde con token válido.
- [x] Registro individual crea usuario.
- [x] Registro organización crea usuario + organización.
- [x] Admin principal creado por bootstrap.
- [x] Prisma Studio valida usuarios/planes/módulos/suscripciones.
- [x] Checkout mensual redirige a Stripe.
- [x] Checkout anual redirige a Stripe.
- [x] Cancel URL funciona.
- [x] Success URL funciona.
- [x] Stripe test card procesa pago.
- [x] Webhook con firma incorrecta falla.
- [x] Webhook con secret correcto procesa 200.
- [x] Suscripción se eleva por webhook.
- [x] Billing Portal abre correctamente.
- [x] Admin users exporta Excel y abre en Excel.
- [x] Cambio manual de plan se refleja.
- [x] Uso 21 en Essential bloquea.
- [x] Plan pagado muestra uso ilimitado.
- [x] Usuario sin permisos no puede acceder a admin.
- [x] Autoeliminación/autosuspensión se rechaza.
- [ ] Pruebas automatizadas.
- [ ] Pruebas de carga.
- [ ] Pruebas de seguridad.
- [ ] Pruebas end-to-end CI.

---

## 32. Riesgos identificados

- [ ] UI actual es funcional pero no representa calidad premium final.
- [ ] Falta automatización de pruebas.
- [ ] Falta estrategia robusta de retención/eliminación de metadata XML.
- [ ] Falta cola para análisis masivo.
- [ ] Falta hardening de producción.
- [ ] Falta gestión formal de backups.
- [ ] Falta política legal completa.
- [ ] Falta definir si Stripe Live se usará solo al final o también en staging controlado.
- [ ] Falta gestión integral de cambios de plan iniciados desde Stripe Portal.
- [ ] Falta reconciliación periódica Stripe ↔ DB.
- [ ] Falta auditoría administrativa formal.

---

## 33. Backlog priorizado

### Inmediato

- [x] 06L — Mostrar cancelación programada en Dashboard. *(Decisión UX: No mostrar cancelación programada cuando sea false para no incentivar cancelación. Solo mostrar información cuando exista cancelación activa.)*
- [ ] 06M — Probar cancelación desde Billing Portal y validar webhook.
- [ ] 06N — Reconciliación básica Stripe current subscription si se requiere.
- [ ] Mejorar estado visual de suscripción en dashboard.
- [ ] Documentar `.env.example`.

### Corto plazo

- [ ] Admin Analytics mínimo.
- [ ] Perfil de organización.
- [ ] Gestión de RFCs.
- [ ] Aviso de privacidad y términos.
- [ ] Healthcheck general.
- [ ] Audit logs administrativos.
- [ ] Tests básicos API.

### MVP funcional real

- [ ] Auditoría XML individual.
- [ ] Auditoría XML ZIP para planes pagados.
- [ ] Validación SAT.
- [ ] Uso mensual real conectado a análisis XML.
- [ ] Laboral México base.
- [ ] Reportes exportables.
- [ ] Retención 24h.

### Profesionalización

- [ ] UI/UX premium.
- [ ] Landing pública.
- [ ] CI/CD.
- [ ] Producción Debian.
- [ ] Observabilidad.
- [ ] Soporte/Facturación.
- [ ] Políticas legales completas.

---

## 34. Prompt inmediato siguiente — ✅ 06L COMPLETADO

El prompt 06L fue ejecutado. Ahora el Dashboard muestra alerta amarilla cuando `cancelAtPeriodEnd = true`, muestra fecha `currentPeriodEnd` en formato DD/MM/YYYY, muestra estados traducidos, y oculta la fila "Cancelación programada: No" cuando no aplica. Decisión UX documentada en secciones 10.2 y backlog.

### Prompt ejecutado:

```txt
Objetivo:
Mostrar en el Dashboard si una suscripción Stripe está programada para cancelarse al final del periodo.

Alcance:
1. Modificar DashboardPage.

2. Usar los nuevos campos que ya devuelve GET /api/billing/current-plan:
- cancelAtPeriodEnd
- currentPeriodEnd
- canceledAt

3. Si subscription.cancelAtPeriodEnd === true:
mostrar alerta amarilla en la tarjeta Plan actual:
"Tu suscripción está programada para cancelarse al finalizar el periodo actual."

4. Si currentPeriodEnd existe:
mostrar:
"Acceso disponible hasta: DD/MM/YYYY"

5. Si subscription.status === "canceled" o canceledAt existe:
mostrar alerta roja:
"Tu suscripción fue cancelada."

6. Mantener botón "Administrar suscripción" si existe stripeSubscriptionId.

7. No romper los casos:
- Essential sin Stripe
- usuario sin organización
- SUPER_ADMIN sin organización
- plan pagado activo sin cancelación

Restricciones:
- No backend.
- No Prisma.
- No Stripe API.
- No webhooks.
- No rediseño final.

Criterios:
- pnpm typecheck pasa.
- pnpm lint pasa.
- Dashboard muestra alerta amarilla cuando cancelAtPeriodEnd=true.
- Dashboard muestra fecha currentPeriodEnd si existe.
- Dashboard muestra alerta roja si status=canceled o canceledAt existe.
- Dashboard activo normal sigue igual cuando no hay cancelación.
```

---

## 35. Definición de “MVP listo”

El MVP podrá considerarse listo cuando:

- [ ] Auth completo y estable.
- [x] Registro/login funcional.
- [x] Planes y suscripciones funcionales.
- [x] Stripe Checkout funcional.
- [x] Stripe Webhooks funcionales.
- [x] Stripe Billing Portal funcional.
- [x] Admin Users funcional.
- [x] Admin Plans funcional.
- [x] Admin Modules funcional.
- [ ] Aviso de privacidad y términos publicados.
- [ ] Módulo XML individual funcional.
- [ ] Control de uso conectado a XML real.
- [ ] Retención 24h implementada.
- [ ] Despliegue productivo estable.
- [ ] UI/UX suficientemente profesional para usuarios reales.
- [ ] Backups y monitoreo mínimos.
- [ ] Documentación operativa mínima.
