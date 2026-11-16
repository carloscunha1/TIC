ALTER TYPE "CustomerStatus" ADD VALUE 'INACTIVE';
ALTER TABLE "customers" ADD COLUMN "previous_status" "CustomerStatus";
