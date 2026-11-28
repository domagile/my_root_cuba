# Публикация сайта: Firebase Hosting + Cloud Run

Ветка feat/firebase-cloud-run-deploy, база main d23e30a. Подготовка по запросу пользователя о публикации. Jira не задана; критерии ниже — техническое решение для этого развёртывания.

## Схема

- Клиент собирается в dist/client и публикуется на отдельном Firebase Hosting site с адресом SITE_ID.web.app. Серверный bundle и source map лежат вне этой директории.
- Express запускается в отдельном сервисе Cloud Run из Dockerfile; существующий сервис ais-pre не заменяется.
- Клиент отправляет ИИ-запросы прямо на HTTPS-адрес Cloud Run из VITE_AI_API_BASE_URL, вместе с Firebase ID token. Это не требует объединять Google-проекты или проксировать большие сканы через Hosting.
- Firebase Auth и именованная Firestore остаются из firebase-applet-config.json: smiling-spanner-31ttq, база ai-studio-a567c750-fcc0-4247-9c87-f3613091d667. Публикация сайта не запускает развёртывание правил и не переносит документы.
- В production ИИ разрешён после проверки Google ID token и активного доступа admin/editor/researcher из существующего whitelist. Исключение для двух действующих владельцев совпадает с firestore.rules. Viewer и анонимный посетитель не могут использовать серверный ключ. REST-запросы к базе выполняются с токеном самого пользователя, без административного обхода правил.

## Что нужно подключить один раз

1. Войти в Google через стандартный OAuth на компьютере оператора. Пароли, ID tokens, refresh tokens и Gemini key не передаются в чат или Git.
2. Проверить доступ к Firebase-проекту smiling-spanner-31ttq и определить настоящий project ID нынешнего Cloud Run по номеру 453822691973. Эти номера различаются: текущий Firebase — 36223236836. Выбрать проект для нового Cloud Run; при необходимости подключения платёжного аккаунта отдельно подтвердить это с владельцем. Скрипты и workflow не подключают billing автоматически.
3. Создать отдельные Artifact Registry repository, runtime service account и deploy service account. Разрешить deploy account развёртывать Cloud Run и загружать образ в выбранный repository, использовать runtime account и публиковать Hosting в выбранном Firebase-проекте. У runtime account дать Secret Manager Secret Accessor только на секрет с Gemini key. Для проверки whitelist отдельное административное право чтения Firestore не нужно.
4. Gemini key сохранить в Secret Manager через защищённый ввод/Google Console; не вводить его в командную строку или GitHub Variables. Workflow подключает существующий секрет, не создаёт и не печатает его значение.
5. Создать Workload Identity Pool/Provider для GitHub с условием repository == domagile/my_root_cuba и ref == refs/heads/main; разрешить этому субъекту impersonation deploy account через roles/iam.workloadIdentityUser. Долгоживущий JSON-ключ не нужен. Проверить точные IAM-права на выбранных ресурсах перед выдачей.
6. Выбрать свободный Hosting site ID, создать site и добавить его web.app/firebaseapp.com домены в разрешённые домены исходного Firebase Auth, сохранив существующие домены.
7. Создать GitHub environment production и задать Variables из таблицы. Последней включить WEBSITE_DEPLOY_ENABLED=true после проверки доступа, стоимости и конфигурации. До этого публикация пропускается.

| GitHub Variable | Содержимое |
| --- | --- |
| WEBSITE_DEPLOY_ENABLED | true только после подключения окружения |
| RUN_PROJECT_ID | Проверенный project ID нового сервера |
| HOSTING_PROJECT_ID | Firebase-проект для нового site |
| FIREBASE_HOSTING_SITE | Проверенный свободный/созданный site ID |
| RUN_REGION | Например europe-west2 |
| RUN_SERVICE | Например my-root-cuba-api, не существующий ais-pre |
| ARTIFACT_REPOSITORY | Имя Docker repository в RUN_REGION |
| GCP_RUNTIME_SERVICE_ACCOUNT | Email отдельного runtime account |
| GEMINI_SECRET_NAME | Имя существующего секрета в RUN_PROJECT_ID |
| GCP_WORKLOAD_IDENTITY_PROVIDER | Полный ресурс OIDC provider |
| GCP_DEPLOY_SERVICE_ACCOUNT | Email deploy account |

Идентификаторы ресурсов — настройки, а не секреты. Перед авторизацией workflow проверяет формат значений; команды используют env и кавычки. Docker build context исключает .env и временные файлы авторизации.

## Доставка и откат

Workflow Deploy website запускается после успешного Verify application на push в main либо вручную для main. Перед использованием облачных полномочий проверяет успешный CI и актуальный SHA main. Pull requests и посторонние репозитории не публикуются. Ветки сохраняются отдельно.

Сначала собирается образ, затем краткоживущая OIDC-авторизация позволяет загрузить его и создать новую ревизию Cloud Run. Проверяются health и 401 для анонимного ИИ-запроса. После этого клиент собирается с реальным API URL, генерируется Hosting-only config и публикуется только Hosting. Перед публикацией проверка актуального main повторяется. Правила Firestore, документы и настройки Auth workflow не изменяет.

Минимум экземпляров 0, максимум 1, concurrency 4. Эти настройки уменьшают расход, но не являются денежным лимитом. Cloud Run, хранение образов, Firestore и Gemini имеют отдельные квоты/тарифы; нулевая стоимость не гарантируется. При первом подключении проверяются billing и ограничения выбранного аккаунта.

Откат: вернуть предыдущий Hosting release и предыдущую ревизию нового Cloud Run. Старый URL AI Studio остаётся отдельным сервисом. Новый origin имеет отдельные IndexedDB/localStorage: перед переходом нужно сохранить экспорт из старого сайта и подтвердить выгрузку локальных изменений. Корзина, локальные контрольные точки и невыгруженные решения не переносятся автоматически; старую вкладку/адрес сохраняют до проверки данных на новом сайте.

## Requirements vs Implementation

| Критерий задачи | Expected | Implementation | Code Reference | Status |
| --- | --- | --- | --- | --- |
| Публикация интерфейса | В Hosting попадает клиент, без серверного кода и ключей | dist/client, Hosting-only config; Gemini key только в Secret Manager | vite.config.ts; server.ts; firebase.json; hosting-config.mjs; Dockerfile | MATCH в локальной сборке; production ещё не опубликован |
| Существующая база | Документы, правила и именованная база сохраняются | Исходный Firebase config; deploy --only hosting; авторизующие запросы только чтение | deploy.yml; aiAccess.ts | MATCH по коду; облачный доступ требует входа |
| Автоматическая доставка | Публикуется проверенный актуальный main | workflow_run push/main + SHA/CI guards + OIDC | .github/workflows/deploy.yml | Требуется CI и первое развёртывание |
| Контроль ИИ-доступа | Чужой запрос не вызывает Gemini | Проверка токена/ролей до parser/model; CORS по явным origin | aiAccess.ts; api.ts; aiApiClient.ts | MATCH в тестах с подменённым транспортом |
| Стабильный запуск | Собранный сервер стартует без Vite; контейнер работает непривилегированным пользователем | Node 24, USER node; smoke проверяет HTTP/assets/auth/source | Dockerfile; check-container.mjs; server.test.ts | Локальный сервер проверяется; Docker daemon локально недоступен, образ проверяется в CI |

## Проверки и риски

Новые проверки: 17 auth/deployment; 6 дополнительных API/client сценариев; расширенная проверка запуска сервера. Проверяются роли, блокировка анонимных запросов до чтения скана, ошибки Google/Firestore, сроки ожидания, разрешённый Origin и сохранение API-контракта. Нет обращений к рабочему Gemini или записям реальных пользователей.

Пока не выполнен вход в Google, не подтверждены: доступность обоих проектов, billing, свободное имя site, ограничения Firebase web API key для серверного accounts:lookup, реальный Google sign-in на новом домене и первое развёртывание. Потенциальный риск: если web API key ограничен HTTP referrer, серверная проверка может вернуть AUTH_UNAVAILABLE; после входа нужно проверить ограничения ключа и выбрать допустимую конфигурацию без снятия ограничений вслепую. Сценарий приёмки — вход владельца/редактора на новом домене, проверка доступа без платного вызова, затем отдельно согласованное распознавание одного скана.

Источники: [Firebase Hosting](https://firebase.google.com/docs/hosting), [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth), [Firestore REST](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get), [GitHub OIDC для Google Cloud](https://github.com/google-github-actions/auth).
