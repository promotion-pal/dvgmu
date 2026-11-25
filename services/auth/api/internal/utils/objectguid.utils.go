package utils

import (
	"encoding/hex"
	"fmt"
	"strings"
)

// FormatObjectGUID переводит сырые 16 байт AD objectGUID (mixed-endian)
// в канонический вид xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
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

// ParseObjectGUID — обратная операция: канонический вид → 16 сырых байт AD.
func ParseObjectGUID(canonical string) ([16]byte, error) {
	var raw [16]byte

	decoded, err := hex.DecodeString(strings.ReplaceAll(canonical, "-", ""))
	if err != nil || len(decoded) != 16 {
		return raw, fmt.Errorf("invalid objectGUID %q", canonical)
	}

	raw[0], raw[1], raw[2], raw[3] = decoded[3], decoded[2], decoded[1], decoded[0]
	raw[4], raw[5] = decoded[5], decoded[4]
	raw[6], raw[7] = decoded[7], decoded[6]
	raw[8], raw[9] = decoded[8], decoded[9]
	copy(raw[10:], decoded[10:])

	return raw, nil
}
