# 3DSFERA — one-command development environment.
#
#   make dev     first run: everything from a clean checkout
#   make up      infrastructure only (postgres, minio, mailpit)
#   make app     application processes only (api + web)
#
SHELL := /bin/bash
COMPOSE := docker compose

.DEFAULT_GOAL := help
.PHONY: help env install up down restart logs db-migrate db-reset db-studio seed \
        app dev build lint typecheck test e2e desktop clean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || (cp .env.example .env && echo "created .env from .env.example")

install: ## Install workspace dependencies
	pnpm install

up: env ## Start postgres, minio and mailpit
	$(COMPOSE) up -d --wait postgres minio mailpit
	$(COMPOSE) up minio-init

down: ## Stop infrastructure (data volumes are kept)
	$(COMPOSE) down

restart: down up ## Restart infrastructure

logs: ## Tail infrastructure logs
	$(COMPOSE) logs -f

db-migrate: ## Apply Prisma migrations
	pnpm --filter @3dsfera/api exec prisma migrate deploy

db-dev: ## Create/apply a migration in development
	pnpm --filter @3dsfera/api exec prisma migrate dev

db-reset: ## Drop the database, re-apply migrations, re-seed
	pnpm --filter @3dsfera/api exec prisma migrate reset --force

db-studio: ## Open Prisma Studio
	pnpm --filter @3dsfera/api exec prisma studio

seed: ## Load demo data (suppliers, pavilion, products)
	pnpm --filter @3dsfera/api run seed

app: ## Run api + web with hot reload
	pnpm dev

dev: env install up db-migrate seed app ## Full local environment, one command

build: ## Production build of every package
	pnpm build

lint: ## ESLint over the whole workspace
	pnpm lint

typecheck: ## tsc --noEmit over the whole workspace
	pnpm typecheck

test: ## Vitest unit tests
	pnpm test

e2e: ## Playwright end-to-end tests (requires `make up` + running app)
	pnpm --filter @3dsfera/web run test:e2e

desktop: ## Run the Tauri shell against the dev server
	pnpm --filter @3dsfera/desktop run dev

clean: ## Remove build output and node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules \
	       apps/*/dist packages/*/dist apps/api/src/generated
