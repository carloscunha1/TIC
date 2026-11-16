ALTER TABLE "loyalty_movements" ADD COLUMN "reversal_of_credit_id" UUID;
CREATE INDEX "loyalty_movements_reversal_of_credit_id_idx" ON "loyalty_movements"("reversal_of_credit_id");
ALTER TABLE "loyalty_movements" ADD CONSTRAINT "loyalty_movements_reversal_of_credit_id_fkey"
    FOREIGN KEY ("reversal_of_credit_id") REFERENCES "loyalty_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "validate_loyalty_allocation_type"() RETURNS trigger AS $$
DECLARE movement_type "LoyaltyMovementType";
BEGIN
    SELECT "type" INTO movement_type
    FROM "loyalty_movements"
    WHERE "id" = NEW."movement_id" AND "customer_id" = NEW."customer_id";
    IF movement_type IS NULL THEN
        RAISE EXCEPTION 'Loyalty allocation movement/customer mismatch';
    END IF;
    IF (NEW."type" = 'CONSUME' AND movement_type NOT IN ('REDEMPTION', 'EXPIRATION'))
       OR (NEW."type" IN ('RESTORE', 'REVERSE') AND movement_type <> 'REVERSAL')
       OR (NEW."type" = 'COMPENSATE' AND movement_type <> 'COMPENSATION') THEN
        RAISE EXCEPTION 'Loyalty allocation type does not match its movement';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "loyalty_allocations_validate_type"
    BEFORE INSERT ON "loyalty_allocations"
    FOR EACH ROW EXECUTE FUNCTION "validate_loyalty_allocation_type"();
