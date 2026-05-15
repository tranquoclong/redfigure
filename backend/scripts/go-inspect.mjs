const TOKEN = process.env.GOSHIP_TOKEN;
if (!TOKEN) {
  console.error(
    'Defina GOSHIP_TOKEN no env. Ex: GOSHIP_TOKEN="eyJ0..." node ...',
  );
  process.exit(1);
}

const isProd = process.argv.includes('--prod');
const BASE = isProd
  ? 'https://api.goship.io/api/v2'
  : 'https://sandbox.goship.io/api/v2';

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

const MASK_PII = !process.argv.includes('--raw');
const PII_KEYS = new Set(['document', 'email', 'phone', 'address']);

function redact(obj) {
  if (!MASK_PII) return obj;
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (PII_KEYS.has(key) && value && typeof value === 'string') {
        if (value.length <= 4) return '***';
        return `${value.slice(0, 2)}***${value.slice(-2)}`;
      }
      return value;
    }),
  );
}

async function call(name, method, path, body) {
  const url = `${BASE}${path}`;
  console.log(`\n━━━ ${name} — ${method} ${path} ━━━`);
  try {
    const res = await fetch(url, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    console.log(`Status: ${res.status}`);
    console.log(JSON.stringify(redact(parsed), null, 2));
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (err) {
    console.error(`ERRO: ${err.message}`);
    return { ok: false, status: 0, body: null };
  }
}

async function main() {
  console.log(`🎯 Base URL: ${BASE}\n`);

  const me = await call('1. GET /profile', 'GET', '/profile');

  if (me.ok && me.body) {
    const userData = me.body.data;

    console.log('\n\n━━━ 2. POST /shipments (Tạo đơn hàng nháp) ━━━');

    const body = {
      shipment: {
        rate: 1,
        address_from: {
          name: userData.name || 'Kho hàng VN',
          phone: '0901234567',
          street: '123 Đường ABC',
          province: 'Thành phố Hồ Chí Minh',
          district: 'Quận 1',
        },
        address_to: {
          name: 'Nguyễn Văn A',
          phone: '0987654321',
          street: '456 Đường XYZ',
          province: 'Hà Nội',
          district: 'Quận Hoàn Kiếm',
        },
        parcel: {
          cod: 500000,
          weight: 300,
          width: 11,
          height: 5,
          length: 16,
          description: 'Mô hình Test',
          item_value: 500000,
        },
      },
    };

    console.log('Payload gửi đi (Goship format):');
    console.log(JSON.stringify(redact(body), null, 2));

    const shipRes = await call('create-shipment', 'POST', '/shipments', body);

    if (shipRes.ok && shipRes.body?.data?.id) {
      console.log(`\n🧹 Cleanup: ${shipRes.body.data.id}...`);
      await call(
        'cleanup-delete',
        'DELETE',
        `/shipments/${shipRes.body.data.id}`,
      );
    }
  }

  console.log('\n━━━ FIM ━━━');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
