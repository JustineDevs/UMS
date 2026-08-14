import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import StripeCheckoutPaymentProviderService from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [StripeCheckoutPaymentProviderService],
});
