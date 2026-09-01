-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('BARCODE', 'MARKET_LISTING');

-- AlterEnum
ALTER TYPE "ReputationEventType" ADD VALUE 'SUBMIT_BARCODE';
ALTER TYPE "ReputationEventType" ADD VALUE 'SUBMIT_BARCODE_APPROVED';
ALTER TYPE "ReputationEventType" ADD VALUE 'SUBMIT_BARCODE_REJECTED';
ALTER TYPE "ReputationEventType" ADD VALUE 'SUBMIT_MARKET_LISTING';
ALTER TYPE "ReputationEventType" ADD VALUE 'SUBMIT_MARKET_LISTING_APPROVED';
ALTER TYPE "ReputationEventType" ADD VALUE 'SUBMIT_MARKET_LISTING_REJECTED';

-- CreateTable
CREATE TABLE "product_contributions" (
    "id" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "marketId" TEXT,
    "barcode" TEXT,
    "barcodeFormat" "BarcodeFormat",
    "amount" INTEGER,
    "note" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdBarcodeId" TEXT,
    "createdPriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_contributions_type_status_idx" ON "product_contributions"("type", "status");
CREATE INDEX "product_contributions_userId_idx" ON "product_contributions"("userId");
CREATE INDEX "product_contributions_productId_idx" ON "product_contributions"("productId");
CREATE INDEX "product_contributions_marketId_idx" ON "product_contributions"("marketId");
CREATE INDEX "product_contributions_barcode_idx" ON "product_contributions"("barcode");

-- AddForeignKey
ALTER TABLE "product_contributions" ADD CONSTRAINT "product_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_contributions" ADD CONSTRAINT "product_contributions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_contributions" ADD CONSTRAINT "product_contributions_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_contributions" ADD CONSTRAINT "product_contributions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
