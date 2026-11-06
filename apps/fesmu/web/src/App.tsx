import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Layout, PublicLayout } from "./widgets/layout";
import type { UserRole } from "@fesmu/contract/fesmu/enum/v1/user.enum_pb";
import { PermissionGate, RoleGate, UserGate } from "./widgets/user-gate";
import { PermissionAction, PermissionSection, PURCHASE_SECTIONS, PURCHASE_V3_PERMS, permsFor, permsForAny } from "./shared/config/permissions";
import CertificatesPage from "./page/admin/certificates/Certificates";
import DeaneryStudentsPage from "./page/deanery/DeaneryStudents";
import { firstAllowedUrl } from "./widgets/layout/sidebar";
import { ACCESS } from "./shared/config/access";
import { useUserProvider } from "./features/provider/user.provider";
import { LEGACY_LK_PREFIXES, LK, ROUTE } from "./shared/config/path";
import { DocsPage } from "./page/Docs";
import InfrastructurePage from "./page/Infrastructure";
import InventoryPage from "./page/Inventory";
import UserPage from "./page/User";
import StudentPage from "./page/Student";
import EmployeePage from "./page/Employee";
import TicketsPage from "./page/Tickets";
import SchedulePage from "./page/Schedule";
import ScheduleEditorPage from "./page/ScheduleEditor";
import ScheduleHallPage from "./page/ScheduleHall";
import ComputerClassPage from "./page/ComputerClass";
import TestBuilderPage from "./page/TestBuilder";
import ExamTestingPublicPage from "./page/public/ExamTestingPublic";
import { TestVersion } from "@fesmu/contract/fesmu/enum/v1/test.enum_pb";
import TestSessionsPage from "./page/TestSessions";
import TestSessionResultsPage from "./page/TestSessionResults";
import PurchaseV2Page from "./page/PurchaseV2";
import PurchaseV3Page from "./page/PurchaseV3";
import LibraryPage from "./page/Library";
import LibraryItemPage from "./page/LibraryItem";
import ManualsPage from "./page/Manuals";
import ManualReadPage from "./page/ManualRead";
import ManualEditorPage from "./page/ManualEditor";
import AnalyticSurveysPage from "./page/analytics/Surveys";
import AnalyticSurveyPage from "./page/analytics/Survey";
import AnalyticReportPage from "./page/analytics/Report";
import AnalyticReportDetailPage from "./page/analytics/ReportDetail";
import AnalyticReportCategoryPage from "./page/analytics/ReportCategory";
import { HallBookingPage, PublicComputerClassPage, PublicManualReadPage, PublicManualsPage, PublicSchedulePage, PublicScheduleHallPage, PublicVaccinationPage, ScheduleCollectPage, TestTakePage, QuestionPage } from "./page/public";
import { NotFoundPage } from "./page/state";
import StudentCabinetPage from "./page/cabinet";
import ProfilePage from "./page/Profile";
import AuthAdminPage from "./page/admin/auth";
import RoleAdminPage from "./page/admin/roles";
import AccessAdminPage from "./page/admin/access";
import DebtorAdminPage from "./page/admin/debtors";
import VaccinationAdminPage from "./page/admin/vaccination";

/** Группа маршрутов только для ролей (ADMIN — везде). */
function Allow({ roles }: { roles: readonly UserRole[] }) {
  return <RoleGate roles={[...roles]}><Outlet /></RoleGate>;
}

/** Группа маршрутов по праву на раздел (по умолчанию — просмотр; ADMIN — везде). */
function AllowSection({ section, action = PermissionAction.FETCH }: { section: PermissionSection; action?: PermissionAction }) {
  return <PermissionGate permissions={permsFor(section, action)}><Outlet /></PermissionGate>;
}

/** Главная — первый доступный раздел; без ролей — профиль. */
function HomeRedirect() {
  const hasRole = useUserProvider((s) => s.hasRole);
  const hasPermission = useUserProvider((s) => s.hasPermission);
  return <Navigate to={firstAllowedUrl(hasRole, hasPermission)} replace />;
}

/** Старый адрес раздела кабинета (до /lk) — в кабинет по тому же пути; иначе «не найдено». */
function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const legacy = LEGACY_LK_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return legacy ? <Navigate to={`${LK}${pathname}${search}${hash}`} replace /> : <NotFoundPage />;
}

function App() {
  return (
    <Routes>
      {/* Корень сайта ведёт в кабинет: там вход и первый доступный раздел. */}
      <Route path="/" element={<Navigate to={ROUTE.HOME} replace />} />

      {/* Личный кабинет (/lk): всё после входа. */}
      <Route element={<UserGate><Outlet /></UserGate>}>
        <Route element={<Layout />}>
          <Route path={ROUTE.HOME} element={<HomeRedirect />} />
          <Route path={ROUTE.USER.PROFILE} element={<ProfilePage />} />

          {/* Библиотека и методички в кабинете — всем, кто вошёл (опубликованные открыты и на /manuals). */}
          <Route path={ROUTE.LIBRARY.CATALOG} element={<LibraryPage />} />
          <Route path={ROUTE.LIBRARY.ITEM} element={<LibraryItemPage />} />
          <Route path={ROUTE.LIBRARY.MANUALS} element={<ManualsPage />} />
          <Route path={ROUTE.LIBRARY.MANUAL} element={<ManualReadPage />} />
          <Route element={<AllowSection section={PermissionSection.ANALYTICS} />}>
            <Route path={ROUTE.ANALYTICS.SURVEYS} element={<AnalyticSurveysPage />} />
            <Route path={ROUTE.ANALYTICS.REPORT} element={<AnalyticReportPage />} />
            <Route path={ROUTE.ANALYTICS.REPORT_DETAIL} element={<AnalyticReportDetailPage />} />
            <Route path={ROUTE.ANALYTICS.REPORT_CATEGORY} element={<AnalyticReportCategoryPage />} />
            <Route path={ROUTE.ANALYTICS.SURVEY} element={<AnalyticSurveyPage />} />
          </Route>
          <Route element={<AllowSection section={PermissionSection.MANUALS} action={PermissionAction.POST} />}>
            <Route path={ROUTE.LIBRARY.MANUAL_EDIT} element={<ManualEditorPage />} />
          </Route>

          {/* Студент */}
          <Route element={<Allow roles={ACCESS.STUDENT} />}>
            <Route path={ROUTE.MY.CERTIFICATE} element={<StudentCabinetPage />} />
            <Route path={ROUTE.MY.SCHEDULE} element={<PublicSchedulePage />} />
          </Route>

          {/* Тесты — по праву на раздел из доступов, как разделы сотрудников */}
          <Route element={<AllowSection section={PermissionSection.TESTS} />}>
            <Route path={ROUTE.TESTS.BUILDER} element={<TestBuilderPage version={TestVersion.V1} />} />
            <Route path={ROUTE.TESTS.BUILDER_V2} element={<TestBuilderPage version={TestVersion.V2} />} />
            <Route path={ROUTE.TESTS.SESSIONS} element={<TestSessionsPage />} />
            <Route path={ROUTE.TESTS.SESSION_RESULTS} element={<TestSessionResultsPage />} />
          </Route>
          <Route element={<AllowSection section={PermissionSection.EXAM_TESTS} />}>
            <Route path={ROUTE.EXAM_TESTS.BUILDER} element={<TestBuilderPage version={TestVersion.V1} exam />} />
            <Route path={ROUTE.EXAM_TESTS.SESSIONS} element={<TestSessionsPage exam />} />
            <Route path={ROUTE.EXAM_TESTS.SESSION_RESULTS} element={<TestSessionResultsPage exam />} />
          </Route>

          {/* Сотрудник: разделы по правам из наборов доступа */}
          <Route element={<AllowSection section={PermissionSection.INFRASTRUCTURE} />}>
            <Route path={ROUTE.USER.INFRASTRUCTURE} element={<InfrastructurePage />} />
          </Route>
          <Route element={<AllowSection section={PermissionSection.INVENTORY} />}>
            <Route path={ROUTE.USER.INVENTORY} element={<InventoryPage />} />
          </Route>
          <Route element={<AllowSection section={PermissionSection.TICKETS} />}>
            <Route path={ROUTE.USER.TICKETS} element={<TicketsPage />} />
          </Route>
          <Route element={<AllowSection section={PermissionSection.SCHEDULE} />}>
            <Route path={ROUTE.STUDY.SCHEDULE} element={<SchedulePage />} />
          </Route>
          <Route element={<AllowSection section={PermissionSection.SCHEDULE} action={PermissionAction.POST} />}>
            <Route path={ROUTE.STUDY.SCHEDULE_NEW} element={<ScheduleEditorPage />} />
            <Route path={ROUTE.STUDY.SCHEDULE_EDIT} element={<ScheduleEditorPage />} />
          </Route>
          <Route path={ROUTE.STUDY.SCHEDULE_HALL} element={<ScheduleHallPage />} />
          <Route element={<AllowSection section={PermissionSection.COMPUTER_CLASSES} />}>
            <Route path={ROUTE.STUDY.COMPUTER_CLASS} element={<ComputerClassPage />} />
          </Route>

          {/* Деканат: студенты своего факультета, коды первого входа (выдача — deanery.post) */}
          <Route element={<AllowSection section={PermissionSection.DEANERY} />}>
            <Route path={ROUTE.DEANERY.STUDENTS} element={<DeaneryStudentsPage />} />
          </Route>

          {/* По правам: журнал и выдача справок */}
          <Route
            path={ROUTE.ADMIN.CERTIFICATES}
            element={
              <PermissionGate permissions={permsFor(PermissionSection.CERTIFICATE)}>
                <CertificatesPage />
              </PermissionGate>
            }
          />

          {/* Администратор */}
          <Route element={<Allow roles={ACCESS.ADMIN} />}>
            <Route path={ROUTE.ADMIN.AUTH} element={<AuthAdminPage />} />
            <Route path={ROUTE.ADMIN.ROLES} element={<RoleAdminPage />} />
            <Route path={ROUTE.ADMIN.ACCESS} element={<AccessAdminPage />} />
            {/* Персональные данные */}
            <Route path={ROUTE.USER.USERS} element={<UserPage />} />
            <Route path={ROUTE.USER.STUDENTS} element={<StudentPage />} />
            <Route path={ROUTE.USER.EMPLOYEES} element={<EmployeePage />} />
            <Route path={ROUTE.ADMIN.DEBTORS} element={<DebtorAdminPage />} />
          </Route>

          {/* Закупки: просмотр любого раздела закупок; кнопки этапов — по разделу роли */}
          <Route element={<PermissionGate permissions={permsForAny(PURCHASE_SECTIONS)}><Outlet /></PermissionGate>}>
            <Route path={ROUTE.PURCHASE.V2} element={<PurchaseV2Page />} />
          </Route>
          {/* Закупки v3: любое право purchase.*; этапы и кнопки — по ответу api */}
          <Route path={ROUTE.PURCHASE.V3} element={<PermissionGate permissions={PURCHASE_V3_PERMS}><PurchaseV3Page /></PermissionGate>} />
        </Route>

        {/* Vaccination sign-up stands apart from the app: no sidebar or header, still behind the sign-in. */}
        <Route element={<Layout notViewHeader notViewSidebar />}>
          <Route path={ROUTE.ADMIN.VACCINATION} element={<PermissionGate permissions={permsFor(PermissionSection.VACCINATION)}><VaccinationAdminPage /></PermissionGate>} />
        </Route>
      </Route>

      {/* Docs hold the legal documents (privacy policy) that the public forms
          link to, so they must open without a sign-in too. */}
      <Route element={<Layout notViewHeader notViewSidebar />}>
        <Route path={ROUTE.DOCS.COMMON} element={<DocsPage />} />
        <Route path={ROUTE.PUBLIC.SCHEDULE} element={<PublicSchedulePage />} />
        <Route path={ROUTE.PUBLIC.SCHEDULE_HALL} element={<PublicScheduleHallPage />} />
        <Route path={ROUTE.PUBLIC.HALL_BOOKING} element={<HallBookingPage />} />
        <Route path={ROUTE.PUBLIC.COMPUTER_CLASS} element={<PublicComputerClassPage />} />
        <Route path={ROUTE.PUBLIC.VACCINATION} element={<PublicVaccinationPage />} />
        {/* The cabinet is a student's own page: no sidebar, but a sign-in. */}
        <Route path={ROUTE.PUBLIC.CABINET} element={<UserGate><StudentCabinetPage /></UserGate>} />
        <Route path={ROUTE.PUBLIC.SCHEDULE_COLLECT} element={<ScheduleCollectPage />} />
        {/* Students take a test by its session link, without a sign-in. */}
        <Route path={ROUTE.PUBLIC.TEST_TAKE} element={<TestTakePage />} />
        {/* Анкета по QR — без входа. */}
        <Route path={ROUTE.PUBLIC.QUESTION} element={<QuestionPage />} />
      </Route>

      {/* Computer-class exams have one standalone public entry, with no LK navigation. */}
      <Route path={ROUTE.PUBLIC.EXAM_TESTING} element={<ExamTestingPublicPage />} />
      <Route path={ROUTE.PUBLIC.EXAM_TEST_TAKE} element={<TestTakePage exam />} />

      {/* Опубликованные методички — открыто, без входа. */}
      <Route element={<PublicLayout />}>
        <Route path={ROUTE.PUBLIC.MANUALS} element={<PublicManualsPage />} />
        <Route path={ROUTE.PUBLIC.MANUAL} element={<PublicManualReadPage />} />
      </Route>

      <Route path={"*"} element={<LegacyRedirect />} />
    </Routes>
  );
}

export default App;
