/**
 * Catalog of payment gateways offered when adding a gateway. Reference data
 * (not tenant config). `key` is a stable slug persisted on the tenant's gateway
 * row and used to look up a bundled brand logo at /payment-logos/<key>.svg with a
 * themed monogram fallback. Extend freely; the list is intentionally broad.
 */
export type PaymentGatewayCatalogEntry = {
  key: string;
  name: string;
  region: string;
};

export const PAYMENT_GATEWAY_CATALOG: readonly PaymentGatewayCatalogEntry[] = [
  // Global / major
  { key: "stripe", name: "Stripe", region: "Global" },
  { key: "paypal", name: "PayPal", region: "Global" },
  { key: "adyen", name: "Adyen", region: "Global" },
  { key: "braintree", name: "Braintree", region: "Global" },
  { key: "square", name: "Square", region: "Global" },
  { key: "checkout_com", name: "Checkout.com", region: "Global" },
  { key: "worldpay", name: "Worldpay", region: "Global" },
  { key: "amazon_pay", name: "Amazon Pay", region: "Global" },
  { key: "authorize_net", name: "Authorize.Net", region: "Global" },
  { key: "twocheckout", name: "2Checkout (Verifone)", region: "Global" },
  { key: "mollie", name: "Mollie", region: "Europe" },
  { key: "klarna", name: "Klarna", region: "Global" },
  { key: "skrill", name: "Skrill", region: "Global" },
  { key: "neteller", name: "Neteller", region: "Global" },
  { key: "wise", name: "Wise", region: "Global" },
  { key: "airwallex", name: "Airwallex", region: "Global" },
  { key: "paddle", name: "Paddle", region: "Global" },
  { key: "opayo", name: "Opayo", region: "Europe" },
  { key: "gocardless", name: "GoCardless", region: "Global" },
  { key: "revolut", name: "Revolut Business", region: "Global" },
  { key: "payoneer", name: "Payoneer", region: "Global" },
  { key: "google_pay", name: "Google Pay", region: "Global" },
  { key: "apple_pay", name: "Apple Pay", region: "Global" },
  { key: "wepay", name: "WePay", region: "Global" },
  { key: "dwolla", name: "Dwolla", region: "Global" },
  { key: "bluesnap", name: "BlueSnap", region: "Global" },
  { key: "nmi", name: "NMI", region: "Global" },
  { key: "cybersource", name: "Cybersource", region: "Global" },
  { key: "fiserv", name: "Fiserv (First Data)", region: "Global" },
  { key: "global_payments", name: "Global Payments", region: "Global" },
  { key: "elavon", name: "Elavon", region: "Global" },
  { key: "moneris", name: "Moneris", region: "North America" },
  { key: "helcim", name: "Helcim", region: "North America" },
  { key: "paysafe", name: "Paysafe", region: "Global" },
  { key: "rapyd", name: "Rapyd", region: "Global" },
  { key: "nuvei", name: "Nuvei", region: "Global" },
  { key: "verifone", name: "Verifone", region: "Global" },
  { key: "recurly", name: "Recurly", region: "Global" },
  { key: "chargebee", name: "Chargebee", region: "Global" },
  { key: "fastspring", name: "FastSpring", region: "Global" },
  { key: "lemon_squeezy", name: "Lemon Squeezy", region: "Global" },
  { key: "gumroad", name: "Gumroad", region: "Global" },

  // India
  { key: "razorpay", name: "Razorpay", region: "India" },
  { key: "payu", name: "PayU", region: "India" },
  { key: "payumoney", name: "PayUmoney", region: "India" },
  { key: "cashfree", name: "Cashfree", region: "India" },
  { key: "instamojo", name: "Instamojo", region: "India" },
  { key: "ccavenue", name: "CCAvenue", region: "India" },
  { key: "phonepe", name: "PhonePe", region: "India" },
  { key: "paytm", name: "Paytm", region: "India" },
  { key: "billdesk", name: "BillDesk", region: "India" },
  { key: "easebuzz", name: "Easebuzz", region: "India" },
  { key: "juspay", name: "Juspay", region: "India" },
  { key: "atom", name: "Atom", region: "India" },
  { key: "ebs", name: "EBS", region: "India" },
  { key: "mobikwik", name: "MobiKwik", region: "India" },
  { key: "freecharge", name: "FreeCharge", region: "India" },
  { key: "learn_pe", name: "Learn Pe", region: "India" },
  { key: "upi", name: "UPI", region: "India" },

  // South-East Asia / APAC
  { key: "xendit", name: "Xendit", region: "SE Asia" },
  { key: "midtrans", name: "Midtrans", region: "SE Asia" },
  { key: "doku", name: "DOKU", region: "SE Asia" },
  { key: "gopay", name: "GoPay", region: "SE Asia" },
  { key: "dana", name: "DANA", region: "SE Asia" },
  { key: "ovo", name: "OVO", region: "SE Asia" },
  { key: "gcash", name: "GCash", region: "SE Asia" },
  { key: "maya", name: "Maya (PayMaya)", region: "SE Asia" },
  { key: "dragonpay", name: "DragonPay", region: "SE Asia" },
  { key: "twoc2p", name: "2C2P", region: "SE Asia" },
  { key: "omise", name: "Omise", region: "SE Asia" },
  { key: "senangpay", name: "senangPay", region: "SE Asia" },
  { key: "ipay88", name: "iPay88", region: "SE Asia" },
  { key: "razer_merchant", name: "Razer Merchant (MOLPay)", region: "SE Asia" },
  { key: "billplz", name: "Billplz", region: "SE Asia" },
  { key: "hitpay", name: "HitPay", region: "SE Asia" },
  { key: "grabpay", name: "GrabPay", region: "SE Asia" },
  { key: "alipay", name: "Alipay", region: "China" },
  { key: "wechat_pay", name: "WeChat Pay", region: "China" },
  { key: "unionpay", name: "UnionPay", region: "China" },

  // Africa
  { key: "paystack", name: "Paystack", region: "Africa" },
  { key: "flutterwave", name: "Flutterwave", region: "Africa" },
  { key: "dpo", name: "DPO Pay", region: "Africa" },
  { key: "paygate", name: "PayGate", region: "Africa" },
  { key: "mpesa", name: "M-Pesa", region: "Africa" },
  { key: "interswitch", name: "Interswitch", region: "Africa" },
  { key: "remita", name: "Remita", region: "Africa" },
  { key: "cellulant", name: "Cellulant", region: "Africa" },
  { key: "yoco", name: "Yoco", region: "Africa" },
  { key: "peach_payments", name: "Peach Payments", region: "Africa" },
  { key: "ozow", name: "Ozow", region: "Africa" },

  // Latin America
  { key: "mercadopago", name: "Mercado Pago", region: "LatAm" },
  { key: "pagseguro", name: "PagSeguro", region: "LatAm" },
  { key: "dlocal", name: "dLocal", region: "LatAm" },
  { key: "ebanx", name: "EBANX", region: "LatAm" },
  { key: "conekta", name: "Conekta", region: "LatAm" },
  { key: "openpay", name: "Openpay", region: "LatAm" },
  { key: "culqi", name: "Culqi", region: "LatAm" },
  { key: "pagarme", name: "Pagar.me", region: "LatAm" },
  { key: "wompi", name: "Wompi", region: "LatAm" },
  { key: "kushki", name: "Kushki", region: "LatAm" },
  { key: "clip", name: "Clip", region: "LatAm" },

  // MENA
  { key: "paytabs", name: "PayTabs", region: "MENA" },
  { key: "telr", name: "Telr", region: "MENA" },
  { key: "hyperpay", name: "HyperPay", region: "MENA" },
  { key: "tap", name: "Tap Payments", region: "MENA" },
  { key: "moyasar", name: "Moyasar", region: "MENA" },
  { key: "myfatoorah", name: "MyFatoorah", region: "MENA" },
  { key: "network_international", name: "Network International", region: "MENA" },
  { key: "fawry", name: "Fawry", region: "MENA" },
  { key: "paymob", name: "Paymob", region: "MENA" },
  { key: "stc_pay", name: "STC Pay", region: "MENA" },
  { key: "knet", name: "KNET", region: "MENA" },

  // Europe (regional methods)
  { key: "sofort", name: "SOFORT", region: "Europe" },
  { key: "giropay", name: "Giropay", region: "Europe" },
  { key: "ideal", name: "iDEAL", region: "Europe" },
  { key: "bancontact", name: "Bancontact", region: "Europe" },
  { key: "przelewy24", name: "Przelewy24", region: "Europe" },
  { key: "multibanco", name: "Multibanco", region: "Europe" },
  { key: "trustly", name: "Trustly", region: "Europe" },
  { key: "viva_wallet", name: "Viva Wallet", region: "Europe" },
  { key: "mangopay", name: "Mangopay", region: "Europe" },
  { key: "satispay", name: "Satispay", region: "Europe" },
  { key: "sumup", name: "SumUp", region: "Europe" },
  { key: "zettle", name: "Zettle", region: "Europe" },

  // Crypto
  { key: "coinbase_commerce", name: "Coinbase Commerce", region: "Crypto" },
  { key: "bitpay", name: "BitPay", region: "Crypto" },
  { key: "cryptocom_pay", name: "Crypto.com Pay", region: "Crypto" },
  { key: "coinpayments", name: "CoinPayments", region: "Crypto" },
  { key: "nowpayments", name: "NOWPayments", region: "Crypto" },
  { key: "binance_pay", name: "Binance Pay", region: "Crypto" },
  { key: "coingate", name: "CoinGate", region: "Crypto" },
  { key: "opennode", name: "OpenNode", region: "Crypto" },
] as const;

const CATALOG_BY_KEY = new Map(PAYMENT_GATEWAY_CATALOG.map((entry) => [entry.key, entry]));

export function findPaymentGateway(key: string): PaymentGatewayCatalogEntry | undefined {
  return CATALOG_BY_KEY.get(key);
}

export const PAYMENT_GATEWAY_KEYS = PAYMENT_GATEWAY_CATALOG.map((entry) => entry.key);
