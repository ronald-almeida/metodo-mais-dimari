import QRCode from 'qrcode';

const PRODUCT_NAME = 'Método MAISDIMARI - PREMIUM PPT';
const PRODUCT_AMOUNT = 49700;
const API_URL = 'https://api.gatewaypayshark.com.br/v1/payment';

const trim = value => typeof value === 'string' ? value.trim() : '';
const nums = value => trim(value).replace(/\D/g, '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = trim(body.name);
    const email = trim(body.email).toLowerCase();
    const taxId = nums(body.taxId);
    let phone = nums(body.phone);

    if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2);

    if (!name || !email || !taxId || !phone) {
      return res.status(400).json({ error: 'Preencha nome, e-mail, CPF/CNPJ e celular.' });
    }

    const key = process.env.PAYSHARK_API_KEY;
    if (!key) return res.status(500).json({ error: 'PAYSHARK_API_KEY não configurada.' });

    const payload = {
      amount: PRODUCT_AMOUNT,
      currency: 'BRL',
      method: 'PIX',
      description: PRODUCT_NAME,
      externalRef: `maisdimari-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payer: { name, taxId, email, phone },
      items: [{ quantity: 1, name: PRODUCT_NAME, price: PRODUCT_AMOUNT, type: 'DIGITAL' }]
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || data?.error || 'Não foi possível gerar o PIX.',
        details: data?.details || data?.errors
      });
    }

    const copypaste = data?.data?.copypaste || data?.copypaste || data?.data?.copyPaste || data?.copyPaste;
    if (!copypaste) return res.status(502).json({ error: 'A PayShark não retornou o código Pix.' });

    const qrCode = await QRCode.toDataURL(copypaste, {
      width: 440,
      margin: 1,
      errorCorrectionLevel: 'M'
    });

    return res.status(200).json({
      id: data?.id || data?.data?.id,
      amount: PRODUCT_AMOUNT,
      status: data?.status || data?.data?.status || 'PENDING',
      copypaste,
      qrCode
    });
  } catch (error) {
    console.error('create-pix error:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar o PIX.' });
  }
}
