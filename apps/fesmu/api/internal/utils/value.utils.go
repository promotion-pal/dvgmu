package utils

func ValInt32(ptr *int32) int32 {
	if ptr == nil {
		return 0
	}
	return *ptr
}

func ValBool(ptr *bool) bool {
	if ptr == nil {
		return false
	}
	return *ptr
}
