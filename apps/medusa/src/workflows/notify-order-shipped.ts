import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";
import { safeLogIdentifier } from "../lib/safe-log";

type NotifyInput = {
  orderId: string;
  trackingNumber: string;
  carrier: string;
};

const logShipmentStep = createStep(
  "log-shipment-notification",
  async (input: NotifyInput) => {
    console.log(
      `[workflow:notify-order-shipped] Order ${safeLogIdentifier(input.orderId)} shipped via ${safeLogIdentifier(input.carrier)}, tracking: ${safeLogIdentifier(input.trackingNumber)}`,
    );
    return new StepResponse({
      orderId: input.orderId,
      notifiedAt: new Date().toISOString(),
    });
  },
);

const notifyOrderShippedWorkflow = createWorkflow(
  "notify-order-shipped",
  (input: NotifyInput) => {
    const result = logShipmentStep(input);
    return new WorkflowResponse(result);
  },
);

export default notifyOrderShippedWorkflow;
