package library

import (
	"errors"
	"testing"

	entity "fesmu/contract/fesmu/entity/v2"
)

func text(id, s string) *entity.ManualBlock {
	return &entity.ManualBlock{Id: id, Body: &entity.ManualBlock_Text{Text: &entity.ManualTextBlock{Text: s}}}
}

func TestCheckSectionsCollectsRefs(t *testing.T) {
	sections := []*entity.ManualSection{{
		Id: "s1", Title: "Тема 1",
		Blocks: []*entity.ManualBlock{
			text("b1", "Введение"),
			{Id: "b2", Body: &entity.ManualBlock_Figure{Figure: &entity.ManualFigureBlock{File: &entity.LibraryFile{Id: 5}}}},
			{Id: "b3", Body: &entity.ManualBlock_Attachment{Attachment: &entity.ManualAttachmentBlock{File: &entity.LibraryFile{Id: 5}}}},
			{Id: "b4", Body: &entity.ManualBlock_Literature{Literature: &entity.ManualLiteratureBlock{ItemIds: []int64{3, 3, 4}}}},
			{Id: "b5", Body: &entity.ManualBlock_Heading{Heading: &entity.ManualHeadingBlock{Text: "x", Level: 9}}},
		},
	}}
	r, err := checkSections(sections)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.files) != 1 || r.files[0] != 5 {
		t.Errorf("files %v", r.files)
	}
	if len(r.items) != 2 {
		t.Errorf("items %v", r.items)
	}
	if lvl := sections[0].Blocks[4].GetHeading().GetLevel(); lvl != 2 {
		t.Errorf("heading level %d, want clamped to 2", lvl)
	}
}

func TestCheckSectionsRejects(t *testing.T) {
	cases := map[string][]*entity.ManualSection{
		"no title":     {{Id: "s1"}},
		"duplicate id": {{Id: "s1", Title: "A", Blocks: []*entity.ManualBlock{text("s1", "x")}}},
		"empty block":  {{Id: "s1", Title: "A", Blocks: []*entity.ManualBlock{{Id: "b1"}}}},
		"bad video": {{Id: "s1", Title: "A", Blocks: []*entity.ManualBlock{
			{Id: "b1", Body: &entity.ManualBlock_Video{Video: &entity.ManualVideoBlock{Url: "javascript:alert(1)"}}},
		}}},
		"quiz answer out of range": {{Id: "s1", Title: "A", Blocks: []*entity.ManualBlock{
			{Id: "b1", Body: &entity.ManualBlock_Quiz{Quiz: &entity.ManualQuizBlock{Questions: []*entity.ManualQuizQuestion{
				{Text: "?", Options: []string{"a", "b"}, Correct: []int32{2}},
			}}}},
		}}},
	}
	for name, sections := range cases {
		if _, err := checkSections(sections); !errors.Is(err, ErrInvalid) {
			t.Errorf("%s: err %v, want ErrInvalid", name, err)
		}
	}
}

func TestSectionsRoundTrip(t *testing.T) {
	in := []*entity.ManualSection{{Id: "s1", Title: "Тема", Blocks: []*entity.ManualBlock{text("b1", "**жирный**")}}}
	raw, err := encodeSections(in)
	if err != nil {
		t.Fatal(err)
	}
	out, err := decodeSections(raw)
	if err != nil || len(out) != 1 || out[0].GetBlocks()[0].GetText().GetText() != "**жирный**" {
		t.Fatalf("round trip: %v %v", out, err)
	}
}
