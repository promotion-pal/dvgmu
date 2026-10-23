package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"dvgmu/sync/internal/app"
	"dvgmu/sync/internal/config"
)

var Version = "dev"

func main() {
	_ = godotenv.Load(".env")

	// Флаги write-режима — регистрируются ДО config.MustLoad(), которая сама
	// зовёт flag.Parse() (см. internal/config.fetchConfigPath). По умолчанию
	// (оба флага нулевые) — обычный read-only тикер, ничего не пишет.
	createMissing := flag.Int("create-missing", 0,
		"одноразово создать до N учёток в AD для missing_in_ad и выйти (нужен настроенный SYNC_LDAP_WRITE_*)")
	linkUnlinked := flag.Bool("link-unlinked", false,
		"одноразово привязать в auth все unlinked_but_exists (без записи в AD) и выйти")
	once := flag.Bool("once", false,
		"выполнить один read-only проход (без записи) и выйти, вместо вечного тикера")
	checkMissing := flag.Bool("check-missing", false,
		"сухая проверка: посчитать sAMAccountName для всех missing_in_ad и найти коллизии между ними ДО реального create-missing, без записи в AD")

	cfg := config.MustLoad()

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	log.Info("starting dvgmu-sync", "version", Version)

	application := app.New(log, cfg)

	if *createMissing > 0 || *linkUnlinked {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := application.ApplyOnce(ctx, *createMissing, *linkUnlinked); err != nil {
			log.Error("apply failed", "error", err.Error())
			os.Exit(1)
		}
		log.Info("apply finished, exiting")
		return
	}

	if *checkMissing {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := application.CheckMissing(ctx); err != nil {
			log.Error("check-missing found problems", "error", err.Error())
			os.Exit(1)
		}
		log.Info("check-missing: проблем не найдено, можно запускать create-missing")
		return
	}

	if *once {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		application.RunOnce(ctx)
		return
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	application.Run(ctx)

	log.Info("dvgmu-sync gracefully stopped")
}
