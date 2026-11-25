package word

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	TemplateApplicationDormitoryStudent      = "application_dormitory_student.docx"
	TemplateApplicationDormitoryStudentFull  = "application_dormitory_student_full.docx"
	TemplateApplicationDormitoryAbitur       = "application_dormitory_abitur.docx"
	TemplateApplicationTemporaryResidence    = "application_temporary_residence.docx"
	TemplateMilitaryRegistrationCard         = "military_registration_card.docx"
	TemplateStudyCertificate                 = "study_certificate.docx"
	TemplateApplicationCertificateEnrollment = "application_certificate_enrollment.docx"
)

type Generator struct {
	templatesDir string
	log          *slog.Logger
}

func NewGenerator(templatesDir string, log *slog.Logger) *Generator {
	return &Generator{templatesDir: templatesDir, log: log}
}

var placeholderRe = regexp.MustCompile(`\{\{\s*([A-Za-z0-9_]+)\s*\}\}`)

func (g *Generator) fill(templateName string, replacements map[string]string) ([]byte, error) {
	path := filepath.Join(g.templatesDir, templateName)
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s", ErrTemplateNotFound, path)
		}
		return nil, fmt.Errorf("%w: %w", ErrOpenTemplate, err)
	}

	zr, err := zip.OpenReader(path)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrOpenTemplate, err)
	}
	defer zr.Close()

	var out bytes.Buffer
	zw := zip.NewWriter(&out)
	unfilled := map[string]struct{}{}

	for _, entry := range zr.File {
		rc, err := entry.Open()
		if err != nil {
			return nil, fmt.Errorf("%w %q: %w", ErrReadTemplateEntry, entry.Name, err)
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, fmt.Errorf("%w %q: %w", ErrReadTemplateEntry, entry.Name, err)
		}

		if isWordTextPart(entry.Name) {
			data = placeholderRe.ReplaceAllFunc(data, func(m []byte) []byte {
				key := string(placeholderRe.FindSubmatch(m)[1])
				value, ok := replacements[key]
				if !ok {
					unfilled[key] = struct{}{}
					return m
				}
				return []byte(escapeXML(value))
			})
		}

		w, err := zw.CreateHeader(&zip.FileHeader{Name: entry.Name, Method: zip.Deflate, Modified: entry.Modified})
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrWriteDocx, err)
		}
		if _, err := w.Write(data); err != nil {
			return nil, fmt.Errorf("%w: %w", ErrWriteDocx, err)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrWriteDocx, err)
	}

	if len(unfilled) > 0 {
		names := make([]string, 0, len(unfilled))
		for k := range unfilled {
			names = append(names, k)
		}
		sort.Strings(names)
		return nil, fmt.Errorf("%w: %s: %s", ErrUnfilledPlaceholders, templateName, strings.Join(names, ", "))
	}

	return out.Bytes(), nil
}

func isWordTextPart(name string) bool {
	if !strings.HasPrefix(name, "word/") || !strings.HasSuffix(name, ".xml") {
		return false
	}
	base := filepath.Base(name)
	return base == "document.xml" || strings.HasPrefix(base, "header") || strings.HasPrefix(base, "footer")
}

func escapeXML(s string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}
