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
AMBIENCE_MARKER := apps/web/public/world/audio/street.wav

.DEFAULT_GOAL := help
.PHONY: help env install shared up down restart logs db-migrate db-reset db-studio seed \
        app dev build lint typecheck test e2e desktop assets assets-if-missing textures \
        world-assets location location-if-missing ambience ambience-if-missing ingest \
        installer clean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || (cp .env.example .env && echo "created .env from .env.example")

install: ## Install workspace dependencies
	pnpm install

# @3dsfera/shared exports compiled files, not sources, so everything that
# imports it — the seed script, the api, the tests — needs it built first.
# `pnpm dev` builds it itself; the steps that run before the app do not.
shared: ## Build the shared types and zod schemas
	pnpm --filter @3dsfera/shared build

# Pull first, separately: a registry that refuses an image says so plainly here,
# instead of `up` reporting "No such image" for every service after the first
# failure.
up: env ## Start postgres, minio and mailpit
	$(COMPOSE) pull --quiet postgres minio mailpit
	$(COMPOSE) up -d --wait --wait-timeout 180 postgres minio mailpit
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

ambience: ## Synthesise the street sound bed (a few seconds)
	pnpm --filter @3dsfera/tools run gen:ambience

ambience-if-missing:
	@test -f $(AMBIENCE_MARKER) || $(MAKE) ambience

textures: ## Generate the 4K PBR material library (about six minutes)
	pnpm --filter @3dsfera/tools run gen:textures

assets: textures ## Regenerate the demo materials and GLB models
	pnpm --filter @3dsfera/tools run gen:assets

# The generated library is deterministic but takes about seven minutes, so a
# repeat `make dev` skips it. Delete the directory to force a rebuild.
assets-if-missing:
	@test -f $(DEMO_ASSET_MARKER) || $(MAKE) assets

# Third-party product models, normalised and given their clips. Runs after the
# generated placeholders so a real model overwrites the one made of primitives,
# and does nothing at all when assets/incoming is empty — which is the case on
# a clean checkout, so `make dev` still works with the placeholders.
ingest: ## Normalise the models in assets/incoming into seed products
	pnpm --filter @3dsfera/tools run ingest

seed: shared ## Load demo data (suppliers, pavilions, five animated products)
	pnpm --filter @3dsfera/api run seed

app: ## Run api + web with hot reload
	pnpm dev

dev: env install shared world-assets location-if-missing ambience-if-missing assets-if-missing ingest up db-migrate seed app ## Full local environment, one command

build: ## Production build of every package
	pnpm build

lint: ## ESLint over the whole workspace
	pnpm lint

typecheck: shared ## tsc --noEmit over the whole workspace
	pnpm typecheck

test: shared ## Vitest unit tests
	pnpm test

e2e: shared location-if-missing ## Playwright end-to-end tests (requires `make up` + running app)
	pnpm --filter @3dsfera/web run test:e2e

desktop: ## Run the Tauri shell against the dev server
	pnpm --filter @3dsfera/desktop run icons
	pnpm --filter @3dsfera/desktop run dev

installer: location-if-missing ## Build the installer for this platform (needs Rust)
	pnpm --filter @3dsfera/desktop run build

clean: ## Remove build output and node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules \
	       apps/*/dist packages/*/dist apps/api/src/generated
