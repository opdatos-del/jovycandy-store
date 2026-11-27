"use client"

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js/pure"
import { useRef, useState, type FormEvent } from "react"

import type { Locale } from "@/lib/i18n"
import type { CheckoutPayment } from "@/lib/medusa/store"

type Props = {
  payment: Extract<CheckoutPayment, { kind: "stripe" }>
  locale: Locale
  total: string
  email: string
  beforeConfirm: () => Promise<void>
  verifyOrder: () => Promise<void>
  onBusy: (busy: boolean) => void
}

const buttonClass = "min-h-12 rounded-full bg-[#0d3b6e] px-6 text-sm font-black text-white disabled:opacity-50"

export function StripePaymentForm(props: Props) {
  const [stripe] = useState(() => loadStripe(props.payment.publishableKey))
  return (
    <Elements stripe={stripe} options={{
      clientSecret: props.payment.clientSecret,
      locale: props.locale,
      appearance: { variables: { colorPrimary: "#0d3b6e", borderRadius: "8px" } },
    }}>
      <PaymentForm {...props} />
    </Elements>
  )
}

function PaymentForm({ locale, total, email, beforeConfirm, verifyOrder, onBusy }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const spanish = locale === "es"
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [verifyOnly, setVerifyOnly] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || (!verifyOnly && (!stripe || !elements || !ready))) return
    inFlight.current = true
    setBusy(true)
    onBusy(true)
    setError("")
    let verifying = verifyOnly
    try {
      if (!verifying && stripe && elements) {
        await beforeConfirm()
        // No desmontar PaymentElement mientras Stripe confirma: el elemento
        // debe seguir montado hasta que confirmPayment resuelva.
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: new URL(`/${locale}/checkout/retorno`, window.location.origin).href },
          redirect: "if_required",
        })
        if (error && ["card_error", "validation_error", "integration_error"].includes(error.type)) {
          verifying = false
          setError(error.message ?? (spanish ? "Revisa los datos del pago." : "Check the payment details."))
          return
        }
        if (paymentIntent?.status === "requires_payment_method") {
          verifying = false
          setError(spanish ? "Pago rechazado. Usa otra tarjeta." : "Payment declined. Try another card.")
          return
        }
        verifying = true
      }
      await verifyOrder()
    } catch {
      // Si la confirmación quedó incierta, se retira el formulario para no
      // enviar un segundo cobro; la consulta de estado es la vía de salida.
      if (verifying) setVerifyOnly(true)
      setError(verifying
        ? (spanish ? "El pedido todavía no está confirmado. Consulta su estado antes de volver a pagar." : "Your order is not confirmed yet. Check its status before paying again.")
        : (spanish ? "No se pudo verificar el total. Vuelve al resumen antes de pagar." : "We couldn't verify the total. Return to the summary before paying."))
    } finally {
      inFlight.current = false
      setBusy(false)
      onBusy(false)
    }
  }

  return (
    <form aria-label={spanish ? "Pago seguro con Stripe" : "Secure Stripe payment"}
      method="post" onSubmit={submit} className="grid gap-4" aria-busy={busy}>
      {!verifyOnly ? (
        <PaymentElement options={{ defaultValues: { billingDetails: { email } } }} onReady={() => setReady(true)} onLoadError={() => {
          setError(spanish ? "No se pudo cargar Stripe. Recarga la página e intenta de nuevo." : "Stripe could not load. Reload the page and try again.")
        }} />
      ) : null}
      <p aria-live="polite" className="text-sm text-red-700">{error}</p>
      <button type="submit" className={buttonClass} disabled={busy || (!verifyOnly && (!ready || !stripe))}>
        {busy ? (spanish ? "Verificando…" : "Checking…") : verifyOnly
          ? (spanish ? "Consultar estado del pedido" : "Check order status")
          : (spanish ? `Pagar ${total}` : `Pay ${total}`)}
      </button>
    </form>
  )
}
