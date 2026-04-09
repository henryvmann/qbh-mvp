-- Add fhir_base_url and org_name to portal_connections
-- to support dynamic multi-organization Epic FHIR integration.

ALTER TABLE portal_connections ADD COLUMN IF NOT EXISTS fhir_base_url text;
ALTER TABLE portal_connections ADD COLUMN IF NOT EXISTS org_name text;

-- Backfill existing Stamford Health connections
UPDATE portal_connections
SET fhir_base_url = 'https://epicproxy.et1378.epichosted.com/APIProxyPRD/api/FHIR/R4',
    org_name = 'Stamford Health'
WHERE portal_tenant IN ('stamford', 'stamford_health')
  AND fhir_base_url IS NULL;

-- Backfill existing sandbox connections
UPDATE portal_connections
SET fhir_base_url = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    org_name = 'Epic Sandbox'
WHERE portal_brand = 'epic_mychart'
  AND (portal_tenant IS NULL OR portal_tenant NOT IN ('stamford', 'stamford_health'))
  AND fhir_base_url IS NULL;
