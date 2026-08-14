import {
  createStep,
  createWorkflow,
  WorkflowResponse,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";

type NotifyInput = {
  orderId: string;
  trackingNumber: string;
  carrier: string;
};

const logShipmentStep = createStep(
  "log-shipment-notification",
  async (input: NotifyInput) => {
    console.log(
      `[workflow:notify-order-shipped] Order ${input.orderId} shipped via ${input.carrier}, tracking: ${input.trackingNumber}`,
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
