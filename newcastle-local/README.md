# Newcastle School — lokal/server versiyasi

O'quv markazini boshqarish uchun tayyor React frontend va qo'shimcha paketlarsiz Node.js server. Ma'lumotlar serverdagi JSON faylda saqlanadi; Firebase talab qilinmaydi.

## Imkoniyatlar

- **Admin:** foydalanuvchilar, guruhlar, to'lovlar, do'kon va murojaatlar.
- **Yordamchi admin:** o'quvchi va ota-onalar murojaatlari.
- **O'qituvchi:** o'quvchilar, uy vazifalari, baholar, davomat, reyting va support darslari.
- **O'quvchi:** vazifalar, baholar, davomat, to'lovlar, support, coin/do'kon, reyting va chat.
- **Ota-ona:** farzandlarining baholari, davomati, to'lovlari va admin bilan chat.
- O'zbek/ingliz tillari va mobil/desktop ko'rinish.

## Ishga tushirish

**Node.js 18 yoki yangiroq** kerak. Paket o'rnatish shart emas.

```bash
npm start
# yoki
node server.js
```

Brauzerda `http://localhost:3000` oching. Windows uchun `start.bat`, Mac/Linux uchun `./start.sh` ham mavjud.

Boshqa port yoki interfeys:

```bash
PORT=8080 HOST=0.0.0.0 npm start
```

Linux/Mac skripti brauzerni avtomatik ochadi. Server/headless muhitda:

```bash
OPEN_BROWSER=0 ./start.sh
```

## Tekshirish

```bash
npm run check
npm test
```

Server holati: `GET /api/health` → `{"ok":true,"service":"newcastle-school"}`.

## Ma'lumotlar

- Asosiy baza: `data/db.json`.
- Birinchi ishga tushirishda u `data/demo-data.json` dan avtomatik nusxa olinadi.
- Demo ma'lumotni qayta tiklash: serverni to'xtating, `data/db.json` ni o'chiring va serverni qayta ishga tushing.
- `data/db.json` Git'ga qo'shilmaydi, shuning uchun sinov o'zgarishlari demo faylni buzmaydi.
- Login/parollar: [`demo-accounts.md`](demo-accounts.md), masalan `admin / vmTw427CPG`.

## Eslatmalar

- Asosiy sayt, baza va shriftlar internet shart bo'lmagan holda ishlaydi. Faqat matnni tanlab tarjima qilish funksiyasi MyMemory API'dan foydalanadi.
- Bu **demo** versiya. Haqiqiy mijoz ma'lumotlari bilan ishlatishdan oldin foydalanuvchi sessiyasi va huquqlarni serverda tekshirish, parollarni xeshlash va zaxira nusxa sozlash zarur.

## Vercel + Supabase ga joylash

Loyiha Vercel serverless API va Supabase Postgres bilan ishlaydigan konfiguratsiyaga ega:

- `api/db.js` — frontendning `/api/db` so'rovlarini bajaradi.
- `api/health.js` — server va Supabase ulanishini tekshiradi.
- `lib/supabase-store.js` — doimiy bazaga o'qish/yozish va birinchi demo import.
- `supabase/migrations/` — jadval va RLS xavfsizlik sozlamasi.
- `vercel.json` — statik frontend, SPA marshrutlari va serverless funksiyalar.

Vercel project root: `newcastle-local`, output directory: `public`. Build va package install talab qilinmaydi.

Vercel loyihasiga quyidagi environment variable'larni `production`, `preview` va `development` uchun qo'shing:

```text
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=SERVER_SIDE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` ni frontend kodiga yoki Git'ga qo'ymang. `.env.example` faqat namuna. Birinchi `/api/db` so'rovida `data/demo-data.json` Supabase ga avtomatik ko‘chadi; keyingi o'zgarishlar Postgres'da doimiy saqlanadi.
