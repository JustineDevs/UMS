import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import CodPaymentProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  // AbstractPaymentProvider uses a protected constructor; ModuleProvider typings expect `Constructor<any>`.
  services: [CodPaymentProviderService] as any,
});
