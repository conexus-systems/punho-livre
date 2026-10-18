# CONEXUS Platform — Webhook Event Contracts

Source of truth: `agents/platform/SHARED_CONTEXT.md` and the auth/payments design spec.

## Envelope

Every outbound webhook body is a JSON object:

```json
{
  "id": "evt_<uuid>",
  "type": "<event.type>",
  "created_at": "2026-09-05T18:00:00Z",
  "data": {}
}
```

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Idempotency key; format `evt_<uuid>` |
| `type` | string | Event name (see below) |
| `created_at` | string | ISO-8601 UTC |
| `data` | object | Event-specific payload |

## Signature

- Header: `X-Conexus-Signature: sha256=<hmac_hex>`
- Algorithm: HMAC-SHA256 over the **raw request body** (UTF-8 bytes)
- Secret: per-client webhook secret (`CONEXUS_WEBHOOK_SECRET` on consumers)
- Verify with `Conexus::Webhooks.verify!(body_string, signature_header, secret)`

Retry schedule (publisher): Sidekiq 1m / 5m / 30m / 2h. Consumers must key on `id`.

## Event types

### Auth → apps

| Type | When |
|------|------|
| `user.created` | New Identity provisioned |
| `user.updated` | Profile fields changed |
| `user.deleted` | LGPD anonymize / account removal |
| `user.linked_provider` | Identity linked to a provider (e.g. Google, Gov.br) |

Canonical IDs in `data`: `conexus_user_id` (UUID).

### Site → Payments

| Type | When |
|------|------|
| `product.upsert` | Catalog product created/updated |
| `plan.upsert` | Catalog plan created/updated |
| `promotion.upsert` | Catalog promotion created/updated |

Canonical IDs: `product_slug`, `plan_id` (UUID mirroring CatalogPlan).

### Payments → apps

| Type | When |
|------|------|
| `subscription.activated` | Subscription becomes active |
| `subscription.renewed` | Period renewed |
| `subscription.past_due` | Payment failed / past due |
| `subscription.canceled` | Subscription canceled |
| `entitlement.changed` | Entitlement status/plan/expiry changed |
| `payment.completed` | One-shot (`interval: once`) payment approved |

Canonical IDs: `conexus_user_id`, `subscription_id`, `product_slug`, `plan_id`.

#### `payment.completed`

Emitted when a one-shot checkout payment is approved (not for subscription renewals). Consumers should key on `id` and may use `provider_payment_id` for provider-level idempotency.

| Field | Type | Notes |
|-------|------|--------|
| `conexus_user_id` | string (UUID) | Buyer identity |
| `product_slug` | string | Catalog product (e.g. `aba-find`) |
| `plan_id` | string (UUID) | Catalog plan id |
| `plan_slug` | string | Catalog plan slug (e.g. `lead_unlock`) |
| `provider` | string | e.g. `mercadopago`, `stripe` |
| `provider_payment_id` | string | Provider payment / charge id |
| `amount_cents` | integer | Amount in minor units |
| `currency` | string | ISO currency (e.g. `BRL`) |
| `metadata` | object | Echo of checkout `metadata` (purpose, resource_type, resource_id, …) |

## Examples

See `docs/examples/`:

- `user.created.json`
- `plan.upsert.json`
- `subscription.activated.json`
- `entitlement.changed.json`
- `payment.completed.json`
