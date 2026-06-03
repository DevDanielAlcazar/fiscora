import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../config/env.js";

const checkoutBodySchema = z.object({
  planKey: z.enum(["PROFESSIONAL", "CORPORATION", "FORENSIC_AUDITOR"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
});

export async function billingRoutes(fastify: FastifyInstance) {
  fastify.post("/api/billing/checkout", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const parseResult = checkoutBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const { planKey, billingCycle } = parseResult.data;

      if (!request.user.organizationId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "La cuenta no tiene organización asociada para facturación",
          },
        });
      }

      const plan = await fastify.prisma.plan.findUnique({
        where: { key: planKey },
        select: {
          stripeMonthlyPriceId: true,
          stripeYearlyPriceId: true,
        },
      });

      if (!plan) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: `El plan ${planKey} no existe.` },
        });
      }

      const priceId = billingCycle === "MONTHLY" ? plan.stripeMonthlyPriceId : plan.stripeYearlyPriceId;

      if (!priceId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "El plan no tiene configurado Stripe Price ID para este ciclo.",
          },
        });
      }

      const organization = await fastify.prisma.organization.findUnique({
        where: { id: request.user.organizationId },
        select: { stripeCustomerId: true },
      });

      if (!organization) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "La organización no existe.",
          },
        });
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);

        const metadata = {
          userId: request.user.userId,
          organizationId: request.user.organizationId,
          planKey,
          billingCycle,
        };

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${env.WEB_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${env.WEB_URL}/billing/cancel`,
          client_reference_id: request.user.organizationId,
          metadata,
          subscription_data: { metadata },
        };

        if (organization.stripeCustomerId) {
          sessionParams.customer = organization.stripeCustomerId;
        } else {
          sessionParams.customer_email = request.user.email;
          sessionParams.customer_creation = "always";
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        fastify.log.info(
          { sessionId: session.id, planKey, billingCycle },
          "Checkout session created",
        );

        return reply.send({ url: session.url });
      } catch (error) {
        fastify.log.error(error, "Failed to create checkout session");
        return reply.code(500).send({
          error: {
            code: "STRIPE_ERROR",
            message: "Error al crear la sesión de pago.",
          },
        });
      }
    },
  });

  fastify.get("/api/billing/current-plan", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (!request.user.organizationId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "La cuenta no tiene organización asociada",
          },
        });
      }

      const subscription = await fastify.prisma.subscription.findUnique({
        where: { organizationId: request.user.organizationId },
        select: {
          status: true,
          stripeSubscriptionId: true,
          plan: {
            select: {
              key: true,
              name: true,
              maxRfcProfiles: true,
              maxUsers: true,
            },
          },
        },
      });

      if (!subscription) {
        return reply.code(404).send({
          error: {
            code: "NOT_FOUND",
            message: "No se encontró una suscripción activa",
          },
        });
      }

      return reply.send({ subscription });
    },
  });

  fastify.post("/api/billing/portal", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (!request.user.organizationId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "La cuenta no tiene organización asociada",
          },
        });
      }

      const organization = await fastify.prisma.organization.findUnique({
        where: { id: request.user.organizationId },
        select: { stripeCustomerId: true },
      });

      if (!organization?.stripeCustomerId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "No hay cliente Stripe asociado a esta organización.",
          },
        });
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);

        const session = await stripe.billingPortal.sessions.create({
          customer: organization.stripeCustomerId,
          return_url: `${env.WEB_URL}/dashboard`,
        });

        return reply.send({ url: session.url });
      } catch (error) {
        fastify.log.error(error, "Failed to create portal session");
        return reply.code(500).send({
          error: {
            code: "STRIPE_ERROR",
            message: "Error al crear la sesión del portal.",
          },
        });
      }
    },
  });
}
