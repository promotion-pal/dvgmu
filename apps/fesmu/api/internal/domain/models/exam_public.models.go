package models

// ExamPublicTest is a catalogue entry for the shared computer-class page.
// It deliberately contains neither questions, correct answers nor student data.
type ExamPublicTest struct {
	TestID          int64
	Token           string
	Faculty         string
	Semester        int
	Subject         string
	Title           string
	DurationMinutes int
}
