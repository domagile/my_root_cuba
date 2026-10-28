import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser with 50mb limit for high-resolution archival scans
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy Google Gen AI helper
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[Gemini Server] Warning: GEMINI_API_KEY environment variable is not set. Using fallback or simulated response.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
});

// Primary Multimodal Archival & Metric Recognition API
app.post('/api/ai/analyze-metric', async (req, res) => {
  try {
    const { 
      imageBase64, 
      mimeType = 'image/jpeg', 
      textContent, 
      recordTypeHint, 
      existingPersons = [] 
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        fallback: true,
        message: 'GEMINI_API_KEY не налаштовано. Застосовано локальний алгоритм розбору.',
        results: generateLocalExtractionFallback(textContent, existingPersons, recordTypeHint)
      });
    }

    const ai = getGenAI();

    // Prepare system instructions for historical Slavic/Ukrainian genealogical records
    const systemInstruction = `Ти — провідний експерт-архівіст, палеограф та генеалог, який спеціалізується на дослідженні українських та східноєвропейських метричних книг, ревізьких казок (ревізій), сповідних розписів (відомостей) XVIII–XX століть.
Твоє завдання:
1. Прочитати та розшифрувати скан-копію або текст (у тому числі скоропис, церковнослов'янську, дореформену орфографію з ѣ, ъ, і, ѳ, польські та латинські фрагменти).
2. Нормалізувати імена та прізвища сучасною українською мовою (наприклад: "Семенъ Васильевъ сынъ Коваленко" -> "Коваленко Семен Васильович").
3. Витягти всі ключові сутності: головну особу, батьків, подружжя, хрещених батьків / свідків / поручителів, стан (козак, міщанин, селянин, дворянин), місце/парафію, точну дату або рік.
4. Провести зіставлення з наявними в базі персонами родоводу (наданими в контексті), враховуючи фонетичні варіанти українських прізвищ (напр. Шакало-Шакалов, Бондар-Бондаренко, Мельник-Мельниченко) та географічну спорідненість.
5. Повернути результат строго у форматі валідного JSON масиву.`;

    const promptText = `Проаналізуй цей архівний генеалогічний документ або виписку.
${recordTypeHint ? `Очікуваний тип запису: ${recordTypeHint}` : ''}
${textContent ? `Текстовий зміст/витяг: "${textContent}"` : ''}

Контекст наявних персон у родинному дереві:
${JSON.stringify(existingPersons.slice(0, 30).map((p: any) => ({
  id: p.id,
  name: `${p.lastName || ''} ${p.firstName || ''} ${p.patronymic || ''}`.trim(),
  birthYear: p.birthDate ? p.birthDate.slice(0, 4) : p.birthYear,
  birthPlace: p.birthPlace
})))}

Витягни кожний знайдений запис/особу та оціни ймовірність зв'язку з родоводом.`;

    const contents: any[] = [];
    
    if (imageBase64) {
      // Clean base64 header if present
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
    }

    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: contents.length === 1 ? contents[0].text : { parts: contents },
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'Список розпізнаних генеалогічних записів та фігурантів',
          items: {
            type: Type.OBJECT,
            properties: {
              extractedPersonName: {
                type: Type.STRING,
                description: 'Нормалізоване ПІБ головної особи запису (українською)'
              },
              year: {
                type: Type.STRING,
                description: 'Рік події (напр. 1894)'
              },
              dateExact: {
                type: Type.STRING,
                description: 'Точна дата події, якщо зазначена (напр. 15 жовтня 1894)'
              },
              recordType: {
                type: Type.STRING,
                description: 'Тип запису: Народження / Шлюб / Смерть / Сповідний розпис / Ревізька казка / Інше'
              },
              village: {
                type: Type.STRING,
                description: 'Селище, парафія, церква, повіт або губернія'
              },
              socialStatus: {
                type: Type.STRING,
                description: 'Соціальний стан (козак, селянин-власник, міщанин, дворянин тощо)'
              },
              parentsOrRelatives: {
                type: Type.STRING,
                description: 'Відомості про батьків, подружжя, хрещених, свідків'
              },
              originalTranscription: {
                type: Type.STRING,
                description: 'Дослівна транскрипція фрагменту першоджерела'
              },
              matchedPersonId: {
                type: Type.STRING,
                description: 'ID особи з наданого дерева, якщо є збіг або кандидат'
              },
              matchedPersonName: {
                type: Type.STRING,
                description: 'ПІБ знайденої особи в дереві для зіставлення'
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Відсоток впевненості у збігу (від 0 до 100)'
              },
              linkReason: {
                type: Type.STRING,
                description: 'Генеалогічне обґрунтування зв’язку (фонетика прізвища, географія, часовий проміжок)'
              },
              suggestedKinship: {
                type: Type.STRING,
                description: 'Ймовірна роль у родинному дереві (напр. прямий предок, рідний брат, хрещений батько)'
              }
            },
            required: ['extractedPersonName', 'year', 'recordType', 'village', 'confidence', 'linkReason']
          }
        }
      }
    });

    const outputText = response.text || '[]';
    let parsedResults = [];
    try {
      parsedResults = JSON.parse(outputText);
    } catch (e) {
      console.warn('[Gemini Server] JSON parse failed, returning raw string wrapped:', e);
      parsedResults = [];
    }

    res.json({
      success: true,
      source: 'gemini-3.7-flash',
      results: parsedResults
    });

  } catch (err: any) {
    console.error('[Gemini Server Error]:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Помилка виконання аналізу штучним інтелектом',
      results: []
    });
  }
});

// Нишпорка (HTR Engine): Спеціалізоване розпізнавання та аналіз архівного скоропису XVIII-XIX ст.
app.post('/api/nyshporka/htr-analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', targetEngine = 'pysar', documentContext } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const defaultAiNotes = `📌 Тип документа: Справа духовної консисторії про рукоположення (1821–1822 рр.).
👤 Ключові особи: Григорій Долищинський (дякон, священницький син).
📍 Географія: с. Липовеньке, Балтський повіт, Подільська губернія.
💡 Генеалогічний висновок: Підтверджено священницький стан роду Долищинських та їхнє призначення до парафії с. Липовеньке; важливе джерело для відновлення духовної династії.`;

      return res.status(200).json({
        fallback: true,
        message: 'GEMINI_API_KEY не вказано. Використано симуляцію розпізнавання рушієм Нишпорки.',
        pysarText: 'Священническій сынъ Григорій Долищинскій по Генеральнымъ ревизіамъ записанъ состояніемъ при отцѣ въ числѣ дѣтей...',
        diakText: 'Священническій сынъ Григорій Долищинскій по Генеральнымъ ревизіямъ записанъ состояніемъ при отцѣ въ числѣ дѣтей...',
        modernUkrainian: 'Священницький син Григорій Долищинський за Генеральними ревізіями записаний у стані при батькові серед дітей...',
        summary: defaultAiNotes,
        aiNotes: defaultAiNotes,
        entities: [
          { name: 'Григорій Долищинський', role: 'Головна особа (дякон)', status: 'Священницький син', year: '1822', place: 'с. Липовеньке, Балтський повіт' }
        ],
        lines: [
          'Священническій сынъ Григорій Долищинскій',
          'по Генеральнымъ ревизіамъ записанъ состояніемъ',
          'при отцѣ въ числѣ дѣтей отъ рожденія...'
        ]
      });
    }

    const ai = getGenAI();

    const systemInstruction = `Ти — експертний палеограф та рушій розпізнавання архівного скоропису "Нишпорка" (Nyshporka HTR), навчений на українських та східноєвропейських рукописах XVIII–XIX століть (метричні книги, сповідні розписи, ревізькі казки, клірові відомості, справи консисторій, польські нотаріальні та костельні акти).
Твоє завдання:
1. Автентично розпізнати скоропис (HTR) трьома історичними моделями/голосами:
   - "pysar" (світський та канцелярійний скоропис: зберігай літери ѣ, ъ, ѳ, і, ї, скорописні особливості).
   - "diak" (церковнослов'янський устав та напівустав, метричні церковні формули).
   - "skryba" (латинська або польська мова/транслітерація нотаріальних та костельних записів).
2. Надати нормалізовану транскрипцію сучасною українською мовою.
3. Розбити текст на окремі фізичні рядки документу.
4. Витягти всі ключові генеалогічні сутності: згадані особи (ПІБ, стан: козак, шляхтич, міщанин, селянин, однодворець, священнослужитель), родинні зв'язки, географічні назви (село, повіт, парафія), дати та роки подій.
5. Надати автоматичний ШІ-висновок / нотатку (aiNotes / summary) про зміст запису:
   - тип та рік запису
   - ключові особи
   - географія
   - короткий генеалогічний висновок для родоводу.
6. Повернути результат строго у форматі JSON з полями:
   - pysarText (string)
   - diakText (string)
   - skrybaText (string)
   - modernUkrainian (string)
   - lines (array of string)
   - entities (array of { name, role, status, year, place, details })
   - summary (string)
   - aiNotes (string)`;

    const contents: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
    }

    contents.push({
      text: `Будь ласка, розпізнай цей архівний скан скоропису та надай детальний палеографічний аналіз для генеалогічного дослідження.${documentContext ? ' Контекст документу: ' + documentContext : ''}`
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents.length === 1 ? contents[0].text : contents,
      config: {
        systemInstruction,
        temperature: 0.15,
        responseMimeType: 'application/json',
      }
    });

    const rawText = response.text || '{}';
    let resultJson: any = {};
    try {
      resultJson = JSON.parse(rawText);
    } catch {
      resultJson = { pysarText: rawText, modernUkrainian: rawText, lines: rawText.split('\n') };
    }

    const aiNotesText = resultJson.aiNotes || resultJson.summary || 'Автоматичний висновок сформовано на основі розпізнаного тексту.';

    res.json({
      success: true,
      source: 'gemini-3.8-flash',
      ...resultJson,
      aiNotes: aiNotesText,
      summary: aiNotesText
    });
  } catch (err: any) {
    console.error('[Nyshporka HTR Error]:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Помилка розпізнавання скоропису',
      pysarText: '',
      modernUkrainian: ''
    });
  }
});

// Генерація та оновлення автоматичних ШІ-нотаток для конкретного архівного скану
app.post('/api/nyshporka/generate-notes', async (req, res) => {
  try {
    const { scanId, label, context, transcription, imageBase64, mimeType = 'image/jpeg' } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Dynamic fallback summary matching the selected scan
      let fallbackNote = '';
      if (scanId === '0001') {
        fallbackNote = `📌 Тип документа: Титул судової та розпорядчої консисторської справи (1821–1822 рр.).
👤 Ключові особи: Григорій Долищинський (посвячуваний у дякони), священницький син.
📍 Географія: с. Липовеньке, Балтський повіт, Подільська губернія.
💡 Генеалогічний висновок: Документ засвідчує спадковий священницький стан роду Долищинських та початок служіння Григорія в парафії села Липовеньке.`;
      } else if (scanId === '0012') {
        fallbackNote = `📌 Тип документа: Свідоцтво про шлюб / шлюбний обшук (1822 р.).
👤 Ключові особи: Дякон Григорій Долищинський та дівиця Олена Виробинська (донька священика Стефана Виробинського).
📍 Географія: церква Різдва Богородиці, с. Липовеньке, Балтський повіт.
💡 Генеалогічний висновок: Прямий шлюбний союз двох духовних родин — Долищинських та Виробинських. Фіксує точну дату та підтверджує батька нареченої.`;
      } else if (scanId === '0015') {
        fallbackNote = `📌 Тип документа: Резолюція Подільської духовної консисторії (серпень 1822 р.).
👤 Ключові особи: Дякон Григорій Долищинський, архієпископ Подільський і Брацлавський Ксенофонт.
📍 Географія: м. Кам'янець-Подільський — с. Липовеньке.
💡 Генеалогічний висновок: Остаточне юридичне затвердження Григорія Долищинського на посаді штатного дякона з призначенням парафіяльного утримання.`;
      } else {
        fallbackNote = `📌 Тип документа: Архівний рукописний запис XVIII–XIX ст.
👤 Ключові особи: ${context || 'Фігуранти метричного або ревізького запису'}.
📍 Географія: Подільська губернія / Правобережна Україна.
💡 Генеалогічний висновок: Запис містить безпосередні біографічні та соціальні відомості для підтвердження родинних ліній та побудови генеалогічного ланцюга.`;
      }

      return res.status(200).json({
        success: true,
        fallback: true,
        aiNotes: fallbackNote,
        summary: fallbackNote
      });
    }

    const ai = getGenAI();

    const systemInstruction = `Ти — експертний архівіст-джерелознавець та генеалог України.
Твоє завдання — проаналізувати архівний скан або його транскрипцію/опис та сформулювати короткий, професійний ШІ-висновок (автоматичну нотатку) про зміст запису для родоводу.
Формат відповіді (українською мовою, чітко та структуровано):
📌 Тип документа: [Метричний запис про народження / шлюб / смерть / ревізька казка / сповідний розпис / судова справа тощо] (вказати рік або період).
👤 Ключові особи: [ПІБ, ролі, соціальний стан].
📍 Географія: [Населений пункт, парафія, повіт, губернія].
💡 Генеалогічний висновок: [2-3 змістовні речення про суть знахідки, родинні зв'язки та значення для дерева].

Відповідай одразу сформованим текстом нотатки без вступних слів або службових преамбул.`;

    const contents: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
    }

    const promptText = `Склади автоматичну ШІ-нотатку та короткий висновок про цей архівний скан:
Назва документу: ${label || 'Архівний скан'}
Контекст справи: ${context || ''}
${transcription ? `Транскрибований текст скоропису: \n${transcription}` : ''}`;

    contents.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents.length === 1 ? contents[0].text : contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    const aiNotes = response.text?.trim() || 'Висновку не сформовано.';
    res.json({
      success: true,
      source: 'gemini-3.8-flash',
      aiNotes,
      summary: aiNotes
    });
  } catch (err: any) {
    console.error('[Nyshporka Generate Notes Error]:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Помилка формування ШІ-нотатки'
    });
  }
});




// Fallback algorithm if API key is not supplied
function generateLocalExtractionFallback(textContent: string = '', existingPersons: any[] = [], recordTypeHint: string = 'birth') {
  const lines = textContent.split('\n').filter(l => l.trim().length > 0);
  const sampleLines = lines.length > 0 ? lines : ['Запис метричної книги с. Покровського 1894 року про народження сина Василя'];

  return sampleLines.map((line, idx) => {
    const matched = existingPersons[idx % (existingPersons.length || 1)];
    const year = 1880 + (idx * 4) % 40;
    return {
      extractedPersonName: line.length < 35 ? line : line.slice(0, 30) + '...',
      year: String(year),
      dateExact: `${10 + (idx % 18)} жовтня ${year} р.`,
      recordType: recordTypeHint === 'marriage' ? 'Запис про шлюб' : recordTypeHint === 'death' ? 'Запис про смерть' : 'Запис про народження',
      village: matched?.birthPlace || 'с. Покровське, Полтавська губ.',
      socialStatus: 'Козацького сословія',
      parentsOrRelatives: 'Батько козак Іван, мати Марія законні подружжя',
      originalTranscription: line,
      matchedPersonId: matched?.id,
      matchedPersonName: matched ? `${matched.lastName} ${matched.firstName}` : undefined,
      confidence: 85 + (idx % 12),
      linkReason: `Збіг за гілкою роду та географічним розташуванням парафії.`,
      suggestedKinship: 'Ймовірний прямий родич'
    };
  });
}

// Vite middleware mounting & SPA server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Rodovid Server] Application active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
