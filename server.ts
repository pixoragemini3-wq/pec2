import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import { Resend } from "resend";

const __filename = fileURLToPath(import.meta.url);

let stripe: Stripe | null = null;
let resend: Resend | null = null;

const getStripe = (): Stripe => {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is required for payments");
    }
    stripe = new Stripe(key, {
      apiVersion: "2025-01-27.acacia" as any,
    });
  }
  return stripe;
};

const getResend = (): Resend | null => {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Stripe Checkout API
  app.post("/api/create-checkout-session", async (req: Request, res: Response) => {
    try {
      const { items, customerEmail, orderId } = req.body;
      
      const session = await getStripe().checkout.sessions.create({
        payment_method_types: ["card", "revolut_pay"],
        line_items: items.map((item: any) => ({
          price_data: {
            currency: "eur",
            product_data: {
              name: item.name,
              description: item.description || "",
            },
            unit_amount: Math.round(item.price * 100), // Stripe expects cents
          },
          quantity: item.quantity,
        })),
        mode: "payment",
        customer_email: customerEmail || undefined,
        success_url: `${req.headers.origin}/?payment=success&orderId=${orderId}`,
        cancel_url: `${req.headers.origin}/?payment=cancel&orderId=${orderId}`,
        metadata: {
          orderId: orderId,
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Notification API
  app.post("/api/notify-order", async (req: Request, res: Response) => {
    try {
      const { order, items } = req.body;
      console.log("Notification request received for order:", order?.orderNumber);

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_RIDER_CHAT_ID;

      // Robust extraction of info
      const firstName = order.firstName || order.customerInfo?.firstName || "Cliente";
      const lastName = order.lastName || order.customerInfo?.lastName || "";
      const phone = order.phone || order.customerInfo?.phone || "N/D";
      const address = order.address || order.customerInfo?.address || "N/D";
      const email = order.email || order.customerInfo?.email || "";
      const price = Number(order.totalPrice || 0).toFixed(2);

      // 1. Telegram Notification
      if (botToken && chatId) {
        try {
          const message = `🍔 NUOVO ORDINE: ${order.orderNumber}\n👤 Cliente: ${firstName} ${lastName}\n📞 Tel: ${phone}\n📍 Tipo: ${order.deliveryType === "delivery" ? "CONSEGNA" : "RITIRO"}\n⏰ Orario: ${order.scheduledTime}\n💰 Totale: €${price}\n💳 Pagamento: ${order.paymentMethod === "card" ? "CARTA (Stripe)" : "CONTANTI"}\n🧾 Stato Pagamento: ${order.paymentStatus}\n\n🛒 PRODOTTI:\n${(items || []).map((it: any) => `- ${it.quantity}x ${it.productName}`).join("\n")}\n\n${order.deliveryType === "delivery" ? `🏠 Indirizzo: ${address}` : ""}\n${order.notes ? `📝 Note: ${order.notes}` : ""}`;

          const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
            }),
          });
          
          if (!tgResponse.ok) {
            const errorData = await tgResponse.json();
            console.error("Telegram API Error Response:", errorData);
          } else {
            console.log("Telegram message sent successfully for order", order.orderNumber);
          }
        } catch (tgErr) {
          console.error("Telegram fetch exception:", tgErr);
        }
      }

      // 2. Email Notification (Resend)
      const resendClient = getResend();
      if (resendClient && email) {
        await resendClient.emails.send({
          from: 'Pane & Caffè <ordini@pane-caffe.it>',
          to: email,
          subject: `Conferma Ordine ${order.orderNumber} - Pane & Caffè`,
          html: `
            <h1>Grazie per il tuo ordine!</h1>
            <p>Ciao ${firstName}, il tuo ordine <strong>${order.orderNumber}</strong> è stato ricevuto.</p>
            <p><strong>Dettagli:</strong></p>
            <ul>
              <li>Tipo: ${order.deliveryType}</li>
              <li>Orario: ${order.scheduledTime}</li>
              <li>Totale: €${Number(order.totalPrice || 0).toFixed(2)}</li>
            </ul>
            <p>Ti aspettiamo!</p>
          `,
        }).catch(err => console.error("Email error:", err));
      }

      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Notification Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_RIDER_CHAT_ID),
      stripe: !!process.env.STRIPE_SECRET_KEY,
      resend: !!process.env.RESEND_API_KEY
    });
  });

  // Test Telegram API
  app.get("/api/test-telegram", async (_req: Request, res: Response) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_RIDER_CHAT_ID;
    
    if (!botToken || !chatId) {
      return res.status(400).json({ error: "Configurazione mancante" });
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🔔 Test notifica Pane & Caffè funzionante!",
        }),
      });
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
