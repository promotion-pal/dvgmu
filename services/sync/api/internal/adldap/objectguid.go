package adldap

import "fmt"

// FormatObjectGUID переводит сырые 16 байт AD objectGUID (mixed-endian) в
// канонический вид xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx. Дублирует
// services/auth/internal/utils.FormatObjectGUID — отдельный Go-модуль,
// шарить код нечем, это тот же маленький хелпер, что и там.
func FormatObjectGUID(raw []byte) (string, error) {
	if len(raw) != 16 {
		return "", fmt.Errorf("unexpected length %d, want 16", len(raw))
	}
	return fmt.Sprintf(
		"%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
		raw[3], raw[2], raw[1], raw[0],
		raw[5], raw[4],
		raw[7], raw[6],
		raw[8], raw[9],
		raw[10], raw[11], raw[12], raw[13], raw[14], raw[15],
	), nil
}
