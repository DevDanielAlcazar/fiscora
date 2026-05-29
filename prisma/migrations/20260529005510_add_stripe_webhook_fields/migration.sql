/*
  Warnings:

  - You are about to drop the column `body` on the `StripeWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `StripeWebhookEvent` table. All the data in the column will be lost.
  - You are about to drop the column `processed` on the `StripeWebhookEvent` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `StripeWebhookEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StripeWebhookEvent" DROP COLUMN "body",
DROP COLUMN "error",
DROP COLUMN "processed",
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "livemode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
