import type { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { env } from "../config/env.js";

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer", bodyLimit: 1024 * 128 },
    async (req: FastifyRequest, body: Buffer) => {
      if (req.url === "/api/webhooks/stripe") {
        return body;
      }
      return JSON.parse(body.toString("utf-8"));
    },
  );

  fastify.post("/api/webhooks/stripe", {
    handler: async (request, reply) => {
      const sig = (request.headers["stripe-signature"] as string) ?? "";

      if (!sig) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Falta firma Stripe" },
        });
      }

      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const rawBody = request.body as Buffer;
        const event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);

        fastify.log.info({ eventId: event.id, eventType: event.type }, "Stripe webhook received");

        return reply.send({ received: true });
      } catch (err) {
        fastify.log.warn(err, "Invalid Stripe webhook signature");
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "Firma Stripe inválida" },
        });
      }
    },
  });
}
