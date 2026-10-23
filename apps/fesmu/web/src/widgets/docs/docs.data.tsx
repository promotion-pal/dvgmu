import type { LucideIcon } from "lucide-react";
import { BotIcon, BriefcaseIcon, BuildingIcon, ClipboardListIcon, ExternalLinkIcon, GraduationCapIcon, LifeBuoyIcon, ScaleIcon, UserPlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { DocImage } from "./doc-image";
import { PURCHASE_DOCS } from "./docs.purchases";
import { PRACTICE_DOCS } from "./docs.practice";

export interface DocEntry {
  id: string;
  title: string;
  summary?: string;
  content: ReactNode;
}

export interface DocGroup {
  title: string;
  items: DocEntry[];
}

export interface DocSource {
  href: string;
  label: string;
}

export interface DocCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  source?: DocSource;
  groups: DocGroup[];
}

export const DOCS: DocCategory[] = [
  {
    id: "bot",
    title: "BOT MAX",
    icon: BotIcon,
    groups: [
      {
        title: "Документы",
        items: [
          {
            id: "bot-privacy",
            title: "Политика конфиденциальности",
            content: (
              <p>
                Настоящая политика определяет порядок обработки и защиты
                персональных данных пользователей платформы в соответствии с
                требованиями законодательства о персональных данных.
              </p>
            ),
          },
        ],
      },
    ],
  },
  {
    id: "staff",
    title: "Сотрудникам",
    icon: BriefcaseIcon,
    groups: [
      {
        title: "Единый вход (SSO)",
        items: [
          {
            id: "staff-sso-guide",
            title: "Как войти в рабочую почту — подробная инструкция",
            summary: "Каждый шаг: что видно на экране, куда нажать, что напечатать",
            content: (
              <>
                <p>
                  Эта инструкция — для входа в <strong>рабочую почту Яндекс&nbsp;360</strong>{" "}
                  (и другие рабочие сервисы — принцип тот же). Делайте всё{" "}
                  <strong>по порядку</strong>, не пропуская шаги. Если что-то на
                  экране выглядит не так, как описано, — остановитесь и позвоните в
                  IT-отдел.
                </p>

                <div className="wrapper-card">
                  <p className="font-medium">Быстрый способ</p>
                  <p>
                    Страницу входа можно открыть сразу одной кнопкой — тогда
                    Шаги 2–4 не понадобятся:
                  </p>
                  <Button asChild size="lg" className="mt-1">
                    <a href="https://360.yandex.ru" target="_blank" rel="noreferrer">
                      Открыть Яндекс&nbsp;360
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                </div>

                <h4 className="h4">Шаг 1. Проверьте, что вы знаете свой логин и пароль</h4>
                <p>
                  Нужны <strong>рабочие (доменные)</strong> логин и пароль — <u>те же
                  самые</u>, которыми вы включаете рабочий компьютер утром.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Логин</strong> — короткое имя латинскими буквами, обычно
                    фамилия и инициалы: <strong>ivanov_ii</strong>. Если не помните —
                    посмотрите на экране входа в компьютер (там подписано имя
                    пользователя) или спросите в IT-отделе.
                  </li>
                  <li>
                    <strong>Пароль</strong> — тот же, что вводите при входе в
                    компьютер. Это <u>не</u> пароль от вашего личного Яндекса и{" "}
                    <u>не</u> какой-то новый пароль.
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  Забыли логин или пароль — сначала обратитесь в IT-отдел, пусть
                  сбросят. Без них войти не получится.
                </p>

                <h4 className="h4">Шаг 2. Откройте браузер</h4>
                <p>
                  Браузер — программа для интернета. Подойдёт любой:{" "}
                  <strong>Google Chrome</strong>, <strong>Яндекс&nbsp;Браузер</strong>,{" "}
                  <strong>Microsoft Edge</strong>, <strong>Mozilla Firefox</strong>.
                </p>
                <p>
                  <strong>Что делать:</strong> найдите значок браузера на рабочем столе
                  (главный экран компьютера) или в полосе значков внизу экрана и
                  дважды щёлкните по нему левой кнопкой мыши. Откроется окно браузера.
                </p>

                <h4 className="h4">Шаг 3. Перейдите на страницу почты Яндекса</h4>
                <p>
                  <strong>Что на экране:</strong> вверху окна браузера есть длинная
                  белая строка — это <strong>адресная строка</strong> (в ней написан
                  адрес сайта, например <span className="text-muted-foreground">yandex.ru</span>).
                </p>
                <p>
                  <strong>Что делать:</strong>
                </p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Щёлкните левой кнопкой мыши один раз по адресной строке — весь текст в ней выделится синим.</li>
                  <li>
                    Напечатайте с клавиатуры: <strong>mail.yandex.ru</strong>{" "}
                    (маленькими буквами, без пробелов, точки как показано).
                  </li>
                  <li>
                    Нажмите на клавиатуре клавишу <strong>Enter</strong> (большая
                    клавиша справа от букв).
                  </li>
                </ol>
                <p>Откроется страница Яндекс&nbsp;Почты.</p>

                <h4 className="h4">Шаг 4. Нажмите кнопку «Войти»</h4>
                <p>
                  <strong>Что на экране:</strong> страница Яндекса. В{" "}
                  <strong>правом верхнем углу</strong> — кнопка <strong>«Войти»</strong>{" "}
                  (рядом может быть оранжевая кнопка «Подключить» — она не нужна).
                </p>
                <p>
                  <strong>Что делать:</strong> щёлкните по кнопке <strong>«Войти»</strong>{" "}
                  левой кнопкой мыши один раз.
                </p>
                <DocImage
                  n={1}
                  alt="Главная страница Яндекс 360, стрелка указывает на кнопку «Войти» в правом верхнем углу рядом с кнопкой «Подключить»"
                  caption="Шаг 4. Кнопка «Войти» — в правом верхнем углу страницы"
                />

                <h4 className="h4">Шаг 5. Введите АДРЕС рабочей почты (с @fesmu.ru)</h4>
                <p>
                  <strong>Что на экране:</strong> тёмная карточка{" "}
                  <strong>«Войдите с ID»</strong>, переключатель{" "}
                  <strong>«Почта / Телефон»</strong> (оставьте <strong>«Почта»</strong>)
                  и поле <strong>«Логин или email»</strong>.
                </p>
                <p>
                  <strong>Что делать:</strong> напечатайте в поле <u>полный адрес</u>{" "}
                  вашей рабочей почты — <strong>с окончанием @fesmu.ru</strong>. Например:
                </p>
                <div className="wrapper-card">
                  <p className="font-medium">ivanov_ii@fesmu.ru</p>
                </div>
                <DocImage
                  n={2}
                  alt="Карточка «Войдите с ID»: вкладка «Почта», пустое поле «Логин или email». Подсказка: укажите свои инициалы + @fesmu.ru, например konoplev_rr@fesmu.ru"
                  caption="Шаг 5. В поле «Логин или email» — адрес рабочей почты полностью, с @fesmu.ru"
                />
                <p>
                  Затем нажмите кнопку <strong>«Далее»</strong> под полем.
                </p>
                <DocImage
                  n={3}
                  alt="Та же карточка: в поле введён адрес рабочей почты konoplev_rr@fesmu.ru, ниже кнопка «Далее»"
                  caption="Шаг 5. Поле заполнено — нажмите «Далее»"
                />
                <p className="text-muted-foreground">
                  Здесь <strong>@fesmu.ru нужно</strong> — по этому окончанию Яндекс
                  понимает, что вы сотрудник ДВГМУ, и отправляет вас на страницу
                  входа университета.
                </p>

                <h4 className="h4">Шаг 6. Дождитесь, пока откроется авторизационное окно университета</h4>
                <p>
                  <strong>Что на экране:</strong> через 1–2 секунды страница
                  сменится сама. Откроется <strong>окно авторизации</strong>{" "}
                  по центру экрана. На ней написано:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>крупно — <strong>«Вход»</strong></li>
                  <li>ниже серым — <strong>«Доменная учётная запись»</strong></li>
                  <li>два поля: <strong>«Логин»</strong> и <strong>«Пароль»</strong></li>
                  <li>синяя кнопка <strong>«Войти»</strong></li>
                </ul>
                <p className="font-medium">
                  Если вы видите именно это окно авторизации с надписью «Доменная
                  учётная запись» — вы на правильной странице.
                </p>
                <DocImage
                  n={4}
                  alt="Тёмная карточка «Вход» с подписью «Доменная учётная запись», поля «Логин» (заполнено konoplev_rr, без @fesmu.ru) и «Пароль», синяя кнопка «Войти». Подсказки: логин без @fesmu.ru, пароль — от почты или рабочего компьютера"
                  caption="Шаг 6. Окно «Вход» университета. Дальше: логин — без @fesmu.ru (Шаг 7), пароль — рабочий (Шаг 8)"
                />
                <p className="text-muted-foreground">
                  Если вместо окна авторизации осталась обычная белая страница
                  Яндекса и она просит пароль — не вводите там ничего, закройте
                  вкладку и начните заново с Шага&nbsp;3. Возможно, вы случайно
                  вошли в личный Яндекс.
                </p>

                <h4 className="h4">Шаг 7. В поле «Логин» напечатайте ТОЛЬКО короткое имя (БЕЗ @fesmu.ru)</h4>
                <p>
                  <strong>Что делать:</strong> щёлкните мышкой по полю{" "}
                  <strong>«Логин»</strong> и напечатайте <u>только</u> ваше короткое
                  имя. Без «собаки», без точек в конце, без домена (как на картинке
                  к Шагу&nbsp;6 — там в поле «Логин» стоит <strong>konoplev_rr</strong>,
                  а не konoplev_rr@fesmu.ru).
                </p>
                <div className="wrapper-card p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>✅ Напишите так</TableHead>
                        <TableHead>❌ Так писать НЕЛЬЗЯ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>ivanov_ii</strong>
                        </TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          ivanov_ii@fesmu.ru
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>ivanov_ii</strong>
                        </TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          ivanov_ii@dvgmu.local
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>ivanov_ii</strong>
                        </TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          DVGMU\ivanov_ii
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-muted-foreground">
                  Почему без «@fesmu.ru»: на <u>этой</u> странице система добавляет
                  окончание сама. Если вы напишете его ещё раз, получится{" "}
                  <span className="text-muted-foreground">ivanov_ii@fesmu.ru@fesmu.ru</span>{" "}
                  — и вход не пройдёт.
                </p>

                <h4 className="h4">Шаг 8. В поле «Пароль» введите рабочий пароль</h4>
                <p>
                  <strong>Что делать:</strong> щёлкните по полю <strong>«Пароль»</strong>{" "}
                  и наберите ваш рабочий (доменный) пароль — тот же, что для входа в
                  компьютер.
                </p>
                <h4 className="h4">Шаг 9. Нажмите синюю кнопку «Войти»</h4>
                <p>
                  <strong>Что делать:</strong> щёлкните по синей кнопке{" "}
                  <strong>«Войти»</strong> внизу карточки один раз и подождите.
                </p>
                <p>
                  Ваш логин и пароль проверятся на сервере университета. Это занимает
                  1–3 секунды. Пароль <strong>нигде не сохраняется</strong> — ни на
                  этой странице, ни в Яндексе.
                </p>

                <h4 className="h4">Шаг 10. Готово — вы в почте</h4>
                <p>
                  Тёмное окно закроется, и вы окажетесь <strong>внутри рабочей
                  почты</strong>: слева список папок («Входящие», «Отправленные»…),
                  справа — письма. Это значит, что вход выполнен.
                </p>
                <p>
                  Проверить, что вы вошли под <u>рабочей</u> учётной записью: нажмите
                  на кружок с аватаром в <strong>правом верхнем углу</strong> — во
                  всплывающем меню будет ваша фамилия и адрес{" "}
                  <strong>…@fesmu.ru</strong>.
                </p>
                <DocImage
                  n={5}
                  alt="Меню аккаунта Яндекс 360 в правом верхнем углу: фамилия сотрудника, адрес рабочей почты …@fesmu.ru, пункты «Почта», «Диск», «Справка», «Поддержка», «Выйти»"
                  caption="Шаг 10. Клик по аватару справа вверху: здесь видно рабочий адрес и кнопка «Выйти»"
                />

                <h4 className="h4">Что будет дальше</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>В течение рабочего дня</strong> при открытии других
                    рабочих сервисов (диск, календарь) пароль спрашивать не будут —
                    вход произойдёт сам.
                  </li>
                  <li>
                    <strong>На следующий день</strong> или после перезагрузки
                    компьютера, возможно, попросят войти снова — повторите с Шага&nbsp;2.
                  </li>
                  <li>
                    <strong>Чтобы выйти</strong> (например, если за компьютером
                    работает несколько человек): нажмите на кружок с аватаром в
                    правом верхнем углу → <strong>«Выйти»</strong> (см. картинку к
                    Шагу&nbsp;10).
                  </li>
                </ul>

                <h4 className="h4">Ничего не помогло — оставьте заявку в Help Desk</h4>
                <p>
                  Обязательно укажите <strong>ФИО</strong> и{" "}
                  <strong>номер кабинета</strong> — по логину не всегда можно
                  однозначно найти сотрудника. Текст заявки можно скопировать и
                  просто дополнить своими данными:
                </p>
                <div className="wrapper-card">
                  <p className="font-medium">
                    Не могу авторизоваться в Яндекс&nbsp;360.
                    <br />
                    ФИО: Иванов Иван Иванович
                    <br />
                    Кабинет: 305
                  </p>
                </div>
                <Button asChild size="lg" className="mt-1">
                  <a href="https://hd.fesmu.ru" target="_blank" rel="noreferrer">
                    <LifeBuoyIcon />
                    Открыть Help Desk
                  </a>
                </Button>
              </>
            ),
          },
          {
            id: "staff-sso-problems",
            title: "Не получается войти — что делать",
            summary: "Частые ошибки по шагам и что написать в IT-отдел",
            content: (
              <>
                <p>
                  Найдите свою ситуацию в таблице и выполните, что указано. Если не
                  помогло — напишите в IT-отдел (что именно сообщить — в конце
                  страницы).
                </p>

                <div className="wrapper-card p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Что происходит</TableHead>
                        <TableHead>Что делать</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>Шаг&nbsp;5–6.</strong> Вместо окна авторизации
                          «Доменная учётная запись» осталась обычная белая страница
                          Яндекса и просит пароль
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          Вы вводите личный Яндекс, а не рабочий. Закройте вкладку,
                          начните заново с Шага&nbsp;3 и на Шаге&nbsp;5 впишите адрес{" "}
                          <strong>с @fesmu.ru</strong>.
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>Шаг&nbsp;9.</strong> «Неверный логин или пароль»
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          В поле «Логин» — только короткое имя{" "}
                          <strong>без @fesmu.ru</strong> (Шаг&nbsp;7). Проверьте
                          раскладку и <strong>Caps&nbsp;Lock</strong>. Пароль — тот
                          же, что для входа в компьютер. Недавно меняли пароль —
                          подождите 5–10&nbsp;минут. Много раз ошиблись подряд —
                          учётка могла временно заблокироваться, подождите
                          ~30&nbsp;минут.
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>Шаг&nbsp;9.</strong> «Сервис аутентификации
                          временно недоступен»
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          Чаще всего у учётной записи не заполнен рабочий e-mail.
                          Заявка в IT-отдел: «прошу добавить рабочую почту (атрибут
                          mail) для учётной записи <strong>ivanov_ii</strong>». Если
                          то же самое у коллег — это временный сбой, попробуйте позже.
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>После Шага&nbsp;9.</strong> Вход прошёл, но Яндекс
                          пишет «пользователь не найден» / «нет доступа к организации»
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          Вас ещё не завели в организацию Яндекс&nbsp;360 либо адрес в
                          Яндексе отличается от рабочей почты. Заявка в IT-отдел с
                          логином и ФИО.
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>Шаг&nbsp;4.</strong> Сразу открывается чужой аккаунт,
                          окно входа не появляется
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          На компьютере сохранён чужой вход. Откройте приватное окно
                          браузера (<strong>Ctrl+Shift+N</strong> в Chrome,{" "}
                          <strong>Ctrl+Shift+P</strong> в Firefox) и войдите там; либо
                          выйдите из чужого аккаунта (аватар справа вверху →
                          «Выйти»).
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <strong>Шаг&nbsp;6.</strong> Страница не открывается / «не
                          удаётся соединиться»
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          Проверьте интернет. Если у коллег тоже не открывается —
                          сообщите в IT-отдел, проблема на стороне сервиса.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <h4 className="h4">Что сообщить в IT-отдел</h4>
                <p>Чтобы заявку обработали быстрее, укажите сразу всё:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>рабочий логин (например, <strong>ivanov_ii</strong>) и ФИО</li>
                  <li>на каком <strong>шаге</strong> инструкции появилась ошибка</li>
                  <li>
                    <strong>точный текст ошибки</strong> — лучше скриншот всего экрана
                  </li>
                  <li>дата и время попытки</li>
                  <li>
                    что уже пробовали (сменить браузер, приватное окно, подождать)
                  </li>
                </ul>

                <h4 className="h4">Ничего не помогло — оставьте заявку в Help Desk</h4>
                <p>
                  Обязательно укажите <strong>ФИО</strong> и{" "}
                  <strong>номер кабинета</strong> — по логину не всегда можно
                  однозначно найти сотрудника. Текст заявки можно скопировать и
                  просто дополнить своими данными:
                </p>
                <div className="wrapper-card">
                  <p className="font-medium">
                    Не могу авторизоваться в Яндекс&nbsp;360.
                    <br />
                    ФИО: Иванов Иван Иванович
                    <br />
                    Кабинет: 305
                  </p>
                </div>
                <Button asChild size="lg" className="mt-1">
                  <a href="https://hd.fesmu.ru" target="_blank" rel="noreferrer">
                    <LifeBuoyIcon />
                    Открыть Help Desk
                  </a>
                </Button>
              </>
            ),
          },
        ],
      },
    ],
  },
  PURCHASE_DOCS,
  {
    id: "surveys",
    title: "Опросы (аналитика)",
    icon: ClipboardListIcon,
    groups: [
      {
        title: "Как это работает",
        items: [
          {
            id: "surveys-overview",
            title: "Что такое опрос и зачем он",
            summary: "Короткие анонимные анкеты по QR-коду. Общая картина",
            content: (
              <>
                <p>
                  <strong>Опрос</strong> — это короткая анонимная анкета, которую
                  сотрудник заполняет с телефона, отсканировав <strong>QR-код</strong>{" "}
                  (наклейка на рабочем месте, в кабинете, у туалета или в лекционном
                  зале). Каждой точке и теме соответствует свой номер QR.
                </p>
                <p>
                  Опрос нужен, чтобы регулярно и без бумаги собирать оценку условий:
                  насколько человек обеспечен всем необходимым для работы, как он
                  оценивает рабочее место, состояние помещений, информационную
                  безопасность. По этим ответам строится статистика по подразделениям.
                </p>
                <h4 className="h4">Три роли</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Респондент</strong> — любой сотрудник. Сканирует QR,
                    отвечает на несколько экранов, отправляет. Данные анонимны.
                  </li>
                  <li>
                    <strong>Администратор</strong> — создаёт опросы и печатает QR
                    (раздел «Аналитика»), смотрит сводку и выгрузку по полям.
                  </li>
                  <li>
                    <strong>Система</strong> — принимает ответы, хранит их в
                    сервисе аналитики и считает средние, проценты и распределения.
                  </li>
                </ul>
              </>
            ),
          },
          {
            id: "surveys-respondent",
            title: "Как пройти опрос (для сотрудника)",
            summary: "Пошагово: от сканирования QR до экрана «Спасибо»",
            content: (
              <>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    Наведите камеру телефона на <strong>QR-код</strong>. Откроется
                    страница опроса — отдельная, вход в личный кабинет не нужен.
                  </li>
                  <li>
                    Вверху — название точки/темы и краткое пояснение. Ниже —{" "}
                    <strong>вопросы по одному экрану за раз</strong>.
                  </li>
                  <li>
                    Отвечайте: оценка по шкале (кнопки&nbsp;1–5), «Да/Нет», выбор из
                    списка или короткий текст. Кнопкой <strong>«Далее&nbsp;→»</strong>{" "}
                    переходите вперёд, <strong>«←&nbsp;Назад»</strong> — исправить.
                    Точки внизу показывают прогресс.
                  </li>
                  <li>
                    Часть опросов просит указать <strong>отдел и кабинет</strong> —
                    это нужно, чтобы отнести оценку к подразделению, ФИО в статистику
                    не выводится.
                  </li>
                  <li>
                    На последнем экране можно оставить <strong>комментарий</strong>{" "}
                    (необязательно) и нажать <strong>«📤 Отправить»</strong>.
                  </li>
                  <li>
                    Появится экран <strong>«Спасибо за ваш отзыв!»</strong> — ответ
                    записан. Пройти повторно можно, отсканировав QR снова.
                  </li>
                </ol>
                <p className="text-muted-foreground">
                  Если вместо опроса видите «Опросник не найден или недоступен» —
                  QR устарел или опрос отключён; сообщите тому, кто вешал наклейку.
                </p>
              </>
            ),
          },
          {
            id: "surveys-admin",
            title: "Создание опроса и печать QR (для администратора)",
            summary: "Раздел «Аналитика»: создать объект, распечатать QR, смотреть сводку",
            content: (
              <>
                <h4 className="h4">Создать опрос</h4>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>
                    Меню <strong>«Аналитика»</strong> → раздел с объектами опросов
                    (Рабочие места / Объекты&nbsp;v2).
                  </li>
                  <li>
                    Добавьте объект: задайте <strong>тип</strong> (он определяет
                    набор вопросов), название точки и краткое описание.
                  </li>
                  <li>
                    Система присвоит объекту <strong>номер QR</strong>. Ссылка
                    опроса — <code>/analytic?qr=&lt;номер&gt;</code>.
                  </li>
                  <li>
                    Кнопка печати сформирует <strong>QR-наклейку</strong> —
                    распечатайте и разместите на точке.
                  </li>
                </ol>
                <h4 className="h4">Смотреть результаты</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>«Выгрузка по полям (v3)»</strong> — список опросов с
                    краткой статистикой; по клику — детальная страница: среднее и
                    распределение по каждому вопросу, список опрошенных, комментарии.
                  </li>
                  <li>
                    Набор полей и метрик в выгрузке зависит от типа опроса.
                  </li>
                </ul>
              </>
            ),
          },
        ],
      },
      {
        title: "Данные и типы",
        items: [
          {
            id: "surveys-data",
            title: "Что собирается и где хранится",
            summary: "Состав ответа, анонимность, куда уходят данные",
            content: (
              <>
                <h4 className="h4">Что попадает в один ответ</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>оценки по шкале, ответы «Да/Нет», выбор из списков, тексты — по вопросам конкретного типа опроса;</li>
                  <li>служебные поля привязки — отдел, кабинет (в тех опросах, где они есть);</li>
                  <li>необязательный комментарий;</li>
                  <li>дата и время отправки.</li>
                </ul>
                <h4 className="h4">Анонимность</h4>
                <p>
                  Опрос не требует авторизации и не сохраняет, кто именно его
                  прошёл. В статистике видны агрегаты (среднее, проценты,
                  распределения) и отдельные ответы без привязки к личности
                  сотрудника.
                </p>
                <h4 className="h4">Хранение</h4>
                <p>
                  Ответы уходят в <strong>отдельный сервис аналитики</strong> (не в
                  основную базу портала). Портал только показывает сводку, обращаясь
                  к этому сервису.
                </p>
              </>
            ),
          },
          {
            id: "surveys-types",
            title: "Типы опросов и их QR",
            summary: "Пять тем: рабочее место, ИБ, техснабжение, туалеты, лекционный зал",
            content: (
              <div className="wrapper-card p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Тип</TableHead>
                      <TableHead>О чём</TableHead>
                      <TableHead>QR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="whitespace-normal"><strong>Рабочее место</strong></TableCell>
                      <TableCell className="whitespace-normal">Оценка рабочего пространства и оснащения</TableCell>
                      <TableCell>66</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="whitespace-normal"><strong>Информационная безопасность</strong></TableCell>
                      <TableCell className="whitespace-normal">Анкета для сотрудников по ИБ</TableCell>
                      <TableCell>77</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="whitespace-normal"><strong>Техническое снабжение</strong></TableCell>
                      <TableCell className="whitespace-normal">Обеспеченность ресурсами и условиями для работы</TableCell>
                      <TableCell>44</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="whitespace-normal"><strong>Туалеты</strong></TableCell>
                      <TableCell className="whitespace-normal">Чистота, запах, наличие бумаги и мыла</TableCell>
                      <TableCell className="text-muted-foreground">свой на точку</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="whitespace-normal"><strong>Лекционный зал</strong></TableCell>
                      <TableCell className="whitespace-normal">Комфорт и оснащение зала</TableCell>
                      <TableCell className="text-muted-foreground">свой на точку</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ),
          },
        ],
      },
    ],
  },
  {
    id: "students",
    title: "Студентам",
    icon: GraduationCapIcon,
    groups: [
      {
        title: "Учебный процесс",
        items: [
          {
            id: "attendance",
            title: "Правила посещения занятий",
            summary: "Порядок посещения и отработки пропущенных занятий",
            content: (
              <>
                <p>
                  Посещение учебных занятий является обязательным для всех
                  студентов очной формы обучения. Пропуски занятий
                  фиксируются старостой группы и передаются в деканат.
                </p>
                <h4 className="h4">Уважительные причины пропуска</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Временная нетрудоспособность (по справке)</li>
                  <li>Участие в мероприятиях университета</li>
                  <li>Семейные обстоятельства (по согласованию с деканатом)</li>
                </ul>
                <p>
                  Пропущенные занятия подлежат отработке в порядке,
                  установленном кафедрой, в течение двух недель с момента
                  выхода на занятия.
                </p>
              </>
            ),
          },
          {
            id: "academic-cert",
            title: "Академические справки",
            summary: "Как оформить академическую справку и на что она влияет",
            content: (
              <>
                <p>
                  Академическая справка выдаётся студентам, отчисленным до
                  завершения обучения, а также по личному заявлению
                  обучающегося.
                </p>
                <h4 className="h4">Как оформить</h4>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Подать заявление в деканат</li>
                  <li>Закрыть задолженности по дисциплинам</li>
                  <li>Получить справку в течение 10 рабочих дней</li>
                </ol>
              </>
            ),
          },
        ],
      },
      {
        title: "Права и обязанности",
        items: [
          {
            id: "student-rights",
            title: "Права студента",
            content: (
              <ul className="list-disc pl-5 space-y-1">
                <li>Участвовать в формировании содержания образования</li>
                <li>Получать стипендию в порядке, установленном законом</li>
                <li>Пользоваться библиотекой и учебной инфраструктурой</li>
                <li>Обжаловать решения администрации в установленном порядке</li>
              </ul>
            ),
          },
          {
            id: "student-duties",
            title: "Обязанности студента",
            content: (
              <ul className="list-disc pl-5 space-y-1">
                <li>Добросовестно осваивать образовательную программу</li>
                <li>Соблюдать устав и правила внутреннего распорядка</li>
                <li>Бережно относиться к имуществу университета</li>
                <li>Уважать честь и достоинство других участников процесса</li>
              </ul>
            ),
          },
        ],
      },
    ],
  },
  PRACTICE_DOCS,
  {
    id: "dormitory",
    title: "Общежитие",
    icon: BuildingIcon,
    source: {
      href: "/docs/files/dormitory_rules_2026.pdf",
      label: "Положение об общежитиях ДВГМУ (PDF, утв. 25.02.2025)",
    },
    groups: [
      {
        title: "Заселение и выселение",
        items: [
          {
            id: "dorm-checkin",
            title: "Порядок заселения",
            summary: "Документы, сроки и шаги для заселения в общежитие",
            content: (
              <>
                <p>
                  Заселение производится на основании приказа ректора,
                  личного заявления обучающегося и договора найма жилого
                  помещения в студенческом общежитии. Жилая комната
                  закрепляется за проживающим на весь учебный год, из
                  расчёта не менее 6 м² на человека (ЖК РФ).
                </p>
                <h4 className="h4">Сроки подачи заявления</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Студенты 2–6 курсов подают заявление декану факультета
                    ежегодно до 1 апреля
                  </li>
                  <li>
                    Студенты 1 курса — сразу после приказа о зачислении, но
                    не позднее 22 августа текущего года (лично, каб. №108
                    учебного корпуса №1, либо на a_posel@mail.fesmu.ru)
                  </li>
                  <li>
                    Заявления, поданные позже срока, рассматриваются
                    комиссией по поселению по мере поступления, но не
                    ранее 10 сентября, при наличии свободных мест
                  </li>
                </ul>
                <h4 className="h4">Необходимые документы</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Паспорт</li>
                  <li>Медицинская справка по итогам медосмотра (форма 086/у)</li>
                  <li>Квитанция об оплате за проживание</li>
                  <li>Договор найма жилого помещения — 2 экземпляра</li>
                  <li>Фотография</li>
                </ul>
                <p>
                  Медосмотр проходит в консультативно-диагностической
                  клинике ДВГМУ. Документы передаются заместителю
                  начальника хозяйственного отдела, который определяет
                  номер общежития и комнаты и выписывает пропуск. Заселение
                  считается завершённым после подписания договора найма и
                  оформления регистрации по месту временного пребывания —
                  в течение месяца со дня выдачи документов на поселение
                  (для ранее проживавших в общежитиях ДВГМУ — не позднее
                  10 октября текущего года).
                </p>
                <h4 className="h4">Сроки распределения мест</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Бюджетникам и целевикам 2–6 курсов места предоставляются
                    деканами факультетов до 10 июля
                  </li>
                  <li>Студентам 1 курса — до 10 сентября</li>
                  <li>
                    Договорники 3–6 курсов претендуют на оставшиеся места
                    на конкурсной основе через комиссию по поселению
                  </li>
                  <li>
                    Договорники 1–2 курсов рассматриваются комиссией на
                    конкурсной основе с 1 октября
                  </li>
                </ul>
                <p>
                  Студенты, успешно сдавшие сессию, оформляют проживание на
                  новый учебный год до отъезда на каникулы. Тем, кто не
                  оформил документы на новый год в срок, место в общежитии
                  не предоставляется (за исключением уважительных причин).
                </p>
              </>
            ),
          },
          {
            id: "dorm-priority",
            title: "Льготное и первоочередное заселение",
            summary: "Кому место в общежитии предоставляется без очереди",
            content: (
              <>
                <p>
                  Бесплатно и в первоочередном порядке (ч. 5 ст. 36 ФЗ «Об
                  образовании в РФ») места предоставляются студентам,
                  относящимся к следующим категориям:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Дети-сироты и дети, оставшиеся без попечения родителей</li>
                  <li>Инвалиды I и II групп, инвалиды с детства</li>
                  <li>
                    Пострадавшие вследствие катастрофы на Чернобыльской АЭС,
                    иных радиационных катастроф и ядерных испытаний на
                    Семипалатинском полигоне
                  </li>
                  <li>
                    Инвалиды вследствие военной травмы или заболевания,
                    полученных на военной службе, и ветераны боевых действий
                  </li>
                  <li>
                    Проходившие не менее трёх лет военную службу по
                    контракту и уволенные по установленным законом
                    основаниям
                  </li>
                  <li>
                    Вынужденно покинувшие территории с режимом чрезвычайной
                    ситуации
                  </li>
                </ul>
                <p>
                  В обязательном порядке заселяются студенты 1 курса,
                  обучающиеся по целевому набору от Хабаровского края и
                  других регионов ДВФО.
                </p>
                <p>
                  Остальные места среди студентов 2–6 курсов распределяются
                  деканами на конкурсной основе по совокупности критериев:
                  степень нуждаемости, отсутствие замечаний по соблюдению
                  Правил внутреннего распорядка, санитарных норм, техники
                  безопасности и пропускного режима, добросовестное
                  выполнение обязанностей дежурного, сохранность имущества
                  и своевременность оплаты. Об отказе в месте деканы
                  информируют не позднее 10 июля текущего года.
                </p>
              </>
            ),
          },
          {
            id: "dorm-checkout",
            title: "Порядок выселения",
            summary: "Основания для выселения и что нужно сдать при выезде",
            content: (
              <>
                <p>
                  Выселение из общежитий ДВГМУ производится в соответствии
                  с жилищным законодательством РФ на основании приказов об
                  отчислении, специальных распоряжений ректора и решений
                  комиссии по поселению. Основания для выселения
                  распространяются на всех проживающих независимо от
                  статуса.
                </p>
                <h4 className="h4">Основания для выселения</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Отчисление или окончание обучения — в трёхдневный срок
                    со дня выхода приказа (ст. 105 ЖК РФ)
                  </li>
                  <li>
                    Расторжение трудового договора — для сотрудников,
                    поселившихся в общежитие, без предоставления другого жилья
                  </li>
                  <li>
                    Систематическое невнесение платы за проживание — более
                    2 месяцев (п. 2 ст. 687 ГК РФ)
                  </li>
                  <li>
                    Систематическая порча жилого помещения, использование
                    его не по назначению либо нарушения, делающие
                    невозможным совместное проживание с другими (п. 4
                    ст. 83 ЖК РФ)
                  </li>
                  <li>
                    Грубое нарушение Правил внутреннего распорядка, техники
                    безопасности и пожарной безопасности, антисанитарное
                    состояние комнаты
                  </li>
                  <li>
                    Абитуриенты, получившие неудовлетворительную оценку на
                    экзаменах, — в течение 3 дней после объявления
                    результатов
                  </li>
                  <li>
                    Абитуриенты, не прошедшие по конкурсу, — в течение 3
                    дней после приказа о зачислении
                  </li>
                  <li>
                    Поселившиеся, но не проживающие более месяца без
                    уважительной причины
                  </li>
                  <li>
                    Иностранные студенты, оформившие регистрацию не по
                    юридическому адресу общежития ДВГМУ
                  </li>
                </ul>
                <h4 className="h4">Что нужно сделать при выезде</h4>
                <p>Выселение считается завершённым после:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Предъявления квитанции об оплате за прожитый период</li>
                  <li>Закрытия карточки учёта постельного белья</li>
                  <li>Возмещения ущерба при недостаче или порче имущества</li>
                  <li>Сдачи ключей от занимаемой комнаты коменданту хозяйственного отдела</li>
                </ul>
                <p>
                  Спорные ситуации по выселению решаются на заседании
                  комиссии по поселению в присутствии проживающего, с
                  ведением протокола.
                </p>
              </>
            ),
          },
        ],
      },
      {
        title: "Проживание",
        items: [
          {
            id: "dorm-rules",
            title: "Внутренний распорядок",
            summary: "Что можно и что категорически запрещено в общежитии",
            content: (
              <>
                <p>Проживающие в общежитии обязаны:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Строго соблюдать условия договора найма, Правила
                    внутреннего распорядка, технику безопасности и
                    пожарную безопасность
                  </li>
                  <li>Бережно относиться к помещениям, оборудованию и инвентарю</li>
                  <li>Экономно расходовать электроэнергию, газ и воду</li>
                  <li>
                    Соблюдать чистоту в жилых помещениях и местах общего
                    пользования, ежедневно убирать свою комнату
                  </li>
                  <li>
                    Участвовать в работах по самообслуживанию, генеральных
                    уборках и дежурстве по этажу согласно графику
                  </li>
                  <li>
                    Получить регистрацию по месту временного пребывания в
                    течение месяца со дня заселения (ранее проживавшим —
                    не позднее 10 октября)
                  </li>
                </ul>
                <h4 className="h4">Разрешённая техника</h4>
                <p>
                  Для эксплуатации разрешены только малогабаритные
                  электроприборы: холодильник, телевизор, компьютер —
                  постоянно; электрочайник с автоотключением, электроутюг,
                  настольная лампа, пылесос — с разрешения коменданта.
                </p>
                <h4 className="h4">Проживающим категорически запрещается</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Вмешиваться в работу систем энергообеспечения,
                    самостоятельно ремонтировать проводку и розетки,
                    размещать удлинители на полу и под коврами
                  </li>
                  <li>
                    Использовать открытый огонь (пиротехника, свечи,
                    кальян), электрогирлянды
                  </li>
                  <li>
                    Использовать в жилых комнатах электронагревательные
                    приборы для приготовления пищи и обогрева
                  </li>
                  <li>
                    Отрывать, демонтировать датчики пожарной сигнализации,
                    закрывать их посторонними предметами или иным образом
                    нарушать их работу
                  </li>
                  <li>
                    Курить, в том числе электронные сигареты, вейпы и
                    кальяны — в комнатах, на балконах и в местах общего
                    пользования
                  </li>
                  <li>
                    Приносить, хранить, продавать и употреблять спиртные
                    напитки, наркотические и психотропные вещества;
                    появляться в опьянении
                  </li>
                  <li>
                    Хранить оружие (в т.ч. травматическое, пневматическое)
                    и предметы, имитирующие его
                  </li>
                  <li>
                    Незаконно проводить посторонних лиц и оставлять их на
                    ночь, передавать своё место другим лицам
                  </li>
                  <li>
                    Самовольно переселяться, переустраивать или
                    перепланировать помещение, содержать животных
                  </li>
                  <li>
                    Превышать громкость музыки и звуковой аппаратуры в
                    ночное время — с 22:00 до 08:00
                  </li>
                  <li>Заниматься коммерческой деятельностью, ставить личный автомобиль на парковку у общежития</li>
                  <li>Подделывать пропуска и другие документы общежития</li>
                </ul>
              </>
            ),
          },
          {
            id: "dorm-access",
            title: "Пропускной режим",
            summary: "Часы входа-выхода и правила посещения гостей",
            content: (
              <>
                <p>
                  Доступ в общежитие осуществляется через вахту по
                  пропускам, здание находится под круглосуточной охраной.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    С 6:00 до 24:00 вход и выход проживающих не ограничены —
                    по предъявлению пропуска на вахте
                  </li>
                  <li>
                    С 00:00 до 6:00 входные двери закрыты, проход — только
                    для жильцов общежития, с записью в журнале посещений
                  </li>
                  <li>
                    Посещение общежития лицами, не проживающими в нём,
                    возможно с 6:00 до 23:00 только в сопровождении жильца,
                    к которому прибыл посетитель
                  </li>
                  <li>
                    Вход посторонним — по документу, удостоверяющему
                    личность, с записью в журнале для посетителей (данные
                    документа, номер комнаты, время посещения)
                  </li>
                </ul>
                <p>
                  На период экзаменационных сессий, эпидемий и капитальных
                  ремонтов распоряжением по университету могут вводиться
                  ограничения на допуск гостей и посторонних посетителей.
                  При проведении праздничных вечеров время посещения может
                  быть изменено или продлено.
                </p>
              </>
            ),
          },
          {
            id: "dorm-payment",
            title: "Оплата проживания",
            summary: "Из чего складывается плата и как оплатить каникулы",
            content: (
              <>
                <p>
                  Плата за пользование жилой площадью, коммунальными
                  услугами (водоснабжение, газ, электроэнергия, тепловая
                  энергия) и другими услугами взимается по расценкам,
                  утверждённым ректором на основании действующего
                  законодательства и тарифов.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Оплата вносится с момента заключения договора найма</li>
                  <li>
                    Ежемесячно — до 10 числа месяца, следующего за истёкшим
                  </li>
                  <li>
                    По согласованию с администрацией по поселению возможна
                    предварительная оплата
                  </li>
                  <li>Плата взимается за время фактического проживания и период каникул</li>
                </ul>
                <h4 className="h4">При отъезде на каникулы</h4>
                <p>
                  Если не хотите платить за место во время каникул, нужно:
                  написать заявление, освободить место, вывезти личные
                  вещи и сдать коменданту хозяйственного отдела имущество,
                  инвентарь, постельные принадлежности и ключи.
                </p>
                <p>
                  Оплата за проживание в период летних каникул или
                  временного отсутствия более 5 суток производится без
                  начисления коммунальных услуг только при наличии
                  проездных документов или справок, подтверждающих
                  отсутствие. Справки предоставляются не позднее месяца со
                  дня окончания отсутствия; перерасчёт — только с
                  разрешения ректора на основании заявления.
                </p>
              </>
            ),
          },
        ],
      },
      {
        title: "Права, обязанности и самоуправление",
        items: [
          {
            id: "dorm-rights",
            title: "Права проживающего",
            content: (
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Пользоваться местом в общежитии, помещениями
                  культурно-бытового назначения, оборудованием и
                  коммунально-бытовыми услугами весь срок обучения при
                  соблюдении Правил внутреннего распорядка
                </li>
                <li>
                  На своевременную замену пришедшего в негодность
                  оборудования, мебели и постельных принадлежностей
                </li>
                <li>Избирать студенческий совет общежития и быть избранным в его состав</li>
                <li>Обращаться к коменданту хозяйственного отдела для решения разногласий</li>
                <li>
                  Принимать гостей в установленное Правилами внутреннего
                  распорядка время
                </li>
                <li>
                  Переселяться в другое жилое помещение общежития с
                  согласия администрации и по решению студенческого совета
                </li>
                <li>
                  С письменного разрешения коменданта — за свой счёт
                  проводить косметический ремонт занимаемой комнаты и
                  пользоваться личной мебелью и приборами
                </li>
                <li>Вносить администрации предложения об изменении договора найма</li>
              </ul>
            ),
          },
          {
            id: "dorm-penalties",
            title: "Поощрения и взыскания",
            content: (
              <>
                <p>
                  Проживающие, добросовестно выполняющие Правила и активно
                  участвующие в общественной работе, могут быть поощрены:
                  предоставлением лучших условий проживания или
                  объявлением благодарности.
                </p>
                <h4 className="h4">Меры взыскания за нарушения</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Замечание</li>
                  <li>Выговор</li>
                  <li>Выговор с занесением в личное дело</li>
                  <li>Лишение права на поселение в следующем учебном году</li>
                  <li>
                    Привлечение к материальной ответственности за
                    причинённый ущерб — в размере ущерба, согласно договору
                    найма
                  </li>
                  <li>
                    За неоднократные и грубые нарушения (драки, появление в
                    нетрезвом виде, нарушение техники безопасности и
                    пожарной безопасности) — вплоть до выселения
                  </li>
                </ul>
                <p>
                  За курение в общежитии, а также за оборот спиртного,
                  наркотиков и подделку документов на нарушителя
                  составляется акт комиссией не менее чем из 3 человек;
                  нарушитель приглашается на заседание комиссии, в
                  компетенции которой — рассмотрение вопроса о выселении.
                  По письменному заявлению нарушителя взыскание может быть
                  заменено на общественно-полезные работы по согласованию
                  со студенческим советом.
                </p>
              </>
            ),
          },
          {
            id: "dorm-council",
            title: "Студенческий совет общежития",
            summary: "Самоуправление, старосты этажей и дежурство",
            content: (
              <>
                <p>
                  В каждом общежитии студенты избирают на общем собрании
                  студенческий совет — орган самоуправления, работающий
                  под руководством администрации, профкома и
                  Координационного совета студенческого самоуправления
                  (КСССУ). Из состава совета назначаются старосты этажей, а
                  в каждой комнате (секции) избирается свой староста.
                </p>
                <h4 className="h4">Чем занимается совет</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Координирует старост этажей и организует дежурство по этажам</li>
                  <li>Контролирует соблюдение Правил внутреннего распорядка</li>
                  <li>Организует работы по самообслуживанию и текущему ремонту</li>
                  <li>Проводит культурно-массовую работу и информирует проживающих</li>
                  <li>
                    Ходатайствует перед администрацией о поощрении или
                    взыскании проживающих
                  </li>
                </ul>
                <p>
                  Со студенческим советом в обязательном порядке
                  согласовываются: выселение за грубые нарушения,
                  переселение проживающих, поощрения и взыскания.
                  Комиссия в составе коменданта и не менее 3 членов
                  студсовета (в вечернее и ночное время — совместно с
                  дежурным по общежитию) вправе вскрыть комнату при
                  подозрении на нарушение техники и пожарной безопасности
                  и изъять запрещённые предметы по акту.
                </p>
                <h4 className="h4">Дежурство по этажу</h4>
                <p>
                  Ежедневно на этаже дежурят два человека из числа
                  проживающих, по графику, утверждённому куратором
                  общежития. Дежурный принимает этаж по описи, проверяет
                  средства пожарной безопасности, следит за чистотой мест
                  общего пользования и порядком посещения гостей.
                </p>
              </>
            ),
          },
        ],
      },
    ],
  },
  {
    id: "legal",
    title: "Правовые документы",
    icon: ScaleIcon,
    groups: [
      {
        title: "Документы",
        items: [
          {
            id: "privacy",
            title: "Политика конфиденциальности",
            content: (
              <div className="space-y-3">
                <p>
                  Настоящая политика определяет порядок обработки и защиты
                  персональных данных пользователей платформы в соответствии с
                  требованиями законодательства о персональных данных
                  (152-ФЗ «О персональных данных»).
                </p>
                <p>
                  Платформа хранит и обрабатывает файлы cookie (в том числе
                  сессионные — для авторизации и поддержания входа в
                  аккаунт), а также персональные данные пользователей,
                  включая паспортные данные (серия, номер, кем и когда выдан,
                  СНИЛС, адрес регистрации и проживания) и данные документов
                  об образовании — в объёме, необходимом для оформления
                  проживания в общежитии, учебных документов и иных
                  административных процедур университета.
                </p>
                <p>
                  Продолжая использовать платформу и подтверждая согласие при
                  входе в систему, пользователь даёт согласие на обработку
                  указанных персональных данных на условиях настоящей
                  политики.
                </p>
              </div>
            ),
          },
          {
            id: "terms",
            title: "Пользовательское соглашение",
            content: (
              <p>
                Используя платформу, пользователь принимает условия
                настоящего соглашения, регулирующего порядок доступа и
                использования сервиса.
              </p>
            ),
          },
          {
            id: "cookie",
            title: "Политика cookies",
            content: (
              <p>
                Платформа использует файлы cookie для обеспечения работы
                сервиса, сохранения пользовательских настроек и анализа
                использования.
              </p>
            ),
          },
          {
            id: "gdpr",
            title: "GDPR",
            content: (
              <p>
                Для пользователей из стран Европейского союза применяются
                дополнительные гарантии обработки персональных данных в
                соответствии с GDPR.
              </p>
            ),
          },
          {
            id: "disclaimer",
            title: "Отказ от ответственности",
            content: (
              <p>
                Администрация не несёт ответственности за перебои в работе
                сервиса, вызванные обстоятельствами непреодолимой силы или
                действиями третьих лиц.
              </p>
            ),
          },
        ],
      },
    ],
  },
  {
    id: "applicants",
    title: "Абитуриенты",
    icon: UserPlusIcon,
    groups: [
      {
        title: "Первокурсникам",
        items: [
          {
            id: "first-year-meetings",
            title: "Оргсобрания и учебная литература по факультетам",
            summary:
              "Даты, время и место проведения организационных собраний для первокурсников",
            content: (
              <>
                <p>
                  Поздравляем вас с зачислением в Дальневосточный
                  государственный медицинский университет! Благодарим вас и
                  ваших родителей, что выбрали наш университет — Первый
                  медицинский университет на Дальнем Востоке!
                </p>
                <p>
                  Впереди годы интересного и многогранного обучения в
                  университете, годы постижения новых знаний в области
                  здоровья человека и медицины, профилактики, диагностики и
                  лечения заболеваний.
                </p>
                <p>
                  Чтобы хорошо подготовиться к началу учебного года, просим
                  вас обратить внимание, что вам нужно сделать до 1 сентября.{" "}
                  <strong>
                    Просим внимательно прочитать и запомнить следующую
                    обязательную информацию для всех первокурсников!
                  </strong>
                </p>

                <h4 className="h4">
                  Графики организационных собраний с первокурсниками и
                  получения учебной литературы по факультетам
                </h4>
                <div className="wrapper-card p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Факультет (специальности)</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Время</TableHead>
                        <TableHead>Место проведения</TableHead>
                        <TableHead>Время получения литературы</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Лечебный (лечебное дело)
                        </TableCell>
                        <TableCell>28.08.2026</TableCell>
                        <TableCell>10:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>12:00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Педиатрический (педиатрия)
                        </TableCell>
                        <TableCell>31.08.2026</TableCell>
                        <TableCell>12:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>14:00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Стоматологический (стоматология)
                        </TableCell>
                        <TableCell>28.08.2026</TableCell>
                        <TableCell>12:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>14:00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Фармации и биомедицины (фармация, медицинская
                          биохимия)
                        </TableCell>
                        <TableCell>28.08.2026</TableCell>
                        <TableCell>14:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>15:00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Медико-гуманитарный (клиническая психология,
                          сестринское дело, социальная работа)
                        </TableCell>
                        <TableCell>28.08.2026</TableCell>
                        <TableCell>15:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>16:00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Медико-фармацевтический колледж (фармация,
                          стоматология профилактическая, стоматология
                          ортопедическая)
                        </TableCell>
                        <TableCell>31.08.2026</TableCell>
                        <TableCell>10:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>12:00</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          Ординаторы (все специальности)
                        </TableCell>
                        <TableCell>31.08.2026</TableCell>
                        <TableCell>14:00</TableCell>
                        <TableCell>Актовый зал</TableCell>
                        <TableCell>15:00</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <p>
                  <strong>Явка на оргсобрание обязательна</strong>, т.к. вас
                  познакомят с деканом и сотрудниками деканата, вы узнаете
                  вашу группу и старосту, получите пропускную карту в
                  университет.
                </p>
                <p>
                  <strong>Важно!</strong> Возьмите на оргсобрание цветные
                  фотографии 3×4 без уголка (3 экземпляра) для оформления вам
                  студенческого билета и зачётной книжки. Принесите оригинал
                  документа о среднем образовании и передайте их в ваш
                  деканат. После оргсобрания вам будет выдана в библиотеке
                  обязательная учебная литература (учебники и пособия).
                  Возьмите с собой вместительную сумку.
                </p>
              </>
            ),
          },
          {
            id: "first-year-payment",
            title: "Оплата платного обучения",
            summary:
              "Срок и порядок оплаты для зачисленных на платное обучение",
            content: (
              <p>
                Всем, рекомендованным к зачислению на платное обучение, для
                включения в приказ на зачисление необходимо оплатить{" "}
                <strong>50% стоимости обучения</strong> (от годовой суммы,
                указанной в договоре на обучение в 2026–2027 учебном году) в
                срок <strong>до 25 августа 2026</strong>. Информация о номере
                договора, лицевом счёте и квитанция на оплату размещены на
                сайте ДВГМУ в разделе «Приёмная комиссия — Платный приём» по
                вашей специальности.
              </p>
            ),
          },
          {
            id: "first-year-dormitory",
            title: "Нуждающимся в общежитии",
            summary:
              "Медосмотр, документы и сроки для поселения в общежитие",
            content: (
              <>
                <p>
                  Оформление на поселение в общежитие будет проводиться в
                  учебном центре по адресу{" "}
                  <strong>ул. Пушкина 31, кабинеты №11 и №12</strong>, после{" "}
                  <strong>20 августа 2026</strong>. Всем, кому требуется
                  общежитие, необходимо <strong>заранее</strong> пройти
                  обязательный медосмотр в консультативно-диагностической
                  поликлинике ДВГМУ по адресу: г. Хабаровск, ул. Карла
                  Маркса, 60. Время приёма: с 09 до 15 часов, ежедневно,
                  кроме субботы и воскресенья.
                </p>

                <h4 className="h4">
                  Обращаться в регистратуру поликлиники с комплектом
                  документов
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Полис ОМС</li>
                  <li>Паспорт</li>
                  <li>
                    Результаты флюорографического обследования давностью до
                    одного года
                  </li>
                  <li>
                    Результаты серологического исследования на сифилис
                    (анализ крови на RW)
                  </li>
                  <li>
                    Прививочный сертификат с обязательной отметкой о всех
                    проведённых вакцинациях согласно Национальному календарю
                    профилактических прививок
                  </li>
                </ul>
                <p>
                  Возможно предоставление справки № 086/у или СЭМД (196)
                  «Медицинская справка (врачебное профессионально-
                  консультативное заключение)» с наличием отметки о
                  прохождении флюорографии и результатами анализа крови на
                  RW в медицинских документах.
                </p>
                <p>
                  После прохождения медицинского осмотра вам выдадут
                  медицинское заключение для поселения в общежитие.{" "}
                  <strong>
                    Стоимость выдачи заключения для поселения в общежитие —
                    500 рублей.
                  </strong>
                </p>
                <p>
                  <strong>Внимание!</strong> Для оформления пропуска в
                  общежитие и регистрации необходимо принести цветные
                  фотографии 3×4 без уголка (2 экземпляра).
                </p>
              </>
            ),
          },
          {
            id: "first-year-military",
            title: "Воинский учёт",
            summary: "Постановка на воинский учёт для военнообязанных",
            content: (
              <p>
                <strong>
                  Военнообязанные (все юноши; девушки со средним
                  профессиональным образованием)
                </strong>{" "}
                подлежат постановке на воинский учёт в университете. На
                организационных собраниях вас примут сотрудники
                военно-учётного стола и оформят в соответствии с положенными
                требованиями. Убедительная просьба взять с собой на
                оргсобрание приписное свидетельство или военный билет! На
                весь период обучения в университете предоставляется отсрочка
                от срочной службы.
              </p>
            ),
          },
          {
            id: "first-year-target-quota",
            title: "Целевая квота",
            summary: "Оформление целевых договоров для зачисленных по квоте",
            content: (
              <p>
                Студентам, зачисленным по целевой квоте, необходимо
                связаться с заказчиками и будущими работодателями для
                оформления целевых договоров.
              </p>
            ),
          },
          {
            id: "first-year-schedule-news",
            title: "Расписание занятий и новости университета",
            summary: "Где смотреть расписание и следить за новостями ДВГМУ",
            content: (
              <>
                <p>
                  С расписаниями занятий на 1 курсе можно ознакомиться на
                  сайте университета{" "}
                  <a
                    href="https://www.fesmu.ru/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    fesmu.ru
                  </a>{" "}
                  в разделе «Учёба — Расписания занятий». В каких корпусах,
                  на каких кафедрах и аудиториях будут проходить лекции и
                  занятия, вы узнаете на оргсобраниях и по своим факультетам.
                </p>
                <p>
                  Следите за информацией и новостями на сайте университета, в
                  канале MAX и на странице ДВГМУ ВКонтакте.
                </p>
                <p>
                  Первокурсники! Желаем вам успехов в учёбе, учиться только
                  на «хорошо» и «отлично», сохранить на всём протяжении
                  обучения в университете интерес и тягу к знаниям, не
                  останавливаться на пути к получению высшего образования
                  специалиста.
                </p>
                <p className="font-medium">
                  До встречи на организационных собраниях!
                </p>
              </>
            ),
          },
        ],
      },
    ],
  },
];

export interface ResolvedDoc {
  category: DocCategory;
  group: DocGroup;
  entry: DocEntry;
}

export function findCategory(id: string | null | undefined): DocCategory | null {
  if (!id) return null;
  return DOCS.find((category) => category.id === id) ?? null;
}

export function findDoc(id: string | null | undefined): ResolvedDoc | null {
  if (!id) return null;
  for (const category of DOCS) {
    for (const group of category.groups) {
      const entry = group.items.find((item) => item.id === id);
      if (entry) return { category, group, entry };
    }
  }
  return null;
}
