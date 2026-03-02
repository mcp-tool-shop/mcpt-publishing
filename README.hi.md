<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.md">English</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop/mcpt-publishing/main/logo.png" alt="mcpt-publishing logo" width="520" />
</p>

<p align="center">
  Catch registry drift before your users do.
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop/mcpt-publishing/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/mcp-tool-shop/mcpt-publishing?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/mcpt-publishing"><img alt="npm" src="https://img.shields.io/npm/v/@mcptoolshop/mcpt-publishing?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
</p>

---

आप npm, PyPI और NuGet पर अपनी सामग्री प्रकाशित करते हैं। समय के साथ, आपके रजिस्ट्री पृष्ठों में बदलाव आते हैं: पुरानी जानकारी, होमपेज लिंक गायब होना, ऐसे टैग जो रिलीज़ के साथ मेल नहीं खाते, और README फ़ाइलों में लोगो के बिना शीर्षक। कोई भी इस पर ध्यान नहीं देता, जब तक कि कोई उपयोगकर्ता इसकी शिकायत नहीं करता।

**mcpt-publishing** आपके द्वारा प्रकाशित पैकेजों की विभिन्न रजिस्ट्रीज़ में जांच करता है, किसी भी विचलन (drift) को ढूंढता है, उसे ठीक करता है, और आपको एक रसीद प्रदान करता है जो यह साबित करती है कि क्या हुआ। इसमें कोई अतिरिक्त निर्भरता (dependencies) नहीं है। यह Node 22 या उससे उच्च संस्करण पर काम करता है।

## शुरुआत कैसे करें।

```bash
# Scaffold config + profiles
npx mcpt-publishing init

# Audit everything — writes reports/latest.md + receipt
npx mcpt-publishing audit

# Preview what fix would change
npx mcpt-publishing fix --dry-run

# Apply fixes
npx mcpt-publishing fix
```

बस इतना ही। आप `audit` कमांड को CI (निरंतर एकीकरण) में चला सकते हैं ताकि शुरुआती स्तर पर किसी भी विचलन का पता चल सके, या `weekly` कमांड का उपयोग करके पूरी प्रक्रिया को स्वचालित कर सकते हैं।

---

## यह क्या पकड़ता है।

| खोज करना। | गंभीरता। | उदाहरण। |
|---------|----------|---------|
| पैकेज.json फ़ाइल में "रिपॉजिटरी" (repository) का उल्लेख नहीं है। | लाल। | npm पेज पर "रिपॉजिटरी" का लिंक दिखाई नहीं दे रहा है। |
| "होमपेज" उपलब्ध नहीं है। | लाल। | कोई दस्तावेज़ या लैंडिंग पृष्ठ का लिंक नहीं है। |
| "बग्स.यूआरएल" फाइल नहीं मिली। | पीला। | npm पर कोई समस्या ट्रैकिंग लिंक उपलब्ध नहीं है। |
| गायब कीवर्ड। | पीला। | यह पैकेज खोज इंजन द्वारा दिखाई नहीं देगा। |
| पुरानी README फ़ाइल का शीर्षक। | पीला। | कोई लोगो नहीं, कोई बैज नहीं, गलत लिंक। |
| GitHub पर दिए गए विवरण और होमपेज में विसंगति। | पीला। | "रेपो 'अबाउट' रजिस्ट्री से मेल नहीं खाता।" |
| NuGet में 'PackageProjectUrl' नाम का पैकेज गायब है। | पीला। | NuGet पेज में कोई होमपेज नहीं है। |
| टैग/रिलीज़ संस्करण में असंगति। | लाल। | संस्करण 1.2.0 प्रकाशित किया गया है, लेकिन टैग में संस्करण 1.1.0 दर्शाया गया है। |

## यह क्या ठीक करता है।

सात अंतर्निहित सुधारक उपकरण हैं जो स्वीकृत मेटाडेटा सुधारों को लागू करते हैं:

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| ठीक करने वाला। | यह क्या करता है। |
|-------|-------------|
| `npm-repository` | `package.json` फ़ाइल में `repository` फ़ील्ड को सेट करें। |
| `npm-homepage` | `package.json` फ़ाइल में `homepage` फ़ील्ड को सेट करें। |
| `npm-bugs` | `package.json` फ़ाइल में `bugs.url` को सेट करें। |
| `npm-keywords` | यह पैकेज.json फ़ाइल में शुरुआती कीवर्ड जोड़ता है। |
| `readme-header` | "README.md" फ़ाइल में लोगो और लिंक जोड़े गए हैं। |
| `github-about` | गिटहब एपीआई के माध्यम से सेट विवरण/होमपेज को प्रबंधित करें। |
| `nuget-csproj` | ".csproj" फ़ाइल में "PackageProjectUrl" और "RepositoryUrl" फ़ील्ड जोड़े गए। |

## रसीदें साथ में संलग्न करें।

प्रत्येक प्रकाशन एक अपरिवर्तनीय (immutable) जेएसओएन रसीद उत्पन्न करता है, जिसमें कमिट का SHA, रजिस्ट्री का संस्करण, आर्टिफैक्ट के हैश और टाइमस्टैम्प शामिल होते हैं।

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## साप्ताहिक पाइपलाइन।

एक ही कमांड के माध्यम से पूरी प्रक्रिया चलाएं - जिसमें ऑडिट (जांच), सुधार और वैकल्पिक रूप से प्रकाशन शामिल हैं:

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## अपनी मैनिफेस्ट फ़ाइल को स्थापित करना।

`init` प्रक्रिया के बाद, अपने पैकेजों को घोषित करने के लिए `profiles/manifest.json` फ़ाइल को संपादित करें:

```json
{
  "npm": [
    { "name": "@yourscope/my-tool", "repo": "your-org/my-tool", "audience": "front-door" }
  ],
  "pypi": [
    { "name": "my-tool", "repo": "your-org/my-tool", "audience": "front-door" }
  ],
  "nuget": [
    { "name": "MyTool.Core", "repo": "your-org/my-tool", "audience": "internal" }
  ]
}
```

**उपयोगकर्ता:** नियंत्रण स्तर निर्धारित करता है:
- `front-door`: यह सार्वजनिक उपयोग के लिए है। इसके लिए साफ-सुथरा मेटाडेटा, टैग और रिलीज़, और एक उचित README फ़ाइल की आवश्यकता होती है।
- `internal`: यह एक आंतरिक पैकेज है। इसके लिए टैग की आवश्यकता होती है, लेकिन README फ़ाइल वैकल्पिक है।

## वैकल्पिक: एसेट्स प्लगइन।

"कोर" में किसी भी अन्य चीज़ पर निर्भरता नहीं है। दृश्य संबंधी अपडेट (जैसे लोगो, आइकन) एक वैकल्पिक प्लगइन के माध्यम से किए जाते हैं:

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## पर्यावरण चर।

यह केवल उन सुधारों के लिए आवश्यक है जिन्हें प्रकाशित करने की आवश्यकता है या जो एपीआई-आधारित सुधार हैं:

| लक्ष्य। | पर्यावरण चर (एनवायरमेंट वेरिएबल) | टिप्पणियाँ। |
|--------|---------|-------|
| npm (एनपीएम) एक पैकेज मैनेजर है जिसका उपयोग जावास्क्रिप्ट परियोजनाओं के लिए पैकेजों को स्थापित करने और प्रबंधित करने के लिए किया जाता है। | `NPM_TOKEN` | "विस्तृत पहुंच वाले टोकन, जिनमें प्रकाशन की अनुमति है।" |
| NuGet | `NUGET_API_KEY` | यह सीआई (CI) या स्थानीय रूप से काम कर सकता है। |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN`
(यह एक टोकन है जिसका उपयोग गिटहब के साथ इंटरैक्ट करने के लिए किया जाता है।) | रिलीज़, समस्याएं, और जीएचसीआर (GHCR) से संबंधित जानकारी। |
| PyPI (पाइपी) | `PYPI_TOKEN` | पाइपी (PyPI) पर प्रकाशन के लिए। |

## निकास कोड।

| कोड। | अर्थ। |
|------|---------|
| `0` | स्वच्छ - कोई संदूषण नहीं पाया गया। |
| `2` | "रेड" स्तर की गंभीरता में बदलाव का पता चला। |
| `3` | कॉन्फ़िगरेशन या स्कीमा में त्रुटि। |
| `4` | अमान्य क्रेडेंशियल। |
| `5` | प्रकाशन विफल हो गया। |
| `6` | मरम्मत विफल रही। |

## रसीदें।

प्रत्येक ऑपरेशन (ऑडिट, सुधार, प्रकाशन, संपत्ति) एक अपरिवर्तनीय JSON रसीद फ़ाइल `receipts/` में लिखता है। प्रत्येक रसीद में कमिट का SHA, समय-मुद्रांकन, आर्टिफैक्ट के SHA-256 हैश और रजिस्ट्री यूआरएल शामिल होते हैं। किसी भी रसीद को सत्यापित करें:

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## सुरक्षा।

| पहलू/अंश/दृष्टिकोण. | विवरण |
|--------|--------|
| **Reads** | पैकेज मैनिफेस्ट, रजिस्ट्री एपीआई (npm, NuGet, PyPI) |
| **Writes** | केवल उपयोगकर्ता द्वारा निर्दिष्ट पथों पर रसीद फ़ाइलें। |
| **Network** | रजिस्ट्री एपीआई क्वेरी - केवल पढ़ने के लिए, जब तक कि प्रकाशन न हो। |
| **Telemetry** | कोई नहीं। कोई विश्लेषण नहीं, कोई डेटा संग्रह नहीं। |

भेद्यता रिपोर्टिंग के लिए, [SECURITY.md](SECURITY.md) देखें।

---

<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> द्वारा निर्मित।
