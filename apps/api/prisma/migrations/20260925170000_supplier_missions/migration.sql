-- Missions a supplier writes for their own product.
--
-- The script is a JSON document rather than a table of steps: a supplier
-- authors a mission as one thing, it is validated by one zod schema on the way
-- in, and every read re-parses it with that same schema. Splitting it into
-- columns would buy queryability nobody needs — nothing ever asks "which
-- missions have a step longer than four seconds" — at the price of a join and
-- eight more migrations the first time the shape moves.

-- CreateTable
CREATE TABLE "supplier_missions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "script" JSONB NOT NULL,
    "percentOff" INTEGER NOT NULL DEFAULT 5,
    "status" "ModerationStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_missions_productId_key" ON "supplier_missions"("productId");

-- CreateIndex
CREATE INDEX "supplier_missions_status_idx" ON "supplier_missions"("status");

-- AddForeignKey
ALTER TABLE "supplier_missions" ADD CONSTRAINT "supplier_missions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
