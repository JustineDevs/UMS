try {
  const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core");
  MetadataStorage.clear();
} catch (error) {
  // Legacy Medusa test harness hook. Some workspace installs do not expose this
  // internal path, and the unit tests do not require a global MetadataStorage reset.
}
