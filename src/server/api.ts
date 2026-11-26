import { authorizeAiRequest, AiAccessError, aiCors } from './aiAccess';
import express,{ type Response } from 'express';
import { GoogleGenAI,Type,type GenerateContentParameters } from '@google/genai';

export interface ApiOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  requireAuth?: boolean;
  allowedOrigins?: string[];
  authorize?: (header: string | undefined) => Promise<void>;
  // Dependency injection keeps automated tests entirely offline.
  generateContent?: (request: GenerateContentParameters) => Promise<{ text?: string }>;
}
class ApiFailure extends Error {
  constructor(public status: number,public code: string,message: string) { super(message); }
}
function invalid(message: string): never { throw new ApiFailure(400,'INVALID_REQUEST',message); }
function validateRequest(body: any,route: string): void {
  if(!body||typeof body!=='object'||Array.isArray(body)) invalid('Очікується JSON-об’єкт.');
  for(const field of ['imageBase64','mimeType','textContent','transcription','context','documentContext','label','scanId','targetEngine','recordTypeHint']) {
    if(body[field]!==undefined&&typeof body[field]!=='string') invalid(`Некоректне поле ${field}.`);
    if(field!=='imageBase64'&&body[field]?.length>100_000) invalid(`Поле ${field} завелике.`);
  }
  if(body.existingPersons!==undefined&&(!Array.isArray(body.existingPersons)||body.existingPersons.some((p: any) => !p||typeof p!=='object'||Array.isArray(p)||
    ['id','firstName','lastName','patronymic','birthPlace','birthDate'].some((key) => p[key]!==undefined&&typeof p[key]!=='string')))) {
    invalid('Некоректний список персон.');
  }
  const image=body.imageBase64?.replace(/^data:[^;]+;base64,/,'');
  if(image) {
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(image)||image.length%4!==0) invalid('Некоректне зображення Base64.');
    if(image.length>28_000_000) throw new ApiFailure(413,'IMAGE_TOO_LARGE','Зображення завелике для розпізнавання.');
    if(body.mimeType&&!['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'].includes(body.mimeType)) invalid('Непідтримуваний тип зображення.');
  }
  if(route.endsWith('/htr-analyze')&&!image) invalid('Для розпізнавання потрібне зображення скану.');
  if(route.endsWith('/analyze-metric')&&!image&&!body.textContent?.trim()) invalid('Надайте зображення або текст документа.');
  if(route.endsWith('/generate-notes')&&!image&&!body.transcription?.trim()) invalid('Для нотатки потрібен скан або його транскрипція.');
}
function parseJson(text?: string): any {
  try { if(text) return JSON.parse(text); } catch { }
  throw new ApiFailure(502,'INVALID_AI_RESPONSE','ШІ повернув некоректну відповідь. Дані не додано.');
}
function isMetricResult(item: any): boolean {
  return item&&typeof item==='object'&&
    ['extractedPersonName','year','recordType','village','linkReason'].every((key) => typeof item[key]==='string')&&
    typeof item.confidence==='number'&&Number.isFinite(item.confidence)&&item.confidence>=0&&item.confidence<=100;
}
function isHtrResult(item: any): boolean {
  return item&&typeof item==='object'&&!Array.isArray(item)&&
    typeof item.pysarText==='string'&&typeof item.modernUkrainian==='string'&&
    (item.pysarText.trim()||item.modernUkrainian.trim())&&
    ['diakText','skrybaText','summary','aiNotes'].every((key) => item[key]===undefined||typeof item[key]==='string')&&
    (item.lines===undefined||(Array.isArray(item.lines)&&item.lines.every((line: unknown) => typeof line==='string')))&&
    (item.entities===undefined||(Array.isArray(item.entities)&&item.entities.every((p: any) => p&&typeof p.name==='string'&&
      ['role','status','year','place','details'].every((key) => p[key]===undefined||typeof p[key]==='string'))));
}
function sendFailure(res: Response,error: unknown): void {
  const failure=error instanceof ApiFailure? error:new ApiFailure(502,'AI_UNAVAILABLE','Сервіс ШІ тимчасово недоступний. Спробуйте пізніше.');
  res.status(failure.status).json({ success: false,code: failure.code,error: failure.message,results: [] });
}
export function createApiApp(options: ApiOptions={}) {
  const app=express();
  if (process.env.K_SERVICE) app.set('trust proxy', 1);

  const aiRoutes = ['/api/ai', '/api/nyshporka'];
  const origins = options.allowedOrigins ?? (process.env.ALLOWED_WEB_ORIGINS || '').split(',').map(origin => origin.trim());
  // Same-origin Cloud Run pages and local development work without a proxy.
  app.use(aiRoutes, (req, res, next) => {
    const origin = req.get('Origin');
    const ownOrigin = `${req.protocol}://${req.get('Host')}`;
    if (origin && origin === ownOrigin && req.method !== 'OPTIONS') return next();
    return aiCors(origins)(req, res, next);
  });
  app.use(aiRoutes, async (req, res, next) => {
    if (!options.requireAuth) return next();
    try { await (options.authorize ?? authorizeAiRequest)(req.get('Authorization')); next(); }
    catch (error) {
      const denied = error instanceof AiAccessError ? error : new AiAccessError(503, 'AUTH_UNAVAILABLE', 'Не вдалося перевірити доступ.');
      res.status(denied.status).json({ success: false, code: denied.code, error: denied.message, results: [] });
    }
  });

  // Body parser with 50mb limit for high-resolution archival scans
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true,limit: '50mb' }));

  const apiKey=options.apiKey??process.env.GEMINI_API_KEY;
  const model=options.model||process.env.GEMINI_MODEL||'gemini-3.8-flash';
  const timeoutMs=options.timeoutMs??45_000;
  let ai: GoogleGenAI|undefined;
  const generate=async (request: GenerateContentParameters) => {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        options.generateContent
          ? options.generateContent(request)
          :(ai||=new GoogleGenAI({ apiKey })).models.generateContent({
            ...request,
            config: { ...request.config,httpOptions: { timeout: timeoutMs } }
          }),
        new Promise<never>((_,reject) => {
          timer=setTimeout(() => reject(new ApiFailure(504,'AI_TIMEOUT','Час очікування відповіді ШІ вичерпано. Спробуйте ще раз.')),timeoutMs);
        })
      ]);
    } finally { clearTimeout(timer!); }
  };

  app.disable('x-powered-by');
  app.use(['/api/ai','/api/nyshporka'],(req,res,next) => {
    if(!apiKey) {
      res.status(503).json({ success: false,code: 'AI_NOT_CONFIGURED',error: 'Розпізнавання недоступне: на сервері не налаштовано ключ ШІ.',results: [] });
      return;
    }
    try { validateRequest(req.body,req.path); next(); }
    catch(error) { sendFailure(res,error); }
  });

  // Health check
  app.get('/api/health',(req,res) => {
    res.json({ status: 'ok',hasGeminiKey: Boolean(apiKey) });
  });

  // Primary Multimodal Archival & Metric Recognition API
  app.post('/api/ai/analyze-metric',async (req,res) => {
    try {
      const {
        imageBase64,
        mimeType='image/jpeg',
        textContent,
        recordTypeHint,
        existingPersons=[]
      }=req.body;



      // Prepare system instructions for historical Slavic/Ukrainian genealogical records
      const systemInstruction=`Ти — провідний експерт-архівіст, палеограф та генеалог, який спеціалізується на дослідженні українських та східноєвропейських метричних книг, ревізьких казок (ревізій), сповідних розписів (відомостей) XVIII–XX століть.
Твоє завдання:
1. Прочитати та розшифрувати скан-копію або текст (у тому числі скоропис, церковнослов'янську, дореформену орфографію з ѣ, ъ, і, ѳ, польські та латинські фрагменти).
2. Нормалізувати імена та прізвища сучасною українською мовою (наприклад: "Семенъ Васильевъ сынъ Коваленко" -> "Коваленко Семен Васильович").
3. Витягти всі ключові сутності: головну особу, батьків, подружжя, хрещених батьків / свідків / поручителів, стан (козак, міщанин, селянин, дворянин), місце/парафію, точну дату або рік.
4. Провести зіставлення з наявними в базі персонами родоводу (наданими в контексті), враховуючи фонетичні варіанти українських прізвищ (напр. Шакало-Шакалов, Бондар-Бондаренко, Мельник-Мельниченко) та географічну спорідненість.
5. Повернути результат строго у форматі валідного JSON масиву.`;

      const promptText=`Проаналізуй цей архівний генеалогічний документ або виписку.
${recordTypeHint? `Очікуваний тип запису: ${recordTypeHint}`:''}
${textContent? `Текстовий зміст/витяг: "${textContent}"`:''}

Контекст наявних персон у родинному дереві:
${JSON.stringify(existingPersons.slice(0,30).map((p: any) => ({
        id: p.id,
        name: `${p.lastName||''} ${p.firstName||''} ${p.patronymic||''}`.trim(),
        birthYear: p.birthDate? p.birthDate.slice(0,4):p.birthYear,
        birthPlace: p.birthPlace
      })))}

Витягни кожний знайдений запис/особу та оціни ймовірність зв'язку з родоводом.`;

      const contents: any[]=[];

      if(imageBase64) {
        // Clean base64 header if present
        const cleanBase64=imageBase64.replace(/^data:[^;]+;base64,/,'');
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
      }

      contents.push({ text: promptText });

      const response=await generate({
        model,
        contents: contents.length===1? contents[0].text:{ parts: contents },
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
              required: ['extractedPersonName','year','recordType','village','confidence','linkReason']
            }
          }
        }
      });

      const parsedResults=parseJson(response.text);
      if(!Array.isArray(parsedResults)||!parsedResults.every(isMetricResult)) {
        throw new ApiFailure(502,'INVALID_AI_RESPONSE','ШІ повернув некоректний результат. Дані не додано.');
      }

      res.json({
        success: true,
        source: model,
        results: parsedResults
      });

    } catch(err: any) {
      sendFailure(res,err);
    }
  });

  // Нишпорка (HTR Engine): Спеціалізоване розпізнавання та аналіз архівного скоропису XVIII-XIX ст.
  app.post('/api/nyshporka/htr-analyze',async (req,res) => {
    try {
      const { imageBase64,mimeType='image/jpeg',targetEngine='pysar',documentContext }=req.body;



      const systemInstruction=`Ти — експертний палеограф та рушій розпізнавання архівного скоропису "Нишпорка" (Nyshporka HTR), навчений на українських та східноєвропейських рукописах XVIII–XIX століть (метричні книги, сповідні розписи, ревізькі казки, клірові відомості, справи консисторій, польські нотаріальні та костельні акти).
Твоє завдання:
1. Прочитати надане зображення. Не вигадувати імена, дати або родинні зв’язки. Нерозбірливі місця позначати [нерозбірливо]. Надати варіанти транскрипції у відповідних полях (це один аналіз Gemini, а не незалежні рушії):
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

      const contents: any[]=[];
      if(imageBase64) {
        const cleanBase64=imageBase64.replace(/^data:[^;]+;base64,/,'');
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
      }

      contents.push({
        text: `Будь ласка, розпізнай цей архівний скан скоропису та надай детальний палеографічний аналіз для генеалогічного дослідження.${documentContext? ' Контекст документу: '+documentContext:''}`
      });

      const response=await generate({
        model,
        contents: contents.length===1? contents[0].text:{ parts: contents },
        config: {
          systemInstruction,
          temperature: 0.15,
          responseMimeType: 'application/json',
        }
      });

      const result=parseJson(response.text);
      if(!isHtrResult(result)) {
        throw new ApiFailure(502,'INVALID_AI_RESPONSE','ШІ повернув некоректний результат розпізнавання.');
      }
      res.json({
        pysarText: result.pysarText,
        diakText: result.diakText||'',skrybaText: result.skrybaText||'',
        modernUkrainian: result.modernUkrainian,
        lines: result.lines||[],entities: result.entities||[],
        aiNotes: result.aiNotes||result.summary||'',
        summary: result.summary||result.aiNotes||'',
        success: true,source: model
      });
    } catch(err: any) {
      sendFailure(res,err);
    }
  });

  // Генерація та оновлення автоматичних ШІ-нотаток для конкретного архівного скану
  app.post('/api/nyshporka/generate-notes',async (req,res) => {
    try {
      const { scanId,label,context,transcription,imageBase64,mimeType='image/jpeg' }=req.body;



      const systemInstruction=`Ти — експертний архівіст-джерелознавець та генеалог України.
Твоє завдання — проаналізувати архівний скан або його транскрипцію/опис та сформулювати короткий, професійний ШІ-висновок (автоматичну нотатку) про зміст запису для родоводу.
Формат відповіді (українською мовою, чітко та структуровано):
📌 Тип документа: [Метричний запис про народження / шлюб / смерть / ревізька казка / сповідний розпис / судова справа тощо] (вказати рік або період).
👤 Ключові особи: [ПІБ, ролі, соціальний стан].
📍 Географія: [Населений пункт, парафія, повіт, губернія].
💡 Генеалогічний висновок: [2-3 змістовні речення про суть знахідки, родинні зв'язки та значення для дерева].

Відповідай одразу сформованим текстом нотатки без вступних слів або службових преамбул.`;

      const contents: any[]=[];
      if(imageBase64) {
        const cleanBase64=imageBase64.replace(/^data:[^;]+;base64,/,'');
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
      }

      const promptText=`Склади автоматичну ШІ-нотатку та короткий висновок про цей архівний скан:
Назва документу: ${label||'Архівний скан'}
Контекст справи: ${context||''}
${transcription? `Транскрибований текст скоропису: \n${transcription}`:''}`;

      contents.push({ text: promptText });

      const response=await generate({
        model,
        contents: contents.length===1? contents[0].text:{ parts: contents },
        config: {
          systemInstruction,
          temperature: 0.2,
        }
      });

      const aiNotes=response.text?.trim();
      if(!aiNotes) throw new ApiFailure(502,'INVALID_AI_RESPONSE','ШІ не повернув текст нотатки.');
      res.json({
        success: true,
        source: model,
        aiNotes,
        summary: aiNotes
      });
    } catch(err: any) {
      sendFailure(res,err);
    }
  });




  app.use('/api',(_req,res) => { res.status(404).json({ success: false,code: 'NOT_FOUND',error: 'API endpoint not found' }); });
  app.use((error: any,_req: express.Request,res: express.Response,_next: express.NextFunction) => {
    const status=error?.type==='entity.too.large'? 413:400;
    res.status(status).json({ success: false,code: status===413? 'BODY_TOO_LARGE':'INVALID_JSON',error: status===413? 'Запит завеликий.':'Некоректний JSON.' });
  });
  return app;
}
