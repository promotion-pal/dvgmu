package models

import (
	"net"
	"net/http"
	"strings"
	"time"
)

type AnalyticIP struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	AnalyticID int64
	IP         string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (AnalyticIP) TableName() string {
	return "analytic_ips"
}

func (a *AnalyticIP) CanReevaluate(window time.Duration, now time.Time) (allowed bool, retryAfter time.Time) {
	if a == nil || a.CreatedAt.IsZero() {
		return true, time.Time{}
	}
	next := a.CreatedAt.Add(window)
	if now.Before(next) {
		return false, next
	}
	return true, time.Time{}
}

func ReevaluationWindow(seconds int) time.Duration {
	return time.Duration(seconds) * time.Second
}

func ClientIP(header http.Header, peerAddr string) string {
	if xff := header.Get("X-Forwarded-For"); xff != "" {
		first, _, _ := strings.Cut(xff, ",")
		if ip := strings.TrimSpace(first); ip != "" {
			return ip
		}
	}
	if xr := strings.TrimSpace(header.Get("X-Real-IP")); xr != "" {
		return xr
	}
	if host, _, err := net.SplitHostPort(peerAddr); err == nil {
		return host
	}
	return peerAddr
}

type ReevaluationTooSoonError struct {
	RetryAfter time.Time
}

func (e ReevaluationTooSoonError) Error() string {
	return "reevaluation too soon, retry after " + e.RetryAfter.Format(time.RFC3339)
}
