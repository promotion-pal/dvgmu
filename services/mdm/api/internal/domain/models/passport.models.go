package models

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fesmu/contract/mdm/entity"
	"fesmu/contract/mdm/enum"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var (
	ErrPassportNotFound = errors.New("passport record not found")
	ErrDecryptFailed    = errors.New("не удалось расшифровать данные паспорта")
)

var (
	passportEncryptionMu  sync.RWMutex
	passportEncryptionKey []byte
)

// InitPassportEncryption задаёт ключ, которым шифруются критические поля
// паспорта (серия, номер, СНИЛС) перед сохранением в БД. secret может быть
// произвольной длины — он хешируется в 32-байтный ключ для AES-256.
// Вызывать один раз при старте приложения, до первой работы с паспортами.
func InitPassportEncryption(secret string) error {
	if secret == "" {
		return errors.New("passport encryption secret is required")
	}

	key := sha256.Sum256([]byte(secret))

	passportEncryptionMu.Lock()
	passportEncryptionKey = key[:]
	passportEncryptionMu.Unlock()

	return nil
}

func passportKey() ([]byte, error) {
	passportEncryptionMu.RLock()
	defer passportEncryptionMu.RUnlock()

	if len(passportEncryptionKey) == 0 {
		return nil, errors.New("passport encryption key is not initialized")
	}

	return passportEncryptionKey, nil
}

type Passport struct {
	ID     int64 `gorm:"primaryKey;autoIncrement"`
	UserID int64 `gorm:"not null;unique;index"`

	// Series, Number, Snils, BirthPlace, ResidentialAddress и
	// RegistrationAddress хранятся в БД в зашифрованном виде (см.
	// BeforeSave/AfterSave/AfterFind), поэтому колонки типа TEXT — под
	// base64(nonce+ciphertext+tag), а не под исходное значение.
	Series string `gorm:"size:255"`
	Number string `gorm:"size:255"`

	Authority      string `gorm:"size:255"`
	IssueDate      string `gorm:"size:32"`
	ExpiryDate     string `gorm:"size:32"`
	DepartmentCode string `gorm:"size:16"`

	Snils       string               `gorm:"size:255"`
	BirthPlace  string               `gorm:"type:text"`
	Gender      enum.UserGender      `gorm:"not null"`
	Nationality enum.UserNationality `gorm:"not null"`

	RegistrationDate    string `gorm:"size:32"`
	ResidentialAddress  string `gorm:"type:text"`
	RegistrationAddress string `gorm:"type:text"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (p *Passport) ToProto() *entity.Passport {
	return &entity.Passport{
		Id:                  p.ID,
		Series:              p.Series,
		Number:              p.Number,
		Authority:           p.Authority,
		IssueDate:           p.IssueDate,
		ExpiryDate:          p.ExpiryDate,
		DepartmentCode:      p.DepartmentCode,
		Snils:               p.Snils,
		BirthPlace:          p.BirthPlace,
		Gender:              p.Gender,
		Nationality:         p.Nationality,
		RegistrationDate:    p.RegistrationDate,
		ResidentialAddress:  p.ResidentialAddress,
		RegistrationAddress: p.RegistrationAddress,
		CreatedAt:           timestamppb.New(p.CreatedAt),
		UpdatedAt:           timestamppb.New(p.UpdatedAt),
	}
}

type PassportCreateParams struct {
	UserID int64

	Series string
	Number string

	Authority      string
	IssueDate      string
	ExpiryDate     string
	DepartmentCode string

	Snils       string
	BirthPlace  string
	Gender      enum.UserGender
	Nationality enum.UserNationality

	RegistrationDate    string
	ResidentialAddress  string
	RegistrationAddress string
}

func NewPassport(params PassportCreateParams) (*Passport, error) {
	if params.UserID == 0 {
		return nil, errors.New("user_id is required")
	}
	if params.Series == "" || params.Number == "" {
		return nil, errors.New("series and number are required")
	}

	now := time.Now()
	return &Passport{
		UserID:              params.UserID,
		Series:              params.Series,
		Number:              params.Number,
		Authority:           params.Authority,
		IssueDate:           params.IssueDate,
		ExpiryDate:          params.ExpiryDate,
		DepartmentCode:      params.DepartmentCode,
		Snils:               params.Snils,
		BirthPlace:          params.BirthPlace,
		Gender:              params.Gender,
		Nationality:         params.Nationality,
		RegistrationDate:    params.RegistrationDate,
		ResidentialAddress:  params.ResidentialAddress,
		RegistrationAddress: params.RegistrationAddress,
		CreatedAt:           now,
		UpdatedAt:           now,
	}, nil
}

func encryptPassportField(plainText string) (string, error) {
	if plainText == "" {
		return "", nil
	}

	key, err := passportKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("ошибка инициализации шифра: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("ошибка создания режима GCM: %w", err)
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("ошибка генерации вектора: %w", err)
	}

	cipherText := aesGCM.Seal(nonce, nonce, []byte(plainText), nil)

	return base64.StdEncoding.EncodeToString(cipherText), nil
}

func decryptPassportField(cryptoTextBase64 string) (string, error) {
	if cryptoTextBase64 == "" {
		return "", nil
	}

	key, err := passportKey()
	if err != nil {
		return "", err
	}

	cipherText, err := base64.StdEncoding.DecodeString(cryptoTextBase64)
	if err != nil {
		return "", ErrDecryptFailed
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("ошибка инициализации шифра: %w", err)
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("ошибка создания режима GCM: %w", err)
	}

	nonceSize := aesGCM.NonceSize()
	if len(cipherText) < nonceSize {
		return "", ErrDecryptFailed
	}

	nonce, actualCipherText := cipherText[:nonceSize], cipherText[nonceSize:]

	plainBytes, err := aesGCM.Open(nil, nonce, actualCipherText, nil)
	if err != nil {
		return "", ErrDecryptFailed
	}

	return string(plainBytes), nil
}

func (p *Passport) encryptSensitiveFields() (err error) {
	if p.Series, err = encryptPassportField(p.Series); err != nil {
		return err
	}
	if p.Number, err = encryptPassportField(p.Number); err != nil {
		return err
	}
	if p.Snils, err = encryptPassportField(p.Snils); err != nil {
		return err
	}
	if p.BirthPlace, err = encryptPassportField(p.BirthPlace); err != nil {
		return err
	}
	if p.ResidentialAddress, err = encryptPassportField(p.ResidentialAddress); err != nil {
		return err
	}
	if p.RegistrationAddress, err = encryptPassportField(p.RegistrationAddress); err != nil {
		return err
	}
	return nil
}

func (p *Passport) decryptSensitiveFields() (err error) {
	if p.Series, err = decryptPassportField(p.Series); err != nil {
		return err
	}
	if p.Number, err = decryptPassportField(p.Number); err != nil {
		return err
	}
	if p.Snils, err = decryptPassportField(p.Snils); err != nil {
		return err
	}
	if p.BirthPlace, err = decryptPassportField(p.BirthPlace); err != nil {
		return err
	}
	if p.ResidentialAddress, err = decryptPassportField(p.ResidentialAddress); err != nil {
		return err
	}
	if p.RegistrationAddress, err = decryptPassportField(p.RegistrationAddress); err != nil {
		return err
	}
	return nil
}

func (p *Passport) BeforeSave(tx *gorm.DB) error {
	return p.encryptSensitiveFields()
}

func (p *Passport) AfterSave(tx *gorm.DB) error {
	return p.decryptSensitiveFields()
}

func (p *Passport) AfterFind(tx *gorm.DB) error {
	return p.decryptSensitiveFields()
}
