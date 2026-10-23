package service

import (
	"context"
	"dvgmu/api/contract/gen/go/enum"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"unicode/utf8"
)

type UserSaver interface {
	UserCreate(ctx context.Context, user *models.User) (int64, error)
	UserUpdate(ctx context.Context, user *models.User) error
	UserDelete(ctx context.Context, id int64) error
	UserDeleteBatch(ctx context.Context, ids []int64) (int64, error)
	UserRolesSet(ctx context.Context, userID int64, roles []enum.UserRole) error
	UserPermissionsSet(ctx context.Context, userID int64, perms []string) error
	UserPositionSet(ctx context.Context, userID int64, position string) error
	UserADLinkBatch(ctx context.Context, links []models.ADLink) (int64, []models.ADLink, error)
}

type UserProvider interface {
	UserFetch(ctx context.Context) ([]*models.User, error)
	UserByID(ctx context.Context, id int64) (*models.User, error)
	UserByUUID(ctx context.Context, id string) (*models.User, error)
	UserByADObjectID(ctx context.Context, objectID string) (*models.User, error)
	UserByEmail(ctx context.Context, email string) (*models.User, error)
	UsersByFullName(ctx context.Context, lastName, firstName string) ([]*models.User, error)
	UserExistsByEmail(ctx context.Context, email string) (bool, error)
}

type PassportSaver interface {
	PassportCreate(ctx context.Context, passport *models.Passport) (int64, error)
}

type EducationSaver interface {
	EducationCreate(ctx context.Context, education *models.Education) (int64, error)
}

type MilitarySaver interface {
	MilitaryCreate(ctx context.Context, military *models.Military) (int64, error)
}

type StudentRepo interface {
	StudentCreate(ctx context.Context, student *models.Student) (int64, error)
	StudentFetch(ctx context.Context) ([]*models.Student, error)
}

type EmployeeRepo interface {
	EmployeeCreate(ctx context.Context, employee *models.Employee) (int64, error)
	EmployeeDepartmentsSet(ctx context.Context, userID int64, deps []enum.UserEmployeeDepartment) error
	EmployeeFetch(ctx context.Context) ([]*models.Employee, error)
}

type UserService struct {
	log       *slog.Logger
	saver     UserSaver
	provider  UserProvider
	passports PassportSaver
	education EducationSaver
	military  MilitarySaver
	students  StudentRepo
	employees EmployeeRepo
}

func NewUserService(
	log *slog.Logger,
	saver UserSaver,
	provider UserProvider,
	passports PassportSaver,
	education EducationSaver,
	military MilitarySaver,
	students StudentRepo,
	employees EmployeeRepo,
) *UserService {
	return &UserService{
		log:       log,
		saver:     saver,
		provider:  provider,
		passports: passports,
		education: education,
		military:  military,
		students:  students,
		employees: employees,
	}
}

func (s *UserService) UserFetch(ctx context.Context) ([]*models.User, error) {
	const op = "User.UserFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.UserFetch(ctx)
	if err != nil {
		log.Error(utils.MSGFetchError("user", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("user", len(list)))
	return list, nil
}

func (s *UserService) UserByID(ctx context.Context, id int64) (*models.User, error) {
	const op = "User.UserByID"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", id))

	user, err := s.provider.UserByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", id))
			return nil, err
		}
		log.Error(utils.MSGDBFetchByIDError("user", id, err))
		return nil, err
	}

	return user, nil
}

func (s *UserService) UserByUUID(ctx context.Context, id string) (*models.User, error) {
	const op = "User.UserByUUID"
	log := s.log.With(slog.String("op", op), slog.String("user_uuid", id))

	user, err := s.provider.UserByUUID(ctx, strings.TrimSpace(id))
	if err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			log.Error("failed to fetch user by uuid", slog.String("error", err.Error()))
		}
		return nil, err
	}

	return user, nil
}

func (s *UserService) UserByADObjectID(ctx context.Context, objectID string) (*models.User, error) {
	const op = "User.UserByADObjectID"
	log := s.log.With(slog.String("op", op), slog.String("ad_object_id", objectID))

	user, err := s.provider.UserByADObjectID(ctx, strings.ToLower(strings.TrimSpace(objectID)))
	if err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			log.Error("failed to fetch user by ad object id", slog.String("error", err.Error()))
		}
		return nil, err
	}

	return user, nil
}

// UserRolesSet заменяет роли пользователя набором roles и возвращает
// пользователя уже с новыми ролями.
func (s *UserService) UserRolesSet(ctx context.Context, id int64, roles []enum.UserRole) (*models.User, error) {
	const op = "User.UserRolesSet"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", id))

	roles, err := models.NormalizeRoles(roles)
	if err != nil {
		return nil, err
	}

	if err := s.saver.UserRolesSet(ctx, id, roles); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			log.Error("failed to set user roles", slog.String("error", err.Error()))
		}
		return nil, err
	}

	log.Info("user roles set", slog.Any("roles", roles))
	return s.provider.UserByID(ctx, id)
}

func (s *UserService) UserCreate(ctx context.Context, params models.UserCreateParams) (*models.UserCreateResult, error) {
	const op = "User.UserCreate"
	log := s.log.With(slog.String("op", op))

	if params.Email == "" {
		email, err := utils.GenEmail(params.LastName, params.FirstName, params.Patronymic, func(login string) (bool, error) {
			return s.provider.UserExistsByEmail(ctx, login+utils.EMAIL)
		})
		if err != nil {
			log.Error(utils.MSGValidateFailed("user", err))
			return nil, err
		}
		params.Email = email
	} else {
		exists, err := s.provider.UserExistsByEmail(ctx, params.Email)
		if err != nil {
			log.Error(utils.MSGFetchError("user", err))
			return nil, err
		}
		if exists {
			log.Warn(utils.MSGValidateFailed("user", models.ErrUserAlreadyExists))
			return nil, models.ErrUserAlreadyExists
		}
	}

	password, err := utils.GenPassword(params.FirstName)
	if err != nil {
		log.Error(utils.MSGValidateFailed("user", err))
		return nil, err
	}

	user, err := models.NewUser(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("user", err))
		return nil, err
	}

	id, err := s.saver.UserCreate(ctx, user)
	if err != nil {
		log.Error(utils.MSGCreateError("user", err))
		return nil, err
	}

	log.Info(utils.MSGCreateSuccess("user", id))
	return &models.UserCreateResult{ID: id, Email: params.Email, TemporaryPassword: password}, nil
}

func (s *UserService) UserUpdate(ctx context.Context, id int64, params models.UserCreateParams) error {
	const op = "User.UserUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", id))

	if _, err := s.provider.UserByID(ctx, id); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", id))
			return err
		}
		log.Error(utils.MSGDBFetchByIDError("user", id, err))
		return err
	}

	user, err := models.NewUser(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("user", err))
		return err
	}
	user.ID = id

	if err := s.saver.UserUpdate(ctx, user); err != nil {
		log.Error(utils.MSGDBUpdateError("user", id, err))
		return err
	}

	log.Info(utils.MSGUpdateSuccess("user", id))
	return nil
}

func (s *UserService) UserDelete(ctx context.Context, id int64) error {
	const op = "User.UserDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", id))

	if err := s.saver.UserDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("user", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("user", id))
	return nil
}

func (s *UserService) PassportCreate(ctx context.Context, params models.PassportCreateParams) (int64, error) {
	const op = "User.PassportCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", params.UserID))

	if _, err := s.provider.UserByID(ctx, params.UserID); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", params.UserID))
			return 0, err
		}
		log.Error(utils.MSGDBFetchByIDError("user", params.UserID, err))
		return 0, err
	}

	passport, err := models.NewPassport(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("passport", err))
		return 0, err
	}

	id, err := s.passports.PassportCreate(ctx, passport)
	if err != nil {
		log.Error(utils.MSGCreateError("passport", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("passport", id))
	return id, nil
}

func (s *UserService) EducationCreate(ctx context.Context, params models.EducationCreateParams) (int64, error) {
	const op = "User.EducationCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", params.UserID))

	if _, err := s.provider.UserByID(ctx, params.UserID); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", params.UserID))
			return 0, err
		}
		log.Error(utils.MSGDBFetchByIDError("user", params.UserID, err))
		return 0, err
	}

	education, err := models.NewEducation(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("education", err))
		return 0, err
	}

	id, err := s.education.EducationCreate(ctx, education)
	if err != nil {
		log.Error(utils.MSGCreateError("education", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("education", id))
	return id, nil
}

func (s *UserService) MilitaryCreate(ctx context.Context, params models.MilitaryCreateParams) (int64, error) {
	const op = "User.MilitaryCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", params.UserID))

	if _, err := s.provider.UserByID(ctx, params.UserID); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", params.UserID))
			return 0, err
		}
		log.Error(utils.MSGDBFetchByIDError("user", params.UserID, err))
		return 0, err
	}

	military, err := models.NewMilitary(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("military", err))
		return 0, err
	}

	id, err := s.military.MilitaryCreate(ctx, military)
	if err != nil {
		log.Error(utils.MSGCreateError("military", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("military", id))
	return id, nil
}

func (s *UserService) StudentCreate(ctx context.Context, params models.StudentCreateParams) (int64, error) {
	const op = "User.StudentCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", params.UserID))

	if _, err := s.provider.UserByID(ctx, params.UserID); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", params.UserID))
			return 0, err
		}
		log.Error(utils.MSGDBFetchByIDError("user", params.UserID, err))
		return 0, err
	}

	student, err := models.NewStudent(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("student", err))
		return 0, err
	}

	id, err := s.students.StudentCreate(ctx, student)
	if err != nil {
		log.Error(utils.MSGCreateError("student", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("student", id))
	return id, nil
}

func (s *UserService) EmployeeCreate(ctx context.Context, params models.EmployeeCreateParams) (int64, error) {
	const op = "User.EmployeeCreate"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", params.UserID))

	if _, err := s.provider.UserByID(ctx, params.UserID); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			log.Warn(utils.MSGNotFoundError("user", params.UserID))
			return 0, err
		}
		log.Error(utils.MSGDBFetchByIDError("user", params.UserID, err))
		return 0, err
	}

	employee, err := models.NewEmployee(params)
	if err != nil {
		log.Error(utils.MSGValidateFailed("employee", err))
		return 0, err
	}

	id, err := s.employees.EmployeeCreate(ctx, employee)
	if err != nil {
		log.Error(utils.MSGCreateError("employee", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("employee", id))
	return id, nil
}

func (s *UserService) StudentFetch(ctx context.Context) ([]*models.Student, error) {
	const op = "User.StudentFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.students.StudentFetch(ctx)
	if err != nil {
		log.Error(utils.MSGFetchError("student", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("student", len(list)))
	return list, nil
}

func (s *UserService) EmployeeFetch(ctx context.Context) ([]*models.Employee, error) {
	const op = "User.EmployeeFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.employees.EmployeeFetch(ctx)
	if err != nil {
		log.Error(utils.MSGFetchError("employee", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("employee", len(list)))
	return list, nil
}

func (s *UserService) UserCreateBatch(ctx context.Context, items []models.UserCreateBatchItemParams) []models.UserCreateBatchResult {
	const op = "User.UserCreateBatch"
	log := s.log.With(slog.String("op", op), slog.Int("count", len(items)))

	results := make([]models.UserCreateBatchResult, len(items))
	reserved := make(map[string]bool) // логины, уже выданные внутри этого батча

	for i, item := range items {
		result := models.UserCreateBatchResult{Index: i}

		// Телефон приводим к единому виду до поиска и сравнения; мусорный
		// номер не должен ронять всю строку — отбрасываем его с пометкой.
		var phoneNote string
		if phone, err := models.NormalizePhonePtr(item.Phone); err != nil {
			phoneNote = fmt.Sprintf("phone %q skipped: invalid format", *item.Phone)
			item.Phone = nil
		} else {
			item.Phone = phone
		}

		// Ищем уже существующего человека: по явному email, а если его нет —
		// по ФИО с проверкой остальных данных (см. User.SamePersonAs). Нашли —
		// не создаём заново, а дозаполняем то, чего не хватает, ничего не
		// перезаписывая. Тёзка с другими данными — это новый пользователь.
		existing, err := s.findExistingForBatchItem(ctx, item)
		if err != nil {
			log.Error(utils.MSGFetchError("user", err))
			result.Message = err.Error()
			results[i] = result
			continue
		}
		if existing != nil {
			messages := s.fillMissingUserFields(ctx, log, existing, item)
			messages = append(messages, s.fillMissingUserData(ctx, log, existing.ID, item, existing)...)
			if phoneNote != "" {
				messages = append(messages, phoneNote)
			}

			result.Success = true
			result.UserID = existing.ID
			result.Email = existing.Email
			result.Message = "user already exists"
			if len(messages) > 0 {
				result.Message += ": " + strings.Join(messages, "; ")
			}
			results[i] = result
			continue
		}

		email := item.Email
		if email == "" {
			generated, err := utils.GenEmail(item.LastName, item.FirstName, item.Patronymic, func(login string) (bool, error) {
				if reserved[login] {
					return true, nil
				}
				return s.provider.UserExistsByEmail(ctx, login+utils.EMAIL)
			})
			if err != nil {
				log.Error(utils.MSGValidateFailed("user", err))
				result.Message = err.Error()
				results[i] = result
				continue
			}
			email = generated
			reserved[strings.TrimSuffix(email, utils.EMAIL)] = true
		}

		password, err := utils.GenPassword(item.FirstName)
		if err != nil {
			log.Error(utils.MSGValidateFailed("user", err))
			result.Message = err.Error()
			results[i] = result
			continue
		}

		user, err := models.NewUser(models.UserCreateParams{
			FirstName:  item.FirstName,
			LastName:   item.LastName,
			Patronymic: item.Patronymic,
			Email:      email,
			Phone:      item.Phone,
			Birthday:   item.Birthday,
		})
		if err != nil {
			result.Message = err.Error()
			results[i] = result
			continue
		}

		id, err := s.saver.UserCreate(ctx, user)
		if err != nil {
			log.Error(utils.MSGCreateError("user", err))
			result.Message = err.Error()
			results[i] = result
			continue
		}

		result.Success = true
		result.UserID = id
		result.Email = email
		result.TemporaryPassword = password

		messages := append([]string{"user created"}, s.fillMissingUserData(ctx, log, id, item, nil)...)
		if phoneNote != "" {
			messages = append(messages, phoneNote)
		}
		result.Message = strings.Join(messages, "; ")
		results[i] = result
	}

	log.Info("batch user creation finished", slog.Int("count", len(items)))
	return results
}

// fillMissingUserData создаёт паспорт/образование/военный учёт для
// пользователя, если их предоставили в item — но только те, которых у
// него ещё нет. existing == nil для только что созданного пользователя
// (у него по определению ничего из этого ещё нет).
func (s *UserService) fillMissingUserData(
	ctx context.Context,
	log *slog.Logger,
	userID int64,
	item models.UserCreateBatchItemParams,
	existing *models.User,
) []string {
	var messages []string

	if item.Passport != nil {
		if existing != nil && existing.Passport != nil {
			messages = append(messages, "passport already present, not overwritten")
		} else {
			params := *item.Passport
			params.UserID = userID

			if passport, err := models.NewPassport(params); err != nil {
				messages = append(messages, "passport skipped: "+err.Error())
			} else if _, err := s.passports.PassportCreate(ctx, passport); err != nil {
				log.Error(utils.MSGCreateError("passport", err))
				messages = append(messages, "passport failed: "+err.Error())
			} else {
				messages = append(messages, "passport created")
			}
		}
	}

	if len(item.Educations) > 0 {
		if existing != nil && len(existing.Educations) > 0 {
			messages = append(messages, fmt.Sprintf("%d education record(s) already present, not overwritten", len(existing.Educations)))
		} else {
			created := 0
			for _, params := range item.Educations {
				params.UserID = userID

				education, err := models.NewEducation(params)
				if err != nil {
					messages = append(messages, "education skipped: "+err.Error())
					continue
				}
				if _, err := s.education.EducationCreate(ctx, education); err != nil {
					log.Error(utils.MSGCreateError("education", err))
					messages = append(messages, "education failed: "+err.Error())
					continue
				}
				created++
			}
			messages = append(messages, fmt.Sprintf("%d education record(s) created", created))
		}
	}

	if item.Military != nil {
		if existing != nil && existing.Military != nil {
			messages = append(messages, "military already present, not overwritten")
		} else {
			params := *item.Military
			params.UserID = userID

			if military, err := models.NewMilitary(params); err != nil {
				messages = append(messages, "military skipped: "+err.Error())
			} else if _, err := s.military.MilitaryCreate(ctx, military); err != nil {
				log.Error(utils.MSGCreateError("military", err))
				messages = append(messages, "military failed: "+err.Error())
			} else {
				messages = append(messages, "military created")
			}
		}
	}

	return messages
}

func (s *UserService) findExistingForBatchItem(ctx context.Context, item models.UserCreateBatchItemParams) (*models.User, error) {
	if item.Email != "" {
		user, err := s.provider.UserByEmail(ctx, item.Email)
		if err != nil {
			if errors.Is(err, models.ErrUserNotFound) {
				return nil, nil
			}
			return nil, err
		}
		return user, nil
	}

	candidates, err := s.provider.UsersByFullName(ctx, item.LastName, item.FirstName)
	if err != nil {
		return nil, err
	}
	for _, c := range candidates {
		if c.SamePersonAs(item) {
			return c, nil
		}
	}
	return nil, nil
}

// fillMissingUserFields дозаполняет пустые поля самого пользователя
// (отчество, телефон, дата рождения) — заполненные не трогает.
func (s *UserService) fillMissingUserFields(ctx context.Context, log *slog.Logger, existing *models.User, item models.UserCreateBatchItemParams) []string {
	patch := &models.User{ID: existing.ID}
	var filled []string

	if existing.Patronymic == "" && item.Patronymic != "" {
		patch.Patronymic = item.Patronymic
		filled = append(filled, "patronymic")
	}
	if existing.Phone == nil && item.Phone != nil && *item.Phone != "" {
		patch.Phone = item.Phone
		filled = append(filled, "phone")
	}
	if existing.Birthday == nil && item.Birthday != nil {
		patch.Birthday = item.Birthday
		filled = append(filled, "birthday")
	}
	if len(filled) == 0 {
		return nil
	}

	if err := s.saver.UserUpdate(ctx, patch); err != nil {
		log.Error(utils.MSGDBUpdateError("user", existing.ID, err))
		return []string{"user fields failed: " + err.Error()}
	}
	return []string{strings.Join(filled, ", ") + " filled"}
}

// UserDeleteBatch удаляет пачку пользователей; возвращает число реально
// удалённых (несуществующие id просто не учитываются).
func (s *UserService) UserDeleteBatch(ctx context.Context, ids []int64) (int64, error) {
	const op = "User.UserDeleteBatch"
	log := s.log.With(slog.String("op", op), slog.Int("count", len(ids)))

	deleted, err := s.saver.UserDeleteBatch(ctx, ids)
	if err != nil {
		log.Error(utils.MSGDeleteError("users", err))
		return 0, err
	}

	log.Info("users deleted", slog.Int64("deleted", deleted))
	return deleted, nil
}

func (s *UserService) UserADLinkBatch(ctx context.Context, links []models.ADLink) (int64, []models.ADLink, error) {
	const op = "User.UserADLinkBatch"
	log := s.log.With(slog.String("op", op))

	for i := range links {
		links[i].ADObjectID = strings.ToLower(strings.TrimSpace(links[i].ADObjectID))
	}

	linked, skipped, err := s.saver.UserADLinkBatch(ctx, links)
	if err != nil {
		log.Error("failed to link users to AD", slog.String("error", err.Error()))
		return linked, skipped, err
	}

	log.Info("users linked to AD", slog.Int64("linked", linked), slog.Int("skipped", len(skipped)))
	return linked, skipped, nil
}

// UserPermissionsSet заменяет права пользователя набором perms и возвращает
// пользователя уже с новыми правами.
func (s *UserService) UserPermissionsSet(ctx context.Context, id int64, perms []string) (*models.User, error) {
	const op = "User.UserPermissionsSet"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", id))

	perms, err := models.NormalizePermissions(perms)
	if err != nil {
		return nil, err
	}
	if err := s.saver.UserPermissionsSet(ctx, id, perms); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			log.Error("failed to set user permissions", slog.String("error", err.Error()))
		}
		return nil, err
	}

	log.Info("user permissions set", slog.Any("permissions", perms))
	return s.provider.UserByID(ctx, id)
}

// UserDepartmentsSet заменяет подразделения человека и возвращает его уже с
// ними (и с правами доступов этих подразделений).
// UserPositionSet задаёт должность человека (обрезает пробелы, до 255 символов).
func (s *UserService) UserPositionSet(ctx context.Context, id int64, position string) (*models.User, error) {
	log := s.log.With(slog.String("op", "User.UserPositionSet"), slog.Int64("user_id", id))

	position = strings.TrimSpace(position)
	if utf8.RuneCountInString(position) > 255 {
		return nil, models.ErrPositionTooLong
	}
	if err := s.saver.UserPositionSet(ctx, id, position); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			log.Error("failed to set user position", slog.String("error", err.Error()))
		}
		return nil, err
	}
	log.Info("user position set", slog.String("position", position))
	return s.provider.UserByID(ctx, id)
}

func (s *UserService) UserDepartmentsSet(ctx context.Context, id int64, deps []enum.UserEmployeeDepartment) (*models.User, error) {
	log := s.log.With(slog.String("op", "User.UserDepartmentsSet"), slog.Int64("user_id", id))

	deps = models.NormalizeDepartments(deps)
	if err := s.employees.EmployeeDepartmentsSet(ctx, id, deps); err != nil {
		if !errors.Is(err, models.ErrUserNotFound) {
			log.Error("failed to set user departments", slog.String("error", err.Error()))
		}
		return nil, err
	}
	log.Info("user departments set", slog.Any("departments", deps))
	return s.provider.UserByID(ctx, id)
}
