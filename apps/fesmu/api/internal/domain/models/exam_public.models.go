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

// Only the identity matching the supplied record book is returned publicly.
type ExamPublicStudent struct {
	FullName, StudentGroup, Faculty string
	Course                          int
}
type ExamPublicCatalogue struct {
	Student ExamPublicStudent
	Exams   []ExamPublicTest
}
