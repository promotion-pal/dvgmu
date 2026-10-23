package utils

import (
	"context"
	"crypto/tls"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

const smtpTimeout = 30 * time.Second

type EmailProvider struct {
	host          string
	port          string
	from          string
	password      string
	tlsSkipVerify bool
}

func NewEmailProvider(host, port, from, password string, tlsSkipVerify bool) *EmailProvider {
	return &EmailProvider{
		host:          host,
		port:          port,
		from:          from,
		password:      password,
		tlsSkipVerify: tlsSkipVerify,
	}
}

func (p *EmailProvider) Send(ctx context.Context, msg Message) error {
	rcpt, err := mail.ParseAddress(msg.Recipient)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrInvalidRecipient, msg.Recipient)
	}

	contentType := "text/plain"
	if msg.HTML {
		contentType = "text/html"
	}

	raw := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: %s; charset=UTF-8\r\n"+
		"\r\n"+
		"%s\r\n",
		p.from, rcpt.Address, mime.QEncoding.Encode("utf-8", stripCRLF(msg.Subject)), contentType, msg.Body)

	if err := p.deliver(ctx, rcpt.Address, []byte(raw)); err != nil {
		return fmt.Errorf("%w: %w", ErrSendEmail, err)
	}

	return nil
}

func (p *EmailProvider) deliver(ctx context.Context, to string, raw []byte) error {
	dialer := net.Dialer{Timeout: smtpTimeout}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(p.host, p.port))
	if err != nil {
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(smtpTimeout))

	c, err := smtp.NewClient(conn, p.host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer c.Close()

	if ok, _ := c.Extension("STARTTLS"); ok {
		if err := c.StartTLS(&tls.Config{ServerName: p.host, InsecureSkipVerify: p.tlsSkipVerify}); err != nil {
			return err
		}
	}

	if ok, _ := c.Extension("AUTH"); ok {
		if err := c.Auth(smtp.PlainAuth("", p.from, p.password, p.host)); err != nil {
			return err
		}
	}

	if err := c.Mail(p.from); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}

	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(raw); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}

	return c.Quit()
}

func stripCRLF(s string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(s)
}
