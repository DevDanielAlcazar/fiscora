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

  async function processCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    if (session.mode !== "subscription") return;

    const metadata = session.metadata ?? {};
    const organizationId = metadata.organizationId;
    const planKey = metadata.planKey;

    if (!organizationId || !planKey) {
      throw new Error("Faltan datos de metadata: organizationId o planKey");
    }

    const organization = await fastify.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new Error(`Organization ${organizationId} no encontrada`);
    }

    const plan = await fastify.prisma.plan.findUnique({
      where: { key: planKey },
    });

    if (!plan) {
      throw new Error(`Plan ${planKey} no encontrado`);
    }

    const stripeSubscriptionId = (session.subscription as string) ?? undefined;
    const stripeCustomerId = (session.customer as string) ?? undefined;

    await fastify.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { organizationId },
        data: {
          planId: plan.id,
          status: "active",
          stripeSubscriptionId,
        },
      });

      if (stripeCustomerId) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { stripeCustomerId },
        });
      }
    });

    fastify.log.info(
      { organizationId, planKey, stripeSubscriptionId },
      "Subscription updated from checkout.session.completed",
    );
  }

  async function processSubscriptionUpdated(subscription: Stripe.Subscription) {
    const stripeSubscriptionId = subscription.id;
    const status = subscription.status;
    const metadata = subscription.metadata ?? {};
    const sub = subscription as unknown as Record<string, unknown>;
    const cancelAtPeriodEnd = (sub.cancel_at_period_end as boolean) ?? false;
    const currentPeriodEnd = sub.current_period_end
      ? new Date((sub.current_period_end as number) * 1000)
      : undefined;
    const canceledAt = sub.canceled_at ? new Date((sub.canceled_at as number) * 1000) : undefined;
    const currentPeriodStart = sub.current_period_start
      ? new Date((sub.current_period_start as number) * 1000)
      : undefined;

    const updateData: {
      status: string;
      stripeSubscriptionId: string;
      planId?: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd?: Date;
      canceledAt?: Date | null;
      currentPeriodStart?: Date;
    } = {
      status,
      stripeSubscriptionId,
      cancelAtPeriodEnd,
    };

    if (currentPeriodEnd) updateData.currentPeriodEnd = currentPeriodEnd;
    if (canceledAt) updateData.canceledAt = canceledAt;
    if (currentPeriodStart) updateData.currentPeriodStart = currentPeriodStart;

    const organizationId = metadata.organizationId;
    const planKey = metadata.planKey;

    if (organizationId && planKey) {
      const plan = await fastify.prisma.plan.findUnique({
        where: { key: planKey },
        select: { id: true },
      });

      if (plan) {
        updateData.planId = plan.id;
      }
    }

    await fastify.prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: updateData,
    });

    fastify.log.info(
      { stripeSubscriptionId, status, cancelAtPeriodEnd },
      "Subscription updated from customer.subscription.updated",
    );
  }

  async function processSubscriptionDeleted(subscription: Stripe.Subscription) {
    const stripeSubscriptionId = subscription.id;

    const existing = await fastify.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      select: { id: true },
    });

    if (!existing) {
      fastify.log.warn(
        { stripeSubscriptionId },
        "Subscription not found for customer.subscription.deleted",
      );
      return;
    }

    const essentialPlan = await fastify.prisma.plan.findUnique({
      where: { key: "ESSENTIAL" },
      select: { id: true },
    });

    const sub = subscription as unknown as Record<string, unknown>;
    const canceledAt = sub.canceled_at ? new Date((sub.canceled_at as number) * 1000) : new Date();

    await fastify.prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: "canceled",
        cancelAtPeriodEnd: false,
        canceledAt,
        ...(essentialPlan ? { planId: essentialPlan.id } : {}),
      },
    });

    fastify.log.info(
      { stripeSubscriptionId },
      "Subscription canceled and reverted to Essential from customer.subscription.deleted",
    );
  }

  async function processInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : null;

    if (!stripeSubscriptionId) {
      fastify.log.warn("Invoice has no subscription reference");
      return;
    }

    const existing = await fastify.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      select: { id: true },
    });

    if (!existing) {
      fastify.log.warn(
        { stripeSubscriptionId },
        "Subscription not found for invoice.payment_failed",
      );
      return;
    }

    await fastify.prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: "past_due" },
    });

    fastify.log.info(
      { stripeSubscriptionId },
      "Subscription set to past_due from invoice.payment_failed",
    );
  }

  async function processInvoicePaid(invoice: Stripe.Invoice) {
    const stripeSubscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : null;

    if (!stripeSubscriptionId) {
      fastify.log.warn("Invoice has no subscription reference");
      return;
    }

    const existing = await fastify.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      select: { id: true },
    });

    if (!existing) {
      fastify.log.warn({ stripeSubscriptionId }, "Subscription not found for invoice.paid");
      return;
    }

    await fastify.prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: { status: "active" },
    });

    fastify.log.info({ stripeSubscriptionId }, "Subscription set to active from invoice.paid");
  }

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

        const record = await fastify.prisma.stripeWebhookEvent.upsert({
          where: { stripeEventId: event.id },
          update: {},
          create: {
            stripeEventId: event.id,
            type: event.type,
            livemode: event.livemode,
            status: "RECEIVED",
            receivedAt: new Date(),
          },
        });

        if (record.status === "PROCESSED") {
          fastify.log.info(
            { eventId: event.id, eventType: event.type },
            "Stripe webhook already processed, skipping",
          );
          return reply.send({ received: true, duplicate: true });
        }

        try {
          if (event.type === "checkout.session.completed") {
            await processCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          }

          if (event.type === "customer.subscription.updated") {
            await processSubscriptionUpdated(event.data.object as Stripe.Subscription);
          }

          if (event.type === "customer.subscription.deleted") {
            await processSubscriptionDeleted(event.data.object as Stripe.Subscription);
          }

          if (event.type === "invoice.payment_failed") {
            await processInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          }

          if (event.type === "invoice.paid") {
            await processInvoicePaid(event.data.object as Stripe.Invoice);
          }

          await fastify.prisma.stripeWebhookEvent.update({
            where: { id: record.id },
            data: { status: "PROCESSED", processedAt: new Date() },
          });

          fastify.log.info(
            { eventId: event.id, eventType: event.type },
            "Stripe webhook processed successfully",
          );
        } catch (processingError) {
          const errorMessage =
            processingError instanceof Error
              ? processingError.message.slice(0, 500)
              : "Error desconocido";

          await fastify.prisma.stripeWebhookEvent.update({
            where: { id: record.id },
            data: {
              status: "FAILED",
              errorMessage,
              processedAt: new Date(),
            },
          });

          fastify.log.error(
            { eventId: event.id, eventType: event.type, errorMessage },
            "Failed to process Stripe webhook",
          );
        }

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
