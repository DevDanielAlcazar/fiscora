# Fiscora SaaS — Prompt Blueprints y Guía de Tareas Futuras

Este documento contiene las especificaciones y prompts estructurados para continuar el desarrollo del SaaS Fiscora sin acumular deuda técnica. Están diseñados para que un asistente de IA o desarrollador pueda ejecutarlos secuencialmente manteniendo los estándares del monorepo.

---

## 1. Tarea Inmediata: Autenticación y Bootstrap de Administrador

### Prompt Recomendado

```markdown
Contexto:
Tenemos un monorepo base de Fiscora con la estructura pnpm workspaces, Fastify en apps/api, React en apps/web y Prisma configurado.

Objetivo de la tarea:
Implementar el flujo de autenticación (JWT) y el script/plugin seguro de bootstrap de administrador utilizando las variables de entorno de la fase de preparación.

Requisitos técnicos del Backend (apps/api):

1. Instalar y configurar un plugin de autenticación JWT (p. ej., `@fastify/jwt` o firma manual usando jose/jsonwebtoken).
2. Crear un plugin de conexión a Prisma y registrarlo en `src/app.ts`.
3. Crear un script o hook de arranque en Fastify que lea `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`, verifique si ya existe un usuario con rol `SUPER_ADMIN` en la base de datos, y si no, lo cree de forma segura (hasheando la contraseña con bcrypt o argon2).
4. Crear endpoints de autenticación en `src/routes/auth.routes.ts`:
   - `POST /api/auth/register` (usa `registerSchema` de `@fiscora/validators`). Crea una organización y un usuario administrador de dicha organización.
   - `POST /api/auth/login` (usa `loginSchema` de `@fiscora/validators`). Devuelve tokens de acceso y refresco.
   - `POST /api/auth/refresh` para refrescar tokens.
   - `POST /api/auth/logout`.
5. Proteger endpoints futuros mediante un decorator `authenticate` (p. ej., `fastify.decorate("authenticate", ...)`).

Requisitos del Frontend (apps/web):

1. Implementar vistas de Login y Registro básicas alineadas con el sistema estético y de Tailwind configurado.
2. Guardar el estado de autenticación (con un AuthContext de React o similar) de forma segura.
3. Proteger la ruta del dashboard temporal para que solo sea accesible por usuarios autenticados.

Criterios de aceptación:

- Al arrancar la API con `pnpm dev:api`, si no existe el Super Admin especificado en el .env, se crea automáticamente.
- El registro de usuario crea una organización por defecto asociada al nuevo usuario.
- El typecheck y el linter pasan sin errores.
```

---

## 2. Integración con Stripe Checkout y Webhooks

### Prompt Recomendado

```markdown
Contexto:
Tenemos el monorepo de Fiscora con autenticación activa y Prisma mapeando las tablas `Subscription` y `Plan`.

Objetivo de la tarea:
Integrar el flujo de facturación y cobro recurrente utilizando Stripe Checkout y el procesamiento de eventos mediante Webhooks de Stripe.

Requisitos técnicos:

1. Crear un servicio de Stripe en la API que:
   - Cree una sesión de Stripe Checkout para suscribir una organización a un `PlanKey` específico.
   - Utilice los Price IDs del archivo de variables de entorno (.env).
2. Crear la ruta `POST /api/billing/checkout` para generar la URL de redirección a Stripe.
3. Crear el endpoint de Webhook `POST /api/billing/webhook` para escuchar eventos asíncronos de Stripe (configurado con firma de Stripe utilizando `STRIPE_WEBHOOK_SECRET`):
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
4. Al recibir el webhook, se debe insertar el log en `StripeWebhookEvent` y actualizar el modelo `Subscription` de la organización correspondiente en la base de datos mediante Prisma.
5. Controlar el acceso a los módulos en el frontend dependiendo del plan activo del usuario (bloquear UI de cálculos laborales si el plan es inferior a CORPORATION).

Criterios de aceptación:

- El webhook de Stripe procesa firmas válidas y descarta eventos corruptos.
- Al simular un pago exitoso mediante Stripe CLI, la base de datos se actualiza marcando el status de la suscripción como `active`.
```

---

## 3. Implementación de Lógica Real en el Motor XML

### Prompt Recomendado

```markdown
Contexto:
El paquete `packages/xml-engine` tiene funciones placeholder para auditar archivos XML.

Objetivo de la tarea:
Reemplazar los placeholders por lógica real para decodificar CFDIs de ingresos y egresos, y verificar discrepancias fiscales comunes según las normativas del SAT mexicano.

Requisitos técnicos:

1. Integrar una biblioteca ligera de parsing XML (p. ej. `fast-xml-parser`) en el paquete `@fiscora/xml-engine`.
2. Implementar lógica de extracción de nodos clave en `validateXmlStructure`:
   - Atributos del emisor y receptor (RFC, Nombre, Régimen Fiscal).
   - Datos del CFDI (UUID, Fecha, Total, Subtotal, FormaPago, MetodoPago, TipoDeComprobante).
   - Conceptos, impuestos trasladados e impuestos retenidos.
3. Implementar reglas de auditoría fiscal en el motor:
   - Detección de RFCs enlistados en el artículo 69-B del CFF (lista de EFOS / empresas fantasma, utilizando un mockup de base de datos o archivo JSON local).
   - Validación de consistencia aritmética: `SubTotal - Descuento + Impuestos Trasladados - Impuestos Retenidos = Total` con margen de tolerancia por redondeo.
   - Alertas por pagos en efectivo superiores a $2,000 MXN en facturas de deducción autorizada.
4. Exportar un desglose detallado de inconsistencias tipificadas como `XmlFinding` con severidades INFO, WARNING o ERROR.

Criterios de aceptación:

- Al subir un XML CFDI 4.0 real o mockup a través de un endpoint API, el motor extrae correctamente el UUID y detecta discrepancias aritméticas de forma automática.
```

---

## 4. Implementación del Motor Laboral LFT Completo

### Prompt Recomendado

```markdown
Contexto:
El paquete `packages/labor-engine` contiene simulaciones de cálculos de LFT mexicana.

Objetivo de la tarea:
Implementar los algoritmos de cálculo de prestaciones de ley con apego estricto al marco constitucional de la Ley Federal del Trabajo.

Requisitos técnicos:

1. Desarrollar las fórmulas detalladas dentro de `packages/labor-engine/src/calculators/`:
   - **Aguinaldo**: 15 días de salario base como mínimo general, o la parte proporcional calculada sobre los días laborados durante el año.
   - **Vacaciones y Prima Vacacional**: Aplicar la tabla de vacaciones oficial reformada en la LFT (mínimo de 12 días para el primer año incrementando 2 días por año subsiguiente) y calcular el 25% de prima vacacional mínima de ley.
   - **Finiquito**: Cálculo de partes proporcionales de aguinaldo, vacaciones y prima vacacional en caso de renuncia voluntaria.
   - **Liquidación / Indemnización**: Cálculo de indemnización constitucional (3 meses de salario), prima de antigüedad (12 días de salario por cada año trabajado topado a 2 salarios mínimos), y el pago adicional de 20 días por año si aplica por despido injustificado.
2. Calcular la retención del impuesto sobre la renta (ISR) proporcional para aguinaldos y liquidaciones aplicando los límites de exención (30 UMA para aguinaldo, 15 UMA para prima vacacional, y 90 UMA por año para indemnizaciones).
3. Estructurar el resultado completo respetando el tipado `LaborCalculationResult`.

Criterios de aceptación:

- Pasar una suite de pruebas unitarias cubriendo cálculos de aguinaldos de 1 año y liquidaciones de 5 años con coincidencia exacta de los límites de retención fiscal.
```
