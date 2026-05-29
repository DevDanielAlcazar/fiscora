import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../config/env.js";

const PRICE_MAP: Record<string, Record<string, string>> = {
  PROFESSIONAL: {
    MONTHLY: env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    YEARLY: env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
  },
  CORPORATION: {
    MONTHLY: env.STRIPE_PRICE_CORPORATION_MONTHLY,
    YEARLY: env.STRIPE_PRICE_CORPORATION_YEARLY,
  },
  FORENSIC_AUDITOR: {
    MONTHLY: env.STRIPE_PRICE_FORENSIC_AUDITOR_MONTHLY,
    YEARLY: env.STRIPE_PRICE_FORENSIC_AUDITOR_YEARLY,
  },
};

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
      const priceId = PRICE_MAP[planKey][billingCycle];

      if (!priceId || priceId === "price_placeholder") {
        return reply.code(500).send({
          error: {
            code: "PRICE_NOT_CONFIGURED",
            message: `El precio para ${planKey} ${billingCycle} no está configurado.`,
          },
        });
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${env.WEB_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${env.WEB_URL}/billing/cancel`,
          customer_email: request.user.email,
          metadata: {
            userId: request.user.userId,
            organizationId: request.user.organizationId ?? "",
            planKey,
            billingCycle,
          },
        });

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
}
