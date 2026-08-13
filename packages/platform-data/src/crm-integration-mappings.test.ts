import assert from "node:assert/strict";
import test from "node:test";
import {
  CRM_SYSTEM_CHECKLIST,
  NANGO_CRM_SUPPORTED_APPS,
  buildCrmFeatureCoverageMetadata,
  buildNangoCrmConnectionMetadata,
  buildNangoCrmConnectionTags,
  buildNangoCrmRecordMetadata,
  buildNangoCustomerFeatureMappingMetadata,
} from "./crm-integration-mappings.js";

test("buildNangoCustomerFeatureMappingMetadata anchors customer identity for mapping", () => {
  const meta = buildNangoCustomerFeatureMappingMetadata({
    customerEmail: "TraderGOfficial@gmail.com",
    medusaCustomerId: "cus_123",
    displayName: "Trader G",
    phone: "+63 912 345 6789",
    source: "crm",
  });

  assert.equal(meta.system_of_record, "medusa");
  assert.equal(meta.external_system, "nango");
  assert.equal(meta.provider, "nango");
  assert.equal(meta.customer_email, "tradergofficial@gmail.com");
  assert.equal(meta.medusa_customer_id, "cus_123");
  assert.ok(Array.isArray(meta.mapped_fields));
  assert.ok(meta.capabilities);
});

test("buildNangoCrmConnectionTags includes staff and organization attribution", () => {
  const tags = buildNangoCrmConnectionTags({
    endUserId: "staff_123",
    endUserEmail: "Owner@Store.com",
    organizationId: "org_456",
    branchId: "manila",
    staffUserId: "staff_789",
    staffEmail: "Manager@Store.com",
  });

  assert.equal(tags.end_user_id, "staff_123");
  assert.equal(tags.end_user_email, "owner@store.com");
  assert.equal(tags.organization_id, "org_456");
  assert.equal(tags.branch_id, "manila");
  assert.equal(tags.staff_user_id, "staff_789");
  assert.equal(tags.staff_email, "manager@store.com");
});

test("buildNangoCrmConnectionMetadata defaults to a global contact and deal bridge", () => {
  const meta = buildNangoCrmConnectionMetadata({
    providerConfigKey: "hubspot",
    organizationId: "org_456",
  });

  assert.equal(meta.provider_config_key, "hubspot");
  assert.equal(meta.sync_scope, "global");
  assert.deepEqual(meta.enabled_entities, ["contact", "deal"]);
  assert.ok(meta.field_mappings);
  assert.ok(meta.feature_flags);
  assert.deepEqual(meta.crm_feature_coverage, buildCrmFeatureCoverageMetadata());
  assert.equal(Array.isArray(meta.crm_supported_apps), true);
});

test("buildNangoCrmRecordMetadata captures contact and deal sync rows", () => {
  const meta = buildNangoCrmRecordMetadata({
    providerConfigKey: "salesforce",
    connectionId: "conn_123",
    localEntityType: "deal",
    localRecordId: "deal_456",
    externalRecordId: "opp_789",
    syncState: "synced",
    syncMode: "automatic",
    staffEmail: "Agent@Store.com",
  });

  assert.equal(meta.provider_config_key, "salesforce");
  assert.equal(meta.connection_id, "conn_123");
  assert.equal(meta.entity_type, "deal");
  assert.equal(meta.external_record_id, "opp_789");
  assert.equal(meta.sync_state, "synced");
  assert.equal(meta.staff_email, "agent@store.com");
});

test("NANGO_CRM_SUPPORTED_APPS includes the common CRM targets", () => {
  const labels = NANGO_CRM_SUPPORTED_APPS.map((app) => app.label);
  assert.ok(labels.includes("HubSpot"));
  assert.ok(labels.includes("Salesforce"));
  assert.ok(labels.includes("Pipedrive"));
});

test("CRM_SYSTEM_CHECKLIST mirrors the CRM checklist the admin surfaces", () => {
  const keys = CRM_SYSTEM_CHECKLIST.map((group) => group.key);
  assert.ok(keys.includes("contact_and_data_management"));
  assert.ok(keys.includes("lead_and_pipeline"));
  assert.ok(keys.includes("communication_and_activity"));
  assert.ok(keys.includes("automation_and_efficiency"));
  assert.ok(keys.includes("reporting_and_analytics"));
  assert.ok(keys.includes("administration_and_technical_fit"));
});
