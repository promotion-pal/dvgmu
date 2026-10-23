package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
)

var EMAIL = "@fesmu.ru"

var translitTable = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
	'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
	'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
	'ф': "f", 'х': "kh", 'ц': "ts", 'ч': "ch", 'ш': "sh", 'щ': "shch",
	'ъ': "", 'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
}

func Slug(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		if lat, ok := translitTable[r]; ok {
			b.WriteString(lat)
			continue
		}
		if r >= 'a' && r <= 'z' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func firstLetter(s string) string {
	if s == "" {
		return ""
	}
	return s[:1]
}

func loginCandidates(lastName, firstName, patronymic string) []string {
	last := Slug(lastName)
	first := Slug(firstName)
	patr := Slug(patronymic)

	fi, pi := firstLetter(first), firstLetter(patr)

	if patr == "" {
		return []string{
			last + "_" + fi,
			last + "_" + first,
		}
	}

	seen := make(map[string]bool, 4)
	var out []string
	add := func(c string) {
		if !seen[c] {
			seen[c] = true
			out = append(out, c)
		}
	}
	add(last + "_" + fi + pi)
	add(last + "_" + first + pi)
	add(last + "_" + fi + patr)
	add(last + "_" + first + "_" + patr)
	return out
}

func GenEmail(lastName, firstName, patronymic string, taken func(login string) (bool, error)) (string, error) {
	candidates := loginCandidates(lastName, firstName, patronymic)

	for _, c := range candidates {
		ok, err := taken(c)
		if err != nil {
			return "", err
		}
		if !ok {
			return c + EMAIL, nil
		}
	}

	base := candidates[0]
	for n := 2; n < 1000; n++ {
		c := fmt.Sprintf("%s%d", base, n)
		ok, err := taken(c)
		if err != nil {
			return "", err
		}
		if !ok {
			return c + EMAIL, nil
		}
	}
	return "", fmt.Errorf("не удалось подобрать свободный логин для %q %q %q", lastName, firstName, patronymic)
}

const passwordDigitsCount = 3

func GenPassword(firstName string) (string, error) {
	name := Slug(firstName)
	if name == "" {
		name = "user"
	}
	name = strings.ToUpper(name[:1]) + name[1:]

	digits := make([]byte, 0, passwordDigitsCount)
	for i := 0; i < passwordDigitsCount; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		digits = append(digits, byte('0')+byte(n.Int64()))
	}

	return name + string(digits), nil
}
