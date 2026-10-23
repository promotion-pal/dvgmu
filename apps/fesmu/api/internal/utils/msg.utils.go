package utils

import "fmt"

const (
	MSGSuccess = "Success"
)

func MSGCreateSuccess(value string, ID int64) string {
	return fmt.Sprintf("%s created successfully with ID: %d", value, ID)
}

func MSGUpdateSuccess(value string, ID int64) string {
	return fmt.Sprintf("%s updated successfully with ID: %d", value, ID)
}

func MSGDeleteSuccess(value string, ID int64) string {
	return fmt.Sprintf("%s deleted successfully with ID: %d", value, ID)
}

func MSGFetchSuccess(value string, count int) string {
	return fmt.Sprintf("%s fetched successfully, count: %d", value, count)
}

// Error

const (
	MSGAuthNotFoundUserID = "user session not found or expired"
)

func MSGValidateFailed(value string, err error) string {
	return fmt.Sprintf("validation failed %s Error: %v", value, err)
}

func MSGCreateError(value string, err error) string {
	return fmt.Sprintf("failed to save %s to database %v", value, err)
}

func MSGFetchError(value string, err error) string {
	return fmt.Sprintf("failed to fetch %s from database %v", value, err)
}

func MSGFetchByIDError(value string, err error) string {
	return fmt.Sprintf("failed to fetch %s by ID from database %v", value, err)
}

func MSGUpdateError(value string, err error) string {
	return fmt.Sprintf("failed to update %s in database %v", value, err)
}

func MSGDeleteError(value string, err error) string {
	return fmt.Sprintf("failed to delete %s from database %v", value, err)
}

func MSGNotFoundError(value string, id int64) string {
	return fmt.Sprintf("%s with ID %d not found", value, id)
}

// Error DB

func MSGDBUpdateError(value string, id int64, err error) string {
	return fmt.Sprintf("failed to update %s with ID %d in database %v", value, id, err)
}

func MSGDBDeleteError(value string, id int64, err error) string {
	return fmt.Sprintf("failed to delete %s with ID %d in database %v", value, id, err)
}

func MSGDBFetchByIDError(value string, id int64, err error) string {
	return fmt.Sprintf("failed to fetch %s with ID %d in database %v", value, id, err)
}
