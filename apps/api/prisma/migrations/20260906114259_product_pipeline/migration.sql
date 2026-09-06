-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "product_assets" ADD COLUMN     "lodLevel" INTEGER;

-- CreateTable
CREATE TABLE "model_jobs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "errorCode" TEXT,
    "stats" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_jobs_productId_createdAt_idx" ON "model_jobs"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "model_jobs_status_idx" ON "model_jobs"("status");

-- AddForeignKey
ALTER TABLE "model_jobs" ADD CONSTRAINT "model_jobs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
