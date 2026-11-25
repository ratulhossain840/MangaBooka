<!-- FILE: DEPLOY.md | PATH: DEPLOY.md (রিপোর মূল ফোল্ডারে) -->

# চালু করার ধাপ (প্রথমবার)

সবকিছু ফোনের ব্রাউজার থেকেই করা যায়। মোট ধাপ ৬টি। প্রতিটি শেষে "✔ ঠিক আছে কিনা" দেখুন।

## ১. Firebase প্রজেক্ট
1. console.firebase.google.com → **Add project** (নাম: mangabooka)। Google Analytics বন্ধ রাখতে পারেন।
2. **Build → Firestore Database → Create database** → লোকেশন **asia-southeast1 (Singapore)** → Production mode।
3. Firestore এর **Rules** ট্যাবে `firestore.rules` ফাইলের লেখা বসিয়ে **Publish** করুন (ব্রাউজার থেকে সরাসরি ডাটাবেস বন্ধ থাকবে; সার্ভার নিজে ঢোকে)।
4. **Build → Authentication → Get started → Sign-in method → Email/Password** চালু করুন।
5. **Project settings (গিয়ার আইকন) → General → Your apps → Web (</>)** অ্যাপ যোগ করুন। যে `firebaseConfig` দেখাবে তার `apiKey`, `authDomain`, `projectId`, `appId` কপি রাখুন।
6. **Project settings → Service accounts → Generate new private key** → JSON ফাইল নামবে। ফাইলটি খুলে পুরো লেখা কপি করুন (এটাই `FIREBASE_SERVICE_ACCOUNT`)। **এই ফাইল কখনো GitHub বা কাউকে দেবেন না।**

## ২. অ্যাডমিন অ্যাকাউন্ট
1. Authentication → **Users → Add user**: আপনার ইমেইল ও শক্ত পাসওয়ার্ড।
2. তালিকায় ইউজারের **User UID** কপি করুন (এটাই `ADMIN_UIDS`)। একাধিক অ্যাডমিন হলে কমা দিয়ে।
   - UID না পেলে ধাপ ৫ এর পর `/admin` এ লগইন করুন; অনুমতি না থাকলে পর্দায় আপনার UID দেখাবে।

## ৩. imgbb ও Gemini
- imgbb: imgbb.com এ অ্যাকাউন্ট → **API** পেজ থেকে চাবি কপি (`IMGBB_KEY`)।
- Gemini (অনুবাদের জন্য, ঐচ্ছিক): aistudio.google.com → **Get API key**। আলাদা Gmail/প্রজেক্টের ৩টি পর্যন্ত চাবি কমা দিয়ে (`GEMINI_KEYS`)।

## ৪. Render এ সার্ভিস
**পদ্ধতি ক (সহজ):** render.com → **New → Blueprint** → GitHub রিপো বাছুন। `render.yaml` পড়ে সার্ভিস বানাবে।
**পদ্ধতি খ (হাতে):** **New → Web Service** → রিপো বাছুন, তারপর:
- Region: **Singapore**, Plan: **Free**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Environment এ `NODE_VERSION` = `20`

তারপর **Environment** পেজে নিচের মানগুলো বসান (নাম হুবহু):

| নাম | মান |
|---|---|
| `SITE_URL` | `https://আপনার-সার্ভিস.onrender.com` (শেষে `/` নয়) |
| `FIREBASE_SERVICE_ACCOUNT` | ধাপ ১.৬ এর JSON, পুরোটা পেস্ট |
| `ADMIN_UIDS` | ধাপ ২ এর UID |
| `IMGBB_KEY` | imgbb চাবি |
| `GEMINI_KEYS`, `GEMINI_MODEL` | ঐচ্ছিক |
| `PAY_BKASH`, `PAY_NAGAD` | আপনার নম্বর (`01XXXXXXXXX`) |
| `PAY_NOTE_BD` | যেমন: "Send Money করুন" (ঐচ্ছিক) |
| `USDT_BEP20_ADDRESS`, `USDT_ERC20_ADDRESS` | `0x…` ঠিকানা (৪২ অক্ষর) |
| `PAY_NOTE_INT` | ঐচ্ছিক |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | ধাপ ১.৫ এর মান |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_VAPID_KEY` | ঐচ্ছিক (পুশ নোটিফিকেশন) |

> `VITE_` দিয়ে শুরু মানগুলো পাবলিক (গোপন নয়) এবং **বদলালে আবার ডিপ্লয় করতে হয়**, কারণ বিল্ডের সময় ঢোকে।

**Save** করলে ডিপ্লয় শুরু হবে (৩–৬ মিনিট)। Logs এ "[routes] চালু: …" ও পরিবেশ রিপোর্ট দেখবেন।

## ৫. Firebase কে সাইটের ঠিকানা জানানো
Firebase → Authentication → **Settings → Authorized domains → Add domain**: `আপনার-সার্ভিস.onrender.com` (ও নিজের ডোমেইন থাকলে সেটাও)। না দিলে লগইন কাজ করবে না।

## ৬. প্রথম পরীক্ষা
1. `আপনার-সাইট/api/health` → `{"ok":true…}` দেখাবে। `/api/health/db` → `"database":"connected"`।
2. `আপনার-সাইট/admin` → লগইন → ড্যাশবোর্ডের **"সেটআপ পরীক্ষা"** তে সব ✔ কিনা দেখুন; ⚠/✖ এর নামের সেটিং Render এ ঠিক করুন।
3. এরপর `TESTING.md` ধরে পরীক্ষা করুন।

## আইকন (একবার আপলোড)
`client/public/icons/` এ PNG ফাইল দিন: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180×180), `favicon.png`, `og-image.png` (1200×630), `admin-192.png`, `admin-512.png`। না থাকলে সাইট চলে, শুধু ইনস্টল-আইকন ও শেয়ার-ছবি ফাঁকা দেখায়।

## Render Free এর কথা
- ১৫ মিনিট কেউ না এলে সার্ভার ঘুমায়; প্রথম খোলায় ৩০–৫০ সেকেন্ড লাগতে পারে। UptimeRobot (ফ্রি) দিয়ে প্রতি ৫ মিনিটে `/api/health` এ পিং করলে জেগে থাকে।
- অনুবাদের কাজ ঘুমের সময় থামে; জেগে উঠলে নিজে আবার শুরু হয়।

## আপডেট দেওয়া
GitHub এ ফাইল বদলে Commit করলেই Render নিজে আবার ডিপ্লয় করে। ডিপ্লয় ব্যর্থ হলে Render → Logs এর লাল লেখা পাঠালে ঠিক করা যায়।

## ডেমো ডাটা
Render এ `SEED_DEMO=1` দিলে চালুর সময় নমুনা বই বসে; আসল বই দেওয়ার আগে `SEED_DEMO=remove` দিয়ে ডিপ্লয় করে ভ্যারিয়েবলটি মুছে দিন (অথবা অ্যাডমিন → সেটিংস → "ডেমো মুছুন")।

## Firestore Index
এখন কোনো কম্পোজিট ইনডেক্স লাগে না (`firestore.indexes.json` ফাঁকা)। ভবিষ্যতে কনসোলে "index required" ত্রুটি এলে ত্রুটির লিংক চাপলে Firebase নিজে বানিয়ে দেয়।
