<!-- FILE: README.md | PATH: README.md (রিপোর মূল ফোল্ডারে) -->

# MangaBooka

ই-বুক ও মাঙ্গা বিক্রির সাইট (বাংলাদেশ, জাপান, চীন, সিঙ্গাপুর, মালয়েশিয়া, চিলি)।

- ফ্রন্টএন্ড: React + Vite (PWA), ক্রেতার অ্যাপ ও `/admin` অ্যাডমিন অ্যাপ
- ব্যাকএন্ড: Node/Express, একই সার্ভিস API ও ফ্রন্টএন্ড দেয়
- ডাটা: Firebase Firestore + Auth; ছবি: imgbb; অনুবাদ: Gemini
- হোস্টিং: Render (Free)

| ফাইল | কী আছে |
|---|---|
| `DEPLOY.md` | প্রথমবার চালু করার ধাপ (ফোন থেকেই) |
| `TESTING.md` | চালুর পর পরীক্ষার তালিকা |
| `PROJECT_START.md` | প্রজেক্টের নকশা ও ব্যাচের অবস্থা |
| `.env.example` | সব গোপন সেটিংসের নাম |
| `render.yaml` | Render Blueprint |
| `firestore.rules` | ডাটাবেসের নিরাপত্তা (ব্রাউজার থেকে সরাসরি বন্ধ) |

লোকালে চালাতে: `npm install`, `.env` বানান (`.env.example` থেকে), `npm run dev:server` ও আলাদা টার্মিনালে `npm run dev:client`।
