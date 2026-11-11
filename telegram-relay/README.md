# Telegram Relay

Server nusxasi Vercel’ning `telegram-relay-cloud` loyihasi uchun tayyorlangan.

Boshqaruv botiga yozilgan **matnni shaxsiy Telegram akkauntingiz nomidan** oldindan belgilangan boshqa botlarga yuboradigan kichik dastur.

## Muhim

Oddiy Telegram boti boshqa botga yozolmaydi. Shu sabab dasturda ikki ulanish ishlaydi:

- **controller** — siz xabar yozadigan boshqaruv boti;
- **account** — xabarni qolgan botlarga sizning nomingizdan yuboradigan shaxsiy akkaunt sessiyasi.

Dastur faqat shaxsiy akkauntingizdan boshqaruv botiga yozilgan xabarlarni qabul qiladi. Boshqa odamlarning xabarlari e’tiborsiz qoldiriladi.

## 1. Kerakli ma’lumotlar

1. Telegram’dagi tasdiqlangan **@BotFather** orqali yangi boshqaruv boti yarating va uning tokenini oling.
2. Faqat rasmiy **https://my.telegram.org** saytiga kiring.
3. **API development tools** bo‘limidan ilova yarating va `API_ID` hamda `API_HASH` qiymatlarini oling.
4. Xabar yuborilmoqchi bo‘lgan botlarning username’larini tayyorlang.

**Token, API hash, SMS kod, 2FA parol va `.data` ichidagi sessiya fayllarini hech kimga yubormang.**

## 2. Windows’da o‘rnatish

Python 3.11 yoki undan yangi versiya kerak. Terminal/PowerShell’da:

```powershell
cd telegram-relay
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
notepad .env
```

Agar PowerShell virtual muhitni faollashtirishga ruxsat bermasa, keyingi buyruqlarda `.venv\Scripts\python.exe`dan bevosita foydalanishingiz mumkin.

## 3. `.env` faylini to‘ldirish

```dotenv
API_ID=my.telegram.org_dan_olingan_raqam
API_HASH=my.telegram.org_dan_olingan_qiymat
BOT_TOKEN=BotFather_bergan_boshqaruv_bot_tokeni
TARGET_BOTS=@birinci_bot,@ikkinchi_bot,@uchinchi_bot
SEND_DELAY=1
```

`TARGET_BOTS` ichiga xabar borishi kerak bo‘lgan botlarni yozing. Boshqaruv botining o‘zini bu ro‘yxatga qo‘shmang.

## 4. Ishga tushirish

```powershell
python app.py
```

Birinchi marta terminal telefon raqamingizni, Telegram’dan kelgan kodni va 2FA yoqilgan bo‘lsa parolni so‘raydi. Ularni **faqat o‘z kompyuteringizdagi terminalga** kiriting. Keyingi ishga tushirishlarda `.data` sessiyasi ishlatiladi.

Endi Telegram’da yaratgan boshqaruv botingizni oching:

1. `/start` yozing.
2. Istalgan matnni yuboring.
3. Dastur shu matnni shaxsiy akkauntingizdan `TARGET_BOTS` ro‘yxatidagi har bir botga yuboradi.
4. Boshqaruv boti nechta botga yuborilganini bildiradi.

Dastur faqat terminal ochiq va kompyuter internetga ulangan paytda ishlaydi. To‘xtatish uchun `Ctrl+C` bosing. Kompyuterdan mustaqil ishlash uchun quyidagi server variantini sozlang.

## 5. Vercel’da 24/7 server varianti

Server varianti doimiy ochiq sessiya faylini emas, har webhook so‘rovida ishlatiladigan maxfiy `StringSession` qiymatini ishlatadi. Shu sabab `api/index.py` Vercel’ga mos, oldingi `app.py` esa faqat kompyuterda doimiy ishlaydigan variantdir.

### 5.1. Server sessiyasini yaratish

Kompyuterdagi loyiha papkasida:

```powershell
.venv\Scripts\python.exe generate_session.py
```

Telefon raqami, Telegram kodi va 2FA parolni faqat o‘z terminalingizda kiriting. Natijada `.server-session.txt` fayli yaratiladi. Uning ichini **faqat Vercel Environment Variables** bo‘limidagi `TELEGRAM_SESSION` maydoniga ko‘chiring. Bu qiymat akkauntga kirish huquqi beradi; uni suhbatga yoki GitHub’ga yubormang.

### 5.2. Webhook himoya kaliti

PowerShell’da tasodifiy kalit yarating:

```powershell
.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
```

Chiqqan qiymatni `.env` va Vercel’dagi `WEBHOOK_SECRET`ga bir xil kiriting.

### 5.3. Vercel Environment Variables

Production environment uchun quyidagilarni kiriting:

- `API_ID`
- `API_HASH`
- `BOT_TOKEN`
- `TARGET_BOTS`
- `SEND_DELAY`
- `TELEGRAM_SESSION`
- `WEBHOOK_SECRET`

Qiymatlar kiritilgach loyihani qayta deploy qiling. `/api/health` ochilganda `configured: true` ko‘rinishi kerak. Health javobi maxfiy qiymatlarni qaytarmaydi.

### 5.4. Telegram webhook’ni yo‘naltirish

Kompyuterdagi `.env` fayliga Vercel production manzilini yozing:

```dotenv
VERCEL_URL=https://sizning-loyihangiz.vercel.app
```

Keyin:

```powershell
.venv\Scripts\python.exe set_webhook.py
```

Endi kompyuterdagi `app.py` va Task Scheduler vazifasini o‘chirib qo‘ying. Boshqaruv botiga yozilgan yangi xabarlar Vercel’ga keladi va kompyuter o‘chiq bo‘lsa ham qayta ishlanadi.

## Sinov

```bash
python -m unittest -v
```

Sinovlar Telegram’ga ulanmaydi va haqiqiy xabar yubormaydi.
