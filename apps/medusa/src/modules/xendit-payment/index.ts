import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import XenditPaymentProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [XenditPaymentProviderService],
});
