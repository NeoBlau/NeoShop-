# 3DSFERA — one-command development environment.
#
#   make dev     first run: everything from a clean checkout
#   make up      infrastructure only (postgres, minio, mailpit)
#   make app     application processes only (api + web)
#
SHELL := /bin/bash
COMPOSE := docker compose
DEMO_ASSET_MARKER := apps/api/prisma/seed-assets/robot-vacuum.glb
LOCATION_MARKER := apps/web/public/world/location/location.json

.DEFAULT_GOAL := help
.PHONY: help env install up down restart logs db-migrate db-reset db-studio seed \
        app dev build lint typecheck test e2e desktop assets assets-if-missing textures \
        world-assets location location-if-missing installer clean

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

world-assets: ## Download the CC0 world assets (HDRI, scanned materials, font)
	pnpm --filter @3dsfera/tools run fetch:assets

location: ## Fetch and build the walkable location (about forty minutes, once)
	pnpm --filter @3dsfera/tools run build:location

# Two gigabytes come down and an hour of encoding goes into this, so a repeat
# `make dev` skips it. Delete apps/web/public/world/location to force a rebuild.
location-if-missing:
	@test -f $(LOCATION_MARKER) || $(MAKE) location

textures: ## Generate the 4K PBR material library (about six minutes)
	pnpm --filter @3dsfera/tools run gen:textures

assets: textures ## Regenerate the demo materials and GLB models
	pnpm --filter @3dsfera/tools run gen:assets

# The generated library is deterministic but takes about seven minutes, so a
# repeat `make dev` skips it. Delete the directory to force a rebuild.
assets-if-missing:
	@test -f $(DEMO_ASSET_MARKER) || $(MAKE) assets

seed: ## Load demo data (suppliers, pavilions, five animated products)
	pnpm --filter @3dsfera/api run seed

app: ## Run api + web with hot reload
	pnpm dev

dev: env install world-assets location-if-missing assets-if-missing up db-migrate seed app ## Full local environment, one command

build: ## Production build of every package
	pnpm build

lint: ## ESLint over the whole workspace
	pnpm lint

typecheck: ## tsc --noEmit over the whole workspace
	pnpm typecheck

test: ## Vitest unit tests
	pnpm test

e2e: location-if-missing ## Playwright end-to-end tests (requires `make up` + running app)
	pnpm --filter @3dsfera/web run test:e2e

desktop: ## Run the Tauri shell against the dev server
	pnpm --filter @3dsfera/desktop run icons
	pnpm --filter @3dsfera/desktop run dev

installer: location-if-missing ## Build the installer for this platform (needs Rust)
	pnpm --filter @3dsfera/desktop run build

clean: ## Remove build output and node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules \
	       apps/*/dist packages/*/dist apps/api/src/generated
