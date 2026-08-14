import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrieveAccountHolderInput,
  RetrieveAccountHolderOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";

/**
 * Cash on delivery: no external PSP. Authorize at checkout; capture runs when J&T Express reports
 * delivered (see `api/hooks/jnt`). Refunds are operational, not card-network refunds.
 */
export default class CodPaymentProviderService extends AbstractPaymentProvider<Record<string, never>> {
  static identifier = "cod";

  static validateOptions(_options: Record<string, unknown>): void {
    // no secrets required
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "COD initiatePayment: missing session_id on payment session data.",
      );
    }
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "COD initiatePayment: invalid amount.",
      );
    }

    const ctxCurrency = (
      input.context as { currency_code?: string } | undefined
    )?.currency_code?.trim().toLowerCase();
    const currency =
      ctxCurrency && ctxCurrency.length === 3 ? ctxCurrency : "php";

    return {
      id: `cod_${sessionId}`,
      status: PaymentSessionStatus.REQUIRES_MORE,
      data: {
        session_id: sessionId,
        cod: true,
        amount_minor: Math.round(amount),
        currency_code: currency,
        capture_expected_via: "jnt_delivered_webhook",
      },
    };
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: {
        ...((input.data as Record<string, unknown>) ?? {}),
        cod: true,
      },
    };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const prior = (input.data as Record<string, unknown>) ?? {};
    return {
      data: {
        ...prior,
        cod_capture_at: new Date().toISOString(),
        cod_capture_source: "medusa_capture_payment",
        capture_expected_via:
          typeof prior.capture_expected_via === "string"
            ? prior.capture_expected_via
            : "jnt_delivered_webhook",
      },
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data ?? {} };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async getPaymentStatus(
    _input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    return { status: PaymentSessionStatus.AUTHORIZED };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { data: input.data ?? {} };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async createAccountHolder(
    input: CreateAccountHolderInput,
  ): Promise<CreateAccountHolderOutput> {
    return { id: input.context.customer.id };
  }

  async retrieveAccountHolder(
    input: RetrieveAccountHolderInput,
  ): Promise<RetrieveAccountHolderOutput> {
    return { id: input.id };
  }

  async deleteAccountHolder(
    _input: DeleteAccountHolderInput,
  ): Promise<DeleteAccountHolderOutput> {
    return { data: {} };
  }

  async getWebhookActionAndData(
    _payload: {
      data: Record<string, unknown>;
      rawData: string | Buffer;
      headers: Record<string, unknown>;
    },
  ): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED };
  }
}
