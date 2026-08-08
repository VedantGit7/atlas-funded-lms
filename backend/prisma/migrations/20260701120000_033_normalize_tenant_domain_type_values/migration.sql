-- Align legacy provisioned domain type strings with API contract enums.

UPDATE tenant_domains
SET type = 'ATLAS_SUBDOMAIN'
WHERE lower(type) = 'atlas_subdomain';

UPDATE tenant_domains
SET type = 'CUSTOM_DOMAIN'
WHERE lower(type) = 'custom_domain';
