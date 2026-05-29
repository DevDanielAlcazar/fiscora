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

        const existing = await fastify.prisma.stripeWebhookEvent.findUnique({
          where: { stripeEventId: event.id },
          select: { id: true },
        });

        if (existing) {
          fastify.log.info(
            { eventId: event.id, eventType: event.type },
            "Stripe webhook duplicate, skipping",
          );
          return reply.send({ received: true, duplicate: true });
        }

        await fastify.prisma.stripeWebhookEvent.create({
          data: {
            stripeEventId: event.id,
            type: event.type,
            livemode: event.livemode,
            status: "RECEIVED",
            receivedAt: new Date(),
          },
        });

        fastify.log.info({ eventId: event.id, eventType: event.type }, "Stripe webhook saved");

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
