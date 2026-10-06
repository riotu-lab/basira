<div dir="rtl">

<p align="center"><img src="docs/assets/basira-logo.png" width="320" alt="شعار بصيرة"></p>
<p align="center"><strong>العربية</strong> · <a href="README.en.md">English README</a></p>

# بصيرة

منصة للتدريب على الحوار ومراجعة المحتوى قبل النشر، طوّرها فريق **RIOTU Lab من جامعة الأمير سلطان، الرياض**. تدعم العربية والإنجليزية، مع شخصية صوتية ومرئية، وملاحظات مرتبطة بالمراجع، وإعادة تدريب موجّهة.

[جرّب المنصة](https://basiraapp.vercel.app) · [شاهد العرض المسجّل](https://www.youtube.com/watch?v=dRobDNQ9dP0) · [دليل الإعداد](docs/SETUP.md) · [حالة التنفيذ](docs/STATUS.md)

## دليل سريع للمشروع

<div dir="ltr">

```text
basira/
├── src/             واجهة المستخدم والتفاعل داخل المتصفح
├── server/          الخادم وتكاملات الذكاء الاصطناعي والتقييم
├── api/             نقاط دخول الخادم على Vercel
├── data/            المراجع وبنك الأسئلة والأجوبة وتراخيص البيانات
├── public/          أصول الواجهة والهوية البصرية
├── tests/           الاختبارات الآلية واختبارات المتصفح
├── scripts/         أدوات الإعداد والفحص وتجهيز البيانات
├── services/        خدمة استرجاع Python اختيارية
├── docker/          Local container setup / إعداد الحاويات المحلية
├── compose.yaml     Local app + retrieval / التطبيق والاسترجاع محليًا
├── docs/            أدلة التشغيل والبنية ونتائج التحقق
├── .env.example     قالب إعداد فارغ؛ لا يحتوي على مفاتيح فعلية
├── package.json     الاعتماديات وأوامر التشغيل والبناء والاختبار
└── vercel.json      إعدادات الاستضافة
```

</div>

## إلى لجنة التحكيم

**لتجربة المنصة المجهّزة، افتحوا [الرابط المباشر](https://basiraapp.vercel.app) دون تثبيت أو إضافة مفاتيح شخصية.** تخضع التجربة لرصيد خدمات الفريق وحدود الجلسات المتزامنة.

**لتشغيل المشروع محليًا، يجب على لجنة التحكيم وضع مفاتيح API الخاصة بها وتهيئة حسابات الخدمات المطلوبة.** المستودع لا يتضمن مفاتيح الفريق أو اشتراكاته. تتوفر قاعدة الاسترجاع كتنزيل منفصل بالإصدار المرتبط أدناه، ولا تُحفظ داخل تاريخ Git. **مفتاح OpenAI وحده لا يشغّل الشخصية المرئية أو مسار استرجاع المراجع كاملًا.**

التشغيل المحلي يستخدم خادمًا محليًا مستقلًا؛ لا يتصل تلقائيًا بخادم الإنتاج ولا يستهلك رصيد الفريق. تغيير متغير البيئة إلى «production» لا يربطه بالنسخة المنشورة.

## تشغيل محلي اختياري عبر Docker

يشغّل Docker التطبيق وقاعدة الاسترجاع المحلية معًا، دون حساب Vercel أو Upstash. أضف مفاتيحك الخاصة لخدمات OpenAI وTavus وngrok، ثم شغّل `docker compose up --build` وافتح http://localhost:3000. ينزّل التشغيل الأول أرشيف المراجع بحجم 606 ميغابايت. راجع [دليل Docker وحالة التحقق](docs/DOCKER.md) لقالب الإعداد وخطوات التشغيل والإيقاف. يبقى التشغيل اليدوي أدناه متاحًا.

## ماذا تقدّم بصيرة؟

- **التدريب:** اختر خلفية المحاور ولغة الحوار، ناقش الشخصية أو أجب نصيًا، ثم راجع إجابتك وفق المرجع والمعايير، وأعد المحاولة مع حفظ الإجابة الأصلية للمقارنة. يتضمن البنك 342 سجلًا ثنائي اللغة لأربع خلفيات: المسيحية واليهودية والهندوسية والإلحاد.
- **مراجعة المحتوى:** أدخل نصًا أو صورة أو صوتًا أو فيديو. تستخرج المنصة النص، ثم عناصر الدليل والاستدلال والنتيجة والتصنيف، وتسترجع المراجع وتقيّمها وتعرض تقريرًا. يمكن تصحيح التفريغ، وقبول الملاحظات أو رفضها أو تعديلها، وحفظ التقرير وتصديره وحذفه.
- **مراجعة الوسائط:** تحليل صوتي عند توفر تسجيل صالح، ومراجعة تحريرية بصرية للصور وعيّنة من إطارات الفيديو؛ دون استنتاج المشاعر أو المعتقدات من الوجه أو الصوت.

## التشغيل المحلي

المتطلبات: **Node.js 24، وnpm، وGit**. الأوامر التالية لـ Linux وmacOS وGit Bash. لا تستبدل ملف إعداد موجودًا؛ انسخ القالب مرة واحدة فقط.

<div dir="ltr">

```bash
git clone https://github.com/riotu-lab/basira.git
cd basira
npm ci
cp .env.example .env
npm run dev
```

</div>

في PowerShell استخدم `Copy-Item .env.example .env` بدل أمر النسخ. ضع المفاتيح في `.env` ثم أعد التشغيل. افتح العنوان الذي يطبعه الخادم؛ الافتراضي [http://localhost:3000](http://localhost:3000). عند انشغال المنفذ، اختر منفذًا متاحًا عبر `PORT`.

**للتدريب النصي فقط:** اضبط `AI_PROVIDER=openai` وأضف `OPENAI_API_KEY`، واترك `BASIRA_ENV=development` و`TRAINING_STORE=sqlite`، ثم اختر الوضع النصي من إعدادات الحوار. لا تحتاج إلى Tavus أو ngrok أو Redis أو حساب Vercel لهذا المسار. يمكن تشغيل الواجهة والاختبارات الآلية دون مفاتيح؛ لكن وظائف الذكاء الاصطناعي الحية لن تعمل دون الخدمات المطلوبة.

<a id="services-keys-and-expected-costs"></a>

## متطلبات النسخة المحلية الكاملة

لتشغيل **التدريب بالشخصية ومراجعة المحتوى بالمراجع** تحتاج إلى ثلاثة حسابات: **OpenAI وTavus وngrok**، وإلى **قاعدة Chroma المحلية المُعبّأة** المتاحة في [إصدار البيانات](https://github.com/riotu-lab/basira/releases/tag/retrieval-v1). لا يلزم حساب Upstash لهذا المسار.

**لا تحتاج محليًا إلى Vercel أو Vercel Blob أو Upstash Redis.** اترك `BLOB_READ_WRITE_TOKEN` و`UPSTASH_REDIS_REST_URL` و`UPSTASH_REDIS_REST_TOKEN` و`CRON_SECRET` فارغة. تُحفظ جلسات التطوير في SQLite والوسائط المحلية في المتصفح؛ هذه ليست نسخة من خدمات التخزين السحابي للفريق.

| الاستخدام | الخدمة والمفاتيح | الحساب والرصيد |
| --- | --- | --- |
| التدريب النصي، تقييم الإجابات، استخراج المحتوى ومعالجة الوسائط | **OpenAI:** `OPENAI_API_KEY` من [صفحة المفاتيح](https://platform.openai.com/api-keys) | يلزم رصيد API أو حصة فوترة متاحة وصلاحية للنماذج المستخدمة. [الفوترة](https://platform.openai.com/settings/organization/billing/overview). التطبيق يستخدم مفتاح API، وليس اشتراك ChatGPT لتسجيل الدخول. |
| الشخصية الصوتية والمرئية | **Tavus:** `TAVUS_API_KEY` و`TAVUS_FACE_ID` من [بوابة المطوّر](https://platform.tavus.io/)، مع `AVATAR_PROVIDER=tavus` | يلزم توفر شخصية يمكن للحساب استخدامها، ودقائق محادثة، وسعة لجلسة متزامنة. قد تكفي الحصة المجانية لاختبار قصير؛ يلزم رصيد أو خطة مناسبة عند نفادها. [الخطط](https://www.tavus.io/pricing). |
| ربط Tavus بالخادم المحلي | **ngrok:** `NGROK_AUTHTOKEN` من [صفحة الرمز](https://dashboard.ngrok.com/get-started/your-authtoken) | حساب بخطة مجانية محدودة أو خطة مناسبة للاستخدام. مطلوب للمكالمة المحلية، وليس للتدريب النصي. [الخطط](https://ngrok.com/pricing). |

**لتشغيل الشخصية محليًا:** جهّز OpenAI وTavus وngrok، ثم شغّل `npm run dev:avatar` بدل `npm run dev`، واسمح للمتصفح بالميكروفون والكاميرا. يجهّز الأمر `TAVUS_TRAINING_PAL_ID_DEV` و`BASIRA_PUBLIC_URL_DEV` تلقائيًا ويحفظهما محليًا. أبقِ الطرفية مفتوحة. [التفاصيل](docs/SETUP.md#local-development).

**الإعداد المحلي المقترح في `.env`:** احتفظ بالقيم الافتراضية الأخرى في القالب، وأضف قيم حساباتك إلى الحقول التالية. الحقول الفارغة أدناه ليست بيانات جاهزة.

<div dir="ltr">

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=
AVATAR_PROVIDER=tavus
TAVUS_API_KEY=
TAVUS_FACE_ID=
NGROK_AUTHTOKEN=
BASIRA_ENV=development
TRAINING_STORE=sqlite
AI_AUDIT_STORE=sqlite
CONTENT_RETRIEVAL_ENABLED=true

# Leave managed database credentials empty for local Chroma.
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
```

</div>

### تثبيت قاعدة المراجع محليًا

حمّل الفهرس عبر أداة الإعداد التالية؛ **لا تحتاج إلى Upstash Vector أو Redis**. المتطلبات: Python 3.12 ومساحة فارغة لا تقل عن 3 GiB. حجم التنزيل نحو 606 MB، وقاعدة البيانات بعد فك الضغط نحو 1.03 GB. الأوامر لـ Linux أو macOS؛ على Windows استخدم WSL.

<div dir="ltr">

```bash
python3.12 -m venv .local/rag-venv
.local/rag-venv/bin/python -m pip install -r services/content-retrieval/requirements.lock
.local/rag-venv/bin/python scripts/setup/install-local-retrieval.py
.local/rag-venv/bin/python scripts/dev/content-rag.py
```

</div>

أداة التثبيت تتحقق من بصمة SHA-256، وترفض استبدال قاعدة موجودة، وتضبط `CONTENT_RAG_URL` و`CONTENT_RAG_DB_PATH` و`CONTENT_RAG_TOKEN` في `.env` دون عرض مفاتيحك أو تغييرها. تنشئ رمز حماية محليًا للخدمة؛ **ليس مفتاح اشتراك**. اترك خدمة الاسترجاع مفتوحة، ثم شغّل `npm run dev:avatar` في طرفية ثانية بعد إضافة مفاتيح OpenAI وTavus وngrok. للتدريب النصي استخدم `npm run dev` بدلًا منه.

يمكن تنزيل الملف يدويًا من [إصدار البيانات](https://github.com/riotu-lab/basira/releases/tag/retrieval-v1)، ثم تمريره للأداة عبر `--archive /path/to/basira-retrieval-v1.tar.gz`. تتضمن القاعدة 38,742 مقطعًا ضمن `islamthon`. **لم تُحسم أذونات إعادة توزيع المجموعة وطبعاتها؛ يتضمن الإصدار إشعار المصدر وحدود التوثيق، ولا يمنح ترخيصًا جديدًا.** [التفاصيل](docs/CONTENT-RETRIEVAL.md#local-database-download).


**إتاحة النماذج:** يستدعي مستخرج العناصر الحالي `gpt-5.6-luna` صراحةً؛ لا يغيّره `OPENAI_MODEL`. يجب أن يتيح حسابك النماذج المطلوبة. تختلف الحصص والخطط وقد تتغير؛ لا ينشئ التطبيق اشتراكًا أو يشتري رصيدًا تلقائيًا.

**حماية الأسرار:** احفظ المفاتيح في `.env` فقط؛ لا ترفع الملف إلى GitHub، ولا تضع المفاتيح في متغيرات `VITE_` أو تخزين المتصفح. القيم في [.env.example](.env.example) قالب إعداد، وليست مفاتيح جاهزة.

## الاختبارات وحدود التقييم

<div dir="ltr">

```bash
npm test
npm run build
npm run doctor
```

</div>

لاختبارات المتصفح: ثبّت Chromium عبر `npx playwright install chromium`، ثم شغّل `PORT=3001 npm run test:browser` ليطابق المنفذ إعداد الاختبار. في PowerShell: `$env:PORT="3001"; npm run test:browser`. فحوص الخدمات الحية منفصلة وقد تستهلك رصيدًا. [دليل الاختبارات](docs/ACCEPTANCE.md).

المراجعة مساعدة بشرية وليست اعتمادًا دينيًا أو نشرًا تلقائيًا. توثيق طبعات المصادر المستوردة وأذونات استخدامها والتحكيم العلمي ما زال يحتاج إلى استكمال. عدم العثور على دليل لا يثبت خطأ الادعاء. الفيديو يُحلّل عبر عيّنات إطارات، وتظل جودة الصوت في البيئات الفعلية بحاجة إلى تحقق بشري.

الحدود الحالية: النص 20,000 حرف؛ الصورة 30 MiB؛ الصوت والفيديو 200 MiB وخمس دقائق. [البنية](docs/ARCHITECTURE.md) · [حالة التنفيذ](docs/STATUS.md) · [إعداد الخدمات](docs/SETUP.md) · [English README](README.en.md).

</div>
